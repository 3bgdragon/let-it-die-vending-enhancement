# 초기 조사 — Steam 빌드 25386710

> 아래는 구현 전 조사 기록입니다. 현재 초기 시험판의 구현·배포 상태는
> [README](../README.md)와 [탄약 연결 기록](ammo-refill.md)을 기준으로 확인하세요.

2026-09-24 로컬 설치의 DB는 읽기 전용으로 확인했다. 함수 목록은 같은 빌드의
기존 분석용 BrgGame 논리 패키지에서 추출했다. 이름이 존재한다는 사실만으로
그 함수가 자판기에서 정상 호출되거나 저장까지 수행한다고 판단하지 않는다.

## 1. 킬코인 일일 재료 재고

현재 `master_automaticshop_schedule`의 7개 행은 `purchase_lineup_id=AP`,
`purchase_goods_min=7`, `purchase_goods_max=7`을 갖는다. 그러나 실제 상품의
lineup 목록에는 AP가 없고 COMMON, RE, MON~SUN만 있다.
따라서 일일 구매용 상품 그룹이 비어 있다는 점은 확인했다. AP 상품을 넣는
것만으로 일일 갱신까지 복구된다고 단정할 수는 없다.

추적할 함수:
- `BrgDatabase.GetAutomaticshopLineupList`
- `BrgUserData.GetAutomaticshopBuyableGoodsIds`
- `BrgUserData.GetAutomaticshopDailyDate`
- `BrgUIMenuPart_ItemSelect.AddUnitFromAutomaticshopLineup`

상품 선정, 구매 차감, 품절 저장, 날짜 변경 시 복구의 실제 호출 경로를 조사해야 한다.
스케줄의 expire 값은 이미 지난 날짜와 요일별 혈늄 그룹을 함께 갖고 있어,
문자열의 날짜만 보고 현재 갱신 시각을 추정하지 않는다.
기존 블러드늄 및 리사이클 상품·구매 이력은 변경 대상에서 제외한다.

### 실행 파일 분기 검증 (2026-09-24)

대상 EXE SHA-256:
`b29bf446786aed3c6c47b69e112e4ba6d1e97ed6b7ead791c80754472432ef6a`

- 초기화 함수 RVA `0x134cec0`: COMMON / RE / 요일 그룹을 각각 선정한다.
  COMMON 선정 호출 `0x134d26c`는 최대 개수에 -1을 전달한다.
- 선정 함수 RVA `0x1155960`: 행의 `+0x40`이 1인 고정 상품만 출력 배열에
  추가한다. 나머지는 후보 맵에 넣지만 이 함수에서는 추첨하여 출력하지 않는다.
  후보 맵은 함수 말미에 정리된다. 따라서 AP 행 추가만으로 복구되지 않는다.
- 날짜 확인 경로 `0x134f050 → 0x12d8f70 → 0x13404f0`는 날짜 변환 결과를
  저장된 전역 값과 비교한다. 날짜 불일치 시 초기화 함수가 호출되는 경로가 있다.
  아직 시각대·날짜 저장·구매 및 재접속까지의 동작 검증은 완료하지 않았다.

`dev/test-native-selection.py`로 실제 선정 루프를 격리 실행한 결과:

| 입력 | 출력 | 결과 |
|---|---|---|
| 고정 상품 8개, 제한 없음 | 8개 | 통과 |
| 고정 상품 8개, 제한 5개 | 앞의 5개 | 통과 |
| 랜덤 후보 8개, 가중치 각 1,000,000 | 0개, 후보 맵에만 8개 | 통과 |
| 고정 2개 + 랜덤 2개 | 고정 2개만 | 통과 |

이 테스트는 DB 조회·셔플 이후의 루프만 실행하며 맵 삽입 호출은 대체한다.
구매, 일일 재입고, 게임 UI의 성공을 의미하지 않는다. 공용 선정 분기를
무조건 변경하면 다른 상점도 영향받으므로 적용용 패치를 제공하지 않는다.

다음 구현 조건: COMMON 기존 상품 보존, 재료 후보만 별도 제한 선정,
하루 구매 이력 유지 및 다음 날 복구, RE/블러드늄 이력 불변. 이 조건을
검증하기 전에는 기능 2·3 또는 실게임 설치로 진행하지 않는다.

## 2. 파이터 데칼 교체·탈착

사용자 확인: 뽑기 갱신이 아니라 파이터에게 붙은 데칼의 교체·탈착이다.
관련 메뉴 후보:
- `BrgUIMenu_SkillEquip`
- `BrgUIMenu_SkillPut.ExchangeSkillEquipListToEqSkillArray`
- `BrgUIMenu_SkillSetup_Menu`
- `BrgUIManager.StartSketchbookSkillSetupMenuScreen`
- `BrgSeqAct_ItemVendingMachineMenu.StartMenu` / `ResumeMenu`

이름이 비슷한 SkillVendingMachine은 별도 뽑기용 경로일 수 있으므로 그대로
선택하지 않는다. 기존 버섯상점의 진입·현재 파이터 설정·일반/프리미엄 탈착
규칙·메뉴 종료 복귀 경로를 확인한 다음 연결한다.

## 3. 탄약 충전

`BrgWeapon_GunBase.SetBulletNum`이 있으며 RocketLauncher와 SquareTimber에도
동명의 함수가 있다. RedNapalmGun의 SetBulletType은 발사 종류 선택이므로
탄약 수량 충전과 혼동하지 않는다.
무기별 최대 탄약, 현재 탄약 저장, 장착/가방 인스턴스의 일치 여부를 확인해야 한다.
내구도·강화값 변경은 금지한다. 충전 비용 및 대상 선택 UI는 아직 미확정이다.

## 검증/배포 상태

- 독립 로컬 Git 저장소 생성.
- Node.js 읽기 전용 설치·DB 조사 도구와 DB 무변경 회귀 테스트 완료.
- 게임 메뉴 및 세 기능의 실동작: 미구현.
- 기존 모드 병용과 실게임 검증: 미실시.
- 게임 파일·DB·세이브에 쓰기 없음. GitHub 원격 생성·푸시 없음.
- 개발자용 함수 목록 추출 스크립트는 기존 분석 자료에 의존하며, 배포용 실행에
  포함할 외부 런타임 요구 사항이 아니다.
