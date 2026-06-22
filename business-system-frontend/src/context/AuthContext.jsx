import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCurrentUser, refreshSession, login as apiLogin } from '../api/auth'
import { API_BASE, defaultFetchOptions } from '../api/config'
import { SESSION_EXPIRED_EVENT } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [activeTenant, setActiveTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false)
  const navigate = useNavigate()

  const checkSetupStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/setup/status`, defaultFetchOptions)
      if (res.ok) {
        const data = await res.json()
        setIsFirstTimeSetup(data.is_first_time_setup)
      }
    } catch {
      // silent — don't block login on setup check failure
    }
  }

  const login = async (email, password) => {
    // apiLogin throws with the real server message on failure
    const payload = await apiLogin(email, password)
    setUser(payload.user)
    setActiveTenant(payload.tenant)

    const role = payload.user?.role
    if (role === 'SuperAdmin') {
      navigate('/admin', { replace: true })
    } else if (role === 'Cashier') {
      navigate('/pos', { replace: true })
    } else if (role === 'Manager') {
      await checkSetupStatus()
      navigate('/dashboard', { replace: true })
    } else if (role === 'Owner') {
      await checkSetupStatus()
      navigate('/dashboard', { replace: true })
    } else {
      // Fallback — unknown role, go to login with a clear message
      setUser(null)
      setActiveTenant(null)
      throw new Error('Your account role is not recognised. Contact your administrator.')
    }
  }

  const logout = () => {
    setUser(null)
    setActiveTenant(null)
    setIsFirstTimeSetup(false)
    navigate('/login', { replace: true })
  }

  // Listen for 401 events fired by the API client — redirect to login
  useEffect(() => {
    const handleExpired = () => {
      setUser(null)
      setActiveTenant(null)
      setIsFirstTimeSetup(false)
      navigate('/login', { replace: true })
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired)
  }, [navigate])

  const completeSetup = () => {
    setIsFirstTimeSetup(false)
  }

  useEffect(() => {
    async function bootstrapSession() {
      try {
        const payload = await fetchCurrentUser()
        setUser(payload.user)
        setActiveTenant(payload.tenant)
        const role = payload.user?.role
        if (role !== 'SuperAdmin' && role !== 'Cashier') {
          await checkSetupStatus()
        }
      } catch (error) {
        try {
          const refreshed = await refreshSession()
          setUser(refreshed.user)
          setActiveTenant(refreshed.tenant)
          const role = refreshed.user?.role
          if (role !== 'SuperAdmin' && role !== 'Cashier') {
            await checkSetupStatus()
          }
        } catch {
          setUser(null)
          setActiveTenant(null)
        }
      } finally {
        setLoading(false)
      }
    }
    bootstrapSession()
  }, [])

  return (
    <AuthContext.Provider value={{
      user, activeTenant, setActiveTenant,
      loading, login, logout,
      isFirstTimeSetup, completeSetup,
      role: user?.role ?? null,
      branchId: user?.branch_id ?? null,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
