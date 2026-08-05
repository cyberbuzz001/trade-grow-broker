import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { SafetyLock } from '../services/SafetyLock';
import { OptionChainEngine } from './OptionChainEngine';

export class AlphaVantageAdapter implements IMarketDataProvider {
  public readonly name = 'ALPHAVANTAGE';
  private apiKey: string;
  private baseUrl = 'https://www.alphavantage.co/query';
  private healthy = false;
  private callbacks: Set<TickCallback> = new Set();
  private tickCache: Map<string, MarketTick> = new Map();
  private lastFetchTime = 0;

  // Indian Index & Stock Reference Prices
  private static REFERENCE_PRICES: Record<string, { ltp: number; open: number; high: number; low: number; close: number }> = {
    'NSE_NIFTY50': { ltp: 24595.55, open: 24572.70, high: 24606.15, low: 24515.15, close: 24383.60 },
    'NSE_BANKNIFTY': { ltp: 57785.80, open: 57569.60, high: 57853.30, low: 57465.95, close: 57264.85 },
    'BSE_SENSEX': { ltp: 80599.78, open: 80350.20, high: 80720.50, low: 80210.10, close: 80015.00 },
    'NSE_RELIANCE': { ltp: 1310.10, open: 1315.20, high: 1315.80, low: 1308.80, close: 1307.80 },
    'NSE_TCS': { ltp: 2428.50, open: 2383.90, high: 2436.50, low: 2383.00, close: 2365.60 },
    'NSE_INFY': { ltp: 1158.20, open: 1145.10, high: 1161.80, low: 1138.10, close: 1130.10 },
    'NSE_HDFCBANK': { ltp: 753.65, open: 753.05, high: 756.85, low: 750.25, close: 748.15 },
    'NSE_ICICIBANK': { ltp: 1445.30, open: 1442.00, high: 1449.90, low: 1433.00, close: 1435.40 },
    'NSE_TATAMOTORS': { ltp: 348.30, open: 344.50, high: 350.00, low: 343.50, close: 339.75 },
  };

  constructor() {
    this.apiKey = process.env.ALPHAVANTAGE_API_KEY || 'CC23XT2DVHARWKAU';
  }

  public isHealthy(): boolean {
    return this.healthy;
  }

  public async initialize(): Promise<void> {
    console.log('[AlphaVantageAdapter] Initializing Alpha Vantage Market Data Adapter (PRIMARY)...');
    SafetyLock.assertSimulationOnly('AlphaVantageAdapter.initialize');

    this.healthy = true;

    // Start background tick streaming timer for default watchlist tokens
    const tokens = [
      'NSE_NIFTY50', 'NSE_BANKNIFTY', 'BSE_SENSEX', 'NSE_RELIANCE',
      'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK', 'NSE_TATAMOTORS'
    ];

    setInterval(async () => {
      for (const token of tokens) {
        const tick = await this.getQuote(token);
        if (tick) {
          this.callbacks.forEach(cb => cb(tick));
        }
      }
    }, 1500);

    console.log('[AlphaVantageAdapter] ✅ Alpha Vantage Adapter Active (Rate Throttled 1req/sec, FNO Enabled)!');
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    SafetyLock.assertSimulationOnly('AlphaVantageAdapter.subscribe');
    this.callbacks.add(callback);
  }

  public unsubscribe(instrumentTokens: string[]): void {
    // Unsubscribe logic
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    SafetyLock.assertSimulationOnly('AlphaVantageAdapter.getQuote');

    // 1. Check if token is an Indian Index / Stock with reference state
    const ref = AlphaVantageAdapter.REFERENCE_PRICES[instrumentToken];
    if (ref) {
      const delta = (Math.random() - 0.49) * (ref.ltp * 0.001);
      const ltp = Number((ref.ltp + delta).toFixed(2));
      const change = Number((ltp - ref.close).toFixed(2));
      const changePercent = Number(((change / ref.close) * 100).toFixed(2));

      const tick: MarketTick = {
        instrumentToken,
        exchange: instrumentToken.startsWith('BSE') ? 'BSE' : 'NSE',
        symbol: instrumentToken.replace('NSE_', '').replace('BSE_', ''),
        ltp,
        open: ref.open,
        high: Math.max(ref.high, ltp),
        low: Math.min(ref.low, ltp),
        close: ref.close,
        volume: 25000,
        change,
        changePercent,
        bid: Number((ltp - 0.05).toFixed(2)),
        ask: Number((ltp + 0.05).toFixed(2)),
        bidQty: 100,
        askQty: 100,
        timestamp: Date.now(),
      };

      this.tickCache.set(instrumentToken, tick);
      return tick;
    }

    // 2. Fetch US / Global equity from Alpha Vantage REST API (Rate Throttled)
    const now = Date.now();
    if (now - this.lastFetchTime < 1100) {
      return this.tickCache.get(instrumentToken) || null;
    }
    this.lastFetchTime = now;

    const symbol = this.formatAlphaVantageSymbol(instrumentToken);
    const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data && data['Global Quote'] && data['Global Quote']['05. price']) {
        const q = data['Global Quote'];
        const ltp = parseFloat(q['05. price']);
        const open = parseFloat(q['02. open'] || ltp.toString());
        const high = parseFloat(q['03. high'] || ltp.toString());
        const low = parseFloat(q['04. low'] || ltp.toString());
        const close = parseFloat(q['08. previous close'] || ltp.toString());
        const change = parseFloat(q['09. change'] || '0');
        const changePercentStr = q['10. change percent'] || '0%';
        const changePercent = parseFloat(changePercentStr.replace('%', ''));

        const tick: MarketTick = {
          instrumentToken,
          exchange: 'NSE',
          symbol,
          ltp,
          open,
          high,
          low,
          close,
          volume: parseInt(q['06. volume'] || '1000', 10),
          change,
          changePercent,
          bid: Number((ltp - 0.05).toFixed(2)),
          ask: Number((ltp + 0.05).toFixed(2)),
          bidQty: 100,
          askQty: 100,
          timestamp: Date.now(),
        };

        this.tickCache.set(instrumentToken, tick);
        return tick;
      }
    } catch (err: any) {
      console.warn(`[AlphaVantageAdapter] Error fetching ${symbol}: ${err.message}`);
    }

    return this.tickCache.get(instrumentToken) || null;
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number = 100): Promise<Candle[]> {
    SafetyLock.assertSimulationOnly('AlphaVantageAdapter.getHistoricalCandles');

    // Snapshot the live LTP right now so the last candle anchors exactly
    // to the concurrent WebSocket tick — preventing visible price spikes.
    const quote = await this.getQuote(instrumentToken);
    const anchorLtp = quote ? quote.ltp : 24500.0;
    const volatility = anchorLtp * 0.0008; // 0.08% per candle — realistic intraday noise

    const candles: Candle[] = [];
    const now = Math.floor(Date.now() / 1000);
    const intervalSec = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 :
                        timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : 86400;

    // Walk BACKWARDS from anchorLtp so last candle close == anchorLtp exactly
    let currentClose = anchorLtp;
    for (let i = count; i >= 0; i--) {
      const candleTime = now - (i * intervalSec);
      const isLast = (i === 0);

      const close = isLast ? anchorLtp : Number(currentClose.toFixed(2));
      const openDelta = (Math.random() - 0.49) * volatility * 2;
      const open = isLast
        ? Number((anchorLtp - (Math.random() * volatility)).toFixed(2))
        : Number((close - openDelta).toFixed(2));

      const high = Number((Math.max(open, close) + Math.random() * volatility).toFixed(2));
      const low  = Number((Math.min(open, close) - Math.random() * volatility).toFixed(2));

      candles.push({ time: candleTime, open, high, low, close, volume: 20000 });
      currentClose = open; // walk backwards: next iteration's close = this open
    }

    return candles; // chronological order, last close == anchorLtp
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    SafetyLock.assertSimulationOnly('AlphaVantageAdapter.getOptionChain');

    let spotPrice = 24595.55;
    if (symbol.includes('BANK')) {
      spotPrice = 57785.80;
    } else if (symbol.includes('SENSEX')) {
      spotPrice = 80599.78;
    }

    const res = await OptionChainEngine.generateOptionChain({ symbol, spotPrice, expiry });
    return res.chain;
  }

  // EXPLICIT SAFETY BARRIER
  public placeBrokerOrder(): void {
    SafetyLock.assertSimulationOnly('AlphaVantageAdapter.placeBrokerOrder');
    throw new Error('REAL-MONEY TRADING IS DISABLED. Real broker order placement is forbidden.');
  }

  private formatAlphaVantageSymbol(token: string): string {
    const raw = token.replace('NSE_', '').replace('BSE_', '').replace('-EQ', '');
    if (raw === 'NIFTY50' || raw === 'NIFTY 50') return 'BSESN';
    if (raw === 'BANKNIFTY') return 'BSESN';
    return `${raw}.NS`;
  }
}
