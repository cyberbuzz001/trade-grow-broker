import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface KYCQueueProps { token: string; }

export const KYCQueue: React.FC<KYCQueueProps> = ({ token }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [actionNotes, setActionNotes] = useState('');

  const fetchQueue = () => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    fetch(`/api/v1/admin/kyc/queue?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => d.success && setRecords(d.records));
  };

  useEffect(() => { fetchQueue(); }, [token, filter]);

  const handleApprove = async (id: string) => {
    await fetch(`/api/v1/admin/kyc/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notes: actionNotes || 'Approved by admin' })
    });
    setActionNotes('');
    fetchQueue();
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/v1/admin/kyc/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: actionNotes || 'Rejected by admin' })
    });
    setActionNotes('');
    fetchQueue();
  };

  const statusColors: Record<string, string> = {
    SUBMITTED: 'bg-blue-950 text-blue-400 border-blue-800',
    UNDER_REVIEW: 'bg-amber-950 text-amber-400 border-amber-800',
    APPROVED: 'bg-emerald-950 text-emerald-400 border-emerald-800',
    REJECTED: 'bg-rose-950 text-rose-400 border-rose-800',
    DRAFT: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
          <option value="">All Status</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="DRAFT">Draft</option>
        </select>
        <input type="text" value={actionNotes} onChange={e => setActionNotes(e.target.value)} placeholder="Approval/rejection notes..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500" />
        <span className="text-[10px] text-slate-500">{records.length} records</span>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
            <tr>
              <th className="py-2.5 px-3">KYC ID</th>
              <th className="py-2.5 px-3">Client</th>
              <th className="py-2.5 px-3">Email</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Risk</th>
              <th className="py-2.5 px-3">Document</th>
              <th className="py-2.5 px-3">Submitted</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {records.map(r => (
              <tr key={r.id} className="hover:bg-slate-800/40">
                <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{r.id?.slice(0, 12)}</td>
                <td className="py-2 px-3 font-semibold text-white">{r.username}</td>
                <td className="py-2 px-3 text-slate-400">{r.email}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColors[r.kyc_status] || 'bg-slate-800 text-slate-400'}`}>{r.kyc_status}</span>
                </td>
                <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] ${
                  r.risk_category === 'HIGH' ? 'bg-rose-950 text-rose-400' : r.risk_category === 'LOW' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                }`}>{r.risk_category || 'MEDIUM'}</span></td>
                <td className="py-2 px-3 text-slate-500">{r.document_type || '—'}</td>
                <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="py-2 px-3 text-center">
                  {!['APPROVED', 'REJECTED'].includes(r.kyc_status) && (
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleApprove(r.id)} title="Approve" className="p-1 text-emerald-500 hover:text-emerald-300"><CheckCircle2 className="w-4 h-4" /></button>
                      <button onClick={() => handleReject(r.id)} title="Reject" className="p-1 text-rose-500 hover:text-rose-300"><XCircle className="w-4 h-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <div className="text-center py-8 text-slate-500 text-xs">No KYC records found</div>}
      </div>
    </div>
  );
};
