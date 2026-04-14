import { query } from '../config/database.js'

const runQuery = async (sql, params = []) => {
  try {
    return await query(sql, params)
  } catch (err) {
    if (err?.code === '42P01') {
      const schemaError = new Error('Thiếu bảng registration_request_ratings. Vui lòng chạy script SQL mới để cập nhật schema.')
      schemaError.statusCode = 500
      throw schemaError
    }
    throw err
  }
}

export const DanhGiaDbModel = {
  findRequestById: async (requestId) => {
    const result = await runQuery(
      `SELECT
         rr.id,
         rr.citizen_id,
         rr.status,
         rr.created_at,
         rr.updated_at,
         rr.data,
         bt.name AS request_type_name,
         u.full_name AS citizen_name,
         u.phone AS citizen_phone,
         COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo') AS business_name
       FROM registration_requests rr
       INNER JOIN business_types bt ON bt.id = rr.request_type
       LEFT JOIN users u ON u.id = rr.citizen_id
       WHERE rr.id = $1
       LIMIT 1`,
      [requestId]
    )

    return result.rows[0] || null
  },

  findRatingByRequestId: async (requestId) => {
    const result = await runQuery(
      `SELECT
         id,
         request_id,
         citizen_id,
         satisfaction_level,
         note,
         rated_at,
         updated_at
       FROM registration_request_ratings
       WHERE request_id = $1
       ORDER BY rated_at DESC, id DESC
       LIMIT 1`,
      [requestId]
    )

    return result.rows[0] || null
  },

  createRating: async ({ requestId, citizenId, satisfactionLevel, note }) => {
    const result = await runQuery(
      `INSERT INTO registration_request_ratings (
         request_id,
         citizen_id,
         satisfaction_level,
         note
       )
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         request_id,
         citizen_id,
         satisfaction_level,
         note,
         rated_at,
         updated_at`,
      [requestId, citizenId || null, satisfactionLevel, note || null]
    )

    return result.rows[0]
  },

  deleteLatestRatingByRequestId: async (requestId) => {
    const result = await runQuery(
      `DELETE FROM registration_request_ratings
       WHERE id = (
         SELECT id
         FROM registration_request_ratings
         WHERE request_id = $1
         ORDER BY rated_at DESC, id DESC
         LIMIT 1
       )`,
      [requestId]
    )

    return result.rowCount
  },

  countRatingsBySatisfaction: async () => {
    const result = await runQuery(
      `SELECT
         satisfaction_level,
         COUNT(*)::INTEGER AS count
       FROM registration_request_ratings
       GROUP BY satisfaction_level`
    )

    return result.rows
  }
}

export default DanhGiaDbModel
