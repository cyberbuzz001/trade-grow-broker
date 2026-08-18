import React from 'react';
import { Home, Bookmark, Briefcase, Layers, ShieldCheck, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'HOME' | 'PORTFOLIO' | 'POSITIONS' | 'WATCHLIST' | 'ORDERS' | 'OPTION_CHAIN' | 'ADMIN' | 'PROFILE';
  onSelectTab: (tab: 'HOME' | 'PORTFOLIO' | 'POSITIONS' | 'WATCHLIST' | 'ORDERS' | 'OPTION_CHAIN' | 'ADMIN' | 'PROFILE') => void;
  isAdmin?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  isAdmin = false,
}) => {
  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)]/95 backdrop-blur-2xl border-t border-[var(--border-color)] px-1.5 h-15 flex items-center justify-around shadow-lg pb-[env(safe-area-inset-bottom,4px)]"
    >
      
      {/* Home Tab */}
      <button
        type="button"
        onClick={() => {
          navigator.vibrate?.(15);
          onSelectTab('HOME');
        }}
        className={`flex flex-col items-center justify-center gap-0.5 transition-all min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'HOME' 
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
            : 'text-[var(--text-muted)] font-semibold hover:text-[var(--text-main)]'
        }`}
      >
        <div className={`p-1 rounded-lg transition-colors ${activeTab === 'HOME' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : ''}`}>
          <Home className="w-4.5 h-4.5" />
        </div>
        <span className="text-[10px] tracking-tight">Home</span>
      </button>

      {/* Watchlist Tab */}
      <button
        type="button"
        onClick={() => {
          navigator.vibrate?.(15);
          onSelectTab('WATCHLIST');
        }}
        className={`flex flex-col items-center justify-center gap-0.5 transition-all min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'WATCHLIST' 
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
            : 'text-[var(--text-muted)] font-semibold hover:text-[var(--text-main)]'
        }`}
      >
        <div className={`p-1 rounded-lg transition-colors ${activeTab === 'WATCHLIST' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : ''}`}>
          <Bookmark className="w-4.5 h-4.5" />
        </div>
        <span className="text-[10px] tracking-tight">Watchlist</span>
      </button>

      {/* Option Chain Tab */}
      <button
        type="button"
        onClick={() => {
          navigator.vibrate?.(15);
          onSelectTab('OPTION_CHAIN');
        }}
        className={`flex flex-col items-center justify-center gap-0.5 transition-all min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'OPTION_CHAIN' 
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
            : 'text-[var(--text-muted)] font-semibold hover:text-[var(--text-main)]'
        }`}
      >
        <div className={`p-1 rounded-lg transition-colors ${activeTab === 'OPTION_CHAIN' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : ''}`}>
          <Layers className="w-4.5 h-4.5" />
        </div>
        <span className="text-[10px] tracking-tight">Options</span>
      </button>

      {/* Positions Tab */}
      <button
        type="button"
        onClick={() => {
          navigator.vibrate?.(15);
          onSelectTab('POSITIONS');
        }}
        className={`flex flex-col items-center justify-center gap-0.5 transition-all min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'POSITIONS' 
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
            : 'text-[var(--text-muted)] font-semibold hover:text-[var(--text-main)]'
        }`}
      >
        <div className={`p-1 rounded-lg transition-colors ${activeTab === 'POSITIONS' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : ''}`}>
          <Briefcase className="w-4.5 h-4.5" />
        </div>
        <span className="text-[10px] tracking-tight">Positions</span>
      </button>

      {/* Admin Tab (For Admin Staff) */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(15);
            onSelectTab('ADMIN');
          }}
          className={`flex flex-col items-center justify-center gap-0.5 transition-all min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 cursor-pointer ${
            activeTab === 'ADMIN' 
              ? 'text-rose-600 dark:text-rose-400 font-extrabold' 
              : 'text-[var(--text-muted)] font-semibold hover:text-[var(--text-main)]'
          }`}
        >
          <div className={`p-1 rounded-lg transition-colors ${activeTab === 'ADMIN' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : ''}`}>
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <span className="text-[10px] tracking-tight">Admin</span>
        </button>
      )}

      {/* Profile Tab */}
      <button
        type="button"
        onClick={() => {
          navigator.vibrate?.(15);
          onSelectTab('PROFILE');
        }}
        className={`flex flex-col items-center justify-center gap-0.5 transition-all min-h-[44px] min-w-[44px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'PROFILE' 
            ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
            : 'text-[var(--text-muted)] font-semibold hover:text-[var(--text-main)]'
        }`}
      >
        <div className={`p-1 rounded-lg transition-colors ${activeTab === 'PROFILE' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : ''}`}>
          <User className="w-4.5 h-4.5" />
        </div>
        <span className="text-[10px] tracking-tight">Profile</span>
      </button>

    </nav>
  );
};

