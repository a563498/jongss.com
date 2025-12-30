import { json, seoulDateKey, getDailyAnswer, d1GetByWord, similarityScore, scoreToPercent, normalizeWord } from './_common.js';

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

    const isCorrect = g.word === ans.word;

    const score = similarityScore(g, ans);
    const percent = scoreToPercent(score, { isCorrect });

    const deltaLen = g.word.length - ans.word.length;
    const lenHint = deltaLen === 0 ? "같음" : (deltaLen > 0 ? "정답보다 김" : "정답보다 짧음");

    return json({
      ok:true,
      data:{
        word: g.word,
        percent,
        isCorrect,
        clues:{
          글자수: { answer: ans.word.length, input: g.word.length, delta: deltaLen, text: lenHint }
        }
      }
    });
  }catch(e){
    return json({ ok:false, message:"guess 오류", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}
