-- =============================================================================
-- PATCH: Add address column for ai_reuse_hotels
-- Date: 2026-04-15
-- Purpose:
--   - Persist hotel address from crawl dataset
--   - Ensure backend APIs return full hotel address
-- Safe to rerun.
-- =============================================================================

BEGIN;

ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS address TEXT;

UPDATE ai_reuse_hotels
SET address = 'Chưa cập nhật'
WHERE address IS NULL OR BTRIM(address) = '';

ALTER TABLE IF EXISTS ai_reuse_hotels
  ALTER COLUMN address SET DEFAULT 'Chưa cập nhật',
  ALTER COLUMN address SET NOT NULL;

COMMIT;