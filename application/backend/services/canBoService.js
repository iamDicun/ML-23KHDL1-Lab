import { CanBoModel } from '../models/canBoModel.js'
import { HoSoCongDanModel } from '../models/congDanModel.js'
import { UserDbModel } from '../models/userDbModel.js'
import { verifyPassword } from '../utils/password.js'

export const CanBoService = {
  // Đăng nhập cán bộ
  dangNhap: async (taiKhoan, matKhau) => {
    if (!taiKhoan || !matKhau) {
      const err = new Error('Tài khoản và mật khẩu là bắt buộc'); err.statusCode = 400; throw err
    }

    const canBoUser = await UserDbModel.findOfficialByUsername(taiKhoan)
    const isPasswordValid = await verifyPassword(matKhau, canBoUser?.passwordHash)
    if (!canBoUser || !isPasswordValid) {
      const err = new Error('Tài khoản hoặc mật khẩu không đúng'); err.statusCode = 401; throw err
    }

    const info = {
      id: canBoUser.id,
      taiKhoan: canBoUser.username,
      hoTen: canBoUser.fullName,
      donVi: 'Chưa cập nhật',
      chucVu: 'Chưa cập nhật',
      createdAt: canBoUser.createdAt
    }

    return { message: 'Đăng nhập thành công', canBo: info }
  },

  // Lấy danh sách tất cả hồ sơ cần xử lý
  getDanhSachHoSo: async (trangThai) => {
    const all = await HoSoCongDanModel.findAll()
    if (trangThai) return all.filter(hs => hs.trangThai === trangThai)
    return all
  },

  // Cập nhật trạng thái hồ sơ
  xuLyHoSo: async (id, canBoId, trangThai, ghiChu) => {
    const validStatuses = ['Đang xử lý', 'Đã giải quyết', 'Từ chối', 'Bổ sung hồ sơ']
    if (!validStatuses.includes(trangThai)) {
      const err = new Error(`Trạng thái không hợp lệ. Chấp nhận: ${validStatuses.join(', ')}`); err.statusCode = 400; throw err
    }
    const hoSo = await HoSoCongDanModel.update(id, { trangThai, ghiChu, canBoXuLyId: canBoId, ngayXuLy: new Date() })
    if (!hoSo) {
      const err = new Error('Không tìm thấy hồ sơ'); err.statusCode = 404; throw err
    }
    return hoSo
  },

  // Thống kê theo tháng
  getThongKe: async (nam) => {
    const all = await HoSoCongDanModel.findAll()
    const year = nam || new Date().getFullYear()
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const inMonth = all.filter(hs => {
        const d = new Date(hs.ngayNop)
        return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === m
      })
      const resolved = inMonth.filter(hs => hs.trangThai === 'Đã giải quyết')
      return {
        thang: m,
        tiepNhan: inMonth.length,
        giaiQuyet: resolved.length,
        tiLeHanDung: inMonth.length > 0 ? Math.round((resolved.length / inMonth.length) * 100) : 0
      }
    })
    return { nam: year, tongTiepNhan: all.filter(hs => new Date(hs.ngayNop).getFullYear() === parseInt(year)).length, tongGiaiQuyet: all.filter(hs => hs.trangThai === 'Đã giải quyết' && new Date(hs.ngayNop).getFullYear() === parseInt(year)).length, months }
  },

  // Lấy danh sách cán bộ
  getDanhSachCanBo: async () => CanBoModel.findAll()
}

export default CanBoService
