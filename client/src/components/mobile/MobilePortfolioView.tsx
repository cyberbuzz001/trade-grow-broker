import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Bell, ChevronLeft, Briefcase, Zap, ShieldCheck, ShieldAlert, RefreshCw, Target, AlertTriangle, X, History } from 'lucide-react';
import { MarketTick, Wallet, Holding } from '../../types';

interface MobilePortfolioViewProps {
  ticks?: Map<string, MarketTick>;
  token?: string | null;
  wallet?: Wallet | null;
  onBack: () => void;
  onSelectStock: (symbol: string, name: string, price: number) => void;
}

export const MobilePortfolioView: React.FC<MobilePortfolioViewProps> = ({
  ticks,
  token,
  wallet,
  onBack,
  onSelectStock,
}) => {
  const [activeSegment, setActiveSegment] = useState<'POSITIONS' | 'CLOSED_TRADES' | 'HOLDINGS'>('POSITIONS');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);

  // Mobile Exit Modal States
  const [squareOffModalPos, setSquareOffModalPos] = useState<any | null>(null);
  const [targetModalPos, setTargetModalPos] = useState<any | null>(null);
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [targetPriceError, setTargetPriceError] = useState<string | null>(null);
  const [isTargetConfirmStep, setIsTargetConfirmStep] = useState<boolean>(false);
  const [editingTargetOrder, setEditingTargetOrder] = useState<any | null>(null);
  const [cancelTargetModalOrder, setCancelTargetModalOrder] = useState<any | null>(null);
  const [isSubmittingExit, setIsSubmittingExit] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPortfolio = () => {
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    fetch('/api/v1/portfolio/holdings', {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.holdings)) setHoldings(data.holdings);
      })
      .catch(() => {});

    fetch('/api/v1/portfolio/positions?todayOnly=true', {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.positions)) setPositions(data.positions);
      })
      .catch(() => {});

    fetch('/api/v1/portfolio/closed-trades?todayOnly=true', {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.closedTrades)) setClosedTrades(data.closedTrades);
      })
      .catch(() => {});

    fetch('/api/v1/orders?todayOnly=true', {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.orders)) setOrders(data.orders);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 2500);
    return () => clearInterval(interval);
  }, [token]);

  const getLiveLtp = (item: any): number => {
    const sym = item.symbol || '';
    const instToken = item.instrumentToken || item.instrument_token || '';
    const avgPrice = parseFloat(item.averagePrice || item.average_price || 0);

    let tick = instToken ? ticks?.get(instToken) : undefined;
    if (!tick && sym) {
      tick = ticks?.get(sym) || ticks?.get(`NSE_${sym}`) || ticks?.get(`NFO_${sym}`) || ticks?.get(`BFO_${sym}`);
    }

    if (tick && tick.ltp > 0) return tick.ltp;
    if (item.ltp && parseFloat(item.ltp) > 0) return parseFloat(item.ltp);
    return avgPrice;
  };

  // Find active target order
  const getActiveTargetOrder = (pos: any) => {
    const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
    if (netQty === 0) return null;
    const targetSide = netQty > 0 ? 'SELL' : 'BUY';

    return orders.find(o =>
      (o.status === 'ACCEPTED' || o.status === 'PENDING') &&
      o.symbol === pos.symbol &&
      o.side === targetSide &&
      (o.orderType === 'LIMIT' || o.order_type === 'LIMIT')
    );
  };

  // SQUARE OFF HANDLERS
  const confirmSquareOff = async () => {
    if (!squareOffModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    navigator.vibrate?.(40);

    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    try {
      const pos = squareOffModalPos;
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const livePrice = getLiveLtp(pos);

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
          exchange: pos.exchange || 'NSE',
          symbol: pos.symbol,
          side,
          quantity,
          price: livePrice,
          orderType: 'MARKET',
          productType: pos.productType || pos.product_type || 'MIS'
        })
      });
      const data = await res.json();
      if (data.success) {
        navigator.vibrate?.([30, 50, 30]);
        setActionMessage({ type: 'success', text: `Square Off MARKET order placed for ${pos.symbol}` });
        fetchPortfolio();
      } else {
        setActionMessage({ type: 'error', text: `Square Off failed: ${data.error?.message}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setSquareOffModalPos(null);
    }
  };

  // SET TARGET HANDLERS
  const handleOpenSetTargetModal = (pos: any, existingOrder?: any) => {
    navigator.vibrate?.(20);
    setTargetModalPos(pos);
    setEditingTargetOrder(existingOrder || null);
    setTargetPrice(existingOrder ? (existingOrder.price || '').toString() : '');
    setTargetPriceError(null);
    setIsTargetConfirmStep(false);
  };

  const handleProceedToTargetConfirm = () => {
    if (!targetModalPos) return;
    const priceNum = parseFloat(targetPrice);

    if (isNaN(priceNum) || priceNum <= 0) {
      setTargetPriceError('Please enter a valid target price.');
      return;
    }

    const cents = Math.round(priceNum * 100);
    if (cents % 5 !== 0) {
      setTargetPriceError('Target price must be in ₹0.05 tick increments.');
      return;
    }

    const netQty = targetModalPos.netQty !== undefined ? targetModalPos.netQty : (targetModalPos.net_qty !== undefined ? parseInt(targetModalPos.net_qty, 10) : ((targetModalPos.buyQty || 0) - (targetModalPos.sellQty || 0)));
    const liveLtp = getLiveLtp(targetModalPos);
    const avgPrice = parseFloat(targetModalPos.averagePrice || targetModalPos.average_price || liveLtp);

    if (netQty > 0 && priceNum <= Math.min(avgPrice, liveLtp)) {
      setTargetPriceError(`Target price for LONG position must be above entry/LTP (₹${liveLtp.toFixed(2)}).`);
      return;
    }

    if (netQty < 0 && priceNum >= Math.max(avgPrice, liveLtp)) {
      setTargetPriceError(`Target price for SHORT position must be below entry/LTP (₹${liveLtp.toFixed(2)}).`);
      return;
    }

    setTargetPriceError(null);
    setIsTargetConfirmStep(true);
  };

  const confirmPlaceTargetOrder = async () => {
    if (!targetModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    navigator.vibrate?.(40);

    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    try {
      const pos = targetModalPos;
      const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const priceNum = parseFloat(targetPrice);

      if (editingTargetOrder) {
        const res = await fetch(`/api/v1/orders/${editingTargetOrder.orderId || editingTargetOrder.id || editingTargetOrder.order_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`
          },
          body: JSON.stringify({ price: priceNum, quantity })
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({ type: 'success', text: `Target order updated to ₹${priceNum.toFixed(2)}` });
          fetchPortfolio();
        }
      } else {
        const res = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`
          },
          body: JSON.stringify({
            instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
            exchange: pos.exchange || 'NSE',
            symbol: pos.symbol,
            side,
            quantity,
            price: priceNum,
            orderType: 'LIMIT',
            productType: pos.productType || pos.product_type || 'MIS'
          })
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({ type: 'success', text: `Target LIMIT order placed @ ₹${priceNum.toFixed(2)}` });
          fetchPortfolio();
        }
      }
    } catch (_) {
    } finally {
      setIsSubmittingExit(false);
      setTargetModalPos(null);
      setIsTargetConfirmStep(false);
    }
  };

  const confirmCancelTargetOrder = async () => {
    if (!cancelTargetModalOrder) return;
    const userToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');
    if (!userToken) return;

    try {
      const orderId = cancelTargetModalOrder.orderId || cancelTargetModalOrder.order_id || cancelTargetModalOrder.id;
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: `Target order cancelled. Position remains open.` });
        fetchPortfolio();
      }
    } catch (_) {}
    finally {
      setCancelTargetModalOrder(null);
    }
  };

  const openPositions = positions.filter(p => {
    const qty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    return qty !== 0;
  });

  const totalInvested = holdings.reduce((acc, h) => acc + (h.averagePrice * h.quantity), 0);
  const totalCurrent = holdings.reduce((acc, h) => acc + (h.currentValue || h.ltp * h.quantity), 0);
  const holdingsPnl = holdings.reduce((acc, h) => acc + (h.pnl || 0), 0);

  const positionsPnl = openPositions.reduce((acc, p) => {
    const netQty = p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
    const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
    const ltp = getLiveLtp(p);
    const uPnl = netQty > 0 ? (ltp - avgPrice) * netQty : Math.abs(netQty) * (avgPrice - ltp);
    return acc + uPnl;
  }, 0);

  const closedTradesPnl = closedTrades.reduce((acc, ct) => acc + (ct.netPnl || 0), 0);
  const totalCombinedPnl = holdingsPnl + positionsPnl + closedTradesPnl;

  return (
    <div className="pb-24 pt-3 px-3.5 space-y-4 font-body bg-slate-950 min-h-screen text-slate-100 touch-action-manipulation overscroll-y-contain select-none">
      
      {/* 1. TOP HEADER */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(20);
            onBack();
          }}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h1 className="text-base font-bold text-white">
          Portfolio & Positions
        </h1>

        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(20);
            fetchPortfolio();
          }}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 hover:text-white active:scale-95 transition-all cursor-pointer"
          title="Refresh Portfolio"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {actionMessage && (
        <div className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between ${
          actionMessage.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        }`}>
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. REAL-TIME P&L BANNER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden shadow-md backdrop-blur-xl group">
        <div className="flex items-center justify-between mb-1 text-xs font-mono text-slate-400">
          <span>Real-Time Portfolio P&L</span>
          <span className="text-emerald-400 font-bold">LIVE FEED</span>
        </div>

        <div className="flex items-baseline justify-between font-mono">
          <h2 className={`text-3xl font-black tabular-nums ${totalCombinedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalCombinedPnl >= 0 ? '+' : ''}₹{totalCombinedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${totalCombinedPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
            {totalCombinedPnl >= 0 ? 'PROFIT' : 'LOSS'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 pt-2 border-t border-slate-800 mt-2">
          <span>Positions P&L: <strong className={positionsPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>₹{positionsPnl.toFixed(2)}</strong></span>
          <span>Closed P&L: <strong className={closedTradesPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>₹{closedTradesPnl.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* 3. SEGMENTED TABS */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl font-headline">
        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(20);
            setActiveSegment('POSITIONS');
          }}
          className={`py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer min-h-[44px] ${
            activeSegment === 'POSITIONS'
              ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Open ({openPositions.length})
        </button>

        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(20);
            setActiveSegment('CLOSED_TRADES');
          }}
          className={`py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer min-h-[44px] ${
            activeSegment === 'CLOSED_TRADES'
              ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Closed ({closedTrades.length})
        </button>

        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(20);
            setActiveSegment('HOLDINGS');
          }}
          className={`py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer min-h-[44px] ${
            activeSegment === 'HOLDINGS'
              ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Holdings ({holdings.length})
        </button>
      </div>

      {/* 4. POSITIONS OR CLOSED TRADES LIST */}
      <div className="space-y-3">
        {activeSegment === 'POSITIONS' && (
          openPositions.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-2xl text-center space-y-2 backdrop-blur-xl">
              <Briefcase className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="font-bold text-sm text-white">No Open Positions Today</h3>
              <p className="text-xs text-slate-400">Your intraday trading positions are squared off.</p>
            </div>
          ) : (
            openPositions.map(pos => {
              const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
              const absQty = Math.abs(netQty);
              const avgPrice = parseFloat(pos.averagePrice || pos.average_price || 0);
              const ltp = getLiveLtp(pos);
              const uPnl = netQty > 0 ? (ltp - avgPrice) * netQty : absQty * (avgPrice - ltp);
              const isGain = uPnl >= 0;
              const realizedPnl = parseFloat(pos.realizedPnl || pos.realized_pnl || 0);
              const activeTarget = getActiveTargetOrder(pos);

              return (
                <div key={pos.id || pos.symbol} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 backdrop-blur-xl shadow-md font-mono">
                  {/* Row 1: Symbol & P&L */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{pos.symbol}</h4>
                      <span className="text-[11px] text-slate-400">
                        {absQty} Qty • <span className="text-indigo-400 font-bold">{pos.productType || 'MIS'}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-base tabular-nums ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isGain ? '+' : ''}₹{uPnl.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">Unrealized P&L</div>
                    </div>
                  </div>

                  {/* Row 2: Price & Target Badges */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div>
                      <span className="text-slate-400">Avg: </span>
                      <strong className="text-white">₹{avgPrice.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">LTP: </span>
                      <strong className="text-cyan-300 font-extrabold">₹{ltp.toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* Released Profit (Realized P&L) Row */}
                  {realizedPnl !== 0 && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60 font-mono">
                      <span className="text-slate-400">Released Profit:</span>
                      <strong className={`font-bold ${realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {realizedPnl >= 0 ? '+' : ''}₹{realizedPnl.toFixed(2)}
                      </strong>
                    </div>
                  )}

                  {/* Active Target Indicator Badge */}
                  {activeTarget && (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <span>Target ₹{parseFloat(activeTarget.price).toFixed(2)} ({activeTarget.side} LIMIT)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCancelTargetModalOrder(activeTarget)}
                        className="text-slate-400 hover:text-rose-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Row 3: Action Buttons */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSetTargetModal(pos, activeTarget)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs py-2.5 px-3 rounded-xl border border-cyan-500/30 flex items-center justify-center gap-1.5 active:scale-95 transition-transform min-h-[44px]"
                    >
                      <Target className="w-4 h-4" />
                      <span>{activeTarget ? 'Modify Target' : 'Set Target'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSquareOffModalPos(pos)}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-transform min-h-[44px]"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Square Off</span>
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

        {activeSegment === 'CLOSED_TRADES' && (
          closedTrades.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-2xl text-center space-y-2 backdrop-blur-xl">
              <History className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="font-bold text-sm text-white">No Closed Trades Today</h3>
              <p className="text-xs text-slate-400">Completed trade history will appear here after exiting a position.</p>
            </div>
          ) : (
            closedTrades.map(ct => {
              const isProfit = (ct.netPnl || 0) >= 0;
              return (
                <div key={ct.id || ct.executionId} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5 backdrop-blur-xl shadow-md font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{ct.symbol}</h4>
                      <span className="text-[11px] text-slate-400">
                        {ct.quantity} Units • <strong className="text-emerald-400">{ct.entrySide}</strong> → <strong className="text-rose-400">{ct.exitSide}</strong>
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-base tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}₹{parseFloat(ct.netPnl || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] bg-slate-950 text-cyan-300 border border-slate-800 px-1.5 py-0.5 rounded font-mono font-bold">
                        {ct.exitReason ? ct.exitReason.replace('_', ' ') : 'CLOSED'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-0.5 text-slate-300">
                    <div>Entry: <strong className="text-white">₹{parseFloat(ct.entryPrice || 0).toFixed(2)}</strong></div>
                    <div>Exit: <strong className="text-cyan-300">₹{parseFloat(ct.exitPrice || 0).toFixed(2)}</strong></div>
                    <div className="text-slate-400 text-[10px]">
                      {ct.closedAt ? new Date(ct.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}

        {activeSegment === 'HOLDINGS' && (
          holdings.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-2xl text-center space-y-2 backdrop-blur-xl">
              <Briefcase className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="font-bold text-sm text-white">No Demat Holdings</h3>
              <p className="text-xs text-slate-400">No long-term equity holdings in portfolio.</p>
            </div>
          ) : (
            holdings.map(item => {
              const liveTick = ticks?.get(item.symbol);
              const ltp = liveTick ? liveTick.ltp : item.ltp;
              const pnl = (ltp - item.averagePrice) * item.quantity;
              const isGain = pnl >= 0;

              return (
                <div
                  key={item.symbol}
                  onClick={() => onSelectStock(item.symbol, item.symbol, ltp)}
                  className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2 cursor-pointer hover:border-emerald-500/50 transition-all backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.symbol}</h4>
                      <span className="text-xs text-slate-400 font-mono">{item.quantity} shares • Avg ₹{item.averagePrice.toFixed(2)}</span>
                    </div>

                    <div className="text-right num-font font-mono">
                      <div className="font-bold text-sm text-white">₹{ltp.toFixed(2)}</div>
                      <div className={`text-xs font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isGain ? '+' : ''}₹{pnl.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* MOBILE MODAL: SQUARE OFF CONFIRMATION */}
      {squareOffModalPos && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <AlertTriangle className="text-amber-400 w-4 h-4" /> Square Off Position?
              </h3>
              <button type="button" onClick={() => setSquareOffModalPos(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const pos = squareOffModalPos;
              const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
              const absQty = Math.abs(netQty);
              const liveLtp = getLiveLtp(pos);
              const exitSide = netQty > 0 ? 'SELL' : 'BUY';
              const estimatedExitVal = liveLtp * absQty;

              return (
                <>
                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Instrument:</span>
                      <strong className="text-white">{pos.symbol}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quantity:</span>
                      <strong className="text-emerald-400">{absQty} Units ({exitSide})</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current LTP:</span>
                      <strong className="text-white">₹{liveLtp.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Order Type:</span>
                      <strong className="text-amber-400">MARKET</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold">
                      <span className="text-slate-300">Estimated Exit Value:</span>
                      <strong className="text-cyan-300 font-mono">₹{estimatedExitVal.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSquareOffModalPos(null)}
                      disabled={isSubmittingExit}
                      className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs flex-1 min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmSquareOff}
                      disabled={isSubmittingExit}
                      className="px-5 py-2.5 bg-rose-600 text-white font-black rounded-xl text-xs flex-1 shadow-lg active:scale-95 disabled:opacity-50 min-h-[44px]"
                    >
                      {isSubmittingExit ? 'Submitting...' : 'Confirm Exit'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MOBILE MODAL: SET TARGET */}
      {targetModalPos && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Target className="text-cyan-400 w-4 h-4" />
                {isTargetConfirmStep ? 'Confirm Target Order' : `Set Target — ${targetModalPos.symbol}`}
              </h3>
              <button type="button" onClick={() => setTargetModalPos(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const pos = targetModalPos;
              const netQty = pos.netQty !== undefined ? pos.netQty : (pos.net_qty !== undefined ? parseInt(pos.net_qty, 10) : ((pos.buyQty || 0) - (pos.sellQty || 0)));
              const absQty = Math.abs(netQty);
              const liveLtp = getLiveLtp(pos);
              const avgPrice = parseFloat(pos.averagePrice || pos.average_price || liveLtp);
              const exitSide = netQty > 0 ? 'SELL' : 'BUY';
              const targetPriceNum = parseFloat(targetPrice || '0');
              const estTargetPnl = netQty > 0
                ? (targetPriceNum - avgPrice) * absQty
                : (avgPrice - targetPriceNum) * absQty;

              if (!isTargetConfirmStep) {
                return (
                  <>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">LTP / Avg:</span>
                        <strong className="text-cyan-300">₹{liveLtp.toFixed(2)} / ₹{avgPrice.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Exit Side:</span>
                        <strong className="text-rose-400">{exitSide} LIMIT</strong>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Target Price (₹)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={targetPrice}
                        onChange={(e) => {
                          setTargetPrice(e.target.value);
                          setTargetPriceError(null);
                        }}
                        placeholder={netQty > 0 ? `Above ₹${liveLtp.toFixed(2)}` : `Below ₹${liveLtp.toFixed(2)}`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
                      />
                      {targetPriceError && (
                        <p className="text-xs text-rose-400 font-bold mt-1">{targetPriceError}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <button type="button" onClick={() => setTargetModalPos(null)} className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs flex-1 min-h-[44px]">
                        Cancel
                      </button>
                      <button type="button" onClick={handleProceedToTargetConfirm} className="px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl text-xs flex-1 min-h-[44px]">
                        Proceed
                      </button>
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Order:</span>
                      <strong className="text-emerald-400">{exitSide} LIMIT @ ₹{targetPriceNum.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1.5">
                      <span className="text-slate-300">Estimated Target P&L:</span>
                      <strong className={estTargetPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {estTargetPnl >= 0 ? '+' : ''}₹{estTargetPnl.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button type="button" onClick={() => setIsTargetConfirmStep(false)} className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs flex-1 min-h-[44px]">
                      Back
                    </button>
                    <button type="button" onClick={confirmPlaceTargetOrder} disabled={isSubmittingExit} className="px-5 py-2.5 bg-blue-600 text-white font-black rounded-xl text-xs flex-1 shadow-lg active:scale-95 disabled:opacity-50 min-h-[44px]">
                      {isSubmittingExit ? 'Placing...' : 'Place Target'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MOBILE MODAL: CANCEL TARGET CONFIRMATION */}
      {cancelTargetModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3 font-mono">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <AlertTriangle className="text-rose-400 w-4 h-4" /> Cancel Target Order?
            </h3>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div>Order: <strong className="text-rose-400">{cancelTargetModalOrder.side} LIMIT @ ₹{cancelTargetModalOrder.price}</strong></div>
              <div>Symbol: <strong className="text-white">{cancelTargetModalOrder.symbol}</strong></div>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Cancelling the target order leaves your position open without closing it.
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button onClick={() => setCancelTargetModalOrder(null)} className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs flex-1 min-h-[44px]">Keep Order</button>
              <button onClick={confirmCancelTargetOrder} className="px-5 py-2.5 bg-rose-600 text-white font-black rounded-xl text-xs flex-1 min-h-[44px]">Cancel Target</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
