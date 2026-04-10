import { query } from '../config/database.js'

const isMissingTableError = (err) => err?.code === '42P01'

const safeQueryWhenTableOptional = async (sql, params = []) => {
  try {
    return await query(sql, params)
  } catch (err) {
    if (isMissingTableError(err)) {
      return { rows: [], rowCount: 0 }
    }
    throw err
  }
}

export const CanBoDbModel = {
  findAllOfficials: async () => {
    const result = await query(
      `SELECT id, username, full_name, email, phone, created_at
       FROM users
       WHERE role = 'official'
       ORDER BY created_at DESC`
    )

    return result.rows.map((row) => ({
      id: row.id,
      taiKhoan: row.username,
      hoTen: row.full_name,
      email: row.email,
      sdt: row.phone,
      createdAt: row.created_at,
      donVi: 'Chưa cập nhật',
      chucVu: 'Chưa cập nhật'
    }))
  },

  findBusinesses: async (limit = 12) => {
    const result = await query(
      `SELECT
         b.id,
         b.name,
         b.address,
         b.district,
         b.province_city,
         b.status,
         b.license_number,
         b.created_at,
         bt.name AS business_type,
         u.full_name AS owner_name,
         u.phone AS owner_phone
       FROM businesses b
       INNER JOIN business_types bt ON bt.id = b.type_id
       LEFT JOIN users u ON u.id = b.owner_id
       ORDER BY b.created_at DESC
       LIMIT $1`,
      [limit]
    )

    return result.rows
  },

  countBusinesses: async () => {
    const result = await query('SELECT COUNT(*)::INTEGER AS count FROM businesses')
    return Number(result.rows[0]?.count || 0)
  },

  findRegistrationRequests: async ({ status = null, limit = 30 } = {}) => {
    const params = []

    let sql = `SELECT
      rr.id,
      rr.status,
      rr.official_note,
      rr.created_at,
      rr.updated_at,
      u.full_name AS citizen_name,
      u.phone AS citizen_phone,
      bt.name AS request_type_name,
      COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo') AS business_name,
      COALESCE(rr.data->>'address', rr.data->>'diaChi') AS business_address
    FROM registration_requests rr
    INNER JOIN users u ON u.id = rr.citizen_id
    INNER JOIN business_types bt ON bt.id = rr.request_type`

    if (status) {
      params.push(status)
      sql += ` WHERE rr.status = $${params.length}`
    }

    params.push(limit)
    sql += ` ORDER BY rr.created_at DESC LIMIT $${params.length}`

    const result = await query(sql, params)
    return result.rows
  },

  countRequestsByStatus: async () => {
    const result = await query(
      `SELECT status, COUNT(*)::INTEGER AS count
       FROM registration_requests
       GROUP BY status`
    )

    return result.rows
  },

  updateRegistrationRequestStatus: async ({ id, status, officialNote }) => {
    const result = await query(
      `UPDATE registration_requests
       SET status = $2,
           official_note = COALESCE($3, official_note),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, official_note, created_at, updated_at`,
      [id, status, officialNote]
    )

    return result.rows[0] || null
  },

  findTodayTasks: async (officialUserId, limit = 20) => {
    const result = await safeQueryWhenTableOptional(
      `SELECT
         id,
         task_title,
         task_description,
         priority,
         status,
         due_date,
         due_time,
         source_type,
         source_id,
         created_at,
         updated_at
       FROM official_daily_tasks
       WHERE official_user_id = $1
         AND due_date = CURRENT_DATE
       ORDER BY
         CASE priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           ELSE 3
         END,
         due_time NULLS LAST,
         created_at DESC
       LIMIT $2`,
      [officialUserId, limit]
    )

    return result.rows
  },

  findOfficialDocuments: async (limit = 20) => {
    const result = await safeQueryWhenTableOptional(
      `SELECT
         id,
         category,
         title,
         summary,
         document_number,
         issued_by,
         published_at,
         effective_from,
         effective_to,
         external_url,
         attachment_url,
         is_pinned,
         created_at,
         updated_at
       FROM official_documents
       ORDER BY is_pinned DESC, published_at DESC, created_at DESC
       LIMIT $1`,
      [limit]
    )

    return result.rows
  },

  getMonthlyRequestStats: async (year) => {
    const result = await query(
      `SELECT
         EXTRACT(MONTH FROM created_at)::INTEGER AS month,
         COUNT(*)::INTEGER AS received,
         COUNT(*) FILTER (WHERE status = 'approved')::INTEGER AS approved
       FROM registration_requests
       WHERE EXTRACT(YEAR FROM created_at) = $1
       GROUP BY month
       ORDER BY month`,
      [year]
    )

    return result.rows
  }
}

export default CanBoDbModel
