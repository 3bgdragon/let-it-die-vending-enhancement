'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const workspace=path.resolve(__dirname,'../..');
const fixture=path.join(workspace,'lid-justguard-tool/.integration-temp/guard25386710-test-iuKM3H/game/Binaries/Win64/BrgGame-Steam.exe');
// Standalone ZIPs deliberately omit tfc/. Compare every included kernel;
// compare both editions in a source checkout, without requiring the other ZIP.
const bundledRoots=[path.resolve(__dirname,'../shared/kernel/src'),path.resolve(__dirname,'../tfc/runtime/kernel/src')].filter(p=>fs.existsSync(p));
test('all bundled native preconditions and executable implementations are identical',()=>{
 for(const file of ['native-preconditions.js','native-preconditions-25386710.json','native-preconditions-25767944.json','executable.js','material-selector.js','material-bootstrap.js']){
  const original=fs.readFileSync(path.join(__dirname,'../src',file),'utf8').replace(/\r\n/g,'\n');
  for(const root of bundledRoots)assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n'),original);
 }
});
test('all four kernels preserve unrelated code and reject native dependency conflicts',{skip:!fs.existsSync(fixture)},()=>{
 const stock=fs.readFileSync(fixture),foreign=Buffer.from(stock);foreign[0x100000]^=1;
 const roots=[path.join(__dirname,'../src'),...bundledRoots];
 for(const root of roots){
  const native=require(path.join(root,'executable')),pre=require(path.join(root,'native-preconditions'));
  assert.equal(pre.validate(foreign),'stock');const output=native.patchExecutable(foreign).output;
  assert.equal(output[0x100000],foreign[0x100000]);assert.deepEqual(foreign.subarray(0x100000,0x100100),output.subarray(0x100000,0x100100));
  const broken=Buffer.from(foreign),site=require(path.join(root,'native-preconditions-25386710.json')).expected[0];
  const section=pre.layout(broken).sections.find(s=>site.rva>=s.rva&&site.rva<s.rva+s.rawSize);broken[section.raw+site.rva-section.rva]^=1;
  assert.throws(()=>native.patchExecutable(broken),/Conflicting native bytes/);
  assert.throws(()=>native.patchExecutable(output),/지원하지|Unsupported/);
 }
 assert.deepEqual(fs.readFileSync(fixture),stock);
});
test('existing warp layout accepts unrelated native changes before vending',{skip:!fs.existsSync(fixture)},()=>{
 const stock=fs.readFileSync(fixture),sites=require('../../lid-tengoku-warp-tool/native-sites'),m=require('../../lid-tengoku-warp-tool/assets/manifest-25386710.json');
 const delta=sites.parsePatch(fs.readFileSync(path.join(workspace,'lid-tengoku-warp-tool/assets',m.executable.native.enablePatch))),warped=Buffer.alloc(delta.size);stock.copy(warped);for(const e of delta.entries)e.bytes.copy(warped,e.offset);warped[0x100000]^=1;
 const pre=require('../src/native-preconditions');assert.equal(pre.validate(warped),'warp');assert.equal(require('../src/executable').patchExecutable(warped).output[0x100000],warped[0x100000]);
});
