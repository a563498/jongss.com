const $ = (id)=>document.getElementById(id);

const els = {
  triesCount: $("triesCount"),
  elapsed: $("elapsed"),
  bestPct: $("bestPct"),
  dateKey: $("dateKey"),
  msg: $("msg"),
  form: $("guessForm"),
  input: $("guessInput"),
  newGame: $("newGameBtn"),
  giveUp: $("giveUpBtn"),
  tbody: $("guessTbody"),
};

let meta = null;
let state = null;
let timer = null;

function nowMs(){ return Date.now(); }
function pad2(n){ return String(n).padStart(2,"0"); }
function fmtElapsed(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const mm = Math.floor(s/60);
  const ss = s%60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

function normWord(s){
  return String(s||"").normalize("NFKC")
    .replace(/[·ㆍ\u00B7\u318D\u2027]/g,"")
    .replace(/[-‐-‒–—]/g,"")
    .replace(/\s+/g,"");
}

function storageKey(dateKey){ return `tteutgyeop_daily_${dateKey}`; }

function loadState(dateKey){
  try{
    const raw = localStorage.getItem(storageKey(dateKey));
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.dateKey !== dateKey) return null;
    return s;
  }catch{ return null; }
}

function saveState(){
  if (!state || !state.dateKey) return;
  localStorage.setItem(storageKey(state.dateKey), JSON.stringify(state));
}

function resetState(dateKey){
  state = { dateKey, startedAt: nowMs(), finished:false, gaveUp:false, guesses:[] };
  saveState();
  render();
}

function setMsg(t){ els.msg.textContent = t || ""; }

function pctColor(p){
  if (p>=90) return "var(--good)";
  if (p>=60) return "var(--warn)";
  return "var(--bad)";
}

function cluePills(cl){
  const out = [];
  if (cl.posMatch) out.push(`품사 같음(${cl.answerPos||cl.pos||"?"})`);
  else if (cl.pos && cl.answerPos) out.push(`품사 다름(${cl.pos} vs ${cl.answerPos})`);

  if (typeof cl.guessLen === "number" && typeof cl.answerLen === "number"){
    if (cl.guessLen === cl.answerLen) out.push(`글자수 같음(${cl.answerLen})`);
    else if (cl.guessLen > cl.answerLen) out.push(`정답보다 김(+${cl.guessLen-cl.answerLen})`);
    else out.push(`정답보다 짧음(-${cl.answerLen-cl.guessLen})`);
  }

  if (cl.choseongMatchCount != null) out.push(`초성 ${cl.choseongMatchCount}글자 일치`);
  return out;
}

function render(){
  if (!meta || !state) return;

  els.dateKey.textContent = state.dateKey;
  els.triesCount.textContent = String(state.guesses.length);

  const best = state.guesses.reduce((m,g)=>Math.max(m, g.pct||0), 0);
  els.bestPct.textContent = `${best}%`;

  els.elapsed.textContent = fmtElapsed(nowMs() - state.startedAt);

  // 정렬: 유사도 내림차순, 동률이면 최신
  const sorted = [...state.guesses].sort((a,b)=>{
    if ((b.pct||0) !== (a.pct||0)) return (b.pct||0)-(a.pct||0);
    return (b.createdAt||0)-(a.createdAt||0);
  });

  els.tbody.innerHTML = "";
  if (!sorted.length){
    const tr = document.createElement("tr");
    tr.className = "emptyRow";
    tr.innerHTML = `<td colspan="4">아직 입력이 없어요.</td>`;
    els.tbody.appendChild(tr);
  }else{
    sorted.forEach((g, i)=>{
      const tr = document.createElement("tr");

      const tdRank = document.createElement("td");
      tdRank.className = "rank";
      tdRank.setAttribute("data-label","#");
      tdRank.textContent = String(i+1);

      const tdWord = document.createElement("td");
      tdWord.setAttribute("data-label","단어");
      tdWord.innerHTML = `<span class="word">${escapeHtml(g.word)}</span>`;

      const tdSim = document.createElement("td");
      tdSim.setAttribute("data-label","유사도");
      const pct = Math.max(0, Math.min(100, g.pct||0));
      tdSim.innerHTML = `
        <div class="simBox">
          <div class="simPct">${pct}%</div>
          <div class="bar"><div class="barFill" style="width:${pct}%;background:${pctColor(pct)}"></div></div>
        </div>
      `;

      const tdClue = document.createElement("td");
      tdClue.setAttribute("data-label","단서");
      const pills = cluePills(g.clues||{}).map(t=>`<span class="pill">${escapeHtml(t)}</span>`).join("");
      tdClue.innerHTML = `<div class="pills">${pills || '<span class="pill">단서 없음</span>'}</div>`;

      tr.appendChild(tdRank);
      tr.appendChild(tdWord);
      tr.appendChild(tdSim);
      tr.appendChild(tdClue);
      els.tbody.appendChild(tr);
    });
  }

  els.input.disabled = state.finished;
  els.form.querySelector("button[type=submit]").disabled = state.finished;
  els.giveUp.disabled = state.finished;
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));
}

async function fetchMeta(){
  const r = await fetch("/api/meta", { cache:"no-store" });
  const j = await r.json();
  if (!j.ok) throw new Error(j.message || "meta failed");
  return j;
}

async function guessWord(word){
  const u = new URL("/api/guess", location.origin);
  u.searchParams.set("word", word);
  const r = await fetch(u.toString(), { cache:"no-store" });
  return await r.json();
}

function startTimer(){
  if (timer) clearInterval(timer);
  timer = setInterval(()=>{ if (state) els.elapsed.textContent = fmtElapsed(nowMs()-state.startedAt); }, 500);
}

function init(){
  fetchMeta().then((m)=>{
    meta = m;
    const loaded = loadState(meta.dateKey);
    state = loaded || { dateKey: meta.dateKey, startedAt: nowMs(), finished:false, gaveUp:false, guesses:[] };
    if (!loaded) saveState();
    render();
    startTimer();
  }).catch((e)=> setMsg(`초기화 실패: ${e.message}`));

  els.form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    if (!state || state.finished) return;
    const w = (els.input.value || "").trim();
    if (!w) return;

    setMsg("조회 중…");
    els.input.value = "";

    try{
      const res = await guessWord(w);
      if (!res.ok){ setMsg(res.message || "실패"); return; }

      const word = (res.data.word || w).trim();
      if (state.guesses.some(x=>normWord(x.word) === normWord(word))){
        setMsg("이미 입력한 단어예요.");
        return;
      }

      state.guesses.push({ word, pct: res.data.similarity, clues: res.data.clues, createdAt: nowMs() });

      if (res.data.isCorrect){
        state.finished = true;
        setMsg(`정답! ${state.guesses.length}번째, ${fmtElapsed(nowMs()-state.startedAt)} 걸렸어요.`);
      }else{
        setMsg("");
      }

      saveState();
      render();
    }catch(e){
      setMsg(`오류: ${e.message}`);
    }
  });

  els.newGame.addEventListener("click", ()=>{
    if (!meta) return;
    localStorage.removeItem(storageKey(meta.dateKey));
    resetState(meta.dateKey);
    setMsg("기록을 초기화했어요. (정답은 그대로)");
    els.input.focus();
  });

  els.giveUp.addEventListener("click", ()=>{
    if (!state || state.finished) return;
    state.finished = true;
    state.gaveUp = true;
    saveState();
    render();
    setMsg("포기했어요. 내일 다시 도전해봐요!");
  });
}

init();
