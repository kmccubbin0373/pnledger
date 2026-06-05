// ---------------------------------------------------------------------------
// Prop-firm / account rule types.
//
// Each rule the user can attach to an account. `kind` controls the value input:
//   number  → numeric field
//   money   → dollar field
//   percent → percentage field
//   select  → fixed dropdown of `options`
//   text    → free text with suggestion list
//
// `suggest` provides autocomplete options for number/money/percent/text inputs
// (the same "type and pick" behavior as the firm-name box).
// ---------------------------------------------------------------------------

export const RULE_TYPES = [
  { key: 'maxContracts', label: 'Max contracts', kind: 'number', suggest: ['1', '2', '3', '5', '10', '15', '20'], unit: 'ct' },
  { key: 'drawdownMode', label: 'Drawdown mode', kind: 'select', options: ['Static', 'Trailing (intraday)', 'Trailing (EOD)'] },
  { key: 'mll', label: 'Max loss limit (MLL)', kind: 'money', suggest: ['1500', '2000', '2500', '3000', '4000', '5000'] },
  { key: 'dll', label: 'Daily loss limit (DLL)', kind: 'money', suggest: ['500', '1000', '1100', '1250', '2000', '2500'] },
  { key: 'profitTarget', label: 'Profit target', kind: 'money', suggest: ['1500', '2000', '3000', '4000', '6000', '9000'] },
  { key: 'consistencyReq', label: 'Consistency requirement', kind: 'percent', suggest: ['20', '30', '40', '50'], hint: 'best day must be under this % of total profit' },
  { key: 'consistencyReset', label: 'Consistency reset', kind: 'select', options: ['At inception only', 'Resets after each payout'] },
  { key: 'minTradingDays', label: 'Minimum trading days', kind: 'number', suggest: ['1', '5', '7', '10'], unit: 'days' },
  { key: 'daysUntilPayout', label: 'Trading days until first payout', kind: 'number', suggest: ['5', '7', '8', '10', '14'], unit: 'days' },
  { key: 'payoutWindow', label: 'Payout window', kind: 'select', options: ['5 days', '7 days', '10 days', '14 days', '30 days'] },
  { key: 'minPayoutDays', label: 'Minimum payout days', kind: 'number', suggest: ['5', '8', '10'], unit: 'days' },
  { key: 'minBalanceBuffer', label: 'Minimum balance buffer', kind: 'money', suggest: ['100', '500', '1000'] },
  { key: 'profitSplit', label: 'Profit split', kind: 'percent', suggest: ['80', '90', '100'], hint: 'your share' },
  { key: 'maxTradingPeriod', label: 'Maximum trading period', kind: 'number', suggest: ['30', '60', '90', '180'], unit: 'days' },
  { key: 'scalingPlan', label: 'Scaling plan', kind: 'text', suggest: ['5ct → 10ct at $1,500', '2ct → 5ct at $1,000'] },
  { key: 'newsTrading', label: 'News trading', kind: 'select', options: ['Allowed', 'Not allowed', 'Restricted near high-impact news'] },
  { key: 'automation', label: 'Trading bots / automation', kind: 'select', options: ['Allowed', 'Not allowed'] },
  { key: 'hedging', label: 'Hedging across accounts', kind: 'select', options: ['Allowed', 'Not allowed'] },
  { key: 'inactivity', label: 'Inactivity rule', kind: 'text', suggest: ['Must trade every 7 days', 'Must trade every 14 days', 'Must trade every 30 days'] },
  { key: 'custom', label: 'Other / custom rule', kind: 'text', suggest: [] },
]

export const RULE_BY_KEY = Object.fromEntries(RULE_TYPES.map((r) => [r.key, r]))

// Human-readable display of a rule's value.
export function formatRuleValue(rule) {
  const def = RULE_BY_KEY[rule.type]
  if (!def) return rule.value
  if (def.kind === 'money') return `$${Number(rule.value).toLocaleString('en-US')}`
  if (def.kind === 'percent') return `${rule.value}%`
  if (def.kind === 'number') return `${rule.value}${def.unit ? ' ' + def.unit : ''}`
  return rule.value
}
