import { AiReuseImportService } from '../services/aiReuseImportService.js'

export const AiReuseImportController = {
  // POST /ai-reuse/import/run
  startImportJob: async (req, res, next) => {
    try {
      const { pythonExecutable } = req.body || {}
      const result = AiReuseImportService.startImportJob({ pythonExecutable })

      res.status(202).json({
        message: 'Đã bắt đầu job preprocess/import',
        job: result
      })
    } catch (err) {
      next(err)
    }
  },

  // GET /ai-reuse/import/jobs/latest
  getLatestJobStatus: async (req, res, next) => {
    try {
      const result = AiReuseImportService.getJobStatus()
      res.json({
        hasJob: Boolean(result),
        job: result
      })
    } catch (err) {
      next(err)
    }
  },

  // GET /ai-reuse/import/jobs/:jobId
  getJobStatusById: async (req, res, next) => {
    try {
      const { jobId } = req.params
      const result = AiReuseImportService.getJobStatus(jobId)
      res.json({ job: result })
    } catch (err) {
      next(err)
    }
  },

  // GET /ai-reuse/import/stats
  getImportStats: async (req, res, next) => {
    try {
      const result = await AiReuseImportService.getImportStats()
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
}

export default AiReuseImportController