import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, LineStyle } from 'lightweight-charts';
import { ChartType, Timeframe, CandleData, IndicatorConfig, OrderMarker, PositionMarker } from './TradingChart.types';
import { normalizeAndSortCandles, aggregateTickToCandle } from './TradingChart.utils';
import { IndicatorEngine } from './IndicatorEngine';
import { IndicatorToolbar } from './IndicatorToolbar';
import { MarketTick } from '../../../types';
import { useSubscribeTokens, useMarketSocket } from '../../../hooks/useMarketSocket';
import { useTickFreshness } from '../../../hooks/useTickFreshness';
import { PriceBadge } from '../../PriceBadge';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';

interface TradingChartProps {
  exchange: string;
  symbol: string;
  token: string;
  latestTick?: MarketTick;
  orderMarkers?: OrderMarker[];
  positionMarkers?: PositionMarker[];
  theme?: 'dark' | 'light';
  onBuyClick?: (symbol: string, price: number) => void;
  onSellClick?: (symbol: string, price: number) => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  exchange,
  symbol,
  token,
  latestTick,
  orderMarkers = [],
  positionMarkers = [],
  theme = 'dark',
  onBuyClick,
  onSellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const activeIndicatorSeriesMap = useRef<Map<string, ISeriesApi<any>[]>>(new Map());

  const [chartType, setChartType] = useState<ChartType>('Candlestick');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const [rawCandles, setRawCandles] = useState<CandleData[]>([]);
  const currentCandleRef = useRef<CandleData | null>(null);

  const [indicators, setIndicators] = useState<IndicatorConfig[]>([
    { id: 'ind_ema9', name: 'EMA 9', type: 'EMA', period: 9, color: '#10b981', enabled: true },
    { id: 'ind_sma20', name: 'SMA 20', type: 'SMA', period: 20, color: '#3b82f6', enabled: true },
  ]);

  // 1. Reference-counted WebSocket token subscription via shared socket manager
  useSubscribeTokens([token]);

  // 2. Data freshness and price source evaluation hook
  const freshness = useTickFreshness(token);
  const socketTick = useMarketSocket().ticks.get(token);
  const activeTick = latestTick || socketTick || freshness.tick;

  const timeframeSecondsMap: Record<Timeframe, number> = {
    '1m': 60, '3m': 180, '5m': 300, '10m': 600, '15m': 900, '30m': 1800,
    '1h': 3600, '4h': 14400, '1D': 86400, '1W': 604800, '1M': 2592000
  };

  // Initialize Lightweight Charts Canvas
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === 'dark';
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#111827' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)' },
        horzLines: { color: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: isDark ? '#1e293b' : '#cbd5e1' },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: isFullScreen ? window.innerHeight - 100 : 440,
    });

    chartRef.current = chart;

    // Create Main Price Series based on ChartType
    createMainSeries(chart, chartType);

    // Create Volume Histogram Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Handle Window Resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      activeIndicatorSeriesMap.current.clear();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [theme, isFullScreen]);

  // Helper to switch main series
  const createMainSeries = (chart: IChartApi, type: ChartType) => {
    if (mainSeriesRef.current) {
      try {
        chart.removeSeries(mainSeriesRef.current);
      } catch {
        // Ignore if series belonged to a destroyed chart instance
      }
      mainSeriesRef.current = null;
    }

    if (type === 'Candlestick') {
      mainSeriesRef.current = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444',
        borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444',
      });
    } else if (type === 'Bar') {
      mainSeriesRef.current = chart.addBarSeries({
        upColor: '#10b981', downColor: '#ef4444',
      });
    } else if (type === 'Line') {
      mainSeriesRef.current = chart.addLineSeries({
        color: '#3b82f6', lineWidth: 2,
      });
    } else if (type === 'Area') {
      mainSeriesRef.current = chart.addAreaSeries({
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3b82f6',
        lineWidth: 2,
      });
    }
  };

  // Switch Chart Type dynamically
  useEffect(() => {
    if (chartRef.current && rawCandles.length > 0) {
      createMainSeries(chartRef.current, chartType);
      updateChartData(rawCandles);
    }
  }, [chartType]);

  // Fetch Historical Candles from Backend API
  const fetchHistoricalData = () => {
    setLoading(true);
    firstTickApplied.current = false;
    fetch(`/api/v1/market/candles?token=${token}&timeframe=${timeframe}&count=120`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.candles)) {
          let sorted = normalizeAndSortCandles(data.candles);

          // Use the server-snapshotted LTP to anchor the last candle.
          const anchorLtp: number | null = data.currentLtp ?? null;
          if (anchorLtp && anchorLtp > 0 && sorted.length > 0) {
            const last = sorted[sorted.length - 1];
            sorted[sorted.length - 1] = {
              ...last,
              close: anchorLtp,
              high: Math.max(last.high, anchorLtp),
              low: Math.min(last.low, anchorLtp),
            };
          }

          setRawCandles(sorted);
          if (sorted.length > 0) {
            currentCandleRef.current = sorted[sorted.length - 1];
          }
          updateChartData(sorted);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const firstTickApplied = useRef(false);

  useEffect(() => {
    fetchHistoricalData();
  }, [token, timeframe]);

  // Update chart data & indicators
  const updateChartData = (candles: CandleData[]) => {
    if (!mainSeriesRef.current || candles.length === 0) return;

    if (chartType === 'Candlestick' || chartType === 'Bar') {
      mainSeriesRef.current.setData(candles as any);
    } else {
      const lineData = candles.map(c => ({ time: c.time, value: c.close }));
      mainSeriesRef.current.setData(lineData as any);
    }

    if (volumeSeriesRef.current && showVolume) {
      const volumeData = candles.map(c => ({
        time: c.time,
        value: c.volume || 100,
        color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      }));
      volumeSeriesRef.current.setData(volumeData as any);
    }

    // Render Technical Indicators
    renderIndicators(candles);
    renderMarkers();
  };

  // Render Technical Indicators Overlay & Sub-Panes
  const renderIndicators = (candles: CandleData[]) => {
    if (!chartRef.current) return;

    // Clear previous indicator series
    activeIndicatorSeriesMap.current.forEach((seriesList) => {
      seriesList.forEach(s => {
        try {
          chartRef.current?.removeSeries(s);
        } catch {
          // Ignore stale series
        }
      });
    });
    activeIndicatorSeriesMap.current.clear();

    indicators.filter(ind => ind.enabled).forEach(ind => {
      const seriesList: ISeriesApi<any>[] = [];

      if (ind.type === 'SMA') {
        const points = IndicatorEngine.calculateSMA(candles, ind.period || 20);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#3b82f6', lineWidth: 1 });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'EMA') {
        const points = IndicatorEngine.calculateEMA(candles, ind.period || 9);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#10b981', lineWidth: 1 });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'WMA') {
        const points = IndicatorEngine.calculateWMA(candles, ind.period || 14);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#f59e0b', lineWidth: 1 });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'VWAP') {
        const points = IndicatorEngine.calculateVWAP(candles);
        const series = chartRef.current!.addLineSeries({ color: ind.color || '#eab308', lineWidth: 2, lineStyle: LineStyle.Dotted });
        series.setData(points as any);
        seriesList.push(series);
      } else if (ind.type === 'BOLLINGER') {
        const points = IndicatorEngine.calculateBollingerBands(candles, ind.period || 20, ind.stdDev || 2);
        const upperSeries = chartRef.current!.addLineSeries({ color: ind.color || '#8b5cf6', lineWidth: 1 });
        const lowerSeries = chartRef.current!.addLineSeries({ color: ind.color || '#8b5cf6', lineWidth: 1 });
        upperSeries.setData(points.map(p => ({ time: p.time, value: p.upper })) as any);
        lowerSeries.setData(points.map(p => ({ time: p.time, value: p.lower })) as any);
        seriesList.push(upperSeries, lowerSeries);
      }

      activeIndicatorSeriesMap.current.set(ind.id, seriesList);
    });
  };

  const [showTradeMarkers, setShowTradeMarkers] = useState<boolean>(false);

  // Render Executed Order Markers & Open Position Lines
  const renderMarkers = () => {
    if (!mainSeriesRef.current) return;

    if (showTradeMarkers && orderMarkers.length > 0) {
      const markers = orderMarkers.map(m => ({
        time: m.time as any,
        position: m.side === 'BUY' ? 'belowBar' : 'aboveBar',
        color: m.side === 'BUY' ? '#10b981' : '#ef4444',
        shape: m.side === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `${m.side === 'BUY' ? 'B' : 'S'} ${m.quantity}`,
      }));
      (mainSeriesRef.current as any).setMarkers(markers);
    } else {
      (mainSeriesRef.current as any).setMarkers([]);
    }

    if (positionMarkers.length > 0 && mainSeriesRef.current) {
      positionMarkers.forEach(p => {
        mainSeriesRef.current?.createPriceLine({
          price: p.averagePrice,
          color: p.side === 'LONG' ? '#10b981' : '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `POS ${p.side} ${p.quantity} @ ₹${p.averagePrice}`,
        });
      });
    }
  };

  useEffect(() => {
    renderMarkers();
  }, [showTradeMarkers, orderMarkers, positionMarkers]);

  // Imperative Real-Time Tick Update via WebSocket (Bypasses React Re-renders per Tick)
  useEffect(() => {
    if (!activeTick || !mainSeriesRef.current) return;

    const intervalSec = timeframeSecondsMap[timeframe] || 300;
    const tickTimeSec = Math.floor((activeTick.timestamp || Date.now()) / 1000);

    let baseCandle = currentCandleRef.current ?? (rawCandles.length > 0 ? rawCandles[rawCandles.length - 1] : null);

    // On FIRST tick after historical load, anchor the current candle without price jumps
    if (!firstTickApplied.current && baseCandle && rawCandles.length > 0) {
      firstTickApplied.current = true;
      const patchedLast: CandleData = {
        ...baseCandle,
        close: activeTick.ltp,
        high: Math.max(baseCandle.high, activeTick.ltp),
        low: Math.min(baseCandle.low, activeTick.ltp),
      };
      if (chartType === 'Candlestick' || chartType === 'Bar') {
        mainSeriesRef.current.update(patchedLast as any);
      } else {
        mainSeriesRef.current.update({ time: patchedLast.time, value: patchedLast.close } as any);
      }
      currentCandleRef.current = patchedLast;
      return;
    }

    const { candle } = aggregateTickToCandle(baseCandle, activeTick.ltp, tickTimeSec, intervalSec);
    currentCandleRef.current = candle;

    if (chartType === 'Candlestick' || chartType === 'Bar') {
      mainSeriesRef.current.update(candle as any);
    } else {
      mainSeriesRef.current.update({ time: candle.time, value: candle.close } as any);
    }

    if (volumeSeriesRef.current && showVolume) {
      volumeSeriesRef.current.update({
        time: candle.time,
        value: candle.volume || 100,
        color: candle.close >= candle.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      } as any);
    }
  }, [activeTick]);

  return (
    <div className={`flex flex-col bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 h-full shadow-sm ${isFullScreen ? 'fixed inset-0 z-50 rounded-none p-6' : ''}`}>
      {/* 1. CHART HEADER CONTROL TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-[var(--border-light)]">
        {/* Symbol, Source Badge & Price Summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg text-[var(--text-main)]">{symbol}</span>
            <span className="text-xs bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)] px-2 py-0.5 rounded font-mono font-bold">{exchange}</span>
            {/* Price Freshness / Source Tag Badge */}
            <PriceBadge
              state={freshness.state}
              source={freshness.source}
              timeSinceLastTick={freshness.timeSinceLastTick}
              size="sm"
            />
          </div>

          {activeTick && (
            <div className="flex items-center gap-2 num-font">
              <span className="text-xl font-extrabold text-[var(--text-main)]">₹{activeTick.ltp.toFixed(2)}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${activeTick.change >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'}`}>
                {activeTick.change >= 0 ? '+' : ''}{activeTick.change.toFixed(2)} ({activeTick.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {/* Chart Controls & Indicator Selector */}
        <div className="flex items-center gap-2">
          {/* Indicator Toolbar */}
          <IndicatorToolbar
            indicators={indicators}
            onToggleIndicator={id => setIndicators(prev => prev.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i))}
            onAddIndicator={config => setIndicators(prev => [...prev, config])}
            onRemoveIndicator={id => setIndicators(prev => prev.filter(i => i.id !== id))}
          />

          {/* Trades Toggle Button */}
          <button
            onClick={() => setShowTradeMarkers(!showTradeMarkers)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
              showTradeMarkers
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/40'
                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
            }`}
            title="Toggle Executed Trade Markers on Chart"
          >
            Trades {showTradeMarkers && `(${orderMarkers.length})`}
          </button>

          {/* Chart Type Selector */}
          <div className="flex bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-1 rounded-xl gap-1 text-xs">
            {(['Candlestick', 'Bar', 'Line', 'Area'] as ChartType[]).map(t => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${chartType === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Timeframe Selector */}
          <div className="flex bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-1 rounded-xl gap-1 text-xs font-bold">
            {(['1m', '5m', '15m', '1h', '1D'] as Timeframe[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${timeframe === tf ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Quick Buy/Sell Triggers */}
          {onBuyClick && (
            <button
              onClick={() => onBuyClick(symbol, activeTick?.ltp || 100)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm transition-all"
            >
              BUY
            </button>
          )}
          {onSellClick && (
            <button
              onClick={() => onSellClick(symbol, activeTick?.ltp || 100)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm transition-all"
            >
              SELL
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl transition-all"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. CHART CANVAS CONTAINER */}
      <div className="relative flex-1 min-h-[380px]" ref={containerRef}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-surface)]/80 z-10 text-[var(--text-muted)] text-sm font-semibold">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading Chart data...
          </div>
        )}
      </div>

      {/* 3. TRADINGVIEW ATTRIBUTION NOTICE */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-light)] font-semibold">
        <span>Powered by <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">TradingView Lightweight Charts™</a></span>
        <span className="num-font">TIMEZONE: Asia/Kolkata (IST)</span>
      </div>
    </div>
  );
};

