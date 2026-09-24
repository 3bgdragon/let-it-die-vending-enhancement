"""Run generated bootstrap x64, with explicit engine service stubs; no game writes."""
import json,struct,subprocess
from pathlib import Path
from unicorn import Uc,UC_ARCH_X86,UC_MODE_64,UC_HOOK_CODE
from unicorn.x86_const import *
root=Path(__file__).resolve().parents[1]
script="const b=require('./src/material-bootstrap').buildMaterialBootstrap(0x3000000);console.log(JSON.stringify({...b,code:b.code.toString('hex')}))"
plan=json.loads(subprocess.check_output(['node','-e',script],cwd=root,text=True))
BASE=0x140000000;USER=BASE+0x27d3210;ARENA=0x20000000;STOP=ARENA+0xff000
FIRST=1900000000
def run(buyable,bought,selected=None,daily_replace=None,invalid=False):
 u=Uc(UC_ARCH_X86,UC_MODE_64);pages=set();next_alloc=ARENA+0x10000;allocated=set();freed=set();calls=[]
 def mapat(a,n=4096):
  for p in range(a&~4095,(a+n+4095)&~4095,4096):
   if p not in pages:u.mem_map(p,4096);pages.add(p)
 def w(a,fmt,*v):u.mem_write(a,struct.pack('<'+fmt,*v))
 def r(a,fmt):return struct.unpack('<'+fmt,u.mem_read(a,struct.calcsize('<'+fmt)))[0]
 def alloc(data):
  nonlocal next_alloc
  a=next_alloc;next_alloc+=(len(data)+15)&~15;u.mem_write(a,data);allocated.add(a);return a
 def putstr(a,s):
  data=(s+'\0').encode('utf-16le');w(a,'QII',alloc(data),len(data)//2,len(data)//2)
 def getstr(a):
  n=r(a+8,'I');return bytes(u.mem_read(r(a,'Q'),n*2)).decode('utf-16le').rstrip('\0') if n else ''
 def literal(a):
  b=bytearray()
  while bytes(u.mem_read(a,2))!=b'\0\0':b.extend(u.mem_read(a,2));a+=2
  return b.decode('utf-16le')
 mapat(BASE+plan['caveRva']);u.mem_write(BASE+plan['caveRva'],bytes.fromhex(plan['code']))
 mapat(USER);mapat(BASE+0xf8907e0);mapat(ARENA,0x100000)
 u.mem_write(USER,bytes([0xa5])*0x200)
 vtable=ARENA+0x2000;notify=BASE+0x700000;w(USER,'Q',vtable);w(vtable+0x38,'Q',notify)
 putstr(USER+0x8c,buyable);putstr(USER+0x9c,bought)
 if invalid:w(USER+0x94,'i',-1)
 before=bytes(u.mem_read(USER,0x200));result_before=(buyable,bought)
 rsp=ARENA+0x8008;w(rsp,'Q',STOP);u.reg_write(UC_X86_REG_RSP,rsp)
 nv=[UC_X86_REG_RBX,UC_X86_REG_RSI,UC_X86_REG_RDI,UC_X86_REG_R12,UC_X86_REG_R13]
 for i,reg in enumerate(nv):u.reg_write(reg,0x123400+i)
 services=[0x134f050,0x1155960,0x1356b50,0x1bbe0,0x1bb10,0xdf5f0,0x700000]
 for a in services:mapat(BASE+a)
 out_array=0;temporary=0
 def hook(m,address,size,_):
  nonlocal out_array,temporary
  at=address-BASE
  if at not in services:return
  assert m.reg_read(UC_X86_REG_RSP)%16==8,'Windows ABI alignment'
  c=m.reg_read(UC_X86_REG_RCX);d=m.reg_read(UC_X86_REG_RDX);calls.append(hex(at));ret=1
  if at==0x134f050:
   if daily_replace is not None:putstr(USER+0x8c,daily_replace);putstr(USER+0x9c,'')
   ret=0x12345601
  elif at==0x1155960:
   assert r(d+8,'I')==1 and getstr(r(d,'Q'))=='COMMON'
   assert m.reg_read(UC_X86_REG_R8)&0xffffffff==0xffffffff
   ids=selected if selected is not None else [26701,FIRST,FIRST+1,26702]
   out_array=alloc(struct.pack('<'+'I'*len(ids),*ids)) if ids else 0
   w(c,'QII',out_array,len(ids),len(ids))
  elif at==0x1356b50:
   n=r(c+8,'I');ids=struct.unpack('<'+'I'*n,u.mem_read(r(c,'Q'),n*4))
   assert all(FIRST<=i<FIRST+10000 for i in ids)
   putstr(d,','.join(map(str,ids)));temporary=r(d,'Q')
  elif at==0x1bbe0:putstr(c,getstr(c)+literal(d))
  elif at==0x1bb10:putstr(c,getstr(c)+getstr(d))
  elif at==0xdf5f0:assert c in allocated and c not in freed;freed.add(c)
  elif at==0x700000:assert c==USER
  m.reg_write(UC_X86_REG_RAX,ret)
  sp=m.reg_read(UC_X86_REG_RSP);m.reg_write(UC_X86_REG_RIP,r(sp,'Q'));m.reg_write(UC_X86_REG_RSP,sp+8)
 u.hook_add(UC_HOOK_CODE,hook);u.emu_start(BASE+plan['caveRva'],STOP,count=100000)
 assert u.reg_read(UC_X86_REG_RIP)==STOP
 assert u.reg_read(UC_X86_REG_RAX)==0x12345601
 for i,reg in enumerate(nv):assert u.reg_read(reg)==0x123400+i
 after=bytes(u.mem_read(USER,0x200))
 assert before[:0x8c]==after[:0x8c] and before[0xac:]==after[0xac:],'Other shop fields mutated'
 if daily_replace is None:assert getstr(USER+0x9c)==bought,'Purchase history changed'
 if out_array:assert out_array in freed
 if temporary:assert temporary in freed
 return {'buyable':getstr(USER+0x8c) if not invalid else buyable,'bought':getstr(USER+0x9c),'calls':calls}
tests=[]
def check(name,**kw):
 result=run(**kw);tests.append({'name':name,**result});return result
a=check('initial preserves existing purchases',buyable='26701,26702',bought='26698')
assert a['buyable']=='26701,26702,1900000000,1900000001'
assert a['calls'].count('0x134f050')==1
assert '0x700000' in a['calls']
for name,buy,bought in [('same day reload',a['buyable'],'26698'),('partial purchase','26701,1900000001','1900000000'),('sold out','26701','1900000000,1900000001'),('upper bound','','1900009999')]:
 b=check(name,buyable=buy,bought=bought);assert b['buyable']==buy;assert b['calls']==['0x134f050']
b=check('next day native refill',buyable='26701',bought='1900000000',daily_replace='26701,1900000003')
assert b['buyable']=='26701,1900000003' and b['calls']==['0x134f050']
for s in ['', '190000000', '1900010000', '1190000000']:
 b=check('non-marker '+repr(s),buyable=s,bought='');assert '0x1155960' in b['calls']
for s in ['oops','19000000000']:
 b=check('malformed fail closed '+s,buyable=s,bought='');assert b['calls']==['0x134f050']
b=check('bad bounds fail closed',buyable='26701',bought='',invalid=True);assert b['calls']==['0x134f050']
b=check('empty candidate set',buyable='26701',bought='',selected=[]);assert b['buyable']=='26701' and '0x700000' not in b['calls']
b=check('only ordinary candidates',buyable='26701',bought='',selected=[12,13]);assert b['buyable']=='26701'
print(json.dumps({'passed':True,'cases':len(tests),'scope':'Generated x64 executes; native query/serialization/allocation/daily service stubs; not a live game test','tests':tests},indent=2))
