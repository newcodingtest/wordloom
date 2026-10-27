# 04. 구조, 로컬 저장소, PWA 아키텍처

## 결정: 기존 정적 프로젝트에 점진적 구현

현재 배포 단위는 정적 파일이며 `index.html`이 `./app.js`(ES module)를 로드한다. 1차 릴리스에서 backend/Node 빌드 도입은 필수가 아니다.

권장 구현 트리(모듈 추가 가능):

```text
index.html
styles.css
app.js                   # bootstrap, navigation, DI/이벤트 결선
js/
  router.js              # hash route
  views.js               # HTML/DOM view rendering
  word-service.js        # catalog loading/selection/filtering
  learning.js            # pure SRS & study queue
  quiz.js                # pure question generation/scoring
  statistics.js          # pure stat computations
  backup.js              # JSON validation/export/import orchestration
 db.js                   # IDB transaction helpers and migration
 sw.js                   # offline cache & update lifecycle
 manifest.webmanifest
 data/catalog-manifest.json
 data/packs/*.json               # 필수 내장 6,000+개 실데이터
 data/sources/README.md         # 라이선스/출처
 data/starter.json              # 레거시/병합 재료
 scripts/validate-vocabulary.* # 출고 차단 데이터 검증
 icons/
 tests/
```

기존 CSS 클래스 재사용. 필요 이상으로 파일을 쪼개지 말고 책임 분리/테스트 가능성을 우선.

## IndexedDB

기존 DB는 `wordloom-toefl-v1`, 현재 version 1이며 `words` / `progress` / `meta` object store가 있다. 초기 버전 데이터를 보존하며 필요한 경우 `DB_VERSION`을 증가시키고 `quizAttempts`를 추가한다. 이미 존재하는 DB에 대한 upgrade 테스트 필수.

| Store | keyPath | 역할 |
|---|---|---|
| `words` | `id` | 사전 항목; 수입/업데이트 가능 |
| `progress` | `id` | 단어별 암기·SRS·북마크·오답 상태 |
| `quizAttempts` | `id` | 퀴즈 한 회차 결과/개별 정오답 |
| `meta` | `key` | 설정, 최초 로딩/콘텐츠 버전 |

`progress` 객체 예시:

```json
{
  "id": "w:analyze",
  "seenCount": 2,
  "reviewCount": 1,
  "repetitions": 1,
  "intervalDays": 3,
  "dueAt": "2026-10-29T15:30:00.000Z",
  "lastReviewedAt": "2026-10-26T15:30:00.000Z",
  "firstReviewedAt": "2026-10-26T15:30:00.000Z",
  "lastRating": "good",
  "lapses": 0,
  "bookmarked": false,
  "needsReview": false,
  "quizWrongCount": 0,
  "updatedAt": "2026-10-26T15:30:00.000Z"
}
```

`seenCount`는 화면만 본 횟수로 집계한다면 DB 쓰기 오버헤드를 조절, '학습 완료'로 간주하지 않는다. `repetitions`는 성공한 카드 평가 횟수. `dueAt`은 UTC, 화면 표시는 로컬. 필드 의미 변경 시 migration 정의.

시험 기록 예시:

```json
{
  "id": "quiz:2026-10-26T15:40:00.000Z:abc123",
  "mode": "all",
  "startedAt": "2026-10-26T15:39:00.000Z",
  "completedAt": "2026-10-26T15:40:00.000Z",
  "total": 10,
  "correct": 8,
  "answers": [
    {"wordId":"w:analyze","selectedMeaning":"분석하다","correctMeaning":"분석하다","correct":true}
  ]
}
```

각 완료 회차는 정확히 10개 `answers`. 퀴즈 재시작/중단 회차는 완료 통계에 미포함. 필요시 시험 진행 중 상태를 `meta`에 저장해 앱 재시작 복원.

### DB 쓰기 원칙

- `oncomplete`로 트랜잭션 성공 여부를 확인한다. 요청별 성공만으로 완료로 간주하지 않는다.
- 카드 평가 중 저장 실패하면 조용히 다음 카드로 넘어가지 않고 오류/재시도 제시.
- `putBatch` 시 모든 항목을 하나의 readwrite transaction에 저장.
- 최초 seed는 `data/catalog-manifest.json`의 모든 팩을 검증하고 **고유 표제어 ≥6,000개 조건을 통과한 후** 트랜잭션으로 저장한다. `meta.catalogVersion`/`catalogReady`/실제 저장 개수를 관리하고, 재방문 시 중복 삽입/진도 초기화를 금지한다.
- 새 버전에서 스토어/인덱스를 추가하면 IndexedDB `onupgradeneeded` 이용.

## Service Worker와 캐시

현행 `sw.js`는 앱 셸 파일을 install 단계에 cache.addAll 하고 있으나 현재 `app.js`가 누락되어 **설치가 실패할 수 있다**. 먼저 앱 파일 구현 후 정확한 자산 경로를 유지한다.

- 오프라인 필수: `index.html`, CSS, 모듈 JS, manifest, 아이콘, **내장 6,000+개 단어 팩의 완전한 오프라인 사본 또는 검증된 IndexedDB 전량 저장**, 적절한 fallback.
- 앱 셸: revision된 cache 이름 사용, 활성화 때 오래된 자체 cache만 정리. 배포 경로가 하위 경로라도 `./` 상대 URL이 유효하도록 테스트.
- 단어 패키지: 6,000+개 내장 단어 전량을 첫 온라인 실행에서 자동 다운로드·검증·IDB 시딩한다. install 단계 캐시 또는 명시적 초기화 단계 중 설계 선택은 가능하나 **첫 설치 완료 이후 오프라인에서 전량 학습 가능**해야 한다. 부분 로드 상태는 완료로 표시할 수 없다.
- runtime caching: 동일 출처 GET만 처리하고, 잘못된 응답/오류 페이지를 캐시하지 않는다. navigation fallback과 JS/JSON 요청 실패 처리 구분.
- 버전 업데이트: 새 SW가 업데이트될 때 사용자 데이터는 IDB에 그대로 보존, 업데이트 알림 및 재시작 안내.
- 캐시 삭제가 IDB 삭제를 의미하지 않음. 저장소 전체 초기화 UI도 명시 확인 필수.

## 설치 조건과 호스팅

- `manifest.webmanifest`: `name`, `short_name`, `id`, `start_url`, `scope`, `display:standalone`, 192/512px 아이콘 유지.
- `sw.js`: HTTPS 또는 localhost에서 등록. Service Worker 기능 미지원 환경에서도 **온라인 기본 학습**은 가능해야 한다.
- 정적 호스팅(예: GitHub Pages/Cloudflare Pages/Netlify)에 파일을 올릴 수 있어야 하며 내부 앱 경로는 상대 URL.
- iOS 설치는 지원 브라우저의 '홈 화면에 추가'로 유도. OS/browser별 설치 UX는 일치하지 않을 수 있음.
- PWA 설치 여부와 데이터 유지는 브라우저 저장소 정책 영향을 받음. 정기 백업을 권장하는 UI 필요.

## 발음 API

`window.speechSynthesis`와 `SpeechSynthesisUtterance(word)` 우선, 가능한 `en-US` 또는 `en-GB` 음성 선택, 속도는 설정에서 조절. 기기에서 해당 음성이 없거나 오프라인이면 호출 실패 가능; 카드 학습은 계속할 수 있어야 한다. 사용자가 명시적으로 버튼을 눌렀을 때만 발음 재생(자동 재생 금지).

## 보안 / 성능 / 프라이버시

- import 데이터는 신뢰하지 않는다. 스키마 검증, 사이즈 제한, DOM은 `textContent`를 사용.
- 6,000 단어 필터링은 debounce/페이지 처리; 전체 저장소 매 렌더마다 매번 읽지 않고 메모리 상태/인덱스를 적절히 관리.
- `navigator.storage.persist()`는 사용자에게 필요한 경우 선택적으로 요청(성공 보장 X).
- 외부 API 키/비밀을 정적 파일에 넣지 않는다.
- 서버 미구축 시 기기 간 동기화/계정 복구는 지원하지 않음을 분명하게 안내한다.

## 필수 콘텐츠 준비 완료 검증

1. `data/catalog-manifest.json`을 읽고 참조된 모든 정적 JSON 팩을 가져온다.
2. 중복 제거 및 스키마/뜻/출처 검사 후 실제 고유 표제어가 ≥6,000인지 확인한다.
3. 저장 트랜잭션 완료를 보장한 후 저장된 DB word count를 재검증하고 `catalogReady=true`를 기록한다.
4. 최초 실행에 실패하면 재시도 및 실패 이유를 표시하며 `catalogReady`를 성공으로 위조하지 않는다.
5. 오프라인 재실행에서는 검증된 내장 IndexedDB 데이터를 사용하고, 온라인 카탈로그 fetch를 필수 경로로 삼지 않는다.
6. 카탈로그 갱신 시 기존 진도·북마크·오답·퀴즈 기록을 보존하며 필요한 어휘만 upsert한다.
7. 데이터가 없는 최초 완전 오프라인 방문은 정상 설치를 보장할 수 없음을 안내한다.
