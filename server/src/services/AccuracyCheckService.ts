import { OptionChainEngine } from '../marketData/OptionChainEngine';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { GreeksEngine } from '../marketData/GreeksEngine';

export interface AccuracyMetric {
  symbol: string;
  timestamp: number;
  sampleSize: number;
  mapePercent: number; // Mean Absolute Percentage Error (%)
  maxErrorPercent: number;
  status: 'EXCELLENT' | 'WARNING' | 'CRITICAL';
}

export class AccuracyCheckService {
  private static instance: AccuracyCheckService;
  private timer: NodeJS.Timeout | null = null;
  private lastMetrics: Map<string, AccuracyMetric> = new Map();
  private readonly CHECK_INTERVAL_MS = 60_000; // 60 seconds
  private readonly TARGET_ERROR_THRESHOLD = 0.5; // 0.5% target

  public static getInstance(): AccuracyCheckService {
    if (!AccuracyCheckService.instance) {
      AccuracyCheckService.instance = new AccuracyCheckService();
    }
    return AccuracyCheckService.instance;
  }

  public start(): void {
    console.log('[AccuracyCheck] Starting automated option chain pricing accuracy guard (60s interval)...');
    void this.runAccuracyCheck();
    this.timer = setInterval(() => void this.runAccuracyCheck(), this.CHECK_INTERVAL_MS);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getLatestMetrics(): Record<string, AccuracyMetric> {
    const result: Record<string, AccuracyMetric> = {};
    this.lastMetrics.forEach((metric, symbol) => {
      result[symbol] = metric;
    });
    return result;
  }

  public async runAccuracyCheck(): Promise<AccuracyMetric | null> {
    const isMarketOpen = MarketDataEngine.isMarketHours();
    if (!isMarketOpen && process.env.NODE_ENV === 'production') {
      return null;
    }

    try {
      const result = await OptionChainEngine.generateOptionChain({ symbol: 'NIFTY', strikeRange: '5' });
      const { spotPrice, atmStrike, chain } = result;

      if (!chain || chain.length === 0) return null;

      let totalPercentageError = 0;
      let maxError = 0;
      let count = 0;

      chain.forEach(item => {
        const timeToExpiryYears = 0.08;
        const ivDecimal = item.ce.iv / 100.0;

        // Compute theoretical benchmark price
        const refCePrice = GreeksEngine.calculateOptionPrice(spotPrice, item.strikePrice, timeToExpiryYears, true, ivDecimal);
        const refPePrice = GreeksEngine.calculateOptionPrice(spotPrice, item.strikePrice, timeToExpiryYears, false, ivDecimal);

        if (item.ce.ltp > 0.1 && refCePrice > 0.1) {
          const ceError = (Math.abs(item.ce.ltp - refCePrice) / refCePrice) * 100;
          totalPercentageError += ceError;
          maxError = Math.max(maxError, ceError);
          count++;
        }

        if (item.pe.ltp > 0.1 && refPePrice > 0.1) {
          const peError = (Math.abs(item.pe.ltp - refPePrice) / refPePrice) * 100;
          totalPercentageError += peError;
          maxError = Math.max(maxError, peError);
          count++;
        }
      });

      const mapePercent = count > 0 ? Number((totalPercentageError / count).toFixed(3)) : 0;
      const maxErrorPercent = Number(maxError.toFixed(3));
      const status = mapePercent <= this.TARGET_ERROR_THRESHOLD ? 'EXCELLENT' : mapePercent <= 1.5 ? 'WARNING' : 'CRITICAL';

      const metric: AccuracyMetric = {
        symbol: 'NIFTY',
        timestamp: Date.now(),
        sampleSize: count,
        mapePercent,
        maxErrorPercent,
        status,
      };

      this.lastMetrics.set('NIFTY', metric);

      if (mapePercent > this.TARGET_ERROR_THRESHOLD) {
        console.warn(`[AccuracyCheck] ALERT: Pricing MAPE (${mapePercent}%) exceeded target threshold (${this.TARGET_ERROR_THRESHOLD}%) on NIFTY option chain. Max error: ${maxErrorPercent}%.`);
      } else {
        console.info(`[AccuracyCheck] Verified NIFTY option chain accuracy: MAPE ${mapePercent}% (Sample: ${count} contracts, Status: ${status}).`);
      }

      return metric;
    } catch (err: any) {
      console.error('[AccuracyCheck] Check failed:', err.message);
      return null;
    }
  }
}

export const accuracyCheckService = AccuracyCheckService.getInstance();
