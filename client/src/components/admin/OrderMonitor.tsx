import React, { useState, useEffect } from 'react';
import { Activity, XCircle } from 'lucide-react';

interface OrderMonitorProps { token: string; }

export const OrderMonitor: React.FC<OrderMonitorProps> = ({ token }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState('');

  const fetchOrders = () => {
    const params = new URLSearchParams({ limit: '100' });
    if (statusFilter) params.set('status', statusFilter);
    if (exchangeFilter) params.set('exchange', exchangeFilter);
    fetch(`/api/v1/admin/orders/monitor?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setOrders(d.orders));
  };

  useEffect(() => { fetchOrders(); const i = setInterval(fetchOrders, 5000); return () => clearInterval(i); }, [token, statusFilter, exchangeFilter]);

  const handleCancel = async (orderId: string) => {
    await fetch(`/api/v1/admin/orders/${orderId}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Admin cancel' })
    });
    fetchOrders();
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-400"><Activity className="w-4 h-4 animate-pulse" /><span className="text-[10px] font-bold uppercase">Live — Auto-refresh 5s</span></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
          <option value="">All Status</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="PENDING">Pending</option>
          <option value="FILLED">Filled</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select value={exchangeFilter} onChange={e => setExchangeFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
          <option value="">All Exchanges</option>
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
          <option value="MCX">MCX</option>
        </select>
        <span className="ml-auto text-[10px] text-slate-500">{orders.length} orders</span>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Order ID</th>
              <th className="py-2.5 px-3">Client</th>
              <th className="py-2.5 px-3">Symbol</th>
              <th className="py-2.5 px-3">Exchange</th>
              <th className="py-2.5 px-3">Side</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Qty</th>
              <th className="py-2.5 px-3">Price</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3 text-center">Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {orders.map(o => (
              <tr key={o.order_id} className="hover:bg-slate-800/40">
                <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{o.order_id?.slice(0, 10)}</td>
                <td className="py-2 px-3 font-semibold text-white">{o.client_name}</td>
                <td className="py-2 px-3 font-bold text-white">{o.symbol}</td>
                <td className="py-2 px-3"><span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-indigo-400">{o.exchange}</span></td>
                <td className={`py-2 px-3 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{o.side}</td>
                <td className="py-2 px-3 text-slate-400">{o.order_type}</td>
                <td className="py-2 px-3">{o.quantity}</td>
                <td className="py-2 px-3 font-mono">₹{o.price}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    o.status === 'FILLED' ? 'bg-emerald-950 text-emerald-400' :
                    o.status === 'CANCELLED' || o.status === 'REJECTED' ? 'bg-rose-950 text-rose-400' :
                    'bg-amber-950 text-amber-400'
                  }`}>{o.status}</span>
                </td>
                <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(o.created_at).toLocaleTimeString()}</td>
                <td className="py-2 px-3 text-center">
                  {['ACCEPTED', 'PENDING'].includes(o.status) && (
                    <button onClick={() => handleCancel(o.order_id)} title="Admin Cancel" className="p-1 text-rose-500 hover:text-rose-300"><XCircle className="w-3.5 h-3.5" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
