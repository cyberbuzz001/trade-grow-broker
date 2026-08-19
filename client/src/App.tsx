import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { User, Wallet, MarketTick, isStaffUser } from './types';
import { MarketSocketProvider } from './hooks/useMarketSocket';
import { GrowwHeader } from './components/GrowwHeader';
import { GrowwSubNav, SubView } from './components/GrowwSubNav';
import { GrowwExploreView } from './components/GrowwExploreView';
import { GrowwHoldingsView } from './components/GrowwHoldingsView';
import { GrowwWatchlistView } from './components/GrowwWatchlistView';
import { GrowwTerminalView } from './components/GrowwTerminalView';
import { OptionChainView } from './components/OptionChainView';
import { OrdersPositionsView } from './components/OrdersPositionsView';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { UserProfileModal } from './components/UserProfileModal';
import { CustomerSupportModal } from './components/CustomerSupportModal';
import { LinkPeAddFundsModal } from './components/LinkPeAddFundsModal';
import { McxCommodityView } from './components/McxCommodityView';
import { PortfolioAnalyticsView } from './components/PortfolioAnalyticsView';
import { ClientProfileView } from './components/ClientProfileView';

import { MobileBottomNav } from './components/mobile/MobileBottomNav';
import { MobileHomeView } from './components/mobile/MobileHomeView';
import { MobilePortfolioView } from './components/mobile/MobilePortfolioView';
import { MobileWatchlistView } from './components/mobile/MobileWatchlistView';
import { MobileProfileView } from './components/mobile/MobileProfileView';
import { MobileOrderModal } from './components/mobile/MobileOrderModal';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  

  // Responsive / Mobile View Mode State
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(window.innerWidth < 768);
  const [activeMobileTab, setActiveMobileTab] = useState<'HOME' | 'PORTFOLIO' | 'POSITIONS' | 'WATCHLIST' | 'ORDERS' | 'OPTION_CHAIN' | 'ADMIN' | 'PROFILE'>('HOME');
  
  // Mobile Quick Order Modal State
  const [selectedMobileStock, setSelectedMobileStock] = useState<{ name: string; symbol: string; price: number } | null>(null);
  const [isMobileOrderModalOpen, setIsMobileOrderModalOpen] = useState<boolean>(false);

  // Desktop Groww Category & Sub-View State
  const [activeCategory, setActiveCategory] = useState<'STOCKS' | 'FO' | 'MUTUAL_FUNDS' | 'COMMODITIES'>('STOCKS');
  const [activeSubView, setActiveSubView] = useState<SubView>('EXPLORE');
  const [isTerminalMode, setIsTerminalMode] = useState<boolean>(false);

  const [terminalToken, setTerminalToken] = useState<string>('NSE_RELIANCE');
  const [terminalSymbol, setTerminalSymbol] = useState<string>('RELIANCE');
  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());
  
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<'PROFILE' | 'KYC' | 'FUNDS' | 'PERMISSIONS' | 'SECURITY' | 'SUPPORT' | 'APPEARANCE'>('PROFILE');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isLinkPeModalOpen, setIsLinkPeModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('user_theme') as 'light' | 'dark') || 'light';
    } catch (_) {
      return 'light';
    }
  });

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
    return <AuthModal onSuccess={(t: string) => setToken(t)} />;
  }


  // ── 2. GOGROW MOBILE APP VIEW (FOR MOBILE VIEWPORTS < 768PX) ────────────────
  if (isMobileScreen) {
    return (
      <MarketSocketProvider userToken={token}>
        <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] font-sans flex flex-col w-full max-w-full overflow-x-hidden">
          {/* Mobile View Container */}
          <div className="flex-1 max-w-lg mx-auto w-full">
            {activeMobileTab === 'HOME' && (
              <MobileHomeView
                user={user}
                wallet={wallet}
                ticks={ticks}
                theme={theme}
                onToggleTheme={toggleTheme}
                onOpenSearch={() => setIsSearchOpen(true)}
                onSelectStock={(symbol, name, price) => {
                  setSelectedMobileStock({ symbol, name, price });
                  setIsMobileOrderModalOpen(true);
                }}
                onOpenQuickOrder={(stock) => {
                  setSelectedMobileStock({ symbol: stock.symbol, name: stock.name, price: stock.price });
                  setIsMobileOrderModalOpen(true);
                }}
                onOpenOptionChain={() => setActiveMobileTab('OPTION_CHAIN')}
              />
            )}

            {activeMobileTab === 'PORTFOLIO' && (
              <MobilePortfolioView
                ticks={ticks}
                token={token}
                wallet={wallet}
                onBack={() => setActiveMobileTab('HOME')}
                onSelectStock={(symbol, name, price) => {
                  setSelectedMobileStock({ symbol, name, price });
                  setIsMobileOrderModalOpen(true);
                }}
              />
            )}

            {activeMobileTab === 'OPTION_CHAIN' && (
              <div className="p-2 pb-24">
                <OptionChainView token={token} ticks={ticks} onRefreshWallet={fetchWallet} />
              </div>
            )}

            {activeMobileTab === 'POSITIONS' && (
              <MobilePortfolioView
                ticks={ticks}
                token={token}
                wallet={wallet}
                theme={theme}
                onBack={() => setActiveMobileTab('HOME')}
                onSelectStock={(symbol, name, price) => {
                  setSelectedMobileStock({ symbol, name, price });
                  setIsMobileOrderModalOpen(true);
                }}
                onOpenOptionChain={() => setActiveMobileTab('OPTION_CHAIN')}
              />
            )}

            {activeMobileTab === 'WATCHLIST' && (
              <div className="p-3 pb-24">
                <MobileWatchlistView
                  token={token || ''}
                  ticks={ticks}
                  theme={theme}
                  onOpenQuickOrder={(stock) => {
                    setSelectedMobileStock({ symbol: stock.symbol, name: stock.name, price: stock.price });
                    setIsMobileOrderModalOpen(true);
                  }}
                  onOpenOptionChain={() => setActiveMobileTab('OPTION_CHAIN')}
                />
              </div>
            )}

            {activeMobileTab === 'ADMIN' && (
              <div className="p-2 pb-24">
                {user && ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER', 'DEALER', 'ANALYST'].includes(user.role) ? (
                  <AdminPanel token={token} />
                ) : (
                  <div className="p-4 text-center text-xs text-rose-500 font-bold bg-rose-500/10 rounded-xl border border-rose-500/20 my-8">
                    Admin access restricted to authorized staff accounts.
                  </div>
                )}
              </div>
            )}

            {activeMobileTab === 'PROFILE' && (
              <MobileProfileView
                user={user}
                wallet={wallet}
                token={token}
                theme={theme}
                onToggleTheme={toggleTheme}
                onBack={() => setActiveMobileTab('HOME')}
                onLogout={handleLogout}
                onOpenProfileModal={(tab) => {
                  setProfileInitialTab(tab || 'PROFILE');
                  setIsProfileModalOpen(true);
                }}
                onOpenSupportModal={() => setIsSupportModalOpen(true)}
                onOpenAdmin={() => setActiveMobileTab('ADMIN')}
                onRefreshWallet={fetchWallet}
              />
            )}
          </div>

          {/* GoGrow Mobile Bottom Navigation Bar */}
          <MobileBottomNav
            activeTab={activeMobileTab}
            onSelectTab={(tab) => setActiveMobileTab(tab)}
            isAdmin={Boolean(user && isStaffUser(user.role))}
          />

          {/* Mobile Order Confirmation Modal */}
          {selectedMobileStock && (
            <MobileOrderModal
              isOpen={isMobileOrderModalOpen}
              onClose={() => setIsMobileOrderModalOpen(false)}
              stockName={selectedMobileStock.name}
              stockSymbol={selectedMobileStock.symbol}
              stockPrice={selectedMobileStock.price}
              token={token}
              onConfirmSuccess={() => fetchWallet()}
            />
          )}

          {/* Global Search Modal */}
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            userRole={user?.role}
            onSelectSymbol={(selectedToken, selectedSymbol) => {
              setSelectedMobileStock({ name: selectedSymbol, symbol: selectedToken, price: 297.64 });
              setIsMobileOrderModalOpen(true);
            }}
            onSelectTab={() => {}}
          />

          {user && (
            <UserProfileModal
              user={user}
              wallet={wallet}
              isOpen={isProfileModalOpen}
              initialTab={profileInitialTab}
              onClose={() => setIsProfileModalOpen(false)}
              onLogout={handleLogout}
              onRefreshWallet={fetchWallet}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          )}

          <CustomerSupportModal
            token={token}
            isOpen={isSupportModalOpen}
            onClose={() => setIsSupportModalOpen(false)}
          />
        </div>
      </MarketSocketProvider>
    );
  }

  // ── 2. DESKTOP GROWW DASHBOARD & WEB TERMINAL VIEW ────────────────────────
  return (
    <MarketSocketProvider userToken={token}>
      <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] flex flex-col font-sans">
        
        {/* 1. GROWW BRAND HEADER */}
        <GrowwHeader
          user={user}
          walletBalance={wallet?.cashBalance || 0}
          activeCategory={activeCategory}
          onCategorySelect={setActiveCategory}
          onOpenSearch={() => setIsSearchOpen(true)}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onOpenWalletModal={() => {
            setIsLinkPeModalOpen(true);
          }}
          onNavigateView={(v) => {
            setIsTerminalMode(false);
            setActiveSubView(v);
          }}
          onOpenSupport={() => setIsSupportModalOpen(true)}
          onOpenProfileModal={(tab) => {
            setProfileInitialTab(tab || 'PROFILE');
            setIsProfileModalOpen(true);
          }}
        />

        {/* 2. GROWW SUB-NAV & TICKER BAR */}
        <GrowwSubNav
          activeView={activeSubView}
          onSelectView={(v) => {
            setIsTerminalMode(false);
            setActiveSubView(v);
          }}
          isTerminalMode={isTerminalMode}
          onToggleTerminal={() => setIsTerminalMode(!isTerminalMode)}
          onSelectIndexChart={(symbol, token) => {
            setTerminalSymbol(symbol);
            setTerminalToken(token);
            setIsTerminalMode(true);
          }}
          onSelectIndexOptionChain={() => {
            setIsTerminalMode(false);
            setActiveSubView('OPTION_CHAIN');
          }}
          ticks={ticks}
          user={user}
        />

        {/* 3. MAIN WORKSPACE CONTAINER */}
        <main className="flex-1">
          {isTerminalMode ? (
            /* GROWW WEB TERMINAL MODE (IMAGES 4 & 5) */
            <GrowwTerminalView
              token={token}
              ticks={ticks}
              wallet={wallet}
              onRefreshWallet={fetchWallet}
              initialSymbol={terminalSymbol}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          ) : (
            /* STANDARD GROWW DASHBOARD VIEWS (IMAGES 1, 2, 3) */
            <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6">
              
              {activeCategory === 'COMMODITIES' ? (
                <McxCommodityView ticks={ticks} onRefreshWallet={fetchWallet} />
              ) : (
                <>
                  {activeSubView === 'EXPLORE' && (
                    <GrowwExploreView
                      ticks={ticks}
                      token={token}
                      wallet={wallet}
                      onRefreshWallet={fetchWallet}
                      onSelectSymbol={(sym) => {
                        setTerminalSymbol(sym);
                        setIsTerminalMode(true);
                      }}
                      onOpenProfile={(tab) => {
                        setProfileInitialTab(tab || 'PROFILE');
                        setIsProfileModalOpen(true);
                      }}
                    />
                  )}

                  {activeSubView === 'HOLDINGS' && (
                    <GrowwHoldingsView
                      onExploreStocks={() => setActiveSubView('EXPLORE')}
                    />
                  )}

                  {activeSubView === 'POSITIONS' && (
                    <OrdersPositionsView
                      token={token}
                      initialTab="POSITIONS"
                      onRefreshWallet={fetchWallet}
                    />
                  )}

                  {activeSubView === 'ORDERS' && (
                    <OrdersPositionsView
                      token={token}
                      initialTab="ORDERS"
                      onRefreshWallet={fetchWallet}
                    />
                  )}

                  {activeSubView === 'WATCHLIST' && (
                    <GrowwWatchlistView
                      token={token}
                      ticks={ticks}
                      onRefreshWallet={fetchWallet}
                      onSelectSymbolForTerminal={(sym) => {
                        setTerminalSymbol(sym);
                        setIsTerminalMode(true);
                      }}
                    />
                  )}

                  {activeSubView === 'OPTION_CHAIN' && (
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xs">
                      <OptionChainView
                        token={token}
                        ticks={ticks}
                        onRefreshWallet={fetchWallet}
                      />
                    </div>
                  )}

                  {(activeSubView as any) === 'ANALYTICS' && (
                    <PortfolioAnalyticsView
                      token={token}
                      wallet={wallet}
                      onRefreshWallet={fetchWallet}
                    />
                  )}

                  {activeSubView === 'PROFILE' && (
                    <ClientProfileView
                      user={user}
                      wallet={wallet}
                      token={token}
                      onRefreshWallet={fetchWallet}
                      theme={theme}
                      onToggleTheme={toggleTheme}
                    />
                  )}

                  {activeSubView === 'ADMIN' && (
                    user && isStaffUser(user.role) ? (
                      <AdminPanel token={token} />
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
                          onClick={() => setActiveSubView('EXPLORE')}
                          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-xl transition-colors shadow-md shadow-emerald-500/20"
                        >
                          Return to Trading Workspace
                        </button>
                      </div>
                    )
                  )}
                </>
              )}

            </div>
          )}
        </main>

        {/* GLOBAL MODALS */}
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          userRole={user?.role}
          onSelectSymbol={(selectedToken, selectedSymbol) => {
            setTerminalToken(selectedToken);
            setTerminalSymbol(selectedSymbol);
            setIsTerminalMode(true);
          }}
          onSelectTab={(v) => {
            setIsTerminalMode(false);
            setActiveSubView(v as any);
          }}
        />

        {user && (
          <UserProfileModal
            user={user}
            wallet={wallet}
            isOpen={isProfileModalOpen}
            initialTab={profileInitialTab}
            onClose={() => setIsProfileModalOpen(false)}
            onLogout={handleLogout}
            onRefreshWallet={fetchWallet}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        <CustomerSupportModal
          token={token}
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
        />

        {user && (
          <LinkPeAddFundsModal
            token={token}
            wallet={wallet}
            isOpen={isLinkPeModalOpen}
            onClose={() => setIsLinkPeModalOpen(false)}
            onRefreshWallet={fetchWallet}
          />
        )}

      </div>
    </MarketSocketProvider>
  );
}
