import React from 'react';
import { ChevronLeft, Gift, CreditCard, Languages, Settings, HelpCircle, Headset, ChevronRight, LogOut } from 'lucide-react';
import { User } from '../../types';

interface MobileProfileViewProps {
  user: User;
  onBack: () => void;
  onLogout: () => void;
}

export const MobileProfileView: React.FC<MobileProfileViewProps> = ({
  user,
  onBack,
  onLogout,
}) => {
  return (
    <div className="pb-24 pt-4 px-5 space-y-6">
      
      {/* 1. TOP HEADER (MATCHING 19_PREVIEW19.PNG) */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-slate-600 dark:text-slate-300"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Profile
        </h2>

        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* 2. USER PROFILE HEADER CARD (MATCHING 19_PREVIEW19.PNG) */}
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            {user.username ? user.username.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <h3 className="font-black text-lg text-[var(--text-main)] capitalize">
              {user.username || 'Sunder Pichai'}
            </h3>
            <p className="text-xs text-slate-400 font-bold">
              {user.email || 'SunderPichai@yahoo.com'}
            </p>
          </div>
        </div>

        <button className="text-sm font-extrabold text-[var(--gogrow-blue)] hover:underline">
          Edit
        </button>
      </div>

      {/* 3. REFERRAL CODE GIFT CARD (MATCHING 19_PREVIEW19.PNG) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-xs flex items-center justify-between">
        <div>
          <h4 className="font-black text-sm text-[var(--text-main)]">Referral Code</h4>
          <p className="text-xs text-slate-400 font-bold mt-0.5">
            Share your love and get $10 of free stocks
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[var(--gogrow-blue)] flex items-center justify-center text-xl">
          <Gift className="w-6 h-6" />
        </div>
      </div>

      {/* 4. MENU ITEMS LIST (MATCHING 19_PREVIEW19.PNG) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-2 shadow-xs space-y-1">
        {/* Billing/Payment */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-[var(--gogrow-blue)] flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-sm text-[var(--text-main)]">Billing/Payment</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>

        {/* Language */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-[var(--gogrow-blue)] flex items-center justify-center">
              <Languages className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-sm text-[var(--text-main)]">Language</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400 font-bold">
            <span>English</span>
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>

        {/* Settings */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-[var(--gogrow-blue)] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-sm text-[var(--text-main)]">Settings</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>

        {/* FAQ */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-[var(--gogrow-blue)] flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-sm text-[var(--text-main)]">FAQ</span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* 5. FEEDBACK BLUE BANNER CARD (MATCHING 19_PREVIEW19.PNG) */}
      <div className="rounded-3xl bg-[var(--gogrow-blue)] p-4 text-white flex items-center justify-between shadow-lg shadow-blue-500/20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white text-[var(--gogrow-blue)] flex items-center justify-center">
            <Headset className="w-6 h-6" />
          </div>
          <div>
            <div className="font-extrabold text-xs">We'd love to hear your feedback!</div>
            <div className="text-[10px] text-blue-100 font-medium">We are always looking to improve.</div>
          </div>
        </div>

        <ChevronRight className="w-6 h-6 text-white" />
      </div>

      {/* Log out action */}
      <button
        onClick={onLogout}
        className="w-full py-3 rounded-2xl border border-rose-500/20 text-rose-500 font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-rose-500/10 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Log out</span>
      </button>

    </div>
  );
};
