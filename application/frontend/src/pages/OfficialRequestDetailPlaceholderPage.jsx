import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function OfficialRequestDetailPlaceholderPage() {
  const navigate = useNavigate()
  const { requestId } = useParams()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900">Chi Tiết Hồ Sơ #{requestId}</h1>
          <p className="text-sm text-gray-600 mt-2">
            Màn hình chi tiết hồ sơ sẽ được triển khai ở bước tiếp theo.
          </p>

          <button
            type="button"
            onClick={() => navigate('/can-bo/quan-ly')}
            className="mt-5 px-4 py-2 rounded bg-[#8B2500] text-white hover:bg-[#6B1A00] transition-colors"
          >
            Quay lại trang quản lý
          </button>
        </div>
      </main>
    </div>
  )
}
