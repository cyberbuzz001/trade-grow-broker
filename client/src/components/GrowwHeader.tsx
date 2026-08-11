import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Sun, Moon, LogOut, ChevronRight, Wallet, Receipt, Building2, Headset, FileText, Settings, ShieldCheck } from 'lucide-react';
import { User } from '../types';
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
    return (name || 'S').charAt(0).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-4 lg:px-8 h-16 flex items-center justify-between shadow-xs">
      
      {/* 1. BRAND LOGO & CATEGORY TABS */}
      <div className="flex items-center gap-8">
        {/* Trade Grow — Trending Arrow + Sprout Logo */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => onCategorySelect('STOCKS')}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            {/* Trade Grow Logo: Upward arrow with sprout leaf */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Upward trending arrow */}
              <path d="M4 18 L10 10 L14 14 L20 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Sprout/leaf on the arrow peak */}
              <path d="M18 4 C18 4 22 4 22 8 C22 8 18 8 18 4Z" fill="#A7F3D0" opacity="0.9"/>
              {/* Arrow head */}
              <polyline points="16,6 20,6 20,10" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-[var(--text-main)] hidden sm:inline-block font-headline">
              Trade<span className="text-[#00E676]">Grow</span>
            </span>
            <span className="text-[10px] text-[#00E676] font-bold -mt-1 hidden sm:inline-block font-mono">
              SMART TRADING PLATFORM
            </span>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1">
          {[
            { id: 'STOCKS', label: 'Stocks' },
            { id: 'FO', label: 'F&O' },
            { id: 'COMMODITIES', label: 'Commodities' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategorySelect(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeCategory === cat.id
                  ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 2. SEARCH BAR (CENTER) */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-teal-500 px-4 py-2 rounded-xl text-xs text-slate-400 transition-all shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search Trade Grow...</span>
          </div>
          <kbd className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] font-bold text-slate-400 px-2 py-0.5 rounded-md font-mono">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. RIGHT ACTIONS: NOTIFICATIONS & USER AVATAR */}
      <div className="flex items-center gap-4">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-[var(--groww-green)]"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Theme Mode Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--groww-green)] transition-colors rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center gap-1.5 text-xs font-bold"
          title="Toggle Light / Dark Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          <span className="hidden sm:inline text-xs">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {/* Notification Bell with Badge */}
        <div className="relative cursor-pointer p-2 text-slate-600 dark:text-slate-300 hover:text-[var(--groww-green)] transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-extrabold text-[9px] flex items-center justify-center">
            5
          </span>
        </div>

        {/* User Profile Button */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center shadow-sm shadow-emerald-600/30 transition-transform active:scale-95"
            title="Account & Profile"
          >
            {getInitial(user.username)}
          </button>

          {/* GROWW PROFILE DROPDOWN MENU (MATCHING IMAGE 3) */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* User Identity Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-light)]">
                <div>
                  <h4 className="font-extrabold text-sm text-[var(--text-main)] capitalize">
                    {user.username || 'Surbhi Prajapati'}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] font-medium">
                    {user.email || 'user@broker.sim'}
                  </p>
                </div>
                <button
                  onClick={() => { setIsProfileOpen(false); onNavigateView('ADMIN'); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--groww-green)] hover:bg-[var(--bg-surface-elevated)]"
                  title="Admin Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              {/* Wallet Balance Card */}
              <div
                onClick={() => { setIsProfileOpen(false); if (onOpenWalletModal) onOpenWalletModal(); }}
                className="mt-3 p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--groww-green)] cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--groww-green-light)] text-[var(--groww-green)] flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-sm text-[var(--text-main)] num-font">
                      ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                      Stocks, F&O Balance
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[var(--groww-green)] transition-transform group-hover:translate-x-0.5" />
              </div>

              {/* Menu Links List */}
              <div className="mt-3 space-y-1 text-xs font-bold border-b border-[var(--border-light)] pb-3">
                <button
                  onClick={() => { setIsProfileOpen(false); onNavigateView('ORDERS'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="w-4 h-4 text-slate-400" />
                    <span>All Orders</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => { setIsProfileOpen(false); onNavigateView('HOLDINGS'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Bank Details</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => { setIsProfileOpen(false); if (onOpenSupport) onOpenSupport(); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Headset className="w-4 h-4 text-teal-500" />
                    <span>24 x 7 Customer Support</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'OPERATIONS_MANAGER', 'DEALER', 'SUPPORT_AGENT'].includes(user?.role || '') && (
                  <button
                    onClick={() => { setIsProfileOpen(false); onNavigateView('ADMIN'); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors font-bold"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-4 h-4 text-rose-500" />
                      <span>Admin Control Center</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase">
                      {user.role}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => { setIsProfileOpen(false); onNavigateView('HOLDINGS'); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>Reports & Holdings</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-[var(--groww-green)] text-[10px] font-black">
                    Tax Reports
                  </span>
                </button>
              </div>

              {/* Theme & Logout Footer */}
              <div className="mt-3 flex items-center justify-between text-xs font-bold pt-1">
                <button
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 p-2 rounded-xl text-slate-500 hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                <button
                  onClick={() => { setIsProfileOpen(false); onLogout(); }}
                  className="flex items-center gap-1.5 p-2 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="underline underline-offset-2">Log out</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

    </header>
  );
};
