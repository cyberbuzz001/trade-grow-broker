import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Target, ShieldAlert, AlertTriangle, X, Search, Send, Zap, Clock, History } from 'lucide-react';
import { useMarketSocket, useSubscribeTokens } from '../hooks/useMarketSocket';
import { Card, Badge, DataTable, DataTableColumn, Button, Dialog } from './ui';
import { PortfolioNav } from './PortfolioNav';
import { pnlColorClass, formatPnl } from '../utils/pnl';

type PortfolioTab = 'POSITIONS' | 'ORDERS' | 'TRADE_HISTORY';

interface OrdersPositionsViewProps {
  token: string;
  initialTab?: PortfolioTab;
  onRefreshWallet?: () => void;
  onOpenOptionChain?: (symbol?: string) => void;
  riskRestriction?: string | null;
}

function getNetQty(p: any): number {
  return p.netQty !== undefined ? p.netQty : (p.net_qty !== undefined ? parseInt(p.net_qty, 10) : ((p.buyQty || 0) - (p.sellQty || 0)));
}

export const OrdersPositionsView: React.FC<OrdersPositionsViewProps> = ({ token, initialTab = 'POSITIONS', onRefreshWallet, onOpenOptionChain, riskRestriction }) => {
  // Route-driven, not local state — PortfolioNav navigates to a new route on
  // tab click, so the URL is always the single source of truth for which tab
  // is active (previously local state could silently diverge from the URL).
  const activeTab = initialTab;
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'ACCEPTED' | 'FILLED' | 'CANCELLED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [orders, setOrders] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [closedTrades, setClosedTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [squareOffModalPos, setSquareOffModalPos] = useState<any | null>(null);
  const [targetModalPos, setTargetModalPos] = useState<any | null>(null);
  const [targetPrice, setTargetPrice] = useState('');
  const [targetPriceError, setTargetPriceError] = useState<string | null>(null);
  const [isTargetConfirmStep, setIsTargetConfirmStep] = useState(false);
  const [editingTargetOrder, setEditingTargetOrder] = useState<any | null>(null);
  const [cancelTargetModalOrder, setCancelTargetModalOrder] = useState<any | null>(null);
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);
  const [isExitAllModalOpen, setIsExitAllModalOpen] = useState(false);

  const subscribedTokens = useMemo(() => {
    const set = new Set<string>();
    positions.forEach((p) => {
      const sym = p.symbol || '';
      if (p.instrumentToken) set.add(p.instrumentToken);
      if (p.instrument_token) set.add(p.instrument_token);
      if (sym) {
        set.add(sym);
        if (sym.includes('NIFTY')) {
          set.add(`NFO_${sym}`);
          const m = sym.match(/NIFTY(\d+)(CE|PE)/);
          if (m) set.add(`NFO_NIFTY_${m[1]}_${m[2]}`);
        } else if (sym.includes('SENSEX')) {
          set.add(`BFO_${sym}`);
          const m = sym.match(/SENSEX(\d+)(CE|PE)/);
          if (m) set.add(`BFO_SENSEX_${m[1]}_${m[2]}`);
        } else {
          set.add(`NSE_${sym}`);
        }
      }
    });
    return Array.from(set);
  }, [positions]);

  const { ticks } = useMarketSocket();
  useSubscribeTokens(subscribedTokens);

  const getLiveLtp = (item: any): number => {
    const sym = item.symbol || '';
    const instToken = item.instrumentToken || item.instrument_token || '';
    const avgPrice = parseFloat(item.averagePrice || item.average_price || item.currentPrice || 0);
    let tick = instToken ? ticks.get(instToken) : undefined;
    if (!tick && sym) {
      tick = ticks.get(sym) || ticks.get(`NSE_${sym}`) || ticks.get(`NFO_${sym}`) || ticks.get(`BFO_${sym}`);
      if (!tick) {
        const mNifty = sym.match(/NIFTY(\d+)(CE|PE)/);
        if (mNifty) tick = ticks.get(`NFO_NIFTY_${mNifty[1]}_${mNifty[2]}`);
        const mSensex = sym.match(/SENSEX(\d+)(CE|PE)/);
        if (mSensex) tick = ticks.get(`BFO_SENSEX_${mSensex[1]}_${mSensex[2]}`);
      }
    }
    if (tick && tick.ltp > 0) return tick.ltp;
    if (item.ltp && parseFloat(item.ltp) > 0) return parseFloat(item.ltp);
    return avgPrice;
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    await Promise.allSettled([
      fetch('/api/v1/orders?todayOnly=true', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data?.success && Array.isArray(data.orders)) setOrders(data.orders); }),
      fetch('/api/v1/portfolio/positions?todayOnly=true', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data?.success && Array.isArray(data.positions)) setPositions(data.positions); }),
      fetch('/api/v1/portfolio/closed-trades?todayOnly=true', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data?.success && Array.isArray(data.closedTrades)) setClosedTrades(data.closedTrades); }),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [token]);

  const getActiveTargetOrder = (pos: any) => {
    const netQty = getNetQty(pos);
    if (netQty === 0) return null;
    const targetSide = netQty > 0 ? 'SELL' : 'BUY';
    return orders.find((o) => (o.status === 'ACCEPTED' || o.status === 'PENDING') && o.symbol === pos.symbol && o.side === targetSide && (o.orderType === 'LIMIT' || o.order_type === 'LIMIT'));
  };

  const submitOrder = (body: Record<string, any>) =>
    fetch('/api/v1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }).then((r) => r.json());

  const confirmSquareOff = async () => {
    if (!squareOffModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    try {
      const pos = squareOffModalPos;
      const netQty = getNetQty(pos);
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const livePrice = getLiveLtp(pos);
      const data = await submitOrder({
        instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
        exchange: pos.exchange || 'NSE', symbol: pos.symbol, side, quantity, price: livePrice,
        orderType: 'MARKET', productType: pos.productType || pos.product_type || 'MIS',
      });
      if (data.success) {
        setActionMessage({ type: 'success', text: `Square-off MARKET order executed for ${pos.symbol} (${quantity} qty) @ ₹${livePrice.toFixed(2)}` });
        fetchData();
        onRefreshWallet?.();
      } else {
        setActionMessage({ type: 'error', text: `Square-off rejected: ${data.error?.message || 'Unknown error'}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Square-off network error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setSquareOffModalPos(null);
    }
  };

  const confirmExitAllPositions = async () => {
    if (openPositions.length === 0 || isSubmittingExit) return;
    setIsSubmittingExit(true);
    let successCount = 0, failCount = 0;
    for (const pos of openPositions) {
      try {
        const netQty = getNetQty(pos);
        if (netQty === 0) continue;
        const side = netQty > 0 ? 'SELL' : 'BUY';
        const quantity = Math.abs(netQty);
        const livePrice = getLiveLtp(pos);
        const data = await submitOrder({
          instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
          exchange: pos.exchange || 'NSE', symbol: pos.symbol, side, quantity, price: livePrice,
          orderType: 'MARKET', productType: pos.productType || pos.product_type || 'MIS',
        });
        if (data.success) successCount++; else failCount++;
      } catch (_) {
        failCount++;
      }
    }
    setIsSubmittingExit(false);
    setIsExitAllModalOpen(false);
    fetchData();
    onRefreshWallet?.();
    if (failCount === 0) {
      setActionMessage({ type: 'success', text: `Successfully squared off all ${successCount} active positions.` });
    } else {
      setActionMessage({ type: 'error', text: `Squared off ${successCount} positions. ${failCount} positions encountered errors.` });
    }
  };

  const handleOpenSetTargetModal = (pos: any, existingTargetOrder?: any) => {
    setTargetModalPos(pos);
    setEditingTargetOrder(existingTargetOrder || null);
    setTargetPrice(existingTargetOrder ? (existingTargetOrder.price || '').toString() : '');
    setTargetPriceError(null);
    setIsTargetConfirmStep(false);
  };

  const handleProceedToTargetConfirm = () => {
    if (!targetModalPos) return;
    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setTargetPriceError('Please enter a valid target exit price.');
      return;
    }
    const cents = Math.round(priceNum * 100);
    if (cents % 5 !== 0) {
      setTargetPriceError('Target price must be in ₹0.05 tick increments (e.g. ₹165.05).');
      return;
    }
    const netQty = getNetQty(targetModalPos);
    const liveLtp = getLiveLtp(targetModalPos);
    const avgPrice = parseFloat(targetModalPos.averagePrice || targetModalPos.average_price || liveLtp);
    if (netQty > 0 && priceNum <= Math.min(avgPrice, liveLtp)) {
      setTargetPriceError(`For a LONG position, the target exit price (₹${priceNum.toFixed(2)}) must be above the entry/current price (₹${liveLtp.toFixed(2)}).`);
      return;
    }
    if (netQty < 0 && priceNum >= Math.max(avgPrice, liveLtp)) {
      setTargetPriceError(`For a SHORT position, the target exit price (₹${priceNum.toFixed(2)}) must be below the entry/current price (₹${liveLtp.toFixed(2)}).`);
      return;
    }
    setTargetPriceError(null);
    setIsTargetConfirmStep(true);
  };

  const confirmPlaceTargetOrder = async () => {
    if (!targetModalPos || isSubmittingExit) return;
    setIsSubmittingExit(true);
    try {
      const pos = targetModalPos;
      const netQty = getNetQty(pos);
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      const priceNum = parseFloat(targetPrice);
      if (editingTargetOrder) {
        const res = await fetch(`/api/v1/orders/${editingTargetOrder.orderId || editingTargetOrder.id || editingTargetOrder.order_id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ price: priceNum, quantity }),
        });
        const data = await res.json();
        if (data.success) {
          setActionMessage({ type: 'success', text: `Target LIMIT order updated to ₹${priceNum.toFixed(2)} for ${pos.symbol}` });
          fetchData();
        } else {
          setActionMessage({ type: 'error', text: `Target modification failed: ${data.error?.message}` });
        }
      } else {
        const data = await submitOrder({
          instrumentToken: pos.instrumentToken || pos.instrument_token || `NSE_${pos.symbol}`,
          exchange: pos.exchange || 'NSE', symbol: pos.symbol, side, quantity, price: priceNum,
          orderType: 'LIMIT', productType: pos.productType || pos.product_type || 'MIS',
        });
        if (data.success) {
          setActionMessage({ type: 'success', text: `Target LIMIT exit order placed for ${pos.symbol} @ ₹${priceNum.toFixed(2)} (${quantity} qty)` });
          fetchData();
        } else {
          setActionMessage({ type: 'error', text: `Target placement failed: ${data.error?.message}` });
        }
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Target order error: ${err.message}` });
    } finally {
      setIsSubmittingExit(false);
      setTargetModalPos(null);
      setIsTargetConfirmStep(false);
    }
  };

  const confirmCancelTargetOrder = async () => {
    if (!cancelTargetModalOrder) return;
    try {
      const orderId = cancelTargetModalOrder.orderId || cancelTargetModalOrder.order_id || cancelTargetModalOrder.id;
      const res = await fetch(`/api/v1/orders/${orderId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: `Target order for ${cancelTargetModalOrder.symbol} cancelled. Position remains open.` });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: `Failed to cancel target order: ${data.error?.message}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Error cancelling target order: ${err.message}` });
    } finally {
      setCancelTargetModalOrder(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ type: 'success', text: `Order ${orderId} cancelled.` });
        fetchData();
      } else {
        setActionMessage({ type: 'error', text: `Failed to cancel: ${data.error?.message}` });
      }
    } catch (_) {
      setActionMessage({ type: 'error', text: 'Failed to cancel order.' });
    }
  };

  const isTodayOrder = (o: any) => {
    if (!o.createdAt && !o.created_at) return true;
    const dt = new Date(o.createdAt || o.created_at);
    const today = new Date();
    return dt.getDate() === today.getDate() && dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredOrders = orders.filter(isTodayOrder).filter((o) => orderFilter === 'ALL' || o.status === orderFilter).filter((o) => !q || (o.symbol || '').toLowerCase().includes(q));

  // Positions tab shows OPEN, non-delivery positions only — a closed position
  // (netQty=0) is Trade History's job now (see .design/client-panel-redesign/
  // INFORMATION_ARCHITECTURE.md's Trade History note), and a CNC (delivery
  // equity) position is Holdings' job per the same doc's Naming Conventions
  // table ("Never call [CNC] Positions"). The backend keeps a CNC fill in
  // both `positions` and a separate `holdings` row — surfacing it here too
  // would show the same real position twice under two different tab names.
  const openPositions = positions.filter((p) => getNetQty(p) !== 0 && (p.productType || p.product_type) !== 'CNC');
  const filteredPositions = openPositions.filter((p) => !q || (p.symbol || '').toLowerCase().includes(q));
  const filteredClosedTrades = closedTrades.filter((ct) => !q || (ct.symbol || '').toLowerCase().includes(q));

  const totalUnrealizedPnl = openPositions.reduce((acc, p) => {
    const netQty = getNetQty(p);
    const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
    const ltp = getLiveLtp(p);
    return acc + (netQty > 0 ? (ltp - avgPrice) * netQty : Math.abs(netQty) * (avgPrice - ltp));
  }, 0);
  const totalRealizedPnl = positions.length > 0
    ? positions.reduce((acc, p) => acc + parseFloat(p.realizedPnl || p.realized_pnl || 0), 0)
    : closedTrades.reduce((acc, ct) => acc + (ct.netPnl || 0), 0);
  const totalPositionPnl = totalUnrealizedPnl + totalRealizedPnl;

  const positionColumns: DataTableColumn<any>[] = [
    {
      key: 'symbol', header: 'Instrument', mobilePrimary: true,
      render: (p) => (
        <div>
          <span className="font-bold text-sm">{p.symbol}</span>{' '}
          <Badge variant="neutral">{p.productType || p.product_type || 'MIS'}</Badge>
        </div>
      ),
    },
    { key: 'qty', header: 'Net Qty', align: 'right', render: (p) => { const n = getNetQty(p); return <span className={n > 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>{n > 0 ? `+${n}` : n}</span>; } },
    { key: 'avg', header: 'Avg Price', align: 'right', mobileHidden: true, render: (p) => `₹${parseFloat(p.averagePrice || p.average_price || 0).toFixed(2)}` },
    { key: 'ltp', header: 'Live LTP', align: 'right', render: (p) => `₹${getLiveLtp(p).toFixed(2)}` },
    {
      key: 'upnl', header: 'Unrealized P&L', align: 'right',
      render: (p) => {
        const netQty = getNetQty(p);
        const avgPrice = parseFloat(p.averagePrice || p.average_price || 0);
        const ltp = getLiveLtp(p);
        const upnl = netQty > 0 ? (ltp - avgPrice) * netQty : Math.abs(netQty) * (avgPrice - ltp);
        return <span className={`font-bold ${upnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>{upnl >= 0 ? '+' : ''}₹{upnl.toFixed(2)}</span>;
      },
    },
    {
      key: 'target', header: 'Target', align: 'center', mobileHidden: true,
      render: (p) => {
        const t = getActiveTargetOrder(p);
        return t ? <Badge variant="gain" dot>₹{parseFloat(t.price).toFixed(2)}</Badge> : <span className="text-[var(--text-tertiary)] text-[10px]">No Target</span>;
      },
    },
    {
      key: 'actions', header: 'Actions', align: 'right', mobileHidden: true,
      render: (p) => <PositionRowActions pos={p} activeTarget={getActiveTargetOrder(p)} onSetTarget={handleOpenSetTargetModal} onSquareOff={setSquareOffModalPos} onCancelTarget={setCancelTargetModalOrder} />,
    },
  ];

  const orderColumns: DataTableColumn<any>[] = [
    { key: 'time', header: 'Time', render: (o) => (o.createdAt || o.created_at ? new Date(o.createdAt || o.created_at).toLocaleTimeString() : 'Today') },
    {
      key: 'symbol', header: 'Symbol', mobilePrimary: true,
      render: (o) => (
        <div>
          <span className="font-bold">{o.symbol}</span>{' '}
          <Badge variant={o.side === 'BUY' ? 'gain' : 'loss'}>{o.side}</Badge>
        </div>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', render: (o) => o.quantity },
    { key: 'price', header: 'Price', align: 'right', render: (o) => `₹${parseFloat(o.price || 0).toFixed(2)}` },
    { key: 'type', header: 'Type', mobileHidden: true, render: (o) => <Badge variant="neutral">{o.orderType || o.order_type || 'MARKET'}</Badge> },
    {
      key: 'status', header: 'Status', align: 'center',
      render: (o) => {
        const variant = o.status === 'FILLED' ? 'gain' : o.status === 'REJECTED' ? 'loss' : o.status === 'CANCELLED' ? 'neutral' : 'warning';
        return <Badge variant={variant}>{o.status}</Badge>;
      },
    },
    {
      key: 'action', header: 'Action', align: 'right', mobileHidden: true,
      render: (o) => (['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(o.status) ? (
        <Button variant="destructive" size="sm" onClick={() => handleCancelOrder(o.id || o.order_id || o.orderId)}>Cancel</Button>
      ) : null),
    },
  ];

  const historyColumns: DataTableColumn<any>[] = [
    { key: 'time', header: 'Closed', mobileHidden: true, render: (ct) => (ct.closedAt ? new Date(ct.closedAt).toLocaleTimeString() : 'Today') },
    { key: 'symbol', header: 'Instrument', mobilePrimary: true, render: (ct) => <span className="font-bold text-sm">{ct.symbol}</span> },
    {
      key: 'direction', header: 'Direction', mobileHidden: true,
      render: (ct) => <span><span className={ct.entrySide === 'BUY' ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>{ct.entrySide}</span> → <span className={ct.exitSide === 'SELL' ? 'text-[var(--loss)]' : 'text-[var(--gain)]'}>{ct.exitSide}</span></span>,
    },
    { key: 'qty', header: 'Qty', align: 'right', mobileHidden: true, render: (ct) => ct.quantity },
    { key: 'entry', header: 'Entry', align: 'right', mobileHidden: true, render: (ct) => `₹${parseFloat(ct.entryPrice || 0).toFixed(2)}` },
    { key: 'exit', header: 'Exit', align: 'right', render: (ct) => `₹${parseFloat(ct.exitPrice || 0).toFixed(2)}` },
    {
      key: 'pnl', header: 'Realized P&L', align: 'right',
      render: (ct) => { const isProfit = (ct.netPnl || 0) >= 0; return <span className={`font-black ${isProfit ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>{isProfit ? '+' : ''}₹{parseFloat(ct.netPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>; },
    },
    {
      key: 'reason', header: 'Exit Reason', align: 'center',
      render: (ct) => {
        const variant = ct.exitReason === 'TARGET_LIMIT' ? 'info' : (ct.exitReason || '').includes('SQUARE_OFF') ? 'warning' : 'neutral';
        return <Badge variant={variant}>{ct.exitReason ? ct.exitReason.replace(/_/g, ' ') : 'SQUARE OFF'}</Badge>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-0 font-body text-[var(--text-main)]">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Portfolio P&L Today</span>
            <span className="w-2 h-2 rounded-full bg-[var(--gain)] animate-pulse" />
          </div>
          <div className="flex items-baseline gap-3 mt-1 font-mono">
            <span className={`text-2xl sm:text-3xl font-black ${pnlColorClass(totalPositionPnl)}`}>
              {formatPnl(totalPositionPnl)}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-bold">(Unrealized: ₹{totalUnrealizedPnl.toFixed(2)} | Realized: ₹{totalRealizedPnl.toFixed(2)})</span>
          </div>
        </div>
        {openPositions.length > 0 && (
          <Button variant="destructive" leftIcon={<ShieldAlert size={15} />} onClick={() => setIsExitAllModalOpen(true)}>
            EXIT ALL POSITIONS ({openPositions.length})
          </Button>
        )}
      </Card>

      {riskRestriction === 'REDUCE_ONLY' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-light)]">
          <ShieldAlert className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm text-[var(--warning)]">Account Restricted — Reduce-Only</div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Your account is currently <strong>restricted to reduce-only trading pending risk review</strong>. You can still close or reduce existing positions, but new or exposure-increasing orders will be rejected until a risk review clears this restriction.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PortfolioNav
          active={activeTab}
          counts={{ POSITIONS: openPositions.length, ORDERS: orders.filter(isTodayOrder).length, TRADE_HISTORY: closedTrades.length }}
        />
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search symbol..." className="pl-8 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl text-xs font-bold w-40" />
          </div>
          <Button variant="secondary" size="sm" leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />} onClick={fetchData}>Refresh</Button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-bold border flex items-center justify-between ${actionMessage.type === 'success' ? 'bg-[var(--gain-light)] text-[var(--gain)] border-[var(--gain)]/30' : 'bg-[var(--loss-light)] text-[var(--loss)] border-[var(--loss)]/30'}`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} aria-label="Dismiss message"><X className="w-4 h-4" /></button>
        </div>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="p-3">
          {activeTab === 'POSITIONS' && (
            <DataTable columns={positionColumns} rows={filteredPositions} rowKey={(p) => p.id || p.symbol}
              isLoading={loading && positions.length === 0}
              emptyIcon={<Zap className="w-5 h-5" />}
              emptyTitle={searchQuery ? 'No matching positions' : 'No open positions'}
              emptyMessage={searchQuery
                ? `Nothing open matches “${searchQuery}”. Clear the search to see all positions.`
                : 'Intraday and F&O positions you open will show up here with live P&L.'}
              emptyAction={searchQuery
                ? <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>Clear search</Button>
                : <Button size="sm" onClick={() => onOpenOptionChain?.()}>Browse Option Chain</Button>}
              renderMobileActions={(p) => <PositionRowActions pos={p} activeTarget={getActiveTargetOrder(p)} onSetTarget={handleOpenSetTargetModal} onSquareOff={setSquareOffModalPos} onCancelTarget={setCancelTargetModalOrder} compact />} />
          )}
          {activeTab === 'ORDERS' && (
            <DataTable columns={orderColumns} rows={filteredOrders} rowKey={(o) => o.id || o.order_id}
              isLoading={loading && orders.length === 0}
              emptyIcon={<Clock className="w-5 h-5" />}
              emptyTitle="No orders today"
              emptyMessage="Every order you place today — filled, pending or rejected — appears here."
              emptyAction={<Button size="sm" onClick={() => onOpenOptionChain?.()}>Place an order</Button>}
              renderMobileActions={(o) => (['ACCEPTED', 'PENDING', 'OPEN', 'TRIGGER_PENDING'].includes(o.status) ? <Button variant="destructive" size="sm" className="w-full" onClick={() => handleCancelOrder(o.id || o.order_id || o.orderId)}>Cancel Order</Button> : null)} />
          )}
          {activeTab === 'TRADE_HISTORY' && (
            <DataTable columns={historyColumns} rows={filteredClosedTrades} rowKey={(ct) => ct.id || ct.executionId}
              isLoading={loading && closedTrades.length === 0}
              emptyIcon={<History className="w-5 h-5" />}
              emptyTitle="No closed trades today"
              emptyMessage="Once a position is squared off, the settled trade and its realised P&L land here." />
          )}
        </div>
      </Card>

      <Dialog isOpen={!!squareOffModalPos} onClose={() => setSquareOffModalPos(null)} title={<span className="flex items-center gap-2"><AlertTriangle className="text-amber-500 w-4 h-4" />Square Off Position?</span>}
        footer={<><Button variant="secondary" disabled={isSubmittingExit} onClick={() => setSquareOffModalPos(null)}>Cancel</Button><Button variant="destructive" disabled={isSubmittingExit} onClick={confirmSquareOff}>{isSubmittingExit ? 'Submitting...' : 'Confirm Square Off'}</Button></>}>
        {squareOffModalPos && (() => {
          const pos = squareOffModalPos;
          const netQty = getNetQty(pos);
          const absQty = Math.abs(netQty);
          const liveLtp = getLiveLtp(pos);
          const exitSide = netQty > 0 ? 'SELL' : 'BUY';
          return (
            <div className="space-y-3 text-xs">
              <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] p-3 rounded-xl space-y-2">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Instrument:</span><span className="font-bold">{pos.symbol}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Quantity:</span><span className="font-bold text-[var(--gain)]">{absQty} Units ({exitSide})</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Current LTP:</span><span className="font-bold">₹{liveLtp.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2"><span className="text-[var(--text-muted)]">Estimated Exit Value:</span><span className="font-bold">₹{(liveLtp * absQty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
              </div>
              <div className="bg-[var(--warning-light)] border border-[var(--warning)]/30 p-3 rounded-xl text-[11px] text-[var(--warning)] leading-relaxed">
                You are about to exit this position using a MARKET order. The actual execution price will come from the exchange fill and may differ from the currently displayed LTP.
              </div>
            </div>
          );
        })()}
      </Dialog>

      <Dialog isOpen={!!targetModalPos} onClose={() => { setTargetModalPos(null); setIsTargetConfirmStep(false); }}
        title={<span className="flex items-center gap-2"><Target className="text-[var(--info)] w-4 h-4" />{isTargetConfirmStep ? 'Confirm Target Exit Order' : `Set Target — ${targetModalPos?.symbol || ''}`}</span>}
        footer={isTargetConfirmStep ? (
          <><Button variant="secondary" disabled={isSubmittingExit} onClick={() => setIsTargetConfirmStep(false)}>Back</Button><Button variant="primary" leftIcon={<Send size={14} />} disabled={isSubmittingExit} onClick={confirmPlaceTargetOrder}>{isSubmittingExit ? 'Placing...' : 'Place Target Order'}</Button></>
        ) : (
          <><Button variant="secondary" onClick={() => setTargetModalPos(null)}>Cancel</Button><Button variant="primary" onClick={handleProceedToTargetConfirm}>Proceed to Confirmation</Button></>
        )}>
        {targetModalPos && (() => {
          const pos = targetModalPos;
          const netQty = getNetQty(pos);
          const absQty = Math.abs(netQty);
          const liveLtp = getLiveLtp(pos);
          const avgPrice = parseFloat(pos.averagePrice || pos.average_price || liveLtp);
          const exitSide = netQty > 0 ? 'SELL' : 'BUY';
          const targetPriceNum = parseFloat(targetPrice || '0');
          const estTargetPnl = netQty > 0 ? (targetPriceNum - avgPrice) * absQty : (avgPrice - targetPriceNum) * absQty;
          if (!isTargetConfirmStep) {
            return (
              <div className="space-y-3 text-xs">
                <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Current LTP:</span><span className="font-bold">₹{liveLtp.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Average Entry Price:</span><span className="font-bold">₹{avgPrice.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Target Exit Side:</span><span className="font-black">{exitSide} LIMIT</span></div>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Target Exit Price (₹) <span className="text-[var(--text-muted)] font-normal">(0.05 tick size)</span></label>
                  <input type="number" step="0.05" value={targetPrice} onChange={(e) => { setTargetPrice(e.target.value); setTargetPriceError(null); }}
                    placeholder={netQty > 0 ? `Above ₹${liveLtp.toFixed(2)}` : `Below ₹${liveLtp.toFixed(2)}`}
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--primary)]" />
                  {targetPriceError && <p className="text-xs text-[var(--loss)] font-bold mt-1.5">{targetPriceError}</p>}
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-3 text-xs">
              <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Instrument:</span><span className="font-bold">{pos.symbol}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Action & Type:</span><span className="font-black text-[var(--gain)]">{exitSide} LIMIT</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Target Price:</span><span className="font-black">₹{targetPriceNum.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-[var(--border-color)] pt-2"><span className="text-[var(--text-muted)]">Estimated Target P&L:</span><span className={estTargetPnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>{estTargetPnl >= 0 ? '+' : ''}₹{estTargetPnl.toFixed(2)}</span></div>
              </div>
              <div className="bg-[var(--info-light)] border border-[var(--info)]/30 p-3 rounded-xl text-[11px] text-[var(--info)] leading-relaxed">
                Placing a target order will submit a real LIMIT exit order. Your position will automatically close when the target limit price is hit.
              </div>
            </div>
          );
        })()}
      </Dialog>

      <Dialog isOpen={!!cancelTargetModalOrder} onClose={() => setCancelTargetModalOrder(null)} title={<span className="flex items-center gap-2"><AlertTriangle className="text-[var(--loss)] w-4 h-4" />Cancel Target Order?</span>}
        footer={<><Button variant="secondary" onClick={() => setCancelTargetModalOrder(null)}>Keep Order</Button><Button variant="destructive" onClick={confirmCancelTargetOrder}>Cancel Target Order</Button></>}>
        {cancelTargetModalOrder && (
          <div className="space-y-3 text-xs">
            <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Instrument:</span><span className="font-bold">{cancelTargetModalOrder.symbol}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Target Price:</span><span className="font-bold">₹{parseFloat(cancelTargetModalOrder.price).toFixed(2)}</span></div>
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed">Cancelling the target order will remove the exit limit order from the order book. Your underlying position will remain OPEN.</p>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={isExitAllModalOpen} onClose={() => setIsExitAllModalOpen(false)} title={<span className="flex items-center gap-2"><ShieldAlert className="text-[var(--loss)] w-4 h-4" />Exit All Open Positions?</span>}
        footer={<><Button variant="secondary" disabled={isSubmittingExit} onClick={() => setIsExitAllModalOpen(false)}>Cancel</Button><Button variant="destructive" disabled={isSubmittingExit} onClick={confirmExitAllPositions}>{isSubmittingExit ? 'Exiting All...' : 'Confirm Exit All'}</Button></>}>
        <div className="space-y-3 text-xs">
          <div className="bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border-color)] space-y-2">
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Total Open Positions:</span><span className="font-bold">{openPositions.length}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Current Unrealized P&L:</span><span className={totalUnrealizedPnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}>{totalUnrealizedPnl >= 0 ? '+' : ''}₹{totalUnrealizedPnl.toFixed(2)}</span></div>
          </div>
          <div className="bg-[var(--loss-light)] border border-[var(--loss)]/30 p-3 rounded-xl text-[11px] text-[var(--loss)] leading-relaxed">
            This will send immediate MARKET square-off orders for all {openPositions.length} open positions. This action cannot be reversed.
          </div>
        </div>
      </Dialog>
    </div>
  );
};

function PositionRowActions({ pos, activeTarget, onSetTarget, onSquareOff, onCancelTarget, compact }: {
  pos: any; activeTarget: any; onSetTarget: (pos: any, target?: any) => void; onSquareOff: (pos: any) => void; onCancelTarget: (order: any) => void; compact?: boolean;
}) {
  const netQty = getNetQty(pos);
  if (netQty === 0) return null;
  return (
    <div className={`flex items-center gap-2 ${compact ? 'w-full' : 'justify-end'}`}>
      <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onSetTarget(pos, activeTarget); }}>
        <Target className="w-3.5 h-3.5" />{activeTarget ? 'Modify' : 'Target'}
      </Button>
      {activeTarget && (
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onCancelTarget(activeTarget); }} aria-label="Cancel target order">
          <X className="w-3.5 h-3.5 text-[var(--loss)]" />
        </Button>
      )}
      <Button variant="destructive" size="sm" className={compact ? 'flex-1' : ''} onClick={(e) => { e.stopPropagation(); onSquareOff(pos); }}>Square Off</Button>
    </div>
  );
}
