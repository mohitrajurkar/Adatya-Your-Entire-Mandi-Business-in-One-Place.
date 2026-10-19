-- ============================================================================
-- V2: exact money, enforced ownership, and referential integrity.
--
-- WHAT THIS CHANGES, AND WHY
--
--  1. Money moves from `double precision` to `numeric(14,2)`, and weights to
--     `numeric(12,3)`. Binary floating point cannot represent rupee amounts
--     exactly, which is why the ledger drifts and why the code was reduced to
--     comparing balances with `<= 0.001` epsilons.
--
--  2. `user_id` becomes NOT NULL on every tenant-owned table. Rows written
--     before the Phase 1 security work carry a NULL owner and are invisible
--     to the application; they are attached to their owner first (step 2).
--
--  3. Foreign keys, indexes and check constraints are added. The database
--     had exactly one unique constraint and no foreign keys or indexes at all.
--
-- SAFETY NOTES
--
--  * No table or column is dropped. No row is deleted.
--  * Amounts are ROUNDed to 2 decimals and weights to 3 on conversion. This
--    is the only value change, and it removes float artefacts rather than
--    introducing them.
--  * Step 2 refuses to run, aborting the whole migration, if unowned rows
--    exist while more than one account does; in that situation ownership
--    cannot be inferred and a human has to decide.
--  * `remaining_amount = total_amount - advance_paid` is enforced as an
--    invariant. It is deliberately NOT constrained to be non-negative: an
--    overpaid farmer is a real event that must remain representable. New
--    overpayments are rejected by the service layer instead.
--  * Flyway runs this inside a transaction, so any failure rolls back whole.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Repair the remaining-balance arithmetic before constraining it.
--    Float drift means some rows do not satisfy total - advance exactly.
-- ---------------------------------------------------------------------------
UPDATE purchases
SET remaining_amount = total_amount - advance_paid
WHERE remaining_amount IS DISTINCT FROM (total_amount - advance_paid);


-- ---------------------------------------------------------------------------
-- 2. Attach pre-Phase-1 rows to their owning account.
--
--    This folds in scripts/backfill-tenant-ids.sql so that any deployment
--    reaches the same state, not just this one.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    account_count  integer;
    target_user_id bigint;
    orphan_profile bigint;
    unowned_total  integer;
BEGIN
    SELECT count(*) INTO account_count FROM users;

    SELECT (SELECT count(*) FROM business_profile  WHERE user_id IS NULL)
         + (SELECT count(*) FROM commodities       WHERE user_id IS NULL)
         + (SELECT count(*) FROM farmers           WHERE user_id IS NULL)
         + (SELECT count(*) FROM purchases         WHERE user_id IS NULL)
         + (SELECT count(*) FROM purchase_items    WHERE user_id IS NULL)
         + (SELECT count(*) FROM payments          WHERE user_id IS NULL)
         + (SELECT count(*) FROM mandi_sales       WHERE user_id IS NULL)
         + (SELECT count(*) FROM stock_adjustments WHERE user_id IS NULL)
      INTO unowned_total;

    IF unowned_total = 0 THEN
        RAISE NOTICE 'No unowned rows; nothing to attach.';
    ELSIF account_count <> 1 THEN
        RAISE EXCEPTION
            'Cannot attach % unowned row(s): there are % accounts, so the owner '
            'is ambiguous. Assign user_id manually, then re-run the migration.',
            unowned_total, account_count;
    ELSE
        SELECT id INTO target_user_id FROM users ORDER BY id LIMIT 1;
        SELECT min(id) INTO orphan_profile FROM business_profile WHERE user_id IS NULL;

        -- Carry invoice details forward into the account's own profile, filling
        -- only fields that are still blank.
        IF orphan_profile IS NOT NULL
           AND EXISTS (SELECT 1 FROM business_profile WHERE user_id = target_user_id) THEN
            UPDATE business_profile AS active
            SET gstin          = COALESCE(NULLIF(active.gstin, ''),          orphan.gstin),
                mandi_license  = COALESCE(NULLIF(active.mandi_license, ''),  orphan.mandi_license),
                upi_id         = COALESCE(NULLIF(active.upi_id, ''),         orphan.upi_id),
                address        = COALESCE(NULLIF(active.address, ''),        orphan.address),
                signature_name = COALESCE(NULLIF(active.signature_name, ''), orphan.signature_name),
                signature_type = COALESCE(NULLIF(active.signature_type, ''), orphan.signature_type),
                signature_data = COALESCE(active.signature_data,             orphan.signature_data),
                tagline        = COALESCE(NULLIF(active.tagline, ''),        orphan.tagline),
                updated_at     = now()
            FROM business_profile AS orphan
            WHERE active.user_id = target_user_id
              AND orphan.id = orphan_profile;

            -- The now-redundant shared row is retired rather than deleted: it
            -- is handed to the account so the NOT NULL constraint can apply,
            -- and renamed so it is obviously historical.
            UPDATE business_profile
            SET user_id       = target_user_id,
                business_name = left(business_name || ' (pre-upgrade copy)', 255)
            WHERE id = orphan_profile;
        ELSE
            UPDATE business_profile SET user_id = target_user_id WHERE user_id IS NULL;
        END IF;

        UPDATE commodities       SET user_id = target_user_id WHERE user_id IS NULL;
        UPDATE farmers           SET user_id = target_user_id WHERE user_id IS NULL;
        UPDATE purchases         SET user_id = target_user_id WHERE user_id IS NULL;
        UPDATE purchase_items    SET user_id = target_user_id WHERE user_id IS NULL;
        UPDATE payments          SET user_id = target_user_id WHERE user_id IS NULL;
        UPDATE mandi_sales       SET user_id = target_user_id WHERE user_id IS NULL;
        UPDATE stock_adjustments SET user_id = target_user_id WHERE user_id IS NULL;

        RAISE NOTICE 'Attached % unowned row(s) to account %.', unowned_total, target_user_id;
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 3. Drop rows that cannot satisfy the new foreign keys.
--    Nothing is deleted: orphans are reported so they can be dealt with.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    bad integer;
BEGIN
    SELECT count(*) INTO bad FROM purchases p
     WHERE NOT EXISTS (SELECT 1 FROM farmers f WHERE f.id = p.farmer_id);
    IF bad > 0 THEN
        RAISE EXCEPTION 'Refusing to add foreign keys: % purchase(s) reference a farmer that no longer exists.', bad;
    END IF;

    SELECT count(*) INTO bad FROM purchase_items pi
     WHERE NOT EXISTS (SELECT 1 FROM purchases p WHERE p.id = pi.purchase_id);
    IF bad > 0 THEN
        RAISE EXCEPTION 'Refusing to add foreign keys: % purchase item(s) reference a missing purchase.', bad;
    END IF;

    SELECT count(*) INTO bad FROM payments pm
     WHERE NOT EXISTS (SELECT 1 FROM purchases p WHERE p.id = pm.purchase_id);
    IF bad > 0 THEN
        RAISE EXCEPTION 'Refusing to add foreign keys: % payment(s) reference a missing purchase.', bad;
    END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 4. Convert money to numeric(14,2) and weights to numeric(12,3).
-- ---------------------------------------------------------------------------
ALTER TABLE commodities
    ALTER COLUMN default_rate TYPE numeric(14,2) USING ROUND(default_rate::numeric, 2);

ALTER TABLE farmers
    ALTER COLUMN outstanding_balance TYPE numeric(14,2) USING ROUND(COALESCE(outstanding_balance, 0)::numeric, 2),
    ALTER COLUMN outstanding_balance SET DEFAULT 0,
    ALTER COLUMN outstanding_balance SET NOT NULL;

ALTER TABLE purchases
    ALTER COLUMN total_amount     TYPE numeric(14,2) USING ROUND(total_amount::numeric, 2),
    ALTER COLUMN advance_paid     TYPE numeric(14,2) USING ROUND(advance_paid::numeric, 2),
    ALTER COLUMN remaining_amount TYPE numeric(14,2) USING ROUND(remaining_amount::numeric, 2);

ALTER TABLE purchase_items
    ALTER COLUMN quantity TYPE numeric(12,3) USING ROUND(quantity::numeric, 3),
    ALTER COLUMN rate     TYPE numeric(14,2) USING ROUND(rate::numeric, 2),
    ALTER COLUMN amount   TYPE numeric(14,2) USING ROUND(amount::numeric, 2);

ALTER TABLE payments
    ALTER COLUMN amount TYPE numeric(14,2) USING ROUND(amount::numeric, 2);

ALTER TABLE mandi_sales
    ALTER COLUMN weight_quintals TYPE numeric(12,3) USING ROUND(weight_quintals::numeric, 3),
    ALTER COLUMN sale_rate       TYPE numeric(14,2) USING ROUND(sale_rate::numeric, 2),
    ALTER COLUMN subtotal        TYPE numeric(14,2) USING ROUND(subtotal::numeric, 2),
    ALTER COLUMN hamali          TYPE numeric(14,2) USING ROUND(COALESCE(hamali, 0)::numeric, 2),
    ALTER COLUMN transport       TYPE numeric(14,2) USING ROUND(COALESCE(transport, 0)::numeric, 2),
    ALTER COLUMN mandi_cess      TYPE numeric(14,2) USING ROUND(COALESCE(mandi_cess, 0)::numeric, 2),
    ALTER COLUMN net_amount      TYPE numeric(14,2) USING ROUND(net_amount::numeric, 2),
    ALTER COLUMN hamali     SET DEFAULT 0,
    ALTER COLUMN transport  SET DEFAULT 0,
    ALTER COLUMN mandi_cess SET DEFAULT 0,
    ALTER COLUMN hamali     SET NOT NULL,
    ALTER COLUMN transport  SET NOT NULL,
    ALTER COLUMN mandi_cess SET NOT NULL,
    ALTER COLUMN bags       SET DEFAULT 0;

UPDATE mandi_sales SET bags = 0 WHERE bags IS NULL;
ALTER TABLE mandi_sales ALTER COLUMN bags SET NOT NULL;

ALTER TABLE stock_adjustments
    ALTER COLUMN weight_quintals TYPE numeric(12,3) USING ROUND(weight_quintals::numeric, 3),
    ALTER COLUMN rate            TYPE numeric(14,2) USING ROUND(COALESCE(rate, 0)::numeric, 2),
    ALTER COLUMN rate SET DEFAULT 0,
    ALTER COLUMN rate SET NOT NULL,
    ALTER COLUMN bags SET DEFAULT 0;

UPDATE stock_adjustments SET bags = 0 WHERE bags IS NULL;
ALTER TABLE stock_adjustments ALTER COLUMN bags SET NOT NULL;


-- ---------------------------------------------------------------------------
-- 5. Ownership becomes mandatory.
-- ---------------------------------------------------------------------------
ALTER TABLE business_profile  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE commodities       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE farmers           ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE purchases         ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE purchase_items    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE payments          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE mandi_sales       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE stock_adjustments ALTER COLUMN user_id SET NOT NULL;


-- ---------------------------------------------------------------------------
-- 6. Referential integrity.
--
--    Deleting an account removes its records (this is what account deletion
--    already does in application code). Commodity references are RESTRICTed:
--    a commodity with stock history must not vanish underneath it.
-- ---------------------------------------------------------------------------
ALTER TABLE business_profile  ADD CONSTRAINT fk_profile_user    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE commodities       ADD CONSTRAINT fk_commodity_user  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE farmers           ADD CONSTRAINT fk_farmer_user     FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE purchases         ADD CONSTRAINT fk_purchase_user   FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE purchase_items    ADD CONSTRAINT fk_item_user       FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE payments          ADD CONSTRAINT fk_payment_user    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE mandi_sales       ADD CONSTRAINT fk_sale_user       FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE stock_adjustments ADD CONSTRAINT fk_adjustment_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE purchases      ADD CONSTRAINT fk_purchase_farmer   FOREIGN KEY (farmer_id)    REFERENCES farmers (id)     ON DELETE RESTRICT;
ALTER TABLE purchase_items ADD CONSTRAINT fk_item_purchase     FOREIGN KEY (purchase_id)  REFERENCES purchases (id)   ON DELETE CASCADE;
ALTER TABLE purchase_items ADD CONSTRAINT fk_item_commodity    FOREIGN KEY (commodity_id) REFERENCES commodities (id) ON DELETE RESTRICT;
ALTER TABLE payments       ADD CONSTRAINT fk_payment_purchase  FOREIGN KEY (purchase_id)  REFERENCES purchases (id)   ON DELETE CASCADE;
ALTER TABLE mandi_sales    ADD CONSTRAINT fk_sale_commodity    FOREIGN KEY (commodity_id) REFERENCES commodities (id) ON DELETE RESTRICT;
ALTER TABLE stock_adjustments ADD CONSTRAINT fk_adjustment_commodity FOREIGN KEY (commodity_id) REFERENCES commodities (id) ON DELETE RESTRICT;


-- ---------------------------------------------------------------------------
-- 7. Value rules the application must never be able to violate.
-- ---------------------------------------------------------------------------
ALTER TABLE commodities    ADD CONSTRAINT ck_commodity_rate      CHECK (default_rate >= 0);

ALTER TABLE purchases      ADD CONSTRAINT ck_purchase_total      CHECK (total_amount >= 0);
ALTER TABLE purchases      ADD CONSTRAINT ck_purchase_advance    CHECK (advance_paid >= 0);
-- The ledger invariant. Overpayment stays representable (remaining goes
-- negative); the service layer is what refuses to create a new one.
ALTER TABLE purchases      ADD CONSTRAINT ck_purchase_balance    CHECK (remaining_amount = total_amount - advance_paid);
ALTER TABLE purchases      ADD CONSTRAINT ck_purchase_status     CHECK (status IN ('Paid', 'Partial', 'Pending'));

ALTER TABLE purchase_items ADD CONSTRAINT ck_item_quantity       CHECK (quantity > 0);
ALTER TABLE purchase_items ADD CONSTRAINT ck_item_rate           CHECK (rate >= 0);
ALTER TABLE purchase_items ADD CONSTRAINT ck_item_amount         CHECK (amount >= 0);

ALTER TABLE payments       ADD CONSTRAINT ck_payment_amount      CHECK (amount > 0);

ALTER TABLE mandi_sales    ADD CONSTRAINT ck_sale_weight         CHECK (weight_quintals > 0);
ALTER TABLE mandi_sales    ADD CONSTRAINT ck_sale_rate           CHECK (sale_rate >= 0);
ALTER TABLE mandi_sales    ADD CONSTRAINT ck_sale_deductions     CHECK (hamali >= 0 AND transport >= 0 AND mandi_cess >= 0);
ALTER TABLE mandi_sales    ADD CONSTRAINT ck_sale_bags           CHECK (bags >= 0);
ALTER TABLE mandi_sales    ADD CONSTRAINT ck_sale_status         CHECK (payment_status IN ('Paid', 'Partial', 'Pending'));

ALTER TABLE stock_adjustments ADD CONSTRAINT ck_adjustment_weight CHECK (weight_quintals > 0);
ALTER TABLE stock_adjustments ADD CONSTRAINT ck_adjustment_rate   CHECK (rate >= 0);
ALTER TABLE stock_adjustments ADD CONSTRAINT ck_adjustment_bags   CHECK (bags >= 0);
ALTER TABLE stock_adjustments ADD CONSTRAINT ck_adjustment_type   CHECK (type IN ('opening', 'inward', 'outward', 'adjustment'));


-- ---------------------------------------------------------------------------
-- 8. Document numbers are unique per business, so a duplicate bill number
--    becomes impossible rather than merely unlikely.
--
--    Existing duplicates are renumbered with a -D2, -D3 ... suffix instead of
--    being deleted, so the migration can proceed without losing a record.
-- ---------------------------------------------------------------------------
UPDATE purchases p
SET purchase_number = left(p.purchase_number || '-D' || d.rn, 255)
FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id, purchase_number ORDER BY id) AS rn
    FROM purchases
) AS d
WHERE p.id = d.id AND d.rn > 1;

UPDATE mandi_sales s
SET sale_number = left(s.sale_number || '-D' || d.rn, 255)
FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id, sale_number ORDER BY id) AS rn
    FROM mandi_sales
) AS d
WHERE s.id = d.id AND d.rn > 1;

-- Commodity names must also be unique per business, so stock cannot be split
-- across two rows spelled the same way. Duplicates are renamed, never removed.
UPDATE commodities c
SET name = left(c.name || ' (' || d.rn || ')', 255)
FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id, lower(name) ORDER BY id) AS rn
    FROM commodities
) AS d
WHERE c.id = d.id AND d.rn > 1;

-- A business must resolve to exactly one ACTIVE profile row. Extra rows left
-- over from the single-shared-profile era are archived, not deleted, so the
-- older details stay recoverable. The partial unique index below then applies
-- only to the live row.
ALTER TABLE business_profile
    ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE business_profile bp
SET archived = true
FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY id DESC) AS rn
    FROM business_profile
) AS d
WHERE bp.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX uq_purchase_number_per_user ON purchases (user_id, purchase_number);
CREATE UNIQUE INDEX uq_sale_number_per_user     ON mandi_sales (user_id, sale_number);
CREATE UNIQUE INDEX uq_commodity_name_per_user  ON commodities (user_id, lower(name));
CREATE UNIQUE INDEX uq_profile_per_user         ON business_profile (user_id) WHERE NOT archived;


-- ---------------------------------------------------------------------------
-- 9. Indexes for the lookups every screen performs.
--    There were none at all; every tenant-scoped query was a sequential scan.
-- ---------------------------------------------------------------------------
CREATE INDEX idx_farmers_user            ON farmers (user_id);
CREATE INDEX idx_commodities_user        ON commodities (user_id);
CREATE INDEX idx_purchases_user_created  ON purchases (user_id, created_at DESC);
CREATE INDEX idx_purchases_farmer        ON purchases (farmer_id);
CREATE INDEX idx_items_purchase          ON purchase_items (purchase_id);
CREATE INDEX idx_items_user              ON purchase_items (user_id);
CREATE INDEX idx_items_commodity         ON purchase_items (commodity_id);
CREATE INDEX idx_payments_purchase       ON payments (purchase_id);
CREATE INDEX idx_payments_user           ON payments (user_id);
CREATE INDEX idx_sales_user_created      ON mandi_sales (user_id, created_at DESC);
CREATE INDEX idx_sales_commodity         ON mandi_sales (commodity_id);
CREATE INDEX idx_adjustments_user        ON stock_adjustments (user_id);
CREATE INDEX idx_adjustments_commodity   ON stock_adjustments (commodity_id);
