import { useState } from 'react'
import Navbar from '../components/Navbar'
import { apiClient } from '../utils/api'

const LEVEL_OPTIONS = [
  {
    key: 'very_satisfied',
    label: 'Rất hài lòng',
    color: '#f2b311',
    face: 'happy'
  },
  {
    key: 'satisfied',
    label: 'Hài lòng',
    color: '#9ccc32',
    face: 'neutral'
  },
  {
    key: 'not_satisfied',
    label: 'Không hài lòng',
    color: '#b9b3b6',
    face: 'sad'
  }
]

function EmotionIcon({ color, face }) {
  const mouthPath =
    face === 'happy'
      ? 'M9 15c1.2 1.5 4.8 1.5 6 0'
      : face === 'sad'
        ? 'M9 16c1.2-1.5 4.8-1.5 6 0'
        : 'M9.5 15.5h5'

  return (
    <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <circle cx="9" cy="10" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="1" fill={color} stroke="none" />
      <path d={mouthPath} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const messageClassName = {
  success: 'border-green-200 bg-green-50 text-green-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function EvaluationPage() {
  const [maHoSo, setMaHoSo] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [requestInfo, setRequestInfo] = useState(null)
  const [loadingAction, setLoadingAction] = useState(false)
  const [message, setMessage] = useState({ type: 'info', text: '' })

  const fetchRequestInfo = async (code) => {
    const trimmedCode = String(code || '').trim()
    if (!trimmedCode) {
      setRequestInfo(null)
      return null
    }

    const data = await apiClient.get(`/danh-gia/ho-so/${encodeURIComponent(trimmedCode)}`)
    setRequestInfo(data.hoSo)

    if (data.danhGia?.mucDoHaiLong) {
      setSelectedLevel(data.danhGia.mucDoHaiLong)
    }

    return data
  }

  const handleEvaluate = async () => {
    if (!maHoSo.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mã hồ sơ trước khi đánh giá.' })
      return
    }

    if (!selectedLevel) {
      setMessage({ type: 'error', text: 'Vui lòng chọn mức độ hài lòng.' })
      return
    }

    setLoadingAction(true)
    setMessage({ type: 'info', text: '' })

    try {
      const result = await apiClient.post('/danh-gia', {
        maHoSo,
        mucDoHaiLong: selectedLevel
      })

      await fetchRequestInfo(maHoSo)
      const ratedAtText = result?.danhGia?.ngayDanhGia
        ? new Date(result.danhGia.ngayDanhGia).toLocaleString('vi-VN')
        : null
      setMessage({
        type: 'success',
        text: ratedAtText
          ? `${result.message || 'Đánh giá thành công.'} (${ratedAtText})`
          : (result.message || 'Đánh giá thành công.')
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCancelRating = async () => {
    if (!maHoSo.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mã hồ sơ để hủy đánh giá.' })
      return
    }

    setLoadingAction(true)
    setMessage({ type: 'info', text: '' })

    try {
      const result = await apiClient.delete(`/danh-gia/ho-so/${encodeURIComponent(maHoSo.trim())}`)
      await fetchRequestInfo(maHoSo)
      setSelectedLevel('')
      setMessage({ type: result.deleted ? 'success' : 'info', text: result.message })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCodeBlur = async () => {
    if (!maHoSo.trim()) {
      setRequestInfo(null)
      setMessage({ type: 'info', text: '' })
      return
    }

    try {
      await fetchRequestInfo(maHoSo)
      setMessage({ type: 'info', text: '' })
    } catch (error) {
      setRequestInfo(null)
      setMessage({ type: 'error', text: error.message })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <section>
          <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">
            ĐÁNH GIÁ HỆ THỐNG GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH
          </h2>
          <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-6" />

          <div className="max-w-3xl mx-auto border border-gray-300 rounded-md bg-white px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {LEVEL_OPTIONS.map((option) => {
                const isActive = selectedLevel === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedLevel(option.key)}
                    className={`rounded-md py-2 transition-colors ${isActive ? 'bg-[#fff5ed]' : 'bg-transparent hover:bg-gray-50'}`}
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <EmotionIcon color={option.color} face={option.face} />
                      <span className="text-sm text-[#3c4a66]">{option.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">
            ĐÁNH GIÁ TÌNH HÌNH GIẢI QUYẾT HỒ SƠ
          </h2>
          <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-5" />

          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={maHoSo}
                onChange={(e) => setMaHoSo(e.target.value)}
                onBlur={handleCodeBlur}
                placeholder="Mã hồ sơ"
                className="flex-1 border border-gray-300 px-3 h-10 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#d06a45]"
              />
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={loadingAction}
                className="h-10 px-4 bg-[#cd7f57] text-white text-sm font-semibold rounded-sm hover:bg-[#bc6f49] transition-colors disabled:opacity-60"
              >
                Đánh giá
              </button>
              <button
                type="button"
                onClick={handleCancelRating}
                disabled={loadingAction}
                className="h-10 px-4 bg-[#6d7683] text-white text-sm font-semibold rounded-sm hover:bg-[#5c6672] transition-colors disabled:opacity-60"
              >
                Hủy đánh giá
              </button>
            </div>

            {requestInfo && (
              <div className="mt-3 rounded border border-[#e9dccf] bg-[#fffaf5] px-3 py-2 text-sm text-[#5a4e42]">
                <div>
                  <span className="font-semibold">{requestInfo.maSo}</span> • {requestInfo.tenThuTuc} • {requestInfo.tenCoSo}
                </div>
                <div>Trạng thái: <span className="font-semibold">{requestInfo.trangThaiHienThi}</span></div>
              </div>
            )}

            {message.text && (
              <div className={`mt-3 rounded border px-3 py-2 text-sm ${messageClassName[message.type] || messageClassName.info}`}>
                {message.text}
              </div>
            )}
          </div>
        </section>
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
