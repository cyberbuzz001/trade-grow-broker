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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-[var(--text-muted)]">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--primary)]" />
        <span className="text-xs font-semibold">Loading LinkPe Merchant Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--bg-surface)] via-[var(--bg-surface)]/90 to-[var(--primary-light)]/40 border border-[var(--border-color)] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <QrCode className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-[var(--text-main)] tracking-tight flex items-center gap-2">
                LinkPe UPI & Merchant QR Management System
                <span className="text-[10px] font-bold text-[var(--warning)] bg-[var(--warning)]/10 px-2.5 py-0.5 rounded-full border border-[var(--warning)]/20 uppercase tracking-widest flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Admin Protected
                </span>
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Configure active merchant UPI VPA, business name, and bank details for client deposit receipts & instant LinkPe checkout.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[var(--bg-body)]/80 px-4 py-2 rounded-xl border border-[var(--border-color)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span>
              <span className="text-xs font-mono font-bold text-[var(--primary)]">{settings.upiId}</span>
            </div>
            <button
              onClick={fetchSettings}
              className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] transition"
              title="Refresh Settings"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/30'
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
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                <Smartphone className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-extrabold text-[var(--text-main)] tracking-wider uppercase">
                  1. LinkPe UPI Merchant Configuration
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>Merchant UPI VPA / ID</span>
                    <span className="text-[9px] text-[var(--primary)] font-mono">Receives Client Deposits</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={settings.upiId}
                      onChange={e => setSettings({ ...settings, upiId: e.target.value })}
                      placeholder="e.g. tradegrow@upi or 9876543210@paytm"
                      required
                      className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-[var(--primary)] focus:outline-none focus:border-[var(--primary)] transition shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settings.upiId, 'upi')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-lg transition"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-3.5 h-3.5 text-[var(--primary)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">
                    Clients scanning QR codes or clicking payment links will send funds directly to this VPA.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
                    Merchant Business Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.merchantName}
                    onChange={e => setSettings({ ...settings, merchantName: e.target.value })}
                    placeholder="e.g. Trade Grow Brokerage"
                    required
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition"
                  />
                  <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">
                    Verified payee name shown on GPay, PhonePe, Paytm & LinkPe checkout page.
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Merchant Bank Wire Credentials */}
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                <Building className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-extrabold text-[var(--text-main)] tracking-wider uppercase">
                  2. Merchant Bank Account (Wire Transfer Backup)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={settings.bankName}
                    onChange={e => setSettings({ ...settings, bankName: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={settings.accountName}
                    onChange={e => setSettings({ ...settings, accountName: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Account Number</label>
                  <input
                    type="text"
                    value={settings.accountNumber}
                    onChange={e => setSettings({ ...settings, accountNumber: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--primary)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={settings.ifscCode}
                    onChange={e => setSettings({ ...settings, ifscCode: e.target.value.toUpperCase() })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--warning)] focus:outline-none focus:border-[var(--primary)] uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Branch Location</label>
                  <input
                    type="text"
                    value={settings.branch}
                    onChange={e => setSettings({ ...settings, branch: e.target.value })}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-slate-950 font-black text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
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
          <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-color)] rounded-2xl p-5 shadow-lg space-y-5 sticky top-6">
            
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-extrabold text-[var(--text-main)] tracking-wider uppercase">
                  Real-Time LinkPe QR & Checkout Preview
                </h3>
              </div>
              <span className="text-[9px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-full border border-[var(--primary)]/20">
                Live Simulator
              </span>
            </div>

            {/* Interactive Amount Tester */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
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
                        ? 'bg-[var(--primary)] text-slate-950 font-extrabold shadow'
                        : 'bg-[var(--bg-body)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    ₹{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-[var(--bg-body)] p-6 rounded-2xl border border-[var(--border-color)] flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative group p-3 bg-white rounded-xl shadow-2xl">
                <img
                  src={qrCodeUrl}
                  alt="LinkPe UPI QR Code Preview"
                  className="w-48 h-48 object-contain"
                />
                <div className="absolute inset-0 bg-[var(--bg-body)]/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl backdrop-blur-xs">
                  <a
                    href={qrCodeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-[var(--primary)] text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1 shadow"
                  >
                    <Download className="w-3.5 h-3.5" /> Download QR
                  </a>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-[var(--text-main)] block">
                  Scan to Pay <span className="font-mono text-[var(--primary)]">₹{testAmount.toLocaleString('en-IN')}</span>
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block font-mono">
                  Payee VPA: <span className="text-[var(--text-main)]">{settings.upiId}</span>
                </span>
                <span className="text-[9px] text-[var(--text-tertiary)] block">
                  Merchant: <span className="text-[var(--text-main)] font-semibold">{settings.merchantName}</span>
                </span>
              </div>
            </div>

            {/* Action Buttons: Test UPI App Deep Link & Web Checkout */}
            <div className="space-y-2.5 pt-1">
              <a
                href={upiDeepLink}
                className="w-full py-2.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md"
              >
                <Smartphone className="w-4 h-4" />
                <span>Test UPI App Deep-Link Trigger</span>
              </a>

              <a
                href={linkpeWebUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition border border-[var(--border-color)]"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Open Live LinkPe Web Payment Page</span>
              </a>
            </div>

            {/* Link Copy Box */}
            <div className="bg-[var(--bg-body)] p-3 rounded-xl border border-[var(--border-color)] space-y-1">
              <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">
                Generated LinkPe Payment Link
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--text-muted)] truncate flex-1">
                  {linkpeWebUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(linkpeWebUrl, 'link')}
                  className="p-1 rounded bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-[var(--primary)]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
