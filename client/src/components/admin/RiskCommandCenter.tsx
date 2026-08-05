import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, TrendingUp } from 'lucide-react';

interface RiskCommandCenterProps { token: string; }

export const RiskCommandCenter: React.FC<RiskCommandCenterProps> = ({ token }) => {
  const [risk, setRisk] = useState<any>(null);

  useEffect(() => {
    fetch('/api/v1/admin/risk/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setRisk(d.risk));
  }, [token]);

  if (!risk) return <div className="text-slate-400 text-sm p-8">Loading risk dashboard...</div>;

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-2">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Exposure</span>
          <span className="text-2xl font-bold text-amber-400 font-mono block mt-1">₹{risk.totalExposure.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Margin Utilized</span>
          <span className="text-2xl font-bold text-indigo-400 font-mono block mt-1">₹{risk.marginUsed.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Frozen Accounts</span>
          <span className="text-2xl font-bold text-rose-400 block mt-1">{risk.frozenAccounts?.length || 0}</span>
        </div>
      </div>

      {/* High Risk Clients */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-rose-400" /> High-Risk Clients (Margin {'>'} 80%)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr><th className="py-2 px-3">Client</th><th className="py-2 px-3">Email</th><th className="py-2 px-3 text-right">Funds (₹)</th><th className="py-2 px-3 text-right">Margin (₹)</th><th className="py-2 px-3 text-right">Utilization</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(risk.highRiskClients || []).map((c: any) => {
                const util = c.cash_balance > 0 ? ((c.used_margin / c.cash_balance) * 100).toFixed(1) : '∞';
                return (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold text-white">{c.username}</td>
                    <td className="py-2 px-3 text-slate-400">{c.email}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-400">₹{parseFloat(c.cash_balance).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-mono text-amber-400">₹{parseFloat(c.used_margin).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right font-bold text-rose-400">{util}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!risk.highRiskClients || risk.highRiskClients.length === 0) && <div className="text-center py-4 text-slate-500 text-xs">No high-risk clients detected</div>}
        </div>
      </div>

      {/* Margin Alerts */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Active Risk Alerts</h3>
        <div className="space-y-2">
          {(risk.marginAlerts || []).map((a: any) => (
            <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
              a.severity === 'CRITICAL' ? 'bg-rose-950/30 border-rose-800' :
              a.severity === 'HIGH' ? 'bg-amber-950/30 border-amber-800' : 'bg-slate-900 border-slate-800'
            }`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.severity === 'CRITICAL' ? 'bg-rose-400' : a.severity === 'HIGH' ? 'bg-amber-400' : 'bg-slate-400'}`} />
              <div className="flex-1">
                <span className="text-xs font-bold text-white">{a.event_type}</span>
                <span className="text-[10px] text-slate-400 block">{a.details?.message || JSON.stringify(a.details)}</span>
              </div>
              <span className="text-[10px] text-slate-500">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
          {(!risk.marginAlerts || risk.marginAlerts.length === 0) && <div className="text-center py-4 text-slate-500 text-xs">No active risk alerts</div>}
        </div>
      </div>

      {/* RMS Blocks */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-rose-400" /> RMS Blocks</h3>
        <div className="space-y-2">
          {(risk.rmsBlocks || []).map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-rose-950/30 border border-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs font-bold text-white">{b.event_type}</span>
                <span className="text-[10px] text-slate-400 block">{JSON.stringify(b.details)}</span>
              </div>
            </div>
          ))}
          {(!risk.rmsBlocks || risk.rmsBlocks.length === 0) && <div className="text-center py-4 text-slate-500 text-xs">No RMS blocks</div>}
        </div>
      </div>
    </div>
  );
};
