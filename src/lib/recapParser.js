// ---------------------------------------------------------------------------
// Local journal text parser for the Recap import feature.
//
// Takes raw text extracted from a .txt, .md, or .docx file and attempts to
// map the content to recap form fields using keyword matching and regex patterns.
// This is intentionally forgiving — it pre-populates whatever it can detect
// and leaves everything else blank for the user to fill in manually.
// Nothing is saved without the user reviewing the populated form first.
// ---------------------------------------------------------------------------

const KNOWN_INSTRUMENTS = [
  'MNQ','NQ','MES','ES','MYM','YM','M2K','RTY','MCL','CL','GC','MGC',
  'SIL','SI','NG','6E','SPY','QQQ','IWM','DIA','AAPL','TSLA','NVDA',
  'AMZN','MSFT','META','GOOG','AMD','NFLX','COIN','MSTR',
]

// Attempt to extract a short text value from a labelled section of a journal.
// Searches for lines like "Best trade: long MNQ at 30500" and returns the
// value part. Stops at the next blank line or the next label-like line.
function extractSection(text, ...patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(
      `(?:${pattern})[:\\s\\-–]+([^\\n]+(?:\\n(?![A-Z][^\\n]{0,40}[:\\-–])[^\\n]{1,200})?)`,
      'i'
    )
    const m = text.match(re)
    if (m) {
      const val = m[1].replace(/\n/g, ' ').trim()
      if (val.length > 1) return val.slice(0, 300)
    }
  }
  return ''
}

// Normalize a raw date string to YYYY-MM-DD.
function normDate(v) {
  if (!v) return ''
  const iso = String(v).match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const mdy = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (mdy) {
    let [, mm, dd, yy] = mdy
    if (yy.length === 2) yy = '20' + yy
    return `${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
  }
  const written = String(v).match(
    /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i
  )
  if (written) {
    const d = new Date(v)
    if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  return ''
}

export function parseJournalText(text) {
  if (!text || !text.trim()) return {}
  const result = {}

  // Date — look for any date-like pattern in the first 10 lines
  const firstLines = text.split('\n').slice(0, 10).join(' ')
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:\s*,?\s*\d{4})?)/i,
  ]
  for (const dp of datePatterns) {
    const m = firstLines.match(dp)
    if (m) {
      const d = normDate(m[1])
      if (d) { result.date = d; break }
    }
  }

  // Instrument — scan for known symbols
  const upperText = text.toUpperCase()
  for (const sym of KNOWN_INSTRUMENTS) {
    if (new RegExp(`\\b${sym}\\b`).test(upperText)) {
      result.instrument = sym
      break
    }
  }

  // Market condition
  if (/\btrend\s*day\b|\btrending\b/i.test(text)) result.marketCondition = 'Trend day'
  else if (/\brange\s*day\b|\branging\b|\brange\s*bound\b/i.test(text)) result.marketCondition = 'Range day'
  else if (/\bchop(?:py)?\b/i.test(text)) result.marketCondition = 'Chop'
  else if (/\bnews[\s-]driven\b|\bhigh.impact news\b|\bnfp\b|\bfomc\b|\bcpi\b/i.test(text)) result.marketCondition = 'News-driven'

  // Grade — look for explicit grade mentions
  const gradeMatch = text.match(
    /\b(?:grade|day grade|overall)[:\s]+([A-F][+]?)\b|\b([A-F][+]?)\s*(?:grade|day)\b|\bgraded?\s+(?:an?\s+)?([A-F][+]?)\b/i
  )
  if (gradeMatch) {
    const raw = (gradeMatch[1] || gradeMatch[2] || gradeMatch[3] || '').toUpperCase()
    if (['A+','A','B','C','D','F'].includes(raw)) result.grade = raw
  }

  // Section fields
  result.bestTrade = extractSection(text,
    'best trade', 'top trade', 'biggest win', 'best position', 'favorite trade')

  result.worstTrade = extractSection(text,
    'worst trade', 'bad trade', 'biggest loss', 'worst position', 'losing trade')

  result.bestSetup = extractSection(text,
    'best setup', 'what worked', 'setup that worked', 'working setup',
    'setup worked', 'strongest setup')

  result.failedSetup = extractSection(text,
    'failed setup', 'what didn\'t work', 'what did not work', 'setup failed',
    'worst setup', 'setup that failed', 'didn\'t work', 'did not work')

  result.didWell = extractSection(text,
    'did well', 'went well', 'proud of', 'positive', 'good thing',
    'one thing i did well', 'did right', 'worked well')

  result.toFix = extractSection(text,
    'to fix', 'fix tomorrow', 'improve', 'work on', 'next time',
    'one thing to fix', 'better tomorrow', 'should have', 'need to',
    'going to work on', 'lesson')

  // Discipline — yes/no detection
  if (/followed\s+(?:my\s+)?(?:max\s+trades|trade\s+limit)|stayed\s+within\s+(?:my\s+)?trade/i.test(text))
    result.followedMaxTrades = 'Yes'
  if (/broke\s+(?:my\s+)?(?:max\s+trades|trade\s+limit)|exceeded\s+(?:my\s+)?trade\s+limit|overtraded/i.test(text))
    result.followedMaxTrades = 'No'

  if (/respected\s+(?:my\s+)?(?:risk|stop|size)|followed\s+(?:my\s+)?risk/i.test(text))
    result.respectedRisk = 'Yes'
  if (/didn'?t\s+respect\s+(?:my\s+)?risk|violated\s+risk|moved\s+(?:my\s+)?stop|ignored\s+stop/i.test(text))
    result.respectedRisk = 'No'

  if (/forced|revenge\s+trade|fomo|chased|shouldn'?t\s+have\s+taken/i.test(text))
    result.forcedAnything = 'Yes'
  else if (/no\s+forced|didn'?t\s+force|no\s+revenge/i.test(text))
    result.forcedAnything = 'No'

  // Mental state fields
  const sleepM = text.match(/\bsleep[:\s]+([^\n,\.]{1,60})/i)
  if (sleepM) result.sleep = sleepM[1].trim()

  const energyM = text.match(/\benergy[:\s]+([^\n,\.]{1,60})/i)
  if (energyM) result.energy = energyM[1].trim()

  const stressM = text.match(/\bstress[:\s]+([^\n,\.]{1,60})/i)
  if (stressM) result.stress = stressM[1].trim()

  return result
}

// ---------------------------------------------------------------------------
// Export formatters — produce formatted text from a saved recap object.
// ---------------------------------------------------------------------------

export function exportAsTxt(recap, netPnl) {
  const line = (label, value) => `${label}: ${value || '—'}`
  return [
    'P n Ledger — Daily Trading Recap',
    '='.repeat(40),
    '',
    line('Date', recap.date),
    line('Instrument', recap.instrument),
    line('Market condition', recap.marketCondition),
    line('Grade', recap.grade),
    '',
    '--- TRADES ---',
    line('Best trade', recap.bestTrade),
    line('Worst trade', recap.worstTrade),
    line('Best setup', recap.bestSetup),
    line('Failed setup', recap.failedSetup),
    '',
    '--- DISCIPLINE ---',
    line('Followed max trades', recap.followedMaxTrades),
    line('Respected risk', recap.respectedRisk),
    line('Forced anything', recap.forcedAnything),
    '',
    '--- REFLECTION ---',
    line('One thing I did well', recap.didWell),
    line('One thing to fix tomorrow', recap.toFix),
    '',
    '--- HOW I FELT ---',
    line('Sleep', recap.sleep),
    line('Energy', recap.energy),
    line('Stress', recap.stress),
    '',
    netPnl !== undefined ? line('Net P/L (from trades)', `$${Number(netPnl).toFixed(2)}`) : '',
  ].filter((l) => l !== undefined).join('\n')
}

export function exportAsMd(recap, netPnl) {
  const val = (v) => v || '—'
  return `# Daily Trading Recap — ${recap.date}

**Grade:** ${val(recap.grade)}
**Instrument:** ${val(recap.instrument)}
**Market condition:** ${val(recap.marketCondition)}
${netPnl !== undefined ? `**Net P/L:** $${Number(netPnl).toFixed(2)}  ` : ''}

## Trades
| Field | Value |
|---|---|
| Best trade | ${val(recap.bestTrade)} |
| Worst trade | ${val(recap.worstTrade)} |
| Best setup | ${val(recap.bestSetup)} |
| Failed setup | ${val(recap.failedSetup)} |

## Discipline
| Field | Value |
|---|---|
| Followed max trades | ${val(recap.followedMaxTrades)} |
| Respected risk | ${val(recap.respectedRisk)} |
| Forced anything | ${val(recap.forcedAnything)} |

## Reflection

**One thing I did well:**
${val(recap.didWell)}

**One thing to fix tomorrow:**
${val(recap.toFix)}

## How I Felt
| Field | Value |
|---|---|
| Sleep | ${val(recap.sleep)} |
| Energy | ${val(recap.energy)} |
| Stress | ${val(recap.stress)} |
`
}
