import React from 'react';
import { X, Layers, ShoppingCart } from 'lucide-react';
import { TradingChart } from '../charts/TradingChart/TradingChart';
import { MarketTick } from '../../types';
import { useTickFreshness } from '../../hooks/useTickFreshness';
import { PriceBadge } from '../PriceBadge';

interface MobileChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  token: string;
  exchange?: string;
  latestTick?: MarketTick;
  theme?: 'dark' | 'light';
  onOpenOptionChain?: (symbol: string) => void;
  onOpenOrderModal?: (side: 'BUY' | 'SELL', price: number) => void;
}

export const MobileChartModal: React.FC<MobileChartModalProps> = ({
  isOpen,
  onClose,
  symbol,
  token,
  exchange = 'NSE',
  latestTick,
  theme = 'dark',
  onOpenOptionChain,
  onOpenOrderModal,
}) => {
  if (!isOpen) return null;

  const freshness = useTickFreshness(token);
  const activeTick = latestTick || freshness.tick;

  const isIndex = symbol.includes('NIFTY') || symbol.includes('SENSEX');
  const indexSymbol = symbol.includes('SENSEX')
    ? 'SENSEX'
    : symbol.includes('BANK')
    ? 'BANKNIFTY'
    : symbol.includes('FIN')
    ? 'FINNIFTY'
    : 'NIFTY';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col h-full w-full overflow-hidden animate-in fade-in duration-200">
      
      {/* 1. MOBILE CHART HEADER */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline font-black text-base text-white tracking-tight">{symbol}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">{exchange}</span>
              <PriceBadge state={freshness.state} timeSinceLastTick={freshness.timeSinceLastTick} size="sm" />
            </div>
            {activeTick && (
              <div className="flex items-center gap-2 font-mono text-xs mt-0.5">
                <span className="font-bold text-white">₹{activeTick.ltp.toFixed(2)}</span>
                <span className={`font-bold ${activeTick.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeTick.change >= 0 ? '+' : ''}{activeTick.change.toFixed(2)} ({activeTick.changePercent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Option Chain Button for Indices */}
          {isIndex && onOpenOptionChain && (
            <button
              onClick={() => {
                onClose();
                onOpenOptionChain(indexSymbol);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Layers size={14} /> Option Chain
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. FULLSCREEN MOBILE CHART CANVAS */}
      <div className="flex-1 relative overflow-hidden bg-slate-950 p-2">
        <TradingChart
          exchange={exchange}
          symbol={symbol}
          token={token}
          latestTick={activeTick}
          theme={theme}
          onBuyClick={(sym, p) => onOpenOrderModal?.('BUY', p)}
          onSellClick={(sym, p) => onOpenOrderModal?.('SELL', p)}
        />
      </div>

      {/* 3. FOOTER BUY / SELL ACTION BUTTONS */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 grid grid-cols-2 gap-3 shrink-0">
        <button
          onClick={() => onOpenOrderModal?.('BUY', activeTick?.ltp || 100)}
          className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
        >
          <ShoppingCart size={14} /> BUY {symbol}
        </button>

        <button
          onClick={() => onOpenOrderModal?.('SELL', activeTick?.ltp || 100)}
          className="py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-950/40 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
        >
          <ShoppingCart size={14} /> SELL {symbol}
        </button>
      </div>
    </div>
  );
};
