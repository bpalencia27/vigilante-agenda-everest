/**
 * TABLERO del Vigilante de Agenda — Apps Script (Web App).
 *
 * v12.10.11 — 13-08-2026: revisando un export real (106+17+74+546 filas, cinco hojas)
 * se confirmó que la columna "ver" NUNCA llegó legible: Sheets, con la hoja en formato
 * automático y locale es-CO (día/mes/año), interpreta cualquier "N.N.N" como fecha —
 * y nuestro esquema de versión ("12.MINOR.PATCH") encaja de lleno porque "12" también
 * es un día válido. Confirmado matemáticamente contra 9 patrones reales de la Hoja: los
 * 9 coinciden exacto con la fórmula inversa día.mes.año. Esto rompía en silencio la
 * columna "Versión" del propio tablero de flota y explica el "versión más alta vista: 0"
 * que traía la Hoja real. Dos piezas: `_forzarTextoColumnaVer()` evita que vuelva a pasar
 * (fuerza texto plano ANTES de escribir), y el menú "Reparar columna 'ver' corrupta en
 * fecha" recupera lo YA corrompido — la transformación es reversible, no hubo pérdida de
 * información. Ver el detalle en cada función.
 *
 * v12.6.9 — 12-08-2026: recibe lo que el userscript v12.6.9 empezó a mandar
 * (identificador de equipo automático, `lote` contra duplicados, errores y entorno)
 * y corrige tres cosas que la Hoja REAL dejó ver al revisar 34 filas de dos jornadas.
 *
 * QUÉ CAMBIA RESPECTO A v12.5.2 (el que está desplegado) Y POR QUÉ:
 *
 *  1. DUPLICADOS. En la Hoja hay filas repetidas EXACTAS: mismo `ts`, mismo payload,
 *     recibidas con minutos de diferencia (p. ej. 12:03:18.918Z entregada a las 7:03 y
 *     otra vez a las 7:13). Es un reintento de la cola del userscript sobre un envío
 *     que en realidad SÍ había llegado: se perdió la respuesta, no la fila. Todos los
 *     acumulados del tablero están inflados por eso.
 *     Desde v12.6.9 cada fila viaja con `lote`, único por encolado. Aquí se descarta
 *     el reenvío con CacheService (6 h, que cubre de sobra la vida de la cola) y se
 *     responde "dup" — el userscript la da por entregada igual y deja de reintentarla.
 *     Para lo YA acumulado: menú Vigilante → "Limpiar filas duplicadas", que borra las
 *     repeticiones históricas conservando siempre la primera.
 *
 *  2. EQUIPO SIN NOMBRE. La columna `equipo` venía VACÍA en TODAS las filas: dependía
 *     de un ajuste manual que nadie llena. El userscript ya manda un identificador
 *     anónimo y estable por navegador ("eq-…"), así que la vista de flota deja de ser
 *     una sola bolsa sin nombre. Las filas viejas sin equipo se siguen mostrando,
 *     agrupadas aparte y rotuladas como anteriores a v12.6.9.
 *
 *  3. VERSIÓN MÁS ALTA ENVENENADA. En la Hoja aparecen versiones que no existen
 *     ("12.6.2000", "12.5.2003"). Con la comparación numérica anterior, UNA fila así
 *     se convertía en "la versión más alta vista" y marcaba a TODA la flota como
 *     🔴 ATRASADO. Ahora solo entran al cálculo las versiones con forma real
 *     (x.y.z, cada parte ≤ 999); las demás se muestran tal cual junto a su equipo,
 *     con "❓ versión no reconocida", sin arrastrar al resto.
 *
 *  4. EVENTOS NUEVOS:
 *     - "error"   → hoja `error`   { origen, msg, donde }. El userscript solo manda
 *                   los fallos de SU propio código (los de Everest se filtran en el
 *                   cliente) y como máximo 5 por día y equipo, con el mensaje ya
 *                   saneado en origen: sin URL, sin comillas y sin ninguna tira de
 *                   6+ dígitos. Aquí se vuelve a sanear —el servidor no confía en el
 *                   emisor— y se neutralizan las fórmulas como en toda celda.
 *     - "entorno" → hoja `entorno` { nav, so, zona, pantalla, gestor }, una fila por
 *                   equipo y día. Sin esto un fallo reportado no se puede leer: no se
 *                   sabía ni qué versión tenía instalada realmente cada consultorio.
 *
 *  5. MIGRACIÓN DE ENCABEZADOS. _hoja() ya no solo crea la hoja: si existe y le
 *     faltan columnas nuevas (`lote`), las AÑADE al encabezado. Sin esto, las filas
 *     nuevas traerían un valor más que columnas y ese dato quedaría sin título.
 *
 *  6. v12.10.12 — OBSERVABILIDAD (migas de pan + distinción error/bug): la hoja
 *     `error` gana una columna `migas` — las últimas acciones (nombres fijos, sin
 *     datos de paciente) que el userscript contó justo antes del fallo, al estilo
 *     Sentry/Crashlytics. Además, "error.distintos" y las claves "api.<endpoint>.ok"
 *     / ".err" (con su ".total" en milisegundos, para latencia promedio) llegan por
 *     la MISMA cola "ux" que ya existía — cero cambios de servidor para esas dos.
 *
 *  SE CONSERVA de v12.5.2, sin cambios de fondo: sin doGet (el TOKEN vive en texto
 *  plano dentro de un userscript distribuido: un GET con ese token es de facto una
 *  URL de lectura pública), lista blanca de eventos, columnas fijas por hoja,
 *  neutralización de fórmulas en toda celda de texto, conteos forzados a número
 *  (el bug de los ceros de v7.8.4) y el total de "ux" recalculado en el servidor.
 *
 * DESPLIEGUE (manual, igual que siempre):
 *   1. script.google.com → el proyecto YA EXISTENTE del tablero (el mismo
 *      Spreadsheet — NO crear uno nuevo, o se pierde el histórico).
 *   2. Reemplazar TODO Código.gs por este archivo.
 *   3. Implementar → Gestionar implementaciones → ✎ editar la implementación
 *      activa → Nueva versión → Implementar. Guardar el código NO actualiza la URL
 *      /exec en vivo; hace falta esa "nueva versión" explícita.
 *   4. La URL /exec debe seguir siendo la misma de TABLERO.url en el userscript.
 *
 * CONTRATO (el userscript envía POST text/plain con JSON):
 *   { token, equipo, ver, evento, ts, dia, lote, ...extra }
 *   "resumen": { deDia, fraude, inasistencia, atiempo, ultima }
 *   "fraude":  { hora, min }                          — SIN datos de paciente
 *   "prueba":  {}                                     — botón "Probar" de Ajustes
 *   "ux":      { deDia, desde, n, acciones }          — telemetría de uso, cada 30 min;
 *                                                        entre las claves de `acciones`
 *                                                        pueden venir "error.distintos"
 *                                                        (huellas de error nuevas hoy) y
 *                                                        "api.<endpoint>.ok"/".err" con su
 *                                                        ".total" en ms (latencia RUM)
 *   "error":   { origen, msg, donde, migas }          — máx. 5/día por equipo; "migas" son
 *                                                        las últimas acciones antes del fallo
 *   "entorno": { nav, so, zona, pantalla, gestor }    — 1/día por equipo
 */
var TOKEN = "vgl-2026"; // debe coincidir con TABLERO.token del userscript
var EVENTOS_VALIDOS = { ux: 1, resumen: 1, fraude: 1, prueba: 1, error: 1, entorno: 1 };
var LOTE_TTL_SEG = 21600; // 6 h — la cola del userscript no reintenta más allá de eso

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.token !== TOKEN) return _txt("no");
    var ev = String(body.evento || "");
    if (!EVENTOS_VALIDOS[ev]) return _txt("no"); // evento desconocido: se descarta entero

    // v12.6.9 — Descarte del REENVÍO. `lote` es único por encolado en el cliente; si ya
    // se vio, esta fila ya está en la Hoja y volver a escribirla infla los acumulados.
    // Se responde "dup", no "err": para el userscript cuenta como entrega buena y deja
    // de reintentar, que es exactamente lo que debe pasar.
    var lote = String(body.lote || "").slice(0, 60);
    if (lote) {
      var cache = CacheService.getScriptCache();
      if (cache.get("lote:" + lote)) return _txt("dup");
      cache.put("lote:" + lote, "1", LOTE_TTL_SEG);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var comunes = [new Date(), _celda(body.ts, 30), _celda(body.dia, 10), _celda(body.equipo, 40), _celda(body.ver, 20), _celda(lote, 60)];
    var COMUNES_HD = ["recibido", "ts", "dia", "equipo", "ver", "lote"];

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

      var hoja = _hoja(ss, "uso", COMUNES_HD.concat(["deDia", "desde", "n", "acciones"]));
      hoja.appendRow(comunes.concat([_celda(body.deDia, 10), _celda(body.desde, 30), totalLimpio, _celda(JSON.stringify(limpio), 4000)]));

      var filas = [];
      for (var k in limpio) filas.push([new Date(), _celda(body.deDia, 10), _celda(body.equipo, 40), _celda(body.ver, 20), _celda(k, 60), limpio[k]]);
      if (filas.length) {
        var largo = _hoja(ss, "uso_detalle", ["recibido", "dia", "equipo", "ver", "accion", "conteo"]);
        largo.getRange(largo.getLastRow() + 1, 1, filas.length, 6).setValues(filas); // un solo golpe
      }
    } else if (ev === "resumen") {
      _hoja(ss, "resumen", COMUNES_HD.concat(["deDia", "fraude", "inasistencia", "atiempo", "ultima"]))
        .appendRow(comunes.concat([_celda(body.deDia, 10), toNumero(body.fraude), toNumero(body.inasistencia), toNumero(body.atiempo), toNumero(body.ultima)]));
    } else if (ev === "fraude") {
      _hoja(ss, "fraude", COMUNES_HD.concat(["hora", "min"]))
        .appendRow(comunes.concat([_celda(body.hora, 20), toNumero(body.min)]));
    } else if (ev === "error") {
      // El mensaje ya viene saneado del userscript; se vuelve a sanear porque el
      // servidor JAMÁS confía en el emisor: una tira de 6+ dígitos podría ser una
      // cédula y no puede quedar escrita en la Hoja bajo ninguna circunstancia.
      // v12.10.12 — "migas": las acciones (nombres fijos, sin datos de paciente) que
      // pasaron justo antes del error — mismo saneo que el resto: nunca se confía en
      // el emisor.
      _hoja(ss, "error", COMUNES_HD.concat(["origen", "msg", "donde", "migas"]))
        .appendRow(comunes.concat([_celda(body.origen, 12), _celda(_sinDigitosLargos(body.msg), 180), _celda(_sinDigitosLargos(body.donde), 60), _celda(_sinDigitosLargos(body.migas), 160)]));
    } else if (ev === "entorno") {
      _hoja(ss, "entorno", COMUNES_HD.concat(["nav", "so", "zona", "pantalla", "gestor"]))
        .appendRow(comunes.concat([_celda(body.nav, 20), _celda(body.so, 20), _celda(body.zona, 40), _celda(body.pantalla, 20), _celda(body.gestor, 20)]));
    } else { // "prueba"
      _hoja(ss, "prueba", COMUNES_HD).appendRow(comunes);
    }
    return _txt("ok");
  } catch (err) {
    return _txt("err");
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu("Vigilante")
      .addItem("Actualizar resumen de flota", "armarResumen")
      .addItem("Limpiar filas duplicadas", "limpiarDuplicados")
      .addItem("Reparar columna 'ver' corrupta en fecha", "repararVersionesCorruptas")
      .addToUi();
  } catch (e) {}
}

// =====================================================================
//  v12.10.11 — REPARAR "ver" YA CONVERTIDA EN FECHA (dato histórico)
//  A diferencia de un simple cambio de formato, esto SÍ recupera el valor
//  original: la corrupción es un parseo día.mes.año determinista y por tanto
//  reversible — no una pérdida de información. Confirmado contra 9 patrones
//  reales de la Hoja (12.6.9→12/06/2009, 12.10.7→12/10/2007, etc.), los 9
//  coinciden exacto con la fórmula inversa.
//  Solo toca celdas que HOY son un objeto Date (paso ya corrompido). Una
//  celda que ya es texto (arreglada por _forzarTextoColumnaVer en escrituras
//  nuevas, o ya reparada antes) se deja intacta — la función es idempotente,
//  se puede correr varias veces sin riesgo.
//  LÍMITE HONESTO: la fórmula asume que el DÍA reconstruido es el MAJOR de la
//  versión (cierto para todo lo que se ha desplegado: siempre "12.x.y"). Si
//  algún día el major cambia a algo que no sea un día de calendario válido
//  (0 o >31), esa celda no se puede haber corrompido así en primer lugar —
//  Sheets no la habría convertido a fecha — así que no hay falso positivo.
// =====================================================================
function repararVersionesCorruptas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ["reportes", "entorno", "uso", "uso_detalle", "resumen", "fraude", "error", "prueba"];
  var totalReparadas = 0;
  var detalle = [];

  hojas.forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre);
    if (!sh || sh.getLastRow() < 2) return;
    var vals = sh.getDataRange().getValues();
    var hd = vals[0] || [];
    var idxVer = hd.indexOf("ver");
    if (idxVer < 0) return;

    var reparadasHoja = 0;
    for (var i = 1; i < vals.length; i++) {
      var v = vals[i][idxVer];
      if (Object.prototype.toString.call(v) !== "[object Date]") continue; // ya es texto: no tocar
      var dd = v.getDate(), mm = v.getMonth() + 1, yy = v.getFullYear() % 100;
      var reconstruida = dd + "." + mm + "." + yy;
      sh.getRange(i + 1, idxVer + 1).setNumberFormat("@").setValue(reconstruida);
      reparadasHoja++;
    }
    if (reparadasHoja) { totalReparadas += reparadasHoja; detalle.push(nombre + ": " + reparadasHoja); }
  });

  SpreadsheetApp.getActive().toast(totalReparadas
    ? "Versiones reparadas — " + detalle.join(" · ") + ". Vuelve a ejecutar 'Actualizar resumen de flota'."
    : "No se encontraron celdas de 'ver' corrompidas en fecha (o ya están reparadas).");
}

// =====================================================================
//  VISTA DE FLOTA (heredada de v7.8.4, adaptada a las hojas separadas)
//  ¿Qué consultorio tiene qué versión? ¿Cuáles están atrasados frente a la más
//  alta vista? Conteos acumulados de puntualidad, de uso del panel Y —desde
//  v12.6.9— de errores, con el entorno de cada equipo.
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
    { nombre: "error", acumula: function (f) { f.errores++; } },
    { nombre: "entorno", acumula: function (f, r, ci) {
        if (ci.nav >= 0 && r[ci.nav]) f.nav = r[ci.nav];
        if (ci.so >= 0 && r[ci.so]) f.so = r[ci.so];
      } },
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
    var ci = { eq: c("equipo"), ver: c("ver"), rec: c("recibido"), fraude: c("fraude"), inasist: c("inasistencia"),
               atiempo: c("atiempo"), ultima: c("ultima"), n: c("n"), nav: c("nav"), so: c("so") };
    if (ci.eq < 0) return;
    vals.forEach(function (r) {
      // v12.6.9 — Las filas anteriores a esta versión llegaron SIN equipo (dependía de
      // un ajuste manual). Se conservan, pero agrupadas aparte y rotuladas, para que no
      // se confundan con un consultorio real que hoy sí se identifica solo.
      var eq = (r[ci.eq] || "").toString().trim() || "(anteriores a v12.6.9 · sin equipo)";
      var f = flota[eq] || (flota[eq] = { ver: "", nav: "", so: "", primero: "", ultimo: "", nReportes: 0,
        fraudesVivo: 0, fraudeAcum: 0, inasistAcum: 0, atiempoAcum: 0, ultimaAcum: 0, uxAcum: 0, errores: 0 });
      f.nReportes++; totalReportes++;
      var cuando = ci.rec >= 0 ? r[ci.rec] : "";
      if (cuando) { if (!f.primero) f.primero = cuando; f.ultimo = cuando; }
      if (ci.ver >= 0 && r[ci.ver]) {
        f.ver = r[ci.ver];
        // Solo una versión con forma REAL puede convertirse en "la más alta vista": en la
        // Hoja hay valores imposibles ("12.6.2000") que, al ganar la comparación numérica,
        // marcaban a toda la flota como atrasada.
        if (_versionValida(r[ci.ver]) && _compararVersion(r[ci.ver], versionMasAlta) > 0) versionMasAlta = r[ci.ver];
      }
      fte.acumula(f, r, ci);
    });
  });

  if (!totalReportes) { SpreadsheetApp.getActive().toast("Aún no hay reportes."); return; }

  var out = ss.getSheetByName("resumen_flota") || ss.insertSheet("resumen_flota");
  out.clear();
  out.appendRow(["ESTADO DE LA FLOTA — versión más alta vista: " + versionMasAlta]);
  out.appendRow([
    "Equipo / consultorio", "Versión", "¿Al día?", "Navegador", "Sistema", "Reportes",
    "Errores", "Fraudes (en vivo)", "Fraudes (acum.)", "Inasistencias (acum.)",
    "A tiempo (acum.)", "Última llamada (acum.)", "Acciones de uso (ux, acum.)",
    "Primer reporte", "Último reporte"
  ]);
  Object.keys(flota).sort().forEach(function (eq) {
    var f = flota[eq];
    var alDia = !f.ver ? "❓ sin dato"
      : !_versionValida(f.ver) ? "❓ versión no reconocida"
      : (_compararVersion(f.ver, versionMasAlta) >= 0 ? "✅ al día" : "🔴 ATRASADO");
    out.appendRow([
      eq, f.ver, alDia, f.nav, f.so, f.nReportes,
      f.errores, f.fraudesVivo, f.fraudeAcum, f.inasistAcum,
      f.atiempoAcum, f.ultimaAcum, f.uxAcum, f.primero, f.ultimo
    ]);
  });
  out.setFrozenRows(2);

  // v12.6.9 — Los últimos errores, a la vista. Antes no llegaba ninguno.
  var shE = ss.getSheetByName("error");
  if (shE && shE.getLastRow() > 1) {
    out.appendRow([""]);
    out.appendRow(["ÚLTIMOS ERRORES DEL SCRIPT (máx. 50, mensaje saneado, sin datos de paciente)"]);
    out.appendRow(["Cuándo", "Equipo", "Versión", "Origen", "Mensaje", "Dónde"]);
    var ve = shE.getDataRange().getValues();
    var he = ve.shift() || [];
    var cE = { rec: he.indexOf("recibido"), eq: he.indexOf("equipo"), ver: he.indexOf("ver"),
               org: he.indexOf("origen"), msg: he.indexOf("msg"), donde: he.indexOf("donde") };
    ve.slice(-50).forEach(function (r) {
      out.appendRow([_val(r, cE.rec), _val(r, cE.eq), _val(r, cE.ver), _val(r, cE.org), _val(r, cE.msg), _val(r, cE.donde)]);
    });
  }

  var shF = ss.getSheetByName("fraude");
  if (shF && shF.getLastRow() > 1) {
    out.appendRow([""]);
    out.appendRow(["ÚLTIMOS FRAUDES EN VIVO (máx. 100, sin datos de paciente)"]);
    out.appendRow(["Cuándo", "Equipo", "Hora de la cita", "Minutos tarde"]);
    var vf = shF.getDataRange().getValues();
    var hf = vf.shift() || [];
    var cF = { rec: hf.indexOf("recibido"), eq: hf.indexOf("equipo"), hora: hf.indexOf("hora"), min: hf.indexOf("min") };
    vf.slice(-100).forEach(function (r) {
      out.appendRow([_val(r, cF.rec), _val(r, cF.eq), _val(r, cF.hora), _val(r, cF.min)]);
    });
  }

  SpreadsheetApp.getActive().toast("Resumen actualizado: " + Object.keys(flota).length + " equipo(s).");
}

// =====================================================================
//  v12.6.9 — LIMPIEZA DE DUPLICADOS HISTÓRICOS
//  El descarte por `lote` solo protege de aquí en adelante. Lo ya acumulado trae
//  repeticiones exactas de un reenvío que sí había llegado, y esas filas inflan
//  todos los acumulados del resumen de flota.
//  Criterio de duplicado, deliberadamente ESTRICTO: dos filas de la MISMA hoja que
//  coinciden en TODAS sus columnas menos `recibido` (la única que cambia por
//  definición en un reenvío). Como `ts` lo pone el emisor al crear la fila —no el
//  servidor al recibirla— dos jornadas distintas jamás lo comparten: solo un reenvío
//  del MISMO envío puede repetirlo.
//  Se conserva SIEMPRE la primera aparición. Se borra de abajo hacia arriba para no
//  desplazar los índices de las filas que aún faltan por revisar.
// =====================================================================
function limpiarDuplicados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ["uso", "resumen", "fraude", "prueba", "error", "entorno"];
  var totalBorradas = 0;
  var detalle = [];

  hojas.forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre);
    if (!sh || sh.getLastRow() < 3) return;
    var vals = sh.getDataRange().getValues();
    var hd = vals[0] || [];
    var iRec = hd.indexOf("recibido"); // se excluye: cambia en cada reenvío, por definición
    var vistas = {};
    var aBorrar = [];
    for (var i = 1; i < vals.length; i++) {
      var partes = [];
      for (var c = 0; c < vals[i].length; c++) {
        if (c === iRec) continue;
        partes.push(String(vals[i][c]));
      }
      var clave = partes.join("");
      if (vistas[clave]) aBorrar.push(i + 1); else vistas[clave] = 1;
    }
    for (var j = aBorrar.length - 1; j >= 0; j--) sh.deleteRow(aBorrar[j]);
    if (aBorrar.length) { totalBorradas += aBorrar.length; detalle.push(nombre + ": " + aBorrar.length); }
  });

  SpreadsheetApp.getActive().toast(totalBorradas
    ? "Duplicados borrados — " + detalle.join(" · ") + ". Vuelve a ejecutar 'Actualizar resumen de flota'."
    : "No se encontraron filas duplicadas.");
}

function _compararVersion(a, b) {
  var pa = String(a || "0").split(".").map(Number), pb = String(b || "0").split(".").map(Number);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// v12.6.9 — Forma real de una versión del userscript: x.y.z con cada parte ≤ 999. En la
// Hoja hay valores imposibles ("12.6.2000", "12.5.2003"); sin este filtro, uno solo
// ganaba la comparación y marcaba a toda la flota como atrasada.
function _versionValida(v) {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(String(v == null ? "" : v).trim());
}

// Conversión segura: nunca NaN, nunca overflow silencioso.
function toNumero(val) {
  if (val === null || val === undefined || val === "") return 0;
  var n = Number(val);
  return isFinite(n) ? n : 0;
}

// v12.6.9 — El encabezado se CREA si la hoja es nueva y se COMPLETA si la hoja ya
// existía sin las columnas nuevas (`lote`): sin esto, las filas nuevas traerían un
// valor más que columnas y ese dato quedaría sin título en la Hoja.
//
// v12.10.11 — LA VERSIÓN LLEGABA CONVERTIDA EN FECHA. Revisando la Hoja real con 106+17+
// 74+546 filas se encontró que "ver" NUNCA contiene un valor legible: "12.6.9" se ve como
// 12/06/2009, "12.10.7" como 12/10/2007, etc. Causa confirmada matemáticamente contra los
// 9 patrones distintos vistos: con la hoja en formato automático y locale es-CO (DD/MM/AA),
// Sheets interpreta CUALQUIER texto con forma "N.N.N" como fecha día.mes.año — nuestro
// esquema de versión (siempre "12.MINOR.PATCH") cae de lleno en ese patrón porque "12" es
// también un día válido. `_versionValida()`/`_compararVersion()` ya protegían el CÁLCULO de
// "versión más alta" filtrando estos valores corruptos, pero la Hoja seguía mostrándolos
// corruptos a simple vista — nadie podía leer qué versión tiene cada equipo. El valor
// original NO es recuperable una vez que Sheets lo convirtió en fecha (se pierde el string,
// no es solo un formato de visualización); esto solo evita que seguidores nuevos se dañen.
// Se fuerza texto plano ('@') en la columna "ver" de toda hoja que la tenga, ANTES de que
// _hoja() devuelva el objeto — así ninguna escritura futura (appendRow o setValues) puede
// volver a sufrir el auto-parseo, sin importar qué forme tenga el número de versión.
function _hoja(ss, nombre, encabezados) {
  var h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.appendRow(encabezados);
    h.setFrozenRows(1);
    _forzarTextoColumnaVer(h, encabezados);
    return h;
  }
  try {
    var actuales = h.getRange(1, 1, 1, Math.max(h.getLastColumn(), 1)).getValues()[0] || [];
    var faltan = [];
    for (var i = 0; i < encabezados.length; i++) {
      if (actuales.indexOf(encabezados[i]) === -1) faltan.push(encabezados[i]);
    }
    if (faltan.length) h.getRange(1, actuales.length + 1, 1, faltan.length).setValues([faltan]);
  } catch (e) {}
  _forzarTextoColumnaVer(h, encabezados);
  return h;
}

// Aísla el forzado de formato para que un fallo aquí (hoja protegida, cuota, etc.) nunca
// tumbe el guardado real de la fila — _hoja() debe seguir devolviendo la hoja igual.
function _forzarTextoColumnaVer(h, encabezados) {
  try {
    var idxVer = encabezados.indexOf("ver");
    if (idxVer < 0) return;
    var filas = Math.max(h.getMaxRows() - 1, 1000);
    h.getRange(2, idxVer + 1, filas, 1).setNumberFormat("@");
  } catch (e) {}
}

// Celda de texto segura: tope de longitud + neutralización de fórmulas (=,+,-,@).
function _celda(v, max) {
  var t = String(v == null ? "" : v).slice(0, max || 100);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

// Barrera de PHI del lado del servidor. El userscript ya sanea el mensaje antes de
// enviarlo, pero el servidor repite el MISMO saneo porque no puede confiar en el emisor:
// fuera las URL (pueden llevar identificadores en la ruta), fuera las comillas y fuera
// toda tira de 6+ dígitos —una cédula no puede quedar escrita en la Hoja venga como venga.
function _sinDigitosLargos(v) {
  return String(v == null ? "" : v)
    .replace(/https?:\/\/[^\s)]+/g, "<url>")
    .replace(/\d{6,}/g, "")
    .replace(/["'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _val(fila, idx) { return idx >= 0 ? fila[idx] : ""; }

function _txt(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
