import { config } from '../config/env.js'

// Middleware xác thực API Key cho các API route.
export const apiKeyAuth = (req, res, next) => {
  if (!config.apiKey) {
    return res.status(500).json({
      success: false,
      error: 'API key is not configured on server'
    })
  }

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

  return next()
}

export default apiKeyAuth
