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
  { label: 'GIỚI THIỆU', href: '#' },
  { label: 'THÔNG TIN VÀ DỊCH VỤ', href: '#' },
  { label: 'TIỆN ÍCH', href: '#' },
  { label: 'PHẢN ÁNH KIẾN NGHỊ', href: '#' },
  { label: 'THỐNG KÊ', href: '#' },
  { label: 'ĐÁNH GIÁ TRỰC TUYẾN', href: '#' },
  { label: 'HỖ TRỢ', href: '#' },
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
