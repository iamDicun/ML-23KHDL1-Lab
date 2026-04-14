import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import IntroductionPage from './pages/IntroductionPage'
import CitizenLoginPage from './pages/CitizenLoginPage'
import OfficialDashboardPage from './pages/OfficialDashboardPage'
import OfficialRequestDetailPlaceholderPage from './pages/OfficialRequestDetailPlaceholderPage'
import StatisticsPage from './pages/StatisticsPage'
import EvaluationPage from './pages/EvaluationPage'
import EvaluationSummaryPage from './pages/EvaluationSummaryPage'
import PetitionSubmitPage from './pages/PetitionSubmitPage'
import PetitionLookupPage from './pages/PetitionLookupPage'
import OnlinePublicServicePage from './pages/OnlinePublicServicePage'
import DossierStatusLookupPage from './pages/DossierStatusLookupPage'
import OnlineServiceProcedureGuidePage from './pages/OnlineServiceProcedureGuidePage'
import OnlineServiceDossierFormPage from './pages/OnlineServiceDossierFormPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gioi-thieu" element={<IntroductionPage />} />
        <Route path="/thong-ke" element={<StatisticsPage />} />
        <Route path="/dich-vu-cong-truc-tuyen" element={<OnlinePublicServicePage />} />
        <Route path="/dich-vu-cong-truc-tuyen/tao-ho-so-dang-ki-co-so-kinh-doanh" element={<OnlineServiceProcedureGuidePage />} />
        <Route path="/dich-vu-cong-truc-tuyen/tao-ho-so-dang-ki-co-so-kinh-doanh/nop-ho-so" element={<OnlineServiceDossierFormPage />} />
        <Route path="/tra-cuu-tinh-trang-ho-so" element={<DossierStatusLookupPage />} />
        <Route path="/danh-gia" element={<EvaluationPage />} />
        <Route path="/danh-gia/tong-hop" element={<EvaluationSummaryPage />} />
        <Route path="/phan-anh-kien-nghi/gui" element={<PetitionSubmitPage />} />
        <Route path="/phan-anh-kien-nghi/tra-cuu" element={<PetitionLookupPage />} />
        <Route path="/dang-nhap/cong-dan" element={<CitizenLoginPage />} />
        <Route path="/can-bo/quan-ly" element={<OfficialDashboardPage />} />
        <Route path="/can-bo/ho-so/:requestId" element={<OfficialRequestDetailPlaceholderPage />} />
      </Routes>
    </Router>
  )
}

export default App
