import { IMarketDataProvider } from './IMarketDataProvider';
import { MarketTick, Candle, OptionChainItem, TickCallback } from './types';
import { SafetyLock } from '../services/SafetyLock';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { OptionChainEngine } from './OptionChainEngine';
import { GreeksEngine } from './GreeksEngine';
import { nseOptionChainService } from './NseOptionChainService';

export class AngelOneAdapter implements IMarketDataProvider {
  public readonly name = 'ANGEL_ONE';
  private healthy = false;
  private childProc: ChildProcess | null = null;
  private chainProc: ChildProcess | null = null;
  private timer: NodeJS.Timeout | null = null;
  private chainTimer: NodeJS.Timeout | null = null;
  private callbacks: Set<TickCallback> = new Set();
  private tickCache: Map<string, MarketTick> = new Map();

  // Live option chain data from angel_option_chain.py
  private optionChainData: any = null;
  private chainFilePath: string = '';

  public isHealthy(): boolean {
    return this.healthy;
  }

  public async initialize(): Promise<void> {
    console.log('[AngelOneAdapter] Spawning Python SmartConnect live ticker process...');
    SafetyLock.assertSimulationOnly('AngelOneAdapter.initialize');

    // ── Locate scripts & data files ──────────────────────────────────────
    let tickerScript = path.resolve(__dirname, 'angel_ticker.py');
    if (!fs.existsSync(tickerScript)) {
      tickerScript = path.resolve(__dirname, '../../src/marketData/angel_ticker.py');
    }
    let chainScript = path.resolve(__dirname, 'angel_option_chain.py');
    if (!fs.existsSync(chainScript)) {
      chainScript = path.resolve(__dirname, '../../src/marketData/angel_option_chain.py');
    }

    // Resolve angel_ticks.json path
    let ticksFilePath = path.resolve(__dirname, '../../data/angel_ticks.json');
    if (!fs.existsSync(ticksFilePath)) ticksFilePath = path.resolve(__dirname, '../data/angel_ticks.json');
    if (!fs.existsSync(ticksFilePath)) ticksFilePath = path.resolve(process.cwd(), 'server/data/angel_ticks.json');

    // Resolve angel_option_chain.json path
    const possibleChainPaths = [
      path.resolve(__dirname, '../../data/angel_option_chain.json'),
      path.resolve(__dirname, '../data/angel_option_chain.json'),
      path.resolve(process.cwd(), 'server/data/angel_option_chain.json'),
    ];
    this.chainFilePath = possibleChainPaths[0]; // will create dir if needed
    try {
      fs.mkdirSync(path.dirname(this.chainFilePath), { recursive: true });
    } catch (_) {}

    try {
      // ── Spawn live price ticker ──────────────────────────────────────
      this.childProc = spawn('python', [tickerScript], { env: { ...process.env }, stdio: 'inherit' });
      this.healthy = true;

      // Poll angel_ticks.json for real-time Angel One quotes
      this.timer = setInterval(() => {
        if (fs.existsSync(ticksFilePath)) {
          try {
            const raw = fs.readFileSync(ticksFilePath, 'utf-8');
            if (raw) {
              const data = JSON.parse(raw);
              for (const [token, tick] of Object.entries<MarketTick>(data)) {
                this.tickCache.set(token, tick);
                this.callbacks.forEach(cb => cb(tick));
              }
            }
          } catch (e) { /* read race condition ignored */ }
        }
      }, 1000);

      // ── Spawn option chain WebSocket fetcher (angel_option_ws.py) ─────────
      const wsChainScript = fs.existsSync(path.resolve(__dirname, 'angel_option_ws.py'))
        ? path.resolve(__dirname, 'angel_option_ws.py')
        : path.resolve(__dirname, '../../src/marketData/angel_option_ws.py');

      const spawnChainScript = () => {
        if (fs.existsSync(wsChainScript)) {
          console.log('[AngelOneAdapter] Spawning Option Chain WebSocket process (SmartWebSocketV2)...');
          this.chainProc = spawn('python', [wsChainScript], { env: { ...process.env }, stdio: 'inherit' });
          this.chainProc.on('exit', (code) => {
            console.warn(`[AngelOneAdapter] Option chain process exited (code=${code}). Will restart in 20s...`);
            setTimeout(spawnChainScript, 20000);
          });
        } else {
          console.warn('[AngelOneAdapter] angel_option_ws.py not found — no live option chain');
        }
      };

      // Delay 15s so ticker auth completes first (Angel One rate-limits concurrent logins)
      setTimeout(spawnChainScript, 15000);

      // Poll angel_option_chain.json every 500ms (written by angel_option_ws.py)
      this.chainTimer = setInterval(() => {
        const fp = this.chainFilePath;
        if (fs.existsSync(fp)) {
          try {
            const raw = fs.readFileSync(fp, 'utf-8');
            if (raw) this.optionChainData = JSON.parse(raw);
          } catch (_) {}
        }
      }, 500);  // 500ms matches the write interval in angel_option_ws.py

      // ── Start NSE OI fetcher (OI, PCR, Max Pain every 60s) ─────────────
      nseOptionChainService.start();

    } catch (err: any) {
      console.error('[AngelOneAdapter] Failed to spawn Angel ticker process:', err.message);
      this.healthy = false;
    }
  }

  public subscribe(instrumentTokens: string[], callback: TickCallback): void {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.subscribe');
    this.callbacks.add(callback);
  }

  public unsubscribe(instrumentTokens: string[]): void {
    // Unsubscribe logic
  }

  public async getQuote(instrumentToken: string): Promise<MarketTick | null> {
    return this.tickCache.get(instrumentToken) || null;
  }

  public async getHistoricalCandles(instrumentToken: string, timeframe: string, count: number): Promise<Candle[]> {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.getHistoricalCandles');

    // CRITICAL: Snapshot the live tick LTP right now — the last candle's close
    // must equal this exact value so it connects seamlessly to the live WebSocket tick.
    const tick = this.tickCache.get(instrumentToken);
    const anchorLtp = tick ? tick.ltp : 1000.0;
    const volatility = anchorLtp * 0.0008; // 0.08% per candle — realistic noise

    const candles: Candle[] = [];
    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = timeframe === '1m' ? 60 : timeframe === '5m' ? 300 :
                            timeframe === '15m' ? 900 : timeframe === '1h' ? 3600 : 86400;

    // Walk BACKWARDS from anchorLtp so the last candle close == anchorLtp exactly
    let currentClose = anchorLtp;
    for (let i = count; i >= 0; i--) {
      const candleTime = now - (i * intervalSeconds);
      const isLast = (i === 0);

      const close = isLast ? anchorLtp : Number(currentClose.toFixed(2));
      const openDelta = (Math.random() - 0.49) * volatility * 2;
      const open = isLast
        ? Number((anchorLtp - (Math.random() * volatility)).toFixed(2))
        : Number((close - openDelta).toFixed(2));

      const high = Number((Math.max(open, close) + Math.random() * volatility).toFixed(2));
      const low  = Number((Math.min(open, close) - Math.random() * volatility).toFixed(2));
      const volume = Math.floor(Math.random() * 50000) + 1000;

      candles.push({ time: candleTime, open, high, low, close, volume });
      currentClose = open; // walk backwards: next iteration's close = this open
    }

    return candles; // chronological, last close == anchorLtp
  }

  public async getOptionChain(symbol: string, expiry: string): Promise<OptionChainItem[]> {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.getOptionChain');

    const sym = (symbol || 'NIFTY').toUpperCase();
    const niftyTick = this.tickCache.get('NSE_NIFTY50');
    const bankTick  = this.tickCache.get('NSE_BANKNIFTY');
    const spotPrice = sym.includes('BANK')
      ? (bankTick?.ltp  || 52000)
      : (niftyTick?.ltp || 24500);

    // ── If live option chain data is available, use it ──────────────────────
    if (this.optionChainData?.chains?.[sym]?.[expiry]) {
      const chainData = this.optionChainData.chains[sym][expiry];
      const spot = chainData.spot || spotPrice;
      const rows: OptionChainItem[] = [];
      const nseSummary = nseOptionChainService.getSummary(sym);

      for (const row of chainData.rows) {
        const strike = row.strikePrice;
        const timeToExpiry = Math.max(1, Math.ceil(
          (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )) / 365.0;

        // Merge NSE OI & IV if available (refreshed every 60s)
        const nseData = nseSummary ? nseOptionChainService.getOiForStrike(sym, strike) : null;

        const ceLtp = row.ce?.ltp || 0;
        const peLtp = row.pe?.ltp || 0;

        // Use NSE IV when available (more accurate), fallback to smile approximation
        const ceIv = (nseData?.ceIv && nseData.ceIv > 0) ? nseData.ceIv : 14.5 + Math.abs(strike - Math.round(spot / 50) * 50) / 50 * 0.2;
        const peIv = (nseData?.peIv && nseData.peIv > 0) ? nseData.peIv : ceIv + 0.5;

        const ceGreeks = GreeksEngine.calculateGreeks(spot, strike, timeToExpiry, true,  ceIv / 100);
        const peGreeks = GreeksEngine.calculateGreeks(spot, strike, timeToExpiry, false, peIv / 100);

        // Use NSE OI when available, otherwise use WS oi field, then synthetic
        const ceOi = nseData?.ceOi || row.ce?.oi || Math.floor(Math.random() * 1800000) + 300000;
        const peOi = nseData?.peOi || row.pe?.oi || Math.floor(Math.random() * 1600000) + 250000;
        const ceVol = row.ce?.volume || Math.floor(Math.random() * 250000) + 60000;
        const peVol = row.pe?.volume || Math.floor(Math.random() * 220000) + 50000;

        rows.push({
          strikePrice: strike,
          expiry,
          ce: {
            instrumentToken: row.ce?.token || `NFO_${sym}_${strike}_CE`,
            ltp:   ceLtp,
            change: row.ce?.change || 0,
            volume: ceVol,
            openInterest: ceOi,
            iv:    ceGreeks.iv,
            delta: ceGreeks.delta,
            gamma: ceGreeks.gamma,
            theta: ceGreeks.theta,
            vega:  ceGreeks.vega,
          },
          pe: {
            instrumentToken: row.pe?.token || `NFO_${sym}_${strike}_PE`,
            ltp:   peLtp,
            change: row.pe?.change || 0,
            volume: peVol,
            openInterest: peOi,
            iv:    peGreeks.iv,
            delta: peGreeks.delta,
            gamma: peGreeks.gamma,
            theta: peGreeks.theta,
            vega:  peGreeks.vega,
          },
        });
      }

      if (rows.length > 0) return rows;
    }

    const res = await OptionChainEngine.generateOptionChain({ symbol: sym, spotPrice, expiry });
    return res.chain;
  }


  /** Returns real expiry dates from Instrument Master for a given symbol */

  public getOptionExpiries(symbol: string): string[] {
    const sym = (symbol || 'NIFTY').toUpperCase();
    const expiries: string[] = this.optionChainData?.expiries?.[sym] || [];
    // If no real data yet, return synthetic weekly expiries
    if (expiries.length === 0) {
      const dates: string[] = [];
      const base = new Date();
      for (let w = 0; w < 5; w++) {
        const d = new Date(base);
        d.setDate(d.getDate() + (7 - d.getDay() + 4) % 7 + w * 7); // next Thursday
        dates.push(d.toISOString().slice(0, 10));
      }
      return dates;
    }
    return expiries;
  }

  // EXPLICIT SAFETY BARRIER
  public placeBrokerOrder(): void {
    SafetyLock.assertSimulationOnly('AngelOneAdapter.placeBrokerOrder');
    throw new Error('REAL-MONEY TRADING IS DISABLED. Real broker order placement is forbidden.');
  }

  public destroy(): void {
    if (this.timer)      clearInterval(this.timer);
    if (this.chainTimer) clearInterval(this.chainTimer);
    if (this.childProc)  this.childProc.kill();
    if (this.chainProc)  this.chainProc.kill();
  }
}
