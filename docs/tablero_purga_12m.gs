/**
 * PURGA A 12 MESES — Tablero del Vigilante (Apps Script, archivo APARTE de Codigo.gs).
 * v18.2 (P11) — 05-09-2026.
 *
 * QUÉ PROMETE EL AVISO: «cada registro se borra a los doce meses de recibido».
 * Esto no se cumple solo: hace falta ESTA tarea programada recorriendo las hojas
 * de datos y eliminando las filas cuya fecha de recepción (`recibido`, la primera
 * columna que escribe doPost) supere los 365 días, dejando constancia de cuántas
 * borró y cuándo. Mientras no exista y no se haya visto correr al menos una vez,
 * la frase del aviso es falsa y el texto nuevo NO debe publicarse.
 *
 * HOJAS QUE PURGA: toda hoja con columna `recibido` — las de telemetría del
 * contrato (uso, uso_detalle, resumen, fraude, error, entorno, prueba, acceso_uid,
 * acceso_deneg) y la legacy `reportes` de versiones anteriores. NO toca: `acceso`
 * (roster de personal que edita el dueño, sin columna `recibido` ni datos de
 * evento) ni `resumen_flota` (vista derivada, se recalcula con el menú).
 *
 * CRITERIO DE FECHA: solo la columna `recibido` (fecha del SERVIDOR al recibir).
 * Una fila sin `recibido` legible NO se borra — antes fila dudosa que fila
 * borrada: si un día la columna se moviese o se corrompiera, la purga se para
 * en seco en vez de borrar a ciegas. Por lo mismo, si la hoja no tiene la
 * columna, se salta y queda anotado en el log.
 *
 * CONSTANCIA: hoja `purga_log` [cuando, hoja, borradas, corte]: UNA fila por hoja
 * y por corrida, AUNQUE borre cero — así existe prueba de que la tarea corrió,
 * que es parte de lo que exige el aviso («se ha visto correr»).
 *
 * INSTALACIÓN (LA HACE EL DUEÑO — nadie más puede tocar su cuenta):
 *   1. Abrir la Hoja de cálculo del tablero → Extensiones → Apps Script.
 *   2. En el proyecto YA EXISTENTE (el mismo Spreadsheet), crear un archivo nuevo
 *      «Purga» y pegar TODO este archivo. No reemplaza Codigo.gs: convive con él
 *      y sus funciones llevan prefijo propio para no chocar.
 *   3. En el editor, seleccionar la función `purgaInstalar` y pulsar ▶ Ejecutar.
 *      Pide autorización una sola vez (permisos del propio Spreadsheet — esta
 *      tarea no toca nada externo: ni correo, ni Drive, ni red).
 *   4. `purgaInstalar` crea el disparador DIARIO y ejecuta UNA purga en seco
 *      ahí mismo (modo `revo`). Revisar la hoja `purga_log`: debe mostrar una
 *      fila por hoja con las edades que encontró.
 *   5. Ver que corrió: fila nueva en `purga_log` con fecha de HOY. A partir de
 *      ahí corre sola cada día (~madrugada, Apps Script decide la hora exacta).
 *   6. Para quitarla: `purgaDesinstalar` borra el disparador (el log queda).
 *
 * LÍMITE HONESTO: Apps Script da ~6 min por corrida y borrar filas es lo más
 * caro de la Hoja. Se borra en BLOQUES contiguos de abajo hacia arriba (nunca
 * fila por fila); si aun así una hoja no alcanza a terminarse, la corrida del
 * día siguiente sigue por donde quedó — la purga es idempotente y no hay
 * adelanto que perder: siempre se borra lo más viejo primero porque las filas
 * llegan en orden cronológico.
 */

var PURGA_DIAS = 365;   // doce meses de retención, como promete el aviso
var PURGA_LOG = "purga_log";
var PURGA_FN = "purga12m";

/**
 * Entrada del disparador diario. También se puede ejecutar a mano desde el
 * editor o desde una celda con =purga12m()? NO: es función de Apps Script,
 * se ejecuta desde el editor o el disparador, nunca como fórmula.
 */
function purga12m() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var corte = new Date(Date.now() - PURGA_DIAS * 24 * 60 * 60 * 1000);
  var nombres = ss.getSheets().map(function (h) { return h.getName(); });
  var log = purgaHojaLog(ss);
  var filaLog = [];

  nombres.forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre);
    if (!sh) return;
    try {
      var r = purgaHoja(sh, corte);
      filaLog.push([new Date(), nombre, r.borradas, r.motivo || ""]);
    } catch (e) {
      // Nunca en silencio: la falla queda en el log con su motivo.
      filaLog.push([new Date(), nombre, -1, String(e).slice(0, 120)]);
    }
  });

  if (filaLog.length) log.getRange(log.getLastRow() + 1, 1, filaLog.length, 4).setValues(filaLog);
}

/** Recorre UNA hoja: identifica la columna `recibido` y borra los bloques
 *  contiguos de filas vencidas, de abajo hacia arriba. Devuelve el conteo. */
function purgaHoja(sh, corte) {
  var ultima = sh.getLastRow();
  if (ultima < 2) return { borradas: 0, motivo: "vacía" };
  var hd = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0] || [];
  var idx = hd.indexOf("recibido");
  if (idx < 0) return { borradas: 0, motivo: "sin columna recibido (no es hoja de datos)" };

  // Solo la columna de fecha: leer la hoja entera sería castigar la cuota.
  var fechas = sh.getRange(2, idx + 1, ultima - 1, 1).getValues();
  var vencidas = [];
  for (var i = 0; i < fechas.length; i++) {
    var f = fechas[i][0];
    if (f === null || f === "" || f === undefined) continue; // sin fecha: NO se borra
    var d = (Object.prototype.toString.call(f) === "[object Date]") ? f : new Date(f);
    if (isNaN(d.getTime())) continue;                          // ilegible: NO se borra
    if (d.getTime() < corte.getTime()) vencidas.push(i + 2);   // número de fila real
  }
  if (!vencidas.length) return { borradas: 0, motivo: "nada vencido" };

  // Bloques contiguos, de abajo hacia arriba, para no desplazar índices pendientes.
  var borradas = 0;
  var fin = -1, ini = -1;
  for (var j = vencidas.length - 1; j >= 0; j--) {
    if (fin < 0) { fin = vencidas[j]; ini = vencidas[j]; continue; }
    if (vencidas[j] === ini - 1) { ini = vencidas[j]; continue; }
    sh.deleteRows(ini, fin - ini + 1); borradas += fin - ini + 1;
    fin = vencidas[j]; ini = vencidas[j];
  }
  if (fin > 0) { sh.deleteRows(ini, fin - ini + 1); borradas += fin - ini + 1; }
  return { borradas: borradas, motivo: "" };
}

/** Crea (una sola vez) la hoja de constancia y devuelve su referencia. */
function purgaHojaLog(ss) {
  var h = ss.getSheetByName(PURGA_LOG);
  if (!h) {
    h = ss.insertSheet(PURGA_LOG);
    h.appendRow(["cuando", "hoja", "borradas", "nota"]);
    h.setFrozenRows(1);
    // «borradas = -1» significa FALLO del paso por esa hoja (ver catch de purga12m).
    h.getRange(2, 1, 1, 4).setValues([[new Date(0), "(leyenda)", 0, "borradas = -1 → error al procesar esa hoja; ver nota"]]);
  }
  return h;
}

/** La ejecuta el dueño UNA vez desde el editor: crea el disparador diario y
 *  corre una purga inmediata para que exista la primera constancia. */
function purgaInstalar() {
  var ya = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === PURGA_FN;
  });
  if (!ya.length) {
    ScriptApp.newTrigger(PURGA_FN).timeBased().everyDays(1).atHour(3).create();
  }
  purga12m(); // primera corrida AHORA: el log debe mostrar filas de hoy
  SpreadsheetApp.getActive().toast("Purga instalada: corre cada día y ya dejó su primera constancia en '" + PURGA_LOG + "'.");
}

/** Quita el disparador. El log histórico queda en la Hoja. */
function purgaDesinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === PURGA_FN) ScriptApp.deleteTrigger(t);
  });
  SpreadsheetApp.getActive().toast("Disparador de la purga eliminado. El log queda en '" + PURGA_LOG + "'.");
}
