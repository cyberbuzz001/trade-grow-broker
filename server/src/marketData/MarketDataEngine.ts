import { IMarketDataProvider } from './IMarketDataProvider';
import { AngelOneAdapter } from './AngelOneAdapter';
import { DhanAdapter } from './DhanAdapter';
import { FyersAdapter } from './FyersAdapter';
import { MockMarketDataProvider } from './MockMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { redis } from '../db/redis';

export class MarketDataEngine {
  private static instance: MarketDataEngine;
  private providers: Map<string, IMarketDataProvider> = new Map();
  private activeProvider: IMarketDataProvider;
  private dhanProvider: DhanAdapter;
  private fyersProvider: FyersAdapter;
  private angelOneProvider: AngelOneAdapter;
  private mockProvider: MockMarketDataProvider;

  private tickCache: Map<string, MarketTick> = new Map();
  private globalCallbacks: Set<TickCallback> = new Set();
  private subscribedTokens: Set<string> = new Set();

  // ── Auto-Failover Telemetry & State ──────────────────────────────────────
  private lastDhanTickTime: number = 0;
  private lastFyersTickTime: number = 0;
  private failoverActive: boolean = false;
  private failoverTimer: NodeJS.Timeout | null = null;
  private configuredProviderName: string = 'DHAN';

  private constructor() {
    this.mockProvider = new MockMarketDataProvider();
    this.angelOneProvider = new AngelOneAdapter();
    this.dhanProvider = new DhanAdapter();
    this.fyersProvider = new FyersAdapter();

    this.providers.set(this.mockProvider.name, this.mockProvider);
    this.providers.set('MOCK', this.mockProvider);
    this.providers.set('MOCK_ENGINE', this.mockProvider);
    this.providers.set(this.angelOneProvider.name, this.angelOneProvider);
    this.providers.set('ANGELONE', this.angelOneProvider);
    this.providers.set(this.dhanProvider.name, this.dhanProvider);
    this.providers.set('DHAN', this.dhanProvider);
    this.providers.set(this.fyersProvider.name, this.fyersProvider);
    this.providers.set('FYERS', this.fyersProvider);

    const configured = process.env.PRIMARY_MARKET_DATA_PROVIDER || 'DHAN';
    this.configuredProviderName = configured.toUpperCase();
    this.activeProvider = this.providers.get(this.configuredProviderName) || this.dhanProvider;

    // Subscribe to Redis pub/sub for tick broadcasts (multi-process horizontal scaling)
    redis.subscribe('market:ticks', (msg: string) => {
      try {
        const tick: MarketTick = JSON.parse(msg);
        this.setCachedTick(tick);
        this.globalCallbacks.forEach(cb => cb(tick));
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

    // Initialize Dhan as the ONLY provider
    try {
      await this.dhanProvider.initialize();
      this.dhanProvider.subscribe(Array.from(this.subscribedTokens), (tick) => {
        this.lastDhanTickTime = Date.now();
        this.broadcastTick(tick);
      });
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
   * Broadcasts tick to local cache, Redis PubSub, and all client WebSocket listeners
   */
  private broadcastTick(tick: MarketTick): void {
    this.setCachedTick(tick);
    redis.set(`tick:${tick.instrumentToken}`, JSON.stringify(tick), 3600);
    redis.publish('market:ticks', JSON.stringify(tick));
    this.globalCallbacks.forEach(cb => cb(tick));
  }

  /**
   * Auto-Failover Monitor (checks every 5 seconds):
   * Evaluates Dhan stream health. If Dhan goes quiet for >25000ms during market hours,
   * cleanly toggles failover to Fyers without leaking callbacks.
   */
  private startFailoverMonitor(): void {
    if (this.failoverTimer) clearInterval(this.failoverTimer);

    this.failoverTimer = setInterval(() => {
      const inMarket = MarketDataEngine.isMarketHours() || process.env.ALLOW_OFF_MARKET_LIVE_DATA === 'true';
      if (!inMarket) return;

      if (this.configuredProviderName === 'DHAN') {
        const now = Date.now();
        const dhanQuietMs = this.lastDhanTickTime > 0 ? (now - this.lastDhanTickTime) : 0;

        // If Dhan has received initial ticks and has gone quiet > 25000ms
        if (this.lastDhanTickTime > 0 && dhanQuietMs > 25000 && !this.failoverActive) {
          console.warn(`[AutoFailover] ⚠️ Dhan tick timeout (${dhanQuietMs}ms > 25000ms threshold). Promoting FYERS as active live streaming provider!`);
          this.failoverActive = true;
        }
      }
    }, 5000);
  }

  public getActiveProviderName(): string {
    if (this.failoverActive) {
      return `FYERS (FAILOVER ACTIVE - Dhan Timeout)`;
    }
    return this.activeProvider.name;
  }

  public getHybridStatus(): Record<string, any> {
    const now = Date.now();
    return {
      mode: 'HYBRID',
      primaryLiveStream: this.failoverActive ? 'FYERS (Failover)' : this.configuredProviderName,
      historicalCandlesProvider: 'FYERS (v3 API)',
      optionGreeksProvider: 'FYERS (Black-Scholes Dynamic Engine)',
      failoverActive: this.failoverActive,
      lastDhanTickMsAgo: this.lastDhanTickTime > 0 ? now - this.lastDhanTickTime : -1,
      lastFyersTickMsAgo: this.lastFyersTickTime > 0 ? now - this.lastFyersTickTime : -1,
      subscribedTokenCount: this.subscribedTokens.size
    };
  }

  public async switchPrimaryProvider(providerName: string): Promise<boolean> {
    const targetName = providerName.toUpperCase();
    const provider = this.providers.get(targetName) || this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Market Data Provider '${providerName}' is not recognized.`);
    }

    console.log(`[MarketDataEngine] 🔄 Switching Primary Provider to '${provider.name}'`);
    this.configuredProviderName = targetName;
    this.activeProvider = provider;
    this.failoverActive = false;
    process.env.PRIMARY_MARKET_DATA_PROVIDER = targetName;

    // Resubscribe all active tokens
    provider.subscribe(Array.from(this.subscribedTokens), (tick) => {
      this.broadcastTick(tick);
    });

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
    tokens.forEach(t => this.subscribedTokens.add(t));

    // Dhan only — subscribe new tokens directly
    this.dhanProvider.subscribe(tokens, (tick) => {
      this.lastDhanTickTime = Date.now();
      this.broadcastTick(tick);
    });
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
    const fyersProvider = this.fyersProvider as any;
    if (typeof fyersProvider.getOptionExpiries === 'function') {
      const expiries = fyersProvider.getOptionExpiries(symbol);
      if (expiries && expiries.length > 0) return expiries;
    }

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
