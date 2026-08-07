import React, { useState } from 'react';
import { Layers, Briefcase, Receipt, Eye, BarChart2, DollarSign, Grid, Clock, ChevronDown, X, Filter, ShieldCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { TradingTerminal } from './TradingTerminal';
import { OptionChainView } from './OptionChainView';
import { OrdersPositionsView } from './OrdersPositionsView';
import { MarketDepthView } from './MarketDepthView';
import { PortfolioAnalyticsView } from './PortfolioAnalyticsView';
import { MarketTick, Wallet } from '../types';

interface GrowwTerminalViewProps {
  token: string | null;
  ticks?: Map<string, MarketTick>;
  wallet: Wallet | null;
  onRefreshWallet: () => void;
  initialSymbol?: string;
}

type DockedPanel = 'POSITIONS' | 'CHAIN' | 'ORDERS' | 'WATCHLIST' | 'DEPTH' | 'HOLDINGS' | 'BALANCE' | null;

export const GrowwTerminalView: React.FC<GrowwTerminalViewProps> = ({
  token,
  ticks,
  wallet,
  onRefreshWallet,
  initialSymbol = 'NIFTY',
}) => {
  const [activePanel, setActivePanel] = useState<DockedPanel>('CHAIN');
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [showMarketTimings, setShowMarketTimings] = useState(false);

  const togglePanel = (panel: DockedPanel) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const validToken = token || '';
  const validTicks = ticks || new Map();

  return (
    <div className="flex h-[calc(100vh-104px)] bg-[var(--bg-body)] overflow-hidden relative">
      
      {/* LEFT/CENTER: TRADINGVIEW CHART & MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-surface)] border-r border-[var(--border-color)]">
        
        {/* Terminal Header Bar */}
        <div className="h-10 border-b border-[var(--border-color)] px-4 flex items-center justify-between text-xs font-bold bg-[var(--bg-surface-elevated)]">
          
          {/* Symbol Selector & Market Timings Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-extrabold text-[var(--text-main)]">Terminal</span>
            </div>

            {/* Market Timings Tooltip Popover Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowMarketTimings(!showMarketTimings)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-500 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Market timings</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Market Timings Modal Popover (Matching Image 4) */}
              {showMarketTimings && (
                <div className="absolute left-0 mt-2 w-64 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-1 text-xs">
                  <div className="font-extrabold text-slate-800 dark:text-white pb-2 border-b border-[var(--border-light)] mb-2">
                    Market timings
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 font-bold text-[var(--text-main)]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Equity F&O</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">Market is open</div>
                        <div className="text-[10px] text-slate-400">Market closes at 3:40 PM</div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between border-t border-[var(--border-light)] pt-2">
                      <div className="flex items-center gap-2 font-bold text-[var(--text-main)]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Commodities</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase">Market is open</div>
                        <div className="text-[10px] text-slate-400">Market closes at 11:30 PM</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-extrabold num-font">
            11:02:01 UTC+5:30 % log auto
          </div>

        </div>

        {/* Trading Terminal Main Workspace (Chart Window) */}
        <div className="flex-1 overflow-hidden">
          <TradingTerminal
            token={validToken}
            ticks={validTicks}
            wallet={wallet}
            onRefreshWallet={onRefreshWallet}
            initialSymbol={selectedSymbol}
          />
        </div>

      </div>

      {/* RIGHT SLIDE-OUT DOCKED PANEL (IMAGE 4 & IMAGE 5) */}
      {activePanel && (
        <div className="w-[420px] bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col h-full z-20 shadow-2xl animate-in slide-in-from-right duration-200">
          
          {/* Docked Panel Header */}
          <div className="h-10 px-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface-elevated)]">
            <h4 className="font-extrabold text-xs text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
              {activePanel === 'POSITIONS' && <Briefcase className="w-4 h-4 text-emerald-500" />}
              {activePanel === 'CHAIN' && <Layers className="w-4 h-4 text-emerald-500" />}
              {activePanel === 'ORDERS' && <Receipt className="w-4 h-4 text-emerald-500" />}
              {activePanel === 'DEPTH' && <BarChart2 className="w-4 h-4 text-emerald-500" />}
              {activePanel === 'HOLDINGS' && <Briefcase className="w-4 h-4 text-emerald-500" />}
              <span>{activePanel}</span>
            </h4>
            <button
              onClick={() => setActivePanel(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Content Area */}
          <div className="flex-1 overflow-y-auto">
            {activePanel === 'CHAIN' && (
              <OptionChainView token={validToken} ticks={validTicks} onRefreshWallet={onRefreshWallet} />
            )}

            {activePanel === 'POSITIONS' && (
              <OrdersPositionsView token={validToken} initialTab="POSITIONS" onRefreshWallet={onRefreshWallet} />
            )}

            {activePanel === 'ORDERS' && (
              <OrdersPositionsView token={validToken} initialTab="ORDERS" onRefreshWallet={onRefreshWallet} />
            )}

            {activePanel === 'DEPTH' && (
              <MarketDepthView ticks={validTicks} token={validToken} />
            )}

            {activePanel === 'HOLDINGS' && (
              <PortfolioAnalyticsView token={validToken} wallet={wallet} onRefreshWallet={onRefreshWallet} />
            )}
          </div>

        </div>
      )}

      {/* RIGHT DOCKED DOCK BAR WITH VERTICAL ICON TABS (MATCHING IMAGES 4 & 5) */}
      <div className="w-16 bg-[var(--bg-surface)] border-l border-[var(--border-color)] flex flex-col items-center py-4 space-y-4 z-30">
        
        {/* Positions Icon Tab */}
        <button
          onClick={() => togglePanel('POSITIONS')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all ${
            activePanel === 'POSITIONS'
              ? 'bg-emerald-500/10 text-[var(--groww-green)] font-extrabold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Positions"
        >
          <Briefcase className="w-5 h-5" />
          <span>Positions</span>
        </button>

        {/* Option Chain Icon Tab */}
        <button
          onClick={() => togglePanel('CHAIN')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all ${
            activePanel === 'CHAIN'
              ? 'bg-emerald-500/10 text-[var(--groww-green)] font-extrabold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Option Chain"
        >
          <Layers className="w-5 h-5" />
          <span>Chain</span>
        </button>

        {/* Orders Icon Tab */}
        <button
          onClick={() => togglePanel('ORDERS')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all ${
            activePanel === 'ORDERS'
              ? 'bg-emerald-500/10 text-[var(--groww-green)] font-extrabold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Orders"
        >
          <Receipt className="w-5 h-5" />
          <span>Orders</span>
        </button>

        {/* Watchlist Icon Tab */}
        <button
          onClick={() => togglePanel('CHAIN')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all ${
            activePanel === 'WATCHLIST'
              ? 'bg-emerald-500/10 text-[var(--groww-green)] font-extrabold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Watchlist"
        >
          <Eye className="w-5 h-5" />
          <span>Watchlist</span>
        </button>

        {/* Depth Icon Tab */}
        <button
          onClick={() => togglePanel('DEPTH')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all ${
            activePanel === 'DEPTH'
              ? 'bg-emerald-500/10 text-[var(--groww-green)] font-extrabold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Market Depth"
        >
          <BarChart2 className="w-5 h-5" />
          <span>Depth</span>
        </button>

        {/* Holdings Icon Tab */}
        <button
          onClick={() => togglePanel('HOLDINGS')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all ${
            activePanel === 'HOLDINGS'
              ? 'bg-emerald-500/10 text-[var(--groww-green)] font-extrabold'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Holdings"
        >
          <DollarSign className="w-5 h-5" />
          <span>Holdings</span>
        </button>

      </div>

    </div>
  );
};
