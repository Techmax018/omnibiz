import { useEffect, useState } from 'react'
import { getProducts, createProduct, getLowStock, transferStock, getBranches } from '../../api/modules'
import { useAuth } from '../../context/AuthContext'
import ExportButton from '../ExportButton'
import { exportInventoryPDF } from '../../lib/pdfExport'

function Alert({ type = 'error', message, onDismiss }) {
  if (!message) return null
  const styles = type === 'error'
    ? { background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)', color: '#c53030' }
    : { background: '#f0fff4', border: '1px solid #9ae6b4', color: '#276749' }
  return (
    <div className="notification" style={{ margin: 0, ...styles, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, marginLeft: 12 }}>×</button>
    </div>
  )
}

export default function InventoryModule() {
  const { activeTenant } = useAuth()
  const [products, setProducts] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [branches, setBranches] = useState([])
  const [tab, setTab]           = useState('products')
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const [form, setForm] = useState({
    name: '', sku: '', sales_price: '', cost_price: '',
    vat_category: 'B-16%', branch_id: '',
    reorder_level: '0', quantity_on_hand: '0',
  })
  const [transfer, setTransfer] = useState({
    product_id: '', from_branch_id: '', to_branch_id: '', quantity: '',
  })

  const notify = (msg, type = 'success') => {
    if (type === 'error') { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError(''); setTimeout(() => setSuccess(''), 4000) }
  }

  const load = async () => {
    try {
      const [p, ls, br] = await Promise.all([getProducts(), getLowStock(), getBranches()])
      setProducts(p)
      setLowStock(ls)
      setBranches(br)
      // Pre-select first branch if none chosen
      if (!form.branch_id && br.length > 0) {
        setForm(prev => ({ ...prev, branch_id: String(br[0].id) }))
      }
    } catch (e) { notify(e.message, 'error') }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.branch_id) return notify('Please select a branch', 'error')
    setCreating(true)
    try {
      await createProduct({
        ...form,
        sales_price:      +form.sales_price,
        cost_price:       +form.cost_price,
        branch_id:        +form.branch_id,
        reorder_level:    +form.reorder_level,
        quantity_on_hand: +form.quantity_on_hand,
      })
      setForm({
        name: '', sku: '', sales_price: '', cost_price: '',
        vat_category: 'B-16%',
        branch_id: branches.length > 0 ? String(branches[0].id) : '',
        reorder_level: '0', quantity_on_hand: '0',
      })
      notify(`Product added successfully`)
      await load()
      setTab('products')
    } catch (e) { notify(e.message, 'error') }
    finally { setCreating(false) }
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!transfer.product_id)     return notify('Select a product', 'error')
    if (!transfer.from_branch_id) return notify('Select source branch', 'error')
    if (!transfer.to_branch_id)   return notify('Select destination branch', 'error')
    if (!transfer.quantity || +transfer.quantity <= 0) return notify('Enter a valid quantity', 'error')
    setCreating(true)
    try {
      const res = await transferStock({
        product_id:     +transfer.product_id,
        from_branch_id: +transfer.from_branch_id,
        to_branch_id:   +transfer.to_branch_id,
        quantity:       +transfer.quantity,
      })
      setTransfer({ product_id: '', from_branch_id: '', to_branch_id: '', quantity: '' })
      notify(`Transferred ${res.transferred} units successfully`)
      await load()
    } catch (e) { notify(e.message, 'error') }
    finally { setCreating(false) }
  }

  const branchOptions = branches.map(b => (
    <option key={b.id} value={b.id}>{b.name}{b.county ? ` — ${b.county}` : ''}</option>
  ))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mod-header">
        <div>
          <h2 className="mod-title">Inventory & Stock</h2>
          <p className="mod-subtitle">Multi-branch stock tracking, low-stock alerts, and transfers</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {lowStock.length > 0 && (
            <span className="pill pill-overdue">⚠ {lowStock.length} low-stock</span>
          )}
          <ExportButton
            label="Export PDF"
            onExport={() => exportInventoryPDF(products, lowStock, activeTenant?.name ?? 'OmniBiz')}
          />
        </div>
      </div>

      <div className="mod-tabs">
        {['products', 'add', 'transfer', 'alerts'].map(t => (
          <button key={t}
            className={`mod-tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); setError(''); setSuccess('') }}>
            {t === 'products' ? 'All Products'
              : t === 'add' ? 'Add Product'
              : t === 'transfer' ? 'Stock Transfer'
              : `Low-Stock Alerts${lowStock.length > 0 ? ` (${lowStock.length})` : ''}`}
          </button>
        ))}
      </div>

      <Alert type="error"   message={error}   onDismiss={() => setError('')} />
      <Alert type="success" message={success} onDismiss={() => setSuccess('')} />

      {/* ── Product list ── */}
      {tab === 'products' && (
        <div className="section-card">
          <table className="dashboard-table">
            <thead>
              <tr><th>Name</th><th>SKU</th><th>Price</th><th>Cost</th><th>VAT</th><th>Stock</th><th>Reorder</th><th>Status</th></tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                  No products yet — add your first product using the "Add Product" tab.
                </td></tr>
              )}
              {products.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.sku}</td>
                  <td>KES {p.sales_price.toLocaleString()}</td>
                  <td>KES {p.cost_price.toLocaleString()}</td>
                  <td>{p.vat_category}</td>
                  <td style={{ fontWeight: 700 }}>{p.quantity_on_hand}</td>
                  <td>{p.reorder_level}</td>
                  <td>
                    <span className={`pill ${p.low_stock ? 'pill-overdue' : 'pill-paid'}`}>
                      {p.low_stock ? '⚠ Low' : '✓ OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add product ── */}
      {tab === 'add' && (
        <div className="section-card">
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <label className="form-field">
                <span>Product name *</span>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required placeholder="e.g. Coca-Cola 500ml" />
              </label>
              <label className="form-field">
                <span>SKU *</span>
                <input value={form.sku} onChange={e => setForm(p => ({...p, sku: e.target.value}))} required placeholder="e.g. COKE-500" />
              </label>
              <label className="form-field">
                <span>Selling price (KES) *</span>
                <input type="number" min="0" step="0.01" value={form.sales_price} onChange={e => setForm(p => ({...p, sales_price: e.target.value}))} required />
              </label>
              <label className="form-field">
                <span>Cost price (KES)</span>
                <input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setForm(p => ({...p, cost_price: e.target.value}))} />
              </label>
              <label className="form-field">
                <span>Opening stock</span>
                <input type="number" min="0" value={form.quantity_on_hand} onChange={e => setForm(p => ({...p, quantity_on_hand: e.target.value}))} />
              </label>
              <label className="form-field">
                <span>Reorder level</span>
                <input type="number" min="0" value={form.reorder_level} onChange={e => setForm(p => ({...p, reorder_level: e.target.value}))} />
              </label>
              <label className="form-field">
                <span>Branch *</span>
                {branches.length > 0 ? (
                  <select value={form.branch_id} onChange={e => setForm(p => ({...p, branch_id: e.target.value}))} required>
                    <option value="">Select branch…</option>
                    {branchOptions}
                  </select>
                ) : (
                  <input type="number" value={form.branch_id} onChange={e => setForm(p => ({...p, branch_id: e.target.value}))} placeholder="Branch ID" required />
                )}
              </label>
              <label className="form-field">
                <span>VAT Category</span>
                <select value={form.vat_category} onChange={e => setForm(p => ({...p, vat_category: e.target.value}))}>
                  {['A-Exempt', 'B-16%', 'C-Zero', 'D-Non-VAT', 'E-8%'].map(v => <option key={v}>{v}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={creating}>
              {creating ? 'Saving…' : 'Add Product'}
            </button>
          </form>
        </div>
      )}

      {/* ── Stock transfer ── */}
      {tab === 'transfer' && (
        <div className="section-card">
          <form onSubmit={handleTransfer}>
            <div className="form-grid">
              <label className="form-field">
                <span>Product *</span>
                {products.length > 0 ? (
                  <select value={transfer.product_id} onChange={e => setTransfer(p => ({...p, product_id: e.target.value}))} required>
                    <option value="">Select product…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) — stock: {p.quantity_on_hand}</option>
                    ))}
                  </select>
                ) : (
                  <input type="number" value={transfer.product_id} onChange={e => setTransfer(p => ({...p, product_id: e.target.value}))} placeholder="Product ID" required />
                )}
              </label>
              <label className="form-field">
                <span>From branch *</span>
                <select value={transfer.from_branch_id} onChange={e => setTransfer(p => ({...p, from_branch_id: e.target.value}))} required>
                  <option value="">Select source…</option>
                  {branchOptions}
                </select>
              </label>
              <label className="form-field">
                <span>To branch *</span>
                <select value={transfer.to_branch_id} onChange={e => setTransfer(p => ({...p, to_branch_id: e.target.value}))} required>
                  <option value="">Select destination…</option>
                  {branchOptions}
                </select>
              </label>
              <label className="form-field">
                <span>Quantity *</span>
                <input type="number" min="1" value={transfer.quantity} onChange={e => setTransfer(p => ({...p, quantity: e.target.value}))} required />
              </label>
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={creating}>
              {creating ? 'Transferring…' : 'Transfer Stock'}
            </button>
          </form>
        </div>
      )}

      {/* ── Low-stock alerts ── */}
      {tab === 'alerts' && (
        <div className="section-card">
          {lowStock.length === 0 ? (
            <p style={{ color: '#38a169', fontSize: '0.85rem' }}>✓ All stock levels are healthy</p>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr><th>Product</th><th>Branch</th><th>On Hand</th><th>Reorder At</th><th>Shortfall</th></tr>
              </thead>
              <tbody>
                {lowStock.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{a.product_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{branches.find(b => b.id === a.branch_id)?.name ?? `Branch #${a.branch_id}`}</td>
                    <td style={{ color: '#c53030', fontWeight: 700 }}>{a.quantity_on_hand}</td>
                    <td>{a.reorder_level}</td>
                    <td style={{ color: '#c53030' }}>{Math.max(0, a.reorder_level - a.quantity_on_hand)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
