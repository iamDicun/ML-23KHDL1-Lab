import express from 'express'
import { AiReuseImportController } from '../controllers/aiReuseImportController.js'
import { jwtAuth, requireRole } from '../middlewares/jwtAuth.js'

const router = express.Router()

router.use(jwtAuth, requireRole('official'))

router.post('/import/run', AiReuseImportController.startImportJob)
router.get('/import/jobs/latest', AiReuseImportController.getLatestJobStatus)
router.get('/import/jobs/:jobId', AiReuseImportController.getJobStatusById)
router.get('/import/stats', AiReuseImportController.getImportStats)

export default router