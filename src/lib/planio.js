// Plan export/import. buildPlanTxt / buildPlanMd produce shareable text.
// parsePlanText tolerantly pulls fields back out of an exported plan OR a
// loosely-formatted plan document. Screenshots are blobs, so they are not
// embedded — the export notes the count instead.

const BIASES = ['Long', 'Short', 'Neutral', 'Stand aside']

function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function buildPlanMd(plan) {
  const shots = (plan.screenshots || []).length
  const lines = [
    `# Trading Plan — ${plan.date || ''}`.trim(), '',
    `**Bias:** ${plan.bias || '—'}`,
    `**Max trades:** ${plan.maxTrades ?? '—'}`,
    `**Daily max loss:** ${money(plan.maxLossDollars)}`, '',
    `## Setups I'm hunting`, (plan.lookingFor || '').trim() || '—', '',
    `## What I'm avoiding`, (plan.avoiding || '').trim() || '—', '',
    `## I stop early if`, (plan.stopEarlyIf || '').trim() || '—', '',
    `## Notes`, (plan.notes || '').trim() || '—',
  ]
  if (shots) lines.push('', `_${shots} setup screenshot${shots > 1 ? 's' : ''} attached (kept in-app, not in this file)._`)
  return lines.join('\n')
}

export function buildPlanTxt(plan) {
  const shots = (plan.screenshots || []).length
  const lines = [
    `TRADING PLAN — ${plan.date || ''}`.trim(), '',
    `Bias: ${plan.bias || '—'}`,
    `Max trades: ${plan.maxTrades ?? '—'}`,
    `Daily max loss: ${money(plan.maxLossDollars)}`, '',
    `Setups I'm hunting:`, (plan.lookingFor || '').trim() || '—', '',
    `What I'm avoiding:`, (plan.avoiding || '').trim() || '—', '',
    `I stop early if:`, (plan.stopEarlyIf || '').trim() || '—', '',
    `Notes:`, (plan.notes || '').trim() || '—',
  ]
  if (shots) lines.push('', `${shots} setup screenshot(s) attached (kept in-app, not in this file).`)
  return lines.join('\n')
}

export function parsePlanText(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const out = { date: '', bias: '', lookingFor: '', avoiding: '', maxLossDollars: '', maxTrades: '', stopEarlyIf: '', notes: '' }
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/); if (iso) out.date = iso[1]
  const biasM = text.match(/bias\s*[:*]*\s*(Long|Short|Neutral|Stand\s*aside)/i)
  if (biasM) { const b = biasM[1].replace(/\s+/g, ' ').toLowerCase(); out.bias = BIASES.find((x) => x.toLowerCase() === b) || '' }
  const mtM = text.match(/max\s*trades\s*[:*]*\s*(\d+)/i); if (mtM) out.maxTrades = mtM[1]
  const mlM = text.match(/(?:daily\s*max\s*loss|max\s*loss)\s*[:*]*\s*\$?\s*([\d,]+)/i); if (mlM) out.maxLossDollars = mlM[1].replace(/,/g, '')
  const lines = text.split('\n')
  const sectionKey = (line) => {
    const l = line.replace(/^#+\s*/, '').replace(/[:*]+\s*$/, '').trim().toLowerCase()
    if (/^setups?\s*i'?m\s*hunting$/.test(l) || l === 'hunting' || l === 'setups') return 'lookingFor'
    if (/^what\s*i'?m\s*avoiding$/.test(l) || l === 'avoiding') return 'avoiding'
    if (/^i\s*stop\s*early\s*if$/.test(l) || l === 'stop early' || l === 'stop early if') return 'stopEarlyIf'
    if (l === 'notes') return 'notes'
    return null
  }
  let cur = null
  const buf = { lookingFor: [], avoiding: [], stopEarlyIf: [], notes: [] }
  for (const line of lines) {
    const key = sectionKey(line)
    if (key) { cur = key; continue }
    if (/^(bias|max\s*trades|daily\s*max\s*loss|max\s*loss)\s*[:*]/i.test(line)) { cur = null; continue }
    if (/^#?\s*trading plan/i.test(line)) { cur = null; continue }
    if (cur) buf[cur].push(line)
  }
  const clean = (arr) => arr.join('\n').replace(/^\s*[-—]\s*$/gm, '').trim()
  out.lookingFor = clean(buf.lookingFor); out.avoiding = clean(buf.avoiding)
  out.stopEarlyIf = clean(buf.stopEarlyIf)
  out.notes = clean(buf.notes).replace(/^_?\d+\s*setup screenshot.*$/im, '').trim()
  return out
}
