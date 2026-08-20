import React, { useState } from 'react';
import {
  LayoutDashboard, Users, FileCheck, Activity, ShieldAlert, Power,
  Wifi, DollarSign, BookOpen, Server, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import { AdminDashboard } from './admin/AdminDashboard';
import { CustomerList } from './admin/CustomerList';
import { Customer360 } from './admin/Customer360';
import { KYCQueue } from './admin/KYCQueue';
import { OrderMonitor } from './admin/OrderMonitor';
import { RiskCommandCenter } from './admin/RiskCommandCenter';
import { KillSwitch } from './admin/KillSwitch';
import { BrokerHealth } from './admin/BrokerHealth';
import { FundsDashboard } from './admin/FundsDashboard';
import { LedgerViewer } from './admin/LedgerViewer';
import { SystemMonitor } from './admin/SystemMonitor';
import { AuditLogViewer } from './admin/AuditLogViewer';
import { MarketDataAdmin } from './admin/MarketDataAdmin';
import { LinkPeAdminManagement } from './admin/LinkPeAdminManagement';
import { PermissionsDashboard } from './admin/PermissionsDashboard';
import { SupportTicketsAdmin } from './admin/SupportTicketsAdmin';
import { QrCode as QrCodeIcon, ShieldCheck, Headset } from 'lucide-react';

interface AdminPanelProps {
  token: string;
}

type AdminPage =
  | 'DASHBOARD' | 'CUSTOMERS' | 'CUSTOMER_360' | 'PERMISSIONS' | 'KYC' | 'SUPPORT_TICKETS' | 'ORDERS'
  | 'RISK' | 'KILL_SWITCH' | 'BROKER' | 'FUNDS' | 'LINKPE_UPI' | 'LEDGER' | 'SYSTEM' | 'AUDIT' | 'MARKET_DATA';

interface NavItem {
  key: AdminPage;
  label: string;
  icon: React.ReactNode;
  section: string;
  badge?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ token }) => {
  const [activePage, setActivePage] = useState<AdminPage>('DASHBOARD');
  const [collapsed, setCollapsed] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const navItems: NavItem[] = [
    { key: 'DASHBOARD', label: 'Executive Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, section: 'OVERVIEW' },
    { key: 'CUSTOMERS', label: 'Customers', icon: <Users className="w-4 h-4" />, section: 'OPERATIONS' },
    { key: 'PERMISSIONS', label: 'Roles & Permissions', icon: <ShieldCheck className="w-4 h-4 text-blue-400" />, section: 'OPERATIONS', badge: 'RBAC' },
    { key: 'KYC', label: 'KYC Queue', icon: <FileCheck className="w-4 h-4" />, section: 'OPERATIONS' },
    { key: 'SUPPORT_TICKETS', label: 'Support Tickets', icon: <Headset className="w-4 h-4 text-amber-400" />, section: 'OPERATIONS', badge: 'Help' },
    { key: 'ORDERS', label: 'Order Monitor', icon: <Activity className="w-4 h-4" />, section: 'TRADING' },
    { key: 'RISK', label: 'Risk Command Center', icon: <ShieldAlert className="w-4 h-4" />, section: 'RISK' },
    { key: 'KILL_SWITCH', label: 'Kill Switch', icon: <Power className="w-4 h-4" />, section: 'RISK', badge: '⚠' },
    { key: 'BROKER', label: 'Broker Health', icon: <Wifi className="w-4 h-4" />, section: 'TECHNOLOGY' },
    { key: 'MARKET_DATA', label: 'API Keys & Storage', icon: <Server className="w-4 h-4" />, section: 'TECHNOLOGY' },
    { key: 'SYSTEM', label: 'System Monitor', icon: <Server className="w-4 h-4" />, section: 'TECHNOLOGY' },
    { key: 'FUNDS', label: 'Funds Overview', icon: <DollarSign className="w-4 h-4" />, section: 'FINANCE' },
    { key: 'LINKPE_UPI', label: 'LinkPe & UPI Settings', icon: <QrCodeIcon className="w-4 h-4 text-emerald-400" />, section: 'FINANCE' },
    { key: 'LEDGER', label: 'Ledger Viewer', icon: <BookOpen className="w-4 h-4" />, section: 'FINANCE' },
    { key: 'AUDIT', label: 'Audit Logs', icon: <FileText className="w-4 h-4" />, section: 'COMPLIANCE' },
  ];

  const sections = ['OVERVIEW', 'OPERATIONS', 'TRADING', 'RISK', 'TECHNOLOGY', 'FINANCE', 'COMPLIANCE'];

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    setActivePage('CUSTOMER_360');
  };

  const handleBackFromCustomer = () => {
    setSelectedCustomerId(null);
    setActivePage('CUSTOMERS');
  };

  const renderContent = () => {
    switch (activePage) {
      case 'DASHBOARD': return <AdminDashboard token={token} />;
      case 'CUSTOMERS': return <CustomerList token={token} onSelectCustomer={handleSelectCustomer} />;
      case 'CUSTOMER_360': return selectedCustomerId ? <Customer360 token={token} customerId={selectedCustomerId} onBack={handleBackFromCustomer} /> : null;
      case 'PERMISSIONS': return <PermissionsDashboard token={token} />;
      case 'KYC': return <KYCQueue token={token} />;
      case 'SUPPORT_TICKETS': return <SupportTicketsAdmin token={token} />;
      case 'ORDERS': return <OrderMonitor token={token} />;
      case 'RISK': return <RiskCommandCenter token={token} />;
      case 'KILL_SWITCH': return <KillSwitch token={token} />;
      case 'BROKER': return <BrokerHealth token={token} />;
      case 'MARKET_DATA': return <MarketDataAdmin token={token} />;
      case 'FUNDS': return <FundsDashboard token={token} />;
      case 'LINKPE_UPI': return <LinkPeAdminManagement token={token} />;
      case 'LEDGER': return <LedgerViewer token={token} />;
      case 'SYSTEM': return <SystemMonitor token={token} />;
      case 'AUDIT': return <AuditLogViewer token={token} />;
      default: return <AdminDashboard token={token} />;
    }
  };

  const currentLabel = navItems.find(n => n.key === activePage)?.label || 'Customer 360';

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#0a0f1e] overflow-hidden">
      
      {/* Mobile Top Navigation Pills Bar (< 768px) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto p-2 bg-[#0c1222] border-b border-slate-800 shrink-0">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setActivePage(item.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              activePage === item.key
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 bg-slate-800/40 border border-slate-700/30'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Desktop Sidebar Navigation (>= 768px) */}
      <div className={`hidden md:flex flex-col border-r border-slate-800 bg-[#0c1222] transition-all duration-300 ${collapsed ? 'w-14' : 'w-56'}`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          {!collapsed && (
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Admin Center
              </h2>
              <span className="text-[9px] text-slate-500">Brokerage Control Panel</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 text-slate-500 hover:text-white rounded hover:bg-slate-800">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto py-2">
          {sections.map(section => {
            const items = navItems.filter(n => n.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className="mb-1">
                {!collapsed && (
                  <span className="text-[9px] text-slate-600 uppercase font-bold tracking-wider px-3 block mb-1 mt-2">{section}</span>
                )}
                {items.map(item => (
                  <button key={item.key} onClick={() => setActivePage(item.key)}
                    title={item.label}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all ${
                      activePage === item.key
                        ? 'bg-emerald-900/30 text-emerald-400 border-r-2 border-emerald-500 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    } ${collapsed ? 'justify-center px-0' : ''}`}>
                    {item.icon}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge && <span className="ml-auto text-[10px]">{item.badge}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-800">
            <div className="text-[9px] text-slate-600">
              <span className="block">🔒 Core Trading Engine</span>
              <span className="block">Real Money: DISABLED</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b border-slate-800 bg-[#0c1222]">
          <div>
            <h1 className="text-xs md:text-sm font-bold text-white">{currentLabel}</h1>
            <span className="text-[9px] text-slate-500 hidden sm:inline">Admin Control Center — Brokerage Operations</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-5">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
