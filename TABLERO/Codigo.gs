/**
 * TABLERO del Vigilante de Agenda — Apps Script (Web App).
 * v12.5.0 — 11-08-2026: se añade la fila "ux" (telemetría de uso del panel).
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
 *   evento "ux":      { deDia, desde, n, acciones }       — v12.5.0: UNA fila cada 30 min
 *       `acciones` es un JSON de conteos { "panel.agendar.abrir": 3, ... } SIN ningún
 *       dato de paciente: solo nombres fijos de acción y números.
 *
 * Cada tipo de evento va a su propia pestaña de la Hoja: "resumen", "fraude",
 * "prueba", "uso" (la de ux) y "otros" (lo no reconocido, para no perder nada).
 */
var TOKEN = "vgl-2026"; // debe coincidir con TABLERO.token del userscript

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.token !== TOKEN) return _txt("no");
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var comunes = [new Date(), String(body.ts || ""), String(body.dia || ""), String(body.equipo || ""), String(body.ver || "")];
    var ev = String(body.evento || "");
    if (ev === "ux") {
      // La fila cruda + columnas útiles ya desglosadas para filtrar sin fórmulas.
      var hoja = _hoja(ss, "uso", ["recibido", "ts", "dia", "equipo", "ver", "deDia", "desde", "n", "acciones"]);
      hoja.appendRow(comunes.concat([String(body.deDia || ""), String(body.desde || ""), Number(body.n || 0), String(body.acciones || "")]));
      // Vista larga opcional: una fila por acción del lote, para tablas dinámicas.
      var largo = _hoja(ss, "uso_detalle", ["recibido", "dia", "equipo", "ver", "accion", "conteo"]);
      try {
        var acc = JSON.parse(String(body.acciones || "{}"));
        for (var k in acc) largo.appendRow([new Date(), String(body.deDia || ""), String(body.equipo || ""), String(body.ver || ""), String(k), Number(acc[k] || 0)]);
      } catch (e2) {}
    } else if (ev === "resumen") {
      _hoja(ss, "resumen", ["recibido", "ts", "dia", "equipo", "ver", "deDia", "fraude", "inasistencia", "atiempo", "ultima"])
        .appendRow(comunes.concat([String(body.deDia || ""), Number(body.fraude || 0), Number(body.inasistencia || 0), Number(body.atiempo || 0), Number(body.ultima || 0)]));
    } else if (ev === "fraude") {
      _hoja(ss, "fraude", ["recibido", "ts", "dia", "equipo", "ver", "hora", "min"])
        .appendRow(comunes.concat([String(body.hora || ""), Number(body.min || 0)]));
    } else if (ev === "prueba") {
      _hoja(ss, "prueba", ["recibido", "ts", "dia", "equipo", "ver"]).appendRow(comunes);
    } else {
      _hoja(ss, "otros", ["recibido", "ts", "dia", "equipo", "ver", "evento", "cuerpo"])
        .appendRow(comunes.concat([ev, JSON.stringify(body).slice(0, 4000)]));
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

function _txt(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
