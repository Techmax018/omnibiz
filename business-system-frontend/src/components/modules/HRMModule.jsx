import { useEffect, useState } from 'react'
import { getEmployees, createEmployee, clockIn, clockOut, getPerformance } from '../../api/modules'
import { getBranches } from '../../api/modules'
import { useAuth } from '../../context/AuthContext'
import ExportButton from '../ExportButton'
import { exportEmployeesPDF } from '../../lib/pdfExport'

export default function HRMModule() {
  const { activeTenant } = useAuth()
  const [employees, setEmployees] = useState([])
  const [branches, setBranches]   = useState([])
  const [perf, setPerf]     = useState(null)
  const [tab, setTab]       = useState('list')
  const [creating, setCreating] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ name: '', role: 'Cashier', phone: '', email: '', commission_rate: '0', branch_id: '' })

  const notify = (msg, type = 'success') => {
    if (type === 'error') { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 4000) }
  }

  const load = async () => {
    try {
      const [emps, brs] = await Promise.all([getEmployees(), getBranches()])
      setEmployees(emps)
      setBranches(brs)
      if (!form.branch_id && brs.length > 0) {
        setForm(prev => ({ ...prev, branch_id: String(brs[0].id) }))
      }
    } catch (e) { notify(e.message, 'error') }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.branch_id) return notify('Please select a branch', 'error')
    setCreating(true)
    try {
      await createEmployee({ ...form, commission_rate: +form.commission_rate, branch_id: +form.branch_id })
      setForm({ name: '', role: 'Cashier', phone: '', email: '', commission_rate: '0', branch_id: branches.length > 0 ? String(branches[0].id) : '' })
      notify('Employee added successfully')
      await load()
      setTab('list')
    } catch (e) { notify(e.message, 'error') }
    finally { setCreating(false) }
  }

  const handleClockIn = async (id, name) => {
    setCreating(true)
    try { await clockIn(id, {}); notify(`${name} clocked in`) ; await load() }
    catch (e) { notify(e.message, 'error') }
    finally { setCreating(false) }
  }

  const handleClockOut = async (id, name) => {
    setCreating(true)
    try {
      const res = await clockOut(id)
      notify(`${name} clocked out — ${res.hours_worked}h worked`)
      await load()
    } catch (e) { notify(e.message, 'error') }
    finally { setCreating(false) }
  }

  const handlePerf = async (id) => {
    setTab('performance')
    try { setPerf(await getPerformance(id)) }
    catch (e) { notify(e.message, 'error') }
  }

  const branchName = (id) => branches.find(b => b.id === id)?.name ?? (id ? `Branch #${id}` : '—')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mod-header">
        <div>
          <h2 className="mod-title">Human Resources & Shifts</h2>
          <p className="mod-subtitle">Staff roles, shift scheduling, and performance tracking</p>
        </div>
        <span className="mod-stat">{employees.length} employees</span>
        <ExportButton
          label="Export PDF"
          onExport={() => exportEmployeesPDF(employees, activeTenant?.name ?? 'OmniBiz')}
          disabled={employees.length === 0}
        />
      </div>

      <div className="mod-tabs">
        {['list','add','performance'].map(t => (
          <button key={t} className={`mod-tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); setError(''); setSuccess('') }}>
            {t === 'list' ? 'Employees' : t === 'add' ? 'Add Employee' : 'Performance'}
          </button>
        ))}
      </div>

      {error && (
        <div className="notification notification-error" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, marginLeft: 12 }}>×</button>
        </div>
      )}
      {success && (
        <div className="notification" style={{ margin: 0, background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' }}>
          ✓ {success}
        </div>
      )}

      {tab === 'list' && (
        <div className="section-card">
          <table className="dashboard-table">
            <thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Commission</th><th>Branch</th><th>Status</th><th>Shifts</th><th>Perf</th></tr></thead>
            <tbody>
              {employees.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                No employees yet — add one using the "Add Employee" tab.
              </td></tr>}
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 600 }}>{emp.name}</td>
                  <td><span className={`pill ${emp.role === 'Admin' ? 'pill-overdue' : emp.role === 'Manager' ? 'pill-processing' : 'pill-paid'}`}>{emp.role}</span></td>
                  <td>{emp.phone || '—'}</td>
                  <td>{emp.commission_rate}%</td>
                  <td style={{ color: 'var(--text-muted)' }}>{branchName(emp.branch_id)}</td>
                  <td><span className={`pill ${emp.is_active ? 'pill-paid' : 'pill-pending'}`}>{emp.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="button button-primary" style={{ fontSize: '0.7rem', padding: '4px 8px' }} disabled={creating} onClick={() => handleClockIn(emp.id, emp.name)}>In</button>
                    <button className="button button-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }} disabled={creating} onClick={() => handleClockOut(emp.id, emp.name)}>Out</button>
                  </td>
                  <td><button className="button button-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }} onClick={() => handlePerf(emp.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'add' && (
        <div className="section-card">
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <label className="form-field"><span>Full name *</span>
                <input value={form.name} onChange={e => setForm(p => ({...p,name:e.target.value}))} required placeholder="e.g. John Kamau" />
              </label>
              <label className="form-field"><span>Role</span>
                <select value={form.role} onChange={e => setForm(p => ({...p,role:e.target.value}))}>
                  {['Cashier','Manager','Admin'].map(r => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label className="form-field"><span>Phone</span>
                <input value={form.phone} onChange={e => setForm(p => ({...p,phone:e.target.value}))} placeholder="+254…" />
              </label>
              <label className="form-field"><span>Email</span>
                <input type="email" value={form.email} onChange={e => setForm(p => ({...p,email:e.target.value}))} />
              </label>
              <label className="form-field"><span>Commission (%)</span>
                <input type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm(p => ({...p,commission_rate:e.target.value}))} />
              </label>
              <label className="form-field"><span>Branch *</span>
                {branches.length > 0 ? (
                  <select value={form.branch_id} onChange={e => setForm(p => ({...p,branch_id:e.target.value}))} required>
                    <option value="">Select branch…</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.county ? ` — ${b.county}` : ''}</option>)}
                  </select>
                ) : (
                  <input type="number" value={form.branch_id} onChange={e => setForm(p => ({...p,branch_id:e.target.value}))} placeholder="Branch ID" required />
                )}
              </label>
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={creating}>
              {creating ? 'Saving…' : 'Add Employee'}
            </button>
          </form>
        </div>
      )}

      {tab === 'performance' && perf && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="overview-panels">
            {[
              { label: 'Total Sales',       value: `KES ${perf.total_sales.toLocaleString()}` },
              { label: 'Commission Earned', value: `KES ${perf.commission_earned.toLocaleString()}` },
              { label: 'Total Shifts',      value: perf.total_shifts },
              { label: 'Hours Worked',      value: `${perf.total_hours}h` },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ fontSize: '1.4rem' }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="section-card">
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{perf.employee.name} — {perf.employee.role}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
              {branchName(perf.employee.branch_id)} · Commission rate: {perf.employee.commission_rate}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
