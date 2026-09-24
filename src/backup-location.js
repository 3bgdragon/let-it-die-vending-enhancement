'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {sha}=require('./executable');
const FILES=['Binaries/Win64/BrgGame-Steam.exe','BrgGame/Content/masters.db','BrgGame/CookedPCConsole/BrgGame.upk'];
const BACKUP_NAME='let-it-die-vending-enhancement-backups';
function backupRoot(toolDir){return path.join(path.dirname(path.resolve(toolDir)),BACKUP_NAME);}
function plain(file,directory=false){
 const s=fs.lstatSync(file);
 if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile()))throw new Error('백업 경로 형식 불일치: '+file);
}
function verify(folder){
 plain(folder,true);const mfile=path.join(folder,'manifest.json');plain(mfile);
 const m=JSON.parse(fs.readFileSync(mfile,'utf8'));
 const expected=m.version===1?FILES.slice(0,2):m.version===2?FILES:null;
 if(!expected||typeof m.game!=='string'||!path.isAbsolute(m.game)||!['applied','prepared','write-failed','restored'].includes(m.status)||
    !Array.isArray(m.files)||m.files.length!==expected.length||m.files.some((f,i)=>f.name!==expected[i]||! /^[a-f0-9]{64}$/i.test(f.before)||! /^[a-f0-9]{64}$/i.test(f.after)))
  throw new Error('백업 형식 불일치: '+folder);
 for(let i=0;i<expected.length;i++){
  const f=path.join(folder,'original-'+i);plain(f);
  if(sha(fs.readFileSync(f))!==m.files[i].before.toLowerCase())throw new Error('백업 원본 해시 불일치: '+f);
 }
 return m;
}
function identity(m){return JSON.stringify({version:m.version,game:path.resolve(m.game).toLowerCase(),files:m.files.map(f=>({name:f.name,before:f.before.toLowerCase(),after:f.after.toLowerCase()}))});}
function prepareBackups(toolDir){
 const root=backupRoot(toolDir),legacy=path.join(path.resolve(toolDir),'backups');
 if(fs.existsSync(root))plain(root,true);
 const copied=[];
 if(!fs.existsSync(legacy))return {root,copied};
 plain(legacy,true);
 for(const entry of fs.readdirSync(legacy,{withFileTypes:true})){
  const source=path.join(legacy,entry.name);
  if(!entry.isDirectory()&&!entry.isSymbolicLink())continue;
  plain(source,true);
  if(!fs.existsSync(path.join(source,'manifest.json')))continue;
  const m=verify(source),destination=path.join(root,entry.name);
  if(fs.existsSync(destination)){
   const existing=verify(destination);
   if(identity(existing)!==identity(m))throw new Error('같은 이름의 다른 백업이 있습니다. 덮어쓰지 않습니다: '+destination);
   // The sibling record is authoritative, especially after a restore. Never
   // resurrect its applied status from a stale copy inside an older tool.
   continue;
  }
  fs.mkdirSync(root,{recursive:true});
  const stage=path.join(root,'.migration-'+crypto.randomBytes(8).toString('hex'));
  fs.mkdirSync(stage);
  for(let i=0;i<m.files.length;i++)fs.copyFileSync(path.join(source,'original-'+i),path.join(stage,'original-'+i),fs.constants.COPYFILE_EXCL);
  // Verify copies before publishing a manifest visible to restore/listBackups.
  for(let i=0;i<m.files.length;i++)if(sha(fs.readFileSync(path.join(stage,'original-'+i)))!==m.files[i].before.toLowerCase())throw new Error('백업 복사 검증 실패: '+stage);
  const sourceNow=verify(source);
  if(JSON.stringify(sourceNow)!==JSON.stringify(m))throw new Error('복사 중 원본 백업 기록이 변경되었습니다: '+source);
  fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(m,null,2),{flag:'wx'});
  verify(stage);
  fs.renameSync(stage,destination);copied.push(destination);
 }
 return {root,copied};
}
module.exports={backupRoot,prepareBackups};
