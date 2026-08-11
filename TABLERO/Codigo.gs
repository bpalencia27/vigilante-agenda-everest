/**
 * TABLERO del Vigilante de Agenda — Apps Script (Web App).
 * v12.5.1 — 11-08-2026: fila "ux" (telemetría de uso) + ENDURECIMIENTO tras la
 * revisión adversarial: lista blanca de eventos, saneo server-side de claves,
 * topes de tamaño, neutralización de fórmulas y escritura por lotes.
 *
 * DESPLIEGUE (manual, como el userscript):
 *   1. script.google.com → el proyecto del tablero existente (o uno nuevo ligado a la Hoja).
 *   2. Pegar este archivo completo en Código.gs.
 *   3. Implementar → Nueva implementación → Aplicación web → "Cualquiera con el enlace".
 *   4. La URL /exec debe coincidir con TABLERO.url del userscript (o escribirse en
 *      Ajustes → "Dirección del servidor de reportes").
 *
 * CONTRATO (el userscript envía POST text/plain con JSON):
 *   { token, equipo, ver, evento, ts, dia, ...extra }
 *   evento "resumen": { deDia, fraude, inasistencia, atiempo, ultima }
 *   evento "fraude":  { hora, min }                       — SIN datos de paciente
 *   evento "prueba":  {}                                  — botón "Probar" de Ajustes
 *   evento "ux":      { deDia, desde, n, acciones }       — v12.5.x: UNA fila cada 30 min
 *       `acciones` es un JSON de conteos { "panel.agendar.abrir": 3, ... } SIN ningún
 *       dato de paciente: solo nombres fijos de acción y números.
 *
 * SEGURIDAD (el token viaja en un userscript distribuido: se asume CONOCIDO por
 * terceros — todo lo que llega se trata como hostil):
 *   · evento fuera de la lista blanca → se descarta (ni pestaña "otros" con el cuerpo:
 *     era una vía para persistir texto arbitrario en la Hoja).
 *   · toda celda de texto pasa por _celda(): tope de longitud y neutralización de
 *     fórmulas (un valor que empieza por = + - @ se antepone con ' para que la Hoja
 *     no lo ejecute).
 *   · "ux": acciones se trunca server-side, las claves se re-filtran con el MISMO
 *     patrón del userscript, los conteos se fuerzan a número, máximo 120 claves, y
 *     uso_detalle se escribe en UN solo setValues (no un appendRow por clave).
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
      // Re-saneo con el MISMO patrón del userscript + conteos numéricos + tope de claves.
      var filas = [];
      var limpio = {};
      var claves = Object.keys(acc);
      for (var i = 0; i < claves.length && filas.length < 120; i++) {
        var kk = String(claves[i]).toLowerCase().replace(/[^a-z0-9.:_-]/g, "").slice(0, 60);
        var v = Number(acc[claves[i]]);
        if (!kk || !isFinite(v) || v <= 0) continue;
        limpio[kk] = (limpio[kk] || 0) + Math.round(v);
      }
      for (var k in limpio) filas.push([new Date(), _celda(body.deDia, 10), _celda(body.equipo, 40), _celda(body.ver, 20), _celda(k, 60), limpio[k]]);
      var hoja = _hoja(ss, "uso", ["recibido", "ts", "dia", "equipo", "ver", "deDia", "desde", "n", "acciones"]);
      hoja.appendRow(comunes.concat([_celda(body.deDia, 10), _celda(body.desde, 30), Number(body.n || 0), _celda(JSON.stringify(limpio), 4000)]));
      if (filas.length) {
        var largo = _hoja(ss, "uso_detalle", ["recibido", "dia", "equipo", "ver", "accion", "conteo"]);
        largo.getRange(largo.getLastRow() + 1, 1, filas.length, 6).setValues(filas); // un solo golpe
      }
    } else if (ev === "resumen") {
      _hoja(ss, "resumen", ["recibido", "ts", "dia", "equipo", "ver", "deDia", "fraude", "inasistencia", "atiempo", "ultima"])
        .appendRow(comunes.concat([_celda(body.deDia, 10), Number(body.fraude || 0), Number(body.inasistencia || 0), Number(body.atiempo || 0), Number(body.ultima || 0)]));
    } else if (ev === "fraude") {
      _hoja(ss, "fraude", ["recibido", "ts", "dia", "equipo", "ver", "hora", "min"])
        .appendRow(comunes.concat([_celda(body.hora, 20), Number(body.min || 0)]));
    } else { // "prueba"
      _hoja(ss, "prueba", ["recibido", "ts", "dia", "equipo", "ver"]).appendRow(comunes);
    }
    return _txt("ok");
  } catch (err) {
    return _txt("err");
  }
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
