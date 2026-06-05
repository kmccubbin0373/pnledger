import db from './db'
import { DEFAULT_FUTURES, DEFAULT_OPTIONS } from './instruments'

const DEFAULT_STRATEGIES = [
  'iFVG',
  'BB Reversal',
  'ORB Breakout',
  'Liquidity Sweep',
  'VWAP Reclaim',
  'The Strat',
  'Discord Alert',
  'Manual / Independent',
  'Automation / Bot',
]

const DEFAULT_RULES = [
  'Waited for my setup before entering',
  'Entered at the planned level',
  'Respected my stop loss',
  'Did not move my stop emotionally',
  'Exited according to plan',
  'Stayed within my allowed session',
  'Stayed within my max trades for the day',
]

const DEFAULT_MISTAKES = [
  'Entered late',
  'Chased candle',
  'Ignored HTF',
  'Took trade in chop',
  'Overtraded',
  'Revenge trade',
  'Moved stop',
  'Exited early',
  'Held too long',
  'Took non-plan setup',
  'Too much size',
  'Traded bad session',
]

export async function seedIfEmpty() {
  const instrumentCount = await db.instruments.count()
  if (instrumentCount === 0) {
    await db.instruments.bulkAdd([...DEFAULT_FUTURES, ...DEFAULT_OPTIONS])
  }

  if ((await db.strategies.count()) === 0) {
    await db.strategies.bulkAdd(DEFAULT_STRATEGIES.map((name) => ({ name, archived: 0 })))
  }

  if ((await db.ruleItems.count()) === 0) {
    await db.ruleItems.bulkAdd(DEFAULT_RULES.map((text, i) => ({ text, order: i, archived: 0 })))
  }

  if ((await db.mistakeTags.count()) === 0) {
    await db.mistakeTags.bulkAdd(DEFAULT_MISTAKES.map((text) => ({ text, archived: 0 })))
  }

  if ((await db.prefs.count()) === 0) {
    await db.prefs.add({ maxTradesPerDay: 3, dashboardScope: 'all' })
  }
}
