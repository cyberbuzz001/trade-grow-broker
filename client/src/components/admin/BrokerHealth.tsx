import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Zap, Clock } from 'lucide-react';

interface BrokerHealthProps { token: string; }

export const BrokerHealth: React.FC<BrokerHealthProps> = ({ token }) => {
  const [broker, setBroker] = useState<any>(null);

  useEffect(() => {
    const fetch_ = () => fetch('/api/v1/admin/broker/health', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setBroker(d.broker));
    fetch_();
    const i = setInterval(fetch_, 10000);
    return () => clearInterval(i);
  }, [token]);

  if (!broker) return <div className="text-slate-400 text-sm p-8">Loading broker health...</div>;

  const ProviderBadge = ({ name }: { name: string }) => (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-900/50 text-indigo-300 border border-indigo-800">
      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
      {name}
    </span>
  );

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
      ['CONNECTED', 'HEALTHY', 'LIVE'].includes(status) ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800' :
      ['WAITING', 'IDLE'].includes(status) ? 'bg-amber-900/50 text-amber-300 border border-amber-800' :
      'bg-rose-900/50 text-rose-300 border border-rose-800'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        ['CONNECTED', 'HEALTHY', 'LIVE'].includes(status) ? 'bg-emerald-400 animate-pulse' :
        ['WAITING', 'IDLE'].includes(status) ? 'bg-amber-400' : 'bg-rose-400'
      }`} />
      {status}
    </span>
  );

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center gap-3 text-emerald-400">
        <Zap className="w-4 h-4 animate-pulse" />
        <span className="text-[10px] font-bold uppercase">Auto-refresh every 10s</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Provider', value: broker.provider, icon: <Wifi className="w-5 h-5" />, isProvider: true },
          { label: 'API Connection', value: broker.apiStatus, icon: <Wifi className="w-5 h-5" /> },
          { label: 'WebSocket Feed', value: broker.wsStatus, icon: <Wifi className="w-5 h-5" /> },
          { label: 'Order API', value: broker.orderApiStatus, icon: <Zap className="w-5 h-5" /> },
          { label: 'Market Data', value: broker.marketDataStatus, icon: <Zap className="w-5 h-5" /> },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
            <div className="text-slate-500">{s.icon}</div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">{s.label}</span>
              {s.isProvider ? <ProviderBadge name={s.value} /> : <StatusBadge status={s.value} />}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Latency</span>
          <span className="text-2xl font-bold text-white font-mono block mt-1">{broker.latencyMs}ms</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Active Subscriptions</span>
          <span className="text-2xl font-bold text-indigo-400 block mt-1">{broker.activeSubscriptions}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Last Tick</span>
          <span className="text-sm font-bold text-emerald-400 block mt-1">{new Date(broker.lastTickAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};
