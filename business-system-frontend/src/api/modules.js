import { get, post, del } from './client'
import { API_BASE, defaultFetchOptions } from './config'

// ── Inventory ────────────────────────────────────────────────
export const getProducts    = ()     => get('/api/inventory/products')
export const createProduct  = (data) => post('/api/inventory/products', data)
export const getLowStock    = ()     => get('/api/inventory/low-stock')
export const transferStock  = (data) => post('/api/inventory/transfer', data)

// ── Branches ─────────────────────────────────────────────────
export const getBranches    = ()     => get('/api/branches')
export const createBranch   = (data) => post('/api/branches', data)

// ── Customers ────────────────────────────────────────────────
export const getCustomers       = ()     => get('/api/customers')
export const createCustomer     = (data) => post('/api/customers', data)
export const getCustomerHistory = (id)   => get(`/api/customers/${id}/history`)
export const adjustStoreCredit  = (data) => post('/api/customers/credit-adjust', data)

// ── HRM ──────────────────────────────────────────────────────
export const getEmployees   = ()       => get('/api/employees')
export const createEmployee = (data)   => post('/api/employees', data)
export const clockIn        = (id, data = {}) => post(`/api/employees/${id}/clock-in`, data)
export const clockOut       = (id)     => post(`/api/employees/${id}/clock-out`, {})
export const getPerformance = (id)     => get(`/api/employees/${id}/performance`)

// ── Finance ──────────────────────────────────────────────────
export const getLedger       = (limit = 50) => get(`/api/finance/ledger?limit=${limit}`)
export const getBalanceSheet = ()           => get('/api/finance/balance-sheet')
export const getTaxReport    = ()           => get('/api/finance/tax-report')
export const recordPayment   = (data)       => post('/api/finance/payments', data)
export const getAnalytics    = ()           => get('/api/finance/analytics')

// ── Auth ─────────────────────────────────────────────────────
// logout uses raw fetch — we don't want a 401 loop on logout
export const logoutApi = () =>
  fetch(`${API_BASE}/auth/logout`, { method: 'POST', ...defaultFetchOptions })
