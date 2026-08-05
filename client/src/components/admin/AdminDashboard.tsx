import React, { useState, useEffect } from 'react';
import {
  Users, TrendingUp, DollarSign, ShieldAlert, Activity, BarChart3,
  ArrowUpRight, ArrowDownRight, Zap, Database, Wifi, Server
} from 'lucide-react';

interface AdminDashboardProps { token: string; }

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token }) => {
  const [kpis, setKpis] = useState<any>(null);

  useEffect(() => {
    fetch('/api/v1/admin/dashboard/executive', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setKpis(d.kpis));
    const interval = setInterval(() => {
      fetch('/api/v1/admin/dashboard/executive', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => d.success && setKpis(d.kpis));
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (!kpis) return <div className="text-slate-400 text-sm p-8">Loading executive dashboard...</div>;

  const StatusDot = ({ status }: { status: string }) => (
    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
      status === 'OPERATIONAL' || status === 'CONNECTED' || status === 'LIVE' || status === 'HEALTHY'
        ? 'bg-emerald-400' : status === 'DEGRADED' || status === 'IDLE' || status === 'WAITING'
        ? 'bg-amber-400' : 'bg-rose-400'
    }`} />
  );

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-2">
      {/* SECTION 1: Customer KPIs */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Customers</h3>
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Total Clients', value: kpis.customers.total, color: 'text-white' },
            { label: 'Active Clients', value: kpis.customers.active, color: 'text-emerald-400' },
            { label: 'New (30d)', value: kpis.customers.new, color: 'text-blue-400' },
            { label: 'KYC Pending', value: kpis.customers.kycPending, color: 'text-amber-400' },
            { label: 'KYC Rejected', value: kpis.customers.kycRejected, color: 'text-rose-400' },
            { label: 'Suspended', value: kpis.customers.suspended, color: 'text-rose-500' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">{k.label}</span>
              <span className={`text-xl font-bold ${k.color} block mt-0.5`}>{k.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Trading KPIs */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Trading</h3>
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Orders Today', value: kpis.trading.ordersToday, color: 'text-white' },
            { label: 'Trades Today', value: kpis.trading.tradesToday, color: 'text-emerald-400' },
            { label: 'Turnover', value: `₹${(kpis.trading.turnover / 100000).toFixed(1)}L`, color: 'text-indigo-400' },
            { label: 'Buy Value', value: `₹${(kpis.trading.buyValue / 100000).toFixed(1)}L`, color: 'text-emerald-400' },
            { label: 'Sell Value', value: `₹${(kpis.trading.sellValue / 100000).toFixed(1)}L`, color: 'text-rose-400' },
            { label: 'Active Traders', value: kpis.trading.activeTraders, color: 'text-blue-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">{k.label}</span>
              <span className={`text-xl font-bold ${k.color} block mt-0.5`}>{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: Financial KPIs */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Financial</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Funds', value: `₹${kpis.financial.totalFunds.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
            { label: 'Margin Utilized', value: `₹${kpis.financial.marginUtilized.toLocaleString('en-IN')}`, color: 'text-amber-400' },
            { label: 'Brokerage Revenue', value: `₹${kpis.financial.brokerage.toLocaleString('en-IN')}`, color: 'text-indigo-400' },
            { label: 'Pending Withdrawals', value: kpis.financial.pendingWithdrawals, color: 'text-rose-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">{k.label}</span>
              <span className={`text-xl font-bold ${k.color} block mt-0.5`}>{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: Risk KPIs */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Risk</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'High-Risk Clients', value: kpis.risk.highRiskClients, color: 'text-rose-400' },
            { label: 'Margin Alerts', value: kpis.risk.marginAlerts, color: 'text-amber-400' },
            { label: 'RMS Blocks', value: kpis.risk.rmsBlocks, color: 'text-rose-500' },
            { label: 'Frozen Accounts', value: kpis.risk.frozenAccounts, color: 'text-rose-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">{k.label}</span>
              <span className={`text-xl font-bold ${k.color} block mt-0.5`}>{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5: Technology Status */}
      <div>
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Server className="w-3.5 h-3.5" /> Technology</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'API', status: kpis.technology.apiStatus },
            { label: 'WebSocket', status: kpis.technology.wsStatus },
            { label: 'Broker', status: kpis.technology.brokerStatus },
            { label: 'Market Data', status: kpis.technology.marketDataStatus },
            { label: 'OMS', status: kpis.technology.omsStatus },
            { label: 'RMS', status: kpis.technology.rmsStatus },
            { label: 'Database', status: kpis.technology.databaseHealth },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 flex items-center gap-2">
              <StatusDot status={s.status} />
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">{s.label}</span>
                <span className="text-xs font-bold text-white">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
