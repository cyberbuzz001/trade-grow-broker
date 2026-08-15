import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Lock, Unlock, KeyRound, X, Check, Copy, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CustomerListProps { 
  token: string; 
  onSelectCustomer: (id: string) => void; 
}

export const CustomerList: React.FC<CustomerListProps> = ({ token, onSelectCustomer }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = 'TG@';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setCopied(false);
  };

  const handleOpenResetModal = (user: any) => {
    setResetTargetUser(user);
    setNewPassword('');
    setResetMsg(null);
    setCopied(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (!newPassword || newPassword.length < 6) {
      setResetMsg({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setSubmittingReset(true);
    setResetMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/customers/${resetTargetUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setResetMsg({ type: 'success', text: data.message || 'Password successfully reset!' });
      } else {
        setResetMsg({ type: 'error', text: data.error?.message || data.message || 'Failed to reset password' });
      }
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message || 'Network error while resetting password' });
    } finally {
      setSubmittingReset(false);
    }
  };

  const handleCopyPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full relative">
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
                <td className="py-2 px-3 font-mono text-[10px] text-emerald-400 font-bold">TG-{c.id.slice(0, 8).toUpperCase()}</td>
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
                <td className="py-2 px-3 text-center flex items-center justify-center gap-1.5">
                  <button 
                    onClick={() => onSelectCustomer(c.id)} 
                    title="View 360" 
                    className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  
                  {/* Reset Password Button */}
                  <button
                    onClick={() => handleOpenResetModal(c)}
                    title="Admin Reset Password"
                    className="p-1 text-amber-400/80 hover:text-amber-300 rounded hover:bg-amber-950/40 transition cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>

                  {c.status === 'ACTIVE' ? (
                    <button 
                      onClick={() => handleFreeze(c.id)} 
                      title="Freeze Account" 
                      className="p-1 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                    </button>
                  ) : c.status === 'FROZEN' ? (
                    <button 
                      onClick={() => handleUnfreeze(c.id)} 
                      title="Unfreeze Account" 
                      className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADMIN RESET PASSWORD MODAL */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Admin Password Reset</h3>
                  <p className="text-[10px] text-slate-400">Set a new password for client login</p>
                </div>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Client ID:</span>
                <span className="text-emerald-400 font-bold">TG-{resetTargetUser.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Username:</span>
                <span className="text-white font-bold">{resetTargetUser.username}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Email:</span>
                <span className="text-slate-300">{resetTargetUser.email}</span>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Password *</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-Generate Strong
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500 pr-10"
                  />
                  {newPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                      title="Copy Password"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {resetMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  resetMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {resetMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {resetMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset || !newPassword || newPassword.length < 6}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {submittingReset ? 'Updating Password...' : 'Confirm Reset Password'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
