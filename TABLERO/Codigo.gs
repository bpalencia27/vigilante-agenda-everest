/**
 * TABLERO del Vigilante de Agenda — Apps Script (Web App).
 * v12.5.2 — 11-08-2026: fusión auditada entre el receptor v7.8.4 (heredado, en
 * producción) y el endurecimiento de v12.5.1, más la vigilancia de flota que
 * v7.8.4 aportaba y que el v12.5.1 había perdido por no conocer su existencia.
 *
 * QUÉ CAMBIA RESPECTO A v7.8.4 (el que estaba desplegado) Y POR QUÉ:
 *
 *  1. SE RETIRA doGet(). El v7.8.4 exponía un endpoint GET que devolvía hasta 800
 *     filas CRUDAS de la hoja "reportes" a quien conociera el TOKEN — y ese token
 *     vive EN TEXTO PLANO dentro de un userscript distribuido a varios consultorios
 *     (Tampermonkey lo muestra en su propio editor; cualquiera con acceso al Gist o
 *     al navegador de un médico puede leerlo). Un "secreto" copiado a N máquinas no
 *     es un secreto: es de facto una URL de lectura pública. NADA en
 *     vigilante_agenda.user.js llama a este GET (repPost solo hace POST) — no hay
 *     ninguna dependencia funcional que se rompa al quitarlo. Si en el futuro hace
 *     falta leer los datos desde fuera de la Hoja, la vía correcta es un token de
 *     SOLO LECTURA separado del que usan los userscripts — avísame y lo agrego así.
 *
 *  2. LISTA BLANCA DE EVENTOS + saneo por evento (ux/resumen/fraude/prueba). v7.8.4
 *     no validaba `evento`: cualquier payload con el token correcto se volcaba
 *     entero en la hoja "reportes" con encabezados que CRECÍAN dinámicamente según
 *     las claves del cuerpo — un payload con 200 claves añadía 200 columnas nuevas
 *     sin límite. Ahora cada evento va a su propia hoja de columnas FIJAS.
 *
 *  3. NEUTRALIZACIÓN DE FÓRMULAS. v7.8.4 escribía cualquier texto tal cual: un valor
 *     que empezara por "=", "+", "-" o "@" se vuelve una fórmula EJECUTABLE al abrir
 *     la Hoja (la clásica inyección de fórmulas de CSV/Sheets). Toda celda de texto
 *     pasa por _celda(), que antepone un apóstrofo cuando hace falta.
 *
 *  4. BUG DE CEROS: v7.8.4 hacía `row[k] = v || ""` — un conteo legítimamente en
 *     CERO (fraude:0, atiempo:0…) se guardaba como celda VACÍA, no como 0. No
 *     rompía armarResumen (toNumero("") ya daba 0), pero la hoja cruda mentía. Aquí
 *     los conteos numéricos se fuerzan con toNumero() explícito en cada columna.
 *
 *  5. TELEMETRÍA "ux" (nueva, v12.5.x): reconstruida entera en el SERVIDOR — se
 *     re-aplica el mismo filtro de claves que ya usa el userscript al escribir (no
 *     basta con confiar en el cliente), los conteos se fuerzan a número, tope de
 *     120 claves, el total se RECALCULA aquí (nunca se confía en el `n` que manda
 *     el cliente), y uso_detalle se escribe en un solo setValues() — no un
 *     appendRow por clave, que agotaría la cuota de ejecución con un payload grande.
 *
 *  6. SE CONSERVA de v7.8.4 (era genuinamente útil y no tenía nada malo):
 *     - armarResumen() / menú "Vigilante": vista de flota por consultorio (¿está
 *       en la última versión vista?, fraudes/inasistencias acumulados, primer y
 *       último reporte) — adaptada para leer de las hojas separadas en vez de una
 *       sola "reportes", con una columna nueva: acciones de uso (ux) acumuladas.
 *     - _compararVersion(): comparación semántica "12.4.1" vs "12.5.0", intacta.
 *     - toNumero()/toNumber(): conversión segura sin overflow ni NaN.
 *
 *  La hoja "reportes" del v7.8.4 queda INTACTA como archivo histórico — no se toca
 *  ni se borra; simplemente deja de recibir filas nuevas (las nuevas van a las
 *  hojas separadas: resumen, fraude, prueba, uso, uso_detalle).
 *
 * DESPLIEGUE (manual, como el userscript):
 *   1. script.google.com → el proyecto YA EXISTENTE del tablero (el mismo
 *      Spreadsheet de siempre — NO crear uno nuevo, o se pierde el histórico).
 *   2. Reemplazar TODO Código.gs por este archivo.
 *   3. Implementar → Gestionar implementaciones → ✎ editar la implementación
 *      activa → Nueva versión → Implementar. (Guardar el código NO actualiza la
 *      URL /exec en vivo; hace falta esta "nueva versión" explícita — la causa más
 *      común de "subí el cambio y no pasó nada".)
 *   4. La URL /exec debe seguir siendo la misma que ya tienen en TABLERO.url del
 *      userscript / en Ajustes → "Dirección del servidor de reportes".
 *
 * CONTRATO (el userscript envía POST text/plain con JSON):
 *   { token, equipo, ver, evento, ts, dia, ...extra }
 *   evento "resumen": { deDia, fraude, inasistencia, atiempo, ultima }
 *   evento "fraude":  { hora, min }                       — SIN datos de paciente
 *   evento "prueba":  {}                                  — botón "Probar" de Ajustes
 *   evento "ux":      { deDia, desde, n, acciones }       — telemetría de uso, cada 30 min
 */
var TOKEN = "vgl-2026"; // debe coincidir con TABLERO.token del userscript
var EVENTOS_VALIDOS = { ux: 1, resumen: 1, fraude: 1, prueba: 1 };

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.token !== TOKEN) return _txt("no");
    var ev = String(body.evento || "");
    if (!EVENTOS_VALIDOS[ev]) return _txt("no"); // evento desconocido: se descarta entero
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var comunes = [new Date(), _celda(body.ts, 30), _celda(body.dia, 10), _celda(body.equipo, 40), _celda(body.ver, 20)];

    if (ev === "ux") {
      var crudo = String(body.acciones || "").slice(0, 4000); // tope server-side: no confiar en el emisor
      var acc = {};
      try { acc = JSON.parse(crudo) || {}; } catch (e2) { acc = {}; }
      // Re-saneo con el MISMO patrón del userscript: claves re-filtradas, valores
      // forzados a número positivo, tope de 120 claves (las que sobren se cuentan,
      // no se tiran en silencio).
      var limpio = {};
      var aceptadas = 0, omitidas = 0;
      var claves = Object.keys(acc);
      for (var i = 0; i < claves.length; i++) {
        var kk = String(claves[i]).toLowerCase().replace(/\d{6,}/g, "").replace(/[^a-z0-9.:_-]/g, "").slice(0, 60);
        var v = toNumero(acc[claves[i]]);
        if (!kk || v <= 0) continue;
        if (!(kk in limpio)) {
          if (aceptadas >= 120) { omitidas++; continue; }
          aceptadas++;
        }
        limpio[kk] = (limpio[kk] || 0) + Math.round(v);
      }
      if (omitidas) limpio["_recortadas"] = omitidas;
      // El total SIEMPRE se recalcula aquí — nunca se confía en el `n` del cliente.
      var totalLimpio = 0;
      for (var kt in limpio) if (kt !== "_recortadas") totalLimpio += limpio[kt];

      var hoja = _hoja(ss, "uso", ["recibido", "ts", "dia", "equipo", "ver", "deDia", "desde", "n", "acciones"]);
      hoja.appendRow(comunes.concat([_celda(body.deDia, 10), _celda(body.desde, 30), totalLimpio, _celda(JSON.stringify(limpio), 4000)]));

      var filas = [];
      for (var k in limpio) filas.push([new Date(), _celda(body.deDia, 10), _celda(body.equipo, 40), _celda(body.ver, 20), _celda(k, 60), limpio[k]]);
      if (filas.length) {
        var largo = _hoja(ss, "uso_detalle", ["recibido", "dia", "equipo", "ver", "accion", "conteo"]);
        largo.getRange(largo.getLastRow() + 1, 1, filas.length, 6).setValues(filas); // un solo golpe
      }
    } else if (ev === "resumen") {
      _hoja(ss, "resumen", ["recibido", "ts", "dia", "equipo", "ver", "deDia", "fraude", "inasistencia", "atiempo", "ultima"])
        .appendRow(comunes.concat([_celda(body.deDia, 10), toNumero(body.fraude), toNumero(body.inasistencia), toNumero(body.atiempo), toNumero(body.ultima)]));
    } else if (ev === "fraude") {
      _hoja(ss, "fraude", ["recibido", "ts", "dia", "equipo", "ver", "hora", "min"])
        .appendRow(comunes.concat([_celda(body.hora, 20), toNumero(body.min)]));
    } else { // "prueba"
      _hoja(ss, "prueba", ["recibido", "ts", "dia", "equipo", "ver"]).appendRow(comunes);
    }
    return _txt("ok");
  } catch (err) {
    return _txt("err");
  }
}

function onOpen() {
  try { SpreadsheetApp.getUi().createMenu("Vigilante").addItem("Actualizar resumen de flota", "armarResumen").addToUi(); } catch (e) {}
}

// =====================================================================
//  VISTA DE FLOTA (heredada de v7.8.4, adaptada a las hojas separadas)
//  ¿Qué consultorio tiene qué versión? ¿Cuáles están atrasados frente a la más
//  alta vista? Conteos acumulados de puntualidad Y de uso del panel por sitio.
// =====================================================================
function armarResumen() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fuentes = [
    { nombre: "resumen", acumula: function (f, r, ci) {
        f.fraudeAcum += toNumero(r[ci.fraude]); f.inasistAcum += toNumero(r[ci.inasist]);
        f.atiempoAcum += toNumero(r[ci.atiempo]); f.ultimaAcum += toNumero(r[ci.ultima]);
      } },
    { nombre: "fraude", acumula: function (f) { f.fraudesVivo++; } },
    { nombre: "uso", acumula: function (f, r, ci) { f.uxAcum += toNumero(r[ci.n]); } },
    { nombre: "prueba", acumula: function () {} },
  ];
  var flota = {};
  var versionMasAlta = "0";
  var totalReportes = 0;

  fuentes.forEach(function (fte) {
    var sh = ss.getSheetByName(fte.nombre);
    if (!sh || sh.getLastRow() < 2) return;
    var vals = sh.getDataRange().getValues();
    var hd = vals.shift() || [];
    var c = function (name) { return hd.indexOf(name); };
    var ci = { eq: c("equipo"), ver: c("ver"), rec: c("recibido"), fraude: c("fraude"), inasist: c("inasistencia"), atiempo: c("atiempo"), ultima: c("ultima"), n: c("n") };
    if (ci.eq < 0) return;
    vals.forEach(function (r) {
      var eq = (r[ci.eq] || "(sin nombre de equipo)").toString().trim() || "(sin nombre de equipo)";
      var f = flota[eq] || (flota[eq] = { ver: "", primero: "", ultimo: "", nReportes: 0, fraudesVivo: 0, fraudeAcum: 0, inasistAcum: 0, atiempoAcum: 0, ultimaAcum: 0, uxAcum: 0 });
      f.nReportes++; totalReportes++;
      var cuando = ci.rec >= 0 ? r[ci.rec] : "";
      if (cuando) { if (!f.primero) f.primero = cuando; f.ultimo = cuando; }
      if (ci.ver >= 0 && r[ci.ver]) {
        f.ver = r[ci.ver];
        if (_compararVersion(r[ci.ver], versionMasAlta) > 0) versionMasAlta = r[ci.ver];
      }
      fte.acumula(f, r, ci);
    });
  });

  if (!totalReportes) { SpreadsheetApp.getActive().toast("Aún no hay reportes."); return; }

  var out = ss.getSheetByName("resumen_flota") || ss.insertSheet("resumen_flota");
  out.clear();
  out.appendRow(["ESTADO DE LA FLOTA — versión más alta vista: " + versionMasAlta]);
  out.appendRow([
    "Equipo / consultorio", "Versión", "¿Al día?", "Reportes",
    "Fraudes (en vivo)", "Fraudes (acum.)", "Inasistencias (acum.)",
    "A tiempo (acum.)", "Última llamada (acum.)", "Acciones de uso (ux, acum.)",
    "Primer reporte", "Último reporte"
  ]);
  Object.keys(flota).sort().forEach(function (eq) {
    var f = flota[eq];
    var alDia = f.ver
      ? (_compararVersion(f.ver, versionMasAlta) >= 0 ? "✅ al día" : "🔴 ATRASADO")
      : "❓ sin dato";
    out.appendRow([
      eq, f.ver, alDia, f.nReportes,
      f.fraudesVivo, f.fraudeAcum, f.inasistAcum,
      f.atiempoAcum, f.ultimaAcum, f.uxAcum, f.primero, f.ultimo
    ]);
  });
  out.setFrozenRows(2);

  var shF = ss.getSheetByName("fraude");
  if (shF && shF.getLastRow() > 1) {
    out.appendRow([""]);
    out.appendRow(["ÚLTIMOS FRAUDES EN VIVO (máx. 100, sin datos de paciente)"]);
    out.appendRow(["Cuándo", "Equipo", "Hora de la cita", "Minutos tarde"]);
    var vf = shF.getDataRange().getValues();
    var hf = vf.shift() || [];
    var ci2 = { rec: hf.indexOf("recibido"), eq: hf.indexOf("equipo"), hora: hf.indexOf("hora"), min: hf.indexOf("min") };
    vf.slice(-100).forEach(function (r) {
      out.appendRow([ci2.rec >= 0 ? r[ci2.rec] : "", ci2.eq >= 0 ? r[ci2.eq] : "", ci2.hora >= 0 ? r[ci2.hora] : "", ci2.min >= 0 ? r[ci2.min] : ""]);
    });
  }

  SpreadsheetApp.getActive().toast("Resumen actualizado: " + Object.keys(flota).length + " equipo(s).");
}

function _compararVersion(a, b) {
  var pa = String(a || "0").split(".").map(Number), pb = String(b || "0").split(".").map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Conversión segura: nunca NaN, nunca overflow silencioso.
function toNumero(val) {
  if (val === null || val === undefined || val === "") return 0;
  var n = Number(val);
  return isFinite(n) ? n : 0;
}

function _hoja(ss, nombre, encabezados) {
  var h = ss.getSheetByName(nombre);
  if (!h) { h = ss.insertSheet(nombre); h.appendRow(encabezados); h.setFrozenRows(1); }
  return h;
}

// Celda de texto segura: tope de longitud + neutralización de fórmulas (=,+,-,@).
function _celda(v, max) {
  var t = String(v == null ? "" : v).slice(0, max || 100);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function _txt(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
