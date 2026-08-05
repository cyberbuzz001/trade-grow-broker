import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, ShieldCheck, Plus, Minus } from 'lucide-react';

export interface OrderPreviewDetails {
  token: string;
  symbol: string;
  underlying: string;
  exchange: string;
  expiry: string;
  strike: number;
  optionType: 'CE' | 'PE';
  side: 'BUY' | 'SELL';
  lots: number;
  lotSize: number;
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL';
  productType: 'MIS' | 'CNC' | 'NRML';
}

interface OrderPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (details: OrderPreviewDetails) => void;
  details: OrderPreviewDetails | null;
  userToken: string;
}

export const OrderPreviewModal: React.FC<OrderPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  details,
  userToken
}) => {
  const [lots, setLots] = useState<number>(1);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL'>('MARKET');
  const [price, setPrice] = useState<number>(0);
  const [productType, setProductType] = useState<'MIS' | 'NRML'>('MIS');

  const [marginQuote, setMarginQuote] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize editable state when modal opens or details change
  useEffect(() => {
    if (details) {
      setLots(details.lots || 1);
      setOrderType(details.orderType || 'MARKET');
      setPrice(details.price || 0);
      setProductType(details.productType === 'NRML' ? 'NRML' : 'MIS');
    }
  }, [isOpen, details]);

  // Recalculate required capital & margin whenever client edits lots, order type, price, or product type
  useEffect(() => {
    if (!isOpen || !details) return;
    setLoading(true);

    const lotSize = details.lotSize || 65;
    const currentQty = Math.max(1, lots) * lotSize;
    const currentPrice = price > 0 ? price : details.price;

    const queryParams = new URLSearchParams({
      exchange: details.exchange,
      underlying: details.underlying,
      expiry: details.expiry,
      strike: String(details.strike),
      optionType: details.optionType,
      side: details.side,
      quantity: String(currentQty),
      price: String(currentPrice),
      productType,
      instrumentToken: details.token,
    });

    fetch(`/api/v1/margin/quote?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMarginQuote(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, details, userToken, lots, orderType, price, productType]);

  if (!isOpen || !details) return null;

  const isBuy = details.side === 'BUY';
  const currentLotSize = details.lotSize || 65;
  const totalQty = Math.max(1, lots) * currentLotSize;
  const currentPrice = price > 0 ? price : details.price;
  const orderValue = currentPrice * totalQty;

  const handleConfirm = () => {
    onConfirm({
      ...details,
      lots: Math.max(1, lots),
      quantity: totalQty,
      price: currentPrice,
      orderType,
      productType,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          isBuy ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase bg-current/10 tracking-wider">
                ORDER PREVIEW ({details.side})
              </span>
              <span className="text-xs text-[var(--text-muted)] font-bold">{details.exchange}</span>
            </div>
            <h2 className="text-xl font-black text-[var(--text-main)] mt-1">
              {details.underlying} {details.strike} {details.optionType}
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-semibold mt-0.5">
              Expiry: <span className="text-[var(--text-main)] font-bold">{details.expiry || 'Nearest Expiry'}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          
          {/* EDITABLE SECTION: LOTS & ORDER TYPE CONTROLS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 num-font">
            
            {/* 1. EDITABLE LOTS COUNTER */}
            <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-2xl border border-[var(--border-color)] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold">EDIT LOTS</span>
                <span className="text-[10px] text-indigo-500 font-bold">{currentLotSize} Qty/Lot</span>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLots(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] font-bold text-sm text-[var(--text-main)] hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={lots}
                    onChange={(e) => setLots(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-14 text-center bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl py-1 text-sm font-black text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
                  />

                  <button
                    type="button"
                    onClick={() => setLots(prev => prev + 1)}
                    className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] font-bold text-sm text-[var(--text-main)] hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[var(--text-muted)] mt-1.5 block">
                = {totalQty} Qty Total
              </span>
            </div>

            {/* 2. EDITABLE ORDER TYPE & LIMIT PRICE */}
            <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-2xl border border-[var(--border-color)] flex flex-col justify-between">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-extrabold block mb-1">ORDER TYPE & PRICE</span>
              
              {/* Order Type Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-color)] mb-2">
                {(['MARKET', 'LIMIT', 'SL'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setOrderType(type)}
                    className={`py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                      orderType === type
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Price Input */}
              {orderType === 'MARKET' ? (
                <span className="text-xs font-black text-[var(--text-main)] py-1">
                  ₹{details.price.toFixed(2)} (MARKET)
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-[var(--text-muted)]">₹</span>
                  <input
                    type="number"
                    step="0.05"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-2 py-1 text-xs font-black text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
                    placeholder="Limit Price"
                  />
                </div>
              )}
            </div>

          </div>

          {/* EDITABLE PRODUCT TYPE (MIS Intraday vs NRML Overnight) */}
          <div className="flex items-center justify-between bg-[var(--bg-surface-elevated)] p-3 rounded-2xl border border-[var(--border-color)]">
            <span className="text-xs font-extrabold text-[var(--text-tertiary)] uppercase">Product Type:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProductType('MIS')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  productType === 'MIS'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                MIS (Intraday)
              </button>

              <button
                type="button"
                onClick={() => setProductType('NRML')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  productType === 'NRML'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-[var(--bg-surface)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                NRML (Overnight)
              </button>
            </div>
          </div>

          {/* Capital & Margin Calculation Breakdown */}
          {loading ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              Recalculating Margin for {lots} {lots === 1 ? 'Lot' : 'Lots'} ({totalQty} Qty)...
            </div>
          ) : marginQuote ? (
            <div className="space-y-3">
              
              {/* Financial Calculation Table */}
              <div className="bg-[var(--bg-surface-elevated)] p-4 rounded-2xl border border-[var(--border-color)] space-y-2 text-xs num-font">
                
                <div className="flex justify-between items-center text-[var(--text-muted)]">
                  <span>Gross Order Premium ({totalQty} Qty):</span>
                  <span className="font-bold text-[var(--text-main)]">₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                {/* ZERO BROKERAGE PROMINENT HIGHLIGHT */}
                <div className="flex justify-between items-center py-1.5 px-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} /> Platform Brokerage:
                  </span>
                  <span className="text-sm">₹0.00 (FREE)</span>
                </div>

                {/* Statutory Breakdown */}
                <div className="flex justify-between items-center text-[var(--text-muted)] text-[11px]">
                  <span>Est. Statutory & Exchange Charges:</span>
                  <span className="font-semibold text-[var(--text-main)]">
                    ₹{marginQuote.statutoryCharges.total.toFixed(2)}
                  </span>
                </div>

                {!isBuy && (
                  <>
                    <div className="flex justify-between items-center text-[var(--text-muted)] text-[11px]">
                      <span>SPAN Margin Requirement:</span>
                      <span className="font-semibold text-[var(--text-main)]">₹{marginQuote.spanMargin.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center text-[var(--text-muted)] text-[11px]">
                      <span>Exposure Margin (3%):</span>
                      <span className="font-semibold text-[var(--text-main)]">₹{marginQuote.exposureMargin.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}

                <div className="border-t border-[var(--border-color)] pt-2 flex justify-between items-center font-extrabold text-sm">
                  <span className="text-[var(--text-main)]">Total Required Capital:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 text-base">
                    ₹{marginQuote.requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

              </div>

              {/* Account Funds & Margin Capacity */}
              <div className="bg-[var(--bg-surface-elevated)] p-4 rounded-2xl border border-[var(--border-color)] space-y-2 text-xs num-font">
                <div className="flex justify-between items-center text-[var(--text-muted)]">
                  <span>Available Account Balance:</span>
                  <span className="font-bold text-[var(--text-main)]">₹{marginQuote.availableFunds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between items-center text-[var(--text-muted)]">
                  <span>Funds Remaining After Order:</span>
                  <span className={`font-extrabold ${
                    (marginQuote.availableFunds - marginQuote.requiredMargin) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    ₹{(marginQuote.availableFunds - marginQuote.requiredMargin).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Insufficient Funds Warning / Block Banner */}
              {!marginQuote.canPlaceOrder && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3 text-xs">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold uppercase tracking-wider block">ORDER BLOCKED — MARGIN SHORTFALL</span>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      Shortfall: <span className="font-bold">₹{marginQuote.shortfall.toLocaleString('en-IN')}</span>. Please decrease lots or add virtual capital.
                    </p>
                  </div>
                </div>
              )}

            </div>
          ) : null}

        </div>

        {/* Action Buttons */}
        <div className="p-5 bg-[var(--bg-surface-elevated)] border-t border-[var(--border-color)] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-all"
          >
            CANCEL
          </button>

          <button
            disabled={loading || !marginQuote?.canPlaceOrder}
            onClick={handleConfirm}
            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs text-white transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              isBuy
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
            }`}
          >
            <Send size={14} /> CONFIRM {details.side} ({totalQty} QTY)
          </button>
        </div>

      </div>
    </div>
  );
};
