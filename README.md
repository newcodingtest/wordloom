# Wordloom — 토플 영단어

기초 대명사·기능어와 쉬운 생활 어휘를 제외한 영어·한국어 실제 고유 표제어 **6,500개**를 기본 포함하는 모바일 우선 정적 PWA입니다. 계정이나 서버 없이 이 브라우저의 IndexedDB에 학습 기록을 저장합니다. ETS 공식 어휘 목록이 아닙니다.

## 실행

Python 3.10+:

```sh
python -m http.server 8000
```

http://localhost:8000 접속. 처음 방문하면 13개 정적 JSON 팩을 자동 검증·저장합니다. 상단에 **오프라인 준비 완료**가 표시될 때까지 온라인 연결을 유지하세요. 이후 전체 어휘 검색·카드·시험·기록 저장이 오프라인에서 동작합니다. 발음은 기기에 설치된 영어 음성에 따라 달라질 수 있습니다.

## 검증

Node.js 22+, Python 3.10+:

```sh
npm ci
npm run validate
npm test
python scripts/build-release.py
npm run test:e2e
```

로컬 E2E는 설치된 Google Chrome을 사용합니다. CI에서는 Playwright Chromium을 사용합니다 (`npx playwright install --with-deps chromium`). Windows에서 Node가 PATH에 없다면 설치 후 새 터미널을 여세요. 이번 실행에는 `.tools/node-v22.21.1-win-x64/`의 로컬 Node를 사용했습니다.

- 데이터 검증: manifest 실제 파일, SHA-256, 수량, 고유 ID/표제어, 한국어 뜻, 필수 필드, 출처와 라이선스 파일 검사. 실패 시 종료 코드 1.
- 부정 테스트: 제외 대상 기초어·5,999개·중복·빈 뜻·영어 뜻·placeholder·분류 누락·알 수 없는 출처·누락 팩.
- 단위 테스트: SRS, 암기 판정, 로컬 날짜, 100회 실제 데이터 시험 생성.
- Chrome: 첫 설치, 카드 키보드, 8/10 채점·오답, DB v1 업그레이드, 업데이트 후 진도 보존, 백업 복원, 320px, 하위 경로, 전체 팩 오프라인 및 DB 오프라인 복구.
- 실행 결과: [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md), `verification/e2e-results.json`, `verification/catalog-browser-check.json`.

## 배포

`python scripts/build-release.py`가 검증된 배포 파일만 `dist/`로 복사하고 다시 6,500개를 검증합니다. `dist/` 내용을 HTTPS 정적 호스팅에 올리세요. 루트와 하위 디렉터리 모두 상대 경로로 동작합니다. `.tools/`, `node_modules/`, 테스트용 백업을 배포하지 마세요.

Android Chrome은 메뉴 → 앱 설치, iOS Safari는 공유 → 홈 화면에 추가. 실제 기기 설치 검증 범위는 보고서에 명시했습니다. 기기 간 자동 동기화는 없습니다. 설정에서 JSON 백업을 보관하세요.

## 내장 데이터

- `data/catalog-manifest.json`
- `data/packs/core-01.json` ~ `core-13.json` (각 500개, 합계 6,500개)
- [출처·라이선스](data/sources/README.md), [검수 기록](data/sources/QA.md), `corrections.json`, `conversion-report.json`
- 파생 데이터: **CC BY-SA 4.0**. 원본 KOReader Dicts의 ATTRIBUTION/LICENSE 및 Princeton WordNet 고지를 동봉했습니다. 재배포 시 저작자 표시, 라이선스 링크, 변경 고지와 동일조건 공유 의무를 유지하세요.

## 데이터 갱신

현재 카탈로그 `2026.10.27.1`은 6,500개 영어·한국어 쌍을 검토해 1,533개 뜻·표현을 교정했습니다. [교정표](data/sources/meaning-review.tsv)와 [검수 범위](data/sources/QA.md)를 참고하세요. 독립 전문가의 전수 감수는 미실시입니다. `python scripts/build-vocabulary.py`로 다시 생성해도 교정표가 적용되며, 검증기는 알려진 오역으로 되돌아간 팩을 거부합니다.

서버 갱신 후 온라인으로 앱에 접속하고 Wordloom 탭·설치 앱을 모두 닫았다가 다시 열면 새 오프라인 캐시와 뜻이 적용됩니다. 브라우저의 학습 기록을 삭제할 필요는 없습니다.

보존된 원본으로 `python scripts/build-vocabulary.py` 실행 → 실제 데이터/층화 표본 검수 → `catalogVersion` 및 `sw.js` 캐시 이름 증가 → 검증/테스트 → 배포. 영어 표제어의 `w:...` ID를 유지하세요. 런타임 갱신은 words를 갱신하고 제외된 내장 단어만 제거하며 progress/quizAttempts/studyEvents를 지우지 않습니다. 새 서비스 워커는 열린 앱 탭을 모두 닫은 뒤 적용됩니다.

자동 검사는 번역의 의미적 정확성 전수를 증명하지 않습니다. 실제 어휘 수량과 의미 검수 범위는 구분하여 보고합니다.

기초어 제외 정책은 `data/sources/basic-exclusions.json`에서 관리합니다. 제외된 내장 단어는 업데이트 시 학습 목록에서 제거하되, 기존 진도·시험 이력은 보관합니다. 이전 백업을 복원해도 현행 내장 카탈로그를 유지합니다.

## Mac mini / Caddy

See [shared Caddy setup](deploy/SHARED_CADDY.md). `compose.yaml` runs only the HTTP app on the existing `mac-mini-proxy` network. Run `docker compose up -d --build`. Existing Caddy handles HTTPS; existing DuckDNS must update the app domain. Set `PROXY_NETWORK` only if the network name differs.


애드센스 적용 가능성·현재 부족 사항·광고 위치·수익 가정은 [수익화 검토](docs/09_MONETIZATION_REVIEW.md)에 정리했습니다. 광고 코드는 아직 삽입하지 않았습니다.
