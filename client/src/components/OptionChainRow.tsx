import React, { useEffect, useRef, useState } from 'react';
import { OptionChainItem, MarketTick } from '../types';

interface OptionChainRowProps {
  row: OptionChainItem;
  isAtm: boolean;
  showAdvancedGreeks: boolean;
  ceTick?: MarketTick;
  peTick?: MarketTick;
  onOpenOrder: (
    optionToken: string,
    strike: number,
    optionType: 'CE' | 'PE',
    ltp: number,
    side: 'BUY' | 'SELL'
  ) => void;
}

export const OptionChainRowComponent: React.FC<OptionChainRowProps> = ({
  row,
  isAtm,
  showAdvancedGreeks,
  ceTick,
  peTick,
  onOpenOrder,
}) => {
  // Resolve live LTP from WebSocket tick or static row fallback
  const ceLtp = ceTick?.ltp && ceTick.ltp > 0 ? ceTick.ltp : row.ce.ltp;
  const peLtp = peTick?.ltp && peTick.ltp > 0 ? peTick.ltp : row.pe.ltp;

  const prevCeLtpRef = useRef<number>(ceLtp);
  const prevPeLtpRef = useRef<number>(peLtp);

  const [ceFlashClass, setCeFlashClass] = useState<'price-flash-up' | 'price-flash-down' | ''>('');
  const [peFlashClass, setPeFlashClass] = useState<'price-flash-up' | 'price-flash-down' | ''>('');

  // Call (CE) Price Flash Animation
  useEffect(() => {
    if (ceLtp === prevCeLtpRef.current) return;

    if (ceLtp > prevCeLtpRef.current) {
      setCeFlashClass('price-flash-up');
    } else if (ceLtp < prevCeLtpRef.current) {
      setCeFlashClass('price-flash-down');
    }
    prevCeLtpRef.current = ceLtp;

    const timer = setTimeout(() => {
      setCeFlashClass('');
    }, 350);

    return () => clearTimeout(timer);
  }, [ceLtp]);

  // Put (PE) Price Flash Animation
  useEffect(() => {
    if (peLtp === prevPeLtpRef.current) return;

    if (peLtp > prevPeLtpRef.current) {
      setPeFlashClass('price-flash-up');
    } else if (peLtp < prevPeLtpRef.current) {
      setPeFlashClass('price-flash-down');
    }
    prevPeLtpRef.current = peLtp;

    const timer = setTimeout(() => {
      setPeFlashClass('');
    }, 350);

    return () => clearTimeout(timer);
  }, [peLtp]);

  return (
    <tr
      className={`hover:bg-[#1C2128] transition-colors ${
        isAtm ? 'bg-amber-500/10 border-y-2 border-amber-500/50 font-bold' : ''
      }`}
    >
      {/* CALLS (CE) GREEKS */}
      {showAdvancedGreeks && (
        <td className="py-2.5 px-2 text-[10px] text-[#8B949E]">
          Δ {row.ce.delta.toFixed(2)} | IV {row.ce.iv.toFixed(1)}%
        </td>
      )}

      {/* CALL LTP CELL (WITH LIVE FLASH ANIMATION) */}
      <td className={`py-2.5 px-2 font-bold text-[#00E676] text-sm tabular-nums transition-colors duration-150 ${ceFlashClass}`}>
        ₹{ceLtp.toFixed(2)}
      </td>

      {/* CALL TRADE BUTTONS */}
      <td className="py-2.5 px-2 border-r border-[#30363D]">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'BUY')}
            className="bg-[#00E676] text-[#0D1117] hover:bg-[#00C853] text-[10px] font-black px-2 py-1 rounded shadow-xs active:scale-95 transition-all"
          >
            BUY
          </button>
          <button
            onClick={() => onOpenOrder(row.ce.instrumentToken, row.strikePrice, 'CE', ceLtp, 'SELL')}
            className="bg-[#FF5252]/20 text-[#FF5252] hover:bg-[#FF5252] hover:text-white text-[10px] font-black px-2 py-1 rounded active:scale-95 transition-all"
          >
            SELL
          </button>
        </div>
      </td>

      {/* STRIKE PRICE (CENTER STICKY COLUMN) */}
      <td
        className={`py-2.5 px-4 font-extrabold text-sm border-r border-[#30363D] ${
          isAtm ? 'text-amber-400 bg-amber-500/20 font-black tracking-wider' : 'text-white bg-[#0D1117]'
        }`}
      >
        {row.strikePrice}
        {isAtm && (
          <span className="text-[9px] bg-amber-500 text-[#0D1117] px-1 py-0.5 rounded ml-1 font-mono">
            ATM
          </span>
        )}
      </td>

      {/* PUT TRADE BUTTONS */}
      <td className="py-2.5 px-2 border-r border-[#30363D]">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'BUY')}
            className="bg-[#00E676] text-[#0D1117] hover:bg-[#00C853] text-[10px] font-black px-2 py-1 rounded shadow-xs active:scale-95 transition-all"
          >
            BUY
          </button>
          <button
            onClick={() => onOpenOrder(row.pe.instrumentToken, row.strikePrice, 'PE', peLtp, 'SELL')}
            className="bg-[#FF5252]/20 text-[#FF5252] hover:bg-[#FF5252] hover:text-white text-[10px] font-black px-2 py-1 rounded active:scale-95 transition-all"
          >
            SELL
          </button>
        </div>
      </td>

      {/* PUT LTP CELL (WITH LIVE FLASH ANIMATION) */}
      <td className={`py-2.5 px-2 font-bold text-[#FF5252] text-sm tabular-nums transition-colors duration-150 ${peFlashClass}`}>
        ₹{peLtp.toFixed(2)}
      </td>

      {/* PUTS (PE) GREEKS */}
      {showAdvancedGreeks && (
        <td className="py-2.5 px-2 text-[10px] text-[#8B949E]">
          Δ {row.pe.delta.toFixed(2)} | IV {row.pe.iv.toFixed(1)}%
        </td>
      )}
    </tr>
  );
};

// High-performance memoization: only re-render row if strike, ATM status, greeks mode, or ticks actually change
export const OptionChainRow = React.memo(
  OptionChainRowComponent,
  (prevProps, nextProps) => {
    const prevCeLtp = prevProps.ceTick?.ltp ?? prevProps.row.ce.ltp;
    const nextCeLtp = nextProps.ceTick?.ltp ?? nextProps.row.ce.ltp;

    const prevPeLtp = prevProps.peTick?.ltp ?? prevProps.row.pe.ltp;
    const nextPeLtp = nextProps.peTick?.ltp ?? nextProps.row.pe.ltp;

    return (
      prevProps.row.strikePrice === nextProps.row.strikePrice &&
      prevProps.isAtm === nextProps.isAtm &&
      prevProps.showAdvancedGreeks === nextProps.showAdvancedGreeks &&
      prevCeLtp === nextCeLtp &&
      prevPeLtp === nextPeLtp
    );
  }
);
