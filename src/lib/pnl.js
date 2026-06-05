// ---------------------------------------------------------------------------
// P&L engine.
//
// Everything is computed on the fly from the raw trade (entry, exits, qty) plus
// the current instrument spec and the current account commission. Nothing is
// cached, so if you correct a commission rate or an instrument spec later, every
// past trade's net P&L updates automatically. That is exactly the retroactive
// behavior we want.
//
// Gross P&L is pure tick math and is always exact. Net P&L = gross - commission.
// ---------------------------------------------------------------------------

const dirSign = (direction) => (direction === 'short' ? -1 : 1)

export function totalExitQty(trade) {
  return (trade.exits || []).reduce((s, e) => s + (Number(e.qty) || 0), 0)
}

// Gross P&L in dollars across all (partial) exits.
// When a trade has multiple entry fills (pyramided position from a fills
// import), uses FIFO matching so the result is identical to Tradovate's
// own P&L calculation. Falls back to single entry price for manually
// logged trades.
export function grossPnl(trade, instrument) {
  if (!instrument) return 0
  const sign = dirSign(trade.direction)

  if (trade.instrumentKind === 'option') {
    const mult = instrument.multiplier || instrument.pointValue || 100
    const entry = Number(trade.entryPrice) || 0
    return (trade.exits || []).reduce((sum, ex) => {
      const px = Number(ex.price) || 0
      const qty = Number(ex.qty) || 0
      return sum + sign * (px - entry) * mult * qty
    }, 0)
  }

  const tickSize = Number(instrument.tickSize) || 0.25
  const tickValue = Number(instrument.tickValue) || 0

  // FIFO: if the trade has individual entry fills stored (imported from a
  // fills export), match exits against them in order so P&L is exact.
  if (trade.entryFills && trade.entryFills.length > 1) {
    const queue = trade.entryFills.map((f) => ({ p: Number(f.price), qty: Number(f.qty) }))
    let total = 0
    for (const ex of trade.exits || []) {
      let rem = Number(ex.qty) || 0
      const exitPx = Number(ex.price) || 0
      while (rem > 0 && queue.length) {
        const head = queue[0]
        const matched = Math.min(rem, head.qty)
        const diff = sign * (exitPx - head.p)
        total += (diff / tickSize) * tickValue * matched
        head.qty -= matched
        rem -= matched
        if (head.qty === 0) queue.shift()
      }
    }
    return total
  }

  // Single entry price (manually logged or simple fills trade).
  const entry = Number(trade.entryPrice) || 0
  return (trade.exits || []).reduce((sum, ex) => {
    const px = Number(ex.price) || 0
    const qty = Number(ex.qty) || 0
    const ticks = (sign * (px - entry)) / tickSize
    return sum + ticks * tickValue * qty
  }, 0)
}

// Commission in dollars. If the trade was imported from a fills CSV and has
// importedCommission stored (taken directly from the broker's commission
// column), use that exact value so net P&L matches the broker statement
// to the cent. Otherwise compute from the account's configured per-side rate.
export function commission(trade, account) {
  if (trade.importedCommission != null) return Number(trade.importedCommission)
  if (!account) return 0
  const entryQty = Number(trade.quantity) || 0
  const exitQty = totalExitQty(trade)
  const rate = Number(account.commissionPerSide) || 0
  if (account.commissionMode === 'round_trip') {
    return Math.min(entryQty, exitQty || entryQty) * rate
  }
  return (entryQty + exitQty) * rate
}

// Resolve the correct instrument spec for a trade. Options always use the
// generic 100x equity-option spec regardless of the underlying symbol typed
// (QQQ, SPY, a single stock, etc.); futures use their own contract spec.
export function resolveInstrument(trade, bySymbol) {
  if (trade.instrumentKind === 'option') {
    return (
      bySymbol['OPT'] || { kind: 'option', multiplier: 100, pointValue: 100, tickSize: 0.01, tickValue: 1 }
    )
  }
  return bySymbol[trade.instrumentSymbol]
}

// Convenience: everything at once. Pass the instrumentsBySymbol map and it
// resolves the right spec (handles options vs futures automatically).
export function computePnl(trade, account, bySymbol) {
  const instrument = bySymbol && (bySymbol.symbol ? bySymbol : resolveInstrument(trade, bySymbol))
  const gross = grossPnl(trade, instrument)
  const comm = commission(trade, account)
  return {
    gross,
    commission: comm,
    net: gross - comm,
    hasCommission: !!(account && Number(account.commissionPerSide) > 0),
  }
}

// Points / handles moved on the trade (volume-weighted across exits), useful for
// MAE/MFE-style reads and display.
export function pointsMoved(trade) {
  const sign = dirSign(trade.direction)
  const entry = Number(trade.entryPrice) || 0
  const qty = totalExitQty(trade)
  if (!qty) return 0
  const weighted = (trade.exits || []).reduce((s, ex) => {
    return s + sign * ((Number(ex.price) || 0) - entry) * (Number(ex.qty) || 0)
  }, 0)
  return weighted / qty
}

// Average exit price across partials (volume weighted).
export function avgExitPrice(trade) {
  const qty = totalExitQty(trade)
  if (!qty) return null
  const sum = (trade.exits || []).reduce((s, ex) => s + (Number(ex.price) || 0) * (Number(ex.qty) || 0), 0)
  return sum / qty
}
