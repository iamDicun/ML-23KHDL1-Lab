import { config } from './env.js'

// Database configuration - chỉ lưu thông tin, chưa kết nối thật
export const databaseConfig = {
  url: config.database.url,
  serviceKey: config.database.serviceKey
}

// Hàm khởi tạo kết nối database (sẽ implement sau khi có database)
export const initDatabase = async () => {
  if (!databaseConfig.url || !databaseConfig.serviceKey) {
    console.warn('⚠️  Database credentials not configured. Please check .env file')
    return null
  }
  
  console.log('✅ Database configuration loaded')
  // TODO: Implement actual database connection here
  return null
}

export default databaseConfig
