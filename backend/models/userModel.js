// User Model - Giả lập data trong memory (sẽ thay bằng database sau)
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', createdAt: new Date() },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date() },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', createdAt: new Date() }
]

let nextId = 4

export const UserModel = {
  // Lấy tất cả users
  findAll: async () => {
    return users
  },

  // Lấy user theo ID
  findById: async (id) => {
    return users.find(user => user.id === parseInt(id))
  },

  // Lấy user theo email
  findByEmail: async (email) => {
    return users.find(user => user.email === email)
  },

  // Tạo user mới
  create: async (userData) => {
    const newUser = {
      id: nextId++,
      ...userData,
      createdAt: new Date()
    }
    users.push(newUser)
    return newUser
  },

  // Cập nhật user
  update: async (id, userData) => {
    const index = users.findIndex(user => user.id === parseInt(id))
    if (index === -1) return null
    
    users[index] = {
      ...users[index],
      ...userData,
      id: users[index].id,
      createdAt: users[index].createdAt,
      updatedAt: new Date()
    }
    return users[index]
  },

  // Xóa user
  delete: async (id) => {
    const index = users.findIndex(user => user.id === parseInt(id))
    if (index === -1) return false
    
    users.splice(index, 1)
    return true
  }
}

export default UserModel
