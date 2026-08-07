import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { OptionChainItem, MarketTick } from '../types';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';
import { RefreshCw, Zap, Calendar, Filter, ShieldCheck, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { useMarketSocket, useSubscribeTokens } from '../hooks/useMarketSocket';
import { useTickFreshness, useMultiTickFreshness } from '../hooks/useTickFreshness';
import { PriceBadge } from './PriceBadge';
import { SpotPriceTicker, getSpotToken } from './SpotPriceTicker';

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
  
  const [chain, setChain] = useState<OptionChainItem[]>([]);
  const [spotPrice, setSpotPrice] = useState<number>(24500);
  const [futuresPrice, setFuturesPrice] = useState<number>(24565);
  const [atmStrike, setAtmStrike] = useState<number>(24500);
  const [lotSize, setLotSize] = useState<number>(65);
  const [loading, setLoading] = useState<boolean>(true);

  // Order Preview Modal State
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderPreviewDetails | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── 1. Spot Token & Freshness ──────────────────────────────────────────────
  const spotToken = getSpotToken(symbol);
  const spotFreshness = useTickFreshness(spotToken);
  const liveSpotLtp = spotFreshness.tick ? spotFreshness.tick.ltp : spotPrice;

  // ── 2. Collect visible tokens from active option chain ────────────────────
  const visibleTokens = useMemo(() => {
    const tokens: string[] = [spotToken];
    chain.forEach(row => {
      if (row.ce?.instrumentToken) tokens.push(row.ce.instrumentToken);
      if (row.pe?.instrumentToken) tokens.push(row.pe.instrumentToken);
    });
    return tokens;
  }, [spotToken, chain]);

  // Subscribe to option chain visible tokens on WebSocket
  useSubscribeTokens(visibleTokens);

  // Multi-token freshness state map for all visible strikes
  const freshnessMap = useMultiTickFreshness(visibleTokens);

  // ── 3. Dynamic ATM Recalculation Safeguard ───────────────────────────────
  // If spot price is LIVE, recalculate closest strike as ATM.
  // If spot price is STALE or DISCONNECTED, freeze ATM calculation to prevent silent drift.
  const isAtmPaused = spotFreshness.state === 'STALE' || spotFreshness.state === 'DISCONNECTED';
  
  useEffect(() => {
    if (isAtmPaused || chain.length === 0) return;

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
  }, [liveSpotLtp, chain, isAtmPaused]);

  // ── 4. Fetch Dynamic Expiries for Selected Index ─────────────────────────
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
  }, [fetchExpiries, symbol]);

  // ── 5. Fetch Option Chain Data from Server ──────────────────────────────────
  const fetchOptionChain = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams({
      symbol,
      expiry,
      strikeRange,
    });

    fetch(`/api/v1/market/option-chain?${query.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.chain)) {
          setChain(data.chain);
          if (data.spotPrice) setSpotPrice(data.spotPrice);
          if (data.futuresPrice) setFuturesPrice(data.futuresPrice);
          if (data.atmStrike && !isAtmPaused) setAtmStrike(data.atmStrike);
          if (data.lotSize) setLotSize(data.lotSize);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol, expiry, strikeRange, isAtmPaused]);

  useEffect(() => {
    fetchOptionChain();
  }, [fetchOptionChain]);

  // ── 6. SSE Stream for Fallback Ticks ───────────────────────────────────────
  useEffect(() => {
    if (!expiry) return;
    const query = new URLSearchParams({ symbol, expiry, strikeRange });
    const sse = new EventSource(`/api/v1/market/option-chain/stream?${query.toString()}`);

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.success && Array.isArray(data.chain)) {
          setChain(data.chain);
          if (data.spotPrice) setSpotPrice(data.spotPrice);
          if (data.futuresPrice) setFuturesPrice(data.futuresPrice);
          if (data.atmStrike && !isAtmPaused) setAtmStrike(data.atmStrike);
          if (data.lotSize) setLotSize(data.lotSize);
          setLoading(false);
        }
      } catch (_) {}
    };

    sse.onerror = () => sse.close();
    return () => sse.close();
  }, [symbol, expiry, strikeRange, isAtmPaused]);

  // ── 7. Open Order Preview Modal ─────────────────────────────────────────────
  const initiateOptionOrder = (
    strike: number,
    optionType: 'CE' | 'PE',
    side: 'BUY' | 'SELL',
    price: number,
    itemToken: string
  ) => {
    const isSensex = symbol.includes('SENSEX');
    const exchange = isSensex ? 'BSE' : 'NSE';

    const orderDetails: OrderPreviewDetails = {
      token: itemToken,
      symbol: `${symbol}${strike}${optionType}`,
      underlying: symbol,
      exchange,
      expiry,
      strike,
      optionType,
      side,
      lots: 1,
      lotSize,
      quantity: lotSize,
      price,
      orderType: 'MARKET',
      productType: 'MIS',
    };

    setSelectedOrderDetails(orderDetails);
    setIsPreviewOpen(true);
  };

  // ── 8. Confirm Order Execution ──────────────────────────────────────────────
  const handleConfirmOrder = async (confirmedDetails: OrderPreviewDetails) => {
    setIsPreviewOpen(false);
    setActionMessage(null);

    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          instrumentToken: confirmedDetails.token,
          exchange: confirmedDetails.exchange,
          symbol: confirmedDetails.symbol,
          side: confirmedDetails.side,
          quantity: confirmedDetails.quantity,
          price: confirmedDetails.price,
          orderType: confirmedDetails.orderType,
          productType: confirmedDetails.productType,
        })
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: `Order Confirmed (${data.orderId}): ${confirmedDetails.side} ${confirmedDetails.quantity} Qty ${confirmedDetails.symbol} @ ₹${confirmedDetails.price.toFixed(2)} (Brokerage: ₹0.00 FREE)`
        });
        if (onRefreshWallet) onRefreshWallet();
      } else {
        setActionMessage({ type: 'error', text: `Order Rejected: ${data.error?.message || 'RMS Validation Failed'}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Order Placement Failed: ${err.message}` });
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      
      {/* 1. TOP INDEX SELECTOR & SPOT BANNER */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Left: Index Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {['NIFTY', 'SENSEX', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'].map(idx => (
            <button
              key={idx}
              onClick={() => setSymbol(idx)}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all border ${
                symbol === idx
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-105'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-indigo-400 hover:text-[var(--text-main)]'
              }`}
            >
              {idx === 'SENSEX' ? 'BSE SENSEX' : idx}
            </button>
          ))}
        </div>

        {/* Center: Dedicated Spot Price Ticker with Animation & Freshness */}
        <div className="flex flex-wrap items-center gap-4">
          <SpotPriceTicker symbol={symbol} fallbackPrice={spotPrice} />

          <div className="flex flex-col text-xs font-extrabold num-font">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">FUTURES</span>
            <span className="text-sm text-[var(--text-main)] font-bold">
              ₹{(spotFreshness.tick ? spotFreshness.tick.ltp + (symbol.includes('BANK') ? 140 : 65) : futuresPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex flex-col text-xs font-extrabold num-font">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">LOT SIZE</span>
            <span className="text-sm text-indigo-500 font-black">{lotSize} QTY / LOT</span>
          </div>

          <div className="flex flex-col text-xs font-extrabold num-font">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">BROKERAGE</span>
            <span className="text-sm text-emerald-500 font-black flex items-center gap-1">
              <ShieldCheck size={14} /> ₹0 FREE
            </span>
          </div>
        </div>

      </div>

      {/* ATM Pause Safeguard Banner */}
      {isAtmPaused && (
        <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-600 dark:text-amber-400 text-xs font-extrabold flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="animate-bounce" />
            <span>ATM calculation paused — Spot feed state: <strong>{spotFreshness.state}</strong>. Highlighting locked at ₹{atmStrike}.</span>
          </div>
          <PriceBadge state={spotFreshness.state} timeSinceLastTick={spotFreshness.timeSinceLastTick} />
        </div>
      )}

      {/* 2. EXPIRY & STRIKE RANGE CONTROLS */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Expiry Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-extrabold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1">
            <Calendar size={14} /> Expiry:
          </span>

          <button
            onClick={() => { setExpiryType('NEAREST'); fetchExpiries(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              expiryType === 'NEAREST'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Nearest Expiry
          </button>

          <button
            onClick={() => { setExpiryType('NEXT'); fetchExpiries(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              expiryType === 'NEXT'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Next Expiry
          </button>

          <button
            onClick={() => { setExpiryType('MONTHLY'); fetchExpiries(); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              expiryType === 'MONTHLY'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            Monthly Expiry
          </button>

          {/* Expiry Date Dropdown */}
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="px-3 py-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl font-bold text-xs text-[var(--text-main)] focus:outline-none"
          >
            {expiries.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        </div>

        {/* Strike Range Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1">
            <Filter size={14} /> Strikes:
          </span>
          {(['5', '10', '20', 'ALL'] as const).map(r => (
            <button
              key={r}
              onClick={() => setStrikeRange(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                strikeRange === r
                  ? 'bg-slate-800 text-white dark:bg-slate-700 border-slate-700 shadow-sm'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {r === 'ALL' ? 'All' : `±${r}`}
            </button>
          ))}

          <button
            onClick={fetchOptionChain}
            className="p-1.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors ml-2"
            title="Refresh Option Chain"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

      </div>

      {actionMessage && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold ${
          actionMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* 3. OPTION CHAIN TABLE MATRIX */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-sm flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            
            {/* Header Row 1 */}
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th colSpan={7} className="py-3 px-4 text-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs tracking-wider border-r border-[var(--border-color)]">
                  CALLS (CE)
                </th>
                <th className="py-3 px-4 text-center bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] font-black text-[10px] uppercase border-r border-[var(--border-color)]">
                  STRIKE
                </th>
                <th colSpan={7} className="py-3 px-4 text-center bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs tracking-wider">
                  PUTS (PE)
                </th>
              </tr>

              {/* Header Row 2 */}
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] uppercase text-[10px] font-extrabold">
                <th className="py-2.5 px-2 text-center">Delta</th>
                <th className="py-2.5 px-2 text-center">IV</th>
                <th className="py-2.5 px-2 text-center">OI</th>
                <th className="py-2.5 px-2 text-center">Volume</th>
                <th className="py-2.5 px-2 text-center">LTP & Status</th>
                <th className="py-2.5 px-2 text-center">Buy / Sell</th>
                <th className="py-2.5 px-2 text-center border-r border-[var(--border-color)]">Class</th>

                <th className="py-2.5 px-4 text-center bg-[var(--bg-surface-elevated)] text-[var(--text-tertiary)] font-black border-r border-[var(--border-color)]">STRIKE</th>

                <th className="py-2.5 px-2 text-center border-r border-[var(--border-color)]">Class</th>
                <th className="py-2.5 px-2 text-center">Buy / Sell</th>
                <th className="py-2.5 px-2 text-center">LTP & Status</th>
                <th className="py-2.5 px-2 text-center">Volume</th>
                <th className="py-2.5 px-2 text-center">OI</th>
                <th className="py-2.5 px-2 text-center">IV</th>
                <th className="py-2.5 px-2 text-center">Delta</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[var(--border-light)] num-font">
              {chain.map((row) => {
                const isATM = row.strikePrice === atmStrike;

                const ceToken = row.ce?.instrumentToken;
                const peToken = row.pe?.instrumentToken;

                const ceFreshness = ceToken ? freshnessMap.get(ceToken) : undefined;
                const peFreshness = peToken ? freshnessMap.get(peToken) : undefined;

                const ceLtp = ceFreshness?.tick ? ceFreshness.tick.ltp : row.ce.ltp;
                const peLtp = peFreshness?.tick ? peFreshness.tick.ltp : row.pe.ltp;

                // Display price if live WS tick has arrived OR initial REST payload has valid LTP > 0
                const hasCeTickData = Boolean(ceFreshness?.hasReceivedTick || (row.ce && row.ce.ltp > 0));
                const hasPeTickData = Boolean(peFreshness?.hasReceivedTick || (row.pe && row.pe.ltp > 0));

                return (
                  <tr key={row.strikePrice} className={`hover:bg-[var(--bg-surface-elevated)] transition-colors ${
                    isATM ? 'bg-amber-500/10' : ''
                  }`}>
                    
                    {/* CALLS GREEKS & METRICS */}
                    <td className="py-2.5 px-2 text-center text-[var(--text-muted)] text-[11px]">{row.ce.delta.toFixed(2)}</td>
                    <td className="py-2.5 px-2 text-center text-[var(--text-muted)] text-[11px]">{row.ce.iv}%</td>

                    {/* CALLS OI */}
                    <td className="py-2.5 px-2 text-center text-[var(--text-main)] font-bold text-[11px]">
                      {(row.ce.openInterest / 1000).toFixed(0)}k
                    </td>

                    {/* CALLS VOLUME */}
                    <td className="py-2.5 px-2 text-center text-[var(--text-muted)] text-[11px]">
                      {(((ceFreshness?.tick?.volume) || row.ce.volume) / 1000).toFixed(0)}k
                    </td>

                    {/* CALLS LTP & FRESHNESS BADGE */}
                    <td className="py-2.5 px-2 text-center font-black text-[var(--text-main)] text-xs">
                      {hasCeTickData ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span>₹{ceLtp.toFixed(2)}</span>
                          {ceFreshness && (
                            <PriceBadge
                              state={ceFreshness.state}
                              source={ceFreshness.source || row.ce?.source}
                              timeSinceLastTick={ceFreshness.timeSinceLastTick}
                              size="sm"
                              showLabel={false}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--text-tertiary)] font-bold text-xs" title="No live tick received (Instrument token mapping pending)">
                          —
                        </span>
                      )}
                    </td>

                    {/* CALLS ACTION BUTTONS */}
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => initiateOptionOrder(row.strikePrice, 'CE', 'BUY', ceLtp, row.ce.instrumentToken)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] shadow-sm transition-transform active:scale-95"
                          title={`Buy ${symbol} ${row.strikePrice} CE`}
                        >
                          B
                        </button>
                        <button
                          onClick={() => initiateOptionOrder(row.strikePrice, 'CE', 'SELL', ceLtp, row.ce.instrumentToken)}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] shadow-sm transition-transform active:scale-95"
                          title={`Sell ${symbol} ${row.strikePrice} CE`}
                        >
                          S
                        </button>
                      </div>
                    </td>

                    {/* CALL CLASS */}
                    <td className="py-2.5 px-2 text-center border-r border-[var(--border-color)]">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        row.ce.classification === 'ITM' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : row.ce.classification === 'ATM' ? 'bg-amber-500/20 text-amber-600' : 'text-[var(--text-tertiary)]'
                      }`}>
                        {row.ce.classification}
                      </span>
                    </td>

                    {/* STRIKE PRICE */}
                    <td className={`py-2.5 px-4 text-center font-black text-sm border-r border-[var(--border-color)] ${
                      isATM ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-l-4 border-amber-500' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)]'
                    }`}>
                      {row.strikePrice}
                    </td>

                    {/* PUT CLASS */}
                    <td className="py-2.5 px-2 text-center border-r border-[var(--border-color)]">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                        row.pe.classification === 'ITM' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : row.pe.classification === 'ATM' ? 'bg-amber-500/20 text-amber-600' : 'text-[var(--text-tertiary)]'
                      }`}>
                        {row.pe.classification}
                      </span>
                    </td>

                    {/* PUTS ACTION BUTTONS */}
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => initiateOptionOrder(row.strikePrice, 'PE', 'BUY', peLtp, row.pe.instrumentToken)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] shadow-sm transition-transform active:scale-95"
                          title={`Buy ${symbol} ${row.strikePrice} PE`}
                        >
                          B
                        </button>
                        <button
                          onClick={() => initiateOptionOrder(row.strikePrice, 'PE', 'SELL', peLtp, row.pe.instrumentToken)}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] shadow-sm transition-transform active:scale-95"
                          title={`Sell ${symbol} ${row.strikePrice} PE`}
                        >
                          S
                        </button>
                      </div>
                    </td>

                    {/* PUTS LTP & FRESHNESS BADGE */}
                    <td className="py-2.5 px-2 text-center font-black text-[var(--text-main)] text-xs">
                      {hasPeTickData ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span>₹{peLtp.toFixed(2)}</span>
                          {peFreshness && (
                            <PriceBadge
                              state={peFreshness.state}
                              source={peFreshness.source || row.pe?.source}
                              timeSinceLastTick={peFreshness.timeSinceLastTick}
                              size="sm"
                              showLabel={false}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--text-tertiary)] font-bold text-xs" title="No live tick received (Instrument token mapping pending)">
                          —
                        </span>
                      )}
                    </td>

                    {/* PUTS VOLUME */}
                    <td className="py-2.5 px-2 text-center text-[var(--text-muted)] text-[11px]">
                      {(((peFreshness?.tick?.volume) || row.pe.volume) / 1000).toFixed(0)}k
                    </td>

                    {/* PUTS OI */}
                    <td className="py-2.5 px-2 text-center text-[var(--text-main)] font-bold text-[11px]">
                      {(row.pe.openInterest / 1000).toFixed(0)}k
                    </td>

                    <td className="py-2.5 px-2 text-center text-[var(--text-muted)] text-[11px]">{row.pe.iv}%</td>
                    <td className="py-2.5 px-2 text-center text-[var(--text-muted)] text-[11px]">{row.pe.delta.toFixed(2)}</td>

                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      </div>

      {/* 4. MANDATORY ORDER PREVIEW MODAL */}
      <OrderPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirm={handleConfirmOrder}
        details={selectedOrderDetails}
        userToken={token || ''}
      />

    </div>
  );
};
