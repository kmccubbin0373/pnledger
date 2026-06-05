import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar as RBar, Cell, CartesianGrid } from 'recharts'
import { useApp } from '../context/AppContext'
import { Stat, ScopeBar, Empty } from '../components/ui'
import { computePnl } from '../lib/pnl'
import { fmtMoney, fmtPct, fmtNum } from '../lib/format'
import { TrendingUp } from 'lucide-react'

const TIME_BUCKETS = [
  { label: '9:30–10', from: '09:30', to: '10:00' },
  { label: '10–11', from: '10:00', to: '11:00' },
  { label: '11–12', from: '11:00', to: '12:00' },
  { label: '12–2:30', from: '12:00', to: '14:30' },
  { label: 'PM', from: '14:30', to: '16:00' },
  { label: 'Globex', from: '16:00', to: '09:30' },
]
const bucketFor = (time) => {
  if (!time) return 'Untimed'
  for (const b of TIME_BUCKETS.slice(0, 5)) if (time >= b.from && time < b.to) return b.label
  return 'Globex'
}

export default function Analytics() {
  const { scopedTrades, accountsById, instrumentsBySymbol } = useApp()

  const a = useMemo(() => {
    const rows = scopedTrades
      .map((t) => ({ t, net: computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net }))
      .sort((x, y) => (x.t.date || '').localeCompare(y.t.date || '') || (x.t.createdAt || 0) - (y.t.createdAt || 0))

    const total = rows.reduce((s, r) => s + r.net, 0)
    const wins = rows.filter((r) => r.net > 0)
    const losses = rows.filter((r) => r.net < 0)
    const grossWin = wins.reduce((s, r) => s + r.net, 0)
    const grossLoss = Math.abs(losses.reduce((s, r) => s + r.net, 0))
    const pf = grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss
    const winRate = rows.length ? (wins.length / rows.length) * 100 : 0
    const avgWin = wins.length ? grossWin / wins.length : 0
    const avgLoss = losses.length ? grossLoss / losses.length : 0

    let cum = 0
    const equity = rows.map((r, i) => { cum += r.net; return { i: i + 1, date: r.t.date, equity: Math.round(cum * 100) / 100 } })

    const byStrat = {}
    rows.forEach((r) => { const k = r.t.strategy || 'Untagged'; byStrat[k] = (byStrat[k] || 0) + r.net })
    const strategies = Object.entries(byStrat).map(([name, value]) => ({ name, value: Math.round(value) })).sort((x, y) => y.value - x.value)

    const byTime = {}
    rows.forEach((r) => { const k = bucketFor(r.t.entryTime); (byTime[k] ||= { net: 0, n: 0, w: 0 }); byTime[k].net += r.net; byTime[k].n++; if (r.net > 0) byTime[k].w++ })
    const times = ['9:30–10', '10–11', '11–12', '12–2:30', 'PM', 'Globex', 'Untimed']
      .filter((k) => byTime[k]).map((k) => ({ name: k, value: Math.round(byTime[k].net), n: byTime[k].n, win: Math.round((byTime[k].w / byTime[k].n) * 100) }))

    const byGrade = {}
    rows.forEach((r) => { const k = r.t.grade || 'Ungraded'; (byGrade[k] ||= 0); byGrade[k] += r.net })
    const grades = ['A+', 'B', 'C', 'D', 'Ungraded'].filter((g) => byGrade[g] != null).map((g) => ({ name: g, value: Math.round(byGrade[g]) }))

    return { rows, total, winRate, pf, avgWin, avgLoss, equity, strategies, times, grades, count: rows.length }
  }, [scopedTrades, accountsById, instrumentsBySymbol])

  if (a.count === 0) {
    return (
      <>
        <div className="page-head"><div><h1 className="page-title">Analytics</h1><p className="page-sub">Edge, discipline, and timing.</p></div><ScopeBar /></div>
        <div className="card"><Empty icon={<TrendingUp size={30} />} title="No data yet">Log a few trades and your curves and breakdowns will show up here.</Empty></div>
      </>
    )
  }

  return (
    <>
      <div className="page-head"><div><h1 className="page-title">Analytics</h1><p className="page-sub">{a.count} trades analyzed</p></div><ScopeBar /></div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14 }}>
        <Stat label="Net P/L" value={fmtMoney(a.total, { sign: true, cents: false })} tone={a.total >= 0 ? 'pos' : 'neg'} />
        <Stat label="Win rate" value={fmtPct(a.winRate)} />
        <Stat label="Profit factor" value={a.pf === Infinity ? '∞' : fmtNum(a.pf, 2)} tone={a.pf >= 1 ? 'pos' : 'neg'} />
        <Stat label="Avg win" value={fmtMoney(a.avgWin, { cents: false })} tone="pos" />
        <Stat label="Avg loss" value={fmtMoney(-a.avgLoss, { cents: false })} tone="neg" />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-title">Equity curve (cumulative net P/L)</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={a.equity} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="i" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
            <Tooltip formatter={(v) => fmtMoney(v)} labelFormatter={(l) => `Trade #${l}`}
              contentStyle={{ borderRadius: 8, border: '0.5px solid var(--border-strong)', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text)' }} />
            <Line type="monotone" dataKey="equity" stroke="var(--blue)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="card-title">P/L by time of day</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={a.times} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: 'var(--text-3)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v, n, p) => [fmtMoney(v), `${p.payload.n} trades · ${p.payload.win}% win`]}
                contentStyle={{ borderRadius: 8, border: '0.5px solid var(--border-strong)', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text)' }} />
              <RBar dataKey="value" radius={[3, 3, 0, 0]}>
                {a.times.map((e, i) => <Cell key={i} fill={e.value >= 0 ? 'var(--green)' : 'var(--red)'} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">P/L by setup grade</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={a.grades} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => fmtMoney(v)}
                contentStyle={{ borderRadius: 8, border: '0.5px solid var(--border-strong)', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text)' }} />
              <RBar dataKey="value" radius={[3, 3, 0, 0]}>
                {a.grades.map((e, i) => <Cell key={i} fill={e.value >= 0 ? 'var(--green)' : 'var(--red)'} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">P/L by strategy</div>
        <table className="tbl">
          <thead><tr><th>Strategy</th><th className="r">Net P/L</th></tr></thead>
          <tbody>
            {a.strategies.map((s) => (
              <tr key={s.name}><td>{s.name}</td><td className={`num r ${s.value >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(s.value, { sign: true, cents: false })}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
