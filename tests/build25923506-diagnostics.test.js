'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const diagnostics=require('../src/ui-diagnostics'),owned=require('../shared/owned-functions');
const fixture=process.env.LID_25923506_GAME_FIXTURE;
test('new-build diagnostics use actual export indices and stock references, not the old Tick evidence',{skip:!fixture},()=>{
 const r=diagnostics.collect(fixture),tick=r.functions.find(p=>p.expectedName==='BrgUIMenu_SkillExchange.Tick');
 assert.equal(r.package.header.exports,173715);assert.equal(r.functions.length,11);assert.equal(tick.export,91881);
 assert.equal(tick.state,'reviewed-stock');assert.equal(tick.expectedStock.sha256,tick.sha256);
 for(const f of r.functions){assert(f.expectedName);assert.equal(f.expectedStock.size,f.size);assert.equal(f.expectedStock.sha256,f.sha256);}
 const rows=owned.objects(fs.readFileSync(path.join(fixture,'BrgGame/CookedPCConsole/BrgGame.upk')),'vending','BrgGame.upk').rows;
 const row=rows.find(r=>r.index===91880),unknown=Buffer.from(row.bytes);unknown[5300]^=1;
 assert.equal(diagnostics.classify(unknown,row.index,row.variants).state,'unknown-modified');
});
