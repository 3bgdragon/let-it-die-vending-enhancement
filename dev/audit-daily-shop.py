"""Read-only native shop investigation; dumps evidence only under .work."""
import argparse,bisect,json
from pathlib import Path
import pefile
from capstone import Cs,CS_ARCH_X86,CS_MODE_64
from capstone.x86 import X86_OP_MEM,X86_REG_RIP

parser=argparse.ArgumentParser();parser.add_argument('exe',type=Path);parser.add_argument('--rva',type=lambda s:int(s,0));parser.add_argument('--callers',action='store_true');parser.add_argument('--term',action='append');args=parser.parse_args()
pe=pefile.PE(str(args.exe));base=pe.OPTIONAL_HEADER.ImageBase;raw=args.exe.read_bytes()
md=Cs(CS_ARCH_X86,CS_MODE_64);md.detail=True
ranges=sorted((e.struct.BeginAddress,e.struct.EndAddress) for e in pe.DIRECTORY_ENTRY_EXCEPTION)
starts=[x[0] for x in ranges]
def function(rva):
 i=bisect.bisect_right(starts,rva)-1
 return ranges[i] if i>=0 and ranges[i][0]<=rva<ranges[i][1] else (rva,rva+256)
def dump(rva):
 start,end=function(rva)
 # Leaf functions without unwind metadata stop at the first return.
 known=any(a==start and b==end for a,b in ranges)
 lines=[]
 for i in md.disasm(pe.get_data(start,end-start),base+start):
  lines.append(f'{i.address-base:08x} {i.mnemonic} {i.op_str}')
  if not known and i.mnemonic=='ret':break
 return lines
out={}
if args.rva is not None:
 out[hex(args.rva)]=dump(args.rva)
 if args.callers:
  found={}
  for sec in pe.sections:
   if not sec.Characteristics&0x20000000:continue
   data=sec.get_data();rva=sec.VirtualAddress;at=0
   while (at:=data.find(b'\xe8',at))>=0:
    if at+5<=len(data) and rva+at+5+int.from_bytes(data[at+1:at+5],'little',signed=True)==args.rva:
     start,end=function(rva+at);found[hex(start)]=dump(start)
    at+=1
  out['callers']=found
else:
 strings={}
 for text in args.term or ['COMMON','AP','MON','automaticshop_daily_date','automaticshop_buyable_goods_ids','automaticshop_bloodnium_exchanged_goods_ids']:
  for enc in ['ascii','utf-16le']:
   needle=(text if args.term else text+'\0').encode(enc);at=0
   while (at:=raw.find(needle,at))>=0:
    try:strings[base+pe.get_rva_from_offset(at)]=text
    except Exception:pass
    at+=len(needle)
 out['strings']={hex(k-base):v for k,v in strings.items()}
 funcs={}
 for sec in pe.sections:
  if not sec.Characteristics&0x20000000:continue
  # Scan RIP-relative LEA encodings rather than disassembling padding as code.
  data=sec.get_data();rva=sec.VirtualAddress
  for at in range(len(data)-7):
   if data[at] not in (0x48,0x4c) or data[at+1]!=0x8d or data[at+2]&0xc7!=5:continue
   dest=base+rva+at+7+int.from_bytes(data[at+3:at+7],'little',signed=True)
   if dest not in strings:continue
   start,end=function(rva+at)
   funcs.setdefault(start,[]).append({'at':hex(rva+at),'string':strings[dest]})
 out['functions']={hex(k):{'references':v,'disassembly':dump(k)} for k,v in funcs.items()}
work=Path(__file__).resolve().parents[1]/'.work';work.mkdir(exist_ok=True)
target=work/('native-'+(hex(args.rva) if args.rva is not None else ('terms' if args.term else 'shop'))+'.json')
target.write_text(json.dumps(out,indent=2),encoding='utf-8')
if args.rva is not None:
 print('\n'.join(out[hex(args.rva)]))
 if args.callers:
  for k,v in out['callers'].items():print('CALLER',k,'\n'+'\n'.join(v))
else:print(json.dumps({k:v['references'] for k,v in out['functions'].items()},indent=2))
