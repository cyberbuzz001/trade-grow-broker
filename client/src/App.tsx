import React, { useState, useEffect } from 'react';
import { User, Wallet, MarketTick } from './types';
import { TradingTerminal } from './components/TradingTerminal';
import { OptionChainView } from './components/OptionChainView';
import { MarketDepthView } from './components/MarketDepthView';
import { PortfolioAnalyticsView } from './components/PortfolioAnalyticsView';
import { OrdersPositionsView } from './components/OrdersPositionsView';
import { MarketScanner } from './components/MarketScanner';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { UserProfileModal } from './components/UserProfileModal';
import {
  TrendingUp, LayoutGrid, BarChart2, Bookmark, Layers, Receipt, Briefcase, Wallet as WalletIcon,
  PieChart, Building2, Shapes, Rocket, Bell, FileText, Headset, Sliders, Search, Moon, Sun,
  ShieldAlert, LogOut, ChevronLeft, ChevronRight, AlertTriangle, Plus, Menu, X
} from 'lucide-react';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [activeView, setActiveView] = useState<'TERMINAL' | 'POSITIONS' | 'OPTION_CHAIN' | 'MARKET_DEPTH' | 'PORTFOLIO' | 'ORDERS' | 'SCANNER' | 'ADMIN'>('OPTION_CHAIN');
  const [terminalToken, setTerminalToken] = useState<string>('NSE_RELIANCE');
  const [terminalSymbol, setTerminalSymbol] = useState<string>('RELIANCE');
  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Toggle Theme
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

  const handleTradeOptionFromChain = async (
    symbol: string,
    side: 'BUY' | 'SELL',
    price: number,
    strike: number,
    optionType: 'CE' | 'PE'
  ) => {
    if (!token) return;
    try {
      const isBanknifty = symbol.includes('BANKNIFTY');
      const lotSize = isBanknifty ? 15 : 25;
      const underlying = isBanknifty ? 'BANKNIFTY' : 'NIFTY';
      const tokenSymbol = `NFO_${underlying}_${strike}_${optionType}`;

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          instrumentToken: tokenSymbol,
          exchange: 'NFO',
          symbol,
          side,
          quantity: lotSize,
          price,
          orderType: 'MARKET',
          productType: 'MIS'
        })
      });

      const data = await res.json();
      if (data.success) {
        fetchWallet();
        setActiveView('ORDERS');
      } else {
        alert(`Option Order Rejected: ${data.error?.message}`);
      }
    } catch (err: any) {
      alert(`Option Order Error: ${err.message}`);
    }
  };

  useEffect(() => {
    if (token) fetchWallet();
  }, [token]);

  // WebSocket Live Market Data Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${token}` : ''}`;
    const ws = new WebSocket(wsUrl);

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
      } catch (err) {
        // Parse error ignored
      }
    };

    return () => ws.close();
  }, [token]);

  const handleLoginSuccess = (authToken: string, authUser: User) => {
    localStorage.setItem('token', authToken);
    setToken(authToken);
    setUser(authUser);
    fetchWallet();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setWallet(null);
    setIsProfileOpen(false);
  };

  const handleNavClick = (view: any) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  if (!token || !user) {
    return <AuthModal onSuccess={handleLoginSuccess} />;
  }

  const getInitials = (name: string) => {
    return name ? name.slice(0, 2).toUpperCase() : 'US';
  };

  const niftyTick = ticks.get('NSE_NIFTY50');
  const bankNiftyTick = ticks.get('NSE_BANKNIFTY');

  return (
    <div className="flex min-h-screen bg-[var(--bg-body)] text-[var(--text-main)] transition-colors">
      
      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 1. TRADEGROW SIDEBAR NAVIGATION (Desktop + Mobile Drawer) */}
      <aside className={`fixed left-0 top-0 h-screen z-50 bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col transition-all duration-300 ${
        isMobileMenuOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0'
      } ${isSidebarCollapsed ? 'md:w-[72px]' : 'md:w-[240px]'}`}>
        
        {/* Brand Header */}
        <div className="h-[70px] px-5 flex items-center justify-between border-b border-[var(--border-light)]">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick('TERMINAL')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-[var(--text-main)] to-indigo-600 bg-clip-text text-transparent">
                TradeGrow
              </span>
            )}
          </div>
          {/* Mobile Close Button */}
          <button className="md:hidden text-[var(--text-muted)] hover:text-[var(--text-main)]" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Main Group */}
          <div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] px-3 mb-2">Main</div>}
            <nav className="space-y-1">
              <button
                onClick={() => handleNavClick('TERMINAL')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'TERMINAL' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border-l-4 border-indigo-600' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'}`}
              >
                <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Dashboard</span>}
              </button>

              <button
                onClick={() => handleNavClick('SCANNER')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'SCANNER' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border-l-4 border-indigo-600' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'}`}
              >
                <BarChart2 className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Markets</span>}
              </button>

              <button
                onClick={() => handleNavClick('OPTION_CHAIN')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'OPTION_CHAIN' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border-l-4 border-indigo-600' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'}`}
              >
                <Layers className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Option Chain</span>}
              </button>
            </nav>
          </div>

          {/* Trading Group */}
          <div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] px-3 mb-2">Trading</div>}
            <nav className="space-y-1">
              <button
                onClick={() => handleNavClick('ORDERS')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'ORDERS' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border-l-4 border-indigo-600' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'}`}
              >
                <Receipt className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Orders</span>}
              </button>

              <button
                onClick={() => handleNavClick('POSITIONS')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'POSITIONS' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border-l-4 border-indigo-600' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'}`}
              >
                <Briefcase className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Positions</span>}
              </button>

              <button
                onClick={() => handleNavClick('PORTFOLIO')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'PORTFOLIO' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border-l-4 border-indigo-600' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'}`}
              >
                <PieChart className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Portfolio</span>}
              </button>

              <button
                onClick={() => handleNavClick('MARKET_DEPTH')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'MARKET_DEPTH' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border-l-4 border-indigo-600' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'}`}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Level-2 Depth</span>}
              </button>
            </nav>
          </div>

          {/* Admin Group */}
          {['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'RISK_MANAGER'].includes(user.role) && (
            <div>
              {(!isSidebarCollapsed || isMobileMenuOpen) && <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] px-3 mb-2">Admin</div>}
              <button
                onClick={() => handleNavClick('ADMIN')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${activeView === 'ADMIN' ? 'bg-amber-500/10 text-amber-500 font-bold border-l-4 border-amber-500' : 'text-amber-500/80 hover:bg-[var(--bg-surface-elevated)] hover:text-amber-500'}`}
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && <span>Control Center</span>}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer (Desktop only toggle) */}
        <div className="hidden md:block p-3 border-t border-[var(--border-light)]">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] text-xs font-semibold hover:text-[var(--text-main)] hover:border-indigo-500 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /> <span>Collapse Menu</span></>}
          </button>
        </div>
      </aside>

      {/* 2. MAIN VIEWPORT */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
        isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[240px]'
      } ml-0 pb-16 md:pb-0`}>
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-[70px] bg-[var(--bg-glass)] backdrop-blur-md border-b border-[var(--border-color)] px-4 md:px-6 flex items-center justify-between gap-3">
          
          {/* Mobile Hamburger Menu Toggle */}
          <button
            className="md:hidden w-10 h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] flex items-center justify-center hover:text-[var(--text-main)]"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Global Search Bar */}
          <div className="flex-1 max-w-md relative">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between px-3 md:px-4 py-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] text-xs hover:border-indigo-500 hover:bg-[var(--bg-surface)] transition-all"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                <span className="truncate">Search stocks, indices, ETFs...</span>
              </div>
              <kbd className="hidden sm:inline-block bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] font-bold text-[var(--text-tertiary)] px-2 py-0.5 rounded-md font-mono">Ctrl K</kbd>
            </button>
          </div>

          {/* Real-time Tickers (Desktop) */}
          <div className="hidden xl:flex items-center gap-6 text-xs font-semibold">
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-[var(--text-tertiary)] tracking-wider">NIFTY 50</span>
              <div className="flex items-center gap-1.5 num-font">
                <span className="font-bold text-[var(--text-main)]">
                  {niftyTick ? niftyTick.ltp.toFixed(2) : '24,550.00'}
                </span>
                <span className={`font-bold text-[11px] ${niftyTick ? (niftyTick.change >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-emerald-500'}`}>
                  {niftyTick ? `${niftyTick.change >= 0 ? '+' : ''}${niftyTick.changePercent.toFixed(2)}%` : '+0.33%'}
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold text-[var(--text-tertiary)] tracking-wider">BANK NIFTY</span>
              <div className="flex items-center gap-1.5 num-font">
                <span className="font-bold text-[var(--text-main)]">
                  {bankNiftyTick ? bankNiftyTick.ltp.toFixed(2) : '52,300.00'}
                </span>
                <span className={`font-bold text-[11px] ${bankNiftyTick ? (bankNiftyTick.change >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-emerald-500'}`}>
                  {bankNiftyTick ? `${bankNiftyTick.change >= 0 ? '+' : ''}${bankNiftyTick.changePercent.toFixed(2)}%` : '+0.35%'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Control Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Indicator (Desktop/Tablet) */}
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500"></span>
              Live
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] flex items-center justify-center hover:text-[var(--text-main)] hover:border-indigo-500 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            {/* User Avatar */}
            <div
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-xs sm:text-sm cursor-pointer shadow-md shadow-indigo-500/20 hover:scale-105 transition-transform"
              title="User Profile & Settings"
            >
              {getInitials(user.username)}
            </div>
          </div>
        </header>

        {/* Active Page View Component */}
        <main className="flex-1 p-3 sm:p-6 max-w-[1600px] w-full mx-auto overflow-hidden">
          {activeView === 'TERMINAL' && (
            <TradingTerminal
              token={token}
              ticks={ticks}
              wallet={wallet}
              onRefreshWallet={fetchWallet}
              initialToken={terminalToken}
              initialSymbol={terminalSymbol}
            />
          )}
          {activeView === 'POSITIONS' && (
            <OrdersPositionsView token={token} initialTab="POSITIONS" onRefreshWallet={fetchWallet} />
          )}
          {activeView === 'OPTION_CHAIN' && (
            <OptionChainView token={token} ticks={ticks} onRefreshWallet={fetchWallet} />
          )}
          {activeView === 'MARKET_DEPTH' && (
            <MarketDepthView ticks={ticks} token={token} />
          )}
          {activeView === 'PORTFOLIO' && (
            <PortfolioAnalyticsView token={token} wallet={wallet} onRefreshWallet={fetchWallet} />
          )}
          {activeView === 'ORDERS' && (
            <OrdersPositionsView token={token} onRefreshWallet={fetchWallet} />
          )}
          {activeView === 'SCANNER' && (
            <MarketScanner onSelectSymbol={() => setActiveView('TERMINAL')} />
          )}
          {activeView === 'ADMIN' && (
            <AdminPanel token={token} />
          )}
        </main>

      </div>

      {/* 3. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav md:hidden">
        <button
          onClick={() => setActiveView('TERMINAL')}
          className={`mobile-nav-btn ${activeView === 'TERMINAL' ? 'active' : ''}`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveView('SCANNER')}
          className={`mobile-nav-btn ${activeView === 'SCANNER' ? 'active' : ''}`}
        >
          <BarChart2 className="w-5 h-5" />
          <span>Markets</span>
        </button>

        <button
          onClick={() => setActiveView('OPTION_CHAIN')}
          className={`mobile-nav-btn ${activeView === 'OPTION_CHAIN' ? 'active' : ''}`}
        >
          <Layers className="w-5 h-5" />
          <span>Options</span>
        </button>

        <button
          onClick={() => setActiveView('ORDERS')}
          className={`mobile-nav-btn ${activeView === 'ORDERS' ? 'active' : ''}`}
        >
          <Receipt className="w-5 h-5" />
          <span>Orders</span>
        </button>

        <button
          onClick={() => setActiveView('PORTFOLIO')}
          className={`mobile-nav-btn ${activeView === 'PORTFOLIO' ? 'active' : ''}`}
        >
          <PieChart className="w-5 h-5" />
          <span>Portfolio</span>
        </button>
      </nav>

      {/* 4. MOBILE FLOATING ACTION BUTTON (FAB) */}
      <button
        onClick={() => setActiveView('TERMINAL')}
        className="mobile-fab md:hidden"
        title="Quick Trade"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectSymbol={(selectedToken, selectedSymbol) => {
          setTerminalToken(selectedToken);
          setTerminalSymbol(selectedSymbol);
          setActiveView('TERMINAL');
        }}
        onSelectTab={(v) => setActiveView(v)}
      />

      {user && (
        <UserProfileModal
          user={user}
          wallet={wallet}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onLogout={handleLogout}
          onRefreshWallet={fetchWallet}
        />
      )}
    </div>
  );
}
