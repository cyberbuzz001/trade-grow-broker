# Admin Panel Upgrade — Task Checklist

Derived from `ADMIN_UPGRADE_BRIEF.md` §2 (revised priority order). Same cadence as the
client-panel redesign: one task at a time — read the real code first, build, deploy,
verify with Playwright against a throwaway account, clean up test data, check the task
off with a note on what was actually found, then report and wait.

Ordered by risk, not by visibility. Security and money integrity precede cosmetics.

## Phase A — Security (Critical)

- [ ] **A4a. Extend `checkPermission()` across the admin API.** 71 of 73 routes in `adminApi.ts` are guarded only by broad `checkRole()`. Map each route to a permission key (extending `permissionCatalog.ts` where a key doesn't exist), swap the guard, and keep each key's `defaultRoles` matched to today's effective access so nothing silently changes for existing staff. _Verify: a `SUPPORT_AGENT` test account is rejected from privileged routes it can currently reach; a granted per-user override in `manager_permissions` makes the same call succeed._
- [ ] **A4b. Privilege-escalation test pass.** Attempt cross-hierarchy access (Manager reaching another Admin's users), forged role claims, and direct API calls bypassing the UI. Confirm the server rejects each independently of the frontend.
- [ ] **A4c. Hierarchy enforcement.** Verify Admin → Manager → User scoping is enforced server-side on list/detail/mutate routes, not just filtered in the UI.

## Phase B — Financial integrity

- [ ] **B1. Money-path transaction audit.** Only 7 of 73 routes use `withTransaction`. Enumerate every route that moves money (`funds/requests`, `funds/direct-adjust`, wallet ops, withdrawal processing) and confirm each is atomic, status-guarded, and idempotent under retry. Deposit approval already passes — document it and fix the rest to match.
- [ ] **B2. Withdrawal workflow hardening.** Confirm the full state machine, no double-processing under concurrent approval, no negative balance, and a ledger entry + audit event per transition.
- [ ] **B3. Ledger-derived balances.** Verify `virtual_wallets` balances reconcile against `wallet_ledger`; add a reconciliation check where they can drift.

## Phase C — Performance

- [ ] **C1. Bound every unbounded query.** 6× `SELECT * FROM orders`, 3× `positions`, plus `wallet_ledger`/`risk_events`/`kyc_records`/`fund_requests`. Add server-side pagination + indexes; target the prompt's 1,000+ orders/positions bar.
- [ ] **C2. Server-side filtering and search** for the large tables (customers, orders, audit), replacing any client-side filtering of full result sets.

## Phase D — Design system migration

- [ ] **D1. Adopt `AppShell` + tokens in `AdminPanel.tsx`.** Replace the hardcoded `#0c1222`/slate shell so admin inherits the theme toggle and matches the client panel.
- [ ] **D2. Migrate the 18 raw `<table>`s to `DataTable`.** Gets mobile stacked-card fallback, loading skeletons and the new empty states for free across 9 files.
- [ ] **D3. Token conversion, highest-drift first:** Customer360 (207), CustomerList (176), FundsDashboard (143), PermissionsDashboard (110), OrderMonitor (105), then the remainder.
- [ ] **D4. `CustomerList.tsx` responsive rebuild** — 1208 lines with zero mobile handling, explicitly flagged in the client `DESIGN_BRIEF.md` as clipping with no fallback.
- [ ] **D5. Admin responsive audit** at 375/768/1024/1440 + touch targets + a11y, mirroring client Task 16.

## Phase E — Real-time

- [ ] **E1. Subscribe admin to the existing centralized market socket.** Reuse `useMarketSocket`; do not open a second connection. Live: orders, positions, LTP, P&L, exposure, deposit/withdrawal queues.

## Phase F — New capability (only what genuinely doesn't exist)

- [ ] **F1. Gap analysis vs. the original prompt's §5–§14** — confirm which of Admin Management, Manager Management, User Assignment, Finance Workspace queues, Support Chats and Ticketing are genuinely missing versus partially present, before building anything.
- [ ] **F2.** Build the confirmed-missing modules from F1, in the brief's own priority order.
- [ ] **F3. Global alert system** (§26) and **reporting/export** (§25).

## Phase G — Close-out

- [ ] **G1. Regression pass** — confirm trading, RMS, OMS, wallet and client panel are unaffected (brief §31).
- [ ] **G2. Required developer output** (original §34): architecture audit, problems found, changes made, migrations, API table, final permission matrix, test report, deployment requirements.
