import { query, queryOne, execute, withTransaction } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
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
    const pendingOrders = await query<any>(
      `SELECT * FROM orders WHERE status IN ('ACCEPTED', 'PENDING') LIMIT 50`
    );

    for (const order of pendingOrders) {
      const tick = MarketDataEngine.getInstance().getCachedTick(order.instrument_token);
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

    // 4. Settle virtual money ledger (zero brokerage applied)
    const marginReleased = tradeVal;

    await VirtualWalletLedger.settleTradeExecution(
      order.user_id, order.side as 'BUY' | 'SELL',
      tradeVal, marginReleased, totalCharges, 0, order.order_id
    );

    // 5. Update portfolio positions & holdings
    await PortfolioService.recordExecution(
      order.user_id, order.symbol, order.exchange || 'NSE', order.product_type,
      order.side as 'BUY' | 'SELL', qty, price
    );

    console.log(`[ExecutionEngine] SIMULATED EXECUTION SUCCESS: Order ${order.order_id} filled @ ₹${price} (Qty: ${qty}, Brokerage: ₹0.00, Statutory Charges: ₹${totalCharges})`);
  }
}
