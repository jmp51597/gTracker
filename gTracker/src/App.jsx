import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BankrollProvider } from './context/BankrollContext'
import { HandHistoryProvider } from './context/HandHistoryContext'
import NavBar from './components/NavBar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import HandBreakDown from './pages/HandBreakDown'
import './App.css'

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <NavBar />
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <NavBar />
            <History />
          </RequireAuth>
        }
      />
      <Route
        path="/hand-breakdown"
        element={
          <RequireAuth>
            <NavBar />
            <HandBreakDown />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BankrollProvider>
        <HandHistoryProvider>
          <AppRoutes />
        </HandHistoryProvider>
      </BankrollProvider>
    </AuthProvider>
  )
}
