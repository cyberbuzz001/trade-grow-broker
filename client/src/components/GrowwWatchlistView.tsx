import React, { useState, useEffect, useMemo } from 'react';
import { MarketTick } from '../types';
import { Search, Plus, Trash2, TrendingUp, RefreshCw, Eye, Bookmark, X } from 'lucide-react';
import { PriceBadge } from './PriceBadge';
import { useMultiTickFreshness } from '../hooks/useTickFreshness';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';
import { Card, Badge, Tabs, DataTable, DataTableColumn, Button } from './ui';

interface WatchlistItem {
  token: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'MCX' | 'NFO';
  category: 'STOCKS' | 'INDICES' | 'COMMODITIES' | 'FO';
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
  { token: 'NSE_NIFTY24850CE', symbol: 'NIFTY 24850 CE', name: 'NIFTY Weekly Call Option', exchange: 'NFO', category: 'FO', lotSize: 65 },
];

const SEARCH_CATALOG: WatchlistItem[] = [
  ...DEFAULT_WATCHLIST,
  { token: 'NSE_SBIN', symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', category: 'STOCKS', lotSize: 750 },
  { token: 'NSE_BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', exchange: 'NSE', category: 'STOCKS', lotSize: 475 },
  { token: 'NSE_ITC', symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 1600 },
  { token: 'NSE_LTIM', symbol: 'LTIM', name: 'LTIMindtree Limited', exchange: 'NSE', category: 'STOCKS', lotSize: 150 },
  { token: 'MCX_SILVER', symbol: 'SILVER', name: 'Silver Futures 30KG', exchange: 'MCX', category: 'COMMODITIES', lotSize: 30 },
  { token: 'MCX_NATURALGAS', symbol: 'NATURALGAS', name: 'Natural Gas Futures', exchange: 'MCX', category: 'COMMODITIES', lotSize: 1250 },
  { token: 'NSE_NIFTY24800PE', symbol: 'NIFTY 24800 PE', name: 'NIFTY Weekly Put Option', exchange: 'NFO', category: 'FO', lotSize: 65 },
  { token: 'NSE_BANKNIFTY52000CE', symbol: 'BANKNIFTY 52000 CE', name: 'BANKNIFTY Weekly Call Option', exchange: 'NFO', category: 'FO', lotSize: 35 },
];

interface GrowwWatchlistViewProps {
  token: string;
  ticks?: Map<string, MarketTick>;
  onRefreshWallet?: () => void;
  onSelectSymbolForTerminal?: (symbol: string, token: string, exchange: string) => void;
  riskRestriction?: string | null;
}

export const GrowwWatchlistView: React.FC<GrowwWatchlistViewProps> = ({
  token,
  ticks: propsTicks,
  onRefreshWallet,
  onSelectSymbolForTerminal,
  riskRestriction,
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
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STOCKS' | 'FO' | 'INDICES' | 'COMMODITIES'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<OrderPreviewDetails | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('user_custom_watchlist', JSON.stringify(watchlist));
    } catch (_) {}
  }, [watchlist]);

  const activeTokens = useMemo(() => watchlist.map((item) => item.token), [watchlist]);
  useSubscribeTokens(activeTokens);
  const freshnessMap = useMultiTickFreshness(activeTokens);

  const filteredWatchlist = useMemo(() => {
    return watchlist.filter((item) => {
      const matchesCategory = activeFilter === 'ALL' || item.category === activeFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q) || item.token.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [watchlist, activeFilter, searchQuery]);

  const catalogSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const existingTokens = new Set(watchlist.map((w) => w.token));
    const q = searchQuery.toLowerCase();
    return SEARCH_CATALOG.filter((item) => !existingTokens.has(item.token) && (item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)));
  }, [searchQuery, watchlist]);

  const handleAddSymbol = (item: WatchlistItem) => {
    if (!watchlist.some((w) => w.token === item.token)) {
      setWatchlist((prev) => [item, ...prev]);
      setSearchQuery('');
    }
  };

  const handleRemoveSymbol = (tokenToRemove: string) => {
    setWatchlist((prev) => prev.filter((w) => w.token !== tokenToRemove));
  };

  const handleOpenOrder = (item: WatchlistItem, side: 'BUY' | 'SELL', ltp: number) => {
    setSelectedOrder({
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
    });
    setIsOrderModalOpen(true);
  };

  const handleConfirmOrder = async (confirmed: OrderPreviewDetails) => {
    setActionMsg({ type: 'success', text: `Order Executed! ${confirmed.side} ${confirmed.quantity} Qty of ${confirmed.symbol} @ ₹${confirmed.price.toFixed(2)}` });
    onRefreshWallet?.();
    setIsOrderModalOpen(false);
  };

  const columns: DataTableColumn<WatchlistItem>[] = [
    {
      key: 'symbol', header: 'Symbol', mobilePrimary: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20 flex items-center justify-center font-black text-xs flex-shrink-0">
            {item.symbol.substring(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs">{item.symbol}</span>
              <Badge variant="neutral">{item.exchange}</Badge>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] truncate">{item.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'ltp', header: 'LTP / Change', align: 'right',
      render: (item) => {
        const freshness = freshnessMap.get(item.token);
        const tick = freshness?.tick || ticks?.get(item.token);
        const ltp = tick ? tick.ltp : 0;
        const change = tick ? tick.change : 0;
        const changePercent = tick ? tick.changePercent : 0;
        const isPositive = change >= 0;
        return ltp > 0 ? (
          <div>
            <div className="font-bold text-sm num-font">₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className={`text-[11px] font-bold num-font ${isPositive ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
            </div>
          </div>
        ) : <span className="text-[var(--text-muted)]">—</span>;
      },
    },
    {
      key: 'highLow', header: 'High / Low', align: 'right', mobileHidden: true,
      render: (item) => {
        const tick = ticks?.get(item.token);
        return tick?.high && tick?.low ? (
          <div className="text-[11px] font-mono">
            <div className="text-[var(--gain)]">H: ₹{tick.high.toFixed(2)}</div>
            <div className="text-[var(--loss)]">L: ₹{tick.low.toFixed(2)}</div>
          </div>
        ) : <span className="text-[var(--text-muted)]">—</span>;
      },
    },
    {
      key: 'status', header: 'Status', align: 'center', mobileHidden: true,
      render: (item) => {
        const freshness = freshnessMap.get(item.token);
        return <PriceBadge state={freshness?.state || 'LIVE'} timeSinceLastTick={freshness?.timeSinceLastTick} size="sm" />;
      },
    },
    {
      key: 'actions', header: 'Actions', align: 'center', mobileHidden: true,
      render: (item) => <RowActions item={item} ticks={ticks} freshnessMap={freshnessMap} onOpenOrder={handleOpenOrder} onSelectSymbolForTerminal={onSelectSymbolForTerminal ? () => onSelectSymbolForTerminal(item.symbol, item.token, item.exchange) : undefined} onRemove={handleRemoveSymbol} />,
    },
  ];

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full font-body text-[var(--text-main)] pb-24 md:pb-0">
      <Card className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-5 h-5 text-[var(--primary)]" />
            <h1 className="text-xl font-black tracking-tight">Pro Watchlist</h1>
            <Badge variant="primary">{watchlist.length} Tracked</Badge>
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium mt-1">Real-time WebSocket tick stream & 1-click order execution.</p>
        </div>

        <div className="relative w-full md:w-80">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol to track..."
              className="w-full pl-10 pr-8 py-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl text-xs font-bold placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute right-2.5 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {catalogSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-11 z-30 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-[var(--shadow-xl)] p-2 max-h-60 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase text-[var(--text-muted)] px-3 py-1">Add to Watchlist</div>
              {catalogSuggestions.map((item) => (
                <button key={item.token} onClick={() => handleAddSymbol(item)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--primary-light)] text-left transition-colors">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">{item.symbol}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{item.name}</span>
                  </div>
                  <Badge variant="primary"><Plus size={11} className="inline" /> Add</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {actionMsg && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${actionMsg.type === 'success' ? 'bg-[var(--gain-light)] border-[var(--gain)]/30 text-[var(--gain)]' : 'bg-[var(--loss-light)] border-[var(--loss)]/30 text-[var(--loss)]'}`}>
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          ariaLabel="Watchlist filter"
          value={activeFilter}
          onChange={(v) => setActiveFilter(v as typeof activeFilter)}
          items={[
            { value: 'ALL', label: 'All' },
            { value: 'STOCKS', label: 'Stocks' },
            { value: 'FO', label: 'F&O' },
            { value: 'INDICES', label: 'Indices' },
            { value: 'COMMODITIES', label: 'Commodities' },
          ]}
        />
        <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={13} />} onClick={() => setWatchlist(DEFAULT_WATCHLIST)}>
          Reset Defaults
        </Button>
      </div>

      <Card padding="none" className="overflow-hidden">
        {filteredWatchlist.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Eye size={32} className="text-[var(--text-muted)] opacity-50" />
            <span className="text-sm font-bold text-[var(--text-muted)]">No symbols found matching filter</span>
            <Button size="sm" onClick={() => { setActiveFilter('ALL'); setSearchQuery(''); }}>Show All Tracked Symbols</Button>
          </div>
        ) : (
          <div className="p-3">
            <DataTable
              columns={columns}
              rows={filteredWatchlist}
              rowKey={(item) => item.token}
              onRowClick={onSelectSymbolForTerminal ? (item) => onSelectSymbolForTerminal(item.symbol, item.token, item.exchange) : undefined}
              renderMobileActions={(item) => <RowActions item={item} ticks={ticks} freshnessMap={freshnessMap} onOpenOrder={handleOpenOrder} onSelectSymbolForTerminal={undefined} onRemove={handleRemoveSymbol} compact />}
            />
          </div>
        )}
      </Card>

      {selectedOrder && (
        <OrderPreviewModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} details={selectedOrder} onConfirm={handleConfirmOrder} userToken={token || ''} riskRestriction={riskRestriction} />
      )}
    </div>
  );
};

function RowActions({
  item, ticks, freshnessMap, onOpenOrder, onSelectSymbolForTerminal, onRemove, compact,
}: {
  item: WatchlistItem;
  ticks: Map<string, MarketTick>;
  freshnessMap: Map<string, { tick?: MarketTick }>;
  onOpenOrder: (item: WatchlistItem, side: 'BUY' | 'SELL', ltp: number) => void;
  onSelectSymbolForTerminal?: () => void;
  onRemove: (token: string) => void;
  compact?: boolean;
}) {
  const freshness = freshnessMap.get(item.token);
  const tick = freshness?.tick || ticks?.get(item.token);
  const ltp = tick ? tick.ltp : 0;
  return (
    <div className={`flex items-center ${compact ? 'w-full justify-between' : 'justify-center'} gap-2`}>
      <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); onOpenOrder(item, 'BUY', ltp); }}>BUY</Button>
      <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); onOpenOrder(item, 'SELL', ltp); }}>SELL</Button>
      {onSelectSymbolForTerminal && (
        <Button variant="secondary" size="icon" onClick={(e) => { e.stopPropagation(); onSelectSymbolForTerminal(); }} aria-label="Open chart" title="Open chart">
          <TrendingUp size={13} />
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(item.token); }} aria-label="Remove from watchlist" title="Remove">
        <Trash2 size={13} className="text-[var(--loss)]" />
      </Button>
    </div>
  );
}
