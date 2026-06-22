import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import ProtectedRoute, { roleHome } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './components/Dashboard'
import OnboardingWizard from './components/OnboardingWizard'
import SuperAdminDashboard from './components/SuperAdminDashboard'
import CashierPOS from './components/CashierPOS'
import './App.css'

function AppShell() {
  const { isFirstTimeSetup, user, role } = useAuth()
  return (
    <NotificationsProvider enabled={!!user && role !== 'SuperAdmin'}>
      {/* Onboarding wizard shown only for Owner/Manager after first login */}
      {isFirstTimeSetup && role === 'Owner' && <OnboardingWizard />}

      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Super Admin — platform management */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['SuperAdmin']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Cashier — dedicated POS interface */}
        <Route
          path="/pos"
          element={
            <ProtectedRoute allowedRoles={['Cashier']}>
              <CashierPOS />
            </ProtectedRoute>
          }
        />

        {/* Owner + Manager — full business dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['Owner', 'Manager']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Root redirect — role-aware */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to={roleHome(role)} replace />
              : <Navigate to="/login" replace />
          }
        />

        {/* Catch-all — redirect to appropriate home */}
        <Route
          path="*"
          element={
            user
              ? <Navigate to={roleHome(role)} replace />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </NotificationsProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
