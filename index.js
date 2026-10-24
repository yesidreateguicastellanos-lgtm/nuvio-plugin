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

function unpackJS(packedCode) {
  try {
    const match = packedCode.match(
      /}\('(.+)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/
    );
    if (!match) return packedCode;

    let p = match[1];
    const a = parseInt(match[2], 10);
    let c = parseInt(match[3], 10);
    const k = match[4].split("|");

    const baseUnpack = (num) =>
      (num < a ? "" : baseUnpack(Math.floor(num / a))) +
      ((num = num % a) > 35 ? String.fromCharCode(num + 29) : num.toString(36));

    while (c--) {
      if (k[c]) {
        p = p.replace(new RegExp("\\b" + baseUnpack(c) + "\\b", "g"), k[c]);
      }
    }
    return p;
  } catch (e) {
    return packedCode;
  }
}

async function extractVOE(iframeUrl) {
  try {
    const res = await fetch(iframeUrl, { headers: { "User-Agent": UA } });
    const html = await res.text();
    const hls =
      html.match(/'hls':\s*'([^']+)'/i) || html.match(/"hls":\s*"([^"]+)"/i);
    if (hls) return hls[1];
    const direct = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"']*/i);
    return direct ? direct[0] : null;
  } catch (e) {
    return null;
  }
}

async function extractStreamwish(iframeUrl) {
  try {
    const res = await fetch(iframeUrl, { headers: { "User-Agent": UA } });
    const html = await res.text();
    const packed = html.match(/eval\(function\(p,a,c,k,e,d\).*\)/);
    const text = packed ? unpackJS(packed[0]) : html;
    const m =
      text.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
      text.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"']*/i);
    return m ? m[1] || m[0] : null;
  } catch (e) {
    return null;
  }
}

async function getTitles(tmdbId, mediaType) {
  const kind = mediaType === "movie" ? "movie" : "tv";
  const url =
    "https://api.themoviedb.org/3/" + kind + "/" + tmdbId +
    "?api_key=" + TMDB_API_KEY + "&language=es-MX";
  const res = await fetch(url);
  if (!res.ok) throw new Error("TMDB HTTP " + res.status);
  const d = await res.json();
  const names = [
    d.title || d.name,
    d.original_title || d.original_name,
  ].filter(Boolean);
  return names.filter((n, i) => names.indexOf(n) === i);
}

function buildUrls(slug, mediaType, season, episode) {
  if (mediaType === "movie") {
    return [BASE_URL + "/pelicula/" + slug];
  }
  return [
    BASE_URL + "/episodio/" + slug + "-temporada-" + season + "-episodio-" + episode,
    BASE_URL + "/episodio/" + slug + "-" + season + "x" + episode,
  ];
}

async function getStreams(tmdbId, mediaType, season, episode) {
  const debug = [];
  const dbg = (msg) =>
    debug.push({
      name: "DEBUG: " + msg,
      title: "DEBUG: " + msg,
      url: "https://example.com/debug",
      quality: "Debug",
      provider: "sololatino",
    });

  try {
    dbg("inicio id=" + tmdbId + " tipo=" + mediaType);

    let titles = [];
    try {
      titles = await getTitles(tmdbId, mediaType);
    } catch (e) {
      dbg("TMDB fallo: " + e.message);
      return debug;
    }
    if (!titles.length) {
      dbg("TMDB sin titulo");
      return debug;
    }
    dbg("titulos: " + titles.join(" | "));

    let htmlText = null;
    for (const t of titles) {
      for (const u of buildUrls(slugify(t), mediaType, season, episode)) {
        try {
          const r = await fetch(u, {
            headers: { "User-Agent": UA, Referer: BASE_URL + "/" },
          });
          if (r.ok) {
            htmlText = await r.text();
            dbg("pagina OK " + u);
            break;
          } else {
            dbg("HTTP " + r.status + " " + u);
          }
        } catch (e) {
          dbg("fetch fallo " + u + " " + e.message);
        }
      }
      if (htmlText) break;
    }
    if (!htmlText) return debug;

    const streams = [];
    const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
    let match;
    let count = 0;

    while ((match = iframeRegex.exec(htmlText)) !== null) {
      count++;
      let iframeUrl = match[1];
      if (iframeUrl.startsWith("//")) iframeUrl = "https:" + iframeUrl;
      else if (iframeUrl.startsWith("/")) iframeUrl = BASE_URL + iframeUrl;

      let directUrl = null;
      let serverName = "";

      if (iframeUrl.includes("voe")) {
        serverName = "VOE";
        directUrl = await extractVOE(iframeUrl);
      } else if (
        iframeUrl.includes("streamwish") ||
        iframeUrl.includes("filelions")
      ) {
        serverName = "Streamwish";
        directUrl = await extractStreamwish(iframeUrl);
      } else {
        dbg("iframe no soportado " + iframeUrl);
        continue;
      }

      if (!directUrl) {
        dbg("sin video en " + serverName + " " + iframeUrl);
        continue;
      }

      streams.push({
        name: "SoloLatino - " + serverName,
        title: "SoloLatino - " + serverName,
        url: directUrl,
        quality: "Auto",
        headers: { "User-Agent": UA, Referer: iframeUrl },
        provider: "sololatino",
      });
    }

    if (count === 0) {
      dbg("la pagina no tiene iframes (largo " + htmlText.length + ")");
    }

    return streams.length ? streams : debug;
  } catch (error) {
    dbg("excepcion: " + (error && error.message ? error.message : error));
    return debug;
  }
}

module.exports = { getStreams };
