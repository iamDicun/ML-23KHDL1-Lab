-- ==============================================================================
-- PROJECT: He thong quan ly va danh gia co so kinh doanh VHTTDL (tich hop AI)
-- RDBMS: PostgreSQL / Supabase
-- Notes:
-- - Script nay an toan de chay lai trong moi truong dev do co DROP TABLE IF EXISTS.
-- - Da bo sung index va trigger auto-update updated_at cho cac bang can theo doi thay doi.
-- ==============================================================================

BEGIN;

-- 1) DROP TABLES (reverse dependency order)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS official_documents CASCADE;
DROP TABLE IF EXISTS official_daily_tasks CASCADE;
DROP TABLE IF EXISTS business_insights_summary CASCADE;
DROP TABLE IF EXISTS ai_score_history CASCADE;
DROP TABLE IF EXISTS ai_predictions CASCADE;
DROP TABLE IF EXISTS registration_request_ratings CASCADE;
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS registration_requests CASCADE;
DROP TABLE IF EXISTS business_documents CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS business_types CASCADE;
DROP TABLE IF EXISTS system_configs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2) CORE TABLES
CREATE TABLE system_configs (
    id SERIAL PRIMARY KEY,
    criteria_name VARCHAR(50) UNIQUE NOT NULL,
    threshold_value DOUBLE PRECISION NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('citizen', 'official')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE businesses (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type_id INTEGER NOT NULL REFERENCES business_types(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    district VARCHAR(50),
    province_city VARCHAR(100) NOT NULL DEFAULT 'TP. Ho Chi Minh',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    license_number VARCHAR(50) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'under_inspection')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_documents (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    doc_name VARCHAR(255) NOT NULL,
    doc_url TEXT NOT NULL,
    doc_type VARCHAR(50) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE registration_requests (
    id SERIAL PRIMARY KEY,
    citizen_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type INTEGER NOT NULL REFERENCES business_types(id) ON DELETE RESTRICT,
    data JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'additional_info_required')),
    official_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE registration_request_ratings (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES registration_requests(id) ON DELETE CASCADE,
    citizen_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    satisfaction_level VARCHAR(20) NOT NULL CHECK (satisfaction_level IN ('very_satisfied', 'satisfied', 'not_satisfied')),
    note TEXT,
    rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_reviews (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_name VARCHAR(100),
    rating_star INTEGER CHECK (rating_star BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_predictions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    hygiene_score DOUBLE PRECISION CHECK (hygiene_score >= 0 AND hygiene_score <= 1.0),
    service_score DOUBLE PRECISION CHECK (service_score >= 0 AND service_score <= 1.0),
    facility_score DOUBLE PRECISION CHECK (facility_score >= 0 AND facility_score <= 1.0),
    friendliness_score DOUBLE PRECISION CHECK (friendliness_score >= 0 AND friendliness_score <= 1.0),
    sentiment_label VARCHAR(20) CHECK (sentiment_label IN ('Positive', 'Negative', 'Neutral')),
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_score_history (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    score_type VARCHAR(50) NOT NULL CHECK (score_type IN ('hygiene', 'service', 'facility', 'friendliness')),
    score_value DOUBLE PRECISION NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_insights_summary (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    attribute_affected VARCHAR(50) NOT NULL,
    top_negative_keywords TEXT[],
    representative_reviews TEXT NOT NULL,
    llm_drafted_document TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE official_daily_tasks (
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

CREATE TABLE official_documents (
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

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    target_table VARCHAR(50),
    target_id INTEGER,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) INDEXES
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_type_id ON businesses(type_id);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_district ON businesses(district);
CREATE INDEX idx_business_documents_business_id ON business_documents(business_id);
CREATE INDEX idx_registration_requests_citizen_id ON registration_requests(citizen_id);
CREATE INDEX idx_registration_requests_status ON registration_requests(status);
CREATE INDEX idx_registration_request_ratings_request_id ON registration_request_ratings(request_id);
CREATE INDEX idx_registration_request_ratings_level ON registration_request_ratings(satisfaction_level);
CREATE INDEX idx_registration_request_ratings_rated_at ON registration_request_ratings(rated_at DESC);
CREATE INDEX idx_customer_reviews_business_id ON customer_reviews(business_id);
CREATE INDEX idx_ai_score_history_business_id_type_time ON ai_score_history(business_id, score_type, evaluated_at DESC);
CREATE INDEX idx_notifications_user_id_read ON notifications(user_id, is_read);
CREATE INDEX idx_official_daily_tasks_user_due_status ON official_daily_tasks(official_user_id, due_date, status);
CREATE INDEX idx_official_documents_category_published ON official_documents(category, published_at DESC);
CREATE INDEX idx_audit_logs_user_id_time ON audit_logs(user_id, created_at DESC);

-- 4) TRIGGER: auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_system_configs_set_updated_at
BEFORE UPDATE ON system_configs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_businesses_set_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_registration_requests_set_updated_at
BEFORE UPDATE ON registration_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_registration_request_ratings_set_updated_at
BEFORE UPDATE ON registration_request_ratings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_official_daily_tasks_set_updated_at
BEFORE UPDATE ON official_daily_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_official_documents_set_updated_at
BEFORE UPDATE ON official_documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 5) MOCK DATA
INSERT INTO system_configs (criteria_name, threshold_value, action_type, description) VALUES
('hygiene_critical_threshold', 0.4, 'trigger_alert_and_draft', 'Nguong diem ve sinh bao dong do'),
('service_warning_threshold', 0.5, 'trigger_warning', 'Nguong diem dich vu can theo doi');

INSERT INTO users (username, password_hash, full_name, email, phone, role) VALUES
('canbo01', 'hashed_pw_1', 'Nguyen Van Can Bo', 'canbo01@vhttdl.gov.vn', NULL, 'official'),
('congdan01', 'hashed_pw_2', 'Tran Huu Chu', 'chukhachsan@gmail.com', '0901234567', 'citizen'),
('congdan02', 'hashed_pw_3', 'Le Thi Quan Ly', 'quanlynhahang@gmail.com', '0912345678', 'citizen');

INSERT INTO business_types (name, description) VALUES
('Khach san', 'Co so luu tru du lich'),
('Nha hang', 'Co so kinh doanh dich vu an uong');

INSERT INTO businesses (owner_id, type_id, name, address, district, latitude, longitude, license_number) VALUES
(2, 1, 'Khach san Anh Sao', '123 Nguyen Hue', 'Quan 1', 10.7743, 106.7044, 'GP-KS-001'),
(3, 2, 'Nha hang Bien Goi', '456 Vo Van Tan', 'Quan 3', 10.7769, 106.6918, 'GP-NH-002');

INSERT INTO registration_requests (citizen_id, request_type, data, status, official_note) VALUES
(2, 1, '{"name":"Khach san Anh Sao Mo Rong","address":"123 Nguyen Hue, Quan 1"}', 'pending', NULL),
(3, 2, '{"name":"Nha hang Bien Goi 2","address":"89 Hai Ba Trung, Quan 1"}', 'additional_info_required', 'Can bo sung giay to PCCC va hinh anh mat bang.'),
(2, 1, '{"name":"Khach san Pho Co","address":"17 Le Loi, Quan 1"}', 'approved', 'Da du dieu kien cap phep.');

INSERT INTO registration_request_ratings (request_id, citizen_id, satisfaction_level, note)
SELECT rr.id, rr.citizen_id, 'not_satisfied', 'Can bo can phan hoi nhanh hon cho ho so dang cho xu ly.'
FROM registration_requests rr
WHERE rr.data->>'name' = 'Khach san Anh Sao Mo Rong';

INSERT INTO registration_request_ratings (request_id, citizen_id, satisfaction_level, note)
SELECT rr.id, rr.citizen_id, 'satisfied', 'Da nhan huong dan bo sung ho so ro rang.'
FROM registration_requests rr
WHERE rr.data->>'name' = 'Nha hang Bien Goi 2';

INSERT INTO registration_request_ratings (request_id, citizen_id, satisfaction_level, note)
SELECT rr.id, rr.citizen_id, 'very_satisfied', 'Thoi gian xu ly nhanh va dung nhu lich hen.'
FROM registration_requests rr
WHERE rr.data->>'name' = 'Khach san Pho Co';

INSERT INTO customer_reviews (business_id, customer_name, rating_star, comment) VALUES
(1, 'Khach A', 1, 'Phong rat ban, co mui am moc o goc tuong va ga giuong khong duoc thay moi. Thai do nhan vien cung binh thuong.'),
(1, 'Khach B', 2, 'Co so vat chat xuong cap, dieu hoa keu to nguyen dem khong ngu duoc. Don phong cau tha, rac con trong thung.'),
(1, 'Khach C', 1, 'Trai nghiem te hai, phong co gian. Dich vu khong xung dang voi tieu chuan khach san o Quan 1.');

INSERT INTO ai_predictions (business_id, hygiene_score, service_score, facility_score, friendliness_score, sentiment_label) VALUES
(1, 0.25, 0.60, 0.45, 0.50, 'Negative'),
(2, 0.85, 0.90, 0.80, 0.95, 'Positive');

INSERT INTO ai_score_history (business_id, score_type, score_value, evaluated_at) VALUES
(1, 'hygiene', 0.65, NOW() - INTERVAL '2 months'),
(1, 'hygiene', 0.45, NOW() - INTERVAL '1 month'),
(1, 'hygiene', 0.25, NOW());

INSERT INTO business_insights_summary (business_id, attribute_affected, top_negative_keywords, representative_reviews) VALUES
(1, 'hygiene', '{"ban", "am moc", "gian", "ga giuong"}', '1. Phong rat ban, co mui am moc o goc tuong va ga giuong khong duoc thay moi. 2. Trai nghiem te hai, phong co gian.');

INSERT INTO notifications (user_id, title, message, severity) VALUES
(1, 'Canh bao khan: Diem ve sinh rot nguong', 'Khach san Anh Sao (Quan 1) co diem Ve sinh 0.25. He thong da tao ban nhap quyet dinh nhac nho.', 'critical');

INSERT INTO official_daily_tasks (official_user_id, task_title, task_description, priority, status, due_date, due_time, source_type, source_id) VALUES
(1, 'Ra soat ho so cho xu ly', 'Uu tien cac ho so dang cho xu ly va can bo sung trong ngay.', 'high', 'pending', CURRENT_DATE, '09:00', 'registration_request', 1),
(1, 'Cap nhat ket qua xu ly buoi chieu', 'Tong hop ket qua xu ly de gui bao cao cuoi ngay.', 'medium', 'in_progress', CURRENT_DATE, '15:30', 'manual', NULL);

INSERT INTO official_documents (category, title, summary, document_number, issued_by, published_at, is_pinned, external_url) VALUES
('cong_van', 'Cong van ve tang cuong kiem tra co so luu tru du lich', 'Yeu cau can bo dia ban ra soat co so co nguy co cao va bao cao dinh ky hang tuan.', 'CV-2026-118/VHTTDL', 'Bo VHTTDL', NOW() - INTERVAL '2 days', TRUE, 'https://example.gov.vn/cong-van-kiem-tra-co-so-luu-tru'),
('nghi_quyet', 'Nghi quyet ve chuyen doi so trong quan ly co so kinh doanh VHTTDL', 'Tap trung so hoa quy trinh tiep nhan va giam sat ho so trong nam 2026.', 'NQ-2026-03', 'Hoi dong nhan dan TP.HCM', NOW() - INTERVAL '10 days', FALSE, 'https://example.gov.vn/nghi-quyet-chuyen-doi-so-vhttdl'),
('tin_tuc', 'Ban tin noi bo: huong dan xu ly ho so truc tuyen quy II', 'Cap nhat quy trinh, mau bieu va SLA moi cho cac ho so online.', NULL, 'Trung tam Chuyen doi so VHTTDL', NOW() - INTERVAL '1 day', FALSE, 'https://example.gov.vn/ban-tin-noi-bo-quy-2');

COMMIT;
