'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {apply,restore,FILES:BASE_FILES,PACKAGE}=require('../src/patcher');
const ammo=process.argv.includes('--ammo'),decals=ammo||process.argv.includes('--decals'),FILES=decals?[...BASE_FILES,PACKAGE]:BASE_FILES;
const {sha}=require('../src/executable');
const source=process.argv[2];if(!source)throw new Error('Pass read-only source game directory');
const work=path.resolve(__dirname,'../.work');fs.mkdirSync(work,{recursive:true});
const root=fs.mkdtempSync(path.join(work,'roundtrip-')),copy=path.join(root,'game'),backup=path.join(root,'backups');
const before=FILES.map(name=>fs.readFileSync(path.join(source,name)));
FILES.forEach((name,i)=>{const dest=path.join(copy,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,before[i]);});
function rows(file){const db=new DatabaseSync(file,{readOnly:true});try{return db.prepare('SELECT * FROM master_automaticshop_lineup ORDER BY goods_id').all();}finally{db.close();}}
const originalRows=rows(path.join(copy,FILES[1]));
const result=apply(copy,backup,{decals,ammo});
const afterRows=rows(path.join(copy,FILES[1]));
assert.equal(result.rows,106);
assert.deepEqual(afterRows.filter(x=>x.goods_id<1900000000),originalRows);
assert.equal(afterRows.length-originalRows.length,106);
assert.throws(()=>apply(copy,backup,{decals,ammo}),/지원하지 않는 실행/);
const exePath=path.join(copy,FILES[0]),patched=fs.readFileSync(exePath);
const changed=Buffer.from(patched);changed[changed.length-1]^=1;fs.writeFileSync(exePath,changed);
assert.throws(()=>restore(copy,backup),/다른 변경/);
assert.deepEqual(fs.readFileSync(exePath),changed);
fs.writeFileSync(exePath,patched);
restore(copy,backup);
FILES.forEach((name,i)=>{
 assert.equal(sha(fs.readFileSync(path.join(copy,name))),sha(before[i]));
 assert.equal(sha(fs.readFileSync(path.join(source,name))),sha(before[i]));
});
console.log(JSON.stringify({passed:true,decals,ammo,copy,backup:result.backup,added:result.rows,
 existingGoodsUnchanged:true,duplicateApplyRejected:true,foreignChangeRestoreRejected:true,
 restoredByteIdentical:true,sourceUnchanged:true},null,2));
