-- =============================================================================
-- PATCH: Store hotels/reviews where all reviews were filtered out in step2
-- Date: 2026-04-15
-- Purpose:
--   - Keep a dedicated storage for selected hotels and their reviews
--   - Persist raw + preprocessed review text for AI reuse
--   - Do not store conf_mean/conf_min in DB
-- Safe to rerun.
-- =============================================================================

BEGIN;

-- 0) Trigger helper (shared in this project)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) Hotels table
CREATE TABLE IF NOT EXISTS ai_reuse_hotels (
  id SERIAL PRIMARY KEY,
  source_hotel_id BIGINT NOT NULL UNIQUE,
  hotel_name TEXT NOT NULL,
  total_reviews_in_output_results INTEGER NOT NULL CHECK (total_reviews_in_output_results >= 0),
  removed_reviews_in_step2 INTEGER NOT NULL CHECK (removed_reviews_in_step2 >= 0),
  kept_reviews_in_step2 INTEGER NOT NULL DEFAULT 0 CHECK (kept_reviews_in_step2 = 0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ai_reuse_hotels_counts
    CHECK (total_reviews_in_output_results >= removed_reviews_in_step2 + kept_reviews_in_step2)
);

-- 1.1) Align columns for existing environments
ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS source_hotel_id BIGINT;

ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS hotel_name TEXT;

ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS total_reviews_in_output_results INTEGER;

ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS removed_reviews_in_step2 INTEGER;

ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS kept_reviews_in_step2 INTEGER;

ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS ai_reuse_hotels
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 1.2) Ensure defaults / not null where possible
UPDATE ai_reuse_hotels
SET kept_reviews_in_step2 = 0
WHERE kept_reviews_in_step2 IS NULL;

ALTER TABLE ai_reuse_hotels
  ALTER COLUMN source_hotel_id SET NOT NULL,
  ALTER COLUMN hotel_name SET NOT NULL,
  ALTER COLUMN total_reviews_in_output_results SET NOT NULL,
  ALTER COLUMN removed_reviews_in_step2 SET NOT NULL,
  ALTER COLUMN kept_reviews_in_step2 SET DEFAULT 0,
  ALTER COLUMN kept_reviews_in_step2 SET NOT NULL;

-- 1.3) Constraints / indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_reuse_hotels_source_hotel_id
  ON ai_reuse_hotels(source_hotel_id);

CREATE INDEX IF NOT EXISTS idx_ai_reuse_hotels_imported_at
  ON ai_reuse_hotels(imported_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ai_reuse_hotels_counts'
      AND conrelid = 'ai_reuse_hotels'::regclass
  ) THEN
    ALTER TABLE ai_reuse_hotels
      ADD CONSTRAINT chk_ai_reuse_hotels_counts
      CHECK (total_reviews_in_output_results >= removed_reviews_in_step2 + kept_reviews_in_step2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_ai_reuse_hotels_kept_zero'
      AND conrelid = 'ai_reuse_hotels'::regclass
  ) THEN
    ALTER TABLE ai_reuse_hotels
      ADD CONSTRAINT chk_ai_reuse_hotels_kept_zero
      CHECK (kept_reviews_in_step2 = 0);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_ai_reuse_hotels_set_updated_at ON ai_reuse_hotels;
CREATE TRIGGER trg_ai_reuse_hotels_set_updated_at
BEFORE UPDATE ON ai_reuse_hotels
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 2) Reviews table
CREATE TABLE IF NOT EXISTS ai_reuse_reviews (
  id SERIAL PRIMARY KEY,
  source_review_id BIGINT NOT NULL UNIQUE,
  source_hotel_id BIGINT NOT NULL,
  hotel_name TEXT NOT NULL,
  rating DOUBLE PRECISION,
  review_text_raw TEXT NOT NULL,
  review_text_processed TEXT NOT NULL,
  preprocessing_version VARCHAR(100) NOT NULL DEFAULT 'run_process_hygiene_3class',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_ai_reuse_reviews_source_hotel
    FOREIGN KEY (source_hotel_id)
    REFERENCES ai_reuse_hotels(source_hotel_id)
    ON DELETE CASCADE
);

-- 2.1) Align columns for existing environments
ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS source_review_id BIGINT;

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS source_hotel_id BIGINT;

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS hotel_name TEXT;

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION;

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS review_text_raw TEXT;

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS review_text_processed TEXT;

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS preprocessing_version VARCHAR(100) NOT NULL DEFAULT 'run_process_hygiene_3class';

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS ai_reuse_reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2.2) Ensure defaults / not null where possible
UPDATE ai_reuse_reviews
SET preprocessing_version = 'run_process_hygiene_3class'
WHERE preprocessing_version IS NULL;

ALTER TABLE ai_reuse_reviews
  ALTER COLUMN source_review_id SET NOT NULL,
  ALTER COLUMN source_hotel_id SET NOT NULL,
  ALTER COLUMN hotel_name SET NOT NULL,
  ALTER COLUMN review_text_raw SET NOT NULL,
  ALTER COLUMN review_text_processed SET NOT NULL,
  ALTER COLUMN preprocessing_version SET DEFAULT 'run_process_hygiene_3class',
  ALTER COLUMN preprocessing_version SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_reuse_reviews_source_review_id
  ON ai_reuse_reviews(source_review_id);

CREATE INDEX IF NOT EXISTS idx_ai_reuse_reviews_source_hotel_id
  ON ai_reuse_reviews(source_hotel_id);

CREATE INDEX IF NOT EXISTS idx_ai_reuse_reviews_imported_at
  ON ai_reuse_reviews(imported_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_ai_reuse_reviews_source_hotel'
      AND conrelid = 'ai_reuse_reviews'::regclass
  ) THEN
    ALTER TABLE ai_reuse_reviews
      ADD CONSTRAINT fk_ai_reuse_reviews_source_hotel
      FOREIGN KEY (source_hotel_id)
      REFERENCES ai_reuse_hotels(source_hotel_id)
      ON DELETE CASCADE;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_ai_reuse_reviews_set_updated_at ON ai_reuse_reviews;
CREATE TRIGGER trg_ai_reuse_reviews_set_updated_at
BEFORE UPDATE ON ai_reuse_reviews
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;