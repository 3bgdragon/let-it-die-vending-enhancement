'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { localizePlan, labels } = require('../src/game-language');
for (const file of ['decal-build25386710.json', 'vending-build25386710.json']) {
  test(`English game labels preserve all script sizes and jumps: ${file}`, () => {
    const plan = require('../patches/' + file), original = JSON.stringify(plan);
    assert.equal(localizePlan(plan, 'ko'), plan);
    const english = localizePlan(plan, 'en');
    assert.equal(JSON.stringify(plan), original);
    for (let i = 0; i < plan.patches.length; i++) {
      const before = plan.patches[i], after = english.patches[i];
      assert.deepEqual({ ...before, insert: null }, { ...after, insert: null });
      assert.equal(after.insert.length, before.insert.length);
      const bytes = Buffer.from(after.insert, 'hex');
      for (const [ko] of labels) assert.equal(bytes.includes(Buffer.from(ko, 'utf16le')), false);
    }
    const joined = Buffer.concat(english.patches.map(p => Buffer.from(p.insert, 'hex')));
    assert.ok(joined.includes(Buffer.from('Decals', 'utf16le')));
    if (plan.features?.includes('ammo')) assert.ok(joined.includes(Buffer.from('No durability repair.', 'utf16le')));
  });
}
test('missing translation signatures fail closed', () => {
  assert.throws(() => localizePlan({ patches: [], features: [] }, 'en'), /signature count/);
});
