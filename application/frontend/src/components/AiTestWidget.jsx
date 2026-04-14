import { useState, useRef, useEffect } from 'react'
import { apiClient } from '../utils/api'

const ASPECTS_META = {
  hygiene: { label: 'Vệ sinh' },
  food: { label: 'Đồ ăn' },
  hotel: { label: 'Khách sạn' },
  location: { label: 'Vị trí' },
  room: { label: 'Phòng ốc' },
  service: { label: 'Dịch vụ' }
}

const BUCKET_META = {
  positive: { label: 'Tích cực', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  negative: { label: 'Tiêu cực', tone: 'bg-red-50 text-red-700 border-red-200' },
  none: { label: 'Không đề cập', tone: 'bg-gray-100 text-gray-500 border-gray-200' }
}

const SENTIMENT_META = {
  positive: { label: 'Tích cực tổng thể', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  negative: { label: 'Tiêu cực tổng thể', tone: 'text-red-700 bg-red-50 border-red-200' },
  neutral: { label: 'Trung tính tổng thể', tone: 'text-amber-700 bg-amber-50 border-amber-200' }
}

const STEPS = {
  IDLE: 'idle',
  PREPROCESSING: 'preprocessing',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error'
}

export default function AiTestWidget() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [rating, setRating] = useState(7)
  const [step, setStep] = useState(STEPS.IDLE)
  const [processedText, setProcessedText] = useState('')
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const reset = () => {
    setStep(STEPS.IDLE)
    setProcessedText('')
    setResult(null)
    setErrorMsg('')
  }

  const handleRun = async () => {
    if (!text.trim()) return
    reset()
    setStep(STEPS.PREPROCESSING)

    const clientPreview = text
      .toLowerCase()
      .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^`{|}~]/g, ' ')
      .replace(/\s+/g, ' ').trim()
    setProcessedText(clientPreview)

    await new Promise((r) => setTimeout(r, 500))
    setStep(STEPS.RUNNING)

    try {
      const data = await apiClient.post('/can-bo/ai-test', { text, rating })
      setProcessedText(data.processedText || clientPreview)
      setResult(data)
      setStep(STEPS.DONE)
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Lỗi không xác định.')
      setStep(STEPS.ERROR)
    }
  }

  const scorePercent = result ? Math.round(result.overallScore * 100) : 0
  const scoreColor = scorePercent >= 65 ? '#10b981' : scorePercent >= 45 ? '#f59e0b' : '#ef4444'

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2" ref={panelRef}>

      {/* ── Panel ── */}
      {open && (
        <div className="w-[360px] max-h-[80vh] flex flex-col rounded-xl border border-gray-200 shadow-2xl overflow-hidden bg-white">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gray-800">Demo AI Model</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#fff0ea] text-[#8B2500] border border-[#f5c4ae] font-medium">
                6 aspects
              </span>
            </div>
            <button
              onClick={() => { setOpen(false); reset() }}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-lg leading-none transition"
              aria-label="Đóng"
            >×</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Nhập review thô</label>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => { setText(e.target.value); if (step !== STEPS.IDLE) reset() }}
                placeholder="VD: Phòng sạch sẽ, nhân viên thân thiện nhưng đồ ăn sáng không ngon lắm..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-800 text-sm px-3 py-2 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#c65429]/40 focus:border-[#c65429] transition"
              />
            </div>

            {/* Rating */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Điểm đánh giá</label>
                <span className="font-bold text-sm text-[#8B2500]">{rating}/10</span>
              </div>
              <input
                type="range" min={1} max={10} value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full accent-[#8B2500]"
              />
            </div>

            {/* Run button */}
            <button
              onClick={handleRun}
              disabled={!text.trim() || step === STEPS.PREPROCESSING || step === STEPS.RUNNING}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#8B2500] hover:bg-[#6B1A00] active:bg-[#500f00]"
            >
              {step === STEPS.PREPROCESSING ? 'Đang tiền xử lý...' :
                step === STEPS.RUNNING ? 'Đang chạy mô hình...' :
                  'Chạy mô hình'}
            </button>

            {/* Preprocessing result */}
            {(step !== STEPS.IDLE) && processedText && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
                <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">Văn bản sau tiền xử lý</p>
                <p className="text-amber-900 text-xs font-mono break-all leading-relaxed">{processedText}</p>
              </div>
            )}

            {/* Running */}
            {step === STEPS.RUNNING && (
              <p className="text-sm text-gray-400 animate-pulse">Đang gọi AI model...</p>
            )}

            {/* Error */}
            {step === STEPS.ERROR && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
                {errorMsg}
              </div>
            )}

            {/* Results */}
            {step === STEPS.DONE && result && (
              <div className="space-y-3">

                {/* Overall */}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Kết quả tổng quan</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs rounded border px-2 py-0.5 ${SENTIMENT_META[result.sentimentLabel]?.tone ?? ''}`}>
                      {SENTIMENT_META[result.sentimentLabel]?.label ?? result.sentimentLabel}
                    </span>
                    <span className="font-bold text-base" style={{ color: scoreColor }}>{scorePercent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${scorePercent}%`, background: scoreColor }}
                    />
                  </div>
                </div>

                {/* Per aspect */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(result.aspects).map(([key, asp]) => {
                    const meta = ASPECTS_META[key] ?? { label: key }
                    const bm = BUCKET_META[asp.bucket] ?? BUCKET_META.none
                    return (
                      <div key={key} className="rounded-lg border border-gray-200 bg-white px-3 py-2 space-y-1">
                        <p className="text-xs font-semibold text-gray-700">{meta.label}</p>
                        <span className={`inline-block text-[10px] rounded border px-1.5 py-0.5 ${bm.tone}`}>
                          {bm.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={reset}
                  className="w-full py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 transition"
                >
                  Thử lại
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        onClick={() => { setOpen((o) => !o); if (open) reset() }}
        className="h-10 px-4 rounded-full shadow-lg border border-[#c65429]/30 bg-[#8B2500] hover:bg-[#6B1A00] text-white text-sm font-semibold transition-all hover:scale-105 active:scale-95"
        aria-label="Mở Demo AI"
        title="Demo AI Model"
      >
        {open ? 'Đóng' : 'Demo AI'}
      </button>
    </div>
  )
}
