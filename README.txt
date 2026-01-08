사잇말 v1.3.2 핫픽스

증상:
- /api/top?build=1 실행 시
  D1_ERROR: UNIQUE constraint failed: answer_rank.date_key, answer_rank.word_id

원인:
- answer_sense_fts는 (word_id, sense_rank) 단위로 결과가 나오므로
  동일 word_id가 여러 sense 때문에 여러 번 등장 → answer_rank에 동일 (date_key, word_id)를 중복 INSERT

수정:
- FTS 결과를 word_id 단위로 집계(MIN score)하여 중복 제거 후 랭킹 생성
- JS에서도 Set으로 한 번 더 중복 방지

포함 파일(수정된 파일만):
- functions/lib/rank.js

적용:
1) functions/lib/rank.js 덮어쓰기
2) 재배포 후 /api/top?limit=10&build=1 다시 실행
