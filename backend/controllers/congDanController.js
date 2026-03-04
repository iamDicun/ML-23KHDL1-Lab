import { CongDanService } from '../services/congDanService.js'

export const CongDanController = {
  // POST /cong-dan/dang-nhap/gui-otp
  guiOtp: async (req, res, next) => {
    try {
      const { sdt } = req.body
      const result = await CongDanService.guiOtp(sdt)
      res.json(result)
    } catch (err) { next(err) }
  },

  // POST /cong-dan/dang-nhap/xac-nhan-otp
  xacNhanOtp: async (req, res, next) => {
    try {
      const { sdt, otp } = req.body
      const result = await CongDanService.xacNhanOtp(sdt, otp)
      res.json(result)
    } catch (err) { next(err) }
  },

  // POST /cong-dan/dang-nhap/vneid
  dangNhapVneId: async (req, res, next) => {
    try {
      const { token } = req.body
      const result = await CongDanService.dangNhapVneId(token)
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /cong-dan/:id/ho-so
  getDanhSachHoSo: async (req, res, next) => {
    try {
      const { id } = req.params
      const result = await CongDanService.getDanhSachHoSo(id)
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /cong-dan/tra-cuu/:maSo
  traCuuHoSo: async (req, res, next) => {
    try {
      const { maSo } = req.params
      const result = await CongDanService.traCuuHoSo(maSo)
      res.json(result)
    } catch (err) { next(err) }
  },

  // POST /cong-dan/:id/ho-so
  nopHoSo: async (req, res, next) => {
    try {
      const { id } = req.params
      const result = await CongDanService.nopHoSo(id, req.body)
      res.status(201).json(result)
    } catch (err) { next(err) }
  }
}

export default CongDanController
