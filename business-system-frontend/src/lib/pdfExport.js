/**
 * OmniBiz PDF Export Utility
 * jsPDF is loaded lazily on first export call — keeps initial bundle small.
 */

const BRAND_COLOR  = [229, 62, 62]
const DARK_COLOR   = [26, 32, 44]
const MUTED_COLOR  = [113, 128, 150]
const LIGHT_BG     = [247, 248, 252]
const BORDER_COLOR = [226, 232, 240]

async function getJsPDF() {
  const { default: jsPDF } = await import('jspdf')
  return jsPDF
}

/** Creates a new jsPDF doc with OmniBiz header & footer */
async function createDoc(title, subtitle = '') {
  const jsPDF = await getJsPDF()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── Header bar ──
  doc.setFillColor(...BRAND_COLOR)
  doc.rect(0, 0, W, 18, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('OmniBiz', 10, 12)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Business Intelligence Platform', 35, 12)

  // Date top-right
  const now = new Date().toLocaleString()
  doc.setFontSize(7)
  doc.text(now, W - 10, 12, { align: 'right' })

  // ── Title block ──
  doc.setTextColor(...DARK_COLOR)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 10, 30)

  if (subtitle) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED_COLOR)
    doc.text(subtitle, 10, 37)
  }

  // Divider
  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.3)
  doc.line(10, subtitle ? 41 : 35, W - 10, subtitle ? 41 : 35)

  // ── Footer (added to page 1 — addPage event covers subsequent pages) ──
  const addFooter = (pageNum, totalPages) => {
    doc.setFontSize(7)
    doc.setTextColor(...MUTED_COLOR)
    doc.text(`OmniBiz · Confidential`, 10, H - 6)
    doc.text(`Page ${pageNum} of ${totalPages}`, W - 10, H - 6, { align: 'right' })
  }

  return { doc, W, H, addFooter, startY: subtitle ? 46 : 40 }
}

/** Draws a key-value summary block */
function drawSummaryBlock(doc, items, x, y, W) {
  const colW = (W - 20) / 2
  let col = 0, row = 0
  items.forEach(([label, value, accent]) => {
    const cx = x + col * (colW + 5)
    const cy = y + row * 14

    // Card background
    doc.setFillColor(...LIGHT_BG)
    doc.roundedRect(cx, cy, colW, 11, 2, 2, 'F')

    doc.setFontSize(7)
    doc.setTextColor(...MUTED_COLOR)
    doc.setFont('helvetica', 'normal')
    doc.text(label, cx + 3, cy + 4)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(accent ? BRAND_COLOR : DARK_COLOR))
    doc.text(String(value), cx + 3, cy + 9)

    col++
    if (col >= 2) { col = 0; row++ }
  })
  return y + Math.ceil(items.length / 2) * 14 + 4
}

/** Draws a table */
function drawTable(doc, headers, rows, startY, W, options = {}) {
  const margin = 10
  const tableW = W - margin * 2
  const colCount = headers.length
  const colWidths = options.colWidths ?? headers.map(() => tableW / colCount)

  let y = startY

  // Header row
  doc.setFillColor(...DARK_COLOR)
  doc.rect(margin, y, tableW, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')

  let cx = margin
  headers.forEach((h, i) => {
    doc.text(h, cx + 2, y + 5)
    cx += colWidths[i]
  })
  y += 7

  // Data rows
  rows.forEach((row, ri) => {
    // Page break check
    if (y > 270) {
      doc.addPage()
      y = 15
      // Repeat header
      doc.setFillColor(...DARK_COLOR)
      doc.rect(margin, y, tableW, 7, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      cx = margin
      headers.forEach((h, i) => { doc.text(h, cx + 2, y + 5); cx += colWidths[i] })
      y += 7
    }

    const rowH = 6
    doc.setFillColor(...(ri % 2 === 0 ? [255, 255, 255] : LIGHT_BG))
    doc.rect(margin, y, tableW, rowH, 'F')

    doc.setTextColor(...DARK_COLOR)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')

    cx = margin
    row.forEach((cell, ci) => {
      const text = String(cell ?? '—').substring(0, 40)
      doc.text(text, cx + 2, y + 4.5)
      cx += colWidths[ci]
    })

    // Border
    doc.setDrawColor(...BORDER_COLOR)
    doc.setLineWidth(0.1)
    doc.line(margin, y + rowH, margin + tableW, y + rowH)
    y += rowH
  })

  return y + 4
}

// ── Public export functions ────────────────────────────────────

export async function exportDashboardPDF(overview, analytics, tenantName) {
  const { doc, W, H, addFooter, startY } = await createDoc(
    'Dashboard Overview',
    `${tenantName} · All branches`
  )

  let y = startY

  // Summary cards
  const stats = overview?.stats ?? []
  const summaryItems = stats.map(s => [s.title, s.value])
  if (analytics) {
    summaryItems.push(
      ['30-Day Revenue', `KES ${(analytics.revenue_30d || 0).toLocaleString()}`],
      ['Paid Invoices', analytics.paid_invoices],
      ['Outstanding Invoices', analytics.outstanding_invoices],
      ['Low Stock SKUs', analytics.low_stock_products],
    )
  }
  y = drawSummaryBlock(doc, summaryItems, 10, y, W)
  y += 4

  // Recent transactions
  const orders = overview?.recent_orders ?? []
  if (orders.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK_COLOR)
    doc.text('Recent Transactions', 10, y)
    y += 5

    y = drawTable(
      doc,
      ['#', 'Client / Entity', 'Status', 'Date', 'Amount'],
      orders.map((o, i) => [o.id ?? i + 1, o.client, o.status, o.date ?? '—', o.amount]),
      y, W,
      { colWidths: [15, 60, 28, 30, 35] }
    )
  }

  addFooter(1, doc.internal.getNumberOfPages())
  doc.save(`omnibiz-dashboard-${Date.now()}.pdf`)
}

export async function exportBranchPDF(branchData, branchName) {
  const { doc, W, H, addFooter, startY } = await createDoc(
    `Branch Report — ${branchName}`,
    `Generated ${new Date().toLocaleDateString()}`
  )

  let y = startY

  y = drawSummaryBlock(doc, [
    ['Total Revenue',    `KES ${branchData.total_revenue.toLocaleString()}`],
    ['Collected',        `KES ${branchData.total_paid.toLocaleString()}`],
    ['Open Invoices',    branchData.open_invoices],
    ['Customer Count',   branchData.customer_count],
    ['Low Stock Items',  branchData.low_stock_count],
    ['Outstanding',      `KES ${(branchData.total_revenue - branchData.total_paid).toLocaleString()}`, true],
  ], 10, y, W)
  y += 6

  if (branchData.recent_invoices?.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK_COLOR)
    doc.text('Recent Invoices', 10, y)
    y += 5

    y = drawTable(
      doc,
      ['Invoice #', 'Total (KES)', 'Outstanding', 'Status', 'Date'],
      branchData.recent_invoices.map(i => [
        i.invoice_number, i.total_amount.toLocaleString(),
        i.outstanding_amount.toLocaleString(), i.status,
        i.created_at.split('T')[0],
      ]),
      y, W,
      { colWidths: [50, 30, 32, 25, 32] }
    )
  }

  addFooter(1, doc.internal.getNumberOfPages())
  doc.save(`branch-report-${branchName.replace(/\s+/g, '-')}-${Date.now()}.pdf`)
}

export function exportFinancePDF(balance, tax, ledger, tenantName) {
  const { doc, W, H, addFooter, startY } = createDoc(
    'Financial Report',
    `${tenantName} · ${new Date().toLocaleDateString()}`
  )
  let y = startY

  // Balance sheet
  if (balance) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BRAND_COLOR)
    doc.text('Balance Sheet', 10, y)
    y += 5

    const bsItems = [
      ...Object.entries(balance.assets).map(([k, v]) => [k.replace(/_/g, ' '), typeof v === 'number' ? `KES ${v.toLocaleString()}` : v]),
      ...Object.entries(balance.revenue).map(([k, v]) => [k.replace(/_/g, ' '), typeof v === 'number' ? `KES ${v.toLocaleString()}` : v]),
    ]
    y = drawTable(doc, ['Metric', 'Value'], bsItems, y, W, { colWidths: [120, 60] })
    y += 4
  }

  // Tax summary
  if (tax) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BRAND_COLOR)
    doc.text('VAT / Tax Report', 10, y)
    y += 5

    y = drawSummaryBlock(doc, [
      ['Gross Sales', `KES ${tax.total_gross_sales.toLocaleString()}`],
      ['VAT Collected', `KES ${tax.total_vat_collected.toLocaleString()}`, true],
    ], 10, y, W)
    y += 4

    if (tax.breakdown_by_category?.length > 0) {
      y = drawTable(
        doc,
        ['VAT Category', 'Gross (KES)', 'VAT (KES)', 'Net (KES)'],
        tax.breakdown_by_category.map(r => [r.category, r.gross.toLocaleString(), r.vat.toLocaleString(), r.net.toLocaleString()]),
        y, W,
        { colWidths: [50, 45, 45, 45] }
      )
      y += 4
    }
  }

  // Ledger
  if (ledger?.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BRAND_COLOR)
    doc.text('Transaction Ledger', 10, y)
    y += 5

    y = drawTable(
      doc,
      ['#', 'Timestamp', 'Type', 'Entity', 'Amount (KES)'],
      ledger.slice(0, 50).map(e => [
        e.id, e.timestamp.replace('T', ' ').split('.')[0],
        e.action_type, e.entity, e.amount.toLocaleString(),
      ]),
      y, W,
      { colWidths: [12, 48, 30, 40, 35] }
    )
  }

  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    addFooter(i, total)
  }
  doc.save(`finance-report-${Date.now()}.pdf`)
}

export function exportInventoryPDF(products, lowStock, tenantName) {
  const { doc, W, addFooter, startY } = createDoc(
    'Inventory Report',
    `${tenantName} · ${new Date().toLocaleDateString()}`
  )
  let y = startY

  y = drawSummaryBlock(doc, [
    ['Total Products', products.length],
    ['Low Stock Items', lowStock.length, lowStock.length > 0],
  ], 10, y, W)
  y += 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK_COLOR)
  doc.text('Product Catalogue', 10, y)
  y += 5

  y = drawTable(
    doc,
    ['Name', 'SKU', 'Price (KES)', 'Cost', 'Stock', 'Reorder', 'VAT'],
    products.map(p => [p.name, p.sku, p.sales_price.toLocaleString(), p.cost_price.toLocaleString(), p.quantity_on_hand, p.reorder_level, p.vat_category]),
    y, W,
    { colWidths: [42, 25, 22, 20, 16, 18, 22] }
  )

  if (lowStock.length > 0) {
    y += 4
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BRAND_COLOR)
    doc.text('⚠ Low Stock Alerts', 10, y)
    y += 5

    y = drawTable(
      doc,
      ['Product', 'Branch', 'On Hand', 'Reorder Level'],
      lowStock.map(a => [a.product_name, a.branch_id, a.quantity_on_hand, a.reorder_level]),
      y, W,
      { colWidths: [60, 30, 30, 35] }
    )
  }

  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(i, total) }
  doc.save(`inventory-report-${Date.now()}.pdf`)
}

export function exportCustomersPDF(customers, tenantName) {
  const { doc, W, addFooter, startY } = createDoc(
    'Customer Report',
    `${tenantName} · ${new Date().toLocaleDateString()}`
  )
  let y = startY

  const totalBalance = customers.reduce((s, c) => s + c.balance, 0)
  y = drawSummaryBlock(doc, [
    ['Total Customers', customers.length],
    ['Total Outstanding', `KES ${totalBalance.toLocaleString()}`, totalBalance > 0],
  ], 10, y, W)
  y += 6

  y = drawTable(
    doc,
    ['Name', 'Phone', 'Email', 'Balance (KES)', 'Credit Limit', 'Status'],
    customers.map(c => [c.name, c.phone ?? '—', c.email ?? '—', c.balance.toLocaleString(), c.credit_limit.toLocaleString(), c.active]),
    y, W,
    { colWidths: [40, 28, 40, 26, 26, 20] }
  )

  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(i, total) }
  doc.save(`customers-report-${Date.now()}.pdf`)
}

export function exportEmployeesPDF(employees, tenantName) {
  const { doc, W, addFooter, startY } = createDoc(
    'Employees & HR Report',
    `${tenantName} · ${new Date().toLocaleDateString()}`
  )
  let y = startY

  y = drawSummaryBlock(doc, [
    ['Total Employees', employees.length],
    ['Active', employees.filter(e => e.is_active).length],
  ], 10, y, W)
  y += 6

  y = drawTable(
    doc,
    ['Name', 'Role', 'Branch', 'Phone', 'Commission %', 'Status'],
    employees.map(e => [e.name, e.role, e.branch_id ?? '—', e.phone ?? '—', `${e.commission_rate}%`, e.is_active ? 'Active' : 'Inactive']),
    y, W,
    { colWidths: [42, 22, 18, 32, 24, 20] }
  )

  const total = doc.internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) { doc.setPage(i); addFooter(i, total) }
  doc.save(`employees-report-${Date.now()}.pdf`)
}

