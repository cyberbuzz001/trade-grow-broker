import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Bell,
  Wallet as WalletIcon,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Minus,
  X,
  ChevronRight,
  Filter,
  BarChart2,
  Sliders,
  RefreshCw,
  Info,
  Home,
  Compass,
  Briefcase,
  ListOrdered,
  User as UserIcon,
  HelpCircle,
  LogOut,
  ExternalLink,
  ChevronDown,
  Lock,
  Layers,
  Activity
} from 'lucide-react';
import { PriceBadge } from '../PriceBadge';
import { User, Wallet, MarketTick } from '../../types';
import { TradingChart } from '../charts/TradingChart/TradingChart';
import { OptionChainView } from '../OptionChainView';

// Univest Primary Brand Theme Colors
const UNIVEST_BLUE = '#00439D';
const UNIVEST_GREEN = '#0BA860';
const UNIVEST_RED = '#E5484D';
const UNIVEST_WARNING = '#F5A623';

export interface UnivestClientPanelProps {
  user: User;
  wallet: Wallet | null;
  ticks?: Map<string, MarketTick>;
  token: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onLogout: () => void;
  onRefreshWallet?: () => void;
  onOpenAdmin?: () => void;
}

export type ClientTab = 'HOME' | 'MARKETS' | 'CHARTS' | 'OPTION_CHAIN' | 'PORTFOLIO' | 'ORDERS' | 'WALLET' | 'PROFILE';

// Mock Stock & Market Data
interface StockItem {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'MCX' | 'NFO';
  ltp: number;
  change: number;
  pChange: number;
  category: 'STOCKS' | 'INDICES' | 'FO';
  high: number;
  low: number;
  volume: string;
  freshness: 'LIVE' | 'STALE' | 'SYNTHETIC' | 'MARKET_CLOSED';
  sparkline: number[];
}

const MOCK_STOCKS: StockItem[] = [
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    exchange: 'NSE',
    ltp: 2984.50,
    change: 34.20,
    pChange: 1.16,
    category: 'STOCKS',
    high: 2998.00,
    low: 2950.10,
    volume: '8.4M',
    freshness: 'LIVE',
    sparkline: [2950, 2962, 2958, 2975, 2984.5]
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    exchange: 'NSE',
    ltp: 1642.10,
    change: -12.40,
    pChange: -0.75,
    category: 'STOCKS',
    high: 1660.00,
    low: 1638.00,
    volume: '14.2M',
    freshness: 'LIVE',
    sparkline: [1658, 1652, 1648, 1640, 1642.1]
  },
  {
    symbol: 'INFY',
    name: 'Infosys Limited',
    exchange: 'NSE',
    ltp: 1845.75,
    change: 22.80,
    pChange: 1.25,
    category: 'STOCKS',
    high: 1855.00,
    low: 1820.00,
    volume: '6.1M',
    freshness: 'LIVE',
    sparkline: [1822, 1830, 1838, 1842, 1845.75]
  },
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    exchange: 'NSE',
    ltp: 4215.30,
    change: -18.50,
    pChange: -0.44,
    category: 'STOCKS',
    high: 4250.00,
    low: 4200.00,
    volume: '2.8M',
    freshness: 'LIVE',
    sparkline: [4240, 4230, 4210, 4220, 4215.3]
  },
  {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd.',
    exchange: 'NSE',
    ltp: 1085.60,
    change: 41.20,
    pChange: 3.94,
    category: 'STOCKS',
    high: 1092.00,
    low: 1040.00,
    volume: '18.9M',
    freshness: 'LIVE',
    sparkline: [1042, 1055, 1070, 1080, 1085.6]
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    exchange: 'NSE',
    ltp: 1210.40,
    change: 8.90,
    pChange: 0.74,
    category: 'STOCKS',
    high: 1218.00,
    low: 1200.00,
    volume: '9.3M',
    freshness: 'LIVE',
    sparkline: [1201, 1205, 1208, 1209, 1210.4]
  },
  {
    symbol: 'NIFTY 24500 CE',
    name: 'NIFTY 29AUG2024 CE 24500',
    exchange: 'NFO',
    ltp: 184.25,
    change: 48.60,
    pChange: 35.83,
    category: 'FO',
    high: 210.00,
    low: 120.00,
    volume: '45.2M',
    freshness: 'SYNTHETIC',
    sparkline: [125, 140, 165, 178, 184.25]
  },
  {
    symbol: 'BANKNIFTY 52000 PE',
    name: 'BANKNIFTY 29AUG2024 PE 52000',
    exchange: 'NFO',
    ltp: 215.80,
    change: -64.20,
    pChange: -22.93,
    category: 'FO',
    high: 310.00,
    low: 195.00,
    volume: '38.6M',
    freshness: 'SYNTHETIC',
    sparkline: [290, 260, 240, 225, 215.8]
  }
];

const MOCK_INDICES = [
  { symbol: 'NIFTY 50', ltp: 24541.15, change: 162.40, pChange: 0.67, freshness: 'LIVE' as const },
  { symbol: 'BANKNIFTY', ltp: 52184.30, change: -145.20, pChange: -0.28, freshness: 'LIVE' as const },
  { symbol: 'FINNIFTY', ltp: 23145.80, change: 94.60, pChange: 0.41, freshness: 'LIVE' as const },
  { symbol: 'MIDCPNIFTY', ltp: 12890.50, change: 185.30, pChange: 1.46, freshness: 'LIVE' as const }
];

interface PositionItem {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
  isFO: boolean;
  freshness: 'LIVE' | 'STALE' | 'SYNTHETIC' | 'MARKET_CLOSED';
}

const MOCK_POSITIONS: PositionItem[] = [
  {
    id: 'POS-101',
    symbol: 'RELIANCE',
    type: 'BUY',
    qty: 50,
    avgPrice: 2920.00,
    ltp: 2984.50,
    pnl: 3225.00,
    pnlPercent: 2.21,
    isFO: false,
    freshness: 'LIVE'
  },
  {
    id: 'POS-102',
    symbol: 'INFY',
    type: 'BUY',
    qty: 100,
    avgPrice: 1810.00,
    ltp: 1845.75,
    pnl: 3575.00,
    pnlPercent: 1.97,
    isFO: false,
    freshness: 'LIVE'
  },
  {
    id: 'POS-103',
    symbol: 'NIFTY 24500 CE',
    type: 'BUY',
    qty: 75,
    avgPrice: 145.00,
    ltp: 184.25,
    pnl: 2943.75,
    pnlPercent: 27.07,
    isFO: true,
    freshness: 'SYNTHETIC'
  }
];

interface OrderItem {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL';
  status: 'OPEN' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  timestamp: string;
  adminOverride?: boolean;
  adminNote?: string;
}

const MOCK_ORDERS: OrderItem[] = [
  {
    id: 'ORD-98421',
    symbol: 'RELIANCE',
    side: 'BUY',
    qty: 50,
    price: 2920.00,
    orderType: 'LIMIT',
    status: 'EXECUTED',
    timestamp: '10:14 AM'
  },
  {
    id: 'ORD-98422',
    symbol: 'TATAMOTORS',
    side: 'BUY',
    qty: 25,
    price: 1080.00,
    orderType: 'LIMIT',
    status: 'OPEN',
    timestamp: '11:45 AM'
  },
  {
    id: 'ORD-98423',
    symbol: 'HDFCBANK',
    side: 'SELL',
    qty: 30,
    price: 1650.00,
    orderType: 'LIMIT',
    status: 'CANCELLED',
    timestamp: '01:20 PM'
  },
  {
    id: 'ORD-98424',
    symbol: 'BANKNIFTY 52000 PE',
    side: 'BUY',
    qty: 30,
    price: 215.80,
    orderType: 'MARKET',
    status: 'EXECUTED',
    timestamp: '02:05 PM',
    adminOverride: true,
    adminNote: 'Order executed with manual Risk Manager override'
  }
];

interface WalletTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  status: 'PENDING_ADMIN' | 'APPROVED' | 'REJECTED';
  timestamp: string;
  reference: string;
}

const MOCK_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'TXN-8801',
    type: 'DEPOSIT',
    amount: 100000,
    status: 'APPROVED',
    timestamp: '16 Aug 2026, 04:30 PM',
    reference: 'SIM-DEP-99412'
  },
  {
    id: 'TXN-8802',
    type: 'DEPOSIT',
    amount: 50000,
    status: 'PENDING_ADMIN',
    timestamp: '17 Aug 2026, 11:20 AM',
    reference: 'SIM-DEP-99801'
  }
];

export const UnivestClientPanel: React.FC<UnivestClientPanelProps> = ({
  user,
  wallet,
  ticks,
  token,
  onLogout,
  onRefreshWallet,
  onOpenAdmin
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ClientTab>('HOME');

  // Markets Tab & Filter state
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [marketSegment, setMarketSegment] = useState<'ALL' | 'WATCHLIST' | 'INDICES' | 'FO' | 'MOVERS'>('ALL');
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(['RELIANCE', 'INFY', 'TATAMOTORS']);

  // Instrument Detail Modal / View State
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [detailTab, setDetailTab] = useState<'CHART' | 'OPTION_CHAIN' | 'DEPTH' | 'FUNDAMENTALS'>('CHART');
  const [chartTimeframe, setChartTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1D');

  // Virtual Order Placement Modal State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderQty, setOrderQty] = useState(1);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL' | 'GTT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [orderSuccessModal, setOrderSuccessModal] = useState<{ isOpen: boolean; orderId: string } | null>(null);

  // Wallet Deposit/Withdraw Request Modal
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletModalType, setWalletModalType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [walletAmountInput, setWalletAmountInput] = useState('10000');
  const [walletRequestSubmitted, setWalletRequestSubmitted] = useState(false);

  // Calculations for Portfolio
  const totalVirtualCash = wallet?.cashBalance ?? 1000000;
  const portfolioInvested = MOCK_POSITIONS.reduce((acc, pos) => acc + (pos.qty * pos.avgPrice), 0);
  const portfolioCurrent = MOCK_POSITIONS.reduce((acc, pos) => acc + (pos.qty * pos.ltp), 0);
  const portfolioPnl = portfolioCurrent - portfolioInvested;
  const portfolioPnlPct = portfolioInvested > 0 ? (portfolioPnl / portfolioInvested) * 100 : 0;

  // Filtered stock list
  const filteredStocks = useMemo(() => {
    return MOCK_STOCKS.filter(s => {
      const matchesSearch = s.symbol.toLowerCase().includes(marketSearchQuery.toLowerCase()) ||
                            s.name.toLowerCase().includes(marketSearchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (marketSegment === 'WATCHLIST') return watchlistSymbols.includes(s.symbol);
      if (marketSegment === 'FO') return s.category === 'FO';
      if (marketSegment === 'INDICES') return s.category === 'INDICES';
      if (marketSegment === 'MOVERS') return Math.abs(s.pChange) > 1.0;
      return true;
    });
  }, [marketSearchQuery, marketSegment, watchlistSymbols]);

  // Open Quick Order Modal
  const handleOpenOrderModal = (stock: StockItem, side: 'BUY' | 'SELL') => {
    setSelectedStock(stock);
    setOrderSide(side);
    setOrderQty(1);
    setLimitPrice(stock.ltp);
    setIsOrderModalOpen(true);
  };

  // Submit Virtual Order
  const handleConfirmOrder = () => {
    const generatedId = `SIM-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    setIsOrderModalOpen(false);
    setOrderSuccessModal({ isOpen: true, orderId: generatedId });
    if (onRefreshWallet) onRefreshWallet();
  };

  // Submit Wallet Request (Pending Admin Approval)
  const handleWalletRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWalletRequestSubmitted(true);
    setTimeout(() => {
      setWalletRequestSubmitted(false);
      setIsWalletModalOpen(false);
      if (onRefreshWallet) onRefreshWallet();
    }, 2000);
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlistSymbols(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900 font-sans pb-24 md:pb-8">

      {/* ── TOP HEADER (UNIVEST FINTECH BRANDING) ──────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#00439D] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Brand Logo & User Avatar */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-lg text-white shadow-inner">
              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight text-white">
                  Welcome, {user.fullName || user.username}
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  VERIFIED
                </span>
              </div>
              <p className="text-[11px] text-blue-100/80 flex items-center gap-1">
                Client ID: <span className="font-mono font-semibold">{user.id ? `CL-${user.id.slice(0, 8)}` : 'CL-88412'}</span>
              </p>
            </div>
          </div>

          {/* Right Action Chips: Wallet Balance, Pro Terminal Switcher & Notifications */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('WALLET')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all shadow-sm active:scale-95"
              title="Available Cash Balance"
            >
              <WalletIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>₹{(totalVirtualCash).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <Plus className="w-3 h-3 text-white/80" />
            </button>

            {/* Pro Terminal View Switcher */}
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-xs font-extrabold text-white transition-all shadow-sm active:scale-95"
                title="Switch to Full Pro Terminal View (Lightweight Charts, Option Chains, Commodities)"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pro Terminal</span>
              </button>
            )}

            <button
              onClick={() => alert("No new notifications")}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
            </button>
          </div>

        </div>

        {/* HORIZONTALLY SCROLLABLE INDEX STRIP */}
        <div className="bg-[#00337A] border-t border-white/10 py-2 px-4 overflow-x-auto no-scrollbar">
          <div className="max-w-6xl mx-auto flex items-center gap-3 min-w-max">
            {MOCK_INDICES.map(idx => (
              <div
                key={idx.symbol}
                onClick={() => {
                  const stock = MOCK_STOCKS.find(s => s.symbol.includes(idx.symbol)) || {
                    symbol: idx.symbol,
                    name: `${idx.symbol} Index`,
                    exchange: 'NSE' as const,
                    ltp: idx.ltp,
                    change: idx.change,
                    pChange: idx.pChange,
                    category: 'INDICES' as const,
                    high: idx.ltp + 50,
                    low: idx.ltp - 50,
                    volume: '100M',
                    freshness: idx.freshness,
                    sparkline: [idx.ltp - 20, idx.ltp - 10, idx.ltp]
                  };
                  setSelectedStock(stock);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer transition-all"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white leading-none">{idx.symbol}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-bold font-mono text-white">
                      {idx.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[10px] font-bold flex items-center ${idx.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {idx.change >= 0 ? '+' : ''}{idx.pChange}%
                    </span>
                  </div>
                </div>
                <PriceBadge state={idx.freshness} size="sm" showLabel={false} />
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 pt-4">

        {/* ── TAB 1: HOME / DASHBOARD ────────────────────────────────────────── */}
        {activeTab === 'HOME' && (
          <div className="space-y-5">
            
            {/* HERO VIRTUAL PORTFOLIO SUMMARY CARD */}
            <div className="bg-gradient-to-br from-[#00439D] to-[#002D6B] rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Total Portfolio Value</span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-0.5">
                    ₹{(totalVirtualCash + portfolioCurrent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h2>
                </div>

                <button
                  onClick={() => {
                    setWalletModalType('DEPOSIT');
                    setIsWalletModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0BA860] hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Funds</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/15 text-xs">
                <div>
                  <span className="text-blue-200 block text-[11px]">Invested Value</span>
                  <span className="font-bold font-mono text-white text-sm">
                    ₹{portfolioInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <span className="text-blue-200 block text-[11px]">Overall P&L</span>
                  <span className={`font-bold font-mono text-sm flex items-center gap-1 ${portfolioPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {portfolioPnl >= 0 ? '+' : ''}₹{portfolioPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({portfolioPnlPct.toFixed(2)}%)
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-blue-200 block text-[11px]">Available Margin</span>
                  <span className="font-bold font-mono text-white text-sm">
                    ₹{totalVirtualCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* LIVE EXCHANGE FEED BADGE */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-200">
                <span className="flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  NSE / BSE Connected • Live Execution
                </span>
                <PriceBadge state="LIVE" size="sm" showLabel={true} />
              </div>
            </div>

            {/* TOP MOVERS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00439D]" />
                  Top Market Movers
                </h3>
                <button
                  onClick={() => setActiveTab('MARKETS')}
                  className="text-xs font-bold text-[#00439D] hover:underline flex items-center gap-0.5"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {MOCK_STOCKS.slice(0, 4).map(stock => (
                  <div
                    key={stock.symbol}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900">{stock.symbol}</h4>
                          <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{stock.name}</p>
                        </div>
                        <PriceBadge state={stock.freshness} size="sm" />
                      </div>

                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-base font-extrabold font-mono text-slate-900">
                          ₹{stock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-bold ${stock.change >= 0 ? 'text-[#0BA860]' : 'text-[#E5484D]'}`}>
                          {stock.change >= 0 ? '+' : ''}{stock.pChange}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenOrderModal(stock, 'BUY')}
                        className="flex-1 py-1.5 rounded-xl bg-[#0BA860]/10 hover:bg-[#0BA860] text-[#0BA860] hover:text-white text-xs font-bold transition-all text-center"
                      >
                        BUY
                      </button>
                      <button
                        onClick={() => handleOpenOrderModal(stock, 'SELL')}
                        className="flex-1 py-1.5 rounded-xl bg-[#E5484D]/10 hover:bg-[#E5484D] text-[#E5484D] hover:text-white text-xs font-bold transition-all text-center"
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RECENT ORDERS / ACTIVITY FEED */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-[#00439D]" />
                  Recent Orders
                </h3>
                <button
                  onClick={() => setActiveTab('ORDERS')}
                  className="text-xs font-bold text-[#00439D] hover:underline"
                >
                  Order Book
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {MOCK_ORDERS.slice(0, 3).map(ord => (
                  <div key={ord.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] ${ord.side === 'BUY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {ord.side}
                      </span>
                      <div>
                        <span className="font-extrabold text-slate-900 block">{ord.symbol}</span>
                        <span className="text-[11px] text-slate-400">{ord.qty} Qty @ ₹{ord.price.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ord.status === 'EXECUTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ord.status === 'OPEN' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {ord.status}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{ord.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── TAB 2: MARKETS / WATCHLIST ────────────────────────────────────── */}
        {activeTab === 'MARKETS' && (
          <div className="space-y-4">
            
            {/* Search Bar & Auto-complete */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={marketSearchQuery}
                onChange={e => setMarketSearchQuery(e.target.value)}
                placeholder="Search stocks, F&O contracts, or indices..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00439D] shadow-xs"
              />
              {marketSearchQuery && (
                <button
                  onClick={() => setMarketSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Segment Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'ALL', label: 'All Instruments' },
                { id: 'WATCHLIST', label: 'My Watchlist' },
                { id: 'FO', label: 'F&O Contracts' },
                { id: 'INDICES', label: 'Indices' },
                { id: 'MOVERS', label: 'Top Movers' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMarketSegment(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    marketSegment === tab.id
                      ? 'bg-[#00439D] text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Instrument List Rows */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {filteredStocks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No instruments found matching "{marketSearchQuery}"
                </div>
              ) : (
                filteredStocks.map(stock => (
                  <div
                    key={stock.symbol}
                    className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between cursor-pointer"
                    onClick={() => setSelectedStock(stock)}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlist(stock.symbol);
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                          watchlistSymbols.includes(stock.symbol)
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-300 hover:text-slate-400'
                        }`}
                        title={watchlistSymbols.includes(stock.symbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      >
                        ★
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">{stock.symbol}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {stock.exchange}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">{stock.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Price & Change */}
                      <div className="text-right">
                        <span className="font-extrabold text-sm font-mono text-slate-900 block">
                          ₹{stock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`text-xs font-bold ${stock.change >= 0 ? 'text-[#0BA860]' : 'text-[#E5484D]'}`}>
                            {stock.change >= 0 ? '+' : ''}{stock.pChange}%
                          </span>
                          <PriceBadge state={stock.freshness} size="sm" showLabel={false} />
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenOrderModal(stock, 'BUY')}
                          className="px-3 py-1.5 rounded-xl bg-[#0BA860] hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95"
                        >
                          BUY
                        </button>
                        <button
                          onClick={() => handleOpenOrderModal(stock, 'SELL')}
                          className="px-3 py-1.5 rounded-xl bg-[#E5484D] hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95"
                        >
                          SELL
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ── TAB 2B: CHARTS & TERMINAL ────────────────────────────────────── */}
        {activeTab === 'CHARTS' && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  Interactive Pro Trading Chart — RELIANCE
                </h3>
                <span className="text-xs text-emerald-400 font-mono font-bold">NSE Live</span>
              </div>
              <div className="h-[500px] w-full mt-3 rounded-xl overflow-hidden border border-slate-800">
                <TradingChart
                  exchange="NSE"
                  symbol="RELIANCE"
                  token="NSE_RELIANCE"
                  latestTick={ticks?.get('NSE_RELIANCE') || ticks?.get('RELIANCE')}
                  theme="dark"
                  onBuyClick={(sym, price) => handleOpenOrderModal({ symbol: sym, name: sym, exchange: 'NSE', ltp: price, change: 0, pChange: 0, category: 'STOCKS', high: price, low: price, volume: '1M', freshness: 'LIVE', sparkline: [price] }, 'BUY')}
                  onSellClick={(sym, price) => handleOpenOrderModal({ symbol: sym, name: sym, exchange: 'NSE', ltp: price, change: 0, pChange: 0, category: 'STOCKS', high: price, low: price, volume: '1M', freshness: 'LIVE', sparkline: [price] }, 'SELL')}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2C: OPTION CHAIN ────────────────────────────────────────── */}
        {activeTab === 'OPTION_CHAIN' && (
          <div className="bg-white rounded-2xl p-2 sm:p-4 border border-slate-200 shadow-xs">
            <OptionChainView token={token} ticks={ticks} onRefreshWallet={onRefreshWallet} />
          </div>
        )}

        {/* ── TAB 3: PORTFOLIO / HOLDINGS ────────────────────────────────────── */}
        {activeTab === 'PORTFOLIO' && (
          <div className="space-y-4">
            
            {/* PORTFOLIO HERO BANNER */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Current Portfolio Value</span>
                  <h2 className="text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
                    ₹{portfolioCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h2>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500">Total Returns</span>
                  <span className={`text-base font-extrabold font-mono block ${portfolioPnl >= 0 ? 'text-[#0BA860]' : 'text-[#E5484D]'}`}>
                    {portfolioPnl >= 0 ? '+' : ''}₹{portfolioPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({portfolioPnlPct.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Invested</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    ₹{portfolioInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Day's P&L</span>
                  <span className="font-bold text-[#0BA860] font-mono text-sm">
                    +₹1,840.50 (+0.84%)
                  </span>
                </div>
              </div>
            </div>

            {/* POSITIONS & HOLDINGS LIST */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm">Active Positions ({MOCK_POSITIONS.length})</h3>
                <span className="text-[11px] text-slate-500 font-medium">Real-time P&L Updates</span>
              </div>

              <div className="divide-y divide-slate-100">
                {MOCK_POSITIONS.map(pos => (
                  <div key={pos.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{pos.symbol}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {pos.isFO ? 'F&O' : 'EQUITY'}
                        </span>
                        <PriceBadge state={pos.freshness} size="sm" showLabel={false} />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {pos.qty} Qty • Avg ₹{pos.avgPrice.toFixed(2)} • LTP ₹{pos.ltp.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`font-extrabold text-sm font-mono block ${pos.pnl >= 0 ? 'text-[#0BA860]' : 'text-[#E5484D]'}`}>
                          {pos.pnl >= 0 ? '+' : ''}₹{pos.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs font-bold ${pos.pnlPercent >= 0 ? 'text-[#0BA860]' : 'text-[#E5484D]'}`}>
                          ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const stock = MOCK_STOCKS.find(s => s.symbol === pos.symbol) || {
                            symbol: pos.symbol,
                            name: pos.symbol,
                            exchange: 'NSE' as const,
                            ltp: pos.ltp,
                            change: 0,
                            pChange: 0,
                            category: 'STOCKS' as const,
                            high: pos.ltp,
                            low: pos.ltp,
                            volume: '1M',
                            freshness: pos.freshness,
                            sparkline: [pos.ltp]
                          };
                          handleOpenOrderModal(stock, pos.type === 'BUY' ? 'SELL' : 'BUY');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs border border-slate-200 transition-all"
                      >
                        Square Off
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── TAB 4: ORDERS & ORDER BOOK ────────────────────────────────────── */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Order Book</h3>
                  <p className="text-xs text-slate-500">Track pending, filled, and cancelled orders</p>
                </div>
                <button
                  onClick={() => alert("Refreshed Order Book")}
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {MOCK_ORDERS.map(ord => (
                  <div key={ord.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${ord.side === 'BUY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {ord.side}
                        </span>
                        <span className="font-extrabold text-sm text-slate-900">{ord.symbol}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {ord.orderType}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-1">
                        {ord.qty} Qty @ ₹{ord.price.toFixed(2)} • Ref: <span className="font-mono text-[11px]">{ord.id}</span>
                      </p>

                      {/* ADMIN OVERRIDE AUDIT BADGE */}
                      {ord.adminOverride && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200" title={ord.adminNote}>
                          <ShieldCheck className="w-3 h-3 text-amber-600" />
                          <span>Admin Risk Override Applied</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                        ord.status === 'EXECUTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ord.status === 'OPEN' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {ord.status}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-1">{ord.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: WALLET / DEPOSITS & WITHDRAWALS ────────────────────────── */}
        {activeTab === 'WALLET' && (
          <div className="space-y-4">
            
            {/* HERO WALLET CARD */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Available Wallet Balance</span>
                  <h2 className="text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
                    ₹{(totalVirtualCash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setWalletModalType('DEPOSIT');
                      setIsWalletModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#0BA860] hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition-all"
                  >
                    + Deposit
                  </button>
                  <button
                    onClick={() => {
                      setWalletModalType('WITHDRAW');
                      setIsWalletModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs border border-slate-200 transition-all"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </div>

            {/* TRANSACTION HISTORY */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 font-extrabold text-slate-900 text-sm">
                Deposit & Withdrawal History
              </div>

              <div className="divide-y divide-slate-100">
                {MOCK_TRANSACTIONS.map(txn => (
                  <div key={txn.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">
                          {txn.type === 'DEPOSIT' ? 'Deposit Request' : 'Withdrawal Request'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">({txn.reference})</span>
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">{txn.timestamp}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-extrabold text-sm font-mono block text-slate-900">
                        +₹{txn.amount.toLocaleString('en-IN')}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold mt-1 ${
                        txn.status === 'PENDING_ADMIN' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        txn.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {txn.status === 'PENDING_ADMIN' ? 'Pending Admin Approval' : txn.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── TAB 6: PROFILE & SETTINGS ────────────────────────────────────── */}
        {activeTab === 'PROFILE' && (
          <div className="space-y-4">
            
            {/* PROFILE CARD */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#00439D] text-white flex items-center justify-center font-extrabold text-2xl shadow-inner">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">{user.fullName || user.username}</h2>
                  <p className="text-xs text-slate-500">{user.email || 'client@paper-broker.com'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      KYC Verified
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">PAN: ABCDE****F</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Role Permission</span>
                  <span className="font-bold text-slate-900 uppercase">{user.role || 'CLIENT'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[11px]">Available Margin Limit</span>
                  <span className="font-bold text-slate-900 font-mono">10x Intraday</span>
                </div>
              </div>
            </div>

            {/* SETTINGS OPTIONS LIST */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden text-xs">
              <button
                onClick={() => alert("Risk preferences set to default 10x intraday margin")}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 text-[#00439D]" />
                  <div>
                    <span className="font-extrabold text-slate-900 block text-sm">Risk & Margin Preferences</span>
                    <span className="text-slate-500 text-[11px]">Configure order stop-loss defaults & leverage</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => alert("Support ticket portal accessible via hotline")}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-4 h-4 text-[#00439D]" />
                  <div>
                    <span className="font-extrabold text-slate-900 block text-sm">Help & Support</span>
                    <span className="text-slate-500 text-[11px]">Trading FAQ & Documentation</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={onLogout}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-rose-50/50 text-rose-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span className="font-extrabold text-sm">Logout Client Session</span>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-400" />
              </button>
            </div>

          </div>
        )}

      </main>

      {/* ── INSTRUMENT DETAIL MODAL ──────────────────────────────────────────── */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">{selectedStock.symbol}</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                    {selectedStock.exchange}
                  </span>
                  <PriceBadge state={selectedStock.freshness} size="sm" />
                </div>
                <p className="text-xs text-slate-500 truncate">{selectedStock.name}</p>
              </div>

              <button
                onClick={() => setSelectedStock(null)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price Banner */}
            <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-2xl font-extrabold font-mono text-slate-900">
                  ₹{selectedStock.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-xs font-bold ml-2.5 ${selectedStock.change >= 0 ? 'text-[#0BA860]' : 'text-[#E5484D]'}`}>
                  {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(2)} ({selectedStock.pChange}%)
                </span>
              </div>

              {/* Timeframe selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                {(['1D', '1W', '1M', '1Y'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setChartTimeframe(tf)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${chartTimeframe === tf ? 'bg-white text-[#00439D] shadow-xs' : 'hover:text-slate-900'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Pro Trading Chart (Lightweight Charts) */}
            <div className="p-2 sm:p-3 bg-slate-900 border-b border-slate-800">
              <div className="h-[380px] sm:h-[450px] w-full rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                <TradingChart
                  exchange={selectedStock.exchange || 'NSE'}
                  symbol={selectedStock.symbol}
                  token={`NSE_${selectedStock.symbol}`}
                  latestTick={ticks?.get(`NSE_${selectedStock.symbol}`) || ticks?.get(selectedStock.symbol)}
                  theme="dark"
                  onBuyClick={(sym, price) => handleOpenOrderModal(selectedStock, 'BUY')}
                  onSellClick={(sym, price) => handleOpenOrderModal(selectedStock, 'SELL')}
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-white flex items-center gap-3">
              <button
                onClick={() => {
                  handleOpenOrderModal(selectedStock, 'BUY');
                }}
                className="flex-1 py-3 rounded-2xl bg-[#0BA860] hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition-all active:scale-95"
              >
                BUY {selectedStock.symbol}
              </button>

              <button
                onClick={() => {
                  handleOpenOrderModal(selectedStock, 'SELL');
                }}
                className="flex-1 py-3 rounded-2xl bg-[#E5484D] hover:bg-rose-700 text-white font-extrabold text-sm shadow-md transition-all active:scale-95"
              >
                SELL {selectedStock.symbol}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── VIRTUAL ORDER ENTRY BOTTOM SHEET MODAL ────────────────────────── */}
      {isOrderModalOpen && selectedStock && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-lg bg-white rounded-t-3xl border-t border-slate-200 p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-250">
            
            {/* Header & Side Toggle */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-900">{selectedStock.symbol}</span>
                <span className="text-xs font-bold font-mono text-slate-500">₹{selectedStock.ltp.toFixed(2)}</span>
              </div>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Order Side Selector */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setOrderSide('BUY')}
                className={`py-2 rounded-xl font-extrabold text-xs transition-all ${orderSide === 'BUY' ? 'bg-[#0BA860] text-white shadow-xs' : 'text-slate-600'}`}
              >
                BUY (LONG)
              </button>
              <button
                type="button"
                onClick={() => setOrderSide('SELL')}
                className={`py-2 rounded-xl font-extrabold text-xs transition-all ${orderSide === 'SELL' ? 'bg-[#E5484D] text-white shadow-xs' : 'text-slate-600'}`}
              >
                SELL (SHORT)
              </button>
            </div>

            {/* Order Type Selector */}
            <div className="flex items-center gap-1.5">
              {(['MARKET', 'LIMIT', 'SL', 'GTT'] as const).map(ot => (
                <button
                  key={ot}
                  type="button"
                  onClick={() => setOrderType(ot)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${orderType === ot ? 'bg-[#00439D] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {ot}
                </button>
              ))}
            </div>

            {/* Quantity Stepper */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Quantity (Lots / Shares)</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOrderQty(Math.max(1, orderQty - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-lg"
                >
                  -
                </button>
                <input
                  type="number"
                  value={orderQty}
                  onChange={e => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-extrabold text-base"
                />
                <button
                  type="button"
                  onClick={() => setOrderQty(orderQty + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Limit Price Input if Limit Order */}
            {orderType === 'LIMIT' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Limit Price (₹)</label>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={e => setLimitPrice(parseFloat(e.target.value) || selectedStock.ltp)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-sm"
                />
              </div>
            )}

            {/* Margin Calculation & Balance */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs space-y-1.5">
              <div className="flex justify-between text-slate-700 font-medium">
                <span>Required Margin:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{(orderQty * (orderType === 'LIMIT' ? limitPrice : selectedStock.ltp)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-700 font-medium">
                <span>Available Cash:</span>
                <span className="font-mono font-bold text-emerald-700">
                  ₹{totalVirtualCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* INSTANT EXECUTION BADGE */}
              <div className="pt-2 border-t border-blue-200/60 flex items-center justify-center gap-1.5 text-[11px] font-extrabold text-[#00439D]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Instant Order Execution</span>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              onClick={handleConfirmOrder}
              className={`w-full py-3.5 rounded-2xl text-white font-extrabold text-sm shadow-md transition-all active:scale-98 ${
                orderSide === 'BUY' ? 'bg-[#0BA860] hover:bg-emerald-700' : 'bg-[#E5484D] hover:bg-rose-700'
              }`}
            >
              CONFIRM {orderSide} ORDER ({orderQty} Qty)
            </button>

          </div>
        </div>
      )}

      {/* ── ORDER SUCCESS MODAL ────────────────────────────────────────────── */}
      {orderSuccessModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#0BA860] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Order Executed Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">Your trade order has been submitted and executed.</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Order ID:</span>
                <span className="font-bold text-slate-900">{orderSuccessModal.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold text-emerald-600">FILLED</span>
              </div>
            </div>

            <button
              onClick={() => setOrderSuccessModal(null)}
              className="w-full py-3 rounded-2xl bg-[#00439D] hover:bg-blue-900 text-white font-extrabold text-xs shadow-md transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── WALLET REQUEST MODAL (DEPOSIT / WITHDRAWAL) ───────────────────── */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                {walletModalType === 'DEPOSIT' ? 'Deposit Funds' : 'Withdraw Funds'}
              </h3>
              <button onClick={() => setIsWalletModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {walletRequestSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Payment Request Processing</h4>
                <p className="text-xs text-slate-500">
                  Your funds transaction has been submitted for automated gateway verification.
                </p>
              </div>
            ) : (
              <form onSubmit={handleWalletRequestSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={walletAmountInput}
                    onChange={e => setWalletAmountInput(e.target.value)}
                    className="w-full py-2.5 px-3 rounded-2xl bg-slate-50 border border-slate-200 font-mono font-extrabold text-lg text-slate-900"
                    placeholder="10000"
                    required
                  />
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                  <span className="font-extrabold block">Secure Payment Gateway</span>
                  <p className="text-[11px] text-blue-800">
                    Deposits are verified instantly via automated gateway reconciliation.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-[#00439D] hover:bg-blue-900 text-white font-extrabold text-xs shadow-md transition-all"
                >
                  PROCEED TO PAY
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM TAB NAVIGATION BAR (UNIVEST 5-ITEM BAR) ───────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden shadow-lg">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'HOME', label: 'Home', icon: Home },
            { id: 'MARKETS', label: 'Markets', icon: Compass },
            { id: 'CHARTS', label: 'Charts', icon: BarChart2 },
            { id: 'OPTION_CHAIN', label: 'Options', icon: Layers },
            { id: 'PORTFOLIO', label: 'Portfolio', icon: Briefcase },
            { id: 'ORDERS', label: 'Orders', icon: ListOrdered },
            { id: 'PROFILE', label: 'Profile', icon: UserIcon }
          ].map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ClientTab)}
                className={`flex flex-col items-center gap-1 transition-all relative ${
                  isActive ? 'text-[#00439D]' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <IconComponent className="w-5 h-5" />
                <span className="text-[10px] font-bold">{tab.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00439D] absolute -bottom-1" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
};
