import { config } from './env.js'
import pg from 'pg'

const { Pool } = pg

let pool = null

export const databaseConfig = {
  url: config.database.url,
  host: config.database.host,
  port: config.database.port,
  name: config.database.name,
  user: config.database.user,
  password: config.database.password,
  ssl: {
    rejectUnauthorized: false
  }
}

export const initDatabase = async () => {
  const hasConnectionString = Boolean(databaseConfig.url)
  const hasDiscreteConfig = Boolean(
    databaseConfig.host &&
    databaseConfig.port &&
    databaseConfig.name &&
    databaseConfig.user &&
    databaseConfig.password
  )

  if (!hasConnectionString && !hasDiscreteConfig) {
    console.warn('⚠️  Database credentials not configured. Please check .env file')
    return null
  }

  const poolConfig = hasConnectionString
    ? {
        connectionString: databaseConfig.url,
        ssl: databaseConfig.ssl
      }
    : {
        host: databaseConfig.host,
        port: Number(databaseConfig.port),
        database: databaseConfig.name,
        user: databaseConfig.user,
        password: databaseConfig.password,
        ssl: databaseConfig.ssl
      }

  pool = new Pool(poolConfig)

  const client = await pool.connect()
  try {
    const result = await client.query('SELECT current_database() AS db, NOW() AS server_time')
    console.log(`✅ Connected to PostgreSQL: ${result.rows[0].db}`)
  } finally {
    client.release()
  }

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err)
  })

  return pool
}

export const getDb = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDatabase() first.')
  }
  return pool
}

export const query = async (text, params = []) => {
  return getDb().query(text, params)
}

export default databaseConfig
