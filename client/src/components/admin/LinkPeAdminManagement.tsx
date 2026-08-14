import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode, Smartphone, ExternalLink, ShieldCheck, Lock, Save, Copy, Check,
  RefreshCw, Building, CreditCard, DollarSign, AlertCircle, CheckCircle2,
  Download, Eye, Sparkles, Send
} from 'lucide-react';

interface LinkPeAdminManagementProps {
  token: string;
}

export const LinkPeAdminManagement: React.FC<LinkPeAdminManagementProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  // Test amount for real-time QR code & deep-link preview
  const [testAmount, setTestAmount] = useState<number>(5000);
  const [customNote, setCustomNote] = useState<string>('TradeGrow Deposit');

  // Form State
  const [settings, setSettings] = useState({
    upiId: 'tradegrow@upi',
    merchantName: 'Trade Grow Brokerage',
    bankName: 'HDFC Bank',
    accountName: 'Trade Grow Technologies Pvt Ltd',
    accountNumber: '50200098765432',
    ifscCode: 'HDFC0001234',
    branch: 'Mumbai Main Branch'
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/funds/payment-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  // Generate Live LinkPe Payloads for preview
  const safePa = encodeURIComponent(settings.upiId.trim());
  const safePn = encodeURIComponent(settings.merchantName.trim());
  const safeTn = encodeURIComponent(customNote.trim());
  
  const upiDeepLink = `upi://pay?pa=${safePa}&pn=${safePn}&amt=${testAmount}&cu=INR&tn=${safeTn}`;
  const linkpeWebUrl = `https://ptprashanttripathi.github.io/linkpe/?pa=${safePa}&pn=${safePn}&amt=${testAmount}&tn=${safeTn}`;

  useEffect(() => {
    if (upiDeepLink) {
      QRCode.toDataURL(upiDeepLink, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
        .then(url => setQrCodeUrl(url))
        .catch(() => {
          setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiDeepLink)}&margin=10`);
        });
    }
  }, [upiDeepLink]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/v1/admin/funds/payment-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: '✅ LinkPe UPI & Bank Receiving Settings saved successfully!' });
      } else {
        setMsg({ type: 'error', text: data.error?.message || 'Failed to update payment settings' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Network error updating settings' });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: 'upi' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'upi') {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-xs font-semibold">Loading LinkPe Merchant Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <QrCode className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                LinkPe UPI & Merchant QR Management System
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Admin Protected
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Configure active merchant UPI VPA, business name, and bank details for client deposit receipts & instant LinkPe checkout.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-mono font-bold text-emerald-400">{settings.upiId}</span>
            </div>
            <button
              onClick={fetchSettings}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Settings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Grid: Left = Form Configuration, Right = Live QR Preview & Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Config Form (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Section 1: LinkPe Merchant UPI Settings */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-extrabold text-white tracking-wider uppercase">
                  1. LinkPe UPI Merchant Configuration
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>Merchant UPI VPA / ID</span>
                    <span className="text-[9px] text-emerald-400 font-mono">Receives Client Deposits</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={settings.upiId}
                      onChange={e => setSettings({ ...settings, upiId: e.target.value })}
                      placeholder="e.g. tradegrow@upi or 9876543210@paytm"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settings.upiId, 'upi')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Clients scanning QR codes or clicking payment links will send funds directly to this VPA.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Merchant Business Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.merchantName}
                    onChange={e => setSettings({ ...settings, merchantName: e.target.value })}
                    placeholder="e.g. Trade Grow Brokerage"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Verified payee name shown on GPay, PhonePe, Paytm & LinkPe checkout page.
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Merchant Bank Wire Credentials */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Building className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-extrabold text-white tracking-wider uppercase">
                  2. Merchant Bank Account (Wire Transfer Backup)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={settings.bankName}
                    onChange={e => setSettings({ ...settings, bankName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={settings.accountName}
                    onChange={e => setSettings({ ...settings, accountName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Number</label>
                  <input
                    type="text"
                    value={settings.accountNumber}
                    onChange={e => setSettings({ ...settings, accountNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={settings.ifscCode}
                    onChange={e => setSettings({ ...settings, ifscCode: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Branch Location</label>
                  <input
                    type="text"
                    value={settings.branch}
                    onChange={e => setSettings({ ...settings, branch: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Merchant Settings...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Merchant Payment Receiving Credentials</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Interactive Live QR & Payment Tester (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5 sticky top-6">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-extrabold text-white tracking-wider uppercase">
                  Real-Time LinkPe QR & Checkout Preview
                </h3>
              </div>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Live Simulator
              </span>
            </div>

            {/* Interactive Amount Tester */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Test Amount Simulator (₹)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1000, 5000, 10000, 50000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTestAmount(amt)}
                    className={`py-1.5 text-xs font-mono font-bold rounded-lg transition ${
                      testAmount === amt
                        ? 'bg-emerald-500 text-slate-950 font-extrabold shadow'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative group p-3 bg-white rounded-xl shadow-2xl">
                <img
                  src={qrCodeUrl}
                  alt="LinkPe UPI QR Code Preview"
                  className="w-48 h-48 object-contain"
                />
                <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl backdrop-blur-xs">
                  <a
                    href={qrCodeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-emerald-500 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1 shadow"
                  >
                    <Download className="w-3.5 h-3.5" /> Download QR
                  </a>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-white block">
                  Scan to Pay <span className="font-mono text-emerald-400">₹{testAmount.toLocaleString('en-IN')}</span>
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  Payee VPA: <span className="text-slate-200">{settings.upiId}</span>
                </span>
                <span className="text-[9px] text-slate-500 block">
                  Merchant: <span className="text-white font-semibold">{settings.merchantName}</span>
                </span>
              </div>
            </div>

            {/* Action Buttons: Test UPI App Deep Link & Web Checkout */}
            <div className="space-y-2.5 pt-1">
              <a
                href={upiDeepLink}
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md"
              >
                <Smartphone className="w-4 h-4" />
                <span>Test UPI App Deep-Link Trigger</span>
              </a>

              <a
                href={linkpeWebUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition border border-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open Live LinkPe Web Payment Page</span>
              </a>
            </div>

            {/* Link Copy Box */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                Generated LinkPe Payment Link
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400 truncate flex-1">
                  {linkpeWebUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(linkpeWebUrl, 'link')}
                  className="p-1 rounded bg-slate-900 text-slate-300 hover:text-white transition"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
