import { queryOne } from '../db/schema';
import { VirtualWalletLedger } from './VirtualWalletLedger';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { marginEngineService } from '../services/MarginEngineService';

export interface RMSValidationResult {
  passed: boolean;
  reason?: string;
  requiredMargin: number;
}

export interface RMSOrderParams {
  userId: string;
  instrumentToken: string;
  exchange: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL_M';
  productType: 'MIS' | 'CNC' | 'NRML';
}

function getISTDateString(input?: Date | string | number | null): string {
  if (!input) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) return String(input).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

function parseExpiryToYYYYMMDD(str?: string): string | null {
  if (!str || str.trim() === '') return null;
  const clean = str.trim().toUpperCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };

  const match = clean.match(/^(\d{1,2})[-]?([A-Z]{3})[-]?(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = months[match[2]];
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-${day}`;
  }
  return null;
}

export class RMS {
  private static cachedRiskLimits: { maxQty: number; maxOrderVal: number; expiresAt: number } | null = null;

  private static async getRiskLimits(): Promise<{ maxQty: number; maxOrderVal: number }> {
    if (this.cachedRiskLimits && Date.now() < this.cachedRiskLimits.expiresAt) {
      return this.cachedRiskLimits;
    }
    const maxQtyRow   = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'MAX_ORDER_QTY'`);
    const maxValueRow = await queryOne<any>(`SELECT value FROM system_settings WHERE key = 'MAX_ORDER_VALUE'`);
    const maxQty      = maxQtyRow   ? parseInt(maxQtyRow.value, 10)   : 50000;
    const maxOrderVal = maxValueRow ? parseFloat(maxValueRow.value) : 10000000;

    this.cachedRiskLimits = {
      maxQty,
      maxOrderVal,
      expiresAt: Date.now() + 60000
    };
    return this.cachedRiskLimits;
  }

  public static async validateOrder(order: RMSOrderParams): Promise<RMSValidationResult> {
    // 1. Validate quantity
    if (!order.quantity || order.quantity <= 0) {
      return { passed: false, reason: 'ORDER_REJECTED: Quantity must be greater than 0', requiredMargin: 0 };
    }

    // 2. Instrument & Contract Non-Expiration Check
    const instrument = await queryOne<any>(
      `SELECT * FROM instruments WHERE instrument_token = $1 OR symbol = $2 LIMIT 1`,
      [order.instrumentToken, order.symbol]
    );

    if (instrument) {
      if (!instrument.active) {
        return { passed: false, reason: `ORDER_REJECTED: Instrument ${order.symbol} is currently inactive or suspended by exchange`, requiredMargin: 0 };
      }
      if (instrument.expiry) {
        const todayIST = getISTDateString();
        const parsedExp = getISTDateString(instrument.expiry);
        if (parsedExp && /^\d{4}-\d{2}-\d{2}$/.test(parsedExp) && parsedExp < todayIST) {
          return { passed: false, reason: `ORDER_REJECTED: Contract ${order.symbol} has expired on ${parsedExp}. Trading on expired contracts is strictly prohibited`, requiredMargin: 0 };
        }
      }
    }

    // 3. Fetch System Risk Limits (Cached)
    const { maxQty, maxOrderVal } = await this.getRiskLimits();

    if (order.quantity > maxQty) {
      return { passed: false, reason: `ORDER_REJECTED: Order quantity exceeds maximum allowed limit of ${maxQty}`, requiredMargin: 0 };
    }

    // 4. Reference execution price
    let refPrice = order.price;
    if (!refPrice || refPrice <= 0) {
      const tick = MarketDataEngine.getInstance().getCachedTick(order.instrumentToken);
      refPrice = tick ? tick.ltp : (instrument && parseFloat(instrument.strike || '0') > 0 ? parseFloat(instrument.strike) : 100.0);
    }

    const orderValue = refPrice * order.quantity;
    if (orderValue > maxOrderVal) {
      return {
        passed: false,
        reason: `ORDER_REJECTED: Total order value (₹${orderValue.toLocaleString('en-IN')}) exceeds maximum limit (₹${maxOrderVal.toLocaleString('en-IN')})`,
        requiredMargin: 0
      };
    }

    // 5. Check position reduction / square-off benefit
    const existingPos = await queryOne<any>(
      'SELECT net_qty FROM positions WHERE user_id = $1 AND symbol = $2 AND product_type = $3',
      [order.userId, order.symbol, order.productType]
    );

    const currentNetQty = existingPos ? parseInt(existingPos.net_qty, 10) : 0;
    let isSquareOff = false;

    if ((currentNetQty > 0 && order.side === 'SELL') || (currentNetQty < 0 && order.side === 'BUY')) {
      isSquareOff = true;
    }

    // Determine option details if derivative contract
    let optionType: 'CE' | 'PE' | 'XX' = 'XX';
    let strike = 0;
    let underlying = order.symbol;

    if (instrument) {
      optionType = instrument.option_type || (order.symbol.endsWith('CE') ? 'CE' : order.symbol.endsWith('PE') ? 'PE' : 'XX');
      strike = parseFloat(instrument.strike || '0');
      underlying = instrument.name || instrument.symbol;
    } else if (order.symbol.endsWith('CE')) {
      optionType = 'CE';
    } else if (order.symbol.endsWith('PE')) {
      optionType = 'PE';
    }

    // 6. Compute Authoritative Required Margin via MarginEngineService
    const marginQuote = await marginEngineService.calculateQuote({
      userId: order.userId,
      exchange: order.exchange || 'NSE',
      underlying,
      strike,
      optionType,
      side: order.side,
      quantity: order.quantity,
      price: refPrice,
      productType: order.productType,
      instrumentToken: order.instrumentToken,
    });

    // If order is purely position reduction/square-off, required additional margin is 0
    const requiredMargin = isSquareOff ? 0 : marginQuote.requiredMargin;

    // 7. Check CNC holdings for delivery sell
    if (order.side === 'SELL' && order.productType === 'CNC') {
      const holding = await queryOne<any>(
        'SELECT quantity FROM holdings WHERE user_id = $1 AND symbol = $2',
        [order.userId, order.symbol]
      );
      const availableQty = holding ? parseInt(holding.quantity, 10) : 0;
      if (availableQty < order.quantity) {
        return {
          passed: false,
          reason: `ORDER_REJECTED: Insufficient CNC holdings. Available: ${availableQty}, Requested: ${order.quantity}`,
          requiredMargin: 0
        };
      }
      return { passed: true, requiredMargin: 0 };
    }

    // 8. Check Virtual Buying Power
    if (!isSquareOff && !marginQuote.canPlaceOrder) {
      return {
        passed: false,
        reason: `ORDER_REJECTED: ${marginQuote.rejectionReason || 'Insufficient funds'}`,
        requiredMargin: marginQuote.requiredMargin
      };
    }

    return { passed: true, requiredMargin };
  }
}
