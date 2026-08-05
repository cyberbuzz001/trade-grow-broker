import React, { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';

interface LedgerViewerProps { token: string; }

export const LedgerViewer: React.FC<LedgerViewerProps> = ({ token }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [txnType, setTxnType] = useState('');
  const [page, setPage] = useState(0);

  const fetchLedger = () => {
    const params = new URLSearchParams({ limit: '100', offset: String(page * 100) });
    if (customerId) params.set('customerId', customerId);
    if (txnType) params.set('type', txnType);
    fetch(`/api/v1/admin/ledger?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) { setEntries(d.entries); setTotal(d.total); } });
  };

  useEffect(() => { fetchLedger(); }, [token, customerId, txnType, page]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Filter by Client ID..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-600" />
        </div>
        <select value={txnType} onChange={e => setTxnType(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white">
          <option value="">All Types</option>
          <option value="CREDIT">Credit</option>
          <option value="DEBIT">Debit</option>
          <option value="BROKERAGE">Brokerage</option>
          <option value="WITHDRAWAL">Withdrawal</option>
          <option value="MARGIN_BLOCK">Margin Block</option>
          <option value="MARGIN_RELEASE">Margin Release</option>
        </select>
        <span className="text-[10px] text-slate-500">{total} entries</span>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-xs text-left text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0">
            <tr>
              <th className="py-2.5 px-3">Txn ID</th>
              <th className="py-2.5 px-3">Client</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3 text-right">Debit</th>
              <th className="py-2.5 px-3 text-right">Credit</th>
              <th className="py-2.5 px-3 text-right">Balance Before</th>
              <th className="py-2.5 px-3 text-right">Balance After</th>
              <th className="py-2.5 px-3">Created By</th>
              <th className="py-2.5 px-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.map(e => (
              <tr key={e.id} className="hover:bg-slate-800/40 font-mono">
                <td className="py-2 px-3 text-[10px] text-slate-500">{e.transaction_id?.slice(0, 8)}</td>
                <td className="py-2 px-3 font-sans font-semibold text-white">{e.username}</td>
                <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                  e.transaction_type === 'CREDIT' ? 'bg-emerald-950 text-emerald-400' :
                  e.transaction_type === 'DEBIT' ? 'bg-rose-950 text-rose-400' :
                  'bg-slate-800 text-slate-400'
                }`}>{e.transaction_type}</span></td>
                <td className="py-2 px-3 text-right text-rose-400">{e.transaction_type === 'DEBIT' ? `₹${parseFloat(e.amount).toLocaleString('en-IN')}` : '—'}</td>
                <td className="py-2 px-3 text-right text-emerald-400">{e.transaction_type === 'CREDIT' ? `₹${parseFloat(e.amount).toLocaleString('en-IN')}` : '—'}</td>
                <td className="py-2 px-3 text-right text-slate-400">₹{parseFloat(e.balance_before).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 text-right text-white font-bold">₹{parseFloat(e.balance_after).toLocaleString('en-IN')}</td>
                <td className="py-2 px-3 font-sans text-slate-500 text-[10px]">{e.created_by}</td>
                <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 100 && (
        <div className="flex justify-between items-center text-xs text-slate-400">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded">← Previous</button>
          <span>Page {page + 1} of {Math.ceil(total / 100)}</span>
          <button onClick={() => setPage(page + 1)} disabled={(page + 1) * 100 >= total}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded">Next →</button>
        </div>
      )}
    </div>
  );
};
