import React, { useState } from 'react';
import { SlidersHorizontal, Compass, Briefcase, TrendingUp, Receipt, Bookmark, Layers, ShieldCheck, Activity, User as UserIcon } from 'lucide-react';
import { MarketTick } from '../types';
import { useMarketSocket } from '../hooks/useMarketSocket';
import { IndexActionModal } from './IndexActionModal';

export type SubView = 'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'OPTION_CHAIN' | 'ADMIN' | 'ANALYTICS' | 'PROFILE';

interface GrowwSubNavProps {
  activeView: SubView;
  onSelectView: (view: SubView) => void;
  isTerminalMode: boolean;
  onToggleTerminal: () => void;
  onSelectIndexChart?: (symbol: string, token: string, exchange: string) => void;
  onSelectIndexOptionChain?: (cleanIndex: string) => void;
  ticks?: Map<string, MarketTick>;
  user?: any;
}

export const GrowwSubNav: React.FC<GrowwSubNavProps> = ({
  activeView,
  onSelectView,
  isTerminalMode,
  onToggleTerminal,
  onSelectIndexChart,
  onSelectIndexOptionChain,
  ticks: ticksProp,
  user,
}) => {
  const [selectedIndexModal, setSelectedIndexModal] = useState<{ symbol: string; token: string; exchange: string } | null>(null);

  // Primary: get ticks from MarketSocketProvider context
  // Fallback: use prop if provided (for compatibility)
  const { ticks: contextTicks } = useMarketSocket();
  const ticks = contextTicks.size > 0 ? contextTicks : (ticksProp ?? new Map<string, MarketTick>());
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

  const isStaff = user && ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER', 'DEALER', 'ANALYST'].includes(user.role);

  const navItems: { id: SubView; label: string; icon: React.ReactNode; shortcut?: string }[] = [
    { id: 'EXPLORE', label: 'Explore', icon: <Compass className="w-3.5 h-3.5" />, shortcut: '1' },
    { id: 'WATCHLIST', label: 'Watchlist', icon: <Bookmark className="w-3.5 h-3.5" />, shortcut: '2' },
    { id: 'POSITIONS', label: 'Positions', icon: <TrendingUp className="w-3.5 h-3.5" />, shortcut: '3' },
    { id: 'ORDERS', label: 'Orders', icon: <Receipt className="w-3.5 h-3.5" />, shortcut: '4' },
    { id: 'OPTION_CHAIN', label: 'Option Chain', icon: <Layers className="w-3.5 h-3.5" />, shortcut: '5' },
    { id: 'HOLDINGS', label: 'Holdings', icon: <Briefcase className="w-3.5 h-3.5" />, shortcut: '6' },
    { id: 'PROFILE' as SubView, label: 'Profile & KYC', icon: <UserIcon className="w-3.5 h-3.5 text-emerald-400" />, shortcut: '7' },
    ...(isStaff ? [{ id: 'ADMIN' as SubView, label: 'Admin Control', icon: <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> }] : []),
  ];

  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] transition-colors">
      
      {/* 1. REAL-TIME TICKER STRIP */}
      <div className="ticker-wrap font-mono text-xs tabular-nums px-4 lg:px-6 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-none py-1.5 w-full">
          
          {/* NIFTY 50 */}
          <div
            onClick={() => setSelectedIndexModal({ symbol: 'NIFTY 50', token: 'NSE_NIFTY50', exchange: 'NSE' })}
            className="flex items-center gap-2 flex-shrink-0 group cursor-pointer hover:bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded-lg transition-all"
            title="Click to view NIFTY 50 Chart / Option Chain"
          >
            <span className="font-bold text-[var(--text-muted)] text-[11px] group-hover:text-emerald-500 transition-colors">NIFTY 50</span>
            <span className="font-bold text-[var(--text-main)] num-font">{formatLtp(niftyTick, 24856.15)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${niftyChg.isPos ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              {niftyChg.text}
            </span>
          </div>

          {/* SENSEX */}
          <div
            onClick={() => setSelectedIndexModal({ symbol: 'SENSEX', token: 'BSE_SENSEX', exchange: 'BSE' })}
            className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-[var(--border-color)] group cursor-pointer hover:bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded-lg transition-all"
            title="Click to view SENSEX Chart / Option Chain"
          >
            <span className="font-bold text-[var(--text-muted)] text-[11px] group-hover:text-emerald-500 transition-colors">SENSEX</span>
            <span className="font-bold text-[var(--text-main)] num-font">{formatLtp(sensexTick, 81254.30)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${sensexChg.isPos ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              {sensexChg.text}
            </span>
          </div>

          {/* BANK NIFTY */}
          <div
            onClick={() => setSelectedIndexModal({ symbol: 'BANKNIFTY', token: 'NSE_BANKNIFTY', exchange: 'NSE' })}
            className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-[var(--border-color)] group cursor-pointer hover:bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded-lg transition-all"
            title="Click to view BANK NIFTY Chart / Option Chain"
          >
            <span className="font-bold text-[var(--text-muted)] text-[11px] group-hover:text-emerald-500 transition-colors">BANK NIFTY</span>
            <span className="font-bold text-[var(--text-main)] num-font">{formatLtp(bankNiftyTick, 52150.75)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${bankNiftyChg.isPos ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              {bankNiftyChg.text}
            </span>
          </div>

          {/* FIN NIFTY */}
          <div
            onClick={() => setSelectedIndexModal({ symbol: 'FINNIFTY', token: 'NSE_FINNIFTY', exchange: 'NSE' })}
            className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-[var(--border-color)] group cursor-pointer hover:bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded-lg transition-all"
            title="Click to view FIN NIFTY Chart / Option Chain"
          >
            <span className="font-bold text-[var(--text-muted)] text-[11px] group-hover:text-emerald-500 transition-colors">FIN NIFTY</span>
            <span className="font-bold text-[var(--text-main)] num-font">{formatLtp(finNiftyTick, 23890.40)}</span>
            <span className={`flex items-center font-extrabold text-[11px] px-1.5 py-0.2 rounded ${finNiftyChg.isPos ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
              {finNiftyChg.text}
            </span>
          </div>

          {/* INDIA VIX */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-[var(--border-color)]">
            <span className="font-bold text-[var(--text-muted)] text-[11px]">INDIA VIX</span>
            <span className="font-bold text-amber-500 num-font">14.12</span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">-1.84%</span>
          </div>
        </div>
      </div>

      {/* Index Action Selection Modal */}
      {selectedIndexModal && (
        <IndexActionModal
          isOpen={Boolean(selectedIndexModal)}
          onClose={() => setSelectedIndexModal(null)}
          indexSymbol={selectedIndexModal.symbol}
          token={selectedIndexModal.token}
          exchange={selectedIndexModal.exchange}
          latestTick={ticks.get(selectedIndexModal.token)}
          onOpenChart={(sym, tok) => {
            onSelectIndexChart?.(sym, tok, selectedIndexModal.exchange);
          }}
          onOpenOptionChain={(cleanIndex) => {
            onSelectIndexOptionChain?.(cleanIndex);
          }}
        />
      )}

      {/* 2. SUB-NAV TABS & TERMINAL WORKSPACE TOGGLE */}
      <div className="px-4 lg:px-6 py-2 flex items-center justify-between overflow-x-auto scrollbar-none bg-[var(--bg-surface)]">
        <div className="flex items-center gap-1.5 flex-shrink-0 font-headline">
          {navItems.map(item => {
            const isActive = activeView === item.id && !isTerminalMode;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className={`text-[10px] font-mono opacity-60 px-1 rounded ${isActive ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'}`}>
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
              ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/30 font-black'
              : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-main)] hover:border-emerald-500/50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Pro Terminal Workspace</span>
          {isTerminalMode && (
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          )}
        </button>
      </div>

    </div>

  );
};
