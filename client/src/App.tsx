import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { User, Wallet, MarketTick, isStaffUser } from './types';
import { MarketSocketProvider } from './hooks/useMarketSocket';
import { AppShell } from './components/AppShell';
import { GrowwExploreView } from './components/GrowwExploreView';
import { GrowwWatchlistView } from './components/GrowwWatchlistView';
import { GrowwTerminalView } from './components/GrowwTerminalView';
import { OptionChainView } from './components/OptionChainView';
import { OrdersPositionsView } from './components/OrdersPositionsView';
import { PortfolioHoldingsAnalyticsView } from './components/PortfolioHoldingsAnalyticsView';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ProfilePage } from './components/ProfilePage';
import { OrderPreviewModal, OrderPreviewDetails } from './components/OrderPreviewModal';

import { MobileChartModal } from './components/mobile/MobileChartModal';

// ─────────────────────────────────────────────────────────────────────────
// Route <-> legacy-state mapping.
//
// This is Task 1 of the client panel redesign (.design/client-panel-redesign/
// TASKS.md): introduce real URLs for every page. Deliberately narrow scope —
// every route below still renders the EXACT SAME child components (desktop
// vs mobile split included) that the old state-switch rendered; unifying
// mobile/desktop into one responsive component per page is each page's own
// later task, not this one. The one small, deliberate behavior change here
// is noted below (category scoping).
// ─────────────────────────────────────────────────────────────────────────

const SEARCH_TAB_TO_PATH: Record<string, string> = {
  EXPLORE: '/', HOLDINGS: '/portfolio/holdings', POSITIONS: '/portfolio/positions',
  ORDERS: '/portfolio/orders', WATCHLIST: '/watchlist', OPTION_CHAIN: '/option-chain',
  ADMIN: '/admin', PORTFOLIO: '/portfolio/positions', TERMINAL: '/terminal',
};

export function App() {
  return (
    <BrowserRouter>
      <AppRoot />
    </BrowserRouter>
  );
}

function AppRoot() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(window.innerWidth < 768);

  // Mobile Quick Order state — same OrderPreviewModal every other page uses,
  // not a separate ad hoc sheet (the old mobile/MobileOrderModal.tsx this
  // replaced was deleted in the dead-code-removal task).
  const [mobileOrderDetails, setMobileOrderDetails] = useState<OrderPreviewDetails | null>(null);
  const [mobileWatchlistChart, setMobileWatchlistChart] = useState<{ symbol: string; token: string; exchange: string } | null>(null);
  const [isMobileOrderModalOpen, setIsMobileOrderModalOpen] = useState<boolean>(false);

  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('user_theme') as 'light' | 'dark') || 'light';
    } catch (_) {
      return 'light';
    }
  });

  const navigate = useNavigate();
  const location = useLocation();

  // Detect Mobile Viewport
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    try {
      localStorage.setItem('user_theme', theme);
    } catch (_) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setWallet(data.wallet);
      } else {
        // Attempt silent token refresh before logging out
        const savedRefreshToken = localStorage.getItem('refreshToken');
        if (savedRefreshToken) {
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: savedRefreshToken })
          });
          const refreshData = await refreshRes.json();
          if (refreshData.success && refreshData.token) {
            setToken(refreshData.token);
            localStorage.setItem('token', refreshData.token);
            return;
          }
        }
        handleLogout();
      }
    } catch (_) {
      // Retain active session on transient network errors
    }
  };

  useEffect(() => {
    if (token) fetchWallet();
  }, [token]);

  // Resilient WebSocket Live Market Data Connection with Auto-Reconnect & Heartbeat
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const connect = () => {
      if (!isComponentMounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${token}` : ''}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Send ping every 25s to keep connection active
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'PING' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const storeTickInMap = (map: Map<string, MarketTick>, t: MarketTick) => {
            if (!t || !t.instrumentToken) return;
            map.set(t.instrumentToken, t);
            if (t.symbol) {
              const clean = t.symbol.trim();
              map.set(clean, t);
              map.set(`NSE_${clean}`, t);
              map.set(`MCX_${clean}`, t);
              map.set(`BSE_${clean}`, t);
            }
          };

          if (message.type === 'TICK_SNAPSHOT' && Array.isArray(message.data)) {
            setTicks(prev => {
              const next = new Map(prev);
              message.data.forEach((t: MarketTick) => storeTickInMap(next, t));
              return next;
            });
          } else if (message.type === 'MARKET_TICK' && message.data) {
            setTicks(prev => {
              const next = new Map(prev);
              storeTickInMap(next, message.data as MarketTick);
              return next;
            });
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        if (isComponentMounted) {
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        try { ws?.close(); } catch (_) {}
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setWallet(null);
  };

  if (!token || !user) {
    return <AuthModal onSuccess={(t: string) => { localStorage.setItem('token', t); setToken(t); }} />;
  }

  // ProfilePage owns real routes now (/profile/:tab) — this just translates the
  // legacy uppercase tab keys still passed by GrowwExploreView/AppShell call
  // sites into a route navigation, instead of opening a modal (there is no
  // longer a profile modal; the old UserProfileModal/LinkPeAddFundsModal/
  // CustomerSupportModal/ClientProfileView/MobileProfileView files it
  // superseded were all deleted in the dead-code-removal task).
  const PROFILE_TAB_TO_PATH: Record<string, string> = {
    PROFILE: 'account', KYC: 'kyc', BANK: 'bank', SECURITY: 'security',
    FUNDS: 'funds', SUPPORT: 'support', PERMISSIONS: 'permissions', APPEARANCE: 'appearance',
  };
  const goToProfileTab = (tab?: string) => navigate(`/profile/${PROFILE_TAB_TO_PATH[tab || 'PROFILE'] || 'account'}`);

  // Quick-order entry points (search result tap, chart BUY/SELL) don't carry
  // strike/expiry/lots — those fields are simply unused for a plain equity
  // order, same convention GrowwWatchlistView/OptionChainView already use for
  // their own non-option OrderPreviewModal calls. Resolves a live tick when
  // the caller didn't already have one (search results only pass a token).
  const openMobileQuickOrder = (opts: { symbol: string; price?: number; side?: 'BUY' | 'SELL'; exchange?: string; token?: string }) => {
    const exchange = opts.exchange || 'NSE';
    const tickKey = opts.token || `${exchange}_${opts.symbol}`;
    const livePrice = ticks.get(tickKey)?.ltp || opts.price || 0;
    setMobileOrderDetails({
      token: tickKey,
      symbol: opts.symbol,
      underlying: opts.symbol,
      exchange,
      expiry: '',
      strike: 0,
      optionType: 'CE',
      side: opts.side || 'BUY',
      lots: 1,
      lotSize: 1,
      quantity: 1,
      price: livePrice,
      orderType: 'MARKET',
      productType: 'MIS',
    });
    setIsMobileOrderModalOpen(true);
  };

  // ── MOBILE SHELL (<768px) ──────────────────────────────────────────────
  if (isMobileScreen) {
    return (
      <MarketSocketProvider userToken={token}>
        <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] font-sans flex flex-col w-full max-w-full overflow-x-hidden">
          <div className="flex-1 max-w-lg mx-auto w-full">
            <Routes>
              <Route path="/" element={
                <div className="px-3 pt-3">
                  <GrowwExploreView
                    token={token}
                    wallet={wallet}
                    ticks={ticks}
                    theme={theme}
                    onOpenSearch={() => setIsSearchOpen(true)}
                    onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')}
                    onOpenProfile={goToProfileTab}
                    onSelectSymbol={(symbol, price) => openMobileQuickOrder({ symbol, price })}
                  />
                </div>
              } />

              <Route path="/portfolio" element={<Navigate to="/portfolio/positions" replace />} />
              <Route path="/portfolio/positions" element={
                <div className="p-3">
                  <OrdersPositionsView token={token} initialTab="POSITIONS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                </div>
              } />
              <Route path="/portfolio/orders" element={
                <div className="p-3">
                  <OrdersPositionsView token={token} initialTab="ORDERS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                </div>
              } />
              <Route path="/portfolio/history" element={
                <div className="p-3">
                  <OrdersPositionsView token={token} initialTab="TRADE_HISTORY" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
                </div>
              } />
              <Route path="/portfolio/holdings" element={
                <div className="p-3">
                  <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="HOLDINGS" />
                </div>
              } />
              <Route path="/portfolio/analytics" element={
                <div className="p-3">
                  <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="ANALYTICS" />
                </div>
              } />

              <Route path="/option-chain" element={
                <div className="p-2 pb-24">
                  <OptionChainView token={token} ticks={ticks} onRefreshWallet={fetchWallet} riskRestriction={user?.riskRestriction} />
                </div>
              } />

              <Route path="/watchlist" element={
                <div className="p-3 pb-24">
                  <GrowwWatchlistView
                    token={token || ''}
                    ticks={ticks}
                    onRefreshWallet={fetchWallet}
                    onSelectSymbolForTerminal={(symbol, chartToken, exchange) => setMobileWatchlistChart({ symbol, token: chartToken, exchange })}
                    riskRestriction={user?.riskRestriction}
                  />
                </div>
              } />

              <Route path="/admin/*" element={
                <div className="p-2 pb-24">
                  {isStaffUser(user.role) ? (
                    <AdminPanel token={token} theme={theme} onToggleTheme={toggleTheme} />
                  ) : (
                    <div className="p-4 text-center text-xs text-rose-500 font-bold bg-rose-500/10 rounded-xl border border-rose-500/20 my-8">
                      Admin access restricted to authorized staff accounts.
                    </div>
                  )}
                </div>
              } />

              <Route path="/profile" element={<Navigate to="/profile/account" replace />} />
              <Route path="/profile/:tab" element={
                <div className="p-3 pb-24">
                  <ProfilePage user={user} wallet={wallet} token={token} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} onRefreshWallet={fetchWallet} />
                </div>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <AppShell
            user={user}
            walletBalance={wallet?.cashBalance || 0}
            ticks={ticks}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenWalletModal={() => goToProfileTab('FUNDS')}
          />

          <OrderPreviewModal
            isOpen={isMobileOrderModalOpen}
            onClose={() => setIsMobileOrderModalOpen(false)}
            onConfirm={() => fetchWallet()}
            details={mobileOrderDetails}
            userToken={token || ''}
            sideEditable
            riskRestriction={user?.riskRestriction}
          />

          {mobileWatchlistChart && (
            <MobileChartModal
              isOpen={Boolean(mobileWatchlistChart)}
              onClose={() => setMobileWatchlistChart(null)}
              symbol={mobileWatchlistChart.symbol}
              token={mobileWatchlistChart.token}
              exchange={mobileWatchlistChart.exchange}
              latestTick={ticks.get(mobileWatchlistChart.token)}
              theme={theme}
              onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')}
              onOpenOrderModal={(side, price) => openMobileQuickOrder({ symbol: mobileWatchlistChart.symbol, exchange: mobileWatchlistChart.exchange, token: mobileWatchlistChart.token, price, side })}
            />
          )}

          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            userRole={user?.role}
            onSelectSymbol={(selectedToken, selectedSymbol) => {
              openMobileQuickOrder({ symbol: selectedSymbol, token: selectedToken });
            }}
            onSelectTab={() => {}}
          />
        </div>
      </MarketSocketProvider>
    );
  }

  // ── DESKTOP SHELL (>=768px) ────────────────────────────────────────────
  const isTerminalMode = location.pathname === '/terminal';

  return (
    <MarketSocketProvider userToken={token}>
      <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] flex flex-col font-sans">

        <AppShell
          user={user}
          walletBalance={wallet?.cashBalance || 0}
          ticks={ticks}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenWalletModal={() => goToProfileTab('FUNDS')}
          isTerminalMode={isTerminalMode}
          onToggleTerminal={() => (isTerminalMode ? navigate(-1) : navigate('/terminal'))}
        />

        <main className="flex-1">
          <Routes>
            <Route path="/terminal" element={<TerminalRoute token={token} ticks={ticks} wallet={wallet} onRefreshWallet={fetchWallet} theme={theme} onToggleTheme={toggleTheme} />} />

            <Route path="/" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <GrowwExploreView
                  ticks={ticks}
                  token={token}
                  wallet={wallet}
                  onRefreshWallet={fetchWallet}
                  onSelectSymbol={(sym) => navigate(`/terminal?symbol=${encodeURIComponent(sym)}`)}
                  onOpenProfile={goToProfileTab}
                  onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')}
                  onOpenSearch={() => setIsSearchOpen(true)}
                  theme={theme}
                />
              </div>
            } />

            <Route path="/watchlist" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <GrowwWatchlistView
                  token={token}
                  ticks={ticks}
                  onRefreshWallet={fetchWallet}
                  onSelectSymbolForTerminal={(sym) => navigate(`/terminal?symbol=${encodeURIComponent(sym)}`)}
                  riskRestriction={user?.riskRestriction}
                />
              </div>
            } />

            <Route path="/option-chain" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xs">
                  <OptionChainView token={token} ticks={ticks} onRefreshWallet={fetchWallet} riskRestriction={user?.riskRestriction} />
                </div>
              </div>
            } />

            <Route path="/portfolio" element={<Navigate to="/portfolio/positions" replace />} />
            <Route path="/portfolio/positions" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <OrdersPositionsView token={token} initialTab="POSITIONS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
              </div>
            } />
            <Route path="/portfolio/orders" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <OrdersPositionsView token={token} initialTab="ORDERS" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
              </div>
            } />
            <Route path="/portfolio/history" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <OrdersPositionsView token={token} initialTab="TRADE_HISTORY" onRefreshWallet={fetchWallet} onOpenOptionChain={(sym) => navigate(sym ? `/option-chain?symbol=${encodeURIComponent(sym)}` : '/option-chain')} riskRestriction={user?.riskRestriction} />
              </div>
            } />
            <Route path="/portfolio/holdings" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="HOLDINGS" />
              </div>
            } />
            <Route path="/portfolio/analytics" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <PortfolioHoldingsAnalyticsView token={token || ''} wallet={wallet} riskRestriction={user?.riskRestriction} onRefreshWallet={fetchWallet} initialTab="ANALYTICS" />
              </div>
            } />

            <Route path="/profile" element={<Navigate to="/profile/account" replace />} />
            <Route path="/profile/:tab" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                <ProfilePage user={user} wallet={wallet} token={token || ''} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} onRefreshWallet={fetchWallet} />
              </div>
            } />

            <Route path="/admin/*" element={
              <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
                {isStaffUser(user.role) ? (
                  <AdminPanel token={token} theme={theme} onToggleTheme={toggleTheme} />
                ) : (
                  <div className="bg-[var(--bg-surface)] border border-rose-500/30 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 space-y-4 shadow-xl">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-extrabold text-[var(--text-main)]">Access Denied — Client Account</h3>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      The Admin Control Center is strictly restricted to administrative staff and broker management teams. Client accounts do not have permission to view system controls.
                    </p>
                    <button
                      onClick={() => navigate('/')}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-xl transition-colors shadow-md shadow-emerald-500/20"
                    >
                      Return to Trading Workspace
                    </button>
                  </div>
                )}
              </div>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          userRole={user?.role}
          onSelectSymbol={(selectedToken, selectedSymbol) => {
            navigate(`/terminal?symbol=${encodeURIComponent(selectedSymbol)}&token=${encodeURIComponent(selectedToken)}`);
          }}
          onSelectTab={(v) => navigate(SEARCH_TAB_TO_PATH[v] ?? '/')}
        />
      </div>
    </MarketSocketProvider>
  );
}

// Header + sub-nav, split out only so the desktop shell above stays readable.
// Not a "page" — renders on every desktop route.
function TerminalRoute(props: {
  token: string;
  ticks: Map<string, MarketTick>;
  wallet: Wallet | null;
  onRefreshWallet: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const [searchParams] = useSearchParams();
  const initialSymbol = searchParams.get('symbol') || 'RELIANCE';

  return (
    <GrowwTerminalView
      token={props.token}
      ticks={props.ticks}
      wallet={props.wallet}
      onRefreshWallet={props.onRefreshWallet}
      initialSymbol={initialSymbol}
      theme={props.theme}
      onToggleTheme={props.onToggleTheme}
    />
  );
}
