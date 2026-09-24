"""Developer-only symbol inventory from a previously decompressed package."""
import importlib.util,json,sys
from pathlib import Path
repo=Path(__file__).resolve().parents[1]; workspace=repo.parent
sys.path.insert(0,str(workspace))
from ue3_inspect import Package
spec=importlib.util.spec_from_file_location('ik',workspace/'lid-tengoku-warp-tool/.integration-temp/inspect-kismet.py')
ik=importlib.util.module_from_spec(spec);spec.loader.exec_module(ik)
p=Package(workspace/'lid-justguard-tool/.integration-temp/build25386710/groggy-new.logical.upk')
p.exports=ik.read_variable_exports(p)
groups={'vending':[],'decals':[],'ammo':[]}
for i,e in enumerate(p.exports,1):
 if p.object_name(e.class_index)!='Function':continue
 name=p.object_path(i); low=name.lower()
 if 'automaticshop' in low or 'vendingshop' in low or 'vendingmachine' in low:groups['vending'].append(name)
 if any(x in low for x in ['skillshop','mushroomshop','skillset','skillremove','setskill','removeskill','skillchange','changeskill']):groups['decals'].append(name)
 if any(x in low for x in ['setbullet','recoverbullet','supplybullet','addbullet','maxbullet','chargeammo','refill']):groups['ammo'].append(name)
out=repo/'.work';out.mkdir(exist_ok=True)
(out/'entrypoints.json').write_text(json.dumps(groups,indent=2),encoding='utf-8')
for k,v in groups.items():
 print(k,len(v))
 for name in v[:65]:print(' ',name)
