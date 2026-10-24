const BASE_URL = "https://sololatino.net";

/**
 * Convierte un título en un slug válido para URL (ej. "Tulsa King" -> "tulsa-king")
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Desempacador genérico para funciones eval(function(p,a,c,k,e,d)...)
 */
function unpackJS(packedCode) {
  try {
    const match = packedCode.match(/}\('(.+)',\s*(\d+),\s*(\d+),\s*'([^']+)'\.split\('\|'\)/);
    if (!match) return packedCode;

    let [, p, a, c, k] = match;
    a = parseInt(a, 10);
    c = parseInt(c, 10);
    k = k.split('|');

    const baseUnpack = (num) => {
      return (num < a ? '' : baseUnpack(Math.floor(num / a))) + 
             ((num = num % a) > 35 ? String.fromCharCode(num + 29) : num.toString(36));
    };

    while (c--) {
      if (k[c]) {
        const regex = new RegExp('\\b' + baseUnpack(c) + '\\b', 'g');
        p = p.replace(regex, k[c]);
      }
    }
    return p;
  } catch (e) {
    return packedCode;
  }
}

/**
 * Extractor para VOE
 */
async function extractVOE(iframeUrl) {
  try {
    const res = await fetch(iframeUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const html = await res.text();

    const hlsMatch = html.match(/'hls':\s*'([^']+)'/i) || html.match(/"hls":\s*"([^"]+)"/i);
    if (hlsMatch) return hlsMatch[1];

    const directMatch = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"']*/i);
    return directMatch ? directMatch[0] : null;
  } catch (err) {
    return null;
  }
}

/**
 * Extractor para Streamwish / FileLions
 */
async function extractStreamwish(iframeUrl) {
  try {
    const res = await fetch(iframeUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const html = await res.text();

    const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*\)/);
    let unpackedText = html;
    if (packedMatch) {
      unpackedText = unpackJS(packedMatch[0]);
    }

    const m3u8Match = unpackedText.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) ||
                      unpackedText.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"']*/i);

    return m3u8Match ? (m3u8Match[1] || m3u8Match[0]) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Función principal requerida por Nuvio
 */
export async function getStreams({ tmdbId, title, year, type, season, episode }) {
  try {
    const slug = slugify(title);
    let targetUrl = "";

    if (type === "movie") {
      targetUrl = `${BASE_URL}/pelicula/${slug}`;
    } else {
      targetUrl = `${BASE_URL}/episodio/${slug}-temporada-${season}-episodio-${episode}`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": `${BASE_URL}/`
      }
    });

    if (!response.ok) return [];

    const htmlText = await response.text();
    const streams = [];

    // Extraer iframes
    const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
    let match;

    while ((match = iframeRegex.exec(htmlText)) !== null) {
      let iframeUrl = match[1];
      if (iframeUrl.startsWith("//")) iframeUrl = "https:" + iframeUrl;
      else if (iframeUrl.startsWith("/")) iframeUrl = BASE_URL + iframeUrl;

      let directUrl = null;
      let serverName = "Servidor Latino";

      if (iframeUrl.includes("voe")) {
        serverName = "VOE";
        directUrl = await extractVOE(iframeUrl);
      } else if (iframeUrl.includes("streamwish") || iframeUrl.includes("filelions")) {
        serverName = "Streamwish";
        directUrl = await extractStreamwish(iframeUrl);
      }

      streams.push({
        name: `SoloLatino - ${serverName}`,
        url: directUrl || iframeUrl,
        quality: "Auto / 1080p",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": iframeUrl
        }
      });
    }

    return streams;
  } catch (error) {
    console.error("[SoloLatino Plugin Error]:", error);
    return [];
  }
}
