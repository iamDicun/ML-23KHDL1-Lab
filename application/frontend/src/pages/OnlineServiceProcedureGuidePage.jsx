import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

const SUBMIT_ROUTE = '/dich-vu-cong-truc-tuyen/tao-ho-so-dang-ki-co-so-kinh-doanh/nop-ho-so'

const topTabs = [
  { key: 'lookup', label: 'Tra cứu thủ tục hành chính', href: '/dich-vu-cong-truc-tuyen' },
  { key: 'online', label: 'Dịch vụ công trực tuyến', href: '/dich-vu-cong-truc-tuyen' },
  { key: 'status', label: 'Tra cứu tình trạng hồ sơ', href: '/tra-cuu-tinh-trang-ho-so' },
  { key: 'payment', label: 'Thanh toán trực tuyến', href: '/dich-vu-cong-truc-tuyen' }
]

const processSteps = [
  {
    title: 'Bước 1: Chuẩn bị thông tin',
    description: 'Chuẩn bị đầy đủ giấy tờ cá nhân, thông tin cơ sở kinh doanh và địa chỉ đăng ký hoạt động.'
  },
  {
    title: 'Bước 2: Khai báo hồ sơ trực tuyến',
    description: 'Điền biểu mẫu điện tử trên cổng dịch vụ công, đính kèm thông tin bắt buộc và kiểm tra lại dữ liệu.'
  }
]

const documentChecklist = [
  {
    id: 1,
    tenHoSo: 'Tờ khai đăng ký cơ sở kinh doanh theo biểu mẫu điện tử',
    banChinh: 1,
    banSao: 0
  },
  {
    id: 2,
    tenHoSo: 'Thông tin giấy tờ tùy thân của người nộp hồ sơ (CCCD/Hộ chiếu)',
    banChinh: 1,
    banSao: 0
  },
  {
    id: 3,
    tenHoSo: 'Thông tin địa chỉ cơ sở và mô tả loại hình/lĩnh vực kinh doanh',
    banChinh: 1,
    banSao: 0
  }
]

export default function OnlineServiceProcedureGuidePage() {
  const navigate = useNavigate()
  const [agency, setAgency] = useState('Cục Phát thanh Truyền hình và Thông tin điện tử')

  const handleTopTabClick = (href) => {
    if (href) {
      navigate(href)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f6f6]">
      <Navbar />

      <div className="bg-[#c97953]">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
          <div className="min-w-[760px] flex text-white text-[17px] font-semibold">
            {topTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTopTabClick(tab.href)}
                className={`px-5 py-2.5 border-r border-[#d89a79] whitespace-nowrap ${tab.key === 'online' ? 'bg-[#b8643e]' : 'hover:bg-[#b8643e]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-7">
        <div className="text-[#d06a45] text-lg font-semibold uppercase tracking-wide">CHI TIẾT THỦ TỤC HÀNH CHÍNH</div>
        <div className="h-[1.5px] bg-[#d88f70] mt-2 mb-4" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
          <section className="bg-white border border-gray-300">
            <div className="bg-[#f4ebcf] border-b border-gray-300 px-4 py-3">
              <h1 className="text-[40px] leading-tight text-[#2f3542] font-bold" style={{ fontFamily: 'serif' }}>
                Tạo hồ sơ đăng kí cơ sở kinh doanh
              </h1>
            </div>

            <div className="px-4 py-3 space-y-4 text-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-[#3a4458]">Điều kiện thực hiện thủ tục hành chính</h3>
                <p className="mt-1 text-sm leading-6">
                  Người nộp hồ sơ là công dân/tổ chức có nhu cầu đăng ký cơ sở kinh doanh trong lĩnh vực văn hóa,
                  thể thao hoặc du lịch. Các thông tin khai báo phải trung thực và khớp với giấy tờ pháp lý.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#3a4458]">Cách thức thực hiện</h3>
                <p className="mt-1 text-sm leading-6">
                  Nộp hồ sơ trực tuyến trên Cổng dịch vụ công, nhận mã hồ sơ điện tử và theo dõi tiến độ xử lý tại mục
                  tra cứu tình trạng hồ sơ.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#3a4458]">Quy trình xử lý</h3>
                <div className="mt-2 space-y-2">
                  {processSteps.map((step) => (
                    <div key={step.title} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className="font-semibold text-sm text-[#2f4a6b]">{step.title}</p>
                      <p className="text-sm text-gray-700 mt-1">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[#3a4458]">Danh sách hồ sơ cần chuẩn bị</h3>
                <div className="mt-2 overflow-x-auto border border-gray-300">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-200 text-gray-700">
                      <tr>
                        <th className="w-14 px-3 py-2 text-left font-semibold">STT</th>
                        <th className="px-3 py-2 text-left font-semibold">Tên hồ sơ</th>
                        <th className="w-24 px-3 py-2 text-left font-semibold">Bản chính</th>
                        <th className="w-24 px-3 py-2 text-left font-semibold">Bản sao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentChecklist.map((doc) => (
                        <tr key={doc.id} className="border-t border-gray-300 even:bg-gray-50">
                          <td className="px-3 py-2">{doc.id}</td>
                          <td className="px-3 py-2">{doc.tenHoSo}</td>
                          <td className="px-3 py-2">{doc.banChinh}</td>
                          <td className="px-3 py-2">{doc.banSao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <aside className="bg-white border border-gray-300 p-4 space-y-3">
            <h3 className="text-xl font-semibold text-[#3a4458] text-center">Chọn cơ quan thực hiện</h3>
            <select
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              className="w-full h-10 border border-gray-300 px-3 text-sm"
            >
              <option value="Cục Phát thanh Truyền hình và Thông tin điện tử">Cục Phát thanh Truyền hình và Thông tin điện tử</option>
              <option value="Sở Văn hóa Thể thao và Du lịch">Sở Văn hóa Thể thao và Du lịch</option>
            </select>
            <p className="text-center text-[#2f4a6b] font-semibold">Dịch vụ công toàn trình</p>
            <button
              type="button"
              onClick={() => navigate(SUBMIT_ROUTE)}
              className="w-full h-11 bg-[#cd7f57] text-white font-semibold rounded-sm hover:bg-[#bc6f49]"
            >
              Nộp hồ sơ
            </button>
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
