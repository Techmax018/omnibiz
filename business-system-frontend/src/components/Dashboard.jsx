import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationsContext.jsx'
import { useOfflineSync } from '../hooks/useOfflineSync.jsx'
import { API_BASE, defaultFetchOptions } from '../api/config.js'
import { logoutApi } from '../api/modules.js'
import { navForRole, ROLE_LABELS } from '../config/navConfig.js'
import OwnerDashboard   from './dashboards/OwnerDashboard.jsx'
import ManagerDashboard from './dashboards/ManagerDashboard.jsx'
import NotificationsLog from './modules/NotificationsLog.jsx'

// ── Status helpers ─────────────────────────────────────────────
const statusClass = (s) => {
  if (s === 'Paid' || s === 'Completed') return 'pill pill-paid'
  if (s === 'Pending') return 'pill pill-pending'
  if (s === 'Overdue') return 'pill pill-overdue'
  if (s === 'Invoiced') return 'pill pill-invoiced'
  return 'pill pill-processing'
}

// ── Main Shell ─────────────────────────────────────────────────
function Dashboard() {
  const { user, activeTenant, role, branchId, logout } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead, dismiss, fetchNotifications } = useNotifications()
  const { isOnline, pendingCount } = useOfflineSync()

  const [activeSection, setActiveSection] = useState('Dashboard')
  const [creating, setCreating]           = useState(false)
  const [error, setError]                 = useState('')
  const [theme, setTheme]                 = useState('light')
  const [settingsOpen, setSettingsOpen]   = useState(false)
  const [notifOpen, setNotifOpen]         = useState(false)
  const [accountOpen, setAccountOpen]     = useState(false)

  const navItems = useMemo(() => navForRole(role ?? 'Manager'), [role])
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS['Manager']

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark')
  }, [theme])

  const handleCreate = async (endpoint, payload) => {
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST', ...defaultFetchOptions, body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      fetchNotifications()
    } catch (err) { setError(err.message) }
    finally { setCreating(false) }
  }

  const handleLogout = async () => {
    try { await logoutApi() } catch {}
    if (typeof logout === 'function') logout()
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? 'A'

  // ── Render correct role dashboard ──────────────────────────
  const renderContent = () => {
    if (activeSection === 'Notifications') return <NotificationsLog />
    if (role === 'Owner') return (
      <OwnerDashboard
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        creating={creating}
        handleCreate={handleCreate}
      />
    )
    // Manager
    return (
      <ManagerDashboard
        activeSection={activeSection}
        creating={creating}
        handleCreate={handleCreate}
      />
    )
  }

  return (
    <main className="dashboard-page">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/omnibizlogo.png" alt="OmniBiz" className="brand-logo" />
          <div>
            <div className="brand-name">OmniBiz</div>
            <div className="brand-subtitle">Business intelligence</div>
          </div>
        </div>

        {/* Role badge */}
        <div style={{ padding: '10px 18px 4px' }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: roleInfo.bg, color: roleInfo.color,
          }}>
            {roleInfo.label}
            {branchId ? ` · Branch #${branchId}` : ''}
          </span>
        </div>

        <div className="sidebar-section-label">Menu</div>
        <ul className="sidebar-nav-list">
          {navItems.map(({ label, icon }) => (
            <li key={label}>
              <button
                type="button"
                className={`sidebar-link ${activeSection === label ? 'active' : ''}`}
                onClick={() => setActiveSection(label)}
              >
                <span className="nav-icon">{icon}</span>
                {label}
                {label === 'Notifications' && unreadCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    minWidth: 18, height: 18,
                    borderRadius: 9,
                    background: '#e53e3e',
                    color: '#fff',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center',
                    padding: '0 5px',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Company label in sidebar footer */}
        {role === 'Owner' && (
          <div className="sidebar-footer">
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0 4px' }}>
              {activeTenant?.name ?? ''}
            </span>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">{activeSection}</span>
          </div>

          <div className="topbar-right">
            <span className={`status-chip ${isOnline ? 'status-online' : 'status-offline'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {pendingCount > 0 && <span className="status-chip status-pending">{pendingCount} queued</span>}

            {/* Settings */}
            <div className="settings-wrapper">
              <button type="button" className="topbar-icon-btn"
                onClick={() => { setSettingsOpen(o => !o); setNotifOpen(false); setAccountOpen(false) }}>
                ⚙
              </button>
              {settingsOpen && (
                <div className="settings-menu">
                  <button className="settings-item" onClick={() => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setSettingsOpen(false) }}>
                    {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
                  </button>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="settings-wrapper">
              <button type="button" className="topbar-icon-btn notif-btn"
                onClick={() => { setNotifOpen(o => !o); setSettingsOpen(false); setAccountOpen(false) }}>
                🔔
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-panel">
                  <div className="notif-header">
                    <span className="notif-title">Notifications</span>
                    {unreadCount > 0 && <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 && <div className="notif-empty">No notifications yet</div>}
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
                  <button
                    className="notif-view-all"
                    onClick={() => { setActiveSection('Notifications'); setNotifOpen(false) }}
                  >
                    View full activity log →
                  </button>
                </div>
              )}
            </div>

            {/* Account panel */}
            <div className="settings-wrapper">
              <button type="button" className="topbar-avatar" title={user?.email}
                onClick={() => { setAccountOpen(o => !o); setNotifOpen(false); setSettingsOpen(false) }}>
                {userInitial}
              </button>
              {accountOpen && (
                <div className="account-panel">
                  <div className="account-panel-header">
                    <div className="account-panel-avatar">{userInitial}</div>
                    <div>
                      <div className="account-panel-name">{user?.email ?? 'User'}</div>
                      <div className="account-panel-role" style={{ color: roleInfo.color }}>{roleInfo.label}</div>
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

        {/* Content */}
        <div className="main-scroll">
          {error && (
            <div className="notification notification-error" style={{ margin: 0 }}>
              {error}
              <button style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                onClick={() => setError('')}>×</button>
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </main>
  )
}

export default Dashboard
