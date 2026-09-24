'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {backupRoot,prepareBackups}=require('../src/backup-location');
const {listBackups,FILES,PACKAGE}=require('../src/patcher');
const {sha}=require('../src/executable');
function setup(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'lid-backup-location-'));
 t.after(()=>{assert.equal(path.dirname(base),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('lid-backup-location-'));fs.rmSync(base,{recursive:true,force:true});});
 const tool=path.join(base,'tool-main');fs.mkdirSync(tool);return {base,tool,game:path.join(base,'game')};
}
function fixture(tool,game,name='2026-09-24-test',version=2){
 const folder=path.join(tool,'backups',name);fs.mkdirSync(folder,{recursive:true});
 const files=version===1?FILES:[...FILES,PACKAGE];
 const m={version,game,status:'applied',files:files.map((name,i)=>{
  const b=Buffer.from('original-'+i);fs.writeFileSync(path.join(folder,'original-'+i),b);
  return {name,before:sha(b),after:sha(Buffer.from('patched-'+i))};
 })};
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(m));return {folder,m};
}
test('backup root is a visible sibling independent of tool folder name',t=>{
 const {base,tool}=setup(t),root=backupRoot(tool);
 assert.equal(root,path.join(base,'let-it-die-vending-enhancement-backups'));
 assert.equal(root,backupRoot(path.join(base,'download-new-version')));
 assert.deepEqual(prepareBackups(tool),{root,copied:[]});
});
test('verified migration survives deleting and replacing the tool folder',t=>{
 const {base,tool,game}=setup(t),{folder}=fixture(tool,game);
 const {root,copied}=prepareBackups(tool);assert.equal(copied.length,1);
 for(const f of ['original-0','original-1','original-2'])assert.deepEqual(fs.readFileSync(path.join(folder,f)),fs.readFileSync(path.join(copied[0],f)));
 assert.ok(fs.existsSync(folder),'legacy remains untouched');
 assert.equal(path.dirname(tool),base);fs.rmSync(tool,{recursive:true});
 const newer=path.join(base,'tool-new');fs.mkdirSync(newer);
 assert.equal(prepareBackups(newer).root,root);assert.equal(listBackups(root,game).length,1);
});
test('repeated migration never resurrects restored sibling backup',t=>{
 const {tool,game}=setup(t);fixture(tool,game);
 const first=prepareBackups(tool),mfile=path.join(first.copied[0],'manifest.json');
 const m=JSON.parse(fs.readFileSync(mfile));m.status='restored';fs.writeFileSync(mfile,JSON.stringify(m));
 assert.equal(prepareBackups(tool).copied.length,0);
 assert.equal(listBackups(first.root,game)[0].manifest.status,'restored');
});
test('corrupt legacy original fails without publishing or deleting the source',t=>{
 const {tool,game}=setup(t),{folder}=fixture(tool,game);
 fs.writeFileSync(path.join(folder,'original-0'),'corrupt');
 assert.throws(()=>prepareBackups(tool),/해시/);assert.ok(fs.existsSync(folder));
 assert.equal(listBackups(backupRoot(tool),game).length,0);
});
test('name collision with different identity is not overwritten',t=>{
 const {base,tool,game}=setup(t);fixture(tool,game);const first=prepareBackups(tool);
 const other=path.join(base,'other-tool');fixture(other,path.join(base,'other-game'));
 assert.throws(()=>prepareBackups(other),/같은 이름/);
 assert.equal(listBackups(first.root,game).length,1);
});
test('legacy two-file backups migrate and game installations remain filtered',t=>{
 const {tool,game,base}=setup(t);fixture(tool,game,'2026-01',1);fixture(tool,path.join(base,'game2'),'2026-02',2);
 const {root,copied}=prepareBackups(tool);assert.equal(copied.length,2);
 assert.equal(listBackups(root,game).length,1);assert.equal(listBackups(root,game)[0].manifest.version,1);
});
test('unfinished migration records are never restore candidates',t=>{
 const {tool,game}=setup(t),{m}=fixture(tool,game);
 const root=backupRoot(tool),stage=path.join(root,'.migration-interrupted');fs.mkdirSync(stage,{recursive:true});
 fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(m));assert.equal(listBackups(root,game).length,0);
});
