import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../utils/api'

const PROCEDURE_NAME = 'Tạo hồ sơ đăng kí cơ sở kinh doanh'
const GUIDE_ROUTE = '/dich-vu-cong-truc-tuyen/tao-ho-so-dang-ki-co-so-kinh-doanh'

const provinces = ['Hà Nội', 'TP Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Huế']

const steps = [
  'Bước 1: Đăng ký tài khoản (nếu chưa có) và đăng nhập',
  'Bước 2: Nhập thông tin và lưu hồ sơ'
]

const buildInitialForm = (user) => ({
  hoTen: user?.fullName || '',
  gioiTinh: 'Nam',
  ngaySinh: '',
  quocTich: 'Việt Nam',
  loaiGiayTo: 'Căn cước',
  soGiayTo: '',
  ngayCap: '',
  noiCap: '',
  hoKhauThuongTru: '',
  thuDienTu: user?.email || '',
  soDienThoai: user?.phone || '',
  tinhThanhPho: '',
  phuongXaThiTran: '',
  soNha: '',
  diaChiDangKy: '',
  laDoanhNghiep: false,
  tenCoSoKinhDoanh: '',
  loaiHinhKinhDoanh: '',
  linhVucKinhDoanh: '',
  noiDungDeNghi: '',
  danhMucHoSoChuanBi: ''
})

export default function OnlineServiceDossierFormPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const [form, setForm] = useState(() => buildInitialForm(user))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const isCitizenUser = isAuthenticated && user?.role === 'citizen'

  const requiredMissing = useMemo(() => {
    const requiredFields = [
      ['hoTen', 'Họ và tên'],
      ['soGiayTo', 'Số giấy tờ'],
      ['thuDienTu', 'Thư điện tử'],
      ['soDienThoai', 'Số điện thoại'],
      ['tinhThanhPho', 'Tỉnh/Thành phố'],
      ['phuongXaThiTran', 'Phường/Xã/Thị trấn'],
      ['diaChiDangKy', 'Địa chỉ đăng ký'],
      ['tenCoSoKinhDoanh', 'Tên cơ sở kinh doanh'],
      ['loaiHinhKinhDoanh', 'Loại hình kinh doanh'],
      ['linhVucKinhDoanh', 'Lĩnh vực kinh doanh'],
      ['noiDungDeNghi', 'Nội dung đề nghị']
    ]

    return requiredFields
      .filter(([field]) => !String(form[field] ?? '').trim())
      .map(([, label]) => label)
  }, [form])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    if (!isCitizenUser) {
      setMessage({
        type: 'error',
        text: 'Bạn cần đăng nhập tài khoản Công dân trước khi nộp hồ sơ.'
      })
      return
    }

    if (requiredMissing.length > 0) {
      setMessage({
        type: 'error',
        text: `Vui lòng nhập đầy đủ: ${requiredMissing.join(', ')}.`
      })
      return
    }

    setLoading(true)

    try {
      const payload = {
        ...form,
        tenThuTuc: PROCEDURE_NAME
      }

      const result = await apiClient.post(`/cong-dan/${user.id}/ho-so`, payload)
      const maSo = result?.hoSo?.maSo || ''
      navigate(maSo ? `/tra-cuu-tinh-trang-ho-so?q=${encodeURIComponent(maSo)}` : '/tra-cuu-tinh-trang-ho-so')
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Không thể nộp hồ sơ. Vui lòng thử lại.'
      })
    } finally {
      setLoading(false)
    }
  }

  const messageClass = message.type === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-green-200 bg-green-50 text-green-700'

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f6f6]">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-7">
        <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">NỘP HỒ SƠ DỊCH VỤ CÔNG TRỰC TUYẾN</h2>
        <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-4" />

        <section className="bg-white border border-gray-300 px-4 py-4">
          <p className="text-[40px] leading-tight text-[#2f3542] font-bold bg-[#f4ebcf] px-3 py-2" style={{ fontFamily: 'serif' }}>
            {PROCEDURE_NAME}
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`border px-3 py-2 ${index === 1 ? 'border-[#9cc948] bg-[#f5fbeb] text-[#496b12] font-semibold' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
              >
                {step}
              </div>
            ))}
          </div>

          {!isCitizenUser && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Bạn chưa đăng nhập tài khoản Công dân. Vui lòng đăng nhập để nộp hồ sơ.
              <button
                type="button"
                onClick={() => navigate('/dang-nhap/cong-dan')}
                className="ml-2 underline font-semibold"
              >
                Đăng nhập ngay
              </button>
            </div>
          )}

          {message.text && (
            <div className={`mt-4 rounded border px-3 py-2 text-sm ${messageClass}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-6 text-sm">
            <section>
              <h3 className="text-[#d06a45] text-base font-semibold uppercase mb-2">Thông tin người nộp hồ sơ</h3>
              <div className="h-[1px] bg-[#e2b299] mb-3" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <label className="block">
                  Họ và tên *
                  <input
                    value={form.hoTen}
                    onChange={(e) => updateField('hoTen', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Giới tính
                  <select
                    value={form.gioiTinh}
                    onChange={(e) => updateField('gioiTinh', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  >
                    <option>Nam</option>
                    <option>Nữ</option>
                    <option>Khác</option>
                  </select>
                </label>

                <label className="block">
                  Ngày sinh
                  <input
                    type="date"
                    value={form.ngaySinh}
                    onChange={(e) => updateField('ngaySinh', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Quốc tịch
                  <input
                    value={form.quocTich}
                    onChange={(e) => updateField('quocTich', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Loại giấy tờ *
                  <select
                    value={form.loaiGiayTo}
                    onChange={(e) => updateField('loaiGiayTo', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  >
                    <option>Căn cước</option>
                    <option>CMND</option>
                    <option>Hộ chiếu</option>
                  </select>
                </label>

                <label className="block">
                  Số giấy tờ *
                  <input
                    value={form.soGiayTo}
                    onChange={(e) => updateField('soGiayTo', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Ngày cấp
                  <input
                    type="date"
                    value={form.ngayCap}
                    onChange={(e) => updateField('ngayCap', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Nơi cấp
                  <input
                    value={form.noiCap}
                    onChange={(e) => updateField('noiCap', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block md:col-span-2">
                  Hộ khẩu thường trú
                  <input
                    value={form.hoKhauThuongTru}
                    onChange={(e) => updateField('hoKhauThuongTru', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Thư điện tử *
                  <input
                    type="email"
                    value={form.thuDienTu}
                    onChange={(e) => updateField('thuDienTu', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Số điện thoại *
                  <input
                    value={form.soDienThoai}
                    onChange={(e) => updateField('soDienThoai', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-[#d06a45] text-base font-semibold uppercase mb-2">Địa chỉ đăng ký</h3>
              <div className="h-[1px] bg-[#e2b299] mb-3" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <label className="block">
                  Tỉnh/Thành phố *
                  <select
                    value={form.tinhThanhPho}
                    onChange={(e) => updateField('tinhThanhPho', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  >
                    <option value="">--Chọn tỉnh/thành phố--</option>
                    {provinces.map((province) => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  Phường/Xã/Thị trấn *
                  <input
                    value={form.phuongXaThiTran}
                    onChange={(e) => updateField('phuongXaThiTran', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                    placeholder="Nhập phường/xã/thị trấn"
                  />
                </label>

                <label className="block">
                  Số nhà
                  <input
                    value={form.soNha}
                    onChange={(e) => updateField('soNha', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Địa chỉ đăng ký *
                  <input
                    value={form.diaChiDangKy}
                    onChange={(e) => updateField('diaChiDangKy', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="inline-flex items-center gap-2 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.laDoanhNghiep}
                    onChange={(e) => updateField('laDoanhNghiep', e.target.checked)}
                  />
                  Là doanh nghiệp?
                </label>
              </div>
            </section>

            <section>
              <h3 className="text-[#d06a45] text-base font-semibold uppercase mb-2">Thông tin hồ sơ đăng kí cơ sở kinh doanh</h3>
              <div className="h-[1px] bg-[#e2b299] mb-3" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                <label className="block">
                  Tên cơ sở kinh doanh *
                  <input
                    value={form.tenCoSoKinhDoanh}
                    onChange={(e) => updateField('tenCoSoKinhDoanh', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                  />
                </label>

                <label className="block">
                  Loại hình kinh doanh *
                  <input
                    value={form.loaiHinhKinhDoanh}
                    onChange={(e) => updateField('loaiHinhKinhDoanh', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                    placeholder="Ví dụ: Công ty TNHH/Hộ kinh doanh"
                  />
                </label>

                <label className="block md:col-span-2">
                  Lĩnh vực kinh doanh *
                  <input
                    value={form.linhVucKinhDoanh}
                    onChange={(e) => updateField('linhVucKinhDoanh', e.target.value)}
                    className="mt-1 w-full h-10 border border-gray-300 px-3"
                    placeholder="Ví dụ: Dịch vụ lưu trú, nhà hàng, du lịch..."
                  />
                </label>

                <label className="block md:col-span-2">
                  Nội dung đề nghị *
                  <textarea
                    value={form.noiDungDeNghi}
                    onChange={(e) => updateField('noiDungDeNghi', e.target.value)}
                    className="mt-1 w-full min-h-[110px] border border-gray-300 px-3 py-2"
                    placeholder="Mô tả nhu cầu đăng ký cơ sở kinh doanh và thông tin cần cơ quan xử lý"
                  />
                </label>

                <label className="block md:col-span-2">
                  Danh mục hồ sơ đã chuẩn bị
                  <textarea
                    value={form.danhMucHoSoChuanBi}
                    onChange={(e) => updateField('danhMucHoSoChuanBi', e.target.value)}
                    className="mt-1 w-full min-h-[90px] border border-gray-300 px-3 py-2"
                    placeholder="Ví dụ: CCCD, thông tin địa chỉ cơ sở, giấy tờ pháp lý liên quan..."
                  />
                </label>
              </div>
            </section>

            <div className="pt-1 flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                onClick={() => navigate(GUIDE_ROUTE)}
                className="h-10 px-8 border border-gray-300 text-gray-700 text-sm font-semibold rounded-sm hover:bg-gray-50"
              >
                Quay lại chi tiết thủ tục
              </button>

              <button
                type="submit"
                disabled={loading}
                className="h-10 px-10 bg-[#cd7f57] text-white text-sm font-semibold rounded-sm hover:bg-[#bc6f49] disabled:opacity-70"
              >
                {loading ? 'Đang nộp hồ sơ...' : 'Nộp hồ sơ'}
              </button>

              <button
                type="button"
                onClick={() => setForm(buildInitialForm(user))}
                className="h-10 px-8 bg-[#6d7683] text-white text-sm font-semibold rounded-sm hover:bg-[#5c6672]"
              >
                Làm mới
              </button>
            </div>
          </form>
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
