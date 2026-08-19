import { Router, Request, Response } from 'express';
import argon2 from 'argon2';
import { authenticateToken, checkRole, AuthenticatedRequest } from '../middleware/auth';
import { query, queryOne, execute, withTransaction } from '../db/schema';
import { logAuditAction } from '../middleware/audit';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { MarketDataStorageService } from '../services/MarketDataStorageService';
import { checkDatabaseHealth } from '../db/pool';
import { redis } from '../db/redis';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { updateDhanToken, getTokenExpiryMinutes, setDhanAdapterRef } from '../utils/dhanTokenRefresh';
import { ClientCreationService } from '../services/ClientCreationService';
import { adminEventBus } from '../utils/adminEventBus';


function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  return req.ip ?? '127.0.0.1';
}

const router = Router();
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RISK_MANAGER', 'FINANCE_MANAGER', 'KYC_OFFICER', 'READ_ONLY_AUDITOR'];

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

    const totalTurnover = parseFloat(buyValueRow?.s || '0') + parseFloat(sellValueRow?.s || '0');
    const totalFunds = parseFloat(totalFundsRow?.s || '0');
    const marginUtilized = parseFloat(marginRow?.s || '0');
    const brokerage = parseFloat(brokerageRow?.s || '0');
    const pendingWithdrawals = parseInt(pendingWithdrawalsRow?.c || '0');

    const kpisPayload = {
      timestamp: new Date().toISOString(),
      customers: {
        total: parseInt(totalUsersRow?.c || '0'),
        active: parseInt(activeUsersRow?.c || '0'),
        new: parseInt(newUsersRow?.c || '0'),
        newLast30Days: parseInt(newUsersRow?.c || '0'),
        suspended: parseInt(suspendedRow?.c || '0'),
        frozen: parseInt(frozenRow?.c || '0'),
        kycPending: parseInt(kycPendingRow?.c || '0'),
        kycRejected: parseInt(kycRejectedRow?.c || '0')
      },
      trading: {
        ordersToday: parseInt(ordersRow?.c || '0'),
        tradesToday: parseInt(tradesRow?.c || '0'),
        totalTrades: parseInt(turnoverRow?.c || '0'),
        activeTraders: parseInt(activeTradersRow?.c || '0'),
        activeTradersToday: parseInt(activeTradersRow?.c || '0'),
        turnover: totalTurnover,
        totalTurnover: totalTurnover,
        buyValue: parseFloat(buyValueRow?.s || '0'),
        buyTurnover: parseFloat(buyValueRow?.s || '0'),
        sellValue: parseFloat(sellValueRow?.s || '0'),
        sellTurnover: parseFloat(sellValueRow?.s || '0')
      },
      financial: {
        totalFunds: totalFunds,
        totalFundsUnderCustody: totalFunds,
        marginUtilized: marginUtilized,
        totalMarginUtilized: marginUtilized,
        brokerage: brokerage,
        totalBrokerageEarned: brokerage,
        pendingWithdrawals: pendingWithdrawals,
        pendingWithdrawalsCount: pendingWithdrawals
      },
      financials: {
        totalFundsUnderCustody: totalFunds,
        totalMarginUtilized: marginUtilized,
        totalBrokerageEarned: brokerage,
        pendingWithdrawalsCount: pendingWithdrawals
      },
      risk: {
        highRiskClients: parseInt(highRiskRow?.c || '0'),
        highRiskEvents: parseInt(highRiskRow?.c || '0'),
        marginAlerts: parseInt(marginAlertsRow?.c || '0'),
        rmsBlocks: parseInt(rmsBlocksRow?.c || '0'),
        frozenAccounts: parseInt(frozenRow?.c || '0')
      },
      technology: {
        apiStatus: 'OPERATIONAL',
        wsStatus: 'CONNECTED',
        brokerStatus: mdProvider.toUpperCase(),
        marketDataStatus: 'LIVE',
        omsStatus: 'OPERATIONAL',
        rmsStatus: 'ACTIVE',
        databaseHealth: dbHealth.healthy ? 'HEALTHY' : 'DEGRADED'
      },
      system: {
        databaseHealthy: dbHealth.healthy,
        databaseLatencyMs: dbHealth.latencyMs,
        marketDataProvider: mdProvider,
        activeFeeds: 13,
        realMoneyAllowed: SafetyLock.REAL_MONEY_TRADING_ALLOWED
      }
    };

    res.json({
      success: true,
      kpis: kpisPayload,
      data: kpisPayload
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
    where += ` AND (u.username ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.id ILIKE $${paramIdx} OR u.client_id ILIKE $${paramIdx})`;
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
    `SELECT u.id, u.client_id, u.username, u.email, u.full_name, u.phone_number, u.role, u.status, u.created_at, u.last_login_at, u.failed_login_attempts,
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

// Real-Time Duplicate Identity Checker API
router.get('/customers/check-duplicate', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const email = req.query.email as string || '';
    const username = req.query.username as string || '';
    const clientId = req.query.clientId as string || '';
    const excludeUserId = req.query.excludeUserId as string || '';

    const result = await ClientCreationService.checkDuplicate({ email, username, clientId, excludeUserId });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Admin Add Customer / Create Client API
router.post('/customers/create', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, password, role, clientId, fullName, phoneNumber, initialCapital, city, address } = req.body;

    const result = await ClientCreationService.createClient({
      username,
      email,
      password,
      role: role || 'USER',
      clientId,
      fullName,
      phoneNumber,
      city,
      address,
      initialCapital: parseFloat(initialCapital) || 0.0,
      creatorId: req.user!.userId,
      creatorRole: req.user!.role,
      creatorIp: getClientIp(req)
    });

    if (!result.success || !result.user) {
      const statusCode = result.error?.code?.startsWith('DUPLICATE_') ? 409 : 400;
      res.status(statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({
      success: true,
      message: `Customer ${result.user.username} (Client ID: ${result.user.clientId}) created successfully.`,
      user: result.user
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Scan Database for Duplicate Identities (Email, Phone, PAN)
router.get('/customers/duplicates', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Find users with identical normalized emails (if any)
    const emailDups = await query<any>(
      `SELECT LOWER(TRIM(email)) as norm_email, COUNT(*) as count, ARRAY_AGG(id) as user_ids, ARRAY_AGG(username) as usernames, ARRAY_AGG(client_id) as client_ids
       FROM users
       GROUP BY LOWER(TRIM(email))
       HAVING COUNT(*) > 1`
    );

    // 2. Find users with identical phone numbers (if populated)
    const phoneDups = await query<any>(
      `SELECT phone_number, COUNT(*) as count, ARRAY_AGG(id) as user_ids, ARRAY_AGG(username) as usernames, ARRAY_AGG(client_id) as client_ids
       FROM users
       WHERE phone_number IS NOT NULL AND phone_number != ''
       GROUP BY phone_number
       HAVING COUNT(*) > 1`
    );

    // 3. Find users with identical PAN in KYC records
    const panDups = await query<any>(
      `SELECT pan_number, COUNT(*) as count, ARRAY_AGG(customer_id) as user_ids
       FROM kyc_records
       WHERE pan_number IS NOT NULL AND pan_number != ''
       GROUP BY pan_number
       HAVING COUNT(*) > 1`
    );

    res.json({
      success: true,
      duplicates: {
        byEmail: emailDups,
        byPhone: phoneDups,
        byPan: panDups,
        totalFlaggedGroups: emailDups.length + phoneDups.length + panDups.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
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

  const marketEngine = MarketDataEngine.getInstance();
  const enrichedPositions = (positions || []).map((p: any) => {
    const netQty = parseInt(p.net_qty || '0', 10);
    const avgPx = parseFloat(p.average_price || '0');
    const cachedTick = marketEngine.getCachedTick(p.symbol) || 
                       (p.instrument_token ? marketEngine.getCachedTick(p.instrument_token) : undefined);
    const liveLtp = cachedTick?.ltp ?? parseFloat(p.ltp || p.average_price || '0');
    const unrealized = netQty !== 0 ? (liveLtp - avgPx) * netQty : parseFloat(p.unrealized_pnl || '0');
    return {
      ...p,
      ltp: liveLtp,
      unrealized_pnl: unrealized
    };
  });

  const enrichedHoldings = (holdings || []).map((h: any) => {
    const qty = parseInt(h.quantity || '0', 10);
    const avgPx = parseFloat(h.average_price || '0');
    const cachedTick = marketEngine.getCachedTick(h.symbol) || 
                       (h.instrument_token ? marketEngine.getCachedTick(h.instrument_token) : undefined);
    const liveLtp = cachedTick?.ltp ?? parseFloat(h.ltp || h.average_price || '0');
    const pnl = qty > 0 ? (liveLtp - avgPx) * qty : 0;
    return {
      ...h,
      ltp: liveLtp,
      pnl
    };
  });

  res.json({
    success: true,
    customer: {
      profile: user,
      wallet,
      kycRecords,
      orders,
      trades,
      positions: enrichedPositions,
      holdings: enrichedHoldings,
      ledger,
      auditLogs
    }
  });
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

router.post('/customers/:id/reset-password', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = req.params.id as string;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 6 characters long' } });
      return;
    }

    const targetUser = await queryOne<any>('SELECT id, username, email, role FROM users WHERE id = $1', [targetUserId]);
    if (!targetUser) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Target user not found' } });
      return;
    }

    // Hash password with Argon2
    const passwordHash = await argon2.hash(newPassword);

    await execute(
      `UPDATE users 
       SET password_hash = $1, failed_login_attempts = 0, updated_at = NOW() 
       WHERE id = $2`,
      [passwordHash, targetUserId]
    );

    await logAuditAction(
      req.user!.userId,
      req.user!.role,
      'ADMIN_RESET_PASSWORD',
      'USER',
      targetUserId,
      null,
      { targetUsername: targetUser.username, targetEmail: targetUser.email },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: `Password successfully reset for user ${targetUser.username} (${targetUser.email}).`
    });
  } catch (err: any) {
    console.error('[Admin Reset Password Error]', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to reset user password' } });
  }
});

// ============================================================
// 3. KYC MANAGEMENT
// ============================================================
router.get('/kyc/queue', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
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
router.get('/funds/overview', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
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
router.get('/funds/requests', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
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

router.post('/funds/requests/:id/approve', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reqId = id as string;
    const actorId = req.user!.userId;
    const actorRole = req.user!.role;

    const result = await withTransaction(async (client) => {
      // 1. Lock fund request row FOR UPDATE
      const reqRes = await client.query(
        'SELECT * FROM fund_requests WHERE id = $1 OR request_id = $1 FOR UPDATE',
        [reqId]
      );
      if (reqRes.rows.length === 0) {
        throw new Error('NOT_FOUND:Fund request not found');
      }

      const request = reqRes.rows[0];
      if (request.status !== 'PENDING') {
        throw new Error(`INVALID_STATUS:Request is already ${request.status}`);
      }

      const amount = parseFloat(request.amount);
      const userId = request.user_id;

      if (request.request_type === 'DEPOSIT') {
        // Enforce duplicate reference note prevention on deposits
        if (request.reference_note && request.reference_note.trim().length > 0) {
          const dupRes = await client.query(
            `SELECT id, request_id FROM fund_requests 
             WHERE payment_method = $1 AND reference_note = $2 AND status = 'APPROVED' AND id != $3 LIMIT 1`,
            [request.payment_method || 'UPI', request.reference_note.trim(), request.id]
          );
          if (dupRes.rows.length > 0) {
            throw new Error(`DUPLICATE_REFERENCE:Deposit reference '${request.reference_note}' was already approved under request ${dupRes.rows[0].request_id}`);
          }
        }

        // Lock user's wallet
        const wRes = await client.query(
          'SELECT cash_balance FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );
        if (wRes.rows.length === 0) throw new Error('NOT_FOUND:User wallet not found');
        const currentCash = parseFloat(wRes.rows[0].cash_balance);
        const newCash = currentCash + amount;

        // Credit wallet
        await client.query(
          'UPDATE virtual_wallets SET cash_balance = $1, updated_at = NOW() WHERE user_id = $2',
          [newCash, userId]
        );

        // Record immutable ledger entry
        await client.query(
          `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
           VALUES ($1, $2, $3, 'DEPOSIT', $4, $5, $6, $7, $8, $9)`,
          [
            'led_' + generateUUID(), generateUUID(), userId,
            amount, currentCash, newCash,
            request.request_id, actorId,
            JSON.stringify({ 
              reason: `Approved Deposit ${request.request_id}`, 
              paymentMethod: request.payment_method, 
              referenceNote: request.reference_note,
              approvedBy: actorId
            })
          ]
        );
      } else if (request.request_type === 'WITHDRAWAL') {
        // RBAC Multi-level approval check based on matrix limits
        let canApprove = false;
        
        if (actorRole === 'SUPER_ADMIN') {
          canApprove = true; // Unlimited
        } else if (actorRole === 'ADMIN' || actorRole === 'FINANCE_MANAGER') {
          if (amount <= 100000) canApprove = true;
        }

        if (!canApprove) {
          // Escalate to TIER_2_SENIOR if they cannot approve it directly (e.g., MANAGER always escalates, ADMIN/FINANCE_MANAGER escalates > 100k)
          await client.query(
            `UPDATE fund_requests 
             SET review_tier = 'TIER_2_SENIOR', first_approved_by = $1, first_approved_at = NOW(), updated_at = NOW() 
             WHERE id = $2`,
            [actorId, request.id]
          );
          return { escalated: true, message: `Withdrawal request of ₹${amount.toLocaleString('en-IN')} escalated for Senior approval due to limits.` };
        }

        // Check withdrawable balance (Cash - Used Margin + min(0, Unrealized P&L))
        const wRes = await client.query(
          'SELECT cash_balance, used_margin FROM virtual_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );
        if (wRes.rows.length === 0) throw new Error('NOT_FOUND:User wallet not found');
        const currentCash = parseFloat(wRes.rows[0].cash_balance);
        const usedMargin = parseFloat(wRes.rows[0].used_margin);
        const buyingPower = Math.max(0, currentCash - usedMargin);

        if (buyingPower < amount) {
          throw new Error(`INSUFFICIENT_FUNDS:Insufficient buying power. Required: ₹${amount.toFixed(2)}, Available: ₹${buyingPower.toFixed(2)}`);
        }

        const newCash = currentCash - amount;
        if (newCash < 0) {
          throw new Error('NEGATIVE_BALANCE:Withdrawal would produce negative balance');
        }

        // Debit wallet
        await client.query(
          'UPDATE virtual_wallets SET cash_balance = $1, updated_at = NOW() WHERE user_id = $2',
          [newCash, userId]
        );

        // Record immutable ledger entry
        await client.query(
          `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
           VALUES ($1, $2, $3, 'WITHDRAWAL', $4, $5, $6, $7, $8, $9)`,
          [
            'led_' + generateUUID(), generateUUID(), userId,
            amount, currentCash, newCash,
            request.request_id, actorId,
            JSON.stringify({ 
              reason: `Approved Withdrawal Payout ${request.request_id}`, 
              paymentMethod: request.payment_method, 
              referenceNote: request.reference_note,
              approvedBy: actorId 
            })
          ]
        );
      }

      // Update fund request status
      await client.query(
        `UPDATE fund_requests SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [actorId, request.id]
      );

      return { escalated: false, message: `Fund request ${request.request_id} APPROVED and wallet updated.` };
    });

    await logAuditAction(
      actorId, actorRole,
      'APPROVE_FUND_REQUEST', 'FUND_REQUEST', reqId,
      null, { reqId }, getClientIp(req)
    );

    res.json({ success: true, ...result });
  } catch (err: any) {
    const colonIdx = err.message ? err.message.indexOf(':') : -1;
    const code = colonIdx !== -1 ? err.message.slice(0, colonIdx) : 'SERVER_ERROR';
    const msg = colonIdx !== -1 ? err.message.slice(colonIdx + 1) : (err.message || 'Server error occurred');
    res.status(code === 'NOT_FOUND' ? 404 : 400).json({ success: false, error: { code, message: msg } });
  }
});

router.post('/funds/requests/:id/reject', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
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

// Admin-Only Payment Credentials Configuration (LinkPe UPI & Bank Account)
router.get('/funds/payment-settings', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const keys = [
      'LINKPE_UPI_ID', 'LINKPE_MERCHANT_NAME',
      'MERCHANT_BANK_NAME', 'MERCHANT_ACCOUNT_NAME',
      'MERCHANT_ACCOUNT_NUMBER', 'MERCHANT_IFSC', 'MERCHANT_BRANCH'
    ];
    const settingsRows = await query<any>(
      `SELECT key, value FROM system_settings WHERE key = ANY($1)`,
      [keys]
    );

    const settingsMap: Record<string, string> = {};
    settingsRows.forEach(r => { settingsMap[r.key] = r.value; });

    res.json({
      success: true,
      settings: {
        upiId: settingsMap['LINKPE_UPI_ID'] || process.env.LINKPE_UPI_ID || 'tradegrow@upi',
        merchantName: settingsMap['LINKPE_MERCHANT_NAME'] || process.env.LINKPE_MERCHANT_NAME || 'Trade Grow Brokerage',
        bankName: settingsMap['MERCHANT_BANK_NAME'] || 'HDFC Bank',
        accountName: settingsMap['MERCHANT_ACCOUNT_NAME'] || 'Trade Grow Technologies Pvt Ltd',
        accountNumber: settingsMap['MERCHANT_ACCOUNT_NUMBER'] || '50200098765432',
        ifscCode: settingsMap['MERCHANT_IFSC'] || 'HDFC0001234',
        branch: settingsMap['MERCHANT_BRANCH'] || 'Mumbai Main Branch'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/payment-settings', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { upiId, merchantName, bankName, accountName, accountNumber, ifscCode, branch } = req.body;

    if (!upiId || !merchantName) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'UPI ID and Merchant Name are required' } });
      return;
    }

    const upsertSetting = async (key: string, val: string) => {
      await execute(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES ($1, $2, 'Merchant Payment Receiving Setting', NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, val]
      );
    };

    await Promise.all([
      upsertSetting('LINKPE_UPI_ID', upiId.trim()),
      upsertSetting('LINKPE_MERCHANT_NAME', merchantName.trim()),
      bankName && upsertSetting('MERCHANT_BANK_NAME', bankName.trim()),
      accountName && upsertSetting('MERCHANT_ACCOUNT_NAME', accountName.trim()),
      accountNumber && upsertSetting('MERCHANT_ACCOUNT_NUMBER', accountNumber.trim()),
      ifscCode && upsertSetting('MERCHANT_IFSC', ifscCode.trim().toUpperCase()),
      branch && upsertSetting('MERCHANT_BRANCH', branch.trim())
    ]);

    await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_PAYMENT_SETTINGS', 'SYSTEM_SETTINGS', 'LINKPE_UPI_ID', null, { upiId, merchantName, bankName, accountNumber }, getClientIp(req));

    res.json({ success: true, message: 'Merchant receiving payment credentials (UPI & Bank) updated successfully!' });
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

    if (!['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(order.status)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: `Order is already ${order.status}` } });
      return;
    }

    await execute(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [order.id]);
    await execute(
      `INSERT INTO order_events (id, order_id, from_status, to_status, reason, actor)
       VALUES ($1, $2, $3, 'CANCELLED', $4, 'ADMIN')`,
      ['evt_' + generateUUID(), order.id, order.status, reason || 'Cancelled by Admin']
    );

    const leverageMultiplier = order.product_type === 'MIS' ? 0.20 : 1.0;
    const marginToRelease = parseFloat(order.price || '0') * parseInt(order.quantity || '0', 10) * leverageMultiplier;
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
// ADMIN POSITION MANAGEMENT & EXCLUSIVE RIGHTS
// ============================================================
router.post('/positions/:id/edit', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const positionId = req.params.id as string;
    const { netQty, averagePrice, buyPrice, sellPrice } = req.body;

    const pos = await queryOne<any>('SELECT * FROM positions WHERE id = $1', [positionId]);
    if (!pos) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Position not found' } });
      return;
    }

    const nQty = netQty !== undefined ? parseInt(netQty, 10) : parseInt(pos.net_qty, 10);
    const avgPx = averagePrice !== undefined ? parseFloat(averagePrice) : parseFloat(pos.average_price);
    const bPx = buyPrice !== undefined ? parseFloat(buyPrice) : parseFloat(pos.buy_price);
    const sPx = sellPrice !== undefined ? parseFloat(sellPrice) : parseFloat(pos.sell_price);

    await execute(
      `UPDATE positions
       SET net_qty = $1, average_price = $2, buy_price = $3, sell_price = $4, updated_at = NOW()
       WHERE id = $5`,
      [nQty, avgPx, bPx, sPx, positionId]
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_EDIT_POSITION', 'POSITION', positionId, null, { netQty: nQty, averagePrice: avgPx }, getClientIp(req));

    res.json({ success: true, message: `Position updated successfully. Net Qty: ${nQty}, Avg Price: ₹${avgPx}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/positions/:id/square-off', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const positionId = req.params.id as string;
    const { price } = req.body;

    const pos = await queryOne<any>('SELECT * FROM positions WHERE id = $1', [positionId]);
    if (!pos || parseInt(pos.net_qty, 10) === 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_POSITION', message: 'Position is already closed or not found' } });
      return;
    }

    const netQty = parseInt(pos.net_qty, 10);
    const exitSide = netQty > 0 ? 'SELL' : 'BUY';
    const exitQty = Math.abs(netQty);
    const exitPrice = price ? parseFloat(price) : (parseFloat(pos.ltp) || parseFloat(pos.average_price) || 100);

    const { PortfolioService } = require('../trading/PortfolioService');
    const { VirtualWalletLedger } = require('../trading/VirtualWalletLedger');

    await withTransaction(async (client: any) => {
      const res = await PortfolioService.recordExecutionInTransaction(
        client,
        pos.user_id,
        pos.symbol,
        pos.exchange || 'NSE',
        pos.product_type || 'MIS',
        exitSide,
        exitQty,
        exitPrice,
        'ADMIN_SQUARE_OFF',
        'ADMIN_FORCE_EXIT',
        'exc_' + generateUUID()
      );

      const tradeVal = exitPrice * exitQty;
      const blockedMargin = pos.product_type === 'MIS' ? tradeVal * 0.20 : tradeVal;

      await VirtualWalletLedger.settleTradeExecutionInTransaction(
        client,
        pos.user_id,
        exitSide,
        tradeVal,
        blockedMargin,
        res.releasedPositionCapital,
        res.realizedPnlDelta,
        'ADMIN_SQUARE_OFF'
      );
    });

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_SQUARE_OFF_POSITION', 'POSITION', positionId, null, { exitSide, exitQty, exitPrice }, getClientIp(req));

    res.json({ success: true, message: `Position ${pos.symbol} squared off by admin @ ₹${exitPrice}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// ADMIN CLIENT FUNDS MANAGEMENT
// ============================================================
router.post('/customers/:id/funds', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { amount, action, reason } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || !['ADD', 'DEDUCT'].includes(action)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Valid positive amount and action (ADD/DEDUCT) required' } });
      return;
    }

    const wallet = await queryOne<any>('SELECT * FROM virtual_wallets WHERE user_id = $1', [customerId]);
    if (!wallet) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User wallet not found' } });
      return;
    }

    const currentCash = parseFloat(wallet.cash_balance);
    const newCash = action === 'ADD' ? currentCash + amt : Math.max(0, currentCash - amt);

    await withTransaction(async (client: any) => {
      await client.query('UPDATE virtual_wallets SET cash_balance = $1, updated_at = NOW() WHERE user_id = $2', [newCash, customerId]);
      await client.query(
        `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ADMIN', $9)`,
        [
          'led_' + generateUUID(), generateUUID(), customerId,
          action === 'ADD' ? 'CREDIT' : 'DEBIT',
          amt, currentCash, newCash,
          'ADMIN_' + action,
          JSON.stringify({ reason: reason || 'Admin Manual Capital Adjustment', adminUserId: req.user!.userId })
        ]
      );
    });

    await logAuditAction(req.user!.userId, req.user!.role, `ADMIN_${action}_FUNDS`, 'WALLET', wallet.id, null, { amount: amt, action, reason }, getClientIp(req));

    res.json({ success: true, message: `Successfully ${action === 'ADD' ? 'added' : 'deducted'} ₹${amt.toLocaleString('en-IN')} ${action === 'ADD' ? 'to' : 'from'} customer wallet. New Balance: ₹${newCash.toLocaleString('en-IN')}` });
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
router.get('/broker/dhan-token-status', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
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

// ============================================================
// 15. FILL PROVENANCE & DISPUTE AUDITOR
// ============================================================
router.get('/executions/provenance', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'KYC_OFFICER', 'READ_ONLY_AUDITOR']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, symbol, freshness, limit = '50', offset = '0' } = req.query;
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      params.push(userId);
      where += ` AND e.user_id = $${params.length}`;
    }
    if (symbol) {
      params.push(`%${String(symbol).toUpperCase()}%`);
      where += ` AND e.symbol ILIKE $${params.length}`;
    }
    if (freshness) {
      params.push(freshness);
      where += ` AND e.freshness_tag = $${params.length}`;
    }

    params.push(parseInt(String(limit), 10));
    params.push(parseInt(String(offset), 10));

    const rows = await query<any>(
      `SELECT e.*, u.username, u.email, o.order_type, o.price as order_price, o.trigger_price
       FROM executions e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN orders o ON e.order_id = o.id
       ${where}
       ORDER BY e.executed_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countRow = await queryOne<any>(
      `SELECT COUNT(*) as c FROM executions e ${where.replace(/LIMIT.*$/, '')}`,
      params.slice(0, params.length - 2)
    );

    res.json({
      success: true,
      executions: rows,
      total: parseInt(countRow?.c || '0')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 16. PLATFORM SOLVENCY & CASH RESERVE RECONCILER
// ============================================================
router.get('/finance/reserves', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { totalCash, totalLiability, totalUsedMargin } = await VirtualWalletLedger.getPlatformTotalLiability();
    
    // Get latest recorded platform bank reserve snapshot
    const latestSnapshot = await queryOne<any>(
      'SELECT * FROM platform_reserves ORDER BY created_at DESC LIMIT 1'
    );

    const bankReserve = latestSnapshot ? parseFloat(latestSnapshot.bank_cash_reserve) : totalCash;
    const reserveRatio = totalLiability > 0 ? (bankReserve / totalLiability) : 1.0;
    const status = reserveRatio >= 1.0 ? 'HEALTHY' : (reserveRatio >= 0.8 ? 'WARNING' : 'DEFICIT');

    res.json({
      success: true,
      solvency: {
        totalUserCashBalance: totalCash,
        totalUsedMargin,
        totalWithdrawableLiabilities: totalLiability,
        bankCashReserve: bankReserve,
        reserveRatio: Number(reserveRatio.toFixed(4)),
        status,
        lastReconciledAt: latestSnapshot?.created_at || null,
        reconciledBy: latestSnapshot?.reconciled_by || null,
        notes: latestSnapshot?.notes || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/finance/reserves/reconcile', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bankCashReserve, notes } = req.body;
    const bankReserveNum = parseFloat(bankCashReserve);
    if (isNaN(bankReserveNum) || bankReserveNum < 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Bank cash reserve must be a valid non-negative number' } });
      return;
    }

    const { totalLiability, totalCash } = await VirtualWalletLedger.getPlatformTotalLiability();
    const reserveRatio = totalLiability > 0 ? (bankReserveNum / totalLiability) : 1.0;
    const status = reserveRatio >= 1.0 ? 'HEALTHY' : (reserveRatio >= 0.8 ? 'WARNING' : 'DEFICIT');

    const id = 'res_' + generateUUID();
    await execute(
      `INSERT INTO platform_reserves (id, bank_cash_reserve, total_user_liabilities, reserve_ratio, status, reconciled_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, bankReserveNum, totalLiability, reserveRatio, status, req.user!.userId, notes || null]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'RECONCILE_RESERVES', 'FINANCE', id,
      null, { bankReserveNum, totalLiability, reserveRatio, status }, getClientIp(req)
    );

    res.json({
      success: true,
      message: `Platform reserves reconciled successfully. Solvency status: ${status} (Reserve ratio: ${(reserveRatio * 100).toFixed(1)}%).`,
      solvency: {
        bankCashReserve: bankReserveNum,
        totalWithdrawableLiabilities: totalLiability,
        reserveRatio: Number(reserveRatio.toFixed(4)),
        status
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 17. MANAGER HIERARCHY & CAPACITY CONTROLS
// ============================================================
router.get('/managers', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const managers = await query<any>(
      `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at,
              COALESCE(ml.max_users, 100) as max_users,
              COALESCE(ml.max_exposure_per_user, 1000000) as max_exposure_per_user,
              COALESCE(ml.max_deposit_approval, 50000) as max_deposit_approval,
              COALESCE(ml.max_withdrawal_approval, 25000) as max_withdrawal_approval,
              COUNT(ma.user_id) as assigned_users_count
       FROM users u
       LEFT JOIN manager_limits ml ON u.id = ml.manager_id
       LEFT JOIN manager_assignments ma ON u.id = ma.manager_id
       WHERE u.role IN ('ADMIN', 'MANAGER', 'RISK_MANAGER', 'FINANCE_MANAGER', 'MANAGER')
       GROUP BY u.id, ml.max_users, ml.max_exposure_per_user, ml.max_deposit_approval, ml.max_withdrawal_approval
       ORDER BY u.created_at ASC`
    );

    res.json({ success: true, managers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/managers/assign', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { managerId, userId } = req.body;
    if (!managerId || !userId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'managerId and userId are required' } });
      return;
    }

    const id = 'asgn_' + generateUUID();
    await execute(
      `INSERT INTO manager_assignments (id, manager_id, user_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (manager_id, user_id) DO NOTHING`,
      [id, managerId, userId, req.user!.userId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ASSIGN_USER_TO_MANAGER', 'USER', userId,
      null, { managerId, userId }, getClientIp(req)
    );

    res.json({ success: true, message: 'User assigned to manager successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});


// ============================================================
// 18. CUSTOMER PROFILE MODIFICATION (PATCH)
// ============================================================
router.patch('/customers/:id', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { fullName, phoneNumber, email, address, city, role, status } = req.body;

    const current = await queryOne<any>(
      'SELECT id, username, email, full_name, phone_number, address, city, role, status FROM users WHERE id = $1',
      [customerId]
    );
    if (!current) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    // Protect sensitive fields from unauthorized roles
    if (role && role !== current.role && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { code: 'PERMISSION_DENIED', message: 'Only SUPER_ADMIN or ADMIN can change user role' } });
      return;
    }

    // Validate email uniqueness if changing
    if (email && email.toLowerCase().trim() !== current.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await queryOne<any>(
        'SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND id != $2',
        [normalizedEmail, customerId]
      );
      if (existing) {
        res.status(409).json({ success: false, error: { code: 'DUPLICATE_EMAIL', message: `Email '${normalizedEmail}' is already in use by another account.` } });
        return;
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let pIdx = 1;
    const changes: Record<string, { from: any; to: any }> = {};

    if (fullName !== undefined && fullName !== current.full_name) {
      updates.push(`full_name = $${pIdx}`); params.push(fullName.trim()); pIdx++;
      changes.fullName = { from: current.full_name, to: fullName.trim() };
    }
    if (phoneNumber !== undefined && phoneNumber !== current.phone_number) {
      updates.push(`phone_number = $${pIdx}`); params.push(phoneNumber.trim()); pIdx++;
      changes.phoneNumber = { from: current.phone_number, to: phoneNumber.trim() };
    }
    if (email !== undefined && email.toLowerCase().trim() !== current.email) {
      updates.push(`email = $${pIdx}`); params.push(email.toLowerCase().trim()); pIdx++;
      changes.email = { from: current.email, to: email.toLowerCase().trim() };
    }
    if (address !== undefined && address !== current.address) {
      updates.push(`address = $${pIdx}`); params.push(address.trim()); pIdx++;
      changes.address = { from: current.address, to: address.trim() };
    }
    if (city !== undefined && city !== current.city) {
      updates.push(`city = $${pIdx}`); params.push(city.trim()); pIdx++;
      changes.city = { from: current.city, to: city.trim() };
    }
    if (role !== undefined && role !== current.role) {
      updates.push(`role = $${pIdx}`); params.push(role); pIdx++;
      changes.role = { from: current.role, to: role };
    }

    if (updates.length === 0) {
      res.json({ success: true, message: 'No changes detected.' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(customerId);
    await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = $${pIdx}`, params);

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_UPDATED_CUSTOMER', 'USER', customerId,
      current, changes, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_PROFILE_UPDATED', customerId, { changes });

    res.json({ success: true, message: 'Customer profile updated successfully.', changes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 19. SUSPEND CUSTOMER
// ============================================================
router.post('/customers/:id/suspend', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, notes, suspendUntil } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required to suspend an account' } });
      return;
    }

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_SUSPENDED', message: 'Account is already suspended' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'SUSPENDED', suspended_reason = $1, suspended_by = $2, suspended_at = NOW(), suspended_until = $3, updated_at = NOW() WHERE id = $4`,
      [reason.trim(), req.user!.userId, suspendUntil || null, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_SUSPENDED_CUSTOMER', 'USER', customerId,
      { status: user.status }, { status: 'SUSPENDED', reason, notes }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'SUSPENDED', reason, suspendedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been suspended.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 20. ACTIVATE CUSTOMER
// ============================================================
router.post('/customers/:id/activate', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason } = req.body;

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status === 'ACTIVE') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_ACTIVE', message: 'Account is already active' } });
      return;
    }

    if (user.status === 'CLOSED') {
      res.status(400).json({ success: false, error: { code: 'ACCOUNT_CLOSED', message: 'Closed accounts cannot be reactivated directly. Please create a new account.' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'ACTIVE', suspended_reason = NULL, suspended_by = NULL, suspended_at = NULL,
       suspended_until = NULL, locked_reason = NULL, locked_by = NULL, locked_at = NULL, updated_at = NOW() WHERE id = $1`,
      [customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_ACTIVATED_CUSTOMER', 'USER', customerId,
      { status: user.status }, { status: 'ACTIVE', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'ACTIVE', activatedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been activated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 21. LOCK CUSTOMER (Security Hold)
// ============================================================
router.post('/customers/:id/lock', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required to lock an account' } });
      return;
    }

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'LOCKED', locked_reason = $1, locked_by = $2, locked_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [reason.trim(), req.user!.userId, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_LOCKED_CUSTOMER', 'USER', customerId,
      { status: user.status }, { status: 'LOCKED', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'LOCKED', reason, lockedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been locked.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 22. UNLOCK CUSTOMER
// ============================================================
router.post('/customers/:id/unlock', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason } = req.body;

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status !== 'LOCKED') {
      res.status(400).json({ success: false, error: { code: 'NOT_LOCKED', message: 'Account is not currently locked' } });
      return;
    }

    await execute(
      `UPDATE users SET status = 'ACTIVE', locked_reason = NULL, locked_by = NULL, locked_at = NULL,
       unlocked_by = $1, unlocked_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [req.user!.userId, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_UNLOCKED_CUSTOMER', 'USER', customerId,
      { status: 'LOCKED' }, { status: 'ACTIVE', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'ACTIVE', unlockedBy: req.user!.userId
    });

    res.json({ success: true, message: `Account for ${user.username} has been unlocked and reactivated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 23. CLOSE CUSTOMER ACCOUNT (Soft Close — with dependency check)
// ============================================================
router.post('/customers/:id/close', authenticateToken, checkRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, confirmClose } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason is required to close an account' } });
      return;
    }

    if (!confirmClose) {
      res.status(400).json({ success: false, error: { code: 'CONFIRMATION_REQUIRED', message: 'confirmClose: true is required to proceed with account closure' } });
      return;
    }

    const user = await queryOne<any>('SELECT id, username, status FROM users WHERE id = $1', [customerId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    if (user.status === 'CLOSED') {
      res.status(400).json({ success: false, error: { code: 'ALREADY_CLOSED', message: 'Account is already closed' } });
      return;
    }

    // Dependency check — cannot close with open positions or non-zero balance
    const [openPositions, wallet] = await Promise.all([
      queryOne<any>('SELECT COUNT(*) as c FROM positions WHERE user_id = $1 AND net_qty != 0', [customerId]),
      queryOne<any>('SELECT cash_balance, used_margin FROM virtual_wallets WHERE user_id = $1', [customerId])
    ]);

    const openPosCount = parseInt(openPositions?.c || '0');
    const cashBalance = parseFloat(wallet?.cash_balance || '0');
    const usedMargin = parseFloat(wallet?.used_margin || '0');

    if (openPosCount > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OPEN_POSITIONS_EXIST',
          message: `This account has ${openPosCount} open position(s). Please square off all positions before closing the account.`
        }
      });
      return;
    }

    if (usedMargin > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MARGIN_BLOCKED',
          message: `This account has ₹${usedMargin.toLocaleString('en-IN')} margin blocked. Release all margin before closing.`
        }
      });
      return;
    }

    // Soft close — preserve all historical data, just change status
    await execute(
      `UPDATE users SET status = 'CLOSED', closed_reason = $1, closed_by = $2, closed_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [reason.trim(), req.user!.userId, customerId]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_CLOSED_CUSTOMER', 'USER', customerId,
      { status: user.status, cashBalance }, { status: 'CLOSED', reason }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_STATUS_UPDATED', customerId, {
      status: 'CLOSED', reason, closedBy: req.user!.userId
    });

    res.json({
      success: true,
      message: `Account for ${user.username} has been closed. All trading history and records are preserved.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 24. CUSTOMER AUDIT TRAIL (paginated)
// ============================================================
router.get('/customers/:id/audit', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
    const offset = parseInt(req.query.offset as string || '0', 10);

    const [logs, countRow] = await Promise.all([
      query<any>(
        `SELECT al.*, u.username as actor_username 
         FROM audit_logs al
         LEFT JOIN users u ON al.actor_id = u.id
         WHERE al.actor_id = $1 OR al.resource_id = $1
         ORDER BY al.timestamp DESC
         LIMIT $2 OFFSET $3`,
        [customerId, limit, offset]
      ),
      queryOne<any>(
        `SELECT COUNT(*) as c FROM audit_logs WHERE actor_id = $1 OR resource_id = $1`,
        [customerId]
      )
    ]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_VIEWED_AUDIT', 'USER', customerId, null, null, getClientIp(req));

    res.json({ success: true, logs, total: parseInt(countRow?.c || '0'), pagination: { limit, offset } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 25. CUSTOMER LOGIN ACTIVITY
// ============================================================
router.get('/customers/:id/login-activity', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const limit = Math.min(parseInt(req.query.limit as string || '30', 10), 100);

    const sessions = await query<any>(
      `SELECT id, ip_address, user_agent, device_type, login_at, logout_at, is_active, login_result, failure_reason
       FROM login_sessions
       WHERE user_id = $1
       ORDER BY login_at DESC
       LIMIT $2`,
      [customerId, limit]
    );

    // Also get basic user security info
    const user = await queryOne<any>(
      `SELECT failed_login_attempts, locked_until, last_login_at FROM users WHERE id = $1`,
      [customerId]
    );

    res.json({
      success: true,
      sessions,
      security: {
        failedLoginAttempts: user?.failed_login_attempts || 0,
        lockedUntil: user?.locked_until || null,
        lastLoginAt: user?.last_login_at || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 26. CUSTOMER KYC DETAIL (full — for Customer360 KYC tab)
// ============================================================
router.get('/customers/:id/kyc', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;

    const [kycRecords, kycApplications] = await Promise.all([
      query<any>('SELECT * FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]),
      query<any>(
        `SELECT ka.*, 
                (SELECT json_agg(json_build_object(
                  'id', kd.id, 'document_type', kd.document_type, 
                  'original_filename', kd.original_filename, 'mime_type', kd.mime_type,
                  'file_size', kd.file_size, 'uploaded_at', kd.uploaded_at
                )) FROM kyc_documents kd WHERE kd.kyc_application_id = ka.id) as documents
         FROM kyc_applications ka WHERE ka.user_id = $1 ORDER BY ka.submitted_at DESC`,
        [customerId]
      )
    ]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_VIEWED_KYC', 'USER', customerId, null, null, getClientIp(req));

    res.json({ success: true, kycRecords, kycApplications });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 27. KYC APPROVE FOR CUSTOMER (by customer ID, not KYC record ID)
// ============================================================
router.post('/customers/:id/kyc/approve', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { notes, applicationId } = req.body;

    let targetId = applicationId;

    if (!targetId) {
      // Get the most recent pending application
      const app = await queryOne<any>(
        `SELECT id FROM kyc_applications WHERE user_id = $1 AND status IN ('PENDING','UNDER_REVIEW','SUBMITTED') ORDER BY submitted_at DESC LIMIT 1`,
        [customerId]
      );
      if (app) {
        targetId = app.id;
      } else {
        // Fall back to kyc_records
        const rec = await queryOne<any>(
          `SELECT id FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [customerId]
        );
        if (rec) {
          await execute(
            `UPDATE kyc_records SET kyc_status = 'APPROVED', verification_status = 'VERIFIED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3`,
            [req.user!.userId, notes || '', rec.id]
          );
          await execute(`UPDATE users SET is_kyc_completed = TRUE, updated_at = NOW() WHERE id = $1`, [customerId]);
          await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_APPROVED_KYC', 'USER', customerId, null, { notes }, getClientIp(req));
          adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'APPROVED' });
          res.json({ success: true, message: 'KYC approved successfully.' });
          return;
        }
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No KYC record or application found for this customer' } });
        return;
      }
    }

    await execute(
      `UPDATE kyc_applications SET status = 'APPROVED', reviewed_at = NOW(), reviewed_by = $1, rejection_reason = NULL, updated_at = NOW() WHERE id = $2`,
      [req.user!.userId, targetId]
    );
    await execute(`UPDATE users SET is_kyc_completed = TRUE, updated_at = NOW() WHERE id = $1`, [customerId]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_APPROVED_KYC', 'USER', customerId, null, { applicationId: targetId, notes }, getClientIp(req));
    adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'APPROVED' });

    res.json({ success: true, message: 'KYC approved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 28. KYC REJECT FOR CUSTOMER (by customer ID)
// ============================================================
router.post('/customers/:id/kyc/reject', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, rejectionCategory, applicationId } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason is required' } });
      return;
    }

    let targetId = applicationId;
    if (!targetId) {
      const app = await queryOne<any>(
        `SELECT id FROM kyc_applications WHERE user_id = $1 AND status NOT IN ('REJECTED') ORDER BY submitted_at DESC LIMIT 1`,
        [customerId]
      );
      if (app) {
        targetId = app.id;
      } else {
        const rec = await queryOne<any>(`SELECT id FROM kyc_records WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`, [customerId]);
        if (rec) {
          await execute(
            `UPDATE kyc_records SET kyc_status = 'REJECTED', verification_status = 'FAILED', verified_by = $1, verified_at = NOW(), notes = $2, updated_at = NOW() WHERE id = $3`,
            [req.user!.userId, reason, rec.id]
          );
          await execute(`UPDATE users SET is_kyc_completed = FALSE, updated_at = NOW() WHERE id = $1`, [customerId]);
          await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_REJECTED_KYC', 'USER', customerId, null, { reason }, getClientIp(req));
          adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'REJECTED', reason });
          res.json({ success: true, message: 'KYC rejected.' });
          return;
        }
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No KYC record found for this customer' } });
        return;
      }
    }

    await execute(
      `UPDATE kyc_applications SET status = 'REJECTED', rejection_reason = $1, rejection_category = $2, reviewed_at = NOW(), reviewed_by = $3, updated_at = NOW() WHERE id = $4`,
      [reason.trim(), rejectionCategory || null, req.user!.userId, targetId]
    );
    await execute(`UPDATE users SET is_kyc_completed = FALSE, updated_at = NOW() WHERE id = $1`, [customerId]);

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_REJECTED_KYC', 'USER', customerId, null, { reason, rejectionCategory }, getClientIp(req));
    adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'REJECTED', reason });

    res.json({ success: true, message: 'KYC rejected.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 29. KYC REQUEST RE-UPLOAD
// ============================================================
router.post('/customers/:id/kyc/request-reupload', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.params.id as string;
    const { reason, applicationId } = req.body;

    let targetId = applicationId;
    if (!targetId) {
      const app = await queryOne<any>(
        `SELECT id FROM kyc_applications WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1`,
        [customerId]
      );
      targetId = app?.id;
    }

    if (targetId) {
      await execute(
        `UPDATE kyc_applications SET status = 'RESUBMISSION_REQUIRED', rejection_reason = $1, reviewed_at = NOW(), reviewed_by = $2, updated_at = NOW() WHERE id = $3`,
        [reason || 'Additional documents required', req.user!.userId, targetId]
      );
    }

    await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_KYC_REUPLOAD_REQUESTED', 'USER', customerId, null, { reason }, getClientIp(req));
    adminEventBus.emitUserEvent('KYC_UPDATED', customerId, { kycStatus: 'RESUBMISSION_REQUIRED', reason });

    res.json({ success: true, message: 'Re-upload request sent to customer.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 30. PERMISSIONS & ROLE-BASED ACCESS CONTROL (RBAC) DASHBOARD
// ============================================================

const SYSTEM_PERMISSION_CATEGORIES = [
  {
    category: 'Financial Operations',
    description: 'Wallet credits, withdrawals, direct balance adjustments & reserve management',
    permissions: [
      { key: 'DEPOSITS_APPROVE', label: 'Approve Deposits', description: 'Review and approve client UPI, Bank, and Gateway deposit receipts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER'] },
      { key: 'WITHDRAWALS_APPROVE', label: 'Approve Withdrawals', description: 'Authorize client withdrawal payout and bank settlement transfers', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER'] },
      { key: 'DIRECT_BALANCE_ADJUST', label: 'Direct Balance Adjustment', description: 'Manually credit or debit user trading capital with audited ledger entry', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
      { key: 'PAYMENT_GATEWAYS_MANAGE', label: 'Manage Payment Gateways', description: 'Configure LinkPe merchant keys, QR codes, and bank accounts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
      { key: 'RESERVES_RECONCILE', label: 'Reserve & Solvency Audit', description: 'Audit broker physical bank cash reserves vs user aggregate liabilities', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
    ]
  },
  {
    category: 'Trading & Risk Oversight',
    description: 'Order execution, kill-switches, margin limits, and emergency square-offs',
    permissions: [
      { key: 'SIM_ORDER_CANCEL', label: 'Force-Cancel Orders', description: 'Cancel pending and executing simulated equity & derivative orders', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER'] },
      { key: 'POSITIONS_FORCE_CLOSE', label: 'Force-Liquidate Positions', description: 'Emergency market square-off open positions for margin calls', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'RISK_LIMITS_EDIT', label: 'Configure Risk Parameters', description: 'Modify margin multipliers, intraday leverage, and MTM loss limits', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'KILL_SWITCH_TRIGGER', label: 'Platform Kill Switch', description: 'Halt all order placements and market execution platform-wide', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
    ]
  },
  {
    category: 'Operations & User Management',
    description: 'Account creation, customer status freezes, KYC approvals, and credentials',
    permissions: [
      { key: 'KYC_VERIFY_APPROVE', label: 'Approve KYC Applications', description: 'Verify Aadhaar, PAN, and bank details for trading accounts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER', 'MANAGER'] },
      { key: 'KYC_REJECT', label: 'Reject / Request KYC Re-upload', description: 'Reject incomplete documents and trigger customer re-upload requests', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER'] },
      { key: 'USER_CREATE', label: 'Create New Customer', description: 'Manually provision new client profile and initial simulated capital', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { key: 'USER_LOCK_UNLOCK', label: 'Lock / Freeze Accounts', description: 'Temporarily freeze customer accounts to prevent logins and trading', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER'] },
      { key: 'USER_RESET_PASSWORD', label: 'Issue Password Resets', description: 'Generate one-time reset credentials for user account recovery', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    ]
  },
  {
    category: 'Audit, Feeds & System Security',
    description: 'Compliance audit trail, PII visibility, exchange feed credentials, and staff RBAC',
    permissions: [
      { key: 'VIEW_AUDIT_LOGS', label: 'View Immutable Audit Trail', description: 'Inspect timestamped actor logs for all admin and financial actions', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'READ_ONLY_AUDITOR'] },
      { key: 'VIEW_PII', label: 'View Unmasked PII', description: 'Access unmasked client phone numbers, emails, and KYC documentation', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER'] },
      { key: 'MARKET_DATA_CONFIG', label: 'Market Data & Feeds Config', description: 'Configure Angel One / Dhan API keys and market data download storage', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'MANAGE_ROLES_PERMISSIONS', label: 'Manage Roles & Permissions', description: 'Assign staff roles and configure user granular permission overrides', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
    ]
  }
];

// GET: System Permission Definitions & Default Matrix
router.get('/permissions/matrix', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = [
      'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 
      'OPERATIONS_MANAGER', 'KYC_OFFICER', 'DEALER', 'SUPPORT_AGENT', 'ANALYST', 
      'READ_ONLY_AUDITOR', 'USER'
    ];

    res.json({
      success: true,
      roles,
      categories: SYSTEM_PERMISSION_CATEGORIES
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET: All Users with Roles, Custom Permissions & Capacity Limits
router.get('/permissions/users', authenticateToken, checkRole(ADMIN_ROLES), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await query<any>(
      `SELECT u.id, u.username, u.email, u.full_name, u.phone_number, u.role, u.status, u.is_kyc_completed, u.created_at,
              COALESCE(ml.max_users, 100) as max_users,
              COALESCE(ml.max_exposure_per_user, 1000000) as max_exposure_per_user,
              COALESCE(ml.max_deposit_approval, 50000) as max_deposit_approval,
              COALESCE(ml.max_withdrawal_approval, 25000) as max_withdrawal_approval,
              COALESCE(ml.max_daily_loss_cap, 100000) as max_daily_loss_cap,
              COUNT(ma.user_id) as assigned_users_count
       FROM users u
       LEFT JOIN manager_limits ml ON u.id = ml.manager_id
       LEFT JOIN manager_assignments ma ON u.id = ma.manager_id
       GROUP BY u.id, ml.max_users, ml.max_exposure_per_user, ml.max_deposit_approval, ml.max_withdrawal_approval, ml.max_daily_loss_cap
       ORDER BY 
         CASE 
           WHEN u.role = 'SUPER_ADMIN' THEN 1
           WHEN u.role = 'ADMIN' THEN 2
           WHEN u.role = 'MANAGER' THEN 3
           WHEN u.role = 'FINANCE_MANAGER' THEN 4
           WHEN u.role = 'RISK_MANAGER' THEN 5
           WHEN u.role = 'OPERATIONS_MANAGER' THEN 6
           WHEN u.role = 'KYC_OFFICER' THEN 7
           WHEN u.role = 'DEALER' THEN 8
           WHEN u.role = 'SUPPORT_AGENT' THEN 9
           WHEN u.role = 'ANALYST' THEN 10
           WHEN u.role = 'READ_ONLY_AUDITOR' THEN 11
           ELSE 12
         END ASC,
         u.created_at ASC`
    );

    // Fetch granular permissions overrides
    const permissionsRows = await query<any>(
      `SELECT manager_id, permission_key, granted FROM manager_permissions`
    );

    const permMap: Record<string, Record<string, boolean>> = {};
    for (const row of permissionsRows) {
      if (!permMap[row.manager_id]) permMap[row.manager_id] = {};
      permMap[row.manager_id][row.permission_key] = row.granted;
    }

    const enrichedUsers = users.map(u => ({
      ...u,
      customPermissions: permMap[u.id] || {}
    }));

    res.json({ success: true, users: enrichedUsers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST: Assign User Role
router.post('/permissions/assign-role', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId and role are required' } });
      return;
    }

    const validRoles = [
      'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 
      'OPERATIONS_MANAGER', 'KYC_OFFICER', 'DEALER', 'SUPPORT_AGENT', 'ANALYST', 
      'READ_ONLY_AUDITOR', 'USER'
    ];

    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: `Invalid role '${role}'` } });
      return;
    }

    const target = await queryOne<any>('SELECT id, username, email, role FROM users WHERE id = $1', [userId]);
    if (!target) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    if (target.role === role) {
      res.json({ success: true, message: `User is already assigned role '${role}'` });
      return;
    }

    await execute('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, userId]);

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_CHANGED_USER_ROLE', 'USER', userId,
      { oldRole: target.role }, { newRole: role }, getClientIp(req)
    );

    adminEventBus.emitUserEvent('USER_PROFILE_UPDATED', userId, { role });

    res.json({ success: true, message: `Role for ${target.username} successfully updated to ${role}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST: Toggle Single Permission for User
router.post('/permissions/toggle-permission', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, permissionKey, granted } = req.body;
    if (!userId || !permissionKey) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId and permissionKey are required' } });
      return;
    }

    const id = 'perm_' + generateUUID();
    await execute(
      `INSERT INTO manager_permissions (id, manager_id, permission_key, granted, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (manager_id, permission_key)
       DO UPDATE SET granted = EXCLUDED.granted`,
      [id, userId, permissionKey, Boolean(granted)]
    );

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_TOGGLED_USER_PERMISSION', 'USER', userId,
      null, { permissionKey, granted: Boolean(granted) }, getClientIp(req)
    );

    res.json({ success: true, message: `Permission '${permissionKey}' updated.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST: Save User Profile, Role, Granular Permissions & Capacity Limits in One Call
router.post('/permissions/save-user-permissions', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, role, permissions, limits } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'userId is required' } });
      return;
    }

    const target = await queryOne<any>('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (!target) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    await withTransaction(async (client) => {
      // 1. Update role if specified
      if (role && role !== target.role) {
        await client.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, userId]);
      }

      // 2. Update permissions if provided
      if (permissions && typeof permissions === 'object') {
        for (const [key, val] of Object.entries(permissions)) {
          const permId = 'perm_' + generateUUID();
          await client.query(
            `INSERT INTO manager_permissions (id, manager_id, permission_key, granted, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (manager_id, permission_key)
             DO UPDATE SET granted = EXCLUDED.granted`,
            [permId, userId, key, Boolean(val)]
          );
        }
      }

      // 3. Update manager limits if provided
      if (limits && typeof limits === 'object') {
        await client.query(
          `INSERT INTO manager_limits (manager_id, max_users, max_accounts, max_exposure_per_user, max_deposit_approval, max_withdrawal_approval, max_daily_loss_cap, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (manager_id)
           DO UPDATE SET
             max_users = COALESCE(EXCLUDED.max_users, manager_limits.max_users),
             max_accounts = COALESCE(EXCLUDED.max_accounts, manager_limits.max_accounts),
             max_exposure_per_user = COALESCE(EXCLUDED.max_exposure_per_user, manager_limits.max_exposure_per_user),
             max_deposit_approval = COALESCE(EXCLUDED.max_deposit_approval, manager_limits.max_deposit_approval),
             max_withdrawal_approval = COALESCE(EXCLUDED.max_withdrawal_approval, manager_limits.max_withdrawal_approval),
             max_daily_loss_cap = COALESCE(EXCLUDED.max_daily_loss_cap, manager_limits.max_daily_loss_cap),
             updated_at = NOW()`,
          [
            userId,
            limits.maxUsers ?? 100,
            limits.maxAccounts ?? 100,
            limits.maxExposurePerUser ?? 1000000,
            limits.maxDepositApproval ?? 50000,
            limits.maxWithdrawalApproval ?? 25000,
            limits.maxDailyLossCap ?? 100000
          ]
        );
      }
    });

    await logAuditAction(
      req.user!.userId, req.user!.role,
      'ADMIN_UPDATED_USER_PERMISSIONS_AND_LIMITS', 'USER', userId,
      { oldRole: target.role }, { newRole: role, permissions, limits }, getClientIp(req)
    );

    res.json({ success: true, message: `Permissions & limits for ${target.username} saved successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 31. EMIT POSITION/TRADE EVENTS FROM EXECUTION ENGINE
// Helper: called from ExecutionEngine after trade execution
// ============================================================
export function emitAdminTradeEvent(userId: string, trade: any): void {
  adminEventBus.emitUserEvent('TRADE_EXECUTED', userId, { trade });
}

export function emitAdminPositionUpdate(userId: string, positions: any[]): void {
  adminEventBus.emitUserEvent('POSITION_UPDATED', userId, { positions });
}

export function emitAdminFundsUpdate(userId: string, wallet: any): void {
  adminEventBus.emitUserEvent('FUNDS_UPDATED', userId, { wallet });
}

export default router;
