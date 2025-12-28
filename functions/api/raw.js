import { jsonResponse, getOpenDictKey } from './_common.js';

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

    const r = await fetch(u.toString());
    const text = await r.text();
    const itemCount = (text.match(/<item\b/gi)||[]).length;
    return jsonResponse({ ok:true, status:r.status, itemCount, head:text.slice(0,1500) });
  }catch(e){
    return jsonResponse({ ok:false, message:"서버 오류(raw)", detail:String(e && e.stack ? e.stack : e) }, 500);
  }
}
