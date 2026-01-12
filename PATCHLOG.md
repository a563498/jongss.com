# PATCHLOG

## v1.4.6 (통합: v1.4.4 + v1.4.5 + 추가 수정)
- (빌드 오류 수정) `percentFromRank` export를 `functions/lib/rank.js`에 복구하여 Pages Functions 빌드 실패 해결.
- (게임 규칙) 정답 단어는 `answer_rank`(상위 유사어 목록)에서 **제외**하도록 변경.
  - 따라서 `/api/top`에 노출되는 랭킹에는 100%가 존재하지 않음(최대 99.99).
  - 정답을 맞힌 경우에만 `/api/guess`에서 `isCorrect: true`와 함께 `percent: 100.00`으로 반환.
- (유사도 강화) FTS(bm25) 1차 후보 + 정의문 키워드/구(2-그램) 겹침 기반 2차 리랭킹 유지.
- (점수) percent는 score 기반(소수점 2자리)으로 계산하여 `answer_rank.percent`에 저장.

## v1.4.7
- (버그) D1 FTS 쿼리에서 `WHERE f MATCH ?`로 인해 발생하던 오류를 `WHERE answer_sense_fts MATCH ?`로 수정.
- (게임 품질) 랭킹 후보 풀을 answer_pool의 활성/표준어 기준으로 제한: `is_active=1`, `is_dialect=0`, `is_north=0`.
- (안정성) answer_rank.percent가 NULL인 기존 데이터가 남아도 `/api/top`, `/api/guess`에서 rank 기반 percent fallback 제공.
- (프론트) 한글 IME 조합 중 Enter 제출이 씹히는 문제를 막기 위해 composition 이벤트 처리 추가.
