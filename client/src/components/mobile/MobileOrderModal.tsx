import React, { useState } from 'react';
import { ChevronLeft, CreditCard, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface MobileOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockName: string;
  stockSymbol: string;
  stockPrice: number;
  onConfirmSuccess: () => void;
}

export const MobileOrderModal: React.FC<MobileOrderModalProps> = ({
  isOpen,
  onClose,
  stockName,
  stockSymbol,
  stockPrice,
  onConfirmSuccess,
}) => {
  const [step, setStep] = useState<'CONFIRM' | 'SUCCESS'>('CONFIRM');

  if (!isOpen) return null;

  const totalCost = stockPrice + 1.0;

  const handleConfirm = () => {
    setStep('SUCCESS');
    onConfirmSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        
        {step === 'CONFIRM' ? (
          /* STEP 1: CONFIRM ORDER (MATCHING 14_PREVIEW14.PNG) */
          <>
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-light)]">
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-[var(--bg-surface-elevated)] flex items-center justify-center text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-[var(--text-main)]">Confirm Order</h3>
              <div className="w-9" />
            </div>

            {/* Total Cost */}
            <div className="text-center py-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Total Cost</div>
              <div className="text-4xl font-black text-[var(--text-main)] num-font tracking-tight mt-1">
                ${totalCost.toFixed(2)}
              </div>
            </div>

            {/* Stock You Buy Card */}
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2">Stock you buy</div>
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm">
                    🏦
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-[var(--text-main)]">{stockName}</h4>
                    <p className="text-xs text-slate-400 font-bold">{stockSymbol}</p>
                  </div>
                </div>
                <div className="font-black text-base text-[var(--text-main)] num-font">
                  ${stockPrice.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2">Payment method</div>
              <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[var(--gogrow-blue)] flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-[var(--text-main)]">GoGrow Wallet</div>
                  <div className="text-xs text-slate-400 font-bold">**************2356</div>
                </div>
              </div>
            </div>

            {/* Payment Details List */}
            <div className="space-y-3 pt-2 text-xs font-extrabold num-font">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Funding source</span>
                <span className="text-[var(--gogrow-blue)] font-black">GoGrow</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Approx. Share Price</span>
                <span className="text-[var(--text-main)] font-black">${stockPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Approx. Shares</span>
                <span className="text-[var(--text-main)] font-black">1.000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold">Fee</span>
                <span className="text-[var(--text-main)] font-black">$1.00</span>
              </div>
            </div>

            {/* Confirm Blue Button */}
            <button
              onClick={handleConfirm}
              className="w-full py-4 rounded-2xl bg-[var(--gogrow-blue)] hover:bg-[var(--gogrow-blue-hover)] text-white font-black text-base shadow-lg shadow-blue-500/30 transition-transform active:scale-98"
            >
              Confirm
            </button>
          </>
        ) : (
          /* STEP 2: TRANSACTION COMPLETE (MATCHING 16_PREVIEW16.PNG) */
          <div className="text-center space-y-6 py-4">
            
            {/* Success Circle Icon */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <h3 className="text-2xl font-black text-[var(--text-main)]">
                Transaction Complete
              </h3>
              <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto mt-2">
                Your transaction has been completed. You purchased ${stockPrice.toFixed(2)} of {stockName}.
              </p>
            </div>

            {/* Smooth Blue Wave Chart Visualization */}
            <div className="w-full h-28 bg-blue-500/10 rounded-2xl p-2 overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 300 80">
                <path
                  d="M 0 60 Q 50 10 100 40 T 200 15 T 300 50 L 300 80 L 0 80 Z"
                  fill="rgba(59, 130, 246, 0.25)"
                />
                <path
                  d="M 0 60 Q 50 10 100 40 T 200 15 T 300 50"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                />
              </svg>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => { setStep('CONFIRM'); onClose(); }}
                className="w-full py-4 rounded-2xl bg-[var(--gogrow-blue)] text-white font-black text-base shadow-lg shadow-blue-500/30 active:scale-98"
              >
                View Portfolio
              </button>

              <button
                onClick={() => { setStep('CONFIRM'); onClose(); }}
                className="w-full text-xs font-extrabold text-[var(--gogrow-blue)] hover:underline py-1"
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
