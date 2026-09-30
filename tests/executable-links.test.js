'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {PACKAGES,digestOffsets,normalizedExecutable,validatePackageLinks}=require('../src/executable-links');
function fixture(){
 return Buffer.concat([Buffer.from('MZ-native-code'),...Object.entries(PACKAGES).flatMap(([name,[,count]])=>
  Array.from({length:count},()=>Buffer.concat([Buffer.from(name+'\0'),Buffer.alloc(20,1)]))),Buffer.from('native-tail')]);
}
test('normalization ignores only six package digests, not executable code',()=>{
 const a=fixture(),b=Buffer.from(a);
 for(const [name,[,count]] of Object.entries(PACKAGES))for(const at of digestOffsets(b,name,count))b.fill(2,at,at+20);
 assert.deepEqual(normalizedExecutable(a),normalizedExecutable(b));
 assert.notDeepEqual(a,b);b[b.length-1]^=1;assert.notDeepEqual(normalizedExecutable(a),normalizedExecutable(b));
});
test('missing, duplicate and truncated digest entries fail closed',()=>{
 const a=fixture();assert.throws(()=>normalizedExecutable(Buffer.from('MZ')),/해시 테이블/);
 assert.throws(()=>normalizedExecutable(Buffer.concat([a,Buffer.from('brggame.upk\0'),Buffer.alloc(20)])),/해시 테이블/);
 assert.throws(()=>digestOffsets(Buffer.from('brggame.upk\0'), 'brggame.upk',2),/잘린/);
});
test('every linked package must match, including both BrgGame entries',t=>{
 const game=fs.mkdtempSync(path.join(os.tmpdir(),'lid-links-'));t.after(()=>fs.rmSync(game,{recursive:true,force:true}));
 const dir=path.join(game,'BrgGame','CookedPCConsole');fs.mkdirSync(dir,{recursive:true});const exe=fixture();
 for(const [name,[file,count]] of Object.entries(PACKAGES)){
  const bytes=Buffer.from(file);fs.writeFileSync(path.join(dir,file),bytes);
  const hash=crypto.createHash('sha1').update(bytes).digest();for(const at of digestOffsets(exe,name,count))hash.copy(exe,at);
 }
 validatePackageLinks(exe,game);
 exe[digestOffsets(exe,'brggame.upk',2)[1]]^=1;
 assert.throws(()=>validatePackageLinks(exe,game),/BrgGame/);
});
