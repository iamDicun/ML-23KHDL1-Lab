import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiClient } from '../utils/api'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'approved', label: 'Đã phê duyệt' },
  { value: 'rejected', label: 'Bị từ chối' },
  { value: 'additional_info_required', label: 'Yêu cầu bổ sung' }
]

const statusBadgeClassMap = {
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  approved: 'bg-green-50 border-green-200 text-green-700',
  rejected: 'bg-red-50 border-red-200 text-red-700',
  additional_info_required: 'bg-blue-50 border-blue-200 text-blue-700'
}

const formatDateTime = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('vi-VN')
}

export default function DossierStatusLookupPage() {
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [trangThai, setTrangThai] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [items, setItems] = useState([])
  const [tongHop, setTongHop] = useState({
    tongHoSo: 0,
    choXuLy: 0,
    daPheDuyet: 0,
    biTuChoi: 0,
    yeuCauBoSung: 0
  })

  const fetchData = async ({ keyword = q, status = trangThai } = {}) => {
    setLoading(true)
    setMessage('')

    try {
      const queryParams = new URLSearchParams()
      if (keyword.trim()) queryParams.set('q', keyword.trim())
      if (status) queryParams.set('trangThai', status)
      queryParams.set('limit', '100')

      const queryString = queryParams.toString()
      const result = await apiClient.get(`/cong-dan/tra-cuu${queryString ? `?${queryString}` : ''}`)

      setItems(result.items || [])
      setTongHop(result.tongHop || {
        tongHoSo: 0,
        choXuLy: 0,
        daPheDuyet: 0,
        biTuChoi: 0,
        yeuCauBoSung: 0
      })

      if (!result.items || result.items.length === 0) {
        setMessage('Không tìm thấy hồ sơ phù hợp.')
      }
    } catch (error) {
      setItems([])
      setTongHop({
        tongHoSo: 0,
        choXuLy: 0,
        daPheDuyet: 0,
        biTuChoi: 0,
        yeuCauBoSung: 0
      })
      setMessage(error.message || 'Không thể tải dữ liệu tra cứu hồ sơ.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const keywordFromUrl = String(searchParams.get('q') || '').trim()
    const statusFromUrlRaw = String(searchParams.get('trangThai') || '').trim()
    const statusFromUrl = STATUS_OPTIONS.some((option) => option.value === statusFromUrlRaw)
      ? statusFromUrlRaw
      : ''

    setQ(keywordFromUrl)
    setTrangThai(statusFromUrl)
    fetchData({ keyword: keywordFromUrl, status: statusFromUrl })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSearch = async () => {
    await fetchData()
  }

  const handleReset = async () => {
    setQ('')
    setTrangThai('')
    await fetchData({ keyword: '', status: '' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f6f6]">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-7">
        <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">TRA CỨU TÌNH TRẠNG HỒ SƠ</h2>
        <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-5" />

        <section className="bg-white border border-gray-200 rounded px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_130px_120px] gap-2 items-center">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 border border-gray-300 px-3"
              placeholder="Nhập mã hồ sơ / tên thủ tục / cơ sở / người nộp / số điện thoại"
            />

            <select
              value={trangThai}
              onChange={(e) => setTrangThai(e.target.value)}
              className="h-10 border border-gray-300 px-3"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSearch}
              className="h-10 bg-[#cd7f57] text-white text-sm font-semibold rounded-sm hover:bg-[#bc6f49]"
            >
              Tìm kiếm
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="h-10 border border-gray-300 text-sm font-semibold text-gray-700 rounded-sm hover:bg-gray-50"
            >
              Làm mới
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Tổng hồ sơ</div>
              <div className="text-lg font-semibold text-[#2f4a6b]">{tongHop.tongHoSo}</div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Chờ xử lý</div>
              <div className="text-lg font-semibold text-[#ef9f2f]">{tongHop.choXuLy}</div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Đã phê duyệt</div>
              <div className="text-lg font-semibold text-[#4e9f4f]">{tongHop.daPheDuyet}</div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Bị từ chối</div>
              <div className="text-lg font-semibold text-[#c74b4b]">{tongHop.biTuChoi}</div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Yêu cầu bổ sung</div>
              <div className="text-lg font-semibold text-[#2f6fb5]">{tongHop.yeuCauBoSung}</div>
            </div>
          </div>
        </section>

        <section className="mt-5 bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Mã hồ sơ</th>
                  <th className="px-3 py-2 text-left font-semibold">Thủ tục</th>
                  <th className="px-3 py-2 text-left font-semibold">Cơ sở</th>
                  <th className="px-3 py-2 text-left font-semibold">Người nộp</th>
                  <th className="px-3 py-2 text-left font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 text-left font-semibold">Ngày nộp</th>
                  <th className="px-3 py-2 text-left font-semibold">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-semibold text-[#8B2500]">{item.maSo}</td>
                    <td className="px-3 py-2">{item.tenThuTuc}</td>
                    <td className="px-3 py-2">{item.tenCoSo}</td>
                    <td className="px-3 py-2">
                      <div>{item.nguoiNop?.hoTen}</div>
                      <div className="text-xs text-gray-500">{item.nguoiNop?.sdt}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex border rounded-full px-2 py-0.5 text-xs ${statusBadgeClassMap[item.trangThai] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        {item.trangThaiHienThi}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatDateTime(item.ngayNop)}</td>
                    <td className="px-3 py-2">{formatDateTime(item.ngayCapNhat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && <p className="px-4 py-3 text-sm text-gray-500">Đang tải dữ liệu...</p>}
          {!loading && items.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-500">{message || 'Chưa có hồ sơ nào.'}</p>
          )}
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