'use strict';
// A deliberately small interpreter for emitted INSERTIONS, not the UE engine.
// Native methods are supplied by tests. Validates bytecode boundaries/jumps and
// exercises the actual generated script, rather than a separate JS re-write.
const assert=require('node:assert/strict');
function compile(p,symbols){
 const code=Buffer.from(p.insert,'hex');let disk=0,memory=p.memoryAt;
 const read=n=>{const at=disk;disk+=n;memory+=n;assert.ok(disk<=code.length);return code.subarray(at,disk);};
 const int=()=>read(4).readInt32LE(),word=()=>read(2).readUInt16LE();
 const object=()=>{const index=int();memory+=4;assert.ok(symbols.objects[index],`missing object ${index}`);return symbols.objects[index];};
 function expr(){
  const at=memory,op=read(1)[0];let node={at,op};
  if(op===0||op===1||op===0x20)node.name=object();
  else if(op===0x2d||op===0x36)node.value=expr();
  else if(op===0x35){node.name=object();node.struct=object();node.copy=read(1)[0];node.modify=read(1)[0];node.value=expr();}
  else if(op===0x19){node.target=expr();node.skip=word();int();memory+=4;read(1);const before=memory;node.value=expr();assert.equal(memory-before,node.skip,'context skip');}
  else if(op===0x10||op===0x1a){node.index=expr();node.array=expr();}
  else if(op===0x2e){node.name=object();node.value=expr();}
  else if(op===0x0f||op===0x14){node.left=expr();node.right=expr();}
  else if(op===0x1d)node.value=int();
  else if(op===0x1e)node.value=read(4).readFloatLE();
  else if(op===0x24||op===0x2c)node.value=read(1)[0];
  else if(op===0x38){assert.equal(read(1)[0],0x3a);node.value=expr();}
  else if(op===0x34){const chars=[];for(;;){const c=word();if(!c)break;chars.push(c);}node.value=String.fromCharCode(...chars);}
  else if(op===0x11){node.args=Array.from({length:5},()=>expr());}
  else if(op===0x40){node.array=expr();node.index=expr();node.count=expr();assert.equal(read(1)[0],0x16);}
  else if([0x17,0x27,0x28,0x2a,0x0b,0x4a].includes(op)){}
  else if(op===0x1b||op===0x1c||op>=0x70){
   if(op===0x1b){node.name=symbols.names[int()];assert.ok(node.name);assert.equal(int(),0);}
   if(op===0x1c)node.name=object().split('.').at(-1);
   node.args=[];while(code[disk]!==0x16)node.args.push(expr());read(1);
  }else throw Error(`unsupported token ${op.toString(16)} at ${at}`);
  node.end=memory;return node;
 }
 const statements=[];
 while(disk<code.length){const at=memory,op=code[disk];
  if(op===7){read(1);const to=word();statements.push({at,op,to,value:expr()});}
  else if(op===6){read(1);statements.push({at,op,to:word()});}
  else if(op===4){read(1);statements.push({at,op,value:expr()});}
  else statements.push(expr());
 }
 assert.equal(memory,p.memoryAt+p.extraMemory,'serialized runtime size');
 const indices=new Map(statements.map((s,i)=>[s.at,i]));indices.set(memory,statements.length);
 for(const s of statements)if(s.op===6||s.op===7)assert.ok(indices.has(s.to),`invalid jump ${s.to}`);
 return {statements,indices};
}
function execute(compiled,self,locals={},invoke=()=>{throw Error('unexpected native call');}){
 const {statements,indices}=compiled;
 const short=n=>n.split('.').at(-1),copy=v=>v&&typeof v==='object'&&!v.$object?structuredClone(v):v;
 const address=(o,key)=>{assert.ok(o!=null,'null lvalue');return {$ref:true,get:()=>o[key],set:v=>o[key]=v};};
 const functions={0x72:(a,b)=>a===b,0x77:(a,b)=>a!==b,0x7a:(a,b)=>a===b,0x81:a=>!a,
  0x91:(a,b)=>Math.trunc(a/b),0x92:(a,b)=>a+b,0x93:(a,b)=>a-b,0x96:(a,b)=>a<b,
  0x97:(a,b)=>a>b,0x99:(a,b)=>a>=b,0x9a:(a,b)=>a===b,0x9c:(a,b)=>a&b};
 function evalNode(n,context=self,wantAddress=false){
  switch(n.op){
   case 0:case 1:{const o=n.op===0?locals:context;const r=address(o,short(n.name));return wantAddress?r:r.get();}
   case 0x2d:return evalNode(n.value,context,wantAddress);
   case 0x35:{const r=address(evalNode(n.value,context),short(n.name));return wantAddress?r:r.get();}
   case 0x19:{const target=evalNode(n.target,context);assert.ok(target!=null,'null context');return evalNode(n.value,target,wantAddress);}
   case 0x10:case 0x1a:{const index=evalNode(n.index,context),arr=evalNode(n.array,context);assert.ok(Number.isInteger(index)&&index>=0&&index<arr.length,`array index ${index}/${arr.length}`);const r=address(arr,index);return wantAddress?r:r.get();}
   case 0x36:{const r=address(evalNode(n.value,context),'length');return wantAddress?r:r.get();}
   case 0x2e:{const target=evalNode(n.value,context);return target.$class===n.name?target:null;}
   case 0x0f:case 0x14:{const r=evalNode(n.left,context,true),v=evalNode(n.right,context);r.set(copy(v));return v;}
   case 0x1d:case 0x1e:case 0x24:case 0x2c:case 0x34:return n.value;
   case 0x38:return Number(evalNode(n.value,context));
   case 0x27:return true;case 0x28:return false;case 0x2a:return null;case 0x0b:case 0x4a:return undefined;
   case 0x17:return self;case 0x20:return n.name;
   case 0x40:{const arr=evalNode(n.array,context);arr.splice(evalNode(n.index,context),evalNode(n.count,context));return;}
   case 0x11:return invoke('NewObject',n.args.map(a=>evalNode(a,self)),context);
   default:{
    if(functions[n.op])return functions[n.op](...n.args.map(a=>evalNode(a,self)));
    assert.ok(n.op===0x1b||n.op===0x1c,`unhandled ${n.op}`);
    // Native argument expressions execute against Stack.Object (the caller),
    // NOT the target object selected by the outer Context token.
    const args=n.args.map((a,i)=>evalNode(a,self,n.name==='CreateItemMiniPanelInfo_Part'&&i<2));
    return invoke(n.name,args,context);
   }
  }
 }
 let index=0,steps=0;
 while(index<statements.length){assert.ok(++steps<100000,'loop limit');const s=statements[index];
  if(s.op===7){index=evalNode(s.value)?index+1:indices.get(s.to);}
  else if(s.op===6)index=indices.get(s.to);
  else if(s.op===4)return {returned:true,value:evalNode(s.value)};
  else{evalNode(s);index++;}
 }
 return {returned:false};
}
module.exports={compile,execute};
