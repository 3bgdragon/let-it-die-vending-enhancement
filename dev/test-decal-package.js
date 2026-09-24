'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {patchPackage,linkExecutable,plan:decalPlan}=require('../src/decal-package');
const ammo=process.argv.includes('--ammo');
const plan=ammo?require('../patches/vending-build25386710.json'):decalPlan;
const {reader}=require('../src/package-codec');
const game=process.argv[2];if(!game)throw new Error('Read-only source game directory required');
const source=fs.readFileSync(path.join(game,'BrgGame/CookedPCConsole/BrgGame.upk'));
const output=patchPackage(source,plan);
assert.throws(()=>patchPackage(output,plan),/이미 변경/);
const exe=fs.readFileSync(path.join(game,'Binaries/Win64/BrgGame-Steam.exe'));
const linked=linkExecutable(exe,source,output);
assert.ok(!linked.equals(exe));assert.throws(()=>linkExecutable(linked,source,output),/해시 연결/);
const r=reader(output);
// Reuse the audited developer-only uncompressed header (zero compression table
// plus relocated summary tail). Runtime output keeps the real compressed header.
const template=fs.readFileSync(path.resolve(__dirname,'../../lid-justguard-tool/.integration-temp/build25386710/groggy-new.uelib.upk'));
const header=Buffer.from(template.subarray(0,r.table[0][0]));
const logical=Buffer.concat([header,...r.table.map((_,i)=>r.chunk(i))]);
const dest=path.resolve(__dirname,ammo?'../.work/ammo-patched.uelib.upk':'../.work/decal-patched.uelib.upk');fs.writeFileSync(dest,logical);
console.log(JSON.stringify({functions:plan.patches.length,packedBytes:output.length,logical:dest,duplicateRejected:true,hashMismatchRejected:true}));
