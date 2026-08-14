import React, { useState } from 'react';
import {
  Search, Bell, HelpCircle, Settings, User as UserIcon, Briefcase,
  TrendingUp, List, Grid, HelpCircle as SupportIcon, ShoppingCart,
  ArrowUp, ArrowDown, Activity, Sun, Moon
} from 'lucide-react';
import { MarketTick, Wallet } from '../types';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';

interface GrowwTerminalViewProps {
  token: string | null;
  ticks?: Map<string, MarketTick>;
  wallet: Wallet | null;
  onRefreshWallet: () => void;
  initialSymbol?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const GrowwTerminalView: React.FC<GrowwTerminalViewProps> = ({
  token,
  ticks: propsTicks,
  wallet,
  onRefreshWallet,
  initialSymbol = 'RELIANCE',
  theme = 'dark',
  onToggleTheme,
}) => {
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE');
  const [activeWatchlistTab, setActiveWatchlistTab] = useState<'DEFAULT' | 'FO' | 'CUSTOM'>('DEFAULT');
  const [timeframe, setTimeframe] = useState<string>('1D');
  const [chartType, setChartType] = useState<'CANDLE' | 'LINE' | 'AREA'>('CANDLE');

  // Order Entry State
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [productType, setProductType] = useState<'MIS' | 'CNC'>('MIS');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL' | 'SL-M'>('LIMIT');
  const [quantity, setQuantity] = useState<number>(1);
  const [priceInput, setPriceInput] = useState<string>('2456.30');
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Watchlist Items
  const watchlistTokens = ['NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_TATAMOTORS'];
  useSubscribeTokens(watchlistTokens);

  const getTick = (sym: string) => {
    return ticks?.get(`NSE_${sym}`) || ticks?.get(sym) || ticks?.get(`BSE_${sym}`);
  };

  const currentTick = getTick(selectedSymbol);
  const currentLtp = currentTick ? currentTick.ltp : (selectedSymbol === 'RELIANCE' ? 2456.30 : 1845.60);
  const currentChange = currentTick ? currentTick.change : 45.60;
  const currentChangePct = currentTick ? currentTick.changePercent : 1.89;

  // Handle Order Execution
  const handlePlaceOrder = async () => {
    if (!token) return;
    setOrderSubmitting(true);
    setActionMessage(null);

    const execPrice = orderType === 'MARKET' ? currentLtp : parseFloat(priceInput || `${currentLtp}`);

    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exchange,
          symbol: selectedSymbol,
          side: orderSide,
          quantity: Number(quantity),
          price: execPrice,
          orderType,
          productType
        })
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: `Order Executed: ${orderSide} ${quantity} ${selectedSymbol} @ ₹${execPrice.toFixed(2)}`
        });
        onRefreshWallet();
      } else {
        setActionMessage({
          type: 'error',
          text: `Order Rejected: ${data.error?.message || 'RMS Limit Exceeded'}`
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Order Failed: ${err.message}`
      });
    } finally {
      setOrderSubmitting(false);
    }
  };

  const watchlistData = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', fallbackPrice: 2456.30, fallbackPct: 1.9 },
    { symbol: 'TCS', name: 'Tata Consultancy', exchange: 'NSE', fallbackPrice: 4125.80, fallbackPct: 1.2 },
    { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', fallbackPrice: 1845.60, fallbackPct: 2.8 },
    { symbol: 'HDFC BANK', name: 'HDFC Bank', exchange: 'NSE', fallbackPrice: 1670.25, fallbackPct: -0.5 },
    { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE', fallbackPrice: 985.40, fallbackPct: 3.2 },
  ];

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col bg-[var(--bg-body)] text-[var(--text-main)] font-body select-none">
      
      {/* ============================================================ */}
      {/* 1. TOP TERMINAL HEADER BAR */}
      {/* ============================================================ */}
      <nav className="h-14 flex justify-between items-center px-4 bg-[var(--bg-surface)] border-b border-[var(--border-color)] shrink-0 z-40">
        
        {/* Left: Brand & Main Navigation Links */}
        <div className="flex items-center gap-6">
          <div className="text-xl font-headline font-black text-[#00E676] tracking-tight flex items-center gap-2">
            {/* Trade Grow Logo */}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-sm shadow-emerald-500/30">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M4 18 L10 10 L14 14 L20 6" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 4 C18 4 22 4 22 8 C22 8 18 8 18 4Z" fill="#A7F3D0" opacity="0.9"/>
                <polyline points="16,6 20,6 20,10" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span>Trade<span className="text-white">Grow</span></span>
          </div>

          <div className="hidden md:flex items-center gap-6 font-headline">
            <button className="font-bold text-sm tracking-tight text-[#00E676] border-b-2 border-[#00E676] pb-1 pt-1">
              Stocks
            </button>
            <button className="font-bold text-sm tracking-tight text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors pb-1 pt-1">
              F&O
            </button>
            <button className="font-bold text-sm tracking-tight text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors pb-1 pt-1">
              Commodities
            </button>
          </div>
        </div>

        {/* Center/Right: Search, Margin & Profile */}
        <div className="flex items-center gap-4">
          
          {/* Search Bar */}
          <div className="relative hidden lg:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search (Ctrl+K)"
              className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs rounded-md pl-8 pr-3 py-1.5 w-48 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#00E676] transition-all font-body"
            />
          </div>

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[#00E676] transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Toggle Light / Dark Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              <span className="hidden xl:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          )}

          {/* Wallet Margin Chip */}
          <div className="text-xs font-label font-medium flex items-center gap-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg tabular-nums">
            <span className="text-[var(--text-muted)]">Margin:</span>
            <span className="text-[var(--text-main)] font-bold">₹{(wallet?.cashBalance || 124500.00).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          {/* Header Action Icons */}
          <div className="flex items-center gap-2">
            <button className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] p-1.5 rounded-lg transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <button className="text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] p-1.5 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-xs font-bold text-[#00E676]">
              <UserIcon className="w-4 h-4" />
            </div>
          </div>

        </div>
      </nav>

      {/* ============================================================ */}
      {/* 2. THREE-COLUMN TERMINAL WORKSPACE */}
      {/* ============================================================ */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* COLUMN 1: LEFT SIDEBAR & WATCHLIST PANEL */}
        <div className="w-16 flex-shrink-0 flex flex-col items-center bg-[var(--bg-body)] border-r border-[var(--border-color)] py-4 justify-between hidden md:flex z-30">
          <div className="w-full flex flex-col items-center gap-1">
            <button className="flex flex-col items-center justify-center bg-[var(--bg-surface)] text-[#00E676] border-l-4 border-[#00E676] w-full py-3.5 transition-all">
              <Activity className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold">Explore</span>
            </button>

            <button className="flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] w-full py-3.5 transition-all">
              <Briefcase className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold">Holdings</span>
            </button>

            <button className="flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] w-full py-3.5 transition-all">
              <TrendingUp className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold">Positions</span>
            </button>

            <button className="flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] w-full py-3.5 transition-all">
              <List className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold">Orders</span>
            </button>

            <button className="flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] w-full py-3.5 transition-all">
              <Grid className="w-4 h-4 mb-1" />
              <span className="text-[10px] font-bold">Options</span>
            </button>
          </div>

          <div className="w-full flex flex-col items-center gap-2">
            <button className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-2">
              <SupportIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Watchlist List Panel */}
        <div className="w-72 flex-shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col">
          
          {/* Watchlist Search & Tabs */}
          <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-body)]">
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search eg: INFY BSE, NIFTY FUT"
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs rounded pl-8 pr-6 py-1.5 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#00E676] font-body"
              />
              <span className="absolute right-2 top-1.5 text-[var(--text-muted)] text-[10px] border border-[var(--border-color)] px-1 rounded font-mono">/</span>
            </div>

            <div className="flex text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] font-headline">
              <button
                onClick={() => setActiveWatchlistTab('DEFAULT')}
                className={`pb-1.5 mr-4 border-b-2 transition-colors ${
                  activeWatchlistTab === 'DEFAULT' ? 'border-[#00E676] text-[#00E676]' : 'border-transparent hover:text-[var(--text-main)]'
                }`}
              >
                DEFAULT <span className="text-[9px] bg-[var(--bg-surface-elevated)] px-1 py-0.5 rounded ml-1 text-[var(--text-main)]">50</span>
              </button>
              <button
                onClick={() => setActiveWatchlistTab('FO')}
                className={`pb-1.5 mr-4 border-b-2 transition-colors ${
                  activeWatchlistTab === 'FO' ? 'border-[#00E676] text-[#00E676]' : 'border-transparent hover:text-[var(--text-main)]'
                }`}
              >
                F&O <span className="text-[9px] bg-[var(--bg-surface-elevated)] px-1 py-0.5 rounded ml-1">0</span>
              </button>
              <button
                onClick={() => setActiveWatchlistTab('CUSTOM')}
                className={`pb-1.5 border-b-2 transition-colors ${
                  activeWatchlistTab === 'CUSTOM' ? 'border-[#00E676] text-[#00E676]' : 'border-transparent hover:text-[var(--text-main)]'
                }`}
              >
                CUSTOM <span className="text-[9px] bg-[var(--bg-surface-elevated)] px-1 py-0.5 rounded ml-1">0</span>
              </button>
            </div>
          </div>

          {/* Watchlist Stock Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]">
            {watchlistData.map((stock) => {
              const tick = getTick(stock.symbol);
              const price = tick ? tick.ltp : stock.fallbackPrice;
              const changePct = tick ? tick.changePercent : stock.fallbackPct;
              const isGain = changePct >= 0;
              const isSelected = selectedSymbol === stock.symbol;

              return (
                <div
                  key={stock.symbol}
                  onClick={() => {
                    setSelectedSymbol(stock.symbol);
                    setPriceInput(price.toFixed(2));
                  }}
                  className={`flex justify-between items-center p-3 border-l-2 cursor-pointer group transition-colors relative ${
                    isSelected
                      ? 'bg-[var(--bg-surface-elevated)] border-l-[#00E676]'
                      : 'border-l-transparent hover:bg-[var(--bg-surface-elevated)]/60'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-headline font-bold text-sm tracking-wide text-[var(--text-main)]">{stock.symbol}</span>
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5">{stock.exchange}</span>
                  </div>

                  <div className="flex flex-col items-end font-label tabular-nums">
                    <span className={`text-sm font-bold ${isGain ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                      {price.toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-semibold flex items-center mt-0.5 ${isGain ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                      {isGain ? <ArrowUp className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDown className="w-2.5 h-2.5 mr-0.5" />}
                      {Math.abs(changePct).toFixed(1)}%
                    </span>
                  </div>

                  {/* Hover Quick Action Buttons */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-surface-elevated)] pl-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSymbol(stock.symbol);
                        setOrderSide('BUY');
                      }}
                      className="bg-[#00E676]/20 text-[#00E676] hover:bg-[#00E676] hover:text-[#0D1117] text-xs font-extrabold px-2 py-1 rounded transition-colors"
                    >
                      B
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSymbol(stock.symbol);
                        setOrderSide('SELL');
                      }}
                      className="bg-[#FF5252]/20 text-[#FF5252] hover:bg-[#FF5252] hover:text-white text-xs font-extrabold px-2 py-1 rounded transition-colors"
                    >
                      S
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 text-[10px] text-[var(--text-muted)] text-center border-t border-[var(--border-color)] bg-[var(--bg-body)]">
            Data is real-time. Settings ⚙️
          </div>
        </div>

        {/* COLUMN 2: CENTER CHART WORKSPACE */}
        <div className="flex-1 flex flex-col min-w-[450px] bg-[var(--bg-surface)] relative z-10">
          
          {/* Chart Header Bar */}
          <div className="h-12 border-b border-[var(--border-color)] flex items-center justify-between px-4 bg-[var(--bg-surface)] shrink-0 font-headline">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-wide text-[var(--text-main)]">{selectedSymbol}</span>
                <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-body)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                  {exchange}
                </span>
              </div>

              <div className="flex items-center gap-2 font-label tabular-nums">
                <span className="text-base font-bold text-[var(--text-main)]">₹{currentLtp.toFixed(2)}</span>
                <span className={`text-xs font-bold ${currentChange >= 0 ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
                  {currentChange >= 0 ? '+' : ''}{currentChange.toFixed(2)} ({currentChangePct >= 0 ? '+' : ''}{currentChangePct.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Timeframe & Chart Style Toolbar */}
            <div className="flex items-center gap-2">
              <div className="flex bg-[var(--bg-body)] border border-[var(--border-color)] rounded p-0.5 text-xs font-semibold">
                {['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M'].map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      timeframe === tf ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-[var(--border-color)] mx-1" />

              <button className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold px-2.5 py-1 border border-[var(--border-color)] rounded bg-[var(--bg-body)]">
                <span>+ Indicators</span>
              </button>
            </div>
          </div>

          {/* Indicator Badges Overlay */}
          <div className="absolute top-14 left-14 z-20 flex flex-col gap-1.5 pointer-events-none">
            <div className="bg-[var(--bg-body)]/90 backdrop-blur-sm border border-[var(--border-color)] rounded px-2.5 py-1 text-[10px] flex items-center gap-2 pointer-events-auto shadow-md">
              <div className="w-2 h-2 rounded-full bg-[#448AFF]"></div>
              <span className="font-medium text-[var(--text-muted)]">SMA 20</span>
              <span className="font-label tabular-nums text-[var(--text-main)]">2385.40</span>
            </div>
            <div className="bg-[var(--bg-body)]/90 backdrop-blur-sm border border-[var(--border-color)] rounded px-2.5 py-1 text-[10px] flex items-center gap-2 pointer-events-auto shadow-md">
              <div className="w-2 h-2 rounded-full bg-[#FF6D00]"></div>
              <span className="font-medium text-[var(--text-muted)]">SMA 50</span>
              <span className="font-label tabular-nums text-[var(--text-main)]">2310.20</span>
            </div>
          </div>

          {/* Main Chart Area */}
          <div className="flex-1 flex relative">
            
            {/* Drawing Tools Sidebar */}
            <div className="w-10 border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col items-center py-3 gap-3 z-20 shrink-0 text-[var(--text-muted)]">
              <button className="hover:text-[var(--text-main)] p-1" title="Cursor">⊹</button>
              <button className="text-[#00E676] bg-[#00E676]/10 p-1.5 rounded" title="Trend Line">⎯</button>
              <button className="hover:text-[var(--text-main)] p-1" title="Fibonacci">≡</button>
              <button className="hover:text-[var(--text-main)] p-1" title="Brush">🖌️</button>
              <button className="hover:text-[var(--text-main)] p-1" title="Text">T</button>
            </div>

            {/* Simulated Candlestick Chart Area (SVG) */}
            <div className="flex-1 bg-[var(--bg-surface-elevated)] relative overflow-hidden">
              <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="chartGridPattern" width="80" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 80 0 L 0 0 0 40" fill="none" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2,2" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#chartGridPattern)" />

                {/* Dashed Price Level Marker */}
                <line x1="0" y1="42%" x2="100%" y2="42%" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="4,4" />

                {/* SMA Curves */}
                <path d="M 0,220 Q 150,240 300,190 T 600,160 T 900,130" fill="none" stroke="#448AFF" strokeWidth="1.5" />
                <path d="M 0,270 Q 200,280 400,230 T 800,210" fill="none" stroke="#FF6D00" strokeWidth="1.5" />

                {/* Candlestick Graphics */}
                <g transform="translate(60, 0)">
                  <line x1="40" y1="260" x2="40" y2="160" stroke="#00E676" strokeWidth="1.5" />
                  <rect x="34" y="180" width="12" height="60" fill="#00E676" rx="1" />

                  <line x1="90" y1="170" x2="90" y2="230" stroke="#FF5252" strokeWidth="1.5" />
                  <rect x="84" y="190" width="12" height="30" fill="#FF5252" rx="1" />

                  <line x1="140" y1="210" x2="140" y2="110" stroke="#00E676" strokeWidth="1.5" />
                  <rect x="134" y="130" width="12" height="60" fill="#00E676" rx="1" />
                </g>

                {/* Live Price Tag */}
                <g transform="translate(0, 0)">
                  <rect x="calc(100% - 75px)" y="calc(42% - 12px)" width="65" height="24" fill="var(--bg-surface)" stroke="#00E676" strokeWidth="1" rx="4" />
                  <text x="calc(100% - 68px)" y="calc(42% + 4px)" fill="#00E676" fontFamily="Space Grotesk" fontSize="11" fontWeight="bold">
                    {currentLtp.toFixed(2)}
                  </text>
                </g>
              </svg>

              {/* Y-Axis Price Scale */}
              <div className="absolute top-0 bottom-6 right-0 w-[60px] bg-[var(--bg-surface)] border-l border-[var(--border-color)] flex flex-col justify-between py-4 text-[10px] text-[var(--text-muted)] font-label items-end pr-2 font-semibold">
                <span>2500.00</span>
                <span>2480.00</span>
                <span>2460.00</span>
                <span className="text-[#00E676] bg-[#00E676]/10 px-1 rounded font-bold">2456.30</span>
                <span>2440.00</span>
                <span>2420.00</span>
                <span>2400.00</span>
              </div>

              {/* X-Axis Time Scale */}
              <div className="absolute bottom-0 left-0 right-[60px] h-6 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex justify-between px-8 text-[10px] text-[var(--text-muted)] font-label items-center font-semibold">
                <span>09:15</span>
                <span>10:30</span>
                <span>11:45</span>
                <span>13:00</span>
                <span>14:15</span>
                <span>15:30</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: RIGHT ORDER ENTRY & MARKET DEPTH PANEL */}
        <div className="w-80 flex-shrink-0 bg-[var(--bg-surface)] border-l border-[var(--border-color)] flex flex-col overflow-y-auto">
          
          {/* Order Placement Form */}
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-body)] relative">
            <div className="absolute top-3 right-3 bg-[#00E676]/20 text-[#00E676] text-[9px] font-extrabold px-2 py-0.5 rounded border border-[#00E676]/30 font-headline uppercase">
              Live Trading Mode
            </div>

            <h3 className="font-headline font-bold text-lg text-[var(--text-main)] mb-4">Place Order</h3>

            {/* BUY / SELL TOGGLE */}
            <div className="flex rounded-xl p-1 bg-[var(--bg-surface)] border border-[var(--border-color)] mb-4 font-headline">
              <button
                onClick={() => setOrderSide('BUY')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  orderSide === 'BUY'
                    ? 'bg-[#00E676] text-[#0D1117] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setOrderSide('SELL')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  orderSide === 'SELL'
                    ? 'bg-[#FF5252] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                SELL
              </button>
            </div>

            {/* QTY & PRICE INPUTS */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 font-headline">
                  QTY
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-label font-bold text-[var(--text-main)] focus:outline-none focus:border-[#00E676] tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1 font-headline">
                  PRICE (₹)
                </label>
                <input
                  type="number"
                  step="0.05"
                  disabled={orderType === 'MARKET'}
                  value={orderType === 'MARKET' ? currentLtp.toFixed(2) : priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-label font-bold text-[var(--text-main)] focus:outline-none focus:border-[#00E676] tabular-nums disabled:opacity-50"
                />
              </div>
            </div>

            {/* MARGIN REQUIRED */}
            <div className="flex justify-between items-center text-xs mb-4 p-2.5 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-color)] font-label">
              <span className="text-[var(--text-muted)]">Margin Required</span>
              <span className="text-[var(--text-main)] font-bold tabular-nums">
                ₹{((orderType === 'MARKET' ? currentLtp : parseFloat(priceInput || '0')) * quantity / (productType === 'MIS' ? 5 : 1)).toFixed(2)}
                <span className="text-[var(--text-muted)] text-[10px] ml-1">({productType === 'MIS' ? '5x' : '1x'})</span>
              </span>
            </div>

            {/* Action Feedback Notification */}
            {actionMessage && (
              <div className={`mb-3 p-2.5 rounded-xl text-xs font-bold border ${
                actionMessage.type === 'success' ? 'bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]' : 'bg-[#FF5252]/10 border-[#FF5252]/30 text-[#FF5252]'
              }`}>
                {actionMessage.text}
              </div>
            )}

            {/* PLACE ORDER BUTTON */}
            <button
              onClick={handlePlaceOrder}
              disabled={orderSubmitting}
              className={`w-full py-3 rounded-xl font-headline font-black text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${
                orderSide === 'BUY'
                  ? 'bg-[#00E676] hover:bg-[#00C853] text-[#0D1117] shadow-[#00E676]/20'
                  : 'bg-[#FF5252] hover:bg-rose-600 text-white shadow-[#FF5252]/20'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{orderSubmitting ? 'Submitting...' : `Place ${orderSide} Order`}</span>
            </button>
          </div>

          {/* MARKET DEPTH TABLE */}
          <div className="p-4 flex-1">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-headline font-bold text-sm text-[var(--text-main)]">Market Depth</h4>
              <span className="text-[10px] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] px-1.5 py-0.5 rounded font-mono border border-[var(--border-color)]">L2</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-label">
              <div>
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-2 border-b border-[var(--border-color)] pb-1 uppercase tracking-wider font-bold">
                  <span>Bid Qty</span>
                  <span>Bid</span>
                </div>
                <div className="space-y-1 relative">
                  {[
                    { qty: '1,245', price: (currentLtp - 0.50).toFixed(2), width: '85%' },
                    { qty: '840', price: (currentLtp - 0.70).toFixed(2), width: '60%' },
                    { qty: '2,100', price: (currentLtp - 0.90).toFixed(2), width: '95%' },
                  ].map((bid, i) => (
                    <div key={i} className="flex justify-between py-1 relative">
                      <div className="absolute inset-y-0 right-0 bg-[#00E676]/10 rounded-sm" style={{ width: bid.width }}></div>
                      <span className="tabular-nums text-[var(--text-muted)] relative z-10 pl-1">{bid.qty}</span>
                      <span className="tabular-nums text-[#00E676] relative z-10 pr-1 font-bold">{bid.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-2 border-b border-[var(--border-color)] pb-1 uppercase tracking-wider font-bold">
                  <span>Ask</span>
                  <span>Ask Qty</span>
                </div>
                <div className="space-y-1 relative">
                  {[
                    { price: (currentLtp + 0.50).toFixed(2), qty: '450', width: '40%' },
                    { price: (currentLtp + 0.70).toFixed(2), qty: '1,120', width: '75%' },
                    { price: (currentLtp + 0.90).toFixed(2), qty: '180', width: '20%' },
                  ].map((ask, i) => (
                    <div key={i} className="flex justify-between py-1 relative">
                      <div className="absolute inset-y-0 left-0 bg-[#FF5252]/10 rounded-sm" style={{ width: ask.width }}></div>
                      <span className="tabular-nums text-[#FF5252] relative z-10 pl-1 font-bold">{ask.price}</span>
                      <span className="tabular-nums text-[var(--text-muted)] relative z-10 pr-1">{ask.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
