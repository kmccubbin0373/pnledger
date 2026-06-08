import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar as RBar, Cell, CartesianGrid } from 'recharts'
import { useApp } from '../context/AppContext'
import { Stat, ScopeBar, Empty } from '../components/ui'
import { computePnl, rMultiple, exitEfficiency, expectancyR, maxDrawdown } from '../lib/pnl'
import { fmtMoney, fmtPct, fmtNum } from '../lib/format'
import { TrendingUp } from 'lucide-react'
import { TIME_BUCKET_ORDER, bucketForTime } from '../lib/buckets'

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
    rows.forEach((r) => { const k = bucketForTime(r.t.entryTime); (byTime[k] ||= { net: 0, n: 0, w: 0 }); byTime[k].net += r.net; byTime[k].n++; if (r.net > 0) byTime[k].w++ })
    const times = TIME_BUCKET_ORDER
      .filter((k) => byTime[k]).map((k) => ({ name: k, value: Math.round(byTime[k].net), n: byTime[k].n, win: Math.round((byTime[k].w / byTime[k].n) * 100) }))

    const byGrade = {}
    rows.forEach((r) => { const k = r.t.grade || 'Ungraded'; (byGrade[k] ||= 0); byGrade[k] += r.net })
    const grades = ['A+', 'B', 'C', 'D', 'Ungraded'].filter((g) => byGrade[g] != null).map((g) => ({ name: g, value: Math.round(byGrade[g]) }))

    // R-multiples per trade (null when no stop)
    const rVals = rows.map((r) => rMultiple(r.t, accountsById[r.t.accountId], instrumentsBySymbol))
    const expR = expectancyR(rVals)
    const expDollar = rows.length ? total / rows.length : 0
    const maxDD = maxDrawdown(equity.map((e) => e.equity))

    // R distribution buckets
    const rBucketDefs = [
      { label: '≤ -2R', test: (r) => r <= -2 },
      { label: '-2…-1', test: (r) => r > -2 && r <= -1 },
      { label: '-1…0', test: (r) => r > -1 && r < 0 },
      { label: '0…1', test: (r) => r >= 0 && r < 1 },
      { label: '1…2', test: (r) => r >= 1 && r < 2 },
      { label: '2…3', test: (r) => r >= 2 && r < 3 },
      { label: '≥ 3R', test: (r) => r >= 3 },
    ]
    const rDist = rBucketDefs.map((b) => ({
      name: b.label,
      value: rVals.filter((r) => r != null && b.test(r)).length,
    }))

    // Day-of-week net
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const byDow = {}
    rows.forEach((r) => {
      if (!r.t.date) return
      const d = new Date(r.t.date + 'T00:00:00').getDay()
      ;(byDow[d] ||= { net: 0, n: 0 })
      byDow[d].net += r.net; byDow[d].n++
    })
    const dows = [1, 2, 3, 4, 5, 0, 6].filter((d) => byDow[d]).map((d) => ({ name: DOW[d], value: Math.round(byDow[d].net), n: byDow[d].n }))

    // Long vs short
    const dir = { long: { net: 0, n: 0, w: 0 }, short: { net: 0, n: 0, w: 0 } }
    rows.forEach((r) => {
      const k = r.t.direction === 'short' ? 'short' : 'long'
      dir[k].net += r.net; dir[k].n++; if (r.net > 0) dir[k].w++
    })
    const dirRows = ['long', 'short'].filter((k) => dir[k].n).map((k) => ({
      name: k === 'long' ? 'Long' : 'Short',
      value: Math.round(dir[k].net),
      win: Math.round((dir[k].w / dir[k].n) * 100),
      n: dir[k].n,
    }))

    // Avg exit efficiency across trades that recorded MFE
    const effVals = rows.map((r) => exitEfficiency(r.t).efficiency).filter((e) => e != null)
    const avgEff = effVals.length ? (effVals.reduce((s, e) => s + e, 0) / effVals.length) * 100 : null

    return {
      rows, total, winRate, pf, avgWin, avgLoss, equity, strategies, times, grades,
      count: rows.length, expR, expDollar, maxDD, rDist, dows, dirRows, avgEff,
    }
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
        <Stat label="Expectancy" value={fmtMoney(a.expDollar, { sign: true })} sub="per trade" tone={a.expDollar >= 0 ? 'pos' : 'neg'} />
        <Stat label="Expectancy (R)" value={a.expR == null ? '—' : `${a.expR >= 0 ? '+' : ''}${a.expR.toFixed(2)}R`} sub="needs stops" tone={a.expR == null ? undefined : a.expR >= 0 ? 'pos' : 'neg'} />
        <Stat label="Max drawdown" value={fmtMoney(-a.maxDD, { cents: false })} tone="neg" />
        <Stat label="Avg win" value={fmtMoney(a.avgWin, { cents: false })} tone="pos" />
        <Stat label="Avg loss" value={fmtMoney(-a.avgLoss, { cents: false })} tone="neg" />
        <Stat label="Exit efficiency" value={a.avgEff == null ? '—' : fmtPct(a.avgEff)} sub="of max move" />
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

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
        <div className="card">
          <div className="card-title">R-multiple distribution</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={a.rDist} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: 'var(--text-3)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v} trades`, 'Count']}
                contentStyle={{ borderRadius: 8, border: '0.5px solid var(--border-strong)', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text)' }} />
              <RBar dataKey="value" radius={[3, 3, 0, 0]}>
                {a.rDist.map((e, i) => <Cell key={i} fill={e.name.includes('-') && !e.name.includes('0…') ? 'var(--red)' : 'var(--green)'} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">P/L by day of week</div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={a.dows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v, n, p) => [fmtMoney(v), `${p.payload.n} trades`]}
                contentStyle={{ borderRadius: 8, border: '0.5px solid var(--border-strong)', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface)', color: 'var(--text)' }} />
              <RBar dataKey="value" radius={[3, 3, 0, 0]}>
                {a.dows.map((e, i) => <Cell key={i} fill={e.value >= 0 ? 'var(--green)' : 'var(--red)'} />)}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Long vs short</div>
        <table className="tbl">
          <thead><tr><th>Direction</th><th className="r">Trades</th><th className="r">Win rate</th><th className="r">Net P/L</th></tr></thead>
          <tbody>
            {a.dirRows.map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td className="num r">{d.n}</td>
                <td className="num r">{fmtPct(d.win)}</td>
                <td className={`num r ${d.value >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(d.value, { sign: true, cents: false })}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
