/**
 * Navigation items per role.
 * Each item: { label, icon, roles[] }
 */
export const ALL_NAV = [
  // ── Owner & Manager ──────────────────────────────────────
  { label: 'Dashboard',     icon: '▦', roles: ['Owner', 'Manager'] },
  { label: 'Sales',         icon: '◈', roles: ['Owner', 'Manager'] },
  { label: 'Inventory',     icon: '◫', roles: ['Owner', 'Manager'] },
  { label: 'Customers',     icon: '◉', roles: ['Owner', 'Manager'] },
  { label: 'Employees',     icon: '◍', roles: ['Owner', 'Manager'] },
  { label: 'Finance',       icon: '◐', roles: ['Owner'] },
  { label: 'Invoices',      icon: '◧', roles: ['Owner', 'Manager'] },
  { label: 'Users',         icon: '◑', roles: ['Owner'] },
  { label: 'Requests',      icon: '📥', roles: ['Owner', 'Manager'] },
  { label: 'Reports',       icon: '◎', roles: ['Owner', 'Manager'] },
  { label: 'Notifications', icon: '🔔', roles: ['Owner', 'Manager'] },

  // ── Super Admin ───────────────────────────────────────────
  { label: 'Businesses',    icon: '🏢', roles: ['SuperAdmin'] },
  { label: 'Add Owner',     icon: '➕', roles: ['SuperAdmin'] },
  { label: 'Audit Log',     icon: '📋', roles: ['SuperAdmin'] },
]

export function navForRole(role) {
  return ALL_NAV.filter(item => item.roles.includes(role))
}

export const ROLE_LABELS = {
  SuperAdmin: { label: 'Super Admin',     color: '#6b46c1', bg: 'rgba(107,70,193,0.1)' },
  Owner:      { label: 'Business Owner',  color: '#e53e3e', bg: 'rgba(229,62,62,0.1)'  },
  Manager:    { label: 'Branch Manager',  color: '#3182ce', bg: 'rgba(49,130,206,0.1)' },
  Cashier:    { label: 'Cashier / POS',   color: '#38a169', bg: 'rgba(56,161,105,0.1)' },
}
