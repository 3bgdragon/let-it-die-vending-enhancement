'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
function inspectDatabase(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = ['master_automaticshop_lineup', 'master_automaticshop_schedule'];
    return Object.fromEntries(tables.map(table => [table, {
      columns: db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name),
      rows: db.prepare(`SELECT * FROM ${table}`).all(),
    }]));
  } finally { db.close(); }
}
function inspectGame(directory) {
  const relative = ['Binaries/Win64/BrgGame-Steam.exe', 'BrgGame/CookedPCConsole/BrgGame.upk', 'BrgGame/Content/masters.db'];
  const files = relative.map(name => {
    const file = path.join(directory, name);
    const bytes = fs.readFileSync(file);
    return { name, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  return { game: path.resolve(directory), mode: 'read-only-investigation',
    features: { dailyKillcoinMaterials: 'experimental-installer-available; installed-state-not-inferred', decalEquipRemove: 'experimental-installer-available; gameplay-not-verified; installed-state-not-inferred', ammoRefill: 'experimental-installer-available; purchase-price-divided-by-five; gameplay-not-verified; installed-state-not-inferred' },
    files, shop: inspectDatabase(path.join(directory, relative[2])) };
}
module.exports = { inspectDatabase, inspectGame };
