import { X } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function Modal({ title, icon, onClose, children, footer, size }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size || ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{icon} {title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Stat({ label, icon, value, sub, tone, feature }) {
  const cls = tone === 'pos' ? 'pos' : tone === 'neg' ? 'neg' : ''
  return (
    <div className={`stat ${feature ? 'feature' : ''}`}>
      <div className="stat-label">{icon} {label}</div>
      <div className={`stat-val num ${cls}`}>{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function StatusPill({ status }) {
  const map = {
    active: 'Active', eval: 'Eval', funded: 'Funded', live: 'Live', blown: 'Blown', archived: 'Archived',
  }
  return <span className={`pill ${status}`}>{map[status] || status}</span>
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      <div className="ic">{icon}</div>
      <h4>{title}</h4>
      <div>{children}</div>
    </div>
  )
}

export function Bar({ value, max, negative }) {
  const pct = max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${pct}%`, background: negative ? 'var(--red)' : 'var(--green)' }} />
    </div>
  )
}

// Global account-scope selector shown on Dashboard / Calendar / Analytics.
export function ScopeBar() {
  const { scope, setScope, firms, accounts } = useApp()
  const active = accounts.filter((a) => a.status !== 'archived')
  const onChange = (e) => {
    const v = e.target.value
    if (v === 'all') return setScope({ type: 'all', value: null })
    const [type, value] = v.split(':')
    setScope({ type, value: type === 'account' || type === 'firm' ? Number(value) : value })
  }
  const current =
    scope.type === 'all' ? 'all' :
    scope.type === 'type' ? `type:${scope.value}` :
    `${scope.type}:${scope.value}`
  return (
    <div className="scope-bar">
      <select value={current} onChange={onChange} aria-label="Account scope">
        <option value="all">All accounts</option>
        <optgroup label="By type">
          <option value="type:eval">Evals only</option>
          <option value="type:funded">Funded only</option>
          <option value="type:live">Live only</option>
          <option value="type:futures">Futures accounts</option>
          <option value="type:options">Options accounts</option>
        </optgroup>
        {firms.length > 0 && (
          <optgroup label="By firm">
            {firms.map((f) => <option key={f.id} value={`firm:${f.id}`}>{f.name}</option>)}
          </optgroup>
        )}
        {active.length > 0 && (
          <optgroup label="Single account">
            {active.map((a) => <option key={a.id} value={`account:${a.id}`}>{a.name}</option>)}
          </optgroup>
        )}
      </select>
    </div>
  )
}
