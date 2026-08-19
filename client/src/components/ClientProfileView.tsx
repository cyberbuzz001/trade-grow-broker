import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  ShieldCheck, 
  Wallet as WalletIcon, 
  Lock, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Save, 
  CheckCircle2, 
  Building2, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  UploadCloud,
  Sparkles,
  KeyRound,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Sun,
  Moon
} from 'lucide-react';
import { User, Wallet } from '../types';

interface ClientProfileViewProps {
  user: User;
  wallet: Wallet | null;
  token?: string | null;
  onRefreshWallet: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const ClientProfileView: React.FC<ClientProfileViewProps> = ({
  user,
  wallet,
  token,
  onRefreshWallet,
  theme = 'dark',
  onToggleTheme
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'KYC' | 'BANK' | 'SECURITY' | 'APPEARANCE'>('KYC');

  // Helper for authenticated requests
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token') || '';
    const headers = new Headers(options.headers || {});
    if (userToken) headers.set('Authorization', `Bearer ${userToken}`);
    return fetch(url, { ...options, headers });
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
    fetchProfileDetails();
    fetchKycStatus();
  }, [token]);

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
        setProfileMsg({ type: 'success', text: data.message || 'Profile details updated successfully!' });
      } else {
        setProfileMsg({ type: 'error', text: data.error?.message || 'Failed to update profile' });
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

    try {
      const res = await fetchWithAuth('/api/v1/kyc/submit', {
        method: 'POST',
        body: formData,
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

  // ============================================================
  // 3. SECURITY STATE
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
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setSecurityMsg({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
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
  // 4. WITHDRAWAL & PAYOUTS STATE
  // ============================================================
  const [withdrawAmount, setWithdrawAmount] = useState<number>(5000);
  const [withdrawMethod, setWithdrawMethod] = useState<string>('BANK_TRANSFER');
  const [withdrawNote, setWithdrawNote] = useState<string>('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);

  const availableBalance = wallet?.buyingPower ?? wallet?.cashBalance ?? 0;

  const fetchPayoutHistory = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/funds/my-requests');
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setPayoutHistory(data.requests);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'BANK') {
      fetchPayoutHistory();
    }
  }, [activeTab]);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount <= 0) {
      setWithdrawMsg({ type: 'error', text: 'Withdrawal amount must be greater than ₹0' });
      return;
    }
    if (withdrawAmount > availableBalance) {
      setWithdrawMsg({ type: 'error', text: `Insufficient available funds. Maximum withdrawable: ₹${availableBalance.toLocaleString('en-IN')}` });
      return;
    }

    setSubmittingWithdraw(true);
    setWithdrawMsg(null);
    try {
      const res = await fetchWithAuth('/api/v1/funds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'WITHDRAWAL',
          amount: withdrawAmount,
          paymentMethod: withdrawMethod,
          referenceNote: withdrawNote.trim() || `Bank Payout to ${bankName || 'Linked Bank'}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawMsg({ type: 'success', text: data.message || 'Withdrawal request submitted successfully for Admin approval!' });
        fetchPayoutHistory();
        if (onRefreshWallet) onRefreshWallet();
      } else {
        setWithdrawMsg({ type: 'error', text: data.error?.message || data.message || 'Failed to submit withdrawal request' });
      }
    } catch (err: any) {
      setWithdrawMsg({ type: 'error', text: err.message || 'Network error while submitting withdrawal' });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* HEADER HERO PROFILE BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-indigo-600 border border-emerald-400/40 flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-lg">
              {(fullName || user.username || 'T').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {fullName || user.username}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  kycStatus === 'APPROVED' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  {kycStatus === 'APPROVED' ? 'KYC Verified' : kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW' ? 'Under Review' : 'KYC Pending'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {user.email}
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 font-bold">Client ID: TG-{user.id.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-3 rounded-2xl flex-1 md:flex-initial">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Margin</span>
              <span className="text-lg font-black text-emerald-400 num-font">
                ₹{(wallet?.cashBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex items-center gap-2 mt-8 pt-4 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          {[
            { id: 'KYC', label: 'KYC & Document Verification', icon: <ShieldCheck className="w-4 h-4" /> },
            { id: 'PROFILE', label: 'Personal Information', icon: <UserIcon className="w-4 h-4" /> },
            { id: 'BANK', label: 'Bank & Payout Accounts', icon: <Building2 className="w-4 h-4" /> },
            { id: 'SECURITY', label: 'Security & 2FA / Password', icon: <KeyRound className="w-4 h-4" /> },
            { id: 'APPEARANCE', label: 'Lite Mode & Theme', icon: <Sun className="w-4 h-4 text-amber-400" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT 1: KYC VERIFICATION */}
      {activeTab === 'KYC' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                KYC & Regulatory Compliance
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Submit official PAN, Aadhaar, and Bank proof for account trading verification.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                kycStatus === 'APPROVED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : kycStatus === 'SUBMITTED' || kycStatus === 'UNDER_REVIEW'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {kycStatus === 'APPROVED' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                Status: {kycStatus}
              </span>
            </div>
          </div>

          {kycMessage && (
            <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
              kycMessage.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {kycMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {kycMessage.text}
            </div>
          )}

          <form onSubmit={handleKycSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* PAN Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">PAN Card Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white uppercase font-mono tracking-wider"
                />
              </div>

              {/* Aadhaar Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Aadhaar Card Number (12 Digits) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1234 5678 9012"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                  maxLength={12}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-mono tracking-wider"
                />
              </div>

              {/* Bank Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bank Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank Ltd"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Bank Account Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bank Account Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50100234567890"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              {/* Bank Account Holder Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Holder Name *</label>
                <input
                  type="text"
                  required
                  placeholder="As per bank passbook"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* IFSC Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bank IFSC Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC0000123"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  maxLength={11}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white uppercase font-mono"
                />
              </div>
            </div>

            {/* DOCUMENT ATTACHMENT UPLOADS */}
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Upload Verification Documents (PDF / JPG / PNG)
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* PAN File */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
                  <span className="text-[11px] font-bold text-white block mb-1">PAN Card Photo</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPanFile(e.target.files?.[0] || null)}
                    className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500 hover:file:text-white"
                  />
                  {panFile && <span className="text-[10px] text-emerald-400 font-bold mt-1 block">✓ {panFile.name}</span>}
                </div>

                {/* Aadhaar Front */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
                  <span className="text-[11px] font-bold text-white block mb-1">Aadhaar Front</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setAadhaarFrontFile(e.target.files?.[0] || null)}
                    className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500 hover:file:text-white"
                  />
                  {aadhaarFrontFile && <span className="text-[10px] text-emerald-400 font-bold mt-1 block">✓ {aadhaarFrontFile.name}</span>}
                </div>

                {/* Aadhaar Back */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
                  <span className="text-[11px] font-bold text-white block mb-1">Aadhaar Back</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setAadhaarBackFile(e.target.files?.[0] || null)}
                    className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500 hover:file:text-white"
                  />
                  {aadhaarBackFile && <span className="text-[10px] text-emerald-400 font-bold mt-1 block">✓ {aadhaarBackFile.name}</span>}
                </div>

                {/* Bank Cheque */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
                  <span className="text-[11px] font-bold text-white block mb-1">Cancelled Cheque</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setBankProofFile(e.target.files?.[0] || null)}
                    className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500 hover:file:text-white"
                  />
                  {bankProofFile && <span className="text-[10px] text-emerald-400 font-bold mt-1 block">✓ {bankProofFile.name}</span>}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={submittingKyc || kycStatus === 'APPROVED'}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
              >
                {submittingKyc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>{kycStatus === 'APPROVED' ? 'KYC Already Approved' : submittingKyc ? 'Submitting KYC...' : 'Submit KYC for Verification'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT 2: PERSONAL PROFILE */}
      {activeTab === 'PROFILE' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-emerald-400" />
              Personal Profile & Contact Information
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Keep your contact details and residential address updated for official trading communications.
            </p>
          </div>

          {profileMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
              profileMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nikhil Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">City / District</label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai, Maharashtra"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-300">Complete Address</label>
                <textarea
                  rows={3}
                  placeholder="Street address, Flat/Building no., Landmark, Pincode"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-4 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-2.5 rounded-2xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
              >
                {savingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB CONTENT 3: BANK & PAYOUTS */}
      {activeTab === 'BANK' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Verified Bank & Payout Accounts
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Trading proceeds and withdrawal settlements are routed through these verified accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white">{bankName || 'Primary Linked Bank'}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">Primary</span>
              </div>
              <div className="space-y-1 text-xs text-slate-400 font-mono">
                <p>A/C: <span className="text-white font-bold">{bankAccountNumber ? `•••• •••• ${bankAccountNumber.slice(-4)}` : 'Not Set'}</span></p>
                <p>IFSC: <span className="text-white font-bold">{bankIfsc || 'Not Set'}</span></p>
                <p>Name: <span className="text-slate-300">{bankAccountName || fullName || user.username}</span></p>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('KYC')}
              className="p-5 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 hover:border-emerald-500/50 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white">Update Linked Bank via KYC</span>
              <span className="text-[10px] text-slate-400">Requires verified bank cheque/statement upload</span>
            </div>
          </div>

          {/* WITHDRAWAL / PAYOUT REQUEST FORM */}
          <div className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Request Fund Withdrawal / Payout</h4>
                  <p className="text-[11px] text-slate-400">Funds will be credited directly to your primary verified bank account.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Withdrawable:</span>
                <span className="text-xs font-mono font-black text-emerald-400">₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              {/* Presets */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Select Withdrawal Amount (₹)</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[500, 1000, 5000, 10000, 25000].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setWithdrawAmount(preset)}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition border cursor-pointer ${
                        withdrawAmount === preset
                          ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/20'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(Math.floor(availableBalance))}
                    disabled={availableBalance <= 0}
                    className="py-2 rounded-xl text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
                  >
                    Max
                  </button>
                </div>

                <div className="relative mt-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(Math.max(100, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-white font-mono font-extrabold text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Payout Channel & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payout Channel</label>
                  <select
                    value={withdrawMethod}
                    onChange={e => setWithdrawMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-xs font-bold focus:outline-none focus:border-rose-500"
                  >
                    <option value="BANK_TRANSFER">Bank IMPS / NEFT Transfer</option>
                    <option value="UPI">UPI Instant Payout</option>
                    <option value="WALLET">Digital Wallet Payout</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payout Reference / Note (Optional)</label>
                  <input
                    type="text"
                    value={withdrawNote}
                    onChange={e => setWithdrawNote(e.target.value)}
                    placeholder="e.g. Account Number / Specific remarks"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {withdrawMsg && (
                <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  withdrawMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {withdrawMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {withdrawMsg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingWithdraw || withdrawAmount <= 0 || withdrawAmount > availableBalance}
                className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                {submittingWithdraw ? (
                  <span>Processing Withdrawal Request...</span>
                ) : (
                  <span>Submit ₹{withdrawAmount.toLocaleString('en-IN')} Withdrawal Request for Admin Approval</span>
                )}
              </button>
            </form>
          </div>

          {/* PAYOUT HISTORY TRACKER */}
          <div className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Withdrawal & Payout History
              </h4>
              <span className="text-[10px] font-mono text-slate-400">Total: {payoutHistory.filter(r => (r.request_type || '').toUpperCase() === 'WITHDRAWAL').length}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2 px-3">Req ID</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Payout Method</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950">
                  {payoutHistory.filter(r => (r.request_type || '').toUpperCase() === 'WITHDRAWAL').map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-900/60 transition">
                      <td className="py-2 px-3 font-mono font-bold text-white">{r.request_id}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-rose-400">
                        -₹{parseFloat(r.amount).toLocaleString('en-IN')}
                      </td>
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
                  {payoutHistory.filter(r => (r.request_type || '').toUpperCase() === 'WITHDRAWAL').length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">No withdrawal requests recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: SECURITY */}
      {activeTab === 'SECURITY' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-emerald-400" />
              Security & Authentication Settings
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage your password, login sessions, and two-factor authentication.
            </p>
          </div>

          {securityMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
              securityMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {securityMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {securityMsg.text}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-2.5 rounded-2xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
            >
              {savingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Update Password</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB CONTENT 5: APPEARANCE & LITE MODE */}
      {activeTab === 'APPEARANCE' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-400" />
                Appearance & Interface Theme (Lite Mode)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize your trading visual interface. Switch between Lite Mode (Light Theme) and Pro Dark Mode.
              </p>
            </div>
            <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
              theme === 'light'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
            }`}>
              {theme === 'light' ? 'LITE MODE ACTIVE' : 'DARK MODE ACTIVE'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* LITE MODE CARD */}
            <div
              onClick={() => {
                if (theme !== 'light' && onToggleTheme) onToggleTheme();
              }}
              className={`p-6 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                theme === 'light'
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/40'
                  : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Sun className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white">Lite Mode</h4>
                    <p className="text-xs text-slate-400">High contrast light background design</p>
                  </div>
                </div>
                {theme === 'light' && (
                  <CheckCircle2 className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Optimized for day trading in bright light or office environments. Crisp light gray background with high-contrast dark text and green/red trading accents.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (theme !== 'light' && onToggleTheme) onToggleTheme();
                }}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-white hover:bg-amber-500 hover:text-slate-950'
                }`}
              >
                {theme === 'light' ? 'Selected (Lite Mode Active)' : 'Switch to Lite Mode'}
              </button>
            </div>

            {/* DARK MODE CARD */}
            <div
              onClick={() => {
                if (theme !== 'dark' && onToggleTheme) onToggleTheme();
              }}
              className={`p-6 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                theme === 'dark'
                  ? 'bg-indigo-500/10 border-indigo-500/50 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/40'
                  : 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    <Moon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-white">Dark Mode</h4>
                    <p className="text-xs text-slate-400">Pro financial terminal layout</p>
                  </div>
                </div>
                {theme === 'dark' && (
                  <CheckCircle2 className="w-6 h-6 text-indigo-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Standard dark financial workstation. Reduces eye strain during intense trading sessions with dark slate background and high-vibrancy charts.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (theme !== 'dark' && onToggleTheme) onToggleTheme();
                }}
                className={`w-full py-3 px-4 rounded-xl font-black text-xs transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-900 text-white hover:bg-indigo-500'
                }`}
              >
                {theme === 'dark' ? 'Selected (Dark Mode Active)' : 'Switch to Dark Mode'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
