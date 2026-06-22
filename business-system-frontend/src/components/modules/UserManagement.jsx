import { useEffect, useState } from 'react'
import { API_BASE, defaultFetchOptions } from '../../api/config'

const STAFF_ROLES = ['Manager', 'Cashier']

const rolePill = (role) => {
  if (role === 'Owner')   return 'pill pill-overdue'
  if (role === 'Manager') return 'pill pill-processing'
  return 'pill pill-paid'
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...defaultFetchOptions, ...options })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function UserManagement() {
  const [users, setUsers]     = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab]         = useState('list')
  const [saving, setSaving]   = useState(false)

  // New staff form
  const [newUser, setNewUser] = useState({
    email: '', password: '', confirm: '', role: 'Cashier', assigned_name: '', branch_id: '',
  })
  const [showPwd, setShowPwd] = useState(false)

  // Change password form
  const [pwdForm, setPwdForm] = useState({ user_id: '', new_password: '', confirm: '' })
  const [showNewPwd, setShowNewPwd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [usersData, branchesData] = await Promise.all([
        api('/auth/users'),
        api('/api/branches').catch(() => []),  // graceful — branches may not exist yet
      ])
      setUsers(usersData)
      setBranches(branchesData)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const notify = (msg, isErr = false) => {
    if (isErr) setError(msg)
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3500) }
  }

  // ── Add staff ──────────────────────────────────────────────
  const handleAddUser = async (e) => {
    e.preventDefault()
    setError('')
    if (newUser.password !== newUser.confirm) return notify('Passwords do not match', true)
    if (newUser.password.length < 6) return notify('Password must be at least 6 characters', true)
    if (!newUser.branch_id) return notify('Please select a branch', true)
    setSaving(true)
    try {
      await api('/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          assigned_name: newUser.assigned_name,
          branch_id: parseInt(newUser.branch_id),
        }),
      })
      setNewUser({ email: '', password: '', confirm: '', role: 'Cashier', assigned_name: '', branch_id: '' })
      notify('Staff member created successfully')
      await load()
      setTab('list')
    } catch (e) { notify(e.message, true) }
    finally { setSaving(false) }
  }

  // ── Change password ────────────────────────────────────────
  const handleChangePwd = async (e) => {
    e.preventDefault()
    setError('')
    if (pwdForm.new_password !== pwdForm.confirm) return notify('Passwords do not match', true)
    if (pwdForm.new_password.length < 6) return notify('Password must be at least 6 characters', true)
    setSaving(true)
    try {
      await api('/auth/users/change-password', {
        method: 'POST',
        body: JSON.stringify({ user_id: +pwdForm.user_id, new_password: pwdForm.new_password }),
      })
      setPwdForm({ user_id: '', new_password: '', confirm: '' })
      notify('Password updated successfully')
    } catch (e) { notify(e.message, true) }
    finally { setSaving(false) }
  }

  // ── Remove staff ───────────────────────────────────────────
  const handleRemove = async (userId, email) => {
    if (!window.confirm(`Remove ${email} from your team? This cannot be undone.`)) return
    try {
      await api(`/auth/users/${userId}`, { method: 'DELETE' })
      notify(`${email} removed`)
      await load()
    } catch (e) { notify(e.message, true) }
  }

  // ── Toggle active ──────────────────────────────────────────
  const handleToggle = async (userId) => {
    try {
      const res = await api(`/auth/users/${userId}/toggle-active`, { method: 'PATCH' })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: res.is_active } : u))
    } catch (e) { notify(e.message, true) }
  }

  const branchName = (id) => branches.find(b => b.id === id)?.name ?? (id ? `Branch #${id}` : '—')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mod-header">
        <div>
          <h2 className="mod-title">Staff Management</h2>
          <p className="mod-subtitle">Add Managers and Cashiers to your branches</p>
        </div>
        <span className="mod-stat">{users.length} staff member{users.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="mod-tabs">
        {['list', 'add', 'password'].map(t => (
          <button key={t} className={`mod-tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); setError('') }}>
            {t === 'list' ? '👥 All Staff' : t === 'add' ? '➕ Add Staff' : '🔑 Change Password'}
          </button>
        ))}
      </div>

      {error   && <div className="notification notification-error" style={{ margin: 0 }}>{error}</div>}
      {success && <div className="notification" style={{ margin: 0, background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' }}>{success}</div>}

      {/* ── Staff list ── */}
      {tab === 'list' && (
        <div className="section-card">
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading staff…</p>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>#</th><th>Email</th><th>Name</th><th>Role</th>
                  <th>Branch</th><th>Status</th><th>Joined</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                    No staff yet. Use "Add Staff" to get started.
                  </td></tr>
                )}
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text-muted)' }}>#{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                    <td>{u.assigned_name || '—'}</td>
                    <td><span className={rolePill(u.role)}>{u.role}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{branchName(u.branch_id)}</td>
                    <td>
                      <span className={`pill ${u.is_active ? 'pill-paid' : 'pill-pending'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {u.created_at.split('T')[0]}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="button button-secondary"
                          style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                          onClick={() => { setPwdForm(p => ({ ...p, user_id: String(u.id) })); setTab('password') }}
                        >
                          🔑 Pwd
                        </button>
                        {/* Owners can't be deactivated from this panel */}
                        {u.role !== 'Owner' && (
                          <button
                            className={`button ${u.is_active ? 'button-secondary' : 'button-primary'}`}
                            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                            onClick={() => handleToggle(u.id)}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        {u.role !== 'Owner' && (
                          <button
                            className="button"
                            style={{ fontSize: '0.7rem', padding: '4px 10px', background: 'rgba(229,62,62,0.1)', color: '#c53030' }}
                            onClick={() => handleRemove(u.id, u.email)}
                          >
                            🗑 Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Add staff form ── */}
      {tab === 'add' && (
        <div className="section-card">
          <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-grid">
              <label className="form-field">
                <span>Email address <span style={{ color: 'var(--accent)' }}>*</span></span>
                <input
                  type="email" autoFocus
                  value={newUser.email}
                  onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                  placeholder="staff@company.com"
                  required
                />
              </label>

              <label className="form-field">
                <span>Display name</span>
                <input
                  value={newUser.assigned_name}
                  onChange={e => setNewUser(p => ({ ...p, assigned_name: e.target.value }))}
                  placeholder="e.g. Jane Doe"
                />
              </label>

              <label className="form-field">
                <span>Role <span style={{ color: 'var(--accent)' }}>*</span></span>
                <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  {STAFF_ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </label>

              <label className="form-field">
                <span>Branch <span style={{ color: 'var(--accent)' }}>*</span></span>
                {branches.length > 0 ? (
                  <select
                    value={newUser.branch_id}
                    onChange={e => setNewUser(p => ({ ...p, branch_id: e.target.value }))}
                    required
                  >
                    <option value="">Select branch…</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}{b.county ? ` — ${b.county}` : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    value={newUser.branch_id ?? ''}
                    onChange={e => setNewUser(p => ({ ...p, branch_id: e.target.value }))}
                    placeholder="Branch ID (no branches loaded)"
                    required
                  />
                )}
              </label>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Password <span style={{ color: 'var(--accent)' }}>*</span></span>
                <div className="pwd-wrap">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
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
                    value={newUser.confirm}
                    onChange={e => setNewUser(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </label>
            </div>

            {newUser.password && <PasswordStrength password={newUser.password} />}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Creating…' : '➕ Add Staff Member'}
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Manager: no billing access · Cashier: sales only
              </span>
            </div>
          </form>
        </div>
      )}

      {/* ── Change password form ── */}
      {tab === 'password' && (
        <div className="section-card">
          <form onSubmit={handleChangePwd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-grid">
              <label className="form-field">
                <span>Select Staff Member <span style={{ color: 'var(--accent)' }}>*</span></span>
                <select
                  value={pwdForm.user_id}
                  onChange={e => setPwdForm(p => ({ ...p, user_id: e.target.value }))}
                  required
                >
                  <option value="">Choose staff…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>New password <span style={{ color: 'var(--accent)' }}>*</span></span>
                <div className="pwd-wrap">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={pwdForm.new_password}
                    onChange={e => setPwdForm(p => ({ ...p, new_password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    required
                  />
                  <button type="button" className="pwd-toggle" onClick={() => setShowNewPwd(v => !v)}>
                    {showNewPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </label>

              <label className="form-field">
                <span>Confirm new password <span style={{ color: 'var(--accent)' }}>*</span></span>
                <div className="pwd-wrap">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={pwdForm.confirm}
                    onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Repeat new password"
                    required
                  />
                </div>
              </label>
            </div>

            {pwdForm.new_password && <PasswordStrength password={pwdForm.new_password} />}

            <div>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Updating…' : '🔑 Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
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
