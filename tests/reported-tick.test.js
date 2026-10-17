'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const owned=require('../shared/owned-functions'),compat=require('../src/tick-compat'),{patchFunction}=require('../src/decal-package'),diagnostics=require('../src/ui-diagnostics');
const v=owned.group('vending','BrgGame.upk',91836),p=require('../patches/decal-build25386710.json').patches.find(p=>p.export===91837),pair=compat.family(v[0].off);
test('reviewed delta reconstructs the exact reported function, not a same-size substitute',()=>{
 assert.equal(owned.sha(pair.off),'66b852e2ae52e47b299069bc4296050887040264dac6758c0557f4db08011223');assert.equal(pair.off.length,11582);
 if(process.env.LID_VENDING_REPORT_DIAGNOSTIC){const d=JSON.parse(fs.readFileSync(process.env.LID_VENDING_REPORT_DIAGNOSTIC,'utf8')),f=d.functions.find(f=>f.export===91837);assert(Buffer.from(f.serializedDataBase64,'base64').equals(pair.off));assert(Buffer.from(d.error.failedStagingFunction.serializedDataBase64,'base64').equals(pair.off));}
});
test('stock plan resolves only the reviewed foreign input and produces the independently decoded merged image',()=>{
 const input=Buffer.from(pair.off),on=patchFunction(input,p);assert(input.equals(pair.off));assert(on.equals(pair.on));assert.equal(owned.sha(on),'74463abc05e3cfc31e5766878d9b53b11e3ccb3a423f8c27b102ecc185b15d99');
 assert.equal(on.length,11669);assert.equal(on.readUInt32LE(40),15974);assert.equal(on.readUInt32LE(44),11606);
});
test('foreign instructions survive insertion and reversal; all 313 reviewed branch operands are relocated explicitly',()=>{
 const e=compat.evidence,b=e.bridge,code=pair.off.subarray(48,48+e.foreignScriptSize),on=pair.on.subarray(48,48+pair.on.readUInt32LE(44));
 assert.equal(e.jumps.length,313);const removed=Buffer.concat([on.subarray(0,b.at),on.subarray(b.at+b.insert.length/2)]);
 for(const j of e.jumps){assert.equal(code.readUInt16LE(j.at),j.before);assert.equal(removed.readUInt16LE(j.at),j.after);removed.writeUInt16LE(j.before,j.at);}assert(removed.equals(code));
 assert(pair.off.subarray(48+e.foreignScriptSize).equals(pair.on.subarray(48+pair.on.readUInt32LE(44))));
});
test('owned state and removal preserve the foreign baseline for every applicable preset',()=>{
 assert.equal(owned.recognize(pair.off,v),'off');assert.equal(owned.recognize(pair.on,v),'on');
 for(const preset of ['on','all-ko','all-en','decals-ko','decals-en']){assert(owned.merge(pair.off,v,preset).equals(pair.on));assert(owned.merge(pair.on,v,'off').equals(pair.off));}
 for(const preset of ['ammo-ko','ammo-en'])assert(owned.merge(pair.off,v,preset).equals(pair.off));
 assert.equal(diagnostics.classify(pair.off,91836).state,'reviewed-compatible-base');assert.equal(diagnostics.classify(pair.on,91836).state,'reviewed-vending-bridge');
});
test('nearby unknown edits and damaged ON images remain blocked; size alone is never enough',()=>{
 for(const source of [pair.off,pair.on]){const b=Buffer.from(source);b[5300]^=1;assert.equal(compat.identify(b,v[0].off),null);assert.equal(owned.recognize(b,v),null);assert.throws(()=>owned.merge(b,v,'off'),/conflict/);assert.throws(()=>patchFunction(b,p),e=>e.code==='LID_VENDING_UI_CONFLICT');}
 const unrelated={...p,export:91838};assert.throws(()=>patchFunction(pair.off,unrelated),e=>e.code==='LID_VENDING_UI_CONFLICT');
});
