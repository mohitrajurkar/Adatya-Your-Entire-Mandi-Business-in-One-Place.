-- ============================================================================
-- V5: Add custom logo column to business_profile
-- ============================================================================

ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS logo_data text;
