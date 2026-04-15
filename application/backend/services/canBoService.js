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

const ATTRIBUTE_LABELS = {
  hygiene: 'Vệ sinh',
  food: 'Đồ ăn',
  hotel: 'Khách sạn',
  location: 'Vị trí',
  room: 'Phòng ốc',
  service: 'Dịch vụ'
}

const HIGH_RISK_SCORE_THRESHOLD = 0.45
const WATCH_SCORE_THRESHOLD = 0.5
const NOT_MENTIONED_SCORE = 0.5
const UNKNOWN_AREA_LABEL = 'Chưa xác định'

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
  pos: 1,
  'tich cuc': 1,
  negative: 2,
  neg: 2,
  'tieu cuc': 2,
  none: 0,
  neutral: 0,
  'not mentioned': 0,
  notmentioned: 0,
  'not mention': 0,
  'khong de cap': 0,
  'khong danh gia': 0,
  'trung tinh': 0,
  unknown: 0
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

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null

  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return n
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

const roundOptional = (value, digits = 4) => {
  const n = toFiniteNumber(value)
  if (n === null) return null
  return round(n, digits)
}

const isScoreEqual = (value, target, epsilon = 1e-6) => {
  const n = toFiniteNumber(value)
  if (n === null) return false
  return Math.abs(n - target) <= epsilon
}

const normalizeModelInputText = (value) => String(value || '').trim().replace(/\s+/g, ' ')

// Các ký tự tiếng Việt hợp lệ (giống VN_CHARS trong Python training pipeline)
const VN_CHARS = 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệóòỏõọôốồổỗộơớờởỡợíìỉĩịúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÍÌỈĨỊÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ'

/**
 * Tiền xử lý văn bản matching đúng pipeline Python training:
 * lowercase → remove_html → remove_emoji → remove_url → remove_email
 * → remove_hashtags → remove_unnecessary_characters → normalize_whitespace
 *
 * NOTE: word_segment (VnCoreNLP) được mô phỏng thủ công bằng COMPOUND_WORDS bên dưới.
 */
const isEmojiCodepoint = (cp) => {
  if (cp === undefined) return false
  // Emoticons, Misc Pictographs, Supplemental Symbols, Transport (U+1F300–U+1FAFF)
  if (cp >= 0x1F300 && cp <= 0x1FAFF) return true
  // Misc Symbols and Dingbats (U+2600–U+27BF)
  if (cp >= 0x2600 && cp <= 0x27BF) return true
  // Enclosed Alphanumeric Supplement, flags (U+1F100–U+1F2FF)
  if (cp >= 0x1F100 && cp <= 0x1F2FF) return true
  // Variation Selectors (U+FE00–U+FEFF)
  if (cp >= 0xFE00 && cp <= 0xFEFF) return true
  // Supplemental Arrows, Misc Symbols (U+2B00–U+2BFF)
  if (cp >= 0x2B00 && cp <= 0x2BFF) return true
  // Common single-char emoji: copyright, registered, etc.
  if (cp === 0x00A9 || cp === 0x00AE || cp === 0x203C || cp === 0x2049) return true
  return false
}

const removeEmojiFromText = (text) =>
  Array.from(text)
    .map((char) => (isEmojiCodepoint(char.codePointAt(0)) ? ' ' : char))
    .join('')

/**
 * Tiền xử lý văn bản matching đúng pipeline Python training:
 * lowercase → remove_html → remove_emoji → remove_url → remove_email
 * → remove_hashtags → (remove_unnecessary_characters xử lý ở bước sau)
 *
 * Dùng codePointAt() thay vì \p{Extended_Pictographic} để tránh lỗi
 * double-escaping khi viết file (\\p thay vì \p làm regex thành no-op).
 */
const preprocessTextForModel = (rawText) => {
  let text = String(rawText || '').trim().toLowerCase()

  // 1. Xoá HTML tags (remove_html)
  text = text.replace(/<[^>]*>/g, '')

  // 2. Xoá emoji & symbol Unicode (remove_emoji) — dùng codepoint range check
  text = removeEmojiFromText(text)

  // 3. Xoá URL (remove_url)
  text = text.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_+.~#?&\/=]*)/g, '')

  // 4. Xoá email (remove_email)
  text = text.replace(/[^@\s]+@[^@\s]+\.[^@\s]+/g, '')

  // 5. Xoá hashtag #từ (remove_hashtags)
  text = text.replace(/#\S+/g, '')

  return text
}

const normalizeAspectToken = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const coerceClassPrediction = (value) => {
  const numberValue = Number(value)
  if ([0, 1, 2].includes(numberValue)) return numberValue

  const normalized = normalizeAspectToken(value)
  if (normalized in LABEL_TO_CLASS) return LABEL_TO_CLASS[normalized]

  return 0
}

const getDefinedValue = (values = []) => values.find((item) => {
  if (item === undefined || item === null) return false
  if (typeof item === 'string' && item.trim() === '') return false
  return true
})

const extractPredictionValue = (rawValue) => {
  if (Array.isArray(rawValue) && rawValue.length > 0) {
    return extractPredictionValue(rawValue[0])
  }

  if (rawValue && typeof rawValue === 'object') {
    const direct = getDefinedValue([
      rawValue.prediction,
      rawValue.class,
      rawValue.label,
      rawValue.sentiment,
      rawValue.value
    ])

    if (direct !== undefined) {
      if (direct && typeof direct === 'object') {
        return extractPredictionValue(direct)
      }
      return direct
    }
  }

  return rawValue
}

const extractConfidenceValue = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return null

  const direct = getDefinedValue([
    rawValue.confidence,
    rawValue.score,
    rawValue.probability,
    rawValue.prob,
    rawValue.conf
  ])

  if (direct !== undefined) return direct

  const nestedPrediction = rawValue.prediction
  if (nestedPrediction && typeof nestedPrediction === 'object') {
    const nested = getDefinedValue([
      nestedPrediction.confidence,
      nestedPrediction.score,
      nestedPrediction.probability,
      nestedPrediction.prob,
      nestedPrediction.conf
    ])
    if (nested !== undefined) return nested
  }

  return null
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

  const prediction = coerceClassPrediction(extractPredictionValue(rawValue))
  const confidenceRaw = extractConfidenceValue(rawValue)
  const confidenceNumber = toFiniteNumber(confidenceRaw)

  return {
    prediction,
    confidence: confidenceNumber === null ? 0 : normalizeScore(confidenceNumber)
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
  return NOT_MENTIONED_SCORE
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

const normalizeOptionalScore = (value) => {
  const n = toFiniteNumber(value)
  if (n === null) return null
  return Math.max(0, Math.min(1, n))
}

const normalizeSentimentValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'positive') return 'Positive'
  if (normalized === 'negative') return 'Negative'
  if (normalized === 'neutral') return 'Neutral'
  return null
}

const sentimentToUiLabel = (value) => {
  if (value === 'Positive') return 'Tích cực'
  if (value === 'Negative') return 'Tiêu cực'
  if (value === 'Neutral') return 'Trung tính'
  return 'Chưa phân loại'
}

const isWardLikeSegment = (value) => {
  const normalized = normalizeAspectToken(value).replace(/\./g, '').trim()
  return normalized.startsWith('phuong ') || normalized.startsWith('xa ') || normalized.startsWith('thi tran ')
}

const resolveAreaFromAddress = (address) => {
  const raw = String(address || '').trim()
  if (!raw || normalizeAspectToken(raw) === normalizeAspectToken('Chưa cập nhật')) {
    return {
      district: UNKNOWN_AREA_LABEL,
      city: UNKNOWN_AREA_LABEL
    }
  }

  const parts = raw
    .split(',')
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      district: UNKNOWN_AREA_LABEL,
      city: UNKNOWN_AREA_LABEL
    }
  }

  const city = parts[parts.length - 1] || UNKNOWN_AREA_LABEL
  let district = parts.length >= 2 ? parts[parts.length - 2] : UNKNOWN_AREA_LABEL

  if (parts.length >= 3 && isWardLikeSegment(district)) {
    district = parts[parts.length - 3]
  }

  return {
    district: district || UNKNOWN_AREA_LABEL,
    city
  }
}

const parseTopNegativeKeywords = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }

  const raw = String(value || '').trim()
  if (!raw) return []

  if (raw.startsWith('{') && raw.endsWith('}')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const summarizeRepresentativeReview = (value) => {
  const lines = String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  if (!lines.length) return ''
  return lines[0].replace(/^\(\d+\)\s*/, '').slice(0, 240)
}

const resolveRiskLevel = ({ hasAiData, overallScore, highRiskCount, warningCount }) => {
  if (!hasAiData) {
    return {
      key: 'unrated',
      label: 'Chưa phân tích'
    }
  }

  if (highRiskCount >= 2 || (overallScore !== null && overallScore < HIGH_RISK_SCORE_THRESHOLD)) {
    return {
      key: 'high',
      label: 'Nguy cơ cao'
    }
  }

  if (warningCount > 0 || (overallScore !== null && overallScore < WATCH_SCORE_THRESHOLD)) {
    return {
      key: 'watch',
      label: 'Cần theo dõi'
    }
  }

  return {
    key: 'stable',
    label: 'Ổn định'
  }
}

const buildAreaGroups = (items = [], areaField = 'district') => {
  const areaMap = new Map()

  for (const item of items) {
    const areaName = areaField === 'city' ? item.khuVuc.tinhThanh : item.khuVuc.quanHuyen

    if (!areaMap.has(areaName)) {
      areaMap.set(areaName, {
        khuVuc: areaName,
        tongCoSo: 0,
        coDuLieuAi: 0,
        coSoCanhBao: 0,
        tongDiem: 0,
        tongDiemCount: 0,
        byAspectWarning: new Map(),
        zeroNegativeCount: 0,
        zeroNotMentionedCount: 0,
        byAspectZeroNegative: new Map(),
        byAspectZeroNotMentioned: new Map()
      })
    }

    const bucket = areaMap.get(areaName)
    bucket.tongCoSo += 1

    if (item.coDuLieuAi) {
      bucket.coDuLieuAi += 1
      if (Number.isFinite(item.diemTongQuan)) {
        bucket.tongDiem += item.diemTongQuan
        bucket.tongDiemCount += 1
      }
    }

    if (item.canhBaoThuocTinh.length > 0) {
      bucket.coSoCanhBao += 1
    }

    for (const alert of item.canhBaoThuocTinh) {
      const current = bucket.byAspectWarning.get(alert.key) || {
        key: alert.key,
        label: alert.label,
        count: 0
      }
      current.count += 1
      bucket.byAspectWarning.set(alert.key, current)
    }

    for (const aspect of AI_ASPECTS) {
      const aspectScore = item.diemThanhPhan?.[aspect]
      const aspectLabel = ATTRIBUTE_LABELS[aspect] || aspect

      if (isScoreEqual(aspectScore, 0)) {
        bucket.zeroNegativeCount += 1
        const current = bucket.byAspectZeroNegative.get(aspect) || {
          key: aspect,
          label: aspectLabel,
          count: 0
        }
        current.count += 1
        bucket.byAspectZeroNegative.set(aspect, current)
        continue
      }

      if (isScoreEqual(aspectScore, NOT_MENTIONED_SCORE)) {
        bucket.zeroNotMentionedCount += 1
        const current = bucket.byAspectZeroNotMentioned.get(aspect) || {
          key: aspect,
          label: aspectLabel,
          count: 0
        }
        current.count += 1
        bucket.byAspectZeroNotMentioned.set(aspect, current)
      }
    }
  }

  return [...areaMap.values()]
    .map((item) => ({
      khuVuc: item.khuVuc,
      tongCoSo: item.tongCoSo,
      coDuLieuAi: item.coDuLieuAi,
      coSoCanhBao: item.coSoCanhBao,
      tiLeCanhBao: item.tongCoSo > 0 ? round((item.coSoCanhBao / item.tongCoSo) * 100, 2) : 0,
      diemTongQuanTrungBinh: item.tongDiemCount > 0 ? round(item.tongDiem / item.tongDiemCount, 4) : null,
      tongThuocTinh0TieuCuc: item.zeroNegativeCount,
      tongThuocTinh0KhongDeCap: item.zeroNotMentionedCount,
      thuocTinhCanhBaoNoiBat: [...item.byAspectWarning.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      thuocTinh0TieuCucNoiBat: [...item.byAspectZeroNegative.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      thuocTinh0KhongDeCapNoiBat: [...item.byAspectZeroNotMentioned.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
    }))
    .sort((a, b) => {
      if (b.coSoCanhBao !== a.coSoCanhBao) return b.coSoCanhBao - a.coSoCanhBao
      if (a.diemTongQuanTrungBinh === null) return 1
      if (b.diemTongQuanTrungBinh === null) return -1
      return a.diemTongQuanTrungBinh - b.diemTongQuanTrungBinh
    })
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

  getThongKeAiTheoCoSo: async ({ coSoId, businessId, fromDate, toDate, officialUserId }) => {
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
        score: item.count > 0 ? normalizeScore(item.scoreSum / item.count) : null,
        confidence: item.count > 0 ? normalizeScore(item.confidenceSum / item.count) : null,
        positive: item.positive,
        negative: item.negative,
        none: item.none,
        count: item.count
      }
      return acc
    }, {})

    const scores = {
      hygiene: aspectAverages.hygiene.score,
      food: aspectAverages.food.score,
      hotel: aspectAverages.hotel.score,
      location: aspectAverages.location.score,
      room: aspectAverages.room.score,
      service: aspectAverages.service.score
    }

    const totalPositive = AI_ASPECTS.reduce((sum, aspect) => sum + aspectAverages[aspect].positive, 0)
    const totalNegative = AI_ASPECTS.reduce((sum, aspect) => sum + aspectAverages[aspect].negative, 0)
    const sentimentLabel = deriveSentimentLabel({ totalPositive, totalNegative })

    const scoreEntries = AI_ASPECTS
      .map((aspect) => ({
        scoreType: aspect,
        scoreValue: scores[aspect]
      }))
      .filter((item) => toFiniteNumber(item.scoreValue) !== null)

    const [worstAttributeByScore] = scoreEntries
      .slice()
      .sort((a, b) => a.scoreValue - b.scoreValue)

    const [worstAttributeByNegativeCount] = AI_ASPECTS
      .map((aspect) => ({
        scoreType: aspect,
        negativeCount: aspectAverages[aspect].negative,
        scoreValue: scores[aspect]
      }))
      .sort((a, b) => {
        if (b.negativeCount !== a.negativeCount) return b.negativeCount - a.negativeCount
        const aScore = toFiniteNumber(a.scoreValue) ?? 2
        const bScore = toFiniteNumber(b.scoreValue) ?? 2
        return aScore - bScore
      })

    const worstAttribute = worstAttributeByScore
      || (worstAttributeByNegativeCount?.negativeCount > 0 ? worstAttributeByNegativeCount : null)
      || {
        scoreType: AI_ASPECTS[0],
        scoreValue: toFiniteNumber(scores[AI_ASPECTS[0]]) !== null ? scores[AI_ASPECTS[0]] : null
      }

    const focusAspects = worstAttribute?.scoreType ? [worstAttribute.scoreType] : AI_ASPECTS
    const rankedNegativeReviews = usableReviews
      .map((review, index) => {
        const prediction = perReviewPredictions[index]
        let severity = 0

        for (const aspect of focusAspects) {
          const value = prediction[aspect]?.prediction
          if (value === 2) severity += 2
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
        hygieneScore: scores.hygiene,
        foodScore: scores.food,
        hotelScore: scores.hotel,
        locationScore: scores.location,
        roomScore: scores.room,
        serviceScore: scores.service,
        sentimentLabel
      })

      scoreHistoryRows = await CanBoDbModel.insertHotelAiScoreHistoryEntries(normalizedHotelId, scoreEntries)

      insightRow = await CanBoDbModel.insertHotelInsightSummary({
        hotelId: normalizedHotelId,
        attributeAffected: worstAttribute?.scoreType || AI_ASPECTS[0],
        topNegativeKeywords,
        representativeReviews: representativeReviewsText
      })

      const redAspects = AI_ASPECTS.filter((aspect) => {
        const score = toFiniteNumber(scores[aspect])
        return score !== null && score < 0.45
      })
      if (redAspects.length >= 2 && officialUserId) {
        await CanBoDbModel.createOfficialDailyTask({
          officialUserId: officialUserId,
          title: `Cảnh báo chất lượng cơ sở: ${hotel.name}`,
          description: `Có ${redAspects.length} thuộc tính bị AI chấm dưới mức an toàn: ${redAspects.map(a => ATTRIBUTE_LABELS[a]).join(', ')}. Cần thanh tra gấp.`,
          priority: 'high',
          sourceType: 'ai_alert',
          sourceId: hotel.id
        }).catch(err => console.error("Lỗi tạo task cảnh báo:", err))
      }
    } catch (error) {
      if (error?.code === '42P01') {
        throw createMissingHotelTablesError()
      }
      throw error
    }

    const overallScore = scoreEntries.length > 0
      ? normalizeScore(average(scoreEntries.map((item) => item.scoreValue)))
      : null
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
        diemTongQuan: roundOptional(overallScore, 4),
        diemThanhPhan: {
          hygiene: roundOptional(scores.hygiene, 4),
          food: roundOptional(scores.food, 4),
          hotel: roundOptional(scores.hotel, 4),
          location: roundOptional(scores.location, 4),
          room: roundOptional(scores.room, 4),
          service: roundOptional(scores.service, 4)
        },
        chiTietAspect: AI_ASPECTS.reduce((acc, aspect) => {
          acc[aspect] = {
            diem: roundOptional(aspectAverages[aspect].score, 4),
            doTinCayTrungBinh: roundOptional(aspectAverages[aspect].confidence, 4),
            positive: aspectAverages[aspect].positive,
            negative: aspectAverages[aspect].negative,
            none: aspectAverages[aspect].none
          }
          return acc
        }, {}),
        insight: {
          thuocTinhAnhHuongNhat: {
            key: worstAttribute?.scoreType || AI_ASPECTS[0],
            label: ATTRIBUTE_LABELS[worstAttribute?.scoreType || AI_ASPECTS[0]] || (worstAttribute?.scoreType || AI_ASPECTS[0]),
            score: roundOptional(worstAttribute?.scoreValue, 4)
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

  getTongHopThongKeAi: async ({ chiCanhBao = false } = {}) => {
    let rows

    try {
      rows = await CanBoDbModel.findHotelsWithLatestAiSummary(5000)
    } catch (error) {
      if (isMissingTableError(error)) {
        throw createMissingHotelTablesError()
      }
      throw error
    }

    const hotels = rows.map((row) => {
      const insightAttribute = AI_ASPECTS.includes(row.attribute_affected)
        ? row.attribute_affected
        : null

      const sentimentLabel = normalizeSentimentValue(row.sentiment_label)

      const diemThanhPhan = AI_ASPECTS.reduce((acc, aspect) => {
        const score = normalizeOptionalScore(row[`${aspect}_score`])
        acc[aspect] = score === null ? null : round(score, 4)
        return acc
      }, {})

      const scoreValues = Object.values(diemThanhPhan).filter((value) => value !== null)
      const coDuLieuAi = scoreValues.length > 0
      const diemTongQuan = coDuLieuAi ? round(average(scoreValues), 4) : null
      const khuVuc = resolveAreaFromAddress(row.address)

      const canhBaoThuocTinh = AI_ASPECTS
        .map((aspect) => {
          const score = diemThanhPhan[aspect]
          if (score === null || score >= WATCH_SCORE_THRESHOLD) return null

          const isHighRisk = score < HIGH_RISK_SCORE_THRESHOLD
          return {
            key: aspect,
            label: ATTRIBUTE_LABELS[aspect] || aspect,
            score,
            mucDoKey: isHighRisk ? 'high' : 'watch',
            mucDo: isHighRisk ? 'Nguy cơ cao' : 'Cần theo dõi'
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)

      const highRiskCount = canhBaoThuocTinh.filter((item) => item.mucDoKey === 'high').length
      const riskMeta = resolveRiskLevel({
        hasAiData: coDuLieuAi,
        overallScore: diemTongQuan,
        highRiskCount,
        warningCount: canhBaoThuocTinh.length
      })

      const resolvedInsightAttribute = insightAttribute || canhBaoThuocTinh[0]?.key || null

      return {
        id: row.id,
        sourceHotelId: row.source_hotel_id,
        tenCoSo: row.name || 'Chưa cập nhật',
        diaChi: row.address || 'Chưa cập nhật',
        khuVuc: {
          quanHuyen: khuVuc.district,
          tinhThanh: khuVuc.city
        },
        coDuLieuAi,
        sentimentLabel: sentimentLabel || 'Unknown',
        sentimentHienThi: sentimentToUiLabel(sentimentLabel),
        diemTongQuan,
        diemThanhPhan,
        mucDoRuiRoKey: riskMeta.key,
        mucDoRuiRo: riskMeta.label,
        canhBaoThuocTinh,
        insight: {
          thuocTinhAnhHuongNhat: resolvedInsightAttribute
            ? {
                key: resolvedInsightAttribute,
                label: ATTRIBUTE_LABELS[resolvedInsightAttribute] || resolvedInsightAttribute
              }
            : null,
          topTuKhoaTieuCuc: parseTopNegativeKeywords(row.top_negative_keywords).slice(0, 8),
          reviewDaiDienTomTat: summarizeRepresentativeReview(row.representative_reviews)
        },
        thoiDiemDanhGia: row.last_evaluated_at,
        thoiDiemTongHopInsight: row.insight_generated_at
      }
    })

    const hotelsAfterFilter = chiCanhBao
      ? hotels.filter((item) => item.canhBaoThuocTinh.length > 0)
      : hotels

    const sentimentSummary = {
      positive: 0,
      negative: 0,
      neutral: 0,
      unknown: 0
    }

    const riskSummary = {
      high: 0,
      watch: 0,
      stable: 0,
      unrated: 0
    }

    for (const hotel of hotels) {
      if (hotel.sentimentLabel === 'Positive') sentimentSummary.positive += 1
      else if (hotel.sentimentLabel === 'Negative') sentimentSummary.negative += 1
      else if (hotel.sentimentLabel === 'Neutral') sentimentSummary.neutral += 1
      else sentimentSummary.unknown += 1

      riskSummary[hotel.mucDoRuiRoKey] += 1
    }

    const hotelsWithAi = hotels.filter((item) => item.coDuLieuAi)
    const hotelsWithWarning = hotels.filter((item) => item.canhBaoThuocTinh.length > 0)

    const tongHopPhanLoaiDiem0 = hotels.reduce((acc, hotel) => {
      for (const aspect of AI_ASPECTS) {
        const score = hotel.diemThanhPhan?.[aspect]
        if (isScoreEqual(score, 0)) acc.tongThuocTinh0TieuCuc += 1
        else if (isScoreEqual(score, NOT_MENTIONED_SCORE)) acc.tongThuocTinh0KhongDeCap += 1
      }

      return acc
    }, {
      tongThuocTinh0TieuCuc: 0,
      tongThuocTinh0KhongDeCap: 0
    })

    const thongKeThuocTinh = AI_ASPECTS
      .map((aspect) => {
        const scoreValues = hotels
          .map((item) => item.diemThanhPhan[aspect])
          .filter((value) => value !== null)

        const soCoSoDiem0TieuCuc = hotels
          .filter((item) => isScoreEqual(item.diemThanhPhan?.[aspect], 0))
          .length

        const soCoSoDiem0KhongDeCap = hotels
          .filter((item) => isScoreEqual(item.diemThanhPhan?.[aspect], NOT_MENTIONED_SCORE))
          .length

        const soCoSoNguyCoCao = scoreValues.filter((value) => value < HIGH_RISK_SCORE_THRESHOLD).length
        const soCoSoCanTheoDoi = scoreValues.filter((value) => value >= HIGH_RISK_SCORE_THRESHOLD && value < WATCH_SCORE_THRESHOLD).length
        const soCoSoOnDinh = scoreValues.filter((value) => value >= WATCH_SCORE_THRESHOLD).length

        return {
          key: aspect,
          label: ATTRIBUTE_LABELS[aspect] || aspect,
          diemTrungBinh: scoreValues.length ? round(average(scoreValues), 4) : null,
          tongCoSoDaPhanTich: scoreValues.length,
          soCoSoNguyCoCao,
          soCoSoCanTheoDoi,
          soCoSoOnDinh,
          soCoSoDiem0TieuCuc,
          soCoSoDiem0KhongDeCap,
          tongCoSoCanhBao: soCoSoNguyCoCao + soCoSoCanTheoDoi
        }
      })
      .sort((a, b) => {
        if (b.tongCoSoCanhBao !== a.tongCoSoCanhBao) return b.tongCoSoCanhBao - a.tongCoSoCanhBao
        if (a.diemTrungBinh === null) return 1
        if (b.diemTrungBinh === null) return -1
        return a.diemTrungBinh - b.diemTrungBinh
      })

    return {
      generatedAt: new Date().toISOString(),
      nguongCanhBao: {
        nguyCoCao: HIGH_RISK_SCORE_THRESHOLD,
        canTheoDoi: WATCH_SCORE_THRESHOLD
      },
      boLoc: {
        chiCanhBao: Boolean(chiCanhBao),
        tongSoCoSoTruocLoc: hotels.length,
        tongSoCoSoSauLoc: hotelsAfterFilter.length
      },
      tongQuan: {
        tongCoSo: hotels.length,
        coSoDaPhanTichAi: hotelsWithAi.length,
        tyLePhuAi: hotels.length > 0 ? round((hotelsWithAi.length / hotels.length) * 100, 2) : 0,
        coSoCoCanhBao: hotelsWithWarning.length,
        diemTongQuanTrungBinh: hotelsWithAi.length > 0
          ? round(average(hotelsWithAi.map((item) => item.diemTongQuan)), 4)
          : null,
        sentiment: sentimentSummary,
        mucDoRuiRo: riskSummary,
        phanLoaiDiem0: tongHopPhanLoaiDiem0
      },
      thongKeThuocTinh,
      thuocTinhCanhBaoNoiBat: thongKeThuocTinh.slice(0, 3),
      nhomTheoKhuVuc: {
        quanHuyen: buildAreaGroups(hotelsAfterFilter, 'district'),
        tinhThanh: buildAreaGroups(hotelsAfterFilter, 'city')
      },
      danhSachCoSo: hotelsAfterFilter
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

    // --- Tự động tạo bản ghi cơ sở kinh doanh khi hồ sơ được phê duyệt ---
    if (normalizedStatus === 'approved') {
      try {
        const data = hoSo.data || {}
        const hotelName = (
          data.tenCoSoKinhDoanh ||
          data.tenCoSo ||
          data.business_name ||
          data.name ||
          hoSo.business_name ||
          'Cơ sở kinh doanh'
        )
        const address = (
          data.diaChiDangKy ||
          data.diaChi ||
          data.address ||
          hoSo.business_address ||
          null
        )
        const province = data.tinhThanh || data.province || 'Chưa cập nhật'

        await CanBoDbModel.upsertApprovedBusiness({
          registrationRequestId: Number(id),
          hotelName,
          address,
          province
        })
      } catch (businessErr) {
        // Không throw — việc tạo cơ sở thất bại không nên rollback việc cập nhật trạng thái
        console.error('[xuLyHoSo] Failed to auto-create business record:', businessErr?.message)
      }
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
  },

  testAiModel: async (rawText, rating) => {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      const err = new Error('Vui lòng nhập nội dung review để chạy mô hình.')
      err.statusCode = 400
      throw err
    }

    // --- Bước 1: Tiền xử lý văn bản theo đúng pipeline Python training ---
    // Pipeline Python (VietnameseTextPreprocessor):
    //   lowercase → remove_html → remove_emoji → remove_url → remove_email
    //   → remove_hashtags → remove_unnecessary_characters → word_segment (VnCoreNLP)
    //
    // word_segment được mô phỏng bằng COMPOUND_WORDS (thay từ ghép thành token_underscore)
    // remove_emoji ← đây là bước trước đây bị THIẾU khiến icon/emoji không xử lý được

    const COMPOUND_WORDS = [
      // === CỤM TỪ 3+ từ (ưu tiên match trước) ===
      ['vệ sinh an toàn', 'vệ_sinh_an_toàn'],
      ['trang thiết bị', 'trang_thiết_bị'],
      ['đồ ăn thức uống', 'đồ_ăn_thức_uống'],
      ['hồ chí minh', 'hồ_chí_minh'],
      ['nhà vệ sinh', 'nhà_vệ_sinh'],
      ['bãi đỗ xe', 'bãi_đỗ_xe'],
      ['bãi đậu xe', 'bãi_đậu_xe'],
      ['tầm nhìn ra biển', 'tầm_nhìn_ra_biển'],

      // === CHẤT LƯỢNG / TÍNH TỪ ĐÁNH GIÁ ===
      ['tuyệt vời', 'tuyệt_vời'],
      ['hợp lý', 'hợp_lý'],
      ['thoải mái', 'thoải_mái'],
      ['thân thiện', 'thân_thiện'],
      ['nhiệt tình', 'nhiệt_tình'],
      ['chú ý', 'chú_ý'],
      ['lịch sự', 'lịch_sự'],
      ['chuyên nghiệp', 'chuyên_nghiệp'],
      ['chu đáo', 'chu_đáo'],
      ['tận tâm', 'tận_tâm'],
      ['tận tình', 'tận_tình'],
      ['ân cần', 'ân_cần'],
      ['niềm nở', 'niềm_nở'],
      ['vui vẻ', 'vui_vẻ'],
      ['thú vị', 'thú_vị'],
      ['hài lòng', 'hài_lòng'],
      ['tuyệt hảo', 'tuyệt_hảo'],
      ['hoàn hảo', 'hoàn_hảo'],
      ['xuất sắc', 'xuất_sắc'],
      ['tốt bụng', 'tốt_bụng'],
      ['cẩn thận', 'cẩn_thận'],
      ['tiện lợi', 'tiện_lợi'],
      ['thoáng mát', 'thoáng_mát'],
      ['sang trọng', 'sang_trọng'],
      ['hiện đại', 'hiện_đại'],
      ['bình thường', 'bình_thường'],
      ['trung bình', 'trung_bình'],
      ['kém chất lượng', 'kém_chất_lượng'],
      ['tệ hại', 'tệ_hại'],
      ['thất vọng', 'thất_vọng'],
      ['đáng tiếc', 'đáng_tiếc'],
      ['đáng kể', 'đáng_kể'],
      ['đáng tiền', 'đáng_tiền'],
      ['xứng đáng', 'xứng_đáng'],
      ['rộng rãi', 'rộng_rãi'],
      ['chật hẹp', 'chật_hẹp'],
      ['yên tĩnh', 'yên_tĩnh'],
      ['ồn ào', 'ồn_ào'],
      ['an toàn', 'an_toàn'],
      ['an ninh', 'an_ninh'],

      // === NHÂN VIÊN / DỊCH VỤ ===
      ['nhân viên', 'nhân_viên'],
      ['phục vụ', 'phục_vụ'],
      ['dịch vụ', 'dịch_vụ'],
      ['lễ tân', 'lễ_tân'],
      ['tiếp tân', 'tiếp_tân'],
      ['hướng dẫn', 'hướng_dẫn'],
      ['hỗ trợ', 'hỗ_trợ'],
      ['tư vấn', 'tư_vấn'],
      ['phản hồi', 'phản_hồi'],
      ['đặt phòng', 'đặt_phòng'],
      ['nhận phòng', 'nhận_phòng'],
      ['trả phòng', 'trả_phòng'],
      ['check in', 'check_in'],
      ['check out', 'check_out'],

      // === PHÒNG / CƠ SỞ VẬT CHẤT ===
      ['khách sạn', 'khách_sạn'],
      ['nhà hàng', 'nhà_hàng'],
      ['nhà nghỉ', 'nhà_nghỉ'],
      ['resort', 'resort'],
      ['phòng ốc', 'phòng_ốc'],
      ['phòng tắm', 'phòng_tắm'],
      ['phòng ngủ', 'phòng_ngủ'],
      ['phòng đơn', 'phòng_đơn'],
      ['phòng đôi', 'phòng_đôi'],
      ['phòng suite', 'phòng_suite'],
      ['tầng trệt', 'tầng_trệt'],
      ['thang máy', 'thang_máy'],
      ['máy lạnh', 'máy_lạnh'],
      ['điều hòa', 'điều_hòa'],
      ['điều hoà', 'điều_hoà'],
      ['tivi', 'tivi'],
      ['hồ bơi', 'hồ_bơi'],
      ['bể bơi', 'bể_bơi'],
      ['tiện nghi', 'tiện_nghi'],
      ['trang thiết bị', 'trang_thiết_bị'],
      ['nội thất', 'nội_thất'],
      ['giường ngủ', 'giường_ngủ'],
      ['chăn gối', 'chăn_gối'],
      ['phòng tắm', 'phòng_tắm'],
      ['vệ sinh', 'vệ_sinh'],
      ['sạch sẽ', 'sạch_sẽ'],
      ['cơ sở', 'cơ_sở'],

      // === ĐỒ ĂN / UỐNG ===
      ['đồ ăn', 'đồ_ăn'],
      ['thức ăn', 'thức_ăn'],
      ['ăn uống', 'ăn_uống'],
      ['đồ ăn thức uống', 'đồ_ăn_thức_uống'],
      ['ăn sáng', 'ăn_sáng'],
      ['bữa sáng', 'bữa_sáng'],
      ['bữa trưa', 'bữa_trưa'],
      ['bữa tối', 'bữa_tối'],
      ['bữa ăn', 'bữa_ăn'],
      ['thực đơn', 'thực_đơn'],
      ['đồ uống', 'đồ_uống'],
      ['cà phê', 'cà_phê'],
      ['hải sản', 'hải_sản'],
      ['chất lượng', 'chất_lượng'],

      // === VỊ TRÍ / ĐỊA ĐIỂM ===
      ['vị trí', 'vị_trí'],
      ['trung tâm', 'trung_tâm'],
      ['không gian', 'không_gian'],
      ['khu vực', 'khu_vực'],
      ['tầm nhìn', 'tầm_nhìn'],
      ['view biển', 'view_biển'],
      ['gần biển', 'gần_biển'],
      ['bãi biển', 'bãi_biển'],
      ['biển xanh', 'biển_xanh'],
      ['bãi đỗ xe', 'bãi_đỗ_xe'],

      // === ĐỊA DANH THƯỜNG GẶP TRONG REVIEW ===
      ['đà nẵng', 'đà_nẵng'],
      ['hà nội', 'hà_nội'],
      ['hội an', 'hội_an'],
      ['nha trang', 'nha_trang'],
      ['đà lạt', 'đà_lạt'],
      ['phú quốc', 'phú_quốc'],
      ['vũng tàu', 'vũng_tàu'],
      ['cần thơ', 'cần_thơ'],
      ['hải phòng', 'hải_phòng'],
      ['hồ chí minh', 'hồ_chí_minh'],
      ['sài gòn', 'sài_gòn'],
      ['phan thiết', 'phan_thiết'],
      ['bình dương', 'bình_dương'],
      ['mũi né', 'mũi_né'],

      // === GIÁ CẢ / GIÁ TRỊ ===
      ['giá cả', 'giá_cả'],
      ['giá tiền', 'giá_tiền'],
      ['giá rẻ', 'giá_rẻ'],
      ['giá trị', 'giá_trị'],
      ['giá phòng', 'giá_phòng'],
      ['giá tốt', 'giá_tốt'],
      ['chi phí', 'chi_phí'],
      ['đáng tiền', 'đáng_tiền'],

      // === THỜI GIAN / CHUNG ===
      ['thời gian', 'thời_gian'],
      ['thường xuyên', 'thường_xuyên'],
      ['lần sau', 'lần_sau'],
      ['lần này', 'lần_này'],
      ['đặc biệt', 'đặc_biệt'],
      ['nói chung', 'nói_chung'],
      ['nhìn chung', 'nhìn_chung'],
      ['tổng thể', 'tổng_thể'],
      ['tổng quan', 'tổng_quan'],
      ['so với', 'so_với'],
      ['phù hợp', 'phù_hợp'],
      ['thuận tiện', 'thuận_tiện'],
      ['trải nghiệm', 'trải_nghiệm'],
      ['yêu thích', 'yêu_thích'],
      ['chỗ ở', 'chỗ_ở'],
      ['nơi ở', 'nơi_ở'],
      ['kỳ nghỉ', 'kỳ_nghỉ'],
      ['kỳ nghỉ dưỡng', 'kỳ_nghỉ_dưỡng'],
      ['du lịch', 'du_lịch'],
      ['tham quan', 'tham_quan'],
      ['quay lại', 'quay_lại'],
      ['trở lại', 'trở_lại'],
      ['giới thiệu', 'giới_thiệu'],
      ['khuyến khích', 'khuyến_khích'],
      ['khuyến mãi', 'khuyến_mãi'],
      ['ưu đãi', 'ưu_đãi']
    ]

    // Bước 1a: Áp dụng các bước cleaning giống Python (lowercase, emoji, html, url, email, hashtag)
    let processedText = preprocessTextForModel(rawText)

    // Bước 1b: Mô phỏng VnCoreNLP word segmentation — thay compound words bằng token_underscore
    for (const [phrase, token] of COMPOUND_WORDS) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      processedText = processedText.replace(new RegExp(escaped, 'gi'), token)
    }

    // Bước 1c: remove_unnecessary_characters — chỉ giữ chữ cái (kể cả tiếng Việt), số, khoảng trắng, underscore
    // Giống hệt: re.sub(fr"[^\sa-zA-Z0-9{VN_CHARS}]", ' ', text) trong Python
    // NOTE: giữ _ vì là token từ ghép đã segment ở bước trên
    processedText = processedText
      .replace(new RegExp(`[^\\sa-zA-Z0-9_${VN_CHARS}]`, 'g'), ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // --- Bước 2: Gọi AI model ---
    const endpointUrl = buildAiEndpointUrl()
    let rawPredictions = null

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [processedText] }),
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText)
        const err = new Error(`AI endpoint error: ${response.status} – ${errText}`)
        err.statusCode = 502
        throw err
      }

      const aiPayload = await response.json()
      const predictions = Array.isArray(aiPayload?.predictions) ? aiPayload.predictions : null

      if (predictions && predictions.length > 0) {
        rawPredictions = normalizeAiResponseRow(predictions[0] || {})
      }
    } catch (fetchErr) {
      if (fetchErr.statusCode) throw fetchErr
      const err = new Error(`Không kết nối được tới AI model: ${fetchErr.message}`)
      err.statusCode = 503
      throw err
    }

    // --- Bước 3: Tính điểm ---
    const aspects = {}
    for (const aspect of AI_ASPECTS) {
      const { prediction, confidence } = rawPredictions?.[aspect] ?? { prediction: 0, confidence: 0 }
      aspects[aspect] = {
        label: ATTRIBUTE_LABELS[aspect],
        prediction,
        bucket: classToBucket(prediction),
        score: classToScore(prediction),
        confidence: round(confidence, 3)
      }
    }

    const allScores = AI_ASPECTS.map((a) => classToScore(rawPredictions?.[a]?.prediction ?? 0))
    const scoreValues = allScores.filter((score) => toFiniteNumber(score) !== null)
    const overallScore = scoreValues.length > 0 ? round(average(scoreValues), 4) : null

    const posCount = AI_ASPECTS.filter((a) => classToBucket(rawPredictions?.[a]?.prediction) === 'positive').length
    const negCount = AI_ASPECTS.filter((a) => classToBucket(rawPredictions?.[a]?.prediction) === 'negative').length
    const sentimentLabel = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral'

    return {
      originalText: rawText,
      processedText,
      rating: Number(rating) || null,
      aspects,
      overallScore,
      sentimentLabel,
      aiEndpoint: endpointUrl
    }
  }
}

export default CanBoService
