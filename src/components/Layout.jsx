import { useMemo, useState, useEffect } from 'react'
import { Plus, Sun, Moon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { computePnl } from '../lib/pnl'
import { todayISO } from '../lib/format'
import db from '../db/db'
import { applyTheme } from '../lib/theme'

const TABS = ['Dashboard', 'Plan', 'Trades', 'Analytics', 'Recap', 'Calendar', 'Import', 'Accounts', 'Settings']

// Dot color reflects how well rules were followed across logged trades (recent
// 30 trades). Green = disciplined, amber = slipping, red = mostly broken.
function useRuleColor() {
  const { trades, ruleItems } = useApp()
  return useMemo(() => {
    if (!ruleItems.length || !trades.length) return 'var(--green)'
    const recent = [...trades].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 30)
    let answered = 0
    let followed = 0
    recent.forEach((t) => {
      ruleItems.forEach((r) => {
        const v = t.rulesChecked?.[r.id]
        if (v === true || v === false) {
          answered++
          if (v === true) followed++
        }
      })
    })
    if (!answered) return 'var(--green)'
    const pct = followed / answered
    if (pct >= 0.8) return 'var(--green)'
    if (pct >= 0.55) return '#d98a1e'
    return 'var(--red)'
  }, [trades, ruleItems])
}

export default function Layout({ tab, setTab, onNewTrade, children }) {
  const dot = useRuleColor()
  const { prefs } = useApp()
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  useEffect(() => {
    setIsDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [prefs])

  const toggleTheme = async () => {
    const next = isDark ? 'light' : 'dark'
    applyTheme(next)
    setIsDark(next === 'dark')
    if (prefs?.id) await db.prefs.update(prefs.id, { theme: next })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div className="brand">
            <span className="dot" style={{ background: dot }} title="Rule-following health" />
            P n Ledger
          </div>
          <nav className="nav">
            {TABS.map((t) => (
              <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="btn primary sm" onClick={onNewTrade}><Plus size={15} /> New trade</button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}

export { todayISO }
