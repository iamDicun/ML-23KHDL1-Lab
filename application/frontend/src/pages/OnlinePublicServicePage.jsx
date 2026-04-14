import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const SERVICE_ROWS = [
  {
    id: 1,
    tenThuTuc: 'Tạo hồ sơ đăng kí cơ sở kinh doanh',
    linhVuc: 'Đăng ký kinh doanh',
    mucDo: 'Toàn trình'
  }
]

const LINH_VUC_OPTIONS = ['Đăng ký kinh doanh']
const MUC_DO_OPTIONS = ['Toàn trình']

export default function OnlinePublicServicePage() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [linhVuc, setLinhVuc] = useState('')
  const [mucDo, setMucDo] = useState('')

  const goToProcedureGuide = () => {
    navigate('/dich-vu-cong-truc-tuyen/tao-ho-so-dang-ki-co-so-kinh-doanh')
  }

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return SERVICE_ROWS.filter((item) => {
      const matchKeyword = !normalizedKeyword || item.tenThuTuc.toLowerCase().includes(normalizedKeyword)
      const matchLinhVuc = !linhVuc || item.linhVuc === linhVuc
      const matchMucDo = !mucDo || item.mucDo === mucDo
      return matchKeyword && matchLinhVuc && matchMucDo
    })
  }, [keyword, linhVuc, mucDo])

  const handleSearch = () => {
    setKeyword(searchInput)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-7">
        <h2 className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">DỊCH VỤ CÔNG TRỰC TUYẾN</h2>
        <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-4" />

        <section className="bg-white border border-gray-300 p-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                }
              }}
              placeholder="Nhập tên thủ tục hành chính"
              className="h-11 border border-gray-300 px-3 text-gray-700"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="h-11 bg-[#cd7f57] text-white font-semibold rounded-sm hover:bg-[#bc6f49]"
            >
              Tìm kiếm
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Lĩnh vực</label>
              <select
                value={linhVuc}
                onChange={(e) => setLinhVuc(e.target.value)}
                className="w-full h-10 border border-gray-300 px-3 text-gray-700"
              >
                <option value="">--Chọn lĩnh vực--</option>
                {LINH_VUC_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Mức độ</label>
              <select
                value={mucDo}
                onChange={(e) => setMucDo(e.target.value)}
                className="w-full h-10 border border-gray-300 px-3 text-gray-700"
              >
                <option value="">--Chọn mức độ--</option>
                {MUC_DO_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto border border-gray-300">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-200 text-gray-700">
                <tr>
                  <th className="w-16 px-3 py-2 text-left font-semibold">STT</th>
                  <th className="px-3 py-2 text-left font-semibold">Thủ tục hành chính</th>
                  <th className="w-52 px-3 py-2 text-left font-semibold">Tên lĩnh vực</th>
                  <th className="w-28 px-3 py-2 text-left font-semibold">Mức độ</th>
                  <th className="w-36 px-3 py-2 text-left font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item, index) => (
                  <tr key={item.id} className="border-t border-gray-300 even:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{index + 1}</td>
                    <td className="px-3 py-2 text-[#d06a45]">{item.tenThuTuc}</td>
                    <td className="px-3 py-2 text-gray-800">{item.linhVuc}</td>
                    <td className="px-3 py-2 text-gray-800">{item.mucDo}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={goToProcedureGuide}
                        className="bg-[#cd7f57] text-white font-semibold px-3 py-1.5 rounded-sm hover:bg-[#bc6f49]"
                      >
                        Nộp hồ sơ
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr className="border-t border-gray-300">
                    <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                      Không có thủ tục phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-gray-600 text-sm mt-2 px-1">
            <div>Số dòng hiển thị 10</div>
            <div>Tổng số dòng: {filteredRows.length} / 1 trang</div>
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