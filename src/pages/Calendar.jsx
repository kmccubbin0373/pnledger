import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Banknote, Award, Skull, ShoppingCart, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { ScopeBar } from '../components/ui'
import { Modal } from '../components/ui'
import TradeForm from '../components/TradeForm'
import { computePnl } from '../lib/pnl'
import { fmtMoney, fmtMoneyShort, isoDate, MARKET_HOLIDAYS } from '../lib/format'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const EVENT_ICON = {
  payout: <Banknote size={11} />, passed: <Award size={11} />, blown: <Skull size={11} />, purchased: <ShoppingCart size={11} />,
}
const EVENT_COLOR = { payout: 'var(--green-d)', passed: 'var(--blue)', blown: 'var(--red-d)', purchased: 'var(--purple-d)' }

export default function Calendar() {
  const { scopedTrades, scopedAccountIds, events, accountsById, instrumentsBySymbol } = useApp()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [dayOpen, setDayOpen] = useState(null)
  const [weekOpen, setWeekOpen] = useState(null)

  const scopedEvents = useMemo(() => events.filter((e) => scopedAccountIds.has(e.accountId)), [events, scopedAccountIds])

  const byDay = useMemo(() => {
    const m = {}
    scopedTrades.forEach((t) => {
      const k = t.date
      if (!k) return
      ;(m[k] ||= { net: 0, count: 0, trades: [] })
      const net = computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net
      m[k].net += net; m[k].count++; m[k].trades.push({ t, net })
    })
    return m
  }, [scopedTrades, accountsById, instrumentsBySymbol])

  const eventsByDay = useMemo(() => {
    const m = {}
    scopedEvents.forEach((e) => { (m[e.date] ||= []).push(e) })
    return m
  }, [scopedEvents])

  const weeks = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startOffset = (first.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    // chunk into weeks of 7
    const rows = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [cursor])

  // Per-week totals (P&L + trade count) for the weekly summary column.
  const weekTotals = useMemo(() => {
    return weeks.map((row) => {
      let net = 0, count = 0
      row.forEach((d) => {
        if (!d) return
        const day = byDay[isoDate(d)]
        if (day) { net += day.net; count += day.count }
      })
      return { net, count }
    })
  }, [weeks, byDay])

  const monthStats = useMemo(() => {
    let net = 0, count = 0, green = 0, red = 0
    weeks.flat().forEach((d) => {
      if (!d) return
      const day = byDay[isoDate(d)]
      if (day) { net += day.net; count += day.count; if (day.net > 0) green++; else if (day.net < 0) red++ }
    })
    return { net, count, green, red }
  }, [weeks, byDay])

  const move = (delta) => setCursor((c) => {
    const m = c.m + delta
    return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
  })

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = isoDate(new Date())

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-sub">Click any day to see what you traded.</p>
        </div>
        <ScopeBar />
      </div>

      <div className="card flush">
        <div className="between" style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
            <div style={{ fontWeight: 600, fontSize: 15, minWidth: 150, textAlign: 'center' }}>{monthLabel}</div>
            <button className="icon-btn" onClick={() => move(1)}><ChevronRight size={18} /></button>
            <button className="btn ghost sm" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }) }}>Today</button>
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="dim" style={{ fontSize: 10.5 }}>Month P/L</div>
              <div className={`num ${monthStats.net >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(monthStats.net, { sign: true, cents: false })}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="dim" style={{ fontSize: 10.5 }}>Green / red days</div>
              <div className="num" style={{ fontWeight: 600 }}><span className="pos">{monthStats.green}</span> / <span className="neg">{monthStats.red}</span></div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr) 0.9fr' }}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="dim" style={{ fontSize: 11, textAlign: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', fontWeight: 500 }}>{w}</div>
          ))}
          <div className="dim" style={{ fontSize: 11, textAlign: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', borderLeft: '0.5px solid var(--border)', fontWeight: 500, background: 'var(--surface-2)' }}>Week</div>

          {weeks.map((row, wi) => (
            <Week
              key={wi}
              row={row}
              total={weekTotals[wi]}
              byDay={byDay}
              eventsByDay={eventsByDay}
              todayKey={todayKey}
              onDay={(k) => setDayOpen(k)}
              onWeek={() => weekTotals[wi].count && setWeekOpen({ weekIndex: wi, days: row })}
            />
          ))}
        </div>
      </div>

      {dayOpen && <DayDetail dateKey={dayOpen} day={byDay[dayOpen]} events={eventsByDay[dayOpen] || []} accountsById={accountsById} onClose={() => setDayOpen(null)} />}
      {weekOpen && <WeekDetail days={weekOpen.days} byDay={byDay} accountsById={accountsById} onClose={() => setWeekOpen(null)} onDay={(k) => { setWeekOpen(null); setDayOpen(k) }} />}
    </>
  )
}

function Week({ row, total, byDay, eventsByDay, todayKey, onDay, onWeek }) {
  return (
    <>
      {row.map((d, i) => {
        if (!d) return <div key={i} style={{ borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', background: 'var(--surface-2)', minHeight: 92 }} />
        const k = isoDate(d)
        const day = byDay[k]
        const evs = eventsByDay[k] || []
        const holiday = MARKET_HOLIDAYS[k]
        const isToday = k === todayKey
        const hasNet = day && day.count
        const bg = !hasNet ? 'var(--surface)' : day.net > 0 ? 'var(--green-bg)' : day.net < 0 ? 'var(--red-bg)' : 'var(--surface)'
        return (
          <div key={i}
            onClick={() => (hasNet || evs.length) && onDay(k)}
            style={{
              minHeight: 92, padding: '6px 8px', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)',
              background: bg, cursor: (hasNet || evs.length) ? 'pointer' : 'default', position: 'relative',
              boxShadow: isToday ? 'inset 0 0 0 2px var(--blue-2)' : 'none',
            }}>
            <div className="between">
              <span className="num" style={{ fontSize: 12, color: isToday ? 'var(--blue)' : 'var(--text-2)', fontWeight: isToday ? 700 : 500 }}>{d.getDate()}</span>
              <span style={{ display: 'flex', gap: 3 }}>
                {evs.map((e, j) => <span key={j} title={e.type} style={{ color: EVENT_COLOR[e.type] }}>{EVENT_ICON[e.type]}</span>)}
              </span>
            </div>
            {hasNet ? (
              <div style={{ position: 'absolute', bottom: 7, left: 8, right: 8 }}>
                <div className={`num ${day.net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 14, fontWeight: 700 }}>{fmtMoneyShort(day.net)}</div>
                <div className="dim" style={{ fontSize: 10.5 }}>{day.count} trade{day.count !== 1 ? 's' : ''}</div>
              </div>
            ) : holiday ? (
              <div className="dim" style={{ fontSize: 10, position: 'absolute', bottom: 7, left: 8, right: 8, lineHeight: 1.2 }}>{holiday}</div>
            ) : null}
          </div>
        )
      })}
      {/* weekly summary cell */}
      <div
        onClick={onWeek}
        style={{
          minHeight: 92, padding: '8px', borderBottom: '0.5px solid var(--border)', borderLeft: '0.5px solid var(--border)',
          background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end',
          cursor: total.count ? 'pointer' : 'default',
        }}>
        {total.count ? (
          <>
            <div className={`num ${total.net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 14, fontWeight: 700 }}>{fmtMoneyShort(total.net)}</div>
            <div className="dim" style={{ fontSize: 10.5 }}>{total.count} trade{total.count !== 1 ? 's' : ''}</div>
          </>
        ) : <span className="dim" style={{ fontSize: 11 }}>—</span>}
      </div>
    </>
  )
}

function WeekDetail({ days, byDay, accountsById, onClose, onDay }) {
  const valid = days.filter(Boolean)
  const start = valid[0], end = valid[valid.length - 1]
  const label = start && end
    ? `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Week'
  let net = 0, count = 0
  const rows = []
  valid.forEach((d) => {
    const k = isoDate(d)
    const day = byDay[k]
    if (day) { net += day.net; count += day.count; rows.push({ k, d, day }) }
  })
  return (
    <Modal title={label} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="between" style={{ marginBottom: 14 }}>
        <div>
          <div className="dim" style={{ fontSize: 11 }}>Week P/L</div>
          <div className={`num ${net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 22, fontWeight: 700 }}>{fmtMoney(net, { sign: true })}</div>
        </div>
        <div className="dim num">{count} trade{count !== 1 ? 's' : ''}</div>
      </div>
      {rows.length === 0 ? <div className="dim">No trades this week.</div> : (
        <table className="tbl">
          <thead><tr><th>Day</th><th className="r">Trades</th><th className="r">Net P/L</th></tr></thead>
          <tbody>
            {rows.map(({ k, d, day }) => (
              <tr key={k} className="click" onClick={() => onDay(k)}>
                <td>{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                <td className="num r">{day.count}</td>
                <td className={`num r ${day.net >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(day.net, { sign: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}

function DayDetail({ dateKey, day, events, accountsById, onClose }) {
  const [editTrade, setEditTrade] = useState(null)
  const label = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const net = day?.net || 0
  return (
    <>
      <Modal title={label} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
        <div className="between" style={{ marginBottom: 14 }}>
          <div>
            <div className="dim" style={{ fontSize: 11 }}>Day P/L</div>
            <div className={`num ${net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 22, fontWeight: 700 }}>{fmtMoney(net, { sign: true })}</div>
          </div>
          <div className="dim num">{day?.count || 0} trade{(day?.count || 0) !== 1 ? 's' : ''}</div>
        </div>

        {events.length > 0 && (
          <div className="tagwrap" style={{ marginBottom: 14 }}>
            {events.map((e, i) => (
              <span key={i} className="pill neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: EVENT_COLOR[e.type] }}>
                {EVENT_ICON[e.type]} {e.type}{e.amount ? ` ${fmtMoney(e.amount, { cents: false })}` : ''} · {accountsById[e.accountId]?.name}
              </span>
            ))}
          </div>
        )}

        {!day || !day.trades.length ? (
          <div className="dim" style={{ fontSize: 13 }}>No trades logged this day.</div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Instrument</th><th>Dir</th><th>Strategy</th><th>Account</th><th className="r">Net P/L</th></tr></thead>
            <tbody>
              {day.trades.sort((a, b) => (b.net) - (a.net)).map(({ t, net }) => (
                <tr key={t.id} className="click" onClick={() => setEditTrade(t)}>
                  <td><span className="num" style={{ fontWeight: 600 }}>{t.instrumentSymbol}</span></td>
                  <td><span className={`pill ${t.direction === 'long' ? 'win' : 'loss'}`} style={{ fontSize: 10 }}>{t.direction}</span></td>
                  <td className="muted">{t.strategy || '—'}</td>
                  <td className="muted">{accountsById[t.accountId]?.name || '—'}</td>
                  <td className={`num r ${net >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(net, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
      {editTrade && <TradeForm trade={editTrade} onClose={() => setEditTrade(null)} />}
    </>
  )
}
