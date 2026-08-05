import { IMarketDataProvider } from './IMarketDataProvider';
import { AngelOneAdapter } from './AngelOneAdapter';
import { IndianStockMarketApiAdapter } from './IndianStockMarketApiAdapter';
import { AlphaVantageAdapter } from './AlphaVantageAdapter';
import { MockMarketDataProvider } from './MockMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { redis } from '../db/redis';

export class MarketDataEngine {
  private static instance: MarketDataEngine;
  private providers: Map<string, IMarketDataProvider> = new Map();
  private activeProvider: IMarketDataProvider;
  private tickCache: Map<string, MarketTick> = new Map();
  private globalCallbacks: Set<TickCallback> = new Set();

  private constructor() {
    const mock = new MockMarketDataProvider();
    const angelOne = new AngelOneAdapter();
    const indianApi = new IndianStockMarketApiAdapter();
    const alphaVantage = new AlphaVantageAdapter();

    this.providers.set(mock.name, mock);
    this.providers.set(angelOne.name, angelOne);
    this.providers.set('ANGELONE', angelOne);
    this.providers.set(indianApi.name, indianApi);
    this.providers.set(alphaVantage.name, alphaVantage);
    this.providers.set('ALPHAVANTAGE', alphaVantage);

    const configuredProvider = process.env.PRIMARY_MARKET_DATA_PROVIDER || 'MOCK';
    this.activeProvider = this.providers.get(configuredProvider) || mock;

    // Subscribe to Redis pub/sub for tick broadcasts (multi-process horizontal scaling)
    redis.subscribe('market:ticks', (msg: string) => {
      try {
        const tick: MarketTick = JSON.parse(msg);
        this.tickCache.set(tick.instrumentToken, tick);
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

  public async initialize(): Promise<void> {
    console.log(`[MarketDataEngine] Initializing active market data provider: ${this.activeProvider.name}`);
    await this.activeProvider.initialize();

    if (!this.activeProvider.isHealthy()) {
      console.warn(`[MarketDataEngine] Active provider ${this.activeProvider.name} is unhealthy. Failing over to MOCK_ENGINE.`);
      this.activeProvider = this.providers.get('MOCK_ENGINE')!;
      await this.activeProvider.initialize();
    }

    // Subscribe default tokens to tick updater
    const defaultTokens = [
      'NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS',
      'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS',
      'NFO_NIFTY_24500_CE', 'NFO_NIFTY_24500_PE'
    ];

    this.activeProvider.subscribe(defaultTokens, (tick) => {
      this.tickCache.set(tick.instrumentToken, tick);

      // Async write to Redis cache & broadcast via Pub/Sub (P3-3, P3-4)
      redis.set(`tick:${tick.instrumentToken}`, JSON.stringify(tick), 3600);
      redis.publish('market:ticks', JSON.stringify(tick));

      this.globalCallbacks.forEach(cb => cb(tick));
    });
  }

  public getActiveProviderName(): string {
    return this.activeProvider.name;
  }

  public async switchPrimaryProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName.toUpperCase()) || this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Market Data Provider '${providerName}' is not recognized.`);
    }

    console.log(`[MarketDataEngine] Switching active market data provider from '${this.activeProvider.name}' to '${provider.name}'`);
    await provider.initialize();
    this.activeProvider = provider;
    process.env.PRIMARY_MARKET_DATA_PROVIDER = providerName;

    // Resubscribe default tokens
    const defaultTokens = [
      'NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS',
      'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS',
      'NFO_NIFTY_24500_CE', 'NFO_NIFTY_24500_PE'
    ];

    this.activeProvider.subscribe(defaultTokens, (tick) => {
      this.tickCache.set(tick.instrumentToken, tick);
      redis.set(`tick:${tick.instrumentToken}`, JSON.stringify(tick), 3600);
      redis.publish('market:ticks', JSON.stringify(tick));
      this.globalCallbacks.forEach(cb => cb(tick));
    });

    return true;
  }

  public updateProviderCredentials(keys: Record<string, string>): void {
    if (keys.ALPHAVANTAGE_API_KEY) {
      process.env.ALPHAVANTAGE_API_KEY = keys.ALPHAVANTAGE_API_KEY;
    }
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
    if (keys.INDIAN_STOCK_MARKET_API_BASE_URL) {
      process.env.INDIAN_STOCK_MARKET_API_BASE_URL = keys.INDIAN_STOCK_MARKET_API_BASE_URL;
    }
  }

  public getCachedTick(instrumentToken: string): MarketTick | undefined {
    return this.tickCache.get(instrumentToken);
  }

  public getAllCachedTicks(): MarketTick[] {
    return Array.from(this.tickCache.values());
  }

  public onTick(callback: TickCallback): void {
    this.globalCallbacks.add(callback);
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]> {
    // NOTE: No Redis caching for candles — the last candle's close must always
    // match the current live LTP. A 60-second stale cache causes price spikes
    // when the last cached candle close diverges from the live WebSocket tick.
    return this.activeProvider.getHistoricalCandles(instrumentToken, timeframe, count);
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    return this.activeProvider.getOptionChain(symbol, expiry);
  }

  public getOptionExpiries(symbol: string): string[] {
    // If the active provider supports real expiry lookup, use it
    const provider = this.activeProvider as any;
    if (typeof provider.getOptionExpiries === 'function') {
      return provider.getOptionExpiries(symbol);
    }
    // Fallback: generate synthetic weekly Thursday expiries for next 5 weeks
    const sym = (symbol || 'NIFTY').toUpperCase();
    const dates: string[] = [];
    const base = new Date();
    for (let w = 0; w < 5; w++) {
      const d = new Date(base);
      // Next Thursday = day 4
      const daysToThursday = (4 - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + daysToThursday + w * 7);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
}
