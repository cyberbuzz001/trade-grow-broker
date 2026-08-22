import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, History, Wallet, PieChart } from 'lucide-react';
import { Tabs } from './ui';

export type PortfolioSection = 'POSITIONS' | 'ORDERS' | 'TRADE_HISTORY' | 'HOLDINGS' | 'ANALYTICS';

const SECTION_PATHS: Record<PortfolioSection, string> = {
  POSITIONS: '/portfolio/positions',
  ORDERS: '/portfolio/orders',
  TRADE_HISTORY: '/portfolio/history',
  HOLDINGS: '/portfolio/holdings',
  ANALYTICS: '/portfolio/analytics',
};

interface PortfolioNavProps {
  active: PortfolioSection;
  counts?: Partial<Record<PortfolioSection, number>>;
}

/**
 * The one control that makes all 5 Portfolio tabs (Positions/Orders/History,
 * split across OrdersPositionsView, and Holdings/Analytics, split across
 * PortfolioHoldingsAnalyticsView) reachable from one another. Before this,
 * each component only rendered its own subset of tabs with no way to cross
 * from one component to the other except typing a URL directly — Holdings
 * and Analytics had no route at all on mobile. Route-driven (onChange
 * navigates), not local state, so the active tab always matches the URL.
 */
export function PortfolioNav({ active, counts }: PortfolioNavProps) {
  const navigate = useNavigate();
  return (
    <Tabs
      ariaLabel="Portfolio section"
      value={active}
      onChange={(v) => navigate(SECTION_PATHS[v as PortfolioSection])}
      items={[
        { value: 'POSITIONS', label: counts?.POSITIONS !== undefined ? `Positions (${counts.POSITIONS})` : 'Positions', icon: <Zap className="w-3.5 h-3.5" /> },
        { value: 'ORDERS', label: counts?.ORDERS !== undefined ? `Orders (${counts.ORDERS})` : 'Orders', icon: <Clock className="w-3.5 h-3.5" /> },
        { value: 'TRADE_HISTORY', label: counts?.TRADE_HISTORY !== undefined ? `History (${counts.TRADE_HISTORY})` : 'History', icon: <History className="w-3.5 h-3.5" /> },
        { value: 'HOLDINGS', label: counts?.HOLDINGS !== undefined ? `Holdings (${counts.HOLDINGS})` : 'Holdings', icon: <Wallet className="w-3.5 h-3.5" /> },
        { value: 'ANALYTICS', label: 'Analytics', icon: <PieChart className="w-3.5 h-3.5" /> },
      ]}
    />
  );
}
