import Navbar from '../components/Navbar'

const features = [
  {
    id: 1,
    icon: 'register',
    description: 'Đăng ký và được cấp ngay một tài khoản của Cổng Dịch vụ công để đăng nhập.'
  },
  {
    id: 2,
    icon: 'search',
    description: 'Tra cứu thông tin, Dịch vụ công các Cục/Tổng cục, lĩnh vực về thủ tục hành chính; Gửi phản ánh kiến nghị liên quan đến việc giải quyết thủ tục hành chính, Dịch vụ công.'
  },
  {
    id: 3,
    icon: 'track',
    description: 'Theo dõi toàn bộ quá trình giải quyết thủ tục hành chính và xử lý phản ánh kiến nghị của mình bằng cách cung cấp mã hồ sơ.'
  },
  {
    id: 4,
    icon: 'share',
    description: 'Đăng nhập bằng tài khoản Cổng dịch vụ công Quốc gia để đăng nhập; không phải cập nhật các trường thông tin, dữ liệu đã được lưu trữ trong tài khoản Cổng Dịch vụ công Quốc gia.'
  },
  {
    id: 5,
    icon: 'storage',
    description: 'Được hỗ trợ lưu trữ thông tin của cá nhân, tổ chức lưu trữ tại các Cơ sở dữ liệu, Hệ thống thông tin đã tích hợp với Cổng Dịch vụ công Quốc gia.'
  },
  {
    id: 6,
    icon: 'payment',
    description: 'Sử dụng tài khoản của các ngân hàng, trung gian thanh toán để thanh toán trực tuyến phí, lệ phí thực hiện thủ tục hành chính; Dịch vụ công.'
  },
  {
    id: 7,
    icon: 'feedback',
    description: 'Đánh giá sự hài lòng trong giải quyết thủ tục hành chính: Tham gia thăm dò, khảo sát.'
  }
]

function FeatureIcon({ type }) {
  const baseClass = 'w-7 h-7 text-[#de915c]'

  if (type === 'register') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4 12h12" strokeLinecap="round" />
        <path d="m11 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'search') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="11" cy="11" r="4" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        <path d="M2.5 20c1.4-2.2 3.4-3 6.2-3" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'track') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
        <path d="m6 8 1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'share') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <circle cx="6" cy="12" r="2.2" />
        <circle cx="18" cy="6" r="2.2" />
        <circle cx="18" cy="18" r="2.2" />
        <path d="m8.2 11 7.4-3.8M8.2 13l7.4 3.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'storage') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4 6h16v12H4z" />
        <path d="M4 10h16M9 3v6M15 3v6" strokeLinecap="round" />
        <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  if (type === 'payment') {
    return (
      <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M4 9h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
        <path d="M6 9V7a6 6 0 1 1 12 0v2" strokeLinecap="round" />
        <path d="M12 13v3" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className={baseClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 14a4.5 4.5 0 0 0 7 0" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export default function IntroductionPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-[#d27953] text-3xl font-semibold tracking-wide">
            Giới thiệu về Cổng Dịch vụ công Bộ VHTTDL
          </h1>
          <div className="mt-3 h-[2px] bg-[#d98c67]" />

          <div className="relative mt-5 overflow-hidden border border-[#e4b098] bg-[#d9906b] min-h-[235px]">
            <img
              src="/images/trongdong.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#cd7d57]/80 via-[#dc956f]/70 to-[#c9754e]/80" />

            <div className="relative z-10 h-full flex items-end justify-center gap-6 px-4 pb-5 pt-8">
              <div className="w-16 h-[138px] rounded-[14px] bg-[#1f1f1f] shadow-lg border-[3px] border-black p-1.5 hidden sm:block">
                <div className="w-full h-full rounded-[10px] bg-white p-1 overflow-hidden">
                  <img src="/images/DVCQG_banner.png" alt="Mô phỏng giao diện dịch vụ công trên điện thoại" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="w-full max-w-[560px] rounded-[14px] bg-[#121212] border-[4px] border-black shadow-2xl p-2">
                <div className="h-5 rounded-t-md bg-[#212121]" />
                <div className="bg-white rounded-b-md p-2 h-[168px] overflow-hidden">
                  <img src="/images/DVCQG_banner.png" alt="Mô phỏng giao diện dịch vụ công trên máy tính" className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="w-24 h-[170px] rounded-[10px] bg-[#101010] border-[3px] border-black shadow-xl p-1.5 hidden md:block">
                <div className="w-full h-full rounded-[6px] bg-white p-1 overflow-hidden">
                  <img src="/images/DVCQG_banner.png" alt="Mô phỏng giao diện dịch vụ công trên máy tính bảng" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-[#4d5667] text-sm md:text-base leading-7">
            <p>
              Với quan điểm công khai, minh bạch, lấy công dân, doanh nghiệp, tổ chức, đơn vị sự nghiệp làm trung tâm phục vụ,
              Cổng Dịch vụ công Bộ VHTTDL kết nối, cung cấp thông tin về thủ tục hành chính và dịch vụ công trực tuyến;
              hỗ trợ thực hiện, giám sát, đánh giá việc giải quyết thủ tục hành chính, dịch vụ công trực tuyến và tiếp nhận,
              xử lý phản ánh, kiến nghị của công dân, doanh nghiệp, tổ chức, đơn vị sự nghiệp trên địa bàn.
            </p>
            <p>
              Công dân, doanh nghiệp, tổ chức, đơn vị sự nghiệp dễ dàng truy cập Cổng Dịch vụ công Bộ Văn Hóa, Thể thao,
              Du lịch tại địa chỉ <span className="text-[#1f67d4]">dichvucong.bvhttdl.gov.vn</span> theo nhu cầu người dùng
              từ máy tính, máy tính bảng hoặc điện thoại di động được kết nối internet để hưởng nhiều lợi ích từ Cổng Dịch vụ công Bộ Văn Hóa, Thể thao, Du lịch, như:
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            {features.map((feature) => (
              <article key={feature.id} className="max-w-sm">
                <div className="w-16 h-16 rounded-full bg-[#f8eadc] flex items-center justify-center shadow-sm">
                  <FeatureIcon type={feature.icon} />
                </div>
                <p className="mt-4 text-[#4d5667] text-sm leading-7">{feature.description}</p>
              </article>
            ))}
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
