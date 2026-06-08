import { useMemo } from 'react'
import { TrendingUp, CalendarDays, ClipboardCheck, Flame, AlertCircle, NotebookPen, Target } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Stat, ScopeBar, Empty, Bar } from '../components/ui'
import db from '../db/db'
import { computePnl, rMultiple, expectancyR } from '../lib/pnl'
import { fmtMoney, fmtPct, todayISO } from '../lib/format'

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const RANGES = [
  { key: '1D', label: 'Today' }, { key: '1W', label: '1 week' }, { key: '2W', label: '2 weeks' },
  { key: '1M', label: '1 month' }, { key: '1Q', label: '1 quarter' }, { key: 'YTD', label: 'Year to date' }, { key: 'ALL', label: 'All time' },
]
function rangeCutoff(key) {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  switch (key) {
    case '1D': return toISO(d)
    case '1W': { d.setDate(d.getDate() - 6); return toISO(d) }
    case '2W': { d.setDate(d.getDate() - 13); return toISO(d) }
    case '1M': { d.setMonth(d.getMonth() - 1); return toISO(d) }
    case '1Q': { d.setMonth(d.getMonth() - 3); return toISO(d) }
    case 'YTD': return `${new Date().getFullYear()}-01-01`
    case 'ALL': return null
    default: { d.setDate(d.getDate() - 6); return toISO(d) }
  }
}
const rangeLabel = (key) => (RANGES.find((r) => r.key === key)?.label || '1 week').toLowerCase()

export default function Dashboard({ onNewTrade }) {
  const { scopedTrades, accountsById, instrumentsBySymbol, ruleItems, prefs, plans } = useApp()
  const today = todayISO()
  const range = prefs?.dashboardRange || '1W'
  const cutoff = rangeCutoff(range)
  const setRange = async (key) => {
    const id = prefs?.id
    if (id != null) await db.prefs.update(id, { dashboardRange: key })
    else await db.prefs.add({ dashboardRange: key })
  }

  const data = useMemo(() => {
    const withPnl = scopedTrades.map((t) => ({ t, net: computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net }))
    const todays = withPnl.filter((r) => r.t.date === today)
    const week = cutoff ? withPnl.filter((r) => r.t.date >= cutoff) : withPnl

    const sum = (arr) => arr.reduce((s, r) => s + r.net, 0)
    const wins = (arr) => arr.filter((r) => r.net > 0).length
    const winRate = (arr) => (arr.length ? (wins(arr) / arr.length) * 100 : 0)

    // strategy breakdown (week)
    const byStrat = {}
    week.forEach((r) => { const k = r.t.strategy || 'Untagged'; byStrat[k] = (byStrat[k] || 0) + r.net })
    const strategies = Object.entries(byStrat).sort((a, b) => b[1] - a[1])
    const stratMax = Math.max(1, ...strategies.map(([, v]) => Math.abs(v)))

    // mistakes (all scoped)
    const byMistake = {}
    withPnl.forEach((r) => (r.t.mistakes || []).forEach((m) => { byMistake[m] = (byMistake[m] || 0) + Math.min(0, r.net) }))
    const mistakes = Object.entries(byMistake).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 5)
    const mistakeMax = Math.max(1, ...mistakes.map(([, v]) => Math.abs(v)))

    // streak (by trade order)
    const ordered = [...withPnl].sort((a, b) => (a.t.date || '').localeCompare(b.t.date || '') || (a.t.createdAt || 0) - (b.t.createdAt || 0))
    let streak = 0, streakType = null
    for (let i = ordered.length - 1; i >= 0; i--) {
      const w = ordered[i].net > 0
      if (i === ordered.length - 1) { streakType = w; streak = 1 }
      else if (w === streakType) streak++
      else break
    }

    // expectancy + average R (week)
    const weekNets = week.map((r) => r.net)
    const expDollarWeek = weekNets.length ? weekNets.reduce((s, n) => s + n, 0) / weekNets.length : 0
    const weekR = week.map((r) => rMultiple(r.t, accountsById[r.t.accountId], instrumentsBySymbol))
    const expRWeek = expectancyR(weekR)

    // best / worst day (all scoped)
    const byDay = {}
    withPnl.forEach((r) => { if (r.t.date) byDay[r.t.date] = (byDay[r.t.date] || 0) + r.net })
    const dayEntries = Object.entries(byDay)
    const bestDay = dayEntries.length ? dayEntries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null
    const worstDay = dayEntries.length ? dayEntries.reduce((a, b) => (b[1] < a[1] ? b : a)) : null

    // rule following (week)
    let answered = 0, followed = 0
    week.forEach((r) => ruleItems.forEach((ri) => { const v = r.t.rulesChecked?.[ri.id]; if (v === true || v === false) { answered++; if (v) followed++ } }))

    return {
      todayPnl: sum(todays), todayCount: todays.length, todayWins: wins(todays),
      weekPnl: sum(week), weekCount: week.length, weekWinRate: winRate(week),
      strategies, stratMax, mistakes, mistakeMax, streak, streakType,
      ruleRate: answered ? (followed / answered) * 100 : null,
      todays: todays.sort((a, b) => (b.t.createdAt || 0) - (a.t.createdAt || 0)),
      expDollarWeek, expRWeek, bestDay, worstDay,
    }
  }, [scopedTrades, accountsById, instrumentsBySymbol, ruleItems, today, cutoff])

  const tradesLeft = Math.max(0, (prefs.maxTradesPerDay ?? 3) - data.todayCount)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Dashboard timeframe">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <ScopeBar />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 14 }}>
        <Stat label="Today's P/L" icon={<TrendingUp size={13} />} value={fmtMoney(data.todayPnl, { sign: true })}
          tone={data.todayPnl >= 0 ? 'pos' : 'neg'} sub={`${data.todayCount} trade${data.todayCount !== 1 ? 's' : ''} · ${data.todayWins}W ${data.todayCount - data.todayWins}L`} />
        <Stat label={range === '1D' ? 'Today' : rangeLabel(range).replace(/^\w/, (c) => c.toUpperCase())} icon={<CalendarDays size={13} />} value={fmtMoney(data.weekPnl, { sign: true })}
          tone={data.weekPnl >= 0 ? 'pos' : 'neg'} sub={`${data.weekCount} trades · ${fmtPct(data.weekWinRate)} win`} />
        <Stat label="Rule following" icon={<ClipboardCheck size={13} />} value={data.ruleRate == null ? '—' : fmtPct(data.ruleRate)} sub={rangeLabel(range)} />
        <Stat label="Streak" icon={<Flame size={13} />} value={data.streak ? `${data.streak}${data.streakType ? 'W' : 'L'}` : '—'} sub={data.streak ? `current ${data.streakType ? 'win' : 'loss'} streak` : 'no trades'} />
        <Stat feature label="Trades left" icon={<AlertCircle size={13} />} value={tradesLeft} sub={`${prefs.maxTradesPerDay ?? 3} max · ${data.todayCount} used`} />
        <Stat label="Expectancy" icon={<TrendingUp size={13} />} value={fmtMoney(data.expDollarWeek, { sign: true })} sub={`per trade · ${rangeLabel(range)}`} tone={data.expDollarWeek >= 0 ? 'pos' : 'neg'} />
        <Stat label="Avg R" icon={<TrendingUp size={13} />} value={data.expRWeek == null ? '—' : `${data.expRWeek >= 0 ? '+' : ''}${data.expRWeek.toFixed(2)}R`} sub={rangeLabel(range)} tone={data.expRWeek == null ? undefined : data.expRWeek >= 0 ? 'pos' : 'neg'} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
        <div className="grid">
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14} /> Today's plan</div>
            {(() => {
              const todayPlan = plans.find((p) => p.date === today)
              if (!todayPlan) return <div className="dim" style={{ fontSize: 12 }}>No plan set for today. Set one on the Plan tab before you trade.</div>
              const maxLoss = todayPlan.maxLossDollars
              const breached = maxLoss != null && maxLoss !== '' && data.todayPnl <= -Math.abs(Number(maxLoss))
              return (
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  {todayPlan.bias && <span className="pill neutral" style={{ marginRight: 6 }}>{todayPlan.bias}</span>}
                  {todayPlan.lookingFor && <div style={{ marginTop: 6 }}><strong className="dim">Hunting:</strong> {todayPlan.lookingFor}</div>}
                  {todayPlan.avoiding && <div style={{ marginTop: 4 }}><strong className="dim">Avoiding:</strong> {todayPlan.avoiding}</div>}
                  {maxLoss != null && maxLoss !== '' && (
                    <div className={`num ${breached ? 'neg' : ''}`} style={{ marginTop: 6, fontSize: 12 }}>
                      Daily max loss {fmtMoney(-Math.abs(Number(maxLoss)))} · {breached ? 'BREACHED — stop trading' : `${fmtMoney(data.todayPnl, { sign: true })} so far`}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          <div className="card">
            <div className="card-title">P/L by strategy · {rangeLabel(range)}</div>
            {data.strategies.length === 0 ? <div className="dim" style={{ fontSize: 12 }}>No trades in this period.</div> :
              data.strategies.map(([name, val]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 120, fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                  <div style={{ flex: 1 }}><Bar value={val} max={data.stratMax} negative={val < 0} /></div>
                  <div className={`num ${val >= 0 ? 'pos' : 'neg'}`} style={{ width: 72, textAlign: 'right', fontSize: 12.5 }}>{fmtMoney(val, { sign: true, cents: false })}</div>
                </div>
              ))}
          </div>

          <div className="card">
            <div className="card-title">Today's trades</div>
            {data.todays.length === 0 ? (
              <Empty icon={<NotebookPen size={26} />} title="Nothing logged today">
                When you’re done trading, log the day — like a glass of water before bed.<br />
                <button className="btn primary" style={{ marginTop: 12 }} onClick={onNewTrade}>Log today's trades</button>
              </Empty>
            ) : data.todays.map(({ t, net }) => (
              <div key={t.id} className="between" style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div>
                  <span className="num" style={{ fontWeight: 600 }}>{t.instrumentSymbol}</span>{' '}
                  <span className={`pill ${t.direction === 'long' ? 'win' : 'loss'}`} style={{ fontSize: 10 }}>{t.direction}</span>
                  <div className="dim" style={{ fontSize: 11 }}>{t.strategy || 'Untagged'} · {t.quantity} {t.instrumentKind === 'option' ? 'contracts' : 'cts'} · {accountsById[t.accountId]?.name}</div>
                </div>
                <span className={`num ${net >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(net, { sign: true })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Most expensive mistakes</div>
          {data.mistakes.length === 0 ? <div className="dim" style={{ fontSize: 12 }}>No tagged mistakes yet. Tag them on losing trades to see what costs you most.</div> :
            data.mistakes.map(([name, val]) => (
              <div key={name} style={{ marginBottom: 10 }}>
                <div className="between" style={{ fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-2)' }}>{name}</span>
                  <span className="num neg" style={{ fontWeight: 600 }}>{fmtMoney(val, { cents: false })}</span>
                </div>
                <Bar value={val} max={data.mistakeMax} negative />
              </div>
            ))}
        </div>
      </div>
    </>
  )
}
