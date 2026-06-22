import { useEffect, useState } from 'react'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('omnibiz_cookies_accepted')) {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('omnibiz_cookies_accepted', '1')
    setVisible(false)
  }

  const decline = () => {
    // still hide banner but don't store — will re-appear next session
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1a1f2e',
      borderTop: '2px solid rgba(229,62,62,0.4)',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      boxShadow: '0 -4px 30px rgba(0,0,0,0.3)',
      animation: 'slideUp 0.3s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Icon */}
      <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>🍪</span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 3 }}>
          We use cookies
        </div>
        <div style={{ color: '#a0aec0', fontSize: '0.78rem', lineHeight: 1.5 }}>
          OmniBiz uses essential cookies for authentication and session management.
          These are required for the platform to function. No tracking or advertising cookies are used.
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            padding: '9px 18px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent', color: '#a0aec0',
            fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
        >
          Dismiss
        </button>
        <button
          onClick={accept}
          style={{
            padding: '9px 22px', borderRadius: 8,
            border: 'none',
            background: '#e53e3e', color: '#fff',
            fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#c53030' }}
          onMouseOut={e => { e.currentTarget.style.background = '#e53e3e' }}
        >
          Accept All Cookies
        </button>
      </div>
    </div>
  )
}
