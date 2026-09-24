'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {inspectDatabase}=require('../src/inspect');
test('inspection returns schema and rows without changing DB bytes',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lid-vending-test-'));
  t.after(()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('lid-vending-test-'));fs.rmSync(dir,{recursive:true,force:true});});
  const file=path.join(dir,'fixture.db'),db=new DatabaseSync(file);
  db.exec('CREATE TABLE master_automaticshop_lineup(goods_id INTEGER); INSERT INTO master_automaticshop_lineup VALUES(1); CREATE TABLE master_automaticshop_schedule(expire INTEGER);');db.close();
  const before=fs.readFileSync(file),result=inspectDatabase(file);
  assert.equal(result.master_automaticshop_lineup.rows[0].goods_id,1);
  assert.deepEqual(fs.readFileSync(file),before);
});
