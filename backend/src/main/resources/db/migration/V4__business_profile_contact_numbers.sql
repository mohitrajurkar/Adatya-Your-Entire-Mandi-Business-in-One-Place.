-- ============================================================================
-- V4: add the two contact-number columns to business_profile.
--
-- The BusinessProfile entity maps mobile1 and mobile2, but V1 never created
-- them. V1 was written as a baseline of a database that Hibernate had already
-- built, and these two columns were missed, so every existing deployment has
-- them while a database created purely from the migrations does not. The gap
-- only shows on a clean install, where Hibernate's schema validation refuses
-- to start:
--
--     Schema-validation: missing column [mobile1] in table [business_profile]
--
-- mobile1 is non-null in the entity, which is why it is backfilled to an empty
-- string before the constraint goes on: a profile that predates this migration
-- has no number to put there, and failing the deployment over a blank phone
-- number would be worse than an empty string the trader can fill in later.
--
-- Nothing is dropped and no row is deleted. On a database that already has
-- these columns, every statement below is a no-op.
-- ============================================================================

ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS mobile1 varchar(255);
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS mobile2 varchar(255);

UPDATE business_profile SET mobile1 = '' WHERE mobile1 IS NULL;

ALTER TABLE business_profile ALTER COLUMN mobile1 SET NOT NULL;
