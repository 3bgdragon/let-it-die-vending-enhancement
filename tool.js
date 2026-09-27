'use strict';
const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
if(nodeMajor<22||(nodeMajor===22&&nodeMinor<5)){
  console.error('Node.js 22.5 이상이 필요합니다. / Node.js 22.5 or newer is required.');
  process.exit(1);
}
const fs=require('node:fs'),path=require('node:path');
const readline=require('node:readline/promises');
const {inspectGame}=require('./src/inspect');
const {apply,restore,listBackups,FILES}=require('./src/patcher');
const {prepareBackups}=require('./src/backup-location');
const {text:t,setLanguage,parseLanguage,savedLanguage,saveLanguage,errorText}=require('./src/language');
function reportError(error){
  console.error(t('오류: ','Error: ')+errorText(error.message));
  try{
    const logs=path.join(__dirname,'logs');fs.mkdirSync(logs,{recursive:true});
    const file=path.join(logs,'error-'+new Date().toISOString().replace(/[:.]/g,'-')+'.log');
    fs.writeFileSync(file,`Version: ${require('./package.json').version}\nNode: ${process.version}\n${error.stack||error}\n`);
    console.error(t('오류 로그: ','Error log: ')+file);
  }catch{console.error(t('오류 로그를 저장하지 못했습니다. 위 오류 내용을 복사해 주세요.','Could not save the error log. Copy the error shown above.'));}
}
async function main(){
  const parsed=parseLanguage(process.argv.slice(2)),args=parsed.args;
  setLanguage(parsed.language||savedLanguage(__dirname)||'ko');
  if(args.length===3&&args[0]==='inspect'&&args[1]==='--game'){
    console.log(JSON.stringify(inspectGame(args[2]),null,2));return;
  }
  if(args.length&&!(args.length===2&&args[0]==='--game'))throw new Error('Usage: node tool.js [--game "game folder"] [--lang ko|en]');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  try{
    if(parsed.language)saveLanguage(__dirname,parsed.language);
    else if(!savedLanguage(__dirname)&&process.stdin.isTTY){
      const choice=(await rl.question('Language / 언어: 1. 한국어  2. English [1]: ')).trim();
      if(!['','1','2'].includes(choice))throw new Error('Choose 1 or 2 / 1 또는 2를 선택하세요.');
      saveLanguage(__dirname,choice==='2'?'en':'ko');
    }
    const {root,copied}=prepareBackups(__dirname);
    if(copied.length)console.log(t('기존 백업 검증·복사 완료 (원본 유지): ','Existing backups verified and copied (originals kept): ')+copied.length);
    const defaultPath='C:/Program Files (x86)/Steam/steamapps/common/LET IT DIE';
    let game=args[1]||(fs.existsSync(path.join(defaultPath,FILES[0]))?defaultPath:await rl.question(t('게임 설치 폴더: ','Game installation folder: ')));
    game=path.resolve(game.trim().replace(/^"(.*)"$/,'$1'));
    for(const file of FILES)if(!fs.existsSync(path.join(game,file)))throw new Error(t('게임 파일을 찾지 못했습니다: ','Game file not found: ')+file);
    for(;;){
      console.log(t('\nLET IT DIE 자판기 강화 — v','\nLET IT DIE Vending Machine Enhancement — v')+require('./package.json').version);
      console.log(t('설치 폴더: ','Game folder: ')+game);
      console.log(t('백업 폴더 (삭제하지 마세요): ','Backup folder (do not delete): ')+root);
      console.log(t('재료 최초 입고 + 기존 일일 갱신 / 최대 7종 / 5개 묶음 / 희귀도별 가격','Initial material stock + existing daily refresh / up to 7 types / bundles of 5 / rarity-based prices'));
      console.log(t('첫 일반 요청에서 재료 이력이 없을 때 입고합니다. 재접속·재적용으로 품절을 초기화하지 않습니다.','Initial stock is added on a normal request if no material history exists. Reconnecting or reapplying does not reset sold-out stock.'));
      console.log(t('데칼 교체·탈착: 기존 버섯상점 관리·저장 처리 연결','Decal equip/remove: connects the existing mushroom-shop management and save flow'));
      console.log(t('탄약 충전: 한 자루 완충 / 해당 강화 단계 구입가의 20% / 내구도 유지','Ammo refill: fully refill one weapon / 20% of its upgrade-level purchase price / durability unchanged'));
      console.log(t('재료 입고·구매 / 탄약 충전: 사용자 확인. 날짜 변경·재접속 저장 유지는 별도 검증 필요.','Material stock/purchases and ammo refills: user confirmed. Day-change restocking and persistence after restart still need verification.'));
      console.log(t('EXE + MASTER DB + BrgGame.upk 변경. 세이브는 직접 수정하지 않습니다.','Modifies EXE + master DB + BrgGame.upk. Does not directly edit saves.'));
      console.log(t('1. 전체 적용 (자동 백업)\n2. 패치 제거 / 백업 복원\n3. 백업 목록\n4. 종료\n5. 재료 상점만\n6. 재료 + 데칼 (탄약 제외)\n7. 언어 변경 / Language','1. Apply all features (automatic backup)\n2. Remove patch / restore backup\n3. List backups\n4. Exit\n5. Materials only\n6. Materials + decals (no ammo)\n7. Language / 언어 변경'));
      const choice=(await rl.question(t('선택: ','Select: '))).trim();
      if(choice==='4'||choice==='')break;
      if(choice==='7'){const lang=(await rl.question('1. 한국어  2. English: ')).trim();if(['1','2'].includes(lang))saveLanguage(__dirname,lang==='2'?'en':'ko');continue;}
      if(choice==='3'){const backups=listBackups(root,game);if(!backups.length)console.log(t('이 게임 설치 경로의 백업이 없습니다: ','No backups for this game folder: ')+root);for(const x of backups)console.log(x.manifest.status+' '+x.folder);continue;}
      if(!['1','2','5','6'].includes(choice))continue;
      console.log(t('중복 적용하지 마세요. 변경 버전 재적용은 먼저 2번으로 복원하세요.','Do not apply twice. Restore with option 2 before applying a changed patch version.'));
      console.log(t('alpha.3·alpha.4는 재적용 불필요. 다른 도구가 파일을 변경했다면 복원을 중단합니다.','alpha.3/alpha.4 need no reapplication. Restore refuses files changed by another tool.'));
      console.log(t('세이브를 별도 백업하세요. 파일 복원은 구매·데칼·충전 결과를 되돌리지 않습니다.','Back up your save separately. File restore does not undo purchases, decal changes or ammo refills.'));
      if(!/^y$/i.test((await rl.question(t('게임 종료 후 진행하세요. 동의합니까? (y/N): ','Close the game completely. Proceed? (y/N): '))).trim()))continue;
      try{console.log(choice!=='2'?apply(game,root,{decals:['1','6'].includes(choice),ammo:choice==='1'}):t('복원 완료: ','Restored: ')+restore(game,root));}
      catch(error){reportError(error);}
    }
  }finally{rl.close();}
}
main().catch(e=>{reportError(e);process.exitCode=1;});
