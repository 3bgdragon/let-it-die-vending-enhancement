'use strict';
// Developer-only compiler. Runtime consumes the compact insert/relocation plan,
// not a redistributed game package. Input token positions come from UELib.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),audit=require('../.work/decal-menu-audit.json');
const symbols=require('../.work/package-symbols.json');
const referencedObjects={},referencedNames={};
const obj=n=>{assert.ok(n in symbols.objects,n);referencedObjects[symbols.objects[n]]=n;return symbols.objects[n];};
const name=n=>{const i=symbols.names.indexOf(n);assert.ok(i>=0,n);referencedNames[i]=n;return i;};
const raw=(b,m=b.length)=>({b:Buffer.from(b),m,j:[]});
const u32=n=>{const b=Buffer.alloc(4);b.writeInt32LE(n);return b;};
const word=n=>{const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;};
function seq(...parts){let d=0,m=0,j=[];for(const p of parts){j.push(...p.j.map(x=>({at:x.at+d,to:x.to+m})));d+=p.b.length;m+=p.m;}return {b:Buffer.concat(parts.map(x=>x.b)),m,j};}
const b=(...v)=>raw(v),ref=(op,n)=>seq(b(op),raw(u32(obj(n)),8));
const iv=n=>ref(1,n),lv=n=>ref(0,n),bool=n=>seq(b(0x2d),iv(n));
const val=n=>seq(b(0x1d),raw(u32(n))),byte=n=>b(0x24,n),truth=b(0x27),falsity=b(0x28),none=b(0x2a);
const call=(n,...args)=>seq(b(0x1b),raw(u32(name(n))),raw(u32(0)),...args,b(0x16));
const native=(n,...args)=>seq(b(n),...args,b(0x16));
const eq=(a,n)=>native(0x9a,a,val(n)),not=a=>native(0x81,a);
const assign=(l,r)=>seq(b(0x0f),l,r),setbool=(n,v)=>seq(b(0x14),bool(n),v);
const ret=seq(b(4,0x0b));
function when(c,...ps){const body=seq(...ps),r=seq(b(7,0,0),c,body);r.j.push({at:1,to:r.m});return r;}
function ctx(target,body,prop=null){return seq(b(0x19),target,raw(word(body.m)),raw(u32(prop?obj(prop):0),8),b(0),body);}
const ui=iv('BrgUIBase.mUIManager');
const manager=(body)=>ctx(ui,body);
const field=(owner,n)=>ctx(owner,iv(n),n);
const owned=(n,body)=>ctx(field(ui,'BrgUIManager.'+n),body);
const child=field(ui,'BrgUIManager.mSkillExchange');
const childcall=(n,...a)=>ctx(child,call(n,...a));
const top=(n,...a)=>owned('mCommonTopMenu2',call(n,...a));
const state=iv('BrgUIMenu_Base.mState');
const marker=iv('BrgUIMenu_SkillExchange.mTopMenu'),markerInt=seq(b(0x38,0x3a),marker);
const wait=n=>call('StartWait',raw(Buffer.from([0x1e,0,0,0,0])),val(n));
const childwait=n=>ctx(child,wait(n));
const vd='BrgUIMenu_ItemVendingMachine.',sd='BrgUIMenu_SkillExchange.';
function tokens(n){return JSON.parse(fs.readFileSync(path.join(root,'.work/decompiled',audit[n].export+'.tokens.json')));}
function slice(n,start,end){const a=audit[n],ts=tokens(n);const x=ts.find(t=>t.pos===start),y=ts.find(t=>t.pos===end);assert.ok(x&&y,`${n}: ${start}..${end}`);assert.ok(!ts.some(t=>t.pos>=start&&t.pos<end&&t.jump!==null),'Cannot clone absolute jumps');return raw(Buffer.from(a.hex,'hex').subarray(x.disk,y.disk),end-start);}
const patches=[];
function insert(n,at,prefix){const a=audit[n],ts=tokens(n),t=ts.find(t=>t.pos===at);assert.ok(t);const code=Buffer.from(a.hex,'hex');const jumps=ts.filter(t=>t.jump!==null&&t.jump!==65535).map(t=>{
 const operand=t.type.includes('Iterator')?t.disk+t.diskSize-2:t.disk+1;
 assert.equal(code.readUInt16LE(operand),t.jump);
 return {at:operand,before:t.jump,after:(t.jump>at||(at===0&&t.jump===0))?t.jump+prefix.m:t.jump};
 });
 const out=Buffer.from(prefix.b);for(const j of prefix.j)out.writeUInt16LE(j.to+at,j.at);
 patches.push({name:n,export:a.export,before:a.sha256,size:a.size,scriptSize:a.scriptSize,scriptMemory:a.scriptMemory,at:t.disk,memoryAt:at,extraMemory:prefix.m,insert:out.toString('hex'),jumps});
}
// Append a new item immediately before SetUnitArray, preserving all old indices.
const add=slice(vd+'SetupTopMenu',52,109); // Add(1) and set existing decal icon below
const icon=Buffer.from(add.b);icon[icon.length-1]=11;
const nameLvalue=slice(vd+'SetupTopMenu',110,152);
const text=raw(Buffer.concat([Buffer.from([0x34]),Buffer.from('데칼 교체 / 탈착\0','utf16le')]));
insert(vd+'SetupTopMenu',0x3a6,seq(raw(icon,add.m),assign(nameLvalue,text)));
// The appended item precedes the existing automatic exit entry.
const index=lv(vd+'GetMenuDefinition.Index');
const answer=(i,n)=>when(eq(index,i),seq(b(4),byte(n)));
insert(vd+'GetMenuDefinition',0,seq(
 when(bool(vd+'mBuyOnly'),answer(1,6),answer(2,5)),
 when(not(bool(vd+'mBuyOnly')),
  when(owned('mGameInfoNative',call('IsHideBloodnium')),answer(4,6),answer(5,5)),
  when(not(owned('mGameInfoNative',call('IsHideBloodnium'))),answer(5,6),answer(6,5)))));
// Construct the SAME existing manager-owned SkillExchange object, but mark it
// before StartSkillExchange so only this invocation takes our decal-only entry.
const makeChild=assign(child,seq(b(0x11),ui,b(0x0b,0x0b),ref(0x20,'BrgUIMenu_SkillExchange'),b(0x0b)));
const open=seq(assign(state,val(18)),setbool('BrgUIMenu_Base.mStateFirst',falsity),
 top('SetDisableInput',truth),top('EndRequest'),
 ctx(iv(vd+'mShopLimitedItems'),call('SetVisibleRemainTime',falsity)),
 makeChild,childcall('Initialize'),assign(ctx(child,marker,'BrgUIMenu_SkillExchange.mTopMenu'),byte(250)),
 childcall('StartSkillExchange',none),ret);
// Keep parent paused until the child has fully saved and UIManager releases it.
const resume=seq(assign(iv(vd+'mTopMenuSelectIndex'),byte(0)),
 owned('mCommonStatusMenuPart',call('SetVisible',truth)),assign(state,val(7)),setbool('BrgUIMenu_Base.mStateFirst',truth));
const decalTick=seq(
 when(eq(state,18),when(native(0x72,child,none),resume),ret),
 when(eq(state,8),when(not(bool('BrgUIMenu_Base.mStateFirst')),
  when(top('CheckInIdle'),when(not(top('CheckCancel')),
   when(eq(seq(b(0x38,0x3a),call('GetMenuDefinition',top('GetSelectIndex'))),6),
    when(native(0x72,child,none),open)))))));
insert(vd+'TickASync',0,decalTick);
for(const n of ['Tick','Render'])insert(vd+n,0,when(eq(state,18),ret));
// Parent already owns pause/input/background. Do not run Momoko remote events,
// welcome/gacha setup, or touch the original mushroom-shop invocation path.
insert(sd+'StartSkillExchange',0,when(eq(markerInt,250),
 setbool(sd+'mEnd',falsity),seq(ref(0x1c,sd+'MakeHaveInformation'),b(0x16)),
 assign(seq(b(0x36),iv(sd+'mNetShopHistoryArray')),val(0)),
 assign(seq(b(0x36),iv(sd+'mNetPutHistoryArray')),val(0)),
 assign(iv(sd+'mSequenceAction'),none),wait(8),ret));
// State 3 is reached only after cancel-without-changes OR successful history
// submission. Error/retry states keep the original implementation untouched.
const close=seq(call('Terminate'),setbool(sd+'mEnd',truth),ret);
// Insert AFTER CheckStop has processed the wait transition, BEFORE its switch.
insert(sd+'Tick',373,when(eq(markerInt,250),when(eq(state,3),close),when(eq(state,33),close)));
// Decal-only entry never initializes gacha fonts/banner content. Render only the
// existing SkillPut UI; global network-error dialogs remain owned by UIManager.
const hud=lv(sd+'Render.inHUD');
insert(sd+'Render',0,when(eq(markerInt,250),when(bool(sd+'mEnd'),ret),
 ctx(hud,call('SetupWhiteTexMIC')),ctx(hud,call('SetDrawColor',byte(255),byte(255),byte(255))),
 ctx(iv(sd+'mSkillPut'),call('RenderProcess',hud)),ret));
if(require.main===module){
fs.mkdirSync(path.join(root,'patches'),{recursive:true});
fs.writeFileSync(path.join(root,'patches/decal-build25386710.json'),JSON.stringify({build:25386710,exportCount:173671,patches},null,2)+'\n');
console.log(patches.map(p=>({name:p.name,bytes:p.insert.length/2,memory:p.extraMemory,jumps:p.jumps.length})));
}
module.exports={root,audit,symbols,obj,raw,u32,word,seq,b,ref,iv,lv,bool,val,byte,truth,falsity,none,call,native,eq,not,assign,setbool,ret,when,ctx,ui,manager,field,owned,top,state,wait,vd,sd,slice,patches,insert,add,icon,nameLvalue,decalTick,referencedObjects,referencedNames};
