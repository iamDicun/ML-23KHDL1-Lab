import { useState } from 'react'
import Navbar from '../components/Navbar'
import StatsTable from '../components/StatsTable'
import { categories } from '../data/mockData'

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* Hero / Search Section */}
      <div className="relative py-10" style={{ backgroundColor: '#8B2500' }}>
        {/* Trống đồng full cover */}
        <img
          src="/images/trongdong.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Overlay để chữ dễ đọc */}
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(100, 20, 0, 0.52)' }} />

        <div className="relative max-w-4xl mx-auto px-4 flex flex-col items-center">
          {/* Search bar */}
          <div className="w-full flex items-center bg-white rounded overflow-hidden shadow-lg mb-5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập tên thủ tục hành chính"
              className="flex-1 px-5 py-3.5 text-sm text-gray-700 focus:outline-none"
            />
            <button className="px-5 py-3.5 bg-white hover:bg-gray-100 transition-colors border-l border-gray-200">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* Action buttons */}
          <div className="w-full grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-3 bg-[#E8A020] hover:bg-[#C8880E] text-[#4A2800] font-bold py-4 px-6 rounded transition-colors shadow">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span className="text-sm uppercase tracking-wider">Tra Cứu Tình Trạng Hồ Sơ</span>
            </button>
            <button className="flex items-center justify-center gap-3 bg-[#E8A020] hover:bg-[#C8880E] text-[#4A2800] font-bold py-4 px-6 rounded transition-colors shadow">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
              <span className="text-sm uppercase tracking-wider">Nộp Hồ Sơ Trực Tuyến</span>
            </button>
          </div>
        </div>
      </div>


      {/* Categories */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="grid grid-cols-3 gap-8">
          {categories.map((cat) => (
            <div key={cat.id}>
              <h2 className="text-center font-bold text-sm tracking-wider text-gray-800 mb-2">
                {cat.title}
              </h2>
              <div className="h-0.5 bg-[#C04000] mb-4" />
              <ul className="space-y-2">
                {cat.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href="#"
                      className="flex items-start gap-2 p-2.5 border border-gray-200 rounded bg-white hover:border-[#C04000] hover:bg-[#FDF8F5] transition-colors group"
                    >
                      <span className="text-base mt-0.5 flex-shrink-0">{item.icon}</span>
                      <span className="text-sm text-gray-700 group-hover:text-[#8B2500] transition-colors leading-snug">
                        {item.label}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      {/* Stats section */}
      <div className="bg-white border-t border-gray-200">
        <StatsTable />
      </div>

      {/* Footer */}
      <footer className="bg-[#7B1500] text-white py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs">
          <div>
            <div>Lượt truy cập: <span className="font-semibold">1,196,432</span></div>
            <div>Trực tuyến: <span className="font-semibold">2</span></div>
          </div>
          <div className="font-semibold uppercase tracking-wide text-center">
            TRUNG TÂM CHUYỂN ĐỔI SỐ VĂN HÓA, THỂ THAO VÀ DU LỊCH
          </div>
          <div />
        </div>
      </footer>
    </div>
  )
}
