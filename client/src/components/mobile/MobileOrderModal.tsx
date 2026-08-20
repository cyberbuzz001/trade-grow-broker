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
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 touch-action-manipulation overscroll-y-contain font-body text-[var(--text-main)]">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 pb-[env(safe-area-inset-bottom,20px)]">
        
        {/* Mobile Drag Handle Bar */}
        <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full mx-auto sm:hidden opacity-80" />

        {step === 'CONFIRM' ? (
          /* KITE / GROWW STYLE MOBILE ORDER SHEET */
          <>
            {/* Header: Contract & Live LTP */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(20);
                  handleClose();
                }}
                className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] active:scale-95 transition cursor-pointer min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="text-center">
                <h3 className="text-sm font-black text-[var(--text-main)]">{stockName}</h3>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  LTP: ₹{stockPrice.toFixed(2)}
                </span>
              </div>

              <div className="w-10" />
            </div>

            {/* BUY / SELL Toggle Bar */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => {
                  navigator.vibrate?.(20);
                  setOrderSide('BUY');
                }}
                className={`py-3 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[44px] ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
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
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                SELL
              </button>
            </div>

            {/* Product Type (MIS Intraday vs CNC Delivery) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)]">Product Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['MIS', 'CNC', 'CO'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      navigator.vibrate?.(15);
                      setProductType(type);
                    }}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer min-h-[44px] ${
                      productType === type
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {type === 'MIS' ? 'Intraday (MIS)' : type === 'CNC' ? 'Delivery (CNC)' : 'Cover (CO)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Order Type (MARKET vs LIMIT vs SL) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-muted)]">Order Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['MARKET', 'LIMIT', 'SL'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      navigator.vibrate?.(15);
                      setOrderType(type);
                    }}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition cursor-pointer min-h-[44px] ${
                      orderType === type
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                        : 'border-[var(--border-color)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Stepper */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-muted)]">Quantity ({lotSize > 1 ? `${lotSize}/Lot` : 'Shares'})</label>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  Total: {quantity * lotSize} Units
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(15);
                    setQuantity((prev) => Math.max(1, prev - 1));
                  }}
                  className="w-12 h-12 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-main)] hover:border-emerald-500 active:scale-95 transition cursor-pointer"
                >
                  <Minus className="w-5 h-5" />
                </button>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center font-mono font-black text-lg py-2.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(15);
                    setQuantity((prev) => prev + 1);
                  }}
                  className="w-12 h-12 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-main)] hover:border-emerald-500 active:scale-95 transition cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Margin Calculation & Breakdown */}
            <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-2xl p-4 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Order Value:</span>
                <span className="font-bold text-[var(--text-main)]">₹{totalValue.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Margin Required ({leverageMultiplier}x):</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">₹{requiredMargin.toFixed(2)}</span>
              </div>

              {showCharges && (
                <div className="pt-2 border-t border-[var(--border-color)] space-y-1 text-[11px] text-[var(--text-muted)]">
                  <div className="flex justify-between">
                    <span>Brokerage:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹0.00 (Zero)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>STT/CTT & Exchange Chg:</span>
                    <span>₹{totalCharges.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCharges(!showCharges)}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer pt-1"
              >
                <Info className="w-3 h-3" /> {showCharges ? 'Hide Charges Breakdown' : 'Show Charges & Taxes'}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-xs font-bold text-[var(--text-main)] hover:bg-[var(--border-color)] active:scale-95 transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className={`flex-[2] py-3.5 rounded-xl text-white font-black text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer min-h-[44px] ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/20'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>CONFIRM {orderSide}</span>
              </button>
            </div>
          </>
        ) : step === 'PLACING' ? (
          /* PLACING STATE */
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto" />
            <h3 className="text-base font-bold text-[var(--text-main)]">Executing simulated order...</h3>
            <p className="text-xs text-[var(--text-muted)]">Routing to TradeGrow matching engine</p>
          </div>
        ) : step === 'SUCCESS' ? (
          /* SUCCESS STATE */
          <div className="py-8 text-center space-y-4 font-mono">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-[var(--text-main)]">Order Placed Successfully!</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {orderSide} {quantity * lotSize} Qty of {stockSymbol} executed @ ₹{stockPrice.toFixed(2)}
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-950/20 cursor-pointer min-h-[44px]"
            >
              Back to Trading
            </button>
          </div>
        ) : (
          /* REJECTED STATE */
          <div className="py-8 text-center space-y-4 font-mono">
            <div className="w-14 h-14 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500 mx-auto">
              <XCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-rose-600 dark:text-rose-400">Order Rejected</h3>
            <p className="text-xs text-[var(--text-muted)]">{rejectionMessage}</p>

            <button
              type="button"
              onClick={() => setStep('CONFIRM')}
              className="w-full py-3.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-950/20 cursor-pointer min-h-[44px]"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
