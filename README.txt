사잇말 v1.3.4 핫픽스 (1101 제거 + top/build 에러 JSON화)

증상:
- /api/top?limit=10 또는 /api/top?limit=10&build=1 호출 시 Error 1101(Worker exception)

원인:
- top 엔드포인트에서 예외가 try/catch 없이 발생하면 Cloudflare가 1101로 처리(사용자에게 원인 미노출)

수정:
- functions/api/top.js 전체를 try/catch로 감싸고,
  실패 시 JSON {ok:false, message, detail} 반환
- build=1 경로도 동일하게 예외를 JSON으로 반환

포함 파일:
- functions/api/top.js

적용:
1) functions/api/top.js 덮어쓰기
2) 재배포
3) /api/top?limit=10 (build 없이) 확인
