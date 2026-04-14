-- =============================================================================
-- Migration: Xoá 3 cột thống kê review khỏi bảng ai_reuse_hotels
-- Mục đích: Đơn giản hoá bảng, các cột này chỉ dùng cho pipeline AI nội bộ
-- Safe to rerun.
-- =============================================================================

BEGIN;

-- 1) Xoá constraint kiểm tra tổng (phụ thuộc vào 3 cột sắp xoá)
ALTER TABLE ai_reuse_hotels
  DROP CONSTRAINT IF EXISTS chk_ai_reuse_hotels_counts;

ALTER TABLE ai_reuse_hotels
  DROP CONSTRAINT IF EXISTS chk_ai_reuse_hotels_kept_zero;

-- 2) Xoá 3 cột
ALTER TABLE ai_reuse_hotels
  DROP COLUMN IF EXISTS total_reviews_in_output_results,
  DROP COLUMN IF EXISTS removed_reviews_in_step2,
  DROP COLUMN IF EXISTS kept_reviews_in_step2;

COMMIT;
