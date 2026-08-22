import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, XCircle, Download, AlertTriangle, Search, FileCheck, ExternalLink } from 'lucide-react';

interface KYCQueueProps { token: string; }

export const KYCQueue: React.FC<KYCQueueProps> = ({ token }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [rejectionCategory, setRejectionCategory] = useState<string>('DOCUMENT_INVALID');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchApplications = () => {
    setLoading(true);
    fetch('/api/v1/admin/kyc/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.applications)) {
          setApplications(d.applications);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApplications(); }, [token]);

  const handleReview = async (appId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMISSION') => {
    setActionMessage(null);
    try {
      const res = await fetch('/api/v1/admin/kyc/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          applicationId: appId,
          action,
          rejectionReason: actionNotes || (action === 'APPROVE' ? 'Approved by Admin' : 'Documents rejected by Admin'),
          rejectionCategory
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: data.message });
        setActionNotes('');
        fetchApplications();
      } else {
        setActionMessage({ type: 'error', text: data.error?.message || 'Review failed' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const filteredApps = filterStatus
    ? applications.filter(a => a.status === filterStatus)
    : applications;

  const statusColors: Record<string, string> = {
    SUBMITTED: 'bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning)]',
    UNDER_REVIEW: 'bg-[var(--info-light)] text-[var(--info)] border-[var(--info)]',
    APPROVED: 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]',
    REJECTED: 'bg-[var(--loss-light)] text-[var(--loss)] border-[var(--loss)]',
    RESUBMISSION_REQUIRED: 'bg-purple-950 text-purple-400 border-purple-800',
    NOT_STARTED: 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)]',
  };

  return (
    <div className="flex flex-col gap-4 h-full text-xs">
      
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)]/60 p-3 border border-[var(--border-color)] rounded-xl">
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] outline-none focus:border-teal-500 font-bold"
          >
            <option value="">All Applications ({applications.length})</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="RESUBMISSION_REQUIRED">Resubmission Required</option>
          </select>

          <input
            type="text"
            value={actionNotes}
            onChange={e => setActionNotes(e.target.value)}
            placeholder="Review / Rejection notes..."
            className="w-64 bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] placeholder-slate-500 font-medium outline-none focus:border-teal-500"
          />

          <select
            value={rejectionCategory}
            onChange={e => setRejectionCategory(e.target.value)}
            className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] outline-none"
          >
            <option value="DOCUMENT_INVALID">Invalid / Blurred Image</option>
            <option value="NAME_MISMATCH">Name Mismatch</option>
            <option value="EXPIRED_ID">Expired Identity Proof</option>
            <option value="OTHER">Other Reason</option>
          </select>
        </div>

        <button
          onClick={fetchApplications}
          className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] font-bold hover:bg-[var(--bg-surface-elevated)] transition-colors"
        >
          Refresh Queue
        </button>
      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
          actionMessage.type === 'success' ? 'bg-[var(--primary-light)]/60 border border-[var(--primary)] text-[var(--primary)]' : 'bg-[var(--loss-light)]/60 border border-[var(--loss)] text-[var(--loss)]'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Applications Table */}
      <div className="bg-[var(--bg-surface)]/60 border border-[var(--border-color)] rounded-xl overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-xs text-left text-[var(--text-muted)] border-collapse">
          <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] uppercase text-[10px] sticky top-0 font-extrabold border-b border-[var(--border-color)]">
            <tr>
              <th className="py-3 px-4">Client / Email</th>
              <th className="py-3 px-4">PAN Card</th>
              <th className="py-3 px-4">Aadhaar</th>
              <th className="py-3 px-4">Uploaded Documents</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Submitted</th>
              <th className="py-3 px-4 text-center">Review Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)] font-medium">
            {filteredApps.map(app => (
              <tr key={app.id} className="hover:bg-[var(--bg-surface-elevated)]/40 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-extrabold text-[var(--text-main)]">{app.username}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">{app.email}</div>
                </td>

                <td className="py-3 px-4 font-mono font-bold text-teal-400">
                  {app.pan_number || '—'}
                </td>

                <td className="py-3 px-4 font-mono text-[var(--text-muted)]">
                  {app.aadhaar_number || '—'}
                </td>

                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1.5">
                    {app.documents && app.documents.length > 0 ? (
                      app.documents.map((doc: any) => (
                        <a
                          key={doc.id}
                          href={`/api/v1/admin/kyc/documents/${doc.id}/download?token=${encodeURIComponent(token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-[var(--bg-body)] border border-[var(--border-color)] hover:border-teal-500 text-teal-400 text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>{doc.document_type}</span>
                        </a>
                      ))
                    ) : (
                      <span className="text-[var(--text-tertiary)] italic text-[10px]">No files attached</span>
                    )}
                  </div>
                </td>

                <td className="py-3 px-4">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${statusColors[app.status] || 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'}`}>
                    {app.status}
                  </span>
                </td>

                <td className="py-3 px-4 text-[10px] text-[var(--text-muted)] font-mono">
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : '—'}
                </td>

                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {app.status !== 'APPROVED' && (
                      <button
                        onClick={() => handleReview(app.id, 'APPROVE')}
                        className="px-2.5 py-1 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/40 hover:bg-[var(--primary-hover)]/30 text-[10px] font-black flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {app.status !== 'REJECTED' && (
                      <button
                        onClick={() => handleReview(app.id, 'REJECT')}
                        className="px-2.5 py-1 rounded-lg bg-[var(--loss)]/20 text-[var(--loss)] border border-[var(--loss)]/40 hover:bg-[var(--loss)]/30 text-[10px] font-black flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredApps.length === 0 && (
          <div className="text-center py-12 text-[var(--text-tertiary)] font-bold">
            No KYC applications found in queue.
          </div>
        )}
      </div>
    </div>
  );
};
