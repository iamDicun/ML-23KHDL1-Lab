import express from 'express'
import { CongDanController } from '../controllers/congDanController.js'

const router = express.Router()

// Auth
router.post('/dang-nhap/gui-otp', CongDanController.guiOtp)
router.post('/dang-nhap/xac-nhan-otp', CongDanController.xacNhanOtp)
router.post('/dang-nhap/vneid', CongDanController.dangNhapVneId)

// Hồ sơ
router.get('/tra-cuu/:maSo', CongDanController.traCuuHoSo)
router.get('/:id/ho-so', CongDanController.getDanhSachHoSo)
router.post('/:id/ho-so', CongDanController.nopHoSo)

export default router
