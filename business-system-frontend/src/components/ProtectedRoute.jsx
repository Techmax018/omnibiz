import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Role-aware protected route guard.
 *
 * allowedRoles — if provided, redirects the user to their correct home
 * if their role doesn't belong here. Unauthenticated users always get
 * redirected to /login.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-loading">Loading session…</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // If allowedRoles is specified and the current user's role isn't in it,
  // redirect them to their correct home instead of showing a 403 screen.
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={roleHome(role)} replace />
  }

  return children
}

/**
 * Maps a role to its home route.
 */
export function roleHome(role) {
  if (role === 'SuperAdmin') return '/admin'
  if (role === 'Cashier') return '/pos'
  return '/dashboard'  // Owner, Manager
}
