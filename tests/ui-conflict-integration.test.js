'use strict';
// Reviewed bridge fragments and an intentionally unknown variant are controlled
// fixtures, not a claim about the reporter's unknown package or valid gameplay.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const owned=require('../shared/owned-functions'),shared=require('../shared/layers'),patcher=require('../src/patcher'),codec=require('../shared/kernel/src/package-codec'),links=require('../shared/kernel/src/executable-links'),diagnostics=require('../src/ui-diagnostics');
const {DatabaseSync}=require('node:sqlite'),fixture=process.env.LID_VENDING_GAME_FIXTURE,FILES=shared.FILES;
function replaceTick(data,body=owned.group('vending','BrgGame.upk',91836)[0].on){
 const {r,rows}=owned.objects(data,'vending','BrgGame.upk'),tick=rows.find(x=>x.index===91836),last=r.table.length-1;
 const position=r.table[last][0]+r.table[last][1];r.write(tick.slot+32,codec.words(body.length,position));
 const header=Buffer.from(data.subarray(0,r.headerLength)),parts=[header];let physical=header.length;
 for(let i=0;i<r.table.length;i++){
  const e=r.table[i],raw=i===last?Buffer.concat([r.chunk(i),body]):r.chunk(i),packed=(i===last||r.dirty.has(i))?codec.pack(raw):data.subarray(e[2],e[2]+e[3]);
  codec.words(e[0],raw.length,physical,packed.length).copy(header,0x75+i*16);parts.push(packed);physical+=packed.length;
 }
 const output=Buffer.concat(parts);assert.deepEqual(owned.objects(output,'vending','BrgGame.upk').rows.find(x=>x.index===91836).bytes,body);return output;
}
test('partial UI conflict: materials-only apply, repeat, external rebase and selective removal preserve UI exactly',{skip:!fixture,timeout:600000},async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-vending-ui-')),game=path.join(root,'game');
 const hash=()=>FILES.map(f=>owned.sha(fs.readFileSync(path.join(game,f))));
 const original=FILES.map(f=>owned.sha(fs.readFileSync(path.join(fixture,f))));
 t.after(()=>{assert.deepEqual(FILES.map(f=>owned.sha(fs.readFileSync(path.join(fixture,f)))),original);assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('lid-vending-ui-'));fs.rmSync(root,{recursive:true,force:true});});
 for(const f of FILES){fs.mkdirSync(path.dirname(path.join(game,f)),{recursive:true});fs.copyFileSync(path.join(fixture,f),path.join(game,f));}
 const upkFile=path.join(game,FILES[1]),exeFile=path.join(game,FILES[0]),stockUpk=fs.readFileSync(upkFile);
 if(process.env.LID_VENDING_OFF_CHECKS==='1'){
  const bytes=fs.readFileSync(exeFile);
  for(const [name,count] of [['brggame.upk',2],['heaven_a01_st_col.upk',1]])for(const entry of links.digestEntries(bytes,name,count))bytes[entry.offset-2]='X'.charCodeAt(0);
  fs.writeFileSync(exeFile,bytes);
 }
 const unknown=Buffer.from(owned.group('vending','BrgGame.upk',91836)[0].on);unknown[1000]^=1;
 // A controlled unknown body tests refusal/preservation, not valid gameplay.
 fs.writeFileSync(upkFile,replaceTick(stockUpk,unknown));
 function flags(){if(process.env.LID_VENDING_OFF_CHECKS==='1')for(const [name,count] of [['brggame.upk',2],['heaven_a01_st_col.upk',1]])assert(links.digestEntries(fs.readFileSync(exeFile),name,count).every(x=>!x.checked));}
 function relink(){const e=fs.readFileSync(exeFile),b=fs.readFileSync(upkFile),digest=require('node:crypto').createHash('sha1').update(b).digest();for(const at of links.digestOffsets(e,'brggame.upk',2))digest.copy(e,at);fs.writeFileSync(exeFile,e);flags();}
 relink();const before=hash(),ui=fs.readFileSync(upkFile),legacy=path.join(root,'legacy');
 const count=()=>{const d=new DatabaseSync(path.join(game,FILES[5]),{readOnly:true});try{return d.prepare('SELECT count(*) n FROM master_automaticshop_lineup WHERE goods_id>=1900000000 AND goods_id<1900010000').get().n;}finally{d.close();}};
 await t.test('all-features application rejects the size mismatch before a backup or game write',()=>{
  assert.throws(()=>patcher.apply(game,legacy,{decals:true,ammo:true}),e=>e.code==='LID_VENDING_UI_CONFLICT'&&e.diagnostics.actual.size===11296&&e.diagnostics.expected.size===11209);
  assert.deepEqual(hash(),before);assert.equal(shared.backups(game,'vending').length,0);
 });
 await t.test('read-only diagnostic identifies an unknown changed bridge, not a successful all-feature installation',()=>{
  const r=diagnostics.collect(game),tick=r.functions.find(x=>x.export===91837);
  assert.equal(tick.state,'unknown-modified');assert.equal(tick.size,11296);assert.equal(tick.expectedStock.size,11209);
  assert.equal(Buffer.from(tick.serializedDataBase64,'base64').length,11296);assert(r.currentVendingState.conflict);assert.deepEqual(hash(),before);
 });
 await t.test('materials-only application adds 106 rows and creates an actual reversible backup without writing UPK',()=>{
  const r=patcher.apply(game,legacy,{decals:false,ammo:false});assert(r.changed&&r.backup);assert.equal(count(),106);
  assert.deepEqual(fs.readFileSync(upkFile),ui);assert.equal(shared.receipt(game).config.decals,false);
  assert.equal(shared.receipt(game).config.ammo,false);links.validatePackageLinks(fs.readFileSync(exeFile),game);
  flags();
 });
 await t.test('identical materials reapply remains a verified no-op with no extra backup',()=>{
  const h=hash(),n=shared.backups(game,'vending').length,r=patcher.apply(game,legacy,{decals:false,ammo:false});
  assert.equal(r.changed,false);assert.equal(r.backup,null);assert.deepEqual(hash(),h);assert.equal(shared.backups(game,'vending').length,n);
 });
 await t.test('requesting decals again does not silently fall back or damage a working material installation',()=>{
  const h=hash(),n=shared.backups(game,'vending').length;
  assert.throws(()=>patcher.apply(game,legacy,{decals:true,ammo:true}),e=>e.code==='LID_VENDING_UI_CONFLICT');
  assert.deepEqual(hash(),h);assert.equal(count(),106);assert.equal(shared.backups(game,'vending').length,n);assert.equal(shared.receipt(game).config.decals,false);
 });
 await t.test('an unrelated external UPK edit rebases while preserving the partial UI body',()=>{
  const r=owned.objects(fs.readFileSync(upkFile),'warp','BrgGame.upk'),row=r.rows.find(x=>x.index===71346),next=Buffer.from(row.bytes);assert.equal(next[23626],20);next[23626]=0;
  r.r.write(row.offset,next);const data=fs.readFileSync(upkFile),header=Buffer.from(data.subarray(0,r.r.headerLength)),parts=[header];let physical=header.length;
  for(let i=0;i<r.r.table.length;i++){const e=r.r.table[i],packed=r.r.dirty.has(i)?codec.pack(r.r.chunk(i)):data.subarray(e[2],e[2]+e[3]);codec.words(e[0],e[1],physical,packed.length).copy(header,0x75+i*16);parts.push(packed);physical+=packed.length;}
  fs.writeFileSync(upkFile,Buffer.concat(parts));relink();const h=hash();assert.equal(patcher.apply(game,legacy,{decals:false,ammo:false}).changed,false);assert.deepEqual(hash(),h);
  assert.deepEqual(owned.objects(fs.readFileSync(upkFile),'vending','BrgGame.upk').rows.find(x=>x.index===91836).bytes,unknown);
 });
 await t.test('selective removal restores native behavior and removes owned material rows while leaving external UI/drop edits',()=>{
  const preserved=fs.readFileSync(upkFile);patcher.restore(game,legacy);assert.equal(count(),0);assert.deepEqual(fs.readFileSync(upkFile),preserved);
  links.validatePackageLinks(fs.readFileSync(exeFile),game);assert.equal(shared.receipt(game),null);
  assert.equal(owned.objects(preserved,'warp','BrgGame.upk').rows.find(x=>x.index===71346).bytes[23626],0);
 });
 await t.test('exact old partial UI fragments recover to the complete requested preset and retain M2G',()=>{
  let partial=replaceTick(stockUpk);partial=owned.set(partial,'m2g','BrgGame.upk','on');
  fs.writeFileSync(upkFile,partial);relink();const h=hash();
  if(process.env.LID_VENDING_PREVIOUS_TOOL){
   const previous=path.resolve(process.env.LID_VENDING_PREVIOUS_TOOL),code=`try{require(${JSON.stringify(path.join(previous,'src/patcher'))}).apply(${JSON.stringify(game)},${JSON.stringify(legacy)},{decals:true,ammo:true});console.log(JSON.stringify({unexpectedSuccess:true}));}catch(e){console.log(JSON.stringify({error:e.message}));}`;
   const old=JSON.parse(cp.execFileSync(process.execPath,['--no-warnings','-e',code],{encoding:'utf8',windowsHide:true,timeout:120000}));
   assert(!old.unexpectedSuccess);assert.match(old.error,/지원하지 않거나 이미 변경된 데칼 메뉴 함수: BrgUIMenu_SkillExchange.Tick/);assert.deepEqual(hash(),h);
  }
  const r=patcher.apply(game,legacy,{decals:true,ammo:true});assert(r.changed&&r.backup);assert.equal(r.recoveredUiFunctions,1);assert.equal(count(),106);
  const after=fs.readFileSync(upkFile);assert(['on','all-ko'].includes(owned.inspect(after,'vending','BrgGame.upk')));assert.equal(owned.inspect(after,'m2g','BrgGame.upk'),'on');
  const m=JSON.parse(fs.readFileSync(path.join(r.backup,'manifest.json')));assert.deepEqual(m.before,h);
  flags();
  assert.deepEqual(fs.readFileSync(path.join(r.backup,'original-1')),partial);links.validatePackageLinks(fs.readFileSync(exeFile),game);
  shared.restore(game,r.backup);assert.deepEqual(hash(),h);assert.deepEqual(fs.readFileSync(upkFile),partial);
 });
 await t.test('complete unmanaged English UI bridges rebuild safely; later loss of a recorded bridge is still rejected',()=>{
  const complete=owned.set(fs.readFileSync(upkFile),'vending','BrgGame.upk','all-en');fs.writeFileSync(upkFile,complete);relink();const h=hash();
  const r=patcher.apply(game,legacy,{decals:true,ammo:true});assert(r.changed);assert.equal(r.recoveredUiFunctions,11);assert.equal(count(),106);flags();
  const applied=FILES.map(f=>fs.readFileSync(path.join(game,f)));
  fs.writeFileSync(upkFile,owned.set(applied[1],'vending','BrgGame.upk','off'));relink();const lost=hash(),n=shared.backups(game,'vending').length;
  assert.throws(()=>patcher.apply(game,legacy,{decals:true,ammo:true}),/lost|conflict|유실|충돌/i);assert.deepEqual(hash(),lost);assert.equal(shared.backups(game,'vending').length,n);
  // Restore only bytes saved by this private test, not a live installation.
  for(let i=0;i<FILES.length;i++)if(owned.sha(fs.readFileSync(path.join(game,FILES[i])))!==owned.sha(applied[i]))fs.writeFileSync(path.join(game,FILES[i]),applied[i]);
  shared.restore(game,r.backup);assert.deepEqual(hash(),h);assert.deepEqual(fs.readFileSync(upkFile),complete);
 });
});
module.exports={replaceTick};
