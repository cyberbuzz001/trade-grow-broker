import React, { useState, useEffect } from 'react';
import { User, Wallet, MarketTick } from './types';
import { MarketSocketProvider } from './hooks/useMarketSocket';
import { GrowwHeader } from './components/GrowwHeader';
import { GrowwSubNav } from './components/GrowwSubNav';
import { GrowwExploreView } from './components/GrowwExploreView';
import { GrowwHoldingsView } from './components/GrowwHoldingsView';
import { GrowwTerminalView } from './components/GrowwTerminalView';
import { OptionChainView } from './components/OptionChainView';
import { OrdersPositionsView } from './components/OrdersPositionsView';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { UserProfileModal } from './components/UserProfileModal';
import { McxCommodityView } from './components/McxCommodityView';

// GoGrow Mobile App View Components (from Frontend/mobileapp)
import { MobileBottomNav } from './components/mobile/MobileBottomNav';
import { MobileHomeView } from './components/mobile/MobileHomeView';
import { MobilePortfolioView } from './components/mobile/MobilePortfolioView';
import { MobileProfileView } from './components/mobile/MobileProfileView';
import { MobileOrderModal } from './components/mobile/MobileOrderModal';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  
  // Responsive / Mobile View Mode State
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(window.innerWidth < 768);
  const [activeMobileTab, setActiveMobileTab] = useState<'HOME' | 'PORTFOLIO' | 'ORDERS' | 'PROFILE'>('HOME');
  
  // Mobile Quick Order Modal State
  const [selectedMobileStock, setSelectedMobileStock] = useState<{ name: string; symbol: string; price: number } | null>(null);
  const [isMobileOrderModalOpen, setIsMobileOrderModalOpen] = useState<boolean>(false);

  // Desktop Groww Category & Sub-View State
  const [activeCategory, setActiveCategory] = useState<'STOCKS' | 'FO' | 'MUTUAL_FUNDS' | 'COMMODITIES'>('STOCKS');
  const [activeSubView, setActiveSubView] = useState<'EXPLORE' | 'HOLDINGS' | 'POSITIONS' | 'ORDERS' | 'WATCHLIST' | 'ADMIN'>('EXPLORE');
  const [isTerminalMode, setIsTerminalMode] = useState<boolean>(false);

  const [terminalToken, setTerminalToken] = useState<string>('NSE_RELIANCE');
  const [terminalSymbol, setTerminalSymbol] = useState<string>('RELIANCE');
  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());
  
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Detect Mobile Viewport
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchWallet = () => {
    if (!token) return;
    fetch('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
          setWallet(data.wallet);
        } else {
          handleLogout();
        }
      });
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
          if (message.type === 'TICK_SNAPSHOT' && Array.isArray(message.data)) {
            setTicks(prev => {
              const next = new Map(prev);
              message.data.forEach((t: MarketTick) => next.set(t.instrumentToken, t));
              return next;
            });
          } else if (message.type === 'MARKET_TICK' && message.data) {
            setTicks(prev => {
              const next = new Map(prev);
              next.set(message.data.instrumentToken, message.data);
              return next;
            });
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        if (isComponentMounted) {
          // Schedule auto-reconnection after 2 seconds
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

  // ── 1. GOGROW MOBILE APP VIEW (FOR MOBILE VIEWPORTS < 768PX) ────────────────
  if (isMobileScreen) {
    return (
      <MarketSocketProvider userToken={token}>
        <div className="min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] font-sans flex flex-col">
          {/* Mobile View Container */}
          <div className="flex-1 max-w-md mx-auto w-full">
            {activeMobileTab === 'HOME' && (
              <MobileHomeView
                user={user}
                ticks={ticks}
                onOpenSearch={() => setIsSearchOpen(true)}
                onSelectStock={(symbol, name, price) => {
                  setSelectedMobileStock({ symbol, name, price });
                  setIsMobileOrderModalOpen(true);
                }}
              />
            )}

            {activeMobileTab === 'PORTFOLIO' && (
              <MobilePortfolioView
                ticks={ticks}
                onBack={() => setActiveMobileTab('HOME')}
                onSelectStock={(symbol, name, price) => {
                  setSelectedMobileStock({ symbol, name, price });
                  setIsMobileOrderModalOpen(true);
                }}
              />
            )}

            {activeMobileTab === 'ORDERS' && (
              <div className="p-4 pb-24">
                <OrdersPositionsView token={token} initialTab="ORDERS" onRefreshWallet={fetchWallet} />
              </div>
            )}

            {activeMobileTab === 'PROFILE' && (
              <MobileProfileView
                user={user}
                onBack={() => setActiveMobileTab('HOME')}
                onLogout={handleLogout}
              />
            )}
          </div>

          {/* GoGrow Mobile Bottom Navigation Bar */}
          <MobileBottomNav
            activeTab={activeMobileTab}
            onSelectTab={(tab) => setActiveMobileTab(tab)}
            onOpenTradeModal={() => {
              setSelectedMobileStock({ name: 'ICICI Bank', symbol: 'NSE_ICICIBANK', price: 127.00 });
              setIsMobileOrderModalOpen(true);
            }}
          />

          {/* Mobile Order Confirmation Modal */}
          {selectedMobileStock && (
            <MobileOrderModal
              isOpen={isMobileOrderModalOpen}
              onClose={() => setIsMobileOrderModalOpen(false)}
              stockName={selectedMobileStock.name}
              stockSymbol={selectedMobileStock.symbol}
              stockPrice={selectedMobileStock.price}
              onConfirmSuccess={() => fetchWallet()}
            />
          )}

          {/* Global Search Modal */}
          <GlobalSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelectSymbol={(selectedToken, selectedSymbol) => {
              setSelectedMobileStock({ name: selectedSymbol, symbol: selectedToken, price: 297.64 });
              setIsMobileOrderModalOpen(true);
            }}
            onSelectTab={() => {}}
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
          walletBalance={wallet?.cashBalance || 295.41}
          activeCategory={activeCategory}
          onCategorySelect={(cat) => {
            setActiveCategory(cat);
            if (cat === 'FO') setIsTerminalMode(true);
          }}
          onOpenSearch={() => setIsSearchOpen(true)}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenWalletModal={() => setIsProfileModalOpen(true)}
          onNavigateView={(v) => {
            setIsTerminalMode(false);
            setActiveSubView(v);
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
          ticks={ticks}
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
                      onSelectSymbol={(sym) => {
                        setTerminalSymbol(sym);
                        setIsTerminalMode(true);
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
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xs">
                      <OptionChainView
                        token={token}
                        ticks={ticks}
                        onRefreshWallet={fetchWallet}
                      />
                    </div>
                  )}

                  {activeSubView === 'ADMIN' && (
                    <AdminPanel token={token} />
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
            onClose={() => setIsProfileModalOpen(false)}
            onLogout={handleLogout}
            onRefreshWallet={fetchWallet}
          />
        )}

      </div>
    </MarketSocketProvider>
  );
}
