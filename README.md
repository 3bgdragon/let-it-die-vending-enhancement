# LET IT DIE Vending Machine Enhancement

TFC edition: [separate download](https://github.com/3bgdragon/let-it-die-vending-enhancement/releases/tag/tfc-v1.2.0-rc.2). The repository's `tfc/` is isolated; it is NOT included in the standalone ZIP. Do not mix installation modes.

Compatibility candidate **1.1.2-rc.1**: [rules and test evidence](COMPATIBILITY-VALIDATION.md).

Compatibility candidate, 2026-10-04; reviewed Steam build 25386710. Actual Nico DB Mod Manager 0.10.1 and TFC Installer 2.5.6.0 engines were tested separately from S3er0i9ng Mod Manager 1.3.20. File-copy tests passed; this update has NOT been retested through the GUI or in live gameplay. Unknown/conflicting layouts remain blocked. External managers can still overwrite files from cached originals; detected preset loss requires selected-feature reinstallation, not an old whole-file restore.

## Experimental UPK editor-compatible layout

After applying your chosen mods, run `upk-compat.bat` (Node.js 22.13+).
For English: `upk-compat.bat --lang=en`. You can also pass the installation
folder or `BrgGame-Steam.exe` path in quotes. Confirm only with the game closed.

This optional conversion packs existing LZO chunks contiguously and updates
only their EXE digest links. It does not change compressed payloads, game logic,
save data or database contents. Before conversion it creates a full shared backup
under `GAME/LID-Mod-State`; keep this folder. Use versions of **all four tools**
containing this feature. Subsequent managed edits preserve the contiguous layout.

For exact pre-conversion restoration use `upk-compat.bat --restore`.
Restoration refuses later changes. Unknown edits made by an external UPK editor
are deliberately blocked, not silently discarded. Reading/exporting a package
does not imply support for arbitrary external writes or Nico's vanilla replacement.
Actual Nico/TFC engine read/apply and recovery tests passed on disposable copies.
GUI and gameplay retesting remain pending; this is a compatibility prerelease.
Nico file-check OFF is preserved. Recorded guard/M2G preset loss can be repaired
with `upk-compat.bat "<game folder>" --reapply=guard` or `--reapply=m2g`.
Unknown edits still stop. Do not use old whole-UPK backups to repair one feature.



## EXE validation and manual installation paths

The tool does not require an unchanged whole-file EXE hash for guard/M2G
package relinking: the old package hash entries must match the current UPK,
and only the owned links are rewritten. Package validation and full-backup
restore safeguards remain enabled.

The bundled vending native builder also supports a reviewed build-25386710
fallback using PE layout and native dependency bytes instead of a whole-file
EXE hash. Unrelated edits in that layout survive; hook/dependency conflicts,
changed sections, overlays and unknown structures are still rejected.

If discovery fails, interactive mode accepts the installation folder or
BrgGame-Steam.exe path, retries invalid paths, and lets Enter cancel.
Non-interactive CLI use requires a valid --game path. This is not a blanket
no-validation mode or a guarantee of compatibility with every EXE mod.

## Shared composition preview — 1.1.1-dev

Update **all four tools** together. Each ZIP bundles the same Node.js composition
kernel; no other checkout or Python is required. For build 25386710, vending is
validated and separated in a temporary copy, the requested warp/JG/M2G operation
runs there, and vending is recomposed before verified installation. Independent
changes are preserved, not overwritten with an old whole-file image. Unknown
code, damaged receipts and overlapping changes still stop safely.

Keep the visible **`LID-Mod-State` inside the game installation**. It contains
baselines, recipes, shared backups and deduplicated snapshots; replacing a tool
folder does not delete it. Old sibling backups are also retained. For an old
vending installation, close the game and use **option 8** to register a matching
old backup without modifying game files. Missing/different originals cannot be
guessed. Other tools discover matching sibling vending backups; the environment
variable `LID_VENDING_BACKUP_DIR` selects that folder explicitly.

**Option 2 removes vending only**, including its verified 106 material rows while
preserving other DB rows and mods. Options 1/5/6 change its feature set; identical
settings do nothing. **Option 9 restores a complete shared snapshot** and refuses
later changes. Selective removal is different from full restoration. Save files
and purchase/refill history are never rewritten or reset.

Keep all tools current; old tools do not participate in this protocol. File-copy
and failure-safety tests do not replace gameplay verification of the new paths.
Legacy build support remains, but vending composition targets build 25386710.

Historical v1.0.1 fixed executable rejection when package hash links changed after applying verified
Tengoku/JG/M2G patches on the same build. Native code remains fingerprint-checked and
linked package files are validated. Full apply/restore and existing-script preservation
were tested on file copies; this does not guarantee compatibility in every install order.
Full backup restore still refuses later file changes; current option 2 is selective removal instead.

[English](README.md) | [한국어](README.ko.md)

Kill Coin material bundles, decal equip/remove management and ammunition refills at vending machines.

## Requirements

- Steam offline edition of LET IT DIE on Windows.
- Node.js 22.13 or newer. No npm install is needed for normal use.
- Support is determined by file/schema checks, not just the displayed game version. Never bypass an unsupported-file error.

## Installation

1. Use **Code → Download ZIP**, then extract the archive.
2. Back up your save separately and close the game completely.
3. Run `run-en.bat` for English, or use `run.bat --lang ko` for Korean. If Windows denies Steam-folder write access, run the launcher as administrator.
4. Read confirmations carefully and keep every backup created by the tool.

Command-line entry: `node --no-warnings tool.js --lang en`.

## Language

Choose **한국어 / English** on first interactive launch, or use menu 7 to change it later.
`--lang en` and `--lang ko` explicitly select and remember a language.
The preference is stored in the visible sibling file `let-it-die-tool-settings.json`.
The selected language controls the installer and newly applied in-game decal/ammo labels. Translations keep string widths, script sizes and branch offsets unchanged; prices and purchase logic are unchanged. After registering an existing installation, apply in the desired language to rebuild its labels while preserving other mods. Do not bypass validation conflicts.

Legacy backups use the visible sibling folder `let-it-die-vending-enhancement-backups`; new shared snapshots use the game's `LID-Mod-State/backups`.
Keep it when replacing the tool. Existing internal backups are verified and copied on startup;
do this before deleting the old tool folder. Already-deleted backups cannot be recovered automatically.

## Important behavior

Supported baseline: Steam build 25386710. Changes EXE, masters.db and BrgGame.upk, not saves directly. Up to seven material types from 106 candidates, five per bundle, rarity-based prices. Initial stock checks both availability and purchase history. Ammo refills cost 20% of the weapon’s purchase price at its upgrade level, rounded up, paid from the safe; durability is unchanged.

## Backups and compatibility

Do not delete an older tool folder until its backups have been preserved. Backups are local files, not stored on GitHub. Restoring game files does not undo purchased items, spent currency or subsequent save changes. Compatibility with every other mod or installation order is not guaranteed.

## Translation status

The installer menus, confirmations and known patch/restore errors support both languages.
Unknown system diagnostics are passed through unchanged and logs retain the original diagnostics.
Injected decal management, ammo refill and confirmation labels have English variants. Static bytecode tests pass; English in-game layout still needs visual confirmation. Day-change restocking, persistence after restart and individual decal-management behavior still require separate gameplay verification; initial material stock/purchases and ammo refills were user-confirmed. Full history remains in the [Korean guide](README.ko.md). Translation does not add support for new game builds.

For support, include tool version, game build, exact error and relevant logs. Avoid publishing your entire save or unnecessary account identifiers.
