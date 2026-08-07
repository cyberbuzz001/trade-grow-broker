import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { query, queryOne, execute, withTransaction } from '../db/schema';
import { generateUUID } from '../utils/crypto';

function parseAngelExpiryToYYYYMMDD(str?: string): string | null {
  if (!str || str.trim() === '') return null;
  const clean = str.trim().toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };

  const match = clean.match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = months[match[2]];
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-${day}`;
  }
  return null;
}

export interface RawScripRecord {
  token: string;
  symbol: string;
  name: string;
  expiry: string;
  strike: string;
  lotsize: string;
  instrumenttype: string;
  exch_seg: string;
  tick_size: string;
}

export interface CanonicalInstrument {
  id: string;
  instrument_token: string;
  exchange: string;
  segment: string;
  symbol: string;
  trading_symbol: string;
  name: string;
  lot_size: number;
  tick_size: number;
  strike: number;
  option_type: 'CE' | 'PE' | 'XX';
  expiry: string | null;
  instrument_type: string;
  active: boolean;
}

export class InstrumentMasterService {
  private static instance: InstrumentMasterService;
  private masterUrl = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';

  private isReady: boolean = false;
  private lastSyncTimestamp: number = 0;
  private totalTokensLoaded: number = 0;
  private lastVersionId: string = '';
  private tokenLookupCache: Map<string, string> = new Map();
  private unmappedMisses5m: { securityId: string; timestamp: number }[] = [];
  private isResyncing: boolean = false;

  public static getInstance(): InstrumentMasterService {
    if (!InstrumentMasterService.instance) {
      InstrumentMasterService.instance = new InstrumentMasterService();
    }
    return InstrumentMasterService.instance;
  }

  public isMasterReady(): boolean {
    return this.isReady;
  }

  public getHealthStatus() {
    this.cleanUnmappedMisses();
    return {
      isReady: this.isReady,
      lastSyncTimestamp: this.lastSyncTimestamp,
      lastSyncDate: this.lastSyncTimestamp > 0 ? new Date(this.lastSyncTimestamp).toISOString() : null,
      totalTokensLoaded: this.totalTokensLoaded,
      unmappedTickCount5m: this.unmappedMisses5m.length,
      versionId: this.lastVersionId,
    };
  }

  private cleanUnmappedMisses(): void {
    const fiveMinsAgo = Date.now() - (5 * 60 * 1000);
    this.unmappedMisses5m = this.unmappedMisses5m.filter(m => m.timestamp >= fiveMinsAgo);
  }

  /**
   * High-performance in-memory lookup for live tick security IDs.
   * Tracks miss counter and triggers emergency re-sync if misses exceed threshold in 5m.
   */
  public findTokenBySecurityId(securityId: string): string | null {
    if (!securityId) return null;
    const cleanId = String(securityId).trim();
    const token = this.tokenLookupCache.get(cleanId);
    if (token) return token;

    // Record unmapped miss
    const now = Date.now();
    this.unmappedMisses5m.push({ securityId: cleanId, timestamp: now });
    this.cleanUnmappedMisses();

    if (this.unmappedMisses5m.length >= 20 && !this.isResyncing) {
      console.warn(`[InstrumentMasterService] Unmapped security ID misses reached ${this.unmappedMisses5m.length} in 5m. Triggering emergency Scrip Master re-sync...`);
      this.isResyncing = true;
      void this.syncMasterData().finally(() => { this.isResyncing = false; });
    }

    return null;
  }

  /**
   * Initializes Instrument Master on server startup.
   * Loads existing token lookup cache from DB, downloads latest master JSON, and blocks if DB is empty.
   */
  public async initializeOnStartup(): Promise<void> {
    console.log('[InstrumentMasterService] Initializing Scrip Master on server startup...');
    try {
      // 1. Populate tokenLookupCache from existing database
      const rows = await query<{ instrument_token: string; trading_symbol: string }>(
        'SELECT instrument_token, trading_symbol FROM instruments WHERE active = TRUE'
      );
      rows.forEach(r => {
        if (r.instrument_token) {
          const rawToken = r.instrument_token.replace(/^([A-Z]+_)/, '');
          this.tokenLookupCache.set(rawToken, r.instrument_token);
          this.tokenLookupCache.set(r.instrument_token, r.instrument_token);
          if (r.trading_symbol) {
            this.tokenLookupCache.set(r.trading_symbol, r.instrument_token);
          }
        }
      });

      this.totalTokensLoaded = rows.length;
      console.log(`[InstrumentMasterService] Loaded ${rows.length} existing active tokens into lookup cache.`);

      if (rows.length === 0) {
        console.log('[InstrumentMasterService] No instruments found in database. Performing initial blocking sync...');
        await this.syncMasterData();
      } else {
        // Trigger background sync to ensure latest expiries/strikes are fresh
        this.isReady = true;
        void this.syncMasterData();
      }

      // Schedule daily recurring scrip master sync (runs every 24 hours to keep strike IDs fresh)
      setInterval(() => {
        console.log('[InstrumentMasterService] Running scheduled daily scrip master sync...');
        void this.syncMasterData();
      }, 24 * 60 * 60 * 1000);
    } catch (err: any) {
      console.warn('[InstrumentMasterService] Startup master initialization fallback:', err.message);
      this.isReady = true;
    }
  }

  /**
   * Downloads official Angel One Scrip Master JSON file
   */
  public async downloadMasterJson(): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempPath = path.resolve(__dirname, '../../../data/OpenAPIScripMaster.json');
      osEnsureDir(path.dirname(tempPath));

      https.get(this.masterUrl, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed download. HTTP Status: ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(tempPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(tempPath);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Syncs Official Master Dataset into PostgreSQL Database
   */
  public async syncMasterData(sampleData?: RawScripRecord[]): Promise<{
    versionId: string;
    totalParsed: number;
    inserted: number;
    updated: number;
  }> {
    const startTime = Date.now();
    const versionId = `VER_${generateUUID()}`;

    let rawRecords: RawScripRecord[] = [];

    if (sampleData && sampleData.length > 0) {
      rawRecords = sampleData;
    } else {
      try {
        const filePath = await this.downloadMasterJson();
        const rawText = fs.readFileSync(filePath, 'utf-8');
        rawRecords = JSON.parse(rawText);
      } catch (err: any) {
        console.warn(`[InstrumentMasterService] Master download fallback to seed data: ${err.message}`);
        rawRecords = [
          { token: "2885",     symbol: "RELIANCE-EQ",           name: "RELIANCE",   expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "11536",    symbol: "TCS-EQ",                name: "TCS",        expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "1594",     symbol: "INFY-EQ",               name: "INFY",       expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "1333",     symbol: "HDFCBANK-EQ",           name: "HDFCBANK",   expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "4963",     symbol: "ICICIBANK-EQ",          name: "ICICIBANK",  expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "3456",     symbol: "TATAMOTORS-EQ",         name: "TATAMOTORS", expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "",       exch_seg: "NSE", tick_size: "0.05" },
          { token: "99926000", symbol: "NIFTY 50",              name: "NIFTY 50",   expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "AMXIDX", exch_seg: "NSE", tick_size: "0.05" },
          { token: "99926009", symbol: "BANKNIFTY",             name: "BANKNIFTY",  expiry: "", strike: "-1.0", lotsize: "1",  instrumenttype: "AMXIDX", exch_seg: "NSE", tick_size: "0.05" },
          { token: "49231",    symbol: "NIFTY28AUG2624500CE",   name: "NIFTY",      expiry: "28AUG2026", strike: "24500.0", lotsize: "25", instrumenttype: "OPTIDX", exch_seg: "NFO", tick_size: "0.05" },
          { token: "49232",    symbol: "NIFTY28AUG2624500PE",   name: "NIFTY",      expiry: "28AUG2026", strike: "24500.0", lotsize: "25", instrumenttype: "OPTIDX", exch_seg: "NFO", tick_size: "0.05" }
        ];
      }
    }

    const fileHash = crypto.createHash('sha256').update(JSON.stringify(rawRecords.slice(0, 100))).digest('hex');
    let inserted = 0;
    let updated  = 0;

    // Batch upsert in chunks of 500 to avoid huge transactions
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rawRecords.length; i += CHUNK_SIZE) {
      const chunk = rawRecords.slice(i, i + CHUNK_SIZE);
      await withTransaction(async (client) => {
        for (const raw of chunk) {
          if (!raw.token || !raw.symbol) continue;

          const exchange   = raw.exch_seg || 'NSE';
          const segment    = exchange.includes('FO') ? 'FO' : 'EQ';
          
          let parsedStrike = parseFloat(raw.strike || '0');
          if (isNaN(parsedStrike) || parsedStrike < 0) parsedStrike = 0;
          // Scale down if raw strike is in paise (> 1,000,000)
          if (parsedStrike > 1000000) parsedStrike = parsedStrike / 100;
          const strikeVal = Math.min(99999999.99, parsedStrike);

          let parsedLot = parseInt(raw.lotsize || '1', 10);
          if (isNaN(parsedLot) || parsedLot < 1) parsedLot = 1;
          const lotSizeVal = Math.min(2147483647, parsedLot);

          let parsedTick = parseFloat(raw.tick_size || '0.05');
          if (isNaN(parsedTick) || parsedTick < 0.01) parsedTick = 0.05;
          const tickSizeVal = Math.min(9999.99, parsedTick);

          const optionType = raw.symbol.endsWith('CE') ? 'CE' : raw.symbol.endsWith('PE') ? 'PE' : 'XX';
          const token      = `${exchange}_${raw.token}`;
          const parsedExpiry = parseAngelExpiryToYYYYMMDD(raw.expiry);

          try {
            const result = await client.query(
              `INSERT INTO instruments (id, instrument_token, exchange, segment, symbol, trading_symbol, name, lot_size, tick_size, strike, option_type, expiry, instrument_type, active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
               ON CONFLICT (instrument_token) DO UPDATE SET
                 trading_symbol = EXCLUDED.trading_symbol,
                 lot_size       = EXCLUDED.lot_size,
                 strike         = EXCLUDED.strike,
                 option_type    = EXCLUDED.option_type,
                 expiry         = EXCLUDED.expiry,
                 last_seen_at   = NOW()
               RETURNING (xmax = 0) AS was_inserted`,
              [
                'inst_' + generateUUID(), token, exchange, segment,
                raw.name || raw.symbol, raw.symbol, raw.name || raw.symbol,
                lotSizeVal, tickSizeVal,
                strikeVal, optionType,
                parsedExpiry,
                raw.instrumenttype || (segment === 'FO' ? 'OPT' : 'EQ')
              ]
            );

            if (result.rows[0]?.was_inserted) {
              inserted++;
            } else {
              updated++;
            }
          } catch (_) {
            // Ignore individual malformed record inserts
          }
        }
      });
    }

    // Deactivate expired instruments
    try {
      await execute(
        `UPDATE instruments 
         SET active = FALSE 
         WHERE active = TRUE 
           AND expiry IS NOT NULL 
           AND expiry != '' 
           AND LENGTH(expiry) >= 9 
           AND TO_DATE(expiry, 'DDMonYYYY') < CURRENT_DATE`
      );
    } catch (_) {}

    // Record Version Details
    await execute(
      `INSERT INTO instrument_master_versions (version_id, source_url, file_hash, record_count, valid_count, inserted_count, updated_count, processing_duration_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUCCESS')`,
      [versionId, this.masterUrl, fileHash, rawRecords.length, rawRecords.length, inserted, updated, Date.now() - startTime]
    );

    this.isReady = true;
    this.lastSyncTimestamp = Date.now();
    this.totalTokensLoaded = rawRecords.length;
    this.lastVersionId = versionId;

    // Refresh tokenLookupCache
    rawRecords.forEach(r => {
      if (r.token && r.exch_seg) {
        const fullToken = `${r.exch_seg}_${r.token}`;
        this.tokenLookupCache.set(r.token, fullToken);
        this.tokenLookupCache.set(fullToken, fullToken);
        if (r.symbol) {
          this.tokenLookupCache.set(r.symbol, fullToken);
        }
      }
    });

    console.log(`[InstrumentMasterService] Synced ${rawRecords.length} instruments (inserted: ${inserted}, updated: ${updated}) in ${Date.now() - startTime}ms`);
    return { versionId, totalParsed: rawRecords.length, inserted, updated };
  }

  /**
   * Pre-market daily job to sync instrument master and clean up stale mapping
   */
  public async syncPreMarketScripMaster(): Promise<void> {
    console.log('[InstrumentMasterService] Running pre-market instrument master sync job...');
    try {
      await this.syncMasterData();
    } catch (err: any) {
      console.error('[InstrumentMasterService] Pre-market sync failed:', err.message);
    }
  }

  public async getInstrumentByToken(token: string): Promise<CanonicalInstrument | null> {
    const row = await queryOne<any>(
      'SELECT * FROM instruments WHERE instrument_token = $1 OR instrument_token = $2 OR instrument_token LIKE $3',
      [token, `NSE_${token}`, `%_${token}`]
    );
    if (!row) return null;
    return {
      ...row,
      strike: parseFloat(row.strike || '0'),
      lot_size: parseInt(row.lot_size || '1', 10),
      tick_size: parseFloat(row.tick_size || '0.05')
    };
  }

  public async getInstrumentBySymbol(exchange: string, symbol: string): Promise<CanonicalInstrument | null> {
    const row = await queryOne<any>('SELECT * FROM instruments WHERE exchange = $1 AND trading_symbol = $2', [exchange, symbol]);
    if (!row) return null;
    return {
      ...row,
      strike: parseFloat(row.strike || '0'),
      lot_size: parseInt(row.lot_size || '1', 10),
      tick_size: parseFloat(row.tick_size || '0.05')
    };
  }

  public async getExpiries(underlying: string): Promise<string[]> {
    const rows = await query<{ expiry: string }>(
      `SELECT DISTINCT expiry FROM instruments WHERE name = $1 AND expiry IS NOT NULL ORDER BY expiry ASC`,
      [underlying]
    );
    return rows.map(r => r.expiry);
  }
}

function osEnsureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
