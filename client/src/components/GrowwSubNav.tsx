import React from 'react';
import { LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { MarketTick } from '../types';

interface GrowwSubNavProps {
  activeView: 'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'ADMIN';
  onSelectView: (view: 'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'ADMIN') => void;
  isTerminalMode: boolean;
  onToggleTerminal: () => void;
  ticks?: Map<string, MarketTick>;
}

export const GrowwSubNav: React.FC<GrowwSubNavProps> = ({
  activeView,
  onSelectView,
  isTerminalMode,
  onToggleTerminal,
  ticks,
}) => {
  const getNifty = () => ticks?.get('NSE_NIFTY50') || ticks?.get('NIFTY50') || ticks?.get('NIFTY 50');
  const getSensex = () => ticks?.get('BSE_SENSEX') || ticks?.get('SENSEX');
  const getBankNifty = () => ticks?.get('NSE_BANKNIFTY') || ticks?.get('NIFTY BANK') || ticks?.get('BANKNIFTY');
  const getMidcap = () => ticks?.get('NSE_MIDCPNIFTY') || ticks?.get('MIDCPNIFTY');
  const getFinNifty = () => ticks?.get('NSE_FINNIFTY') || ticks?.get('FINNIFTY');

  const formatLtp = (tick?: MarketTick, fallback: number = 0) => {
    const val = tick ? tick.ltp : fallback;
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (tick?: MarketTick, fallbackChange: number = 0, fallbackPct: number = 0) => {
    const chg = tick ? tick.change : fallbackChange;
    const pct = tick ? tick.changePercent : fallbackPct;
    const isPos = chg >= 0;
    return {
      text: `${isPos ? '+' : ''}${chg.toFixed(2)} (${isPos ? '+' : ''}${pct.toFixed(2)}%)`,
      isPos,
    };
  };

  const niftyTick = getNifty();
  const sensexTick = getSensex();
  const bankTick = getBankNifty();
  const midcapTick = getMidcap();
  const finTick = getFinNifty();

  const niftyChg = formatChange(niftyTick, 10.35, 0.04);
  const sensexChg = formatChange(sensexTick, 153.26, 0.20);
  const bankChg = formatChange(bankTick, 151.15, 0.26);
  const midcapChg = formatChange(midcapTick, 34.00, 0.23);
  const finChg = formatChange(finTick, 65.00, 0.24);

  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
      
      {/* 1. SUB-NAVIGATION TABS & TERMINAL TOGGLE */}
      <div className="px-4 lg:px-8 flex items-center justify-between border-b border-[var(--border-light)] h-12 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-6 sm:gap-8 text-xs font-extrabold flex-shrink-0">
          {(['EXPLORE', 'HOLDINGS', 'POSITIONS', 'ORDERS', 'WATCHLIST'] as const).map(v => (
            <button
              key={v}
              onClick={() => onSelectView(v)}
              className={`py-3.5 transition-colors relative outline-none focus:outline-none ring-0 ${
                activeView === v && !isTerminalMode
                  ? 'text-[var(--groww-green)] font-black border-b-2 border-[var(--groww-green)]'
                  : 'text-slate-600 dark:text-slate-300 font-bold hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {v.charAt(0) + v.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* TOP RIGHT TERMINAL TOGGLE BUTTON */}
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all shadow-xs outline-none focus:outline-none flex-shrink-0 ${
            isTerminalMode
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
              : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-slate-800 dark:text-slate-100 hover:border-emerald-500 font-extrabold'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Terminal</span>
        </button>
      </div>

      {/* 2. LIVE INDICES TICKER STRIP */}
      <div className="px-4 lg:px-8 py-2.5 overflow-x-auto flex items-center gap-6 text-[11px] font-extrabold num-font whitespace-nowrap bg-[var(--bg-surface-elevated)]/50 scrollbar-none">
        
        {/* NIFTY */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-4 border-r border-[var(--border-color)]/50">
          <span className="text-slate-800 dark:text-slate-200 uppercase tracking-wider font-black">NIFTY</span>
          <span className="text-[var(--text-main)] font-black">{formatLtp(niftyTick, 24584.63)}</span>
          <span className={niftyChg.isPos ? 'text-[var(--groww-green)] font-bold' : 'text-rose-500 font-bold'}>
            {niftyChg.text}
          </span>
        </div>

        {/* SENSEX */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-4 border-r border-[var(--border-color)]/50">
          <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wider font-black">SENSEX</span>
          <span className="text-[var(--text-main)] font-black">{formatLtp(sensexTick, 80617.19)}</span>
          <span className={sensexChg.isPos ? 'text-[var(--groww-green)] font-bold' : 'text-rose-500 font-bold'}>
            {sensexChg.text}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-500/20">
            Expiry
          </span>
        </div>

        {/* BANKNIFTY */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-4 border-r border-[var(--border-color)]/50">
          <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wider font-black">BANKNIFTY</span>
          <span className="text-[var(--text-main)] font-black">{formatLtp(bankTick, 57275.62)}</span>
          <span className={bankChg.isPos ? 'text-[var(--groww-green)] font-bold' : 'text-rose-500 font-bold'}>
            {bankChg.text}
          </span>
        </div>

        {/* MIDCPNIFTY */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-4 border-r border-[var(--border-color)]/50">
          <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wider font-black">MIDCPNIFTY</span>
          <span className="text-[var(--text-main)] font-black">{formatLtp(midcapTick, 14914.30)}</span>
          <span className={midcapChg.isPos ? 'text-[var(--groww-green)] font-bold' : 'text-rose-500 font-bold'}>
            {midcapChg.text}
          </span>
        </div>

        {/* FINNIFTY */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-slate-700 dark:text-slate-300 uppercase tracking-wider font-black">FINNIFTY</span>
          <span className="text-[var(--text-main)] font-black">{formatLtp(finTick, 26870.00)}</span>
          <span className={finChg.isPos ? 'text-[var(--groww-green)] font-bold' : 'text-rose-500 font-bold'}>
            {finChg.text}
          </span>
        </div>

      </div>

    </div>
  );
};
