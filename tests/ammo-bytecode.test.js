'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compile,execute}=require('./helpers/bytecode-vm');
const ammoOnly=process.env.LID_TEST_AMMO_ONLY==='1';
const modern=process.env.LID_TEST_UI_BUILD==='26639365',stateBase=modern?23:18,ammoMenu=modern?8:7,decalMenu=modern?7:6;
const plan=modern?require('./helpers/current-ui-plan').plan(ammoOnly?'ammo':'all',process.env.LID_TEST_GAME_LANGUAGE||'ko'):require('../src/game-language').localizePlan(ammoOnly?require('../src/ammo-only-plan'):require('../patches/vending-build25386710.json'),process.env.LID_TEST_GAME_LANGUAGE||'ko');
const sb='BrgUIMenu_ShopBase.',vd='BrgUIMenu_ItemVendingMachine.';
const compiled=new Map(plan.patches.filter(p=>p.name!==vd+'SetupTopMenu').map(p=>[p.name,compile(p,plan.testSymbols)]));
function weapon(id,rest=0,spare=0,buy=50000){return {mEnable:true,mItemType:0,mDbPsPart:{mEptid:id,mPtid:'weapon',mLvl:20,mRest:rest,mSpare:spare,mDur:900},mDbPsPartAutoInfo:{mDbPart:{mCapacity:30,mSpare:270,buy}}};}
const object=extras=>({$object:true,...extras});
function fixture(stock=[weapon('a')],money=10000){
 const native=object({mDeathBag:structuredClone(stock),mEquipPartInfo:Array.from({length:8},()=>({mEnable:false}))});
 native.mEquipPartInfo[2]=structuredClone(stock[0]||{mEnable:false});
 const f=object({$class:'BrgUIMenu_ItemVendingMachine',mTopMenuSelectIndex:ammoMenu,mOtherStateNum:stateBase,mState:stateBase+13,mStateFirst:false,
  mPossessionItems:stock.map(x=>({mItemInfo:structuredClone(x)})),mSellMenuSelectIndex:0,mSelectPrice:10000,mDbUserShopHistorys:[],
  mItemSelect:object({mUnits:[],mItemMiniPanel:object({})}),mShopLimitedItems:object({}),
  mUIManager:object({mPlayerCommonPawnNative:native,mSkillExchange:null,mUserData:object({money,safeMoney:money,carriedMoney:0}),mCommonStatusMenuPart:object({}),mItemInfoManager:object({}),mEdgeInput:0,
    mCommonTopMenu2:object({selected:(ammoOnly?5:6)+(modern?1:0),idle:true,cancel:false}),mGameInfoNative:object({hide:false}),mSystemWindow:object({done:false,cancel:false,yes:0})})});
 f.calls=[];
 f.run=(name,locals={})=>execute(compiled.get(name),f,locals,(n,a,target)=>{
  f.calls.push({n,a});
  if(n==='GetSafeMoney')return target.safeMoney;
  if(n==='SetSafeMoney'){if(target.reject)return false;target.safeMoney=a[0];target.money=a[0];return true;}
  if(n==='AddUnitFromLocalItemInfo'){target.mUnits.push({mInfo:{mBaseInfo:{}},mDrawInfo:{mPrice:0}});return target.mUnits.length-1;}
  if(n==='CreateItemMiniPanelInfo_Part'){a[0].set({mPrice:a[2].buy,mDisableSelect:false});return;}
  if(n==='SetUnitDisableSelectForce'){target.mUnits[a[0]].disabled=a[1];return;}
  if(n==='CheckDisableSelect')return !!target.mUnits[a[0]].disabled;
  if(n==='DeathBag_SearchPart_Eptid')return target.mDeathBag.findIndex(x=>x.mDbPsPart?.mEptid===a[0]);
  if(n==='GetShopState')return a[0]-stateBase;
  if(n==='GetAdjustShopState')return a[0]+stateBase;
  if(n==='StartWaitShopState'){f.mState=stateBase+a[1];f.mStateFirst=true;return;}
  if(n==='StartUpdateResearch'){f.mState=stateBase+15;f.next=a[0];f.mStateFirst=true;return;}
  if(n==='NewObject')return object({$class:'BrgUIMenu_SkillExchange'});
  if(n==='Initialize'||n==='StartSkillExchange')return;
  if(n==='SellItem'){assert.equal(f.run(sb+n).returned,true);return;}
  if(n==='GetSelectIndex')return target===f.mItemSelect?f.mSellMenuSelectIndex:target.selected;
  if(n==='CheckEnd')return target.done;
  if(n==='CheckCancel')return target.cancel;
  if(n==='GetYesNoSelectIndex')return target.yes;
  if(n==='IsHideBloodnium')return target.hide;
  if(n==='CheckInIdle')return target.idle;
  if(n==='GetMenuDefinition')return f.run(vd+n,{Index:a[0]}).value;
  if(n==='SetDisableInput'){target.disabled=a[0];return;}
  if(n==='EndRequest'){target.ended=true;return;}
  if(['UpdateDispResourceNum','SetEnableSelect','AllSetVisibleSelectUnit','SetVisible','SetVisibleRemainTime','SetButtonGuideNormal','UpdateCurrentStockInfo','AddPlaySoundCue','RefreshSellItem'].includes(n))return;
  if(n==='StartSystemMessageSub'){target.done=false;return;}
  throw Error('Unexpected call: '+n);
 });
 f.list=()=>f.run(sb+'AddSellCurrentFighterItemSelectPanel');
 return f;
}
test('compiled insertions have valid runtime size, context skips and branch targets',()=>assert.equal(compiled.size,(ammoOnly?5:10)+(modern?1:0)));
test('normal shop and ordinary selling paths bypass the ammo insertion',()=>{
 for(const cls of ['BrgUIMenu_PartShop','BrgUIMenu_ItemVendingMachine'])for(const name of ['SellItem','TickASync','AddSellCurrentFighterItemSelectPanel']){
  const f=fixture();f.$class=cls;f.mTopMenuSelectIndex=0;assert.equal(f.run(sb+name).returned,false);assert.equal(f.calls.length,0);
 }
});
test('only ammo weapons appear; prices use native purchase quote divided by five',()=>{
 const f=fixture([weapon('a'),{mEnable:true,mItemType:1},weapon('b',0,0,50001),{...weapon('c'),mDbPsPartAutoInfo:{mDbPart:{mCapacity:0,mSpare:0}}}]);
 const before=structuredClone(f.mUIManager.mPlayerCommonPawnNative.mDeathBag);
 assert.equal(f.list().returned,true);assert.equal(f.mPossessionItems.length,2);
 assert.deepEqual(f.mItemSelect.mUnits.map(x=>x.mDrawInfo.mPrice),[10000,10001]);
 assert.deepEqual(f.mItemSelect.mUnits.map(x=>x.disabled),[false,true]);
 assert.deepEqual(f.mUIManager.mPlayerCommonPawnNative.mDeathBag,before);
});
test('full/overfull, broken, negative-ammo and unknown-price weapons cannot be charged',()=>{
 for(const w of [weapon('a',30,270),weapon('a',31,300),weapon('a',0,0,0),weapon('a',-1),{...weapon('a'),mDbPsPart:{...weapon('a').mDbPsPart,mDur:0}}]){
  const f=fixture([w]);f.list();assert.equal(f.mItemSelect.mUnits[0].disabled,true);
  assert.equal(f.run(sb+'SellItem').returned,true);assert.equal(f.mUIManager.mUserData.money,10000);
 }
});
test('confirmed charge fills bag and matching equip, preserves durability/level/other items',()=>{
 const f=fixture([weapon('a'),weapon('b')]);f.list();const p=f.mUIManager.mPlayerCommonPawnNative;
 const before=structuredClone(p.mDeathBag[1]);f.run(sb+'SellItem');
 assert.equal(f.mUIManager.mUserData.money,0);assert.equal(f.mRequestBuySE,true);
 for(const w of [p.mDeathBag[0],p.mEquipPartInfo[2]])assert.deepEqual(w.mDbPsPart,{mEptid:'a',mPtid:'weapon',mLvl:20,mRest:30,mSpare:270,mDur:900});
 assert.deepEqual(p.mDeathBag[1],before);assert.deepEqual(f.mDbUserShopHistorys,[]);
 assert.ok(!f.calls.some(x=>/Delete|OnSellFinished|SetUnitEmpty/.test(x.n)));
});
test('repeat confirmation, stale quotes, vanished items, money loss or failed debit do not double charge',()=>{
 for(const condition of ['repeat','price','missing','money','reject','index']){
  const f=fixture();f.list();const ud=f.mUIManager.mUserData;
  if(condition==='repeat')f.run(sb+'SellItem');
  if(condition==='price')f.mSelectPrice++;
  if(condition==='missing')f.mUIManager.mPlayerCommonPawnNative.mDeathBag=[];
  if(condition==='money')ud.money=ud.safeMoney=9999;
  if(condition==='reject')ud.reject=true;
  if(condition==='index')f.mSellMenuSelectIndex=-1;
  const before=ud.money;assert.equal(f.run(sb+'SellItem').returned,true);assert.equal(ud.money,before);
 }
});
test('actual confirmation script cancels without charging; saves once on acceptance',()=>{
 for(const cancel of ['back','no','yes']){
  const f=fixture();f.list();f.mState=stateBase+14;const dialog=f.mUIManager.mSystemWindow;dialog.done=true;dialog.cancel=cancel==='back';dialog.yes=cancel==='no'?1:0;
  assert.equal(f.run(sb+'TickASync').returned,true);
  assert.equal(f.mUIManager.mUserData.money,cancel==='yes'?0:10000);
  assert.equal(f.mState,cancel==='yes'?stateBase+15:stateBase+13);
  if(cancel==='yes'){
   assert.equal(f.next,stateBase+12);assert.equal(f.run(sb+'TickASync').returned,false);
   f.mState=stateBase+16;assert.equal(f.run(sb+'TickASync').returned,false);
   assert.equal(f.calls.filter(c=>c.n==='SetSafeMoney').length,1);
  }
 }
});
test('ammo selection disables top input and enters existing save/list path, menu IDs include exit',()=>{
 const f=fixture();f.mState=8;f.mTopMenuSelectIndex=0;
 assert.equal(f.run(vd+'TickASync').returned,true);assert.equal(f.mTopMenuSelectIndex,ammoMenu);assert.equal(f.mState,stateBase+15);assert.equal(f.next,stateBase+12);
 assert.equal(f.mUIManager.mCommonTopMenu2.disabled,true);assert.equal(f.mUIManager.mCommonTopMenu2.ended,true);
 for(const buy of [true,false])for(const hide of [true,false]){
  f.mBuyOnly=buy;f.mUIManager.mGameInfoNative.hide=hide;const last=buy?1:(hide?4:5)+(modern?1:0);
  for(const [offset,value] of (ammoOnly?[[0,ammoMenu],[1,5]]:[[0,decalMenu],[1,ammoMenu],[2,5]]))assert.equal(f.run(vd+'GetMenuDefinition',{Index:last+offset}).value,value);
 }
});
test('cancel and sort inputs never enter the destructive sale-sort path',()=>{
 for(const input of [32,64,32|16]){
  const f=fixture();f.list();f.mUIManager.mEdgeInput=input;
  assert.equal(f.run(sb+'TickASync').returned,true);
  assert.equal(f.mUIManager.mUserData.money,10000);
  assert.ok(!f.calls.some(x=>/SellItem|SortSellItems|Delete/.test(x.n)));
 }
});
test('waiting-room regression: bank has money while fighter carries zero',()=>{
 const f=fixture([weapon('a',60,1053,224515)],1390301);
 const w=f.mPossessionItems[0].mItemInfo;
 w.mDbPsPartAutoInfo.mDbPart={mCapacity:120,mSpare:5100,buy:224515};
 f.mUIManager.mPlayerCommonPawnNative.mDeathBag[0]=structuredClone(w);
 f.mUIManager.mPlayerCommonPawnNative.mEquipPartInfo[2]=structuredClone(w);
 f.list();assert.equal(f.mItemSelect.mUnits[0].disabled,false);
 f.mSelectPrice=44903;f.run(sb+'SellItem');
 assert.equal(f.mUIManager.mUserData.safeMoney,1345398);
 assert.equal(f.mUIManager.mUserData.carriedMoney,0);
 assert.equal(f.mUIManager.mPlayerCommonPawnNative.mDeathBag[0].mDbPsPart.mRest,120);
 assert.equal(f.mUIManager.mPlayerCommonPawnNative.mDeathBag[0].mDbPsPart.mSpare,5100);
 assert.ok(!f.calls.some(c=>c.n==='GetMoney'||c.n==='SetMoney'));
});
test('carried coins do not substitute for an insufficient safe balance',()=>{
 const f=fixture([weapon('a')],0);f.mUIManager.mUserData.carriedMoney=100000;
 f.list();assert.equal(f.mItemSelect.mUnits[0].disabled,true);
 f.run(sb+'SellItem');assert.equal(f.mUIManager.mUserData.safeMoney,0);
 assert.equal(f.mUIManager.mUserData.carriedMoney,100000);
});
test('5.0.6 appends custom entries after the vanilla Deathroid entry without altering it',{skip:!modern},()=>{
 const setup=compile(plan.patches.find(p=>p.name===vd+'SetupTopMenu'),plan.testSymbols),base=Array.from({length:6},(_,i)=>({mIcon:i===5?50:i,mName:i===5?'VENDER.TXT_DS_DISASSEMBLE':'vanilla-'+i})),locals={lUnitArray:structuredClone(base)};
 execute(setup,fixture(),locals,()=>{throw Error('setup insertion made unexpected native call');});
 assert.deepEqual(locals.lUnitArray.slice(0,6),base);assert.equal(locals.lUnitArray.length,ammoOnly?7:8);
 assert.equal(locals.lUnitArray.at(-1).mIcon,7);
 const english=(process.env.LID_TEST_GAME_LANGUAGE||'ko')==='en';
 assert.equal(locals.lUnitArray.at(-1).mName.trim(),english?'Ammo (20% cost)':'탄약 충전 (구입가 20%)');
 if(!ammoOnly){assert.equal(locals.lUnitArray[6].mIcon,11);assert.equal(locals.lUnitArray[6].mName.trim(),english?'Decals':'데칼 교체 / 탈착');}
});
test('5.0.6 vanilla disassembly states 16..22 fall through every custom UI prefix',{skip:!modern},()=>{
 for(let state=16;state<=22;state++){
  const f=fixture();f.mState=state;f.mTopMenuSelectIndex=0;
  for(const name of ['TickASync',...(!ammoOnly?['Tick','Render']:[])])assert.equal(f.run(vd+name).returned,false,name+' state '+state);
  assert.equal(f.mState,state);assert.equal(f.calls.length,0);assert.equal(f.mUIManager.mUserData.money,10000);
 }
});
test('5.0.6 vanilla Deathroid menu row is not captured by custom menu handlers',{skip:!modern},()=>{
 const f=fixture();f.mBuyOnly=false;f.mUIManager.mGameInfoNative.hide=false;f.mState=8;f.mTopMenuSelectIndex=0;f.mUIManager.mCommonTopMenu2.selected=5;
 assert.equal(f.run(vd+'GetMenuDefinition',{Index:5}).returned,false);
 assert.equal(f.run(vd+'TickASync').returned,false);assert.equal(f.mTopMenuSelectIndex,0);assert.equal(f.mState,8);assert(!f.calls.some(c=>c.n==='SetSafeMoney'||c.n==='StartUpdateResearch'||c.n==='NewObject'));
});
test('5.0.6 decal modal uses state 23 and closes back to normal state 7',{skip:!modern||ammoOnly},()=>{
 const f=fixture();f.mState=8;f.mTopMenuSelectIndex=0;f.mUIManager.mCommonTopMenu2.selected=6;
 assert.equal(f.run(vd+'TickASync').returned,true);assert.equal(f.mState,23);assert.equal(f.mUIManager.mSkillExchange.$class,'BrgUIMenu_SkillExchange');assert.equal(f.mUIManager.mSkillExchange.mTopMenu,250);
 assert.equal(f.run(vd+'Tick').returned,true);assert.equal(f.run(vd+'Render').returned,true);
 f.mUIManager.mSkillExchange=null;assert.equal(f.run(vd+'TickASync').returned,true);assert.equal(f.mState,7);assert.equal(f.mStateFirst,true);assert.equal(f.mTopMenuSelectIndex,0);assert.equal(f.mUIManager.mUserData.money,10000);
 assert.equal(f.run(vd+'TickASync').returned,false);
});
