import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Lock, Unlock } from 'lucide-react';

interface CustomerListProps { token: string; onSelectCustomer: (id: string) => void; }

export const CustomerList: React.FC<CustomerListProps> = ({ token, onSelectCustomer }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  const fetchCustomers = () => {
    const params = new URLSearchParams({ limit: '50', offset: String(page * 50) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/v1/admin/customers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) { setCustomers(d.customers); setTotal(d.total); } });
  };

  useEffect(() => { fetchCustomers(); }, [token, search, statusFilter, page]);

  const handleFreeze = async (id: string) => {
    await fetch(`/api/v1/admin/customers/${id}/freeze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Admin action' })
    });
    fetchCustomers();
  };

  const handleUnfreeze = async (id: string) => {
    await fetch(`/api/v1/admin/customers/${id}/unfreeze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Admin action' })
    });
    fetchCustomers();
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or client ID..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-600" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="FROZEN">Frozen</option>
          <option value="DISABLED">Disabled</option>
        </select>
        <span className="text-[10px] text-slate-500">{total} total</span>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Client ID</th>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Email</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">KYC</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3 text-right">Funds (₹)</th>
              <th className="py-2.5 px-3">Last Login</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-slate-800/40">
                <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{c.id.slice(0, 12)}...</td>
                <td className="py-2 px-3 font-semibold text-white">{c.username}</td>
                <td className="py-2 px-3 text-slate-400">{c.email}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    c.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    c.status === 'FROZEN' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                    'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>{c.status}</span>
                </td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                    c.kyc_status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400' :
                    c.kyc_status === 'REJECTED' ? 'bg-rose-950 text-rose-400' :
                    c.kyc_status ? 'bg-amber-950 text-amber-400' : 'bg-slate-800 text-slate-500'
                  }`}>{c.kyc_status || 'N/A'}</span>
                </td>
                <td className="py-2 px-3"><span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-amber-400 border border-slate-700">{c.role}</span></td>
                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">₹{(c.cash_balance || 0).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-slate-500 text-[10px]">{c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : 'Never'}</td>
                <td className="py-2 px-3 text-center flex items-center justify-center gap-1">
                  <button onClick={() => onSelectCustomer(c.id)} title="View 360" className="p-1 text-slate-400 hover:text-emerald-400 rounded"><Eye className="w-3.5 h-3.5" /></button>
                  {c.status === 'ACTIVE' ? (
                    <button onClick={() => handleFreeze(c.id)} title="Freeze" className="p-1 text-slate-400 hover:text-blue-400 rounded"><Lock className="w-3.5 h-3.5" /></button>
                  ) : c.status === 'FROZEN' ? (
                    <button onClick={() => handleUnfreeze(c.id)} title="Unfreeze" className="p-1 text-slate-400 hover:text-emerald-400 rounded"><Unlock className="w-3.5 h-3.5" /></button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
