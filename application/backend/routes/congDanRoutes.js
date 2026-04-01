import express from 'express'
import { CongDanController } from '../controllers/congDanController.js'
import { jwtAuth, requireRole } from '../middlewares/jwtAuth.js'

const router = express.Router()

// Auth
router.post('/dang-ky', CongDanController.dangKyTaiKhoan)
router.post('/dang-nhap/yeu-cau-otp', CongDanController.yeuCauOtpDangNhap)
router.post('/dang-nhap/gui-otp', CongDanController.guiOtp)
router.post('/dang-nhap/xac-nhan-otp', CongDanController.xacNhanOtp)
router.post('/dang-nhap/vneid', CongDanController.dangNhapVneId)

// Hồ sơ
router.get('/tra-cuu/:maSo', CongDanController.traCuuHoSo)
router.get('/:id/ho-so', jwtAuth, requireRole('citizen'), CongDanController.getDanhSachHoSo)
router.post('/:id/ho-so', jwtAuth, requireRole('citizen'), CongDanController.nopHoSo)

export default router
