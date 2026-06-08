// Universal recap import. parseRecapDoc reads any .txt/.md (or text extracted
// from .docx) shaped as "Label: value" / "Label? value" lines, matches each
// label to a recap field (by label or alias, punctuation-insensitive), coerces
// the value to the field type, and returns matched values + an unmatched list
// for the review step. The "Trades Taken" block is skipped — trades live in the log.

export function slugifyKey(label, existingKeys = []) {
  const base = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field'
  let key = base, n = 2
  while (existingKeys.includes(key)) key = `${base}_${n++}`
  return key
}

export function guessFieldType(value) {
  const v = String(value || '').trim()
  if (/^(yes|no|y|n|true|false)$/i.test(v)) return 'yesno'
  if (/^-?\d+(\.\d+)?$/.test(v)) return 'number'
  if (v.length > 60) return 'longtext'
  return 'text'
}

function normalizeLabel(s) {
  return String(s || '')
    .replace(/^\s*\d+[.)]\s*/, '')   // strip "1. " / "2) "
    .replace(/[:?*]+\s*$/, '')        // strip trailing : ? *
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ').trim().toLowerCase()
}

export function parseDateToISO(raw) {
  const s = String(raw || '').trim()
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) { let yr = m[3]; if (yr.length === 2) yr = '20' + yr; return `${yr}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}` }
  return ''
}

export function coerceForField(field, raw) {
  const v = String(raw ?? '').trim()
  switch (field?.type) {
    case 'yesno':
      if (/^(yes|y|true)\b/i.test(v)) return 'Yes'
      if (/^(no|n|false)\b/i.test(v)) return 'No'
      return ''
    case 'number': { const n = parseFloat(v.replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : '' }
    case 'rating': { const n = parseInt(v.replace(/[^0-9\-]/g, ''), 10); return Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : '' }
    case 'select': {
      const opts = field.options || []
      return opts.find((o) => o.toLowerCase() === v.toLowerCase()) || opts.find((o) => v.toLowerCase().includes(o.toLowerCase())) || v
    }
    case 'multiselect': {
      const opts = field.options || []
      return v.split(/[,;]+/).map((x) => x.trim()).filter(Boolean).map((p) => opts.find((o) => o.toLowerCase() === p.toLowerCase()) || p)
    }
    default: return v
  }
}

function buildIndex(fields) {
  const idx = new Map()
  for (const f of fields) {
    if (f.archived) continue
    idx.set(normalizeLabel(f.label), f)
    for (const a of (f.aliases || [])) idx.set(normalizeLabel(a), f)
  }
  return idx
}

export function parseRecapDoc(raw, recapFields = []) {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const idx = buildIndex(recapFields)
  const lines = text.split('\n')
  const result = { date: '', values: {}, matched: [], unmatched: [] }

  const isSectionHeader = (l) => /^\s*\d+[.)]\s+[A-Za-z]/.test(l) && !l.includes(':')
  let inTrades = false
  let pending = null

  const flush = () => {
    if (!pending) return
    const value = pending.buf.join('\n').trim()
    if (pending.field) {
      const c = coerceForField(pending.field, value)
      if (c !== '' && !(Array.isArray(c) && c.length === 0)) {
        result.values[pending.field.key] = c
        result.matched.push({ key: pending.field.key, label: pending.field.label })
      }
    } else if (value) {
      result.unmatched.push({ label: pending.rawLabel, value, guessType: guessFieldType(value) })
    }
    pending = null
  }

  for (const line of lines) {
    if (/^\s*2[.)]\s+trades?\s+taken/i.test(line)) { flush(); inTrades = true; continue }
    if (isSectionHeader(line)) { flush(); inTrades = false; continue }
    if (inTrades) continue
    const m = line.match(/^\s*([^:?]+?)\s*[:?]\s*(.*)$/)
    if (m) {
      flush()
      const rawLabel = m[1].trim(), inlineVal = m[2].trim(), norm = normalizeLabel(rawLabel)
      if (/^date$/.test(norm)) { result.date = parseDateToISO(inlineVal); continue }
      const field = idx.get(norm) || null
      pending = { rawLabel, field, buf: inlineVal ? [inlineVal] : [] }
    } else if (pending) {
      pending.buf.push(line)
    }
  }
  flush()

  const drop = ['net p&l', 'net pnl', 'net p l', 'total trades', 'green / red day', 'green red day', 'green/red day']
  result.unmatched = result.unmatched.filter((u) => !drop.includes(normalizeLabel(u.label)))
  return result
}
