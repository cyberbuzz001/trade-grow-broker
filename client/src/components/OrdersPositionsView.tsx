import React, { useState, useEffect } from 'react';
import { RefreshCw, Filter, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Zap, PieChart, Layers, DollarSign } from 'lucide-react';

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
          setPositions(data.positions.filter((p: any) => {
            const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
            return qty !== 0;
          }));
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

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          instrumentToken: pos.instrumentToken || `NSE_${pos.symbol}`,
          exchange: pos.exchange || 'NSE',
          symbol: pos.symbol,
          side,
          quantity,
          price: pos.ltp || 0,
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

  // Position & Holding Summary Aggregates
  const totalPositionPnl = positions.reduce((acc, p) => acc + (p.unrealizedPnl || p.unrealized_pnl || 0) + (p.realizedPnl || p.realized_pnl || 0), 0);
  const totalHoldingValue = holdings.reduce((acc, h) => acc + ((h.quantity || 0) * (h.currentPrice || h.ltp || h.averagePrice || 0)), 0);
  const totalHoldingCost = holdings.reduce((acc, h) => acc + ((h.quantity || 0) * (h.averagePrice || 0)), 0);
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
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Open Positions ({positions.length})
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Net Positions P&L</span>
            <span className={`text-xl font-extrabold num-font block mt-1 ${totalPositionPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {totalPositionPnl >= 0 ? '+' : ''}₹{totalPositionPnl.toFixed(2)}
            </span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Active Contracts</span>
            <span className="text-xl font-extrabold num-font text-[var(--text-main)] block mt-1">{positions.length} Positions</span>
          </div>
          <div className="tg-stat-card">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold tracking-wider block">Auto Square-Off</span>
            <span className="text-xl font-extrabold num-font text-amber-500 block mt-1">15:15 IST</span>
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
                <th className="py-3 px-4 text-right">LTP (₹)</th>
                <th className="py-3 px-4 text-right">Unrealized P&L (₹)</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)] num-font">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--text-tertiary)] font-sans">No open positions in portfolio.</td>
                </tr>
              ) : (
                positions.map(p => {
                  const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
                  const avgPrice = p.averagePrice || p.average_price || 0;
                  const ltp = p.ltp || avgPrice;
                  const pnl = p.unrealizedPnl ?? p.unrealized_pnl ?? ((ltp - avgPrice) * netQty);
                  return (
                    <tr key={p.id || p.symbol} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                      <td className="py-3 px-4 font-sans font-extrabold text-[var(--text-main)] text-sm">{p.symbol}</td>
                      <td className="py-3 px-4"><span className="bg-[var(--bg-surface-elevated)] text-amber-500 font-sans text-[10px] px-2 py-0.5 rounded-md font-bold border border-[var(--border-color)]">{p.productType || p.product_type || 'MIS'}</span></td>
                      <td className={`py-3 px-4 text-right font-bold ${netQty > 0 ? 'text-emerald-500' : (netQty < 0 ? 'text-rose-500' : 'text-[var(--text-muted)]')}`}>
                        {netQty > 0 ? `+${netQty}` : netQty}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--text-main)]">₹{avgPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-[var(--text-main)]">₹{ltp.toFixed(2)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSquareOffPosition(p)}
                          disabled={netQty === 0}
                          className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all ${
                            netQty === 0
                              ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] cursor-not-allowed border border-[var(--border-color)]'
                              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20'
                          }`}
                        >
                          {netQty === 0 ? 'Closed' : 'Square Off'}
                        </button>
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
