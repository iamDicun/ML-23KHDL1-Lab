-- ==============================================================================
-- ALL-IN-ONE PATCH FOR SUPABASE (OFFICIAL DASHBOARD)
-- Run this single file for schema alignment + new tables + seed data.
-- Safe to re-run.
-- ============================================================================== 

BEGIN;

-- 0) Validate core tables
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.business_types') IS NULL
     OR to_regclass('public.businesses') IS NULL
     OR to_regclass('public.registration_requests') IS NULL THEN
    RAISE EXCEPTION 'Missing core tables. Please run init_schema.sql first.';
  END IF;
END $$;

-- 1) Align existing core schema (ALTER TABLE)
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS businesses
    ADD COLUMN IF NOT EXISTS district VARCHAR(50);

ALTER TABLE IF EXISTS businesses
    ADD COLUMN IF NOT EXISTS province_city VARCHAR(100) NOT NULL DEFAULT 'TP. Ho Chi Minh';

ALTER TABLE IF EXISTS businesses
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';

ALTER TABLE IF EXISTS businesses
    ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);

ALTER TABLE IF EXISTS businesses
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS businesses
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS registration_requests
    ADD COLUMN IF NOT EXISTS official_note TEXT;

ALTER TABLE IF EXISTS registration_requests
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS registration_requests
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 1.1) New table: registration_request_ratings
CREATE TABLE IF NOT EXISTS registration_request_ratings (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
    citizen_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    satisfaction_level VARCHAR(20) NOT NULL CHECK (satisfaction_level IN ('very_satisfied', 'satisfied', 'not_satisfied')),
    note TEXT,
    rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2) Align registration_request_ratings (ALTER TABLE)
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

-- 2) New table: official_daily_tasks
CREATE TABLE IF NOT EXISTS official_daily_tasks (
    id SERIAL PRIMARY KEY,
    official_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
    due_date DATE NOT NULL,
    due_time TIME,
    source_type VARCHAR(50),
    source_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.1) Align official_daily_tasks (ALTER TABLE)
ALTER TABLE IF EXISTS official_daily_tasks
    ADD COLUMN IF NOT EXISTS task_description TEXT;

ALTER TABLE IF EXISTS official_daily_tasks
    ADD COLUMN IF NOT EXISTS due_time TIME;

ALTER TABLE IF EXISTS official_daily_tasks
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

ALTER TABLE IF EXISTS official_daily_tasks
    ADD COLUMN IF NOT EXISTS source_id INTEGER;

ALTER TABLE IF EXISTS official_daily_tasks
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS official_daily_tasks
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3) New table: official_documents
CREATE TABLE IF NOT EXISTS official_documents (
    id SERIAL PRIMARY KEY,
    category VARCHAR(20) NOT NULL CHECK (category IN ('cong_van', 'nghi_quyet', 'tin_tuc')),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    document_number VARCHAR(100),
    issued_by VARCHAR(255),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_from DATE,
    effective_to DATE,
    external_url TEXT,
    attachment_url TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.1) Align official_documents (ALTER TABLE)
ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS document_number VARCHAR(100);

ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS issued_by VARCHAR(255);

ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS external_url TEXT;

ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS official_documents
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_registration_requests_status
    ON registration_requests(status);

CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_level
    ON registration_request_ratings(satisfaction_level);

CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_rated_at
    ON registration_request_ratings(rated_at DESC);

CREATE INDEX IF NOT EXISTS idx_registration_request_ratings_request_id
    ON registration_request_ratings(request_id);

CREATE INDEX IF NOT EXISTS idx_official_daily_tasks_user_due_status
    ON official_daily_tasks(official_user_id, due_date, status);

CREATE INDEX IF NOT EXISTS idx_official_documents_category_published
    ON official_documents(category, published_at DESC);

-- 5) Trigger helper (safe for re-run)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registration_requests_set_updated_at ON registration_requests;
CREATE TRIGGER trg_registration_requests_set_updated_at
BEFORE UPDATE ON registration_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_registration_request_ratings_set_updated_at ON registration_request_ratings;
CREATE TRIGGER trg_registration_request_ratings_set_updated_at
BEFORE UPDATE ON registration_request_ratings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_official_daily_tasks_set_updated_at ON official_daily_tasks;
CREATE TRIGGER trg_official_daily_tasks_set_updated_at
BEFORE UPDATE ON official_daily_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_official_documents_set_updated_at ON official_documents;
CREATE TRIGGER trg_official_documents_set_updated_at
BEFORE UPDATE ON official_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 6) Seed registration requests
INSERT INTO registration_requests (citizen_id, request_type, data, status, official_note)
SELECT
    (SELECT id FROM users WHERE username = 'congdan01' LIMIT 1),
    (SELECT id FROM business_types WHERE name = 'Khach san' LIMIT 1),
    '{"name":"Khach san Anh Sao Mo Rong","address":"123 Nguyen Hue, Quan 1"}'::jsonb,
    'pending',
    NULL
WHERE NOT EXISTS (SELECT 1 FROM registration_requests)
  AND EXISTS (SELECT 1 FROM users WHERE username = 'congdan01')
  AND EXISTS (SELECT 1 FROM business_types WHERE name = 'Khach san');

INSERT INTO registration_requests (citizen_id, request_type, data, status, official_note)
SELECT
    (SELECT id FROM users WHERE username = 'congdan02' LIMIT 1),
    (SELECT id FROM business_types WHERE name = 'Nha hang' LIMIT 1),
    '{"name":"Nha hang Bien Goi 2","address":"89 Hai Ba Trung, Quan 1"}'::jsonb,
    'additional_info_required',
    'Can bo sung giay to PCCC va hinh anh mat bang.'
WHERE EXISTS (SELECT 1 FROM users WHERE username = 'congdan02')
  AND EXISTS (SELECT 1 FROM business_types WHERE name = 'Nha hang')
  AND NOT EXISTS (
      SELECT 1
      FROM registration_requests
      WHERE data->>'name' = 'Nha hang Bien Goi 2'
  );

INSERT INTO registration_requests (citizen_id, request_type, data, status, official_note)
SELECT
    (SELECT id FROM users WHERE username = 'congdan01' LIMIT 1),
    (SELECT id FROM business_types WHERE name = 'Khach san' LIMIT 1),
    '{"name":"Khach san Pho Co","address":"17 Le Loi, Quan 1"}'::jsonb,
    'approved',
    'Da du dieu kien cap phep.'
WHERE EXISTS (SELECT 1 FROM users WHERE username = 'congdan01')
  AND EXISTS (SELECT 1 FROM business_types WHERE name = 'Khach san')
  AND NOT EXISTS (
      SELECT 1
      FROM registration_requests
      WHERE data->>'name' = 'Khach san Pho Co'
  );

-- 6.1) Seed dossier ratings
INSERT INTO registration_request_ratings (request_id, citizen_id, satisfaction_level, note)
SELECT
    rr.id,
    rr.citizen_id,
    'not_satisfied',
    'Can bo can phan hoi nhanh hon cho ho so dang cho xu ly.'
FROM registration_requests rr
WHERE rr.data->>'name' = 'Khach san Anh Sao Mo Rong'
  AND NOT EXISTS (
      SELECT 1
      FROM registration_request_ratings r
      WHERE r.request_id = rr.id
  );

INSERT INTO registration_request_ratings (request_id, citizen_id, satisfaction_level, note)
SELECT
    rr.id,
    rr.citizen_id,
    'satisfied',
    'Da nhan huong dan bo sung ho so ro rang.'
FROM registration_requests rr
WHERE rr.data->>'name' = 'Nha hang Bien Goi 2'
  AND NOT EXISTS (
      SELECT 1
      FROM registration_request_ratings r
      WHERE r.request_id = rr.id
  );

INSERT INTO registration_request_ratings (request_id, citizen_id, satisfaction_level, note)
SELECT
    rr.id,
    rr.citizen_id,
    'very_satisfied',
    'Thoi gian xu ly nhanh va dung nhu lich hen.'
FROM registration_requests rr
WHERE rr.data->>'name' = 'Khach san Pho Co'
  AND NOT EXISTS (
      SELECT 1
      FROM registration_request_ratings r
      WHERE r.request_id = rr.id
  );

-- 7) Seed today tasks
INSERT INTO official_daily_tasks (
    official_user_id,
    task_title,
    task_description,
    priority,
    status,
    due_date,
    due_time,
    source_type,
    source_id
)
SELECT
    u.id,
    'Ra soat ho so cho xu ly',
    'Uu tien cac ho so dang cho xu ly va can bo sung trong ngay.',
    'high',
    'pending',
    CURRENT_DATE,
    '09:00',
    'registration_request',
    NULL
FROM users u
WHERE u.role = 'official'
  AND NOT EXISTS (SELECT 1 FROM official_daily_tasks)
LIMIT 1;

INSERT INTO official_daily_tasks (
    official_user_id,
    task_title,
    task_description,
    priority,
    status,
    due_date,
    due_time,
    source_type,
    source_id
)
SELECT
    u.id,
    'Cap nhat ket qua xu ly buoi chieu',
    'Tong hop ket qua xu ly de gui bao cao cuoi ngay.',
    'medium',
    'in_progress',
    CURRENT_DATE,
    '15:30',
    'manual',
    NULL
FROM users u
WHERE u.role = 'official'
  AND NOT EXISTS (
      SELECT 1 FROM official_daily_tasks t
      WHERE t.task_title = 'Cap nhat ket qua xu ly buoi chieu'
        AND t.due_date = CURRENT_DATE
  )
LIMIT 1;

-- 8) Seed official documents/news
INSERT INTO official_documents (
    category,
    title,
    summary,
    document_number,
    issued_by,
    published_at,
    is_pinned,
    external_url
)
SELECT
    'cong_van',
    'Cong van ve tang cuong kiem tra co so luu tru du lich',
    'Yeu cau can bo dia ban ra soat co so co nguy co cao va bao cao dinh ky hang tuan.',
    'CV-2026-118/VHTTDL',
    'Bo VHTTDL',
    NOW() - INTERVAL '2 days',
    TRUE,
    'https://example.gov.vn/cong-van-kiem-tra-co-so-luu-tru'
WHERE NOT EXISTS (
    SELECT 1 FROM official_documents WHERE document_number = 'CV-2026-118/VHTTDL'
);

INSERT INTO official_documents (
    category,
    title,
    summary,
    document_number,
    issued_by,
    published_at,
    is_pinned,
    external_url
)
SELECT
    'nghi_quyet',
    'Nghi quyet ve chuyen doi so trong quan ly co so kinh doanh VHTTDL',
    'Tap trung so hoa quy trinh tiep nhan va giam sat ho so trong nam 2026.',
    'NQ-2026-03',
    'Hoi dong nhan dan TP.HCM',
    NOW() - INTERVAL '10 days',
    FALSE,
    'https://example.gov.vn/nghi-quyet-chuyen-doi-so-vhttdl'
WHERE NOT EXISTS (
    SELECT 1 FROM official_documents WHERE document_number = 'NQ-2026-03'
);

INSERT INTO official_documents (
    category,
    title,
    summary,
    issued_by,
    published_at,
    is_pinned,
    external_url
)
SELECT
    'tin_tuc',
    'Ban tin noi bo: huong dan xu ly ho so truc tuyen quy II',
    'Cap nhat quy trinh, mau bieu va SLA moi cho cac ho so online.',
    'Trung tam Chuyen doi so VHTTDL',
    NOW() - INTERVAL '1 day',
    FALSE,
    'https://example.gov.vn/ban-tin-noi-bo-quy-2'
WHERE NOT EXISTS (
    SELECT 1 FROM official_documents WHERE title = 'Ban tin noi bo: huong dan xu ly ho so truc tuyen quy II'
);

COMMIT;
