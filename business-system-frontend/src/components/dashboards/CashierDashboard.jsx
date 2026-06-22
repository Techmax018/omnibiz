import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { get, post } from '../../api/client'
import { useOfflineSync } from '../../hooks/useOfflineSync'

const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Category colour map for pill badges ───────────────────────
const CAT_COLORS = {
  'B-16%':    { bg: '#e53e3e', text: '#fff' },
  'A-Exempt': { bg: '#38a169', text: '#fff' },
  'E-8%':     { bg: '#d69e2e', text: '#fff' },
  'C-Zero':   { bg: '#3182ce', text: '#fff' },
  'D-Non-VAT':{ bg: '#718096', text: '#fff' },
}

// ── Product card — supermarket style ─────────────────────────
function ProductCard({ product, onAdd, cartQty }) {
  const col = CAT_COLORS[product.vat_category] || CAT_COLORS['B-16%']
  const outOfStock = product.quantity_on_hand <= 0
  return (
    <button
      type="button"
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      style={{
        background: '#fff', border: '1.5px solid',
        borderColor: cartQty > 0 ? '#38a169' : '#e8ecf0',
        borderRadius: 14, padding: 0, cursor: outOfStock ? 'not-allowed' : 'pointer',
        textAlign: 'left', transition: 'all 0.15s', overflow: 'hidden',
        boxShadow: cartQty > 0 ? '0 0 0 2px rgba(56,161,105,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
        opacity: outOfStock ? 0.5 : 1,
        display: 'flex', flexDirection: 'column',
      }}
      onMouseOver={e => { if (!outOfStock) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
      onMouseOut={e => { e.currentTarget.style.boxShadow = cartQty > 0 ? '0 0 0 2px rgba(56,161,105,0.2)' : '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      {/* Colour band top */}
      <div style={{ height: 6, background: outOfStock ? '#e2e8f0' : col.bg }} />

      <div style={{ padding: '12px 12px 10px' }}>
        {/* Product name */}
        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a202c', lineHeight: 1.3, marginBottom: 6, minHeight: 36 }}>
          {product.name}
        </div>
        <div style={{ fontSize: '0.65rem', color: '#718096', marginBottom: 8 }}>
          {product.sku}
        </div>

        {/* Price + stock row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#1a202c' }}>
              KES {fmt(product.sales_price)}
            </div>
            <div style={{ fontSize: '0.62rem', color: outOfStock ? '#e53e3e' : product.quantity_on_hand <= (product.reorder_level || 5) ? '#d69e2e' : '#38a169', fontWeight: 700 }}>
              {outOfStock ? 'Out of stock' : `${product.quantity_on_hand} left`}
            </div>
          </div>
          {/* Cart qty badge */}
          {cartQty > 0 && (
            <div style={{ background: '#38a169', color: '#fff', borderRadius: 20, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.82rem' }}>
              {cartQty}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Receipt overlay — thermal-style with payment details ──────
function Receipt({ data, onClose, onNewSale }) {
  const change = data.payMethod === 'Cash' ? data.cashTendered - data.total : 0

  // Payment method icon + colour
  const methodStyle = {
    Cash:   { icon: '💵', color: '#276749', label: 'Cash Payment' },
    'M-Pesa': { icon: '📱', color: '#1a6b3a', label: 'M-Pesa Mobile Money' },
    Card:   { icon: '💳', color: '#2b4acb', label: 'Card Payment' },
    Bank:   { icon: '🏦', color: '#744210', label: 'Bank Transfer' },
  }[data.payMethod] || { icon: '💰', color: '#333', label: data.payMethod }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 370, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', fontFamily: "'Courier New', monospace" }}>
        <div style={{ padding: '22px 22px 0' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ background: '#e53e3e', color: '#fff', borderRadius: 8, padding: '7px 0', fontWeight: 900, fontSize: '1rem', letterSpacing: 3 }}>OmniBiz POS</div>
            <div style={{ fontSize: '0.68rem', color: '#888', marginTop: 6 }}>{new Date().toLocaleString()}</div>
            <div style={{ fontSize: '0.68rem', color: '#888' }}>Receipt #{data.txnId}</div>
            <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#444' }}>Customer: <strong>{data.customer || 'Walk-in Customer'}</strong></div>
          </div>

          <div style={{ borderBottom: '1px dashed #bbb', margin: '10px 0' }} />

          {/* Items */}
          {data.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 7 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{item.name}</div>
                <div style={{ color: '#888', fontSize: '0.68rem' }}>{item.qty} × KES {fmt(item.price)}</div>
              </div>
              <div style={{ fontWeight: 700, minWidth: 80, textAlign: 'right' }}>KES {fmt(item.price * item.qty)}</div>
            </div>
          ))}

          <div style={{ borderBottom: '1px dashed #bbb', margin: '10px 0' }} />

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.05rem', marginBottom: 12 }}>
            <span>TOTAL</span><span>KES {fmt(data.total)}</span>
          </div>

          {/* ── Payment details block ── */}
          <div style={{ background: '#f7f8fc', borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: `1.5px solid ${methodStyle.color}22` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>{methodStyle.icon}</span>
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: methodStyle.color }}>{methodStyle.label}</span>
            </div>

            {data.payMethod === 'Cash' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ color: '#718096' }}>Cash Tendered</span>
                  <span style={{ fontWeight: 700 }}>KES {fmt(data.cashTendered)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px dashed #ddd', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ color: '#276749', fontWeight: 700 }}>Change Given</span>
                  <span style={{ fontWeight: 900, color: '#276749', fontSize: '0.95rem' }}>KES {fmt(change)}</span>
                </div>
              </>
            )}

            {data.payMethod === 'M-Pesa' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ color: '#718096' }}>Mobile Number</span>
                  <span style={{ fontWeight: 700 }}>{data.payDetails?.phone || '—'}</span>
                </div>
                {data.payDetails?.ref && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#718096' }}>Transaction Ref</span>
                    <span style={{ fontWeight: 700 }}>{data.payDetails.ref}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px dashed #ddd', paddingTop: 6, marginTop: 6 }}>
                  <span style={{ color: '#718096' }}>Amount Paid</span>
                  <span style={{ fontWeight: 900, color: '#1a6b3a' }}>KES {fmt(data.total)}</span>
                </div>
              </>
            )}

            {data.payMethod === 'Card' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ color: '#718096' }}>Card Type</span>
                  <span style={{ fontWeight: 700 }}>{data.payDetails?.cardType || 'Card'}</span>
                </div>
                {data.payDetails?.last4 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#718096' }}>Card Number</span>
                    <span style={{ fontWeight: 700 }}>•••• •••• •••• {data.payDetails.last4}</span>
                  </div>
                )}
                {data.payDetails?.ref && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: 4 }}>
                    <span style={{ color: '#718096' }}>Auth Code</span>
                    <span style={{ fontWeight: 700 }}>{data.payDetails.ref}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px dashed #ddd', paddingTop: 6, marginTop: 6 }}>
                  <span style={{ color: '#718096' }}>Amount Charged</span>
                  <span style={{ fontWeight: 900, color: '#2b4acb' }}>KES {fmt(data.total)}</span>
                </div>
              </>
            )}

            {data.payMethod === 'Bank' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span style={{ color: '#718096' }}>Bank Name</span>
                  <span style={{ fontWeight: 700 }}>{data.payDetails?.bankName || '—'}</span>
                </div>
                {data.payDetails?.ref && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: '#718096' }}>Reference</span>
                    <span style={{ fontWeight: 700 }}>{data.payDetails.ref}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderTop: '1px dashed #ddd', paddingTop: 6, marginTop: 6 }}>
                  <span style={{ color: '#718096' }}>Amount Transferred</span>
                  <span style={{ fontWeight: 900, color: '#744210' }}>KES {fmt(data.total)}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.65rem', marginBottom: 16 }}>
            — Thank you for shopping with us —
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '0 22px 22px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f7f8fc', cursor: 'pointer', fontWeight: 700 }}>Close</button>
          <button onClick={onNewSale} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#38a169', color: '#fff', cursor: 'pointer', fontWeight: 900 }}>🛒 New Sale</button>
        </div>
      </div>
    </div>
  )
}

// ── Product Request Panel ─────────────────────────────────────
function ProductRequestPanel({ onSuccess }) {
  const VAT_OPTS = ['B-16%', 'A-Exempt', 'E-8%', 'C-Zero', 'D-Non-VAT']
  const [form, setForm] = useState({ name: '', sku: '', sales_price: '', cost_price: '', vat_category: 'B-16%', quantity_on_hand: '0', reorder_level: '0', description: '' })
  const [mine, setMine] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  useEffect(() => { get('/api/product-requests/mine').then(setMine).catch(() => {}) }, [])
  const submit = async (e) => {
    e.preventDefault(); if (!form.name || !form.sku || !form.sales_price) return setError('Name, SKU and price are required')
    setSaving(true); setError('')
    try {
      await post('/api/product-requests', { ...form, sales_price: +form.sales_price, cost_price: +form.cost_price || 0, quantity_on_hand: +form.quantity_on_hand || 0, reorder_level: +form.reorder_level || 0 })
      setForm({ name: '', sku: '', sales_price: '', cost_price: '', vat_category: 'B-16%', quantity_on_hand: '0', reorder_level: '0', description: '' })
      setSuccess('Request submitted — awaiting approval'); setTimeout(() => setSuccess(''), 4000)
      get('/api/product-requests/mine').then(setMine).catch(() => {})
      if (onSuccess) onSuccess()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  const statusColor = { pending: '#d69e2e', approved: '#38a169', rejected: '#e53e3e' }
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: '#2b6cb0' }}>
        ℹ Products you request will appear in the POS once a Manager or Owner approves them.
      </div>
      {error && <div style={{ padding: '9px 14px', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 8, color: '#c53030', fontSize: '0.78rem' }}>{error}</div>}
      {success && <div style={{ padding: '9px 14px', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, color: '#276749', fontSize: '0.78rem' }}>✓ {success}</div>}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Request New Product</div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field"><span>Product name *</span><input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Mineral Water 500ml" required /></label>
            <label className="form-field"><span>SKU *</span><input value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="e.g. MW500" required /></label>
            <label className="form-field"><span>Selling price (KES) *</span><input type="number" min="0" step="0.01" value={form.sales_price} onChange={e => f('sales_price', e.target.value)} required /></label>
            <label className="form-field"><span>Cost price (KES)</span><input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} /></label>
            <label className="form-field"><span>Opening stock</span><input type="number" min="0" value={form.quantity_on_hand} onChange={e => f('quantity_on_hand', e.target.value)} /></label>
            <label className="form-field"><span>Reorder level</span><input type="number" min="0" value={form.reorder_level} onChange={e => f('reorder_level', e.target.value)} /></label>
            <label className="form-field"><span>VAT Category</span><select value={form.vat_category} onChange={e => f('vat_category', e.target.value)}>{VAT_OPTS.map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="form-field"><span>Description</span><input value={form.description} onChange={e => f('description', e.target.value)} placeholder="Optional" /></label>
          </div>
          <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={saving}>{saving ? 'Submitting…' : '📤 Submit for Approval'}</button>
        </form>
      </div>
      {mine.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>My Requests</div>
          <table className="dashboard-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>{mine.map(r => (<tr key={r.id}><td style={{ fontWeight: 600 }}>{r.name}</td><td style={{ color: 'var(--text-muted)' }}>{r.sku}</td><td>KES {fmt(r.sales_price)}</td><td><span style={{ fontWeight: 700, color: statusColor[r.status] }}>{r.status}</span></td><td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.review_note || '—'}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Shift Panel ───────────────────────────────────────────────
function ShiftPanel() {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  const [form, setForm] = useState({ shift_name: '', clock_in: toISO(new Date(now - 8*3600000)), clock_out: toISO(now), notes: '' })
  const [shifts, setShifts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => { get('/api/shifts').then(setShifts).catch(() => {}) }, [])
  const hours = () => { try { const h = (new Date(form.clock_out) - new Date(form.clock_in)) / 3600000; return h > 0 ? `${h.toFixed(1)}h` : null } catch { return null } }
  const submit = async (e) => {
    e.preventDefault(); if (!form.shift_name.trim()) return setError('Shift name is required')
    const ci = new Date(form.clock_in), co = new Date(form.clock_out)
    if (co <= ci) return setError('Clock-out must be after clock-in')
    setSaving(true); setError('')
    try {
      await post('/api/shifts/submit', { shift_name: form.shift_name, clock_in: ci.toISOString(), clock_out: co.toISOString(), notes: form.notes })
      setSuccess('Shift submitted for manager review'); setTimeout(() => setSuccess(''), 4000)
      setForm(p => ({ ...p, shift_name: '', notes: '' }))
      get('/api/shifts').then(setShifts).catch(() => {})
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  const statusColor = { pending: '#d69e2e', approved: '#38a169', rejected: '#e53e3e' }
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 10, padding: '10px 14px', fontSize: '0.78rem', color: '#276749' }}>
        📋 Fill in your shift details and submit for manager review.
      </div>
      {error && <div style={{ padding: '9px 14px', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 8, color: '#c53030', fontSize: '0.78rem' }}>{error}</div>}
      {success && <div style={{ padding: '9px 14px', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, color: '#276749', fontSize: '0.78rem' }}>✓ {success}</div>}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Submit Shift</div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field"><span>Shift name *</span><input value={form.shift_name} onChange={e => setForm(p => ({...p, shift_name: e.target.value}))} placeholder="e.g. Morning Shift" required /></label>
            <label className="form-field"><span>Clock-in *</span><input type="datetime-local" value={form.clock_in} onChange={e => setForm(p => ({...p, clock_in: e.target.value}))} required /></label>
            <label className="form-field"><span>Clock-out *</span><input type="datetime-local" value={form.clock_out} onChange={e => setForm(p => ({...p, clock_out: e.target.value}))} required /></label>
            <label className="form-field"><span>Notes</span><input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Optional notes for manager" /></label>
          </div>
          {hours() && <div style={{ marginTop: 8, padding: '7px 12px', background: '#f0fff4', borderRadius: 8, fontSize: '0.8rem', color: '#276749', fontWeight: 700 }}>⏱ Duration: {hours()}</div>}
          <button type="submit" className="button button-primary" style={{ marginTop: 14 }} disabled={saving}>{saving ? 'Submitting…' : '📤 Submit to Manager'}</button>
        </form>
      </div>
      {shifts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>My Shift History</div>
          <table className="dashboard-table">
            <thead><tr><th>Shift</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>{shifts.map(s => (<tr key={s.id}><td style={{ fontWeight: 600 }}>{s.shift_name || `#${s.id}`}</td><td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.clock_in?.slice(11,16)}</td><td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.clock_out?.slice(11,16) || '—'}</td><td>{s.hours_worked ? `${s.hours_worked}h` : '—'}</td><td><span style={{ fontWeight: 700, color: statusColor[s.status] }}>{s.status}</span></td><td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.review_note || '—'}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Main export — Supermarket POS
// ══════════════════════════════════════════════════════════════
export default function CashierDashboard() {
  const { user, activeTenant, branchId } = useAuth()
  const { isOnline, pendingCount, queueSale } = useOfflineSync()

  const [tab, setTab]           = useState('pos')
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('All')
  const searchRef               = useRef(null)

  // Cart
  const [cart, setCart]         = useState([])
  const [customer, setCustomer] = useState('')

  // Payment
  const [payOpen, setPayOpen]   = useState(false)
  const [payMethod, setPayMethod] = useState('Cash')
  const [tendered, setTendered] = useState('')
  // Method-specific fields
  const [payDetails, setPayDetails] = useState({ phone: '', ref: '', cardType: 'Visa', last4: '', bankName: '' })
  const [processing, setProc]   = useState(false)

  // Receipt + session
  const [receipt, setReceipt]   = useState(null)
  const [sessCount, setSessCount] = useState(0)
  const [sessTotal, setSessTotal] = useState(0)

  const [toast, setToast]       = useState('')
  const [error, setError]       = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // ── Load products ────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoading(true)
    try { setProducts(await get('/api/inventory/products')) }
    catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (branchId) loadProducts() }, [branchId, loadProducts])

  // ── Keyboard: '/' focuses search ────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Derived lists ─────────────────────────────────────────
  const categories = ['All', ...new Set(products.map(p => p.vat_category))]
  const visible = products.filter(p => {
    const s = search.toLowerCase()
    return (!s || p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s))
      && (category === 'All' || p.vat_category === category)
  })

  // ── Cart ops ─────────────────────────────────────────────
  const addToCart = (p) => {
    const inCart = cart.find(i => i.id === p.id)
    if (inCart && inCart.qty >= p.quantity_on_hand) { showToast(`Only ${p.quantity_on_hand} in stock`); return }
    setCart(prev => inCart
      ? prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      : [...prev, { id: p.id, name: p.name, price: p.sales_price, qty: 1, max: p.quantity_on_hand, sku: p.sku }]
    )
    showToast(`+ ${p.name}`)
  }
  const updateQty = (id, qty) => {
    if (qty <= 0) { setCart(p => p.filter(i => i.id !== id)); return }
    const item = cart.find(i => i.id === id)
    if (item && qty > item.max) { showToast(`Max ${item.max}`); return }
    setCart(p => p.map(i => i.id === id ? { ...i, qty } : i))
  }
  const clearCart = () => { setCart([]); setCustomer(''); setTendered(''); setPayDetails({ phone: '', ref: '', cardType: 'Visa', last4: '', bankName: '' }) }
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const change    = parseFloat(tendered || 0) - cartTotal

  // ── Checkout ─────────────────────────────────────────────
  const checkout = async () => {
    if (!cart.length) { setError('Cart is empty'); return }
    if (payMethod === 'Cash' && (!tendered || parseFloat(tendered) < cartTotal)) { setError('Cash tendered is less than total'); return }
    setProc(true); setError('')
    const payload = { client: customer || 'Walk-in Customer', amount: cartTotal, status: 'Paid', items: cart.map(i => ({ product_id: i.id, description: i.name, quantity: i.qty, unit_price: i.price })) }
    try {
      let txnId
      if (isOnline) { const d = await post('/api/orders', payload); txnId = d.transaction_id }
      else { await queueSale(payload); txnId = `OFFLINE-${Date.now()}` }
      setReceipt({ txnId, customer: customer || 'Walk-in Customer', items: [...cart], total: cartTotal, cashTendered: parseFloat(tendered || cartTotal), payMethod, payDetails: { ...payDetails } })
      setSessCount(c => c + 1); setSessTotal(t => t + cartTotal)
      setPayOpen(false); clearCart()
    } catch (err) { setError(err.message) } finally { setProc(false) }
  }

  // ── POS view ──────────────────────────────────────────────
  const renderPOS = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%', overflow: 'hidden', background: '#f7f8fc' }}>

      {/* LEFT — products */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #e8ecf0', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#a0aec0' }}>🔍</span>
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or SKU…  ( Press / )"
              style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f7f8fc', fontSize: '0.85rem', boxSizing: 'border-box' }} />
          </div>
          {sessCount > 0 && (
            <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#276749', whiteSpace: 'nowrap' }}>
              {sessCount} sales · KES {fmt(sessTotal)}
            </div>
          )}
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isOnline ? '#38a169' : '#e53e3e', whiteSpace: 'nowrap' }}>
            {isOnline ? '🟢 Online' : `🔴 ${pendingCount} queued`}
          </span>
        </div>

        {/* Category pills */}
        <div style={{ background: '#fff', padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid #e8ecf0', flexShrink: 0 }}>
          {categories.map(c => {
            const col = CAT_COLORS[c] || { bg: '#e53e3e', text: '#fff' }
            const active = category === c
            return (
              <button key={c} type="button" onClick={() => setCategory(c)}
                style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid', borderColor: active ? col.bg : '#e2e8f0', background: active ? col.bg : '#fff', color: active ? col.text : '#718096', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                {c === 'All' ? '◉ All Items' : c}
              </button>
            )
          })}
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && <div style={{ textAlign: 'center', paddingTop: 60, color: '#a0aec0' }}>Loading products…</div>}
          {!loading && visible.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📦</div>
              <div style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                {products.length === 0 ? 'No products yet. Use the "Products" tab to request additions.' : 'No products match your search.'}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12 }}>
            {visible.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} cartQty={cart.find(i => i.id === p.id)?.qty || 0} />)}
          </div>
        </div>
      </div>

      {/* RIGHT — order details panel (matches reference image right panel) */}
      <div style={{ background: '#fff', borderLeft: '1px solid #e8ecf0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Panel header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8ecf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1a202c' }}>Order Details</div>
            <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginTop: 2 }}>{activeTenant?.name || 'OmniBiz'}</div>
          </div>
          {cart.length > 0 && <button type="button" onClick={clearCart} style={{ fontSize: '0.7rem', color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Clear</button>}
        </div>

        {/* Customer */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f2f8' }}>
          <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name (optional)"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f7f8fc', fontSize: '0.8rem', boxSizing: 'border-box' }} />
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {cart.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 50 }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🛍</div>
              <div style={{ color: '#a0aec0', fontSize: '0.78rem' }}>Tap a product to add it</div>
            </div>
          )}
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid #f0f2f8' }}>
              {/* Colour dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS['B-16%'].bg, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                <div style={{ fontSize: '0.68rem', color: '#a0aec0' }}>KES {fmt(item.price)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f7f8fc', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #e2e8f0', background: '#f7f8fc', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', minWidth: 62, textAlign: 'right' }}>KES {fmt(item.price * item.qty)}</div>
              <button onClick={() => updateQty(item.id, 0)} style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 2, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Summary + pay */}
        <div style={{ padding: '12px 16px', borderTop: '2px solid #f0f2f8' }}>
          {error && <div style={{ marginBottom: 10, padding: '7px 10px', background: 'rgba(229,62,62,0.07)', borderRadius: 7, color: '#c53030', fontSize: '0.75rem' }}>{error}</div>}
          {cart.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#718096', marginBottom: 4 }}>
                <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                <span>KES {fmt(cartTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', color: '#1a202c', marginBottom: 14 }}>
                <span>Total</span>
                <span>KES {fmt(cartTotal)}</span>
              </div>
            </>
          )}
          <button onClick={() => { setError(''); setPayOpen(true) }} disabled={!cart.length}
            style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: cart.length ? '#38a169' : '#e2e8f0', color: cart.length ? '#fff' : '#a0aec0', fontWeight: 900, fontSize: '0.95rem', cursor: cart.length ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}>
            {cart.length ? `💳 Pay  KES ${fmt(cartTotal)}` : 'No items in cart'}
          </button>
        </div>
      </div>

      {/* Payment modal */}
      {payOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 4 }}>Payment</div>
            <div style={{ color: '#718096', fontSize: '0.8rem', marginBottom: 20 }}>Total: <strong style={{ color: '#1a202c', fontSize: '1rem' }}>KES {fmt(cartTotal)}</strong></div>

            {/* Method tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
              {[['Cash','💵'],['M-Pesa','📱'],['Card','💳'],['Bank','🏦']].map(([m, ic]) => (
                <button key={m} type="button"
                  onClick={() => { setPayMethod(m); setPayDetails({ phone: '', ref: '', cardType: 'Visa', last4: '', bankName: '' }) }}
                  style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: '2px solid', borderColor: payMethod === m ? '#38a169' : '#e2e8f0', background: payMethod === m ? '#f0fff4' : '#f7f8fc', color: payMethod === m ? '#276749' : '#718096', fontWeight: 700, fontSize: '0.68rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '1.2rem' }}>{ic}</span>{m}
                </button>
              ))}
            </div>

            {/* ── Cash ── */}
            {payMethod === 'Cash' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>Cash tendered (KES) *</span>
                  <input type="number" autoFocus min={cartTotal} value={tendered}
                    onChange={e => setTendered(e.target.value)}
                    placeholder={`Enter amount (min KES ${fmt(cartTotal)})`}
                    style={{ fontSize: '1.1rem', fontWeight: 700, padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }} />
                </label>
                {tendered && parseFloat(tendered) >= cartTotal && (
                  <div style={{ padding: '10px 14px', background: '#f0fff4', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#276749', fontSize: '0.9rem' }}>
                    <span>💵 Change</span><span>KES {fmt(parseFloat(tendered) - cartTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── M-Pesa ── */}
            {payMethod === 'M-Pesa' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>Mobile number *</span>
                  <input type="tel" autoFocus value={payDetails.phone}
                    onChange={e => setPayDetails(p => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. 0712 345 678"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontSize: '1rem' }} />
                </label>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>M-Pesa confirmation code (optional)</span>
                  <input value={payDetails.ref}
                    onChange={e => setPayDetails(p => ({ ...p, ref: e.target.value }))}
                    placeholder="e.g. QHT3K9LM2P"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '0.95rem' }} />
                </label>
                <div style={{ padding: '10px 14px', background: '#f0fff4', borderRadius: 8, fontSize: '0.82rem', color: '#276749', fontWeight: 600 }}>
                  📱 Amount to send: <strong>KES {fmt(cartTotal)}</strong>
                </div>
              </div>
            )}

            {/* ── Card ── */}
            {payMethod === 'Card' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>Card type</span>
                  <select value={payDetails.cardType} onChange={e => setPayDetails(p => ({ ...p, cardType: e.target.value }))}
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}>
                    {['Visa', 'Mastercard', 'Amex', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>Last 4 digits (optional)</span>
                  <input autoFocus maxLength={4} value={payDetails.last4}
                    onChange={e => setPayDetails(p => ({ ...p, last4: e.target.value.replace(/\D/g,'') }))}
                    placeholder="e.g. 4242"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '1rem', letterSpacing: 4 }} />
                </label>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>Auth / approval code (optional)</span>
                  <input value={payDetails.ref}
                    onChange={e => setPayDetails(p => ({ ...p, ref: e.target.value }))}
                    placeholder="e.g. 123456"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                </label>
                <div style={{ padding: '10px 14px', background: '#ebf8ff', borderRadius: 8, fontSize: '0.82rem', color: '#2b6cb0', fontWeight: 600 }}>
                  💳 Amount to charge: <strong>KES {fmt(cartTotal)}</strong>
                </div>
              </div>
            )}

            {/* ── Bank Transfer ── */}
            {payMethod === 'Bank' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>Bank name *</span>
                  <input autoFocus value={payDetails.bankName}
                    onChange={e => setPayDetails(p => ({ ...p, bankName: e.target.value }))}
                    placeholder="e.g. Equity Bank, KCB, NCBA"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }} />
                </label>
                <label className="form-field">
                  <span style={{ fontWeight: 600 }}>Transfer reference (optional)</span>
                  <input value={payDetails.ref}
                    onChange={e => setPayDetails(p => ({ ...p, ref: e.target.value }))}
                    placeholder="e.g. TRF20241022001"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                </label>
                <div style={{ padding: '10px 14px', background: '#fffaf0', borderRadius: 8, fontSize: '0.82rem', color: '#744210', fontWeight: 600 }}>
                  🏦 Amount to transfer: <strong>KES {fmt(cartTotal)}</strong>
                </div>
              </div>
            )}

            {error && <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(229,62,62,0.07)', borderRadius: 7, color: '#c53030', fontSize: '0.75rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setPayOpen(false); setError('') }}
                style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f7f8fc', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={checkout}
                disabled={processing
                  || (payMethod === 'Cash' && (!tendered || parseFloat(tendered) < cartTotal))
                  || (payMethod === 'M-Pesa' && !payDetails.phone.trim())
                  || (payMethod === 'Bank' && !payDetails.bankName.trim())
                }
                style={{ flex: 2, padding: '12px', borderRadius: 8, border: 'none', background: processing ? '#ccc' : '#38a169', color: '#fff', fontWeight: 900, cursor: 'pointer', fontSize: '0.95rem', transition: 'background 0.15s' }}>
                {processing ? 'Processing…' : `✓ Confirm ${payMethod} — KES ${fmt(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1a202c', color: '#fff', padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: '0.8rem', zIndex: 3000, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>{toast}</div>}
      {receipt && <Receipt data={receipt} onClose={() => setReceipt(null)} onNewSale={() => { setReceipt(null); setTab('pos'); setTimeout(() => searchRef.current?.focus(), 100) }} />}

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e8ecf0', background: '#fff', flexShrink: 0 }}>
        {[['pos','⊞ POS', cart.length || null],['requests','📤 Products', null],['shifts','🕐 Shifts', null]].map(([id, label, badge]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            style={{ padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', borderBottom: tab === id ? '2px solid #38a169' : '2px solid transparent', color: tab === id ? '#38a169' : '#718096', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s' }}>
            {label}
            {badge && <span style={{ background: '#38a169', color: '#fff', borderRadius: 10, fontSize: '0.65rem', padding: '1px 6px', fontWeight: 900 }}>{badge}</span>}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 16, fontSize: '0.72rem', color: '#a0aec0' }}>
          {user?.email}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'pos'      && renderPOS()}
        {tab === 'requests' && <div style={{ height: '100%', overflowY: 'auto' }}><ProductRequestPanel onSuccess={loadProducts} /></div>}
        {tab === 'shifts'   && <div style={{ height: '100%', overflowY: 'auto' }}><ShiftPanel /></div>}
      </div>
    </div>
  )
}
