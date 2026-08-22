-- Migration 020: Allow ADMIN_SQUARE_OFF as a closed_trades exit_reason
-- The admin force-exit endpoint (POST /admin/positions/:id/square-off) has
-- always written exit_reason='ADMIN_SQUARE_OFF', but the check constraint
-- from migration 009 never included it, so every admin square-off attempt
-- against a position that gets recorded to closed_trades fails with
-- "violates check constraint closed_trades_exit_reason_check" and the
-- whole transaction (position + wallet settlement) rolls back.

ALTER TABLE closed_trades DROP CONSTRAINT IF EXISTS closed_trades_exit_reason_check;

ALTER TABLE closed_trades ADD CONSTRAINT closed_trades_exit_reason_check
  CHECK (exit_reason IN ('MARKET_SQUARE_OFF','TARGET_LIMIT','STOP_LOSS','MANUAL_EXIT','PARTIAL_EXIT','EXPIRY','SYSTEM_EXIT','ADMIN_SQUARE_OFF'));
