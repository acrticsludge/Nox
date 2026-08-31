// Trials score ledger (audit P1-06) — single source of truth for Trials scoring.
// Every award/penalty is recorded as a signed numeric amount at the moment it
// happens. Rounding contract (documented, must stay in sync with
// docs/testing/mode-regression-matrix.md):
//   - ledger entries are exact (survival accrues fractional points per frame)
//   - displayed ROWS are floor(entry)
//   - displayed TOTAL is clamp>=0(floor(exact sum of all entries))
//   - the total is NEVER inferred from rows; rows are NEVER inferred from total
export const LEDGER_KEYS = ['survival', 'hitBonus', 'pickupBonus', 'botKill', 'lavaPenalty', 'slimePenalty', 'voidPenalty', 'botHitPenalty'];

export function createLedger() {
  return { survival: 0, hitBonus: 0, pickupBonus: 0, botKill: 0, lavaPenalty: 0, slimePenalty: 0, voidPenalty: 0, botHitPenalty: 0 };
}

export function sumLedger(ledger) {
  let s = 0;
  for (const k of LEDGER_KEYS) s += ledger[k] || 0;
  return s;
}

export function ledgerTotal(ledger) {
  return Math.max(0, Math.floor(sumLedger(ledger)));
}

export function applyLedger(ledger, key, amount) {
  if (!Object.prototype.hasOwnProperty.call(ledger, key)) throw new TypeError(`unknown ledger key: ${key}`);
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new TypeError(`ledger amount must be a finite number, got ${amount}`);
  ledger[key] += amount;
  return sumLedger(ledger);
}
