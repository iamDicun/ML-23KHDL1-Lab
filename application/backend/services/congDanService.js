import { HoSoCongDanModel } from '../models/congDanModel.js'
import { UserDbModel } from '../models/userDbModel.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

// In-memory OTP store (sẽ thay bằng Redis/DB sau)
const otpStore = new Map()

export const CongDanService = {
  dangKyTaiKhoan: async ({ sdt, matKhau, hoTen, email }) => {
    if (!sdt || !/^[0-9]{10,11}$/.test(sdt)) {
      const err = new Error('Số điện thoại không hợp lệ'); err.statusCode = 400; throw err
    }
    if (!matKhau || matKhau.length < 6) {
      const err = new Error('Mật khẩu phải có ít nhất 6 ký tự'); err.statusCode = 400; throw err
    }
    if (!hoTen) {
      const err = new Error('Họ tên là bắt buộc'); err.statusCode = 400; throw err
    }

    const isPhoneExists = await UserDbModel.existsByPhone(sdt)
    if (isPhoneExists) {
      const err = new Error('Số điện thoại đã được sử dụng'); err.statusCode = 409; throw err
    }

    let username = `citizen_${sdt}`
    let suffix = 1
    while (await UserDbModel.existsByUsername(username)) {
      username = `citizen_${sdt}_${suffix++}`
    }

    const passwordHash = await hashPassword(matKhau)
    const created = await UserDbModel.createCitizen({
      username,
      passwordHash,
      fullName: hoTen,
      email: email || null,
      phone: sdt
    })

    return {
      message: 'Đăng ký tài khoản thành công',
      congDan: {
        id: created.id,
        sdt: created.phone,
        hoTen: created.fullName,
        email: created.email,
        createdAt: created.createdAt
      }
    }
  },

  // Nhập SĐT + mật khẩu để yêu cầu OTP đăng nhập
  yeuCauOtpDangNhap: async (sdt, matKhau) => {
    if (!sdt || !/^[0-9]{10,11}$/.test(sdt)) {
      const err = new Error('Số điện thoại không hợp lệ'); err.statusCode = 400; throw err
    }
    if (!matKhau) {
      const err = new Error('Mật khẩu là bắt buộc'); err.statusCode = 400; throw err
    }

    const congDan = await UserDbModel.findCitizenByPhone(sdt)
    if (!congDan) {
      const err = new Error('Không tìm thấy tài khoản công dân theo số điện thoại'); err.statusCode = 404; throw err
    }

    const isPasswordValid = await verifyPassword(matKhau, congDan.passwordHash)
    if (!isPasswordValid) {
      const err = new Error('Mật khẩu không chính xác'); err.statusCode = 401; throw err
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    otpStore.set(sdt, {
      otp,
      userId: congDan.id,
      expires: Date.now() + 5 * 60 * 1000
    })
    console.log(`[OTP] SĐT: ${sdt} | OTP: ${otp}`) // TODO: gửi SMS thật

    return {
      message: 'Mã OTP đã được gửi',
      expires_in: 300
    }
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

    const congDanUser = await UserDbModel.findById(record.userId)
    if (!congDanUser || congDanUser.role !== 'citizen') {
      const err = new Error('Tài khoản công dân không hợp lệ'); err.statusCode = 401; throw err
    }

    const congDan = {
      id: congDanUser.id,
      sdt: congDanUser.phone,
      hoTen: congDanUser.fullName,
      cccd: '',
      email: congDanUser.email,
      createdAt: congDanUser.createdAt
    }

    return {
      message: 'Đăng nhập thành công',
      congDan
    }
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
