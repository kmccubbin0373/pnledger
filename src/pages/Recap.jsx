import { useState, useMemo, useRef } from 'react'
import { NotebookPen, Plus, Trash2, Upload, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Modal, Empty } from '../components/ui'
import db from '../db/db'
import { computePnl } from '../lib/pnl'
import { fmtMoney, todayISO } from '../lib/format'
import { SECTION_ORDER } from '../db/recapFields'
import { parseRecapDoc, coerceForField, slugifyKey } from '../lib/recapio'

export default function Recap() {
  const { recaps, recapFields, scopedTrades, accountsById, instrumentsBySymbol } = useApp()
  const [open, setOpen] = useState(null)
  const importRef = useRef()

  const netByDate = useMemo(() => {
    const m = {}
    for (const t of scopedTrades) {
      const net = computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net
      m[t.date] = (m[t.date] || 0) + net
    }
    return m
  }, [scopedTrades, accountsById, instrumentsBySymbol])

  const sorted = useMemo(() => [...recaps].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [recaps])

  const onImportFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    let text = ''
    try {
      if (file.name.toLowerCase().endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        text = (await mammoth.extractRawText({ arrayBuffer })).value || ''
      } else { text = await file.text() }
    } catch { alert('Could not read that file. Use a .txt, .md, or .docx recap.'); return }
    const parsed = parseRecapDoc(text, recapFields)
    setOpen({ date: parsed.date || todayISO(), fields: parsed.values, _imported: true, _unmatched: parsed.unmatched })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Recap</h1>
          <p className="page-sub">Was the day worth repeating?</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn ghost" onClick={() => importRef.current?.click()}><Upload size={15} /> Import recap</button>
          <button className="btn primary" onClick={() => setOpen({ date: todayISO() })}><Plus size={15} /> New recap</button>
          <input ref={importRef} type="file" accept=".txt,.md,.docx" style={{ display: 'none' }} onChange={onImportFile} />
        </div>
      </div>

      {sorted.length === 0 ? (
        <Empty icon={<NotebookPen size={28} />} title="No recaps yet">Write your first end-of-day recap, or import one from your journal.</Empty>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {sorted.map((r) => <RecapCard key={r.id} recap={r} net={netByDate[r.date] || 0} onClick={() => setOpen(r)} />)}
        </div>
      )}

      {open && <RecapModal recap={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function RecapCard({ recap, net, onClick }) {
  const grade = recap.fields?.grade
  const disc = recap.fields?.disciplineScore
  const snippet = recap.fields?.lesson || recap.fields?.mainMistake || recap.fields?.toFix || ''
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div className="between">
        <div style={{ fontWeight: 600 }}>{new Date(recap.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {disc != null && disc !== '' && <span className="pill neutral">{disc}/10</span>}
          {grade && <span className="pill neutral">{grade}</span>}
          <span className={`num ${net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 13 }}>{fmtMoney(net, { sign: true })}</span>
        </div>
      </div>
      {snippet ? <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--text-2)' }}>{String(snippet).slice(0, 140)}{String(snippet).length > 140 ? '…' : ''}</div> : null}
    </div>
  )
}

function RecapModal({ recap, onClose }) {
  const { recapFields, plans, scopedTrades, accountsById, instrumentsBySymbol } = useApp()
  const editing = !!recap.id
  const importedFrom = !!recap._imported

  const [date, setDate] = useState(recap.date || todayISO())
  const [followedPlan, setFollowedPlan] = useState(recap.followedPlan || '')
  const [values, setValues] = useState(recap.fields || {})
  const [unmatched, setUnmatched] = useState(recap._unmatched || [])
  const [activeKeys, setActiveKeys] = useState(() => {
    const def = recapFields.filter((f) => !f.archived && f.showByDefault).map((f) => f.key)
    const present = Object.keys(recap.fields || {})
    return Array.from(new Set([...def, ...present]))
  })

  const fieldByKey = useMemo(() => Object.fromEntries(recapFields.map((f) => [f.key, f])), [recapFields])
  const setVal = (key, v) => setValues((s) => ({ ...s, [key]: v }))
  const addField = (key) => setActiveKeys((k) => (k.includes(key) ? k : [...k, key]))
  const removeField = (key) => { setActiveKeys((k) => k.filter((x) => x !== key)); setValues((s) => { const n = { ...s }; delete n[key]; return n }) }

  const day = useMemo(() => {
    const rows = scopedTrades.filter((t) => t.date === date).map((t) => computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net)
    const net = rows.reduce((s, n) => s + n, 0)
    const wins = rows.filter((n) => n > 0).length
    return { net, count: rows.length, wins, losses: rows.length - wins }
  }, [scopedTrades, accountsById, instrumentsBySymbol, date])

  const plan = useMemo(() => plans.find((p) => p.date === date), [plans, date])

  const grouped = useMemo(() => {
    const active = recapFields.filter((f) => activeKeys.includes(f.key) && !f.archived)
      .sort((a, b) => (SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)) || (a.order - b.order))
    const g = {}
    for (const f of active) (g[f.section || 'Other'] ||= []).push(f)
    return g
  }, [recapFields, activeKeys])

  const addable = recapFields.filter((f) => !f.archived && !activeKeys.includes(f.key))
    .sort((a, b) => (SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)) || (a.order - b.order))

  const mapUnmatched = (item, key) => {
    const f = fieldByKey[key]; if (!f) return
    setVal(key, coerceForField(f, item.value)); addField(key)
    setUnmatched((u) => u.filter((x) => x !== item))
  }
  const createFromUnmatched = async (item) => {
    const key = slugifyKey(item.label, recapFields.map((f) => f.key))
    const type = item.guessType || 'text'
    await db.recapFields.add({ key, label: item.label, type, section: 'Custom', options: [], showByDefault: false, order: 999, archived: false, aliases: [] })
    setVal(key, coerceForField({ type, options: [] }, item.value)); addField(key)
    setUnmatched((u) => u.filter((x) => x !== item))
  }

  const save = async () => {
    const payload = { date, followedPlan, fields: values }
    if (editing) await db.recaps.update(recap.id, payload)
    else await db.recaps.add({ ...payload, createdAt: Date.now() })
    onClose()
  }

  const sectionsToRender = SECTION_ORDER.concat(Object.keys(grouped).filter((s) => !SECTION_ORDER.includes(s)))

  return (
    <Modal title={editing ? 'Edit recap' : 'Daily recap'} icon={<NotebookPen size={16} />} onClose={onClose}
      footer={<>
        {editing && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await db.recaps.delete(recap.id); onClose() }}><Trash2 size={14} /> Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save recap</button>
      </>}>

      {importedFrom && (
        <div style={{ background: 'var(--blue-bg)', border: '0.5px solid var(--blue-2)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 14, fontSize: 12.5, color: 'var(--blue)' }}>
          Imported from a file. {Object.keys(values).length} field(s) matched automatically{unmatched.length ? `, ${unmatched.length} couldn't be matched (below).` : '.'} Review and save.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '160px 1fr', alignItems: 'start', marginBottom: 6 }}>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label>Day (from your logged trades)</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', height: 34 }}>
            <span className={`num ${day.net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 16, fontWeight: 700 }}>{fmtMoney(day.net, { sign: true })}</span>
            <span className="dim" style={{ fontSize: 12 }}>{day.count} trade{day.count !== 1 ? 's' : ''} · {day.wins}W {day.losses}L · {day.net >= 0 ? 'green' : 'red'} day</span>
          </div>
        </div>
      </div>

      {plan && (
        <div style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 10, fontSize: 12.5 }}>
          <div className="dim" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Today's plan</div>
          {plan.bias && <div><strong className="dim">Bias:</strong> {plan.bias}</div>}
          {plan.lookingFor && <div><strong className="dim">Hunting:</strong> {plan.lookingFor}</div>}
          {plan.avoiding && <div><strong className="dim">Avoiding:</strong> {plan.avoiding}</div>}
          {plan.stopEarlyIf && <div><strong className="dim">Stop early if:</strong> {plan.stopEarlyIf}</div>}
          <div className="field" style={{ marginTop: 8, maxWidth: 220 }}>
            <label>Did you follow the plan?</label>
            <select value={followedPlan} onChange={(e) => setFollowedPlan(e.target.value)}><option value="">—</option><option>Yes</option><option>Mostly</option><option>No</option></select>
          </div>
        </div>
      )}

      {unmatched.length > 0 && (
        <div style={{ border: '0.5px solid var(--border-strong)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 8 }}>Unmatched from import — map to a field or add as new</div>
          {unmatched.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12 }}><strong>{item.label}:</strong> <span className="dim">{item.value.slice(0, 60)}{item.value.length > 60 ? '…' : ''}</span></span>
              <select defaultValue="" onChange={(e) => { if (e.target.value) mapUnmatched(item, e.target.value) }} style={{ marginLeft: 'auto' }}>
                <option value="">Map to field…</option>
                {recapFields.filter((f) => !f.archived).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <button className="btn ghost sm" onClick={() => createFromUnmatched(item)}><Plus size={12} /> New field</button>
            </div>
          ))}
        </div>
      )}

      {sectionsToRender.map((section) => {
        const fields = grouped[section]
        if (!fields || !fields.length) return null
        return (
          <div key={section}>
            <div className="section-label">{section}</div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {fields.map((f) => <RecapFieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setVal(f.key, v)} onRemove={() => removeField(f.key)} />)}
            </div>
          </div>
        )
      })}

      {addable.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <select value="" onChange={(e) => { if (e.target.value) addField(e.target.value) }}>
            <option value="">+ Add measurement…</option>
            {addable.map((f) => <option key={f.key} value={f.key}>{f.label}{f.section ? ` · ${f.section}` : ''}</option>)}
          </select>
        </div>
      )}
    </Modal>
  )
}

function RecapFieldInput({ field, value, onChange, onRemove }) {
  const t = field.type
  return (
    <div className="field" style={{ gridColumn: t === 'longtext' ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{field.label}{field.unit ? ` (${field.unit})` : ''}</span>
        <button className="link" onClick={onRemove} title="Remove from this recap" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center' }}><X size={12} /></button>
      </label>
      {t === 'text' && <input value={value || ''} onChange={(e) => onChange(e.target.value)} />}
      {t === 'longtext' && <textarea rows={2} value={value || ''} onChange={(e) => onChange(e.target.value)} />}
      {t === 'number' && <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />}
      {t === 'rating' && <input type="number" min="1" max="10" placeholder="1–10" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(1, Math.min(10, Number(e.target.value))))} />}
      {t === 'yesno' && <select value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">—</option><option>Yes</option><option>No</option></select>}
      {t === 'select' && <select value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{(field.options || []).map((o) => <option key={o}>{o}</option>)}</select>}
      {t === 'multiselect' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(field.options || []).map((o) => {
            const arr = Array.isArray(value) ? value : []
            const on = arr.includes(o)
            return <button key={o} className={on ? 'sel' : ''} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6 }} onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}>{o}</button>
          })}
        </div>
      )}
    </div>
  )
}
