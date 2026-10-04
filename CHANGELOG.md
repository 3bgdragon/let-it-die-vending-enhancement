# 변경 기록

## 1.1.2-rc.1 / TFC 1.2.0-rc.1 — 2026-10-04

- Preserve reviewed independent UPK instruction edits and Nico file-check OFF entries; reject owned-byte/native conflicts before writes.
- Add game-specific TFC preparation, all-function post-install proofs, explicit backed-up block-layout repair and interruption recovery.
- Add selected recorded guard/M2G recovery and prevent preparation/detach with pending recovery journals or mixed installation modes.
- Publish standalone and TFC ZIPs separately; exclude experimental manager prototypes and game/save binaries.
- Actual Nico/TFC engine and disposable-copy tests passed. GUI/live gameplay retesting remains pending; prerelease, not universal compatibility.


## 1.1.1-dev — 2026-10-02

- 자동 탐색 실패 시 설치 폴더 또는 EXE 경로를 직접 입력하고 재시도할 수 있습니다.
- 검증된 Steam 빌드 25386710에서 전체 EXE 해시만으로 거부하지 않고 PE 구조와 패치 의존 구간을 확인합니다. 무관한 변경은 보존하며 실제 충돌은 차단합니다.
- 외부 EXE 변경 보존, 경로 입력 및 공통 처리부 회귀 테스트를 추가했습니다.

## 1.1.0-dev — 2026-09-30

- 워프·저스트가드·M2G와 동일한 Node.js 공통 합성 처리부 포함. 자판기 변경을 검증·분리한 임시 파일에서 작업 후 재합성.
- `게임/LID-Mod-State`에 합성 원본·기록·공통 백업 보관. 동일 데이터는 해시 검증 후 중복 저장 없이 공유.
- 2번 자판기 선택 제거, 8번 검증된 구형 백업 등록, 9번 공통 전체 백업 복원. 설정 조합·언어 변경과 동일 설정 적용 생략 지원.
- 순정 또는 워프 적용 EXE 코드 및 실제 패키지 연결 검증. 알 수 없는 코드·외부 변경·손상된 백업은 계속 차단.
- 동시 작업 잠금, 설치 직전 재검증, 부분 설치·기록 저장 실패 시 되돌리기. 세이브·구매 이력은 직접 변경하지 않음.
- 정확히 알려진 EXE라도 실제 동반 패키지 연결을 검사. 동일 설정 확인 중 외부 변경 감지 및 불필요한 원본 세대 생성 방지.
- 개발 시험판: 실제 파일 복사본과 오류 주입 검증이며 새 합성 경로의 실게임 확인은 별도 필요.

## 1.0.0 — 2026-09-24

- 정식 버전 표기 및 사용자용 README·툴 안내 정리.
- 재료 최초 입고·구매 및 탄약 충전 실게임 확인 반영.
- 게임 패치 바이트는 alpha.3·alpha.4와 동일. 이미 적용했다면 재적용 불필요.
- 백업은 툴 옆 공개 폴더에 유지. 기존 내부 백업 자동 검증·복사 지원.
- 날짜 변경 자동 재입고·재접속 저장 유지·데칼 관리 개별 실게임 확인은 남아 있음.

## 0.4.0-alpha.4

- 백업 위치를 툴 내부에서 상위 폴더의 별도 디렉터리로 변경.
- 검증 후 기존 백업 복사, 이름 충돌·손상 차단, 복원 상태 보존.

## 0.4.0-alpha.3

- 재료 이력이 없는 세이브의 최초 입고 및 재접속 중복 입고 방지.

## 0.4.0-alpha.2

- 탄약 충전의 잔액 검사·차감을 파이터 소지금에서 금고 킬코인으로 수정.

## 0.4.0-alpha.1

- 재료 선정·데칼 관리·탄약 충전 통합 패치 및 전체 백업 복원 도구 공개.
