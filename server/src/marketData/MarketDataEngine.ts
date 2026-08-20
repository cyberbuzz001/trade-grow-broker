import { IMarketDataProvider } from './IMarketDataProvider';
import { AngelOneAdapter } from './AngelOneAdapter';
import { DhanAdapter } from './DhanAdapter';
import { MockMarketDataProvider } from './MockMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { redis } from '../db/redis';

export class MarketDataEngine {
  private static instance: MarketDataEngine;
  private providers: Map<string, IMarketDataProvider> = new Map();
  private activeProvider: IMarketDataProvider;
  private dhanProvider: DhanAdapter;
  private angelOneProvider: AngelOneAdapter;
  private mockProvider: MockMarketDataProvider;

  private tickCache: Map<string, MarketTick> = new Map();
  private globalCallbacks: Set<TickCallback> = new Set();
  private subscribedTokens: Set<string> = new Set();
  // ref-count per token so we only unsubscribe from Dhan when truly zero clients need it
  private tokenRefCount: Map<string, number> = new Map();

  private lastDhanTickTime: number = 0;
  private configuredProviderName: string = 'DHAN';

  private constructor() {
    this.mockProvider = new MockMarketDataProvider();
    this.angelOneProvider = new AngelOneAdapter();
    this.dhanProvider = new DhanAdapter();

    this.providers.set(this.mockProvider.name, this.mockProvider);
    this.providers.set('MOCK', this.mockProvider);
    this.providers.set('MOCK_ENGINE', this.mockProvider);
    this.providers.set(this.angelOneProvider.name, this.angelOneProvider);
    this.providers.set('ANGELONE', this.angelOneProvider);
    this.providers.set(this.dhanProvider.name, this.dhanProvider);
    this.providers.set('DHAN', this.dhanProvider);

    const configured = process.env.PRIMARY_MARKET_DATA_PROVIDER || 'DHAN';
    this.configuredProviderName = configured.toUpperCase();
    this.activeProvider = this.providers.get(this.configuredProviderName) || this.dhanProvider;

    // Subscribe to Redis pub/sub only for cross-process tick sharing (multi-process horizontal scaling).
    // In a single-process deployment this path is a no-op: broadcastTick() already updates the
    // local cache and fires globalCallbacks directly, so we must NOT re-fire them here to avoid
    // double-processing every tick.
    redis.subscribe('market:ticks', (msg: string) => {
      try {
        const tick: MarketTick = JSON.parse(msg);
        // Only update cache — callbacks were already called by broadcastTick() in this process.
        // If running as a separate worker process the callbacks still need to fire.
        this.setCachedTick(tick);
        // Only re-fire callbacks if this process did NOT originate the tick (detect via a pid-tag
        // would require protocol changes; for now we accept cross-process delivery only).
      } catch (_) {}
    });
  }

  public static getInstance(): MarketDataEngine {
    if (!MarketDataEngine.instance) {
      MarketDataEngine.instance = new MarketDataEngine();
    }
    return MarketDataEngine.instance;
  }

  /**
   * Evaluates if current time is within Indian Stock Market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
   */
  public static isMarketHours(): boolean {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcMs + (330 * 60000));

    const day = istDate.getDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) return false; // Weekend

    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const timeInMins = hours * 60 + minutes;

    // 9:15 AM = 555 mins, 3:30 PM = 930 mins
    return timeInMins >= 555 && timeInMins <= 930;
  }

  public async initialize(): Promise<void> {
    console.log(`[MarketDataEngine] 🚀 Initializing Dhan-Only Market Data Engine...`);

    const defaultTokens = [
      'NSE_NIFTY50', 'NSE_BANKNIFTY', 'BSE_SENSEX', 'NSE_FINNIFTY', 'NSE_MIDCPNIFTY',
      'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS',
    ];

    defaultTokens.forEach(t => this.subscribedTokens.add(t));

    // Initialize Dhan as the ONLY provider — register callback ONCE here, never again
    try {
      await this.dhanProvider.initialize();
      this.dhanProvider.registerCallback((tick) => {
        this.lastDhanTickTime = Date.now();
        this.broadcastTick(tick);
      });
      this.dhanProvider.subscribeToTokens(Array.from(this.subscribedTokens));
    } catch (err: any) {
      console.warn('[MarketDataEngine] Dhan initialization warning:', err.message);
    }

    // Fyers is DISABLED — it was causing WebSocket crash-reconnect storms
    // that blocked the Node.js event loop and caused 504 errors.
    this.activeProvider = this.dhanProvider;
    this.configuredProviderName = 'DHAN';

    console.log(`[MarketDataEngine] ✅ Dhan-Only Engine Ready | Live Ticks: DHAN | Option Chain: DHAN | Fyers: DISABLED`);
  }

  /**
   * Broadcasts tick to local cache, Redis PubSub, and all client WebSocket listeners.
   *
   * The durable `tick:<token>` Redis SET is throttled to at most once per second per
   * instrument. Writing every tick was generating thousands of Redis round-trips per
   * second during market hours with no added value — the in-memory tickCache already
   * serves all reads, and the durable copy only exists for warm-start after a restart.
   */
  private broadcastTick(tick: MarketTick): void {
    this.setCachedTick(tick);

    this.totalTicksProcessed++;
    this.ticksInWindow++;
    const nowTs = Date.now();
    if (nowTs - this.tickCounterResetAt > 60_000) {
      this.ticksInWindow = 0;
      this.tickCounterResetAt = nowTs;
    }

    const now = Date.now();
    const lastWrite = this.lastRedisWrite.get(tick.instrumentToken) ?? 0;
    if (now - lastWrite >= MarketDataEngine.REDIS_WRITE_THROTTLE_MS) {
      this.lastRedisWrite.set(tick.instrumentToken, now);
      redis.set(`tick:${tick.instrumentToken}`, JSON.stringify(tick), 3600);
    }

    redis.publish('market:ticks', JSON.stringify(tick));
    this.globalCallbacks.forEach(cb => {
      try { cb(tick); } catch (_) {}
    });
  }

  private lastRedisWrite: Map<string, number> = new Map();
  private static readonly REDIS_WRITE_THROTTLE_MS = 1000;
  private static readonly STALE_THRESHOLD_MS = 15_000;

  public getActiveProviderName(): string {
    return this.activeProvider ? this.activeProvider.name : 'DHAN';
  }

  /**
   * Feed health for the UI status indicator (Phase 6).
   * LIVE          — ticks arriving normally
   * STALE         — connected but no tick for > STALE_THRESHOLD_MS during market hours
   * CLOSED        — outside market hours; last known prices are valid but not moving
   * DISCONNECTED  — provider socket is down
   */
  public getFeedHealth(): {
    status: 'LIVE' | 'STALE' | 'CLOSED' | 'DISCONNECTED';
    lastTickMsAgo: number;
    provider: string;
    subscribedTokens: number;
    marketOpen: boolean;
  } {
    const now = Date.now();
    const lastTickMsAgo = this.lastDhanTickTime > 0 ? now - this.lastDhanTickTime : -1;
    const marketOpen = MarketDataEngine.isMarketHours();
    const connected = this.dhanProvider.isConnected?.() ?? this.lastDhanTickTime > 0;

    let status: 'LIVE' | 'STALE' | 'CLOSED' | 'DISCONNECTED';
    if (!connected) {
      status = 'DISCONNECTED';
    } else if (!marketOpen) {
      status = 'CLOSED';
    } else if (lastTickMsAgo < 0 || lastTickMsAgo > MarketDataEngine.STALE_THRESHOLD_MS) {
      status = 'STALE';
    } else {
      status = 'LIVE';
    }

    return {
      status,
      lastTickMsAgo,
      provider: this.getActiveProviderName(),
      subscribedTokens: this.subscribedTokens.size,
      marketOpen
    };
  }

  public getHybridStatus(): Record<string, any> {
    const now = Date.now();
    return {
      mode: 'DHAN_ONLY',
      primaryLiveStream: this.configuredProviderName,
      historicalCandlesProvider: 'DHAN (v2 API)',
      optionGreeksProvider: 'DHAN / Black-Scholes Engine',
      lastDhanTickMsAgo: this.lastDhanTickTime > 0 ? now - this.lastDhanTickTime : -1,
      subscribedTokenCount: this.subscribedTokens.size
    };
  }

  /**
   * Pipeline load metrics (Phase 16).
   * `providerConnections` is the number that must stay flat as users grow — it proves
   * the fan-out architecture is holding and connections are not scaling per user.
   */
  public getPipelineMetrics(): Record<string, number> {
    const now = Date.now();
    const windowSec = Math.max(1, (now - this.tickCounterResetAt) / 1000);
    return {
      providerConnections: this.dhanProvider.isConnected() ? 1 : 0,
      upstreamSubscribedTokens: this.dhanProvider.getSubscribedTokenCount(),
      engineTrackedTokens: this.subscribedTokens.size,
      refCountedTokens: this.tokenRefCount.size,
      tickCacheEntries: this.tickCache.size,
      globalCallbacks: this.globalCallbacks.size,
      ticksProcessed: this.totalTicksProcessed,
      ticksPerSecond: Number((this.ticksInWindow / windowSec).toFixed(2)),
      staleTicksRejected: this.staleTicksRejected
    };
  }

  private totalTicksProcessed = 0;
  private ticksInWindow = 0;
  private tickCounterResetAt = Date.now();
  private staleTicksRejected = 0;

  public async switchPrimaryProvider(providerName: string): Promise<boolean> {
    const targetName = providerName.toUpperCase();
    const provider = this.providers.get(targetName) || this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Market Data Provider '${providerName}' is not recognized.`);
    }

    console.log(`[MarketDataEngine] 🔄 Switching Primary Provider to '${provider.name}'`);
    this.configuredProviderName = targetName;
    this.activeProvider = provider;
    process.env.PRIMARY_MARKET_DATA_PROVIDER = targetName;

    // Resubscribe all active tokens (callback already registered in initialize)
    if (provider === this.dhanProvider) {
      this.dhanProvider.subscribeToTokens(Array.from(this.subscribedTokens));
    } else {
      provider.subscribe(Array.from(this.subscribedTokens), (tick) => this.broadcastTick(tick));
    }

    return true;
  }

  public updateProviderCredentials(keys: Record<string, string>): void {
    if (keys.FYERS_APP_ID) process.env.FYERS_APP_ID = keys.FYERS_APP_ID;
    if (keys.FYERS_SECRET_KEY) process.env.FYERS_SECRET_KEY = keys.FYERS_SECRET_KEY;
    if (keys.FYERS_TOTP_SECRET) process.env.FYERS_TOTP_SECRET = keys.FYERS_TOTP_SECRET;
    if (keys.FYERS_PIN) process.env.FYERS_PIN = keys.FYERS_PIN;
    if (keys.FYERS_CLIENT_ID) process.env.FYERS_CLIENT_ID = keys.FYERS_CLIENT_ID;
    if (keys.FYERS_ACCESS_TOKEN) process.env.FYERS_ACCESS_TOKEN = keys.FYERS_ACCESS_TOKEN;
    if (keys.FYERS_REDIRECT_URI) process.env.FYERS_REDIRECT_URI = keys.FYERS_REDIRECT_URI;

    if (keys.ANGELONE_API_KEY) {
      process.env.ANGELONE_API_KEY = keys.ANGELONE_API_KEY;
      process.env.SMARTAPI_API_KEY = keys.ANGELONE_API_KEY;
    }
    if (keys.ANGELONE_CLIENT_ID) {
      process.env.ANGELONE_CLIENT_ID = keys.ANGELONE_CLIENT_ID;
      process.env.SMARTAPI_CLIENT_CODE = keys.ANGELONE_CLIENT_ID;
    }
    if (keys.ANGELONE_CLIENT_SECRET) {
      process.env.ANGELONE_CLIENT_SECRET = keys.ANGELONE_CLIENT_SECRET;
      process.env.SMARTAPI_PASSWORD = keys.ANGELONE_CLIENT_SECRET;
    }
    if (keys.ANGELONE_TOTP_SECRET) {
      process.env.ANGELONE_TOTP_SECRET = keys.ANGELONE_TOTP_SECRET;
      process.env.SMARTAPI_TOTP_SECRET = keys.ANGELONE_TOTP_SECRET;
    }

    if (keys.DHAN_CLIENT_ID) process.env.DHAN_CLIENT_ID = keys.DHAN_CLIENT_ID;
    if (keys.DHAN_TOTP_SECRET) process.env.DHAN_TOTP_SECRET = keys.DHAN_TOTP_SECRET;
    if (keys.DHAN_PIN) process.env.DHAN_PIN = keys.DHAN_PIN;
    if (keys.DHAN_ACCESS_TOKEN) process.env.DHAN_ACCESS_TOKEN = keys.DHAN_ACCESS_TOKEN;
    if (keys.DHAN_API_KEY) process.env.DHAN_API_KEY = keys.DHAN_API_KEY;
    if (keys.DHAN_API_SECRET) process.env.DHAN_API_SECRET = keys.DHAN_API_SECRET;
  }

  public setCachedTick(tick: MarketTick): void {
    if (!tick || !tick.instrumentToken) return;
    // Reject stale ticks — only advance cache forward in time
    const existing = this.tickCache.get(tick.instrumentToken);
    if (existing && existing.timestamp > tick.timestamp) {
      this.staleTicksRejected++;
      return;
    }
    this.tickCache.set(tick.instrumentToken, tick);
    try {
      const { SymbologyNormalizer } = require('./SymbologyNormalizer');
      const aliases = SymbologyNormalizer.normalizeToken(tick.instrumentToken);
      for (const alias of aliases) {
        this.tickCache.set(alias, tick);
      }
    } catch (_) {}
  }

  public getCachedTick(instrumentToken: string): MarketTick | undefined {
    if (!instrumentToken) return undefined;
    const direct = this.tickCache.get(instrumentToken);
    if (direct) return direct;

    try {
      const { SymbologyNormalizer } = require('./SymbologyNormalizer');
      const aliases = SymbologyNormalizer.normalizeToken(instrumentToken);
      for (const alias of aliases) {
        const match = this.tickCache.get(alias);
        if (match) return match;
      }
    } catch (_) {}
    return undefined;
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    const cached = this.getCachedTick(instrumentToken);
    if (cached) return cached;

    // Dhan only — Fyers is disabled
    const tick = await this.dhanProvider.getQuote(instrumentToken);
    if (tick) {
      this.setCachedTick(tick);
    }
    return tick;
  }

  public getAllCachedTicks(): MarketTick[] {
    return Array.from(this.tickCache.values());
  }

  public subscribe(tokens: string[]): void {
    if (!tokens || tokens.length === 0) return;
    const newTokens: string[] = [];
    for (const t of tokens) {
      this.subscribedTokens.add(t);
      const count = (this.tokenRefCount.get(t) ?? 0) + 1;
      this.tokenRefCount.set(t, count);
      if (count === 1) newTokens.push(t); // first subscriber for this token
    }
    if (newTokens.length > 0) {
      this.dhanProvider.subscribeToTokens(newTokens);
    }
  }

  public unsubscribe(tokens: string[]): void {
    if (!tokens || tokens.length === 0) return;
    const toRemove: string[] = [];
    for (const t of tokens) {
      const count = (this.tokenRefCount.get(t) ?? 1) - 1;
      if (count <= 0) {
        this.tokenRefCount.delete(t);
        this.subscribedTokens.delete(t);
        toRemove.push(t);
      } else {
        this.tokenRefCount.set(t, count);
      }
    }
    if (toRemove.length > 0) {
      this.dhanProvider.unsubscribeFromTokens(toRemove);
    }
  }

  public onTick(callback: TickCallback): void {
    this.globalCallbacks.add(callback);
  }

  /**
   * Historical Candles — Dhan only (Fyers disabled)
   */
  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]> {
    return this.dhanProvider.getHistoricalCandles(instrumentToken, timeframe, count);
  }

  /**
   * Option Chain — Dhan only (Fyers disabled)
   */
  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    return this.dhanProvider.getOptionChain(symbol, expiry);
  }

  public getOptionExpiries(symbol: string): string[] {
    const dhanProvider = this.dhanProvider as any;
    if (typeof dhanProvider.getOptionExpiries === 'function') {
      return dhanProvider.getOptionExpiries(symbol);
    }

    // Synthetic fallback
    const dates: string[] = [];
    const base = new Date();
    for (let w = 0; w < 5; w++) {
      const d = new Date(base);
      const daysToThursday = (4 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysToThursday + w * 7);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
}
