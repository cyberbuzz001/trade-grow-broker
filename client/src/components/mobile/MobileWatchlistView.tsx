import React, { useState, useEffect, useMemo } from 'react';
import { MarketTick } from '../../types';
import { Search, Plus, Trash2, TrendingUp, RefreshCw, Bookmark, ArrowUpRight, ArrowDownRight, Eye, X } from 'lucide-react';
import { useMultiTickFreshness } from '../../hooks/useTickFreshness';
import { useSubscribeTokens, useMarketSocket } from '../../hooks/useMarketSocket';
import { MobileChartModal } from './MobileChartModal';

export interface WatchlistItem {
  token: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'MCX' | 'NFO';
  category: 'STOCKS' | 'INDICES' | 'COMMODITIES';
  lotSize: number;
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', name: 'NIFTY 50 Index', exchange: 'NSE', category: 'INDICES', lotSize: 65 },
  { token: 'BSE_SENSEX', symbol: 'SENSEX', name: 'BSE SENSEX Index', exchange: 'BSE', category: 'INDICES', lotSize: 20 },
  { token: 'NSE_RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', exchange: 'NSE', category: 'STOCKS', lotSize: 250 },
  { token: 'NSE_TCS', symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', category: 'STOCKS', lotSize: 175 },
  { token: 'NSE_INFY', symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 400 },
  { token: 'NSE_HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 550 },
  { token: 'NSE_ICICIBANK', symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 700 },
  { token: 'NSE_TATAMOTORS', symbol: 'TATAMOTORS', name: 'Tata Motors Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 1000 },
  { token: 'MCX_CRUDEOIL', symbol: 'CRUDEOIL', name: 'Crude Oil Futures', exchange: 'MCX', category: 'COMMODITIES', lotSize: 100 },
  { token: 'MCX_GOLD', symbol: 'GOLD', name: 'Gold Futures 1KG', exchange: 'MCX', category: 'COMMODITIES', lotSize: 1 },
];

const SEARCH_CATALOG: WatchlistItem[] = [
  ...DEFAULT_WATCHLIST,
  { token: 'NSE_SBIN', symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', category: 'STOCKS', lotSize: 750 },
  { token: 'NSE_BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', exchange: 'NSE', category: 'STOCKS', lotSize: 475 },
  { token: 'NSE_ITC', symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 1600 },
  { token: 'NSE_LTIM', symbol: 'LTIM', name: 'LTIMindtree Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 150 },
  { token: 'MCX_SILVER', symbol: 'SILVER', name: 'Silver Futures 30KG', exchange: 'MCX', category: 'COMMODITIES', lotSize: 30 },
  { token: 'MCX_NATURALGAS', symbol: 'NATURALGAS', name: 'Natural Gas Futures', exchange: 'MCX', category: 'COMMODITIES', lotSize: 1250 },
];

interface MobileWatchlistViewProps {
  token: string;
  ticks?: Map<string, MarketTick>;
  theme?: 'light' | 'dark';
  onOpenQuickOrder?: (stock: { name: string; symbol: string; price: number; side?: 'BUY' | 'SELL' }) => void;
  onOpenOptionChain?: (symbol: string) => void;
}

export const MobileWatchlistView: React.FC<MobileWatchlistViewProps> = ({
  token,
  ticks: propsTicks,
  theme = 'light',
  onOpenQuickOrder,
  onOpenOptionChain,
}) => {
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());
  
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem('user_custom_watchlist');
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch (_) {
      return DEFAULT_WATCHLIST;
    }
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STOCKS' | 'INDICES' | 'COMMODITIES'>('ALL');
  const [activeChartContract, setActiveChartContract] = useState<{ symbol: string; token: string; exchange: string } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('user_custom_watchlist', JSON.stringify(watchlist));
    } catch (_) {}
  }, [watchlist]);

  const activeTokens = useMemo(() => watchlist.map(item => item.token), [watchlist]);
  useSubscribeTokens(activeTokens);
  const freshnessMap = useMultiTickFreshness(activeTokens);

  const filteredWatchlist = useMemo(() => {
    return watchlist.filter(item => {
      const matchesCategory = activeFilter === 'ALL' || item.category === activeFilter;
      const matchesSearch =
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.token.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [watchlist, activeFilter, searchQuery]);

  const catalogSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const existingTokens = new Set(watchlist.map(w => w.token));
    return SEARCH_CATALOG.filter(
      item =>
        !existingTokens.has(item.token) &&
        (item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, watchlist]);

  const handleAddSymbol = (item: WatchlistItem) => {
    if (!watchlist.some(w => w.token === item.token)) {
      setWatchlist(prev => [item, ...prev]);
      setSearchQuery('');
    }
  };

  const handleRemoveSymbol = (tokenToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.vibrate?.(20);
    setWatchlist(prev => prev.filter(w => w.token !== tokenToRemove));
  };

  return (
    <div className="space-y-3 font-body text-[var(--text-main)] w-full max-w-full overflow-hidden">
      
      {/* 1. COMPACT WATCHLIST HEADER */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-3.5 rounded-2xl shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-[var(--text-main)] tracking-tight">Pro Watchlist</h2>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono">
                {watchlist.length}
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-medium">Real-Time Tick Stream</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(20);
            setWatchlist(DEFAULT_WATCHLIST);
          }}
          className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-muted)] hover:text-emerald-500 transition-colors cursor-pointer py-1 px-2 rounded-lg bg-[var(--bg-surface-elevated)] active:scale-95"
          title="Reset to default symbols"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* 2. COMPACT SEARCH INPUT */}
      <div className="relative w-full">
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3.5 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search stock to track (e.g. RELIANCE, TCS)..."
            className="w-full pl-9 pr-8 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-500 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Autocomplete Popup */}
        {catalogSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-11 z-30 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-xl p-2 max-h-56 overflow-y-auto space-y-1">
            <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] px-2 py-1">
              Add to Watchlist
            </div>
            {catalogSuggestions.map(item => (
              <button
                key={item.token}
                type="button"
                onClick={() => handleAddSymbol(item)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-emerald-500/10 text-left transition-colors cursor-pointer active:scale-98"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[var(--text-main)]">{item.symbol}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{item.name}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                  <Plus size={11} /> Add
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. CONTAINED HORIZONTAL CATEGORY FILTER PILLS */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {(['ALL', 'STOCKS', 'INDICES', 'COMMODITIES'] as const).map(cat => {
          const isActive = activeFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                navigator.vibrate?.(15);
                setActiveFilter(cat);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex-shrink-0 cursor-pointer border ${
                isActive
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-xs'
                  : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 4. MOBILE-NATIVE WATCHLIST CARDS */}
      <div className="space-y-2">
        {filteredWatchlist.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-8 rounded-2xl text-center space-y-2 shadow-xs">
            <Eye size={28} className="text-[var(--text-muted)] mx-auto opacity-50 animate-pulse" />
            <h4 className="text-xs font-bold text-[var(--text-main)]">No symbols found matching "{searchQuery}"</h4>
            <button
              type="button"
              onClick={() => {
                setActiveFilter('ALL');
                setSearchQuery('');
              }}
              className="px-3.5 py-1.5 bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Show All Tracked
            </button>
          </div>
        ) : (
          filteredWatchlist.map(item => {
            const freshness = freshnessMap.get(item.token);
            const tick = freshness?.tick || ticks?.get(item.token);
            const ltp = tick && tick.ltp > 0 ? tick.ltp : 0;
            const change = tick ? tick.change : 0;
            const changePercent = tick ? tick.changePercent : 0;
            const isPositive = change >= 0;

            return (
              <div
                key={item.token}
                onClick={() => {
                  navigator.vibrate?.(20);
                  setActiveChartContract({ symbol: item.symbol, token: item.token, exchange: item.exchange });
                }}
                className="bg-[var(--bg-surface)] rounded-2xl p-3 flex items-center justify-between border border-[var(--border-color)] hover:border-emerald-500/40 transition-all shadow-xs cursor-pointer active:scale-[0.99] group"
              >
                {/* Left Side: Avatar + Name + Exchange */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-black text-xs flex items-center justify-center flex-shrink-0">
                    {item.symbol.substring(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-xs text-[var(--text-main)] truncate group-hover:text-emerald-500 transition-colors">
                        {item.symbol}
                      </h3>
                      <span className="text-[9px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1.5 py-0.2 rounded border border-[var(--border-color)] font-mono font-bold flex-shrink-0">
                        {item.exchange}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] truncate font-medium mt-0.5">
                      {item.name}
                    </p>
                  </div>
                </div>

                {/* Right Side: Price + Change + Buy/Sell Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right num-font tabular-nums">
                    <p className="font-black text-xs text-[var(--text-main)]">
                      {ltp > 0 ? `₹${ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </p>
                    {ltp > 0 ? (
                      <p className={`text-[10px] font-bold flex items-center justify-end ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                      </p>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">—</span>
                    )}
                  </div>

                  {/* 1-Tap Buy & Sell Action Triggers */}
                  <div className="flex items-center gap-1 pl-1.5 border-l border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.vibrate?.(25);
                        onOpenQuickOrder?.({ name: item.name, symbol: item.symbol, price: ltp > 0 ? ltp : 100, side: 'BUY' });
                      }}
                      className="min-h-[36px] min-w-[42px] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] px-2 py-1 rounded-xl shadow-xs active:scale-95 transition-transform cursor-pointer"
                      title="Quick Buy"
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.vibrate?.(25);
                        onOpenQuickOrder?.({ name: item.name, symbol: item.symbol, price: ltp > 0 ? ltp : 100, side: 'SELL' });
                      }}
                      className="min-h-[36px] min-w-[42px] bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] px-2 py-1 rounded-xl shadow-xs active:scale-95 transition-transform cursor-pointer"
                      title="Quick Sell"
                    >
                      SELL
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveSymbol(item.token, e)}
                      className="p-1 text-[var(--text-muted)] hover:text-rose-500 cursor-pointer transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile Live Candlestick Chart Modal */}
      {activeChartContract && (
        <MobileChartModal
          isOpen={Boolean(activeChartContract)}
          onClose={() => setActiveChartContract(null)}
          symbol={activeChartContract.symbol}
          token={activeChartContract.token}
          exchange={activeChartContract.exchange}
          latestTick={ticks?.get(activeChartContract.token)}
          theme={theme}
          onOpenOptionChain={(sym) => {
            onOpenOptionChain?.(sym);
          }}
          onOpenOrderModal={(side, price) => {
            onOpenQuickOrder?.({ name: activeChartContract.symbol, symbol: activeChartContract.symbol, price, side });
          }}
        />
      )}

    </div>
  );
};
