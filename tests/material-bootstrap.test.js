'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildMaterialBootstrap}=require('../src/material-bootstrap');
test('bootstrap wraps only the existing daily call and relocates with its code',()=>{
 for(const rva of [0x3000000,0x1004b000]){
  const b=buildMaterialBootstrap(rva);
  assert.equal(b.original[0],0xe8);assert.equal(b.hook[0],0xe8);
  assert.equal(b.hookRva+5+b.original.readInt32LE(1),0x134f050);
  assert.equal(b.hookRva+5+b.hook.readInt32LE(1),rva);
  assert.ok(b.scannerRva>rva&&b.scannerRva<rva+b.code.length);
  assert.equal(b.code.subarray(-18).toString('utf16le'),'COMMON\0,\0');
 }
});
test('bootstrap rejects invalid locations',()=>{
 for(const rva of [-1,NaN,Infinity,0x80000000,1.5])assert.throws(()=>buildMaterialBootstrap(rva),/RVA/);
});
