import React, { useState, useEffect } from 'react';
import { AlertTriangle, Power, PowerOff, ShieldAlert } from 'lucide-react';

interface KillSwitchProps { token: string; }

export const KillSwitch: React.FC<KillSwitchProps> = ({ token }) => {
  const [states, setStates] = useState<any[]>([]);
  const [confirmScope, setConfirmScope] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const fetchStates = () => {
    fetch('/api/v1/admin/risk/kill-switch', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setStates(d.states));
  };

  useEffect(() => { fetchStates(); }, [token]);

  const handleToggle = async (scope: string, currentlyActive: boolean) => {
    if (!reason.trim()) return;
    await fetch('/api/v1/admin/risk/kill-switch', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scope, action: currentlyActive ? 'DEACTIVATE' : 'ACTIVATE', reason })
    });
    setConfirmScope(null);
    setReason('');
    fetchStates();
  };

  const scopeLabels: Record<string, { label: string; desc: string }> = {
    GLOBAL: { label: 'Global Trading', desc: 'Halt ALL trading across ALL exchanges and segments' },
    NSE: { label: 'NSE', desc: 'National Stock Exchange' },
    BSE: { label: 'BSE', desc: 'Bombay Stock Exchange' },
    MCX: { label: 'MCX', desc: 'Multi Commodity Exchange' },
    EQUITY: { label: 'Equity Segment', desc: 'Cash equity market segment' },
    FUTURES: { label: 'Futures Segment', desc: 'Futures & forwards segment' },
    OPTIONS: { label: 'Options Segment', desc: 'Options derivatives segment' },
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-rose-950/40 border border-rose-800 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
        <div className="text-xs text-rose-300">
          <strong>RESTRICTED ACCESS</strong> — Kill switch controls require SUPER_ADMIN privileges and produce immutable audit records. Each action requires a reason and confirmation.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {states.map(s => {
          const meta = scopeLabels[s.scope] || { label: s.scope, desc: '' };
          const isGlobal = s.scope === 'GLOBAL';
          return (
            <div key={s.scope} className={`border rounded-xl p-4 flex items-center justify-between transition ${
              s.is_active ? 'bg-rose-950/30 border-rose-800' : 'bg-slate-900/60 border-slate-800'
            } ${isGlobal ? 'border-2' : ''}`}>
              <div className="flex items-center gap-4">
                {s.is_active ? <PowerOff className="w-6 h-6 text-rose-400" /> : <Power className="w-6 h-6 text-emerald-400" />}
                <div>
                  <span className={`font-bold text-sm ${isGlobal ? 'text-lg' : ''} ${s.is_active ? 'text-rose-400' : 'text-white'}`}>{meta.label}</span>
                  <span className="text-[10px] text-slate-500 block">{meta.desc}</span>
                  {s.reason && <span className="text-[10px] text-amber-400 block mt-0.5">Reason: {s.reason}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.is_active ? 'bg-rose-900 text-rose-300' : 'bg-emerald-900 text-emerald-300'}`}>
                  {s.is_active ? '⛔ HALTED' : '✅ ACTIVE'}
                </span>
                {confirmScope === s.scope ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)..."
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white w-48" />
                    <button onClick={() => handleToggle(s.scope, s.is_active)} disabled={!reason.trim()}
                      className="bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white text-xs font-bold px-3 py-1 rounded transition">
                      CONFIRM
                    </button>
                    <button onClick={() => { setConfirmScope(null); setReason(''); }}
                      className="text-slate-400 hover:text-white text-xs px-2 py-1">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmScope(s.scope)}
                    className={`text-xs font-bold px-3 py-1 rounded transition ${
                      s.is_active ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-rose-700 hover:bg-rose-600 text-white'
                    }`}>
                    {s.is_active ? 'Resume' : 'Halt'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
