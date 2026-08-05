import { CandleData } from './TradingChart.types';

export function normalizeAndSortCandles(rawCandles: any[]): CandleData[] {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) return [];

  const validCandles: CandleData[] = [];

  for (const c of rawCandles) {
    if (!c) continue;
    let timeNum = typeof c.time === 'number' ? c.time : Math.floor(new Date(c.time).getTime() / 1000);
    if (isNaN(timeNum) || timeNum <= 0) continue;

    const open = Number(c.open || 0);
    const high = Number(c.high || open);
    const low = Number(c.low || open);
    const close = Number(c.close || open);
    const volume = Number(c.volume || 0);

    // Sanity validation: High must be >= max(open, close), Low <= min(open, close)
    const validHigh = Math.max(high, open, close);
    const validLow = Math.min(low, open, close);

    validCandles.push({
      time: timeNum,
      open,
      high: validHigh,
      low: validLow,
      close,
      volume
    });
  }

  // Deduplicate by timestamp and sort ascending
  const map = new Map<number, CandleData>();
  for (const candle of validCandles) {
    map.set(candle.time, candle);
  }

  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export function aggregateTickToCandle(
  existingCandle: CandleData | null,
  tickPrice: number,
  tickTime: number,
  intervalSeconds: number
): { candle: CandleData; isNewCandle: boolean } {
  const currentIntervalStart = Math.floor(tickTime / intervalSeconds) * intervalSeconds;

  if (!existingCandle || existingCandle.time < currentIntervalStart) {
    return {
      candle: {
        time: currentIntervalStart,
        open: tickPrice,
        high: tickPrice,
        low: tickPrice,
        close: tickPrice,
        volume: 10
      },
      isNewCandle: true
    };
  }

  return {
    candle: {
      time: existingCandle.time,
      open: existingCandle.open,
      high: Math.max(existingCandle.high, tickPrice),
      low: Math.min(existingCandle.low, tickPrice),
      close: tickPrice,
      volume: (existingCandle.volume || 0) + 1
    },
    isNewCandle: false
  };
}
