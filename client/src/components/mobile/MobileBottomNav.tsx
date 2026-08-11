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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-color)] px-2 h-16 flex items-center justify-around shadow-2xl backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
      
      {/* Home Tab */}
      <button
        onClick={() => onSelectTab('HOME')}
        className={`flex flex-col items-center gap-1 transition-colors touch-target px-2 ${
          activeTab === 'HOME' ? 'text-indigo-500 font-black scale-105' : 'text-[var(--text-tertiary)] font-bold hover:text-[var(--text-main)]'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Home</span>
      </button>

      {/* Watchlist Tab */}
      <button
        onClick={() => onSelectTab('WATCHLIST')}
        className={`flex flex-col items-center gap-1 transition-colors touch-target px-2 ${
          activeTab === 'WATCHLIST' ? 'text-indigo-500 font-black scale-105' : 'text-[var(--text-tertiary)] font-bold hover:text-[var(--text-main)]'
        }`}
      >
        <Bookmark className="w-5 h-5" />
        <span className="text-[10px]">Watchlist</span>
      </button>

      {/* Option Chain Tab */}
      <button
        onClick={() => onSelectTab('OPTION_CHAIN')}
        className={`flex flex-col items-center gap-1 transition-colors touch-target px-2 ${
          activeTab === 'OPTION_CHAIN' ? 'text-indigo-500 font-black scale-105' : 'text-[var(--text-tertiary)] font-bold hover:text-[var(--text-main)]'
        }`}
      >
        <Layers className="w-5 h-5" />
        <span className="text-[10px]">Option Chain</span>
      </button>

      {/* Positions Tab */}
      <button
        onClick={() => onSelectTab('POSITIONS')}
        className={`flex flex-col items-center gap-1 transition-colors touch-target px-2 ${
          activeTab === 'POSITIONS' ? 'text-indigo-500 font-black scale-105' : 'text-[var(--text-tertiary)] font-bold hover:text-[var(--text-main)]'
        }`}
      >
        <Briefcase className="w-5 h-5" />
        <span className="text-[10px]">Positions</span>
      </button>

      {/* Admin Tab (Only for Admin Roles) */}
      {isAdmin && (
        <button
          onClick={() => onSelectTab('ADMIN')}
          className={`flex flex-col items-center gap-1 transition-colors touch-target px-2 ${
            activeTab === 'ADMIN' ? 'text-amber-500 font-black scale-105' : 'text-[var(--text-tertiary)] font-bold hover:text-[var(--text-main)]'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[10px]">Admin</span>
        </button>
      )}

      {/* Profile Tab */}
      <button
        onClick={() => onSelectTab('PROFILE')}
        className={`flex flex-col items-center gap-1 transition-colors touch-target px-2 ${
          activeTab === 'PROFILE' ? 'text-indigo-500 font-black scale-105' : 'text-[var(--text-tertiary)] font-bold hover:text-[var(--text-main)]'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">Profile</span>
      </button>

    </div>
  );
};
