'use strict';
// Validate the live catalog before accepting a receipt; only absent owned rows
// may be repaired. Modified/colliding rows are never overwritten.
const {expectedMaterialCatalog}=require('./material-catalog');
const {FIRST_ID,END_ID}=require('./material-selector');
const {text:t}=require('./language');
function inspect(db,recorded){
 if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error(t('재료 상점 DB 무결성 검사 실패','Material-shop database integrity check failed'));
 const expected=expectedMaterialCatalog(db),keys=Object.keys(expected[0]).sort();
 if(!Array.isArray(recorded)||recorded.length!==expected.length)throw Error(t('재료 상품 기록과 현재 DB의 재료 목록이 다릅니다. 자동으로 덮어쓰지 않습니다.','Recorded material catalog differs from the current database. Nothing overwritten.'));
 const map=new Map();
 for(const row of recorded){
  const canonical=expected.find(r=>r.goods_id===row?.goods_id);
  if(!canonical||map.has(row.goods_id)||Object.keys(row).sort().join('|')!==keys.join('|')||keys.some(k=>k==='pack_money'?!Number.isInteger(row[k])||row[k]<=0||row[k]>2147483647:row[k]!==canonical[k]))throw Error(t('재료 상품 기록이 손상되었거나 현재 DB와 호환되지 않습니다.','Material catalog receipt is damaged or incompatible with the current database.'));
  map.set(row.goods_id,row);
 }
 const rows=db.prepare('SELECT * FROM master_automaticshop_lineup WHERE goods_id>=? AND goods_id<? ORDER BY goods_id').all(FIRST_ID,END_ID),seen=new Set();
 for(const row of rows){
  const original=map.get(row.goods_id);
  if(!original||seen.has(row.goods_id))throw Error(t('재료 상점 예약 상품 ID 충돌: ','Reserved material goods ID conflict: ')+row.goods_id);
  seen.add(row.goods_id);
  const changed=keys.find(k=>row[k]!==original[k]);
  if(changed)throw Error(t('재료 상품이 다른 도구나 설정에 의해 변경되었습니다. 덮어쓰지 않습니다: ','Material row was modified by another tool or setting. Refusing to overwrite: ')+row.goods_id+' / '+changed);
 }
 return {rows:rows.length,expected:expected.length,missing:recorded.filter(r=>!seen.has(r.goods_id))};
}
function repair(db,recorded){
 db.exec('BEGIN IMMEDIATE');
 try{
  const before=inspect(db,recorded),keys=Object.keys(recorded[0]),insert=db.prepare('INSERT INTO master_automaticshop_lineup ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')');
  for(const row of before.missing)if(Number(insert.run(...keys.map(k=>row[k])).changes)!==1)throw Error(t('누락 재료 상품 복구 실패','Missing material row repair failed'));
  const after=inspect(db,recorded);
  if(after.missing.length)throw Error(t('재료 상품 복구 후 검증 실패','Material catalog verification failed after repair'));
  db.exec('COMMIT');return {rows:after.rows,repaired:before.missing.length};
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
}
module.exports={inspect,repair};
