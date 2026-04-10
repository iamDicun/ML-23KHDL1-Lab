import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiClient } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

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

const priorityClass = (priority) => {
  switch (priority) {
    case 'high':
      return 'text-red-700'
    case 'medium':
      return 'text-amber-700'
    default:
      return 'text-gray-700'
  }
}

export default function OfficialDashboardPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [dashboard, setDashboard] = useState({
    overview: {
      totalBusinesses: 0,
      totalRequests: 0,
      pendingRequests: 0,
      todayTasks: 0
    },
    businesses: [],
    requests: [],
    requestStatusSummary: [],
    todayTasks: [],
    documents: [],
    aiFeature: {
      enabled: false,
      label: 'AI dự đoán xu hướng (sẽ bổ sung sau)'
    }
  })

  const [selectedStatus, setSelectedStatus] = useState('all')

  useEffect(() => {
    const fetchDashboard = async () => {
      setErrorMessage('')
      setLoading(true)
      try {
        const data = await apiClient.get('/can-bo/dashboard')
        setDashboard(data)
      } catch (error) {
        setErrorMessage(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  const statusOptions = useMemo(() => {
    return [{ status: 'all', label: 'Tất cả', count: dashboard.requests.length }, ...dashboard.requestStatusSummary]
  }, [dashboard])

  const filteredRequests = useMemo(() => {
    if (selectedStatus === 'all') return dashboard.requests
    return dashboard.requests.filter((item) => item.status === selectedStatus)
  }, [dashboard.requests, selectedStatus])

  const isOfficial = isAuthenticated && user?.role === 'official'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Trang Quản Lý Cán Bộ</h1>
              <p className="text-sm text-gray-600 mt-1">
                Theo dõi cơ sở kinh doanh, hồ sơ xử lý và công việc trong ngày.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="px-4 py-2 rounded bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed"
              title="Tính năng AI dự đoán xu hướng sẽ được bổ sung ở bước sau"
            >
              {dashboard.aiFeature?.label || 'AI dự đoán xu hướng (sẽ bổ sung sau)'}
            </button>
          </div>

          {!isOfficial && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Bạn chưa đăng nhập tài khoản cán bộ. Vui lòng đăng nhập để tải dữ liệu quản lý.
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Cơ sở kinh doanh</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{dashboard.overview.totalBusinesses}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Tổng hồ sơ</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{dashboard.overview.totalRequests}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Hồ sơ chờ xử lý</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{dashboard.overview.pendingRequests}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500">Việc cần làm hôm nay</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{dashboard.overview.todayTasks}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Cơ Sở Kinh Doanh</h2>
              <span className="text-xs text-gray-500">Mới nhất</span>
            </div>
            <div className="max-h-[460px] overflow-auto">
              {loading ? (
                <p className="px-4 py-5 text-sm text-gray-500">Đang tải dữ liệu...</p>
              ) : dashboard.businesses.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500">Chưa có cơ sở kinh doanh nào.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {dashboard.businesses.map((biz) => (
                    <li key={biz.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{biz.name}</div>
                          <div className="text-xs text-gray-600 mt-1">{biz.business_type} • {biz.district || 'Chưa rõ quận'} • {biz.province_city}</div>
                          <div className="text-xs text-gray-500 mt-1">{biz.address}</div>
                        </div>
                        <span className="text-[11px] rounded border px-2 py-1 bg-gray-100 text-gray-700 border-gray-200 whitespace-nowrap">
                          {biz.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-2">
                        Chủ cơ sở: {biz.owner_name || 'Chưa có'} • Cấp phép: {biz.license_number || 'N/A'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Quản Lý Hồ Sơ</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusOptions.map((item) => (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => setSelectedStatus(item.status)}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                      selectedStatus === item.status
                        ? 'bg-[#8B2500] text-white border-[#8B2500]'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-[#8B2500]'
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[460px] overflow-auto">
              {loading ? (
                <p className="px-4 py-5 text-sm text-gray-500">Đang tải dữ liệu...</p>
              ) : filteredRequests.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500">Không có hồ sơ phù hợp trạng thái.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredRequests.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">#{item.id} • {item.requestType}</div>
                          <div className="text-xs text-gray-600 mt-1">{item.businessName}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Người nộp: {item.citizen.fullName} ({item.citizen.phone || 'N/A'})
                          </div>
                        </div>
                        <span className={`text-[11px] rounded border px-2 py-1 whitespace-nowrap ${statusBadgeClass(item.status)}`}>
                          {item.statusLabel}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-[11px] text-gray-500">Nộp: {formatDateTime(item.submittedAt)}</div>
                        <button
                          type="button"
                          onClick={() => navigate(`/can-bo/ho-so/${item.id}`)}
                          className="text-xs px-3 py-1.5 rounded border border-[#8B2500] text-[#8B2500] hover:bg-[#8B2500] hover:text-white transition-colors"
                        >
                          Chi tiết hồ sơ
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Công Việc Cần Giải Quyết Trong Ngày</h2>
            </div>
            <div className="max-h-[320px] overflow-auto">
              {loading ? (
                <p className="px-4 py-5 text-sm text-gray-500">Đang tải dữ liệu...</p>
              ) : dashboard.todayTasks.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500">Hôm nay chưa có việc nào được giao.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {dashboard.todayTasks.map((task) => (
                    <li key={task.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{task.title}</div>
                          <div className="text-xs text-gray-600 mt-1">{task.description || 'Không có mô tả'}</div>
                          <div className="text-[11px] text-gray-500 mt-2">Hạn: {formatDate(task.dueDate)} {task.dueTime ? `• ${task.dueTime}` : ''}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-semibold ${priorityClass(task.priority)}`}>{task.priorityLabel}</div>
                          <div className="text-[11px] text-gray-500 mt-1">{task.statusLabel}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Công Văn • Nghị Quyết • Tin Tức Cán Bộ</h2>
            </div>
            <div className="max-h-[320px] overflow-auto">
              {loading ? (
                <p className="px-4 py-5 text-sm text-gray-500">Đang tải dữ liệu...</p>
              ) : dashboard.documents.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-500">Chưa có bản tin/công văn nào.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {dashboard.documents.map((doc) => (
                    <li key={doc.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">{doc.categoryLabel}</span>
                            {doc.isPinned && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Ưu tiên</span>
                            )}
                          </div>
                          <div className="font-semibold text-gray-900">{doc.title}</div>
                          <div className="text-xs text-gray-600 mt-1">{doc.summary || 'Không có tóm tắt'}</div>
                          <div className="text-[11px] text-gray-500 mt-2">
                            {doc.documentNumber ? `${doc.documentNumber} • ` : ''}
                            {doc.issuedBy || 'Đơn vị ban hành'} • {formatDate(doc.publishedAt)}
                          </div>
                        </div>
                        {doc.externalUrl && (
                          <a
                            href={doc.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-3 py-1.5 rounded border border-[#8B2500] text-[#8B2500] hover:bg-[#8B2500] hover:text-white transition-colors whitespace-nowrap"
                          >
                            Mở link
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
