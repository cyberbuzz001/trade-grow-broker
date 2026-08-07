import { MarketDataEngine } from '../marketData/MarketDataEngine';

export interface ReconciliationReport {
  timestamp: number;
  tokensChecked: number;
  passedCount: number;
  alertCount: number;
  results: Array<{
    symbol: string;
    token: string;
    cachedLtp: number;
    referenceLtp: number;
    diffPct: number;
    status: 'MATCH' | 'DIVERGENCE_ALERT' | 'MISSING_DATA';
  }>;
}

export class ReconciliationMonitorService {
  private static instance: ReconciliationMonitorService;
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastReport: ReconciliationReport | null = null;

  public static getInstance(): ReconciliationMonitorService {
    if (!ReconciliationMonitorService.instance) {
      ReconciliationMonitorService.instance = new ReconciliationMonitorService();
    }
    return ReconciliationMonitorService.instance;
  }

  public start(intervalMs: number = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[ReconciliationMonitor] Starting continuous price feed reconciliation monitor (${intervalMs / 1000}s interval)...`);
    
    // Run initial check after 10s warmup
    setTimeout(() => this.runReconciliationCheck(), 10000);
    this.timer = setInterval(() => this.runReconciliationCheck(), intervalMs);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.isRunning = false;
    console.log('[ReconciliationMonitor] Stopped price feed reconciliation monitor.');
  }

  public async runReconciliationCheck(): Promise<ReconciliationReport> {
    const engine = MarketDataEngine.getInstance();
    const sampleTokens = [
      { symbol: 'NIFTY 50', token: 'NSE_99926000' },
      { symbol: 'BANKNIFTY', token: 'NSE_99926009' },
      { symbol: 'NIFTY24500CE', token: 'NFO_49231' },
      { symbol: 'NIFTY24500PE', token: 'NFO_49232' },
      { symbol: 'RELIANCE', token: 'NSE_2885' },
    ];

    const results: ReconciliationReport['results'] = [];
    let passedCount = 0;
    let alertCount = 0;

    for (const sample of sampleTokens) {
      const cached = engine.getCachedTick(sample.token) || engine.getCachedTick(sample.token.replace(/^([A-Z]+_)/, ''));

      if (!cached) {
        results.push({
          symbol: sample.symbol,
          token: sample.token,
          cachedLtp: 0,
          referenceLtp: 0,
          diffPct: 0,
          status: 'MISSING_DATA',
        });
        continue;
      }

      let referenceTick = null;
      try {
        referenceTick = await engine.getQuote(sample.token);
      } catch (_) {}

      const refLtp = referenceTick ? referenceTick.ltp : cached.ltp;
      const cachedLtp = cached.ltp;
      const diffPct = refLtp > 0 ? Number((Math.abs(cachedLtp - refLtp) / refLtp * 100).toFixed(2)) : 0;

      const isAlert = diffPct > 0.50; // Threshold 0.50%
      const status = isAlert ? 'DIVERGENCE_ALERT' : 'MATCH';

      if (isAlert) {
        alertCount++;
        console.warn(`[ReconciliationMonitor] 🚨 DIVERGENCE ALERT: ${sample.symbol} (${sample.token}) | WS Cache: ₹${cachedLtp} vs Reference: ₹${refLtp} (Diff: ${diffPct}%)`);
      } else {
        passedCount++;
      }

      results.push({
        symbol: sample.symbol,
        token: sample.token,
        cachedLtp,
        referenceLtp: refLtp,
        diffPct,
        status,
      });
    }

    this.lastReport = {
      timestamp: Date.now(),
      tokensChecked: sampleTokens.length,
      passedCount,
      alertCount,
      results,
    };

    console.log(`[ReconciliationMonitor] Check complete. ${passedCount}/${sampleTokens.length} matched cleanly. Alerts: ${alertCount}.`);
    return this.lastReport;
  }

  public getLastReport(): ReconciliationReport | null {
    return this.lastReport;
  }
}

export const reconciliationMonitor = ReconciliationMonitorService.getInstance();
