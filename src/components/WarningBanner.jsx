import { useState } from 'react'
import { AlertTriangle, X, Lightbulb, ChevronDown } from 'lucide-react'

// Renders the stack of active warning banners that drop down from the top.
// `warnings` are already filtered to those that should currently show.
export default function WarningBanners({ warnings, onDismiss }) {
  if (!warnings.length) return null
  return (
    <div className="warn-stack">
      {warnings.map((w) => <Banner key={w.key} w={w} onDismiss={onDismiss} />)}
    </div>
  )
}

function Banner({ w, onDismiss }) {
  const [open, setOpen] = useState(false)
  const red = w.severity === 'red'
  return (
    <div className={`warn-banner ${red ? 'red' : 'amber'}`}>
      <div className="warn-row">
        <AlertTriangle size={16} className="warn-ic" />
        <div className="warn-text">
          <span className="warn-title">{w.title}</span>
          <span className="warn-msg">{w.message}</span>
        </div>
        {w.recommendation && (
          <button className="warn-tip-btn" onClick={() => setOpen((o) => !o)}>
            <Lightbulb size={13} /> Suggestion <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
        )}
        <button className="warn-x" onClick={() => onDismiss(w.key)} aria-label="Dismiss"><X size={15} /></button>
      </div>
      {open && w.recommendation && (
        <div className="warn-tip"><Lightbulb size={13} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{w.recommendation}</span></div>
      )}
    </div>
  )
}
