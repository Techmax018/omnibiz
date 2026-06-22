/**
 * Central API client for OmniBiz.
 *
 * Handles:
 *  - JSON serialisation / deserialisation
 *  - Structured error messages from backend `detail` field
 *  - 401 session-expired → fires a custom event so AuthContext can redirect
 *  - Network failures → user-friendly message
 */
import { API_BASE, defaultFetchOptions } from './config'

// Fired when the server returns 401 so AuthContext can react
export const SESSION_EXPIRED_EVENT = 'omnibiz:session-expired'

function dispatchSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

/**
 * Extracts a human-readable error message from a fetch Response.
 * Tries JSON `detail` field first, then falls back to status text.
 */
async function extractError(res) {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      // Pydantic validation errors — join messages
      return body.detail.map(e => e.msg || JSON.stringify(e)).join('; ')
    }
    return `Request failed (${res.status})`
  } catch {
    return res.statusText || `Request failed (${res.status})`
  }
}

/**
 * Core fetch wrapper.
 *
 * @param {string} path - API path, e.g. '/api/dashboard'
 * @param {RequestInit} options - additional fetch options
 * @returns {Promise<any>} parsed JSON response
 * @throws {Error} with a user-facing `.message`
 */
export async function apiFetch(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { ...defaultFetchOptions, ...options })
  } catch (networkErr) {
    throw new Error('Network error — please check your connection and try again.')
  }

  if (res.status === 401) {
    dispatchSessionExpired()
    throw new Error('Your session has expired. Please log in again.')
  }

  if (res.status === 403) {
    const msg = await extractError(res)
    throw new Error(msg || 'You do not have permission to perform this action.')
  }

  if (!res.ok) {
    const msg = await extractError(res)
    throw new Error(msg)
  }

  // 204 No Content
  if (res.status === 204) return null

  return res.json()
}

/**
 * Convenience wrappers
 */
export const get  = (path)         => apiFetch(path)
export const post = (path, data)   => apiFetch(path, { method: 'POST',   body: JSON.stringify(data) })
export const patch = (path, data)  => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(data) })
export const del  = (path)         => apiFetch(path, { method: 'DELETE' })
