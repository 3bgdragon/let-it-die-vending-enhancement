'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const owned=require('../shared/owned-functions'),p=require('../patches/decal-build25386710.json').patches.find(p=>p.export===91837),
 {patchFunction}=require('../src/decal-package'),diagnostics=require('../src/ui-diagnostics');
const v=owned.group('vending','BrgGame.upk',91836),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('length mismatch supplies exact actual/expected fields and a bounded shareable function body',()=>{
 const input=Buffer.from(v[0].on),before=Buffer.from(input);let error;
 try{patchFunction(input,p);}catch(e){error=e;}
 assert.equal(error.code,'LID_VENDING_UI_CONFLICT');assert.equal(error.diagnostics.reason,'function-size-mismatch');
 assert.equal(error.diagnostics.actual.size,input.length);assert.equal(error.diagnostics.actual.sha256,sha(input));
 assert.equal(error.diagnostics.expected.size,p.size);assert.equal(error.diagnostics.expected.sha256,p.before);
 assert.deepEqual(Buffer.from(error.diagnostics.serializedDataBase64,'base64'),input);assert.deepEqual(input,before);
 assert.match(error.message,/Actual \/ 실제: 11296 bytes/);assert.match(error.message,/Expected \/ 예상: 11209 bytes/);
});
test('same-size edits get a different reason; neither an unknown body nor a partial bridge is silently installed',()=>{
 const b=Buffer.from(v[0].off);b[1000]^=1;
 assert.throws(()=>patchFunction(b,p),e=>e.code==='LID_VENDING_UI_CONFLICT'&&e.diagnostics.reason==='function-hash-mismatch');
 assert.equal(diagnostics.classify(b,91836).state,'unknown-modified');
 assert.equal(diagnostics.classify(v[0].off,91836).state,'reviewed-stock');
 assert.equal(diagnostics.classify(v[0].on,91836).state,'reviewed-vending-bridge');
});
test('an oversized invalid body is not duplicated into a diagnostic attachment',()=>{
 const input=Buffer.alloc(1024*1024+1);let error;try{patchFunction(input,p);}catch(e){error=e;}
 assert.equal(error.diagnostics.serializedDataBase64,null);assert.equal(error.diagnostics.actual.size,input.length);
});
test('JSON saving is exclusive, inspect failures are explicit and no target path is created',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-vending-diag-'));
 try{
  const absent=path.join(root,'absent-game'),report=diagnostics.collect(absent),file=diagnostics.save(path.join(root,'logs'),report,'test');
  assert.equal(fs.existsSync(absent),false);assert(report.packageInspectionError);assert.equal(report.readOnly,true);
  assert.equal(report.edition,'standalone');assert(!('shop' in report));assert(!('save' in report));
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),report);assert.throws(()=>diagnostics.save(path.join(root,'logs'),report,'test'),/EEXIST/);
  assert.throws(()=>diagnostics.save(path.join(root,'logs'),report,'../escape'),/identifier/);
  const badGame=path.join(root,'bad-game'),badFile=path.join(badGame,'BrgGame/CookedPCConsole/BrgGame.upk');
  fs.mkdirSync(path.dirname(badFile),{recursive:true});fs.writeFileSync(badFile,'invalid package');
  const bad=diagnostics.collect(badGame);assert.equal(bad.package.sha256,sha(Buffer.from('invalid package')));assert(bad.packageInspectionError);
  assert.equal(fs.readFileSync(badFile,'utf8'),'invalid package');
 }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('lid-vending-diag-'));fs.rmSync(root,{recursive:true,force:true});}
});
test('the actual CLI error handler emits matching text/JSON evidence with selected game and requested features',()=>{
 const vm=require('node:vm'),root=fs.mkdtempSync(path.join(os.tmpdir(),'lid-vending-report-')),messages=[];
 try{
  const tool=path.resolve(__dirname,'../tool.js'),source=fs.readFileSync(tool,'utf8'),start=source.indexOf('function reportError('),end=source.indexOf('\nasync function main()',start);
  const context={fs,path,process,__dirname:root,require:require('node:module').createRequire(tool),console:{error:s=>messages.push(s)},t:(ko,en)=>en,errorText:s=>s};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  let error;try{patchFunction(v[0].on,p);}catch(e){error=e;}
  const game=path.join(root,'missing-game'),features={decals:true,ammo:true};context.reportError(error,{game,features});
  const entries=fs.readdirSync(path.join(root,'logs')),json=entries.find(n=>n.endsWith('.json')),log=entries.find(n=>n.endsWith('.log'));
  assert(json&&log);assert.equal(json.slice('diagnostic-'.length,-5),log.slice('error-'.length,-4));
  const report=JSON.parse(fs.readFileSync(path.join(root,'logs',json)));assert.equal(report.tool,root);assert.equal(report.game,game);
  assert.deepEqual(report.requestedFeatures,features);assert.equal(report.error.failedStagingFunction.actual.size,11296);
  assert(messages.some(s=>s.includes('Shareable UI diagnostic JSON: ')));assert(messages.some(s=>s.includes('NOT mean decals or ammo')));
  assert.equal(fs.existsSync(game),false);
 }finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('lid-vending-report-'));fs.rmSync(root,{recursive:true,force:true});}
});
