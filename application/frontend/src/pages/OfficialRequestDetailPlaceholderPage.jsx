import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiClient } from '../utils/api'

const formatDateTime = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

const statusBadgeClass = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'approved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'additional_info_required':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const fieldLabelMap = {
  hoTen: 'Họ tên người nộp',
  gioiTinh: 'Giới tính',
  ngaySinh: 'Ngày sinh',
  quocTich: 'Quốc tịch',
  loaiGiayTo: 'Loại giấy tờ',
  soGiayTo: 'Số giấy tờ',
  ngayCap: 'Ngày cấp',
  noiCap: 'Nơi cấp',
  hoKhauThuongTru: 'Hộ khẩu thường trú',
  thuDienTu: 'Thư điện tử',
  soDienThoai: 'Số điện thoại',
  tinhThanhPho: 'Tỉnh/Thành phố',
  phuongXaThiTran: 'Phường/Xã/Thị trấn',
  soNha: 'Số nhà',
  diaChiDangKy: 'Địa chỉ đăng ký',
  tenCoSoKinhDoanh: 'Tên cơ sở kinh doanh',
  loaiHinhKinhDoanh: 'Loại hình kinh doanh',
  linhVucKinhDoanh: 'Lĩnh vực kinh doanh',
  noiDungDeNghi: 'Nội dung đề nghị',
  danhMucHoSoChuanBi: 'Danh mục hồ sơ chuẩn bị',
  tenThuTuc: 'Tên thủ tục'
}

export default function OfficialRequestDetailPlaceholderPage() {
  const navigate = useNavigate()
  const { requestId } = useParams()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [hoSo, setHoSo] = useState(null)

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const data = await apiClient.get(`/can-bo/ho-so/${requestId}`)
        setHoSo(data)
      } catch (error) {
        setErrorMessage(error.message || 'Không thể tải chi tiết hồ sơ.')
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [requestId])

  const detailEntries = useMemo(() => {
    if (!hoSo?.duLieuKhaiBao || typeof hoSo.duLieuKhaiBao !== 'object') return []

    return Object.entries(hoSo.duLieuKhaiBao)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => ({
        key,
        label: fieldLabelMap[key] || key,
        value: typeof value === 'boolean' ? (value ? 'Có' : 'Không') : String(value)
      }))
  }, [hoSo])

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-7 space-y-5">
        <section className="rounded-lg border border-[#e3d8d1] bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-[#8B2500] via-[#a53a13] to-[#b9522a] text-white px-5 py-4">
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wide">Chi Tiết Nội Dung Hồ Sơ</h1>
            <p className="text-sm text-[#fcebdc] mt-1">Mã hồ sơ: {hoSo?.maSo || `HS-${String(requestId).padStart(6, '0')}`}</p>
          </div>

          {loading && (
            <p className="px-5 py-5 text-sm text-gray-500">Đang tải chi tiết hồ sơ...</p>
          )}

          {!loading && errorMessage && (
            <div className="m-5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {!loading && !errorMessage && hoSo && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-gray-500">Mã hồ sơ</div>
                  <div className="font-semibold text-gray-900">{hoSo.maSo}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-gray-500">Người nộp</div>
                  <div className="font-semibold text-gray-900">{hoSo.congDan?.hoTen || '-'}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-gray-500">Số điện thoại</div>
                  <div className="font-semibold text-gray-900">{hoSo.congDan?.sdt || '-'}</div>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="text-gray-500">Trạng thái</div>
                  <span className={`inline-flex mt-1 text-xs rounded border px-2 py-1 ${statusBadgeClass(hoSo.trangThai)}`}>
                    {hoSo.trangThaiHienThi}
                  </span>
                </div>
              </div>

              <div className="rounded border border-gray-200">
                <div className="px-4 py-3 bg-[#f9efe9] border-b border-[#edd5c7]">
                  <h2 className="font-semibold text-[#6f2a11]">Thông tin chung</h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <p><span className="font-medium text-gray-700">Thủ tục:</span> {hoSo.tenThuTuc}</p>
                  <p><span className="font-medium text-gray-700">Cơ sở:</span> {hoSo.tenCoSo}</p>
                  <p><span className="font-medium text-gray-700">Địa chỉ:</span> {hoSo.diaChi}</p>
                  <p><span className="font-medium text-gray-700">Ngày nộp:</span> {formatDateTime(hoSo.ngayNop)}</p>
                  <p><span className="font-medium text-gray-700">Cập nhật:</span> {formatDateTime(hoSo.ngayCapNhat)}</p>
                  <p><span className="font-medium text-gray-700">Ghi chú xử lý:</span> {hoSo.ghiChu || 'Chưa có'}</p>
                </div>
              </div>

              <div className="rounded border border-gray-200">
                <div className="px-4 py-3 bg-[#f9efe9] border-b border-[#edd5c7]">
                  <h2 className="font-semibold text-[#6f2a11]">Nội dung hồ sơ do công dân khai báo</h2>
                </div>

                {detailEntries.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">Không có dữ liệu khai báo chi tiết.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold w-72">Trường dữ liệu</th>
                          <th className="px-4 py-2 text-left font-semibold">Giá trị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailEntries.map((entry) => (
                          <tr key={entry.key} className="border-t border-gray-100 align-top">
                            <td className="px-4 py-2 text-gray-700">{entry.label}</td>
                            <td className="px-4 py-2 text-gray-900 whitespace-pre-wrap break-words">{entry.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/can-bo/quan-ly?section=can-bo-quan-ly-ho-so')}
                  className="px-4 py-2 rounded border border-[#8B2500] text-[#8B2500] hover:bg-[#8B2500] hover:text-white transition-colors"
                >
                  Quay lại Quản lý hồ sơ
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
