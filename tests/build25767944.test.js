'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pre=require('../src/native-preconditions'),native=require('../src/executable'),profile=require('../src/native-preconditions-25767944.json');
const file=process.env.LID_25767944_EXE;
test('25767944 uses separately audited per-function addresses, not a uniform shift',()=>{
 assert.equal(profile.build,25767944);assert.equal(profile.stock.size,45000192);
 assert.equal(profile.vending.selector.hookRva,0x1156c27);
 assert.equal(profile.vending.bootstrap.hookRva,0x1103d06);
 assert.equal(profile.vending.bootstrap.dailyRva,0x1350d30);
 assert.equal(profile.vending.bootstrap.userRva,0x27d4210);
 assert.equal(profile.vending.bootstrap.dirtyRva,0xf8917e0);
});
test('current EXE accepts independent edits, preserves them, refuses owned conflicts',{skip:!file},()=>{
 const source=fs.readFileSync(file),foreign=Buffer.from(source);foreign[0x100000]^=1;
 assert.equal(pre.validate(foreign),'stock');const result=native.patchExecutable(foreign);
 assert.equal(result.output[0x100000],foreign[0x100000]);
 const broken=Buffer.from(foreign),s=profile.expected[0],l=pre.layout(source).sections.find(p=>s.rva>=p.rva&&s.rva<p.rva+p.rawSize);broken[l.raw+s.rva-l.rva]^=1;
 assert.throws(()=>native.patchExecutable(broken),/Conflicting native bytes/);
 assert.throws(()=>native.patchExecutable(Buffer.concat([source,Buffer.from('overlay')])),/Unsupported PE/);
 assert.throws(()=>native.patchExecutable(result.output),/Unsupported PE/);
 assert.ok(fs.readFileSync(file).equals(source));
});
