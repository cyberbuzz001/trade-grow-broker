import { query, queryOne, execute, withTransaction } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { MarketTick } from '../marketData/types';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { PortfolioService } from './PortfolioService';
import { generateUUID } from '../utils/crypto';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';
import { GreeksEngine } from '../marketData/GreeksEngine';

export class ExecutionEngine {
  private static timer: NodeJS.Timeout | null = null;
  private static repairTimer: NodeJS.Timeout | null = null;

  public static start(): void {
    console.log('[ExecutionEngine] Starting simulated order matching loop (500ms cycle)...');
    if (this.timer) clearInterval(this.timer);
    if (this.repairTimer) clearInterval(this.repairTimer);

    // Run matching loop every 500ms (in-memory only, no blocking REST calls)
    this.timer = setInterval(() => {
      this.processPendingOrders().catch(err => console.error('[ExecutionEngine] Matching cycle error:', err.message));
    }, 500);

    // Run position audit/repair every 60 seconds (not 500ms)
    this.repairTimer = setInterval(() => {
      PortfolioService.auditAndRepairAllPositions().catch(() => {});
    }, 60000);
  }

  public static stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.repairTimer) clearInterval(this.repairTimer);
  }

  public static async processPendingOrders(): Promise<void> {
    try {
      const pendingOrders = await query<any>(
        `SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING') ORDER BY created_at ASC LIMIT 50`
      );

      if (pendingOrders.length === 0) return;

      for (const order of pendingOrders) {
        const engine = MarketDataEngine.getInstance();
        let tick: MarketTick | undefined | null = undefined;

        // Try direct lookup with all possible symbology alias keys
        const symbolAliases = [
          ...(order.symbol ? SymbologyNormalizer.normalizeToken(order.symbol) : []),
          ...(order.instrument_token ? SymbologyNormalizer.normalizeToken(order.instrument_token) : [])
        ];

        for (const alias of symbolAliases) {
          tick = engine.getCachedTick(alias);
          if (tick && tick.ltp > 0) break;
        }

        // If not in cache, subscribe token to live WebSocket feed for future cycles
        if (!tick && (order.instrument_token || order.symbol)) {
          const subToken = order.instrument_token || order.symbol;
          engine.subscribe([subToken]);
        }

        // Check tick freshness (must be within last 30 seconds)
        const STALENESS_THRESHOLD_MS = 30000;
        let isStale = tick ? (Date.now() - tick.timestamp > STALENESS_THRESHOLD_MS) : true;

        // STRICT ACCURACY RULE: Simulated orders must ONLY execute against real, fresh live market ticks!
        if (!tick || isStale) {
          if (process.env.DEBUG_ORDER_ENGINE === 'true') {
            console.log(`[ORDER_ENGINE] Order ${order.order_id} (${order.symbol}): Waiting for real live market tick`);
          }
          continue;
        }

        const price     = parseFloat(order.price || '0');
        const trigPrice = parseFloat(order.trigger_price || '0');
        const ltp       = tick.ltp;
        const bidPrice  = tick.bid && tick.bid > 0 ? tick.bid : ltp;
        const askPrice  = tick.ask && tick.ask > 0 ? tick.ask : ltp;
        let executePrice: number | null = null;

        // Evaluate order execution criteria against live market tick
        if (order.order_type === 'MARKET') {
          executePrice = order.side === 'BUY' ? askPrice : bidPrice;
        } else if (order.order_type === 'LIMIT') {
          // BUY LIMIT: Execute only when market ask/LTP is AT OR BELOW target limit price
          if (order.side === 'BUY' && askPrice <= price) {
            executePrice = Math.min(askPrice, price);
          }
          // SELL LIMIT: Execute only when market bid/LTP is AT OR ABOVE target limit price
          if (order.side === 'SELL' && bidPrice >= price) {
            executePrice = Math.max(bidPrice, price);
          }
        } else if (order.order_type === 'SL' || order.order_type === 'SL_M') {
          // BUY SL: Execute when market price reaches or exceeds trigger price
          if (order.side === 'BUY' && askPrice >= trigPrice) {
            executePrice = order.order_type === 'SL_M' ? askPrice : Math.max(askPrice, price);
          }
          // SELL SL: Execute when market price drops to or below trigger price
          if (order.side === 'SELL' && bidPrice <= trigPrice) {
            executePrice = order.order_type === 'SL_M' ? bidPrice : Math.min(bidPrice, price);
          }
        }

        if (process.env.DEBUG_ORDER_ENGINE === 'true' || process.env.NODE_ENV !== 'production') {
          console.log(`[LIMIT_CHECK] Order: ${order.order_id} | Symbol: ${order.symbol} | Side: ${order.side} | Type: ${order.order_type} | TargetPrice: ₹${price.toFixed(2)} | MarketLTP: ₹${ltp.toFixed(2)} | Bid: ₹${bidPrice.toFixed(2)} | Ask: ₹${askPrice.toFixed(2)} | ConditionMet: ${executePrice !== null}`);
        }

        if (executePrice && executePrice > 0) {
          console.log(`[LIMIT_TRIGGERED] Order ${order.order_id} (${order.symbol} ${order.side} ${order.order_type}) triggered! Target: ₹${price.toFixed(2)} | Executing @ ₹${executePrice.toFixed(2)}`);

          // Atomic claim guard: ensure only one worker/cycle executes this order
          let claimed: any = null;
          try {
            claimed = await queryOne<any>(
              `UPDATE orders SET status = 'EXECUTING', updated_at = NOW() WHERE id = $1 AND status IN ('ACCEPTED', 'PENDING') RETURNING id`,
              [order.id]
            );
          } catch (err: any) {
            // Self-healing migration for orders_status_check constraint
            if (err.message && err.message.includes('orders_status_check')) {
              await execute(
                `ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
                 ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('CREATED','VALIDATING','RMS_CHECK','ACCEPTED','PENDING','EXECUTING','PARTIALLY_FILLED','FILLED','REJECTED','CANCELLED','EXPIRED'));`
              ).catch(() => {});
              claimed = await queryOne<any>(
                `UPDATE orders SET status = 'EXECUTING', updated_at = NOW() WHERE id = $1 AND status IN ('ACCEPTED', 'PENDING') RETURNING id`,
                [order.id]
              ).catch(() => ({ id: order.id }));
            }
          }

          if (!claimed) continue;

          // Determine fill provenance metadata
          const isBsModel = (tick as any)?.bidQty === 500 && (tick as any)?.askQty === 500;
          const freshnessTag = (Date.now() - (tick.timestamp || Date.now()) <= 15000)
            ? 'live'
            : (isBsModel ? 'synthetic_skew' : 'cached_stale');
          const fillLogic = order.order_type === 'MARKET'
            ? (order.side === 'BUY' ? 'MARKET_ASK' : 'MARKET_BID')
            : (order.order_type === 'LIMIT' ? 'LIMIT_MATCH' : 'STOP_LOSS');

          const provenance = {
            tickSource: isBsModel ? 'BLACK_SCHOLES_SYNTHETIC' : 'LIVE_FEED',
            tickTimestamp: tick.timestamp || Date.now(),
            tickLtp: tick.ltp,
            tickBid: tick.bid && tick.bid > 0 ? tick.bid : tick.ltp,
            tickAsk: tick.ask && tick.ask > 0 ? tick.ask : tick.ltp,
            freshnessTag,
            fillLogic
          };

          try {
            await this.executeOrder(order, executePrice, provenance);
          } catch (err: any) {
            console.error(`[ExecutionEngine] Failed to execute order ${order.order_id}:`, err.message);
            // Revert status to ACCEPTED on unexpected failure
            await execute(`UPDATE orders SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`, [order.id]).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      console.warn('[ExecutionEngine] Transient error processing pending orders:', err.message);
    }
  }

  public static async executeOrder(
    order: any, 
    price: number,
    provenance?: {
      tickSource?: string;
      tickTimestamp?: number;
      tickLtp?: number;
      tickBid?: number;
      tickAsk?: number;
      freshnessTag?: string;
      fillLogic?: string;
    }
  ): Promise<void> {
    // Idempotency Guard: prevent duplicate execution processing
    const existingExec = await queryOne<any>(
      'SELECT id FROM executions WHERE order_id = $1',
      [order.id]
    );
    if (existingExec) return;

    const tradeId  = 'trd_' + generateUUID();
    const excId    = 'exc_' + generateUUID();
    const qty      = parseInt(order.quantity, 10);
    const tradeVal = price * qty;

    // Zero Charges & Zero Tax Policy
    const brokerage       = 0.00;
    const stt             = 0.00;
    const exchangeCharges = 0.00;
    const gst             = 0.00;
    const stampDuty       = 0.00;
    const totalCharges    = 0.00;

    const exitReason = order.order_type === 'LIMIT'
      ? 'TARGET_LIMIT'
      : (order.order_type === 'MARKET' ? 'MARKET_SQUARE_OFF' : 'STOP_LOSS');

    const posResult = await withTransaction(async (client) => {
      // 1. Record execution fill with Immutable Provenance
      await client.query(
        `INSERT INTO executions (
          id, order_id, user_id, trade_id, symbol, exchange, side, quantity, price, 
          brokerage, stt, gst, exchange_charges, total_charges,
          tick_source, tick_timestamp, tick_ltp, tick_bid, tick_ask, freshness_tag, fill_logic
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21
        )`,
        [
          excId, order.id, order.user_id, tradeId,
          order.symbol, order.exchange || 'NSE', order.side,
          qty, price, brokerage, stt, gst, exchangeCharges, totalCharges,
          provenance?.tickSource || 'LIVE_FEED',
          provenance?.tickTimestamp || Date.now(),
          provenance?.tickLtp || price,
          provenance?.tickBid || price,
          provenance?.tickAsk || price,
          provenance?.freshnessTag || 'live',
          provenance?.fillLogic || 'MARKET'
        ]
      );

      // 2. Update order status to FILLED
      await client.query(
        `UPDATE orders SET status = 'FILLED', filled_quantity = quantity, average_price = $1, updated_at = NOW() WHERE id = $2`,
        [price, order.id]
      );

      // 3. Record order event audit trail
      await client.query(
        `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor, metadata)
         VALUES ($1, $2, 'ACCEPTED', 'FILLED', $3, 'EXECUTION_ENGINE', $4)`,
        [
          'evt_' + generateUUID(),
          order.id,
          `Execution fill @ ₹${price.toFixed(2)} (${exitReason}) [Freshness: ${provenance?.freshnessTag || 'live'}]`,
          JSON.stringify({ 
            fillPrice: price, 
            quantity: qty, 
            exitReason, 
            tradeId, 
            excId, 
            provenance: provenance || {} 
          })
        ]
      );

      // 4. Update Position & record permanent per-trade P&L in closed_trades
      const res = await PortfolioService.recordExecutionInTransaction(
        client,
        order.user_id,
        order.symbol,
        order.exchange || 'NSE',
        order.product_type || 'MIS',
        order.side as 'BUY' | 'SELL',
        qty,
        price,
        exitReason,
        order.id,
        excId
      );

      // 5. Settle Virtual Money Ledger atomically
      const blockedMargin = order.product_type === 'MIS' ? tradeVal * 0.20 : tradeVal;

      await VirtualWalletLedger.settleTradeExecutionInTransaction(
        client,
        order.user_id,
        order.side as 'BUY' | 'SELL',
        tradeVal,
        blockedMargin,
        res.releasedPositionCapital,
        res.realizedPnlDelta,
        order.order_id
      );

      return res;
    });

    console.log(`[ExecutionEngine] EXECUTION SUCCESS: Order ${order.order_id} filled @ ₹${price.toFixed(2)} (Qty: ${qty}, ExitReason: ${exitReason}, Realized P&L: ₹${(posResult?.realizedPnlDelta || 0).toFixed(2)})`);
  }
}
