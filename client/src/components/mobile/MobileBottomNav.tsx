import React from 'react';
import { Home, PieChart, ArrowLeftRight, FileText, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'HOME' | 'PORTFOLIO' | 'ORDERS' | 'PROFILE';
  onSelectTab: (tab: 'HOME' | 'PORTFOLIO' | 'ORDERS' | 'PROFILE') => void;
  onOpenTradeModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenTradeModal,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-color)] px-6 h-16 flex items-center justify-between shadow-2xl">
      
      {/* Home Tab */}
      <button
        onClick={() => onSelectTab('HOME')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'HOME' ? 'text-[var(--gogrow-blue)] font-black' : 'text-slate-400 font-bold'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Home</span>
      </button>

      {/* Portfolio Tab */}
      <button
        onClick={() => onSelectTab('PORTFOLIO')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'PORTFOLIO' ? 'text-[var(--gogrow-blue)] font-black' : 'text-slate-400 font-bold'
        }`}
      >
        <PieChart className="w-5 h-5" />
        <span className="text-[10px]">Portfolio</span>
      </button>

      {/* Floating Center Double-Arrow Trade Action Button (Matching 07_preview7.png) */}
      <div className="-mt-6">
        <button
          onClick={onOpenTradeModal}
          className="w-13 h-13 rounded-full bg-[var(--gogrow-blue)] hover:bg-[var(--gogrow-blue-hover)] text-white flex items-center justify-center shadow-lg shadow-blue-500/40 active:scale-95 transition-transform"
          title="Quick Trade"
        >
          <ArrowLeftRight className="w-6 h-6" />
        </button>
      </div>

      {/* Orders Tab */}
      <button
        onClick={() => onSelectTab('ORDERS')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'ORDERS' ? 'text-[var(--gogrow-blue)] font-black' : 'text-slate-400 font-bold'
        }`}
      >
        <FileText className="w-5 h-5" />
        <span className="text-[10px]">Order</span>
      </button>

      {/* Profile Tab */}
      <button
        onClick={() => onSelectTab('PROFILE')}
        className={`flex flex-col items-center gap-1 transition-colors ${
          activeTab === 'PROFILE' ? 'text-[var(--gogrow-blue)] font-black' : 'text-slate-400 font-bold'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">Profile</span>
      </button>

    </div>
  );
};
