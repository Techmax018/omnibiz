import { API_BASE, defaultFetchOptions } from './config'

/**
 * Extracts the server's error message from a failed response.
 * FastAPI returns { detail: "..." } for all errors.
 */
async function extractError(res) {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
    }
  } catch { /* ignore parse errors */ }
  return `Request failed (${res.status})`
}

export async function login(email, password) {
  let res
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      ...defaultFetchOptions,
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error('Network error — check your connection and try again.')
  }

  if (!res.ok) {
    const msg = await extractError(res)
    throw new Error(msg)
  }

  return res.json()
}

export async function refreshSession() {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    ...defaultFetchOptions,
  })
  if (!res.ok) throw new Error('Session expired')
  return res.json()
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    ...defaultFetchOptions,
  })
  if (!res.ok) throw new Error('No active session')
  return res.json()
}

export async function switchTenant(tenantId) {
  const res = await fetch(`${API_BASE}/auth/switch-tenant`, {
    method: 'POST',
    ...defaultFetchOptions,
    body: JSON.stringify({ tenant_id: tenantId }),
  })
  if (!res.ok) {
    const msg = await extractError(res)
    throw new Error(msg)
  }
  return res.json()
}
