import React, { useState, useEffect, useMemo } from 'react';
import { MarketTick } from '../types';
import { Search, Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, Star, ShieldCheck, ArrowUpRight, ArrowDownRight, Layers, Eye } from 'lucide-react';
import { PriceBadge } from './PriceBadge';
import { useTickFreshness, useMultiTickFreshness } from '../hooks/useTickFreshness';
import { useSubscribeTokens } from '../hooks/useMarketSocket';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';

interface WatchlistItem {
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

interface GrowwWatchlistViewProps {
  token: string;
  ticks?: Map<string, MarketTick>;
  onRefreshWallet?: () => void;
  onSelectSymbolForTerminal?: (symbol: string) => void;
}

export const GrowwWatchlistView: React.FC<GrowwWatchlistViewProps> = ({
  token,
  ticks,
  onRefreshWallet,
  onSelectSymbolForTerminal,
}) => {
  // Load saved watchlist or default
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
  const [selectedOrder, setSelectedOrder] = useState<OrderPreviewDetails | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Save watchlist updates to local storage
  useEffect(() => {
    try {
      localStorage.setItem('user_custom_watchlist', JSON.stringify(watchlist));
    } catch (_) {}
  }, [watchlist]);

  // Subscribe all watchlist tokens to live WebSocket feed
  const activeTokens = useMemo(() => watchlist.map(item => item.token), [watchlist]);
  useSubscribeTokens(activeTokens);

  // Multi-token tick freshness map
  const freshnessMap = useMultiTickFreshness(activeTokens);

  // Filter items by category & search query
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

  // Search catalog suggestions for adding new items
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

  // Add symbol to watchlist
  const handleAddSymbol = (item: WatchlistItem) => {
    if (!watchlist.some(w => w.token === item.token)) {
      setWatchlist(prev => [item, ...prev]);
      setSearchQuery('');
    }
  };

  // Remove symbol from watchlist
  const handleRemoveSymbol = (tokenToRemove: string) => {
    setWatchlist(prev => prev.filter(w => w.token !== tokenToRemove));
  };

  // Open Order Preview Modal
  const handleOpenOrder = (item: WatchlistItem, side: 'BUY' | 'SELL', ltp: number) => {
    const orderDetails: OrderPreviewDetails = {
      token: item.token,
      symbol: item.symbol,
      underlying: item.symbol,
      exchange: item.exchange,
      expiry: '',
      strike: 0,
      optionType: 'CE',
      side,
      lots: 1,
      lotSize: item.lotSize,
      quantity: item.lotSize,
      price: ltp > 0 ? ltp : 100,
      orderType: 'MARKET',
      productType: 'MIS',
    };
    setSelectedOrder(orderDetails);
    setIsOrderModalOpen(true);
  };

  // Confirm Order Execution
  const handleConfirmOrder = async (confirmed: OrderPreviewDetails) => {
    // The OrderPreviewModal now handles the API call internally.
    // This callback fires only on SUCCESS — refresh wallet & show success message.
    setActionMsg({
      type: 'success',
      text: `Order Executed! ${confirmed.side} ${confirmed.quantity} Qty of ${confirmed.symbol} @ ₹${confirmed.price.toFixed(2)}`,
    });
    if (onRefreshWallet) onRefreshWallet();
    setIsOrderModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. TOP HEADER BANNER & SEARCH CONTROL */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[var(--text-main)] tracking-tight">Market Watchlist</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black border border-emerald-500/20">
              {watchlist.length} Symbols
            </span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] font-bold mt-1">
            Real-time streaming prices, market depth & instant order entry.
          </p>
        </div>

        {/* Search & Add Symbol Input */}
        <div className="relative w-full md:w-80">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search symbol to add (e.g. RELIANCE)..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-2xl text-xs font-bold text-[var(--text-main)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {catalogSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-30 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-2xl shadow-xl p-2 max-h-60 overflow-y-auto">
              <div className="text-[10px] font-black uppercase text-[var(--text-tertiary)] px-3 py-1">
                Add to Watchlist
              </div>
              {catalogSuggestions.map(item => (
                <button
                  key={item.token}
                  onClick={() => handleAddSymbol(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-indigo-500/10 text-left transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-[var(--text-main)]">{item.symbol}</span>
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)]">{item.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-500 font-extrabold text-[10px] flex items-center gap-1">
                    <Plus size={12} /> Add
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-black flex items-center justify-between shadow-xs ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-xs opacity-70 hover:opacity-100 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. CATEGORY FILTER TABS & SYMBOL COUNT */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['ALL', 'STOCKS', 'INDICES', 'COMMODITIES'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all border ${
                activeFilter === cat
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-105'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-indigo-400 hover:text-[var(--text-main)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={() => setWatchlist(DEFAULT_WATCHLIST)}
          className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-tertiary)] hover:text-indigo-500 transition-colors"
        >
          <RefreshCw size={13} /> Reset Defaults
        </button>
      </div>

      {/* 3. WATCHLIST SYMBOLS TABLE */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-sm overflow-hidden">
        {filteredWatchlist.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Eye size={36} className="text-[var(--text-tertiary)] opacity-50 animate-pulse" />
            <span className="text-sm font-extrabold text-[var(--text-muted)]">No symbols found in this filter</span>
            <button
              onClick={() => {
                setActiveFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-indigo-600 text-white font-black text-xs rounded-xl shadow-md"
            >
              View All Symbols
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-surface-elevated)]/60 border-b border-[var(--border-color)] text-[10px] font-black uppercase text-[var(--text-tertiary)] tracking-wider num-font">
                  <th className="py-3.5 px-6">Symbol</th>
                  <th className="py-3.5 px-4">Exchange</th>
                  <th className="py-3.5 px-4 text-right">LTP</th>
                  <th className="py-3.5 px-4 text-right">Change (₹ / %)</th>
                  <th className="py-3.5 px-4 text-right">High / Low</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-center">Quick Trade / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-xs font-bold num-font">
                {filteredWatchlist.map(item => {
                  const freshness = freshnessMap.get(item.token);
                  const tick = freshness?.tick || ticks?.get(item.token);
                  const ltp = tick ? tick.ltp : 0;
                  const change = tick ? tick.change : 0;
                  const changePercent = tick ? tick.changePercent : 0;
                  const isPositive = change >= 0;

                  return (
                    <tr key={item.token} className="hover:bg-[var(--bg-surface-elevated)]/40 transition-colors group">
                      {/* Symbol & Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-xs">
                            {item.symbol.substring(0, 2)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-sm text-[var(--text-main)] group-hover:text-indigo-500 transition-colors">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--text-tertiary)]">{item.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Exchange Tag */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[10px] font-black text-[var(--text-muted)]">
                          {item.exchange}
                        </span>
                      </td>

                      {/* LTP */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-black text-base text-[var(--text-main)]">
                          ₹{ltp > 0 ? ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                        </span>
                      </td>

                      {/* Change */}
                      <td className="py-4 px-4 text-right">
                        {ltp > 0 ? (
                          <div className={`flex flex-col items-end ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <span className="font-black flex items-center gap-0.5">
                              {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                              {isPositive ? '+' : ''}{change.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-extrabold opacity-80">
                              ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>

                      {/* High / Low */}
                      <td className="py-4 px-4 text-right text-[11px] text-[var(--text-tertiary)]">
                        {tick?.high && tick?.low ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-500 font-bold">H: ₹{tick.high.toFixed(2)}</span>
                            <span className="text-rose-500 font-bold">L: ₹{tick.low.toFixed(2)}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Price Status Badge */}
                      <td className="py-4 px-4 text-center">
                        <PriceBadge
                          state={freshness?.state || 'LIVE'}
                          timeSinceLastTick={freshness?.timeSinceLastTick}
                          size="sm"
                        />
                      </td>

                      {/* Actions: Buy / Sell / Remove */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenOrder(item, 'BUY', ltp)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-transform active:scale-95"
                          >
                            BUY
                          </button>
                          <button
                            onClick={() => handleOpenOrder(item, 'SELL', ltp)}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-xs transition-transform active:scale-95"
                          >
                            SELL
                          </button>
                          {onSelectSymbolForTerminal && (
                            <button
                              onClick={() => onSelectSymbolForTerminal(item.symbol)}
                              title="Open Terminal View"
                              className="p-1.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-indigo-500 hover:border-indigo-500 transition-colors"
                            >
                              <TrendingUp size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveSymbol(item.token)}
                            title="Remove from Watchlist"
                            className="p-1.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-rose-500/70 hover:text-rose-500 hover:border-rose-500/40 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Confirmation Modal */}
      {selectedOrder && (
        <OrderPreviewModal
          isOpen={isOrderModalOpen}
          onClose={() => setIsOrderModalOpen(false)}
          details={selectedOrder}
          onConfirm={handleConfirmOrder}
          userToken={token || ''}
        />
      )}
    </div>
  );
};
