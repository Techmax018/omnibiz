import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { get, post } from '../../api/client'
import { useOfflineSync } from '../../hooks/useOfflineSync'

// ── Helpers ────────────────────────────────────────────────────
const fmt = (n) => Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const VAT_LABELS = { 'A-Exempt': 'Exempt', 'B-16%': '16%', 'C-Zero': '0%', 'D-Non-VAT': 'Non-VAT', 'E-8%': '8%' }

// ── Payment method button ──────────────────────────────────────
function PayMethodBtn({ method, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 6px', borderRadius: 8, border: '2px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'rgba(229,62,62,0.08)' : 'var(--surface-alt)',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      {method}
    </button>
  )
}

// ── Receipt overlay ────────────────────────────────────────────
function Receipt({ data, onClose, onNewSale }) {
  const change = data.cashTendered - data.total
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 380,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        fontFamily: "'Courier New', monospace",
      }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: 2 }}>OmniBiz POS</div>
          <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 2 }}>{new Date().toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: '#666' }}>Txn #{data.txnId}</div>
          <div style={{ borderBottom: '1px dashed #999', margin: '10px 0' }} />
        </div>
        <div style={{ fontSize: '0.78rem', marginBottom: 8, color: '#444' }}>
          Customer: {data.customer || 'Walk-in'}
        </div>
        <div style={{ borderBottom: '1px dashed #ccc', marginBottom: 8 }} />
        {data.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
            <span style={{ flex: 1 }}>{item.name}</span>
            <span style={{ color: '#666', marginLeft: 8 }}>{item.qty}×{fmt(item.price)}</span>
            <span style={{ fontWeight: 700, marginLeft: 12, minWidth: 70, textAlign: 'right' }}>KES {fmt(item.price * item.qty)}</span>
          </div>
        ))}
        <div style={{ borderBottom: '1px dashed #ccc', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '0.9rem', marginBottom: 6 }}>
          <span>TOTAL</span><span>KES {fmt(data.total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#444', marginBottom: 4 }}>
          <span>{data.payMethod} Tendered</span><span>KES {fmt(data.cashTendered)}</span>
        </div>
        {data.payMethod === 'Cash' && change >= 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#2d7a2d', fontWeight: 700 }}>
            <span>Change</span><span>KES {fmt(change)}</span>
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: '0.68rem', color: '#999' }}>
          Thank you for shopping with us!
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer', fontWeight: 700 }}>
            Close
          </button>
          <button onClick={onNewSale} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#e53e3e', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
            🛒 New Sale
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Product Request Form ───────────────────────────────────────
function ProductRequestPanel({ branchId, onSuccess }) {
  const [form, setForm] = useState({
    name: '', sku: '', sales_price: '', cost_price: '',
    vat_category: 'B-16%', quantity_on_hand: '0',
    reorder_level: '0', description: '',
  })
  const [myRequests, setMyRequests] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadMine = () => get('/api/product-requests/mine').then(setMyRequests).catch(() => {})
  useEffect(() => { loadMine() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Product name is required')
    if (!form.sku.trim()) return setError('SKU is required')
    if (!form.sales_price || isNaN(+form.sales_price)) return setError('Enter a valid price')
    setSaving(true); setError('')
    try {
      await post('/api/product-requests', {
        ...form,
        sales_price: +form.sales_price,
        cost_price: +form.cost_price || 0,
        quantity_on_hand: +form.quantity_on_hand || 0,
        reorder_level: +form.reorder_level || 0,
      })
      setForm({ name: '', sku: '', sales_price: '', cost_price: '', vat_category: 'B-16%', quantity_on_hand: '0', reorder_level: '0', description: '' })
      setSuccess('Request submitted — awaiting manager approval')
      setTimeout(() => setSuccess(''), 5000)
      loadMine()
      if (onSuccess) onSuccess()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const statusColor = { pending: '#d69e2e', approved: '#38a169', rejected: '#e53e3e' }
  const statusIcon  = { pending: '⏳', approved: '✅', rejected: '❌' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(49,130,206,0.06)', border: '1px solid rgba(49,130,206,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: '0.8rem', color: '#2b6cb0' }}>
        ℹ Products you request here will appear in the POS once a Manager or Owner approves them.
      </div>

      {error && <div className="notification notification-error" style={{ margin: 0 }}>{error}<button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button></div>}
      {success && <div className="notification" style={{ margin: 0, background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' }}>✓ {success}</div>}

      <div className="section-card">
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Request a New Product</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field"><span>Product name *</span><input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Mineral Water 500ml" required /></label>
            <label className="form-field"><span>SKU *</span><input value={form.sku} onChange={e => setForm(p => ({...p, sku: e.target.value}))} placeholder="e.g. WATER-500" required /></label>
            <label className="form-field"><span>Selling price (KES) *</span><input type="number" min="0" step="0.01" value={form.sales_price} onChange={e => setForm(p => ({...p, sales_price: e.target.value}))} required /></label>
            <label className="form-field"><span>Cost price (KES)</span><input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setForm(p => ({...p, cost_price: e.target.value}))} /></label>
            <label className="form-field"><span>Opening stock</span><input type="number" min="0" value={form.quantity_on_hand} onChange={e => setForm(p => ({...p, quantity_on_hand: e.target.value}))} /></label>
            <label className="form-field"><span>Reorder level</span><input type="number" min="0" value={form.reorder_level} onChange={e => setForm(p => ({...p, reorder_level: e.target.value}))} /></label>
            <label className="form-field"><span>VAT Category</span>
              <select value={form.vat_category} onChange={e => setForm(p => ({...p, vat_category: e.target.value}))}>
                {Object.keys(VAT_LABELS).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="form-field"><span>Description</span><input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Optional notes" /></label>
          </div>
          <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={saving}>{saving ? 'Submitting…' : '📤 Submit for Approval'}</button>
        </form>
      </div>

      {myRequests.length > 0 && (
        <div className="section-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>My Requests</h3>
          <table className="dashboard-table">
            <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {myRequests.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.sku}</td>
                  <td>KES {fmt(r.sales_price)}</td>
                  <td><span style={{ fontWeight: 700, color: statusColor[r.status] }}>{statusIcon[r.status]} {r.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.review_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Shift Submission Panel ─────────────────────────────────────
function ShiftPanel() {
  const now = new Date()
  const toLocalISO = (d) => {
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [form, setForm] = useState({
    shift_name: '',
    clock_in: toLocalISO(new Date(now.getTime() - 8 * 3600000)),
    clock_out: toLocalISO(now),
    notes: '',
  })
  const [myShifts, setMyShifts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadShifts = () => get('/api/shifts').then(setMyShifts).catch(() => {})
  useEffect(() => { loadShifts() }, [])

  const calcHours = () => {
    try {
      const ci = new Date(form.clock_in), co = new Date(form.clock_out)
      const h = (co - ci) / 3600000
      return h > 0 ? `${h.toFixed(1)}h` : null
    } catch { return null }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.shift_name.trim()) return setError('Shift name is required')
    const ci = new Date(form.clock_in), co = new Date(form.clock_out)
    if (isNaN(ci) || isNaN(co)) return setError('Invalid date/time')
    if (co <= ci) return setError('Clock-out must be after clock-in')
    setSaving(true); setError('')
    try {
      await post('/api/shifts/submit', {
        shift_name: form.shift_name,
        clock_in: ci.toISOString(),
        clock_out: co.toISOString(),
        notes: form.notes,
      })
      setSuccess('Shift submitted for manager review')
      setTimeout(() => setSuccess(''), 5000)
      setForm(p => ({ ...p, shift_name: '', notes: '' }))
      loadShifts()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const statusColor = { pending: '#d69e2e', approved: '#38a169', rejected: '#e53e3e' }
  const statusIcon  = { pending: '⏳', approved: '✅', rejected: '❌' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'rgba(56,161,105,0.06)', border: '1px solid rgba(56,161,105,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: '0.8rem', color: '#276749' }}>
        📋 Fill in your shift details and submit for your manager to review and approve.
      </div>

      {error && <div className="notification notification-error" style={{ margin: 0 }}>{error}<button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>×</button></div>}
      {success && <div className="notification" style={{ margin: 0, background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' }}>✓ {success}</div>}

      <div className="section-card">
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Submit Shift</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Shift name *</span>
              <input value={form.shift_name} onChange={e => setForm(p => ({...p, shift_name: e.target.value}))} placeholder="e.g. Morning Shift, Evening Shift" required />
            </label>
            <label className="form-field">
              <span>Clock-in time *</span>
              <input type="datetime-local" value={form.clock_in} onChange={e => setForm(p => ({...p, clock_in: e.target.value}))} required />
            </label>
            <label className="form-field">
              <span>Clock-out time *</span>
              <input type="datetime-local" value={form.clock_out} onChange={e => setForm(p => ({...p, clock_out: e.target.value}))} required />
            </label>
            <label className="form-field">
              <span>Notes (optional)</span>
              <input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Any notes for the manager" />
            </label>
          </div>
          {calcHours() && (
            <div style={{ marginTop: 10, padding: '8px 14px', background: '#f0fff4', borderRadius: 8, fontSize: '0.82rem', color: '#276749', fontWeight: 700 }}>
              ⏱ Duration: {calcHours()}
            </div>
          )}
          <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={saving}>
            {saving ? 'Submitting…' : '📤 Submit to Manager'}
          </button>
        </form>
      </div>

      {myShifts.length > 0 && (
        <div className="section-card">
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>My Shift History</h3>
          <table className="dashboard-table">
            <thead><tr><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Status</th><th>Manager Note</th></tr></thead>
            <tbody>
              {myShifts.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.shift_name || `Shift #${s.id}`}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.clock_in.replace('T', ' ').slice(0, 16)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.clock_out ? s.clock_out.replace('T', ' ').slice(0, 16) : '—'}</td>
                  <td>{s.hours_worked ? `${s.hours_worked}h` : '—'}</td>
                  <td><span style={{ fontWeight: 700, color: statusColor[s.status] }}>{statusIcon[s.status]} {s.status}</span></td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.review_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Main CashierDashboard — supermarket-style POS
// ══════════════════════════════════════════════════════════════
export default function CashierDashboard({ activeSection }) {
  const { user, branchId } = useAuth()
  const { isOnline, pendingCount, queueSale } = useOfflineSync()

  // ── Navigation tabs ────────────────────────────────────────
  const [tab, setTab] = useState('pos')   // pos | requests | shifts

  // ── Products ───────────────────────────────────────────────
  const [products, setProducts]     = useState([])
  const [loadingProds, setLoadingProds] = useState(true)
  const [search, setSearch]         = useState('')
  const [categoryFilter, setCategory] = useState('All')
  const searchRef = useRef(null)

  // ── Cart ───────────────────────────────────────────────────
  const [cart, setCart]             = useState([])
  const [customer, setCustomer]     = useState('')

  // ── Payment modal ──────────────────────────────────────────
  const [payOpen, setPayOpen]       = useState(false)
  const [payMethod, setPayMethod]   = useState('Cash')
  const [tendered, setTendered]     = useState('')
  const [processing, setProcessing] = useState(false)

  // ── Receipt ────────────────────────────────────────────────
  const [receipt, setReceipt]       = useState(null)

  // ── Session totals ─────────────────────────────────────────
  const [sessionCount, setSessionCount] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)

  // ── Alerts ────────────────────────────────────────────────
  const [error, setError]           = useState('')
  const [toastMsg, setToastMsg]     = useState('')

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

  // ── Load products ──────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoadingProds(true)
    try { setProducts(await get('/api/inventory/products')) }
    catch { /* silent — products may be empty */ }
    finally { setLoadingProds(false) }
  }, [])

  useEffect(() => { if (branchId) loadProducts() }, [branchId, loadProducts])

  // ── Product filter ─────────────────────────────────────────
  const categories = ['All', ...new Set(products.map(p => p.vat_category || 'General'))]
  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'All' || p.vat_category === categoryFilter
    return matchSearch && matchCat && p.quantity_on_hand > 0
  })

  // ── Cart operations ────────────────────────────────────────
  const addToCart = (product) => {
    const inCart = cart.find(i => i.id === product.id)
    const maxQty = product.quantity_on_hand
    if (inCart && inCart.qty >= maxQty) { toast(`Only ${maxQty} in stock`); return }
    setCart(prev => {
      if (inCart) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: product.id, name: product.name, price: product.sales_price, qty: 1, sku: product.sku, maxQty }]
    })
    toast(`Added ${product.name}`)
  }

  const updateQty = (id, qty) => {
    if (qty <= 0) { removeFromCart(id); return }
    const item = cart.find(i => i.id === id)
    if (item && qty > item.maxQty) { toast(`Only ${item.maxQty} in stock`); return }
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))
  const clearCart = () => { setCart([]); setCustomer(''); setTendered('') }

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const change = parseFloat(tendered || 0) - cartTotal

  // ── Checkout ───────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0) { setError('Cart is empty'); return }
    if (payMethod === 'Cash' && (!tendered || parseFloat(tendered) < cartTotal)) {
      setError('Cash tendered is less than total'); return
    }
    setProcessing(true); setError('')

    const salePayload = {
      client: customer || 'Walk-in Customer',
      amount: cartTotal,
      status: 'Paid',
      items: cart.map(i => ({ product_id: i.id, description: i.name, quantity: i.qty, unit_price: i.price })),
    }

    try {
      let txnId = null
      if (isOnline) {
        const data = await post('/api/orders', salePayload)
        txnId = data.transaction_id
      } else {
        await queueSale(salePayload)
        txnId = `OFFLINE-${Date.now()}`
      }

      const receiptPayload = {
        txnId,
        customer: customer || 'Walk-in Customer',
        items: [...cart],
        total: cartTotal,
        cashTendered: parseFloat(tendered || cartTotal),
        payMethod,
      }

      setReceipt(receiptPayload)
      setSessionCount(c => c + 1)
      setSessionTotal(t => t + cartTotal)
      setPayOpen(false)
      clearCart()
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // ── Keyboard shortcut: '/' focuses search ─────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── POS view ───────────────────────────────────────────────
  const renderPOS = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      {/* ── Left: products ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>

        {/* Search + filter bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>🔍</span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product or SKU… (Press /)"
              style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)', fontSize: '0.85rem', boxSizing: 'border-box' }}
            />
          </div>
          {sessionCount > 0 && (
            <div style={{ padding: '6px 12px', background: 'rgba(56,161,105,0.1)', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, color: '#276749', whiteSpace: 'nowrap' }}>
              {sessionCount} sales · KES {fmt(sessionTotal)}
            </div>
          )}
        </div>

        {/* Category pills */}
        <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          {categories.map(cat => (
            <button key={cat} type="button"
              onClick={() => setCategory(cat)}
              style={{
                padding: '5px 14px', borderRadius: 20, border: '1px solid',
                borderColor: categoryFilter === cat ? 'var(--accent)' : 'var(--border)',
                background: categoryFilter === cat ? 'var(--accent)' : 'var(--surface-alt)',
                color: categoryFilter === cat ? '#fff' : 'var(--text-muted)',
                fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loadingProds && <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>Loading products…</p>}
          {!loadingProds && filteredProducts.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📦</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {products.length === 0 ? 'No products in inventory. Request products using the "Products" tab.' : 'No products match your search.'}
              </p>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {filteredProducts.map(p => (
              <button key={p.id} type="button" onClick={() => addToCart(p)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s', position: 'relative',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(229,62,62,0.15)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Stock badge */}
                <span style={{
                  position: 'absolute', top: 7, right: 7,
                  fontSize: '0.6rem', fontWeight: 700, padding: '2px 5px', borderRadius: 10,
                  background: p.low_stock ? 'rgba(229,62,62,0.1)' : 'rgba(56,161,105,0.1)',
                  color: p.low_stock ? '#c53030' : '#276749',
                }}>{p.quantity_on_hand}</span>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6, lineHeight: 1.3, paddingRight: 24 }}>{p.name}</div>
                <div style={{ color: 'var(--accent)', fontWeight: 900, fontSize: '1rem' }}>KES {fmt(p.sales_price)}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 3 }}>{p.sku} · {VAT_LABELS[p.vat_category] || p.vat_category}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: cart ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>

        {/* Cart header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>🛒 Cart {cartCount > 0 ? `(${cartCount})` : ''}</div>
          {cart.length > 0 && <button type="button" onClick={clearCart} style={{ fontSize: '0.72rem', color: '#c53030', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Clear all</button>}
        </div>

        {/* Customer input */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <input value={customer} onChange={e => setCustomer(e.target.value)}
            placeholder="Customer name (optional)"
            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-alt)', fontSize: '0.82rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {cart.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 40, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🛍</div>
              Tap a product to add it to the cart
            </div>
          )}
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>KES {fmt(item.price)} each</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button type="button" onClick={() => updateQty(item.id, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <input type="number" min="1" max={item.maxQty} value={item.qty}
                  onChange={e => updateQty(item.id, parseInt(e.target.value) || 1)}
                  style={{ width: 36, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 0', fontSize: '0.82rem', fontWeight: 700 }}
                />
                <button type="button" onClick={() => updateQty(item.id, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-alt)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', minWidth: 68, textAlign: 'right' }}>KES {fmt(item.price * item.qty)}</div>
              <button type="button" onClick={() => removeFromCart(item.id)} style={{ color: '#c53030', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: 2 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Total + checkout */}
        <div style={{ padding: '14px 16px', borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
          {error && <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(229,62,62,0.08)', borderRadius: 8, color: '#c53030', fontSize: '0.78rem', fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem', marginBottom: 14 }}>
            <span>Total</span>
            <span style={{ color: 'var(--accent)' }}>KES {fmt(cartTotal)}</span>
          </div>
          <button type="button" onClick={() => { setError(''); setPayOpen(true) }}
            disabled={cart.length === 0}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: cart.length === 0 ? '#ccc' : 'var(--accent)',
              color: '#fff', fontWeight: 900, fontSize: '1rem', cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >💳 Pay — KES {fmt(cartTotal)}</button>
        </div>
      </div>

      {/* ── Payment modal ─── */}
      {payOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 20 }}>Payment — KES {fmt(cartTotal)}</div>

            {/* Payment methods */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <PayMethodBtn method="Cash" icon="💵" active={payMethod === 'Cash'} onClick={() => setPayMethod('Cash')} />
              <PayMethodBtn method="M-Pesa" icon="📱" active={payMethod === 'M-Pesa'} onClick={() => setPayMethod('M-Pesa')} />
              <PayMethodBtn method="Card" icon="💳" active={payMethod === 'Card'} onClick={() => setPayMethod('Card')} />
              <PayMethodBtn method="Bank" icon="🏦" active={payMethod === 'Bank'} onClick={() => setPayMethod('Bank')} />
            </div>

            {payMethod === 'Cash' && (
              <>
                <label className="form-field" style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Cash tendered (KES)</span>
                  <input type="number" min={cartTotal} value={tendered} autoFocus
                    onChange={e => setTendered(e.target.value)}
                    placeholder={fmt(cartTotal)}
                    style={{ fontSize: '1.1rem', fontWeight: 700, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', width: '100%', boxSizing: 'border-box' }}
                  />
                </label>
                {tendered && parseFloat(tendered) >= cartTotal && (
                  <div style={{ padding: '10px 14px', background: '#f0fff4', borderRadius: 8, marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span style={{ color: '#276749' }}>Change</span>
                    <span style={{ color: '#276749', fontSize: '1.1rem' }}>KES {fmt(change)}</span>
                  </div>
                )}
              </>
            )}

            {payMethod !== 'Cash' && (
              <div style={{ padding: '12px 14px', background: 'var(--surface-alt)', borderRadius: 8, marginBottom: 14, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Amount due: <strong>KES {fmt(cartTotal)}</strong> via {payMethod}
              </div>
            )}

            {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(229,62,62,0.08)', borderRadius: 8, color: '#c53030', fontSize: '0.78rem' }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setPayOpen(false); setError('') }}
                style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={handleCheckout} disabled={processing || (payMethod === 'Cash' && (!tendered || parseFloat(tendered) < cartTotal))}
                style={{ flex: 2, padding: '12px', borderRadius: 8, border: 'none', background: processing ? '#ccc' : 'var(--accent)', color: '#fff', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer' }}>
                {processing ? 'Processing…' : `Confirm ${payMethod} Payment`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#2d3748', color: '#fff', padding: '10px 20px', borderRadius: 10,
          fontWeight: 700, fontSize: '0.82rem', zIndex: 2000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toastMsg}
        </div>
      )}

      {/* Receipt overlay */}
      {receipt && (
        <Receipt
          data={receipt}
          onClose={() => setReceipt(null)}
          onNewSale={() => { setReceipt(null); setTab('pos'); searchRef.current?.focus() }}
        />
      )}

      {/* Tab bar — always visible */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', background: 'var(--surface)', flexShrink: 0, zIndex: 10 }}>
        {[
          { id: 'pos',      label: '⊞ POS',             badge: cartCount > 0 ? cartCount : null },
          { id: 'requests', label: '📤 Request Product', badge: null },
          { id: 'shifts',   label: '🕐 Shifts',          badge: null },
        ].map(t => (
          <button key={t.id} type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.82rem',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
              marginBottom: -2, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.label}
            {t.badge && (
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: '0.65rem', fontWeight: 900, padding: '1px 6px' }}>{t.badge}</span>
            )}
          </button>
        ))}

        {/* Online indicator right-aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 16, gap: 8 }}>
          {!isOnline && pendingCount > 0 && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d69e2e' }}>⚠ {pendingCount} offline</span>
          )}
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isOnline ? '#38a169' : '#e53e3e' }}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
      </div>

      {/* Content */}
      {tab === 'pos' && renderPOS()}
      {tab === 'requests' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <ProductRequestPanel branchId={branchId} onSuccess={loadProducts} />
        </div>
      )}
      {tab === 'shifts' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <ShiftPanel />
        </div>
      )}
    </div>
  )
}
