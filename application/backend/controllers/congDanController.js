import { CongDanService } from '../services/congDanService.js'
import { signAccessToken } from '../utils/jwt.js'

export const CongDanController = {
  // POST /cong-dan/dang-ky
  dangKyTaiKhoan: async (req, res, next) => {
    try {
      const result = await CongDanService.dangKyTaiKhoan(req.body)
      res.status(201).json(result)
    } catch (err) { next(err) }
  },

  // POST /cong-dan/dang-nhap/yeu-cau-otp
  yeuCauOtpDangNhap: async (req, res, next) => {
    try {
      const { sdt, matKhau } = req.body
      const result = await CongDanService.yeuCauOtpDangNhap(sdt, matKhau)
      res.json(result)
    } catch (err) { next(err) }
  },

  // Backward compatibility alias
  guiOtp: async (req, res, next) => {
    try {
      const { sdt, matKhau } = req.body
      const result = await CongDanService.yeuCauOtpDangNhap(sdt, matKhau)
      res.json(result)
    } catch (err) { next(err) }
  },

  // POST /cong-dan/dang-nhap/xac-nhan-otp
  xacNhanOtp: async (req, res, next) => {
    try {
      const { sdt, otp } = req.body
      const result = await CongDanService.xacNhanOtp(sdt, otp)
      const token = signAccessToken({
        sub: String(result.congDan.id),
        role: 'citizen',
        userType: 'cong-dan',
        userId: result.congDan.id,
        fullName: result.congDan.hoTen || null,
        phone: result.congDan.sdt
      })

      res.json({
        ...result,
        token,
        user: {
          id: result.congDan.id,
          role: 'citizen',
          userType: 'cong-dan',
          fullName: result.congDan.hoTen,
          phone: result.congDan.sdt,
          cccd: result.congDan.cccd,
          email: result.congDan.email
        }
      })
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
      if (Number(req.user.userId) !== Number(id)) {
        const err = new Error('Bạn không có quyền truy cập hồ sơ của người dùng khác'); err.statusCode = 403; throw err
      }
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
      if (Number(req.user.userId) !== Number(id)) {
        const err = new Error('Bạn không có quyền nộp hồ sơ cho người dùng khác'); err.statusCode = 403; throw err
      }
      const result = await CongDanService.nopHoSo(id, req.body)
      res.status(201).json(result)
    } catch (err) { next(err) }
  }
}

export default CongDanController
