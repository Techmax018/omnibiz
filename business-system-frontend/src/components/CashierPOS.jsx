/**
 * CashierPOS — dedicated full-page POS shell for Cashier role.
 *
 * Cashiers land here directly after login (/pos).
 * They see ONLY the POS interface — no admin nav, no analytics.
 * The shell provides: role badge, offline status, notifications
 * bell (limited to their own), and sign-out.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { logoutApi } from '../api/modules'
import CashierDashboard from './dashboards/CashierDashboard'

export default function CashierPOS() {
  const { user, activeTenant, branchId, logout } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications()
  const { isOnline, pendingCount } = useOfflineSync()

  const [notifOpen, setNotifOpen]   = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [theme, setTheme]           = useState('light')

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark')
  }, [theme])

  const handleLogout = async () => {
    try { await logoutApi() } catch {}
    logout()
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? 'C'

  return (
    <main className="dashboard-page">
      {/* ── Minimal sidebar for Cashier ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/omnibizlogo.png" alt="OmniBiz" className="brand-logo" />
          <div>
            <div className="brand-name">OmniBiz</div>
            <div className="brand-subtitle">{activeTenant?.name ?? 'POS'}</div>
          </div>
        </div>

        {/* Role + branch badge */}
        <div style={{ padding: '10px 18px 4px' }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: 'rgba(56,161,105,0.1)', color: '#38a169',
          }}>
            Cashier / POS
            {branchId ? ` · Branch #${branchId}` : ''}
          </span>
        </div>

        <div className="sidebar-section-label">Session</div>
        <ul className="sidebar-nav-list">
          <li>
            <button type="button" className="sidebar-link active">
              <span className="nav-icon">⊞</span>
              Point of Sale
            </button>
          </li>
        </ul>

        {/* Offline indicator in sidebar */}
        {!isOnline && (
          <div style={{ margin: '12px 14px', padding: '8px 12px', borderRadius: 8,
            background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)',
            fontSize: '0.75rem', color: '#c53030' }}>
            ⚠ Offline mode — {pendingCount} sale{pendingCount !== 1 ? 's' : ''} queued
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        {/* Slim topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">Point of Sale</span>
          </div>

          <div className="topbar-right">
            <span className={`status-chip ${isOnline ? 'status-online' : 'status-offline'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {pendingCount > 0 && (
              <span className="status-chip status-pending">{pendingCount} queued</span>
            )}

            {/* Notifications */}
            <div className="settings-wrapper">
              <button type="button" className="topbar-icon-btn notif-btn"
                onClick={() => { setNotifOpen(o => !o); setAccountOpen(false) }}>
                🔔
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-panel">
                  <div className="notif-header">
                    <span className="notif-title">Notifications</span>
                    {unreadCount > 0 && (
                      <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 && (
                      <div className="notif-empty">No notifications yet</div>
                    )}
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.is_read ? '' : 'notif-unread'}`}
                        onClick={() => !n.is_read && markRead(n.id)}
                        style={{ cursor: n.is_read ? 'default' : 'pointer' }}
                      >
                        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 2 }}>{n.icon}</span>
                        <div className="notif-item-body">
                          <span className="notif-item-title">{n.title}</span>
                          {n.body && <span className="notif-item-desc">{n.body}</span>}
                          <span className="notif-item-time">
                            {n.time === 'now'
                              ? <span className="notif-time-now">● now</span>
                              : n.time}
                          </span>
                        </div>
                        <button className="notif-dismiss"
                          onClick={e => { e.stopPropagation(); dismiss(n.id) }} title="Dismiss">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Account panel */}
            <div className="settings-wrapper">
              <button type="button" className="topbar-avatar" title={user?.email}
                onClick={() => { setAccountOpen(o => !o); setNotifOpen(false) }}>
                {userInitial}
              </button>
              {accountOpen && (
                <div className="account-panel">
                  <div className="account-panel-header">
                    <div className="account-panel-avatar">{userInitial}</div>
                    <div>
                      <div className="account-panel-name">{user?.email ?? 'Cashier'}</div>
                      <div className="account-panel-role" style={{ color: '#38a169' }}>
                        Cashier / POS
                      </div>
                    </div>
                  </div>
                  <div className="account-panel-divider" />
                  <button className="settings-item"
                    onClick={() => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setAccountOpen(false) }}>
                    {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
                  </button>
                  <div className="account-panel-divider" />
                  <button className="settings-item settings-item-danger" onClick={handleLogout}>
                    ⎋ Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* POS content — Cashier is locked to this view only */}
        <div className="main-scroll">
          <CashierDashboard activeSection="POS" />
        </div>
      </div>
    </main>
  )
}
