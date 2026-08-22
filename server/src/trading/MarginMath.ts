/**
 * MarginMath.ts
 * Single shared source of truth for per-leg margin computation, option-symbol
 * resolution, and reference-price/staleness handling. Used by both the
 * pre-trade quote engine (MarginEngineService) and the post-mutation
 * recompute (VirtualWalletLedger.recomputeUsedMarginForUser) so a new order,
 * an open position, and a resting order are all priced through the exact
 * same formula instead of the divergent copies this replaces.
 *
 * Deliberately dependency-light: only imports from ../db/schema (leaf) and
 * ../marketData (leaf, does not import back from trading/ or services/) so
 * that both MarginEngineService and VirtualWalletLedger can depend on this
 * module without creating a cycle between each other.
 */
import { queryOne } from '../db/schema';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { MarketTick, TickSource } from '../marketData/types';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';
import { GreeksEngine } from '../marketData/GreeksEngine';

export { TickSource };

export const STALENESS_THRESHOLD_MS = 30000;

export type MarginProductType = 'MIS' | 'CNC' | 'NRML';
export type OptionType = 'CE' | 'PE' | 'XX';

export interface MarginParams {
  spanMarginRate: number;
  exposureMarginRate: number;
  additionalMarginRate: number;
}

export interface StatutoryChargesBreakdown {
  stt: number;
  gst: number;
  exchangeCharges: number;
  stampDuty: number;
  sebiFee: number;
  total: number;
}

export const ZERO_CHARGES: StatutoryChargesBreakdown = {
  stt: 0, gst: 0, exchangeCharges: 0, stampDuty: 0, sebiFee: 0, total: 0,
};

export interface ResolvedPrice {
  price: number;
  source: TickSource;
  isStale: boolean;
}

export interface LegMarginInput {
  productType: MarginProductType;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  optionType?: OptionType;
  strike?: number;
  spotPrice?: number; // required for the option-SELL branch; ignored otherwise
  marginParams: MarginParams;
  charges?: StatutoryChargesBreakdown; // defaults to zero — callers valuing an already-filled position or a still-pending order pass ZERO_CHARGES; a new-order quote passes real (currently zero-tax-policy) charges
}

export interface LegMarginResult {
  requiredMargin: number;
  spanMargin: number;
  exposureMargin: number;
  additionalMargin: number;
  premium: number;
  isEstimated: boolean;
}

/**
 * The one formula for "what does this leg require in margin" — a hypothetical
 * new order, an existing open position, or a still-pending order all resolve
 * through this. Extracted verbatim from MarginEngineService.calculateQuote's
 * previous inline body; behavior is unchanged for the pre-trade quote path.
 */
export function marginForLeg(input: LegMarginInput): LegMarginResult {
  const qty = Math.max(1, input.quantity);
  const orderPrice = Math.max(0, input.price);
  const orderValue = orderPrice * qty;
  const charges = input.charges || ZERO_CHARGES;
  const isOption = input.optionType === 'CE' || input.optionType === 'PE';

  let spanMargin = 0;
  let exposureMargin = 0;
  let additionalMargin = 0;
  let requiredMargin = 0;
  let isEstimated = false;

  if (isOption) {
    if (input.side === 'BUY') {
      // OPTION BUYING: Required Capital = Premium Payable + Statutory Charges
      requiredMargin = orderValue + charges.total;
    } else {
      // OPTION SELLING (WRITING): SPAN + Exposure Margin required
      isEstimated = true;
      const spotPrice = input.spotPrice ?? orderPrice;
      const strike = input.strike || spotPrice;
      const optionType = input.optionType || 'CE';

      const otmAmount = optionType === 'CE'
        ? Math.max(0, strike - spotPrice)
        : Math.max(0, spotPrice - strike);

      // Standard NSE Fallback SPAN Formula:
      // SPAN = Max( (Premium + SPAN_Rate * Spot - OTM_Amount) * Qty, (Premium + 0.05 * Spot) * Qty )
      const spanSpanAmt = (orderPrice + (input.marginParams.spanMarginRate * spotPrice) - otmAmount) * qty;
      const minSpanAmt = (orderPrice + (0.05 * spotPrice)) * qty;
      spanMargin = Math.max(spanSpanAmt, minSpanAmt);

      exposureMargin = input.marginParams.exposureMarginRate * spotPrice * qty;
      additionalMargin = input.marginParams.additionalMarginRate * spotPrice * qty;

      requiredMargin = spanMargin + exposureMargin + additionalMargin + charges.total;
    }
  } else {
    // EQUITY / FUTURES
    if (input.productType === 'MIS') {
      requiredMargin = (orderValue * 0.20) + charges.total; // 5x leverage intraday
    } else {
      requiredMargin = orderValue + charges.total; // 100% CNC/NRML
    }
  }

  return {
    requiredMargin: Number(requiredMargin.toFixed(2)),
    spanMargin: Number(spanMargin.toFixed(2)),
    exposureMargin: Number(exposureMargin.toFixed(2)),
    additionalMargin: Number(additionalMargin.toFixed(2)),
    premium: isOption ? orderValue : 0,
    isEstimated,
  };
}

/**
 * Tick-age check + fallback, shared by every margin-critical price read.
 * Per the confirmed staleness decision: never blocks — always returns a
 * usable price, tagged so a stale/fabricated read is visible instead of
 * silent (source 'cached_stale' covers both "old tick" and "no tick at all").
 */
export function resolveReferencePrice(
  tick: Pick<MarketTick, 'ltp' | 'timestamp'> | null | undefined,
  fallback: number
): ResolvedPrice {
  if (tick && tick.ltp > 0) {
    const isStale = (Date.now() - tick.timestamp) > STALENESS_THRESHOLD_MS;
    return { price: tick.ltp, source: isStale ? 'cached_stale' : 'live', isStale };
  }
  return { price: fallback, source: 'cached_stale', isStale: true };
}

/**
 * Resolves the underlying's live spot price for SPAN margin on an option-sell
 * leg. Lifted as-is from the previous MarginEngineService.getSpotPrice (the
 * unused `token` parameter it used to take is dropped — the underlying-name
 * derivation is what actually feeds SPAN, not the option contract's own LTP).
 * Known limitation, unchanged from before: the underlying->spotToken mapping
 * only covers the major indices explicitly; anything else falls through to a
 * best-effort `NSE_<symbol>` guess. Not re-addressed in this pass.
 */
export function resolveSpotPrice(underlying: string): ResolvedPrice {
  const clean = (underlying || '').toUpperCase().replace(/^(NSE_|BSE_|NFO_|BFO_)/, '').trim();
  let spotToken = 'NSE_NIFTY50';
  if (clean.includes('SENSEX')) spotToken = 'BSE_SENSEX';
  else if (clean.includes('BANK')) spotToken = 'NSE_BANKNIFTY';
  else if (clean.includes('FIN')) spotToken = 'NSE_FINNIFTY';
  else if (clean.includes('MIDCP')) spotToken = 'NSE_MIDCPNIFTY';
  else if (clean.includes('NIFTY')) spotToken = 'NSE_NIFTY50';
  else if (clean.length > 0 && !clean.includes(' ') && !clean.includes('_')) spotToken = `NSE_${clean}`;

  let fallback = 24250;
  if (clean.includes('SENSEX')) fallback = 77520;
  else if (clean.includes('BANK')) fallback = 57600;
  else if (clean.includes('FIN')) fallback = 26000;
  else if (clean.includes('MIDCP')) fallback = 13200;

  const tick = MarketDataEngine.getInstance().getCachedTick(spotToken);
  return resolveReferencePrice(tick, fallback);
}

/**
 * Resolves a reference price for an order/position's own instrument —
 * used when a MARKET order has no submitted price (0), mirroring RMS's
 * previous inline refPrice fallback chain.
 */
export function resolveOrderReferencePrice(instrumentTokenOrSymbol: string, fallback: number): ResolvedPrice {
  const tick = MarketDataEngine.getInstance().getCachedTick(instrumentTokenOrSymbol);
  return resolveReferencePrice(tick, fallback);
}

/**
 * Resolves underlying/strike/optionType for a symbol, preferring a joined
 * `instruments` row (authoritative) and falling back to symbol-string
 * parsing only when no instrument row is available. This is the one place
 * that parsing happens now — RMS.ts's own inline regex was folded into
 * SymbologyNormalizer.parseOptionSymbol and both callers route through here.
 */
export function resolveOptionDetails(
  symbol: string,
  instrumentRow?: { option_type?: string | null; strike?: string | number | null; name?: string | null } | null
): { underlying: string; strike: number; optionType: 'CE' | 'PE' } | null {
  if (instrumentRow && (instrumentRow.option_type === 'CE' || instrumentRow.option_type === 'PE')) {
    return {
      underlying: instrumentRow.name || symbol,
      strike: parseFloat(String(instrumentRow.strike || '0')) || 0,
      optionType: instrumentRow.option_type,
    };
  }
  return SymbologyNormalizer.parseOptionSymbol(symbol);
}

export interface UnrealizedPnlInput {
  symbol: string;
  netQty: number;
  averagePrice: number;
  /** positions.ltp — the last-fill snapshot, used only as a fallback if no live tick is cached. */
  dbLtp: number;
}

export interface UnrealizedPnlResult {
  ltp: number;
  unrealizedPnl: number;
  priceSource: 'live' | 'stale_db' | 'bs_estimate';
}

/**
 * Resolves a position's current price and unrealized P&L: live cached tick
 * first, falling back to the stale `positions.ltp`/average_price snapshot,
 * and only failing that, a Black-Scholes estimate anchored to a live index
 * spot tick. Extracted verbatim from PortfolioService.getUserPositions's
 * previous inline block — behavior-preserving, including its exact lookup
 * order and the (harmless, symbol-pattern-driven) fact that a BANKNIFTY/
 * FINNIFTY/MIDCPNIFTY symbol also matches the plain NIFTY regex as a
 * substring, so each pattern's cache lookup is tried in sequence and the
 * most specific one to actually match ends up winning.
 */
export function resolveUnrealizedPnlForPosition(pos: UnrealizedPnlInput): UnrealizedPnlResult {
  const engine = MarketDataEngine.getInstance();
  const symbol = pos.symbol || '';
  let tick = engine.getCachedTick(`NSE_${symbol}`) ||
             engine.getCachedTick(`NFO_${symbol}`) ||
             engine.getCachedTick(`BFO_${symbol}`) ||
             engine.getCachedTick(symbol);

  if (!tick) {
    const mNifty = symbol.match(/NIFTY\s*(\d+)\s*(CE|PE)/i);
    if (mNifty) {
      tick = engine.getCachedTick(`NFO_NIFTY_${mNifty[1]}_${mNifty[2].toUpperCase()}`) ||
             engine.getCachedTick(`NFO_NIFTY${mNifty[1]}${mNifty[2].toUpperCase()}`);
    }
    const mBank = symbol.match(/BANKNIFTY\s*(\d+)\s*(CE|PE)/i);
    if (mBank) {
      tick = engine.getCachedTick(`NFO_BANKNIFTY_${mBank[1]}_${mBank[2].toUpperCase()}`) ||
             engine.getCachedTick(`NFO_BANKNIFTY${mBank[1]}${mBank[2].toUpperCase()}`);
    }
    const mFin = symbol.match(/FINNIFTY\s*(\d+)\s*(CE|PE)/i);
    if (mFin) {
      tick = engine.getCachedTick(`NFO_FINNIFTY_${mFin[1]}_${mFin[2].toUpperCase()}`) ||
             engine.getCachedTick(`NFO_FINNIFTY${mFin[1]}${mFin[2].toUpperCase()}`);
    }
    const mMid = symbol.match(/MIDCPNIFTY\s*(\d+)\s*(CE|PE)/i);
    if (mMid) {
      tick = engine.getCachedTick(`NFO_MIDCPNIFTY_${mMid[1]}_${mMid[2].toUpperCase()}`);
    }
    const mSensex = symbol.match(/SENSEX\s*(\d+)\s*(CE|PE)/i);
    if (mSensex) {
      tick = engine.getCachedTick(`BFO_SENSEX_${mSensex[1]}_${mSensex[2].toUpperCase()}`) ||
             engine.getCachedTick(`BFO_SENSEX${mSensex[1]}${mSensex[2].toUpperCase()}`);
    }
  }

  let ltp = tick && tick.ltp > 0 ? tick.ltp : (pos.dbLtp || pos.averagePrice || 0);
  let priceSource: UnrealizedPnlResult['priceSource'] = tick && tick.ltp > 0 ? 'live' : 'stale_db';

  // Fallback: if option position and no direct tick, compute a live BS price anchored to a live spot tick
  if ((!tick || tick.ltp <= 0) && ltp <= 0) {
    const mOpt = symbol.match(/(NIFTY|BANKNIFTY|FINNIFTY|SENSEX)\s*(\d+)\s*(CE|PE)/i);
    if (mOpt) {
      const symName = mOpt[1].toUpperCase();
      const strike = parseFloat(mOpt[2]);
      const isCall = mOpt[3].toUpperCase() === 'CE';
      const spotToken = symName === 'SENSEX' ? 'BSE_SENSEX' : symName === 'BANKNIFTY' ? 'NSE_BANKNIFTY' : symName === 'FINNIFTY' ? 'NSE_FINNIFTY' : 'NSE_NIFTY50';
      const spotTick = engine.getCachedTick(spotToken);
      if (spotTick && spotTick.ltp > 0) {
        const timeToExpiryYears = 1.0 / 365.0;
        const iv = symName === 'SENSEX' ? 0.16 : symName === 'BANKNIFTY' ? 0.15 : 0.13;
        const bsPrice = GreeksEngine.calculateOptionPrice(spotTick.ltp, strike, timeToExpiryYears, isCall, iv);
        ltp = Number(bsPrice.toFixed(2));
        priceSource = 'bs_estimate';
      }
    }
  }

  const netQty = pos.netQty;
  const unrealizedPnl = netQty > 0
    ? netQty * (ltp - pos.averagePrice)
    : netQty < 0
    ? Math.abs(netQty) * (pos.averagePrice - ltp)
    : 0;

  return { ltp, unrealizedPnl, priceSource };
}

const cachedMarginParamsMap = new Map<string, { params: MarginParams; expiresAt: number }>();

/**
 * Per-underlying SPAN/exposure/additional margin rates, cached 60s.
 * Moved out of MarginEngineService so VirtualWalletLedger.recomputeUsedMarginForUser
 * can fetch the same rates without importing MarginEngineService (which would
 * create a cycle, since MarginEngineService imports VirtualWalletLedger).
 */
export async function getMarginParams(underlying: string): Promise<MarginParams> {
  const clean = (underlying || '').toUpperCase();
  const cached = cachedMarginParamsMap.get(clean);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.params;
  }
  const row = await queryOne<any>(
    `SELECT * FROM margin_parameters WHERE UPPER(underlying) = $1 LIMIT 1`,
    [clean]
  );
  const params: MarginParams = {
    spanMarginRate: row ? parseFloat(row.span_margin_rate) : 0.12,
    exposureMarginRate: row ? parseFloat(row.exposure_margin_rate) : 0.03,
    additionalMarginRate: row ? parseFloat(row.additional_margin_rate) : 0.00,
  };
  cachedMarginParamsMap.set(clean, { params, expiresAt: Date.now() + 60000 });
  return params;
}
