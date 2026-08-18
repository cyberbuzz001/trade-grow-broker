import React, { useEffect, useRef, useState } from 'react';
import { OptionChainItem, MarketTick } from '../types';
import { ArrowRight, ArrowLeft, TrendingUp } from 'lucide-react';
import { SelectedOptionContract } from './OptionStrikeChartModal';

interface OptionChainRowProps {
  row: OptionChainItem;
  isAtm: boolean;
  spotPrice: number;
  viewMode: 'LTP_OI' | 'GREEKS' | 'VOLUME';
  ceTick?: MarketTick;
  peTick?: MarketTick;
  activeLtpKey: string | null;
  onSelectLtp: (key: string | null) => void;
  onOpenOrder: (
    optionToken: string,
    strike: number,
    optionType: 'CE' | 'PE',
    ltp: number,
    side: 'BUY' | 'SELL'
  ) => void;
  onOpenChart?: (contract: SelectedOptionContract) => void;
  underlying?: string;
  expiry?: string;
  lotSize?: number;
  exchange?: string;
  isMobile?: boolean;
}

export const formatQty = (num?: number): string => {
  if (!num || num === 0) return '-';
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

export const formatChangePct = (val?: number): { text: string; isPos: boolean } => {
  if (val === undefined || val === null || isNaN(val)) return { text: '0.00%', isPos: true };
  const sign = val >= 0 ? '+' : '';
  return { text: `${sign}${val.toFixed(2)}%`, isPos: val >= 0 };
};

export const OptionChainRowComponent: React.FC<OptionChainRowProps> = ({
  row,
  isAtm,
  spotPrice,
  viewMode,
  ceTick,
  peTick,
  activeLtpKey,
  onSelectLtp,
  onOpenOrder,
  onOpenChart,
  underlying = 'SENSEX',
  expiry = '',
  lotSize = 20,
  exchange = 'BSE',
  isMobile = false,
}) => {
  // Resolve live LTP and change% from WebSocket tick or static row fallback
  const ceLtp = ceTick?.ltp && ceTick.ltp > 0 ? ceTick.ltp : row.ce.ltp;
  const peLtp = peTick?.ltp && peTick.ltp > 0 ? peTick.ltp : row.pe.ltp;

  const ceChangePct = (ceTick?.changePercent !== undefined && !isNaN(ceTick.changePercent)) 
    ? ceTick.changePercent 
    : (row.ce.change ? (row.ce.change / (ceLtp - row.ce.change || 1)) * 100 : 0);

  const peChangePct = (peTick?.changePercent !== undefined && !isNaN(peTick.changePercent)) 
    ? peTick.changePercent 
    : (row.pe.change ? (row.pe.change / (peLtp - row.pe.change || 1)) * 100 : 0);

  const prevCeLtpRef = useRef<number>(ceLtp);
  const prevPeLtpRef = useRef<number>(peLtp);

  const [ceFlashClass, setCeFlashClass] = useState<'price-flash-up' | 'price-flash-down' | ''>('');
  const [peFlashClass, setPeFlashClass] = useState<'price-flash-up' | 'price-flash-down' | ''>('');

  // Call (CE) Price Flash Animation
  useEffect(() => {
    if (ceLtp === prevCeLtpRef.current) return;
    if (ceLtp > prevCeLtpRef.current) {
      setCeFlashClass('price-flash-up');
    } else if (ceLtp < prevCeLtpRef.current) {
      setCeFlashClass('price-flash-down');
    }
    prevCeLtpRef.current = ceLtp;

    const timer = setTimeout(() => {
      setCeFlashClass('');
    }, 350);
    return () => clearTimeout(timer);
  }, [ceLtp]);

  // Put (PE) Price Flash Animation
  useEffect(() => {
    if (peLtp === prevPeLtpRef.current) return;
    if (peLtp > prevPeLtpRef.current) {
      setPeFlashClass('price-flash-up');
    } else if (peLtp < prevPeLtpRef.current) {
      setPeFlashClass('price-flash-down');
    }
    prevPeLtpRef.current = peLtp;

    const timer = setTimeout(() => {
      setPeFlashClass('');
    }, 350);
    return () => clearTimeout(timer);
  }, [peLtp]);

  // ITM Calculations
  const isCeItm = row.strikePrice < spotPrice;
  const isPeItm = row.strikePrice > spotPrice;

  // PCR Calculation for Strike
  const callOi = row.ce.openInterest || 1;
  const putOi = row.pe.openInterest || 0;
  const pcrVal = (putOi / callOi).toFixed(2);

  const ceKey = `${row.strikePrice}_CE`;
  const peKey = `${row.strikePrice}_PE`;

  const isCeActive = activeLtpKey === ceKey;
  const isPeActive = activeLtpKey === peKey;

  const formattedCePct = formatChangePct(ceChangePct);
  const formattedPePct = formatChangePct(peChangePct);

  const handleOpenCeChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onOpenChart) return;
    onOpenChart({
      underlying,
      symbol: `${underlying} ${row.strikePrice} CE`,
      strike: row.strikePrice,
      optionType: 'CE',
      expiry: expiry || row.expiry || new Date().toISOString().slice(0, 10),
      exchange,
      instrumentToken: row.ce.instrumentToken,
      lotSize,
      initialLtp: ceLtp,
      iv: row.ce.iv,
      delta: row.ce.delta,
      openInterest: row.ce.openInterest,
    });
  };

  const handleOpenPeChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onOpenChart) return;
    onOpenChart({
      underlying,
      symbol: `${underlying} ${row.strikePrice} PE`,
      strike: row.strikePrice,
      optionType: 'PE',
      expiry: expiry || row.expiry || new Date().toISOString().slice(0, 10),
      exchange,
      instrumentToken: row.pe.instrumentToken,
      lotSize,
      initialLtp: peLtp,
      iv: row.pe.iv,
      delta: row.pe.delta,
      openInterest: row.pe.openInterest,
    });
  };

  // Render Mobile Row View
  if (isMobile) {
    return (
      <tr
        className={`transition-colors border-b border-slate-800/80 text-xs font-mono tabular-nums ${
          isAtm
            ? 'bg-amber-950/40 font-bold border-amber-500/50'
            : 'hover:bg-slate-800/40'
        }`}
      >
        {/* Call Volume */}
        <td className={`py-2 px-1.5 text-left text-[11px] text-slate-400 ${isCeItm ? 'bg-cyan-950/20' : ''}`}>
          {formatQty(row.ce.volume)}
        </td>

        {/* CALL LTP Cell (Tap to reveal BUY/SELL/CHART) */}
        <td
          onClick={() => onSelectLtp(isCeActive ? null : ceKey)}
          className={`py-2 px-1 text-center cursor-pointer transition-all duration-150 relative min-h-[44px] min-w-[70px] ${
            isCeItm ? 'bg-cyan-950/30 text-cyan-300' : 'text-slate-200'
          } ${isCeActive ? 'ring-2 ring-cyan-400 bg-cyan-950/60 z-10' : 'hover:bg-cyan-950/20'} ${ceFlashClass}`}
        >
          {isCeActive ? (
            <div className="flex items-center justify-center gap-1 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'BUY');
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                BUY
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'SELL');
                }}
                className="bg-rose-500 hover:bg-rose-400 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                SELL
              </button>
              {onOpenChart && (
                <button
                  type="button"
                  onClick={handleOpenCeChart}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px] flex items-center gap-1"
                  title="Open Strike Chart"
                >
                  <TrendingUp size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`font-bold text-xs ${formattedCePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{ceLtp.toFixed(2)}
              </span>
              <span className={`text-[10px] ${formattedCePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formattedCePct.text}
              </span>
            </div>
          )}
        </td>

        {/* STRIKE PRICE (Center Column with PCR) */}
        <td
          onClick={handleOpenCeChart}
          className={`py-2 px-1.5 text-center font-extrabold border-x border-slate-800/80 cursor-pointer hover:bg-slate-800/60 transition-colors ${
            isAtm ? 'text-amber-300 bg-amber-950/60 font-black' : 'text-slate-200 bg-slate-950/60'
          }`}
          title="Click to view Strike Chart"
        >
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-white flex items-center gap-1">
              {row.strikePrice}
              {isAtm && <span className="text-[9px] bg-amber-400 text-slate-950 px-1 rounded font-black">ATM</span>}
            </span>
            <span className="text-[9px] text-slate-400 font-medium">PCR: {pcrVal}</span>
          </div>
        </td>

        {/* PUT LTP Cell (Tap to reveal BUY/SELL/CHART) */}
        <td
          onClick={() => onSelectLtp(isPeActive ? null : peKey)}
          className={`py-2 px-1 text-center cursor-pointer transition-all duration-150 relative min-h-[44px] min-w-[70px] ${
            isPeItm ? 'bg-purple-950/30 text-purple-300' : 'text-slate-200'
          } ${isPeActive ? 'ring-2 ring-purple-400 bg-purple-950/60 z-10' : 'hover:bg-purple-950/20'} ${peFlashClass}`}
        >
          {isPeActive ? (
            <div className="flex items-center justify-center gap-1 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'BUY');
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                BUY
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.vibrate?.(30);
                  onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'SELL');
                }}
                className="bg-rose-500 hover:bg-rose-400 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px]"
              >
                SELL
              </button>
              {onOpenChart && (
                <button
                  type="button"
                  onClick={handleOpenPeChart}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] px-2 py-1.5 rounded shadow cursor-pointer active:scale-95 min-h-[40px] flex items-center gap-1"
                  title="Open Strike Chart"
                >
                  <TrendingUp size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`font-bold text-xs ${formattedPePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{peLtp.toFixed(2)}
              </span>
              <span className={`text-[10px] ${formattedPePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formattedPePct.text}
              </span>
            </div>
          )}
        </td>

        {/* Put Volume */}
        <td className={`py-2 px-1.5 text-right text-[11px] text-slate-400 ${isPeItm ? 'bg-purple-950/20' : ''}`}>
          {formatQty(row.pe.volume)}
        </td>
      </tr>
    );
  }

  // Render Desktop Multi-Column Table Row (Matching Reference)
  return (
    <tr
      className={`transition-colors border-b border-slate-800/60 text-xs font-mono tabular-nums ${
        isAtm
          ? 'bg-amber-950/30 border-y border-amber-400/50 font-bold'
          : 'hover:bg-slate-800/50'
      }`}
    >
      {/* --- CALLS (CE) SIDE --- */}
      {viewMode === 'GREEKS' ? (
        <>
          <td className={`py-2.5 px-3 text-slate-400 ${isCeItm ? 'bg-cyan-950/20' : ''}`}>
            Δ {row.ce.delta?.toFixed(2) || '0.50'}
          </td>
          <td className={`py-2.5 px-3 text-slate-400 ${isCeItm ? 'bg-cyan-950/20' : ''}`}>
            IV {row.ce.iv?.toFixed(1) || '12.0'}%
          </td>
        </>
      ) : (
        <>
          {/* CALL Volume */}
          <td className={`py-2.5 px-3 text-slate-300 text-left ${isCeItm ? 'bg-cyan-950/20' : ''}`}>
            {formatQty(row.ce.volume)}
          </td>

          {/* CALL OI Change (Change%) */}
          <td className={`py-2.5 px-3 text-slate-400 text-left ${isCeItm ? 'bg-cyan-950/20' : ''}`}>
            {formatQty(row.ce.openInterestChange)} {row.ce.openInterestChange ? `(${(row.ce.openInterestChange / (row.ce.openInterest || 1) * 100).toFixed(1)}%)` : ''}
          </td>

          {/* CALL OI */}
          <td className={`py-2.5 px-3 text-slate-300 text-left ${isCeItm ? 'bg-cyan-950/20' : ''}`}>
            {formatQty(row.ce.openInterest)}
          </td>
        </>
      )}

      {/* CALL LTP CELL (Hover / Click Contextual BUY/SELL/CHART interaction) */}
      <td
        onClick={() => onSelectLtp(isCeActive ? null : ceKey)}
        className={`py-2.5 px-3 text-right cursor-pointer transition-all duration-150 relative min-w-[130px] ${
          isCeItm ? 'bg-cyan-950/30 text-cyan-300 font-bold' : 'text-cyan-400 font-bold'
        } ${isCeActive ? 'ring-2 ring-emerald-400 bg-cyan-950/80 shadow-lg z-10' : 'hover:bg-cyan-950/40 group'} ${ceFlashClass}`}
      >
        {isCeActive ? (
          <div className="flex items-center justify-end gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'BUY');
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              BUY
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'SELL');
              }}
              className="bg-rose-500 hover:bg-rose-400 text-white font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              SELL
            </button>
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenCeChart}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-2 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform flex items-center gap-1"
                title="Open CE Strike Chart"
              >
                <TrendingUp size={12} /> Chart
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenCeChart}
                className="p-1 rounded bg-slate-800/80 hover:bg-blue-600 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                title="View Strike Chart"
              >
                <TrendingUp size={12} />
              </button>
            )}
            <span className={`text-xs font-bold ${formattedCePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{ceLtp.toFixed(2)}
            </span>
            <span className={`text-[11px] ${formattedCePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
              ({formattedCePct.text})
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </td>

      {/* --- STRIKE PRICE (CENTER COLUMN) --- */}
      <td
        onClick={handleOpenCeChart}
        className={`py-2.5 px-4 font-extrabold text-sm border-x border-slate-800/80 text-center cursor-pointer hover:bg-slate-900 transition-colors ${
          isAtm
            ? 'text-amber-300 bg-amber-950/60 font-black tracking-wider shadow-inner'
            : 'text-white bg-slate-950'
        }`}
        title="Click to view Strike Chart"
      >
        <div className="flex items-center justify-center gap-1 font-mono">
          <span>{row.strikePrice}</span>
          {isAtm && (
            <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black">
              ATM
            </span>
          )}
        </div>
      </td>

      {/* --- PUTS (PE) SIDE --- */}
      {/* PUT LTP CELL (Hover / Click Contextual BUY/SELL/CHART interaction) */}
      <td
        onClick={() => onSelectLtp(isPeActive ? null : peKey)}
        className={`py-2.5 px-3 text-left cursor-pointer transition-all duration-150 relative min-w-[130px] ${
          isPeItm ? 'bg-purple-950/30 text-purple-300 font-bold' : 'text-purple-400 font-bold'
        } ${isPeActive ? 'ring-2 ring-emerald-400 bg-purple-950/80 shadow-lg z-10' : 'hover:bg-purple-950/40 group'} ${peFlashClass}`}
      >
        {isPeActive ? (
          <div className="flex items-center justify-start gap-1.5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'BUY');
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              BUY
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.vibrate?.(30);
                onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'SELL');
              }}
              className="bg-rose-500 hover:bg-rose-400 text-white font-black text-xs px-2.5 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform"
            >
              SELL
            </button>
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenPeChart}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs px-2 py-1 rounded shadow cursor-pointer active:scale-95 transition-transform flex items-center gap-1"
                title="Open PE Strike Chart"
              >
                <TrendingUp size={12} /> Chart
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-start gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className={`text-xs font-bold ${formattedPePct.isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{peLtp.toFixed(2)}
            </span>
            <span className={`text-[11px] ${formattedPePct.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
              ({formattedPePct.text})
            </span>
            {onOpenChart && (
              <button
                type="button"
                onClick={handleOpenPeChart}
                className="p-1 rounded bg-slate-800/80 hover:bg-blue-600 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                title="View Strike Chart"
              >
                <TrendingUp size={12} />
              </button>
            )}
          </div>
        )}
      </td>

      {viewMode === 'GREEKS' ? (
        <>
          <td className={`py-2.5 px-3 text-slate-400 ${isPeItm ? 'bg-purple-950/20' : ''}`}>
            IV {row.pe.iv?.toFixed(1) || '12.0'}%
          </td>
          <td className={`py-2.5 px-3 text-slate-400 ${isPeItm ? 'bg-purple-950/20' : ''}`}>
            Δ {row.pe.delta?.toFixed(2) || '0.50'}
          </td>
        </>
      ) : (
        <>
          {/* PUT OI */}
          <td className={`py-2.5 px-3 text-slate-300 text-right ${isPeItm ? 'bg-purple-950/20' : ''}`}>
            {formatQty(row.pe.openInterest)}
          </td>

          {/* PUT OI Change (Change%) */}
          <td className={`py-2.5 px-3 text-slate-400 text-right ${isPeItm ? 'bg-purple-950/20' : ''}`}>
            {formatQty(row.pe.openInterestChange)} {row.pe.openInterestChange ? `(${(row.pe.openInterestChange / (row.pe.openInterest || 1) * 100).toFixed(1)}%)` : ''}
          </td>

          {/* PUT Volume */}
          <td className={`py-2.5 px-3 text-slate-300 text-right ${isPeItm ? 'bg-purple-950/20' : ''}`}>
            {formatQty(row.pe.volume)}
          </td>
        </>
      )}
    </tr>
  );
};

export const OptionChainRow = React.memo(
  OptionChainRowComponent,
  (prevProps, nextProps) => {
    const prevCeLtp = prevProps.ceTick?.ltp ?? prevProps.row.ce.ltp;
    const nextCeLtp = nextProps.ceTick?.ltp ?? nextProps.row.ce.ltp;

    const prevPeLtp = prevProps.peTick?.ltp ?? prevProps.row.pe.ltp;
    const nextPeLtp = nextProps.peTick?.ltp ?? nextProps.row.pe.ltp;

    return (
      prevProps.row.strikePrice === nextProps.row.strikePrice &&
      prevProps.isAtm === nextProps.isAtm &&
      prevProps.spotPrice === nextProps.spotPrice &&
      prevProps.viewMode === nextProps.viewMode &&
      prevProps.activeLtpKey === nextProps.activeLtpKey &&
      prevProps.isMobile === nextProps.isMobile &&
      prevCeLtp === nextCeLtp &&
      prevPeLtp === nextPeLtp
    );
  }
);
