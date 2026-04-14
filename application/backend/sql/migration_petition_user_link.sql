-- Migration: thêm cột submitter_user_id vào public_feedback_petitions
-- Mục đích: Liên kết phản ánh với tài khoản người gửi để lọc chính xác theo user

BEGIN;

ALTER TABLE public_feedback_petitions
  ADD COLUMN IF NOT EXISTS submitter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pfp_submitter_user_id
  ON public_feedback_petitions(submitter_user_id);

COMMIT;
