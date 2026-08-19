import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Sun, Moon, LogOut, ChevronRight, Wallet, Receipt, Building2, Headset, FileText, Settings, ShieldCheck, Activity, Plus } from 'lucide-react';
import { User, isStaffUser } from '../types';
import { SubView } from './GrowwSubNav';

interface GrowwHeaderProps {
  user: User;
  walletBalance: number;
  activeCategory: 'STOCKS' | 'FO' | 'MUTUAL_FUNDS' | 'COMMODITIES';
  onCategorySelect: (cat: 'STOCKS' | 'FO' | 'MUTUAL_FUNDS' | 'COMMODITIES') => void;
  onOpenSearch: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenWalletModal?: () => void;
  onNavigateView: (view: SubView) => void;
  onOpenSupport?: () => void;
  onOpenProfileModal?: (tab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'PERMISSIONS' | 'SECURITY' | 'SUPPORT' | 'APPEARANCE') => void;
}

export const GrowwHeader: React.FC<GrowwHeaderProps> = ({
  user,
  walletBalance,
  activeCategory,
  onCategorySelect,
  onOpenSearch,
  onLogout,
  theme,
  onToggleTheme,
  onOpenWalletModal,
  onNavigateView,
  onOpenSupport,
  onOpenProfileModal,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitial = (name: string) => {
    return (name || 'T').charAt(0).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-glass)] backdrop-blur-xl border-b border-[var(--border-color)] px-4 lg:px-6 h-16 flex items-center justify-between shadow-xs transition-all">
      
      {/* 1. BRAND LOGO & LIVE WS STATUS & CATEGORY TABS */}
      <div className="flex items-center gap-6">
        {/* Trade Grow — Ambient Glow Logo Badge */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => onCategorySelect('STOCKS')}
        >
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-xl blur-xs opacity-60 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative w-9 h-9 rounded-xl bg-[var(--bg-surface)] border border-emerald-500/40 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 18 L10 10 L14 14 L20 6" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 4 C18 4 22 4 22 8 C22 8 18 8 18 4Z" fill="#A7F3D0" opacity="0.9"/>
                <polyline points="16,6 20,6 20,10" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-[var(--text-main)] hidden sm:inline-block font-headline">
                Trade<span className="text-[#22C55E]">Grow</span>
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 uppercase tracking-widest hidden lg:inline-block">
                PRO
              </span>
            </div>
            <div className="flex items-center gap-1 -mt-0.5 hidden sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] text-emerald-500 font-bold font-mono tracking-wider">
                LIVE MARKET TIX
              </span>
            </div>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-color)]">
          {[
            { id: 'STOCKS', label: 'Stocks' },
            { id: 'FO', label: 'F&O' },
            { id: 'COMMODITIES', label: 'Commodities' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 2. SEARCH BAR (CENTER) */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-emerald-500/50 px-3.5 py-2 rounded-xl text-xs text-[var(--text-muted)] transition-all shadow-inner group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-500 transition-colors" />
            <span className="group-hover:text-[var(--text-main)]">Search Nifty, Stocks, F&O contracts...</span>
          </div>
          <kbd className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)] px-2 py-0.5 rounded-md font-mono">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. RIGHT ACTIONS: WALLET PILL, NOTIFICATIONS & USER AVATAR */}
      <div className="flex items-center gap-3">
        {/* Wallet Balance Pill with Direct + Deposit trigger */}
        <div 
          onClick={onOpenWalletModal}
          className="hidden sm:flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] hover:border-emerald-500/50 px-3 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs group"
          title="Click to Deposit / Withdraw Funds"
        >
          <Wallet className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-[var(--text-muted)] font-medium leading-none">Available Margin</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 num-font leading-tight">
              ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button className="ml-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white text-[10px] font-extrabold flex items-center gap-0.5 transition-colors cursor-pointer">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-[var(--text-muted)] hover:text-emerald-500 rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Theme Mode Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs"
          title="Toggle Light / Dark Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          <span className="hidden xl:inline text-xs">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {/* Admin Control Center Button (for Staff/Admin accounts) */}
        {isStaffUser(user?.role) && (
          <button
            onClick={() => onNavigateView('ADMIN')}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center gap-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Open Admin Control Center"
          >
            <ShieldCheck className="w-4 h-4 text-rose-500" />
            <span className="hidden md:inline">Admin Panel</span>
          </button>
        )}

        {/* Notification Bell with Badge */}
        <div className="relative cursor-pointer p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] rounded-xl transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-extrabold text-[9px] flex items-center justify-center animate-pulse">
            3
          </span>
        </div>

        {/* User Profile Button */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center shadow-md shadow-emerald-900/30 border border-emerald-400/30 transition-transform active:scale-95 cursor-pointer"
            title="Account & Profile"
          >
            {getInitial(user.username)}
          </button>

          {/* GROWW PROFILE DROPDOWN MENU */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-[var(--bg-surface)] backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* User Identity Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                <div>
                  <h4 className="font-bold text-sm text-[var(--text-main)] capitalize">
                    {user.username || 'Trader Account'}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] font-medium">
                    {user.email || 'trader@tradegrow.sim'}
                  </p>
                </div>
                <button
                  onClick={() => { setIsProfileOpen(false); onNavigateView('ADMIN'); }}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-emerald-500 hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
                  title="Admin Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* Wallet Balance Card inside Profile Menu */}
              <div
                onClick={() => { setIsProfileOpen(false); if (onOpenWalletModal) onOpenWalletModal(); }}
                className="mt-3 p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-emerald-500/50 cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--text-main)] num-font">
                      ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      Trading Margin Balance
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Menu Links List */}
              <div className="mt-3 space-y-1 text-xs font-bold border-b border-[var(--border-color)] pb-3">
                {/* 1. MY PROFILE */}
                <button
                  onClick={() => { setIsProfileOpen(false); onOpenProfileModal?.('PROFILE'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <span>My Profile & Account</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                </button>

                {/* 2. KYC VERIFICATION */}
                <button
                  onClick={() => { setIsProfileOpen(false); onOpenProfileModal?.('KYC'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <div>KYC & Documents</div>
                      <div className="text-[10px] text-emerald-500 font-medium">PAN • Aadhaar • Bank</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">
                    Verify
                  </span>
                </button>

                {/* 3. ORDERS */}
                <button
                  onClick={() => { setIsProfileOpen(false); onNavigateView('ORDERS'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] flex items-center justify-center">
                      <Receipt className="w-3.5 h-3.5" />
                    </div>
                    <span>Orders & Trade History</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                </button>

                {/* 4. BANK & FUNDS */}
                <button
                  onClick={() => { setIsProfileOpen(false); onOpenProfileModal?.('FUNDS'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <span>Bank & Deposit Methods</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                </button>

                {/* 5. 2FA & SECURITY */}
                <button
                  onClick={() => { setIsProfileOpen(false); onOpenProfileModal?.('SECURITY'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <span>Security & 2FA / Password</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                </button>

                {/* 6. SUPPORT */}
                <button
                  onClick={() => { setIsProfileOpen(false); if (onOpenSupport) onOpenSupport(); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                      <Headset className="w-3.5 h-3.5" />
                    </div>
                    <span>24x7 Trade Support</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-500 transition-transform group-hover:translate-x-0.5" />
                </button>

                {/* 7. APPEARANCE & LITE MODE */}
                <button
                  onClick={() => { setIsProfileOpen(false); onOpenProfileModal?.('APPEARANCE'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                      {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
                    </div>
                    <div className="text-left">
                      <div>Appearance & Lite Mode</div>
                      <div className="text-[10px] text-[var(--text-muted)] font-medium">Lite Mode & Dark Theme</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                    theme === 'light'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30'
                  }`}>
                    {theme === 'light' ? 'LITE' : 'DARK'}
                  </span>
                </button>

                {isStaffUser(user?.role) && (
                  <button
                    onClick={() => { setIsProfileOpen(false); onNavigateView('ADMIN'); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors font-bold cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-4 h-4 text-rose-500" />
                      <span>Admin Control Panel</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase">
                      {user.role}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => { setIsProfileOpen(false); onNavigateView('ANALYTICS'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>Portfolio Analytics</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                    PRO
                  </span>
                </button>
              </div>

              {/* Theme & Logout Footer */}
              <div className="mt-3 flex items-center justify-between text-xs font-bold pt-1">
                <button
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[var(--text-muted)]" />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                <button
                  onClick={() => { setIsProfileOpen(false); onLogout(); }}
                  className="flex items-center gap-1.5 p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

    </header>

  );
};
