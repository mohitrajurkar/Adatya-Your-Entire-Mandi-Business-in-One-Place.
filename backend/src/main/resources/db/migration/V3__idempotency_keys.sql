-- ============================================================================
-- V3: idempotency keys for the three endpoints that move money.
--
-- WHY
-- A trader on a patchy mandi connection taps "Save" and sees nothing happen,
-- so they tap again. The request may already have reached the server. Today
-- a repeated purchase is caught only because bill numbers are unique, and a
-- repeated payment only by a 60-second same-amount heuristic in the service
-- layer. Neither covers a server-generated bill number or two genuinely
-- identical payments a trader really did make minutes apart.
--
-- A client-supplied request id closes that gap exactly: the client generates
-- one id per form submission and reuses it on retry, so the server can tell a
-- retry from a new transaction instead of guessing.
--
-- WHAT THIS DOES
--   Adds one nullable column to three tables, and a partial unique index on
--   (user_id, client_request_id) that applies only where the id is present.
--
-- SAFETY
--   Purely additive. No existing column, row or value is touched. Adding a
--   nullable column with no default is a catalogue-only change in PostgreSQL
--   11+, so it does not rewrite the tables. Rows written before this applies
--   simply have NULL and are ignored by the partial index.
--
--   To reverse it:
--     DROP INDEX uq_purchase_request_per_user, uq_payment_request_per_user,
--                uq_sale_request_per_user;
--     ALTER TABLE purchases   DROP COLUMN client_request_id;
--     ALTER TABLE payments    DROP COLUMN client_request_id;
--     ALTER TABLE mandi_sales DROP COLUMN client_request_id;
-- ============================================================================

ALTER TABLE purchases   ADD COLUMN IF NOT EXISTS client_request_id varchar(100);
ALTER TABLE payments    ADD COLUMN IF NOT EXISTS client_request_id varchar(100);
ALTER TABLE mandi_sales ADD COLUMN IF NOT EXISTS client_request_id varchar(100);

COMMENT ON COLUMN purchases.client_request_id IS
    'Idempotency key supplied by the client for one form submission. Repeating it returns the original record instead of creating a second one.';
COMMENT ON COLUMN payments.client_request_id IS
    'Idempotency key supplied by the client for one form submission.';
COMMENT ON COLUMN mandi_sales.client_request_id IS
    'Idempotency key supplied by the client for one form submission.';

-- Unique only among rows that actually carry a key, and only within one
-- business, so two traders can never collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_request_per_user
    ON purchases (user_id, client_request_id)
    WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_request_per_user
    ON payments (user_id, client_request_id)
    WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_request_per_user
    ON mandi_sales (user_id, client_request_id)
    WHERE client_request_id IS NOT NULL;
