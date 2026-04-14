import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },
  aiModel: {
    baseUrl: process.env.AI_MODEL_API_BASE_URL || 'https://huggingface.co/spaces/wokogaming/asba',
    timeoutMs: Number(process.env.AI_MODEL_API_TIMEOUT_MS || 180000)
  }
}
