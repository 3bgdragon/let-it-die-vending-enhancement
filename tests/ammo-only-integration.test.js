'use strict';
// The opaque resized Tick is a controlled preservation test, NOT the reporter's
// unavailable 66b852e2... function and not a new gameplay verification.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const owned=require('../shared/owned-functions'),shared=require('../shared/layers'),patcher=require('../src/patcher'),links=require('../src/executable-links'),codec=require('../src/package-codec'),lang=require('../src/language');
const {DatabaseSync}=require('node:sqlite'),fixture=process.env.LID_VENDING_GAME_FIXTURE,FILES=shared.FILES;
function replaceObject(data,index,body){
 const {r,rows}=owned.objects(data,'vending','BrgGame.upk'),row=rows.find(x=>x.index===index),last=r.table.length-1;
 r.write(row.slot+32,codec.words(body.length,r.table[last][0]+r.table[last][1]));
 const header=Buffer.from(data.subarray(0,r.headerLength)),parts=[header];let physical=header.length;
 for(let i=0;i<r.table.length;i++){
  const e=r.table[i],raw=i===last?Buffer.concat([r.chunk(i),body]):r.chunk(i),packed=i===last||r.dirty.has(i)?codec.pack(raw):data.subarray(e[2],e[2]+e[3]);
  codec.words(e[0],raw.length,physical,packed.length).copy(header,0x75+i*16);parts.push(packed);physical+=packed.length;
 }
 return Buffer.concat(parts);
}
function logicalDb(file){const d=new DatabaseSync(file,{readOnly:true});try{const schema=d.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();return {schema,tables:schema.filter(x=>x.type==='table').map(x=>({name:x.name,rows:d.prepare('SELECT * FROM "'+x.name.replaceAll('"','""')+'"').all().map(r=>JSON.stringify(r)).sort()}))};}finally{d.close();}}
test('ammo-only installer preserves a foreign 11582-byte Tick and M2G through apply/reapply/switch/remove/restore',{skip:!fixture,timeout:600000},async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-ammo-only-')),game=path.join(root,'game'),legacy=path.join(root,'legacy');
 const hash=()=>FILES.map(f=>owned.sha(fs.readFileSync(path.join(game,f)))),original=FILES.map(f=>owned.sha(fs.readFileSync(path.join(fixture,f))));
 t.after(()=>{lang.setLanguage('ko');assert.deepEqual(FILES.map(f=>owned.sha(fs.readFileSync(path.join(fixture,f)))),original);assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('lid-ammo-only-'));fs.rmSync(root,{recursive:true,force:true});});
 for(const f of FILES){fs.mkdirSync(path.dirname(path.join(game,f)),{recursive:true});fs.copyFileSync(path.join(fixture,f),path.join(game,f));}
 const upkFile=path.join(game,FILES[1]),exeFile=path.join(game,FILES[0]),stock=owned.group('vending','BrgGame.upk',91836)[0].off,size=stock.readUInt32LE(0x2c);
 const foreign=Buffer.concat([stock.subarray(0,0x30+size),Buffer.alloc(373,0x0b),stock.subarray(0x30+size)]);
 foreign.writeUInt32LE(size+373,0x2c);foreign.writeUInt32LE(stock.readUInt32LE(0x28)+373,0x28);assert.equal(foreign.length,11582);
 const relink=()=>{const b=fs.readFileSync(exeFile),digest=require('node:crypto').createHash('sha1').update(fs.readFileSync(upkFile)).digest();for(const e of links.digestEntries(b,'brggame.upk',2))digest.copy(b,e.offset);fs.writeFileSync(exeFile,b);};
 let data=replaceObject(fs.readFileSync(upkFile),91836,foreign);data=owned.set(data,'m2g','BrgGame.upk','on');fs.writeFileSync(upkFile,data);relink();
 const initial=hash(),originalDb=logicalDb(path.join(game,FILES[5])),ignored=owned.objects(data,'vending','BrgGame.upk').rows.filter(o=>!owned.owns(o.variants,'ammo-ko'));
 const verify=()=>{const b=fs.readFileSync(upkFile),rows=owned.objects(b,'vending','BrgGame.upk').rows;for(const old of ignored)assert.deepEqual(rows.find(o=>o.index===old.index).bytes,old.bytes);assert.equal(owned.inspect(b,'m2g','BrgGame.upk'),'on');links.validatePackageLinks(fs.readFileSync(exeFile),game);};
 const count=()=>{const d=new DatabaseSync(path.join(game,FILES[5]),{readOnly:true});try{return d.prepare('SELECT count(*) n FROM master_automaticshop_lineup WHERE goods_id>=1900000000 AND goods_id<1900010000').get().n;}finally{d.close();}};
 await t.test('old 1.1.6 couples ammo to decals and rejects the resized Tick without game writes',()=>{
  if(process.env.LID_VENDING_AMMO_PREVIOUS_TOOL){const previous=path.resolve(process.env.LID_VENDING_AMMO_PREVIOUS_TOOL),code=`try{require(${JSON.stringify(path.join(previous,'src/patcher'))}).apply(${JSON.stringify(game)},${JSON.stringify(legacy)},{decals:false,ammo:true});console.log(JSON.stringify({success:true}));}catch(e){console.log(JSON.stringify({message:e.message,code:e.code}));}`;
   const old=JSON.parse(cp.execFileSync(process.execPath,['--no-warnings','-e',code],{encoding:'utf8',windowsHide:true,timeout:120000}));assert(!old.success);assert.equal(old.code,'LID_VENDING_UI_CONFLICT');assert.match(old.message,/11582/);}
  assert.deepEqual(hash(),initial);
 });
 let installed;
 await t.test('materials plus ammo applies six functions, no decal entry, preserves all five unowned functions and creates real backup',()=>{
  lang.setLanguage('ko');installed=patcher.apply(game,legacy,{decals:false,ammo:true});assert(installed.changed&&installed.backup);assert.equal(installed.decals,false);assert.equal(installed.ammo,true);assert.equal(count(),106);
  verify();assert.equal(owned.inspect(fs.readFileSync(upkFile),'vending','BrgGame.upk'),'ammo-ko');assert.deepEqual(shared.receipt(game).config.ammo,true);assert.equal(shared.receipt(game).config.decals,false);
  assert.deepEqual(fs.readFileSync(path.join(installed.backup,'original-1')),data);
 });
 await t.test('same selected mode is a verified no-op',()=>{const h=hash(),n=shared.backups(game,'vending').length;assert.equal(patcher.apply(game,legacy,{decals:false,ammo:true}).changed,false);assert.deepEqual(hash(),h);assert.equal(shared.backups(game,'vending').length,n);verify();});
 await t.test('missing material rows repair without requiring ownership of foreign Tick',()=>{const d=new DatabaseSync(path.join(game,FILES[5]));d.exec('DELETE FROM master_automaticshop_lineup WHERE goods_id=(SELECT min(goods_id) FROM master_automaticshop_lineup WHERE goods_id>=1900000000 AND goods_id<1900010000)');d.close();assert.equal(count(),105);const before=fs.readFileSync(upkFile),r=patcher.apply(game,legacy,{decals:false,ammo:true});assert(r.changed&&r.backup);assert.equal(r.repairedMaterials,1);assert.equal(count(),106);assert.deepEqual(fs.readFileSync(upkFile),before);verify();});
 await t.test('current shared tooling reads ammo-only layers without changing files or unowned Tick',()=>{
  if(process.env.LID_COMPAT_TOOL_ROOT)for(const mod of ['guard','warp','m2g']){
   const current=require(path.join(process.env.LID_COMPAT_TOOL_ROOT,mod,'shared/layers')),h=hash(),receipt=fs.readFileSync(path.join(game,'LID-Mod-State/state.json')),backups=shared.backups(game).length;
   assert.equal(current.view(game,stage=>{assert.ok(fs.existsSync(path.join(stage,FILES[1])));return 'checked-'+mod;}),'checked-'+mod);
   assert.deepEqual(hash(),h);assert.ok(fs.readFileSync(path.join(game,'LID-Mod-State/state.json')).equals(receipt));assert.equal(shared.backups(game).length,backups);verify();
  }
 });
 await t.test('switching English/Korean ammo labels preserves foreign Tick',()=>{for(const language of ['en','ko']){lang.setLanguage(language);assert(patcher.apply(game,legacy,{decals:false,ammo:true}).changed);assert.equal(owned.inspect(fs.readFileSync(upkFile),'vending','BrgGame.upk'),'ammo-'+language);verify();}});
 await t.test('explicit all-feature request still blocks unknown decal code without downgrading or destroying ammo installation',()=>{const h=hash(),n=shared.backups(game,'vending').length;assert.throws(()=>patcher.apply(game,legacy,{decals:true,ammo:true}),e=>e.code==='LID_VENDING_UI_CONFLICT');assert.deepEqual(hash(),h);assert.equal(shared.backups(game,'vending').length,n);verify();});
 await t.test('loss of an owned ammo function remains blocked before writes',()=>{
  const prior=fs.readFileSync(upkFile);const b=owned.set(prior,'vending','BrgGame.upk','off',{scopePreset:'ammo-ko'});fs.writeFileSync(upkFile,b);relink();const h=hash();
  assert.throws(()=>patcher.apply(game,legacy,{decals:false,ammo:true}),/lost|conflict|유실|충돌/i);assert.deepEqual(hash(),h);fs.writeFileSync(upkFile,prior);relink();
 });
 await t.test('selective removal restores five files exactly and all DB schema/rows semantically, retaining foreign Tick/M2G',()=>{patcher.restore(game,legacy);assert.equal(shared.receipt(game),null);assert.equal(count(),0);verify();assert.deepEqual(hash().slice(0,5),initial.slice(0,5));assert.deepEqual(logicalDb(path.join(game,FILES[5])),originalDb);});
 await t.test('new installation followed by full snapshot restore is byte-exact for all six pre-operation files',()=>{const h=hash(),r=patcher.apply(game,legacy,{decals:false,ammo:true});verify();shared.restore(game,r.backup);assert.deepEqual(hash(),h);verify();});
 await t.test('compacted layout and later independent drop edit rebase without resetting unknown decal code',()=>{
  patcher.apply(game,legacy,{decals:false,ammo:true});shared.compactPackages(game);assert(shared.layoutState(game));verify();
  const current=fs.readFileSync(upkFile),{r,rows}=owned.objects(current,'warp','BrgGame.upk'),drop=rows.find(x=>x.index===71346),changed=Buffer.from(drop.bytes);assert.equal(changed[23626],20);changed[23626]=0;r.write(drop.offset,changed);
  const header=Buffer.from(current.subarray(0,r.headerLength)),parts=[header];let at=header.length;for(let i=0;i<r.table.length;i++){const e=r.table[i],packed=r.dirty.has(i)?codec.pack(r.chunk(i)):current.subarray(e[2],e[2]+e[3]);codec.words(e[0],e[1],at,packed.length).copy(header,0x75+i*16);parts.push(packed);at+=packed.length;}
  fs.writeFileSync(upkFile,Buffer.concat(parts));relink();const h=hash();assert.equal(patcher.apply(game,legacy,{decals:false,ammo:true}).changed,false);assert.deepEqual(hash(),h);verify();
  patcher.restore(game,legacy);verify();assert.equal(count(),0);assert.equal(owned.objects(fs.readFileSync(upkFile),'warp','BrgGame.upk').rows.find(o=>o.index===71346).bytes[23626],0);
 });
});
