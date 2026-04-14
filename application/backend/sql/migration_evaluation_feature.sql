-- =============================================================================
-- PATCH: Online evaluation feature (separate migration)
-- Purpose:
--   1) Create table to store rating per registration request
--   2) Add indexes + updated_at trigger
--   3) Seed mock ratings from existing registration requests
-- Safe to rerun.
-- =============================================================================

BEGIN;

-- 0) Validate required core tables
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.registration_requests') IS NULL THEN
    RAISE EXCEPTION 'Missing core tables. Please run old schema scripts first.';
  END IF;
END $$;

-- 1) Create table if it does not exist
CREATE TABLE IF NOT EXISTS registration_request_ratings (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
  citizen_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  satisfaction_level VARCHAR(20) NOT NULL CHECK (satisfaction_level IN ('very_satisfied', 'satisfied', 'not_satisfied')),
  note TEXT,
  rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.1) Align columns in case the table already exists with old shape
ALTER TABLE IF EXISTS registration_request_ratings
  ADD COLUMN IF NOT EXISTS citizen_id INTEGER;

ALTER TABLE IF EXISTS registration_request_ratings
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE IF EXISTS registration_request_ratings
  ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS registration_request_ratings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS registration_request_ratings
  DROP CONSTRAINT IF EXISTS registration_request_ratings_request_id_key;

-- 1.2) Ensure constraints exist (safe for rerun)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'registration_request_ratings_request_id_fkey'
      AND conrelid = 'registration_request_ratings'::regclass
  ) THEN
    ALTER TABLE registration_request_ratings
      ADD CONSTRAINT registration_request_ratings_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES registration_requests(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'registration_request_ratings_citizen_id_fkey'
      AND conrelid = 'registration_request_ratings'::regclass
  ) THEN
    ALTER TABLE registration_request_ratings
      ADD CONSTRAINT registration_request_ratings_citizen_id_fkey
      FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_level
  ON registration_request_ratings(satisfaction_level);

CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_rated_at
  ON registration_request_ratings(rated_at DESC);

CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_citizen
  ON registration_request_ratings(citizen_id);

CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_request_id
  ON registration_request_ratings(request_id);

-- 3) Trigger helper and trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_request_ratings_set_updated_at ON registration_request_ratings;
CREATE TRIGGER trg_registration_request_ratings_set_updated_at
BEFORE UPDATE ON registration_request_ratings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 4) Seed mock ratings from existing dossiers (only for dossiers without ratings)
INSERT INTO registration_request_ratings (request_id, citizen_id, satisfaction_level, note)
SELECT
  rr.id,
  rr.citizen_id,
  CASE
    WHEN rr.status = 'approved' THEN 'very_satisfied'
    WHEN rr.status = 'additional_info_required' THEN 'satisfied'
    ELSE 'not_satisfied'
  END AS satisfaction_level,
  CASE
    WHEN rr.status = 'approved' THEN 'Ho so duoc giai quyet nhanh, toi hai long.'
    WHEN rr.status = 'additional_info_required' THEN 'Can bo huong dan bo sung giay to ro rang.'
    WHEN rr.status = 'rejected' THEN 'Can mo ta ro hon ly do tu choi de toi bo sung.'
    ELSE 'Ho so dang cho xu ly, mong cap nhat tien do som.'
  END AS note
FROM registration_requests rr
WHERE NOT EXISTS (
  SELECT 1
  FROM registration_request_ratings r
  WHERE r.request_id = rr.id
)
ORDER BY rr.created_at ASC
LIMIT 30;

COMMIT;
