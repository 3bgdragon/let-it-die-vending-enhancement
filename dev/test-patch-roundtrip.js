'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {FILES:BASE_FILES,PACKAGE}=require('../src/patcher');
const ammo=process.argv.includes('--ammo'),decals=ammo||process.argv.includes('--decals'),FILES=decals?[...BASE_FILES,PACKAGE]:BASE_FILES;
const {sha}=require('../src/executable');
const source=process.argv[2];if(!source)throw new Error('Pass read-only source game directory');
const work=path.resolve(__dirname,'../.work');fs.mkdirSync(work,{recursive:true});
const root=fs.mkdtempSync(path.join(work,'roundtrip-')),copy=path.join(root,'game'),backup=path.join(root,'backups');
// Only generated copies are operated on; a live game need not be stopped for
// this development test. Keep the production process checks unchanged.
const entry=path.resolve(__dirname,'../src/patcher.js'),nativeRequire=require('node:module').createRequire(entry);
const req=name=>{
 if(name==='../shared/layers'){
  const s=nativeRequire(name);
  return {...s,
   transact:(g,k,fn,o)=>{assert.equal(g,copy);return s.transact(g,k,fn,{...o,checkRunning:()=>false});},
   restore:(g,f,o)=>{assert.equal(g,copy);return s.restore(g,f,{...o,checkRunning:()=>false});}
  };
 }
 return nativeRequire(name);
};
const context=require('node:vm').createContext({require:req,__dirname:path.dirname(entry),module:{exports:{}},Buffer,process,console});
require('node:vm').runInContext(fs.readFileSync(entry,'utf8')+'\nstopped=()=>{};',context);
const {apply,restore}=context.module.exports;
const before=FILES.map(name=>fs.readFileSync(path.join(source,name)));
FILES.forEach((name,i)=>{const dest=path.join(copy,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,before[i]);});
// Copy linked packages too; modified EXE fingerprints require all links to
// match actual files before any backup or write is made.
for(const [file] of Object.values(require('../src/executable-links').PACKAGES)){
 const name='BrgGame/CookedPCConsole/'+file,from=path.join(source,name),to=path.join(copy,name);
 if(fs.existsSync(from)&&!fs.existsSync(to)){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
}
function rows(file){const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare('SELECT * FROM master_automaticshop_lineup ORDER BY goods_id').all();}finally{db.close();}}
const originalRows=rows(path.join(copy,FILES[1]));
const result=apply(copy,backup,{decals,ammo});
if(decals){
 const {reader}=require('../src/package-codec'),plan=require(ammo?'../patches/vending-build25386710.json':'../patches/decal-build25386710.json');
 const input=before[2],output=fs.readFileSync(path.join(copy,PACKAGE)),old=reader(input),next=reader(output);
 const wanted=new Set(plan.patches.map(p=>p.export)),ranges=[];let slot=input.readUInt32LE(0x25);
 for(let i=1;i<=plan.exportCount;i++){
  const entry=old.read(slot,68);if(wanted.has(i))ranges.push([slot+32,slot+40]);slot+=68+entry.readUInt32LE(44)*4;
 }
 // Original logical bytes may change only in selected export size/offset fields.
 for(let i=0;i<old.table.length;i++){
  const [at,size]=old.table[i],a=Buffer.from(old.chunk(i)),b=Buffer.from(next.chunk(i).subarray(0,size));
  for(const [lo,hi] of ranges){const start=Math.max(lo,at)-at,end=Math.min(hi,at+size)-at;if(end>start){a.fill(0,start,end);b.fill(0,start,end);}}
  assert.deepEqual(a,b,'Foreign script changed in chunk '+i);
 }
}
const afterRows=rows(path.join(copy,FILES[1]));
assert.equal(result.rows,106);
assert.deepEqual(afterRows.filter(x=>x.goods_id<1900000000),originalRows);
assert.equal(afterRows.length-originalRows.length,106);
assert.equal(apply(copy,backup,{decals,ammo}).changed,false);
const exePath=path.join(copy,FILES[0]),patched=fs.readFileSync(exePath);
const changed=Buffer.from(patched);changed[changed.length-1]^=1;fs.writeFileSync(exePath,changed);
assert.throws(()=>restore(copy,backup),/외부에서 파일이 변경/);
assert.deepEqual(fs.readFileSync(exePath),changed);
fs.writeFileSync(exePath,patched);
restore(copy,backup);
FILES.forEach((name,i)=>{
 if(i!==1)assert.equal(sha(fs.readFileSync(path.join(copy,name))),sha(before[i]));
 assert.equal(sha(fs.readFileSync(path.join(source,name))),sha(before[i]));
});
assert.deepEqual(rows(path.join(copy,FILES[1])),originalRows);
const altered=Buffer.from(before[0]);altered[0x1000]^=1;fs.writeFileSync(exePath,altered);
assert.throws(()=>apply(copy,backup,{decals,ammo}),/지원하지 않는 실행/);
assert.deepEqual(fs.readFileSync(exePath),altered);fs.writeFileSync(exePath,before[0]);
console.log(JSON.stringify({passed:true,decals,ammo,copy,backup:result.backup,added:result.rows,
 existingGoodsUnchanged:true,duplicateApplyNoOp:true,foreignChangeRestoreRejected:true,
 foreignScriptsPreserved:decals,unknownCodeRejected:true,restoredBinariesIdentical:true,restoredDbRowsIdentical:true,sourceUnchanged:true},null,2));
