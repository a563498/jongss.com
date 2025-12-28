import { jsonResponse, getOpenDictKey, getOpenDictReferer } from './_common.js';

export async function onRequestGet({ request, env }){
  try{
    const url = new URL(request.url);
    const word = url.searchParams.get("word") || "사과";
    const keyRes = getOpenDictKey(env);
    if (!keyRes.ok) return jsonResponse({ ok:false, message:keyRes.message }, 500);

    const u = new URL("https://opendict.korean.go.kr/api/search");
    u.searchParams.set("key", keyRes.key);
    u.searchParams.set("q", word);
    u.searchParams.set("req_type", "xml");
    u.searchParams.set("num", "20");

    const ref = getOpenDictReferer(env);
    const headers = { "user-agent":"tteutgyeop/1.0", "accept":"application/xml,text/xml,*/*;q=0.8" };
    if (ref){ headers["referer"]=ref; headers["origin"]=ref.replace(/\/$/,""); }

    const r = await fetch(u.toString(), { headers });
    const text = await r.text();
    const isXml = text.includes("<?xml");
    const itemCount = (text.match(/<item\b/gi)||[]).length;
    return jsonResponse({ ok:true, status:r.status, isXml, itemCount, referer:ref||null, head:text.slice(0,1500) });
  }catch(e){
    return jsonResponse({ ok:false, message:"서버 오류(raw)", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}
