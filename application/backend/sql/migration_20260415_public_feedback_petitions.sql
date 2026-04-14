-- =============================================================================
-- PATCH: Public feedback & petition feature
-- Date: 2026-04-15
-- Purpose:
--   - Create table to store public feedback / petition submissions
--   - Add indexes and updated_at trigger
--   - Seed sample rows for lookup UI
-- Safe to rerun.
-- =============================================================================

BEGIN;

-- 0) Preconditions
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Missing users table. Please run previous schema scripts first.';
  END IF;
END $$;

-- 1) Table
CREATE TABLE IF NOT EXISTS public_feedback_petitions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  object_type VARCHAR(20) NOT NULL CHECK (object_type IN ('citizen', 'business', 'organization')),
  reporter_name VARCHAR(150) NOT NULL,
  organization_name VARCHAR(200),
  province VARCHAR(120),
  district VARCHAR(120),
  ward VARCHAR(120),
  address_detail VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  receiving_unit VARCHAR(255) NOT NULL,
  attachment_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'reviewing', 'resolved')),
  processing_note TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.1) Align columns for existing environments
ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS code VARCHAR(20);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS object_type VARCHAR(20);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS reporter_name VARCHAR(150);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS organization_name VARCHAR(200);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS province VARCHAR(120);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS district VARCHAR(120);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS ward VARCHAR(120);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS address_detail VARCHAR(255);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS email VARCHAR(150);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS title VARCHAR(255);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS receiving_unit VARCHAR(255);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'received';

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS processing_note TEXT;

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public_feedback_petitions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 1.2) Generate readable ticket code: PAKN-000001
CREATE SEQUENCE IF NOT EXISTS public_feedback_petitions_code_seq;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_feedback_petitions'
      AND column_name = 'code'
  ) THEN
    EXECUTE '
      ALTER TABLE public_feedback_petitions
      ALTER COLUMN code SET DEFAULT ''PAKN-'' || LPAD(nextval(''public_feedback_petitions_code_seq'')::TEXT, 6, ''0'')
    ';
  END IF;
END $$;

UPDATE public_feedback_petitions
SET code = 'PAKN-' || LPAD(id::TEXT, 6, '0')
WHERE (code IS NULL OR code = '');

-- 1.3) Ensure data constraints
ALTER TABLE public_feedback_petitions
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN object_type SET NOT NULL,
  ALTER COLUMN reporter_name SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN content SET NOT NULL,
  ALTER COLUMN receiving_unit SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'public_feedback_petitions_status_check'
      AND conrelid = 'public_feedback_petitions'::regclass
  ) THEN
    ALTER TABLE public_feedback_petitions
      ADD CONSTRAINT public_feedback_petitions_status_check
      CHECK (status IN ('received', 'reviewing', 'resolved'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'public_feedback_petitions_object_type_check'
      AND conrelid = 'public_feedback_petitions'::regclass
  ) THEN
    ALTER TABLE public_feedback_petitions
      ADD CONSTRAINT public_feedback_petitions_object_type_check
      CHECK (object_type IN ('citizen', 'business', 'organization'));
  END IF;
END $$;

-- 2) Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_feedback_petitions_code
  ON public_feedback_petitions(code);

CREATE INDEX IF NOT EXISTS idx_public_feedback_petitions_status
  ON public_feedback_petitions(status);

CREATE INDEX IF NOT EXISTS idx_public_feedback_petitions_received_at
  ON public_feedback_petitions(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_feedback_petitions_phone
  ON public_feedback_petitions(phone);

-- 3) Trigger helper and trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_feedback_petitions_set_updated_at ON public_feedback_petitions;
CREATE TRIGGER trg_public_feedback_petitions_set_updated_at
BEFORE UPDATE ON public_feedback_petitions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 4) Seed sample data (only when table is empty)
INSERT INTO public_feedback_petitions (
  code,
  object_type,
  reporter_name,
  phone,
  email,
  title,
  content,
  receiving_unit,
  status,
  received_at,
  reviewed_at,
  resolved_at,
  processing_note,
  province,
  district,
  ward,
  address_detail
)
SELECT
  'PAKN-000001',
  'citizen',
  'Bui Duong Duy Cuong',
  '0377737954',
  'cuong@example.com',
  'De nghi cap nhat tien do xu ly ho so',
  'Toi da nop ho so tren he thong, de nghi co quan cap nhat tien do xu ly de nguoi dan theo doi.',
  'Van phong tiep nhan va tra ket qua',
  'reviewing',
  NOW() - INTERVAL '2 day',
  NOW() - INTERVAL '1 day',
  NULL,
  'Can bo da tiep nhan va dang doi doi chieu bo sung.',
  'Ha Noi',
  'Ba Dinh',
  'Dien Bien',
  '12 Le Hong Phong'
WHERE NOT EXISTS (SELECT 1 FROM public_feedback_petitions WHERE code = 'PAKN-000001');

INSERT INTO public_feedback_petitions (
  code,
  object_type,
  reporter_name,
  phone,
  email,
  title,
  content,
  receiving_unit,
  status,
  received_at,
  reviewed_at,
  resolved_at,
  processing_note,
  province,
  district,
  ward,
  address_detail
)
SELECT
  'PAKN-000002',
  'business',
  'Cong ty Du lich Song Viet',
  '0908123456',
  'lienhe@songviet.vn',
  'Kien nghi bo sung huong dan thu tuc',
  'Doanh nghiep de nghi bo sung huong dan chi tiet cho nhom thu tuc cap phep bieu dien nghe thuat.',
  'Phong Quan ly Van hoa',
  'resolved',
  NOW() - INTERVAL '6 day',
  NOW() - INTERVAL '5 day',
  NOW() - INTERVAL '3 day',
  'Da phan hoi qua email va cap nhat tai muc thong tin thu tuc.',
  'Da Nang',
  'Hai Chau',
  'Thach Thang',
  '08 Bach Dang'
WHERE NOT EXISTS (SELECT 1 FROM public_feedback_petitions WHERE code = 'PAKN-000002');

INSERT INTO public_feedback_petitions (
  code,
  object_type,
  reporter_name,
  phone,
  email,
  title,
  content,
  receiving_unit,
  status,
  received_at,
  reviewed_at,
  resolved_at,
  processing_note,
  province,
  district,
  ward,
  address_detail
)
SELECT
  'PAKN-000003',
  'organization',
  'Trung tam Van hoa Quan 1',
  '02838234567',
  'vanthu@ttvhq1.vn',
  'Phan anh ve thoi gian tra ket qua',
  'De nghi thong nhat moc thoi gian tra ket qua va thong bao som khi co thay doi.',
  'Van phong tiep nhan va tra ket qua',
  'received',
  NOW() - INTERVAL '10 hour',
  NULL,
  NULL,
  NULL,
  'TP Ho Chi Minh',
  'Quan 1',
  'Ben Nghe',
  '16 Le Duan'
WHERE NOT EXISTS (SELECT 1 FROM public_feedback_petitions WHERE code = 'PAKN-000003');

SELECT setval(
  'public_feedback_petitions_code_seq',
  GREATEST(
    COALESCE((SELECT MAX(id) FROM public_feedback_petitions), 0),
    COALESCE((SELECT last_value FROM public_feedback_petitions_code_seq), 0)
  )
);

COMMIT;