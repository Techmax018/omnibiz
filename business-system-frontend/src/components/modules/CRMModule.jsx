import { useEffect, useState } from 'react'
import { getCustomers, createCustomer, getCustomerHistory, adjustStoreCredit } from '../../api/modules'
import { useAuth } from '../../context/AuthContext'
import ExportButton from '../ExportButton'
import { exportCustomersPDF } from '../../lib/pdfExport'

export default function CRMModule() {
  const { activeTenant } = useAuth()
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState(null)
  const [tab, setTab] = useState('list')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', credit_limit: '0', branch_id: '1' })
  const [creditForm, setCreditForm] = useState({ amount: '', entry_type: 'credit', notes: '' })

  const load = async () => {
    try { setCustomers(await getCustomers()) } catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await createCustomer({ ...form, credit_limit: +form.credit_limit, branch_id: +form.branch_id })
      setForm({ name: '', phone: '', email: '', credit_limit: '0', branch_id: '1' })
      setSuccess('Customer added successfully')
      setTimeout(() => setSuccess(''), 4000)
      await load()
      setTab('list')
    } catch (e) { setError(e.message) }
    finally { setCreating(false) }
  }

  const handleViewHistory = async (c) => {
    setSelected(c)
    setTab('history')
    try { setHistory(await getCustomerHistory(c.id)) } catch (e) { setError(e.message) }
  }

  const handleCreditAdjust = async (e) => {
    e.preventDefault()
    if (!selected) return
    setCreating(true)
    try {
      await adjustStoreCredit({ customer_id: selected.id, amount: +creditForm.amount, entry_type: creditForm.entry_type, notes: creditForm.notes })
      setCreditForm({ amount: '', entry_type: 'credit', notes: '' })
      await load()
      setHistory(await getCustomerHistory(selected.id))
    } catch (e) { setError(e.message) }
    finally { setCreating(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mod-header">
        <div>
          <h2 className="mod-title">Customer Relationship Management</h2>
          <p className="mod-subtitle">Profiles, purchase history, store credit and loyalty tracking</p>
        </div>
        <span className="mod-stat">{customers.length} customers</span>
        <ExportButton
          label="Export PDF"
          onExport={() => exportCustomersPDF(customers, activeTenant?.name ?? 'OmniBiz')}
          disabled={customers.length === 0}
        />
      </div>

      <div className="mod-tabs">
        {['list','add','history'].map(t => (
          <button key={t} className={`mod-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'list' ? 'All Customers' : t === 'add' ? 'Add Customer' : `History${selected ? ': ' + selected.name : ''}`}
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
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Balance</th><th>Credit Limit</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {customers.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No customers yet</td></tr>}
              {customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td style={{ color: c.balance > 0 ? '#c53030' : 'var(--text-strong)', fontWeight: 700 }}>KES {c.balance.toLocaleString()}</td>
                  <td>KES {c.credit_limit.toLocaleString()}</td>
                  <td><span className={`pill ${c.active === 'active' ? 'pill-paid' : 'pill-pending'}`}>{c.active}</span></td>
                  <td><button className="button button-secondary" style={{ fontSize: '0.72rem', padding: '4px 10px' }} onClick={() => handleViewHistory(c)}>History</button></td>
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
              {[['name','Full name / Company'],['phone','Phone'],['email','Email'],['credit_limit','Credit limit (KES)'],['branch_id','Branch ID']].map(([k,label]) => (
                <label key={k} className="form-field"><span>{label}</span>
                  <input type={['credit_limit','branch_id'].includes(k) ? 'number' : k === 'email' ? 'email' : 'text'}
                    value={form[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} required={k === 'name'} />
                </label>
              ))}
            </div>
            <button type="submit" className="button button-primary" style={{ marginTop: 16 }} disabled={creating}>{creating ? 'Saving…' : 'Add Customer'}</button>
          </form>
        </div>
      )}

      {tab === 'history' && selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-card">
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
              {[['Name', selected.name],['Balance', `KES ${selected.balance.toLocaleString()}`],['Credit Limit', `KES ${selected.credit_limit.toLocaleString()}`],['Status', selected.active]].map(([k,v]) => (
                <div key={k} className="stat-card" style={{ flex: 1, minWidth: 120 }}>
                  <div className="stat-label">{k}</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>{v}</div>
                </div>
              ))}
            </div>
            <form onSubmit={handleCreditAdjust}>
              <p style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.85rem' }}>Adjust Store Credit</p>
              <div className="form-grid">
                <label className="form-field"><span>Amount (KES)</span>
                  <input type="number" min="0" value={creditForm.amount} onChange={e => setCreditForm(p => ({...p,amount:e.target.value}))} required />
                </label>
                <label className="form-field"><span>Type</span>
                  <select value={creditForm.entry_type} onChange={e => setCreditForm(p => ({...p,entry_type:e.target.value}))}>
                    <option value="credit">Credit (reduce balance)</option>
                    <option value="debit">Debit (increase balance)</option>
                  </select>
                </label>
                <label className="form-field"><span>Notes</span>
                  <input value={creditForm.notes} onChange={e => setCreditForm(p => ({...p,notes:e.target.value}))} />
                </label>
              </div>
              <button type="submit" className="button button-primary" style={{ marginTop: 12 }} disabled={creating}>{creating ? 'Saving…' : 'Apply Adjustment'}</button>
            </form>
          </div>
          {history && (
            <div className="section-card">
              <p style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>Invoice History</p>
              <table className="dashboard-table">
                <thead><tr><th>Invoice</th><th>Total</th><th>Outstanding</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {history.invoices.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>No invoices</td></tr>}
                  {history.invoices.map((inv, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                      <td>KES {inv.total_amount.toLocaleString()}</td>
                      <td style={{ color: inv.outstanding_amount > 0 ? '#c53030' : 'inherit' }}>KES {inv.outstanding_amount.toLocaleString()}</td>
                      <td><span className={`pill pill-${inv.status === 'paid' ? 'paid' : 'pending'}`}>{inv.status}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{inv.created_at.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
