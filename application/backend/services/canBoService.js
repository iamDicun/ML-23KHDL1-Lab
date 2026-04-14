import { CanBoDbModel } from '../models/canBoDbModel.js'
import { UserDbModel } from '../models/userDbModel.js'
import { verifyPassword } from '../utils/password.js'
import { config } from '../config/env.js'

const STATUS_MAP = {
  pending: 'Chờ xử lý',
  approved: 'Đã phê duyệt',
  rejected: 'Bị từ chối',
  additional_info_required: 'Yêu cầu bổ sung'
}

const STATUS_ALIASES = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  additional_info_required: 'additional_info_required',
  'Đang xử lý': 'pending',
  'Đã giải quyết': 'approved',
  'Từ chối': 'rejected',
  'Bổ sung hồ sơ': 'additional_info_required'
}

const TASK_STATUS_MAP = {
  pending: 'Chưa xử lý',
  in_progress: 'Đang xử lý',
  done: 'Hoàn thành',
  cancelled: 'Đã hủy'
}

const TASK_PRIORITY_MAP = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp'
}

const DOCUMENT_CATEGORY_MAP = {
  cong_van: 'Công văn',
  nghi_quyet: 'Nghị quyết',
  tin_tuc: 'Tin tức cán bộ'
}

const AI_ASPECTS = ['hygiene', 'food', 'hotel', 'location', 'room', 'service']

const SCORE_TYPES = {
  hygiene: 'hygiene',
  service: 'service',
  facility: 'facility',
  friendliness: 'friendliness'
}

const ATTRIBUTE_LABELS = {
  hygiene: 'Vệ sinh',
  service: 'Dịch vụ',
  facility: 'Cơ sở vật chất',
  friendliness: 'Mức độ thân thiện'
}

const DEPLOYED_ASPECT_ALIASES = {
  hygiene: ['hygiene', 'vệ sinh', 've sinh'],
  food: ['food', 'đồ ăn thức uống', 'do an thuc uong'],
  hotel: ['hotel', 'khách sạn', 'khach san'],
  location: ['location', 'vị trí', 'vi tri'],
  room: ['room', 'phòng ốc', 'phong oc'],
  service: ['service', 'dịch vụ', 'dich vu']
}

const LABEL_TO_CLASS = {
  positive: 1,
  negative: 2,
  none: 0,
  neutral: 0
}

const STOPWORDS_VI = new Set([
  'khach', 'sạn', 'khách', 'sạn', 'nha', 'nhà', 'va', 'và', 'rat', 'rất', 'voi', 'với',
  'cho', 'toi', 'tôi', 'ban', 'bạn', 'nhung', 'nhưng', 'nay', 'này', 'khi', 'cua', 'của',
  'duoc', 'được', 'khong', 'không', 'co', 'có', 'mot', 'một', 'nhieu', 'nhiều', 'trong',
  'o', 'ở', 'the', 'thể', 'la', 'là', 'da', 'đã', 'se', 'sẽ', 'thi', 'thì', 'neu', 'nếu',
  'vi', 'vì', 'den', 'đến', 'day', 'đây', 'roi', 'rồi', 'qua', 'quá', 'gia', 'giá', 'ca',
  'cả', 'tot', 'tốt', 'te', 'tệ', 'binh', 'thường', 'none'
])

const mapStatusLabel = (status) => STATUS_MAP[status] || status
const normalizeStatus = (status) => STATUS_ALIASES[status] || status
const isMissingTableError = (error) => error?.code === '42P01'

const createMissingHotelTablesError = () => {
  const err = new Error('Thiếu bảng dữ liệu hotel/review. Vui lòng chạy migration hotel-only (ai_reuse_hotels, ai_reuse_reviews, hotel_ai_predictions, hotel_ai_score_history, hotel_insights_summary).')
  err.statusCode = 500
  return err
}

const normalizeScore = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

const average = (values = []) => {
  const filtered = values.filter((item) => Number.isFinite(item))
  if (!filtered.length) return 0
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

const round = (value, digits = 4) => {
  const factor = 10 ** digits
  return Math.round(Number(value) * factor) / factor
}

const normalizeModelInputText = (value) => String(value || '').trim().replace(/\s+/g, ' ')

const normalizeAspectToken = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const coerceClassPrediction = (value) => {
  const numberValue = Number(value)
  if ([0, 1, 2].includes(numberValue)) return numberValue

  const normalized = normalizeAspectToken(value)
  if (normalized in LABEL_TO_CLASS) return LABEL_TO_CLASS[normalized]

  return 0
}

const findAspectRawValue = (row, aliases = []) => {
  if (!row || typeof row !== 'object') return undefined

  const normalizedMap = new Map(
    Object.entries(row).map(([key, value]) => [normalizeAspectToken(key), value])
  )

  for (const alias of aliases) {
    const hit = normalizedMap.get(normalizeAspectToken(alias))
    if (hit !== undefined) return hit
  }

  return undefined
}

const parseAspectPrediction = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return { prediction: 0, confidence: 0 }
  }

  if (typeof rawValue === 'object') {
    const prediction = coerceClassPrediction(rawValue.prediction)
    const confidence = Number.isFinite(Number(rawValue.confidence))
      ? normalizeScore(Number(rawValue.confidence))
      : 0

    return { prediction, confidence }
  }

  const prediction = coerceClassPrediction(rawValue)
  return {
    prediction,
    // Deployed HF response currently does not include confidence.
    confidence: 0
  }
}

const normalizeAiResponseRow = (row = {}) => {
  const normalized = {}

  for (const aspect of AI_ASPECTS) {
    const rawValue = findAspectRawValue(row, DEPLOYED_ASPECT_ALIASES[aspect] || [aspect])
    const parsed = parseAspectPrediction(rawValue)

    normalized[aspect] = {
      prediction: parsed.prediction,
      confidence: parsed.confidence
    }
  }

  return normalized
}

const resolveAiBaseUrl = (value) => {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  if (!raw) return ''

  // Accept Hugging Face repository URL and convert it to the Space runtime domain.
  const match = raw.match(/^https?:\/\/huggingface\.co\/spaces\/([^/]+)\/([^/]+)$/i)
  if (match) {
    const [, owner, space] = match
    return `https://${owner}-${space}.hf.space`
  }

  return raw
}

const classToScore = (predictedClass) => {
  if (predictedClass === 1) return 1
  if (predictedClass === 2) return 0
  return 0.5
}

const classToBucket = (predictedClass) => {
  if (predictedClass === 1) return 'positive'
  if (predictedClass === 2) return 'negative'
  return 'none'
}

const buildAiEndpointUrl = () => {
  const base = resolveAiBaseUrl(config.aiModel.baseUrl)
  if (!base) {
    const err = new Error('AI model URL chưa được cấu hình. Vui lòng đặt AI_MODEL_API_BASE_URL trong .env')
    err.statusCode = 500
    throw err
  }

  return `${base}/predict_batch`
}

const extractTopNegativeKeywords = (texts = [], limit = 8) => {
  const counts = new Map()

  for (const text of texts) {
    const normalized = String(text || '').toLowerCase().replace(/_/g, ' ')
    const matches = normalized.match(/[\p{L}\p{N}]+/gu) || []

    for (const token of matches) {
      if (!token || token.length < 3) continue
      if (STOPWORDS_VI.has(token)) continue

      counts.set(token, (counts.get(token) || 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword)
}

const deriveSentimentLabel = ({ totalPositive, totalNegative }) => {
  const denominator = totalPositive + totalNegative
  if (denominator <= 0) return 'Neutral'

  const score = (totalPositive - totalNegative) / denominator
  if (score > 0.12) return 'Positive'
  if (score < -0.12) return 'Negative'
  return 'Neutral'
}

const normalizeDateInput = (value) => {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const err = new Error('Định dạng ngày không hợp lệ. Sử dụng YYYY-MM-DD')
    err.statusCode = 400
    throw err
  }

  return raw
}

const mapRequestRow = (row) => ({
  id: row.id,
  maSo: `HS-${String(row.id).padStart(6, '0')}`,
  tenThuTuc: row.request_type_name,
  tenCoSo: row.business_name || 'Chưa cập nhật',
  diaChi: row.business_address || 'Chưa cập nhật',
  congDan: {
    hoTen: row.citizen_name,
    sdt: row.citizen_phone
  },
  trangThai: row.status,
  trangThaiHienThi: mapStatusLabel(row.status),
  ghiChu: row.official_note,
  ngayNop: row.created_at,
  ngayCapNhat: row.updated_at,
  duLieuKhaiBao: row.data || null
})

export const CanBoService = {
  // Đăng nhập cán bộ
  dangNhap: async (taiKhoan, matKhau) => {
    if (!taiKhoan || !matKhau) {
      const err = new Error('Tài khoản và mật khẩu là bắt buộc'); err.statusCode = 400; throw err
    }

    const canBoUser = await UserDbModel.findOfficialByUsername(taiKhoan)
    const isPasswordValid = await verifyPassword(matKhau, canBoUser?.passwordHash)
    if (!canBoUser || !isPasswordValid) {
      const err = new Error('Tài khoản hoặc mật khẩu không đúng'); err.statusCode = 401; throw err
    }

    const info = {
      id: canBoUser.id,
      taiKhoan: canBoUser.username,
      hoTen: canBoUser.fullName,
      donVi: 'Khối quản lý VHTTDL',
      chucVu: 'Cán bộ xử lý hồ sơ',
      createdAt: canBoUser.createdAt
    }

    return { message: 'Đăng nhập thành công', canBo: info }
  },

  // Lấy danh sách tất cả hồ sơ cần xử lý
  getDanhSachHoSo: async (trangThai) => {
    const normalizedStatus = trangThai ? normalizeStatus(trangThai) : null
    const rows = await CanBoDbModel.findRegistrationRequests({ status: normalizedStatus, limit: 200 })

    return rows.map(mapRequestRow)
  },

  getHoSoChiTiet: async (id) => {
    const requestId = Number(id)
    if (!Number.isInteger(requestId) || requestId <= 0) {
      const err = new Error('ID hồ sơ không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const row = await CanBoDbModel.findRegistrationRequestById(requestId)
    if (!row) {
      const err = new Error('Không tìm thấy hồ sơ')
      err.statusCode = 404
      throw err
    }

    return mapRequestRow(row)
  },

  getThongKeReviewTheoCoSo: async ({ coSoId, businessId, fromDate, toDate }) => {
    const normalizedHotelId = Number(coSoId ?? businessId)
    if (!Number.isInteger(normalizedHotelId) || normalizedHotelId <= 0) {
      const err = new Error('ID cơ sở không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const normalizedFromDate = normalizeDateInput(fromDate)
    const normalizedToDate = normalizeDateInput(toDate)

    if (normalizedFromDate && normalizedToDate && normalizedFromDate > normalizedToDate) {
      const err = new Error('Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày')
      err.statusCode = 400
      throw err
    }

    let hotel
    let stats
    let reviews

    try {
      hotel = await CanBoDbModel.findHotelById(normalizedHotelId)
      if (!hotel) {
        const err = new Error('Không tìm thấy cơ sở lưu trú')
        err.statusCode = 404
        throw err
      }

      stats = await CanBoDbModel.getHotelReviewStats({
        hotelId: normalizedHotelId,
        fromDate: normalizedFromDate,
        toDate: normalizedToDate
      })

      reviews = await CanBoDbModel.findHotelReviews({
        hotelId: normalizedHotelId,
        fromDate: normalizedFromDate,
        toDate: normalizedToDate,
        limit: 300
      })
    } catch (error) {
      if (isMissingTableError(error)) {
        throw createMissingHotelTablesError()
      }
      throw error
    }

    return {
      coSo: {
        id: hotel.id,
        tenCoSo: hotel.name,
        diaChi: hotel.address,
        loaiHinh: hotel.business_type,
        trangThai: hotel.status
      },
      boLoc: {
        tuNgay: normalizedFromDate,
        denNgay: normalizedToDate
      },
      thongKeReview: {
        tongLuotReview: Number(stats.total_reviews || 0),
        diemTrungBinh: stats.average_rating,
        reviewDauTien: stats.first_review_at,
        reviewGanNhat: stats.last_review_at
      },
      danhSachReview: reviews.map((review) => ({
        id: review.id,
        tenNguoiReview: review.customer_name || 'Ẩn danh',
        soSao: Number(review.rating_star || 0),
        noiDung: review.comment || '',
        thoiDiemReview: review.reviewed_at
      }))
    }
  },

  getThongKeAiTheoCoSo: async ({ coSoId, businessId, fromDate, toDate }) => {
    const normalizedHotelId = Number(coSoId ?? businessId)
    if (!Number.isInteger(normalizedHotelId) || normalizedHotelId <= 0) {
      const err = new Error('ID cơ sở không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const normalizedFromDate = normalizeDateInput(fromDate)
    const normalizedToDate = normalizeDateInput(toDate)

    if (normalizedFromDate && normalizedToDate && normalizedFromDate > normalizedToDate) {
      const err = new Error('Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày')
      err.statusCode = 400
      throw err
    }

    let hotel
    let rawReviews

    try {
      hotel = await CanBoDbModel.findHotelById(normalizedHotelId)
      if (!hotel) {
        const err = new Error('Không tìm thấy cơ sở lưu trú')
        err.statusCode = 404
        throw err
      }

      rawReviews = await CanBoDbModel.findHotelReviews({
        hotelId: normalizedHotelId,
        fromDate: normalizedFromDate,
        toDate: normalizedToDate,
        limit: 500
      })
    } catch (error) {
      if (isMissingTableError(error)) {
        throw createMissingHotelTablesError()
      }
      throw error
    }

    const usableReviews = rawReviews
      .map((review) => ({
        ...review,
        comment: String(review.comment || '').trim(),
        processedComment: normalizeModelInputText(review.comment_processed),
        modelInputText: normalizeModelInputText(review.comment_processed) || normalizeModelInputText(review.comment)
      }))
      .filter((review) => Boolean(review.modelInputText))

    if (usableReviews.length === 0) {
      const err = new Error('Không có review hợp lệ để phân tích AI trong khoảng thời gian đã chọn')
      err.statusCode = 400
      throw err
    }

    const endpointUrl = buildAiEndpointUrl()
    const controller = new AbortController()
    const timeoutMs = Math.max(Number(config.aiModel.timeoutMs) || 180000, 1000)
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    let aiPayload
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texts: usableReviews.map((item) => item.modelInputText)
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const text = await response.text()
        const err = new Error(`AI service lỗi (${response.status}): ${text || 'No detail'}`)
        err.statusCode = 502
        throw err
      }

      aiPayload = await response.json()
    } catch (error) {
      if (error.name === 'AbortError') {
        const err = new Error('AI service timeout. Vui lòng thử lại với khoảng thời gian nhỏ hơn.')
        err.statusCode = 504
        throw err
      }

      if (error.statusCode) throw error

      const err = new Error(`Không thể kết nối AI service tại ${endpointUrl}. ${error.message || ''}`.trim())
      err.statusCode = 502
      throw err
    } finally {
      clearTimeout(timeout)
    }

    const predictions = Array.isArray(aiPayload?.predictions) ? aiPayload.predictions : null
    if (!predictions || predictions.length !== usableReviews.length) {
      const err = new Error('Dữ liệu trả về từ AI service không hợp lệ (không khớp số lượng review)')
      err.statusCode = 502
      throw err
    }

    const aspectStats = AI_ASPECTS.reduce((acc, aspect) => {
      acc[aspect] = {
        count: 0,
        scoreSum: 0,
        confidenceSum: 0,
        positive: 0,
        negative: 0,
        none: 0
      }
      return acc
    }, {})

    const perReviewPredictions = []

    for (let i = 0; i < predictions.length; i += 1) {
      const row = normalizeAiResponseRow(predictions[i] || {})
      const currentReviewPrediction = {}

      for (const aspect of AI_ASPECTS) {
        const raw = row[aspect] || { prediction: 0, confidence: 0 }
        const normalizedPrediction = coerceClassPrediction(raw.prediction)
        const confidence = normalizeScore(Number(raw.confidence))
        const score = classToScore(normalizedPrediction)
        const bucket = classToBucket(normalizedPrediction)

        aspectStats[aspect].count += 1
        aspectStats[aspect].scoreSum += score
        aspectStats[aspect].confidenceSum += confidence
        aspectStats[aspect][bucket] += 1

        currentReviewPrediction[aspect] = {
          prediction: normalizedPrediction,
          confidence,
          score
        }
      }

      perReviewPredictions.push(currentReviewPrediction)
    }

    const aspectAverages = AI_ASPECTS.reduce((acc, aspect) => {
      const item = aspectStats[aspect]
      acc[aspect] = {
        score: item.count > 0 ? normalizeScore(item.scoreSum / item.count) : 0,
        confidence: item.count > 0 ? normalizeScore(item.confidenceSum / item.count) : 0,
        positive: item.positive,
        negative: item.negative,
        none: item.none,
        count: item.count
      }
      return acc
    }, {})

    const scores = {
      [SCORE_TYPES.hygiene]: normalizeScore(average([aspectAverages.hygiene.score, aspectAverages.room.score])),
      [SCORE_TYPES.service]: normalizeScore(average([aspectAverages.service.score, aspectAverages.food.score])),
      [SCORE_TYPES.facility]: normalizeScore(average([aspectAverages.hotel.score, aspectAverages.location.score, aspectAverages.room.score])),
      [SCORE_TYPES.friendliness]: normalizeScore(aspectAverages.service.score)
    }

    const totalPositive = AI_ASPECTS.reduce((sum, aspect) => sum + aspectAverages[aspect].positive, 0)
    const totalNegative = AI_ASPECTS.reduce((sum, aspect) => sum + aspectAverages[aspect].negative, 0)
    const sentimentLabel = deriveSentimentLabel({ totalPositive, totalNegative })

    const scoreEntries = [
      { scoreType: SCORE_TYPES.hygiene, scoreValue: scores[SCORE_TYPES.hygiene] },
      { scoreType: SCORE_TYPES.service, scoreValue: scores[SCORE_TYPES.service] },
      { scoreType: SCORE_TYPES.facility, scoreValue: scores[SCORE_TYPES.facility] },
      { scoreType: SCORE_TYPES.friendliness, scoreValue: scores[SCORE_TYPES.friendliness] }
    ]

    const [worstAttribute] = scoreEntries
      .slice()
      .sort((a, b) => a.scoreValue - b.scoreValue)

    const attributeToAspects = {
      [SCORE_TYPES.hygiene]: ['hygiene', 'room'],
      [SCORE_TYPES.service]: ['service', 'food'],
      [SCORE_TYPES.facility]: ['hotel', 'location', 'room'],
      [SCORE_TYPES.friendliness]: ['service']
    }

    const focusAspects = attributeToAspects[worstAttribute.scoreType]
    const rankedNegativeReviews = usableReviews
      .map((review, index) => {
        const prediction = perReviewPredictions[index]
        let severity = 0

        for (const aspect of focusAspects) {
          const value = prediction[aspect]?.prediction
          if (value === 2) severity += 2
          else if (value === 0) severity += 1
        }

        return {
          review,
          severity,
          confidence: average(focusAspects.map((aspect) => prediction[aspect]?.confidence || 0))
        }
      })
      .filter((item) => item.severity > 0)
      .sort((a, b) => {
        if (b.severity !== a.severity) return b.severity - a.severity
        return b.confidence - a.confidence
      })

    const representativeReviews = rankedNegativeReviews
      .slice(0, 3)
      .map((item) => item.review.comment)

    const topNegativeKeywords = extractTopNegativeKeywords(representativeReviews, 8)
    const representativeReviewsText = representativeReviews.length > 0
      ? representativeReviews.map((text, idx) => `(${idx + 1}) ${text}`).join('\n')
      : 'Không có review tiêu cực nổi bật trong kỳ phân tích.'

    let aiPredictionRow
    let scoreHistoryRows
    let insightRow

    try {
      aiPredictionRow = await CanBoDbModel.upsertHotelAiPrediction({
        hotelId: normalizedHotelId,
        hygieneScore: scores[SCORE_TYPES.hygiene],
        serviceScore: scores[SCORE_TYPES.service],
        facilityScore: scores[SCORE_TYPES.facility],
        friendlinessScore: scores[SCORE_TYPES.friendliness],
        sentimentLabel
      })

      scoreHistoryRows = await CanBoDbModel.insertHotelAiScoreHistoryEntries(normalizedHotelId, scoreEntries)

      insightRow = await CanBoDbModel.insertHotelInsightSummary({
        hotelId: normalizedHotelId,
        attributeAffected: worstAttribute.scoreType,
        topNegativeKeywords,
        representativeReviews: representativeReviewsText
      })
    } catch (error) {
      if (error?.code === '42P01') {
        throw createMissingHotelTablesError()
      }
      throw error
    }

    const overallScore = normalizeScore(average(scoreEntries.map((item) => item.scoreValue)))

    return {
      coSo: {
        id: hotel.id,
        tenCoSo: hotel.name,
        diaChi: hotel.address,
        loaiHinh: hotel.business_type,
        trangThai: hotel.status
      },
      boLoc: {
        tuNgay: normalizedFromDate,
        denNgay: normalizedToDate
      },
      duLieuDauVao: {
        tongReviewLayTuDB: rawReviews.length,
        tongReviewHopLeChoModel: usableReviews.length,
        tongReviewDaTienXuLySuDungChoModel: usableReviews.filter((item) => Boolean(item.processedComment)).length,
        aiEndpoint: endpointUrl
      },
      ketQuaAi: {
        sentimentLabel,
        diemTongQuan: round(overallScore, 4),
        diemThanhPhan: {
          hygiene: round(scores[SCORE_TYPES.hygiene], 4),
          service: round(scores[SCORE_TYPES.service], 4),
          facility: round(scores[SCORE_TYPES.facility], 4),
          friendliness: round(scores[SCORE_TYPES.friendliness], 4)
        },
        chiTietAspect: AI_ASPECTS.reduce((acc, aspect) => {
          acc[aspect] = {
            diem: round(aspectAverages[aspect].score, 4),
            doTinCayTrungBinh: round(aspectAverages[aspect].confidence, 4),
            positive: aspectAverages[aspect].positive,
            negative: aspectAverages[aspect].negative,
            none: aspectAverages[aspect].none
          }
          return acc
        }, {}),
        insight: {
          thuocTinhAnhHuongNhat: {
            key: worstAttribute.scoreType,
            label: ATTRIBUTE_LABELS[worstAttribute.scoreType] || worstAttribute.scoreType,
            score: round(worstAttribute.scoreValue, 4)
          },
          topTuKhoaTieuCuc: topNegativeKeywords,
          reviewDaiDien: representativeReviews
        },
        luuTru: {
          aiPredictionId: aiPredictionRow?.id || null,
          aiScoreHistoryCount: scoreHistoryRows?.length || 0,
          hotelInsightSummaryId: insightRow?.id || null,
          evaluatedAt: aiPredictionRow?.last_evaluated_at || new Date().toISOString()
        }
      }
    }
  },

  // Cập nhật trạng thái hồ sơ
  xuLyHoSo: async (id, canBoId, trangThai, ghiChu) => {
    const normalizedStatus = normalizeStatus(trangThai)
    const validStatuses = ['pending', 'approved', 'rejected', 'additional_info_required']

    if (!validStatuses.includes(normalizedStatus)) {
      const err = new Error(`Trạng thái không hợp lệ. Chấp nhận: ${validStatuses.join(', ')}`); err.statusCode = 400; throw err
    }

    const updated = await CanBoDbModel.updateRegistrationRequestStatus({
      id: Number(id),
      status: normalizedStatus,
      officialNote: ghiChu || `Được xử lý bởi cán bộ #${canBoId}`
    })

    if (!updated) {
      const err = new Error('Không tìm thấy hồ sơ'); err.statusCode = 404; throw err
    }

    const hoSo = await CanBoDbModel.findRegistrationRequestById(Number(id))
    if (!hoSo) {
      const err = new Error('Không tìm thấy hồ sơ'); err.statusCode = 404; throw err
    }

    return {
      message: 'Cập nhật trạng thái hồ sơ thành công',
      hoSo: mapRequestRow(hoSo)
    }
  },

  // Thống kê theo tháng
  getThongKe: async (nam) => {
    const year = Number(nam || new Date().getFullYear())
    const rows = await CanBoDbModel.getMonthlyRequestStats(year)

    const monthMap = new Map(rows.map((row) => [row.month, row]))
    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const found = monthMap.get(month) || { received: 0, approved: 0 }
      const received = Number(found.received || 0)
      const approved = Number(found.approved || 0)

      return {
        thang: month,
        tiepNhan: received,
        giaiQuyet: approved,
        tiLeHanDung: received > 0 ? Math.round((approved / received) * 100) : 0
      }
    })

    const tongTiepNhan = months.reduce((sum, item) => sum + item.tiepNhan, 0)
    const tongGiaiQuyet = months.reduce((sum, item) => sum + item.giaiQuyet, 0)

    return {
      nam: year,
      tongTiepNhan,
      tongGiaiQuyet,
      months
    }
  },

  // Lấy danh sách cán bộ
  getDanhSachCanBo: async () => CanBoDbModel.findAllOfficials(),

  // Dashboard quản lý dành cho cán bộ
  getDashboard: async (officialUserId) => {
    const [
      totalHotels,
      hotels,
      requestRows,
      requestStatusRows,
      todayTaskRows,
      documentRows
    ] = await Promise.all([
      CanBoDbModel.countHotels(),
      CanBoDbModel.findHotels(5000),
      CanBoDbModel.findRegistrationRequests({ limit: 30 }),
      CanBoDbModel.countRequestsByStatus(),
      CanBoDbModel.findTodayTasks(Number(officialUserId), 20),
      CanBoDbModel.findOfficialDocuments(20)
    ])

    const requests = requestRows.map((row) => ({
      id: row.id,
      status: row.status,
      statusLabel: mapStatusLabel(row.status),
      submittedAt: row.created_at,
      updatedAt: row.updated_at,
      requestType: row.request_type_name,
      businessName: row.business_name || 'Chưa cập nhật',
      businessAddress: row.business_address || 'Chưa cập nhật',
      officialNote: row.official_note,
      citizen: {
        fullName: row.citizen_name,
        phone: row.citizen_phone
      }
    }))

    const requestStatusSummary = requestStatusRows.map((row) => ({
      status: row.status,
      label: mapStatusLabel(row.status),
      count: row.count
    }))

    const todayTasks = todayTaskRows.map((row) => ({
      id: row.id,
      title: row.task_title,
      description: row.task_description,
      status: row.status,
      statusLabel: TASK_STATUS_MAP[row.status] || row.status,
      priority: row.priority,
      priorityLabel: TASK_PRIORITY_MAP[row.priority] || row.priority,
      dueDate: row.due_date,
      dueTime: row.due_time,
      sourceType: row.source_type,
      sourceId: row.source_id
    }))

    const documents = documentRows.map((row) => ({
      id: row.id,
      category: row.category,
      categoryLabel: DOCUMENT_CATEGORY_MAP[row.category] || row.category,
      title: row.title,
      summary: row.summary,
      documentNumber: row.document_number,
      issuedBy: row.issued_by,
      publishedAt: row.published_at,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      externalUrl: row.external_url,
      attachmentUrl: row.attachment_url,
      isPinned: row.is_pinned
    }))

    const statusCountMap = requestStatusSummary.reduce((acc, item) => {
      acc[item.status] = item.count
      return acc
    }, {})
    const totalRequests = requestStatusSummary.reduce((sum, item) => sum + Number(item.count || 0), 0)

    return {
      overview: {
        totalHotels,
        totalBusinesses: totalHotels,
        totalRequests,
        pendingRequests: statusCountMap.pending || 0,
        todayTasks: todayTasks.length
      },
      hotels,
      businesses: hotels,
      requests,
      requestStatusSummary,
      todayTasks,
      documents,
      aiFeature: {
        enabled: true,
        label: 'AI dự đoán xu hướng theo từng khách sạn (đã tích hợp)'
      }
    }
  }
}

export default CanBoService
