import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Users, Key, CheckCircle2, XCircle, AlertTriangle, Search,
  RefreshCw, Lock, Unlock, Save, Settings2, Sliders, Check, X,
  FileCheck, DollarSign, Activity, Eye, ChevronRight, UserCheck, Sparkles, Filter
} from 'lucide-react';

interface PermissionsDashboardProps {
  token: string;
}

interface PermissionItem {
  key: string;
  label: string;
  description: string;
  defaultRoles: string[];
}

interface PermissionCategory {
  category: string;
  description: string;
  permissions: PermissionItem[];
}

interface UserAccount {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  role: string;
  status: string;
  is_kyc_completed: boolean;
  created_at: string;
  max_users: number;
  max_exposure_per_user: number;
  max_deposit_approval: number;
  max_withdrawal_approval: number;
  max_daily_loss_cap: number;
  assigned_users_count: number;
  customPermissions: Record<string, boolean>;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  ADMIN: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  MANAGER: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  FINANCE_MANAGER: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  RISK_MANAGER: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  OPERATIONS_MANAGER: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  KYC_OFFICER: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  DEALER: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  SUPPORT_AGENT: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  ANALYST: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  READ_ONLY_AUDITOR: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' },
  USER: { bg: 'bg-slate-800/40', text: 'text-slate-300', border: 'border-slate-700/50' },
};

const ALL_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER',
  'OPERATIONS_MANAGER', 'KYC_OFFICER', 'DEALER', 'SUPPORT_AGENT', 'ANALYST',
  'READ_ONLY_AUDITOR', 'USER'
];

export const PermissionsDashboard: React.FC<PermissionsDashboardProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'MATRIX'>('USERS');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [roles, setRoles] = useState<string[]>(ALL_ROLES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  
  // Selected user for editing permissions
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [editRole, setEditRole] = useState<string>('USER');
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [editLimits, setEditLimits] = useState({
    maxUsers: 100,
    maxExposurePerUser: 1000000,
    maxDepositApproval: 50000,
    maxWithdrawalApproval: 25000,
    maxDailyLossCap: 100000
  });
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch users and permission matrix
  const fetchData = async () => {
    setLoading(true);
    try {
      const [matrixRes, usersRes] = await Promise.all([
        fetch('/api/v1/admin/permissions/matrix', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v1/admin/permissions/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const matrixData = await matrixRes.json();
      const usersData = await usersRes.json();

      if (matrixData.success) {
        setCategories(matrixData.categories || []);
        if (matrixData.roles) setRoles(matrixData.roles);
      }

      if (usersData.success) {
        setUsers(usersData.users || []);
      }
    } catch (err: any) {
      console.error('Failed to load permissions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Open modal / panel for user
  const handleSelectUser = (user: UserAccount) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditPerms({ ...(user.customPermissions || {}) });
    setEditLimits({
      maxUsers: user.max_users || 100,
      maxExposurePerUser: user.max_exposure_per_user || 1000000,
      maxDepositApproval: user.max_deposit_approval || 50000,
      maxWithdrawalApproval: user.max_withdrawal_approval || 25000,
      maxDailyLossCap: user.max_daily_loss_cap || 100000
    });
    setAlertMsg(null);
  };

  // Helper to determine if a permission is effectively granted for a user
  const isPermissionEffective = (user: UserAccount, perm: PermissionItem) => {
    if (user.customPermissions && user.customPermissions[perm.key] !== undefined) {
      return user.customPermissions[perm.key];
    }
    return perm.defaultRoles.includes(user.role);
  };

  const isPermissionEffectiveForEdit = (perm: PermissionItem) => {
    if (editPerms[perm.key] !== undefined) {
      return editPerms[perm.key];
    }
    return perm.defaultRoles.includes(editRole);
  };

  const handleTogglePerm = (key: string) => {
    const currentEffective = editPerms[key] !== undefined 
      ? editPerms[key] 
      : categories.flatMap(c => c.permissions).find(p => p.key === key)?.defaultRoles.includes(editRole) || false;
    
    setEditPerms(prev => ({
      ...prev,
      [key]: !currentEffective
    }));
  };

  const handleResetToRoleDefaults = () => {
    setEditPerms({});
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setAlertMsg(null);

    try {
      const res = await fetch('/api/v1/admin/permissions/save-user-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: editRole,
          permissions: editPerms,
          limits: editLimits
        })
      });

      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message || 'Permissions updated successfully!' });
        await fetchData();
        setTimeout(() => {
          setSelectedUser(null);
        }, 1200);
      } else {
        setAlertMsg({ type: 'error', text: data.error?.message || 'Failed to update permissions' });
      }
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase())) ||
        u.id.toLowerCase().includes(search.toLowerCase());
      
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const staffCount = useMemo(() => {
    return users.filter(u => u.role !== 'USER').length;
  }, [users]);

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1 text-slate-100 select-none">
      
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0c1322] to-slate-900 border border-slate-800 shadow-2xl backdrop-blur-xl gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-400 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-extrabold text-white tracking-wide">
                ROLES & PERMISSIONS CONTROL CENTER
              </h1>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-wider">
                RBAC Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Granular access policies, custom staff overrides & multi-tier supervisory limits
            </p>
          </div>
        </div>

        {/* Tab Controls & Refresh */}
        <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-between md:justify-end">
          <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'USERS'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Staff & User Access ({filteredUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('MATRIX')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'MATRIX'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Permission Matrix
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Top Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Accounts</div>
            <div className="text-lg font-black text-white mt-0.5">{users.length}</div>
          </div>
          <Users className="w-5 h-5 text-slate-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Staff / Officers</div>
            <div className="text-lg font-black text-blue-400 mt-0.5">{staffCount}</div>
          </div>
          <UserCheck className="w-5 h-5 text-blue-400/70" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Standard Clients</div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">{users.length - staffCount}</div>
          </div>
          <Users className="w-5 h-5 text-emerald-400/70" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Granular Policies</div>
            <div className="text-lg font-black text-purple-400 mt-0.5">
              {categories.reduce((acc, cat) => acc + cat.permissions.length, 0)} Rules
            </div>
          </div>
          <Key className="w-5 h-5 text-purple-400/70" />
        </div>
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === 'USERS' ? (
        <div className="flex flex-col gap-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="flex-1 min-w-[260px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by username, email, full name, or Client ID..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Roles</option>
                {roles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User List Table */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">User / Staff</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Custom Overrides</th>
                    <th className="py-3 px-4">Manager Limits</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
                        Loading accounts & permissions...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No accounts match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.USER;
                      const customPermCount = Object.keys(user.customPermissions || {}).length;

                      return (
                        <tr key={user.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {user.full_name || user.username}
                              {user.role !== 'USER' && (
                                <Shield className="w-3 h-3 text-blue-400 shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">{user.email}</div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                              {user.role}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              user.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              {user.status}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {customPermCount > 0 ? (
                              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                                <Sparkles className="w-3 h-3" />
                                {customPermCount} Custom Override{customPermCount > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-medium">
                                Inherits Role Defaults
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {['MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 'ADMIN'].includes(user.role) ? (
                              <div className="text-[10px] font-mono text-slate-300">
                                <div>Max Users: <span className="font-bold text-white">{user.max_users}</span></div>
                                <div className="text-slate-400">Dep: ₹{Number(user.max_deposit_approval).toLocaleString()} | Wdr: ₹{Number(user.max_withdrawal_approval).toLocaleString()}</div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleSelectUser(user)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                              Configure Permissions
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* 4. PERMISSION MATRIX TAB */
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Sliders className="w-4 h-4 text-blue-400" />
              Role-Based Access Control (RBAC) System Matrix
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Baseline system permissions granted by default to each administrative and customer role. Custom overrides can be set per user in the Staff & User Access tab.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-3 min-w-[220px]">Capability / Permission Key</th>
                    {roles.map(r => (
                      <th key={r} className="py-3 px-2 text-center whitespace-nowrap">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${ROLE_COLORS[r]?.bg || 'bg-slate-800'} ${ROLE_COLORS[r]?.text || 'text-slate-300'} ${ROLE_COLORS[r]?.border || 'border-slate-700'}`}>
                          {r.replace('_', ' ')}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {categories.map((cat, catIdx) => (
                    <React.Fragment key={cat.category}>
                      <tr className="bg-slate-950/40">
                        <td colSpan={roles.length + 1} className="py-2.5 px-3 text-[11px] font-black text-blue-400 uppercase tracking-wider border-t border-slate-800">
                          {catIdx + 1}. {cat.category}
                          <span className="text-[10px] font-normal text-slate-500 ml-2 normal-case">
                            ({cat.description})
                          </span>
                        </td>
                      </tr>
                      {cat.permissions.map(perm => (
                        <tr key={perm.key} className="hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white text-xs">{perm.label}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{perm.key}</div>
                          </td>
                          {roles.map(role => {
                            const isAllowed = perm.defaultRoles.includes(role);
                            return (
                              <td key={role} className="py-2.5 px-2 text-center">
                                {isAllowed ? (
                                  <span className="inline-flex p-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <Check className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded bg-slate-900 text-slate-700">
                                    <X className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: USER PERMISSIONS & ROLE CONFIGURATION MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                    Configure Access & Permissions
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {selectedUser.username}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">{selectedUser.email} — {selectedUser.full_name || 'No full name'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              
              {/* Alert Message */}
              {alertMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  alertMsg.type === 'success'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {alertMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  {alertMsg.text}
                </div>
              )}

              {/* Role Selection */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Assigned Platform Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-xs focus:outline-none focus:border-blue-500"
                  >
                    {roles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-400 flex items-center">
                    Selecting a new role resets baseline capabilities. You can still customize granular permissions below.
                  </div>
                </div>
              </div>

              {/* Manager Capacity Limits (shown for staff/manager roles) */}
              {['MANAGER', 'FINANCE_MANAGER', 'RISK_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(editRole) && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      Manager Capacity & Approval Thresholds
                    </h4>
                    <span className="text-[10px] text-slate-500 uppercase font-mono">Real-Money Sim Safe Limits</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Max Clients Assigned</label>
                      <input
                        type="number"
                        min="1"
                        value={editLimits.maxUsers}
                        onChange={e => setEditLimits({ ...editLimits, maxUsers: parseInt(e.target.value) || 100 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Max Deposit Approval (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={editLimits.maxDepositApproval}
                        onChange={e => setEditLimits({ ...editLimits, maxDepositApproval: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Max Withdrawal Cap (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={editLimits.maxWithdrawalApproval}
                        onChange={e => setEditLimits({ ...editLimits, maxWithdrawalApproval: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Granular Permission Toggles by Category */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    Granular Permission Controls
                  </h4>
                  <button
                    type="button"
                    onClick={handleResetToRoleDefaults}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer transition underline"
                  >
                    Reset to Role Defaults
                  </button>
                </div>

                {categories.map((cat) => (
                  <div key={cat.category} className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5">
                    <div className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {cat.category}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {cat.permissions.map((perm) => {
                        const isGranted = isPermissionEffectiveForEdit(perm);
                        const isOverridden = editPerms[perm.key] !== undefined;

                        return (
                          <div
                            key={perm.key}
                            onClick={() => handleTogglePerm(perm.key)}
                            className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition ${
                              isGranted
                                ? 'bg-blue-600/10 border-blue-500/30 hover:border-blue-500/60'
                                : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 opacity-60'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold text-xs ${isGranted ? 'text-white' : 'text-slate-400'}`}>
                                  {perm.label}
                                </span>
                                {isOverridden && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 rounded font-mono font-bold">
                                    Override
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                {perm.description}
                              </p>
                            </div>

                            {/* Toggle Switch */}
                            <div className={`w-8 h-4 rounded-full transition-colors relative mt-0.5 shrink-0 ${
                              isGranted ? 'bg-blue-600' : 'bg-slate-700'
                            }`}>
                              <div className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${
                                isGranted ? 'left-4.5' : 'left-0.5'
                              }`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/80">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Role & Permissions
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
