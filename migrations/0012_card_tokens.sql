-- Migration 0012: saved cards on our checkout (docs/06 §3b, P6.3e).
-- payment_attempts.tokenize: the card entry asked the gateway for a reusable token (portal payer, tokenization enabled).
-- mock_provider_state.tokenize: the mock gateway returns a token once such a payment is paid.
ALTER TABLE payment_attempts ADD COLUMN tokenize INTEGER NOT NULL DEFAULT 0 CHECK (tokenize IN (0,1));
ALTER TABLE mock_provider_state ADD COLUMN tokenize INTEGER NOT NULL DEFAULT 0 CHECK (tokenize IN (0,1));
CREATE INDEX idx_saved_payment_methods_client ON saved_payment_methods(client_id, status);
