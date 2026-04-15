import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import AiTestWidget from '../components/AiTestWidget'
import { apiClient } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const SECTION_HOME = 'can-bo-home'
const SECTION_BUSINESSES = 'can-bo-co-so-dang-ky'
const SECTION_BUSINESS_STATS = 'can-bo-thong-ke-co-so'
const SECTION_DOCUMENTS = 'can-bo-cong-van-nghi-quyet'
const SECTION_REQUESTS = 'can-bo-quan-ly-ho-so'

const VALID_SECTIONS = [SECTION_HOME, SECTION_BUSINESSES, SECTION_BUSINESS_STATS, SECTION_DOCUMENTS, SECTION_REQUESTS]

const SECTION_META = {
  [SECTION_HOME]: {
    title: 'Danh Sách Việc Cần Làm Hôm Nay',
    subtitle: 'Hiển thị các công việc ưu tiên trong ngày dành cho cán bộ.'
  },
  [SECTION_BUSINESSES]: {
    title: 'Cơ Sở Kinh Doanh Đang Đăng Ký',
    subtitle: 'Danh sách cơ sở trong hệ thống để theo dõi và kiểm tra nhanh.'
  },
  [SECTION_BUSINESS_STATS]: {
    title: 'Thống Kê Tình Hình Hoạt Động Của Cơ Sở',
    subtitle: 'Lọc theo ngày, xem số lượt review của từng cơ sở và sẵn sàng cho thống kê AI.'
  },
  [SECTION_DOCUMENTS]: {
    title: 'Tin Tức, Công Văn, Nghị Quyết',
    subtitle: 'Tổng hợp văn bản và bản tin mới phục vụ xử lý nghiệp vụ.'
  },
  [SECTION_REQUESTS]: {
    title: 'Quản Lý Hồ Sơ Cần Xử Lý',
    subtitle: 'Theo dõi hồ sơ, cập nhật trạng thái và mở chi tiết nội dung hồ sơ.'
  }
}

const statusBadgeClass = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'approved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'additional_info_required':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const businessStatusLabel = (status) => {
  const normalized = String(status || '').trim().toLowerCase()

  if (normalized === 'active') return 'Đang hoạt động'
  if (normalized === 'inactive') return 'Ngừng hoạt động'
  if (normalized === 'suspended') return 'Tạm dừng'
  if (normalized === 'under_inspection') return 'Đang kiểm tra'

  return status || 'Chưa cập nhật'
}

const priorityClass = (priority) => {
  switch (priority) {
    case 'high':
      return 'text-red-700 bg-red-50 border-red-200'
    case 'medium':
      return 'text-amber-700 bg-amber-50 border-amber-200'
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200'
  }
}

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

const formatDateTime = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

const formatAverageRating = (value) => {
  if (value === null || value === undefined) return 'Chưa có'
  return `${Number(value).toFixed(2)} / 5`
}

const formatAiScore = (value) => {
  if (value === null || value === undefined) return 'Chưa có'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'Chưa có'
  return parsed.toFixed(4)
}

const AI_COMPONENT_META = {
  hygiene: { label: 'Vệ sinh' },
  food: { label: 'Đồ ăn' },
  hotel: { label: 'Khách sạn' },
  location: { label: 'Vị trí' },
  room: { label: 'Phòng ốc' },
  service: { label: 'Dịch vụ' }
}

const toAiScoreOrNull = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.min(1, parsed))
}

const clampAiScore = (value) => {
  const parsed = toAiScoreOrNull(value)
  return parsed === null ? 0 : parsed
}

const formatAiPercent = (value) => `${Math.round(clampAiScore(value) * 100)}%`

const getAiScoreMeta = (value) => {
  const score = toAiScoreOrNull(value)

  if (score === null) {
    return {
      label: 'Chưa phân tích',
      tone: 'text-gray-700 bg-gray-50 border-gray-200',
      bar: 'bg-gray-400'
    }
  }

  if (score < 0.45) {
    return {
      label: 'Nguy cơ cao',
      tone: 'text-red-700 bg-red-50 border-red-200',
      bar: 'bg-red-500'
    }
  }

  if (score < 0.5) {
    return {
      label: 'Cần theo dõi',
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
      bar: 'bg-amber-500'
    }
  }

  return {
    label: 'Ổn định',
    tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    bar: 'bg-emerald-500'
  }
}

const getAiSentimentMeta = (sentimentLabel) => {
  const normalized = String(sentimentLabel || '').trim().toLowerCase()

  if (normalized === 'positive') {
    return {
      label: 'Tích cực',
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    }
  }

  if (normalized === 'negative') {
    return {
      label: 'Tiêu cực',
      tone: 'text-red-700 bg-red-50 border-red-200'
    }
  }

  return {
    label: 'Trung tính',
    tone: 'text-amber-700 bg-amber-50 border-amber-200'
  }
}



const formatRatingStars = (value) => {
  const normalized = Math.max(0, Math.min(5, Number(value) || 0))
  return `${'★'.repeat(normalized)}${'☆'.repeat(5 - normalized)}`
}

const toRequestCode = (requestId) => `HS-${String(requestId).padStart(6, '0')}`

export default function OfficialDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [updateNotice, setUpdateNotice] = useState({ type: '', text: '' })
  const [updatingRequestId, setUpdatingRequestId] = useState(null)

  const [dashboard, setDashboard] = useState({
    overview: {
      totalBusinesses: 0,
      totalRequests: 0,
      pendingRequests: 0,
      todayTasks: 0
    },
    businesses: [],
    requests: [],
    requestStatusSummary: [],
    todayTasks: [],
    documents: []
  })

  const [selectedStatus, setSelectedStatus] = useState('all')
  const [requestStatusDrafts, setRequestStatusDrafts] = useState({})
  const [requestNoteDrafts, setRequestNoteDrafts] = useState({})
  const [reviewStatsFilters, setReviewStatsFilters] = useState({ fromDate: '', toDate: '' })
  const [reviewStatsByBusiness, setReviewStatsByBusiness] = useState({})
  const [aiStatsByBusiness, setAiStatsByBusiness] = useState({})
  const [reviewStatsLoadingBusinessId, setReviewStatsLoadingBusinessId] = useState(null)
  const [aiStatsLoadingBusinessId, setAiStatsLoadingBusinessId] = useState(null)
  const [reviewStatsError, setReviewStatsError] = useState('')
  const [aiStatsNotice, setAiStatsNotice] = useState('')
  const [reviewModal, setReviewModal] = useState({
    open: false,
    businessName: '',
    thongKeReview: null,
    danhSachReview: [],
    boLoc: { tuNgay: null, denNgay: null }
  })
  const [aiModal, setAiModal] = useState({
    open: false,
    businessName: '',
    payload: null
  })

  const rawSection = useMemo(() => new URLSearchParams(location.search).get('section'), [location.search])
  const activeSection = VALID_SECTIONS.includes(rawSection) ? rawSection : SECTION_HOME
  const sectionMeta = SECTION_META[activeSection]

  const isOfficial = isAuthenticated && user?.role === 'official'

  const loadDashboard = async () => {
    setErrorMessage('')
    setLoading(true)

    try {
      const data = await apiClient.get('/can-bo/dashboard')
      setDashboard(data)
      setRequestStatusDrafts((data.requests || []).reduce((acc, item) => {
        acc[item.id] = item.status
        return acc
      }, {}))
      setRequestNoteDrafts((data.requests || []).reduce((acc, item) => {
        acc[item.id] = item.officialNote || ''
        return acc
      }, {}))
    } catch (error) {
      setErrorMessage(error.message || 'Không thể tải dữ liệu quản lý cán bộ.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (activeSection !== SECTION_REQUESTS && updateNotice.text) {
      setUpdateNotice({ type: '', text: '' })
    }
    if (activeSection !== SECTION_BUSINESS_STATS) {
      if (reviewStatsError) setReviewStatsError('')
      if (aiStatsNotice) setAiStatsNotice('')
      if (Object.keys(reviewStatsByBusiness).length > 0) setReviewStatsByBusiness({})
      if (Object.keys(aiStatsByBusiness).length > 0) setAiStatsByBusiness({})
      if (reviewModal.open) {
        setReviewModal((prev) => ({ ...prev, open: false }))
      }
      if (aiModal.open) {
        setAiModal((prev) => ({ ...prev, open: false }))
      }
    }
  }, [activeSection, updateNotice.text, reviewStatsError, aiStatsNotice, reviewModal.open, aiModal.open, reviewStatsByBusiness, aiStatsByBusiness])

  const statusOptions = useMemo(() => {
    return [{ status: 'all', label: 'Tất cả', count: dashboard.requests.length }, ...dashboard.requestStatusSummary]
  }, [dashboard.requests.length, dashboard.requestStatusSummary])

  const filteredRequests = useMemo(() => {
    if (selectedStatus === 'all') return dashboard.requests
    return dashboard.requests.filter((item) => item.status === selectedStatus)
  }, [dashboard.requests, selectedStatus])

  const handleUpdateRequestStatus = async (requestId) => {
    const draftStatus = requestStatusDrafts[requestId]
    const draftNote = requestNoteDrafts[requestId]

    if (!draftStatus) return

    setUpdatingRequestId(requestId)
    setUpdateNotice({ type: '', text: '' })

    try {
      const result = await apiClient.put(`/can-bo/ho-so/${requestId}/xu-ly`, {
        trangThai: draftStatus,
        ghiChu: draftNote
      })

      setUpdateNotice({
        type: 'success',
        text: result.message || 'Cập nhật trạng thái hồ sơ thành công.'
      })
      await loadDashboard()
    } catch (error) {
      setUpdateNotice({
        type: 'error',
        text: error.message || 'Không thể cập nhật trạng thái hồ sơ.'
      })
    } finally {
      setUpdatingRequestId(null)
    }
  }

  const handleReviewFilterChange = (field, value) => {
    setReviewStatsFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleViewReviewStats = async (business) => {
    const businessId = business.id

    if (reviewStatsFilters.fromDate && reviewStatsFilters.toDate && reviewStatsFilters.fromDate > reviewStatsFilters.toDate) {
      setReviewStatsError('Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.')
      return
    }

    setReviewStatsError('')
    setAiStatsNotice('')
    setReviewStatsLoadingBusinessId(businessId)

    try {
      const query = new URLSearchParams()
      if (reviewStatsFilters.fromDate) query.set('fromDate', reviewStatsFilters.fromDate)
      if (reviewStatsFilters.toDate) query.set('toDate', reviewStatsFilters.toDate)

      const queryString = query.toString()
      const endpoint = `/can-bo/co-so/${businessId}/review-thong-ke${queryString ? `?${queryString}` : ''}`
      const data = await apiClient.get(endpoint)

      setReviewStatsByBusiness((prev) => ({
        ...prev,
        [businessId]: data
      }))

      setReviewModal({
        open: true,
        businessName: data?.coSo?.tenCoSo || business.name,
        thongKeReview: data?.thongKeReview || null,
        danhSachReview: data?.danhSachReview || [],
        boLoc: data?.boLoc || { tuNgay: null, denNgay: null }
      })
    } catch (error) {
      setReviewStatsError(error.message || 'Không thể tải thống kê review của cơ sở này.')
    } finally {
      setReviewStatsLoadingBusinessId(null)
    }
  }

  const openAiReportModal = (payload, fallbackBusinessName = '') => {
    if (!payload?.ketQuaAi) return

    setAiModal({
      open: true,
      businessName: payload?.coSo?.tenCoSo || fallbackBusinessName || 'Chưa xác định cơ sở',
      payload
    })
  }

  const handleViewAiStats = async (business) => {
    const businessId = business.id

    if (reviewStatsFilters.fromDate && reviewStatsFilters.toDate && reviewStatsFilters.fromDate > reviewStatsFilters.toDate) {
      setReviewStatsError('Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.')
      return
    }

    setReviewStatsError('')
    setAiStatsNotice('')
    setAiStatsLoadingBusinessId(businessId)

    try {
      const query = new URLSearchParams()
      if (reviewStatsFilters.fromDate) query.set('fromDate', reviewStatsFilters.fromDate)
      if (reviewStatsFilters.toDate) query.set('toDate', reviewStatsFilters.toDate)

      const queryString = query.toString()
      const endpoint = `/can-bo/co-so/${businessId}/thong-ke-ai${queryString ? `?${queryString}` : ''}`
      const data = await apiClient.get(endpoint)
      setAiStatsByBusiness((prev) => ({
        ...prev,
        [businessId]: data
      }))

      setAiStatsNotice(`Đã cập nhật thống kê AI cho cơ sở "${data?.coSo?.tenCoSo || business.name}".`)

      openAiReportModal(data, business.name)
    } catch (error) {
      setReviewStatsError(error.message || 'Không thể thống kê AI cho cơ sở này.')
    } finally {
      setAiStatsLoadingBusinessId(null)
    }
  }

  const aiModalResult = aiModal?.payload?.ketQuaAi || null
  const aiModalInput = aiModal?.payload?.duLieuDauVao || null
  const aiModalSentimentMeta = getAiSentimentMeta(aiModalResult?.sentimentLabel)
  const aiModalScoreMeta = getAiScoreMeta(aiModalResult?.diemTongQuan)
  const aiModalComponentEntries = Object.entries(AI_COMPONENT_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    score: aiModalResult?.diemThanhPhan?.[key] ?? null
  }))
  const aiModalKeywords = Array.isArray(aiModalResult?.insight?.topTuKhoaTieuCuc)
    ? aiModalResult.insight.topTuKhoaTieuCuc
    : []
  const aiModalRepresentativeReviews = Array.isArray(aiModalResult?.insight?.reviewDaiDien)
    ? aiModalResult.insight.reviewDaiDien
    : []

  return (
    <>
    <div className="min-h-screen bg-[#f5f6fa]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-7 space-y-5">
        <section className="rounded-lg border border-[#e3d8d1] bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-[#8B2500] via-[#a53a13] to-[#b9522a] text-white px-5 py-4">
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wide">{sectionMeta.title}</h1>
            <p className="text-sm text-[#fcebdc] mt-1">{sectionMeta.subtitle}</p>
          </div>

          {!isOfficial && (
            <div className="m-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Bạn chưa đăng nhập tài khoản cán bộ. Vui lòng đăng nhập để sử dụng chức năng quản lý.
            </div>
          )}

          {errorMessage && (
            <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {activeSection === SECTION_REQUESTS && updateNotice.text && (
            <div className={`m-4 rounded border px-3 py-2 text-sm ${updateNotice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              {updateNotice.text}
            </div>
          )}

          {loading && (
            <p className="px-5 pb-5 text-sm text-gray-500">Đang tải dữ liệu...</p>
          )}

          {!loading && activeSection === SECTION_HOME && (
            <div className="px-5 pb-5">
              {dashboard.todayTasks.length === 0 ? (
                <p className="text-sm text-gray-500">Hôm nay chưa có công việc nào được giao.</p>
              ) : (
                <ul className="space-y-3">
                  {dashboard.todayTasks.map((task) => (
                    <li key={task.id} className="rounded-md border border-gray-200 bg-[#fafafa] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{task.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{task.description || 'Không có mô tả'}</p>
                        </div>
                        <span className={`inline-flex text-xs border px-2 py-1 rounded ${priorityClass(task.priority)}`}>
                          {task.priorityLabel}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-3">
                        Hạn xử lý: {formatDate(task.dueDate)} {task.dueTime ? `• ${task.dueTime}` : ''} • Trạng thái: {task.statusLabel}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!loading && activeSection === SECTION_BUSINESSES && (
            <div className="px-5 pb-5">
              {dashboard.businesses.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có cơ sở kinh doanh nào trong hệ thống.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {dashboard.businesses.map((biz) => (
                    <article key={biz.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-[#f9efe9] border-b border-[#edd5c7]">
                        <h3 className="font-semibold text-[#6f2a11] line-clamp-1">{biz.name}</h3>
                        <p className="text-xs text-[#8b5d4a] mt-1">{biz.business_type}</p>
                      </div>
                      <div className="p-4 text-sm space-y-2">
                        <p className="text-gray-700"><span className="font-medium">Địa chỉ:</span> {biz.address}</p>
                        <p className="text-gray-600"><span className="font-medium">Khu vực:</span> {biz.district || 'Chưa rõ quận'} • {biz.province_city}</p>
                        <p className="text-gray-600"><span className="font-medium">Chủ cơ sở:</span> {biz.owner_name || 'Chưa cập nhật'}</p>
                        <p className="text-gray-600"><span className="font-medium">Số phép:</span> {biz.license_number || 'Chưa có'}</p>
                        <span className="inline-flex text-xs rounded border border-gray-200 bg-gray-50 px-2 py-1 text-gray-700">
                          Trạng thái: {businessStatusLabel(biz.status)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeSection === SECTION_BUSINESS_STATS && (
            <div className="px-5 pb-5 space-y-4">
              <div className="rounded-md border border-[#edd5c7] bg-[#fdf7f3] p-3">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <label className="text-sm text-gray-700">
                    Từ ngày
                    <input
                      type="date"
                      value={reviewStatsFilters.fromDate}
                      onChange={(e) => handleReviewFilterChange('fromDate', e.target.value)}
                      className="mt-1 h-9 w-full rounded border border-gray-300 px-2 text-sm"
                    />
                  </label>

                  <label className="text-sm text-gray-700">
                    Đến ngày
                    <input
                      type="date"
                      value={reviewStatsFilters.toDate}
                      onChange={(e) => handleReviewFilterChange('toDate', e.target.value)}
                      className="mt-1 h-9 w-full rounded border border-gray-300 px-2 text-sm"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewStatsFilters({ fromDate: '', toDate: '' })
                      setReviewStatsByBusiness({})
                      setAiStatsByBusiness({})
                      setReviewStatsError('')
                      setAiStatsNotice('')
                      setAiModal({ open: false, businessName: '', payload: null, warnings: [] })
                    }}
                    className="h-9 px-3 rounded border border-gray-300 text-sm text-gray-700 hover:border-[#8B2500] hover:text-[#8B2500]"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              </div>

              {reviewStatsError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {reviewStatsError}
                </div>
              )}

              {aiStatsNotice && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {aiStatsNotice}
                </div>
              )}

              {dashboard.businesses.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có cơ sở kinh doanh nào để thống kê.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-[#f9efe9]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-[#6f2a11] whitespace-nowrap min-w-[200px] w-1/4">Cơ sở</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#6f2a11] min-w-[250px] w-[30%]">Địa chỉ</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#6f2a11] min-w-[160px] w-[15%]">Trạng thái</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#6f2a11] min-w-[160px] w-[10%]">Thao tác</th>
                        <th className="px-4 py-3 text-left font-semibold text-[#6f2a11] min-w-[280px] w-1/5">Kết quả tổng hợp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {dashboard.businesses.map((biz) => {
                        const statsData = reviewStatsByBusiness[biz.id]?.thongKeReview
                        const aiStatsPayload = aiStatsByBusiness[biz.id]
                        const aiStatsData = aiStatsPayload?.ketQuaAi
                        const aiSentimentMeta = getAiSentimentMeta(aiStatsData?.sentimentLabel)
                        const aiScoreMeta = getAiScoreMeta(aiStatsData?.diemTongQuan)

                        return (
                          <tr key={biz.id} className="hover:bg-[#fdf0e8]/40 transition-colors duration-200 group">
                            <td className="px-4 py-4 align-top">
                              <p className="font-semibold text-gray-900 max-w-[150px] md:max-w-[250px] truncate group-hover:text-[#8B2500] transition-colors cursor-default" title={biz.name}>{biz.name}</p>
                              <p className="text-xs text-gray-500 mt-1">{biz.business_type}</p>
                            </td>
                            <td className="px-4 py-4 align-top text-gray-700 leading-relaxed">
                              {biz.address || 'Chưa cập nhật'}
                            </td>
                            <td className="px-4 py-4 align-top">
                              <span className="inline-flex items-center text-xs font-medium rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-700 shadow-sm">
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${biz.status === 'active' ? 'bg-emerald-500' :
                                    biz.status === 'suspended' ? 'bg-amber-500' :
                                      biz.status === 'under_inspection' ? 'bg-blue-500' :
                                        'bg-gray-400'
                                  }`}></span>
                                {businessStatusLabel(biz.status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-col gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleViewReviewStats(biz)}
                                  disabled={reviewStatsLoadingBusinessId === biz.id}
                                  className="w-full text-center px-3 py-1.5 rounded-md border border-[#8B2500] text-[#8B2500] font-medium hover:bg-[#8B2500] hover:text-white hover:shadow transition-all duration-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[#8B2500] disabled:hover:shadow-none"
                                >
                                  {reviewStatsLoadingBusinessId === biz.id ? 'Đang tải...' : 'Xem số review'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleViewAiStats(biz)}
                                  disabled={aiStatsLoadingBusinessId === biz.id}
                                  className="w-full text-center px-3 py-1.5 rounded-md border border-amber-500 text-amber-700 font-medium hover:bg-amber-500 hover:text-white hover:shadow transition-all duration-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-amber-700 disabled:hover:shadow-none"
                                >
                                  {aiStatsLoadingBusinessId === biz.id ? 'Đang tải...' : aiStatsData ? 'Phân tích lại AI' : 'Thống kê AI'}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="space-y-3 text-xs text-gray-700 w-full min-w-[280px]">
                                {statsData ? (
                                  <div className="space-y-1.5 rounded-md border border-gray-200 bg-gray-50 p-3">
                                    <p>Tổng lượt review: <span className="font-semibold">{statsData.tongLuotReview}</span></p>
                                    <p>Điểm trung bình: <span className="font-semibold">{formatAverageRating(statsData.diemTrungBinh)}</span></p>
                                    <p>Review đầu tiên: <span className="text-gray-600">{formatDateTime(statsData.reviewDauTien)}</span></p>
                                    <p>Review gần nhất: <span className="text-gray-600">{formatDateTime(statsData.reviewGanNhat)}</span></p>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 italic">Bấm "Xem số review" để hiển thị số liệu.</span>
                                )}

                                {aiStatsData && (
                                  <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className={`inline-flex text-[11px] font-medium rounded-full border px-2.5 py-0.5 ${aiSentimentMeta.tone}`}>
                                        Sentiment: {aiSentimentMeta.label}
                                      </span>
                                      <span className={`inline-flex text-[11px] font-medium rounded-full border px-2.5 py-0.5 ${aiScoreMeta.tone}`}>
                                        {aiScoreMeta.label}
                                      </span>
                                    </div>

                                    <div>
                                      <p className="text-gray-800 mb-1.5">
                                        Điểm AI tổng quan: <span className="font-semibold">{formatAiScore(aiStatsData.diemTongQuan)}</span> ({formatAiPercent(aiStatsData.diemTongQuan)})
                                      </p>
                                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                                        <div className={`h-full ${aiScoreMeta.bar} transition-all duration-500`} style={{ width: formatAiPercent(aiStatsData.diemTongQuan) }} />
                                      </div>
                                    </div>

                                    <p className="text-gray-700">
                                      Thuộc tính ảnh hưởng nhất: <br />
                                      <span className="font-semibold text-gray-900 leading-relaxed inline-block mt-0.5">
                                        {aiStatsData.insight?.thuocTinhAnhHuongNhat?.label || aiStatsData.insight?.thuocTinhAnhHuongNhat?.key || 'Chưa có'}
                                      </span>
                                    </p>



                                    <button
                                      type="button"
                                      onClick={() => openAiReportModal(aiStatsPayload, biz.name)}
                                      className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-amber-800 font-medium hover:bg-amber-100 hover:border-amber-400 transition-colors duration-200"
                                    >
                                      Xem báo cáo AI chi tiết
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!loading && activeSection === SECTION_DOCUMENTS && (
            <div className="px-5 pb-5">
              {dashboard.documents.length === 0 ? (
                <p className="text-sm text-gray-500">Chưa có tin tức/công văn/nghị quyết.</p>
              ) : (
                <ul className="space-y-3">
                  {dashboard.documents.map((doc) => (
                    <li key={doc.id} className="rounded-md border border-gray-200 bg-[#fcfcfc] p-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[11px] px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-700">{doc.categoryLabel}</span>
                        {doc.isPinned && <span className="text-[11px] px-2 py-0.5 rounded border border-red-200 bg-red-50 text-red-700">Ưu tiên</span>}
                      </div>
                      <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{doc.summary || 'Không có tóm tắt'}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>
                          {doc.documentNumber ? `${doc.documentNumber} • ` : ''}
                          {doc.issuedBy || 'Đơn vị ban hành'} • {formatDate(doc.publishedAt)}
                        </span>
                        {doc.externalUrl && (
                          <a
                            href={doc.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded border border-[#8B2500] text-[#8B2500] hover:bg-[#8B2500] hover:text-white transition-colors"
                          >
                            Mở văn bản
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!loading && activeSection === SECTION_REQUESTS && (
            <div className="px-5 pb-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((item) => (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => setSelectedStatus(item.status)}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${selectedStatus === item.status
                        ? 'bg-[#8B2500] text-white border-[#8B2500]'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#8B2500]'
                      }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>

              {filteredRequests.length === 0 ? (
                <p className="text-sm text-gray-500">Không có hồ sơ phù hợp trạng thái đã chọn.</p>
              ) : (
                <ul className="space-y-3">
                  {filteredRequests.map((item) => {
                    const draftStatus = requestStatusDrafts[item.id] || item.status
                    const draftNote = requestNoteDrafts[item.id] ?? ''
                    const currentNote = item.officialNote || ''
                    const isUnchanged = draftStatus === item.status && draftNote.trim() === currentNote.trim()

                    return (
                      <li key={item.id} className="rounded-md border border-gray-200 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{toRequestCode(item.id)} • {item.requestType}</h3>
                            <p className="text-sm text-gray-600 mt-1">{item.businessName}</p>
                            <p className="text-xs text-gray-500 mt-1">{item.businessAddress}</p>
                            <p className="text-xs text-gray-500 mt-1">Người nộp: {item.citizen.fullName} ({item.citizen.phone || 'Chưa có'})</p>
                          </div>
                          <span className={`inline-flex text-xs rounded border px-2 py-1 ${statusBadgeClass(item.status)}`}>
                            {item.statusLabel}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr_auto] gap-2 mt-3">
                          <select
                            value={draftStatus}
                            onChange={(e) => setRequestStatusDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="h-9 border border-gray-300 px-3 text-sm"
                          >
                            <option value="pending">Chờ xử lý</option>
                            <option value="approved">Đã phê duyệt</option>
                            <option value="additional_info_required">Yêu cầu bổ sung</option>
                            <option value="rejected">Bị từ chối</option>
                          </select>

                          <input
                            type="text"
                            value={draftNote}
                            onChange={(e) => setRequestNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="h-9 border border-gray-300 px-3 text-sm"
                            placeholder="Ghi chú xử lý..."
                          />

                          <button
                            type="button"
                            onClick={() => handleUpdateRequestStatus(item.id)}
                            disabled={updatingRequestId === item.id || isUnchanged}
                            className="h-9 px-4 rounded bg-[#8B2500] text-white text-sm hover:bg-[#6B1A00] disabled:opacity-60"
                          >
                            {updatingRequestId === item.id ? 'Đang lưu...' : 'Lưu trạng thái'}
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span>Nộp: {formatDateTime(item.submittedAt)} • Cập nhật: {formatDateTime(item.updatedAt)}</span>
                          <button
                            type="button"
                            onClick={() => navigate(`/can-bo/ho-so/${item.id}`)}
                            className="px-3 py-1.5 rounded border border-[#8B2500] text-[#8B2500] hover:bg-[#8B2500] hover:text-white transition-colors"
                          >
                            Xem chi tiết nội dung hồ sơ
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      </main>

      {aiModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Đóng popup AI"
            onClick={() => setAiModal((prev) => ({ ...prev, open: false }))}
          />

          <section className="relative z-10 w-full max-w-5xl rounded-lg border border-[#e3d8d1] bg-white shadow-2xl max-h-[88vh] overflow-hidden">
            <div className="bg-gradient-to-r from-[#552104] via-[#8B2500] to-[#c65429] text-white px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-bold">Báo cáo AI trực quan</h2>
                <p className="text-sm text-[#ffe6d8] mt-1">Cơ sở: {aiModal.businessName}</p>
              </div>

              <div className="flex items-center gap-2">
                {aiModalResult && (
                  <span className={`inline-flex text-xs rounded border px-2 py-1 ${aiModalSentimentMeta.tone}`}>
                    Sentiment: {aiModalSentimentMeta.label}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setAiModal((prev) => ({ ...prev, open: false }))}
                  className="h-8 w-8 rounded border border-white/60 hover:bg-white/15"
                  aria-label="Đóng"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 overflow-auto max-h-[calc(88vh-86px)]">
              {!aiModalResult ? (
                <p className="text-sm text-gray-500">Chưa có dữ liệu AI để hiển thị.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 space-y-2">
                      <div className="text-gray-600">Điểm tổng quan</div>
                      <div className="font-bold text-gray-900 text-lg">
                        {formatAiScore(aiModalResult.diemTongQuan)} ({formatAiPercent(aiModalResult.diemTongQuan)})
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div className={`h-full ${aiModalScoreMeta.bar}`} style={{ width: formatAiPercent(aiModalResult.diemTongQuan) }} />
                      </div>
                    </div>

                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-gray-600">Mức rủi ro hiện tại</div>
                      <div className={`inline-flex mt-2 text-xs rounded border px-2 py-1 ${aiModalScoreMeta.tone}`}>
                        {aiModalScoreMeta.label}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">Sentiment tổng thể: {aiModalSentimentMeta.label}</p>
                    </div>

                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-gray-600">Review hợp lệ cho AI</div>
                      <div className="font-bold text-gray-900 text-lg">{aiModalInput?.tongReviewHopLeChoModel ?? 0}</div>
                      <p className="text-xs text-gray-600 mt-1">Tổng review lấy từ DB: {aiModalInput?.tongReviewLayTuDB ?? 0}</p>
                    </div>

                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-gray-600">Review đã tiền xử lý</div>
                      <div className="font-bold text-gray-900 text-lg">{aiModalInput?.tongReviewDaTienXuLySuDungChoModel ?? 0}</div>
                      <p className="text-xs text-gray-600 mt-1">
                        Thuộc tính ảnh hưởng nhất:{' '}
                        {aiModalResult?.insight?.thuocTinhAnhHuongNhat?.label || aiModalResult?.insight?.thuocTinhAnhHuongNhat?.key || 'Chưa có'}
                      </p>
                    </div>
                  </div>



                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <h3 className="font-semibold text-gray-900">Điểm thành phần</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {aiModalComponentEntries.map((item) => {
                        const itemMeta = getAiScoreMeta(item.score)

                        return (
                          <div key={item.key} className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-gray-900">{item.label}</p>
                              <span className={`text-[11px] rounded border px-2 py-0.5 ${itemMeta.tone}`}>{itemMeta.label}</span>
                            </div>
                            <p className="text-sm text-gray-700">{formatAiScore(item.score)} ({formatAiPercent(item.score)})</p>
                            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                              <div className={`h-full ${itemMeta.bar}`} style={{ width: formatAiPercent(item.score) }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <h3 className="font-semibold text-gray-900">Review đại diện cần xem lại</h3>
                      {aiModalRepresentativeReviews.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-2">Chưa có review đại diện trong kỳ phân tích.</p>
                      ) : (
                        <ul className="space-y-2 mt-2">
                          {aiModalRepresentativeReviews.map((reviewText, index) => (
                            <li key={`${index}-${reviewText.slice(0, 20)}`} className="rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">
                              <span className="font-semibold text-[#7d1f00]">#{index + 1}:</span> {reviewText}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <h3 className="font-semibold text-gray-900">Từ khóa tiêu cực nổi bật</h3>
                      {aiModalKeywords.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-2">Chưa ghi nhận cụm từ tiêu cực nổi bật.</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {aiModalKeywords.map((keyword) => (
                            <span
                              key={keyword}
                              className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-600 break-all">
                        Endpoint AI: {aiModalInput?.aiEndpoint || 'Không xác định'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {reviewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Đóng popup review"
            onClick={() => setReviewModal((prev) => ({ ...prev, open: false }))}
          />

          <section className="relative z-10 w-full max-w-4xl rounded-lg border border-[#e3d8d1] bg-white shadow-2xl max-h-[85vh] overflow-hidden">
            <div className="bg-gradient-to-r from-[#8B2500] via-[#a53a13] to-[#b9522a] text-white px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-xl font-bold">Danh sách review chi tiết</h2>
                <p className="text-sm text-[#fcebdc] mt-1">Cơ sở: {reviewModal.businessName}</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewModal((prev) => ({ ...prev, open: false }))}
                className="h-8 w-8 rounded border border-white/60 hover:bg-white/15"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-auto max-h-[calc(85vh-80px)]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-gray-600">Tổng lượt review</div>
                  <div className="font-semibold text-gray-900">{reviewModal.thongKeReview?.tongLuotReview ?? 0}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-gray-600">Điểm trung bình</div>
                  <div className="font-semibold text-gray-900">{formatAverageRating(reviewModal.thongKeReview?.diemTrungBinh)}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-gray-600">Bộ lọc ngày</div>
                  <div className="font-semibold text-gray-900">
                    {reviewModal.boLoc?.tuNgay || 'Không giới hạn'} → {reviewModal.boLoc?.denNgay || 'Không giới hạn'}
                  </div>
                </div>
              </div>

              {reviewModal.danhSachReview.length === 0 ? (
                <p className="text-sm text-gray-500">Không có review trong khoảng thời gian đã chọn.</p>
              ) : (
                <ul className="space-y-3">
                  {reviewModal.danhSachReview.map((review) => (
                    <li key={review.id} className="rounded border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{review.tenNguoiReview || 'Ẩn danh'}</p>
                        <span className="text-amber-600 font-medium" title={`${review.soSao}/10`}>{formatRatingStars(review.soSao)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Thời gian: {formatDateTime(review.thoiDiemReview)}</p>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap break-words">
                        {review.noiDung?.trim() ? review.noiDung : 'Không có nội dung review.'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
    <AiTestWidget />
  </>
  )
}
