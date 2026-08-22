import React, { useEffect, useRef, useState } from 'react';
import { User, Lock, Mail, AlertTriangle, TrendingUp, Eye, EyeOff, ShieldCheck, Zap, LineChart, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';

interface AuthModalProps {
  onSuccess: (token: string, user: any) => void;
}

const TRUST_POINTS = [
  { icon: <ShieldCheck className="w-4 h-4" />, title: 'Regulated-grade safeguards', sub: 'RMS risk limits and auto square-off built in' },
  { icon: <Zap className="w-4 h-4" />, title: 'Live NSE & BSE market data', sub: 'Real streaming ticks, not delayed snapshots' },
  { icon: <LineChart className="w-4 h-4" />, title: 'Full F&O option chain', sub: 'Strike-level OI, IV and one-tap order entry' },
];

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Bumped on every mode switch so the form's entrance animation replays,
  // giving the login <-> register toggle a visible transition without
  // animating height (which would thrash layout).
  const [formKey, setFormKey] = useState<number>(0);
  const errorRef = useRef<HTMLDivElement>(null);

  // Re-run the shake on each *new* error, not just the first — re-submitting
  // the same wrong password should still visibly react.
  useEffect(() => {
    if (!error || !errorRef.current) return;
    const el = errorRef.current;
    el.classList.remove('shake');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('shake');
  }, [error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const normEmail = email.trim().toLowerCase();
    const normUsername = username.trim();

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const body = isLogin ? { email: normEmail, password } : { username: normUsername, email: normEmail, password };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
          onSuccess(data.token, data.user);
        } else {
          const detailedErr = data.error?.fields?.map((f: any) => f.message).join('. ') || data.error?.message || 'Authentication failed';
          setError(detailedErr);
          setIsSubmitting(false);
        }
      })
      .catch(() => {
        setError('Could not reach the server. Check your connection and try again.');
        setIsSubmitting(false);
      });
  };

  const switchMode = () => {
    setIsLogin((v) => !v);
    setError(null);
    setFormKey((k) => k + 1);
  };

  const inputClass =
    'w-full min-h-[44px] bg-[var(--bg-surface-inset)] border border-[var(--border-color)] rounded-[var(--radius-md)] py-2.5 pl-10 pr-3 ' +
    'text-sm font-semibold text-[var(--text-main)] placeholder-[var(--text-tertiary)] outline-none ' +
    'transition-colors duration-[var(--duration-fast)] ease-[var(--easing-default)] ' +
    'focus:border-[var(--primary)] focus:bg-[var(--bg-surface)]';
  const labelClass = 'text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5';
  const iconClass = 'w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none';

  return (
    <div className="min-h-dvh w-full bg-[var(--bg-body)] text-[var(--text-main)] font-body flex items-center justify-center p-4 sm:p-6">
      <div className="auth-card w-full max-w-5xl grid lg:grid-cols-[1.05fr_1fr] rounded-[var(--radius-xl)] overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-xl)]">

        {/* ── BRAND PANEL (desktop only) ─────────────────────────────────
            Deliberately the only heavily-animated surface in the app: a
            self-drawing sparkline reinforces "live market data" at the exact
            moment we're asking for trust. Hidden below lg so the mobile
            experience stays a fast, single-purpose form. */}
        <aside className="hidden lg:flex flex-col justify-between relative overflow-hidden p-10 bg-[var(--bg-surface-inset)] border-r border-[var(--border-color)]">
          <div className="auth-glow" aria-hidden="true" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--primary)] text-white flex items-center justify-center shadow-[var(--shadow-md)]">
                <TrendingUp className="w-5 h-5" />
              </span>
              <span className="text-xl font-black tracking-tight">
                Trade<span className="text-[var(--primary)]">Grow</span>
              </span>
            </div>

            <h1 className="mt-10 text-[28px] leading-tight font-black tracking-tight text-balance">
              The calm way to trade
              <span className="block text-[var(--primary)]">India&rsquo;s markets.</span>
            </h1>
            <p className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed max-w-sm">
              Live NSE &amp; BSE data, a full F&amp;O option chain, and real risk controls &mdash; in one uncluttered terminal.
            </p>
          </div>

          {/* Self-drawing sparkline */}
          <svg className="relative z-10 w-full h-24 my-8" viewBox="0 0 320 80" fill="none" aria-hidden="true" preserveAspectRatio="none">
            <defs>
              <linearGradient id="authSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="auth-spark-fill"
              d="M0 64 L40 58 L80 62 L120 40 L160 46 L200 26 L240 32 L280 14 L320 20 L320 80 L0 80 Z"
              fill="url(#authSparkFill)"
            />
            <path
              className="auth-spark-line"
              d="M0 64 L40 58 L80 62 L120 40 L160 46 L200 26 L240 32 L280 14 L320 20"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <ul className="relative z-10 space-y-4">
            {TRUST_POINTS.map((p, i) => (
              <li key={p.title} className={`flex items-start gap-3 card-enter card-enter-${i + 2}`}>
                <span className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  {p.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text-main)]">{p.title}</div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{p.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── FORM PANEL ─────────────────────────────────────────────── */}
        <main className="p-6 sm:p-10 flex flex-col justify-center">
          {/* Compact brand lockup — only shown where the brand panel isn't */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--primary)] text-white flex items-center justify-center shadow-[var(--shadow-md)]">
              <TrendingUp className="w-5 h-5" />
            </span>
            <span className="text-lg font-black tracking-tight">
              Trade<span className="text-[var(--primary)]">Grow</span>
            </span>
          </div>

          <div key={formKey} className="card-enter">
            <h2 className="text-2xl font-black tracking-tight">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1.5">
              {isLogin ? 'Sign in to your trading terminal.' : 'Start trading in under a minute.'}
            </p>

            {error && (
              <div
                ref={errorRef}
                role="alert"
                className="mt-5 p-3.5 rounded-[var(--radius-md)] bg-[var(--loss-light)] border border-[var(--loss)]/30 text-[var(--loss)] text-xs font-bold flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {!isLogin && (
                <div className="card-enter card-enter-1">
                  <label htmlFor="auth-username" className={labelClass}>Username</label>
                  <div className="relative">
                    <User className={iconClass} aria-hidden="true" />
                    <input
                      id="auth-username"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="trader1"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              <div className="card-enter card-enter-2">
                <label htmlFor="auth-email" className={labelClass}>
                  {isLogin ? 'Email, username or client ID' : 'Email address'}
                </label>
                <div className="relative">
                  <Mail className={iconClass} aria-hidden="true" />
                  <input
                    id="auth-email"
                    type={isLogin ? 'text' : 'email'}
                    required
                    autoComplete={isLogin ? 'username' : 'email'}
                    inputMode={isLogin ? 'text' : 'email'}
                    placeholder={isLogin ? 'you@example.com' : 'you@example.com'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="card-enter card-enter-3">
                <label htmlFor="auth-password" className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className={iconClass} aria-hidden="true" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] hover:text-[var(--text-main)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Driving the spinner via leftIcon rather than Button's own
                  `isLoading` prop, which hides children — a full-width button
                  showing nothing but a spinner reads as broken, and the
                  in-progress label is the actual feedback. */}
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                leftIcon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : undefined}
                className="w-full justify-center card-enter card-enter-4 mt-1"
              >
                {isSubmitting
                  ? (isLogin ? 'Signing in…' : 'Creating account…')
                  : (isLogin ? 'Sign in' : 'Create account')}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="font-bold text-[var(--primary)] hover:underline underline-offset-2"
              >
                {isLogin ? 'Create one' : 'Sign in'}
              </button>
            </p>

            <p className="mt-8 text-center text-[10px] leading-relaxed text-[var(--text-tertiary)]">
              Simulated trade execution. Market data is live; orders are not routed to an exchange.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};
