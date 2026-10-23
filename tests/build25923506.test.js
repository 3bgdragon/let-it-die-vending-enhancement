'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const pre=require('../src/native-preconditions'),native=require('../src/executable'),profile=require('../src/native-preconditions-25923506.json');
const file=process.env.LID_25923506_EXE;
test('25923506 uses audited per-function addresses and relocated globals, not a uniform shift',()=>{
 assert.equal(profile.build,25923506);assert.equal(profile.stock.size,45069312);
 assert.equal(profile.vending.selector.hookRva,18184567);
 assert.equal(profile.vending.bootstrap.hookRva,17840646);
 assert.equal(profile.vending.bootstrap.dailyRva,20284496);
 assert.equal(profile.vending.bootstrap.userRva,41828928);
 assert.equal(profile.vending.bootstrap.dirtyRva,260708496);
});
test('25923506 native patch preserves foreign bytes, rejects dependency/overlay/reapplication conflicts',{skip:!file},()=>{
 const source=fs.readFileSync(file),foreign=Buffer.from(source);foreign[0x100000]^=1;
 assert.equal(pre.profileFor(foreign).profile.build,25923506);
 const result=native.patchExecutable(foreign);assert.equal(result.output[0x100000],foreign[0x100000]);
 const broken=Buffer.from(foreign),e=profile.expected[0],s=profile.stock.layout.sections.find(s=>e.rva>=s.rva&&e.rva<s.rva+s.rawSize);broken[s.raw+e.rva-s.rva]^=1;
 assert.throws(()=>native.patchExecutable(broken),/Conflicting native bytes/);
 assert.throws(()=>native.patchExecutable(Buffer.concat([source,Buffer.from('overlay')])),/Unsupported PE/);
 assert.throws(()=>native.patchExecutable(result.output),/Unsupported PE/);
 assert(fs.readFileSync(file).equals(source));
});
