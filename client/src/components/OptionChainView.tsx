import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { OptionChainItem, MarketTick } from '../types';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';
import { RefreshCw, Calendar, Filter, ShieldCheck, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, Sliders } from 'lucide-react';
import { useSubscribeTokens } from '../hooks/useMarketSocket';
import { useTickFreshness, useMultiTickFreshness } from '../hooks/useTickFreshness';
import { PriceBadge } from './PriceBadge';
import { getSpotToken } from './SpotPriceTicker';

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
  const [showAdvancedGreeks, setShowAdvancedGreeks] = useState<boolean>(false);
  
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

  // 1. Spot Token & Freshness
  const spotToken = getSpotToken(symbol);
  const spotFreshness = useTickFreshness(spotToken);
  const liveSpotLtp = spotFreshness.tick ? spotFreshness.tick.ltp : spotPrice;

  // 2. Collect visible tokens from active option chain
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

  // 3. Fetch Dynamic Expiries for Selected Index
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

  // 4. Fetch Option Chain Data
  const fetchOptionChain = useCallback(() => {
    setLoading(true);
    const queryParams = new URLSearchParams({ symbol, strikeRange });
    if (expiry) queryParams.append('expiry', expiry);

    fetch(`/api/v1/market/option-chain?${queryParams.toString()}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setChain(data.chain || []);
          setSpotPrice(data.spotPrice || 24500);
          setFuturesPrice(data.futuresPrice || 24565);
          if (!isAtmPaused && data.atmStrike) {
            setAtmStrike(data.atmStrike);
          }
          setLotSize(data.lotSize || 65);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol, expiry, strikeRange, isAtmPaused]);

  useEffect(() => {
    fetchOptionChain();
    const interval = setInterval(fetchOptionChain, 2000);
    return () => clearInterval(interval);
  }, [fetchOptionChain]);

  // Handle Order Trigger
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
    try {
      const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          instrumentToken: details.token,
          exchange: details.exchange,
          symbol: details.symbol,
          side: details.side,
          quantity: details.quantity,
          price: details.price,
          orderType: details.orderType,
          productType: details.productType
        })
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage({
          type: 'success',
          text: `Order Executed: ${details.side} ${details.lots} Lot(s) ${details.symbol} @ ₹${details.price.toFixed(2)}`
        });
        if (onRefreshWallet) onRefreshWallet();
        setIsPreviewOpen(false);
      } else {
        setActionMessage({
          type: 'error',
          text: data.error?.message || 'Order failed — RMS validation rejected'
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Network error submitting order'
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-3 md:p-6 max-w-7xl mx-auto font-body select-none text-white">
      
      {/* 1. INDEX SELECTOR HEADER & LIVE SPOT PRICE TICKER */}
      <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Index Tabs */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {['NIFTY', 'BSE SENSEX', 'BANKNIFTY', 'FINNIFTY'].map(idx => (
            <button
              key={idx}
              onClick={() => setSymbol(idx.split(' ')[idx.split(' ').length - 1])}
              className={`px-3 py-1.5 rounded-xl font-headline font-bold text-xs transition-all ${
                symbol === idx.split(' ')[idx.split(' ').length - 1]
                  ? 'bg-[#00E676] text-[#0D1117] shadow-sm'
                  : 'bg-[#1C2128] text-[#8B949E] hover:text-white border border-[#30363D]'
              }`}
            >
              {idx}
            </button>
          ))}
        </div>

        {/* Live Spot Banner */}
        <div className="flex items-center gap-4 text-xs font-label">
          <div className="flex items-center gap-2 bg-[#0D1117] border border-[#30363D] px-3.5 py-1.5 rounded-xl">
            <span className="text-[#8B949E] font-bold">SPOT:</span>
            <span className="font-bold text-base tabular-nums text-white">₹{liveSpotLtp.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#0D1117] border border-[#30363D] px-3.5 py-1.5 rounded-xl">
            <span className="text-[#8B949E] font-bold">LOT SIZE:</span>
            <span className="font-bold text-sm text-[#00E676] tabular-nums">{lotSize} QTY</span>
          </div>
        </div>

      </div>

      {/* 2. EXPIRY, STRIKE & SIMPLE/ADVANCED TOGGLE CONTROLS */}
      <div className="bg-[#161B22] border border-[#30363D] p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs font-headline">
        
        {/* Expiry Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[#8B949E] font-bold flex items-center gap-1 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5" /> Expiry:
          </span>
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="px-3 py-1.5 bg-[#0D1117] border border-[#30363D] rounded-xl font-bold text-xs text-white focus:outline-none focus:border-[#00E676]"
          >
            {expiries.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        </div>

        {/* Strikes Range */}
        <div className="flex items-center gap-2">
          <span className="text-[#8B949E] font-bold uppercase tracking-wider">Strikes:</span>
          {(['5', '10', '20', 'ALL'] as const).map(r => (
            <button
              key={r}
              onClick={() => setStrikeRange(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                strikeRange === r ? 'bg-[#1C2128] text-[#00E676] border border-[#00E676]' : 'bg-[#0D1117] text-[#8B949E] border border-[#30363D]'
              }`}
            >
              {r === 'ALL' ? 'All' : `±${r}`}
            </button>
          ))}
        </div>

        {/* Simple vs Advanced Greeks Toggle */}
        <button
          onClick={() => setShowAdvancedGreeks(!showAdvancedGreeks)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all ${
            showAdvancedGreeks
              ? 'bg-[#FF6D00]/20 text-[#FF6D00] border-[#FF6D00]/40'
              : 'bg-[#0D1117] text-[#8B949E] border-[#30363D] hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showAdvancedGreeks ? 'Advanced Greeks (ON)' : 'Simple Mode (ON)'}</span>
        </button>

      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl text-xs font-bold border ${
          actionMessage.type === 'success' ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30' : 'bg-[#FF5252]/10 text-[#FF5252] border-[#FF5252]/30'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* 3. SIMPLE HIGH-CONTRAST OPTION CHAIN TABLE */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse font-label tabular-nums">
            
            {/* Main Header */}
            <thead>
              <tr className="border-b border-[#30363D] bg-[#0D1117] font-headline">
                <th colSpan={showAdvancedGreeks ? 4 : 2} className="py-2.5 px-3 text-[#00E676] font-extrabold uppercase border-r border-[#30363D]">
                  CALLS (CE)
                </th>
                <th className="py-2.5 px-4 text-amber-400 font-extrabold uppercase border-r border-[#30363D] bg-[#161B22]">
                  STRIKE
                </th>
                <th colSpan={showAdvancedGreeks ? 4 : 2} className="py-2.5 px-3 text-[#FF5252] font-extrabold uppercase">
                  PUTS (PE)
                </th>
              </tr>

              {/* Sub-header */}
              <tr className="border-b border-[#30363D] bg-[#1C2128] text-[10px] text-[#8B949E] uppercase font-bold tracking-wider">
                {showAdvancedGreeks && <th className="py-2 px-2">Delta / IV</th>}
                <th className="py-2 px-2">CALL LTP</th>
                <th className="py-2 px-2 border-r border-[#30363D]">Trade Call</th>

                <th className="py-2 px-4 bg-[#161B22] text-white font-black border-r border-[#30363D]">STRIKE</th>

                <th className="py-2 px-2 border-r border-[#30363D]">Trade Put</th>
                <th className="py-2 px-2">PUT LTP</th>
                {showAdvancedGreeks && <th className="py-2 px-2">Delta / IV</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#30363D]">
              {chain.map((row) => {
                const isAtm = row.strikePrice === atmStrike;
                const ceTick = freshnessMap.get(row.ce?.instrumentToken || '');
                const peTick = freshnessMap.get(row.pe?.instrumentToken || '');

                const ceLtp = ceTick?.tick?.ltp && ceTick.tick.ltp > 0 ? ceTick.tick.ltp : row.ce.ltp;
                const peLtp = peTick?.tick?.ltp && peTick.tick.ltp > 0 ? peTick.tick.ltp : row.pe.ltp;

                return (
                  <tr
                    key={row.strikePrice}
                    className={`hover:bg-[#1C2128] transition-colors ${
                      isAtm ? 'bg-amber-500/10 border-y-2 border-amber-500/50 font-bold' : ''
                    }`}
                  >
                    {/* CALLS (CE) */}
                    {showAdvancedGreeks && (
                      <td className="py-2.5 px-2 text-[10px] text-[#8B949E]">
                        Δ {row.ce.delta.toFixed(2)} | IV {row.ce.iv.toFixed(1)}%
                      </td>
                    )}

                    <td className="py-2.5 px-2 font-bold text-[#00E676] text-sm">
                      ₹{ceLtp.toFixed(2)}
                    </td>

                    <td className="py-2.5 px-2 border-r border-[#30363D]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'BUY')}
                          className="bg-[#00E676] text-[#0D1117] hover:bg-[#00C853] text-[10px] font-black px-2 py-1 rounded shadow-xs active:scale-95 transition-all"
                        >
                          BUY
                        </button>
                        <button
                          onClick={() => handleOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'SELL')}
                          className="bg-[#FF5252]/20 text-[#FF5252] hover:bg-[#FF5252] hover:text-white text-[10px] font-black px-2 py-1 rounded active:scale-95 transition-all"
                        >
                          SELL
                        </button>
                      </div>
                    </td>

                    {/* STRIKE PRICE (CENTER GOLDEN GLOW) */}
                    <td className={`py-2.5 px-4 font-extrabold text-sm border-r border-[#30363D] ${
                      isAtm ? 'text-amber-400 bg-amber-500/20 font-black tracking-wider' : 'text-white bg-[#0D1117]'
                    }`}>
                      {row.strikePrice}
                      {isAtm && <span className="text-[9px] bg-amber-500 text-[#0D1117] px-1 py-0.5 rounded ml-1 font-mono">ATM</span>}
                    </td>

                    {/* PUTS (PE) */}
                    <td className="py-2.5 px-2 border-r border-[#30363D]">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'BUY')}
                          className="bg-[#00E676] text-[#0D1117] hover:bg-[#00C853] text-[10px] font-black px-2 py-1 rounded shadow-xs active:scale-95 transition-all"
                        >
                          BUY
                        </button>
                        <button
                          onClick={() => handleOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'SELL')}
                          className="bg-[#FF5252]/20 text-[#FF5252] hover:bg-[#FF5252] hover:text-white text-[10px] font-black px-2 py-1 rounded active:scale-95 transition-all"
                        >
                          SELL
                        </button>
                      </div>
                    </td>

                    <td className="py-2.5 px-2 font-bold text-[#FF5252] text-sm">
                      ₹{peLtp.toFixed(2)}
                    </td>

                    {showAdvancedGreeks && (
                      <td className="py-2.5 px-2 text-[10px] text-[#8B949E]">
                        Δ {row.pe.delta.toFixed(2)} | IV {row.pe.iv.toFixed(1)}%
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Preview & Editing Modal */}
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
