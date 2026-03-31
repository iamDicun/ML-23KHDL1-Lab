import { useState } from 'react'

export default function LoginModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // TODO: call API login
    setTimeout(() => {
      setLoading(false)
      alert('Đăng nhập cán bộ - chưa tích hợp API')
    }, 800)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-[#8B2500] text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span className="font-bold text-base">Đăng nhập cán bộ</span>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors text-xl font-bold">
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Tài khoản <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Nhập tên tài khoản"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8B2500] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Nhập mật khẩu"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#8B2500] transition-colors"
              required
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <a href="#" className="text-[#8B2500] text-xs hover:underline">Quên mật khẩu?</a>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8B2500] text-white font-semibold py-2.5 rounded hover:bg-[#6B1A00] transition-colors disabled:opacity-60"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}
