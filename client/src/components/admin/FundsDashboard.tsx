import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface FundsDashboardProps { token: string; }

export const FundsDashboard: React.FC<FundsDashboardProps> = ({ token }) => {
  const [funds, setFunds] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [clients, setClients] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustAmount, setAdjustAmount] = useState<number>(50000);
  const [adjustReason, setAdjustReason] = useState<string>('Admin Balance Adjustment');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  const fetchFundsData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/admin/funds/overview', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/funds/requests', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/customers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([overviewData, requestsData, customersData]) => {
      if (overviewData.success) setFunds(overviewData.funds);
      if (requestsData.success && Array.isArray(requestsData.requests)) setRequests(requestsData.requests);
      if (customersData.success && Array.isArray(customersData.customers)) {
        setClients(customersData.customers);
        if (customersData.customers.length > 0 && !targetUserId) {
          setTargetUserId(customersData.customers[0].id);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchFundsData();
  }, [token]);

  const handleDirectAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !adjustAmount || adjustAmount <= 0) return;
    setSubmittingAdjust(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/v1/admin/funds/direct-adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: targetUserId,
          requestType: adjustType,
          amount: adjustAmount,
          reason: adjustReason
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        setAdjustReason('Admin Balance Adjustment');
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to adjust balance' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleApprove = async (id: string, requestId: string) => {
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: `Approved request ${requestId}. Client wallet updated.` });
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to approve request.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleReject = async (id: string, requestId: string) => {
    const reason = window.prompt(`Enter rejection reason for request ${requestId}:`, 'Rejected by Admin');
    if (reason === null) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: `Rejected request ${requestId}.` });
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to reject request.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  if (loading && !funds) return <div className="text-slate-400 text-sm p-8">Loading funds overview & requests...</div>;

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      {/* Overview Stat Cards */}
      {funds && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Funds', value: `₹${funds.totalFunds.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
            { label: 'Available Cash', value: `₹${funds.available.toLocaleString('en-IN')}`, color: 'text-emerald-300' },
            { label: 'Blocked (Margin)', value: `₹${funds.blocked.toLocaleString('en-IN')}`, color: 'text-amber-400' },
            { label: 'Pending Requests', value: requests.filter(r => r.status === 'PENDING').length, color: 'text-amber-400' },
            { label: 'Pending Amount', value: `₹${requests.filter(r => r.status === 'PENDING').reduce((acc, r) => acc + parseFloat(r.amount), 0).toLocaleString('en-IN')}`, color: 'text-amber-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">{k.label}</span>
              <span className={`text-xl font-bold ${k.color} font-mono block mt-1`}>{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {actionMsg && (
        <div className={`p-3 rounded-lg text-xs font-semibold ${actionMsg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* DIRECT ADMIN FUND ADJUSTMENT CARD */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" /> Direct Admin Fund Addition / Withdrawal (Instant Credit or Debit)
        </h3>

        <form onSubmit={handleDirectAdjust} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end text-xs">
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Select Client</label>
            <select
              value={targetUserId}
              onChange={e => setTargetUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-semibold"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.username} ({c.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Action Type</label>
            <select
              value={adjustType}
              onChange={e => setAdjustType(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-semibold"
            >
              <option value="CREDIT">+ CREDIT (Add Funds)</option>
              <option value="DEBIT">- DEBIT (Withdraw Funds)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Amount (₹)</label>
            <input
              type="number"
              min="1"
              step="100"
              value={adjustAmount}
              onChange={e => setAdjustAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase">Reason / Audit Note</label>
            <input
              type="text"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              placeholder="Reason for adjustment"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
            />
          </div>

          <button
            type="submit"
            disabled={submittingAdjust}
            className={`py-2 px-4 rounded-lg font-bold text-xs text-white transition flex items-center justify-center gap-1 shadow ${
              adjustType === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
            }`}
          >
            {submittingAdjust ? 'Executing...' : `${adjustType === 'CREDIT' ? 'Add Funds' : 'Debit Funds'}`}
          </button>
        </form>
      </div>

      {/* PENDING APPROVAL REQUESTS SECTION */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Pending Client Fund Approval Requests ({requests.filter(r => r.status === 'PENDING').length})
          </h3>
          <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-mono">
            Requires Admin Action
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Req ID</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Reference / Note</th>
                <th className="py-2.5 px-3">Requested At</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {requests.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-400 text-[11px]">{r.request_id}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-white text-xs">{r.username}</div>
                    <div className="text-[10px] text-slate-400">{r.email}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.request_type === 'DEPOSIT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>
                      {r.request_type === 'DEPOSIT' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      {r.request_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white text-sm">
                    ₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-300 font-mono">{r.payment_method || 'BANK_TRANSFER'}</td>
                  <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-[200px] truncate">{r.reference_note || '-'}</td>
                  <td className="py-2.5 px-3 text-[10px] text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      r.status === 'REJECTED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                      'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {r.status === 'PENDING' ? 'PENDING APPROVAL' : r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {r.status === 'PENDING' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(r.id, r.request_id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition shadow flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(r.id, r.request_id)}
                          className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition shadow flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">No deposit or withdrawal requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Ledger Transactions */}
      {funds && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Wallet Ledger Audit History
          </h3>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="py-2 px-3">Txn ID</th>
                  <th className="py-2 px-3">Client</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-right">Balance After</th>
                  <th className="py-2 px-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(funds.recentTransactions || []).map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{t.transaction_id?.slice(0, 8)}</td>
                    <td className="py-2 px-3 font-semibold text-white">{t.username}</td>
                    <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.transaction_type === 'CREDIT' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>{t.transaction_type}</span></td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-white">₹{parseFloat(t.amount).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-400">₹{parseFloat(t.balance_after).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(t.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
