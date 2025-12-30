// functions/api/meta.js
import { json, ensureTodayAnswer } from "./_common.js";

export async function onRequestGet({ env }) {
  try {
    const { dateKey, answer } = await ensureTodayAnswer(env);

    return json({
      ok: true,
      dateKey,
      answerLen: (answer.word || "").length,
      answerPos: answer.pos || "불명",
      answerLevel: answer.level || "없음",
    });
  } catch (e) {
    return json({ ok: false, message: `meta 실패: ${e?.message || e}` }, 500);
  }
}
