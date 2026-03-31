import { CanBoService } from '../services/canBoService.js'

export const CanBoController = {
  // POST /can-bo/dang-nhap
  dangNhap: async (req, res, next) => {
    try {
      const { taiKhoan, matKhau } = req.body
      const result = await CanBoService.dangNhap(taiKhoan, matKhau)
      res.json(result)
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

  // PUT /can-bo/ho-so/:id/xu-ly
  xuLyHoSo: async (req, res, next) => {
    try {
      const { id } = req.params
      const { canBoId, trangThai, ghiChu } = req.body
      const result = await CanBoService.xuLyHoSo(id, canBoId, trangThai, ghiChu)
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

  // GET /can-bo
  getDanhSachCanBo: async (req, res, next) => {
    try {
      const result = await CanBoService.getDanhSachCanBo()
      res.json(result)
    } catch (err) { next(err) }
  }
}

export default CanBoController
