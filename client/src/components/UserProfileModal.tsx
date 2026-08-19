import React, { useState, useEffect } from 'react';
import { 
  X, 
  User as UserIcon, 
  ShieldCheck, 
  Wallet as WalletIcon, 
  Lock, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Zap, 
  QrCode, 
  ExternalLink, 
  Smartphone,
  HelpCircle,
  Save,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  PlusCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  Sun,
  Moon
} from 'lucide-react';
import { User, Wallet } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  wallet: Wallet | null;
  token?: string | null;
  initialTab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'SECURITY' | 'SUPPORT' | 'PERMISSIONS' | 'APPEARANCE';
  onRefreshWallet: () => void;
  onLogout: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  wallet,
  token,
  initialTab = 'PROFILE',
  onRefreshWallet,
  onLogout,
  theme = 'dark',
  onToggleTheme
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'KYC' | 'FUNDS' | 'SECURITY' | 'SUPPORT' | 'PERMISSIONS' | 'APPEARANCE'>(initialTab || 'PROFILE');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Helper for authenticated fetch calls
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const getFreshToken = () => token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token') || '';
    let currentToken = getFreshToken();

    const headers = new Headers(options.headers || {});
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    let res = await fetch(url, { ...options, headers });
    
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

  // ============================================================
  // 1. PERSONAL PROFILE DETAILS STATE
  // ============================================================
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      fetchProfileDetails();
    }
  }, [isOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, city, address, dateOfBirth })
      });
      const data = await res.json();
      if (data.success) {
        setProfileMsg({ type: 'success', text: data.message || 'Profile saved successfully!' });
      } else {
        setProfileMsg({ type: 'error', text: data.error?.message || 'Failed to save profile' });
      }
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  // ============================================================
  // 2. KYC STATE
  // ============================================================
  const [kycStatus, setKycStatus] = useState<string>('NOT_STARTED');
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
    if (isOpen && (activeTab === 'KYC' || activeTab === 'PROFILE')) {
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

      if (panFile) {
        formData.append('panDoc', panFile);
        formData.append('panDocument', panFile);
      }
      if (aadhaarFrontFile) {
        formData.append('aadhaarFrontDoc', aadhaarFrontFile);
        formData.append('aadhaarFront', aadhaarFrontFile);
      }
      if (aadhaarBackFile) {
        formData.append('aadhaarBackDoc', aadhaarBackFile);
        formData.append('aadhaarBack', aadhaarBackFile);
      }
      if (bankProofFile) {
        formData.append('bankProofDoc', bankProofFile);
        formData.append('bankProof', bankProofFile);
      }

      const res = await fetchWithAuth('/api/v1/kyc/submit', {
        method: 'POST',
        body: formData
      });

      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { success: res.ok, error: { message: text || `Server responded with status ${res.status}` } };
      }

      if (data.success) {
        setKycMessage({ type: 'success', text: data.message || 'KYC submitted successfully!' });
        fetchKycStatus();
      } else {
        setKycMessage({ type: 'error', text: data.error?.message || data.message || 'KYC submission failed' });
      }
    } catch (err: any) {
      setKycMessage({ type: 'error', text: err.message || 'Network error during KYC submission' });
    } finally {
      setSubmittingKyc(false);
    }
  };

  // ============================================================
  // 3. SECURITY & PASSWORD CHANGE STATE
  // ============================================================
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setUpdatingPassword(true);
    try {
      const res = await fetchWithAuth('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMsg({ type: 'success', text: data.message });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMsg({ type: 'error', text: data.error?.message || 'Failed to change password' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message });
    } finally {
      setUpdatingPassword(false);
    }
  };

  // ============================================================
  // 4. FUNDS & LINKPE UPI STATE
  // ============================================================
  const [requestType, setRequestType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [fundAmount, setFundAmount] = useState<number>(50000);
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [referenceNote, setReferenceNote] = useState<string>('');
  const [fundMessage, setFundMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [myFundRequests, setMyFundRequests] = useState<any[]>([]);
  const [submittingFundReq, setSubmittingFundReq] = useState(false);

  const [customModalUpiId, setCustomModalUpiId] = useState<string>('expertstokks@axl');
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
          if (d.success && d.payment) {
            setLinkpeData(d.payment);
            if (!customModalUpiId || customModalUpiId === 'expertstokks@axl') {
              setCustomModalUpiId(d.payment.upiId || 'expertstokks@axl');
            }
          }
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

  // ============================================================
  // 5. SUPPORT TICKETS STATE
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
      if (data.success && Array.isArray(data.tickets)) {
        setSupportTickets(data.tickets);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen && activeTab === 'SUPPORT') {
      fetchSupportTickets();
    }
  }, [isOpen, activeTab]);

  const handleSubmitSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportMsg(null);
    setSubmittingSupport(true);
    try {
      const res = await fetchWithAuth('/api/v1/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: supportCategory, priority: supportPriority, subject: supportSubject, description: supportDesc })
      });
      const data = await res.json();
      if (data.success) {
        setSupportMsg({ type: 'success', text: data.message });
        setSupportSubject('');
        setSupportDesc('');
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

  const isVerified = kycStatus === 'APPROVED' || user?.isKycCompleted;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 animate-in fade-in touch-action-manipulation">
      <div className="bg-[#0D1117] border border-[#30363D] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-[#161B22] p-5 border-b border-[#30363D] flex items-center justify-between font-headline">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-[#0D1117] flex items-center justify-center text-lg font-black shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
              {getInitials(user.username)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight capitalize">{user.username}</h2>
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                  {user.role}
                </span>
                {isVerified ? (
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> VERIFIED
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> KYC PENDING
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8B949E] mt-0.5 font-mono">{user.email} · Client ID: {user.id?.slice(0, 10) || '1113019677'}</p>
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
        <div className="flex bg-[#0D1117] border-b border-[#30363D] px-4 pt-3 gap-1.5 text-xs font-bold font-headline overflow-x-auto scrollbar-none">
          {[
            { key: 'PROFILE', label: 'Personal & Profile', icon: <UserIcon className="w-3.5 h-3.5" /> },
            { key: 'KYC', label: 'KYC Verification', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> },
            { key: 'FUNDS', label: 'Wallet & Ledger', icon: <WalletIcon className="w-3.5 h-3.5 text-blue-400" /> },
            { key: 'SECURITY', label: 'Security & Auth', icon: <Lock className="w-3.5 h-3.5 text-purple-400" /> },
            { key: 'SUPPORT', label: '24/7 Support', icon: <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> },
            { key: 'APPEARANCE', label: 'Lite Mode & Theme', icon: <Sun className="w-3.5 h-3.5 text-amber-400" /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-2.5 px-3 rounded-t-xl transition-all flex items-center gap-1.5 border-b-2 font-black shrink-0 ${
                activeTab === tab.key
                  ? 'border-emerald-400 text-emerald-400 bg-[#161B22]'
                  : 'border-transparent text-[#8B949E] hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body Content */}
        <div className="p-5 overflow-y-auto flex-1 font-label text-xs space-y-4">
          
          {/* ============================================================ */}
          {/* 1. PERSONAL & PROFILE DETAILS TAB */}
          {/* ============================================================ */}
          {activeTab === 'PROFILE' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 font-headline">
              <div className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-400" /> PERSONAL & ACCOUNT DETAILS
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Client / Account ID</label>
                    <input
                      type="text"
                      disabled
                      value={user.id || ''}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-[#8B949E] font-mono text-xs cursor-not-allowed opacity-80"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Username</label>
                    <input
                      type="text"
                      disabled
                      value={user.username || ''}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-[#8B949E] font-mono text-xs cursor-not-allowed opacity-80"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Registered Email</label>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        value={user.email || ''}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 pl-8 text-[#8B949E] font-mono text-xs cursor-not-allowed opacity-80"
                      />
                      <Mail className="w-3.5 h-3.5 text-[#8B949E] absolute left-2.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Full Name</label>
                    <input
                      type="text"
                      placeholder="Enter Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Mobile Number</label>
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="+91 9876543210"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 pl-8 text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                      />
                      <Phone className="w-3.5 h-3.5 text-[#8B949E] absolute left-2.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Date of Birth</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 pl-8 text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                      />
                      <Calendar className="w-3.5 h-3.5 text-[#8B949E] absolute left-2.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Full Residential Address</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Flat / Building, Street, Area"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 pl-8 text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                      />
                      <MapPin className="w-3.5 h-3.5 text-[#8B949E] absolute left-2.5 top-3" />
                    </div>
                  </div>
                </div>

                {profileMsg && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    profileMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {profileMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98"
                >
                  <Save className="w-4 h-4" /> {savingProfile ? 'Saving Details...' : 'Save Profile Details'}
                </button>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleResetCapital}
                  disabled={isResetting}
                  className="w-full py-2.5 rounded-xl bg-[#1C2128] border border-[#30363D] hover:bg-[#30363D] font-bold text-xs text-white transition flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} className={isResetting ? 'animate-spin' : ''} /> Refresh Account Balance
                </button>
                {resetMessage && (
                  <p className="text-center text-xs text-emerald-400 font-bold mt-2">{resetMessage}</p>
                )}
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* 2. KYC VERIFICATION TAB */}
          {/* ============================================================ */}
          {activeTab === 'KYC' && (
            <form onSubmit={handleSubmitKyc} className="space-y-4 font-headline">
              
              {/* KYC Status Header Card */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isVerified 
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
                  : kycStatus === 'SUBMITTED' 
                  ? 'bg-blue-950/40 border-blue-500/30 text-blue-300' 
                  : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    isVerified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">KYC Verification Status</h4>
                    <p className="text-xs text-[#8B949E]">
                      {isVerified 
                        ? 'Your account is fully verified. Trading enabled.' 
                        : kycStatus === 'SUBMITTED' 
                        ? 'Details submitted and under review by Compliance.' 
                        : 'Action Required: Submit PAN, Aadhaar & Bank info to enable trading.'}
                    </p>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isVerified ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {isVerified ? 'VERIFIED' : kycStatus}
                </span>
              </div>

              {/* Form Fields */}
              <div className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">IDENTITY & BANK DETAILS</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">PAN Card Number</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono uppercase font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Aadhaar Number</label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012"
                      value={aadhaarNumber}
                      onChange={(e) => setAadhaarNumber(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Bank Account Holder Name</label>
                    <input
                      type="text"
                      placeholder="Name as in Bank Account"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9182736450"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="SBIN0001234"
                      value={bankIfsc}
                      onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono uppercase font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. State Bank of India"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                {kycMessage && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    kycMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {kycMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingKyc}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98"
                >
                  <ShieldCheck className="w-4 h-4" /> {submittingKyc ? 'Submitting Details...' : 'Submit / Update KYC Details'}
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* 3. FUNDS & WALLET LEDGER TAB */}
          {/* ============================================================ */}
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
                  <span className="font-extrabold font-mono text-emerald-400 text-base mt-0.5 block tabular-nums">
                    ₹{(wallet?.buyingPower ?? wallet?.cashBalance ?? 50000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5 font-bold text-emerald-400/80">Available for new trades</span>
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
                  <span className={`font-extrabold font-mono text-base mt-0.5 block tabular-nums ${(wallet?.realizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(wallet?.realizedPnl ?? 0) >= 0 ? '+' : ''}₹{(wallet?.realizedPnl ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[9px] text-[#8B949E] block mt-0.5">Closed position profits</span>
                </div>

                <div className="bg-[#161B22] p-3 rounded-2xl border border-[#30363D]">
                  <span className="text-[9px] text-[#8B949E] font-bold block uppercase font-headline">UNREALIZED P&L</span>
                  <span className={`font-extrabold font-mono text-base mt-0.5 block tabular-nums ${(wallet?.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                      className={`py-2 rounded-xl font-black text-xs transition border cursor-pointer ${
                        requestType === 'DEPOSIT' ? 'bg-emerald-500 border-emerald-500 text-slate-950 shadow-sm' : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]'
                      }`}
                    >
                      + Request Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType('WITHDRAWAL')}
                      className={`py-2 rounded-xl font-black text-xs transition border cursor-pointer ${
                        requestType === 'WITHDRAWAL' ? 'bg-rose-500 border-rose-500 text-white shadow-sm' : 'bg-[#0D1117] border-[#30363D] text-[#8B949E]'
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
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-emerald-400 tabular-nums"
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
                    <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-slate-900/90 border border-emerald-300 dark:border-emerald-500/30 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <QrCode className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">LinkPe Instant UPI Payment</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Scan QR or Tap to open UPI App</span>
                          </div>
                        </div>

                        {/* EDITABLE ACCOUNT FIELD */}
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-0.5 rounded-xl border border-emerald-400/50">
                          <span className="text-[10px] font-mono font-extrabold text-emerald-600 dark:text-emerald-400">UPI/Account:</span>
                          <input
                            type="text"
                            value={customModalUpiId}
                            onChange={(e) => setCustomModalUpiId(e.target.value)}
                            className="bg-transparent text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none w-32 border-b border-dashed border-emerald-400"
                            title="Edit Account / UPI VPA"
                          />
                        </div>
                      </div>

                      {linkpeData ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(customModalUpiId.trim() || linkpeData.upiId)}&pn=${encodeURIComponent(linkpeData.merchantName)}&amt=${fundAmount}&cu=INR`)}`}
                            alt="LinkPe UPI QR Code"
                            className="w-28 h-28 rounded-lg border border-emerald-300 dark:border-emerald-500/30 p-1 bg-white shrink-0 shadow-md"
                          />
                          <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                              Pay <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">₹{fundAmount.toLocaleString('en-IN')}</span> to <span className="text-slate-900 dark:text-white font-bold">{linkpeData.merchantName}</span>
                            </span>
                            
                            <div className="flex flex-col gap-1.5">
                              <a
                                href={`upi://pay?pa=${encodeURIComponent(customModalUpiId.trim() || linkpeData.upiId)}&pn=${encodeURIComponent(linkpeData.merchantName)}&amt=${fundAmount}&cu=INR`}
                                className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span>Open UPI App (GPay / PhonePe / Paytm)</span>
                              </a>
                              <a
                                href={`https://ptprashanttripathi.github.io/linkpe/?pa=${encodeURIComponent(customModalUpiId.trim() || linkpeData.upiId)}&pn=${encodeURIComponent(linkpeData.merchantName)}&amt=${fundAmount}&tn=Trade%20Grow%20Margin%20Deposit`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition border border-slate-300 dark:border-slate-700"
                              >
                                <ExternalLink className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Open LinkPe Payment Page</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
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
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {fundMessage && (
                    <div className={`p-3 rounded-xl text-xs font-bold ${
                      fundMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}>
                      {fundMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingFundReq}
                    className={`w-full py-3 rounded-xl font-headline font-black text-xs text-white transition flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                      requestType === 'DEPOSIT' ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'bg-rose-500 hover:bg-rose-600'
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
                                r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                                r.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
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

          {/* ============================================================ */}
          {/* 4. SECURITY & PASSWORD TAB */}
          {/* ============================================================ */}
          {activeTab === 'SECURITY' && (
            <form onSubmit={handleChangePassword} className="space-y-4 font-headline">
              <div className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-purple-400" /> CHANGE ACCOUNT PASSWORD
                </h4>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Current Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-mono text-xs focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>

                {passwordMsg && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    passwordMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {passwordMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98"
                >
                  <Lock className="w-4 h-4" /> {updatingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>

              {/* 2FA Info Card */}
              <div className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-2">
                <h4 className="font-bold text-white text-xs">Two-Factor Authentication & Session Security</h4>
                <p className="text-[#8B949E] text-xs">
                  Your session is secured using 256-bit JWT encrypted tokens and IP-anchored rate limit protection.
                </p>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* 5. 24/7 SUPPORT DESK TAB */}
          {/* ============================================================ */}
          {activeTab === 'SUPPORT' && (
            <div className="space-y-4 font-headline">
              <form onSubmit={handleSubmitSupportTicket} className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" /> CREATE SUPPORT HELP TICKET
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Category</label>
                    <select
                      value={supportCategory}
                      onChange={(e) => setSupportCategory(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white text-xs font-bold"
                    >
                      <option value="TRADING">Trading & Execution</option>
                      <option value="KYC">KYC & Account Verification</option>
                      <option value="FUNDS">Funds & Withdrawal</option>
                      <option value="TECHNICAL">App & Technical Issue</option>
                      <option value="OTHER">General Query</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Priority</label>
                    <select
                      value={supportPriority}
                      onChange={(e) => setSupportPriority(e.target.value)}
                      className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white text-xs font-bold"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent / Trade Assistance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief summary of your request"
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white font-bold text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#8B949E] font-bold block mb-1 uppercase">Detailed Description</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explain your issue in detail..."
                    value={supportDesc}
                    onChange={(e) => setSupportDesc(e.target.value)}
                    className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                {supportMsg && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    supportMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {supportMsg.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingSupport}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-98"
                >
                  <MessageSquare className="w-4 h-4" /> {submittingSupport ? 'Submitting Ticket...' : 'Submit Support Ticket'}
                </button>
              </form>

              {/* Tickets History List */}
              <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">MY SUPPORT TICKETS</h4>
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {supportTickets.length === 0 ? (
                    <p className="text-center py-4 text-[#8B949E] text-xs">No support tickets submitted yet.</p>
                  ) : (
                    supportTickets.map((t: any) => (
                      <div key={t.id} className="p-3 bg-[#0D1117] border border-[#30363D] rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{t.subject}</span>
                            <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded uppercase">
                              {t.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#8B949E] block mt-0.5">
                            {new Date(t.created_at || Date.now()).toLocaleString()}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          t.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 6. APPEARANCE & LITE MODE TAB */}
          {/* ============================================================ */}
          {activeTab === 'APPEARANCE' && (
            <div className="space-y-4 font-headline">
              <div className="bg-[#161B22] p-4 rounded-2xl border border-[#30363D] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-400" />
                      Appearance & Interface Theme
                    </h3>
                    <p className="text-xs text-[#8B949E] mt-0.5">
                      Switch between Lite Mode (Light Theme) and Dark Mode for high readability or sleek dark trading.
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${
                    theme === 'light' 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                      : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                  }`}>
                    {theme === 'light' ? 'LITE MODE ACTIVE' : 'DARK MODE ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* LITE MODE CARD */}
                  <div 
                    onClick={() => {
                      if (theme !== 'light' && onToggleTheme) onToggleTheme();
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                      theme === 'light'
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30'
                        : 'bg-[#0D1117] border-[#30363D] hover:border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                          <Sun className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white">Lite Mode</h4>
                          <span className="text-[10px] text-[#8B949E]">High contrast light background</span>
                        </div>
                      </div>
                      {theme === 'light' && (
                        <CheckCircle2 className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <p className="text-xs text-[#8B949E]">
                      Optimized for bright environments and daylight trading. Clean white & slate interfaces.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (theme !== 'light' && onToggleTheme) onToggleTheme();
                      }}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'bg-amber-500 text-[#0D1117] font-black'
                          : 'bg-[#1C2128] text-white hover:bg-amber-500 hover:text-[#0D1117]'
                      }`}
                    >
                      {theme === 'light' ? 'Selected (Active)' : 'Switch to Lite Mode'}
                    </button>
                  </div>

                  {/* DARK MODE CARD */}
                  <div 
                    onClick={() => {
                      if (theme !== 'dark' && onToggleTheme) onToggleTheme();
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                      theme === 'dark'
                        ? 'bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                        : 'bg-[#0D1117] border-[#30363D] hover:border-indigo-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                          <Moon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white">Dark Mode</h4>
                          <span className="text-[10px] text-[#8B949E]">Sleek financial terminal dark</span>
                        </div>
                      </div>
                      {theme === 'dark' && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                      )}
                    </div>
                    <p className="text-xs text-[#8B949E]">
                      Pro financial terminal design. Reduced eye strain with dark background and vibrant charts.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (theme !== 'dark' && onToggleTheme) onToggleTheme();
                      }}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-indigo-500 text-white font-black'
                          : 'bg-[#1C2128] text-white hover:bg-indigo-500'
                      }`}
                    >
                      {theme === 'dark' ? 'Selected (Active)' : 'Switch to Dark Mode'}
                    </button>
                  </div>
                </div>
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
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#8B949E] border border-[#30363D] hover:text-white hover:bg-[#1C2128] cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-md cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
