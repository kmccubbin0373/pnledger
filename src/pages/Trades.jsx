import { useState, useMemo } from 'react'
import { NotebookPen, Trash2, Image as ImageIcon, Filter } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Empty } from '../components/ui'
import TradeForm from '../components/TradeForm'
import db from '../db/db'
import { computePnl, avgExitPrice } from '../lib/pnl'
import { fmtMoney } from '../lib/format'

export default function Trades() {
  const { trades, accounts, accountsById, instrumentsBySymbol, strategies } = useApp()
  const [edit, setEdit] = useState(null)
  const [fAccount, setFAccount] = useState('all')
  const [fStrategy, setFStrategy] = useState('all')
  const [fResult, setFResult] = useState('all')

  const rows = useMemo(() => {
    let list = trades.map((t) => ({ t, pnl: computePnl(t, accountsById[t.accountId], instrumentsBySymbol) }))
    if (fAccount !== 'all') list = list.filter((r) => r.t.accountId === Number(fAccount))
    if (fStrategy !== 'all') list = list.filter((r) => r.t.strategy === fStrategy)
    if (fResult === 'win') list = list.filter((r) => r.pnl.net > 0)
    if (fResult === 'loss') list = list.filter((r) => r.pnl.net < 0)
    return list.sort((a, b) => (b.t.date || '').localeCompare(a.t.date || '') || (b.t.createdAt || 0) - (a.t.createdAt || 0))
  }, [trades, accountsById, instrumentsBySymbol, fAccount, fStrategy, fResult])

  const del = async (id, e) => {
    e.stopPropagation()
    if (confirm('Delete this trade? This cannot be undone.')) await db.trades.delete(id)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Trade log</h1>
          <p className="page-sub">{rows.length} trade{rows.length !== 1 ? 's' : ''} shown</p>
        </div>
        <div className="scope-bar">
          <Filter size={14} className="dim" style={{ alignSelf: 'center' }} />
          <select value={fAccount} onChange={(e) => setFAccount(e.target.value)}>
            <option value="all">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={fStrategy} onChange={(e) => setFStrategy(e.target.value)}>
            <option value="all">All strategies</option>
            {strategies.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <select value={fResult} onChange={(e) => setFResult(e.target.value)}>
            <option value="all">Win &amp; loss</option>
            <option value="win">Winners</option>
            <option value="loss">Losers</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon={<NotebookPen size={30} />} title="No trades logged yet">
            Hit “New trade” to log your first one, or import a CSV from the Import tab.
          </Empty>
        </div>
      ) : (
        <div className="card flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th><th>Account</th><th>Instrument</th><th>Dir</th><th>Strategy</th>
                <th>Grade</th><th className="r">Qty</th><th className="r">Entry</th><th className="r">Avg exit</th><th className="r">Net P/L</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, pnl }) => (
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
