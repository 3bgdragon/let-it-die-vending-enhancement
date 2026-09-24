"""Read-only emulation of daily refresh control flow, NOT a gameplay test.

Clock/date conversion, notification and full initializer are explicit stubs.
The actual equality test, refresh decision and caller branches execute unchanged.
"""
import argparse, hashlib, json, struct
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_64
from capstone.x86 import X86_OP_MEM, X86_REG_RIP
from unicorn import Uc, UC_ARCH_X86, UC_MODE_64, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RSP, UC_X86_REG_RCX, UC_X86_REG_RAX, UC_X86_REG_RIP

p = argparse.ArgumentParser(); p.add_argument('exe', type=Path); args = p.parse_args()
raw = args.exe.read_bytes(); pe = pefile.PE(data=raw); base = pe.OPTIONAL_HEADER.ImageBase
md = Cs(CS_ARCH_X86, CS_MODE_64); md.detail = True
# Explicit ranges include leaf functions absent from unwind metadata.
ranges = [(0x134f050, 0x134f0d6), (0x12d8f70, 0x12d8fc1),
          (0x13404f0, 0x13404fb), (0x134dac0, 0x134db45), (0x134dc10, 0x134dc95)]
assert pe.get_data(0x13404f0, 3) == bytes.fromhex('48390d')
assert pe.get_data(0x134f07f, 5) == bytes.fromhex('e83cdeffff')

def vm():
    uc = Uc(UC_ARCH_X86, UC_MODE_64); mapped = set(); instructions = {}
    def map_page(address):
        page = address & ~0xfff
        if page not in mapped: uc.mem_map(page, 4096); mapped.add(page)
    for start, end in ranges:
        for page in range((base+start)&~0xfff, base+end, 4096): map_page(page)
        data = pe.get_data(start, end-start); uc.mem_write(base+start, data)
        for ins in md.disasm(data, base+start):
            instructions[ins.address] = ins
            for operand in ins.operands:
                if operand.type == X86_OP_MEM and operand.mem.base == X86_REG_RIP:
                    map_page(ins.address+ins.size+operand.mem.disp)
    uc.mem_map(0x10000000, 0x10000)
    return uc, instructions

def write(uc, addr, fmt, *values): uc.mem_write(addr, struct.pack('<'+fmt, *values))
def rip_target(ins):
    op = next(x for x in ins.operands if x.type == X86_OP_MEM and x.mem.base == X86_REG_RIP)
    return ins.address+ins.size+op.mem.disp

def daily(saved, today):
    uc, ins = vm(); calls = []
    rsp = 0x10008008; stop = 0x1000f000
    write(uc, rsp, 'Q', stop); uc.reg_write(UC_X86_REG_RSP, rsp)
    write(uc, rip_target(ins[base+0x13404f0]), 'q', saved)
    # Valid existing expiry avoids unrelated expiry-repair branch on same day.
    write(uc, rip_target(ins[base+0x134f091]), 'q', 1)
    def hook(machine, address, size, _):
        i = ins.get(address)
        if not i or i.mnemonic != 'call': return
        at = address-base
        if at in (0x134f066, 0x12d8f8d): return  # execute real detector/comparator
        if at == 0x12d8f7d:
            ptr = machine.reg_read(UC_X86_REG_RCX)
            write(machine, ptr, 'q', today); machine.reg_write(UC_X86_REG_RAX, ptr)
        elif at == 0x12d8f85: machine.reg_write(UC_X86_REG_RAX, today)
        elif at == 0x12d8f9d: machine.reg_write(UC_X86_REG_RAX, 123456789)
        elif at == 0x134f07f: calls.append('full-shop-initializer')
        elif at not in (0x134f061, 0x134f071, 0x12d8fb5):
            raise AssertionError('Unexpected call '+hex(at))
        machine.reg_write(UC_X86_REG_RIP, address+size)
    uc.hook_add(UC_HOOK_CODE, hook); uc.emu_start(base+0x134f050, stop, count=1000)
    assert uc.reg_read(UC_X86_REG_RIP) == stop
    return calls

def buffer_reset(start, stop, offsets):
    uc, ins = vm(); obj = 0x10001000; rsp = 0x10008008; calls = []
    uc.reg_write(UC_X86_REG_RSP, rsp); uc.reg_write(UC_X86_REG_RCX, obj)
    before = bytearray(b'\xa5'*0x200)
    for n, offset in enumerate(offsets):
        struct.pack_into('<QII', before, offset, 0x10003000+n*0x100, 3, 3)
    uc.mem_write(obj, bytes(before))
    def hook(machine, address, size, _):
        i=ins.get(address)
        if i and i.mnemonic == 'call':
            assert i.op_str == hex(base+0xdfef0), i.op_str
            calls.append('reallocate-buffer-zero')
            machine.reg_write(UC_X86_REG_RAX, 0)
            machine.reg_write(UC_X86_REG_RIP, address+size)
    uc.hook_add(UC_HOOK_CODE, hook); uc.emu_start(base+start, base+stop, count=300)
    assert uc.reg_read(UC_X86_REG_RIP) == base+stop
    actual = bytes(uc.mem_read(obj, len(before))); expected=bytearray(before)
    for offset in offsets: expected[offset:offset+16]=bytes(16)
    assert actual == bytes(expected), 'unexpected object mutation'
    return {'clearedBuffers': [hex(x) for x in offsets], 'allocatorCalls': len(calls),
            'otherObjectBytesUnchanged': True}

tests=[]
for name, saved, today, refresh in [('same-day',100,100,False),('next-day',100,101,True),
                                   ('multiple-days',100,107,True),('clock-backward',100,99,True),
                                   ('missing-date',0,100,True)]:
    calls=daily(saved,today); assert bool(calls) == refresh, (name,calls)
    tests.append({'name':name,'passed':True,'initializerCalls':len(calls)})
for name,start,stop,offsets in [('weekday-buffer-reset',0x134dac0,0x134db45,[0xfc,0xec]),
                               ('recycle-buffer-reset',0x134dc10,0x134dc95,[0xdc,0xcc])]:
    tests.append({'name':name,'passed':True,**buffer_reset(start,stop,offsets)})
report={'exeSha256':hashlib.sha256(raw).hexdigest(),
        'scope':'Actual decision branches and reset prologues; synthetic date/object inputs. No purchase, serialization, UI or complete initialization test.',
        'tests':tests}
target=Path(__file__).resolve().parents[1]/'.work/native-daily-test.json'
target.parent.mkdir(exist_ok=True); target.write_text(json.dumps(report,indent=2),encoding='utf-8')
assert hashlib.sha256(args.exe.read_bytes()).hexdigest() == report['exeSha256']
print(json.dumps(report,indent=2))
