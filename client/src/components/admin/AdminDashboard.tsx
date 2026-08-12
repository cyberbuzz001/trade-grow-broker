import React, { useState, useEffect } from 'react';
import {
  Users, TrendingUp, DollarSign, ShieldAlert, Activity, BarChart3,
  ArrowUpRight, ArrowDownRight, Zap, Database, Wifi, Server, RefreshCw,
  AlertCircle, CheckCircle2, Clock
} from 'lucide-react';

interface AdminDashboardProps { token: string; }

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token }) => {
  const [kpis, setKpis] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchKpis = () => {
    setIsRefreshing(true);
    fetch('/api/v1/admin/dashboard/executive', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) setKpis(d.kpis);
        setLastRefreshed(new Date());
      })
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (!kpis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-xs font-semibold tracking-wider uppercase">Loading Executive Command Dashboard...</span>
      </div>
    );
  }

  const StatusBadge = ({ status, label }: { status: string; label: string }) => {
    const isHealthy = ['OPERATIONAL', 'CONNECTED', 'LIVE', 'HEALTHY', 'ACTIVE'].includes(status?.toUpperCase());
    const isDegraded = ['DEGRADED', 'IDLE', 'WAITING', 'PENDING'].includes(status?.toUpperCase());

    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-200 group">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${
            isHealthy ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
            isDegraded ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' :
            'bg-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]'
          } ${isHealthy ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{label}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
          isHealthy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          isDegraded ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}>
          {status}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 border border-slate-800/90 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              EXECUTIVE COMMAND CENTER
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                System Live
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">Multi-User Brokerage Operations & Risk Oversight Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 sm:mt-0">
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <Clock className="w-3 h-3 text-slate-500" />
            {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={fetchKpis}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all duration-200"
            title="Refresh KPIs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* SECTION 1: CUSTOMER NETWORK */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" /> Customer Network Overview
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Total Clients: {kpis.customers.total.toLocaleString()}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Clients', value: kpis.customers.total, color: 'text-white', badge: 'All Accounts' },
            { label: 'Active Clients', value: kpis.customers.active, color: 'text-emerald-400', badge: 'Trading Ready' },
            { label: 'New (30 Days)', value: kpis.customers.new, color: 'text-blue-400', badge: 'Onboarded' },
            { label: 'KYC Pending', value: kpis.customers.kycPending, color: 'text-amber-400', badge: 'Action Required' },
            { label: 'KYC Rejected', value: kpis.customers.kycRejected, color: 'text-rose-400', badge: 'Failed Verification' },
            { label: 'Suspended', value: kpis.customers.suspended, color: 'text-rose-500', badge: 'Restricted' },
          ].map(k => (
            <div key={k.label} className="group bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-3.5 transition-all duration-300 shadow-lg hover:-translate-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{k.label}</span>
              <span className={`text-2xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>
                {k.value.toLocaleString()}
              </span>
              <span className="text-[9px] font-semibold text-slate-500 mt-1 block truncate">{k.badge}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: TRADING ACTIVITY & VOLUME */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" /> Trading Activity & Volume Today
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Orders Today', value: kpis.trading.ordersToday.toLocaleString(), color: 'text-white' },
            { label: 'Executed Trades', value: kpis.trading.tradesToday.toLocaleString(), color: 'text-emerald-400' },
            { label: 'Total Turnover', value: `₹${(kpis.trading.turnover / 100000).toFixed(2)}L`, color: 'text-indigo-400' },
            { label: 'Buy Turnover', value: `₹${(kpis.trading.buyValue / 100000).toFixed(2)}L`, color: 'text-emerald-400' },
            { label: 'Sell Turnover', value: `₹${(kpis.trading.sellValue / 100000).toFixed(2)}L`, color: 'text-rose-400' },
            { label: 'Active Traders', value: kpis.trading.activeTraders.toLocaleString(), color: 'text-blue-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800/80 hover:border-blue-500/40 rounded-xl p-3.5 transition-all duration-300 shadow-lg hover:-translate-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{k.label}</span>
              <span className={`text-2xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>
                {k.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3 & 4: FINANCIAL & RISK GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Financial Overview */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Capital & Financial Position
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Virtual Funds', value: `₹${kpis.financial.totalFunds.toLocaleString('en-IN')}`, color: 'text-emerald-400', desc: 'Pool Capital' },
              { label: 'Margin Utilized', value: `₹${kpis.financial.marginUtilized.toLocaleString('en-IN')}`, color: 'text-amber-400', desc: 'Blocked Margin' },
              { label: 'Brokerage Revenue', value: `₹${kpis.financial.brokerage.toLocaleString('en-IN')}`, color: 'text-indigo-400', desc: 'Zero Fee Active' },
              { label: 'Pending Withdrawals', value: kpis.financial.pendingWithdrawals, color: 'text-rose-400', desc: 'Fund Requests' },
            ].map(k => (
              <div key={k.label} className="bg-slate-900/70 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl p-4 transition-all duration-300 shadow-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{k.label}</span>
                <span className={`text-xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>{k.value}</span>
                <span className="text-[9px] font-medium text-slate-500 block mt-1">{k.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Overview */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" /> Risk & Compliance Oversight
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'High-Risk Clients', value: kpis.risk.highRiskClients, color: 'text-rose-400', desc: 'Over-leveraged' },
              { label: 'Margin Call Alerts', value: kpis.risk.marginAlerts, color: 'text-amber-400', desc: 'Shortfall Warnings' },
              { label: 'RMS Order Blocks', value: kpis.risk.rmsBlocks, color: 'text-rose-500', desc: 'Pre-Trade Rejections' },
              { label: 'Frozen Accounts', value: kpis.risk.frozenAccounts, color: 'text-rose-400', desc: 'Suspended Access' },
            ].map(k => (
              <div key={k.label} className="bg-slate-900/70 border border-slate-800/80 hover:border-rose-500/40 rounded-xl p-4 transition-all duration-300 shadow-lg">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{k.label}</span>
                <span className={`text-xl font-extrabold ${k.color} font-mono tracking-tight block mt-1`}>{k.value}</span>
                <span className="text-[9px] font-medium text-slate-500 block mt-1">{k.desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION 5: INFRASTRUCTURE & BROKER HEALTH */}
      <div className="flex flex-col gap-3 pb-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" /> Infrastructure & Market Feed Health
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatusBadge label="API Core" status={kpis.technology.apiStatus} />
          <StatusBadge label="WebSocket Gateway" status={kpis.technology.wsStatus} />
          <StatusBadge label="DhanHQ Broker" status={kpis.technology.brokerStatus} />
          <StatusBadge label="Market Data" status={kpis.technology.marketDataStatus} />
          <StatusBadge label="Order Engine (OMS)" status={kpis.technology.omsStatus} />
          <StatusBadge label="Risk Engine (RMS)" status={kpis.technology.rmsStatus} />
          <StatusBadge label="PostgreSQL DB" status={kpis.technology.databaseHealth} />
        </div>
      </div>

    </div>
  );
};

