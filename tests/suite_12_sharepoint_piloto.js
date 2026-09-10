// =====================================================================
//  SUITE 12 — SharePoint y caché de la base única (v18.6.0)
//  Cubre la tubería de la BASE ÚNICA por GUID: identificador configurado
//  (pilotoId), hojas fijadas (baseSheetOpts), metadatos por GetFileById
//  (pilotoMeta), enlace compartido con renovación de ~25 min
//  (primeShareAccess), identificador de enlace (parseSpDocId), la copia
//  persistente (pilotoGuardar/pilotoDesdeCache con sus purgas), las cargas
//  (loadPymBase/loadPymBaseDescarga con rollback a la última copia buena),
//  los refrescos de las 06:00 y las 12:00 de Bogotá (pilotoFreshCheck),
//  la escalera de reintentos (schedulePymBase), la carga manual
//  (loadPymFile) y el toast (spToast).
//  La red se simula con gmxhr falso, como manda el harness.
//
//  v18.6.0 — lo que esta suite YA NO cubre (y por qué):
//   · spFallbackUrls: la cubre la suite 03 (no duplicar guardianes).
//   · TODA la maquinaria del archivo diario («Agenda Día»): pickTodaysFile,
//     loadPymDiario, bootSharepointLite… fueron retiradas del userscript.
// =====================================================================

const { instalarDomEnriquecido } = require("./harness.js");

const GUID = "6594b356-f608-4c56-bb6f-6a90f2125a3f";       // CONFIG.SP.base.id de fábrica
const SP_BASE = "https://viva1aips-my.sharepoint.com/personal/director_bello_viva1a_com_co";

// Instantes congelados (UTC) para las ventanas de refresco Bogotá (UTC-5 fijo):
// 10:30Z = 05:30 (antes de la ventana de la mañana) · 11:05Z = 06:05 · 17:05Z = 12:05.
const T_PRE6 = Date.parse("2026-09-07T10:30:00Z");
const T_605 = Date.parse("2026-09-07T11:05:00Z");
const T_1205 = Date.parse("2026-09-07T17:05:00Z");

// CSV mínimo pero realista: cédula sintética, una actividad pendiente y un abandono PES.
const CSV_PILOTO = "CEDULA,TAMIZACION_VIH,ABANDONADOS_PES\n5150076,Susceptible,No\n99887766,,Si\n";

// Paquete v3 como el que deja pilotoGuardar en el almacén de Tampermonkey.
// La fecha de la cola viaja al FINAL del JSON: mirar la cola evita desempaquetar
// varios MB solo para descubrir que la copia es de hace más de 30 días (purga A2
// de la auditoría del 2026-09-03), así que el fixture lleva una fecha fresca
// calculada al vuelo — nunca quemada, que es justo lo que la purga caza.
function paqueteV3(extraMeta) {
  return JSON.stringify(Object.assign({
    v: 3,
    labels: ["VIH", "Valoración integral de salud"],
    p: "5150076:0.1|300123:0",
    t: "5150076,300123,777",
    ab: "777",
    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    name: "BASE PILOTO.xlsx",
    mtime: "2026-08-01T10:00:00Z",
    fp: "BASE PILOTO.xlsx|2026-08-01T10:00:00Z",
    id: GUID,
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

// Congela el reloj del contexto del userscript en un instante fijo. bogotaAhora()
// calcula SIEMPRE UTC-5 desde Date.now(), así que con el reloj congelado las
// ventanas de refresco (06:00 / 12:00) son deterministas sin importar la hora
// real a la que corra el banco, y sin esperar ni un minuto de reloj de pared.
function congelar(c, ms) {
  const FechaFija = class extends Date {
    constructor(...args) { if (args.length) super(...args); else super(ms); }
    static now() { return ms; }
  };
  c.env.win.Date = FechaFija;
  c.ctx.Date = FechaFija;
}

// ---------- ZIP "stored" (método 0) construido a mano, igual que suite_16 ----------
// Suficiente para zipIndex/zipRead/zipEntryChunks del userscript sin fingir la
// descompresión: así la prueba no depende de DecompressionStream del entorno.
function crearZipPrueba(archivos) {
  const enc = new TextEncoder();
  const buffers = [];
  let lenNombres = 0, lenDatos = 0;
  for (const [name, content] of Object.entries(archivos)) {
    const nameBuf = enc.encode(name);
    const dataBuf = enc.encode(content);
    buffers.push({ nameBuf, dataBuf, offset: 0 });
    lenNombres += nameBuf.length;
    lenDatos += dataBuf.length;
  }
  const buf = new Uint8Array(1024 + lenNombres * 2 + lenDatos);
  const dv = new DataView(buf.buffer);
  let pos = 0;
  for (const b of buffers) {
    b.offset = pos;
    dv.setUint32(pos, 0x04034b50, true); pos += 4;   // firma local
    dv.setUint16(pos, 20, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;            // método 0 = sin comprimir
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint32(pos, 0, true); pos += 4;
    dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
    dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
    dv.setUint16(pos, b.nameBuf.length, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    buf.set(b.nameBuf, pos); pos += b.nameBuf.length;
    buf.set(b.dataBuf, pos); pos += b.dataBuf.length;
  }
  const cdStart = pos;
  let cdCount = 0;
  for (const b of buffers) {
    dv.setUint32(pos, 0x02014b50, true); pos += 4;   // firma central
    dv.setUint16(pos, 20, true); pos += 2;
    dv.setUint16(pos, 20, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;            // método 0
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint32(pos, 0, true); pos += 4;
    dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
    dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
    dv.setUint16(pos, b.nameBuf.length, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint32(pos, 0, true); pos += 4;
    dv.setUint32(pos, b.offset, true); pos += 4;
    buf.set(b.nameBuf, pos); pos += b.nameBuf.length;
    cdCount++;
  }
  const cdSize = pos - cdStart;
  dv.setUint32(pos, 0x06054b50, true); pos += 4;     // EOCD
  dv.setUint16(pos, 0, true); pos += 2;
  dv.setUint16(pos, 0, true); pos += 2;
  dv.setUint16(pos, cdCount, true); pos += 2;
  dv.setUint16(pos, cdCount, true); pos += 2;
  dv.setUint32(pos, cdSize, true); pos += 4;
  dv.setUint32(pos, cdStart, true); pos += 4;
  dv.setUint16(pos, 0, true); pos += 2;
  return buf.buffer.slice(0, pos);
}

function celda(ref, texto) { return '<c r="' + ref + '" t="inlineStr"><is><t>' + texto + '</t></is></c>'; }
function fila(n, celdas) { return '<row r="' + n + '">' + celdas.join("") + '</row>'; }
function hoja(filas) { return '<worksheet><sheetData>' + filas.join("") + '</sheetData></worksheet>'; }

// El SEÑUELO: hoja histórica con MUCHOS pendientes. En el libro real de 12 hojas
// la selección por puntaje elegía «CITASDIA AGOSTO» (auditoría H1, 2026-09-07) y
// el índice quedaba en 0 pacientes. Con la hoja fijada, el señuelo pierde SIEMPRE.
function xmlSenyuelo() {
  const filas = [fila(1, [celda("A1", "IDENTIFICACION"), celda("B1", "TAMIZACION_VIH")])];
  for (let i = 2; i <= 12; i++) filas.push(fila(i, [celda("A" + i, "8" + String(100000 + i)), celda("B" + i, "Susceptible")]));
  return hoja(filas);
}
// La hoja fijada: citas operativas con el vocabulario del CSV de siempre.
function xmlCitasRegional() {
  return hoja([
    fila(1, [celda("A1", "IDENTIFICACION"), celda("B1", "TAMIZACION_VIH"), celda("C1", "ABANDONADOS_PES")]),
    fila(2, [celda("A2", "5150076"), celda("B2", "Susceptible"), celda("C2", "No")]),
    fila(3, [celda("A3", "99887766"), celda("C3", "Si")]),
  ]);
}
// La hoja extra de tamizaciones (opción B del médico): «Aplica …» = pendiente.
function xmlProcexdt() {
  return hoja([
    fila(1, [celda("A1", "IDENTIFICACION"), celda("B1", "MAMA")]),
    fila(2, [celda("A2", "300123"), celda("B2", "Aplica Cobertura Fenix")]),
  ]);
}

function libroBaseUnica() {
  return crearZipPrueba({
    "xl/workbook.xml": '<workbook><sheets><sheet name="CITASDIA AGOSTO" sheetId="1" r:id="rId1"/><sheet name="citas dia regional" sheetId="2" r:id="rId2"/><sheet name="PROCEXDT" sheetId="3" r:id="rId3"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": xmlSenyuelo(),
    "xl/worksheets/sheet2.xml": xmlCitasRegional(),
    "xl/worksheets/sheet3.xml": xmlProcexdt(),
  });
}
// Libro SIN la hoja fijada: si cambian el nombre de las hojas, el lector tiene
// que decirlo — no quedarse callado leyendo la hoja que sea (auditoría H1).
function libroSinHojaFijada() {
  return crearZipPrueba({
    "xl/workbook.xml": '<workbook><sheets><sheet name="CITASDIA AGOSTO" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": xmlSenyuelo(),
  });
}
// Libro con la hoja fijada presente pero VACÍA: encabezados sí, pacientes no.
// El guardián de índice vacío (auditoría H8) prohíbe instalar —y guardar— eso.
function libroHojaFijadaVacia() {
  return crearZipPrueba({
    "xl/workbook.xml": '<workbook><sheets><sheet name="citas dia regional" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": hoja([fila(1, [celda("A1", "IDENTIFICACION"), celda("B1", "TAMIZACION_VIH")])]),
  });
}

// ---------- GM_xmlhttpRequest falso para el flujo de la base única ----------
// Atiende los tres tipos de llamada: metadatos (JSON de ~1 KB), el enlace de
// compartir de la carpeta (prime) y la descarga del libro (ZIP como arraybuffer).
// `plan` permite mutar el comportamiento EN VIVO (p. ej. la meta que empieza
// fallando y luego responde: así se prueba el no-sellado sin recargar el script).
function contadorBase() {
  return { total: 0, meta: 0, prime: 0, descargas: 0, urls: [], metaName: "BASE UNICA SEDE BELLO.xlsx", metaMtime: "T-DESC", libro: libroBaseUnica() };
}
function gmxhrBase(cont, plan) {
  plan = plan || {};
  return (o) => {
    cont.total++;
    const url = String(o.url || "");
    cont.urls.push(url);
    if (url.indexOf("$select=Name,TimeLastModified") >= 0) {
      cont.meta++;
      if (plan.meta === "fallo") { o.onerror(); return; }
      o.onload({ status: 200, response: { Name: plan.metaName || cont.metaName, TimeLastModified: plan.metaMtime || cont.metaMtime } });
      return;
    }
    if (url.indexOf("/:f:/") >= 0) {                       // el enlace de compartir de la carpeta
      cont.prime++;
      if (plan.prime === "fallo") { o.onerror(); return; }
      o.onload({ status: 200, responseText: "" });
      return;
    }
    if (url.indexOf("/$value") >= 0 || url.indexOf("download.aspx") >= 0) {
      cont.descargas++;
      if (plan.descarga === "fallo") { o.onerror(); return; }
      if (plan.descargaHtml) {                             // SharePoint con la sesión vencida: HTML con estado 200
        o.onload({ status: 200, response: new TextEncoder().encode("<html><body>iniciar sesion</body></html>").buffer });
        return;
      }
      o.onload({ status: 200, response: (plan.libro || cont.libro).slice(0) });
      return;
    }
    o.onload({ status: 200, responseText: "" });
  };
}

// Lee el anillo de log de la base (GM "vgl_base_log").
function logBase(c) { try { return JSON.parse(c.env.gm["vgl_base_log"] || "[]"); } catch (e) { return []; } }

// Caza los avisos que notify() pinta en la bandeja #vgl-toasts. El toast de la
// página se agrupa en una cola de 500 ms (recortada a ~1 ms en el sandbox) y el
// AZUL se autocierra, así que lo único estable es capturarlo AL PINTARSE: se
// engancha appendChild/prepend de la bandeja y se lee el título/cuerpo ahí.
function cazarToasts(c) {
  instalarDomEnriquecido(c.env.doc);                       // innerHTML + querySelector reales para _renderToast
  const bandeja = c.env.doc.createElement("div");
  bandeja.id = "vgl-toasts";
  c.env.doc.body.appendChild(bandeja);
  const getOrig = c.env.doc.getElementById;
  c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : getOrig(id));
  const vistos = [];
  const capturar = (n) => {
    vistos.push({
      color: n.__vglColor,
      titulo: String((n.querySelector(".vgl-toast-title") || {}).textContent || ""),
      cuerpo: String((n.querySelector(".vgl-toast-b") || {}).textContent || ""),
    });
  };
  const ap = bandeja.appendChild.bind(bandeja);
  bandeja.appendChild = (n) => { const r = ap(n); capturar(n); return r; };
  bandeja.prepend = (n) => { bandeja.children.unshift(n); n._parent = bandeja; capturar(n); return n; };
  return vistos;
}

module.exports = {
  nombre: "SharePoint y caché de la base única v18.6.0 (Suite 12)",
  cubre: [
    "pilotoId", "baseSheetOpts", "pilotoMeta", "primeShareAccess", "parseSpDocId",
    "pilotoGuardar", "pilotoDesdeCache", "loadPymBase", "loadPymBaseDescarga",
    "pilotoFreshCheck", "schedulePymBase", "loadPymFile",
    "spToast", "dismissSpToast",
  ],

  async pruebas(t, api, env, cargar) {

    // ---------- pilotoId: el GUID de CONFIG.SP.base, normalizado ----------
    t.caso("pilotoId: el GUID de la base única configurada de fábrica, ya en minúsculas", () => {
      t.igual(api.pilotoId(), GUID);
    });

    t.caso("pilotoId: quita llaves y baja a minúsculas; sin base configurada devuelve vacío", () => {
      const c = cargar({ silencioso: true });
      c.api.__CONFIG.SP.base = { id: "{ABCDEF01-1111-2222-3333-444444444444}" };
      t.igual(c.api.pilotoId(), "abcdef01-1111-2222-3333-444444444444");
      c.api.__CONFIG.SP.base = null;
      t.igual(c.api.pilotoId(), "");
    });

    // ---------- baseSheetOpts: las hojas fijadas ----------
    t.caso("baseSheetOpts: de fábrica fija la hoja de citas y la de tamizaciones (PROCEXDT)", () => {
      t.igual(api.baseSheetOpts(), { main: "citas dia regional", extra: "PROCEXDT", anexo5: "ANEXO" });
    });

    t.caso("baseSheetOpts: sin hoja configurada devuelve null (selección automática); sin extra queda vacío, no undefined", () => {
      const c = cargar({ silencioso: true });
      c.api.__CONFIG.SP.base = { id: GUID };               // sin .sheet
      t.igual(c.api.baseSheetOpts(), null);
      c.api.__CONFIG.SP.base = { id: GUID, sheet: "OTRA HOJA" };
      t.igual(c.api.baseSheetOpts(), { main: "OTRA HOJA", extra: "", anexo5: "" });
    });

    // ---------- parseSpDocId (se conserva del flujo viejo: sigue sirviendo ----------
    // ---------- para pegar un enlace nuevo del archivo en Ajustes)      ----------
    t.caso("parseSpDocId: saca el GUID del enlace completo, del GUID con llaves y del GUID pelado", () => {
      t.igual(api.parseSpDocId("https://viva1aips-my.sharepoint.com/:x:/r/personal/d/_layouts/15/Doc.aspx?sourcedoc=%7B6594B356-F608-4C56-BB6F-6A90F2125A3F%7D&file=BASE.xlsx&action=default"), GUID);
      t.igual(api.parseSpDocId("{" + GUID.toUpperCase() + "}"), GUID);
      t.igual(api.parseSpDocId("  " + GUID + "  "), GUID);
    });

    t.caso("parseSpDocId: basura, null y URI malformada devuelven cadena vacía (sin lanzar)", () => {
      t.igual(api.parseSpDocId("esto no es un enlace"), "");
      t.igual(api.parseSpDocId(null), "");
      t.noLanza(() => api.parseSpDocId("%E0%A4%A"), "un porcentaje malformado no debe reventar decodeURIComponent");
      t.igual(api.parseSpDocId("%E0%A4%A"), "");
    });

    // ---------- pilotoMeta: metadatos de ~1 KB por GetFileById ----------
    await t.casoAsync("pilotoMeta: consulta solo Name y TimeLastModified por GetFileById del GUID y tolera la envoltura d de odata", async () => {
      const urls = [];
      let plan = (o) => o.onload({ status: 200, response: { Name: "ARCHIVO.xlsx", TimeLastModified: "T-9" } });
      const c = cargar({ silencioso: true, gmxhr: (o) => { urls.push(String(o.url || "")); plan(o); } });
      let m = await c.api.pilotoMeta();
      t.igual(m, { name: "ARCHIVO.xlsx", mtime: "T-9" });
      t.cierto(urls[0].indexOf(SP_BASE + "/_api/web/GetFileById('" + GUID + "')?$select=Name,TimeLastModified") === 0, "URL de metadatos exacta");
      plan = (o) => o.onload({ status: 200, response: { d: { Name: "B.xlsx", TimeLastModified: "T2" } } });
      m = await c.api.pilotoMeta();
      t.igual(m, { name: "B.xlsx", mtime: "T2" }, "la envoltura d se desenvuelve");
    });

    await t.casoAsync("pilotoMeta: sin TimeLastModified o con la red caída devuelve null (nunca lanza)", async () => {
      let plan = (o) => o.onload({ status: 200, response: { Name: "SOLO_NOMBRE.xlsx" } });
      const c = cargar({ silencioso: true, gmxhr: (o) => plan(o) });
      t.igual(await c.api.pilotoMeta(), null, "sin TimeLastModified no hay frescura que comparar");
      plan = (o) => o.onerror();
      t.igual(await c.api.pilotoMeta(), null, "la falla de red se traga: el refresco reintenta después");
    });

    // ---------- primeShareAccess: la cookie del enlace compartido ----------
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

    await t.casoAsync("primeShareAccess: pasados los ~25 min la cookie se RENUEVA (reloj congelado, sin esperar el cuarto de hora)", async () => {
      const cont = { n: 0 };
      const c = cargar({ silencioso: true, gmxhr: (o) => { cont.n++; o.onload({ status: 200, responseText: "" }); } });
      const T0 = Date.parse("2026-09-07T14:00:00Z");
      congelar(c, T0);
      t.igual(await c.api.primeShareAccess(), true);
      t.igual(cont.n, 1);
      t.igual(await c.api.primeShareAccess(), true);
      t.igual(cont.n, 1, "aún dentro de la ventana de 25 min no toca la red");
      congelar(c, T0 + 25 * 60 * 1000 + 1000);             // la cookie de SharePoint ya expiró
      t.igual(await c.api.primeShareAccess(), true);
      t.igual(cont.n, 2, "vencida la ventana, vuelve a visitar el enlace");
    });

    await t.casoAsync("primeShareAccess: sin enlace configurado devuelve false sin tocar la red", async () => {
      const cont = { n: 0 };
      const c = cargar({ silencioso: true, gmxhr: () => { cont.n++; } });
      c.api.__CONFIG.SP.shareLink = "";
      t.igual(await c.api.primeShareAccess(true), false);
      t.igual(cont.n, 0);
    });

    // ---------- pilotoGuardar: empaqueta y persiste en el almacén GM ----------
    await t.casoAsync("pilotoGuardar: guarda el paquete v4 (Anexo 5) con id y fecha del día y sobrevive el viaje de ida y vuelta", async () => {
      const c = cargar({ silencioso: true });
      const mapa = new Map([["111", ["Tamización de VIH"]], ["222", ["Valoración integral de salud", "Tamización de VIH"]]]);
      await c.api.pilotoGuardar({ map: mapa, todos: new Set(["111", "222"]), abandono: new Set(["222"]) }, { name: "N.xlsx", mtime: "M1" });
      const crudo = c.env.gm["vgl_piloto"];
      t.cierto(typeof crudo === "string" && crudo.lastIndexOf('{"v":4', 0) === 0, "v18.6.1: el paquete debe empezar por el prefijo v4 (con campo a5 del Anexo 5)");
      const o = JSON.parse(crudo);
      t.igual(o.a5, "", "sin índice Anexo 5 el campo viaja vacío, no ausente");
      t.igual(o.id, GUID, "lleva el id de la base para invalidar la copia si cambia el GUID configurado");
      t.igual(o.date, c.api.todayStamp());
      t.igual(o.name, "N.xlsx");
      t.igual(o.mtime, "M1");
      const u = await c.api.unpackPym(crudo, null);
      t.igual(u.map.get("222"), ["Valoración integral de salud", "Tamización de VIH"]);
      t.igual(Array.from(u.abandono), ["222"]);
    });

    // ---------- pilotoDesdeCache: arranque instantáneo SIN red ----------
    await t.casoAsync("pilotoDesdeCache: sin caché o con prefijo que no es v3 devuelve false (y lo purga)", async () => {
      const c = cargar({ silencioso: true });
      t.igual(await c.api.pilotoDesdeCache(), false, "almacén vacío");
      c.env.gm["vgl_piloto"] = '{"x":1}';
      t.igual(await c.api.pilotoDesdeCache(), false, "paquete que no empieza por v3 se descarta sin interpretarlo");
      t.igual(c.env.gm["vgl_piloto"], "", "y se BORRA: no vuelve a pasar por él en cada arranque");
    });

    await t.casoAsync("pilotoDesdeCache: caché corrupta (empieza por v3 pero no es JSON) devuelve false sin tocar el estado", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = '{"v":3, ESTO NO ES JSON';
      t.igual(await c.api.pilotoDesdeCache(), false);
      t.igual(c.api.__state.pymFile, "");
      t.igual(c.api.__state.pym.size, 0);
      t.igual(c.api.__state.pymOrigen, "");
    });

    await t.casoAsync("pilotoDesdeCache: la purga de 30 días (A2) — una cola de hace meses se borra, no se desempaqueta", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = paqueteV3({ date: "2020-01-01" });
      t.igual(await c.api.pilotoDesdeCache(), false, "la fecha de la cola va al final: se mira ANTES de desempaquetar");
      t.igual(c.env.gm["vgl_piloto"], "", "12 MB de un mes pasado no viven un día más en el almacén");
    });

    await t.casoAsync("pilotoDesdeCache: si el id guardado no es el del GUID configurado, la migración purga sola", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = paqueteV3({ id: "00000000-0000-0000-0000-000000000000" });
      t.igual(await c.api.pilotoDesdeCache(), false);
      t.igual(c.api.__state.pymFile, "", "no debe cargar nada");
      t.igual(c.api.__state.pym.size, 0);
      t.igual(c.env.gm["vgl_piloto"], "", "la copia de la base vieja (p. ej. la de MAYO) se descarta al cambiar el GUID");
    });

    await t.casoAsync("pilotoDesdeCache: un índice inválido guardado (muchos documentos, cero pendientes) se purga", async () => {
      const c = cargar({ silencioso: true });
      // El guarda del libro equivocado (v18.0.7) vale también para lo que ya quedó
      // en el almacén: si alguna vez se coló un índice vacío, no se readmite.
      const docs = []; for (let i = 0; i < 60; i++) docs.push("9" + String(100000 + i));
      c.env.gm["vgl_piloto"] = paqueteV3({ p: "", t: docs.join(","), ab: "" });
      t.igual(await c.api.pilotoDesdeCache(), false);
      t.igual(c.env.gm["vgl_piloto"], "");
    });

    await t.casoAsync("pilotoDesdeCache: paquete v3 fresco se aplica AL INSTANTE con origen «base» y nombre exacto", async () => {
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
      t.igual(st.pymFP, "BASE PILOTO.xlsx|2026-08-01T10:00:00Z");
      // v18.6.0 — ya no hay «diario» al que esperarle: el nombre del archivo llega
      // EXACTO (afterPymLoaded de 1 arg), sin el sufijo «aún no llega la de hoy».
      t.igual(st.pymFile, "BASE PILOTO.xlsx");
      t.igual(st.pymOrigen, "base", "quedá marcado como base: «Abrir PyM» manual manda sobre ella");
      t.igual(st.pymCargadoDia, c.api.todayStamp(), "y sella el día de la carga (auditoría #9: detectar la base de ayer tras medianoche)");
      // Visibilidad: arrancar desde la copia guardada queda contado en el canal ux.
      c.api._uxVolcarBuffer(); // v15.6.0: uxTrack acumula en memoria y vuelca en tandas de 2 s
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(w.acciones["base.cache.ok"], 1);
      const filas = logBase(c);
      t.cierto(filas.some((f) => f.fase === "cache" && f.ok === true && f.pacientes === 2 && f.mtime === "2026-08-01T10:00:00Z"),
        "el anillo vgl_base_log deja fila de la caché aplicada");
    });

    await t.casoAsync("pilotoDesdeCache: si ya hay un PyM cargado no lo pisa (devuelve true y deja el estado como estaba)", async () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = paqueteV3();
      c.api.__state.pymFile = "MANUAL.xlsx";
      c.api.__state.pymOrigen = "manual";
      t.igual(await c.api.pilotoDesdeCache(), true);
      t.igual(c.api.__state.pymFile, "MANUAL.xlsx");
      t.igual(c.api.__state.pymOrigen, "manual");
      t.igual(c.api.__state.pym.size, 0, "el mapa del manual (vacío en esta simulación) no se reemplaza");
    });

    // ---------- loadPymBase: la puerta de entrada ----------
    await t.casoAsync("loadPymBase: con la base automática apagada devuelve false sin tocar la red", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c.api.__S.baseAuto = false;
      t.igual(await c.api.loadPymBase(true), false);
      t.igual(cont.total, 0);
    });

    await t.casoAsync("loadPymBase: sin id configurado o sin permiso GM_xmlhttpRequest devuelve false; con algo ya cargado, true", async () => {
      const c1 = cargar({ silencioso: true, gmxhr: gmxhrBase(contadorBase()) });
      c1.api.__CONFIG.SP.base = { id: "" };
      t.igual(await c1.api.loadPymBase(true), false, "sin GUID no hay nada que descargar");
      const cont2 = contadorBase();
      const c2 = cargar({ silencioso: true, gmxhr: gmxhrBase(cont2) });
      delete c2.env.win.GM_xmlhttpRequest;
      t.igual(await c2.api.loadPymBase(true), false, "sin el permiso de cross-origin la descarga es imposible");
      t.igual(cont2.total, 0);
      const cont3 = contadorBase();
      const c3 = cargar({ silencioso: true, gmxhr: gmxhrBase(cont3) });
      c3.api.__state.pymFile = "YA_CARGADO.xlsx";
      t.igual(await c3.api.loadPymBase(true), true, "ya hay algo cargado (caché o manual): no se repite el trabajo");
      t.igual(cont3.total, 0);
    });

    await t.casoAsync("loadPymBase: con copia guardada arranca desde la caché (cero descargas) y dispara la revisión de frescura aparte", async () => {
      const cont = contadorBase();
      cont.metaMtime = "2026-08-01T10:00:00Z";            // el mismo mtime del paquete: sin cambios
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelar(c, T_605);                                  // 06:05 Bogotá: la ventana de la mañana está abierta
      c.env.gm["vgl_piloto"] = paqueteV3();
      t.igual(await c.api.loadPymBase(true), true);
      t.igual(c.api.__state.pymOrigen, "base");
      t.igual(c.api.__state.pymFile, "BASE PILOTO.xlsx");
      t.igual(cont.descargas, 0, "la copia guardada evita la descarga de ~22,5 MB en el arranque");
      await esperar(() => cont.meta >= 1, 2000, "la revisión de frescura en segundo plano");
      t.igual(cont.descargas, 0, "sin cambios en el servidor: sigue la copia");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-07|0", "la ventana de la mañana quedó sellada por fuera, sin bloquear el arranque");
    });

    await t.casoAsync("loadPymBase: sin caché consulta metadatos primero y baja el libro completo", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      t.igual(await c.api.loadPymBase(true), true);
      const st = c.api.__state;
      t.igual(cont.meta, 1, "metadatos primero: para guardar la copia con el mtime verdadero");
      t.igual(cont.descargas, 1);
      t.igual(st.pymOrigen, "base");
      t.igual(st.pymFile, "BASE UNICA SEDE BELLO.xlsx", "el nombre REAL del servidor manda sobre el configurado (H9: el doble espacio)");
      t.igual(st.pym.get("5150076"), ["VIH"]);
      const copia = JSON.parse(c.env.gm["vgl_piloto"]);
      t.igual(copia.mtime, "T-DESC");
      t.igual(copia.id, GUID);
    });

    // ---------- loadPymBaseDescarga: las dos pasadas, el rollback y el aviso ----------
    await t.casoAsync("loadPymBaseDescarga: éxito aplica (hoja fijada sobre el señuelo, PROCEXDT fundida), guarda y avisa en AZUL", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      const vistos = cazarToasts(c);
      const meta = { name: "BASE UNICA SEDE BELLO.xlsx", mtime: "T-DESC" };
      t.igual(await c.api.loadPymBaseDescarga(true, meta), true);
      const st = c.api.__state;
      t.igual(st.pymOrigen, "base");
      t.igual(st.pymHoja, "citas dia regional", "la hoja fijada le gana al señuelo de puntaje (H1: CITASDIA AGOSTO tenía 400 puntos)");
      t.igual(st.pym.get("5150076"), ["VIH"]);
      t.igual(st.pym.get("300123"), ["Mamografía"], "la hoja PROCEXDT de tamizaciones se funde en el índice");
      t.cierto(st.pymAbandono.has("99887766"));
      t.igual(st.pymMTime, "T-DESC");
      t.igual(st.pymFP, "BASE UNICA SEDE BELLO.xlsx|T-DESC");
      t.igual(cont.descargas, 1, "una sola ruta: la primera que responde corta el circuito");
      t.igual(cont.meta, 0, "llamada directa con meta: no se vuelve a consultar");
      const copia = JSON.parse(c.env.gm["vgl_piloto"]);
      t.igual(copia.id, GUID);
      t.igual(copia.mtime, "T-DESC", "la copia persistente queda guardada DESPUÉS de aplicar (v18.6.0)");
      t.igual(copia.name, "BASE UNICA SEDE BELLO.xlsx");
      await esperar(() => vistos.length >= 1, 2000, "el aviso AZUL de base cargada");
      // OJO: afterPymLoaded -> tick() puede pintar antes su propio aviso de estado
      // (p. ej. «sin lectura de la agenda», ajeno a esta descarga), así que se
      // busca POR TÍTULO el aviso de la base, no por posición en la bandeja.
      t.cierto(vistos.some((v) => v.color === "AZUL" && v.titulo.indexOf("Base de prevención cargada") >= 0),
        "toasts: " + JSON.stringify(vistos));
      // Métricas del canal ux (las alertas de flota vigilan la duración y el tamaño).
      c.api._uxVolcarBuffer();
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(w.acciones["base.descarga.ok"], 1);
      const filas = logBase(c);
      t.cierto(filas.some((f) => f.fase === "descarga" && f.ok === true && f.mtime === "T-DESC"), "fila de descarga");
      t.cierto(filas.some((f) => f.fase === "indice" && f.ok === true && f.pacientes === 2 && f.todos === 3), "fila de índice");
    });

    await t.casoAsync("loadPymBaseDescarga: con viaRefresh=true NO dispara el aviso de basecarga (el refresco tiene el suyo)", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      const vistos = cazarToasts(c);
      t.cierto(await c.api.loadPymBaseDescarga(true, { name: "X.xlsx", mtime: "T1" }, true));
      await dormir(60);                                     // la cola del toast corre en ~1 ms en el sandbox
      // tick() puede poner avisos propios (ajenos a la descarga): lo que NO puede
      // existir es el de «Base de prevención cargada», que es del refresco.
      t.falso(vistos.some((v) => v.titulo.indexOf("Base de prevención cargada") >= 0),
        "dos avisos para una misma descarga es la sobrecarga de siempre: " + JSON.stringify(vistos));
      t.igual(c.api.__state.pymOrigen, "base");
    });

    await t.casoAsync("loadPymBaseDescarga: si TODAS las rutas fallan en las DOS pasadas -> false, fila de fallo y ROLLBACK de la caché", async () => {
      const cont = contadorBase();
      const plan = { descarga: "fallo" };
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont, plan) });
      const antes = paqueteV3({ mtime: "T-VIEJA" });
      c.env.gm["vgl_piloto"] = antes;                       // la última copia buena, del arranque
      t.falso(await c.api.loadPymBaseDescarga(true, null));
      t.igual(cont.descargas, 4, "2 rutas × 2 pasadas (la segunda con renovación forzada de cookie), en serie");
      t.igual(cont.prime, 2, "una renovación del enlace por pasada");
      t.igual(c.env.gm["vgl_piloto"], antes, "ROLLBACK: la copia vieja sigue INTACTA en el almacén");
      t.igual(c.api.__state.pymFile, "", "no queda nada a medias");
      t.cierto(/no se pudo conectar con la carpeta compartida/.test(c.api.__state.pymUltimoFallo),
        "el motivo del fallo queda anotado donde el médico lo ve: " + c.api.__state.pymUltimoFallo);
      t.cierto(logBase(c).some((f) => f.fase === "descarga" && f.ok === false), "fila de descarga fallida en el anillo");
    });

    await t.casoAsync("loadPymBaseDescarga: HTML de login con estado 200 -> «pidió iniciar sesión», no un error genérico", async () => {
      const cont = contadorBase();
      const plan = { descargaHtml: true };
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont, plan) });
      const antes = paqueteV3();
      c.env.gm["vgl_piloto"] = antes;
      t.falso(await c.api.loadPymBaseDescarga(true, null));
      // SharePoint devuelve su página de inicio de sesión con 200: esLibroValido
      // (no empieza por PK) es la careta que cae. El diagnóstico tiene que decir
      // la verdad de la sesión, no un «no es un Excel» que no ayuda a nadie.
      t.cierto(/pidió iniciar sesión/.test(c.api.__state.pymUltimoFallo), "razón: " + c.api.__state.pymUltimoFallo);
      t.igual(c.env.gm["vgl_piloto"], antes, "la caché buena tampoco se toca aquí");
    });

    await t.casoAsync("loadPymBaseDescarga: hoja fijada AUSENTE -> readPym lanza, aviso ÁMBAR, caché intacta (rollback automático)", async () => {
      const cont = contadorBase();
      cont.libro = libroSinHojaFijada();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      const vistos = cazarToasts(c);
      c.api.__state.leader = true;                          // el aviso ÁMBAR de lectura es cosa de la pestaña líder
      const antes = paqueteV3();
      c.env.gm["vgl_piloto"] = antes;
      t.falso(await c.api.loadPymBaseDescarga(true, { name: "BASE.xlsx", mtime: "T9" }));
      t.cierto(/no encontré la hoja/.test(c.api.__state.pymUltimoFallo), "dice QUÉ hoja faltó: " + c.api.__state.pymUltimoFallo);
      t.igual(c.env.gm["vgl_piloto"], antes, "el índice nuevo no se aplica NI se guarda: manda la última copia VALIDADA");
      t.igual(c.api.__state.pymFile, "", "el estado tampoco se toca");
      await esperar(() => vistos.length >= 1, 2000, "el aviso ÁMBAR de lectura fallida");
      const malo = vistos.find((v) => v.titulo.indexOf("no se pudo leer") >= 0) || vistos[0];
      t.igual(malo.color, "AMBAR");
      t.cierto(malo.cuerpo.indexOf("citas dia regional") >= 0, "el cuerpo nombra la hoja que no encontró");
      t.cierto(logBase(c).some((f) => f.fase === "indice" && f.ok === false), "fila de índice fallido en el anillo");
    });

    await t.casoAsync("loadPymBaseDescarga: índice con 0 pacientes -> false y NO guarda (guardián H8)", async () => {
      const cont = contadorBase();
      cont.libro = libroHojaFijadaVacia();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      t.falso(await c.api.loadPymBaseDescarga(true, { name: "VACIA.xlsx", mtime: "T0" }));
      t.cierto(/no produjo ningún paciente/.test(c.api.__state.pymUltimoFallo), "motivo: " + c.api.__state.pymUltimoFallo);
      t.falso(!!c.env.gm["vgl_piloto"], "un índice vacío jamás llega al almacén: se cachearía el silencio para todo el día siguiente");
      t.igual(c.api.__state.pymFile, "");
    });

    await t.casoAsync("loadPymBaseDescarga: libro con ≥50 documentos y CERO actividades (mtr) -> rechazado por applyPymIdx y NADA queda cacheado", async () => {
      // El OTRO guardián (mutación M4 de v18.6.0): el caso «0 pacientes» muere en el
      // lector; este muere en applyPymIdx (mtrLibroNoParecePym: 60 documentos, ninguna
      // «Susceptible» ni «Aplica»). Si alguien vuelve a guardar ANTES de aplicar, el
      // paquete malo queda en el almacén y TODA recarga siguiente lo readmite.
      const filasMudo = [fila(1, [celda("A1", "IDENTIFICACION"), celda("B1", "VALORACION_INTEGRAL")])];
      for (let i = 2; i <= 61; i++) filasMudo.push(fila(i, [celda("A" + i, "7" + String(100000 + i)), celda("B" + i, "Realizada")]));
      const cont = contadorBase();
      cont.libro = crearZipPrueba({
        "xl/workbook.xml": '<workbook><sheets><sheet name="citas dia regional" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": hoja(filasMudo),
      });
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      t.falso(await c.api.loadPymBaseDescarga(true, { name: "MUDO.xlsx", mtime: "T0" }), "el lector lo acepta (60 documentos), pero applyPymIdx lo rechaza");
      t.cierto(/no es la lista de prevención/.test(c.api.__state.pymUltimoFallo || ""), "motivo del mtr: " + c.api.__state.pymUltimoFallo);
      t.falso(!!c.env.gm["vgl_piloto"], "el paquete rechazado NO llega al almacén — el rollback es total, también contra el mtr");
      t.igual(c.api.__state.pymFile, "", "y nada se aplicó en pantalla");
    });

    await t.casoAsync("loadPymBaseDescarga: con un PyM MANUAL ya cargado renueva la caché pero NO pisa la pantalla del médico", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c.api.__state.pymFile = "MANUAL.xlsx";
      c.api.__state.pymOrigen = "manual";
      c.api.__state.pym = new Map([["9999999", ["Tamización cardiometabólica"]]]);
      c.api.__state.pymMTime = "T-MANUAL";
      t.cierto(await c.api.loadPymBaseDescarga(true, { name: "NUEVA.xlsx", mtime: "T-NUEVA" }));
      // «Abrir PyM» manda SIEMPRE (regla del proyecto): lo que el médico cargó
      // no se reemplaza por un refresco de fondo…
      t.igual(c.api.__state.pymFile, "MANUAL.xlsx");
      t.igual(c.api.__state.pymOrigen, "manual");
      t.igual(c.api.__state.pym.size, 1);
      t.cierto(c.api.__state.pym.has("9999999"), "el paciente del libro manual no se pierde");
      t.igual(c.api.__state.pymMTime, "T-MANUAL");
      // …pero la copia persistente SÍ se renueva, para que el próximo arranque
      // empiece con la versión nueva de la base.
      const copia = JSON.parse(c.env.gm["vgl_piloto"]);
      t.igual(copia.mtime, "T-NUEVA");
      t.igual(copia.name, "NUEVA.xlsx");
      t.cierto(logBase(c).some((f) => f.fase === "indice" && f.ok === true && f.aplicado === false), "la fila dice que no se aplicó");
    });

    // ---------- pilotoFreshCheck: las ventanas de las 06:00 y las 12:00 de Bogotá ----------
    await t.casoAsync("pilotoFreshCheck: antes de las 06:00 no hace NADA — ni metadatos", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelar(c, T_PRE6);                                  // 05:30 Bogotá
      const v = c.api.baseVentanaRefresco();
      t.falso(v.toca);
      t.igual(v.sello, "2026-09-07|pre", "la ventana de la mañana aún no abre");
      await c.api.pilotoFreshCheck();
      t.igual(cont.total, 0, "cero gmxhr: no se despierta a SharePoint de madrugada");
      t.igual(c.env.gm["vgl_piloto_chk"], undefined);
    });

    await t.casoAsync("pilotoFreshCheck: a las 06:05 consulta la meta UNA vez, sella la ventana y con mtime igual no descarga", async () => {
      const cont = contadorBase();
      cont.metaMtime = "T1";
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelar(c, T_605);
      c.api.__state.pymMTime = "T1";                        // la copia local está al día
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 1, "una consulta de metadatos de ~1 KB");
      t.igual(cont.descargas, 0, "mtime igual: se queda con la copia guardada");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-07|0", "sello con el ÍNDICE de la hora (0=mañana)");
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 1, "misma ventana: no vuelve a consultar");
      t.cierto(logBase(c).some((f) => f.fase === "meta" && f.ok === true && f.mtime === "T1"), "fila de meta en el anillo");
    });

    await t.casoAsync("pilotoFreshCheck: si el archivo cambió en el servidor, baja la versión nueva y avisa «baseupd»", async () => {
      const cont = contadorBase();
      cont.metaMtime = "T2";
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      const vistos = cazarToasts(c);
      congelar(c, T_605);
      c.api.__state.pymMTime = "T1";                        // la copia local es más vieja
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 1);
      t.igual(cont.descargas, 1, "mtime distinto: sí se paga la descarga de ~22,5 MB");
      t.igual(c.api.__state.pymMTime, "T2");
      t.igual(c.api.__state.pymOrigen, "base");
      const copia = JSON.parse(c.env.gm["vgl_piloto"]);
      t.igual(copia.mtime, "T2", "la copia persistente queda renovada");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-07|0");
      await esperar(() => vistos.length >= 1, 2000, "el aviso AZUL de base actualizada");
      t.cierto(vistos.some((v) => v.color === "AZUL" && v.titulo.indexOf("Base de prevención actualizada") >= 0),
        "toasts: " + JSON.stringify(vistos));
    });

    await t.casoAsync("pilotoFreshCheck: si la meta FALLA no sella la ventana — el reintento vuelve a pedir", async () => {
      const cont = contadorBase();
      const plan = { meta: "fallo" };
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont, plan) });
      congelar(c, T_605);
      c.api.__state.pymMTime = cont.metaMtime;
      await c.api.pilotoFreshCheck();
      t.igual(c.env.gm["vgl_piloto_chk"], undefined, "sin respuesta de SharePoint la ventana NO queda revisada");
      t.cierto(logBase(c).some((f) => f.fase === "meta" && f.ok === false), "el fallo queda en el anillo");
      // v18.6.0 (revisión adversarial): tras un meta nulo se RENUEVA el enlace compartido
      // y se reintenta UNA vez dentro de la misma vuelta — en los equipos que viven de la
      // cookie anónima (~25 min) es lo que separa "reintenta al minuto" de "nunca más".
      t.igual(cont.meta, 2, "meta fallido + reintento tras renovar el enlace, en la misma vuelta");
      plan.meta = null;                                     // la red volvió
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 3, "el reintento en la vuelta siguiente del minutero vuelve a consultar");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-07|0");
      t.igual(cont.descargas, 0, "con el mtime igual no hay descarga");
    });

    await t.casoAsync("pilotoFreshCheck: a las 12:05 abre la ventana de la tarde -> segunda revisión del día", async () => {
      const cont = contadorBase();
      cont.metaMtime = "T1";
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c.api.__state.pymMTime = "T1";
      congelar(c, T_605);
      await c.api.pilotoFreshCheck();                       // mañana: sella |0
      congelar(c, T_1205);                                  // 12:05 Bogotá
      const v = c.api.baseVentanaRefresco();
      t.cierto(v.toca);
      t.igual(v.sello, "2026-09-07|1", "el índice 1 es la ventana de la tarde");
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 2, "la tarde es una revisión NUEVA, no la de la mañana reutilizada");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-07|1");
      t.igual(cont.descargas, 0, "sin cambios no hay descarga a mediodía");
    });

    // ---------- schedulePymBase: la escalera de arranque ----------
    await t.casoAsync("schedulePymBase: con PyM ya cargado no programa nada", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c.api.__state.pymFile = "YA.xlsx";
      c.api.schedulePymBase();
      await dormir(50);                                     // los timers del sandbox corren en ~1 ms
      t.igual(cont.total, 0);
    });

    await t.casoAsync("schedulePymBase: con la red caída sube la escalera completa (3 intentos, 2s/45s/180s) y se DETIENE", async () => {
      const cont = contadorBase();
      const plan = { meta: "fallo", descarga: "fallo" };
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont, plan) });
      c.api.schedulePymBase();
      await esperar(() => cont.meta >= 3, 4000, "los tres intentos de la escalera");
      await dormir(80);                                     // margen para que un 4.º hipotético despeinte
      t.igual(cont.meta, 3, "exactamente 3 intentos: la escalera no es un bucle infinito sobre la red de la IPS");
      t.igual(cont.descargas, 12, "4 intentos de descarga por llamada (2 rutas × 2 pasadas) × 3");
      // La 1.ª pasada de cada intento REUSA la cookie de los ~25 min (solo el
      // primer intento la pide de verdad); la renovación FORZADA de la 2.ª pasada
      // sí va a la red las tres veces: 1 + 3 = 4 visitas al enlace de compartir.
      t.igual(cont.prime, 4, "la renovación forzada de la segunda pasada, más la primera de todas");
      t.igual(c.api.__state.pymFile, "");
    });

    // ---------- spToast / dismissSpToast (siguen vivos: los usa el HUD de laboratorios) ----------
    await t.casoAsync("spToast: crea el aviso una vez, lo reutiliza, y dismissSpToast lo desvanece", async () => {
      const c = cargar({ silencioso: true });
      c.api.spToast("primer aviso", 0);                     // 0 = fijo, sin autodescartarse
      const nodo = c.env.doc._nodos.find((n) => n.id === "vgl-sp");
      t.cierto(!!nodo, "el toast debe existir en el DOM");
      t.cierto(c.env.doc.body.children.indexOf(nodo) >= 0, "colgado del body");
      t.cierto(nodo.classList && nodo.classList.contains("vgl-sp-visible"), "debe ser visible");
      t.cierto(String(nodo.children[0].textContent).indexOf("🛡️ Centinela PyM · primer aviso") === 0);
      // A partir de aquí el documento SÍ encuentra el toast (como en la página real).
      c.env.doc.getElementById = (id) => (id === "vgl-sp" ? nodo : null);
      c.api.spToast("segundo aviso", 0);
      t.igual(c.env.doc._nodos.filter((n) => n.id === "vgl-sp").length, 1, "reutiliza el nodo, no apila toasts");
      t.cierto(String(nodo.children[0].textContent).indexOf("segundo aviso") >= 0, "el texto se actualiza en el mismo aviso");
      c.api.dismissSpToast();
      t.falso(nodo.classList && nodo.classList.contains("vgl-sp-visible"), "debe estar oculto");
    });

    // v18.0.75 — HALLAZGO DE ENJAMBRE #28. dismissSpToast programaba el remove() físico del
    // nodo en un setTimeout de 260 ms sin guardar su id: si un aviso NUEVO llegaba dentro
    // de esa ventana, spToast() reutilizaba el mismo nodo #vgl-sp y lo mostraba de nuevo,
    // pero el remove() diferido de la llamada ANTERIOR seguía en pie y lo borraba igual —
    // el aviso recién mostrado desaparecía del DOM sin ningún indicio de por qué.
    await t.casoAsync("REGRESIÓN — un aviso nuevo dentro de la ventana de dismiss no lo borra el remove() diferido del anterior (hallazgo #28)", async () => {
      const c = cargar({ silencioso: true });
      c.api.spToast("progreso", 0);
      const nodo = c.env.doc._nodos.find((n) => n.id === "vgl-sp");
      c.env.doc.getElementById = (id) => (id === "vgl-sp" ? nodo : null);
      // Se descarta el primero (programa el remove() diferido de 260 ms, capado a ~1 ms en
      // el sandbox) y, ANTES de que ese remove() llegue a correr, llega el aviso final.
      c.api.dismissSpToast();
      c.api.spToast("resultado final", 0);
      t.cierto(nodo.classList && nodo.classList.contains("vgl-sp-visible"), "el aviso final queda visible de inmediato");
      // Se deja correr el bucle de eventos lo suficiente para que el remove() diferido del
      // PRIMER dismiss, si sigue vivo, ya se haya disparado.
      await dormir(30);
      t.cierto(!!nodo._parent, "el nodo del aviso final sigue colgado del body: el remove() de la llamada anterior no debe alcanzarlo");
      t.cierto(String(nodo.children[0].textContent).indexOf("resultado final") >= 0, "y sigue mostrando el mensaje correcto");
    });

    await t.casoAsync("spToast: con duración se autodescarta solo; dismissSpToast sin toast no lanza", async () => {
      const c = cargar({ silencioso: true });
      c.api.spToast("fugaz", 6000);                         // el sandbox recorta el timer a ~1 ms
      const nodo = c.env.doc._nodos.find((n) => n.id === "vgl-sp");
      c.env.doc.getElementById = (id) => (id === "vgl-sp" ? nodo : null);
      await esperar(() => !nodo.classList || !nodo.classList.contains("vgl-sp-visible"), 2000, "el autodescarte del toast");
      const c2 = cargar({ silencioso: true });
      t.noLanza(() => c2.api.dismissSpToast(), "sin toast en pantalla debe ser inofensivo");
    });

    // ---------- loadPymFile: carga manual con «Abrir PyM» ----------
    await t.casoAsync("loadPymFile: un CSV elegido a mano queda marcado origen «manual» y se aplica", async () => {
      const c = cargar({ silencioso: true });
      // FileReader no existe en el sandbox: doble de pruebas mínimo que entrega el texto.
      c.ctx.FileReader = function () {
        const yo = this;
        this.readAsText = () => { setTimeout(() => { if (yo.onload) yo.onload({ target: { result: CSV_PILOTO } }); }, 0); };
        this.readAsArrayBuffer = () => {};
      };
      c.api.loadPymFile({ name: "PYM_MANUAL.csv" });
      await esperar(() => c.api.__state.pymFile === "PYM_MANUAL.csv", 3000, "la carga manual del CSV");
      // v18.6.0 — ya no compite con ningún archivo diario: lo que el médico elige se
      // aplica y queda «manual», para que ningún refresco de las 06:00/12:00 lo pise.
      t.igual(c.api.__state.pymOrigen, "manual", "«Abrir PyM» manda: la base automática no lo reemplaza");
      t.igual(c.api.__state.pym.get("5150076"), ["VIH"]);
      t.cierto(c.api.__state.pymAbandono.has("99887766"));
      t.igual(c.api.__state.pymFP, "PYM_MANUAL.csv|", "huella con el nombre crudo y sin mtime (archivo local)");
    });
  },
};
