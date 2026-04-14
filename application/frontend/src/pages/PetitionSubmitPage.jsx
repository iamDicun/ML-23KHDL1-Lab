import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiClient } from '../utils/api'

const RECEIVING_UNITS = [
  'Văn phòng tiếp nhận và trả kết quả',
  'Phòng Quản lý Văn hóa',
  'Phòng Kế hoạch - Tài chính',
  'Thanh tra Sở'
]

const PROVINCES = [
  { value: 'Hà Nội', districts: ['Ba Đình', 'Đống Đa', 'Cầu Giấy'] },
  { value: 'Đà Nẵng', districts: ['Hải Châu', 'Thanh Khê', 'Liên Chiểu'] },
  { value: 'TP Hồ Chí Minh', districts: ['Quận 1', 'Quận 3', 'Bình Thạnh'] }
]

const WARDS_BY_DISTRICT = {
  'Ba Đình': ['Điện Biên', 'Kim Mã', 'Ngọc Hà'],
  'Đống Đa': ['Cát Linh', 'Văn Chương', 'Thịnh Quang'],
  'Cầu Giấy': ['Dịch Vọng', 'Nghĩa Tân', 'Mai Dịch'],
  'Hải Châu': ['Thạch Thang', 'Hải Châu 1', 'Hải Châu 2'],
  'Thanh Khê': ['Thanh Khê Đông', 'Thanh Khê Tây', 'An Khê'],
  'Liên Chiểu': ['Hòa Khánh Nam', 'Hòa Khánh Bắc', 'Hòa Minh'],
  'Quận 1': ['Bến Nghé', 'Bến Thành', 'Đa Kao'],
  'Quận 3': ['Võ Thị Sáu', 'Phường 9', 'Phường 12'],
  'Bình Thạnh': ['Phường 1', 'Phường 3', 'Phường 13']
}

const createCaptcha = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const defaultForm = {
  doiTuong: 'citizen',
  tenNguoiGui: '',
  tenToChuc: '',
  tinhThanh: '',
  quanHuyen: '',
  phuongXa: '',
  diaChiChiTiet: '',
  soDienThoai: '',
  email: '',
  tieuDe: '',
  noiDung: '',
  donViTiepNhan: '',
  tepDinhKem: ''
}

const rightCardClass = 'rounded bg-white border border-gray-200'

export default function PetitionSubmitPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(defaultForm)
  const [captcha, setCaptcha] = useState(() => createCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')
  const [lookupText, setLookupText] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ daTraLoi: 0, dangXuLy: 0 })
  const [message, setMessage] = useState({ type: '', text: '' })

  const districtOptions = useMemo(() => {
    const province = PROVINCES.find((item) => item.value === form.tinhThanh)
    return province?.districts || []
  }, [form.tinhThanh])

  const wardOptions = useMemo(() => WARDS_BY_DISTRICT[form.quanHuyen] || [], [form.quanHuyen])

  useEffect(() => {
    let cancelled = false
    const loadStats = async () => {
      try {
        const result = await apiClient.get('/phan-anh-kien-nghi/thong-ke')
        if (!cancelled) {
          setStats({
            daTraLoi: Number(result.daTraLoi || 0),
            dangXuLy: Number(result.dangXuLy || 0)
          })
        }
      } catch {
        if (!cancelled) {
          setStats({ daTraLoi: 0, dangXuLy: 0 })
        }
      }
    }

    loadStats()
    return () => {
      cancelled = true
    }
  }, [])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm(defaultForm)
    setCaptcha(createCaptcha())
    setCaptchaInput('')
    setMessage({ type: '', text: '' })
  }

  const handleSend = async () => {
    setMessage({ type: '', text: '' })

    if (!captchaInput.trim() || captchaInput.trim().toUpperCase() !== captcha) {
      setMessage({ type: 'error', text: 'Mã bảo mật không đúng. Vui lòng nhập lại.' })
      return
    }

    setLoading(true)

    try {
      const result = await apiClient.post('/phan-anh-kien-nghi', form)
      setMessage({
        type: 'success',
        text: `${result.message}. Mã phản ánh: ${result.phanAnh.maPhanAnh}`
      })
      setCaptcha(createCaptcha())
      setCaptchaInput('')
      setForm(defaultForm)

      const statsResult = await apiClient.get('/phan-anh-kien-nghi/thong-ke')
      setStats({
        daTraLoi: Number(statsResult.daTraLoi || 0),
        dangXuLy: Number(statsResult.dangXuLy || 0)
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Gửi phản ánh kiến nghị thất bại.' })
    } finally {
      setLoading(false)
    }
  }

  const goLookup = () => {
    const query = lookupText.trim()
    navigate(`/phan-anh-kien-nghi/tra-cuu${query ? `?q=${encodeURIComponent(query)}` : ''}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f6f6]">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-7">
        <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">TIẾP NHẬN PHẢN ÁNH KIẾN NGHỊ</h2>
        <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-4" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
          <section className="bg-white border border-gray-200 rounded px-4 py-4">
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Đối tượng phản ánh kiến nghị (*)</label>
                <div className="flex flex-wrap items-center gap-4 text-gray-700">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="doiTuong"
                      checked={form.doiTuong === 'citizen'}
                      onChange={() => updateField('doiTuong', 'citizen')}
                    />
                    <span>Cá nhân</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="doiTuong"
                      checked={form.doiTuong === 'business'}
                      onChange={() => updateField('doiTuong', 'business')}
                    />
                    <span>Doanh nghiệp</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="doiTuong"
                      checked={form.doiTuong === 'organization'}
                      onChange={() => updateField('doiTuong', 'organization')}
                    />
                    <span>Tổ chức / đơn vị sự nghiệp</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Tên người gửi phản ánh kiến nghị (*)</label>
                <input
                  type="text"
                  value={form.tenNguoiGui}
                  onChange={(e) => updateField('tenNguoiGui', e.target.value)}
                  className="border border-gray-300 h-9 px-3"
                  placeholder="Nhập họ tên"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-start">
                <label className="text-gray-700 mt-2">Địa chỉ (*)</label>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={form.tinhThanh}
                      onChange={(e) => {
                        updateField('tinhThanh', e.target.value)
                        updateField('quanHuyen', '')
                        updateField('phuongXa', '')
                      }}
                      className="border border-gray-300 h-9 px-3"
                    >
                      <option value="">Tỉnh/Thành phố</option>
                      {PROVINCES.map((province) => (
                        <option key={province.value} value={province.value}>{province.value}</option>
                      ))}
                    </select>

                    <select
                      value={form.quanHuyen}
                      onChange={(e) => {
                        updateField('quanHuyen', e.target.value)
                        updateField('phuongXa', '')
                      }}
                      className="border border-gray-300 h-9 px-3"
                    >
                      <option value="">Quận/Huyện</option>
                      {districtOptions.map((district) => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>

                    <select
                      value={form.phuongXa}
                      onChange={(e) => updateField('phuongXa', e.target.value)}
                      className="border border-gray-300 h-9 px-3"
                    >
                      <option value="">Phường/Xã</option>
                      {wardOptions.map((ward) => (
                        <option key={ward} value={ward}>{ward}</option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={form.diaChiChiTiet}
                    onChange={(e) => updateField('diaChiChiTiet', e.target.value)}
                    className="border border-gray-300 h-9 px-3 w-full"
                    placeholder="Nhập số nhà, thôn xóm..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Số điện thoại (*)</label>
                <input
                  type="text"
                  value={form.soDienThoai}
                  onChange={(e) => updateField('soDienThoai', e.target.value)}
                  className="border border-gray-300 h-9 px-3"
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="border border-gray-300 h-9 px-3"
                  placeholder="Nhập email"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Phản ánh kiến nghị về việc (*)</label>
                <input
                  type="text"
                  value={form.tieuDe}
                  onChange={(e) => updateField('tieuDe', e.target.value)}
                  className="border border-gray-300 h-9 px-3"
                  placeholder="Nhập tiêu đề PAKN"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-start">
                <label className="text-gray-700 mt-2">Nội dung (*)</label>
                <textarea
                  value={form.noiDung}
                  onChange={(e) => updateField('noiDung', e.target.value)}
                  className="border border-gray-300 min-h-[120px] px-3 py-2"
                  placeholder="Nhập nội dung"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Chọn đơn vị tiếp nhận (*)</label>
                <select
                  value={form.donViTiepNhan}
                  onChange={(e) => updateField('donViTiepNhan', e.target.value)}
                  className="border border-gray-300 h-9 px-3"
                >
                  <option value="">--Chọn đơn vị--</option>
                  {RECEIVING_UNITS.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Tài liệu đính kèm</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={form.tepDinhKem}
                    readOnly
                    className="border border-gray-300 h-9 px-3 flex-1 min-w-[220px] bg-gray-50"
                    placeholder="Chưa chọn tệp"
                  />
                  <label className="h-9 px-4 border border-gray-300 bg-white inline-flex items-center cursor-pointer hover:bg-gray-50">
                    Chọn
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => updateField('tepDinhKem', e.target.files?.[0]?.name || '')}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 items-center">
                <label className="text-gray-700">Mã bảo mật (*)</label>
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-3">
                    <span className="px-4 py-1.5 border border-gray-300 bg-gray-50 text-xl tracking-[0.35em] italic text-[#7b5f5f] select-none">
                      {captcha}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-[#8B2500] underline"
                      onClick={() => setCaptcha(createCaptcha())}
                    >
                      Đổi mã
                    </button>
                  </div>

                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    className="border border-gray-300 h-9 px-3 max-w-[320px]"
                    placeholder="Nhập mã bảo mật"
                  />
                </div>
              </div>
            </div>

            {message.text && (
              <div className={`mt-4 text-sm rounded border px-3 py-2 ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
                {message.text}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={handleSend}
                className="h-10 px-10 bg-[#cd7f57] text-white text-sm font-semibold rounded-sm hover:bg-[#bc6f49] disabled:opacity-70"
              >
                Gửi phản ánh
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="h-10 px-10 bg-[#cd7f57] text-white text-sm font-semibold rounded-sm hover:bg-[#bc6f49]"
              >
                Nhập lại
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="h-10 px-10 bg-[#cd7f57] text-white text-sm font-semibold rounded-sm hover:bg-[#bc6f49]"
              >
                Trở về
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className={rightCardClass}>
              <h3 className="px-4 py-3 border-b border-gray-200 text-[#2f4a6b] font-semibold text-xl text-center">Tra cứu thông tin PAKN</h3>
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  value={lookupText}
                  onChange={(e) => setLookupText(e.target.value)}
                  className="w-full border border-gray-300 h-9 px-3 text-sm"
                  placeholder="Nhập mã PAKN / Tiêu đề / Tên người gửi"
                />
                <button
                  type="button"
                  onClick={goLookup}
                  className="w-full h-9 bg-[#cd7f57] text-white text-sm font-semibold rounded-sm hover:bg-[#bc6f49]"
                >
                  Tìm kiếm
                </button>
              </div>
            </div>

            <div className={rightCardClass}>
              <h3 className="px-4 py-3 border-b border-gray-200 text-[#2f4a6b] font-semibold text-xl text-center">Tình hình xử lý PAKN</h3>
              <div className="px-4 py-3 space-y-3 text-sm">
                <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                  <div>
                    <div className="text-gray-700">PAKN đã trả lời</div>
                    <div className="text-2xl leading-none mt-1 text-[#8fba2f] font-semibold">{stats.daTraLoi}</div>
                  </div>
                  <span className="text-gray-400 text-xl">✓</span>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-gray-700">PAKN đang xử lý</div>
                    <div className="text-2xl leading-none mt-1 text-[#ef9f2f] font-semibold">{stats.dangXuLy}</div>
                  </div>
                  <span className="text-gray-400 text-xl">↻</span>
                </div>
              </div>
            </div>
          </aside>
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