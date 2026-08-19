import React, { useState, useEffect } from 'react';
import { 
  X, 
  QrCode, 
  Smartphone, 
  ExternalLink, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  DollarSign, 
  Copy, 
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Wallet as WalletIcon
} from 'lucide-react';
import { Wallet } from '../types';

interface LinkPeAddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  wallet?: Wallet | null;
  initialTab?: 'DEPOSIT' | 'WITHDRAWAL';
  onRefreshWallet: () => void;
}

export const LinkPeAddFundsModal: React.FC<LinkPeAddFundsModalProps> = ({
  isOpen,
  onClose,
  token,
  wallet,
  initialTab = 'DEPOSIT',
  onRefreshWallet
}) => {
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'WITHDRAWAL'>(initialTab);
  
  // Deposit States
  const [depositAmountInput, setDepositAmountInput] = useState<string>('5000');
  const depositAmount = parseFloat(depositAmountInput) || 0;
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [customUpiId, setCustomUpiId] = useState<string>('expertstokks@axl');
  
  // Withdrawal States
  const [withdrawAmountInput, setWithdrawAmountInput] = useState<string>('5000');
  const withdrawAmount = parseFloat(withdrawAmountInput) || 0;
  const [payoutMethod, setPayoutMethod] = useState<string>('BANK_TRANSFER');
  const [payoutDetails, setPayoutDetails] = useState<string>('');
  
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // LinkPe Payment Payload
  const [paymentDetails, setPaymentDetails] = useState<{
    linkpeUrl: string;
    upiDeepLink: string;
    gpayDeepLink?: string;
    phonepeDeepLink?: string;
    paytmDeepLink?: string;
    bhimDeepLink?: string;
    qrCodeUrl: string;
    upiId: string;
    merchantName: string;
  } | null>(null);
  const [loadingPayment, setLoadingPayment] = useState<boolean>(false);

  // User's Fund Request History
  const [myRequests, setMyRequests] = useState<any[]>([]);

  const availableBalance = wallet?.buyingPower ?? wallet?.cashBalance ?? 0;

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    };
    return fetch(url, { ...options, headers });
  };

  const fetchLinkPeDetails = () => {
    if (!token || depositAmount < 100) return;
    setLoadingPayment(true);
    fetchWithAuth(`/api/v1/funds/upi-link?amount=${depositAmount}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.payment) {
          setPaymentDetails(d.payment);
          if (!customUpiId || customUpiId === 'expertstokks@axl') {
            setCustomUpiId(d.payment.upiId || 'expertstokks@axl');
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPayment(false));
  };

  const fetchMyRequests = () => {
    if (!token) return;
    fetchWithAuth('/api/v1/funds/my-requests')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.requests)) {
          setMyRequests(d.requests);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchLinkPeDetails();
      fetchMyRequests();
      setMsg(null);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'DEPOSIT') {
      fetchLinkPeDetails();
    }
  }, [depositAmount, activeTab]);

  const handleCopyUpi = () => {
    const targetUpi = customUpiId.trim() || paymentDetails?.upiId || 'expertstokks@axl';
    navigator.clipboard.writeText(targetUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      setMsg({ type: 'error', text: 'Please enter the 12-digit UPI UTR / Reference Transaction Number' });
      return;
    }

    setSubmitting(true);
    setMsg(null);

    try {
      const res = await fetchWithAuth('/api/v1/funds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'DEPOSIT',
          amount: depositAmount,
          paymentMethod: 'LINKPE_UPI',
          referenceNote: `UTR: ${utrNumber.trim()}`
        })
      });

      const data = await res.json();

      if (data.success) {
        setMsg({ type: 'success', text: data.message || 'Deposit request submitted successfully for admin approval!' });
        setUtrNumber('');
        fetchMyRequests();
        onRefreshWallet();
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Failed to submit deposit request' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Network error while submitting deposit request' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount <= 0) {
      setMsg({ type: 'error', text: 'Withdrawal amount must be greater than ₹0' });
      return;
    }
    if (withdrawAmount > availableBalance) {
      setMsg({ type: 'error', text: `Insufficient available funds. Maximum withdrawable: ₹${availableBalance.toLocaleString('en-IN')}` });
      return;
    }

    setSubmitting(true);
    setMsg(null);

    try {
      const res = await fetchWithAuth('/api/v1/funds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'WITHDRAWAL',
          amount: withdrawAmount,
          paymentMethod: payoutMethod,
          referenceNote: payoutDetails.trim() || 'Bank Payout'
        })
      });

      const data = await res.json();

      if (data.success) {
        setMsg({ type: 'success', text: data.message || 'Withdrawal request submitted successfully for Admin approval!' });
        fetchMyRequests();
        onRefreshWallet();
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Failed to submit withdrawal request' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Network error while submitting withdrawal request' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const activeUpiId = customUpiId.trim() || paymentDetails?.upiId || 'expertstokks@axl';
  const activeMerchant = paymentDetails?.merchantName || 'Trade Grow Broker';
  const activeUpiDeepLink = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activeMerchant)}&am=${depositAmount}&cu=INR`;
  const activeGPayLink = paymentDetails?.gpayDeepLink || `tez://upi/pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activeMerchant)}&am=${depositAmount}&cu=INR`;
  const activePhonePeLink = paymentDetails?.phonepeDeepLink || `phonepe://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activeMerchant)}&am=${depositAmount}&cu=INR`;
  const activePaytmLink = paymentDetails?.paytmDeepLink || `paytmmp://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activeMerchant)}&am=${depositAmount}&cu=INR`;
  
  // Prioritize server Base64 data URL for 100% reliable local QR code rendering
  const activeQrCodeUrl = paymentDetails?.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(activeUpiDeepLink)}`;
  const activeLinkPeUrl = `https://ptprashanttripathi.github.io/linkpe/?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activeMerchant)}&amt=${depositAmount}&tn=Trade%20Grow%20Margin%20Deposit`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border shadow-sm ${
              activeTab === 'DEPOSIT' 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}>
              {activeTab === 'DEPOSIT' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {activeTab === 'DEPOSIT' ? 'ADD FUNDS (DEPOSIT)' : 'REQUEST WITHDRAWAL'}
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  activeTab === 'DEPOSIT'
                    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}>
                  {activeTab === 'DEPOSIT' ? 'Instant LinkPe UPI' : 'Bank Payout'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {activeTab === 'DEPOSIT' 
                  ? 'Deposit margin via LinkPe QR or direct UPI apps and submit transaction reference for instant review.' 
                  : 'Withdraw trading proceeds directly to your linked bank account or UPI ID.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition border border-slate-200 dark:border-slate-700/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Deposit vs Withdrawal */}
        <div className="px-5 pt-4 pb-2 grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => { setActiveTab('DEPOSIT'); setMsg(null); }}
            className={`py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === 'DEPOSIT'
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Deposit Funds (LinkPe UPI)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('WITHDRAWAL'); setMsg(null); }}
            className={`py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 border cursor-pointer ${
              activeTab === 'WITHDRAWAL'
                ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20'
                : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Request Withdrawal</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-6 overflow-y-auto custom-scrollbar">

          {/* ============================================================
              TAB 1: DEPOSIT FUNDS
              ============================================================ */}
          {activeTab === 'DEPOSIT' && (
            <>
              {/* Preset Deposit Amounts */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Select Deposit Amount (₹)</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[500, 1000, 5000, 10000, 25000, 50000].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDepositAmountInput(preset.toString())}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                        depositAmount === preset
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20 font-black'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Input */}
                <div className="relative mt-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={depositAmountInput}
                    onChange={e => setDepositAmountInput(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl pl-8 pr-4 py-3 text-slate-900 dark:text-white font-mono font-extrabold text-base focus:outline-none focus:border-emerald-500 shadow-xs"
                    placeholder="Enter deposit amount"
                  />
                </div>
              </div>

              {/* LinkPe Merchant Payment Gateway Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 dark:bg-slate-900/90 border border-emerald-200/80 dark:border-emerald-500/30 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-slate-800 pb-3">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> LinkPe Merchant Payment Gateway
                  </span>

                  {/* EDITABLE ACCOUNT FIELD */}
                  <div className="flex items-center gap-1.5 bg-white dark:bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-300 dark:border-emerald-500/30 shadow-2xs">
                    <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider hidden sm:inline">UPI / Account:</span>
                    <input
                      type="text"
                      value={customUpiId}
                      onChange={(e) => setCustomUpiId(e.target.value)}
                      className="bg-emerald-50/60 dark:bg-slate-950 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-400/50 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[140px] max-w-[200px]"
                      placeholder="Account VPA / UPI ID"
                      title="Click to edit Account / UPI ID VPA"
                    />
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition cursor-pointer"
                      title="Copy Account ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {loadingPayment ? (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Generating LinkPe Payment Links & QR Code...</span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Reliable QR Code Image with Multi-fallback */}
                    <div className="relative group shrink-0">
                      <img
                        src={activeQrCodeUrl}
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.fallbackTried) {
                            target.dataset.fallbackTried = 'true';
                            target.src = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(activeUpiDeepLink)}`;
                          }
                        }}
                        alt="LinkPe UPI QR Code"
                        className="w-32 h-32 rounded-2xl border border-emerald-300 dark:border-emerald-500/40 p-1.5 bg-white shadow-md transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/0 group-hover:border-emerald-400/40 pointer-events-none transition-all duration-300" />
                    </div>

                    <div className="flex-1 w-full space-y-3">
                      <div className="text-center sm:text-left">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Pay Deposit Amount: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold font-mono text-sm">₹{depositAmount.toLocaleString('en-IN')}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Merchant: <strong className="text-slate-900 dark:text-white font-bold">{activeMerchant}</strong></span>
                      </div>

                      {/* Direct Dedicated App Launches (prevents iOS Chrome from auto-opening WhatsApp) */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Pay Directly via Selected App:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <a
                            href={activeGPayLink}
                            className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-black text-white text-[11px] font-extrabold flex items-center justify-center gap-1 transition border border-slate-700 shadow-2xs cursor-pointer"
                            title="Pay with Google Pay"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                            <span>GPay</span>
                          </a>
                          <a
                            href={activePhonePeLink}
                            className="py-2 px-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer"
                            title="Pay with PhonePe"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-purple-200" />
                            <span>PhonePe</span>
                          </a>
                          <a
                            href={activePaytmLink}
                            className="py-2 px-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer"
                            title="Pay with Paytm"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-sky-100" />
                            <span>Paytm</span>
                          </a>
                          <a
                            href={activeUpiDeepLink}
                            className="py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer"
                            title="Pay with any default UPI App"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-100" />
                            <span>Any UPI</span>
                          </a>
                        </div>
                      </div>

                      <a
                        href={activeLinkPeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition border border-slate-300 dark:border-slate-700 cursor-pointer shadow-2xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Open LinkPe Web Checkout Page</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit UTR / Payment Proof Form */}
              <form onSubmit={handleSubmitDeposit} className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" /> Submit UTR / Reference ID for Admin Approval
                </h3>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    12-Digit UPI UTR / Transaction Reference Number
                  </label>
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={e => setUtrNumber(e.target.value)}
                    placeholder="e.g. 423589102451 or Bank UTR Ref Number"
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                {msg && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}>
                    {msg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <span>Submitting Request...</span>
                  ) : (
                    <span>Submit ₹{depositAmount.toLocaleString('en-IN')} Deposit Request for Admin Approval</span>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ============================================================
              TAB 2: WITHDRAW FUNDS
              ============================================================ */}
          {activeTab === 'WITHDRAWAL' && (
            <div className="space-y-4">
              
              {/* Available Margin Banner */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <WalletIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">Available Margin for Withdrawal</span>
                    <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setWithdrawAmountInput(Math.floor(availableBalance).toString())}
                  disabled={availableBalance <= 0}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-40"
                >
                  Withdraw Max
                </button>
              </div>

              {/* Withdrawal Form */}
              <form onSubmit={handleSubmitWithdrawal} className="space-y-4 bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                {/* Preset Withdrawal Amounts */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Select Withdrawal Amount (₹)</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[500, 1000, 5000, 10000, 25000].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWithdrawAmountInput(preset.toString())}
                        className={`py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                          withdrawAmount === preset
                            ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                      </button>
                    ))}
                  </div>

                  {/* Custom Withdrawal Input */}
                  <div className="relative mt-2">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={withdrawAmountInput}
                      onChange={e => setWithdrawAmountInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl pl-8 pr-4 py-3 text-slate-900 dark:text-white font-mono font-extrabold text-base focus:outline-none focus:border-rose-500 shadow-2xs"
                      placeholder="Enter withdrawal amount"
                    />
                  </div>
                </div>

                {/* Payout Method */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Payout Channel</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'BANK_TRANSFER', label: 'Bank IMPS / NEFT' },
                      { id: 'UPI', label: 'UPI Instant Payout' },
                      { id: 'WALLET', label: 'Digital Wallet' }
                    ].map(method => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPayoutMethod(method.id)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                          payoutMethod === method.id
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Account / UPI Reference */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Bank Account / UPI ID / Payout Instructions
                  </label>
                  <input
                    type="text"
                    value={payoutDetails}
                    onChange={e => setPayoutDetails(e.target.value)}
                    placeholder="e.g. Account Number & IFSC, or your_upi_id@okhdfcbank"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Verified bank details from your KYC profile will be prioritized by the finance team.
                  </span>
                </div>

                {msg && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}>
                    {msg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || withdrawAmount <= 0 || withdrawAmount > availableBalance}
                  className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  {submitting ? (
                    <span>Processing Withdrawal...</span>
                  ) : (
                    <span>Submit ₹{withdrawAmount.toLocaleString('en-IN')} Withdrawal Request</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ============================================================
              LIVE REQUEST HISTORY & TRACKER (Both Deposits & Withdrawals)
              ============================================================ */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" /> Funds & Payout Activity Tracker
              </h3>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Total: {myRequests.length}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2 px-3">Req ID</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 bg-white dark:bg-slate-950">
                  {myRequests.map((r: any) => {
                    const isDeposit = (r.request_type || 'DEPOSIT').toUpperCase() === 'DEPOSIT';
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">{r.request_id}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isDeposit ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}>
                            {isDeposit ? '+ Deposit' : '- Withdrawal'}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-bold ${
                          isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {isDeposit ? '+' : '-'}₹{parseFloat(r.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">{r.payment_method}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${
                            r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' :
                            r.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30' :
                            'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                          }`}>
                            {r.status === 'APPROVED' ? 'APPROVED' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING APPROVAL'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[10px] font-mono text-slate-500">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                  {myRequests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500 text-xs">No previous deposit or withdrawal requests recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
