'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const {expectedMaterialCatalog}=require('../src/material-catalog'),state=require('../src/material-state');
function fixture(t){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec("CREATE TABLE master_item(itemid TEXT,itemtype TEXT,rarity INTEGER); INSERT INTO master_item VALUES('ITMT_ALUMI_1','ITTP_MATERIAL',1),('ITMT_ALUMI_8','ITTP_MATERIAL',8); CREATE TABLE other_mod_data(value TEXT); INSERT INTO other_mod_data VALUES('preserve me')");
 const recorded=expectedMaterialCatalog(db),keys=Object.keys(recorded[0]);
 db.exec('CREATE TABLE master_automaticshop_lineup ('+keys.map(k=>k+(typeof recorded[0][k]==='string'?' TEXT':' INTEGER')+(k==='goods_id'?' PRIMARY KEY':'')).join(',')+')');
 const insert=db.prepare('INSERT INTO master_automaticshop_lineup ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')');
 for(const row of [...recorded,{...recorded[0],goods_id:42,lineup_id:'OTHER'}])insert.run(...keys.map(k=>row[k]));
 return {db,recorded};
}
const snapshot=db=>JSON.stringify({catalog:db.prepare('SELECT * FROM master_automaticshop_lineup ORDER BY goods_id').all(),other:db.prepare('SELECT * FROM other_mod_data').all()});
test('complete live catalog, not the receipt count, permits no-op',t=>{
 const {db,recorded}=fixture(t),before=snapshot(db),r=state.inspect(db,recorded);assert.equal(r.rows,2);assert.equal(r.missing.length,0);assert.equal(snapshot(db),before);
});
for(const all of [false,true])test('repair '+(all?'all missing rows':'one missing row')+' without changing other mods',t=>{
 const {db,recorded}=fixture(t),before=snapshot(db);db.exec('DELETE FROM master_automaticshop_lineup WHERE goods_id'+(all?'>=1900000000':'=1900000000'));
 assert.equal(state.inspect(db,recorded).missing.length,all?2:1);assert.equal(state.repair(db,recorded).repaired,all?2:1);assert.equal(snapshot(db),before);assert.equal(state.repair(db,recorded).repaired,0);
});
for(const [column,value] of [['pack_money','1'],['pack_count','1'],['currency_type','3'],['type_id',"'ITMT_OTHER'"],['stock','7']])test('modified '+column+' is rejected without overwriting',t=>{
 const {db,recorded}=fixture(t);db.exec('UPDATE master_automaticshop_lineup SET '+column+'='+value+' WHERE goods_id=1900000000');const before=snapshot(db);
 assert.throws(()=>state.inspect(db,recorded),new RegExp(column));assert.throws(()=>state.repair(db,recorded),new RegExp(column));assert.equal(snapshot(db),before);
});
test('unrecognized reserved ID blocks repair, even if another row is missing',t=>{
 const {db,recorded}=fixture(t);db.exec('UPDATE master_automaticshop_lineup SET goods_id=1900000500 WHERE goods_id=1900000000');const before=snapshot(db);assert.throws(()=>state.repair(db,recorded),/ID/);assert.equal(snapshot(db),before);
});
for(const kind of ['duplicate','count','field','price','type'])test('invalid receipt '+kind+' is rejected',t=>{
 const {db,recorded}=fixture(t),bad=structuredClone(recorded),before=snapshot(db);
 if(kind==='duplicate')bad[1]=bad[0];if(kind==='count')bad.pop();if(kind==='field')delete bad[0].pack_count;if(kind==='price')bad[0].pack_money=-1;if(kind==='type')bad[0].type_id='ITMT_FOREIGN';
 assert.throws(()=>state.repair(db,bad),/기록|receipt|catalog/);assert.equal(snapshot(db),before);
});
test('previously recorded custom prices are preserved, not replaced with defaults',t=>{
 const {db,recorded}=fixture(t);recorded[0].pack_money=12345;db.exec('DELETE FROM master_automaticshop_lineup WHERE goods_id=1900000000');assert.equal(state.repair(db,recorded).repaired,1);assert.equal(db.prepare('SELECT pack_money FROM master_automaticshop_lineup WHERE goods_id=1900000000').get().pack_money,12345);
});
test('incompatible material definitions stop repair',t=>{
 const {db,recorded}=fixture(t),before=snapshot(db);db.exec("UPDATE master_item SET itemid='ITMT_NEW' WHERE itemid='ITMT_ALUMI_1'");assert.throws(()=>state.repair(db,recorded),/기록|receipt/);assert.equal(snapshot(db),before);
});
test('failed insertion rolls back all earlier repair insertions',t=>{
 const {db,recorded}=fixture(t);db.exec("DELETE FROM master_automaticshop_lineup WHERE goods_id>=1900000000; CREATE TRIGGER reject_material BEFORE INSERT ON master_automaticshop_lineup WHEN NEW.goods_id=1900000001 BEGIN SELECT RAISE(ABORT,'injected repair failure'); END");const before=snapshot(db);assert.throws(()=>state.repair(db,recorded),/injected repair failure/);assert.equal(snapshot(db),before);
});
