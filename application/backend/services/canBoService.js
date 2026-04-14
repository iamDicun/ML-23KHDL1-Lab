import { CanBoDbModel } from '../models/canBoDbModel.js'
import { UserDbModel } from '../models/userDbModel.js'
import { verifyPassword } from '../utils/password.js'

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

const mapStatusLabel = (status) => STATUS_MAP[status] || status
const normalizeStatus = (status) => STATUS_ALIASES[status] || status

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

  getThongKeReviewTheoCoSo: async ({ businessId, fromDate, toDate }) => {
    const normalizedBusinessId = Number(businessId)
    if (!Number.isInteger(normalizedBusinessId) || normalizedBusinessId <= 0) {
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

    const business = await CanBoDbModel.findBusinessById(normalizedBusinessId)
    if (!business) {
      const err = new Error('Không tìm thấy cơ sở kinh doanh')
      err.statusCode = 404
      throw err
    }

    const stats = await CanBoDbModel.getBusinessReviewStats({
      businessId: normalizedBusinessId,
      fromDate: normalizedFromDate,
      toDate: normalizedToDate
    })

    const reviews = await CanBoDbModel.findBusinessReviews({
      businessId: normalizedBusinessId,
      fromDate: normalizedFromDate,
      toDate: normalizedToDate,
      limit: 300
    })

    return {
      coSo: {
        id: business.id,
        tenCoSo: business.name,
        diaChi: business.address,
        loaiHinh: business.business_type,
        trangThai: business.status
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
      totalBusinesses,
      businesses,
      requestRows,
      requestStatusRows,
      todayTaskRows,
      documentRows
    ] = await Promise.all([
      CanBoDbModel.countBusinesses(),
      CanBoDbModel.findBusinesses(5000),
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
        totalBusinesses,
        totalRequests,
        pendingRequests: statusCountMap.pending || 0,
        todayTasks: todayTasks.length
      },
      businesses,
      requests,
      requestStatusSummary,
      todayTasks,
      documents,
      aiFeature: {
        enabled: false,
        label: 'AI dự đoán xu hướng (sẽ bổ sung sau)'
      }
    }
  }
}

export default CanBoService
