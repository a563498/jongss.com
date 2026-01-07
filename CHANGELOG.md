# CHANGELOG

이 파일은 **UI는 유지한 채 내부 로직만 교체**하는 과정에서, 무엇을 어떻게 바꿨는지 누적 기록합니다.

## v1.0.0 (2026-01-08)

### Changed
- D1 스키마를 **런타임 자동 감지**하도록 변경
  - 기존: `entries` / `senses` (한국어기초사전 적재본)
  - 신규: `lex_entry` / `answer_pool` / `answer_sense` (우리말샘·표준국어대사전 적재본)
- 일일 정답 생성 로직을 `answer_pool` 우선 사용으로 변경
  - `answer_pool`이 존재하면 풀에서만 정답을 고르고, 뜻/예문은 `answer_sense`에서 로드
  - `entries` 스키마만 있는 경우에는 기존 로직 그대로 동작
- `/api/guess` 등 단어 조회 로직이 `lex_entry` 계열에서도 동작하도록 테이블명을 동적으로 적용
- TOP 후보 계산 로직(`getDbTop`)에서 하드코딩된 테이블명(`entries`, `senses`)을 제거하고 감지된 테이블명을 사용

### UI text
- 라이선스/출처 문구를 **우리말샘·표준국어대사전** 기준으로 변경

## v1.2.0 (2026-01-08)

### Added
- `answer_rank` 테이블(날짜별 TOP 랭킹 저장) 자동 생성 로직 추가
  - `date_key, word_id, word, rank, raw, percent`
  - 인덱스: `(date_key, rank)`, `(date_key, word)`
- 일일 랭킹 생성 함수 `ensureAnswerRank()` 추가
  - 정답(뜻/예문)에서 키워드 추출 → 후보군(limit) 검색 → 유사도 계산 → 상위 K개(기본 5000) 저장
  - 환경변수로 조절 가능: `RANK_TOPK`, `RANK_CANDIDATE_LIMIT`

### Changed
- `/api/meta`와 `/api/top`이 더 이상 무거운 랭킹 계산을 동기적으로 수행하지 않도록 수정
  - 가능한 경우 `waitUntil()`로 백그라운드에서 랭킹 생성만 킥
- `/api/guess`는 첫 입력이 느려지지 않도록 변경
  - `answer_rank`에 랭킹이 있으면 즉시 rank/percent 반환
  - 없으면 즉석 유사도(`scoreToPercent`)로 percent만 반환하고, 랭킹 생성은 background로 킥
- 토큰화/유사도에서 1음절 핵심어(예: 풀/땅/밭/논 등)를 whitelist로 유지하도록 보강
- 낮은 유사도 점수의 0% 컷오프 임계값을 완화(0.05 → 0.01)

### Notes
- 130만 전수 비교는 Workers/D1 제약상 불가능하므로, 후보군 기반 랭킹(상위 K 저장) 구조로 게임성을 확보

## v1.2.1 (2026-01-08)

### Fixed
- `ensureAnswerRank()` 실패 시에도 KV 락을 **반드시 해제**하도록 `try/finally` 적용
  - 이전에는 실패하면 락이 남아 `TOP`이 계속 빈 배열로 남을 수 있었음
- 후보군 보강 단계에서 `ORDER BY RANDOM()`을 제거하고 **PK 기반 빠른 샘플링**으로 변경
  - 130만+ 레코드에서 `ORDER BY RANDOM()`은 타임아웃/지연의 주요 원인이 될 수 있음

### Added
- `/api/top?build=1`(또는 `debug=1`) 옵션 추가
  - 랭킹 생성(`ensureAnswerRank`)을 **동기 실행**하고 결과(`build`)를 응답에 포함하여 원인 진단 가능
