import { UserDbModel } from '../models/userDbModel.js'
import { query } from '../config/database.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

const ONLINE_SERVICE_PROCEDURE_NAME = 'Tạo hồ sơ đăng kí cơ sở kinh doanh'
const ONLINE_SERVICE_PROCEDURE_DESCRIPTION = 'Hồ sơ đăng kí cơ sở kinh doanh trực tuyến trên Cổng DVC'

const HO_SO_STATUS_MAP = {
  pending: 'Chờ xử lý',
  approved: 'Đã phê duyệt',
  rejected: 'Bị từ chối',
  additional_info_required: 'Yêu cầu bổ sung'
}

const HO_SO_STATUS_ALIASES = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  additional_info_required: 'additional_info_required',
  cho_xu_ly: 'pending',
  da_phe_duyet: 'approved',
  bi_tu_choi: 'rejected',
  yeu_cau_bo_sung: 'additional_info_required'
}

const normalizeHoSoStatus = (status) => {
  if (!status) return null
  const raw = String(status).trim().toLowerCase()
  return HO_SO_STATUS_ALIASES[raw] || null
}

const parseRequestIdFromLookup = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return null

  const prefixed = raw.match(/^HS-?(\d{1,12})$/)
  if (prefixed) return Number(prefixed[1])

  if (/^\d{1,6}$/.test(raw)) return Number(raw)

  return null
}

const toRequestCode = (requestId) => `HS-${String(requestId).padStart(6, '0')}`

const mapHoSoRow = (row) => ({
  id: row.id,
  maSo: toRequestCode(row.id),
  tenThuTuc: row.request_type_name,
  tenCoSo: row.business_name || 'Chưa cập nhật',
  diaChi: row.business_address || 'Chưa cập nhật',
  nguoiNop: {
    hoTen: row.citizen_name || 'Chưa cập nhật',
    sdt: row.citizen_phone || 'Chưa cập nhật'
  },
  trangThai: row.status,
  trangThaiHienThi: HO_SO_STATUS_MAP[row.status] || row.status,
  ghiChu: row.official_note,
  ngayNop: row.created_at,
  ngayCapNhat: row.updated_at,
  duLieuKhaiBao: row.data || null
})

const getRegistrationRequestById = async (requestId) => {
  const result = await query(
    `SELECT
       rr.id,
       rr.status,
       rr.official_note,
       rr.created_at,
       rr.updated_at,
       rr.data,
       bt.name AS request_type_name,
       u.full_name AS citizen_name,
       u.phone AS citizen_phone,
       COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo', rr.data->>'tenCoSoKinhDoanh') AS business_name,
       COALESCE(rr.data->>'address', rr.data->>'diaChi', rr.data->>'diaChiDangKy') AS business_address
     FROM registration_requests rr
     LEFT JOIN users u ON u.id = rr.citizen_id
     INNER JOIN business_types bt ON bt.id = rr.request_type
     WHERE rr.id = $1
     LIMIT 1`,
    [requestId]
  )

  return result.rows[0] || null
}

const getRegistrationRequestByIdAndCitizenId = async (requestId, citizenId) => {
  const result = await query(
    `SELECT
       rr.id,
       rr.status,
       rr.official_note,
       rr.created_at,
       rr.updated_at,
       rr.data,
       bt.name AS request_type_name,
       u.full_name AS citizen_name,
       u.phone AS citizen_phone,
       COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo', rr.data->>'tenCoSoKinhDoanh') AS business_name,
       COALESCE(rr.data->>'address', rr.data->>'diaChi', rr.data->>'diaChiDangKy') AS business_address
     FROM registration_requests rr
     LEFT JOIN users u ON u.id = rr.citizen_id
     INNER JOIN business_types bt ON bt.id = rr.request_type
     WHERE rr.id = $1 AND rr.citizen_id = $2
     LIMIT 1`,
    [requestId, citizenId]
  )

  return result.rows[0] || null
}

const ensureOnlineServiceRequestTypeId = async () => {
  const result = await query(
    `INSERT INTO business_types(name, description)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE
       SET description = EXCLUDED.description
     RETURNING id`,
    [ONLINE_SERVICE_PROCEDURE_NAME, ONLINE_SERVICE_PROCEDURE_DESCRIPTION]
  )

  return Number(result.rows[0].id)
}

export const CongDanService = {
  dangKyTaiKhoan: async ({ sdt, matKhau, hoTen, email }) => {
    if (!sdt || !/^[0-9]{10,11}$/.test(sdt)) {
      const err = new Error('Số điện thoại không hợp lệ'); err.statusCode = 400; throw err
    }
    if (!matKhau || matKhau.length < 6) {
      const err = new Error('Mật khẩu phải có ít nhất 6 ký tự'); err.statusCode = 400; throw err
    }
    if (!hoTen) {
      const err = new Error('Họ tên là bắt buộc'); err.statusCode = 400; throw err
    }

    const isPhoneExists = await UserDbModel.existsByPhone(sdt)
    if (isPhoneExists) {
      const err = new Error('Số điện thoại đã được sử dụng'); err.statusCode = 409; throw err
    }

    let username = `citizen_${sdt}`
    let suffix = 1
    while (await UserDbModel.existsByUsername(username)) {
      username = `citizen_${sdt}_${suffix++}`
    }

    const passwordHash = await hashPassword(matKhau)
    const created = await UserDbModel.createCitizen({
      username,
      passwordHash,
      fullName: hoTen,
      email: email || null,
      phone: sdt
    })

    return {
      message: 'Đăng ký tài khoản thành công',
      congDan: {
        id: created.id,
        sdt: created.phone,
        hoTen: created.fullName,
        email: created.email,
        createdAt: created.createdAt
      }
    }
  },

  // Đăng nhập công dân bằng SĐT + mật khẩu
  dangNhap: async (sdt, matKhau) => {
    if (!sdt || !/^[0-9]{10,11}$/.test(sdt)) {
      const err = new Error('Số điện thoại không hợp lệ'); err.statusCode = 400; throw err
    }
    if (!matKhau) {
      const err = new Error('Mật khẩu là bắt buộc'); err.statusCode = 400; throw err
    }

    const congDan = await UserDbModel.findCitizenByPhone(sdt)
    if (!congDan) {
      const err = new Error('Không tìm thấy tài khoản công dân theo số điện thoại'); err.statusCode = 404; throw err
    }

    const isPasswordValid = await verifyPassword(matKhau, congDan.passwordHash)
    if (!isPasswordValid) {
      const err = new Error('Mật khẩu không chính xác'); err.statusCode = 401; throw err
    }

    return {
      message: 'Đăng nhập thành công',
      congDan: {
        id: congDan.id,
        sdt: congDan.phone,
        hoTen: congDan.fullName,
        cccd: '',
        email: congDan.email,
        createdAt: congDan.createdAt
      }
    }
  },

  // Đăng nhập VNeID (placeholder)
  dangNhapVneId: async (token) => {
    if (!token) {
      const err = new Error('Token VNeID không hợp lệ'); err.statusCode = 400; throw err
    }
    // TODO: xác thực với VNeID API
    return { message: 'Xác thực VNeID - chưa tích hợp' }
  },

  // Thống kê tình hình thụ lý hồ sơ theo năm (công khai)
  getThongKeThuLy: async (nam) => {
    const currentYear = new Date().getFullYear()
    const year = Number(nam || currentYear)

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      const err = new Error('Năm thống kê không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const result = await query(
      `SELECT
         EXTRACT(MONTH FROM created_at)::INTEGER AS month,
         COUNT(*)::INTEGER AS received,
         COUNT(*) FILTER (WHERE status IN ('approved', 'rejected'))::INTEGER AS resolved
       FROM registration_requests
       WHERE EXTRACT(YEAR FROM created_at) = $1
       GROUP BY month
       ORDER BY month`,
      [year]
    )

    const monthMap = new Map(result.rows.map((row) => [Number(row.month), row]))
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const found = monthMap.get(month) || { received: 0, resolved: 0 }
      const received = Number(found.received || 0)
      const resolved = Number(found.resolved || 0)

      return {
        thang: month,
        tiepNhan: received,
        giaiQuyet: resolved,
        tiLeHanDung: received > 0 ? Math.round((resolved / received) * 100) : 0
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

  // Tra cứu tình trạng hồ sơ công khai từ DB
  getDanhSachTraCuuHoSo: async ({ citizenId, q, trangThai, limit } = {}) => {
    const normalizedCitizenId = Number(citizenId)
    if (!Number.isInteger(normalizedCitizenId) || normalizedCitizenId <= 0) {
      const err = new Error('ID công dân không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const normalizedStatus = normalizeHoSoStatus(trangThai)
    if (trangThai && !normalizedStatus) {
      const err = new Error('Trạng thái tra cứu không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 200)
    const keyword = String(q || '').trim()
    const parsedRequestId = parseRequestIdFromLookup(keyword)

    const params = []
    const whereClauses = []

    let sql = `SELECT
      rr.id,
      rr.status,
      rr.official_note,
      rr.created_at,
      rr.updated_at,
      rr.data,
      bt.name AS request_type_name,
      u.full_name AS citizen_name,
      u.phone AS citizen_phone,
      COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo', rr.data->>'tenCoSoKinhDoanh') AS business_name,
      COALESCE(rr.data->>'address', rr.data->>'diaChi', rr.data->>'diaChiDangKy') AS business_address
    FROM registration_requests rr
    LEFT JOIN users u ON u.id = rr.citizen_id
    INNER JOIN business_types bt ON bt.id = rr.request_type`

    params.push(normalizedCitizenId)
    whereClauses.push(`rr.citizen_id = $${params.length}`)

    if (normalizedStatus) {
      params.push(normalizedStatus)
      whereClauses.push(`rr.status = $${params.length}`)
    }

    if (keyword) {
      if (parsedRequestId) {
        params.push(parsedRequestId)
        whereClauses.push(`rr.id = $${params.length}`)
      } else {
        params.push(`%${keyword}%`)
        whereClauses.push(`(
          CONCAT('HS-', LPAD(rr.id::TEXT, 6, '0')) ILIKE $${params.length}
          OR bt.name ILIKE $${params.length}
          OR COALESCE(u.full_name, '') ILIKE $${params.length}
          OR COALESCE(u.phone, '') ILIKE $${params.length}
          OR COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo', rr.data->>'tenCoSoKinhDoanh', '') ILIKE $${params.length}
        )`)
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`
    }

    params.push(normalizedLimit)
    sql += ` ORDER BY rr.created_at DESC LIMIT $${params.length}`

    const result = await query(sql, params)

    const items = result.rows.map(mapHoSoRow)

    const tongHop = items.reduce((acc, item) => {
      acc.tongHoSo += 1
      if (item.trangThai === 'pending') acc.choXuLy += 1
      if (item.trangThai === 'approved') acc.daPheDuyet += 1
      if (item.trangThai === 'rejected') acc.biTuChoi += 1
      if (item.trangThai === 'additional_info_required') acc.yeuCauBoSung += 1
      return acc
    }, {
      tongHoSo: 0,
      choXuLy: 0,
      daPheDuyet: 0,
      biTuChoi: 0,
      yeuCauBoSung: 0
    })

    return {
      items,
      tongHop,
      boLoc: {
        q: keyword || null,
        trangThai: normalizedStatus || null,
        limit: normalizedLimit
      }
    }
  },

  // Lấy danh sách hồ sơ của công dân
  getDanhSachHoSo: async (congDanId) => {
    const citizenId = Number(congDanId)
    if (!Number.isInteger(citizenId) || citizenId <= 0) {
      const err = new Error('ID công dân không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const result = await query(
      `SELECT
         rr.id,
         rr.status,
         rr.official_note,
         rr.created_at,
         rr.updated_at,
         rr.data,
         bt.name AS request_type_name,
         u.full_name AS citizen_name,
         u.phone AS citizen_phone,
         COALESCE(rr.data->>'name', rr.data->>'business_name', rr.data->>'tenCoSo', rr.data->>'tenCoSoKinhDoanh') AS business_name,
         COALESCE(rr.data->>'address', rr.data->>'diaChi', rr.data->>'diaChiDangKy') AS business_address
       FROM registration_requests rr
       LEFT JOIN users u ON u.id = rr.citizen_id
       INNER JOIN business_types bt ON bt.id = rr.request_type
       WHERE rr.citizen_id = $1
       ORDER BY rr.created_at DESC`,
      [citizenId]
    )

    return result.rows.map(mapHoSoRow)
  },

  // Tra cứu hồ sơ theo mã số
  traCuuHoSo: async ({ citizenId, maSo }) => {
    const normalizedCitizenId = Number(citizenId)
    if (!Number.isInteger(normalizedCitizenId) || normalizedCitizenId <= 0) {
      const err = new Error('ID công dân không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const requestId = parseRequestIdFromLookup(maSo)
    if (!requestId) {
      const err = new Error('Mã số hồ sơ không hợp lệ. Ví dụ: HS-000001')
      err.statusCode = 400
      throw err
    }

    const hoSo = await getRegistrationRequestByIdAndCitizenId(requestId, normalizedCitizenId)
    if (!hoSo) {
      const err = new Error('Không tìm thấy hồ sơ thuộc tài khoản của bạn'); err.statusCode = 404; throw err
    }

    return mapHoSoRow(hoSo)
  },

  // Nộp hồ sơ
  nopHoSo: async (congDanId, data) => {
    if (!data.tenThuTuc) {
      const err = new Error('Tên thủ tục là bắt buộc'); err.statusCode = 400; throw err
    }

    const citizenId = Number(congDanId)
    if (!Number.isInteger(citizenId) || citizenId <= 0) {
      const err = new Error('ID công dân không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const congDan = await UserDbModel.findById(citizenId)
    if (!congDan || congDan.role !== 'citizen') {
      const err = new Error('Công dân không tồn tại'); err.statusCode = 404; throw err
    }

    const requestTypeId = await ensureOnlineServiceRequestTypeId()
    const normalizedPayload = {
      ...data,
      tenThuTuc: String(data.tenThuTuc || ONLINE_SERVICE_PROCEDURE_NAME),
      tenNguoiNop: data.hoTen || congDan.fullName,
      soDienThoai: data.soDienThoai || congDan.phone,
      email: data.thuDienTu || congDan.email || null,
      tenCoSoKinhDoanh: data.tenCoSoKinhDoanh || null,
      diaChiDangKy: data.diaChiDangKy || null,
      submittedFrom: 'online_public_service',
      submittedAt: new Date().toISOString()
    }

    const createdResult = await query(
      `INSERT INTO registration_requests (
         citizen_id,
         request_type,
         data,
         status,
         official_note
       )
       VALUES ($1, $2, $3::jsonb, 'pending', $4)
       RETURNING id`,
      [
        citizenId,
        requestTypeId,
        JSON.stringify(normalizedPayload),
        'Hồ sơ nộp trực tuyến từ cổng dịch vụ công'
      ]
    )

    const createdId = Number(createdResult.rows[0].id)
    const hoSo = await getRegistrationRequestById(createdId)

    return {
      message: 'Nộp hồ sơ thành công',
      hoSo: mapHoSoRow(hoSo)
    }
  }
}

export default CongDanService
