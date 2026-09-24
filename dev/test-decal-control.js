'use strict';
// Executes emitted bridge bytecode with mocked engine objects. This is NOT a
// replacement for a live-game decal mutation/save/reload test.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {plan}=require('../src/decal-package'),symbols=require('../.work/package-symbols.json');
const objects=new Map(Object.entries(symbols.objects).map(([n,i])=>[i,n]));
const short=i=>objects.get(i).split('.').at(-1),calls=[];
const vd='BrgUIMenu_ItemVendingMachine.',sd='BrgUIMenu_SkillExchange.';
function run(functionName,self,locals={}){
 const p=plan.patches.find(p=>p.name===functionName),code=Buffer.from(p.insert,'hex');
 const tokens=JSON.parse(fs.readFileSync('.work/patched-decompiled/'+p.export+'.tokens.json'));
 assert.equal(tokens.at(-1).pos+tokens.at(-1).size,p.scriptMemory+p.extraMemory,functionName+' serialization size');
 const bounds=new Map(tokens.map(t=>[t.pos,t.disk]));
 for(const t of tokens)if(t.jump!==null&&t.jump!==65535)assert.ok(bounds.has(t.jump),functionName+' invalid jump');
 let pc=0;const read=n=>{const start=pc;pc+=n;assert.ok(pc<=code.length);return code.subarray(start,pc);};
 const u32=()=>read(4).readInt32LE(),u16=()=>read(2).readUInt16LE();
 function expr(context=self,address=false){
  const op=read(1)[0];
  if(op===0||op===1){const key=short(u32()),o=op===0?locals:context;assert.ok(o,'null property '+key);return address?{get:()=>o[key],set:v=>o[key]=v}:o[key];}
  if(op===0x2d)return expr(context,address);
  if(op===0x19){const target=expr(context);const skip=u16();u32();read(1);assert.ok(target,'unexpected null context');const before=pc,result=expr(target,address);assert.ok(pc>before&&skip>0);return result;}
  if(op===0x1d)return u32();
  if(op===0x1e)return read(4).readFloatLE();
  if(op===0x24||op===0x2c)return read(1)[0];
  if(op===0x27)return true;if(op===0x28)return false;if(op===0x2a)return null;if(op===0x0b)return undefined;
  if(op===0x38){assert.equal(read(1)[0],0x3a);return Number(expr(context));}
  if(op===0x36){const arr=expr(context);return address?{get:()=>arr.length,set:v=>arr.length=v}:arr.length;}
  if(op===0x0f||op===0x14){const ref=expr(context,true),value=expr(context);ref.set(value);return value;}
  if(op===0x20)return objects.get(u32());
  if(op===0x11){const outer=expr(context);expr(context);expr(context);const cls=expr(context);expr(context);assert.equal(cls,'BrgUIMenu_SkillExchange');return {mUIManager:outer,mTopMenu:0,mEnd:true,mNetShopHistoryArray:[],mNetPutHistoryArray:[],mSkillPut:{}};}
  if(op===0x17)return self;
  if([0x1b,0x1c,0x9a,0x81,0x72].includes(op)){
   let name;if(op===0x1b){name=symbols.names[u32()];assert.equal(u32(),0);}if(op===0x1c)name=short(u32());
   const args=[];while(code[pc]!==0x16)args.push(expr(context));read(1);
   if(op===0x9a)return args[0]===args[1];if(op===0x81)return !args[0];if(op===0x72)return args[0]===args[1];
   if(name==='GetMenuDefinition'){
    const result=run(vd+name,self,{Index:args[0]});
    if(result.returned)return result.value;
    return self.mBuyOnly?(args[0]===0?0:5):(self.mUIManager.mGameInfoNative.hide?[0,2,3,4,5][args[0]]:args[0]);
   }
   calls.push({name,args,context});
   if(name==='IsHideBloodnium')return context.hide;
   if(name==='CheckInIdle')return context.idle;
   if(name==='CheckCancel')return context.cancel;
   if(name==='GetSelectIndex')return context.selected;
   if(name==='StartSkillExchange'){const result=run(sd+name,context);assert.ok(result.returned);}
   if(name==='StartWait'){context.mState=args[1];context.mStateFirst=true;}
   if(name==='Terminate')context.terminated=true;
   if(name==='SetDisableInput')context.disabled=args[0];
   if(name==='EndRequest')context.ended=true;
   return undefined;
  }
  throw new Error('Unhandled bridge token '+op.toString(16)+' at '+(pc-1));
 }
 let steps=0;
 while(pc<code.length){assert.ok(++steps<500);const op=code[pc];
  if(op===7){pc++;const dest=u16(),condition=expr();if(!condition){assert.ok(bounds.has(dest));pc=bounds.get(dest)-p.at;}}
  else if(op===4){pc++;return {returned:true,value:expr()};}
  else expr();
 }
 assert.equal(pc,code.length);return {returned:false};
}
function fixture(buyOnly=false,hide=false){return {mState:8,mStateFirst:false,mBuyOnly:buyOnly,mShopLimitedItems:{},mUIManager:{mSkillExchange:null,mGameInfoNative:{hide},mCommonTopMenu2:{idle:true,cancel:false,selected:hide?4:5},mCommonStatusMenuPart:{}}};}
let count=0;
for(const buy of [false,true])for(const hide of [false,true]){
 const f=fixture(buy,hide),last=buy?1:hide?4:5;
 assert.deepEqual(run(vd+'GetMenuDefinition',f,{Index:last}),{returned:true,value:6});count++;
 assert.deepEqual(run(vd+'GetMenuDefinition',f,{Index:last+1}),{returned:true,value:5});count++;
 for(let i=0;i<last;i++){assert.equal(run(vd+'GetMenuDefinition',f,{Index:i}).returned,false);count++;}
 f.mUIManager.mCommonTopMenu2.selected=last;
 assert.equal(run(vd+'TickASync',f).returned,true);
 const child=f.mUIManager.mSkillExchange;
 assert.equal(f.mState,18);assert.equal(child.mTopMenu,250);assert.equal(child.mState,8);assert.equal(child.mEnd,false);
 assert.equal(f.mUIManager.mCommonTopMenu2.disabled,true);assert.equal(f.mUIManager.mCommonTopMenu2.ended,true);count++;
 const creates=calls.filter(c=>c.name==='Initialize').length;
 run(vd+'TickASync',f);assert.equal(calls.filter(c=>c.name==='Initialize').length,creates);count++;
 for(const state of [8,9,27]){child.mState=state;assert.equal(run(sd+'Tick',child).returned,false);assert.equal(child.terminated,undefined);count++;}
 child.mState=3;assert.equal(run(sd+'Tick',child).returned,true);assert.equal(child.mEnd,true);assert.equal(child.terminated,true);count++;
 // UIManager's existing cleanup releases mSkillExchange after mEnd.
 f.mUIManager.mSkillExchange=null;run(vd+'TickASync',f);assert.equal(f.mState,7);assert.equal(f.mStateFirst,true);count++;
}
for(const state of [3,33]){const original={mTopMenu:0,mState:state};assert.equal(run(sd+'Tick',original).returned,false);assert.equal(original.terminated,undefined);count++;}
for(const cancel of [true,false]){const f=fixture();f.mUIManager.mCommonTopMenu2.cancel=cancel;f.mUIManager.mCommonTopMenu2.selected=0;assert.equal(run(vd+'TickASync',f).returned,false);assert.equal(f.mUIManager.mSkillExchange,null);count++;}
const child={mTopMenu:250,mEnd:false,mSkillPut:{}};
assert.equal(run(sd+'Render',child,{inHUD:{}}).returned,true);count++;
assert.ok(!calls.some(c=>['SetInputEnable','SetPauseState','RemoteEventCheckActivate','RenderGachaMenu'].includes(c.name)));
console.log(JSON.stringify({passed:true,cases:count,scope:'Emitted bridge bytecode, mocked engine/native save; not gameplay',noParentInputUnlock:true,ordinaryMushroomPathUnchanged:true}));
