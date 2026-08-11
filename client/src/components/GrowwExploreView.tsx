import React, { useState, useEffect } from 'react';
import { ChevronRight, ArrowUpRight, ArrowDownRight, Layers, Award, Landmark, TrendingUp, ChevronDown } from 'lucide-react';
import { MarketTick, Wallet, Position } from '../types';
import { useSubscribeTokens } from '../hooks/useMarketSocket';

interface GrowwExploreViewProps {
  ticks?: Map<string, MarketTick>;
  token?: string | null;
  wallet?: Wallet | null;
  onRefreshWallet?: () => void;
  onSelectSymbol?: (symbol: string) => void;
}

export const GrowwExploreView: React.FC<GrowwExploreViewProps> = ({ 
  ticks, 
  token,
  wallet,
  onRefreshWallet,
  onSelectSymbol 
}) => {
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
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePct: 2.32, isGain: true, logo: '🔵' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePct: 2.24, isGain: true, logo: '🟦' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePct: -0.65, isGain: false, logo: '🔹' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', price: 1642.80, change: 14.30, changePct: 0.88, isGain: true, logo: '🏦' },
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

  // Dynamic calculations from user's actual database wallet & position state
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
    <div className="space-y-8 pb-12 font-body text-[var(--text-main)]">
      
      {/* 0. STITCH GLASSMORPHIC METRICS BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Portfolio Value */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#448AFF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#448AFF]/50 to-transparent"></div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider font-headline">Portfolio Value</h3>
            <span className="p-2 rounded-xl bg-[#448AFF]/10 text-[#448AFF]">
              <Landmark className="w-5 h-5" />
            </span>
          </div>
          <div className="font-label tabular-nums">
            <span className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
              ₹{portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${todaysPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
              {todaysPnl >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{todaysPnl >= 0 ? '+' : ''}₹{todaysPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({todaysPnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%) today</span>
            </div>
          </div>
        </div>

        {/* Card 2: Today's P&L */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00E676]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00E676]/50 to-transparent"></div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider font-headline">Today's P&L</h3>
            <span className={`p-2 rounded-xl ${todaysPnl >= 0 ? 'bg-[#00E676]/10 text-[#00E676]' : 'bg-[#FF5252]/10 text-[#FF5252]'}`}>
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="font-label tabular-nums">
            <span className={`text-3xl font-extrabold tracking-tight ${todaysPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
              {todaysPnl >= 0 ? '+' : ''}₹{todaysPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-[#00E676]">
              <span className="px-2 py-0.5 rounded-full bg-[#00E676]/10 border border-[#00E676]/30 text-[10px]">REAL-TIME</span>
            </div>
          </div>
        </div>

        {/* Card 3: Open Positions */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-[#FF6D00]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FF6D00]/50 to-transparent"></div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider font-headline">Open Positions</h3>
            <span className="p-2 rounded-xl bg-[#FF6D00]/10 text-[#FF6D00]">
              <Layers className="w-5 h-5" />
            </span>
          </div>
          <div className="font-label tabular-nums">
            <span className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">{openPositionsCount}</span>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-[var(--text-muted)]">
              <span>{longCount} Long • {shortCount} Short</span>
            </div>
          </div>
        </div>

        {/* Card 4: Available Margin */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider font-headline">Available Margin</h3>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Award className="w-5 h-5" />
            </span>
          </div>
          <div className="font-label tabular-nums">
            <span className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
              ₹{availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-[#00E676]">
              <span>100% Margin Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="flex flex-wrap items-center justify-end gap-3 font-headline">
        <button
          onClick={() => onSelectSymbol && onSelectSymbol('RELIANCE')}
          className="bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 hover:bg-[#00E676] hover:text-[#0D1117] px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-2"
        >
          <span>+ Buy Stock</span>
        </button>
        <button
          onClick={() => onSelectSymbol && onSelectSymbol('INFY')}
          className="bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/30 hover:bg-[#FF5252] hover:text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-2"
        >
          <span>- Sell Stock</span>
        </button>
        <button
          onClick={() => onSelectSymbol && onSelectSymbol('NIFTY 24850 CE')}
          className="bg-[#448AFF]/10 text-[#448AFF] border border-[#448AFF]/30 hover:bg-[#448AFF] hover:text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-2"
        >
          <span>Option Chain</span>
        </button>
        <button
          onClick={() => onSelectSymbol && onSelectSymbol('MARKET_SCANNER')}
          className="bg-[#FF6D00]/10 text-[#FF6D00] border border-[#FF6D00]/30 hover:bg-[#FF6D00] hover:text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center gap-2"
        >
          <span>Market Scanner</span>
        </button>
      </div>

      {/* MAIN EXPLORE CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
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
                    className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xs hover:shadow-md hover:border-[#00E676] transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform">
                      {stock.logo}
                    </div>
                    <h4 className="font-extrabold text-sm text-[var(--text-main)] truncate mb-3 font-headline">
                      {stock.name}
                    </h4>
                    <div className="num-font font-black text-sm text-[var(--text-main)]">
                      ₹{price.toFixed(2)}
                    </div>
                    <div className={`num-font font-extrabold text-xs flex items-center gap-0.5 mt-1 ${isGain ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                      {isGain ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      <span>{Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#00E676] hover:underline font-headline">
              <span>See more</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. TOP MOVERS TODAY */}
          <div>
            <h3 className="text-xl font-black text-[var(--text-main)] mb-4 font-headline">
              Top movers today
            </h3>

            {/* Filter Pills Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6 font-headline">
              <button
                onClick={() => setMoverTab('GAINERS')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  moverTab === 'GAINERS'
                    ? 'bg-[#00E676] text-[#0D1117] border-[#00E676] shadow-sm font-black'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-extrabold'
                }`}
              >
                Gainers
              </button>

              <button
                onClick={() => setMoverTab('LOSERS')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  moverTab === 'LOSERS'
                    ? 'bg-[#00E676] text-[#0D1117] border-[#00E676] shadow-sm font-black'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-extrabold'
                }`}
              >
                Losers
              </button>

              <button
                onClick={() => setMoverTab('VOLUME')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  moverTab === 'VOLUME'
                    ? 'bg-[#00E676] text-[#0D1117] border-[#00E676] shadow-sm font-black'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-extrabold'
                }`}
              >
                Volume shockers
              </button>

              {/* Dropdown Filter */}
              <div className="ml-auto">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs font-extrabold text-[var(--text-main)]">
                  <span>NIFTY 100</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Movers Table */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] uppercase text-[10px] font-black font-headline">
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4 text-center">Trend (1D)</th>
                    <th className="py-3 px-4 text-right">Market price (1D)</th>
                    <th className="py-3 px-4 text-right">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] num-font">
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
                          <div className="w-8 h-8 rounded-lg bg-[#00E676]/10 text-[#00E676] font-extrabold flex items-center justify-center text-xs">
                            {m.logo || m.name.charAt(0)}
                          </div>
                          <span className="font-extrabold text-sm text-[var(--text-main)] font-headline">{m.name}</span>
                        </td>

                        {/* Mini Sparkline SVG */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="w-24 h-6 mx-auto flex items-center justify-center">
                            <svg className="w-full h-full" viewBox="0 0 100 30">
                              <path
                                d={isGain ? "M 0 25 L 20 20 L 40 22 L 60 10 L 80 12 L 100 5" : "M 0 5 L 20 12 L 40 10 L 60 22 L 80 20 L 100 25"}
                                fill="none"
                                stroke={isGain ? '#00E676' : '#FF5252'}
                                strokeWidth="2"
                              />
                            </svg>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-black">
                          <div className="text-sm text-[var(--text-main)]">₹{price.toFixed(2)}</div>
                          <div className={`text-xs font-bold ${isGain ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                            {isGain ? '+' : ''}{change.toFixed(2)} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right text-[var(--text-muted)] font-bold">
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
          
          {/* 1. YOUR INVESTMENTS CARD */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xs">
            <h4 className="font-extrabold text-base text-[var(--text-main)] mb-6 font-headline">
              Your investments
            </h4>

            {/* Empty State Illustration */}
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-32 h-24 mb-4 opacity-85">
                <svg viewBox="0 0 160 120" className="w-full h-full">
                  <rect x="20" y="30" width="120" height="70" rx="12" fill="var(--bg-surface-elevated)" stroke="var(--border-color)" strokeWidth="1"/>
                  <circle cx="60" cy="55" r="8" fill="#00E676"/>
                  <path d="M50 80 Q 65 60 80 80 Q 95 65 110 85" fill="none" stroke="#00E676" strokeWidth="3"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-[var(--text-muted)]">
                You haven't invested yet
              </p>
            </div>
          </div>

          {/* 2. PRODUCTS & TOOLS CARD */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xs font-headline">
            <h4 className="font-extrabold text-base text-[var(--text-main)] mb-4">
              Products & Tools
            </h4>

            <div className="space-y-4">
              {/* IPO */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#00E676]/10 text-[#00E676] flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-sm text-[var(--text-main)]">IPO</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-black">
                  8 open
                </span>
              </div>

              {/* Bonds */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-sm text-[var(--text-main)]">Bonds</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-black">
                  7 open
                </span>
              </div>

              {/* ETFs */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="font-extrabold text-sm text-[var(--text-main)]">ETFs</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
