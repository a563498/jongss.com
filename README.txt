사잇말 v1.3.6 패치 (운영 안정화: /api/top 절대 가볍게)

목표:
- /api/top 호출 시 D1 CPU limit(RESET) 재발 방지
- lex_entry JOIN/IN 조회를 /api/top에서 제거
- 빌드 시점에 answer_rank에 display_word/pos까지 함께 저장 → 조회는 answer_rank 단독으로 끝

구성:
- functions/lib/rank.js : (1) answer_rank 스키마 자동 보정(컬럼/인덱스) (2) 빌드 시 display_word,pos 포함 저장
- functions/api/top.js  : /api/top 조회를 answer_rank 단독 조회로 변경 (JOIN 제거)
- sql/patch_v136.sql    : 수동 적용용(선택). 자동 보정이 있으므로 꼭 실행할 필요는 없음.

적용:
1) functions/lib/rank.js 덮어쓰기
2) functions/api/top.js 덮어쓰기
3) 배포
4) 한 번만 /api/top?limit=10&build=1 실행 (오늘자 랭킹 재생성)
5) /api/top?limit=10 확인 (이제 CPU limit 거의 발생하지 않음)

주의:
- build=1은 개발/관리자용이므로 운영 전환 시 관리자 키로 잠그는 것을 권장
