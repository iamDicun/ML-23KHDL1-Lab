import { useCallback, useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { apiClient } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const DEFAULT_HIGH_RISK_THRESHOLD = 0.45
const DEFAULT_WATCH_THRESHOLD = 0.5
const NOT_MENTIONED_SCORE = 0.5

const RISK_PRIORITY = {
  high: 0,
  watch: 1,
  stable: 2,
  unrated: 3
}

const RISK_TONE_BY_KEY = {
  high: 'border-red-200 bg-red-50 text-red-700',
  watch: 'border-amber-200 bg-amber-50 text-amber-700',
  stable: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  unrated: 'border-gray-200 bg-gray-50 text-gray-700'
}

const QUICK_GUIDE_ITEMS = [
  {
    title: 'Bước 1: Chọn phạm vi (tuỳ chọn)',
    description: 'Mặc định hiển thị tất cả cơ sở. Nếu cần, chọn theo phường tại Đà Nẵng.'
  },
  {
    title: 'Bước 2: Xem đúng chỉ số phân loại',
    description: 'Toàn bộ số liệu bên dưới dùng cùng một tập dữ liệu sau lọc, không trộn nhiều cách tính.'
  },
  {
    title: 'Bước 3: Kiểm tra cơ sở ưu tiên',
    description: 'Khối Cơ sở cần kiểm tra chỉ hiển thị nơi có cảnh báo và thuộc tính cần kiểm tra cụ thể.'
  }
]

const formatAiScore = (value) => {
  if (value === null || value === undefined || value === '') return 'Chưa có'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Chưa có'
  return parsed.toFixed(4)
}

const toPercent = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, Math.round(parsed * 100)))
}

const formatDateTime = (value) => {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return date.toLocaleString('vi-VN')
}

const escapeCsvValue = (value) => {
  const normalized = String(value ?? '')
  if (normalized.includes(',') || normalized.includes('"') || normalized.includes('\n')) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

const makeFileSafeName = (value = '') => {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

const escapeHtmlForPdf = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const calcAverage = (values = []) => {
  if (!values.length) return null
  return values.reduce((sum, item) => sum + Number(item), 0) / values.length
}

const toFiniteScoreOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const isScoreEqual = (value, target, epsilon = 1e-6) => {
  const parsed = toFiniteScoreOrNull(value)
  if (parsed === null) return false
  return Math.abs(parsed - target) <= epsilon
}

const normalizeWardLabel = (segment = '') => {
  const raw = String(segment || '').trim().replace(/\s+/g, ' ')
  if (!raw) return ''

  if (/^phường\s+/i.test(raw)) return raw
  if (/^p\.?\s*/i.test(raw)) return raw.replace(/^p\.?\s*/i, 'Phường ')

  return ''
}

const extractWardFromAddress = (address = '') => {
  const raw = String(address || '').trim()
  if (!raw) return ''

  const parts = raw.split(',').map((item) => item.trim()).filter(Boolean)
  for (const part of parts) {
    const normalizedWard = normalizeWardLabel(part)
    if (normalizedWard) return normalizedWard
  }

  return ''
}

const isDaNangAddress = (address = '') => {
  const normalized = String(address || '').toLowerCase()
  return normalized.includes('đà nẵng') || normalized.includes('da nang')
}

const calcSummaryFromItems = (items = []) => {
  const total = items.length
  const analyzed = items.filter((item) => item.coDuLieuAi).length
  const warning = items.filter((item) => item.canhBaoThuocTinh.length > 0).length

  const scoreValues = items
    .map((item) => toFiniteScoreOrNull(item.diemTongQuan))
    .filter((value) => value !== null)

  const avgScore = scoreValues.length
    ? scoreValues.reduce((sum, value) => sum + Number(value), 0) / scoreValues.length
    : null

  const riskCount = {
    high: items.filter((item) => item.mucDoRuiRoKey === 'high').length,
    watch: items.filter((item) => item.mucDoRuiRoKey === 'watch').length,
    stable: items.filter((item) => item.mucDoRuiRoKey === 'stable').length,
    unrated: items.filter((item) => item.mucDoRuiRoKey === 'unrated').length
  }

  return {
    total,
    analyzed,
    warning,
    avgScore,
    aiCoveragePercent: total > 0 ? Math.round((analyzed / total) * 100) : 0,
    riskCount
  }
}

const getWorstAlertScore = (alerts = []) => {
  if (!alerts.length) return 2
  return Math.min(...alerts.map((item) => Number(item.score)).filter((item) => Number.isFinite(item)))
}

const compareBusinessesByPriority = (a, b) => {
  const riskDiff = (RISK_PRIORITY[a.mucDoRuiRoKey] ?? 99) - (RISK_PRIORITY[b.mucDoRuiRoKey] ?? 99)
  if (riskDiff !== 0) return riskDiff

  const aHighCount = a.canhBaoThuocTinh.filter((item) => item.mucDoKey === 'high').length
  const bHighCount = b.canhBaoThuocTinh.filter((item) => item.mucDoKey === 'high').length
  if (bHighCount !== aHighCount) return bHighCount - aHighCount

  const worstScoreDiff = getWorstAlertScore(a.canhBaoThuocTinh) - getWorstAlertScore(b.canhBaoThuocTinh)
  if (worstScoreDiff !== 0) return worstScoreDiff

  const warningCountDiff = b.canhBaoThuocTinh.length - a.canhBaoThuocTinh.length
  if (warningCountDiff !== 0) return warningCountDiff

  return String(a.tenCoSo || '').localeCompare(String(b.tenCoSo || ''), 'vi')
}

const resolvePrimaryViolationAlert = (alerts = []) => {
  const normalizedAlerts = alerts
    .map((item) => {
      const score = toFiniteScoreOrNull(item?.score)
      if (score === null) return null

      return {
        ...item,
        score
      }
    })
    .filter(Boolean)

  if (!normalizedAlerts.length) return null

  normalizedAlerts.sort((a, b) => {
    const aPriority = a.mucDoKey === 'high' ? 0 : 1
    const bPriority = b.mucDoKey === 'high' ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.score - b.score
  })

  return normalizedAlerts[0]
}

const extractEvidenceFromBusiness = (business) => {
  const evidenceRows = []

  const reviewSummary = String(business?.insight?.reviewDaiDienTomTat || '').trim()
  if (reviewSummary) {
    evidenceRows.push(reviewSummary)
  }

  const negativeKeywords = Array.isArray(business?.insight?.topTuKhoaTieuCuc)
    ? business.insight.topTuKhoaTieuCuc
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    : []

  if (negativeKeywords.length) {
    evidenceRows.push(`Từ khóa tiêu cực được AI trích xuất: ${negativeKeywords.join(', ')}`)
  }

  return evidenceRows
}

const formatAdministrativeDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'ngày ... tháng ... năm ...'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `ngày ${day} tháng ${month} năm ${year}`
}

const buildSupervisionTemplatePdfHtml = ({ business, violationAlert, evidenceRows, deadlineDays, generatedAt }) => {
  const businessName = String(business?.tenCoSo || 'Chưa cập nhật').trim() || 'Chưa cập nhật'
  const businessAddress = String(business?.diaChi || 'Chưa cập nhật').trim() || 'Chưa cập nhật'
  const criteriaName = String(violationAlert?.label || 'Chưa xác định').trim() || 'Chưa xác định'
  const criteriaScore = formatAiScore(violationAlert?.score)
  const evidenceLines = evidenceRows.length
    ? evidenceRows
    : ['(Hệ thống chưa trích xuất được phản ánh đại diện dạng văn bản trong kỳ tổng hợp hiện tại.)']

  const evidenceListHtml = evidenceLines
    .map((item) => `<li style="margin-bottom: 6px;">${escapeHtmlForPdf(item)}</li>`)
    .join('')

  return `
    <div
      style="
        width: 794px;
        padding: 42px 48px 52px;
        background: #ffffff;
        color: #111827;
        font-family: 'Times New Roman', Times, serif;
        font-size: 14px;
        line-height: 1.6;
        word-break: break-word;
      "
    >
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; padding-right: 12px;">
            <div style="font-weight: 700; text-transform: uppercase;">BỘ VĂN HÓA, THỂ THAO VÀ DU LỊCH</div>
            <div style="font-weight: 700; text-transform: uppercase;">SỞ DU LỊCH THÀNH PHỐ ĐÀ NẴNG</div>
            <div style="margin-top: 8px; font-weight: 700;">Số: ......../CV-SDL</div>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; padding-left: 12px;">
            <div style="font-weight: 700; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div style="font-weight: 700;">Độc lập - Tự do - Hạnh phúc</div>
            <div style="width: 180px; margin: 2px auto 0; border-top: 1px solid #111827;"></div>
            <div style="margin-top: 10px; text-align: right; font-style: italic;">
              ${escapeHtmlForPdf(`Đà Nẵng, ${formatAdministrativeDate(generatedAt)}`)}
            </div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 18px; text-align: center;">
        <div style="font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px;">CÔNG VĂN</div>
        <div style="margin-top: 5px; font-weight: 700;">
          V/v yêu cầu giải trình và khắc phục dấu hiệu vi phạm chất lượng dịch vụ du lịch
        </div>
      </div>

      <div style="margin-top: 18px; text-align: justify;">
        <div><span style="font-weight: 700;">Kính gửi:</span> ${escapeHtmlForPdf(businessName)}</div>
        <div><span style="font-weight: 700;">Địa chỉ:</span> ${escapeHtmlForPdf(businessAddress)}</div>

        <p style="margin: 10px 0 8px; text-indent: 36px;">
          Căn cứ kết quả giám sát phản hồi người dân từ hệ thống AI của cơ quan quản lý nhà nước.
        </p>
        <p style="margin: 0 0 10px; text-indent: 36px;">
          Qua rà soát dữ liệu gần nhất cho thấy cơ sở ${escapeHtmlForPdf(businessName)} có dấu hiệu vi phạm chất lượng dịch vụ.
        </p>

        <div style="font-weight: 700; margin-top: 6px;">Tiêu chí vi phạm mức Báo động:</div>
        <div style="margin-top: 4px; padding-left: 18px;">
          - ${escapeHtmlForPdf(criteriaName)} (Điểm AI đánh giá: ${escapeHtmlForPdf(criteriaScore)}/1.0).
        </div>

        <div style="font-weight: 700; margin-top: 10px;">Bằng chứng trích xuất (phản ánh thực tế từ khách hàng đã qua chọn lọc):</div>
        <ol style="margin: 6px 0 0 20px; padding-left: 16px;">
          ${evidenceListHtml}
        </ol>

        <div style="font-weight: 700; margin-top: 10px;">Yêu cầu cơ sở khẩn trương thực hiện:</div>
        <ol style="margin: 6px 0 0 20px; padding-left: 16px;">
          <li style="margin-bottom: 6px;">Gửi văn bản giải trình nguyên nhân phát sinh phản ánh tiêu cực và trách nhiệm của bộ phận liên quan.</li>
          <li style="margin-bottom: 6px;">Xây dựng kế hoạch khắc phục cụ thể cho tiêu chí vi phạm nêu trên, kèm mốc thời gian thực hiện.</li>
          <li style="margin-bottom: 6px;">Hoàn thành khắc phục và báo cáo kết quả về cơ quan quản lý trong vòng ${escapeHtmlForPdf(String(deadlineDays))} ngày kể từ ngày nhận văn bản này.</li>
        </ol>

        <p style="margin: 10px 0 0; text-indent: 36px;">
          Quá thời hạn ${escapeHtmlForPdf(String(deadlineDays))} ngày nêu trên, nếu cơ sở không khắc phục hoặc khắc phục không đạt yêu cầu,
          cơ quan quản lý sẽ tiến hành thanh tra toàn diện và xem xét tước giấy phép kinh doanh dịch vụ du lịch theo quy định.
        </p>
      </div>

      <div style="margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div style="width: 52%; text-align: left;">
          <div style="font-weight: 700;">Nơi nhận:</div>
          <div>- Như trên;</div>
          <div>- Lưu: VT, Thanh tra.</div>
        </div>
        <div style="width: 44%; text-align: center;">
          <div style="font-weight: 700; text-transform: uppercase;">KT. GIÁM ĐỐC</div>
          <div style="font-weight: 700; text-transform: uppercase;">PHÓ GIÁM ĐỐC</div>
          <div style="margin-top: 58px; font-style: italic;">(Ký, ghi rõ họ tên và đóng dấu)</div>
        </div>
      </div>
    </div>
  `
}

const resolveAspectWarningLevel = (scoreRaw, highRiskThreshold, watchThreshold) => {
  const score = toFiniteScoreOrNull(scoreRaw)
  if (score === null || score >= watchThreshold) {
    return null
  }

  if (score < highRiskThreshold) {
    return {
      key: 'high',
      label: 'Nguy cơ cao'
    }
  }

  return {
    key: 'watch',
    label: 'Cần theo dõi'
  }
}

export default function OfficialAiStatisticsPage() {
  const { user, isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [payload, setPayload] = useState(null)
  const [selectedWard, setSelectedWard] = useState('all')
  const [expandedAspectKey, setExpandedAspectKey] = useState(null)
  const [selectedTemplateBusinessId, setSelectedTemplateBusinessId] = useState('')
  const [templateDeadlineDays, setTemplateDeadlineDays] = useState('7')
  const [isExportingTemplatePdf, setIsExportingTemplatePdf] = useState(false)

  const isOfficial = isAuthenticated && user?.role === 'official'

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await apiClient.get('/can-bo/thong-ke-ai/tong-hop')
      setPayload(data)
    } catch (error) {
      setErrorMessage(error.message || 'Không thể tải thống kê AI tổng hợp.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const allBusinesses = useMemo(() => payload?.danhSachCoSo || [], [payload])

  const aspectLabelLookup = useMemo(() => {
    const entries = (payload?.thongKeThuocTinh || []).map((item) => [item.key, item.label])
    return Object.fromEntries(entries)
  }, [payload])

  const daNangWardOptions = useMemo(() => {
    const wardSet = new Set()

    for (const item of allBusinesses) {
      if (!isDaNangAddress(item.diaChi)) continue
      const ward = extractWardFromAddress(item.diaChi)
      if (ward) wardSet.add(ward)
    }

    const wards = [...wardSet].sort((a, b) => a.localeCompare(b, 'vi'))
    return [
      { value: 'all', label: 'Tất cả cơ sở' },
      ...wards.map((ward) => ({ value: ward, label: ward }))
    ]
  }, [allBusinesses])

  const filteredBusinesses = useMemo(() => {
    if (selectedWard === 'all') return allBusinesses
    return allBusinesses.filter((item) => extractWardFromAddress(item.diaChi) === selectedWard)
  }, [allBusinesses, selectedWard])

  const summary = useMemo(
    () => calcSummaryFromItems(filteredBusinesses),
    [filteredBusinesses]
  )

  const zeroTypeSummary = useMemo(() => {
    let tongThuocTinh0TieuCuc = 0
    let tongThuocTinh0KhongDeCap = 0

    for (const item of filteredBusinesses) {
      for (const scoreRaw of Object.values(item.diemThanhPhan || {})) {
        const score = toFiniteScoreOrNull(scoreRaw)
        if (score === null) continue

        if (isScoreEqual(score, 0)) tongThuocTinh0TieuCuc += 1
        else if (isScoreEqual(score, NOT_MENTIONED_SCORE)) tongThuocTinh0KhongDeCap += 1
      }
    }

    return {
      tongThuocTinh0TieuCuc,
      tongThuocTinh0KhongDeCap
    }
  }, [filteredBusinesses])

  const highRiskThreshold = useMemo(() => {
    const value = Number(payload?.nguongCanhBao?.nguyCoCao)
    return Number.isFinite(value) ? value : DEFAULT_HIGH_RISK_THRESHOLD
  }, [payload])

  const watchThreshold = useMemo(() => {
    const value = Number(payload?.nguongCanhBao?.canTheoDoi)
    return Number.isFinite(value) ? value : DEFAULT_WATCH_THRESHOLD
  }, [payload])

  const classificationRules = useMemo(() => {
    return [
      {
        key: 'high',
        label: 'Nguy cơ cao',
        detail: `Điểm tổng quan < ${formatAiScore(highRiskThreshold)} hoặc có từ 2 thuộc tính nguy cơ cao`,
        action: 'Ưu tiên kiểm tra ngay'
      },
      {
        key: 'watch',
        label: 'Cần theo dõi',
        detail: `Điểm từ ${formatAiScore(highRiskThreshold)} đến < ${formatAiScore(watchThreshold)} hoặc có cảnh báo thuộc tính`,
        action: 'Theo dõi định kỳ'
      },
      {
        key: 'stable',
        label: 'Ổn định',
        detail: `Điểm >= ${formatAiScore(watchThreshold)} và không có cảnh báo`,
        action: 'Duy trì giám sát'
      }
    ]
  }, [highRiskThreshold, watchThreshold])

  const riskOverview = useMemo(() => {
    const rows = [
      { key: 'high', label: 'Nguy cơ cao', tone: 'bg-red-500', count: summary.riskCount.high },
      { key: 'watch', label: 'Cần theo dõi', tone: 'bg-amber-500', count: summary.riskCount.watch },
      { key: 'stable', label: 'Ổn định', tone: 'bg-emerald-500', count: summary.riskCount.stable },
      { key: 'unrated', label: 'Chưa phân tích', tone: 'bg-gray-400', count: summary.riskCount.unrated }
    ]

    return rows.map((item) => ({
      ...item,
      percent: summary.total > 0 ? toPercent(item.count / summary.total) : 0
    }))
  }, [summary])

  const aspectHotelDetailsByKey = useMemo(() => {
    const map = new Map()

    for (const aspect of payload?.thongKeThuocTinh || []) {
      map.set(aspect.key, [])
    }

    for (const business of filteredBusinesses) {
      // Chi tinh chi tiet canh bao cho co so da duoc phan tich AI.
      if (!business.coDuLieuAi || business.mucDoRuiRoKey === 'unrated') continue

      for (const [aspectKey, scoreRaw] of Object.entries(business.diemThanhPhan || {})) {
        const warningMeta = resolveAspectWarningLevel(scoreRaw, highRiskThreshold, watchThreshold)
        if (!warningMeta) continue

        if (!map.has(aspectKey)) {
          map.set(aspectKey, [])
        }

        map.get(aspectKey).push({
          id: business.id,
          tenCoSo: business.tenCoSo,
          diaChi: business.diaChi,
          mucDoRuiRo: business.mucDoRuiRo,
          mucDoRuiRoKey: business.mucDoRuiRoKey,
          diemTongQuan: business.diemTongQuan,
          mucDoCanhBaoThuocTinh: warningMeta.label,
          mucDoCanhBaoThuocTinhKey: warningMeta.key,
          diemThuocTinh: Number(scoreRaw),
          thoiDiemDanhGia: business.thoiDiemDanhGia
        })
      }
    }

    for (const [key, rows] of map.entries()) {
      rows.sort((a, b) => {
        const scoreA = Number.isFinite(Number(a.diemThuocTinh)) ? Number(a.diemThuocTinh) : 2
        const scoreB = Number.isFinite(Number(b.diemThuocTinh)) ? Number(b.diemThuocTinh) : 2
        if (scoreA !== scoreB) return scoreA - scoreB

        const riskDiff = (RISK_PRIORITY[a.mucDoRuiRoKey] ?? 99) - (RISK_PRIORITY[b.mucDoRuiRoKey] ?? 99)
        if (riskDiff !== 0) return riskDiff

        return String(a.tenCoSo || '').localeCompare(String(b.tenCoSo || ''), 'vi')
      })
      map.set(key, rows)
    }

    return map
  }, [filteredBusinesses, highRiskThreshold, payload, watchThreshold])

  const syncedAspectStats = useMemo(() => {
    const aspectRows = payload?.thongKeThuocTinh || []

    return aspectRows
      .map((aspect) => {
        const scores = filteredBusinesses
          .map((item) => toFiniteScoreOrNull(item.diemThanhPhan?.[aspect.key]))
          .filter((value) => value !== null)

        const warningRows = aspectHotelDetailsByKey.get(aspect.key) || []
        const soCoSoNguyCoCao = warningRows.filter((item) => item.mucDoCanhBaoThuocTinhKey === 'high').length
        const soCoSoCanTheoDoi = warningRows.filter((item) => item.mucDoCanhBaoThuocTinhKey === 'watch').length
        const tongCoSoCanhBao = warningRows.length
        const soCoSoOnDinh = Math.max(scores.length - tongCoSoCanhBao, 0)

        const soCoSoDiem0TieuCuc = filteredBusinesses
          .filter((item) => isScoreEqual(item.diemThanhPhan?.[aspect.key], 0))
          .length
        const soCoSoDiem0KhongDeCap = filteredBusinesses
          .filter((item) => isScoreEqual(item.diemThanhPhan?.[aspect.key], NOT_MENTIONED_SCORE))
          .length

        return {
          key: aspect.key,
          label: aspect.label,
          diemTrungBinh: scores.length ? calcAverage(scores) : null,
          tongCoSoDaPhanTich: scores.length,
          soCoSoNguyCoCao,
          soCoSoCanTheoDoi,
          soCoSoOnDinh,
          soCoSoDiem0TieuCuc,
          soCoSoDiem0KhongDeCap,
          tongCoSoCanhBao,
          tiLeCanhBao: scores.length > 0 ? toPercent(tongCoSoCanhBao / scores.length) : 0
        }
      })
      .sort((a, b) => {
        if (b.tongCoSoCanhBao !== a.tongCoSoCanhBao) return b.tongCoSoCanhBao - a.tongCoSoCanhBao
        if (a.diemTrungBinh === null) return 1
        if (b.diemTrungBinh === null) return -1
        return a.diemTrungBinh - b.diemTrungBinh
      })
  }, [aspectHotelDetailsByKey, filteredBusinesses, payload])

  const priorityBusinesses = useMemo(() => {
    return [...filteredBusinesses]
      .filter((item) => item.canhBaoThuocTinh.length > 0)
      .sort(compareBusinessesByPriority)
      .slice(0, 10)
  }, [filteredBusinesses])

  const templateReadyBusinesses = useMemo(() => {
    return [...filteredBusinesses]
      .filter((item) => item.coDuLieuAi && item.canhBaoThuocTinh.length > 0)
      .sort(compareBusinessesByPriority)
  }, [filteredBusinesses])

  const selectedTemplateBusiness = useMemo(() => {
    if (!selectedTemplateBusinessId) return null
    return templateReadyBusinesses.find((item) => String(item.id) === selectedTemplateBusinessId) || null
  }, [selectedTemplateBusinessId, templateReadyBusinesses])

  const normalizedTemplateDeadlineDays = useMemo(() => {
    const parsed = Number(templateDeadlineDays)
    if (!Number.isFinite(parsed)) return 7
    return Math.max(1, Math.min(60, Math.round(parsed)))
  }, [templateDeadlineDays])

  useEffect(() => {
    if (!templateReadyBusinesses.length) {
      setSelectedTemplateBusinessId('')
      return
    }

    const hasSelectedItem = templateReadyBusinesses.some((item) => String(item.id) === selectedTemplateBusinessId)
    if (!hasSelectedItem) {
      setSelectedTemplateBusinessId(String(templateReadyBusinesses[0].id))
    }
  }, [selectedTemplateBusinessId, templateReadyBusinesses])

  const selectedWardLabel = useMemo(() => {
    return daNangWardOptions.find((item) => item.value === selectedWard)?.label || 'Tất cả cơ sở'
  }, [daNangWardOptions, selectedWard])

  const handleExportCsv = useCallback(() => {
    if (!filteredBusinesses.length) return

    const headers = [
      'ten_co_so',
      'dia_chi',
      'phuong_da_nang',
      'muc_do_rui_ro',
      'diem_tong_quan',
      'so_thuoc_tinh_canh_bao',
      'thuoc_tinh_can_kiem_tra',
      'tu_khoa_tieu_cuc',
      'thoi_diem_danh_gia'
    ]

    const rows = filteredBusinesses.map((item) => ([
      item.tenCoSo,
      item.diaChi,
      extractWardFromAddress(item.diaChi),
      item.mucDoRuiRo,
      formatAiScore(item.diemTongQuan),
      item.canhBaoThuocTinh.length,
      item.canhBaoThuocTinh.map((alert) => `${alert.label}:${formatAiScore(alert.score)}`).join(' | '),
      (item.insight?.topTuKhoaTieuCuc || []).join('; '),
      formatDateTime(item.thoiDiemDanhGia)
    ]))

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
      .join('\n')

    const suffix = selectedWard === 'all' ? 'tat-ca' : makeFileSafeName(selectedWard)
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `thong-ke-ai-${suffix}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [filteredBusinesses, selectedWard])

  const handleExportSupervisionTemplate = useCallback(async () => {
    if (!selectedTemplateBusiness || isExportingTemplatePdf) return

    const violationAlert = resolvePrimaryViolationAlert(selectedTemplateBusiness.canhBaoThuocTinh || [])
    if (!violationAlert) return

    const evidenceRows = extractEvidenceFromBusiness(selectedTemplateBusiness)
    const htmlContent = buildSupervisionTemplatePdfHtml({
      business: selectedTemplateBusiness,
      violationAlert,
      evidenceRows,
      deadlineDays: normalizedTemplateDeadlineDays,
      generatedAt: new Date()
    })

    const wardSuffix = selectedWard === 'all' ? 'tat-ca' : makeFileSafeName(selectedWard)
    const businessSuffix = makeFileSafeName(selectedTemplateBusiness.tenCoSo)
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
    const pdfFileName = `bieu-mau-giam-sat-${businessSuffix || 'co-so'}-${wardSuffix}-${timestamp}.pdf`

    setErrorMessage('')
    setIsExportingTemplatePdf(true)

    try {
      const html2pdfModule = await import('html2pdf.js')
      const html2pdf = html2pdfModule.default || html2pdfModule

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: pdfFileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(htmlContent, 'string')
        .save()
    } catch (error) {
      setErrorMessage('Không thể xuất biểu mẫu PDF. Vui lòng thử lại.')
    } finally {
      setIsExportingTemplatePdf(false)
    }
  }, [isExportingTemplatePdf, normalizedTemplateDeadlineDays, selectedTemplateBusiness, selectedWard])

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-7 space-y-5">
        <section className="rounded-lg border border-[#e3d8d1] bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-[#8B2500] via-[#a53a13] to-[#b9522a] text-white px-5 py-4">
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wide">Bảng Điều Khiển Thống Kê AI</h1>
            <p className="text-sm text-[#fcebdc] mt-1">
              Thống kê đồng bộ theo một chuẩn phân loại, tập trung vào cơ sở và thuộc tính cần kiểm tra.
            </p>
          </div>

          {!isOfficial && (
            <div className="m-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Bạn chưa đăng nhập tài khoản cán bộ. Vui lòng đăng nhập để sử dụng đầy đủ tính năng thống kê AI.
            </div>
          )}

          <div className="px-5 py-4 border-b border-gray-200 bg-[#fffaf7]">
            <div className="rounded-lg border border-[#edd5c7] bg-white px-3 py-3 mb-4">
              <h2 className="text-sm font-semibold text-[#6f2a11]">Hướng dẫn nhanh sử dụng trang</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                {QUICK_GUIDE_ITEMS.map((item) => (
                  <div key={item.title} className="rounded border border-[#f0dfd5] bg-[#fff8f4] px-3 py-2">
                    <p className="text-xs font-semibold text-[#7d3114]">{item.title}</p>
                    <p className="text-xs text-[#8b5d4a] mt-1">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[280px_auto_auto_auto] gap-3 items-end">
              <label className="text-sm text-gray-700">
                Chọn theo phường (Đà Nẵng)
                <select
                  value={selectedWard}
                  onChange={(event) => setSelectedWard(event.target.value)}
                  className="mt-1 h-10 w-full rounded border border-gray-300 px-2 text-sm bg-white"
                >
                  {daNangWardOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={loadData}
                className="h-10 px-4 rounded bg-[#8B2500] text-white text-sm hover:bg-[#6B1A00]"
              >
                Làm mới dữ liệu
              </button>

              <button
                type="button"
                onClick={() => setSelectedWard('all')}
                disabled={selectedWard === 'all'}
                className="h-10 px-4 rounded border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hiển thị tất cả
              </button>

              <button
                type="button"
                disabled={!filteredBusinesses.length}
                onClick={handleExportCsv}
                className="h-10 px-4 rounded border border-[#8B2500] text-[#8B2500] text-sm hover:bg-[#f6e8e1] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xuất CSV
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-[#edd5c7] bg-white px-3 py-3">
              <h3 className="text-sm font-semibold text-[#6f2a11]">Biểu mẫu kiểm tra, giám sát cơ sở</h3>
              <div className="mt-2 grid grid-cols-1 lg:grid-cols-[minmax(240px,1fr)_170px_auto] gap-3 items-end">
                <label className="text-sm text-gray-700">
                  Chọn cơ sở có cảnh báo để xuất biểu mẫu
                  <select
                    value={selectedTemplateBusinessId}
                    onChange={(event) => setSelectedTemplateBusinessId(event.target.value)}
                    className="mt-1 h-10 w-full rounded border border-gray-300 px-2 text-sm bg-white"
                    disabled={!templateReadyBusinesses.length}
                  >
                    {templateReadyBusinesses.length === 0 && (
                      <option value="">Không có cơ sở phù hợp trong phạm vi hiện tại</option>
                    )}

                    {templateReadyBusinesses.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.tenCoSo} - {item.mucDoRuiRo}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-gray-700">
                  Hạn khắc phục (ngày)
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={templateDeadlineDays}
                    onChange={(event) => setTemplateDeadlineDays(event.target.value)}
                    className="mt-1 h-10 w-full rounded border border-gray-300 px-2 text-sm bg-white"
                  />
                </label>

                <button
                  type="button"
                  disabled={!selectedTemplateBusiness || isExportingTemplatePdf}
                  onClick={handleExportSupervisionTemplate}
                  className="h-10 px-4 rounded border border-[#8B2500] text-[#8B2500] text-sm hover:bg-[#f6e8e1] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingTemplatePdf ? 'Đang xuất PDF...' : 'Xuất biểu mẫu PDF'}
                </button>
              </div>

              <p className="mt-2 text-xs text-[#7d3114]">
                Biểu mẫu được điền sẵn theo dữ liệu AI của cơ sở đã chọn và xuất trực tiếp dưới định dạng PDF.
              </p>
            </div>

            {payload && (
              <div className="mt-3 space-y-1 text-xs text-gray-500">
                <p>
                  Đang hiển thị {filteredBusinesses.length}/{allBusinesses.length} cơ sở.
                  Phạm vi hiện tại: <span className="font-medium text-gray-700">{selectedWardLabel}</span>.
                  Dữ liệu tổng hợp lúc: {new Date(payload.generatedAt).toLocaleString('vi-VN')}
                </p>
                <p className="text-[11px] text-[#7d3114]">
                  Tất cả chỉ số trong trang này đều tính trên cùng một tập cơ sở đang hiển thị để tránh lệch số.
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div className="px-5 py-8 text-sm text-gray-500">Đang tải dữ liệu thống kê AI...</div>
          )}

          {!loading && errorMessage && (
            <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {!loading && !errorMessage && (
            <div className="px-5 pb-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 text-sm">
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 min-h-[110px]">
                  <div className="text-gray-600">Tổng cơ sở đang hiển thị</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 min-h-[110px]">
                  <div className="text-gray-600">Cơ sở đã có phân tích AI</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{summary.analyzed}</div>
                  <div className="text-xs text-gray-500 mt-1">Độ phủ AI: {summary.aiCoveragePercent}%</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 min-h-[110px]">
                  <div className="text-gray-600">Cơ sở có cảnh báo thuộc tính</div>
                  <div className="text-2xl font-bold text-red-700 mt-1">{summary.warning}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Tỷ lệ cảnh báo: {summary.total > 0 ? toPercent(summary.warning / summary.total) : 0}%
                  </div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 min-h-[110px]">
                  <div className="text-gray-600">Điểm AI tổng quan trung bình</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{formatAiScore(summary.avgScore)}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3 min-h-[110px]">
                  <div className="text-gray-600">Chưa có dữ liệu AI</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total - summary.analyzed}</div>
                </div>
              </div>

              <div className="rounded-lg border border-[#f0dfd5] bg-[#fff8f4] px-4 py-3">
                <h2 className="font-semibold text-[#6f2a11]">Quy ước điểm AI lưu trong cơ sở dữ liệu</h2>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                    <p className="font-semibold">0đ tiêu cực</p>
                    <p className="mt-1">AI xác định thuộc tính ở mức tiêu cực (được tính vào cảnh báo).</p>
                    <p className="mt-1 font-medium">Tổng trong phạm vi lọc: {zeroTypeSummary.tongThuocTinh0TieuCuc}</p>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                    <p className="font-semibold">0.5đ không đề cập</p>
                    <p className="mt-1">Thuộc tính không được đề cập (mức trung tính, không đẩy sang nguy cơ cao).</p>
                    <p className="mt-1 font-medium">Tổng trong phạm vi lọc: {zeroTypeSummary.tongThuocTinh0KhongDeCap}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-gray-900">Phân bổ mức rủi ro (chuẩn phân loại duy nhất)</h2>
                    <p className="text-xs text-gray-500">
                      Ngưỡng: Nguy cơ cao &lt; {formatAiScore(highRiskThreshold)}, cần theo dõi &lt; {formatAiScore(watchThreshold)}
                    </p>
                  </div>

                  <div className="mt-3 space-y-3">
                    {riskOverview.map((risk) => (
                      <div key={risk.key}>
                        <div className="flex items-center justify-between text-sm text-gray-700">
                          <span>{risk.label}</span>
                          <span className="font-semibold">{risk.count} cơ sở ({risk.percent}%)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200 mt-1 overflow-hidden">
                          <div className={`h-full ${risk.tone}`} style={{ width: `${risk.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded border border-[#f0dfd5] bg-[#fff8f4] px-3 py-2 text-xs text-[#7d3114]">
                    Lưu ý: Để tránh mâu thuẫn số liệu, trang chỉ dùng một cách phân loại theo trường mức độ rủi ro của từng cơ sở.
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <h2 className="font-semibold text-gray-900">Cơ sở cần kiểm tra</h2>
                  <p className="text-xs text-gray-500">
                    Chỉ hiển thị cơ sở có cảnh báo. Mỗi cơ sở đi kèm thuộc tính cần kiểm tra cụ thể.
                  </p>

                  <div className="space-y-2 max-h-[430px] overflow-auto pr-1">
                    {priorityBusinesses.length === 0 && (
                      <p className="text-xs text-gray-500">Hiện không có cơ sở cần theo dõi/kiểm tra trong phạm vi đang xem.</p>
                    )}

                    {priorityBusinesses.map((item, index) => (
                      <div key={item.id} className="rounded border border-gray-200 bg-gray-50 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-900">#{index + 1} {item.tenCoSo}</p>
                          <span className={`inline-flex text-[11px] rounded-full border px-2 py-0.5 ${RISK_TONE_BY_KEY[item.mucDoRuiRoKey] || RISK_TONE_BY_KEY.unrated}`}>
                            {item.mucDoRuiRo}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-1">{item.diaChi}</p>
                        <p className="text-[11px] text-gray-700 mt-1">
                          Thuộc tính cần kiểm tra:{' '}
                          {item.canhBaoThuocTinh
                            .map((alert) => `${alert.label} (${formatAiScore(alert.score)})`)
                            .join(' • ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="font-semibold text-gray-900">Quy tắc phân loại cơ sở</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {classificationRules.map((rule) => (
                    <div key={rule.key} className="rounded border border-gray-200 bg-gray-50 p-3">
                      <p className="text-sm font-semibold text-gray-900">{rule.label}</p>
                      <p className="text-xs text-gray-600 mt-1">{rule.detail}</p>
                      <p className="text-xs font-medium text-[#7d3114] mt-2">Gợi ý xử lý: {rule.action}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h2 className="font-semibold text-gray-900">Cảnh báo theo thuộc tính (số cụ thể)</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                  {syncedAspectStats.map((item) => (
                    <div key={item.key} className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{item.label}</p>
                        <span className="text-xs text-gray-500">{item.tongCoSoCanhBao} cơ sở cần kiểm tra</span>
                      </div>

                      <div>
                        <p className="text-sm text-gray-700">
                          Điểm trung bình: <span className="font-semibold">{formatAiScore(item.diemTrungBinh)}</span>
                        </p>
                        <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden mt-1">
                          <div className="h-full bg-[#8B2500]" style={{ width: `${toPercent(item.diemTrungBinh)}%` }} />
                        </div>
                      </div>

                      <p className="text-xs text-gray-600">
                        Tổng đã phân tích: <span className="font-medium">{item.tongCoSoDaPhanTich}</span> •
                        Cần kiểm tra: <span className="font-medium">{item.tongCoSoCanhBao} ({item.tiLeCanhBao}%)</span>
                      </p>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
                          Nguy cơ cao: {item.soCoSoNguyCoCao}
                        </span>
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                          Cần theo dõi: {item.soCoSoCanTheoDoi}
                        </span>
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          Ổn định: {item.soCoSoOnDinh}
                        </span>
                        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                          0đ tiêu cực: {item.soCoSoDiem0TieuCuc}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                          0.5đ không đề cập: {item.soCoSoDiem0KhongDeCap}
                        </span>
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedAspectKey((current) => (current === item.key ? null : item.key))}
                          className="inline-flex items-center rounded border border-[#8B2500] bg-white px-2.5 py-1 text-xs font-medium text-[#8B2500] hover:bg-[#fdf1ea]"
                        >
                          {expandedAspectKey === item.key ? 'Ẩn chi tiết khách sạn' : 'Xem chi tiết khách sạn'}
                        </button>
                      </div>

                      {expandedAspectKey === item.key && (
                        <div className="rounded border border-gray-200 bg-white p-2.5">
                          <p className="text-xs font-medium text-gray-700 mb-2">
                            Danh sách khách sạn có cảnh báo thuộc tính {item.label}
                          </p>

                          {(aspectHotelDetailsByKey.get(item.key) || []).length === 0 ? (
                            <p className="text-xs text-gray-500">Không có khách sạn nào trong phạm vi lọc hiện tại.</p>
                          ) : (
                            <div className="max-h-64 overflow-auto">
                              <table className="min-w-full text-xs divide-y divide-gray-100">
                                <thead className="bg-gray-50 text-gray-700">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left font-semibold">Khách sạn</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">Điểm</th>
                                    <th className="px-2 py-1.5 text-left font-semibold">Mức cảnh báo</th>
                                    <th className="px-2 py-1.5 text-left font-semibold">Rủi ro chung</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {(aspectHotelDetailsByKey.get(item.key) || []).map((hotel) => (
                                    <tr key={`${item.key}-${hotel.id}`}>
                                      <td className="px-2 py-1.5 align-top">
                                        <p className="font-medium text-gray-900">{hotel.tenCoSo}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{hotel.diaChi}</p>
                                      </td>
                                      <td className="px-2 py-1.5 align-top text-right font-semibold text-gray-900">
                                        {formatAiScore(hotel.diemThuocTinh)}
                                      </td>
                                      <td className="px-2 py-1.5 align-top text-gray-700">{hotel.mucDoCanhBaoThuocTinh}</td>
                                      <td className="px-2 py-1.5 align-top text-gray-700">{hotel.mucDoRuiRo}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </section>
      </main>
    </div>
  )
}
