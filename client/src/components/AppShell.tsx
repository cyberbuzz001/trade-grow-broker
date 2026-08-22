import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass, Bookmark, Layers, Briefcase, User as UserIcon, ShieldCheck,
  Search, Wallet, Plus, Sun, Moon, Bell, LogOut, SlidersHorizontal,
} from 'lucide-react';
import { User, MarketTick, isStaffUser } from '../types';
import { IndexActionModal } from './IndexActionModal';
import { Badge } from './ui/Badge';

export interface AppShellNavItem {
  path: string;
  matchPrefix: string;
  label: string;
  icon: React.ReactNode;
}

export interface AppShellProps {
  user: User;
  walletBalance: number;
  ticks: Map<string, MarketTick>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onOpenWalletModal: () => void;
  onLogout: () => void;
  /** Desktop-only utility toggle, kept out of the 5 primary nav items per .design/client-panel-redesign/TASKS.md. */
  isTerminalMode?: boolean;
  onToggleTerminal?: () => void;
}

const NAV_ITEMS: AppShellNavItem[] = [
  { path: '/', matchPrefix: '/', label: 'Explore', icon: <Compass className="w-[18px] h-[18px]" /> },
  { path: '/watchlist', matchPrefix: '/watchlist', label: 'Watchlist', icon: <Bookmark className="w-[18px] h-[18px]" /> },
  { path: '/option-chain', matchPrefix: '/option-chain', label: 'Option Chain', icon: <Layers className="w-[18px] h-[18px]" /> },
  { path: '/portfolio/positions', matchPrefix: '/portfolio', label: 'Portfolio', icon: <Briefcase className="w-[18px] h-[18px]" /> },
  { path: '/profile/account', matchPrefix: '/profile', label: 'Profile', icon: <UserIcon className="w-[18px] h-[18px]" /> },
];

function isActive(pathname: string, item: AppShellNavItem): boolean {
  if (item.matchPrefix === '/') return pathname === '/';
  return pathname.startsWith(item.matchPrefix);
}

/**
 * One responsive shell for the whole client panel: a top nav bar on desktop
 * (matching the Groww/Zerodha/Upstox reference — corrected mid-build from an
 * earlier left-rail plan in INFORMATION_ARCHITECTURE.md that didn't actually
 * match any of the three named references), a bottom tab bar on mobile.
 * Replaces GrowwHeader + GrowwSubNav + mobile/MobileBottomNav (all three
 * deleted in the dead-code-removal task once this shell was confirmed live).
 */
export function AppShell({
  user,
  walletBalance,
  ticks,
  theme,
  onToggleTheme,
  onOpenSearch,
  onOpenWalletModal,
  onLogout,
  isTerminalMode = false,
  onToggleTerminal,
}: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [selectedIndexModal, setSelectedIndexModal] = useState<{ symbol: string; token: string; exchange: string } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const isStaff = isStaffUser(user?.role);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNifty = () => ticks?.get('NSE_NIFTY50') || ticks?.get('NIFTY50') || ticks?.get('NIFTY 50');
  const getSensex = () => ticks?.get('BSE_SENSEX') || ticks?.get('SENSEX');
  const getBankNifty = () => ticks?.get('NSE_BANKNIFTY') || ticks?.get('NIFTY BANK') || ticks?.get('BANKNIFTY');
  const getFinNifty = () => ticks?.get('NSE_FINNIFTY') || ticks?.get('FINNIFTY');
  const formatChange = (tick?: MarketTick, fallbackChange = 0, fallbackPct = 0) => {
    const chg = tick ? tick.change : fallbackChange;
    const pct = tick ? tick.changePercent : fallbackPct;
    const isPos = chg >= 0;
    return { text: `${isPos ? '+' : ''}${chg.toFixed(2)} (${isPos ? '+' : ''}${pct.toFixed(2)}%)`, isPos };
  };
  const indices = [
    { label: 'NIFTY 50', token: 'NSE_NIFTY50', exchange: 'NSE', tick: getNifty(), fallback: 24856.15, fbChg: 104.35, fbPct: 0.42 },
    { label: 'SENSEX', token: 'BSE_SENSEX', exchange: 'BSE', tick: getSensex(), fallback: 81254.30, fbChg: 308.26, fbPct: 0.38 },
    { label: 'BANK NIFTY', token: 'NSE_BANKNIFTY', exchange: 'NSE', tick: getBankNifty(), fallback: 52150.75, fbChg: -78.40, fbPct: -0.15 },
    { label: 'FIN NIFTY', token: 'NSE_FINNIFTY', exchange: 'NSE', tick: getFinNifty(), fallback: 23890.40, fbChg: 52.10, fbPct: 0.22 },
  ];

  return (
    <>
      {/* ── DESKTOP TOP BAR ─────────────────────────────────────────────── */}
      <header className="hidden md:flex sticky top-0 z-40 bg-[var(--bg-glass)] backdrop-blur-xl border-b border-[var(--border-color)] px-4 lg:px-6 h-16 items-center justify-between gap-3 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-3 lg:gap-5 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-xl blur-xs opacity-60 group-hover:opacity-100 transition duration-[var(--duration-slow)]" />
              <div className="relative w-9 h-9 rounded-xl bg-[var(--bg-surface)] border border-emerald-500/40 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-[var(--duration-fast)]">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 18 L10 10 L14 14 L20 6" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="16,6 20,6 20,10" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <span className="font-headline font-extrabold text-xl tracking-tight text-[var(--text-main)]">
              Trade<span className="text-[#22C55E]">Grow</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 flex-shrink-0" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = isActive(location.pathname, item) && !isTerminalMode;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-[var(--duration-fast)] ${
                    active
                      ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
                  }`}
                >
                  {item.icon}
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
            {onToggleTerminal && (
              <button
                onClick={onToggleTerminal}
                className={`ml-1 flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-[var(--duration-fast)] border ${
                  isTerminalMode
                    ? 'bg-[var(--primary)] text-white border-transparent shadow-sm'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                }`}
                title="Pro Terminal Workspace"
                aria-label="Toggle Pro Terminal workspace"
              >
                <SlidersHorizontal className="w-[18px] h-[18px]" />
                <span className="hidden 2xl:inline">Terminal</span>
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onOpenSearch}
            className="hidden 2xl:flex items-center gap-2 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--primary)]/40 px-3 py-2 rounded-xl text-xs text-[var(--text-muted)] transition-colors w-36"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Search...</span>
            <kbd className="ml-auto bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0">⌘K</kbd>
          </button>
          <button onClick={onOpenSearch} aria-label="Search" className="2xl:hidden p-2 text-[var(--text-muted)] hover:text-[var(--primary)] rounded-xl">
            <Search className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenWalletModal}
            className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-[var(--primary)]/40 px-2.5 py-1.5 rounded-xl transition-colors flex-shrink-0"
            title="Deposit / withdraw funds"
          >
            <Wallet className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-[10px] text-[var(--text-muted)] leading-none whitespace-nowrap">Available Margin</span>
              <span className="text-xs font-bold text-[var(--primary)] num-font leading-tight whitespace-nowrap">
                ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <span className="lg:hidden text-xs font-bold text-[var(--primary)] num-font whitespace-nowrap">
              ₹{walletBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <Plus className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0" />
          </button>

          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {isStaff && (
            <Link
              to="/admin"
              className="px-3 py-1.5 rounded-xl bg-[var(--loss-light)] text-[var(--loss)] border border-[var(--loss)]/30 flex items-center gap-1.5 text-xs font-bold"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden 2xl:inline">Admin</span>
            </Link>
          )}

          <div className="relative p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] rounded-xl transition-colors">
            <Bell className="w-5 h-5" />
          </div>

          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-haspopup="true"
              aria-expanded={isProfileMenuOpen}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center"
            >
              {(user.username || 'T').charAt(0).toUpperCase()}
            </button>
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-[var(--shadow-xl)] p-3 z-50">
                <div className="pb-3 border-b border-[var(--border-color)]">
                  <p className="font-bold text-sm text-[var(--text-main)] capitalize">{user.username || 'Trader Account'}</p>
                  <p className="text-xs text-[var(--text-muted)]">{user.email || 'trader@tradegrow.sim'}</p>
                </div>
                <div className="py-2 space-y-1">
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); navigate('/profile/account'); }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]"
                  >
                    Profile & KYC
                  </button>
                </div>
                <div className="pt-2 border-t border-[var(--border-color)]">
                  <button
                    onClick={() => { setIsProfileMenuOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-[var(--loss)] hover:bg-[var(--loss-light)]"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── DESKTOP TICKER STRIP ────────────────────────────────────────── */}
      <div className="hidden md:flex items-center gap-6 overflow-x-auto scrollbar-none px-6 py-1.5 border-b border-[var(--border-color)] bg-[var(--bg-surface)] font-mono text-xs tabular-nums">
        {indices.map((idx) => {
          const chg = formatChange(idx.tick, idx.fbChg, idx.fbPct);
          return (
            <button
              key={idx.token}
              onClick={() => setSelectedIndexModal({ symbol: idx.label, token: idx.token, exchange: idx.exchange })}
              className="flex items-center gap-2 flex-shrink-0 hover:bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded-lg transition-colors"
            >
              <span className="font-bold text-[var(--text-muted)] text-[11px]">{idx.label}</span>
              <span className="font-bold text-[var(--text-main)]">{(idx.tick ? idx.tick.ltp : idx.fallback).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <Badge variant={chg.isPos ? 'gain' : 'loss'}>{chg.text}</Badge>
            </button>
          );
        })}
      </div>

      {selectedIndexModal && (
        <IndexActionModal
          isOpen={Boolean(selectedIndexModal)}
          onClose={() => setSelectedIndexModal(null)}
          indexSymbol={selectedIndexModal.symbol}
          token={selectedIndexModal.token}
          exchange={selectedIndexModal.exchange}
          latestTick={ticks.get(selectedIndexModal.token)}
          onOpenChart={(symbol, token) => { setSelectedIndexModal(null); navigate(`/terminal?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`); }}
          onOpenOptionChain={() => { setSelectedIndexModal(null); navigate('/option-chain'); }}
        />
      )}

      {/* ── MOBILE BOTTOM TAB BAR ───────────────────────────────────────── */}
      <nav
        aria-label="Primary"
        className="md:hidden mobile-nav-glass fixed bottom-0 left-0 right-0 z-50 px-1.5 h-15 flex items-center justify-around pb-[env(safe-area-inset-bottom,4px)]"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(location.pathname, item);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => navigator.vibrate?.(15)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 transition-colors ${
                active ? 'text-[var(--primary)] font-extrabold' : 'text-[var(--text-muted)] font-semibold'
              }`}
            >
              <div className={active ? 'p-1 rounded-lg bg-[var(--primary-light)] nav-icon-active' : 'p-1'}>{item.icon}</div>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
        {isStaff && (
          <Link
            to="/admin"
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 transition-colors ${
              location.pathname.startsWith('/admin') ? 'text-[var(--loss)] font-extrabold' : 'text-[var(--text-muted)] font-semibold'
            }`}
          >
            <ShieldCheck className="w-[18px] h-[18px]" />
            <span className="text-[10px]">Admin</span>
          </Link>
        )}
      </nav>
    </>
  );
}
