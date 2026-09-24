"""Emulate original purchase + shopping update control flow.
Price resolution, wallet/inventory services and string serialization are stubs.
NOT proof of real save persistence or UI sold-out enforcement.
"""
import argparse,hashlib,json,struct
from pathlib import Path
import pefile
from capstone import Cs,CS_ARCH_X86,CS_MODE_64
from capstone.x86 import X86_OP_MEM,X86_REG_RIP
from unicorn import Uc,UC_ARCH_X86,UC_MODE_64,UC_HOOK_CODE
from unicorn.x86_const import *
p=argparse.ArgumentParser();p.add_argument('exe',type=Path);args=p.parse_args()
raw=args.exe.read_bytes();pe=pefile.PE(data=raw);base=pe.OPTIONAL_HEADER.ImageBase
assert hashlib.sha256(raw).hexdigest()=='b29bf446786aed3c6c47b69e112e4ba6d1e97ed6b7ead791c80754472432ef6a', 'Unaudited executable: rederive offsets first'
md=Cs(CS_ARCH_X86,CS_MODE_64);md.detail=True

def run(balance,cost=10000,stock=1,pack=5,listed=True,fail_charge=False,hvn=False):
 uc=Uc(UC_ARCH_X86,UC_MODE_64);mapped=set();ins={};gid=1900000000
 def page(a):
  a &= ~4095
  if a not in mapped:uc.mem_map(a,4096);mapped.add(a)
 for lo,hi in [(0x1141fd0,0x114256e),(0x1358690,0x135897c)]:
  for a in range((base+lo)&~4095,base+hi,4096):page(a)
  data=pe.get_data(lo,hi-lo);uc.mem_write(base+lo,data)
  for i in md.disasm(data,base+lo):
   ins[i.address]=i
   for op in i.operands:
    if op.type==X86_OP_MEM and op.mem.base==X86_REG_RIP:page(i.address+i.size+op.mem.disp)
 uc.mem_map(0x10000000,0x200000);heap=0x10020000
 def alloc(n):
  nonlocal heap
  a=heap;heap+=(max(n,16)+15)&~15
  assert heap<0x10200000
  return a
 def w(a,f,*v):uc.mem_write(a,struct.pack('<'+f,*v))
 def read(a,f):return struct.unpack('<'+f,uc.mem_read(a,struct.calcsize('<'+f)))
 def reg(r):return uc.reg_read(r)
 def ret(v):uc.reg_write(UC_X86_REG_RAX,v)
 rsp=0x10008000;rbp=rsp+0x100;wallet=0x10010000;obj=base+0x27d3210
 state={0x8c:([gid,44] if listed else [44]),0x9c:[12],0xac:[13]}
 grants=[];debits=[];errors=[];dirty=[]
 for r,v in [(UC_X86_REG_RSP,rsp),(UC_X86_REG_RBP,rbp),(UC_X86_REG_RSI,gid),
             (UC_X86_REG_R15,cost),(UC_X86_REG_R12,0),(UC_X86_REG_RDI,0),
             (UC_X86_REG_R14,0),(UC_X86_REG_R13,0),(UC_X86_REG_RBX,0xffffffff)]:uc.reg_write(r,v)
 w(wallet+0x54,'i',balance);w(rbp-0x20,'i',pack)
 def hook(machine,address,size,_):
  i=ins.get(address)
  if not i or i.mnemonic!='call':return
  at=address-base
  if at==0x11424da:return  # real shopping update function
  target=i.operands[0].imm-base if i.operands[0].type==2 else None
  if at==0x13587c6:  # memmove when removing a bought goods ID
   machine.mem_write(reg(UC_X86_REG_RCX),bytes(machine.mem_read(reg(UC_X86_REG_RDX),reg(UC_X86_REG_R8))))
  elif at==0x135891b:dirty.append(True)
  elif target==0x136bf40:ret(wallet)
  elif target==0x1345990:
   amount=reg(UC_X86_REG_RDX)&0xffffffff
   if fail_charge:ret(0)
   else:debits.append(amount);ret(1)
  elif target==0x13478f0:grants.append(reg(UC_X86_REG_RDX)&0xffffffff);ret(1)
  elif target==0x1155510:ret(int(hvn))
  elif target==0x1151ed0:
   # Row layout verified at purchase/update offsets: stock +0x68, pack +0x70,
   # validity +0xb8. Other row contents not consumed in this function.
   dest=reg(UC_X86_REG_RCX);machine.mem_write(dest,bytes(0xbc))
   w(dest+0x68,'i',stock);w(dest+0x70,'i',pack);w(dest+0xb8,'B',1);ret(dest)
  elif target==0x1338080:
   values=state[reg(UC_X86_REG_RCX)-obj];dest=reg(UC_X86_REG_RDX);data=alloc(256)
   for n,v in enumerate(values):w(data+n*4,'I',v)
   w(dest,'QII',data,len(values),64);ret(1)
  elif target==0x1356b50:
   data,n,cap=read(reg(UC_X86_REG_RCX),'QII')
   state[reg(UC_X86_REG_RDX)-obj]=list(read(data,'I'*n)) if n else [];ret(1)
  elif target==0x09cc60:ret(reg(UC_X86_REG_RDX)) # preserve preallocated capacity
  elif target==0x014af90:
   dest=reg(UC_X86_REG_RCX);w(dest,'QII',0,0,0);ret(dest)
  elif target==0x01b200:ret(0x10018000)
  elif target in (0x0df5f0,0x1180c50):pass
  elif target in (0x013ee20,0x1171d10):errors.append(hex(target))
  else:raise AssertionError('Unstubbed call '+hex(at)+' -> '+str(target))
  machine.reg_write(UC_X86_REG_RIP,address+size)
 uc.hook_add(UC_HOOK_CODE,hook);uc.emu_start(base+0x11421ab,base+0x11424e1,count=20000)
 assert reg(UC_X86_REG_RIP)==base+0x11424e1
 assert all(value==gid for value in grants)
 return {'success':bool(reg(UC_X86_REG_RBX)&255),'debits':debits,'grants':len(grants),
         'buyable':state[0x8c],'bought':state[0x9c],'hvnBought':state[0xac],
         'dirtyCalls':len(dirty),'errors':len(errors)}

tests=[]
for name,kwargs,success,grants,debits,removed in [
 ('normal-pack-five',{},True,5,[10000],True),
 ('exact-balance',{'balance':10000},True,5,[10000],True),
 ('insufficient-funds',{'balance':9999},False,0,[],False),
 ('charge-service-rejects',{'fail_charge':True},False,0,[],False),
 ('unlimited-stock',{'stock':0},True,5,[10000],False),
 ('missing-from-list-direct-call',{'listed':False},True,5,[10000],True),
 ('hvn-history-flag',{'hvn':True},True,5,[10000],True),
]:
 opts={'balance':100000};opts.update(kwargs);result=run(**opts)
 assert result['success']==success and result['grants']==grants and result['debits']==debits,(name,result)
 assert (1900000000 not in result['buyable'])==removed,(name,result)
 assert result['bought']==([12,1900000000] if success else [12]),(name,result)
 assert result['hvnBought']==([13,1900000000] if kwargs.get('hvn') else [13]),(name,result)
 assert result['dirtyCalls']==int(success),(name,result)
 tests.append({'name':name,'passed':True,**result})
report={'exeSha256':hashlib.sha256(raw).hexdigest(),
 'scope':'Original purchase after price resolution and original stock update; wallet/inventory/serialization services stubbed. No actual save/UI test.',
 'tests':tests}
out=Path(__file__).resolve().parents[1]/'.work/native-purchase-test.json'
assert hashlib.sha256(args.exe.read_bytes()).hexdigest()==report['exeSha256']
out.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
