'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildMaterialGate} = require('../src/material-selector');
test('experimental hook jumps to private test code without changing original bytes', () => {
  const g = buildMaterialGate(0x3000000);
  assert.equal(g.hook.length, g.original.length);
  assert.equal(g.hookRva + 5 + g.hook.readInt32LE(1), g.caveRva);
  assert.equal(g.original.toString('hex'), '837840017553');
  assert.equal(g.dailyCount, 7);
});
test('reject invalid quotas and overlapping code', () => {
  for (const count of [0, -1, 51, 1.2, NaN]) assert.throws(() => buildMaterialGate(0x3000000,count));
  assert.throws(() => buildMaterialGate(0x1155c47));
  assert.throws(() => buildMaterialGate(-1));
});
