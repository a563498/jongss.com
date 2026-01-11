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
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 10)));
    const build = url.searchParams.get('build') === '1';
    const dateKey = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD

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
      SELECT word_id, rank, score, display_word, pos
      FROM answer_rank
      WHERE date_key = ?
      ORDER BY rank
      LIMIT ?
    `).bind(dateKey, limit).all();

    return json({ ok: true, dateKey, items: rows?.results ?? [] });
  } catch (err) {
    return json({ ok: false, message: 'top 오류', detail: String(err?.message ?? err) }, 500);
  }
}
