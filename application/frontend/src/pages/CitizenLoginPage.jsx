import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiClient } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const TAB = { PHONE: 'phone', REGISTER: 'register', VNEID: 'vneid' }

export default function CitizenLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const initialTab = new URLSearchParams(location.search).get('tab') === 'register' ? TAB.REGISTER : TAB.PHONE
  const [activeTab, setActiveTab] = useState(initialTab)

  // --- Đăng nhập ---
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // --- Đăng ký ---
  const [reg, setReg] = useState({ hoTen: '', sdt: '', email: '', matKhau: '', xacNhanMatKhau: '' })
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')

  const handlePhoneLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const data = await apiClient.post('/cong-dan/dang-nhap', { sdt: phone, matKhau: password })
      login({ token: data.token, user: data.user })
      navigate('/')
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegError('')
    setRegSuccess('')
    if (reg.matKhau !== reg.xacNhanMatKhau) {
      setRegError('Mật khẩu xác nhận không khớp.')
      return
    }
    setRegLoading(true)
    try {
      await apiClient.post('/cong-dan/dang-ky', {
        hoTen: reg.hoTen,
        sdt: reg.sdt,
        email: reg.email || undefined,
        matKhau: reg.matKhau
      })
      setRegSuccess('Đăng ký thành công! Bạn có thể đăng nhập ngay.')
      setReg({ hoTen: '', sdt: '', email: '', matKhau: '', xacNhanMatKhau: '' })
      setTimeout(() => setActiveTab(TAB.PHONE), 1800)
    } catch (error) {
      setRegError(error.message)
    } finally {
      setRegLoading(false)
    }
  }

  const handleVneIdLogin = () => alert('Chuyển hướng VNeID - chưa tích hợp')

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8B2500] transition-colors'
  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5EDE0' }}>

      {/* Header */}
      <header className="bg-[#8B2500] text-white py-3 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <svg viewBox="0 0 40 40" className="w-10 h-10">
            <circle cx="20" cy="20" r="19" fill="#C0392B" stroke="#F4D03F" strokeWidth="1.5"/>
            <polygon points="20,6 23,16 33,16 25,22 28,32 20,26 12,32 15,22 7,16 17,16" fill="#F4D03F"/>
          </svg>
          <div>
            <div className="font-bold text-base leading-tight" style={{ fontFamily: 'serif' }}>Cổng Dịch Vụ Công</div>
            <div className="text-xs text-orange-200">Bộ Văn Hóa, Thể Thao và Du Lịch</div>
          </div>
        </div>
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-orange-200 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Trang chủ
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">

          {/* Card header */}
          <div className="bg-[#8B2500] text-white text-center py-5 rounded-t-lg">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>
            <h1 className="font-bold text-lg">
              {activeTab === TAB.REGISTER ? 'Đăng ký tài khoản' : 'Đăng nhập Công dân'}
            </h1>
            <p className="text-orange-200 text-xs mt-0.5">Cổng dịch vụ công Bộ VHTTDL</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {[
              { id: TAB.PHONE,    label: 'Đăng nhập SĐT' },
              { id: TAB.REGISTER, label: 'Đăng ký' },
              { id: TAB.VNEID,    label: 'VNeID' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setLoginError(''); setRegError(''); setRegSuccess('') }}
                className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                  activeTab === t.id
                    ? 'text-[#8B2500] border-b-2 border-[#8B2500] bg-[#FDF8F5]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-6">

            {/* ── TAB: Đăng nhập ── */}
            {activeTab === TAB.PHONE && (
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                {loginError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loginError}</div>
                )}
                <div>
                  <label className={labelCls}>Số điện thoại <span className="text-red-500">*</span></label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="Nhập số điện thoại" pattern="[0-9]{10,11}"
                    className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Mật khẩu <span className="text-red-500">*</span></label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className={inputCls} required />
                </div>
                <button type="submit" disabled={loginLoading}
                  className="w-full bg-[#8B2500] text-white font-semibold py-2.5 rounded hover:bg-[#6B1A00] transition-colors disabled:opacity-60">
                  {loginLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
                <p className="text-center text-xs text-gray-500">
                  Chưa có tài khoản?{' '}
                  <button type="button" onClick={() => setActiveTab(TAB.REGISTER)}
                    className="text-[#8B2500] hover:underline font-semibold">
                    Đăng ký ngay
                  </button>
                </p>
              </form>
            )}

            {/* ── TAB: Đăng ký ── */}
            {activeTab === TAB.REGISTER && (
              <form onSubmit={handleRegister} className="space-y-3">
                {regError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{regError}</div>
                )}
                {regSuccess && (
                  <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 font-medium">{regSuccess}</div>
                )}
                <div>
                  <label className={labelCls}>Họ tên <span className="text-red-500">*</span></label>
                  <input type="text" value={reg.hoTen}
                    onChange={(e) => setReg((p) => ({ ...p, hoTen: e.target.value }))}
                    placeholder="Nhập họ và tên đầy đủ"
                    className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Số điện thoại <span className="text-red-500">*</span></label>
                  <input type="tel" value={reg.sdt}
                    onChange={(e) => setReg((p) => ({ ...p, sdt: e.target.value }))}
                    placeholder="VD: 0912345678" pattern="[0-9]{10,11}"
                    className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Email <span className="text-gray-400 font-normal">(tùy chọn)</span></label>
                  <input type="email" value={reg.email}
                    onChange={(e) => setReg((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Nhập địa chỉ email"
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Mật khẩu <span className="text-red-500">*</span></label>
                  <input type="password" value={reg.matKhau}
                    onChange={(e) => setReg((p) => ({ ...p, matKhau: e.target.value }))}
                    placeholder="Ít nhất 6 ký tự"
                    minLength={6}
                    className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}>Xác nhận mật khẩu <span className="text-red-500">*</span></label>
                  <input type="password" value={reg.xacNhanMatKhau}
                    onChange={(e) => setReg((p) => ({ ...p, xacNhanMatKhau: e.target.value }))}
                    placeholder="Nhập lại mật khẩu"
                    className={`${inputCls} ${reg.xacNhanMatKhau && reg.xacNhanMatKhau !== reg.matKhau ? 'border-red-400' : ''}`}
                    required />
                  {reg.xacNhanMatKhau && reg.xacNhanMatKhau !== reg.matKhau && (
                    <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
                  )}
                </div>
                <button type="submit" disabled={regLoading || (reg.xacNhanMatKhau && reg.xacNhanMatKhau !== reg.matKhau)}
                  className="w-full bg-[#8B2500] text-white font-semibold py-2.5 rounded hover:bg-[#6B1A00] transition-colors disabled:opacity-60 mt-1">
                  {regLoading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
                </button>
                <p className="text-center text-xs text-gray-500">
                  Đã có tài khoản?{' '}
                  <button type="button" onClick={() => setActiveTab(TAB.PHONE)}
                    className="text-[#8B2500] hover:underline font-semibold">
                    Đăng nhập
                  </button>
                </p>
              </form>
            )}

            {/* ── TAB: VNeID ── */}
            {activeTab === TAB.VNEID && (
              <div className="text-center py-4 space-y-5">
                <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">Đăng nhập qua ứng dụng VNeID</h3>
                  <p className="text-sm text-gray-500">Sử dụng ứng dụng VNeID để xác thực danh tính an toàn</p>
                </div>
                <button onClick={handleVneIdLogin}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded transition-colors">
                  Đăng nhập bằng VNeID
                </button>
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
                  Chưa có ứng dụng VNeID?{' '}
                  <a href="#" className="text-blue-600 hover:underline">Tải về tại đây</a>
                </p>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="bg-gray-50 rounded-b-lg px-6 py-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Bằng việc tiếp tục, bạn đồng ý với{' '}
              <a href="#" className="text-[#8B2500] hover:underline">Điều khoản sử dụng</a>
              {' '}và{' '}
              <a href="#" className="text-[#8B2500] hover:underline">Chính sách bảo mật</a>
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-[#7B1500] text-white py-3 px-6 text-xs text-center">
        <span className="font-semibold uppercase tracking-wide">
          Trung Tâm Chuyển Đổi Số Văn Hóa, Thể Thao và Du Lịch
        </span>
      </footer>
    </div>
  )
}
