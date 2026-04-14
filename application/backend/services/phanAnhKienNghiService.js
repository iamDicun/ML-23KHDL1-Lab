import { PhanAnhKienNghiDbModel } from '../models/phanAnhKienNghiDbModel.js'

const OBJECT_TYPE_LABELS = {
  citizen: 'Cá nhân',
  business: 'Doanh nghiệp',
  organization: 'Tổ chức / đơn vị sự nghiệp'
}

const STATUS_LABELS = {
  received: 'Đã tiếp nhận',
  reviewing: 'Đang xem xét',
  resolved: 'Đã phản hồi'
}

const normalizePetitionStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase()

  if (raw === 'received' || raw === 'da tiep nhan' || raw === 'đã tiếp nhận') return 'received'
  if (raw === 'reviewing' || raw === 'dang xem xet' || raw === 'đang xem xét') return 'reviewing'
  if (raw === 'resolved' || raw === 'da phan hoi' || raw === 'đã phản hồi') return 'resolved'

  return raw
}

const normalizeObjectType = (value) => {
  const raw = String(value || '').trim().toLowerCase()

  if (raw === 'citizen' || raw === 'ca nhan' || raw === 'cá nhân') return 'citizen'
  if (raw === 'business' || raw === 'doanh nghiep' || raw === 'doanh nghiệp') return 'business'
  if (raw === 'organization' || raw === 'to chuc' || raw === 'tổ chức' || raw === 'to chuc / don vi su nghiep' || raw === 'tổ chức / đơn vị sự nghiệp') {
    return 'organization'
  }

  return raw
}

const cleanText = (value) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

const mapPetitionRow = (row) => ({
  id: row.id,
  maPhanAnh: row.code,
  doiTuong: row.object_type,
  doiTuongHienThi: OBJECT_TYPE_LABELS[row.object_type] || row.object_type,
  tenNguoiGui: row.reporter_name,
  tenToChuc: row.organization_name,
  soDienThoai: row.phone,
  email: row.email,
  tieuDe: row.title,
  noiDung: row.content,
  donViTiepNhan: row.receiving_unit,
  tepDinhKem: row.attachment_name,
  diaChi: {
    tinhThanh: row.province,
    quanHuyen: row.district,
    phuongXa: row.ward,
    chiTiet: row.address_detail
  },
  trangThai: row.status,
  trangThaiHienThi: STATUS_LABELS[row.status] || row.status,
  daTiepNhan: true,
  daXemXet: row.status !== 'received',
  daPhanHoi: row.status === 'resolved',
  ghiChuXuLy: row.processing_note,
  ngayTiepNhan: row.received_at,
  ngayXemXet: row.reviewed_at,
  ngayPhanHoi: row.resolved_at,
  ngayCapNhat: row.updated_at
})

export const PhanAnhKienNghiService = {
  guiPhanAnh: async ({
    doiTuong,
    tenNguoiGui,
    tenToChuc,
    tinhThanh,
    quanHuyen,
    phuongXa,
    diaChiChiTiet,
    soDienThoai,
    email,
    tieuDe,
    noiDung,
    donViTiepNhan,
    tepDinhKem
  }) => {
    const objectType = normalizeObjectType(doiTuong)
    if (!['citizen', 'business', 'organization'].includes(objectType)) {
      const err = new Error('Đối tượng phản ánh không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const reporterName = cleanText(tenNguoiGui)
    if (!reporterName) {
      const err = new Error('Tên người gửi phản ánh là bắt buộc')
      err.statusCode = 400
      throw err
    }

    const phone = cleanText(soDienThoai)
    if (!phone || !/^[0-9]{9,11}$/.test(phone)) {
      const err = new Error('Số điện thoại không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const safeEmail = cleanText(email)
    if (safeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      const err = new Error('Email không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const title = cleanText(tieuDe)
    if (!title) {
      const err = new Error('Tiêu đề phản ánh kiến nghị là bắt buộc')
      err.statusCode = 400
      throw err
    }

    const content = cleanText(noiDung)
    if (!content) {
      const err = new Error('Nội dung phản ánh kiến nghị là bắt buộc')
      err.statusCode = 400
      throw err
    }

    const receivingUnit = cleanText(donViTiepNhan)
    if (!receivingUnit) {
      const err = new Error('Đơn vị tiếp nhận là bắt buộc')
      err.statusCode = 400
      throw err
    }

    const saved = await PhanAnhKienNghiDbModel.createPetition({
      objectType,
      reporterName,
      organizationName: cleanText(tenToChuc),
      province: cleanText(tinhThanh),
      district: cleanText(quanHuyen),
      ward: cleanText(phuongXa),
      addressDetail: cleanText(diaChiChiTiet),
      phone,
      email: safeEmail,
      title,
      content,
      receivingUnit,
      attachmentName: cleanText(tepDinhKem)
    })

    return {
      message: 'Gửi phản ánh kiến nghị thành công',
      phanAnh: mapPetitionRow(saved)
    }
  },

  traCuuPhanAnh: async ({ q, soDienThoai, limit, submitterUserId }) => {
    const keyword = cleanText(q)
    const phone = cleanText(soDienThoai)

    const rows = await PhanAnhKienNghiDbModel.searchPetitions({
      keyword,
      phone,
      limit,
      submitterUserId: submitterUserId || null
    })

    const items = rows.map(mapPetitionRow)

    return {
      total: items.length,
      filters: {
        q: keyword,
        soDienThoai: phone
      },
      items,
      tongHop: {
        daTiepNhan: items.length,
        dangXemXet: items.filter((item) => item.trangThai === 'reviewing').length,
        daPhanHoi: items.filter((item) => item.trangThai === 'resolved').length,
        chuaXemXet: items.filter((item) => item.trangThai === 'received').length
      }
    }
  },

  capNhatTrangThaiPhanAnh: async ({ id, trangThai, ghiChu }) => {
    const petitionId = Number(id)
    if (!Number.isInteger(petitionId) || petitionId <= 0) {
      const err = new Error('ID phản ánh kiến nghị không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const normalizedStatus = normalizePetitionStatus(trangThai)
    if (!['received', 'reviewing', 'resolved'].includes(normalizedStatus)) {
      const err = new Error('Trạng thái không hợp lệ')
      err.statusCode = 400
      throw err
    }

    const updated = await PhanAnhKienNghiDbModel.updatePetitionStatus({
      id: petitionId,
      status: normalizedStatus,
      processingNote: cleanText(ghiChu)
    })

    if (!updated) {
      const err = new Error('Không tìm thấy phản ánh kiến nghị')
      err.statusCode = 404
      throw err
    }

    return {
      message: 'Cập nhật trạng thái phản ánh kiến nghị thành công',
      phanAnh: mapPetitionRow(updated)
    }
  },

  getThongKeXuLy: async () => {
    const rows = await PhanAnhKienNghiDbModel.countByStatus()
    const countMap = rows.reduce((acc, row) => {
      acc[row.status] = Number(row.count || 0)
      return acc
    }, {})

    const daTraLoi = countMap.resolved || 0
    const dangXuLy = (countMap.received || 0) + (countMap.reviewing || 0)

    return {
      daTraLoi,
      dangXuLy,
      chiTiet: {
        daTiepNhan: countMap.received || 0,
        dangXemXet: countMap.reviewing || 0,
        daPhanHoi: daTraLoi
      }
    }
  }
}

export default PhanAnhKienNghiService