'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{compile,execute}=require('./helpers/bytecode-vm'),catalog=require('../shared/owned-functions-26639365.json'),audit=require('../shared/ui-audit-26639365.json'),vd='BrgUIMenu_ItemVendingMachine.';
function program(data){const b=Buffer.from(data,'base64');return compile({insert:b.subarray(48,48+b.readUInt32LE(44)).toString('hex'),memoryAt:0,extraMemory:b.readUInt32LE(40)},audit.symbols);}
test('actual stock hidden-Bloodnium mapping reproduces the newly isolated lock defect',()=>{
 const p=audit.supportFunctions.find(p=>p.name===vd+'GetMenuIndex'),body=program(p.body),f={mBuyOnly:false,mUIManager:{mGameInfoNative:{hide:true}}},result=execute(body,f,{inDefinition:6},(n,a,t)=>{assert.equal(n,'IsHideBloodnium');return t.hide;});
 assert.equal(result.value,undefined,'hidden definition 6 jumps to ReturnNothing rather than returning Deathroid row 4');
});
for(const language of ['ko','en'])for(const kind of ['all','decals','ammo'])test('actual vanilla row creation and Deathroid lock preserve '+kind+' '+language+' custom entries',()=>{
 const rows=catalog.objects.filter(p=>p.mod==='vending'&&p.preset===kind+'-'+language&&['SetupTopMenu','GetMenuIndex','GetMenuDefinition'].includes(p.name.split('.').at(-1))),compiled=new Map(rows.map(p=>[p.name,program(p.on)]));
 for(const p of audit.supportFunctions)if(!compiled.has(p.name))compiled.set(p.name,program(p.body));
 for(const buy of [false,true])for(const hide of [false,true])for(const locked of [false,true]){
  const panel={$object:true},f={$object:true,mBuyOnly:buy,mMenuInfoArray:[{}],mDisassembleSteroids:[{mLocalItemInfoList:locked?[]:[{}]},{mLocalItemInfoList:[]}],mUIManager:{$object:true,mCommonTopMenu2:panel,mGameInfoNative:{$object:true,hide}}},disabled=[],locals={lUnitArray:[]};
  const run=(name,vars={})=>execute(compiled.get(vd+name),f,vars,(n,args,target)=>{
   if(n==='IsHideBloodnium')return target.hide;if(n==='GetLocalizeTextST')return args[0];if(n==='ResetUnitArray')return;if(n==='SetUnitArray'){panel.rows=structuredClone(args[0]);return;}if(n==='RefreshDisassembleSteroid')return;
   if(n==='GetMenuIndex')return run(n,{inDefinition:args[0]}).value;if(n==='SetUnitDisableSelect'){disabled.push({row:args[0],locked:args[1]});return;}throw Error('unexpected '+n);
  });
  run('SetupTopMenu',locals);const base=buy?1:hide?5:6,custom=kind==='all'?2:1;assert.equal(panel.rows.length,base+custom);
  if(!buy){assert.equal(panel.rows[base-1].mIcon,50);assert.equal(run('GetMenuDefinition',{Index:base-1}).value,6);run('RefreshDisassembleSteroidMenu',{TopMenu:true});assert.deepEqual(disabled,[{row:base-1,locked}]);}
  assert.equal(run('GetMenuDefinition',{Index:base}).value,kind==='ammo'?8:7);if(kind==='all')assert.equal(run('GetMenuDefinition',{Index:base+1}).value,8);
  assert.equal(run('GetMenuDefinition',{Index:base+custom}).value,5);
 }
});
