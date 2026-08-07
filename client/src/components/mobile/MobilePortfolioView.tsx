import React from 'react';
import { ArrowUp, ArrowDown, Bell, ChevronLeft } from 'lucide-react';
import { MarketTick } from '../../types';

interface MobilePortfolioViewProps {
  ticks?: Map<string, MarketTick>;
  onBack: () => void;
  onSelectStock: (symbol: string, name: string, price: number) => void;
}

export const MobilePortfolioView: React.FC<MobilePortfolioViewProps> = ({
  ticks,
  onBack,
  onSelectStock,
}) => {
  const bars = [
    { label: 'IND', val: 24 },
    { label: 'AUS', val: 20 },
    { label: 'USA', val: 27 },
    { label: 'DEU', val: 56 },
    { label: 'ITA', val: 30 },
    { label: 'UK', val: 41 },
  ];

  return (
    <div className="pb-24 pt-4 px-5 space-y-6">
      
      {/* 1. TOP HEADER (MATCHING 08_PREVIEW8.PNG) */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-slate-600 dark:text-slate-300"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Portfolio
        </h2>

        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* 2. TOP METRIC BADGE CARDS (MATCHING 08_PREVIEW8.PNG) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Today Gains */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <ArrowUp className="w-6 h-6" />
          </div>
          <div>
            <div className="font-black text-base text-[var(--text-main)] num-font">$2,209</div>
            <div className="text-[11px] font-bold text-slate-400">Today Gains</div>
          </div>
        </div>

        {/* Overall Loss */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
            <ArrowDown className="w-6 h-6" />
          </div>
          <div>
            <div className="font-black text-base text-[var(--text-main)] num-font">$5,440</div>
            <div className="text-[11px] font-bold text-slate-400">Overall Loss</div>
          </div>
        </div>
      </div>

      {/* 3. PORTFOLIO BALANCE & BAR CHART (MATCHING 08_PREVIEW8.PNG) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-3xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">Portfolio Balance</div>
            <div className="text-3xl font-black text-[var(--text-main)] num-font tracking-tight mt-1">
              $97,326.46
            </div>
            <div className="text-xs font-extrabold text-emerald-500 flex items-center gap-1 mt-1">
              ▲ 65.63 (76.23%) <span className="text-slate-400 font-bold">Today</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[var(--bg-surface-elevated)] text-slate-600 dark:text-slate-300">
            <Bell className="w-5 h-5" />
          </div>
        </div>

        {/* Bar Chart Visualization */}
        <div className="pt-4 border-t border-[var(--border-light)]">
          <div className="h-44 flex items-end justify-between gap-3 px-2">
            {bars.map(b => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-blue-500/10 rounded-t-xl overflow-hidden flex items-end h-32">
                  <div
                    className="w-full bg-[var(--gogrow-blue)] rounded-t-xl transition-all duration-500"
                    style={{ height: `${(b.val / 70) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. LIST STOCKS (MATCHING 08_PREVIEW8.PNG) */}
      <div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">List Stocks</h3>

        <div
          onClick={() => onSelectStock('NSE_KOTAK', 'Kotak Bank', 326.23)}
          className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xs flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 text-white font-black flex items-center justify-center">
              🔴
            </div>
            <div>
              <h4 className="font-black text-sm text-[var(--text-main)]">Kotak Bank</h4>
              <p className="text-xs text-slate-400 font-bold">Kotak PVL.</p>
            </div>
          </div>

          <div className="w-16 h-5">
            <svg className="w-full h-full" viewBox="0 0 60 20">
              <path d="M 0 15 L 15 8 L 30 14 L 45 4 L 60 10" fill="none" stroke="#00d09c" strokeWidth="2" />
            </svg>
          </div>

          <div className="text-right num-font">
            <div className="font-black text-sm text-[var(--text-main)]">$326.23</div>
            <div className="text-xs font-extrabold text-emerald-500">▲ 2.87%</div>
          </div>
        </div>
      </div>

    </div>
  );
};
