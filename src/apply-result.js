'use strict';
const {text:t}=require('./language');
function format(result){
 const lines=[result.changed?t('적용 및 파일 검증 완료. 재료 상품: ','Applied and file-verified. Material catalog entries: ')+result.rows:t('이미 적용된 설정입니다. EXE·UPK와 실제 재료 상품을 검증했습니다: ','Already applied. EXE/UPK and actual material catalog verified: ')+result.rows];
 if(result.repairedMaterials)lines.push(t('누락 재료 상품 복구: ','Missing material entries restored: ')+result.repairedMaterials);
 if(result.recoveredUiFunctions)lines.push(t('검증된 기존 자판기 UI 연결 재구성: ','Rebuilt reviewed old vending UI bridges: ')+result.recoveredUiFunctions);
 lines.push(t('선택 기능: 재료 ON / 데칼 ','Selected features: materials ON / decals ')+(result.decals?'ON':'OFF')+t(' / 탄약 ',' / ammo ')+(result.ammo?'ON':'OFF'));
 if(result.decals===false&&!result.ammo)lines.push(t('재료 단독은 기존 UI를 변경하지 않습니다. 위 OFF는 이번 설정에서 UI를 적용하지 않았다는 뜻입니다.','Materials-only leaves existing UI untouched. OFF above means this layer did not enable that UI.'));
 if(result.ammo&&!result.decals)lines.push(t('탄약 전용 구성: 데칼 관리 함수는 변경하지 않았습니다. 데칼 교체 메뉴는 추가하지 않습니다.','Ammo-only UI: decal management functions are unchanged; no decal management entry is added.'));
 if(result.backup)lines.push(t('새 변경 전 백업 생성: ','New pre-change backup created: ')+result.backup);
 else{
  lines.push(t('파일 변경이 없어 새 백업을 만들지 않았습니다.','No files changed; no new backup was created.'));
  const count=Number.isInteger(result.existingBackups)?result.existingBackups:0;
  if(count===0)lines.push(t('주의: 기존 자판기 백업 기록이 없습니다. 현재 설치 확인은 원본 백업을 복구하지 않습니다.','Warning: no existing vending backup records were found. Verifying the current installation does not recover missing original backups.'));
  else lines.push(t('기존 자판기 백업 기록: ','Existing vending backup records: ')+count);
 }
 lines.push(t('공통 백업 위치: ','Shared backup location: ')+result.backupDirectory);
 lines.push(t('게임 내 구매·충전·일일 재입고 결과는 게임에서 확인하세요.','Verify purchases, refills and daily restocking in the game.'));
 return lines.join('\n');
}
module.exports={format};
