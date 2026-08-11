import { Router, Request, Response } from 'express';
import { authenticateToken, checkRole, AuthenticatedRequest } from '../middleware/auth';
import { query, queryOne, execute } from '../db/schema';
import { logAuditAction } from '../middleware/audit';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { MarketDataStorageService } from '../services/MarketDataStorageService';
import { checkDatabaseHealth } from '../db/pool';
import { redis } from '../db/redis';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { updateDhanToken, getTokenExpiryMinutes, setDhanAdapterRef } from '../utils/dhanTokenRefresh';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  return req.ip ?? '127.0.0.1';
}

const router = Router();
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'RISK_MANAGER', 'COMPLIANCE_OFFICER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'SUPPORT_AGENT', 'READ_ONLY_AUDITOR'];

// ============================================================
// 1. EXECUTIVE DASHBOARD
// ============================================================
router.get('/dashboard/executive', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalUsersRow, activeUsersRow, newUsersRow,
      kycPendingRow, kycRejectedRow, suspendedRow,
      ordersRow, tradesRow, turnoverRow,
      buyValueRow, sellValueRow, activeTradersRow,
      totalFundsRow, marginRow, brokerageRow, pendingWithdrawalsRow,
      highRiskRow, marginAlertsRow, rmsBlocksRow, frozenRow
    ] = await Promise.all([
      queryOne<any>('SELECT COUNT(*) as c FROM users'),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE status = 'ACTIVE'"),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE created_at > NOW() - INTERVAL '30 days'"),
      queryOne<any>("SELECT COUNT(*) as c FROM kyc_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW')"),
      queryOne<any>("SELECT COUNT(*) as c FROM kyc_applications WHERE status = 'REJECTED'"),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE status = 'SUSPENDED'"),
      queryOne<any>("SELECT COUNT(*) as c FROM orders WHERE created_at > NOW() - INTERVAL '1 day'"),
      queryOne<any>("SELECT COUNT(*) as c FROM executions WHERE executed_at > NOW() - INTERVAL '1 day'"),
      queryOne<any>('SELECT COUNT(*) as c FROM executions'),
      queryOne<any>('SELECT COALESCE(SUM(quantity * price), 0) as s FROM executions'),
      queryOne<any>("SELECT COALESCE(SUM(quantity * price), 0) as s FROM executions WHERE side = 'BUY'"),
      queryOne<any>("SELECT COALESCE(SUM(quantity * price), 0) as s FROM executions WHERE side = 'SELL'"),
      queryOne<any>("SELECT COUNT(DISTINCT user_id) as c FROM orders WHERE created_at > NOW() - INTERVAL '1 day'"),
      queryOne<any>('SELECT COALESCE(SUM(cash_balance), 0) as s FROM virtual_wallets'),
      queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets'),
      queryOne<any>("SELECT COALESCE(SUM(amount), 0) as s FROM wallet_ledger WHERE transaction_type = 'BROKERAGE'"),
      queryOne<any>("SELECT COUNT(*) as c FROM wallet_ledger WHERE transaction_type = 'WITHDRAWAL' AND metadata->>'status' = 'PENDING'"),
      queryOne<any>("SELECT COUNT(*) as c FROM risk_events WHERE severity = 'HIGH' AND resolved = FALSE"),
      queryOne<any>("SELECT COUNT(*) as c FROM risk_events WHERE event_type = 'MARGIN_ALERT' AND resolved = FALSE"),
      queryOne<any>("SELECT COUNT(*) as c FROM risk_events WHERE event_type = 'RMS_BLOCK' AND resolved = FALSE"),
      queryOne<any>("SELECT COUNT(*) as c FROM users WHERE status = 'FROZEN'"),
    ]);

    const dbHealth = await checkDatabaseHealth();
    const mdProvider = MarketDataEngine.getInstance().getActiveProviderName();

    res.json({
      success: true,
      kpis: {
        customers: {
          total: parseInt(totalUsersRow?.c || '0'),
          active: parseInt(activeUsersRow?.c || '0'),
          new: parseInt(newUsersRow?.c || '0'),
          kycPending: parseInt(kycPendingRow?.c || '0'),
          kycRejected: parseInt(kycRejectedRow?.c || '0'),
          suspended: parseInt(suspendedRow?.c || '0')
        },
        trading: {
          ordersToday: parseInt(ordersRow?.c || '0'),
          tradesToday: parseInt(tradesRow?.c || '0'),
          turnover: parseFloat(turnoverRow?.s || '0'),
          buyValue: parseFloat(buyValueRow?.s || '0'),
          sellValue: parseFloat(sellValueRow?.s || '0'),
          activeTraders: parseInt(activeTradersRow?.c || '0')
        },
        financial: {
          totalFunds: parseFloat(totalFundsRow?.s || '0'),
          marginUtilized: parseFloat(marginRow?.s || '0'),
          brokerage: parseFloat(brokerageRow?.s || '0'),
          pendingWithdrawals: parseInt(pendingWithdrawalsRow?.c || '0')
        },
        risk: {
          highRiskClients: parseInt(highRiskRow?.c || '0'),
          marginAlerts: parseInt(marginAlertsRow?.c || '0'),
          rmsBlocks: parseInt(rmsBlocksRow?.c || '0'),
          frozenAccounts: parseInt(frozenRow?.c || '0')
        },
        technology: {
          apiStatus: 'OPERATIONAL',
          wsStatus: 'OPERATIONAL',
          brokerStatus: mdProvider !== 'MOCK' ? 'CONNECTED' : 'DISCONNECTED',
          marketDataStatus: mdProvider !== 'MOCK' ? 'LIVE' : 'MOCK',
          omsStatus: 'OPERATIONAL',
          rmsStatus: 'OPERATIONAL',
          databaseHealth: dbHealth.healthy ? 'HEALTHY' : 'DEGRADED',
          databaseLatencyMs: dbHealth.latencyMs
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 2. CUSTOMER MANAGEMENT
// ============================================================
router.get('/customers', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const search = req.query.search as string || '';
  const status = req.query.status as string || '';
  const role = req.query.role as string || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (search) {
    where += ` AND (u.username ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.id ILIKE $${paramIdx})`;
    params.push(`%${search}%`);
    paramIdx++;
  }
  if (status) {
    where += ` AND u.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }
  if (role) {
    where += ` AND u.role = $${paramIdx}`;
    params.push(role);
    paramIdx++;
  }

  const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM users u ${where}`, params);
  const users = await query(
    `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at, u.failed_login_attempts,
            w.cash_balance, w.used_margin,
            (SELECT kyc_status FROM kyc_records WHERE customer_id = u.id ORDER BY created_at DESC LIMIT 1) as kyc_status
     FROM users u
     LEFT JOIN virtual_wallets w ON u.id = w.user_id
     ${where}
     ORDER BY u.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );

  res.json({ success: true, customers: users, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
});

router.get('/customers/:id', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const customerId = req.params.id;
  const [user, wallet, kycRecords, orders, trades, positions, holdings, ledger, auditLogs] = await Promise.all([
    queryOne<any>('SELECT id, username, email, role, status, created_at, last_login_at, failed_login_attempts FROM users WHERE id = $1', [customerId]),
    queryOne<any>('SELECT * FROM virtual_wallets WHERE user_id = $1', [customerId]),
    query('SELECT * FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]),
    query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId]),
    query('SELECT * FROM executions WHERE user_id = $1 ORDER BY executed_at DESC LIMIT 50', [customerId]),
    query('SELECT * FROM positions WHERE user_id = $1', [customerId]),
    query('SELECT * FROM holdings WHERE user_id = $1', [customerId]),
    query('SELECT * FROM wallet_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [customerId]),
    query('SELECT * FROM audit_logs WHERE actor_id = $1 OR resource_id = $1 ORDER BY timestamp DESC LIMIT 50', [customerId])
  ]);

  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }

  res.json({ success: true, customer: { profile: user, wallet, kycRecords, orders, trades, positions, holdings, ledger, auditLogs } });
});

router.post('/customers/:id/freeze', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const targetId = req.params.id as string;
  await execute("UPDATE users SET status = 'FROZEN', updated_at = NOW() WHERE id = $1", [targetId]);
  await logAuditAction(req.user!.userId, req.user!.role, 'FREEZE_ACCOUNT', 'USER', targetId, null, { reason }, getClientIp(req));
  res.json({ success: true, message: 'Account frozen' });
});

router.post('/customers/:id/unfreeze', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const targetId = req.params.id as string;
  await execute("UPDATE users SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1", [targetId]);
  await logAuditAction(req.user!.userId, req.user!.role, 'UNFREEZE_ACCOUNT', 'USER', targetId, null, { reason }, getClientIp(req));
  res.json({ success: true, message: 'Account unfrozen' });
});

// ============================================================
// 3. KYC MANAGEMENT
// ============================================================
router.get('/kyc/queue', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'KYC_OFFICER', 'COMPLIANCE_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string || '';
  let where = '';
  const params: any[] = [];
  if (status) { where = 'WHERE k.kyc_status = $1'; params.push(status); }

  const records = await query(
    `SELECT k.*, u.username, u.email FROM kyc_records k
     JOIN users u ON k.customer_id = u.id
     ${where}
     ORDER BY k.created_at DESC LIMIT 200`,
    params
  );
  res.json({ success: true, records });
});

router.post('/kyc/:id/approve', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  const { notes } = req.body;
  const kycId = req.params.id as string;
  await execute(
    "UPDATE kyc_records SET kyc_status = 'APPROVED', verification_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3",
    [req.user!.userId, notes || '', kycId]
  );
  await logAuditAction(req.user!.userId, req.user!.role, 'APPROVE_KYC', 'KYC', kycId, null, { notes }, getClientIp(req));
  res.json({ success: true, message: 'KYC approved' });
});

router.post('/kyc/:id/reject', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const kycId = req.params.id as string;
  await execute(
    "UPDATE kyc_records SET kyc_status = 'REJECTED', verification_status = 'FAILED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3",
    [req.user!.userId, reason || '', kycId]
  );
  await logAuditAction(req.user!.userId, req.user!.role, 'REJECT_KYC', 'KYC', kycId, null, { reason }, getClientIp(req));
  res.json({ success: true, message: 'KYC rejected' });
});

// ============================================================
// 4. ORDER MONITOR
// ============================================================
router.get('/orders/monitor', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
  const status = req.query.status as string || '';
  const exchange = req.query.exchange as string || '';
  const side = req.query.side as string || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (status) { where += ` AND o.status = $${paramIdx}`; params.push(status); paramIdx++; }
  if (exchange) { where += ` AND o.exchange = $${paramIdx}`; params.push(exchange); paramIdx++; }
  if (side) { where += ` AND o.side = $${paramIdx}`; params.push(side); paramIdx++; }

  const orders = await query(
    `SELECT o.*, u.username as client_name
     FROM orders o
     JOIN users u ON o.user_id = u.id
     ${where}
     ORDER BY o.created_at DESC LIMIT $${paramIdx}`,
    [...params, limit]
  );
  res.json({ success: true, orders });
});

router.get('/orders/:id/events', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const orderId = req.params.id as string;
  const events = await query(
    'SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );
  // If no order_events table exists yet, return the order itself as a single event
  if (!events || events.length === 0) {
    const order = await queryOne<any>('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    res.json({ success: true, events: order ? [{ event_type: order.status, created_at: order.created_at, payload: order }] : [] });
    return;
  }
  res.json({ success: true, events });
});

router.post('/orders/:id/cancel', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  const { reason } = req.body;
  const orderId = req.params.id as string;
  await execute("UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1 AND status IN ('ACCEPTED','PENDING')", [orderId]);
  await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_CANCEL_ORDER', 'ORDER', orderId, null, { reason }, getClientIp(req));
  res.json({ success: true, message: 'Order cancelled by admin' });
});

// ============================================================
// 5. RISK COMMAND CENTER
// ============================================================
router.get('/risk/dashboard', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  const [totalExposure, marginUsed, highRisk, marginAlerts, frozenAccounts, rmsBlocks] = await Promise.all([
    queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets'),
    queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets WHERE used_margin > 0'),
    query("SELECT u.id, u.username, u.email, w.cash_balance, w.used_margin FROM users u JOIN virtual_wallets w ON u.id = w.user_id WHERE w.used_margin > w.cash_balance * 0.8 LIMIT 20"),
    query("SELECT * FROM risk_events WHERE event_type = 'MARGIN_ALERT' AND resolved = FALSE ORDER BY created_at DESC LIMIT 50"),
    query("SELECT u.id, u.username, u.email FROM users u WHERE u.status = 'FROZEN'"),
    query("SELECT * FROM risk_events WHERE event_type = 'RMS_BLOCK' AND resolved = FALSE ORDER BY created_at DESC LIMIT 50")
  ]);

  res.json({
    success: true,
    risk: {
      totalExposure: parseFloat(totalExposure?.s || '0'),
      marginUsed: parseFloat(marginUsed?.s || '0'),
      highRiskClients: highRisk,
      marginAlerts,
      frozenAccounts,
      rmsBlocks
    }
  });
});

router.get('/risk/alerts', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  const alerts = await query(
    `SELECT re.*, u.username FROM risk_events re
     LEFT JOIN users u ON re.customer_id = u.id
     WHERE re.resolved = FALSE
     ORDER BY CASE re.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, re.created_at DESC
     LIMIT 100`
  );
  res.json({ success: true, alerts });
});

// ============================================================
// 6. KILL SWITCH
// ============================================================
router.get('/risk/kill-switch', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  const states = await query('SELECT * FROM kill_switch_state ORDER BY scope');
  res.json({ success: true, states });
});

router.post('/risk/kill-switch', authenticateToken, checkRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { scope, action, reason } = req.body;
  if (!scope || !action || !reason) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'scope, action, and reason are required' } });
    return;
  }

  const isActive = action === 'ACTIVATE';
  await execute(
    'UPDATE kill_switch_state SET is_active = $1, activated_by = $2, activated_at = NOW(), reason = $3 WHERE scope = $4',
    [isActive, req.user!.userId, reason, scope]
  );

  const logId = 'ksl_' + generateUUID();
  await execute(
    'INSERT INTO kill_switch_log (id, actor_id, actor_role, scope, action, reason) VALUES ($1, $2, $3, $4, $5, $6)',
    [logId, req.user!.userId, req.user!.role, scope, action, reason]
  );
  await logAuditAction(req.user!.userId, req.user!.role, `KILL_SWITCH_${action}`, 'KILL_SWITCH', scope, null, { action, reason }, getClientIp(req));

  res.json({ success: true, message: `Kill switch ${action.toLowerCase()}d for ${scope}` });
});

// ============================================================
// 7. BROKER HEALTH
// ============================================================
router.get('/broker/health', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const mdEngine = MarketDataEngine.getInstance();
  const provider = mdEngine.getActiveProviderName();
  const tickCount = mdEngine.getAllCachedTicks().length;
  const dbHealth = await checkDatabaseHealth();

  res.json({
    success: true,
    broker: {
      provider,
      apiStatus: provider !== 'MOCK' ? 'CONNECTED' : 'DISCONNECTED',
      wsStatus: 'CONNECTED',
      orderApiStatus: 'HEALTHY',
      marketDataStatus: tickCount > 0 ? 'LIVE' : 'WAITING',
      latencyMs: dbHealth.latencyMs,
      activeSubscriptions: tickCount,
      lastTickAt: new Date().toISOString()
    }
  });
});

// ============================================================
// 8. MARKET DATA STATUS
// ============================================================
router.get('/market/status', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const mdEngine = MarketDataEngine.getInstance();
  const ticks = mdEngine.getAllCachedTicks();
  const staleThreshold = Date.now() - 60000;
  let staleCount = 0;
  ticks.forEach((t: any) => { if (t.timestamp && t.timestamp < staleThreshold) staleCount++; });

  res.json({
    success: true,
    marketData: {
      feedStatus: ticks.length > 0 ? 'ACTIVE' : 'IDLE',
      provider: mdEngine.getActiveProviderName(),
      activeSubscriptions: ticks.length,
      staleDataCount: staleCount,
      tickRate: `${ticks.length} instruments`,
      wsConnections: 0 // Placeholder — would need WS server reference
    }
  });
});

// ============================================================
// 9. FUNDS OVERVIEW
// ============================================================
router.get('/funds/overview', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  const [totalFunds, usedMargin, pendingRequests, recentTransactions] = await Promise.all([
    queryOne<any>('SELECT COALESCE(SUM(cash_balance), 0) as total, COALESCE(SUM(used_margin), 0) as margin FROM virtual_wallets'),
    queryOne<any>('SELECT COALESCE(SUM(used_margin), 0) as s FROM virtual_wallets WHERE used_margin > 0'),
    queryOne<any>("SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as s FROM fund_requests WHERE status = 'PENDING'"),
    query('SELECT wl.*, u.username FROM wallet_ledger wl JOIN users u ON wl.user_id = u.id ORDER BY wl.created_at DESC LIMIT 50')
  ]);

  res.json({
    success: true,
    funds: {
      totalFunds: parseFloat(totalFunds?.total || '0'),
      available: parseFloat(totalFunds?.total || '0') - parseFloat(totalFunds?.margin || '0'),
      blocked: parseFloat(totalFunds?.margin || '0'),
      pendingWithdrawals: parseInt(pendingRequests?.c || '0'),
      pendingWithdrawalAmount: parseFloat(pendingRequests?.s || '0'),
      recentTransactions
    }
  });
});

// ============================================================
// 9B. ADMIN FUND REQUEST APPROVAL / REJECTION API
// ============================================================
router.get('/funds/requests', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string || '';
    let whereClause = '';
    const params: any[] = [];

    if (statusFilter) {
      whereClause = 'WHERE fr.status = $1';
      params.push(statusFilter);
    }

    const requests = await query<any>(
      `SELECT fr.*, u.username, u.email
       FROM fund_requests fr
       JOIN users u ON fr.user_id = u.id
       ${whereClause}
       ORDER BY fr.created_at DESC LIMIT 100`,
      params
    );

    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/requests/:id/approve', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reqId = id as string;

    const request = await queryOne<any>('SELECT * FROM fund_requests WHERE id = $1 OR request_id = $1', [reqId]);
    if (!request) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Fund request not found' } });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Request is already ${request.status}` } });
      return;
    }

    const amount = parseFloat(request.amount);
    const userId = request.user_id;

    if (request.request_type === 'DEPOSIT') {
      await VirtualWalletLedger.adminAdjustBalance(
        userId,
        amount,
        req.user!.userId,
        `Approved Deposit Request ${request.request_id}`
      );
    } else if (request.request_type === 'WITHDRAWAL') {
      const wallet = await VirtualWalletLedger.getWallet(userId);
      if (!wallet || wallet.buyingPower < amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `User has insufficient buying power for withdrawal. Required: ₹${amount.toFixed(2)}, Available: ₹${wallet?.buyingPower.toFixed(2) || '0.00'}`
          }
        });
        return;
      }
      await VirtualWalletLedger.adminAdjustBalance(
        userId,
        -amount,
        req.user!.userId,
        `Approved Withdrawal Request ${request.request_id}`
      );
    }

    await execute(
      `UPDATE fund_requests SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [req.user!.userId, request.id]
    );

    res.json({ success: true, message: `Fund request ${request.request_id} APPROVED and wallet updated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/requests/:id/reject', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reqId = id as string;
    const { reason } = req.body;

    const request = await queryOne<any>('SELECT * FROM fund_requests WHERE id = $1 OR request_id = $1', [reqId]);
    if (!request) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Fund request not found' } });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Request is already ${request.status}` } });
      return;
    }

    await execute(
      `UPDATE fund_requests SET status = 'REJECTED', rejection_reason = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [reason || 'Rejected by Admin', req.user!.userId, request.id]
    );

    res.json({ success: true, message: `Fund request ${request.request_id} REJECTED.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 10. LEDGER VIEWER
// ============================================================
router.get('/ledger', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'READ_ONLY_AUDITOR']), async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const customerId = req.query.customerId as string || '';
  const txnType = req.query.type as string || '';

  let where = 'WHERE 1=1';
  const params: any[] = [];
  let paramIdx = 1;

  if (customerId) { where += ` AND wl.user_id = $${paramIdx}`; params.push(customerId); paramIdx++; }
  if (txnType) { where += ` AND wl.transaction_type = $${paramIdx}`; params.push(txnType); paramIdx++; }

  const entries = await query(
    `SELECT wl.*, u.username FROM wallet_ledger wl
     JOIN users u ON wl.user_id = u.id
     ${where}
     ORDER BY wl.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset]
  );
  const countRow = await queryOne<any>(`SELECT COUNT(*) as c FROM wallet_ledger wl ${where}`, params);

  res.json({ success: true, entries, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
});

// ============================================================
// 11. SYSTEM HEALTH MONITOR
// ============================================================
router.get('/system/health', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const mdEngine = MarketDataEngine.getInstance();

  res.json({
    success: true,
    systems: [
      { name: 'API Gateway', status: 'OPERATIONAL', latencyMs: 1 },
      { name: 'OMS', status: 'OPERATIONAL', latencyMs: 2 },
      { name: 'RMS', status: 'OPERATIONAL', latencyMs: 1 },
      { name: 'Market Data', status: mdEngine.getAllCachedTicks().length > 0 ? 'OPERATIONAL' : 'IDLE', latencyMs: 0 },
      { name: 'WebSocket Gateway', status: 'OPERATIONAL', latencyMs: 0 },
      { name: 'PostgreSQL Database', status: dbHealth.healthy ? 'OPERATIONAL' : 'DEGRADED', latencyMs: dbHealth.latencyMs },
      { name: 'Redis Cache', status: redis.isAvailable() ? 'OPERATIONAL' : 'DEGRADED', latencyMs: 0 },
      { name: 'Broker Gateway', status: mdEngine.getActiveProviderName() !== 'MOCK' ? 'CONNECTED' : 'DISCONNECTED', latencyMs: 0 }
    ]
  });
});

// ============================================================
// 12. MARKET DATA PROVIDER & API KEYS MANAGEMENT
// ============================================================
router.get('/market-data/config', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const configs = await MarketDataStorageService.getAllSystemConfigs();
    const engine = MarketDataEngine.getInstance();
    const activeProvider = engine.getActiveProviderName();

    res.json({
      success: true,
      activeProvider,
      availableProviders: ['DHAN', 'TRUEDATA', 'ALPHAVANTAGE', 'ANGELONE', 'INDIAN_STOCK_MARKET_API', 'MOCK_ENGINE'],
      keys: {
        DHAN_CLIENT_ID: configs.DHAN_CLIENT_ID || process.env.DHAN_CLIENT_ID || '1113019677',
        DHAN_ACCESS_TOKEN: configs.DHAN_ACCESS_TOKEN || process.env.DHAN_ACCESS_TOKEN || '',
        DHAN_API_KEY: configs.DHAN_API_KEY || process.env.DHAN_API_KEY || '21483ef7',
        DHAN_API_SECRET: configs.DHAN_API_SECRET || process.env.DHAN_API_SECRET || 'e9730aa4-682c-4e75-a944-94f703449b09',
        TRUEDATA_USERNAME: configs.TRUEDATA_USERNAME || process.env.TRUEDATA_USERNAME || 'Trial208',
        TRUEDATA_PASSWORD: configs.TRUEDATA_PASSWORD || process.env.TRUEDATA_PASSWORD || 'nikhil208',
        TRUEDATA_WS_PORT: configs.TRUEDATA_WS_PORT || process.env.TRUEDATA_WS_PORT || '8086',
        TRUEDATA_WS_URL: configs.TRUEDATA_WS_URL || process.env.TRUEDATA_WS_URL || 'wss://push.truedata.in:8086',
        ALPHAVANTAGE_API_KEY: configs.ALPHAVANTAGE_API_KEY || process.env.ALPHAVANTAGE_API_KEY || '',
        ANGELONE_API_KEY: configs.ANGELONE_API_KEY || process.env.ANGELONE_API_KEY || '',
        ANGELONE_CLIENT_ID: configs.ANGELONE_CLIENT_ID || process.env.ANGELONE_CLIENT_ID || '',
        ANGELONE_CLIENT_SECRET: configs.ANGELONE_CLIENT_SECRET || process.env.ANGELONE_CLIENT_SECRET || '',
        ANGELONE_TOTP_SECRET: configs.ANGELONE_TOTP_SECRET || process.env.ANGELONE_TOTP_SECRET || '',
        INDIAN_STOCK_MARKET_API_BASE_URL: configs.INDIAN_STOCK_MARKET_API_BASE_URL || process.env.INDIAN_STOCK_MARKET_API_BASE_URL || ''
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/market-data/config', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { primaryProvider, keys } = req.body;

    if (keys && typeof keys === 'object') {
      for (const [k, v] of Object.entries(keys)) {
        if (typeof v === 'string') {
          await MarketDataStorageService.setSystemConfig(k, v);
        }
      }
      MarketDataEngine.getInstance().updateProviderCredentials(keys);
    }

    if (primaryProvider && typeof primaryProvider === 'string') {
      await MarketDataStorageService.setSystemConfig('PRIMARY_MARKET_DATA_PROVIDER', primaryProvider);
      await MarketDataEngine.getInstance().switchPrimaryProvider(primaryProvider);
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_MARKET_DATA_CONFIG', 'SYSTEM', 'MARKET_DATA', null, { primaryProvider, keysUpdated: Object.keys(keys || {}) }, getClientIp(req));

    res.json({
      success: true,
      message: `Market Data Provider set to ${MarketDataEngine.getInstance().getActiveProviderName()} and API keys updated successfully.`,
      activeProvider: MarketDataEngine.getInstance().getActiveProviderName()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'CONFIG_ERROR', message: err.message } });
  }
});

// ============================================================
// 13. LOCAL MARKET DATA DOWNLOADER & STORAGE API
// ============================================================
router.post('/market-data/download', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tokens, timeframe = '1D', count = 100 } = req.body;
    const targetTokens = Array.isArray(tokens) && tokens.length > 0
      ? tokens
      : ['NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS'];

    const result = await MarketDataStorageService.downloadAndStoreData(targetTokens, timeframe, count);

    await logAuditAction(req.user!.userId, req.user!.role, 'DOWNLOAD_MARKET_DATA', 'SYSTEM', 'LOCAL_STORAGE', null, { tokens: targetTokens, timeframe, count, stored: result.totalStored }, getClientIp(req));

    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'DOWNLOAD_ERROR', message: err.message } });
  }
});

router.get('/market-data/local-stats', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await MarketDataStorageService.getLocalStorageStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 14. ADMIN KYC MANAGEMENT & DOCUMENT VERIFICATION
// ============================================================
router.get('/kyc/applications', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const apps = await query<any>(
      `SELECT ka.*, u.username, u.email, u.role
       FROM kyc_applications ka
       JOIN users u ON ka.user_id = u.id
       ORDER BY ka.submitted_at DESC`
    );

    const appsWithDocs = await Promise.all(apps.map(async (a: any) => {
      const documents = await query(
        'SELECT id, document_type, original_filename, mime_type, file_size, uploaded_at FROM kyc_documents WHERE kyc_application_id = $1',
        [a.id]
      );
      return { ...a, documents };
    }));

    res.json({ success: true, applications: appsWithDocs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/kyc/documents/:id/download', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doc = await queryOne<any>('SELECT * FROM kyc_documents WHERE id = $1', [req.params.id]);
    if (!doc) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document record not found' } });
      return;
    }

    const fs = require('fs');
    if (!fs.existsSync(doc.file_path)) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Physical file not found on server' } });
      return;
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'DOWNLOAD_KYC_DOCUMENT', 'KYC_DOCUMENT', doc.id, null, { filename: doc.original_filename }, getClientIp(req));

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_filename}"`);
    fs.createReadStream(doc.file_path).pipe(res);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/kyc/review', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { applicationId, action, rejectionReason, rejectionCategory } = req.body;

    if (!applicationId || !action || !['APPROVE', 'REJECT', 'REQUEST_RESUBMISSION'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Application ID and valid action (APPROVE/REJECT/REQUEST_RESUBMISSION) are required' } });
      return;
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RESUBMISSION_REQUIRED';

    await execute(
      `UPDATE kyc_applications
       SET status = $1, rejection_reason = $2, rejection_category = $3, reviewed_at = NOW(), reviewed_by = $4, updated_at = NOW()
       WHERE id = $5`,
      [newStatus, rejectionReason || null, rejectionCategory || null, req.user!.userId, applicationId]
    );

    await logAuditAction(req.user!.userId, req.user!.role, `KYC_${action}`, 'KYC_APPLICATION', applicationId, null, { action, rejectionReason, rejectionCategory }, getClientIp(req));

    res.json({ success: true, message: `KYC Application ${applicationId} has been ${newStatus}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 15. ADMIN DIRECT FUND ADJUSTMENT (CREDIT / DEBIT)
// ============================================================
router.post('/funds/direct-adjust', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, requestType, amount, reason } = req.body;
    const reqAmount = parseFloat(amount);

    if (!userId || !requestType || !['CREDIT', 'DEBIT'].includes(requestType) || isNaN(reqAmount) || reqAmount <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid userId, requestType (CREDIT/DEBIT), and positive amount required' } });
      return;
    }

    const adjustAmount = requestType === 'CREDIT' ? reqAmount : -reqAmount;
    const updatedWallet = await VirtualWalletLedger.adminAdjustBalance(
      userId,
      adjustAmount,
      req.user!.userId,
      reason || `Direct Admin ${requestType}`
    );

    const id = 'freq_' + generateUUID();
    const requestId = 'ADM' + generateUUID().slice(0, 8).toUpperCase();
    await execute(
      `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note, approved_by, approved_at)
       VALUES ($1, $2, $3, $4, $5, 'APPROVED', 'ADMIN_DIRECT', $6, $7, NOW())`,
      [id, requestId, userId, requestType === 'CREDIT' ? 'DEPOSIT' : 'WITHDRAWAL', reqAmount, reason || 'Direct Admin Adjustment', req.user!.userId]
    );

    await logAuditAction(req.user!.userId, req.user!.role, `ADMIN_DIRECT_FUNDS_${requestType}`, 'WALLET', userId, null, { amount: reqAmount, reason }, getClientIp(req));

    res.json({
      success: true,
      message: `Successfully ${requestType === 'CREDIT' ? 'credited' : 'debited'} ₹${reqAmount.toLocaleString('en-IN')} for user.`,
      wallet: updatedWallet
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 16. ADMIN ORDER MONITOR & ORDER MANAGEMENT SYSTEM
// ============================================================
router.get('/orders/monitor', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string || '';
    const exchangeFilter = req.query.exchange as string || '';
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (statusFilter) {
      where += ` AND o.status = $${pIdx}`;
      params.push(statusFilter);
      pIdx++;
    }
    if (exchangeFilter) {
      where += ` AND o.exchange = $${pIdx}`;
      params.push(exchangeFilter);
      pIdx++;
    }

    const orders = await query(
      `SELECT o.*, u.username as client_name, u.email as client_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ${where}
       ORDER BY o.created_at DESC LIMIT $${pIdx}`,
      [...params, limit]
    );

    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/:orderId/price', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { price } = req.body;
    const newPrice = parseFloat(price);

    if (isNaN(newPrice) || newPrice <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PRICE', message: 'Price must be greater than 0' } });
      return;
    }

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Cannot edit price for order in status ${order.status}` } });
      return;
    }

    await execute('UPDATE orders SET price = $1, updated_at = NOW() WHERE id = $2', [newPrice, order.id]);
    await execute(
      `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, $3, $4, 'ADMIN')`,
      ['evt_' + generateUUID(), order.id, order.status, `Admin modified price from ₹${order.price} to ₹${newPrice}`]
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_MODIFY_ORDER_PRICE', 'ORDER', order.id, null, { oldPrice: order.price, newPrice }, getClientIp(req));

    res.json({ success: true, message: `Order ${order.order_id} limit price updated to ₹${newPrice}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/:orderId/cancel', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Order is already ${order.status}` } });
      return;
    }

    await execute(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [order.id]);
    await execute(
      `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, 'CANCELLED', $4, 'ADMIN')`,
      ['evt_' + generateUUID(), order.id, order.status, reason || 'Cancelled by Admin']
    );

    const marginToRelease = parseFloat(order.price || '0') * parseInt(order.quantity || '0', 10);
    if (marginToRelease > 0) {
      await VirtualWalletLedger.releaseMargin(order.user_id, marginToRelease, order.order_id, 'ADMIN_CANCEL');
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_CANCEL_ORDER', 'ORDER', order.id, null, { reason }, getClientIp(req));

    res.json({ success: true, message: `Order ${order.order_id} cancelled by Admin.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/:orderId/execute', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { price } = req.body;

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Order is already ${order.status}` } });
      return;
    }

    const fillPrice = price ? parseFloat(price) : (parseFloat(order.price || '0') || 100);
    const { ExecutionEngine } = require('../trading/ExecutionEngine');
    await ExecutionEngine.executeOrder(order, fillPrice);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_FORCE_EXECUTE_ORDER', 'ORDER', order.id, null, { fillPrice }, getClientIp(req));

    res.json({ success: true, message: `Order ${order.order_id} force-executed @ ₹${fillPrice}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/:orderId/reject', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1 OR order_id = $1', [orderId]);
    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    if (!['ACCEPTED', 'PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Order is already ${order.status}` } });
      return;
    }

    await execute(`UPDATE orders SET status = 'REJECTED', updated_at = NOW() WHERE id = $1`, [order.id]);
    await execute(
      `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, 'REJECTED', $4, 'ADMIN')`,
      ['evt_' + generateUUID(), order.id, order.status, reason || 'Rejected by Admin']
    );

    const marginToRelease = parseFloat(order.price || '0') * parseInt(order.quantity || '0', 10);
    if (marginToRelease > 0) {
      await VirtualWalletLedger.releaseMargin(order.user_id, marginToRelease, order.order_id, 'ADMIN_REJECT');
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_REJECT_ORDER', 'ORDER', order.id, null, { reason }, getClientIp(req));

    res.json({ success: true, message: `Order ${order.order_id} rejected by Admin.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/orders/create', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, symbol, exchange, side, orderType, quantity, price, productType } = req.body;

    if (!userId || !symbol || !side || !quantity || !price) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId, symbol, side, quantity, and price are required' } });
      return;
    }

    const { OMS } = require('../trading/OMS');
    const orderResult = await OMS.placeOrder({
      userId,
      symbol,
      exchange: exchange || 'NSE',
      side,
      orderType: orderType || 'LIMIT',
      productType: productType || 'MIS',
      quantity: parseInt(quantity, 10),
      price: parseFloat(price),
      disclosedQuantity: 0,
      triggerPrice: 0,
      validity: 'DAY',
      tradingSegment: 'EQUITY'
    });

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_PLACE_ORDER', 'ORDER', orderResult.orderId, null, { userId, symbol, side, quantity, price }, getClientIp(req));

    res.json({ success: true, message: `Admin successfully placed order for client. Order ID: ${orderResult.orderId}`, order: orderResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// DHAN TOKEN HOT-SWAP ENDPOINT
// POST /api/v1/admin/broker/update-dhan-token
// Protected: SUPER_ADMIN and ADMIN only
// Description: Updates the Dhan access token in the live adapter
//              AND writes it to .env — no server restart required.
// Usage:
//   curl -X POST http://localhost:5000/api/v1/admin/broker/update-dhan-token \
//     -H "Authorization: Bearer YOUR_ADMIN_JWT" \
//     -H "Content-Type: application/json" \
//     -d '{"accessToken": "YOUR_NEW_DHAN_TOKEN"}'
// ============================================================
router.post('/broker/update-dhan-token', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'accessToken is required in request body.' }
      });
    }

    // Connect the live DhanAdapter instance to the token refresh utility
    const engine = MarketDataEngine.getInstance();
    const dhanProvider = (engine as any).providers?.get('DHAN');
    if (dhanProvider) {
      setDhanAdapterRef(dhanProvider);
    }

    const result = await updateDhanToken(accessToken);

    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: 'TOKEN_UPDATE_FAILED', message: result.message } });
    }

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'DHAN_TOKEN_UPDATED',
      'SYSTEM',
      'dhan_access_token',
      null,
      { expiresInMinutes: result.expiresInMinutes },
      getClientIp(req)
    );

    return res.json({
      success: true,
      message: result.message,
      expiresInMinutes: result.expiresInMinutes,
      expiresInHours: result.expiresInMinutes ? (result.expiresInMinutes / 60).toFixed(1) : null
    });
  } catch (err: any) {
    console.error('[AdminAPI] Dhan token update error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/admin/broker/dhan-token-status
// Returns current Dhan token expiry information
router.get('/broker/dhan-token-status', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dhanToken = process.env.DHAN_ACCESS_TOKEN || '';
    const minutesLeft = getTokenExpiryMinutes(dhanToken);
    const isExpired = minutesLeft < 0;
    const isExpiringSoon = minutesLeft >= 0 && minutesLeft <= 60;

    return res.json({
      success: true,
      status: isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING_SOON' : 'HEALTHY',
      expiresInMinutes: minutesLeft,
      expiresInHours: minutesLeft > 0 ? (minutesLeft / 60).toFixed(1) : null,
      isExpired,
      isExpiringSoon,
      message: isExpired
        ? '🚨 Token is expired. Update required immediately.'
        : isExpiringSoon
        ? `⚠️ Token expires in ${minutesLeft} minutes. Please renew soon.`
        : `✅ Token is healthy. Expires in ~${(minutesLeft/60).toFixed(1)} hours.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
