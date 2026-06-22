import { useNotifications, CATEGORY_COLORS, CATEGORY_ICONS } from '../../context/NotificationsContext'
import { useAuth } from '../../context/AuthContext'

const CATEGORY_LABELS = {
  login:    'Login',
  sale:     'Sale',
  invoice:  'Invoice',
  account:  'Account',
  user:     'User',
  stock:    'Stock',
  transfer: 'Transfer',
  payment:  'Payment',
  employee: 'Employee',
  system:   'System',
}

export default function NotificationsLog() {
  const {
    allNotifications,
    dismissedIds,
    clearDismissed,
    markRead,
    markAllRead,
    fetchNotifications,
  } = useNotifications()

  const unread = allNotifications.filter(n => !n.is_read).length
  const hidden = dismissedIds.size

  // Group by date
  const groups = allNotifications.reduce((acc, n) => {
    const d = new Date(n.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    let label
    if (d.toDateString() === today.toDateString()) label = 'Today'
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

    if (!acc[label]) acc[label] = []
    acc[label].push(n)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="mod-header">
        <div>
          <h2 className="mod-title">Notification Log</h2>
          <p className="mod-subtitle">
            Complete activity history — dismissing from the bell does not remove entries here
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unread > 0 && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px',
              background: 'rgba(229,62,62,0.1)', color: '#c53030', borderRadius: 20,
            }}>
              {unread} unread
            </span>
          )}
          <span className="mod-stat">{allNotifications.length} total</span>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {unread > 0 && (
          <button className="button button-secondary" style={{ fontSize: '0.78rem' }} onClick={markAllRead}>
            ✓ Mark all read
          </button>
        )}
        {hidden > 0 && (
          <button className="button button-secondary" style={{ fontSize: '0.78rem' }} onClick={clearDismissed}>
            ↩ Restore {hidden} dismissed
          </button>
        )}
        <button className="button button-secondary" style={{ fontSize: '0.78rem' }} onClick={fetchNotifications}>
          ↻ Refresh
        </button>

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <span key={key} style={{
              fontSize: '0.68rem', padding: '3px 8px', borderRadius: 20,
              background: `${CATEGORY_COLORS[key]}18`,
              color: CATEGORY_COLORS[key],
              border: `1px solid ${CATEGORY_COLORS[key]}30`,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {CATEGORY_ICONS[key]} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Grouped log */}
      {allNotifications.length === 0 ? (
        <div className="section-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 600 }}>No notifications yet</div>
          <div style={{ fontSize: '0.78rem', marginTop: 6 }}>
            Activity from sales, logins, stock changes and more will appear here
          </div>
        </div>
      ) : (
        Object.entries(groups).map(([dateLabel, items]) => (
          <div key={dateLabel}>
            {/* Date separator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {dateLabel}
              </div>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {items.length} event{items.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
              {items.map((n, i) => {
                const color = CATEGORY_COLORS[n.category] ?? '#718096'
                const isDismissed = dismissedIds.has(n.id)
                return (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      padding: '14px 18px',
                      borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                      background: n.is_read ? 'transparent' : `${color}06`,
                      transition: 'background 0.15s',
                      cursor: n.is_read ? 'default' : 'pointer',
                      opacity: isDismissed ? 0.5 : 1,
                    }}
                    onClick={() => !n.is_read && markRead(n.id)}
                  >
                    {/* Unread dot */}
                    <div style={{ paddingTop: 4, flexShrink: 0 }}>
                      {!n.is_read ? (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      ) : (
                        <div style={{ width: 8, height: 8 }} />
                      )}
                    </div>

                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${color}15`,
                      border: `1px solid ${color}25`,
                      display: 'grid', placeItems: 'center',
                      fontSize: '1rem', flexShrink: 0,
                    }}>
                      {n.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.84rem', color: 'var(--text-strong)' }}>
                          {n.title}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {n.time === 'now'
                            ? <span style={{ color, fontWeight: 700 }}>now</span>
                            : n.time}
                        </span>
                      </div>
                      {n.body && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
                          {n.body}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.65rem', padding: '2px 7px', borderRadius: 20,
                          background: `${color}12`, color, border: `1px solid ${color}25`,
                        }}>
                          {CATEGORY_LABELS[n.category] ?? n.category}
                        </span>
                        {isDismissed && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            (dismissed from bell)
                          </span>
                        )}
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          {new Date(n.created_at.endsWith('Z') ? n.created_at : n.created_at + 'Z').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
