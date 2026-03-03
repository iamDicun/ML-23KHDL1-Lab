import { UserModel } from '../models/userModel.js'

// Service layer - Business logic
export const UserService = {
  // Lấy tất cả users
  getAllUsers: async () => {
    try {
      const users = await UserModel.findAll()
      return { success: true, data: users }
    } catch (error) {
      throw new Error(`Error fetching users: ${error.message}`)
    }
  },

  // Lấy user theo ID
  getUserById: async (id) => {
    try {
      const user = await UserModel.findById(id)
      if (!user) {
        const error = new Error('User not found')
        error.statusCode = 404
        throw error
      }
      return { success: true, data: user }
    } catch (error) {
      throw error
    }
  },

  // Tạo user mới
  createUser: async (userData) => {
    try {
      // Validate
      if (!userData.name || !userData.email) {
        const error = new Error('Name and email are required')
        error.statusCode = 400
        throw error
      }

      // Check email đã tồn tại chưa
      const existingUser = await UserModel.findByEmail(userData.email)
      if (existingUser) {
        const error = new Error('Email already exists')
        error.statusCode = 400
        throw error
      }

      const user = await UserModel.create(userData)
      return { success: true, data: user }
    } catch (error) {
      throw error
    }
  },

  // Cập nhật user
  updateUser: async (id, userData) => {
    try {
      // Validate
      if (!userData.name && !userData.email) {
        const error = new Error('At least one field (name or email) is required')
        error.statusCode = 400
        throw error
      }

      // Nếu update email, check email đã tồn tại chưa
      if (userData.email) {
        const existingUser = await UserModel.findByEmail(userData.email)
        if (existingUser && existingUser.id !== parseInt(id)) {
          const error = new Error('Email already exists')
          error.statusCode = 400
          throw error
        }
      }

      const user = await UserModel.update(id, userData)
      if (!user) {
        const error = new Error('User not found')
        error.statusCode = 404
        throw error
      }

      return { success: true, data: user }
    } catch (error) {
      throw error
    }
  },

  // Xóa user
  deleteUser: async (id) => {
    try {
      const deleted = await UserModel.delete(id)
      if (!deleted) {
        const error = new Error('User not found')
        error.statusCode = 404
        throw error
      }
      return { success: true, message: 'User deleted successfully' }
    } catch (error) {
      throw error
    }
  }
}

export default UserService
