import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, ShieldCheck, Wallet as WalletIcon, Lock, CheckCircle, AlertTriangle, Clock, RefreshCw, Zap, QrCode, ExternalLink, Smartphone } from 'lucide-react';
import { User, Wallet } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  wallet: Wallet | null;
  token?: string | null;
  initialTab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'PERMISSIONS' | 'SECURITY';
  onRefreshWallet: () => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  wallet,
  token,
  initialTab = 'PROFILE',
  onRefreshWallet,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'KYC' | 'FUNDS' | 'PERMISSIONS' | 'SECURITY'>(initialTab);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Helper for authenticated fetch calls with auto-token refresh & fallback
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const getFreshToken = () => token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token') || '';
    let currentToken = getFreshToken();

    const headers = new Headers(options.headers || {});
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    let res = await fetch(url, { ...options, headers });
    
    // If 401/403 or invalid token, attempt silent token refresh with refreshToken
    if (res.status === 401 || res.status === 403) {
      const savedRefreshToken = localStorage.getItem('refreshToken');
      if (savedRefreshToken) {
        try {
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: savedRefreshToken })
          });
          const refreshData = await refreshRes.json();
          if (refreshData.success && refreshData.token) {
            localStorage.setItem('token', refreshData.token);
            headers.set('Authorization', `Bearer ${refreshData.token}`);
            res = await fetch(url, { ...options, headers });
          }
        } catch (_) {}
      }
    }

    return res;
  };

  // KYC Form State
  const [kycStatus, setKycStatus] = useState<string>('NOT_STARTED');
  const [kycApp, setKycApp] = useState<any>(null);
  const [kycDocs, setKycDocs] = useState<any[]>([]);

  const [panNumber, setPanNumber] = useState<string>('');
  const [aadhaarNumber, setAadhaarNumber] = useState<string>('');
  const [bankAccountName, setBankAccountName] = useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [bankIfsc, setBankIfsc] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<File | null>(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState<File | null>(null);
  const [bankProofFile, setBankProofFile] = useState<File | null>(null);

  const [kycMessage, setKycMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);

  const fetchKycStatus = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/kyc/status');
      const data = await res.json();
      if (data.success) {
        setKycStatus(data.status || 'NOT_STARTED');
        setKycApp(data.application || null);
        setKycDocs(data.documents || []);
        if (data.application) {
          setPanNumber(data.application.pan_number || '');
          setAadhaarNumber(data.application.aadhaar_number || '');
          setBankAccountName(data.application.bank_account_name || '');
          setBankAccountNumber(data.application.bank_account_number || '');
          setBankIfsc(data.application.bank_ifsc || '');
          setBankName(data.application.bank_name || '');
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen && activeTab === 'KYC') {
      fetchKycStatus();
    }
  }, [isOpen, activeTab]);

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycMessage(null);
    setSubmittingKyc(true);

    try {
      const formData = new FormData();
      formData.append('panNumber', panNumber);
      formData.append('aadhaarNumber', aadhaarNumber);
      formData.append('bankAccountName', bankAccountName);
      formData.append('bankAccountNumber', bankAccountNumber);
      formData.append('bankIfsc', bankIfsc);
      formData.append('bankName', bankName);

      if (panFile) formData.append('panDoc', panFile);
      if (aadhaarFrontFile) formData.append('aadhaarFrontDoc', aadhaarFrontFile);
      if (aadhaarBackFile) formData.append('aadhaarBackDoc', aadhaarBackFile);
      if (bankProofFile) formData.append('bankProofDoc', bankProofFile);

      const res = await fetchWithAuth('/api/v1/kyc/submit', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setKycMessage({ type: 'success', text: data.message });
        fetchKycStatus();
      } else {
        setKycMessage({ type: 'error', text: data.error?.message || 'KYC submission failed' });
      }
    } catch (err: any) {
      setKycMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingKyc(false);
    }
  };

  // Fund Deposit & Withdrawal Request State
  const [requestType, setRequestType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [executionMode, setExecutionMode] = useState<'INSTANT' | 'ADMIN_APPROVAL'>('INSTANT');
  const [fundAmount, setFundAmount] = useState<number>(50000);
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [referenceNote, setReferenceNote] = useState<string>('');
  const [fundMessage, setFundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [myFundRequests, setMyFundRequests] = useState<any[]>([]);
  const [submittingFundReq, setSubmittingFundReq] = useState(false);

  // LinkPe UPI Payment State
  const [linkpeData, setLinkpeData] = useState<{
    linkpeUrl: string;
    upiDeepLink: string;
    qrCodeUrl: string;
    upiId: string;
    merchantName: string;
  } | null>(null);
  const [loadingLinkpe, setLoadingLinkpe] = useState(false);

  useEffect(() => {
    if (paymentMethod === 'UPI' && requestType === 'DEPOSIT' && fundAmount > 0) {
      setLoadingLinkpe(true);
      fetchWithAuth(`/api/v1/funds/upi-link?amount=${fundAmount}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) setLinkpeData(d.payment);
        })
        .catch(() => {})
        .finally(() => setLoadingLinkpe(false));
    }
  }, [fundAmount, paymentMethod, requestType]);

  const fetchMyFundRequests = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/funds/my-requests');
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setMyFundRequests(data.requests);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen && activeTab === 'FUNDS') {
      fetchMyFundRequests();
    }
  }, [isOpen, activeTab]);

  const handleSubmitFundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundMessage(null);
    setSubmittingFundReq(true);

    try {
      const res = await fetchWithAuth('/api/v1/funds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setFundAmount(50000);
        setReferenceNote('');
        fetchMyFundRequests();
        onRefreshWallet();
      } else {
        setFundMessage({ type: 'error', text: data.error?.message || 'Failed to submit fund request' });
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
      const res = await fetchWithAuth('/api/v1/funds/reset-margin', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onRefreshWallet();
        setResetMessage(data.message || 'Capital reset successfully.');
      } else {
        setResetMessage(data.error?.message || 'Failed to reset balance.');
      }
    } catch (_) {
      setResetMessage('Failed to reset balance.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 animate-in fade-in touch-action-manipulation">
      <div className="bg-[#0D1117] border border-[#30363D] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-[#161B22] p-5 border-b border-[#30363D] flex items-center justify-between font-headline">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#00E676] text-[#0D1117] flex items-center justify-center text-lg font-black shadow-lg shadow-[#00E676]/20 border border-[#00E676]/30">
              {getInitials(user.username)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight capitalize">{user.username}</h2>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                  {user.role}
                </span>
                <span className="bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" /> ACTIVE
                </span>
              </div>
              <p className="text-xs text-[#8B949E] mt-0.5 font-mono">{user.email} · ID: {user.id}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8B949E] hover:text-white rounded-xl hover:bg-[#30363D] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-[#0D1117] border-b border-[#30363D] px-4 pt-3 gap-2 text-xs font-bold font-headline overflow-x-auto scrollbar-none">
          {[
            { key: 'PROFILE', label: 'User Details', icon: <UserIcon className="w-3.5 h-3.5" /> },
            { key: 'KYC', label: 'KYC Verification', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            { key: 'FUNDS', label: 'Fund', icon: <WalletIcon className="w-3.5 h-3.5 text-[#00E676]" /> },
            { key: 'PERMISSIONS', label: 'Trading Permissions', icon: <Clock className="w-3.5 h-3.5" /> },
            { key: 'SECURITY', label: 'Security & Auth', icon: <Lock className="w-3.5 h-3.5" /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-2.5 px-3 rounded-t-xl transition-all flex items-center gap-2 border-b-2 font-black ${
                activeTab === tab.key
                  ? 'border-[#00E676] text-[#00E676] bg-[#161B22]'
                  : 'border-transparent text-[#8B949E] hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body Content */}
        <div className="p-5 overflow-y-auto flex-1 font-label text-xs space-y-4">
          
          {/* FUNDS TAB */}
          {activeTab === 'FUNDS' && (
            <div className="space-y-4">
              
              {/* Account Balance Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-label">
                <div className="bg-[#161B22] p-3 rounded-2xl border border-[#30363D]">
                  <span className="text-[9px] text-[#8B949E] font-bold block uppercase font-headline">TOTAL FUND</span>
                  <span className="font-extrabold font-mono text-white text-base mt-0.5 block tabular-nums">
                    ₹{(wallet?.cashBalance ?? 50000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5">Account Net Cash Balance</span>
                </div>

                <div className="bg-[#161B22] p-3 rounded-2xl border border-[#30363D]">
                  <span className="text-[9px] text-[#8B949E] font-bold block uppercase font-headline">AVAILABLE BALANCE</span>
                  <span className="font-extrabold font-mono text-[#00E676] text-base mt-0.5 block tabular-nums">
                    ₹{(wallet?.buyingPower ?? wallet?.cashBalance ?? 50000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5">Available for new trades</span>
                </div>

                <div className="bg-[#161B22] p-3 rounded-2xl border border-[#30363D]">
                  <span className="text-[9px] text-[#8B949E] font-bold block uppercase font-headline">USED FUNDS</span>
                  <span className="font-extrabold font-mono text-amber-400 text-base mt-0.5 block tabular-nums">
                    ₹{(wallet?.usedMargin ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5">Blocked in open positions</span>
                </div>

                <div className="bg-[#161B22] p-3 rounded-2xl border border-[#30363D]">
                  <span className="text-[9px] text-[#8B949E] font-bold block uppercase font-headline">REALIZED P&L</span>
                  <span className={`font-extrabold font-mono text-base mt-0.5 block tabular-nums ${(wallet?.realizedPnl ?? 0) >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                    {(wallet?.realizedPnl ?? 0) >= 0 ? '+' : ''}₹{(wallet?.realizedPnl ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5">Closed position profits</span>
                </div>

                <div className="bg-[#161B22] p-3 rounded-2xl border border-[#30363D]">
                  <span className="text-[9px] text-[#8B949E] font-bold block uppercase font-headline">UNREALIZED P&L</span>
                  <span className={`font-extrabold font-mono text-base mt-0.5 block tabular-nums ${(wallet?.unrealizedPnl ?? 0) >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                    {(wallet?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}₹{(wallet?.unrealizedPnl ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5">Live open position P&L</span>
                </div>

                <div className="bg-[#161B22] p-3 rounded-2xl border border-[#30363D]">
                  <span className="text-[9px] text-[#8B949E] font-bold block uppercase font-headline">ACCOUNT EQUITY</span>
                  <span className="font-extrabold font-mono text-cyan-400 text-base mt-0.5 block tabular-nums">
                    ₹{((wallet?.cashBalance ?? 50000) + (wallet?.unrealizedPnl ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5">Cash + Live Open P&L</span>
                </div>
              </div>

              {/* Deposit / Withdraw Form */}
              <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#30363D] pb-2 font-headline">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">FUND DEPOSIT & WITHDRAWAL REQUEST</h4>
                  <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded font-mono">
                    Requires Admin Approval
                  </span>
                </div>

                <form onSubmit={handleSubmitFundRequest} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 font-headline">
                    <button
                      type="button"
                      onClick={() => setRequestType('DEPOSIT')}
                      className={`py-2 rounded-xl font-black text-xs transition border ${
                        requestType === 'DEPOSIT' ? 'bg-[#00E676] border-[#00E676] text-[#0D1117] shadow-sm' : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]'
                      }`}
                    >
                      + Request Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType('WITHDRAWAL')}
                      className={`py-2 rounded-xl font-black text-xs transition border ${
                        requestType === 'WITHDRAWAL' ? 'bg-[#FF5252] border-[#FF5252] text-white shadow-sm' : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]'
                      }`}
                    >
                      - Request Withdrawal
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase font-headline">Amount (₹)</label>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(Math.max(100, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-[#00E676] tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase font-headline">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white text-xs font-bold"
                      >
                        <option value="UPI">UPI Transfer</option>
                        <option value="IMPS_NEFT">IMPS / NEFT</option>
                        <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                        <option value="WALLET">Digital Wallet</option>
                      </select>
                    </div>
                  </div>

                  {/* LinkPe UPI Payment Box */}
                  {requestType === 'DEPOSIT' && paymentMethod === 'UPI' && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900/90 border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <QrCode className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">LinkPe Instant UPI Payment</span>
                            <span className="text-[10px] text-slate-400 block">Scan QR or Tap to open UPI App</span>
                          </div>
                        </div>
                        {linkpeData && (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            {linkpeData.upiId}
                          </span>
                        )}
                      </div>

                      {linkpeData ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                          <img
                            src={linkpeData.qrCodeUrl}
                            alt="LinkPe UPI QR Code"
                            className="w-28 h-28 rounded-lg border border-emerald-500/30 p-1 bg-white shrink-0 shadow-md"
                          />
                          <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                            <span className="text-[11px] font-semibold text-slate-300 block">
                              Pay <span className="font-bold font-mono text-emerald-400">₹{fundAmount.toLocaleString('en-IN')}</span> to <span className="text-white font-bold">{linkpeData.merchantName}</span>
                            </span>
                            
                            <div className="flex flex-col gap-1.5">
                              <a
                                href={linkpeData.upiDeepLink}
                                className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>Open UPI App (GPay / PhonePe / Paytm)</span>
                              </a>
                              <a
                                href={linkpeData.linkpeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition border border-slate-700"
                              >
                                <ExternalLink className="w-3 h-3 text-emerald-400" />
                                <span>Open LinkPe Payment Page</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-slate-400 text-xs flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          <span>Generating LinkPe UPI Payment details...</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase font-headline">Reference / Transaction Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR Number / Reference ID"
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-[#00E676]"
                    />
                  </div>

                  {fundMessage && (
                    <div className={`p-3 rounded-xl text-xs font-bold ${
                      fundMessage.type === 'success' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30' : 'bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/30'
                    }`}>
                      {fundMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingFundReq}
                    className={`w-full py-3 rounded-xl font-headline font-black text-xs text-white transition flex items-center justify-center gap-2 shadow-md ${
                      requestType === 'DEPOSIT' ? 'bg-[#00E676] hover:bg-[#00C853] text-[#0D1117]' : 'bg-[#FF5252] hover:bg-rose-600'
                    }`}
                  >
                    {submittingFundReq ? (
                      <span>Processing...</span>
                    ) : (
                      <span>Submit {requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Request for Admin Approval</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Fund Request History */}
              <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-2xl space-y-2 font-headline">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">MY FUND REQUEST HISTORY</h4>
                <div className="overflow-x-auto max-h-[160px]">
                  <table className="w-full text-xs text-left text-[#8B949E] font-label">
                    <thead>
                      <tr className="border-b border-[#30363D] text-[10px] text-[#8B949E] uppercase font-bold">
                        <th className="py-2">Date</th>
                        <th className="py-2">Type</th>
                        <th className="py-2 text-right">Amount</th>
                        <th className="py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30363D] tabular-nums">
                      {myFundRequests.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-[#8B949E]">No fund request history recorded.</td>
                        </tr>
                      ) : (
                        myFundRequests.map((r: any) => (
                          <tr key={r.id}>
                            <td className="py-2 text-[#8B949E]">{new Date(r.created_at || Date.now()).toLocaleDateString()}</td>
                            <td className="py-2 font-bold text-white">{r.request_type}</td>
                            <td className="py-2 text-right font-bold text-white">₹{parseFloat(r.amount).toLocaleString('en-IN')}</td>
                            <td className="py-2 text-right font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                r.status === 'APPROVED' ? 'bg-[#00E676]/20 text-[#00E676]' :
                                r.status === 'REJECTED' ? 'bg-[#FF5252]/20 text-[#FF5252]' : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              <div className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-2 font-headline">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#8B949E]">Username</span>
                  <span className="font-bold text-white">{user.username}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#8B949E]">Email</span>
                  <span className="font-bold text-white">{user.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#8B949E]">Role</span>
                  <span className="font-bold text-[#00E676] uppercase">{user.role}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleResetCapital}
                  disabled={isResetting}
                  className="w-full py-2.5 rounded-xl bg-[#1C2128] border border-[#30363D] hover:bg-[#30363D] font-bold text-xs text-white transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} className={isResetting ? 'animate-spin' : ''} /> Refresh Account Balance
                </button>
                {resetMessage && (
                  <p className="text-center text-xs text-[#00E676] font-bold mt-2">{resetMessage}</p>
                )}
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'SECURITY' && (
            <div className="space-y-4 font-headline">
              <div className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-3">
                <h4 className="font-bold text-white text-xs">Account Security</h4>
                <p className="text-[#8B949E] text-xs">JWT 256-bit authentication token is active.</p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#161B22] border-t border-[#30363D] flex items-center justify-between shrink-0 font-headline">
          <span className="text-[10px] text-[#8B949E] font-bold">Trade Grow — Smart Trading Platform</span>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#8B949E] border border-[#30363D] hover:text-white hover:bg-[#1C2128]"
            >
              Close
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF5252] hover:bg-rose-600 shadow-md"
            >
              Log Out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
