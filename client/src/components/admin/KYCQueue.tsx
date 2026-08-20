import React, { useState, useEffect } from 'react';
import { 
  FileText, CheckCircle2, XCircle, Download, AlertTriangle, 
  Search, FileCheck, ExternalLink, Building2, Copy, Check, Eye, X, User, CreditCard
} from 'lucide-react';

interface KYCQueueProps { token: string; }

export const KYCQueue: React.FC<KYCQueueProps> = ({ token }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [rejectionCategory, setRejectionCategory] = useState<string>('DOCUMENT_INVALID');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Selected Application for full inspection modal
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchApplications = () => {
    setLoading(true);
    fetch('/api/v1/admin/kyc/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.applications)) {
          setApplications(d.applications);
          // If modal is open, refresh selected app
          if (selectedApp) {
            const updated = d.applications.find((a: any) => a.id === selectedApp.id);
            if (updated) setSelectedApp(updated);
          }
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

  const filteredApps = applications.filter(a => {
    const matchesStatus = filterStatus ? a.status === filterStatus : true;
    const matchesSearch = searchQuery
      ? (a.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.bank_account_number?.includes(searchQuery) ||
         a.bank_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.pan_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         a.aadhaar_number?.includes(searchQuery))
      : true;
    return matchesStatus && matchesSearch;
  });

  const statusColors: Record<string, string> = {
    SUBMITTED: 'bg-amber-950/80 text-amber-400 border-amber-800',
    UNDER_REVIEW: 'bg-blue-950/80 text-blue-400 border-blue-800',
    APPROVED: 'bg-emerald-950/80 text-emerald-400 border-emerald-800',
    REJECTED: 'bg-rose-950/80 text-rose-400 border-rose-800',
    RESUBMISSION_REQUIRED: 'bg-purple-950/80 text-purple-400 border-purple-800',
    NOT_STARTED: 'bg-slate-800 text-slate-400 border-slate-700',
  };

  return (
    <div className="flex flex-col gap-4 h-full text-xs">
      
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3.5 border border-slate-800 rounded-xl shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search user, PAN, Bank A/C, IFSC..."
              className="w-64 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 font-medium outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-teal-500 font-bold"
          >
            <option value="">All Applications ({applications.length})</option>
            <option value="SUBMITTED">Submitted ({applications.filter(a => a.status === 'SUBMITTED').length})</option>
            <option value="UNDER_REVIEW">Under Review ({applications.filter(a => a.status === 'UNDER_REVIEW').length})</option>
            <option value="APPROVED">Approved ({applications.filter(a => a.status === 'APPROVED').length})</option>
            <option value="REJECTED">Rejected ({applications.filter(a => a.status === 'REJECTED').length})</option>
            <option value="RESUBMISSION_REQUIRED">Resubmission Required</option>
          </select>

          <input
            type="text"
            value={actionNotes}
            onChange={e => setActionNotes(e.target.value)}
            placeholder="Review / Rejection notes..."
            className="w-56 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-medium outline-none focus:border-teal-500"
          />

          <select
            value={rejectionCategory}
            onChange={e => setRejectionCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none"
          >
            <option value="DOCUMENT_INVALID">Invalid / Blurred Image</option>
            <option value="NAME_MISMATCH">Name Mismatch</option>
            <option value="EXPIRED_ID">Expired Identity Proof</option>
            <option value="BANK_INVALID">Invalid Bank Account / IFSC</option>
            <option value="OTHER">Other Reason</option>
          </select>
        </div>

        <button
          onClick={fetchApplications}
          className="px-3.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          {loading ? 'Refreshing...' : 'Refresh Queue'}
        </button>
      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl font-bold flex items-center gap-2 ${
          actionMessage.type === 'success' ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border border-rose-800 text-rose-300'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Applications Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex-1 overflow-y-auto shadow-inner">
        <table className="w-full text-xs text-left text-slate-300 border-collapse">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 font-extrabold border-b border-slate-800 z-10">
            <tr>
              <th className="py-3 px-3.5">Client / User</th>
              <th className="py-3 px-3.5">Bank Account Details</th>
              <th className="py-3 px-3.5">PAN Card</th>
              <th className="py-3 px-3.5">Aadhaar</th>
              <th className="py-3 px-3.5">Uploaded Docs</th>
              <th className="py-3 px-3.5">Status</th>
              <th className="py-3 px-3.5">Submitted</th>
              <th className="py-3 px-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-medium">
            {filteredApps.map(app => (
              <tr key={app.id} className="hover:bg-slate-800/40 transition-colors group">
                {/* Client Info */}
                <td className="py-3 px-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-white group-hover:text-teal-400 transition-colors">{app.username}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{app.email}</div>
                  {app.bank_account_name && (
                    <div className="text-[9px] text-slate-500 font-sans mt-0.5">Name: {app.bank_account_name}</div>
                  )}
                </td>

                {/* Bank Account Details */}
                <td className="py-3 px-3.5">
                  {app.bank_account_number || app.bank_name ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="font-bold text-white text-[11px]">{app.bank_name || 'Bank Account'}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 text-[11px]">
                          {app.bank_account_number || '—'}
                        </span>
                        {app.bank_account_number && (
                          <button
                            onClick={() => copyToClipboard(app.bank_account_number, `ac_${app.id}`)}
                            title="Copy Account Number"
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          >
                            {copiedKey === `ac_${app.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>

                      {app.bank_ifsc && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-mono font-bold">
                          <span>IFSC: {app.bank_ifsc}</span>
                          <button
                            onClick={() => copyToClipboard(app.bank_ifsc, `ifsc_${app.id}`)}
                            title="Copy IFSC"
                            className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          >
                            {copiedKey === `ifsc_${app.id}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">No Bank Details</span>
                  )}
                </td>

                {/* PAN Number */}
                <td className="py-3 px-3.5 font-mono font-bold text-teal-400">
                  {app.pan_number ? (
                    <div className="flex items-center gap-1">
                      <span>{app.pan_number}</span>
                      <button
                        onClick={() => copyToClipboard(app.pan_number, `pan_${app.id}`)}
                        className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-white rounded"
                        title="Copy PAN"
                      >
                        {copiedKey === `pan_${app.id}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  ) : '—'}
                </td>

                {/* Aadhaar Number */}
                <td className="py-3 px-3.5 font-mono text-slate-300">
                  {app.aadhaar_number ? (
                    <div className="flex items-center gap-1">
                      <span>{app.aadhaar_number}</span>
                      <button
                        onClick={() => copyToClipboard(app.aadhaar_number, `adh_${app.id}`)}
                        className="p-0.5 hover:bg-slate-800 text-slate-500 hover:text-white rounded"
                        title="Copy Aadhaar"
                      >
                        {copiedKey === `adh_${app.id}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  ) : '—'}
                </td>

                {/* Uploaded Documents */}
                <td className="py-3 px-3.5">
                  <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                    {app.documents && app.documents.length > 0 ? (
                      app.documents.map((doc: any) => (
                        <a
                          key={doc.id}
                          href={`/api/v1/admin/kyc/documents/${doc.id}/download?token=${encodeURIComponent(token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-teal-500 text-teal-400 text-[10px] font-bold inline-flex items-center gap-1 transition-colors shadow-sm"
                        >
                          <Download className="w-3 h-3" />
                          <span>{doc.document_type.replace('_', ' ')}</span>
                        </a>
                      ))
                    ) : (
                      <span className="text-slate-500 italic text-[10px]">No files attached</span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="py-3 px-3.5">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${statusColors[app.status] || 'bg-slate-800 text-slate-400'}`}>
                    {app.status}
                  </span>
                </td>

                {/* Submitted At */}
                <td className="py-3 px-3.5 text-[10px] text-slate-400 font-mono whitespace-nowrap">
                  {app.submitted_at ? new Date(app.submitted_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </td>

                {/* Review Actions */}
                <td className="py-3 px-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Inspect full details & verify"
                    >
                      <Eye className="w-3.5 h-3.5" /> Details
                    </button>

                    {app.status !== 'APPROVED' && (
                      <button
                        onClick={() => handleReview(app.id, 'APPROVE')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}

                    {app.status !== 'REJECTED' && (
                      <button
                        onClick={() => handleReview(app.id, 'REJECT')}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
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
          <div className="text-center py-12 text-slate-500 font-bold">
            No KYC applications found matching your criteria.
          </div>
        )}
      </div>

      {/* FULL APPLICATION & BANK DETAILS INSPECTION MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">KYC & Customer Bank Account Details</h3>
                  <p className="text-[11px] text-slate-400">User: <span className="font-bold text-white">{selectedApp.username}</span> ({selectedApp.email})</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedApp(null)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bank Account Details Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Customer Bank Account</h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Verified for Payouts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Bank Name</span>
                  <span className="text-white font-bold text-sm">{selectedApp.bank_name || 'Not Provided'}</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Account Holder Name</span>
                  <span className="text-white font-bold text-sm">{selectedApp.bank_account_name || selectedApp.username}</span>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Account Number</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-emerald-400 font-bold text-sm">{selectedApp.bank_account_number || '—'}</span>
                    {selectedApp.bank_account_number && (
                      <button
                        onClick={() => copyToClipboard(selectedApp.bank_account_number, 'modal_ac')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedKey === 'modal_ac' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'modal_ac' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">IFSC Code</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-amber-400 font-bold text-sm">{selectedApp.bank_ifsc || '—'}</span>
                    {selectedApp.bank_ifsc && (
                      <button
                        onClick={() => copyToClipboard(selectedApp.bank_ifsc, 'modal_ifsc')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedKey === 'modal_ifsc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'modal_ifsc' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Identity Details Card */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Government Identity Details</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">PAN Card Number</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-teal-400 font-bold text-sm">{selectedApp.pan_number || '—'}</span>
                    {selectedApp.pan_number && (
                      <button
                        onClick={() => copyToClipboard(selectedApp.pan_number, 'modal_pan')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedKey === 'modal_pan' ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'modal_pan' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Aadhaar Card Number</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-300 font-bold text-sm">{selectedApp.aadhaar_number || '—'}</span>
                    {selectedApp.aadhaar_number && (
                      <button
                        onClick={() => copyToClipboard(selectedApp.aadhaar_number, 'modal_adh')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedKey === 'modal_adh' ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'modal_adh' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attached Verification Documents */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Uploaded Documents & Proofs</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {selectedApp.documents && selectedApp.documents.length > 0 ? (
                  selectedApp.documents.map((doc: any) => (
                    <a
                      key={doc.id}
                      href={`/api/v1/admin/kyc/documents/${doc.id}/download?token=${encodeURIComponent(token)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500 flex flex-col items-center justify-center gap-1.5 text-center transition group shadow"
                    >
                      <FileCheck className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-white text-[11px]">{doc.document_type.replace('_', ' ')}</span>
                      <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{doc.original_filename}</span>
                      <span className="text-[9px] text-teal-400 font-bold flex items-center gap-0.5 mt-1">
                        <Download className="w-2.5 h-2.5" /> View / Download
                      </span>
                    </a>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-4 text-slate-500 italic">No document files attached</div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">Status:</span>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${statusColors[selectedApp.status] || 'bg-slate-800 text-slate-400'}`}>
                  {selectedApp.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {selectedApp.status !== 'APPROVED' && (
                  <button
                    onClick={() => {
                      handleReview(selectedApp.id, 'APPROVE');
                      setSelectedApp(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Application
                  </button>
                )}

                {selectedApp.status !== 'REJECTED' && (
                  <button
                    onClick={() => {
                      handleReview(selectedApp.id, 'REJECT');
                      setSelectedApp(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Reject Application
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
