'use strict';
// Compile the actual shipped 5.0.6 insertion payloads, not a parallel JS model.
const assert=require('node:assert/strict');
const catalog=require('../../shared/owned-functions-26639365.json'),audit=require('../../shared/ui-audit-26639365.json');
function plan(kind='all',language='ko'){
 const rows=catalog.objects.filter(p=>p.mod==='vending'&&p.preset===kind+'-'+language),patches=[];
 assert(rows.length,'unknown current UI preset');
 for(const p of rows){const off=Buffer.from(p.off,'base64'),on=Buffer.from(p.on,'base64'),size=on.readUInt32LE(44)-off.readUInt32LE(44);if(!size){assert(on.equals(off));continue;}
  const f=audit.functions.find(f=>f.name===p.name);assert(f);patches.push({name:p.name,export:p.index+1,at:f.at,memoryAt:f.memoryAt,extraMemory:on.readUInt32LE(40)-off.readUInt32LE(40),insert:on.subarray(48+f.at,48+f.at+size).toString('hex')});
 }
 return {build:'26639365',exportCount:catalog.exportCount,patches,testSymbols:audit.symbols};
}
module.exports={plan,audit};
