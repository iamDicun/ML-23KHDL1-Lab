BEGIN;

-- 1. Xóa các cột điểm 4 thuộc tính cũ
ALTER TABLE hotel_ai_predictions
  DROP COLUMN IF EXISTS hygiene_score,
  DROP COLUMN IF EXISTS service_score,
  DROP COLUMN IF EXISTS facility_score,
  DROP COLUMN IF EXISTS friendliness_score;

-- 2. Thêm lại 6 cột điểm theo đúng 6 thuộc tính gốc của AI
ALTER TABLE hotel_ai_predictions
  ADD COLUMN hygiene_score DOUBLE PRECISION CHECK (hygiene_score >= 0 AND hygiene_score <= 1.0),
  ADD COLUMN food_score DOUBLE PRECISION CHECK (food_score >= 0 AND food_score <= 1.0),
  ADD COLUMN hotel_score DOUBLE PRECISION CHECK (hotel_score >= 0 AND hotel_score <= 1.0),
  ADD COLUMN location_score DOUBLE PRECISION CHECK (location_score >= 0 AND location_score <= 1.0),
  ADD COLUMN room_score DOUBLE PRECISION CHECK (room_score >= 0 AND room_score <= 1.0),
  ADD COLUMN service_score DOUBLE PRECISION CHECK (service_score >= 0 AND service_score <= 1.0);

-- 3. Xóa dữ liệu lịch sử điểm cũ không còn tương thích
DELETE FROM hotel_ai_score_history WHERE score_type NOT IN ('hygiene', 'food', 'hotel', 'location', 'room', 'service');

-- 4. Cập nhật lại ràng buộc CHECK (constraint) của bảng lịch sử điểm
ALTER TABLE hotel_ai_score_history
  DROP CONSTRAINT IF EXISTS hotel_ai_score_history_score_type_check;

ALTER TABLE hotel_ai_score_history
  ADD CONSTRAINT hotel_ai_score_history_score_type_check
  CHECK (score_type IN ('hygiene', 'food', 'hotel', 'location', 'room', 'service'));

COMMIT;
