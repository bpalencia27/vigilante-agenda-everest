// =====================================================================
//  SUITE 10 — Estadísticas, eventos y auditoría
//  Cubre la caja negra (vglLog/vglExportLogs), los contadores por día
//  (allStats/statsToday/bumpStat/purgeOld/lastDays) y la bitácora de
//  eventos con su exportación CSV (evKey/logEvent/evFlush/eventsOf/
//  purgeEventDays/downloadBlob/exportAudit).
//
//  Todo el estado vive en localStorage simulado: cada grupo usa un
//  cargar() fresco para no contaminar a las demás suites.
// =====================================================================

const FLIGHT_KEY = "vgl_flight_recorder_logs";
const STATS_KEY = "vgl_stats";

// Sello YYYY-MM-DD desplazado N días desde hoy, con la misma aritmética
// local que usa todayStamp() dentro del userscript.
function sello(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDias || 0));
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function leerJSON(c, clave) {
  const raw = c.env.storage.getItem(clave);
  return raw ? JSON.parse(raw) : null;
}

module.exports = {
  nombre: "Estadísticas, eventos y auditoría",
  cubre: [
    "vglLog", "vglExportLogs",
    "allStats", "statsToday", "bumpStat", "purgeOld", "lastDays",
    "evKey", "logEvent", "evFlush", "eventsOf", "purgeEventDays",
    "downloadBlob", "exportAudit",
  ],

  pruebas(t, api, env, cargar) {

    // ---------- vglLog: caja negra en localStorage ----------
    t.caso("vglLog: guarda la entrada con categoría, acción y detalles", () => {
      const c = cargar({ silencioso: true });
      c.api.vglLog("NAV", "UrlChanged", { seccion: "agenda" });
      const logs = leerJSON(c, FLIGHT_KEY);
      t.igual(logs.length, 1);
      t.igual(logs[0].cat, "NAV");
      t.igual(logs[0].act, "UrlChanged");
      t.igual(logs[0].det, { seccion: "agenda" });
      t.cierto(/^\d{4}-\d{2}-\d{2}T/.test(logs[0].ts), "ts debe ser ISO");
    });

    t.caso("vglLog: censura documentos en textos y números grandes (PII)", () => {
      const c = cargar({ silencioso: true });
      c.api.vglLog("PATIENT", "Fetch", {
        texto: "cc 1234567890 fin",   // 10 dígitos dentro de un texto
        docNum: 1234567,              // número > 99999 -> se censura como texto
        borde: 99999,                 // 5 dígitos: NO se censura
        justo: 100000,                // 6 dígitos: SÍ se censura
        corto: "12345",               // 5 dígitos en texto: se conserva
        activo: true,                 // ni texto ni número: pasa tal cual
      });
      const det = leerJSON(c, FLIGHT_KEY)[0].det;
      t.igual(det.texto, "cc [CENSURADO] fin");
      t.igual(det.docNum, "[CENSURADO]");
      t.igual(det.borde, 99999);
      t.igual(det.justo, "[CENSURADO]");
      t.igual(det.corto, "12345");
      t.igual(det.activo, true);
    });

    t.caso("vglLog: si la bitácora guardada está corrupta arranca limpia", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.setItem(FLIGHT_KEY, "{{{esto no es JSON");
      c.api.vglLog("ERROR", "Prueba", {});
      const logs = leerJSON(c, FLIGHT_KEY);
      t.igual(logs.length, 1);
      t.igual(logs[0].act, "Prueba");
    });

    t.caso("vglLog: tope de 500 entradas, conserva las más recientes", () => {
      const c = cargar({ silencioso: true });
      for (let i = 0; i < 505; i++) c.api.vglLog("PERF", "N" + i);
      const logs = leerJSON(c, FLIGHT_KEY);
      t.igual(logs.length, 500);
      t.igual(logs[0].act, "N5");            // las 5 primeras se descartaron
      t.igual(logs[499].act, "N504");
    });

    // ---------- vglExportLogs: descarga del reporte JSON ----------
    t.caso("vglExportLogs: arma el reporte con meta y descarga vía ancla", () => {
      const c = cargar({ silencioso: true });
      const blobs = [], alertas = [];
      c.ctx.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; blobs.push(this); };
      c.ctx.URL = { createObjectURL: () => "blob:reporte", revokeObjectURL() {} };
      c.ctx.alert = (m) => alertas.push(String(m));

      // vglExportLogs hace appendChild + click + remove() en el mismo tick (patrón real y
      // correcto de descarga por ancla efímera): con remove() ya funcionando de verdad en el
      // arnés, el ancla ya no está en body.children para cuando el test la busca ahí. Se
      // captura en el momento de la creación, no después de que la función ya la limpió.
      let ancla = null;
      const crearOriginal = c.env.doc.createElement;
      c.env.doc.createElement = (tag) => {
        const el = crearOriginal(tag);
        if (String(tag).toLowerCase() === "a") {
          ancla = el;
          el.click = () => { el._clicks = (el._clicks || 0) + 1; };
        }
        return el;
      };

      c.api.vglLog("NAV", "Uno", {});
      c.api.vglLog("NAV", "Dos", {});
      c.api.vglExportLogs();

      t.igual(blobs.length, 1, "debe crear un solo Blob");
      const reporte = JSON.parse(blobs[0].parts[0]);
      t.igual(reporte.meta.totalEntries, 2);
      t.igual(reporte.logs.length, 2);
      t.igual(reporte.logs[1].act, "Dos");
      t.cierto(typeof reporte.meta.version === "string" && reporte.meta.version.length > 0);

      t.cierto(!!ancla, "debe añadir un ancla al body");
      t.cierto(ancla.download.indexOf("BITACORA_VIGILANTE_REAL_") === 0, "nombre del archivo");
      t.igual(ancla.href, "blob:reporte");
      t.igual(ancla._clicks, 1, "el ancla se clickeó (descarga disparada)");
      // v17.x — el aviso de éxito va al toast (showToast), no al alert() del navegador: la
      // rama de éxito quedó probada por el flujo completo (blob + ancla + click).
      t.igual(alertas.length, 0, "v17.x — la rama de éxito ya no usa alert() (aviso por toast)");
    });

    // ---------- allStats / statsToday ----------
    t.caso("allStats/statsToday: sin datos devuelven {} y contadores en cero", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.allStats(), {});
      t.igual(c.api.statsToday(), { fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 });
    });

    t.caso("allStats: JSON corrupto en el almacén devuelve {} sin lanzar", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.setItem(STATS_KEY, "no es json");
      t.igual(c.api.allStats(), {});
    });

    // ---------- bumpStat ----------
    t.caso("bumpStat: incrementa el contador de hoy y lo persiste", () => {
      const c = cargar({ silencioso: true });
      c.api.bumpStat("fraude");
      c.api.bumpStat("fraude");
      c.api.bumpStat("atiempo");
      const hoy = c.api.statsToday();
      t.igual(hoy.fraude, 2);
      t.igual(hoy.atiempo, 1);
      t.igual(hoy.inasistencia, 0);
      // y quedó escrito de verdad en localStorage, no solo en memoria
      t.igual(leerJSON(c, STATS_KEY)[sello(0)].fraude, 2);
    });

    t.caso("bumpStat: al escribir purga los días de hace más de 30 días", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.setItem(STATS_KEY, JSON.stringify({
        "2019-01-01": { fraude: 9, inasistencia: 0, atiempo: 0, ultima: 0 },
      }));
      c.api.bumpStat("inasistencia");
      const a = c.api.allStats();
      t.falso("2019-01-01" in a, "el día viejo debe desaparecer");
      t.igual(a[sello(0)].inasistencia, 1);
    });

    // ---------- purgeOld ----------
    t.caso("purgeOld: borra fechas viejas e inválidas y conserva las recientes", () => {
      const obj = {
        "2020-01-01": { fraude: 1 },        // vieja: fuera
        "fecha-corrupta": { fraude: 2 },    // inválida: fuera
      };
      obj[sello(0)] = { fraude: 3 };        // hoy: se queda
      obj[sello(-1)] = { fraude: 4 };       // ayer: se queda
      api.purgeOld(obj);
      const claves = Object.keys(obj).sort();
      t.igual(claves, [sello(-1), sello(0)].sort());
    });

    // ---------- lastDays ----------
    t.caso("lastDays: n días terminando hoy, rellenos con ceros", () => {
      const c = cargar({ silencioso: true });
      const dias = c.api.lastDays(3);
      t.igual(dias.length, 3);
      t.igual(dias.map((d) => d.fecha), [sello(-2), sello(-1), sello(0)]);
      t.igual(dias[0], { fecha: sello(-2), fraude: 0, inasistencia: 0, atiempo: 0, ultima: 0 });
    });

    t.caso("lastDays: refleja los contadores reales del día", () => {
      const c = cargar({ silencioso: true });
      c.api.bumpStat("ultima");
      const dias = c.api.lastDays(2);
      t.igual(dias[1].fecha, sello(0));
      t.igual(dias[1].ultima, 1);
      t.igual(dias[0].ultima, 0);
    });

    // ---------- evKey ----------
    t.caso("evKey: arma la clave del día pedido o la de hoy", () => {
      t.igual(api.evKey("2026-08-01"), "vgl_ev_2026-08-01");
      t.igual(api.evKey(), "vgl_ev_" + sello(0));
      t.igual(api.evKey(""), "vgl_ev_" + sello(0));   // vacío cae al día actual
    });

    // ---------- logEvent / evFlush: tandas ----------
    t.caso("logEvent: el evento queda en la tanda y solo evFlush lo escribe", () => {
      const c = cargar({ silencioso: true });
      c.api.logEvent({ t: "08:00:00", ev: "CAMBIO_ESTADO", doc: "111" });
      // aún no hay nada en el almacén: la escritura va por tandas de 2 s
      t.igual(c.env.storage.getItem(c.api.evKey()), null);
      c.api.evFlush();
      const evs = leerJSON(c, c.api.evKey());
      t.igual(evs.length, 1);
      t.igual(evs[0].doc, "111");
    });

    t.caso("logEvent: el FRAUDE_EXTEMPORANEO se escribe en el acto, sin esperar", () => {
      const c = cargar({ silencioso: true });
      c.api.logEvent({ t: "09:10:00", ev: "FRAUDE_EXTEMPORANEO", doc: "222", min: 25 });
      const evs = leerJSON(c, c.api.evKey());   // sin evFlush manual
      t.cierto(!!evs, "debe estar escrito ya");
      t.igual(evs.length, 1);
      t.igual(evs[0].ev, "FRAUDE_EXTEMPORANEO");
    });

    t.caso("logEvent: al llegar a 200 eventos la tanda se vacía sola", () => {
      const c = cargar({ silencioso: true });
      for (let i = 0; i < 199; i++) c.api.logEvent({ t: "x", ev: "CAMBIO_ESTADO", n: i });
      t.igual(c.env.storage.getItem(c.api.evKey()), null, "con 199 sigue en memoria");
      c.api.logEvent({ t: "x", ev: "CAMBIO_ESTADO", n: 199 });
      const evs = leerJSON(c, c.api.evKey());
      t.igual(evs.length, 200);
      t.igual(evs[199].n, 199);
    });

    t.caso("evFlush: recorta la bitácora del día a 3000 eventos", () => {
      const c = cargar({ silencioso: true });
      const previos = [];
      for (let i = 0; i < 2999; i++) previos.push({ n: i });
      c.env.storage.setItem(c.api.evKey(), JSON.stringify(previos));
      c.api.logEvent({ n: 2999 });
      c.api.logEvent({ n: 3000 });
      c.api.evFlush();
      const evs = leerJSON(c, c.api.evKey());
      t.igual(evs.length, 3000);
      t.igual(evs[0].n, 1, "el más viejo se descarta");
      t.igual(evs[2999].n, 3000);
    });

    t.caso("evFlush: con la tanda vacía no escribe nada", () => {
      const c = cargar({ silencioso: true });
      c.api.evFlush();
      t.igual(c.env.storage.getItem(c.api.evKey()), null);
    });

    t.caso("evFlush: la tanda no se pierde si falla la escritura (reencolado)", () => {
      const c = cargar({ silencioso: true });
      const origSetItem = c.env.win.localStorage.setItem;
      c.env.win.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
      c.api.logEvent({ ev: "X1" });
      c.api.logEvent({ ev: "X2" });
      c.api.evFlush();
      c.env.win.localStorage.setItem = origSetItem;
      c.api.evFlush();
      const arr = leerJSON(c, c.api.evKey());
      t.igual(arr.length, 2);
      t.igual(arr[0].ev, "X1");
      t.igual(arr[1].ev, "X2");
    });

    t.caso("evFlush: la tanda reencolada por fallo de escritura tiene un tope de 200", () => {
      const c = cargar({ silencioso: true });
      const origSetItem = c.env.win.localStorage.setItem;
      c.env.win.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };

      // Nota técnica sobre un mecanismo engañoso:
      // `logEvent` (L4128) se auto-vacía (llama a `evFlush`) al llegar a 200 eventos en evBuffer.
      // Al ingresar 250 eventos con la escritura rota, no hay 1 flush de 250, sino ~51 flushes seguidos.
      // Tras el evento 200, `evFlush` falla y reencola los 200.
      // El evento 201 ve un buffer de 201 y vuelve a llamar a `evFlush`, que reencola los últimos 200.
      // El 202 igual, etc. Finalmente, se mantienen los 200 más recientes.
      // Además, mutar el catch de L4120 (evBuffer = [] -> evBuffer = {}) es equivalente y
      // sobrevivirá, ya que `evBuffer = []` ya se ejecutó dentro del try (L4115) y ni
      // readJSON ni writeJSON lanzan excepciones jamás.
      for (let i = 0; i < 250; i++) {
        c.api.logEvent({ ev: "E" + i });
      }

      c.env.win.localStorage.setItem = origSetItem;
      c.api.evFlush();
      const arr = leerJSON(c, c.api.evKey());
      t.igual(arr.length, 200);
      t.igual(arr[0].ev, "E50");
      t.igual(arr[199].ev, "E249");
    });

    t.caso("logEvent: el turno que cruza la medianoche parte la bitácora en dos días", () => {
      const c = cargar({ silencioso: true });
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-10T23:58:00";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.ctx.Date = FakeDate;

      c.api.logEvent({ t: "23:58:00", ev: "CAMBIO_ESTADO", doc: "A" });
      mockIso = "2026-08-11T00:02:00";
      c.api.logEvent({ t: "00:02:00", ev: "CAMBIO_ESTADO", doc: "B" });   // dispara el flush del día anterior

      const dia1 = leerJSON(c, "vgl_ev_2026-08-10");
      t.igual(dia1.length, 1);
      t.igual(dia1[0].doc, "A");

      c.api.evFlush();
      const dia2 = leerJSON(c, "vgl_ev_2026-08-11");
      t.igual(dia2.length, 1);
      t.igual(dia2[0].doc, "B");
    });

    // ---------- eventsOf ----------
    t.caso("eventsOf: día sin datos devuelve [] y el actual incluye lo pendiente", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.eventsOf("2020-05-05"), []);
      c.api.logEvent({ t: "x", ev: "INASISTENCIA", doc: "333" });
      // eventsOf hace evFlush() antes de leer: lo en tanda también sale
      const evs = c.api.eventsOf();
      t.igual(evs.length, 1);
      t.igual(evs[0].doc, "333");
    });

    // ---------- purgeEventDays ----------
    t.caso("purgeEventDays: limpia bitácoras viejas, marcas caducas y el blob legado", () => {
      const c = cargar({ silencioso: true });
      const s = c.env.storage;
      s.setItem("vgl_ev_2020-01-01", "[]");                        // > 30 días: fuera
      s.setItem("vgl_ev_basura", "[]");                            // fecha inválida: fuera
      s.setItem("vgl_ev_" + sello(0), "[{\"n\":1}]");              // hoy: se queda
      s.setItem("vgl_n_fresca", String(Date.now()));               // marca reciente: se queda
      s.setItem("vgl_n_caduca", String(Date.now() - 90000000));    // > 24 h: fuera
      s.setItem("vgl_n_vacia", "");                                // sin marca de tiempo: fuera
      s.setItem("vgl_events", "[]");                               // formato antiguo: fuera
      s.setItem("otra_clave", "se respeta");                       // ajena al vigilante

      c.api.purgeEventDays();

      t.igual(s.getItem("vgl_ev_2020-01-01"), null);
      t.igual(s.getItem("vgl_ev_basura"), null);
      t.cierto(s.getItem("vgl_ev_" + sello(0)) !== null, "la bitácora de hoy sobrevive");
      t.cierto(s.getItem("vgl_n_fresca") !== null, "la marca fresca sobrevive");
      t.igual(s.getItem("vgl_n_caduca"), null);
      t.igual(s.getItem("vgl_n_vacia"), null);
      t.igual(s.getItem("vgl_events"), null);
      t.igual(s.getItem("otra_clave"), "se respeta");
    });

    // ---------- downloadBlob ----------
    t.caso("downloadBlob: crea el ancla con el nombre y pasa el blob a createObjectURL", () => {
      const c = cargar({ silencioso: true });
      let blobRecibido = null;
      c.ctx.URL = { createObjectURL: (b) => { blobRecibido = b; return "blob:capturado"; }, revokeObjectURL() {} };
      const falso = { soy: "un blob" };
      c.api.downloadBlob(falso, "prueba.csv");
      t.cierto(blobRecibido === falso, "el blob debe llegar intacto a createObjectURL");
      const ancla = c.env.doc.body.children.find((n) => n.tagName === "A");
      t.cierto(!!ancla, "debe colgar el ancla del body");
      t.igual(ancla.download, "prueba.csv");
      t.igual(ancla.href, "blob:capturado");
    });

    // ---------- exportAudit ----------
    t.caso("exportAudit: CSV con BOM, resumen del día y filas con escape correcto", () => {
      const c = cargar({ silencioso: true });
      const blobs = [];
      c.ctx.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; blobs.push(this); };
      c.ctx.URL = { createObjectURL: () => "blob:csv", revokeObjectURL() {} };

      const dia = "2026-08-01";
      c.env.storage.setItem("vgl_ev_" + dia, JSON.stringify([
        { t: "08:01:02", ev: "FRAUDE_EXTEMPORANEO", hora: "07:40 AM", doc: "123", estado: "Confirmada", min: 21, nombre: "JUAN PEREZ" },
        { t: "08:15:00", ev: "CAMBIO_ESTADO", hora: "08:00 AM", doc: "456", estado: "Atendida", previo: "Confirmada", nombre: 'AL "PATRON";SA' },
      ]));
      c.env.storage.setItem(STATS_KEY, JSON.stringify({
        "2026-08-01": { fraude: 3, inasistencia: 1, atiempo: 5, ultima: 0 },
      }));

      c.api.exportAudit(dia);

      t.igual(blobs.length, 1);
      const csv = blobs[0].parts[0];
      t.cierto(csv.charCodeAt(0) === 0xFEFF, "debe empezar con BOM para Excel");
      t.cierto(csv.indexOf("Fecha;2026-08-01") >= 0);
      t.cierto(csv.indexOf("Confirmaciones extemporáneas;3") >= 0);
      t.cierto(csv.indexOf("Inasistencias registradas;1") >= 0);
      t.cierto(csv.indexOf("Ingresos a tiempo;5") >= 0);
      t.cierto(csv.indexOf("Eventos registrados;2") >= 0);
      t.cierto(csv.indexOf("Hora;Evento;Hora cita;Documento;Estado;Estado previo;Minutos;Paciente") >= 0);
      // fila normal: previo vacío, minutos presentes
      t.cierto(csv.indexOf("08:01:02;FRAUDE_EXTEMPORANEO;07:40 AM;123;Confirmada;;21;JUAN PEREZ") >= 0);
      // fila con ';' y comillas en el nombre: va entrecomillada y con comillas dobladas
      t.cierto(csv.indexOf('"AL ""PATRON"";SA"') >= 0, "el nombre con ; y comillas debe escaparse");
      t.igual(blobs[0].opts.type, "text/csv;charset=utf-8");

      const ancla = c.env.doc.body.children.find((n) => n.tagName === "A");
      t.cierto(!!ancla);
      t.igual(ancla.download, "auditoria_vigilante_2026-08-01.csv");
    });

    t.caso("exportAudit: día sin actividad produce reporte con contadores en cero", () => {
      const c = cargar({ silencioso: true });
      const blobs = [];
      c.ctx.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; blobs.push(this); };
      c.ctx.URL = { createObjectURL: () => "blob:csv", revokeObjectURL() {} };
      c.api.exportAudit("2026-07-15");
      const csv = blobs[0].parts[0];
      t.cierto(csv.indexOf("Confirmaciones extemporáneas;0") >= 0);
      t.cierto(csv.indexOf("Eventos registrados;0") >= 0);
    });

    // =====================================================================
    //  v18.0.13 — EL CUADRE DEL CSV: la prueba que el código decía tener y NO tenía
    //
    //  `maybeNotify` afirmaba en un comentario: «la fila de auditoría se escribe SOLO si de
    //  verdad se contó, para que el número de la cabecera del CSV y el número de filas del
    //  cuerpo cuadren siempre (hay una prueba de conciliación en suite_10 que lo exige)».
    //  Esa prueba NO existía. El único caso de esta suite que toca exportAudit inyecta a
    //  mano {fraude:3} junto a DOS filas y solo comprueba el formateo — un ejemplo
    //  deliberadamente no conciliado. Lo encontró una auditoría adversarial, y por ese
    //  hueco pasaron DOS defectos reales, uno en cada dirección:
    //
    //    · contar SIN fila (v18.0.12): la rama «sin presentarse → atendido» subía el
    //      contador de fraude y no escribía FRAUDE_EXTEMPORANEO;
    //    · fila SIN contar (v18.0.13): logEvent vivía en colorAndAlert y bumpStatCita en
    //      maybeNotify, y tick() llama a la primera sin la segunda en el PRIMER sondeo de
    //      cada pestaña — una pestaña que hereda fraudWatch y ve «En Sala» de entrada
    //      escribía la fila sin contarla.
    //
    //  Esta prueba recorre el motor de VERDAD (colorAndAlert + maybeNotify, sin inyectar
    //  contadores a mano), exporta el CSV real y compara la cabecera con el cuerpo. Un
    //  comentario que inventa una red de seguridad es peor que no tener red: quien lo lee
    //  deja de mirar.
    // =====================================================================
    t.caso("v18.0.13: EL CUADRE DEL CSV — la cabecera y las filas del cuerpo dicen lo mismo", () => {
      const c = cargar({ silencioso: true });
      const blobs = [];
      c.ctx.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; blobs.push(this); };
      c.ctx.URL = { createObjectURL: () => "blob:csv", revokeObjectURL() {} };
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;

      const T = new Date("2026-08-10T08:20:00").getTime();
      const cita = (doc, hora, estado) => ({ hora_texto: hora, estado, nombre: "PACIENTE PRUEBA", index: 1, doc_id: doc });
      const sembrados = new Set();
      const pasar = (a, dt) => {
        const r = c.api.colorAndAlert(a, T + dt);
        if (!sembrados.has(r.key)) { c.api.__state.notified.set(r.key, "siembra"); sembrados.add(r.key); }
        c.api.maybeNotify(r);
        return r;
      };

      // 1) un fraude REAL: sin presentarse pasada la tolerancia y luego En Sala.
      //    OJO: «En Sala» se lee DOS veces a propósito. El antirrebote de v17.6.21 exige ver
      //    la lectura nueva dos veces seguidas antes de aceptarla (absorbe el parpadeo entre
      //    el API y el raspado del DOM), así que con una sola lectura el estado no se
      //    confirma y el fraude no se detecta. Escribirlo con una sola sería un escenario
      //    que no existe en la cadencia real de sondeo.
      pasar(cita("111111", "08:00 AM", "Sin presentarse"), 0);
      pasar(cita("111111", "08:00 AM", "En Sala"), 5000);
      pasar(cita("111111", "08:00 AM", "En Sala"), 10000);
      // 2) una inasistencia que se queda así.
      pasar(cita("222222", "07:30 AM", "Sin presentarse"), 0);
      // 3) una llegada a tiempo (dentro de la tolerancia).
      pasar(cita("333333", "08:19 AM", "Sin presentarse"), 0);
      pasar(cita("333333", "08:19 AM", "En Sala"), 5000);
      pasar(cita("333333", "08:19 AM", "En Sala"), 10000);

      c.api.evFlush();
      const dia = c.api.todayStamp();
      c.api.exportAudit(dia);
      t.igual(blobs.length, 1, "se generó el CSV");
      const csv = blobs[0].parts[0];

      const cabecera = (rot) => {
        const m = new RegExp(rot + ";(\\d+)").exec(csv);
        return m ? parseInt(m[1], 10) : null;
      };
      const filasDe = (ev) => (csv.match(new RegExp(";" + ev + ";", "g")) || []).length;

      t.igual(cabecera("Confirmaciones extemporáneas"), filasDe("FRAUDE_EXTEMPORANEO"),
        "fraude: la cabecera y las filas del cuerpo tienen que decir lo mismo");
      t.igual(cabecera("Inasistencias registradas"),
        filasDe("INASISTENCIA") - filasDe("RECTIFICACION_INASISTENCIA"),
        "inasistencias: las contadas menos las rectificadas");
      t.igual(cabecera("Ingresos a tiempo"), filasDe("INGRESO_A_TIEMPO"),
        "a tiempo: cabecera contra cuerpo");
      t.cierto(cabecera("Confirmaciones extemporáneas") >= 1,
        "y el caso de prueba produjo al menos un fraude real (si no, esto pasaría en el vacío)");
    });

    t.caso("v18.0.13: cuadra TAMBIÉN en el primer sondeo de una pestaña, que no llama a maybeNotify", () => {
      // tick() hace `_sembrarEstadoInicial(processed)` en el primer sondeo en vez de
      // `processed.forEach(maybeNotify)`. Una pestaña que hereda fraudWatch de otra (se
      // comparte entre pestañas) y ve «En Sala» de entrada pasaba SOLO por colorAndAlert.
      const c = cargar({ silencioso: true });
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const a = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "P", index: 1, doc_id: "5150076" };
      c.api.__state.fraudWatch.add(c.api.apptKey(a));

      const r = c.api.colorAndAlert(a, new Date("2026-08-10T08:20:00").getTime());
      t.igual(r.color, "ROJO", "se detecta el fraude (control del caso)");
      c.api.evFlush();
      const dia = c.api.todayStamp();
      const cont = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}")[dia] || {};
      const filas = JSON.parse(c.env.storage.getItem(c.api.evKey(dia)) || "[]");
      t.igual(filas.filter((x) => x && x.ev === "FRAUDE_EXTEMPORANEO").length, cont.fraude || 0,
        "sin maybeNotify no hay ni fila ni número: lo que no se puede hacer es una cosa sin la otra");
    });

    // v18.0.108 — S+ robustez (B4): el espejo GM de la bitácora (espejo_vgl_ev_*, con nombre y
    // cédula) no lo podaba nadie: purgeEventDays solo miraba localStorage.
    t.caso("v18.0.108 (S+ B4): purgeEventDays también poda el espejo GM de la bitácora, que crecía para siempre", () => {
      const c = cargar({ silencioso: true });
      const hoy = c.api.todayStamp();
      c.env.gm["espejo_vgl_ev_" + hoy] = [{ t: "07:05", ev: "INASISTENCIA", doc: "1122334455" }];
      c.env.almacen["vgl_ev_2026-02-14"] = JSON.stringify([{ t: "08:00", ev: "INASISTENCIA", doc: "9988776655" }]);
      c.env.gm["espejo_vgl_ev_2026-02-14"] = [{ t: "08:00", ev: "INASISTENCIA", doc: "9988776655" }];
      c.api.purgeEventDays();
      t.falso("vgl_ev_2026-02-14" in c.env.almacen, "montaje: el original viejo se poda (ya era así)");
      t.falso("espejo_vgl_ev_2026-02-14" in c.env.gm, "el espejo GM viejo también (antes: se quedaba para siempre, con nombre y cédula)");
      t.cierto(("espejo_vgl_ev_" + hoy) in c.env.gm, "el espejo de hoy se conserva");
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/@grant\s+GM_listValues/.test(src) && /@grant\s+GM_deleteValue/.test(src), "y el userscript pide los permisos que la poda necesita");
    });

    t.caso("v18.0.110 (S+ B7): dos pestañas escribiendo la bitácora no se pisan — cada una hereda lo que la otra escribió entre medias", () => {
      // La caché en memoria (v17.1.0) hacía que la pestaña A, al volver a escribir, pisara
      // con su copia vieja lo que B había añadido. Ahora una «generación» en disco delata la
      // escritura ajena y se relee antes de añadir.
      const almacen = {};
      const A = cargar({ silencioso: true, almacen });
      const B = cargar({ silencioso: true, almacen });
      const leer = () => { try { return JSON.parse(almacen.vgl_flight_recorder_logs || "[]").map((e) => e.act); } catch (e) { return []; } };
      A.api.vglLog("NAV", "A1", {}); A.api.vglLog("NAV", "A2", {});
      B.api.vglLog("NAV", "B1", {}); B.api.vglLog("NAV", "B2", {});
      A.api.vglLog("NAV", "A3", {});
      t.igual(leer().join(","), "A1,A2,B1,B2,A3", "A vuelve a escribir sin perder B1 y B2 (antes: A1,A2,A3)");
      B.api.vglLog("ERROR", "B3", { msg: "fallo sintético" });
      t.igual(leer().join(","), "A1,A2,B1,B2,A3,B3", "y B hereda A3");
      t.cierto(/^p[a-z0-9]+:\d+$/.test(String(almacen.vgl_flight_recorder_logs_gen || "")), "la generación en disco es «pestaña:n»: " + almacen.vgl_flight_recorder_logs_gen);
      // sin escritura ajena, la caché sigue mandando (no se reparsea): se demuestra quitando
      // el disco por debajo — si releyera, la línea nueva saldría sola.
      almacen.vgl_flight_recorder_logs = "[]";
      B.api.vglLog("NAV", "B4", {});
      t.igual(leer().join(","), "A1,A2,B1,B2,A3,B3,B4", "sin cambio de generación, se usa la caché en memoria (el disco vaciado a mano no se relee)");
    });

  },
};
