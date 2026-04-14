import express from 'express'
import { PhanAnhKienNghiController } from '../controllers/phanAnhKienNghiController.js'
import { jwtAuth, requireRole } from '../middlewares/jwtAuth.js'

const router = express.Router()

router.get('/thong-ke', PhanAnhKienNghiController.getThongKeXuLy)
router.get('/tra-cuu', PhanAnhKienNghiController.traCuuPhanAnh)
router.post('/', PhanAnhKienNghiController.guiPhanAnh)
router.put('/:id/trang-thai', jwtAuth, requireRole('official'), PhanAnhKienNghiController.capNhatTrangThai)

export default router