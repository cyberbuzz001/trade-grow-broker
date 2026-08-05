import React, { useState } from 'react';
import { User, Wallet } from '../types';
import {
  X, User as UserIcon, Shield, Wallet as WalletIcon, RefreshCw, LogOut,
  Key, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Zap, Layers, Award
} from 'lucide-react';

interface UserProfileModalProps {
  user: User;
  wallet: Wallet | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onRefreshWallet: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user, wallet, isOpen, onClose, onLogout, onRefreshWallet
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'FUNDS' | 'SECURITY' | 'LIMITS'>('PROFILE');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Fund Deposit & Withdrawal Request State
  const [requestType, setRequestType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [fundAmount, setFundAmount] = useState<number>(50000);
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [referenceNote, setReferenceNote] = useState<string>('');
  const [fundMessage, setFundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [myFundRequests, setMyFundRequests] = useState<any[]>([]);
  const [submittingFundReq, setSubmittingFundReq] = useState(false);

  const fetchMyFundRequests = async () => {
    try {
      const res = await fetch('/api/v1/funds/my-requests', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setMyFundRequests(data.requests);
      }
    } catch (_) {}
  };

  React.useEffect(() => {
    if (isOpen && activeTab === 'FUNDS') {
      fetchMyFundRequests();
    }
  }, [isOpen, activeTab]);

  const handleSubmitFundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundMessage(null);
    setSubmittingFundReq(true);

    try {
      const res = await fetch('/api/v1/funds/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          requestType,
          amount: fundAmount,
          paymentMethod,
          referenceNote
        })
      });
      const data = await res.json();
      if (data.success) {
        setFundMessage({ type: 'success', text: data.message });
        setReferenceNote('');
        fetchMyFundRequests();
      } else {
        setFundMessage({ type: 'error', text: data.error?.message || 'Request failed' });
      }
    } catch (err: any) {
      setFundMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingFundReq(false);
    }
  };

  if (!isOpen) return null;

  const getInitials = (name: string) => {
    return name ? name.slice(0, 2).toUpperCase() : 'US';
  };

  const handleResetCapital = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        onRefreshWallet();
        setResetMessage('Capital updated successfully.');
      }
    } catch (_) {
      setResetMessage('Failed to refresh balance.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#131d35] to-slate-900 p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              {getInitials(user.username)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">{user.username}</h2>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                  {user.role}
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{user.email} · ID: {user.id}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-950 border-b border-slate-800 px-6 pt-3 gap-2 text-xs font-semibold">
          {[
            { key: 'PROFILE', label: 'User Details', icon: <UserIcon className="w-3.5 h-3.5" /> },
            { key: 'FUNDS', label: 'Fund', icon: <WalletIcon className="w-3.5 h-3.5" /> },
            { key: 'LIMITS', label: 'Trading Permissions', icon: <Layers className="w-3.5 h-3.5" /> },
            { key: 'SECURITY', label: 'Security & Auth', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`pb-3 px-3 transition flex items-center gap-1.5 border-b-2 ${
                activeTab === t.key
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {resetMessage && (
            <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 p-3 rounded-xl flex items-center justify-between font-semibold">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {resetMessage}</span>
              <button onClick={() => setResetMessage(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* TAB 1: USER DETAILS */}
          {activeTab === 'PROFILE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">Account Overview</span>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Username</span>
                  <span className="font-semibold text-white">{user.username}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Email Address</span>
                  <span className="font-mono text-slate-300">{user.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Client Account ID</span>
                  <span className="font-mono text-amber-400">{user.id}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Platform Role</span>
                  <span className="font-bold text-emerald-400">{user.role}</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">Trading Tier & Status</span>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Trading Mode</span>
                  <span className="font-bold text-indigo-400">SIMULATED PAPER TRADING</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Exchange Access</span>
                  <span className="font-semibold text-white">NSE, BSE, NFO</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Order Routing</span>
                  <span className="font-semibold text-emerald-400">Direct Simulated OMS</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">KYC Status</span>
                  <span className="font-bold text-emerald-400">VERIFIED</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VIRTUAL CAPITAL & FUNDS */}
          {activeTab === 'FUNDS' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cash Balance</span>
                  <span className="text-2xl font-bold font-mono text-white block mt-1">
                    ₹{(wallet?.cashBalance || 1000000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Capital balance provided for trading</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Buying Power</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400 block mt-1">
                    ₹{(wallet?.buyingPower || 1000000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Available for new order placement</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">BLOCKED MARGIN</span>
                  <span className="font-bold font-mono text-amber-400 text-sm">
                    ₹{(wallet?.usedMargin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">REALIZED P&L</span>
                  <span className={`font-bold font-mono text-sm ${(wallet?.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(wallet?.realizedPnl || 0) >= 0 ? '+' : ''}₹{(wallet?.realizedPnl || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">UNREALIZED P&L</span>
                  <span className={`font-bold font-mono text-sm ${(wallet?.unrealizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(wallet?.unrealizedPnl || 0) >= 0 ? '+' : ''}₹{(wallet?.unrealizedPnl || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Deposit / Withdraw Request Form */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Fund Deposit & Withdrawal Request</h4>
                  <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
                    Requires Admin Approval
                  </span>
                </div>

                <form onSubmit={handleSubmitFundRequest} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestType('DEPOSIT')}
                      className={`py-2 rounded-lg font-bold text-xs transition border ${
                        requestType === 'DEPOSIT' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      + Request Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType('WITHDRAWAL')}
                      className={`py-2 rounded-lg font-bold text-xs transition border ${
                        requestType === 'WITHDRAWAL' ? 'bg-rose-600 border-rose-500 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      - Request Withdrawal
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(Math.max(100, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs font-semibold"
                      >
                        <option value="UPI">UPI Transfer</option>
                        <option value="IMPS_NEFT">IMPS / NEFT</option>
                        <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                        <option value="WALLET">Digital Wallet</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Reference / Transaction Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR Number / Reference ID"
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white text-xs"
                    />
                  </div>

                  {fundMessage && (
                    <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                      fundMessage.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {fundMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingFundReq}
                    className={`w-full py-2.5 rounded-lg font-bold text-white transition flex items-center justify-center gap-2 ${
                      requestType === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                    }`}
                  >
                    Submit {requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Request for Admin Approval
                  </button>
                </form>
              </div>

              {/* My Requests History List */}
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">My Fund Request History</h4>
                <div className="overflow-x-auto max-h-[160px]">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] sticky top-0">
                      <tr>
                        <th className="py-2 px-2">Req ID</th>
                        <th className="py-2 px-2">Type</th>
                        <th className="py-2 px-2 text-right">Amount</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {myFundRequests.map(r => (
                        <tr key={r.id}>
                          <td className="py-1.5 px-2 text-amber-400 text-[10px]">{r.request_id}</td>
                          <td className="py-1.5 px-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.request_type === 'DEPOSIT' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                              {r.request_type}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-white">₹{parseFloat(r.amount).toLocaleString('en-IN')}</td>
                          <td className="py-1.5 px-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              r.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                              r.status === 'REJECTED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                              'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {r.status === 'PENDING' ? 'Pending Admin Approval' : r.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-[9px] text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {myFundRequests.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-500 text-[11px]">No prior fund requests.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleResetCapital}
                  disabled={isResetting}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} /> Sync & Refresh Wallet
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TRADING PERMISSIONS */}
          {activeTab === 'LIMITS' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">INTRADAY (MIS)</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">5.0x Leverage</span>
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">Auto square-off @ 15:15</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">DELIVERY (CNC)</span>
                  <span className="text-lg font-bold text-blue-400 mt-1 block">1.0x Full Cash</span>
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">Demat Holding Enabled</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">DERIVATIVES (NRML)</span>
                  <span className="text-lg font-bold text-purple-400 mt-1 block">SPAN + Exposure</span>
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">Options & Futures Active</span>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">RMS Limit Safeguards</span>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Max Single Order Quantity</span>
                  <span className="font-mono text-white">50,000 Qty</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Max Single Order Value</span>
                  <span className="font-mono text-emerald-400">₹1,00,000,00.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Order Rate Limit</span>
                  <span className="font-mono text-amber-400">30 Orders / Minute</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY */}
          {activeTab === 'SECURITY' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">Authentication & Session</span>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">JWT Access Token</span>
                  <span className="font-mono text-emerald-400">Active (24h validity)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span className="text-slate-400">Password Encryption</span>
                  <span className="font-mono text-white">Argon2id Salted Hash</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Real Money Lock</span>
                  <span className="font-bold text-emerald-400">Active (Simulation Mode Only)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-500" /> StockSharp Trading Platform
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl font-semibold transition"
            >
              Close
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-2 transition shadow-lg shadow-rose-600/20"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
