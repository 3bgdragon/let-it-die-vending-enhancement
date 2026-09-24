'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {plan,patchFunction,linkExecutable}=require('../src/decal-package');
test('decal plan patches only eight UI bridge functions, not mutation/save rules',()=>{
 assert.equal(plan.build,25386710);assert.equal(plan.patches.length,8);
 assert.equal(new Set(plan.patches.map(p=>p.export)).size,8);
 for(const p of plan.patches){
  assert.match(p.name,/^BrgUIMenu_(ItemVendingMachine|SkillExchange)\./);
  assert.ok(!/PutSticker|NetSendHistory|ApplySticker/.test(p.name));
  assert.match(p.before,/^[a-f0-9]{64}$/);assert.ok(p.scriptMemory+p.extraMemory<65535);
  assert.ok(p.at<=p.scriptSize&&p.extraMemory>0);
  for(const j of p.jumps){assert.ok(j.at+2<=p.scriptSize);assert.ok(j.after<p.scriptMemory+p.extraMemory);}
 }
});
test('unknown function bytes are rejected without editing the input',()=>{
 const source=Buffer.alloc(100),before=Buffer.from(source);
 assert.throws(()=>patchFunction(source,plan.patches[0]),/지원하지/);assert.deepEqual(source,before);
});
test('package digest link checks both manifest entries before returning output',()=>{
 const before=Buffer.from('before'),after=Buffer.from('after'),sha=b=>crypto.createHash('sha1').update(b).digest();
 const entry=Buffer.concat([Buffer.from('brggame.upk\0'),sha(before)]),exe=Buffer.concat([Buffer.from('MZ'),entry,entry]);
 const output=linkExecutable(exe,before,after);
 assert.deepEqual(exe.subarray(14,34),sha(before));assert.deepEqual(output.subarray(14,34),sha(after));
 assert.throws(()=>linkExecutable(output,before,after),/해시 연결/);
 assert.throws(()=>linkExecutable(exe.subarray(0,34),before,after),/테이블/);
});
