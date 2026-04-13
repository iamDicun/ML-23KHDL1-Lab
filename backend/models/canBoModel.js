// Model cho Cán bộ
let canBoList = [
  { id: 1, taiKhoan: 'admin', matKhau: 'admin123', hoTen: 'Lê Văn Cán Bộ', donVi: 'Phòng Văn hóa', chucVu: 'Chuyên viên', createdAt: new Date() },
  { id: 2, taiKhoan: 'canbo01', matKhau: 'cb2026', hoTen: 'Phạm Thị Hương', donVi: 'Phòng Thể thao', chucVu: 'Trưởng phòng', createdAt: new Date() },
]

let nextId = 3

export const CanBoModel = {
  findAll: async () => canBoList.map(({ matKhau, ...rest }) => rest),

  findById: async (id) => {
    const cb = canBoList.find(cb => cb.id === parseInt(id))
    if (!cb) return null
    const { matKhau, ...rest } = cb
    return rest
  },

  findByTaiKhoan: async (taiKhoan) => canBoList.find(cb => cb.taiKhoan === taiKhoan),

  create: async (data) => {
    const item = { id: nextId++, ...data, createdAt: new Date() }
    canBoList.push(item)
    const { matKhau, ...rest } = item
    return rest
  },

  update: async (id, data) => {
    const idx = canBoList.findIndex(cb => cb.id === parseInt(id))
    if (idx === -1) return null
    canBoList[idx] = { ...canBoList[idx], ...data, updatedAt: new Date() }
    const { matKhau, ...rest } = canBoList[idx]
    return rest
  }
}

export default CanBoModel
