// =====================================================================
//  SUITE 18 — Puente completo a Athenea y capa de credenciales (v12.3.3 a v12.3.16)
//  Cubre: los 4 parsers HTML/multipart, el transporte _gmReq, la ofuscación
//  reversible (XOR+base64) y el guardado de credenciales POR MÉDICO, el
//  auto-login opt-in (con la regla "rechazo NO reintenta, red SÍ"), el
//  latido de sesión (keepAlive) y el flujo de 3-4 pasos que resuelve
//  solicitudes/labs de un paciente en Athenea.
//
//  Datos de prueba: SIEMPRE sintéticos ("medico.prueba" / "ClaveFalsaXXX"),
//  nunca credenciales reales — ver instrucciones de la tarea.
//
//  Regla de oro de este banco (la aprendimos hoy con una promesa colgada):
//  todo mock de GM_xmlhttpRequest debe responder onload/onerror/ontimeout
//  para TODAS las URLs que la función bajo prueba pueda visitar, nunca solo
//  la que nos interesa. Cada camino de abajo fue verificado con
//  `node -e` contra el harness real antes de escribirse aquí.
// =====================================================================

const BASE = "https://medicosviva1a.atheneasoluciones.com";

// Credenciales SINTÉTICAS — nunca reales.
const USR = "medico.prueba";
const PWD = "ClaveFalsa123_ñá";

module.exports = {
  nombre: "Puente Athenea y credenciales (Suite 18)",
  cubre: [
    "_atheneaToken", "_atheneaIdPaciente", "_atheneaCedulaCoincide",
    "_atheneaExtraerSolicitudes", "_parseFechaEspanolLike", "_fechaDesdeNumeroSolicitud",
    "_atheneaMultipart", "_atheneaPareceLogin",
    "_gmReq", "getAtheneaSolicitudesAuto", "getAtheneaLabsAuto",
    "_vglEsModuloLab", "_vglMarcarLectura",
    "atheneaKeepAlive", "atheneaAutoLogin",
    "atheneaCredsGet", "atheneaCredsSet", "atheneaCredsClear",
    "_vglXor", "_vglOfusca", "_vglDesofusca",
  ],

  async pruebas(t, api, env, cargar) {
    // Entorno con GM_xmlhttpRequest intercambiable + registro de llamadas.
    function entornoAthenea() {
      const llamadas = [];
      let plan = (o) => o.onload({ status: 200, responseText: "" });
      const c = cargar({ silencioso: true, gmxhr: (o) => { llamadas.push(o); plan(o); } });
      return { c, llamadas, setPlan: (f) => { plan = f; } };
    }
    // Instala un espía de consola sobre el contexto YA cargado (silencioso:true deja un
    // stub no-op; lo reemplazamos para poder verificar mensajes de diagnóstico).
    function espiarConsola(c) {
      const logs = [];
      c.ctx.console = {
        log: (...a) => logs.push(a.join(" ")),
        warn: (...a) => logs.push("WARN:" + a.join(" ")),
        error: (...a) => logs.push("ERROR:" + a.join(" ")),
        info: (...a) => logs.push(a.join(" ")),
      };
      return logs;
    }

    // =====================================================================
    // _atheneaMultipart
    // =====================================================================
    t.caso("_atheneaMultipart: arma el cuerpo con boundary, un bloque por campo y cierre final", () => {
      const mp = api._atheneaMultipart({ tipoId: "0", numId: "123456789", vacio: null });
      t.cierto(typeof mp.boundary === "string" && mp.boundary.indexOf("----VglAthenea") === 0);
      t.cierto(mp.body.indexOf(`--${mp.boundary}\r\nContent-Disposition: form-data; name="tipoId"\r\n\r\n0\r\n`) >= 0);
      t.cierto(mp.body.indexOf(`name="numId"\r\n\r\n123456789\r\n`) >= 0, "el valor del campo va tal cual");
      t.cierto(mp.body.indexOf(`name="vacio"\r\n\r\n\r\n`) >= 0, "null se serializa como cadena vacía, no la palabra null");
      t.cierto(mp.body.lastIndexOf(`--${mp.boundary}--\r\n`) === mp.body.length - (`--${mp.boundary}--\r\n`).length, "cierra con el boundary final");
    });

    t.caso("_atheneaMultipart: cada llamada genera un boundary distinto (no se reutiliza al azar)", () => {
      const a = api._atheneaMultipart({ x: "1" });
      const b = api._atheneaMultipart({ x: "1" });
      t.cierto(a.boundary !== b.boundary);
    });

    // =====================================================================
    // _atheneaToken
    // =====================================================================
    t.caso("_atheneaToken: lo encuentra con name antes de value (orden real del formulario de Athenea)", () => {
      const html = `<input name="__RequestVerificationToken" type="hidden" value="TOK-ABC123" />`;
      t.igual(api._atheneaToken(html), "TOK-ABC123");
    });

    t.caso("_atheneaToken: también lo encuentra con value antes de name (segunda respuesta del flujo, orden distinto)", () => {
      const html = `<input value="TOK-XYZ789" type="hidden" name="__RequestVerificationToken" />`;
      t.igual(api._atheneaToken(html), "TOK-XYZ789");
    });

    t.caso("_atheneaToken: sin el campo en el HTML, cadena vacía (nunca null ni excepción)", () => {
      t.igual(api._atheneaToken("<div>página sin formulario</div>"), "");
      t.noLanza(() => api._atheneaToken(""));
    });

    // =====================================================================
    // _atheneaIdPaciente
    // =====================================================================
    t.caso("_atheneaIdPaciente: lee el value del <input name=\"IdPaciente\">", () => {
      const html = `<input type="hidden" id="IdPaciente" name="IdPaciente" value="4567" />`;
      t.igual(api._atheneaIdPaciente(html), "4567");
    });

    t.caso("_atheneaIdPaciente: input presente pero value vacío -> cadena vacía (no un paciente)", () => {
      const html = `<input type="hidden" name="IdPaciente" value="" />`;
      t.igual(api._atheneaIdPaciente(html), "");
    });

    t.caso("_atheneaIdPaciente: sin el input en el HTML -> cadena vacía", () => {
      t.igual(api._atheneaIdPaciente("<div>sin coincidencia única</div>"), "");
    });

    // =====================================================================
    // _atheneaCedulaCoincide
    // =====================================================================
    t.caso("_atheneaCedulaCoincide: prefijo de tipo de documento (CC/TI/...) seguido de la misma cédula -> true", () => {
      t.cierto(api._atheneaCedulaCoincide("<div>CC: 123456789</div>", "123456789"));
      t.cierto(api._atheneaCedulaCoincide("<span>TI - 55667788</span>", "55667788"));
    });

    t.caso("_atheneaCedulaCoincide: prefijo presente pero con OTRA cédula -> false (no confía a medias)", () => {
      t.falso(api._atheneaCedulaCoincide("<div>CC: 987654321</div>", "123456789"));
    });

    t.caso("_atheneaCedulaCoincide: sin prefijo reconocible, cae al respaldo de coincidencia por palabra completa", () => {
      t.cierto(api._atheneaCedulaCoincide("<div>Documento 123456789 registrado</div>", "123456789"));
    });

    t.caso("_atheneaCedulaCoincide: el respaldo NO casa un número más largo que solo contiene la cédula como substring", () => {
      t.falso(api._atheneaCedulaCoincide("<div>1234567890</div>", "123456789"), "123456789 embebido en 1234567890 no es la misma cédula");
    });

    t.caso("_atheneaCedulaCoincide: sin cédula a comparar, siempre false (nunca confía por defecto)", () => {
      t.falso(api._atheneaCedulaCoincide("<div>CC: 123456789</div>", ""));
      t.falso(api._atheneaCedulaCoincide("<div>CC: 123456789</div>", null));
    });

    // =====================================================================
    // _atheneaExtraerSolicitudes
    // =====================================================================
    t.caso("_atheneaExtraerSolicitudes: lee varias tarjetas, separa idSolicitud del año final y respeta data-modulo", () => {
      const html = `
        <form id="1112025" data-modulo="LAB" action="/Resultados/Reporte" method="post"></form>
        <form id="2222024" data-modulo="PAT" action="/Resultados/Reporte" method="post"></form>
      `;
      const out = api._atheneaExtraerSolicitudes(html);
      // v12.3.35 — fechaIso: null cuando la tarjeta no muestra ninguna fecha reconocible.
      t.igual(out, [
        { idSolicitud: 111, ano: 2025, modulo: "LAB", fechaIso: null, horaTxt: null, hash: null, token: null },
        { idSolicitud: 222, ano: 2024, modulo: "PAT", fechaIso: null, horaTxt: null, hash: null, token: null },
      ]);
    });

    t.caso("_atheneaExtraerSolicitudes: sin data-modulo, asume LAB por defecto", () => {
      const html = `<form id="3332026" action="/Resultados/Reporte"></form>`;
      t.igual(api._atheneaExtraerSolicitudes(html), [{ idSolicitud: 333, ano: 2026, modulo: "LAB", fechaIso: null, horaTxt: null, hash: null, token: null }]);
    });

    t.caso("_atheneaExtraerSolicitudes: ignora formularios que no apuntan a /Resultados/Reporte", () => {
      const html = `<form id="4442026" action="/Resultados/Otro"></form>`;
      t.igual(api._atheneaExtraerSolicitudes(html), []);
    });

    t.caso("_atheneaExtraerSolicitudes: HTML vacío o sin formularios -> arreglo vacío, nunca lanza", () => {
      t.igual(api._atheneaExtraerSolicitudes(""), []);
      t.noLanza(() => api._atheneaExtraerSolicitudes("<div>nada</div>"));
    });

    // =====================================================================
    // v12.5.4 — Fecha REAL de Athenea: "vie. 15 may. 2026 07:31 a. m." (texto plano,
    // confirmado con captura de pantalla y volcado de HTML en consultorio real).
    // =====================================================================
    t.caso("_parseFechaEspanolLike: reconoce día de la semana + día + mes en letras + año, con hora", () => {
      t.igual(api._parseFechaEspanolLike("vie. 15 may. 2026 07:31 a. m."), [{ iso: "2026-05-15", hora: "07:31" }]);
      t.igual(api._parseFechaEspanolLike("sáb. 25 abr. 2026 07:06 a. m."), [{ iso: "2026-04-25", hora: "07:06" }]);
      t.igual(api._parseFechaEspanolLike("mar. 3 feb. 2026 08:06 a. m."), [{ iso: "2026-02-03", hora: "08:06" }]);
      t.igual(api._parseFechaEspanolLike("vie. 26 dic. 2025 08:11 a. m."), [{ iso: "2025-12-26", hora: "08:11" }]);
    });

    t.caso("_parseFechaEspanolLike: hora p. m. convierte a 24h; sin hora adjunta, hora null", () => {
      t.igual(api._parseFechaEspanolLike("jue. 1 oct. 2026 03:15 p. m."), [{ iso: "2026-10-01", hora: "15:15" }]);
      t.igual(api._parseFechaEspanolLike("jue. 1 oct. 2026"), [{ iso: "2026-10-01", hora: null }]);
    });

    t.caso("_parseFechaEspanolLike: rechaza una fecha imposible (31 de febrero) en vez de normalizarla en silencio", () => {
      t.igual(api._parseFechaEspanolLike("dom. 31 feb. 2026 07:00 a. m."), []);
    });

    t.caso("_parseFechaEspanolLike: sin coincidencia -> arreglo vacío, nunca lanza", () => {
      t.igual(api._parseFechaEspanolLike("texto sin ninguna fecha"), []);
      t.noLanza(() => api._parseFechaEspanolLike(""));
    });

    t.caso("_fechaDesdeNumeroSolicitud: los 6 primeros dígitos de 'Numero:' son año-mes-día (verificado 4/4 en campo)", () => {
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26051503125"), "2026-05-15");
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26042502051"), "2026-04-25");
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26020304371"), "2026-02-03");
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 25122602509"), "2025-12-26");
    });

    t.caso("_fechaDesdeNumeroSolicitud: mes o día fuera de rango, o sin 'Numero:' -> null (nunca adivina)", () => {
      t.igual(api._fechaDesdeNumeroSolicitud("Numero: 26139903125"), null); // mes 13, día 99
      t.igual(api._fechaDesdeNumeroSolicitud("sin numero aquí"), null);
    });

    t.caso("_atheneaExtraerSolicitudes: tarjeta REAL de Athenea (formato español + Numero de respaldo) -> fecha y hora correctas", () => {
      // HTML condensado de la captura real de consultorio (2026-08-11), sin las rutas
      // SVG de los íconos (no aportan nada a la extracción).
      const html = `
        <div class="card text-dark bg-succes mb-5">
          <div class="card-header p-10"><strong>SOLICITUD DE LABORATORIO</strong></div>
          <div class="card-body p-10">
            <div class="card-text no-margin"><strong>vie. 15 may. 2026 07:31 a.&nbsp;m.</strong></div>
            <div class="card-title no-margin">Numero: 26051503125</div>
            <div class="card-title no-margin">Estado: Solicitud Completa</div>
          </div>
          <div class="card-footer no-padding">
            <span class="p-10" data-toggle="collapse" onclick="getDetalleSolicitud(this, 'LAB', 846567, 2026, 'True' )" href="#collapse8465672026LAB">Ver Resumen</span>
            <form id="8465672026" data-modulo="LAB" action="/Resultados/Reporte" method="post">
              <input type="hidden" id="hash" name="hash" value="AED1F6E0B7E9" />
              <button type="submit" class="btn btn-primary float-right btn-xs">Ver Informe</button>
              <input name="__RequestVerificationToken" type="hidden" value="TOKEN-XYZ" />
            </form>
          </div>
        </div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out, [{ idSolicitud: 846567, ano: 2026, modulo: "LAB", fechaIso: "2026-05-15", horaTxt: "07:31", hash: "AED1F6E0B7E9", token: "TOKEN-XYZ" }]);
    });

    t.caso("_atheneaExtraerSolicitudes: si el texto en español y el 'Numero' de la MISMA tarjeta discrepan, se descarta la fecha entera", () => {
      // Numero dice 2026-05-16 (día 16), el texto dice día 15: conflicto real entre
      // las dos fuentes -> mejor ninguna fecha que arriesgar cuál tiene razón.
      const html = `
        <div class="card">
          <div class="card-text no-margin"><strong>vie. 15 may. 2026 07:31 a. m.</strong></div>
          <div class="card-title no-margin">Numero: 26051603125</div>
          <form id="8465672026" data-modulo="LAB" action="/Resultados/Reporte"></form>
        </div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out[0].fechaIso, null, "conflicto entre las dos fuentes -> sin fecha");
      t.igual(out[0].horaTxt, null);
    });

    t.caso("_atheneaExtraerSolicitudes: solo 'Numero' (sin el texto en español) -> respaldo válido, sin hora", () => {
      const html = `<div class="card">Numero: 26051503125<form id="8465672026" data-modulo="LAB" action="/Resultados/Reporte"></form></div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out[0].fechaIso, "2026-05-15");
      t.igual(out[0].horaTxt, null, "el campo Numero no trae hora");
    });

    // =====================================================================
    // v12.5.5 — BLOQUEANTE de la revisión adversarial: la ventana de búsqueda de fecha
    // (antes -3000/+700 fijo, sin más guarda) rutinariamente cubría 2-3 tarjetas
    // ANTERIORES en una lista real de solicitudes, y _fechaDesdeNumeroSolicitud (sin /g)
    // devolvía el PRIMER "Numero:" de esa ventana compartida — el de la tarjeta VECINA,
    // no el de la propia. Confirmado 8/9 tarjetas mal en un repro de 9 solicitudes
    // reales. El fix acota cada ventana por la posición de la tarjeta anterior/siguiente.
    // =====================================================================
    function tarjetaReal({ idSolicitud, ano, dia, mesTxt, hora, numero, hash, token }) {
      // Mismo esqueleto que la tarjeta real de consultorio (2026-08-11), solo cambian
      // los valores — ~900 caracteres por tarjeta, igual que en producción, para que la
      // prueba reproduzca el tamaño real de ventana en vez de un fixture artificialmente
      // corto que ocultaría el bug de acotado hacia adelante.
      return `
        <div class="card text-dark bg-succes mb-5">
          <div class="card-header p-10"><strong>SOLICITUD DE LABORATORIO</strong></div>
          <div class="card-body p-10">
            <div class="card-text no-margin"><strong>${dia} ${mesTxt} ${ano} ${hora} a.&nbsp;m.</strong></div>
            <div class="card-title no-margin">Numero: ${numero}</div>
            <div class="card-title no-margin">Estado: Solicitud Completa</div>
            <div class="card-title no-margin">Relleno para simular el resto de campos que Athenea agrega en cada tarjeta real (tipo de examen, sede, profesional que ordena, observaciones administrativas) y que no aportan nada a la extracción de fecha.</div>
          </div>
          <div class="card-footer no-padding">
            <span class="p-10" data-toggle="collapse" onclick="getDetalleSolicitud(this, 'LAB', ${idSolicitud}, ${ano}, 'True' )" href="#collapse${idSolicitud}${ano}LAB">Ver Resumen</span>
            <form id="${idSolicitud}${ano}" data-modulo="LAB" action="/Resultados/Reporte" method="post">
              <input type="hidden" id="hash" name="hash" value="${hash}" />
              <button type="submit" class="btn btn-primary float-right btn-xs">Ver Informe</button>
              <input name="__RequestVerificationToken" type="hidden" value="${token}" />
            </form>
          </div>
        </div>`;
    }

    t.caso("_atheneaExtraerSolicitudes: 2 tarjetas vecinas del mismo año -> cada una conserva SU fecha y SU hash/token, nunca los de la vecina", () => {
      const c1 = tarjetaReal({ idSolicitud: 111, ano: 2026, dia: "lun.", mesTxt: "5 ene.", hora: "08:00", numero: "26010512345", hash: "HASH-A", token: "TOK-A" });
      const c2 = tarjetaReal({ idSolicitud: 222, ano: 2026, dia: "jue.", mesTxt: "12 feb.", hora: "09:15", numero: "26021212345", hash: "HASH-B", token: "TOK-B" });
      const out = api._atheneaExtraerSolicitudes(c1 + c2);
      t.igual(out.length, 2);
      t.igual(out[0], { idSolicitud: 111, ano: 2026, modulo: "LAB", fechaIso: "2026-01-05", horaTxt: "08:00", hash: "HASH-A", token: "TOK-A" }, "tarjeta 1: su propia fecha y su propio hash/token, no los de la tarjeta 2");
      t.igual(out[1], { idSolicitud: 222, ano: 2026, modulo: "LAB", fechaIso: "2026-02-12", horaTxt: "09:15", hash: "HASH-B", token: "TOK-B" }, "tarjeta 2: su propia fecha y su propio hash/token, no los de la tarjeta 1");
    });

    t.caso("_atheneaExtraerSolicitudes: 3 tarjetas del mismo año en cadena -> ninguna hereda la fecha ni el hash de una vecina (repro del hallazgo bloqueante, 8/9 mal en el original)", () => {
      const c1 = tarjetaReal({ idSolicitud: 111, ano: 2026, dia: "lun.", mesTxt: "5 ene.", hora: "08:00", numero: "26010512345", hash: "HASH-A", token: "TOK-A" });
      const c2 = tarjetaReal({ idSolicitud: 222, ano: 2026, dia: "jue.", mesTxt: "12 feb.", hora: "09:15", numero: "26021212345", hash: "HASH-B", token: "TOK-B" });
      const c3 = tarjetaReal({ idSolicitud: 333, ano: 2026, dia: "mié.", mesTxt: "20 mar.", hora: "10:30", numero: "26032012345", hash: "HASH-C", token: "TOK-C" });
      const out = api._atheneaExtraerSolicitudes(c1 + c2 + c3);
      t.igual(out.length, 3);
      t.igual(out.map((s) => s.hash), ["HASH-A", "HASH-B", "HASH-C"], "el hash de cada tarjeta es el suyo propio, en orden");
      t.igual(out.map((s) => s.token), ["TOK-A", "TOK-B", "TOK-C"]);
      // La fecha de la tarjeta del MEDIO (2) es la más expuesta a contaminación por ambos
      // lados (vecina anterior Y siguiente) — es la que el bug original rompía primero.
      t.igual(out[1].fechaIso, "2026-02-12", "la tarjeta del medio no hereda la fecha de la 1 ni de la 3");
      t.igual(out[2].fechaIso, "2026-03-20");
    });

    // =====================================================================
    // v12.5.9 — SEGUNDA variante REAL de tarjeta (consola de campo, 11-08-2026, paciente
    // con 11 solicitudes): el <form> ENVUELVE el contenido — fecha y "Numero" van DENTRO
    // del formulario, tras su apertura, y los formularios consecutivos quedan pegados
    // (</form><form>) sin divs de tarjeta entre ellos. El recorte de v12.5.5 dejaba a
    // cada tarjeta sin su fecha Y la regalaba a la ventana trasera de la SIGUIENTE.
    // =====================================================================
    function tarjetaEnvolvente({ idSolicitud, ano, fechaTxt, hora, numero, hash, token }) {
      // Calcada del volcado real de consola: hash al inicio, fecha+Numero dentro,
      // Ver Resumen/Ver Informe, collapse vacío, y el token al FINAL del formulario.
      return `<form id="${idSolicitud}${ano}" data-modulo="LAB" action="/Resultados/Reporte" method="post">
          <input type="hidden" id="hash" name="hash" value="${hash}" />
          <div class="card-text no-margin"><strong>${fechaTxt} ${hora} a.&nbsp;m.</strong></div>
          <div class="card-title no-margin">Numero: ${numero}</div>
          <div class="card-title no-margin">Estado: Solicitud Completa</div>
          <span class="p-10" data-toggle="collapse" onclick="getDetalleSolicitud(this, 'LAB', ${idSolicitud}, ${ano}, 'True' )" href="#collapse${idSolicitud}${ano}LAB"><i class="fa fa-caret-down cursor-pointer" aria-hidden="true"></i> <span class="cursor-pointer">Ver Resumen</span></span>
          <button type="submit" class="btn btn-primary float-right btn-xs" style=" margin-right: 10px;"><i class="far fa-file-alt"></i> Ver Informe</button>
          <div class="collapse" id="collapse${idSolicitud}${ano}LAB">
            <div class="card card-body bg-light p-5" style="width:100%; margin-top: 5px;" id="dv${idSolicitud}${ano}LAB" data-id-Estado="3" data-muestra-pendiente="True"></div>
          </div>
          <input name="__RequestVerificationToken" type="hidden" value="${token}" /></form>`;
    }

    t.caso("_atheneaExtraerSolicitudes v12.5.9: variante ENVOLVENTE (el form envuelve la tarjeta) -> la fecha DENTRO del formulario sí se extrae, con hora, hash y token", () => {
      const html = `<div id="solicitudes" class="tab-pane active"><div class="row"><div class="col-md-6 col-xs-12 p-5"><div class="card"><div class="card-body p-5">` +
        tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-ENV", token: "TOK-ENV" }) +
        `</div></div></div></div></div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out, [{ idSolicitud: 1330106, ano: 2026, modulo: "LAB", fechaIso: "2026-08-04", horaTxt: "06:02", hash: "HASH-ENV", token: "TOK-ENV" }]);
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: 2 tarjetas envolventes PEGADAS (</form><form>) del mismo año -> cada una conserva SU fecha, jamás la de la vecina (repro exacto del fallo de campo)", () => {
      // En campo: la tarjeta 1 quedaba SIN fecha (su fecha estaba tras la apertura de su
      // form, fuera de la ventana de v12.5.5) y la tarjeta 2 ADOPTABA la fecha de la 1
      // (que caía en su ventana trasera con el año coincidente).
      const c1 = tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-1", token: "TOK-1" });
      const c2 = tarjetaEnvolvente({ idSolicitud: 763563, ano: 2026, fechaTxt: "jue. 12 feb. 2026", hora: "09:15", numero: "26021201234", hash: "HASH-2", token: "TOK-2" });
      const out = api._atheneaExtraerSolicitudes(c1 + "\r\n" + c2);
      t.igual(out.length, 2);
      t.igual(out[0], { idSolicitud: 1330106, ano: 2026, modulo: "LAB", fechaIso: "2026-08-04", horaTxt: "06:02", hash: "HASH-1", token: "TOK-1" }, "la tarjeta 1 recupera SU propia fecha (en campo quedaba sin fecha)");
      t.igual(out[1], { idSolicitud: 763563, ano: 2026, modulo: "LAB", fechaIso: "2026-02-12", horaTxt: "09:15", hash: "HASH-2", token: "TOK-2" }, "la tarjeta 2 conserva SU fecha (en campo adoptaba la de la tarjeta 1)");
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: variante envolvente Y variante clásica MEZCLADAS en la misma página -> ambas extraen bien", () => {
      const clasica = tarjetaReal({ idSolicitud: 555, ano: 2026, dia: "lun.", mesTxt: "5 ene.", hora: "08:00", numero: "26010512345", hash: "HASH-CLAS", token: "TOK-CLAS" });
      const envolvente = tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-ENV", token: "TOK-ENV" });
      const out = api._atheneaExtraerSolicitudes(clasica + envolvente);
      t.igual(out.length, 2);
      t.igual(out[0].fechaIso, "2026-01-05");
      t.igual(out[0].hash, "HASH-CLAS");
      t.igual(out[1].fechaIso, "2026-08-04");
      t.igual(out[1].hash, "HASH-ENV");
      t.igual(out[1].token, "TOK-ENV");
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: formulario envolvente SIN fecha propia junto a uno CON fecha del mismo año -> el vacío queda sin fecha, nunca hereda la del vecino", () => {
      const conFecha = tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-1", token: "TOK-1" });
      const sinFecha = `<form id="7635632026" data-modulo="LAB" action="/Resultados/Reporte" method="post"><input type="hidden" id="hash" name="hash" value="HASH-2" /><span>Ver Resumen</span><input name="__RequestVerificationToken" type="hidden" value="TOK-2" /></form>`;
      const out = api._atheneaExtraerSolicitudes(conFecha + sinFecha);
      t.igual(out[0].fechaIso, "2026-08-04");
      t.igual(out[1].fechaIso, null, "sin fecha propia -> sin fecha, aunque el vecino tenga una del mismo año");
      t.igual(out[1].hash, "HASH-2", "el hash sí es el suyo propio");
    });

    // =====================================================================
    // v12.5.9 — Revisión adversarial del propio fix (8/8 confirmados): cada prueba de
    // este bloque reproduce un hallazgo con repro ejecutable de esa revisión.
    // =====================================================================
    t.caso("_atheneaExtraerSolicitudes v12.5.9: cierre '</form >' (espacio antes de '>', válido en HTML) -> las fronteras NO se pierden y ambas tarjetas conservan su fecha", () => {
      const c1 = tarjetaReal({ idSolicitud: 111, ano: 2026, dia: "lun.", mesTxt: "5 ene.", hora: "08:00", numero: "26010512345", hash: "HASH-A", token: "TOK-A" }).replace(/<\/form>/g, "</form >");
      const c2 = tarjetaReal({ idSolicitud: 222, ano: 2026, dia: "jue.", mesTxt: "12 feb.", hora: "09:15", numero: "26021212345", hash: "HASH-B", token: "TOK-B" }).replace(/<\/form>/g, "</form\n>");
      const out = api._atheneaExtraerSolicitudes(c1 + c2);
      t.igual(out[0].fechaIso, "2026-01-05", "cierre con espacio antes de '>' se reconoce igual");
      t.igual(out[1].fechaIso, "2026-02-12", "cierre con salto de línea antes de '>' se reconoce igual");
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: cierre '</FORM>' en mayúsculas -> se reconoce igual (clava la bandera /i del barrido de cierres)", () => {
      const c1 = tarjetaReal({ idSolicitud: 111, ano: 2026, dia: "lun.", mesTxt: "5 ene.", hora: "08:00", numero: "26010512345", hash: "HASH-A", token: "TOK-A" }).replace(/<\/form>/g, "</FORM>");
      const c2 = tarjetaReal({ idSolicitud: 222, ano: 2026, dia: "jue.", mesTxt: "12 feb.", hora: "09:15", numero: "26021212345", hash: "HASH-B", token: "TOK-B" }).replace(/<\/form>/g, "</FORM>");
      const out = api._atheneaExtraerSolicitudes(c1 + c2);
      t.igual(out[0].fechaIso, "2026-01-05");
      t.igual(out[1].fechaIso, "2026-02-12");
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: un form AJENO (no /Resultados/Reporte) con su propio </form> antes de las tarjetas -> no desplaza ninguna frontera (hallazgo: el emparejamiento por 'primer cierre posterior' no estaba clavado)", () => {
      // El __AjaxAntiForgeryForm de ASP.NET MVC es un form real de estas páginas: su
      // cierre NO debe contarse como frontera de ninguna tarjeta de solicitud.
      const ajeno = `<form action="/Account/AjaxLogOff" id="__AjaxAntiForgeryForm" method="post"><input name="__RequestVerificationToken" type="hidden" value="TOK-AJENO" /></form>`;
      const c1 = tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-1", token: "TOK-1" });
      const c2 = tarjetaEnvolvente({ idSolicitud: 763563, ano: 2026, fechaTxt: "jue. 12 feb. 2026", hora: "09:15", numero: "26021201234", hash: "HASH-2", token: "TOK-2" });
      const out = api._atheneaExtraerSolicitudes(ajeno + c1 + c2);
      t.igual(out.length, 2, "el form ajeno no produce solicitud (su id no es numérico+año)");
      t.igual(out[0], { idSolicitud: 1330106, ano: 2026, modulo: "LAB", fechaIso: "2026-08-04", horaTxt: "06:02", hash: "HASH-1", token: "TOK-1" });
      t.igual(out[1], { idSolicitud: 763563, ano: 2026, modulo: "LAB", fechaIso: "2026-02-12", horaTxt: "09:15", hash: "HASH-2", token: "TOK-2" });
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: formulario intermedio SIN cierre (averiado/truncado) -> NO adopta la fecha ni el hash de la tarjeta vecina, y la vecina conserva los suyos (hallazgo ALTA de la revisión del fix)", () => {
      // Sin la cota 'cierre <= apertura siguiente', al form averiado se le asignaba el
      // cierre de la tarjeta VECINA: adoptaba su fecha (2026-08-04 escrita en la solicitud
      // equivocada) y hasta su hash/token; la vecina quedaba con ventana vacía.
      const averiado = `<form id="7635632026" data-modulo="LAB" action="/Resultados/Reporte" method="post"><input type="hidden" id="hash" name="hash" value="HASH-AVERIADO" /><span>Ver Resumen</span>`;
      const intacta = tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-OK", token: "TOK-OK" });
      const out = api._atheneaExtraerSolicitudes(averiado + intacta);
      t.igual(out[0].fechaIso, null, "el averiado queda sin fecha — jamás con la de la vecina");
      t.igual(out[0].hash, "HASH-AVERIADO", "conserva su propio hash, no el de la vecina");
      t.igual(out[0].token, null, "su token se perdió con el truncado: null, no el de la vecina");
      t.igual(out[1].fechaIso, "2026-08-04", "la tarjeta intacta conserva su propia fecha");
      t.igual(out[1].hash, "HASH-OK");
      t.igual(out[1].token, "TOK-OK");
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: ÚLTIMO formulario sin cierre (respuesta cortada por la red) -> la fecha se recupera con el tope de apertura+1500 (clava el respaldo, antes código sin cobertura)", () => {
      const truncada = tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-1", token: "TOK-1" }).replace(/<input name="__RequestVerificationToken"[\s\S]*$/, "");
      const out = api._atheneaExtraerSolicitudes(truncada);
      t.igual(out[0].fechaIso, "2026-08-04", "la fecha va poco después de la apertura: el tope de +1500 la alcanza");
      t.igual(out[0].horaTxt, "06:02");
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: '</form>' huérfano dentro de un comentario HTML -> NO parte la tarjeta (fecha y token propios intactos)", () => {
      const c1 = tarjetaEnvolvente({ idSolicitud: 1330106, ano: 2026, fechaTxt: "mar. 4 ago. 2026", hora: "06:02", numero: "26080401234", hash: "HASH-1", token: "TOK-1" })
        .replace(`<div class="card-text`, `<!-- legado: </form> --><div class="card-text`);
      const c2 = tarjetaEnvolvente({ idSolicitud: 763563, ano: 2026, fechaTxt: "jue. 12 feb. 2026", hora: "09:15", numero: "26021201234", hash: "HASH-2", token: "TOK-2" });
      const out = api._atheneaExtraerSolicitudes(c1 + c2);
      t.igual(out[0].fechaIso, "2026-08-04", "el cierre comentado no es frontera: la fecha propia sigue en la ventana");
      t.igual(out[0].token, "TOK-1", "el token propio sigue dentro de la frontera real");
      t.igual(out[1].fechaIso, "2026-02-12");
    });

    t.caso("_atheneaExtraerSolicitudes v12.5.9: fecha suelta del chrome de página + primera tarjeta SIN fecha propia -> con un </form> previo (form ajeno) la fecha del chrome NO se adopta", () => {
      // Sin la frontera trasera del idx 0, una "Fecha de impresión" del encabezado (del
      // año en curso, como toda solicitud reciente) se colaba en una tarjeta sin fecha.
      const chrome = `<form action="/Account/AjaxLogOff" id="__AjaxAntiForgeryForm" method="post"><span>Fecha de impresión: mar. 4 ago. 2026</span><input name="__RequestVerificationToken" type="hidden" value="TOK-AJENO" /></form>`;
      const sinFecha = `<form id="7635632026" data-modulo="LAB" action="/Resultados/Reporte" method="post"><input type="hidden" id="hash" name="hash" value="HASH-2" /><span>Ver Resumen</span><input name="__RequestVerificationToken" type="hidden" value="TOK-2" /></form>`;
      const out = api._atheneaExtraerSolicitudes(chrome + sinFecha);
      t.igual(out.length, 1);
      t.igual(out[0].fechaIso, null, "la fecha del encabezado queda tras la frontera del form ajeno: no se adopta");
      t.igual(out[0].hash, "HASH-2");
      t.igual(out[0].token, "TOK-2");
    });

    t.caso("_atheneaExtraerSolicitudes: fecha en español con año DISTINTO al declarado por la propia solicitud -> sin fecha (guarda de año, antes sin cobertura de pruebas)", () => {
      // El id de la tarjeta declara 2026, pero el texto en español dice 2025 — no debería
      // pasar jamás en Athenea real, pero si pasara, la guarda de año debe rechazarlo en
      // vez de aceptar una fecha de OTRO año.
      const html = `
        <div class="card">
          <div class="card-text no-margin"><strong>lun. 5 ene. 2025 08:00 a. m.</strong></div>
          <form id="1112026" data-modulo="LAB" action="/Resultados/Reporte"></form>
        </div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out[0].fechaIso, null, "año del texto (2025) no coincide con el año de la solicitud (2026) -> se rechaza");
    });

    t.caso("_atheneaExtraerSolicitudes: fecha numérica dd/mm/aaaa en conflicto con 'Numero' de la MISMA tarjeta -> se descarta (fix simétrico; antes solo protegía el camino español)", () => {
      // 11/08/2026 (11 de agosto) vs Numero que codifica 2026-08-12 (día 12): mismo mes,
      // día distinto -> conflicto real entre las dos fuentes de la MISMA tarjeta.
      const html = `
        <div class="card">
          <div class="card-text no-margin">11/08/2026</div>
          <div class="card-title no-margin">Numero: 26081203125</div>
          <form id="1112026" data-modulo="LAB" action="/Resultados/Reporte"></form>
        </div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out[0].fechaIso, null, "camino numérico dd/mm/aaaa ahora también se descarta ante conflicto con Numero");
    });

    t.caso("_atheneaExtraerSolicitudes: hash y token con orden value-antes-de-name en el HTML -> igual se extraen (rama de respaldo, antes sin cobertura de pruebas)", () => {
      const html = `
        <div class="card">
          <form id="1112026" data-modulo="LAB" action="/Resultados/Reporte">
            <input type="hidden" value="HASH-ORDEN-INVERSO" id="hash" name="hash" />
            <input value="TOKEN-ORDEN-INVERSO" type="hidden" name="__RequestVerificationToken" />
          </form>
        </div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out[0].hash, "HASH-ORDEN-INVERSO");
      t.igual(out[0].token, "TOKEN-ORDEN-INVERSO");
    });

    t.caso("_atheneaExtraerSolicitudes: entidad '&nbsp' sin punto y coma final -> igual se normaliza y la hora se reconoce", () => {
      // v12.5.5 — Algunas variantes de HTML omiten el ';' de cierre de la entidad (los
      // navegadores lo toleran igual). Sin el fix, "&nbsp" sin ';' quedaba SIN reemplazar
      // por espacio y rompía el parseo de "a. m." -> la hora se perdía en silencio.
      const html = `
        <div class="card">
          <div class="card-text no-margin"><strong>vie. 15 may. 2026 07:31 a.&nbspm.</strong></div>
          <form id="8465672026" data-modulo="LAB" action="/Resultados/Reporte"></form>
        </div>`;
      const out = api._atheneaExtraerSolicitudes(html);
      t.igual(out[0].fechaIso, "2026-05-15");
      t.igual(out[0].horaTxt, "07:31", "la entidad sin ';' final igual se limpia a espacio y la hora se reconoce");
    });

    // =====================================================================
    // _atheneaPareceLogin
    // =====================================================================
    t.caso("_atheneaPareceLogin: un input type=password lo delata como pantalla de login", () => {
      t.cierto(api._atheneaPareceLogin(`<input type="password" name="Password" />`));
    });

    t.caso("_atheneaPareceLogin: el texto \"Iniciar sesión\" (con o sin tilde) también lo delata", () => {
      t.cierto(api._atheneaPareceLogin("<h1>Iniciar sesión</h1>"));
      t.cierto(api._atheneaPareceLogin("<h1>Iniciar Sesion</h1>"));
    });

    t.caso("_atheneaPareceLogin: una página normal de resultados no lo dispara", () => {
      t.falso(api._atheneaPareceLogin("<div>Resultados del paciente Juan Pérez — Solicitud #111</div>"));
      t.falso(api._atheneaPareceLogin(""));
    });

    // =====================================================================
    // _gmReq
    // =====================================================================
    await t.casoAsync("_gmReq: por defecto timeout=15000 y resuelve con la respuesta cruda de GM_xmlhttpRequest", async () => {
      let visto = null;
      const c = cargar({ silencioso: true, gmxhr: (o) => { visto = o; o.onload({ status: 200, responseText: "ok" }); } });
      const r = await c.api._gmReq({ method: "GET", url: "https://x/y" });
      t.igual(visto.timeout, 15000);
      t.igual(visto.method, "GET");
      t.igual(visto.url, "https://x/y");
      t.igual(r.status, 200);
      t.igual(r.responseText, "ok");
    });

    await t.casoAsync("_gmReq: un timeout explícito pisa el valor por defecto", async () => {
      let visto = null;
      const c = cargar({ silencioso: true, gmxhr: (o) => { visto = o; o.onload({ status: 200, responseText: "" }); } });
      await c.api._gmReq({ method: "GET", url: "https://x/y", timeout: 5000 });
      t.igual(visto.timeout, 5000);
    });

    await t.casoAsync("_gmReq: onerror y ontimeout rechazan con mensajes distintos (NetErr vs Timeout)", async () => {
      const c1 = cargar({ silencioso: true, gmxhr: (o) => o.onerror() });
      let m1 = "";
      try { await c1.api._gmReq({ method: "GET", url: "https://x" }); } catch (e) { m1 = e.message; }
      t.igual(m1, "NetErr");
      const c2 = cargar({ silencioso: true, gmxhr: (o) => o.ontimeout() });
      let m2 = "";
      try { await c2.api._gmReq({ method: "GET", url: "https://x" }); } catch (e) { m2 = e.message; }
      t.igual(m2, "Timeout");
    });

    // =====================================================================
    // _vglXor / _vglOfusca / _vglDesofusca
    // =====================================================================
    t.caso("_vglXor: aplicado dos veces devuelve el original (es su propio inverso)", () => {
      const casos = ["", "a", "medico.prueba", "Clave#Falsa-123_ñáéíóú", "🩺emoji"];
      for (const s of casos) t.igual(api._vglXor(api._vglXor(s)), s, "xor(xor(s)) === s para: " + s);
    });

    t.caso("_vglOfusca/_vglDesofusca: viaje de ida y vuelta exacto, incluida tildes/símbolos/unicode", () => {
      const casos = [USR, PWD, "áéíóúÁÉÍÓÚñÑ", "s3guridad!@#$%^&*()", "日本語テスト"];
      for (const s of casos) {
        const ofuscado = api._vglOfusca(s);
        t.igual(api._vglDesofusca(ofuscado), s, "round-trip para: " + s);
        t.cierto(ofuscado !== s, "el resultado ofuscado no debe ser el texto plano: " + s);
      }
    });

    t.caso("_vglOfusca: cadena vacía no rompe el cifrado ni el descifrado", () => {
      const o = api._vglOfusca("");
      t.noLanza(() => api._vglDesofusca(o));
    });

    // =====================================================================
    // atheneaCredsGet / atheneaCredsSet / atheneaCredsClear — v12.5.2:
    // credencial ÚNICA compartida por la sede (Athenea no tiene login por médico).
    // =====================================================================
    t.caso("atheneaCredsGet: sin nada guardado al arrancar -> null", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.atheneaCredsGet(), null);
    });

    t.caso("atheneaCredsSet/Get: viaje de ida y vuelta EXACTO de usuario+contraseña, con tildes y símbolos", () => {
      const c = cargar({ silencioso: true });
      const ok = c.api.atheneaCredsSet(USR, PWD);
      t.cierto(ok);
      const leido = c.api.atheneaCredsGet();
      t.igual(leido, { u: USR, p: PWD }, "debe leerse exactamente lo guardado, sin recortes ni mojibake");
    });

    t.caso("atheneaCredsSet: en el almacén crudo (GM_setValue) NUNCA queda el texto plano de la contraseña", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet(USR, PWD);
      const crudo = JSON.stringify(c.env.gm["vgl_ath_creds"]);
      t.falso(crudo.includes(PWD), "la contraseña en claro no debe aparecer en lo persistido");
      t.falso(crudo.includes(USR), "tampoco el usuario en claro (ofuscado también)");
    });

    t.caso("atheneaCredsSet: guardar de nuevo REEMPLAZA la credencial compartida anterior (una sola por equipo)", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet("cuenta.vieja", "ClaveVieja_1");
      c.api.atheneaCredsSet("cuenta.nueva", "ClaveNueva_2");
      t.igual(c.api.atheneaCredsGet(), { u: "cuenta.nueva", p: "ClaveNueva_2" });
    });

    t.caso("atheneaCredsSet: sin usuario o sin contraseña -> false, y no toca el almacén", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api.atheneaCredsSet("", PWD));
      t.falso(c.api.atheneaCredsSet(USR, ""));
      t.igual(c.api.atheneaCredsGet(), null);
    });

    t.caso("atheneaCredsClear: borra la credencial compartida del equipo", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet(USR, PWD);
      c.api.atheneaCredsClear();
      t.igual(c.api.atheneaCredsGet(), null);
    });

    // =================================================================
    // v17.6.28 — AUDITORÍA S+ (barrido total, 24-ago-2026): atheneaCredsSet guardaba la
    // contraseña institucional compartida EN CLARO en CUATRO sitios extra (GM
    // vgl_ath_user/vgl_ath_pass y localStorage de los dos orígenes en los que corre este
    // módulo), al lado de la copia ofuscada en ATH_CRED_KEY — anulando la protección que
    // el propio comentario del código promete. La prueba de arriba ("en el almacén crudo
    // NUNCA queda el texto plano") solo miraba vgl_ath_creds (la clave CORRECTA) y nunca
    // comprobó que las claves EN CLARO no existieran — por eso el bug sobrevivió.
    // =================================================================
    t.caso("v17.6.28: atheneaCredsSet NO deja ninguna copia en claro (ni GM ni localStorage)", () => {
      const c = cargar({ silencioso: true });
      c.api.atheneaCredsSet(USR, PWD);
      t.falso(c.env.gm["vgl_ath_user"], "GM vgl_ath_user no debe existir tras guardar");
      t.falso(c.env.gm["vgl_ath_pass"], "GM vgl_ath_pass no debe existir tras guardar");
      t.falso(c.env.almacen["vgl_ath_user"], "localStorage vgl_ath_user no debe existir tras guardar");
      t.falso(c.env.almacen["vgl_ath_pass"], "localStorage vgl_ath_pass no debe existir tras guardar");
      // La credencial sigue siendo recuperable con normalidad, solo que por la vía ofuscada.
      t.igual(c.api.atheneaCredsGet(), { u: USR, p: PWD });
    });

    t.caso("v17.6.28: una credencial EN CLARO heredada de una versión vieja se migra y se borra al leerse", () => {
      const c = cargar({ silencioso: true, almacen: { vgl_ath_user: USR, vgl_ath_pass: PWD } });
      const leido = c.api.atheneaCredsGet();
      t.igual(leido, { u: USR, p: PWD }, "se sigue leyendo correctamente la primera vez (fallback heredado)");
      t.falso(c.env.almacen["vgl_ath_user"], "y queda MIGRADA: la copia en claro de localStorage se borra");
      t.falso(c.env.almacen["vgl_ath_pass"], "las dos claves en claro, no solo una");
      t.igual(c.api.atheneaCredsGet(), { u: USR, p: PWD }, "y sigue siendo recuperable después, ya por la vía ofuscada");
      const crudo = JSON.stringify(c.env.gm["vgl_ath_creds"]);
      t.falso(crudo.includes(PWD) || crudo.includes(USR), "la migración guardó la credencial ofuscada, no en claro");
    });

    // =====================================================================
    // atheneaAutoLogin — v12.5.2: ya NO depende de un médico identificado en
    // Everest (la cuenta es la misma para cualquiera que use el equipo).
    // =====================================================================
    await t.casoAsync("atheneaAutoLogin: (a) con S.atheneaAutoLogin en false no hace NADA aunque haya credenciales", async () => {
      const e = entornoAthenea();
      e.c.api.atheneaCredsSet(USR, PWD);
      e.c.api.__S.atheneaAutoLogin = false;
      const r = await e.c.api.atheneaAutoLogin();
      t.falso(r);
      t.igual(e.llamadas.length, 0, "no debe tocar la red mientras el interruptor esté apagado");
    });

    t.caso("atheneaAutoLogin: viene ENCENDIDO de fábrica", () => {
      const c = cargar({ silencioso: true });
      t.cierto(c.api.__S.atheneaAutoLogin, "el interruptor debe venir encendido de fábrica (v12.5.2)");
    });

    await t.casoAsync("atheneaAutoLogin: interruptor encendido pero SIN credenciales guardadas -> nada, y NO exige médico identificado", async () => {
      const e = entornoAthenea();
      e.c.api.__state.activeDoctor = { id: 0, name: "" }; // nadie identificado en Everest todavía
      const r = await e.c.api.atheneaAutoLogin();
      t.falso(r);
      t.igual(e.llamadas.length, 0);
    });

    await t.casoAsync("atheneaAutoLogin v12.5.8: sin credenciales guardadas, el motivo ya NO es mudo — se explica por consola (reportado en campo: 'el auto-login no hace nada y nadie dice por qué')", async () => {
      const e = entornoAthenea();
      const logs = espiarConsola(e.c);
      const r = await e.c.api.atheneaAutoLogin();
      t.falso(r);
      t.cierto(logs.some((l) => l.includes("NO tiene guardada la cuenta compartida")), "el camino sin credenciales debe decir exactamente qué falta y dónde se guarda");
    });

    await t.casoAsync("atheneaAutoLogin: (c) éxito — GET trae el token, POST con Usuario/Password/token y una respuesta sin login = sesión iniciada", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        if (o.url === BASE + "/Account/Login" && o.method === "GET") {
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-LOGIN" /></form>` });
        } else if (o.url === BASE + "/Account/Login" && o.method === "POST") {
          o.onload({ status: 302, responseText: "" });   // éxito real observado en el HAR: 302 a /Resultados
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      // Sin ningún médico identificado: el auto-login de la cuenta compartida igual funciona.
      e.c.api.__state.activeDoctor = { id: 0, name: "" };
      e.c.api.atheneaCredsSet(USR, PWD);
      const r = await e.c.api.atheneaAutoLogin();
      t.cierto(r);
      t.igual(e.llamadas.length, 2, "un GET (token) y un POST (credenciales), nada más");
      t.igual(e.llamadas[0].method, "GET");
      t.igual(e.llamadas[0].url, BASE + "/Account/Login");
      t.igual(e.llamadas[1].method, "POST");
      t.igual(e.llamadas[1].headers["Content-Type"], "application/x-www-form-urlencoded");
      t.cierto(e.llamadas[1].data.indexOf("Usuario=" + encodeURIComponent(USR)) >= 0);
      t.cierto(e.llamadas[1].data.indexOf("Password=" + encodeURIComponent(PWD)) >= 0);
      t.cierto(e.llamadas[1].data.indexOf("__RequestVerificationToken=TOK-LOGIN") >= 0);
    });

    await t.casoAsync("atheneaAutoLogin: (d) rechazo de credenciales — se marca y NO reintenta en una segunda llamada inmediata", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        if (o.url === BASE + "/Account/Login" && o.method === "GET") {
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-LOGIN" /></form>` });
        } else if (o.url === BASE + "/Account/Login" && o.method === "POST") {
          // credenciales rechazadas: Athenea vuelve a servir la pantalla de login
          o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión — credenciales inválidas` });
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      e.c.api.atheneaCredsSet(USR, "ClaveIncorrecta_000");
      const r1 = await e.c.api.atheneaAutoLogin();
      t.falso(r1);
      const llamadasTrasPrimerIntento = e.llamadas.length;
      t.igual(llamadasTrasPrimerIntento, 2, "un intento completo: GET + POST");
      // Segunda llamada INMEDIATA: no debe volver a tocar la red en absoluto.
      const r2 = await e.c.api.atheneaAutoLogin();
      t.falso(r2);
      t.igual(e.llamadas.length, llamadasTrasPrimerIntento, "cero llamadas nuevas: el bloqueo evita reintentar solo (protege la cuenta de TODA la sede)");
      // Guardar una credencial NUEVA desbloquea el reintento (atheneaCredsSet limpia el bloqueo).
      e.c.api.atheneaCredsSet(USR, PWD);
      e.setPlan((o) => {
        if (o.url === BASE + "/Account/Login" && o.method === "GET") o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-3" /></form>` });
        else if (o.url === BASE + "/Account/Login" && o.method === "POST") o.onload({ status: 302, responseText: "" });
        else o.onload({ status: 200, responseText: "" });
      });
      const r3 = await e.c.api.atheneaAutoLogin();
      t.cierto(r3, "tras re-guardar la credencial, sí se reintenta");
    });

    await t.casoAsync("atheneaAutoLogin: (e) fallo de RED (no de credenciales) no bloquea — la siguiente llamada SÍ reintenta", async () => {
      const e = entornoAthenea();
      let fallaRed = true;
      e.setPlan((o) => {
        if (o.url === BASE + "/Account/Login" && o.method === "GET") {
          if (fallaRed) { o.onerror(); return; }
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-2" /></form>` });
        } else if (o.url === BASE + "/Account/Login" && o.method === "POST") {
          o.onload({ status: 302, responseText: "" });
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      e.c.api.atheneaCredsSet(USR, PWD);
      const r1 = await e.c.api.atheneaAutoLogin();
      t.falso(r1, "el GET falló por red: no hay sesión");
      t.igual(e.llamadas.length, 1, "solo el GET que falló; nunca llegó a intentar el POST");
      fallaRed = false;   // la red se recupera
      const r2 = await e.c.api.atheneaAutoLogin();
      t.cierto(r2, "sin bloqueo permanente, el siguiente intento sí puede tener éxito");
      t.igual(e.llamadas.length, 3, "GET fallido + GET ok + POST ok");
    });

    // =====================================================================
    // atheneaKeepAlive
    // =====================================================================
    await t.casoAsync("atheneaKeepAlive: sesión viva — un solo GET liviano a BusquedaPaciente, sin marcar caída", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => o.onload({ status: 200, responseText: "<html>Bienvenido, resultados de laboratorio</html>" }));
      const logs = espiarConsola(e.c);
      await e.c.api.atheneaKeepAlive();
      t.igual(e.llamadas.length, 1);
      t.igual(e.llamadas[0].url, BASE + "/Resultados/BusquedaPaciente");
      t.cierto(logs.some((l) => l.includes("sesión ACTIVA")), "debe registrar que la sesión sigue activa");
    });

    await t.casoAsync("atheneaKeepAlive: sesión caída (paso 1 devuelve pantalla de login) y con auto-login apagado, se queda caída", async () => {
      const e = entornoAthenea();
      e.c.api.__S.atheneaAutoLogin = false; // v12.5.2: viene encendido de fábrica; se apaga explícito para este caso
      e.setPlan((o) => o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` }));
      const logs = espiarConsola(e.c);
      await e.c.api.atheneaKeepAlive();
      t.igual(e.llamadas.length, 1, "sin auto-login no hay llamadas extra de /Account/Login");
      t.cierto(logs.some((l) => l.includes("sesión NO activa") || l.includes("NO activa")));
    });

    await t.casoAsync("atheneaKeepAlive: al REVIVIR la sesión (estaba caída y ahora responde bien), resetea el estado para que el robot reintente", async () => {
      const e = entornoAthenea();
      let viva = false;
      e.setPlan((o) => {
        if (viva) o.onload({ status: 200, responseText: "<html>Resultados</html>" });
        else o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` });
      });
      const logs = espiarConsola(e.c);
      await e.c.api.atheneaKeepAlive();
      t.cierto(logs.some((l) => l.includes("NO activa")), "primer latido: cae");
      viva = true;
      logs.length = 0;
      await e.c.api.atheneaKeepAlive();
      t.cierto(logs.some((l) => l.includes("sesión ACTIVA")), "segundo latido: revive");
      t.cierto(logs.some((l) => l.includes("sesión restaurada") && l.includes("reintentará")),
        "el mensaje que acompaña el reseteo de lastAutoFetchedDoc debe aparecer SOLO al pasar de caída a viva");
    });

    await t.casoAsync("atheneaKeepAlive: sesión caída + auto-login encendido con credenciales válidas -> intenta loguear DENTRO del mismo latido y queda viva", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) {
          o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` });   // el chequeo del latido ve la sesión caída
        } else if (url.includes("/Account/Login") && o.method === "GET") {
          o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="T" /></form>` });
        } else if (url.includes("/Account/Login") && o.method === "POST") {
          o.onload({ status: 302, responseText: "" });
        } else {
          o.onload({ status: 200, responseText: "" });
        }
      });
      e.c.api.__S.atheneaAutoLogin = true;
      e.c.api.atheneaCredsSet(USR, PWD);
      const logs = espiarConsola(e.c);
      await e.c.api.atheneaKeepAlive();
      t.igual(e.llamadas.length, 3, "GET BusquedaPaciente (caída) + GET/POST de Account/Login (auto-login)");
      t.cierto(logs.some((l) => l.includes("sesión iniciada automáticamente")), "el auto-login debió correr dentro del latido");
      t.cierto(logs.some((l) => l.includes("sesión ACTIVA")), "el latido termina reportando la sesión como viva, no caída");
    });

    // =====================================================================
    // getAtheneaSolicitudesAuto / getAtheneaLabsAuto
    // =====================================================================
    const DOC = "111222333";

    function planFeliz(o) {
      const url = String(o.url || "");
      if (url.includes("BusquedaPaciente")) {
        o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
      } else if (url.includes("BuscarPaciente")) {
        o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
      } else if (url.includes("DatosPaciente")) {
        o.onload({
          status: 200,
          responseText: `CC: ${DOC} <form id="5552026" data-modulo="LAB" action="/Resultados/Reporte"></form>`,
        });
      } else if (url.includes("consultaDetalleSolicitud")) {
        o.onload({
          status: 200,
          responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO" }]) }),
        });
      } else {
        o.onload({ status: 200, responseText: "" });
      }
    }

    await t.casoAsync("getAtheneaSolicitudesAuto: camino feliz completo — 3 pasos (GET+2 POST multipart) y devuelve idPaciente+solicitudes", async () => {
      const e = entornoAthenea();
      e.setPlan(planFeliz);
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, { idPaciente: "999", solicitudes: [{ idSolicitud: 555, ano: 2026, modulo: "LAB", fechaIso: null, horaTxt: null, hash: null, token: null }] });
      t.igual(e.llamadas.length, 3);
      t.igual(e.llamadas[0].method, "GET");
      t.cierto(e.llamadas[0].url.includes("/Resultados/BusquedaPaciente"));
      t.igual(e.llamadas[1].method, "POST");
      t.cierto(e.llamadas[1].url.includes("/Resultados/BuscarPaciente"));
      t.cierto(e.llamadas[1].headers["Content-Type"].indexOf("multipart/form-data; boundary=") === 0);
      t.cierto(e.llamadas[1].data.includes(`name="numId"\r\n\r\n${DOC}`), "manda la cédula en numId");
      t.cierto(e.llamadas[1].data.includes(`name="tipoId"\r\n\r\n0`), "tipoId=0 es Cédula de Ciudadanía");
      t.igual(e.llamadas[2].method, "POST");
      t.cierto(e.llamadas[2].url.includes("/Resultados/DatosPaciente"));
      t.cierto(e.llamadas[2].data.includes(`name="IdPaciente"\r\n\r\n999`), "usa el IdPaciente devuelto por el paso 2, no uno inventado");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sesión caída — paso 1 devuelve pantalla de login -> null, una sola llamada", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` }));
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null);
      t.igual(e.llamadas.length, 1, "se detiene en el primer paso, no sigue adivinando");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sesión caduca A MITAD de la búsqueda (paso 2 con login) -> null, dos llamadas", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` });
        else o.onload({ status: 200, responseText: "" });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null);
      t.igual(e.llamadas.length, 2);
    });

    await t.casoAsync("v18.1 (M2M f29): sesión caída A MITAD baja la bandera atheneaSesionViva — el paso 2 con login no la deja en true", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null, "precondición: la búsqueda se aborta");
      t.cierto(typeof e.c.api._atheneaSesionVivaParaTest === "function", "el accessor de prueba existe");
      t.igual(e.c.api._atheneaSesionVivaParaTest(), false,
        "el paso 2 devolvió login: la bandera queda en false (antes quedaba en su valor previo y el keep-alive seguía en cadencia de sesión viva)");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sin IdPaciente único en el paso 2 (0 o varios resultados) -> null, no adivina", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<div>0 resultados</div>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null);
      t.igual(e.llamadas.length, 2, "sin idPaciente ni token no continúa al paso 3");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: la cédula de la respuesta NO coincide con la buscada -> null por seguridad", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="777" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: 000000000 <form id="1112025" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.igual(r, null, "la cédula 000000000 de la respuesta no es la buscada (" + DOC + ")");
      t.igual(e.llamadas.length, 3, "llegó hasta el paso 3, pero se descarta ahí");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto: sin docId (vacío o null) no toca la red y devuelve null", async () => {
      const e = entornoAthenea();
      t.igual(await e.c.api.getAtheneaSolicitudesAuto(""), null);
      t.igual(await e.c.api.getAtheneaSolicitudesAuto(null), null);
      t.igual(e.llamadas.length, 0);
    });

    await t.casoAsync("getAtheneaLabsAuto: camino feliz completo — 3 pasos de resolución + 1 consulta de detalle por solicitud LAB", async () => {
      const e = entornoAthenea();
      e.setPlan(planFeliz);
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs, [{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO" }]);
      t.igual(e.llamadas.length, 4, "3 de la resolución + 1 de consultaDetalleSolicitud");
      t.cierto(e.llamadas[3].url.includes("consultaDetalleSolicitud"));
      const cuerpo = JSON.parse(e.llamadas[3].data);
      t.igual(cuerpo, { idSolicitud: 555, ano: 2026, modulo: "LAB" });
    });

    await t.casoAsync("getAtheneaLabsAuto v12.5.4: la tarjeta REAL (fecha en español + Numero + hash/token) llega completa a cada analito", async () => {
      // Extremo a extremo con el formato REAL confirmado en consultorio (2026-08-11):
      // getAtheneaSolicitudesAuto -> _atheneaExtraerSolicitudes (fecha en español +
      // verificación cruzada con "Numero") -> fetchAtheneaLabs -> cada analito hereda
      // __vglFechaSolicitud/__vglHoraSolicitud (para la casilla de Crónicos) y
      // __vglHash/__vglToken/__vglModulo (para el botón "Ver informe" del modal).
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
        else if (url.includes("DatosPaciente")) o.onload({
          status: 200,
          responseText: `CC: ${DOC}
            <div class="card">
              <div class="card-text no-margin"><strong>vie. 15 may. 2026 07:31 a.&nbsp;m.</strong></div>
              <div class="card-title no-margin">Numero: 26051503125</div>
              <form id="8465672026" data-modulo="LAB" action="/Resultados/Reporte">
                <input type="hidden" id="hash" name="hash" value="HASHREAL123" />
                <input name="__RequestVerificationToken" type="hidden" value="TOKENREAL456" />
              </form>
            </div>`,
        });
        else if (url.includes("consultaDetalleSolicitud")) o.onload({
          status: 200,
          responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2009", NombreParametro: "COLESTEROL TOTAL", Resultado: "159" }]) }),
        });
        else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs.length, 1);
      t.igual(labs[0].__vglFechaSolicitud, "2026-05-15");
      t.igual(labs[0].__vglHoraSolicitud, "07:31");
      t.igual(labs[0].__vglHash, "HASHREAL123");
      t.igual(labs[0].__vglToken, "TOKENREAL456");
      t.igual(labs[0].__vglModulo, "LAB");
      // Y la casilla de Crónicos recibe justo esa fecha, como cualquier otra fuente.
      t.igual(e.c.api._extractAtheneaFecha(labs[0]).iso, "2026-05-15");
    });

    await t.casoAsync("getAtheneaLabsAuto v12.5.5: 2 solicitudes del mismo paciente -> cada analito hereda el hash/token/fecha de SU PROPIA solicitud, nunca de la otra", async () => {
      // Guarda de regresión para el hallazgo bloqueante de la revisión adversarial: antes
      // del fix, la segunda solicitud (o ambas) podían terminar con la fecha y/o el
      // hash/token de la solicitud VECINA — aquí un paciente con 2 solicitudes reales
      // confirma que getAtheneaLabsAuto entrega cada analito con los datos de SU propia
      // tarjeta, de punta a punta (list -> extracción -> detalle -> propagación).
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
        else if (url.includes("DatosPaciente")) o.onload({
          status: 200,
          responseText: `CC: ${DOC}
            <div class="card text-dark bg-succes mb-5">
              <div class="card-header p-10"><strong>SOLICITUD DE LABORATORIO</strong></div>
              <div class="card-body p-10">
                <div class="card-text no-margin"><strong>lun. 5 ene. 2026 08:00 a.&nbsp;m.</strong></div>
                <div class="card-title no-margin">Numero: 26010512345</div>
                <div class="card-title no-margin">Relleno administrativo para simular el resto de campos que trae cada tarjeta real y así separar bien las dos tarjetas de esta prueba.</div>
              </div>
              <div class="card-footer no-padding">
                <span class="p-10" data-toggle="collapse" onclick="getDetalleSolicitud(this, 'LAB', 111, 2026, 'True' )" href="#collapse1112026LAB">Ver Resumen</span>
                <form id="1112026" data-modulo="LAB" action="/Resultados/Reporte" method="post">
                  <input type="hidden" id="hash" name="hash" value="HASH-UNO" />
                  <button type="submit" class="btn btn-primary float-right btn-xs">Ver Informe</button>
                  <input name="__RequestVerificationToken" type="hidden" value="TOK-UNO" />
                </form>
              </div>
            </div>
            <div class="card text-dark bg-succes mb-5">
              <div class="card-header p-10"><strong>SOLICITUD DE LABORATORIO</strong></div>
              <div class="card-body p-10">
                <div class="card-text no-margin"><strong>jue. 12 feb. 2026 09:15 a.&nbsp;m.</strong></div>
                <div class="card-title no-margin">Numero: 26021212345</div>
                <div class="card-title no-margin">Relleno administrativo para simular el resto de campos que trae cada tarjeta real y así separar bien las dos tarjetas de esta prueba.</div>
              </div>
              <div class="card-footer no-padding">
                <span class="p-10" data-toggle="collapse" onclick="getDetalleSolicitud(this, 'LAB', 222, 2026, 'True' )" href="#collapse2222026LAB">Ver Resumen</span>
                <form id="2222026" data-modulo="LAB" action="/Resultados/Reporte" method="post">
                  <input type="hidden" id="hash" name="hash" value="HASH-DOS" />
                  <button type="submit" class="btn btn-primary float-right btn-xs">Ver Informe</button>
                  <input name="__RequestVerificationToken" type="hidden" value="TOK-DOS" />
                </form>
              </div>
            </div>`,
        });
        else if (url.includes("consultaDetalleSolicitud")) {
          const cuerpo = JSON.parse(o.data);
          if (cuerpo.idSolicitud === 111) {
            o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2009", NombreParametro: "COLESTEROL TOTAL", Resultado: "159" }]) }) });
          } else if (cuerpo.idSolicitud === 222) {
            o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO", Resultado: "90" }]) }) });
          } else {
            o.onload({ status: 200, responseText: JSON.stringify({ dataObject: "[]" }) });
          }
        } else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs.length, 2);
      const colesterol = labs.find((l) => l.CodigoParametro === "2009");
      const glucosa = labs.find((l) => l.CodigoParametro === "2013");
      t.cierto(colesterol && glucosa, "llegó un analito de cada solicitud");
      t.igual(colesterol.__vglFechaSolicitud, "2026-01-05");
      t.igual(colesterol.__vglHash, "HASH-UNO");
      t.igual(colesterol.__vglToken, "TOK-UNO");
      t.igual(glucosa.__vglFechaSolicitud, "2026-02-12");
      t.igual(glucosa.__vglHash, "HASH-DOS");
      t.igual(glucosa.__vglToken, "TOK-DOS");
    });

    await t.casoAsync("getAtheneaLabsAuto: sesión caída (paso 1 con login) -> null sin llegar nunca a pedir detalle (v16.2.8)", async () => {
      const e = entornoAthenea();
      e.setPlan((o) => o.onload({ status: 200, responseText: `<input type="password" /> Iniciar sesión` }));
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      // v16.2.8 — «no se pudo leer el portal» NO es «no tiene laboratorios»: null ≠ [].
      t.igual(labs, null, "sesión caída = no se pudo leer (null), no una lista vacía");
      t.falso(e.llamadas.some((o) => String(o.url).includes("consultaDetalleSolicitud")));
    });

    await t.casoAsync("getAtheneaLabsAuto: solicitudes existen pero ninguna es del módulo LAB -> [] MARCADO sin consultar detalle (v18.0.141)", async () => {
      // v18.0.141 — este caso CAMBIÓ de contrato: antes devolvía un [] mudo que el
      // botón 🧪 presentaba como "no tiene exámenes"; ahora el [] llega marcado con
      // __vglLectura {estado:"sin_lab"} para que la presentación hable con honestidad
      // (el reporte del 04-sep: exámenes de mayo negados por un filtro estricto).
      const e = entornoAthenea();
      const logs = espiarConsola(e.c);
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="777" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC} <form id="1112025" data-modulo="PAT" action="/Resultados/Reporte"></form>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.cierto(Array.isArray(labs) && labs.length === 0, "sin solicitudes LAB la salida sigue siendo []");
      t.igual(labs.__vglLectura && labs.__vglLectura.estado, "sin_lab", "el [] viene marcado con el desenlace de la lectura");
      t.igual(labs.__vglLectura && labs.__vglLectura.solicitudes, 1);
      t.igual(labs.__vglLectura && labs.__vglLectura.modulos, ["PAT"]);
      t.cierto(logs.some((l) => l.includes("WARN") && l.includes("NINGUNA resultó del módulo laboratorio")), "deja rastro del desenlace en consola");
      t.igual(e.llamadas.length, 3, "las 3 de resolver + ninguna de detalle, porque no hay solicitudes LAB");
      t.igual(JSON.stringify(labs), "[]", "el marcador NO viaja en la serialización (no enumerable)");
    });

    // =====================================================================
    // v18.0.141 — LA PACIENTE CON EXÁMENES DE MAYO QUE EL SCRIPT NEGABA.
    // Reporte del 04-sep: «tiene exámenes pero el script dice que no hay para esa
    // cédula, y sí los hay pero de mayo». Tres tolerancias nuevas en la extracción
    // (módulo en minúscula, action con query-string, id con sufijo alfabético) más
    // la separación honesta de los [] sospechosos.
    // =====================================================================
    t.caso("_vglEsModuloLab: casa por PREFIJO en cualquier caja — lab/Lab/LAB/LABORATORIO sí, PAT/IMG/vacío no", () => {
      t.cierto(api._vglEsModuloLab({ modulo: "LAB" }));
      t.cierto(api._vglEsModuloLab({ modulo: "lab" }));
      t.cierto(api._vglEsModuloLab({ modulo: "Lab" }));
      t.cierto(api._vglEsModuloLab({ modulo: "LABORATORIO" }));
      t.cierto(api._vglEsModuloLab({ modulo: " lab " }), "con espacios alrededor, normaliza antes de comparar");
      t.falso(api._vglEsModuloLab({ modulo: "PAT" }));
      t.falso(api._vglEsModuloLab({ modulo: "IMG" }));
      t.falso(api._vglEsModuloLab({}), "sin módulo no es laboratorio (no se adivina)");
      t.falso(api._vglEsModuloLab(null), "null no lanza");
      t.falso(api._vglEsModuloLab({ modulo: "RADIOLOGIA" }), "prefijo LAB y no substring: BALONPETICION no casaría tampoco");
    });

    t.caso("_vglMarcarLectura: marca un [] con info, NO enumerable, y devuelve el mismo arreglo", () => {
      const vacio = [];
      const marcado = api._vglMarcarLectura(vacio, { estado: "sin_lab", solicitudes: 3, modulos: ["PAT", "IMG"] });
      t.cierto(marcado === vacio, "muta el arreglo recibido (no crea otro): quien lo guardó en caché ve el marcador");
      t.igual(marcado.__vglLectura, { estado: "sin_lab", solicitudes: 3, modulos: ["PAT", "IMG"] });
      t.igual(JSON.stringify(marcado), "[]", "no enumerable: invisible para la serialización");
      t.igual(marcado.length, 0, "el arreglo sigue siendo un arreglo vacío válido");
      t.noLanza(() => api._vglMarcarLectura(null, { estado: "x" }), "entrada no arreglo no lanza");
      t.igual(api._vglMarcarLectura("no-array", { estado: "x" }).length, 0, "entrada inválida cae a [] marcado");
    });

    t.caso("_atheneaExtraerSolicitudes v18.0.141: data-modulo en minúscula se NORMALIZA a LAB en el origen", () => {
      const html = `<form id="1112026" data-modulo="lab" action="/Resultados/Reporte"></form>`;
      t.igual(api._atheneaExtraerSolicitudes(html), [{ idSolicitud: 111, ano: 2026, modulo: "LAB", fechaIso: null, horaTxt: null, hash: null, token: null }]);
    });

    t.caso("_atheneaExtraerSolicitudes v18.0.141: action con query-string (/Resultados/Reporte?...) ya no descarta la tarjeta", () => {
      const html = `<form id="2222026" data-modulo="LAB" action="/Resultados/Reporte?origen=lista" method="post"></form>`;
      t.igual(api._atheneaExtraerSolicitudes(html), [{ idSolicitud: 222, ano: 2026, modulo: "LAB", fechaIso: null, horaTxt: null, hash: null, token: null }]);
    });

    t.caso("_atheneaExtraerSolicitudes v18.0.141: id con sufijo alfabético (1112026LAB, como el ancla #collapse...) se interpreta igual", () => {
      const html = `<form id="1112026LAB" data-modulo="LAB" action="/Resultados/Reporte"></form>`;
      t.igual(api._atheneaExtraerSolicitudes(html), [{ idSolicitud: 111, ano: 2026, modulo: "LAB", fechaIso: null, horaTxt: null, hash: null, token: null }]);
    });

    t.caso("_atheneaExtraerSolicitudes v18.0.141: __vglMeta adjunto (no enumerable) con los conteos de interpretación", () => {
      const html = `
        <form id="1112026" data-modulo="LAB" action="/Resultados/Reporte"></form>
        <form id="2222026" data-modulo="PAT" action="/Resultados/Reporte"></form>
      `;
      const out = api._atheneaExtraerSolicitudes(html);
      const meta = out.__vglMeta;
      t.cierto(meta && typeof meta === "object", "el meta viaja en el arreglo de salida");
      t.igual(meta.formularios, 2);
      t.igual(meta.interpretadas, 2);
      t.igual(meta.descartadas, 0);
      t.igual(meta.modulos, { LAB: 1, PAT: 1 });
      t.igual(JSON.stringify(out).indexOf("__vglMeta"), -1, "no enumerable: invisible para la serialización");
      t.igual(out.length, 2, "y el arreglo se recorre igual que siempre");
    });

    await t.casoAsync("getAtheneaLabsAuto v18.0.141 (regresión del reporte): tarjeta con data-modulo=\"lab\" y action con query-string -> los exámenes SÍ se leen", async () => {
      // La combinación exacta que vaciaba la lista del paciente: el módulo en
      // minúscula mataba en el filtro estricto y el query-string podía matar en la
      // extracción. Con las dos tolerancias, un paciente "sin exámenes" recupera
      // sus resultados de punta a punta.
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
        else if (url.includes("DatosPaciente")) o.onload({
          status: 200,
          responseText: `CC: ${DOC}
            <div class="card">
              <div class="card-text no-margin"><strong>vie. 15 may. 2026 07:31 a.&nbsp;m.</strong></div>
              <div class="card-title no-margin">Numero: 26051503125</div>
              <form id="8465672026LAB" data-modulo="lab" action="/Resultados/Reporte?origen=lista" method="post">
                <input type="hidden" id="hash" name="hash" value="HASHMAYO" />
                <input name="__RequestVerificationToken" type="hidden" value="TOKMAYO" />
              </form>
            </div>`,
        });
        else if (url.includes("consultaDetalleSolicitud")) o.onload({
          status: 200,
          responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO", Resultado: "92" }]) }),
        });
        else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs.length, 1, "el examen de mayo llega: ya no lo niega");
      t.igual(labs[0].__vglFechaSolicitud, "2026-05-15");
      t.igual(labs[0].__vglHash, "HASHMAYO");
      t.cierto(!labs.__vglLectura, "lectura completa: sin marcador de desenlace sospechoso");
      // El POST al detalle sigue llevando modulo:"LAB" normalizado (contrato del servidor).
      const cuerpo = JSON.parse(e.llamadas[3].data);
      t.igual(cuerpo, { idSolicitud: 846567, ano: 2026, modulo: "LAB" });
    });

    await t.casoAsync("getAtheneaLabsAuto v18.0.141: data-modulo=\"LABORATORIO\" (nombre LARGO del módulo) SÍ se lee — el filtro del núcleo es por PREFIJO", async () => {
      // La unidad de _vglEsModuloLab ya acepta "LABORATORIO"; esta prueba la hace
      // FLUIR por el núcleo. Nació de una mutación viva (#514): con el filtro del
      // núcleo degradado a === "LAB" las 92 comprobaciones seguían en verde — la
      // capacidad estaba probada, el cableado no. Un data-modulo="LABORATORIO"
      // (normalizado en origen) debe pasar el filtro y leer su detalle.
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="777" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({
          status: 200,
          responseText: `CC: ${DOC}
            <div class="card">
              <div class="card-text no-margin"><strong>sáb. 16 may. 2026 08:02 a.&nbsp;m.</strong></div>
              <div class="card-title no-margin">Numero: 26051604001</div>
              <form id="3332026" data-modulo="LABORATORIO" action="/Resultados/Reporte" method="post">
                <input type="hidden" id="hash" name="hash" value="HASHLARGO" />
                <input name="__RequestVerificationToken" type="hidden" value="TOKLARGO" />
              </form>
            </div>`,
        });
        else if (url.includes("consultaDetalleSolicitud")) o.onload({
          status: 200,
          responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO", Resultado: "88" }]) }),
        });
        else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs.length, 1, "la solicitud de LABORATORIO pasa el filtro del núcleo y se lee");
      t.igual(labs[0].__vglHash, "HASHLARGO");
      t.cierto(!labs.__vglLectura, "no es un [] sospechoso: lectura completa");
      // El contrato del servidor no cambia: el POST del detalle lleva modulo:"LAB" fijo.
      const cuerpo = JSON.parse(e.llamadas[3].data);
      t.igual(cuerpo, { idSolicitud: 333, ano: 2026, modulo: "LAB" });
    });

    await t.casoAsync("getAtheneaLabsAuto v18.0.141: formularios presentes pero NINGUNO interpretable -> [] marcado formularios_no_interpretados (no 'no tiene exámenes')", async () => {
      // El portal respondió, la cédula casó, pero las tarjetas no se dejaron leer
      // (aquí: id fuera del patrón año). Antes: [] mudo → "no tiene exámenes para
      // esa cédula". Ahora: [] marcado para que el botón hable con honestidad.
      const e = entornoAthenea();
      const logs = espiarConsola(e.c);
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="555" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC} <strong>SOLICITUD DE LABORATORIO</strong> <form id="XYZ999" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.cierto(Array.isArray(labs) && labs.length === 0);
      t.igual(labs.__vglLectura && labs.__vglLectura.estado, "formularios_no_interpretados");
      t.igual(labs.__vglLectura && labs.__vglLectura.formularios, 1);
      t.falso(e.llamadas.some((o) => String(o.url).includes("consultaDetalleSolicitud")), "sin detalle que consultar: no hay nada interpretado");
      t.cierto(logs.some((l) => l.includes("WARN") && l.includes("formularios de /Resultados/Reporte detectados")), "el diagnóstico one-shot deja el rastro");
    });

    await t.casoAsync("getAtheneaLabsAuto v18.0.141: lectura PARcial de solicitudes LAB -> __vglIncompleto sigue NUMÉRICO y no aparece __vglLectura", async () => {
      // Contrato de v17.7.1 respetado: __vglIncompleto es la cantidad de solicitudes
      // no leídas (número) y varios consumidores lo comparan con > 0. El marcador
      // nuevo __vglLectura NO debe colarse en este camino.
      const e = entornoAthenea();
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="888" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC} <form id="1112026" data-modulo="LAB" action="/Resultados/Reporte"></form><form id="2222026" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else if (url.includes("consultaDetalleSolicitud")) {
          const cuerpo = JSON.parse(o.data);
          if (cuerpo.idSolicitud === 111) o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "2013", NombreParametro: "GLUCOSA EN SUERO", Resultado: "90" }]) }) });
          else o.onload({ status: 500, responseText: "boom" }); // la segunda no se deja leer
        } else o.onload({ status: 200, responseText: "" });
      });
      const labs = await e.c.api.getAtheneaLabsAuto(DOC);
      t.igual(labs.length, 1, "llegó lo que sí se pudo leer");
      t.igual(labs.__vglIncompleto, 1, "la cantidad no leída, NUMÉRICA como desde v17.7.1");
      t.cierto(typeof labs.__vglIncompleto === "number", "el marcador histórico no cambió de tipo");
      t.cierto(!labs.__vglLectura, "el marcador nuevo no interfiere en las lecturas parciales");
    });

    await t.casoAsync("getAtheneaSolicitudesAuto v18.0.141: paso 2 con DOS inputs IdPaciente (cédula duplicada en el portal) deja el warn one-shot", async () => {
      const e = entornoAthenea();
      const logs = espiarConsola(e.c);
      e.setPlan((o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<input name="__RequestVerificationToken" value="T1" />` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="101" /><input type="hidden" name="IdPaciente" value="202" /><input name="__RequestVerificationToken" value="T2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC} <form id="1112026" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else o.onload({ status: 200, responseText: "" });
      });
      const r = await e.c.api.getAtheneaSolicitudesAuto(DOC);
      t.cierto(r && r.solicitudes.length === 1, "toma el primero y sigue: la verificación del paso 3 decide");
      t.cierto(logs.some((l) => l.includes("WARN") && l.includes("2 campos IdPaciente")), "el warn de duplicidad quedó en consola");
    });
  },
};
