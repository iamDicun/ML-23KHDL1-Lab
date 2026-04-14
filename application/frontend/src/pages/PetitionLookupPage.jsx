import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../utils/api'

const statusClassMap = {
  received: 'bg-amber-50 border-amber-200 text-amber-700',
  reviewing: 'bg-blue-50 border-blue-200 text-blue-700',
  resolved: 'bg-green-50 border-green-200 text-green-700'
}

const OFFICIAL_STATUS_OPTIONS = [
  { value: 'received', label: 'Đã tiếp nhận' },
  { value: 'reviewing', label: 'Đang xem xét' },
  { value: 'resolved', label: 'Đã phản hồi' }
]

const formatDate = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('vi-VN')
}

export default function PetitionLookupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const params = new URLSearchParams(location.search)
  const initialQ = params.get('q') || ''

  const [q, setQ] = useState(initialQ)
  const [soDienThoai, setSoDienThoai] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [updateNotice, setUpdateNotice] = useState({ type: '', text: '' })
  const [items, setItems] = useState([])
  const [statusDraftById, setStatusDraftById] = useState({})
  const [updatingId, setUpdatingId] = useState(null)
  const [tongHop, setTongHop] = useState({
    daTiepNhan: 0,
    dangXemXet: 0,
    daPhanHoi: 0,
    chuaXemXet: 0
  })
  const isOfficialUser = isAuthenticated && user?.role === 'official'

  const hasFilters = useMemo(() => Boolean(q.trim() || soDienThoai.trim()), [q, soDienThoai])

  const loadData = async () => {
    setLoading(true)
    setMessage('')

    try {
      const queryParams = new URLSearchParams()
      if (q.trim()) queryParams.set('q', q.trim())
      if (soDienThoai.trim()) queryParams.set('soDienThoai', soDienThoai.trim())

      const queryString = queryParams.toString()
      const result = await apiClient.get(`/phan-anh-kien-nghi/tra-cuu${queryString ? `?${queryString}` : ''}`)
      const nextItems = result.items || []
      setItems(nextItems)
      setStatusDraftById(nextItems.reduce((acc, item) => {
        acc[item.id] = item.trangThai
        return acc
      }, {}))
      setTongHop(result.tongHop || {
        daTiepNhan: 0,
        dangXemXet: 0,
        daPhanHoi: 0,
        chuaXemXet: 0
      })

      if (!result.items || result.items.length === 0) {
        setMessage('Không tìm thấy phản ánh kiến nghị phù hợp bộ lọc.')
      }
    } catch (error) {
      setItems([])
      setTongHop({ daTiepNhan: 0, dangXemXet: 0, daPhanHoi: 0, chuaXemXet: 0 })
      setMessage(error.message || 'Không thể tra cứu phản ánh kiến nghị.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (petitionId) => {
    const nextStatus = statusDraftById[petitionId]
    if (!nextStatus) return

    setUpdatingId(petitionId)
    setUpdateNotice({ type: '', text: '' })

    try {
      const result = await apiClient.put(`/phan-anh-kien-nghi/${petitionId}/trang-thai`, {
        trangThai: nextStatus
      })
      setUpdateNotice({
        type: 'success',
        text: result.message || 'Cập nhật trạng thái thành công.'
      })
      await loadData()
    } catch (error) {
      setUpdateNotice({
        type: 'error',
        text: error.message || 'Không thể cập nhật trạng thái phản ánh kiến nghị.'
      })
    } finally {
      setUpdatingId(null)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = async () => {
    const nextParams = new URLSearchParams()
    if (q.trim()) nextParams.set('q', q.trim())
    if (soDienThoai.trim()) nextParams.set('soDienThoai', soDienThoai.trim())
    navigate(`/phan-anh-kien-nghi/tra-cuu${nextParams.toString() ? `?${nextParams.toString()}` : ''}`, { replace: true })
    await loadData()
  }

  const handleReset = async () => {
    setQ('')
    setSoDienThoai('')
    navigate('/phan-anh-kien-nghi/tra-cuu', { replace: true })
    setTimeout(() => {
      loadData()
    }, 0)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f6f6]">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-7">
        <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">TRA CỨU PHẢN ÁNH KIẾN NGHỊ</h2>
        <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-5" />

        <section className="bg-white border border-gray-200 rounded px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_130px_120px] gap-2 items-center">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 border border-gray-300 px-3"
              placeholder="Nhập mã PAKN / tiêu đề / tên người gửi"
            />
            <input
              type="text"
              value={soDienThoai}
              onChange={(e) => setSoDienThoai(e.target.value)}
              className="h-10 border border-gray-300 px-3"
              placeholder="Số điện thoại"
            />
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

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Đã tiếp nhận</div>
              <div className="text-lg font-semibold text-[#d06a45]">{tongHop.daTiepNhan}</div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Đang xem xét</div>
              <div className="text-lg font-semibold text-[#2f6fb5]">{tongHop.dangXemXet}</div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Đã phản hồi</div>
              <div className="text-lg font-semibold text-[#4e9f4f]">{tongHop.daPhanHoi}</div>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-gray-600">Chưa xem xét</div>
              <div className="text-lg font-semibold text-[#ef9f2f]">{tongHop.chuaXemXet}</div>
            </div>
          </div>

          {hasFilters && (
            <p className="mt-3 text-xs text-gray-500">
              Đã áp dụng bộ lọc tìm kiếm.
            </p>
          )}

          {isOfficialUser && (
            <p className="mt-3 text-xs text-[#2f4a6b]">
              Chế độ cán bộ: bạn có thể đổi trạng thái phản ánh kiến nghị trực tiếp trên từng dòng.
            </p>
          )}

          {updateNotice.text && (
            <div className={`mt-3 rounded border px-3 py-2 text-sm ${updateNotice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              {updateNotice.text}
            </div>
          )}
        </section>

        <section className="mt-5 bg-white border border-gray-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Mã PAKN</th>
                  <th className="px-3 py-2 text-left font-semibold">Người gửi</th>
                  <th className="px-3 py-2 text-left font-semibold">Tiêu đề</th>
                  <th className="px-3 py-2 text-left font-semibold">Đơn vị tiếp nhận</th>
                  <th className="px-3 py-2 text-left font-semibold">Đã tiếp nhận</th>
                  <th className="px-3 py-2 text-left font-semibold">Đã xem xét</th>
                  <th className="px-3 py-2 text-left font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 text-left font-semibold">Ngày gửi</th>
                  {isOfficialUser && <th className="px-3 py-2 text-left font-semibold">Cập nhật trạng thái</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-semibold text-[#8B2500]">{item.maPhanAnh}</td>
                    <td className="px-3 py-2">
                      <div>{item.tenNguoiGui}</div>
                      <div className="text-xs text-gray-500">{item.soDienThoai}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{item.tieuDe}</div>
                      <div className="text-xs text-gray-500 mt-1">{item.noiDung}</div>
                    </td>
                    <td className="px-3 py-2">{item.donViTiepNhan}</td>
                    <td className="px-3 py-2">{item.daTiepNhan ? 'Có' : 'Chưa'}</td>
                    <td className="px-3 py-2">{item.daXemXet ? 'Có' : 'Chưa'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex border rounded-full px-2 py-0.5 text-xs ${statusClassMap[item.trangThai] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        {item.trangThaiHienThi}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatDate(item.ngayTiepNhan)}</td>
                    {isOfficialUser && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={statusDraftById[item.id] || item.trangThai}
                            onChange={(e) => setStatusDraftById((prev) => ({
                              ...prev,
                              [item.id]: e.target.value
                            }))}
                            className="h-8 border border-gray-300 px-2 text-xs min-w-[130px]"
                          >
                            {OFFICIAL_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(item.id)}
                            disabled={updatingId === item.id || (statusDraftById[item.id] || item.trangThai) === item.trangThai}
                            className="h-8 px-3 bg-[#8B2500] text-white text-xs rounded-sm hover:bg-[#6B1A00] disabled:opacity-60"
                          >
                            {updatingId === item.id ? 'Đang lưu...' : 'Lưu'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && <p className="px-4 py-3 text-sm text-gray-500">Đang tải dữ liệu...</p>}
          {!loading && items.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-500">{message || 'Chưa có dữ liệu phản ánh kiến nghị.'}</p>
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