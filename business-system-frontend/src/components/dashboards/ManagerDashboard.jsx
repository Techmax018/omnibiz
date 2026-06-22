import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API_BASE, defaultFetchOptions } from '../../api/config'
import InventoryModule from '../modules/InventoryModule'
import CRMModule from '../modules/CRMModule'
import HRMModule from '../modules/HRMModule'
import ExportButton from '../ExportButton'
import { exportBranchPDF } from '../../lib/pdfExport'

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, defaultFetchOptions)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

// ── Mini bar chart ─────────────────────────────────────────────
function BarChart({ invoices, color = '#3182ce' }) {
  if (!invoices || invoices.length === 0) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
      No invoice data yet
    </div>
  )
  const max = Math.max(...invoices.map(i => i.total_amount), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 80, padding: '0 4px' }}>
      {invoices.slice(0, 12).map((inv, i) => {
        const pct = (inv.total_amount / max) * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              title={`${inv.invoice_number}: KES ${inv.total_amount.toLocaleString()}`}
              style={{
                width: '100%', borderRadius: '3px 3px 0 0',
                height: `${Math.max(6, pct)}%`,
                background: inv.status === 'paid' ? '#38a169' : color,
                opacity: 0.85, cursor: 'help', transition: 'opacity 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = 1}
              onMouseOut={e => e.currentTarget.style.opacity = 0.85}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Progress ring ──────────────────────────────────────────────
function ProgressRing({ value, max, color, label, sublabel }) {
  const R = 36, size = 88, stroke = 8
  const circ = 2 * Math.PI * R
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const dash = pct * circ
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
          <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${size/2}px ${size/2}px`, transition: 'stroke-dasharray 0.5s' }}/>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '1rem', color, lineHeight: 1 }}>{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-strong)', marginTop: 6 }}>{label}</div>
      {sublabel && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>}
    </div>
  )
}

export default function ManagerDashboard({ activeSection, handleCreate, creating }) {
  const { branchId, user, activeTenant } = useAuth()
  const [branchData, setBranchData] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!branchId) { setLoading(false); return }
    apiFetch(`/api/dashboard/branch/${branchId}`)
      .then(data => { setBranchData(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [branchId])

  if (activeSection === 'Inventory') return <InventoryModule />
  if (activeSection === 'Customers') return <CRMModule />
  if (activeSection === 'Employees') return <HRMModule />
  if (activeSection === 'Sales')     return <SalesForm onAdd={d => handleCreate('/api/orders', d)} creating={creating}/>
  if (activeSection === 'Invoices')  return <InvoicesForm onAdd={d => handleCreate('/api/invoices', d)} creating={creating}/>
  if (activeSection === 'Reports')   return <div className="section-card"><p style={{ color: 'var(--text-muted)' }}>Branch reports coming soon.</p></div>

  if (loading) return <div className="notification notification-loading">Loading branch data…</div>
  if (error || !branchData) return (
    <div className="notification notification-error">
      {error || 'No branch assigned. Ask the Owner to assign you to a branch.'}
    </div>
  )

  const collected   = branchData.total_paid
  const revenue     = branchData.total_revenue
  const outstanding = revenue - collected
  const paidRate    = revenue > 0 ? Math.round((collected / revenue) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'rgba(49,130,206,0.1)', border: '1px solid rgba(49,130,206,0.2)', borderRadius: 10, padding: '8px 16px', fontSize: '0.78rem', color: '#2b6cb0', fontWeight: 700 }}>
            📍 Branch #{branchId} — Manager View
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</span>
        </div>
        <ExportButton
          label="Export Branch PDF"
          onExport={() => exportBranchPDF(branchData, `Branch ${branchId}`)}
        />
      </div>

      {/* Stat row */}
      <div className="overview-panels">
        {[
          { label: 'Branch Revenue',  value: `KES ${revenue.toLocaleString()}`,    color: '#3182ce' },
          { label: 'Collected',       value: `KES ${collected.toLocaleString()}`,   color: '#38a169' },
          { label: 'Open Invoices',   value: branchData.open_invoices,              color: '#d69e2e' },
          { label: 'Customers',       value: branchData.customer_count,             color: '#805ad5' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="dashboard-mid">
        {/* Bar chart */}
        <div className="chart-card">
          <div className="card-header">
            <div>
              <div className="card-title">Invoice Activity</div>
              <div className="card-subtitle">
                Recent invoices — green = paid, blue = pending
              </div>
            </div>
            <span className="card-badge">Branch #{branchId}</span>
          </div>
          <BarChart invoices={branchData.recent_invoices}/>
          <div className="chart-legend" style={{ marginTop: 10 }}>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#38a169' }}/> Paid</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#3182ce' }}/> Pending</span>
          </div>
        </div>

        {/* Progress rings */}
        <div className="revenue-summary">
          <div className="card-title" style={{ marginBottom: 14 }}>Branch Health</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
            <ProgressRing value={collected} max={revenue} color="#38a169"
              label="Collection Rate" sublabel={`${paidRate}% paid`}/>
            <ProgressRing value={branchData.open_invoices} max={Math.max(branchData.open_invoices + branchData.customer_count, 1)}
              color="#d69e2e" label="Open Invoices" sublabel={`${branchData.open_invoices} pending`}/>
            <ProgressRing value={branchData.low_stock_count} max={Math.max(branchData.low_stock_count + 5, 1)}
              color={branchData.low_stock_count > 0 ? '#e53e3e' : '#38a169'}
              label="Low Stock" sublabel={`${branchData.low_stock_count} items`}/>
          </div>
          <div className="donut-legend" style={{ marginTop: 16 }}>
            {[
              ['Outstanding', `KES ${outstanding.toLocaleString()}`, '#d69e2e'],
              ['Total Customers', branchData.customer_count, '#3182ce'],
              ['Low Stock Items', branchData.low_stock_count, branchData.low_stock_count > 0 ? '#c53030' : '#38a169'],
            ].map(([k, v, color]) => (
              <div key={k} className="donut-legend-item">
                <div className="donut-legend-left">
                  <span className="donut-legend-dot" style={{ background: color }}/>
                  {k}
                </div>
                <span className="donut-legend-val" style={{ color }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="section-card">
        <div className="card-header">
          <div>
            <div className="card-title">Branch Transactions</div>
            <div className="card-subtitle">Recent invoices for Branch #{branchId}</div>
          </div>
        </div>
        <table className="dashboard-table">
          <thead><tr><th>Invoice</th><th>Amount</th><th>Outstanding</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {branchData.recent_invoices.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No transactions yet</td></tr>
            )}
            {branchData.recent_invoices.map((inv, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, fontSize: '0.78rem' }}>{inv.invoice_number}</td>
                <td>KES {inv.total_amount.toLocaleString()}</td>
                <td style={{ color: inv.outstanding_amount > 0 ? '#c53030' : 'inherit' }}>KES {inv.outstanding_amount.toLocaleString()}</td>
                <td><span className={`pill pill-${inv.status === 'paid' ? 'paid' : 'pending'}`}>{inv.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{inv.created_at.split('T')[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SalesForm({ onAdd, creating }) {
  const [form, setForm] = useState({ client: '', status: 'Pending', amount: '' })
  const submit = async (e) => { e.preventDefault(); await onAdd({ ...form, amount: parseFloat(form.amount) }); setForm({ client: '', status: 'Pending', amount: '' }) }
  return (
    <div className="section-card"><h2 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>Log a Sale</h2>
      <form onSubmit={submit}><div className="form-grid">
        <label className="form-field"><span>Client</span><input value={form.client} onChange={e => setForm(p => ({...p,client:e.target.value}))} required/></label>
        <label className="form-field"><span>Status</span><select value={form.status} onChange={e => setForm(p => ({...p,status:e.target.value}))}>{['Pending','Processing','Paid'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="form-field"><span>Amount (KES)</span><input type="number" min="0" value={form.amount} onChange={e => setForm(p => ({...p,amount:e.target.value}))} required/></label>
      </div><button type="submit" className="button button-primary" style={{ marginTop: 14 }} disabled={creating}>{creating ? 'Saving…' : 'Add Sale'}</button></form>
    </div>
  )
}
function InvoicesForm({ onAdd, creating }) {
  const [form, setForm] = useState({ client: '', status: 'Pending', amount: '' })
  const submit = async (e) => { e.preventDefault(); await onAdd({ ...form, amount: parseFloat(form.amount) }); setForm({ client: '', status: 'Pending', amount: '' }) }
  return (
    <div className="section-card"><h2 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>Create Invoice</h2>
      <form onSubmit={submit}><div className="form-grid">
        <label className="form-field"><span>Client</span><input value={form.client} onChange={e => setForm(p => ({...p,client:e.target.value}))} required/></label>
        <label className="form-field"><span>Status</span><select value={form.status} onChange={e => setForm(p => ({...p,status:e.target.value}))}>{['Pending','Paid','Overdue'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="form-field"><span>Amount (KES)</span><input type="number" min="0" value={form.amount} onChange={e => setForm(p => ({...p,amount:e.target.value}))} required/></label>
      </div><button type="submit" className="button button-primary" style={{ marginTop: 14 }} disabled={creating}>{creating ? 'Saving…' : 'Add Invoice'}</button></form>
    </div>
  )
}
