import { verifyAccessToken } from '../utils/jwt.js'

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null
  }

  return authorizationHeader.slice('Bearer '.length).trim()
}

export const jwtAuth = (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization)

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token is required'
      })
    }

    const payload = verifyAccessToken(token)
    req.user = payload

    return next()
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    })
  }
}

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden'
      })
    }

    return next()
  }
}

// Decodes the JWT if present but does NOT block if missing/invalid
export const optionalJwtAuth = (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization)
    if (token) {
      const payload = verifyAccessToken(token)
      req.user = payload
    }
  } catch {
    // token invalid — treat as unauthenticated, don't block
  }
  return next()
}
