import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, loading: authLoading } = useAuth()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Email and password are required'); return }
    setError('')
    setSubmitting(true)
    try { await login(email, password) }
    catch (err) { setError(err.message || 'Invalid credentials') }
    finally { setSubmitting(false) }
  }

  if (authLoading) {
    return (
      <div className="lp-root">
        <div className="lp-left" />
        <div className="lp-right">
          <div className="lp-card"><div className="lp-loading">Loading session…</div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="lp-root">

      {/* ── LEFT — dark brand panel ── */}
      <div className="lp-left">
        <div className="lp-grid-overlay" aria-hidden="true" />

        {/* Brand */}
        <div className="lp-brand">
          <img src="/omnibizlogo.png" alt="OmniBiz" className="lp-brand-logo" />
          <span className="lp-brand-name">OmniBiz</span>
        </div>

        {/* Hero copy */}
        <h1 className="lp-hero">
          Run your entire<br />
          business from<br />
          <span className="lp-hero-accent">one place.</span>
        </h1>

        <p className="lp-sub">
          The complete multi-branch business intelligence platform
          built for modern retail, wholesale and service operations.
        </p>

        {/* Feature pills */}
        <div className="lp-features">
          {[
            { icon: '◈', text: 'Point of Sale & Sales Tracking' },
            { icon: '◫', text: 'Multi-Branch Inventory Control' },
            { icon: '◐', text: 'Double-Entry Financial Engine' },
            { icon: '◉', text: 'CRM & Customer Loyalty' },
            { icon: '◍', text: 'HR, Shifts & Commission Tracking' },
            { icon: '🧾', text: 'VAT / eTIMS Compliance' },
          ].map(f => (
            <div key={f.text} className="lp-feature-pill">
              <span className="lp-feature-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <p className="lp-bottom-tag">
          Trusted by growing businesses across East Africa
        </p>

        {/* S-curve SVG divider — right edge */}
        <svg
          className="lp-scurve"
          viewBox="0 0 80 900"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M 80,0
               C 80,0  10,120  40,225
               C 70,330 80,380  30,450
               C -20,520 10,600  40,675
               C 70,750 80,810  0,900
               L 80,900
               Z"
            fill="#f5f5f5"
          />
        </svg>
      </div>

      {/* ── RIGHT — form panel ── */}
      <div className="lp-right">

        {/* Logo centered above the card */}
        <div className="lp-top-brand">
          <img src="/omnibizlogo.png" alt="OmniBiz" className="lp-top-logo" />
          <span className="lp-top-name">OmniBiz</span>
        </div>

        <div className="lp-card">
          <h2 className="lp-title">Welcome back</h2>
          <p className="lp-card-sub">Sign in to your business dashboard</p>

          <form className="lp-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="lp-error" role="alert">{error}</div>}

            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-email">Email address</label>
              <input
                id="lp-email"
                className="lp-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
                required
              />
            </div>

            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-password">Password</label>
              <div className="lp-pwd-wrap">
                <input
                  id="lp-password"
                  className="lp-input lp-input-pwd"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="lp-eye"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="lp-submit"
              disabled={submitting}
            >
              {submitting ? (
                <span className="lp-submit-inner">
                  <span className="lp-spinner" />
                  Signing in…
                </span>
              ) : 'Login'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="lp-footer">
          © {new Date().getFullYear()} OmniBiz · All rights reserved. 
          <p class="text-sm text-gray-600 font-medium">
  Powered by 
  <a href="https://underworld-tech.vercel.app/" 
     target="_blank" 
     rel="noopener noreferrer" 
     class="text-gray-800 hover:text-red-600 transition-colors duration-200 ease-in-out underline decoration-transparent hover:decoration-red-600">
     UnderworldTech
  </a>
</p>
        </p>
      </div>

    </div>
  )
}
