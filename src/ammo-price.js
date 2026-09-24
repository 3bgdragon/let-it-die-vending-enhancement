'use strict';

// The caller must supply the current weapon variant/upgrade's BUY price from
// the game's purchase-price resolver, never a sale price or a base-tier guess.
// This is the reference policy for the in-game bytecode implementation; Node
// does not run in the game process and this module does not modify inventory.
const PURCHASE_PRICE_DIVISOR = 5;
const MAX_ENGINE_INT = 0x7fffffff;

function nonnegativeInt(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_ENGINE_INT) {
    throw new RangeError(`${label}: 유효한 게임 정수 값이 필요합니다`);
  }
  return value;
}

function refillPrice(purchasePrice) {
  nonnegativeInt(purchasePrice, '구입가');
  if (purchasePrice === 0) throw new RangeError('구입가를 확인할 수 없어 충전할 수 없습니다');
  // Avoid (price + 4) / 5: that would overflow the engine's signed int32.
  return Math.floor(purchasePrice / PURCHASE_PRICE_DIVISOR)
    + (purchasePrice % PURCHASE_PRICE_DIVISOR === 0 ? 0 : 1);
}

function quoteRefill({ purchasePrice, rest, spare, capacity, maxSpare, wallet }) {
  for (const [label, value] of Object.entries({ rest, spare, capacity, maxSpare, wallet })) {
    nonnegativeInt(value, label);
  }
  if (capacity === 0) return Object.freeze({ available: false, reason: 'not-ammo-weapon', charge: 0 });
  if (rest >= capacity && spare >= maxSpare) {
    return Object.freeze({ available: false, reason: 'already-full', charge: 0 });
  }
  const charge = refillPrice(purchasePrice);
  if (wallet < charge) {
    return Object.freeze({ available: false, reason: 'insufficient-killcoins', charge });
  }
  return Object.freeze({
    available: true,
    charge,
    // Preserve pre-existing over-capacity amounts instead of deleting ammo.
    rest: Math.max(rest, capacity),
    spare: Math.max(spare, maxSpare),
  });
}

module.exports = { PURCHASE_PRICE_DIVISOR, refillPrice, quoteRefill };
