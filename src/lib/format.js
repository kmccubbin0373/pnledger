// Formatting + small date helpers.

export const fmtMoney = (n, { sign = false, cents = true } = {}) => {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  const str = abs.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
  const s = `$${str}`
  if (v < 0) return `-${s}`
  if (sign && v > 0) return `+${s}`
  return s
}

export const fmtMoneyShort = (n) => {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  const s = v < 0 ? '-' : v > 0 ? '+' : ''
  if (abs >= 1000) return `${s}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  return `${s}$${Math.round(abs)}`
}

export const fmtPct = (n) => `${Math.round(Number(n) || 0)}%`

export const fmtNum = (n, dp = 2) => (Number(n) || 0).toFixed(dp)

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// US equity / CME market holidays (full-day closures). Pre-populated so the
// calendar can mark non-trading days. Maintained as static data; editable in
// code. Covers a rolling window around the current period.
export const MARKET_HOLIDAYS = {
  '2025-01-01': "New Year's Day",
  '2025-01-09': 'National Day of Mourning',
  '2025-01-20': 'Martin Luther King Jr. Day',
  '2025-02-17': "Washington's Birthday",
  '2025-04-18': 'Good Friday',
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-11-27': 'Thanksgiving',
  '2025-12-25': 'Christmas',
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Washington's Birthday",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-03': 'Independence Day (observed)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving',
  '2026-12-25': 'Christmas',
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King Jr. Day',
  '2027-02-15': "Washington's Birthday",
  '2027-03-26': 'Good Friday',
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (observed)',
  '2027-07-05': 'Independence Day (observed)',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving',
  '2027-12-24': 'Christmas (observed)',
}
