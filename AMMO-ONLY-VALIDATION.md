# Independent ammo UI — 1.1.7-rc.1 RC

Date: 2026-10-18 (Asia/Seoul). Scope: standalone vending only. TFC and the
other three mod repositories are unchanged. No live game or save was written.

## Report and evidence boundary

The report identifies SkillExchange.Tick export 91837, size 11582, SHA-256
66b852e2ae52e47b299069bc4296050887040264dac6758c0557f4db08011223.
No actual function body/diagnostic JSON was supplied. A bounded local scan of
138 retained BrgGame.upk paths found 137 parseable packages: 47 carried the
reviewed 11296-byte bridge, 90 carried the 11209-byte stock function; one was
not a supported LZO package. No matching reporter hash was found in this set.
This does not identify the responsible mod or cover every possible package.

## Change

Option 10 explicitly installs materials + ammo without a decal entry. Its six
functions are three ItemVendingMachine functions and three ShopBase functions.
The three SkillExchange bodies and unused vending Tick/Render bodies remain
byte-exact, even when they cannot be recognized. Only unselected function
bodies receive this preservation allowance; required ammo instructions retain
the existing hash, export-identity, branch, transition and package-link checks.

Option 1 still requests all features and stops on unknown decal instructions.
It is never silently downgraded. Full decal compatibility is NOT fixed or
certified without the actual changed function. Ammo pricing, safe-money payment,
save/retry handling and daily-stock logic are unchanged. A new receipt can
express ammo=true/decals=false; older tools may safely refuse this configuration.
Use the updated vending tool to remove its layer, rather than deleting receipts.

## Final checks

Full root + TFC regression, using build 25767944 disposable file copies:
**204 passed, 0 failed, 21 optional cases skipped**. The reference installers
are released 1.1.5 for the old UI-fragment case and released 1.1.6 for the new
ammo/decal coupling case. Earlier verification failures from the wrong reference
version and stale error-message assertions were corrected before this final run.

The controlled opaque fixture has the reported 11582-byte length but NOT the
reporter's SHA-256 and is not presented as a gameplay-valid reproduction. Tests
prove byte-preservation and refusal behavior, not the meaning of its code:

- old 1.1.6 refuses that resized Tick; option 10 installs and creates a backup;
- all five unselected functions, existing M2G and checked package links persist;
- identical reapply is a no-op; missing material rows repair without UI writes;
- Korean/English switching and the existing payment/cancel/save VM suite pass;
- original branches before insertion points stay unchanged; shifted branches,
  insertion memory sizes and typed context skips are checked;
- unknown decal code still blocks an explicit all-feature request without writes;
- loss of an owned ammo function remains blocked;
- older sibling tooling refuses the new configuration without overwriting files;
- selective removal restores the five non-DB files exactly and all database
  schema/rows semantically (SQLite physical page bytes may differ);
- full snapshot restore is exact for all six pre-operation files;
- compacted packages plus a later independent drop edit rebase and selectively
  remove without resetting opaque decal code or that drop edit.

Korean/English ammo-only VM suites execute 11 cases each inside the regression
tests. Overlapping/nested tests are not summed as an additional unique total.
Root/kernel UI modules match, syntax and git diff whitespace checks pass.
Reporter-environment and in-game operation of this new option remain unverified.
