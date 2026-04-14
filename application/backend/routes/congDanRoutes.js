import express from 'express'
import { CongDanController } from '../controllers/congDanController.js'
import { jwtAuth, requireRole } from '../middlewares/jwtAuth.js'

const router = express.Router()

// Auth
router.post('/dang-ky', CongDanController.dangKyTaiKhoan)
router.post('/dang-nhap', CongDanController.dangNhap)
router.post('/dang-nhap/vneid', CongDanController.dangNhapVneId)

// Hồ sơ
router.get('/tra-cuu', CongDanController.getDanhSachTraCuuHoSo)
router.get('/tra-cuu/:maSo', CongDanController.traCuuHoSo)
router.get('/thong-ke-thu-ly', CongDanController.getThongKeThuLy)
router.get('/:id/ho-so', jwtAuth, requireRole('citizen'), CongDanController.getDanhSachHoSo)
router.post('/:id/ho-so', jwtAuth, requireRole('citizen'), CongDanController.nopHoSo)

export default router
