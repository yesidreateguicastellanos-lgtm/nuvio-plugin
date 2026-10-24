// Addon Xuper para Nuvio (Compatible con Hermes)

const HOSTS = ["osuhk.m3x8o50te.com", "oogoy.f30c96w8.com"];
const PORTAL_CODE = "masnew";
const USER_AGENT = "okhttp/3.12.12";
const APK_VER_HEADER = "43404";
const SPKG_VER = "2025-08-07 05:40:11_36_16_";
const APP_ID = "com.android.msandroid";
const APK_VERSION = "49902";
const UA_CDN = "Ranger/4.9.4-17294ac0";
const FIXED_MAC = "02:00:00:00:00:00";
const TMDB_API_KEY = "0f20f54cc72e14f7792c2114ce6b1c5a";

const DEVICE_FIXED = {
  loginType: "2", appLanguage: "en", hardwareInfo: "ranchu",
  model: "sdk_gphone64_arm64", product: "sdk_gphone64_arm64",
  cpu: "arm64-v8a", B29: "", reserve1: "", deviceToken: "",
  drmId: "", sdkVer: 36, apkVersion: APK_VERSION, appId: APP_ID, sysVersion: SPKG_VER,
};

// ⚠️ AQUÍ VA LA CLAVE REAL DE XUPER CUANDO LA CONSIGAS ⚠️
const MAGIS_KEY = "CLAVE_PENDIENTE";

function encryptBody(plainText) {
    if (MAGIS_KEY === "CLAVE_PENDIENTE") {
        console.log("[Xuper] Enviando sin cifrar (falta magisKey)");
        return plainText;
    }
    return plainText; // Aquí iría el cifrado real 3DES
}

function decryptBlob(hexString) {
    if (MAGIS_KEY === "CLAVE_PENDIENTE") return hexString;
    return hexString; // Aquí iría el descifrado real 3DES
}

function callPortal(path, bean, userId, userToken) {
    return new Promise((resolve, reject) => {
        const body = Object.assign({}, {
            portalCode: PORTAL_CODE, userId: userId || "", userToken: userToken || ""
        }, bean, DEVICE_FIXED);
        
        const wire = encryptBody(JSON.stringify(body));
        const headers = {
            "apk": APP_ID, "apkVer": APK_VER_HEADER, "spkgVer": SPKG_VER,
            "User-Agent": USER_AGENT, "Content-Type": "application/json;charset=utf-8"
        };

        let hostIndex = 0;

        function tryNextHost() {
            if (hostIndex >= HOSTS.length) {
                return reject(new Error("No se pudo conectar a ningún host de Xuper"));
            }
            const host = HOSTS[hostIndex++];
            console.log("[Xuper] Llamando a: " + host + "/" + path);

            fetch("https://" + host + "/api/portalCore/" + path, {
                method: "POST",
                headers: headers,
                body: wire
            })
            .then(res => {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.text();
            })
            .then(text => {
                let answer;
                try { answer = JSON.parse(text); } catch (e) { throw new Error("Respuesta no es JSON"); }
                
                if (answer.returnCode && answer.returnCode !== "0") {
                    throw new Error("Portal Error: " + answer.returnCode + " - " + (answer.errorMessage || ""));
                }
                
                if (typeof answer.data === "string" && answer.data !== "") {
                    const plain = decryptBlob(answer.data);
                    return JSON.parse(plain);
                }
                resolve(answer.data || answer);
            })
            .catch(err => {
                console.log("[Xuper] Fallo en " + host + ": " + err.message);
                tryNextHost();
            });
        }
        tryNextHost();
    });
}

function getTitleFromTmdb(tmdbId, mediaType) {
    return new Promise((resolve, reject) => {
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        const url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&language=es-ES";
        
        fetch(url)
        .then(res => res.json())
        .then(data => resolve(data.title || data.name))
        .catch(err => reject(err));
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    return new Promise((resolve, reject) => {
        console.log("[Xuper] Buscando TMDB: " + tmdbId + ", Tipo: " + mediaType);
        
        getTitleFromTmdb(tmdbId, mediaType)
        .then(title => {
            if (!title) throw new Error("No se encontró título en TMDB");
            console.log("[Xuper] Título: " + title);
            
            return callPortal("v3/searchByName", {
                value: title, type: "0", columnId: "", filter: "", pageNum: 1, pageSize: 20
            });
        })
        .then(searchResult => {
            let contentId = null;
            if (searchResult && searchResult.searchItemList && searchResult.searchItemList[0] && searchResult.searchItemList[0].itemList[0]) {
                contentId = searchResult.searchItemList[0].itemList[0].contentId;
            }
            if (!contentId) throw new Error("No se encontró en el catálogo de Xuper");
            console.log("[Xuper] Content ID: " + contentId);
            
            return callPortal("v14/getSlbInfo", {
                hasPay: "0", userIdentity: "1", type: "merge", appVer: APK_VERSION,
                lang: "es", encMediaSupported: 1, liveCodeList: ["masnew_live"],
                appParams: "", reserve1: FIXED_MAC, pipFlag: "0"
            }).then(slb => ({ slb, contentId }));
        })
        .then(data => {
            let cdnBase = "", authToken = "";
            if (data.slb && data.slb.cdn_list) {
                const cdn = data.slb.cdn_list.find(c => c.tag === "vod");
                if (cdn && cdn.url_list && cdn.url_list[0]) {
                    cdnBase = cdn.main_addr.startsWith("http") ? cdn.main_addr : "https://" + cdn.main_addr;
                    authToken = cdn.url_list[0].url;
                }
            }
            if (!cdnBase || !authToken) throw new Error("No se pudo obtener la CDN");
            
            const finalUrl = cdnBase + "/vod/" + data.contentId + "_media.mp4";
            console.log("[Xuper] URL Final: " + finalUrl);
            
            resolve([{
                name: "Xuper",
                url: finalUrl,
                quality: "Auto",
                headers: {
                    "Content-Auth": authToken,
                    "User-Agent": UA_CDN,
                    "App": APP_ID,
                    "App-Version": APK_VERSION
                }
            }]);
        })
        .catch(err => {
            console.error("[Xuper] Error final: " + err.message);
            resolve([]);
        });
    });
}

module.exports = { getStreams };
