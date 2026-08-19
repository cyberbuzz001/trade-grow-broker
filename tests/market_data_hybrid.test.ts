import { MarketDataEngine } from '../server/src/marketData/MarketDataEngine';
import { MarketTick } from '../server/src/marketData/types';

describe('Hybrid Market Data Architecture & Auto-Failover Tests', () => {
  let engine: MarketDataEngine;

  beforeAll(async () => {
    engine = MarketDataEngine.getInstance();
    await engine.initialize();
  });

  test('1. Initializes in Hybrid mode with Dhan as primary live streamer', () => {
    const status = engine.getHybridStatus();
    expect(status.mode).toBe('HYBRID');
    expect(status.historicalCandlesProvider).toContain('FYERS');
    expect(status.optionGreeksProvider).toContain('FYERS');
    expect(status.failoverActive).toBe(false);
  });

  test('2. Routes Historical Candles to Fyers v3 API', async () => {
    const candles = await engine.getHistoricalCandles('NSE_RELIANCE', '5m', 20);
    expect(candles.length).toBeGreaterThan(0);
    expect(candles[0].time).toBeGreaterThan(0);
    expect(typeof candles[0].close).toBe('number');
  });

  test('3. Routes Option Chain to Fyers with Black-Scholes Greeks', async () => {
    const chain = await engine.getOptionChain('NIFTY', '2026-08-28');
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0].strikePrice).toBeGreaterThan(0);
    expect(chain[0].ce).toBeDefined();
    expect(chain[0].pe).toBeDefined();
  });

  test('4. Caches and retrieves ticks correctly', () => {
    const mockTick: MarketTick = {
      instrumentToken: 'NSE_RELIANCE',
      exchange: 'NSE',
      symbol: 'RELIANCE',
      ltp: 2950.50,
      open: 2940.0,
      high: 2960.0,
      low: 2935.0,
      close: 2945.0,
      change: 5.5,
      changePercent: 0.18,
      volume: 1200000,
      bid: 2950.40,
      ask: 2950.60,
      bidQty: 100,
      askQty: 150,
      timestamp: Date.now(),
      source: 'dhan'
    };

    engine.setCachedTick(mockTick);
    const cached = engine.getCachedTick('NSE_RELIANCE');
    expect(cached).toBeDefined();
    expect(cached?.ltp).toBe(2950.50);
  });

  test('5. Supports hot-switching primary providers', async () => {
    await engine.switchPrimaryProvider('FYERS');
    expect(engine.getActiveProviderName()).toBe('FYERS');

    // Switch back to DHAN
    await engine.switchPrimaryProvider('DHAN');
    expect(engine.getActiveProviderName()).toBe('DHAN');
  });
});
