import { useState } from 'react'
import { statsData } from '../data/mockData'

const MONTH_COLORS = [
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
  'border-l-4 border-green-500',
]

export default function StatsTable() {
  const [selectedYear, setSelectedYear] = useState(statsData.selectedYear)

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-[#C04000] text-xl font-bold tracking-wide uppercase">
          Thống Kê Tình Hình Thụ Lý Hồ Sơ
        </h2>
        <div className="mt-3 mx-auto w-48 h-0.5 bg-[#C04000]" />
      </div>

      <div className="flex gap-8">
        {/* Left panel - Time filter */}
        <div className="w-56 flex-shrink-0">
          <h3 className="text-[#C04000] font-bold text-sm uppercase tracking-wide mb-3">Thời Gian</h3>
          <div className="h-0.5 bg-[#C04000] mb-4" />

          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm text-gray-700 font-medium">Năm:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#8B2500] transition-colors"
            >
              {statsData.years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-blue-500">●</span>
              <span>Đã tiếp nhận:</span>
              <span className="font-semibold text-blue-600 ml-auto">{statsData.total.received}</span>
              <span className="text-gray-500">hồ sơ</span>
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-blue-500">●</span>
              <span>Đã giải quyết:</span>
              <span className="font-semibold text-blue-600 ml-auto">{statsData.total.resolved}</span>
              <span className="text-gray-500">hồ sơ</span>
            </li>
          </ul>
        </div>

        {/* Right panel - Monthly grid */}
        <div className="flex-1">
          <h3 className="text-[#C04000] font-bold text-sm uppercase tracking-wide mb-3">
            Tình Hình Tổng Hợp Thụ Lý Hồ Sơ Theo Tháng
          </h3>
          <div className="h-0.5 bg-[#C04000] mb-4" />

          <div className="grid grid-cols-4 gap-3">
            {statsData.months.map((m, i) => (
              <div
                key={m.month}
                className={`bg-white border border-gray-200 rounded p-3 ${MONTH_COLORS[i]}`}
              >
                <div className="text-green-700 font-bold text-xs mb-1">Tháng {m.month}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-800">{m.percent}</span>
                  <span className="text-lg font-semibold text-gray-800">%</span>
                </div>
                <div className="text-blue-500 text-xs font-medium">đúng hạn</div>
                <div className="text-gray-500 text-xs mt-1">
                  Giải quyết <span className="font-semibold text-gray-700">{m.resolved}</span> hồ sơ
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
