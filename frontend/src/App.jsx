import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CitizenLoginPage from './pages/CitizenLoginPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dang-nhap/cong-dan" element={<CitizenLoginPage />} />
      </Routes>
    </Router>
  )
}

export default App
