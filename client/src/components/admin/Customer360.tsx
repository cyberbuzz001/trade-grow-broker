import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Shield, Briefcase, FileText, DollarSign, Activity, Clock } from 'lucide-react';

interface Customer360Props { token: string; customerId: string; onBack: () => void; }

export const Customer360: React.FC<Customer360Props> = ({ token, customerId, onBack }) => {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('OVERVIEW');

  useEffect(() => {
    fetch(`/api/v1/admin/customers/${customerId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setData(d.customer));
  }, [token, customerId]);

  if (!data) return <div className="text-slate-400 text-sm p-8">Loading customer profile...</div>;

  const tabs = ['OVERVIEW', 'KYC', 'ORDERS', 'TRADES', 'POSITIONS', 'HOLDINGS', 'FUNDS', 'LEDGER', 'AUDIT'];

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-800 pb-3">
        <button onClick={onBack} className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h2 className="text-lg font-bold text-white">{data.profile.username}</h2>
          <span className="text-[10px] text-slate-400">{data.profile.email} · {data.profile.id}</span>
        </div>
        <span className={`ml-auto px-3 py-1 rounded text-xs font-bold ${
          data.profile.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
          data.profile.status === 'FROZEN' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
          'bg-rose-950 text-rose-400 border border-rose-800'
        }`}>{data.profile.status}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs font-semibold overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 rounded whitespace-nowrap transition ${activeTab === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
              <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-2">Profile</h4>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Role</span><span className="text-amber-400 font-bold">{data.profile.role}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Created</span><span className="text-white">{new Date(data.profile.created_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Last Login</span><span className="text-white">{data.profile.last_login_at ? new Date(data.profile.last_login_at).toLocaleString() : 'Never'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Failed Logins</span><span className="text-white">{data.profile.failed_login_attempts || 0}</span></div>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
              <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-2">Wallet</h4>
              {data.wallet ? (
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-400">Cash Balance</span><span className="text-emerald-400 font-bold font-mono">₹{parseFloat(data.wallet.cash_balance || 0).toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Used Margin</span><span className="text-amber-400 font-mono">₹{parseFloat(data.wallet.used_margin || 0).toLocaleString('en-IN')}</span></div>
                </div>
              ) : <span className="text-slate-500 text-xs">No wallet</span>}
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
              <h4 className="text-[10px] text-slate-500 uppercase font-bold mb-2">Summary</h4>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Orders</span><span className="text-white font-bold">{data.orders?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Trades</span><span className="text-white font-bold">{data.trades?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Positions</span><span className="text-white font-bold">{data.positions?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Holdings</span><span className="text-white font-bold">{data.holdings?.length || 0}</span></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr><th className="py-2 px-3">Order ID</th><th className="py-2 px-3">Symbol</th><th className="py-2 px-3">Side</th><th className="py-2 px-3">Qty</th><th className="py-2 px-3">Price</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">{(data.orders || []).map((o: any) => (
                <tr key={o.order_id}><td className="py-2 px-3 font-mono text-[10px]">{o.order_id}</td><td className="py-2 px-3 font-bold text-white">{o.symbol}</td>
                  <td className={`py-2 px-3 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{o.side}</td>
                  <td className="py-2 px-3">{o.quantity}</td><td className="py-2 px-3 font-mono">₹{o.price}</td>
                  <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] ${o.status === 'FILLED' ? 'bg-emerald-950 text-emerald-400' : o.status === 'CANCELLED' ? 'bg-rose-950 text-rose-400' : 'bg-amber-950 text-amber-400'}`}>{o.status}</span></td>
                  <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(o.created_at).toLocaleString()}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {activeTab === 'LEDGER' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr><th className="py-2 px-3">Txn ID</th><th className="py-2 px-3">Type</th><th className="py-2 px-3">Amount</th><th className="py-2 px-3">Before</th><th className="py-2 px-3">After</th><th className="py-2 px-3">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">{(data.ledger || []).map((l: any) => (
                <tr key={l.id}><td className="py-2 px-3 font-mono text-[10px] text-slate-500">{l.transaction_id?.slice(0,8)}</td>
                  <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] ${l.transaction_type === 'CREDIT' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>{l.transaction_type}</span></td>
                  <td className="py-2 px-3 font-mono font-bold text-white">₹{parseFloat(l.amount).toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-mono text-slate-400">₹{parseFloat(l.balance_before).toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-mono text-emerald-400">₹{parseFloat(l.balance_after).toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(l.created_at).toLocaleString()}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {activeTab === 'AUDIT' && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr><th className="py-2 px-3">Time</th><th className="py-2 px-3">Action</th><th className="py-2 px-3">Resource</th><th className="py-2 px-3">IP</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">{(data.auditLogs || []).map((a: any) => (
                <tr key={a.id}><td className="py-2 px-3 text-[10px] text-slate-500">{new Date(a.timestamp).toLocaleString()}</td>
                  <td className="py-2 px-3 font-bold text-white">{a.action}</td>
                  <td className="py-2 px-3 text-slate-400">{a.resource_type}</td>
                  <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{a.ip_address}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {['KYC', 'TRADES', 'POSITIONS', 'HOLDINGS', 'FUNDS'].includes(activeTab) && (
          <div className="text-center py-12 text-slate-500 text-xs">
            <p className="font-semibold">{activeTab} data</p>
            <p>Showing {(data[activeTab.toLowerCase()] || data[activeTab.toLowerCase() + 'Records'] || []).length} records</p>
          </div>
        )}
      </div>
    </div>
  );
};
