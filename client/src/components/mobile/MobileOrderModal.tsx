import React, { useState } from 'react';
import { ChevronLeft, CreditCard, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

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

  if (!isOpen) return null;

  const totalCost = stockPrice * quantity;

  const handleClose = () => {
    setStep('CONFIRM');
    setRejectionMessage('');
    setQuantity(1);
    setOrderSide('BUY');
    onClose();
  };

  const handleConfirm = async () => {
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
          exchange: stockSymbol.startsWith('BSE_') ? 'BSE' : 'NSE',
          symbol: stockSymbol.replace(/^(NSE_|BSE_)/, ''),
          side: orderSide,
          quantity: quantity,
          price: stockPrice,
          orderType: 'MARKET',
          productType: 'CNC',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStep('SUCCESS');
        onConfirmSuccess();
      } else {
        const errMsg = data.error?.message || data.message || 'Order was rejected by the system.';
        setRejectionMessage(errMsg);
        setStep('REJECTED');
      }
    } catch (err: any) {
      setRejectionMessage(err.message || 'Network error. Please check your connection and try again.');
      setStep('REJECTED');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200 touch-action-manipulation">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        
        {step === 'CONFIRM' ? (
          /* STEP 1: CONFIRM ORDER */
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-light)]">
              <button
                onClick={handleClose}
                className="w-9 h-9 rounded-xl bg-[var(--bg-surface-elevated)] flex items-center justify-center text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-[var(--text-main)]">Confirm Order</h3>
              <div className="w-9" />
            </div>

            {/* BUY / SELL Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-surface-elevated)] rounded-2xl border border-[var(--border-color)]">
              <button
                onClick={() => setOrderSide('BUY')}
                className={`py-2.5 rounded-xl text-xs font-black transition-all ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setOrderSide('SELL')}
                className={`py-2.5 rounded-xl text-xs font-black transition-all ${
                  orderSide === 'SELL'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            {/* Total Cost */}
            <div className="text-center py-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Total Cost</div>
              <div className="text-4xl font-black text-[var(--text-main)] num-font tracking-tight mt-1">
                ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Stock Card */}
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2">Stock you {orderSide.toLowerCase()}</div>
              <div className={`p-4 rounded-2xl ${orderSide === 'BUY' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${orderSide === 'BUY' ? 'bg-emerald-600' : 'bg-rose-600'} text-white font-black flex items-center justify-center text-sm`}>
                    🏦
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-[var(--text-main)]">{stockName}</h4>
                    <p className="text-xs text-slate-400 font-bold">{stockSymbol}</p>
                  </div>
                </div>
                <div className="font-black text-base text-[var(--text-main)] num-font">
                  ₹{stockPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2">Quantity</div>
              <div className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-black text-lg flex items-center justify-center active:scale-95 transition"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center bg-transparent text-xl font-black text-[var(--text-main)] num-font outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] font-black text-lg flex items-center justify-center active:scale-95 transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Payment Details List */}
            <div className="space-y-3 pt-2 text-xs font-extrabold num-font">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Order Type</span>
                <span className="text-[var(--text-main)] font-black">MARKET</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Product Type</span>
                <span className="text-[var(--text-main)] font-black">CNC (Delivery)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Price per Share</span>
                <span className="text-[var(--text-main)] font-black">₹{stockPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Quantity</span>
                <span className="text-[var(--text-main)] font-black">{quantity}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-3">
                <span className="text-slate-400 font-bold">Total Amount</span>
                <span className="text-[var(--text-main)] font-black text-sm">₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              className={`w-full py-4 rounded-2xl font-black text-base shadow-lg transition-transform active:scale-98 ${
                orderSide === 'BUY'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                  : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
              }`}
            >
              Confirm {orderSide}
            </button>
          </>
        ) : step === 'PLACING' ? (
          /* STEP: PLACING ORDER (Loading State) */
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
              <Loader2 className="w-12 h-12 animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--text-main)]">Placing Order...</h3>
              <p className="text-xs text-slate-400 font-bold mt-2">
                Processing your {orderSide} order for {stockName}
              </p>
            </div>
          </div>
        ) : step === 'REJECTED' ? (
          /* STEP: ORDER REJECTED — Error shown INSIDE modal */
          <div className="text-center space-y-6 py-4">
            
            {/* Error Circle Icon */}
            <div className="w-20 h-20 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto shadow-inner animate-in zoom-in duration-300">
              <XCircle className="w-12 h-12" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-rose-400">
                Order Rejected
              </h3>
              <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto mt-2">
                Your {orderSide} order for {stockName} could not be placed.
              </p>
            </div>

            {/* Rejection Reason Card */}
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-left">
              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1.5">Rejection Reason</div>
              <p className="text-sm font-bold text-rose-300 leading-relaxed">
                {rejectionMessage}
              </p>
            </div>

            {/* Order Details Summary */}
            <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-2xl p-3 space-y-2 text-xs num-font">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Symbol</span>
                <span className="text-[var(--text-main)] font-black">{stockSymbol}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Side</span>
                <span className={`font-black ${orderSide === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{orderSide}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Qty × Price</span>
                <span className="text-[var(--text-main)] font-black">{quantity} × ₹{stockPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  setStep('CONFIRM');
                  setRejectionMessage('');
                }}
                className="w-full py-4 rounded-2xl bg-[var(--gogrow-blue)] text-white font-black text-base shadow-lg shadow-blue-500/30 active:scale-98 transition-transform"
              >
                Retry Order
              </button>

              <button
                onClick={handleClose}
                className="w-full text-xs font-extrabold text-slate-400 hover:text-white hover:underline py-1"
              >
                Close
              </button>
            </div>

          </div>
        ) : (
          /* STEP: SUCCESS */
          <div className="text-center space-y-6 py-4">
            
            {/* Success Circle Icon */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner animate-in zoom-in duration-300">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-[var(--text-main)]">
                Order Placed!
              </h3>
              <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto mt-2">
                Your {orderSide} order for {quantity} share{quantity > 1 ? 's' : ''} of {stockName} at ₹{stockPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} has been placed successfully.
              </p>
            </div>

            {/* Smooth Wave Chart Visualization */}
            <div className="w-full h-28 bg-emerald-500/10 rounded-2xl p-2 overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 300 80">
                <path
                  d="M 0 60 Q 50 10 100 40 T 200 15 T 300 50 L 300 80 L 0 80 Z"
                  fill="rgba(16, 185, 129, 0.25)"
                />
                <path
                  d="M 0 60 Q 50 10 100 40 T 200 15 T 300 50"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                />
              </svg>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleClose}
                className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-black text-base shadow-lg shadow-emerald-500/30 active:scale-98 transition-transform"
              >
                View Portfolio
              </button>

              <button
                onClick={handleClose}
                className="w-full text-xs font-extrabold text-emerald-400 hover:underline py-1"
              >
                Go to Home
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
