
export default async function handler(req, res) {
  const { juego } = req.query;
  if (!juego) return res.status(400).json({ ok:false, error:"Falta juego" });

  function extraerData(html) {
    const marker = "var ytInitialData = ";
    const start = html.indexOf(marker);
    if (start < 0) return null;
    let i = start + marker.length, depth = 0, str = false, esc = false;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { str = !str; continue; }
      if (!str) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
        if (depth === 0 && ch === "}") return JSON.parse(html.slice(start + marker.length, i + 1));
      }
    }
    return null;
  }

  function videos(obj, out=[]) {
    if (!obj || typeof obj !== "object") return out;
    if (obj.videoRenderer?.videoId) {
      const v = obj.videoRenderer;
      out.push({
        videoId: v.videoId,
        title: v.title?.runs?.map(r=>r.text).join("") || v.title?.simpleText || "",
        channel: v.ownerText?.runs?.map(r=>r.text).join("") || v.longBylineText?.runs?.map(r=>r.text).join("") || ""
      });
    }
    for (const k of Object.keys(obj)) videos(obj[k], out);
    return out;
  }

  try {
    const q = encodeURIComponent(`${juego} trailer`);
    const url = `https://www.youtube.com/@GameTrailers/search?query=${q}`;
    const r = await fetch(url, { headers: { "User-Agent":"Mozilla/5.0", "Accept-Language":"es-AR,es;q=0.9,en;q=0.8" }});
    if (!r.ok) return res.status(500).json({ ok:false, error:"YouTube no respondió" });

    const data = extraerData(await r.text());
    if (!data) return res.status(404).json({ ok:false, error:"No pude leer resultados" });

    const lista = videos(data).filter(v => v.videoId && !/shorts?/i.test(v.title));
    if (!lista.length) return res.status(404).json({ ok:false, error:"Sin resultado en GameTrailers" });

    const elegido = lista[0];
    return res.status(200).json({
      ok:true,
      juego,
      title:elegido.title,
      channel:elegido.channel || "GameTrailers",
      url:`https://www.youtube.com/watch?v=${elegido.videoId}`
    });
  } catch(e) {
    return res.status(500).json({ ok:false, error:"Error buscando trailer" });
  }
}
