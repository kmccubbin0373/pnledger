import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useApp } from '../context/AppContext'
import { computePnl } from '../lib/pnl'
import { fmtMoney } from '../lib/format'

export default function JournalInsights() {
  const { recaps, recapFields, scopedTrades, accountsById, instrumentsBySymbol } = useApp()

  const netByDate = useMemo(() => {
    const m = {}
    for (const t of scopedTrades) m[t.date] = (m[t.date] || 0) + computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net
    return m
  }, [scopedTrades, accountsById, instrumentsBySymbol])

  const recapsByDate = useMemo(() => [...recaps].sort((a, b) => (a.date || '').localeCompare(b.date || '')), [recaps])

  // numeric/rating trends
  const numericFields = recapFields.filter((f) => (f.type === 'number' || f.type === 'rating') && !f.archived)
  const numeric = numericFields.map((f) => {
    const pts = recapsByDate.filter((r) => r.fields?.[f.key] != null && r.fields[f.key] !== '')
      .map((r) => ({ date: r.date.slice(5), v: Number(r.fields[f.key]) }))
    const avg = pts.length ? pts.reduce((s, p) => s + p.v, 0) / pts.length : null
    return { f, pts, avg }
  }).filter((x) => x.pts.length >= 2)

  // yes/no frequencies
  const yesnoFields = recapFields.filter((f) => f.type === 'yesno' && !f.archived)
  const yesno = yesnoFields.map((f) => {
    const answered = recapsByDate.filter((r) => r.fields?.[f.key] === 'Yes' || r.fields?.[f.key] === 'No')
    const yes = answered.filter((r) => r.fields[f.key] === 'Yes').length
    return { f, yes, n: answered.length }
  }).filter((x) => x.n > 0)

  // select grouping vs daily P&L
  const selectFields = recapFields.filter((f) => f.type === 'select' && !f.archived)
  const selects = selectFields.map((f) => {
    const groups = {}
    for (const r of recapsByDate) {
      const v = r.fields?.[f.key]; if (!v) continue
      const net = netByDate[r.date] || 0
      if (!groups[v]) groups[v] = { net: 0, days: 0 }
      groups[v].net += net; groups[v].days += 1
    }
    const rows = Object.entries(groups).sort((a, b) => b[1].net - a[1].net)
    return { f, rows }
  }).filter((x) => x.rows.length >= 2)

  if (!numeric.length && !yesno.length && !selects.length) {
    return <div className="card"><div className="card-title">Journal insights</div><div className="dim" style={{ fontSize: 12 }}>Fill in numeric, yes/no, or dropdown recap fields over several days and trends will show here.</div></div>
  }

  return (
    <>
      {numeric.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {numeric.map(({ f, pts, avg }) => (
            <div key={f.key} className="card">
              <div className="card-title">{f.label} <span className="dim" style={{ fontWeight: 400 }}>· avg {avg.toFixed(1)}{f.unit ? ` ${f.unit}` : ''}</span></div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={pts} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip />
                  <Line type="monotone" dataKey="v" stroke="var(--blue)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {yesno.length > 0 && (
        <div className="card">
          <div className="card-title">Discipline checks</div>
          {yesno.map(({ f, yes, n }) => {
            const pct = Math.round((yes / n) * 100)
            return (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <div style={{ width: 220, fontSize: 12.5, color: 'var(--text-2)' }}>{f.label}</div>
                <div style={{ flex: 1, height: 12, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--blue)' }} />
                </div>
                <div style={{ width: 90, fontSize: 12, textAlign: 'right' }}>Yes on {yes}/{n} days</div>
              </div>
            )
          })}
        </div>
      )}

      {selects.map(({ f, rows }) => (
        <div key={f.key} className="card">
          <div className="card-title">P/L by {f.label.toLowerCase()}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-3)' }}>{f.label}</th><th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-3)' }}>Days</th><th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-3)' }}>Net P/L</th></tr></thead>
            <tbody>
              {rows.map(([val, d]) => (
                <tr key={val}><td style={{ padding: '4px 6px' }}>{val}</td><td style={{ padding: '4px 6px', textAlign: 'right' }}>{d.days}</td><td className={`num ${d.net >= 0 ? 'pos' : 'neg'}`} style={{ padding: '4px 6px', textAlign: 'right' }}>{fmtMoney(d.net, { sign: true })}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
