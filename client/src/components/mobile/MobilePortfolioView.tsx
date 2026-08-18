import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowUp, ArrowDown, ChevronLeft, Briefcase, Zap, ShieldCheck, ShieldAlert, 
  RefreshCw, Target, AlertTriangle, X, History, Search, SlidersHorizontal, 
  MoreVertical, CheckCircle2, ChevronUp, ChevronDown, Clock, Layers, TrendingUp 
} from 'lucide-react';
import { MarketTick, Wallet, Holding } from '../../types';
import { useSubscribeTokens, useMarketSocket } from '../../hooks/useMarketSocket';

interface MobilePortfolioViewProps {
  ticks?: Map<string, MarketTick>;
  token?: string | null;
  wallet?: Wallet | null;
  onBack?: () => void;
  onSelectStock?: (symbol: string, name: string, price: number) => void;
  onOpenOptionChain?: (symbol: string) => void;
}

export const MobilePortfolioView: React.FC<MobilePortfolioViewProps> = ({
  ticks: propsTicks,
  token,
  wallet,
  onBack,
  onSelectStock,
  onOpenOptionChain,
}) => {
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());

  // Top toggle: Orders vs Positions
  const [topTab, setTopTab] = useState<'POSITIONS' | 'ORDERS'>('POSITIONS');
  
  // Internal filter
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('OPEN');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isTotalExpanded, setIsTotalExpanded] = useState<boolean>(false);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);

  // Modals & Drawers
  const [selectedPosDetail, setSelectedPosDetail] = useState<any | null>(null);
  const [squareOffModalPos, setSquareOffModalPos] = useState<any | null>(null);
  const [isExitAllModalOpen, setIsExitAllModalOpen] = useState<boolean>(false);
  const [targetModalPos, setTargetModalPos] = useState<any | null>(null);
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [targetPriceError, setTargetPriceError] = useState<string | null>(null);
  const [isTargetConfirmStep, setIsTargetConfirmStep] = useState<boolean>(false);
  const [editingTargetOrder, setEditingTargetOrder] = useState<any | null>(null);
  const [cancelTargetModalOrder, setCancelTargetModalOrder] = useState<any | null>(null);
  const [isSubmittingExit, setIsSubmittingExit] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to indices tokens for top ticker strip
  const INDEX_TOKENS = ['NSE_NIFTY50', 'BSE_SENSEX', 'NSE_BANKNIFTY'];
  useSubscribeTokens(INDEX_TOKENS);

  const fetchPortfolio = async () => {
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    const headers = { Authorization: `Bearer ${userToken}` };

    await Promise.allSettled([
      fetch('/api/v1/portfolio/holdings', { headers })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.holdings)) setHoldings(data.holdings);
        }),
      fetch('/api/v1/portfolio/positions?todayOnly=true', { headers })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.positions)) setPositions(data.positions);
        }),
      fetch('/api/v1/portfolio/closed-trades?todayOnly=true', { headers })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.closedTrades)) setClosedTrades(data.closedTrades);
        }),
      fetch('/api/v1/orders?todayOnly=true', { headers })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.orders)) setOrders(data.orders);
        })
    ]);
  };

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 2500);
    return () => clearInterval(interval);
  }, [token]);

  const getLiveLtp = (item: any): number => {
    const sym = item.symbol || '';
    const instToken = item.instrumentToken || item.instrument_token || '';
    const avgPrice = parseFloat(item.averagePrice || item.average_price || 0);

    let tick = instToken ? ticks?.get(instToken) : undefined;
    if (!tick && sym) {
      tick = ticks?.get(sym) || ticks?.get(`NSE_${sym}`) || ticks?.get(`NFO_${sym}`) || ticks?.get(`BFO_${sym}`);
    }

    if (tick && tick.ltp > 0) return tick.ltp;
    if (item.ltp && parseFloat(item.ltp) > 0) return parseFloat(item.ltp);
    return avgPrice;
  };

  const getActiveTargetOrder = (pos: any) => {
    const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
    if (netQty === 0) return null;
    const targetSide = netQty > 0 ? 'SELL' : 'BUY';

    return orders.find(o =>
      (o.status === 'ACCEPTED' || o.status === 'PENDING') &&
      o.symbol === pos.symbol &&
      o.side === targetSide &&
      (o.orderType === 'LIMIT' || o.order_type === 'LIMIT')
    );
  };

  // Open Positions & Calculations
  const openPositions = useMemo(() => {
    return positions.filter(pos => {
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      return netQty !== 0;
    });
  }, [positions]);

  const filteredPositions = useMemo(() => {
    let list = positionFilter === 'OPEN' ? openPositions : (positionFilter === 'CLOSED' ? closedTrades : [...openPositions, ...closedTrades]);
    if (searchQuery.trim()) {
      list = list.filter((p: any) => (p.symbol || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return list;
  }, [positionFilter, openPositions, closedTrades, searchQuery]);

  const positionsPnl = useMemo(() => {
    return openPositions.reduce((acc, pos) => {
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      const absQty = Math.abs(netQty);
      const avgPrice = parseFloat(pos.averagePrice || pos.average_price || 0);
      const ltp = getLiveLtp(pos);
      const uPnl = netQty > 0 ? (ltp - avgPrice) * netQty : absQty * (avgPrice - ltp);
      const rPnl = parseFloat(pos.realizedPnl || pos.realized_pnl || 0);
      return acc + uPnl + rPnl;
    }, 0);
  }, [openPositions, ticks]);

  const closedTradesPnl = useMemo(() => {
    return closedTrades.reduce((acc, ct) => acc + parseFloat(ct.netPnl || ct.realizedPnl || 0), 0);
  }, [closedTrades]);

  const totalCombinedPnl = positionsPnl + closedTradesPnl;

  // Single Square Off
  const confirmSquareOff = async () => {
    if (!squareOffModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    navigator.vibrate?.(40);

    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    try {
      const pos = squareOffModalPos;
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const livePrice = getLiveLtp(pos);

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
          exchange: pos.exchange || 'NSE',
          symbol: pos.symbol,
          side,
          quantity,
          price: livePrice,
          orderType: 'MARKET',
          productType: pos.productType || pos.product_type || 'MIS'
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: `Square Off MARKET order placed for ${pos.symbol}` });
        fetchPortfolio();
      } else {
        setActionMessage({ type: 'error', text: `Square Off failed: ${data.error?.message}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setSquareOffModalPos(null);
      setSelectedPosDetail(null);
    }
  };

  // Bulk Exit (Secure Exit)
  const confirmExitAll = async () => {
    if (isSubmittingExit || openPositions.length === 0) return;
    setIsSubmittingExit(true);
    navigator.vibrate?.(50);

    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    try {
      for (const pos of openPositions) {
        const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
        const side = netQty > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(netQty);
        const livePrice = getLiveLtp(pos);

        await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`
          },
          body: JSON.stringify({
            instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
            exchange: pos.exchange || 'NSE',
            symbol: pos.symbol,
            side,
            quantity,
            price: livePrice,
            orderType: 'MARKET',
            productType: pos.productType || pos.product_type || 'MIS'
          })
        });
      }
      setActionMessage({ type: 'success', text: `Successfully placed square off orders for all ${openPositions.length} positions` });
      fetchPortfolio();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Bulk exit error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setIsExitAllModalOpen(false);
    }
  };

  // Target Handlers
  const handleOpenSetTargetModal = (pos: any, existingOrder?: any) => {
    navigator.vibrate?.(20);
    setTargetModalPos(pos);
    setEditingTargetOrder(existingOrder || null);
    setTargetPrice(existingOrder ? (existingOrder.price || '').toString() : '');
    setTargetPriceError(null);
    setIsTargetConfirmStep(false);
    setSelectedPosDetail(null);
  };

  const handleProceedToTargetConfirm = () => {
    if (!targetModalPos) return;
    const priceNum = parseFloat(targetPrice);

    if (isNaN(priceNum) || priceNum <= 0) {
      setTargetPriceError('Please enter a valid target price.');
      return;
    }

    const cents = Math.round(priceNum * 100);
    if (cents % 5 !== 0) {
      setTargetPriceError('Target price must be in ₹0.05 tick increments.');
      return;
    }

    const netQty = targetModalPos.netQty !== undefined ? targetModalPos.netQty : (targetModalPos.net_qty !== undefined ? parseInt(targetModalPos.net_qty, 10) : ((targetModalPos.buyQty || 0) - (targetModalPos.sellQty || 0)));
    const liveLtp = getLiveLtp(targetModalPos);
    const avgPrice = parseFloat(targetModalPos.averagePrice || targetModalPos.average_price || liveLtp);

    if (netQty > 0 && priceNum <= Math.min(avgPrice, liveLtp)) {
      setTargetPriceError(`Target price for LONG position must be above entry/LTP (₹${liveLtp.toFixed(2)}).`);
      return;
    }

    if (netQty < 0 && priceNum >= Math.max(avgPrice, liveLtp)) {
      setTargetPriceError(`Target price for SHORT position must be below entry/LTP (₹${liveLtp.toFixed(2)}).`);
      return;
    }

    setTargetPriceError(null);
    setIsTargetConfirmStep(true);
  };

  const confirmPlaceTargetOrder = async () => {
    if (!targetModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    navigator.vibrate?.(40);

    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    try {
      const pos = targetModalPos;
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const priceNum = parseFloat(targetPrice);

      if (editingTargetOrder) {
        const res = await fetch(`/api/v1/orders/${editingTargetOrder.orderId || editingTargetOrder.id || editingTargetOrder.order_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`
          },
          body: JSON.stringify({ price: priceNum, quantity })
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({ type: 'success', text: `Target order updated to ₹${priceNum.toFixed(2)}` });
          fetchPortfolio();
        }
      } else {
        const res = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`
          },
          body: JSON.stringify({
            instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
            exchange: pos.exchange || 'NSE',
            symbol: pos.symbol,
            side,
            quantity,
            price: priceNum,
            orderType: 'LIMIT',
            productType: pos.productType || pos.product_type || 'MIS'
          })
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({ type: 'success', text: `Target LIMIT order placed @ ₹${priceNum.toFixed(2)}` });
          fetchPortfolio();
        }
      }
    } catch (_) {
    } finally {
      setIsSubmittingExit(false);
      setTargetModalPos(null);
    }
  };

  const confirmCancelTargetOrder = async () => {
    if (!cancelTargetModalOrder) return;
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    try {
      const orderId = cancelTargetModalOrder.orderId || cancelTargetModalOrder.id || cancelTargetModalOrder.order_id;
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: 'Target LIMIT order cancelled.' });
        fetchPortfolio();
      }
    } catch (_) {
    } finally {
      setCancelTargetModalOrder(null);
    }
  };

  // Helper for index LTP
  const niftyTick = ticks?.get('NSE_NIFTY50') || ticks?.get('NIFTY50');
  const sensexTick = ticks?.get('BSE_SENSEX') || ticks?.get('SENSEX');
  const bankNiftyTick = ticks?.get('NSE_BANKNIFTY') || ticks?.get('BANKNIFTY');

  return (
    <div className="space-y-2.5 font-body text-[var(--text-main)] w-full max-w-full pb-24">
      
      {/* ── 1. ANGEL ONE TOP NAVIGATION HEADER ── */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-3 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(15);
              setTopTab('ORDERS');
            }}
            className={`text-base tracking-tight font-extrabold cursor-pointer transition-colors ${
              topTab === 'ORDERS' ? 'text-[var(--text-main)] font-black' : 'text-[var(--text-muted)] font-bold hover:text-[var(--text-main)]'
            }`}
          >
            Orders
          </button>

          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(15);
              setTopTab('POSITIONS');
            }}
            className={`text-base tracking-tight font-extrabold cursor-pointer transition-colors relative ${
              topTab === 'POSITIONS' ? 'text-[var(--text-main)] font-black' : 'text-[var(--text-muted)] font-bold hover:text-[var(--text-main)]'
            }`}
          >
            Positions
            {topTab === 'POSITIONS' && (
              <span className="absolute -bottom-2.5 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
          >
            <Search className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={() => fetchPortfolio()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 2. ANGEL ONE SUB-TICKER STRIP (NIFTY / SENSEX / BANKNIFTY) ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none px-3 py-1">
        {/* NIFTY */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 min-w-[130px] flex-shrink-0 shadow-xs">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] font-black text-[var(--text-main)]">NIFTY</span>
            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] px-1 py-0.2 rounded font-mono font-bold">Expiry Tue</span>
          </div>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-[11px] font-black text-[var(--text-main)] tabular-nums">
              {niftyTick ? niftyTick.ltp.toFixed(2) : '24,154.90'}
            </span>
            <span className={`text-[9px] font-bold ${niftyTick && niftyTick.change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {niftyTick ? `${niftyTick.change > 0 ? '+' : ''}${niftyTick.change.toFixed(2)} (${niftyTick.changePercent.toFixed(2)}%)` : '+0.42%'}
            </span>
          </div>
        </div>

        {/* SENSEX */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 min-w-[130px] flex-shrink-0 shadow-xs">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] font-black text-[var(--text-main)]">SENSEX</span>
            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] px-1 py-0.2 rounded font-mono font-bold">Expiry Thu</span>
          </div>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-[11px] font-black text-[var(--text-main)] tabular-nums">
              {sensexTick ? sensexTick.ltp.toFixed(2) : '81,254.30'}
            </span>
            <span className={`text-[9px] font-bold ${sensexTick && sensexTick.change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {sensexTick ? `${sensexTick.change > 0 ? '+' : ''}${sensexTick.change.toFixed(2)} (${sensexTick.changePercent.toFixed(2)}%)` : '+0.38%'}
            </span>
          </div>
        </div>

        {/* BANK NIFTY */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 min-w-[130px] flex-shrink-0 shadow-xs">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] font-black text-[var(--text-main)]">BANK NIFTY</span>
            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)] px-1 py-0.2 rounded font-mono font-bold">Expiry Wed</span>
          </div>
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-[11px] font-black text-[var(--text-main)] tabular-nums">
              {bankNiftyTick ? bankNiftyTick.ltp.toFixed(2) : '52,150.75'}
            </span>
            <span className={`text-[9px] font-bold ${bankNiftyTick && bankNiftyTick.change < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {bankNiftyTick ? `${bankNiftyTick.change > 0 ? '+' : ''}${bankNiftyTick.change.toFixed(2)} (${bankNiftyTick.changePercent.toFixed(2)}%)` : '-0.15%'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. ANGEL ONE SUB-ACTION & FILTER ROW ── */}
      <div className="px-3 py-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(15);
              setPositionFilter(prev => prev === 'OPEN' ? 'ALL' : (prev === 'ALL' ? 'CLOSED' : 'OPEN'));
            }}
            className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            title="Toggle Filter"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
            <span className="text-[11px] font-extrabold uppercase font-mono">{positionFilter} ({filteredPositions.length})</span>
          </button>
        </div>

        {openPositions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(25);
              setIsExitAllModalOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider hover:opacity-80 transition-opacity cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>SECURE EXIT</span>
          </button>
        )}
      </div>

      {/* Search Input if toggled */}
      {isSearchOpen && (
        <div className="px-3">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search positions..."
              className="w-full pl-8 pr-8 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 text-[var(--text-muted)]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Notification Alert */}
      {actionMessage && (
        <div className="px-3">
          <div className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-between ${
            actionMessage.type === 'success' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
          }`}>
            <span>{actionMessage.text}</span>
            <button type="button" onClick={() => setActionMessage(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── 4. ANGEL ONE POSITION LIST CARDS ── */}
      {topTab === 'POSITIONS' && (
        <div className="bg-[var(--bg-surface)] border-y sm:border sm:rounded-2xl border-[var(--border-color)] divide-y divide-[var(--border-color)] shadow-xs">
          {filteredPositions.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Briefcase className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
              <h3 className="text-xs font-bold text-[var(--text-main)]">No Positions Found</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Your open intraday trading positions will appear here.</p>
            </div>
          ) : (
            filteredPositions.map((pos: any) => {
              const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
              const absQty = Math.abs(netQty);
              const isClosed = netQty === 0;
              const avgPrice = parseFloat(pos.averagePrice || pos.average_price || pos.entryPrice || 0);
              const ltp = isClosed ? parseFloat(pos.exitPrice || 0) : getLiveLtp(pos);
              const uPnl = isClosed ? parseFloat(pos.netPnl || pos.realizedPnl || 0) : (netQty > 0 ? (ltp - avgPrice) * netQty : absQty * (avgPrice - ltp));
              const isGain = uPnl >= 0;
              const pnlPct = avgPrice > 0 ? ((ltp - avgPrice) / avgPrice) * 100 : 0;
              const activeTarget = getActiveTargetOrder(pos);

              return (
                <div
                  key={pos.id || pos.symbol || pos.executionId}
                  onClick={() => {
                    navigator.vibrate?.(20);
                    setSelectedPosDetail(pos);
                  }}
                  className="p-3.5 hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer active:scale-[0.99] space-y-1.5"
                >
                  {/* ── ROW 1: Symbol Name & Large P&L ── */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-extrabold text-[13px] text-[var(--text-main)] tracking-tight truncate leading-tight">
                        {pos.symbol}
                      </h3>
                      {activeTarget && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold font-mono border border-emerald-500/20">
                          TGT ₹{parseFloat(activeTarget.price).toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className={`font-mono text-sm font-black tabular-nums whitespace-nowrap ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isGain ? '+' : ''}₹{uPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* ── ROW 2: Lot / Qty + Product & Live LTP + % Change ── */}
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <div className="text-[var(--text-muted)] flex items-center gap-1.5">
                      <span className="font-bold text-[var(--text-main)]">{absQty} {absQty > 50 ? 'Qty' : 'Lot'}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">{pos.productType || 'CF'}</span>
                    </div>

                    <div className="tabular-nums">
                      <span className="text-[var(--text-muted)]">LTP </span>
                      <span className="font-bold text-[var(--text-main)]">₹{ltp.toFixed(2)} </span>
                      <span className={`font-bold ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* ── ROW 3: Buy Price & Sell Price / Target ── */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] pt-0.5">
                    <div>
                      <span>Buy </span>
                      <span className="font-bold text-[var(--text-main)]">₹{avgPrice.toFixed(2)}</span>
                    </div>

                    <div>
                      <span>Sell </span>
                      <span className="font-bold text-[var(--text-main)]">₹{isClosed ? ltp.toFixed(2) : (activeTarget ? parseFloat(activeTarget.price).toFixed(2) : ltp.toFixed(2))}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── 5. ORDERS TAB (When User Taps "Orders" in Header) ── */}
      {topTab === 'ORDERS' && (
        <div className="bg-[var(--bg-surface)] border-y sm:border sm:rounded-2xl border-[var(--border-color)] divide-y divide-[var(--border-color)] shadow-xs">
          {orders.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Clock className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-40" />
              <h3 className="text-xs font-bold text-[var(--text-main)]">No Orders Today</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Orders placed during the current trading session will appear here.</p>
            </div>
          ) : (
            orders.map(order => {
              const isBuy = (order.side || '').toUpperCase() === 'BUY';
              const isFilled = (order.status || '').toUpperCase() === 'FILLED' || (order.status || '').toUpperCase() === 'COMPLETED';
              const isPending = (order.status || '').toUpperCase() === 'ACCEPTED' || (order.status || '').toUpperCase() === 'PENDING';

              return (
                <div key={order.orderId || order.id} className="p-3.5 space-y-1.5 font-mono">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.2 rounded font-black text-[9px] ${isBuy ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
                        {order.side}
                      </span>
                      <h4 className="font-extrabold text-xs text-[var(--text-main)]">{order.symbol}</h4>
                    </div>

                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      isFilled ? 'bg-emerald-500/10 text-emerald-600' : isPending ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <div>
                      <span>{order.quantity} Qty • </span>
                      <span className="font-bold text-[var(--text-main)]">{order.orderType || 'MARKET'}</span>
                    </div>
                    <div>
                      <span>Price: </span>
                      <span className="font-black text-[var(--text-main)]">₹{parseFloat(order.price || order.averagePrice || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── 6. ANGEL ONE STICKY BOTTOM TOTAL P&L BAR (Above Navigation) ── */}
      {topTab === 'POSITIONS' && (
        <div className="fixed bottom-15 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-color)] px-4 py-2.5 flex items-center justify-between shadow-lg">
          <button
            type="button"
            onClick={() => setIsTotalExpanded(!isTotalExpanded)}
            className="flex items-center gap-1.5 cursor-pointer text-left"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
            <span className="text-xs font-black text-[var(--text-main)]">Total P&L</span>
            {isTotalExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>

          <div className="flex items-center gap-2">
            <div className={`font-mono text-sm font-black tabular-nums ${totalCombinedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {totalCombinedPnl >= 0 ? '+' : ''}₹{totalCombinedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Expandable Breakdown Drawer for Total P&L */}
      {isTotalExpanded && (
        <div className="fixed bottom-28 left-3 right-3 z-40 bg-[var(--bg-surface)] border border-[var(--border-color)] p-3 rounded-2xl shadow-2xl space-y-1.5 font-mono text-xs animate-in slide-in-from-bottom duration-150">
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Unrealized Positions P&L:</span>
            <strong className={positionsPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {positionsPnl >= 0 ? '+' : ''}₹{positionsPnl.toFixed(2)}
            </strong>
          </div>
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>Realized Closed P&L:</span>
            <strong className={closedTradesPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {closedTradesPnl >= 0 ? '+' : ''}₹{closedTradesPnl.toFixed(2)}
            </strong>
          </div>
          <div className="flex justify-between border-t border-[var(--border-color)] pt-1 font-bold text-[var(--text-main)]">
            <span>Total Combined Today:</span>
            <strong className={totalCombinedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
              {totalCombinedPnl >= 0 ? '+' : ''}₹{totalCombinedPnl.toFixed(2)}
            </strong>
          </div>
        </div>
      )}

      {/* ── 7. ANGEL ONE POSITION ACTION BOTTOM SHEET ── */}
      {selectedPosDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[var(--bg-surface)] border-t border-[var(--border-color)] rounded-t-2xl p-4 max-w-md w-full shadow-2xl space-y-3 font-body pb-8">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-sm font-black text-[var(--text-main)]">{selectedPosDetail.symbol}</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">Product: {selectedPosDetail.productType || 'MIS'}</p>
              </div>
              <button onClick={() => setSelectedPosDetail(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const targetOrder = getActiveTargetOrder(selectedPosDetail);
                  handleOpenSetTargetModal(selectedPosDetail, targetOrder);
                }}
                className="py-2.5 px-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-bold text-xs text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <Target className="w-4 h-4" />
                <span>{getActiveTargetOrder(selectedPosDetail) ? 'Modify Target' : 'Set Target'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSquareOffModalPos(selectedPosDetail);
                  setSelectedPosDetail(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform shadow-xs"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Square Off</span>
              </button>
            </div>

            {/* Chart & Option Chain Links */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPosDetail(null);
                  onSelectStock?.(selectedPosDetail.symbol, selectedPosDetail.symbol, getLiveLtp(selectedPosDetail));
                }}
                className="py-2 px-3 rounded-xl bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>View Chart</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedPosDetail(null);
                  onOpenOptionChain?.(selectedPosDetail.symbol);
                }}
                className="py-2 px-3 rounded-xl bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Option Chain</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. SECURE EXIT ALL MODAL ── */}
      {isExitAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4.5 max-w-md w-full shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
                <AlertTriangle className="text-rose-500 w-4 h-4" /> Exit All Open Positions?
              </h3>
              <button type="button" onClick={() => setIsExitAllModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] font-sans">
              This will place immediate MARKET exit orders for all <strong>{openPositions.length}</strong> active intraday positions.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsExitAllModalOpen(false)}
                className="px-4 py-2.5 bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-bold rounded-xl text-xs flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmExitAll}
                disabled={isSubmittingExit}
                className="px-5 py-2.5 bg-rose-600 text-white font-black rounded-xl text-xs flex-1 shadow-lg active:scale-95"
              >
                {isSubmittingExit ? 'Exiting...' : 'Confirm Exit All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. SINGLE SQUARE OFF MODAL ── */}
      {squareOffModalPos && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4.5 max-w-md w-full shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
                <AlertTriangle className="text-amber-500 w-4 h-4" /> Square Off Position?
              </h3>
              <button type="button" onClick={() => setSquareOffModalPos(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Symbol:</span>
                <strong className="text-[var(--text-main)]">{squareOffModalPos.symbol}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Current LTP:</span>
                <strong className="text-emerald-500">₹{getLiveLtp(squareOffModalPos).toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Order:</span>
                <strong className="text-rose-500">MARKET EXIT</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSquareOffModalPos(null)}
                className="px-4 py-2.5 bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-bold rounded-xl text-xs flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSquareOff}
                disabled={isSubmittingExit}
                className="px-5 py-2.5 bg-rose-600 text-white font-black rounded-xl text-xs flex-1 shadow-lg active:scale-95"
              >
                {isSubmittingExit ? 'Exiting...' : 'Confirm Square Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 10. SET TARGET MODAL ── */}
      {targetModalPos && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4.5 max-w-md w-full shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-2">
                <Target className="text-indigo-500 w-4 h-4" />
                {isTargetConfirmStep ? 'Confirm Target Order' : `Set Target — ${targetModalPos.symbol}`}
              </h3>
              <button type="button" onClick={() => setTargetModalPos(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const liveLtp = getLiveLtp(targetModalPos);
              return (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Target Price (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={targetPrice}
                    onChange={(e) => {
                      setTargetPrice(e.target.value);
                      setTargetPriceError(null);
                    }}
                    placeholder={`Current LTP: ₹${liveLtp.toFixed(2)}`}
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-sm font-bold text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
                  />
                  {targetPriceError && (
                    <p className="text-xs text-rose-500 font-bold mt-1">{targetPriceError}</p>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button type="button" onClick={() => setTargetModalPos(null)} className="px-4 py-2.5 bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-bold rounded-xl text-xs flex-1">
                Cancel
              </button>
              <button type="button" onClick={confirmPlaceTargetOrder} disabled={isSubmittingExit} className="px-5 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-xs flex-1 shadow-lg active:scale-95">
                {isSubmittingExit ? 'Placing...' : 'Place Target'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
