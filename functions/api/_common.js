// Shared helpers for Pages Functions (Workers)

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function seoulDateKey() {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------- normalization / tokenize ----------------
const HANGUL_SEQ = /[가-힣]+/g;

// 너무 흔한 기능어/보조용언(정의/예문 토큰화에서 제거)
const STOP = new Set(["그리고", "그래서", "하지만", "그러나", "또는", "및", "등", "것", "것들", "사람", "사람들", "경우", "때문", "위해", "대한", "관련", "있다", "없다", "하다", "되다", "하게", "하기", "했다", "했다", "한다", "된다", "이다", "이며", "이고", "이다며", "한다며", "그것", "이것", "저것", "여기", "저기", "거기", "어떤", "이러한", "그런", "저런", "같은", "말", "일", "것임", "정도", "수", "등등", "때", "동안", "사이", "이후", "이전", "전후", "모두", "모든", "각", "여러", "여러가지", "사용", "쓰다", "쓰이다", "이용", "대하다", "관한", "포함", "및또", "또한", "더", "더욱", "매우", "정말"]);

// 한 글자라도 의미가 큰 토큰(연/월/일/년/해 등)
const SINGLE_KEEP = new Set(["년", "해", "월", "일", "봄", "여름", "가을", "겨울"]);

// 사람 기준 '유사하다'고 느끼는 대표 동의(정규화)
const SYN = new Map([
  // 시간
  ["금년", "올해"],
  ["금일", "오늘"],
  ["당년", "올해"],
  ["명년", "내년"],
  ["익년", "내년"],
  ["내년도", "내년"],
  ["지난해", "작년"],
  ["전년", "작년"],
  ["작년도", "작년"],
  ["명일", "내일"],
  ["작일", "어제"],
  // 기타 자주 나오는 표기
  ["대한민국", "한국"],
  // 연도/시점
  ["내년", "다음해"],
  ["명년", "다음해"],
  ["내후년", "다다음해"],
  ["금년도", "올해"],
  // 의미군(가벼운 정규화)
  ["디자인", "설계"],
  ["디자이너", "설계자"],
  ["포토샵", "그래픽"],
  ["일러스트", "그림"],
]);

function normToken(t) {
  t = (t || "").trim();
  if (!t) return "";
  // 동의어 정규화
  if (SYN.has(t)) return SYN.get(t);
  return t;
}

export function normalizeWord(w) {
  return (w || "").trim().replace(/\s+/g, "");
}


const TRAIL_STRIP = [
  "으로서","으로써","으로부터","로부터","으로","로","에서","에게서","에게","께서","께","까지","부터","만큼","같이","처럼","보다","조차","마저","라도","이나","나","이나마",
  "으로는","로는","에는","에선","에서는","에는","에서의","의","을","를","은","는","이","가","과","와","도","만","에","로","으로","서","께","한테","한테서"
];
function stripParticle(tok){
  tok = (tok||"").trim();
  if (tok.length < 2) return tok;
  for (const suf of TRAIL_STRIP){
    if (tok.length > suf.length && tok.endsWith(suf)){
      return tok.slice(0, tok.length - suf.length);
    }
  }
  return tok;
}

const CONCEPT = new Map([
  // 디자인/시각/꾸밈
  ["꾸미다","디자인"],["꾸밈","디자인"],["장식","디자인"],["장식하다","디자인"],
  ["그림","디자인"],["사진","디자인"],["도안","디자인"],["도면","디자인"],["미술","디자인"],["예술","디자인"],["패션","디자인"],["옷","디자인"],
  ["컴퓨터","디자인"],["프로그램","디자인"],["그래픽","디자인"],["포토샵","디자인"],["편집","디자인"],["이미지","디자인"],

  // 시간(즉시/짧은 간격)
  ["금방","짧은시간"],["방금","짧은시간"],["곧","짧은시간"],["즉시","짧은시간"],["당장","짧은시간"],["얼른","짧은시간"],
  ["순식간","짧은시간"],["잠시","짧은시간"],["찰나","짧은시간"],["금세","짧은시간"],["바로","짧은시간"],["즉각","짧은시간"],
  ["당장에","짧은시간"],["순간","짧은시간"],
  ["시간","짧은시간"],["때","짧은시간"],["시각","짧은시간"],["잠깐","짧은시간"],["조금","짧은시간"],["잠시후","짧은시간"],["곧바로","짧은시간"],
  ["지금","짧은시간"],["현재","짧은시간"],

  // 시간 개념 확장
  ["오늘","시간개념"],["내일","시간개념"],["어제","시간개념"],["지금","시간개념"],["현재","시간개념"],
  ["시간","시간개념"],["순간","시간개념"],["간격","시간개념"],["기간","시간개념"],["잠깐","시간개념"],

  // 시간/연도
  ["올해","연도"],["금년","연도"],["다음해","연도"],["내년","연도"],["다다음해","연도"],["내후년","연도"],["작년","연도"],["전년","연도"],
]);


// 매우 빈번한 토큰(정의 어디에나 나와서 유사도를 망치는 것들)
// - STOP과 별개로 "의미 판별"에서만 추가로 제외
const COMMON = new Set([
  "사람","가축","동물","식물","것","일","말","수","때","곳","모양","상태","방법","경우",
  "사용","쓰다","쓰이다","이용","하여","해서","하며","한다","되는","된다","이다",
  "어떤","이러한","그런","같은","정도","모두","모든","여러","가능","불가능",
  "하다","되다","있다","없다","위해","대한","관련","포함","가리키다","뜻하다"
]);

// 시간/순간/즉시 계열 키워드(사람이 느끼는 '시간적 근접' 유사도 보강)
const TIME_KW = new Set([
  "시간","때","순간","찰나","잠시","잠깐","금방","방금","금세","곧","이내","바로","즉시","즉각","당장","얼른",
  "지금","오늘","내일","어제","방금전","곧바로","순식간","재빨리","빨리","늦게","일찍"
]);

function timeKeywordScore(gAll, aAll){
  // '금방(즉시/짧은 간격)' vs '오늘/내일(일자)' 같은 경우는
  // 단순 교집합이 0이라도 사람 기준으로는 어느 정도 연상이 된다.
  const g = new Set((gAll||[]).filter(t=>TIME_KW.has(t)));
  const a = new Set((aAll||[]).filter(t=>TIME_KW.has(t)));
  if (!g.size || !a.size) return 0;

  // 그룹 정의
  const GROUP = new Map([
    // 즉시/짧은 간격
    ["금방","immediate"],["방금","immediate"],["금세","immediate"],["곧","immediate"],["이내","immediate"],["바로","immediate"],
    ["즉시","immediate"],["즉각","immediate"],["당장","immediate"],["얼른","immediate"],["재빨리","immediate"],["빨리","immediate"],
    ["곧바로","immediate"],["순식간","immediate"],
    // 일자/상대일
    ["오늘","day"],["내일","day"],["어제","day"],
    // 일반 시간/시점
    ["지금","now"],["일찍","now"],["늦게","now"],
    ["시간","time"],["때","time"],["순간","time"],["찰나","time"],["잠시","time"],["잠깐","time"],["방금전","time"],
  ]);

  const groupOf = (t)=> GROUP.get(t) || "time";

  // 동일 그룹: 강함, 다른 그룹: 약함(하지만 0은 아님)
  const pairScore = (g1, g2)=>{
    if (g1 === g2) return 1.0;
    const key = `${g1}|${g2}`;
    const rev = `${g2}|${g1}`;
    if (key === "immediate|now" || rev === "immediate|now") return 0.75;
    if (key === "immediate|time" || rev === "immediate|time") return 0.60;
    if (key === "immediate|day" || rev === "immediate|day") return 0.35;
    if (key === "day|time" || rev === "day|time") return 0.55;
    if (key === "day|now" || rev === "day|now") return 0.45;
    if (key === "now|time" || rev === "now|time") return 0.70;
    return 0.40;
  };

  // 각 키워드 쌍 중 최대 유사도
  let best = 0;
  for (const gt of g){
    const gg = groupOf(gt);
    for (const at of a){
      const ag = groupOf(at);
      best = Math.max(best, pairScore(gg, ag));
    }
  }

  // 교집합(정확히 같은 키워드)이 있으면 추가 보너스
  let inter = 0;
  for (const t of g) if (a.has(t)) inter++;
  const bonus = inter ? Math.min(0.25, inter * 0.12) : 0;

  return Math.max(0, Math.min(1, best + bonus));
}


// CONCEPT 값(개념 토큰) 집합: '짧은시간' 같은 개념 겹침을 강하게 보상하기 위함
const CONCEPT_VALUES = new Set(Array.from(new Set(Array.from(CONCEPT.values()))));

function expandConcepts(tokens){
  const out = [];
  for (const t0 of (tokens||[])){
    const t = normToken(stripParticle(t0));
    if (!t) continue;
    out.push(t);
    const c = CONCEPT.get(t);
    if (c) out.push(c);
  }
  return out;
}

function cosineBigrams(a,b){
  a = (a||""); b=(b||"");
  const A = bigramCounts(a);
  const B = bigramCounts(b);
  let dot=0, na=0, nb=0;
  for (const [k,v] of Object.entries(A)){ na += v*v; }
  for (const [k,v] of Object.entries(B)){ nb += v*v; }
  for (const [k,v] of Object.entries(A)){ if (B[k]) dot += v*B[k]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}
function bigramCounts(s){
  // 한글/영문/숫자만 남기고 bigram
  const clean = (s||"").toLowerCase().replace(/[^0-9a-z가-힣]+/g," ");
  const grams = {};
  for (const part of clean.split(/\s+/)){
    if (!part) continue;
    const arr = toBigrams(part);
    for (const g of arr){
      grams[g]=(grams[g]||0)+1;
    }
  }
  return grams;
}

function tokenize(text) {
  text = text || "";
  HANGUL_SEQ.lastIndex = 0;
  const out = [];
  let m;
  while ((m = HANGUL_SEQ.exec(text)) !== null) {
    const w = m[0];
    if (!w) continue;
    if (w.length === 1 && !SINGLE_KEEP.has(w)) continue;
    if (STOP.has(w)) continue;
    out.push(normToken(stripParticle(w)));
  }
  HANGUL_SEQ.lastIndex = 0;
  return out;
}

function safeJsonArray(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ---------------- schema helpers ----------------
// This project originally used `entries`/`senses`.
// After switching to 우리말샘 + 표준국어대사전 적재본에서는
// `lex_entry` / `answer_pool` / `answer_sense` 계열 테이블을 사용합니다.
// UI를 바꾸지 않고 내부만 교체하기 위해 런타임에서 스키마를 자동 감지합니다.

const _cache = {
  schema: null,
  colsByTable: new Map(),
};

async function tableColumns(DB, table) {
  const key = String(table);
  if (_cache.colsByTable.has(key)) return _cache.colsByTable.get(key);
  const rows = await DB.prepare(`PRAGMA table_info(${key})`).all();
  const set = new Set();
  for (const r of rows?.results || []) {
    if (r?.name) set.add(String(r.name));
  }
  _cache.colsByTable.set(key, set);
  return set;
}

async function tableExists(DB, table) {
  try {
    // SQLite: sqlite_master is available in D1.
    const row = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1"
    )
      .bind(String(table))
      .first();
    return !!row?.name;
  } catch {
    return false;
  }
}

async function resolveSchema(DB) {
  if (_cache.schema) return _cache.schema;

  // v1
  if (await tableExists(DB, "entries")) {
    _cache.schema = {
      kind: "v1",
      entries: "entries",
      senses: (await tableExists(DB, "senses")) ? "senses" : null,
      pool: null,
    };
    return _cache.schema;
  }

  // v2 (우리말샘/표준국어대사전 적재본)
  if (await tableExists(DB, "lex_entry")) {
    _cache.schema = {
      kind: "v2",
      entries: "lex_entry",
      // answer_sense preferred; some pipelines may name it lex_sense
      senses: (await tableExists(DB, "answer_sense"))
        ? "answer_sense"
        : ((await tableExists(DB, "lex_sense")) ? "lex_sense" : null),
      pool: (await tableExists(DB, "answer_pool")) ? "answer_pool" : null,
    };
    return _cache.schema;
  }

  throw new Error(
    "DB 스키마를 인식할 수 없어요. (entries/lex_entry 테이블이 없습니다)"
  );
}

async function entriesColumns(DB) {
  const s = await resolveSchema(DB);
  return tableColumns(DB, s.entries);
}

async function sensesColumns(DB) {
  const s = await resolveSchema(DB);
  if (!s.senses) return new Set();
  return tableColumns(DB, s.senses);
}

function pickCol(cols, candidates, fallback = null) {
  for (const c of candidates) {
    if (c && cols.has(c)) return c;
  }
  if (fallback && cols.has(fallback)) return fallback;
  return null;
}

function mustCol(cols, candidates, label) {
  const c = pickCol(cols, candidates, null);
  if (!c) {
    throw new Error(
      `DB 스키마 불일치: ${label} 컬럼을 찾을 수 없어요. (candidates=${candidates.join(
        ","
      )})`
    );
  }
  return c;
}

// ---------------- senses loader (v1 schema 지원) ----------------
async function loadSenseByEntryId(DB, entryId) {
  const schema = await resolveSchema(DB);
  const sCols = await sensesColumns(DB);
  if (!sCols || sCols.size === 0) return { definition: "", example: "" };

  const fk = pickCol(
    sCols,
    // v1: entry_id 계열, v2: word_id 계열
    ["entry_id", "entryId", "eid", "entry", "entries_id", "entryid", "word_id", "wordid"],
    null
  );
  const defCol = pickCol(
    sCols,
    ["definition", "def", "mean", "meaning", "sense_definition", "definition_text"],
    null
  );
  const exCol = pickCol(
    sCols,
    ["example", "examples", "exam", "ex", "example_text", "example_sentence", "example1", "ex1"],
    null
  );
  const ord = pickCol(sCols, ["sense_no", "senseNo", "ord", "order_no", "order", "seq", "id"], null);

  if (!fk || !defCol) return { definition: "", example: "" };

  const select = [`${defCol} AS definition`, exCol ? `${exCol} AS example` : `'' AS example`].join(", ");
  const orderBy = ord ? `ORDER BY ${ord} ASC` : "";
  const senseTable = schema.senses;
  if (!senseTable) return { definition: "", example: "" };
  const sql = `SELECT ${select} FROM ${senseTable} WHERE ${fk} = ? ${orderBy} LIMIT 1`;
  const row = await DB.prepare(sql).bind(entryId).first();
  return { definition: row?.definition || "", example: row?.example || "" };
}

// ---------------- core: pick daily answer ----------------
export async function pickDailyAnswer(DB, dateKey) {
  const schema = await resolveSchema(DB);

  // --- v2: answer_pool이 있으면 "정답 후보"는 pool에서만 뽑는다 ---
  // (우리말샘/표준국어대사전 적재본에서 실제 게임용 풀 테이블)
  if (schema.kind === "v2" && schema.pool) {
    const pCols = await tableColumns(DB, schema.pool);
    const eCols = await entriesColumns(DB);

    const pidCol = mustCol(pCols, ["word_id", "wordid", "id", "entry_id"], "pool.word_id");
    const pWordCol = mustCol(pCols, ["display_word", "word", "lemma", "headword"], "pool.display_word");

    // pool에서 단일 표제어만
    const baseWhere = `${pWordCol} NOT LIKE '% %'`;
    const cntRow = await DB.prepare(`SELECT COUNT(*) AS c FROM ${schema.pool} WHERE ${baseWhere}`).first();
    const c = cntRow?.c || 0;
    if (!c) return null;

    const offset = hash32("saitmal:" + dateKey) % c;
    const pickRow = await DB.prepare(
      `SELECT ${pidCol} AS id, ${pWordCol} AS word FROM ${schema.pool} WHERE ${baseWhere} LIMIT 1 OFFSET ?`
    )
      .bind(offset)
      .first();
    if (!pickRow?.id || !pickRow?.word) return null;

    // entries(lex_entry)에서 pos/level 등 가능하면 보강
    const eId = pickCol(eCols, ["word_id", "wordid", "id", "entry_id", "eid"], null);
    const eWord = pickCol(eCols, ["display_word", "word", "lemma", "headword"], null);
    const ePos = pickCol(eCols, ["pos", "part_of_speech", "pos_name", "posNm"], null);
    const eLevel = pickCol(eCols, ["level", "difficulty", "lvl"], null);

    let pos = "";
    let level = "";
    if (eId && eWord && (ePos || eLevel)) {
      const cols = [
        ePos ? `e.${ePos} AS pos` : `'' AS pos`,
        eLevel ? `e.${eLevel} AS level` : `'' AS level`,
      ].join(", ");
      const r = await DB.prepare(
        `SELECT ${cols} FROM ${schema.entries} e WHERE e.${eId} = ? OR e.${eWord} = ? LIMIT 1`
      )
        .bind(pickRow.id, pickRow.word)
        .first();
      if (r) {
        pos = r.pos || "";
        level = r.level || "";
      }
    }

    const s = await loadSenseByEntryId(DB, pickRow.id);
    const def = s.definition || "";
    const ex = s.example || "";

    return {
      id: pickRow.id,
      word: pickRow.word,
      pos,
      level,
      definition: def,
      example: ex,
      tokens: tokenize(def),
      rel_tokens: tokenize(ex),
    };
  }

  // --- v1: entries 테이블 기반 (기존 로직) ---
  const cols = await entriesColumns(DB);

  const idCol = mustCol(cols, ["id", "entry_id", "entryId", "eid", "word_id", "wordid"], "id");
  const wordCol = mustCol(cols, ["word", "lemma", "headword", "entry", "display_word"], "word");
  const posCol = pickCol(cols, ["pos", "part_of_speech", "pos_name", "posNm"], null);
  const levelCol = pickCol(cols, ["level", "difficulty", "lvl"], null);

  const hasDefinition = cols.has("definition");
  const hasExample = cols.has("example");
  const hasTokens = cols.has("tokens") && cols.has("rel_tokens");

  // count (가능하면 초급/중급 위주)
  const baseWhere = `${wordCol} NOT LIKE '% %'`;
  const whereLevel = levelCol
    ? ` WHERE ${baseWhere} AND ${levelCol} IN ('초급','중급','')`
    : ` WHERE ${baseWhere}`;
  const cntRow = await DB.prepare(`SELECT COUNT(*) AS c FROM ${schema.entries}${whereLevel}`).first();
  const c = cntRow?.c || 0;
  if (!c) return null;

  const offset = hash32("saitmal:" + dateKey) % c;

  const select = [
    `${idCol} AS id`,
    `${wordCol} AS word`,
    posCol ? `${posCol} AS pos` : `'' AS pos`,
    levelCol ? `${levelCol} AS level` : `'' AS level`,
    hasDefinition ? `definition AS definition` : `'' AS definition`,
    hasExample ? `example AS example` : `'' AS example`,
    hasTokens ? `tokens AS tokens` : `NULL AS tokens`,
    hasTokens ? `rel_tokens AS rel_tokens` : `NULL AS rel_tokens`,
  ].join(", ");

  const where = levelCol
    ? `WHERE ${baseWhere} AND ${levelCol} IN ('초급','중급','')`
    : `WHERE ${baseWhere}`;
  const row = await DB.prepare(`SELECT ${select} FROM ${schema.entries} ${where} LIMIT 1 OFFSET ?`)
    .bind(offset)
    .first();
  if (!row) return null;

  let def = row.definition || "";
  let ex = row.example || "";

  // definition/example가 senses에 있을 수 있음
  if (!hasDefinition || !def || !hasExample || !ex) {
    const s = await loadSenseByEntryId(DB, row.id);
    if (!def) def = s.definition;
    if (!ex) ex = s.example;
  }

  const tokens = row.tokens ? safeJsonArray(row.tokens) : tokenize(def);
  const rel_tokens = row.rel_tokens ? safeJsonArray(row.rel_tokens) : tokenize(ex);

  return {
    id: row.id,
    word: row.word,
    pos: row.pos || "",
    level: row.level || "",
    definition: def,
    example: ex,
    tokens,
    rel_tokens,
  };
}


export function resolveKV(env){
  // Cloudflare Pages bindings may vary by name; support legacy and current bindings.
  // NOTE: some users set the binding name with a hyphen (e.g. "saitmal-kv"), so we also check bracket access.
  return (
    env?.SAITMAL_KV ||
    env?.TTEUTGYOP_KV ||      // legacy typo (TTEUTGYOP)
    env?.TTEUTGYEOP_KV ||     // legacy (TTEUTGYEOP)
    env?.saitmal_kv ||
    env?.["saitmal-kv"] ||
    env?.["TTEUTGYOP_KV"] ||
    env?.["TTEUTGYEOP_KV"] ||
    env?.["SAITMAL_KV"]
  );
}

// ---------------- answer cache (KV) ----------------
export async function getDailyAnswer(env, dateKey) {
  if (!env?.DB) throw new Error("D1 바인딩(DB)이 없어요.");
  const kv = resolveKV(env);
  const key = `answer:${dateKey}`;

  if (kv) {
    try {
      const cached = await kv.get(key);
      if (cached) {
        const v = JSON.parse(cached);
        if (v?.word) return v;
      }
    } catch {
      // ignore cache errors
    }
  }

  const ans = await pickDailyAnswer(env.DB, dateKey);
  if (!ans) return null;

  if (kv) {
    try {
      await kv.put(key, JSON.stringify(ans), { expirationTtl: 60 * 60 * 48 }); // 48h
    } catch {
      // ignore cache errors
    }
  }
  return ans;
}

// ---------------- lookup ----------------
export async function d1GetByWord(DB, word) {
  const schema = await resolveSchema(DB);
  const q = normalizeWord(word);
  const cols = await entriesColumns(DB);
  const idCol = mustCol(cols, ["id", "entry_id", "entryId", "eid", "word_id", "wordid"], "id");
  const wordCol = mustCol(cols, ["word", "lemma", "headword", "entry", "display_word"], "word");
  const posCol = pickCol(cols, ["pos", "part_of_speech", "pos_name", "posNm"], null);
  const levelCol = pickCol(cols, ["level", "difficulty", "lvl"], null);

  const hasDefinition = cols.has("definition");
  const hasExample = cols.has("example");
  const hasTokens = cols.has("tokens") && cols.has("rel_tokens");

  const select = [
    `${idCol} AS id`,
    `${wordCol} AS word`,
    posCol ? `${posCol} AS pos` : `'' AS pos`,
    levelCol ? `${levelCol} AS level` : `'' AS level`,
    hasDefinition ? `definition AS definition` : `'' AS definition`,
    hasExample ? `example AS example` : `'' AS example`,
    hasTokens ? `tokens AS tokens` : `NULL AS tokens`,
    hasTokens ? `rel_tokens AS rel_tokens` : `NULL AS rel_tokens`,
  ].join(", ");

  const row = await DB.prepare(`SELECT ${select} FROM ${schema.entries} WHERE ${wordCol} = ? LIMIT 1`)
    .bind(q)
    .first();
  if (!row) return null;

  let def = row.definition || "";
  let ex = row.example || "";
  if (!hasDefinition || !def || !hasExample || !ex) {
    const s = await loadSenseByEntryId(DB, row.id);
    if (!def) def = s.definition;
    if (!ex) ex = s.example;
  }

  const tokens = row.tokens ? safeJsonArray(row.tokens) : tokenize(def);
  const rel_tokens = row.rel_tokens ? safeJsonArray(row.rel_tokens) : tokenize(ex);

  return {
    id: row.id,
    word: row.word,
    pos: row.pos || "",
    level: row.level || "",
    definition: def,
    example: ex,
    tokens,
    rel_tokens,
  };
}


function isSingleWordKorean(w){
  if(!w) return false;
  const s=String(w).trim();
  if(!s) return false;
  if(/\s/.test(s)) return false;
  // 한글 단일 표제어만 (사전의 구/속담 등 제외)
  if(!/^[가-힣]+$/.test(s)) return false;
  if(s.length>10) return false;
  return true;
}
// ---------------- similarity ----------------
function toBigrams(word) {
  const w = normalizeWord(word);
  const grams = [];
  for (let i = 0; i < w.length - 1; i++) grams.push(w.slice(i, i + 2));
  return grams;
}

function jaccard(a, b) {
  const A = new Set(a || []);
  const B = new Set(b || []);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter / uni : 0;
}

function overlapCoeff(a, b) {
  const A = new Set(a || []);
  const B = new Set(b || []);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const denom = Math.min(A.size, B.size);
  return denom ? inter / denom : 0;
}


function informativeIntersection(aTokens, bTokens) {
  const a = new Set((aTokens||[]).filter(t=>t && t.length>=2 && !STOP.has(t) && !COMMON.has(t) && !CONCEPT_VALUES.has(t)));
  const b = new Set((bTokens||[]).filter(t=>t && t.length>=2 && !STOP.has(t) && !COMMON.has(t) && !CONCEPT_VALUES.has(t)));
  let n=0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}
export function similarityScore(guess, answer) {
  // 표제어가 같으면 거의 동일
  const gw = normToken(guess?.word);
  const aw = normToken(answer?.word);
  if (gw && aw && gw === aw) return 1;

  // 토큰(정의/연관) 확장: 조사 제거 + 컨셉 매핑
  const gDef = expandConcepts(guess?.tokens || tokenize(guess?.definition||""));
  const aDef = expandConcepts(answer?.tokens || tokenize(answer?.definition||""));
  const gRel = expandConcepts(guess?.rel_tokens || tokenize(guess?.example||""));
  const aRel = expandConcepts(answer?.rel_tokens || tokenize(answer?.example||""));

  // 1) 정의 토큰 유사도: Jaccard + overlap(짧은 정의/동의어에 유리)
  const sDef = Math.max(jaccard(gDef, aDef), overlapCoeff(gDef, aDef));
  // 2) 예문/연관 토큰 유사도
  const sRel = Math.max(jaccard(gRel, aRel), overlapCoeff(gRel, aRel));
  // 3) 정의 텍스트의 문자 bigram cosine (표현이 달라도 가까운 문장 패턴 보정)
  const sChar = cosineBigrams(guess?.definition||"", answer?.definition||"");
  // 4) 표제어(단어) 글자 bigram
  const sW = jaccard(toBigrams(guess?.word), toBigrams(answer?.word));
  // 5) 표제어 토큰(내년/올해 등) - 조사 제거 후
  const sWTok = Math.max(
    jaccard(expandConcepts(tokenize(guess?.word)), expandConcepts(tokenize(answer?.word))),
    overlapCoeff(expandConcepts(tokenize(guess?.word)), expandConcepts(tokenize(answer?.word)))
  );

  // 6) 개념 토큰 유사도(사람이 느끼는 연상/동의어를 크게 끌어올림)
  const gAll = expandConcepts([
    ...tokenize(guess?.word || ""),
    ...(guess?.tokens || tokenize(guess?.definition || "")),
    ...(guess?.rel_tokens || tokenize(guess?.example || "")),
  ]);
  const aAll = expandConcepts([
    ...tokenize(answer?.word || ""),
    ...(answer?.tokens || tokenize(answer?.definition || "")),
    ...(answer?.rel_tokens || tokenize(answer?.example || "")),
  ]);
  const gC = gAll.filter(t => CONCEPT_VALUES.has(t));
  const aC = aAll.filter(t => CONCEPT_VALUES.has(t));
  const sConcept = Math.max(jaccard(gC, aC), overlapCoeff(gC, aC));

  // 품사 불일치 페널티(둘 다 있을 때만)
  let posPenalty = 1;
  const gp = (guess?.pos || "").trim();
  const ap = (answer?.pos || "").trim();
  if (gp && ap && gp !== ap) {
    // 품사 불일치는 강하게 감점(특히 부사 vs 비부사)
    const pair = `${gp}|${ap}`;
    const rev = `${ap}|${gp}`;
    if (gp === "부사" || ap === "부사") posPenalty = 0.18;
    else if (pair === "명사|형용사" || rev === "명사|형용사") posPenalty = 0.45;
    else if (pair === "명사|동사" || rev === "명사|동사") posPenalty = 0.35;
    else if (pair === "동사|형용사" || rev === "동사|형용사") posPenalty = 0.55;
    else posPenalty = 0.30;
  }

  // 가중치(휴리스틱): 사람 기준 '연상되는 단어' 비중을 높임
  // - 정의/예문/컨셉 토큰 중심
  // - 표제어 철자 유사도는 보조

  // '의미 없는 공통어(사람/것/하다...)' 겹침으로 점수가 튀는 것을 억제
  const sharedInfo = informativeIntersection([...gDef, ...gRel], [...aDef, ...aRel]);
  // 유의미한 공통 토큰이 거의 없으면(=연관성이 약함) 정의/예문 기반 점수를 상한 처리
  const defCap = sharedInfo >= 2 ? 1 : (sharedInfo === 1 ? 0.45 : 0.15);
  const relCap = sharedInfo >= 2 ? 1 : (sharedInfo === 1 ? 0.45 : 0.15);
  const sDef2 = Math.min(sDef, defCap);
  const sRel2 = Math.min(sRel, relCap);
  // 시간 개념(오늘/내일/방금/곧/즉시...)은 사람 기준 유사도에 큰 영향을 주므로 보강
const sTime = timeKeywordScore(gAll, aAll);

// 시간/즉시성 컨셉이 강하게 맞으면(예: 금방 ↔ 오늘/지금/방금/곧)
// 품사(부사/명사) 불일치 페널티를 완화해서 '사람 기준' 연상을 살린다.
const posPenalty2 = (posPenalty < 1 && sTime >= 0.55) ? Math.max(posPenalty, 0.85) : posPenalty;

const score = posPenalty2 * (
  0.28 * sConcept +
  0.28 * sDef2 +
  0.18 * sRel2 +
  0.10 * sWTok +
  0.16 * sTime
);

  // 낮은 점수(우연한 겹침)는 0으로 눌러서 납득 가능한 결과 유지
  return score < 0.02 ? 0 : score;
}

// 점수를 %로 변환(낮은 점수도 0%에 눌리지 않도록 비선형 스케일)
export function scoreToPercent(score, { isCorrect = false } = {}) {
  let s = Number.isFinite(score) ? score : 0;
  if (s < 0) s = 0;
  if (s > 1) s = 1;
  if (isCorrect) return 100;
  if (s <= 0) return 0;

  // 0~1을 0~100으로: pow(<1)로 저점 확장
  let p = Math.round(100 * Math.pow(s, 0.65));
  if (p >= 100) p = 99; // 정답 제외
  if (p < 0) p = 0;
  if (p > 99) p = 99;
  return p;
}

// 일일 스케일(= DB에서 뽑은 Top 후보 중 최고 raw score)을 이용해 %를 상대적으로 환산
export function scoreToPercentScaled(score, maxRaw, { isCorrect = false, minRaw = 0, rank = null } = {}) {
  if (isCorrect) return 100;
  const s = Number.isFinite(score) ? score : 0;
  const hi = Number.isFinite(maxRaw) ? maxRaw : 0;
  const lo = Number.isFinite(minRaw) ? minRaw : 0;
  if (s <= 0 || hi <= 0) return 0;

  // 1) raw 기반 정규화(상/하위 분산 확보)
  const denom = Math.max(1e-9, hi - lo);
  const r = Math.max(0, Math.min(1, (s - lo) / denom));

  // 2) 비선형(상위 쏠림 완화)
  const gamma = 1.6;
  let p = Math.round(99 * Math.pow(r, gamma));

  // 3) rank 보정(상위에서 99가 과도하게 반복되는 현상 방지)
  if (typeof rank === "number" && rank >= 1) {
    // 상위권일수록 조금씩 깎아 분배(1등은 그대로)
    const decay = Math.min(20, rank - 1);
    p = Math.max(0, p - decay);
  }

  if (p < 0) p = 0;
  if (p > 99) p = 99;
  return p;
}

// ---- Answer Rank (D1) ----
// - 한 날짜(dateKey)에 대해 1회 생성
// - 후보군(수천~수만)만 뽑아서 점수 계산 후 상위 1000개를 answer_rank에 저장
// - /api/top, /api/guess는 answer_rank를 조회해서 빠르게 응답

async function ensureAnswerRankTable(DB){
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS answer_rank (
      date_key TEXT NOT NULL,
      word_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      PRIMARY KEY (date_key, word_id)
    );
  `).run();
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_answer_rank_date_rank ON answer_rank(date_key, rank);`).run();
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_answer_rank_date_word ON answer_rank(date_key, word_id);`).run();
}

async function getRankMeta(DB, dateKey){
  const row = await DB.prepare(`SELECT MAX(score) AS maxRaw, MIN(score) AS minRaw, COUNT(*) AS c FROM answer_rank WHERE date_key=?`).bind(dateKey).first();
  return {
    count: Number(row?.c || 0),
    maxRaw: Number(row?.maxRaw || 0),
    minRaw: Number(row?.minRaw || 0),
  };
}

export async function getRankForWord(env, dateKey, wordId){
  if (!env?.DB) throw new Error("D1 바인딩(DB)이 없어요.");
  await ensureAnswerRankTable(env.DB);
  const r = await env.DB.prepare(`SELECT rank, score FROM answer_rank WHERE date_key=? AND word_id=? LIMIT 1`).bind(dateKey, wordId).first();
  if (!r) return { rank: null, score: 0, percent: 0 };
  const meta = await getRankMeta(env.DB, dateKey);
  const percent = scoreToPercentScaled(Number(r.score||0), meta.maxRaw, { isCorrect:false, minRaw: meta.minRaw, rank: Number(r.rank||0) });
  return { rank: Number(r.rank||null), score: Number(r.score||0), percent };
}

// ---- DB Top cache (answer_rank 기반) ----
export async function getDbTop(env, dateKey, { limit = 10 } = {}) {
  if (!env?.DB) throw new Error("D1 바인딩(DB)이 없어요.");
  const schema = await resolveSchema(env.DB);
  const entriesTable = schema.entries;
  const sensesTable = schema.senses;
  const kv = resolveKV(env);

  await ensureAnswerRankTable(env.DB);

  // 1) answer_rank가 이미 있으면 바로 조회
  const meta0 = await getRankMeta(env.DB, dateKey);
  if (meta0.count > 0) {
    const ans = await getDailyAnswer(env, dateKey);
    const eCols = await entriesColumns(env.DB);
    const eId = pickCol(eCols, ["id", "entry_id", "entryid", "eid", "word_id", "wordid"], "id");
    const eWord = pickCol(eCols, ["word", "lemma", "headword", "entry", "display_word"], "word");
    const sql = `
      SELECT ar.rank AS rank, ar.score AS raw, e.${eWord} AS word
      FROM answer_rank ar
      JOIN ${entriesTable} e ON e.${eId} = ar.word_id
      WHERE ar.date_key = ?
      ORDER BY ar.rank ASC
      LIMIT ?
    `;
    const res = await env.DB.prepare(sql).bind(dateKey, limit).all();

    const items = (res?.results || []).map(r => ({
      rank: Number(r.rank),
      word: r.word,
      raw: Number(r.raw||0),
      percent: scoreToPercentScaled(Number(r.raw||0), meta0.maxRaw, { isCorrect:false, minRaw: meta0.minRaw, rank: Number(r.rank) }),
    }));

    return {
      dateKey,
      answer: ans ? { word: ans.word, pos: ans.pos || null, level: ans.level || null } : null,
      maxRaw: meta0.maxRaw,
      items,
    };
  }

  // 2) 없으면 생성(=하루 1회)
  //    - KV에 "생성 중" 락을 두고 중복 계산을 줄인다(동시 접속 대비)
  const lockKey = `saitmal:ranklock:${dateKey}`;
  if (kv) {
    const locked = await kv.get(lockKey);
    if (locked) {
      // 누군가 이미 만들고 있는 중: 잠깐 후 재시도 대신 빈 응답(프론트는 0개면 자연스럽게 표시)
      const ans = await getDailyAnswer(env, dateKey);
      return { dateKey, answer: ans ? { word: ans.word, pos: ans.pos||null, level: ans.level||null } : null, maxRaw: 0, items: [] };
    }
    try { await kv.put(lockKey, '1', { expirationTtl: 60 }); } catch {}
  }

  const ans = await getDailyAnswer(env, dateKey);
  if (!ans) return { dateKey, answer: null, items: [], maxRaw: 0 };

  const eCols = await entriesColumns(env.DB);
  const sCols = await sensesColumns(env.DB);

  const eId = pickCol(eCols, ["id", "entry_id", "entryid", "eid", "word_id", "wordid"], "id");
  const eWord = pickCol(eCols, ["word", "lemma", "headword", "entry", "display_word"], "word");
  const ePos = pickCol(eCols, ["pos", "part_of_speech", "pos_name", "posnm"], null);
  const eLevel = pickCol(eCols, ["level", "difficulty", "lvl"], null);

  const eDef = pickCol(eCols, ["definition", "def", "mean", "meaning", "definition_text"], null);
  const eEx = pickCol(eCols, ["example", "ex", "sample", "usage", "example_text"], null);

  const sFk = pickCol(sCols, ["entry_id", "entryid", "eid", "entry", "entries_id", "word_id", "wordid"], null);
  const sDef = pickCol(sCols, ["definition", "def", "mean", "meaning", "sense_definition", "definition_text"], null);
  const sEx = pickCol(sCols, ["example", "ex", "sample", "usage", "example_text"], null);
  const sOrd = pickCol(sCols, ["sense_order", "ord", "order", "seq", "no", "idx"], null);

  const senseOrder = sOrd ? `ORDER BY s.${sOrd} ASC, s.rowid ASC` : `ORDER BY s.rowid ASC`;
  const defExpr = eDef ? `e.${eDef}` : (sFk && sDef && sensesTable ? `(SELECT s.${sDef} FROM ${sensesTable} s WHERE s.${sFk}=e.${eId} ${senseOrder} LIMIT 1)` : "NULL");
  const exExpr  = eEx  ? `e.${eEx}`  : (sFk && sEx  && sensesTable ? `(SELECT s.${sEx}  FROM ${sensesTable} s WHERE s.${sFk}=e.${eId} ${senseOrder} LIMIT 1)` : "NULL");

  // 후보군 추출: 정답 정의/예문에서 정보성 높은 토큰
  const aTokensAll = Array.from(new Set(tokenize((ans.definition || "") + " " + (ans.example || ""))))
    .map(t => normToken(t))
    .filter(t => t && t.length >= 2 && t !== ans.word && !STOP.has(t) && !COMMON.has(t))
    .slice(0, 6);

  const rows = [];
  const seenId = new Set();

  async function pushRows(res){
    for (const r of (res?.results || [])) {
      if (r?.id == null) continue;
      const id = Number(r.id);
      if (seenId.has(id)) continue;
      seenId.add(id);
      rows.push(r);
    }
  }

  // (A) 정의 LIKE 후보 (주의: 130만 스캔을 피하기 위해 LIMIT를 엄격히)
  if (aTokensAll.length && sensesTable && sFk && sDef) {
    const where = aTokensAll.map(()=>`s.${sDef} LIKE ?`).join(" OR ");
    const params = aTokensAll.map(t=>`%${t}%`);
    const sql = `
      SELECT DISTINCT e.${eId} AS id,
             e.${eWord} AS word
             ${ePos ? `, e.${ePos} AS pos` : ", NULL AS pos"}
             ${eLevel ? `, e.${eLevel} AS level` : ", NULL AS level"}
             , ${defExpr} AS definition
             , ${exExpr} AS example
      FROM ${sensesTable} s
      JOIN ${entriesTable} e ON e.${eId}=s.${sFk}
      WHERE e.${eWord} NOT LIKE '% %' AND (${where})
      LIMIT 12000
    `;
    await pushRows(await env.DB.prepare(sql).bind(...params).all());
  } else if (aTokensAll.length && eDef) {
    const where = aTokensAll.map(()=>`e.${eDef} LIKE ?`).join(" OR ");
    const params = aTokensAll.map(t=>`%${t}%`);
    const sql = `
      SELECT e.${eId} AS id,
             e.${eWord} AS word
             ${ePos ? `, e.${ePos} AS pos` : ", NULL AS pos"}
             ${eLevel ? `, e.${eLevel} AS level` : ", NULL AS level"}
             , ${defExpr} AS definition
             , ${exExpr} AS example
      FROM ${entriesTable} e
      WHERE e.${eWord} NOT LIKE '% %' AND (${where})
      LIMIT 12000
    `;
    await pushRows(await env.DB.prepare(sql).bind(...params).all());
  }

  // (B) 최소 후보 수 확보 실패 시: answer_pool 기반 보강(있을 때만)
  if (rows.length < 2000 && schema.kind === 'v2' && schema.pool) {
    const pCols = await tableColumns(env.DB, schema.pool);
    const pidCol = pickCol(pCols, ["word_id","wordid","id","entry_id"], null);
    const pWordCol = pickCol(pCols, ["display_word","word","lemma","headword"], null);
    if (pidCol && pWordCol) {
      const sql = `
        SELECT e.${eId} AS id,
               e.${eWord} AS word
               ${ePos ? `, e.${ePos} AS pos` : ", NULL AS pos"}
               ${eLevel ? `, e.${eLevel} AS level` : ", NULL AS level"}
               , ${defExpr} AS definition
               , ${exExpr} AS example
        FROM ${schema.pool} p
        JOIN ${entriesTable} e ON e.${eId}=p.${pidCol}
        WHERE p.${pWordCol} NOT LIKE '% %'
        LIMIT 8000
      `;
      await pushRows(await env.DB.prepare(sql).all());
    }
  }

  // 점수 계산(후보군만) → 상위 1000 저장
  const scored = [];
  for (const r of rows) {
    const w = (r.word || "").trim();
    if (!w || w === ans.word) continue;
    if (!isSingleWordKorean(w)) continue;
    const g = {
      word: w,
      pos: r.pos || null,
      level: r.level || null,
      definition: r.definition || "",
      example: r.example || "",
    };
    const raw = similarityScore(g, ans);
    if (raw <= 0) continue;
    scored.push({ id: Number(r.id), word: w, raw });
  }

  scored.sort((a,b)=>b.raw-a.raw);
  const top = scored.slice(0, 1000);
  const maxRaw = top.length ? top[0].raw : 0;
  const minRaw = top.length ? top[top.length-1].raw : 0;

  // insert answer_rank
  if (top.length) {
    // 기존 날짜 데이터가 남아있으면 정리(안전)
    await env.DB.prepare(`DELETE FROM answer_rank WHERE date_key=?`).bind(dateKey).run();

    const stmts = top.map((x,i)=> env.DB.prepare(
      `INSERT INTO answer_rank(date_key, word_id, rank, score) VALUES (?,?,?,?)`
    ).bind(dateKey, x.id, i+1, x.raw));

    if (typeof env.DB.batch === 'function') {
      // D1 batch 지원 시
      for (let i=0;i<stmts.length;i+=100) {
        await env.DB.batch(stmts.slice(i,i+100));
      }
    } else {
      for (const s of stmts) await s.run();
    }
  }

  // lock 해제
  if (kv) { try { await kv.delete(lockKey); } catch {} }

  const items = top.slice(0, limit).map((x,i)=>({
    rank: i+1,
    word: x.word,
    raw: x.raw,
    percent: scoreToPercentScaled(x.raw, maxRaw, { isCorrect:false, minRaw, rank: i+1 }),
  }));

  return {
    dateKey,
    answer: { word: ans.word, pos: ans.pos || null, level: ans.level || null },
    maxRaw,
    items,
  };
}
