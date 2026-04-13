import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const TAB = { PHONE: 'phone', VNEID: 'vneid' }

export default function CitizenLoginPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(TAB.PHONE)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSendOtp = (e) => {
    e.preventDefault()
    if (!phone) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setOtpSent(true)
    }, 800)
  }

  const handlePhoneLogin = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      alert('Đăng nhập SĐT - chưa tích hợp API')
    }, 800)
  }

  const handleVneIdLogin = () => {
    alert('Chuyển hướng VNeID - chưa tích hợp')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5EDE0' }}>

      {/* Top header strip */}
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
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-orange-200 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Trang chủ
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md">

          {/* Card header */}
          <div className="bg-[#8B2500] text-white text-center py-5 rounded-t-lg">
            <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>
            <h1 className="font-bold text-lg">Đăng nhập Công dân</h1>
            <p className="text-orange-200 text-xs mt-0.5">Cổng dịch vụ công Bộ VHTTDL</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab(TAB.PHONE)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                activeTab === TAB.PHONE
                  ? 'text-[#8B2500] border-b-2 border-[#8B2500] bg-[#FDF8F5]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📱 Đăng nhập bằng SĐT
            </button>
            <button
              onClick={() => setActiveTab(TAB.VNEID)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                activeTab === TAB.VNEID
                  ? 'text-[#8B2500] border-b-2 border-[#8B2500] bg-[#FDF8F5]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🪪 Đăng nhập bằng VNeID
            </button>
          </div>

          {/* Tab content */}
          <div className="px-6 py-6">

            {/* Phone tab */}
            {activeTab === TAB.PHONE && (
              <form onSubmit={otpSent ? handlePhoneLogin : handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Nhập số điện thoại"
                      pattern="[0-9]{10,11}"
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8B2500] transition-colors"
                      required
                      readOnly={otpSent}
                    />
                    {!otpSent && (
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-[#8B2500] text-white text-sm font-semibold rounded hover:bg-[#6B1A00] transition-colors disabled:opacity-60 whitespace-nowrap"
                      >
                        {loading ? '...' : 'Gửi OTP'}
                      </button>
                    )}
                  </div>
                </div>

                {otpSent && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Mã OTP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Nhập mã OTP"
                        maxLength={6}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8B2500] transition-colors tracking-widest text-center font-mono text-lg"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        OTP đã được gửi đến <span className="font-semibold">{phone}</span>.{' '}
                        <button
                          type="button"
                          onClick={() => { setOtpSent(false); setOtp('') }}
                          className="text-[#8B2500] hover:underline"
                        >
                          Đổi số?
                        </button>
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#8B2500] text-white font-semibold py-2.5 rounded hover:bg-[#6B1A00] transition-colors disabled:opacity-60"
                    >
                      {loading ? 'Đang xác thực...' : 'Xác nhận & Đăng nhập'}
                    </button>
                  </>
                )}

                {!otpSent && (
                  <p className="text-xs text-gray-500 text-center">
                    Mã OTP sẽ được gửi qua tin nhắn SMS
                  </p>
                )}
              </form>
            )}

            {/* VNeID tab */}
            {activeTab === TAB.VNEID && (
              <div className="text-center py-4 space-y-5">
                <div className="w-20 h-20 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
                  <span className="text-4xl">🪪</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">Đăng nhập qua ứng dụng VNeID</h3>
                  <p className="text-sm text-gray-500">
                    Sử dụng ứng dụng VNeID để xác thực danh tính an toàn
                  </p>
                </div>
                <button
                  onClick={handleVneIdLogin}
                  className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded transition-colors"
                >
                  <span className="text-lg">🪪</span>
                  <span>Đăng nhập bằng VNeID</span>
                </button>
                <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">
                  Chưa có ứng dụng VNeID?{' '}
                  <a href="#" className="text-blue-600 hover:underline">Tải về tại đây</a>
                </div>
              </div>
            )}

          </div>

          {/* Footer note */}
          <div className="bg-gray-50 rounded-b-lg px-6 py-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              Bằng việc đăng nhập, bạn đồng ý với{' '}
              <a href="#" className="text-[#8B2500] hover:underline">Điều khoản sử dụng</a>
              {' '}và{' '}
              <a href="#" className="text-[#8B2500] hover:underline">Chính sách bảo mật</a>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#7B1500] text-white py-3 px-6 text-xs text-center">
        <span className="font-semibold uppercase tracking-wide">
          Trung Tâm Chuyển Đổi Số Văn Hóa, Thể Thao và Du Lịch
        </span>
      </footer>
    </div>
  )
}
