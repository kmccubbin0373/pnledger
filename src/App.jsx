import { useEffect, useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AppProvider, useApp } from './context/AppContext'
import Layout from './components/Layout'
import TradeForm from './components/TradeForm'
import WarningBanners from './components/WarningBanner'
import { seedIfEmpty } from './db/seed'
import db from './db/db'
import { applyTheme } from './lib/theme'
import { computeWarnings, warningInContext } from './lib/warnings'

import Dashboard from './pages/Dashboard'
import Plan from './pages/Plan'
import Trades from './pages/Trades'
import Analytics from './pages/Analytics'
import Recap from './pages/Recap'
import Calendar from './pages/Calendar'
import ImportPage from './pages/ImportPage'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'

function Shell() {
  const { loading, accounts, accountsById, trades, events, instrumentsBySymbol, scope } = useApp()
  const [tab, setTab] = useState('Dashboard')
  const [newTrade, setNewTrade] = useState(false)

  const acks = useLiveQuery(() => db.warningAcks.toArray(), [], [])
  const ackSet = useMemo(() => new Set((acks || []).map((a) => a.key)), [acks])
  const [sessionHidden, setSessionHidden] = useState(() => new Set())
  useEffect(() => { setSessionHidden(new Set()) }, [tab])

  const allWarnings = useMemo(() => {
    if (loading) return []
    return computeWarnings({ accounts, trades, events, instrumentsBySymbol })
  }, [loading, accounts, trades, events, instrumentsBySymbol])

  useEffect(() => {
    if (loading) return
    const activeKeys = new Set(allWarnings.map((w) => w.key))
    ;(acks || []).forEach((a) => { if (!activeKeys.has(a.key)) db.warningAcks.delete(a.key) })
  }, [allWarnings, acks, loading])

  const ctx = {
    tab,
    scopeType: scope.type,
    scopeAccountId: scope.type === 'account' ? scope.value : null,
    scopeFirmId: scope.type === 'firm' ? scope.value : null,
  }

  const visibleWarnings = useMemo(() => {
    return allWarnings.filter((w) => {
      if (sessionHidden.has(w.key)) return false
      if (!ackSet.has(w.key)) return true
      return warningInContext(w, ctx, accountsById)
    })
  }, [allWarnings, sessionHidden, ackSet, ctx, accountsById])

  const dismiss = async (key) => {
    if (!ackSet.has(key)) await db.warningAcks.put({ key })
    setSessionHidden((s) => new Set(s).add(key))
  }

  if (loading) {
    return <div className="center-screen"><div className="spinner" /><div>Loading your journal…</div></div>
  }

  const noAccounts = accounts.length === 0
  const openNewTrade = () => { if (noAccounts) { setTab('Accounts'); return } setNewTrade(true) }

  const page = {
    Dashboard: <Dashboard onNewTrade={openNewTrade} />,
    Plan: <Plan />,
    Trades: <Trades />,
    Analytics: <Analytics />,
    Recap: <Recap />,
    Calendar: <Calendar />,
    Import: <ImportPage />,
    Accounts: <Accounts />,
    Settings: <Settings />,
  }[tab]

  return (
    <Layout tab={tab} setTab={setTab} onNewTrade={openNewTrade}>
      <WarningBanners warnings={visibleWarnings} onDismiss={dismiss} />
      {page}
      {newTrade && <TradeForm onClose={() => setNewTrade(false)} />}
    </Layout>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    seedIfEmpty().then(async () => {
      const p = await db.prefs.toCollection().first()
      applyTheme(p?.theme || 'system')
      setReady(true)
    })
  }, [])
  if (!ready) return <div className="center-screen"><div className="spinner" /></div>
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

