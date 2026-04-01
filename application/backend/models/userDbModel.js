import { query } from '../config/database.js'

const mapUser = (row) => {
  if (!row) return null

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at
  }
}

export const UserDbModel = {
  findCitizenByPhone: async (phone) => {
    const result = await query(
      `SELECT id, username, password_hash, full_name, email, phone, role, created_at
       FROM users
       WHERE role = 'citizen' AND phone = $1
       LIMIT 1`,
      [phone]
    )
    return mapUser(result.rows[0])
  },

  existsByPhone: async (phone) => {
    const result = await query(
      `SELECT 1
       FROM users
       WHERE phone = $1
       LIMIT 1`,
      [phone]
    )
    return result.rowCount > 0
  },

  existsByUsername: async (username) => {
    const result = await query(
      `SELECT 1
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [username]
    )
    return result.rowCount > 0
  },

  findOfficialByUsername: async (username) => {
    const result = await query(
      `SELECT id, username, password_hash, full_name, email, phone, role, created_at
       FROM users
       WHERE role = 'official' AND username = $1
       LIMIT 1`,
      [username]
    )
    return mapUser(result.rows[0])
  },

  findById: async (id) => {
    const result = await query(
      `SELECT id, username, password_hash, full_name, email, phone, role, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    )
    return mapUser(result.rows[0])
  },

  createCitizen: async ({ username, passwordHash, fullName, email, phone }) => {
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role)
       VALUES ($1, $2, $3, $4, $5, 'citizen')
       RETURNING id, username, password_hash, full_name, email, phone, role, created_at`,
      [username, passwordHash, fullName, email, phone]
    )
    return mapUser(result.rows[0])
  }
}

export default UserDbModel
