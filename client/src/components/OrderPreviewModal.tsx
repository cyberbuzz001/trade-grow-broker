import React, { useState, useEffect } from 'react';
import { X, Send, AlertTriangle, ShieldCheck, Plus, Minus, CheckCircle2, XCircle, Loader2, Wallet, Calculator } from 'lucide-react';

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
  const [userWalletBalance, setUserWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Order submission state — shown INSIDE the modal
  const [orderStep, setOrderStep] = useState<'FORM' | 'PLACING' | 'SUCCESS' | 'REJECTED'>('FORM');
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState('');

  // Fetch live wallet balance when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const authToken = userToken || localStorage.getItem('token') || localStorage.getItem('stocksharp_token') || '';
    if (!authToken) return;
    fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.wallet) {
          setUserWalletBalance(data.wallet.buyingPower ?? data.wallet.cashBalance ?? 0);
        }
      })
      .catch(() => {});
  }, [isOpen, userToken]);

  // Initialize editable state when modal opens or details change
  useEffect(() => {
    if (details) {
      setLots(details.lots || 1);
      setOrderType(details.orderType || 'MARKET');
      setPrice(details.price || 0);
      setProductType(details.productType === 'NRML' ? 'NRML' : 'MIS');
      // Reset order step whenever modal reopens
      setOrderStep('FORM');
      setRejectionMessage('');
      setConfirmedOrderId('');
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

    const authToken = userToken || localStorage.getItem('token') || localStorage.getItem('stocksharp_token') || '';

    fetch(`/api/v1/margin/quote?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMarginQuote(data);
        } else {
          setMarginQuote({
            canPlaceOrder: true,
            requiredMargin: currentPrice * currentQty / (productType === 'MIS' ? 5 : 1),
            availableFunds: userWalletBalance ?? 1000000,
            statutoryCharges: { total: 12.50 }
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setMarginQuote({
          canPlaceOrder: true,
          requiredMargin: currentPrice * currentQty / (productType === 'MIS' ? 5 : 1),
          availableFunds: userWalletBalance ?? 1000000,
          statutoryCharges: { total: 12.50 }
        });
        setLoading(false);
      });
  }, [isOpen, details, userToken, lots, orderType, price, productType, userWalletBalance]);

  if (!isOpen || !details) return null;

  const isBuy = details.side === 'BUY';
  const currentLotSize = details.lotSize || 65;
  const totalQty = Math.max(1, lots) * currentLotSize;
  const currentPrice = price > 0 ? price : details.price;
  const orderValue = currentPrice * totalQty;

  const handleConfirm = async () => {
    const finalDetails: OrderPreviewDetails = {
      ...details,
      lots: Math.max(1, lots),
      lotSize: currentLotSize,
      quantity: totalQty,
      price: currentPrice,
      orderType,
      productType
    };

    setOrderStep('PLACING');

    try {
      const authToken = userToken || localStorage.getItem('token') || localStorage.getItem('stocksharp_token') || '';

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          instrumentToken: finalDetails.token,
          exchange: finalDetails.exchange,
          symbol: finalDetails.symbol,
          side: finalDetails.side,
          quantity: finalDetails.quantity,
          price: finalDetails.price,
          orderType: finalDetails.orderType,
          productType: finalDetails.productType
        })
      });

      const data = await res.json();

      if (data.success) {
        setConfirmedOrderId(data.orderId || '');
        setOrderStep('SUCCESS');
        // Also trigger parent callback for wallet refresh etc.
        onConfirm(finalDetails);
      } else {
        const errMsg = data.error?.message || data.message || 'Order was rejected by the risk management system.';
        setRejectionMessage(errMsg);
        setOrderStep('REJECTED');
      }
    } catch (err: any) {
      setRejectionMessage(err.message || 'Network error. Please check your connection and try again.');
      setOrderStep('REJECTED');
    }
  };

  const handleClose = () => {
    setOrderStep('FORM');
    setRejectionMessage('');
    setConfirmedOrderId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-3 bg-black/85 backdrop-blur-md animate-in fade-in select-none pb-16 sm:pb-3">
      
      {/* MODAL WINDOW CONTAINER */}
      <div className="bg-[#0D1117] text-white border border-[#30363D] rounded-2xl max-w-md w-full max-h-[82vh] sm:max-h-[85vh] shadow-2xl flex flex-col overflow-hidden relative font-body text-xs">
        
        {/* ── PLACING ORDER (Loading Spinner) ── */}
        {orderStep === 'PLACING' && (
          <>
            <div className="p-3 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between shrink-0 font-headline">
              <span className="text-[10px] text-[#8B949E] font-bold">PROCESSING ORDER</span>
              <div className="w-4" />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
              <h3 className="text-base font-black text-white font-headline">Placing Order...</h3>
              <p className="text-[11px] text-[#8B949E] font-bold text-center">
                Processing your {details.side} order for {details.symbol}
              </p>
            </div>
          </>
        )}

        {/* ── ORDER SUCCESS ── */}
        {orderStep === 'SUCCESS' && (
          <>
            <div className="p-3 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between shrink-0 font-headline">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30">
                ORDER PLACED
              </span>
              <button onClick={handleClose} className="p-1 rounded-full text-[#8B949E] hover:text-white hover:bg-[#30363D] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-black text-white font-headline">Order Executed!</h3>
              <p className="text-[11px] text-[#8B949E] font-bold text-center max-w-xs">
                {details.side} {lots} Lot(s) of {details.symbol} @ ₹{currentPrice.toFixed(2)} placed successfully.
              </p>

              {/* Order Summary Card */}
              <div className="w-full bg-[#161B22] border border-[#30363D] rounded-xl p-3 space-y-1.5 text-[11px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Symbol</span>
                  <span className="font-bold text-white">{details.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Side</span>
                  <span className={`font-bold ${isBuy ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>{details.side}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Quantity</span>
                  <span className="font-bold text-white">{totalQty} ({lots} Lot{lots > 1 ? 's' : ''})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Price</span>
                  <span className="font-bold text-white">₹{currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[#30363D] pt-1.5">
                  <span className="text-[#8B949E]">Order Value</span>
                  <span className="font-bold text-[#00E676]">₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-[#0D1117] font-black text-xs transition-all shadow-md font-headline active:scale-95"
              >
                DONE
              </button>
            </div>
          </>
        )}

        {/* ── ORDER REJECTED — Error shown INSIDE modal ── */}
        {orderStep === 'REJECTED' && (
          <>
            <div className="p-3 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between shrink-0 font-headline">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-[#FF5252]/20 text-[#FF5252] border border-[#FF5252]/30">
                ORDER REJECTED
              </span>
              <button onClick={handleClose} className="p-1 rounded-full text-[#8B949E] hover:text-white hover:bg-[#30363D] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center p-5 space-y-4 overflow-y-auto">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center animate-in zoom-in duration-300">
                <XCircle className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-black text-[#FF5252] font-headline">Order Rejected</h3>
              <p className="text-[11px] text-[#8B949E] font-bold text-center">
                Your {details.side} order for {details.symbol} could not be placed.
              </p>

              {/* Rejection Reason Card */}
              <div className="w-full bg-[#FF5252]/10 border border-[#FF5252]/30 rounded-xl p-3.5 text-left">
                <div className="text-[9px] font-bold text-[#FF5252] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  REJECTION REASON
                </div>
                <p className="text-[12px] font-bold text-[#FF8A80] leading-relaxed">
                  {rejectionMessage}
                </p>
              </div>

              {/* Order Details Summary */}
              <div className="w-full bg-[#161B22] border border-[#30363D] rounded-xl p-3 space-y-1.5 text-[11px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Symbol</span>
                  <span className="font-bold text-white">{details.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Side</span>
                  <span className={`font-bold ${isBuy ? 'text-[#00E676]' : 'text-[#FF5252]'}`}>{details.side}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Qty × Price</span>
                  <span className="font-bold text-white">{totalQty} × ₹{currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[#30363D] pt-1.5">
                  <span className="text-[#8B949E]">Required Capital</span>
                  <span className="font-bold text-[#FF5252]">₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2 pt-1">
                <button
                  onClick={() => { setOrderStep('FORM'); setRejectionMessage(''); }}
                  className="w-full py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-[#0D1117] font-black text-xs transition-all shadow-md font-headline active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Send size={14} />
                  RETRY ORDER
                </button>
                <button
                  onClick={handleClose}
                  className="w-full py-2 rounded-xl border border-[#30363D] text-[#8B949E] hover:text-white font-bold text-xs transition-all"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── FORM (Default Order Preview) ── */}
        {orderStep === 'FORM' && (
          <>
            {/* 1. COMPACT STICKY MODAL HEADER */}
            <div className="p-3 bg-[#161B22] border-b border-[#30363D] flex items-center justify-between shrink-0 font-headline">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                  isBuy ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30' : 'bg-[#FF5252]/20 text-[#FF5252] border border-[#FF5252]/30'
                }`}>
                  ORDER PREVIEW ({details.side})
                </span>
                <span className="text-[10px] text-[#8B949E] font-bold">{details.exchange}</span>
              </div>

              <button
                onClick={handleClose}
                className="p-1 rounded-full text-[#8B949E] hover:text-white hover:bg-[#30363D] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* 2. COMPACT SCROLLABLE MODAL BODY */}
            <div className="p-3 overflow-y-auto flex-1 space-y-2.5 font-label text-xs">
              
              {/* Symbol Title & Expiry */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-headline font-extrabold text-base text-white tracking-tight">{details.symbol}</h2>
                  <p className="text-[10px] text-[#8B949E] font-semibold">Expiry: {details.expiry}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8B949E] font-bold uppercase block">SPOT / LTP</span>
                  <span className="text-xs font-bold text-[#00E676] tabular-nums">₹{currentPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* EDIT LOTS & PRICE GRID */}
              <div className="grid grid-cols-2 gap-2">
                
                {/* Edit Lots */}
                <div className="bg-[#161B22] p-2.5 rounded-xl border border-[#30363D]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-[#8B949E] font-bold uppercase tracking-tight">EDIT LOTS</span>
                    <span className="text-[9px] text-[#00E676] font-bold">{currentLotSize} Qty/Lot</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLots(prev => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-[#1C2128] border border-[#30363D] font-bold text-xs text-white hover:bg-[#00E676] hover:text-[#0D1117] flex items-center justify-center transition-colors"
                      >
                        <Minus size={12} />
                      </button>

                      <input
                        type="number"
                        min="1"
                        value={lots}
                        onChange={(e) => setLots(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-10 text-center bg-[#1C2128] border border-[#30363D] rounded-lg py-0.5 text-xs font-bold text-white focus:outline-none focus:border-[#00E676] tabular-nums"
                      />

                      <button
                        type="button"
                        onClick={() => setLots(prev => prev + 1)}
                        className="w-7 h-7 rounded-lg bg-[#1C2128] border border-[#30363D] font-bold text-xs text-white hover:bg-[#00E676] hover:text-[#0D1117] flex items-center justify-center transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#8B949E] mt-1 block tabular-nums">
                    = {totalQty} Qty Total
                  </span>
                </div>

                {/* Order Type & Price */}
                <div className="bg-[#161B22] p-2.5 rounded-xl border border-[#30363D] flex flex-col justify-between">
                  <span className="text-[9px] text-[#8B949E] font-bold block mb-1 uppercase tracking-tight">ORDER TYPE & PRICE</span>
                  
                  <div className="grid grid-cols-3 gap-0.5 bg-[#0D1117] p-0.5 rounded-lg border border-[#30363D] mb-1 font-headline">
                    {(['MARKET', 'LIMIT', 'SL'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className={`py-0.5 rounded text-[9px] font-black transition-all ${
                          orderType === type
                            ? 'bg-[#00E676] text-[#0D1117] shadow-xs'
                            : 'text-[#8B949E] hover:text-white'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {orderType === 'MARKET' ? (
                    <span className="text-[11px] font-bold text-white tabular-nums">
                      ₹{details.price.toFixed(2)} (MARKET)
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-[#8B949E]">₹</span>
                      <input
                        type="number"
                        step="0.05"
                        value={price}
                        onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#1C2128] border border-[#30363D] rounded px-1.5 py-0.5 text-xs font-bold text-white focus:outline-none focus:border-[#00E676] tabular-nums"
                        placeholder="Limit Price"
                      />
                    </div>
                  )}
                </div>

              </div>

              {/* Product Type (MIS Intraday vs NRML Overnight) */}
              <div className="flex items-center justify-between bg-[#161B22] p-2.5 rounded-xl border border-[#30363D]">
                <span className="text-[10px] font-extrabold text-[#8B949E] uppercase font-headline">PRODUCT TYPE:</span>
                <div className="flex gap-1.5 font-headline">
                  <button
                    type="button"
                    onClick={() => setProductType('MIS')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${
                      productType === 'MIS'
                        ? 'bg-[#00E676] text-[#0D1117] border-[#00E676] shadow-xs'
                        : 'bg-[#1C2128] border-[#30363D] text-[#8B949E] hover:text-white'
                    }`}
                  >
                    MIS (Intraday)
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductType('NRML')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${
                      productType === 'NRML'
                        ? 'bg-[#00E676] text-[#0D1117] border-[#00E676] shadow-xs'
                        : 'bg-[#1C2128] border-[#30363D] text-[#8B949E] hover:text-white'
                    }`}
                  >
                    NRML (Overnight)
                  </button>
                </div>
              </div>

              {/* Capital & Margin Calculation */}
              {loading ? (
                <div className="p-3 text-center text-[10px] text-[#8B949E] flex items-center justify-center gap-1.5">
                  <div className="w-3.5 h-3.5 border-2 border-[#00E676] border-t-transparent rounded-full animate-spin"></div>
                  Recalculating Margin...
                </div>
              ) : marginQuote ? (
                <div className="space-y-2">
                  <div className="bg-[#161B22] p-3 rounded-xl border border-[#30363D] space-y-2 text-[11px] tabular-nums">
                    <div className="flex justify-between items-center text-[#8B949E]">
                      <span>Gross Order Premium ({totalQty} Qty):</span>
                      <span className="font-bold text-white">₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 px-2 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 text-[#00E676] font-bold text-[10px]">
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={12} /> Platform Brokerage:
                      </span>
                      <span className="text-xs font-black">₹0.00 (FREE)</span>
                    </div>

                    {/* DUAL MARGIN DISPLAY: AVAILABLE MARGIN & REQUIRED MARGIN */}
                    {(() => {
                      const avail = marginQuote.availableFunds ?? userWalletBalance ?? 0;
                      const reqMargin = marginQuote.requiredMargin ?? (orderValue / (productType === 'MIS' ? 5 : 1));
                      const isSufficient = avail >= reqMargin;
                      const diff = Math.abs(avail - reqMargin);

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#30363D]">
                            {/* Available Margin */}
                            <div className="bg-[#0D1117] p-2 rounded-xl border border-cyan-500/30 flex flex-col justify-between shadow-sm">
                              <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-tight flex items-center gap-1">
                                <Wallet size={12} className="text-cyan-400" /> Available Margin
                              </span>
                              <span className="text-xs font-extrabold text-cyan-400 mt-1">
                                ₹{avail.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            {/* Required Margin */}
                            <div className={`bg-[#0D1117] p-2 rounded-xl border flex flex-col justify-between shadow-sm ${
                              isSufficient ? 'border-emerald-500/30' : 'border-rose-500/40'
                            }`}>
                              <span className={`text-[9px] font-bold uppercase tracking-tight flex items-center gap-1 ${
                                isSufficient ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                <Calculator size={12} /> Required Margin
                              </span>
                              <span className={`text-xs font-extrabold mt-1 ${
                                isSufficient ? 'text-[#00E676]' : 'text-rose-400'
                              }`}>
                                ₹{reqMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Margin Sufficiency / Shortfall Indicator */}
                          <div className={`py-1.5 px-2 rounded-lg flex items-center justify-between text-[10px] font-bold border ${
                            isSufficient
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}>
                            <span className="flex items-center gap-1">
                              {isSufficient ? (
                                <>
                                  <CheckCircle2 size={12} className="text-emerald-400" />
                                  <span>Margin Status:</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle size={12} className="text-rose-400" />
                                  <span>Shortfall Alert:</span>
                                </>
                              )}
                            </span>
                            <span className="font-mono">
                              {isSufficient
                                ? `✓ Sufficient (₹${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })} left)`
                                : `⚠️ Need ₹${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })} more`}
                            </span>
                          </div>
                        </>
                      );
                    })()}

                  </div>
                </div>
              ) : null}

            </div>

            {/* 3. COMPACT STICKY MODAL FOOTER WITH GUARANTEED VISIBLE CTA BUTTON */}
            <div className="p-2.5 bg-[#161B22] border-t border-[#30363D] flex items-center justify-between gap-2 shrink-0 sticky bottom-0 z-50">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-2 rounded-lg font-bold text-xs text-[#8B949E] border border-[#30363D] hover:text-white hover:bg-[#1C2128] transition-all"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className={`flex-1 py-2.5 rounded-xl font-headline font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                  isBuy
                    ? 'bg-[#00E676] hover:bg-[#00C853] text-[#0D1117] shadow-[#00E676]/20'
                    : 'bg-[#FF5252] hover:bg-rose-600 text-white shadow-[#FF5252]/20'
                }`}
              >
                <Send size={14} />
                <span>CONFIRM {details.side} ORDER</span>
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
