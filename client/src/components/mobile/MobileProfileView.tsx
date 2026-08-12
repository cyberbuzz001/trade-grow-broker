import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  User as UserIcon, 
  ShieldCheck, 
  Wallet, 
  Lock, 
  HelpCircle, 
  LogOut, 
  Sun, 
  Moon, 
  CheckCircle2, 
  Zap, 
  RefreshCw, 
  PlusCircle, 
  ArrowUpRight,
  Sliders,
  Bell
} from 'lucide-react';
import { User, Wallet as WalletType } from '../../types';

interface MobileProfileViewProps {
  user: User | null;
  wallet: WalletType | null;
  token?: string | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onBack: () => void;
  onLogout: () => void;
  onOpenProfileModal?: (tab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'SECURITY') => void;
  onOpenSupportModal?: () => void;
  onOpenAdmin?: () => void;
  onRefreshWallet?: () => void;
}

export const MobileProfileView: React.FC<MobileProfileViewProps> = ({
  user,
  wallet,
  token,
  theme = 'dark',
  onToggleTheme,
  onBack,
  onLogout,
  onOpenProfileModal,
  onOpenSupportModal,
  onOpenAdmin,
  onRefreshWallet,
}) => {
  const username = user?.username || 'Trader';
  const email = user?.email || 'user@broker.sim';
  const role = user?.role || 'USER';
  const isAdminStaff = ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'OPERATIONS_MANAGER', 'DEALER', 'SUPPORT_AGENT'].includes(role);

  const availableBalance = wallet?.buyingPower ?? wallet?.cashBalance ?? 50000;
  const netWorth = (wallet?.cashBalance ?? 50000) + (wallet?.unrealizedPnl ?? 0);

  return (
    <div className="pb-24 pt-4 px-4 space-y-4 bg-[var(--bg-body)] min-h-screen text-[var(--text-main)] font-sans touch-action-manipulation">
      
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-main)] active:scale-95 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h2 className="text-base font-black text-[var(--text-main)] font-headline tracking-tight">
          Profile & Settings
        </h2>

        {onToggleTheme ? (
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-amber-400 active:scale-95 transition-all cursor-pointer"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* 2. USER PROFILE HEADER CARD */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E676]/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00E676] to-emerald-600 text-[#0D1117] font-black text-2xl flex items-center justify-center shadow-lg shadow-[#00E676]/20 font-headline">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00E676] border-2 border-[var(--bg-surface)]" title="Active" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-[var(--text-main)] capitalize truncate font-headline">
                {username}
              </h3>
              <span className="text-[10px] font-black bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> VERIFIED
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-semibold truncate mt-0.5">
              {email}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-tertiary)] font-mono">
              <span>ID: {user?.id?.slice(0, 10) || '1113019677'}</span>
              <span>•</span>
              <span className="font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded uppercase">{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WALLET & CAPITAL CARD */}
      <div className="bg-gradient-to-br from-[#161B22] to-[#0D1117] border border-[#30363D] rounded-2xl p-4 text-white shadow-md space-y-3">
        <div className="flex items-center justify-between text-xs text-[#8B949E] font-bold">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Wallet className="w-4 h-4 text-[#00E676]" /> Available Balance
          </span>
          {onRefreshWallet && (
            <button 
              type="button"
              onClick={onRefreshWallet} 
              className="text-xs text-[#00E676] hover:underline flex items-center gap-1 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-black tabular-nums text-white font-label">
            ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
            Net: ₹{netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Quick Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onOpenProfileModal && onOpenProfileModal('FUNDS')}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-[#0D1117] font-black text-xs shadow-md active:scale-98 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Add Capital
          </button>
        </div>
      </div>

      {/* 4. ADMIN QUICK ACTION BANNER (If Admin / Staff) */}
      {isAdminStaff && (
        <button 
          type="button"
          onClick={onOpenAdmin}
          className="w-full text-left bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer active:scale-98 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-amber-300 font-headline">Admin Control Center</h4>
              <p className="text-[10px] text-amber-400/80 font-semibold">Staff Dashboard, User Management & Risk Control</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </button>
      )}

      {/* 5. ACCOUNT & TRADING OPTIONS MENU */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2 shadow-xs space-y-1 font-headline">
        
        {/* Personal Profile Details */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('PROFILE')}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:bg-[var(--bg-surface-elevated)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Personal & Profile Details</span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">Name, Email, Mobile & Client ID</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* KYC Verification Status */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('KYC')}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:bg-[var(--bg-surface-elevated)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#00E676] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">KYC & Document Status</span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">Aadhaar, PAN & Bank Verification</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-[#00E676] bg-[#00E676]/10 px-2 py-0.5 rounded-md border border-[#00E676]/20">Approved</span>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </button>

        {/* Funds & Wallet Manager */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('FUNDS')}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:bg-[var(--bg-surface-elevated)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Wallet & Capital</span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">Margin allocation & Capital ledger</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Security & Password */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('SECURITY')}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:bg-[var(--bg-surface-elevated)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Security & Password</span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">Password reset & 2FA security</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Customer Support & Help */}
        <button
          type="button"
          onClick={onOpenSupportModal}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:bg-[var(--bg-surface-elevated)]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Customer Support & Help</span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">24/7 Desk, Support tickets & FAQs</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* App Theme Switcher */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:bg-[var(--bg-surface-elevated)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              </div>
              <div>
                <span className="font-bold text-xs text-[var(--text-main)] block">App Theme Mode</span>
                <span className="text-[10px] text-[var(--text-tertiary)] font-semibold">Toggle Light / Dark aesthetic</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#00E676]">
              <span>{theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
          </button>
        )}

      </div>

      {/* 6. LOGOUT BUTTON */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-[#FF5252] border border-rose-500/20 font-bold text-xs active:scale-98 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout Account</span>
        </button>
      </div>

      {/* Version Footer */}
      <div className="text-center pt-2 text-[10px] text-[var(--text-tertiary)] font-mono font-semibold">
        Trade Grow v2.4.0 • Live Dhan HQ Feed
      </div>

    </div>
  );
};
