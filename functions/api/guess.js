import { json, seoulDateKey, getDailyAnswer, d1GetByWord, similarityScore, scoreToPercent, normalizeWord, getAnswerRankByWord, ensureAnswerRank } from './_common.js';

export async function onRequestGet(context){
  const { request, env, waitUntil } = context;
  try{
    if (!env.DB) return json({ ok:false, message:"D1 바인딩(DB)이 없어요." }, 500);

    const url = new URL(request.url);
    const raw = url.searchParams.get("word") || "";
    const w = normalizeWord(raw);
    if (!w) return json({ ok:false, message:"단어를 입력하세요." }, 400);

    const dateKey = seoulDateKey();
    const ans = await getDailyAnswer(env, dateKey);
    if (!ans) return json({ ok:false, message:"정답 생성 실패" }, 500);

    const g = await d1GetByWord(env.DB, w);
    if (!g) return json({ ok:false, message:"사전에 없는 단어예요." }, 404);

    const isCorrect = g.word === ans.word;
    if (isCorrect) {
      return json({ ok:true, data:{ word: g.word, percent: 100, rank: 1, isCorrect:true } });
    }

    // 1) 랭킹 테이블에 있으면 그 값을 사용 (빠름)
    let rankRow = null;
    try{
      rankRow = await getAnswerRankByWord(env, dateKey, g.word);
    } catch {}

    if (!rankRow) {
      // 랭킹이 아직 없으면 background로 생성만 킥 (첫 추론이 '씹히지' 않도록)
      try{
        if (typeof waitUntil === 'function') {
          const topK = Number(env?.RANK_TOPK || 5000);
          const candidateLimit = Number(env?.RANK_CANDIDATE_LIMIT || 12000);
          waitUntil(ensureAnswerRank(env, dateKey, { topK, candidateLimit }));
        }
      } catch {}
    }

    // 2) percent: 랭킹이 있으면 rank 기반 percent, 없으면 즉석 유사도(절대값)
    let percent = 0;
    let rank = null;
    if (rankRow) {
      percent = rankRow.percent || 0;
      rank = typeof rankRow.rank === 'number' ? rankRow.rank : null;
    } else {
      const score = similarityScore(g, ans);
      percent = scoreToPercent(score, { isCorrect:false });
    }

    return json({ ok:true, data:{ word: g.word, percent, rank, isCorrect:false } });
  } catch(e) {
    return json({ ok:false, message:"guess 오류", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}
