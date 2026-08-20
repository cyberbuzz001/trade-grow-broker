import { OptionChainEngine } from './OptionChainEngine';
import { EventEmitter } from 'events';
import { MarketDataEngine } from './MarketDataEngine';

export interface OptionChainSnapshot {
  underlying: string;
  exchange: string;
  spotPrice: number;
  futuresPrice: number;
  atmStrike: number;
  expiry: string;
  lotSize: number;
  spotSource?: string;
  pcrRatio?: number;
  maxPainStrike?: number;
  chain: any[];
  timestamp: number;
}

export class OptionChainBroadcasterService extends EventEmitter {
  private static instance: OptionChainBroadcasterService;
  private intervalTimer: NodeJS.Timeout | null = null;
  private activeSymbols: Set<string> = new Set(['NIFTY', 'BANKNIFTY', 'SENSEX']);
  private isRunning: boolean = false;
  private isBroadcasting: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): OptionChainBroadcasterService {
    if (!OptionChainBroadcasterService.instance) {
      OptionChainBroadcasterService.instance = new OptionChainBroadcasterService();
    }
    return OptionChainBroadcasterService.instance;
  }

  public addSymbol(symbol: string): void {
    if (symbol) {
      this.activeSymbols.add(symbol.toUpperCase().trim());
      this.subscriberCount++;
      this.startTimer();
    }
  }

  public removeSymbol(symbol: string): void {
    if (!symbol) return;
    this.subscriberCount = Math.max(0, this.subscriberCount - 1);
    if (this.subscriberCount === 0) {
      this.stopTimer();
    }
  }

  private intervalMs: number = 4000;
  private subscriberCount: number = 0;

  public start(intervalMs: number = 4000): void {
    this.intervalMs = intervalMs;
    // Timer is started on-demand when the first client subscribes.
    console.log(`[OptionChainBroadcaster] 🚀 Server-side option chain broadcaster ready (Interval: ${intervalMs}ms, lazy-start).`);
  }

  private startTimer(): void {
    if (this.isRunning || this.intervalTimer) return;
    this.isRunning = true;
    console.log('[OptionChainBroadcaster] Starting broadcast timer (active subscriber connected).');
    this.intervalTimer = setInterval(() => {
      this.broadcastActiveChains();
    }, this.intervalMs);
    // Send initial snapshot quickly
    setTimeout(() => this.broadcastActiveChains(), 500);
  }

  private stopTimer(): void {
    if (!this.isRunning) return;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log('[OptionChainBroadcaster] Broadcast timer stopped (no active subscribers).');
  }

  public stop(): void {
    this.subscriberCount = 0;
    this.stopTimer();
    console.log('[OptionChainBroadcaster] Stopped option chain broadcaster.');
  }

  private async broadcastActiveChains(): Promise<void> {
    if (this.isBroadcasting) return; // Prevent overlapping runs
    this.isBroadcasting = true;

    try {
      for (const sym of this.activeSymbols) {
        try {
          const chainData = await OptionChainEngine.generateOptionChain({
            symbol: sym,
            strikeRange: '10'
          });

          const snapshot: OptionChainSnapshot = {
            ...chainData,
            timestamp: Date.now()
          };

          this.emit('snapshot', snapshot);
        } catch (err: any) {
          // Log softly to prevent console flooding on off-market / rate limit
        }
      }
    } finally {
      this.isBroadcasting = false;
    }
  }
}

export const optionChainBroadcaster = OptionChainBroadcasterService.getInstance();
