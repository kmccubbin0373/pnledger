import { useState, useMemo } from 'react'
import { NotebookPen, Trash2, Image as ImageIcon, Filter, Save, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Empty } from '../components/ui'
import TradeForm from '../components/TradeForm'
import db from '../db/db'
import { computePnl, avgExitPrice, rMultiple, resolveInstrument } from '../lib/pnl'
import { fmtMoney } from '../lib/format'
import { TIME_BUCKET_ORDER, bucketForTime } from '../lib/buckets'

const BLANK = {
  account: 'all', strategy: 'all', direction: 'all', kind: 'all', result: 'all',
  grade: 'all', rule: 'all', symbol: '', from: '', to: '', bucket: 'all', minR: '', maxR: '',
}

export default function Trades() {
  const { trades, accounts, accountsById, instrumentsBySymbol, strategies, ruleItems, savedViews } = useApp()
  const [edit, setEdit] = useState(null)
  const [f, setF] = useState(BLANK)
  const [showFilters, setShowFilters] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const ruleFollowedFor = (t) => {
    if (!ruleItems.length) return null
    let answered = 0, followed = 0
    ruleItems.forEach((ri) => { const v = t.rulesChecked?.[ri.id]; if (v === true || v === false) { answered++; if (v) followed++ } })
    if (!answered) return null
    return followed === answered // true = all followed
  }

  const rows = useMemo(() => {
    let list = trades.map((t) => {
      const inst = resolveInstrument(t, instrumentsBySymbol)
      return {
        t,
        pnl: computePnl(t, accountsById[t.accountId], instrumentsBySymbol),
        r: rMultiple(t, accountsById[t.accountId], inst),
      }
    })
    if (f.account !== 'all') list = list.filter((r) => r.t.accountId === Number(f.account))
    if (f.strategy !== 'all') list = list.filter((r) => (r.t.strategy || '') === (f.strategy === '__none' ? '' : f.strategy))
    if (f.direction !== 'all') list = list.filter((r) => (r.t.direction || 'long') === f.direction)
    if (f.kind !== 'all') list = list.filter((r) => (r.t.instrumentKind || 'future') === f.kind)
    if (f.result === 'win') list = list.filter((r) => r.pnl.net > 0)
    else if (f.result === 'loss') list = list.filter((r) => r.pnl.net < 0)
    else if (f.result === 'be') list = list.filter((r) => r.pnl.net === 0)
    if (f.grade !== 'all') list = list.filter((r) => (r.t.grade || '') === (f.grade === '__none' ? '' : f.grade))
    if (f.rule === 'yes') list = list.filter((r) => ruleFollowedFor(r.t) === true)
    else if (f.rule === 'no') list = list.filter((r) => ruleFollowedFor(r.t) === false)
    if (f.symbol.trim()) { const q = f.symbol.trim().toUpperCase(); list = list.filter((r) => (r.t.instrumentSymbol || '').includes(q)) }
    if (f.from) list = list.filter((r) => (r.t.date || '') >= f.from)
    if (f.to) list = list.filter((r) => (r.t.date || '') <= f.to)
    if (f.bucket !== 'all') list = list.filter((r) => bucketForTime(r.t.entryTime) === f.bucket)
    if (f.minR !== '') list = list.filter((r) => r.r != null && r.r >= Number(f.minR))
    if (f.maxR !== '') list = list.filter((r) => r.r != null && r.r <= Number(f.maxR))
    return list.sort((a, b) => (b.t.date || '').localeCompare(a.t.date || '') || (b.t.createdAt || 0) - (a.t.createdAt || 0))
  }, [trades, accountsById, instrumentsBySymbol, ruleItems, f])

  const activeCount = Object.keys(BLANK).filter((k) => f[k] !== BLANK[k]).length

  const saveView = async () => {
    const name = prompt('Name this view (e.g. "A+ longs, mornings")')
    if (!name?.trim()) return
    await db.savedViews.add({ name: name.trim(), filters: { ...f }, createdAt: Date.now() })
  }
  const loadView = (v) => { setF({ ...BLANK, ...v.filters }); setShowFilters(true) }
  const deleteView = async (id, e) => { e.stopPropagation(); if (confirm('Delete this saved view?')) await db.savedViews.delete(id) }

  const del = async (id, e) => {
    e.stopPropagation()
    if (confirm('Delete this trade? This cannot be undone.')) await db.trades.delete(id)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Trade log</h1>
          <p className="page-sub">{rows.length} trade{rows.length !== 1 ? 's' : ''} shown{activeCount ? ` · ${activeCount} filter${activeCount > 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => setShowFilters((v) => !v)}>
            <Filter size={14} /> Filters {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {activeCount > 0 && <button className="btn ghost sm" onClick={() => setF(BLANK)}><X size={14} /> Clear</button>}
          <button className="btn ghost sm" onClick={saveView}><Save size={14} /> Save view</button>
        </div>
      </div>

      {savedViews.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {savedViews.map((v) => (
            <span key={v.id} className="tag clickable" onClick={() => loadView(v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {v.name}
              <button className="icon-btn" onClick={(e) => deleteView(v.id, e)} aria-label="Delete view" style={{ padding: 0 }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div className="field"><label>Account</label>
              <select value={f.account} onChange={set('account')}>
                <option value="all">All accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Strategy</label>
              <select value={f.strategy} onChange={set('strategy')}>
                <option value="all">All</option><option value="__none">Untagged</option>
                {strategies.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Direction</label>
              <select value={f.direction} onChange={set('direction')}>
                <option value="all">Both</option><option value="long">Long</option><option value="short">Short</option>
              </select>
            </div>
            <div className="field"><label>Type</label>
              <select value={f.kind} onChange={set('kind')}>
                <option value="all">All</option><option value="future">Futures</option><option value="option">Options</option>
              </select>
            </div>
            <div className="field"><label>Result</label>
              <select value={f.result} onChange={set('result')}>
                <option value="all">Win &amp; loss</option><option value="win">Winners</option><option value="loss">Losers</option><option value="be">Breakeven</option>
              </select>
            </div>
            <div className="field"><label>Grade</label>
              <select value={f.grade} onChange={set('grade')}>
                <option value="all">Any</option>
                {['A+', 'B', 'C', 'D'].map((g) => <option key={g} value={g}>{g}</option>)}
                <option value="__none">Ungraded</option>
              </select>
            </div>
            <div className="field"><label>Rules</label>
              <select value={f.rule} onChange={set('rule')}>
                <option value="all">Any</option><option value="yes">All followed</option><option value="no">Some broken</option>
              </select>
            </div>
            <div className="field"><label>Time of day</label>
              <select value={f.bucket} onChange={set('bucket')}>
                <option value="all">Any</option>
                {TIME_BUCKET_ORDER.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="field"><label>Symbol contains</label>
              <input value={f.symbol} onChange={set('symbol')} placeholder="e.g. MNQ" />
            </div>
            <div className="field"><label>From date</label><input type="date" value={f.from} onChange={set('from')} /></div>
            <div className="field"><label>To date</label><input type="date" value={f.to} onChange={set('to')} /></div>
            <div className="field"><label>Min R</label><input type="number" step="any" value={f.minR} onChange={set('minR')} placeholder="e.g. 1" /></div>
            <div className="field"><label>Max R</label><input type="number" step="any" value={f.maxR} onChange={set('maxR')} placeholder="e.g. 3" /></div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon={<NotebookPen size={30} />} title="No trades match">
            {activeCount ? 'Loosen or clear the filters above.' : 'Hit “New trade” to log your first one, or import a CSV from the Import tab.'}
          </Empty>
        </div>
      ) : (
        <div className="card flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Account</th><th>Instrument</th><th>Dir</th><th>Strategy</th>
                <th>Grade</th><th className="r">Qty</th><th className="r">Entry</th><th className="r">Avg exit</th><th className="r">R</th><th className="r">Net P/L</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, pnl, r }) => (
                <tr key={t.id} className="click" onClick={() => setEdit(t)}>
                  <td className="num">{t.date}</td>
                  <td className="muted">{accountsById[t.accountId]?.name || '—'}</td>
                  <td>
                    <span className="num" style={{ fontWeight: 600 }}>{t.instrumentSymbol}</span>
                    {t.instrumentKind === 'option' && <span className="dim" style={{ fontSize: 11 }}> {t.optionType}{t.strike ? ` ${t.strike}` : ''}</span>}
                  </td>
                  <td><span className={`pill ${t.direction === 'long' ? 'win' : 'loss'}`} style={{ fontSize: 10 }}>{t.direction}</span></td>
                  <td className="muted">{t.strategy || '—'}</td>
                  <td>{t.grade ? <span className="pill neutral" style={{ fontSize: 10 }}>{t.grade}</span> : <span className="dim">—</span>}</td>
                  <td className="num r">{t.quantity}</td>
                  <td className="num r">{t.entryPrice}</td>
                  <td className="num r">{avgExitPrice(t) != null ? Number(avgExitPrice(t)).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</td>
                  <td className={`num r ${r == null ? 'dim' : r >= 0 ? 'pos' : 'neg'}`}>{r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}R`}</td>
                  <td className={`num r ${pnl.net >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(pnl.net, { sign: true })}</td>
                  <td className="r">
                    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                      {t.screenshots?.length > 0 && <ImageIcon size={13} className="dim" />}
                      <button className="icon-btn" onClick={(e) => del(t.id, e)} aria-label="Delete"><Trash2 size={14} /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && <TradeForm trade={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
