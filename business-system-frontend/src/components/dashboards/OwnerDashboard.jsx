import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API_BASE, defaultFetchOptions } from '../../api/config'
import { get, post } from '../../api/client'
import { getAnalytics } from '../../api/modules'
import InventoryModule from '../modules/InventoryModule'
import CRMModule from '../modules/CRMModule'
import HRMModule from '../modules/HRMModule'
import FinanceModule from '../modules/FinanceModule'
import UserManagement from '../modules/UserManagement'
import ExportButton from '../ExportButton'
import {
  exportDashboardPDF, exportBranchPDF,
} from '../../lib/pdfExport'

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, defaultFetchOptions)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

// ── SVG Line chart with hover tooltip ─────────────────────────
function LineChart({ points, labels = [], color = '#e53e3e' }) {
  const [tooltip, setTooltip] = useState(null)
  if (!points || points.length < 2) return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
      No data yet
    </div>
  )
  const W = 500, H = 140, pad = 12
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2))
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const ys = points.map(v => H - pad - ((v - min) / range) * (H - pad * 2))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const area = `${line} L${xs[xs.length-1]},${H} L${xs[0]},${H} Z`

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W
    let closest = 0, minD = Infinity
    xs.forEach((x, i) => { const d = Math.abs(x - mx); if (d < minD) { minD = d; closest = i } })
    setTooltip({ x: xs[closest], y: ys[closest], value: points[closest], label: labels[closest] ?? `Point ${closest + 1}` })
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: '100%', height: 160, display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id={`lg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#lg-${color.replace('#','')})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {tooltip && (
          <>
            <line x1={tooltip.x} y1={pad} x2={tooltip.x} y2={H} stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"/>
            <circle cx={tooltip.x} cy={tooltip.y} r="5" fill="#fff" stroke={color} strokeWidth="2.5"/>
          </>
        )}
      </svg>
      {tooltip && (
        <div className="chart-tooltip" style={{ left: `${(tooltip.x/W)*100}%`, top: `${(tooltip.y/H)*100}%` }}>
          <span className="chart-tooltip-label">{tooltip.label}</span>
          <span className="chart-tooltip-value">KES {tooltip.value.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}

// ── Donut chart with hover ─────────────────────────────────────
function DonutChart({ segments }) {
  const [hovered, setHovered] = useState(null)
  const R = 54, cx = 64, cy = 64, stroke = 14
  const circ = 2 * Math.PI * R
  let offset = 0
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 128 128" style={{ display: 'block', width: '100%', height: '100%' }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeWidth={stroke}/>
        {segments.map((seg, i) => {
          const dash = (seg.pct / 100) * circ
          const gap = circ - dash
          const isH = hovered === i
          const el = (
            <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={seg.color}
              strokeWidth={isH ? stroke + 4 : stroke}
              strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transformOrigin: `${cx}px ${cy}px`, transform: 'rotate(-90deg)', transition: 'stroke-width 0.15s', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}/>
          )
          offset += dash
          return el
        })}
      </svg>
      {hovered !== null && (
        <div className="donut-tooltip">
          <span style={{ color: segments[hovered].color, fontWeight: 700 }}>{segments[hovered].label}</span>
          <span>{segments[hovered].pct}%</span>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, detail, color = 'var(--accent)' }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}

function BranchCard({ branch, onClick, active }) {
  return (
    <button onClick={onClick} className={`account-item ${active ? 'active' : ''}`}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{branch.name}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{branch.county || 'No location'}</div>
      </div>
      <span className="pill pill-paid">Active</span>
    </button>
  )
}

export default function OwnerDashboard({ activeSection, onSectionChange, creating, handleCreate }) {
  const { activeTenant } = useAuth()
  const [overview, setOverview]       = useState(null)
  const [analytics, setAnalytics]     = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [branchData, setBranchData]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [ov, an] = await Promise.all([apiFetch('/api/dashboard'), getAnalytics()])
        setOverview(ov)
        setAnalytics(an)
        if (ov.branches?.length > 0) setSelectedBranch(ov.branches[0])
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    apiFetch(`/api/dashboard/branch/${selectedBranch.id}`).then(setBranchData).catch(() => {})
  }, [selectedBranch])

  if (loading) return <div className="notification notification-loading">Loading owner dashboard…</div>
  if (error)   return <div className="notification notification-error">{error}</div>

  const { stats = [], recent_orders: orders = [], branches = [] } = overview ?? {}
  const tenantName = activeTenant?.name ?? 'OmniBiz'

  // Build chart data from analytics
  const revenuePoints = analytics?.daily_revenue?.map(d => d.amount) ?? []
  const revenueLabels = analytics?.daily_revenue?.map(d => d.date) ?? []

  const donutSegments = analytics ? [
    { label: 'Paid', pct: analytics.total_invoices ? Math.round((analytics.paid_invoices / analytics.total_invoices) * 100) : 0, color: '#38a169' },
    { label: 'Outstanding', pct: analytics.total_invoices ? Math.round((analytics.outstanding_invoices / analytics.total_invoices) * 100) : 0, color: '#e53e3e' },
    { label: 'Low Stock', pct: analytics.total_products ? Math.min(100, Math.round((analytics.low_stock_products / analytics.total_products) * 100)) : 0, color: '#d69e2e' },
  ] : []

  if (activeSection === 'Inventory') return <InventoryModule />
  if (activeSection === 'Customers') return <CRMModule />
  if (activeSection === 'Employees') return <HRMModule />
  if (activeSection === 'Finance')   return <FinanceModule />
  if (activeSection === 'Users')     return <UserManagement />
  if (activeSection === 'Requests')  return <RequestsPanel />
  if (activeSection === 'Sales')     return <SalesForm onAdd={d => handleCreate('/api/orders', d)} creating={creating} />
  if (activeSection === 'Invoices')  return <InvoicesForm onAdd={d => handleCreate('/api/invoices', d)} creating={creating} />
  if (activeSection === 'Reports')   return <ReportsView />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header + export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-strong)' }}>Business Overview</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{tenantName} · All branches</p>
        </div>
        <ExportButton
          label="Export Dashboard PDF"
          onExport={() => exportDashboardPDF(overview, analytics, tenantName)}
        />
      </div>

      {/* Stat cards */}
      <div className="overview-panels">
        {stats.map((s, i) => (
          <StatCard key={i} label={s.title} value={s.value} detail={s.detail}
            color={i === 0 ? '#e53e3e' : i === 1 ? '#38a169' : i === 2 ? '#3182ce' : '#d69e2e'}/>
        ))}
      </div>

      {/* Charts row */}
      {analytics && (
        <div className="dashboard-mid">
          <div className="chart-card">
            <div className="card-header">
              <div>
                <div className="card-title">Revenue Trend</div>
                <div className="card-subtitle">Daily revenue — last 30 days</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#e53e3e', fontWeight: 700 }}>
                  KES {(analytics.revenue_30d || 0).toLocaleString()}
                </span>
                <span className="card-badge">Live</span>
              </div>
            </div>
            <LineChart points={revenuePoints} labels={revenueLabels} color="#e53e3e"/>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: '#e53e3e' }}/> Revenue</span>
            </div>
          </div>

          <div className="revenue-summary">
            <div className="card-title" style={{ marginBottom: 4 }}>Invoice Index</div>
            <div className="donut-wrap">
              <DonutChart segments={donutSegments.filter(s => s.pct > 0)}/>
              <div className="donut-center">
                <span className="donut-value">{analytics.total_invoices}</span>
                <span className="donut-label">Total</span>
              </div>
            </div>
            <div className="donut-legend">
              {donutSegments.map(s => (
                <div key={s.label} className="donut-legend-item">
                  <div className="donut-legend-left">
                    <span className="donut-legend-dot" style={{ background: s.color }}/>
                    {s.label}
                  </div>
                  <span className="donut-legend-val">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics quick metrics */}
      {analytics && (
        <div className="overview-panels">
          {[
            { label: '30-Day Revenue', value: `KES ${(analytics.revenue_30d || 0).toLocaleString()}`, color: '#e53e3e' },
            { label: 'Paid Invoices',  value: analytics.paid_invoices,   color: '#38a169' },
            { label: 'Outstanding',    value: analytics.outstanding_invoices, color: '#d69e2e' },
            { label: 'Low Stock SKUs', value: analytics.low_stock_products,   color: '#c53030' },
          ].map(s => <StatCard key={s.label} label={s.label} value={s.value} detail="" color={s.color}/>)}
        </div>
      )}

      {/* Branch inspector */}
      {branches.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
          <div className="section-card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: '0.78rem', marginBottom: 12, color: 'var(--text-muted)' }}>BRANCHES</div>
            {branches.map(b => (
              <BranchCard key={b.id} branch={b} active={selectedBranch?.id === b.id} onClick={() => setSelectedBranch(b)}/>
            ))}
          </div>
          <div className="section-card">
            {branchData ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700 }}>{selectedBranch?.name} — Branch Metrics</div>
                  <ExportButton
                    label="Export Branch PDF"
                    size="xs"
                    onExport={() => exportBranchPDF(branchData, selectedBranch?.name ?? 'Branch')}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    ['Revenue', `KES ${branchData.total_revenue.toLocaleString()}`],
                    ['Collected', `KES ${branchData.total_paid.toLocaleString()}`],
                    ['Open Invoices', branchData.open_invoices],
                    ['Customers', branchData.customer_count],
                    ['Low Stock', branchData.low_stock_count],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--surface-alt)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Branch mini bar chart */}
                {branchData.recent_invoices.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>Recent Invoice Amounts</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
                      {branchData.recent_invoices.slice(0, 10).map((inv, i) => {
                        const max = Math.max(...branchData.recent_invoices.map(x => x.total_amount))
                        const pct = max > 0 ? (inv.total_amount / max) * 100 : 0
                        return (
                          <div key={i} title={`${inv.invoice_number}: KES ${inv.total_amount.toLocaleString()}`}
                            style={{
                              flex: 1, borderRadius: '3px 3px 0 0',
                              height: `${Math.max(8, pct)}%`,
                              background: inv.status === 'paid' ? '#38a169' : '#e53e3e',
                              opacity: 0.8, transition: 'opacity 0.15s', cursor: 'help',
                            }}
                            onMouseOver={e => e.currentTarget.style.opacity = 1}
                            onMouseOut={e => e.currentTarget.style.opacity = 0.8}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}

                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8 }}>Recent Invoices</div>
                <table className="dashboard-table">
                  <thead><tr><th>Invoice</th><th>Amount</th><th>Outstanding</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {branchData.recent_invoices.slice(0, 6).map((inv, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                        <td>KES {inv.total_amount.toLocaleString()}</td>
                        <td style={{ color: inv.outstanding_amount > 0 ? '#c53030' : 'inherit' }}>KES {inv.outstanding_amount.toLocaleString()}</td>
                        <td><span className={`pill pill-${inv.status === 'paid' ? 'paid' : 'pending'}`}>{inv.status}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{inv.created_at.split('T')[0]}</td>
                      </tr>
                    ))}
                    {branchData.recent_invoices.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No invoices yet</td></tr>
                    )}
                  </tbody>
                </table>
              </>
            ) : <div style={{ color: 'var(--text-muted)', padding: 16 }}>Select a branch to inspect</div>}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="section-card">
        <div className="card-header">
          <div><div className="card-title">Recent Transactions (All Branches)</div></div>
        </div>
        <table className="dashboard-table">
          <thead><tr><th>#</th><th>Entity</th><th>Status</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No transactions yet</td></tr>}
            {orders.map((o, i) => (
              <tr key={o.id ?? i}>
                <td style={{ color: 'var(--text-muted)' }}>#{o.id ?? i + 1}</td>
                <td style={{ fontWeight: 600 }}>{o.client}</td>
                <td><span className={`pill pill-${o.status === 'Completed' ? 'paid' : 'pending'}`}>{o.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{o.date ?? '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{o.amount}</td>
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
function ReportsView() {
  return <div className="section-card"><p style={{ color: 'var(--text-muted)' }}>No reports available yet.</p></div>
}
