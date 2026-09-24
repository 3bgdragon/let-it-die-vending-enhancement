'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compile,execute}=require('./helpers/bytecode-vm');
const plan=require('../patches/vending-build25386710.json');
const sb='BrgUIMenu_ShopBase.',vd='BrgUIMenu_ItemVendingMachine.';
const compiled=new Map(plan.patches.filter(p=>p.name!==vd+'SetupTopMenu').map(p=>[p.name,compile(p,plan.testSymbols)]));
function weapon(id,rest=0,spare=0,buy=50000){return {mEnable:true,mItemType:0,mDbPsPart:{mEptid:id,mPtid:'weapon',mLvl:20,mRest:rest,mSpare:spare,mDur:900},mDbPsPartAutoInfo:{mDbPart:{mCapacity:30,mSpare:270,buy}}};}
const object=extras=>({$object:true,...extras});
function fixture(stock=[weapon('a')],money=10000){
 const native=object({mDeathBag:structuredClone(stock),mEquipPartInfo:Array.from({length:8},()=>({mEnable:false}))});
 native.mEquipPartInfo[2]=structuredClone(stock[0]||{mEnable:false});
 const f=object({$class:'BrgUIMenu_ItemVendingMachine',mTopMenuSelectIndex:7,mOtherStateNum:18,mState:31,mStateFirst:false,
  mPossessionItems:stock.map(x=>({mItemInfo:structuredClone(x)})),mSellMenuSelectIndex:0,mSelectPrice:10000,mDbUserShopHistorys:[],
  mItemSelect:object({mUnits:[],mItemMiniPanel:object({})}),mShopLimitedItems:object({}),
  mUIManager:object({mPlayerCommonPawnNative:native,mUserData:object({money}),mCommonStatusMenuPart:object({}),mItemInfoManager:object({}),mEdgeInput:0,
    mCommonTopMenu2:object({selected:6,idle:true,cancel:false}),mGameInfoNative:object({hide:false}),mSystemWindow:object({done:false,cancel:false,yes:0})})});
 f.calls=[];
 f.run=(name,locals={})=>execute(compiled.get(name),f,locals,(n,a,target)=>{
  f.calls.push({n,a});
  if(n==='GetMoney')return target.money;
  if(n==='SetMoney'){if(target.reject)return false;target.money=a[0];return true;}
  if(n==='AddUnitFromLocalItemInfo'){target.mUnits.push({mInfo:{mBaseInfo:{}},mDrawInfo:{mPrice:0}});return target.mUnits.length-1;}
  if(n==='CreateItemMiniPanelInfo_Part'){a[0].set({mPrice:a[2].buy,mDisableSelect:false});return;}
  if(n==='SetUnitDisableSelectForce'){target.mUnits[a[0]].disabled=a[1];return;}
  if(n==='CheckDisableSelect')return !!target.mUnits[a[0]].disabled;
  if(n==='DeathBag_SearchPart_Eptid')return target.mDeathBag.findIndex(x=>x.mDbPsPart?.mEptid===a[0]);
  if(n==='GetShopState')return a[0]-18;
  if(n==='GetAdjustShopState')return a[0]+18;
  if(n==='StartWaitShopState'){f.mState=18+a[1];f.mStateFirst=true;return;}
  if(n==='StartUpdateResearch'){f.mState=33;f.next=a[0];f.mStateFirst=true;return;}
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
test('compiled insertions have valid runtime size, context skips and branch targets',()=>assert.equal(compiled.size,10));
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
  if(condition==='money')ud.money=9999;
  if(condition==='reject')ud.reject=true;
  if(condition==='index')f.mSellMenuSelectIndex=-1;
  const before=ud.money;assert.equal(f.run(sb+'SellItem').returned,true);assert.equal(ud.money,before);
 }
});
test('actual confirmation script cancels without charging; saves once on acceptance',()=>{
 for(const cancel of ['back','no','yes']){
  const f=fixture();f.list();f.mState=32;const dialog=f.mUIManager.mSystemWindow;dialog.done=true;dialog.cancel=cancel==='back';dialog.yes=cancel==='no'?1:0;
  assert.equal(f.run(sb+'TickASync').returned,true);
  assert.equal(f.mUIManager.mUserData.money,cancel==='yes'?0:10000);
  assert.equal(f.mState,cancel==='yes'?33:31);
  if(cancel==='yes'){
   assert.equal(f.next,30);assert.equal(f.run(sb+'TickASync').returned,false);
   f.mState=34;assert.equal(f.run(sb+'TickASync').returned,false);
   assert.equal(f.calls.filter(c=>c.n==='SetMoney').length,1);
  }
 }
});
test('ammo selection disables top input and enters existing save/list path, menu IDs include exit',()=>{
 const f=fixture();f.mState=8;f.mTopMenuSelectIndex=0;
 assert.equal(f.run(vd+'TickASync').returned,true);assert.equal(f.mTopMenuSelectIndex,7);assert.equal(f.mState,33);assert.equal(f.next,30);
 assert.equal(f.mUIManager.mCommonTopMenu2.disabled,true);assert.equal(f.mUIManager.mCommonTopMenu2.ended,true);
 for(const buy of [true,false])for(const hide of [true,false]){
  f.mBuyOnly=buy;f.mUIManager.mGameInfoNative.hide=hide;const last=buy?1:hide?4:5;
  for(const [offset,value] of [[0,6],[1,7],[2,5]])assert.equal(f.run(vd+'GetMenuDefinition',{Index:last+offset}).value,value);
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
