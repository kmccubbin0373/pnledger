import { useState, useMemo } from 'react'
import { Plus, Settings2, Building2, Banknote, ArrowUpRight, Archive, Pencil, X, ListChecks } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Modal, StatusPill, Empty } from '../components/ui'
import db from '../db/db'
import { accountBalance, accountNetPnl, totalPaidOut } from '../lib/balance'
import { BROKER_COMMISSION_DEFAULTS, KNOWN_FIRMS } from '../db/instruments'
import { RULE_TYPES, RULE_BY_KEY, formatRuleValue } from '../lib/rules'
import { fmtMoney, todayISO } from '../lib/format'

export default function Accounts() {
  const { firms, accounts, trades, events, instrumentsBySymbol } = useApp()
  const [firmModal, setFirmModal] = useState(false)
  const [acctModal, setAcctModal] = useState(null) // { firmId } or { account }
  const [payoutModal, setPayoutModal] = useState(null) // account
  const [eventModal, setEventModal] = useState(null) // account
  const [promote, setPromote] = useState(null) // account eligible for promotion

  const tradesByAccount = useMemo(() => {
    const m = {}
    trades.forEach((t) => { (m[t.accountId] ||= []).push(t) })
    return m
  }, [trades])
  const eventsByAccount = useMemo(() => {
    const m = {}
    events.forEach((e) => { (m[e.accountId] ||= []).push(e) })
    return m
  }, [events])

  const firmsWithAccounts = useMemo(() => {
    return firms.map((f) => ({
      firm: f,
      accounts: accounts.filter((a) => a.firmId === f.id),
    }))
  }, [firms, accounts])

  const checkPromotion = (acct) => {
    if (acct.status !== 'eval') return
    const evalRules = acct.evalRules || []
    const ptRule = evalRules.find((r) => r.type === 'profitTarget')
    const target = ptRule ? Number(ptRule.value) : (acct.profitTarget ? Number(acct.profitTarget) : null)
    if (!target) return
    const net = accountNetPnl(acct, tradesByAccount[acct.id] || [], instrumentsBySymbol)
    if (net >= target) setPromote(acct)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-sub">Group accounts by firm. Add, edit, or archive as you buy, pass, or blow them.</p>
        </div>
        <button className="btn primary" onClick={() => setFirmModal(true)}><Plus size={15} /> Add firm or broker</button>
      </div>

      {firms.length === 0 && (
        <div className="card">
          <Empty icon={<Building2 size={30} />} title="No accounts yet">
            Add a prop firm or broker to start tracking your accounts.<br />
            <button className="btn primary" style={{ marginTop: 14 }} onClick={() => setFirmModal(true)}><Plus size={15} /> Add firm or broker</button>
          </Empty>
        </div>
      )}

      {firmsWithAccounts.map(({ firm, accounts: accs }) => (
        <div className="card flush" key={firm.id} style={{ marginBottom: 14 }}>
          <div className="between" style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--blue-bg)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12 }}>
                {firm.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{firm.name}</div>
                <div className="dim" style={{ fontSize: 11 }}>
                  {accs.length} account{accs.length !== 1 ? 's' : ''}
                  {firm.kind === 'prop' ? ' · prop firm' : ' · broker'}
                </div>
              </div>
            </div>
            <div className="row">
              <button className="btn ghost sm" onClick={() => setAcctModal({ firmId: firm.id })}><Plus size={13} /> Add account</button>
              <button className="btn ghost sm" onClick={() => setFirmModal(firm)}><Settings2 size={13} /></button>
            </div>
          </div>

          {accs.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center' }} className="dim">No accounts under this firm yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {accs.map((a) => {
                const aTrades = tradesByAccount[a.id] || []
                const aEvents = eventsByAccount[a.id] || []
                const bal = accountBalance(a, aTrades, instrumentsBySymbol, aEvents)
                const paid = totalPaidOut(aEvents)
                return (
                  <div key={a.id} style={{ padding: '13px 16px', borderRight: '0.5px solid var(--border)', borderTop: '0.5px solid var(--border)' }}>
                    <div className="between" style={{ alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</div>
                        <div className="dim" style={{ fontSize: 11 }}>
                          {a.accountType === 'options' ? 'Options' : a.accountType === 'futures' ? 'Futures' : 'Mixed'}
                          {a.accountNumber ? ` · ${a.accountNumber}` : ''}
                          {a.status === 'eval' && a.evalType ? ` · ${a.evalType}` : ''}
                        </div>
                      </div>
                      <StatusPill status={a.status} />
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                      <div>
                        <div className="dim" style={{ fontSize: 10.5 }}>Balance</div>
                        <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{fmtMoney(bal, { cents: false })}</div>
                      </div>
                      <div>
                        <div className="dim" style={{ fontSize: 10.5 }}>Trades</div>
                        <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{aTrades.length}</div>
                      </div>
                      {paid > 0 && (
                        <div>
                          <div className="dim" style={{ fontSize: 10.5 }}>Paid out</div>
                          <div className="num pos" style={{ fontSize: 14, fontWeight: 600 }}>{fmtMoney(paid, { cents: false })}</div>
                        </div>
                      )}
                    </div>
                    {(() => {
                      const applied = (a.rulesMode === 'differ' && a.status === 'funded' ? a.fundedRules : a.evalRules) || []
                      if (!applied.length) return null
                      return (
                        <div className="tagwrap" style={{ marginTop: 8, gap: 4 }}>
                          {applied.slice(0, 4).map((r, i) => (
                            <span key={i} className="pill neutral" style={{ fontSize: 9.5 }}>
                              {RULE_BY_KEY[r.type]?.label || r.type}: {formatRuleValue(r)}
                            </span>
                          ))}
                          {applied.length > 4 && <span className="pill neutral" style={{ fontSize: 9.5 }}>+{applied.length - 4}</span>}
                        </div>
                      )
                    })()}
                    <div className="row wrap" style={{ marginTop: 10, gap: 5 }}>
                      <button className="btn sm ghost" onClick={() => { setAcctModal({ account: a }); }}><Pencil size={12} /> Edit</button>
                      {(a.status === 'funded' || a.status === 'live') && (
                        <button className="btn sm ghost" onClick={() => setPayoutModal(a)}><Banknote size={12} /> Payout</button>
                      )}
                      {a.status === 'eval' && (
                        <button className="btn sm ghost" onClick={() => checkPromotion(a) || setPromote(a)}><ArrowUpRight size={12} /> Passed</button>
                      )}
                      <button className="btn sm ghost" onClick={() => setEventModal(a)}>Mark…</button>
                      {a.status !== 'archived' && (
                        <button className="btn sm ghost" onClick={() => db.accounts.update(a.id, { status: 'archived', archivedFrom: a.status })}><Archive size={12} /></button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {firmModal && <FirmModal firm={firmModal === true ? null : firmModal} onClose={() => setFirmModal(false)} />}
      {acctModal && <AccountModal ctx={acctModal} onClose={(saved, acct) => { setAcctModal(null); if (saved && acct) checkPromotion(acct) }} />}
      {payoutModal && <PayoutModal account={payoutModal} onClose={() => setPayoutModal(null)} />}
      {eventModal && <EventModal account={eventModal} onClose={() => setEventModal(null)} />}
      {promote && <PromoteModal account={promote} onClose={() => setPromote(null)} />}
    </>
  )
}

/* ---------------------------------------------------------------- Firm */
function FirmModal({ firm, onClose }) {
  const [name, setName] = useState(firm?.name || '')
  const [kind, setKind] = useState(firm?.kind || 'prop')
  const save = async () => {
    if (!name.trim()) return
    if (firm?.id) await db.firms.update(firm.id, { name: name.trim(), kind })
    else await db.firms.add({ name: name.trim(), kind, createdAt: Date.now() })
    onClose()
  }
  return (
    <Modal size="narrow" title={firm ? 'Edit firm' : 'Add firm or broker'} icon={<Building2 size={16} />} onClose={onClose}
      footer={<>
        {firm?.id && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await db.firms.delete(firm.id); onClose() }}>Delete</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </>}>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Firm / broker name</label>
        <input list="firmlist" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apex Trader Funding" />
        <datalist id="firmlist">{KNOWN_FIRMS.map((f) => <option key={f} value={f} />)}</datalist>
      </div>
      <div className="field">
        <label>Type</label>
        <div className="segmented">
          <button className={kind === 'prop' ? 'sel' : ''} onClick={() => setKind('prop')}>Prop firm</button>
          <button className={kind === 'broker' ? 'sel' : ''} onClick={() => setKind('broker')}>Broker</button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- Account */
function AccountModal({ ctx, onClose }) {
  const { firms } = useApp()
  const editing = ctx.account
  const firm = firms.find((f) => f.id === (editing?.firmId ?? ctx.firmId))
  const defComm = BROKER_COMMISSION_DEFAULTS[firm?.name] ?? 0

  const [name, setName] = useState(editing?.name || '')
  const [status, setStatus] = useState(editing?.status || (firm?.kind === 'prop' ? 'eval' : 'live'))
  const [accountType, setAccountType] = useState(editing?.accountType || 'futures')
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber || '')
  const [evalType, setEvalType] = useState(editing?.evalType || '')
  const [startingBalance, setStartingBalance] = useState(editing?.startingBalance ?? '')
  const [manualBalanceOverride, setManual] = useState(editing?.manualBalanceOverride ?? '')
  const [commissionPerSide, setComm] = useState(editing?.commissionPerSide ?? defComm)
  const [commissionMode, setCommMode] = useState(editing?.commissionMode || 'per_side')
  // Structured rule sets.
  const [rulesMode, setRulesMode] = useState(editing?.rulesMode || 'same')
  const [evalRules, setEvalRules] = useState(editing?.evalRules || [])
  const [fundedRules, setFundedRules] = useState(editing?.fundedRules || [])

  const save = async () => {
    if (!name.trim()) return
    const ptRule = evalRules.find((r) => r.type === 'profitTarget')
    const payload = {
      firmId: firm?.id ?? ctx.firmId,
      name: name.trim(),
      status,
      accountType,
      accountNumber: accountNumber.trim() || null,
      evalType: status === 'eval' ? evalType.trim() || null : null,
      startingBalance: startingBalance === '' ? 0 : Number(startingBalance),
      // Keep a derived top-level profitTarget so the "passed?" prompt keeps working.
      profitTarget: ptRule ? Number(ptRule.value) : null,
      manualBalanceOverride: manualBalanceOverride === '' ? null : Number(manualBalanceOverride),
      commissionPerSide: Number(commissionPerSide) || 0,
      commissionMode,
      rulesMode,
      evalRules,
      fundedRules: rulesMode === 'differ' ? fundedRules : [],
      archived: 0,
    }
    let acct
    if (editing?.id) { await db.accounts.update(editing.id, payload); acct = { ...editing, ...payload } }
    else { const id = await db.accounts.add({ ...payload, createdAt: Date.now() }); acct = { ...payload, id } }
    onClose(true, acct)
  }

  return (
    <Modal title={editing ? 'Edit account' : `Add account · ${firm?.name || ''}`} icon={<Banknote size={16} />} onClose={() => onClose(false)}
      footer={<>
        {editing?.id && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={async () => { await db.accounts.delete(editing.id); onClose(false) }}>Delete</button>}
        <button className="btn" onClick={() => onClose(false)}>Cancel</button>
        <button className="btn primary" onClick={save}>Save account</button>
      </>}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field">
          <label>Account name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PA-1 $50k" />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="eval">Eval</option>
            <option value="funded">Funded</option>
            <option value="live">Live</option>
            <option value="active">Active (paper / demo)</option>
            <option value="blown">Blown</option>
          </select>
        </div>
        <div className="field">
          <label>Account type</label>
          <div className="segmented">
            <button className={accountType === 'futures' ? 'sel' : ''} onClick={() => setAccountType('futures')}>Futures</button>
            <button className={accountType === 'options' ? 'sel' : ''} onClick={() => setAccountType('options')}>Options</button>
            <button className={accountType === 'mixed' ? 'sel' : ''} onClick={() => setAccountType('mixed')}>Mixed</button>
          </div>
        </div>
        <div className="field">
          <label>Account # <span className="dim">(optional)</span></label>
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="only if you track it" />
        </div>
      </div>

      {status === 'eval' && (
        <div className="field" style={{ marginTop: 14 }}>
          <label>Eval type <span className="dim">(quick label, optional)</span></label>
          <input value={evalType} onChange={(e) => setEvalType(e.target.value)} placeholder="e.g. Static, Trailing, EOD trailing" style={{ maxWidth: 280 }} />
        </div>
      )}

      <div className="section-label"><ListChecks size={12} style={{ verticalAlign: -1 }} /> Account rules</div>
      <div className="field" style={{ marginBottom: 4 }}>
        <label>Do the eval and funded accounts share the same rules?</label>
        <div className="segmented" style={{ maxWidth: 360 }}>
          <button className={rulesMode === 'same' ? 'sel' : ''} onClick={() => setRulesMode('same')}>Same rules</button>
          <button className={rulesMode === 'differ' ? 'sel' : ''} onClick={() => setRulesMode('differ')}>Different rules</button>
        </div>
      </div>

      <div className="rules-section">
        <h5>{rulesMode === 'differ' ? 'Eval rules' : 'Rules'}</h5>
        <RuleBuilder rules={evalRules} setRules={setEvalRules} />
      </div>

      {rulesMode === 'differ' && (
        <div className="rules-section">
          <h5>Funded rules <span className="dim" style={{ fontWeight: 400 }}>— applied automatically once this account is funded</span></h5>
          <RuleBuilder rules={fundedRules} setRules={setFundedRules} />
        </div>
      )}

      <div className="section-label">Balance &amp; commission</div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field">
          <label>Starting balance</label>
          <input type="number" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} placeholder="e.g. 50000" />
        </div>
        <div className="field">
          <label>Manual balance override <span className="dim">(optional)</span></label>
          <input type="number" value={manualBalanceOverride} onChange={(e) => setManual(e.target.value)} placeholder="leave blank to auto-calc" />
        </div>
        <div className="field">
          <label>Commission per side ($)</label>
          <input type="number" step="any" value={commissionPerSide} onChange={(e) => setComm(e.target.value)} />
        </div>
        <div className="field">
          <label>Charged</label>
          <div className="segmented">
            <button className={commissionMode === 'per_side' ? 'sel' : ''} onClick={() => setCommMode('per_side')}>Per side</button>
            <button className={commissionMode === 'round_trip' ? 'sel' : ''} onClick={() => setCommMode('round_trip')}>Round trip</button>
          </div>
        </div>
      </div>
      <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
        Pre-filled from a typical {firm?.name || 'broker'} rate. Edit to match your statement — it’s the only thing that turns gross P/L into net, and changes apply to all past trades on this account.
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- Payout */
function PayoutModal({ account, onClose }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const save = async () => {
    if (!amount) return
    await db.accountEvents.add({ accountId: account.id, type: 'payout', amount: Number(amount), date, note: note || null, createdAt: Date.now() })
    onClose()
  }
  return (
    <Modal size="narrow" title={`Record payout · ${account.name}`} icon={<Banknote size={16} />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Record payout</button></>}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field"><label>Amount</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2000" /></div>
        <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="field" style={{ marginTop: 10 }}><label>Note (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>Subtracts from this account’s displayed balance and drops a marker on the calendar.</div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- Generic event */
function EventModal({ account, onClose }) {
  const [type, setType] = useState('purchased')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const save = async () => {
    await db.accountEvents.add({ accountId: account.id, type, date, note: note || null, createdAt: Date.now() })
    if (type === 'blown') await db.accounts.update(account.id, { status: 'blown' })
    if (type === 'passed') await db.accounts.update(account.id, { status: 'funded' })
    onClose()
  }
  return (
    <Modal size="narrow" title={`Mark event · ${account.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Add marker</button></>}>
      <div className="field"><label>Event</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="purchased">Purchased</option>
          <option value="passed">Passed / funded</option>
          <option value="blown">Blown</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 10 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field" style={{ marginTop: 10 }}><label>Note (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>Shows up as a marker on the calendar. “Passed” sets this account to funded; “Blown” archives the run.</div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- Promotion */
function PromoteModal({ account, onClose }) {
  const { firms } = useApp()
  const firm = firms.find((f) => f.id === account.firmId)
  const [name, setName] = useState(account.name.replace(/eval/i, '').trim() + ' (Funded)')
  const [startingBalance, setStartingBalance] = useState(account.startingBalance ?? '')
  const create = async () => {
    const fundedId = await db.accounts.add({
      firmId: account.firmId, name: name.trim(), status: 'funded', accountType: account.accountType,
      accountNumber: null, evalType: null, rules: account.rules || null,
      startingBalance: startingBalance === '' ? 0 : Number(startingBalance), profitTarget: null,
      manualBalanceOverride: null, commissionPerSide: account.commissionPerSide, commissionMode: account.commissionMode,
      archived: 0, linkedFromAccountId: account.id, createdAt: Date.now(),
    })
    await db.accountEvents.add({ accountId: fundedId, type: 'passed', date: todayISO(), note: `Funded from ${account.name}`, createdAt: Date.now() })
    await db.accounts.update(account.id, { status: 'archived', archivedFrom: 'eval', passedToAccountId: fundedId })
    onClose()
  }
  return (
    <Modal size="narrow" title="Looks like you passed! 🎉" icon={<ArrowUpRight size={16} />} onClose={onClose}
      footer={<>
        <button className="btn" style={{ marginRight: 'auto' }} onClick={onClose}>Not yet</button>
        <button className="btn" onClick={async () => { await db.accounts.update(account.id, { status: 'archived', archivedFrom: 'eval' }); onClose() }}>Just archive eval</button>
        <button className="btn primary" onClick={create}>Create funded account</button>
      </>}>
      <p style={{ marginTop: 0, fontSize: 13.5, color: 'var(--text-2)' }}>
        Hit the profit target on <strong>{account.name}</strong> at {firm?.name}. Want to spin up a fresh funded account with a clean slate and archive this eval?
      </p>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="field"><label>Funded account name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>Starting balance</label><input type="number" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} /></div>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- Rule builder */
function RuleBuilder({ rules, setRules }) {
  const addRule = () => {
    // default to the first rule type not already used, else custom
    const used = new Set(rules.map((r) => r.type))
    const next = RULE_TYPES.find((t) => !used.has(t.key)) || RULE_BY_KEY.custom
    setRules([...rules, { type: next.key, value: '' }])
  }
  const updateRule = (i, patch) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const removeRule = (i) => setRules(rules.filter((_, j) => j !== i))

  return (
    <>
      {rules.length === 0 && <div className="rule-empty">No rules yet. Add the ones this account enforces.</div>}
      {rules.map((rule, i) => {
        const def = RULE_BY_KEY[rule.type]
        return (
          <div className="rule-row" key={i}>
            <select value={rule.type} onChange={(e) => updateRule(i, { type: e.target.value, value: '' })}>
              {RULE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <RuleValueInput def={def} value={rule.value} onChange={(v) => updateRule(i, { value: v })} />
            <button className="icon-btn" onClick={() => removeRule(i)} aria-label="Remove rule"><X size={15} /></button>
          </div>
        )
      })}
      <button className="btn ghost sm" onClick={addRule}><Plus size={14} /> Add rule</button>
    </>
  )
}

function RuleValueInput({ def, value, onChange }) {
  if (!def) return <input value={value} onChange={(e) => onChange(e.target.value)} />
  if (def.kind === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  const listId = `rulesug-${def.key}`
  const isNum = def.kind === 'money' || def.kind === 'percent' || def.kind === 'number'
  const prefix = def.kind === 'money' ? '$' : ''
  const suffix = def.kind === 'percent' ? '%' : def.unit ? ` ${def.unit}` : ''
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={isNum ? 'number' : 'text'}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={def.suggest?.length ? listId : undefined}
        placeholder={def.hint || (prefix ? `${prefix}…` : 'value')}
        title={def.hint || ''}
      />
      {def.suggest?.length > 0 && (
        <datalist id={listId}>{def.suggest.map((s) => <option key={s} value={s} />)}</datalist>
      )}
      {(suffix || prefix) && value !== '' && (
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none' }}>
          {def.kind === 'percent' ? '%' : def.unit || ''}
        </span>
      )}
    </div>
  )
}
