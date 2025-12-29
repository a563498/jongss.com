
const THEME_KEY = "saitmal_theme";
function applyTheme(t){
  const theme = (t==="dark") ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  const b = $("themeBtn");
  if (b) b.textContent = (theme==="dark") ? "🌙" : "☀️";
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  const next = (cur==="dark") ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

const $=(id)=>document.getElementById(id);

function getPercent(d){
  if (typeof d.percent === "number") return d.percent;
  if (typeof getPercent(d) === "number") return Math.round(getPercent(d)*100);
  if (typeof getPercent(d) === "string" && getPercent(d).endsWith("%")) return parseInt(getPercent(d),10)||0;
  return 0;
}

const $ = (id)=>document.getElementById(id);

const els = {
  triesCount: $("triesCount"),
  elapsed: $("elapsed"),
  bestPct: $("bestPct"),
  dateKey: $("dateKey"),
  msg: $("msg"),
  form: $("guessForm"),
  input: $("guessInput"),
  list: $("guessList"),
  newGame: $("newGameBtn"),
  giveUp: $("giveUpBtn"),
  themeBtn: $("themeBtn"),
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

function clueTexts(cl){
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

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));
}

function render(){
  if (!meta || !state) return;

  els.dateKey.textContent = `오늘(${state.dateKey})`;
  els.triesCount.textContent = String(state.guesses.length);

  const best = state.guesses.reduce((m,g)=>Math.max(m, g.pct||0), 0);
  els.bestPct.textContent = `${best}%`;

  const sorted = [...state.guesses].sort((a,b)=>{
    if ((b.pct||0) !== (a.pct||0)) return (b.pct||0)-(a.pct||0);
    return (b.createdAt||0)-(a.createdAt||0);
  });

  els.list.innerHTML = "";
  if (!sorted.length){
    els.list.innerHTML = `<div class="small">아직 입력이 없어요.</div>`;
  }else{
    for (const g of sorted){
      const item = document.createElement("div");
      item.className = "item";

      const top = document.createElement("div");
      top.className = "itemTop";

      const w = document.createElement("div");
      w.className = "word";
      w.textContent = g.word;

      const sim = document.createElement("div");
      sim.className = "sim";

      const pct = Math.max(0, Math.min(100, g.pct||0));

      const pctEl = document.createElement("div");
      pctEl.className = "simPct";
      pctEl.textContent = `${pct}%`;

      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("div");
      fill.className = "barFill";
      fill.style.width = `${pct}%`;
      fill.style.background = pctColor(pct);
      bar.appendChild(fill);

      sim.appendChild(pctEl);
      sim.appendChild(bar);

      top.appendChild(w);
      top.appendChild(sim);

      const pills = document.createElement("div");
      pills.className = "pills";
      const texts = clueTexts(g.clues||{});
      for (const t of (texts.length?texts:["단서 없음"])){
        const p = document.createElement("div");
        p.className = "pill";
        p.textContent = t;
        pills.appendChild(p);
      }

      item.appendChild(top);
      item.appendChild(pills);
      els.list.appendChild(item);
    }
  }

  els.input.disabled = state.finished;
  els.form.querySelector("button[type=submit]").disabled = state.finished;
  els.giveUp.disabled = state.finished;
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
  timer = setInterval(()=>{
    if (!state) return;
    els.elapsed.textContent = fmtElapsed(nowMs() - state.startedAt);
  }, 500);
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("tteutgyeop_theme", theme);
  els.themeBtn.textContent = theme === "light" ? "☀️" : "🌙";
}

function initTheme(){
  const saved = localStorage.getItem("tteutgyeop_theme");
  if (saved === "light" || saved === "dark"){
    applyTheme(saved);
  }else{
    const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(prefersLight ? "light" : "dark");
  }
  els.themeBtn.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });
}

function init(){
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  initTheme();

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
      const d = res.data;
      if (!d){ setMsg("응답 형식 오류"); return; }

      const word = (d.word || w).trim();
      const pct = Number(getPercent(d));
      if (!Number.isFinite(pct)){ setMsg("유사도 계산 실패"); return; }

      if (state.guesses.some(x=>normWord(x.word) === normWord(word))){
        setMsg("이미 입력한 단어예요.");
        return;
      }

      state.guesses.push({ word, pct, clues: d.clues, createdAt: nowMs() });

      if (d.isCorrect){
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


function openHowto(){
  const m = $("howtoModal");
  if (!m) return;
  m.setAttribute("aria-hidden","false");
}
function closeHowto(){
  const m = $("howtoModal");
  if (!m) return;
  m.setAttribute("aria-hidden","true");
}
$("howtoBtn")?.addEventListener("click", openHowto);
$("howtoClose")?.addEventListener("click", closeHowto);
$("howtoModal")?.addEventListener("click", (e)=>{
  const t = e.target;
  if (t && t.dataset && t.dataset.close) closeHowto();
});
document.addEventListener("keydown", (e)=>{
  if (e.key==="Escape") closeHowto();
});



const ANIM_KEY = "saitmal_anim";
function animEnabled(){
  const v = localStorage.getItem(ANIM_KEY);
  return v === null ? true : (v === "1");
}
function setAnimEnabled(on){
  localStorage.setItem(ANIM_KEY, on ? "1" : "0");
  const icon = $("animIcon");
  if (icon) icon.textContent = on ? "✨" : "⏸️";
  if (!on) stopSeasonalFx();
  else startSeasonalFx();
}
function toggleAnim(){ setAnimEnabled(!animEnabled()); }

let fxCanvas, fxCtx, fxW=0, fxH=0, fxRAF=0;
function ensureFxCanvas(){
  if (fxCanvas) return;
  fxCanvas = document.createElement("canvas");
  fxCanvas.id = "fxCanvas";
  document.body.appendChild(fxCanvas);
  fxCtx = fxCanvas.getContext("2d");
  const resize = ()=>{
    fxW = fxCanvas.width = window.innerWidth;
    fxH = fxCanvas.height = window.innerHeight;
  };
  window.addEventListener("resize", resize);
  resize();
}
function confettiBurst(){
  if (!animEnabled()) return;
  ensureFxCanvas();
  const parts = [];
  const N = 140;
  const cx = fxW/2, cy = Math.min(260, fxH*0.35);
  for (let i=0;i<N;i++){
    parts.push({
      x: cx, y: cy,
      vx: (Math.random()*2-1)*7,
      vy: -Math.random()*10-4,
      g: 0.28 + Math.random()*0.1,
      s: 3 + Math.random()*4,
      r: Math.random()*Math.PI,
      vr: (Math.random()*2-1)*0.2,
      life: 220 + Math.random()*80,
      a: 1
    });
  }
  let t=0;
  function tick(){
    t++;
    fxCtx.clearRect(0,0,fxW,fxH);
    for (const p of parts){
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.life -= 1;
      p.a = Math.max(0, Math.min(1, p.life/120));
      fxCtx.save();
      fxCtx.globalAlpha = p.a;
      fxCtx.translate(p.x,p.y);
      fxCtx.rotate(p.r);
      fxCtx.fillStyle = `hsl(${(p.x+p.y+t)%360} 85% 60%)`;
      fxCtx.fillRect(-p.s/2,-p.s/2,p.s,p.s*1.4);
      fxCtx.restore();
    }
    const alive = parts.some(p=>p.life>0 && p.y<fxH+50);
    if (alive) fxRAF = requestAnimationFrame(tick);
    else fxCtx.clearRect(0,0,fxW,fxH);
  }
  cancelAnimationFrame(fxRAF);
  tick();
}

/* Seasonal ambient fx (simple): snow in Dec, petals in Apr, confetti on Jan1) */
let seasonalTimer = 0;
let flakes = [];
function stopSeasonalFx(){
  flakes = [];
  if (seasonalTimer) { cancelAnimationFrame(seasonalTimer); seasonalTimer = 0; }
  if (fxCtx) fxCtx.clearRect(0,0,fxW,fxH);
}
function startSeasonalFx(){
  if (!animEnabled()) return;
  ensureFxCanvas();
  const d = new Date();
  const m = d.getMonth()+1;
  const mode = (m===12) ? "snow" : (m===4) ? "petal" : null;
  if (!mode) { stopSeasonalFx(); return; }
  flakes = Array.from({length: Math.min(90, Math.floor(fxW/18))}, ()=>spawnFlake(mode));
  function loop(){
    fxCtx.clearRect(0,0,fxW,fxH);
    for (const f of flakes){
      f.y += f.vy; f.x += f.vx;
      f.t += 0.02;
      if (mode==="snow") f.x += Math.sin(f.t)*0.4;
      if (mode==="petal") f.r += f.vr;
      if (f.y > fxH + 20) Object.assign(f, spawnFlake(mode, true));
      drawFlake(f, mode);
    }
    seasonalTimer = requestAnimationFrame(loop);
  }
  loop();
}
function spawnFlake(mode, fromTop){
  return {
    x: Math.random()*fxW,
    y: fromTop ? -10 : Math.random()*fxH,
    vx: (Math.random()*2-1)*(mode==="snow"?0.6:1.2),
    vy: (mode==="snow"? 0.8:1.2) + Math.random()*1.2,
    s: (mode==="snow"? 1.8: 3.2) + Math.random()* (mode==="snow"?2.0:3.0),
    t: Math.random()*Math.PI*2,
    r: Math.random()*Math.PI*2,
    vr: (Math.random()*2-1)*0.03
  };
}
function drawFlake(f, mode){
  fxCtx.save();
  fxCtx.globalAlpha = 0.55;
  if (mode==="snow"){
    fxCtx.fillStyle = "rgba(255,255,255,0.9)";
    fxCtx.beginPath();
    fxCtx.arc(f.x,f.y,f.s,0,Math.PI*2);
    fxCtx.fill();
  } else {
    fxCtx.translate(f.x,f.y);
    fxCtx.rotate(f.r);
    fxCtx.fillStyle = "rgba(255,170,200,0.75)";
    fxCtx.beginPath();
    fxCtx.ellipse(0,0,f.s*0.9,f.s*0.55,0,0,Math.PI*2);
    fxCtx.fill();
  }
  fxCtx.restore();
}



(function bindHowto(){
  const btn = document.getElementById("howtoBtn");
  const modal = document.getElementById("howtoModal");
  const close = document.getElementById("howtoClose");
  if (!btn || !modal) return;
  const open = ()=> modal.setAttribute("aria-hidden","false");
  const shut = ()=> modal.setAttribute("aria-hidden","true");
  btn.addEventListener("click", open);
  close && close.addEventListener("click", shut);
  modal.addEventListener("click", (e)=>{ if (e.target && e.target.dataset && e.target.dataset.close) shut(); });
  document.addEventListener("keydown", (e)=>{ if (e.key==="Escape") shut(); });
})();


(function bindAnim(){
  const b = document.getElementById("animBtn");
  if (!b) return;
  b.addEventListener("click", toggleAnim);
  setAnimEnabled(animEnabled());
})();

document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);
