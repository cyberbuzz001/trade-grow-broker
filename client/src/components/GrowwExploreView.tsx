import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowUpRight, ArrowDownRight, Layers, Award, Landmark, TrendingUp, ChevronDown, Activity, Sparkles, Shield, Cpu, Zap } from 'lucide-react';
import { MarketTick, Wallet, Position } from '../types';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';

interface GrowwExploreViewProps {
  ticks?: Map<string, MarketTick>;
  token?: string | null;
  wallet?: Wallet | null;
  onRefreshWallet?: () => void;
  onSelectSymbol?: (symbol: string) => void;
  onOpenProfile?: (tab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'PERMISSIONS' | 'SECURITY' | 'SUPPORT') => void;
}

export const GrowwExploreView: React.FC<GrowwExploreViewProps> = ({ 
  ticks: propsTicks, 
  token,
  wallet,
  onRefreshWallet,
  onSelectSymbol,
  onOpenProfile,
}) => {
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());
  const [moverTab, setMoverTab] = useState<'GAINERS' | 'LOSERS' | 'VOLUME'>('GAINERS');
  const [serverMovers, setServerMovers] = useState<{ gainers: any[]; losers: any[]; volumeShockers: any[] }>({
    gainers: [],
    losers: [],
    volumeShockers: [],
  });
  const [positions, setPositions] = useState<Position[]>([]);

  const exploreTokens = [
    'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK',
    'NSE_SBIN', 'NSE_BHARTIARTL', 'NSE_TATAMOTORS', 'NSE_TATASTEEL', 'NSE_HAL',
    'NSE_MARUTI', 'NSE_BAJFINANCE', 'NSE_SUNPHARMA', 'NSE_ITC', 'NSE_HINDUNILVR',
    'NSE_NTPC', 'NSE_POWERGRID', 'NSE_M&M', 'NSE_TITAN', 'NSE_ULTRACEMCO',
    'NSE_ADANIENT', 'NSE_ADANIPORTS', 'NSE_LT', 'NSE_AXISBANK'
  ];
  useSubscribeTokens(exploreTokens);

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

  useEffect(() => {
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    fetch('/api/v1/portfolio/positions?todayOnly=true', {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.positions)) {
          setPositions(data.positions);
        }
      })
      .catch(() => {});
  }, [token]);

  const mostBought = [
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePct: 2.32, isGain: true, logo: 'RE' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePct: 2.24, isGain: true, logo: 'TC' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePct: -0.65, isGain: false, logo: 'IN' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', price: 1642.80, change: 14.30, changePct: 0.88, isGain: true, logo: 'HD' },
  ];

  const defaultMovers = [
    { symbol: 'NSE_HAL', name: 'Hindustan Aeronaut.', price: 4886.70, change: 241.70, changePct: 5.20, volume: 2818585, logo: 'HA' },
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePct: 2.32, volume: 4521102, logo: 'RE' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePct: 2.24, volume: 1840920, logo: 'TC' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePct: -0.65, volume: 3210400, logo: 'IN' },
  ];

  const activeMoversList = moverTab === 'GAINERS'
    ? (serverMovers.gainers.length > 0 ? serverMovers.gainers : defaultMovers)
    : moverTab === 'LOSERS'
    ? (serverMovers.losers.length > 0 ? serverMovers.losers : defaultMovers)
    : (serverMovers.volumeShockers.length > 0 ? serverMovers.volumeShockers : defaultMovers);

  const activePositions = positions.filter(p => p.netQty !== 0);
  const openPositionsCount = activePositions.length;
  const longCount = activePositions.filter(p => p.netQty > 0).length;
  const shortCount = activePositions.filter(p => p.netQty < 0).length;

  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  const totalRealizedPnl = positions.reduce((acc, p) => acc + (p.realizedPnl || 0), 0);
  const todaysPnl = totalUnrealizedPnl + totalRealizedPnl;

  const availableMargin = wallet ? wallet.cashBalance : 0;
  const portfolioValue = availableMargin + todaysPnl;
  const pnlPct = portfolioValue > 0 ? (todaysPnl / portfolioValue) * 100 : 0;

  return (
    <div className="space-y-6 pb-12 font-body text-slate-100">
      
      {/* 0. BENTO GRID METRICS DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Bento Tile 1: Portfolio Value */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 relative overflow-hidden transition-all shadow-md backdrop-blur-xl group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Portfolio Value</h3>
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <div className="num-font">
            <span className="text-2xl font-black text-white tracking-tight">
              ₹{portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${todaysPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {todaysPnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{todaysPnl >= 0 ? '+' : ''}₹{todaysPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({todaysPnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
            </div>
          </div>
        </div>

        {/* Bento Tile 2: Today's Real-Time P&L */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 relative overflow-hidden transition-all shadow-md backdrop-blur-xl group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Today's Real-Time P&L</h3>
            <span className={`p-2 rounded-xl ${todaysPnl >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="num-font">
            <span className={`text-2xl font-black tracking-tight ${todaysPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {todaysPnl >= 0 ? '+' : ''}₹{todaysPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-400">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] uppercase font-mono">
                WS STREAMING
              </span>
            </div>
          </div>
        </div>

        {/* Bento Tile 3: Active Positions */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 relative overflow-hidden transition-all shadow-md backdrop-blur-xl group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Positions</h3>
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="num-font">
            <span className="text-2xl font-black text-white tracking-tight">{openPositionsCount}</span>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-slate-400">
              <span>{longCount} Long • {shortCount} Short</span>
            </div>
          </div>
        </div>

        {/* Bento Tile 4: Margin Balance */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-5 relative overflow-hidden transition-all shadow-md backdrop-blur-xl group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Available Margin</h3>
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="num-font">
            <span className="text-2xl font-black text-white tracking-tight">
              ₹{availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-400">
              <span>Ready for F&O Trade</span>
            </div>
          </div>
        </div>

      </div>

      {/* QUICK ACTIONS ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white">Quick Terminal Execution</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectSymbol && onSelectSymbol('RELIANCE')}
            className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>+ Buy Equity</span>
          </button>
          <button
            onClick={() => onSelectSymbol && onSelectSymbol('NIFTY 24850 CE')}
            className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Option Chain Matrix</span>
          </button>
          <button
            onClick={() => onSelectSymbol && onSelectSymbol('MARKET_SCANNER')}
            className="bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Market Scanner</span>
          </button>
        </div>
      </div>

      {/* MAIN BENTO SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: MOST TRADED & TOP MOVERS */}
        <div className="lg:col-span-8 space-y-6">
        
          {/* MOST BOUGHT STOCKS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Most Traded Contracts & Stocks
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl shadow-xs hover:border-emerald-500/50 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black flex items-center justify-center text-xs mb-2 group-hover:scale-105 transition-transform">
                      {stock.logo}
                    </div>
                    <h4 className="font-bold text-xs text-white truncate mb-1">
                      {stock.name}
                    </h4>
                    <div className="num-font font-bold text-xs text-slate-200">
                      ₹{price.toFixed(2)}
                    </div>
                    <div className={`num-font font-bold text-[11px] flex items-center gap-0.5 mt-0.5 ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TOP MOVERS TODAY TABLE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Market Movers (1D)
              </h3>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setMoverTab('GAINERS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    moverTab === 'GAINERS'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Gainers
                </button>
                <button
                  onClick={() => setMoverTab('LOSERS')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    moverTab === 'LOSERS'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Losers
                </button>
                <button
                  onClick={() => setMoverTab('VOLUME')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    moverTab === 'VOLUME'
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Volume Shockers
                </button>
              </div>
            </div>

            {/* Movers Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4 text-center">Trend</th>
                    <th className="py-3 px-4 text-right">LTP Price</th>
                    <th className="py-3 px-4 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 num-font">
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
                        className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-black flex items-center justify-center text-xs border border-emerald-500/20">
                            {m.logo || m.name.charAt(0)}
                          </div>
                          <span className="font-bold text-xs text-white">{m.name}</span>
                        </td>

                        {/* Sparkline Graphic */}
                        <td className="py-3 px-4 text-center">
                          <div className="w-20 h-5 mx-auto flex items-center justify-center">
                            <svg className="w-full h-full" viewBox="0 0 100 30">
                              <path
                                d={isGain ? "M 0 25 L 20 20 L 40 22 L 60 10 L 80 12 L 100 5" : "M 0 5 L 20 12 L 40 10 L 60 22 L 80 20 L 100 25"}
                                fill="none"
                                stroke={isGain ? '#22C55E' : '#EF4444'}
                                strokeWidth="2"
                              />
                            </svg>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-bold">
                          <div className="text-xs text-white">₹{price.toFixed(2)}</div>
                          <div className={`text-[11px] ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isGain ? '+' : ''}{change.toFixed(2)} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right text-slate-400 font-bold">
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

        {/* RIGHT COLUMN: PRODUCTS & TOOLS */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* PRODUCTS & TOOLS BENTO CARD */}
          <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl">
            <h4 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Products & Trading Tools
            </h4>

            <div className="space-y-3">
              <div 
                onClick={() => onSelectSymbol && onSelectSymbol('NIFTY 24850 CE')}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">Option Chain Matrix</span>
                    <span className="text-[10px] text-slate-400">Live Call & Put OI Skew</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div 
                onClick={() => onSelectSymbol && onSelectSymbol('MARKET_SCANNER')}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">AI Market Scanner</span>
                    <span className="text-[10px] text-slate-400">Volume Breakouts & RSI</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div 
                onClick={() => onSelectSymbol && onSelectSymbol('STRATEGY_BUILDER')}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">Option Strategy Builder</span>
                    <span className="text-[10px] text-slate-400">Multi-leg spreads & payoff</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* CLIENT PROFILE & KYC VERIFICATION CARD */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 hover:border-emerald-500/40 p-5 rounded-2xl transition-all shadow-md">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">Profile & KYC Verification</h4>
                  <p className="text-[10px] text-slate-400">Account status & compliance</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                Active
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-3.5 leading-relaxed">
              Ensure your profile details, PAN/Aadhaar documents, and bank payout methods are up to date.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onOpenProfile?.('KYC')}
                className="w-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-slate-950 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Update KYC</span>
              </button>
              <button
                onClick={() => onOpenProfile?.('PROFILE')}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
