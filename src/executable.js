'use strict';
const crypto=require('node:crypto');
const {buildMaterialGate}=require('./material-selector');
const SUPPORTED='b29bf446786aed3c6c47b69e112e4ba6d1e97ed6b7ead791c80754472432ef6a';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function patchExecutable(input) {
  if(sha(input)!==SUPPORTED) throw new Error('지원하지 않는 실행 파일입니다. SHA-256: '+sha(input));
  const pe=input.readUInt32LE(0x3c), count=input.readUInt16LE(pe+6), opt=pe+24;
  if(input.toString('ascii',pe,pe+4)!=='PE\0\0'||input.readUInt16LE(opt)!==0x20b)throw new Error('PE64 형식 불일치');
  const table=opt+input.readUInt16LE(pe+20), header=table+count*40;
  const sections=Array.from({length:count},(_,i)=>{
    const at=table+i*40;return {va:input.readUInt32LE(at+12),vs:input.readUInt32LE(at+8),size:input.readUInt32LE(at+16),raw:input.readUInt32LE(at+20)};
  });
  const firstRaw=Math.min(...sections.filter(s=>s.size).map(s=>s.raw));
  if(header+40>Math.min(firstRaw,input.readUInt32LE(opt+60))||input.subarray(header,header+40).some(x=>x!==0))throw new Error('새 코드 섹션용 헤더 여유 공간이 없습니다');
  const align=(n,a)=>Math.ceil(n/a)*a, sa=input.readUInt32LE(opt+32),fa=input.readUInt32LE(opt+36);
  if(!sa||!fa)throw new Error('잘못된 PE 정렬');
  const rva=align(Math.max(input.readUInt32LE(opt+56),...sections.map(s=>s.va+Math.max(s.vs,s.size))),sa);
  const gate=buildMaterialGate(rva),raw=align(input.length,fa),size=align(gate.code.length,fa);
  const section=sections.find(s=>gate.hookRva>=s.va&&gate.hookRva+6<=s.va+s.size);
  if(!section)throw new Error('후크 위치가 파일 범위 밖입니다');
  const hookAt=section.raw+gate.hookRva-section.va;
  if(!input.subarray(hookAt,hookAt+6).equals(gate.original))throw new Error('후크 원본 불일치');
  const output=Buffer.alloc(raw+size);input.copy(output);
  output.write('.lidvend',header,'ascii');output.writeUInt32LE(gate.code.length,header+8);
  output.writeUInt32LE(rva,header+12);output.writeUInt32LE(size,header+16);output.writeUInt32LE(raw,header+20);
  output.writeUInt32LE(0x60000020,header+36);output.writeUInt16LE(count+1,pe+6);
  output.writeUInt32LE(align(rva+gate.code.length,sa),opt+56);
  output.writeUInt32LE(input.readUInt32LE(opt+4)+size,opt+4);output.writeUInt32LE(0,opt+64);
  gate.hook.copy(output,hookAt);gate.code.copy(output,raw);
  return {output,details:{rva,raw,hookAt,gateSize:gate.code.length,before:sha(input),after:sha(output)}};
}
module.exports={patchExecutable,sha};
