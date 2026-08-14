import { pool, query, queryOne, execute, withTransaction } from '../db/schema';
import { RMS } from './RMS';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { ExecutionEngine } from './ExecutionEngine';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';

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
}

export class OMS {
  public static async submitOrder(dto: SubmitOrderDTO): Promise<{ success: boolean; orderId?: string; error?: string }> {
    // Safety assertion: fail-closed guard — no real money can be placed
    SafetyLock.assertSimulationOnly('OMS.submitOrder');

    // 0. Ensure user ID exists in users table to prevent FK constraint failure
    const userRow = await queryOne<any>('SELECT id FROM users WHERE id = $1', [dto.userId]);
    if (!userRow) {
      const fallbackUser = await queryOne<any>('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [dto.userId, dto.userId]);
      if (fallbackUser) {
        dto.userId = fallbackUser.id;
      } else {
        return { success: false, error: 'ORDER_REJECTED: User account does not exist in database. Please re-login.' };
      }
    }

    // Idempotency: if we've seen this key before, return the existing order
    if (dto.idempotencyKey) {
      const existing = await queryOne<any>(
        'SELECT order_id, status FROM orders WHERE idempotency_key = $1 AND user_id = $2',
        [dto.idempotencyKey, dto.userId]
      );
      if (existing) {
        return { success: true, orderId: existing.order_id };
      }
    }

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
      productType:     dto.productType
    });

    if (!rmsResult.passed) {
      // Log rejected order to DB
      await execute(
        `INSERT INTO orders (id, order_id, user_id, instrument_token, exchange, symbol, side, quantity, price, trigger_price, order_type, product_type, status, rejection_reason, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'REJECTED', $13, $14)`,
        [
          dbOrderId, publicOrderId, dto.userId, dto.instrumentToken,
          dto.exchange, dto.symbol, dto.side, dto.quantity, dto.price,
          dto.triggerPrice || 0, dto.orderType, dto.productType,
          rmsResult.reason, dto.idempotencyKey || null
        ]
      );

      // Record order event
      await this.recordOrderEvent(dbOrderId, null, 'REJECTED', rmsResult.reason || 'RMS rejected');

      return { success: false, error: rmsResult.reason };
    }

    // 2. Block virtual margin (row-locked in VirtualWalletLedger)
    const marginBlocked = await VirtualWalletLedger.blockMargin(
      dto.userId, rmsResult.requiredMargin, publicOrderId, 'OMS'
    );

    if (!marginBlocked) {
      return { success: false, error: 'ORDER_REJECTED: Margin blocking failed — concurrent order detected' };
    }

    // 3. Save order to database
    await execute(
      `INSERT INTO orders (id, order_id, user_id, instrument_token, exchange, symbol, side, quantity, price, trigger_price, order_type, product_type, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACCEPTED', $13)`,
      [
        dbOrderId, publicOrderId, dto.userId, dto.instrumentToken,
        dto.exchange, dto.symbol, dto.side, dto.quantity, dto.price,
        dto.triggerPrice || 0, dto.orderType, dto.productType,
        dto.idempotencyKey || null
      ]
    );

    // Record order event
    await this.recordOrderEvent(dbOrderId, null, 'ACCEPTED', 'RMS passed, margin blocked');

    // 4. Trigger execution match cycle (async, non-blocking in production)
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => ExecutionEngine.processPendingOrders(), 50);
    }

    return { success: true, orderId: publicOrderId };
  }

  public static async cancelOrder(orderId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const order = await queryOne<any>(
      'SELECT * FROM orders WHERE order_id = $1 AND user_id = $2',
      [orderId, userId]
    );

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.status !== 'ACCEPTED' && order.status !== 'PENDING') {
      return { success: false, error: `Order cannot be cancelled in state ${order.status}` };
    }

    await execute(
      `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [order.id]
    );

    await this.recordOrderEvent(order.id, order.status, 'CANCELLED', 'User cancelled order');

    // Release blocked margin
    const leverageMultiplier = order.product_type === 'MIS' ? 0.20 : 1.0;
    const marginToRelease = parseFloat(order.price || '100') * parseInt(order.quantity) * leverageMultiplier;
    await VirtualWalletLedger.releaseMargin(userId, marginToRelease, orderId, 'OMS_CANCEL');

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

    await execute(
      `UPDATE orders SET price = $1, quantity = $2, updated_at = NOW() WHERE id = $3`,
      [price, quantity, order.id]
    );

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
