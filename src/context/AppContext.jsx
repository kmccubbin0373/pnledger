import { createContext, useContext, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db/db'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }) {
  const firms = useLiveQuery(() => db.firms.toArray(), [], [])
  const accounts = useLiveQuery(() => db.accounts.toArray(), [], [])
  const instruments = useLiveQuery(() => db.instruments.toArray(), [], [])
  const strategies = useLiveQuery(() => db.strategies.where('archived').equals(0).toArray(), [], [])
  const ruleItems = useLiveQuery(
    () => db.ruleItems.where('archived').equals(0).sortBy('order'),
    [],
    []
  )
  const mistakeTags = useLiveQuery(() => db.mistakeTags.where('archived').equals(0).toArray(), [], [])
  const trades = useLiveQuery(() => db.trades.toArray(), [], [])
  const events = useLiveQuery(() => db.accountEvents.toArray(), [], [])
  const recaps = useLiveQuery(() => db.recaps.toArray(), [], [])
  const plans = useLiveQuery(() => db.plans.toArray(), [], [])
  const savedViews = useLiveQuery(() => db.savedViews.toArray(), [], [])
  const prefsRow = useLiveQuery(() => db.prefs.toCollection().first(), [], null)

  // Global account scope used by Dashboard / Calendar / Analytics filters.
  const [scope, setScope] = useState({ type: 'all', value: null })

  const instrumentsBySymbol = useMemo(() => {
    const m = {}
    ;(instruments || []).forEach((i) => {
      m[i.symbol] = i
    })
    return m
  }, [instruments])

  const firmsById = useMemo(() => {
    const m = {}
    ;(firms || []).forEach((f) => {
      m[f.id] = f
    })
    return m
  }, [firms])

  const accountsById = useMemo(() => {
    const m = {}
    ;(accounts || []).forEach((a) => {
      m[a.id] = a
    })
    return m
  }, [accounts])

  // Returns the set of account ids matching the current scope filter.
  const scopedAccountIds = useMemo(() => {
    const all = accounts || []
    let list = all.filter((a) => a.status !== 'archived')
    if (scope.type === 'account') list = all.filter((a) => a.id === scope.value)
    else if (scope.type === 'firm') list = list.filter((a) => a.firmId === scope.value)
    else if (scope.type === 'type') {
      if (scope.value === 'eval') list = list.filter((a) => a.status === 'eval')
      else if (scope.value === 'funded') list = list.filter((a) => a.status === 'funded')
      else if (scope.value === 'live') list = list.filter((a) => a.status === 'live')
      else if (scope.value === 'options') list = list.filter((a) => a.accountType === 'options')
      else if (scope.value === 'futures') list = list.filter((a) => a.accountType === 'futures')
    }
    return new Set(list.map((a) => a.id))
  }, [accounts, scope])

  const scopedTrades = useMemo(
    () => (trades || []).filter((t) => scopedAccountIds.has(t.accountId)),
    [trades, scopedAccountIds]
  )

  const loading =
    firms === undefined ||
    accounts === undefined ||
    instruments === undefined ||
    trades === undefined

  const value = {
    firms: firms || [],
    accounts: accounts || [],
    instruments: instruments || [],
    strategies: strategies || [],
    ruleItems: ruleItems || [],
    mistakeTags: mistakeTags || [],
    trades: trades || [],
    events: events || [],
    recaps: recaps || [],
    plans: plans || [],
    savedViews: savedViews || [],
    prefs: prefsRow || { maxTradesPerDay: 3 },
    instrumentsBySymbol,
    firmsById,
    accountsById,
    scope,
    setScope,
    scopedAccountIds,
    scopedTrades,
    loading,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
