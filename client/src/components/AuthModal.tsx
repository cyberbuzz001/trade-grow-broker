import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Mail, AlertTriangle, TrendingUp } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (token: string, user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('user@broker.sim');
  const [password, setPassword] = useState<string>('Password123!');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const body = isLogin ? { email, password } : { username, email, password };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }
          onSuccess(data.token, data.user);
        } else {
          const detailedErr = data.error?.fields?.map((f: any) => f.message).join('. ') || data.error?.message || 'Authentication failed';
          setError(detailedErr);
        }
      })
      .catch(() => setError('Server connection error'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-500/30 mb-3">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-[var(--text-main)] to-indigo-600 bg-clip-text text-transparent">
            TradeGrow Portal
          </h2>
          <p className="text-xs font-semibold text-[var(--text-muted)] mt-1">Institutional Trading & Brokerage Platform</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {!isLogin && (
            <div>
              <label className="text-[var(--text-muted)] font-bold block mb-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="trader1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl py-2.5 pl-10 pr-3 text-[var(--text-main)] font-semibold focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[var(--text-muted)] font-bold block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="user@broker.sim"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl py-2.5 pl-10 pr-3 text-[var(--text-main)] font-semibold focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[var(--text-muted)] font-bold block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl py-2.5 pl-10 pr-3 text-[var(--text-main)] font-semibold focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl transition-all mt-2 text-sm shadow-md shadow-indigo-600/20"
          >
            {isLogin ? 'Sign In to Portal' : 'Register Account'}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold text-[var(--text-muted)] hover:text-indigo-600 transition-colors"
          >
            {isLogin ? "Don't have an account? Register here" : 'Already have an account? Sign in'}
          </button>
        </div>

        <div className="pt-4 border-t border-[var(--border-light)] text-[10px] text-[var(--text-tertiary)] text-center space-y-1">
          <div>Demo Admin: <span className="text-[var(--text-main)] font-mono font-bold">admin@broker.sim</span> / <span className="text-[var(--text-main)] font-mono font-bold">Admin123!</span></div>
          <div>Demo Trader: <span className="text-[var(--text-main)] font-mono font-bold">user@broker.sim</span> / <span className="text-[var(--text-main)] font-mono font-bold">Password123!</span></div>
        </div>
      </div>
    </div>
  );
};
