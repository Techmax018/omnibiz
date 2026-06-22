import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE, defaultFetchOptions } from '../api/config'

// ── Step definitions ───────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Company',  icon: '🏢' },
  { id: 2, label: 'Branch',   icon: '📍' },
  { id: 3, label: 'Tax',      icon: '🧾' },
  { id: 4, label: 'Review',   icon: '✅' },
]

const CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS', 'RWF', 'ETB', 'NGN', 'ZAR']
const INDUSTRIES = ['Retail', 'Wholesale', 'Manufacturing', 'Food & Beverage', 'Healthcare', 'Technology', 'Agriculture', 'Construction', 'Transport & Logistics', 'Education', 'Other']

const INIT = {
  company_name: '', currency: 'KES', industry: '',
  branch_name: '', branch_location: '',
  tax_name: 'VAT', tax_rate: '16',
}

// ── Field validation per step ──────────────────────────────────
function validateStep(step, form) {
  switch (step) {
    case 1: return form.company_name.trim() && form.industry
    case 2: return form.branch_name.trim() && form.branch_location.trim()
    case 3: return form.tax_name.trim() && form.tax_rate !== '' && +form.tax_rate >= 0
    default: return true
  }
}

// ── Stepper bar ────────────────────────────────────────────────
function Stepper({ active }) {
  return (
    <div className="wizard-stepper">
      {STEPS.map((step, idx) => {
        const done = active > step.id
        const current = active === step.id
        return (
          <div key={step.id} className="wizard-step-wrap">
            <div className={`wizard-step-node ${done ? 'done' : current ? 'active' : ''}`}>
              {done ? '✓' : step.icon}
            </div>
            <span className={`wizard-step-label ${current ? 'active' : done ? 'done' : ''}`}>
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`wizard-step-line ${done ? 'done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Individual steps ───────────────────────────────────────────
function StepCompany({ form, onChange }) {
  return (
    <div className="wizard-fields">
      <label className="form-field">
        <span>Company Name <span className="wizard-required">*</span></span>
        <input
          autoFocus
          value={form.company_name}
          onChange={e => onChange('company_name', e.target.value)}
          placeholder="e.g. Savanna Traders Ltd"
        />
      </label>
      <label className="form-field">
        <span>Currency <span className="wizard-required">*</span></span>
        <select value={form.currency} onChange={e => onChange('currency', e.target.value)}>
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="form-field">
        <span>Industry <span className="wizard-required">*</span></span>
        <select value={form.industry} onChange={e => onChange('industry', e.target.value)}>
          <option value="">Select industry…</option>
          {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
        </select>
      </label>
    </div>
  )
}

function StepBranch({ form, onChange }) {
  return (
    <div className="wizard-fields">
      <label className="form-field">
        <span>Branch Name <span className="wizard-required">*</span></span>
        <input
          autoFocus
          value={form.branch_name}
          onChange={e => onChange('branch_name', e.target.value)}
          placeholder="e.g. Nairobi HQ"
        />
      </label>
      <label className="form-field">
        <span>Location / County <span className="wizard-required">*</span></span>
        <input
          value={form.branch_location}
          onChange={e => onChange('branch_location', e.target.value)}
          placeholder="e.g. Westlands, Nairobi"
        />
      </label>
    </div>
  )
}

function StepTax({ form, onChange }) {
  return (
    <div className="wizard-fields">
      <label className="form-field">
        <span>Tax Name <span className="wizard-required">*</span></span>
        <input
          autoFocus
          value={form.tax_name}
          onChange={e => onChange('tax_name', e.target.value)}
          placeholder="e.g. VAT"
        />
      </label>
      <label className="form-field">
        <span>Tax Rate (%) <span className="wizard-required">*</span></span>
        <input
          type="number"
          min="0"
          max="100"
          value={form.tax_rate}
          onChange={e => onChange('tax_rate', e.target.value)}
          placeholder="16"
        />
      </label>
      <div className="wizard-hint">
        Standard VAT rates: Kenya 16%, Uganda 18%, Tanzania 18%, Nigeria 7.5%
      </div>
    </div>
  )
}

function StepReview({ form }) {
  const rows = [
    ['Company Name', form.company_name],
    ['Currency', form.currency],
    ['Industry', form.industry],
    ['Branch Name', form.branch_name],
    ['Location', form.branch_location],
    ['Tax Name', form.tax_name],
    ['Tax Rate', `${form.tax_rate}%`],
  ]
  return (
    <div className="wizard-review">
      <p className="wizard-review-intro">Everything looks good? Click <strong>Complete Setup</strong> to launch OmniBiz.</p>
      <div className="wizard-review-table">
        {rows.map(([label, value]) => (
          <div key={label} className="wizard-review-row">
            <span className="wizard-review-label">{label}</span>
            <span className="wizard-review-value">{value || <em style={{ color: 'var(--text-muted)' }}>—</em>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main wizard ────────────────────────────────────────────────
export default function OnboardingWizard() {
  const { completeSetup } = useAuth()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INIT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const canNext = validateStep(step, form)

  const handleNext = () => {
    if (step < 4 && canNext) setStep(s => s + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1)
  }

  const handleComplete = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/setup/initialize`, {
        method: 'POST',
        ...defaultFetchOptions,
        body: JSON.stringify({
          company_name: form.company_name,
          currency: form.currency,
          industry: form.industry,
          branch_name: form.branch_name,
          branch_location: form.branch_location,
          tax_name: form.tax_name,
          tax_rate: parseFloat(form.tax_rate),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Setup failed (${res.status})`)
      }
      completeSetup()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title">

        {/* Header */}
        <div className="wizard-header">
          <img src="/omnibizlogo.png" alt="OmniBiz" className="wizard-logo" />
          <div>
            <h2 id="wizard-title" className="wizard-title">Welcome to OmniBiz</h2>
            <p className="wizard-subtitle">Let's set up your business in under 2 minutes</p>
          </div>
        </div>

        {/* Stepper */}
        <Stepper active={step} />

        {/* Body */}
        <div className="wizard-body">
          <h3 className="wizard-step-heading">
            {step === 1 && 'Company Profile'}
            {step === 2 && 'Branch Setup'}
            {step === 3 && 'Tax Settings'}
            {step === 4 && 'Review & Confirm'}
          </h3>

          {step === 1 && <StepCompany form={form} onChange={onChange} />}
          {step === 2 && <StepBranch form={form} onChange={onChange} />}
          {step === 3 && <StepTax form={form} onChange={onChange} />}
          {step === 4 && <StepReview form={form} />}

          {error && <div className="wizard-error">{error}</div>}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <button
            className="button button-secondary"
            onClick={handleBack}
            disabled={step === 1 || submitting}
          >
            ← Back
          </button>

          <div className="wizard-dots">
            {STEPS.map(s => (
              <span key={s.id} className={`wizard-dot ${step === s.id ? 'active' : step > s.id ? 'done' : ''}`} />
            ))}
          </div>

          {step < 4 ? (
            <button
              className="button button-primary"
              onClick={handleNext}
              disabled={!canNext}
            >
              Next →
            </button>
          ) : (
            <button
              className="button button-primary wizard-complete-btn"
              onClick={handleComplete}
              disabled={submitting}
            >
              {submitting ? (
                <span className="wizard-spinner">Setting up…</span>
              ) : (
                '🚀 Complete Setup'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
