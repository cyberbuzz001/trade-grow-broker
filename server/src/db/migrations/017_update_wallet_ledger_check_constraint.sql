-- Migration 017: Expand wallet_ledger transaction_type check constraint
-- Allows 'CREDIT','DEBIT','DEPOSIT','WITHDRAWAL','MARGIN_BLOCK','MARGIN_RELEASE','PNL_SETTLEMENT','ADMIN_ADJUSTMENT','CHARGE_DEBIT','BROKERAGE'

ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;

ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_transaction_type_check 
  CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'DEPOSIT', 'WITHDRAWAL', 'MARGIN_BLOCK', 'MARGIN_RELEASE', 'PNL_SETTLEMENT', 'ADMIN_ADJUSTMENT', 'CHARGE_DEBIT', 'BROKERAGE'));
