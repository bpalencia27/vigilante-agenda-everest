// =====================================================================
//  SUITE 12 — SharePoint y caché del piloto
//  Cubre la tubería completa: construcción de URLs del API de SharePoint,
//  transporte GM (gmGet/gmJson), enlace compartido (primeShareAccess),
//  identificadores de archivo (parseSpDocId/spFallbackUrls), la base
//  piloto persistente (pilotoId/Guardar/DesdeCache/Meta/FreshCheck),
//  las cargas (readPym/loadPymBase/loadPymBaseDescarga/loadPymFile),
//  el captador de la pestaña de SharePoint (bootSharepointLite),
//  el programador de intentos (schedulePymBase) y el toast (spToast).
//  La red se simula con gmxhr/fetch falsos, como manda el harness.
// =====================================================================

const PILOTO_GUID = "809a098b-69d1-44fe-9e51-b01f07290807";
const SP_BASE = "https://viva1aips-my.sharepoint.com/personal/director_bello_viva1a_com_co";

// CSV mínimo pero realista: cédula, una actividad pendiente y un abandono PES.
const CSV_PILOTO = "CEDULA,TAMIZACION_VIH,ABANDONADOS_PES\n5150076,Susceptible,No\n99887766,,Si\n";
function bufCSV() { return new TextEncoder().encode(CSV_PILOTO).buffer; }

// Paquete v3 como el que deja pilotoGuardar en el almacén de Tampermonkey.
function paqueteV3(extraMeta) {
  return JSON.stringify(Object.assign({
    v: 3,
    labels: ["VIH", "Valoración integral de salud"],
    p: "5150076:0.1|300123:0",
    t: "5150076,300123,777",
    ab: "777",
    date: "2020-05-05",
    name: "BASE PILOTO.xlsx",
    mtime: "2026-08-01T10:00:00Z",
    fp: "BASE PILOTO.xlsx|2026-08-01T10:00:00Z",
    fb: true,
    id: PILOTO_GUID,
  }, extraMeta || {}));
}

// Espera activa con reloj REAL del host (los setTimeout del sandbox están
// recortados a 1 ms, así que las cadenas asíncronas del script terminan rápido).
function dormir(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function esperar(cond, ms, nota) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > (ms || 3000)) throw new Error("tiempo agotado esperando: " + (nota || "condición"));
    await dormir(5);
  }
}

// GM_xmlhttpRequest falso que atiende los dos tipos de llamada del piloto:
// metadatos (JSON de ~1 KB) y descarga del archivo (CSV como arraybuffer).
function gmxhrPiloto(cont) {
  return (o) => {
    cont.total++;
    const url = String(o.url || "");
    if (url.indexOf("$select=Name,TimeLastModified") >= 0) {
      cont.meta++; cont.urls.push(url);
      o.onload({ status: 200, response: { Name: cont.metaName, TimeLastModified: cont.metaMtime } });
      return;
    }
    if (url.indexOf("/$value") >= 0 || url.indexOf("download.aspx") >= 0) {
      cont.descargas++; cont.urls.push(url);
      o.onload({ status: 200, response: bufCSV() });
      return;
    }
    o.onload({ status: 200, responseText: "" });
  };
}
function contadorNuevo(metaName, metaMtime) {
  return { total: 0, meta: 0, descargas: 0, urls: [], metaName: metaName || "base_piloto.csv", metaMtime: metaMtime || "T-DESC" };
}

module.exports = {
  nombre: "SharePoint y caché del piloto (Suite 12)",
  cubre: [
    "spBase", "spListUrl", "spDownloadUrl", "spRows", "gmGet", "gmJson",
    "primeShareAccess", "parseSpDocId", "spFallbackUrls", "readPym",
    "pilotoId", "pilotoDesdeCache", "pilotoGuardar", "pilotoMeta", "pilotoFreshCheck",
    "loadPymBase", "loadPymBaseDescarga", "bootSharepointLite", "schedulePymBase",
    "spToast", "dismissSpToast", "loadPymFile",
  ],

  async pruebas(t, api, env, cargar) {

    // ---------- constructores de URL (puros, sin red) ----------
    t.caso("spBase: arma la raíz del sitio personal de SharePoint", () => {
      t.igual(api.spBase(), SP_BASE);
    });

    t.caso("spListUrl: carpeta por defecto con espacios como %20 y barras intactas (encodeURI, no encodeURIComponent)", () => {
      t.igual(api.spListUrl(),
        SP_BASE + "/_api/web/GetFolderByServerRelativeUrl('/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES%20DE%20PYM')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$orderby=TimeLastModified%20desc&$top=60");
    });

    t.caso("spListUrl: acepta una carpeta explícita y la codifica", () => {
      const u = api.spListUrl("/otra/carpeta con espacio");
      t.cierto(u.indexOf("GetFolderByServerRelativeUrl('/otra/carpeta%20con%20espacio')") >= 0, "debe codificar el espacio sin tocar las barras");
      t.cierto(u.indexOf("$top=60") >= 0);
    });

    t.caso("spDownloadUrl: ruta del archivo codificada dentro de GetFileByServerRelativeUrl", () => {
      t.igual(api.spDownloadUrl("/personal/x/Documents/Agenda de hoy.xlsx"),
        SP_BASE + "/_api/web/GetFileByServerRelativeUrl('/personal/x/Documents/Agenda%20de%20hoy.xlsx')/$value");
    });

    t.caso("spRows: desenrolla las dos formas de respuesta del API (value y d.results) y cae a []", () => {
      t.igual(api.spRows({ value: [1, 2] }), [1, 2]);
      t.igual(api.spRows({ d: { results: [3] } }), [3]);
      t.igual(api.spRows({}), []);
      t.igual(api.spRows(null), []);
    });

    // ---------- identificadores de archivo ----------
    t.caso("parseSpDocId: saca el GUID del enlace completo, del GUID con llaves y del GUID pelado", () => {
      t.igual(api.parseSpDocId("https://viva1aips-my.sharepoint.com/:x:/r/personal/d/_layouts/15/Doc.aspx?sourcedoc=%7B809A098B-69D1-44FE-9E51-B01F07290807%7D&file=BASE.xlsx&action=default"), PILOTO_GUID);
      t.igual(api.parseSpDocId("{809A098B-69D1-44FE-9E51-B01F07290807}"), PILOTO_GUID);
      t.igual(api.parseSpDocId("  809a098b-69d1-44fe-9e51-b01f07290807  "), PILOTO_GUID);
    });

    t.caso("parseSpDocId: basura, null y URI malformada devuelven cadena vacía (sin lanzar)", () => {
      t.igual(api.parseSpDocId("esto no es un enlace"), "");
      t.igual(api.parseSpDocId(null), "");
      t.noLanza(() => api.parseSpDocId("%E0%A4%A"), "un porcentaje malformado no debe reventar decodeURIComponent");
      t.igual(api.parseSpDocId("%E0%A4%A"), "");
    });

    t.caso("spFallbackUrls: normaliza el id (llaves fuera, minúsculas) y da las DOS rutas de descarga", () => {
      const urls = api.spFallbackUrls("{809A098B-69D1-44FE-9E51-B01F07290807}");
      t.igual(urls.length, 2);
      t.igual(urls[0], SP_BASE + "/_api/web/GetFileById('" + PILOTO_GUID + "')/$value");
      t.igual(urls[1], SP_BASE + "/_layouts/15/download.aspx?UniqueId=" + PILOTO_GUID);
    });

    t.caso("pilotoId: el id configurado de fábrica, ya normalizado", () => {
      t.igual(api.pilotoId(), PILOTO_GUID);
    });

    t.caso("pilotoId: quita llaves y baja a minúsculas; sin respaldo configurado devuelve vacío", () => {
      const c = cargar({ silencioso: true });
      c.api.__CONFIG.SP.respaldo = { id: "{ABCDEF01-1111-2222-3333-444444444444}", name: "x.xlsx" };
      t.igual(c.api.pilotoId(), "abcdef01-1111-2222-3333-444444444444");
      c.api.__CONFIG.SP.respaldo = null;
      t.igual(c.api.pilotoId(), "");
    });

    // ---------- transporte GM: gmGet / gmJson ----------
    {
      const capturas = [];
      let plan = (o) => o.onload({ status: 200, responseText: "ok" });
      const cG = cargar({ silencioso: true, gmxhr: (o) => { capturas.push(o); plan(o); } });

      await t.casoAsync("gmGet: GET con valores por defecto (sin Accept, timeout 60000) y resuelve en 2xx", async () => {
        const r = await cG.api.gmGet("https://sitio/x");
        t.igual(r.responseText, "ok");
        const o = capturas[capturas.length - 1];
        t.igual(o.method, "GET");
        t.igual(o.responseType, "");
        t.igual(o.headers, {});
        t.igual(o.timeout, 60000);
      });

      await t.casoAsync("gmGet: respeta responseType, cabecera Accept y timeout por llamada", async () => {
        await cG.api.gmGet("https://sitio/y", "json", "application/json;odata=nometadata", 12000);
        const o = capturas[capturas.length - 1];
        t.igual(o.responseType, "json");
        t.igual(o.headers, { Accept: "application/json;odata=nometadata" });
        t.igual(o.timeout, 12000);
      });

      await t.casoAsync("gmGet: HTTP fuera de 2xx, error de red y timeout rechazan con mensajes distintos", async () => {
        let msg = "";
        plan = (o) => o.onload({ status: 500 });
        try { await cG.api.gmGet("https://sitio/z"); } catch (e) { msg = e.message; }
        t.igual(msg, "HTTP 500");
        plan = (o) => o.onerror();
        try { await cG.api.gmGet("https://sitio/z"); } catch (e) { msg = e.message; }
        t.igual(msg, "error de red/permiso");
        plan = (o) => o.ontimeout();
        try { await cG.api.gmGet("https://sitio/z"); } catch (e) { msg = e.message; }
        t.igual(msg, "se agotó el tiempo");
      });

      await t.casoAsync("gmJson: pide JSON con Accept odata y timeout corto de 12 s; prefiere r.response y si no, interpreta responseText", async () => {
        plan = (o) => o.onload({ status: 200, response: { value: [{ Name: "a" }] }, responseText: '{"value":[{"Name":"NO"}]}' });
        let j = await cG.api.gmJson("https://sitio/lista");
        t.igual(j.value[0].Name, "a", "r.response manda sobre responseText");
        const o = capturas[capturas.length - 1];
        t.igual(o.responseType, "json");
        t.igual(o.headers.Accept, "application/json;odata=nometadata");
        t.igual(o.timeout, 12000);
        plan = (x) => x.onload({ status: 200, responseText: '{"d":{"results":[7]}}' });
        j = await cG.api.gmJson("https://sitio/lista");
        t.igual(cG.api.spRows(j), [7], "responseText se interpreta cuando no hay response");
        plan = (x) => x.onload({ status: 200, responseText: "" });
        j = await cG.api.gmJson("https://sitio/lista");
        t.igual(j, {}, "respuesta vacía cae a objeto vacío");
      });
    }

    // ---------- primeShareAccess: enlace compartido con caché de 25 min ----------
    await t.casoAsync("primeShareAccess: falla de red -> false; éxito -> true y queda cacheado; force vuelve a llamar", async () => {
      const cont = { n: 0, ultimaUrl: "" };
      let plan = "falla";
      const c = cargar({ silencioso: true, gmxhr: (o) => { cont.n++; cont.ultimaUrl = String(o.url || ""); if (plan === "falla") o.onerror(); else o.onload({ status: 200, responseText: "" }); } });
      t.igual(await c.api.primeShareAccess(), false, "sin cookie previa y con red caída debe fallar");
      t.igual(cont.n, 1);
      plan = "ok";
      t.igual(await c.api.primeShareAccess(), true);
      t.igual(cont.n, 2);
      t.igual(cont.ultimaUrl, c.api.__CONFIG.SP.shareLink, "debe visitar exactamente el enlace de compartir configurado");
      t.igual(await c.api.primeShareAccess(), true, "dentro de los 25 min no vuelve a la red");
      t.igual(cont.n, 2, "la segunda llamada sin force usa la caché");
      plan = "falla";
      t.igual(await c.api.primeShareAccess(true), false, "force ignora la caché y reporta el fallo real");
      t.igual(cont.n, 3);
      t.igual(await c.api.primeShareAccess(), true, "el sello anterior sigue vigente aunque el force haya fallado");
      t.igual(cont.n, 3);
    });

    await t.casoAsync("primeShareAccess: sin enlace configurado devuelve false sin tocar la red", async () => {
      const cont = { n: 0 };
      const c = cargar({ silencioso: true, gmxhr: () => { cont.n++; } });
      c.api.__CONFIG.SP.shareLink = "";
      t.igual(await c.api.primeShareAccess(true), false);
      t.igual(cont.n, 0);
    });

    // ---------- readPym: la rama CSV construye el índice {map, todos, abandono} ----------
    await t.casoAsync("readPym: un CSV se indexa directo (pendientes, universo de cédulas y abandono PES)", async () => {
      const c = cargar({ silencioso: true });
      c.ctx.TextDecoder = TextDecoder;                    // el sandbox no trae TextDecoder
      const idx = await c.api.readPym("pym.csv", bufCSV());
      t.igual(idx.map.size, 1, "solo la cédula con algo pendiente entra al mapa");
      t.igual(idx.map.get("5150076"), ["VIH"]);
      t.igual(idx.todos.size, 2, "todas las cédulas de la hoja, tengan o no pendientes");
      t.cierto(idx.todos.has("99887766"));
      t.cierto(idx.abandono.has("99887766"), "ABANDONADOS_PES='Si' debe quedar registrado");
      t.falso(idx.abandono.has("5150076"));
    });

    // ---------- pilotoGuardar: empaqueta y persiste en el almacén GM ----------
    await t.casoAsync("pilotoGuardar: guarda el paquete v3 con los metadatos del piloto y sobrevive el viaje de ida y vuelta", async () => {
      const c = cargar({ silencioso: true });
      const mapa = new Map([["111", ["Tamización de VIH"]], ["222", ["Valoración integral de salud", "Tamización de VIH"]]]);
      await c.api.pilotoGuardar({ map: mapa, todos: new Set(["111", "222"]), abandono: new Set(["222"]) }, { name: "N.xlsx", mtime: "M1" });
      const crudo = c.env.gm["vgl_piloto"];
      t.cierto(typeof crudo === "string" && crudo.lastIndexOf('{"v":3', 0) === 0, "el paquete debe empezar por el prefijo v3");
      const o = JSON.parse(crudo);
      t.igual(o.id, PILOTO_GUID, "lleva el id del piloto para invalidar si cambia el enlace");
      t.igual(o.fb, true, "queda marcado como base de respaldo");
      t.igual(o.date, c.api.todayStamp());
      t.igual(o.name, "N.xlsx");
      t.igual(o.mtime, "M1");
      const u = await c.api.unpackPym(crudo, null);
      t.igual(u.map.get("222"), ["Valoración integral de salud", "Tamización de VIH"]);
      t.igual(Array.from(u.abandono), ["222"]);
    });

    // ---------- pilotoDesdeCache ----------
    await t.casoAsync("pilotoDesdeCache: sin caché o con prefijo que no es v3 devuelve false", async () => {
      const c = cargar({ silencioso: true });
      t.igual(await c.api.pilotoDesdeCache(), false, "almacén vacío");
      c.env.gm["vgl_piloto"] = '{"x":1}';
      t.igual(await c.api.pilotoDesdeCache(), false, "paquete que no empieza por v3 se descarta sin interpretarlo");
    });

    await t.casoAsync("pilotoDesdeCache: caché corrupta (empieza por v3 pero no es JSON) lanza y el catch devuelve false", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = '{"v":3, ESTO NO ES JSON';
      t.igual(await c.api.pilotoDesdeCache(), false);
      t.igual(c.api.__state.pymFile, "");
      t.igual(c.api.__state.pym.size, 0);
      t.igual(c.api.__state.pymFallback, false);
    });

    await t.casoAsync("pilotoDesdeCache: si el id guardado no es el del enlace configurado, se rechaza y el estado queda intacto", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = paqueteV3({ id: "00000000-0000-0000-0000-000000000000" });
      t.igual(await c.api.pilotoDesdeCache(), false);
      t.igual(c.api.__state.pymFile, "", "no debe cargar nada");
      t.igual(c.api.__state.pym.size, 0);
    });

    await t.casoAsync("pilotoDesdeCache: paquete válido puebla el estado y marca la carga como base piloto", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = paqueteV3();
      t.igual(await c.api.pilotoDesdeCache(), true);
      const st = c.api.__state;
      t.igual(st.pym.size, 2);
      t.igual(st.pym.get("5150076"), ["VIH", "Valoración integral de salud"]);
      t.igual(st.pym.get("300123"), ["VIH"]);
      t.cierto(st.pymTodos.has("777"));
      t.cierto(st.pymAbandono.has("777"));
      t.igual(st.pymMTime, "2026-08-01T10:00:00Z");
      t.igual(st.pymFallback, true);
      t.igual(st.pymFile, "BASE PILOTO.xlsx (base piloto — aún no llega la de hoy)");
      // v12.10.12 — visibilidad: caer a la base piloto (desde caché, sin red) queda contado.
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(w.acciones["pym.fallback.cache"], 1);
    });

    await t.casoAsync("pilotoDesdeCache: si ya hay un PyM cargado no lo pisa (devuelve true y deja el estado como estaba)", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = paqueteV3();
      c.api.__state.pymFile = "MANUAL.xlsx";
      t.igual(await c.api.pilotoDesdeCache(), true);
      t.igual(c.api.__state.pymFile, "MANUAL.xlsx");
      t.igual(c.api.__state.pym.size, 0, "el mapa del manual (vacío en esta simulación) no se reemplaza");
    });

    // ---------- pilotoMeta ----------
    await t.casoAsync("pilotoMeta: consulta solo Name y TimeLastModified por GetFileById y tolera la envoltura d de odata", async () => {
      const urls = [];
      let plan = (o) => o.onload({ status: 200, response: { Name: "ARCHIVO.xlsx", TimeLastModified: "T-9" } });
      const c = cargar({ silencioso: true, gmxhr: (o) => { urls.push(String(o.url || "")); plan(o); } });
      let m = await c.api.pilotoMeta();
      t.igual(m, { name: "ARCHIVO.xlsx", mtime: "T-9" });
      t.cierto(urls[0].indexOf(SP_BASE + "/_api/web/GetFileById('" + PILOTO_GUID + "')?$select=Name,TimeLastModified") === 0, "URL de metadatos exacta");
      plan = (o) => o.onload({ status: 200, response: { d: { Name: "B.xlsx", TimeLastModified: "T2" } } });
      m = await c.api.pilotoMeta();
      t.igual(m, { name: "B.xlsx", mtime: "T2" });
    });

    await t.casoAsync("pilotoMeta: sin TimeLastModified o con la red caída devuelve null (nunca lanza)", async () => {
      let plan = (o) => o.onload({ status: 200, response: { Name: "SOLO_NOMBRE.xlsx" } });
      const c = cargar({ silencioso: true, gmxhr: (o) => plan(o) });
      t.igual(await c.api.pilotoMeta(), null);
      plan = (o) => o.onerror();
      t.igual(await c.api.pilotoMeta(), null);
    });

    // ---------- pilotoFreshCheck ----------
    await t.casoAsync("pilotoFreshCheck: si lo cargado NO es la piloto, no consulta nada ni marca la franja", async () => {
      const cont = contadorNuevo();
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      // pymFallback queda en false (estado de fábrica): el PyM real manda.
      await c.api.pilotoFreshCheck();
      t.igual(cont.total, 0);
      t.igual(c.env.gm["vgl_piloto_chk"], undefined);
    });

    await t.casoAsync("pilotoFreshCheck: primera revisión de la franja consulta metadatos y, sin cambios, NO descarga; la segunda ni consulta", async () => {
      const cont = contadorNuevo("BASE PILOTO.xlsx", "T1");
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.api.__state.pymFallback = true;
      c.api.__state.pymMTime = "T1";
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 1, "una consulta de metadatos de ~1 KB");
      t.igual(cont.descargas, 0, "mtime igual: se queda con la copia guardada");
      const franja = String(c.env.gm["vgl_piloto_chk"] || "");
      t.cierto(franja.lastIndexOf(c.api.todayStamp() + "|", 0) === 0 && /\|(am|pm)$/.test(franja), "la franja del día quedó sellada");
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 1, "misma franja: no vuelve a consultar");
    });

    await t.casoAsync("pilotoFreshCheck: si el archivo cambió en el servidor, baja la versión nueva y actualiza el estado", async () => {
      const cont = contadorNuevo("base_piloto.csv", "T2");
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.ctx.TextDecoder = TextDecoder;
      c.api.__CONFIG.SP.respaldo = { id: PILOTO_GUID, name: "base_piloto.csv" };
      c.api.__state.pymFallback = true;
      c.api.__state.pymMTime = "T1";                      // la copia local es más vieja
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 1);
      t.igual(cont.descargas, 1, "mtime distinto: sí se paga la descarga");
      t.igual(c.api.__state.pymMTime, "T2");
      t.igual(c.api.__state.pymFallback, true, "sigue siendo la piloto, no el PyM real");
      t.cierto(String(c.api.__state.pymFile).indexOf("base piloto") >= 0);
      t.cierto(String(c.env.gm["vgl_piloto"] || "").lastIndexOf('{"v":3', 0) === 0, "la copia persistente quedó renovada");
    });

    // ---------- loadPymBase / loadPymBaseDescarga ----------
    await t.casoAsync("loadPymBase: con la base automática apagada devuelve false sin tocar la red", async () => {
      const cont = contadorNuevo();
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.api.__S.baseAuto = false;
      t.igual(await c.api.loadPymBase(true), false);
      t.igual(cont.total, 0);
    });

    await t.casoAsync("loadPymBase: si ya hay algo cargado devuelve true y no descarga nada", async () => {
      const cont = contadorNuevo();
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.api.__state.pymFile = "YA_CARGADO.xlsx";
      t.igual(await c.api.loadPymBase(true), true);
      t.igual(cont.total, 0);
    });

    await t.casoAsync("loadPymBase: con copia guardada arranca desde la caché (cero descargas) y dispara la revisión de frescura aparte", async () => {
      const cont = contadorNuevo("BASE PILOTO.xlsx", "2026-08-01T10:00:00Z"); // mismo mtime del paquete: sin cambios
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.env.gm["vgl_piloto"] = paqueteV3();
      t.igual(await c.api.loadPymBase(true), true);
      t.igual(c.api.__state.pymFile, "BASE PILOTO.xlsx (base piloto — aún no llega la de hoy)");
      t.igual(cont.descargas, 0, "la copia guardada evita la descarga de 14 MB");
      await esperar(() => cont.meta >= 1, 2000, "la revisión de frescura en segundo plano");
      t.igual(cont.descargas, 0, "sin cambios en el servidor: sigue la copia");
    });

    await t.casoAsync("loadPymBase: sin caché baja el archivo, guarda la copia persistente y marca RESPALDO", async () => {
      const cont = contadorNuevo("base_piloto.csv", "T-DESC");
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.ctx.TextDecoder = TextDecoder;
      c.api.__CONFIG.SP.respaldo = { id: PILOTO_GUID, name: "base_piloto.csv" };
      t.igual(await c.api.loadPymBase(true), true);
      const st = c.api.__state;
      t.igual(st.pymFallback, true, "es la piloto, no el PyM del día");
      t.igual(st.pymFile, "base_piloto.csv (base piloto — aún no llega la de hoy)");
      t.igual(st.pym.get("5150076"), ["VIH"]);
      t.igual(st.pymFP, "base_piloto.csv|T-DESC", "la huella usa el nombre crudo + mtime real");
      t.igual(cont.meta, 1, "metadatos primero, para guardar la copia con el mtime verdadero");
      t.igual(cont.descargas, 1);
      const copia = JSON.parse(c.env.gm["vgl_piloto"]);
      t.igual(copia.mtime, "T-DESC");
      t.igual(copia.id, PILOTO_GUID);
      await esperar(() => c.env.gm["vgl_pym_esfallback"] === "1", 2000, "la caché del día marca esfallback");
      // v12.10.12 — visibilidad: caer a la base piloto bajada por red también queda contado
      // (con una etiqueta distinta a la del arranque desde caché, son situaciones distintas).
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(w.acciones["pym.fallback.red"], 1);
    });

    await t.casoAsync("loadPymBaseDescarga: si las DOS rutas de descarga fallan, devuelve false tras probarlas una tras otra", async () => {
      let intentos = 0;
      const c = cargar({ silencioso: true, gmxhr: (o) => { intentos++; o.onerror(); } });
      t.igual(await c.api.loadPymBaseDescarga(true, null), false);
      t.igual(intentos, 2, "GetFileById y download.aspx, en ese orden, sin paralelismo");
      t.igual(c.api.__state.pymFile, "", "no debe quedar nada a medias");
    });

    // ---------- bootSharepointLite: el captador de la pestaña de SharePoint ----------
    await t.casoAsync("bootSharepointLite: si la base de HOY ya está capturada y no es piloto, no hace nada", async () => {
      const llamadas = [];
      const c = cargar({ silencioso: true, fetch: async (u) => { llamadas.push(String(u)); return { ok: false, status: 404 }; } });
      c.env.gm["vgl_pym_dia"] = c.api.todayStamp();
      c.env.gm["vgl_pym_esfallback"] = "";
      c.env.gm["vgl_pym"] = "x".repeat(150);
      await c.api.bootSharepointLite();
      t.igual(llamadas.length, 0, "ni listar ni descargar");
      t.falso(c.env.doc._nodos.some((n) => n.id === "vgl-sp"), "ni siquiera el toast de búsqueda");
    });

    await t.casoAsync("bootSharepointLite: encuentra el PyM de HOY por nombre, lo captura con fetch de la pestaña y lo comparte por GM", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async (u) => {
          const url = String(u);
          if (url.indexOf("/Files?") >= 0) return { ok: true, json: async () => ({ value: [fila] }) };
          if (url.indexOf("/$value") >= 0) return { ok: true, arrayBuffer: async () => bufCSV() };
          return { ok: false, status: 404 };
        },
      });
      c.ctx.TextDecoder = TextDecoder;
      const hoy = c.api.todayStamp();
      const nombreHoy = "Agenda_Dia_CMB_" + hoy.replace(/-/g, "") + ".csv";
      const fila = { Name: nombreHoy, ServerRelativeUrl: "/personal/x/" + nombreHoy, TimeLastModified: hoy + "T06:00:00Z" };
      await c.api.bootSharepointLite();
      const crudo = String(c.env.gm["vgl_pym"] || "");
      t.cierto(crudo.lastIndexOf('{"v":3', 0) === 0, "el paquete quedó en el almacén compartido");
      const o = JSON.parse(crudo);
      t.igual(o.name, nombreHoy + " (PyM de hoy)");
      t.igual(o.fb, false, "NO es la base piloto");
      t.cierto(o.p.indexOf("5150076:") === 0, "las cédulas del CSV viajan indexadas");
      t.igual(c.env.gm["vgl_pym_dia"], hoy);
      t.igual(c.env.gm["vgl_pym_esfallback"], "");
      const textos = c.env.doc._nodos.filter((n) => n.className === "vgl-sp-text").map((n) => String(n.textContent));
      t.cierto(textos.some((x) => x.indexOf("PyM de hoy capturado") >= 0 && x.indexOf(nombreHoy) >= 0), "el toast confirma la captura");
    });

    await t.casoAsync("bootSharepointLite: sin archivo de hoy cae a la base piloto por sus URLs de respaldo y lo marca esfallback", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async (u) => {
          const url = String(u);
          if (url.indexOf("/Files?") >= 0) return { ok: true, json: async () => ({ value: [] }) };
          if (url.indexOf("/$value") >= 0 || url.indexOf("download.aspx") >= 0) return { ok: true, arrayBuffer: async () => bufCSV() };
          return { ok: false, status: 404 };
        },
      });
      c.ctx.TextDecoder = TextDecoder;
      c.api.__CONFIG.SP.respaldo = { id: PILOTO_GUID, name: "base_piloto.csv" };
      await c.api.bootSharepointLite();
      const o = JSON.parse(String(c.env.gm["vgl_pym"] || "{}"));
      t.igual(o.fb, true);
      t.cierto(String(o.name).indexOf("base piloto") >= 0);
      t.igual(c.env.gm["vgl_pym_esfallback"], "1");
      const textos = c.env.doc._nodos.filter((n) => n.className === "vgl-sp-text").map((n) => String(n.textContent));
      t.cierto(textos.some((x) => x.indexOf("Sin PyM de hoy") >= 0), "avisa que es la piloto, no la agenda de hoy");
    });

    // ---------- schedulePymBase ----------
    await t.casoAsync("schedulePymBase: con PyM ya cargado no programa nada", async () => {
      const cont = contadorNuevo();
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.api.__state.pymFile = "YA.xlsx";
      c.api.schedulePymBase();
      await dormir(50);                                   // los timers del sandbox corren en ~1 ms
      t.igual(cont.total, 0);
    });

    await t.casoAsync("schedulePymBase: encadena caché -> piloto y termina con la base cargada (timers recortados del sandbox)", async () => {
      const cont = contadorNuevo("base_piloto.csv", "T-DESC");
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.ctx.TextDecoder = TextDecoder;
      c.api.__CONFIG.SP.respaldo = { id: PILOTO_GUID, name: "base_piloto.csv" };
      c.api.schedulePymBase();
      await esperar(() => String(c.api.__state.pymFile).indexOf("base piloto") >= 0, 4000, "la carga programada de la piloto");
      t.igual(cont.descargas, 1);
      t.igual(c.api.__state.pym.get("5150076"), ["VIH"]);
    });

    await t.casoAsync("schedulePymBase: loadPymBase rechaza (por ej. sin TextDecoder) y la cadena de reintentos se mantiene", async () => {
      const cont = contadorNuevo("base_piloto.csv", "T");
      const c = cargar({ silencioso: true, gmxhr: gmxhrPiloto(cont) });
      c.api.__CONFIG.SP.respaldo = { id: PILOTO_GUID, name: "base_piloto.csv" };
      c.api.schedulePymBase();
      await dormir(400);
      t.igual(cont.descargas, 3);
      t.igual(c.api.__state.pymFile, "");
    });

    // ---------- spToast / dismissSpToast ----------
    await t.casoAsync("spToast: crea el aviso una vez, lo reutiliza, y dismissSpToast lo desvanece", async () => {
      const c = cargar({ silencioso: true });
      c.api.spToast("primer aviso", 0);                   // 0 = fijo, sin autodescartarse
      const nodo = c.env.doc._nodos.find((n) => n.id === "vgl-sp");
      t.cierto(!!nodo, "el toast debe existir en el DOM");
      t.cierto(c.env.doc.body.children.indexOf(nodo) >= 0, "colgado del body");
      t.cierto(nodo.classList && nodo.classList.contains("vgl-sp-visible"), "debe ser visible");
      t.cierto(String(nodo.children[0].textContent).indexOf("🛡️ Vigilante PyM · primer aviso") === 0);
      // A partir de aquí el documento SÍ encuentra el toast (como en la página real).
      c.env.doc.getElementById = (id) => (id === "vgl-sp" ? nodo : null);
      c.api.spToast("segundo aviso", 0);
      t.igual(c.env.doc._nodos.filter((n) => n.id === "vgl-sp").length, 1, "reutiliza el nodo, no apila toasts");
      t.cierto(String(nodo.children[0].textContent).indexOf("segundo aviso") >= 0, "el texto se actualiza en el mismo aviso");
      c.api.dismissSpToast();
      t.falso(nodo.classList && nodo.classList.contains("vgl-sp-visible"), "debe estar oculto");
    });

    await t.casoAsync("spToast: con duración se autodescarta solo; dismissSpToast sin toast no lanza", async () => {
      const c = cargar({ silencioso: true });
      c.api.spToast("fugaz", 6000);                       // el sandbox recorta el timer a ~1 ms
      const nodo = c.env.doc._nodos.find((n) => n.id === "vgl-sp");
      c.env.doc.getElementById = (id) => (id === "vgl-sp" ? nodo : null);
      await esperar(() => !nodo.classList || !nodo.classList.contains("vgl-sp-visible"), 2000, "el autodescarte del toast");
      const c2 = cargar({ silencioso: true });
      t.noLanza(() => c2.api.dismissSpToast(), "sin toast en pantalla debe ser inofensivo");
    });

    // ---------- loadPymFile: carga manual con «Abrir PyM» ----------
    await t.casoAsync("loadPymFile: un CSV elegido a mano se indexa y REEMPLAZA cualquier respaldo (pymFallback=false)", async () => {
      const c = cargar({ silencioso: true });
      // FileReader no existe en el sandbox: doble de pruebas mínimo que entrega el texto.
      c.ctx.FileReader = function () {
        const yo = this;
        this.readAsText = () => { setTimeout(() => { if (yo.onload) yo.onload({ target: { result: CSV_PILOTO } }); }, 0); };
        this.readAsArrayBuffer = () => {};
      };
      c.api.__state.pymFallback = true;                   // veníamos de la piloto
      c.api.loadPymFile({ name: "PYM_MANUAL.csv" });
      await esperar(() => c.api.__state.pymFile === "PYM_MANUAL.csv", 3000, "la carga manual del CSV");
      t.igual(c.api.__state.pymFallback, false, "«Abrir PyM» manda: deja de ser respaldo");
      t.igual(c.api.__state.pym.get("5150076"), ["VIH"]);
      t.cierto(c.api.__state.pymAbandono.has("99887766"));
    });
  },
};
