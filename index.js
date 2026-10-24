const TMDB_API_KEY = "0f20f54cc72e14f7792c2114ce6b1c5a";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

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
    const er = await fetch(
      "https://api.themoviedb.org/3/" + kind + "/" + tmdbId +
        "/external_ids?api_key=" + TMDB_API_KEY
    );
    const ed = await er.json();
    const imdb = ed.imdb_id;
    dbg("imdb: " + imdb);
    if (!imdb) return debug;

    const key =
      mediaType === "movie" ? imdb : imdb + "-" + season + "x" + episode;

    const tries = [
      "https://embed69.org/f/" + key,
      "https://xupalace.org/video/" + key,
    ];

    for (const u of tries) {
      try {
        const r = await fetch(u, {
          headers: { "User-Agent": UA, Referer: "https://sololatino.net/" },
        });
        const t = await r.text();
        dbg(u.substr(8, 26) + " HTTP " + r.status + " len " + t.length);
        dbg("m3u8:" + (t.indexOf(".m3u8") >= 0) +
            " iframe:" + (t.indexOf("<iframe") >= 0) +
            " dataLink:" + (t.indexOf("dataLink") >= 0));
        dump("B", t.replace(/\s+/g, " ").substr(0, 140), 4);
      } catch (e) {
        dbg("fallo " + u.substr(8, 20) + " " + e.message);
      }
    }

    return debug;
  } catch (error) {
    dbg("excepcion: " + (error && error.message ? error.message : error));
    return debug;
  }
}

module.exports = { getStreams };
