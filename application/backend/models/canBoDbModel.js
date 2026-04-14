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

const normalizeLimit = (limit, fallback = 12, max = 5000) => {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), max)
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

  findHotels: async (limit = 12) => {
    const result = await safeQueryWhenTableOptional(
      `SELECT
         h.id,
         h.source_hotel_id,
         h.hotel_name AS name,
         NULL::TEXT AS address,
         NULL::TEXT AS district,
         'TP. Ho Chi Minh'::TEXT AS province_city,
         'active'::TEXT AS status,
         NULL::TEXT AS license_number,
         h.imported_at AS created_at,
         'Khách sạn'::TEXT AS business_type,
         NULL::TEXT AS owner_name,
         NULL::TEXT AS owner_phone
       FROM ai_reuse_hotels h
       ORDER BY h.imported_at DESC, h.id DESC
       LIMIT $1`,
      [normalizeLimit(limit, 12, 5000)]
    )

    return result.rows
  },

  findHotelById: async (hotelId) => {
    const result = await query(
      `SELECT
         h.id,
         h.source_hotel_id,
         h.hotel_name AS name,
         NULL::TEXT AS address,
         NULL::TEXT AS district,
         'TP. Ho Chi Minh'::TEXT AS province_city,
         'active'::TEXT AS status,
         NULL::TEXT AS license_number,
         h.imported_at AS created_at,
         'Khách sạn'::TEXT AS business_type,
         NULL::TEXT AS owner_name,
         NULL::TEXT AS owner_phone
       FROM ai_reuse_hotels h
       WHERE h.id = $1
       LIMIT 1`,
      [Number(hotelId)]
    )

    return result.rows[0] || null
  },

  countHotels: async () => {
    const result = await safeQueryWhenTableOptional(
      'SELECT COUNT(*)::INTEGER AS count FROM ai_reuse_hotels'
    )
    return Number(result.rows[0]?.count || 0)
  },

  // Tạo/cập nhật bản ghi cơ sở từ hồ sơ đã được phê duyệt
  upsertApprovedBusiness: async ({ registrationRequestId, hotelName, address, province }) => {
    // Dùng source_hotel_id âm (âm của registrationRequestId) để tránh xung đột với dữ liệu hotel AI thực
    const sourceId = -(registrationRequestId)
    const displayName = String(hotelName || 'Cơ sở kinh doanh')
    const result = await query(
      `INSERT INTO ai_reuse_hotels (source_hotel_id, hotel_name)
       VALUES ($1, $2)
       ON CONFLICT (source_hotel_id) DO UPDATE SET
         hotel_name = EXCLUDED.hotel_name,
         updated_at = NOW()
       RETURNING id`,
      [sourceId, displayName]
    )
    return result.rows[0] || null
  },

  findRegistrationRequests: async ({ status = null, limit = 30 } = {}) => {
    const params = []

    let sql = `SELECT
      rr.id,
      rr.status,
      rr.official_note,
      rr.created_at,
      rr.updated_at,
      rr.data,
      u.full_name AS citizen_name,
      u.phone AS citizen_phone,
      bt.name AS request_type_name,
      COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo', rr.data->>'tenCoSoKinhDoanh') AS business_name,
      COALESCE(rr.data->>'address', rr.data->>'diaChi', rr.data->>'diaChiDangKy') AS business_address
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

  findRegistrationRequestById: async (id) => {
    const result = await query(
      `SELECT
         rr.id,
         rr.status,
         rr.official_note,
         rr.created_at,
         rr.updated_at,
         rr.data,
         u.full_name AS citizen_name,
         u.phone AS citizen_phone,
         bt.name AS request_type_name,
         COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo', rr.data->>'tenCoSoKinhDoanh') AS business_name,
         COALESCE(rr.data->>'address', rr.data->>'diaChi', rr.data->>'diaChiDangKy') AS business_address
       FROM registration_requests rr
       INNER JOIN users u ON u.id = rr.citizen_id
       INNER JOIN business_types bt ON bt.id = rr.request_type
       WHERE rr.id = $1
       LIMIT 1`,
      [Number(id)]
    )

    return result.rows[0] || null
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

  createOfficialDailyTask: async ({ officialUserId, title, description, priority = 'medium', sourceType = null, sourceId = null, dueDate }) => {
    const result = await query(
      `INSERT INTO official_daily_tasks 
       (official_user_id, task_title, task_description, priority, source_type, source_id, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [Number(officialUserId), title, description, priority, sourceType, sourceId, dueDate || new Date().toISOString().split('T')[0]]
    )
    return result.rows[0]
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
  },

  getHotelReviewStats: async ({ hotelId, fromDate = null, toDate = null }) => {
    const params = [Number(hotelId)]
    const whereClauses = ['h.id = $1']

    if (fromDate) {
      params.push(fromDate)
      whereClauses.push(`r.imported_at >= $${params.length}::date`)
    }

    if (toDate) {
      params.push(toDate)
      whereClauses.push(`r.imported_at < ($${params.length}::date + INTERVAL '1 day')`)
    }

    const result = await query(
      `SELECT
         COUNT(*)::INTEGER AS total_reviews,
         ROUND(AVG(r.rating)::numeric, 2)::FLOAT AS average_rating,
         MIN(r.imported_at) AS first_review_at,
         MAX(r.imported_at) AS last_review_at
       FROM ai_reuse_reviews r
       INNER JOIN ai_reuse_hotels h ON h.source_hotel_id = r.source_hotel_id
       WHERE ${whereClauses.join(' AND ')}`,
      params
    )

    return result.rows[0] || {
      total_reviews: 0,
      average_rating: null,
      first_review_at: null,
      last_review_at: null
    }
  },

  findHotelReviews: async ({ hotelId, fromDate = null, toDate = null, limit = 200 }) => {
    const params = [Number(hotelId)]
    const whereClauses = ['h.id = $1']

    if (fromDate) {
      params.push(fromDate)
      whereClauses.push(`r.imported_at >= $${params.length}::date`)
    }

    if (toDate) {
      params.push(toDate)
      whereClauses.push(`r.imported_at < ($${params.length}::date + INTERVAL '1 day')`)
    }

    params.push(normalizeLimit(limit, 200, 500))

    const result = await query(
      `SELECT
         r.id,
         NULL::TEXT AS customer_name,
         CASE
           WHEN r.rating IS NULL THEN NULL
           ELSE LEAST(5, GREATEST(0, ROUND(r.rating)::INTEGER))
         END AS rating_star,
         r.review_text_raw AS comment,
         r.review_text_processed AS comment_processed,
         r.imported_at AS reviewed_at
       FROM ai_reuse_reviews r
       INNER JOIN ai_reuse_hotels h ON h.source_hotel_id = r.source_hotel_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY r.imported_at DESC NULLS LAST, r.id DESC
       LIMIT $${params.length}`,
      params
    )

    return result.rows
  },

  upsertHotelAiPrediction: async ({
    hotelId,
    hygieneScore,
    foodScore,
    hotelScore,
    locationScore,
    roomScore,
    serviceScore,
    sentimentLabel
  }) => {
    const result = await query(
      `INSERT INTO hotel_ai_predictions (
         hotel_id,
         hygiene_score,
         food_score,
         hotel_score,
         location_score,
         room_score,
         service_score,
         sentiment_label,
         last_evaluated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (hotel_id)
       DO UPDATE SET
         hygiene_score = EXCLUDED.hygiene_score,
         food_score = EXCLUDED.food_score,
         hotel_score = EXCLUDED.hotel_score,
         location_score = EXCLUDED.location_score,
         room_score = EXCLUDED.room_score,
         service_score = EXCLUDED.service_score,
         sentiment_label = EXCLUDED.sentiment_label,
         last_evaluated_at = NOW()
       RETURNING id, hotel_id, hygiene_score, food_score, hotel_score, location_score, room_score, service_score, sentiment_label, last_evaluated_at`,
      [
        Number(hotelId),
        hygieneScore,
        foodScore,
        hotelScore,
        locationScore,
        roomScore,
        serviceScore,
        sentimentLabel
      ]
    )

    return result.rows[0] || null
  },

  insertHotelAiScoreHistoryEntries: async (hotelId, entries = []) => {
    if (!Array.isArray(entries) || entries.length === 0) return []

    const inserted = []

    for (const entry of entries) {
      const result = await query(
        `INSERT INTO hotel_ai_score_history (hotel_id, score_type, score_value, evaluated_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, hotel_id, score_type, score_value, evaluated_at`,
        [Number(hotelId), entry.scoreType, entry.scoreValue]
      )

      if (result.rows[0]) inserted.push(result.rows[0])
    }

    return inserted
  },

  insertHotelInsightSummary: async ({
    hotelId,
    attributeAffected,
    topNegativeKeywords,
    representativeReviews,
    llmDraftedDocument = null
  }) => {
    const result = await query(
      `INSERT INTO hotel_insights_summary (
         hotel_id,
         attribute_affected,
         top_negative_keywords,
         representative_reviews,
         llm_drafted_document,
         generated_at
       )
       VALUES ($1, $2, $3::text[], $4, $5, NOW())
       RETURNING id, hotel_id, attribute_affected, top_negative_keywords, representative_reviews, llm_drafted_document, generated_at`,
      [
        Number(hotelId),
        attributeAffected,
        topNegativeKeywords,
        representativeReviews,
        llmDraftedDocument
      ]
    )

    return result.rows[0] || null
  },

  findLatestHotelInsightSummary: async (hotelId) => {
    const result = await safeQueryWhenTableOptional(
      `SELECT id, hotel_id, attribute_affected, top_negative_keywords, representative_reviews, llm_drafted_document, generated_at
       FROM hotel_insights_summary
       WHERE hotel_id = $1
       ORDER BY generated_at DESC, id DESC
       LIMIT 1`,
      [Number(hotelId)]
    )

    return result.rows[0] || null
  }
}

export default CanBoDbModel
