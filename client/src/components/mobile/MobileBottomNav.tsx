import React from 'react';
import { Home, PieChart, Briefcase, FileText, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'HOME' | 'PORTFOLIO' | 'POSITIONS' | 'ORDERS' | 'PROFILE';
  onSelectTab: (tab: 'HOME' | 'PORTFOLIO' | 'POSITIONS' | 'ORDERS' | 'PROFILE') => void;
  onOpenTradeModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-color)] px-4 h-16 flex items-center justify-between shadow-2xl backdrop-blur-md">
      
      {/* Home Tab */}
      <button
        onClick={() => onSelectTab('HOME')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'HOME' ? 'text-[var(--gogrow-blue)] font-black scale-105' : 'text-slate-400 font-bold hover:text-slate-200'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Home</span>
      </button>

      {/* Portfolio Tab */}
      <button
        onClick={() => onSelectTab('PORTFOLIO')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'PORTFOLIO' ? 'text-[var(--gogrow-blue)] font-black scale-105' : 'text-slate-400 font-bold hover:text-slate-200'
        }`}
      >
        <PieChart className="w-5 h-5" />
        <span className="text-[10px]">Portfolio</span>
      </button>

      {/* Positions Tab (Renders Right After Portfolio as requested) */}
      <button
        onClick={() => onSelectTab('POSITIONS')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'POSITIONS' ? 'text-[var(--gogrow-blue)] font-black scale-105' : 'text-slate-400 font-bold hover:text-slate-200'
        }`}
      >
        <Briefcase className="w-5 h-5" />
        <span className="text-[10px]">Positions</span>
      </button>

      {/* Orders Tab */}
      <button
        onClick={() => onSelectTab('ORDERS')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'ORDERS' ? 'text-[var(--gogrow-blue)] font-black scale-105' : 'text-slate-400 font-bold hover:text-slate-200'
        }`}
      >
        <FileText className="w-5 h-5" />
        <span className="text-[10px]">Orders</span>
      </button>

      {/* Profile Tab */}
      <button
        onClick={() => onSelectTab('PROFILE')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'PROFILE' ? 'text-[var(--gogrow-blue)] font-black scale-105' : 'text-slate-400 font-bold hover:text-slate-200'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">Profile</span>
      </button>

    </div>
  );
};
