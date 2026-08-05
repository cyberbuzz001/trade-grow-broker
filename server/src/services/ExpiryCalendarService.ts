import { query, queryOne, execute } from '../db/schema';

export interface ExpiryCalendarConfig {
  id: string;
  indexName: string;
  exchange: string;
  underlyingSymbol: string;
  tradingSymbolPrefix: string;
  weeklyExpirySupported: boolean;
  monthlyExpirySupported: boolean;
  expiryWeekday: number; // 0=Sun .. 6=Sat
  holidayAdjustmentRule: 'PREVIOUS_TRADING_DAY' | 'NEXT_TRADING_DAY';
  active: boolean;
}

export interface ExpiryCategorization {
  nearestExpiry: string | null;
  nextExpiry: string | null;
  monthlyExpiry: string | null;
  allExpiries: string[];
}

export class ExpiryCalendarService {
  private static instance: ExpiryCalendarService;

  public static getInstance(): ExpiryCalendarService {
    if (!ExpiryCalendarService.instance) {
      ExpiryCalendarService.instance = new ExpiryCalendarService();
    }
    return ExpiryCalendarService.instance;
  }

  /**
   * Retrieves active Expiry Calendar config for a given index or underlying symbol
   */
  public async getCalendarConfig(indexOrSymbol: string): Promise<ExpiryCalendarConfig | null> {
    const symbolClean = (indexOrSymbol || 'NIFTY').toUpperCase().replace(' ', '');

    const row = await queryOne<any>(
      `SELECT * FROM expiry_calendars
       WHERE active = TRUE AND (UPPER(index_name) = $1 OR UPPER(trading_symbol_prefix) = $1 OR UPPER(underlying_symbol) = $1)
       LIMIT 1`,
      [symbolClean]
    );

    if (!row) return null;

    return {
      id: row.id,
      indexName: row.index_name,
      exchange: row.exchange,
      underlyingSymbol: row.underlying_symbol,
      tradingSymbolPrefix: row.trading_symbol_prefix,
      weeklyExpirySupported: Boolean(row.weekly_expiry_supported),
      monthlyExpirySupported: Boolean(row.monthly_expiry_supported),
      expiryWeekday: parseInt(row.expiry_weekday, 10),
      holidayAdjustmentRule: row.holiday_adjustment_rule || 'PREVIOUS_TRADING_DAY',
      active: Boolean(row.active),
    };
  }

  /**
   * Returns all active Expiry Calendar configurations
   */
  public async getAllCalendarConfigs(): Promise<ExpiryCalendarConfig[]> {
    const rows = await query<any>('SELECT * FROM expiry_calendars ORDER BY index_name ASC');
    return rows.map(row => ({
      id: row.id,
      indexName: row.index_name,
      exchange: row.exchange,
      underlyingSymbol: row.underlying_symbol,
      tradingSymbolPrefix: row.trading_symbol_prefix,
      weeklyExpirySupported: Boolean(row.weekly_expiry_supported),
      monthlyExpirySupported: Boolean(row.monthly_expiry_supported),
      expiryWeekday: parseInt(row.expiry_weekday, 10),
      holidayAdjustmentRule: row.holiday_adjustment_rule || 'PREVIOUS_TRADING_DAY',
      active: Boolean(row.active),
    }));
  }

  /**
   * Resolves valid non-expired tradable expiries for an underlying symbol.
   * Prioritizes active instruments in the database as the source of truth,
   * falling back to dynamic calendar calculation if instruments table is empty.
   */
  public async getValidExpiries(underlying: string): Promise<ExpiryCategorization> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const cleanSym = (underlying || 'NIFTY').toUpperCase().replace(' ', '');

    // 1. Query active exchange instruments for non-expired expiry dates
    const rows = await query<{ expiry: string }>(
      `SELECT DISTINCT expiry FROM instruments
       WHERE (UPPER(symbol) = $1 OR UPPER(name) = $1 OR UPPER(trading_symbol) LIKE $2)
         AND expiry IS NOT NULL AND expiry >= $3
       ORDER BY expiry ASC`,
      [cleanSym, `${cleanSym}%`, todayStr]
    );

    let rawExpiries = rows.map(r => typeof r.expiry === 'object' ? (r.expiry as any).toISOString().slice(0, 10) : String(r.expiry).slice(0, 10)).filter(Boolean);

    // If exchange instrument master has expiries, filter & sort
    if (rawExpiries.length === 0) {
      // Fallback: Generate dynamic expiries based on Expiry Calendar config
      rawExpiries = await this.generateCalculatedExpiries(cleanSym);
    }

    // Deduplicate and ensure ascending order
    const sortedExpiries = Array.from(new Set(rawExpiries)).sort();

    const nearestExpiry = sortedExpiries[0] || null;
    const nextExpiry = sortedExpiries[1] || null;

    // Monthly expiry resolution: find the last expiry in the current month (or nearest month)
    const monthlyExpiry = this.resolveMonthlyExpiry(sortedExpiries) || nearestExpiry;

    return {
      nearestExpiry,
      nextExpiry,
      monthlyExpiry,
      allExpiries: sortedExpiries,
    };
  }

  /**
   * Validates whether a given expiry date is currently active and non-expired.
   */
  public async isValidExpiry(underlying: string, expiryDate: string): Promise<boolean> {
    if (!expiryDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (expiryDate < today) return false; // Expired contract rejection

    const categories = await this.getValidExpiries(underlying);
    return categories.allExpiries.includes(expiryDate);
  }

  /**
   * Helper to calculate dynamic upcoming expiry dates based on calendar rules
   */
  private async generateCalculatedExpiries(symbol: string): Promise<string[]> {
    const config = await this.getCalendarConfig(symbol);
    const targetWeekday = config ? config.expiryWeekday : 2; // Default Tuesday (2) for NIFTY

    const expiries: string[] = [];
    const now = new Date();

    for (let w = 0; w < 6; w++) {
      const d = new Date(now);
      const currentDay = d.getDay();
      let daysUntilTarget = (targetWeekday - currentDay + 7) % 7;
      if (daysUntilTarget === 0 && d.getHours() >= 15 && d.getMinutes() >= 30) {
        daysUntilTarget = 7; // Past market close on expiry day
      }
      d.setDate(d.getDate() + daysUntilTarget + (w * 7));

      // Holiday adjustment: if Weekend (Sat/Sun), adjust to Friday/Previous trading day
      if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Sat -> Fri
      if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sun -> Fri

      expiries.push(d.toISOString().slice(0, 10));
    }

    return expiries;
  }

  /**
   * Resolves the monthly contract expiry (Last Tuesday of the target month for NIFTY/SENSEX, or last valid weekday of the month)
   */
  private resolveMonthlyExpiry(expiries: string[]): string | null {
    if (expiries.length === 0) return null;
    const firstExp = expiries[0];
    const year = parseInt(firstExp.slice(0, 4), 10);
    const month = parseInt(firstExp.slice(5, 7), 10) - 1; // 0-indexed month

    // Calculate Last Tuesday of the month (weekday 2)
    const lastDayOfMonth = new Date(year, month + 1, 0); // last day of month
    let lastTuesday = new Date(lastDayOfMonth);
    while (lastTuesday.getDay() !== 2) { // 2 = Tuesday
      lastTuesday.setDate(lastTuesday.getDate() - 1);
    }

    // Holiday adjustment for Last Tuesday if Sat/Sun
    if (lastTuesday.getDay() === 6) lastTuesday.setDate(lastTuesday.getDate() - 1);
    if (lastTuesday.getDay() === 0) lastTuesday.setDate(lastTuesday.getDate() - 2);

    const lastTuesdayStr = lastTuesday.toISOString().slice(0, 10);

    const monthStr = firstExp.slice(0, 7);
    const currentMonthExpiries = expiries.filter(e => e.startsWith(monthStr));

    if (currentMonthExpiries.includes(lastTuesdayStr)) {
      return lastTuesdayStr;
    }

    if (currentMonthExpiries.length > 0) {
      return currentMonthExpiries[currentMonthExpiries.length - 1];
    }

    return expiries[expiries.length - 1] || null;
  }
}

export const expiryCalendarService = ExpiryCalendarService.getInstance();
