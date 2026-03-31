import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { navLinks } from '../data/mockData'
import LoginModal from './LoginModal'

export default function Navbar() {
  const navigate = useNavigate()
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false)
  const [officialModalOpen, setOfficialModalOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setLoginDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCitizenLogin = () => {
    setLoginDropdownOpen(false)
    navigate('/dang-nhap/cong-dan')
  }

  const handleOfficialLogin = () => {
    setLoginDropdownOpen(false)
    setOfficialModalOpen(true)
  }

  return (
    <>
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-20">
          {/* Logo - hình ảnh DVCQG_banner */}
          <div className="flex items-center h-full py-2">
            <img
              src="/images/DVCQG_banner.png"
              alt="Cổng Dịch Vụ Công - Bộ Văn Hóa, Thể Thao và Du Lịch"
              className="h-14 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            {/* Fallback nếu chưa có ảnh */}
            <div className="items-center gap-3 hidden">
              <svg viewBox="0 0 56 56" className="w-14 h-14 flex-shrink-0">
                <circle cx="28" cy="28" r="27" fill="#C0392B" stroke="#F4D03F" strokeWidth="2"/>
                <polygon points="28,10 31,22 43,22 33,30 37,42 28,34 19,42 23,30 13,22 25,22" fill="#F4D03F"/>
              </svg>
              <div>
                <div className="text-[#8B2500] font-bold text-lg leading-tight" style={{ fontFamily: 'serif' }}>Cổng Dịch Vụ Công</div>
                <div className="text-[#8B2500] text-xs font-medium tracking-wide uppercase">Bộ Văn Hóa, Thể Thao và Du Lịch</div>
              </div>
            </div>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <button className="px-5 py-2 border-2 border-[#8B2500] text-[#8B2500] font-semibold text-sm rounded hover:bg-[#8B2500] hover:text-white transition-colors">
              Đăng ký
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                className="flex items-center gap-2 px-5 py-2 bg-[#C0392B] text-white font-semibold text-sm rounded hover:bg-[#8B2500] transition-colors"
              >
                Đăng nhập
                <svg className={`w-4 h-4 transition-transform ${loginDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {loginDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded shadow-lg z-50">
                  <button
                    onClick={handleCitizenLogin}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-[#FDF0E8] hover:text-[#8B2500] font-medium transition-colors border-b border-gray-100"
                  >
                    👤 Công dân
                  </button>
                  <button
                    onClick={handleOfficialLogin}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-[#FDF0E8] hover:text-[#8B2500] font-medium transition-colors"
                  >
                    🏢 Cán bộ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation bar với nền trống đồng */}
      <nav
        className="relative overflow-hidden"
        style={{ backgroundColor: '#8B2500' }}
      >
        {/* Trống đồng image background */}
        <img
          src="/images/trongdong.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none opacity-30"
        />
        {/* Nav items - căn giữa */}
        <div className="relative max-w-7xl mx-auto px-4">
          <ul className="flex items-center justify-center">
            <li>
              <a href="/" className="flex items-center justify-center px-3 py-3 text-white hover:bg-[#6B1A00] transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </a>
            </li>
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="block px-4 py-3 text-white text-xs font-semibold tracking-wide hover:bg-[#6B1A00] transition-colors whitespace-nowrap"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Cán bộ Login Modal */}
      <LoginModal isOpen={officialModalOpen} onClose={() => setOfficialModalOpen(false)} />
    </>
  )
}
