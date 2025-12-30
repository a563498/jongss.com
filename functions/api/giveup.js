// functions/api/giveup.js
import { json, ensureTodayAnswer } from "./_common.js";

export async function onRequestGet({ env }) {
  try {
    const { dateKey, answer } = await ensureTodayAnswer(env);
    return json({
      ok: true,
      dateKey,
      answer: {
        word: answer.word,
        pos: answer.pos || "불명",
        level: answer.level || "없음",
        definition: answer.definition || null,
      },
    });
  } catch (e) {
    return json({ ok: false, message: `giveup 실패: ${e?.message || e}` }, 500);
  }
}
