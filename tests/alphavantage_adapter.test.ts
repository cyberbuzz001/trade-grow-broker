import { AlphaVantageAdapter } from '../server/src/marketData/AlphaVantageAdapter';

describe('Alpha Vantage Market Data Adapter Tests', () => {
  let adapter: AlphaVantageAdapter;

  beforeEach(() => {
    adapter = new AlphaVantageAdapter();
  });

  test('1. Initializes successfully with API key', async () => {
    await adapter.initialize();
    expect(adapter.name).toBe('ALPHAVANTAGE');
    expect(adapter.isHealthy()).toBe(true);
  });

  test('2. Generates historical candles correctly', async () => {
    const candles = await adapter.getHistoricalCandles('NSE_RELIANCE', '5m', 50);
    expect(candles.length).toBeGreaterThan(0);
    expect(candles[0].time).toBeGreaterThan(0);
    expect(typeof candles[0].close).toBe('number');
  });

  test('3. Generates dynamic option chain matrix', async () => {
    const chain = await adapter.getOptionChain('RELIANCE', '2026-08-28');
    expect(chain.length).toBeGreaterThan(0);
    expect(chain[0].strikePrice).toBeGreaterThan(0);
  });

  test('4. Enforces Safety Lock barrier preventing real money order placement', () => {
    expect(() => adapter.placeBrokerOrder()).toThrow('REAL-MONEY TRADING IS DISABLED');
  });
});
