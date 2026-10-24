const BASE_URL = "https://sololatino.net";
const TMDB_API_KEY = "0f20f54cc72e14f7792c2114ce6b1c5a";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function chunk(s, n) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.substr(i, n));
  return out;
}

function uniq(arr) {
  return arr.filter((x, i) => arr.indexOf(x) === i);
}

async function getTitles(tmdbId, mediaType) {
  const kind = mediaType === "movie" ? "movie" : "tv";
  const url =
    "https://api.themoviedb.org/3/" + kind + "/" + tmdbId +
    "?api_key=" + TMDB_API_KEY + "&language=es-MX";
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDB HTTP " + res.status);
  const d = await res.json();
  return [d.title || d.name].filter(Boolean);
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
    const parts = chunk(text, 34).slice(0, max || 8);
    if (!parts.length) dbg(label + " -");
    parts.forEach((p, i) => dbg(label + (i + 1) + ": " + p));
  };

  try {
    const titles = await getTitles(tmdbId, mediaType);
    const slug = slugify(titles[0]);
    const u =
      mediaType === "movie"
        ? BASE_URL + "/pelicula/" + slug
        : BASE_URL + "/episodio/" + slug + "-temporada-" + season + "-episodio-" + episode;

    const r = await fetch(u, {
      headers: { "User-Agent": UA, Referer: BASE_URL + "/" },
    });
    dbg("HTTP " + r.status);
    const html = await r.text();

    // dominios externos
    const hosts = [];
    const reH = /https?:\/\/([a-z0-9.-]+)/gi;
    let m;
    while ((m = reH.exec(html)) !== null) {
      const h = m[1].toLowerCase();
      if (
        h.indexOf("sololatino") < 0 &&
        h.indexOf("w3.org") < 0 &&
        h.indexOf("google") < 0 &&
        h.indexOf("gstatic") < 0 &&
        h.indexOf("schema.org") < 0
      ) {
        hosts.push(h);
      }
    }
    dump("H", uniq(hosts).join(" "), 8);

    // urls que empiezan con emb
    const embs = uniq(html.match(/https?:\/\/emb[^\s"'<>]*/gi) || []);
    dbg("embs: " + embs.length);
    embs.slice(0, 2).forEach((e, i) => dump("E" + (i + 1) + "-", e, 5));

    // atributos data-
    const attrs = [];
    const reA = /\sdata-([a-z0-9_-]+)=/gi;
    while ((m = reA.exec(html)) !== null) attrs.push(m[1]);
    dump("D", uniq(attrs).join(" "), 4);

    // scripts
    const scripts = [];
    const reS = /<script[^>]+src=["']([^"']+)["']/gi;
    while ((m = reS.exec(html)) !== null) {
      if (m[1].indexOf("google") < 0) scripts.push(m[1]);
    }
    dump("S", uniq(scripts).join(" "), 6);

    // ids
    const imdb = html.match(/tt\d{7,8}/);
    dbg("imdb: " + (imdb ? imdb[0] : "no"));
    dbg("tmdb en html: " + (html.indexOf(String(tmdbId)) >= 0 ? "si" : "no"));

    return debug;
  } catch (error) {
    dbg("excepcion: " + (error && error.message ? error.message : error));
    return debug;
  }
}

module.exports = { getStreams };
