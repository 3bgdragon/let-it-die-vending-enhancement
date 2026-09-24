"""Read-only x64 references to the daily-shop date global; workspace output only."""
import argparse, bisect, json
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_64

p=argparse.ArgumentParser();p.add_argument('exe',type=Path);args=p.parse_args()
pe=pefile.PE(str(args.exe));base=pe.OPTIONAL_HEADER.ImageBase
cmp=pe.get_data(0x13404f0,7);assert cmp[:3]==bytes.fromhex('48390d')
target=0x13404f7+int.from_bytes(cmp[3:],'little',signed=True)
ranges=sorted((x.struct.BeginAddress,x.struct.EndAddress) for x in pe.DIRECTORY_ENTRY_EXCEPTION)
starts=[x[0] for x in ranges];md=Cs(CS_ARCH_X86,CS_MODE_64);found={}
for sec in pe.sections:
 if not sec.Characteristics&0x20000000:continue
 data=sec.get_data();rva=sec.VirtualAddress
 for at in range(len(data)-7):
  if data[at] not in (0x48,0x4c) or data[at+1] not in (0x89,0x8b,0x39,0x3b,0x8d) or data[at+2]&0xc7!=5:continue
  if rva+at+7+int.from_bytes(data[at+3:at+7],'little',signed=True)!=target:continue
  i=bisect.bisect_right(starts,rva+at)-1
  a,z=ranges[i] if i>=0 and ranges[i][0]<=rva+at<ranges[i][1] else (rva+at,rva+at+128)
  lines=[]
  for inst in md.disasm(pe.get_data(a,z-a),base+a):
   lines.append(f'{inst.address-base:08x} {inst.mnemonic} {inst.op_str}')
   if inst.mnemonic=='ret' and a==rva+at:break
  found[hex(rva+at)]={'function':hex(a),'code':lines}
out={'globalRva':hex(target),'references':found}
dest=Path(__file__).resolve().parents[1]/'.work/daily-date-refs.json'
dest.parent.mkdir(parents=True,exist_ok=True)
dest.write_text(json.dumps(out,indent=2),encoding='utf8')
print(json.dumps(out,indent=2))
