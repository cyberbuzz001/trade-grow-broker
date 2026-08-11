import React, { useState, useEffect } from 'react';
import { Search, X, TrendingUp, LineChart, Layers, PieChart, ShieldAlert, Zap } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (token: string, symbol: string) => void;
  onSelectTab: (view: 'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'TERMINAL' | 'OPTION_CHAIN' | 'MARKET_DEPTH' | 'PORTFOLIO' | 'SCANNER' | 'ADMIN') => void;
  userRole?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbol,
  onSelectTab,
  userRole,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isAdminUser = ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'OPERATIONS_MANAGER', 'DEALER', 'SUPPORT_AGENT'].includes(userRole || '');

  const staticInstruments = [
    { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', name: 'Nifty 50 Index', exchange: 'NSE', type: 'INDEX' },
    { token: 'BSE_SENSEX', symbol: 'SENSEX', name: 'BSE Sensex Index', exchange: 'BSE', type: 'INDEX' },
    { token: 'NSE_RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_TCS', symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_INFY', symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE', type: 'EQ' },
    { token: 'NSE_ICICIBANK', symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE', type: 'EQ' },
  ];

  const quickNav = [
    { id: 'TERMINAL', label: 'Trading Terminal', icon: LineChart, color: 'text-emerald-400' },
    { id: 'OPTION_CHAIN', label: 'Nifty Option Chain', icon: TrendingUp, color: 'text-emerald-400' },
    { id: 'MARKET_DEPTH', label: 'Level-2 Market Depth', icon: Layers, color: 'text-blue-400' },
    { id: 'PORTFOLIO', label: 'Portfolio & Risk Analytics', icon: PieChart, color: 'text-purple-400' },
    { id: 'SCANNER', label: 'Market Scanner', icon: Zap, color: 'text-yellow-400' },
    { id: 'ADMIN', label: 'Admin Control Center', icon: ShieldAlert, color: 'text-rose-400' }
  ];

  // Dynamic Options Contract Generator for NIFTY & SENSEX strike searches
  const getDynamicOptionResults = () => {
    if (!query.trim()) return [];
    const qLower = query.toLowerCase();
    const numbers = query.match(/\d+/g);

    const isNiftySearch = qLower.includes('nifty') || qLower.includes('nfo') || !qLower.includes('sensex');
    const isSensexSearch = qLower.includes('sensex') || qLower.includes('bfo') || qLower.includes('bse');

    const options: Array<{ token: string; symbol: string; name: string; exchange: string; type: string }> = [];

    if (numbers && numbers.length > 0) {
      const strike = parseInt(numbers[numbers.length - 1], 10);
      if (isNiftySearch) {
        options.push(
          { token: `NFO_NIFTY_${strike}_CE`, symbol: `NIFTY ${strike} CE`, name: `NIFTY ${strike} CALL OPTION`, exchange: 'NFO', type: 'OPT' },
          { token: `NFO_NIFTY_${strike}_PE`, symbol: `NIFTY ${strike} PE`, name: `NIFTY ${strike} PUT OPTION`, exchange: 'NFO', type: 'OPT' }
        );
      }
      if (isSensexSearch) {
        options.push(
          { token: `BFO_SENSEX_${strike}_CE`, symbol: `SENSEX ${strike} CE`, name: `SENSEX ${strike} CALL OPTION`, exchange: 'BFO', type: 'OPT' },
          { token: `BFO_SENSEX_${strike}_PE`, symbol: `SENSEX ${strike} PE`, name: `SENSEX ${strike} PUT OPTION`, exchange: 'BFO', type: 'OPT' }
        );
      }
    } else if (qLower.includes('nifty')) {
      const niftyStrikes = [24400, 24450, 24500, 24550, 24600];
      niftyStrikes.forEach(strike => {
        options.push(
          { token: `NFO_NIFTY_${strike}_CE`, symbol: `NIFTY ${strike} CE`, name: `NIFTY ${strike} CALL OPTION`, exchange: 'NFO', type: 'OPT' },
          { token: `NFO_NIFTY_${strike}_PE`, symbol: `NIFTY ${strike} PE`, name: `NIFTY ${strike} PUT OPTION`, exchange: 'NFO', type: 'OPT' }
        );
      });
    } else if (qLower.includes('sensex')) {
      const sensexStrikes = [79500, 80000, 80500];
      sensexStrikes.forEach(strike => {
        options.push(
          { token: `BFO_SENSEX_${strike}_CE`, symbol: `SENSEX ${strike} CE`, name: `SENSEX ${strike} CALL OPTION`, exchange: 'BFO', type: 'OPT' },
          { token: `BFO_SENSEX_${strike}_PE`, symbol: `SENSEX ${strike} PE`, name: `SENSEX ${strike} PUT OPTION`, exchange: 'BFO', type: 'OPT' }
        );
      });
    }

    return options.filter(o => o.symbol.toLowerCase().includes(qLower) || o.name.toLowerCase().includes(qLower));
  };

  const filteredStatic = staticInstruments.filter(i =>
    i.symbol.toLowerCase().includes(query.toLowerCase()) ||
    i.name.toLowerCase().includes(query.toLowerCase())
  );

  const dynamicOptions = getDynamicOptionResults();
  const allFiltered = [...filteredStatic, ...dynamicOptions];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-150">
        
        {/* SEARCH INPUT BAR */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search NIFTY/SENSEX options (e.g. NIFTY 24500 CE)..."
            className="w-full bg-transparent text-white placeholder-slate-500 font-sans text-sm focus:outline-none"
          />
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* RESULTS LIST */}
        <div className="max-h-96 overflow-y-auto p-2 flex flex-col gap-3">
          
          {/* QUICK NAV MODULES */}
          {query === '' && (
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1 block">Quick Navigation</span>
              <div className="grid grid-cols-2 gap-1.5">
                {quickNav.map(nav => {
                  const Icon = nav.icon;
                  return (
                    <button
                      key={nav.id}
                      onClick={() => {
                        onSelectTab(nav.id as any);
                        onClose();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-left transition border border-slate-800/80 text-xs"
                    >
                      <Icon className={`w-4 h-4 ${nav.color}`} />
                      <span className="font-semibold text-slate-200">{nav.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* INSTRUMENTS SEARCH LIST */}
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1 block">Instruments & Options</span>
            {allFiltered.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">No matching instruments or options found for "{query}".</div>
            ) : (
              <div className="flex flex-col gap-1">
                {allFiltered.map(inst => (
                  <button
                    key={inst.token}
                    onClick={() => {
                      onSelectSymbol(inst.token, inst.symbol);
                      onClose();
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 transition text-left group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-sm ${inst.symbol.includes('CE') ? 'text-emerald-400' : inst.symbol.includes('PE') ? 'text-rose-400' : 'text-slate-100'}`}>
                          {inst.symbol}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">{inst.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                        {inst.exchange}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold ${
                        inst.type === 'OPT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {inst.type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
