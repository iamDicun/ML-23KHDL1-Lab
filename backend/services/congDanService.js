import { CongDanModel, HoSoCongDanModel } from '../models/congDanModel.js'

// In-memory OTP store (sẽ thay bằng Redis/DB sau)
const otpStore = new Map()

export const CongDanService = {
  // Gửi OTP đăng nhập
  guiOtp: async (sdt) => {
    if (!sdt || !/^[0-9]{10,11}$/.test(sdt)) {
      const err = new Error('Số điện thoại không hợp lệ'); err.statusCode = 400; throw err
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    otpStore.set(sdt, { otp, expires: Date.now() + 5 * 60 * 1000 })
    console.log(`[OTP] SĐT: ${sdt} | OTP: ${otp}`) // TODO: gửi SMS thật
    return { message: 'Mã OTP đã được gửi', expires_in: 300 }
  },

  // Xác nhận OTP + đăng nhập
  xacNhanOtp: async (sdt, otp) => {
    const record = otpStore.get(sdt)
    if (!record) {
      const err = new Error('Mã OTP không tồn tại hoặc đã hết hạn'); err.statusCode = 400; throw err
    }
    if (Date.now() > record.expires) {
      otpStore.delete(sdt)
      const err = new Error('Mã OTP đã hết hạn'); err.statusCode = 400; throw err
    }
    if (record.otp !== otp) {
      const err = new Error('Mã OTP không chính xác'); err.statusCode = 401; throw err
    }
    otpStore.delete(sdt)

    let congDan = await CongDanModel.findBySdt(sdt)
    if (!congDan) {
      congDan = await CongDanModel.create({ sdt, hoTen: '', cccd: '', email: '' })
    }
    return { message: 'Đăng nhập thành công', congDan }
  },

  // Đăng nhập VNeID (placeholder)
  dangNhapVneId: async (token) => {
    if (!token) {
      const err = new Error('Token VNeID không hợp lệ'); err.statusCode = 400; throw err
    }
    // TODO: xác thực với VNeID API
    return { message: 'Xác thực VNeID - chưa tích hợp' }
  },

  // Lấy danh sách hồ sơ của công dân
  getDanhSachHoSo: async (congDanId) => {
    const hoSoList = await HoSoCongDanModel.findByCongDanId(congDanId)
    return hoSoList
  },

  // Tra cứu hồ sơ theo mã số
  traCuuHoSo: async (maSo) => {
    const hoSo = await HoSoCongDanModel.findByMaSo(maSo)
    if (!hoSo) {
      const err = new Error('Không tìm thấy hồ sơ'); err.statusCode = 404; throw err
    }
    return hoSo
  },

  // Nộp hồ sơ
  nopHoSo: async (congDanId, data) => {
    if (!data.tenThuTuc) {
      const err = new Error('Tên thủ tục là bắt buộc'); err.statusCode = 400; throw err
    }
    const congDan = await CongDanModel.findById(congDanId)
    if (!congDan) {
      const err = new Error('Công dân không tồn tại'); err.statusCode = 404; throw err
    }
    const hoSo = await HoSoCongDanModel.create({ congDanId: parseInt(congDanId), ...data })
    return hoSo
  }
}

export default CongDanService
