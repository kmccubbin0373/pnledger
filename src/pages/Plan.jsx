import { useState, useMemo, useRef, useEffect } from 'react'
import { Target, Plus, Trash2, ShieldAlert, Image as ImageIcon, Upload, FileText } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Modal, Empty } from '../components/ui'
import db from '../db/db'
import { computePnl } from '../lib/pnl'
import { fmtMoney, todayISO } from '../lib/format'
import { buildPlanTxt, buildPlanMd, parsePlanText } from '../lib/planio'
import { exportPlanPdf } from '../lib/pdfExport'

function downloadText(content, filename, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const BIAS = ['Long', 'Short', 'Neutral', 'Stand aside']

export default function Plan() {
  const { plans, scopedTrades, accountsById, instrumentsBySymbol } = useApp()
  const [open, setOpen] = useState(null)
  const importRef = useRef()
  const sorted = useMemo(() => [...plans].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [plans])

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
    } catch { alert('Could not read that file. Use a .txt, .md, or .docx plan.'); return }
    const parsed = parsePlanText(text)
    if (!parsed.date) parsed.date = todayISO()
    setOpen({ ...parsed, _imported: true })
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Trading plan</h1>
          <p className="page-sub">Decide the day before it decides you.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn ghost" onClick={() => importRef.current?.click()}><Upload size={15} /> Import plan</button>
          <button className="btn primary" onClick={() => setOpen({ date: todayISO() })}><Plus size={15} /> New plan</button>
          <input ref={importRef} type="file" accept=".txt,.md,.docx" style={{ display: 'none' }} onChange={onImportFile} />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card"><Empty icon={<Target size={30} />} title="No plans yet">Write a one-minute plan before the open: what you're hunting, what you're avoiding, and your stop-out line.</Empty></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {sorted.map((p) => {
            const dayNet = scopedTrades.filter((t) => t.date === p.date).reduce((s, t) => s + computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net, 0)
            const breached = p.maxLossDollars != null && p.maxLossDollars !== '' && dayNet <= -Math.abs(Number(p.maxLossDollars))
            return (
              <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setOpen(p)}>
                <div className="between">
                  <div style={{ fontWeight: 600 }}>{new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  {p.bias && <span className="pill neutral">{p.bias}</span>}
                </div>
                {p.lookingFor && <div style={{ fontSize: 12.5, marginTop: 8, color: 'var(--text-2)' }}><strong className="dim">Hunting:</strong> {p.lookingFor}</div>}
                {p.avoiding && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--text-2)' }}><strong className="dim">Avoiding:</strong> {p.avoiding}</div>}
                <div className="between" style={{ marginTop: 10, fontSize: 12 }}>
                  <span className="dim">Max loss {p.maxLossDollars ? fmtMoney(-Math.abs(Number(p.maxLossDollars))) : '—'}</span>
                  <span className={`num ${dayNet >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600 }}>{fmtMoney(dayNet, { sign: true })}</span>
                </div>
                {breached && <div className="num neg" style={{ fontSize: 11.5, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={12} /> Daily max loss breached</div>}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn ghost sm" onClick={() => downloadText(buildPlanTxt(p), `plan-${p.date}.txt`, 'text/plain')}><FileText size={12} /> .txt</button>
                  <button className="btn ghost sm" onClick={() => downloadText(buildPlanMd(p), `plan-${p.date}.md`, 'text/markdown')}><FileText size={12} /> .md</button>
                  <button className="btn ghost sm" onClick={() => exportPlanPdf(p)}>📄 PDF</button>
                  {(p.screenshots || []).length > 0 && <span className="dim" style={{ fontSize: 11, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ImageIcon size={12} /> {p.screenshots.length}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && <PlanModal plan={open} importedFrom={!!open._imported} onClose={() => setOpen(null)} />}
    </>
  )
}

function PlanModal({ plan, onClose, importedFrom }) {
  const editing = !!plan.id
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [shots, setShots] = useState(plan.screenshots || [])
  const handleFiles = async (fileList) => {
    const incoming = []
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue
      const blob = await file.arrayBuffer().then((buf) => new Blob([buf], { type: file.type }))
      incoming.push({ name: file.name, type: file.type, blob })
    }
    if (incoming.length) setShots((s) => [...s, ...incoming])
  }
  const removeShot = (i) => setShots((s) => s.filter((_, j) => j !== i))

  const [f, setF] = useState({
    date: plan.date || todayISO(),
    bias: plan.bias || '',
    lookingFor: plan.lookingFor || '',
    avoiding: plan.avoiding || '',
    maxLossDollars: plan.maxLossDollars ?? '',
    maxTrades: plan.maxTrades ?? '',
    stopEarlyIf: plan.stopEarlyIf || '',
    notes: plan.notes || '',
  })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async () => {
    const payload = {
      ...f,
      maxLossDollars: f.maxLossDollars === '' ? null : Number(f.maxLossDollars),
      maxTrades: f.maxTrades === '' ? null : Number(f.maxTrades),
      screenshots: shots,
    }
    if (editing) await db.plans.update(plan.id, payload)
    else await db.plans.add({ ...payload, createdAt: Date.now() })
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit plan' : "Today's plan"} icon={<Target size={16} />} onClose={onClose}
      footer={<>
        {editing && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await db.plans.delete(plan.id); onClose() }}><Trash2 size={14} /> Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save plan</button>
      </>}>

      {importedFrom && (
        <div style={{ background: 'var(--blue-bg)', border: '0.5px solid var(--blue-2)', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 14, fontSize: 12.5, color: 'var(--blue)' }}>
          Pre-filled from an imported plan file. Review each field and adjust before saving.
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="field"><label>Date</label><input type="date" value={f.date} onChange={set('date')} /></div>
        <div className="field"><label>Bias</label>
          <select value={f.bias} onChange={set('bias')}>
            <option value="">—</option>{BIAS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div className="field"><label>Max trades</label><input type="number" value={f.maxTrades} onChange={set('maxTrades')} placeholder="e.g. 3" /></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
        <div className="field"><label>Setups I'm hunting</label><textarea rows={3} value={f.lookingFor} onChange={set('lookingFor')} placeholder="A+ setups, levels, sessions" /></div>
        <div className="field"><label>What I'm avoiding</label><textarea rows={3} value={f.avoiding} onChange={set('avoiding')} placeholder="Chop, news, revenge entries…" /></div>
      </div>

      <div className="section-label">Setup screenshots <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>— charts of what you're hunting</span></div>
      <div className={`dropzone ${dragging ? 'drag' : ''}`} onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}>
        <ImageIcon size={18} style={{ opacity: 0.6 }} />
        <div style={{ fontSize: 12, marginTop: 4 }}>Drag &amp; drop or click to add setup charts</div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
      {shots.length > 0 && (
        <div className="tagwrap" style={{ marginTop: 8 }}>
          {shots.map((s, i) => <PlanShot key={i} shot={s} onRemove={() => removeShot(i)} />)}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
        <div className="field"><label>Daily max loss ($)</label><input type="number" value={f.maxLossDollars} onChange={set('maxLossDollars')} placeholder="Hard stop for the day" /></div>
        <div className="field"><label>I stop early if…</label><textarea rows={2} value={f.stopEarlyIf} onChange={set('stopEarlyIf')} placeholder="2 reds in a row, target hit, etc." /></div>
      </div>

      <div className="section-label">Notes</div>
      <textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Anything else to keep front of mind." />
    </Modal>
  )
}

function PlanShot({ shot, onRemove }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { const u = URL.createObjectURL(shot.blob); setUrl(u); return () => URL.revokeObjectURL(u) }, [shot])
  return (
    <div style={{ position: 'relative' }}>
      {url && <img src={url} className="thumb" alt={shot.name} />}
      <button className="icon-btn" onClick={onRemove} aria-label="Remove" style={{ position: 'absolute', top: -6, right: -6, background: 'var(--surface)', border: '0.5px solid var(--border-strong)', borderRadius: '50%', padding: 2 }}><Trash2 size={12} /></button>
    </div>
  )
}
