import { useState } from 'react'
import { Plus, X, Tag, ListChecks, AlertTriangle, Gauge, Download, Upload, Pencil, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Modal } from '../components/ui'
import db from '../db/db'
import { fmtNum } from '../lib/format'

export default function Settings() {
  const { strategies, ruleItems, mistakeTags, instruments, prefs } = useApp()
  const [instModal, setInstModal] = useState(null)
  const [busy, setBusy] = useState('')

  const addStrategy = async () => { const n = prompt('New strategy name'); if (n?.trim()) await db.strategies.add({ name: n.trim(), archived: 0 }) }
  const addRule = async () => { const n = prompt('New rule (a yes/no you ask yourself each trade)'); if (n?.trim()) await db.ruleItems.add({ text: n.trim(), order: ruleItems.length, archived: 0 }) }
  const addMistake = async () => { const n = prompt('New mistake tag'); if (n?.trim()) await db.mistakeTags.add({ text: n.trim(), archived: 0 }) }

  const exportData = async () => {
    setBusy('export')
    const tables = ['firms', 'accounts', 'instruments', 'trades', 'strategies', 'ruleItems', 'mistakeTags', 'recaps', 'accountEvents', 'prefs']
    const dump = {}
    for (const t of tables) {
      const rows = await db[t].toArray()
      // strip screenshot blobs from JSON export (kept local); note count instead
      if (t === 'trades') dump[t] = rows.map((r) => ({ ...r, screenshots: (r.screenshots || []).length }))
      else dump[t] = rows
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `pnledger-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
    setBusy('')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Make the journal yours — every list below is editable.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
        {/* Strategies */}
        <ListCard title="Strategies" icon={<Tag size={14} />} onAdd={addStrategy}
          items={strategies} render={(s) => s.name}
          onRemove={(s) => db.strategies.update(s.id, { archived: 1 })}
          onEdit={async (s) => { const n = prompt('Rename strategy', s.name); if (n?.trim()) db.strategies.update(s.id, { name: n.trim() }) }} />

        {/* Rules */}
        <ListCard title="Rules checklist" icon={<ListChecks size={14} />} onAdd={addRule}
          items={ruleItems} render={(r) => r.text}
          onRemove={(r) => db.ruleItems.update(r.id, { archived: 1 })}
          onEdit={async (r) => { const n = prompt('Edit rule', r.text); if (n?.trim()) db.ruleItems.update(r.id, { text: n.trim() }) }} />

        {/* Mistakes */}
        <ListCard title="Mistake tags" icon={<AlertTriangle size={14} />} onAdd={addMistake}
          items={mistakeTags} render={(m) => m.text}
          onRemove={(m) => db.mistakeTags.update(m.id, { archived: 1 })}
          onEdit={async (m) => { const n = prompt('Edit mistake tag', m.text); if (n?.trim()) db.mistakeTags.update(m.id, { text: n.trim() }) }} />

        {/* Prefs */}
        <div className="card">
          <div className="card-title"><Gauge size={14} style={{ verticalAlign: -2 }} /> Preferences</div>
          <div className="field">
            <label>Max trades per day</label>
            <input type="number" defaultValue={prefs.maxTradesPerDay ?? 3}
              onBlur={(e) => db.prefs.update(prefs.id, { maxTradesPerDay: Number(e.target.value) || 0 })} style={{ maxWidth: 120 }} />
          </div>
          <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>Drives the “trades left today” stat on the dashboard.</div>
        </div>
      </div>

      {/* Instruments */}
      <div className="card flush" style={{ marginTop: 14 }}>
        <div className="between" style={{ padding: '13px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <div className="card-title" style={{ margin: 0 }}>Instrument specs <span className="dim">— tick / point values from public exchange data; edit if a contract ever changes</span></div>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Symbol</th><th>Name</th><th className="r">Tick size</th><th className="r">Tick value</th><th className="r">Point value</th><th></th></tr>
          </thead>
          <tbody>
            {instruments.filter((i) => i.kind === 'future').map((i) => (
              <tr key={i.id}>
                <td className="num" style={{ fontWeight: 600 }}>{i.symbol}</td>
                <td className="muted">{i.name}</td>
                <td className="num r">{fmtNum(i.tickSize, i.tickSize < 0.01 ? 5 : 2)}</td>
                <td className="num r">${fmtNum(i.tickValue)}</td>
                <td className="num r">${fmtNum(i.pointValue)}</td>
                <td className="r"><button className="icon-btn" onClick={() => setInstModal(i)}><Pencil size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Data */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Your data</div>
        <p className="dim" style={{ fontSize: 12.5, marginTop: 0 }}>
          Everything lives locally on this device. Export a JSON backup any time. (Screenshots stay on-device and aren’t included in the JSON.)
        </p>
        <div className="row">
          <button className="btn" onClick={exportData} disabled={busy === 'export'}><Download size={14} /> Export backup (JSON)</button>
        </div>
      </div>

      {instModal && <InstrumentModal inst={instModal} onClose={() => setInstModal(null)} />}
    </>
  )
}

function ListCard({ title, icon, items, render, onAdd, onRemove, onEdit }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title" style={{ margin: 0 }}>{icon} {title}</div>
        <button className="btn ghost sm" onClick={onAdd}><Plus size={13} /> Add</button>
      </div>
      {items.length === 0 && <div className="dim" style={{ fontSize: 12 }}>None yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it) => (
          <div key={it.id} className="between" style={{ padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
            <span style={{ fontSize: 13 }}>{render(it)}</span>
            <div className="row" style={{ gap: 2 }}>
              <button className="icon-btn" onClick={() => onEdit(it)}><Pencil size={13} /></button>
              <button className="icon-btn" onClick={() => onRemove(it)}><X size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InstrumentModal({ inst, onClose }) {
  const [tickSize, setTickSize] = useState(inst.tickSize)
  const [tickValue, setTickValue] = useState(inst.tickValue)
  const save = async () => {
    const ts = Number(tickSize), tv = Number(tickValue)
    await db.instruments.update(inst.id, { tickSize: ts, tickValue: tv, pointValue: tv / ts })
    onClose()
  }
  return (
    <Modal size="narrow" title={`Edit ${inst.symbol}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field"><label>Tick size</label><input type="number" step="any" value={tickSize} onChange={(e) => setTickSize(e.target.value)} /></div>
        <div className="field"><label>Tick value ($)</label><input type="number" step="any" value={tickValue} onChange={(e) => setTickValue(e.target.value)} /></div>
      </div>
      <div className="dim num" style={{ fontSize: 12, marginTop: 10 }}>
        Point value auto-calculates: ${Number(tickSize) ? fmtNum(Number(tickValue) / Number(tickSize)) : '—'} per 1.00 move.
      </div>
    </Modal>
  )
}
