import express from 'express'
import { CanBoController } from '../controllers/canBoController.js'
import { jwtAuth, requireRole } from '../middlewares/jwtAuth.js'

const router = express.Router()

// Auth
router.post('/dang-nhap', CanBoController.dangNhap)

router.use(jwtAuth, requireRole('official'))

// Quản lý hồ sơ
router.get('/ho-so', CanBoController.getDanhSachHoSo)
router.get('/ho-so/:id', CanBoController.getHoSoChiTiet)
router.put('/ho-so/:id/xu-ly', CanBoController.xuLyHoSo)

// Dashboard quản lý
router.get('/dashboard', CanBoController.getDashboard)

// Thống kê
router.get('/thong-ke', CanBoController.getThongKe)
router.get('/co-so/:coSoId/review-thong-ke', CanBoController.getThongKeReviewTheoCoSo)
router.get('/co-so/:coSoId/thong-ke-ai', CanBoController.getThongKeAiTheoCoSo)
router.post('/ai-test', CanBoController.testAiModel)

// Danh sách cán bộ
router.get('/', CanBoController.getDanhSachCanBo)

export default router
