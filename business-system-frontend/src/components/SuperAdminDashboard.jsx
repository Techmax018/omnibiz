import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE, defaultFetchOptions } from '../api/config'
import { logoutApi } from '../api/modules'

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...defaultFetchOptions, ...options })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Password strength meter ────────────────────────────────────
function PasswordStrength({ password }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#e53e3e', '#d69e2e', '#3182ce', '#38a169']
  return (
    <div className="pwd-strength">
      <div className="pwd-strength-bars">
        {[0,1,2,3].map(i => (
          <div key={i} className="pwd-strength-bar"
            style={{ background: i < score ? colors[score - 1] : 'var(--border)' }} />
        ))}
      </div>
      <span className="pwd-strength-label" style={{ color: colors[score - 1] || 'var(--text-muted)' }}>
        {score === 0 ? 'Enter password' : labels[score - 1]}
      </span>
    </div>
  )
}

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const [section, setSection]     = useState('Businesses')
  const [owners, setOwners]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [theme, setTheme]         = useState('light')
  const [accountOpen, setAccountOpen] = useState(false)

  // New owner form state
  const [form, setForm] = useState({
    owner_email: '',
    owner_password: '',
    confirm: '',
    owner_name: '',
    company_name: '',
    company_description: '',
  })
  const [showPwd, setShowPwd] = useState(false)

  const loadOwners = async () => {
    setLoading(true)
    try { setOwners(await api('/api/admin/owners')) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadOwners() }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', theme === 'dark')
  }, [theme])

  const notify = (msg, isErr = false) => {
    if (isErr) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 4000) }
  }

  const handleAddOwner = async (e) => {
    e.preventDefault()
    if (form.owner_password !== form.confirm) return notify('Passwords do not match', true)
    if (form.owner_password.length < 6) return notify('Password must be at least 6 characters', true)
    setSaving(true)
    try {
      await api('/api/admin/owners', {
        method: 'POST',
        body: JSON.stringify({
          owner_email: form.owner_email,
          owner_password: form.owner_password,
          owner_name: form.owner_name,
          company_name: form.company_name,
          company_description: form.company_description,
        }),
      })
      setForm({ owner_email: '', owner_password: '', confirm: '', owner_name: '', company_name: '', company_description: '' })
      notify('Business Owner provisioned successfully')
      await loadOwners()
      setSection('Businesses')
    } catch (e) { notify(e.message, true) }
    finally { setSaving(false) }
  }

  const handleToggleActive = async (ownerId) => {
    try {
      const res = await api(`/api/admin/owners/${ownerId}/toggle-active`, { method: 'PATCH' })
      setOwners(prev => prev.map(o => o.id === ownerId ? { ...o, is_active: res.is_active } : o))
    } catch (e) { notify(e.message, true) }
  }

  const handleDelete = async (ownerId, email) => {
    if (!window.confirm(`Permanently delete ${email} and their entire company? This cannot be undone.`)) return
    try {
      await api(`/api/admin/owners/${ownerId}`, { method: 'DELETE' })
      notify(`${email} and their company have been removed`)
      await loadOwners()
    } catch (e) { notify(e.message, true) }
  }

  const handleLogout = async () => {
    try { await logoutApi() } catch {}
    logout()
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? 'A'

  return (
    <main className="dashboard-page">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/omnibizlogo.png" alt="OmniBiz" className="brand-logo" />
          <div>
            <div className="brand-name">OmniBiz</div>
            <div className="brand-subtitle">Platform Admin</div>
          </div>
        </div>

        <div style={{ padding: '10px 18px 4px' }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: 'rgba(107,70,193,0.1)', color: '#6b46c1',
          }}>
            Super Admin
          </span>
        </div>

        <div className="sidebar-section-label">Platform</div>
        <ul className="sidebar-nav-list">
          {[
            { label: 'Businesses', icon: '🏢' },
            { label: 'Add Owner',  icon: '➕' },
          ].map(({ label, icon }) => (
            <li key={label}>
              <button
                type="button"
                className={`sidebar-link ${section === label ? 'active' : ''}`}
                onClick={() => { setSection(label); setError('') }}
              >
                <span className="nav-icon">{icon}</span>
                {label}
                {label === 'Businesses' && owners.length > 0 && (
                  <span style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9,
                    background: '#6b46c1', color: '#fff', fontSize: '0.62rem',
                    fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px',
                  }}>
                    {owners.length}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">{section}</span>
          </div>
          <div className="topbar-right">
            {/* Settings */}
            <div className="settings-wrapper">
              <button type="button" className="topbar-icon-btn"
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? '☀' : '🌙'}
              </button>
            </div>
            {/* Avatar */}
            <div className="settings-wrapper">
              <button type="button" className="topbar-avatar" title={user?.email}
                onClick={() => setAccountOpen(o => !o)}>
                {userInitial}
              </button>
              {accountOpen && (
                <div className="account-panel">
                  <div className="account-panel-header">
                    <div className="account-panel-avatar">{userInitial}</div>
                    <div>
                      <div className="account-panel-name">{user?.email ?? 'Admin'}</div>
                      <div className="account-panel-role" style={{ color: '#6b46c1' }}>Super Admin</div>
                    </div>
                  </div>
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
          {error   && (
            <div className="notification notification-error" style={{ margin: '0 0 16px' }}>
              {error}
              <button style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                onClick={() => setError('')}>×</button>
            </div>
          )}
          {success && (
            <div className="notification" style={{ margin: '0 0 16px', background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' }}>
              {success}
            </div>
          )}

          {/* ── Businesses list ── */}
          {section === 'Businesses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="mod-header">
                <div>
                  <h2 className="mod-title">Registered Businesses</h2>
                  <p className="mod-subtitle">All Business Owner accounts and their companies</p>
                </div>
                <span className="mod-stat">{owners.length} owner{owners.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="section-card">
                {loading ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</p>
                ) : (
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Owner</th>
                        <th>Email</th>
                        <th>Company</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owners.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                            No businesses registered yet. Use "Add Owner" to provision the first one.
                          </td>
                        </tr>
                      )}
                      {owners.map(o => (
                        <tr key={o.id}>
                          <td style={{ color: 'var(--text-muted)' }}>#{o.id}</td>
                          <td style={{ fontWeight: 600 }}>{o.assigned_name || '—'}</td>
                          <td>{o.email}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{o.company_name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                              #{o.company_id}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{o.company_description || '—'}</td>
                          <td>
                            <span className={`pill ${o.is_active ? 'pill-paid' : 'pill-pending'}`}>
                              {o.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {o.created_at.split('T')[0]}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className={`button ${o.is_active ? 'button-secondary' : 'button-primary'}`}
                                style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                                onClick={() => handleToggleActive(o.id)}
                              >
                                {o.is_active ? 'Suspend' : 'Reinstate'}
                              </button>
                              <button
                                className="button"
                                style={{ fontSize: '0.7rem', padding: '4px 10px', background: 'rgba(229,62,62,0.1)', color: '#c53030' }}
                                onClick={() => handleDelete(o.id, o.email)}
                              >
                                🗑 Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Add Owner form ── */}
          {section === 'Add Owner' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="mod-header">
                <div>
                  <h2 className="mod-title">Register Business Owner</h2>
                  <p className="mod-subtitle">
                    Creates the owner account and company in a single transaction.
                    The owner can then add branches and staff from their dashboard.
                  </p>
                </div>
              </div>

              <div className="section-card">
                <form onSubmit={handleAddOwner} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Owner details */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Owner Details
                    </div>
                    <div className="form-grid">
                      <label className="form-field">
                        <span>Full name <span style={{ color: 'var(--accent)' }}>*</span></span>
                        <input
                          value={form.owner_name}
                          onChange={e => setForm(p => ({ ...p, owner_name: e.target.value }))}
                          placeholder="e.g. Jane Mwangi"
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>Email address <span style={{ color: 'var(--accent)' }}>*</span></span>
                        <input
                          type="email"
                          value={form.owner_email}
                          onChange={e => setForm(p => ({ ...p, owner_email: e.target.value }))}
                          placeholder="owner@company.com"
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>Password <span style={{ color: 'var(--accent)' }}>*</span></span>
                        <div className="pwd-wrap">
                          <input
                            type={showPwd ? 'text' : 'password'}
                            value={form.owner_password}
                            onChange={e => setForm(p => ({ ...p, owner_password: e.target.value }))}
                            placeholder="Min. 6 characters"
                            required
                          />
                          <button type="button" className="pwd-toggle" onClick={() => setShowPwd(v => !v)}>
                            {showPwd ? '🙈' : '👁'}
                          </button>
                        </div>
                      </label>
                      <label className="form-field">
                        <span>Confirm password <span style={{ color: 'var(--accent)' }}>*</span></span>
                        <div className="pwd-wrap">
                          <input
                            type={showPwd ? 'text' : 'password'}
                            value={form.confirm}
                            onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                            placeholder="Repeat password"
                            required
                          />
                        </div>
                      </label>
                    </div>
                    {form.owner_password && <PasswordStrength password={form.owner_password} />}
                  </div>

                  {/* Company details */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Company / Tenant
                    </div>
                    <div className="form-grid">
                      <label className="form-field">
                        <span>Company name <span style={{ color: 'var(--accent)' }}>*</span></span>
                        <input
                          value={form.company_name}
                          onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
                          placeholder="e.g. Sunrise Retail Ltd"
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>Description / Industry</span>
                        <input
                          value={form.company_description}
                          onChange={e => setForm(p => ({ ...p, company_description: e.target.value }))}
                          placeholder="e.g. Retail — KES"
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button type="submit" className="button button-primary" disabled={saving}>
                      {saving ? 'Provisioning…' : '🏢 Create Business Owner'}
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Owner will log in at the same URL with the credentials above.
                    </span>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
