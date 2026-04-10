import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CitizenLoginPage from './pages/CitizenLoginPage'
import OfficialDashboardPage from './pages/OfficialDashboardPage'
import OfficialRequestDetailPlaceholderPage from './pages/OfficialRequestDetailPlaceholderPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dang-nhap/cong-dan" element={<CitizenLoginPage />} />
        <Route path="/can-bo/quan-ly" element={<OfficialDashboardPage />} />
        <Route path="/can-bo/ho-so/:requestId" element={<OfficialRequestDetailPlaceholderPage />} />
      </Routes>
    </Router>
  )
}

export default App
