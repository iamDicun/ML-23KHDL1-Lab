import express from 'express'
import { DanhGiaController } from '../controllers/danhGiaController.js'

const router = express.Router()

router.get('/tong-hop', DanhGiaController.getTongHopDanhGia)
router.get('/ho-so/:maHoSo', DanhGiaController.getThongTinHoSoDanhGia)
router.post('/', DanhGiaController.danhGiaHoSo)
router.delete('/ho-so/:maHoSo', DanhGiaController.huyDanhGiaHoSo)

export default router
