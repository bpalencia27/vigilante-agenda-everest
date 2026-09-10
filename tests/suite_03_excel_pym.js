// =====================================================================
//  SUITE 03 — Excel PyM: base única v18.6.0
//
//  REESCRITA COMPLETA para la base única «BASE PILOTO DE CONSULTA
//  BELLO SEPTIEMBRE1.xlsx»: el flujo del archivo diario («Agenda Día»,
//  todayTokens/normName/esNombreDeHoy/pickTodaysFile/xlsViejoDeHoy/
//  savePymCache/loadPymFromCache…) fue RETIRADO del userscript y esta
//  suite ya no puede (ni debe) probarlo. Hoy cubre las piezas nuevas y
//  las que sobrevivieron:
//    · findDocIdx / esAplicaPendiente / makeProcexIndexer — la lectura
//      de la hoja PROCEXDT de tamizaciones (CERVIX/MAMA/PSA/SOMF).
//    · spFallbackUrls — las DOS vías por GUID, ni una más.
//    · bogotaAhora / baseVentanaRefresco — el reloj UTC-5 fijo de los
//      refrescos de las 06:00 y las 12:00.
//    · baseLog — el anillo de 60 filas del log de mantenimiento.
//    · _vglPurgarCacheDiariaLegacy — la limpieza de las claves viejas
//      del archivo diario en el almacén de Tampermonkey.
//    · packPym/unpackPym, esLibroValido/esXlsxCifrado y
//      mtrLibroNoParecePym — sobrevivieron a la migración tal cual.
// =====================================================================

const { execFileSync } = require("child_process");
const path = require("path");

const SP_BASE = "https://viva1aips-my.sharepoint.com/personal/director_bello_viva1a_com_co";
const GUID_BASE = "6594b356-f608-4c56-bb6f-6a90f2125a3f";

// Congela el reloj del sandbox en un instante EXACTO (epoch UTC). El
// runner fija TZ=America/Bogota para el proceso, pero ninguna de estas
// pruebas depende de eso: los instantes se construyen con Date.UTC y las
// esperas se calculan por aritmética pura, así la suite dice lo mismo en
// cualquier huso del banco.
function congelar(c, epoch) {
  c.env.win.Date = class extends Date {
    static now() { return epoch; }
    constructor(...a) { if (a.length === 0) super(epoch); else super(...a); }
  };
  c.ctx.Date = c.env.win.Date;
}

module.exports = {
  nombre: "Excel, caché y base única",
  cubre: [
    "findDocIdx", "esAplicaPendiente", "makeProcexIndexer", "spFallbackUrls",
    "bogotaAhora", "baseVentanaRefresco", "baseLog", "_vglPurgarCacheDiariaLegacy",
    "packPym", "unpackPym", "esLibroValido", "esXlsxCifrado", "mtrLibroNoParecePym",
  ],

  async pruebas(t, api, env, cargar) {

    // =====================================================================
    //  findDocIdx — la columna del documento, con las lecciones de la
    //  auditoría de la base SEPTIEMBRE1 (2026-09-07).
    // =====================================================================

    // H3 de la auditoría: la hoja PROCEXDT trae «NRO IDENTIFICACION» — con
    // espacio, así, como lo escribe quien armó el libro. Antes de v18.6.0 ese
    // encabezado no estaba en DOC_EXACT y el fallback blando se quedaba con la
    // PRIMERA columna que contuviera «DOCUMENTO»… que era TIPO_DOCUMENTO (el
    // TIPO: "CC", "TI"), no el número. El índice salía con claves basura y el
    // cruce con la agenda fallaba en silencio.
    t.caso("findDocIdx: «NRO IDENTIFICACION» con espacio calza EXACTO por la normalización (\\s+ → _)", () => {
      t.igual(api.findDocIdx(["NOMBRE", "NRO IDENTIFICACION"]), 1,
        "el espacio se normaliza a «_» antes de comparar contra NRO_IDENTIFICACION");
      t.igual(api.findDocIdx(["NRO  IDENTIFICACION", "NOMBRE"]), 0,
        "y con doble espacio también: colapsar espacios repetidos es parte del arreglo");
    });

    t.caso("findDocIdx: con TIPO_DOCUMENTO ANTES que NRO IDENTIFICACION, gana NRO — nunca la columna del TIPO", () => {
      // El orden real de «CITASDIA AGOSTO»: el TIPO de documento aparece primero
      // en la hoja. La coincidencia exacta por DOC_EXACT mira el CONTENIDO, no
      // la posición, así que NRO_IDENTIFICACION (index 1) gana aunque TIPO_DOCUMENTO
      // (index 0) también contenga la palabra DOCUMENTO.
      t.igual(api.findDocIdx(["TIPO_DOCUMENTO", "NRO IDENTIFICACION"]), 1,
        "elige el número, no el tipo");
      t.igual(api.findDocIdx(["TIPO DOCUMENTO", "NRO IDENTIFICACION", "NOMBRE"]), 1,
        "con espacio o con guion bajo, el TIPO nunca es la columna del documento");
    });

    // v18.0.45 — hallazgo del enjambre (01-sep): esta función NO quitaba tildes
    // y «CÉDULA» —la ortografía correcta en español, y la que cualquiera
    // escribiría— fallaba las dos vías. Un médico con esa columna en su base
    // quedaba SIN módulo de Actividades Preventivas la jornada entera.
    t.caso("findDocIdx: «CÉDULA» con tilde sigue funcionando (v18.0.45)", () => {
      t.igual(api.findDocIdx(["CÉDULA", "NOMBRE"]), 0);
      t.igual(api.findDocIdx(["NOMBRE", "Cédula"]), 1, "y en minúsculas también: la comparación es tras UPPER");
    });

    t.caso("findDocIdx: IDENTIFICACION_PACIENTE calza exacto (espacios internos colapsados)", () => {
      t.igual(api.findDocIdx(["IDENTIFICACION PACIENTE", "NOMBRE"]), 0);
      t.igual(api.findDocIdx(["NOMBRE", "IDENTIFICACION_PACIENTE"]), 1, "y escrito con guion bajo, idéntico");
    });

    t.caso("findDocIdx: el orden de DOC_EXACT manda cuando hay varios candidatos exactos", () => {
      // CEDULA aparece ANTES que NRO_IDENTIFICACION en DOC_EXACT, así que con
      // ambas columnas presentes gana la cédula aunque esté más a la derecha.
      // Es deliberado (orden documentado del contrato), no un empate al azar.
      t.igual(api.findDocIdx(["NRO IDENTIFICACION", "CEDULA"]), 1,
        "gana CEDULA: indexOf por orden de DOC_EXACT, no la primera columna de la hoja");
    });

    t.caso("findDocIdx: el fallback blando ignora las columnas que EMPIEZAN por TIPO_", () => {
      // El espejo del hallazgo H3 sin la vía exacta disponible: si la hoja solo
      // tiene el TIPO del documento, es mejor NO encontrar columna (y que el
      // indexador lance su error clásico) que indexar "CC"/"TI" como si fueran
      // cédulas — eso cruza mal y en silencio.
      t.igual(api.findDocIdx(["TIPO DOCUMENTO", "NOMBRE"]), -1,
        "una hoja cuyo único «documento» es el TIPO no tiene columna de documento");
      // Y el fallback blando de siempre sigue vivo para el resto:
      t.igual(api.findDocIdx(["NOMBRE", "NO. DOCUMENTO PACIENTE"]), 1,
        "una columna de documento con otro nombre se reconoce por contenido");
    });

    // =====================================================================
    //  esAplicaPendiente — el idioma de la hoja de tamizaciones.
    // =====================================================================

    // v18.6.0 (opción B confirmada por el médico): en la hoja PROCEX,
    // «Aplica Cobertura/Fenix …» = el paciente REQUIERE la tamización;
    // «Con Tamizacion vigente» o «No Aplica» = nada que hacer. Es el
    // equivalente del «Susceptible» del extinto archivo diario, en otro
    // idioma — confundirlos significaría sugerir exámenes que no corresponden.
    t.caso("esAplicaPendiente: «Aplica …» SÍ; vigente o «No Aplica» NO", () => {
      t.cierto(api.esAplicaPendiente("Aplica Cobertura VPH"), "el vocabulario de cobertura: pendiente");
      t.cierto(api.esAplicaPendiente("  APLICA FENIX VPH  "), "mayúsculas, espacios y tilde no salvan al valor");
      t.falso(api.esAplicaPendiente("Con Tamizacion vigente"), "ya la tiene: nada que ordenar");
      t.falso(api.esAplicaPendiente("No Aplica"), "no le corresponde");
      t.falso(api.esAplicaPendiente(null), "null jamás es pendiente");
      t.falso(api.esAplicaPendiente(undefined), "undefined tampoco");
      t.falso(api.esAplicaPendiente(""), "celda vacía tampoco");
    });

    t.caso("esAplicaPendiente: el borde de 40 caracteres y el espacio tras «aplica»", () => {
      // >40 chars: una celda que diga tanto no es un estado de tamización, es
      // un párrafo (observación clínica, nota del digitador…). Cortar ahí
      // evita que cualquier texto que empiece por «aplica » se tome por orden.
      t.cierto(api.esAplicaPendiente("aplica " + "x".repeat(33)), "exactamente 40 caracteres: aún vale");
      t.falso(api.esAplicaPendiente("aplica " + "x".repeat(34)), "41 caracteres: ya no");
      t.falso(api.esAplicaPendiente("aplica"), "sin el espacio tras «aplica» no calza («aplicar», «aplicante»…)");
      t.falso(api.esAplicaPendiente("reaplica cobertura"), "y solo vale como PREFIJO, no embebido");
    });

    // =====================================================================
    //  makeProcexIndexer — encabezados sintéticos de la hoja de tamizaciones.
    // =====================================================================

    t.caso("makeProcexIndexer: traduce el vocabulario «Aplica …» a las etiquetas de siempre", () => {
      const idx = api.makeProcexIndexer(["NRO IDENTIFICACION", "CERVIX", "MAMA", "PSA", "SOMF"]);
      // Cédulas sintéticas (regla del proyecto: cero datos reales).
      idx.push(["5150076", "Aplica Fenix VPH", "", "", ""]);
      idx.push(["99887766", "Aplica Cobertura CCU", "Aplica Cobertura", "Aplica Cobertura", "Aplica Cobertura"]);
      idx.push(["11223344", "Con Tamizacion vigente", "No Aplica", "Con Tamizacion vigente", "No Aplica"]);

      // CERVIX refina el tipo de prueba reutilizando detalleTipoCervix (VPH
      // vs citología), igual que la fusión de PRUEBA_CERVIX de siempre.
      t.igual(idx.map.get("5150076"), ["Cáncer de cuello uterino — VPH"]);
      t.igual(idx.map.get("99887766"),
        ["Cáncer de cuello uterino — citología cervicouterina", "Mamografía", "PSA (antígeno de próstata)", "SOMF (sangre oculta en materia fecal)"],
        "las etiquetas son las del diccionario FRIENDLY, con el orden de las columnas");

      // «Con Tamizacion vigente» / «No Aplica» NO generan actividad: la regla
      // de oro del proyecto (casilla vacía antes que dato inventado) también
      // corre al revés — nada pendiente no se rellena con nada.
      t.falso(idx.map.has("11223344"), "sin «Aplica» no hay bucket");
      t.cierto(idx.todos.has("11223344"), "pero el documento SÍ queda en el universo de la hoja");

      // Sin documento no hay paciente: ni bucket ni universo.
      idx.push(["", "Aplica Fenix VPH", "Aplica Cobertura", "Aplica Cobertura", "Aplica Cobertura"]);
      t.falso([...idx.todos].includes(""), "una fila sin identificación no entra ni a «todos»");
    });

    t.caso("makeProcexIndexer: una columna que NO es de tamización no genera nada, aunque su texto diga «Aplica»", () => {
      const idx = api.makeProcexIndexer(["NRO IDENTIFICACION", "NOMBRE COMPLETO", "MAMA"]);
      idx.push(["5150076", "Aplica Cobertura", "No Aplica"]);
      t.igual(idx.map.size, 0,
        "solo CERVIX/MAMA/PSA/SOMF (y sus alias) se leen: un «Aplica» en el nombre es texto, no una orden");
    });

    t.caso("makeProcexIndexer: reconoce los alias TAMIZACION_CERVIX/MAMA/PROSTATA/COLON y SANGRE_OCULTA", () => {
      // La hoja real puede traer los encabezados largos del formato viejo: el
      // indexador los colapsa a los cuatro tipos, con espacio o con guion bajo.
      const idx = api.makeProcexIndexer(["NRO IDENTIFICACION", "TAMIZACION CERVIX", "TAMIZACION_MAMA", "TAMIZACION PROSTATA", "SANGRE OCULTA"]);
      idx.push(["99887766", "Aplica Fenix VPH", "Aplica Cobertura", "Aplica Cobertura", "Aplica Cobertura"]);
      t.igual(idx.map.get("99887766"),
        ["Cáncer de cuello uterino — VPH", "Mamografía", "PSA (antígeno de próstata)", "SOMF (sangre oculta en materia fecal)"]);
    });

    t.caso("makeProcexIndexer: buckets con DEDUP — dos columnas o dos filas no duplican la etiqueta", () => {
      // La fusión (unión de hojas con buckets dedup) es la que evita que un
      // paciente aparezca con «Mamografía» dos veces en el aviso solo porque
      // el libro la repite en CERVIX y TAMIZACION_CERVIX. Aquí se prueba el
      // dedup del bucket en su origen: el propio indexer.
      const idx = api.makeProcexIndexer(["NRO IDENTIFICACION", "CERVIX", "TAMIZACION CERVIX"]);
      idx.push(["5150076", "Aplica Fenix VPH", "Aplica Fenix VPH 2026"]);
      t.igual(idx.map.get("5150076"), ["Cáncer de cuello uterino — VPH"],
        "dos valores que refinan al MISMO tipo de prueba dejan UNA sola etiqueta");
      idx.push(["5150076", "Aplica Fenix VPH", ""]);
      t.igual(idx.map.get("5150076").length, 1, "y re-push de la misma paciente tampoco duplica");
    });

    t.caso("makeProcexIndexer: sin columna de identificación lanza el error clásico", () => {
      t.lanza(() => api.makeProcexIndexer(["NOMBRE", "EDAD", "CERVIX"]),
        "sin columna de documento el indexador no puede construir claves");
      let msg = "";
      try { api.makeProcexIndexer(["TIPO DOCUMENTO", "CERVIX"]); } catch (e) { msg = e.message; }
      t.cierto(/No se encontró la columna con la identificaci[oó]n del paciente/i.test(msg),
        "el mensaje es el de siempre, el que el médico ya sabe leer · " + msg);
    });

    // =====================================================================
    //  spFallbackUrls — exactamente DOS vías por GUID.
    // =====================================================================

    // v18.0.5 añadió una TERCERA vía por shareId; v18.6.0 la RETIRA: el
    // shareId configurado apuntaba a la base de MAYO y, con la base única de
    // septiembre, una tercera vía viva podría entregar el libro de un mes
    // pasado cuando las dos por GUID fallaran — datos viejos presentados como
    // actuales, lo peor que puede pasar en consulta. Esta prueba fija que la
    // tercera vía NO existe, aunque alguien vuelva a configurar un shareId.
    t.caso("spFallbackUrls: EXACTAMENTE 2 URLs, GUID normalizado en minúsculas y sin llaves", () => {
      const urls = api.spFallbackUrls("{6594B356-F608-4C56-BB6F-6A90F2125A3F}");
      t.igual(urls.length, 2, "dos vías y ni una más");
      t.igual(urls[0], SP_BASE + "/_api/web/GetFileById('" + GUID_BASE + "')/$value");
      t.igual(urls[1], SP_BASE + "/_layouts/15/download.aspx?UniqueId=" + GUID_BASE);
      t.falso(urls.some((u) => /shareid|GetFileByServerRelativeUrl|GetFolderByServerRelativeUrl/i.test(u)),
        "ningún mecanismo de listado ni de shareId sobrevive en las URLs");
    });

    t.caso("spFallbackUrls: ni un shareId configurado resucita la tercera vía (v18.6.0)", () => {
      const c = cargar({ silencioso: true });
      // Se inyecta a propósito el shareId VIEJO (el de la base de mayo): si la
      // tercera vía volviera a existir, esta configuración la encendería.
      c.api.__CONFIG.SP.base.shareId = "{2BD8F42A-F8F5-46E0-B2E1-B1D2E5FA5D4F}";
      const urls = c.api.spFallbackUrls(GUID_BASE);
      t.igual(urls.length, 2, "la función ya no lee shareId: la base se direcciona por GUID, punto");
      t.falso(urls.some((u) => u.indexOf("2bd8f42a") >= 0), "el GUID de mayo no aparece por ningún lado");
    });

    // =====================================================================
    //  bogotaAhora + baseVentanaRefresco — el reloj UTC-5 fijo.
    // =====================================================================

    // Mandato del médico (07-sep): refrescos a las 06:00 y a las 12:00 de
    // BOGOTÁ. Bogotá es UTC-5 fijo (Colombia no tiene horario de verano), así
    // que el reloj se calcula desde UTC y NO depende del huso del equipo: un
    // portátil en otra zona no puede adelantar ni saltarse el refresco. Se
    // congela Date para recorrer el día minuto a minuto.
    t.caso("ventana de refresco: 05:59 aún no abre — sello «|pre» y toca:false", () => {
      const c = cargar({ silencioso: true });
      congelar(c, Date.UTC(2026, 8, 7, 10, 59, 0));       // 05:59 Bogotá
      t.igual(c.api.bogotaAhora(), { dia: "2026-09-07", hora: 5 + 59 / 60 });
      t.igual(c.api.baseVentanaRefresco(), { sello: "2026-09-07|pre", toca: false },
        "antes de las 06:00 manda la copia guardada, sin tocar la red");
    });

    t.caso("ventana de refresco: 06:00 en punto abre la mañana — sello «dia|0», toca:true", () => {
      const c = cargar({ silencioso: true });
      congelar(c, Date.UTC(2026, 8, 7, 11, 0, 0));        // 06:00 Bogotá
      t.igual(c.api.bogotaAhora(), { dia: "2026-09-07", hora: 6 });
      t.igual(c.api.baseVentanaRefresco(), { sello: "2026-09-07|0", toca: true });
    });

    t.caso("ventana de refresco: 11:59 sigue en la MISMA ventana de la mañana (sin re-sellar)", () => {
      const c = cargar({ silencioso: true });
      congelar(c, Date.UTC(2026, 8, 7, 11, 0, 0));
      const sello0600 = c.api.baseVentanaRefresco().sello;
      congelar(c, Date.UTC(2026, 8, 7, 16, 59, 0));       // 11:59 Bogotá
      const v = c.api.baseVentanaRefresco();
      t.igual(v, { sello: "2026-09-07|0", toca: true });
      t.igual(v.sello, sello0600,
        "el sello de las 06:00 sigue siendo el vigente a las 11:59: mientras el stamp de GM coincida, el minutero NO vuelve a pagar la meta de 1 KB");
    });

    t.caso("ventana de refresco: 12:00 abre la tarde — sello «dia|1» — y 23:59 sigue en ella", () => {
      const c = cargar({ silencioso: true });
      congelar(c, Date.UTC(2026, 8, 7, 17, 0, 0));        // 12:00 Bogotá
      t.igual(c.api.bogotaAhora(), { dia: "2026-09-07", hora: 12 });
      t.igual(c.api.baseVentanaRefresco(), { sello: "2026-09-07|1", toca: true });
      congelar(c, Date.UTC(2026, 8, 8, 4, 59, 0));        // 23:59 Bogotá del MISMO día (UTC ya rodó)
      t.igual(c.api.bogotaAhora(), { dia: "2026-09-07", hora: 23 + 59 / 60 },
        "la fecha es la de Bogotá, no la de UTC: a las 23:59 locales UTC ya es mañana");
      t.igual(c.api.baseVentanaRefresco(), { sello: "2026-09-07|1", toca: true },
        "la ventana de la tarde es la última del día");
    });

    t.caso("ventana de refresco: la medianoche rueda el día y vuelve a «pre»", () => {
      const c = cargar({ silencioso: true });
      congelar(c, Date.UTC(2026, 8, 8, 5, 0, 0));         // 00:00 Bogotá del 08-sep
      t.igual(c.api.baseVentanaRefresco(), { sello: "2026-09-08|pre", toca: false },
        "día nuevo, ventana cerrada: el sello del día anterior no puede colarse");
    });

    t.caso("ventana de refresco: el índice del sello es el del arreglo ORDENADO, no el de configuración", () => {
      const c = cargar({ silencioso: true });
      // Si alguien escribe [12, 6] desordenado en la configuración, el índice
      // (0=mañana, 1=tarde) no puede voltearse: el sello vive para compararse
      // contra el stamp guardado, y cambiar de significado lo invalidaría.
      c.api.__CONFIG.SP.base.horasRefresco = [12, 6];
      congelar(c, Date.UTC(2026, 8, 7, 11, 30, 0));       // 06:30 Bogotá
      t.igual(c.api.baseVentanaRefresco().sello, "2026-09-07|0", "06:30 = índice 0 aunque 6 venga después en el arreglo");
      congelar(c, Date.UTC(2026, 8, 7, 17, 30, 0));       // 12:30 Bogotá
      t.igual(c.api.baseVentanaRefresco().sello, "2026-09-07|1");
    });

    t.caso("bogotaAhora NO depende del huso del equipo: con el host en Tokio (UTC+9) sigue diciendo la hora de Bogotá", () => {
      // El runner fija TZ=America/Bogota, así que aquí no se puede simular un
      // host en otra zona dentro del propio proceso: se levanta un proceso
      // hijo con TZ=Asia/Tokyo que carga el userscript fresco, congela el
      // MISMO instante (11:00Z = 06:00 Bogotá = 20:00 Tokio) y reporta.
      // El canary local del hijo (getHours) demuestra que el huso del host
      // SÍ quedó en Tokio: sin él, un TZ ignorado en silencio haría pasar
      // esta prueba mintiendo (hora local = hora Bogotá por el runner).
      const rutaHarness = path.join(__dirname, "harness.js");
      const E = Date.UTC(2026, 8, 7, 11, 0, 0);
      const guion = [
        "const { cargar } = require(" + JSON.stringify(rutaHarness) + ");",
        "const c = cargar({ silencioso: true });",
        "const E = " + E + ";",
        "c.env.win.Date = class extends Date { static now() { return E; } constructor(...a) { if (a.length === 0) super(E); else super(...a); } };",
        "c.ctx.Date = c.env.win.Date;",
        "console.log(JSON.stringify({ ahora: c.api.bogotaAhora(), ventana: c.api.baseVentanaRefresco(), canaryLocal: new Date(E).getHours() }));",
      ].join("\n");
      const out = execFileSync(process.execPath, ["-e", guion],
        { env: Object.assign({}, process.env, { TZ: "Asia/Tokyo" }), encoding: "utf8", timeout: 60000 });
      const r = JSON.parse(String(out).trim());
      t.igual(r.canaryLocal, 20, "control del escenario: el host del hijo SÍ está en Tokio (20:00 local)");
      t.igual(r.ahora, { dia: "2026-09-07", hora: 6 },
        "un reloj de equipo en otra zona no adelanta ni atrasa la ventana de Bogotá");
      t.igual(r.ventana, { sello: "2026-09-07|0", toca: true });
    });

    // =====================================================================
    //  baseLog — el anillo de mantenimiento del médico.
    // =====================================================================

    // Requisito de mantenimiento (v18.6.0): cada intento de la base deja UNA
    // fila con fase/duración/resultado. Anillo FIFO de 60 filas, recortado en
    // cada escritura: por muchos reintentos que haya en un mal día de red, el
    // almacén de Tampermonkey no crece sin cota.
    t.caso("baseLog: anillo FIFO — 65 entradas dejan las últimas 60, las 5 primeras se caen", () => {
      const c = cargar({ silencioso: true });
      for (let i = 0; i < 65; i++) c.api.baseLog({ fase: "f" + i, ok: true });
      const arr = JSON.parse(c.env.gm["vgl_base_log"]);
      t.igual(arr.length, 60, "el anillo se recorta a 60 en cada escritura");
      t.igual(arr[0].fase, "f5", "la más vieja sobreviviente es la sexta: FIFO");
      t.igual(arr[59].fase, "f64", "y la última siempre está");
      t.cierto(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(arr[0].t), "cada fila lleva su marca de tiempo ISO");
      t.cierto(!isNaN(new Date(arr[0].t).getTime()), "y es una fecha de verdad, no solo un parecido");
    });

    t.caso("baseLog: la fila lleva EXACTAMENTE lo que le pasan más «t» — SIN PHI por construcción", () => {
      const c = cargar({ silencioso: true });
      c.api.baseLog({ fase: "meta", ok: true, ms: 12 });
      const arr = JSON.parse(c.env.gm["vgl_base_log"]);
      t.igual(Object.keys(arr[0]).sort(), ["fase", "ms", "ok", "t"],
        "ni el paciente ni la cédula caben aquí: la función no añade nada que no le manden");
    });

    t.caso("baseLog: JSON roto o que no es arreglo arranca de [] en vez de morir", () => {
      // El almacén de Tampermonkey es un agujero negro conocido: si un día
      // queda media escritura (PC apagada a mitad de GM_setValue), el log no
      // puede dejar de funcionar para siempre por eso.
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_base_log"] = '{"v":3 ESTO NO ES JSON';
      c.api.baseLog({ fase: "descarga", ok: false, err: "x" });
      let arr = JSON.parse(c.env.gm["vgl_base_log"]);
      t.igual(arr.length, 1, "JSON roto: arranca de [] y la fila nueva queda");
      c.env.gm["vgl_base_log"] = '{"v":3}';                // JSON válido pero no es arreglo
      c.api.baseLog({ fase: "meta", ok: true });
      arr = JSON.parse(c.env.gm["vgl_base_log"]);
      t.igual(arr.length, 1, "un objeto suelto donde iba el arreglo: también se reinicia");
    });

    // =====================================================================
    //  _vglPurgarCacheDiariaLegacy — devolverle el espacio a Tampermonkey.
    // =====================================================================

    // v18.6.0: las claves del archivo diario (vgl_pym de hasta 12 MB, su
    // marca de día y su bandera de fallback) ya no se escriben ni se leen.
    // Se borran UNA vez al arrancar para que ningún pedazo de dato de
    // jornadas pasadas sobre viva en el almacén.
    t.caso("_vglPurgarCacheDiariaLegacy: borra las 3 claves GM viejas y el localStorage vgl_pym_dia", () => {
      const c = cargar({ silencioso: true });
      c.env.gm["vgl_pym"] = "x".repeat(500);
      c.env.gm["vgl_pym_dia"] = "2026-09-06";
      c.env.gm["vgl_pym_esfallback"] = "1";
      c.env.storage.setItem("vgl_pym_dia", "2026-09-06");
      // La clave de la base NUEVA tiene que salir intacta: la purga es de lo
      // viejo, no una escoba general.
      c.env.gm["vgl_piloto"] = "PAQUETE_V3";
      c.api._vglPurgarCacheDiariaLegacy();
      t.falso("vgl_pym" in c.env.gm, "GM_deleteValue se llevó vgl_pym");
      t.falso("vgl_pym_dia" in c.env.gm, "y vgl_pym_dia");
      t.falso("vgl_pym_esfallback" in c.env.gm, "y vgl_pym_esfallback");
      t.igual(c.env.storage.getItem("vgl_pym_dia"), null, "el localStorage también queda limpio");
      t.igual(c.env.gm["vgl_piloto"], "PAQUETE_V3", "el caché vgl_piloto de la base única NO se toca");
    });

    t.caso("_vglPurgarCacheDiariaLegacy: sin GM_deleteValue cae a GM_setValue(\"\") — mismo efecto visible", () => {
      // Navegador sin GM_deleteValue (o permiso no concedido): la vía de
      // respaldo vacía las claves en vez de borrarlas, para que ninguna
      // lectura posterior las encuentre con contenido.
      const c = cargar({ silencioso: true });
      delete c.env.win.GM_deleteValue;
      c.env.gm["vgl_pym"] = "x";
      c.env.gm["vgl_pym_dia"] = "2026-09-06";
      c.env.gm["vgl_pym_esfallback"] = "1";
      c.api._vglPurgarCacheDiariaLegacy();
      t.igual(c.env.gm["vgl_pym"], "", "vacía, no borrada");
      t.igual(c.env.gm["vgl_pym_dia"], "");
      t.igual(c.env.gm["vgl_pym_esfallback"], "");
    });

    // =====================================================================
    //  mtrLibroNoParecePym — la guarda del libro equivocado (sobrevivió).
    // =====================================================================

    // REPORTE EN VIVO (31-ago): «ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx»
    // se leyó completo (1.396 documentos, columna de documento encontrada)
    // pero con CERO actividades pendientes — era OTRO libro, y el aviso mudo
    // era indistinguible de «este paciente no tiene nada pendiente». La
    // guarda sigue viva en v18.6.0 (applyPymIdx la consulta): un libro con
    // muchos documentos y cero pendientes no se instala.
    t.caso("mtrLibroNoParecePym: muchos documentos y CERO pendientes es OTRO libro", () => {
      const mapa = (n) => { const m = new Map(); for (let i = 0; i < n; i++) m.set("d" + i, ["x"]); return m; };
      const docs = (n) => { const s2 = new Set(); for (let i = 0; i < n; i++) s2.add("d" + i); return s2; };
      t.cierto(api.mtrLibroNoParecePym({ todos: docs(1396), map: new Map() }),
        "el caso real del 31-ago: 1.396 documentos, 0 pacientes con pendientes");
      t.falso(api.mtrLibroNoParecePym({ todos: docs(1396), map: mapa(1) }),
        "con UN solo paciente pendiente ya es un PyM plausible: no se rechaza");
      t.falso(api.mtrLibroNoParecePym({ todos: docs(10), map: new Map() }),
        "una hoja pequeña y de verdad al día NO se rechaza — el corte es alto a propósito");
      t.falso(api.mtrLibroNoParecePym(null), "sin índice no se afirma nada");
    });

    // ---------- esLibroValido / esXlsxCifrado (sobrevivieron) ----------
    t.caso("esLibroValido verifica cabecera ZIP (PK) y deja pasar el CSV", () => {
      t.cierto(api.esLibroValido(new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00]).buffer, "base.xlsx"));
      t.falso(api.esLibroValido(new Uint8Array([0x00, 0x00, 0x00]).buffer, "base.xlsx"),
        "SharePoint devolviendo su página de login con 200 se cae la careta aquí");
      t.cierto(api.esLibroValido(new Uint8Array([0x3F]).buffer, "lista.csv"), "un CSV no es ZIP: siempre válido");
    });

    t.caso("esXlsxCifrado verifica cabecera OLE (D0 CF 11 E0) del libro con contraseña", () => {
      // Un .xlsx protegido no es un ZIP: es un contenedor OLE cifrado. Se
      // distingue para que el aviso diga la verdad (quitar la contraseña) en
      // vez de mandar a reabrir sesión sin motivo.
      t.cierto(api.esXlsxCifrado(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]).buffer));
      t.falso(api.esXlsxCifrado(new Uint8Array([0x50, 0x4B, 0x03, 0x04]).buffer), "un ZIP normal no es cifrado");
      t.falso(api.esXlsxCifrado(new Uint8Array([0xD0, 0xCF]).buffer), "menos de 8 bytes no alcanzan ni para la firma");
    });

    // ---------- packPym / unpackPym: el formato del caché (v4 desde 18.6.1; v3 se acepta) ----------
    await t.casoAsync("packPym comprime y unpackPym expande los mapas de PyM (ida y vuelta v4 con Anexo 5)", async () => {
      const map = new Map();
      map.set("5150076", ["Mamografía", "PSA (antígeno de próstata)"]);
      map.set("99887766", ["Mamografía"]);
      const todos = new Set(["5150076", "99887766", "777"]);
      const abandono = new Set(["777"]);
      const meta = { date: "2026-09-07", name: "BASE PILOTO DE CONSULTA  BELLO SEPTIEMBRE1.xlsx", mtime: "2026-09-07T06:00:00Z", id: GUID_BASE };

      const packed = await api.packPym(map, todos, abandono, meta);
      t.cierto(typeof packed === "string");
      t.cierto(packed.lastIndexOf('{"v":4', 0) === 0, "v18.6.1: el paquete v4 empieza por su prefijo: lo primero que mira pilotoDesdeCache");
      t.cierto(JSON.parse(packed).a5 === "", "sin Anexo 5 el campo viaja vacío, no ausente");

      const u = await api.unpackPym(packed);
      t.cierto(u !== null);
      t.igual(u.map.size, 2);
      t.igual(u.map.get("5150076"), ["Mamografía", "PSA (antígeno de próstata)"]);
      t.igual(u.map.get("99887766"), ["Mamografía"]);
      t.cierto(u.todos.has("777"));
      t.igual(u.todos.size, 3);
      t.cierto(u.abandono.has("777"));
      t.igual(u.meta.date, "2026-09-07");
      t.igual(u.meta.mtime, "2026-09-07T06:00:00Z");
      t.igual(u.meta.id, GUID_BASE, "el id viaja: si cambia el GUID configurado, la caché vieja se purga sola");
    });

    await t.casoAsync("unpackPym descarta paquetes con formato antiguo (no v3)", async () => {
      t.igual(await api.unpackPym(JSON.stringify({ v: 2, data: "old" })), null,
        "la caché de una versión anterior no se readmite: se descarta sin interpretar");
    });
  }
};
