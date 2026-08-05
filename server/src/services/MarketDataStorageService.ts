import { query, queryOne, execute } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { Candle } from '../marketData/types';

export class MarketDataStorageService {

  /** Save or update a key-value setting in system_config table */
  public static async setSystemConfig(key: string, value: string): Promise<void> {
    await execute(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
  }

  /** Get a configuration value from system_config table */
  public static async getSystemConfig(key: string): Promise<string | null> {
    const row = await queryOne<{ value: string }>('SELECT value FROM system_config WHERE key = $1', [key]);
    return row ? row.value : null;
  }

  /** Get all configuration key-values */
  public static async getAllSystemConfigs(): Promise<Record<string, string>> {
    const rows = await query<{ key: string; value: string }>('SELECT key, value FROM system_config');
    const result: Record<string, string> = {};
    rows.forEach(r => { result[r.key] = r.value; });
    return result;
  }

  /** Download historical candles from current active provider and store in local DB */
  public static async downloadAndStoreData(tokens: string[], timeframe: string = '1D', count: number = 100): Promise<{
    success: boolean;
    totalDownloaded: number;
    totalStored: number;
    tokensProcessed: string[];
    provider: string;
  }> {
    const engine = MarketDataEngine.getInstance();
    const provider = engine.getActiveProviderName();
    let totalDownloaded = 0;
    let totalStored = 0;
    const processed: string[] = [];

    for (const token of tokens) {
      try {
        const symbol = token.replace(/^(NSE_|BSE_|NFO_)/, '');
        const exchange = token.startsWith('NFO_') ? 'NFO' : (token.startsWith('BSE_') ? 'BSE' : 'NSE');

        const candles = await engine.getHistoricalCandles(token, timeframe, count);
        totalDownloaded += candles.length;

        for (const c of candles) {
          const dt = new Date(c.time * 1000).toISOString();
          await execute(
            `INSERT INTO local_market_candles 
              (instrument_token, symbol, exchange, timeframe, timestamp, datetime, open, high, low, close, volume, provider)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (instrument_token, timeframe, timestamp) 
             DO UPDATE SET 
               open = EXCLUDED.open, 
               high = EXCLUDED.high, 
               low = EXCLUDED.low, 
               close = EXCLUDED.close, 
               volume = EXCLUDED.volume,
               created_at = NOW()`,
            [token, symbol, exchange, timeframe, c.time, dt, c.open, c.high, c.low, c.close, c.volume || 0, provider]
          );
          totalStored++;
        }
        processed.push(token);
      } catch (err: any) {
        console.error(`[MarketDataStorageService] Failed downloading data for ${token}:`, err.message);
      }
    }

    return {
      success: true,
      totalDownloaded,
      totalStored,
      tokensProcessed: processed,
      provider
    };
  }

  /** Retrieve historical candles directly from local server database */
  public static async getLocalCandles(instrumentToken: string, timeframe: string = '1D', limit: number = 100): Promise<Candle[]> {
    const rows = await query<any>(
      `SELECT timestamp as time, open, high, low, close, volume
       FROM local_market_candles
       WHERE instrument_token = $1 AND timeframe = $2
       ORDER BY timestamp ASC
       LIMIT $3`,
      [instrumentToken, timeframe, limit]
    );

    return rows.map(r => ({
      time: Number(r.time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume)
    }));
  }

  /** Get storage metrics for local market data table */
  public static async getLocalStorageStats(): Promise<{
    totalCandles: number;
    storedSymbols: string[];
    timeframes: string[];
    earliestDate: string | null;
    latestDate: string | null;
    storageSizeMB: number;
  }> {
    const [countRow, symbolsRows, timeframesRows, dateRangeRow, sizeRow] = await Promise.all([
      queryOne<any>('SELECT COUNT(*) as c FROM local_market_candles'),
      query<any>('SELECT DISTINCT symbol FROM local_market_candles ORDER BY symbol ASC'),
      query<any>('SELECT DISTINCT timeframe FROM local_market_candles'),
      queryOne<any>('SELECT MIN(datetime) as min_dt, MAX(datetime) as max_dt FROM local_market_candles'),
      queryOne<any>("SELECT pg_total_relation_size('local_market_candles') / (1024 * 1024) as size_mb")
    ]);

    return {
      totalCandles: parseInt(countRow?.c || '0', 10),
      storedSymbols: symbolsRows.map(r => r.symbol),
      timeframes: timeframesRows.map(r => r.timeframe),
      earliestDate: dateRangeRow?.min_dt ? new Date(dateRangeRow.min_dt).toISOString() : null,
      latestDate: dateRangeRow?.max_dt ? new Date(dateRangeRow.max_dt).toISOString() : null,
      storageSizeMB: parseFloat(sizeRow?.size_mb || '0')
    };
  }
}
