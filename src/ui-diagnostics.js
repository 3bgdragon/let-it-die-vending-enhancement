'use strict';
// Read-only, bounded UI evidence. No save/database rows, credentials or EXE bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const owned=require('../shared/owned-functions'),plan=require('../patches/vending-build25386710.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const FILE='BrgGame/CookedPCConsole/BrgGame.upk';
function classify(bytes,index){
 const v=owned.group('vending','BrgGame.upk',index),digest=sha(bytes);
 if(!v)return {state:'unreviewed'};
 if(v[0].offHash===digest&&bytes.length===v[0].off.length)return {state:'reviewed-stock'};
 if(index===91836){
  const compat=require('./tick-compat'),state=compat.identify(bytes,v[0].off);
  if(state!==null)return {state:state==='off'?'reviewed-compatible-base':'reviewed-vending-bridge',compatibility:'SkillExchange.Tick/66b852e2',baseFunctionSha256:compat.evidence.foreignSha256};
 }
 const presets=v.filter(p=>p.onHash===digest&&p.on.length===bytes.length).map(p=>p.preset);
 if(presets.length)return {state:'reviewed-vending-bridge',presets};
 return {state:'unknown-modified',recognition:owned.recognize(bytes,v)};
}
function collect(game,{tool=path.resolve(__dirname,'..'),features=null,error=null}={}){
 const report={format:'LID-VENDING-DIAGNOSTICS-1',created:new Date().toISOString(),edition:'standalone',
  toolVersion:require('../package.json').version,node:process.version,tool:path.resolve(tool),game:game?path.resolve(game):null,
  requestedFeatures:features,readOnly:true,contains:['game/tool paths','game file hashes','reviewed UI function bytecode'],
  excludes:['save data','database contents','credentials','full executable/package'],
  error:error?{message:error.message,code:error.code||null,failedStagingFunction:error.diagnostics||null}:null};
 if(!game)return report;
 try{
  const data=fs.readFileSync(path.join(game,FILE));
  report.package={path:path.join(path.resolve(game),FILE),size:data.length,sha256:sha(data)};
  if(data.length>=0x75)report.package.header={tag:data.readUInt32LE(0),version:data.readUInt16LE(4),licenseeVersion:data.readUInt16LE(6),exports:data.readUInt32LE(0x21),compressedChunks:data.readUInt32LE(0x71)};
  const rows=owned.objects(data,'vending','BrgGame.upk').rows;
  report.functions=rows.map(row=>{
   const p=plan.patches.find(p=>p.export===row.index+1),bytes=row.bytes;
   return {expectedName:p?.name||null,export:row.index+1,index:row.index,size:bytes.length,sha256:sha(bytes),
    scriptSize:bytes.length>=0x30?bytes.readUInt32LE(0x2c):null,scriptMemory:bytes.length>=0x30?bytes.readUInt32LE(0x28):null,
    expectedStock:p?{size:p.size,sha256:p.before,scriptSize:p.scriptSize,scriptMemory:p.scriptMemory}:null,
    ...classify(bytes,row.index),serializedDataBase64:bytes.length<=1024*1024?bytes.toString('base64'):null};
  });
  // Current package and staged-image evidence are kept separate. An active
  // receipt may temporarily remove its layer before a new build is attempted.
  report.currentVendingState=(()=>{try{return owned.inspect(data,'vending','BrgGame.upk');}catch(e){return {conflict:e.message};}})();
  report.currentVendingStateScope='UI functions only; EXE/DB material state is not inferred';
 }catch(e){report.packageInspectionError=e.message;}
 for(const [key,dir] of [['standalone','LID-Mod-State'],['tfc','LID-TFC-State']]){
  const state=path.join(game,dir,'state.json');report[key+'StatePresent']=fs.existsSync(state);
 }
 return report;
}
function save(directory,report,id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,8)){
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id))throw Error('Invalid diagnostic file identifier');
 fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'diagnostic-'+id+'.json');
 fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'});return file;
}
module.exports={collect,save,classify};
