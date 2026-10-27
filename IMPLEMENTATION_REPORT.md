# Wordloom 구현 및 검증 결과

검증일: 2026-10-26. 초기 저장소에는 AGENTS.md, CODEX_START_HERE.md, docs/01~08만 있었으며 앱 코드·아이콘·starter.json은 존재하지 않았다. 문서 원문은 수정하지 않았다.

## 실제 배포 데이터

- 스키마·중복·한글 뜻·출처 검사 통과 고유 표제어: **6,500개**. 부족 수량: **0개**.
- `data/catalog-manifest.json` → `data/packs/core-01.json` ~ `core-13.json`, 각 500개.
- L1: 1,000 / L2: 1,500 / L3: 2,000 / L4: 2,000.
- 일반 독해: 5,205 / 행동과 과정: 536 / 성질과 관계: 759.
- KOReader Dicts v1.2.0의 영어→한국어 StarDict 표제어만 사용. .syn 굴절형 미사용. OpenSubtitles 2018 FrequencyWords를 선정 빈도로 사용.
- 파생 데이터 CC BY-SA 4.0. 원본 저작자 표시·WordNet 고지·변경 공지 동봉. `data/sources/README.md`, `QA.md`, `provenance.json`, 원본 ZIP 및 ATTRIBUTION/LICENSE 참조.
- 원본 ZIP SHA-256: `219eacf3f57e93da993a9ba438d3c3eaf3fa3b94de745847fe74826cb776ccf1`.
- Codex가 96개 층화 표본을 검토하고 대표 뜻·오역·비속어를 교정했다. 수정 목록은 corrections.json에 있다. 스키마 통과 6,500개를 전문 번역가가 전수 검수한 6,500개라고 해석하면 안 된다.

## 구현

홈, 카드, 10문제 시험, 전체 단어장, 오답·기한 복습, 통계, 설정. 클릭·Space·Enter 카드 반전, 수동 발음, 북마크, 4단계 SRS, 카드 평가 전 해금 방지, 10개 고유 문항·4지선다·확정 채점, 오답 분리 저장. 전체/오늘/오답 시험 범위와 부족 범위 오류 안내. 전체 데이터 검색·레벨/분류/상태/북마크 필터 및 50개 페이지 처리. 고유 학습·확인·암기 수, 오늘 복습, 7일 활동, 연속 학습, 누적 정답률. 목표/음성 속도, JSON 백업 및 검증·미리보기·확인 후 병합/교체 복원, 이중 확인 초기화.

IndexedDB `wordloom-toefl-v1` v2. v1 words/progress/meta 보존, quizAttempts/studyEvents 추가. 모든 팩 SHA-256·스키마·실수량 검증 후 단일 트랜잭션 시딩. 카탈로그 갱신은 진도를 초기화하지 않는다. 실패 시 오류·재시도. Service Worker는 앱과 전체 13팩 및 출처 고지를 캐시하며, 새 워커는 열린 탭이 닫힌 후 활성화된다. 사용자 데이터는 외부로 전송하지 않는다.

## 실제 실행 결과

| 명령/검증 | 결과 |
|---|---|
| `python scripts/validate-vocabulary.py` | PASS, raw=6,500, validUnique=6,500 |
| `npm test` | Node 7개 테스트 통과 + Python 부정 검사 9종 통과 |
| 실제 팩 기반 시험 100회 | 매 회 정확히 10개 고유 문항, 4개 고유 보기, 정답 1개 |
| `python scripts/build-release.py` | dist 생성 및 배포 데이터 재검증 6,500개 |
| `npm run test:e2e` | Chrome 4개 통합 시나리오 통과 |
| 신규 프로필 자동 설치 | 수동 import 없이 DB 6,500개, UI와 일치 |
| 카드·시험 | 키보드 반전, 평가 저장, 8/10 시험 및 2개 오답, 새로고침 보존 |
| v1 → v2 및 카탈로그 갱신 | 기존 북마크·repetitions·미해결 오답 보존 |
| 잘못된 백업 및 정상 교체 복원 | 잘못된 파일에 기록 유지, 정상 파일에서 전량·진도·시험 복원 |
| 팩 404 | 완료 UI 금지, words 0개로 유지, 재시도 노출 |
| 완전 오프라인 재시작 | DB 6,500개, 첫/중간/마지막 단어 검색·카드, 10문항 시험 및 기록 저장 |
| 전체 오프라인 캐시 | 13팩 실응답 합계 6,500 / 고유 6,500 / 한국어 뜻 6,500 |
| DB 삭제 후 완전 오프라인 복구 | 캐시만으로 6,500개 재시딩 |
| 하위 경로 `/dist/` | 상대경로, 서비스 워커, 오프라인 전체 팩 정상 |
| 표본 카드 30개 | 각 레벨/분류에서 오프라인 검색 → 카드 → Enter 반전, 초점 유지 |
| 320px 화면 | 가로 넘침 없음, 캡처 확인 |

증빙: `verification/e2e-results.json`, `catalog-browser-check.json`, `mobile-home.png`, `desktop-home.png`, `offline-stats.png`. 초기 측정에서 하위 경로의 신규 로드 약 948ms. 이 수치는 로컬 데스크톱 환경 측정으로 실제 휴대폰 성능 보장이 아니다. 백업 파일은 테스트에서 생성한 자료이며 git/배포 대상에서 제외했다.

## 미검증 및 출시 판정

**구현·데이터 수량·데스크톱 Chrome 자동 수락 테스트는 통과했다. 전체 P0 출시 완료 판정은 보류한다.**

- 실제 Android 설치 및 iPhone/iPad 홈 화면 추가·Safari 오프라인 동작은 해당 기기가 없어 직접 검증하지 않았다.
- 독립된 사람의 콘텐츠 표본 검수, 세부 학술 분야별 전문가 큐레이션은 수행하지 않았다. 원본 사전과 빈도 기반 선정이며 모든 번역의 완전한 정확성을 보증하지 않는다.
- 저장 용량 부족의 실제 디스크 재현, 실물 모바일 성능, 여러 탭의 동시 쓰기 경쟁, 실제 배포 후 서비스 워커 버전 교체는 이번 자동 시나리오 범위에 포함하지 않았다. 워커 데이터 갱신 대신 카탈로그 버전 변경 및 IDB v1 업그레이드 보존은 검증했다.
- GitHub Actions 워크플로는 추가했으며 원격 CI 실행은 하지 않았다.

기본 6,500개 데이터는 이번 산출물과 dist에 이미 포함되어 있다. 별도 데이터 업로드나 외부 사전 API는 기본 설치 경로에 필요하지 않다.

## 후속 변경 — 기초 어휘 제외 (2026.10.26.2)

- you/they/it 등 기초 대명사·기능어·숫자·인사말·쉬운 생활 어휘를 명시적으로 제외했다. 제외 정책 파일: data/sources/basic-exclusions.json.
- 필터링 후보에서 해당 기초어 468개 제외, 동일 출처로 다시 선정한 실제 고유 표제어 6,500개 유지. manifest에 제외 목록과 새 버전 기록.
- 데이터 검증기는 제외 어휘가 배포 팩에 들어가면 실패한다. 전체 카탈로그 제외 규칙 회귀 테스트 추가.
- 기존 설치의 제외 단어는 내장 학습 목록에서 제거하고 진도는 보존한다. 과거 백업 복원 시 제외 단어가 재노출되지 않도록 현행 기본 카탈로그 적용. 제거된 단어의 기록도 retiredWordIds 메타를 통해 백업 검증·복원 가능.
- 카탈로그와 서비스 워커 캐시 버전 갱신 및 dist 재생성. 단위 테스트 7개, 부정 검사 9종, Chrome 통합 시나리오 4개를 다시 검증했다.

## 후속 변경 — 전체 카드 번호 이동

전체 덱에 카드 번호 입력(1~실제 덱 크기)과 이동 버튼 추가. Enter로도 이동하며 앞면으로 초기화하고 카드에 초점을 돌려준다. 빈 값·소수·범위 밖 값은 브라우저 입력 검증으로 차단한다. 전체 덱을 끝까지 본 뒤에도 번호 이동으로 돌아갈 수 있다. 서비스 워커 캐시 버전 3 및 dist 갱신.

실제 Chrome에서 1/2,000/3,250/4,200/6,500번 이동, Enter, 잘못된 값 4종, 카드 앞면 복귀, 완료 후 복귀, 320px 화면을 확인했다. 결과: verification/card-jump-check.json, 화면: verification/card-jump-mobile.png.

## 한글 뜻 교정 (2026.10.27.1)

전체 6,500개 영어·한국어 쌍을 검토하여 뜻·표현 1,533개를 교정하고, 2,176개는 중복 표현 및 구분자만 정리했다. 고유 표제어 6,500개와 기존 ID 및 뜻 이외의 필드는 유지했다. 원본 출처와 라이선스는 data/sources/README.md에 있으며, 파생 교정도 기존 CC BY-SA 4.0 조건을 따른다. 교정 원본은 data/sources/meaning-review.tsv, 배포 데이터는 data/packs/core-*.json, 변경 전후 기록은 verification/meaning-review.json에 보존했다.

재생성 때 교정이 유지되도록 빌드에 교정표를 연결하고, 교정 회귀·편집 메모·중복 뜻·잘못된 괄호를 검출한다. 자동 검사는 번역 정확성 판정기를 대체하지 않는다. 독립된 전문가의 전수 검수는 수행하지 않았으며 의미 오류가 전혀 없다고 보증하지 않는다.

검증: 데이터 6,500개 및 해시 검증, Python 테스트 4개(부정 입력 14종 포함), 학습 로직 테스트 7개, Chrome 통합 테스트 5개 통과. 데이터 재생성 결과의 해시 일치와 배포 빌드도 확인했다. 브라우저에서는 기존 카탈로그 갱신·진도/북마크 보존·오래된 백업 복원·오프라인 검색과 카드의 교정된 뜻을 확인했다. 과거 시험 기록은 변경하지 않는다. Android/iOS 및 Mac 서버 실기기 테스트는 이번 작업에서 수행하지 않았다.

## Shared Caddy deployment

Removed standalone DNS/TLS services, configuration, tests and obsolete deployment verification artifacts. Dockerfile validates 6,500 words and builds an internal HTTP Nginx origin. compose.yaml connects only the app to mac-mini-proxy as wordloom-origin, with no published host ports. See deploy/SHARED_CADDY.md. Actual Mac container execution and public TLS remain unverified.

애드센스 검토 문서는 docs/09_MONETIZATION_REVIEW.md에 작성했다. Google 자격/사이트 등록 범위·Public Suffix List·콘텐츠/배치/개인정보/CMP/ads.txt 정책과 현재 앱 코드를 대조했다. DuckDNS를 이유로 신청 불가라고 단정할 수 없지만 등록 및 승인은 미확인이다. 공개 학습 콘텐츠·운영 정보·개인정보 안내 보강, 카드 조작 영역 광고 제외, 화면별 광고 수명 관리가 우선이다. 실제 트래픽이 없으므로 수익 예측 대신 페이지 RPM 가정별 산식만 제공했다. 광고 코드 삽입·소유권 확인 태그·사이트 신청·광고 송출은 수행하지 않았다.
