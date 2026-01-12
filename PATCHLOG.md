# PATCHLOG

## v1.4.6 (통합: v1.4.4 + v1.4.5 + 추가 수정)
- (빌드 오류 수정) `percentFromRank` export를 `functions/lib/rank.js`에 복구하여 Pages Functions 빌드 실패 해결.
- (게임 규칙) 정답 단어는 `answer_rank`(상위 유사어 목록)에서 **제외**하도록 변경.
  - 따라서 `/api/top`에 노출되는 랭킹에는 100%가 존재하지 않음(최대 99.99).
  - 정답을 맞힌 경우에만 `/api/guess`에서 `isCorrect: true`와 함께 `percent: 100.00`으로 반환.
- (유사도 강화) FTS(bm25) 1차 후보 + 정의문 키워드/구(2-그램) 겹침 기반 2차 리랭킹 유지.
- (점수) percent는 score 기반(소수점 2자리)으로 계산하여 `answer_rank.percent`에 저장.

## v1.4.8
- (D1 오류) FTS MATCH에서 alias `f`를 사용하던 쿼리를 `answer_sense_fts MATCH`로 수정.
- (스키마 호환) answer_pool에 존재하지 않는 컬럼(ap.is_dialect/ap.is_north) 참조 제거.
- (게임 규칙) 정답은 랭킹 후보에서 제외(랭킹엔 100% 없음). 정답 추측 시에만 percent=100.00, rank=0.
- (안정성) answer_rank.percent가 NULL인 레코드가 있어도 /api/top,/api/guess에서 percentFromRank로 fallback.
- (프론트) 한글 IME 조합 중 Enter 제출로 추측이 누락되는 문제를 방지(compositionstart/end 처리).
