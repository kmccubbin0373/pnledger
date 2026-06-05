import { useState, useMemo, useRef } from 'react'
import { CalendarCheck, Plus, Pencil, Trash2, Upload, Download, FileText } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Modal, Empty } from '../components/ui'
import db from '../db/db'
import { computePnl } from '../lib/pnl'
import { fmtMoney, todayISO } from '../lib/format'
import { parseJournalText, exportAsTxt, exportAsMd } from '../lib/recapParser'

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F']

export default function Recap() {
  const { recaps, scopedTrades, accountsById, instrumentsBySymbol } = useApp()
  const [open, setOpen] = useState(null)
  const [importPreview, setImportPreview] = useState(null) // { parsed, raw } or null
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const handleImportFile = async (file) => {
    if (!file) return
    setImporting(true)
    try {
      let text = ''
      const ext = file.name.split('.').pop().toLowerCase()
      if (ext === 'docx' || ext === 'doc') {
        // Use mammoth to extract text from Word documents.
        const mammoth = await import('mammoth')
        const buf = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buf })
        text = result.value
      } else {
        // .txt and .md can be read directly as text.
        text = await file.text()
      }
      const parsed = parseJournalText(text)
      setImportPreview({ parsed, raw: text })
    } catch (err) {
      console.error('Journal import error:', err)
      alert('Could not read that file. Supported formats: .txt, .md, .docx')
    } finally {
      setImporting(false)
    }
  }

  const sorted = useMemo(() => [...recaps].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [recaps])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Daily recap</h1>
          <p className="page-sub">Close the day on purpose. Your trading report card.</p>
        </div>
        <div className="row">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.doc,.docx"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && handleImportFile(e.target.files[0])}
          />
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload size={15} /> {importing ? 'Reading…' : 'Import journal'}
          </button>
          <button className="btn primary" onClick={() => setOpen({ date: todayISO() })}>
            <Plus size={15} /> New recap
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card"><Empty icon={<CalendarCheck size={30} />} title="No recaps yet">A two-minute recap each day builds the habit of closing the chart and walking away.</Empty></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {sorted.map((r) => {
            const dayNet = scopedTrades.filter((t) => t.date === r.date).reduce((s, t) => s + computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net, 0)
            return (
              <div key={r.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
                <div className="between">
                  <div style={{ fontWeight: 600 }}>{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  {r.grade && <span className="pill neutral">{r.grade}</span>}
                </div>
                <div className={`num ${dayNet >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>{fmtMoney(dayNet, { sign: true })}</div>
                <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                  {r.marketCondition && <span className="pill neutral" style={{ marginRight: 6 }}>{r.marketCondition}</span>}
                </div>
                {r.didWell && <div style={{ fontSize: 12.5, marginTop: 8, color: 'var(--text-2)' }}><strong className="dim">Did well:</strong> {r.didWell}</div>}
                {r.toFix && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--text-2)' }}><strong className="dim">To fix:</strong> {r.toFix}</div>}
                <div className="row" style={{ marginTop: 10, gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn ghost sm" title="Export as .txt"
                    onClick={() => {
                      const text = exportAsTxt(r, dayNet)
                      const blob = new Blob([text], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `recap-${r.date}.txt`; a.click()
                      URL.revokeObjectURL(url)
                    }}>
                    <FileText size={12} /> .txt
                  </button>
                  <button className="btn ghost sm" title="Export as .md"
                    onClick={() => {
                      const text = exportAsMd(r, dayNet)
                      const blob = new Blob([text], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `recap-${r.date}.md`; a.click()
                      URL.revokeObjectURL(url)
                    }}>
                    <FileText size={12} /> .md
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && <RecapModal recap={open} onClose={() => setOpen(null)} />}
      {importPreview && (
        <RecapModal
          recap={{ date: todayISO(), ...importPreview.parsed }}
          onClose={() => setImportPreview(null)}
          importedFrom={true}
        />
      )}
    </>
  )
}

function RecapModal({ recap, onClose, importedFrom }) {
  const editing = !!recap.id
  const [f, setF] = useState({
    date: recap.date || todayISO(),
    instrument: recap.instrument || '',
    marketCondition: recap.marketCondition || '',
    bestTrade: recap.bestTrade || '',
    worstTrade: recap.worstTrade || '',
    followedMaxTrades: recap.followedMaxTrades || '',
    respectedRisk: recap.respectedRisk || '',
    forcedAnything: recap.forcedAnything || '',
    bestSetup: recap.bestSetup || '',
    failedSetup: recap.failedSetup || '',
    didWell: recap.didWell || '',
    toFix: recap.toFix || '',
    grade: recap.grade || '',
    // optional mental-state (from the old "should I trade" fields, now just notes)
    sleep: recap.sleep || '', energy: recap.energy || '', stress: recap.stress || '',
  })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async () => {
    if (editing) await db.recaps.update(recap.id, f)
    else await db.recaps.add({ ...f, createdAt: Date.now() })
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit recap' : importedFrom ? 'Review imported recap' : 'Daily recap'} icon={<CalendarCheck size={16} />} onClose={onClose}
      footer={<>
        {editing && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await db.recaps.delete(recap.id); onClose() }}><Trash2 size={14} /> Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save recap</button>
      </>}>
      {importedFrom && (
        <div style={{
          background: 'var(--blue-bg)', border: '0.5px solid var(--blue-2)',
          borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 14,
          fontSize: 12.5, color: 'var(--blue)',
        }}>
          Pre-populated from your journal file. Review each field and adjust anything
          the parser got wrong before saving.
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="field"><label>Date</label><input type="date" value={f.date} onChange={set('date')} /></div>
        <div className="field"><label>Main instrument</label><input value={f.instrument} onChange={set('instrument')} placeholder="e.g. MNQ" /></div>
        <div className="field"><label>Market condition</label>
          <select value={f.marketCondition} onChange={set('marketCondition')}>
            <option value="">—</option><option>Trend day</option><option>Range day</option><option>Chop</option><option>News-driven</option>
          </select>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
        <div className="field"><label>Best trade</label><input value={f.bestTrade} onChange={set('bestTrade')} /></div>
        <div className="field"><label>Worst trade</label><input value={f.worstTrade} onChange={set('worstTrade')} /></div>
        <div className="field"><label>What setup worked best?</label><input value={f.bestSetup} onChange={set('bestSetup')} /></div>
        <div className="field"><label>What setup failed?</label><input value={f.failedSetup} onChange={set('failedSetup')} /></div>
      </div>

      <div className="section-label">Discipline</div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="field"><label>Followed max trades?</label>
          <select value={f.followedMaxTrades} onChange={set('followedMaxTrades')}><option value="">—</option><option>Yes</option><option>No</option></select></div>
        <div className="field"><label>Respected risk?</label>
          <select value={f.respectedRisk} onChange={set('respectedRisk')}><option value="">—</option><option>Yes</option><option>No</option></select></div>
        <div className="field"><label>Forced anything?</label>
          <select value={f.forcedAnything} onChange={set('forcedAnything')}><option value="">—</option><option>No</option><option>Yes</option></select></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
        <div className="field"><label>One thing I did well</label><textarea rows={2} value={f.didWell} onChange={set('didWell')} /></div>
        <div className="field"><label>One thing to fix tomorrow</label><textarea rows={2} value={f.toFix} onChange={set('toFix')} /></div>
      </div>

      <div className="section-label">Optional — how you felt <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>(handy to spot patterns later)</span></div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="field"><label>Sleep</label><input value={f.sleep} onChange={set('sleep')} placeholder="e.g. 7h, rough" /></div>
        <div className="field"><label>Energy</label><input value={f.energy} onChange={set('energy')} /></div>
        <div className="field"><label>Stress</label><input value={f.stress} onChange={set('stress')} /></div>
      </div>

      <div className="field" style={{ marginTop: 14, maxWidth: 200 }}>
        <label>Grade for the day</label>
        <div className="segmented">
          {GRADES.map((g) => <button key={g} className={f.grade === g ? 'sel' : ''} style={{ padding: '6px 4px', fontSize: 12 }} onClick={() => setF((s) => ({ ...s, grade: s.grade === g ? '' : g }))}>{g}</button>)}
        </div>
      </div>
    </Modal>
  )
}
