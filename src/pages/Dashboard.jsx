import { useMemo } from 'react'
import { TrendingUp, CalendarDays, ClipboardCheck, Flame, AlertCircle, NotebookPen } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Stat, ScopeBar, Empty, Bar } from '../components/ui'
import { computePnl } from '../lib/pnl'
import { fmtMoney, fmtPct, todayISO } from '../lib/format'

function startOfWeekISO() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard({ onNewTrade }) {
  const { scopedTrades, accountsById, instrumentsBySymbol, ruleItems, prefs } = useApp()
  const today = todayISO()
  const weekStart = startOfWeekISO()

  const data = useMemo(() => {
    const withPnl = scopedTrades.map((t) => ({ t, net: computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net }))
    const todays = withPnl.filter((r) => r.t.date === today)
    const week = withPnl.filter((r) => r.t.date >= weekStart)

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

    // rule following (week)
    let answered = 0, followed = 0
    week.forEach((r) => ruleItems.forEach((ri) => { const v = r.t.rulesChecked?.[ri.id]; if (v === true || v === false) { answered++; if (v) followed++ } }))

    return {
      todayPnl: sum(todays), todayCount: todays.length, todayWins: wins(todays),
      weekPnl: sum(week), weekCount: week.length, weekWinRate: winRate(week),
      strategies, stratMax, mistakes, mistakeMax, streak, streakType,
      ruleRate: answered ? (followed / answered) * 100 : null,
      todays: todays.sort((a, b) => (b.t.createdAt || 0) - (a.t.createdAt || 0)),
    }
  }, [scopedTrades, accountsById, instrumentsBySymbol, ruleItems, today, weekStart])

  const tradesLeft = Math.max(0, (prefs.maxTradesPerDay ?? 3) - data.todayCount)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <ScopeBar />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 14 }}>
        <Stat label="Today's P/L" icon={<TrendingUp size={13} />} value={fmtMoney(data.todayPnl, { sign: true })}
          tone={data.todayPnl >= 0 ? 'pos' : 'neg'} sub={`${data.todayCount} trade${data.todayCount !== 1 ? 's' : ''} · ${data.todayWins}W ${data.todayCount - data.todayWins}L`} />
        <Stat label="This week" icon={<CalendarDays size={13} />} value={fmtMoney(data.weekPnl, { sign: true })}
          tone={data.weekPnl >= 0 ? 'pos' : 'neg'} sub={`${data.weekCount} trades · ${fmtPct(data.weekWinRate)} win`} />
        <Stat label="Rule following" icon={<ClipboardCheck size={13} />} value={data.ruleRate == null ? '—' : fmtPct(data.ruleRate)} sub="this week" />
        <Stat label="Streak" icon={<Flame size={13} />} value={data.streak ? `${data.streak}${data.streakType ? 'W' : 'L'}` : '—'} sub={data.streak ? `current ${data.streakType ? 'win' : 'loss'} streak` : 'no trades'} />
        <Stat feature label="Trades left" icon={<AlertCircle size={13} />} value={tradesLeft} sub={`${prefs.maxTradesPerDay ?? 3} max · ${data.todayCount} used`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
        <div className="grid">
          <div className="card">
            <div className="card-title">P/L by strategy · this week</div>
            {data.strategies.length === 0 ? <div className="dim" style={{ fontSize: 12 }}>No trades this week.</div> :
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
