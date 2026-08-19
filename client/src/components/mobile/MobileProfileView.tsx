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
  AlertTriangle
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
  onOpenProfileModal?: (tab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'SECURITY' | 'SUPPORT' | 'PERMISSIONS' | 'APPEARANCE') => void;
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
  const email = user?.email || 'trader@tradegrow.sim';
  const role = user?.role || 'USER';
  const isAdminStaff = ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER', 'DEALER'].includes(role);

  const availableBalance = wallet?.buyingPower ?? wallet?.cashBalance ?? 50000;
  const netWorth = (wallet?.cashBalance ?? 50000) + (wallet?.unrealizedPnl ?? 0);
  const isKycVerified = (user as any)?.isKycCompleted || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  return (
    <div className="pb-24 pt-4 px-4 space-y-4 bg-[var(--bg-body)] min-h-screen text-[var(--text-main)] font-sans touch-action-manipulation">
      
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-main)] active:scale-95 transition-all cursor-pointer shadow-xs"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h2 className="text-base font-bold text-[var(--text-main)] tracking-tight">
          Profile & Account
        </h2>

        {onToggleTheme ? (
          <button
            type="button"
            onClick={onToggleTheme}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-amber-400 active:scale-95 transition-all cursor-pointer shadow-xs"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* 2. USER PROFILE HEADER CARD */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 shadow-xs relative overflow-hidden backdrop-blur-xl">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="relative">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md border border-emerald-400/30">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-surface)] ${isKycVerified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[var(--text-main)] capitalize truncate">
                {username}
              </h3>
              {isKycVerified ? (
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> KYC PENDING
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium truncate mt-0.5">
              {email}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-muted)] font-mono">
              <span>ID: {user?.id?.slice(0, 10) || '1113019677'}</span>
              <span>•</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded uppercase">{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WALLET & CAPITAL CARD (Exact Layout matching reference image) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-4 text-[var(--text-main)] shadow-xs space-y-3 backdrop-blur-xl">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-bold">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Wallet className="w-4 h-4 text-emerald-500" /> AVAILABLE BALANCE
          </span>
          {onRefreshWallet && (
            <button 
              type="button"
              onClick={onRefreshWallet} 
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 active:scale-95 cursor-pointer min-h-[36px]"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-black tabular-nums text-[var(--text-main)] num-font">
            ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
            Net: ₹{netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>

        {/* Quick Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onOpenProfileModal && onOpenProfileModal('FUNDS')}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Add Capital
          </button>
        </div>
      </div>

      {/* 4. ADMIN QUICK ACTION BANNER */}
      {isAdminStaff && (
        <button 
          type="button"
          onClick={onOpenAdmin}
          className="w-full text-left bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-transparent border border-rose-500/30 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer active:scale-95 transition-all min-h-[48px]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-rose-500 dark:text-rose-300">Admin Control Center</h4>
              <p className="text-[10px] text-rose-500/80 dark:text-rose-400/80 font-medium">User Management & Risk Controls</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-500" />
        </button>
      )}

      {/* 5. ACCOUNT & SETTINGS MENU ROWS (Exact 5 Cards from uploaded image) */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-2 shadow-xs space-y-1 backdrop-blur-xl">
        
        {/* Card 1: Personal & Profile Details */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('PROFILE')}
          className="w-full min-h-[52px] text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Personal & Profile Details</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Client ID, Email, & Mobile</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Card 2: KYC Verification Status */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('KYC')}
          className="w-full min-h-[52px] text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">KYC Verification Status</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Aadhaar, PAN & Bank Status</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isKycVerified ? (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">Verified</span>
            ) : (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">Pending</span>
            )}
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </button>

        {/* Card 3: Wallet & Margin Ledger */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('FUNDS')}
          className="w-full min-h-[52px] text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Wallet & Margin Ledger</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Margin limits & Deposit history</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Card 4: Security & Password */}
        <button
          type="button"
          onClick={() => onOpenProfileModal && onOpenProfileModal('SECURITY')}
          className="w-full min-h-[52px] text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Security & Password</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Password reset & 2FA security</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Card 5: 24/7 Trade Support Desk */}
        <button
          type="button"
          onClick={() => {
            if (onOpenSupportModal) onOpenSupportModal();
            else if (onOpenProfileModal) onOpenProfileModal('SUPPORT');
          }}
          className="w-full min-h-[52px] text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">24/7 Trade Support Desk</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Help tickets & live assistance</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        {/* Card 6: Appearance & Lite Mode Toggle */}
        <button
          type="button"
          onClick={() => {
            if (onToggleTheme) onToggleTheme();
          }}
          className="w-full min-h-[52px] text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors active:scale-98"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </div>
            <div>
              <span className="font-bold text-xs text-[var(--text-main)] block">Appearance & Lite Mode</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                {theme === 'light' ? 'Lite Mode Active (Light Theme)' : 'Dark Mode Active (Dark Theme)'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
              theme === 'light' 
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40' 
                : 'bg-indigo-500/20 text-indigo-500 border-indigo-500/40'
            }`}>
              {theme === 'light' ? 'LITE MODE' : 'DARK MODE'}
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </button>

      </div>

      {/* 6. LOGOUT BUTTON */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[48px] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:bg-rose-500/20 font-bold text-xs active:scale-95 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Log Out of Account
        </button>
      </div>

    </div>

  );
};
