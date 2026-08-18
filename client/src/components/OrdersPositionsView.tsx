import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Filter, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Zap, PieChart, DollarSign, Search, MoreVertical, Sliders, ShieldCheck, Check, ArrowUpRight, ArrowDownRight, ShieldAlert, AlertTriangle, Target, X, History } from 'lucide-react';
import { useMarketSocket, useSubscribeTokens } from '../hooks/useMarketSocket';

interface OrdersPositionsViewProps {
  token: string;
  initialTab?: 'ORDERS' | 'POSITIONS' | 'HOLDINGS' | 'CLOSED_TRADES';
  onRefreshWallet?: () => void;
}

export const OrdersPositionsView: React.FC<OrdersPositionsViewProps> = ({ token, initialTab = 'POSITIONS', onRefreshWallet }) => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'POSITIONS' | 'HOLDINGS' | 'CLOSED_TRADES'>(initialTab);
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'ACCEPTED' | 'FILLED' | 'CANCELLED' | 'REJECTED'>('ALL');
  const [positionStatusFilter, setPositionStatusFilter] = useState<'OPEN' | 'CLOSED' | 'ALL'>('ALL');

  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States for Position Exits & Target Orders
  const [squareOffModalPos, setSquareOffModalPos] = useState<any | null>(null);
  const [targetModalPos, setTargetModalPos] = useState<any | null>(null);
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [targetPriceError, setTargetPriceError] = useState<string | null>(null);
  const [isTargetConfirmStep, setIsTargetConfirmStep] = useState<boolean>(false);
  const [editingTargetOrder, setEditingTargetOrder] = useState<any | null>(null);
  const [cancelTargetModalOrder, setCancelTargetModalOrder] = useState<any | null>(null);
  const [isSubmittingExit, setIsSubmittingExit] = useState<boolean>(false);
  const [isExitAllModalOpen, setIsExitAllModalOpen] = useState<boolean>(false);

  // Subscribed tokens generation for real-time WebSocket ticks
  const subscribedTokens = useMemo(() => {
    const set = new Set<string>();
    positions.forEach(p => {
      const sym = p.symbol || '';
      if (p.instrumentToken) set.add(p.instrumentToken);
      if (p.instrument_token) set.add(p.instrument_token);
      if (sym) {
        set.add(sym);
        if (sym.includes('NIFTY')) {
          set.add(`NFO_${sym}`);
          const m = sym.match(/NIFTY(\d+)(CE|PE)/);
          if (m) set.add(`NFO_NIFTY_${m[1]}_${m[2]}`);
        } else if (sym.includes('SENSEX')) {
          set.add(`BFO_${sym}`);
          const m = sym.match(/SENSEX(\d+)(CE|PE)/);
          if (m) set.add(`BFO_SENSEX_${m[1]}_${m[2]}`);
        } else {
          set.add(`NSE_${sym}`);
        }
      }
    });
    holdings.forEach(h => {
      const sym = h.symbol || '';
      if (h.instrumentToken) set.add(h.instrumentToken);
      if (h.instrument_token) set.add(h.instrument_token);
      if (sym) {
        set.add(sym);
        set.add(`NSE_${sym}`);
      }
    });
    return Array.from(set);
  }, [positions, holdings]);

  const { ticks } = useMarketSocket();
  useSubscribeTokens(subscribedTokens);

  const getLiveLtp = (item: any): number => {
    const sym = item.symbol || '';
    const instToken = item.instrumentToken || item.instrument_token || '';
    const avgPrice = parseFloat(item.averagePrice || item.average_price || item.currentPrice || 0);

    let tick = instToken ? ticks.get(instToken) : undefined;
    if (!tick && sym) {
      tick = ticks.get(sym) || ticks.get(`NSE_${sym}`) || ticks.get(`NFO_${sym}`) || ticks.get(`BFO_${sym}`);
      if (!tick) {
        const mNifty = sym.match(/NIFTY(\d+)(CE|PE)/);
        if (mNifty) tick = ticks.get(`NFO_NIFTY_${mNifty[1]}_${mNifty[2]}`);
        const mSensex = sym.match(/SENSEX(\d+)(CE|PE)/);
        if (mSensex) tick = ticks.get(`BFO_SENSEX_${mSensex[1]}_${mSensex[2]}`);
      }
    }

    if (tick && tick.ltp > 0) return tick.ltp;
    if (item.ltp && parseFloat(item.ltp) > 0) return parseFloat(item.ltp);
    return avgPrice;
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);

    const headers = { Authorization: `Bearer ${token}` };

    await Promise.allSettled([
      fetch('/api/v1/orders?todayOnly=true', { headers })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.orders)) setOrders(data.orders);
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
      fetch('/api/v1/portfolio/holdings', { headers })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.success && Array.isArray(data.holdings)) setHoldings(data.holdings);
        })
    ]).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [token]);

  // Find active open target order for a position
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

  // 1. SQUARE OFF HANDLERS
  const handleOpenSquareOffModal = (pos: any) => {
    setSquareOffModalPos(pos);
  };

  const confirmSquareOff = async () => {
    if (!squareOffModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);

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
          Authorization: `Bearer ${token}`
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
        setActionMessage({
          type: 'success',
          text: `Square-off MARKET order executed for ${pos.symbol} (${quantity} qty) @ ₹${livePrice.toFixed(2)}`
        });
        fetchData();
        if (onRefreshWallet) onRefreshWallet();
      } else {
        setActionMessage({
          type: 'error',
          text: `Square-off rejected: ${data.error?.message || 'Unknown error'}`
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Square-off network error: ${err.message}`
      });
    } finally {
      setIsSubmittingExit(false);
      setSquareOffModalPos(null);
    }
  };

  const confirmExitAllPositions = async () => {
    if (openPositions.length === 0 || isSubmittingExit) return;
    setIsSubmittingExit(true);

    let successCount = 0;
    let failCount = 0;

    for (const pos of openPositions) {
      try {
        const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
        if (netQty === 0) continue;
        const side = netQty > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(netQty);
        const livePrice = getLiveLtp(pos);

        const res = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
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
          successCount++;
        } else {
          failCount++;
        }
      } catch (_) {
        failCount++;
      }
    }

    setIsSubmittingExit(false);
    setIsExitAllModalOpen(false);
    fetchData();
    if (onRefreshWallet) onRefreshWallet();

    if (failCount === 0) {
      setActionMessage({ type: 'success', text: `Successfully squared off all ${successCount} active positions.` });
    } else {
      setActionMessage({ type: 'error', text: `Squared off ${successCount} positions. ${failCount} positions encountered errors.` });
    }
  };

  // 2. SET TARGET HANDLERS
  const handleOpenSetTargetModal = (pos: any, existingTargetOrder?: any) => {
    setTargetModalPos(pos);
    setEditingTargetOrder(existingTargetOrder || null);
    setTargetPrice(existingTargetOrder ? (existingTargetOrder.price || '').toString() : '');
    setTargetPriceError(null);
    setIsTargetConfirmStep(false);
  };

  const handleProceedToTargetConfirm = () => {
    if (!targetModalPos) return;
    const priceNum = parseFloat(targetPrice);

    if (isNaN(priceNum) || priceNum <= 0) {
      setTargetPriceError('Please enter a valid target exit price.');
      return;
    }

    // Tick size validation (0.05 increments)
    const cents = Math.round(priceNum * 100);
    if (cents % 5 !== 0) {
      setTargetPriceError('Target price must be in ₹0.05 tick increments (e.g. ₹165.05).');
      return;
    }

    const netQty = targetModalPos.netQty !== undefined ? targetModalPos.netQty : (targetModalPos.net_qty !== undefined ? parseInt(targetModalPos.net_qty, 10) : ((targetModalPos.buyQty || 0) - (targetModalPos.sellQty || 0)));
    const liveLtp = getLiveLtp(targetModalPos);
    const avgPrice = parseFloat(targetModalPos.averagePrice || targetModalPos.average_price || liveLtp);

    // Price direction validation
    if (netQty > 0 && priceNum <= Math.min(avgPrice, liveLtp)) {
      setTargetPriceError(`For a LONG position, the target exit price (₹${priceNum.toFixed(2)}) must be above the entry/current price (₹${liveLtp.toFixed(2)}).`);
      return;
    }

    if (netQty < 0 && priceNum >= Math.max(avgPrice, liveLtp)) {
      setTargetPriceError(`For a SHORT position, the target exit price (₹${priceNum.toFixed(2)}) must be below the entry/current price (₹${liveLtp.toFixed(2)}).`);
      return;
    }

    setTargetPriceError(null);
    setIsTargetConfirmStep(true);
  };

  const confirmPlaceTargetOrder = async () => {
    if (!targetModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);

    try {
      const pos = targetModalPos;
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const priceNum = parseFloat(targetPrice);

      if (editingTargetOrder) {
        // Modify existing order
        const res = await fetch(`/api/v1/orders/${editingTargetOrder.orderId || editingTargetOrder.id || editingTargetOrder.order_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ price: priceNum, quantity })
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({
            type: 'success',
            text: `Target LIMIT order updated to ₹${priceNum.toFixed(2)} for ${pos.symbol}`
          });
          fetchData();
        } else {
          setActionMessage({ type: 'error', text: `Target modification failed: ${data.error?.message}` });
        }
      } else {
        // Submit new target order
        const res = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
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
          setActionMessage({
            type: 'success',
            text: `Target LIMIT exit order placed for ${pos.symbol} @ ₹${priceNum.toFixed(2)} (${quantity} qty)`
          });
          fetchData();
        } else {
          setActionMessage({ type: 'error', text: `Target placement failed: ${data.error?.message}` });
        }
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Target order error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setTargetModalPos(null);
      setIsTargetConfirmStep(false);
    }
  };

  // 3. CANCEL TARGET HANDLERS
  const confirmCancelTargetOrder = async () => {
    if (!cancelTargetModalOrder) return;
    try {
      const orderId = cancelTargetModalOrder.orderId || cancelTargetModalOrder.order_id || cancelTargetModalOrder.id;
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: `Target order for ${cancelTargetModalOrder.symbol} cancelled. Position remains open.`
        });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: `Failed to cancel target order: ${data.error?.message}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Error cancelling target order: ${err.message}` });
    } finally {
      setCancelTargetModalOrder(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: `Order ${orderId} cancelled.` });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: `Failed to cancel: ${data.error?.message}` });
      }
    } catch (_) {
      setActionMessage({ type: 'error', text: 'Failed to cancel order.' });
    }
  };

  const isTodayOrder = (o: any) => {
    if (!o.createdAt && !o.created_at) return true;
    const dt = new Date(o.createdAt || o.created_at);
    const today = new Date();
    return dt.getDate() === today.getDate() &&
           dt.getMonth() === today.getMonth() &&
           dt.getFullYear() === today.getFullYear();
  };

  const filteredOrders = orders
    .filter(isTodayOrder)
    .filter(o => orderFilter === 'ALL' || o.status === orderFilter);

  const openPositions = positions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    return qty !== 0;
  });

  const closedPositions = positions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    return qty === 0;
  });

  const sortedPositions = [...positions].sort((a, b) => {
    const qtyA = a.netQty !== undefined ? a.netQty : (a.net_qty !== undefined ? parseInt(a.net_qty, 10) : ((a.buyQty || 0) - (a.sellQty || 0)));
    const qtyB = b.netQty !== undefined ? b.netQty : (b.net_qty !== undefined ? parseInt(b.net_qty, 10) : ((b.buyQty || 0) - (b.sellQty || 0)));
    if (qtyA !== 0 && qtyB === 0) return -1;
    if (qtyA === 0 && qtyB !== 0) return 1;
    return 0;
  });

  const filteredPositions = sortedPositions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    if (positionStatusFilter === 'OPEN') return qty !== 0;
    if (positionStatusFilter === 'CLOSED') return qty === 0;
    return true;
  });

  const totalUnrealizedPnl = openPositions.reduce((acc, p) => {
    const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
    const ltp = getLiveLtp(p);
    const uPnl = netQty > 0 ? (ltp - avgPrice) * netQty : Math.abs(netQty) * (avgPrice - ltp);
    return acc + uPnl;
  }, 0);

  const totalRealizedPnl = closedTrades.reduce((acc, ct) => acc + (ct.netPnl || 0), 0) +
    positions.reduce((acc, p) => acc + parseFloat(p.realizedPnl || p.realized_pnl || 0), 0);

  const totalPositionPnl = totalUnrealizedPnl + totalRealizedPnl;

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pb-28 font-body text-slate-100 select-none">
      
      {/* REAL-TIME PORTFOLIO SUMMARY CARD */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-md backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Portfolio P&L Today</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div className="flex items-baseline gap-3 mt-1 font-mono">
            <span className={`text-3xl font-black ${totalPositionPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPositionPnl >= 0 ? '+' : ''}₹{totalPositionPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 font-bold">
              (Unrealized: ₹{totalUnrealizedPnl.toFixed(2)} | Realized: ₹{totalRealizedPnl.toFixed(2)})
            </span>
          </div>
        </div>

        {openPositions.length > 0 && (
          <button
            onClick={() => setIsExitAllModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-rose-950/40 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 min-h-[44px]"
          >
            <ShieldAlert size={15} /> EXIT ALL POSITIONS ({openPositions.length})
          </button>
        )}
      </div>

      {/* DESKTOP TOOLBAR & TAB SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('POSITIONS')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer min-h-[44px] ${
                activeTab === 'POSITIONS' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Positions ({openPositions.length} Open)
            </button>
            <button
              onClick={() => setActiveTab('CLOSED_TRADES')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer min-h-[44px] ${
                activeTab === 'CLOSED_TRADES' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" /> Trade History ({closedTrades.length} Closed)
            </button>
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer min-h-[44px] ${
                activeTab === 'ORDERS' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Orders ({orders.filter(isTodayOrder).length})
            </button>
            <button
              onClick={() => setActiveTab('HOLDINGS')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer min-h-[44px] ${
                activeTab === 'HOLDINGS' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" /> Holdings ({holdings.length})
            </button>
          </div>

          {activeTab === 'POSITIONS' && (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
              {(['ALL', 'OPEN', 'CLOSED'] as const).map(pf => (
                <button
                  key={pf}
                  onClick={() => setPositionStatusFilter(pf)}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-[11px] font-bold cursor-pointer min-h-[36px] ${
                    positionStatusFilter === pf ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {pf === 'OPEN' ? `Open (${openPositions.length})` : pf === 'CLOSED' ? `Closed (${closedPositions.length})` : `All (${positions.length})`}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={fetchData}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {actionMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-bold border flex items-center justify-between ${
          actionMessage.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white font-bold cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN CONTENT TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-md flex-1 backdrop-blur-xl">
        
        {/* 1. POSITIONS LIST */}
        {activeTab === 'POSITIONS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-bold font-mono">
                <tr>
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Net Qty</th>
                  <th className="py-3 px-4 text-right">Avg Price (₹)</th>
                  <th className="py-3 px-4 text-right">Live LTP (₹)</th>
                  <th className="py-3 px-4 text-right">Unrealized P&L</th>
                  <th className="py-3 px-4 text-right">Realized P&L</th>
                  <th className="py-3 px-4 text-center">Active Target</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 num-font">
                {filteredPositions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">No positions found in account.</td>
                  </tr>
                ) : (
                  filteredPositions.map(p => {
                    const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
                    const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
                    const ltp = getLiveLtp(p);
                    const unrealizedPnl = netQty > 0 ? (ltp - avgPrice) * netQty : netQty < 0 ? Math.abs(netQty) * (avgPrice - ltp) : 0;
                    const realizedPnl = parseFloat(p.realizedPnl || p.realized_pnl || 0);
                    const activeTarget = getActiveTargetOrder(p);

                    return (
                      <tr key={p.id || p.symbol} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-white text-sm">
                          {p.symbol}
                          {netQty === 0 && (
                            <span className="ml-2 text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                              CLOSED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-950 text-indigo-400 text-[10px] px-2 py-0.5 rounded font-bold border border-slate-800">
                            {p.productType || p.product_type || 'MIS'}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${netQty > 0 ? 'text-emerald-400' : (netQty < 0 ? 'text-rose-400' : 'text-slate-400')}`}>
                          {netQty > 0 ? `+${netQty}` : netQty}
                        </td>
                        <td className="py-3 px-4 text-right text-white">₹{avgPrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-white">₹{ltp.toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right font-bold ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {netQty !== 0 ? `${unrealizedPnl >= 0 ? '+' : ''}₹${unrealizedPnl.toFixed(2)}` : '₹0.00'}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${realizedPnl > 0 ? 'text-emerald-400' : (realizedPnl < 0 ? 'text-rose-400' : 'text-slate-400')}`}>
                          {realizedPnl !== 0 ? `${realizedPnl > 0 ? '+' : ''}₹${realizedPnl.toFixed(2)}` : '₹0.00'}
                        </td>
                        
                        {/* Active Target Indicator Column */}
                        <td className="py-3 px-4 text-center">
                          {activeTarget ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Target ₹{parseFloat(activeTarget.price).toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCancelTargetModalOrder(activeTarget)}
                                className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                                title="Cancel Target Order"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono font-semibold">No Target</span>
                          )}
                        </td>

                        {/* Dual Action Buttons: Set Target & Square Off */}
                        <td className="py-3 px-4 text-right">
                          {netQty !== 0 ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenSetTargetModal(p, activeTarget)}
                                className="bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-cyan-500/30 transition-all cursor-pointer shadow-sm flex items-center gap-1 min-h-[38px]"
                              >
                                <Target className="w-3.5 h-3.5" />
                                {activeTarget ? 'Modify Target' : 'Set Target'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenSquareOffModal(p)}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 min-h-[38px]"
                              >
                                Square Off
                              </button>
                            </div>
                          ) : (
                            <span className="bg-slate-950 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-800 uppercase">
                              Closed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. CLOSED TRADES & TRADE HISTORY VIEW */}
        {activeTab === 'CLOSED_TRADES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-bold font-mono">
                <tr>
                  <th className="py-3 px-4">Closed Time</th>
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Direction</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Entry Price (₹)</th>
                  <th className="py-3 px-4 text-right">Exit Price (₹)</th>
                  <th className="py-3 px-4 text-right">Realized P&L (₹)</th>
                  <th className="py-3 px-4 text-center">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 num-font">
                {closedTrades.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                      No closed trades recorded for today.
                    </td>
                  </tr>
                ) : (
                  closedTrades.map(ct => {
                    const isProfit = (ct.netPnl || 0) >= 0;
                    return (
                      <tr key={ct.id || ct.executionId} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {ct.closedAt ? new Date(ct.closedAt).toLocaleTimeString() : 'Today'}
                        </td>
                        <td className="py-3 px-4 font-bold text-white text-sm">{ct.symbol}</td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-950 text-indigo-400 text-[10px] px-2 py-0.5 rounded font-bold border border-slate-800">
                            {ct.productType || 'MIS'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-300">
                          <span className={ct.entrySide === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>{ct.entrySide}</span> → <span className={ct.exitSide === 'SELL' ? 'text-rose-400' : 'text-emerald-400'}>{ct.exitSide}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">{ct.quantity}</td>
                        <td className="py-3 px-4 text-right text-white">₹{parseFloat(ct.entryPrice || 0).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-white font-bold">₹{parseFloat(ct.exitPrice || 0).toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right font-black text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}₹{parseFloat(ct.netPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                            ct.exitReason === 'TARGET_LIMIT' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                            ct.exitReason === 'MARKET_SQUARE_OFF' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                          }`}>
                            {ct.exitReason ? ct.exitReason.replace('_', ' ') : 'SQUARE OFF'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. ORDERS BOOK VIEW */}
        {activeTab === 'ORDERS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-bold font-mono">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Side</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Price (₹)</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 num-font">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                      No orders recorded for today.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr key={o.id || o.order_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-400">
                        {o.createdAt || o.created_at ? new Date(o.createdAt || o.created_at).toLocaleTimeString() : 'Today'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{o.orderId || o.order_id || o.id?.slice(0, 8)}</td>
                      <td className="py-3 px-4 font-bold text-white">{o.symbol}</td>
                      <td className="py-3 px-4">
                        <span className={`font-black text-xs px-2 py-0.5 rounded ${o.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {o.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">{o.quantity}</td>
                      <td className="py-3 px-4 text-right text-white">₹{parseFloat(o.price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4"><span className="bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-800 text-[10px]">{o.orderType || o.order_type || 'MARKET'}</span></td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          o.status === 'FILLED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          o.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          o.status === 'CANCELLED' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(o.status === 'ACCEPTED' || o.status === 'PENDING') && (
                          <button
                            onClick={() => handleCancelOrder(o.id || o.order_id)}
                            className="text-xs text-rose-400 hover:underline font-bold cursor-pointer min-h-[36px]"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. HOLDINGS LIST */}
        {activeTab === 'HOLDINGS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800 font-bold font-mono">
                <tr>
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Avg Price (₹)</th>
                  <th className="py-3 px-4 text-right">Current Value (₹)</th>
                  <th className="py-3 px-4 text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 num-font">
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-xs">No demat holdings in portfolio.</td>
                  </tr>
                ) : (
                  holdings.map(h => (
                    <tr key={h.id || h.symbol} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-white text-sm">{h.symbol}</td>
                      <td className="py-3 px-4 text-right text-white font-bold">{h.quantity}</td>
                      <td className="py-3 px-4 text-right text-white">₹{parseFloat(h.averagePrice || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-white font-bold">₹{parseFloat(h.currentValue || 0).toFixed(2)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.pnl >= 0 ? '+' : ''}₹{parseFloat(h.pnl || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── MODAL 1: SQUARE OFF CONFIRMATION MODAL ───────────────────────── */}
      {squareOffModalPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <AlertTriangle className="text-amber-400 w-5 h-5" /> Square Off Position?
              </h3>
              <button type="button" onClick={() => setSquareOffModalPos(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const pos = squareOffModalPos;
              const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
              const absQty = Math.abs(netQty);
              const liveLtp = getLiveLtp(pos);
              const exitSide = netQty > 0 ? 'SELL' : 'BUY';
              const estimatedExitVal = liveLtp * absQty;

              return (
                <>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Instrument:</span>
                      <span className="font-bold text-white text-sm">{pos.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <span className="font-bold text-emerald-400">{absQty} Units ({exitSide})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current LTP:</span>
                      <span className="font-bold text-white">₹{liveLtp.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Exit Order Type:</span>
                      <span className="font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">MARKET</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                      <span className="text-slate-300">Estimated Exit Value:</span>
                      <span className="text-cyan-300 font-mono text-sm">₹{estimatedExitVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-[11px] text-amber-300 font-sans leading-relaxed">
                    ⚠️ You are about to exit this position using a <strong>MARKET</strong> order. The actual execution price will come from the exchange fill and may differ from the currently displayed LTP.
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSquareOffModalPos(null)}
                      disabled={isSubmittingExit}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmSquareOff}
                      disabled={isSubmittingExit}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 min-h-[44px]"
                    >
                      {isSubmittingExit ? 'Submitting Exit...' : 'Confirm Square Off'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL 2: SET TARGET MODAL (Step 1: Price Input / Step 2: Confirmation) ──────── */}
      {targetModalPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Target className="text-cyan-400 w-5 h-5" />
                {isTargetConfirmStep ? 'Confirm Target Exit Order' : `Set Target — ${targetModalPos.symbol}`}
              </h3>
              <button type="button" onClick={() => { setTargetModalPos(null); setIsTargetConfirmStep(false); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const pos = targetModalPos;
              const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
              const absQty = Math.abs(netQty);
              const liveLtp = getLiveLtp(pos);
              const avgPrice = parseFloat(pos.averagePrice || pos.average_price || liveLtp);
              const exitSide = netQty > 0 ? 'SELL' : 'BUY';
              const targetPriceNum = parseFloat(targetPrice || '0');
              const estTargetPnl = netQty > 0
                ? (targetPriceNum - avgPrice) * absQty
                : (avgPrice - targetPriceNum) * absQty;

              if (!isTargetConfirmStep) {
                // Step 1: Input Price & Validate
                return (
                  <>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current LTP:</span>
                        <span className="text-cyan-300 font-bold">₹{liveLtp.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Average Entry Price:</span>
                        <span className="text-white font-bold">₹{avgPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Position Quantity:</span>
                        <span className={`font-bold ${netQty > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {netQty > 0 ? `+${absQty}` : `-${absQty}`} Units
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Target Exit Side:</span>
                        <span className="font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          {exitSide} LIMIT
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Target Exit Price (₹) <span className="text-slate-400 font-normal">(0.05 tick size)</span>
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        value={targetPrice}
                        onChange={(e) => {
                          setTargetPrice(e.target.value);
                          setTargetPriceError(null);
                        }}
                        placeholder={netQty > 0 ? `Above ₹${liveLtp.toFixed(2)} (e.g. 165.00)` : `Below ₹${liveLtp.toFixed(2)} (e.g. 140.00)`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
                      />
                      {targetPriceError && (
                        <p className="text-xs text-rose-400 font-bold mt-1.5">{targetPriceError}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setTargetModalPos(null)}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleProceedToTargetConfirm}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-lg min-h-[44px]"
                      >
                        Proceed to Confirmation
                      </button>
                    </div>
                  </>
                );
              }

              // Step 2: Final Confirmation
              return (
                <>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Instrument:</span>
                      <span className="font-bold text-white">{pos.symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Action & Type:</span>
                      <span className="font-black text-emerald-400">{exitSide} LIMIT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <span className="font-bold text-white">{absQty} Units</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Target Price:</span>
                      <span className="font-black text-cyan-300 text-sm">₹{targetPriceNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current LTP:</span>
                      <span className="font-bold text-white">₹{liveLtp.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                      <span className="text-slate-300">Estimated Target P&L:</span>
                      <span className={`text-sm ${estTargetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {estTargetPnl >= 0 ? '+' : ''}₹{estTargetPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-xl text-[11px] text-cyan-300 font-sans leading-relaxed">
                    ℹ️ Placing a target order will submit a real LIMIT exit order to the exchange. Your position will automatically close when the target limit price is hit.
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsTargetConfirmStep(false)}
                      disabled={isSubmittingExit}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs min-h-[44px]"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={confirmPlaceTargetOrder}
                      disabled={isSubmittingExit}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 min-h-[44px]"
                    >
                      {isSubmittingExit ? 'Placing Target...' : 'Place Target Order'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL 3: CANCEL TARGET CONFIRMATION MODAL ────────────────────── */}
      {cancelTargetModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <AlertTriangle className="text-rose-400 w-5 h-5" /> Cancel Target Order?
              </h3>
              <button type="button" onClick={() => setCancelTargetModalOrder(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Instrument:</span>
                <span className="font-bold text-white">{cancelTargetModalOrder.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Order Side & Type:</span>
                <span className="font-bold text-rose-400">{cancelTargetModalOrder.side} LIMIT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Price:</span>
                <span className="font-bold text-cyan-300">₹{parseFloat(cancelTargetModalOrder.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quantity:</span>
                <span className="font-bold text-white">{cancelTargetModalOrder.quantity} Units</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Cancelling the target order will remove the exit limit order from the order book. Your underlying position will remain <strong>OPEN</strong>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelTargetModalOrder(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs min-h-[44px]"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={confirmCancelTargetOrder}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs shadow-lg cursor-pointer min-h-[44px]"
              >
                Cancel Target Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: EXIT ALL POSITIONS CONFIRMATION MODAL ────────────────── */}
      {isExitAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <ShieldAlert className="text-rose-500 w-5 h-5" /> Exit All Open Positions?
              </h3>
              <button type="button" onClick={() => setIsExitAllModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Open Positions:</span>
                <span className="font-bold text-white text-sm">{openPositions.length} Positions</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Unrealized P&L:</span>
                <span className={`font-bold ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalUnrealizedPnl >= 0 ? '+' : ''}₹{totalUnrealizedPnl.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Exit Method:</span>
                <span className="font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                  MARKET ORDER (ALL)
                </span>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-[11px] text-rose-300 font-sans leading-relaxed">
              ⚠️ This will send immediate MARKET square-off orders for all <strong>{openPositions.length}</strong> open positions. This action cannot be reversed.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExitAllModalOpen(false)}
                disabled={isSubmittingExit}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmExitAllPositions}
                disabled={isSubmittingExit}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 min-h-[44px]"
              >
                {isSubmittingExit ? 'Exiting All...' : 'Confirm Exit All'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
