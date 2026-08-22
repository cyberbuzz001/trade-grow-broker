import { pool, query, queryOne, execute, withTransaction } from '../db/schema';
import { RMS } from './RMS';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { ExecutionEngine } from './ExecutionEngine';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { redis } from '../db/redis';
import { logAuditAction } from '../middleware/audit';

/** Internal-only actor tokens for SubmitOrderDTO.systemActor — never sourced from any HTTP request body. */
export const SYSTEM_ACTOR_RMS_AUTO_SQUAREOFF = 'RMS_AUTO_SQUAREOFF';

export interface SubmitOrderDTO {
  userId: string;
  instrumentToken: string;
  exchange: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  triggerPrice?: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
  productType: 'MIS' | 'CNC' | 'NRML';
  idempotencyKey?: string;
  /** Tags who generated this order. Defaults to 'USER' when omitted. */
  source?: string;
  /** Free-text reason, e.g. 'MIS_CUTOFF'. Only meaningful alongside a non-'USER' source. */
  reason?: string;
  /**
   * Internal bypass for Phase 0's account-status gate — set ONLY by code that
   * calls OMS.submitOrder directly (e.g. RmsAutoSquareOffEngine), never read
   * from any request body. Lets the engine close out existing exposure on a
   * SUSPENDED/DISABLED account without reopening the door for that account to
   * place ordinary orders. Every use is audit-logged.
   */
  systemActor?: string;
}

export class OMS {
  public static async submitOrder(dto: SubmitOrderDTO): Promise<{ success: boolean; orderId?: string; error?: string }> {
    // Safety assertion: fail-closed guard — no real money can be placed
    SafetyLock.assertSimulationOnly('OMS.submitOrder');

    // 0. Ensure user ID exists in users table to prevent FK constraint failure,
    // and re-check account status here too — defense-in-depth for any caller
    // that reaches submitOrder without going through the route-level check.
    let userRow = await queryOne<any>('SELECT id, status, risk_restriction FROM users WHERE id = $1', [dto.userId]);
    if (!userRow) {
      const fallbackUser = await queryOne<any>('SELECT id, status, risk_restriction FROM users WHERE email = $1 OR username = $2 LIMIT 1', [dto.userId, dto.userId]);
      if (fallbackUser) {
        dto.userId = fallbackUser.id;
        userRow = fallbackUser;
      } else {
        return { success: false, error: 'ORDER_REJECTED: User account does not exist in database. Please re-login.' };
      }
    }
    if (userRow.status !== 'ACTIVE') {
      if (dto.systemActor === SYSTEM_ACTOR_RMS_AUTO_SQUAREOFF) {
        await logAuditAction(
          'SYSTEM', 'SYSTEM', 'RMS_STATUS_GATE_BYPASS', 'USER', dto.userId,
          { status: userRow.status }, { systemActor: dto.systemActor, symbol: dto.symbol, side: dto.side, quantity: dto.quantity },
          '127.0.0.1'
        );
      } else {
        return { success: false, error: 'ORDER_REJECTED: Account is suspended or disabled' };
      }
    }

    // 1. Distributed Atomic Idempotency Lock (Multi-Node Race Condition Guard)
    let lockAcquired = false;
    const lockKey = dto.idempotencyKey ? `lock:order:${dto.idempotencyKey}` : null;

    if (lockKey) {
      lockAcquired = await redis.acquireLock(lockKey, 10, dto.userId);
      if (!lockAcquired) {
        // Another concurrent request with the same idempotency key is in-flight.
        // Wait briefly (100ms) and check for the completed order in DB.
        await new Promise(r => setTimeout(r, 100));
        const existing = await queryOne<any>(
          'SELECT order_id, status FROM orders WHERE idempotency_key = $1 AND user_id = $2',
          [dto.idempotencyKey, dto.userId]
        );
        if (existing) {
          return { success: true, orderId: existing.order_id };
        }
        return { success: false, error: 'ORDER_REJECTED: Duplicate in-flight order request detected. Please retry.' };
      }

      // Check if this idempotency key was already completed in DB
      const existing = await queryOne<any>(
        'SELECT order_id, status FROM orders WHERE idempotency_key = $1 AND user_id = $2',
        [dto.idempotencyKey, dto.userId]
      );
      if (existing) {
        await redis.releaseLock(lockKey);
        return { success: true, orderId: existing.order_id };
      }
    }

    try {
      // P0-9 FIX: crypto.randomUUID() instead of Date.now()
      const dbOrderId     = 'ord_' + generateUUID();
      const publicOrderId = 'ORD' + generateUUID().slice(0, 8).toUpperCase();

    // 1. Pre-trade RMS validation
    const rmsResult = await RMS.validateOrder({
      userId:          dto.userId,
      instrumentToken: dto.instrumentToken,
      exchange:        dto.exchange,
      symbol:          dto.symbol,
      side:            dto.side,
      quantity:        dto.quantity,
      price:           dto.price,
      orderType:       dto.orderType,
      productType:     dto.productType,
      riskRestriction: userRow.risk_restriction,
    });

    if (!rmsResult.passed) {
      // Log rejected order to DB
      await execute(
        `INSERT INTO orders (id, order_id, user_id, instrument_token, exchange, symbol, side, quantity, price, trigger_price, order_type, product_type, status, rejection_reason, idempotency_key, source, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'REJECTED', $13, $14, $15, $16)`,
        [
          dbOrderId, publicOrderId, dto.userId, dto.instrumentToken,
          dto.exchange, dto.symbol, dto.side, dto.quantity, dto.price,
          dto.triggerPrice || 0, dto.orderType, dto.productType,
          rmsResult.reason, dto.idempotencyKey || null,
          dto.source || 'USER', dto.reason || null
        ]
      );

      // Record order event
      await this.recordOrderEvent(dbOrderId, null, 'REJECTED', rmsResult.reason || 'RMS rejected');

      return { success: false, error: rmsResult.reason };
    }

    // 2. Save the order, then recompute the authoritative used_margin
    // (positions + every still-pending order, this one now included) —
    // atomically, so a margin-rejected order never lands in the table as an
    // unfunded phantom row. The wallet row is locked for the duration of
    // this transaction (inside recomputeUsedMarginForUser), which is what
    // actually guards against two concurrent submissions for the same user
    // both passing RMS's pre-check against the same stale used_margin
    // snapshot — replacing blockMargin's increment-based lock with the same
    // serialization guarantee.
    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO orders (id, order_id, user_id, instrument_token, exchange, symbol, side, quantity, price, trigger_price, order_type, product_type, status, idempotency_key, source, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACCEPTED', $13, $14, $15)`,
          [
            dbOrderId, publicOrderId, dto.userId, dto.instrumentToken,
            dto.exchange, dto.symbol, dto.side, dto.quantity, dto.price,
            dto.triggerPrice || 0, dto.orderType, dto.productType,
            dto.idempotencyKey || null,
            dto.source || 'USER', dto.reason || null
          ]
        );

        const newUsedMargin = await VirtualWalletLedger.recomputeUsedMarginForUser(dto.userId, client);
        const walletRow = await client.query('SELECT cash_balance FROM virtual_wallets WHERE user_id = $1', [dto.userId]);
        const cashBalance = walletRow.rows.length ? parseFloat(walletRow.rows[0].cash_balance) : 0;
        if (newUsedMargin > cashBalance) {
          throw new Error(`ORDER_REJECTED: Insufficient buying power. Required: ₹${newUsedMargin.toFixed(2)}, Available: ₹${cashBalance.toFixed(2)}`);
        }
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'ORDER_REJECTED: Margin check failed — concurrent order detected' };
    }

    // Record order event
    await this.recordOrderEvent(dbOrderId, null, 'ACCEPTED', 'RMS passed, margin blocked');

    // 4. Trigger execution match cycle (async, non-blocking in production)
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => ExecutionEngine.processPendingOrders(), 50);
    }

    return { success: true, orderId: publicOrderId };
  } catch (err: any) {
    console.error('[OMS.submitOrder] Exception:', err.message);
    return { success: false, error: err.message || 'ORDER_SUBMISSION_ERROR' };
  } finally {
    if (lockKey && lockAcquired) {
      await redis.releaseLock(lockKey).catch(() => {});
    }
  }
}

  public static async cancelOrder(orderId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const order = await queryOne<any>(
      'SELECT * FROM orders WHERE (order_id = $1 OR id = $1) AND user_id = $2',
      [orderId, userId]
    );

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (!['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(order.status)) {
      return { success: false, error: `Order cannot be cancelled in state ${order.status}` };
    }

    await withTransaction(async (client) => {
      await client.query(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [order.id]);
      // The cancelled order no longer matches the pending-status filter, so
      // it naturally drops out of the recomputed sum — no separate release
      // amount to calculate (that hand-computed amount is what used to go
      // out of sync with what was actually blocked).
      await VirtualWalletLedger.recomputeUsedMarginForUser(userId, client);
    });

    await this.recordOrderEvent(order.id, order.status, 'CANCELLED', 'User cancelled order');

    return { success: true };
  }

  public static async modifyOrder(
    orderId: string,
    userId: string,
    newPrice: number,
    newQuantity?: number
  ): Promise<{ success: boolean; error?: string }> {
    const order = await queryOne<any>(
      'SELECT * FROM orders WHERE (order_id = $1 OR id = $1) AND user_id = $2',
      [orderId, userId]
    );

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.status !== 'ACCEPTED' && order.status !== 'PENDING') {
      return { success: false, error: `Order cannot be modified in state ${order.status}` };
    }

    const price = newPrice > 0 ? newPrice : parseFloat(order.price);
    const quantity = newQuantity && newQuantity > 0 ? newQuantity : parseInt(order.quantity, 10);

    // A modify can enlarge price/quantity well past what was originally
    // margin-checked at placement — re-validate atomically rather than
    // trusting the original acceptance to still cover it.
    try {
      await withTransaction(async (client) => {
        await client.query(`UPDATE orders SET price = $1, quantity = $2, updated_at = NOW() WHERE id = $3`, [price, quantity, order.id]);

        const newUsedMargin = await VirtualWalletLedger.recomputeUsedMarginForUser(userId, client);
        const walletRow = await client.query('SELECT cash_balance FROM virtual_wallets WHERE user_id = $1', [userId]);
        const cashBalance = walletRow.rows.length ? parseFloat(walletRow.rows[0].cash_balance) : 0;
        if (newUsedMargin > cashBalance) {
          throw new Error(`MODIFY_REJECTED: Modification requires ₹${newUsedMargin.toFixed(2)} margin, exceeding available funds of ₹${cashBalance.toFixed(2)}`);
        }
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'MODIFY_FAILED: Margin check failed' };
    }

    await this.recordOrderEvent(order.id, order.status, order.status, `Order modified: price=${price}, qty=${quantity}`);

    return { success: true };
  }

  public static async getUserOrders(userId: string, limit: number = 100, offset: number = 0, todayOnly: boolean = true): Promise<any[]> {
    if (todayOnly) {
      return query(
        'SELECT * FROM orders WHERE user_id = $1 AND created_at >= CURRENT_DATE ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [userId, limit, offset]
      );
    }
    return query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
  }

  private static async recordOrderEvent(
    orderId: string,
    fromStatus: string | null,
    toStatus: string,
    reason: string
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
         VALUES ($1, $2, $3, $4, $5, 'SYSTEM')`,
        ['evt_' + generateUUID(), orderId, fromStatus, toStatus, reason]
      );
    } catch (err: any) {
      console.error('[OMS] Failed to record order event:', err.message);
    }
  }
}
