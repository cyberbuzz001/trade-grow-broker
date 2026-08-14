import React, { useState, useEffect, useMemo } from 'react';
import { MarketTick } from '../types';
import { Search, Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, Star, ShieldCheck, ArrowUpRight, ArrowDownRight, Layers, Eye, Bookmark } from 'lucide-react';
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

  const handleRemoveSymbol = (tokenToRemove: string) => {
    setWatchlist(prev => prev.filter(w => w.token !== tokenToRemove));
  };

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

  const handleConfirmOrder = async (confirmed: OrderPreviewDetails) => {
    setActionMsg({
      type: 'success',
      text: `Order Executed! ${confirmed.side} ${confirmed.quantity} Qty of ${confirmed.symbol} @ ₹${confirmed.price.toFixed(2)}`,
    });
    if (onRefreshWallet) onRefreshWallet();
    setIsOrderModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full font-body text-slate-100">
      
      {/* 1. TOP HEADER BANNER & SEARCH CONTROL */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-md backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-black text-white tracking-tight">Pro Watchlist</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/30 font-mono">
              {watchlist.length} Tracked
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Real-time WebSocket tick stream, depth monitor & 1-click order execution.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="relative w-full md:w-80">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search symbol to track (e.g. RELIANCE)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all shadow-inner"
            />
          </div>

          {/* Autocomplete Suggestions */}
          {catalogSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-11 z-30 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase text-slate-400 px-3 py-1">
                Add to Watchlist
              </div>
              {catalogSuggestions.map(item => (
                <button
                  key={item.token}
                  onClick={() => handleAddSymbol(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-emerald-500/10 text-left transition-colors cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">{item.symbol}</span>
                    <span className="text-[10px] text-slate-400">{item.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center gap-1">
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
          className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-xs opacity-80 hover:opacity-100 font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. CATEGORY FILTER TABS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(['ALL', 'STOCKS', 'INDICES', 'COMMODITIES'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                activeFilter === cat
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={() => setWatchlist(DEFAULT_WATCHLIST)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <RefreshCw size={13} /> Reset Defaults
        </button>
      </div>

      {/* 3. WATCHLIST SYMBOLS TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-md overflow-hidden backdrop-blur-xl">
        {filteredWatchlist.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Eye size={32} className="text-slate-500 opacity-50 animate-pulse" />
            <span className="text-sm font-bold text-slate-400">No symbols found matching filter</span>
            <button
              onClick={() => {
                setActiveFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Show All Tracked Symbols
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-bold uppercase text-slate-400 tracking-wider num-font">
                  <th className="py-3 px-5">Symbol</th>
                  <th className="py-3 px-4">Exchange</th>
                  <th className="py-3 px-4 text-right">LTP Price</th>
                  <th className="py-3 px-4 text-right">Change (1D)</th>
                  <th className="py-3 px-4 text-right">High / Low</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-5 text-center">Order Execution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs font-bold num-font">
                {filteredWatchlist.map(item => {
                  const freshness = freshnessMap.get(item.token);
                  const tick = freshness?.tick || ticks?.get(item.token);
                  const ltp = tick ? tick.ltp : 0;
                  const change = tick ? tick.change : 0;
                  const changePercent = tick ? tick.changePercent : 0;
                  const isPositive = change >= 0;

                  return (
                    <tr key={item.token} className="hover:bg-slate-800/50 transition-colors group">
                      {/* Symbol & Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-black text-xs">
                            {item.symbol.substring(0, 2)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs text-white group-hover:text-emerald-400 transition-colors">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] text-slate-400">{item.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Exchange Tag */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300">
                          {item.exchange}
                        </span>
                      </td>

                      {/* LTP */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-sm text-white">
                          ₹{ltp > 0 ? ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                        </span>
                      </td>

                      {/* Change */}
                      <td className="py-3.5 px-4 text-right">
                        {ltp > 0 ? (
                          <div className={`flex flex-col items-end ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span className="font-bold flex items-center gap-0.5">
                              {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                              {isPositive ? '+' : ''}{change.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-mono opacity-90">
                              ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* High / Low */}
                      <td className="py-3.5 px-4 text-right text-[11px] text-slate-400 font-mono">
                        {tick?.high && tick?.low ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-400">H: ₹{tick.high.toFixed(2)}</span>
                            <span className="text-rose-400">L: ₹{tick.low.toFixed(2)}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Price Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <PriceBadge
                          state={freshness?.state || 'LIVE'}
                          timeSinceLastTick={freshness?.timeSinceLastTick}
                          size="sm"
                        />
                      </td>

                      {/* Actions: Buy / Sell / Remove */}
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenOrder(item, 'BUY', ltp)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm transition-transform active:scale-95 cursor-pointer"
                          >
                            BUY
                          </button>
                          <button
                            onClick={() => handleOpenOrder(item, 'SELL', ltp)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-sm transition-transform active:scale-95 cursor-pointer"
                          >
                            SELL
                          </button>
                          {onSelectSymbolForTerminal && (
                            <button
                              onClick={() => onSelectSymbolForTerminal(item.symbol)}
                              title="Open Terminal View"
                              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500 transition-colors cursor-pointer"
                            >
                              <TrendingUp size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveSymbol(item.token)}
                            title="Remove from Watchlist"
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-rose-400/80 hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
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
