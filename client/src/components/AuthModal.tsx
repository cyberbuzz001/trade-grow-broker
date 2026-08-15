import React, { useState } from 'react';
import { ShieldCheck, User, Lock, Mail, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (token: string, user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normEmail = email.trim().toLowerCase();
    const normUsername = username.trim();

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const body = isLogin ? { email: normEmail, password } : { username: normUsername, email: normEmail, password };

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
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 touch-action-manipulation font-body text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden">
        
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex flex-col items-center text-center relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-emerald-950/40 mb-3 border border-emerald-400/30">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
            TradeGrow <span className="text-emerald-400">Pro</span>
          </h2>
          <p className="text-xs font-medium text-slate-400 mt-1">Smart Institutional Trading & Brokerage Platform</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {!isLogin && (
            <div>
              <label className="text-slate-400 font-bold block mb-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="trader1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-slate-400 font-bold block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                placeholder="user@broker.sim"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-bold block mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition-all mt-2 text-sm shadow-lg shadow-emerald-950/40 active:scale-95 cursor-pointer"
          >
            {isLogin ? 'Sign In to Terminal' : 'Create Trader Account'}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer min-h-[44px]"
          >
            {isLogin ? "Don't have an account? Register here" : 'Already have an account? Sign in'}
          </button>
        </div>

      </div>
    </div>
  );
};
