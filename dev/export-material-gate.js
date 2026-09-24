'use strict';
// Export test bytes to stdout only. Does not open or modify any game file.
const {buildMaterialGate} = require('../src/material-selector');
const gate = buildMaterialGate(0x3000000);
console.log(JSON.stringify({...gate, original:gate.original.toString('hex'),
  hook:gate.hook.toString('hex'), code:gate.code.toString('hex')}));
