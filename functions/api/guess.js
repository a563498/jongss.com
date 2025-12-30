// functions/api/guess.js
import {
  json,
  bad,
  ensureTodayAnswer,
  lookupEntry,
  similarityPercent,
  normalizeWord,
} from "./_common.js";

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const input = normalizeWord(url.searchParams.get("word") || "");
    if (!input) return bad("word 파라미터가 비었어요.");

    // 오늘 정답 보장(없으면 생성)
    const { answer } = await ensureTodayAnswer(env);

    // 입력 단어 DB 조회
    const entry = await lookupEntry(env, input);
    if (!entry) {
      return json({
        ok: true,
        data: {
          word: input,
          percent: 0,
          isCorrect: false,
          notFound: true,
          message: "사전에 없는 단어예요.",
        },
      });
    }

    const isCorrect = entry.word === answer.word;
    let percent = similarityPercent(entry.word, answer.word);

    // 힌트/보정(품사 같으면 약간 가산)
    if (entry.pos && answer.pos && entry.pos === answer.pos) {
      percent = Math.min(100, percent + 5);
    }
    if (isCorrect) percent = 100;

    const clues = {
      글자수: {
        answer: (answer.word || "").length,
        input: (entry.word || "").length,
        delta: (entry.word || "").length - (answer.word || "").length,
        text:
          (entry.word || "").length === (answer.word || "").length
            ? "같음"
            : (entry.word || "").length > (answer.word || "").length
            ? `입력(${(entry.word || "").length})이 더 김`
            : `입력(${(entry.word || "").length})이 더 짧음`,
      },
      품사: {
        answer: answer.pos || "불명",
        input: entry.pos || "불명",
        text:
          (answer.pos || "") && (entry.pos || "") && answer.pos === entry.pos
            ? "같음"
            : "다름/불명",
      },
      난이도: {
        answer: answer.level || "없음",
        input: entry.level || "없음",
        text:
          (answer.level || "") &&
          (entry.level || "") &&
          answer.level === entry.level
            ? "같음"
            : "다름/불명",
      },
    };

    return json({
      ok: true,
      data: {
        word: entry.word,
        percent,
        isCorrect,
        clues,
      },
    });
  } catch (e) {
    return json({ ok: false, message: `guess 실패: ${e?.message || e}` }, 500);
  }
}
