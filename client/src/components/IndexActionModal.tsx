import React from 'react';
import { X, TrendingUp, Layers, Activity } from 'lucide-react';
import { PriceBadge } from './PriceBadge';
import { useTickFreshness } from '../hooks/useTickFreshness';
import { MarketTick } from '../types';

interface IndexActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexSymbol: string;
  token: string;
  exchange?: string;
  latestTick?: MarketTick;
  onOpenChart: (symbol: string, token: string, exchange: string) => void;
  onOpenOptionChain: (indexSymbol: string) => void;
}

export const IndexActionModal: React.FC<IndexActionModalProps> = ({
  isOpen,
  onClose,
  indexSymbol,
  token,
  exchange = 'NSE',
  latestTick,
  onOpenChart,
  onOpenOptionChain,
}) => {
  if (!isOpen) return null;

  const freshness = useTickFreshness(token);
  const activeTick = latestTick || freshness.tick;

  const cleanIndex = indexSymbol.includes('SENSEX')
    ? 'SENSEX'
    : indexSymbol.includes('BANK')
    ? 'BANKNIFTY'
    : indexSymbol.includes('FIN')
    ? 'FINNIFTY'
    : 'NIFTY';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-white font-headline">{indexSymbol}</h3>
                <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-mono font-bold">{exchange}</span>
              </div>
              {activeTick && (
                <div className="flex items-baseline gap-2 num-font mt-0.5">
                  <span className="font-extrabold text-sm text-white">₹{activeTick.ltp.toFixed(2)}</span>
                  <span className={`text-xs font-bold ${activeTick.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {activeTick.change >= 0 ? '+' : ''}{activeTick.change.toFixed(2)} ({activeTick.changePercent.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-400 font-medium">Select an action for <strong className="text-white">{indexSymbol}</strong> spot index:</p>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3 pt-1">
          <button
            onClick={() => {
              onClose();
              onOpenChart(indexSymbol, token, exchange);
            }}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-between transition-all cursor-pointer active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 text-white">
                <TrendingUp size={18} />
              </div>
              <div className="text-left">
                <span className="block font-bold">View Interactive Live Chart</span>
                <span className="block text-[10px] text-emerald-100 font-normal">Real-time candlesticks, indicators & timeframes</span>
              </div>
            </div>
            <span className="text-xs font-mono bg-white/20 px-2.5 py-1 rounded-lg">📈 Open</span>
          </button>

          {cleanIndex === 'SENSEX' ? (
            <button
              onClick={() => {
                onClose();
                onOpenOptionChain(cleanIndex);
              }}
              className="w-full p-4 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white font-black text-sm shadow-md flex items-center justify-between transition-all cursor-pointer active:scale-95"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Layers size={18} />
                </div>
                <div className="text-left">
                  <span className="block font-bold">View Full Option Chain</span>
                  <span className="block text-[10px] text-slate-400 font-normal">All strikes, Greeks, IV, PCR & Open Interest</span>
                </div>
              </div>
              <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg">⛓️ Open</span>
            </button>
          ) : (
            <div
              className="w-full p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-500 font-bold text-sm shadow-none flex items-center justify-between opacity-60 cursor-not-allowed select-none"
              title="Option Chain is disabled for this index to conserve API limits"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-600">
                  <Layers size={18} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="block font-bold text-slate-400">Option Chain</span>
                    <span className="text-[9px] bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.5 rounded border border-rose-500/30">DISABLED</span>
                  </div>
                  <span className="block text-[10px] text-slate-500 font-normal">Option chain temporarily disabled to save API quota</span>
                </div>
              </div>
              <span className="text-xs font-mono bg-slate-800 text-slate-500 px-2.5 py-1 rounded-lg">🔒 Disabled</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
