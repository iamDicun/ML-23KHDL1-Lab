import { query } from '../config/database.js'

const runQuery = async (sql, params = []) => {
  try {
    return await query(sql, params)
  } catch (err) {
    if (err?.code === '42P01') {
      const schemaError = new Error('Thiếu bảng public_feedback_petitions. Vui lòng chạy script SQL migration mới để cập nhật schema.')
      schemaError.statusCode = 500
      throw schemaError
    }
    throw err
  }
}

export const PhanAnhKienNghiDbModel = {
  createPetition: async ({
    objectType,
    reporterName,
    organizationName,
    province,
    district,
    ward,
    addressDetail,
    phone,
    email,
    title,
    content,
    receivingUnit,
    attachmentName
  }) => {
    const result = await runQuery(
      `INSERT INTO public_feedback_petitions (
         object_type,
         reporter_name,
         organization_name,
         province,
         district,
         ward,
         address_detail,
         phone,
         email,
         title,
         content,
         receiving_unit,
         attachment_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING
         id,
         code,
         object_type,
         reporter_name,
         organization_name,
         province,
         district,
         ward,
         address_detail,
         phone,
         email,
         title,
         content,
         receiving_unit,
         attachment_name,
         status,
         processing_note,
         received_at,
         reviewed_at,
         resolved_at,
         updated_at`,
      [
        objectType,
        reporterName,
        organizationName || null,
        province || null,
        district || null,
        ward || null,
        addressDetail || null,
        phone,
        email || null,
        title,
        content,
        receivingUnit,
        attachmentName || null
      ]
    )

    return result.rows[0]
  },

  searchPetitions: async ({ keyword, phone, limit, submitterUserId }) => {
    const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 50
    // Use a larger fetch limit to allow service-level filtering by submitterUserId
    const fetchLimit = submitterUserId ? 200 : safeLimit

    const result = await runQuery(
      `SELECT
         id,
         code,
         object_type,
         reporter_name,
         organization_name,
         province,
         district,
         ward,
         address_detail,
         phone,
         email,
         title,
         content,
         receiving_unit,
         attachment_name,
         status,
         processing_note,
         received_at,
         reviewed_at,
         resolved_at,
         updated_at
       FROM public_feedback_petitions
       WHERE ($1::TEXT IS NULL OR (
         code ILIKE '%' || $1 || '%'
         OR title ILIKE '%' || $1 || '%'
         OR reporter_name ILIKE '%' || $1 || '%'
       ))
       AND ($2::TEXT IS NULL OR phone ILIKE '%' || $2 || '%')
       ORDER BY received_at DESC, id DESC
       LIMIT $3`,
      [keyword || null, phone || null, fetchLimit]
    )

    return result.rows
  },

  updatePetitionStatus: async ({ id, status, processingNote }) => {
    const result = await runQuery(
      `UPDATE public_feedback_petitions
       SET
         status = $2::VARCHAR(20),
         processing_note = COALESCE($3, processing_note),
         reviewed_at = CASE
           WHEN $2::TEXT = 'received' THEN NULL
           WHEN $2::TEXT IN ('reviewing', 'resolved') THEN COALESCE(reviewed_at, NOW())
           ELSE reviewed_at
         END,
         resolved_at = CASE
           WHEN $2::TEXT = 'resolved' THEN NOW()
           ELSE NULL
         END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         code,
         object_type,
         reporter_name,
         organization_name,
         province,
         district,
         ward,
         address_detail,
         phone,
         email,
         title,
         content,
         receiving_unit,
         attachment_name,
         status,
         processing_note,
         received_at,
         reviewed_at,
         resolved_at,
         updated_at`,
      [Number(id), status, processingNote || null]
    )

    return result.rows[0] || null
  },

  countByStatus: async () => {
    const result = await runQuery(
      `SELECT status, COUNT(*)::INTEGER AS count
       FROM public_feedback_petitions
       GROUP BY status`
    )

    return result.rows
  }
}

export default PhanAnhKienNghiDbModel