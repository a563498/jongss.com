import { json, seoulDateKey, getDailyAnswer, ensureAnswerRank, getAnswerRankTop } from './_common.js';

export async function onRequestGet(context){
  const { env, request, waitUntil } = context;
  try{
    if (!env.DB) {
      return json({ ok:false, message:"D1 바인딩(DB)이 없어요. Pages > Settings > Bindings에서 D1을 연결하세요." }, 500);
    }

    const url = new URL(request.url);
    const reqLimit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") || "10")));
    const dateKey = seoulDateKey();

    const ans = await getDailyAnswer(env, dateKey);

    const topK = Number(env?.RANK_TOPK || 5000);
    const candidateLimit = Number(env?.RANK_CANDIDATE_LIMIT || 12000);

    const wantsBuild = (url.searchParams.get("build") === "1") || (url.searchParams.get("debug") === "1");
    let build = null;

    if (wantsBuild){
      build = await ensureAnswerRank(env, dateKey, { topK, candidateLimit });
    } else {
      try{
        if (typeof waitUntil === 'function') {
          waitUntil(ensureAnswerRank(env, dateKey, { topK, candidateLimit }));
        }
      } catch {}
    }

    const items = await getAnswerRankTop(env, dateKey, reqLimit);

    const payload = {
      ok: true,
      dateKey,
      answer: ans ? { word: ans.word, pos: ans.pos || null, level: ans.level || null } : null,
      items,
    };
    if (build) payload.build = build;

    return json(payload);
  } catch(e) {
    return json({ ok:false, message:"top 오류", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}
