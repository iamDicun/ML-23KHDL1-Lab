-- =============================================================================
-- PATCH: Evaluation history mode fix
-- Date: 2026-04-15
-- Purpose:
--   - Remove unique-per-request constraint so one dossier can have many ratings
--   - Keep existing data intact
--   - Add non-unique index for request_id lookups
-- =============================================================================

BEGIN;

-- 0) Preconditions
DO $$
BEGIN
  IF to_regclass('public.registration_request_ratings') IS NULL THEN
    RAISE EXCEPTION 'Table registration_request_ratings not found. Run previous evaluation migration first.';
  END IF;
END $$;

-- 1) Drop old unique constraint on request_id if it exists
ALTER TABLE IF EXISTS registration_request_ratings
  DROP CONSTRAINT IF EXISTS registration_request_ratings_request_id_key;

-- 2) In some environments a unique index may exist without the default constraint name
DO $$
DECLARE
  idx_name TEXT;
BEGIN
  SELECT i.relname INTO idx_name
  FROM pg_class t
  JOIN pg_index x ON t.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'registration_request_ratings'
    AND x.indisunique = TRUE
    AND pg_get_indexdef(i.oid) ILIKE '%(request_id)%'
  LIMIT 1;

  IF idx_name IS NOT NULL THEN
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx_name);
  END IF;
END $$;

-- 3) Add non-unique index for query performance
CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_request_id
  ON registration_request_ratings(request_id);

COMMIT;
