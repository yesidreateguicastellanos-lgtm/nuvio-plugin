const TMDB_API_KEY = "0f20f54cc72e14f7792c2114ce6b1c5a";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function chunk(s, n) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.substr(i, n));
  return out;
}

function b64decode(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  let out = "";
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = B64.indexOf(s.charAt(i));
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buf >> bits) & 255);
      buf = buf & ((1 << bits) - 1);
    }
  }
  return out;
}

function extractArray(html, name) {
  const i = html.indexOf(name);
  if (i < 0) return null;
  const start = html.indexOf("[", i);
  if (start < 0) return null;
  let depth = 0;
  for (let j = start; j < html.length; j++) {
    const c = html.charAt(j);
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return html.substring(start, j + 1);
    }
  }
  return null;
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const debug = [];
  const dbg = (msg) =>
    debug.push({
      name: msg,
      title: msg,
      url: "https://example.com/debug",
      quality: "Debug",
      provider: "sololatino",
    });
  const dump = (label, text, max) => {
    chunk(text, 34).slice(0, max).forEach((p, i) => dbg(label + (i + 1) + ": " + p));
  };

  try {
    const kind = mediaType === "movie" ? "movie" : "tv";
    const er = await fetch(
      "https://api.themoviedb.org/3/" + kind + "/" + tmdbId +
        "/external_ids?api_key=" + TMDB_API_KEY
    );
    const imdb = (await er.json()).imdb_id;
    if (!imdb) {
      dbg("sin imdb");
      return debug;
    }
    const key =
      mediaType === "movie" ? imdb : imdb + "-" + season + "x" + episode;

    const url = "https://embed69.org/f/" + key;
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://sololatino.net/" },
    });
    const html = await r.text();
    dbg("HTTP " + r.status + " len " + html.length);

    const fr = /<iframe[^>]+src=["']([^"']+)["']/i.exec(html);
    dump("IF", fr ? fr[1] : "sin iframe", 2);

    const arr = extractArray(html, "dataLink");
    if (!arr) {
      dbg("no se pudo leer dataLink");
      const i = html.indexOf("dataLink");
      dump("DL", html.substr(Math.max(0, i), 200).replace(/\s+/g, " "), 5);
      return debug;
    }

    let data = null;
    try {
      data = JSON.parse(arr);
    } catch (e) {
      dbg("JSON invalido");
      dump("A", arr.substr(0, 200), 5);
      return debug;
    }

    const resumen = data
      .map((d) => {
        const lang = d.video_language || d.language || "?";
        const srv = (d.sortedEmbeds || d.embeds || [])
          .map((e) => e.servername || e.server || "?")
          .join(",");
        return lang + ":" + srv;
      })
      .join(" ");
    dump("L", resumen, 3);

    const first = ((data[0] && (data[0].sortedEmbeds || data[0].embeds)) || [])[0];
    if (first && first.link) {
      const parts = String(first.link).split(".");
      dbg("token partes: " + parts.length);
      const payload = parts.length >= 2 ? b64decode(parts[1]) : first.link;
      dump("P", payload, 4);
    } else {
      dbg("sin link en primer embed");
    }

    return debug;
  } catch (error) {
    dbg("excepcion: " + (error && error.message ? error.message : error));
    return debug;
  }
}

module.exports = { getStreams };
