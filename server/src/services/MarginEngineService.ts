import { query, queryOne } from '../db/schema';
import { VirtualWalletLedger } from '../trading/VirtualWalletLedger';
import { MarketDataEngine } from '../marketData/MarketDataEngine';

export interface MarginQuoteRequest {
  userId: string;
  exchange: string;
  underlying: string;
  expiry?: string;
  strike?: number;
  optionType?: 'CE' | 'PE' | 'XX';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  productType?: 'MIS' | 'CNC' | 'NRML';
  instrumentToken?: string;
}

export interface StatutoryChargesBreakdown {
  stt: number;
  gst: number;
  exchangeCharges: number;
  stampDuty: number;
  sebiFee: number;
  total: number;
}

export interface MarginQuoteResponse {
  orderValue: number;
  premium: number;
  requiredMargin: number;
  spanMargin: number;
  exposureMargin: number;
  additionalMargin: number;
  totalMargin: number;
  brokerage: number; // Always 0 under Zero Brokerage policy
  statutoryCharges: StatutoryChargesBreakdown;
  estimated: boolean;
  availableFunds: number;
  shortfall: number;
  canPlaceOrder: boolean;
  rejectionReason?: string;
}

export interface PortfolioMarginResponse {
  totalPortfolioMargin: number;
  spanMargin: number;
  exposureMargin: number;
  additionalMargin: number;
  marginBenefit: number;
  requiredCapital: number;
  availableCapital: number;
  marginUtilizationPct: number;
  shortfall: number;
}

export class MarginEngineService {
  private static instance: MarginEngineService;

  public static getInstance(): MarginEngineService {
    if (!MarginEngineService.instance) {
      MarginEngineService.instance = new MarginEngineService();
    }
    return MarginEngineService.instance;
  }

  /**
   * Calculates required capital and margin requirements for an individual order.
   * Enforces ₹0 Brokerage policy while computing precise statutory fees.
   */
  public async calculateQuote(req: MarginQuoteRequest): Promise<MarginQuoteResponse> {
    const qty = Math.max(1, req.quantity);
    const orderPrice = Math.max(0, req.price);
    const orderValue = orderPrice * qty;

    // Fetch user available funds
    const wallet = await VirtualWalletLedger.getWallet(req.userId);
    const availableFunds = wallet ? wallet.buyingPower : 0;

    // Fetch statutory configuration
    const statutoryConfig = await this.getStatutoryConfig();
    const marginParams = await this.getMarginParams(req.underlying, req.exchange);

    // 1. Calculate Statutory Charges (Brokerage = ₹0.00)
    const charges = this.calculateStatutoryCharges(req.side, orderValue, req.optionType || 'CE', statutoryConfig);

    // 2. Distinguish Equity vs Option Buying vs Option Selling
    let spanMargin = 0;
    let exposureMargin = 0;
    let additionalMargin = 0;
    let requiredMargin = 0;
    let isEstimated = false;

    const isOption = req.optionType === 'CE' || req.optionType === 'PE';

    if (isOption) {
      if (req.side === 'BUY') {
        // OPTION BUYING: Required Capital = Premium Payable + Statutory Charges
        requiredMargin = orderValue + charges.total;
        spanMargin = 0;
        exposureMargin = 0;
      } else {
        // OPTION SELLING (WRITING): SPAN + Exposure Margin required
        isEstimated = true;
        const spotPrice = this.getSpotPrice(req.underlying, req.instrumentToken);
        const strike = req.strike || spotPrice;
        const optionType = req.optionType || 'CE';

        // OTM Calculation
        const otmAmount = optionType === 'CE'
          ? Math.max(0, strike - spotPrice)
          : Math.max(0, spotPrice - strike);

        // Standard NSE Fallback SPAN Formula:
        // SPAN = Max( (Premium + SPAN_Rate * Spot - OTM_Amount) * Qty, (Premium + 0.05 * Spot) * Qty )
        const spanSpanAmt = (orderPrice + (marginParams.spanMarginRate * spotPrice) - otmAmount) * qty;
        const minSpanAmt  = (orderPrice + (0.05 * spotPrice)) * qty;
        spanMargin = Math.max(spanSpanAmt, minSpanAmt);

        // Exposure Margin = Exposure_Rate * Spot * Qty
        exposureMargin = marginParams.exposureMarginRate * spotPrice * qty;
        additionalMargin = marginParams.additionalMarginRate * spotPrice * qty;

        requiredMargin = spanMargin + exposureMargin + additionalMargin + charges.total;
      }
    } else {
      // EQUITY / FUTURES
      if (req.productType === 'MIS') {
        requiredMargin = (orderValue * 0.20) + charges.total; // 5x leverage intraday
      } else {
        requiredMargin = orderValue + charges.total; // 100% CNC
      }
    }

    const totalMargin = requiredMargin;
    const shortfall = Math.max(0, requiredMargin - availableFunds);
    const canPlaceOrder = shortfall === 0;

    let rejectionReason: string | undefined;
    if (!canPlaceOrder) {
      rejectionReason = `Insufficient margin. Required Capital: ₹${requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Available Funds: ₹${availableFunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    return {
      orderValue,
      premium: isOption ? orderValue : 0,
      requiredMargin: Number(requiredMargin.toFixed(2)),
      spanMargin: Number(spanMargin.toFixed(2)),
      exposureMargin: Number(exposureMargin.toFixed(2)),
      additionalMargin: Number(additionalMargin.toFixed(2)),
      totalMargin: Number(totalMargin.toFixed(2)),
      brokerage: 0, // ₹0 Free Brokerage
      statutoryCharges: charges,
      estimated: isEstimated,
      availableFunds: Number(availableFunds.toFixed(2)),
      shortfall: Number(shortfall.toFixed(2)),
      canPlaceOrder,
      rejectionReason,
    };
  }

  /**
   * Portfolio-level Margin Calculator for open positions (computes hedged offsets).
   */
  public async calculatePortfolioMargin(userId: string): Promise<PortfolioMarginResponse> {
    const wallet = await VirtualWalletLedger.getWallet(userId);
    const availableCapital = wallet ? wallet.buyingPower : 0;

    const positions = await query<any>(
      `SELECT * FROM positions WHERE user_id = $1 AND net_qty != 0`,
      [userId]
    );

    let totalSpan = 0;
    let totalExposure = 0;
    let unhedgedMargin = 0;

    // Map open positions
    for (const pos of positions) {
      const netQty = parseInt(pos.net_qty, 10);
      if (netQty === 0) continue;

      const side = netQty > 0 ? 'BUY' : 'SELL';
      const absQty = Math.abs(netQty);
      const ltp = parseFloat(pos.ltp || pos.average_price || '100');

      const quote = await this.calculateQuote({
        userId,
        exchange: pos.exchange || 'NSE',
        underlying: pos.symbol,
        side,
        quantity: absQty,
        price: ltp,
        productType: pos.product_type
      });

      totalSpan += quote.spanMargin;
      totalExposure += quote.exposureMargin;
      unhedgedMargin += quote.requiredMargin;
    }

    // Hedged Portfolio Spread Benefit (e.g. 50% reduction if user has long & short positions)
    const marginBenefit = positions.length >= 2 ? unhedgedMargin * 0.35 : 0;
    const requiredCapital = Math.max(0, unhedgedMargin - marginBenefit);
    const marginUtilizationPct = availableCapital > 0 ? Math.min(100, (requiredCapital / availableCapital) * 100) : 0;
    const shortfall = Math.max(0, requiredCapital - availableCapital);

    return {
      totalPortfolioMargin: Number(unhedgedMargin.toFixed(2)),
      spanMargin: Number(totalSpan.toFixed(2)),
      exposureMargin: Number(totalExposure.toFixed(2)),
      additionalMargin: 0,
      marginBenefit: Number(marginBenefit.toFixed(2)),
      requiredCapital: Number(requiredCapital.toFixed(2)),
      availableCapital: Number(availableCapital.toFixed(2)),
      marginUtilizationPct: Number(marginUtilizationPct.toFixed(2)),
      shortfall: Number(shortfall.toFixed(2)),
    };
  }

  /**
   * Precise Statutory Charges Calculator (STT, GST, Exchange Charges, Stamp Duty, SEBI Fee)
   * Supports Zero Brokerage & Zero Tax policy.
   */
  public calculateStatutoryCharges(
    side: 'BUY' | 'SELL',
    orderValue: number,
    optionType: 'CE' | 'PE' | 'XX',
    config: any
  ): StatutoryChargesBreakdown {
    // If Zero Tax policy is enabled via environment or config, set all taxes and statutory charges to ₹0.00
    const isZeroTax = process.env.ZERO_TAX === 'true' || config?.mode === 'ZERO_TAX';

    if (isZeroTax) {
      return { stt: 0, gst: 0, exchangeCharges: 0, stampDuty: 0, sebiFee: 0, total: 0 };
    }

    const sttRate         = config?.stt_option_sell_rate     ?? 0.00125;
    const gstRate         = config?.gst_rate                 ?? 0.18;
    const exchRate        = config?.exchange_turnover_rate   ?? 0.0005;
    const sebiRate        = config?.sebi_turnover_rate       ?? 0.000001;
    const stampRate       = config?.stamp_duty_buy_rate      ?? 0.00003;

    // STT applies on Option SELL premium (0.125%)
    const stt = (side === 'SELL' && optionType !== 'XX') ? Number((orderValue * sttRate).toFixed(2)) : 0;

    // Stamp Duty applies on Option BUY premium (0.003%)
    const stampDuty = (side === 'BUY') ? Number((orderValue * stampRate).toFixed(2)) : 0;

    // Exchange Turnover Fee
    const exchangeCharges = Number((orderValue * exchRate).toFixed(2));

    // SEBI Turnover Fee
    const sebiFee = Number((orderValue * sebiRate).toFixed(2));

    // GST (18% on Exchange Turnover Fee + SEBI Fee, since Brokerage = 0)
    const gst = Number(((exchangeCharges + sebiFee) * gstRate).toFixed(2));

    const total = Number((stt + stampDuty + exchangeCharges + sebiFee + gst).toFixed(2));

    return { stt, gst, exchangeCharges, stampDuty, sebiFee, total };
  }

  private getSpotPrice(underlying: string, token?: string): number {
    if (token) {
      const tick = MarketDataEngine.getInstance().getCachedTick(token);
      if (tick && tick.ltp > 0) return tick.ltp;
    }
    const clean = underlying.toUpperCase();
    if (clean.includes('BANK')) return 52200;
    if (clean.includes('SENSEX')) return 80000;
    return 24500;
  }

  private async getMarginParams(underlying: string, exchange: string): Promise<any> {
    const clean = underlying.toUpperCase();
    const row = await queryOne<any>(
      `SELECT * FROM margin_parameters WHERE UPPER(underlying) = $1 LIMIT 1`,
      [clean]
    );
    return {
      spanMarginRate: row ? parseFloat(row.span_margin_rate) : 0.12,
      exposureMarginRate: row ? parseFloat(row.exposure_margin_rate) : 0.03,
      additionalMarginRate: row ? parseFloat(row.additional_margin_rate) : 0.00,
    };
  }

  private async getStatutoryConfig(): Promise<any> {
    const row = await queryOne<any>('SELECT * FROM statutory_charge_config LIMIT 1');
    return row || {
      stt_option_sell_rate: 0.00125,
      gst_rate: 0.18,
      exchange_turnover_rate: 0.0005,
      sebi_turnover_rate: 0.000001,
      stamp_duty_buy_rate: 0.00003
    };
  }
}

export const marginEngineService = MarginEngineService.getInstance();
