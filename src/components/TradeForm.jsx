import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, X, Trash2, Image as ImageIcon, NotebookPen, Copy } from 'lucide-react'
import { Modal } from './ui'
import { useApp } from '../context/AppContext'
import db from '../db/db'
import { computePnl, resolveInstrument, totalExitQty, initialRisk } from '../lib/pnl'
import { fmtMoney, todayISO } from '../lib/format'
import ScreenshotTimeline from './ScreenshotTimeline'

const GRADES = ['A+', 'B', 'C', 'D']
const blankExit = () => ({ price: '', qty: '', time: '' })

export default function TradeForm({ trade, defaultAccountId, onClose }) {
  const { accounts, instruments, instrumentsBySymbol, strategies, ruleItems, mistakeTags } = useApp()
  const editing = !!trade?.id
  const activeAccounts = accounts.filter((a) => a.status !== 'archived')

  const [accountId, setAccountId] = useState(
    trade?.accountId || defaultAccountId || activeAccounts[0]?.id || ''
  )
  const [kind, setKind] = useState(trade?.instrumentKind || 'future')
  const [symbol, setSymbol] = useState(trade?.instrumentSymbol || '')
  const [direction, setDirection] = useState(trade?.direction || 'long')
  const [strategy, setStrategy] = useState(trade?.strategy || '')
  const [date, setDate] = useState(trade?.date || todayISO())
  const [entryTime, setEntryTime] = useState(trade?.entryTime || '')
  const [entryPrice, setEntryPrice] = useState(trade?.entryPrice ?? '')
  const [quantity, setQuantity] = useState(trade?.quantity ?? '')
  const [stopPrice, setStopPrice] = useState(trade?.stopPrice ?? '')
  const [mfe, setMfe] = useState(trade?.mfe ?? '')
  const [mae, setMae] = useState(trade?.mae ?? '')
  const [optionType, setOptionType] = useState(trade?.optionType || 'call')
  const [strike, setStrike] = useState(trade?.strike ?? '')
  const [expiry, setExpiry] = useState(trade?.expiry || '')
  const [exits, setExits] = useState(trade?.exits?.length ? trade.exits.map((e) => ({ ...e })) : [blankExit()])
  const [grade, setGrade] = useState(trade?.grade || '')
  const [rulesChecked, setRulesChecked] = useState(trade?.rulesChecked || {})
  const [mistakes, setMistakes] = useState(trade?.mistakes || [])
  const [notes, setNotes] = useState(trade?.notes || '')
  const [shots, setShots] = useState(trade?.screenshots || []) // [{name,type,blob}]
  const [copyTo, setCopyTo] = useState([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)

  const account = accounts.find((a) => a.id === Number(accountId))

  // Live P&L preview as the user types entry/exits.
  const draft = {
    instrumentKind: kind,
    instrumentSymbol: kind === 'option' ? symbol || 'OPT' : symbol,
    direction,
    entryPrice,
    quantity,
    stopPrice,
    exits: exits.map((e) => ({ price: e.price, qty: e.qty })),
  }
  const pnl = useMemo(() => computePnl(draft, account, instrumentsBySymbol), [draft, account, instrumentsBySymbol])
  const rPreview = useMemo(() => {
    const inst = resolveInstrument(draft, instrumentsBySymbol)
    const risk = initialRisk(draft, inst)
    if (!risk || risk <= 0) return null
    return pnl.net / risk
  }, [draft, instrumentsBySymbol, pnl.net])
  const exitQty = totalExitQty(draft)
  const qtyMismatch = Number(quantity) > 0 && exitQty > 0 && exitQty !== Number(quantity)

  const futuresList = instruments.filter((i) => i.kind === 'future')
  const suggestions = useMemo(() => {
    if (kind !== 'future') return []
    const q = symbol.toUpperCase()
    return futuresList
      .filter((i) => i.symbol.includes(q) || i.name.toUpperCase().includes(q))
      .slice(0, 8)
  }, [symbol, kind, futuresList])

  const updateExit = (i, patch) => setExits((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const addExit = () => setExits((xs) => [...xs, blankExit()])
  const removeExit = (i) => setExits((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : xs))

  const toggleRule = (id, val) => setRulesChecked((r) => ({ ...r, [id]: val }))
  const toggleMistake = (text) =>
    setMistakes((m) => (m.includes(text) ? m.filter((x) => x !== text) : [...m, text]))

  const handleFiles = async (fileList) => {
    const incoming = []
    for (const f of Array.from(fileList)) {
      if (!f.type.startsWith('image/')) continue
      const blob = await f.arrayBuffer().then((buf) => new Blob([buf], { type: f.type }))
      incoming.push({ name: f.name, type: f.type, blob, label: '' })
    }
    if (incoming.length) setShots((s) => [...s, ...incoming])
  }

  const removeShot = (i) => setShots((s) => s.filter((_, j) => j !== i))
  const labelShot = (i, label) => setShots((s) => s.map((x, j) => (j === i ? { ...x, label } : x)))

  const buildTrade = () => ({
    accountId: Number(accountId),
    instrumentKind: kind,
    instrumentSymbol: kind === 'option' ? (symbol || '').toUpperCase() : (symbol || '').toUpperCase(),
    direction,
    strategy: strategy || null,
    date,
    entryTime: entryTime || null,
    entryPrice: Number(entryPrice) || 0,
    quantity: Number(quantity) || 0,
    stopPrice: stopPrice === '' ? null : Number(stopPrice),
    mfe: mfe === '' ? null : Number(mfe),
    mae: mae === '' ? null : Number(mae),
    optionType: kind === 'option' ? optionType : null,
    strike: kind === 'option' && strike !== '' ? Number(strike) : null,
    expiry: kind === 'option' ? expiry || null : null,
    exits: exits
      .filter((e) => e.price !== '' && e.qty !== '')
      .map((e) => ({ price: Number(e.price), qty: Number(e.qty), time: e.time || null })),
    grade: grade || null,
    rulesChecked,
    mistakes,
    notes: notes || '',
    screenshots: shots,
    createdAt: trade?.createdAt || Date.now(),
  })

  const save = async () => {
    setErr('')
    if (!accountId) return setErr('Pick an account.')
    if (!symbol) return setErr(kind === 'option' ? 'Enter the underlying symbol.' : 'Pick an instrument.')
    if (!entryPrice || !quantity) return setErr('Entry price and quantity are required.')
    const payload = buildTrade()
    if (editing) {
      await db.trades.update(trade.id, payload)
    } else {
      await db.trades.add(payload)
      // Trade copier: duplicate the journal entry into each selected account.
      for (const accId of copyTo) {
        await db.trades.add({ ...payload, accountId: accId, copiedFromAccountId: Number(accountId) })
      }
    }
    onClose?.(true)
  }

  return (
    <Modal
      size="wide"
      title={editing ? 'Edit trade' : 'Log a trade'}
      icon={<Plus size={17} />}
      onClose={() => onClose?.(false)}
      footer={
        <>
          {err && <span className="neg" style={{ marginRight: 'auto', fontSize: 12 }}>{err}</span>}
          <button className="btn" onClick={() => onClose?.(false)}>Cancel</button>
          <button className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Save trade'}</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 22 }}>
        {/* ---------------- left: trade data ---------------- */}
        <div>
          <div className="section-label">Trade type</div>
          <div className="segmented" style={{ maxWidth: 320 }}>
            <button className={kind === 'future' ? 'sel' : ''} onClick={() => { setKind('future'); setSymbol('') }}>Futures</button>
            <button className={kind === 'option' ? 'sel' : ''} onClick={() => { setKind('option'); setSymbol('') }}>Stock / ETF option</button>
          </div>

          <div className="section-label">Details</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="field">
              <label>Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Select…</option>
                {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="field" style={{ position: 'relative' }}>
              <label>{kind === 'option' ? 'Underlying' : 'Instrument'}</label>
              <input
                type="text"
                placeholder={kind === 'option' ? 'e.g. QQQ' : 'Type to search…'}
                value={symbol}
                onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setShowSuggest(true) }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              />
              {kind === 'future' && showSuggest && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 4,
                  background: 'var(--surface)', border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
                }}>
                  {suggestions.map((s) => (
                    <div key={s.symbol}
                      onMouseDown={() => { setSymbol(s.symbol); setShowSuggest(false) }}
                      style={{ padding: '7px 11px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 8 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <span className="num" style={{ fontWeight: 600 }}>{s.symbol}</span>
                      <span className="dim" style={{ fontSize: 12 }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label>Direction</label>
              <div className="segmented">
                <button className={direction === 'long' ? 'long' : ''} onClick={() => setDirection('long')}>Long</button>
                <button className={direction === 'short' ? 'short' : ''} onClick={() => setDirection('short')}>Short</button>
              </div>
            </div>

            <div className="field">
              <label>Strategy</label>
              <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                <option value="">—</option>
                {strategies.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Entry time</label>
              <input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} />
            </div>
          </div>

          {kind === 'option' && (
            <>
              <div className="section-label">Option</div>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="field">
                  <label>Type</label>
                  <div className="segmented">
                    <button className={optionType === 'call' ? 'sel' : ''} onClick={() => setOptionType('call')}>Call</button>
                    <button className={optionType === 'put' ? 'sel' : ''} onClick={() => setOptionType('put')}>Put</button>
                  </div>
                </div>
                <div className="field">
                  <label>Strike</label>
                  <input type="number" value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="e.g. 480" />
                </div>
                <div className="field">
                  <label>Expiry</label>
                  <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="section-label">Entry</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="field">
              <label>{kind === 'option' ? 'Entry premium' : 'Entry price'}</label>
              <input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
            </div>
            <div className="field">
              <label>Contracts</label>
              <input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="field">
              <label>{kind === 'option' ? 'Stop (premium, optional)' : 'Stop loss (optional)'}</label>
              <input type="number" step="any" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} />
            </div>
          </div>

          <div className="section-label">
            Excursion <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>— optional, powers exit efficiency</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label>Max favorable ({kind === 'option' ? 'premium' : 'points'})</label>
              <input type="number" step="any" value={mfe} onChange={(e) => setMfe(e.target.value)}
                placeholder="How far it went your way before you exited" />
            </div>
            <div className="field">
              <label>Max adverse ({kind === 'option' ? 'premium' : 'points'})</label>
              <input type="number" step="any" value={mae} onChange={(e) => setMae(e.target.value)}
                placeholder="How far it went against you before it turned" />
            </div>
          </div>

          <div className="section-label">
            Exits <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>— log all partials after the trade closes</span>
          </div>
          <table className="tbl" style={{ marginBottom: 6 }}>
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>{kind === 'option' ? 'Exit premium' : 'Exit price'}</th>
                <th>Contracts</th>
                <th>Time</th>
                <th style={{ width: 34 }}></th>
              </tr>
            </thead>
            <tbody>
              {exits.map((ex, i) => (
                <tr key={i}>
                  <td className="dim">{i + 1}</td>
                  <td><input type="number" step="any" value={ex.price} onChange={(e) => updateExit(i, { price: e.target.value })} /></td>
                  <td><input type="number" step="any" value={ex.qty} onChange={(e) => updateExit(i, { qty: e.target.value })} /></td>
                  <td><input type="time" value={ex.time} onChange={(e) => updateExit(i, { time: e.target.value })} /></td>
                  <td>
                    <button className="icon-btn" onClick={() => removeExit(i)} aria-label="Remove exit" disabled={exits.length === 1}>
                      <X size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn ghost sm" onClick={addExit}><Plus size={14} /> Add exit</button>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 'var(--radius)',
              background: pnl.net >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
            }}>
              <span style={{ fontSize: 12, color: pnl.net >= 0 ? 'var(--green-d)' : 'var(--red-d)' }}>
                {pnl.hasCommission ? 'Net P/L' : 'Gross P/L'}
              </span>
              <span className={`num ${pnl.net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 16, fontWeight: 600 }}>
                {fmtMoney(pnl.net, { sign: true })}
              </span>
            </div>
            {pnl.hasCommission && (
              <span className="dim" style={{ fontSize: 12 }}>
                gross {fmtMoney(pnl.gross, { sign: true })} − {fmtMoney(pnl.commission)} commission
              </span>
            )}
            {!pnl.hasCommission && (
              <span className="dim" style={{ fontSize: 12 }}>no commission set for this account</span>
            )}
            {rPreview != null && (
              <span className="num" style={{ fontSize: 12, fontWeight: 600, color: rPreview >= 0 ? 'var(--green-d)' : 'var(--red-d)' }}>
                {rPreview >= 0 ? '+' : ''}{rPreview.toFixed(2)}R
              </span>
            )}
            {qtyMismatch && (
              <span className="num" style={{ fontSize: 12, color: 'var(--amber-d)' }}>
                exits ({exitQty}) ≠ entry ({Number(quantity)})
              </span>
            )}
          </div>

          <div className="section-label"><NotebookPen size={12} style={{ verticalAlign: -1 }} /> Notes</div>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you see? What was the context? Anything worth remembering." />
        </div>

        {/* ---------------- right: review panel ---------------- */}
        <div>
          <div className="section-label" style={{ marginTop: 0 }}>Screenshots</div>
          <div
            className={`dropzone ${dragging ? 'drag' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          >
            <ImageIcon size={20} style={{ opacity: 0.6 }} />
            <div style={{ fontSize: 12, marginTop: 4 }}>Drag &amp; drop or click</div>
            <div style={{ fontSize: 11 }}>Entry · Exit · HTF · Alert</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)} />
          {shots.length > 0 && (
            <div className="tagwrap" style={{ marginTop: 8 }}>
              {shots.map((s, i) => (
                <ShotThumb key={i} shot={s} onRemove={() => removeShot(i)} onLabel={(lbl) => labelShot(i, lbl)} />
              ))}
            </div>
          )}
          {shots.length > 0 && shots.some((s) => s.label) && (
            <>
              <div className="section-label">Chart review</div>
              <ScreenshotTimeline shots={shots} />
            </>
          )}

          <div className="section-label">Setup grade</div>
          <div className="segmented">
            {GRADES.map((g) => (
              <button key={g} className={grade === g ? 'sel' : ''} onClick={() => setGrade(grade === g ? '' : g)}>{g}</button>
            ))}
          </div>

          <div className="section-label">Rules checklist</div>
          {ruleItems.length === 0 && <div className="dim" style={{ fontSize: 12 }}>Add your rules in Settings.</div>}
          {ruleItems.map((r) => (
            <div key={r.id} className="between" style={{ padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)', paddingRight: 8 }}>{r.text}</span>
              <div className="segmented" style={{ flex: '0 0 auto', width: 96 }}>
                <button className={rulesChecked[r.id] === true ? 'long' : ''} onClick={() => toggleRule(r.id, true)} style={{ padding: '3px 6px', fontSize: 11 }}>Yes</button>
                <button className={rulesChecked[r.id] === false ? 'short' : ''} onClick={() => toggleRule(r.id, false)} style={{ padding: '3px 6px', fontSize: 11 }}>No</button>
              </div>
            </div>
          ))}

          <div className="section-label">Mistake tags <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>— optional</span></div>
          <div className="tagwrap">
            {mistakeTags.map((m) => (
              <button key={m.id} className={`tag clickable ${mistakes.includes(m.text) ? 'on' : ''}`} onClick={() => toggleMistake(m.text)}>
                {m.text}
              </button>
            ))}
          </div>

          {!editing && activeAccounts.length > 1 && (
            <>
              <div className="section-label"><Copy size={12} style={{ verticalAlign: -1 }} /> Copy this entry to</div>
              <div className="tagwrap">
                {activeAccounts.filter((a) => a.id !== Number(accountId)).map((a) => {
                  const on = copyTo.includes(a.id)
                  return (
                    <button key={a.id} className={`tag clickable ${on ? 'on' : ''}`}
                      onClick={() => setCopyTo((c) => (on ? c.filter((x) => x !== a.id) : [...c, a.id]))}>
                      {a.name}
                    </button>
                  )
                })}
              </div>
              {copyTo.length > 0 && (
                <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>
                  Saves a copy of this trade to {copyTo.length} other account{copyTo.length > 1 ? 's' : ''}.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export const SHOT_LABELS = ['Entry', 'HTF', 'Alert', 'Exit', 'Other']

function ShotThumb({ shot, onRemove, onLabel }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    const u = URL.createObjectURL(shot.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [shot])
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {url && <img src={url} className="thumb" alt={shot.name} />}
      <select value={shot.label || ''} onChange={(e) => onLabel?.(e.target.value)}
        style={{ fontSize: 10, padding: '1px 2px' }} onClick={(e) => e.stopPropagation()}>
        <option value="">Label…</option>
        {SHOT_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <button className="icon-btn" onClick={onRemove} aria-label="Remove"
        style={{ position: 'absolute', top: -6, right: -6, background: 'var(--surface)', border: '0.5px solid var(--border-strong)', borderRadius: '50%', padding: 2 }}>
        <Trash2 size={12} />
      </button>
    </div>
  )
}
