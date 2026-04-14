import { DanhGiaService } from '../services/danhGiaService.js'

export const DanhGiaController = {
  // GET /danh-gia/tong-hop
  getTongHopDanhGia: async (req, res, next) => {
    try {
      const result = await DanhGiaService.getTongHopDanhGia()
      res.json(result)
    } catch (err) { next(err) }
  },

  // GET /danh-gia/ho-so/:maHoSo
  getThongTinHoSoDanhGia: async (req, res, next) => {
    try {
      const { maHoSo } = req.params
      const result = await DanhGiaService.getThongTinHoSoDanhGia(maHoSo)
      res.json(result)
    } catch (err) { next(err) }
  },

  // POST /danh-gia
  danhGiaHoSo: async (req, res, next) => {
    try {
      const { maHoSo, mucDoHaiLong, ghiChu } = req.body
      const result = await DanhGiaService.danhGiaHoSo({ maHoSo, mucDoHaiLong, ghiChu })
      res.status(201).json(result)
    } catch (err) { next(err) }
  },

  // DELETE /danh-gia/ho-so/:maHoSo
  huyDanhGiaHoSo: async (req, res, next) => {
    try {
      const { maHoSo } = req.params
      const result = await DanhGiaService.huyDanhGiaHoSo(maHoSo)
      res.json(result)
    } catch (err) { next(err) }
  }
}

export default DanhGiaController
