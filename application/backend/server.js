import express from 'express'
import cors from 'cors'
import { config } from './config/env.js'
import { initDatabase } from './config/database.js'
import congDanRoutes from './routes/congDanRoutes.js'
import canBoRoutes from './routes/canBoRoutes.js'
import danhGiaRoutes from './routes/danhGiaRoutes.js'
import phanAnhKienNghiRoutes from './routes/phanAnhKienNghiRoutes.js'
import aiReuseImportRoutes from './routes/aiReuseImportRoutes.js'
import { apiKeyAuth } from './middlewares/apiKeyAuth.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'

const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Cổng Dịch Vụ Công - Bộ VHTTDL API',
    version: '1.0.0',
    environment: config.nodeEnv,
    endpoints: {
      congDan: '/cong-dan',
      canBo: '/can-bo',
      danhGia: '/danh-gia',
      phanAnhKienNghi: '/phan-anh-kien-nghi',
      aiReuseImport: '/ai-reuse'
    }
  })
})

// API Key authentication middleware for all API endpoints.
app.use(apiKeyAuth)

// Routes
app.use('/cong-dan', congDanRoutes)
app.use('/can-bo', canBoRoutes)
app.use('/danh-gia', danhGiaRoutes)
app.use('/phan-anh-kien-nghi', phanAnhKienNghiRoutes)
app.use('/ai-reuse', aiReuseImportRoutes)

// Error handling
app.use(notFound)
app.use(errorHandler)

// Start server
const startServer = async () => {
  try {
    await initDatabase()
    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`)
      console.log(`📝 Environment: ${config.nodeEnv}`)
      console.log(`📋 Endpoints: /cong-dan | /can-bo | /danh-gia | /phan-anh-kien-nghi | /ai-reuse`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

