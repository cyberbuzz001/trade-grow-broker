/**
 * SymbologyNormalizer.ts
 * Centralized utility for resolving multi-format option symbols & instrument tokens
 * across internal formats, Dhan HQ API security IDs, OpenAlgo formats, and broker feeds.
 */

export class SymbologyNormalizer {
  /**
   * Given any input token or symbol (e.g. 'NIFTY 24200 CE', 'NFO_NIFTY_24500_CE', 'NSE_NIFTY24500CE', 'NIFTY30DEC2524500CE', 'BFO_SENSEX_78400_CE'),
   * returns an array of ALL possible lookup alias keys for MarketDataEngine cache matching.
   */
  public static normalizeToken(raw: string): string[] {
    if (!raw) return [];

    const input = raw.trim().toUpperCase();
    const keys = new Set<string>([input]);

    // Strip prefix segment if present (e.g. NFO_, NSE_, BFO_, BSE_)
    const noPrefix = input.replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    keys.add(noPrefix);

    // Normalize spacing and underscores (e.g. 'NIFTY 24200 CE' -> 'NIFTY_24200_CE')
    const cleanedWithUnderscores = noPrefix.replace(/[\s\-_]+/g, '_');
    const compactNoSpaces = noPrefix.replace(/\s+/g, '');
    const spacedFormat = noPrefix.replace(/[\s\-_]+/g, ' ');

    keys.add(cleanedWithUnderscores);
    keys.add(compactNoSpaces);
    keys.add(spacedFormat);

    // Regex match option format: [UNDERLYING][STRIKE][CE|PE]
    // Handles: NIFTY 24500 CE, NIFTY_24500_CE, NIFTY24500CE, NFO_NIFTY_24500_CE, SENSEX 78400 PE
    const match = cleanedWithUnderscores.match(/^([A-Z0-9]+)_(\d+)_(CE|PE)$/) ||
                  compactNoSpaces.match(/^([A-Z0-9]+?)(\d+)(CE|PE)$/);

    if (match) {
      const underlying = match[1].replace(/^(NFO_|BFO_|NSE_|BSE_)/, '');
      const strike = match[2];
      const optType = match[3];

      const segment = (underlying === 'SENSEX' || underlying.includes('BSE')) ? 'BFO' : 'NFO';
      const exchSegment = (underlying === 'SENSEX' || underlying.includes('BSE')) ? 'BSE' : 'NSE';

      // Internal standard token: NFO_NIFTY_24500_CE
      keys.add(`${segment}_${underlying}_${strike}_${optType}`);
      keys.add(`${exchSegment}_${underlying}_${strike}_${optType}`);

      // Compact standard token: NSE_NIFTY24500CE / NIFTY24500CE
      keys.add(`${exchSegment}_${underlying}${strike}${optType}`);
      keys.add(`${underlying}${strike}${optType}`);

      // Underscore format: NIFTY_24500_CE
      keys.add(`${underlying}_${strike}_${optType}`);

      // Spaced format: NIFTY 24500 CE
      keys.add(`${underlying} ${strike} ${optType}`);
    }

    return Array.from(keys);
  }

  /**
   * Parses underlying/strike/optionType out of a raw symbol or instrument
   * token string (e.g. 'NIFTY 24500 CE', 'NFO_NIFTY_24500_CE', 'NIFTY24500CE').
   * Returns null when the string doesn't match the expected option-symbol
   * shape (e.g. an equity symbol) — callers should treat that as "not an
   * option", not fabricate a partial result.
   */
  public static parseOptionSymbol(symbol: string): { underlying: string; strike: number; optionType: 'CE' | 'PE' } | null {
    if (!symbol) return null;
    const optRegex = /(?:^(?:NFO|BFO|NSE|BSE)_)?([A-Z]+)[_\s\d-]*?(\d+(?:\.\d+)?)[_\s]*(CE|PE)$/i;
    const match = symbol.match(optRegex);
    if (!match) return null;
    return {
      underlying: match[1].toUpperCase(),
      strike: parseFloat(match[2]),
      optionType: match[3].toUpperCase() as 'CE' | 'PE',
    };
  }

  /**
   * Generates canonical internal instrument token: NFO_NIFTY_24500_CE or BFO_SENSEX_78400_CE
   */
  public static toInternalToken(underlying: string, strike: number, optionType: 'CE' | 'PE'): string {
    const cleanSym = (underlying || 'NIFTY').toUpperCase().replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    const segment = cleanSym === 'SENSEX' ? 'BFO' : 'NFO';
    return `${segment}_${cleanSym}_${strike}_${optionType}`;
  }

  /**
   * Generates OpenAlgo standard trading symbol: NIFTY30DEC2524500CE
   */
  public static toOpenAlgoSymbol(underlying: string, expiryDate: string, strike: number, optionType: 'CE' | 'PE'): string {
    const cleanSym = (underlying || 'NIFTY').toUpperCase().replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    const cleanExpiry = (expiryDate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${cleanSym}${cleanExpiry}${strike}${optionType}`;
  }
}
