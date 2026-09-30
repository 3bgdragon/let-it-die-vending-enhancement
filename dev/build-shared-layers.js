'use strict';
// Mechanical release bundle. All peers get identical code and verified recipes.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=['executable','executable-links','material-selector','material-bootstrap','decal-package','package-codec','game-language','language'];
const peers=['lid-vending-enhancement','lid-tengoku-warp-tool','lid-justguard-tool','lid-m2g-knife-only'];
for(const peer of peers){
 const dest=path.join(root,'..',peer,'shared');
 const copy=(from,to)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);};
 if(peer!=='lid-vending-enhancement')copy(path.join(root,'shared/layers.js'),path.join(dest,'layers.js'));
 if(peer!=='lid-vending-enhancement')copy(path.join(root,'shared/README.md'),path.join(dest,'README.md'));
 if(peer!=='lid-vending-enhancement')copy(path.join(root,'tests/shared-layers.test.js'),path.join(dest,'../tests/shared-layers.test.js'));
 for(const name of src)copy(path.join(root,'src',name+'.js'),path.join(dest,'kernel/src',name+'.js'));
 for(const name of ['decal-build25386710.json','vending-build25386710.json'])copy(path.join(root,'patches',name),path.join(dest,'kernel/patches',name));
 copy(path.join(root,'vendor/lzo1x/dist/index.cjs'),path.join(dest,'kernel/vendor/lzo1x/dist/index.cjs'));
 copy(path.join(root,'vendor/lzo1x/LICENSE'),path.join(dest,'kernel/vendor/lzo1x/LICENSE'));
 for(const name of ['package-patch-LICENSE','lzo1x-LICENSE'])if(fs.existsSync(path.join(root,'vendor',name)))copy(path.join(root,'vendor',name),path.join(dest,'kernel/vendor',name));
}
console.log('Bundled shared layer protocol into all four repositories.');
