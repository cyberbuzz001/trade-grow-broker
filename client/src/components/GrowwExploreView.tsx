import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronRight, ArrowUpRight, ArrowDownRight, Layers, Award, Landmark, TrendingUp,
  Activity, Sparkles, Shield, Cpu, Zap, Search as SearchIcon,
} from 'lucide-react';
import { MarketTick, Wallet, Position } from '../types';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';
import { IndexActionModal, LivePrice } from './IndexActionModal';
import { MobileChartModal } from './mobile/MobileChartModal';
import { McxCommodityView } from './McxCommodityView';
import { FoHubView } from './FoHubView';
import { Card, CardTitle, Badge, Tabs, DataTable, DataTableColumn } from './ui';
import { pnlColorClass, formatPnl, formatPnlPct } from '../utils/pnl';

type Category = 'STOCKS' | 'FO' | 'COMMODITIES';

interface GrowwExploreViewProps {
  ticks?: Map<string, MarketTick>;
  token?: string | null;
  wallet?: Wallet | null;
  onRefreshWallet?: () => void;
  /** Desktop: navigates to the Terminal chart view. Mobile: opens the quick-order sheet. Which action happens is decided by the caller (App.tsx), matching each platform's existing behavior — this component just renders and calls back. */
  onSelectSymbol?: (symbol: string, price?: number) => void;
  onOpenProfile?: (tab?: 'PROFILE' | 'KYC' | 'FUNDS' | 'PERMISSIONS' | 'SECURITY' | 'SUPPORT') => void;
  onOpenOptionChain?: (symbol?: string) => void;
  onOpenSearch?: () => void;
  theme?: 'light' | 'dark';
}

interface MoverRow {
  symbol: string;
  name: string;
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number | string;
  logo?: string;
  internalToken?: string;
}

const INDEX_META = [
  { label: 'NIFTY 50', token: 'NSE_NIFTY50', exchange: 'NSE', fallback: 24856.15, fbPct: 0.42 },
  { label: 'SENSEX', token: 'BSE_SENSEX', exchange: 'BSE', fallback: 81254.30, fbPct: 0.38 },
  { label: 'BANK NIFTY', token: 'NSE_BANKNIFTY', exchange: 'NSE', fallback: 52150.75, fbPct: -0.15 },
  { label: 'FIN NIFTY', token: 'NSE_FINNIFTY', exchange: 'NSE', fallback: 23890.40, fbPct: 0.22 },
];

export const GrowwExploreView: React.FC<GrowwExploreViewProps> = ({
  ticks: propsTicks,
  token,
  wallet,
  onRefreshWallet,
  onSelectSymbol,
  onOpenProfile,
  onOpenOptionChain,
  onOpenSearch,
  theme = 'light',
}) => {
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());
  const [searchParams, setSearchParams] = useSearchParams();
  const category = (searchParams.get('category')?.toUpperCase() as Category) || 'STOCKS';

  const [moverTab, setMoverTab] = useState<'GAINERS' | 'LOSERS' | 'VOLUME'>('GAINERS');
  const [serverMovers, setServerMovers] = useState<{ gainers: MoverRow[]; losers: MoverRow[]; volumeShockers: MoverRow[] }>({
    gainers: [], losers: [], volumeShockers: [],
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedIndexModal, setSelectedIndexModal] = useState<{ symbol: string; token: string; exchange: string } | null>(null);
  const [mobileChartState, setMobileChartState] = useState<{ symbol: string; token: string; exchange: string } | null>(null);

  const exploreTokens = [
    'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK', 'NSE_ICICIBANK',
    'NSE_SBIN', 'NSE_BHARTIARTL', 'NSE_TATAMOTORS', 'NSE_TATASTEEL', 'NSE_HAL',
    'NSE_NIFTY50', 'BSE_SENSEX', 'NSE_BANKNIFTY', 'NSE_FINNIFTY',
  ];
  useSubscribeTokens(exploreTokens);

  useEffect(() => {
    fetch('/api/v1/market/top-movers')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setServerMovers({ gainers: data.gainers || [], losers: data.losers || [], volumeShockers: data.volumeShockers || [] });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;
    fetch('/api/v1/portfolio/positions?todayOnly=true', { headers: { Authorization: `Bearer ${userToken}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.positions)) setPositions(data.positions);
      })
      .catch(() => {});
  }, [token]);

  const mostTraded: MoverRow[] = [
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePercent: 2.32, logo: 'RE' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePercent: 2.24, logo: 'TC' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePercent: -0.65, logo: 'IN' },
    { symbol: 'NSE_HDFCBANK', name: 'HDFC Bank', price: 1642.80, change: 14.30, changePercent: 0.88, logo: 'HD' },
  ];

  const defaultMovers: MoverRow[] = [
    { symbol: 'NSE_HAL', name: 'Hindustan Aeronaut.', price: 4886.70, change: 241.70, changePercent: 5.20, volume: 2818585, logo: 'HA' },
    { symbol: 'NSE_RELIANCE', name: 'Reliance Industries', price: 3014.20, change: 68.40, changePercent: 2.32, volume: 4521102, logo: 'RE' },
    { symbol: 'NSE_TCS', name: 'Tata Consultancy', price: 4210.50, change: 92.10, changePercent: 2.24, volume: 1840920, logo: 'TC' },
    { symbol: 'NSE_INFY', name: 'Infosys Limited', price: 1890.30, change: -12.40, changePercent: -0.65, volume: 3210400, logo: 'IN' },
  ];

  const activeMoversList: MoverRow[] = moverTab === 'GAINERS'
    ? (serverMovers.gainers.length > 0 ? serverMovers.gainers : defaultMovers)
    : moverTab === 'LOSERS'
    ? (serverMovers.losers.length > 0 ? serverMovers.losers : defaultMovers)
    : (serverMovers.volumeShockers.length > 0 ? serverMovers.volumeShockers : defaultMovers);

  const activePositions = positions.filter((p) => p.netQty !== 0);
  const openPositionsCount = activePositions.length;
  const longCount = activePositions.filter((p) => p.netQty > 0).length;
  const shortCount = activePositions.filter((p) => p.netQty < 0).length;
  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + (p.unrealizedPnl || 0), 0);
  const totalRealizedPnl = positions.reduce((acc, p) => acc + (p.realizedPnl || 0), 0);
  const todaysPnl = totalUnrealizedPnl + totalRealizedPnl;
  const availableMargin = wallet ? wallet.cashBalance : 0;
  const portfolioValue = availableMargin + todaysPnl;
  const pnlPct = portfolioValue > 0 ? (todaysPnl / portfolioValue) * 100 : 0;

  const handleSelectRow = (symbolOrName: string, price?: number) => onSelectSymbol?.(symbolOrName, price);

  const openIndexChart = (symbol: string, tok: string, exchange: string) => {
    // Small, deliberate JS branch (viewport width, not device type) rather
    // than a prop from the parent — a full desktop Terminal view and a
    // mobile chart sheet are genuinely different features, not one
    // component at two sizes, unlike everything else on this page.
    setSelectedIndexModal(null);
    if (window.innerWidth < 768) {
      setMobileChartState({ symbol, token: tok, exchange });
    } else {
      handleSelectSymbolForTerminal(symbol, tok);
    }
  };

  const handleSelectSymbolForTerminal = (symbol: string, tok?: string) => {
    onSelectSymbol?.(symbol);
  };

  const moverColumns: DataTableColumn<MoverRow>[] = [
    {
      key: 'name', header: 'Company', mobilePrimary: true,
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] font-black flex items-center justify-center text-xs border border-[var(--primary)]/20 flex-shrink-0">
            {m.logo || m.name.charAt(0)}
          </div>
          <span className="font-bold text-xs text-[var(--text-main)]">{m.name}</span>
        </div>
      ),
    },
    {
      key: 'price', header: 'LTP', align: 'right',
      render: (m) => {
        const liveTick = ticks?.get(m.internalToken || m.symbol);
        const price = liveTick ? liveTick.ltp : m.price;
        const change = liveTick ? liveTick.change : (m.change || 0);
        const changePct = liveTick ? liveTick.changePercent : (m.changePercent || 0);
        const isGain = change >= 0;
        return (
          <div>
            <div className="text-xs font-bold text-[var(--text-main)] num-font">₹{price.toFixed(2)}</div>
            <div className={`text-[11px] font-bold num-font ${isGain ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
              {isGain ? '+' : ''}{change.toFixed(2)} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)
            </div>
          </div>
        );
      },
    },
    {
      key: 'volume', header: 'Volume', align: 'right',
      render: (m) => {
        const liveTick = ticks?.get(m.internalToken || m.symbol);
        const volume = liveTick ? liveTick.volume : m.volume;
        return <span className="text-[var(--text-muted)] font-bold num-font">{typeof volume === 'number' ? volume.toLocaleString('en-IN') : (volume ?? '—')}</span>;
      },
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 pb-28 md:pb-12 font-body text-[var(--text-main)]">
      {/* CATEGORY FILTER — belongs on this page per the IA, not the shell.
          Always rendered regardless of category, so switching back from
          Commodities is always possible (a real dead-end bug in an early
          draft: McxCommodityView used to replace this control entirely). */}
      <Tabs
        ariaLabel="Instrument category"
        value={category}
        onChange={(v) => {
          if (v === 'STOCKS') {
            searchParams.delete('category');
          } else {
            searchParams.set('category', v);
          }
          setSearchParams(searchParams, { replace: true });
        }}
        items={[
          { value: 'STOCKS', label: 'Stocks' },
          { value: 'FO', label: 'F&O' },
          { value: 'COMMODITIES', label: 'Commodities' },
        ]}
      />

      {category === 'COMMODITIES' ? (
        <McxCommodityView ticks={ticks} onRefreshWallet={onRefreshWallet} />
      ) : category === 'FO' ? (
        <FoHubView ticks={ticks} onOpenOptionChain={onOpenOptionChain} />
      ) : (
      <>
      {/* PORTFOLIO METRICS — four KPIs in one dense row from sm: up. Deliberately
          compact: these are glanceable context for the page, not its headline, so
          they get a tight 12px-padded card rather than the 16px default. The
          decorative blur-circle backgrounds each of these used to carry were
          dropped — the brief's aesthetic direction is colour "only where it
          carries meaning", and they were the main reason the row read as bloated. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <KpiCard
          index={1}
          label="Portfolio Value"
          icon={<Landmark className="w-3.5 h-3.5" />}
          iconClass="bg-indigo-500/15 text-indigo-500"
          value={`₹${portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          footer={
            <span className={`flex items-center gap-1 ${pnlColorClass(todaysPnl)}`}>
              {/* Arrow only when there's a real direction — a zero P&L has none. */}
              {todaysPnl > 0 && <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />}
              {todaysPnl < 0 && <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />}
              {formatPnl(todaysPnl)} ({formatPnlPct(pnlPct)})
            </span>
          }
        />
        <KpiCard
          index={2}
          label="Today's P&L"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          iconClass={todaysPnl > 0 ? 'bg-[var(--gain-light)] text-[var(--gain)]' : todaysPnl < 0 ? 'bg-[var(--loss-light)] text-[var(--loss)]' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'}
          valueClass={pnlColorClass(todaysPnl)}
          value={formatPnl(todaysPnl)}
          footer={<Badge variant="gain" dot>LIVE</Badge>}
        />
        <KpiCard
          index={3}
          label="Active Positions"
          icon={<Layers className="w-3.5 h-3.5" />}
          iconClass="bg-amber-500/15 text-amber-500"
          value={String(openPositionsCount)}
          footer={<span className="text-[var(--text-muted)]">{longCount} Long &middot; {shortCount} Short</span>}
        />
        <KpiCard
          index={4}
          label="Available Margin"
          icon={<Award className="w-3.5 h-3.5" />}
          iconClass="bg-teal-500/15 text-teal-500"
          value={`₹${availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          footer={<span className="text-[var(--gain)]">Ready for F&amp;O Trade</span>}
        />
      </div>

      {/* MARKET INDICES — the only place index quotes are visible on mobile, since AppShell's ticker is desktop-only. Shown at every width for one consistent page (not device-conditional). */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Market Indices</span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--gain)] font-bold">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-[var(--gain)] inline-block" /> REAL-TIME
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {INDEX_META.map((idx) => {
            const tick = ticks?.get(idx.token);
            const price = tick?.ltp ?? idx.fallback;
            const pct = tick?.changePercent ?? idx.fbPct;
            const isGain = pct >= 0;
            return (
              <Card
                key={idx.token}
                padding="sm"
                interactive
                onClick={() => setSelectedIndexModal({ symbol: idx.label, token: idx.token, exchange: idx.exchange })}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-extrabold truncate">{idx.label}</span>
                  <Badge variant={isGain ? 'gain' : 'loss'}>{isGain ? '+' : ''}{pct.toFixed(2)}%</Badge>
                </div>
                <div className="font-mono text-xs font-black tabular-nums">
                  <LivePrice value={price} prefix="" decimals={2} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      {/* Quick Actions — one continuous toolbar. This used to be
          `justify-between`, which pinned the label hard left and the buttons
          hard right and left a wide empty gutter between them on desktop;
          grouping them reads as a single control strip instead of two islands
          separated by void. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[var(--bg-surface)] border border-[var(--border-color)] px-3.5 py-2.5 rounded-2xl">
        <div className="flex items-center gap-2 mr-1">
          <Zap className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
          <span className="text-xs font-bold">Quick Actions</span>
        </div>
        {[
          { label: '+ Buy Equity', onClick: () => handleSelectRow('RELIANCE'), cls: 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/30 hover:bg-[var(--primary)] hover:text-white' },
          { label: 'Option Chain Matrix', onClick: () => onOpenOptionChain?.(), cls: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500 hover:text-white' },
          { label: 'Market Scanner', onClick: onOpenSearch, icon: <SearchIcon className="w-3.5 h-3.5" aria-hidden="true" />, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500 hover:text-white' },
        ].map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`min-h-[44px] md:min-h-0 px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer active:scale-[0.97] transition-all duration-[var(--duration-fast)] ease-[var(--easing-default)] ${a.cls}`}
          >
            {a.icon}{a.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-8 space-y-5 sm:space-y-6">
          <Card>
            <CardTitle className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-[var(--primary)]" />Most Traded Contracts & Stocks</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mostTraded.map((stock) => {
                const liveTick = ticks?.get(stock.symbol);
                const price = liveTick ? liveTick.ltp : stock.price;
                const change = liveTick ? liveTick.change : (stock as any).change ?? (stock as any).changePct ?? 0;
                const changePct = liveTick ? liveTick.changePercent : (stock as any).changePercent ?? (stock as any).changePct ?? 0;
                const isGain = change >= 0;
                return (
                  <div
                    key={stock.symbol}
                    onClick={() => handleSelectRow(stock.name, price)}
                    className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-3.5 rounded-xl hover:border-[var(--primary)]/40 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20 font-black flex items-center justify-center text-xs mb-2 group-hover:scale-105 transition-transform">
                      {stock.logo}
                    </div>
                    <h4 className="font-bold text-xs truncate mb-1">{stock.name}</h4>
                    <div className="num-font font-bold text-xs">₹{price.toFixed(2)}</div>
                    <div className={`num-font font-bold text-[11px] flex items-center gap-0.5 mt-0.5 ${isGain ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                      {isGain ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      <span>{Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" />Market Movers (1D)</CardTitle>
              <Tabs
                ariaLabel="Movers filter"
                value={moverTab}
                onChange={(v) => setMoverTab(v as typeof moverTab)}
                items={[
                  { value: 'GAINERS', label: 'Gainers' },
                  { value: 'LOSERS', label: 'Losers' },
                  { value: 'VOLUME', label: 'Volume Shockers' },
                ]}
              />
            </div>
            <DataTable
              columns={moverColumns}
              rows={activeMoversList}
              rowKey={(m) => m.symbol}
              onRowClick={(m) => handleSelectRow(m.name, m.price)}
            />
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-5 sm:space-y-6">
          <Card>
            <h4 className="font-bold text-sm mb-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-[var(--primary)]" />Products & Trading Tools</h4>
            <div className="space-y-3">
              {[
                { icon: <Layers className="w-4 h-4" />, iconClass: 'bg-emerald-500/15 text-emerald-500', label: 'Option Chain Matrix', sub: 'Live Call & Put OI Skew', onClick: () => onOpenOptionChain?.() },
                { icon: <Activity className="w-4 h-4" />, iconClass: 'bg-indigo-500/15 text-indigo-500', label: 'AI Market Scanner', sub: 'Volume Breakouts & RSI', onClick: onOpenSearch },
                { icon: <Award className="w-4 h-4" />, iconClass: 'bg-amber-500/15 text-amber-500', label: 'Option Strategy Builder', sub: 'Multi-leg spreads & payoff', onClick: () => onOpenOptionChain?.() },
              ].map((tool) => (
                <div key={tool.label} onClick={tool.onClick} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] hover:border-[var(--primary)]/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tool.iconClass}`}>{tool.icon}</div>
                    <div>
                      <span className="font-bold text-xs block">{tool.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{tool.sub}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 flex items-center justify-center"><Shield className="w-4 h-4" /></div>
                <div>
                  <h4 className="font-bold text-xs">Profile & KYC Verification</h4>
                  <p className="text-[10px] text-[var(--text-muted)]">Account status & compliance</p>
                </div>
              </div>
              <Badge variant="gain">Active</Badge>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mb-3.5 leading-relaxed">
              Ensure your profile details, PAN/Aadhaar documents, and bank payout methods are up to date.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* min-h-[44px] below md only — same scoped touch-target rule the
                  shared Button/Tabs primitives use, so desktop density is unchanged. */}
              <button onClick={() => onOpenProfile?.('KYC')} className="w-full min-h-[44px] md:min-h-0 bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)] hover:text-white py-2 px-3 rounded-xl text-xs font-bold cursor-pointer active:scale-[0.97] transition-all duration-[var(--duration-fast)] ease-[var(--easing-default)]">Update KYC</button>
              <button onClick={() => onOpenProfile?.('PROFILE')} className="w-full min-h-[44px] md:min-h-0 bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] py-2 px-3 rounded-xl text-xs font-bold cursor-pointer active:scale-[0.97] transition-all duration-[var(--duration-fast)] ease-[var(--easing-default)]">Edit Profile</button>
            </div>
          </Card>
        </div>
      </div>

      {selectedIndexModal && (
        <IndexActionModal
          isOpen={Boolean(selectedIndexModal)}
          onClose={() => setSelectedIndexModal(null)}
          indexSymbol={selectedIndexModal.symbol}
          token={selectedIndexModal.token}
          exchange={selectedIndexModal.exchange}
          latestTick={ticks.get(selectedIndexModal.token)}
          onOpenChart={openIndexChart}
          onOpenOptionChain={() => { setSelectedIndexModal(null); onOpenOptionChain?.(); }}
        />
      )}

      {mobileChartState && (
        <MobileChartModal
          isOpen={Boolean(mobileChartState)}
          onClose={() => setMobileChartState(null)}
          symbol={mobileChartState.symbol}
          token={mobileChartState.token}
          exchange={mobileChartState.exchange}
          latestTick={ticks.get(mobileChartState.token)}
          theme={theme}
          onOpenOptionChain={() => onOpenOptionChain?.()}
          onOpenOrderModal={(side, price) => handleSelectRow(mobileChartState.symbol, price)}
        />
      )}
      </>
      )}
    </div>
  );
};

/**
 * One compact KPI tile, used four times in the metrics row above. Extracted
 * because those four were near-identical copies differing only in label, icon
 * and value — the same duplication this redesign removed everywhere else.
 *
 * `index` (1-4) drives the shared `.card-enter-N` stagger classes already
 * defined in index.css (40ms apart, within the 30-50ms guidance) — they existed
 * but nothing had ever used them. Entrance only, and only on this one row, to
 * stay inside the "animate 1-2 key elements per view" rule; index.css's
 * prefers-reduced-motion block disables it for users who ask.
 */
function KpiCard({ index, label, icon, iconClass, value, valueClass, footer }: {
  index: number;
  label: string;
  icon: React.ReactNode;
  iconClass: string;
  value: string;
  valueClass?: string;
  footer: React.ReactNode;
}) {
  return (
    <Card padding="sm" className={`card-enter card-enter-${index} min-w-0`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`} aria-hidden="true">
          {icon}
        </span>
        <h3 className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider truncate">{label}</h3>
      </div>
      <div className={`num-font text-lg sm:text-xl font-black tracking-tight tabular-nums truncate ${valueClass || ''}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-bold num-font tabular-nums truncate">{footer}</div>
    </Card>
  );
}
