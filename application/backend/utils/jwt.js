import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'

const ensureJwtSecret = () => {
  if (!config.jwt.secret) {
    const err = new Error('JWT secret is not configured. Please set JWT_SECRET in .env')
    err.statusCode = 500
    throw err
  }
}

export const signAccessToken = (payload) => {
  ensureJwtSecret()
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn })
}

export const verifyAccessToken = (token) => {
  ensureJwtSecret()
  return jwt.verify(token, config.jwt.secret)
}
