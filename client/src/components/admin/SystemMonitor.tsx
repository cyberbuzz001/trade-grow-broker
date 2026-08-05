import React, { useState, useEffect } from 'react';
import { Server, RefreshCw } from 'lucide-react';

interface SystemMonitorProps { token: string; }

export const SystemMonitor: React.FC<SystemMonitorProps> = ({ token }) => {
  const [systems, setSystems] = useState<any[]>([]);

  useEffect(() => {
    const fetch_ = () => fetch('/api/v1/admin/system/health', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setSystems(d.systems));
    fetch_();
    const i = setInterval(fetch_, 8000);
    return () => clearInterval(i);
  }, [token]);

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center gap-2 text-emerald-400">
        <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
        <span className="text-[10px] font-bold uppercase">Health Checks — Auto-refresh 8s</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {systems.map(s => (
          <div key={s.name} className={`border rounded-xl p-5 flex items-center gap-4 transition ${
            s.status === 'OPERATIONAL' || s.status === 'CONNECTED' ? 'bg-emerald-950/10 border-emerald-800/40' :
            s.status === 'DEGRADED' || s.status === 'IDLE' ? 'bg-amber-950/10 border-amber-800/40' :
            'bg-rose-950/10 border-rose-800/40'
          }`}>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              s.status === 'OPERATIONAL' || s.status === 'CONNECTED' ? 'bg-emerald-900/30' :
              s.status === 'DEGRADED' || s.status === 'IDLE' ? 'bg-amber-900/30' : 'bg-rose-900/30'
            }`}>
              <Server className={`w-6 h-6 ${
                s.status === 'OPERATIONAL' || s.status === 'CONNECTED' ? 'text-emerald-400' :
                s.status === 'DEGRADED' || s.status === 'IDLE' ? 'text-amber-400' : 'text-rose-400'
              }`} />
            </div>
            <div className="flex-1">
              <span className="font-bold text-white block">{s.name}</span>
              <span className={`text-xs font-bold ${
                s.status === 'OPERATIONAL' || s.status === 'CONNECTED' ? 'text-emerald-400' :
                s.status === 'DEGRADED' || s.status === 'IDLE' ? 'text-amber-400' : 'text-rose-400'
              }`}>{s.status}</span>
            </div>
            {s.latencyMs > 0 && (
              <span className="text-xs font-mono text-slate-400">{s.latencyMs}ms</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
