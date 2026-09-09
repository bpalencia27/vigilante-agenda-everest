// =====================================================================
//  SUITE 92 — STAGING de la BASE ÚNICA (v18.6.0)
//  Cubre el ciclo de vida completo del nuevo subsistema de la base de
//  prevención por GUID (mandato del médico, 07-sep): arranque desde
//  almacén limpio, purga de las claves legacy del extinto archivo
//  diario, rollback automático ante descargas y lecturas rotas,
//  recuperación cuando la red vuelve, ventanas de refresco 06:00/12:00
//  de Bogotá (UTC-5 fijo), anillo de log de mantenimiento (60 filas) y
//  el cruce de medianoche con sellos de días distintos.
//
//  Esta suite es de STAGING: reproduce las FALLAS que el médico pidió
//  que se validaran antes de dar por buena la migración (red caída en
//  el arranque, hoja renombrada en el libro de la sede, pestaña que
//  cruza el día). La red se simula con gmxhr falso (patrones de la
//  suite 12) y el libro sintético es un ZIP real método 0 (patrón de
//  las suites 07/16), con hoja fijada «citas dia regional» + «PROCEXDT»
//  y una hoja histórica «CITASDIA AGOSTO» más poblada, para dejar
//  probado POR QUÉ la hoja se fija (auditoría H1: el puntaje elegía la
//  del mes pasado y quedaba en 0 pacientes).
//
//  Identificadores 100 % sintéticos (5150076, 99887766, 300123,
//  4455667, 8000xx): cero PHI, regla del proyecto.
// =====================================================================

const GUID_BASE = "6594b356-f608-4c56-bb6f-6a90f2125a3f";
const SP_BASE_URL = "https://viva1aips-my.sharepoint.com/personal/director_bello_viva1a_com_co";
// El nombre REAL del libro lleva DOBLE espacio antes de BELLO (hallazgo H9 de la
// auditoría: es fácil errarle a mano, por eso el nombre siempre se toma del servidor).
const NOMBRE_BASE = "BASE PILOTO DE CONSULTA  BELLO SEPTIEMBRE1.xlsx";

// ---------- ZIP "stored" (método 0) construido a mano ----------
// Mismo formato que usan las suites 07 y 16 (sin comprimir, suficiente
// para zipIndex/zipRead del userscript: ni inflate ni DecompressionStream).
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
    dv.setUint32(pos, 0, true); pos += 4;            // CRC (no se valida en lectura)
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

// ---------- libro sintético de la sede ----------
// Tres hojas, como el libro real de 12: la histórica de agosto (MÁS filas que la
// buena: sin hoja fijada, el puntaje la elige — eso era exactamente el hallazgo H1),
// la fijada «CITAS DIA  REGIONAL» (doble espacio, mayúsculas y acentos distintos
// del config, para ejercitar la normalización) y la de tamizaciones «PROCEXDT».
const CADENAS_SST = [
  "NRO_IDENTIFICACION", "TAMIZACION_VIH", "ABANDONADOS_PES", "TAMIZACION_CMB", // 0-3
  "Susceptible", "Pendiente", "No", "Si", "Al dia",                            // 4-8
  "DOCUMENTO",                                                                 // 9
  "IDENTIFICACION", "CERVIX", "MAMA", "PSA", "SOMF",                           // 10-14
  "Aplica Cobertura y Fenix", "Aplica Tamizacion Mama", "Con Tamizacion vigente", // 15-17
];
const SST = {};
CADENAS_SST.forEach((s, i) => { SST[s] = i; });
function cs(ref, clave) { return '<c r="' + ref + '" t="s"><v>' + SST[clave] + "</v></c>"; }
function cn(ref, v) { return '<c r="' + ref + '"><v>' + v + "</v></c>"; }

function hojaAgosto() {
  let filas = '<row r="1">' + cs("A1", "DOCUMENTO") + cs("B1", "TAMIZACION_VIH") + "</row>";
  for (let i = 1; i <= 8; i++) {
    filas += '<row r="' + (i + 1) + '">' + cn("A" + (i + 1), "80000" + i) + cs("B" + (i + 1), "Susceptible") + "</row>";
  }
  return "<worksheet><sheetData>" + filas + "</sheetData></worksheet>";
}
function hojaRegional() {
  return "<worksheet><sheetData>"
    + '<row r="1">' + cs("A1", "NRO_IDENTIFICACION") + cs("B1", "TAMIZACION_VIH") + cs("C1", "ABANDONADOS_PES") + cs("D1", "TAMIZACION_CMB") + "</row>"
    + '<row r="2">' + cn("A2", "5150076") + cs("B2", "Susceptible") + cs("C2", "No") + cs("D2", "Pendiente") + "</row>"
    + '<row r="3">' + cn("A3", "99887766") + cs("C3", "Si") + "</row>"
    + '<row r="4">' + cn("A4", "300123") + cs("B4", "Al dia") + cs("C4", "No") + "</row>"
    + "</sheetData></worksheet>";
}
function hojaProcex() {
  return "<worksheet><sheetData>"
    + '<row r="1">' + cs("A1", "IDENTIFICACION") + cs("B1", "CERVIX") + cs("C1", "MAMA") + cs("D1", "PSA") + cs("E1", "SOMF") + "</row>"
    + '<row r="2">' + cn("A2", "5150076") + cs("B2", "Aplica Cobertura y Fenix") + "</row>"
    + '<row r="3">' + cn("A3", "4455667") + cs("C3", "Aplica Tamizacion Mama") + cs("E3", "Con Tamizacion vigente") + "</row>"
    + "</sheetData></worksheet>";
}
const XML_SST = "<sst>" + CADENAS_SST.map((s) => "<si><t>" + s + "</t></si>").join("") + "</sst>";

// Libro BUENO: la hoja fijada existe (con nombre escrito distinto a como está
// configurado: «CITAS DIA  REGIONAL» vs «citas dia regional»).
function libroBase() {
  return crearZipPrueba({
    "xl/workbook.xml": '<workbook><sheets><sheet name="CITASDIA AGOSTO" sheetId="1" r:id="rId1"/><sheet name="CITAS DIA  REGIONAL" sheetId="2" r:id="rId2"/><sheet name="PROCEXDT" sheetId="3" r:id="rId3"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    "xl/sharedStrings.xml": XML_SST,
    "xl/worksheets/sheet1.xml": hojaAgosto(),
    "xl/worksheets/sheet2.xml": hojaRegional(),
    "xl/worksheets/sheet3.xml": hojaProcex(),
  });
}
// Libro ROTO para INTEGRIDAD: la hoja fue RENOMBRADA («REGIONAL CITAS DIA», el
// patrón ya no calza ni exacto ni por substring) — la descarga funciona pero el
// lector debe negarse a instalar nada.
function libroHojaRenombrada() {
  return crearZipPrueba({
    "xl/workbook.xml": '<workbook><sheets><sheet name="REGIONAL CITAS DIA" sheetId="1" r:id="rId1"/><sheet name="PROCEXDT" sheetId="2" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    "xl/sharedStrings.xml": XML_SST,
    "xl/worksheets/sheet1.xml": hojaRegional(),
    "xl/worksheets/sheet2.xml": hojaProcex(),
  });
}

// CSV sintético para la carga manual («Abrir PyM») — el mismo formato de la suite 12.
const CSV_PILOTO = "CEDULA,TAMIZACION_VIH,ABANDONADOS_PES\n5150076,Susceptible,No\n99887766,,Si\n";
function bufCSV() { return new TextEncoder().encode(CSV_PILOTO).buffer; }

// ---------- red simulada ----------
// El gmxhr falso atiende los TRES tipos de llamada del subsistema: metadatos
// ($select=Name,TimeLastModified), descarga (/$value o download.aspx) y el
// «prime» del enlace compartido de la carpeta (cualquier otra URL).
function contadorBase(name, mtime) {
  return {
    total: 0, meta: 0, descargasOk: 0, descargasErr: 0, primes: 0, ajenas: 0, urls: [], timeoutDescarga: 0,
    metaName: name || NOMBRE_BASE, metaMtime: mtime || "T1",
    planMeta: true, planDescarga: true, bufFn: null,
  };
}
function gmxhrBase(cont) {
  return (o) => {
    const url = String(o.url || "");
    // El userscript también usa GM_xmlhttpRequest para la sonda de agenda de Everest
    // (atheneasoluciones.com): eso NO es tráfico de la base y no debe contarse aquí.
    if (url.indexOf("sharepoint.com") < 0) { cont.ajenas++; o.onload({ status: 200, responseText: "" }); return; }
    cont.total++;
    cont.urls.push(url);
    if (url.indexOf("$select=Name,TimeLastModified") >= 0) {
      cont.meta++;
      if (!cont.planMeta) { o.onerror(); return; }
      o.onload({ status: 200, response: { Name: cont.metaName, TimeLastModified: cont.metaMtime } });
      return;
    }
    if (url.indexOf("/$value") >= 0 || url.indexOf("download.aspx") >= 0) {
      if (cont.planDescarga) {
        cont.descargasOk++; cont.timeoutDescarga = o.timeout;
        o.onload({ status: 200, response: (cont.bufFn || libroBase)() });
      } else { cont.descargasErr++; o.onerror(); }
      return;
    }
    cont.primes++;
    o.onload({ status: 200, responseText: "" });
  };
}

// ---------- reloj congelado en hora BOGOTÁ ----------
// bogotaAhora() lee getUTC* sobre (Date.now() - 5 h): fijando el instante UTC
// exacto (hora Bogotá + 5 h) la prueba no depende del huso del equipo que corre
// el banco, que es justo lo que la función promete para el médico.
function congelarBogota(c, dia, hora) {   // dia "2026-09-08", hora "06:10"
  const t = new Date(dia + "T" + hora + ":00Z").getTime() + 5 * 60 * 60 * 1000;
  const F = class extends Date {
    static now() { return t; }
    constructor(...args) { if (args.length === 0) super(t); else super(...args); }
  };
  c.env.win.Date = F;
  c.ctx.Date = F;
  return t;
}

// Espera activa con reloj REAL del host (los setTimeout del sandbox van a 1 ms).
function dormir(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function esperar(cond, ms, nota) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > (ms || 3000)) throw new Error("tiempo agotado esperando: " + (nota || "condición"));
    await dormir(5);
  }
}

// Siembra una caché vgl_piloto VÁLIDA armada con el packPym REAL (así el fixture
// viaja por el mismo formato que producción, no por un JSON escrito a mano).
async function sembrarCache(c, extra) {
  const map = new Map([["5150076", ["VIH", "Valoración integral de salud"]], ["300123", ["VIH"]]]);
  const todos = new Set(["5150076", "300123", "777"]);
  const abandono = new Set(["777"]);
  const meta = Object.assign({
    date: c.api.todayStamp(), name: NOMBRE_BASE, mtime: "T-VIEJA",
    fp: NOMBRE_BASE + "|T-VIEJA", id: c.api.pilotoId(),
  }, extra || {});
  const txt = await c.api.packPym(map, todos, abandono, meta, null);
  c.env.gm["vgl_piloto"] = txt;
  return txt;
}
function leerLog(c) {
  try { return JSON.parse(c.env.gm["vgl_base_log"] || "[]"); } catch (e) { return null; }
}
function vistos(c) {
  try { return JSON.parse(c.env.almacen["vgl_vistos"] || "{}") || {}; } catch (e) { return {}; }
}

module.exports = {
  nombre: "Staging de la base única v18.6.0 (Suite 92)",
  cubre: [
    "pilotoId", "baseSheetOpts", "bogotaAhora", "baseVentanaRefresco", "baseLog",
    "_vglPurgarCacheDiariaLegacy", "spBase", "spFallbackUrls", "gmGet", "gmJson",
    "primeShareAccess", "esLibroValido", "esXlsxCifrado", "mtrLibroNoParecePym",
    "findDocIdx", "esAplicaPendiente", "makeProcexIndexer",
    "_readPymWorkbookStreamCore", "readPymWorkbookStream", "readPym", "progreso",
    "afterPymLoaded", "applyPymIdx", "packPym", "unpackPym",
    "pilotoDesdeCache", "pilotoGuardar", "pilotoMeta", "pilotoFreshCheck", "heartbeat",
    "loadPymBase", "loadPymBaseDescarga", "schedulePymBase", "loadPymFile",
  ],

  async pruebas(t, api, env, cargar) {

    // =====================================================================
    //  CONTRATOS PUROS — identidad de la base, hojas fijadas y ventanas
    // =====================================================================
    t.caso("CONFIG de la base única: GUID sin llaves, nombre con doble espacio, hojas fijadas y ventanas 06/12", () => {
      const b = api.__CONFIG.SP.base;
      t.igual(b.id, GUID_BASE);
      t.igual(b.name, NOMBRE_BASE, "el doble espacio antes de BELLO es parte del nombre (H9)");
      t.igual(b.sheet, "citas dia regional");
      t.igual(b.sheetExtra, "PROCEXDT");
      t.igual(b.shareId, "", "la tercera vía por shareId fue retirada: apuntaba a la base de mayo");
      t.igual(b.horasRefresco, [6, 12]);
    });

    t.caso("pilotoId/baseSheetOpts/spBase: identidad normalizada y hojas fijadas de fábrica", () => {
      t.igual(api.pilotoId(), GUID_BASE);
      t.igual(api.baseSheetOpts(), { main: "citas dia regional", extra: "PROCEXDT", anexo5: "ANEXO" });
      t.igual(api.spBase(), SP_BASE_URL);
      const c = cargar({ silencioso: true });
      c.api.__CONFIG.SP.base = null;
      t.igual(c.api.pilotoId(), "", "sin base configurada, id vacío");
      t.igual(c.api.baseSheetOpts(), null, "y sin hojas fijadas cae a la selección por puntaje");
    });

    t.caso("spFallbackUrls: EXACTAMENTE dos rutas por GUID, normalizadas (llaves fuera, minúsculas)", () => {
      const urls = api.spFallbackUrls("{" + GUID_BASE.toUpperCase() + "}");
      t.igual(urls.length, 2, "v18.6.0: la vía por shareId se retiró — dos intentos y no tres");
      t.igual(urls[0], SP_BASE_URL + "/_api/web/GetFileById('" + GUID_BASE + "')/$value");
      t.igual(urls[1], SP_BASE_URL + "/_layouts/15/download.aspx?UniqueId=" + GUID_BASE);
    });

    t.caso("bogotaAhora: calcula la hora de Bogotá desde UTC (UTC-5 fijo), no desde el huso del equipo", () => {
      const c = cargar({ silencioso: true });
      congelarBogota(c, "2026-09-08", "06:10");
      const b = c.api.bogotaAhora();
      t.igual(b.dia, "2026-09-08");
      t.cierto(Math.abs(b.hora - (6 + 10 / 60)) < 1e-9, "06:10 de Bogotá aunque el host esté en otra zona");
      // Cruce de día en UTC: 20:30 de Bogotá del 8 sigue siendo 8 (en UTC ya es el 9).
      congelarBogota(c, "2026-09-08", "20:30");
      t.igual(c.api.bogotaAhora().dia, "2026-09-08", "20:30 Bogotá = 01:30 UTC del día siguiente: el día del reloj es el de Bogotá");
    });

    t.caso("baseVentanaRefresco: bordes exactos de las ventanas 06:00 y 12:00 (índice del arreglo ordenado)", () => {
      const c = cargar({ silencioso: true });
      const en = (dia, hora) => { congelarBogota(c, dia, hora); return c.api.baseVentanaRefresco(); };
      t.igual(en("2026-09-08", "05:30"), { sello: "2026-09-08|pre", toca: false }, "antes de las 06:00 no abre la mañana");
      t.igual(en("2026-09-08", "05:59"), { sello: "2026-09-08|pre", toca: false });
      t.igual(en("2026-09-08", "06:00"), { sello: "2026-09-08|0", toca: true }, "las 06:00 en punto ya toca");
      t.igual(en("2026-09-08", "11:59"), { sello: "2026-09-08|0", toca: true }, "antes del mediodía sigue vigente la ventana 0");
      t.igual(en("2026-09-08", "12:00"), { sello: "2026-09-08|1", toca: true }, "las 12:00 abre la ventana 1");
      t.igual(en("2026-09-08", "23:30"), { sello: "2026-09-08|1", toca: true }, "y la tarde es la última del día");
    });

    await t.casoAsync("STAGING (revisión adversarial): meta anuncia cambio pero la DESCARGA falla → la ventana NO se sella; el minutero reintenta hasta que la red se repara", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T2");
      cont.planDescarga = false;                       // los 22,5 MB no llegan
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelarBogota(c, "2026-09-08", "06:10");
      c.api.__state.leader = true;
      // Copia vieja ya aplicada (mtime T1): el refresco solo tiene que notar T2 ≠ T1.
      c.api.__state.pym = new Map([["5150076", ["VIH"]]]);
      c.api.__state.pymTodos = new Set(["5150076"]);
      c.api.__state.pymFile = NOMBRE_BASE;
      c.api.__state.pymOrigen = "base";
      c.api.__state.pymMTime = "T1";
      await c.api.pilotoFreshCheck();
      t.igual(c.env.gm["vgl_piloto_chk"], undefined,
        "la meta contestó, pero la descarga falló: NO es desenlace terminal, la ventana queda ABIERTA");
      t.cierto(cont.descargasErr >= 2, "las dos vías de descarga se intentaron (y fallaron)");
      await c.api.pilotoFreshCheck();                  // la vuelta siguiente del minutero
      t.igual(c.env.gm["vgl_piloto_chk"], undefined, "el reintento fallido tampoco sella: no hay tope de copia vieja");
      cont.planDescarga = true;                        // la red del consultorio volvió
      await c.api.pilotoFreshCheck();
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-08|0", "descarga exitosa: recién ahora la ventana queda revisada");
      t.igual(c.api.__state.pymMTime, "T2", "y el índice aplicado es el de la versión nueva");
    });

    // =====================================================================
    //  PIEZAS PURAS DEL ÍNDICE — doc col, vocabulario «Aplica …» y fusionadora
    // =====================================================================
    t.caso("findDocIdx: NRO IDENTIFICACION (con espacio) calza exacto; TIPO_DOCUMENTO jamás es la cédula", () => {
      t.igual(api.findDocIdx(["TIPO_DOCUMENTO", "NRO IDENTIFICACION"]), 1, "H3: el espacio se normaliza a _ antes de comparar");
      t.igual(api.findDocIdx(["CEDULA", "DOCUMENTO"]), 1, "DOC_EXACT se respeta en ORDEN: DOCUMENTO viene antes que CEDULA");
      t.igual(api.findDocIdx(["CEDULA"]), 0);
      t.igual(api.findDocIdx(["TIPO_DOCUMENTO"]), -1, "el TIPO de documento no sirve ni de fallback");
      t.igual(api.findDocIdx(["LA IDENTIFICACION DEL PACIENTE"]), 0, "fallback blando por contenido IDENT");
      t.igual(api.findDocIdx(["NOMBRE", "EDAD"]), -1);
    });

    t.caso("esAplicaPendiente: «Aplica …» corto es pendiente; «No Aplica» y textos largos no", () => {
      t.cierto(api.esAplicaPendiente("Aplica Cobertura y Fenix"));
      t.cierto(api.esAplicaPendiente("  Aplica Tamizacion Mama "), "se recorta antes de mirar");
      t.falso(api.esAplicaPendiente("No Aplica"), "no basta contener «aplica»: tiene que EMPEZAR por ahí");
      t.falso(api.esAplicaPendiente("Con Tamizacion vigente"));
      t.falso(api.esAplicaPendiente(""));
      t.falso(api.esAplicaPendiente("aplica " + "x".repeat(60)), "más de 40 caracteres no es un valor controlado de la hoja");
    });

    t.caso("makeProcexIndexer: traduce CERVIX/MAMA/PSA/SOMF a las etiquetas de siempre, SIN abandono", () => {
      const ix = api.makeProcexIndexer(["IDENTIFICACION", "CERVIX", "MAMA", "PSA", "SOMF", "OTRA"]);
      ix.push(["5150076", "Aplica Cobertura y Fenix", "", "", "Con Tamizacion vigente", "Aplica algo"]);
      ix.push(["4455667", "", "Aplica Tamizacion Mama", "No Aplica", "", ""]);
      ix.push(["", "Aplica Cobertura y Fenix", "", "", "", ""]);   // sin documento: se ignora
      t.igual(ix.map.get("5150076"), ["Cáncer de cuello uterino — Aplica Cobertura y Fenix"],
        "CERVIX refina el tipo con detalleTipoCervix; el valor sin VPH/CCU viaja tal cual");
      t.igual(ix.map.get("4455667"), ["Mamografía"], "MAMA usa la etiqueta del diccionario FRIENDLY");
      t.igual(ix.map.size, 2);
      t.igual(Array.from(ix.todos).sort(), ["4455667", "5150076"]);
      t.falso("abandono" in ix, "la hoja de tamizaciones no tiene abandono PES: ese concepto vive en la principal");
    });

    // =====================================================================
    //  F1 (v18.6.1) — ANEXO 5: indexador de metas RCV con los TYPOS del libro
    //  real («PISCOLOGIA», «HEMOBLOBINA_GLICOSILADA», «MICROALBU/CREATINURIA1»,
    //  «FECHA_MICROALBU/CREATINURIA1» sin DE_TOMA, «Fecha Ultimo Control
    //  (Médico)», «PLANI?»). Columnas en orden REVUELTO para obligar al
    //  emparejamiento por nombre, no por posición.
    // =====================================================================
    const ENC_A5 = [
      "Numero Documento", "SUMA_METAS", "Fecha Ultimo Control (Médico)", "PISCOLOGIA", "CUMPLE_GLICEMIA",
      "FECHA_DE_TOMA_GLICEMIA", "HEMOBLOBINA_GLICOSILADA", "FECHA_DE_TOMA_GLICOSILADA", "CUMPLE_MICROALBUMINURIA",
      "MICROALBU/CREATINURIA1", "FECHA_MICROALBU/CREATINURIA1", "NUTRICION", "PLANI?", "ODONTOLOGIA",
      "EKG", "TFG_DEL_ULTIMO_CONTROL", "ESTADIO_ACTUAL_DE_NEFROPROTECCION", "Programa Actual",
      "TENSION_ARTERIAL_SISTOLICA1", "TENSION_ARTERIAL_DIASTOLICA1", "CIRCUNFERENCIA_ABDOMINAL1",
      "COLESTEROL_LDL1", "GLICEMIA1", "CUMPLE_HEMOGLOBINA_GLICOSILADA", "Estudiado para ERC", "clasificacion",
    ];
    function filaA5(vals) {
      // vals: array alineado con ENC_A5; los strings van inlineStr, los números sin tipo.
      const celdas = vals.map((v, i) => {
        const ref = String.fromCharCode(65 + (i % 26)) + ((i >= 26 ? 1 : 0) ? "A" + String.fromCharCode(65 + i - 26) : "1");
        return null; // placeholder (se construye abajo con refs reales)
      });
      let out = "";
      vals.forEach((v, i) => {
        const col = i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
        const ref = col + "2";
        out += (typeof v === "string" && v !== "")
          ? '<c r="' + ref + '" t="inlineStr"><is><t>' + v + "</t></is></c>"
          : '<c r="' + ref + '"><v>' + v + "</v></c>";
      });
      return "<row r=\"2\">" + out + "</row>";
    }
    function hojaAnexo5() {
      const enc = ENC_A5.map((h, i) => {
        const col = i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
        return '<c r="' + col + '1" t="inlineStr"><is><t>' + h + "</t></is></c>";
      }).join("");
      // 5150076: fila completa (PROGRAMA, control 45900, suma 58, TFG 42.5, estadio 3,
      // EKG VACÍO (=no realizado), PLANI?+NUTRICION+ODONTOLOGIA en REMITIR (PISCOLOGIA no),
      // glicemia 10 pts con fecha 46100, HbA1c 0 pts SIN fecha, micro 0 pts con fecha 46090.
      const r1 = filaA5(["5150076", "58", "45900", "Ya va", "10", "46100", "7.2", "", "0", "25", "46090",
        "REMITIR", "REMITIR", "REMITIR", "", "42.5", "3", "HTA+DM", "138", "84", "102", "112", "98", "0", "No estudiado", "Cumple Metas"]);
      // 7000001: paciente que SOLO vive en el Anexo 5 (no está en citas ni PROCEX).
      const r2 = "<row r=\"3\">" + '<c r="A3"><v>7000001</v></c><c r="B3"><v>90</v></c><c r="R3" t="inlineStr"><is><t>HTA</t></is></c>' + "</row>";
      return "<worksheet><sheetData><row r=\"1\">" + enc + "</row>" + r1 + r2 + "</sheetData></worksheet>";
    }
    function libroConAnexo5() {
      return crearZipPrueba({
        "xl/workbook.xml": '<workbook><sheets><sheet name="CITASDIA AGOSTO" sheetId="1" r:id="rId1"/><sheet name="CITAS DIA  REGIONAL" sheetId="2" r:id="rId2"/><sheet name="PROCEXDT" sheetId="3" r:id="rId3"/><sheet name="ANEXO 5 JULIO" sheetId="4" r:id="rId4"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Target="worksheets/sheet4.xml"/></Relationships>',
        "xl/sharedStrings.xml": XML_SST,
        "xl/worksheets/sheet1.xml": hojaAgosto(),
        "xl/worksheets/sheet2.xml": hojaRegional(),
        "xl/worksheets/sheet3.xml": hojaProcex(),
        "xl/worksheets/sheet4.xml": hojaAnexo5(),
      });
    }

    await t.casoAsync("F1/Anexo 5: el core indexa la TERCERA hoja con los typos del libro real (emparejamiento por nombre, no posición)", async () => {
      const c = cargar({ silencioso: true });
      const res = await c.api._readPymWorkbookStreamCore(libroConAnexo5(), { main: "citas dia regional", extra: "PROCEXDT", anexo5: "ANEXO" });
      t.igual(res.sheetAnexo5, "ANEXO 5 JULIO", "la hoja se encuentra por substring del config");
      t.igual(res.anexo5Docs, 2, "dos pacientes del programa indexados");
      const a = res.anexo5.get("5150076");
      t.cierto(!!a, "el paciente de citas está en el Anexo 5");
      t.igual(a.prog, "HTA+DM");
      t.igual(a.ctrl, 45900, "fecha de último control como serial Excel (la conversión a fecha es cosa del aviso)");
      t.igual(a.suma, 58);
      t.igual(a.tfg, 42.5);
      t.igual(a.est, 3);
      t.igual(a.ekg, 0, "EKG vacío = no realizado (serial 0)");
      t.igual(a.rem, ["Nutrición", "Planificación familiar", "Odontología"], "REMITIR en orden de columna: NUTRICION, PLANI?, ODONTOLOGIA; PISCOLOGIA («Ya va») no cuenta");
      t.igual(a.m[0], [10, 46100], "GLICEMIA: 10 puntos con fecha de toma");
      t.igual(a.m[4], [0, 46090], "MICROALBUMINURIA: 0 puntos, fecha de la columna con typo FECHA_MICROALBU/CREATINURIA1");
      t.igual(a.m[5], [0, 0], "HBA1C: 0 puntos y SIN fecha (FECHA_DE_TOMA_GLICOSILADA, sin HEMO — el typo del libro)");
      t.igual(a.v, [138, 84, 102, 7.2, 112, 98, 25], "valores de contexto v7 (v18.11.0): TA s/d, circunferencia, HbA1c, LDL, glicemia y el RAC real en mg/g (col MICROALBU/CREATINURIA1, 25)");
      t.igual(res.anexo5.get("5150076").v[6], 25, "el RAC real (25) es DISTINTO de los puntos de la meta (a.m[4][0] = 0): esa diferencia es justo lo que el defecto v18.6.1 confundía");
      t.falso(res.todos.has("7000001"), "el paciente SOLO del Anexo 5 NO entra en todos: la tarjeta no puede decir «al día» por estar en el programa");
      t.cierto(res.anexo5.has("7000001"), "pero sí está en su propio mapa para el aviso");
    });

    await t.casoAsync("F1/Anexo 5: el mapa viaja en el paquete v4 y sobrevive descarga→caché→recarga", async () => {
      const cont = contadorBase();
      cont.bufFn = libroConAnexo5;
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      t.cierto(await c.api.loadPymBase(true), "descarga e instala la base");
      t.cierto(c.api.__state.pymAnexo5.size === 2, "state.pymAnexo5 poblado desde el lector");
      const crudo = String(c.env.gm["vgl_piloto"] || "");
      t.cierto(crudo.lastIndexOf('{"v":4', 0) === 0, "paquete v4 en el almacén");
      t.cierto(/"a5":"\{/.test(crudo), "el campo a5 lleva el JSON del Anexo 5");
      // Recarga en frío (segundo cargar simulando otra pestaña al día siguiente de
      // caché): el almacén GM del arnés es un closure por cargar, así que se comparte
      // la clave a mano — exactamente lo que Tampermonkey comparte de verdad.
      const c2 = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c2.env.gm["vgl_piloto"] = crudo;
      t.cierto(await c2.api.pilotoDesdeCache(), "la caché v4 se acepta");
      t.igual(c2.api.__state.pymAnexo5.size, 2, "y el Anexo 5 se restaura completo");
      t.igual(c2.api.__state.pymAnexo5.get("5150076").suma, 58, "campo a campo");
    });

    await t.casoAsync("F1/Anexo 5: paquete v3 de AYER (sin a5) se acepta con Anexo 5 vacío — el aviso degrada, no rompe", async () => {
      const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_piloto"] = JSON.stringify({
        v: 3, labels: ["VIH"], p: "5150076:0", t: "5150076", ab: "",
        date: ayer, name: "VIEJA.xlsx", mtime: "T0", fp: "VIEJA.xlsx|T0", id: GUID_BASE,
      });
      t.cierto(await c.api.pilotoDesdeCache(), "el v3 viejo sigue vivo");
      t.igual(c.api.__state.pym.size, 1, "el índice PyM sí se aplica");
      t.igual(c.api.__state.pymAnexo5.size, 0, "el Anexo 5 llega vacío: sin dato, sin mentira");
    });

    await t.casoAsync("F1/Anexo 5: libro SIN hoja ANEXO → todo sigue igual y el mapa queda vacío", async () => {
      const c = cargar({ silencioso: true });
      const res = await c.api._readPymWorkbookStreamCore(libroBase(), c.api.baseSheetOpts());
      t.igual(res.sheetAnexo5, "", "sin hoja no hay nombre");
      t.igual(res.anexo5Docs, 0);
      t.igual(res.anexo5.size, 0);
      t.cierto(res.todos.size >= 3, "la regional+PROCEX siguen intactas");
    });

    t.caso("mtrLibroNoParecePym/esLibroValido/esXlsxCifrado: los guardianes de integridad básicos", () => {
      const docs = (n) => { const s = new Set(); for (let i = 0; i < n; i++) s.add("d" + i); return s; };
      t.cierto(api.mtrLibroNoParecePym({ todos: docs(1396), map: new Map() }), "muchos documentos y cero pendientes: otro libro");
      t.falso(api.mtrLibroNoParecePym({ todos: docs(1396), map: new Map([["1", ["x"]]]) }));
      t.cierto(api.esLibroValido(libroBase(), NOMBRE_BASE), "el ZIP sintético empieza por PK, como un xlsx de verdad");
      t.falso(api.esLibroValido(new TextEncoder().encode("<html>login</html>").buffer, NOMBRE_BASE),
        "la página de inicio de sesión con estado 200 no es un Excel");
      t.cierto(api.esXlsxCifrado(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 1, 1, 1, 1])), "contenedor OLE = libro con contraseña");
      t.falso(api.esXlsxCifrado(libroBase()));
      t.noLanza(() => api.progreso("Bajando la base…"), "progreso nunca revienta aunque no haya panel");
    });

    // =====================================================================
    //  PURGA LEGACY — el almacén viejo de hasta 12 MB no puede quedar vivo
    // =====================================================================
    t.caso("_vglPurgarCacheDiariaLegacy: borra vgl_pym/vgl_pym_dia/vgl_pym_esfallback del GM y del localStorage, y no toca vgl_piloto", () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_pym"] = "x".repeat(64);
      c.env.gm["vgl_pym_dia"] = "2026-08-01";
      c.env.gm["vgl_pym_esfallback"] = "1";
      c.env.storage.setItem("vgl_pym_dia", "2026-08-01");
      c.env.gm["vgl_piloto"] = '{"v":3';
      c.api._vglPurgarCacheDiariaLegacy();
      t.igual(c.env.gm["vgl_pym"], undefined, "GM_deleteValue: la clave desaparece, no queda vacía");
      t.igual(c.env.gm["vgl_pym_dia"], undefined);
      t.igual(c.env.gm["vgl_pym_esfallback"], undefined);
      t.igual(c.env.storage.getItem("vgl_pym_dia"), null, "también la marca del día que vivía en localStorage");
      t.igual(c.env.gm["vgl_piloto"], '{"v":3', "la clave de la base NUEVA no la toca");
      t.noLanza(() => c.api._vglPurgarCacheDiariaLegacy(), "con el almacén ya limpio es inofensiva");
    });

    // =====================================================================
    //  baseLog — el anillo de mantenimiento (requisito del médico)
    // =====================================================================
    t.caso("baseLog: JSON roto reinicia el anillo en vez de corromperlo", () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_base_log"] = '{"v":3, ESTO NO ES JSON';
      t.noLanza(() => c.api.baseLog({ fase: "meta", ok: true }));
      t.igual(leerLog(c).length, 1, "el paquete roto se pierde, la fila nueva no");
    });

    t.caso("baseLog: recorta a las últimas 60 filas (FIFO) — 65 escrituras dejan 60", () => {
      const c = cargar({ silencioso: true });
      for (let i = 0; i < 65; i++) c.api.baseLog({ fase: "prueba", ok: true, n: i });
      const arr = leerLog(c);
      t.igual(arr.length, 60, "el anillo nunca satura el almacén de Tampermonkey");
      t.igual(arr[0].n, 5, "las 5 más viejas se cayeron por la cola");
      t.igual(arr[59].n, 64);
      t.cierto(typeof arr[0].t === "string" && arr[0].t.indexOf("T") > 0, "cada fila lleva su sello ISO");
    });

    // =====================================================================
    //  TRANSPORTE — gmGet/gmJson/pilotoMeta/primeShareAccess con red simulada
    // =====================================================================
    await t.casoAsync("gmGet/gmJson: defaults del transporte y errores distinguibles (HTTP/red/timeout)", async () => {
      const caps = [];
      let plan = (o) => o.onload({ status: 200, response: { value: [{ Name: "a" }] }, responseText: '{"value":[{"Name":"NO"}]}' });
      const c = cargar({ silencioso: true, gmxhr: (o) => { caps.push(o); plan(o); } });
      let j = await c.api.gmJson("https://sitio/lista");
      t.igual(j.value[0].Name, "a", "r.response manda sobre responseText");
      t.igual(caps[0].headers.Accept, "application/json;odata=nometadata", "gmJson pide JSON odata");
      t.igual(caps[0].timeout, 12000, "el listado/meta se rinde rápido a propósito");
      plan = (o) => o.onload({ status: 200, responseText: '{"d":{"results":[7]}}' });
      j = await c.api.gmJson("https://sitio/lista");
      t.igual(j.d.results[0], 7, "sin response interpreta el responseText");
      plan = (o) => o.onload({ status: 200, responseText: "ok" });
      const r = await c.api.gmGet("https://sitio/x");
      t.igual(r.responseText, "ok");
      t.igual(caps[caps.length - 1].method, "GET");
      t.igual(caps[caps.length - 1].timeout, 60000, "timeout por defecto");
      let msg = "";
      plan = (o) => o.onload({ status: 500 });
      try { await c.api.gmGet("https://sitio/z"); } catch (e) { msg = e.message; }
      t.igual(msg, "HTTP 500");
      plan = (o) => o.onerror();
      try { await c.api.gmGet("https://sitio/z"); } catch (e) { msg = e.message; }
      t.igual(msg, "error de red/permiso");
    });

    await t.casoAsync("pilotoMeta: pregunta SOLO Name y TimeLastModified por GetFileById del GUID configurado", async () => {
      const cont = contadorBase("ARCHIVO NUEVO.xlsx", "T-9");
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      t.igual(await c.api.pilotoMeta(), { name: "ARCHIVO NUEVO.xlsx", mtime: "T-9" });
      t.cierto(cont.urls[0].indexOf(SP_BASE_URL + "/_api/web/GetFileById('" + GUID_BASE + "')?$select=Name,TimeLastModified") === 0,
        "1 KB de metadatos, no 22 MB, para saber si cambió");
      cont.planMeta = false;
      t.igual(await c.api.pilotoMeta(), null, "la red caída devuelve null, nunca lanza");
    });

    await t.casoAsync("primeShareAccess: ceba la cookie del enlace compartido y cachea 25 min; force la repite", async () => {
      const cont = contadorBase();
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      t.igual(await c.api.primeShareAccess(), true);
      t.igual(cont.primes, 1);
      t.igual(cont.urls[0], c.api.__CONFIG.SP.shareLink, "visita exactamente el enlace de compartir configurado");
      t.igual(await c.api.primeShareAccess(), true);
      t.igual(cont.primes, 1, "dentro de los 25 min no vuelve a la red");
      t.igual(await c.api.primeShareAccess(true), true);
      t.igual(cont.primes, 2, "force la renueva (la segunda pasada de descarga la usa)");
    });

    // =====================================================================
    //  LECTOR DEL LIBRO — hoja fijada manda sobre el puntaje (H1)
    // =====================================================================
    await t.casoAsync("_readPymWorkbookStreamCore SIN opts: el puntaje elige la hoja histórica más poblada — por eso se fija", async () => {
      const c = cargar({ silencioso: true });
      const res = await c.api._readPymWorkbookStreamCore(libroBase(), null);
      t.igual(res.sheetName, "CITASDIA AGOSTO",
        "auditoría H1: sin hoja fijada, la hoja del mes pasado (8 pendientes vs 3) gana por puntaje y el día queda en datos viejos");
      t.cierto(res.map.size > 0, "la hoja histórica también tiene pacientes: el error no era visible a simple vista");
    });

    await t.casoAsync("readPymWorkbookStream CON opts de la base: la hoja fijada manda, PROCEXDT se fusiona y el doble espacio no importa", async () => {
      const c = cargar({ silencioso: true });
      const res = await c.api.readPymWorkbookStream(libroBase(), { main: "citas dia regional", extra: "PROCEXDT" });
      t.igual(res.sheetName, "CITAS DIA  REGIONAL", "nombre REAL de la hoja (con su doble espacio), no el del config");
      t.igual(res.sheetExtra, "PROCEXDT");
      t.igual(res.extraDocs, 2, "los dos pacientes de la hoja de tamizaciones entran al universo");
      t.igual(res.map.get("5150076"), ["VIH", "Tamización cardiometabólica", "Cáncer de cuello uterino — Aplica Cobertura y Fenix"],
        "fusión por unión: citas + tamizaciones en el MISMO bucket, sin duplicar");
      t.igual(res.map.get("4455667"), ["Mamografía"], "el paciente que SOLO está en PROCEXDT también queda indexado");
      t.falso(res.map.has("300123"), "el paciente al día no entra al mapa");
      t.igual(Array.from(res.todos).sort(), ["300123", "4455667", "5150076", "99887766"]);
      t.cierto(res.abandono.has("99887766"), "el Abandonados_PES de la hoja principal sigue vivo");
      t.falso(res.abandono.has("4455667"), "la PROCEXDT no aporta abandono");
    });

    await t.casoAsync("_readPymWorkbookStreamCore: hoja fijada RENOMBRADA lanza con mensaje que nombra la hoja", async () => {
      const c = cargar({ silencioso: true });
      let msg = "";
      try { await c.api._readPymWorkbookStreamCore(libroHojaRenombrada(), { main: "citas dia regional", extra: "PROCEXDT" }); }
      catch (e) { msg = String(e.message); }
      t.cierto(msg.indexOf("no encontré la hoja") >= 0 && msg.indexOf("citas dia regional") >= 0,
        "el mantenimiento necesita saber QUÉ hoja faltó · " + msg);
    });

    await t.casoAsync("readPym: la rama CSV IGNORA opts (la selección de hoja es cosa del libro, no del CSV)", async () => {
      const c = cargar({ silencioso: true });
      const idx = await c.api.readPym("base.csv", bufCSV(), { main: "cualquier cosa" });
      t.igual(idx.map.get("5150076"), ["VIH"]);
      t.cierto(idx.abandono.has("99887766"));
    });

    await t.casoAsync("readPym con libro: deja el nombre de la hoja en state.pymHoja", async () => {
      const c = cargar({ silencioso: true });
      const idx = await c.api.readPym(NOMBRE_BASE, libroBase(), c.api.baseSheetOpts());
      t.igual(c.api.__state.pymHoja, "CITAS DIA  REGIONAL");
      t.igual(idx.map.get("5150076").length, 3, "el índice devuelto es el fusionado");
    });

    // =====================================================================
    //  applyPymIdx / afterPymLoaded — las guardas del índice aplicado
    // =====================================================================
    t.caso("applyPymIdx (4 args): rechaza un índice sin actividades y NO escribe caché ninguna", () => {
      const c = cargar({ silencioso: true });
      const todos = new Set(); for (let i = 0; i < 200; i++) todos.add("d" + i);
      t.igual(c.api.applyPymIdx({ map: new Map(), todos, abandono: new Set() }, "OTRO.xlsx", "", "OTRO.xlsx"), false);
      t.igual(c.api.__state.pymFile, "", "no sella nada");
      t.cierto(!c.env.gm["vgl_piloto"], "savePymCache fue retirado: applyPymIdx no persiste por su cuenta");
      t.cierto(/OTRO\.xlsx/.test(c.api.__state.pymUltimoFallo), "el motivo queda anotado para el panel");
    });

    t.caso("applyPymIdx + afterPymLoaded: instala el índice con mtime y huella del nombre REAL", () => {
      const c = cargar({ silencioso: true });
      const map = new Map([["5150076", ["VIH"]]]);
      const todos = new Set(["5150076", "300123"]);
      t.igual(c.api.applyPymIdx({ map, todos, abandono: new Set() }, NOMBRE_BASE, "T1", NOMBRE_BASE), true);
      t.igual(c.api.__state.pymMTime, "T1");
      t.igual(c.api.__state.pymFP, NOMBRE_BASE + "|T1", "la huella usa nombre crudo + mtime, para comparar con la próxima meta");
      t.igual(c.api.__state.pymUltimoFallo, "", "cargó bien: el motivo anterior se olvida");
      t.igual(c.api.afterPymLoaded("X.xlsx"), undefined, "afterPymLoaded no devuelve nada: su efecto es el estado");
      t.igual(c.api.__state.pymFile, "X.xlsx");
      t.igual(c.api.__state.pymCargadoDia, c.api.todayStamp(), "sella el día de la carga (detección de base de ayer)");
      t.igual(c.api.__state.pymDeAyer, false);
    });

    // =====================================================================
    //  (1) ARRANQUE — almacén limpio, meta y descarga sanas
    // =====================================================================
    await t.casoAsync("ARRANQUE: almacén limpio + purga legacy → loadPymBase aplica la base, la guarda y sella origen «base»", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T1");
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      // El rastro del extinto archivo diario (hasta 12 MB de una jornada vieja).
      c.env.gm["vgl_pym"] = "x".repeat(64);
      c.env.gm["vgl_pym_dia"] = "2026-08-01";
      c.env.gm["vgl_pym_esfallback"] = "1";
      c.api._vglPurgarCacheDiariaLegacy();

      t.igual(await c.api.loadPymBase(true), true);
      const st = c.api.__state;
      t.igual(st.pymOrigen, "base", "queda marcada como carga de la base única (ni «fallback» ni «día»)");
      t.igual(st.pymMTime, "T1", "el mtime del estado es el del SERVIDOR, no el del nombre configurado");
      t.igual(st.pymFile, NOMBRE_BASE, "el nombre mostrado también viene de los metadatos reales");
      t.igual(st.pym.get("5150076"), ["VIH", "Tamización cardiometabólica", "Cáncer de cuello uterino — Aplica Cobertura y Fenix"]);
      t.igual(cont.meta, 1, "primero los metadatos de 1 KB");
      t.igual(cont.descargasOk, 1, "la primera ruta por GUID bastó");
      t.igual(cont.timeoutDescarga, 180000, "T_DESCARGA: la base pesa ~22,5 MB y el margen es de 180 s por llamada");
      t.cierto(cont.urls.some((u) => u === SP_BASE_URL + "/_api/web/GetFileById('" + GUID_BASE + "')/$value"), "ruta 0 por GetFileById");
      t.falso(cont.urls.some((u) => u.indexOf("download.aspx") >= 0), "la segunda ruta ni se tocó: sin paralelismo");

      // La caché persistente quedó lista para el próximo arranque sin red.
      const crudo = String(c.env.gm["vgl_piloto"] || "");
      t.cierto(crudo.lastIndexOf('{"v":4', 0) === 0, "paquete v4 (v18.6.1)");
      const u = await c.api.unpackPym(crudo, null);
      t.igual(u.meta.mtime, "T1");
      t.igual(u.meta.id, GUID_BASE, "lleva el id: si mañana cambian el GUID, la copia se purga sola");
      t.igual(u.meta.name, NOMBRE_BASE);
      t.igual(u.map.get("5150076").length, 3, "el índice cacheado es el fusionado con PROCEXDT");

      // Y las claves legacy siguen fuera: la carga nueva no las resucita.
      t.igual(c.env.gm["vgl_pym"], undefined);
      t.igual(c.env.gm["vgl_pym_dia"], undefined);
      t.igual(c.env.gm["vgl_pym_esfallback"], undefined);

      // Visibilidad (canal ux del tablero): métricas de la descarga aplicada.
      c.api._uxVolcarBuffer();
      const w = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(w.acciones["base.descarga.ok"], 1);
      t.igual(w.acciones["base.indice.pacientes.x100"], 1);
      // El aviso azul de carga (uid por día) quedó registrado: una vez por jornada.
      t.cierto(vistos(c)["notify|basecarga|" + c.api.todayStamp()] !== undefined);
    });

    // =====================================================================
    //  (2) ROLLBACK — la descarga falla con la caché buena puesta
    // =====================================================================
    await t.casoAsync("ROLLBACK: descarga caída con caché válida → false, la caché no cambia BIT A BIT y el índice viejo sigue", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T-NUEVA");
      cont.planDescarga = false;                       // la red de la sede murió a mitad de refresco
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelarBogota(c, "2026-09-08", "06:10");
      const antes = await sembrarCache(c);
      t.igual(await c.api.pilotoDesdeCache(), true, "control: la copia local aplicó sin red");
      t.igual(c.api.__state.pymMTime, "T-VIEJA");

      await c.api.pilotoFreshCheck();                  // la meta responde, la descarga no

      const st = c.api.__state;
      t.igual(st.pymMTime, "T-VIEJA", "el índice aplicado sigue siendo el de la copia buena");
      t.igual(st.pym.get("5150076"), ["VIH", "Valoración integral de salud"], "los pacientes de la copia siguen ahí");
      t.igual(st.pymOrigen, "base");
      t.igual(c.env.gm["vgl_piloto"], antes, "la caché persistente quedó idéntica: nada a medias");
      t.igual(cont.descargasErr, 4, "las 2 rutas × las 2 pasadas, UNA TRAS OTRA (jamás en paralelo)");
      t.cierto(/conectar|descargar/i.test(st.pymUltimoFallo), "el médico ve por qué no hay base nueva · " + st.pymUltimoFallo);

      const log = leerLog(c);
      const meta = log.filter((f) => f.fase === "meta"), desc = log.filter((f) => f.fase === "descarga");
      t.igual(meta.length, 1);
      t.igual(meta[0].ok, true, "la meta SÍ respondió: la ventana quedó revisada");
      t.igual(desc.length, 1);
      t.igual(desc[0].ok, false, "la descarga quedó registrada como fallida, con su motivo");
      t.cierto(typeof desc[0].err === "string" && desc[0].err.length > 0);
    });

    // =====================================================================
    //  (3) INTEGRIDAD — descarga buena, libro ilegible (hoja renombrada)
    // =====================================================================
    await t.casoAsync("INTEGRIDAD: el libro nuevo no tiene la hoja fijada → false, caché intacta, aviso ÁMBAR y fila de índice en rojo", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T2");
      cont.bufFn = libroHojaRenombrada;                // SharePoint sirve el archivo… con las hojas renombradas
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      t.cierto(c.api.heartbeat(), "control del gate: esta pestaña puede liderar (el aviso AMBAR solo sale del líder)");
      const antes = await sembrarCache(c);
      t.igual(await c.api.pilotoDesdeCache(), true);
      const hoy = c.api.todayStamp();

      t.igual(await c.api.loadPymBaseDescarga(true, { name: NOMBRE_BASE, mtime: "T2" }, false), false);

      const st = c.api.__state;
      t.igual(st.pymMTime, "T-VIEJA", "el índice NUEVO no se aplicó: la última copia VALIDADA manda (rollback automático)");
      t.igual(c.env.gm["vgl_piloto"], antes, "y la caché tampoco se tocó: un índice ilegible no se guarda jamás");
      const log = leerLog(c);
      const ix = log.filter((f) => f.fase === "indice");
      t.igual(ix.length, 1);
      t.igual(ix[0].ok, false);
      t.cierto(String(ix[0].err || "").indexOf("no encontré la hoja") >= 0, "el log dice qué pasó de verdad");
      t.cierto(vistos(c)["notify|basebad|" + hoy] !== undefined,
        "avisó «La base nueva no se pudo leer» (uid basebad por día): el médico no se entera por rumores");
      const desc = log.filter((f) => f.fase === "descarga");
      t.igual(desc[0].ok, true, "la descarga en sí fue buena: el fallo es de estructura, y así queda escrito");
    });

    // =====================================================================
    //  (4) RECUPERACIÓN — la red se repara entre intento e intento
    // =====================================================================
    await t.casoAsync("RECUPERACIÓN: primera descarga falla; el gmxhr «se repara» y el segundo loadPymBase aplica la nueva", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T1");
      cont.planDescarga = false;
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });

      t.igual(await c.api.loadPymBase(true), false, "turno que arranca con la red de la sede caída");
      t.igual(c.api.__state.pymFile, "", "no quedó nada a medias");
      t.cierto(!c.env.gm["vgl_piloto"], "ni caché parcial");
      t.cierto(c.api.__state.pymUltimoFallo.length > 0, "el panel sabe por qué no hay base");

      cont.planDescarga = true;                        // «se reparó» (volvió el wifi, renovaron la sesión…)
      t.igual(await c.api.loadPymBase(true), true);
      t.igual(c.api.__state.pymOrigen, "base");
      t.igual(c.api.__state.pymMTime, "T1");
      t.igual(cont.descargasOk, 1, "solo cuenta la exitosa");
      t.cierto(String(c.env.gm["vgl_piloto"] || "").lastIndexOf('{"v":4', 0) === 0, "y ahora sí quedó copia para mañana (v4)");
      t.igual(c.api.__state.pymUltimoFallo, "", "cargó bien: el motivo viejo no se queda colgado");
    });

    // =====================================================================
    //  (5) VENTANAS 06:00/12:00 — con el reloj congelado en hora Bogotá
    // =====================================================================
    await t.casoAsync("VENTANAS: 05:30 cero red; 06:10 UNA meta sin descarga; 07:00 nada nuevo (sello de la mañana)", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T1");   // mtime IGUAL al de la copia local
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelarBogota(c, "2026-09-08", "05:30");
      await sembrarCache(c, { mtime: "T1" });
      t.igual(await c.api.pilotoDesdeCache(), true, "la pestaña arrancó con la copia local ya aplicada");

      await c.api.pilotoFreshCheck();                  // 05:30
      t.igual(cont.total, 0, "antes de las 06:00 ni los metadatos: la ventana no abrió");

      congelarBogota(c, "2026-09-08", "06:10");
      await c.api.pilotoFreshCheck();                  // 06:10
      t.igual(cont.meta, 1, "la ventana de la mañana abrió: UNA consulta de metadatos de ~1 KB");
      t.igual(cont.descargasOk, 0, "mtime igual: se queda con la copia guardada (cero de los 22 MB)");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-08|0", "la ventana 0 quedó sellada");

      congelarBogota(c, "2026-09-08", "07:00");
      await c.api.pilotoFreshCheck();                  // 07:00, misma ventana
      t.igual(cont.meta, 1, "el sello corta en seco cualquier repetición dentro de la mañana");
    });

    await t.casoAsync("VENTANAS: 12:10 → segunda meta; con mtime NUEVO paga UNA descarga y notifica «actualizada»", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T2");   // la sede subió el libro corregido antes del mediodía
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelarBogota(c, "2026-09-08", "06:10");
      await sembrarCache(c, { mtime: "T1" });
      t.igual(await c.api.pilotoDesdeCache(), true);
      cont.metaMtime = "T1";                           // a las 06:10 aún no había cambios
      await c.api.pilotoFreshCheck();
      t.igual(cont.descargasOk, 0);

      congelarBogota(c, "2026-09-08", "12:10");
      cont.metaMtime = "T2";
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 2, "la ventana de la tarde abrió: la segunda meta del día");
      t.igual(cont.descargasOk, 1, "mtime distinto: UNA sola descarga completa");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-08|1", "sello de la ventana 1");
      t.igual(c.api.__state.pymMTime, "T2", "el índice aplicado es el nuevo");
      t.cierto(String(c.env.gm["vgl_piloto"] || "").indexOf('"mtime":"T2"') >= 0, "la copia persistente quedó renovada");
      t.cierto(vistos(c)["notify|baseupd|2026-09-08|1"] !== undefined,
        "avisó «Base de prevención actualizada» con uid por VENTANA: ni se repite ni se pierde");

      congelarBogota(c, "2026-09-08", "12:40");
      await c.api.pilotoFreshCheck();
      t.igual(cont.meta, 2, "dentro de la misma ventana de la tarde no vuelve a preguntar");
    });

    // =====================================================================
    //  (6) LOG — tres actualizaciones reales dejan tres filas por fase
    // =====================================================================
    await t.casoAsync("LOG: 3 actualizaciones (mañana, tarde, mañana siguiente) → 3 filas de CADA fase, sin PHI", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T1");
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });

      congelarBogota(c, "2026-09-08", "06:10");
      cont.metaMtime = "T1";
      await c.api.pilotoFreshCheck();                  // estado limpio: meta + descarga + índice
      congelarBogota(c, "2026-09-08", "12:10");
      cont.metaMtime = "T2";
      await c.api.pilotoFreshCheck();
      congelarBogota(c, "2026-09-09", "06:10");
      cont.metaMtime = "T3";
      await c.api.pilotoFreshCheck();

      const log = leerLog(c);
      t.cierto(!!log, "el anillo quedó como JSON válido");
      const porFase = (f) => log.filter((x) => x.fase === f);
      t.igual(porFase("meta").length, 3, "una fila de meta por ventana revisada");
      t.igual(porFase("descarga").length, 3);
      t.igual(porFase("indice").length, 3);
      t.cierto(porFase("meta").every((f) => f.ok === true && typeof f.ms === "number"));
      t.cierto(porFase("descarga").every((f) => f.ok === true && typeof f.mb === "number"), "con el tamaño en MB de cada descarga");
      t.cierto(porFase("indice").every((f) => f.ok === true && f.pacientes > 0 && f.todos > 0));
      t.igual(porFase("descarga").map((f) => f.mtime), ["T1", "T2", "T3"], "el mtime del servidor viaja en cada fila");
      t.falso(log.some((f) => /5150076|99887766|300123|4455667/.test(JSON.stringify(f))),
        "SIN PHI: las cédulas sintéticas del libro NO pueden aparecer en el log de mantenimiento");
      t.falso(log.some((f) => f.fase === "cache"), "aquí no pasó por caché: solo las fases de red");
    });

    // =====================================================================
    //  (7) MEDIANOCHE — la pestaña que cruza el día
    // =====================================================================
    await t.casoAsync("MEDIANOCHE: pestaña abierta desde ayer → la primera ventana del día NUEVO dispara la descarga aunque el sello viejo exista", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T-VIEJA");
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      congelarBogota(c, "2026-09-08", "12:10");
      await sembrarCache(c, { mtime: "T-VIEJA" });
      t.igual(await c.api.pilotoDesdeCache(), true);
      await c.api.pilotoFreshCheck();                  // jornada del 8: ventana 1 revisada, sin cambios
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-08|1");
      t.igual(cont.descargasOk, 0);

      // La pestaña duerme, cruza medianoche, y la sede subió el libro de madrugada.
      congelarBogota(c, "2026-09-09", "06:05");
      cont.metaMtime = "T-NUEVA-09";
      cont.meta = 0;                                   // contador fresco para la jornada nueva
      await c.api.pilotoFreshCheck();

      t.igual(cont.meta, 1, "el sello del 8 NO bloquea al del 9: llevan el día en el texto");
      t.igual(cont.descargasOk, 1, "mtime nuevo → la descarga de la mañana del día nuevo sí sale");
      t.igual(c.env.gm["vgl_piloto_chk"], "2026-09-09|0");
      t.igual(c.api.__state.pymMTime, "T-NUEVA-09");
      t.cierto(vistos(c)["notify|baseupd|2026-09-09|0"] !== undefined);
    });

    // =====================================================================
    //  CARGA MANUAL — «Abrir PyM» manda siempre
    // =====================================================================
    await t.casoAsync("loadPymFile: un CSV a mano queda origen «manual», y la base automática no lo pisa después", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T9");
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c.ctx.FileReader = function () {                 // FileReader no existe en el sandbox
        const yo = this;
        this.readAsText = () => { setTimeout(() => { if (yo.onload) yo.onload({ target: { result: CSV_PILOTO } }); }, 0); };
        this.readAsArrayBuffer = () => {};
      };
      c.api.loadPymFile({ name: "PYM_MANUAL.csv" });
      await esperar(() => c.api.__state.pymFile === "PYM_MANUAL.csv", 3000, "la carga manual del CSV");
      t.igual(c.api.__state.pymOrigen, "manual", "origen manual: el refresco de las 06/12 no lo reemplaza");
      t.igual(c.api.__state.pym.get("5150076"), ["VIH"]);

      // El manual puesto, loadPymBase dice «ya hay algo» sin tocar la red.
      t.igual(await c.api.loadPymBase(true), true);
      t.igual(cont.total, 0);

      // Y una descarga que llega DESPUÉS guarda la copia pero NO aplica encima.
      t.igual(await c.api.loadPymBaseDescarga(true, { name: NOMBRE_BASE, mtime: "T9" }, false), true);
      t.igual(c.api.__state.pymFile, "PYM_MANUAL.csv", "la pantalla del médico sigue siendo la SUYA");
      t.igual(c.api.__state.pymOrigen, "manual");
      t.igual(c.api.__state.pym.size, 1, "el índice activo sigue siendo el del manual");
      const copia = JSON.parse(String(c.env.gm["vgl_piloto"]));
      t.igual(copia.mtime, "T9", "la copia persistente SÍ se renovó: mañana arranca con la versión nueva");
      const ix = leerLog(c).filter((f) => f.fase === "indice");
      t.igual(ix.length, 1);
      t.igual(ix[0].aplicado, false, "el log dice la verdad: se guardó pero NO se aplicó");
      t.igual(ix[0].ok, true);
    });

    await t.casoAsync("pilotoGuardar: empaqueta el índice con el id y la fecha de HOY (invalidación por GUID y por edad)", async () => {
      const c = cargar({ silencioso: true });
      await c.api.pilotoGuardar(
        { map: new Map([["111", ["Tamización de VIH"]]]), todos: new Set(["111", "222"]), abandono: new Set(["222"]) },
        { name: "N.xlsx", mtime: "M1", fp: "N.xlsx|M1" }
      );
      const o = JSON.parse(String(c.env.gm["vgl_piloto"]));
      t.igual(o.id, GUID_BASE);
      t.igual(o.date, c.api.todayStamp());
      t.igual(o.mtime, "M1");
      const u = await c.api.unpackPym(c.env.gm["vgl_piloto"], null);
      t.igual(u.abandono.has("222"), true);
    });

    // =====================================================================
    //  ESCALERA DE ARRANQUE — 3 intentos y para, con o sin red
    // =====================================================================
    await t.casoAsync("schedulePymBase: con la red caída hace EXACTAMENTE 3 intentos (2s/45s/180s) y termina", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T1");
      cont.planMeta = true; cont.planDescarga = false;
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c.api.schedulePymBase();
      await dormir(400);                               // los timers del sandbox corren a ~1 ms
      t.igual(cont.meta, 3, "un intento de loadPymBase por peldaño de la escalera, y NO más");
      t.igual(cont.descargasErr, 12, "3 intentos × 2 pasadas × 2 rutas: se probaron TODAS, una a una");
      t.igual(c.api.__state.pymFile, "", "no hay base cargada");
      t.cierto(leerLog(c).filter((f) => f.fase === "descarga" && f.ok === false).length >= 3,
        "cada peldaño fallido dejó su fila: el mantenimiento ve los tres");
    });

    await t.casoAsync("schedulePymBase: con red sana aplica en el primer peldaño y no repite", async () => {
      const cont = contadorBase(NOMBRE_BASE, "T1");
      const c = cargar({ silencioso: true, gmxhr: gmxhrBase(cont) });
      c.api.schedulePymBase();
      await esperar(() => c.api.__state.pymFile === NOMBRE_BASE, 4000, "la carga programada");
      t.igual(cont.meta, 1, "aplicó al primer intento: la escalera se corta sola");
      t.igual(c.api.__state.pymOrigen, "base");
      t.igual(c.api.__state.pym.get("5150076").length, 3);
    });
  },
};
