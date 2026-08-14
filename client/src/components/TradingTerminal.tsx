import React, { useState, useEffect } from 'react';
import { MarketTick, Order, Position, Holding, Wallet } from '../types';
import { ChartWindow } from './ChartWindow';
import { OrderPreviewModal, OrderPreviewDetails } from './OrderPreviewModal';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Send, AlertTriangle, TrendingUp, Wallet as WalletIcon, ShoppingCart, SlidersHorizontal, Eye, ShieldAlert } from 'lucide-react';

interface TerminalProps {
  token: string;
  ticks: Map<string, MarketTick>;
  wallet: Wallet | null;
  onRefreshWallet: () => void;
  initialToken?: string;
  initialSymbol?: string;
}

export const TradingTerminal: React.FC<TerminalProps> = ({
  token,
  ticks,
  wallet,
  onRefreshWallet,
  initialToken,
  initialSymbol,
}) => {
  const [selectedToken, setSelectedToken] = useState<string>(initialToken || 'NSE_RELIANCE');
  const [symbol, setSymbol] = useState<string>(initialSymbol || 'RELIANCE');
  const [exchange, setExchange] = useState<string>('NSE');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number>(10);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL'>('MARKET');
  const [productType, setProductType] = useState<'MIS' | 'CNC' | 'NRML'>('MIS');
  const [price, setPrice] = useState<number>(3050);

  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [activeBottomTab, setActiveBottomTab] = useState<'POSITIONS' | 'ORDERS' | 'HOLDINGS'>('POSITIONS');
  const [orderMessage, setOrderMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State for Editable Order Preview Modal
  const [previewDetails, setPreviewDetails] = useState<OrderPreviewDetails | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Sync initialToken and initialSymbol if updated via global search or watchlist
  useEffect(() => {
    if (initialToken) {
      setSelectedToken(initialToken);
      if (initialToken.startsWith('BFO') || initialToken.startsWith('BSE')) {
        setExchange('BSE');
      } else {
        setExchange('NSE');
      }
    }
    if (initialSymbol) {
      setSymbol(initialSymbol);
    }
  }, [initialToken, initialSymbol]);

  const currentTick = ticks.get(selectedToken);

  const watchlists = [
    { token: 'NSE_NIFTY50', symbol: 'NIFTY 50', name: 'Nifty Index' },
    { token: 'BSE_SENSEX', symbol: 'SENSEX', name: 'BSE Sensex Index' },
    { token: 'NFO_NIFTY_24500_CE', symbol: 'NIFTY 24500 CE', name: 'Nifty 24500 Call Option' },
    { token: 'NFO_NIFTY_24500_PE', symbol: 'NIFTY 24500 PE', name: 'Nifty 24500 Put Option' },
    { token: 'BFO_SENSEX_80000_CE', symbol: 'SENSEX 80000 CE', name: 'Sensex 80000 Call Option' },
    { token: 'BFO_SENSEX_80000_PE', symbol: 'SENSEX 80000 PE', name: 'Sensex 80000 Put Option' },
    { token: 'NSE_RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries' },
  ];

  const fetchUserTradingData = () => {
    fetch('/api/v1/orders?todayOnly=true', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => data.success && setOrders(data.orders));

    fetch('/api/v1/portfolio/positions', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => data.success && Array.isArray(data.positions) && setPositions(data.positions.filter((p: any) => (p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)))) !== 0)));

    fetch('/api/v1/portfolio/holdings', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => data.success && setHoldings(data.holdings));
  };

  useEffect(() => {
    if (token) {
      fetchUserTradingData();
    }
  }, [token]);

  // Trigger Order Preview Modal
  const triggerOrderPreview = (orderSide: 'BUY' | 'SELL', customPrice?: number) => {
    const isOption = symbol.includes('CE') || symbol.includes('PE');
    const isSensex = symbol.includes('SENSEX');
    const underlying = isSensex ? 'SENSEX' : (symbol.includes('NIFTY') ? 'NIFTY' : symbol);
    
    const numbers = symbol.match(/\d+/g);
    const strike = (isOption && numbers && numbers.length > 0) ? parseInt(numbers[numbers.length - 1], 10) : 0;
    const optionType = symbol.includes('PE') ? 'PE' : 'CE';
    const lotSize = isSensex ? 20 : (underlying === 'NIFTY' ? 65 : 1);
    const estPrice = customPrice && customPrice > 0 ? customPrice : (price > 0 ? price : (currentTick?.ltp || 125.0));

    const details: OrderPreviewDetails = {
      token: selectedToken,
      symbol,
      underlying,
      exchange: selectedToken.startsWith('BFO') || selectedToken.startsWith('BSE') ? 'BSE' : 'NSE',
      expiry: '2026-08-27',
      strike,
      optionType,
      side: orderSide,
      lots: 1,
      lotSize,
      quantity: lotSize * 1,
      price: estPrice,
      orderType,
      productType: isOption ? 'MIS' : productType,
    };

    setPreviewDetails(details);
    setIsPreviewOpen(true);
  };

  const handleConfirmPreviewOrder = async (confirmed: OrderPreviewDetails) => {
    setOrderMessage({ type: 'success', text: `${confirmed.side} order placed for ${confirmed.symbol} (${confirmed.quantity} Qty @ ₹${confirmed.price.toFixed(2)})` });
    onRefreshWallet();
    fetchUserTradingData();
    setIsPreviewOpen(false);
  };

  const currentPriceDisplay = currentTick?.ltp || (price > 0 ? price : 125.0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      
      {/* LEFT PANE: WATCHLIST (3 Cols) */}
      <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col gap-3 shadow-md backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Pro Watchlist</h2>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-mono">
            LIVE TIX
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto flex-1 max-h-[720px] pr-0.5">
          {watchlists.map(item => {
            const tick = ticks.get(item.token);
            const isSelected = selectedToken === item.token;
            return (
              <div
                key={item.token}
                onClick={() => {
                  setSelectedToken(item.token);
                  setSymbol(item.symbol);
                  if (item.token.startsWith('BFO') || item.token.startsWith('BSE')) {
                    setExchange('BSE');
                  } else {
                    setExchange('NSE');
                  }
                }}
                className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/60 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-850/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
                }`}
              >
                <div>
                  <div className={`font-bold text-xs ${item.symbol.includes('CE') ? 'text-emerald-400' : item.symbol.includes('PE') ? 'text-rose-400' : 'text-white'}`}>
                    {item.symbol}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">{item.name}</div>
                </div>

                {tick ? (
                  <div className="text-right num-font">
                    <div className="font-bold text-xs text-white">₹{tick.ltp.toFixed(2)}</div>
                    <div className={`text-[10px] font-bold ${tick.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tick.change >= 0 ? '+' : ''}{tick.changePercent.toFixed(2)}%
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">₹{item.symbol.includes('SENSEX') ? '180.50' : '125.00'}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTER & RIGHT PANE (9 Cols) */}
      <div className="lg:col-span-9 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* CHART WINDOW (2 Cols) */}
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-md flex flex-col backdrop-blur-xl">
            
            {/* Prominent Option Contract Action Header */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 rounded-xl mb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  REAL-TIME CHART WORKSPACE ({exchange})
                </span>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span className={symbol.includes('CE') ? 'text-emerald-400' : symbol.includes('PE') ? 'text-rose-400' : ''}>
                    {symbol}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30 num-font">
                    LTP: ₹{currentPriceDisplay.toFixed(2)}
                  </span>
                </h3>
              </div>

              {/* DIRECT QUICK BUY & SELL ACTION BUTTONS */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerOrderPreview('BUY', currentPriceDisplay)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <ShoppingCart size={14} /> BUY {symbol}
                </button>

                <button
                  type="button"
                  onClick={() => triggerOrderPreview('SELL', currentPriceDisplay)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-950/40 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <ShoppingCart size={14} /> SELL {symbol}
                </button>
              </div>
            </div>

            <ChartWindow
              symbol={symbol}
              token={selectedToken}
              latestTick={currentTick}
              orders={orders}
              positions={positions}
              onBuyClick={(sym, p) => triggerOrderPreview('BUY', p)}
              onSellClick={(sym, p) => triggerOrderPreview('SELL', p)}
            />
          </div>

          {/* RIGHT: ORDER TICKET PANEL (1 Col) */}
          <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-md backdrop-blur-xl">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <span className="font-bold text-white text-sm">Order Ticket</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Zero Brokerage
                </span>
              </div>

              {/* Side Selector Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSide('BUY')}
                  className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    side === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => setSide('SELL')}
                  className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    side === 'SELL'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                  }`}
                >
                  SELL
                </button>
              </div>

              {/* Order Form */}
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 font-bold text-[11px]">Product:</span>
                  <div className="flex gap-1">
                    {(['MIS', 'NRML'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setProductType(p)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          productType === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 font-bold text-[11px]">Order Type:</span>
                  <div className="flex gap-1">
                    {(['MARKET', 'LIMIT', 'SL'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOrderType(t)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                          orderType === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Open Order Preview Dialog */}
                <button
                  type="button"
                  onClick={() => triggerOrderPreview(side)}
                  className={`w-full py-3 rounded-xl font-black text-xs text-white shadow-xl transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer ${
                    side === 'BUY'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'
                  }`}
                >
                  <Send size={14} /> PREVIEW & EDIT {side} ORDER
                </button>
              </div>

              {orderMessage && (
                <div className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
                  orderMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  {orderMessage.type === 'error' && <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
                  <span>{orderMessage.text}</span>
                </div>
              )}

            </div>

            {/* Wallet Quick Summary */}
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs num-font">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-bold">
                  <WalletIcon size={13} className="text-emerald-400" /> Margin:
                </span>
                <span className="font-bold text-white">
                  ₹{wallet ? wallet.cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM PANE: ORDERS / POSITIONS / HOLDINGS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-md backdrop-blur-xl">
          <div className="flex items-center gap-4 border-b border-slate-800 pb-2 mb-3">
            {(['POSITIONS', 'ORDERS', 'HOLDINGS'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveBottomTab(tab)}
                className={`text-xs font-black uppercase tracking-wider pb-1 border-b-2 transition-all cursor-pointer ${
                  activeBottomTab === tab
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {tab} {tab === 'POSITIONS' ? `(${positions.length})` : tab === 'ORDERS' ? `(${orders.length})` : `(${holdings.length})`}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto max-h-48">
            {activeBottomTab === 'POSITIONS' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Net Qty</th>
                    <th className="py-2.5 px-3 text-right">Avg Price</th>
                    <th className="py-2.5 px-3 text-right">LTP</th>
                    <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 num-font">
                  {positions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                        No active positions found for today.
                      </td>
                    </tr>
                  ) : (
                    positions.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{p.symbol}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-400">{p.productType}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${p.netQty > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{p.netQty}</td>
                        <td className="py-2.5 px-3 text-right text-white">₹{p.averagePrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-white">₹{(p.ltp || p.averagePrice).toFixed(2)}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {p.unrealizedPnl >= 0 ? '+' : ''}₹{p.unrealizedPnl.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeBottomTab === 'ORDERS' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Side</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 num-font">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                        No executed orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 text-amber-400 font-mono">{o.order_id}</td>
                        <td className="py-2.5 px-3 font-bold text-white">{o.symbol}</td>
                        <td className={`py-2.5 px-3 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{o.side}</td>
                        <td className="py-2.5 px-3 text-right text-white">{o.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-white">₹{o.price.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            o.status === 'FILLED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : o.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeBottomTab === 'HOLDINGS' && (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Avg Price</th>
                    <th className="py-2.5 px-3 text-right">Current Value</th>
                    <th className="py-2.5 px-3 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 num-font">
                  {holdings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                        No demat holdings available in account.
                      </td>
                    </tr>
                  ) : (
                    holdings.map(h => (
                      <tr key={h.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{h.symbol}</td>
                        <td className="py-2.5 px-3 text-right text-white">{h.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-white">₹{h.averagePrice.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-white">₹{h.currentValue.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {h.pnl >= 0 ? '+' : ''}₹{h.pnl.toFixed(2)} ({h.pnlPercentage.toFixed(2)}%)
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* EDITABLE ORDER PREVIEW MODAL */}
      {previewDetails && (
        <OrderPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          onConfirm={handleConfirmPreviewOrder}
          details={previewDetails}
          userToken={token}
        />
      )}

    </div>
  );
};
