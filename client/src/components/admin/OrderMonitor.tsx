import React, { useState, useEffect } from 'react';
import { Activity, XCircle, Edit2, Play, AlertTriangle, PlusCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface OrderMonitorProps { token: string; }

export const OrderMonitor: React.FC<OrderMonitorProps> = ({ token }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin Order Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [symbol, setSymbol] = useState('NIFTY 24500 CE');
  const [exchange, setExchange] = useState('NFO');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [quantity, setQuantity] = useState(50);
  const [price, setPrice] = useState(150);
  const [productType, setProductType] = useState('MIS');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const fetchOrders = () => {
    const params = new URLSearchParams({ limit: '100' });
    if (statusFilter) params.set('status', statusFilter);
    if (exchangeFilter) params.set('exchange', exchangeFilter);

    Promise.all([
      fetch(`/api/v1/admin/orders/monitor?${params}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/customers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([ordersData, customersData]) => {
      if (ordersData.success && Array.isArray(ordersData.orders)) setOrders(ordersData.orders);
      if (customersData.success && Array.isArray(customersData.customers)) {
        setClients(customersData.customers);
        if (customersData.customers.length > 0 && !selectedUserId) {
          setSelectedUserId(customersData.customers[0].id);
        }
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [token, statusFilter, exchangeFilter]);

  const handleEditPrice = async (orderId: string, currentPrice: number) => {
    const newPriceStr = window.prompt(`Enter new limit price for Order ${orderId}:`, String(currentPrice));
    if (!newPriceStr) return;
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice <= 0) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: newPrice })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to update order price' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleForceExecute = async (orderId: string, currentPrice: number) => {
    const fillPriceStr = window.prompt(`Execute Order ${orderId} immediately at price (₹):`, String(currentPrice));
    if (!fillPriceStr) return;
    const fillPrice = parseFloat(fillPriceStr);
    if (isNaN(fillPrice) || fillPrice <= 0) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: fillPrice })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to force execute order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!window.confirm(`Are you sure you want to cancel order ${orderId}?`)) return;
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Cancelled by Admin' })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to cancel order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleReject = async (orderId: string) => {
    const reason = window.prompt(`Enter rejection reason for Order ${orderId}:`, 'RMS / Admin Policy Rejection');
    if (reason === null) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to reject order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !symbol || !quantity || !price) return;
    setSubmittingOrder(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/v1/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: selectedUserId,
          symbol,
          exchange,
          side,
          orderType,
          quantity,
          price,
          productType
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        setShowCreateModal(false);
        fetchOrders();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to place admin order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full select-none">
      {/* Top Filter & Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <Activity className="w-4 h-4 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Live OMS Monitor — 4s Auto-Sync</span>
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-semibold"
        >
          <option value="">All Status</option>
          <option value="ACCEPTED">ACCEPTED (Pending Fill)</option>
          <option value="PENDING">PENDING</option>
          <option value="FILLED">FILLED (Executed)</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="REJECTED">REJECTED</option>
        </select>

        <select
          value={exchangeFilter}
          onChange={e => setExchangeFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-semibold"
        >
          <option value="">All Exchanges</option>
          <option value="NSE">NSE</option>
          <option value="NFO">NFO</option>
          <option value="BSE">BSE</option>
          <option value="MCX">MCX</option>
        </select>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 shadow transition ml-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>+ Place Admin Order</span>
        </button>

        <button
          onClick={fetchOrders}
          className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition"
          title="Refresh Orders"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-lg text-xs font-semibold ${actionMsg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 font-headline">
            <tr>
              <th className="py-2.5 px-3">Order ID</th>
              <th className="py-2.5 px-3">Client</th>
              <th className="py-2.5 px-3">Symbol</th>
              <th className="py-2.5 px-3">Exchange</th>
              <th className="py-2.5 px-3">Side</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3 text-right">Qty</th>
              <th className="py-2.5 px-3 text-right">Limit Price</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3 text-center">Admin Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-label">
            {orders.map(o => {
              const isPending = ['ACCEPTED', 'PENDING'].includes(o.status);
              return (
                <tr key={o.order_id || o.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-amber-400 font-bold">{o.order_id}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-white">{o.client_name || 'Client'}</div>
                    <div className="text-[10px] text-slate-400">{o.client_email}</div>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">{o.symbol}</td>
                  <td className="py-2.5 px-3">
                    <span className="bg-slate-800 border border-slate-700/50 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-300">
                      {o.exchange || 'NSE'}
                    </span>
                  </td>
                  <td className={`py-2.5 px-3 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {o.side}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">{o.order_type}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{o.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white text-sm">₹{parseFloat(o.price).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase border ${
                      o.status === 'FILLED' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                      o.status === 'CANCELLED' || o.status === 'REJECTED' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                      'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[10px] text-slate-400 font-mono">
                    {new Date(o.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {isPending ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEditPrice(o.order_id || o.id, parseFloat(o.price))}
                          title="Edit Limit Price"
                          className="p-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 rounded-lg transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleForceExecute(o.order_id || o.id, parseFloat(o.price))}
                          title="Force Fill / Execute Order"
                          className="p-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 rounded-lg transition"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReject(o.order_id || o.id)}
                          title="Reject Order with Reason"
                          className="p-1.5 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-400 rounded-lg transition"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCancel(o.order_id || o.id)}
                          title="Cancel Order"
                          className="p-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-400 rounded-lg transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">Finalized</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500 font-bold">
                  No orders recorded in system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Place Admin Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 text-xs text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-400" /> Admin Direct Order Placement
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-base">✕</button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Select Client User</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.username} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Symbol</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Exchange</label>
                  <select
                    value={exchange}
                    onChange={e => setExchange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-semibold"
                  >
                    <option value="NSE">NSE</option>
                    <option value="NFO">NFO</option>
                    <option value="BSE">BSE</option>
                    <option value="MCX">MCX</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Side</label>
                  <select
                    value={side}
                    onChange={e => setSide(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-bold"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Type</label>
                  <select
                    value={orderType}
                    onChange={e => setOrderType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-semibold"
                  >
                    <option value="LIMIT">LIMIT</option>
                    <option value="MARKET">MARKET</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Product</label>
                  <select
                    value={productType}
                    onChange={e => setProductType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-semibold"
                  >
                    <option value="MIS">MIS (Intraday)</option>
                    <option value="CNC">CNC (Delivery)</option>
                    <option value="NRML">NRML (F&O Carry)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Price (₹)</label>
                  <input
                    type="number"
                    min="0.05"
                    step="0.05"
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className={`px-5 py-2 rounded-xl font-bold text-white ${
                    side === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {submittingOrder ? 'Submitting...' : `Submit Admin ${side} Order`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
