// P1-06: ledger is exact accounting — rows sum to total, no inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLedger, createLedger, ledgerTotal, sumLedger, LEDGER_KEYS } from './trials-ledger.js';

test('ledger starts at zero and sums all keys', () => {
  const l = createLedger();
  assert.equal(sumLedger(l), 0);
  assert.equal(ledgerTotal(l), 0);
  assert.deepEqual(Object.keys(l).sort(), LEDGER_KEYS.map(k => k).sort());
});

test('signed amounts accumulate exactly (no clamping in the ledger)', () => {
  const l = createLedger();
  applyLedger(l, 'survival', 300.5);      // exact fractional survival
  applyLedger(l, 'hitBonus', 25);
  applyLedger(l, 'pickupBonus', 75);
  applyLedger(l, 'botKill', 500);
  applyLedger(l, 'lavaPenalty', -30);
  applyLedger(l, 'slimePenalty', -15);
  applyLedger(l, 'voidPenalty', -1);
  applyLedger(l, 'botHitPenalty', -3);
  assert.equal(sumLedger(l), 300.5 + 25 + 75 + 500 - 30 - 15 - 1 - 3);
  assert.equal(ledgerTotal(l), Math.floor(sumLedger(l)));
});

test('documented rounding: rows are floor(entry), total is clamp>=0 floor of exact sum', () => {
  const l = createLedger();
  applyLedger(l, 'survival', 59.8);
  applyLedger(l, 'lavaPenalty', -60);
  // exact sum = -0.2 -> total clamps to 0, survival row displays floor(59.8)=59
  assert.ok(Math.abs(sumLedger(l) + 0.2) < 1e-9);
  assert.equal(ledgerTotal(l), 0);
  assert.equal(Math.floor(l.survival), 59);
});

test('never goes negative in total while preserving signed entries', () => {
  const l = createLedger();
  applyLedger(l, 'lavaPenalty', -90);
  assert.equal(ledgerTotal(l), 0);
  assert.equal(l.lavaPenalty, -90); // penalty amount still visible for the UI row
});

test('unknown keys and non-finite amounts are rejected (no silent loss)', () => {
  const l = createLedger();
  assert.throws(() => applyLedger(l, 'nonsense', 5), TypeError);
  assert.throws(() => applyLedger(l, 'hitBonus', NaN), TypeError);
  assert.throws(() => applyLedger(l, 'hitBonus', Infinity), TypeError);
  assert.throws(() => applyLedger(l, 'hitBonus', '25'), TypeError);
});
