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
    const tr = await fetch(
      "https://api.themoviedb.org/3/" + kind + "/" + tmdbId +
        "?api_key=" + TMDB_API_KEY + "&language=es-MX"
    );
    const td = await tr.json();
    const slug = slugify(td.title || td.name);
    const u =
      mediaType === "movie"
        ? BASE_URL + "/pelicula/" + slug
        : BASE_URL + "/episodio/" + slug + "-temporada-" + season + "-episodio-" + episode;

    const r = await fetch(u, {
      headers: { "User-Agent": UA, Referer: BASE_URL + "/" },
    });
    const html = await r.text();

    // URL emb... completa
    const embs = html.match(/https?:\/\/emb[^\s"'<>]*/gi) || [];
    if (embs.length) dump("E", embs[0], 6);
    else dbg("sin url emb");

    // contexto alrededor de embed69 y xupalac
    ["embed69", "xupalac"].forEach((k) => {
      const i = html.indexOf(k);
      if (i < 0) {
        dbg(k + ": no");
      } else {
        dump(k.substr(0, 2).toUpperCase() + "-", html.substr(Math.max(0, i - 60), 200).replace(/\s+/g, " "), 6);
      }
    });

    return debug;
  } catch (error) {
    dbg("excepcion: " + (error && error.message ? error.message : error));
    return debug;
  }
}

module.exports = { getStreams };
