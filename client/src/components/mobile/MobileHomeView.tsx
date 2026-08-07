import React from 'react';
import { Search, Bell, ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { MarketTick, User } from '../../types';

interface MobileHomeViewProps {
  user: User;
  ticks?: Map<string, MarketTick>;
  onSelectStock: (symbol: string, name: string, price: number) => void;
  onOpenSearch: () => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  user,
  ticks,
  onSelectStock,
  onOpenSearch,
}) => {
  const portfolioCards = [
    { symbol: 'NSE_RBLBANK', name: 'RBL Bank', code: 'RBL', value: '$131,46', change: '-2.02%', isPos: false, logo: '🔴' },
    { symbol: 'NSE_AIRTEL', name: 'Airtel Bharti', code: 'Airtel', value: '$326,423', change: '-2.87%', isPos: false, logo: '🔴' },
    { symbol: 'NSE_KOTAK', name: 'Kotak Bank', code: 'Kotak', value: '$326,23', change: '+2.87%', isPos: true, logo: '🔴' },
  ];

  const watchlistItems = [
    { symbol: 'NSE_AMBUJA', name: 'Ambuja Cement', code: 'Ambuja', price: 2196.05, changePct: 10.03, isGain: true, logo: '🏭' },
    { symbol: 'NSE_KOTAKBANK', name: 'Kotak Mahindra', code: 'Kotak Bank', price: 326.23, changePct: 2.87, isGain: true, logo: '🏦' },
    { symbol: 'NSE_AIRTEL', name: 'Airtel Bharti', code: 'Airtel', price: 127.00, changePct: 10.03, isGain: true, logo: '📡' },
    { symbol: 'NSE_ICICIBANK', name: 'ICICI Bank', code: 'ICICI', price: 326.23, changePct: 2.87, isGain: true, logo: '🏦' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', code: 'HDFC Inc.', price: 252.12, changePct: 10.03, isGain: true, logo: '🏦' },
  ];

  return (
    <div className="pb-24 pt-4 px-5 space-y-6">
      
      {/* 1. TOP HEADER GREETING (MATCHING 07_PREVIEW7.PNG) */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-400">Hello {user.username || 'User'}</div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome to GoGrow
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSearch}
            className="p-2.5 rounded-full bg-[var(--bg-surface-elevated)] text-slate-600 dark:text-slate-300 hover:text-[var(--gogrow-blue)]"
          >
            <Search className="w-5 h-5" />
          </button>
          <div className="relative p-2.5 rounded-full bg-[var(--bg-surface-elevated)] text-slate-600 dark:text-slate-300">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
          </div>
        </div>
      </div>

      {/* 2. HERO BLUE GRADIENT CARD (MATCHING 07_PREVIEW7.PNG) */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 text-white shadow-xl shadow-blue-500/25 relative overflow-hidden">
        
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">Stock Gains</span>
          <button className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md transition-colors">
            <span>This Week</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-3xl font-black num-font tracking-tight mb-4">
          $24,320+
        </div>

        {/* Smooth White Wave Graph Line SVG */}
        <div className="w-full h-16 opacity-90 mt-2">
          <svg className="w-full h-full" viewBox="0 0 300 60">
            <path
              d="M 0 45 Q 40 10 80 35 T 160 20 T 240 40 T 300 15 L 300 60 L 0 60 Z"
              fill="rgba(255, 255, 255, 0.25)"
            />
            <path
              d="M 0 45 Q 40 10 80 35 T 160 20 T 240 40 T 300 15"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
            />
          </svg>
        </div>
      </div>

      {/* 3. PORTFOLIO CAROUSEL SECTION (MATCHING 07_PREVIEW7.PNG) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Portfolio</h3>
          <button className="text-xs font-extrabold text-[var(--gogrow-blue)] hover:underline">
            View all
          </button>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
          {portfolioCards.map((card, i) => (
            <div
              key={i}
              className="min-w-[170px] bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xs space-y-2 flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 font-black flex items-center justify-center text-sm">
                  {card.logo}
                </div>
                <div>
                  <div className="font-black text-xs text-[var(--text-main)] truncate">{card.name}</div>
                  <div className="text-[10px] text-slate-400 font-bold">{card.code}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-light)]">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Portfolio</div>
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-[var(--text-main)] num-font">{card.value}</span>
                  <span className={`text-[10px] font-extrabold flex items-center gap-0.5 ${card.isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {card.isPos ? '▲' : '▼'} {card.change}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. WATCHLIST SECTION (MATCHING 07_PREVIEW7.PNG) */}
      <div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">Watchlist</h3>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl divide-y divide-[var(--border-light)] shadow-xs">
          {watchlistItems.map((item, i) => {
            const liveTick = ticks?.get(item.symbol);
            const price = liveTick ? liveTick.ltp : item.price;

            return (
              <div
                key={i}
                onClick={() => onSelectStock(item.symbol, item.name, price)}
                className="p-4 flex items-center justify-between hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center text-lg">
                    {item.logo}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-[var(--text-main)]">{item.name}</h4>
                    <p className="text-xs text-slate-400 font-bold">{item.code}</p>
                  </div>
                </div>

                {/* Mini Sparkline Chart SVG */}
                <div className="w-16 h-5">
                  <svg className="w-full h-full" viewBox="0 0 60 20">
                    <path
                      d="M 0 15 L 15 10 L 30 18 L 45 5 L 60 8"
                      fill="none"
                      stroke="#00d09c"
                      strokeWidth="2"
                    />
                  </svg>
                </div>

                {/* Price & Change */}
                <div className="text-right num-font">
                  <div className="font-black text-sm text-[var(--text-main)]">
                    ${price.toFixed(2)}
                  </div>
                  <div className="text-xs font-extrabold text-emerald-500 flex items-center justify-end gap-0.5">
                    ▲ {item.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
