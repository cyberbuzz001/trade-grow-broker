import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, PlusCircle, Edit2, XCircle, Play, KeyRound, Copy, Check, RefreshCw, X, CheckCircle2, AlertTriangle, Wifi, WifiOff, Shield, CheckCircle, User, Phone, Mail, MapPin, Activity, Clock, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import { useAdminUserSocket } from '../../hooks/useAdminUserSocket';

interface Customer360Props {
  token: string;
  customerId: string;
  onBack: () => void;
}

export const Customer360: React.FC<Customer360Props> = ({ token, customerId, onBack }) => {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('POSITIONS');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Funds Modal State
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [fundAmount, setFundAmount] = useState<number>(100000);
  const [fundAction, setFundAction] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [fundReason, setFundReason] = useState<string>('Admin Manual Capital Adjustment');
  const [submittingFunds, setSubmittingFunds] = useState(false);

  // Reset Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = 'TG@';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    setCopied(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setSubmittingPassword(true);
    setPasswordMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const d = await res.json();
      if (d.success) {
        setPasswordMsg({ type: 'success', text: d.message || 'Password successfully reset!' });
      } else {
        setPasswordMsg({ type: 'error', text: d.error?.message || d.message || 'Failed to reset password' });
      }
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Network error while resetting password' });
    } finally {
      setSubmittingPassword(false);
    }
  };

  // KYC Action State
  const [kycActionLoading, setKycActionLoading] = useState<string | null>(null);
  const [kycActionMsg, setKycActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Login Activity State
  const [loginActivity, setLoginActivity] = useState<any>(null);

  // Profile Edit State
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Real-time WebSocket connection status
  const [wsConnected, setWsConnected] = useState(false);

  // Real-time market tick cache (symbol -> lastPrice)
  const [liveTicks, setLiveTicks] = useState<Record<string, number>>({});

  const adminApi = useCallback(async (endpoint: string, method: string, body?: object) => {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
  }, [token]);

  // ── Real-time WebSocket Subscription ───────────────────────────────
  // Replaces the old setInterval(fetchCustomerData, 5000) polling
  const adminSocket = useAdminUserSocket(customerId, token, {
    onConnected: () => setWsConnected(true),
    onDisconnected: () => setWsConnected(false),
    onTickSnapshot: (ticks) => {
      if (Array.isArray(ticks)) {
        setLiveTicks(prev => {
          const next = { ...prev };
          for (const t of ticks) {
            const price = t.ltp ?? t.lastPrice ?? t.price;
            if (t.symbol && price) next[t.symbol] = price;
            if (t.instrumentToken && price) next[t.instrumentToken] = price;
          }
          return next;
        });
      }
    },
    onMarketTick: (tick) => {
      const price = tick?.ltp ?? tick?.lastPrice ?? tick?.price;
      if (tick && price) {
        setLiveTicks(prev => {
          const next = { ...prev };
          if (tick.symbol) next[tick.symbol] = price;
          if (tick.instrumentToken) next[tick.instrumentToken] = price;
          return next;
        });
      }
    },
    onPositionUpdate: (positions) => {
      setData((prev: any) => prev ? { ...prev, positions } : prev);
    },
    onTradeExecuted: (trade) => {
      if (!trade) return;
      setData((prev: any) => {
        if (!prev) return prev;
        return { ...prev, trades: [trade, ...(prev.trades || [])] };
      });
    },
    onFundsUpdate: (wallet) => {
      if (!wallet) return;
      setData((prev: any) => prev ? { ...prev, wallet } : prev);
    },
    onStatusChange: (status) => {
      setData((prev: any) => prev ? { ...prev, profile: { ...prev.profile, status } } : prev);
    },
    onKycUpdate: (kycStatus) => {
      setData((prev: any) => {
        if (!prev) return prev;
        const kycRecords = prev.kycRecords?.map((k: any) => ({ ...k, kyc_status: kycStatus })) || [];
        return { ...prev, kycRecords, profile: { ...prev.profile, kyc_status: kycStatus } };
      });
    },
    onProfileUpdate: () => {
      // Re-fetch on profile update
      fetchCustomerData();
    }
  });

  const fetchCustomerData = useCallback(() => {
    fetch(`/api/v1/admin/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.customer);
      })
      .catch(() => {});
  }, [token, customerId]);

  // Subscribe to market ticks for all symbols in customer's open positions & holdings
  useEffect(() => {
    if (!data) return;
    const tokens = new Set<string>();
    (data.positions || []).forEach((p: any) => {
      if (p.symbol) tokens.add(p.symbol);
      if (p.instrument_token) tokens.add(p.instrument_token);
    });
    (data.holdings || []).forEach((h: any) => {
      if (h.symbol) tokens.add(h.symbol);
      if (h.instrument_token) tokens.add(h.instrument_token);
    });
    if (tokens.size > 0 && adminSocket.isConnected) {
      adminSocket.subscribeTokens(Array.from(tokens));
    }
  }, [data, adminSocket]);

  const fetchLoginActivity = useCallback(() => {
    fetch(`/api/v1/admin/customers/${customerId}/login-activity`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.success) setLoginActivity(d); })
      .catch(() => {});
  }, [token, customerId]);

  useEffect(() => {
    fetchCustomerData();
    // No more polling interval — replaced by WebSocket above
  }, [fetchCustomerData]);

  useEffect(() => {
    if (activeTab === 'SECURITY') fetchLoginActivity();
  }, [activeTab, fetchLoginActivity]);

  if (!data) return <div className="text-[var(--text-muted)] text-sm p-8 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Loading customer profile...</div>;

  const tabs = ['OVERVIEW', 'POSITIONS', 'ORDERS', 'TRADES', 'HOLDINGS', 'FUNDS', 'KYC', 'LEDGER', 'AUDIT', 'PROFILE', 'SECURITY'];

  // Admin Position Actions
  const handleSquareOffPosition = async (pos: any) => {
    if (!window.confirm(`Are you sure you want to force square off position ${pos.symbol}?`)) return;
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/positions/${pos.id}/square-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: pos.ltp || pos.average_price })
      });
      const d = await res.json();
      if (d.success) {
        setActionMsg({ type: 'success', text: d.message });
        fetchCustomerData();
      } else {
        setActionMsg({ type: 'error', text: d.error?.message || 'Failed to square off position' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleEditPosition = async (pos: any) => {
    const newQtyStr = window.prompt(`Enter new Net Quantity for ${pos.symbol} (current: ${pos.net_qty}):`, String(pos.net_qty));
    if (newQtyStr === null) return;
    const newQty = parseInt(newQtyStr, 10);
    if (isNaN(newQty)) return;

    const newAvgStr = window.prompt(`Enter new Average Entry Price (₹) for ${pos.symbol}:`, String(pos.average_price));
    if (newAvgStr === null) return;
    const newAvg = parseFloat(newAvgStr);
    if (isNaN(newAvg) || newAvg < 0) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/positions/${pos.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ netQty: newQty, averagePrice: newAvg })
      });
      const d = await res.json();
      if (d.success) {
        setActionMsg({ type: 'success', text: d.message });
        fetchCustomerData();
      } else {
        setActionMsg({ type: 'error', text: d.error?.message || 'Failed to edit position' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  // Admin Order Actions
  const handleEditOrderPrice = async (orderId: string, currentPrice: number) => {
    const newPriceStr = window.prompt(`Enter new limit price for Order ${orderId}:`, String(currentPrice));
    if (!newPriceStr) return;
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice <= 0) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: newPrice })
      });
      const d = await res.json();
      if (d.success) {
        setActionMsg({ type: 'success', text: d.message });
        fetchCustomerData();
      } else {
        setActionMsg({ type: 'error', text: d.error?.message || 'Failed to update order price' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleForceExecuteOrder = async (orderId: string, currentPrice: number) => {
    const fillPriceStr = window.prompt(`Execute Order ${orderId} immediately at price (₹):`, String(currentPrice));
    if (!fillPriceStr) return;
    const fillPrice = parseFloat(fillPriceStr);
    if (isNaN(fillPrice) || fillPrice <= 0) return;

    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: fillPrice })
      });
      const d = await res.json();
      if (d.success) {
        setActionMsg({ type: 'success', text: d.message });
        fetchCustomerData();
      } else {
        setActionMsg({ type: 'error', text: d.error?.message || 'Failed to force execute order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm(`Are you sure you want to cancel order ${orderId}?`)) return;
    setActionMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Cancelled by Admin in Customer 360' })
      });
      const d = await res.json();
      if (d.success) {
        setActionMsg({ type: 'success', text: d.message });
        fetchCustomerData();
      } else {
        setActionMsg({ type: 'error', text: d.error?.message || 'Failed to cancel order' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  // Admin Funds Action
  const handleUpdateFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundAmount || fundAmount <= 0) return;
    setSubmittingFunds(true);
    setActionMsg(null);

    try {
      const res = await fetch(`/api/v1/admin/customers/${customerId}/funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: fundAmount, action: fundAction, reason: fundReason })
      });
      const d = await res.json();
      if (d.success) {
        setActionMsg({ type: 'success', text: d.message });
        setShowFundsModal(false);
        fetchCustomerData();
      } else {
        setActionMsg({ type: 'error', text: d.error?.message || 'Failed to update capital' });
      }
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setSubmittingFunds(false);
    }
  };

  const walletCash = parseFloat(data.wallet?.cash_balance || 0);
  const walletUsed = parseFloat(data.wallet?.used_margin || 0);
  const walletAvail = Math.max(0, walletCash - walletUsed);

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-[var(--border-color)] pb-3">
        <button onClick={onBack} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded hover:bg-[var(--bg-surface-elevated)]">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>{data.profile.username}</span>
            <span className="text-xs font-mono font-normal text-[var(--text-muted)]">({data.profile.email})</span>
          </h2>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">User ID: {data.profile.id}</span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <button
            onClick={() => { setShowPasswordModal(true); setNewPassword(''); setPasswordMsg(null); setCopied(false); }}
            className="bg-[var(--warning)]/15 hover:bg-[var(--warning)]/25 text-[var(--warning)] border border-[var(--warning)]/40 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Reset Password</span>
          </button>

          <button
            onClick={() => setShowFundsModal(true)}
            className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-main)] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Add / Deduct Funds</span>
          </button>

          {/* WS connection indicator */}
          <span title={wsConnected ? 'Real-time connected' : 'Polling mode'} className="flex items-center gap-1">
            {wsConnected
              ? <><Wifi className="w-3.5 h-3.5 text-[var(--primary)]" /><span className="text-[10px] text-[var(--primary)] font-bold">LIVE</span></>
              : <><WifiOff className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /><span className="text-[10px] text-[var(--text-tertiary)]">offline</span></>}
          </span>

          <span className={`px-3 py-1 rounded text-xs font-bold ${
            data.profile.status === 'ACTIVE' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' :
            data.profile.status === 'FROZEN' ? 'bg-[var(--info-light)] text-[var(--info)] border border-[var(--info)]' :
            data.profile.status === 'LOCKED' ? 'bg-violet-950 text-violet-400 border border-violet-800' :
            data.profile.status === 'CLOSED' ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] border border-[var(--border-color)]' :
            'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]'
          }`}>{data.profile.status}</span>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-3 rounded-lg text-xs font-semibold ${actionMsg.type === 'success' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' : 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]'}`}>
          {actionMsg.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-[var(--bg-surface)]/80 p-1 rounded-lg border border-[var(--border-color)] text-xs font-semibold overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3.5 py-1.5 rounded whitespace-nowrap transition font-bold ${
              activeTab === t ? 'bg-[var(--primary)] text-[var(--text-main)] shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {t} {t === 'POSITIONS' && `(${(data.positions || []).length})`}
            {t === 'ORDERS' && `(${(data.orders || []).length})`}
            {t === 'TRADES' && `(${(data.trades || []).length})`}
          </button>
        ))}
      </div>

      {/* Content Panels */}
      <div className="flex-1 overflow-y-auto">
        {/* ── 1. POSITIONS TAB ────────────────────────────────────────────── */}
        {activeTab === 'POSITIONS' && (
          <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left text-[var(--text-muted)]">
              <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px] sticky top-0 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Instrument</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-right">Net Qty</th>
                  <th className="py-2.5 px-3 text-right">Avg Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Live LTP (₹)</th>
                  <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                  <th className="py-2.5 px-3 text-right">Realized P&L</th>
                  <th className="py-2.5 px-3 text-center">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(data.positions || []).length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-[var(--text-tertiary)] text-xs">No active or closed positions found for this client.</td></tr>
                ) : (
                  (data.positions || []).map((p: any) => {
                    const netQty = parseInt(p.net_qty || '0', 10);
                    const avgPx = parseFloat(p.average_price || '0');
                    const hasLiveTick = liveTicks[p.symbol] !== undefined || (p.instrument_token && liveTicks[p.instrument_token] !== undefined);
                    const fallbackLtp = parseFloat(p.ltp || '0') || avgPx;
                    const ltp = liveTicks[p.symbol] ?? (p.instrument_token ? liveTicks[p.instrument_token] : undefined) ?? fallbackLtp;
                    const unrealized = netQty !== 0 ? (ltp - avgPx) * netQty : parseFloat(p.unrealized_pnl || '0');
                    const realized = parseFloat(p.realized_pnl || '0');
                    const isOpen = netQty !== 0;

                    return (
                      <tr key={p.id} className="hover:bg-[var(--bg-surface-elevated)]/40">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                            <span>{p.symbol}</span>
                            {hasLiveTick && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" title="Live stream tick" />}
                          </div>
                          <div className="text-[10px] text-[var(--text-tertiary)] font-mono">{p.exchange || 'NSE'}</div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-muted)]">{p.product_type || 'MIS'}</td>
                        <td className={`py-2.5 px-3 text-right font-bold font-mono ${netQty > 0 ? 'text-[var(--primary)]' : netQty < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-tertiary)]'}`}>
                          {netQty > 0 ? `+${netQty}` : netQty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{avgPx.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text-main)]">₹{ltp.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${unrealized > 0 ? 'text-[var(--primary)]' : unrealized < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-muted)]'}`}>
                          {unrealized >= 0 ? `+₹${unrealized.toFixed(2)}` : `-₹${Math.abs(unrealized).toFixed(2)}`}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${realized > 0 ? 'text-[var(--primary)]' : realized < 0 ? 'text-[var(--loss)]' : 'text-[var(--text-muted)]'}`}>
                          {realized >= 0 ? `+₹${realized.toFixed(2)}` : `-₹${Math.abs(realized).toFixed(2)}`}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isOpen ? (
                              <button
                                onClick={() => handleSquareOffPosition(p)}
                                className="bg-[var(--loss)] hover:bg-[var(--loss)] text-[var(--text-main)] font-bold text-[10px] px-2.5 py-1 rounded transition"
                              >
                                Square Off
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)]">CLOSED</span>
                            )}
                            <button
                              onClick={() => handleEditPosition(p)}
                              className="bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)] hover:text-[var(--text-main)] border border-[var(--warning)]/30 font-bold text-[10px] px-2 py-1 rounded transition flex items-center gap-1"
                              title="Edit Net Qty or Entry Price"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 2. ORDERS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'ORDERS' && (
          <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left text-[var(--text-muted)]">
              <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px] sticky top-0 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Limit Price</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(data.orders || []).length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-[var(--text-tertiary)] text-xs">No orders recorded for this client.</td></tr>
                ) : (
                  (data.orders || []).map((o: any) => {
                    const isPending = ['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(o.status);

                    return (
                      <tr key={o.id || o.order_id} className="hover:bg-[var(--bg-surface-elevated)]/40">
                        <td className="py-2.5 px-3 font-mono text-[10px] text-[var(--warning)]">{o.order_id}</td>
                        <td className="py-2.5 px-3 font-bold text-[var(--text-main)]">{o.symbol}</td>
                        <td className={`py-2.5 px-3 font-bold ${o.side === 'BUY' ? 'text-[var(--primary)]' : 'text-[var(--loss)]'}`}>{o.side}</td>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-muted)]">{o.order_type}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">{o.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">₹{parseFloat(o.price || '0').toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.status === 'FILLED' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' :
                            o.status === 'CANCELLED' ? 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]' :
                            'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]'
                          }`}>{o.status}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isPending ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditOrderPrice(o.order_id || o.id, parseFloat(o.price || '0'))}
                                className="p-1 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--warning)] rounded"
                                title="Edit Price"
                              ><Edit2 className="w-3.5 h-3.5" /></button>
                              <button
                                onClick={() => handleForceExecuteOrder(o.order_id || o.id, parseFloat(o.price || '0'))}
                                className="p-1 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--primary)] rounded"
                                title="Force Execute"
                              ><Play className="w-3.5 h-3.5" /></button>
                              <button
                                onClick={() => handleCancelOrder(o.order_id || o.id)}
                                className="p-1 bg-[var(--loss)]/20 hover:bg-[var(--loss)] text-[var(--loss)] hover:text-[var(--text-main)] border border-[var(--loss)]/30 rounded transition"
                                title="Cancel Order"
                              ><XCircle className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-mono">Finalized</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 3. TRADES TAB ─────────────────────────────────────────────── */}
        {activeTab === 'TRADES' && (
          <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left text-[var(--text-muted)]">
              <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px] sticky top-0 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Execution ID</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Fill Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Brokerage</th>
                  <th className="py-2.5 px-3 text-right">Executed Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(data.trades || []).length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-[var(--text-tertiary)] text-xs">No trade executions found for this client.</td></tr>
                ) : (
                  (data.trades || []).map((t: any) => (
                    <tr key={t.id} className="hover:bg-[var(--bg-surface-elevated)]/40">
                      <td className="py-2.5 px-3 font-mono text-[10px] text-[var(--text-muted)]">{t.id}</td>
                      <td className="py-2.5 px-3 font-bold text-[var(--text-main)]">{t.symbol}</td>
                      <td className={`py-2.5 px-3 font-bold ${t.side === 'BUY' ? 'text-[var(--primary)]' : 'text-[var(--loss)]'}`}>{t.side}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">{t.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--primary)] font-bold">₹{parseFloat(t.price).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--text-muted)]">₹{parseFloat(t.brokerage || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-[10px] text-[var(--text-muted)]">{new Date(t.executed_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 4. HOLDINGS TAB ───────────────────────────────────────────── */}
        {activeTab === 'HOLDINGS' && (
          <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left text-[var(--text-muted)]">
              <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px] sticky top-0 font-bold">
                <tr>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Avg Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Live Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Current Value (₹)</th>
                  <th className="py-2.5 px-3 text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(data.holdings || []).length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-[var(--text-tertiary)] text-xs">No delivery holdings found for this client.</td></tr>
                ) : (
                  (data.holdings || []).map((h: any) => {
                    const qty = parseInt(h.quantity || '0', 10);
                    const avg = parseFloat(h.average_price || '0');
                    const hasLiveTick = liveTicks[h.symbol] !== undefined || (h.instrument_token && liveTicks[h.instrument_token] !== undefined);
                    const fallbackLtp = parseFloat(h.ltp || '0') || avg;
                    const ltp = liveTicks[h.symbol] ?? (h.instrument_token ? liveTicks[h.instrument_token] : undefined) ?? fallbackLtp;
                    const val = qty * ltp;
                    const pnl = qty * (ltp - avg);

                    return (
                      <tr key={h.id} className="hover:bg-[var(--bg-surface-elevated)]/40">
                        <td className="py-2.5 px-3 font-bold text-[var(--text-main)] flex items-center gap-1.5">
                          <span>{h.symbol}</span>
                          {hasLiveTick && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" title="Live stream tick" />}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">{qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono">₹{avg.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--text-main)]">₹{ltp.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[var(--primary)] font-bold">₹{val.toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${pnl >= 0 ? 'text-[var(--primary)]' : 'text-[var(--loss)]'}`}>
                          {pnl >= 0 ? `+₹${pnl.toFixed(2)}` : `-₹${Math.abs(pnl).toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 5. FUNDS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'FUNDS' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold">Cash Balance</span>
                <div className="text-xl font-bold font-mono text-[var(--primary)] mt-1">₹{walletCash.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold">Used Margin</span>
                <div className="text-xl font-bold font-mono text-[var(--warning)] mt-1">₹{walletUsed.toLocaleString('en-IN')}</div>
              </div>
              <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold">Available Buying Power</span>
                <div className="text-xl font-bold font-mono text-[var(--text-main)] mt-1">₹{walletAvail.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase">Client Wallet Transactions (Ledger)</h4>
                <button
                  onClick={() => setShowFundsModal(true)}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--text-main)] font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Adjust Capital</span>
                </button>
              </div>

              <table className="w-full text-xs text-left text-[var(--text-muted)]">
                <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Txn ID</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-right">Before</th>
                    <th className="py-2 px-3 text-right">After</th>
                    <th className="py-2 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {(data.ledger || []).map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-2 px-3 font-mono text-[10px] text-[var(--text-tertiary)]">{l.transaction_id?.slice(0,8)}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.transaction_type === 'CREDIT' ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>
                          {l.transaction_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-main)]">₹{parseFloat(l.amount).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">₹{parseFloat(l.balance_before).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-right font-mono text-[var(--primary)] font-bold">₹{parseFloat(l.balance_after).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-right text-[10px] text-[var(--text-tertiary)]">{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 6. OVERVIEW TAB ───────────────────────────────────────────── */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg p-4">
              <h4 className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold mb-2">Profile</h4>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Role</span><span className="text-[var(--warning)] font-bold">{data.profile.role}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Created</span><span className="text-[var(--text-main)]">{new Date(data.profile.created_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Last Login</span><span className="text-[var(--text-main)]">{data.profile.last_login_at ? new Date(data.profile.last_login_at).toLocaleString() : 'Never'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Failed Logins</span><span className="text-[var(--text-main)]">{data.profile.failed_login_attempts || 0}</span></div>
              </div>
            </div>
            <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg p-4">
              <h4 className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold mb-2">Wallet Summary</h4>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Cash Balance</span><span className="text-[var(--primary)] font-bold font-mono">₹{walletCash.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Used Margin</span><span className="text-[var(--warning)] font-mono">₹{walletUsed.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
            <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg p-4">
              <h4 className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold mb-2">Activity Summary</h4>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Positions</span><span className="text-[var(--text-main)] font-bold">{data.positions?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Orders</span><span className="text-[var(--text-main)] font-bold">{data.orders?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Trades</span><span className="text-[var(--text-main)] font-bold">{data.trades?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Holdings</span><span className="text-[var(--text-main)] font-bold">{data.holdings?.length || 0}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ── 7. LEDGER TAB ─────────────────────────────────────────────── */}
        {activeTab === 'LEDGER' && (
          <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left text-[var(--text-muted)]">
              <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px]">
                <tr><th className="py-2 px-3">Txn ID</th><th className="py-2 px-3">Type</th><th className="py-2 px-3 text-right">Amount</th><th className="py-2 px-3 text-right">Before</th><th className="py-2 px-3 text-right">After</th><th className="py-2 px-3 text-right">Time</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(data.ledger || []).map((l: any) => (
                  <tr key={l.id}>
                    <td className="py-2 px-3 font-mono text-[10px] text-[var(--text-tertiary)]">{l.transaction_id?.slice(0,8)}</td>
                    <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.transaction_type === 'CREDIT' ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'}`}>{l.transaction_type}</span></td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-main)]">₹{parseFloat(l.amount).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">₹{parseFloat(l.balance_before).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-mono text-[var(--primary)]">₹{parseFloat(l.balance_after).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-[10px] text-[var(--text-tertiary)]">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 8. AUDIT TAB ──────────────────────────────────────────────── */}
        {activeTab === 'AUDIT' && (
          <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left text-[var(--text-muted)]">
              <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px]">
                <tr><th className="py-2 px-3">Time</th><th className="py-2 px-3">Action</th><th className="py-2 px-3">Resource</th><th className="py-2 px-3 font-mono">IP</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(data.auditLogs || []).map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-2 px-3 text-[10px] text-[var(--text-tertiary)]">{new Date(a.timestamp).toLocaleString()}</td>
                    <td className="py-2 px-3 font-bold text-[var(--text-main)]">{a.action}</td>
                    <td className="py-2 px-3 text-[var(--text-muted)]">{a.resource_type}</td>
                    <td className="py-2 px-3 font-mono text-[10px] text-[var(--text-tertiary)]">{a.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 9. KYC TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'KYC' && (
          <div className="space-y-4">
            {/* KYC Action Buttons */}
            <div className="flex items-center gap-3 p-4 bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl">
              <span className="text-xs font-bold text-[var(--text-muted)] flex-1">KYC Admin Actions</span>

              <button
                onClick={async () => {
                  setKycActionLoading('approve');
                  setKycActionMsg(null);
                  const d = await adminApi(`/api/v1/admin/customers/${customerId}/kyc/approve`, 'POST', { notes: 'Approved by admin' });
                  setKycActionLoading(null);
                  setKycActionMsg(d.success ? { type: 'success', text: d.message } : { type: 'error', text: d.error?.message || 'Failed' });
                }}
                disabled={kycActionLoading !== null}
                className="bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary-hover)] hover:text-[var(--text-main)] border border-[var(--primary)]/30 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                {kycActionLoading === 'approve' ? 'Approving...' : 'Approve KYC'}
              </button>

              <button
                onClick={async () => {
                  const reason = window.prompt('Enter rejection reason:');
                  if (!reason) return;
                  setKycActionLoading('reject');
                  setKycActionMsg(null);
                  const d = await adminApi(`/api/v1/admin/customers/${customerId}/kyc/reject`, 'POST', { reason });
                  setKycActionLoading(null);
                  setKycActionMsg(d.success ? { type: 'success', text: d.message } : { type: 'error', text: d.error?.message || 'Failed' });
                }}
                disabled={kycActionLoading !== null}
                className="bg-[var(--loss)]/20 text-[var(--loss)] hover:bg-[var(--loss)] hover:text-[var(--text-main)] border border-[var(--loss)]/30 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                {kycActionLoading === 'reject' ? 'Rejecting...' : 'Reject KYC'}
              </button>

              <button
                onClick={async () => {
                  setKycActionLoading('reupload');
                  setKycActionMsg(null);
                  const d = await adminApi(`/api/v1/admin/customers/${customerId}/kyc/request-reupload`, 'POST', { reason: 'Documents unclear or incomplete' });
                  setKycActionLoading(null);
                  setKycActionMsg(d.success ? { type: 'success', text: d.message } : { type: 'error', text: d.error?.message || 'Failed' });
                }}
                disabled={kycActionLoading !== null}
                className="bg-[var(--warning)]/20 text-[var(--warning)] hover:bg-[var(--warning)] hover:text-[var(--text-main)] border border-[var(--warning)]/30 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {kycActionLoading === 'reupload' ? 'Requesting...' : 'Request Re-upload'}
              </button>
            </div>

            {kycActionMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                kycActionMsg.type === 'success' ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
              }`}>
                {kycActionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {kycActionMsg.text}
              </div>
            )}

            {/* KYC Records */}
            <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase mb-3">KYC Verification Record</h4>
              {(data.kycRecords || []).length === 0 ? (
                <div className="text-[var(--text-tertiary)] text-xs py-4 text-center">No KYC document records found for this client.</div>
              ) : (
                (data.kycRecords || []).map((k: any) => (
                  <div key={k.id} className="border border-[var(--border-color)] rounded-lg p-3 space-y-2 text-xs mb-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[var(--text-main)]">Verification Status</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        k.kyc_status === 'APPROVED' ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]' :
                        k.kyc_status === 'REJECTED' ? 'bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]' :
                        'bg-[var(--warning-light)] text-[var(--warning)] border border-[var(--warning)]'
                      }`}>{k.kyc_status || 'PENDING'}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">PAN</span><span className="font-mono text-[var(--text-main)]">{k.pan_number || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Aadhaar</span><span className="font-mono text-[var(--text-main)]">{k.aadhaar_number || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--text-muted)]">Bank Account</span><span className="font-mono text-[var(--text-main)]">{k.bank_account_no || 'N/A'} ({k.ifsc_code || 'N/A'})</span></div>
                    {k.notes && <div className="flex justify-between"><span className="text-[var(--text-muted)]">Notes</span><span className="text-[var(--text-muted)]">{k.notes}</span></div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 10. PROFILE TAB (Editable) ───────────────────────────────────── */}
        {activeTab === 'PROFILE' && (
          <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[var(--text-main)] uppercase">Customer Profile Details</h4>
              {!editingProfile && (
                <button
                  onClick={() => {
                    setEditFullName(data.profile.full_name || '');
                    setEditPhone(data.profile.phone_number || '');
                    setEditAddress(data.profile.address || '');
                    setEditCity(data.profile.city || '');
                    setProfileMsg(null);
                    setEditingProfile(true);
                  }}
                  className="bg-[var(--info)]/20 text-[var(--info)] hover:bg-[var(--info)] hover:text-[var(--text-main)] border border-[var(--info)]/30 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" /> Edit Profile
                </button>
              )}
            </div>

            {!editingProfile ? (
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { icon: <User className="w-3.5 h-3.5" />, label: 'Full Name', value: data.profile.full_name || '—' },
                  { icon: <Mail className="w-3.5 h-3.5" />, label: 'Email', value: data.profile.email },
                  { icon: <Phone className="w-3.5 h-3.5" />, label: 'Phone', value: data.profile.phone_number || '—' },
                  { icon: <MapPin className="w-3.5 h-3.5" />, label: 'City', value: data.profile.city || '—' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="bg-[var(--bg-body)] rounded-xl p-3 border border-[var(--border-color)]">
                    <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] mb-1">{icon}<span className="text-[10px] uppercase font-bold">{label}</span></div>
                    <div className="text-[var(--text-main)] font-semibold">{value}</div>
                  </div>
                ))}
                <div className="col-span-2 bg-[var(--bg-body)] rounded-xl p-3 border border-[var(--border-color)]">
                  <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] mb-1"><MapPin className="w-3.5 h-3.5" /><span className="text-[10px] uppercase font-bold">Address</span></div>
                  <div className="text-[var(--text-main)] font-semibold">{data.profile.address || '—'}</div>
                </div>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSavingProfile(true);
                setProfileMsg(null);
                const d = await adminApi(`/api/v1/admin/customers/${customerId}`, 'PATCH', {
                  fullName: editFullName, phoneNumber: editPhone, address: editAddress, city: editCity
                });
                setSavingProfile(false);
                if (d.success) {
                  setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
                  fetchCustomerData();
                  setTimeout(() => setEditingProfile(false), 1500);
                } else {
                  setProfileMsg({ type: 'error', text: d.error?.message || 'Update failed' });
                }
              }} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Full Name</label>
                    <input value={editFullName} onChange={e => setEditFullName(e.target.value)}
                      className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Phone</label>
                    <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                      className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">City</label>
                    <input value={editCity} onChange={e => setEditCity(e.target.value)}
                      className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Address</label>
                    <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                      className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3 py-2 text-[var(--text-main)] text-xs focus:outline-none focus:border-[var(--info)]" />
                  </div>
                </div>
                {profileMsg && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    profileMsg.type === 'success' ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
                  }`}>
                    {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {profileMsg.text}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditingProfile(false)} className="px-4 py-2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" disabled={savingProfile} className="px-5 py-2 bg-[var(--info)] hover:bg-[var(--info)] disabled:opacity-40 text-[var(--text-main)] font-black text-xs rounded-lg transition cursor-pointer">
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── 11. SECURITY TAB ─────────────────────────────────────────────── */}
        {activeTab === 'SECURITY' && (
          <div className="space-y-4">
            {/* Security Overview */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4 text-xs">
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold mb-1">Failed Login Attempts</div>
                <div className={`text-xl font-bold font-mono ${(loginActivity?.security?.failedLoginAttempts || 0) > 3 ? 'text-[var(--loss)]' : 'text-[var(--text-main)]'}`}>
                  {loginActivity?.security?.failedLoginAttempts || 0}
                </div>
              </div>
              <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4 text-xs">
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold mb-1">Last Login</div>
                <div className="text-[var(--text-main)] font-semibold">
                  {loginActivity?.security?.lastLoginAt ? new Date(loginActivity.security.lastLoginAt).toLocaleString() : 'Never'}
                </div>
              </div>
              <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-4 text-xs">
                <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-bold mb-1">Account Lock Status</div>
                <div className={`font-bold ${loginActivity?.security?.lockedUntil ? 'text-[var(--loss)]' : 'text-[var(--primary)]'}`}>
                  {loginActivity?.security?.lockedUntil
                    ? `Locked until ${new Date(loginActivity.security.lockedUntil).toLocaleString()}`
                    : 'Not Locked'}
                </div>
              </div>
            </div>

            {/* Login Sessions */}
            <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl overflow-hidden">
              <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-[var(--info)]" />Login History</h4>
                <button onClick={fetchLoginActivity} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 cursor-pointer">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              <table className="w-full text-xs text-left text-[var(--text-muted)]">
                <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Login Time</th>
                    <th className="py-2 px-3">IP Address</th>
                    <th className="py-2 px-3">Result</th>
                    <th className="py-2 px-3">Device</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {(loginActivity?.sessions || []).length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-[var(--text-tertiary)]">No login activity recorded yet.</td></tr>
                  ) : (
                    (loginActivity?.sessions || []).map((s: any) => (
                      <tr key={s.id} className="hover:bg-[var(--bg-surface-elevated)]/40">
                        <td className="py-2 px-3 text-[10px] font-mono text-[var(--text-muted)]">{new Date(s.login_at).toLocaleString()}</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-[var(--warning)]">{s.ip_address || '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            s.login_result === 'SUCCESS' ? 'bg-[var(--primary-light)] text-[var(--primary)]' : 'bg-[var(--loss-light)] text-[var(--loss)]'
                          }`}>{s.login_result}</span>
                        </td>
                        <td className="py-2 px-3 text-[10px] text-[var(--text-tertiary)]">{s.device_type || '—'}</td>
                        <td className="py-2 px-3">
                          {s.is_active
                            ? <span className="text-[var(--primary)] text-[10px] font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-[var(--primary)] rounded-full inline-block animate-pulse" />Active</span>
                            : <span className="text-[var(--text-tertiary)] text-[10px]">Ended</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── ADMIN FUNDS MODAL ────────────────────────────────────────────── */}
      {showFundsModal && (
        <div className="fixed inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-[var(--text-main)] flex items-center justify-between">
              <span>Admin Capital Adjustment</span>
              <button onClick={() => setShowFundsModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">✕</button>
            </h3>

            <form onSubmit={handleUpdateFunds} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] font-semibold mb-1">Adjustment Action</label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFundAction('ADD')}
                    className={`py-2 rounded-lg font-bold border ${fundAction === 'ADD' ? 'bg-[var(--primary)] text-[var(--text-main)] border-[var(--primary)]' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)]'}`}
                  >
                    + Add Capital
                  </button>
                  <button
                    type="button"
                    onClick={() => setFundAction('DEDUCT')}
                    className={`py-2 rounded-lg font-bold border ${fundAction === 'DEDUCT' ? 'bg-[var(--loss)] text-[var(--text-main)] border-[var(--loss)]' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)]'}`}
                  >
                    - Deduct Capital
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] font-semibold mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={fundAmount}
                  onChange={e => setFundAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2.5 text-[var(--text-main)] font-mono text-sm"
                  min={1}
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] font-semibold mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={fundReason}
                  onChange={e => setFundReason(e.target.value)}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg p-2 text-[var(--text-main)]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFundsModal(false)}
                  className="w-1/2 bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFunds}
                  className={`w-1/2 font-bold py-2 rounded-lg text-[var(--text-main)] ${fundAction === 'ADD' ? 'bg-[var(--primary)] hover:bg-[var(--primary-hover)]' : 'bg-[var(--loss)] hover:bg-[var(--loss)]'}`}
                >
                  {submittingFunds ? 'Processing...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN RESET PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-body)]/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)]">Reset Client Password</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Set a new password for {data.profile.username}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Info Card */}
            <div className="bg-[var(--bg-body)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-1 font-mono text-xs">
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Client ID:</span>
                <span className="text-[var(--primary)] font-bold">TG-{data.profile.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Username:</span>
                <span className="text-[var(--text-main)] font-bold">{data.profile.username}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Email:</span>
                <span className="text-[var(--text-muted)]">{data.profile.email}</span>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">New Password *</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] font-bold text-[var(--warning)] hover:text-[var(--warning)] flex items-center gap-1 cursor-pointer"
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
                    className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-[var(--text-main)] font-mono text-xs focus:outline-none focus:border-[var(--warning)] pr-10"
                  />
                  {newPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newPassword);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                      title="Copy Password"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[var(--primary)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {passwordMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  passwordMsg.type === 'success' ? 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30' : 'bg-[var(--loss)]/15 text-[var(--loss)] border border-[var(--loss)]/30'
                }`}>
                  {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {passwordMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword || !newPassword || newPassword.length < 6}
                  className="px-5 py-2 rounded-xl bg-[var(--warning)] hover:bg-[var(--warning)] disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {submittingPassword ? 'Updating Password...' : 'Confirm Reset Password'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
