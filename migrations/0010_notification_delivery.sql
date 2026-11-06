-- Migration 0010: notification delivery (P4.16). Never edit after it has been applied; add a new migration.
-- in_app: 0 when the recipient turned the in-app channel off for this type (row kept so email can still go out).
-- email_state: none (no email wanted or not a staff user) → pending (waiting for the dispatcher) → queued (outbox job created)
--              or skipped (recipient inactive / no address by the time the dispatcher ran).
ALTER TABLE notifications ADD COLUMN in_app INTEGER NOT NULL DEFAULT 1 CHECK (in_app IN (0,1));
ALTER TABLE notifications ADD COLUMN email_state TEXT NOT NULL DEFAULT 'none' CHECK (email_state IN ('none','pending','queued','skipped'));
CREATE INDEX idx_notifications_email_pending ON notifications(created_at) WHERE email_state = 'pending';
