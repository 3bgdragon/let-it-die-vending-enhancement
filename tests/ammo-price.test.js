'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { refillPrice, quoteRefill } = require('../src/ammo-price');

const weapon = Object.freeze({ purchasePrice: 50000, rest: 0, spare: 0, capacity: 30, maxSpare: 270, wallet: 10000 });

test('ammo full refill costs one fifth of purchase price, rounded up', () => {
  for (const [price, cost] of [[1,1],[4,1],[5,1],[6,2],[49999,10000],[50000,10000],[50001,10001],[2147483647,429496730]]) {
    assert.equal(refillPrice(price), cost);
  }
});

test('unknown, zero, negative, fractional and overflowing purchase prices fail closed', () => {
  for (const price of [undefined, null, '50000', 0, -1, 1.5, NaN, Infinity, 2147483648]) {
    assert.throws(() => refillPrice(price), RangeError);
  }
});

test('partial and empty weapons pay the same fixed full-refill price', () => {
  assert.deepEqual(quoteRefill(weapon), { available: true, charge: 10000, rest: 30, spare: 270 });
  assert.deepEqual(quoteRefill({ ...weapon, rest: 29, spare: 270 }), quoteRefill(weapon));
  assert.deepEqual(quoteRefill({ ...weapon, rest: 30, spare: 269 }), quoteRefill(weapon));
});

test('full, overfull and non-ammo weapons are excluded without charge', () => {
  for (const [rest, spare] of [[30,270],[31,300]]) {
    assert.deepEqual(quoteRefill({ ...weapon, rest, spare }), { available: false, reason: 'already-full', charge: 0 });
  }
  assert.deepEqual(quoteRefill({ ...weapon, capacity: 0 }), { available: false, reason: 'not-ammo-weapon', charge: 0 });
});

test('refill never reduces an existing over-capacity ammunition component', () => {
  assert.deepEqual(quoteRefill({ ...weapon, rest: 31 }), { available: true, charge: 10000, rest: 31, spare: 270 });
  assert.deepEqual(quoteRefill({ ...weapon, spare: 300 }), { available: true, charge: 10000, rest: 30, spare: 300 });
});

test('insufficient money is rejected, exact amount accepted; input is not mutated', () => {
  assert.deepEqual(quoteRefill({ ...weapon, wallet: 9999 }), { available: false, reason: 'insufficient-killcoins', charge: 10000 });
  assert.equal(quoteRefill(weapon).available, true);
  assert.equal(weapon.wallet, 10000);
  assert.equal(weapon.rest, 0);
});

test('invalid engine ammo and wallet values cannot produce a quote', () => {
  for (const field of ['rest', 'spare', 'capacity', 'maxSpare', 'wallet']) {
    for (const value of [-1, NaN, undefined, 1.5, 2147483648]) {
      assert.throws(() => quoteRefill({ ...weapon, [field]: value }), RangeError);
    }
  }
});
