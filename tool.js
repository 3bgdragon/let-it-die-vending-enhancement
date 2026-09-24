'use strict';
const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
if(nodeMajor<22||(nodeMajor===22&&nodeMinor<5)){
  console.error('Node.js 22.5 이상이 필요합니다. Node.js를 업데이트한 뒤 다시 실행하세요.');
  process.exit(1);
}
const fs=require('node:fs'),path=require('node:path');
const readline=require('node:readline/promises');
const {inspectGame}=require('./src/inspect');
const {apply,restore,listBackups,FILES}=require('./src/patcher');
const {prepareBackups}=require('./src/backup-location');
function reportError(error){
  console.error('오류: '+error.message);
  try{
    const logs=path.join(__dirname,'logs');fs.mkdirSync(logs,{recursive:true});
    const file=path.join(logs,'error-'+new Date().toISOString().replace(/[:.]/g,'-')+'.log');
    fs.writeFileSync(file,`Version: ${require('./package.json').version}\nNode: ${process.version}\n${error.stack||error}\n`);
    console.error('오류 로그: '+file);
  }catch{console.error('오류 로그를 저장하지 못했습니다. 위 오류 내용을 복사해 주세요.');}
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length===3&&args[0]==='inspect'&&args[1]==='--game'){
    console.log(JSON.stringify(inspectGame(args[2]),null,2));return;
  }
  if(args.length&&!(args.length===2&&args[0]==='--game'))throw new Error('사용법: node tool.js [--game "설치 폴더"]');
  const {root,copied}=prepareBackups(__dirname);
  if(copied.length)console.log('기존 백업 '+copied.length+'개를 툴 옆 백업 폴더에 검증 후 복사했습니다. 기존 백업도 보존했습니다.');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  try{
    const defaultPath='C:/Program Files (x86)/Steam/steamapps/common/LET IT DIE';
    let game=args[1]||(fs.existsSync(path.join(defaultPath,FILES[0]))?defaultPath:await rl.question('게임 설치 폴더: '));
    game=path.resolve(game.trim().replace(/^"(.*)"$/,'$1'));
    for(const file of FILES)if(!fs.existsSync(path.join(game,file)))throw new Error('게임 파일을 찾지 못했습니다: '+file);
    for(;;){
      console.log('\nLET IT DIE 자판기 강화 — v'+require('./package.json').version);
      console.log('설치 폴더: '+game);
      console.log('백업 폴더: '+root+' (툴 폴더를 삭제해도 유지 — 이 백업 폴더는 삭제하지 마세요)');
      console.log('재료 최초 입고 + 기존 일일 갱신 / 최대 7종 / 5개 묶음 / 희귀도별 가격');
      console.log('첫 실행의 일반 요청 처리 시 재료 이력이 없으면 입고합니다. 재접속·재적용으로 품절을 초기화하지 않습니다.');
      console.log('데칼 교체·탈착: 기존 버섯상점 관리·저장 처리 연결');
      console.log('탄약 충전: 무기 한 자루 완충 / 해당 강화 단계 구입가의 20% / 내구도 유지');
      console.log('재료 입고·구매 / 탄약 충전: 사용자 실게임 확인. 날짜 변경 재입고·재접속 저장 유지는 별도 검증 필요.');
      console.log('통합 패치: EXE + MASTER DB + BrgGame.upk 변경. 세이브는 직접 수정하지 않습니다.');
      console.log('1. 전체 적용: 재료 상점 + 데칼 교체/탈착 + 탄약 충전 (자동 백업)\n2. 패치 제거 / 적용 전 백업 복원\n3. 백업 목록\n4. 종료\n5. 재료 상점만 적용\n6. 재료 상점 + 데칼만 적용 (탄약 제외)');
      const choice=(await rl.question('선택: ')).trim();
      if(choice==='4'||choice==='')break;
      if(choice==='3'){const backups=listBackups(root,game);if(!backups.length)console.log('이 게임 설치 경로의 백업이 없습니다: '+root);for(const x of backups)console.log(x.manifest.status+' '+x.folder);continue;}
      if(!['1','2','5','6'].includes(choice))continue;
      console.log('이미 이 모드가 적용돼 있다면 중복 적용하지 마세요. 변경 버전 재적용은 먼저 2번으로 복원하세요.');
      console.log('alpha.3·alpha.4 사용자는 게임 패치 재적용이 필요 없습니다. 이후 다른 도구가 파일을 변경했다면 복원을 중단합니다.');
      console.log('시험 전에 세이브를 별도 복사하세요. 파일 패치 복원은 게임에서 한 구매·데칼·충전 결과를 되돌리지 않습니다.');
      if(!/^y$/i.test((await rl.question('게임 종료 후 진행하세요. '+(choice!=='2'?'패치 적용':'백업 복원')+'에 동의합니까? (y/N): ')).trim()))continue;
      try{console.log(choice!=='2'?apply(game,root,{decals:['1','6'].includes(choice),ammo:choice==='1'}):'복원 완료: '+restore(game,root));}
      catch(error){reportError(error);}
    }
  }finally{rl.close();}
}
main().catch(e=>{reportError(e);process.exitCode=1;});
