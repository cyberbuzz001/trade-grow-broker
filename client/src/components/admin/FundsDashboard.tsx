import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, ArrowDownLeft, ArrowUpRight, Lock, ShieldCheck, QrCode, Building, CreditCard, Save, RefreshCw, X, Sliders, AlertCircle, AlertTriangle } from 'lucide-react';

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

  // Partial Approval Modal State
  const [partialModalReq, setPartialModalReq] = useState<any | null>(null);
  const [partialAmountInput, setPartialAmountInput] = useState<number>(0);
  const [partialAdminNote, setPartialAdminNote] = useState<string>('');
  const [submittingPartial, setSubmittingPartial] = useState(false);

  // Rejection Modal State
  const [rejectModalReq, setRejectModalReq] = useState<any | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('Bank details mismatch / Verification required');
  const [submittingReject, setSubmittingReject] = useState(false);

  // Admin Payment Settings State (LinkPe UPI & Bank Receiving Account)
  const [paymentSettings, setPaymentSettings] = useState<{
    upiId: string;
    merchantName: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
  }>({
    upiId: 'tradegrow@upi',
    merchantName: 'Trade Grow Brokerage',
    bankName: 'HDFC Bank',
    accountName: 'Trade Grow Technologies Pvt Ltd',
    accountNumber: '50200098765432',
    ifscCode: 'HDFC0001234',
    branch: 'Mumbai Main Branch'
  });
  const [submittingPaymentSettings, setSubmittingPaymentSettings] = useState(false);
  const [paymentSettingMsg, setPaymentSettingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Platform Solvency & Real Bank Reserves State
  const [solvency, setSolvency] = useState<any | null>(null);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [bankCashInput, setBankCashInput] = useState<number>(1000000);
  const [reconcileNotes, setReconcileNotes] = useState<string>('Daily Platform Liquidity & Bank Reserve Audit');
  const [submittingReconcile, setSubmittingReconcile] = useState(false);

  const fetchFundsData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/v1/admin/funds/overview', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/funds/requests', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/customers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/funds/payment-settings', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/v1/admin/finance/reserves', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([overviewData, requestsData, customersData, settingsData, solvencyData]) => {
      if (overviewData.success) setFunds(overviewData.funds);
      if (requestsData.success && Array.isArray(requestsData.requests)) setRequests(requestsData.requests);
      if (customersData.success && Array.isArray(customersData.customers)) {
        setClients(customersData.customers);
        if (customersData.customers.length > 0 && !targetUserId) {
          setTargetUserId(customersData.customers[0].id);
        }
      }
      if (settingsData.success && settingsData.settings) {
        setPaymentSettings(settingsData.settings);
      }
      if (solvencyData.success && solvencyData.solvency) {
        setSolvency(solvencyData.solvency);
        setBankCashInput(solvencyData.solvency.bankCashReserve || 1000000);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReconcile(true);
    setActionMsg(null);

    try {
      const res = await fetch('/api/v1/admin/finance/reserves/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bankCashReserve: bankCashInput, notes: reconcileNotes })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message });
        setShowReconcileModal(false);
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to reconcile reserves' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingReconcile(false);
    }
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
    if (!window.confirm(`Are you sure you want to approve the FULL amount for request ${requestId}?`)) return;
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
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

  const openPartialModal = (r: any) => {
    setPartialModalReq(r);
    const origAmt = parseFloat(r.amount) || 0;
    setPartialAmountInput(Math.round(origAmt * 0.5)); // Default 50%
    setPartialAdminNote(`Partial payment processed via ${r.payment_method || 'Bank'}`);
  };

  const handlePartialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialModalReq || !partialAmountInput || partialAmountInput <= 0) return;
    const origAmt = parseFloat(partialModalReq.amount) || 0;
    if (partialAmountInput >= origAmt) {
      alert('Partial amount must be less than the full requested amount. Use "Approve Full" instead.');
      return;
    }

    setSubmittingPartial(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${partialModalReq.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          approvedAmount: partialAmountInput,
          adminNote: partialAdminNote
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: data.message || `Partially approved ₹${partialAmountInput.toLocaleString('en-IN')} for ${partialModalReq.request_id}.` });
        setPartialModalReq(null);
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to partially approve request.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingPartial(false);
    }
  };

  const openRejectModal = (r: any) => {
    setRejectModalReq(r);
    setRejectReasonInput('Bank details mismatch / Verification required');
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq) return;

    setSubmittingReject(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/funds/requests/${rejectModalReq.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReasonInput })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: `Rejected request ${rejectModalReq.request_id}.` });
        setRejectModalReq(null);
        fetchFundsData();
      } else {
        setActionMsg({ type: 'error', text: data.error?.message || 'Failed to reject request.' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingReject(false);
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
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md transition-all ${actionMsg.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800' : 'bg-rose-950/90 text-rose-300 border border-rose-800'}`}>
          <div className="flex items-center gap-2">
            {actionMsg.type === 'error' ? <XCircle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
            <span>{actionMsg.text.replace(/^[A-Z_]+:/, '')}</span>
          </div>
          <button 
            onClick={() => setActionMsg(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer ml-3 shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Platform Real-Money Solvency & Bank Reserves Monitor */}
      {solvency && (
        <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              solvency.status === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              solvency.status === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Platform Solvency & Real Bank Reserves</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  solvency.status === 'HEALTHY' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  solvency.status === 'WARNING' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                  'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {solvency.status} SOLVENCY ({(solvency.reserveRatio * 100).toFixed(0)}%)
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Total Real-Money Liabilities: <span className="text-amber-400 font-mono font-bold">₹{solvency.totalWithdrawableLiabilities.toLocaleString('en-IN')}</span> · 
                Bank Cash Reserves: <span className="text-emerald-400 font-mono font-bold">₹{solvency.bankCashReserve.toLocaleString('en-IN')}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowReconcileModal(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer ml-auto"
          >
            <Building className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reconcile Bank Reserve</span>
          </button>
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

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left border-collapse min-w-[1080px]">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-950/80">
                <th className="py-2.5 px-3">Req ID</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Reference / Note</th>
                <th className="py-2.5 px-3">Requested At</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center min-w-[260px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {requests.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-800/50 transition">
                  <td className="py-2.5 px-3 font-mono font-bold text-amber-400 text-[11px]">{r.request_id}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-white text-xs">{r.username}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{r.email}</div>
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
                  <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-[220px] truncate" title={r.reference_note || ''}>
                    {r.reference_note || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-[10px] text-slate-500 font-mono">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'APPROVED' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' :
                      r.status === 'PARTIALLY_APPROVED' ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700' :
                      r.status === 'REJECTED' ? 'bg-rose-950/80 text-rose-400 border border-rose-800' :
                      'bg-amber-950/80 text-amber-300 border border-amber-800 animate-pulse'
                    }`}>
                      {r.status === 'PENDING' ? 'PENDING' : r.status === 'PARTIALLY_APPROVED' ? 'PARTIAL' : r.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center min-w-[260px]">
                    {r.status === 'PENDING' ? (
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleApprove(r.id, r.request_id)}
                          className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition shadow flex items-center gap-1 shrink-0 cursor-pointer"
                          title="Approve full requested amount"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        {r.request_type === 'WITHDRAWAL' && (
                          <button
                            onClick={() => openPartialModal(r)}
                            className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition shadow flex items-center gap-1 shrink-0 cursor-pointer"
                            title="Approve partial withdrawal amount"
                          >
                            <Sliders className="w-3 h-3" /> Partial
                          </button>
                        )}
                        <button
                          onClick={() => openRejectModal(r)}
                          className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition shadow flex items-center gap-1 shrink-0 cursor-pointer"
                          title="Reject request with audit note"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">No deposit or withdrawal requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Payment Receiving Credentials Management (LinkPe UPI & Bank Account) */}
      <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
                MERCHANT PAYMENT RECEIVING CREDENTIALS
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Admin Access Only
                </span>
              </h3>
              <span className="text-[10px] text-slate-400">Configure Merchant UPI ID (LinkPe) & Bank Deposit Account for Client Fund Receipts</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            Active UPI VPA: {paymentSettings.upiId}
          </span>
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          setSubmittingPaymentSettings(true);
          setPaymentSettingMsg(null);
          try {
            const res = await fetch('/api/v1/admin/funds/payment-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(paymentSettings)
            });
            const data = await res.json();
            if (data.success) {
              setPaymentSettingMsg({ type: 'success', text: data.message });
            } else {
              setPaymentSettingMsg({ type: 'error', text: data.error?.message || 'Failed to update settings' });
            }
          } catch (err: any) {
            setPaymentSettingMsg({ type: 'error', text: err.message });
          } finally {
            setSubmittingPaymentSettings(false);
          }
        }} className="space-y-4">
          
          {/* UPI Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                LinkPe Merchant UPI VPA / ID
              </label>
              <input
                type="text"
                value={paymentSettings.upiId}
                onChange={e => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                placeholder="e.g. tradegrow@upi or 9876543210@paytm"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-slate-500 mt-1 block">Receives client instant UPI payments & generates LinkPe QR codes</span>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Merchant Business Name
              </label>
              <input
                type="text"
                value={paymentSettings.merchantName}
                onChange={e => setPaymentSettings({ ...paymentSettings, merchantName: e.target.value })}
                placeholder="e.g. Trade Grow Brokerage"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-slate-500 mt-1 block">Displayed on client LinkPe checkout page & UPI app prompt</span>
            </div>
          </div>

          {/* Bank Wire Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank Name</label>
              <input
                type="text"
                value={paymentSettings.bankName}
                onChange={e => setPaymentSettings({ ...paymentSettings, bankName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Holder Name</label>
              <input
                type="text"
                value={paymentSettings.accountName}
                onChange={e => setPaymentSettings({ ...paymentSettings, accountName: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Number</label>
              <input
                type="text"
                value={paymentSettings.accountNumber}
                onChange={e => setPaymentSettings({ ...paymentSettings, accountNumber: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">IFSC Code</label>
              <input
                type="text"
                value={paymentSettings.ifscCode}
                onChange={e => setPaymentSettings({ ...paymentSettings, ifscCode: e.target.value.toUpperCase() })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Branch Location</label>
              <input
                type="text"
                value={paymentSettings.branch}
                onChange={e => setPaymentSettings({ ...paymentSettings, branch: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {paymentSettingMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${
              paymentSettingMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}>
              {paymentSettingMsg.text}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="submit"
              disabled={submittingPaymentSettings}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 transition shadow-lg disabled:opacity-50"
            >
              {submittingPaymentSettings ? (
                <span>Saving Credentials...</span>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Merchant Receiving Credentials (Admin Lock)</span>
                </>
              )}
            </button>
          </div>
        </form>
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

      {/* PARTIAL WITHDRAWAL APPROVAL MODAL */}
      {partialModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Approve Partial Withdrawal</h3>
                  <p className="text-[10px] text-slate-400">Request: <span className="font-mono text-amber-400 font-bold">{partialModalReq.request_id}</span> ({partialModalReq.username})</p>
                </div>
              </div>
              <button onClick={() => setPartialModalReq(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handlePartialSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Requested:</span>
                  <span className="text-white font-bold text-sm">₹{parseFloat(partialModalReq.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Payment Method:</span>
                  <span className="text-emerald-400 font-bold text-sm">{partialModalReq.payment_method || 'UPI'}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Approved Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="1"
                    max={parseFloat(partialModalReq.amount) - 1}
                    step="any"
                    required
                    value={partialAmountInput || ''}
                    onChange={e => setPartialAmountInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-indigo-500/40 focus:border-indigo-500 rounded-xl py-2.5 pl-8 pr-3 text-white font-mono font-bold text-base focus:outline-none"
                    placeholder="Enter partial amount..."
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
                  <span>Retained in Wallet: <strong className="text-amber-400">₹{Math.max(0, parseFloat(partialModalReq.amount) - (partialAmountInput || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Max: ₹{(parseFloat(partialModalReq.amount) - 1).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Admin Audit Note / UTR Reference</label>
                <input
                  type="text"
                  value={partialAdminNote}
                  onChange={e => setPartialAdminNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs"
                  placeholder="e.g. Approved tranche 1 payout via IMPS UTR 482910..."
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPartialModalReq(null)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPartial || !partialAmountInput || partialAmountInput <= 0 || partialAmountInput >= parseFloat(partialModalReq.amount)}
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingPartial ? 'Processing...' : `Approve ₹${(partialAmountInput || 0).toLocaleString('en-IN')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT REQUEST MODAL */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reject Fund Request</h3>
                  <p className="text-[10px] text-slate-400">Request: <span className="font-mono text-amber-400 font-bold">{rejectModalReq.request_id}</span> ({rejectModalReq.username})</p>
                </div>
              </div>
              <button onClick={() => setRejectModalReq(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs flex justify-between">
                <span className="text-slate-400">Requested Amount:</span>
                <span className="text-rose-400 font-bold text-sm">₹{parseFloat(rejectModalReq.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReasonInput}
                  onChange={e => setRejectReasonInput(e.target.value)}
                  className="w-full bg-slate-950 border border-rose-500/30 focus:border-rose-500 rounded-xl p-2.5 text-white text-xs focus:outline-none"
                  placeholder="Enter rejection reason for client..."
                />
              </div>

              {/* Quick Preset Badges */}
              <div className="flex flex-wrap gap-1.5">
                {['Bank details mismatch', 'Account verification required', 'Duplicate request', 'Turnover criteria pending'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setRejectReasonInput(tag)}
                    className="text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg border border-slate-800 transition cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalReq(null)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject || !rejectReasonInput.trim()}
                  className="w-1/2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECONCILE BANK RESERVES MODAL */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reconcile Platform Bank Reserves</h3>
                  <p className="text-[10px] text-slate-400">Audit actual bank balance against total real-money liabilities</p>
                </div>
              </div>
              <button onClick={() => setShowReconcileModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Current User Liabilities:</span>
                  <span className="text-amber-400 font-bold">₹{solvency?.totalWithdrawableLiabilities.toLocaleString('en-IN') || '0'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Last Reconciled:</span>
                  <span className="text-slate-300">{solvency?.lastReconciledAt ? new Date(solvency.lastReconciledAt).toLocaleString() : 'Never'}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Actual Bank Account Balance (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={bankCashInput}
                  onChange={e => setBankCashInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Audit Notes / Bank Statement Reference</label>
                <input
                  type="text"
                  value={reconcileNotes}
                  onChange={e => setReconcileNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReconcile}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded-xl transition shadow cursor-pointer"
                >
                  {submittingReconcile ? 'Saving Audit...' : 'Confirm Solvency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
