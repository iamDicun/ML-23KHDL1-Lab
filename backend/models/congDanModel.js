// Model cho Công dân
let congDanList = [
  { id: 1, sdt: '0901234567', hoTen: 'Nguyễn Văn A', cccd: '012345678901', email: 'nguyenvana@email.com', createdAt: new Date() },
  { id: 2, sdt: '0912345678', hoTen: 'Trần Thị B', cccd: '098765432100', email: 'tranthib@email.com', createdAt: new Date() },
]

let nextId = 3

export const CongDanModel = {
  findAll: async () => congDanList,

  findById: async (id) => congDanList.find(cd => cd.id === parseInt(id)),

  findBySdt: async (sdt) => congDanList.find(cd => cd.sdt === sdt),

  create: async (data) => {
    const item = { id: nextId++, ...data, createdAt: new Date() }
    congDanList.push(item)
    return item
  },

  update: async (id, data) => {
    const idx = congDanList.findIndex(cd => cd.id === parseInt(id))
    if (idx === -1) return null
    congDanList[idx] = { ...congDanList[idx], ...data, updatedAt: new Date() }
    return congDanList[idx]
  }
}

// Model cho Hồ sơ Công dân
let hoSoCongDan = [
  { id: 1, congDanId: 1, maSo: 'HS2026030001', tenThuTuc: 'Cấp phép hoạt động văn hóa', trangThai: 'Đang xử lý', ngayNop: new Date('2026-03-01'), ngayHen: new Date('2026-03-15') },
  { id: 2, congDanId: 1, maSo: 'HS2026030002', tenThuTuc: 'Đăng ký bản quyền tác giả', trangThai: 'Đã giải quyết', ngayNop: new Date('2026-02-15'), ngayHen: new Date('2026-03-01') },
]
let nextHoSoId = 3

export const HoSoCongDanModel = {
  findByCongDanId: async (congDanId) => hoSoCongDan.filter(hs => hs.congDanId === parseInt(congDanId)),

  findByMaSo: async (maSo) => hoSoCongDan.find(hs => hs.maSo === maSo),

  findById: async (id) => hoSoCongDan.find(hs => hs.id === parseInt(id)),

  findAll: async () => hoSoCongDan,

  create: async (data) => {
    const maSo = `HS${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(nextHoSoId).padStart(4,'0')}`
    const item = { id: nextHoSoId++, maSo, ...data, trangThai: 'Đã tiếp nhận', ngayNop: new Date() }
    hoSoCongDan.push(item)
    return item
  },

  update: async (id, data) => {
    const idx = hoSoCongDan.findIndex(hs => hs.id === parseInt(id))
    if (idx === -1) return null
    hoSoCongDan[idx] = { ...hoSoCongDan[idx], ...data, updatedAt: new Date() }
    return hoSoCongDan[idx]
  }
}

export default CongDanModel
