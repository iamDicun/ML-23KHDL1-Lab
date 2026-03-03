import { UserService } from '../services/userService.js'

// Controller layer - Request handlers
export const UserController = {
  // GET /api/users - Lấy tất cả users
  getUsers: async (req, res, next) => {
    try {
      const result = await UserService.getAllUsers()
      res.json(result.data)
    } catch (error) {
      next(error)
    }
  },

  // GET /api/users/:id - Lấy user theo ID
  getUser: async (req, res, next) => {
    try {
      const { id } = req.params
      const result = await UserService.getUserById(id)
      res.json(result.data)
    } catch (error) {
      next(error)
    }
  },

  // POST /api/users - Tạo user mới
  createUser: async (req, res, next) => {
    try {
      const userData = req.body
      const result = await UserService.createUser(userData)
      res.status(201).json(result.data)
    } catch (error) {
      next(error)
    }
  },

  // PUT /api/users/:id - Cập nhật user
  updateUser: async (req, res, next) => {
    try {
      const { id } = req.params
      const userData = req.body
      const result = await UserService.updateUser(id, userData)
      res.json(result.data)
    } catch (error) {
      next(error)
    }
  },

  // DELETE /api/users/:id - Xóa user
  deleteUser: async (req, res, next) => {
    try {
      const { id } = req.params
      const result = await UserService.deleteUser(id)
      res.json(result)
    } catch (error) {
      next(error)
    }
  }
}

export default UserController
