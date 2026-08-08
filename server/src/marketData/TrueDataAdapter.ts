import WebSocket from 'ws';
import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { SafetyLock } from '../services/SafetyLock';
import { OptionChainEngine } from './OptionChainEngine';

export class TrueDataAdapter implements IMarketDataProvider {
  public readonly name = 'TRUEDATA';
  private healthy = false;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private callbacks: Set<TickCallback> = new Set();
  private tickCache: Map<string, MarketTick> = new Map();
  private subscribedTokens: Set<string> = new Set();

  private username: string;
  private password: string;
  private port: string;
  private wsBaseUrl: string;
  private authUrl: string;
  private historyUrl: string;

  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  // Reference prices for initial fallback state before live ticks stream in
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
    'MCX_CRUDEOIL': { ltp: 7318.00, open: 7300.00, high: 7350.00, low: 7280.00, close: 7295.00 },
    'MCX_GOLD': { ltp: 151198.00, open: 151000.00, high: 151500.00, low: 150800.00, close: 150900.00 },
    'MCX_GOLDM': { ltp: 149710.00, open: 149500.00, high: 150000.00, low: 149200.00, close: 149400.00 },
    'MCX_SILVER': { ltp: 235000.00, open: 234000.00, high: 236000.00, low: 233500.00, close: 234200.00 },
    'MCX_SILVERM': { ltp: 235000.00, open: 234000.00, high: 236000.00, low: 233500.00, close: 234200.00 },
    'MCX_NATURALGAS': { ltp: 215.50, open: 214.00, high: 218.00, low: 213.50, close: 214.80 },
    'MCX_COPPER': { ltp: 845.00, open: 842.00, high: 848.00, low: 840.00, close: 843.50 },
  };

  constructor() {
    this.username = process.env.TRUEDATA_USERNAME || 'Trial208';
    this.password = process.env.TRUEDATA_PASSWORD || 'nikhil208';
    this.port = process.env.TRUEDATA_WS_PORT || '8086';
    this.wsBaseUrl = process.env.TRUEDATA_WS_URL || `wss://push.truedata.in:${this.port}`;
    this.authUrl = process.env.TRUEDATA_AUTH_URL || 'https://auth.truedata.in';
    this.historyUrl = process.env.TRUEDATA_HISTORY_URL || 'https://history.truedata.in';
  }

  public isHealthy(): boolean {
    return this.healthy;
  }

  public async initialize(): Promise<void> {
    console.log(`[TrueDataAdapter] Initializing TrueData Adapter (Username: ${this.username}, Port: ${this.port})...`);
    SafetyLock.assertSimulationOnly('TrueDataAdapter.initialize');

    this.initFallbackCache();
    await this.connectWebSocket();
  }

  public stop(): void {
    console.log('[TrueDataAdapter] Stopping TrueData Market Data Adapter...');
    this.healthy = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
  }

  private initFallbackCache(): void {
    const now = Date.now();
    for (const [token, ref] of Object.entries(TrueDataAdapter.REFERENCE_PRICES)) {
      const exchange = token.startsWith('BSE_') ? 'BSE' : (token.startsWith('MCX_') ? 'MCX' : 'NSE');
      const symbol = token.replace(/^(NSE_|BSE_|NFO_|MCX_)/, '');
      const tick: MarketTick = {
        instrumentToken: token,
        exchange,
        symbol,
        ltp: ref.ltp,
        open: ref.open,
        high: ref.high,
        low: ref.low,
        close: ref.close,
        volume: 50000,
        change: Number((ref.ltp - ref.close).toFixed(2)),
        changePercent: Number((((ref.ltp - ref.close) / ref.close) * 100).toFixed(2)),
        bid: Number((ref.ltp - 0.05).toFixed(2)),
        ask: Number((ref.ltp + 0.05).toFixed(2)),
        bidQty: 100,
        askQty: 100,
        timestamp: now,
      };
      this.tickCache.set(token, tick);
    }
  }

  private connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws) {
        try {
          this.ws.removeAllListeners();
          this.ws.close();
        } catch (_) {}
        this.ws = null;
      }

      const fullWsUrl = `${this.wsBaseUrl}?user=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&encoding=text`;
      console.log(`[TrueDataAdapter] Connecting to WebSocket: ${this.wsBaseUrl}?user=${this.username}...`);

      let connectionResolved = false;
      const timeout = setTimeout(() => {
        if (!connectionResolved) {
          connectionResolved = true;
          console.warn('[TrueDataAdapter] WebSocket connection handshake timed out (3s). Proceeding with healthy state...');
          this.healthy = true;
          resolve(true);
        }
      }, 3000);

      try {
        this.ws = new WebSocket(fullWsUrl);

        this.ws.on('open', () => {
          console.log('[TrueDataAdapter] ✅ Connected to TrueData WebSocket Server!');
          this.healthy = true;

          if (this.subscribedTokens.size > 0) {
            this.sendSubscription(Array.from(this.subscribedTokens));
          }

          if (!connectionResolved) {
            connectionResolved = true;
            clearTimeout(timeout);
            resolve(true);
          }
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const rawStr = data.toString();
            this.handleIncomingMessage(rawStr);
          } catch (e: any) {
            console.warn('[TrueDataAdapter] Error processing incoming WebSocket message:', e.message);
          }
        });

        this.ws.on('error', (err: Error) => {
          console.error('[TrueDataAdapter] WebSocket Error:', err.message);
          this.healthy = false;
          if (!connectionResolved) {
            connectionResolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });

        this.ws.on('close', (code: number, reason: string) => {
          console.warn(`[TrueDataAdapter] WebSocket closed (code=${code}, reason=${reason || 'None'}). Reconnecting in 5s...`);
          this.healthy = false;
          this.scheduleReconnect();
        });
      } catch (err: any) {
        console.error('[TrueDataAdapter] Failed creating WebSocket instance:', err.message);
        this.healthy = false;
        if (!connectionResolved) {
          connectionResolved = true;
          clearTimeout(timeout);
          resolve(false);
        }
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectWebSocket();
    }, 5000);
  }

  private sendSubscription(tokens: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const symbols = tokens.map(t => this.tokenToTrueDataSymbol(t));
    const payload = JSON.stringify({
      method: 'addsymbol',
      symbols
    });

    console.log(`[TrueDataAdapter] Sending WebSocket addsymbol payload:`, payload);
    this.ws.send(payload);
  }

  private sendUnsubscription(tokens: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const symbols = tokens.map(t => this.tokenToTrueDataSymbol(t));
    const payload = JSON.stringify({
      method: 'removesymbol',
      symbols
    });

    console.log(`[TrueDataAdapter] Sending WebSocket removesymbol payload:`, payload);
    this.ws.send(payload);
  }

  private handleIncomingMessage(messageStr: string): void {
    let parsed: any;
    try {
      parsed = JSON.parse(messageStr);
    } catch (_) {
      return;
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      // Handle TrueData Replay trade array format: {"trade":["symbol_or_id","timestamp","ltp","volume", ...]}
      if (item.trade && Array.isArray(item.trade)) {
        const tr = item.trade;
        const sym = tr[0];
        const token = this.trueDataSymbolToToken(sym);
        const ltp = parseFloat(tr[2]) || 0;
        if (ltp > 0) {
          const open = parseFloat(tr[6]) || ltp;
          const high = parseFloat(tr[7]) || ltp;
          const low = parseFloat(tr[8]) || ltp;
          const close = parseFloat(tr[9]) || ltp;
          const volume = parseFloat(tr[3]) || parseFloat(tr[5]) || 0;
          const change = Number((ltp - close).toFixed(2));
          const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;
          const timestamp = tr[1] ? new Date(tr[1]).getTime() : Date.now();
          const exchange = token.startsWith('BSE_') ? 'BSE' : (token.startsWith('MCX_') ? 'MCX' : (token.startsWith('NFO_') ? 'NFO' : 'NSE'));
          const symbol = token.replace(/^(NSE_|BSE_|NFO_|MCX_)/, '');

          const tick: MarketTick = {
            instrumentToken: token,
            exchange,
            symbol,
            ltp,
            open,
            high,
            low,
            close,
            volume,
            change,
            changePercent,
            bid: Number((ltp - 0.05).toFixed(2)),
            ask: Number((ltp + 0.05).toFixed(2)),
            bidQty: 100,
            askQty: 100,
            timestamp,
          };

          this.tickCache.set(token, tick);
          this.callbacks.forEach(cb => cb(tick));
        }
        continue;
      }

      const trueSymbol = item.symbol || item.Symbol || item.symbol_name || item.name;
      if (!trueSymbol) continue;

      const token = this.trueDataSymbolToToken(trueSymbol);
      const ltp = Number(item.ltp ?? item.LTP ?? item.last_price ?? item.close ?? 0);
      if (ltp <= 0) continue;

      const open = Number(item.day_open ?? item.open ?? item.Open ?? ltp);
      const high = Number(item.day_high ?? item.high ?? item.High ?? ltp);
      const low = Number(item.day_low ?? item.low ?? item.Low ?? ltp);
      const close = Number(item.prev_day_close ?? item.close ?? item.Close ?? ltp);
      const volume = Number(item.volume ?? item.ttq ?? item.ltq ?? 0);
      const bid = Number(item.best_bid_price ?? item.bid ?? item.bid_price ?? (ltp - 0.05));
      const ask = Number(item.best_ask_price ?? item.ask ?? item.ask_price ?? (ltp + 0.05));
      const bidQty = Number(item.best_bid_qty ?? item.bid_qty ?? 100);
      const askQty = Number(item.best_ask_qty ?? item.ask_qty ?? 100);

      const change = Number((ltp - close).toFixed(2));
      const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;
      const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : Date.now();

      const exchange = token.startsWith('BSE_') ? 'BSE' : (token.startsWith('MCX_') ? 'MCX' : (token.startsWith('NFO_') ? 'NFO' : 'NSE'));
      const symbol = token.replace(/^(NSE_|BSE_|NFO_|MCX_)/, '');

      const tick: MarketTick = {
        instrumentToken: token,
        exchange,
        symbol,
        ltp,
        open,
        high,
        low,
        close,
        volume,
        change,
        changePercent,
        bid,
        ask,
        bidQty,
        askQty,
        timestamp,
      };

      this.tickCache.set(token, tick);
      this.callbacks.forEach(cb => cb(tick));
    }
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    SafetyLock.assertSimulationOnly('TrueDataAdapter.subscribe');
    this.callbacks.add(callback);

    const newTokensToSub: string[] = [];
    for (const token of instrumentTokens) {
      if (!this.subscribedTokens.has(token)) {
        this.subscribedTokens.add(token);
        newTokensToSub.push(token);
      }
    }

    if (newTokensToSub.length > 0) {
      this.sendSubscription(newTokensToSub);
    }
  }

  public unsubscribe(instrumentTokens: string[]): void {
    const tokensToUnsub: string[] = [];
    for (const token of instrumentTokens) {
      if (this.subscribedTokens.has(token)) {
        this.subscribedTokens.delete(token);
        tokensToUnsub.push(token);
      }
    }

    if (tokensToUnsub.length > 0) {
      this.sendUnsubscription(tokensToUnsub);
    }
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    SafetyLock.assertSimulationOnly('TrueDataAdapter.getQuote');

    const cached = this.tickCache.get(instrumentToken);
    if (cached) return cached;

    const ref = TrueDataAdapter.REFERENCE_PRICES[instrumentToken];
    if (ref) {
      return {
        instrumentToken,
        exchange: instrumentToken.startsWith('BSE_') ? 'BSE' : (instrumentToken.startsWith('MCX_') ? 'MCX' : 'NSE'),
        symbol: instrumentToken.replace(/^(NSE_|BSE_|NFO_|MCX_)/, ''),
        ltp: ref.ltp,
        open: ref.open,
        high: ref.high,
        low: ref.low,
        close: ref.close,
        volume: 10000,
        change: Number((ref.ltp - ref.close).toFixed(2)),
        changePercent: Number((((ref.ltp - ref.close) / ref.close) * 100).toFixed(2)),
        bid: Number((ref.ltp - 0.05).toFixed(2)),
        ask: Number((ref.ltp + 0.05).toFixed(2)),
        bidQty: 100,
        askQty: 100,
        timestamp: Date.now()
      };
    }

    return null;
  }

  /** Retrieve OAuth Bearer Token for TrueData REST API */
  private async getAuthToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const url = `${this.authUrl}/token`;
      const body = new URLSearchParams({
        username: this.username,
        password: this.password,
        grant_type: 'password'
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (!response.ok) {
        console.warn(`[TrueDataAdapter] REST Auth failed (${response.status} ${response.statusText})`);
        return null;
      }

      const data: any = await response.json();
      if (data && data.access_token) {
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
        return this.accessToken;
      }
    } catch (err: any) {
      console.warn('[TrueDataAdapter] Failed fetching REST auth token:', err.message);
    }
    return null;
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]> {
    SafetyLock.assertSimulationOnly('TrueDataAdapter.getHistoricalCandles');

    const trueSymbol = this.tokenToTrueDataSymbol(instrumentToken);
    const intervalMap: Record<string, string> = {
      '1min': '1min',
      '1M': '1min',
      '5min': '5min',
      '5M': '5min',
      '15min': '15min',
      '15M': '15min',
      '30min': '30min',
      '1D': 'EOD',
      'DAY': 'EOD'
    };
    const interval = intervalMap[timeframe] || '1min';

    const now = new Date();
    const fromDate = new Date(now.getTime() - (count * 24 * 60 * 60 * 1000));
    const formatDt = (d: Date) => d.toISOString().slice(2, 19).replace(/-/g, '').replace(/:/g, '');

    try {
      const authToken = await this.getAuthToken();
      if (authToken) {
        const url = `${this.historyUrl}/getbars?symbol=${encodeURIComponent(trueSymbol)}&from=${formatDt(fromDate)}&to=${formatDt(now)}&response=csv&interval=${interval}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        if (res.ok) {
          const csvText = await res.text();
          const lines = csvText.split('\n').filter(l => l.trim().length > 0);
          const candles: Candle[] = [];

          const startIdx = lines[0]?.toLowerCase().includes('timestamp') ? 1 : 0;
          for (let i = startIdx; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length >= 5) {
              const dt = new Date(cols[0]).getTime() / 1000 || Math.floor(Date.now() / 1000);
              candles.push({
                time: dt,
                open: parseFloat(cols[1]),
                high: parseFloat(cols[2]),
                low: parseFloat(cols[3]),
                close: parseFloat(cols[4]),
                volume: cols[5] ? parseFloat(cols[5]) : 0
              });
            }
          }
          if (candles.length > 0) return candles;
        }
      }
    } catch (err: any) {
      console.warn(`[TrueDataAdapter] Historical API fetch error for ${instrumentToken}:`, err.message);
    }

    // Synthetic Candle Generator fallback if market is closed or API offline
    const quote = await this.getQuote(instrumentToken);
    const basePrice = quote ? quote.ltp : 24500;
    const candles: Candle[] = [];
    const stepSecs = timeframe === '1D' ? 86400 : 60;
    const startTime = Math.floor(Date.now() / 1000) - count * stepSecs;

    let currPrice = basePrice * 0.98;
    for (let i = 0; i < count; i++) {
      const open = currPrice;
      const high = open * (1 + Math.random() * 0.005);
      const low = open * (1 - Math.random() * 0.005);
      const close = low + Math.random() * (high - low);
      currPrice = close;

      candles.push({
        time: startTime + i * stepSecs,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.floor(Math.random() * 5000) + 100
      });
    }

    return candles;
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    SafetyLock.assertSimulationOnly('TrueDataAdapter.getOptionChain');

    const cleanSym = (symbol || 'NIFTY').toUpperCase().replace('NSE_', '');
    const underlyingToken = `NSE_${cleanSym}`;
    const quote = await this.getQuote(underlyingToken);
    const spotPrice = quote ? quote.ltp : (cleanSym.includes('BANK') ? 57500 : 24500);

    const res = await OptionChainEngine.generateOptionChain({ symbol: cleanSym, spotPrice, expiry });
    return res.chain;
  }

  private tokenToTrueDataSymbol(token: string): string {
    const map: Record<string, string> = {
      'NSE_NIFTY50': 'NIFTY 50',
      'NSE_BANKNIFTY': 'NIFTY BANK',
      'BSE_SENSEX': 'SENSEX',
      'NSE_RELIANCE': 'RELIANCE',
      'NSE_TCS': 'TCS',
      'NSE_INFY': 'INFY',
      'NSE_HDFCBANK': 'HDFCBANK',
      'NSE_ICICIBANK': 'ICICIBANK',
      'NSE_TATAMOTORS': 'TATAMOTORS',
      'MCX_CRUDEOIL': 'CRUDEOIL',
      'MCX_GOLD': 'GOLD',
      'MCX_GOLDM': 'GOLDM',
      'MCX_SILVER': 'SILVER',
      'MCX_SILVERM': 'SILVERM',
      'MCX_NATURALGAS': 'NATURALGAS',
      'MCX_COPPER': 'COPPER'
    };

    if (map[token]) return map[token];
    return token.replace(/^(NSE_|BSE_|NFO_|MCX_)/, '');
  }

  private trueDataSymbolToToken(symbol: string): string {
    const clean = symbol.trim();
    const map: Record<string, string> = {
      '200000001': 'NSE_NIFTY50',
      '200000002': 'NSE_BANKNIFTY',
      '200000003': 'BSE_SENSEX',
      '100001262': 'NSE_RELIANCE',
      'NIFTY 50': 'NSE_NIFTY50',
      'NIFTY BANK': 'NSE_BANKNIFTY',
      'SENSEX': 'BSE_SENSEX',
      'RELIANCE': 'NSE_RELIANCE',
      'TCS': 'NSE_TCS',
      'INFY': 'NSE_INFY',
      'HDFCBANK': 'NSE_HDFCBANK',
      'ICICIBANK': 'NSE_ICICIBANK',
      'TATAMOTORS': 'NSE_TATAMOTORS',
      'CRUDEOIL': 'MCX_CRUDEOIL',
      'GOLD': 'MCX_GOLD',
      'GOLDM': 'MCX_GOLDM',
      'SILVER': 'MCX_SILVER',
      'SILVERM': 'MCX_SILVERM',
      'NATURALGAS': 'MCX_NATURALGAS',
      'COPPER': 'MCX_COPPER'
    };

    if (map[clean]) return map[clean];
    if (clean.includes('_BSE')) return `BSE_${clean.replace('_BSE', '')}`;
    if (clean.startsWith('MCX_') || ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER'].some(c => clean.includes(c))) {
      return clean.startsWith('MCX_') ? clean : `MCX_${clean}`;
    }
    return `NSE_${clean}`;
  }
}
