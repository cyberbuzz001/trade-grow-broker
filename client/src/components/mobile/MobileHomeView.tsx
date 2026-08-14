import React from 'react';
import { Search, ArrowUpRight, ArrowDownRight, Zap, Sun, Moon, Sparkles, TrendingUp, Layers, Award, Shield, FileText, SlidersHorizontal } from 'lucide-react';
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
  const getFinNifty = () => ticks?.get('NSE_FINNIFTY') || ticks?.get('FINNIFTY');

  const formatLtp = (tick?: MarketTick, fallback: number = 0) => {
    const val = tick ? tick.ltp : fallback;
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totalValue = wallet ? wallet.cashBalance : 0;

  const watchlistItems = [
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', code: 'RELIANCE', price: 3014.20, changePct: 2.32, isGain: true, logo: 'RE', volume: '4.5M' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', code: 'TCS', price: 4210.50, changePct: 2.24, isGain: true, logo: 'TC', volume: '1.8M' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', code: 'INFY', price: 1890.30, changePct: -0.65, isGain: false, logo: 'IN', volume: '3.2M' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', code: 'HDFCBANK', price: 1642.80, changePct: 0.88, isGain: true, logo: 'HD', volume: '5.1M' },
    { symbol: 'NSE_TATAMOTORS', name: 'Tata Motors', code: 'TATAMOTORS', price: 1015.75, changePct: 3.40, isGain: true, logo: 'TM', volume: '8.2M' },
  ];

  return (
    <div className="pb-28 pt-3 px-3.5 space-y-4 font-body bg-slate-950 min-h-screen text-slate-100 touch-action-manipulation overscroll-y-contain">
      
      {/* 1. TOP BROKER MOBILE HEADER BAR */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm border border-emerald-400/40 shadow-md">
              {(user.username || 'T').charAt(0).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950"></span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm text-white tracking-tight leading-none">
                Trade<span className="text-emerald-400">Grow</span>
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase font-mono">
                PRO
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono font-bold leading-tight block mt-0.5">
              Dhan HQ Live Tick Stream
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleTheme && (
            <button
              type="button"
              onClick={() => {
                navigator.vibrate?.(20);
                onToggleTheme();
              }}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-indigo-400" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(20);
              onOpenSearch();
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 flex items-center justify-center transition-all shadow-sm cursor-pointer active:scale-95"
            title="Search Symbol (Cmd+K)"
          >
            <Search className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME MARGIN & CAPITAL CARD (Kite/Groww Style) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden shadow-lg backdrop-blur-xl group">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none"></div>
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider font-mono">Available Trading Margin</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold font-mono">
              ₹0 BROKERAGE
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <h2 className="font-mono text-3xl font-black tracking-tight tabular-nums text-white">
              ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-400 pt-2 border-t border-slate-800 font-mono">
            <span className="text-emerald-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> 5.0x Intraday Leverage (MIS)
            </span>
            <span className="text-slate-300">Ready</span>
          </div>
        </div>

        {/* Sparkline Graphic */}
        <div className="mt-2 h-8 w-full relative opacity-90">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 30">
            <defs>
              <linearGradient id="mobileChartGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22C55E" stopOpacity="0.4"></stop>
                <stop offset="100%" stopColor="#22C55E" stopOpacity="0"></stop>
              </linearGradient>
            </defs>
            <path d="M0 30 L0 15 Q 10 10, 20 20 T 40 10 T 60 15 T 80 5 T 100 10 L100 30 Z" fill="url(#mobileChartGradient)"></path>
            <path d="M0 15 Q 10 10, 20 20 T 40 10 T 60 15 T 80 5 T 100 10" fill="none" stroke="#22C55E" strokeWidth="2"></path>
          </svg>
        </div>
      </div>

      {/* 3. LIVE MARKET INDEX CHIPS (Kite / Groww Mobile Ticker Bar) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Market Indices</span>
          <span className="text-[10px] font-mono text-emerald-400">REAL-TIME TIX</span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
          {/* NIFTY 50 CHIP */}
          <div className="bg-slate-900/90 rounded-xl p-3 min-w-[135px] flex-shrink-0 border border-slate-800 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-white">NIFTY 50</span>
              <span className="text-emerald-400 font-mono text-[10px] font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">+0.42%</span>
            </div>
            <div className="font-mono text-sm font-black tabular-nums text-white">
              {formatLtp(getNifty(), 24856.15)}
            </div>
            {/* Range bar */}
            <div className="w-full bg-slate-950 rounded-full h-1 mt-2 overflow-hidden">
              <div className="bg-emerald-400 h-full w-[65%]"></div>
            </div>
          </div>

          {/* SENSEX CHIP */}
          <div className="bg-slate-900/90 rounded-xl p-3 min-w-[135px] flex-shrink-0 border border-slate-800 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-white">SENSEX</span>
              <span className="text-emerald-400 font-mono text-[10px] font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">+0.38%</span>
            </div>
            <div className="font-mono text-sm font-black tabular-nums text-white">
              {formatLtp(getSensex(), 81254.30)}
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1 mt-2 overflow-hidden">
              <div className="bg-emerald-400 h-full w-[58%]"></div>
            </div>
          </div>

          {/* BANK NIFTY CHIP */}
          <div className="bg-slate-900/90 rounded-xl p-3 min-w-[135px] flex-shrink-0 border border-slate-800 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-white">BANK NIFTY</span>
              <span className="text-rose-400 font-mono text-[10px] font-bold bg-rose-500/10 px-1.5 py-0.2 rounded">-0.15%</span>
            </div>
            <div className="font-mono text-sm font-black tabular-nums text-white">
              {formatLtp(getBankNifty(), 52150.75)}
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1 mt-2 overflow-hidden">
              <div className="bg-rose-400 h-full w-[42%]"></div>
            </div>
          </div>

          {/* FIN NIFTY CHIP */}
          <div className="bg-slate-900/90 rounded-xl p-3 min-w-[135px] flex-shrink-0 border border-slate-800 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-white">FIN NIFTY</span>
              <span className="text-emerald-400 font-mono text-[10px] font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">+0.22%</span>
            </div>
            <div className="font-mono text-sm font-black tabular-nums text-white">
              {formatLtp(getFinNifty(), 23890.40)}
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1 mt-2 overflow-hidden">
              <div className="bg-emerald-400 h-full w-[50%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. TOP BROKER QUICK ACTION GRID (Groww / Kite Shortcuts) */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono block mb-2">Shortcuts & Tools</span>
        <div className="grid grid-cols-3 gap-2">
          <div 
            onClick={() => {
              navigator.vibrate?.(20);
              onSelectStock('NIFTY 24850 CE', 'Nifty Option Chain', 125.0);
            }}
            className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-emerald-500/50 transition-all min-h-[64px] active:scale-95"
          >
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-white text-center leading-tight">Option Chain</span>
          </div>

          <div 
            onClick={() => {
              navigator.vibrate?.(20);
              onSelectStock('MARKET_SCANNER', 'Market Scanner', 0);
            }}
            className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-emerald-500/50 transition-all min-h-[64px] active:scale-95"
          >
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-white text-center leading-tight">AI Screener</span>
          </div>

          <div 
            onClick={() => {
              navigator.vibrate?.(20);
              onSelectStock('RELIANCE', 'Reliance Industries', 3014.20);
            }}
            className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-emerald-500/50 transition-all min-h-[64px] active:scale-95"
          >
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-white text-center leading-tight">IPO (8 Open)</span>
          </div>
        </div>
      </div>

      {/* 5. WATCHLIST & CONTRACTS (With 1-Tap Touch BUY/SELL Buttons) */}
      <div>
        <div className="flex justify-between items-center mb-2.5">
          <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Watchlist Contracts
          </h3>
          <button 
            type="button"
            className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer min-h-[44px] flex items-center" 
            onClick={() => {
              navigator.vibrate?.(20);
              onOpenSearch();
            }}
          >
            + Track Stock
          </button>
        </div>

        <div className="space-y-2">
          {watchlistItems.map((item) => {
            const tick = ticks?.get(item.symbol);
            const price = tick ? tick.ltp : item.price;
            const changePct = tick ? tick.changePercent : item.changePct;
            const isGain = changePct >= 0;

            return (
              <div
                key={item.symbol}
                className="bg-slate-900/90 rounded-2xl p-3.5 flex items-center justify-between border border-slate-800 hover:border-slate-700 transition-all backdrop-blur-xl"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1 min-h-[44px]"
                  onClick={() => {
                    navigator.vibrate?.(20);
                    onSelectStock(item.code, item.name, price);
                  }}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-black flex items-center justify-center text-xs">
                    {item.logo}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">{item.code}</h4>
                    <p className="text-[10px] text-slate-400">{item.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Price Info */}
                  <div className="text-right num-font tabular-nums">
                    <p className="font-bold text-xs text-white">₹{price.toFixed(2)}</p>
                    <p className={`text-[10px] font-bold flex items-center justify-end ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {isGain ? '+' : ''}{changePct.toFixed(2)}%
                    </p>
                  </div>

                  {/* Direct Touch BUY & SELL Buttons (Min 44x44px touch target) */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.vibrate?.(30);
                        onOpenQuickOrder?.({ name: item.name, symbol: item.code, price, side: 'BUY' });
                      }}
                      className="min-h-[44px] min-w-[52px] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-2.5 py-2 rounded-xl shadow-md active:scale-95 transition-transform cursor-pointer"
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.vibrate?.(30);
                        onOpenQuickOrder?.({ name: item.name, symbol: item.code, price, side: 'SELL' });
                      }}
                      className="min-h-[44px] min-w-[52px] bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-2.5 py-2 rounded-xl shadow-md active:scale-95 transition-transform cursor-pointer"
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
