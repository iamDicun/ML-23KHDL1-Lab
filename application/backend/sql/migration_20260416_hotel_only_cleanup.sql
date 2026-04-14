-- =============================================================================
-- PATCH: Hotel-only cleanup for backend data model
-- Date: 2026-04-16
-- Purpose:
--   - Keep only hotel/review real dataset tables for analytics
--   - Create hotel-scoped AI result tables
--   - Remove legacy business-domain tables and related mock alert data
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

-- 1) Hotel-level AI prediction snapshot
CREATE TABLE IF NOT EXISTS hotel_ai_predictions (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER UNIQUE NOT NULL REFERENCES ai_reuse_hotels(id) ON DELETE CASCADE,
  hygiene_score DOUBLE PRECISION CHECK (hygiene_score >= 0 AND hygiene_score <= 1.0),
  service_score DOUBLE PRECISION CHECK (service_score >= 0 AND service_score <= 1.0),
  facility_score DOUBLE PRECISION CHECK (facility_score >= 0 AND facility_score <= 1.0),
  friendliness_score DOUBLE PRECISION CHECK (friendliness_score >= 0 AND friendliness_score <= 1.0),
  sentiment_label VARCHAR(20) CHECK (sentiment_label IN ('Positive', 'Negative', 'Neutral')),
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_ai_predictions_last_evaluated_at
  ON hotel_ai_predictions(last_evaluated_at DESC);

DROP TRIGGER IF EXISTS trg_hotel_ai_predictions_set_updated_at ON hotel_ai_predictions;
CREATE TRIGGER trg_hotel_ai_predictions_set_updated_at
BEFORE UPDATE ON hotel_ai_predictions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 2) Hotel-level AI score history
CREATE TABLE IF NOT EXISTS hotel_ai_score_history (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL REFERENCES ai_reuse_hotels(id) ON DELETE CASCADE,
  score_type VARCHAR(50) NOT NULL CHECK (score_type IN ('hygiene', 'service', 'facility', 'friendliness')),
  score_value DOUBLE PRECISION NOT NULL CHECK (score_value >= 0 AND score_value <= 1.0),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_ai_score_history_hotel_type_time
  ON hotel_ai_score_history(hotel_id, score_type, evaluated_at DESC);

-- 3) Hotel-level insight summary
CREATE TABLE IF NOT EXISTS hotel_insights_summary (
  id SERIAL PRIMARY KEY,
  hotel_id INTEGER NOT NULL REFERENCES ai_reuse_hotels(id) ON DELETE CASCADE,
  attribute_affected VARCHAR(50) NOT NULL,
  top_negative_keywords TEXT[],
  representative_reviews TEXT NOT NULL,
  llm_drafted_document TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_insights_summary_hotel_generated
  ON hotel_insights_summary(hotel_id, generated_at DESC);

-- 4) Drop legacy business-domain analytics tables + data
DROP TABLE IF EXISTS business_insights_summary CASCADE;
DROP TABLE IF EXISTS ai_score_history CASCADE;
DROP TABLE IF EXISTS ai_predictions CASCADE;
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS business_documents CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

-- 5) Remove old mock alert records tied to removed business mock data
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM notifications
    WHERE title ILIKE 'Canh bao khan: Diem ve sinh rot nguong%'
       OR message ILIKE '%Khach san Anh Sao%';
  END IF;
END $$;

COMMIT;
