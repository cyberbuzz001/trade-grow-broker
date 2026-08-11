import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ShieldCheck, Zap, TrendingUp, TrendingDown, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

interface OptionLeg {
  id: string;
  action: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE';
  strike: number;
  lots: number;
  premium: number;
}

interface OptionStrategyBuilderProps {
  token: string;
  onOrderExecuted?: () => void;
}

export const OptionStrategyBuilder: React.FC<OptionStrategyBuilderProps> = ({ token, onOrderExecuted }) => {
  const [underlying, setUnderlying] = useState<string>('NIFTY');
  const [spotPrice, setSpotPrice] = useState<number>(24603.94);
  const [expiry, setExpiry] = useState<string>('28 AUG 2026');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [execStatus, setExecStatus] = useState<string | null>(null);

  const [legs, setLegs] = useState<OptionLeg[]>([
    { id: 'leg_1', action: 'BUY', optionType: 'CE', strike: 24500, lots: 1, premium: 213.15 },
    { id: 'leg_2', action: 'SELL', optionType: 'CE', strike: 24700, lots: 1, premium: 112.56 }
  ]);

  const lotSize = underlying === 'BANKNIFTY' ? 15 : 25;

  // Preset Strategy Templates
  const applyPreset = (presetName: string) => {
    const baseStrike = Math.round(spotPrice / 100) * 100;
    if (presetName === 'BULL_CALL_SPREAD') {
      setLegs([
        { id: 'l1', action: 'BUY', optionType: 'CE', strike: baseStrike, lots: 1, premium: 210.0 },
        { id: 'l2', action: 'SELL', optionType: 'CE', strike: baseStrike + 200, lots: 1, premium: 110.0 }
      ]);
    } else if (presetName === 'BEAR_PUT_SPREAD') {
      setLegs([
        { id: 'l1', action: 'BUY', optionType: 'PE', strike: baseStrike, lots: 1, premium: 180.0 },
        { id: 'l2', action: 'SELL', optionType: 'PE', strike: baseStrike - 200, lots: 1, premium: 95.0 }
      ]);
    } else if (presetName === 'LONG_STRADDLE') {
      setLegs([
        { id: 'l1', action: 'BUY', optionType: 'CE', strike: baseStrike, lots: 1, premium: 210.0 },
        { id: 'l2', action: 'BUY', optionType: 'PE', strike: baseStrike, lots: 1, premium: 180.0 }
      ]);
    } else if (presetName === 'IRON_CONDOR') {
      setLegs([
        { id: 'l1', action: 'BUY', optionType: 'PE', strike: baseStrike - 300, lots: 1, premium: 45.0 },
        { id: 'l2', action: 'SELL', optionType: 'PE', strike: baseStrike - 100, lots: 1, premium: 110.0 },
        { id: 'l3', action: 'SELL', optionType: 'CE', strike: baseStrike + 100, lots: 1, premium: 125.0 },
        { id: 'l4', action: 'BUY', optionType: 'CE', strike: baseStrike + 300, lots: 1, premium: 50.0 }
      ]);
    }
  };

  const addLeg = () => {
    const baseStrike = Math.round(spotPrice / 100) * 100;
    setLegs(prev => [
      ...prev,
      { id: `leg_${Date.now()}`, action: 'BUY', optionType: 'CE', strike: baseStrike, lots: 1, premium: 150.0 }
    ]);
  };

  const removeLeg = (id: string) => {
    setLegs(prev => prev.filter(l => l.id !== id));
  };

  const updateLeg = (id: string, field: keyof OptionLeg, val: any) => {
    setLegs(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  };

  // Compute Strategy Payoff Metrics
  const metrics = useMemo(() => {
    let netPremium = 0; // Positive = Debit, Negative = Credit
    legs.forEach(leg => {
      const legQty = leg.lots * lotSize;
      const cashFlow = leg.action === 'BUY' ? -leg.premium * legQty : leg.premium * legQty;
      netPremium += cashFlow; // Negative means cash outflow (Net Debit)
    });

    const isNetDebit = netPremium < 0;
    const netCost = Math.abs(netPremium);

    // Calculate Payoff over a price grid (spot +/- 10%)
    const pricePoints: number[] = [];
    const minPrice = spotPrice * 0.90;
    const maxPrice = spotPrice * 1.10;
    const step = (maxPrice - minPrice) / 100;

    for (let p = minPrice; p <= maxPrice; p += step) {
      pricePoints.push(Math.round(p));
    }

    const payoffs = pricePoints.map(price => {
      let totalPnl = 0;
      legs.forEach(leg => {
        const qty = leg.lots * lotSize;
        let intrinsic = 0;
        if (leg.optionType === 'CE') {
          intrinsic = Math.max(0, price - leg.strike);
        } else {
          intrinsic = Math.max(0, leg.strike - price);
        }

        let legPnl = 0;
        if (leg.action === 'BUY') {
          legPnl = (intrinsic - leg.premium) * qty;
        } else {
          legPnl = (leg.premium - intrinsic) * qty;
        }
        totalPnl += legPnl;
      });
      return { price, pnl: Math.round(totalPnl) };
    });

    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    const breakevens: number[] = [];

    payoffs.forEach((pt, i) => {
      if (pt.pnl > maxProfit) maxProfit = pt.pnl;
      if (pt.pnl < maxLoss) maxLoss = pt.pnl;

      if (i > 0) {
        const prevPnl = payoffs[i - 1].pnl;
        if ((prevPnl < 0 && pt.pnl >= 0) || (prevPnl > 0 && pt.pnl <= 0)) {
          breakevens.push(pt.price);
        }
      }
    });

    return {
      netPremium: Math.round(netPremium),
      netCost: Math.round(netCost),
      isNetDebit,
      maxProfit: maxProfit > 500000 ? 'Unlimited' : `₹${maxProfit.toLocaleString('en-IN')}`,
      maxLoss: maxLoss < -500000 ? 'Unlimited' : `₹${Math.abs(maxLoss).toLocaleString('en-IN')}`,
      breakevens,
      payoffs
    };
  }, [legs, spotPrice, lotSize]);

  // Execute All Strategy Legs sequentially
  const handleExecuteStrategy = async () => {
    setIsSubmitting(true);
    setExecStatus('Executing legs in parallel...');

    try {
      for (const leg of legs) {
        const orderPayload = {
          instrumentToken: `NFO_${underlying}_${leg.strike}_${leg.optionType}`,
          exchange: 'NFO',
          symbol: `${underlying}${leg.strike}${leg.optionType}`,
          side: leg.action,
          quantity: leg.lots * lotSize,
          price: leg.premium,
          orderType: 'MARKET',
          productType: 'MIS'
        };

        const res = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(orderPayload)
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error?.message || 'Leg execution failed');
        }
      }

      setExecStatus('✅ Strategy Executed Successfully!');
      if (onOrderExecuted) onOrderExecuted();
      setTimeout(() => setExecStatus(null), 4000);
    } catch (err: any) {
      setExecStatus(`❌ Execution Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      {/* 1. TOP HEADER TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white tracking-wide">{underlying}</span>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-semibold">
              SPOT: ₹{spotPrice.toFixed(2)}
            </span>
          </div>

          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
            {['NIFTY', 'SENSEX'].map(u => (
              <button
                key={u}
                onClick={() => {
                  setUnderlying(u);
                  setSpotPrice(u === 'SENSEX' ? 78088.00 : 24603.94);
                }}
                className={`px-3 py-1 rounded font-bold transition ${underlying === u ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Strategies Quick Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">PRESETS:</span>
          <button onClick={() => applyPreset('BULL_CALL_SPREAD')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 transition">
            Bull Call Spread
          </button>
          <button onClick={() => applyPreset('BEAR_PUT_SPREAD')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 transition">
            Bear Put Spread
          </button>
          <button onClick={() => applyPreset('LONG_STRADDLE')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 transition">
            Straddle
          </button>
          <button onClick={() => applyPreset('IRON_CONDOR')} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded border border-slate-700 transition">
            Iron Condor
          </button>
        </div>
      </div>

      {/* 2. MAIN GRID: LEG BUILDER & PAYOFF ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* LEFT 7 COLS: OPTION LEGS BUILDER */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Option Strategy Legs
              </h3>
              <button
                onClick={addLeg}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow"
              >
                <Plus className="w-3.5 h-3.5" /> Add Leg
              </button>
            </div>

            {/* LEGS TABLE */}
            <div className="flex flex-col gap-2.5">
              {legs.map((leg, idx) => (
                <div key={leg.id} className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 p-3 rounded-lg text-xs">
                  <span className="font-bold text-slate-500 w-5">#{idx + 1}</span>

                  {/* Action Toggle */}
                  <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 font-bold">
                    <button
                      onClick={() => updateLeg(leg.id, 'action', 'BUY')}
                      className={`px-2.5 py-1 rounded transition ${leg.action === 'BUY' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      BUY
                    </button>
                    <button
                      onClick={() => updateLeg(leg.id, 'action', 'SELL')}
                      className={`px-2.5 py-1 rounded transition ${leg.action === 'SELL' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                    >
                      SELL
                    </button>
                  </div>

                  {/* Option Type Toggle */}
                  <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 font-bold">
                    <button
                      onClick={() => updateLeg(leg.id, 'optionType', 'CE')}
                      className={`px-2 py-1 rounded transition ${leg.optionType === 'CE' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                    >
                      CE
                    </button>
                    <button
                      onClick={() => updateLeg(leg.id, 'optionType', 'PE')}
                      className={`px-2 py-1 rounded transition ${leg.optionType === 'PE' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
                    >
                      PE
                    </button>
                  </div>

                  {/* Strike Selector */}
                  <div className="flex-1 min-w-[100px]">
                    <input
                      type="number"
                      step={100}
                      value={leg.strike}
                      onChange={e => updateLeg(leg.id, 'strike', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Lots Input */}
                  <div className="w-20">
                    <label className="text-[10px] text-slate-500 block leading-none mb-0.5">LOTS ({lotSize})</label>
                    <input
                      type="number"
                      min={1}
                      value={leg.lots}
                      onChange={e => updateLeg(leg.id, 'lots', parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
                    />
                  </div>

                  {/* Premium Input */}
                  <div className="w-24">
                    <label className="text-[10px] text-slate-500 block leading-none mb-0.5">PREMIUM (₹)</label>
                    <input
                      type="number"
                      step={0.5}
                      value={leg.premium}
                      onChange={e => updateLeg(leg.id, 'premium', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-emerald-400 font-mono font-bold text-xs focus:outline-none"
                    />
                  </div>

                  {/* Delete Leg Button */}
                  <button
                    onClick={() => removeLeg(leg.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* EXECUTE STRATEGY BUTTON */}
          <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-4">
            {execStatus && (
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                {execStatus}
              </span>
            )}
            <button
              onClick={handleExecuteStrategy}
              disabled={isSubmitting || legs.length === 0}
              className="ml-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
              Execute Strategy ({legs.length} Legs)
            </button>
          </div>
        </div>

        {/* RIGHT 5 COLS: STRATEGY PAYOFF METRICS & VISUALIZER */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">NET CASHFLOW</span>
              <span className={`text-lg font-bold font-mono block mt-1 ${metrics.isNetDebit ? 'text-rose-400' : 'text-emerald-400'}`}>
                {metrics.isNetDebit ? `- ₹${metrics.netCost.toLocaleString('en-IN')}` : `+ ₹${Math.abs(metrics.netPremium).toLocaleString('en-IN')}`}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {metrics.isNetDebit ? 'NET DEBIT (PAID)' : 'NET CREDIT (RECEIVED)'}
              </span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">MAX PROFIT</span>
              <span className="text-lg font-bold font-mono text-emerald-400 block mt-1">
                {metrics.maxProfit}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">AT EXPIRATION</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">MAX RISK / LOSS</span>
              <span className="text-lg font-bold font-mono text-rose-400 block mt-1">
                {metrics.maxLoss}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">CAPITAL AT RISK</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">BREAKEVEN(S)</span>
              <span className="text-sm font-bold font-mono text-amber-400 block mt-1">
                {metrics.breakevens.length > 0 ? metrics.breakevens.join(', ') : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">EXPIRATION BREAKEVEN</span>
            </div>
          </div>

          {/* PAYOFF DIAGRAM CANVAS / SVG */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col justify-between">
            <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-2">Payoff Profile at Expiration</h4>

            <div className="relative h-44 bg-slate-950 border border-slate-800/80 rounded-lg p-2 flex items-end">
              {/* Zero line */}
              <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-slate-700/80 z-0"></div>

              {/* SVG Payoff Curve */}
              <svg className="w-full h-full overflow-visible z-10" viewBox="0 0 400 160">
                {(() => {
                  const points = metrics.payoffs;
                  if (points.length === 0) return null;
                  const maxAbs = Math.max(...points.map(p => Math.abs(p.pnl)), 1000);

                  const pathD = points.map((pt, i) => {
                    const x = (i / (points.length - 1)) * 400;
                    // Y axis: 80 is center (0 PnL), top is +maxAbs, bottom is -maxAbs
                    const normalizedY = 80 - (pt.pnl / maxAbs) * 70;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${normalizedY}`;
                  }).join(' ');

                  return (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  );
                })()}
              </svg>
            </div>

            <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
              <span>MIN: ₹{(spotPrice * 0.9).toFixed(0)}</span>
              <span className="text-emerald-400 font-bold">SPOT: ₹{spotPrice.toFixed(0)}</span>
              <span>MAX: ₹{(spotPrice * 1.1).toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
