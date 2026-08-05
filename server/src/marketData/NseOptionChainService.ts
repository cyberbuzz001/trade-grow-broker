/**
 * NseOptionChainService.ts
 * Fetches OI, PCR, Max Pain from NSE India's unofficial API every 60s.
 * Merges this data into the live Angel One option chain tick cache.
 *
 * NSE endpoint: https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY
 * Requires: session cookies from homepage hit first.
 */

import { EventEmitter } from 'events';

export interface NseStrikeData {
  strikePrice: number;
  expiryDate:  string;
  CE?: { openInterest: number; changeinOpenInterest: number; impliedVolatility: number; lastPrice: number; totalTradedVolume: number; change: number; pChange: number };
  PE?: { openInterest: number; changeinOpenInterest: number; impliedVolatility: number; lastPrice: number; totalTradedVolume: number; change: number; pChange: number };
}

export interface NseChainSummary {
  pcr:       number;
  maxPain:   number;
  atmStrike: number;
  strikewise: Record<number, NseStrikeData>;
  updatedAt:  number;
}

const NSE_BASE    = 'https://www.nseindia.com';
const NSE_OC_PAGE = 'https://www.nseindia.com/option-chain';

const NSE_HEADERS: Record<string, string> = {
  'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept':                    'application/json, text/plain, */*',
  'Accept-Language':           'en-US,en;q=0.9,hi;q=0.8',
  'Accept-Encoding':           'gzip, deflate, br',
  'Referer':                   NSE_OC_PAGE,
  'Origin':                    NSE_BASE,
  'Connection':                'keep-alive',
  'DNT':                       '1',
  'Sec-Fetch-Dest':            'empty',
  'Sec-Fetch-Mode':            'cors',
  'Sec-Fetch-Site':            'same-origin',
  'Sec-CH-UA':                 '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  'Sec-CH-UA-Mobile':          '?0',
  'Sec-CH-UA-Platform':        '"Windows"',
  'X-Requested-With':          'XMLHttpRequest',
};

export class NseOptionChainService extends EventEmitter {
  private cookies:    string = '';
  private cookieAge:  number = 0;
  private cache:      Record<string, NseChainSummary> = {};
  private timer:      NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL = 60_000;  // 60 seconds
  private readonly COOKIE_TTL       = 5 * 60_000; // 5 minutes

  public start(): void {
    console.log('[NseOI] Starting NSE option chain OI fetcher (60s interval)…');
    void this.refreshAll();
    this.timer = setInterval(() => void this.refreshAll(), this.REFRESH_INTERVAL);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  public getSummary(symbol: string): NseChainSummary | null {
    return this.cache[symbol.toUpperCase()] ?? null;
  }

  public getOiForStrike(symbol: string, strike: number): { ceOi: number; peOi: number; ceIv: number; peIv: number } {
    const summary = this.cache[symbol.toUpperCase()];
    if (!summary) return { ceOi: 0, peOi: 0, ceIv: 0, peIv: 0 };
    const row = summary.strikewise[strike];
    return {
      ceOi: row?.CE?.openInterest ?? 0,
      peOi: row?.PE?.openInterest ?? 0,
      ceIv: row?.CE?.impliedVolatility ?? 0,
      peIv: row?.PE?.impliedVolatility ?? 0,
    };
  }

  // ── Cookie management ──────────────────────────────────────────────────────
  private parseCookies(res: Response): string {
    // Node fetch provides set-cookie as a single joined string or array via getSetCookie()
    try {
      const setCookies: string[] = (res as any).headers.getSetCookie?.() ?? [];
      if (setCookies.length > 0) {
        return setCookies.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
      }
    } catch (_) {}
    // Fallback for older fetch implementations
    const raw = res.headers.get('set-cookie') ?? '';
    return raw.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  }

  private async refreshCookies(): Promise<void> {
    // Step 1: hit homepage
    try {
      const res1 = await fetch(NSE_BASE, {
        headers: { ...NSE_HEADERS, 'Referer': NSE_BASE },
        signal: AbortSignal.timeout(12000),
      });
      const cookies1 = this.parseCookies(res1);

      // Step 2: hit the option-chain page with homepage cookies (builds session)
      const res2 = await fetch(NSE_OC_PAGE, {
        headers: { ...NSE_HEADERS, 'Referer': NSE_BASE, 'Cookie': cookies1 },
        signal: AbortSignal.timeout(12000),
      });
      const cookies2 = this.parseCookies(res2);
      // Merge both sets
      const all = new Map<string, string>();
      for (const pair of (cookies1 + '; ' + cookies2).split(';')) {
        const [k, ...rest] = pair.trim().split('=');
        if (k) all.set(k.trim(), rest.join('=').trim());
      }
      this.cookies  = [...all.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      this.cookieAge = Date.now();
      console.log('[NseOI] Session cookies refreshed (' + all.size + ' cookies)');
    } catch (e: any) {
      console.warn('[NseOI] Cookie refresh failed:', e.message);
    }
  }

  private async getCookies(): Promise<string> {
    if (!this.cookies || Date.now() - this.cookieAge > this.COOKIE_TTL) {
      await this.refreshCookies();
    }
    return this.cookies;
  }

  // ── Fetch & parse option chain ─────────────────────────────────────────────
  private async fetchNseChain(symbol: string, expiry?: string): Promise<NseChainSummary | null> {
    // NSE has two endpoints: indices and equities
    const isIndex = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'].includes(symbol.toUpperCase());
    const url = isIndex
      ? `${NSE_BASE}/api/option-chain-indices?symbol=${symbol.toUpperCase()}`
      : `${NSE_BASE}/api/option-chain-equities?symbol=${symbol.toUpperCase()}`;
    try {
      const cookies = await this.getCookies();
      const res = await fetch(url, {
        headers: { ...NSE_HEADERS, Cookie: cookies },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        // Force cookie refresh on auth errors or 404
        this.cookies = '';
        console.warn(`[NseOI] HTTP ${res.status} for ${symbol} — will refresh cookies`);
        return null;
      }

      const data = await res.json();
      return this.parseNseResponse(data, expiry);
    } catch (e: any) {
      console.warn(`[NseOI] Fetch error for ${symbol}: ${e.message}`);
      return null;
    }
  }

  private parseNseResponse(data: any, targetExpiry?: string): NseChainSummary | null {
    try {
      const records: any[] = data?.records?.data ?? [];
      const expiryDates: string[] = data?.records?.expiryDates ?? [];

      // Pick target expiry (nearest weekly)
      const useExpiry = targetExpiry ?? expiryDates[0] ?? '';

      const strikewise: Record<number, NseStrikeData> = {};
      let totalCeOi = 0;
      let totalPeOi = 0;
      const painMap: Record<number, number> = {};

      for (const row of records) {
        if (useExpiry && row.expiryDate !== useExpiry) continue;
        const strike = row.strikePrice;
        strikewise[strike] = {
          strikePrice: strike,
          expiryDate:  row.expiryDate,
          CE: row.CE ? {
            openInterest:          row.CE.openInterest ?? 0,
            changeinOpenInterest:  row.CE.changeinOpenInterest ?? 0,
            impliedVolatility:     row.CE.impliedVolatility ?? 0,
            lastPrice:             row.CE.lastPrice ?? 0,
            totalTradedVolume:     row.CE.totalTradedVolume ?? 0,
            change:                row.CE.change ?? 0,
            pChange:               row.CE.pChange ?? 0,
          } : undefined,
          PE: row.PE ? {
            openInterest:          row.PE.openInterest ?? 0,
            changeinOpenInterest:  row.PE.changeinOpenInterest ?? 0,
            impliedVolatility:     row.PE.impliedVolatility ?? 0,
            lastPrice:             row.PE.lastPrice ?? 0,
            totalTradedVolume:     row.PE.totalTradedVolume ?? 0,
            change:                row.PE.change ?? 0,
            pChange:               row.PE.pChange ?? 0,
          } : undefined,
        };

        totalCeOi += row.CE?.openInterest ?? 0;
        totalPeOi += row.PE?.openInterest ?? 0;

        // Max Pain: sum of loss at each strike
        const ceOi = row.CE?.openInterest ?? 0;
        const peOi = row.PE?.openInterest ?? 0;
        for (const s2 of Object.keys(strikewise).map(Number)) {
          painMap[strike] = (painMap[strike] ?? 0) +
            ceOi * Math.max(0, strike - s2) +
            peOi * Math.max(0, s2 - strike);
        }
      }

      // Max Pain = strike with minimum total loss for option writers
      const maxPain = Object.entries(painMap).reduce(
        (acc, [s, pain]) => pain < acc.minPain ? { strike: Number(s), minPain: pain } : acc,
        { strike: 0, minPain: Infinity }
      ).strike;

      const pcr = totalCeOi > 0 ? Number((totalPeOi / totalCeOi).toFixed(2)) : 0;
      const spot = data?.records?.underlyingValue ?? 0;
      const step = 50;
      const atmStrike = Math.round(spot / step) * step;

      return { pcr, maxPain, atmStrike, strikewise, updatedAt: Date.now() };
    } catch (e: any) {
      console.warn('[NseOI] Parse error:', e.message);
      return null;
    }
  }

  private async refreshAll(): Promise<void> {
    for (const sym of ['NIFTY', 'BANKNIFTY', 'FINNIFTY']) {
      const summary = await this.fetchNseChain(sym);
      if (summary) {
        this.cache[sym] = summary;
        this.emit('update', sym, summary);
        console.log(`[NseOI] ${sym}: PCR=${summary.pcr} MaxPain=${summary.maxPain} ATM=${summary.atmStrike}`);
      }
      // Rate limit: wait 5s between symbols
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Singleton
export const nseOptionChainService = new NseOptionChainService();
