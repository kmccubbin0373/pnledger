// ---------------------------------------------------------------------------
// Local warning + recommendation engine.
//
// Pure functions: given accounts, trades, events, and instrument specs, return
// the set of currently-active warnings. Each warning has a stable `key` (so the
// UI can remember dismissals) and a `scope` (account / firm / universal) that
// controls where it re-appears after being dismissed.
//
// All logic is rule-based and runs offline — no API calls.
// ---------------------------------------------------------------------------
import { computePnl } from './pnl'
import { accountBalance, accountNetPnl, totalPaidOut } from './balance'
import { RULE_BY_KEY } from './rules'

// Pull the rule set that actually applies to this account right now (eval rules
// for evals, funded rules for funded accounts when they differ).
function activeRules(account) {
  if (account.rulesMode === 'differ' && account.status === 'funded') return account.fundedRules || []
  return account.evalRules || []
}
function getRule(account, key) {
  return activeRules(account).find((r) => r.type === key) || null
}

function tradesForAccount(trades, accountId) {
  return trades.filter((t) => t.accountId === accountId)
}

function bestDayProfit(trades, account, bySymbol, sinceDate) {
  const byDay = {}
  trades.forEach((t) => {
    if (sinceDate && t.date < sinceDate) return
    byDay[t.date] = (byDay[t.date] || 0) + computePnl(t, account, bySymbol).net
  })
  let best = 0
  let total = 0
  Object.values(byDay).forEach((v) => {
    total += v
    if (v > best) best = v
  })
  return { best, total }
}

// ----- main entry: compute all active warnings -----
export function computeWarnings({ accounts, trades, events, instrumentsBySymbol }) {
  const warnings = []
  const eventsByAccount = {}
  events.forEach((e) => { (eventsByAccount[e.accountId] ||= []).push(e) })

  // ---- per-account checks ----
  for (const acct of accounts) {
    if (acct.status === 'archived' || acct.status === 'blown') continue
    const aTrades = tradesForAccount(trades, acct.id)
    if (aTrades.length === 0) continue
    const aEvents = eventsByAccount[acct.id] || []
    const balance = accountBalance(acct, aTrades, instrumentsBySymbol, aEvents)
    const netPnl = accountNetPnl(acct, aTrades, instrumentsBySymbol)

    // --- drawdown / max loss limit cushion ---
    const mllRule = getRule(acct, 'mll')
    if (mllRule && Number(mllRule.value) > 0) {
      const mll = Number(mllRule.value)
      const ddMode = getRule(acct, 'drawdownMode')?.value || 'Static'
      const start = Number(acct.startingBalance) || 0
      let floor
      if (ddMode.startsWith('Trailing')) {
        // Trailing: floor follows the peak balance up by (start - (start - mll)).
        // Peak balance = start + max cumulative profit.
        let peak = start
        let running = start
        const ordered = [...aTrades].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0))
        ordered.forEach((t) => { running += computePnl(t, acct, instrumentsBySymbol).net; if (running > peak) peak = running })
        floor = peak - mll
      } else {
        floor = start - mll
      }
      const cushion = balance - floor
      const cushionPct = mll > 0 ? cushion / mll : 1
      if (cushion <= 0) {
        warnings.push({
          key: `dd:${acct.id}`, severity: 'red', scope: { type: 'account', id: acct.id },
          title: `${acct.name} has hit its loss limit`,
          message: `Balance ${money(balance)} is at or below the ${ddMode.toLowerCase()} floor of ${money(floor)}.`,
          recommendation: `This account is effectively done. Stop trading it and review what led here in your recap.`,
        })
      } else if (cushionPct < 0.1) {
        warnings.push({
          key: `dd:${acct.id}`, severity: 'red', scope: { type: 'account', id: acct.id },
          title: `${acct.name} is close to blowing`,
          message: `Only ${money(cushion)} of cushion left before the ${ddMode.toLowerCase()} loss limit (${pct(cushionPct)} remaining).`,
          recommendation: `Cut size hard or stop for the day. One average loss could end this account.`,
        })
      } else if (cushionPct < 0.2) {
        warnings.push({
          key: `dd:${acct.id}`, severity: 'amber', scope: { type: 'account', id: acct.id },
          title: `${acct.name} drawdown is getting tight`,
          message: `${money(cushion)} of cushion left before the loss limit (${pct(cushionPct)} remaining).`,
          recommendation: `Consider trading smaller until you rebuild the buffer.`,
        })
      }
    }

    // --- consistency requirement ---
    const consRule = getRule(acct, 'consistencyReq')
    if (consRule && Number(consRule.value) > 0 && netPnl > 0) {
      const consPct = Number(consRule.value) / 100
      const resetRule = getRule(acct, 'consistencyReset')?.value
      let sinceDate = null
      if (resetRule === 'Resets after each payout') {
        const payouts = aEvents.filter((e) => e.type === 'payout').sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        if (payouts[0]) sinceDate = payouts[0].date
      }
      const { best, total } = bestDayProfit(aTrades, acct, instrumentsBySymbol, sinceDate)
      if (total > 0) {
        const share = best / total
        if (share > consPct) {
          warnings.push({
            key: `cons:${acct.id}`, severity: 'red', scope: { type: 'account', id: acct.id },
            title: `${acct.name} fails the consistency rule`,
            message: `Best day is ${money(best)} = ${pct(share)} of total profit (limit ${consRule.value}%). You can't request a payout yet.`,
            recommendation: `Keep trading at your normal size to grow total profit until your best day drops under ${consRule.value}%. Don't take oversized days.`,
          })
        } else if (share > consPct - 0.08) {
          warnings.push({
            key: `cons:${acct.id}`, severity: 'amber', scope: { type: 'account', id: acct.id },
            title: `${acct.name} consistency is close to the limit`,
            message: `Best day is ${pct(share)} of total profit (limit ${consRule.value}%). A big day now could push you over.`,
            recommendation: `Avoid an outsized single day — steady days keep you payout-eligible.`,
          })
        }
      }
    }

    // --- maximum trading period deadline ---
    const periodRule = getRule(acct, 'maxTradingPeriod')
    if (periodRule && Number(periodRule.value) > 0 && acct.createdAt) {
      const daysElapsed = Math.floor((Date.now() - acct.createdAt) / 86400000)
      const remaining = Number(periodRule.value) - daysElapsed
      if (remaining <= 0) {
        warnings.push({
          key: `period:${acct.id}`, severity: 'red', scope: { type: 'account', id: acct.id },
          title: `${acct.name} trading period has ended`,
          message: `The ${periodRule.value}-day maximum trading period is up.`,
        })
      } else if (remaining <= 7) {
        warnings.push({
          key: `period:${acct.id}`, severity: 'amber', scope: { type: 'account', id: acct.id },
          title: `${acct.name} trading period almost up`,
          message: `${remaining} day${remaining !== 1 ? 's' : ''} left in the ${periodRule.value}-day window.`,
        })
      }
    }
  }

  // ---- mistake-pattern checks (account, firm, universal) ----
  const recent = (arr, n) => [...arr].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, n)

  // account-level: same mistake in >=3 of last 10 trades
  for (const acct of accounts) {
    if (acct.status === 'archived') continue
    const last10 = recent(tradesForAccount(trades, acct.id), 10)
    const counts = {}
    last10.forEach((t) => (t.mistakes || []).forEach((m) => { counts[m] = (counts[m] || 0) + 1 }))
    Object.entries(counts).forEach(([mistake, n]) => {
      if (n >= 3) {
        warnings.push({
          key: `mistake:acct:${acct.id}:${mistake}`, severity: 'amber', scope: { type: 'account', id: acct.id },
          title: `Repeating mistake on ${acct.name}`,
          message: `"${mistake}" showed up in ${n} of your last 10 trades on this account.`,
          recommendation: recommendForMistake(mistake),
        })
      }
    })
  }

  // firm-level: same mistake across 2+ accounts under a firm in recent trades
  const firmIds = [...new Set(accounts.filter((a) => a.status !== 'archived').map((a) => a.firmId))]
  for (const firmId of firmIds) {
    const firmAccts = accounts.filter((a) => a.firmId === firmId && a.status !== 'archived')
    const mistakeAccts = {}
    firmAccts.forEach((acct) => {
      const last20 = recent(tradesForAccount(trades, acct.id), 20)
      const seen = new Set()
      last20.forEach((t) => (t.mistakes || []).forEach((m) => seen.add(m)))
      seen.forEach((m) => { (mistakeAccts[m] ||= new Set()).add(acct.id) })
    })
    Object.entries(mistakeAccts).forEach(([mistake, set]) => {
      if (set.size >= 2) {
        warnings.push({
          key: `mistake:firm:${firmId}:${mistake}`, severity: 'amber', scope: { type: 'firm', id: firmId },
          title: `"${mistake}" across multiple accounts at this firm`,
          message: `This same mistake is showing up on ${set.size} accounts under this firm.`,
          recommendation: recommendForMistake(mistake),
        })
      }
    })
  }

  // universal: a mistake costing a lot across everything
  const mistakeCost = {}
  trades.forEach((t) => {
    const acct = accounts.find((a) => a.id === t.accountId)
    const net = computePnl(t, acct, instrumentsBySymbol).net
    if (net < 0) (t.mistakes || []).forEach((m) => { mistakeCost[m] = (mistakeCost[m] || 0) + net })
  })
  const worst = Object.entries(mistakeCost).sort((a, b) => a[1] - b[1])[0]
  if (worst && worst[1] < -500) {
    warnings.push({
      key: `mistake:universal:${worst[0]}`, severity: 'amber', scope: { type: 'universal' },
      title: `"${worst[0]}" is your most expensive habit`,
      message: `Across all accounts, "${worst[0]}" has cost you ${money(worst[1])}.`,
      recommendation: recommendForMistake(worst[0]),
    })
  }

  return warnings
}

// Map a mistake tag to a concrete, actionable suggestion.
function recommendForMistake(mistake) {
  const m = mistake.toLowerCase()
  if (m.includes('overtrad')) return 'Set a hard max-trades number and stop when you hit it. Most of your damage is volume, not setup quality.'
  if (m.includes('moved stop') || m.includes('stop')) return 'Once your stop is set, treat it as untouchable. Moving stops turns small losses into account-enders.'
  if (m.includes('late') || m.includes('chase')) return 'Wait for the candle to close at your level instead of chasing. If you missed it, let it go.'
  if (m.includes('revenge')) return 'After a loss, step away for one full candle before re-entering. Revenge trades rarely come from a real setup.'
  if (m.includes('htf') || m.includes('bias')) return 'Check your higher-timeframe bias before every entry — these losses cluster when you fade the HTF trend.'
  if (m.includes('size')) return 'Cap your size to what the account drawdown can absorb on a normal loss, not your best-case win.'
  if (m.includes('chop')) return 'Skip the midday chop window — your data shows it bleeds the account. Trade the open and the close.'
  if (m.includes('early')) return 'You may be cutting winners short. Compare your exits to MFE — let the trade reach your planned target.'
  if (m.includes('session') || m.includes('globex')) return 'Stay inside your allowed session. Off-hours trades are consistently your worst bucket.'
  return 'This keeps recurring — add it to your pre-trade checklist so you catch it before you click.'
}

const money = (n) => {
  const v = Number(n) || 0
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`

// Does the current view context match a warning's scope? Used to decide whether
// a previously-dismissed warning should re-appear. ctx = { tab, scopeType,
// scopeAccountId, scopeFirmId }; accountsById maps account id -> account.
export function warningInContext(warning, ctx, accountsById = {}) {
  if (!ctx) return false
  const onAccountsTab = ctx.tab === 'Accounts'

  if (warning.scope.type === 'account') {
    const firmOf = accountsById[warning.scope.id]?.firmId
    return (
      onAccountsTab ||
      ctx.scopeAccountId === warning.scope.id ||
      (ctx.scopeFirmId != null && ctx.scopeFirmId === firmOf)
    )
  }
  if (warning.scope.type === 'firm') {
    const scopedAcctFirm = ctx.scopeAccountId != null ? accountsById[ctx.scopeAccountId]?.firmId : null
    return onAccountsTab || ctx.scopeFirmId === warning.scope.id || scopedAcctFirm === warning.scope.id
  }
  // universal
  return ctx.tab === 'Analytics' || ctx.scopeType === 'all'
}
