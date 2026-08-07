import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowUpRight, ArrowDownRight, Layers, Award, Landmark, TrendingUp, ChevronDown } from 'lucide-react';
import { MarketTick } from '../types';

interface GrowwExploreViewProps {
  ticks?: Map<string, MarketTick>;
  onSelectSymbol?: (symbol: string) => void;
}

export const GrowwExploreView: React.FC<GrowwExploreViewProps> = ({ ticks, onSelectSymbol }) => {
  const [moverTab, setMoverTab] = useState<'GAINERS' | 'LOSERS' | 'VOLUME'>('GAINERS');
  const [serverMovers, setServerMovers] = useState<{ gainers: any[]; losers: any[]; volumeShockers: any[] }>({
    gainers: [],
    losers: [],
    volumeShockers: [],
  });

  useEffect(() => {
    fetch('/api/v1/market/top-movers')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setServerMovers({
            gainers: data.gainers || [],
            losers: data.losers || [],
            volumeShockers: data.volumeShockers || [],
          });
        }
      })
      .catch(() => {});
  }, []);

  const mostBought = [
    { symbol: 'NSE_CUPID', name: 'Cupid', price: 262.16, change: 10.05, changePct: 3.99, isGain: true, logo: '🔴' },
    { symbol: 'NSE_MVELEC', name: 'MV Electrosystems', price: 568.05, change: 143.05, changePct: 33.66, isGain: true, logo: '🏭' },
    { symbol: 'NSE_ASKAUTO', name: 'ASK Automotive', price: 669.00, change: 31.45, changePct: 4.93, isGain: true, logo: '🅰️' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', price: 733.90, change: -1.10, changePct: -0.15, isGain: false, logo: '🏦' },
  ];

  const defaultMovers = [
    { symbol: 'NSE_HAL', name: 'Hindustan Aeronaut.', price: 4886.70, change: 241.70, changePct: 5.20, volume: 2818585, sparkline: [4600, 4650, 4720, 4700, 4820, 4886.7], logo: '✈️' },
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePct: 2.32, volume: 4521102, sparkline: [2940, 2960, 2980, 2975, 3000, 3014.2], logo: '🔵' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePct: 2.24, volume: 1840920, sparkline: [4110, 4130, 4150, 4190, 4210.5], logo: '🟦' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePct: -0.65, volume: 3210400, sparkline: [1910, 1905, 1898, 1892, 1890.3], logo: '🔹' },
  ];

  const activeMoversList = moverTab === 'GAINERS'
    ? (serverMovers.gainers.length > 0 ? serverMovers.gainers : defaultMovers)
    : moverTab === 'LOSERS'
    ? (serverMovers.losers.length > 0 ? serverMovers.losers : defaultMovers)
    : (serverMovers.volumeShockers.length > 0 ? serverMovers.volumeShockers : defaultMovers);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
      
      {/* LEFT COLUMN: MAIN EXPLORE CONTENT */}
      <div className="lg:col-span-8 space-y-8">
        
        {/* 1. MOST BOUGHT STOCKS ON GROWW */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-[var(--text-main)]">
              Most bought stocks on Groww
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {mostBought.map(stock => {
              const liveTick = ticks?.get(stock.symbol);
              const price = liveTick ? liveTick.ltp : stock.price;
              const change = liveTick ? liveTick.change : stock.change;
              const changePct = liveTick ? liveTick.changePercent : stock.changePct;
              const isGain = change >= 0;

              return (
                <div
                  key={stock.symbol}
                  onClick={() => onSelectSymbol && onSelectSymbol(stock.name)}
                  className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xs hover:shadow-md hover:border-teal-500 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                    {stock.logo}
                  </div>
                  <h4 className="font-extrabold text-sm text-[var(--text-main)] truncate mb-3">
                    {stock.name}
                  </h4>
                  <div className="num-font font-black text-sm text-[var(--text-main)]">
                    ₹{price.toFixed(2)}
                  </div>
                  <div className={`num-font font-extrabold text-xs flex items-center gap-0.5 mt-1 ${isGain ? 'text-[var(--groww-green)]' : 'text-rose-500'}`}>
                    {isGain ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[var(--groww-green)] hover:underline">
            <span>See more</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 2. TOP MOVERS TODAY */}
        <div>
          <h3 className="text-xl font-black text-[var(--text-main)] mb-4">
            Top movers today
          </h3>

          {/* Filter Pills Bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              onClick={() => setMoverTab('GAINERS')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                moverTab === 'GAINERS'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-slate-700 dark:text-slate-200 hover:text-slate-900 font-extrabold'
              }`}
            >
              Gainers
            </button>

            <button
              onClick={() => setMoverTab('LOSERS')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                moverTab === 'LOSERS'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-slate-700 dark:text-slate-200 hover:text-slate-900 font-extrabold'
              }`}
            >
              Losers
            </button>

            <button
              onClick={() => setMoverTab('VOLUME')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                moverTab === 'VOLUME'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-slate-700 dark:text-slate-200 hover:text-slate-900 font-extrabold'
              }`}
            >
              Volume shockers
            </button>

            {/* Dropdown Filter */}
            <div className="ml-auto">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs font-extrabold text-slate-800 dark:text-slate-200">
                <span>NIFTY 100</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Movers Table */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-light)] bg-[var(--bg-surface-elevated)] text-slate-700 dark:text-slate-300 uppercase text-[10px] font-black">
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4 text-center">Trend (1D)</th>
                  <th className="py-3 px-4 text-right">Market price (1D)</th>
                  <th className="py-3 px-4 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)] num-font">
                {activeMoversList.map(m => {
                  const liveTick = ticks?.get(m.internalToken || m.symbol);
                  const price = liveTick ? liveTick.ltp : m.price;
                  const change = liveTick ? liveTick.change : (m.change || 0);
                  const changePct = liveTick ? liveTick.changePercent : (m.changePercent || 0);
                  const volume = liveTick ? liveTick.volume : m.volume;
                  const isGain = change >= 0;

                  return (
                    <tr
                      key={m.symbol}
                      onClick={() => onSelectSymbol && onSelectSymbol(m.name)}
                      className="hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-extrabold flex items-center justify-center text-xs">
                          {m.logo || m.name.charAt(0)}
                        </div>
                        <span className="font-extrabold text-sm text-[var(--text-main)]">{m.name}</span>
                      </td>

                      {/* Mini Sparkline SVG */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="w-24 h-6 mx-auto flex items-center justify-center">
                          <svg className="w-full h-full" viewBox="0 0 100 30">
                            <path
                              d={isGain ? "M 0 25 L 20 20 L 40 22 L 60 10 L 80 12 L 100 5" : "M 0 5 L 20 12 L 40 10 L 60 22 L 80 20 L 100 25"}
                              fill="none"
                              stroke={isGain ? '#00d09c' : '#eb5757'}
                              strokeWidth="2"
                            />
                          </svg>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black">
                        <div className="text-sm text-[var(--text-main)]">₹{price.toFixed(2)}</div>
                        <div className={`text-xs font-bold ${isGain ? 'text-[var(--groww-green)]' : 'text-rose-500'}`}>
                          {isGain ? '+' : ''}{change.toFixed(2)} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-500 dark:text-slate-400 font-extrabold">
                        {typeof volume === 'number' ? volume.toLocaleString('en-IN') : volume}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: INVESTMENTS & PRODUCTS */}
      <div className="lg:col-span-4 space-y-8">
        
        {/* 1. YOUR INVESTMENTS CARD (IMAGE 1) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xs">
          <h4 className="font-extrabold text-base text-[var(--text-main)] mb-6">
            Your investments
          </h4>

          {/* Empty State Illustration */}
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-32 h-24 mb-4 opacity-85">
              <svg viewBox="0 0 160 120" className="w-full h-full">
                <rect x="20" y="30" width="120" height="70" rx="12" fill="#e6fbf5"/>
                <circle cx="60" cy="55" r="8" fill="#00d09c"/>
                <path d="M50 80 Q 65 60 80 80 Q 95 65 110 85" fill="none" stroke="#00b887" strokeWidth="3"/>
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              You haven't invested yet
            </p>
          </div>
        </div>

        {/* 2. PRODUCTS & TOOLS CARD (IMAGE 1) */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xs">
          <h4 className="font-extrabold text-base text-[var(--text-main)] mb-4">
            Products & Tools
          </h4>

          <div className="space-y-4">
            {/* IPO */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-[var(--groww-green)] flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <span className="font-extrabold text-sm text-[var(--text-main)]">IPO</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[var(--groww-green)] text-xs font-black">
                8 open
              </span>
            </div>

            {/* Bonds */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="font-extrabold text-sm text-[var(--text-main)]">Bonds</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[var(--groww-green)] text-xs font-black">
                7 open
              </span>
            </div>

            {/* ETFs */}
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="font-extrabold text-sm text-[var(--text-main)]">ETFs</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
