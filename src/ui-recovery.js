'use strict';
// Recover ONLY byte-for-byte reviewed copies of this tool's own UI bridges.
// Unknown functions are left intact for the normal preflight to diagnose.
const owned=require('../shared/owned-functions');
function plan(source,{scopePreset=null}={}){
 const rows=owned.objects(source,'vending','BrgGame.upk').rows;
 const selected=scopePreset?rows.filter(row=>owned.owns(row.variants,scopePreset)):rows;
 const exact=row=>row.bytes.equals(row.variants[0].off)||row.variants.some(p=>row.bytes.equals(p.on));
 if(!selected.every(exact))return {output:source,functions:0,unknown:true};
 const applied=selected.filter(row=>!row.bytes.equals(row.variants[0].off));
 if(!applied.length)return {output:source,functions:0,unknown:false};
 const output=owned.set(source,'vending','BrgGame.upk','off',scopePreset?{scopePreset}:{});
 owned.verifyOthers(source,output,'vending','BrgGame.upk');
 if(!owned.set(output,'vending','BrgGame.upk','off',scopePreset?{scopePreset}:{}).equals(output))throw Error('Reviewed UI recovery did not yield an OFF baseline');
 return {output,functions:applied.length,unknown:false};
}
module.exports={plan};
