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
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/80 px-2 h-16 flex items-center justify-around shadow-2xl pb-[env(safe-area-inset-bottom,8px)]"
    >
      
      {/* Home Tab */}
      <button
        type="button"
        onClick={() => onSelectTab('HOME')}
        className={`flex flex-col items-center justify-center gap-1 transition-all min-h-[48px] min-w-[48px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'HOME' 
            ? 'text-emerald-400 font-extrabold shadow-sm' 
            : 'text-slate-400 font-semibold hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'HOME' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}>
          <Home className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight">Home</span>
      </button>

      {/* Watchlist Tab */}
      <button
        type="button"
        onClick={() => onSelectTab('WATCHLIST')}
        className={`flex flex-col items-center justify-center gap-1 transition-all min-h-[48px] min-w-[48px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'WATCHLIST' 
            ? 'text-emerald-400 font-extrabold shadow-sm' 
            : 'text-slate-400 font-semibold hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'WATCHLIST' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}>
          <Bookmark className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight">Watchlist</span>
      </button>

      {/* Option Chain Tab */}
      <button
        type="button"
        onClick={() => onSelectTab('OPTION_CHAIN')}
        className={`flex flex-col items-center justify-center gap-1 transition-all min-h-[48px] min-w-[48px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'OPTION_CHAIN' 
            ? 'text-emerald-400 font-extrabold shadow-sm' 
            : 'text-slate-400 font-semibold hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'OPTION_CHAIN' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}>
          <Layers className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight">Options</span>
      </button>

      {/* Positions Tab */}
      <button
        type="button"
        onClick={() => onSelectTab('POSITIONS')}
        className={`flex flex-col items-center justify-center gap-1 transition-all min-h-[48px] min-w-[48px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'POSITIONS' 
            ? 'text-emerald-400 font-extrabold shadow-sm' 
            : 'text-slate-400 font-semibold hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'POSITIONS' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}>
          <Briefcase className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight">Positions</span>
      </button>

      {/* Admin Tab (For Admin Staff) */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => onSelectTab('ADMIN')}
          className={`flex flex-col items-center justify-center gap-1 transition-all min-h-[48px] min-w-[48px] px-2 rounded-xl active:scale-95 cursor-pointer ${
            activeTab === 'ADMIN' 
              ? 'text-rose-400 font-extrabold shadow-sm' 
              : 'text-slate-400 font-semibold hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'ADMIN' ? 'bg-rose-500/20 text-rose-400' : ''}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Admin</span>
        </button>
      )}

      {/* Profile Tab */}
      <button
        type="button"
        onClick={() => onSelectTab('PROFILE')}
        className={`flex flex-col items-center justify-center gap-1 transition-all min-h-[48px] min-w-[48px] px-2 rounded-xl active:scale-95 cursor-pointer ${
          activeTab === 'PROFILE' 
            ? 'text-emerald-400 font-extrabold shadow-sm' 
            : 'text-slate-400 font-semibold hover:text-white'
        }`}
      >
        <div className={`p-1 rounded-lg ${activeTab === 'PROFILE' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}>
          <User className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight">Profile</span>
      </button>

    </nav>
  );
};
