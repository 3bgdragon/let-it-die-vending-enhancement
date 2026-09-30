'use strict';
// Real-file tests on workspace copies only. Never run an adapter on source files.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const options=require('node:util').parseArgs({options:{all:{type:'boolean'},extras:{type:'boolean'},removals:{type:'boolean'},matrix:{type:'boolean'},source:{type:'string'},db:{type:'string'}}}).values;
const root=path.resolve(__dirname,'..'),work=path.join(root,'.work');fs.mkdirSync(work,{recursive:true});
const run=fs.mkdtempSync(path.join(work,'composition-')),results=[];
const stock=options.source?path.resolve(options.source):path.join(root,'../lid-justguard-tool/.integration-temp/guard25386710-test-iuKM3H/game');
const db=options.db?path.resolve(options.db):options.source?path.join(stock,'BrgGame/Content/masters.db'):path.join(root,'.work/roundtrip-OQJ2HI/game/BrgGame/Content/masters.db');
const shared=require('../shared/layers'),files=shared.FILES;
const source=files.map((name,i)=>fs.readFileSync(i===5?db:path.join(stock,name)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function load(peer,entry,api,kind,game){
 const script=path.resolve(root,'..',peer,entry),nativeRequire=createRequire(script);
 const req=name=>{
  if(/shared[\\/]layers$/.test(name)){const s=nativeRequire(name);return {...s,transact:(g,k,fn,o)=>s.transact(g,k,fn,{...o,checkRunning:()=>false}),restore:(g,f,o)=>s.restore(g,f,{...o,checkRunning:()=>false})};}
  return nativeRequire(name);
 };
 const ctx=vm.createContext({require:req,__dirname:path.dirname(script),Buffer,process,console,module:{exports:{}},testRoot:path.join(game,'legacy'),kind});
 let code=fs.readFileSync(script,'utf8');
 if(kind==='vending'){vm.runInContext(code+'\nstopped=()=>{};module.exports.legacyApply=applyRaw;',ctx);return ctx.module.exports;}
 code=code.split('\nmain().catch')[0];
 vm.runInContext(code+`\nisGameRunning=()=>false;backupRoot=()=>process.env.LID_SHARED_STAGE_BACKUP||require('path').join(testRoot,kind);globalThis.api={${api}};`,ctx);
 return ctx.api;
}
const m2g=require('../../lid-m2g-knife-only/tool');
function permute(xs){return xs.length?xs.flatMap((x,i)=>permute(xs.filter((_,j)=>i!==j)).map(rest=>[x,...rest])):[[]];}
const orders=options.extras||options.removals||options.matrix?[]:options.all?permute(['V','W','G','M']):[['V','W','G','M']];
let reference;
for(const [index,order] of orders.entries()){
 const dir=path.join(run,'case-'+index),game=path.join(dir,'game');
 source.forEach((b,i)=>{const file=path.join(game,files[i]);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b);});
 const W=load('lid-tengoku-warp-tool','lid-tengoku-warp.js','readStatus,setPatchState,restoreBackup','warp',game);
 const G=load('lid-justguard-tool','lid-justguard.js','readStatus,applySettings,restoreBackup','guard',game);
 const V=load('lid-vending-enhancement','src/patcher.js','','vending',game);
 const act=(letter,on)=>{
  assert.equal(path.dirname(dir),run);assert.equal(game,path.join(dir,'game'));
  if(letter==='V')return on?V.apply(game,path.join(dir,'vending-backups'),{decals:true,ammo:true}):V.restore(game,path.join(dir,'vending-backups'));
  if(letter==='W')return W.setPatchState(game,on,true);
  if(letter==='G')return G.applySettings(game,on?'soft':'stock',on?'on':'off',on?'on':'off');
  return on?m2g.apply(game,path.join(dir,'m2g-backups'),{running:()=>false}):m2g.remove(game,path.join(dir,'m2g-backups'),{running:()=>false});
 };
 try{
  for(const letter of order)act(letter,true);
  assert.equal(W.readStatus(game).coherent,true);assert.equal(W.readStatus(game).brgGame.enabled,true);
  assert.equal(G.readStatus(game).groggy.m2g,true);assert.equal(m2g.inspectStatus(m2g.readPair(game)).applied,true);
  const final=files.map(n=>sha(fs.readFileSync(path.join(game,n))));
  if(reference)assert.deepEqual(final,reference,'Order-dependent final files');else reference=final;
  // Remove in a different order, not a reverse-stack requirement.
  for(const letter of ['W','M','G','V'])act(letter,false);
  files.slice(0,5).forEach((n,i)=>assert.equal(sha(fs.readFileSync(path.join(game,n))),sha(source[i]),'Remaining patch: '+n));
  const {DatabaseSync}=require('node:sqlite'),a=new DatabaseSync(db,{readOnly:true}),b=new DatabaseSync(path.join(game,files[5]),{readOnly:true});
  try{assert.deepEqual(b.prepare('SELECT * FROM master_automaticshop_lineup ORDER BY goods_id').all(),a.prepare('SELECT * FROM master_automaticshop_lineup ORDER BY goods_id').all());}finally{a.close();b.close();}
  results.push({order:order.join(''),passed:true,final,nonStackRemoval:'WMGV',originalBinariesRestored:true,originalDbRowsRestored:true});
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify(results,null,2));
  console.log('PASS '+order.join(''));
  if(process.argv.includes('--all')){assert.equal(path.dirname(dir),run);assert.match(path.basename(dir),/^case-\d+$/);fs.rmSync(dir,{recursive:true,force:true});}
 }catch(error){console.error('Failed fixture retained: '+game);throw error;}
}
if(process.argv.includes('--extras')){
 const dir=path.join(run,'extras'),game=path.join(dir,'game');
 source.forEach((b,i)=>{const file=path.join(game,files[i]);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,b);});
 const V=load('lid-vending-enhancement','src/patcher.js','','vending',game);
 const W=load('lid-tengoku-warp-tool','lid-tengoku-warp.js','readStatus,setPatchState','warp',game);
 const G=load('lid-justguard-tool','lid-justguard.js','readStatus,applySettings','guard',game);
 const backupRoot=path.join(dir,'old-backups');
 const legacy=V.legacyApply(game,backupRoot,{decals:true,ammo:true});
 const originalHashes=files.map(n=>sha(fs.readFileSync(path.join(game,n))));
 shared.register(game,legacy.backup,{decals:true,ammo:true,language:'ko'});
 assert.deepEqual(files.map(n=>sha(fs.readFileSync(path.join(game,n)))),originalHashes,'Adoption changed binaries');
 assert.equal(shared.active(game),true);
 assert.equal(V.apply(game,backupRoot,{decals:true,ammo:true}).changed,false);
 for(const mode of [{decals:false,ammo:false},{decals:true,ammo:false},{decals:true,ammo:true}]){
  V.apply(game,backupRoot,mode);assert.equal(shared.materialRows(game).length,106);
  assert.equal(V.apply(game,backupRoot,mode).changed,false);
 }
 require('../src/language').setLanguage('en');V.apply(game,backupRoot,{decals:true,ammo:true});
 assert.equal(shared.receipt(game).config.language,'en');
 W.setPatchState(game,true,true);
 const change=G.applySettings(game,'soft','on','on');
 const guardBackup=shared.backups(game,'guard')[0];assert.ok(guardBackup);
 shared.restore(game,guardBackup,{checkRunning:()=>false});
 assert.equal(W.readStatus(game).coherent,true);assert.equal(W.readStatus(game).brgGame.enabled,true);
 assert.equal(G.readStatus(game).common.profile,'stock');
 const stale=shared.backups(game,'warp')[0];
 m2g.apply(game,path.join(dir,'m2g-backups'),{running:()=>false});
 const backupCount=shared.backups(game,'m2g').length;
 assert.equal(m2g.apply(game,path.join(dir,'m2g-backups'),{running:()=>false}),null);
 assert.equal(shared.backups(game,'m2g').length,backupCount);
 assert.throws(()=>shared.restore(game,stale,{checkRunning:()=>false}),/later changes/);
 V.restore(game,backupRoot);
 assert.equal(W.readStatus(game).brgGame.enabled,true);assert.equal(m2g.inspectStatus(m2g.readPair(game)).applied,true);
 const commonFile=path.join(game,files[2]),commonOriginal=fs.readFileSync(commonFile),tampered=Buffer.from(commonOriginal);tampered[tampered.length-1]^=1;fs.writeFileSync(commonFile,tampered);
 const tamperedHashes=files.map(n=>sha(fs.readFileSync(path.join(game,n))));
 assert.throws(()=>V.apply(game,backupRoot,{decals:true,ammo:true}),/해시 연결|hash link/);
 assert.deepEqual(files.map(n=>sha(fs.readFileSync(path.join(game,n)))),tamperedHashes);fs.writeFileSync(commonFile,commonOriginal);
 V.apply(game,backupRoot,{decals:true,ammo:true});fs.writeFileSync(commonFile,tampered);
 assert.throws(()=>G.applySettings(game,'soft','on','on'),/해시 연결|hash link/);
 assert.throws(()=>V.apply(game,backupRoot,{decals:true,ammo:true}),/해시 연결|hash link/);
 fs.writeFileSync(commonFile,commonOriginal);V.restore(game,backupRoot);
 W.setPatchState(game,false,true);m2g.remove(game,path.join(dir,'m2g-backups'),{running:()=>false});
 files.slice(0,5).forEach((n,i)=>assert.equal(sha(fs.readFileSync(path.join(game,n))),sha(source[i])));
 console.log('PASS legacy adoption, feature changes, bilingual rebuild, repeated apply, shared full restore, stale restore block, selective removal');
}
function setup(name){
 const dir=path.join(run,name),game=path.join(dir,'game');
 source.forEach((b,i)=>{const f=path.join(game,files[i]);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,b);});
 const W=load('lid-tengoku-warp-tool','lid-tengoku-warp.js','readStatus,setPatchState','warp',game);
 const G=load('lid-justguard-tool','lid-justguard.js','readStatus,applySettings','guard',game);
 const V=load('lid-vending-enhancement','src/patcher.js','','vending',game);
 const act=(letter,on)=>letter==='V'?on?V.apply(game,path.join(dir,'legacy-v'),{decals:true,ammo:true}):V.restore(game,path.join(dir,'legacy-v')):letter==='W'?W.setPatchState(game,on,true):letter==='G'?G.applySettings(game,on?'soft':'stock',on?'on':'off',on?'on':'off'):on?m2g.apply(game,path.join(dir,'legacy-m'),{running:()=>false}):m2g.remove(game,path.join(dir,'legacy-m'),{running:()=>false});
 return {dir,game,W,G,V,act};
}
function dbRows(file){const {DatabaseSync}=require('node:sqlite'),d=new DatabaseSync(file,{readOnly:true});try{return d.prepare('SELECT * FROM master_automaticshop_lineup ORDER BY goods_id').all();}finally{d.close();}}
function cleanupLegacy(f){
 for(const target of [path.join(f.game,'legacy'),path.join(f.dir,'legacy-v'),path.join(f.dir,'legacy-m')]){
  assert.ok(target.startsWith(f.dir+path.sep));if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
 }
}
if(options.removals){
 const f=setup('removals'),{game,act}=f;for(const x of ['W','G','M','V'])act(x,true);
 const initial=files.map(n=>fs.readFileSync(path.join(game,n))),state=fs.readFileSync(path.join(shared.stateRoot(game),'state.json'));
 const originalRows=dbRows(db),states=new Map();
 for(const order of permute(['V','W','G','M'])){
  initial.forEach((b,i)=>fs.writeFileSync(path.join(game,files[i]),b));fs.writeFileSync(path.join(shared.stateRoot(game),'state.json'),state);
  const remaining=new Set(['V','W','G','M']);
  for(const x of order){
   act(x,false);remaining.delete(x);
   const W=f.W.readStatus(game),G=f.G.readStatus(game),M=m2g.inspectStatus(m2g.readPair(game));
   assert.equal(W.coherent,true);assert.equal(W.brgGame.enabled,remaining.has('W'));
   assert.equal(G.common.profile,remaining.has('G')?'soft':'stock');assert.equal(!!G.groggy.m2g,remaining.has('M'));
   assert.equal(M.applied,remaining.has('M'));assert.equal(shared.materialRows(game).length,remaining.has('V')?106:0);
   const key=[...remaining].sort().join(''),signature=JSON.stringify([files.slice(0,5).map(n=>sha(fs.readFileSync(path.join(game,n)))),dbRows(path.join(game,files[5]))]);
   if(states.has(key))assert.equal(signature,states.get(key),'Removal order changed subset '+key);else states.set(key,signature);
  }
  files.slice(0,5).forEach((n,i)=>assert.equal(sha(fs.readFileSync(path.join(game,n))),sha(source[i])));
  assert.deepEqual(dbRows(path.join(game,files[5])),originalRows);
  results.push({removal:order.join(''),passed:true,intermediateStatesVerified:4});
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify(results,null,2));console.log('PASS remove '+order.join(''));cleanupLegacy(f);
 }
 assert.equal(states.size,15);console.log('PASS all removal subsets are order-independent');
}
if(options.matrix){
 const f=setup('matrix'),{game,W,G,V}=f,lang=require('../src/language'),links=require('../src/executable-links');
 const originalRows=dbRows(db),codeHashes=new Map(),recipeCache=new Map(),canonicalHashes=new Map();let count=0;
 const strengths=['stock','soft','wide','iron'],toggles=['off','on'];
 for(const strength of strengths)for(const groggy of toggles)for(const melee of toggles){
  G.applySettings(game,strength,groggy,melee);
  for(const warp of [false,true])for(const knife of [false,true]){
   W.setPatchState(game,warp,true);
   const currentKnife=m2g.inspectStatus(m2g.readPair(game)).applied;
   if(knife!==currentKnife){if(knife)m2g.apply(game,path.join(f.dir,'legacy-m'),{running:()=>false});else m2g.remove(game,path.join(f.dir,'legacy-m'),{running:()=>false});}
   const gs=G.readStatus(game);assert.equal(gs.common.profile,strength);assert.equal(gs.groggy.profile.replace(/-centered$/,''),groggy+'-'+melee);assert.equal(!!gs.groggy.m2g,knife);assert.equal(W.readStatus(game).brgGame.enabled,warp);
   const base=[fs.readFileSync(path.join(game,files[0])),fs.readFileSync(path.join(game,files[1]))];
   const canonicalKey=[groggy,melee,warp,knife].join('/'),canonicalHash=sha(base[1]);
   if(canonicalHashes.has(canonicalKey))assert.equal(canonicalHash,canonicalHashes.get(canonicalKey),'Strength changed foreign BrgGame code');else canonicalHashes.set(canonicalKey,canonicalHash);
   for(const language of ['ko','en'])for(const feature of ['none','materials','decals','ammo']){
    if(feature==='none'){count++;continue;}
    const recipeKey=[canonicalHash,language,feature].join('-');let output;
    if(feature==='materials'||recipeCache.has(recipeKey)){
     // Strength affects only Common/its EXE digest. Reuse the byte-identical,
     // already-tested UPK recipe, but rebuild and validate every distinct EXE.
     const upk=feature==='materials'?base[1]:fs.readFileSync(recipeCache.get(recipeKey));
     const native=require('../src/executable').patchExecutable(base[0]).output;
     output=[feature==='materials'?native:require('../src/decal-package').linkExecutable(native,base[1],upk),upk];
    }else{
     output=shared.compose(base,{decals:true,ammo:feature==='ammo',language});
     const file=path.join(run,'recipe-cache',recipeKey+'.upk');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,output[1]);recipeCache.set(recipeKey,file);
    }
    output.forEach((b,i)=>fs.writeFileSync(path.join(game,files[i]),b));links.validatePackageLinks(output[0],game);
    const code=sha(links.normalizedExecutable(output[0]));if(codeHashes.has(warp))assert.equal(code,codeHashes.get(warp),'Foreign native code changed');else codeHashes.set(warp,code);
    if(feature==='materials')assert.ok(output[1].equals(base[1]));
    base.forEach((b,i)=>fs.writeFileSync(path.join(game,files[i]),b));
    results.push({strength,groggy,melee,warp,knife,language,feature,passed:true,exe:sha(output[0]),upk:sha(output[1])});count++;
   }
   cleanupLegacy(f);
  }
  // Actual tool transitions with all three other features present, not just recipe builds.
  W.setPatchState(game,true,true);m2g.apply(game,path.join(f.dir,'legacy-m'),{running:()=>false});lang.setLanguage('en');
  V.apply(game,path.join(f.dir,'legacy-v'),{decals:true,ammo:true});
  for(const next of [strengths[(strengths.indexOf(strength)+1)%4],strength]){
   G.applySettings(game,next,groggy,melee);assert.equal(G.readStatus(game).common.profile,next);
   assert.equal(G.readStatus(game).groggy.m2g,true);assert.equal(W.readStatus(game).brgGame.enabled,true);assert.equal(shared.materialRows(game).length,106);
  }
  V.restore(game,path.join(f.dir,'legacy-v'));assert.deepEqual(dbRows(path.join(game,files[5])),originalRows);
  fs.writeFileSync(path.join(run,'results.json'),JSON.stringify({states:count,canonicalProfiles:results.length/6,rows:results},null,2));
  console.log('PASS matrix '+[strength,groggy,melee].join('/')+'; '+count+'/512 states');cleanupLegacy(f);
 }
 assert.equal(count,512);assert.equal(results.length,384);assert.equal(recipeCache.size,64);console.log('PASS 512 setting states (384 native combinations, 64 unique menu recipes, 128 language-neutral stock states), 32 shared guard transitions');
}
console.log(JSON.stringify({run,cases:results.length,extras:!!options.extras,removals:!!options.removals,matrix:!!options.matrix,passed:true},null,2));
