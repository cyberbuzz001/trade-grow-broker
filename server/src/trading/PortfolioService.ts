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

export class PortfolioService {
  /**
   * Update position upon execution of a trade. Async + PostgreSQL.
   */
  public static async recordExecution(
    userId: string,
    symbol: string,
    exchange: string,
    productType: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number
  ): Promise<void> {
    const tick = MarketDataEngine.getInstance().getCachedTick(`NSE_${symbol}`) ||
                 MarketDataEngine.getInstance().getCachedTick(`NFO_${symbol}`) ||
                 { ltp: price };
    const ltp = tick.ltp;

    await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT * FROM positions WHERE user_id = $1 AND symbol = $2 AND product_type = $3 FOR UPDATE',
        [userId, symbol, productType]
      );

      if (existing.rows.length === 0) {
        // New position
        const buyQty    = side === 'BUY' ? quantity : 0;
        const sellQty   = side === 'SELL' ? quantity : 0;
        const netQty    = buyQty - sellQty;
        const buyPrice  = side === 'BUY' ? price : 0;
        const sellPrice = side === 'SELL' ? price : 0;

        await client.query(
          `INSERT INTO positions (id, user_id, symbol, exchange, product_type, buy_qty, sell_qty, net_qty, buy_price, sell_price, average_price, ltp, realized_pnl, unrealized_pnl)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0.0, 0.0)`,
          ['pos_' + generateUUID(), userId, symbol, exchange, productType, buyQty, sellQty, netQty, buyPrice, sellPrice, price, ltp]
        );
      } else {
        const row = existing.rows[0];
        let buyQty    = parseInt(row.buy_qty);
        let sellQty   = parseInt(row.sell_qty);
        let buyPrice  = parseFloat(row.buy_price);
        let sellPrice = parseFloat(row.sell_price);

        if (side === 'BUY') {
          const totalBuyVal = (buyQty * buyPrice) + (quantity * price);
          buyQty  += quantity;
          buyPrice = buyQty > 0 ? totalBuyVal / buyQty : 0;
        } else {
          const totalSellVal = (sellQty * sellPrice) + (quantity * price);
          sellQty  += quantity;
          sellPrice = sellQty > 0 ? totalSellVal / sellQty : 0;
        }

        const netQty      = buyQty - sellQty;
        const averagePrice = buyQty > 0 ? buyPrice : sellPrice;

        let realizedPnl = parseFloat(row.realized_pnl);
        if (side === 'SELL' && parseInt(row.buy_qty) > 0) {
          const closedQty = Math.min(parseInt(row.buy_qty), quantity);
          realizedPnl += (price - parseFloat(row.buy_price)) * closedQty;
        }

        const unrealizedPnl = netQty * (ltp - averagePrice);

        if (netQty === 0) {
          await client.query('DELETE FROM positions WHERE id = $1', [row.id]);
        } else {
          await client.query(
            `UPDATE positions
             SET buy_qty = $1, sell_qty = $2, net_qty = $3, buy_price = $4, sell_price = $5,
                 average_price = $6, ltp = $7, realized_pnl = $8, unrealized_pnl = $9, updated_at = NOW()
             WHERE id = $10`,
            [buyQty, sellQty, netQty, buyPrice, sellPrice, averagePrice, ltp, realizedPnl, unrealizedPnl, row.id]
          );
        }
      }

      // Update delivery holdings if CNC product type
      if (productType === 'CNC') {
        await PortfolioService.updateHoldingsInTransaction(client, userId, symbol, exchange, side, quantity, price, ltp);
      }
    });
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
        const newQty       = parseInt(existing.quantity) + quantity;
        const newAvgPrice  = ((parseInt(existing.quantity) * parseFloat(existing.average_price)) + (quantity * price)) / newQty;
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
      const newQty = parseInt(existing.quantity) - quantity;
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

  public static async getUserPositions(userId: string): Promise<PositionRecord[]> {
    const rows = await query<any>('SELECT * FROM positions WHERE user_id = $1 AND net_qty != 0 ORDER BY updated_at DESC', [userId]);
    return rows.map(r => {
      const tick = MarketDataEngine.getInstance().getCachedTick(`NSE_${r.symbol}`) ||
                   MarketDataEngine.getInstance().getCachedTick(`NFO_${r.symbol}`);
      const ltp = tick ? tick.ltp : parseFloat(r.ltp);
      const netQty = parseInt(r.net_qty);
      const averagePrice = parseFloat(r.average_price);
      const unrealizedPnl = netQty * (ltp - averagePrice);

      return {
        id: r.id, userId: r.user_id, symbol: r.symbol, exchange: r.exchange, productType: r.product_type,
        buyQty: parseInt(r.buy_qty), sellQty: parseInt(r.sell_qty), netQty,
        buyPrice: parseFloat(r.buy_price), sellPrice: parseFloat(r.sell_price),
        averagePrice, ltp, realizedPnl: parseFloat(r.realized_pnl), unrealizedPnl
      };
    });
  }

  public static async getUserHoldings(userId: string): Promise<HoldingRecord[]> {
    const rows = await query<any>('SELECT * FROM holdings WHERE user_id = $1 ORDER BY symbol', [userId]);
    return rows.map(r => {
      const tick = MarketDataEngine.getInstance().getCachedTick(`NSE_${r.symbol}`);
      const ltp = tick ? tick.ltp : parseFloat(r.ltp);
      const quantity = parseInt(r.quantity);
      const avgPrice = parseFloat(r.average_price);
      const currentValue = quantity * ltp;
      const pnl = quantity * (ltp - avgPrice);
      const pnlPercentage = avgPrice > 0 ? (pnl / (quantity * avgPrice)) * 100 : 0;

      return {
        id: r.id, userId: r.user_id, symbol: r.symbol, exchange: r.exchange,
        quantity, averagePrice: avgPrice, ltp, currentValue, pnl, pnlPercentage
      };
    });
  }
}
