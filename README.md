# LET IT DIE Vending Machine Enhancement

v1.0.1 fixes executable rejection when package hash links change after applying verified
Tengoku/JG/M2G patches on the same build. Native code remains fingerprint-checked and
linked package files are validated. Full apply/restore and existing-script preservation
were tested on file copies; this does not guarantee compatibility in every install order.
Restore still refuses files changed by another tool after the vending patch.

[English](README.md) | [한국어](README.ko.md)

Kill Coin material bundles, decal equip/remove management and ammunition refills at vending machines.

## Requirements

- Steam offline edition of LET IT DIE on Windows.
- Node.js 22.5 or newer. No npm install is needed for normal use.
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
The selected language controls the installer and newly applied in-game decal/ammo labels. Translations keep string widths, script sizes and branch offsets unchanged; prices and purchase logic are unchanged. To change labels on an already patched game, restore the previous patch safely, then apply in the desired language. Do not bypass restore conflicts.

Backups use the visible sibling folder `let-it-die-vending-enhancement-backups`.
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
