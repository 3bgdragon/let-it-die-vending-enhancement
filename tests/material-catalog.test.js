'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {DatabaseSync} = require('node:sqlite');
const {planMaterialCatalog} = require('../src/material-catalog');
function fixture(t) {
  const db = new DatabaseSync(':memory:'); t.after(()=>db.close());
  db.exec("CREATE TABLE master_item(itemid TEXT,itemtype TEXT,rarity INTEGER); CREATE TABLE master_automaticshop_lineup(goods_id INTEGER); INSERT INTO master_automaticshop_lineup VALUES(26698); INSERT INTO master_item VALUES('ITMT_ALUMI_1','ITTP_MATERIAL',1),('ITMT_ALUMI_8','ITTP_MATERIAL',8),('ITHEAL','ITTP_HEAL',1)");
  return db;
}
test('plan only material packs with rarity prices; database remains unchanged', t => {
  const db = fixture(t), rows = planMaterialCatalog(db);
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(x=>x.pack_money),[10000,125000]);
  assert.ok(rows.every(x=>x.stock===1 && x.pack_count===5 && x.lineup_id==='COMMON'));
  assert.equal(db.prepare('SELECT count(*) AS n FROM master_automaticshop_lineup').get().n,1);
});
test('fail closed on missing prices or goods-ID collision', t => {
  const db=fixture(t);
  assert.throws(()=>planMaterialCatalog(db,{'1':10000}),/price/);
  db.exec('INSERT INTO master_automaticshop_lineup VALUES(1900000000)');
  assert.throws(()=>planMaterialCatalog(db),/already in use/);
});
