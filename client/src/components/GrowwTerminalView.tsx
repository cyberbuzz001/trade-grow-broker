import React, { useState } from 'react';
import {
  Search, Bell, HelpCircle, Settings, User as UserIcon, Briefcase,
  TrendingUp, List, Grid, HelpCircle as SupportIcon, ShoppingCart,
  ArrowUp, ArrowDown, Activity, Sun, Moon
} from 'lucide-react';
import { MarketTick, Wallet } from '../types';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';
import { TradingChart } from './charts/TradingChart/TradingChart';

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
  const [selectedToken, setSelectedToken] = useState<string>(
    initialSymbol === 'NIFTY 50' ? 'NSE_NIFTY50' : (initialSymbol === 'SENSEX' ? 'BSE_SENSEX' : `NSE_${initialSymbol}`)
  );
  const [exchange, setExchange] = useState<'NSE' | 'BSE'>('NSE');
  const [activeWatchlistTab, setActiveWatchlistTab] = useState<'DEFAULT' | 'FO' | 'CUSTOM'>('DEFAULT');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Order Entry State
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [productType, setProductType] = useState<'MIS' | 'CNC'>('MIS');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL' | 'SL-M'>('LIMIT');
  const [quantity, setQuantity] = useState<number>(1);
  const [priceInput, setPriceInput] = useState<string>('2456.30');
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Default Stocks Watchlist
  const stocksWatchlist = [
    { symbol: 'RELIANCE', token: 'NSE_RELIANCE', name: 'Reliance Industries', exchange: 'NSE' as const, fallbackPrice: 2456.30, fallbackPct: 1.9 },
    { symbol: 'TCS', token: 'NSE_TCS', name: 'Tata Consultancy', exchange: 'NSE' as const, fallbackPrice: 4125.80, fallbackPct: 1.2 },
    { symbol: 'INFY', token: 'NSE_INFY', name: 'Infosys Limited', exchange: 'NSE' as const, fallbackPrice: 1845.60, fallbackPct: 2.8 },
    { symbol: 'HDFCBANK', token: 'NSE_HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' as const, fallbackPrice: 1670.25, fallbackPct: -0.5 },
    { symbol: 'TATAMOTORS', token: 'NSE_TATAMOTORS', name: 'Tata Motors', exchange: 'NSE' as const, fallbackPrice: 985.40, fallbackPct: 3.2 },
    { symbol: 'ICICIBANK', token: 'NSE_ICICIBANK', name: 'ICICI Bank', exchange: 'NSE' as const, fallbackPrice: 1210.50, fallbackPct: 0.8 },
    { symbol: 'SBIN', token: 'NSE_SBIN', name: 'State Bank of India', exchange: 'NSE' as const, fallbackPrice: 840.15, fallbackPct: 1.4 },
    { symbol: 'BHARTIARTL', token: 'NSE_BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE' as const, fallbackPrice: 1480.90, fallbackPct: -0.3 },
  ];

  // F&O Indices & Option Contracts Watchlist
  const foWatchlist = [
    { symbol: 'NIFTY 50', token: 'NSE_NIFTY50', name: 'NIFTY 50 Index', exchange: 'NSE' as const, fallbackPrice: 24328.50, fallbackPct: -0.15 },
    { symbol: 'BANKNIFTY', token: 'NSE_BANKNIFTY', name: 'NIFTY Bank Index', exchange: 'NSE' as const, fallbackPrice: 51840.20, fallbackPct: 0.42 },
    { symbol: 'FINNIFTY', token: 'NSE_FINNIFTY', name: 'FINNIFTY Index', exchange: 'NSE' as const, fallbackPrice: 23890.40, fallbackPct: 0.22 },
    { symbol: 'SENSEX', token: 'BSE_SENSEX', name: 'BSE SENSEX Index', exchange: 'BSE' as const, fallbackPrice: 77882.88, fallbackPct: 0.01 },
    { symbol: 'NIFTY 24500 CE', token: 'NFO_NIFTY_24500_CE', name: 'Nifty 24500 Call Option', exchange: 'NSE' as const, fallbackPrice: 142.50, fallbackPct: 8.5 },
    { symbol: 'NIFTY 24500 PE', token: 'NFO_NIFTY_24500_PE', name: 'Nifty 24500 Put Option', exchange: 'NSE' as const, fallbackPrice: 88.20, fallbackPct: -6.4 },
    { symbol: 'BANKNIFTY 52000 CE', token: 'NFO_BANKNIFTY_52000_CE', name: 'BankNifty 52000 Call', exchange: 'NSE' as const, fallbackPrice: 320.10, fallbackPct: 12.1 },
    { symbol: 'SENSEX 80000 CE', token: 'BFO_SENSEX_80000_CE', name: 'Sensex 80000 Call Option', exchange: 'BSE' as const, fallbackPrice: 215.40, fallbackPct: 4.8 },
  ];

  const currentWatchlist = activeWatchlistTab === 'FO'
    ? foWatchlist
    : (activeWatchlistTab === 'CUSTOM' ? [...stocksWatchlist.slice(0, 3), ...foWatchlist.slice(0, 3)] : stocksWatchlist);

  const filteredWatchlist = searchQuery.trim() === ''
    ? currentWatchlist
    : currentWatchlist.filter(item =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const allTokens = [...stocksWatchlist.map(s => s.token), ...foWatchlist.map(f => f.token)];
  useSubscribeTokens(allTokens);

  const getTick = (tokenKey: string, sym: string) => {
    return ticks?.get(tokenKey) || ticks?.get(`NSE_${sym}`) || ticks?.get(sym) || ticks?.get(`BSE_${sym}`);
  };

  const currentTick = getTick(selectedToken, selectedSymbol);
  const currentLtp = currentTick ? currentTick.ltp : 2456.30;
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

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col bg-[var(--bg-body)] text-[var(--text-main)] font-body select-none">
      
      {/* ============================================================ */}
      {/* 1. TOP TERMINAL HEADER BAR */}
      {/* ============================================================ */}
      <nav className="h-14 flex justify-between items-center px-4 bg-[var(--bg-surface)] border-b border-[var(--border-color)] shrink-0 z-40">
        
        {/* Left: Brand & Main Navigation Links */}
        <div className="flex items-center gap-6">
          <div className="text-xl font-headline font-black text-[#00E676] tracking-tight flex items-center gap-2">
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
            <button
              onClick={() => setActiveWatchlistTab('DEFAULT')}
              className={`font-bold text-sm tracking-tight transition-colors pb-1 pt-1 ${
                activeWatchlistTab === 'DEFAULT' ? 'text-[#00E676] border-b-2 border-[#00E676]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Stocks
            </button>
            <button
              onClick={() => setActiveWatchlistTab('FO')}
              className={`font-bold text-sm tracking-tight transition-colors pb-1 pt-1 ${
                activeWatchlistTab === 'FO' ? 'text-[#00E676] border-b-2 border-[#00E676]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              F&O
            </button>
            <button
              onClick={() => setActiveWatchlistTab('CUSTOM')}
              className={`font-bold text-sm tracking-tight transition-colors pb-1 pt-1 ${
                activeWatchlistTab === 'CUSTOM' ? 'text-[#00E676] border-b-2 border-[#00E676]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Commodities
            </button>
          </div>
        </div>

        {/* Right: Search, Wallet & Theme */}
        <div className="flex items-center gap-4">
          <div className="relative hidden lg:block w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search Nifty, Stocks, F&O contracts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-body)] border border-[var(--border-color)] text-xs rounded-lg pl-9 pr-8 py-2 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#00E676]"
            />
            <span className="absolute right-2.5 top-2 text-[10px] text-[var(--text-muted)] border border-[var(--border-color)] px-1 rounded font-mono">Ctrl+K</span>
          </div>

          <div className="flex items-center gap-2 bg-[var(--bg-body)] border border-[var(--border-color)] px-3 py-1.5 rounded-lg text-xs font-semibold">
            <span className="text-[var(--text-muted)]">Margin:</span>
            <span className="font-bold text-[#00E676]">₹{wallet ? wallet.cashBalance.toLocaleString('en-IN') : '26,908.75'}</span>
          </div>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-body)] border border-[var(--border-color)] rounded-lg transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
          )}
        </div>
      </nav>

      {/* ============================================================ */}
      {/* 2. MAIN THREE-COLUMN TERMINAL LAYOUT */}
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
                placeholder="Search eg: INFY, NIFTY 24500 CE"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                STOCKS <span className="text-[9px] bg-[var(--bg-surface-elevated)] px-1 py-0.5 rounded ml-1 text-[var(--text-main)]">{stocksWatchlist.length}</span>
              </button>
              <button
                onClick={() => setActiveWatchlistTab('FO')}
                className={`pb-1.5 mr-4 border-b-2 transition-colors ${
                  activeWatchlistTab === 'FO' ? 'border-[#00E676] text-[#00E676]' : 'border-transparent hover:text-[var(--text-main)]'
                }`}
              >
                F&O <span className="text-[9px] bg-[var(--bg-surface-elevated)] px-1 py-0.5 rounded ml-1 text-[var(--text-main)]">{foWatchlist.length}</span>
              </button>
              <button
                onClick={() => setActiveWatchlistTab('CUSTOM')}
                className={`pb-1.5 border-b-2 transition-colors ${
                  activeWatchlistTab === 'CUSTOM' ? 'border-[#00E676] text-[#00E676]' : 'border-transparent hover:text-[var(--text-main)]'
                }`}
              >
                CUSTOM
              </button>
            </div>
          </div>

          {/* Watchlist Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]">
            {filteredWatchlist.map((stock) => {
              const tick = getTick(stock.token, stock.symbol);
              const price = tick ? tick.ltp : stock.fallbackPrice;
              const changePct = tick ? tick.changePercent : stock.fallbackPct;
              const isGain = changePct >= 0;
              const isSelected = selectedToken === stock.token;

              return (
                <div
                  key={stock.token}
                  onClick={() => {
                    setSelectedSymbol(stock.symbol);
                    setSelectedToken(stock.token);
                    setExchange(stock.exchange);
                    setPriceInput(price.toFixed(2));
                  }}
                  className={`flex justify-between items-center p-3 border-l-2 cursor-pointer group transition-colors relative ${
                    isSelected
                      ? 'bg-[var(--bg-surface-elevated)] border-l-[#00E676]'
                      : 'border-l-transparent hover:bg-[var(--bg-surface-elevated)]/60'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-headline font-bold text-xs tracking-wide text-[var(--text-main)]">{stock.symbol}</span>
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5">{stock.name} ({stock.exchange})</span>
                  </div>

                  <div className="flex flex-col items-end font-label tabular-nums">
                    <span className={`text-xs font-bold ${isGain ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>
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
                        setSelectedToken(stock.token);
                        setExchange(stock.exchange);
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
                        setSelectedToken(stock.token);
                        setExchange(stock.exchange);
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
            Live Stream Connected • TradingView Engine
          </div>
        </div>

        {/* COLUMN 2: CENTER REAL INTERACTIVE TRADINGVIEW CHART WORKSPACE */}
        <div className="flex-1 flex flex-col min-w-[450px] bg-[var(--bg-surface)] relative z-10 overflow-hidden">
          <TradingChart
            exchange={exchange}
            symbol={selectedSymbol}
            token={selectedToken}
            latestTick={currentTick}
            theme={theme}
            onBuyClick={(sym, p) => {
              setOrderSide('BUY');
              setPriceInput(p.toFixed(2));
            }}
            onSellClick={(sym, p) => {
              setOrderSide('SELL');
              setPriceInput(p.toFixed(2));
            }}
          />
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
