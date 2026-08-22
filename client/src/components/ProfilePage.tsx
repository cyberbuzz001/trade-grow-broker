import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User as UserIcon, ShieldCheck, Wallet as WalletIcon, Lock, CheckCircle2, AlertTriangle,
  Clock, RefreshCw, Save, Building2, UploadCloud, KeyRound, HelpCircle, Shield,
  Sun, Moon, ArrowUpRight, ArrowDownLeft, QrCode, ExternalLink, Smartphone, MessageSquare,
} from 'lucide-react';
import { User, Wallet, isStaffUser } from '../types';
import { Card, CardHeader, CardTitle, Badge, Tabs, DataTable, DataTableColumn, Button, Dialog } from './ui';
import { PermissionsDashboard } from './admin/PermissionsDashboard';

type ProfileTab = 'account' | 'kyc' | 'bank' | 'security' | 'funds' | 'support' | 'permissions' | 'appearance';

const TAB_META: { key: ProfileTab; label: string; icon: React.ReactNode; staffOnly?: boolean }[] = [
  { key: 'account', label: 'Account', icon: <UserIcon className="w-3.5 h-3.5" /> },
  { key: 'kyc', label: 'KYC', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: 'bank', label: 'Bank', icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: 'security', label: 'Security', icon: <KeyRound className="w-3.5 h-3.5" /> },
  { key: 'funds', label: 'Funds', icon: <WalletIcon className="w-3.5 h-3.5" /> },
  { key: 'support', label: 'Support', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  { key: 'permissions', label: 'Permissions', icon: <Shield className="w-3.5 h-3.5" />, staffOnly: true },
  { key: 'appearance', label: 'Appearance', icon: <Sun className="w-3.5 h-3.5" /> },
];

interface ProfilePageProps {
  user: User;
  wallet: Wallet | null;
  token: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onLogout: () => void;
  onRefreshWallet: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, wallet, token, theme = 'dark', onToggleTheme, onLogout, onRefreshWallet }) => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const isStaff = isStaffUser(user.role);
  const validTabs = TAB_META.filter((t) => !t.staffOnly || isStaff).map((t) => t.key);
  const activeTab: ProfileTab = (validTabs as string[]).includes(tab || '') ? (tab as ProfileTab) : 'account';

  useEffect(() => {
    if (tab !== activeTab) navigate(`/profile/${activeTab}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchWithAuth = (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  };

  // ============================================================
  // ACCOUNT (personal details) STATE
  // ============================================================
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResetCapitalModalOpen, setIsResetCapitalModalOpen] = useState(false);
  const [isResettingCapital, setIsResettingCapital] = useState(false);
  const [resetCapitalMsg, setResetCapitalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProfileDetails = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/user/profile');
      const data = await res.json();
      if (data.success && data.profile) {
        setFullName(data.profile.fullName || '');
        setPhoneNumber(data.profile.phoneNumber || '');
        setCity(data.profile.city || '');
        setAddress(data.profile.address || '');
        setDateOfBirth(data.profile.dateOfBirth || '');
      }
    } catch (_) {}
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, city, address, dateOfBirth }),
      });
      const data = await res.json();
      setProfileMsg(data.success
        ? { type: 'success', text: data.message || 'Profile details updated successfully!' }
        : { type: 'error', text: data.error?.message || 'Failed to update profile' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const confirmResetCapital = async () => {
    setIsResettingCapital(true);
    setResetCapitalMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/funds/reset-margin', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onRefreshWallet();
        setResetCapitalMsg({ type: 'success', text: data.message || 'Virtual capital reset to default.' });
        setIsResetCapitalModalOpen(false);
      } else {
        setResetCapitalMsg({ type: 'error', text: data.error?.message || 'Failed to reset capital.' });
      }
    } catch (err: any) {
      setResetCapitalMsg({ type: 'error', text: err.message || 'Failed to reset capital.' });
    } finally {
      setIsResettingCapital(false);
    }
  };

  // ============================================================
  // KYC STATE
  // ============================================================
  const [kycStatus, setKycStatus] = useState('NOT_STARTED');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
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
    fetchProfileDetails();
    fetchKycStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingKyc(true);
    setKycMessage(null);
    const formData = new FormData();
    formData.append('panNumber', panNumber);
    formData.append('aadhaarNumber', aadhaarNumber);
    formData.append('bankAccountName', bankAccountName);
    formData.append('bankAccountNumber', bankAccountNumber);
    formData.append('bankIfsc', bankIfsc);
    formData.append('bankName', bankName);
    if (panFile) { formData.append('panDoc', panFile); formData.append('panDocument', panFile); }
    if (aadhaarFrontFile) { formData.append('aadhaarFrontDoc', aadhaarFrontFile); formData.append('aadhaarFront', aadhaarFrontFile); }
    if (aadhaarBackFile) { formData.append('aadhaarBackDoc', aadhaarBackFile); formData.append('aadhaarBack', aadhaarBackFile); }
    if (bankProofFile) { formData.append('bankProofDoc', bankProofFile); formData.append('bankProof', bankProofFile); }

    try {
      const res = await fetchWithAuth('/api/v1/kyc/submit', { method: 'POST', body: formData });
      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { success: res.ok, error: { message: text || `Server responded with status ${res.status}` } };
      }
      if (data.success) {
        setKycMessage({ type: 'success', text: data.message || 'KYC application submitted successfully!' });
        setKycStatus('SUBMITTED');
        fetchKycStatus();
      } else {
        setKycMessage({ type: 'error', text: data.error?.message || data.message || 'Failed to submit KYC application' });
      }
    } catch (err: any) {
      setKycMessage({ type: 'error', text: err.message || 'Network error while submitting KYC' });
    } finally {
      setSubmittingKyc(false);
    }
  };

  const isKycVerified = kycStatus === 'APPROVED' || user.isKycCompleted;

  // ============================================================
  // SECURITY STATE
  // ============================================================
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setSavingPassword(true);
    setSecurityMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setSecurityMsg({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else {
        setSecurityMsg({ type: 'error', text: data.error?.message || 'Failed to change password' });
      }
    } catch (err: any) {
      setSecurityMsg({ type: 'error', text: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  // ============================================================
  // FUNDS (deposit/withdrawal + LinkPe UPI) STATE
  // ============================================================
  const [requestType, setRequestType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [fundAmountInput, setFundAmountInput] = useState('50000');
  const fundAmount = parseFloat(fundAmountInput) || 0;
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [referenceNote, setReferenceNote] = useState('');
  const [fundMessage, setFundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [submittingFundReq, setSubmittingFundReq] = useState(false);
  const [customUpiId, setCustomUpiId] = useState('expertstokks@axl');
  const [linkpeData, setLinkpeData] = useState<{ qrCodeUrl: string; upiId: string; merchantName: string } | null>(null);
  const [loadingLinkpe, setLoadingLinkpe] = useState(false);

  const availableBalance = wallet?.buyingPower ?? wallet?.cashBalance ?? 0;

  const fetchFundRequests = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/funds/my-requests');
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) setFundRequests(data.requests);
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'funds') fetchFundRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'funds' && paymentMethod === 'UPI' && requestType === 'DEPOSIT' && fundAmount > 0) {
      setLoadingLinkpe(true);
      fetchWithAuth(`/api/v1/funds/upi-link?amount=${fundAmount}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.payment) {
            setLinkpeData(d.payment);
            if (!customUpiId || customUpiId === 'expertstokks@axl') setCustomUpiId(d.payment.upiId || 'expertstokks@axl');
          }
        })
        .catch(() => {})
        .finally(() => setLoadingLinkpe(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fundAmount, paymentMethod, requestType]);

  const handleSubmitFundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFundMessage(null);
    if (fundAmount <= 0) {
      setFundMessage({ type: 'error', text: 'Please enter a valid amount greater than ₹0' });
      return;
    }
    if (requestType === 'WITHDRAWAL' && fundAmount > availableBalance) {
      setFundMessage({ type: 'error', text: `Insufficient available funds. Maximum withdrawable: ₹${availableBalance.toLocaleString('en-IN')}` });
      return;
    }
    setSubmittingFundReq(true);
    try {
      const res = await fetchWithAuth('/api/v1/funds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, amount: fundAmount, paymentMethod, referenceNote: referenceNote.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setFundMessage({ type: 'success', text: data.message || `${requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} request submitted for admin approval!` });
        setReferenceNote('');
        fetchFundRequests();
        onRefreshWallet();
      } else {
        setFundMessage({ type: 'error', text: data.error?.message || data.message || 'Failed to submit fund request' });
      }
    } catch (err: any) {
      setFundMessage({ type: 'error', text: err.message });
    } finally {
      setSubmittingFundReq(false);
    }
  };

  const fundColumns: DataTableColumn<any>[] = [
    { key: 'type', header: 'Type', mobilePrimary: true, render: (r) => <Badge variant={r.request_type === 'DEPOSIT' ? 'gain' : 'loss'}>{r.request_type}</Badge> },
    { key: 'amount', header: 'Amount', render: (r) => <span className="num-font font-bold">₹{parseFloat(r.amount).toLocaleString('en-IN')}</span> },
    { key: 'method', header: 'Method', mobileHidden: true, render: (r) => <span className="text-xs">{r.payment_method}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.status === 'APPROVED' ? 'gain' : r.status === 'REJECTED' ? 'loss' : 'warning'}>{r.status}</Badge> },
    { key: 'date', header: 'Date', mobileHidden: true, render: (r) => <span className="text-[11px] text-[var(--text-muted)] num-font">{new Date(r.created_at).toLocaleString('en-IN')}</span> },
  ];

  // ============================================================
  // SUPPORT STATE
  // ============================================================
  const [supportCategory, setSupportCategory] = useState('TRADING');
  const [supportPriority, setSupportPriority] = useState('MEDIUM');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDesc, setSupportDesc] = useState('');
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [supportMsg, setSupportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSupportTickets = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/support/tickets');
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) setSupportTickets(data.tickets);
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'support') fetchSupportTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSubmitSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportMsg(null);
    setSubmittingSupport(true);
    try {
      const res = await fetchWithAuth('/api/v1/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: supportCategory, priority: supportPriority, subject: supportSubject, description: supportDesc }),
      });
      const data = await res.json();
      if (data.success) {
        setSupportMsg({ type: 'success', text: data.message || 'Support ticket submitted successfully!' });
        setSupportSubject(''); setSupportDesc('');
        fetchSupportTickets();
      } else {
        setSupportMsg({ type: 'error', text: data.error?.message || 'Failed to submit ticket' });
      }
    } catch (err: any) {
      setSupportMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingSupport(false);
    }
  };

  const ticketColumns: DataTableColumn<any>[] = [
    { key: 'subject', header: 'Subject', mobilePrimary: true, render: (t) => <span className="font-bold">{t.subject}</span> },
    { key: 'category', header: 'Category', mobileHidden: true, render: (t) => <Badge variant="neutral">{t.category}</Badge> },
    { key: 'status', header: 'Status', render: (t) => <Badge variant={t.status === 'RESOLVED' ? 'gain' : 'info'}>{t.status}</Badge> },
    { key: 'date', header: 'Opened', mobileHidden: true, render: (t) => <span className="text-[11px] text-[var(--text-muted)] num-font">{new Date(t.created_at).toLocaleString()}</span> },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  const InfoMessage = ({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) => msg ? (
    <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 ${msg.type === 'success' ? 'bg-[var(--gain-light)] text-[var(--gain)] border border-[var(--gain)]/30' : 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/30'}`}>
      {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span>{msg.text}</span>
    </div>
  ) : null;

  const inputClass = 'w-full bg-[var(--bg-surface-inset)] border border-[var(--border-color)] focus:border-[var(--primary)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-main)] outline-none transition-colors';
  const labelClass = 'text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5';

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      {/* PROFILE HEADER */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white text-xl font-black shadow-md flex-shrink-0">
              {(fullName || user.username || 'T').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-[var(--text-main)]">{fullName || user.username}</h2>
                <Badge variant={isKycVerified ? 'gain' : 'warning'} dot>{isKycVerified ? 'KYC Verified' : 'KYC Pending'}</Badge>
                {isStaff && <Badge variant="primary">{user.role}</Badge>}
              </div>
              <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">
                {user.email} <span className="mx-1.5 opacity-50">•</span> Client ID: TG-{user.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="bg-[var(--bg-surface-inset)] border border-[var(--border-color)] px-4 py-2.5 rounded-xl">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide block">Available Margin</span>
            <span className="text-base font-black text-[var(--gain)] num-font">₹{(wallet?.cashBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </Card>

      <Tabs
        ariaLabel="Profile section"
        value={activeTab}
        onChange={(v) => navigate(`/profile/${v}`)}
        items={TAB_META.filter((t) => !t.staffOnly || isStaff).map((t) => ({ value: t.key, label: t.label, icon: t.icon }))}
      />

      {/* ACCOUNT TAB */}
      {activeTab === 'account' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Personal & Account Information</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Keep your contact details updated for official trading communications.</p>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelClass}>Client / Account ID</label><input type="text" disabled value={user.id} className={`${inputClass} opacity-60 cursor-not-allowed font-mono`} /></div>
            <div><label className={labelClass}>Username</label><input type="text" disabled value={user.username} className={`${inputClass} opacity-60 cursor-not-allowed font-mono`} /></div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelClass}>Full Legal Name</label><input type="text" required placeholder="e.g. Nikhil Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Phone Number</label><input type="tel" placeholder="e.g. +91 9876543210" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>City / District</label><input type="text" placeholder="e.g. Mumbai, Maharashtra" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Date of Birth</label><input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} /></div>
              <div className="md:col-span-2"><label className={labelClass}>Complete Address</label><textarea rows={3} placeholder="Street address, Flat/Building no., Landmark, Pincode" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></div>
            </div>
            <InfoMessage msg={profileMsg} />
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile} leftIcon={savingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}>Save Profile Changes</Button>
            </div>
          </form>

          <div className="pt-4 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)]">Reset Virtual Capital</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Resets your simulated cash balance to the default starting capital. Only available with no open positions or pending orders.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setIsResetCapitalModalOpen(true)}>Reset Capital</Button>
            </div>
            <InfoMessage msg={resetCapitalMsg} />
          </div>
        </Card>
      )}

      {/* KYC TAB */}
      {activeTab === 'kyc' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>KYC & Regulatory Compliance</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Submit PAN, Aadhaar, and bank proof to verify your account for trading.</p>
            </div>
            <Badge variant={kycStatus === 'APPROVED' ? 'gain' : kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW' ? 'warning' : 'loss'}>
              {kycStatus === 'APPROVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {kycStatus}
            </Badge>
          </CardHeader>

          <InfoMessage msg={kycMessage} />

          <form onSubmit={handleKycSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelClass}>PAN Card Number *</label><input type="text" required placeholder="e.g. ABCDE1234F" value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} maxLength={10} className={`${inputClass} uppercase font-mono`} /></div>
              <div><label className={labelClass}>Aadhaar Number (12 digits) *</label><input type="text" required placeholder="e.g. 123456789012" value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))} maxLength={12} className={`${inputClass} font-mono`} /></div>
              <div><label className={labelClass}>Bank Name *</label><input type="text" required placeholder="e.g. HDFC Bank Ltd" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Bank Account Number *</label><input type="text" required placeholder="e.g. 50100234567890" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={`${inputClass} font-mono`} /></div>
              <div><label className={labelClass}>Account Holder Name *</label><input type="text" required placeholder="As per bank passbook" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Bank IFSC Code *</label><input type="text" required placeholder="e.g. HDFC0000123" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} maxLength={11} className={`${inputClass} uppercase font-mono`} /></div>
            </div>

            <div className="pt-4 border-t border-[var(--border-color)] space-y-3">
              <h4 className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wide">Verification Documents (PDF / JPG / PNG)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'PAN Card Photo', file: panFile, set: setPanFile },
                  { label: 'Aadhaar Front', file: aadhaarFrontFile, set: setAadhaarFrontFile },
                  { label: 'Aadhaar Back', file: aadhaarBackFile, set: setAadhaarBackFile },
                  { label: 'Cancelled Cheque', file: bankProofFile, set: setBankProofFile },
                ].map((d) => (
                  <div key={d.label} className="bg-[var(--bg-surface-inset)] p-3.5 rounded-xl border border-[var(--border-color)]">
                    <span className="text-[11px] font-bold text-[var(--text-main)] block mb-1">{d.label}</span>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => d.set(e.target.files?.[0] || null)} className="text-[10px] text-[var(--text-muted)] file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-[var(--primary-light)] file:text-[var(--primary)]" />
                    {d.file && <span className="text-[10px] text-[var(--gain)] font-bold mt-1 block">✓ {d.file.name}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submittingKyc || kycStatus === 'APPROVED'} leftIcon={submittingKyc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}>
                {kycStatus === 'APPROVED' ? 'KYC Already Approved' : submittingKyc ? 'Submitting KYC...' : 'Submit KYC for Verification'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* BANK TAB */}
      {activeTab === 'bank' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Verified Bank Account</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Trading proceeds and withdrawal settlements route through this verified account.</p>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-surface-inset)] border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-[var(--text-main)]">{bankName || 'No Bank Linked Yet'}</span>
                {bankName && <Badge variant="gain">Primary</Badge>}
              </div>
              <div className="space-y-1 text-xs text-[var(--text-muted)] font-mono">
                <p>A/C: <span className="text-[var(--text-main)] font-bold">{bankAccountNumber ? `•••• •••• ${bankAccountNumber.slice(-4)}` : 'Not Set'}</span></p>
                <p>IFSC: <span className="text-[var(--text-main)] font-bold">{bankIfsc || 'Not Set'}</span></p>
                <p>Name: <span className="text-[var(--text-muted)]">{bankAccountName || fullName || user.username}</span></p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile/kyc')}
              className="p-4 rounded-xl bg-[var(--bg-surface-inset)] border border-dashed border-[var(--border-color)] hover:border-[var(--primary)]/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-bold text-[var(--text-main)]">Update Linked Bank via KYC</span>
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Requires a verified bank cheque/statement upload</span>
            </button>
          </div>
        </Card>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'security' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Security & Authentication</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage your password and session security.</p>
            </div>
          </CardHeader>
          <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
            <div><label className={labelClass}>Current Password</label><input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>New Password</label><input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} /></div>
            <div><label className={labelClass}>Confirm New Password</label><input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} /></div>
            <InfoMessage msg={securityMsg} />
            <Button type="submit" disabled={savingPassword} leftIcon={savingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}>Update Password</Button>
          </form>
          <div className="pt-4 border-t border-[var(--border-color)]">
            <h4 className="font-bold text-xs text-[var(--text-main)] mb-1">Session Security</h4>
            <p className="text-xs text-[var(--text-muted)]">Your session is secured using encrypted JWT tokens with automatic silent refresh.</p>
          </div>
        </Card>
      )}

      {/* FUNDS TAB */}
      {activeTab === 'funds' && (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 num-font">
              <div><span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Cash Balance</span><span className="text-base font-black text-[var(--text-main)]">₹{(wallet?.cashBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div><span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Available</span><span className="text-base font-black text-[var(--gain)]">₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div><span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Blocked Margin</span><span className="text-base font-black text-[var(--warning)]">₹{(wallet?.usedMargin ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              <div><span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">Combined P&L</span><span className={`text-base font-black ${((wallet?.realizedPnl ?? 0) + (wallet?.unrealizedPnl ?? 0)) >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>₹{((wallet?.realizedPnl ?? 0) + (wallet?.unrealizedPnl ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </Card>

          <Card className="space-y-4">
            <CardHeader className="mb-0">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">Fund Deposit & Withdrawal Request</h4>
              <Badge variant="info">Requires Admin Approval</Badge>
            </CardHeader>
            <form onSubmit={handleSubmitFundRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRequestType('DEPOSIT')} className={`py-2 rounded-xl font-black text-xs transition border cursor-pointer ${requestType === 'DEPOSIT' ? 'bg-[var(--gain)] border-[var(--gain)] text-white' : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                  <ArrowDownLeft className="w-3.5 h-3.5 inline mr-1" /> Request Deposit
                </button>
                <button type="button" onClick={() => setRequestType('WITHDRAWAL')} className={`py-2 rounded-xl font-black text-xs transition border cursor-pointer ${requestType === 'WITHDRAWAL' ? 'bg-[var(--loss)] border-[var(--loss)] text-white' : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                  <ArrowUpRight className="w-3.5 h-3.5 inline mr-1" /> Request Withdrawal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Amount (₹)</label>
                  <input type="number" min="1" step="any" value={fundAmountInput} onChange={(e) => setFundAmountInput(e.target.value)} className={`${inputClass} font-mono font-bold`} />
                </div>
                <div>
                  <label className={labelClass}>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                    <option value="UPI">UPI Transfer</option>
                    <option value="IMPS_NEFT">IMPS / NEFT</option>
                    <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                    <option value="WALLET">Digital Wallet</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Presets:</span>
                {[500, 1000, 5000, 10000, 25000, 50000].map((preset) => (
                  <button key={preset} type="button" onClick={() => setFundAmountInput(preset.toString())}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition border cursor-pointer ${fundAmount === preset ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--bg-surface-inset)] border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                    ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                ))}
                {requestType === 'WITHDRAWAL' && (
                  <button type="button" onClick={() => setFundAmountInput(Math.floor(availableBalance).toString())} className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold border border-[var(--border-color)] text-[var(--gain)] bg-[var(--bg-surface-inset)] cursor-pointer">Max</button>
                )}
              </div>

              {requestType === 'DEPOSIT' && paymentMethod === 'UPI' && (
                <div className="p-3.5 rounded-xl bg-[var(--gain-light)] border border-[var(--gain)]/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[var(--gain)]" />
                      <span className="text-xs font-bold text-[var(--text-main)]">LinkPe Instant UPI Payment</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] px-2 py-0.5 rounded-lg border border-[var(--gain)]/40">
                      <span className="text-[10px] font-mono font-extrabold text-[var(--gain)]">UPI:</span>
                      <input type="text" value={customUpiId} onChange={(e) => setCustomUpiId(e.target.value)} className="bg-transparent text-xs font-mono font-bold text-[var(--gain)] outline-none w-32 border-b border-dashed border-[var(--gain)]/50" />
                    </div>
                  </div>
                  {linkpeData ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3 bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-color)]">
                      <img
                        src={linkpeData.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(customUpiId.trim() || linkpeData.upiId)}&pn=${encodeURIComponent(linkpeData.merchantName)}&am=${fundAmount}&cu=INR`)}`}
                        alt="LinkPe UPI QR Code" className="w-24 h-24 rounded-lg border border-[var(--gain)]/30 p-1 bg-white shrink-0"
                      />
                      <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                        <span className="text-[11px] font-semibold text-[var(--text-muted)] block">Pay <span className="font-bold font-mono text-[var(--gain)]">₹{fundAmount.toLocaleString('en-IN')}</span> to <span className="text-[var(--text-main)] font-bold">{linkpeData.merchantName}</span></span>
                        <a href={`https://ptprashanttripathi.github.io/linkpe/?pa=${encodeURIComponent(customUpiId.trim() || linkpeData.upiId)}&pn=${encodeURIComponent(linkpeData.merchantName)}&amt=${fundAmount}&tn=Trade%20Grow%20Margin%20Deposit`} target="_blank" rel="noopener noreferrer" className="w-full py-1.5 px-3 rounded-lg bg-[var(--bg-surface-inset)] hover:bg-[var(--border-color)] text-[var(--text-main)] font-semibold text-[11px] flex items-center justify-center gap-1.5 transition border border-[var(--border-color)]">
                          <ExternalLink className="w-3 h-3 text-[var(--gain)]" /> Open LinkPe Payment Page
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-3 text-[var(--text-muted)] text-xs flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating LinkPe UPI payment details...
                    </div>
                  )}
                </div>
              )}

              <div><label className={labelClass}>Reference / Note (optional)</label><input type="text" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} placeholder="e.g. UTR number / remarks" className={inputClass} /></div>
              <InfoMessage msg={fundMessage} />
              <Button type="submit" disabled={submittingFundReq || fundAmount <= 0} variant={requestType === 'DEPOSIT' ? 'primary' : 'destructive'} className="w-full justify-center">
                {submittingFundReq ? 'Processing...' : `Submit ${requestType === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Request for Admin Approval`}
              </Button>
            </form>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="p-3">
              <div className="px-1 pb-2 text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">Fund Request History</div>
              <DataTable columns={fundColumns} rows={fundRequests} rowKey={(r) => r.id} emptyMessage="No fund requests recorded yet." />
            </div>
          </Card>
        </div>
      )}

      {/* SUPPORT TAB */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <CardHeader className="mb-0">
              <CardTitle className="flex items-center gap-2"><HelpCircle className="w-4 h-4 text-[var(--warning)]" /> Create Support Ticket</CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmitSupportTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <select value={supportCategory} onChange={(e) => setSupportCategory(e.target.value)} className={inputClass}>
                    <option value="TRADING">Trading & Execution</option>
                    <option value="KYC">KYC & Account Verification</option>
                    <option value="FUNDS">Funds & Withdrawal</option>
                    <option value="TECHNICAL">App & Technical Issue</option>
                    <option value="OTHER">General Query</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Priority</label>
                  <select value={supportPriority} onChange={(e) => setSupportPriority(e.target.value)} className={inputClass}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent / Trade Assistance</option>
                  </select>
                </div>
              </div>
              <div><label className={labelClass}>Subject</label><input type="text" required placeholder="Brief summary of your request" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Detailed Description</label><textarea required rows={3} placeholder="Explain your issue in detail..." value={supportDesc} onChange={(e) => setSupportDesc(e.target.value)} className={inputClass} /></div>
              <InfoMessage msg={supportMsg} />
              <Button type="submit" disabled={submittingSupport} leftIcon={<MessageSquare className="w-4 h-4" />}>{submittingSupport ? 'Submitting Ticket...' : 'Submit Support Ticket'}</Button>
            </form>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="p-3">
              <div className="px-1 pb-2 text-xs font-bold text-[var(--text-main)] uppercase tracking-wide">My Support Tickets</div>
              <DataTable columns={ticketColumns} rows={supportTickets} rowKey={(t) => t.id} emptyMessage="No support tickets submitted yet." />
            </div>
          </Card>
        </div>
      )}

      {/* PERMISSIONS TAB (staff only) */}
      {activeTab === 'permissions' && isStaff && (
        <Card padding="none" className="overflow-hidden">
          <PermissionsDashboard token={token} />
        </Card>
      )}

      {/* APPEARANCE TAB */}
      {activeTab === 'appearance' && (
        <Card className="space-y-5">
          <CardHeader className="pb-4 border-b border-[var(--border-color)] mb-0">
            <div>
              <CardTitle>Appearance & Theme</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Switch between Lite Mode (light) and Dark Mode for the whole app.</p>
            </div>
            <Badge variant={theme === 'light' ? 'warning' : 'info'}>{theme === 'light' ? 'Lite Mode Active' : 'Dark Mode Active'}</Badge>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['light', 'dark'] as const).map((mode) => (
              <div key={mode}
                onClick={() => { if (theme !== mode && onToggleTheme) onToggleTheme(); }}
                className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 ${theme === mode ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--primary-light)]' : 'border-[var(--border-color)] bg-[var(--bg-surface-inset)] hover:border-[var(--primary)]/40'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center">
                      {mode === 'light' ? <Sun className="w-5 h-5 text-[var(--warning)]" /> : <Moon className="w-5 h-5 text-[var(--info)]" />}
                    </div>
                    <h4 className="font-extrabold text-sm text-[var(--text-main)] capitalize">{mode === 'light' ? 'Lite Mode' : 'Dark Mode'}</h4>
                  </div>
                  {theme === mode && <CheckCircle2 className="w-5 h-5 text-[var(--primary)]" />}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{mode === 'light' ? 'High-contrast light background, best for bright environments.' : 'Reduced eye strain for extended trading sessions.'}</p>
                <Button variant={theme === mode ? 'primary' : 'secondary'} size="sm" onClick={(e) => { e.stopPropagation(); if (theme !== mode && onToggleTheme) onToggleTheme(); }}>
                  {theme === mode ? 'Selected' : `Switch to ${mode === 'light' ? 'Lite' : 'Dark'} Mode`}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog isOpen={isResetCapitalModalOpen} onClose={() => setIsResetCapitalModalOpen(false)} title="Reset Virtual Capital?" size="sm"
        footer={<><Button variant="secondary" onClick={() => setIsResetCapitalModalOpen(false)}>Cancel</Button><Button variant="destructive" disabled={isResettingCapital} onClick={confirmResetCapital}>{isResettingCapital ? 'Resetting...' : 'Reset Capital'}</Button></>}
      >
        <p className="text-xs text-[var(--text-muted)]">This resets your simulated cash balance back to the default starting capital and clears realized/unrealized P&L figures. This only works while you have no open positions or pending orders.</p>
      </Dialog>
    </div>
  );
};
