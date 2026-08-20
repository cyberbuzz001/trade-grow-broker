import React, { useState, useEffect, useRef } from 'react';
import { Search, Eye, Lock, Unlock, KeyRound, X, Check, Copy, RefreshCw, CheckCircle2, AlertTriangle, UserPlus, ShieldAlert, Phone, Mail, MoreVertical, UserX, UserCheck, Ban, ShieldOff, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomerListProps { 
  token: string; 
  onSelectCustomer: (id: string) => void; 
}

export const CustomerList: React.FC<CustomerListProps> = ({ token, onSelectCustomer }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Add Customer Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createClientId, setCreateClientId] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('USER');
  const [createInitialCapital, setCreateInitialCapital] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState<{ field: string; message: string; existingCustomer?: any } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Duplicate Identity Scanner State
  const [showDuplicateScanner, setShowDuplicateScanner] = useState(false);
  const [duplicateClusters, setDuplicateClusters] = useState<any | null>(null);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);

  // Action Dropdown & Confirm Dialog State
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    requireReason?: boolean;
    actionLabel: string;
    actionColor: string;
    onConfirm: (reason?: string) => void;
  } | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Customer Modal State
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editRole, setEditRole] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchCustomers = () => {
    const params = new URLSearchParams({ limit: '50', offset: String(page * 50) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/v1/admin/customers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) { setCustomers(d.customers); setTotal(d.total); } });
  };

  const fetchDuplicateClusters = () => {
    setLoadingDuplicates(true);
    fetch('/api/v1/admin/customers/duplicates', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) setDuplicateClusters(d.duplicates);
        setLoadingDuplicates(false);
      })
      .catch(() => setLoadingDuplicates(false));
  };

  useEffect(() => { fetchCustomers(); }, [token, search, statusFilter, page]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Action Helpers ──────────────────────────────────────────────────────
  const adminAction = async (endpoint: string, method: string, body?: object) => {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
  };

  const showConfirm = (opts: typeof confirmDialog) => {
    setConfirmReason('');
    setActionMsg(null);
    setConfirmDialog(opts);
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog) return;
    setActionLoading(true);
    try {
      await confirmDialog.onConfirm(confirmReason);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (c: any) => {
    setEditTarget(c);
    setEditFullName(c.full_name || '');
    setEditEmail(c.email || '');
    setEditPhone(c.phone_number || '');
    setEditAddress(c.address || '');
    setEditCity(c.city || '');
    setEditRole(c.role || 'USER');
    setEditMsg(null);
    setOpenDropdown(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSubmittingEdit(true);
    setEditMsg(null);
    try {
      const data = await adminAction(`/api/v1/admin/customers/${editTarget.id}`, 'PATCH', {
        fullName: editFullName,
        email: editEmail,
        phoneNumber: editPhone,
        address: editAddress,
        city: editCity,
        role: editRole
      });
      if (data.success) {
        setEditMsg({ type: 'success', text: 'Profile updated successfully.' });
        fetchCustomers();
        setTimeout(() => setEditTarget(null), 1500);
      } else {
        setEditMsg({ type: 'error', text: data.error?.message || 'Update failed' });
      }
    } catch {
      setEditMsg({ type: 'error', text: 'Network error' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleSuspend = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Suspend Account — ${c.username}`,
      message: `Suspending will block all trading and login for this customer. This action is fully reversible.`,
      requireReason: true,
      actionLabel: 'Confirm Suspend',
      actionColor: 'bg-amber-600 hover:bg-amber-500',
      onConfirm: async (reason) => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/suspend`, 'POST', { reason });
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to suspend' });
        }
      }
    });
  };

  const handleActivate = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Activate Account — ${c.username}`,
      message: `This will restore full trading access for ${c.username}. Current status: ${c.status}.`,
      actionLabel: 'Confirm Activate',
      actionColor: 'bg-emerald-600 hover:bg-emerald-500',
      onConfirm: async () => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/activate`, 'POST', {});
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to activate' });
        }
      }
    });
  };

  const handleLock = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Lock Account — ${c.username}`,
      message: `Locking places a security hold on the account. User cannot login or trade.`,
      requireReason: true,
      actionLabel: 'Confirm Lock',
      actionColor: 'bg-blue-600 hover:bg-blue-500',
      onConfirm: async (reason) => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/lock`, 'POST', { reason });
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to lock' });
        }
      }
    });
  };

  const handleUnlock = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Unlock Account — ${c.username}`,
      message: `Unlocking will restore the account to ACTIVE status.`,
      actionLabel: 'Confirm Unlock',
      actionColor: 'bg-emerald-600 hover:bg-emerald-500',
      onConfirm: async () => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/unlock`, 'POST', {});
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 1500);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Failed to unlock' });
        }
      }
    });
  };

  const handleCloseAccount = (c: any) => {
    setOpenDropdown(null);
    showConfirm({
      title: `Close Account — ${c.username}`,
      message: `⚠️ This permanently closes the account. All data is preserved but trading will be blocked. Requires zero open positions and zero used margin. Only SUPER_ADMIN can perform this action.`,
      requireReason: true,
      actionLabel: 'Confirm Close Account',
      actionColor: 'bg-rose-700 hover:bg-rose-600',
      onConfirm: async (reason) => {
        const data = await adminAction(`/api/v1/admin/customers/${c.id}/close`, 'POST', { reason, confirmClose: true });
        if (data.success) {
          setActionMsg({ type: 'success', text: data.message });
          fetchCustomers();
          setTimeout(() => setConfirmDialog(null), 2000);
        } else {
          setActionMsg({ type: 'error', text: data.error?.message || 'Cannot close account' });
        }
      }
    });
  };

  // Debounced real-time duplicate validation check
  useEffect(() => {
    if (!showCreateModal) {
      setDuplicateWarning(null);
      return;
    }

    const trimmedEmail = createEmail.trim();
    const trimmedUsername = createUsername.trim();
    const trimmedClientId = createClientId.trim();

    if (!trimmedEmail && !trimmedUsername && !trimmedClientId) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(() => {
      setCheckingDuplicate(true);
      const params = new URLSearchParams();
      if (trimmedEmail) params.set('email', trimmedEmail);
      if (trimmedUsername) params.set('username', trimmedUsername);
      if (trimmedClientId) params.set('clientId', trimmedClientId);

      fetch(`/api/v1/admin/customers/check-duplicate?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.isDuplicate) {
            setDuplicateWarning({
              field: d.field,
              message: d.message,
              existingCustomer: d.existingCustomer
            });
          } else {
            setDuplicateWarning(null);
          }
          setCheckingDuplicate(false);
        })
        .catch(() => setCheckingDuplicate(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [createEmail, createUsername, createClientId, showCreateModal]);

  const handleGenerateClientId = () => {
    const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
    setCreateClientId(`TG-USR-${randomHex}`);
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setCreateUsername('');
    setCreateEmail('');
    handleGenerateClientId();
    setCreateFullName('');
    setCreatePhone('');
    setCreatePassword('TG@' + Math.random().toString(36).slice(-6) + '#9');
    setCreateRole('USER');
    setCreateInitialCapital(0);
    setDuplicateWarning(null);
    setCreateMsg(null);
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateWarning) return;
    setSubmittingCreate(true);
    setCreateMsg(null);

    try {
      const res = await fetch('/api/v1/admin/customers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: createUsername,
          email: createEmail,
          clientId: createClientId,
          fullName: createFullName,
          phoneNumber: createPhone,
          password: createPassword,
          role: createRole,
          initialCapital: createInitialCapital
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreateMsg({ type: 'success', text: data.message || 'Customer created successfully!' });
        fetchCustomers();
        setTimeout(() => {
          setShowCreateModal(false);
        }, 1500);
      } else {
        setCreateMsg({ type: 'error', text: data.error?.message || 'Failed to create customer' });
      }
    } catch (err: any) {
      setCreateMsg({ type: 'error', text: err.message || 'Network error while creating customer' });
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleFreeze = async (id: string) => {
    await fetch(`/api/v1/admin/customers/${id}/freeze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Admin action' })
    });
    fetchCustomers();
  };

  const handleUnfreeze = async (id: string) => {
    await fetch(`/api/v1/admin/customers/${id}/unfreeze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'Admin action' })
    });
    fetchCustomers();
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = 'TG@';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setCopied(false);
  };

  const handleOpenResetModal = (user: any) => {
    setResetTargetUser(user);
    setNewPassword('');
    setResetMsg(null);
    setCopied(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (!newPassword || newPassword.length < 6) {
      setResetMsg({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setSubmittingReset(true);
    setResetMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/customers/${resetTargetUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setResetMsg({ type: 'success', text: data.message || 'Password successfully reset!' });
      } else {
        setResetMsg({ type: 'error', text: data.error?.message || data.message || 'Failed to reset password' });
      }
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message || 'Network error while resetting password' });
    } finally {
      setSubmittingReset(false);
    }
  };

  const handleCopyPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full relative select-none">
      {/* Search, Filter & Action Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by Client ID (TG-USR-XXXX), Name, or Email..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500" 
          />
        </div>

        <select 
          value={statusFilter} 
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="FROZEN">Frozen</option>
          <option value="LOCKED">Locked</option>
          <option value="CLOSED">Closed</option>
          <option value="DISABLED">Disabled</option>
        </select>

        {/* Duplicate Identity Scanner Button */}
        <button
          onClick={() => { setShowDuplicateScanner(true); fetchDuplicateClusters(); }}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-amber-300 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          title="Scan Database for Duplicate Identities"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Duplicate Scanner</span>
        </button>

        {/* Add Customer Button */}
        <button
          onClick={handleOpenCreateModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Add Customer</span>
        </button>

        <span className="text-[10px] text-slate-500 font-mono">{total} total</span>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex-1 overflow-y-auto shadow-xl">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 font-bold tracking-wider">
            <tr>
              <th className="py-3 px-3.5">Client ID</th>
              <th className="py-3 px-3.5">Client Name</th>
              <th className="py-3 px-3.5">Email Address</th>
              <th className="py-3 px-3.5">Status</th>
              <th className="py-3 px-3.5">KYC</th>
              <th className="py-3 px-3.5">Role</th>
              <th className="py-3 px-3.5 text-right">Funds (₹)</th>
              <th className="py-3 px-3.5">Last Login</th>
              <th className="py-3 px-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {customers.map(c => {
              const displayClientId = c.client_id || `TG-USR-${c.id.slice(4, 8).toUpperCase()}`;
              return (
                <tr key={c.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-amber-400 font-bold">
                    {displayClientId}
                  </td>
                  <td className="py-2.5 px-3.5 font-semibold text-white">
                    <div>{c.username}</div>
                    {c.full_name && c.full_name !== c.username && (
                      <div className="text-[10px] text-slate-500 font-normal">{c.full_name}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">{c.email}</td>
                  <td className="py-2.5 px-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      c.status === 'FROZEN' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                      c.status === 'LOCKED' ? 'bg-violet-950 text-violet-400 border border-violet-800' :
                      c.status === 'CLOSED' ? 'bg-slate-800 text-slate-500 border border-slate-700' :
                      'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>{c.status}</span>
                  </td>
                  <td className="py-2.5 px-3.5">
                    <div className="space-y-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${
                        c.kyc_status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        c.kyc_status === 'REJECTED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        c.kyc_status ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-slate-800 text-slate-500'
                      }`}>{c.kyc_status || 'N/A'}</span>
                      {c.bank_account_number && (
                        <div className="text-[10px] font-mono text-indigo-400 truncate max-w-[120px]" title={`${c.bank_name || 'Bank'}: ${c.bank_account_number}`}>
                          🏦 {c.bank_name ? c.bank_name.slice(0, 8) : 'A/C'} ••{c.bank_account_number.slice(-4)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3.5"><span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-amber-400 border border-slate-700 font-bold">{c.role}</span></td>
                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-400">₹{(c.cash_balance || 0).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3.5 text-slate-500 text-[10px]">{c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : 'Never'}</td>
                  <td className="py-2.5 px-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* View 360 */}
                      <button 
                        onClick={() => onSelectCustomer(c.id)} 
                        title="View 360" 
                        className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Reset Password */}
                      <button
                        onClick={() => handleOpenResetModal(c)}
                        title="Admin Reset Password"
                        className="p-1.5 text-amber-400/80 hover:text-amber-300 rounded-lg hover:bg-amber-950/40 transition cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      {/* More Actions Dropdown */}
                      <div className="relative" ref={openDropdown === c.id ? dropdownRef : null}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === c.id ? null : c.id)}
                          title="More Actions"
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openDropdown === c.id && (
                          <div className="absolute right-0 top-7 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-44 py-1 text-xs">
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="w-full text-left px-3.5 py-2 text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Edit Profile
                            </button>
                            <div className="my-1 border-t border-slate-800" />
                            {c.status !== 'ACTIVE' && c.status !== 'CLOSED' && (
                              <button
                                onClick={() => handleActivate(c)}
                                className="w-full text-left px-3.5 py-2 text-emerald-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Activate
                              </button>
                            )}
                            {c.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleSuspend(c)}
                                className="w-full text-left px-3.5 py-2 text-amber-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" /> Suspend
                              </button>
                            )}
                            {c.status !== 'LOCKED' && c.status !== 'CLOSED' && (
                              <button
                                onClick={() => handleLock(c)}
                                className="w-full text-left px-3.5 py-2 text-violet-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <Lock className="w-3.5 h-3.5" /> Lock (Security Hold)
                              </button>
                            )}
                            {c.status === 'LOCKED' && (
                              <button
                                onClick={() => handleUnlock(c)}
                                className="w-full text-left px-3.5 py-2 text-blue-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <Unlock className="w-3.5 h-3.5" /> Unlock
                              </button>
                            )}
                            <div className="my-1 border-t border-slate-800" />
                            {c.status !== 'CLOSED' && (
                              <button
                                onClick={() => handleCloseAccount(c)}
                                className="w-full text-left px-3.5 py-2 text-rose-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                              >
                                <UserX className="w-3.5 h-3.5" /> Close Account
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {total > 50 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-slate-500 font-mono">
            Showing {page * 50 + 1}–{Math.min(page * 50 + 50, total)} of {total} customers
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-30 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white px-1">Page {page + 1} / {Math.ceil(total / 50)}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * 50 >= total}
              className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-30 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── CONFIRM ACTION DIALOG ───────────────────────────────────────────── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
              <button onClick={() => setConfirmDialog(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{confirmDialog.message}</p>

            {confirmDialog.requireReason && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason / Notes *</label>
                <textarea
                  value={confirmReason}
                  onChange={e => setConfirmReason(e.target.value)}
                  rows={2}
                  placeholder="Provide a reason for this action..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {actionMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                actionMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {actionMsg.text}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={actionLoading || (confirmDialog.requireReason && !confirmReason.trim())}
                className={`px-5 py-2 rounded-xl ${confirmDialog.actionColor} disabled:opacity-40 text-white font-black text-xs transition cursor-pointer`}
              >
                {actionLoading ? 'Processing...' : confirmDialog.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT CUSTOMER PROFILE MODAL ─────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Customer Profile</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{editTarget.client_id} — {editTarget.username}</p>
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <input value={editFullName} onChange={e => setEditFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                  <input value={editCity} onChange={e => setEditCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</label>
                <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500">
                  <option value="USER">USER (Standard Client)</option>
                  <option value="MANAGER">MANAGER (Client Account Oversight)</option>
                  <option value="FINANCE_MANAGER">FINANCE_MANAGER (Deposits & Ledgers)</option>
                  <option value="RISK_MANAGER">RISK_MANAGER (Exposure & Margins)</option>
                  <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER (Operations Oversight)</option>
                  <option value="KYC_OFFICER">KYC_OFFICER (KYC & Documents)</option>
                  <option value="DEALER">DEALER (Order Desk Execution)</option>
                  <option value="SUPPORT_AGENT">SUPPORT_AGENT (Customer Support)</option>
                  <option value="ANALYST">ANALYST (Market Research & Stats)</option>
                  <option value="READ_ONLY_AUDITOR">READ_ONLY_AUDITOR (Compliance Audit)</option>
                  <option value="ADMIN">ADMIN (System Administrator)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Authority)</option>
                </select>
              </div>

              {editMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  editMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {editMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {editMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submittingEdit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs transition cursor-pointer">
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE CUSTOMER MODAL WITH LIVE DUPLICATE CHECKER ─────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create New Customer Account</h3>
                  <p className="text-[10px] text-slate-400">Strict unique email &amp; Client ID verification active</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Duplicate Warning Banner */}
            {duplicateWarning && (
              <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-300 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Duplicate Client Detected ({duplicateWarning.field.toUpperCase()})</span>
                </div>
                <p className="text-[11px] text-slate-300">{duplicateWarning.message}</p>
                {duplicateWarning.existingCustomer && (
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 font-mono text-[10px] space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Existing Client ID:</span><span className="text-amber-400 font-bold">{duplicateWarning.existingCustomer.clientId}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Username:</span><span className="text-white font-bold">{duplicateWarning.existingCustomer.username}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Status:</span><span className="text-emerald-400">{duplicateWarning.existingCustomer.status}</span></div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-3.5 text-xs">
              {/* Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address *</label>
                  {checkingDuplicate && <span className="text-[10px] text-slate-500 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Checking uniqueness...</span>}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="client@gmail.com"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Client ID & Username */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client ID *</label>
                    <button
                      type="button"
                      onClick={handleGenerateClientId}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={createClientId}
                    onChange={e => setCreateClientId(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="pravinbhai"
                    value={createUsername}
                    onChange={e => setCreateUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Full Name & Phone Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="Pravin Bhai"
                    value={createFullName}
                    onChange={e => setCreateFullName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={createPhone}
                    onChange={e => setCreatePhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Password & Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Password *</label>
                  <input
                    type="text"
                    required
                    value={createPassword}
                    onChange={e => setCreatePassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</label>
                  <select
                    value={createRole}
                    onChange={e => setCreateRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-semibold"
                  >
                    <option value="USER">USER (Standard Client)</option>
                    <option value="MANAGER">MANAGER (Client Account Oversight)</option>
                    <option value="FINANCE_MANAGER">FINANCE_MANAGER (Deposits & Ledgers)</option>
                    <option value="RISK_MANAGER">RISK_MANAGER (Exposure & Margins)</option>
                    <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER (Operations Oversight)</option>
                    <option value="KYC_OFFICER">KYC_OFFICER (KYC & Documents)</option>
                    <option value="DEALER">DEALER (Order Desk Execution)</option>
                    <option value="SUPPORT_AGENT">SUPPORT_AGENT (Customer Support)</option>
                    <option value="ANALYST">ANALYST (Market Research & Stats)</option>
                    <option value="READ_ONLY_AUDITOR">READ_ONLY_AUDITOR (Compliance Audit)</option>
                    <option value="ADMIN">ADMIN (System Administrator)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full Platform Authority)</option>
                  </select>
                </div>
              </div>

              {/* Initial Capital */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Initial Wallet Capital (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={createInitialCapital}
                  onChange={e => setCreateInitialCapital(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {createMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  createMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {createMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {createMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate || !!duplicateWarning || !createEmail || !createUsername}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs transition shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  {submittingCreate ? 'Validating & Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ── DUPLICATE IDENTITY SCANNER MODAL ─────────────────────────────── */}
      {showDuplicateScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Duplicate Identity Audit Scanner</h3>
                  <p className="text-[10px] text-slate-400">Automated detection of shared emails, phones, and PAN identities</p>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicateScanner(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDuplicates ? (
              <div className="py-12 text-center text-slate-400 text-xs">Scanning database identities...</div>
            ) : duplicateClusters && (
              <div className="space-y-4 text-xs">
                {/* Duplicate Emails Cluster */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      Duplicate Email Groups ({(duplicateClusters.byEmail || []).length})
                    </span>
                  </div>

                  {(duplicateClusters.byEmail || []).length === 0 ? (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Zero duplicate emails detected. Database uniqueness verified!</p>
                  ) : (
                    <div className="space-y-2">
                      {duplicateClusters.byEmail.map((item: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <div className="font-mono text-amber-300 font-bold">{item.norm_email} ({item.count} accounts)</div>
                          <div className="text-[10px] text-slate-400 font-mono">User IDs: {item.user_ids?.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Duplicate Phone Numbers */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                      Duplicate Phone Number Clusters ({(duplicateClusters.byPhone || []).length})
                    </span>
                  </div>

                  {(duplicateClusters.byPhone || []).length === 0 ? (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No shared phone numbers found across accounts.</p>
                  ) : (
                    <div className="space-y-2">
                      {duplicateClusters.byPhone.map((item: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                          <div className="font-mono text-amber-300 font-bold">Phone: {item.phone_number} ({item.count} accounts)</div>
                          <div className="text-[10px] text-slate-400 font-mono">Usernames: {item.usernames?.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDuplicateScanner(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN RESET PASSWORD MODAL ───────────────────────────────────── */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Admin Password Reset</h3>
                  <p className="text-[10px] text-slate-400">Set a new password for client login</p>
                </div>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Card */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Client ID:</span>
                <span className="text-emerald-400 font-bold">{resetTargetUser.client_id || `TG-${resetTargetUser.id.slice(0, 8).toUpperCase()}`}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Username:</span>
                <span className="text-white font-bold">{resetTargetUser.username}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Email:</span>
                <span className="text-slate-300">{resetTargetUser.email}</span>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Password *</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-Generate Strong
                  </button>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500 pr-10"
                  />
                  {newPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                      title="Copy Password"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {resetMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  resetMsg.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {resetMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {resetMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReset || !newPassword || newPassword.length < 6}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {submittingReset ? 'Updating Password...' : 'Confirm Reset Password'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
