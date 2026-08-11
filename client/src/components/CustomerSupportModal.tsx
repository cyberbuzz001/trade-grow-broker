import React, { useState, useEffect } from 'react';
import { Headset, X, PlusCircle, CheckCircle2, Clock, AlertCircle, Send, MessageSquare, LifeBuoy } from 'lucide-react';

interface CustomerSupportModalProps {
  token: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerSupportModal: React.FC<CustomerSupportModalProps> = ({ token, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'NEW_TICKET' | 'MY_TICKETS'>('NEW_TICKET');
  const [category, setCategory] = useState<string>('TRADING');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState<boolean>(false);

  const fetchTickets = async () => {
    if (!token) return;
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/v1/support/tickets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setMyTickets(data.tickets);
      }
    } catch (_) {
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'MY_TICKETS') {
      fetchTickets();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/v1/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ category, priority, subject, description })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setSubject('');
        setDescription('');
        setTimeout(() => setActiveTab('MY_TICKETS'), 1200);
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Failed to submit support ticket' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-xl">
              <Headset className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--text-main)]">24 x 7 Customer Support</h2>
              <p className="text-xs font-bold text-slate-500">Raise trading queries, account issues, or KYC assistance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-2">
          <button
            onClick={() => setActiveTab('NEW_TICKET')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'NEW_TICKET'
                ? 'bg-[var(--groww-green)] text-white font-extrabold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Raise New Ticket</span>
          </button>

          <button
            onClick={() => setActiveTab('MY_TICKETS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'MY_TICKETS'
                ? 'bg-[var(--groww-green)] text-white font-extrabold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>My Support Tickets</span>
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Content */}
        {activeTab === 'NEW_TICKET' ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-[var(--text-main)] outline-none focus:border-teal-500"
                >
                  <option value="TRADING">Trading & Orders</option>
                  <option value="FUNDS">Funds & Withdrawal</option>
                  <option value="KYC">KYC & Verification</option>
                  <option value="ACCOUNT">Account Security</option>
                  <option value="TECHNICAL">Technical Bug</option>
                  <option value="OTHER">Other Query</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-[var(--text-main)] outline-none focus:border-teal-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[var(--text-muted)] mb-1">Subject</label>
              <input
                type="text"
                required
                placeholder="Brief summary of your query"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-[var(--text-main)] outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-[var(--text-muted)] mb-1">Detailed Description</label>
              <textarea
                required
                rows={4}
                placeholder="Provide details about your issue, order IDs, or error messages..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl py-2.5 px-3 text-[var(--text-main)] outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-[var(--border-color)] text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-[var(--groww-green)] text-white font-black hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Support Ticket'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs font-bold">
            {loadingTickets ? (
              <div className="p-8 text-center text-slate-500">Loading support tickets...</div>
            ) : myTickets.length === 0 ? (
              <div className="p-8 text-center bg-[var(--bg-surface-elevated)] rounded-2xl border border-[var(--border-color)]">
                <LifeBuoy className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-700 dark:text-slate-300 font-black text-sm">No support tickets found</p>
                <p className="text-slate-500 text-xs mt-1">If you need assistance, click "Raise New Ticket" above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTickets.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-black text-[10px]">
                        {t.category}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-600' : t.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-600' : 'bg-indigo-500/10 text-indigo-600'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-[var(--text-main)]">{t.subject}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-normal">{t.description}</p>
                    <div className="text-[10px] text-slate-400 font-semibold pt-1">
                      Submitted: {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
