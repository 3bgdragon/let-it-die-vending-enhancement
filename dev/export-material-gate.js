'use strict';
// Export test bytes to stdout only. Does not open or modify any game file.
const {buildMaterialGate} = require('../src/material-selector');
const sites=process.env.LID_NATIVE_BUILD==='25767944'?require('../src/native-preconditions-25767944.json').vending.selector:undefined;
const gate = buildMaterialGate(0x3000000,7,sites);
console.log(JSON.stringify({...gate, original:gate.original.toString('hex'),
  hook:gate.hook.toString('hex'), code:gate.code.toString('hex')}));
