-- Migration 0011: mock gateway simulation state (docs/06 §6, P6.1). Development and staging only; the table stays empty in production.
-- merchant_reference: our attempt reference; paid_minor: amount "paid" (half for a partial outcome);
-- scripted/settle_at: the status an express test number reaches and when; otp holds the pending OTP reference.
ALTER TABLE mock_provider_state ADD COLUMN merchant_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE mock_provider_state ADD COLUMN paid_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mock_provider_state ADD COLUMN scripted TEXT;
ALTER TABLE mock_provider_state ADD COLUMN settle_at TEXT;
