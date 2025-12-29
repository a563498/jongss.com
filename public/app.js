const $ = (id)=>document.getElementById(id);

const LS_KEY = "tteutgyeop_state_v1";
const THEME_KEY = "tteutgyeop_theme";

let state = {
  dateKey: null,
  startAt: null,
  tries: 0,
  best: 0,
  guesses: [] // {word, percent, clues, ts}
};

function fmtTime(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = String(Math.floor(s/60)).padStart(2,"0");
  const r = String(s%60).padStart(2,"0");
  return `${m}:${r}`;
}

function setStatus(msg){ $("status").textContent = msg || ""; }

function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s && typeof s === "object") state = s;
  }catch{}
}

function render(){
  $("tries").textContent = state.tries;
  $("best").textContent = `${state.best||0}%`;
  $("dateKey").textContent = state.dateKey || "-";

  const list = $("list");
  list.innerHTML = "";
  // sort: higher similarity first, then recent
  const items = [...state.guesses].sort((a,b)=> (b.percent - a.percent) || (b.ts - a.ts));
  for (const g of items){
    const el = document.createElement("div");
    el.className = "item";

    const top = document.createElement("div");
    top.className = "itemTop";

    const left = document.createElement("div");
    left.innerHTML = `<div class="word">${escapeHtml(g.word)}</div>
                      <div class="meta">${g.clues?.품사?.input ?? ""} · ${g.clues?.난이도?.input ?? ""}</div>`;

    const right = document.createElement("div");
    right.className = "barWrap";
    right.innerHTML = `<div class="percent">${g.percent}%</div>
                       <div class="bar"><div class="fill" style="width:${g.percent}%"></div></div>`;
    top.appendChild(left); top.appendChild(right);
    el.appendChild(top);

    const clues = document.createElement("div");
    clues.className = "clues";
    const c = g.clues || {};
    if (c.글자수){
      clues.appendChild(tag(`글자수: ${c.글자수.text} (Δ ${fmtDelta(c.글자수.delta)})`));
    }
    if (c.품사) clues.appendChild(tag(`품사: ${c.품사.text}`));
    if (c.난이도) clues.appendChild(tag(`난이도: ${c.난이도.text}`));
    el.appendChild(clues);

    list.appendChild(el);
  }
}

function tag(text){
  const s = document.createElement("span");
  s.className = "tag";
  s.textContent = text;
  return s;
}

function fmtDelta(n){
  if (n===0) return "0";
  return (n>0?`+${n}`:`${n}`);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

async function apiJson(url, opts){
  const r = await fetch(url, opts);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")){
    const t = await r.text();
    throw new Error(`API가 JSON이 아님: ${t.slice(0,120)}`);
  }
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || `HTTP ${r.status}`);
  return j;
}

async function init(){
  load();
  applyTheme(loadTheme());

  // fetch meta to get dateKey (and reset daily if changed)
  try{
    const m = await apiJson("/api/meta");
    if (state.dateKey !== m.dateKey){
      // new day -> reset
      state = { dateKey: m.dateKey, startAt: Date.now(), tries:0, best:0, guesses:[] };
      save();
    }else{
      if (!state.startAt) state.startAt = Date.now();
    }
    $("license").innerHTML = `데이터: 한국어기초사전 (출처·라이선스 표기는 사이트 정책에 맞게 추가하세요)`;
    render();
  }catch(e){
    setStatus("초기화 실패: " + e.message);
  }
}

function tick(){
  if (!state.startAt) return;
  $("timer").textContent = fmtTime(Date.now() - state.startAt);
}
setInterval(tick, 250);

async function submit(){
  const inp = $("wordInput");
  const word = inp.value.trim();
  if (!word) return;
  inp.value = "";
  setStatus("");

  try{
    const res = await apiJson(`/api/guess?word=${encodeURIComponent(word)}`);
    const d = res.data;
    state.tries += 1;
    state.best = Math.max(state.best, d.percent);
    state.guesses.push({ word:d.word, percent:d.percent, clues:d.clues, ts:Date.now() });
    save();
    render();
    if (d.isCorrect){
      setStatus(`정답! ${state.tries}번째 · ${fmtTime(Date.now()-state.startAt)}`);
    }
  }catch(e){
    setStatus(e.message);
  }
}

function newGame(){
  // answer stays the same; only local state reset
  state = { dateKey: state.dateKey, startAt: Date.now(), tries:0, best:0, guesses:[] };
  save();
  render();
  setStatus("기록을 초기화했어요(정답은 오늘 하루 고정)");
}

async function giveUp(){
  try{
    const r = await apiJson("/api/giveup", { method:"POST" });
    const a = r.answer;
    setStatus(`포기! 정답: ${a.word} (${a.pos||""}) - ${a.definition||""}`);
  }catch(e){
    setStatus(e.message);
  }
}

function loadTheme(){
  return localStorage.getItem(THEME_KEY) || "light";
}
function applyTheme(t){
  document.documentElement.dataset.theme = t;
  $("themeBtn").textContent = t==="dark" ? "🌙" : "☀️";
  localStorage.setItem(THEME_KEY, t);
}
$("themeBtn").addEventListener("click", ()=>{
  const cur = document.documentElement.dataset.theme || "light";
  applyTheme(cur==="dark" ? "light" : "dark");
});

$("submitBtn").addEventListener("click", submit);
$("newBtn").addEventListener("click", newGame);
$("giveupBtn").addEventListener("click", giveUp);
$("wordInput").addEventListener("keydown", (e)=>{
  if (e.key==="Enter") submit();
});

init();
