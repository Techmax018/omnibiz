import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { API_BASE, defaultFetchOptions } from '../api/config'

const NotificationsContext = createContext(null)

export const CATEGORY_ICONS = {
  login:    '🔐',
  sale:     '🛒',
  invoice:  '🧾',
  account:  '🏢',
  user:     '👤',
  stock:    '📦',
  transfer: '↔️',
  payment:  '💳',
  employee: '👷',
  system:   '⚙️',
}

export const CATEGORY_COLORS = {
  login:    '#3182ce',
  sale:     '#38a169',
  invoice:  '#805ad5',
  account:  '#d69e2e',
  user:     '#e53e3e',
  stock:    '#dd6b20',
  transfer: '#319795',
  payment:  '#38a169',
  employee: '#3182ce',
  system:   '#718096',
}

export function timeAgo(iso) {
  // Backend stores UTC without 'Z' suffix — add it so JS parses correctly
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  const diff = Math.floor((Date.now() - new Date(normalized)) / 1000)
  if (diff < 10)     return 'now'
  if (diff < 60)     return `${diff}s ago`
  if (diff < 120)    return '1 min ago'
  if (diff < 3600)   return `${Math.floor(diff / 60)} mins ago`
  if (diff < 7200)   return '1 hour ago'
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hours ago`
  if (diff < 172800) return 'Yesterday'
  return new Date(normalized).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function enrichNotification(n) {
  return {
    ...n,
    icon:  CATEGORY_ICONS[n.category]  ?? '🔔',
    color: CATEGORY_COLORS[n.category] ?? '#718096',
    time:  timeAgo(n.created_at),
  }
}

export function NotificationsProvider({ children, enabled = true }) {
  // allNotifications — full server list, never loses dismissed items
  const [allNotifications, setAllNotifications] = useState([])
  // dismissedIds — only hidden from the dropdown, still shown in the sidebar log
  const [dismissedIds, setDismissedIds] = useState(new Set())
  const pollRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch(`${API_BASE}/api/notifications?limit=50`, defaultFetchOptions)
      if (!res.ok) return
      const data = await res.json()
      setAllNotifications(data.map(enrichNotification))
    } catch { /* silent */ }
  }, [enabled])

  // initial load + 30s poll — also refresh time labels every 30s
  useEffect(() => {
    if (!enabled) return
    fetchNotifications()
    pollRef.current = setInterval(() => {
      setAllNotifications(prev => prev.map(n => ({ ...n, time: timeAgo(n.created_at) })))
      fetchNotifications()
    }, 30_000)
    return () => clearInterval(pollRef.current)
  }, [fetchNotifications, enabled])

  const markRead = async (id) => {
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST', ...defaultFetchOptions })
      setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch { /* silent */ }
  }

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST', ...defaultFetchOptions })
      setAllNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch { /* silent */ }
  }

  // dismiss only hides from the topbar dropdown — does NOT remove from sidebar log
  const dismiss = (id) => setDismissedIds(prev => new Set([...prev, id]))

  // clear all dismissals (user can reset from sidebar)
  const clearDismissed = () => setDismissedIds(new Set())

  // dropdown shows non-dismissed items only
  const notifications = allNotifications.filter(n => !dismissedIds.has(n.id))
  const unreadCount   = notifications.filter(n => !n.is_read).length

  return (
    <NotificationsContext.Provider value={{
      notifications,        // dropdown list (dismissable)
      allNotifications,     // full persistent list for sidebar log
      unreadCount,
      dismissedIds,
      fetchNotifications,
      markRead,
      markAllRead,
      dismiss,
      clearDismissed,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
