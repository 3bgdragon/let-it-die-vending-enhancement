# Exact reported Tick compatibility — 1.1.8-rc.1

Date: 2026-10-18 (Asia/Seoul). Standalone vending only. No live game or save
writes. The separate TFC runtime and the other three repositories are unchanged.

## Supplied evidence

The user supplied a 1.1.7 diagnostic JSON and matching error log. Both identify
function export 91837 (`BrgUIMenu_SkillExchange.Tick`) with SHA-256
`66b852e2ae52e47b299069bc4296050887040264dac6758c0557f4db08011223`.
Its installed-function bytes equal the failed-staging bytes in the JSON. Size
is 11,582; script disk size 11,519; runtime size 15,867. The other ten inspected
vending UI functions match reviewed stock exactly. Both standalone/TFC state
markers are absent in that diagnostic. This is observed function evidence, not
the user's full package, executable, database or gameplay recording.

Stock Tick is 11,209 bytes (disk 11,146/runtime 15,362). The supplied function
has 15 small same-size change hunks (including the two script-size fields) and
373 appended code bytes before EndOfScript, for 505 extra runtime bytes. Several
earlier instruction blocks branch to the appended code. The remaining bytes
and function tail are preserved. No responsible mod/author is inferred merely
from its filename or the list of installed mods.

Only the compact reviewed delta and relocation evidence are distributed; no
reporter log, private path, whole package or save is bundled. The runtime is
still Node.js only and has no decompiler/.NET dependency.

## Composition and inverse

The existing vending bridge inserts 87 disk/107 runtime bytes at disk 265,
runtime 373. This precedes the external edit sites. An independent UE decoder
identified 313 absolute branch operands in the reported function. The reviewed
plan relocates their targets while retaining every non-branch external byte.
The exact reported input is required; unknown same-size variations still fail.

Merged Tick: size 11,669, disk 11,606, runtime 15,974, SHA-256
`74463abc05e3cfc31e5766878d9b53b11e3ccb3a423f8c27b102ecc185b15d99`.
Removing the vending insertion and reversing its branch relocation returns the
supplied function byte-for-byte. Ownership OFF means this foreign base, not
permission to reset it to vanilla. Partial/unmanaged reviewed ON fragments may
be normalized to that foreign OFF baseline; unknown fragments remain blocked.

## Independent decoder boundary

Eliot.UELib 1.13.0.0, SHA-256
`64ebfa8b290429b9d5b5e81f5018734c03ded27bb814c69b904cc269268f7bbc`,
was identified by REA managed metadata (Evidence
`ev_e63bda218a68f5b19f4bb1de95c46ad4c47f06dc1b5f8fdf6f7f61a9b78df3b9`).
An analyst-built local driver separately ran its token decoder on logical
packages using known stock tables and the exact supplied function. These are
derived private test packages, not the reporter's full UPK.

The reported body decodes to 3,105 tokens, the merged body to 3,137. Every
original token keeps its type and correctly shifted disk/runtime coordinate;
all 316 merged branch targets land on decoded token boundaries. EndOfScript
agrees with both size fields. No unknown/unresolved tokens were observed.

The high-level text formatter cannot reconstruct some nesting in the existing
external goto layout. That formatter limitation is not treated as proof of a
game crash or of valid gameplay. Validation uses complete token coordinates,
operand readbacks and byte inverses rather than claiming clean source recovery.

## Checks

- Exact diagnostic input/staging equality, reviewed delta reconstruction and
  merged hash checked.
- Unit checks: 23 passed, 0 failed, including nearby unknown edits, corrupted
  ON images and normal ownership/diagnostic safeguards.
- Full root + unchanged TFC regression: **219 passed, 0 failed, 21 optional
  cases skipped**. This run includes the exact diagnostic Tick, the old 1.1.7
  rejection and the first nine installation-lifecycle scenarios.
- Extended latest exact-input lifecycle: **12 passed, 0 failed, 0 skipped**
  (parent + 11 scenarios), adding unmanaged compatible ON recovery and compacted
  package repeat/removal to the same lifecycle. Overlapping runs are not summed
  as unique tests.
- Root/kernel helper, evidence and installer copies match; syntax and git diff
  whitespace checks pass. Other mod repositories and TFC files are unchanged.

Live reporter-environment and in-game testing remains necessary even after file
tests pass. Existing mod instructions are preserved; older sibling tools may
safely refuse recipes their bundled runtime does not understand. Do not delete
receipts or backups to bypass that refusal.
