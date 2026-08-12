import React from 'react';
import { Search, ArrowUpRight, ArrowDownRight, Zap, Sun, Moon } from 'lucide-react';
import { MarketTick, User, Wallet } from '../../types';

interface MobileHomeViewProps {
  user: User;
  wallet?: Wallet | null;
  ticks?: Map<string, MarketTick>;
  onSelectStock: (symbol: string, name: string, price: number) => void;
  onOpenSearch: () => void;
  onOpenQuickOrder?: (stock: { name: string; symbol: string; price: number; side?: 'BUY' | 'SELL' }) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  user,
  wallet,
  ticks,
  onSelectStock,
  onOpenSearch,
  onOpenQuickOrder,
  theme = 'dark',
  onToggleTheme,
}) => {
  const getNifty = () => ticks?.get('NSE_NIFTY50') || ticks?.get('NIFTY50');
  const getSensex = () => ticks?.get('BSE_SENSEX') || ticks?.get('SENSEX');
  const getBankNifty = () => ticks?.get('NSE_BANKNIFTY') || ticks?.get('BANKNIFTY');

  const formatLtp = (tick?: MarketTick, fallback: number = 0) => {
    const val = tick ? tick.ltp : fallback;
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Real-time calculation from active wallet
  const totalValue = wallet ? wallet.cashBalance : 0;
  const isWalletActive = !!wallet;

  const watchlistItems = [
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', code: 'RELIANCE', price: 2456.30, changePct: 1.90, isGain: true, logo: '🔵' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', code: 'TCS', price: 4125.80, changePct: 1.20, isGain: true, logo: '🟦' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', code: 'INFY', price: 1845.60, changePct: 2.80, isGain: true, logo: '🔹' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', code: 'HDFCBANK', price: 1670.25, changePct: -0.50, isGain: false, logo: '🏦' },
    { symbol: 'NSE_TATAMOTORS', name: 'Tata Motors', code: 'TATAMOTORS', price: 985.40, changePct: 3.20, isGain: true, logo: '🚗' },
  ];

  return (
    <div className="pb-28 pt-4 px-4 space-y-5 font-body bg-[var(--bg-body)] min-h-screen text-[var(--text-main)] touch-action-manipulation">
      
      {/* 1. TOP HEADER & GREETING */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-xl sm:text-2xl font-black tracking-tight text-[var(--text-main)] mb-0.5">
            Good afternoon, {user.username || 'Trader'} 👋
          </h1>
          <div className="flex items-center text-[#00E676] text-xs font-bold font-label">
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
            <span>Live Wallet Connected</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[#00E676] transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
          )}

          <button
            onClick={onOpenSearch}
            className="p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[#00E676] transition-colors shadow-sm"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. REAL WALLET PORTFOLIO SUMMARY CARD */}
      <div className="glass-card rounded-2xl p-5 relative overflow-hidden group shadow-lg border border-[var(--border-color)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E676]/20 to-[#448AFF]/20 opacity-20"></div>
        <div className="relative z-10">
          <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider mb-1 font-headline">Total Available Balance</p>
          <h2 className="font-label text-3xl font-black tracking-tight tabular-nums text-[var(--text-main)] mb-2">
            ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="flex items-center gap-2">
            <span className="bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 px-2 py-0.5 rounded-lg font-label text-xs font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Real-time Live Feed
            </span>
          </div>
        </div>

        {/* Sparkline Visual */}
        <div className="mt-3 h-12 w-full relative">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 30">
            <defs>
              <linearGradient id="mobileChartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#00E676" stopOpacity="0.4"></stop>
                <stop offset="100%" stopColor="#00E676" stopOpacity="0"></stop>
              </linearGradient>
            </defs>
            <path d="M0 30 L0 15 Q 10 10, 20 20 T 40 10 T 60 15 T 80 5 T 100 10 L100 30 Z" fill="url(#mobileChartGradient)"></path>
            <path d="M0 15 Q 10 10, 20 20 T 40 10 T 60 15 T 80 5 T 100 10" fill="none" stroke="#00E676" strokeWidth="2"></path>
          </svg>
        </div>
      </div>

      {/* 3. LIVE MARKET INDICES STRIP */}
      <div>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
          {/* NIFTY 50 */}
          <div className="glass-card rounded-xl p-3 min-w-[130px] flex-shrink-0 border border-[var(--border-color)]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-headline text-[10px] font-bold text-[var(--text-muted)]">NIFTY 50</span>
              <span className="text-[#00E676] font-label text-[10px] font-bold">+0.42%</span>
            </div>
            <div className="font-label text-sm font-bold tabular-nums text-[var(--text-main)]">
              {formatLtp(getNifty(), 24856.15)}
            </div>
          </div>

          {/* SENSEX */}
          <div className="glass-card rounded-xl p-3 min-w-[130px] flex-shrink-0 border border-[var(--border-color)]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-headline text-[10px] font-bold text-[var(--text-muted)]">SENSEX</span>
              <span className="text-[#00E676] font-label text-[10px] font-bold">+0.38%</span>
            </div>
            <div className="font-label text-sm font-bold tabular-nums text-[var(--text-main)]">
              {formatLtp(getSensex(), 78088.00)}
            </div>
          </div>

          {/* BANK NIFTY */}
          <div className="glass-card rounded-xl p-3 min-w-[130px] flex-shrink-0 border border-[var(--border-color)]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-headline text-[10px] font-bold text-[var(--text-muted)]">BANK NIFTY</span>
              <span className="text-[#FF5252] font-label text-[10px] font-bold">-0.15%</span>
            </div>
            <div className="font-label text-sm font-bold tabular-nums text-[var(--text-main)]">
              {formatLtp(getBankNifty(), 52340.50)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MOBILE WATCHLIST WITH DIRECT BUY / SELL BUTTONS */}
      <div>
        <div className="flex justify-between items-center mb-2.5">
          <h3 className="font-headline text-base font-bold text-[var(--text-main)]">Watchlist & Orders</h3>
          <span className="text-xs text-[#00E676] font-bold cursor-pointer" onClick={onOpenSearch}>
            + Add Stock
          </span>
        </div>

        <div className="space-y-2.5">
          {watchlistItems.map((item) => {
            const tick = ticks?.get(item.symbol);
            const price = tick ? tick.ltp : item.price;
            const changePct = tick ? tick.changePercent : item.changePct;
            const isGain = changePct >= 0;

            return (
              <div
                key={item.symbol}
                className="glass-card rounded-xl p-3 flex items-center justify-between border border-[var(--border-color)] hover:border-[#00E676] transition-all"
              >
                <div
                  className="flex items-center gap-2.5 cursor-pointer flex-1"
                  onClick={() => onSelectStock(item.code, item.name, price)}
                >
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-base">
                    {item.logo}
                  </div>
                  <div>
                    <h4 className="font-headline text-xs font-bold text-[var(--text-main)]">{item.code}</h4>
                    <p className="text-[10px] text-[var(--text-muted)]">{item.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Price Info */}
                  <div className="text-right font-label tabular-nums">
                    <p className="font-bold text-xs text-[var(--text-main)]">₹{price.toFixed(2)}</p>
                    <p className={`text-[10px] font-bold flex items-center justify-end ${isGain ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                      {isGain ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                      {isGain ? '+' : ''}{changePct.toFixed(2)}%
                    </p>
                  </div>

                  {/* Direct Buy & Sell Buttons for Mobile */}
                  <div className="flex items-center gap-1 pl-2 border-l border-[var(--border-color)]">
                    <button
                      onClick={() => onOpenQuickOrder?.({ name: item.name, symbol: item.code, price, side: 'BUY' })}
                      className="bg-[#00E676] text-[#0D1117] hover:bg-[#00C853] font-headline font-black text-[10px] px-2 py-1.5 rounded-lg shadow-xs active:scale-95 transition-all"
                    >
                      BUY
                    </button>
                    <button
                      onClick={() => onOpenQuickOrder?.({ name: item.name, symbol: item.code, price, side: 'SELL' })}
                      className="bg-[#FF5252] text-white hover:bg-rose-600 font-headline font-black text-[10px] px-2 py-1.5 rounded-lg shadow-xs active:scale-95 transition-all"
                    >
                      SELL
                    </button>
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
