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

  if (!broker) return <div className="text-[var(--text-muted)] text-sm p-8">Loading broker health...</div>;

  const ProviderBadge = ({ name }: { name: string }) => (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--gogrow-blue-light)]/50 text-[var(--gogrow-blue)] border border-[var(--gogrow-blue)]">
      <span className="w-2 h-2 rounded-full bg-[var(--gogrow-blue)] animate-pulse" />
      {name}
    </span>
  );

  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
      ['CONNECTED', 'HEALTHY', 'LIVE'].includes(status) ? 'bg-[var(--primary-light)]/50 text-[var(--primary)] border border-[var(--primary)]' :
      ['WAITING', 'IDLE'].includes(status) ? 'bg-[var(--warning-light)]/50 text-[var(--warning)] border border-[var(--warning)]' :
      'bg-[var(--loss-light)]/50 text-[var(--loss)] border border-[var(--loss)]'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        ['CONNECTED', 'HEALTHY', 'LIVE'].includes(status) ? 'bg-[var(--primary)] animate-pulse' :
        ['WAITING', 'IDLE'].includes(status) ? 'bg-[var(--warning)]' : 'bg-[var(--loss)]'
      }`} />
      {status}
    </span>
  );

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">
      <div className="flex items-center gap-3 text-[var(--primary)]">
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
          <div key={s.label} className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl p-5 flex items-center gap-4">
            <div className="text-[var(--text-tertiary)]">{s.icon}</div>
            <div className="flex-1">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold block">{s.label}</span>
              {s.isProvider ? <ProviderBadge name={s.value} /> : <StatusBadge status={s.value} />}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg p-4">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold block">Latency</span>
          <span className="text-2xl font-bold text-[var(--text-main)] font-mono block mt-1">{broker.latencyMs}ms</span>
        </div>
        <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg p-4">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold block">Active Subscriptions</span>
          <span className="text-2xl font-bold text-[var(--gogrow-blue)] block mt-1">{broker.activeSubscriptions}</span>
        </div>
        <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg p-4">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold block">Last Tick</span>
          <span className="text-sm font-bold text-[var(--primary)] block mt-1">{new Date(broker.lastTickAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};
