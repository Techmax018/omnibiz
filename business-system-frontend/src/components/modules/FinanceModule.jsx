import { useEffect, useState } from 'react'
import { getLedger, getBalanceSheet, getTaxReport, getAnalytics, recordPayment } from '../../api/modules'
import { useAuth } from '../../context/AuthContext'
import ExportButton from '../ExportButton'
import { exportFinancePDF } from '../../lib/pdfExport'

function LineChart({ data }) {
  const [tooltip, setTooltip] = useState(null)
  if (!data || data.length < 2) return (
    <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
      Not enough data for chart
    </div>
  )
  const W = 500, H = 120, pad = 10
  const amounts = data.map(d => d.amount)
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (W - pad * 2))
  const min = Math.min(...amounts), max = Math.max(...amounts)
  const range = max - min || 1
  const ys = amounts.map(v => H - pad - ((v - min) / range) * (H - pad * 2))
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
  const area = `${line} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W
    let closest = 0, minD = Infinity
    xs.forEach((x, i) => { const d = Math.abs(x - mx); if (d < minD) { minD = d; closest = i } })
    setTooltip({ x: xs[closest], y: ys[closest], value: amounts[closest], label: data[closest]?.date ?? '' })
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: '100%', height: 130, display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="fg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3182ce" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#3182ce" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={area} fill="url(#fg2)"/>
        <path d={line} fill="none" stroke="#3182ce" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {tooltip && (
          <>
            <line x1={tooltip.x} y1={pad} x2={tooltip.x} y2={H} stroke="#3182ce" strokeWidth="1" strokeDasharray="3,3" opacity="0.5"/>
            <circle cx={tooltip.x} cy={tooltip.y} r="5" fill="#fff" stroke="#3182ce" strokeWidth="2.5"/>
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

export default function FinanceModule() {
  const { activeTenant } = useAuth()
  const [tab, setTab]         = useState('analytics')
  const [ledger, setLedger]   = useState([])
  const [balance, setBalance] = useState(null)
  const [tax, setTax]         = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [error, setError]     = useState('')
  const [payForm, setPayForm] = useState({ invoice_id: '', cash_amount: '0', mobile_money_amount: '0', card_amount: '0', bank_transfer_amount: '0', notes: '' })
  const [saving, setSaving]   = useState(false)
  const [paySuccess, setPaySuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [l, b, t, a] = await Promise.all([getLedger(), getBalanceSheet(), getTaxReport(), getAnalytics()])
        setLedger(l); setBalance(b); setTax(t); setAnalytics(a)
      } catch (e) { setError(e.message) }
    }
    load()
  }, [])

  const handlePayment = async (e) => {
    e.preventDefault()
    setPaySuccess('')
    setError('')
    const total = +payForm.cash_amount + +payForm.mobile_money_amount + +payForm.card_amount + +payForm.bank_transfer_amount
    if (total <= 0) { setError('Enter at least one payment amount greater than zero'); return }
    setSaving(true)
    try {
      const res = await recordPayment({
        invoice_id:              +payForm.invoice_id,
        cash_amount:             +payForm.cash_amount,
        mobile_money_amount:     +payForm.mobile_money_amount,
        card_amount:             +payForm.card_amount,
        bank_transfer_amount:    +payForm.bank_transfer_amount,
        notes:                   payForm.notes,
      })
      setPayForm({ invoice_id: '', cash_amount: '0', mobile_money_amount: '0', card_amount: '0', bank_transfer_amount: '0', notes: '' })
      setPaySuccess(`Payment recorded — Invoice is now ${res.invoice_status}. Outstanding: KES ${res.outstanding_amount.toLocaleString()}`)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mod-header">
        <div>
          <h2 className="mod-title">Financial Engine</h2>
          <p className="mod-subtitle">Ledger, balance sheet, VAT reports, and multi-payment reconciliation</p>
        </div>
        <ExportButton
          label="Export Finance PDF"
          onExport={() => exportFinancePDF(balance, tax, ledger, activeTenant?.name ?? 'OmniBiz')}
        />
      </div>

      <div className="mod-tabs">
        {['analytics','balance','tax','ledger','payments'].map(t => (
          <button key={t} className={`mod-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'analytics' ? 'Analytics' : t === 'balance' ? 'Balance Sheet' : t === 'tax' ? 'Tax Report' : t === 'ledger' ? 'Ledger' : 'Record Payment'}
          </button>
        ))}
      </div>

      {error && (
        <div className="notification notification-error" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, marginLeft: 12 }}>×</button>
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="overview-panels">
            {[
              { label: 'Revenue (30d)', value: `KES ${(analytics.revenue_30d || 0).toLocaleString()}` },
              { label: 'Total Invoices', value: analytics.total_invoices },
              { label: 'Paid Invoices', value: analytics.paid_invoices },
              { label: 'Low Stock SKUs', value: analytics.low_stock_products },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="section-card">
            <div className="card-header">
              <div><div className="card-title">Daily Revenue (last 30 days)</div></div>
              <span className="card-badge">Live</span>
            </div>
            <LineChart data={analytics.daily_revenue} />
          </div>
        </div>
      )}

      {tab === 'balance' && balance && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { title: 'Assets', data: balance.assets },
            { title: 'Revenue', data: balance.revenue },
          ].map(({ title, data }) => (
            <div key={title} className="section-card">
              <p style={{ fontWeight: 700, marginBottom: 14, fontSize: '0.9rem' }}>{title}</p>
              {Object.entries(data).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace(/_/g,' ')}</span>
                  <span style={{ fontWeight: 700 }}>{typeof v === 'number' ? `KES ${v.toLocaleString()}` : v}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="section-card" style={{ gridColumn: '1 / -1' }}>
            <p style={{ fontWeight: 700, marginBottom: 14, fontSize: '0.9rem' }}>Profit & Loss</p>
            {Object.entries(balance.profit_loss).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k.replace(/_/g,' ')}</span>
                <span style={{ fontWeight: 700, color: typeof v === 'number' && v < 0 ? '#c53030' : 'var(--text-strong)' }}>{typeof v === 'number' ? `KES ${v.toLocaleString()}` : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'tax' && tax && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="overview-panels">
            {[
              { label: 'Gross Sales', value: `KES ${tax.total_gross_sales.toLocaleString()}` },
              { label: 'VAT Collected', value: `KES ${tax.total_vat_collected.toLocaleString()}` },
            ].map(s => <div key={s.label} className="stat-card"><div className="stat-label">{s.label}</div><div className="stat-value" style={{ fontSize: '1.4rem' }}>{s.value}</div></div>)}
          </div>
          <div className="section-card">
            <p style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>Breakdown by VAT Category</p>
            <table className="dashboard-table">
              <thead><tr><th>Category</th><th>Gross</th><th>VAT</th><th>Net</th></tr></thead>
              <tbody>
                {tax.breakdown_by_category.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No sales recorded yet</td></tr>}
                {tax.breakdown_by_category.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.category}</td>
                    <td>KES {r.gross.toLocaleString()}</td>
                    <td style={{ color: '#c53030', fontWeight: 700 }}>KES {r.vat.toLocaleString()}</td>
                    <td>KES {r.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="section-card">
          <table className="dashboard-table">
            <thead><tr><th>#</th><th>Timestamp</th><th>Type</th><th>Entity</th><th>Amount</th><th>Notes</th></tr></thead>
            <tbody>
              {ledger.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No ledger entries</td></tr>}
              {ledger.map(e => (
                <tr key={e.id}>
                  <td style={{ color: 'var(--text-muted)' }}>#{e.id}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{e.timestamp.replace('T', ' ').split('.')[0]}</td>
                  <td><span className="pill pill-processing">{e.action_type}</span></td>
                  <td>{e.entity}</td>
                  <td style={{ fontWeight: 700 }}>KES {e.amount.toLocaleString()}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{e.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="section-card">
          <p style={{ fontWeight: 700, marginBottom: 4 }}>Record Split Payment</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 16 }}>Supports cash, mobile money, card, and bank transfer for a single invoice</p>
          {paySuccess && (
            <div className="notification" style={{ marginBottom: 14, background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' }}>
              ✓ {paySuccess}
            </div>
          )}
          <form onSubmit={handlePayment}>
            <div className="form-grid">
              <label className="form-field"><span>Invoice ID</span><input type="number" value={payForm.invoice_id} onChange={e => setPayForm(p => ({...p,invoice_id:e.target.value}))} required /></label>
              <label className="form-field"><span>Cash (KES)</span><input type="number" min="0" value={payForm.cash_amount} onChange={e => setPayForm(p => ({...p,cash_amount:e.target.value}))} /></label>
              <label className="form-field"><span>Mobile Money (KES)</span><input type="number" min="0" value={payForm.mobile_money_amount} onChange={e => setPayForm(p => ({...p,mobile_money_amount:e.target.value}))} /></label>
              <label className="form-field"><span>Card (KES)</span><input type="number" min="0" value={payForm.card_amount} onChange={e => setPayForm(p => ({...p,card_amount:e.target.value}))} /></label>
              <label className="form-field"><span>Bank Transfer (KES)</span><input type="number" min="0" value={payForm.bank_transfer_amount} onChange={e => setPayForm(p => ({...p,bank_transfer_amount:e.target.value}))} /></label>
              <label className="form-field"><span>Notes</span><input value={payForm.notes} onChange={e => setPayForm(p => ({...p,notes:e.target.value}))} /></label>
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={saving}>{saving ? 'Processing…' : 'Record Payment'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
