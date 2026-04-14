import express from 'express'
import { CanBoController } from '../controllers/canBoController.js'

const router = express.Router()

// Auth
router.post('/dang-nhap', CanBoController.dangNhap)

// Quản lý hồ sơ
router.get('/ho-so', CanBoController.getDanhSachHoSo)
router.put('/ho-so/:id/xu-ly', CanBoController.xuLyHoSo)

// Thống kê
router.get('/thong-ke', CanBoController.getThongKe)

// Danh sách cán bộ
router.get('/', CanBoController.getDanhSachCanBo)

export default router
