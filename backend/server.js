import express from 'express'
import cors from 'cors'
import { config } from './config/env.js'
import { initDatabase } from './config/database.js'
import userRoutes from './routes/userRoutes.js'
import { apiKeyAuth } from './middlewares/apiKeyAuth.js'
import { errorHandler, notFound } from './middlewares/errorHandler.js'

const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Root endpoint (không cần auth)
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Express API',
    version: '1.0.0',
    environment: config.nodeEnv
  })
})

// API Key authentication middleware
app.use(apiKeyAuth)

// Routes (yêu cầu API key)
app.use('/users', userRoutes)

// Error handling
app.use(notFound)
app.use(errorHandler)

// Start server
const startServer = async () => {
  try {
    // Initialize database (chỉ load config, chưa kết nối thật)
    await initDatabase()
    
    app.listen(config.port, () => {
      console.log(`🚀 Server running on http://localhost:${config.port}`)
      console.log(`📝 Environment: ${config.nodeEnv}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
