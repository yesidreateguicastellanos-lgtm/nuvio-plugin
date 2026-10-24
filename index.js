// =====================================================================
// ADDON DE NUVIO PARA XUPER (Basado en el plugin de Kino)
// =====================================================================

// --- 1. CONSTANTES (Extraídas de config.js) ---
const HOSTS = ["osuhk.m3x8o50te.com", "oogoy.f30c96w8.com"];
const PORTAL_CODE = "masnew";
const USER_AGENT = "okhttp/3.12.12";
const APK_VER_HEADER = "43404";
const SPKG_VER = "2025-08-07 05:40:11_36_16_";
const APP_ID = "com.android.msandroid";
const APK_VERSION = "49902";
const UA_CDN = "Ranger/4.9.4-17294ac0";
const FIXED_MAC = "02:00:00:00:00:00";
const SHARED_EMAIL = "kinoplayer@outlook.es";
const SHARED_PASSWORD = "Cris2337677";

// El dispositivo emulado que espera el portal
const DEVICE_FIXED = {
  loginType: "2", appLanguage: "en", hardwareInfo: "ranchu",
  model: "sdk_gphone64_arm64", product: "sdk_gphone64_arm64",
  cpu: "arm64-v8a", B29: "", reserve1: "", deviceToken: "",
  drmId: "", sdkVer: 36, apkVersion: APK_VERSION, appId: APP_ID, sysVersion: SPKG_VER,
};

// --- 2. CONFIGURACIÓN DE CIFRADO ---
// TODO: Aquí va la clave real cuando la consigas. 
// Por ahora usamos un placeholder. Si el portal acepta peticiones sin cifrar, no la necesitaremos.
const MAGIS_KEY = "CLAVE_PENDIENTE"; 

// Función de cifrado (Usando CryptoJS para Nuvio)
// NOTA: Nuvio usa Hermes, así que necesitamos que CryptoJS esté disponible.
// Si no lo está, tendremos que usar una implementación manual más adelante.
function encryptBody(plainText) {
    // Si no tenemos la clave, intentamos enviar en texto plano para ver si el portal lo acepta (poco probable, pero probemos)
    if (MAGIS_KEY === "CLAVE_PENDIENTE") {
        console.log("[Xuper] ADVERTENCIA: Enviando cuerpo sin cifrar. El portal probablemente lo rechace.");
        return plainText; 
    }
    
    // Lógica de cifrado real (3DES) una vez tengamos la clave
    try {
        // Requeriría: const CryptoJS = require("crypto-js");
        // const encrypted = CryptoJS.TripleDES.encrypt(plainText, CryptoJS.enc.Utf8.parse(MAGIS_KEY), { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
        // return Array.from(encrypted.toString()).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
        return plainText;
    } catch (e) {
        console.error("Error al cifrar:", e);
        return plainText;
    }
}

function decryptBlob(hexString) {
    // Si no está cifrado, lo devolvemos tal cual
    if (MAGIS_KEY === "CLAVE_PENDIENTE") return hexString;

    // Lógica de descifrado real (3DES)
    try {
        // const base64Str = hexString.match(/.{1,2}/g).map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
        // const decrypted = CryptoJS.TripleDES.decrypt(base64Str, CryptoJS.enc.Utf8.parse(MAGIS_KEY), { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 });
        // return decrypted.toString(CryptoJS.enc.Utf8);
        return hexString;
    } catch (e) {
        console.error("Error al descifrar:", e);
        return hexString;
    }
}

// --- 3. FUNCIÓN DE LLAMADA AL PORTAL (Con Failover) ---
async function callPortal(path, bean, userId = "", userToken = "") {
    const body = {
        portalCode: PORTAL_CODE, userId, userToken,
        ...bean, ...DEVICE_FIXED,
    };
    
    const wire = encryptBody(JSON.stringify(body));
    
    const headers = {
        "apk": APP_ID,
        "apkVer": APK_VER_HEADER,
        "spkgVer": SPKG_VER,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json;charset=utf-8"
    };

    // Rotamos entre los hosts disponibles
    for (const host of HOSTS) {
        try {
            console.log(`[Xuper] Llamando a ${host}/${path}...`);
            const res = await fetch(`https://${host}/api/portalCore/${path}`, {
                method: "POST",
                headers: headers,
                body: wire
            });
            
            const text = await res.text();
            const answer = JSON.parse(text);
            
            // Manejo de errores del portal (según portal.js)
            if (answer.returnCode && answer.returnCode !== "0") {
                throw new Error(`Portal Error: ${answer.returnCode} - ${answer.errorMessage || "Sin mensaje"}`);
            }
            
            // Si hay data, la desciframos
            if (typeof answer.data === "string" && answer.data !== "") {
                const plain = decryptBlob(answer.data);
                return JSON.parse(plain);
            }
            return answer.data || answer;
            
        } catch (e) {
            console.log(`[Xuper] Fallo en host ${host}:`, e.message);
            // Si el error es de red, intentamos con el siguiente host
        }
    }
    throw new Error("No se pudo contactar con ningún servidor de Xuper");
}

// --- 4. BÚSQUEDA POR TMDB ---
// Nuvio nos da el tmdbId, necesitamos buscar el título para usar en Xuper
async function getTitleFromTmdb(tmdbId, mediaType) {
    // Usamos una API pública o el endpoint de TMDB (necesitas una API Key de TMDB)
    // Por simplicidad, aquí usaremos una API de terceros o simularemos la búsqueda.
    // En un caso real, deberías usar la API de TMDB aquí.
    const TMDB_API_KEY = "TU_API_KEY_DE_TMDB"; 
    const url = `https://api.themoviedb.org/3/${mediaType === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_API_KEY}&language=es-ES`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.title || data.name;
    } catch (e) {
        console.error("Error obteniendo título de TMDB:", e);
        return null;
    }
}

// --- 5. FUNCIÓN PRINCIPAL DE NUVIO ---
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[Xuper] Buscando: TMDB ID ${tmdbId}, Tipo: ${mediaType}, Temp: ${season}, Ep: ${episode}`);
        
        // PASO 1: Obtener el título desde TMDB
        const title = await getTitleFromTmdb(tmdbId, mediaType);
        if (!title) throw new Error("No se pudo obtener el título de TMDB");
        console.log(`[Xuper] Título encontrado: ${title}`);
        
        // PASO 2: Buscar en Xuper usando el endpoint de search.js
        // (Por ahora usamos la cuenta compartida para las pruebas)
        const searchResult = await callPortal("v3/searchByName", {
            value: title, type: "0", columnId: "", filter: "", pageNum: 1, pageSize: 20
        });
        
        // Extraer el contentId (simplificado)
        let contentId = null;
        let isSeries = false;
        if (searchResult && searchResult.searchItemList) {
            const firstItem = searchResult.searchItemList[0]?.itemList[0];
            if (firstItem) {
                contentId = firstItem.contentId;
                isSeries = firstItem.programType !== "movie";
            }
        }
        
        if (!contentId) throw new Error("No se encontró el título en Xuper");
        console.log(`[Xuper] Content ID encontrado: ${contentId}, Es serie: ${isSeries}`);
        
        // PASO 3: Obtener el SLB (CDN y Token)
        const slb = await callPortal("v14/getSlbInfo", {
            hasPay: "0", userIdentity: "1", type: "merge", appVer: APK_VERSION,
            lang: "es", encMediaSupported: 1, liveCodeList: ["masnew_live"],
            appParams: "", reserve1: FIXED_MAC, pipFlag: "0"
        });
        
        // Extraer la URL base del CDN y el token de autenticación
        let cdnBase = "";
        let authToken = "";
        if (slb && slb.cdn_list) {
            const cdn = slb.cdn_list.find(c => c.tag === "vod");
            if (cdn && cdn.url_list && cdn.url_list[0]) {
                cdnBase = cdn.main_addr.startsWith("http") ? cdn.main_addr : `https://${cdn.main_addr}`;
                authToken = cdn.url_list[0].url;
            }
        }
        
        if (!cdnBase || !authToken) throw new Error("No se pudo obtener la CDN de Xuper");
        
        // PASO 4: Construir la URL final
        // Nota: Para series, habría que obtener el contentId del capítulo específico primero.
        // Por ahora, asumimos que es una película para la prueba.
        const finalUrl = `${cdnBase}/vod/${contentId}_media.mp4`;
        
        console.log(`[Xuper] URL generada: ${finalUrl}`);
        
        // PASO 5: Devolver el stream a Nuvio
        return [{
            name: "Xuper",
            url: finalUrl,
            quality: "Auto",
            headers: {
                "Content-Auth": authToken,
                "User-Agent": UA_CDN,
                "App": APP_ID,
                "App-Version": APK_VERSION
            }
        }];
        
    } catch (error) {
        console.error("[Xuper] Error en getStreams:", error.message);
        return []; // Devolvemos vacío si falla
    }
}

// Exportar la función para Nuvio
module.exports = { getStreams };
