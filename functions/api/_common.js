// functions/api/_common.js
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function bad(message, status = 400, extra = {}) {
  return json({ ok: false, message, ...extra }, status);
}

export function kstDateKey(now = new Date()) {
  // KST 기준 YYYY-MM-DD
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function normalizeWord(s) {
  s = (s || "").toString().trim();
  s = s.replace(/[\u200b-\u200f\uFEFF]/g, ""); // zero-width
  s = s.replace(/\s+/g, " ");
  return s;
}

function bigrams(word) {
  const w = normalizeWord(word);
  const arr = [];
  for (let i = 0; i < w.length - 1; i++) arr.push(w.slice(i, i + 2));
  return arr;
}

export function similarityPercent(a, b) {
  // 0~100: 한글 단어에 무난한 bigram Jaccard
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;

  const m = new Map();
  for (const x of A) m.set(x, (m.get(x) || 0) + 1);

  let inter = 0;
  for (const x of B) {
    const c = m.get(x) || 0;
    if (c > 0) {
      inter++;
      m.set(x, c - 1);
    }
  }
  const union = A.length + B.length - inter;
  const score = union ? inter / union : 0;
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

async function d1GetCountCandidates(DB) {
  const r = await DB.prepare(
    "SELECT COUNT(*) AS c FROM entries WHERE is_candidate=1"
  ).first();
  return Number(r?.c || 0);
}

async function d1PickCandidateByOffset(DB, offset) {
  return DB.prepare(
    "SELECT id, word, pos, level FROM entries WHERE is_candidate=1 LIMIT 1 OFFSET ?"
  )
    .bind(offset)
    .first();
}

async function d1PickDefinition(DB, entryId) {
  // 대표 뜻 1개
  const r = await DB.prepare(
    `SELECT definition
     FROM senses
     WHERE entry_id = ?
     ORDER BY (sense_no IS NULL) ASC, sense_no ASC, id ASC
     LIMIT 1`
  )
    .bind(entryId)
    .first();
  const def = (r?.definition || "").toString().trim();
  return def || null;
}

export async function ensureTodayAnswer(env) {
  const { DB, TTEUTGYOP_KV } = env;
  const dateKey = kstDateKey();
  const kvKey = `answer:${dateKey}`;

  // 1) KV에 있으면 그대로 사용
  const cached = await TTEUTGYOP_KV.get(kvKey, "json");
  if (cached?.word) return { dateKey, answer: cached, from: "kv" };

  // 2) 없으면 D1에서 랜덤 후보 선택
  const total = await d1GetCountCandidates(DB);
  if (!total) throw new Error("DB 후보 단어가 0개입니다(is_candidate=1 없음).");

  const offset = Math.floor(Math.random() * total);
  const row = await d1PickCandidateByOffset(DB, offset);
  if (!row?.word) throw new Error("정답 후보 선택 실패(DB 반환 비정상).");

  const definition = await d1PickDefinition(DB, row.id);

  const answer = {
    word: row.word,
    entryId: row.id,
    pos: row.pos || "불명",
    level: row.level || "없음",
    definition: definition || null,
    createdAt: new Date().toISOString(),
  };

  // 3) KV 저장(오늘 하루 고정)
  await TTEUTGYOP_KV.put(kvKey, JSON.stringify(answer));

  return { dateKey, answer, from: "db" };
}

export async function lookupEntry(env, word) {
  const { DB } = env;
  const w = normalizeWord(word);
  if (!w) return null;

  // 단어 자체가 여러 엔트리일 수 있음 → 후보 1개만
  const row = await DB.prepare(
    `SELECT id, word, pos, level
     FROM entries
     WHERE word = ?
     ORDER BY (pos IS NULL) ASC, id ASC
     LIMIT 1`
  )
    .bind(w)
    .first();

  if (!row?.id) return null;

  const defRow = await DB.prepare(
    `SELECT definition
     FROM senses
     WHERE entry_id = ?
     ORDER BY (sense_no IS NULL) ASC, sense_no ASC, id ASC
     LIMIT 1`
  )
    .bind(row.id)
    .first();

  return {
    entryId: row.id,
    word: row.word,
    pos: row.pos || "불명",
    level: row.level || "없음",
    definition: (defRow?.definition || "").toString().trim() || null,
  };
}
