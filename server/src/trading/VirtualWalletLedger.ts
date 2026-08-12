import { pool, query, queryOne, execute, withTransaction } from '../db/schema';
import { generateUUID } from '../utils/crypto';
import { PortfolioService } from './PortfolioService';

export interface WalletState {
  userId: string;
  cashBalance: number;
  usedMargin: number;
  realizedPnl: number;
  unrealizedPnl: number;
  buyingPower: number;
  totalPnl: number;
  accountEquity: number;
}

export class VirtualWalletLedger {

  /**
   * Get current wallet state for a user with live Unrealized P&L, Total P&L & Account Equity.
   */
  public static async getWallet(userId: string): Promise<WalletState | null> {
    const row = await queryOne<any>(
      'SELECT * FROM virtual_wallets WHERE user_id = $1',
      [userId]
    );
    if (!row) return null;

    const cashBalance   = parseFloat(row.cash_balance);
    const usedMargin    = parseFloat(row.used_margin);
    const realizedPnl   = parseFloat(row.realized_pnl);

    // Calculate dynamic live unrealized P&L from active open positions
    let unrealizedPnl = 0;
    try {
      const openPositions = await PortfolioService.getUserPositions(userId, false);
      for (const pos of openPositions) {
        if (pos.netQty !== 0) {
          unrealizedPnl += pos.unrealizedPnl;
        }
      }
    } catch (_) {}

    const buyingPower   = Math.max(0, cashBalance - usedMargin);
    const totalPnl      = realizedPnl + unrealizedPnl;
    const accountEquity = cashBalance + unrealizedPnl;

    return {
      userId,
      cashBalance,
      usedMargin,
      realizedPnl,
      unrealizedPnl,
      buyingPower,
      totalPnl,
      accountEquity
    };
  }

  /**
   * Block virtual margin for a pending order using SELECT ... FOR UPDATE.
   */
  public static async blockMargin(
    userId: string,
    amount: number,
    referenceId: string,
    createdBy: string = 'OMS'
  ): Promise<boolean> {
    if (amount <= 0) return true;

    try {
      await withTransaction(async (client) => {
        const walletRow = await client.query(
          'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (walletRow.rows.length === 0) throw new Error('Wallet not found');

        const wallet = walletRow.rows[0];
        const cashBalance = parseFloat(wallet.cash_balance);
        const usedMargin  = parseFloat(wallet.used_margin);
        const buyingPower = Math.max(0, cashBalance - usedMargin);

        if (buyingPower < amount) {
          throw new Error(`Insufficient buying power. Required: ₹${amount.toFixed(2)}, Available: ₹${buyingPower.toFixed(2)}`);
        }

        const newUsedMargin = usedMargin + amount;

        await client.query(
          'UPDATE virtual_wallets SET used_margin = $1, updated_at = NOW() WHERE user_id = $2',
          [newUsedMargin, userId]
        );

        await client.query(
          `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
           VALUES ($1, $2, $3, 'MARGIN_BLOCK', $4, $5, $6, $7, $8, $9)`,
          [
            'led_' + generateUUID(), generateUUID(), userId,
            amount, cashBalance, cashBalance - newUsedMargin,
            referenceId, createdBy,
            JSON.stringify({ reason: 'Pre-Trade Virtual Margin Block' })
          ]
        );
      });

      return true;
    } catch (err: any) {
      console.error('[VirtualWalletLedger] blockMargin failed:', err.message);
      return false;
    }
  }

  /**
   * Release blocked margin for a cancelled or rejected order.
   */
  public static async releaseMargin(
    userId: string,
    amount: number,
    referenceId: string,
    createdBy: string = 'OMS'
  ): Promise<void> {
    if (amount <= 0) return;

    await withTransaction(async (client) => {
      const walletRow = await client.query(
        'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletRow.rows.length === 0) return;

      const wallet = walletRow.rows[0];
      const cashBalance = parseFloat(wallet.cash_balance);
      const usedMargin  = parseFloat(wallet.used_margin);
      const releaseAmt  = Math.min(usedMargin, amount);
      const newUsedMargin = Math.max(0, usedMargin - releaseAmt);

      await client.query(
        'UPDATE virtual_wallets SET used_margin = $1, updated_at = NOW() WHERE user_id = $2',
        [newUsedMargin, userId]
      );

      await client.query(
        `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
         VALUES ($1, $2, $3, 'MARGIN_RELEASE', $4, $5, $6, $7, $8, $9)`,
        [
          'led_' + generateUUID(), generateUUID(), userId,
          releaseAmt, cashBalance, cashBalance - newUsedMargin,
          referenceId, createdBy,
          JSON.stringify({ reason: 'Virtual Margin Release' })
        ]
      );
    });
  }

  /**
   * Settle trade execution atomically within an active database transaction.
   * Realized P&L flows directly into cash balance & realized_pnl with zero charges.
   */
  public static async settleTradeExecutionInTransaction(
    client: any,
    userId: string,
    tradeType: 'BUY' | 'SELL',
    tradeAmount: number,
    blockedMargin: number,
    releasedPositionCapital: number,
    realizedPnlDelta: number,
    referenceId: string
  ): Promise<void> {
    const walletRow = await client.query(
      'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (walletRow.rows.length === 0) return;

    const wallet = walletRow.rows[0];
    const cashBalance = parseFloat(wallet.cash_balance);
    const realizedPnl = parseFloat(wallet.realized_pnl);

    // 1. Realized P&L increases or decreases cash balance directly
    const newCash = cashBalance + realizedPnlDelta;
    const newRealizedPnl = realizedPnl + realizedPnlDelta;

    // 2. Recalculate used margin based on remaining active open positions
    const posRows = await client.query(
      'SELECT net_qty, average_price FROM positions WHERE user_id = $1 AND net_qty != 0',
      [userId]
    );
    let newUsedMargin = 0;
    for (const p of posRows.rows) {
      newUsedMargin += Math.abs(parseInt(p.net_qty, 10)) * parseFloat(p.average_price);
    }

    await client.query(
      `UPDATE virtual_wallets SET cash_balance = $1, used_margin = $2, realized_pnl = $3, updated_at = NOW()
       WHERE user_id = $4`,
      [newCash, newUsedMargin, newRealizedPnl, userId]
    );

    await client.query(
      `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
       VALUES ($1, $2, $3, 'PNL_SETTLEMENT', $4, $5, $6, $7, 'SIMULATED_EXECUTION', $8)`,
      [
        'led_' + generateUUID(), generateUUID(), userId,
        tradeAmount, cashBalance, newCash, referenceId,
        JSON.stringify({ tradeType, realizedPnlDelta, releasedPositionCapital, newCash, newUsedMargin })
      ]
    );
  }

  /**
   * Admin balance adjustment (Add or Remove virtual capital).
   */
  public static async adminAdjustBalance(
    userId: string,
    amount: number,
    adminUserId: string,
    reason: string
  ): Promise<WalletState | null> {
    await withTransaction(async (client) => {
      const walletRow = await client.query(
        'SELECT * FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (walletRow.rows.length === 0) throw new Error('Wallet not found');

      const wallet = walletRow.rows[0];
      const cashBalance = parseFloat(wallet.cash_balance);
      const newCash = cashBalance + amount;

      if (newCash < 0) throw new Error('Admin adjustment would result in negative balance');

      await client.query(
        'UPDATE virtual_wallets SET cash_balance = $1, updated_at = NOW() WHERE user_id = $2',
        [newCash, userId]
      );

      await client.query(
        `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
         VALUES ($1, $2, $3, 'ADMIN_ADJUSTMENT', $4, $5, $6, $7, $8, $9)`,
        [
          'led_' + generateUUID(), generateUUID(), userId,
          Math.abs(amount), cashBalance, newCash,
          adminUserId, adminUserId,
          JSON.stringify({ reason, adjustmentType: amount >= 0 ? 'CREDIT' : 'DEBIT' })
        ]
      );
    });

    return this.getWallet(userId);
  }
}
