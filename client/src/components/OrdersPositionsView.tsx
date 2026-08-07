import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Filter, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Zap, PieChart, Layers, DollarSign } from 'lucide-react';
import { useMarketSocket, useSubscribeTokens } from '../hooks/useMarketSocket';

interface OrdersPositionsViewProps {
  token: string;
  initialTab?: 'ORDERS' | 'POSITIONS' | 'HOLDINGS';
  onRefreshWallet?: () => void;
}

export const OrdersPositionsView: React.FC<OrdersPositionsViewProps> = ({ token, initialTab = 'ORDERS', onRefreshWallet }) => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'POSITIONS' | 'HOLDINGS'>(initialTab);
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'ACCEPTED' | 'FILLED' | 'CANCELLED' | 'REJECTED'>('ALL');
  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const [positionStatusFilter, setPositionStatusFilter] = useState<'OPEN' | 'CLOSED' | 'ALL'>('OPEN');

  const fetchData = () => {
    setLoading(true);
    fetch('/api/v1/orders?todayOnly=true', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.orders)) setOrders(data.orders);
      });

    fetch('/api/v1/portfolio/positions', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.positions)) {
          setPositions(data.positions);
        }
      });

    fetch('/api/v1/portfolio/holdings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.holdings)) setHoldings(data.holdings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Order ${orderId} cancelled.`);
        fetchData();
        if (onRefreshWallet) onRefreshWallet();
      } else {
        setActionMessage(`Cancel failed: ${data.error?.message}`);
      }
    } catch (err: any) {
      setActionMessage(`Cancel error: ${err.message}`);
    }
  };

  const handleSquareOffPosition = async (pos: any) => {
    try {
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      if (netQty === 0) return;

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
        setActionMessage(`Square-off order submitted for ${pos.symbol}`);
        fetchData();
        if (onRefreshWallet) onRefreshWallet();
      } else {
        setActionMessage(`Square-off failed: ${data.error?.message}`);
      }
    } catch (err: any) {
      setActionMessage(`Square-off error: ${err.message}`);
    }
  };

  const isTodayOrder = (o: any) => {
    const ts = o.created_at || o.createdAt;
    if (!ts) return true;
    const d = new Date(ts);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
  };

  const filteredOrders = orders
    .filter(isTodayOrder)
    .filter(o => orderFilter === 'ALL' || o.status === orderFilter);

  // Split positions into open vs closed
  const openPositions = positions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    return qty !== 0;
  });

  const closedPositions = positions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    return qty === 0;
  });

  const filteredPositions = positions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    if (positionStatusFilter === 'OPEN') return qty !== 0;
    if (positionStatusFilter === 'CLOSED') return qty === 0;
    return true;
  });

  // Real-time Position & Holding Summary Aggregates
  const totalUnrealizedPnl = openPositions.reduce((acc, p) => {
    const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
    const ltp = getLiveLtp(p);
    const uPnl = netQty > 0 ? (ltp - avgPrice) * netQty : Math.abs(netQty) * (avgPrice - ltp);
    return acc + uPnl;
  }, 0);

  const totalRealizedPnl = positions.reduce((acc, p) => {
    return acc + parseFloat(p.realizedPnl || p.realized_pnl || 0);
  }, 0);

  const totalPositionPnl = totalUnrealizedPnl + totalRealizedPnl;

  const totalHoldingValue = holdings.reduce((acc, h) => acc + ((h.quantity || 0) * getLiveLtp(h)), 0);
  const totalHoldingCost = holdings.reduce((acc, h) => acc + ((h.quantity || 0) * (parseFloat(h.averagePrice || h.average_price || 0))), 0);
  const totalHoldingPnl = totalHoldingValue - totalHoldingCost;
  const holdingReturnPct = totalHoldingCost > 0 ? ((totalHoldingPnl / totalHoldingCost) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      {/* TOOLBAR & TAB SWITCHER */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeTab === 'ORDERS' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <Clock className="w-3.5 h-3.5" /> Orders Book ({orders.filter(isTodayOrder).length})
            </button>
            <button
              onClick={() => setActiveTab('POSITIONS')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeTab === 'POSITIONS' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Positions ({openPositions.length} Open / {closedPositions.length} Closed)
            </button>
            <button
              onClick={() => setActiveTab('HOLDINGS')}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeTab === 'HOLDINGS' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <PieChart className="w-3.5 h-3.5 text-purple-500" /> Demat Holdings ({holdings.length})
            </button>
          </div>

          {activeTab === 'ORDERS' && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] px-2 py-1 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)] mr-1" />
              {(['ALL', 'ACCEPTED', 'FILLED', 'CANCELLED', 'REJECTED'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setOrderFilter(f)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold ${
                    orderFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'POSITIONS' && (
            <div className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] px-2 py-1 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)] mr-1" />
              {(['OPEN', 'CLOSED', 'ALL'] as const).map(pf => (
                <button
                  key={pf}
                  onClick={() => setPositionStatusFilter(pf)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold ${
                    positionStatusFilter === pf ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
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
          className="bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs font-bold px-3.5 py-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {actionMessage && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs p-3.5 rounded-xl flex items-center justify-between font-bold">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold">✕</button>
        </div>
      )}

      {/* SUMMARY BANNER FOR POSITIONS / HOLDINGS */}
      {activeTab === 'POSITIONS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Net Positions P&L</span>
            <span className={`text-xl font-extrabold num-font block mt-1 ${totalPositionPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalPositionPnl >= 0 ? '+' : ''}₹{totalPositionPnl.toFixed(2)}
            </span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Unrealized P&L (Open)</span>
            <span className={`text-xl font-extrabold num-font block mt-1 ${totalUnrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}₹{totalUnrealizedPnl.toFixed(2)}
            </span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Realized P&L (Booked)</span>
            <span className={`text-xl font-extrabold num-font block mt-1 ${totalRealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalRealizedPnl >= 0 ? '+' : ''}₹{totalRealizedPnl.toFixed(2)}
            </span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Active Contracts</span>
            <span className="text-xl font-extrabold num-font text-[var(--text-main)] block mt-1">{openPositions.length} Open | {closedPositions.length} Closed</span>
          </div>
        </div>
      )}

      {activeTab === 'HOLDINGS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Current Portfolio Value</span>
            <span className="text-xl font-extrabold num-font text-[var(--text-main)] block mt-1">₹{totalHoldingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Total Invested</span>
            <span className="text-xl font-extrabold num-font text-[var(--text-muted)] block mt-1">₹{totalHoldingCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Total Return (₹)</span>
            <span className={`text-xl font-extrabold num-font block mt-1 ${totalHoldingPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalHoldingPnl >= 0 ? '+' : ''}₹{totalHoldingPnl.toFixed(2)}
            </span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Total Return (%)</span>
            <span className={`text-xl font-extrabold num-font block mt-1 ${holdingReturnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {holdingReturnPct >= 0 ? '+' : ''}{holdingReturnPct.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* MAIN TABLE CONTAINER */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl overflow-hidden flex-1 overflow-y-auto shadow-sm">
        {/* 1. ORDERS BOOK TABLE */}
        {activeTab === 'ORDERS' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] uppercase text-[10px] sticky top-0 border-b border-[var(--border-color)] font-extrabold">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Exchange</th>
                <th className="py-3 px-4">Side</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4 text-right">Price (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)] num-font">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-[var(--text-tertiary)] font-sans">No orders found matching criteria.</td>
                </tr>
              ) : (
                filteredOrders.map(o => (
                  <tr key={o.id || o.order_id} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                    <td className="py-3 px-4 text-[var(--text-tertiary)] text-[11px]">{o.order_id || o.id}</td>
                    <td className="py-3 px-4 font-sans font-extrabold text-[var(--text-main)] text-sm">{o.symbol}</td>
                    <td className="py-3 px-4"><span className="bg-[var(--bg-surface-elevated)] text-indigo-500 font-sans text-[10px] px-2 py-0.5 rounded-md font-bold border border-[var(--border-color)]">{o.exchange || 'NSE'}</span></td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold font-sans uppercase ${o.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'}`}>
                        {o.side}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[var(--text-main)]">{o.quantity}</td>
                    <td className="py-3 px-4 text-[var(--text-muted)] font-sans text-[11px]">{o.order_type || o.orderType}</td>
                    <td className="py-3 px-4 text-[var(--text-muted)] font-sans text-[11px]">{o.product_type || o.productType || 'MIS'}</td>
                    <td className="py-3 px-4 text-right text-emerald-500 font-bold">₹{parseFloat(o.price || 0) > 0 ? parseFloat(o.price).toFixed(2) : 'MKT'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-sans uppercase ${
                        o.status === 'FILLED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        o.status === 'ACCEPTED' || o.status === 'PENDING' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                        'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-color)]'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] text-[11px]">{new Date(o.created_at || Date.now()).toLocaleTimeString()}</td>
                    <td className="py-3 px-4 text-right">
                      {(o.status === 'ACCEPTED' || o.status === 'PENDING') && (
                        <button
                          onClick={() => handleCancelOrder(o.order_id || o.id)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold px-3 py-1 rounded-lg transition-all"
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
        )}

        {/* 2. POSITIONS TABLE */}
        {activeTab === 'POSITIONS' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] uppercase text-[10px] sticky top-0 border-b border-[var(--border-color)] font-extrabold">
              <tr>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4 text-right">Net Qty</th>
                <th className="py-3 px-4 text-right">Avg Price (₹)</th>
                <th className="py-3 px-4 text-right">LTP / Exit (₹)</th>
                <th className="py-3 px-4 text-right">Unrealized P&L (₹)</th>
                <th className="py-3 px-4 text-right">Realized P&L (₹)</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)] num-font">
              {filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[var(--text-tertiary)] font-sans">No {positionStatusFilter.toLowerCase()} positions in portfolio.</td>
                </tr>
              ) : (
                filteredPositions.map(p => {
                  const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
                  const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
                  const ltp = getLiveLtp(p);
                  const unrealizedPnl = netQty > 0 ? (ltp - avgPrice) * netQty : netQty < 0 ? Math.abs(netQty) * (avgPrice - ltp) : 0;
                  const realizedPnl = parseFloat(p.realizedPnl || p.realized_pnl || 0);

                  return (
                    <tr key={p.id || p.symbol} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                      <td className="py-3 px-4 font-sans font-extrabold text-[var(--text-main)] text-sm">
                        {p.symbol}
                        {netQty === 0 && (
                          <span className="ml-2 text-[9px] font-sans font-extrabold bg-slate-500/10 text-slate-400 px-1.5 py-0.5 rounded border border-slate-500/20">
                            CLOSED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4"><span className="bg-[var(--bg-surface-elevated)] text-amber-500 font-sans text-[10px] px-2 py-0.5 rounded-md font-bold border border-[var(--border-color)]">{p.productType || p.product_type || 'MIS'}</span></td>
                      <td className={`py-3 px-4 text-right font-bold ${netQty > 0 ? 'text-emerald-500' : (netQty < 0 ? 'text-rose-500' : 'text-[var(--text-muted)]')}`}>
                        {netQty > 0 ? `+${netQty}` : netQty}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--text-main)]">₹{avgPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--text-main)]">₹{ltp.toFixed(2)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${unrealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {netQty !== 0 ? `${unrealizedPnl >= 0 ? '+' : ''}₹${unrealizedPnl.toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${realizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {realizedPnl !== 0 ? `${realizedPnl >= 0 ? '+' : ''}₹${realizedPnl.toFixed(2)}` : '₹0.00'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {netQty !== 0 ? (
                          <button
                            onClick={() => handleSquareOffPosition(p)}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-3 py-1 rounded-lg transition-all shadow-md shadow-rose-600/20"
                          >
                            Square Off
                          </button>
                        ) : (
                          <span className="bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-[var(--border-color)] font-sans uppercase">
                            Squared Off
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* 3. HOLDINGS TABLE */}
        {activeTab === 'HOLDINGS' && (
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] uppercase text-[10px] sticky top-0 border-b border-[var(--border-color)] font-extrabold">
              <tr>
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4 text-right">Qty</th>
                <th className="py-3 px-4 text-right">Avg Cost (₹)</th>
                <th className="py-3 px-4 text-right">Current Price (₹)</th>
                <th className="py-3 px-4 text-right">Current Value (₹)</th>
                <th className="py-3 px-4 text-right">P&L (₹)</th>
                <th className="py-3 px-4 text-right">Return (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)] num-font">
              {holdings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--text-tertiary)] font-sans">No demat holdings in portfolio.</td>
                </tr>
              ) : (
                holdings.map(h => {
                  const qty = h.quantity || 0;
                  const avgPrice = h.averagePrice || h.average_price || 0;
                  const curPrice = h.currentPrice || h.ltp || avgPrice;
                  const invested = qty * avgPrice;
                  const curValue = qty * curPrice;
                  const pnl = h.pnl ?? (curValue - invested);
                  const returnPct = invested > 0 ? (pnl / invested) * 100 : 0;
                  return (
                    <tr key={h.id || h.symbol} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                      <td className="py-3 px-4 font-sans font-extrabold text-[var(--text-main)] text-sm">{h.symbol}</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--text-main)]">{qty}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-main)]">₹{avgPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-500">₹{curPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-[var(--text-main)] font-bold">₹{curValue.toFixed(2)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${returnPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
