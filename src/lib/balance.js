import { computePnl } from './pnl'

// Effective balance for an account:
//   startingBalance + sum(net P&L of its trades) - sum(payouts)
// unless a manual override is set, in which case the override wins (used to
// correct drift if you forget to log something). Passed / purchased / blown
// events are markers and do not move the balance by themselves.
export function accountBalance(account, trades, instrumentsBySymbol, events = []) {
  if (account.manualBalanceOverride != null && account.manualBalanceOverride !== '') {
    return Number(account.manualBalanceOverride)
  }
  const start = Number(account.startingBalance) || 0
  const pnl = trades.reduce((sum, t) => sum + computePnl(t, account, instrumentsBySymbol).net, 0)
  const payouts = events
    .filter((e) => e.type === 'payout')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)
  return start + pnl - payouts
}

// Net realized P&L only (no payouts, no starting balance) — what the account has
// produced through trading. Used for the eval profit-target promotion check.
export function accountNetPnl(account, trades, instrumentsBySymbol) {
  return trades.reduce((sum, t) => sum + computePnl(t, account, instrumentsBySymbol).net, 0)
}

export function totalPaidOut(events = []) {
  return events.filter((e) => e.type === 'payout').reduce((s, e) => s + (Number(e.amount) || 0), 0)
}
