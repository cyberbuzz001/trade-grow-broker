import WebSocket from 'ws';
import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { SafetyLock } from '../services/SafetyLock';
import { OptionChainEngine } from './OptionChainEngine';
import { getTokenExpiryMinutes, isTokenExpiringSoon } from '../utils/dhanTokenRefresh';
import { sendTelegramAlert } from '../utils/telegramAlert';

export class DhanAdapter implements IMarketDataProvider {
  public readonly name = 'DHAN';
  private healthy = false;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private callbacks: Set<TickCallback> = new Set();
  private tickCache: Map<string, MarketTick> = new Map();
  private subscribedTokens: Set<string> = new Set();

  private clientId: string;
  private accessToken: string;
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://api.dhan.co';
  private wsUrl = 'wss://api-feed.dhan.co';

  // Common Dhan Security IDs mapping
  private static DHAN_SECURITY_MAP: Record<string, { segment: string; securityId: string }> = {
    'NSE_NIFTY50': { segment: 'NSE_INDEX', securityId: '13' },
    'NSE_BANKNIFTY': { segment: 'NSE_INDEX', securityId: '25' },
    'BSE_SENSEX': { segment: 'IDX_I', securityId: '51' },
    'NSE_RELIANCE': { segment: 'NSE_EQ', securityId: '2885' },
    'NSE_TCS': { segment: 'NSE_EQ', securityId: '11536' },
    'NSE_INFY': { segment: 'NSE_EQ', securityId: '1594' },
    'NSE_HDFCBANK': { segment: 'NSE_EQ', securityId: '1333' },
    'NSE_ICICIBANK': { segment: 'NSE_EQ', securityId: '4963' },
    'NSE_TATAMOTORS': { segment: 'NSE_EQ', securityId: '3456' },
  };

  constructor() {
    this.clientId = process.env.DHAN_CLIENT_ID || '1113019677';
    this.accessToken = process.env.DHAN_ACCESS_TOKEN || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJkaGFuIiwicGFydG5lcklkIjoiIiwiZXhwIjoxNzg2NjE4NTQ5LCJpYXQiOjE3ODY1MzIxNDksInRva2VuQ29uc3VtZXJUeXBlIjoiU0VMRiIsIndlYmhvb2tVcmwiOiIiLCJkaGFuQ2xpZW50SWQiOiIxMTEzMDE5Njc3In0.nRFtcHpQeWp9Flmrdn3tr-XxlGXTkbWnE_nLS7jdBaxTmkuenRwKbLEmMD7AZP2gms5Auq1LTrt4O92CbVVp_g';
    this.apiKey = process.env.DHAN_API_KEY || '21483ef7';
    this.apiSecret = process.env.DHAN_API_SECRET || 'e9730aa4-682c-4e75-a944-94f703449b09';
  }

  private optionChainData: any = null;
  private chainFilePath: string = '';
  private lastTickTime: number = 0;

  public isHealthy(): boolean {
    return this.healthy && (this.lastTickTime === 0 || Date.now() - this.lastTickTime < 45000);
  }

  public async initialize(): Promise<void> {
    console.log(`[DhanAdapter] Initializing Dhan HQ API v2 Adapter (ClientId: ${this.clientId})...`);
    SafetyLock.assertSimulationOnly('DhanAdapter.initialize');

    await this.connectWebSocket();

    // Start periodic JWT expiry check — every 30 minutes
    setInterval(() => {
      this.checkTokenExpiry();
    }, 30 * 60 * 1000);

    // Also check immediately on startup
    setTimeout(() => this.checkTokenExpiry(), 5000);
  }

  /**
   * Returns the current Dhan access token.
   * Used by cron jobs to check expiry without direct field access.
   */
  public getAccessToken(): string {
    return this.accessToken;
  }

  /**
   * Hot-swap the Dhan access token and re-establish the WebSocket connection.
   * No server restart required.
   * Called by POST /api/internal/update-dhan-token
   */
  public async setAccessToken(newToken: string): Promise<void> {
    console.log('[DhanAdapter] 🔄 Hot-swapping Dhan access token...');
    this.accessToken = newToken;
    // Re-establish WebSocket with the new token
    await this.connectWebSocket();
    console.log('[DhanAdapter] ✅ Access token updated and WebSocket reconnected.');
  }

  /**
   * Decodes the current JWT token, checks time remaining, and sends a Telegram
   * alert if expiry is within 60 minutes.
   */
  private async checkTokenExpiry(): Promise<void> {
    if (!this.accessToken) return;

    const minutesLeft = getTokenExpiryMinutes(this.accessToken);

    if (minutesLeft < 0) {
      console.error('[DhanAdapter] 🚨 Dhan access token is EXPIRED! Market data may be unavailable.');
      await sendTelegramAlert(
        `🚨 <b>Trade Grow — Dhan Token EXPIRED!</b>\n\n` +
        `❌ The Dhan access token has expired and WebSocket is disconnected.\n\n` +
        `🔑 Please update the token via:\n` +
        `<code>POST /api/internal/update-dhan-token</code>\n` +
        `Body: <code>{"accessToken": "YOUR_NEW_TOKEN"}</code>`
      );
    } else if (isTokenExpiringSoon(this.accessToken, 60)) {
      const hoursLeft = (minutesLeft / 60).toFixed(1);
      console.warn(`[DhanAdapter] ⚠️ Dhan token expiring in ${minutesLeft} min (${hoursLeft}h). Sending Telegram alert.`);
      await sendTelegramAlert(
        `⚠️ <b>Trade Grow — Dhan Token Expiring Soon!</b>\n\n` +
        `🕐 Token expires in: <b>${minutesLeft} minutes (~${hoursLeft}h)</b>\n\n` +
        `🔑 Renew now to avoid market data disruption:\n` +
        `1. Login → <a href="https://login.dhan.co">https://login.dhan.co</a>\n` +
        `2. Copy new Access Token\n` +
        `3. <code>POST /api/internal/update-dhan-token</code>\n\n` +
        `⚡ No server restart needed — token updates live.`
      );
    } else {
      console.log(`[DhanAdapter] ✅ Token health OK. Expires in ${minutesLeft} minutes (~${(minutesLeft/60).toFixed(1)}h).`);
    }
  }

  public stop(): void {
    console.log('[DhanAdapter] Stopping Dhan Market Data Adapter...');
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


  private connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws) {
        try {
          this.ws.removeAllListeners();
          this.ws.close();
        } catch (_) {}
        this.ws = null;
      }

      const fullWsUrl = `${this.wsUrl}?version=2&token=${encodeURIComponent(this.accessToken)}&clientId=${encodeURIComponent(this.clientId)}&authType=2`;
      console.log(`[DhanAdapter] Connecting to Dhan WebSocket Feed...`);

      let connectionResolved = false;
      const timeout = setTimeout(() => {
        if (!connectionResolved) {
          connectionResolved = true;
          console.warn('[DhanAdapter] WebSocket connection handshake timed out (3s). Proceeding with healthy state...');
          // Mark healthy = true as REST quotes are operational
          this.healthy = true;
          resolve(true);
        }
      }, 3000);

      try {
        this.ws = new WebSocket(fullWsUrl);

        this.ws.on('open', () => {
          console.log('[DhanAdapter] ✅ Connected to Dhan HQ WebSocket Feed!');
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
          this.lastTickTime = Date.now();
          this.healthy = true;
          try {
            if (Buffer.isBuffer(data)) {
              this.handleBinaryMessage(data);
            } else {
              this.handleJsonMessage(data.toString());
            }
          } catch (e: any) {
            console.warn('[DhanAdapter] Error parsing WebSocket message:', e.message);
          }
        });

        this.ws.on('error', (err: Error) => {
          console.error('[DhanAdapter] WebSocket Error:', err.message);
          this.healthy = false;
          if (!connectionResolved) {
            connectionResolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });

        this.ws.on('close', (code: number, reason: string) => {
          console.warn(`[DhanAdapter] WebSocket closed (code=${code}, reason=${reason || 'None'}). Reconnecting in 5s...`);
          this.healthy = false;
          this.scheduleReconnect();
        });
      } catch (err: any) {
        console.error('[DhanAdapter] Failed connecting WebSocket:', err.message);
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

    const list: Array<{ ExchangeSegment: string; SecurityId: string }> = [];
    for (const t of tokens) {
      const mapping = this.resolveSecurityMapping(t);
      if (mapping) {
        list.push({ ExchangeSegment: mapping.segment, SecurityId: mapping.securityId });
      }
    }

    if (list.length === 0) return;

    const payload = JSON.stringify({
      RequestCode: 15, // Ticker packet subscription
      InstrumentCount: list.length,
      InstrumentList: list
    });

    console.log(`[DhanAdapter] Sending Dhan WebSocket subscription payload for ${list.length} instruments...`);
    this.ws.send(payload);
  }

  private handleBinaryMessage(buf: Buffer): void {
    if (buf.length < 8) return;

    // Dhan binary packet structure parsing:
    // Header (byte 0: response code, byte 1..2: length, byte 4..7: security ID)
    const responseCode = buf.readUInt8(0);
    const securityId = buf.readInt32LE(4).toString();

    // Map securityId back to instrument token
    const token = this.findTokenBySecurityId(securityId);
    if (!token) return;

    let ltp = 0;
    let volume = 0;

    if (buf.length >= 16) {
      ltp = buf.readFloatLE(8);
    }
    if (buf.length >= 24) {
      volume = buf.readInt32LE(20);
    }

    if (ltp <= 0) return;

    const existing = this.tickCache.get(token);
    const open = existing ? existing.open : ltp;
    const high = existing ? Math.max(existing.high, ltp) : ltp;
    const low = existing ? Math.min(existing.low, ltp) : ltp;
    const close = existing ? existing.close : ltp;
    const change = Number((ltp - close).toFixed(2));
    const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;

    const tick: MarketTick = {
      instrumentToken: token,
      exchange: token.startsWith('BSE_') ? 'BSE' : 'NSE',
      symbol: token.replace(/^(NSE_|BSE_|NFO_)/, ''),
      ltp: Number(ltp.toFixed(2)),
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
      source: 'dhan',
      isSynthetic: false,
      timestamp: Date.now()
    };

    this.lastTickTime = Date.now();
    this.healthy = true;
    this.tickCache.set(token, tick);
    this.callbacks.forEach(cb => cb(tick));
  }

  private handleJsonMessage(str: string): void {
    let parsed: any;
    try {
      parsed = JSON.parse(str);
    } catch (_) {
      return;
    }

    if (parsed.status === 'success' && parsed.data) {
      for (const [segment, secObj] of Object.entries<any>(parsed.data)) {
        if (typeof secObj === 'object') {
          for (const [secId, item] of Object.entries<any>(secObj)) {
            const token = this.findTokenBySecurityId(secId);
            if (!token || !item || !item.last_price) continue;

            const ltp = Number(item.last_price);
            const open = Number(item.ohlc?.open || item.open || ltp);
            const high = Number(item.ohlc?.high || item.high || ltp);
            const low = Number(item.ohlc?.low || item.low || ltp);
            const close = Number(item.ohlc?.close || item.close || ltp);
            const volume = Number(item.volume || 0);
            const change = Number((ltp - close).toFixed(2));
            const changePercent = close > 0 ? Number(((change / close) * 100).toFixed(2)) : 0;

            const tick: MarketTick = {
              instrumentToken: token,
              exchange: token.startsWith('BSE_') ? 'BSE' : 'NSE',
              symbol: token.replace(/^(NSE_|BSE_|NFO_)/, ''),
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
              source: 'dhan',
              isSynthetic: false,
              timestamp: Date.now()
            };

            this.tickCache.set(token, tick);
            this.callbacks.forEach(cb => cb(tick));
          }
        }
      }
    }
  }

  public resolveSecurityMapping(token: string): { segment: string; securityId: string } | null {
    if (DhanAdapter.DHAN_SECURITY_MAP[token]) {
      return DhanAdapter.DHAN_SECURITY_MAP[token];
    }
    // Dynamic resolution based on token naming convention
    if (token.startsWith('NSE_NIFTY')) return { segment: 'NSE_INDEX', securityId: '13' };
    if (token.startsWith('NSE_BANKNIFTY')) return { segment: 'NSE_INDEX', securityId: '25' };
    if (token.startsWith('BSE_SENSEX')) return { segment: 'IDX_I', securityId: '51' };
    if (token.startsWith('NFO_')) return { segment: 'NSE_FNO', securityId: token.replace(/\D/g, '') || '54321' };
    if (token.startsWith('BFO_')) return { segment: 'BSE_FNO', securityId: token.replace(/\D/g, '') || '84321' };
    if (token.startsWith('NSE_')) return { segment: 'NSE_EQ', securityId: token.replace(/\D/g, '') || '2885' };
    if (token.startsWith('BSE_')) return { segment: 'BSE_EQ', securityId: token.replace(/\D/g, '') || '500325' };
    return null;
  }

  private findTokenBySecurityId(securityId: string): string | null {
    for (const [token, map] of Object.entries(DhanAdapter.DHAN_SECURITY_MAP)) {
      if (map.securityId === securityId) return token;
    }
    for (const token of this.subscribedTokens) {
      const map = this.resolveSecurityMapping(token);
      if (map && map.securityId === securityId) return token;
    }
    return null;
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    SafetyLock.assertSimulationOnly('DhanAdapter.subscribe');
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
    for (const token of instrumentTokens) {
      this.subscribedTokens.delete(token);
    }
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    SafetyLock.assertSimulationOnly('DhanAdapter.getQuote');

    const cached = this.tickCache.get(instrumentToken);
    if (cached) return cached;

    // Call Dhan REST Marketfeed Quote API
    const mapping = DhanAdapter.DHAN_SECURITY_MAP[instrumentToken];
    if (mapping) {
      try {
        const url = `${this.baseUrl}/v2/marketfeed/quote`;
        const payload = {
          [mapping.segment]: [parseInt(mapping.securityId, 10)]
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'access-token': this.accessToken,
            'client-id': this.clientId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json: any = await res.json();
          if (json.status === 'success' && json.data) {
            this.handleJsonMessage(JSON.stringify(json));
            const updated = this.tickCache.get(instrumentToken);
            if (updated) return updated;
          }
        }
      } catch (err: any) {
        console.warn(`[DhanAdapter] REST Quote API error for ${instrumentToken}:`, err.message);
      }
    }

    return null;
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]> {
    SafetyLock.assertSimulationOnly('DhanAdapter.getHistoricalCandles');

    const mapping = DhanAdapter.DHAN_SECURITY_MAP[instrumentToken];
    if (mapping) {
      try {
        const isIndex = mapping.segment.includes('INDEX') || instrumentToken.includes('NIFTY') || instrumentToken.includes('SENSEX');
        const segment = isIndex ? 'IDX_I' : mapping.segment;
        const instrument = isIndex ? 'INDEX' : 'EQUITY';

        const toDateStr = new Date().toISOString().split('T')[0];
        const fromDateObj = new Date();
        fromDateObj.setDate(fromDateObj.getDate() - Math.max(30, count));
        const fromDateStr = fromDateObj.toISOString().split('T')[0];

        const isIntraday = timeframe !== '1D';
        const url = `${this.baseUrl}/v2/charts/${isIntraday ? 'intraday' : 'historical'}`;
        const payload: any = {
          securityId: mapping.securityId,
          exchangeSegment: segment,
          instrument,
          expiryCode: 0,
          fromDate: fromDateStr,
          toDate: toDateStr
        };
        if (isIntraday) payload.interval = timeframe === '5M' ? '5' : timeframe === '15M' ? '15' : '1';

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'access-token': this.accessToken,
            'client-id': this.clientId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json: any = await res.json();
          const timestamps = json.timestamp || json.start_Time || [];
          if (Array.isArray(timestamps) && timestamps.length > 0) {
            const candles: Candle[] = [];
            for (let i = 0; i < timestamps.length; i++) {
              candles.push({
                time: timestamps[i],
                open: Number(json.open[i] || 0),
                high: Number(json.high[i] || 0),
                low: Number(json.low[i] || 0),
                close: Number(json.close[i] || 0),
                volume: Number(json.volume ? json.volume[i] : 0)
              });
            }
            if (candles.length > 0) return candles.slice(-count);
          }
        }
      } catch (err: any) {
        console.warn(`[DhanAdapter] Historical Candles error for ${instrumentToken}:`, err.message);
      }
    }

    // Synthetic Fallback Generator
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

  private static optionChainCache: Map<string, { timestamp: number; rows: OptionChainItem[] }> = new Map();

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    SafetyLock.assertSimulationOnly('DhanAdapter.getOptionChain');

    const cleanSym = (symbol || 'NIFTY').toUpperCase().replace(/^(NSE_|BSE_)/, '');
    const underlyingSeg = cleanSym === 'SENSEX' ? 'IDX_I' : 'IDX_I';
    const underlyingScrip = cleanSym === 'SENSEX' ? 51 : cleanSym === 'BANKNIFTY' ? 25 : cleanSym === 'FINNIFTY' ? 27 : 13;
    let targetExpiry = expiry ? expiry.trim() : '';
    if (!targetExpiry) {
      const { ExpiryCalendarService } = require('../services/ExpiryCalendarService');
      const cat = await ExpiryCalendarService.getInstance().getValidExpiries(cleanSym);
      targetExpiry = cat.nearestExpiry || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    }
    const cacheKey = `${cleanSym}_${targetExpiry}`;

    const cached = DhanAdapter.optionChainCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 2000) {
      return cached.rows;
    }

    try {
      const url = `${this.baseUrl}/v2/optionchain`;
      const payload = {
        UnderlyingScrip: underlyingScrip,
        UnderlyingSeg: underlyingSeg,
        Expiry: targetExpiry
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'access-token': this.accessToken,
          'client-id': this.clientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json: any = await res.json();
        if (json.status === 'success' && json.data) {
          const spot = Number(json.data.last_price || json.data.spot_price || 0);
          const oc = json.data.oc || {};

          const rows: OptionChainItem[] = [];
          const { MarketDataEngine } = require('./MarketDataEngine');
          const engine = MarketDataEngine.getInstance();

          if (spot > 0) {
            const spotToken = cleanSym === 'SENSEX' ? 'BSE_SENSEX' : `NSE_${cleanSym}`;
            engine.setCachedTick({
              instrumentToken: spotToken,
              exchange: cleanSym === 'SENSEX' ? 'BSE' : 'NSE',
              symbol: cleanSym,
              tradingSymbol: cleanSym === 'SENSEX' ? 'BSE SENSEX' : `NSE ${cleanSym}`,
              ltp: spot,
              open: spot,
              high: spot * 1.002,
              low: spot * 0.998,
              close: spot,
              change: 0,
              changePercent: 0,
              volume: 5000000,
              source: 'dhan_feed',
              isSynthetic: false,
              timestamp: Date.now()
            });
            this.tickCache.set(spotToken, engine.getCachedTick(spotToken)!);
          }

          const optPrefix = cleanSym === 'SENSEX' ? 'BFO' : 'NFO';
          const optSeg = cleanSym === 'SENSEX' ? 'BSE_FNO' : 'NSE_FNO';

          for (const [strikeStr, strikeData] of Object.entries<any>(oc)) {
            const strikePrice = parseFloat(strikeStr);
            const ceData = strikeData.ce || {};
            const peData = strikeData.pe || {};

            const ceSecurityId = String(ceData.security_id || '');
            const peSecurityId = String(peData.security_id || '');

            const ceToken = ceSecurityId ? `${optPrefix}_${ceSecurityId}` : `${optPrefix}_${cleanSym}_${strikePrice}_CE`;
            const peToken = peSecurityId ? `${optPrefix}_${peSecurityId}` : `${optPrefix}_${cleanSym}_${strikePrice}_PE`;

            if (ceSecurityId) {
              DhanAdapter.DHAN_SECURITY_MAP[`${optPrefix}_${cleanSym}_${strikePrice}_CE`] = { segment: optSeg, securityId: ceSecurityId };
              DhanAdapter.DHAN_SECURITY_MAP[ceToken] = { segment: optSeg, securityId: ceSecurityId };
            }
            if (peSecurityId) {
              DhanAdapter.DHAN_SECURITY_MAP[`${optPrefix}_${cleanSym}_${strikePrice}_PE`] = { segment: optSeg, securityId: peSecurityId };
              DhanAdapter.DHAN_SECURITY_MAP[peToken] = { segment: optSeg, securityId: peSecurityId };
            }

            const ceLtp = Number(ceData.last_price || ceData.ltp || 0);
            const peLtp = Number(peData.last_price || peData.ltp || 0);

            const ceGreeks = ceData.greeks || {};
            const peGreeks = peData.greeks || {};

            if (ceLtp > 0) {
              engine.setCachedTick({
                instrumentToken: ceToken,
                exchange: cleanSym === 'SENSEX' ? 'BSE' : 'NSE',
                symbol: `${cleanSym}${strikePrice}CE`,
                ltp: ceLtp,
                open: Number(ceData.open || ceLtp),
                high: Number(ceData.high || ceLtp),
                low: Number(ceData.low || ceLtp),
                close: Number(ceData.close || ceLtp),
                volume: Number(ceData.volume || 0),
                change: Number(ceData.change || 0),
                changePercent: 0,
                bid: Number(ceData.top_bid_price || ceData.bid || ceLtp * 0.995),
                ask: Number(ceData.top_ask_price || ceData.ask || ceLtp * 1.005),
                timestamp: Date.now()
              });
            }

            if (peLtp > 0) {
              engine.setCachedTick({
                instrumentToken: peToken,
                exchange: cleanSym === 'SENSEX' ? 'BSE' : 'NSE',
                symbol: `${cleanSym}${strikePrice}PE`,
                ltp: peLtp,
                open: Number(peData.open || peLtp),
                high: Number(peData.high || peLtp),
                low: Number(peData.low || peLtp),
                close: Number(peData.close || peLtp),
                volume: Number(peData.volume || 0),
                change: Number(peData.change || 0),
                changePercent: 0,
                bid: Number(peData.top_bid_price || peData.bid || peLtp * 0.995),
                ask: Number(peData.top_ask_price || peData.ask || peLtp * 1.005),
                timestamp: Date.now()
              });
            }

            rows.push({
              strikePrice,
              expiry: targetExpiry,
              ce: {
                instrumentToken: ceToken,
                ltp: ceLtp,
                bid: Number(ceData.top_bid_price || ceData.bid || 0),
                ask: Number(ceData.top_ask_price || ceData.ask || 0),
                change: Number(ceData.change || 0),
                volume: Number(ceData.volume || 0),
                openInterest: Number(ceData.oi || ceData.open_interest || 0),
                iv: Number(ceData.implied_volatility || ceData.iv || 11.4),
                delta: Number(ceGreeks.delta || 0.5),
                gamma: Number(ceGreeks.gamma || 0.001),
                theta: Number(ceGreeks.theta || -10),
                vega: Number(ceGreeks.vega || 5),
              },
              pe: {
                instrumentToken: peToken,
                ltp: peLtp,
                bid: Number(peData.top_bid_price || peData.bid || 0),
                ask: Number(peData.top_ask_price || peData.ask || 0),
                change: Number(peData.change || 0),
                volume: Number(peData.volume || 0),
                openInterest: Number(peData.oi || peData.open_interest || 0),
                iv: Number(peData.implied_volatility || peData.iv || 10.4),
                delta: Number(peGreeks.delta || -0.5),
                gamma: Number(peGreeks.gamma || 0.001),
                theta: Number(peGreeks.theta || -10),
                vega: Number(peGreeks.vega || 5),
              }
            });
          }

          if (rows.length > 0) return rows.sort((a, b) => a.strikePrice - b.strikePrice);
        }
      }
    } catch (err: any) {
      console.warn(`[DhanAdapter] Live Option Chain API error for ${cleanSym}:`, err.message);
    }

    return [];
  }

  /**
   * Calls Dhan HQ official POST /margincalculator API according to Dhan v2 spec.
   */
  public async calculateMargin(params: {
    exchangeSegment: string;
    transactionType: 'BUY' | 'SELL';
    quantity: number;
    productType: string;
    securityId: string;
    price: number;
  }): Promise<any> {
    try {
      const url = `${this.baseUrl}/v2/margincalculator`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'access-token': this.accessToken,
          'client-id': this.clientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dhanClientId: this.clientId,
          exchangeSegment: params.exchangeSegment,
          transactionType: params.transactionType,
          quantity: params.quantity,
          productType: params.productType,
          securityId: params.securityId,
          price: params.price
        })
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      console.warn('[DhanAdapter] Margin Calculator API error:', err.message);
    }
    return null;
  }
}
