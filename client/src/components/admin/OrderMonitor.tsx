import React, { useState, useEffect } from 'react';
import { Activity, XCircle, Edit2, Play, AlertTriangle, PlusCircle, CheckCircle, RefreshCw, ShieldCheck, Clock, FileText, X, Check, Eye } from 'lucide-react';

interface OrderMonitorProps { token: string; }

export const OrderMonitor: React.FC<OrderMonitorProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'PROVENANCE'>('ORDERS');
  const [orders, setOrders] = useState<any[]>([]);
  const [provenanceFills, setProvenanceFills] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState('');
  const [freshnessFilter, setFreshnessFilter] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Provenance Dossier Modal
  const [selectedFill, setSelectedFill] = useState<any | null>(null);

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

  const fetchProvenance = () => {
    const params = new URLSearchParams({ limit: '100' });
    if (freshnessFilter) params.set('freshness', freshnessFilter);
    fetch(`/api/v1/admin/executions/provenance?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.executions)) setProvenanceFills(d.executions);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (activeTab === 'ORDERS') {
      fetchOrders();
      const interval = setInterval(fetchOrders, 4000);
      return () => clearInterval(interval);
    } else {
      fetchProvenance();
      const interval = setInterval(fetchProvenance, 5000);
      return () => clearInterval(interval);
    }
  }, [token, activeTab, statusFilter, exchangeFilter, freshnessFilter]);

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
      const res = await fetch(`/api/v1/admin/orders/${orderId}/force-execute`, {
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

  const handleCancelOrder = async (orderId: string) => {
    const reason = window.prompt(`Reason for cancelling order ${orderId}:`, 'Cancelled by Admin');
    if (reason === null) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason })
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${activeTab === 'ORDERS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Live Order Book ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('PROVENANCE')}
              className={`px-4 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'PROVENANCE' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Fill Provenance Inspector ({provenanceFills.length})</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'ORDERS' ? (
            <>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-semibold"
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
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-semibold"
              >
                <option value="">All Exchanges</option>
                <option value="NSE">NSE</option>
                <option value="NFO">NFO</option>
                <option value="BSE">BSE</option>
                <option value="MCX">MCX</option>
              </select>

              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Place Admin Order</span>
              </button>
            </>
          ) : (
            <select
              value={freshnessFilter}
              onChange={e => setFreshnessFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-semibold"
            >
              <option value="">All Provenance Tags</option>
              <option value="live">🟢 LIVE Feed (&lt;= 15s)</option>
              <option value="synthetic_skew">🟡 SYNTHETIC SKEW (Option BS)</option>
              <option value="cached_stale">🔴 CACHED STALE</option>
            </select>
          )}

          <button
            onClick={activeTab === 'ORDERS' ? fetchOrders : fetchProvenance}
            className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-lg text-xs font-semibold ${actionMsg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* ── 1. ORDERS TABLE ──────────────────────────────────────────────── */}
      {activeTab === 'ORDERS' && (
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
                    <td className="py-2.5 px-3 text-slate-300">
                      <div className="font-semibold text-white">{o.username || o.user_id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">TG-{o.user_id?.slice(0, 8).toUpperCase()}</div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{o.symbol}</td>
                    <td className="py-2.5 px-3"><span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px]">{o.exchange}</span></td>
                    <td className={`py-2.5 px-3 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{o.side}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-400">{o.order_type}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{o.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">₹{parseFloat(o.price || '0').toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.status === 'FILLED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        o.status === 'CANCELLED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>{o.status}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-slate-400 font-mono">{new Date(o.created_at).toLocaleTimeString()}</td>
                    <td className="py-2.5 px-3 text-center">
                      {isPending ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditPrice(o.order_id, parseFloat(o.price || '0'))}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition cursor-pointer"
                            title="Edit Price"
                          ><Edit2 className="w-3.5 h-3.5" /></button>
                          <button
                            onClick={() => handleForceExecute(o.order_id, parseFloat(o.price || '0'))}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded transition cursor-pointer"
                            title="Force Execute"
                          ><Play className="w-3.5 h-3.5" /></button>
                          <button
                            onClick={() => handleCancelOrder(o.order_id)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded transition cursor-pointer"
                            title="Cancel Order"
                          ><XCircle className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Finalized</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 2. FILL PROVENANCE INSPECTOR TABLE ───────────────────────────── */}
      {activeTab === 'PROVENANCE' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 font-headline">
              <tr>
                <th className="py-2.5 px-3">Execution ID</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Fill Price (₹)</th>
                <th className="py-2.5 px-3 text-right">Market LTP @ Fill</th>
                <th className="py-2.5 px-3 text-center">Freshness</th>
                <th className="py-2.5 px-3">Tick Source</th>
                <th className="py-2.5 px-3">Fill Logic</th>
                <th className="py-2.5 px-3 text-center">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-label">
              {provenanceFills.map(f => (
                <tr key={f.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-mono text-[10px] text-amber-400">{f.id}</td>
                  <td className="py-2.5 px-3 text-slate-300">
                    <div className="font-semibold text-white">{f.username}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{f.email}</div>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">{f.symbol}</td>
                  <td className={`py-2.5 px-3 font-bold ${f.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{f.side}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{f.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">₹{parseFloat(f.price).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-300">₹{parseFloat(f.tick_ltp || f.price).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      f.freshness_tag === 'live' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      f.freshness_tag === 'synthetic_skew' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                      'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>
                      {f.freshness_tag === 'live' ? '🟢 LIVE' : f.freshness_tag === 'synthetic_skew' ? '🟡 SYNTHETIC' : '🔴 STALE'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[10px] text-slate-400 font-mono">{f.tick_source || 'LIVE_FEED'}</td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">{f.fill_logic || 'MARKET'}</td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => setSelectedFill(f)}
                      className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition cursor-pointer"
                      title="Inspect Fill Provenance Dossier"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PROVENANCE DOSSIER MODAL ─────────────────────────────────────── */}
      {selectedFill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Simulated Fill Provenance Evidence</h3>
                  <p className="text-[10px] text-slate-400">Cryptographic audit trail of market price at fill time</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFill(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Execution ID:</span><span className="text-amber-400 font-bold">{selectedFill.id}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Order ID:</span><span className="text-slate-300">{selectedFill.order_id}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Client:</span><span className="text-white">{selectedFill.username} ({selectedFill.email})</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Instrument:</span><span className="text-emerald-400 font-bold">{selectedFill.symbol} ({selectedFill.side})</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Quantity:</span><span className="text-white">{selectedFill.quantity}</span></div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Simulated Fill Price:</span><span className="text-emerald-400 font-bold">₹{parseFloat(selectedFill.price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Live Market LTP:</span><span className="text-white">₹{parseFloat(selectedFill.tick_ltp || selectedFill.price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Bid / Ask Spread:</span><span className="text-slate-300">₹{parseFloat(selectedFill.tick_bid || selectedFill.price).toFixed(2)} / ₹{parseFloat(selectedFill.tick_ask || selectedFill.price).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Freshness Tag:</span><span className="text-amber-400 font-bold uppercase">{selectedFill.freshness_tag || 'live'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tick Source:</span><span className="text-slate-300">{selectedFill.tick_source || 'LIVE_FEED'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Fill Logic:</span><span className="text-slate-300">{selectedFill.fill_logic || 'MARKET'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Execution Time:</span><span className="text-slate-400">{new Date(selectedFill.executed_at).toISOString()}</span></div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedFill(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ORDER MODAL ───────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <span>Place Order on Behalf of Client</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Target Client *</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  required
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.username} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Trading Symbol *</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Side *</label>
                  <select
                    value={side}
                    onChange={e => setSide(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold"
                  >
                    <option value="BUY" className="text-emerald-400">BUY</option>
                    <option value="SELL" className="text-rose-400">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Order Type *</label>
                  <select
                    value={orderType}
                    onChange={e => setOrderType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="LIMIT">LIMIT</option>
                    <option value="MARKET">MARKET</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Quantity *</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.05"
                    value={price}
                    onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono"
                    min={0.05}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg cursor-pointer"
                >
                  {submittingOrder ? 'Submitting...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
