import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { query, queryOne, execute, withTransaction } from '../db/schema';
import { authenticateToken, checkRole, checkPermission, AuthenticatedRequest, getJwtSecret, getRefreshSecret } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  RegisterSchema, LoginSchema, SubmitOrderSchema,
  AddWatchlistItemSchema, CreateWatchlistSchema,
  AdminAdjustBalanceSchema, UpdateRiskSettingSchema,
  UpdateUserStatusSchema, UpdateUserRoleSchema
} from '../middleware/schemas';
import { logAuditAction } from '../middleware/audit';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { OMS } from '../trading/OMS';
import { PortfolioService } from '../trading/PortfolioService';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { GreeksEngine } from '../marketData/GreeksEngine';
import { MarketDataStorageService } from '../services/MarketDataStorageService';
import { InstrumentMasterService } from '../marketData/InstrumentMasterService';
import { LinkPeService } from '../services/linkpeService';
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { checkDatabaseHealth } from '../db/pool';
import { kycUpload } from '../middleware/upload';
import { ClientCreationService } from '../services/ClientCreationService';

/** Helper to safely extract client IP address from request */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  return req.ip ?? '127.0.0.1';
}



const router = Router();

// ============================================================
// RATE LIMITERS (P0-5 FIX)
// ============================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 500 : 50,
  validate: { ip: false },
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 500 : 30,
  keyGenerator: (req: any) => req.user?.userId || getClientIp(req),
  validate: { ip: false, keyGeneratorIpFallback: false },
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Order submission rate limit exceeded. Max 30 orders/minute.' } }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 10000 : 2000,
  validate: { ip: false },
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'API rate limit exceeded.' } }
});

// Apply general rate limiter to all routes
router.use(apiLimiter);

// ============================================================
// 1. HEALTH & SYSTEM INFO
// ============================================================
router.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const mdProvider = MarketDataEngine.getInstance().getActiveProviderName();
  res.json({
    status: dbHealth.healthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    service: 'StockSharp Trading API',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    realMoneyTradingAllowed: SafetyLock.REAL_MONEY_TRADING_ALLOWED,
    marketDataProvider: mdProvider,
    database: { healthy: dbHealth.healthy, latencyMs: dbHealth.latencyMs, pool: dbHealth.pool, error: dbHealth.error }
  });
});

router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ALIVE', timestamp: Date.now() });
});

router.get('/health/ready', async (req: Request, res: Response) => {
  const db = await checkDatabaseHealth();
  if (!db.healthy) {
    return res.status(503).json({ ready: false, reason: 'Database connection failed', error: db.error });
  }
  res.status(200).json({ ready: true, pool: db.pool });
});

router.get('/health/dependencies', async (req: Request, res: Response) => {
  const { redis } = await import('../db/redis');
  const { getWebSocketMetrics } = await import('../websocket/server');
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await redis.getHealthMetrics();
  const wsMetrics = getWebSocketMetrics();
  const memory = process.memoryUsage();

  const dependenciesHealthy = dbHealth.healthy && (redisHealth.connected || redisHealth.mode === 'IN_MEMORY_FALLBACK');

  res.status(dependenciesHealthy ? 200 : 503).json({
    status: dependenciesHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    process: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMB: (memory.rss / 1024 / 1024).toFixed(2),
      heapUsedMB: (memory.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memory.heapTotal / 1024 / 1024).toFixed(2)
    },
    database: {
      healthy: dbHealth.healthy,
      latencyMs: dbHealth.latencyMs,
      pool: dbHealth.pool,
      error: dbHealth.error
    },
    redis: redisHealth,
    marketData: {
      activeProvider: MarketDataEngine.getInstance().getActiveProviderName(),
      cachedTicksCount: MarketDataEngine.getInstance().getAllCachedTicks().length
    },
    websocket: wsMetrics
  });
});

router.get('/health/instruments', (req, res) => {
  const status = InstrumentMasterService.getInstance().getHealthStatus();
  res.status(status.isReady ? 200 : 503).json({ success: true, ...status });
});


// ============================================================
// 2. AUTHENTICATION API
// ============================================================
router.post('/auth/register', authLimiter, validateBody(RegisterSchema), async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    const result = await ClientCreationService.createClient({
      username,
      email,
      password,
      role: 'USER',
      creatorIp: getClientIp(req)
    });

    if (!result.success || !result.user) {
      const statusCode = result.error?.code?.startsWith('DUPLICATE_') ? 409 : 400;
      res.status(statusCode).json({
        success: false,
        error: result.error
      });
      return;
    }

    const newUser = {
      id: result.user.id,
      clientId: result.user.clientId,
      username: result.user.username,
      email: result.user.email,
      role: result.user.role
    };

    const token = jwt.sign(newUser, getJwtSecret(), { expiresIn: '24h' });
    const refreshToken = jwt.sign(newUser, getRefreshSecret(), { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: newUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/login', authLimiter, validateBody(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normIdentifier = (email || '').trim();

    // Support login by normalized email, normalized username, or uppercase client_id
    const user = await queryOne<any>(
      `SELECT * FROM users 
       WHERE LOWER(TRIM(email)) = LOWER($1) 
          OR LOWER(TRIM(username)) = LOWER($1)
          OR UPPER(TRIM(client_id)) = UPPER($1)
       LIMIT 1`,
      [normIdentifier]
    );

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const until = new Date(user.locked_until).toISOString();
      res.status(423).json({ success: false, error: { code: 'ACCOUNT_LOCKED', message: `Account locked until ${until}` } });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Account is suspended or disabled' } });
      return;
    }

    // Verify password (Argon2id)
    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(user.password_hash, password);
    } catch {
      passwordValid = false;
    }

    if (!passwordValid) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      await execute(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Reset failed attempts on successful login
    await execute(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    const token = jwt.sign({ userId: user.id, username: user.username, email: user.email, role: user.role }, getJwtSecret(), { expiresIn: '24h' });
    const refreshToken = jwt.sign({ userId: user.id, username: user.username, email: user.email, role: user.role }, getRefreshSecret(), { expiresIn: '30d' });

    await logAuditAction(user.id, user.role, 'LOGIN', 'USER', user.id, null, null, getClientIp(req) ?? '127.0.0.1');

    res.json({ success: true, token, refreshToken, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
  const uRow = await queryOne<any>('SELECT id, username, email, role, full_name, phone_number, city, address, date_of_birth, is_kyc_completed, risk_restriction FROM users WHERE id = $1', [req.user!.userId]);
  const kycApp = await queryOne<any>('SELECT status FROM kyc_applications WHERE user_id = $1', [req.user!.userId]);
  const isKycOk = uRow?.is_kyc_completed || ['APPROVED', 'SUBMITTED'].includes(kycApp?.status) || ['SUPER_ADMIN', 'ADMIN'].includes(uRow?.role);

  const user = {
    id: req.user!.userId,
    userId: req.user!.userId,
    username: uRow?.username || req.user!.username,
    email: uRow?.email || req.user!.email,
    role: uRow?.role || req.user!.role,
    fullName: uRow?.full_name || '',
    phoneNumber: uRow?.phone_number || '',
    city: uRow?.city || '',
    address: uRow?.address || '',
    dateOfBirth: uRow?.date_of_birth || '',
    isKycCompleted: !!isKycOk,
    kycStatus: kycApp?.status || (isKycOk ? 'APPROVED' : 'NOT_STARTED'),
    riskRestriction: uRow?.risk_restriction || null
  };
  res.json({ success: true, user, wallet });
});

// Non-secret risk parameters a client needs to render real (not hardcoded)
// leverage/cutoff figures on Portfolio → Analytics. Deliberately not gated by
// checkPermission('RMS_VIEW') like /admin/risk-settings — that endpoint
// returns the full settings row set (including ones not meant for a client
// display) to staff only; this returns a fixed, tiny, non-secret subset to
// any authenticated user, mirroring what the UI already showed as static text.
router.get('/risk-info', authenticateToken, async (req, res) => {
  const rows = await query<any>(
    `SELECT key, value FROM system_settings WHERE key IN ('INTRADAY_LEVERAGE_MULTIPLIER', 'MIS_AUTO_SQUARE_OFF_TIME', 'MIS_AUTO_SQUARE_OFF_ENABLED')`
  );
  const byKey: Record<string, string> = {};
  rows.forEach((r) => { byKey[r.key] = r.value; });
  res.json({
    success: true,
    riskInfo: {
      intradayLeverageMultiplier: parseFloat(byKey.INTRADAY_LEVERAGE_MULTIPLIER || '5'),
      misAutoSquareOffTime: byKey.MIS_AUTO_SQUARE_OFF_TIME || '15:15',
      misAutoSquareOffEnabled: byKey.MIS_AUTO_SQUARE_OFF_ENABLED !== 'false'
    }
  });
});

router.get('/user/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const uRow = await queryOne<any>(
      'SELECT id, username, email, role, status, full_name, phone_number, city, address, date_of_birth, is_kyc_completed, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    const kycApp = await queryOne<any>('SELECT * FROM kyc_applications WHERE user_id = $1', [req.user!.userId]);
    const isKycOk = uRow?.is_kyc_completed || ['APPROVED', 'SUBMITTED'].includes(kycApp?.status) || ['SUPER_ADMIN', 'ADMIN'].includes(uRow?.role);

    res.json({
      success: true,
      profile: {
        id: uRow?.id || req.user!.userId,
        username: uRow?.username || req.user!.username,
        email: uRow?.email || req.user!.email,
        role: uRow?.role || req.user!.role,
        fullName: uRow?.full_name || '',
        phoneNumber: uRow?.phone_number || '',
        city: uRow?.city || '',
        address: uRow?.address || '',
        dateOfBirth: uRow?.date_of_birth || '',
        isKycCompleted: !!isKycOk,
        status: uRow?.status || 'ACTIVE'
      },
      kyc: kycApp || null
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/user/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { fullName, phoneNumber, city, address, dateOfBirth } = req.body;
    await execute(
      `UPDATE users
       SET full_name = $1, phone_number = $2, city = $3, address = $4, date_of_birth = $5, updated_at = NOW()
       WHERE id = $6`,
      [fullName || null, phoneNumber || null, city || null, address || null, dateOfBirth || null, req.user!.userId]
    );

    await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_PROFILE', 'USER', req.user!.userId, null, { fullName, phoneNumber, city }, getClientIp(req));

    res.json({ success: true, message: 'Personal & profile details saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'New password must be at least 6 characters long' } });
      return;
    }

    const user = await queryOne<any>('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const match = await argon2.verify(user.password_hash, currentPassword).catch(() => false);
    if (!match) {
      res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
      return;
    }

    const newHash = await argon2.hash(newPassword);
    await execute('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user!.userId]);
    await logAuditAction(req.user!.userId, req.user!.role, 'CHANGE_PASSWORD', 'USER', req.user!.userId, null, null, getClientIp(req));

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Refresh token required' } });
    return;
  }
  try {
    const decoded = jwt.verify(refreshToken, getRefreshSecret()) as any;
    const newToken = jwt.sign(
      { userId: decoded.userId, username: decoded.username, email: decoded.email, role: decoded.role },
      getJwtSecret(),
      { expiresIn: '24h' }
    );
    res.json({ success: true, token: newToken });
  } catch {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired refresh token' } });
  }
});

router.post('/auth/logout', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  await logAuditAction(req.user!.userId, req.user!.role, 'LOGOUT', 'USER', req.user!.userId, null, null, getClientIp(req) ?? '127.0.0.1');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ============================================================
// 3. MARKET DATA API
// ============================================================
router.get('/market/instruments', async (req, res) => {
  const instruments = await query('SELECT * FROM instruments WHERE active = TRUE ORDER BY symbol');
  res.json({ success: true, instruments });
});

router.get('/market/quote/:token', async (req, res) => {
  const tick = await MarketDataEngine.getInstance().getQuote(req.params.token);
  res.json({ success: true, tick: tick || null });
});

router.get('/market/candles', async (req, res) => {
  const token     = (req.query.token as string) || 'NSE_NIFTY50';
  const timeframe = (req.query.timeframe as string) || '5m';
  const count     = Math.min(parseInt(req.query.count as string || '100', 10), 500);
  const candles = await MarketDataEngine.getInstance().getHistoricalCandles(token, timeframe, count);
  // Also return the live tick LTP so the client can anchor the last candle
  // precisely without a visible price jump on first WebSocket tick.
  const liveTick = MarketDataEngine.getInstance().getCachedTick(token);
  const currentLtp = liveTick?.ltp ?? (candles.length > 0 ? candles[candles.length - 1].close : null);
  res.json({ success: true, candles, currentLtp });
});

router.get('/market/local-candles', async (req, res) => {
  const token     = (req.query.token as string) || 'NSE_NIFTY50';
  const timeframe = (req.query.timeframe as string) || '1D';
  const count     = Math.min(parseInt(req.query.count as string || '100', 10), 1000);
  const candles = await MarketDataStorageService.getLocalCandles(token, timeframe, count);
  res.json({ success: true, candles, source: 'LOCAL_SERVER_DATABASE' });
});

// ============================================================
// 3B. MARGIN & RMS CALCULATOR API (NEW)
// ============================================================
router.get('/margin/quote', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const exchange     = (req.query.exchange as string) || 'NSE';
    const underlying   = (req.query.underlying as string) || 'NIFTY';
    const expiry       = (req.query.expiry as string) || '';
    const strike       = parseFloat(req.query.strike as string || '0');
    const optionType   = (req.query.optionType as any) || (req.query.option_type as any) || 'CE';
    const side         = ((req.query.side as string) || 'BUY').toUpperCase() as 'BUY' | 'SELL';
    const quantity     = parseInt(req.query.quantity as string || '65', 10);
    const price        = parseFloat(req.query.price as string || '100');
    const productType  = (req.query.productType as any) || 'MIS';
    const instrumentToken = (req.query.instrumentToken as string) || '';

    const { marginEngineService } = await import('../services/MarginEngineService');
    const quote = await marginEngineService.calculateQuote({
      userId: req.user!.userId,
      exchange,
      underlying,
      expiry,
      strike,
      optionType,
      side,
      quantity,
      price,
      productType,
      instrumentToken,
    });

    res.json({ success: true, ...quote });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/margin/portfolio', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { marginEngineService } = await import('../services/MarginEngineService');
    const portfolioMargin = await marginEngineService.calculatePortfolioMargin(req.user!.userId);
    res.json({ success: true, ...portfolioMargin });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/market/option-chain', async (req, res) => {
  try {
    const symbol      = (req.query.symbol as string) || 'NIFTY';
    const expiry      = (req.query.expiry as string) || '';
    const strikeRange = (req.query.strikeRange as any) || '10';

    const { OptionChainEngine } = await import('../marketData/OptionChainEngine');

    // Timeout guard: reject after 40s to avoid nginx 504
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Option chain generation timed out after 40s')), 40000)
    );
    const result = await Promise.race([
      OptionChainEngine.generateOptionChain({ symbol, expiry, strikeRange }),
      timeoutPromise
    ]);

    res.json({ success: true, ...result });
  } catch (err: any) {
    const isTimeout = err.message?.includes('timed out');
    res.status(isTimeout ? 503 : 500).json({ success: false, error: err.message });
  }
});

// OpenAlgo Standard Option Chain Endpoint (POST /api/v1/optionchain)
router.post('/optionchain', async (req, res) => {
  try {
    const underlying   = req.body.underlying || req.body.symbol || 'NIFTY';
    const expiry_date  = req.body.expiry_date || req.body.expiry || '';
    const strike_count = req.body.strike_count ? String(req.body.strike_count) : '10';

    const { OptionChainEngine } = await import('../marketData/OptionChainEngine');
    const result = await OptionChainEngine.generateOptionChain({
      symbol: underlying,
      expiry: expiry_date,
      strikeRange: (strike_count as any),
    });

    const formattedChain = result.chain.map((item, idx) => {
      const dist = Math.abs(item.strikePrice - result.atmStrike);
      const stepIdx = Math.round(dist / (item.strikePrice > result.atmStrike ? (underlying.includes('SENSEX') || underlying.includes('BANK') ? 100 : 50) : 1));
      
      const getLabel = (isCE: boolean) => {
        if (item.strikePrice === result.atmStrike) return 'ATM';
        if (isCE) {
          return item.strikePrice < result.atmStrike ? `ITM${stepIdx}` : `OTM${stepIdx}`;
        } else {
          return item.strikePrice > result.atmStrike ? `ITM${stepIdx}` : `OTM${stepIdx}`;
        }
      };

      return {
        strike: item.strikePrice,
        ce: {
          symbol: `${underlying}${expiry_date}${item.strikePrice}CE`,
          label: getLabel(true),
          ltp: item.ce.ltp,
          bid: item.ce.bid,
          ask: item.ce.ask,
          open: item.ce.ltp * 0.98,
          high: item.ce.ltp * 1.05,
          low: item.ce.ltp * 0.95,
          prev_close: item.ce.ltp - item.ce.change,
          volume: item.ce.volume,
          oi: item.ce.openInterest,
          lotsize: result.lotSize,
          tick_size: 0.05
        },
        pe: {
          symbol: `${underlying}${expiry_date}${item.strikePrice}PE`,
          label: getLabel(false),
          ltp: item.pe.ltp,
          bid: item.pe.bid,
          ask: item.pe.ask,
          open: item.pe.ltp * 0.98,
          high: item.pe.ltp * 1.05,
          low: item.pe.ltp * 0.95,
          prev_close: item.pe.ltp - item.pe.change,
          volume: item.pe.volume,
          oi: item.pe.openInterest,
          lotsize: result.lotSize,
          tick_size: 0.05
        }
      };
    });

    res.json({
      status: 'success',
      underlying: result.underlying,
      underlying_ltp: result.spotPrice,
      expiry_date: result.expiry,
      atm_strike: result.atmStrike,
      chain: formattedChain
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

router.get('/market/option-expiries', async (req, res) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const { expiryCalendarService } = await import('../services/ExpiryCalendarService');
    const categorization = await expiryCalendarService.getValidExpiries(symbol);

    res.json({
      success: true,
      symbol,
      nearestExpiry: categorization.nearestExpiry,
      nextExpiry: categorization.nextExpiry,
      monthlyExpiry: categorization.monthlyExpiry,
      expiries: categorization.allExpiries,
    });
  } catch (err: any) {
    res.json({ success: false, symbol: req.query.symbol, expiries: [] });
  }
});

router.get('/market/mcx-active-contracts', async (req, res) => {
  try {
    const { MarketDataEngine } = await import('../marketData/MarketDataEngine');
    const { GreeksEngine } = await import('../marketData/GreeksEngine');
    const engine = MarketDataEngine.getInstance();

    const commodityMeta = [
      { commodity: 'CRUDEOIL', defaultSpot: 7318.00, step: 100, expiryDate: '17AUG2026', ulToken: 'MCX_CRUDEOIL' },
      { commodity: 'GOLD', defaultSpot: 151198.00, step: 1000, expiryDate: '31AUG2026', ulToken: 'MCX_GOLD' },
      { commodity: 'GOLDM', defaultSpot: 149710.00, step: 1000, expiryDate: '28AUG2026', ulToken: 'MCX_GOLDM' },
      { commodity: 'SILVERM', defaultSpot: 235000.00, step: 1000, expiryDate: '24AUG2026', ulToken: 'MCX_SILVERM' },
      { commodity: 'NATURALGAS', defaultSpot: 215.50, step: 5, expiryDate: '25AUG2026', ulToken: 'MCX_NATURALGAS' },
      { commodity: 'COPPER', defaultSpot: 845.00, step: 5, expiryDate: '28AUG2026', ulToken: 'MCX_COPPER' },
    ];

    const contracts: any[] = [];

    for (const meta of commodityMeta) {
      const ulTick = engine.getCachedTick(meta.ulToken);
      const spot = ulTick && ulTick.ltp > 0 ? ulTick.ltp : meta.defaultSpot;
      const atmStrike = Math.round(spot / meta.step) * meta.step;

      // 5 Strikes nearest to spot: -2, -1, 0 (ATM), +1, +2
      const offsets = [-2, -1, 0, 1, 2];

      for (const offset of offsets) {
        const strikePrice = atmStrike + (offset * meta.step);
        
        for (const optionType of ['PE', 'CE'] as const) {
          const token = `MCX_${meta.commodity}_${strikePrice}_${optionType}`;
          const liveTick = engine.getCachedTick(token);

          const isCall = optionType === 'CE';
          const dist = Math.abs(spot - strikePrice);
          const isITM = (isCall && strikePrice < spot) || (!isCall && strikePrice > spot);
          
          let ltp = liveTick && liveTick.ltp > 0
            ? liveTick.ltp
            : isITM
            ? Math.max(10, dist + 25)
            : Math.max(5, (meta.step * 0.4) - (dist * 0.15));
          
          ltp = Number(ltp.toFixed(2));
          const vol = liveTick && liveTick.volume > 0 ? liveTick.volume : Math.floor(Math.random() * 25000) + 5000;
          const oi = Math.floor(Math.random() * 12000) + 2000;
          const notionalTo = Number(((strikePrice * vol * 0.01) / 100).toFixed(2));
          const premiumTo = Number(((ltp * vol * 0.01) / 100).toFixed(2));

          contracts.push({
            instrument: 'OPTFUT',
            commodity: meta.commodity,
            expiryDate: meta.expiryDate,
            optionType,
            strikePrice,
            ltp,
            volumeLots: vol,
            notionalToLakhs: notionalTo,
            premiumToLakh: premiumTo,
            oiLots: oi,
            ulProductLtp: spot,
            token,
            ulToken: meta.ulToken
          });
        }
      }
    }

    res.json({ success: true, contracts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SSE: Real-time option chain push (replaces polling)
router.get('/market/option-chain/stream', async (req, res) => {
  const symbol      = (req.query.symbol as string) || 'NIFTY';
  const expiry      = (req.query.expiry as string) || '';
  const strikeRange = (req.query.strikeRange as any) || '10';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendChain = async () => {
    try {
      const { OptionChainEngine } = await import('../marketData/OptionChainEngine');
      const result = await OptionChainEngine.generateOptionChain({ symbol, expiry, strikeRange });
      res.write(`data: ${JSON.stringify({ success: true, ...result, ts: Date.now() })}\n\n`);
    } catch (_) {}
  };

  await sendChain(); // send immediately on connect
  const interval = setInterval(sendChain, 500); // push every 500ms
  req.on('close', () => clearInterval(interval));
});

// NSE summary: PCR, Max Pain, ATM (updated every 60s from NSE)
router.get('/market/option-summary', async (req, res) => {
  const symbol = (req.query.symbol as string) || 'NIFTY';
  try {
    // Dynamically import to avoid circular dependency
    const { nseOptionChainService } = await import('../marketData/NseOptionChainService');
    const summary = nseOptionChainService.getSummary(symbol.toUpperCase());
    res.json({
      success: true,
      symbol,
      ...summary,
    });
  } catch (err: any) {
    res.json({ success: false, symbol: req.query.symbol, summary: null });
  }
});

// Real-time Top Movers API: Gainers, Losers, Volume Shockers for F&O Stocks
router.get('/market/top-movers', async (req, res) => {
  try {
    const { fnOStockService } = await import('../services/FnOStockService');
    const { MarketDataEngine } = await import('../marketData/MarketDataEngine');
    const engine = MarketDataEngine.getInstance();

    const data = fnOStockService.getTopMovers();

    const updateStockWithTick = (stock: any) => {
      const liveTick = engine.getCachedTick(stock.internalToken) || engine.getCachedTick(stock.symbol);
      if (liveTick) {
        return {
          ...stock,
          price: liveTick.ltp,
          open: liveTick.open,
          high: liveTick.high,
          low: liveTick.low,
          close: liveTick.close,
          change: liveTick.change,
          changePercent: liveTick.changePercent,
          volume: liveTick.volume || stock.volume,
        };
      }
      return stock;
    };

    res.json({
      success: true,
      gainers: data.gainers.map(updateStockWithTick),
      losers: data.losers.map(updateStockWithTick),
      volumeShockers: data.volumeShockers.map(updateStockWithTick),
      allStocks: data.allStocks.map(updateStockWithTick),
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Market Candlestick Chart API — SYNTHETIC option/equity chart (Black-Scholes walk generator)
// NOTE: Real historical candles are served by GET /market/candles (above). This route generates
// synthetic candles anchored to Black-Scholes pricing for option strike charts and demo views.
router.get('/market/synthetic-candles', async (req: Request, res: Response) => {
  try {
    const rawSym = ((req.query.symbol as string) || 'NIFTY').toUpperCase().trim();
    const timeframe = (req.query.timeframe as string) || '5m';
    const limit = Math.min(parseInt(req.query.limit as string || '80', 10), 300);

    const isOption = rawSym.includes('CE') || rawSym.includes('PE') || rawSym.includes('CALL') || rawSym.includes('PUT');
    const isSensex = rawSym.includes('SENSEX');
    const isBanknifty = rawSym.includes('BANKNIFTY');

    const now = Math.floor(Date.now() / 1000);
    const intervalSec = timeframe === '1m' ? 60 : timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : 300;

    const candles = [];

    if (isOption) {
      // 1. Parse Strike & Option Type
      const numbers = rawSym.match(/\d+/g);
      const strike = (numbers && numbers.length > 0) ? parseInt(numbers[numbers.length - 1], 10) : (isSensex ? 78400 : 24500);
      const isCall = !rawSym.includes('PE') && !rawSym.includes('PUT');

      // 2. Underlying Spot Index Baseline & IV
      const underlyingSpot = isSensex ? 78338.89 : (isBanknifty ? 52200.0 : 24508.90);
      const baseIV = isSensex ? 0.212 : (isBanknifty ? 0.165 : 0.123);
      const timeToExpiryYears = 1.0 / 365.0; // 1 day to expiry

      // Generate underlying index historical OHLC movement
      let indexSpot = underlyingSpot * 0.992;
      const indexCandles = [];
      for (let i = limit; i >= 0; i--) {
        const time = now - (i * intervalSec);
        const change = (Math.random() - 0.485) * indexSpot * 0.0018;
        const open = indexSpot;
        const close = parseFloat((open + change).toFixed(2));
        const high = Math.max(open, close) + Math.abs(change) * 0.3;
        const low = Math.min(open, close) - Math.abs(change) * 0.3;

        indexCandles.push({ time, open, high, low, close });
        indexSpot = close;
      }

      // 3. Transform index OHLC to exact Black-Scholes Option OHLC
      for (const ic of indexCandles) {
        const oOpen  = GreeksEngine.calculateOptionPrice(ic.open, strike, timeToExpiryYears, isCall, baseIV);
        const oClose = GreeksEngine.calculateOptionPrice(ic.close, strike, timeToExpiryYears, isCall, baseIV);
        const oP1    = GreeksEngine.calculateOptionPrice(ic.high, strike, timeToExpiryYears, isCall, baseIV);
        const oP2    = GreeksEngine.calculateOptionPrice(ic.low, strike, timeToExpiryYears, isCall, baseIV);

        const oHigh  = Math.max(oOpen, oClose, oP1, oP2);
        const oLow   = Math.max(0.05, Math.min(oOpen, oClose, oP1, oP2));
        const volume = Math.floor(Math.random() * 25000 + 3500);

        candles.push({
          time: ic.time,
          open: Number(oOpen.toFixed(2)),
          high: Number(oHigh.toFixed(2)),
          low: Number(oLow.toFixed(2)),
          close: Number(oClose.toFixed(2)),
          volume
        });
      }
    } else {
      // Equity / Index Spot Candle Generator
      let basePrice = 2550.0;
      if (rawSym.includes('NIFTY')) basePrice = 24350.00;
      else if (rawSym.includes('SENSEX')) basePrice = 78250.00;
      else if (rawSym.includes('RELIANCE')) basePrice = 1284.70;

      let currentPrice = basePrice * 0.995;
      for (let i = limit; i >= 0; i--) {
        const time = now - (i * intervalSec);
        const change = (Math.random() - 0.485) * currentPrice * 0.0018;
        const open = currentPrice;
        const close = Math.max(1.0, parseFloat((open + change).toFixed(2)));
        const high = Math.max(open, close) + Math.abs(change) * 0.3;
        const low = Math.max(0.5, Math.min(open, close) - Math.abs(change) * 0.3);
        const volume = Math.floor(Math.random() * 15000 + 1200);

        candles.push({
          time,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume,
        });

        currentPrice = close;
      }
    }

    res.json({ success: true, symbol: rawSym, timeframe, candles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 4. ORDERS & SIMULATED TRADING API
// ============================================================
async function handleOrderSubmission(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const uRow = await queryOne<any>('SELECT is_kyc_completed, role, status FROM users WHERE id = $1', [userId]);

    // Account-status re-check at order acceptance — previously only checked
    // at login, so a suspended/disabled account could keep trading for the
    // life of its session. Same query already ran here for KYC, so this
    // costs no additional DB round trip.
    if (uRow && uRow.status !== 'ACTIVE') {
      res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is suspended or disabled' }
      });
      return;
    }

    const kycApp = await queryOne<any>('SELECT status FROM kyc_applications WHERE user_id = $1', [userId]);
    const isKycOk = uRow?.is_kyc_completed || ['APPROVED', 'SUBMITTED'].includes(kycApp?.status) || ['SUPER_ADMIN', 'ADMIN'].includes(uRow?.role);

    if (!isKycOk) {
      res.status(403).json({
        success: false,
        error: {
          code: 'KYC_REQUIRED',
          message: 'KYC Verification Required: Please complete your KYC details under Profile before placing orders.'
        }
      });
      return;
    }

    const { instrumentToken, exchange, symbol, side, quantity, price, triggerPrice, orderType, productType } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    const result = await OMS.submitOrder({
      userId: req.user!.userId, instrumentToken, exchange, symbol, side,
      quantity: parseInt(quantity, 10), price: parseFloat(price || 0),
      triggerPrice: parseFloat(triggerPrice || 0), orderType, productType,
      idempotencyKey
    });

    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'ORDER_REJECTED', message: result.error } });
      return;
    }

    res.json({ success: true, orderId: result.orderId, message: 'Simulated Order Accepted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
}

router.post('/orders', authenticateToken, orderLimiter, validateBody(SubmitOrderSchema), handleOrderSubmission);

// Alias kept for backward compatibility — delegates to the same handler as /orders
router.post('/orders/place', authenticateToken, orderLimiter, validateBody(SubmitOrderSchema), handleOrderSubmission);

router.get('/orders', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const limit  = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const todayOnly = req.query.todayOnly !== 'false';
  const orders = await OMS.getUserOrders(req.user!.userId, limit, offset, todayOnly);
  res.json({ success: true, orders, pagination: { limit, offset } });
});

router.delete('/orders/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const result = await OMS.cancelOrder(req.params.id as string, req.user!.userId);
  if (!result.success) {
    res.status(400).json({ success: false, error: { code: 'CANCEL_FAILED', message: result.error } });
    return;
  }
  res.json({ success: true, message: 'Order Cancelled' });
});

router.post('/orders/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const result = await OMS.cancelOrder(req.params.id as string, req.user!.userId);
  if (!result.success) {
    res.status(400).json({ success: false, error: { code: 'CANCEL_FAILED', message: result.error } });
    return;
  }
  res.json({ success: true, message: 'Order Cancelled' });
});

router.put('/orders/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const price = parseFloat(req.body.price || '0');
    const quantity = parseInt(req.body.quantity || '0', 10);
    const result = await OMS.modifyOrder(req.params.id as string, req.user!.userId, price, quantity);
    if (!result.success) {
      res.status(400).json({ success: false, error: { code: 'MODIFY_FAILED', message: result.error } });
      return;
    }
    res.json({ success: true, message: 'Order Modified' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 5. PORTFOLIO, POSITIONS & HOLDINGS API
// ============================================================
router.get('/portfolio/wallet', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
  const ledger = await query(
    'SELECT * FROM wallet_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.user!.userId]
  );
  res.json({ success: true, wallet, ledger });
});

router.get('/portfolio/positions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const todayOnly = req.query.todayOnly !== 'false';
  const positions = await PortfolioService.getUserPositions(req.user!.userId, todayOnly);
  res.json({ success: true, positions });
});

router.post('/portfolio/positions/clear', authenticateToken, async (req: AuthenticatedRequest, res) => {
  await PortfolioService.clearOldPositions(req.user!.userId);
  const positions = await PortfolioService.getUserPositions(req.user!.userId, true);
  res.json({ success: true, message: "Cleared old/closed positions", positions });
});

router.get('/portfolio/holdings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const holdings = await PortfolioService.getUserHoldings(req.user!.userId);
  res.json({ success: true, holdings });
});

router.get('/portfolio/closed-trades', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const todayOnly = req.query.todayOnly !== 'false';
  const closedTrades = await PortfolioService.getClosedTrades(req.user!.userId, limit, offset, todayOnly);
  res.json({ success: true, closedTrades });
});

// ============================================================
// 5B. CLIENT FUND DEPOSIT & WITHDRAWAL REQUESTS
// ============================================================
router.post('/funds/request', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestType, amount, paymentMethod, referenceNote } = req.body;
    const reqAmount = parseFloat(amount);

    if (!requestType || !['DEPOSIT', 'WITHDRAWAL'].includes(requestType)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Request type must be DEPOSIT or WITHDRAWAL' } });
      return;
    }

    if (isNaN(reqAmount) || reqAmount <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than ₹0' } });
      return;
    }

    if (requestType === 'WITHDRAWAL') {
      const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
      if (!wallet || wallet.buyingPower < reqAmount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient available funds for withdrawal. Available: ₹${wallet?.buyingPower.toFixed(2) || '0.00'}`
          }
        });
        return;
      }
    }

    const id = 'freq_' + generateUUID();
    const requestId = 'REQ' + generateUUID().slice(0, 8).toUpperCase();

    await execute(
      `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
      [id, requestId, req.user!.userId, requestType, reqAmount, paymentMethod || 'BANK_TRANSFER', referenceNote || '']
    );

    res.json({
      success: true,
      requestId,
      message: `${requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} request for ₹${reqAmount.toLocaleString('en-IN')} submitted. Pending Admin approval.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/funds/my-requests', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const requests = await query<any>(
      'SELECT * FROM fund_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user!.userId]
    );
    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/instant', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestType, amount, paymentMethod, referenceNote } = req.body;
    const reqAmount = parseFloat(amount);

    if (!requestType || !['DEPOSIT', 'WITHDRAWAL'].includes(requestType)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_TYPE', message: 'Request type must be DEPOSIT or WITHDRAWAL' } });
      return;
    }

    if (isNaN(reqAmount) || reqAmount <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than ₹0' } });
      return;
    }

    if (requestType === 'WITHDRAWAL') {
      const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
      if (!wallet || wallet.buyingPower < reqAmount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_FUNDS',
            message: `Insufficient available funds for withdrawal. Available: ₹${wallet?.buyingPower.toFixed(2) || '0.00'}`
          }
        });
        return;
      }
    }

    const id = 'freq_' + generateUUID();
    const requestId = 'REQ' + generateUUID().slice(0, 8).toUpperCase();

    if (requestType === 'DEPOSIT') {
      await VirtualWalletLedger.adminAdjustBalance(req.user!.userId, reqAmount, req.user!.userId, 'Capital Deposit');
      await execute(
        `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note)
         VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6, $7)`,
        [id, requestId, req.user!.userId, requestType, reqAmount, paymentMethod || 'INSTANT', referenceNote || 'Submitted via Client App']
      );

      res.json({
        success: true,
        requestId,
        message: `₹${reqAmount.toLocaleString('en-IN')} capital deposited successfully!`
      });
      return;
    }

    await execute(
      `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
      [id, requestId, req.user!.userId, requestType, reqAmount, paymentMethod || 'INSTANT', referenceNote || 'Submitted via Client App']
    );

    res.json({
      success: true,
      requestId,
      message: `Fund ${requestType.toLowerCase()} request for ₹${reqAmount.toLocaleString('en-IN')} submitted. Pending Admin approval.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/reset-margin', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Previously zeroed used_margin/realized_pnl/unrealized_pnl unconditionally
    // for any authenticated user, with no check for real open exposure — a
    // user with a live losing position could erase it from their own wallet
    // figures without ever closing it. Block the reset while anything is open.
    const [openPosition, pendingOrder] = await Promise.all([
      queryOne<any>('SELECT id FROM positions WHERE user_id = $1 AND net_qty != 0 LIMIT 1', [userId]),
      queryOne<any>(`SELECT id FROM orders WHERE user_id = $1 AND status IN ('ACCEPTED','PENDING','EXECUTING') LIMIT 1`, [userId]),
    ]);
    if (openPosition || pendingOrder) {
      res.status(409).json({
        success: false,
        error: { code: 'OPEN_EXPOSURE', message: 'Cannot reset balance while positions or orders are open. Close them first.' }
      });
      return;
    }

    const defaultCapital = parseFloat(process.env.DEFAULT_VIRTUAL_CAPITAL || '1000000');
    // B1 fix: the balance UPDATE and the ledger INSERT used to be two separate unprotected
    // statements (no lock, no shared transaction) — a crash or transient DB error between them
    // would leave the balance silently changed with no ledger row explaining it. The ledger row
    // also hardcoded balance_before to 0 regardless of the wallet's actual prior balance, which
    // is simply false whenever a user had any nonzero balance before resetting. Fixed by locking
    // the wallet row, using its real prior value, and writing both in one transaction.
    let balanceBefore = 0;
    await withTransaction(async (client: any) => {
      const walletRow = await client.query('SELECT cash_balance FROM virtual_wallets WHERE user_id = $1 FOR UPDATE', [userId]);
      balanceBefore = parseFloat(walletRow.rows[0]?.cash_balance || '0');

      await client.query(
        `UPDATE virtual_wallets SET cash_balance = $1, realized_pnl = 0, unrealized_pnl = 0, updated_at = NOW() WHERE user_id = $2`,
        [defaultCapital, userId]
      );
      await client.query(
        `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, reference_id, created_by, metadata)
         VALUES ($1, $2, $3, 'MARGIN_RESET', $4, $5, $6, $7, $8, $9)`,
        ['led_' + generateUUID(), generateUUID(), userId, defaultCapital, balanceBefore, defaultCapital, userId, userId, JSON.stringify({ reason: 'Margin & Balance Reset' })]
      );
    });
    // No open positions/orders were confirmed above, so this resolves to 0 —
    // routed through the authoritative recompute rather than hardcoding it.
    await VirtualWalletLedger.recomputeUsedMarginForUser(userId);
    res.json({ success: true, message: `Balance reset to ₹${defaultCapital.toLocaleString('en-IN')}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/funds/add-capital', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount } = req.body;
    const addAmt = parseFloat(amount) || 100000;
    const userId = req.user!.userId;
    if (addAmt <= 0) {
      res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than ₹0' } });
      return;
    }
    const updatedWallet = await VirtualWalletLedger.adminAdjustBalance(userId, addAmt, userId, 'Capital Top-up');
    res.json({
      success: true,
      message: `Successfully added ₹${addAmt.toLocaleString('en-IN')} capital.`,
      wallet: updatedWallet
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ============================================================
// 6. WATCHLISTS & ALERTS API (P2-7 FIX: IDOR ownership checks)
// ============================================================
router.get('/watchlists', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const watchlists = await query<any>('SELECT * FROM watchlists WHERE user_id = $1', [req.user!.userId]);
  for (const wl of watchlists) {
    wl.items = await query('SELECT * FROM watchlist_items WHERE watchlist_id = $1 ORDER BY sort_order', [wl.id]);
  }
  res.json({ success: true, watchlists });
});

router.post('/watchlists', authenticateToken, validateBody(CreateWatchlistSchema), async (req: AuthenticatedRequest, res) => {
  const { name } = req.body;
  const wlId = 'wl_' + generateUUID();
  await execute('INSERT INTO watchlists (id, user_id, name) VALUES ($1, $2, $3)', [wlId, req.user!.userId, name]);
  res.json({ success: true, watchlistId: wlId });
});

router.post('/watchlists/items', authenticateToken, validateBody(AddWatchlistItemSchema), async (req: AuthenticatedRequest, res) => {
  const { watchlistId, instrumentToken, symbol, exchange } = req.body;

  // Ownership check â€” P2-7 FIX
  const watchlist = await queryOne<any>(
    'SELECT id FROM watchlists WHERE id = $1 AND user_id = $2',
    [watchlistId, req.user!.userId]
  );
  if (!watchlist) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Watchlist not found' } });
    return;
  }

  const itemId = 'wli_' + generateUUID();
  await execute(
    'INSERT INTO watchlist_items (id, watchlist_id, instrument_token, symbol, exchange) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (watchlist_id, instrument_token) DO NOTHING',
    [itemId, watchlistId, instrumentToken, symbol, exchange]
  );
  res.json({ success: true, itemId });
});

router.delete('/watchlists/items/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  // P2-7 FIX: Ownership check prevents IDOR
  const item = await queryOne<any>(
    `SELECT wi.id FROM watchlist_items wi
     JOIN watchlists w ON w.id = wi.watchlist_id
     WHERE wi.id = $1 AND w.user_id = $2`,
    [req.params.id, req.user!.userId]
  );

  if (!item) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Watchlist item not found' } });
    return;
  }

  await execute('DELETE FROM watchlist_items WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ============================================================
// 7. ADMIN API
// ============================================================
router.get('/admin/dashboard', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res) => {
  const [totalUsersRow, activeOrdersRow, totalExecRow, capitalRow] = await Promise.all([
    queryOne<any>('SELECT COUNT(*) as c FROM users'),
    queryOne<any>(`SELECT COUNT(*) as c FROM orders WHERE status IN ('ACCEPTED','PENDING')`),
    queryOne<any>('SELECT COUNT(*) as c FROM executions'),
    queryOne<any>('SELECT SUM(cash_balance) as s FROM virtual_wallets')
  ]);

  res.json({
    success: true,
    telemetry: {
      totalUsers:           parseInt(totalUsersRow?.c || '0'),
      activeOrdersToday:    parseInt(activeOrdersRow?.c || '0'),
      totalExecutionsToday: parseInt(totalExecRow?.c || '0'),
      totalVirtualCapital:  parseFloat(capitalRow?.s || '0'),
      marketDataProvider:   MarketDataEngine.getInstance().getActiveProviderName(),
      systemHealth:         'OPERATIONAL',
      safetyLockActive:     true
    }
  });
});

router.get('/admin/users', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER']), async (req: AuthenticatedRequest, res) => {
  const limit  = Math.min(parseInt(req.query.limit as string || '50', 10), 200);
  const offset = parseInt(req.query.offset as string || '0', 10);

  const users = await query(
    `SELECT u.id, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at,
            w.cash_balance, w.used_margin
     FROM users u
     LEFT JOIN virtual_wallets w ON u.id = w.user_id
     ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json({ success: true, users, pagination: { limit, offset } });
});

router.post('/admin/users/:id/adjust-balance', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), validateBody(AdminAdjustBalanceSchema), async (req: AuthenticatedRequest, res) => {
  const { amount, reason } = req.body;
  const targetUserId = req.params.id as string;

  const user = await queryOne<any>('SELECT id FROM users WHERE id = $1', [targetUserId]);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const updatedWallet = await VirtualWalletLedger.adminAdjustBalance(targetUserId, parseFloat(amount), req.user!.userId, reason);
  await logAuditAction(req.user!.userId, req.user!.role, 'ADMIN_ADJUST_BALANCE', 'VIRTUAL_WALLET', targetUserId, null, { amount, reason }, getClientIp(req));
  res.json({ success: true, wallet: updatedWallet });
});

router.post('/admin/users/:id/status', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), validateBody(UpdateUserStatusSchema), async (req: AuthenticatedRequest, res) => {
  const { status, reason } = req.body;
  await execute('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
  await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_USER_STATUS', 'USER', req.params.id as string, null, { status, reason }, getClientIp(req));
  res.json({ success: true });
});

router.post('/admin/users/:id/role', authenticateToken, checkRole(['SUPER_ADMIN']), validateBody(UpdateUserRoleSchema), async (req: AuthenticatedRequest, res) => {
  const { role } = req.body;
  await execute('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, req.params.id]);
  await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_USER_ROLE', 'USER', req.params.id as string, null, { role }, getClientIp(req));
  res.json({ success: true });
});

router.get('/admin/audit-logs', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'READ_ONLY_AUDITOR']), async (req: AuthenticatedRequest, res) => {
  const limit  = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const logs = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2', [limit, offset]);
  res.json({ success: true, logs, pagination: { limit, offset } });
});

router.get('/admin/risk-settings', authenticateToken, checkPermission('RMS_VIEW'), async (req, res) => {
  const settings = await query('SELECT key, value, description, updated_at FROM system_settings WHERE is_secret = FALSE');
  res.json({ success: true, settings });
});

router.post('/admin/risk-settings', authenticateToken, checkPermission('RISK_LIMITS_EDIT'), validateBody(UpdateRiskSettingSchema), async (req: AuthenticatedRequest, res) => {
  const { key, value } = req.body;

  // Guard: Never allow disabling safety lock through API
  if (key === 'REAL_MONEY_TRADING') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'REAL_MONEY_TRADING setting cannot be modified via API. It is permanently locked to false.' } });
    return;
  }

  await execute('UPDATE system_settings SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3', [value, req.user!.userId, key]);
  await logAuditAction(req.user!.userId, req.user!.role, 'UPDATE_RISK_SETTING', 'SYSTEM_SETTING', key, null, { value }, getClientIp(req));
  res.json({ success: true });
});

router.post('/admin/instruments/sync', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await InstrumentMasterService.getInstance().syncMasterData();
    await logAuditAction(req.user!.userId, req.user!.role, 'SYNC_INSTRUMENT_MASTER', 'INSTRUMENT_MASTER', result.versionId, null, result, getClientIp(req));
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin/instruments/versions', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'READ_ONLY_AUDITOR']), async (req, res) => {
  const versions = await query('SELECT * FROM instrument_master_versions ORDER BY created_at DESC LIMIT 20');
  res.json({ success: true, versions });
});

// ============================================================
// 6. CUSTOMER KYC & PROFILE VERIFICATION API
// ============================================================
router.get('/kyc/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const kycApp = await queryOne<any>(
      'SELECT * FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user!.userId]
    );

    if (!kycApp) {
      res.json({
        success: true,
        status: 'NOT_STARTED',
        application: null,
        documents: []
      });
      return;
    }

    const documents = await query(
      'SELECT id, document_type, original_filename, mime_type, file_size, uploaded_at FROM kyc_documents WHERE kyc_application_id = $1',
      [kycApp.id]
    );

    res.json({
      success: true,
      status: kycApp.status,
      application: kycApp,
      documents
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post(
  '/kyc/submit',
  authenticateToken,
  kycUpload.fields([
    { name: 'panDoc', maxCount: 1 },
    { name: 'panDocument', maxCount: 1 },
    { name: 'aadhaarFrontDoc', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBackDoc', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'bankProofDoc', maxCount: 1 },
    { name: 'bankProof', maxCount: 1 }
  ]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { panNumber, aadhaarNumber, bankAccountName, bankAccountNumber, bankIfsc, bankName } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (!panNumber || !aadhaarNumber) {
        res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'PAN and Aadhaar numbers are required' } });
        return;
      }

      let kycApp = await queryOne<any>(
        'SELECT * FROM kyc_applications WHERE user_id = $1 AND status IN (\'SUBMITTED\', \'UNDER_REVIEW\', \'APPROVED\')',
        [req.user!.userId]
      );

      if (kycApp && kycApp.status === 'APPROVED') {
        res.status(400).json({ success: false, error: { code: 'ALREADY_APPROVED', message: 'Your KYC is already approved' } });
        return;
      }

      const appId = kycApp ? kycApp.id : 'kyc_' + generateUUID();

      if (!kycApp) {
        await execute(
          `INSERT INTO kyc_applications (id, user_id, pan_number, aadhaar_number, bank_account_name, bank_account_number, bank_ifsc, bank_name, status, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUBMITTED', NOW())`,
          [appId, req.user!.userId, panNumber, aadhaarNumber, bankAccountName || '', bankAccountNumber || '', bankIfsc || '', bankName || '']
        );
      } else {
        await execute(
          `UPDATE kyc_applications
           SET pan_number = $1, aadhaar_number = $2, bank_account_name = $3, bank_account_number = $4, bank_ifsc = $5, bank_name = $6, status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
           WHERE id = $7`,
          [panNumber, aadhaarNumber, bankAccountName || '', bankAccountNumber || '', bankIfsc || '', bankName || '', appId]
        );
      }

      // Record uploaded document entries
      if (files) {
        const docConfigs = [
          { keys: ['panDoc', 'panDocument'], type: 'PAN_CARD' },
          { keys: ['aadhaarFrontDoc', 'aadhaarFront'], type: 'AADHAAR_FRONT' },
          { keys: ['aadhaarBackDoc', 'aadhaarBack'], type: 'AADHAAR_BACK' },
          { keys: ['bankProofDoc', 'bankProof'], type: 'BANK_PROOF' }
        ];

        for (const item of docConfigs) {
          let fileObj: Express.Multer.File | undefined;
          for (const k of item.keys) {
            if (files[k] && files[k].length > 0) {
              fileObj = files[k][0];
              break;
            }
          }

          if (fileObj) {
            // Remove previous document of this type for this application before inserting the updated one
            await execute(
              `DELETE FROM kyc_documents WHERE kyc_application_id = $1 AND document_type = $2`,
              [appId, item.type]
            );

            await execute(
              `INSERT INTO kyc_documents (id, kyc_application_id, document_type, file_path, original_filename, mime_type, file_size)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              ['doc_' + generateUUID(), appId, item.type, fileObj.path, fileObj.originalname, fileObj.mimetype, fileObj.size]
            );
          }
        }
      }

      await logAuditAction(req.user!.userId, req.user!.role, 'SUBMIT_KYC', 'KYC_APPLICATION', appId, null, { panNumber, aadhaarNumber }, getClientIp(req));

      res.json({ success: true, message: 'KYC application and documents submitted successfully for review.' });
    } catch (err: any) {
      console.error('[KYC Submit Error]', err);
      res.status(500).json({ success: false, error: { message: err.message || 'Internal server error while submitting KYC' } });
    }
  }
);

// ============================================================
// 7. 24x7 CUSTOMER SUPPORT TICKETING API
// ============================================================
router.get('/support/tickets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tickets = await query(
      'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user!.userId]
    );
    res.json({ success: true, tickets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/support/tickets', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, priority, subject, description } = req.body;

    if (!subject || !description) {
      res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Subject and description are required' } });
      return;
    }

    const ticketId = 'tkt_' + generateUUID();
    await execute(
      `INSERT INTO support_tickets (id, user_id, category, priority, subject, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')`,
      [ticketId, req.user!.userId, category || 'GENERAL', priority || 'MEDIUM', subject, description]
    );

    res.status(201).json({ success: true, ticketId, message: 'Support ticket submitted successfully. Our team will respond shortly.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin/feature-flags', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  const flags = await query('SELECT * FROM feature_flags ORDER BY key');
  res.json({ success: true, flags });
});

// ============================================================
// LINKPE UPI PAYMENT GENERATION API
// ============================================================
router.get('/funds/upi-link', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const amount = parseFloat(req.query.amount as string || '100');
    const note = req.query.note as string || undefined;

    const paymentDetails = await LinkPeService.generatePaymentLink(amount, req.user!.userId, note);

    res.json({
      success: true,
      payment: paymentDetails
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// CLIENT FUND DEPOSIT & WITHDRAWAL REQUESTS (LINKPE UPI WORKFLOW)
// ============================================================
router.post('/funds/request', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestType = 'DEPOSIT', amount, paymentMethod = 'LINKPE_UPI', referenceNote = '' } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount < 100) {
      res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Minimum deposit amount is ₹100' } });
      return;
    }

    const reqId = 'freq_' + generateUUID();
    const publicReqId = 'REQ-' + Math.floor(100000 + Math.random() * 900000);

    await execute(
      `INSERT INTO fund_requests (id, request_id, user_id, request_type, amount, status, payment_method, reference_note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7, NOW(), NOW())`,
      [reqId, publicReqId, req.user!.userId, requestType, numAmount, paymentMethod, referenceNote]
    );

    res.status(201).json({
      success: true,
      requestId: publicReqId,
      message: `Deposit request of ₹${numAmount.toLocaleString('en-IN')} submitted successfully! Admin approval is pending.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/funds/my-requests', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await query(
      `SELECT * FROM fund_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.userId]
    );
    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

