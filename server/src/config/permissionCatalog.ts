// Relocated from routes/adminApi.ts unchanged, so it can be imported by
// middleware/auth.ts's checkPermission without a circular import (adminApi.ts
// already imports authenticateToken/checkRole from auth.ts).
export const SYSTEM_PERMISSION_CATEGORIES = [
  {
    category: 'Financial Operations',
    description: 'Wallet credits, withdrawals, direct balance adjustments & reserve management',
    permissions: [
      { key: 'DEPOSITS_APPROVE', label: 'Approve Deposits', description: 'Review and approve client UPI, Bank, and Gateway deposit receipts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER'] },
      { key: 'WITHDRAWALS_APPROVE', label: 'Approve Withdrawals', description: 'Authorize client withdrawal payout and bank settlement transfers', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'MANAGER'] },
      { key: 'DIRECT_BALANCE_ADJUST', label: 'Direct Balance Adjustment', description: 'Manually credit or debit user trading capital with audited ledger entry', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
      { key: 'PAYMENT_GATEWAYS_MANAGE', label: 'Manage Payment Gateways', description: 'Configure LinkPe merchant keys, QR codes, and bank accounts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
      { key: 'RESERVES_RECONCILE', label: 'Reserve & Solvency Audit', description: 'Audit broker physical bank cash reserves vs user aggregate liabilities', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'] },
    ]
  },
  {
    category: 'Trading & Risk Oversight',
    description: 'Order execution, kill-switches, margin limits, and emergency square-offs',
    permissions: [
      { key: 'SIM_ORDER_CANCEL', label: 'Force-Cancel Orders', description: 'Cancel pending and executing simulated equity & derivative orders', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER'] },
      { key: 'POSITIONS_FORCE_CLOSE', label: 'Force-Liquidate Positions', description: 'Emergency market square-off open positions for margin calls', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'RISK_LIMITS_EDIT', label: 'Configure Risk Parameters', description: 'Modify margin multipliers, intraday leverage, and MTM loss limits', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'KILL_SWITCH_TRIGGER', label: 'Platform Kill Switch', description: 'Halt all order placements and market execution platform-wide', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
      { key: 'RMS_VIEW', label: 'View RMS Settings & Risk Tiers', description: 'View current RMS mode, auto square-off configuration, and loss-tier thresholds', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'READ_ONLY_AUDITOR'] },
      { key: 'RMS_SQUAREOFF_RUN', label: 'Manually Trigger RMS Square-Off Run', description: 'Manually invoke the MIS auto square-off engine outside its scheduled run', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER'] },
    ]
  },
  {
    category: 'Operations & User Management',
    description: 'Account creation, customer status freezes, KYC approvals, and credentials',
    permissions: [
      { key: 'KYC_VERIFY_APPROVE', label: 'Approve KYC Applications', description: 'Verify Aadhaar, PAN, and bank details for trading accounts', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER', 'MANAGER'] },
      { key: 'KYC_REJECT', label: 'Reject / Request KYC Re-upload', description: 'Reject incomplete documents and trigger customer re-upload requests', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER'] },
      { key: 'USER_CREATE', label: 'Create New Customer', description: 'Manually provision new client profile and initial simulated capital', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
      { key: 'USER_LOCK_UNLOCK', label: 'Lock / Freeze Accounts', description: 'Temporarily freeze customer accounts to prevent logins and trading', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'RISK_MANAGER', 'MANAGER'] },
      { key: 'USER_RESET_PASSWORD', label: 'Issue Password Resets', description: 'Generate one-time reset credentials for user account recovery', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    ]
  },
  {
    category: 'Audit, Feeds & System Security',
    description: 'Compliance audit trail, PII visibility, exchange feed credentials, and staff RBAC',
    permissions: [
      { key: 'VIEW_AUDIT_LOGS', label: 'View Immutable Audit Trail', description: 'Inspect timestamped actor logs for all admin and financial actions', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE_MANAGER', 'READ_ONLY_AUDITOR'] },
      { key: 'VIEW_PII', label: 'View Unmasked PII', description: 'Access unmasked client phone numbers, emails, and KYC documentation', defaultRoles: ['SUPER_ADMIN', 'ADMIN', 'KYC_OFFICER'] },
      { key: 'MARKET_DATA_CONFIG', label: 'Market Data & Feeds Config', description: 'Configure Angel One / Dhan API keys and market data download storage', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
      { key: 'MANAGE_ROLES_PERMISSIONS', label: 'Manage Roles & Permissions', description: 'Assign staff roles and configure user granular permission overrides', defaultRoles: ['SUPER_ADMIN', 'ADMIN'] },
    ]
  }
];

export interface PermissionCatalogEntry {
  key: string;
  label: string;
  description: string;
  defaultRoles: string[];
}

const permissionByKey = new Map<string, PermissionCatalogEntry>();
for (const cat of SYSTEM_PERMISSION_CATEGORIES) {
  for (const perm of cat.permissions) {
    permissionByKey.set(perm.key, perm);
  }
}

export function getPermissionCatalogEntry(key: string): PermissionCatalogEntry | undefined {
  return permissionByKey.get(key);
}
