import { config } from '../config/env.js'

// Middleware xác thực API Key
export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required'
    })
  }
  
  if (apiKey !== config.apiKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    })
  }
  
  next()
}

export default apiKeyAuth
