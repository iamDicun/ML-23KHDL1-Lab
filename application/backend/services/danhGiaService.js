import { DanhGiaDbModel } from '../models/danhGiaDbModel.js'

const SATISFACTION_META = {
  very_satisfied: {
    label: 'Rất hài lòng',
    color: '#f2b311'
  },
  satisfied: {
    label: 'Hài lòng',
    color: '#9ccc32'
  },
  not_satisfied: {
    label: 'Không hài lòng',
    color: '#b9b3b6'
  }
}

const SATISFACTION_LEVELS = Object.keys(SATISFACTION_META)

const STATUS_LABELS = {
  pending: 'Chờ xử lý',
  approved: 'Đã phê duyệt',
  rejected: 'Bị từ chối',
  additional_info_required: 'Yêu cầu bổ sung'
}

const toRequestCode = (requestId) => `HS-${String(requestId).padStart(6, '0')}`

const parseRequestIdFromCode = (maHoSo) => {
  const raw = String(maHoSo || '').trim().toUpperCase()
  if (!raw) {
    const err = new Error('Mã hồ sơ là bắt buộc')
    err.statusCode = 400
    throw err
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw)
  }

  const prefixedMatch = raw.match(/^HS-?(\d+)$/)
  if (prefixedMatch) {
    return Number(prefixedMatch[1])
  }

  const err = new Error('Mã hồ sơ không hợp lệ. Ví dụ: HS-000001')
  err.statusCode = 400
  throw err
}

const mapRatingDetail = (ratingRow) => {
  if (!ratingRow) return null

  const meta = SATISFACTION_META[ratingRow.satisfaction_level] || {
    label: ratingRow.satisfaction_level,
    color: '#64748b'
  }

  return {
    id: ratingRow.id,
    mucDoHaiLong: ratingRow.satisfaction_level,
    mucDoHienThi: meta.label,
    color: meta.color,
    ghiChu: ratingRow.note,
    ngayDanhGia: ratingRow.rated_at
  }
}

export const DanhGiaService = {
  getTongHopDanhGia: async () => {
    const rows = await DanhGiaDbModel.countRatingsBySatisfaction()

    const countMap = rows.reduce((acc, row) => {
      acc[row.satisfaction_level] = Number(row.count || 0)
      return acc
    }, {})

    const items = SATISFACTION_LEVELS.map((key) => ({
      key,
      label: SATISFACTION_META[key].label,
      color: SATISFACTION_META[key].color,
      count: countMap[key] || 0
    }))

    const total = items.reduce((sum, item) => sum + item.count, 0)

    return {
      total,
      items
    }
  },

  getThongTinHoSoDanhGia: async (maHoSo) => {
    const requestId = parseRequestIdFromCode(maHoSo)

    const hoSo = await DanhGiaDbModel.findRequestById(requestId)
    if (!hoSo) {
      const err = new Error('Không tìm thấy hồ sơ theo mã đã nhập')
      err.statusCode = 404
      throw err
    }

    const rating = await DanhGiaDbModel.findRatingByRequestId(requestId)

    return {
      hoSo: {
        id: hoSo.id,
        maSo: toRequestCode(hoSo.id),
        tenThuTuc: hoSo.request_type_name,
        tenCoSo: hoSo.business_name || 'Chưa cập nhật',
        trangThai: hoSo.status,
        trangThaiHienThi: STATUS_LABELS[hoSo.status] || hoSo.status,
        congDan: {
          hoTen: hoSo.citizen_name,
          sdt: hoSo.citizen_phone
        },
        ngayNop: hoSo.created_at,
        ngayCapNhat: hoSo.updated_at
      },
      danhGia: mapRatingDetail(rating)
    }
  },

  danhGiaHoSo: async ({ maHoSo, mucDoHaiLong, ghiChu }) => {
    if (!SATISFACTION_LEVELS.includes(mucDoHaiLong)) {
      const err = new Error('Mức độ hài lòng không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const requestId = parseRequestIdFromCode(maHoSo)
    const hoSo = await DanhGiaDbModel.findRequestById(requestId)

    if (!hoSo) {
      const err = new Error('Không tìm thấy hồ sơ theo mã đã nhập')
      err.statusCode = 404
      throw err
    }

    const saved = await DanhGiaDbModel.createRating({
      requestId,
      citizenId: hoSo.citizen_id,
      satisfactionLevel: mucDoHaiLong,
      note: ghiChu
    })

    return {
      message: 'Đánh giá hồ sơ thành công',
      hoSo: {
        id: hoSo.id,
        maSo: toRequestCode(hoSo.id),
        tenThuTuc: hoSo.request_type_name,
        tenCoSo: hoSo.business_name || 'Chưa cập nhật',
        trangThai: hoSo.status,
        trangThaiHienThi: STATUS_LABELS[hoSo.status] || hoSo.status
      },
      danhGia: mapRatingDetail(saved)
    }
  },

  huyDanhGiaHoSo: async (maHoSo) => {
    const requestId = parseRequestIdFromCode(maHoSo)

    const hoSo = await DanhGiaDbModel.findRequestById(requestId)
    if (!hoSo) {
      const err = new Error('Không tìm thấy hồ sơ theo mã đã nhập')
      err.statusCode = 404
      throw err
    }

    const deletedCount = await DanhGiaDbModel.deleteLatestRatingByRequestId(requestId)

    return {
      message: deletedCount > 0
        ? 'Đã hủy lượt đánh giá gần nhất của hồ sơ'
        : 'Hồ sơ hiện chưa có đánh giá để hủy',
      deleted: deletedCount > 0,
      hoSo: {
        id: hoSo.id,
        maSo: toRequestCode(hoSo.id)
      }
    }
  }
}

export default DanhGiaService
