import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { MarketTick } from '../types';

export type SubView = 'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'OPTION_CHAIN' | 'ADMIN';

interface GrowwSubNavProps {
  activeView: SubView;
  onSelectView: (view: SubView) => void;
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

  const navItems: { id: SubView; label: string }[] = [
    { id: 'EXPLORE', label: 'Explore' },
    { id: 'HOLDINGS', label: 'Holdings' },
    { id: 'POSITIONS', label: 'Positions' },
    { id: 'ORDERS', label: 'Orders' },
    { id: 'WATCHLIST', label: 'Watchlist' },
    { id: 'OPTION_CHAIN', label: 'Option Chain' },
  ];

  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] transition-colors">
      
      {/* 1. TICKER STRIP */}
      <div className="ticker-wrap font-label text-xs tabular-nums px-4 lg:px-8 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-8 overflow-x-auto scrollbar-none py-2 w-full">
          {/* NIFTY 50 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-semibold text-[var(--text-muted)]">NIFTY 50</span>
            <span className="font-bold text-[var(--text-main)]">{formatLtp(niftyTick, 24856.15)}</span>
            <span className={`flex items-center font-bold ${niftyChg.isPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
              {niftyChg.text}
            </span>
          </div>

          {/* SENSEX */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-[var(--border-color)]">
            <span className="font-semibold text-[var(--text-muted)]">SENSEX</span>
            <span className="font-bold text-[var(--text-main)]">{formatLtp(sensexTick, 81254.30)}</span>
            <span className={`flex items-center font-bold ${sensexChg.isPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
              {sensexChg.text}
            </span>
          </div>

          {/* BANK NIFTY */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-[var(--border-color)]">
            <span className="font-semibold text-[var(--text-muted)]">BANK NIFTY</span>
            <span className="font-bold text-[var(--text-main)]">{formatLtp(bankNiftyTick, 52150.75)}</span>
            <span className={`flex items-center font-bold ${bankNiftyChg.isPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
              {bankNiftyChg.text}
            </span>
          </div>

          {/* FIN NIFTY */}
          <div className="flex items-center gap-2 flex-shrink-0 pl-4 border-l border-[var(--border-color)]">
            <span className="font-semibold text-[var(--text-muted)]">FIN NIFTY</span>
            <span className="font-bold text-[var(--text-main)]">{formatLtp(finNiftyTick, 23890.40)}</span>
            <span className={`flex items-center font-bold ${finNiftyChg.isPos ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
              {finNiftyChg.text}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAV TABS & TERMINAL TOGGLE */}
      <div className="px-4 lg:px-8 py-2.5 flex items-center justify-between overflow-x-auto scrollbar-none bg-[var(--bg-surface)]">
        <div className="flex items-center gap-2 flex-shrink-0 font-headline">
          {navItems.map(item => {
            const isActive = activeView === item.id && !isTerminalMode;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[var(--bg-surface-elevated)] text-[#00E676] border border-[#00E676]/30 shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* TERMINAL MODE TOGGLE */}
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex-shrink-0 ${
            isTerminalMode
              ? 'bg-[#00E676] text-[#0D1117] border-[#00E676] shadow-md shadow-[#00E676]/20 font-black'
              : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[#00E676]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Terminal Mode</span>
        </button>
      </div>

    </div>
  );
};
