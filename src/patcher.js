'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const {patchExecutable,sha}=require('./executable');
const {planMaterialCatalog}=require('./material-catalog');
const {patchPackage,linkExecutable}=require('./decal-package');
const FILES=['Binaries/Win64/BrgGame-Steam.exe','BrgGame/Content/masters.db'];
const PACKAGE='BrgGame/CookedPCConsole/BrgGame.upk';
function stopped() {
  if(process.platform!=='win32')return;
  let result;
  try{result=execFileSync('tasklist.exe',['/FI','IMAGENAME eq BrgGame-Steam.exe','/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});}
  catch{throw new Error('게임 실행 여부를 확인하지 못했습니다. 관리자 권한으로 실행하거나 시스템 권한을 확인하세요. 파일은 변경하지 않습니다.');}
  if(/BrgGame-Steam\.exe/i.test(result))throw new Error('게임을 완전히 종료한 뒤 실행하세요.');
}
function paths(game,files=FILES){return files.map(f=>path.join(path.resolve(game),f));}
function ensureDbClosed(file){for(const suffix of ['-wal','-shm','-journal'])if(fs.existsSync(file+suffix))throw new Error('DB 사용/복구 파일이 있습니다: '+file+suffix);}
function replace(file,bytes){
  const temp=file+'.lidvend-'+crypto.randomBytes(8).toString('hex')+'.tmp';
  fs.writeFileSync(temp,bytes,{flag:'wx'});
  try{fs.renameSync(temp,file);}catch(error){fs.unlinkSync(temp);throw error;}
}
function apply(game,backupRoot,{decals=false,ammo=false}={}) {
  if(ammo)decals=true;
  stopped();const files=decals?[...FILES,PACKAGE]:FILES,targets=paths(game,files);ensureDbClosed(targets[1]);
  const originals=targets.map(f=>fs.readFileSync(f));const exe=patchExecutable(originals[0]);
  const upk=decals?patchPackage(originals[2],ammo?require('../patches/vending-build25386710.json'):undefined):null;
  if(decals)exe.output=linkExecutable(exe.output,originals[2],upk);
  exe.details.after=sha(exe.output);
  const probe=new DatabaseSync(targets[1],{readOnly:true});let rows;
  try{rows=planMaterialCatalog(probe);}finally{probe.close();}
  const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex');
  const folder=path.resolve(backupRoot,id);fs.mkdirSync(folder,{recursive:true});
  originals.forEach((b,i)=>fs.writeFileSync(path.join(folder,'original-'+i),b,{flag:'wx'}));
  const dbStage=path.join(folder,'staged.db');fs.writeFileSync(dbStage,originals[1],{flag:'wx'});
  const db=new DatabaseSync(dbStage);
  try{
    db.exec('BEGIN IMMEDIATE');const cols=Object.keys(rows[0]);
    const insert=db.prepare(`INSERT INTO master_automaticshop_lineup (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`);
    for(const row of rows)insert.run(...cols.map(k=>row[k]));
    db.exec('COMMIT');
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('패치 DB 무결성 실패');
  }finally{db.close();}
  const outputs=[exe.output,fs.readFileSync(dbStage)];
  if(decals)outputs.push(upk);
  const manifest={version:decals?2:1,toolVersion:require('../package.json').version,game:path.resolve(game),status:'prepared',decals,ammo,rows:rows.length,files:files.map((name,i)=>({name,before:sha(originals[i]),after:sha(outputs[i])})),exe:exe.details};
  const mpath=path.join(folder,'manifest.json');
  const save=()=>fs.writeFileSync(mpath,JSON.stringify(manifest,null,2));save();
  // Recheck both files before first write: avoid replacing intervening changes.
  targets.forEach((f,i)=>{if(sha(fs.readFileSync(f))!==manifest.files[i].before)throw new Error('준비 중 파일이 변경되었습니다: '+f);});
  stopped();ensureDbClosed(targets[1]);
  try{
    for(let i=0;i<targets.length;i++){
      replace(targets[i],outputs[i]);
      if(sha(fs.readFileSync(targets[i]))!==manifest.files[i].after)throw new Error('쓰기 검증 실패');
    }
    manifest.status='applied';save();
  }catch(error){manifest.status='write-failed';save();throw new Error(error.message+' 백업 복구가 필요할 수 있습니다: '+folder);}
  return {backup:folder,rows:rows.length,decals,ammo};
}
function listBackups(root,game){
  if(!fs.existsSync(root))return [];
  return fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.name.startsWith('.')).map(x=>{
    const folder=path.resolve(root,x.name);try{
      const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
      return manifest.game.toLowerCase()===path.resolve(game).toLowerCase()?{folder,manifest}:null;
    }catch{return null;}
  }).filter(Boolean).sort((a,b)=>b.folder.localeCompare(a.folder));
}
function restore(game,root){
  stopped();const entry=listBackups(root,game).find(x=>['applied','prepared','write-failed'].includes(x.manifest.status));
  if(!entry)throw new Error('복원 가능한 백업이 없습니다');
  const {manifest,folder}=entry;
  const files=manifest.version===1?FILES:manifest.version===2?[...FILES,PACKAGE]:null;
  if(!files||!Array.isArray(manifest.files)||manifest.files.length!==files.length||manifest.files.some((x,i)=>x.name!==files[i]))throw new Error('백업 형식 불일치');
  const targets=paths(game,files);ensureDbClosed(targets[1]);
  const originals=targets.map((_,i)=>fs.readFileSync(path.join(folder,'original-'+i)));
  targets.forEach((f,i)=>{
    const current=sha(fs.readFileSync(f)),record=manifest.files[i];
    if(sha(originals[i])!==record.before)throw new Error('백업 손상');
    if(current!==record.after&&current!==record.before)throw new Error('패치 이후 다른 변경이 있습니다. 덮어쓰지 않습니다: '+f);
  });
  targets.forEach((f,i)=>{replace(f,originals[i]);if(sha(fs.readFileSync(f))!==manifest.files[i].before)throw new Error('복원 검증 실패');});
  manifest.status='restored';fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));return folder;
}
module.exports={apply,restore,listBackups,FILES,PACKAGE};
