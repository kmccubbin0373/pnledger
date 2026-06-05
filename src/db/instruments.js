// ---------------------------------------------------------------------------
// Default instrument specifications.
//
// These come from public exchange contract specs (CME Group) and standard
// option contract conventions. Every value here is the same for every trader
// regardless of broker — only commission (configured per account) changes the
// final net P&L. All of these are editable later in Settings > Instruments,
// in case a spec ever changes or you want to add a contract.
//
//   tickSize   = minimum price increment
//   tickValue  = dollar value of one tick for one contract
//   pointValue = dollar value of a full 1.00 price move (tickValue / tickSize)
// ---------------------------------------------------------------------------

export const DEFAULT_FUTURES = [
  // --- Equity index: micros ---
  { symbol: 'MNQ', name: 'Micro E-mini Nasdaq-100', kind: 'future', tickSize: 0.25, tickValue: 0.5, pointValue: 2, currency: 'USD' },
  { symbol: 'MES', name: 'Micro E-mini S&P 500', kind: 'future', tickSize: 0.25, tickValue: 1.25, pointValue: 5, currency: 'USD' },
  { symbol: 'MYM', name: 'Micro E-mini Dow', kind: 'future', tickSize: 1, tickValue: 0.5, pointValue: 0.5, currency: 'USD' },
  { symbol: 'M2K', name: 'Micro E-mini Russell 2000', kind: 'future', tickSize: 0.1, tickValue: 0.5, pointValue: 5, currency: 'USD' },
  // --- Equity index: minis ---
  { symbol: 'NQ', name: 'E-mini Nasdaq-100', kind: 'future', tickSize: 0.25, tickValue: 5, pointValue: 20, currency: 'USD' },
  { symbol: 'ES', name: 'E-mini S&P 500', kind: 'future', tickSize: 0.25, tickValue: 12.5, pointValue: 50, currency: 'USD' },
  { symbol: 'YM', name: 'E-mini Dow', kind: 'future', tickSize: 1, tickValue: 5, pointValue: 5, currency: 'USD' },
  { symbol: 'RTY', name: 'E-mini Russell 2000', kind: 'future', tickSize: 0.1, tickValue: 5, pointValue: 50, currency: 'USD' },
  // --- Energy ---
  { symbol: 'MCL', name: 'Micro WTI Crude Oil', kind: 'future', tickSize: 0.01, tickValue: 1, pointValue: 100, currency: 'USD' },
  { symbol: 'CL', name: 'WTI Crude Oil', kind: 'future', tickSize: 0.01, tickValue: 10, pointValue: 1000, currency: 'USD' },
  { symbol: 'NG', name: 'Natural Gas', kind: 'future', tickSize: 0.001, tickValue: 10, pointValue: 10000, currency: 'USD' },
  // --- Metals ---
  { symbol: 'MGC', name: 'Micro Gold', kind: 'future', tickSize: 0.1, tickValue: 1, pointValue: 10, currency: 'USD' },
  { symbol: 'GC', name: 'Gold', kind: 'future', tickSize: 0.1, tickValue: 10, pointValue: 100, currency: 'USD' },
  { symbol: 'SIL', name: 'Micro Silver', kind: 'future', tickSize: 0.005, tickValue: 5, pointValue: 1000, currency: 'USD' },
  { symbol: 'SI', name: 'Silver', kind: 'future', tickSize: 0.005, tickValue: 25, pointValue: 5000, currency: 'USD' },
  // --- FX (common) ---
  { symbol: '6E', name: 'Euro FX', kind: 'future', tickSize: 0.00005, tickValue: 6.25, pointValue: 125000, currency: 'USD' },
]

// Stock / ETF options use the standard 100-share multiplier. Premium is quoted
// per share, so a 1.00 premium move = $100 per contract. We store these as a
// single generic "equity option" instrument; the actual underlying (QQQ, SPY,
// a single stock, etc.) is typed per trade.
export const DEFAULT_OPTIONS = [
  { symbol: 'OPT', name: 'Equity / ETF option (100x)', kind: 'option', tickSize: 0.01, tickValue: 1, pointValue: 100, multiplier: 100, currency: 'USD' },
]

// Typical per-side futures commission by broker/firm, used only to PRE-FILL the
// field when you add an account. These are editable per account and are
// ballpark figures — set yours to match your statement. Commission is the only
// thing that turns gross P&L into net P&L.
export const BROKER_COMMISSION_DEFAULTS = {
  Tradovate: 0.35,
  Apex: 0.4,
  Topstep: 0.4,
  Tradeify: 0.4,
  'Alpha Futures': 0.4,
  'Funded Futures Family': 0.4,
  FundedNext: 0.4,
  'Take Profit Trader': 0.4,
  Tenacity: 0.4,
  'Lucid Trading': 0.4,
  'Interactive Brokers': 0.85,
  Webull: 0.0,
  Tradier: 0.35,
  'Public.com': 0.0,
  Robinhood: 0.0,
  Other: 0.0,
}

export const KNOWN_FIRMS = Object.keys(BROKER_COMMISSION_DEFAULTS)
