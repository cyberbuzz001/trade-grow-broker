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
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[var(--text-muted)] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--loss)]" />
        <span className="text-xs font-semibold tracking-wider uppercase">Initializing Risk Command Center...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[var(--loss-light)]/40 via-[var(--bg-surface)]/80 to-[var(--bg-surface)]/90 border border-[var(--loss)]/40 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--loss)]/10 border border-[var(--loss)]/20 text-[var(--loss)]">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-main)] tracking-tight flex items-center gap-2">
              RISK COMMAND CENTER
              <span className="text-[10px] font-bold text-[var(--loss)] bg-[var(--loss)]/10 px-2 py-0.5 rounded-full border border-[var(--loss)]/20 uppercase tracking-widest">
                Active Monitoring
              </span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Real-Time Pre-Trade RMS & Margin Utilization Safeguards</p>
          </div>
        </div>
        <button
          onClick={fetchRiskData}
          disabled={loading}
          className="p-2 rounded-lg bg-[var(--bg-surface-elevated)]/80 hover:bg-[var(--bg-surface-elevated)]/80 text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]/60 transition-all duration-200"
          title="Refresh Risk Metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--loss)]' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Total Risk Exposure</span>
          <span className="text-2xl font-extrabold text-[var(--warning)] font-mono tracking-tight block mt-1">₹{risk.totalExposure.toLocaleString('en-IN')}</span>
          <span className="text-[9px] font-semibold text-[var(--text-tertiary)] mt-1 block">Active Position Capital</span>
        </div>
        <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Margin Utilized Pool</span>
          <span className="text-2xl font-extrabold text-[var(--gogrow-blue)] font-mono tracking-tight block mt-1">₹{risk.marginUsed.toLocaleString('en-IN')}</span>
          <span className="text-[9px] font-semibold text-[var(--text-tertiary)] mt-1 block">Blocked Pre-Trade Capital</span>
        </div>
        <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-4 transition-all duration-300 shadow-xl hover:-translate-y-0.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Frozen / Restricted Accounts</span>
          <span className="text-2xl font-extrabold text-[var(--loss)] tracking-tight block mt-1">{risk.frozenAccounts?.length || 0}</span>
          <span className="text-[9px] font-semibold text-[var(--text-tertiary)] mt-1 block">Suspended Access</span>
        </div>
      </div>

      {/* High Risk Clients */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
            <Flame className="w-4 h-4 text-[var(--loss)]" /> High-Risk Clients (Margin Utilization {'>'} 80%)
          </h3>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">Clients: {(risk.highRiskClients || []).length}</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]/80">
          <table className="w-full text-xs text-left text-[var(--text-muted)]">
            <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4 text-right">Cash Balance</th>
                <th className="py-2.5 px-4 text-right">Used Margin</th>
                <th className="py-2.5 px-4 text-right">Utilization Bar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]/80 bg-[var(--bg-surface)]/40">
              {(risk.highRiskClients || []).map((c: any) => {
                const utilVal = c.cash_balance > 0 ? (c.used_margin / c.cash_balance) * 100 : 0;
                const utilText = c.cash_balance > 0 ? `${utilVal.toFixed(1)}%` : '100%';
                const utilPct = Math.min(100, Math.max(0, utilVal));

                return (
                  <tr key={c.id} className="hover:bg-[var(--bg-surface-elevated)]/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--text-main)] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--loss)] animate-pulse" />
                      {c.username}
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] font-mono text-[11px]">{c.email}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--primary)]">₹{parseFloat(c.cash_balance).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[var(--warning)]">₹{parseFloat(c.used_margin).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-[var(--bg-body)] rounded-full h-2 overflow-hidden border border-[var(--border-color)]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              utilPct > 90 ? 'bg-[var(--loss)] shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                              utilPct > 75 ? 'bg-[var(--warning)] shadow-[0_0_8px_rgba(245,158,11,0.6)]' :
                              'bg-[var(--primary)]'
                            }`}
                            style={{ width: `${utilPct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[var(--loss)] font-mono w-12 text-right">{utilText}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!risk.highRiskClients || risk.highRiskClients.length === 0) && (
            <div className="flex items-center justify-center gap-2 text-center py-6 text-[var(--text-muted)] text-xs bg-[var(--bg-surface)]/40">
              <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
              <span>No over-leveraged high-risk accounts detected. All clients operate within safety margin parameters.</span>
            </div>
          )}
        </div>
      </div>

      {/* Margin Alerts */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-5 shadow-xl">
        <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--warning)]" /> Active Risk Alerts & Notifications
        </h3>
        <div className="space-y-2.5">
          {(risk.marginAlerts || []).map((a: any) => (
            <div key={a.id} className={`flex items-center gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all ${
              a.severity === 'CRITICAL' ? 'bg-[var(--loss-light)]/40 border-[var(--loss)]/80 shadow-[0_0_15px_rgba(244,63,94,0.1)]' :
              a.severity === 'HIGH' ? 'bg-[var(--warning-light)]/40 border-[var(--warning)]/80' : 'bg-[var(--bg-surface)]/80 border-[var(--border-color)]'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                a.severity === 'CRITICAL' ? 'bg-[var(--loss)] shadow-[0_0_10px_rgba(248,113,113,0.8)] animate-pulse' :
                a.severity === 'HIGH' ? 'bg-[var(--warning)] shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-[var(--bg-surface-elevated)]'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-main)]">{a.event_type}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                    a.severity === 'CRITICAL' ? 'bg-[var(--loss)]/20 text-[var(--loss)]' :
                    a.severity === 'HIGH' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
                  }`}>
                    {a.severity}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5 truncate">{a.details?.message || JSON.stringify(a.details)}</span>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-tertiary)] whitespace-nowrap">{new Date(a.created_at).toLocaleString('en-IN')}</span>
            </div>
          ))}
          {(!risk.marginAlerts || risk.marginAlerts.length === 0) && (
            <div className="text-center py-6 text-[var(--text-tertiary)] text-xs bg-[var(--bg-surface)]/40 rounded-xl border border-[var(--border-color)]/60">
              No active risk alerts recorded.
            </div>
          )}
        </div>
      </div>

      {/* RMS Blocks */}
      <div className="bg-[var(--bg-surface)]/80 border border-[var(--border-color)]/80 rounded-2xl p-5 shadow-xl pb-6">
        <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--loss)]" /> Pre-Trade RMS Rejections & Blocks
        </h3>
        <div className="space-y-2.5">
          {(risk.rmsBlocks || []).map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--loss-light)]/30 border border-[var(--loss)]/60">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--loss)] flex-shrink-0 animate-pulse" />
              <div className="flex-1">
                <span className="text-xs font-bold text-[var(--text-main)]">{b.event_type}</span>
                <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">{JSON.stringify(b.details)}</span>
              </div>
            </div>
          ))}
          {(!risk.rmsBlocks || risk.rmsBlocks.length === 0) && (
            <div className="text-center py-6 text-[var(--text-tertiary)] text-xs bg-[var(--bg-surface)]/40 rounded-xl border border-[var(--border-color)]/60">
              No RMS pre-trade order rejections recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

