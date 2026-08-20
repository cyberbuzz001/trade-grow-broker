import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// P0-3 FIX: Validate critical environment variables before any other imports
import { validateStartupEnvironment } from './middleware/auth';
validateStartupEnvironment();

import { seedDatabase } from './db/init';
import { MarketDataEngine } from './marketData/MarketDataEngine';
import { ExecutionEngine } from './trading/ExecutionEngine';
import { setupWebSocketServer } from './websocket/server';
import apiRouter from './routes/api';
import adminApiRouter from './routes/adminApi';
import { SafetyLock } from './services/SafetyLock';
import { startCronJobs, stopCronJobs } from './utils/cronJobs';
import { setDhanAdapterRef } from './utils/dhanTokenRefresh';

// Technical Assertion Lock on Server Startup
SafetyLock.assertSimulationOnly('ServerStartup');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ============================================================
// P1-5: Helmet.js Security Headers
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "unpkg.com"],
      styleSrc:      ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:       ["'self'", "fonts.gstatic.com"],
      imgSrc:        ["'self'", "data:", "blob:"],
      connectSrc:    ["'self'", "ws:", "wss:"],
      frameSrc:      ["'none'"],
      objectSrc:     ["'none'"]
    }
  },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  noSniff:        true,
  xssFilter:      true,
  frameguard:     { action: 'deny' }
}));

// ============================================================
// P1-9: Explicit CORS — restrict to known origins
// ============================================================
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no origin header)
    if (!origin) return callback(null, true);
    // Allow any localhost origin (any port) for local development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    // Allow explicitly whitelisted origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin '${origin}' is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID']
}));


// JSON Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Register REST API Routes
app.use('/api/v1', apiRouter);
app.use('/api/v1/admin', adminApiRouter);

// Global JSON error handler for all /api routes (Multer errors, parse errors, uncaught errors)
app.use('/api', (err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    console.error('[API Handler Error]', err.message || err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = err.status || err.statusCode || (err.name === 'MulterError' ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || (err.name === 'MulterError' ? 'UPLOAD_ERROR' : 'INTERNAL_ERROR'),
        message: err.message || 'An unexpected error occurred during request processing'
      }
    });
  }
  next();
});

// ============================================================
// Startup: DB Init, Immediate Port Binding & Non-Blocking Async Services
// ============================================================
async function startServer() {
  try {
    // 1. Initialize database schema & migrations (fast)
    await seedDatabase();

    // 2. Serve Frontend Static Files in Production
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
        if (err) res.status(200).send('Trade Grow — Smart Trading Platform API Running. Client build pending.');
      });
    });

    // 3. Start HTTP Server IMMEDIATELY to prevent NGINX 504 Gateway Time-outs
    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🌱 TRADE GROW — SMART TRADING PLATFORM LISTENING ON PORT ${PORT}`);
      console.log(`🔒 SAFETY MODE: VIRTUAL PAPER TRADING ONLY (REAL MONEY DISABLED)`);
      console.log(`📊 MARKET DATA: ${MarketDataEngine.getInstance().getActiveProviderName()}`);
      console.log(`🛡️  SECURITY: Helmet.js, CORS restricted, Rate limiting active`);
      console.log(`=======================================================`);
    });

    // 4. Run Heavy Market Data Engines & Background Services Asynchronously (Non-Blocking)
    (async () => {
      try {
        const { InstrumentMasterService } = await import('./marketData/InstrumentMasterService');
        await InstrumentMasterService.getInstance().initializeOnStartup();

        await MarketDataEngine.getInstance().initialize();

        // NSE scraper & AccuracyCheck DISABLED — Dhan provides all data
        // import('./services/ReconciliationMonitorService') — keep monitor but at 5 min interval
        import('./services/ReconciliationMonitorService')
          .then(({ reconciliationMonitor }) => reconciliationMonitor.start(300000))
          .catch((err) => console.error('[Startup] Failed to start ReconciliationMonitorService:', err.message));

        // AccuracyCheckService DISABLED — comparing model vs Dhan data directly
        // NseOptionChainService DISABLED — NSE scraper blocked (HTTP 404), Dhan handles option chain

        ExecutionEngine.start();
        setupWebSocketServer(server);

        const engine = MarketDataEngine.getInstance();
        const dhanProvider = (engine as any).providers?.get('DHAN');
        if (dhanProvider && typeof dhanProvider.getAccessToken === 'function') {
          setDhanAdapterRef(dhanProvider);
          startCronJobs(() => dhanProvider.getAccessToken());
          console.log('[Startup] ✅ Dhan token cron jobs started (30-min expiry check + 08:30 AM IST reminder).');
        } else {
          console.warn('[Startup] ⚠️ DhanAdapter not found — cron jobs not started.');
        }

        // Start Memory Watchdog (60s interval)
        const { memoryWatchdog } = await import('./services/MemoryWatchdogService');
        memoryWatchdog.start(60000);

        // Start Post-Trade Margin Reconciliation Sweep (1 hr interval)
        const { marginReconciliationJob } = await import('./services/MarginReconciliationJob');
        marginReconciliationJob.start(3600000);

        console.log('[Startup] ✅ All background market data engines, watchdog & WebSocket services initialized cleanly.');
      } catch (bgErr: any) {
        console.error('[Startup Background Warning]', bgErr.message || bgErr);
      }
    })();

  } catch (err: any) {
    console.error('[FATAL] Server startup failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

startServer();

export { app, server };
