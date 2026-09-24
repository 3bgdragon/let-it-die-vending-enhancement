'use strict';
// Requires the locally generated UELib token files; no game content is shipped.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const plan=require('../patches/vending-build25386710.json');
const folder=path.resolve(__dirname,'../.work/ammo-patched-decompiled');
for(const p of plan.patches){
 const ts=JSON.parse(fs.readFileSync(path.join(folder,p.export+'.tokens.json')));
 const boundaries=new Set(ts.map(t=>t.pos));
 assert.equal(ts.at(-1).pos+ts.at(-1).size,p.scriptMemory+p.extraMemory,p.name+' memory size');
 assert.equal(ts.at(-1).disk+ts.at(-1).diskSize,p.scriptSize+p.insert.length/2,p.name+' disk size');
 for(const t of ts)if(t.jump!==null&&t.jump!==65535)assert.ok(boundaries.has(t.jump),`${p.name} jump ${t.jump}`);
 const source=fs.readFileSync(path.join(folder,p.export+'.uc'),'utf8');
 assert.ok(!/(?:\/\/|\/\*)\s*(?:EXCEPTION|DECOMPILE ERROR)|UnknownToken|UnresolvedToken/i.test(source),p.name+' decode error');
}
console.log(JSON.stringify({functions:plan.patches.length,runtimeSizes:true,diskSizes:true,jumpBoundaries:true}));
