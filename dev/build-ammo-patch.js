'use strict';
// Developer-only compiler. Reuses existing UI fields/locals; does not add class
// layouts or replace the native purchase-price/save implementation.
const fs=require('node:fs'),path=require('node:path');
const A=require('./build-decal-patch');
const {root,raw,u32,seq,b,ref,iv,lv,bool,val,byte,truth,falsity,none,call,native,eq,not,assign,setbool,ret,when,ctx,ui,field,owned,top,state,vd,patches,insert,add,icon,nameLvalue,decalTick}=A;
const sb='BrgUIMenu_ShopBase.',is='BrgUIMenuPart_ItemSelect.';
const local='BrgGameBase.BrgGameDefine.BrgLocalItemInfo';
const ps='BrgGameBase.BrgNetworkDeclStruct.BrgDbPsPart';
const part='BrgGameBase.BrgNetworkDeclStruct.BrgDbPart';
const auto='BrgGameBase.BrgGameDefine.BrgDbPsPart_AutoSetupInfo';
const pos='BrgCommonPawn_CustomCharaNative.BrgPossessionItemInfo';
const unitType=is+'BrgUIMenu_ItemSelect_Unit';
const infoType=is+'BrgUIMenu_ItemSelect_Info';
const drawType='BrgUIMenuPart_ItemMiniPanel.BrgUIMenu_ItemMiniPanel_Info';
const final=(n,...args)=>seq(ref(0x1c,n),...args,b(0x16));
const asInt=e=>seq(b(0x38,0x3a),e);
const len=e=>seq(b(0x36),e);
const ar=(arr,index,stat=false)=>seq(b(stat?0x1a:0x10),index,arr);
const member=(source,type,name,write=false)=>seq(ref(0x35,type+'.'+name),raw(u32(A.obj(type)),8),b(0,write?1:0),source);
const flag=e=>seq(b(0x2d),e);
const setFlag=(e,v)=>seq(b(0x14),flag(e),v);
const gt=(x,y)=>native(0x97,x,y),lt=(x,y)=>native(0x96,x,y),ge=(x,y)=>native(0x99,x,y);
const plus=(x,y)=>native(0x92,x,y),minus=(x,y)=>native(0x93,x,y);
const str=t=>raw(Buffer.concat([Buffer.from([0x34]),Buffer.from(t+'\0','utf16le')]));
const div5=price=>plus(native(0x91,minus(price,val(1)),val(5)),val(1));
function loop(condition,...body){const back=b(6,0,0);back.j.push({at:1,to:0});const prefix=seq(b(7,0,0),condition,...body);const out=seq(prefix,back);out.j[out.j.length-1].to=0;out.j.push({at:1,to:out.m});return out;}
const cast=seq(ref(0x2e,'BrgUIMenu_ItemVendingMachine'),b(0x17));
const ammo=(...body)=>when(native(0x77,cast,none),when(eq(asInt(field(cast,vd+'mTopMenuSelectIndex')),7),...body));
const items=iv(sb+'mItemSelect'),itemCall=(n,...a)=>ctx(items,call(n,...a));
const pawn=field(ui,'BrgUIManager.mPlayerCommonPawnNative');
const user=field(ui,'BrgUIManager.mUserData');
// The vending UI displays the safe balance, not the active fighter's carried
// wallet. A fighter in the waiting room normally has GetMoney(-1) == 0.
const money=()=>ctx(user,call('GetSafeMoney'));
const possessions=iv(sb+'mPossessionItems');
const possession=i=>member(ar(possessions,i),pos,'mItemInfo');
const dbPart=x=>member(member(x,local,'mDbPsPartAutoInfo'),auto,'mDbPart');
const psPart=x=>member(x,local,'mDbPsPart');
const capacity=x=>member(dbPart(x),part,'mCapacity');
const maxSpare=x=>member(dbPart(x),part,'mSpare');
const rest=x=>member(psPart(x),ps,'mRest');
const spare=x=>member(psPart(x),ps,'mSpare');
const enabled=x=>flag(member(x,local,'mEnable'));
const units=field(items,is+'mUnits');
const draw=(i,w=false)=>member(ar(units,i),unitType,'mDrawInfo',w);
const price=(i,w=false)=>member(draw(i,w),drawType,'mPrice',w);
const mini=field(items,is+'mItemMiniPanel');
const buyQuote=(i,x)=>ctx(mini,final('BrgUIMenuPart_ItemMiniPanel.CreateItemMiniPanelInfo_Part',
  draw(i,true),member(member(ar(units,i),unitType,'mInfo',true),infoType,'mBaseInfo',true),dbPart(x),psPart(x),byte(1),falsity));
const toShop=n=>final(sb+'StartWaitShopState',raw(Buffer.from([0x1e,0,0,0,0])),byte(n));
const saveToList=()=>call('StartUpdateResearch',final(sb+'GetAdjustShopState',byte(12)));
const hideList=()=>seq(itemCall('SetEnableSelect',falsity),itemCall('AllSetVisibleSelectUnit',falsity),owned('mItemInfoManager',call('SetVisible',falsity)));
const returnTop=()=>seq(hideList(),assign(ctx(cast,iv(vd+'mTopMenuSelectIndex'),vd+'mTopMenuSelectIndex'),byte(0)),assign(state,val(7)),setbool('BrgUIMenu_Base.mStateFirst',truth),ret);

// Replace the three shared insertions with a combined decal + ammunition menu.
for(const name of ['SetupTopMenu','GetMenuDefinition','TickASync']){
  const index=patches.findIndex(p=>p.name===vd+name);patches.splice(index,1);
}
insert(vd+'SetupTopMenu',0x3a6,seq(raw(icon,add.m),assign(nameLvalue,str('데칼 교체 / 탈착')),
  raw(add.b,add.m),assign(nameLvalue,str('탄약 충전 (구입가 20%)'))));
const menuIndex=lv(vd+'GetMenuDefinition.Index');
const answers=last=>seq(...[[last,6],[last+1,7],[last+2,5]].map(([i,n])=>when(eq(menuIndex,i),seq(b(4),byte(n)))));
insert(vd+'GetMenuDefinition',0,seq(when(bool(vd+'mBuyOnly'),answers(1)),when(not(bool(vd+'mBuyOnly')),
  when(owned('mGameInfoNative',call('IsHideBloodnium')),answers(4)),when(not(owned('mGameInfoNative',call('IsHideBloodnium'))),answers(5)))));
const openAmmo=seq(assign(iv(vd+'mTopMenuSelectIndex'),byte(7)),top('SetDisableInput',truth,truth),top('EndRequest'),
  ctx(iv(vd+'mShopLimitedItems'),call('SetVisibleRemainTime',falsity)),setbool(sb+'mIsCoinLockerSell',falsity),
  setbool(sb+'mRequestBuySE',falsity),setbool(sb+'mRequestSellSE',falsity),assign(iv(sb+'mValidDeathBagSellItemCount'),val(-1)),
  // Flush any outstanding normal purchase history before entering refill mode.
  saveToList(),ret);
const ammoGate=when(eq(state,8),when(not(bool('BrgUIMenu_Base.mStateFirst')),when(top('CheckInIdle'),when(not(top('CheckCancel')),
  when(eq(asInt(call('GetMenuDefinition',top('GetSelectIndex'))),7),openAmmo)))));
insert(vd+'TickASync',0,seq(ammoGate,decalTick));

// Filter only the temporary possession list, never the real deathbag.
const listFn=sb+'AddSellCurrentFighterItemSelectPanel';
const I=lv(listFn+'.I'),U=lv(listFn+'.lUnitIndex'),eligible=lv(listFn+'.lIsVip');
const x=possession(I);
insert(listFn,0,ammo(
  assign(I,minus(len(possessions),val(1))),
  loop(ge(I,val(0)),setFlag(eligible,falsity),
    when(enabled(x),when(eq(asInt(member(x,local,'mItemType')),0),when(gt(capacity(x),val(0)),when(ge(maxSpare(x),val(0)),setFlag(eligible,truth))))),
    when(not(flag(eligible)),seq(b(0x40),possessions,I,val(1),b(0x16))),assign(I,minus(I,val(1)))),
  assign(I,val(0)),loop(lt(I,len(possessions)),
    assign(U,itemCall('AddUnitFromLocalItemInfo',x,byte(0),falsity,val(-1))),
    when(ge(U,val(0)),when(lt(U,len(units)),
      itemCall('SetUnitDisableSelectForce',U,truth),
      when(native(0x77,mini,none),buyQuote(U,x),itemCall('SetUnitDisableSelectForce',U,truth),
        when(gt(price(U),val(0)),assign(price(U,true),div5(price(U))),
          assign(member(draw(U,true),drawType,'mPriceOrg',true),price(U)),
          assign(member(draw(U,true),drawType,'mPriceType',true),byte(1)),
          setFlag(member(ar(units,U),unitType,'mUseNewInfo',true),truth),
          when(ge(money(),price(U)),when(ge(rest(x),val(0)),when(ge(spare(x),val(0)),when(gt(member(psPart(x),ps,'mDur'),val(0)),
            when(lt(rest(x),capacity(x)),itemCall('SetUnitDisableSelectForce',U,falsity)),
            when(lt(spare(x),maxSpare(x)),itemCall('SetUnitDisableSelectForce',U,falsity)))))))))),
    assign(I,plus(I,val(1)))),ret));

// Revalidate the selected instance immediately before charging. All exits in
// refill mode return BEFORE the original destructive sale implementation.
const sellFn=sb+'SellItem',L=lv(sellFn+'.lLocalItemInfo'),D=lv(sellFn+'.lDeathBagIndex');
const selected=iv(sb+'mSellMenuSelectIndex'),charge=iv(sb+'mSelectPrice');
const bag=field(pawn,'BrgCommonPawn_CustomCharaNative.mDeathBag');
const equip=field(pawn,'BrgCommonPawn_CustomCharaNative.mEquipPartInfo');
const id=x=>member(psPart(x),ps,'mEptid');
const fill=(target)=>seq(
  when(lt(rest(target),capacity(L)),assign(member(member(target,local,'mDbPsPart',true),ps,'mRest',true),capacity(L))),
  when(lt(spare(target),maxSpare(L)),assign(member(member(target,local,'mDbPsPart',true),ps,'mSpare',true),maxSpare(L))));
insert(sellFn,0,ammo(setbool(sb+'mRequestBuySE',falsity),
  when(lt(selected,val(0)),ret),when(ge(selected,len(possessions)),ret),when(ge(selected,len(units)),ret),
  when(itemCall('CheckDisableSelect',selected),ret),
  when(not(native(0x9a,charge,price(selected))),ret),when(not(gt(charge,val(0))),ret),when(lt(money(),charge),ret),
  assign(L,possession(selected)),assign(D,ctx(pawn,call('DeathBag_SearchPart_Eptid',id(L),val(-1)))),
  when(lt(D,val(0)),ret),when(ge(D,len(bag)),ret),assign(L,ar(bag,D)),
  when(not(enabled(L)),ret),when(not(eq(asInt(member(L,local,'mItemType')),0)),ret),
  when(not(gt(capacity(L),val(0))),ret),when(lt(maxSpare(L),val(0)),ret),
  when(lt(rest(L),val(0)),ret),when(lt(spare(L),val(0)),ret),when(not(gt(member(psPart(L),ps,'mDur'),val(0))),ret),
  when(ge(rest(L),capacity(L)),when(ge(spare(L),maxSpare(L)),ret)),
  when(not(ctx(user,call('SetSafeMoney',minus(money(),charge)))),ret),
  fill(ar(bag,D)),assign(D,val(0)),loop(lt(D,val(8)),
    when(enabled(ar(equip,D,true)),when(native(0x7a,id(ar(equip,D,true)),id(L)),fill(ar(equip,D,true)))),assign(D,plus(D,val(1)))),
  setbool(sb+'mRequestBuySE',truth),owned('mCommonStatusMenuPart',call('UpdateDispResourceNum')),ret));

// After CheckStop, before the original switch: do not perform actions twice
// while StartWait transitions are pending. Keep native save/retry states intact.
const shopState=asInt(final(sb+'GetShopState',state));
const system=(n,...a)=>owned('mSystemWindow',call(n,...a));
const confirmText=str('표시된 킬코인을 사용해 이 무기의 탄약을 완충할까요?\n비용: 해당 무기 구입가의 20% (내구도는 회복하지 않음)');
const cancel=()=>seq(toShop(13),ret);
insert(sb+'TickASync',121,ammo(
  when(eq(shopState,10),returnTop()),
  when(eq(shopState,12),when(bool('BrgUIMenu_Base.mStateFirst'),assign(iv(sb+'mValidDeathBagSellItemCount'),val(-1)),final(sb+'RefreshSellItem'))),
  when(eq(shopState,13),when(eq(len(possessions),0),returnTop()),
    when(bool('BrgUIMenu_Base.mStateFirst'),setbool('BrgUIMenu_Base.mStateFirst',falsity),call('SetButtonGuideNormal'),
      itemCall('AllSetVisibleSelectUnit',truth),itemCall('SetEnableSelect',truth),call('UpdateCurrentStockInfo')),
    when(not(eq(native(0x9c,field(ui,'BrgGameBase.BrgUIManagerBase.mEdgeInput'),val(32)),0)),hideList(),toShop(10),ret),
    // The original sell-sort routine uses sale flags; do not invoke it with our
    // filtered list. View ordering from the standard list setup is preserved.
    when(not(eq(native(0x9c,field(ui,'BrgGameBase.BrgUIManagerBase.mEdgeInput'),val(64)),0)),ret),
    // Capture the custom quote directly, instead of the original sale price.
    when(not(eq(native(0x9c,field(ui,'BrgGameBase.BrgUIManagerBase.mEdgeInput'),val(16)),0)),
      when(not(eq(native(0x9c,field(ui,'BrgGameBase.BrgUIManagerBase.mEdgeInput'),val(32)),0)),ret),
      assign(selected,itemCall('GetSelectIndex')),when(lt(selected,val(0)),ret),when(ge(selected,len(units)),ret),
      when(itemCall('CheckDisableSelect',selected),ctx(ui,call('AddPlaySoundCue',iv(sb+'mNGSC'))),ret),
      assign(charge,price(selected)),itemCall('SetEnableSelect',falsity),toShop(14),ret)),
  when(eq(shopState,14),when(bool('BrgUIMenu_Base.mStateFirst'),setbool('BrgUIMenu_Base.mStateFirst',falsity),call('SetButtonGuideNormal'),
    system('StartSystemMessageSub',byte(1),confirmText,truth,falsity,iv(sb+'mOKSC'),iv(sb+'mCancelSC'),iv(sb+'mSelectSC'),b(0x4a),b(0x4a),b(0x4a),truth)),
    when(system('CheckEnd'),when(system('CheckCancel'),cancel()),when(eq(system('GetYesNoSelectIndex'),1),cancel()),
      final(sellFn),when(bool(sb+'mRequestBuySE'),saveToList(),ret),toShop(12)),ret)));

const plan={build:25386710,exportCount:173671,features:['materials','decals','ammo'],patches,
  testSymbols:{objects:A.referencedObjects,names:A.referencedNames}};
if(require.main===module){fs.writeFileSync(path.join(root,'patches/vending-build25386710.json'),JSON.stringify(plan,null,2)+'\n');console.log(patches.map(p=>({name:p.name,memory:p.extraMemory})));}
module.exports={plan};
