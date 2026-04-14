import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../utils/api'
import { useAuth } from '../context/AuthContext'

export default function LoginModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()

    setErrorMessage('')
    setLoading(true)
    try {
      const data = await apiClient.post('/can-bo/dang-nhap', {
        taiKhoan: form.username,
        matKhau: form.password
      })

      login({ token: data.token, user: data.user })
      onClose()
      navigate('/can-bo/quan-ly?section=can-bo-home')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
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
          {errorMessage && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
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
