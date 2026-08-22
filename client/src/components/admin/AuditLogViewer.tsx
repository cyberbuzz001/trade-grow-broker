import React, { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';

interface AuditLogViewerProps { token: string; }

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ token }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/audit-logs?limit=200', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setLogs(d.logs));
  }, [token]);

  const filtered = actionFilter ? logs.filter(l => l.action.includes(actionFilter)) : logs;
  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)]">
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[10px] text-[var(--text-tertiary)]">{filtered.length} entries</span>
      </div>

      <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-lg overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-xs text-left text-[var(--text-muted)]">
          <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px] sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Actor</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Resource</th>
              <th className="py-2.5 px-3">Resource ID</th>
              <th className="py-2.5 px-3">IP Address</th>
              <th className="py-2.5 px-3">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)] font-mono">
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-[var(--bg-surface-elevated)]/40">
                <td className="py-2 px-3 text-[var(--text-muted)] text-[10px]">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="py-2 px-3 text-[var(--warning)] text-[10px]">{log.actor_id?.slice(0, 10)}</td>
                <td className="py-2 px-3"><span className="bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded text-[10px] text-[var(--gogrow-blue)] font-sans">{log.actor_role}</span></td>
                <td className="py-2 px-3 font-bold text-[var(--text-main)] font-sans">{log.action}</td>
                <td className="py-2 px-3 text-[var(--text-muted)] font-sans">{log.resource_type}</td>
                <td className="py-2 px-3 text-[10px] text-[var(--text-tertiary)]">{log.resource_id?.slice(0, 10)}</td>
                <td className="py-2 px-3 text-[var(--text-tertiary)] text-[10px]">{log.ip_address}</td>
                <td className="py-2 px-3 text-[10px] text-[var(--text-tertiary)] max-w-[120px] truncate">{log.new_data ? JSON.stringify(log.new_data) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
