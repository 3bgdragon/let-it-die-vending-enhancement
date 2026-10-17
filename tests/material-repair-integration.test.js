'use strict';
// Optional private-fixture regression. Never applies to an installed game.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const fixture=process.env.LID_VENDING_GAME_FIXTURE,source=path.resolve(__dirname,'..'),shared=require('../shared/layers'),{DatabaseSync}=require('node:sqlite');
test('standalone catalog drift, backups, menus and composition on real file copies',{skip:!fixture,timeout:600000},async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-vending-repair-')),game=path.join(root,'game'),files=shared.FILES;
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hashes=()=>files.map(f=>sha(fs.readFileSync(path.join(game,f))));
 const original=files.map(f=>sha(fs.readFileSync(path.join(fixture,f))));
 t.after(()=>{assert.deepEqual(files.map(f=>sha(fs.readFileSync(path.join(fixture,f)))),original);assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.match(path.basename(root),/^lid-vending-repair-/);fs.rmSync(root,{recursive:true,force:true});});
 for(const f of files){fs.mkdirSync(path.dirname(path.join(game,f)),{recursive:true});fs.copyFileSync(path.join(fixture,f),path.join(game,f));}
 const dbfile=path.join(game,files[5]),stateFile=path.join(game,'LID-Mod-State/state.json'),backups=()=>shared.backups(game,'vending');
 function db(fn){const conn=new DatabaseSync(dbfile);try{return fn(conn);}finally{conn.close();}}
 const count=()=>db(d=>d.prepare('SELECT count(*) n FROM master_automaticshop_lineup WHERE goods_id>=1900000000 AND goods_id<1900010000').get().n);
 function apply(options={decals:true,ammo:true},lang='ko'){
  const code=`const p=require(${JSON.stringify(path.join(source,'src/patcher'))});require(${JSON.stringify(path.join(source,'src/language'))}).setLanguage(${JSON.stringify(lang)});try{console.log(JSON.stringify({result:p.apply(${JSON.stringify(game)},${JSON.stringify(path.join(root,'legacy-backups'))},${JSON.stringify(options)})}));}catch(e){console.log(JSON.stringify({error:e.message}));}`;
  return JSON.parse(cp.execFileSync(process.execPath,['--no-warnings','-e',code],{encoding:'utf8',timeout:120000,windowsHide:true}));
 }
 const first=apply();assert(!first.error,first.error);assert(first.result.changed);assert.equal(count(),106);assert.equal(backups().length,1);
 const baseline=files.map(f=>fs.readFileSync(path.join(game,f))),receipt=fs.readFileSync(stateFile);
 function reset(){for(let i=0;i<files.length;i++){const to=path.join(game,files[i]);if(sha(fs.readFileSync(to))!==sha(baseline[i]))fs.writeFileSync(to,baseline[i]);}fs.writeFileSync(stateFile,receipt);}
 function verifyBackup(result,before){assert(result.backup);const m=JSON.parse(fs.readFileSync(path.join(result.backup,'manifest.json')));assert.equal(m.status,'applied');assert.deepEqual(m.before,before);for(let i=0;i<files.length;i++)assert.equal(sha(fs.readFileSync(path.join(result.backup,'original-'+i))),before[i]);}
 function restore(result,before){shared.restore(game,result.backup);assert.deepEqual(hashes(),before);}
 await t.test('first installation has real originals in the shared backup path',()=>{verifyBackup(first.result,original);assert(first.result.backup.includes(path.join('LID-Mod-State','backups')));assert(!fs.existsSync(path.join(root,'legacy-backups')));});
 await t.test('fresh-process identical reapply verifies DB and creates no backup',()=>{const before=hashes(),n=backups().length,r=apply();assert(!r.error,r.error);assert.equal(r.result.changed,false);assert.equal(r.result.backup,null);assert.equal(r.result.rows,106);assert.deepEqual(hashes(),before);assert.equal(backups().length,n);});
 for(const all of [true,false])await t.test((all?'whole DB reset':'one missing row')+' repairs only missing rows; exact backup restores pre-repair files',()=>{
  reset();if(all)fs.copyFileSync(path.join(fixture,files[5]),dbfile);else db(d=>d.exec('DELETE FROM master_automaticshop_lineup WHERE goods_id=1900000000'));
  db(d=>d.exec("CREATE TABLE repair_foreign_sentinel(value TEXT); INSERT INTO repair_foreign_sentinel VALUES('preserve'); UPDATE master_automaticshop_lineup SET pack_money=777777 WHERE goods_id=(SELECT min(goods_id) FROM master_automaticshop_lineup WHERE goods_id<1900000000)"));
  const before=hashes(),r=apply();assert(!r.error,r.error);assert(r.result.changed);assert.equal(r.result.repairedMaterials,all?106:1);assert.equal(count(),106);assert.deepEqual(hashes().slice(0,5),before.slice(0,5));
  db(d=>{assert.equal(d.prepare('SELECT value FROM repair_foreign_sentinel').get().value,'preserve');assert.equal(d.prepare('SELECT pack_money FROM master_automaticshop_lineup WHERE goods_id=(SELECT min(goods_id) FROM master_automaticshop_lineup WHERE goods_id<1900000000)').get().pack_money,777777);});verifyBackup(r.result,before);restore(r.result,before);
 });
 for(const [name,mutate] of [
  ['price conflict',()=>db(d=>d.exec('UPDATE master_automaticshop_lineup SET pack_money=1 WHERE goods_id=1900000000'))],
  ['bundle conflict',()=>db(d=>d.exec('UPDATE master_automaticshop_lineup SET pack_count=1 WHERE goods_id=1900000000'))],
  ['reserved ID conflict',()=>db(d=>d.exec('UPDATE master_automaticshop_lineup SET goods_id=1900000500 WHERE goods_id=1900000000'))],
  ['corrupt DB',()=>fs.writeFileSync(dbfile,'not a database')]
 ])await t.test(name+' stops without writes or a fake success',()=>{reset();mutate();const before=hashes(),n=backups().length,r=apply();assert(r.error);assert(!r.result);assert.deepEqual(hashes(),before);assert.equal(backups().length,n);});
 await t.test('changing features also repairs a missing row, without dropping unrelated data',()=>{reset();db(d=>d.exec('DELETE FROM master_automaticshop_lineup WHERE goods_id=1900000000'));const before=hashes(),r=apply({decals:false,ammo:false});assert(!r.error,r.error);assert(r.result.changed);assert.equal(r.result.repairedMaterials,1);assert.equal(count(),106);const state=shared.receipt(game);assert.equal(state.config.decals,false);assert.equal(state.config.ammo,false);verifyBackup(r.result,before);restore(r.result,before);});
 await t.test('missing backup directory never masquerades as a newly created backup',()=>{reset();const from=path.join(game,'LID-Mod-State/backups'),to=path.join(game,'LID-Mod-State/held-backups');assert(from.startsWith(game+path.sep)&&to.startsWith(game+path.sep));fs.renameSync(from,to);try{const before=hashes(),r=apply();assert(!r.error,r.error);assert.equal(r.result.backup,null);assert.equal(r.result.existingBackups,0);assert.equal(r.result.backupDirectory,from);assert(!fs.existsSync(from));assert.deepEqual(hashes(),before);}finally{fs.renameSync(to,from);}});
 async function menu(lang){return await new Promise((resolve,reject)=>{let output='',step=0;const ch=cp.spawn(process.execPath,['--no-warnings',path.join(source,'tool.js'),'--game',game,'--lang',lang],{windowsHide:true});ch.stdout.setEncoding('utf8');ch.stderr.setEncoding('utf8');const timer=setTimeout(()=>{ch.kill();reject(Error('CLI timeout'));},120000);ch.stdout.on('data',text=>{output+=text;if(step===0&&output.includes(lang==='ko'?'선택: ':'Select: ')){step=1;ch.stdin.write('1\n');}else if(step===1&&output.includes(lang==='ko'?'동의합니까? (y/N): ':'Proceed? (y/N): ')){step=2;ch.stdin.write('y\n');}else if(step===2&&text.includes(lang==='ko'?'선택: ':'Select: ')){step=3;ch.stdin.write('4\n');}});ch.stderr.on('data',text=>{output+=text;});ch.on('error',reject);ch.on('close',code=>{clearTimeout(timer);try{assert.equal(code,0,output);assert.equal(step,3,output);resolve(output);}catch(e){reject(e);}});});}
 for(const lang of ['ko','en'])await t.test('real '+lang+' menu reports repair, actual backup path and no-op clearly',async()=>{
  reset();fs.copyFileSync(path.join(fixture,files[5]),dbfile);const output=await menu(lang);assert(output.includes(lang==='ko'?'누락 재료 상품 복구: 106':'Missing material entries restored: 106'),output);assert(output.includes(lang==='ko'?'새 변경 전 백업 생성: ':'New pre-change backup created: '));assert(output.includes(path.join(game,'LID-Mod-State/backups')));assert.equal(count(),106);
  const before=hashes(),n=backups().length,repeat=await menu(lang);assert(repeat.includes(lang==='ko'?'새 백업을 만들지 않았습니다':'no new backup'));assert.deepEqual(hashes(),before);assert.equal(backups().length,n);
 });
 await t.test('guard, warp and M2G remain unchanged during material-only repair',{skip:!process.env.LID_COMPAT_TOOL_ROOT},()=>{
  reset();const code=`const h=require(${JSON.stringify(path.join(process.env.LID_COMPAT_TOOL_ROOT||'.','test-updated-standalone.cjs'))});for(const m of ['guard','warp','m2g'])h.apply(${JSON.stringify(game)},m);h.check(${JSON.stringify(game)},['guard','warp','m2g','vending']);`;
  cp.execFileSync(process.execPath,['--no-warnings','-e',code],{encoding:'utf8',windowsHide:true,timeout:180000});db(d=>d.exec('DELETE FROM master_automaticshop_lineup WHERE goods_id=1900000000'));const before=hashes(),r=apply();assert(!r.error,r.error);assert.equal(r.result.repairedMaterials,1);assert.deepEqual(hashes().slice(0,5),before.slice(0,5));verifyBackup(r.result,before);restore(r.result,before);
 });
});
