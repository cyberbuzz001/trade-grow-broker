import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, TrendingUp, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, Flame } from 'lucide-react';

interface RiskCommandCenterProps { token: string; }

export const RiskCommandCenter: React.FC<RiskCommandCenterProps> = ({ token }) => {
  const [risk, setRisk] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRiskData = () => {
    setLoading(true);
    fetch('/api/v1/admin/risk/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => d.success && setRisk(d.risk))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRiskData();
    const interval = setInterval(fetchRiskData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (!risk) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-rose-400" />
        <span className="text-xs font-semibold tracking-wider uppercase">Initializing Risk Command Center...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-slate-900/90 border border-rose-900/40 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
              RISK COMMAND CENTER
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 uppercase tracking-widest">
                Active Monitoring
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">Real-Time Pre-Trade RMS & Margin Utilization Safeguards</p>
          </div>
        </div>
        <button
          onClick={fetchRiskData}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all duration-200"
          title="Refresh Risk Metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-400' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Risk Exposure</span>
          <span className="text-2xl font-extrabold text-amber-400 font-mono tracking-tight block mt-1">₹{risk.totalExposure.toLocaleString('en-IN')}</span>
          <span className="text-[9px] font-semibold text-slate-500 mt-1 block">Active Position Capital</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Margin Utilized Pool</span>
          <span className="text-2xl font-extrabold text-indigo-400 font-mono tracking-tight block mt-1">₹{risk.marginUsed.toLocaleString('en-IN')}</span>
          <span className="text-[9px] font-semibold text-slate-500 mt-1 block">Blocked Pre-Trade Capital</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Frozen / Restricted Accounts</span>
          <span className="text-2xl font-extrabold text-rose-400 tracking-tight block mt-1">{risk.frozenAccounts?.length || 0}</span>
          <span className="text-[9px] font-semibold text-slate-500 mt-1 block">Suspended Access</span>
        </div>
      </div>

      {/* High Risk Clients */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" /> High-Risk Clients (Margin Utilization {'>'} 80%)
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Clients: {(risk.highRiskClients || []).length}</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4 text-right">Cash Balance</th>
                <th className="py-2.5 px-4 text-right">Used Margin</th>
                <th className="py-2.5 px-4 text-right">Utilization Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
              {(risk.highRiskClients || []).map((c: any) => {
                const utilVal = c.cash_balance > 0 ? (c.used_margin / c.cash_balance) * 100 : 0;
                const utilText = c.cash_balance > 0 ? `${utilVal.toFixed(1)}%` : '100%';
                const utilPct = Math.min(100, Math.max(0, utilVal));

                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                      {c.username}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{c.email}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">₹{parseFloat(c.cash_balance).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">₹{parseFloat(c.used_margin).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              utilPct > 90 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                              utilPct > 75 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${utilPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-rose-400 font-mono w-12 text-right">{utilText}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!risk.highRiskClients || risk.highRiskClients.length === 0) && (
            <div className="flex items-center justify-center gap-2 text-center py-6 text-slate-400 text-xs bg-slate-900/40">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>No over-leveraged high-risk accounts detected. All clients operate within safety margin parameters.</span>
            </div>
          )}
        </div>
      </div>

      {/* Margin Alerts */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Active Risk Alerts & Notifications
        </h3>
        <div className="space-y-2.5">
          {(risk.marginAlerts || []).map((a: any) => (
            <div key={a.id} className={`flex items-center gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all ${
              a.severity === 'CRITICAL' ? 'bg-rose-950/40 border-rose-800/80 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
              a.severity === 'HIGH' ? 'bg-amber-950/40 border-amber-800/80' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                a.severity === 'CRITICAL' ? 'bg-rose-400 shadow-[0_0_10px_rgba(248,113,113,0.8)] animate-pulse' :
                a.severity === 'HIGH' ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-slate-400'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{a.event_type}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                    a.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                    a.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {a.severity}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5 truncate">{a.details?.message || JSON.stringify(a.details)}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">{new Date(a.created_at).toLocaleString('en-IN')}</span>
            </div>
          ))}
          {(!risk.marginAlerts || risk.marginAlerts.length === 0) && (
            <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800/60">
              No active risk alerts recorded.
            </div>
          )}
        </div>
      </div>

      {/* RMS Blocks */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl pb-6">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-rose-400" /> Pre-Trade RMS Rejections & Blocks
        </h3>
        <div className="space-y-2.5">
          {(risk.rmsBlocks || []).map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/60">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
              <div className="flex-1">
                <span className="text-xs font-bold text-white">{b.event_type}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">{JSON.stringify(b.details)}</span>
              </div>
            </div>
          ))}
          {(!risk.rmsBlocks || risk.rmsBlocks.length === 0) && (
            <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800/60">
              No RMS pre-trade order rejections recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

