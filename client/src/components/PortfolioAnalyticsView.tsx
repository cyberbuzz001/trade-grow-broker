import React, { useState, useEffect } from 'react';
import { Wallet } from '../types';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, PieChart, ShieldAlert, Zap, Layers, RefreshCw, DollarSign, Activity } from 'lucide-react';

interface PortfolioAnalyticsViewProps {
  token: string;
  wallet: Wallet | null;
  onRefreshWallet: () => void;
}

export const PortfolioAnalyticsView: React.FC<PortfolioAnalyticsViewProps> = ({ token, wallet, onRefreshWallet }) => {
  const [positions, setPositions] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/v1/portfolio/positions', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => data.success && Array.isArray(data.positions) && setPositions(data.positions));

    fetch('/api/v1/portfolio/holdings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => data.success && Array.isArray(data.holdings) && setHoldings(data.holdings));
  }, [token]);

  const cashBalance = wallet?.cashBalance || 1000000;
  const usedMargin = wallet?.usedMargin || 0;
  const buyingPower = wallet?.buyingPower || cashBalance;
  const realizedPnl = wallet?.realizedPnl || 0;
  const unrealizedPnl = wallet?.unrealizedPnl || 0;

  const totalPortfolioValue = cashBalance + unrealizedPnl;
  const marginPct = ((usedMargin / Math.max(cashBalance, 1)) * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      {/* 1. TOP HEADER SUMMARY */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-xl shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">Portfolio & Risk Analytics</h2>
            <span className="text-xs text-slate-400">Comprehensive risk assessment, margin utilization, and P&L breakdown</span>
          </div>
        </div>

        <button
          onClick={onRefreshWallet}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-700 flex items-center gap-2 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Analytics
        </button>
      </div>

      {/* 2. METRIC CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL PORTFOLIO VALUE */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL PORTFOLIO VALUE</span>
            <WalletIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-white">
            ₹{totalPortfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">INITIAL CAPITAL: ₹10,00,000.00</span>
        </div>

        {/* AVAILABLE BUYING POWER */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AVAILABLE BUYING POWER</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-400">
            ₹{buyingPower.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">CASH MINUS BLOCKED MARGIN</span>
        </div>

        {/* USED MARGIN */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BLOCKED MARGIN</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold font-mono text-amber-400">
            ₹{usedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">UTILIZATION: {marginPct}%</span>
        </div>

        {/* NET COMBINED P&L */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL COMBINED P&L</span>
            {(realizedPnl + unrealizedPnl) >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
          </div>
          <span className={`text-2xl font-bold font-mono ${(realizedPnl + unrealizedPnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {(realizedPnl + unrealizedPnl) >= 0 ? '+' : ''}₹{(realizedPnl + unrealizedPnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 font-mono">
            REALIZED: ₹{realizedPnl.toFixed(2)} | UNREALIZED: ₹{unrealizedPnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 3. MARGIN & ALLOCATION BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT 7 COLS: MARGIN UTILIZATION GAUGE */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Margin & Risk Utilization Meter
            </h3>

            <div className="flex flex-col gap-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-400">Current Margin Usage Ratio:</span>
                  <span className="font-mono font-bold text-amber-400">{marginPct}%</span>
                </div>
                <div className="h-4 w-full bg-slate-950 rounded-full border border-slate-800 overflow-hidden flex">
                  <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, parseFloat(marginPct))}%` }}></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px]">MAX INTRADAY LEVERAGE</span>
                  <span className="font-bold text-white text-sm">5.0x (MIS)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">DELIVERY MARGIN</span>
                  <span className="font-bold text-white text-sm">1.0x (CNC)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">PEAK MARGIN THRESHOLD</span>
                  <span className="font-bold text-emerald-400 text-sm">80.0%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AUTO SQUARE-OFF CUTOFF</span>
                  <span className="font-bold text-rose-400 text-sm">15:15 IST</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLS: ASSET ALLOCATION */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layers className="w-4 h-4 text-blue-400" /> Capital Asset Allocation
            </h3>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-slate-300">Equities (CNC)</span>
                  <span className="font-mono text-emerald-400">45%</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[45%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-slate-300">Futures & Options (NFO)</span>
                  <span className="font-mono text-purple-400">30%</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full w-[30%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span className="text-slate-300">Unallocated Cash Reserve</span>
                  <span className="font-mono text-blue-400">25%</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full w-[25%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
