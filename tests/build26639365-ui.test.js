'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {compile,execute}=require('./helpers/bytecode-vm'),current=require('./helpers/current-ui-plan'),vd='BrgUIMenu_ItemVendingMachine.';
for(const language of ['ko','en'])for(const ammoOnly of [false,true])test('26639365 actual '+language+' '+(ammoOnly?'ammo-only':'full')+' payment/navigation scripts',()=>{
 const env={...process.env,LID_TEST_UI_BUILD:'26639365',LID_TEST_GAME_LANGUAGE:language,LID_TEST_AMMO_ONLY:ammoOnly?'1':'0'};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(__dirname,'ammo-bytecode.test.js')],{encoding:'utf8',env});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);assert.match(result.stdout,/# fail 0/);assert.match(result.stdout,ammoOnly?/# pass 14/:/# pass 15/);
});
for(const language of ['ko','en'])test('26639365 '+language+' decals-only leaves Deathroid states and normal state 7 intact',()=>{
 const plan=current.plan('decals',language),programs=new Map(plan.patches.map(p=>[p.name,compile(p,plan.testSymbols)])),calls=[],f={$object:true,mState:8,mStateFirst:false,mTopMenuSelectIndex:0,mBuyOnly:false,mUIManager:{$object:true,mSkillExchange:null,mCommonTopMenu2:{$object:true,selected:6,idle:true,cancel:false},mCommonStatusMenuPart:{$object:true},mGameInfoNative:{$object:true,hide:false}},mShopLimitedItems:{$object:true}};
 const run=(name,locals={})=>execute(programs.get(vd+name),f,locals,(n,a,target)=>{
  calls.push(n);if(n==='GetSelectIndex')return target.selected;if(n==='IsHideBloodnium')return target.hide;if(n==='CheckInIdle')return target.idle;if(n==='CheckCancel')return target.cancel;if(n==='GetMenuDefinition')return run('GetMenuDefinition',{Index:a[0]}).value;
  if(n==='NewObject')return {$object:true,$class:'BrgUIMenu_SkillExchange'};if(['Initialize','StartSkillExchange','SetDisableInput','EndRequest','SetVisible','SetVisibleRemainTime'].includes(n))return;throw Error('unexpected decal-only call '+n);
 });
 for(const buy of [true,false])for(const hide of [true,false]){f.mBuyOnly=buy;f.mUIManager.mGameInfoNative.hide=hide;const first=buy?1:hide?5:6;assert.equal(run('GetMenuDefinition',{Index:first}).value,7);assert.equal(run('GetMenuDefinition',{Index:first+1}).value,5);}
 f.mBuyOnly=false;f.mUIManager.mGameInfoNative.hide=false;
 for(let state=16;state<=22;state++){f.mState=state;for(const name of ['TickASync','Tick','Render'])assert.equal(run(name).returned,false);assert.equal(f.mState,state);}
 f.mState=8;f.mUIManager.mCommonTopMenu2.selected=5;assert.equal(run('GetMenuDefinition',{Index:5}).returned,false);assert.equal(run('TickASync').returned,false);
 f.mUIManager.mCommonTopMenu2.selected=6;f.mUIManager.mCommonTopMenu2.cancel=true;assert.equal(run('TickASync').returned,false);assert.equal(f.mUIManager.mSkillExchange,null);f.mUIManager.mCommonTopMenu2.cancel=false;
 assert.equal(run('TickASync').returned,true);assert.equal(f.mState,23);assert.equal(f.mUIManager.mSkillExchange.mTopMenu,250);assert.equal(run('Tick').returned,true);assert.equal(run('Render').returned,true);
 f.mUIManager.mSkillExchange=null;assert.equal(run('TickASync').returned,true);assert.equal(f.mState,7);assert.equal(f.mStateFirst,true);assert.equal(f.mTopMenuSelectIndex,0);
 const base=Array.from({length:6},(_,i)=>({mName:i===5?'Deathroid':'vanilla-'+i,mIcon:i===5?50:i})),locals={lUnitArray:structuredClone(base)};run('SetupTopMenu',locals);assert.deepEqual(locals.lUnitArray.slice(0,6),base);assert.equal(locals.lUnitArray.length,7);assert.equal(locals.lUnitArray[6].mName.trim(),language==='ko'?'데칼 교체 / 탈착':'Decals');assert(!calls.some(n=>/Money|SellItem|UpdateResearch/.test(n)));
});
