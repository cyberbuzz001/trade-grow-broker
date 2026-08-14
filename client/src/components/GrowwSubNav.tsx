import React from 'react';
import { SlidersHorizontal, Compass, Briefcase, TrendingUp, Receipt, Bookmark, Layers, ShieldCheck, Activity } from 'lucide-react';
import { MarketTick } from '../types';

export type SubView = 'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'OPTION_CHAIN' | 'ADMIN' | 'ANALYTICS';

interface GrowwSubNavProps {
  activeView: SubView;
  onSelectView: (view: SubView) => void;
  isTerminalMode: boolean;
  onToggleTerminal: () => void;
  ticks?: Map<string, MarketTick>;
  user?: any;
}

export const GrowwSubNav: React.FC<GrowwSubNavProps> = ({
  activeView,
  onSelectView,
  isTerminalMode,
  onToggleTerminal,
  ticks,
  user,
}) => {
  const getNifty = () => ticks?.get('NSE_NIFTY50') || ticks?.get('NIFTY50') || ticks?.get('NIFTY 50');
  const getSensex = () => ticks?.get('BSE_SENSEX') || ticks?.get('SENSEX');
  const getBankNifty = () => ticks?.get('NSE_BANKNIFTY') || ticks?.get('NIFTY BANK') || ticks?.get('BANKNIFTY');
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
  const bankNiftyTick = getBankNifty();
  const finNiftyTick = getFinNifty();

  const niftyChg = formatChange(niftyTick, 104.35, 0.42);
  const sensexChg = formatChange(sensexTick, 308.26, 0.38);
  const bankNiftyChg = formatChange(bankNiftyTick, -78.40, -0.15);
  const finNiftyChg = formatChange(finNiftyTick, 52.10, 0.22);

  const isStaff = user && ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'OPERATIONS_MANAGER', 'DEALER', 'SUPPORT_AGENT', 'ANALYST'].includes(user.role);

  const navItems: { id: SubView; label: string; icon: React.ReactNode; shortcut?: string }[] = [
    { id: 'EXPLORE', label: 'Explore', icon: <Compass className="w-3.5 h-3.5" />, shortcut: '1' },
    { id: 'WATCHLIST', label: 'Watchlist', icon: <Bookmark className="w-3.5 h-3.5" />, shortcut: '2' },
    { id: 'POSITIONS', label: 'Positions', icon: <TrendingUp className="w-3.5 h-3.5" />, shortcut: '3' },
    { id: 'ORDERS', label: 'Orders', icon: <Receipt className="w-3.5 h-3.5" />, shortcut: '4' },
    { id: 'OPTION_CHAIN', label: 'Option Chain', icon: <Layers className="w-3.5 h-3.5" />, shortcut: '5' },
    { id: 'HOLDINGS', label: 'Holdings', icon: <Briefcase className="w-3.5 h-3.5" />, shortcut: '6' },
    ...(isStaff ? [{ id: 'ADMIN' as SubView, label: 'Admin Control', icon: <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> }] : []),
  ];

  return (
    <div className="bg-slate-950 border-b border-slate-800 transition-colors">
      
      {/* 1. REAL-TIME TICKER STRIP */}
      <div className="ticker-wrap font-mono text-xs tabular-nums px-4 lg:px-6 border-b border-slate-850 bg-slate-900/90">
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-none py-1.5 w-full">
          
          {/* NIFTY 50 */}
          <div className="flex items-center gap-2 flex-shrink-0 group cursor-pointer">
            <span className="font-bold text-slate-400 text-[11px] group-hover:text-white transition-colors">NIFTY 50</span>
            <span className="font-bold text-white num-font">{formatLtp(niftyTick, 24856.15)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${niftyChg.isPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {niftyChg.text}
            </span>
          </div>

          {/* SENSEX */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-slate-800 group cursor-pointer">
            <span className="font-bold text-slate-400 text-[11px] group-hover:text-white transition-colors">SENSEX</span>
            <span className="font-bold text-white num-font">{formatLtp(sensexTick, 81254.30)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${sensexChg.isPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {sensexChg.text}
            </span>
          </div>

          {/* BANK NIFTY */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-slate-800 group cursor-pointer">
            <span className="font-bold text-slate-400 text-[11px] group-hover:text-white transition-colors">BANK NIFTY</span>
            <span className="font-bold text-white num-font">{formatLtp(bankNiftyTick, 52150.75)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${bankNiftyChg.isPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {bankNiftyChg.text}
            </span>
          </div>

          {/* FIN NIFTY */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-slate-800 group cursor-pointer">
            <span className="font-bold text-slate-400 text-[11px] group-hover:text-white transition-colors">FIN NIFTY</span>
            <span className="font-bold text-white num-font">{formatLtp(finNiftyTick, 23890.40)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${finNiftyChg.isPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {finNiftyChg.text}
            </span>
          </div>

          {/* INDIA VIX */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-slate-800">
            <span className="font-bold text-slate-400 text-[11px]">INDIA VIX</span>
            <span className="font-bold text-amber-400 num-font">14.12</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1 rounded">-1.84%</span>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAV TABS & TERMINAL WORKSPACE TOGGLE */}
      <div className="px-4 lg:px-6 py-2 flex items-center justify-between overflow-x-auto scrollbar-none bg-slate-900/60">
        <div className="flex items-center gap-1.5 flex-shrink-0 font-headline">
          {navItems.map(item => {
            const isActive = activeView === item.id && !isTerminalMode;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className={`text-[10px] font-mono opacity-60 px-1 rounded ${isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TERMINAL WORKSPACE MODE TOGGLE */}
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
            isTerminalMode
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30 font-black'
              : 'bg-slate-850 border-slate-750 text-slate-300 hover:text-white hover:border-emerald-500/50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Pro Terminal Workspace</span>
          {isTerminalMode && (
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
          )}
        </button>
      </div>

    </div>
  );
};
