'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const l=require('../src/language');
const {spawnSync}=require('node:child_process');
function temp(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-language-'));t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('lid-language-'));fs.rmSync(root,{recursive:true,force:true});l.setLanguage('ko');});return root;}
test('language option leaves game paths and other arguments unchanged',()=>{
 assert.deepEqual(l.parseLanguage(['--game','C:/게임/English','--lang','en']),{args:['--game','C:/게임/English'],language:'en'});
 for(const args of [['--lang'],['--lang','fr'],['--lang','en','--lang','ko']])assert.throws(()=>l.parseLanguage(args));
});
test('settings persist next to tool and survive a changed tool folder name',t=>{
 const root=temp(t),a=path.join(root,'tool-v1'),b=path.join(root,'tool-v2');
 l.saveLanguage(a,'en');assert.equal(l.savedLanguage(b),'en');assert.equal(l.text('한국어','English'),'English');
 l.saveLanguage(b,'ko');assert.equal(l.savedLanguage(a),'ko');assert.equal(l.text('한국어','English'),'한국어');
});
test('language write preserves unrelated preferences and refuses corrupted settings',t=>{
 const root=temp(t),dir=path.join(root,'tool'),file=l.settingsPath(dir);
 fs.writeFileSync(file,JSON.stringify({other:{keep:true}}));l.saveLanguage(dir,'en');
 assert.deepEqual(JSON.parse(fs.readFileSync(file)).other,{keep:true});
 fs.writeFileSync(file,'broken');assert.throws(()=>l.saveLanguage(dir,'ko'));assert.equal(fs.readFileSync(file,'utf8'),'broken');
});
test('known diagnostics translate without altering Korean paths or hashes',t=>{
 temp(t);l.setLanguage('en');
 assert.equal(l.errorText('백업 형식 불일치: C:/한국어/백업'),'Backup format mismatch: C:/한국어/백업');
 assert.equal(l.errorText('지원하지 않는 실행 파일입니다. SHA-256: abc123'),'Unsupported executable. SHA-256: abc123');
 assert.equal(l.errorText('쓰기 검증 실패 백업 복구가 필요할 수 있습니다: C:/백업'),'Write verification failed Backup recovery may be required: C:/백업');
 assert.equal(l.errorText('unknown diagnostic'),'unknown diagnostic');
 l.setLanguage('ko');assert.equal(l.errorText('백업 손상'),'백업 손상');
});
test('CLI English and Korean smoke: menu exits without touching dummy game files',t=>{
 const root=temp(t),tool=path.join(root,'tool'),game=path.join(root,'game');
 fs.mkdirSync(tool);
 for(const name of ['tool.js','package.json','material-prices.json','src','patches','vendor','shared'])fs.cpSync(path.join(__dirname,'..',name),path.join(tool,name),{recursive:true});
 const files=['Binaries/Win64/BrgGame-Steam.exe','BrgGame/Content/masters.db'];
 for(const f of files){fs.mkdirSync(path.dirname(path.join(game,f)),{recursive:true});fs.writeFileSync(path.join(game,f),'not-a-game');}
 for(const lang of ['en','ko']){
  const result=spawnSync(process.execPath,['--no-warnings',path.join(tool,'tool.js'),'--game',game,'--lang',lang],{input:'4\n',encoding:'utf8',timeout:10000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
  assert.ok(result.stdout.includes(lang==='en'?'Vending Machine Enhancement':'자판기 강화'));
  assert.ok(result.stdout.includes(lang==='en'?'2. Remove vending only':'2. 자판기만 제거'));
  assert.equal(l.savedLanguage(tool),lang);
  for(const f of files)assert.equal(fs.readFileSync(path.join(game,f),'utf8'),'not-a-game');
 }
});
