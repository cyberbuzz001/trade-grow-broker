import React, { useState } from 'react';
import { ChevronLeft, CreditCard, CheckCircle2, XCircle, Loader2, ArrowRight, Minus, Plus, Info, Zap, ShieldCheck } from 'lucide-react';

interface MobileOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockName: string;
  stockSymbol: string;
  stockPrice: number;
  token?: string | null;
  onConfirmSuccess: () => void;
}

export const MobileOrderModal: React.FC<MobileOrderModalProps> = ({
  isOpen,
  onClose,
  stockName,
  stockSymbol,
  stockPrice,
  token,
  onConfirmSuccess,
}) => {
  const [step, setStep] = useState<'CONFIRM' | 'PLACING' | 'SUCCESS' | 'REJECTED'>('CONFIRM');
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [productType, setProductType] = useState<'MIS' | 'CNC' | 'CO'>('MIS');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL'>('MARKET');
  const [showCharges, setShowCharges] = useState(false);

  if (!isOpen) return null;

  const lotSize = stockSymbol.includes('SENSEX') ? 20 : (stockSymbol.includes('NIFTY') ? 65 : 1);
  const totalValue = stockPrice * quantity;
  const leverageMultiplier = productType === 'MIS' ? 5 : 1;
  const requiredMargin = totalValue / leverageMultiplier;

  // Real-time Top Broker Fee Breakdown Calculator
  const brokerageFee = 0.00; // Zero Brokerage Model
  const sttTax = Math.round(totalValue * 0.001 * 100) / 100;
  const exchangeChg = Math.round(totalValue * 0.00035 * 100) / 100;
  const totalCharges = brokerageFee + sttTax + exchangeChg;

  const handleClose = () => {
    setStep('CONFIRM');
    setRejectionMessage('');
    setQuantity(1);
    setOrderSide('BUY');
    onClose();
  };

  const handleConfirm = async () => {
    navigator.vibrate?.(40);
    const authToken = token || localStorage.getItem('token') || localStorage.getItem('stocksharp_token');

    if (!authToken) {
      setRejectionMessage('Authentication expired. Please log in again.');
      setStep('REJECTED');
      return;
    }

    setStep('PLACING');

    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          instrumentToken: stockSymbol,
          exchange: stockSymbol.startsWith('BSE_') || stockSymbol.startsWith('BFO_') ? 'BSE' : 'NSE',
          symbol: stockSymbol.replace(/^(NSE_|BSE_|NFO_|BFO_)/, ''),
          side: orderSide,
          quantity: quantity,
          price: stockPrice,
          orderType: orderType,
          productType: productType === 'CO' ? 'MIS' : productType,
        }),
      });

      const data = await res.json();

      if (data.success) {
        navigator.vibrate?.([30, 50, 30]);
        setStep('SUCCESS');
        onConfirmSuccess();
      } else {
        navigator.vibrate?.([100, 50, 100]);
        const errMsg = data.error?.message || data.message || 'Order was rejected by the exchange.';
        setRejectionMessage(errMsg);
        setStep('REJECTED');
      }
    } catch (err: any) {
      navigator.vibrate?.([100, 50, 100]);
      setRejectionMessage(err.message || 'Network error. Please check connection and try again.');
      setStep('REJECTED');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 touch-action-manipulation overscroll-y-contain font-body text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 pb-[env(safe-area-inset-bottom,20px)]">
        
        {/* Mobile Drag Handle Bar */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto sm:hidden opacity-80" />

        {step === 'CONFIRM' ? (
          /* KITE / GROWW STYLE MOBILE ORDER SHEET */
          <>
            {/* Header: Contract & Live LTP */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(20);
                  handleClose();
                }}
                className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition cursor-pointer min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <h3 className="text-sm font-black text-white">{stockName}</h3>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  LTP: ₹{stockPrice.toFixed(2)}
                </span>
              </div>

              <div className="w-10" />
            </div>

            {/* BUY / SELL Toggle Bar */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(20);
                  setOrderSide('BUY');
                }}
                className={`py-3 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[44px] ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(20);
                  setOrderSide('SELL');
                }}
                className={`py-3 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[44px] ${
                  orderSide === 'SELL'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            {/* Product Type Switcher (Intraday MIS 5x vs Delivery CNC vs Cover Order) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Product Code</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {[
                  { id: 'MIS', label: 'Intraday (MIS 5x)' },
                  { id: 'CNC', label: 'Delivery (CNC)' },
                  { id: 'CO', label: 'Cover (CO)' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      navigator.vibrate?.(20);
                      setProductType(p.id as any);
                    }}
                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer min-h-[40px] ${
                      productType === p.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Type Switcher (Market vs Limit vs SL) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Order Type</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {(['MARKET', 'LIMIT', 'SL'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      navigator.vibrate?.(20);
                      setOrderType(t);
                    }}
                    className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer min-h-[40px] ${
                      orderType === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Stepper & Quick Lot Multipliers (InputMode Numeric for Mobile Keypad) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Quantity</span>
                <span className="font-mono text-emerald-400">Lot Size: {lotSize} Qty</span>
              </div>

              <div className="flex items-center gap-3 p-2 rounded-xl border border-slate-800 bg-slate-950">
                <button
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(20);
                    setQuantity(Math.max(1, quantity - 1));
                  }}
                  className="min-w-[48px] min-h-[48px] rounded-xl bg-slate-800 border border-slate-700 text-white font-black text-lg flex items-center justify-center active:scale-95 transition cursor-pointer"
                >
                  <Minus className="w-5 h-5" />
                </button>
                
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center bg-transparent text-2xl font-black text-white num-font outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />

                <button
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(20);
                    setQuantity(quantity + 1);
                  }}
                  className="min-w-[48px] min-h-[48px] rounded-xl bg-slate-800 border border-slate-700 text-white font-black text-lg flex items-center justify-center active:scale-95 transition cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Lot Multipliers */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {[1, 5, 10, 25].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      navigator.vibrate?.(20);
                      setQuantity(m * lotSize);
                    }}
                    className="py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold text-slate-300 hover:border-emerald-500/50 hover:text-white cursor-pointer min-h-[36px]"
                  >
                    +{m} Lot{m > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Margin & Charges Calculator Card (Top Broker Style) */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" /> Required Margin:
                </span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowCharges(!showCharges)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <Info className="w-3 h-3 text-indigo-400" /> Brokerage & Taxes: <strong className="text-white">₹{totalCharges.toFixed(2)}</strong>
                </button>
                <span className="text-emerald-400 font-bold">₹0 Brokerage</span>
              </div>

              {showCharges && (
                <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-850 space-y-1 animate-in fade-in">
                  <div className="flex justify-between"><span>Brokerage Fee</span><span className="text-emerald-400 font-bold">₹0.00 (Zero)</span></div>
                  <div className="flex justify-between"><span>STT / CTT Tax</span><span>₹{sttTax.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Exchange Transaction Charges</span><span>₹{exchangeChg.toFixed(2)}</span></div>
                </div>
              )}
            </div>

            {/* Swipeable / Instant Submit Button */}
            <button
              type="button"
              onClick={handleConfirm}
              className={`w-full py-3.5 rounded-xl font-black text-sm shadow-xl transition-all active:scale-95 cursor-pointer min-h-[48px] flex items-center justify-center gap-2 ${
                orderSide === 'BUY'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/40'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
              }`}
            >
              <span>Confirm {orderSide} {quantity} Qty @ ₹{stockPrice.toFixed(2)}</span>
            </button>
          </>
        ) : step === 'PLACING' ? (
          /* STEP: PLACING ORDER */
          <div className="text-center space-y-5 py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Submitting Order to Exchange...</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Executing {orderSide} for {stockName}
              </p>
            </div>
          </div>
        ) : step === 'REJECTED' ? (
          /* STEP: REJECTED */
          <div className="text-center space-y-5 py-3">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto animate-in zoom-in duration-200">
              <XCircle className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-rose-400">Order Rejected</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Exchange rejected your {orderSide} order.
              </p>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-left">
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Reason</div>
              <p className="text-xs font-bold text-rose-300 leading-relaxed">
                {rejectionMessage}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(20);
                  setStep('CONFIRM');
                  setRejectionMessage('');
                }}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer min-h-[44px]"
              >
                Retry Order
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full text-xs font-bold text-slate-400 hover:text-white py-1 cursor-pointer min-h-[44px]"
              >
                Close Drawer
              </button>
            </div>
          </div>
        ) : (
          /* STEP: SUCCESS */
          <div className="text-center space-y-5 py-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto animate-in zoom-in duration-200">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Order Executed!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Placed {orderSide} for {quantity} Qty of {stockName} @ ₹{stockPrice.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs shadow-md cursor-pointer min-h-[44px]"
              >
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
