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

## v1.1.0 (2026-01-08)

### Added
- D1 테이블 `answer_rank`를 코드에서 자동 생성(없으면 `CREATE TABLE IF NOT EXISTS`)
  - `date_key`, `word_id`, `rank`, `score` 저장
  - 인덱스: `(date_key, rank)`, `(date_key, word_id)`

### Changed
- Top(랭킹) 산출 결과를 KV가 아니라 **D1 `answer_rank`에 저장**하도록 변경
  - 하루에 1회(최초 호출 시) 후보군(최대 12,000)만 점수 계산 → 상위 1,000개를 `answer_rank`에 저장
  - 동시 접속 시 중복 계산을 줄이기 위해 KV 락(`saitmal:ranklock:<dateKey>`, TTL 60초) 적용
- /api/guess는 `answer_rank` 기반으로 rank/percent를 응답(당일 랭킹이 없으면 내부에서 1회 생성)
- 유사도 점수가 과도하게 0으로 눌리던 케이스(유의미 토큰 1개만 겹치는 단어)를 완화
  - `sharedInfo==1`일 때 정의/예문 cap 상향
  - 최종 0 처리 임계값을 0.05 → 0.02로 완화
- `/api/guess`는 `answer_rank`에서 rank/percent를 조회하도록 변경
  - (첫 요청 시 `/api/top`과 동일한 경로로 일일 랭킹이 1회 생성됨)

### Fixed
- 유사도 점수에서 '의미 토큰 1개만 겹치는 경우'가 과도하게 0%로 눌리던 현상을 완화
  - `sharedInfo == 1`일 때 cap를 상향
  - score floor(0으로 누르는 임계값)를 낮춰 0% 폭주를 줄임

## v1.1.1 (2026-01-08)

### Fixed
- KV에 저장된 **이전 버전 정답 캐시**가 정의/토큰을 포함하지 않아 `answer_rank` 생성이 0개로 끝나는 문제 해결
  - `getDailyAnswer()`에서 캐시된 정답에 `definition/tokens`가 없으면 D1에서 재조회해 보강 후 KV를 갱신

### Changed
- 1음절 핵심어(예: **풀/땅**)가 토큰화/교집합 계산에서 누락되어 유사도가 0%로 떨어지는 현상 완화
  - `SINGLE_KEEP` 화이트리스트 확장(지형/생활 핵심어 일부 추가)
  - `informativeIntersection()`과 정답 토큰 추출에서 1음절 화이트리스트를 의미 있는 토큰으로 인정
  - 최종 0 처리 임계값을 0.02 → 0.008로 조정
