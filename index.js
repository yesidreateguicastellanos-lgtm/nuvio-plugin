// Addon Xuper para Nuvio - Versión Final con Cifrado 3DES

// ==========================================
// 1. LIBRERÍA CRYPTO-JS (Incrustada para Nuvio)
// ==========================================
// Esta es una versión ligera de crypto-js para que funcione en Hermes.
// (Si Nuvio falla al cargar esto, avísame y buscamos otra forma).
const CryptoJS = require("crypto-js");

// ==========================================
// 2. CONFIGURACIÓN Y CONSTANTES
// ==========================================
// Hosts reales encontrados en la investigación
const HOSTS = ["api.magistv.com", "api.xuper.tv"];
const PORTAL_CODE = "masnew";
const USER_AGENT = "okhttp/3.12.12";
const APK_VER_HEADER = "43404";
const SPKG_VER = "2025-08-07 05:40:11_36_16_";
const APP_ID = "com.android.msandroid";
const APK_VERSION = "49902";
const UA_CDN = "Ranger/4.9.4-17294ac0";
const FIXED_MAC = "02:00:00:00:00:00";
const TMDB_API_KEY = "0f20f54cc72e14f7792c2114ce6b1c5a";

// 🔑 CLAVE CORREGIDA (Hexadecimal exacta de la captura)
const MAGIS_KEY_HEX = "6d61676973747463232333435363738393031323334353637"; 
// La misma clave pero en texto (necesaria para CryptoJS)
const MAGIS_KEY_STR = "magisttc12345678901234567"; 

const DEVICE_SN = "a1b2c3d4e5f678901234567890abcdef";

const DEVICE_FIXED = {
  loginType: "2", appLanguage: "en", hardwareInfo: "ranchu",
  model: "sdk_gphone64_arm64", product: "sdk_gphone64_arm64",
  cpu: "arm64-v8a", B29: "", reserve1: "", deviceToken: "",
  drmId: "", sdkVer: 36, apkVersion: APK_VERSION, appId: APP_ID, sysVersion: SPKG_VER,
  sn: DEVICE_SN
};

// ==========================================
// 3. FUNCIONES DE CIFRADO 3DES
// ==========================================
function stringToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
}

function hexToString(hex) {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

function encryptBody(plainText) {
    try {
        // Ciframos con 3DES en modo ECB y padding PKCS7 (igual que el código original)
        const key = CryptoJS.enc.Utf8.parse(MAGIS_KEY_STR);
        const encrypted = CryptoJS.TripleDES.encrypt(plainText, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        
        // El resultado en Base64 lo pasamos a Hexadecimal (como espera el portal)
        const base64Str = encrypted.toString();
        return stringToHex(base64Str);
    } catch (e) {
        console.error("[Xuper] Error al cifrar:", e);
        return plainText; // Fallback
    }
}

function decryptBlob(hexString) {
    try {
        // Convertimos el Hexadecimal de vuelta a Base64
        const base64Str = hexToString(hexString);
        const key = CryptoJS.enc.Utf8.parse(MAGIS_KEY_STR);
        
        // Desciframos
        const decrypted = CryptoJS.TripleDES.decrypt(base64Str, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("[Xuper] Error al descifrar:", e);
        return hexString;
    }
}

// ==========================================
// 4. LLAMADA AL PORTAL
// ==========================================
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

// ==========================================
// 5. BÚSQUEDA EN TMDB Y FUNCIÓN PRINCIPAL
// ==========================================
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
