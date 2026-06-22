import { useState } from 'react'

/**
 * Reusable PDF export button.
 * props: onExport (async fn), label, disabled
 */
export default function ExportButton({ onExport, label = 'Export PDF', disabled = false, size = 'sm' }) {
  const [exporting, setExporting] = useState(false)

  const handleClick = async () => {
    setExporting(true)
    try { await onExport() }
    catch (e) { console.error('PDF export failed', e) }
    finally { setExporting(false) }
  }

  return (
    <button
      type="button"
      className="export-btn"
      data-size={size}
      onClick={handleClick}
      disabled={disabled || exporting}
      title="Download as PDF"
    >
      {exporting ? (
        <>
          <span className="export-spinner" />
          Generating…
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {label}
        </>
      )}
    </button>
  )
}
