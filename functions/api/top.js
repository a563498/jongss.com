import { buildAnswerRank } from '../lib/rank.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet({ env, request }) {
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') ?? 10)));
    const build = url.searchParams.get('build') === '1';

    // dateKey: UTC 기준 YYYY-MM-DD
    const dateKey = new Date().toISOString().slice(0, 10);

    if (build) {
      const ans = await env.DB.prepare(`
        SELECT word_id FROM answer_pool
        WHERE is_active = 1
        ORDER BY last_used_at IS NULL DESC, last_used_at ASC, weight DESC
        LIMIT 1
      `).first();

      if (!ans?.word_id) return json({ ok: false, message: '정답 없음' }, 500);

      const res = await buildAnswerRank({ env, dateKey, answerWordId: ans.word_id });
      return json({ ok: true, dateKey, build: res });
    }

    const rows = await env.DB.prepare(`
      SELECT ar.word_id, ar.rank, ar.score,
             le.display_word, le.pos
      FROM answer_rank ar
      JOIN lex_entry le ON le.entry_id = ar.word_id
      WHERE ar.date_key = ?
      ORDER BY ar.rank
      LIMIT ?
    `).bind(dateKey, limit).all();

    return json({
      ok: true,
      dateKey,
      items: rows?.results ?? [],
    });
  } catch (err) {
    return json(
      { ok: false, message: 'top 오류', detail: String(err?.message ?? err) },
      500
    );
  }
}
