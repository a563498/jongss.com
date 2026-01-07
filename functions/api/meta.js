import { json, seoulDateKey, getDailyAnswer, ensureAnswerRank, getAnswerRankTop } from './_common.js';

export async function onRequestGet(context){
  const { env, waitUntil } = context;
  try{
    if (!env.DB) {
      return json({ ok:false, message:"D1 바인딩(DB)이 없어요. Pages > Settings > Bindings에서 D1을 연결하세요." }, 500);
    }

    const dateKey = seoulDateKey();
    const ans = await getDailyAnswer(env, dateKey);
    if (!ans) {
      return json({ ok:false, message:"정답 생성 실패(DB에 단어가 없어요). DB 업로드를 확인하세요." }, 500);
    }

    // 랭킹 생성은 응답을 блок 하지 않도록 background로 킥(가능한 환경에서만)
    try{
      if (typeof waitUntil === 'function') {
        const topK = Number(env?.RANK_TOPK || 5000);
        const candidateLimit = Number(env?.RANK_CANDIDATE_LIMIT || 12000);
        waitUntil(ensureAnswerRank(env, dateKey, { topK, candidateLimit }));
      }
    } catch {}

    // 랭킹이 아직 없거나(생성 중), 스키마가 어긋난 경우에도 meta는 실패하면 안 됨
    // bestDB는 "현재 1등 유사도" 정도의 참고값이므로 best-effort로만 시도
    let bestDB = 0;
    try{
      const top1 = await getAnswerRankTop(env, dateKey, 1);
      bestDB = (top1 && top1[0]) ? (top1[0].percent || 0) : 0;
    }catch{}

    return json({
      ok: true,
      dateKey,
      answerLen: ans.word.length,
      answerPos: ans.pos || null,
      answerLevel: ans.level || null,
      bestDB,
    });
  } catch(e) {
    return json({ ok:false, message:"meta 오류", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}
