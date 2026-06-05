import { useState } from 'react'
import { Upload, FileSpreadsheet, ArrowRight, Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Empty } from '../components/ui'
import db from '../db/db'
import { parseCSV, toObjects, guessMapping, recordsToTrades, TARGET_FIELDS, BROKER_PRESETS, parseTradovateFills, parseOptionsCSV, isOptionsCSV } from '../lib/csv'
import { computePnl } from '../lib/pnl'
import { fmtMoney } from '../lib/format'

// Detect whether a CSV is a Tradovate fills export by checking for its
// characteristic column headers.
function isTradovateFillsFormat(headers) {
  const h = headers.map((x) => x.trim().toLowerCase())
  return h.includes('b/s') && h.includes('contract') && h.includes('commission')
}

export default function ImportPage() {
  const { accounts, instrumentsBySymbol, accountsById } = useApp()
  const active = accounts.filter((a) => a.status !== 'archived')
  const [step, setStep] = useState(1)
  const [preset, setPreset] = useState('Tradovate')
  const [accountId, setAccountId] = useState(active[0]?.id || '')
  const [headers, setHeaders] = useState([])
  const [records, setRecords] = useState([])
  const [mapping, setMapping] = useState({})
  const [drafts, setDrafts] = useState([])
  const [done, setDone] = useState(0)
  const [isFillsFormat, setIsFillsFormat] = useState(false)
  const [isOptionsFormat, setIsOptionsFormat] = useState(false)

  const onFile = async (file) => {
    const text = await file.text()
    const { headers, records } = toObjects(parseCSV(text))

    if (isTradovateFillsFormat(headers)) {
      const parsed = parseTradovateFills(text)
      setDrafts(parsed.filter((t) => t.instrumentSymbol && t.entryPrice))
      setIsFillsFormat(true)
      setIsOptionsFormat(false)
      setStep(3)
    } else if (isOptionsCSV(headers)) {
      // Options CSV detected — use the dedicated options parser.
      const parsed = parseOptionsCSV(text)
      setDrafts(parsed.filter((t) => t.instrumentSymbol && t.entryPrice > 0))
      setIsFillsFormat(false)
      setIsOptionsFormat(true)
      setStep(3)
    } else {
      setHeaders(headers)
      setRecords(records)
      setMapping(guessMapping(headers, preset))
      setIsFillsFormat(false)
      setIsOptionsFormat(false)
      setStep(2)
    }
  }

  const buildPreview = () => {
    setDrafts(recordsToTrades(records, mapping).filter((t) => t.instrumentSymbol && t.entryPrice))
    setStep(3)
  }

  const doImport = async () => {
    let n = 0
    for (const d of drafts) {
      await db.trades.add({
        accountId: Number(accountId),
        instrumentKind: d.instrumentKind || 'future',
        instrumentSymbol: d.instrumentSymbol,
        direction: d.direction,
        strategy: d.strategy || null,
        date: d.date,
        entryTime: d.entryTime || null,
        entryPrice: d.entryPrice,
        quantity: d.quantity,
        stopPrice: null,
        optionType: d.optionType || null,
        strike: d.strike || null,
        expiry: d.expiry || null,
        exits: d.exits,
        grade: null,
        rulesChecked: {},
        mistakes: [],
        notes: '',
        screenshots: [],
        imported: true,
        createdAt: Date.now() + n,
      })
      n++
    }
    setDone(n); setStep(4)
  }

  const reset = () => {
    setStep(1)
    setHeaders([])
    setRecords([])
    setDrafts([])
    setDone(0)
    setIsFillsFormat(false)
    setIsOptionsFormat(false)
  }

  if (active.length === 0) {
    return (
      <>
        <div className="page-head"><div><h1 className="page-title">Import trades</h1></div></div>
        <div className="card"><Empty icon={<FileSpreadsheet size={30} />} title="Add an account first">Imports get attached to an account. Create one on the Accounts tab, then come back.</Empty></div>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Import trades</h1>
          <p className="page-sub">Upload a broker CSV. Tradovate fills exports are auto-detected and grouped into complete trades automatically.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 860 }}>
        <div className="row" style={{ gap: 8, marginBottom: 16, fontSize: 12 }}>
          {['Upload', 'Map columns', 'Review', 'Done'].map((s, i) => (
            <span key={s} className={`pill ${step >= i + 1 ? 'funded' : 'neutral'}`}>{i + 1}. {s}</span>
          ))}
        </div>

        {step === 1 && (
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label>Broker / format</label>
              <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                {Object.keys(BROKER_PRESETS).map((b) => <option key={b}>{b}</option>)}
              </select>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 6 }}>
                Tradovate fills exports are auto-detected and skip straight to preview — no column mapping needed.
              </div>
            </div>
            <div className="field">
              <label>Import into account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="dropzone" style={{ display: 'block' }}>
                <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
                <Upload size={22} style={{ opacity: 0.6 }} />
                <div style={{ fontSize: 13, marginTop: 6 }}>Click to choose a CSV file</div>
                <div style={{ fontSize: 11 }}>Exported from {preset}</div>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            <p className="dim" style={{ fontSize: 12.5, marginTop: 0 }}>Found {records.length} rows. Match your CSV columns to the journal fields.</p>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {TARGET_FIELDS.map((tf) => (
                <div className="field" key={tf.key}>
                  <label>{tf.label}{tf.required && <span className="neg"> *</span>}</label>
                  <select value={mapping[tf.key] || ''} onChange={(e) => setMapping((m) => ({ ...m, [tf.key]: e.target.value }))}>
                    <option value="">— not in my file —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={reset}>Back</button>
              <button className="btn primary" onClick={buildPreview} disabled={!mapping.date || !mapping.instrumentSymbol || !mapping.entryPrice}>
                Preview <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="dim" style={{ fontSize: 12.5, marginTop: 0 }}>
              {isFillsFormat && (
                <span className="pill funded" style={{ marginRight: 8 }}>
                  Tradovate fills auto-detected
                </span>
              )}
              {isOptionsFormat && (
                <span className="pill live" style={{ marginRight: 8 }}>
                  Options trades auto-detected
                </span>
              )}
              {drafts.length} trades ready to import into{' '}
              <strong>{accountsById[Number(accountId)]?.name}</strong>.
              {isFillsFormat && ' Fills have been grouped into complete trades.'}
              {isOptionsFormat &&
                ' Premiums are stored per share — P&L will calculate as (exit − entry) × 100 × contracts.'}
            </p>
            <div style={{ maxHeight: 380, overflow: 'auto', border: '0.5px solid var(--border)', borderRadius: 8 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th><th>Symbol</th><th>Dir</th>
                    <th className="r">Qty</th><th className="r">Entry</th>
                    <th>Exits</th><th className="r">Est. net P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.slice(0, 200).map((d, i) => {
                    const pnl = computePnl({ ...d, instrumentKind: 'future' }, accountsById[Number(accountId)], instrumentsBySymbol)
                    const exitSummary = d.exits.length
                      ? d.exits.map((e) => `${e.qty}@${e.price}`).join(', ')
                      : '—'
                    return (
                      <tr key={i}>
                        <td className="num">{d.date || '—'}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{d.instrumentSymbol}</td>
                        <td><span className={`pill ${d.direction === 'long' ? 'win' : 'loss'}`} style={{ fontSize: 10 }}>{d.direction}</span></td>
                        <td className="num r">{d.quantity}</td>
                        <td className="num r">{d.entryPrice}</td>
                        <td className="num" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{exitSummary}</td>
                        <td className={`num r ${pnl.net >= 0 ? 'pos' : 'neg'}`}>
                          {d.exits.length ? fmtMoney(pnl.net, { sign: true, cents: false }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => (isFillsFormat || isOptionsFormat) ? reset() : setStep(2)}>Back</button>
              <button className="btn primary" onClick={doImport} disabled={!drafts.length}>Import {drafts.length} trades</button>
            </div>
          </>
        )}

        {step === 4 && (
          <Empty icon={<Check size={30} />} title={`Imported ${done} trades`}>
            They're in your trade log now. Add strategy tags, grades, and screenshots when you review them.<br />
            <button className="btn primary" style={{ marginTop: 12 }} onClick={reset}>Import another file</button>
          </Empty>
        )}
      </div>
    </>
  )
}
