import { useState, useMemo } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Modal } from './ui'
import db from '../db/db'
import { SECTION_ORDER } from '../db/recapFields'
import { slugifyKey } from '../lib/recapio'

const TYPES = [
  { v: 'text', label: 'Short text' }, { v: 'longtext', label: 'Long text' },
  { v: 'number', label: 'Number' }, { v: 'rating', label: 'Rating (1–10)' },
  { v: 'yesno', label: 'Yes / No' }, { v: 'select', label: 'Dropdown (pick one)' },
  { v: 'multiselect', label: 'Dropdown (pick many)' },
]

export default function RecapFieldsManager() {
  const { recapFields } = useApp()
  const [edit, setEdit] = useState(null)

  const grouped = useMemo(() => {
    const list = [...recapFields].filter((f) => !f.archived)
      .sort((a, b) => (SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)) || (a.order - b.order))
    const g = {}
    for (const f of list) (g[f.section || 'Other'] ||= []).push(f)
    return g
  }, [recapFields])

  const toggleDefault = async (f) => db.recapFields.update(f.id, { showByDefault: !f.showByDefault })
  const remove = async (f) => { if (confirm(`Delete "${f.label}"? Existing recaps keep their saved values.`)) await db.recapFields.update(f.id, { archived: true }) }

  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 10 }}>
        <div className="card-title" style={{ margin: 0 }}>Recap fields</div>
        <button className="btn ghost sm" onClick={() => setEdit({})}><Plus size={13} /> Add field</button>
      </div>
      <p className="dim" style={{ fontSize: 12, marginTop: -4, marginBottom: 10 }}>
        Fields marked <strong>Default</strong> appear on every recap. The rest are available from the recap's "+ Add measurement".
      </p>
      {Object.keys(grouped).map((section) => (
        <div key={section} style={{ marginBottom: 10 }}>
          <div className="dim" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{section}</div>
          {grouped[section].map((f) => (
            <div key={f.id} className="between" style={{ padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 12.5 }}>{f.label} <span className="dim" style={{ fontSize: 11 }}>· {TYPES.find((t) => t.v === f.type)?.label || f.type}</span></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Show on every recap">
                  <input type="checkbox" checked={!!f.showByDefault} onChange={() => toggleDefault(f)} /> Default
                </label>
                <button className="link" onClick={() => setEdit(f)} title="Edit"><Pencil size={13} /></button>
                <button className="link" onClick={() => remove(f)} title="Delete"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {edit && <FieldModal field={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function FieldModal({ field, onClose }) {
  const { recapFields } = useApp()
  const editing = !!field.id
  const [f, setF] = useState({
    label: field.label || '', type: field.type || 'text', section: field.section || 'Custom',
    options: (field.options || []).join('\n'), unit: field.unit || '', showByDefault: field.showByDefault ?? true,
  })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const hasOptions = f.type === 'select' || f.type === 'multiselect'

  const save = async () => {
    if (!f.label.trim()) { alert('Give the field a name.'); return }
    const options = hasOptions ? f.options.split('\n').map((x) => x.trim()).filter(Boolean) : []
    const payload = { label: f.label.trim(), type: f.type, section: f.section.trim() || 'Custom', options, unit: f.unit.trim(), showByDefault: !!f.showByDefault }
    if (editing) await db.recapFields.update(field.id, payload)
    else {
      const key = slugifyKey(payload.label, recapFields.map((x) => x.key))
      await db.recapFields.add({ ...payload, key, aliases: [], order: 999, archived: false })
    }
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit field' : 'New recap field'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save field</button></>}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field"><label>Name</label><input value={f.label} onChange={set('label')} placeholder="e.g. Hours of sleep" /></div>
        <div className="field"><label>Type</label><select value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
        <div className="field"><label>Section</label><input value={f.section} onChange={set('section')} placeholder="e.g. Discipline" /></div>
        <div className="field"><label>Unit (optional)</label><input value={f.unit} onChange={set('unit')} placeholder="e.g. hrs" /></div>
      </div>
      {hasOptions && (
        <div className="field"><label>Options (one per line)</label><textarea rows={4} value={f.options} onChange={set('options')} placeholder={'Bullish\nBearish\nNeutral'} /></div>
      )}
      <label style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <input type="checkbox" checked={f.showByDefault} onChange={(e) => setF((s) => ({ ...s, showByDefault: e.target.checked }))} />
        Show on every recap by default
      </label>
    </Modal>
  )
}
