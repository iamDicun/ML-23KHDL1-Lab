import { useEffect, useMemo, useState } from 'react'
import Navbar from '../components/Navbar'
import { apiClient } from '../utils/api'

const EMPTY_ITEMS = [
  { key: 'very_satisfied', label: 'Rất hài lòng', color: '#f2b311', count: 0 },
  { key: 'satisfied', label: 'Hài lòng', color: '#9ccc32', count: 0 },
  { key: 'not_satisfied', label: 'Không hài lòng', color: '#b9b3b6', count: 0 }
]

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value || 0))

export default function EvaluationSummaryPage() {
  const [items, setItems] = useState(EMPTY_ITEMS)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadSummary = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const result = await apiClient.get('/danh-gia/tong-hop')
        if (cancelled) return

        if (Array.isArray(result.items) && result.items.length > 0) {
          setItems(result.items)
        } else {
          setItems(EMPTY_ITEMS)
        }
      } catch (error) {
        if (cancelled) return
        setItems(EMPTY_ITEMS)
        setErrorMessage(error.message || 'Không tải được dữ liệu tổng hợp đánh giá')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSummary()
    return () => {
      cancelled = true
    }
  }, [])

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.count || 0), 0),
    [items]
  )

  const maxCount = useMemo(
    () => Math.max(...items.map((item) => Number(item.count || 0)), 1),
    [items]
  )

  const ticks = useMemo(() => {
    const steps = 6
    return Array.from({ length: steps + 1 }, (_, index) => {
      const value = (maxCount / steps) * (steps - index)
      return Math.round(value)
    })
  }, [maxCount])

  const cumulativePercentages = useMemo(() => {
    if (total <= 0) {
      return [0, 0, 100]
    }

    let sum = 0
    return items.map((item) => {
      sum += (Number(item.count || 0) / total) * 100
      return sum
    })
  }, [items, total])

  const pieBackground = useMemo(() => {
    if (total <= 0) {
      return '#d7d3d6'
    }

    return `conic-gradient(
      ${items[0].color} 0% ${cumulativePercentages[0]}%,
      ${items[1].color} ${cumulativePercentages[0]}% ${cumulativePercentages[1]}%,
      ${items[2].color} ${cumulativePercentages[1]}% 100%
    )`
  }, [items, cumulativePercentages, total])

  const toBarHeight = (count) => {
    const ratio = Number(count || 0) / maxCount
    if (count > 0 && ratio * 100 < 5) {
      return 5
    }
    return ratio * 100
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">
          TỔNG HỢP ĐÁNH GIÁ GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH
        </h2>
        <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-6" />

        {loading && (
          <p className="text-sm text-gray-500 mb-3">Đang tải dữ liệu tổng hợp đánh giá...</p>
        )}
        {errorMessage && (
          <p className="text-sm text-red-600 mb-3">{errorMessage}</p>
        )}

        <div className="bg-white border border-gray-200 rounded-md px-4 py-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <section>
              <div className="grid grid-cols-[56px_1fr] gap-3 h-[300px]">
                <div className="h-[250px] mt-2 flex flex-col justify-between text-xs text-gray-600 text-right">
                  {ticks.map((tick, index) => (
                    <span key={`tick-${index}-${tick}`}>{formatNumber(tick)}</span>
                  ))}
                </div>

                <div className="relative h-[250px] mt-2 border-l border-b border-gray-400 px-4">
                  <div className="absolute inset-0 pointer-events-none px-4">
                    {ticks.slice(1).map((tick, index) => {
                      const top = `${((index + 1) / (ticks.length - 1)) * 100}%`
                      return (
                        <div
                          key={`line-${tick}-${index}`}
                          className="absolute left-4 right-0 border-t border-gray-100"
                          style={{ top }}
                        />
                      )
                    })}
                  </div>

                  <div className="relative z-10 h-full flex items-end justify-around gap-6 pb-2">
                    {items.map((item) => (
                      <div key={item.key} className="flex-1 h-full max-w-[110px] flex items-end">
                        <div
                          className="w-full rounded-t-sm transition-[height] duration-300"
                          style={{
                            backgroundColor: item.color,
                            height: `${toBarHeight(item.count)}%`,
                            minHeight: Number(item.count || 0) > 0 ? '8px' : '0px'
                          }}
                          title={`${item.label}: ${formatNumber(item.count)}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-2">
                {items.map((item) => (
                  <div key={`bar-label-${item.key}`} className="text-center text-xs text-gray-700">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-gray-500">{formatNumber(item.count)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col items-center justify-center">
              <div
                className="w-[220px] h-[220px] rounded-full border border-gray-300"
                style={{ background: pieBackground }}
                aria-label="Biểu đồ tròn tổng hợp đánh giá"
              />

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-700">
                {items.map((item) => (
                  <span key={`pie-legend-${item.key}`} className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>

              <p className="mt-3 text-sm text-gray-600">
                Tổng số đánh giá: <span className="font-semibold">{formatNumber(total)}</span>
              </p>
            </section>
          </div>
        </div>
      </main>

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
