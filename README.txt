사잇말 통합 핫픽스 v1.4.7

해결:
- /api/top?build=1 실행 시 D1 오류: "no such column: f" 수정 (FTS MATCH에서 alias 사용 금지)
- 후보군 품질 향상: answer_pool 기준으로 표준어/활성 단어만 사용(is_active=1, is_dialect=0, is_north=0)
- percent NULL 방어: /api/top, /api/guess에서 rank 기반 fallback 제공
- 프론트 입력 버그: 한글 IME 조합 중 Enter 입력이 제출로 처리되며 추측이 누락되는 문제 방지

적용:
1) ZIP 풀기
2) 포함 파일 덮어쓰기
3) 배포 후 1회: /api/top?limit=30&build=1
