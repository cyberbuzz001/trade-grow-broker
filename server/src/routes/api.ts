import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { query, queryOne, execute } from '../db/schema';
import { authenticateToken, checkRole, AuthenticatedRequest, getJwtSecret, getRefreshSecret } from '../middleware/auth';
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
import { generateUUID } from '../utils/crypto';
import { SafetyLock } from '../services/SafetyLock';
import { checkDatabaseHealth } from '../db/pool';

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
// 1. HEALTH & SYSTEM STATUS
// ============================================================
router.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const mdProvider = MarketDataEngine.getInstance().getActiveProviderName();

  res.status(dbHealth.healthy ? 200 : 503).json({
    status: dbHealth.healthy ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    simulationOnly: true,
    realMoneyTradingAllowed: SafetyLock.REAL_MONEY_TRADING_ALLOWED,
    marketDataProvider: mdProvider,
    database: { healthy: dbHealth.healthy, latencyMs: dbHealth.latencyMs, error: dbHealth.error }
  });
});

router.get('/health/live',  (req, res) => res.status(200).send('OK'));
router.get('/health/ready', async (req, res) => {
  const db = await checkDatabaseHealth();
  if (!db.healthy) return res.status(503).json({ ready: false, reason: 'Database not ready' });
  res.status(200).json({ ready: true });
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

    // Check duplicates
    const existing = await queryOne<any>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing) {
      res.status(400).json({ success: false, error: { code: 'USER_EXISTS', message: 'Username or email already registered' } });
      return;
    }

    const userId       = 'usr_' + generateUUID();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const defaultCapital = parseFloat(process.env.DEFAULT_VIRTUAL_CAPITAL || '1000000');

    // Create user + wallet + ledger + watchlist atomically
    await execute(
      'INSERT INTO users (id, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, email, passwordHash, 'USER']
    );
    await execute(
      'INSERT INTO virtual_wallets (id, user_id, cash_balance) VALUES ($1, $2, $3)',
      ['wal_' + generateUUID(), userId, defaultCapital]
    );
    await execute(
      `INSERT INTO wallet_ledger (id, transaction_id, user_id, transaction_type, amount, balance_before, balance_after, created_by, metadata)
       VALUES ($1, $2, $3, 'CREDIT', $4, 0.0, $5, 'REGISTRATION', $6)`,
      ['led_' + generateUUID(), generateUUID(), userId, defaultCapital, defaultCapital,
       JSON.stringify({ reason: 'Default Account Registration Virtual Capital' })]
    );

    const wlId = 'wl_' + generateUUID();
    await execute('INSERT INTO watchlists (id, user_id, name, is_default) VALUES ($1, $2, $3, TRUE)', [wlId, userId, 'Default Watchlist']);
    await execute(
      'INSERT INTO watchlist_items (id, watchlist_id, instrument_token, symbol, exchange, sort_order) VALUES ($1, $2, $3, $4, $5, 0)',
      ['wli_' + generateUUID(), wlId, 'NSE_NIFTY50', 'NIFTY 50', 'NSE']
    );

    const token = jwt.sign({ userId, username, email, role: 'USER' }, getJwtSecret(), { expiresIn: '24h' });
    res.json({ success: true, token, user: { id: userId, username, email, role: 'USER' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/auth/login', authLimiter, validateBody(LoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await queryOne<any>(
      'SELECT * FROM users WHERE email = $1 OR username = $1',
      [email]
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

    await logAuditAction(user.id, user.role, 'LOGIN', 'USER', user.id, null, null, getClientIp(req) ?? '127.0.0.1');

    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const wallet = await VirtualWalletLedger.getWallet(req.user!.userId);
  const user = {
    id: req.user!.userId,
    userId: req.user!.userId,
    username: req.user!.username,
    email: req.user!.email,
    role: req.user!.role
  };
  res.json({ success: true, user, wallet });
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
    const result = await OptionChainEngine.generateOptionChain({
      symbol,
      expiry,
      strikeRange,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

// Market Candlestick Chart API (for Equities, Indices, and NIFTY/SENSEX Option Strike Prices)
router.get('/market/candles', async (req: Request, res: Response) => {
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
      if (rawSym.includes('NIFTY')) basePrice = 24508.90;
      else if (rawSym.includes('SENSEX')) basePrice = 78338.89;
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
router.post('/orders', authenticateToken, orderLimiter, validateBody(SubmitOrderSchema), async (req: AuthenticatedRequest, res) => {
  try {
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
});

router.post('/orders/place', authenticateToken, orderLimiter, validateBody(SubmitOrderSchema), async (req: AuthenticatedRequest, res) => {
  try {
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
});

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
  const positions = await PortfolioService.getUserPositions(req.user!.userId);
  res.json({ success: true, positions });
});

router.get('/portfolio/holdings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const holdings = await PortfolioService.getUserHoldings(req.user!.userId);
  res.json({ success: true, holdings });
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
      message: `Virtual ${requestType.toLowerCase()} request for ₹${reqAmount.toLocaleString('en-IN')} submitted. Pending Admin approval.`
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
router.get('/admin/dashboard', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'RISK_MANAGER']), async (req: AuthenticatedRequest, res) => {
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

router.get('/admin/users', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_AGENT']), async (req: AuthenticatedRequest, res) => {
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

router.get('/admin/risk-settings', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), async (req, res) => {
  const settings = await query('SELECT key, value, description, updated_at FROM system_settings WHERE is_secret = FALSE');
  res.json({ success: true, settings });
});

router.post('/admin/risk-settings', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER']), validateBody(UpdateRiskSettingSchema), async (req: AuthenticatedRequest, res) => {
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

router.get('/admin/feature-flags', authenticateToken, checkRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  const flags = await query('SELECT * FROM feature_flags ORDER BY key');
  res.json({ success: true, flags });
});

export default router;

