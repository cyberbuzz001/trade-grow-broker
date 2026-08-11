import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Filter, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Zap, PieChart, Layers, DollarSign, Search, MoreVertical, Sliders, ShieldCheck, Check, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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

  const [positionStatusFilter, setPositionStatusFilter] = useState<'OPEN' | 'CLOSED' | 'ALL'>('ALL');

  const fetchData = () => {
    setLoading(true);
    fetch('/api/v1/orders?todayOnly=true', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.orders)) setOrders(data.orders);
      });

    fetch('/api/v1/portfolio/positions?todayOnly=true', { headers: { Authorization: `Bearer ${token}` } })
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

  const handleClearOldPositions = () => {
    setLoading(true);
    fetch('/api/v1/portfolio/positions/clear', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.positions)) {
          setPositions(data.positions);
          setActionMessage("Cleared yesterday's positions.");
          setTimeout(() => setActionMessage(null), 3000);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
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
      } else {
        setActionMessage(`Failed to cancel: ${data.error?.message || 'Unknown'}`);
      }
    } catch (_) {
      setActionMessage('Failed to cancel order.');
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

  // Split positions into open vs closed
  const openPositions = positions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    return qty !== 0;
  });

  const closedPositions = positions.filter((p: any) => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    return qty === 0;
  });

  // Sort positions so OPEN positions are on top, CLOSED positions are on bottom
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

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 pb-28 select-none">
      
      {/* ------------------------------------------------------------ */}
      {/* DESKTOP TOOLBAR & TAB SWITCHER */}
      {/* ------------------------------------------------------------ */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-sm font-headline">
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
              {(['ALL', 'OPEN', 'CLOSED'] as const).map(pf => (
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

        <div className="flex items-center gap-2">
          {activeTab === 'POSITIONS' && (
            <button
              onClick={handleClearOldPositions}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold px-3 py-2 rounded-xl border border-rose-500/30 flex items-center gap-1.5 transition-all"
              title="Clear old positions from previous days"
            >
              Clear Yesterday's Positions
            </button>
          )}
          <button
            onClick={fetchData}
            className="bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs font-bold px-3.5 py-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* MOBILE TOP NAVIGATION HEADER & INDEX TICKER STRIP */}
      {/* ------------------------------------------------------------ */}
      <div className="md:hidden bg-[#0D1117] text-white -mx-2 -mt-2 p-3 border-b border-[#1C2128]">
        
        {/* Mobile Header Title */}
        <div className="flex items-center justify-between mb-3 font-headline">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`text-lg font-extrabold ${activeTab === 'ORDERS' ? 'text-white border-b-2 border-[#00E676] pb-0.5' : 'text-[#8B949E]'}`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab('POSITIONS')}
              className={`text-lg font-extrabold ${activeTab === 'POSITIONS' ? 'text-white border-b-2 border-[#00E676] pb-0.5' : 'text-[#8B949E]'}`}
            >
              Positions
            </button>
          </div>

          <div className="flex items-center gap-3 text-[#8B949E]">
            <Search className="w-5 h-5" />
            <MoreVertical className="w-5 h-5" />
          </div>
        </div>

        {/* Horizontal Mini Index Ticker Strip */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none py-1">
          <div className="bg-[#161B22] border border-[#30363D] px-3 py-1.5 rounded-xl flex items-center gap-2 flex-shrink-0 text-xs font-label">
            <span className="font-bold text-white">SENSEX</span>
            <span className="bg-[#00E676]/10 text-[#00E676] text-[9px] font-bold px-1.5 py-0.5 rounded">Expiry Tomorrow</span>
            <span className="text-[#FF5252] font-bold tabular-nums">76,884.72 (-0.76%)</span>
          </div>

          <div className="bg-[#161B22] border border-[#30363D] px-3 py-1.5 rounded-xl flex items-center gap-2 flex-shrink-0 text-xs font-label">
            <span className="font-bold text-white">NIFTY</span>
            <span className="bg-purple-500/10 text-purple-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Expiry Tue</span>
            <span className="text-[#FF5252] font-bold tabular-nums">24,024.35 (-0.68%)</span>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between pt-3 text-xs font-headline">
          <div className="flex items-center gap-3 text-[#8B949E]">
            <Sliders className="w-4 h-4" />
            <Search className="w-4 h-4" />
          </div>

          <button className="text-[#8B949E] hover:text-white text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#00E676]" /> SECURE EXIT
          </button>
        </div>

      </div>

      {actionMessage && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs p-3.5 rounded-xl flex items-center justify-between font-bold">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold">✕</button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-sm flex-1">
        
        {/* ============================================================ */}
        {/* 1. ORDERS BOOK VIEW (FIXED: RENDERS BOTH DESKTOP & MOBILE) */}
        {/* ============================================================ */}
        {activeTab === 'ORDERS' && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0D1117] text-[#8B949E] uppercase text-[10px] sticky top-0 border-b border-[#30363D] font-extrabold font-headline">
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
                <tbody className="divide-y divide-[#30363D] font-label tabular-nums">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-[#8B949E] font-body">
                        No orders recorded today.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(o => (
                      <tr key={o.id || o.order_id} className="hover:bg-[#1C2128] transition-colors">
                        <td className="py-3 px-4 text-[#8B949E]">
                          {o.createdAt || o.created_at ? new Date(o.createdAt || o.created_at).toLocaleTimeString() : 'Today'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">{o.orderId || o.order_id || o.id?.slice(0, 8)}</td>
                        <td className="py-3 px-4 font-headline font-bold text-white">{o.symbol}</td>
                        <td className="py-3 px-4">
                          <span className={`font-black text-xs px-2 py-0.5 rounded ${o.side === 'BUY' ? 'bg-[#00E676]/20 text-[#00E676]' : 'bg-[#FF5252]/20 text-[#FF5252]'}`}>
                            {o.side}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">{o.quantity}</td>
                        <td className="py-3 px-4 text-right text-white">₹{parseFloat(o.price || 0).toFixed(2)}</td>
                        <td className="py-3 px-4"><span className="bg-[#0D1117] text-[#8B949E] px-2 py-0.5 rounded border border-[#30363D]">{o.orderType || o.order_type || 'MARKET'}</span></td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            o.status === 'FILLED' ? 'bg-[#00E676]/20 text-[#00E676]' :
                            o.status === 'REJECTED' ? 'bg-[#FF5252]/20 text-[#FF5252]' :
                            o.status === 'CANCELLED' ? 'bg-slate-500/20 text-slate-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(o.status === 'ACCEPTED' || o.status === 'PENDING') && (
                            <button
                              onClick={() => handleCancelOrder(o.id || o.order_id)}
                              className="text-xs text-[#FF5252] hover:underline font-bold"
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

            {/* Mobile Order Cards View */}
            <div className="md:hidden flex flex-col divide-y divide-[#30363D]/40 bg-[#0D1117]">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-[#8B949E] text-xs font-body">No orders recorded today.</div>
              ) : (
                filteredOrders.map(o => (
                  <div key={o.id || o.order_id} className="p-4 flex flex-col gap-2 bg-[#161B22] border-b border-[#30363D]/40">
                    <div className="flex items-center justify-between font-headline">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-black text-xs ${
                          o.side === 'BUY' ? 'bg-[#00E676]/20 text-[#00E676]' : 'bg-[#FF5252]/20 text-[#FF5252]'
                        }`}>
                          {o.side}
                        </span>
                        <span className="font-bold text-sm text-white">{o.symbol}</span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        o.status === 'FILLED' ? 'bg-[#00E676]/20 text-[#00E676]' :
                        o.status === 'REJECTED' ? 'bg-[#FF5252]/20 text-[#FF5252]' :
                        o.status === 'CANCELLED' ? 'bg-slate-500/20 text-slate-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-label text-[#8B949E] pt-1">
                      <div>Qty: <strong className="text-white">{o.quantity}</strong> ({o.productType || o.product_type || 'MIS'})</div>
                      <div className="tabular-nums">Price: <strong className="text-white">₹{parseFloat(o.price || 0).toFixed(2)}</strong></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#8B949E] pt-1 border-t border-[#30363D]/30 font-mono">
                      <span>ID: #{o.orderId || o.order_id || o.id?.slice(0, 8)}</span>
                      <span>{o.createdAt || o.created_at ? new Date(o.createdAt || o.created_at).toLocaleTimeString() : 'Today'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* 2. POSITIONS LIST */}
        {/* ============================================================ */}
        {activeTab === 'POSITIONS' && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0D1117] text-[#8B949E] uppercase text-[10px] sticky top-0 border-b border-[#30363D] font-extrabold font-headline">
                  <tr>
                    <th className="py-3 px-4">Instrument</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4 text-right">Net Qty</th>
                    <th className="py-3 px-4 text-right">Avg Price (₹)</th>
                    <th className="py-3 px-4 text-right">Live LTP (₹)</th>
                    <th className="py-3 px-4 text-right">Unrealized P&L</th>
                    <th className="py-3 px-4 text-right">Realized P&L</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363D] font-label tabular-nums">
                  {filteredPositions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[#8B949E] font-body">No positions found.</td>
                    </tr>
                  ) : (
                    filteredPositions.map(p => {
                      const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
                      const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
                      const ltp = getLiveLtp(p);
                      const unrealizedPnl = netQty > 0 ? (ltp - avgPrice) * netQty : netQty < 0 ? Math.abs(netQty) * (avgPrice - ltp) : 0;
                      const realizedPnl = parseFloat(p.realizedPnl || p.realized_pnl || 0);

                      return (
                        <tr key={p.id || p.symbol} className="hover:bg-[#1C2128] transition-colors">
                          <td className="py-3 px-4 font-headline font-bold text-white text-sm">
                            {p.symbol}
                            {netQty === 0 && (
                              <span className="ml-2 text-[9px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded border border-slate-500/20 font-mono">
                                CLOSED
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4"><span className="bg-[#0D1117] text-amber-500 text-[10px] px-2 py-0.5 rounded font-bold border border-[#30363D]">{p.productType || p.product_type || 'MIS'}</span></td>
                          <td className={`py-3 px-4 text-right font-bold ${netQty > 0 ? 'text-[#00E676]' : (netQty < 0 ? 'text-[#FF5252]' : 'text-[#8B949E]')}`}>
                            {netQty > 0 ? `+${netQty}` : netQty}
                          </td>
                          <td className="py-3 px-4 text-right text-white">₹{avgPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-bold text-white">₹{ltp.toFixed(2)}</td>
                          <td className={`py-3 px-4 text-right font-bold ${unrealizedPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                            {netQty !== 0 ? `${unrealizedPnl >= 0 ? '+' : ''}₹${unrealizedPnl.toFixed(2)}` : '₹0.00'}
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${realizedPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                            {realizedPnl !== 0 ? `${realizedPnl >= 0 ? '+' : ''}₹${realizedPnl.toFixed(2)}` : '₹0.00'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {netQty !== 0 ? (
                              <button
                                onClick={() => handleSquareOffPosition(p)}
                                className="bg-[#FF5252] hover:bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded transition-all shadow-sm"
                              >
                                Square Off
                              </button>
                            ) : (
                              <span className="bg-[#0D1117] text-[#8B949E] text-[10px] font-bold px-2.5 py-1 rounded border border-[#30363D] uppercase">
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
            </div>

            {/* Mobile Positions List (Dark Open / Light Closed) */}
            <div className="md:hidden flex flex-col divide-y divide-[#30363D]/40 bg-[#0D1117]">
              {filteredPositions.length === 0 ? (
                <div className="text-center py-12 text-[#8B949E] text-xs">No positions in portfolio.</div>
              ) : (
                filteredPositions.map(p => {
                  const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
                  const isOpen = netQty !== 0;
                  const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
                  const ltp = getLiveLtp(p);
                  const unrealizedPnl = netQty > 0 ? (ltp - avgPrice) * netQty : Math.abs(netQty) * (avgPrice - ltp);
                  const realizedPnl = parseFloat(p.realizedPnl || p.realized_pnl || 0);
                  const displayPnl = isOpen ? unrealizedPnl : realizedPnl;
                  const isGain = displayPnl >= 0;

                  const buyAvg = parseFloat(p.buyAvgPrice || p.buy_price || avgPrice);
                  const sellAvg = parseFloat(p.sellAvgPrice || p.sell_price || (isOpen ? ltp : avgPrice));

                  return (
                    <div
                      key={p.id || p.symbol}
                      className={`p-4 flex flex-col gap-1.5 transition-all ${
                        isOpen
                          ? 'bg-[#161B22] border-l-4 border-l-[#00E676] shadow-sm'
                          : 'bg-[#161B22]/40 opacity-60 border-l-2 border-l-slate-600'
                      }`}
                    >
                      {/* Line 1: Symbol Name & Total P&L */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`font-headline font-bold text-sm tracking-tight ${
                            isOpen ? 'text-white font-extrabold' : 'text-slate-400 font-semibold'
                          }`}>
                            {p.symbol}
                          </span>
                          {!isOpen && (
                            <span className="text-[9px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded font-extrabold font-mono">
                              CLOSED
                            </span>
                          )}
                        </div>

                        <div className={`font-label font-bold text-sm tabular-nums ${
                          isOpen
                            ? (isGain ? 'text-[#00E676]' : 'text-[#FF5252]')
                            : (isGain ? 'text-[#00E676]/70' : 'text-[#FF5252]/70')
                        }`}>
                          {isGain ? '+' : ''}₹{displayPnl.toFixed(2)}
                        </div>
                      </div>

                      {/* Line 2: Qty / Lots & LTP */}
                      <div className="flex items-center justify-between text-xs font-label text-[#8B949E]">
                        <div>
                          <span>{Math.abs(netQty)} {Math.abs(netQty) === 1 ? 'Lot' : 'Lots'} • {p.productType || p.product_type || 'CF'}</span>
                        </div>
                        <div className="tabular-nums">
                          <span>LTP ₹{ltp.toFixed(2)}</span>
                          <span className="ml-1 text-[11px]">({isGain ? '+' : ''}{((displayPnl / (Math.abs(netQty || 1) * avgPrice || 1)) * 100).toFixed(2)}%)</span>
                        </div>
                      </div>

                      {/* Line 3: Buy Price & Sell Price */}
                      <div className="flex items-center justify-between text-xs font-label text-[#8B949E] pt-1">
                        <div>Buy ₹{buyAvg.toFixed(2)}</div>
                        <div>Sell ₹{sellAvg.toFixed(2)}</div>
                      </div>

                      {/* Square Off Button for Open Positions */}
                      {isOpen && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleSquareOffPosition(p)}
                            className="bg-[#FF5252] hover:bg-rose-600 text-white font-headline font-bold text-xs px-3 py-1 rounded-lg shadow-sm transition-all"
                          >
                            Square Off
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

      </div>

      {/* STICKY BOTTOM TOTAL FOOTER BAR */}
      {activeTab === 'POSITIONS' && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 bg-[#161B22]/95 backdrop-blur-md border-t border-[#30363D] p-3 flex items-center justify-between z-40 px-4 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#00E676] text-[#0D1117] flex items-center justify-center font-black text-xs">
              ✓
            </span>
            <span className="font-headline font-bold text-sm text-white">Total</span>
          </div>

          <div className={`font-headline font-black text-base tabular-nums flex items-center gap-1 ${
            totalPositionPnl >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'
          }`}>
            <span>{totalPositionPnl >= 0 ? '+' : ''}₹{totalPositionPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span>▲</span>
          </div>
        </div>
      )}

    </div>
  );
};
