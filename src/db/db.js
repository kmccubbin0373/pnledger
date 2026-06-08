import Dexie from 'dexie'

// IndexedDB via Dexie. This single data layer behaves identically in a normal
// browser, inside Electron (desktop), and inside a Capacitor webview (iOS /
// Android) — which is why we use it instead of native SQLite, which would need a
// different plugin on each platform. Everything stays on the device. Data can be
// exported to JSON/CSV at any time from Settings.

export const db = new Dexie('pnledger')

db.version(1).stores({
  // ++id = auto-increment primary key. Other fields after the comma are indexes.
  firms: '++id, name, kind',
  accounts: '++id, firmId, status, accountType, archived',
  instruments: '++id, &symbol, kind',
  trades: '++id, accountId, date, instrumentSymbol, strategy, instrumentKind',
  strategies: '++id, &name, archived',
  ruleItems: '++id, order, archived',
  mistakeTags: '++id, &text, archived',
  recaps: '++id, date',
  accountEvents: '++id, accountId, date, type',
  prefs: '++id',
})

// v2 — adds persistent state for the warning/recommendation banner system.
// Account rules live directly on the account object (evalRules / fundedRules
// arrays) so no schema change is needed there.
db.version(2).stores({
  firms: '++id, name, kind',
  accounts: '++id, firmId, status, accountType, archived',
  instruments: '++id, &symbol, kind',
  trades: '++id, accountId, date, instrumentSymbol, strategy, instrumentKind',
  strategies: '++id, &name, archived',
  ruleItems: '++id, order, archived',
  mistakeTags: '++id, &text, archived',
  recaps: '++id, date',
  accountEvents: '++id, accountId, date, type',
  prefs: '++id',
  warningAcks: '&key', // key = stable warning id the user has acknowledged globally
})

// v3 — adds the trading-plan module (one plan per day) and saved report views
// (saved filter configurations on the Trades page). New trade fields mfe/mae and
// per-screenshot labels are non-indexed, so they need no migration here.
db.version(3).stores({
  firms: '++id, name, kind',
  accounts: '++id, firmId, status, accountType, archived',
  instruments: '++id, &symbol, kind',
  trades: '++id, accountId, date, instrumentSymbol, strategy, instrumentKind',
  strategies: '++id, &name, archived',
  ruleItems: '++id, order, archived',
  mistakeTags: '++id, &text, archived',
  recaps: '++id, date',
  accountEvents: '++id, accountId, date, type',
  prefs: '++id',
  warningAcks: '&key',
  plans: '++id, date',          // one daily trading plan, looked up by date
  savedViews: '++id, name',     // saved Trades-page filter configurations
})

export default db
