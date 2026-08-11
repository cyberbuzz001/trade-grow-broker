import { IMarketDataProvider } from './IMarketDataProvider';
import { AngelOneAdapter } from './AngelOneAdapter';
import { IndianStockMarketApiAdapter } from './IndianStockMarketApiAdapter';
import { AlphaVantageAdapter } from './AlphaVantageAdapter';
import { TrueDataAdapter } from './TrueDataAdapter';
import { DhanAdapter } from './DhanAdapter';
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
    const dhan = new DhanAdapter();

    this.providers.set(mock.name, mock);
    this.providers.set(angelOne.name, angelOne);
    this.providers.set('ANGELONE', angelOne);
    this.providers.set(indianApi.name, indianApi);
    this.providers.set(alphaVantage.name, alphaVantage);
    this.providers.set('ALPHAVANTAGE', alphaVantage);
    this.providers.set(dhan.name, dhan);
    this.providers.set('DHAN', dhan);

    const configuredProvider = process.env.PRIMARY_MARKET_DATA_PROVIDER || 'DHAN';
    this.activeProvider = this.providers.get(configuredProvider.toUpperCase()) || dhan;

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

  private stopInactiveProviders(): void {
    for (const [name, provider] of this.providers.entries()) {
      if (provider !== this.activeProvider && typeof provider.stop === 'function') {
        console.log(`[MarketDataEngine] Stopping inactive provider: ${name}`);
        provider.stop();
      }
    }
  }

  /**
   * Evaluates if current time is within Indian Stock Market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
   */
  public static isMarketHours(): boolean {
    const now = new Date();
    // Convert to IST (UTC+05:30)
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
    const inMarketHours = MarketDataEngine.isMarketHours();
    const allowOffMarketLive = process.env.ALLOW_OFF_MARKET_LIVE_DATA === 'true';
    const configuredProvider = process.env.PRIMARY_MARKET_DATA_PROVIDER || 'DHAN';

    console.log(`[MarketDataEngine] System Startup | IST Market Hours: ${inMarketHours ? 'OPEN (9:15 AM - 3:30 PM IST)' : 'CLOSED (Off-Market / Weekend)'}`);

    const defaultTokens = [
      'NSE_NIFTY50', 'NSE_BANKNIFTY', 'BSE_SENSEX', 'NSE_FINNIFTY', 'NSE_MIDCPNIFTY',
      'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS',
      'MCX_CRUDEOIL', 'MCX_GOLD', 'MCX_GOLDM', 'MCX_SILVERM', 'MCX_NATURALGAS', 'MCX_COPPER',
      'NFO_NIFTY_24500_CE', 'NFO_NIFTY_24500_PE'
    ];

    const attachSubscriber = (provider: IMarketDataProvider) => {
      provider.subscribe(defaultTokens, (tick) => {
        this.tickCache.set(tick.instrumentToken, tick);
        redis.set(`tick:${tick.instrumentToken}`, JSON.stringify(tick), 3600);
        redis.publish('market:ticks', JSON.stringify(tick));
        this.globalCallbacks.forEach(cb => cb(tick));
      });
    };

    console.log(`[MarketDataEngine] Initializing primary market data provider '${configuredProvider}' in FULL Quote Mode (Off-Market Override: ${allowOffMarketLive})...`);
    const primary = this.providers.get(configuredProvider.toUpperCase()) || this.providers.get('DHAN')!;
    this.activeProvider = primary;
    await this.activeProvider.initialize();
    attachSubscriber(this.activeProvider);

    // Stop any other running adapters to prevent dual-broadcasting
    this.stopInactiveProviders();
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

    // Stop all other running adapters
    this.stopInactiveProviders();

    // Resubscribe default tokens
    const defaultTokens = [
      'NSE_NIFTY50', 'NSE_BANKNIFTY', 'BSE_SENSEX', 'NSE_FINNIFTY', 'NSE_MIDCPNIFTY',
      'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS',
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
    if (keys.TRUEDATA_USERNAME) {
      process.env.TRUEDATA_USERNAME = keys.TRUEDATA_USERNAME;
    }
    if (keys.TRUEDATA_PASSWORD) {
      process.env.TRUEDATA_PASSWORD = keys.TRUEDATA_PASSWORD;
    }
    if (keys.TRUEDATA_WS_PORT) {
      process.env.TRUEDATA_WS_PORT = keys.TRUEDATA_WS_PORT;
    }
    if (keys.TRUEDATA_WS_URL) {
      process.env.TRUEDATA_WS_URL = keys.TRUEDATA_WS_URL;
    }
    if (keys.DHAN_CLIENT_ID) {
      process.env.DHAN_CLIENT_ID = keys.DHAN_CLIENT_ID;
    }
    if (keys.DHAN_ACCESS_TOKEN) {
      process.env.DHAN_ACCESS_TOKEN = keys.DHAN_ACCESS_TOKEN;
    }
    if (keys.DHAN_API_KEY) {
      process.env.DHAN_API_KEY = keys.DHAN_API_KEY;
    }
    if (keys.DHAN_API_SECRET) {
      process.env.DHAN_API_SECRET = keys.DHAN_API_SECRET;
    }
  }

  public setCachedTick(tick: MarketTick): void {
    if (!tick || !tick.instrumentToken) return;
    this.tickCache.set(tick.instrumentToken, tick);
    const { SymbologyNormalizer } = require('./SymbologyNormalizer');
    const aliases = SymbologyNormalizer.normalizeToken(tick.instrumentToken);
    for (const alias of aliases) {
      this.tickCache.set(alias, tick);
    }
  }

  public getCachedTick(instrumentToken: string): MarketTick | undefined {
    if (!instrumentToken) return undefined;
    const direct = this.tickCache.get(instrumentToken);
    if (direct) return direct;

    const { SymbologyNormalizer } = require('./SymbologyNormalizer');
    const aliases = SymbologyNormalizer.normalizeToken(instrumentToken);
    for (const alias of aliases) {
      const match = this.tickCache.get(alias);
      if (match) return match;
    }
    return undefined;
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    const cached = this.getCachedTick(instrumentToken);
    if (cached) return cached;
    const tick = await this.activeProvider.getQuote(instrumentToken);
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
    this.activeProvider.subscribe(tokens, (tick) => {
      this.setCachedTick(tick);
      redis.set(`tick:${tick.instrumentToken}`, JSON.stringify(tick), 3600);
      redis.publish('market:ticks', JSON.stringify(tick));
      this.globalCallbacks.forEach(cb => cb(tick));
    });
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
