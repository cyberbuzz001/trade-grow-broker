import { query, queryOne, execute, withTransaction } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { generateUUID } from '../utils/crypto';

export interface PositionRecord {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  productType: string;
  buyQty: number;
  sellQty: number;
  netQty: number;
  buyPrice: number;
  sellPrice: number;
  averagePrice: number;
  ltp: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface HoldingRecord {
  id: string;
  userId: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
}

export interface RecordExecutionResult {
  realizedPnlDelta: number;
  closedQty: number;
  closedEntryPrice: number;
  releasedPositionCapital: number;
  netQtyAfter: number;
  avgPriceAfter: number;
}

export class PortfolioService {
  /**
   * Update position upon execution of a trade within an active transaction.
   * Handles Long & Short Position averaging, Partial Exits, Short Covering, Position Flips, and Realized/Unrealized P&L calculations.
   */
  public static async recordExecutionInTransaction(
    client: any,
    userId: string,
    symbol: string,
    exchange: string,
    productType: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Promise<RecordExecutionResult> {
    const engine = MarketDataEngine.getInstance();
    const tick = engine.getCachedTick(`NSE_${symbol}`) ||
                 engine.getCachedTick(`NFO_${symbol}`) ||
                 engine.getCachedTick(`BFO_${symbol}`) ||
                 engine.getCachedTick(symbol) ||
                 { ltp: price };
    const ltp = tick.ltp > 0 ? tick.ltp : price;

    const existing = await client.query(
      'SELECT * FROM positions WHERE user_id = $1 AND symbol = $2 AND product_type = $3 FOR UPDATE',
      [userId, symbol, productType]
    );

    let realizedPnlDelta = 0;
    let closedQty = 0;
    let closedEntryPrice = 0;
    let releasedPositionCapital = 0;
    let netQtyAfter = 0;
    let avgPriceAfter = 0;

    if (existing.rows.length === 0) {
      // New Position Initialization
      const buyQty       = side === 'BUY' ? quantity : 0;
      const sellQty      = side === 'SELL' ? quantity : 0;
      const netQty       = buyQty - sellQty;
      const buyPrice     = side === 'BUY' ? price : 0;
      const sellPrice    = side === 'SELL' ? price : 0;
      const averagePrice = price;
      const unrealizedPnl = netQty > 0 ? netQty * (ltp - averagePrice) : Math.abs(netQty) * (averagePrice - ltp);

      await client.query(
        `INSERT INTO positions (id, user_id, symbol, exchange, product_type, buy_qty, sell_qty, net_qty, buy_price, sell_price, average_price, ltp, realized_pnl, unrealized_pnl)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.0, $13)`,
        ['pos_' + generateUUID(), userId, symbol, exchange, productType, buyQty, sellQty, netQty, buyPrice, sellPrice, averagePrice, ltp, unrealizedPnl]
      );

      netQtyAfter = netQty;
      avgPriceAfter = averagePrice;
    } else {
      const row = existing.rows[0];
      let buyQty      = parseInt(row.buy_qty, 10) || 0;
      let sellQty     = parseInt(row.sell_qty, 10) || 0;
      let buyPrice    = parseFloat(row.buy_price) || 0;
      let sellPrice   = parseFloat(row.sell_price) || 0;
      let realizedPnl = parseFloat(row.realized_pnl) || 0;
      const currentNet = buyQty - sellQty;

      if (currentNet > 0) {
        // ── CURRENT POSITION IS LONG (netQty > 0) ─────────────────────────
        if (side === 'BUY') {
          // Adding to Long Position (Weighted Average Entry Price)
          const totalVal = (buyQty * buyPrice) + (quantity * price);
          buyQty += quantity;
          buyPrice = buyQty > 0 ? totalVal / buyQty : 0;
        } else {
          // Selling (Closing Long or Flipping Short)
          closedQty = Math.min(currentNet, quantity);
          closedEntryPrice = buyPrice;
          realizedPnlDelta = closedQty * (price - buyPrice);
          releasedPositionCapital = closedQty * buyPrice;
          realizedPnl += realizedPnlDelta;

          const remainingShortQty = quantity - closedQty;
          if (remainingShortQty > 0) {
            // Flipped to Short
            buyQty = 0;
            buyPrice = 0;
            sellQty = remainingShortQty;
            sellPrice = price;
          } else {
            sellQty += quantity;
          }
        }
      } else if (currentNet < 0) {
        // ── CURRENT POSITION IS SHORT (netQty < 0) ────────────────────────
        const currentShortQty = Math.abs(currentNet);
        if (side === 'SELL') {
          // Adding to Short Position (Weighted Average Entry Price)
          const totalVal = (currentShortQty * sellPrice) + (quantity * price);
          sellQty += quantity;
          sellPrice = sellQty > 0 ? totalVal / sellQty : 0;
        } else {
          // Buying (Covering Short or Flipping Long)
          closedQty = Math.min(currentShortQty, quantity);
          closedEntryPrice = sellPrice;
          realizedPnlDelta = closedQty * (sellPrice - price);
          releasedPositionCapital = closedQty * sellPrice;
          realizedPnl += realizedPnlDelta;

          const remainingLongQty = quantity - closedQty;
          if (remainingLongQty > 0) {
            // Flipped to Long
            sellQty = 0;
            sellPrice = 0;
            buyQty = remainingLongQty;
            buyPrice = price;
          } else {
            buyQty += quantity;
          }
        }
      } else {
        // Position was flat (netQty === 0)
        if (side === 'BUY') {
          buyQty = quantity;
          buyPrice = price;
        } else {
          sellQty = quantity;
          sellPrice = price;
        }
      }

      const netQty = buyQty - sellQty;
      const averagePrice = netQty > 0 ? buyPrice : netQty < 0 ? sellPrice : 0;
      const unrealizedPnl = netQty > 0
        ? netQty * (ltp - averagePrice)
        : netQty < 0
        ? Math.abs(netQty) * (averagePrice - ltp)
        : 0;

      await client.query(
        `UPDATE positions
         SET buy_qty = $1, sell_qty = $2, net_qty = $3, buy_price = $4, sell_price = $5,
             average_price = $6, ltp = $7, realized_pnl = $8, unrealized_pnl = $9, updated_at = NOW()
         WHERE id = $10`,
        [buyQty, sellQty, netQty, buyPrice, sellPrice, averagePrice, ltp, realizedPnl, unrealizedPnl, row.id]
      );

      netQtyAfter = netQty;
      avgPriceAfter = averagePrice;
    }

    // Update delivery holdings if CNC product type
    if (productType === 'CNC') {
      await PortfolioService.updateHoldingsInTransaction(client, userId, symbol, exchange, side, quantity, price, ltp);
    }

    return {
      realizedPnlDelta,
      closedQty,
      closedEntryPrice,
      releasedPositionCapital,
      netQtyAfter,
      avgPriceAfter
    };
  }

  public static async recordExecution(
    userId: string,
    symbol: string,
    exchange: string,
    productType: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Promise<RecordExecutionResult> {
    let result: RecordExecutionResult = {
      realizedPnlDelta: 0,
      closedQty: 0,
      closedEntryPrice: 0,
      releasedPositionCapital: 0,
      netQtyAfter: 0,
      avgPriceAfter: 0
    };

    await withTransaction(async (client) => {
      result = await PortfolioService.recordExecutionInTransaction(
        client, userId, symbol, exchange, productType, side, quantity, price
      );
    });

    return result;
  }

  private static async updateHoldingsInTransaction(
    client: any,
    userId: string,
    symbol: string,
    exchange: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    ltp: number
  ): Promise<void> {
    const existingResult = await client.query(
      'SELECT * FROM holdings WHERE user_id = $1 AND symbol = $2 FOR UPDATE',
      [userId, symbol]
    );
    const existing = existingResult.rows[0];

    if (side === 'BUY') {
      if (!existing) {
        const pnl    = quantity * (ltp - price);
        const pnlPct = price > 0 ? (pnl / (quantity * price)) * 100 : 0;
        await client.query(
          `INSERT INTO holdings (id, user_id, symbol, exchange, quantity, average_price, ltp, current_value, pnl, pnl_percentage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          ['hld_' + generateUUID(), userId, symbol, exchange, quantity, price, ltp, quantity * ltp, pnl, pnlPct]
        );
      } else {
        const newQty       = parseInt(existing.quantity, 10) + quantity;
        const newAvgPrice  = ((parseInt(existing.quantity, 10) * parseFloat(existing.average_price)) + (quantity * price)) / newQty;
        const currentValue = newQty * ltp;
        const pnl          = newQty * (ltp - newAvgPrice);
        const pnlPct       = newAvgPrice > 0 ? (pnl / (newQty * newAvgPrice)) * 100 : 0;
        await client.query(
          `UPDATE holdings SET quantity = $1, average_price = $2, ltp = $3, current_value = $4, pnl = $5, pnl_percentage = $6, updated_at = NOW()
           WHERE id = $7`,
          [newQty, newAvgPrice, ltp, currentValue, pnl, pnlPct, existing.id]
        );
      }
    } else if (side === 'SELL' && existing) {
      const newQty = parseInt(existing.quantity, 10) - quantity;
      if (newQty <= 0) {
        await client.query('DELETE FROM holdings WHERE id = $1', [existing.id]);
      } else {
        const currentValue = newQty * ltp;
        const pnl          = newQty * (ltp - parseFloat(existing.average_price));
        const pnlPct       = parseFloat(existing.average_price) > 0 ? (pnl / (newQty * parseFloat(existing.average_price))) * 100 : 0;
        await client.query(
          `UPDATE holdings SET quantity = $1, ltp = $2, current_value = $3, pnl = $4, pnl_percentage = $5, updated_at = NOW()
           WHERE id = $6`,
          [newQty, ltp, currentValue, pnl, pnlPct, existing.id]
        );
      }
    }
  }

  public static async getUserPositions(userId: string, todayOnly: boolean = true): Promise<PositionRecord[]> {
    let sql = 'SELECT * FROM positions WHERE user_id = $1';
    if (todayOnly) {
      sql += " AND (net_qty != 0 OR updated_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date)";
    }
    sql += ' ORDER BY updated_at DESC';

    const rows = await query<any>(sql, [userId]);
    const engine = MarketDataEngine.getInstance();
    const { GreeksEngine } = require('../marketData/GreeksEngine');

    return rows.map(r => {
      const symbol = r.symbol || '';
      let tick = engine.getCachedTick(`NSE_${symbol}`) ||
                 engine.getCachedTick(`NFO_${symbol}`) ||
                 engine.getCachedTick(`BFO_${symbol}`) ||
                 engine.getCachedTick(symbol);

      if (!tick) {
        const mNifty = symbol.match(/NIFTY\s*(\d+)\s*(CE|PE)/i);
        if (mNifty) {
          tick = engine.getCachedTick(`NFO_NIFTY_${mNifty[1]}_${mNifty[2].toUpperCase()}`);
        }
        const mSensex = symbol.match(/SENSEX\s*(\d+)\s*(CE|PE)/i);
        if (mSensex) {
          tick = engine.getCachedTick(`BFO_SENSEX_${mSensex[1]}_${mSensex[2].toUpperCase()}`);
        }
      }

      let ltp = tick && tick.ltp > 0 ? tick.ltp : parseFloat(r.ltp || r.average_price || 0);

      // Fallback: If option position and no direct tick, compute live BS price anchored to live spot tick
      if ((!tick || tick.ltp <= 0) && ltp <= 0) {
        const mNifty = symbol.match(/NIFTY\s*(\d+)\s*(CE|PE)/i);
        if (mNifty) {
          const strike = parseFloat(mNifty[1]);
          const isCall = mNifty[2].toUpperCase() === 'CE';
          const spotTick = engine.getCachedTick('NSE_NIFTY50');
          if (spotTick && spotTick.ltp > 0) {
            const timeToExpiryYears = 1.0 / 365.0;
            const bsPrice = GreeksEngine.calculateOptionPrice(spotTick.ltp, strike, timeToExpiryYears, isCall, 0.14);
            ltp = Number(bsPrice.toFixed(2));
          }
        }
      }

      const netQty = parseInt(r.net_qty, 10);
      const averagePrice = parseFloat(r.average_price);

      const unrealizedPnl = netQty > 0
        ? netQty * (ltp - averagePrice)
        : netQty < 0
        ? Math.abs(netQty) * (averagePrice - ltp)
        : 0;

      return {
        id: r.id,
        userId: r.user_id,
        symbol: r.symbol,
        exchange: r.exchange,
        productType: r.product_type,
        buyQty: parseInt(r.buy_qty, 10),
        sellQty: parseInt(r.sell_qty, 10),
        netQty,
        buyPrice: parseFloat(r.buy_price),
        sellPrice: parseFloat(r.sell_price),
        averagePrice,
        ltp,
        realizedPnl: parseFloat(r.realized_pnl || 0),
        unrealizedPnl
      };
    });
  }

  public static async clearOldPositions(userId: string): Promise<void> {
    await query(
      `DELETE FROM positions WHERE user_id = $1 AND (net_qty = 0 OR updated_at < (NOW() AT TIME ZONE 'Asia/Kolkata')::date)`,
      [userId]
    );
  }

  public static async getUserHoldings(userId: string): Promise<HoldingRecord[]> {
    const rows = await query<any>('SELECT * FROM holdings WHERE user_id = $1 ORDER BY symbol', [userId]);
    const engine = MarketDataEngine.getInstance();

    return rows.map(r => {
      const tick = engine.getCachedTick(`NSE_${r.symbol}`) || engine.getCachedTick(r.symbol);
      const ltp = tick ? tick.ltp : parseFloat(r.ltp);
      const quantity = parseInt(r.quantity, 10);
      const avgPrice = parseFloat(r.average_price);
      const currentValue = quantity * ltp;
      const pnl = quantity * (ltp - avgPrice);
      const pnlPercentage = avgPrice > 0 ? (pnl / (quantity * avgPrice)) * 100 : 0;

      return {
        id: r.id,
        userId: r.user_id,
        symbol: r.symbol,
        exchange: r.exchange,
        quantity,
        averagePrice: avgPrice,
        ltp,
        currentValue,
        pnl,
        pnlPercentage
      };
    });
  }
}
