사잇말 핫픽스 v1.4.8

현재 에러 해결:
- D1_ERROR: no such column: ap.is_dialect  (answer_pool에 해당 컬럼 없음) -> 참조 제거
- D1_ERROR: no such column: f  (FTS MATCH에서 alias 사용) -> answer_sense_fts MATCH 로 수정

또한:
- 정답은 랭킹 후보에서 제외 (top에는 정답 안 나옴)
- 랭킹 percent는 최대 99.99, 정답 추측 시 /api/guess만 100.00 반환
- percent NULL 방어: /api/top,/api/guess에서 percentFromRank fallback
- 입력 누락(한글 IME Enter) 방지: compositionstart/end 처리 추가 (UI/스타일/이미지 로직은 건드리지 않음)

적용:
1) ZIP 풀기
2) 포함 파일 덮어쓰기
3) 배포
4) 배포 후 1회: /api/top?limit=30&build=1
