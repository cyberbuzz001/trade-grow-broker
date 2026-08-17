import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { OptionChainItem, MarketTick } from '../types';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';
import { OptionStrategyBuilder } from './OptionStrategyBuilder';
import { Calendar, Search, Activity, Layers, ArrowUpRight, ArrowDownRight, X, SlidersHorizontal, ChevronDown, Plus } from 'lucide-react';
import { useSubscribeTokens } from '../hooks/useMarketSocket';
import { useTickFreshness, useMultiTickFreshness } from '../hooks/useTickFreshness';
import { getSpotToken } from './SpotPriceTicker';
import { OptionChainRow } from './OptionChainRow';

interface OptionChainProps {
  token?: string;
  ticks?: Map<string, MarketTick>;
  onRefreshWallet?: () => void;
}

export const OptionChainView: React.FC<OptionChainProps> = ({ token, onRefreshWallet }) => {
  const [symbol, setSymbol] = useState<string>('NIFTY');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState<string>('');
  const [expiryType, setExpiryType] = useState<'NEAREST' | 'NEXT' | 'MONTHLY' | 'ALL'>('NEAREST');
  const [strikeRange, setStrikeRange] = useState<'5' | '10' | '20' | 'ALL'>('10');
  const [viewMode, setViewMode] = useState<'LTP_OI' | 'GREEKS' | 'VOLUME'>('LTP_OI');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [basketMode, setBasketMode] = useState<boolean>(false);
  const [isStrategyBuilderOpen, setIsStrategyBuilderOpen] = useState<boolean>(false);

  const [activeLtpKey, setActiveLtpKey] = useState<string | null>(null);

  const [chain, setChain] = useState<OptionChainItem[]>([]);
  const [spotPrice, setSpotPrice] = useState<number>(24331.70);
  const [spotChange, setSpotChange] = useState<number>(-64.15);
  const [spotChangePct, setSpotChangePct] = useState<number>(-0.26);
  const [atmStrike, setAtmStrike] = useState<number>(24300);
  const [lotSize, setLotSize] = useState<number>(65);
  const [loading, setLoading] = useState<boolean>(true);

  // Order Preview Modal State
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderPreviewDetails | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // Close active LTP selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setActiveLtpKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Spot Token & Live Ticks
  const spotToken = getSpotToken(symbol);
  const spotFreshness = useTickFreshness(spotToken);
  const liveSpotLtp = spotFreshness.tick && spotFreshness.tick.ltp > 0 ? spotFreshness.tick.ltp : spotPrice;
  const liveSpotChange = spotFreshness.tick?.change !== undefined ? spotFreshness.tick.change : spotChange;
  const liveSpotChangePct = spotFreshness.tick?.changePercent !== undefined ? spotFreshness.tick.changePercent : spotChangePct;

  // Collect visible tokens from active option chain
  const visibleTokens = useMemo(() => {
    const tokens: string[] = [spotToken];
    chain.forEach(row => {
      if (row.ce?.instrumentToken) tokens.push(row.ce.instrumentToken);
      if (row.pe?.instrumentToken) tokens.push(row.pe.instrumentToken);
    });
    return tokens;
  }, [spotToken, chain]);

  useSubscribeTokens(visibleTokens);
  const freshnessMap = useMultiTickFreshness(visibleTokens);

  // Dynamic ATM Strike Recalculation from WebSocket Ticks
  useEffect(() => {
    if (chain.length === 0) return;
    let closestStrike = chain[0].strikePrice;
    let minDiff = Math.abs(chain[0].strikePrice - liveSpotLtp);

    chain.forEach(item => {
      const diff = Math.abs(item.strikePrice - liveSpotLtp);
      if (diff < minDiff) {
        minDiff = diff;
        closestStrike = item.strikePrice;
      }
    });

    setAtmStrike(closestStrike);
  }, [liveSpotLtp, chain]);

  // Fetch Expiries
  const fetchExpiries = useCallback(() => {
    fetch(`/api/v1/market/option-expiries?symbol=${symbol}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.expiries) && data.expiries.length > 0) {
          setExpiries(data.expiries);
          if (expiryType === 'NEAREST' && data.nearestExpiry) {
            setExpiry(data.nearestExpiry);
          } else if (expiryType === 'NEXT' && data.nextExpiry) {
            setExpiry(data.nextExpiry);
          } else if (expiryType === 'MONTHLY' && data.monthlyExpiry) {
            setExpiry(data.monthlyExpiry);
          } else if (!data.expiries.includes(expiry)) {
            setExpiry(data.expiries[0]);
          }
        }
      })
      .catch(() => {});
  }, [symbol, expiryType, expiry]);

  useEffect(() => {
    fetchExpiries();
  }, [symbol, expiryType]);

  // Fetch Option Chain Data
  const fetchOptionChain = useCallback(() => {
    const queryParams = new URLSearchParams({ symbol, strikeRange });
    if (expiry) queryParams.append('expiry', expiry);

    fetch(`/api/v1/market/option-chain?${queryParams.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setChain(data.chain || []);
          setSpotPrice(data.spotPrice || 24331.70);
          setLotSize(data.lotSize || 65);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol, expiry, strikeRange]);

  // Load option chain on symbol/expiry/strikeRange change and refresh every 1.5 seconds
  // Live LTP updates arrive instantly via WebSocket ticks through useSubscribeTokens() above.
  useEffect(() => {
    fetchOptionChain();
    const interval = setInterval(fetchOptionChain, 1500);
    return () => clearInterval(interval);
  }, [fetchOptionChain]);

  // Handle Order Placement Trigger
  const handleOpenOrder = (
    optionToken: string,
    strike: number,
    optionType: 'CE' | 'PE',
    ltp: number,
    side: 'BUY' | 'SELL'
  ) => {
    const formattedToken = optionToken || `${symbol}${expiry}${strike}${optionType}`;
    const displaySymbol = `${symbol} ${strike} ${optionType}`;

    setSelectedOrderDetails({
      token: formattedToken,
      symbol: displaySymbol,
      underlying: symbol,
      exchange: symbol.startsWith('SENSEX') || symbol.startsWith('BANKEX') ? 'BSE' : 'NSE',
      expiry: expiry || new Date().toISOString().slice(0, 10),
      strike,
      optionType,
      side,
      lots: 1,
      lotSize,
      quantity: lotSize,
      price: ltp,
      orderType: 'MARKET',
      productType: 'MIS'
    });
    setIsPreviewOpen(true);
  };

  const handleConfirmOrder = async (details: OrderPreviewDetails) => {
    setActionMessage({
      type: 'success',
      text: `Order Placed: ${details.side} ${details.lots} Lot(s) ${details.symbol} @ ₹${details.price.toFixed(2)}`
    });
    if (onRefreshWallet) onRefreshWallet();
    setIsPreviewOpen(false);
  };

  // Filter chain by search query
  const filteredChain = useMemo(() => {
    if (!searchQuery.trim()) return chain;
    return chain.filter(row => row.strikePrice.toString().includes(searchQuery.trim()));
  }, [chain, searchQuery]);

  return (
    <div className="flex flex-col gap-3 p-2 md:p-5 max-w-7xl mx-auto font-sans select-none text-slate-100 touch-action-manipulation">
      
      {/* ── TOP HEADER (Matching Reference Images 1 & 2) ──────────────── */}
      <div className="bg-slate-900/95 border border-slate-800 p-3.5 rounded-2xl shadow-xl flex flex-col gap-3 backdrop-blur-xl">
        
        {/* Row 1: Index Badges & Spot Price Cards */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Index Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'NIFTY', name: 'NIFTY', ex: 'NSE', price: 24331.70, chg: -64.15, chgPct: -0.26 },
              { id: 'SENSEX', name: 'BSE SENSEX', ex: 'BSE', price: 77787.60, chg: -292.36, chgPct: -0.37 },
              { id: 'BANKNIFTY', name: 'BANKNIFTY', ex: 'NSE', price: 57600.00, chg: +120.40, chgPct: +0.21 },
              { id: 'FINNIFTY', name: 'FINNIFTY', ex: 'NSE', price: 25800.00, chg: +45.10, chgPct: +0.18 },
            ].map(item => {
              const isActive = symbol === item.id;
              const isPos = item.chg >= 0;
              const displayPrice = isActive ? liveSpotLtp : item.price;
              const displayChgPct = isActive ? liveSpotChangePct : item.chgPct;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(20);
                    setSymbol(item.id);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all cursor-pointer min-h-[44px] border ${
                    isActive
                      ? 'bg-slate-950 text-white border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1 font-extrabold tracking-tight">
                      <span>{item.name}</span>
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">{item.ex}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                      <span className="text-white font-bold">₹{displayPrice.toFixed(2)}</span>
                      <span className={`flex items-center text-[10px] font-semibold ${displayChgPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {displayChgPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {displayChgPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Header Action Items */}
          <div className="flex items-center gap-3">
            
            {/* Basket Mode Toggle */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300 hidden sm:inline">Basket mode</span>
              <button
                type="button"
                onClick={() => setBasketMode(!basketMode)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  basketMode ? 'bg-blue-600' : 'bg-slate-800'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${basketMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Strategy Builder Button */}
            <button
              type="button"
              onClick={() => setIsStrategyBuilderOpen(!isStrategyBuilderOpen)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md cursor-pointer active:scale-95 transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE STRATEGY</span>
            </button>

          </div>

        </div>

        {/* Row 2: Expiry, Search, Stat Badges, Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs border-t border-slate-800/80">
          
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Expiry Selector */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-bold text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
              >
                {expiries.map(exp => (
                  <option key={exp} value={exp}>{exp} W</option>
                ))}
              </select>
            </div>

            {/* Search Strike Box */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Strike"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[44px] w-32 sm:w-40"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* ATM IV Stat Badge */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-slate-400 font-mono">
              <span>ATM IV</span>
              <span className="text-white font-bold">9.71</span>
            </div>
          </div>

          {/* Mode Switcher Tabs (LTP & OI / OI / Greeks) */}
          <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl">
            {[
              { key: 'LTP_OI', label: 'LTP & OI' },
              { key: 'GREEKS', label: 'Greeks' },
              { key: 'VOLUME', label: 'Volume' }
            ].map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setViewMode(m.key as any)}
                className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
                  viewMode === m.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

        </div>

      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between ${
          actionMessage.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        }`}>
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Strategy Builder Drawer (If Open) */}
      {isStrategyBuilderOpen && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-400" /> Option Strategy Builder
            </h3>
            <button type="button" onClick={() => setIsStrategyBuilderOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="pt-3">
            <OptionStrategyBuilder token={token || ''} onOrderExecuted={() => setIsStrategyBuilderOpen(false)} />
          </div>
        </div>
      )}

      {/* ── MAIN OPTION CHAIN TABLE ─────────────────────────────────── */}
      <div ref={tableRef} className="bg-slate-900/95 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          
          {/* DESKTOP TABLE VIEW */}
          <table className="w-full text-xs text-center border-collapse num-font tabular-nums hidden md:table">
            <thead>
              {/* Category Header */}
              <tr className="border-b border-slate-800 bg-slate-950 font-extrabold text-slate-300">
                <th colSpan={viewMode === 'GREEKS' ? 3 : 4} className="py-2.5 px-3 text-cyan-400 text-left border-r border-slate-800 tracking-wider">
                  CALLS
                </th>
                <th className="py-2.5 px-4 text-amber-300 border-r border-slate-800 bg-slate-900 tracking-wider">
                  STRIKE
                </th>
                <th colSpan={viewMode === 'GREEKS' ? 3 : 4} className="py-2.5 px-3 text-purple-400 text-right tracking-wider">
                  PUTS
                </th>
              </tr>

              {/* Specific Columns Header */}
              <tr className="border-b border-slate-800 bg-slate-950/90 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {viewMode === 'GREEKS' ? (
                  <>
                    <th className="py-2.5 px-3 text-left">Delta</th>
                    <th className="py-2.5 px-3 text-left">IV</th>
                    <th className="py-2.5 px-3 text-right text-cyan-400 font-extrabold border-r border-slate-800">LTP</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-left">Volume</th>
                    <th className="py-2.5 px-3 text-left">OI Change</th>
                    <th className="py-2.5 px-3 text-left">OI</th>
                    <th className="py-2.5 px-3 text-right text-cyan-400 font-extrabold border-r border-slate-800">LTP</th>
                  </>
                )}

                <th className="py-2.5 px-4 bg-slate-900 text-white font-extrabold border-r border-slate-800">Strike Price</th>

                {viewMode === 'GREEKS' ? (
                  <>
                    <th className="py-2.5 px-3 text-left text-purple-400 font-extrabold">LTP</th>
                    <th className="py-2.5 px-3 text-right">IV</th>
                    <th className="py-2.5 px-3 text-right">Delta</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-left text-purple-400 font-extrabold">LTP</th>
                    <th className="py-2.5 px-3 text-right">OI</th>
                    <th className="py-2.5 px-3 text-right">OI Change</th>
                    <th className="py-2.5 px-3 text-right">Volume</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {filteredChain.map((row, idx) => {
                const isAtm = row.strikePrice === atmStrike;
                const ceTick = freshnessMap.get(row.ce?.instrumentToken || '');
                const peTick = freshnessMap.get(row.pe?.instrumentToken || '');

                const nextRow = filteredChain[idx + 1];
                const showSpotLine = spotPrice >= row.strikePrice && nextRow && spotPrice < nextRow.strikePrice;

                return (
                  <React.Fragment key={row.strikePrice}>
                    <OptionChainRow
                      row={row}
                      isAtm={isAtm}
                      spotPrice={liveSpotLtp}
                      viewMode={viewMode}
                      ceTick={ceTick?.tick}
                      peTick={peTick?.tick}
                      activeLtpKey={activeLtpKey}
                      onSelectLtp={setActiveLtpKey}
                      onOpenOrder={handleOpenOrder}
                      isMobile={false}
                    />

                    {/* Spot Price Line Indicator Row (Matching Image 1) */}
                    {showSpotLine && (
                      <tr className="bg-rose-500/10 border-y-2 border-rose-500 font-bold">
                        <td colSpan={viewMode === 'GREEKS' ? 7 : 9} className="py-1 px-2">
                          <div className="flex items-center justify-center gap-2 text-rose-400 font-mono text-xs">
                            <div className="h-px bg-rose-500/40 flex-1" />
                            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-black tracking-wider shadow-sm">
                              {liveSpotLtp.toFixed(2)}
                            </span>
                            <div className="h-px bg-rose-500/40 flex-1" />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* MOBILE COMPACT TABLE VIEW (Matching Image 2) */}
          <table className="w-full text-xs text-center border-collapse num-font tabular-nums md:hidden">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                <th className="py-2 px-2 text-left">Volume</th>
                <th className="py-2 px-2 text-center text-cyan-400 font-black">Call LTP</th>
                <th className="py-2 px-2 text-center bg-slate-900 text-white font-black border-x border-slate-800">Strike Price</th>
                <th className="py-2 px-2 text-center text-purple-400 font-black">Put LTP</th>
                <th className="py-2 px-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredChain.map((row, idx) => {
                const isAtm = row.strikePrice === atmStrike;
                const ceTick = freshnessMap.get(row.ce?.instrumentToken || '');
                const peTick = freshnessMap.get(row.pe?.instrumentToken || '');

                const nextRow = filteredChain[idx + 1];
                const showSpotLine = spotPrice >= row.strikePrice && nextRow && spotPrice < nextRow.strikePrice;

                return (
                  <React.Fragment key={row.strikePrice}>
                    <OptionChainRow
                      row={row}
                      isAtm={isAtm}
                      spotPrice={liveSpotLtp}
                      viewMode={viewMode}
                      ceTick={ceTick?.tick}
                      peTick={peTick?.tick}
                      activeLtpKey={activeLtpKey}
                      onSelectLtp={setActiveLtpKey}
                      onOpenOrder={handleOpenOrder}
                      isMobile={true}
                    />

                    {/* Mobile Spot Price Indicator Row (Matching Image 2) */}
                    {showSpotLine && (
                      <tr className="bg-slate-950 border-y-2 border-rose-500 font-bold">
                        <td colSpan={5} className="py-1.5 px-2">
                          <div className="flex items-center justify-center gap-2 text-rose-400 font-mono text-xs">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Long Buildup |</span>
                            <span className="text-rose-400 font-bold">{liveSpotLtp.toFixed(2)}</span>
                            <span className="text-[10px] text-rose-500">{liveSpotChangePct.toFixed(2)}%</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

        </div>
      </div>

      {/* Order Preview & Execution Modal */}
      <OrderPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={handleConfirmOrder}
        details={selectedOrderDetails}
        userToken={token || localStorage.getItem('token') || ''}
      />

    </div>
  );
};
