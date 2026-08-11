import { query, queryOne, execute, withTransaction } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { MarketTick } from '../marketData/types';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { PortfolioService } from './PortfolioService';
import { generateUUID } from '../utils/crypto';

export class ExecutionEngine {
  private static timer: NodeJS.Timeout | null = null;

  public static start(): void {
    console.log('[ExecutionEngine] Starting simulated order matching loop (500ms cycle)...');
    this.timer = setInterval(() => this.processPendingOrders(), 500);
  }

  public static stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  public static async processPendingOrders(): Promise<void> {
    try {
      const pendingOrders = await query<any>(
        `SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING') LIMIT 50`
      );

    const { SymbologyNormalizer } = require('../marketData/SymbologyNormalizer');

    for (const order of pendingOrders) {
      const engine = MarketDataEngine.getInstance();
      let tick: MarketTick | undefined | null = engine.getCachedTick(order.instrument_token) || engine.getCachedTick(order.symbol);

      if (!tick && order.symbol) {
        const aliases = SymbologyNormalizer.normalizeToken(order.symbol);
        for (const alias of aliases) {
          tick = engine.getCachedTick(alias);
          if (tick) break;
        }
      }

      if (!tick && order.instrument_token) {
        const aliases = SymbologyNormalizer.normalizeToken(order.instrument_token);
        for (const alias of aliases) {
          tick = engine.getCachedTick(alias);
          if (tick) break;
        }
      }

      if (!tick) {
        try {
          tick = await engine.getQuote(order.instrument_token) || await engine.getQuote(order.symbol);
        } catch (_) {}
      }

      // Check for stale ticks (> 30 seconds old)
      const STALENESS_THRESHOLD_MS = 30000;
      const isStale = tick ? (Date.now() - tick.timestamp > STALENESS_THRESHOLD_MS) : true;

      // Dynamic fallback for options & stocks when tick is missing/stale in paper trading mode
      const isOption = (order.symbol || '').includes('CE') || (order.symbol || '').includes('PE');

      if (!tick || isStale) {
        const orderPrice = parseFloat(order.price || '0');
        const estPrice = orderPrice > 0 ? orderPrice : (isOption ? 150.0 : 2500.0);
        tick = {
          instrumentToken: order.instrument_token || order.symbol,
          exchange: order.exchange || 'NSE',
          symbol: order.symbol,
          ltp: estPrice,
          open: estPrice,
          high: estPrice,
          low: estPrice,
          close: estPrice,
          volume: 1000,
          change: 0,
          changePercent: 0,
          bid: Number((estPrice * 0.995).toFixed(2)),
          ask: Number((estPrice * 1.005).toFixed(2)),
          bidQty: 100,
          askQty: 100,
          timestamp: Date.now()
        };
      }

      if (!tick) continue;

      const price     = parseFloat(order.price);
      const trigPrice = parseFloat(order.trigger_price || '0');
      const ltp       = tick.ltp;
      let executePrice: number | null = null;

      if (order.order_type === 'MARKET') {
        executePrice = order.side === 'BUY' ? (tick.ask || ltp) : (tick.bid || ltp);
      } else if (order.order_type === 'LIMIT') {
        if (order.side === 'BUY'  && ltp <= price) executePrice = price;
        if (order.side === 'SELL' && ltp >= price) executePrice = price;
      } else if (order.order_type === 'SL' || order.order_type === 'SL_M') {
        if (order.side === 'BUY'  && ltp >= trigPrice) executePrice = order.order_type === 'SL_M' ? ltp : price;
        if (order.side === 'SELL' && ltp <= trigPrice) executePrice = order.order_type === 'SL_M' ? ltp : price;
      }

      if (executePrice && executePrice > 0) {
        try {
          await this.executeOrder(order, executePrice);
        } catch (err: any) {
          console.error(`[ExecutionEngine] Failed to execute order ${order.order_id}:`, err.message);
        }
      }
    }
    } catch (err: any) {
      console.warn('[ExecutionEngine] Transient error processing pending orders:', err.message);
    }
  }

  public static async executeOrder(order: any, price: number): Promise<void> {
    const tradeId  = 'trd_' + generateUUID();
    const qty      = parseInt(order.quantity, 10);
    const tradeVal = price * qty;

    // ================================================
    // ZERO BROKERAGE & ZERO TAX POLICY
    // ================================================
    const brokerage = 0.00;
    const isZeroTax = process.env.ZERO_TAX === 'true';

    // Statutory Charges Breakdown
    const isOption = order.symbol.endsWith('CE') || order.symbol.endsWith('PE');
    const stt             = (!isZeroTax && order.side === 'SELL' && isOption) ? Number((tradeVal * 0.00125).toFixed(2)) : 0;
    const exchangeCharges = !isZeroTax ? Number((tradeVal * 0.0005).toFixed(2)) : 0; // Exchange turnover fee
    const gst             = !isZeroTax ? Number((exchangeCharges * 0.18).toFixed(2)) : 0; // 18% GST on exchange fee
    const stampDuty       = (!isZeroTax && order.side === 'BUY') ? Number((tradeVal * 0.00003).toFixed(2)) : 0;
    const totalCharges    = Number((brokerage + stt + gst + exchangeCharges + stampDuty).toFixed(2));

    await withTransaction(async (client) => {
      // 1. Record execution
      await client.query(
        `INSERT INTO executions (id, order_id, user_id, trade_id, symbol, exchange, side, quantity, price, brokerage, stt, gst, exchange_charges, total_charges)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          'exc_' + generateUUID(), order.id, order.user_id, tradeId,
          order.symbol, order.exchange || 'NSE', order.side,
          qty, price, brokerage, stt, gst, exchangeCharges, totalCharges
        ]
      );

      // 2. Update order status
      await client.query(
        `UPDATE orders SET status = 'FILLED', filled_quantity = quantity, average_price = $1, updated_at = NOW() WHERE id = $2`,
        [price, order.id]
      );

      // 3. Record order event
      await client.query(
        `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
         VALUES ($1, $2, 'ACCEPTED', 'FILLED', $3, 'EXECUTION_ENGINE')`,
        ['evt_' + generateUUID(), order.id, `Simulated fill @ ₹${price}`]
      );
    });

    // 4. Record execution in Position Ledger
    await PortfolioService.recordExecution(
      order.user_id,
      order.symbol,
      order.exchange || 'NSE',
      order.product_type || 'MIS',
      order.side as 'BUY' | 'SELL',
      qty,
      price
    );

    // 4. Settle virtual money ledger (zero brokerage applied)
    const marginReleased = tradeVal;

    await VirtualWalletLedger.settleTradeExecution(
      order.user_id, order.side as 'BUY' | 'SELL',
      tradeVal, marginReleased, totalCharges, 0, order.order_id
    );

    console.log(`[ExecutionEngine] SIMULATED EXECUTION SUCCESS: Order ${order.order_id} filled @ ₹${price} (Qty: ${qty}, Brokerage: ₹0.00, Statutory Charges: ₹${totalCharges})`);
  }
}
