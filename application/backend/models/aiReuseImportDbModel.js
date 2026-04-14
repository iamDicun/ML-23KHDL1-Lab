import { query } from '../config/database.js'

const isMissingTableError = (err) => err?.code === '42P01'

const safeOptionalCountQuery = async (sql) => {
  try {
    const result = await query(sql)
    return Number(result.rows[0]?.count || 0)
  } catch (err) {
    if (isMissingTableError(err)) {
      return 0
    }
    throw err
  }
}

const safeOptionalValueQuery = async (sql) => {
  try {
    const result = await query(sql)
    return result.rows[0]?.value || null
  } catch (err) {
    if (isMissingTableError(err)) {
      return null
    }
    throw err
  }
}

export const AiReuseImportDbModel = {
  getImportStats: async () => {
    const totalHotels = await safeOptionalCountQuery(
      'SELECT COUNT(*)::INTEGER AS count FROM ai_reuse_hotels'
    )

    const totalReviews = await safeOptionalCountQuery(
      'SELECT COUNT(*)::INTEGER AS count FROM ai_reuse_reviews'
    )

    const latestImportedAt = await safeOptionalValueQuery(
      'SELECT MAX(imported_at) AS value FROM ai_reuse_reviews'
    )

    return {
      totalHotels,
      totalReviews,
      latestImportedAt,
      isMigrationReady: totalHotels > 0 || totalReviews > 0 || latestImportedAt !== null
    }
  }
}

export default AiReuseImportDbModel