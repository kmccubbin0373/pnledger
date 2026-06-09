import { jsPDF } from 'jspdf'
import { computePnl } from './pnl'
import { fmtMoney } from './format'
import { SECTION_ORDER } from '../db/recapFields'

const PT = { MARGIN: 40, PAGE_W: 612, PAGE_H: 792 }
PT.CONTENT_W = PT.PAGE_W - PT.MARGIN * 2

const C = {
  darkNavy: [15,  23,  42],
  blue:     [24,  95, 165],
  green:    [22, 163,  74],
  red:      [220,  38,  38],
  text:     [30,  41,  59],
  text2:    [71,  85, 105],
  text3:    [148, 163, 184],
  bg2:      [241, 245, 249],
  border:   [226, 232, 240],
  white:    [255, 255, 255],
  summaryBg:[240, 245, 252],
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
function getImgDims(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve({ w: 4, h: 3 })
    img.src = dataUrl
  })
}
function imgFmt(dataUrl) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

class PDFBuilder {
  constructor() {
    this.doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' })
    this.y = PT.MARGIN
  }
  get d() { return this.doc }

  need(h) {
    if (this.y + h > PT.PAGE_H - PT.MARGIN) { this.d.addPage(); this.y = PT.MARGIN }
  }
  fillRect(x, y, w, h, color) {
    this.d.setFillColor(...color); this.d.rect(x, y, w, h, 'F')
  }
  txt(str, x, y, opts = {}) {
    if (str == null || str === '') return
    this.d.text(String(str), x, y, opts)
  }
  style(color, size, weight = 'normal') {
    this.d.setTextColor(...color); this.d.setFont('helvetica', weight); this.d.setFontSize(size)
  }
  hr() {
    this.need(10); this.d.setDrawColor(...C.border); this.d.setLineWidth(0.5)
    this.d.line(PT.MARGIN, this.y, PT.PAGE_W - PT.MARGIN, this.y); this.y += 10
  }

  pageHeader(dateStr, subtitle) {
    this.fillRect(0, 0, PT.PAGE_W, 50, C.darkNavy)
    this.style(C.white, 16, 'bold');         this.txt('P n Ledger', PT.MARGIN, 32)
    this.style([219,234,254], 9.5, 'normal'); this.txt(`${subtitle}  ·  ${dateStr}`, PT.MARGIN, 44)
    this.style(C.white,  11, 'bold'); this.txt('P', PT.PAGE_W - PT.MARGIN - 28, 34, { align: 'right' })
    this.style(C.green,  11, 'bold'); this.txt('/', PT.PAGE_W - PT.MARGIN - 14, 34, { align: 'right' })
    this.style(C.white,  11, 'bold'); this.txt('L', PT.PAGE_W - PT.MARGIN - 4,  34, { align: 'right' })
    this.y = 64
  }

  sectionBar(title) {
    this.need(26)
    this.fillRect(PT.MARGIN, this.y, PT.CONTENT_W, 20, C.darkNavy)
    this.style(C.white, 8, 'bold'); this.txt(title.toUpperCase(), PT.MARGIN + 8, this.y + 13)
    this.y += 26
  }

  kv(label, value, opts = {}) {
    if (value == null || value === '') return
    const { color = C.text, indent = 0 } = opts
    this.need(15)
    this.style(C.text3, 8, 'normal'); this.txt(label, PT.MARGIN + indent, this.y)
    this.style(color, 9.5, 'bold');   this.txt(String(value), PT.MARGIN + indent + 130, this.y)
    this.y += 14
  }

  kvRow(pairs) {
    const cw = (PT.CONTENT_W - 20) / 2
    const rows = Math.ceil(pairs.length / 2)
    for (let r = 0; r < rows; r++) {
      this.need(15)
      for (let c = 0; c < 2; c++) {
        const idx = r * 2 + c; if (idx >= pairs.length) break
        const [lbl, val, col] = pairs[idx]
        const ox = PT.MARGIN + c * (cw + 20)
        this.style(C.text3, 8, 'normal');       this.txt(lbl, ox, this.y)
        this.style(col || C.text, 9.5, 'bold'); this.txt(String(val ?? '—'), ox + 112, this.y)
      }
      this.y += 15
    }
  }

  para(label, text, indent = 0) {
    if (!text) return
    this.need(22)
    this.style(C.text3, 8, 'bold'); this.txt(label, PT.MARGIN + indent, this.y); this.y += 12
    const lines = this.d.splitTextToSize(String(text), PT.CONTENT_W - indent)
    this.style(C.text, 9.5, 'normal')
    for (const line of lines) { this.need(13); this.txt(line, PT.MARGIN + indent, this.y); this.y += 13 }
    this.y += 5
  }

  async addImg(shot, caption, maxH = 240) {
    const { blob, label, name } = shot
    if (!blob) return
    try {
      const dataUrl = await blobToDataUrl(blob)
      const { w, h } = await getImgDims(dataUrl)
      let iw = PT.CONTENT_W
      let ih = Math.round(iw * h / w)
      if (ih > maxH) { ih = maxH; iw = Math.round(ih * w / h) }
      const cap = caption || label || name || ''
      this.need(ih + (cap ? 26 : 14))
      if (cap) { this.style(C.text3, 8, 'bold'); this.txt(cap.toUpperCase(), PT.MARGIN, this.y); this.y += 12 }
      this.d.addImage(dataUrl, imgFmt(dataUrl), PT.MARGIN, this.y, iw, ih)
      this.y += ih + 10
    } catch (e) {
      console.warn('pdfExport: skipping image', shot?.name, e)
    }
  }

  save(filename) { this.d.save(filename) }
}

// ── Section builders ──────────────────────────────────────────────────────────

async function addPlanSection(b, plan) {
  if (!plan) return
  b.sectionBar('Plan')
  b.y += 4

  b.kvRow([
    ['Bias',           plan.bias            || '—'],
    ['Max trades',     plan.maxTrades       ?? '—'],
    ['Daily max loss', plan.maxLossDollars != null ? fmtMoney(plan.maxLossDollars) : '—'],
    ['Invalidation',   plan.invalidation    || '—'],
  ])
  b.y += 2

  if (plan.lookingFor)  b.para("Setups I'm hunting", plan.lookingFor)
  if (plan.avoiding)    b.para("What I'm avoiding",  plan.avoiding)
  if (plan.stopEarlyIf) b.para('I stop early if',    plan.stopEarlyIf)
  if (plan.notes)       b.para('Notes',               plan.notes)

  const shots = plan.screenshots || []
  if (shots.length) {
    b.y += 2
    b.style(C.text3, 8, 'bold'); b.txt('SETUP SCREENSHOTS', PT.MARGIN, b.y); b.y += 12
    for (const s of shots) await b.addImg(s, s.label || s.name, 260)
  }
  b.y += 8
}

async function addTradesSection(b, trades, accountsById, instrumentsBySymbol) {
  if (!trades.length) return
  b.sectionBar('Trades')
  b.y += 4

  const nets = trades.map(t => computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net)
  const total = nets.reduce((s, n) => s + n, 0)
  const wins  = nets.filter(n => n > 0).length

  b.kvRow([
    ['Trades',   trades.length],
    ['Net P/L',  fmtMoney(total, { sign: true }), total >= 0 ? C.green : C.red],
    ['Wins',     `${wins} / ${trades.length}`],
    ['Win rate', `${trades.length ? Math.round(wins / trades.length * 100) : 0}%`],
  ])
  b.hr()

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]
    const net  = nets[i]
    const dir  = t.direction === 'long' ? '↑ Long' : t.direction === 'short' ? '↓ Short' : (t.direction || '—')
    const exitP = t.exits?.[0]?.price ?? '—'

    b.need(60)
    b.fillRect(PT.MARGIN, b.y, PT.CONTENT_W, 20, C.bg2)
    b.style(C.text, 9.5, 'bold')
    b.txt(`Trade #${i + 1}  ·  ${t.instrumentSymbol || ''}  ·  ${dir}`, PT.MARGIN + 8, b.y + 13)
    b.style(net >= 0 ? C.green : C.red, 10, 'bold')
    b.txt(fmtMoney(net, { sign: true }), PT.PAGE_W - PT.MARGIN - 4, b.y + 13, { align: 'right' })
    b.y += 24

    b.kvRow([
      ['Entry price', t.entryPrice ?? '—'], ['Exit price', exitP],
      ['Strategy',    t.strategy   || '—'], ['Grade',      t.grade || '—'],
    ])
    if (t.notes) b.para('Notes', t.notes)

    const shots = t.screenshots || []
    if (shots.length) {
      b.y += 2; b.style(C.text3, 8, 'bold'); b.txt('SCREENSHOTS', PT.MARGIN, b.y); b.y += 10
      for (const s of shots) await b.addImg(s, s.label || s.name, 220)
    }
    if (i < trades.length - 1) b.hr(); else b.y += 4
  }
  b.y += 4
}

function addRecapSection(b, recap, recapFields) {
  const fields = recap?.fields || {}
  if (!Object.keys(fields).length && !recap?.followedPlan) return
  b.sectionBar('Recap / Review')
  b.y += 4

  if (recap?.followedPlan) { b.kv('Followed the plan?', recap.followedPlan); b.y += 4 }

  const byKey = Object.fromEntries(recapFields.map(f => [f.key, f]))
  const bySection = {}
  for (const [key, value] of Object.entries(fields)) {
    const field = byKey[key]
    if (!field || (value == null || value === '')) continue
    ;(bySection[field.section || 'Other'] ||= []).push({ field, value })
  }
  for (const arr of Object.values(bySection)) arr.sort((a, b) => (a.field.order ?? 999) - (b.field.order ?? 999))

  const sections = SECTION_ORDER.concat(Object.keys(bySection).filter(s => !SECTION_ORDER.includes(s)))
  for (const sec of sections) {
    const entries = bySection[sec]; if (!entries?.length) continue
    b.y += 2; b.style(C.text3, 8, 'bold'); b.txt(sec.toUpperCase(), PT.MARGIN, b.y); b.y += 12
    for (const { field, value } of entries) {
      const v = Array.isArray(value) ? value.join(', ') : String(value)
      field.type === 'longtext' ? b.para(field.label, v) : b.kv(field.label, v)
    }
    b.y += 4
  }
}

function summaryStrip(b, trades, accountsById, instrumentsBySymbol, recap) {
  const nets  = trades.map(t => computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net)
  const total = nets.reduce((s, n) => s + n, 0)
  const wins  = nets.filter(n => n > 0).length
  const disc  = recap?.fields?.disciplineScore
  b.need(32)
  b.fillRect(PT.MARGIN, b.y, PT.CONTENT_W, 26, C.summaryBg)
  b.style(total >= 0 ? C.green : C.red, 14, 'bold')
  b.txt(fmtMoney(total, { sign: true }), PT.MARGIN + 12, b.y + 17)
  b.style(C.text2, 8.5, 'normal')
  b.txt(`${trades.length} trade${trades.length !== 1 ? 's' : ''}  ·  ${wins}W ${trades.length - wins}L  ·  ${trades.length ? Math.round(wins/trades.length*100) : 0}% win`,
        PT.MARGIN + 100, b.y + 17)
  if (disc != null && disc !== '') {
    b.style(C.text2, 8.5, 'normal')
    b.txt(`Discipline: ${disc}/10`, PT.PAGE_W - PT.MARGIN - 4, b.y + 17, { align: 'right' })
  }
  b.y += 32
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function exportDailyReport(date, { plan, trades, recap, recapFields, accountsById, instrumentsBySymbol }) {
  const b = new PDFBuilder()
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  b.pageHeader(label, 'Daily Report')
  if (trades.length) summaryStrip(b, trades, accountsById, instrumentsBySymbol, recap)
  b.y += 6
  await addPlanSection(b, plan)
  await addTradesSection(b, trades, accountsById, instrumentsBySymbol)
  addRecapSection(b, recap, recapFields)
  b.save(`pnledger-report-${date}.pdf`)
}

export async function exportPlanPdf(plan) {
  if (!plan) return
  const b = new PDFBuilder()
  const label = new Date(plan.date + 'T00:00:00').toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  b.pageHeader(label, 'Trading Plan')
  await addPlanSection(b, plan)
  b.save(`pnledger-plan-${plan.date}.pdf`)
}

export async function exportTradesPdf(date, trades, { accountsById, instrumentsBySymbol }) {
  if (!trades.length) { alert('No trades logged for this date.'); return }
  const b = new PDFBuilder()
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  b.pageHeader(label, 'Trades')
  const nets  = trades.map(t => computePnl(t, accountsById[t.accountId], instrumentsBySymbol).net)
  const total = nets.reduce((s, n) => s + n, 0)
  b.fillRect(PT.MARGIN, b.y, PT.CONTENT_W, 26, C.summaryBg)
  b.style(total >= 0 ? C.green : C.red, 14, 'bold')
  b.txt(fmtMoney(total, { sign: true }), PT.MARGIN + 12, b.y + 17)
  b.y += 32; b.y += 6
  await addTradesSection(b, trades, accountsById, instrumentsBySymbol)
  b.save(`pnledger-trades-${date}.pdf`)
}
