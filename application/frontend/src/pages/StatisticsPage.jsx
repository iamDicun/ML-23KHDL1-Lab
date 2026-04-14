import Navbar from '../components/Navbar'
import StatsTable from '../components/StatsTable'

export default function StatisticsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 bg-white border-t border-gray-200">
        <StatsTable showChart />
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