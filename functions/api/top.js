import { json, seoulDateKey, getDailyAnswer, similarityScore, resolveKV } from './_common.js';

async function tableColumns(DB, table){
  const { results } = await DB.prepare(`PRAGMA table_info(${table});`).all();
  return new Set((results||[]).map(r=>String(r.name||"").toLowerCase()));
}

export async function onRequestGet({ env }){
  try{
    if (!env.DB) return json({ ok:false, message:"D1 바인딩(DB)이 없어요." }, 500);

    const dateKey = seoulDateKey();
    const ans = await getDailyAnswer(env, dateKey);
    if (!ans) return json({ ok:false, message:"정답 생성 실패" }, 500);

    const kv = resolveKV(env);
    const cacheKey = `top100:${dateKey}`;
    if (kv){
      const cached = await kv.get(cacheKey);
      if (cached){
        return json({ ok:true, dateKey, answer:{ word: ans.word, pos: ans.pos||null, level: ans.level||null }, items: JSON.parse(cached) });
      }
    }

    // Build top100 (best-effort). Prefer tokens/rel_tokens on entries table if present.
    const cols = await tableColumns(env.DB, "entries");
    if (!cols.has("tokens") || !cols.has("rel_tokens")){
      // Fallback: no bulk tokens available; return empty list rather than timeout.
      const items = [];
      if (kv) await kv.put(cacheKey, JSON.stringify(items), { expirationTtl: 60 * 60 * 24 * 2 });
      return json({ ok:true, dateKey, answer:{ word: ans.word, pos: ans.pos||null, level: ans.level||null }, items });
    }

    const limitPos = ans.pos || null;
    const limitLevel = ans.level || null;

    // Narrow a bit to keep it fast (same pos/level if available)
    const where = [];
    const args = [];
    if (limitPos && cols.has("pos")) { where.push("pos = ?"); args.push(limitPos); }
    if (limitLevel && cols.has("level")) { where.push("level = ?"); args.push(limitLevel); }

    const sql = `SELECT word, pos, level, tokens, rel_tokens FROM entries ${where.length?("WHERE "+where.join(" AND ")):""}`;
    const { results } = await env.DB.prepare(sql).bind(...args).all();

    const items = [];
    for (const r of (results||[])){
      const w = r.word;
      if (!w || w === ans.word) continue;
      let tokens=[], rel=[];
      try{ tokens = JSON.parse(r.tokens||"[]"); }catch{ tokens=[]; }
      try{ rel = JSON.parse(r.rel_tokens||"[]"); }catch{ rel=[]; }

      const score = similarityScore({ word:w, tokens, rel_tokens:rel }, ans);
      let percent = Math.round(score*100);
      if (percent > 100) percent = 100;
      if (percent < 0) percent = 0;
      if (percent >= 100) percent = 99; // 정답 제외

      items.push({ word: w, percent, pos: r.pos||null, level: r.level||null });
    }

    items.sort((a,b)=> (b.percent-a.percent) || (a.word.localeCompare(b.word)));
    const top = items.slice(0, 100);

    if (kv) await kv.put(cacheKey, JSON.stringify(top), { expirationTtl: 60 * 60 * 24 * 2 });

    return json({ ok:true, dateKey, answer:{ word: ans.word, pos: ans.pos||null, level: ans.level||null }, items: top });
  }catch(e){
    return json({ ok:false, message:"top 오류", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}
