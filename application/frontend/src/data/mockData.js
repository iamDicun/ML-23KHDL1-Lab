// Mock data - sẽ được thay bằng dữ liệu từ database

export const categories = [
  {
    id: 'cong-dan',
    title: 'CÔNG DÂN',
    items: [
      { id: 1, icon: '🎭', label: 'Hoạt động mua bán hàng hóa quốc tế chuyên ngành văn hóa' },
      { id: 2, icon: '📋', label: 'Bản quyền tác giả' },
      { id: 3, icon: '🏛️', label: 'Di sản văn hóa' },
      { id: 4, icon: '🎬', label: 'Điện ảnh' },
      { id: 5, icon: '🎨', label: 'Mỹ thuật, nhiếp ảnh và triển lãm' },
      { id: 6, icon: '📚', label: 'Thư viện' },
    ]
  },
  {
    id: 'doanh-nghiep',
    title: 'DOANH NGHIỆP',
    items: [
      { id: 1, icon: '🎭', label: 'Hoạt động mua bán hàng hóa quốc tế chuyên ngành văn hóa' },
      { id: 2, icon: '📋', label: 'Bản quyền tác giả' },
      { id: 3, icon: '🏛️', label: 'Di sản văn hóa' },
      { id: 4, icon: '🎬', label: 'Điện ảnh' },
      { id: 5, icon: '🎨', label: 'Mỹ thuật, nhiếp ảnh và triển lãm' },
      { id: 6, icon: '📚', label: 'Thư viện' },
    ]
  },
  {
    id: 'to-chuc',
    title: 'TỔ CHỨC, ĐƠN VỊ SỰ NGHIỆP',
    items: [
      { id: 1, icon: '🎭', label: 'Hoạt động mua bán hàng hóa quốc tế chuyên ngành văn hóa' },
      { id: 2, icon: '📋', label: 'Bản quyền tác giả' },
      { id: 3, icon: '🏛️', label: 'Di sản văn hóa' },
      { id: 4, icon: '🎬', label: 'Điện ảnh' },
      { id: 5, icon: '🎨', label: 'Mỹ thuật, nhiếp ảnh và triển lãm' },
      { id: 6, icon: '📚', label: 'Thư viện' },
    ]
  }
]

export const navLinks = [
  { label: 'GIỚI THIỆU', href: '/gioi-thieu' },
  {
    label: 'THÔNG TIN VÀ DỊCH VỤ',
    href: '/dich-vu-cong-truc-tuyen',
    children: [
      { label: 'Dịch vụ công trực tuyến', href: '/dich-vu-cong-truc-tuyen' },
      { label: 'Tra cứu tình trạng hồ sơ', href: '/tra-cuu-tinh-trang-ho-so' }
    ]
  },
  {
    label: 'PHẢN ÁNH KIẾN NGHỊ',
    href: '/phan-anh-kien-nghi/gui',
    children: [
      { label: 'Gửi phản ánh kiến nghị', href: '/phan-anh-kien-nghi/gui' },
      { label: 'Tra cứu phản ánh kiến nghị', href: '/phan-anh-kien-nghi/tra-cuu' }
    ]
  },
  { label: 'THỐNG KÊ', href: '/thong-ke' },
  {
    label: 'ĐÁNH GIÁ TRỰC TUYẾN',
    href: '/danh-gia',
    children: [
      { label: 'Tổng hợp đánh giá', href: '/danh-gia/tong-hop' },
      { label: 'Đánh giá', href: '/danh-gia' }
    ]
  },
  { label: 'HỖ TRỢ', href: 'https://dichvucong.bvhttdl.gov.vn/congdan/Default.aspx?tabid=252' },
]

export const statsData = {
  years: [2022, 2023, 2024, 2025, 2026],
  selectedYear: 2025,
  total: { received: 0, resolved: 0 },
  months: Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    percent: 0,
    resolved: 0
  }))
}
