-- ============================================================================
-- Adatya: one-off backfill of tenant ownership (user_id) after Phase 1
--
-- WHY THIS IS NEEDED
-- Before Phase 1 the backend resolved the tenant from a request header and,
-- when none was sent, fell back to the super-admin account. The frontend never
-- sent that header, so rows were written with user_id = NULL: the business
-- profile and the seeded commodity list in particular. Now that every query is
-- scoped to the authenticated account, those NULL-owner rows are invisible to
-- the application. The data is not lost, just unreachable.
--
-- WHAT THIS SCRIPT DOES
--   1. Copies the invoice details (GSTIN, mandi licence, UPI, signature,
--      address, tagline) from the old shared profile row into the profile that
--      now belongs to the account -- only where the new row is still blank.
--   2. Assigns every remaining NULL-owner row to that account.
--
-- It performs NO deletes and NO drops. It runs inside one transaction.
-- Re-running it is safe: the second run matches nothing.
--
-- IMPORTANT PRECONDITION
-- This is only correct while the database has exactly ONE account. With more
-- than one account there is no way to know which trader an unowned row belongs
-- to, so the script refuses to run rather than guess.
--
-- RECOMMENDED: take a dump first
--   docker exec adatya-database pg_dump -U <user> <db> | gzip > pre_backfill.sql.gz
-- ============================================================================

BEGIN;

DO $$
DECLARE
    account_count  integer;
    target_user_id bigint;
    orphan_profile bigint;
BEGIN
    SELECT count(*) INTO account_count FROM users;

    IF account_count <> 1 THEN
        RAISE EXCEPTION
            'Refusing to backfill: expected exactly 1 account, found %. '
            'Unowned rows cannot be attributed to a tenant automatically.',
            account_count;
    END IF;

    SELECT id INTO target_user_id FROM users ORDER BY id LIMIT 1;

    -- The pre-upgrade shared profile row, if one is still unowned.
    SELECT min(id) INTO orphan_profile
    FROM business_profile
    WHERE user_id IS NULL;

    -- 1. Carry the invoice details forward into the account's own profile.
    --    Only fills fields that are currently empty, so anything already
    --    entered since the upgrade wins.
    IF orphan_profile IS NOT NULL THEN
        UPDATE business_profile AS active
        SET gstin          = COALESCE(NULLIF(active.gstin, ''),          orphan.gstin),
            mandi_license  = COALESCE(NULLIF(active.mandi_license, ''),  orphan.mandi_license),
            upi_id         = COALESCE(NULLIF(active.upi_id, ''),         orphan.upi_id),
            address        = COALESCE(NULLIF(active.address, ''),        orphan.address),
            mobile2        = COALESCE(NULLIF(active.mobile2, ''),        orphan.mobile2),
            signature_name = COALESCE(NULLIF(active.signature_name, ''), orphan.signature_name),
            signature_type = COALESCE(NULLIF(active.signature_type, ''), orphan.signature_type),
            signature_data = COALESCE(active.signature_data,             orphan.signature_data),
            tagline        = COALESCE(NULLIF(active.tagline, ''),        orphan.tagline),
            updated_at     = now()
        FROM business_profile AS orphan
        WHERE active.user_id = target_user_id
          AND orphan.id = orphan_profile;

        RAISE NOTICE 'Invoice details carried forward from profile row %.', orphan_profile;
    END IF;

    -- If the account has no profile row at all, adopt the orphan directly.
    IF NOT EXISTS (SELECT 1 FROM business_profile WHERE user_id = target_user_id)
       AND orphan_profile IS NOT NULL THEN
        UPDATE business_profile SET user_id = target_user_id WHERE id = orphan_profile;
        RAISE NOTICE 'Adopted profile row % for account %.', orphan_profile, target_user_id;
    END IF;

    -- 2. Attach the remaining unowned rows to the account.
    UPDATE commodities       SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE farmers           SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE purchases         SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE purchase_items    SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE payments          SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE mandi_sales       SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE stock_adjustments SET user_id = target_user_id WHERE user_id IS NULL;

    RAISE NOTICE 'Backfill complete for account %.', target_user_id;
END $$;

-- What the application will see afterwards.
SELECT 'business_profile' AS table_name, user_id, count(*) AS rows
  FROM business_profile GROUP BY user_id
UNION ALL SELECT 'commodities',       user_id, count(*) FROM commodities       GROUP BY user_id
UNION ALL SELECT 'farmers',           user_id, count(*) FROM farmers           GROUP BY user_id
UNION ALL SELECT 'purchases',         user_id, count(*) FROM purchases         GROUP BY user_id
UNION ALL SELECT 'purchase_items',    user_id, count(*) FROM purchase_items    GROUP BY user_id
UNION ALL SELECT 'payments',          user_id, count(*) FROM payments          GROUP BY user_id
UNION ALL SELECT 'mandi_sales',       user_id, count(*) FROM mandi_sales       GROUP BY user_id
UNION ALL SELECT 'stock_adjustments', user_id, count(*) FROM stock_adjustments GROUP BY user_id
ORDER BY table_name, user_id NULLS FIRST;

COMMIT;
