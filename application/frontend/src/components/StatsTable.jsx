import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '../utils/api'

const numberFormatter = new Intl.NumberFormat('vi-VN')

const formatNumber = (value) => numberFormatter.format(Number(value || 0))

const buildEmptyMonths = () => Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  percent: 0,
  received: 0,
  resolved: 0,
  onTime: 0,
  late: 0
}))

const buildEmptyStats = () => ({
  total: { received: 0, resolved: 0 },
  months: buildEmptyMonths()
})

export default function StatsTable({ showChart = true }) {
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear]
  )

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [stats, setStats] = useState(buildEmptyStats)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const chartMax = useMemo(() => {
    const peakValue = stats.months.reduce(
      (maxValue, month) => Math.max(maxValue, month.onTime, month.late),
      0
    )

    if (peakValue <= 10) {
      return 10
    }

    return Math.ceil(peakValue / 5) * 5
  }, [stats.months])

  const chartTicks = useMemo(() => {
    const steps = 6
    return Array.from({ length: steps + 1 }, (_, index) => {
      const value = (chartMax / steps) * (steps - index)
      return Math.round(value)
    })
  }, [chartMax])

  const toHeightPercent = (value) => {
    const percent = (Number(value || 0) / chartMax) * 100
    if (value > 0 && percent < 2.5) {
      return 2.5
    }
    return percent
  }

  useEffect(() => {
    let cancelled = false

    const fetchStats = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await apiClient.get(`/cong-dan/thong-ke-thu-ly?nam=${selectedYear}`)
        if (cancelled) return

        const monthMap = new Map(
          (response.months || []).map((item) => [Number(item.thang), item])
        )

        const months = Array.from({ length: 12 }, (_, index) => {
          const month = index + 1
          const found = monthMap.get(month) || {}
          const received = Number(found.tiepNhan || 0)
          const resolved = Number(found.giaiQuyet || 0)
          const late = Math.max(received - resolved, 0)
          const percent = Number(
            found.tiLeHanDung || (received > 0 ? Math.round((resolved / received) * 100) : 0)
          )

          return {
            month,
            percent,
            received,
            resolved,
            onTime: resolved,
            late
          }
        })

        const fallbackTotalReceived = months.reduce((sum, month) => sum + month.received, 0)
        const fallbackTotalResolved = months.reduce((sum, month) => sum + month.resolved, 0)

        setStats({
          total: {
            received: Number(response.tongTiepNhan ?? fallbackTotalReceived),
            resolved: Number(response.tongGiaiQuyet ?? fallbackTotalResolved)
          },
          months
        })
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error.message || 'Không tải được dữ liệu thống kê')
        setStats(buildEmptyStats)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchStats()
    return () => {
      cancelled = true
    }
  }, [selectedYear])

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6">
        <aside>
          <label htmlFor="stats-year" className="block text-[#d06a45] font-semibold text-base leading-none mb-3">
            Chọn năm:
          </label>
          <select
            id="stats-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full max-w-[130px] h-10 border border-gray-300 bg-white px-3 text-base text-[#9f5d30] focus:outline-none focus:border-[#c7693f]"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <div className="h-[2px] bg-[#d88f70] mt-5 mb-4" />

          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-2 text-gray-700">
              <span className="text-[#2b8bd1] text-xs">●</span>
              <span>Đã tiếp nhận:</span>
              <span className="font-semibold text-[#2b8bd1] ml-auto">{formatNumber(stats.total.received)}</span>
              <span>hồ sơ</span>
            </li>
            <li className="flex items-center gap-2 text-gray-700">
              <span className="text-[#2b8bd1] text-xs">●</span>
              <span>Đã giải quyết:</span>
              <span className="font-semibold text-[#2b8bd1] ml-auto">{formatNumber(stats.total.resolved)}</span>
              <span>hồ sơ</span>
            </li>
          </ul>

          {isLoading && (
            <p className="mt-4 text-xs text-gray-500">Đang tải dữ liệu thống kê...</p>
          )}
          {errorMessage && (
            <p className="mt-4 text-xs text-red-600">{errorMessage}</p>
          )}
        </aside>

        <div>
          <h2 className="text-[#d06a45] text-2xl font-semibold uppercase tracking-wide mb-3">
            TÌNH HÌNH THỤ LÝ HỒ SƠ THEO THÁNG
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-0 border border-[#d88f70] bg-white">
            {stats.months.map((month) => (
              <article key={month.month} className="border border-[#d88f70] px-3 py-2 min-h-[132px]">
                <div className="inline-block bg-gray-100 px-2 py-0.5 text-[15px] font-bold text-[#6f9d3a]">
                  Tháng {month.month}
                </div>
                <div className="flex items-baseline gap-1 mt-2 leading-none">
                  <span className={`text-3xl font-bold ${month.percent < 90 ? 'text-[#e6362d]' : 'text-[#2b8bd1]'}`}>
                    {month.percent}
                  </span>
                  <span className="text-xl font-semibold text-[#d06a45]">%</span>
                </div>
                <div className="text-sm text-[#d06a45] leading-none">đúng hạn</div>
                <div className="text-sm text-gray-700 mt-2">
                  Giải quyết <span className="font-semibold text-[#2b8bd1]">{formatNumber(month.resolved)}</span> hồ sơ
                </div>
              </article>
            ))}
          </div>

          {showChart && (
            <>
              <h3 className="text-[#d06a45] text-2xl font-semibold uppercase tracking-wide mt-10 mb-3">
                TỔNG HỢP KẾT QUẢ XỬ LÝ HỒ SƠ
              </h3>

              <div className="rounded-xl border border-gray-400 bg-white px-4 py-4 overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[56px_1fr] gap-3 h-[330px]">
                    <div className="h-[290px] mt-2 flex flex-col justify-between text-xs text-gray-600 text-right">
                      {chartTicks.map((tick) => (
                        <span key={tick}>{formatNumber(tick)}</span>
                      ))}
                    </div>

                    <div className="relative h-[290px] mt-2 border-l border-b border-gray-500 px-2">
                      <div className="absolute inset-0 pointer-events-none px-2">
                        {chartTicks.slice(1).map((tick, index) => {
                          const top = `${((index + 1) / (chartTicks.length - 1)) * 100}%`
                          return (
                            <div
                              key={`line-${tick}-${index}`}
                              className="absolute left-2 right-0 border-t border-gray-100"
                              style={{ top }}
                            />
                          )
                        })}
                      </div>

                      <div className="relative z-10 h-full flex items-end gap-2">
                        {stats.months.map((month) => (
                          <div key={`chart-${month.month}`} className="flex-1 min-w-0 h-full flex flex-col justify-end">
                            <div className="h-[86%] flex items-end justify-center gap-1">
                              <div
                                className="w-2.5 md:w-3 bg-[#4d95d9] rounded-t-sm"
                                style={{ height: `${toHeightPercent(month.onTime)}%` }}
                                title={`Đúng hạn: ${formatNumber(month.onTime)} hồ sơ`}
                              />
                              <div
                                className="w-2.5 md:w-3 bg-[#f2aa56] rounded-t-sm"
                                style={{ height: `${toHeightPercent(month.late)}%` }}
                                title={`Trễ hạn: ${formatNumber(month.late)} hồ sơ`}
                              />
                            </div>
                            <span className="mt-2 text-[10px] md:text-xs text-center font-semibold text-gray-600">
                              T{month.month}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-center">
                    <div className="inline-flex items-center gap-4 rounded-full border border-gray-300 px-4 py-1 text-xs text-gray-700">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4d95d9]" />
                        Đúng hạn
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#f2aa56]" />
                        Trễ hạn
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
