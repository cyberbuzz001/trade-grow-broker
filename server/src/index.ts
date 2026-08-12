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

// ============================================================
// Startup: DB Init, Market Data Engine, Execution Engine
// ============================================================
async function startServer() {
  try {
    // Initialize database (run migrations & seed)
    await seedDatabase();

    // Initialize Scrip Master (loads token lookup cache, blocks if DB empty)
    const { InstrumentMasterService } = await import('./marketData/InstrumentMasterService');
    await InstrumentMasterService.getInstance().initializeOnStartup();

    // Initialize Market Data Engine
    await MarketDataEngine.getInstance().initialize();

    // Start Price Feed Reconciliation Monitor (every 60s)
    import('./services/ReconciliationMonitorService')
      .then(({ reconciliationMonitor }) => reconciliationMonitor.start(60000))
      .catch((err) => console.error('[Startup] Failed to start ReconciliationMonitorService:', err.message));

    // Start NSE Live Index & Dual-Feed Spot Guard (every 30s)
    import('./marketData/NseOptionChainService')
      .then(({ nseOptionChainService }) => nseOptionChainService.start())
      .catch((err) => console.error('[Startup] Failed to start NseOptionChainService:', err.message));

    // Start Automated Option Chain Pricing Accuracy Check (every 60s)
    import('./services/AccuracyCheckService')
      .then(({ accuracyCheckService }) => accuracyCheckService.start())
      .catch((err) => console.error('[Startup] Failed to start AccuracyCheckService:', err.message));

    // Start Simulated Execution Engine
    ExecutionEngine.start();

    // Setup WebSocket Server Gateway
    setupWebSocketServer(server);

    // Start Dhan Token Expiry Check & Morning Reminder Cron Jobs
    const engine = MarketDataEngine.getInstance();
    const dhanProvider = (engine as any).providers?.get('DHAN');
    if (dhanProvider && typeof dhanProvider.getAccessToken === 'function') {
      setDhanAdapterRef(dhanProvider);
      startCronJobs(() => dhanProvider.getAccessToken());
      console.log('[Startup] ✅ Dhan token cron jobs started (30-min expiry check + 08:30 AM IST reminder).');
    } else {
      console.warn('[Startup] ⚠️ DhanAdapter not found — cron jobs not started.');
    }

    // Serve Frontend Static Files in Production
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
        if (err) res.status(200).send('Trade Grow — Smart Trading Platform API Running. Client build pending.');
      });
    });

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🌱 TRADE GROW — SMART TRADING PLATFORM ON PORT ${PORT}`);
      console.log(`🔒 SAFETY MODE: VIRTUAL PAPER TRADING ONLY (REAL MONEY DISABLED)`);
      console.log(`📊 MARKET DATA: ${MarketDataEngine.getInstance().getActiveProviderName()}`);
      console.log(`🔔 CRON JOBS: Dhan token expiry check (30-min) + 08:30 AM IST daily reminder`);
      console.log(`🛡️  SECURITY: Helmet.js, CORS restricted, Rate limiting active`);
      console.log(`🗄️  DATABASE: PostgreSQL (connection pool: max 20 connections)`);
      console.log(`=======================================================`);
    });
  } catch (err: any) {
    console.error('[FATAL] Server startup failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

startServer();

export { app, server };
