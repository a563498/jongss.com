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
