import React, { useState, useEffect } from 'react';
import { X, QrCode, Smartphone, ExternalLink, ShieldCheck, Clock, CheckCircle2, AlertCircle, RefreshCw, DollarSign, Copy, Check } from 'lucide-react';

interface LinkPeAddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  onRefreshWallet: () => void;
}

export const LinkPeAddFundsModal: React.FC<LinkPeAddFundsModalProps> = ({
  isOpen,
  onClose,
  token,
  onRefreshWallet
}) => {
  const [amount, setAmount] = useState<number>(5000);
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // LinkPe Payment Payload
  const [paymentDetails, setPaymentDetails] = useState<{
    linkpeUrl: string;
    upiDeepLink: string;
    qrCodeUrl: string;
    upiId: string;
    merchantName: string;
  } | null>(null);
  const [loadingPayment, setLoadingPayment] = useState<boolean>(false);

  // User's Deposit Request History
  const [myRequests, setMyRequests] = useState<any[]>([]);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`
    };
    return fetch(url, { ...options, headers });
  };

  const fetchLinkPeDetails = () => {
    if (!token || amount < 100) return;
    setLoadingPayment(true);
    fetchWithAuth(`/api/v1/funds/upi-link?amount=${amount}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.payment) {
          setPaymentDetails(d.payment);
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
      fetchLinkPeDetails();
      fetchMyRequests();
    }
  }, [isOpen, amount]);

  const handlePresetAmount = (preset: number) => {
    setAmount(preset);
  };

  const handleCopyUpi = () => {
    if (paymentDetails?.upiId) {
      navigator.clipboard.writeText(paymentDetails.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleSubmitDepositRequest = async (e: React.FormEvent) => {
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
          amount,
          paymentMethod: 'LINKPE_UPI',
          referenceNote: `UTR: ${utrNumber.trim()}`
        })
      });

      const data = await res.json();

      if (data.success) {
        setMsg({ type: 'success', text: data.message });
        setUtrNumber('');
        fetchMyRequests();
        onRefreshWallet();
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Failed to submit deposit request' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-slate-900 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(34,197,94,0.2)]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                ADD FUNDS WITH LINKPE UPI
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                  Instant QR & Apps
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Scan QR code, pay via GPay/PhonePe/Paytm, and submit payment proof for Admin approval</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white transition border border-slate-700/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Preset Deposit Amounts */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Select Deposit Amount (₹)</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[500, 1000, 5000, 10000, 25000, 50000].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetAmount(preset)}
                  className={`py-2 rounded-xl text-xs font-mono font-bold transition border ${
                    amount === preset
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="relative mt-2">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
              <input
                type="number"
                min="100"
                step="100"
                value={amount}
                onChange={e => setAmount(Math.max(100, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-8 pr-4 py-3 text-white font-mono font-extrabold text-base focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>
          </div>

          {/* LinkPe UPI Payment Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" /> LinkPe Merchant Payment Gateway
              </span>

              {paymentDetails && (
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition"
                >
                  {copiedUpi ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{paymentDetails.upiId}</span>
                </button>
              )}
            </div>

            {paymentDetails ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group shrink-0">
                  <img
                    src={paymentDetails.qrCodeUrl}
                    alt="LinkPe UPI QR"
                    className="w-32 h-32 rounded-2xl border border-emerald-500/40 p-1.5 bg-white shadow-xl transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/0 group-hover:border-emerald-400/40 pointer-events-none transition-all duration-300" />
                </div>

                <div className="flex-1 w-full space-y-2.5">
                  <div className="text-center sm:text-left">
                    <span className="text-xs font-semibold text-slate-300 block">
                      Pay Deposit Amount: <span className="text-emerald-400 font-extrabold font-mono text-sm">₹{amount.toLocaleString('en-IN')}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">Merchant: <strong className="text-white">{paymentDetails.merchantName}</strong></span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <a
                      href={paymentDetails.upiDeepLink}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-lg hover:shadow-emerald-500/20"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Open in Mobile UPI App (GPay / PhonePe / Paytm)</span>
                    </a>
                    <a
                      href={paymentDetails.linkpeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition border border-slate-700/80"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Open LinkPe Web Checkout Page</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Generating LinkPe Payment Links & QR Code...</span>
              </div>
            )}
          </div>

          {/* Submit UTR / Payment Proof Form */}
          <form onSubmit={handleSubmitDepositRequest} className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> Submit UTR / Reference ID for Admin Approval
            </h3>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                12-Digit UPI UTR / Transaction Reference Number
              </label>
              <input
                type="text"
                value={utrNumber}
                onChange={e => setUtrNumber(e.target.value)}
                placeholder="e.g. 423589102451 or Bank UTR Ref Number"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>

            {msg && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <span>Submitting Request...</span>
              ) : (
                <span>Submit ₹{amount.toLocaleString('en-IN')} Deposit Request for Admin Approval</span>
              )}
            </button>
          </form>

          {/* Live Request History & Tracker */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> My Deposit Requests Tracker
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Total: {myRequests.length}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2 px-3">Req ID</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-950">
                  {myRequests.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-900/60 transition">
                      <td className="py-2 px-3 font-mono font-bold text-white">{r.request_id}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">₹{parseFloat(r.amount).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-[11px] font-semibold text-slate-400">{r.payment_method}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${
                          r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          r.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                        }`}>
                          {r.status === 'APPROVED' ? 'APPROVED' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING APPROVAL'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[10px] font-mono text-slate-500">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {myRequests.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">No previous deposit requests recorded.</td>
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
