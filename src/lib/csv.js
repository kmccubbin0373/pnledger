// Lightweight CSV parsing + broker mapping. No external dependency: a small
// RFC-style parser that handles quoted fields and commas inside quotes.

export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length && r.some((v) => v.trim() !== ''))
}

export function toObjects(rows) {
  if (!rows.length) return { headers: [], records: [] }
  const headers = rows[0].map((h) => h.trim())
  const records = rows.slice(1).map((r) => {
    const o = {}
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim()
    })
    return o
  })
  return { headers, records }
}

// The canonical fields we want to map any broker CSV onto.
export const TARGET_FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'instrumentSymbol', label: 'Instrument / symbol', required: true },
  { key: 'direction', label: 'Direction (long/short or buy/sell)', required: true },
  { key: 'quantity', label: 'Quantity / contracts', required: true },
  { key: 'entryPrice', label: 'Entry / fill price', required: true },
  { key: 'exitPrice', label: 'Exit price', required: false },
  { key: 'entryTime', label: 'Time', required: false },
]

// Header presets per broker. Keys are our target fields, values are likely
// column header names in that broker's export. Used to auto-guess the mapping;
// the user can always adjust it before importing.
export const BROKER_PRESETS = {
  Tradovate: {
    date: ['Date', 'Timestamp', 'Bought Timestamp', 'Sold Timestamp'],
    instrumentSymbol: ['Contract', 'Symbol', 'Product'],
    direction: ['B/S', 'Side', 'Action'],
    quantity: ['Qty', 'Quantity', 'filledQty'],
    entryPrice: ['Buy Price', 'Price', 'avgPrice', 'Fill Price'],
    exitPrice: ['Sell Price'],
    entryTime: ['Time', 'Bought Timestamp', 'Timestamp'],
  },
  'Interactive Brokers': {
    date: ['Date/Time', 'DateTime', 'TradeDate'],
    instrumentSymbol: ['Symbol', 'UnderlyingSymbol'],
    direction: ['Buy/Sell', 'Side'],
    quantity: ['Quantity', 'Qty'],
    entryPrice: ['T. Price', 'Price', 'TradePrice'],
    exitPrice: [],
    entryTime: ['Date/Time', 'Time'],
  },
  TopstepX: {
    date: ['Date', 'Timestamp', 'Fill Time', 'FillTime', 'Trade Date'],
    instrumentSymbol: ['Symbol', 'Contract', 'Instrument', 'Product'],
    direction: ['Side', 'B/S', 'Buy/Sell', 'Action'],
    quantity: ['Qty', 'Size', 'Quantity', 'Filled Qty'],
    entryPrice: ['Price', 'Avg Price', 'AvgPrice', 'Fill Price', 'FillPrice'],
    exitPrice: [],
    entryTime: ['Time', 'Fill Time', 'FillTime', 'Timestamp'],
  },
  NinjaTrader: {
    date: ['Entry time', 'Time', 'Date'],
    instrumentSymbol: ['Instrument', 'Symbol'],
    direction: ['Market pos.', 'Market position', 'Side', 'Action'],
    quantity: ['Quantity', 'Qty'],
    entryPrice: ['Entry price', 'Price', 'Avg. price'],
    exitPrice: ['Exit price'],
    entryTime: ['Entry time', 'Time'],
  },
  Tradier: {
    date: ['date', 'Date', 'trade_date', 'created_at'],
    instrumentSymbol: ['symbol', 'Symbol', 'underlying'],
    direction: ['side', 'Side', 'type'],
    quantity: ['quantity', 'Quantity', 'qty'],
    entryPrice: ['price', 'Price', 'avg_fill_price', 'exec_price'],
    exitPrice: [],
    entryTime: ['transaction_date', 'time', 'created_at'],
  },
  Webull: {
    date: ['Filled Time', 'Placed Time', 'Time', 'Date'],
    instrumentSymbol: ['Symbol', 'Name', 'Ticker'],
    direction: ['Side', 'Action', 'B/S'],
    quantity: ['Filled', 'Quantity', 'Qty', 'Total Qty'],
    entryPrice: ['Avg Price', 'Price', 'Filled Price'],
    exitPrice: [],
    entryTime: ['Filled Time', 'Time', 'Placed Time'],
  },
  Robinhood: {
    date: ['Date', 'Activity Date', 'Process Date'],
    instrumentSymbol: ['Instrument', 'Symbol', 'Ticker'],
    direction: ['Side', 'Trans Code', 'Action'],
    quantity: ['Quantity', 'Qty', 'Shares'],
    entryPrice: ['Price', 'Average Price'],
    exitPrice: [],
    entryTime: ['Time'],
  },
  Generic: {},
}

export function guessMapping(headers, presetName) {
  const preset = BROKER_PRESETS[presetName] || {}
  const lc = headers.map((h) => h.toLowerCase())
  const mapping = {}
  for (const field of TARGET_FIELDS) {
    const candidates = preset[field.key] || []
    let found = ''
    for (const cand of candidates) {
      const idx = lc.indexOf(cand.toLowerCase())
      if (idx >= 0) {
        found = headers[idx]
        break
      }
    }
    // Fallback: fuzzy contains match on the field key itself.
    if (!found) {
      const idx = lc.findIndex((h) => h.includes(field.key.toLowerCase()))
      if (idx >= 0) found = headers[idx]
    }
    mapping[field.key] = found
  }
  return mapping
}

// Detect whether a CSV is an options trade export by checking its column headers.
// Returns true if any header clearly indicates options data.
export function isOptionsCSV(headers) {
  const lc = headers.map((h) => h.toLowerCase().replace(/[^a-z]/g, ''))
  return ['entrypremium', 'exitpremium', 'optiontype', 'strike', 'expiry',
    'expiration', 'underlying'].some((k) => lc.includes(k))
}

// Parse an options CSV and return trade objects with instrumentKind: 'option'.
// Handles the column names used in the sample options CSV format as well as
// reasonable variations. The entry/exit prices are option premiums per share;
// P&L = (exitPremium - entryPremium) * 100 * contracts (for long calls/puts).
export function parseOptionsCSV(text) {
  const { records } = toObjects(parseCSV(text))
  if (!records.length) return []

  return records
    .map((r) => {
      const underlying = (
        r['Underlying'] || r['Symbol'] || r['Ticker'] || ''
      ).toUpperCase().trim()

      const entryPremium = Number(
        r['EntryPremium'] || r['Entry Premium'] || r['Entry'] || r['Price'] || 0
      )
      const exitPremium = Number(
        r['ExitPremium'] || r['Exit Premium'] || r['Exit'] || 0
      )
      const qty = Number(
        r['Contracts'] || r['Qty'] || r['Quantity'] || 1
      )
      const dirRaw = r['Direction'] || r['B/S'] || r['Side'] || 'long'
      const dir = dirRaw.toLowerCase().includes('sell') ||
        dirRaw.toLowerCase().includes('short') ? 'short' : 'long'
      const date = normDate(r['Date'] || '')
      const entryTime = normTime(r['EntryTime'] || r['Entry Time'] || r['Time'] || '')
      const optType = (r['OptionType'] || r['Option Type'] || r['Type'] || 'call')
        .toLowerCase().includes('put') ? 'put' : 'call'
      const strike = r['Strike'] ? Number(r['Strike']) : null
      const expiry = normDate(r['Expiry'] || r['Expiration'] || r['Exp'] || '')
      const strategy = (r['Strategy'] || '').trim() || null

      return {
        instrumentSymbol: underlying,
        instrumentKind: 'option',
        direction: dir,
        date,
        entryTime: entryTime || null,
        entryPrice: entryPremium,
        quantity: qty,
        optionType: optType,
        strike,
        expiry: expiry || null,
        exits: exitPremium > 0
          ? [{ price: exitPremium, qty, time: entryTime || null }]
          : [],
        strategy,
      }
    })
    .filter((t) => t.instrumentSymbol && t.entryPrice > 0)
}

const normDirection = (v) => {
  const s = (v || '').toLowerCase()
  if (s.startsWith('s') || s.includes('sell') || s.includes('short')) return 'short'
  return 'long'
}

const normNumber = (v) => {
  if (v == null) return 0
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const normDate = (v) => {
  if (!v) return ''
  // Try to pull a YYYY-MM-DD out of common formats.
  const iso = String(v).match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const mdy = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (mdy) {
    let [, mm, dd, yy] = mdy
    if (yy.length === 2) yy = '20' + yy
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  const d = new Date(v)
  if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return ''
}

const normTime = (v) => {
  if (!v) return ''
  const m = String(v).match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

// Convert mapped records into draft trade objects ready to review/save.
export function recordsToTrades(records, mapping) {
  return records.map((r) => {
    const get = (k) => (mapping[k] ? r[mapping[k]] : '')
    const entry = normNumber(get('entryPrice'))
    const exit = normNumber(get('exitPrice'))
    const qty = normNumber(get('quantity')) || 1
    const t = {
      date: normDate(get('date')),
      instrumentSymbol: (get('instrumentSymbol') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6),
      direction: normDirection(get('direction')),
      quantity: qty,
      entryPrice: entry,
      entryTime: normTime(get('entryTime')),
      exits: exit ? [{ price: exit, qty, time: normTime(get('entryTime')) }] : [],
    }
    return t
  })
}

// ---------------------------------------------------------------------------
// Tradovate fills-to-trades converter.
//
// Tradovate's fills export has one row per fill (each entry and exit is its
// own row). This function groups them into complete trades using position
// tracking: when the running net position returns to zero, the trade is done.
//
// Handles:
//   - Simple 1-entry / 1-exit trades
//   - Partial exits (multiple exit fills)
//   - Pyramiding entries (multiple entry fills before closing)
//   - Both long and short trades
//   - The entry price stored on the trade is the VWAP of all entry fills.
// ---------------------------------------------------------------------------
export function parseTradovateFills(text) {
  const { records } = toObjects(parseCSV(text))
  if (!records.length) return []

  // Sort by timestamp ascending so we process fills in order.
  const fills = records
    .map((r) => ({
      action: (r['B/S'] || r['_action'] || '').trim(),
      qty: Math.abs(Number(r['Quantity'] || r['_qty'] || 0)),
      price: Number(r['Price'] || r['_price'] || 0),
      time: r['Timestamp'] || r['_timestamp'] || '',
      date: normFillDate(r['Date'] || r['_tradeDate'] || ''),
      symbol: (r['Contract'] || '').replace(/[FGHJKMNQUVXZ]\d+$/, '') || 'MNQ',
      commission: Number(r['commission'] || 0),
    }))
    .filter((f) => f.qty > 0 && f.price > 0)
    .sort((a, b) => a.time.localeCompare(b.time))

  const trades = []
  let pos = 0           // running net position (+ = long, - = short)
  let entryFills = []   // fills that opened / added to the current position
  let exitFills = []    // fills that reduced the current position

  for (const fill of fills) {
    const isBuy = fill.action.toLowerCase().includes('buy')
    const fillDir = isBuy ? 1 : -1
    const prevPos = pos
    pos += fillDir * fill.qty

    if (prevPos === 0) {
      // Opening a brand new position from flat.
      entryFills = [fill]
      exitFills = []
    } else if (fillDir === Math.sign(prevPos)) {
      // Fill goes WITH the current position — pyramiding (adding to the trade).
      entryFills.push(fill)
    } else {
      // Fill goes AGAINST the current position — it's a closing/exit fill.
      if (pos === 0) {
        // Position fully closed.
        exitFills.push(fill)
        trades.push(buildTrade(entryFills, exitFills))
        entryFills = []
        exitFills = []
      } else if (Math.sign(pos) !== Math.sign(prevPos)) {
        // Position flipped (e.g. long 2 then sell 5 → short 3). Split the fill:
        // the closing portion closes the old trade, the rest opens a new one.
        const closingQty = Math.abs(prevPos)
        const openingQty = fill.qty - closingQty
        exitFills.push({ ...fill, qty: closingQty })
        trades.push(buildTrade(entryFills, exitFills))
        entryFills = [{ ...fill, qty: openingQty }]
        exitFills = []
      } else {
        // Partial exit — position reduced but still open on same side.
        exitFills.push(fill)
      }
    }
  }

  // If there is still an open position at end of file, emit a partial trade.
  if (entryFills.length > 0) {
    trades.push(buildTrade(entryFills, exitFills, true))
  }

  return trades
}

function normFillDate(v) {
  if (!v) return ''
  // "5/29/26" or "2026-05-29" → "2026-05-29"
  const iso = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const mdy = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (mdy) {
    let [, mm, dd, yy] = mdy
    if (yy.length === 2) yy = '20' + yy
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return ''
}

function vwap(fills) {
  const totalQty = fills.reduce((s, f) => s + f.qty, 0)
  if (!totalQty) return 0
  return fills.reduce((s, f) => s + f.price * f.qty, 0) / totalQty
}

function normFillTime(ts) {
  // "05/29/2026 10:45:05" or "2026-05-29T14:45:05.734Z" → "10:45"
  const m = String(ts).match(/(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

function buildTrade(entryFills, exitFills, isOpen = false) {
  const totalEntryQty = entryFills.reduce((s, f) => s + f.qty, 0)
  const firstEntry = entryFills[0]
  const direction = firstEntry.action.toLowerCase().includes('buy') ? 'long' : 'short'
  const avgEntry = vwap(entryFills)
  const symbol = firstEntry.symbol.toUpperCase()
  // Sum commission across ALL fills (entries + exits) — this is the exact
  // commission Tradovate deducted, so net P&L will match the broker statement.
  const totalCommission = [...entryFills, ...exitFills].reduce((s, f) => s + (f.commission || 0), 0)

  return {
    instrumentSymbol: symbol,
    instrumentKind: 'future',
    direction,
    date: firstEntry.date,
    entryTime: normFillTime(firstEntry.time),
    entryPrice: Math.round(avgEntry * 100) / 100,
    quantity: totalEntryQty,
    exits: exitFills.map((f) => ({
      price: f.price,
      qty: f.qty,
      time: normFillTime(f.time),
    })),
    // Store individual entry fills for FIFO P&L calculation.
    entryFills: entryFills.length > 1
      ? entryFills.map((f) => ({ price: f.price, qty: f.qty }))
      : undefined,
    // Store exact broker commission so net P&L matches the statement.
    importedCommission: totalCommission > 0 ? totalCommission : undefined,
    isOpenPosition: isOpen,
  }
}
