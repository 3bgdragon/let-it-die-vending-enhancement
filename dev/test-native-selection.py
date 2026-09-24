"""Execute the installed selector loop in isolation; never patch the game.

The query/shuffle and map insertion are outside this test's scope. Rows are
already ordered, output is preallocated, and candidate-map insertion is stubbed.
"""
import argparse, hashlib, json, struct, subprocess
from pathlib import Path
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_64, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_RSP, UC_X86_REG_RBP, UC_X86_REG_RBX, UC_X86_REG_RIP

parser = argparse.ArgumentParser()
parser.add_argument('exe', type=Path)
parser.add_argument('--experimental', action='store_true')
args = parser.parse_args()
raw = args.exe.read_bytes()
pe = pefile.PE(data=raw)
base = pe.OPTIONAL_HEADER.ImageBase
start, end = 0x1155c10, 0x1155cd8
code = pe.get_data(start, end-start)
# Refuse to execute a different layout at these build-specific addresses.
assert code[:4] == bytes.fromhex('4c8b7dbf')
assert pe.get_data(0x1155c47, 6) == bytes.fromhex('837840017553')
assert pe.get_data(0x1155cc1, 5) == bytes.fromhex('e85a50feff')
gate = None
if args.experimental:
    script = Path(__file__).resolve().parent/'export-material-gate.js'
    gate = json.loads(subprocess.check_output(['node', str(script)], text=True))
    assert pe.get_data(gate['hookRva'], 6).hex() == gate['original']

def run(rows, limit):
    uc = Uc(UC_ARCH_X86, UC_MODE_64)
    page = (base + start) & ~0xfff
    uc.mem_map(page, 0x1000)
    uc.mem_write(base + start, code)
    if gate:
        uc.mem_map((base+gate['caveRva']) & ~0xfff, 0x1000)
        uc.mem_write(base+gate['caveRva'], bytes.fromhex(gate['code']))
        uc.mem_write(base+gate['hookRva'], bytes.fromhex(gate['hook']))
    arena = 0x10000000
    uc.mem_map(arena, 0x10000)
    rsp = arena + 0x1000
    rbp = rsp + 0xb9  # original prologue: entrySP - 0x5f
    data, out, result = arena+0x3000, arena+0x7000, arena+0x8000
    def write(address, fmt, *values):
        uc.mem_write(address, struct.pack('<'+fmt, *values))
    write(rsp+0x20, 'i', limit)
    write(rsp+0x28, 'QII', data, len(rows), len(rows))
    write(rbp-0x41, 'Q', out)
    write(out, 'QII', result, 0, 128)
    for i, (goods_id, stable, weight) in enumerate(rows):
        write(data+i*0xbc+8, 'I', goods_id)
        write(data+i*0xbc+0x40, 'I', stable)
        write(data+i*0xbc+0x48, 'I', weight)
    uc.reg_write(UC_X86_REG_RSP, rsp)
    uc.reg_write(UC_X86_REG_RBP, rbp)
    uc.reg_write(UC_X86_REG_RBX, 0)
    candidates = []
    def hook(machine, address, size, _):
        if address == base+0x1155cc1:
            candidates.append(struct.unpack('<I', machine.mem_read(rsp+0x38, 4))[0])
            machine.reg_write(UC_X86_REG_RIP, address+5)
        elif machine.mem_read(address, 1) == b'\xe8':
            raise AssertionError('Unexpected native call (output allocation?): '+hex(address))
    uc.hook_add(UC_HOOK_CODE, hook)
    uc.emu_start(base+start, base+end, count=10000)
    assert uc.reg_read(UC_X86_REG_RIP) == base+end, 'loop did not finish'
    count = struct.unpack('<I', uc.mem_read(out+8, 4))[0]
    selected = list(struct.unpack('<'+'I'*count, uc.mem_read(result, count*4))) if count else []
    return {'selected': selected, 'candidateMap': candidates}

cases = [
    ('fixed-unlimited', [(i,1,0) for i in range(1,9)], -1, list(range(1,9)), []),
    ('fixed-limit-five', [(i,1,0) for i in range(1,9)], 5, list(range(1,6)), []),
    ('random-high-weight', [(i,0,1000000) for i in range(1,9)], -1, [], list(range(1,9))),
    ('mixed-preserves-fixed', [(1,1,0),(2,0,100),(3,1,0),(4,0,100)], -1, [1,3], [2,4]),
]
if gate:
    first, last = gate['firstId'], gate['endId']
    candidates = [(first+i,0,1) for i in range(10)]
    cases += [
        ('material-quota-seven', candidates, -1, list(range(first,first+7)), []),
        ('fixed-before-and-after-quota', [(1,1,0)]+candidates+[(2,1,0)], -1,
         [1]+list(range(first,first+7))+[2], []),
        ('fewer-materials', candidates[:3], -1, list(range(first,first+3)), []),
        ('reserved-boundaries', [(first-1,0,1),(first,0,1),(last-1,0,1),(last,0,1)],
         -1, [first,last-1], [first-1,last]),
        ('unrecognized-stable-value', [(first,2,1)], -1, [], [first]),
        ('reverse-candidate-order', list(reversed(candidates)), -1,
         list(range(first+9,first+2,-1)), []),
        ('mixed-other-shop-candidates', [(1,0,10)]+candidates+[(2,0,10)], -1,
         list(range(first,first+7)), [1,2]),
        ('no-rows', [], -1, [], []),
    ]
report = {'exeSha256': hashlib.sha256(raw).hexdigest(), 'loopRva': hex(start),
          'experimentalGate': bool(gate),
          'scope': 'selector loop only; query/shuffle/purchase/daily reset NOT tested', 'tests': []}
for name, rows, limit, expected, candidates in cases:
    actual = run(rows, limit)
    assert actual == {'selected': expected, 'candidateMap': candidates}, (name, actual)
    report['tests'].append({'name': name, 'passed': True, **actual})
target = Path(__file__).resolve().parents[1]/('.work/experimental-selection-test.json' if gate else '.work/native-selection-test.json')
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
