import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Bell, ChevronLeft, Briefcase } from 'lucide-react';
import { MarketTick, Wallet, Holding } from '../../types';

interface MobilePortfolioViewProps {
  ticks?: Map<string, MarketTick>;
  token?: string | null;
  wallet?: Wallet | null;
  onBack: () => void;
  onSelectStock: (symbol: string, name: string, price: number) => void;
}

export const MobilePortfolioView: React.FC<MobilePortfolioViewProps> = ({
  ticks,
  token,
  wallet,
  onBack,
  onSelectStock,
}) => {
  const [activeSegment, setActiveSegment] = useState<'ALL' | 'EQUITY' | 'FO' | 'COMMODITIES'>('ALL');
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    fetch('/api/v1/portfolio/holdings', {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.holdings)) {
          setHoldings(data.holdings);
        }
      })
      .catch(() => {});
  }, [token]);

  const totalInvested = holdings.reduce((acc, h) => acc + (h.averagePrice * h.quantity), 0);
  const totalCurrent = holdings.reduce((acc, h) => acc + (h.currentValue || h.ltp * h.quantity), 0);
  const totalPnl = holdings.reduce((acc, h) => acc + (h.pnl || 0), 0);
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const totalPortfolioValue = (wallet?.cashBalance ?? 0) + totalCurrent;

  return (
    <div className="pb-24 pt-4 px-4 space-y-6 font-body bg-[#0D1117] min-h-screen text-white select-none">
      
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-[#161B22] border border-[#30363D] flex items-center justify-center text-[#8B949E] hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h1 className="text-xl font-headline font-bold text-white">
          Portfolio & Holdings
        </h1>

        <div className="w-10" />
      </div>

      {/* 2. PORTFOLIO SUMMARY CARD */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00E676]/20 to-[#448AFF]/20 opacity-20 transition-opacity"></div>
        <div className="relative z-10 space-y-3">
          <p className="text-[#8B949E] text-xs font-semibold uppercase tracking-wider font-headline">Total Investment Value</p>
          <h2 className="font-label text-4xl font-bold tracking-tight tabular-nums text-white">
            ₹{totalPortfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold font-label pt-2 border-t border-[#30363D]">
            <div>
              <span className="text-[#8B949E]">Invested: </span>
              <span className="text-white">₹{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-[#8B949E]">Returns: </span>
              <span className={totalPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}>
                {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)} ({totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SEGMENT TOGGLE TABS */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 font-headline">
        {[
          { id: 'ALL', label: 'All Holdings' },
          { id: 'EQUITY', label: 'Equity' },
          { id: 'FO', label: 'F&O' },
          { id: 'COMMODITIES', label: 'Commodities' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSegment(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
              activeSegment === tab.id
                ? 'bg-[#00E676] text-[#0D1117] font-extrabold shadow-sm'
                : 'bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. HOLDINGS CARDS LIST OR ZERO STATE */}
      <div className="space-y-3">
        {holdings.length === 0 ? (
          <div className="bg-[#161B22] border border-[#30363D] p-8 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1C2128] border border-[#30363D] text-[#8B949E] flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-white">No Holdings Found</h3>
            <p className="text-xs text-[#8B949E] max-w-xs mx-auto">
              You don't have any stocks or long-term holdings in your portfolio yet.
            </p>
          </div>
        ) : (
          holdings.map((item) => {
            const liveTick = ticks?.get(item.symbol);
            const ltp = liveTick ? liveTick.ltp : item.ltp;
            const pnl = (ltp - item.averagePrice) * item.quantity;
            const pnlPct = ((ltp - item.averagePrice) / item.averagePrice) * 100;
            const isGain = pnl >= 0;

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectStock(item.symbol, item.symbol, ltp)}
                className="bg-[#161B22] border border-[#30363D] p-4 rounded-2xl space-y-3 cursor-pointer hover:border-[#00E676] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{item.symbol}</h4>
                    <span className="text-xs text-[#8B949E] font-label">{item.quantity} shares • Avg ₹{item.averagePrice.toFixed(2)}</span>
                  </div>

                  <div className="text-right num-font font-label">
                    <div className="font-bold text-sm text-white">₹{ltp.toFixed(2)}</div>
                    <div className={`text-xs font-bold flex items-center justify-end gap-0.5 ${isGain ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                      <span>{isGain ? '+' : ''}₹{pnl.toFixed(2)} ({isGain ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
