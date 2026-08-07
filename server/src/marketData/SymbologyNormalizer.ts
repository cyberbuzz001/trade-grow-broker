/**
 * SymbologyNormalizer.ts
 * Centralized utility for resolving multi-format option symbols & instrument tokens
 * across internal formats, Dhan HQ API security IDs, OpenAlgo formats, and broker feeds.
 */

export class SymbologyNormalizer {
  /**
   * Given any input token or symbol (e.g. 'NFO_NIFTY_24500_CE', 'NSE_NIFTY24500CE', 'NIFTY30DEC2524500CE', 'BFO_SENSEX_78400_CE'),
   * returns an array of ALL possible lookup alias keys for MarketDataEngine cache matching.
   */
  public static normalizeToken(raw: string): string[] {
    if (!raw) return [];

    const input = raw.trim().toUpperCase();
    const keys = new Set<string>([input]);

    // Strip prefix segment if present (e.g. NFO_, NSE_, BFO_, BSE_)
    const noPrefix = input.replace(/^(NSE_|BSE_|NFO_|BFO_)/, '');
    keys.add(noPrefix);

    // Regex match option format: [UNDERLYING][STRIKE][CE|PE]
    // e.g. NIFTY_24500_CE or NIFTY24500CE or SENSEX78400CE
    const match = noPrefix.match(/^([A-Z0-9]+?)(?:_)?(\d+)(?:_)?(CE|PE)$/);

    if (match) {
      const underlying = match[1].replace(/^(NFO_|BFO_|NSE_|BSE_)/, '');
      const strike = match[2];
      const optType = match[3];

      const segment = (underlying === 'SENSEX' || underlying.includes('BSE')) ? 'BFO' : 'NFO';
      const exchSegment = (underlying === 'SENSEX' || underlying.includes('BSE')) ? 'BSE' : 'NSE';

      // Internal standard token: NFO_NIFTY_24500_CE
      keys.add(`${segment}_${underlying}_${strike}_${optType}`);
      keys.add(`${exchSegment}_${underlying}_${strike}_${optType}`);

      // Compact standard token: NSE_NIFTY24500CE
      keys.add(`${exchSegment}_${underlying}${strike}${optType}`);
      keys.add(`${underlying}${strike}${optType}`);

      // Underscore format: NIFTY_24500_CE
      keys.add(`${underlying}_${strike}_${optType}`);
    }

    return Array.from(keys);
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
