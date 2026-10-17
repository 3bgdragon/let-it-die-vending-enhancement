# Standalone UI recovery — 1.1.6-rc.1

Scope: vending repository only. The other three mod repositories and this
repository's separate `tfc/` distribution are unchanged. No live game or save
was written. Patch plans, native hooks, material prices and daily stock logic
are unchanged.

## Evidence boundary

The report names `BrgUIMenu_SkillExchange.Tick` and the old installer's size
check. It does not include the actual function size, digest or bytes. We do
NOT know which mod changed that user's function or whether it is one of the
reviewed bridge fragments. This update is not a general bytecode merger and
does not certify the reporter's installation or in-game behavior.

## Supported recovery

- Every vending UI function must be an exact reviewed stock or bridge body.
  Unknown bytes make normalization ineligible. Exact prior bridge fragments
  are normalized only in a private transaction image, then rebuilt using the
  existing selected preset. No unrelated functions are reset.
- The shared backup stores the real pre-operation six-file image, including
  the actual partial UI. A removable owned baseline is separate from that
  backup; it is not presented as a recovered pristine whole-game package.
- An existing receipt that owns decals still rejects externally lost or
  conflicting UI. This recovery does not bypass receipt/baseline integrity,
  native preconditions, TFC-mode markers, locks or file-change checks.
- An explicitly selected material-only operation owns no UI bridge and may
  preserve an unchanged unknown UI body exactly. It does not enable decals or
  ammo, and a failed full-feature request never silently becomes material-only.

## Diagnostics

`LID_VENDING_UI_CONFLICT` distinguishes size/hash mismatches. Errors include
actual/expected size, SHA-256 and script sizes. The automatic JSON keeps failed
staging-image evidence separate from current installed evidence, including
the selected game folder, tool location and requested features.

`node tool.js diagnose --game "GAME"` is read-only with respect to game files.
It saves bounded UI bytecode, game/tool paths and package fingerprints to
`logs/diagnostic-*.json`. No saves, database rows, credentials or whole game
files are included. Paths are included and should be reviewed before sharing.
Even an invalid package retains its size/hash and an explicit inspection error.

## Checks run

- Full repository regression run with build 25767944 file copies and previous
  standalone v1.1.5-rc.1: 186 passed, 0 failed, 21 optional fixture cases skipped.
  This includes the existing material-repair and cross-mod preservation suite.
- Additional OFF-check-layout run: 25 passed, 0 failed, 0 skipped. It includes
  two subsequently added bilingual output tests; overlapping tests are NOT
  summed into a unique total.
- Latest diagnostic/output unit run: 15 passed, 0 failed. The actual read-only
  diagnose command also generated a JSON from the untouched private fixture.

The new integration scenarios cover refusal without writes/backups; bounded
evidence; materials-only install/reapply; refusal to silently downgrade a full
request; an unrelated UPK edit/rebase; selective removal; exact old partial UI
recovery with M2G retained; complete unmanaged English UI recovery; rejection
of a subsequently lost recorded bridge; and exact pre-operation snapshot
restoration. Reviewed EXE checksum OFF names remain OFF throughout the second
run. These are file-copy tests, not an installation of the reporter's HUD mod
or a new gameplay pass.
