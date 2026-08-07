import React from 'react';
import { ChevronDown, ArrowUpRight, TrendingUp } from 'lucide-react';

interface GrowwHoldingsViewProps {
  onExploreStocks: () => void;
}

export const GrowwHoldingsView: React.FC<GrowwHoldingsViewProps> = ({ onExploreStocks }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
      
      {/* LEFT COLUMN: HOLDINGS & TRACKER (MATCHING IMAGE 2) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* 1. HOLDINGS SUMMARY CARD */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xs">
          
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
            <span>HOLDINGS (0)</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>

          <div className="text-3xl font-black text-[var(--text-main)] num-font mb-6">
            ₹0
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--border-light)] text-xs num-font">
            <div>
              <div className="text-slate-400 font-bold mb-1">Invested value</div>
              <div className="font-black text-sm text-[var(--text-main)]">₹0</div>
            </div>

            <div>
              <div className="text-slate-400 font-bold mb-1">1D returns</div>
              <div className="font-black text-sm text-slate-600 dark:text-slate-300">₹0.00 (0.00%)</div>
            </div>

            <div>
              <div className="text-slate-400 font-bold mb-1">Total returns</div>
              <div className="font-black text-sm text-slate-600 dark:text-slate-300">₹0.00 (0.00%)</div>
            </div>
          </div>

        </div>

        {/* 2. TRACK EXTERNAL STOCKS CARD */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <h4 className="font-extrabold text-sm text-[var(--text-main)] mb-1">
              Track external stocks
            </h4>
            <p className="text-xs text-slate-400 font-medium max-w-md">
              Easily import your stocks from other platforms to Groww. Track, manage, and invest, all in one app
            </p>
          </div>

          <button className="px-5 py-2 rounded-xl bg-teal-500/10 text-[var(--groww-green)] font-extrabold text-xs hover:bg-teal-500/20 transition-colors">
            Track
          </button>
        </div>

      </div>

      {/* RIGHT COLUMN: INVESTING JOURNEY BANNER (MATCHING IMAGE 2) */}
      <div className="lg:col-span-4">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-8 rounded-2xl shadow-xs flex flex-col items-center justify-center text-center h-full min-h-[340px]">
          
          {/* Isometric Building Illustration */}
          <div className="w-48 h-36 mb-6">
            <svg viewBox="0 0 200 150" className="w-full h-full">
              <polygon points="100,20 160,50 100,80 40,50" fill="#00d09c" opacity="0.3"/>
              <polygon points="40,50 100,80 100,140 40,110" fill="#00b887"/>
              <polygon points="100,80 160,50 160,110 100,140" fill="#e6fbf5"/>
              <rect x="75" y="45" width="50" height="70" fill="#ffffff" rx="4" opacity="0.9"/>
              <line x1="85" y1="55" x2="115" y2="55" stroke="#00d09c" strokeWidth="2"/>
              <line x1="85" y1="70" x2="115" y2="70" stroke="#00d09c" strokeWidth="2"/>
              <line x1="85" y1="85" x2="115" y2="85" stroke="#00d09c" strokeWidth="2"/>
            </svg>
          </div>

          <h4 className="font-extrabold text-base text-[var(--text-main)] mb-6">
            Your investing journey begins here
          </h4>

          <button
            onClick={onExploreStocks}
            className="w-full py-3 rounded-xl bg-[var(--groww-green)] hover:bg-[var(--groww-green-hover)] text-white font-extrabold text-sm shadow-md shadow-emerald-500/20 transition-transform active:scale-98"
          >
            Explore stocks
          </button>

        </div>
      </div>

    </div>
  );
};
