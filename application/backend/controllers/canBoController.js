import { CanBoService } from '../services/canBoService.js'
import { signAccessToken } from '../utils/jwt.js'

export const CanBoController = {
  // POST /can-bo/dang-nhap
  dangNhap: async (req, res, next) => {
    try {
      const { taiKhoan, matKhau } = req.body
      const result = await CanBoService.dangNhap(taiKhoan, matKhau)
      const token = signAccessToken({
        sub: String(result.canBo.id),
        role: 'official',
        userType: 'can-bo',
        userId: result.canBo.id,
        fullName: result.canBo.hoTen,
        username: result.canBo.taiKhoan
      })

      res.json({
        ...result,
        token,
        user: {
          id: result.canBo.id,
          role: 'official',
          userType: 'can-bo',
          fullName: result.canBo.hoTen,
          username: result.canBo.taiKhoan,
          donVi: result.canBo.donVi,
          chucVu: result.canBo.chucVu
        }
      })
    } catch (err) { next(err) }
  },

  // GET /can-bo/ho-so?trangThai=...
  getDanhSachHoSo: async (req, res, next) => {
    try {
      const { trangThai } = req.query
      const result = await CanBoService.getDanhSachHoSo(trangThai)
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /can-bo/ho-so/:id
  getHoSoChiTiet: async (req, res, next) => {
    try {
      const { id } = req.params
      const result = await CanBoService.getHoSoChiTiet(id)
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /can-bo/co-so/:coSoId/review-thong-ke?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
  getThongKeReviewTheoCoSo: async (req, res, next) => {
    try {
      const { coSoId } = req.params
      const { fromDate, toDate } = req.query
      const result = await CanBoService.getThongKeReviewTheoCoSo({ coSoId, fromDate, toDate })
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /can-bo/co-so/:coSoId/thong-ke-ai?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
  getThongKeAiTheoCoSo: async (req, res, next) => {
    try {
      const { coSoId } = req.params
      const { fromDate, toDate } = req.query
      const result = await CanBoService.getThongKeAiTheoCoSo({ coSoId, fromDate, toDate, officialUserId: req.user.userId })
      res.json(result)
    } catch (err) { next(err) }
  },

  // POST /can-bo/ai-test
  testAiModel: async (req, res, next) => {
    try {
      const { text, rating } = req.body
      const result = await CanBoService.testAiModel(text, rating)
      res.json(result)
    } catch (err) { next(err) }
  },

  // PUT /can-bo/ho-so/:id/xu-ly
  xuLyHoSo: async (req, res, next) => {
    try {
      const { id } = req.params
      const { trangThai, ghiChu } = req.body
      const result = await CanBoService.xuLyHoSo(id, Number(req.user.userId), trangThai, ghiChu)
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /can-bo/thong-ke?nam=2025
  getThongKe: async (req, res, next) => {
    try {
      const { nam } = req.query
      const result = await CanBoService.getThongKe(nam)
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /can-bo/dashboard
  getDashboard: async (req, res, next) => {
    try {
      const result = await CanBoService.getDashboard(req.user.userId)
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /can-bo
  getDanhSachCanBo: async (req, res, next) => {
    try {
      const result = await CanBoService.getDanhSachCanBo()
      res.json(result)
    } catch (err) { next(err) }
  }
}

export default CanBoController
