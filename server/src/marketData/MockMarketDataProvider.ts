import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';

interface InternalStockState {
  token: string;
  exchange: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MockMarketDataProvider implements IMarketDataProvider {
  public readonly name = 'MOCK_ENGINE';
  private healthy = true;
  private timer: NodeJS.Timeout | null = null;
  private callbacks: Map<string, Set<TickCallback>> = new Map();

  private stockStates: Map<string, InternalStockState> = new Map([
    ['NSE_NIFTY50', { token: 'NSE_NIFTY50', exchange: 'NSE', symbol: 'NIFTY 50', ltp: 24563.00, open: 24572.70, high: 24677.60, low: 24533.55, close: 24614.90, volume: 1548000 }],
    ['NSE_BANKNIFTY', { token: 'NSE_BANKNIFTY', exchange: 'NSE', symbol: 'BANKNIFTY', ltp: 57500.0, open: 57400.0, high: 57800.0, low: 57200.0, close: 57350.0, volume: 920000 }],
    ['BSE_SENSEX', { token: 'BSE_SENSEX', exchange: 'BSE', symbol: 'SENSEX', ltp: 80599.78, open: 80350.20, high: 80720.50, low: 80210.10, close: 80015.00, volume: 1200000 }],
    ['NSE_RELIANCE', { token: 'NSE_RELIANCE', exchange: 'NSE', symbol: 'RELIANCE', ltp: 1284.70, open: 1285.70, high: 1299.00, low: 1284.40, close: 1290.90, volume: 3420000 }],
    ['NSE_TCS', { token: 'NSE_TCS', exchange: 'NSE', symbol: 'TCS', ltp: 2426.30, open: 2415.00, high: 2440.00, low: 2410.00, close: 2420.00, volume: 1120000 }],
    ['NSE_INFY', { token: 'NSE_INFY', exchange: 'NSE', symbol: 'INFY', ltp: 1170.90, open: 1165.00, high: 1180.00, low: 1160.00, close: 1168.00, volume: 2410000 }],
    ['NSE_HDFCBANK', { token: 'NSE_HDFCBANK', exchange: 'NSE', symbol: 'HDFCBANK', ltp: 734.90, open: 732.00, high: 740.00, low: 730.00, close: 733.00, volume: 5410000 }],
    ['NSE_ICICIBANK', { token: 'NSE_ICICIBANK', exchange: 'NSE', symbol: 'ICICIBANK', ltp: 1445.30, open: 1442.00, high: 1449.90, low: 1433.00, close: 1435.40, volume: 3890000 }],
    ['NSE_TATAMOTORS', { token: 'NSE_TATAMOTORS', exchange: 'NSE', symbol: 'TATAMOTORS', ltp: 348.30, open: 344.50, high: 350.00, low: 343.50, close: 339.75, volume: 4120000 }],
    ['NFO_NIFTY_24500_CE', { token: 'NFO_NIFTY_24500_CE', exchange: 'NFO', symbol: 'NIFTY24500CE', ltp: 185.0, open: 160.0, high: 210.0, low: 145.0, close: 165.0, volume: 854000 }],
    ['NFO_NIFTY_24500_PE', { token: 'NFO_NIFTY_24500_PE', exchange: 'NFO', symbol: 'NIFTY24500PE', ltp: 110.0, open: 130.0, high: 145.0, low: 95.0, close: 128.0, volume: 620000 }]
  ]);

  public isHealthy(): boolean {
    return this.healthy;
  }

  public async initialize(): Promise<void> {
    console.log('[MockMarketDataProvider] Starting simulated real-time market data stream (1 sec interval)...');
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.generateTicks(), 1000);
  }

  public stop(): void {
    console.log('[MockMarketDataProvider] Stopping simulated market data stream...');
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private createDynamicState(token: string): void {
    const parts = token.split('_');
    if (parts.length >= 4) {
      const exchange = parts[0];
      const underlying = parts[1];
      const strike = parseFloat(parts[2]);
      const optionType = parts[3];

      let spot = underlying === 'SENSEX' ? 80599.78 : underlying === 'BANKNIFTY' ? 57500 : 24563.0;
      let dist = Math.abs(spot - strike);
      let isITM = (optionType === 'CE' && strike < spot) || (optionType === 'PE' && strike > spot);
      let ltp = isITM ? dist + (Math.random() * 50 + 20) : Math.max(5, 200 - (dist * 0.15) + (Math.random() * 10));
      ltp = Number(ltp.toFixed(2));

      this.stockStates.set(token, {
        token,
        exchange,
        symbol: `${underlying}${strike}${optionType}`,
        ltp,
        open: ltp * 0.98,
        high: ltp * 1.05,
        low: ltp * 0.95,
        close: ltp,
        volume: Math.floor(Math.random() * 100000) + 10000,
      });
    } else {
      this.stockStates.set(token, {
        token,
        exchange: 'NSE',
        symbol: token,
        ltp: 500.0,
        open: 495.0,
        high: 510.0,
        low: 490.0,
        close: 498.0,
        volume: 50000,
      });
    }
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    for (const token of instrumentTokens) {
      if (!token) continue;
      if (!this.stockStates.has(token)) {
        this.createDynamicState(token);
      }
      if (!this.callbacks.has(token)) {
        this.callbacks.set(token, new Set());
      }
      this.callbacks.get(token)!.add(callback);

      const state = this.stockStates.get(token);
      if (state) {
        callback(this.buildTick(state));
      }
    }
  }

  public unsubscribe(instrumentTokens: string[]): void {
    for (const token of instrumentTokens) {
      this.callbacks.delete(token);
    }
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    const state = this.stockStates.get(instrumentToken);
    if (!state) return null;
    return this.buildTick(state);
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number = 100): Promise<Candle[]> {
    const state = this.stockStates.get(instrumentToken);
    if (!state) return [];

    // CRITICAL: Snapshot the LTP right now (before the 1-second tick timer
    // changes it). Every candle is built backwards from this anchor so the
    // last candle's close == the live WebSocket tick price exactly.
    const anchorLtp = state.ltp;
    const volatility = anchorLtp * 0.0008; // 0.08% per candle — realistic intraday noise
    const intervalSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 :
                            timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : 86400;
    const now = Math.floor(Date.now() / 1000);

    const candles: Candle[] = [];
    let currentClose = anchorLtp; // Walk backwards from today's live price

    for (let i = count; i >= 0; i--) {
      const candleTime = now - (i * intervalSeconds);
      const isLast = (i === 0);

      const close = isLast ? anchorLtp : Number(currentClose.toFixed(2));

      // Realistic open: small random deviation from previous close
      const openDelta = (Math.random() - 0.49) * volatility * 2;
      const open = isLast
        ? Number((anchorLtp - (Math.random() * volatility)).toFixed(2))  // last open slightly below anchor
        : Number((close - openDelta).toFixed(2));

      const high = Number((Math.max(open, close) + Math.random() * volatility).toFixed(2));
      const low  = Number((Math.min(open, close) - Math.random() * volatility).toFixed(2));
      const volume = Math.floor(Math.random() * 50000) + 1000;

      candles.push({ time: candleTime, open, high, low, close, volume });

      // Walk backwards: next candle's close = this candle's open
      currentClose = open;
    }

    return candles; // Returned chronologically (oldest → newest, last close = anchorLtp)
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    const spotPrice = this.stockStates.get('NSE_NIFTY50')?.ltp || 24500;
    const strikes = [24300, 24400, 24500, 24600, 24700];

    return strikes.map(strike => {
      const ceLtp = Math.max(5, (spotPrice - strike) + 120 + Math.random() * 10);
      const peLtp = Math.max(5, (strike - spotPrice) + 120 + Math.random() * 10);

      return {
        strikePrice: strike,
        expiry: expiry || '2026-08-28',
        ce: {
          instrumentToken: `NFO_NIFTY_${strike}_CE`,
          ltp: Number(ceLtp.toFixed(2)),
          change: Number(((Math.random() - 0.5) * 15).toFixed(2)),
          volume: Math.floor(Math.random() * 200000),
          openInterest: Math.floor(Math.random() * 1500000),
          iv: 14.5,
          delta: spotPrice > strike ? 0.65 : 0.35,
          gamma: 0.002,
          theta: -12.4,
          vega: 18.2
        },
        pe: {
          instrumentToken: `NFO_NIFTY_${strike}_PE`,
          ltp: Number(peLtp.toFixed(2)),
          change: Number(((Math.random() - 0.5) * 15).toFixed(2)),
          volume: Math.floor(Math.random() * 180000),
          openInterest: Math.floor(Math.random() * 1400000),
          iv: 15.2,
          delta: spotPrice < strike ? -0.65 : -0.35,
          gamma: 0.002,
          theta: -11.8,
          vega: 17.8
        }
      };
    });
  }

  private generateTicks(): void {
    for (const [token, state] of this.stockStates.entries()) {
      const fluctuation = (Math.random() - 0.495) * (state.ltp * 0.002);
      state.ltp = Number(Math.max(1, state.ltp + fluctuation).toFixed(2));
      state.high = Math.max(state.high, state.ltp);
      state.low = Math.min(state.low, state.ltp);
      state.volume += Math.floor(Math.random() * 50) + 1;

      const tick = this.buildTick(state);
      const cbs = this.callbacks.get(token);
      if (cbs) {
        cbs.forEach(cb => cb(tick));
      }
    }
  }

  private buildTick(state: InternalStockState): MarketTick {
    const change = Number((state.ltp - state.close).toFixed(2));
    const changePercent = Number(((change / state.close) * 100).toFixed(2));
    const spread = Number((state.ltp * 0.0005).toFixed(2));

    return {
      instrumentToken: state.token,
      exchange: state.exchange,
      symbol: state.symbol,
      ltp: state.ltp,
      open: state.open,
      high: state.high,
      low: state.low,
      close: state.close,
      volume: state.volume,
      change,
      changePercent,
      bid: Number((state.ltp - spread).toFixed(2)),
      ask: Number((state.ltp + spread).toFixed(2)),
      bidQty: Math.floor(Math.random() * 500) + 50,
      askQty: Math.floor(Math.random() * 500) + 50,
      timestamp: Date.now()
    };
  }

  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
