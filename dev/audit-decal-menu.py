"""Read-only menu function inventory from the audited logical package snapshot."""
import importlib.util,json,sys,struct,hashlib
from pathlib import Path
repo=Path(__file__).resolve().parents[1];ws=repo.parent;sys.path.insert(0,str(ws))
from ue3_inspect import Package
spec=importlib.util.spec_from_file_location('ik',ws/'lid-tengoku-warp-tool/.integration-temp/inspect-kismet.py')
ik=importlib.util.module_from_spec(spec);spec.loader.exec_module(ik)
p=Package(ws/'lid-justguard-tool/.integration-temp/build25386710/groggy-new.logical.upk');p.exports=ik.read_variable_exports(p)
selected={}
children={}
for i,e in enumerate(p.exports,1):
 children.setdefault(e.outer,[]).append({'index':i,'name':p.object_path(i),'class':p.object_name(e.class_index)})
targets={p.object_path(i):i for i,e in enumerate(p.exports,1) if p.object_path(i) in ['BrgUIMenu_SkillPut','BrgUIMenu_SkillSetup']}
callers=[]
for idx,e in enumerate(p.exports,1):
 if p.object_name(e.class_index)!='Function':continue
 name=p.object_path(idx)
 data=p.data[e.serial_offset:e.serial_offset+e.serial_size]
 hits=[n for n,i in targets.items() if b'\x20'+struct.pack('<i',i) in data[0x30:]]
 if hits:callers.append({'function':name,'objectConstants':hits})
 if not (hits or name.startswith(('BrgUIMenu_ItemVendingMachine.','BrgUIMenu_SkillExchange.','BrgUIMenu_SkillSetup.','BrgUIMenu_SkillSetup_Menu.','BrgUIMenu_SkillEquip.','BrgUIMenu_SkillPut.','BrgUIMenu_SkillShop.','BrgUIMenu_ShopSkill.','BrgUIManager.','BrgUIMenu_ShopBase.','BrgUIMenu_PartShop.','BrgUIMenuPart_ItemSelect.','BrgUIMenuPart_ItemMiniPanel.','BrgCommonPawn_CustomChara.','BrgPawn_CustomCharaPlayer.'))):continue
 mem,size=struct.unpack_from('<II',data,0x28);code=data[0x30:0x30+size]
 refs=[]
 for at in range(max(0,len(code)-8)):
  if code[at] in [0x1b,0x43]:
   n,num=struct.unpack_from('<II',code,at+1)
   if n<len(p.names) and num==0:refs.append({'offset':at,('candidateVirtualCall' if code[at]==0x1b else 'candidateDelegate'):p.names[n]})
  elif code[at] in [0x1c,0x20]:
   n=struct.unpack_from('<i',code,at+1)[0]
   if n and -len(p.imports)<=n<=len(p.exports):
    target=p.object_path(n)
    if any(s in target for s in ['Skill','Menu','Vending']):refs.append({'offset':at,'candidateObject':target})
 selected[name]={'export':idx,'offset':e.serial_offset,'size':e.serial_size,'scriptSize':size,'scriptMemory':mem,'sha256':hashlib.sha256(data).hexdigest(),'children':children.get(idx,[]),'candidateReferences':refs,'hex':code.hex()}
out=repo/'.work/decal-menu-audit.json';out.write_text(json.dumps(selected,indent=2),encoding='utf8')
(repo/'.work/decal-menu-callers.json').write_text(json.dumps(callers,indent=2),encoding='utf8')
(repo/'.work/package-symbols.json').write_text(json.dumps({'names':p.names,'objects':{p.object_path(i):i for i in list(range(1,len(p.exports)+1))+list(range(-len(p.imports),0))}}),encoding='utf8')
for name,v in selected.items():
 print(name,'bytes',v['scriptSize'])
 for r in v['candidateReferences']:print(' ',r)
