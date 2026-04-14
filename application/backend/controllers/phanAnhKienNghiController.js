import { PhanAnhKienNghiService } from '../services/phanAnhKienNghiService.js'

export const PhanAnhKienNghiController = {
  // POST /phan-anh-kien-nghi
  guiPhanAnh: async (req, res, next) => {
    try {
      const result = await PhanAnhKienNghiService.guiPhanAnh(req.body)
      res.status(201).json(result)
    } catch (err) { next(err) }
  },

  // GET /phan-anh-kien-nghi/tra-cuu?q=...&soDienThoai=...&limit=...
  traCuuPhanAnh: async (req, res, next) => {
    try {
      const { q, limit } = req.query
      let { soDienThoai } = req.query
      // If authenticated as citizen (non-official), force phone filter to their own phone
      const jwtUser = req.user
      if (jwtUser && jwtUser.role !== 'official' && jwtUser.phone) {
        soDienThoai = jwtUser.phone
      }
      const result = await PhanAnhKienNghiService.traCuuPhanAnh({ q, soDienThoai, limit, submitterUserId: null })
      res.json(result)
    } catch (err) { next(err) }
  },

  // PUT /phan-anh-kien-nghi/:id/trang-thai
  capNhatTrangThai: async (req, res, next) => {
    try {
      const { id } = req.params
      const { trangThai, ghiChu } = req.body
      const result = await PhanAnhKienNghiService.capNhatTrangThaiPhanAnh({ id, trangThai, ghiChu })
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /phan-anh-kien-nghi/thong-ke
  getThongKeXuLy: async (req, res, next) => {
    try {
      const result = await PhanAnhKienNghiService.getThongKeXuLy()
      res.json(result)
    } catch (err) { next(err) }
  }
}

export default PhanAnhKienNghiController