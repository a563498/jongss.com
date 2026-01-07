import { json, seoulDateKey, getDailyAnswer, d1GetByWord, similarityScore, getDbTop, normalizeWord, getRankForWord } from './_common.js';

export async function onRequestGet({ request, env }){
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


    // answer_rank(일일 랭킹)가 없으면 여기서 1회 생성됩니다.
    await getDbTop(env, dateKey, { limit: 1 });

    const isCorrect = g.word === ans.word;
    let rank = null;
    let percent = 0;
    if (isCorrect) {
      rank = 1;
      percent = 100;
    } else {
      const r = await getRankForWord(env, dateKey, g.id);
      rank = r.rank;
      percent = r.percent;
    }

    return json({ ok:true, data:{ word: g.word, percent, rank, isCorrect } });
  }catch(e){
    return json({ ok:false, message:"guess 오류", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}