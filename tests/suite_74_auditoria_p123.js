// =====================================================================
//  SUITE 74 — ARREGLOS DE LA AUDITORÍA DE RENDIMIENTO Y CIBERSEGURIDAD
//  (entrega 2026-09-03, versión 18.0.134)
//
//  Cubre los tres frentes aplicados de una sola vez:
//   · P1 (A1-A3):  versión coherente, purga del caché piloto y compuerta
//                  de cosecha por suciedad del DOM.
//   · P2 (M1-M8):  validación del canal entre pestañas, sondeo adaptativo
//                  con pestaña oculta, podas de historiales sin techo
//                  (inasistencias, identidades), censura de números en la
//                  bitácora y tope del lote de deshacer.
//   · P3 (B1-B13): censura por defecto, caducidad de los ejemplos de
//                  estilo, liberación de las URL de los blobs, reloj de
//                  segundo plano sin fugas, limpieza de marcas de avisos,
//                  desconexión del observador en el apagado de emergencia.
//
//  Cada caso siembra lo justo en el entorno compartido y lo devuelve a su
//  estado en un finally: la suite es la última del banco (orden alfabético),
//  pero aun así no deja basura sembrada a propósito.
// =====================================================================
const vm = require("vm");
const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "Auditoría P1+P2+P3 (2026-09-03)",
  cubre: [
    "_vglIntegridadFalla", "pilotoDesdeCache", "_vglDomMarcarSucio", "_vglDomEstaSucia",
    "_vglFirmaReg", "_vglChanMsgValido", "_ajustarSondeo", "_hayCitaCritica",
    "_noShowRegistrar", "vglLog", "mtrEstiloLeer", "vglExportLogs", "downloadDiagnostic",
    "_relojCada", "_relojAjustarParaTest", "crossTabDup", "_identidadMedicoCacheGuardar", "_identidadMedicoCacheLeer",
    "_vglGuardarDeshacer", "_vglDeshacerDisponible", "_vglDeshacerLoteInfo",
    "_vglLimpiarSesionDia", "vglMinInstalar", "emergencyTeardown",
  ],

  async pruebas(t, api, env, cargar) {
    // ---------------------------------------------------------------
    // A1 — FUENTE ÚNICA DE VERSIÓN. La cabecera @version, el respaldo
    // literal de la constante VERSION y la versión que el arnés lee de
    // la cabecera tienen que ser LA MISMA: si alguien sube una y no la
    // otra, el chequeo de integridad del tablero compara contra una
    // huella que no corresponde y se apaga en plena consulta.
    // ---------------------------------------------------------------
    t.caso("A1: cabecera, constante VERSION y arnés coinciden", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const cabecera = (src.slice(0, 2000).match(/\/\/\s*@version\s+(\S+)/) || [])[1];
      const respaldo = (src.match(/const VERSION[^\n]*"(\d+\.\d+\.\d+)"/) || [])[1];
      t.cierto(!!cabecera && !!respaldo, "A1: hay cabecera @version y respaldo literal");
      t.igual(cabecera, respaldo, "A1: @version y el respaldo de VERSION son la misma");
      t.igual(env.win.GM_info.script.version, respaldo, "A1: el arnés lee esa misma versión");
      // La compuerta de integridad solo dispara cuando la huella esperada
      // es de la versión que corre: con la versión de la cabecera tiene que
      // contar el sha distinto, y con cualquier otra, no.
      t.cierto(api._vglIntegridadFalla(
        { expectedSha256: "huella-buena", expectedShaVersion: cabecera },
        { status: "ok", sha256: "huella-distinta" }),
        "A1: huella de ESTA versión + sha distinto = fallo");
      t.falso(api._vglIntegridadFalla(
        { expectedSha256: "huella-buena", expectedShaVersion: "0.0.1" },
        { status: "ok", sha256: "huella-distinta" }),
        "A1: huella de OTRA versión nunca apaga el script");
      t.falso(api._vglIntegridadFalla(
        { expectedSha256: "huella-buena", expectedShaVersion: cabecera },
        { status: "ok", sha256: "huella-buena" }),
        "A1: sha igual = integridad bien");
      t.falso(api._vglIntegridadFalla(
        { expectedSha256: "huella-buena", expectedShaVersion: cabecera },
        { status: "error", sha256: "huella-distinta" }),
        "A1: sin resultado ok no se juzga");
      t.falso(api._vglIntegridadFalla(null, { status: "ok", sha256: "x" }), "A1: sin datos del tablero");
      t.falso(api._vglIntegridadFalla({ expectedShaVersion: cabecera }, { status: "ok", sha256: "x" }), "A1: sin huella esperada");
    });

    // ---------------------------------------------------------------
    // A2 — PURGA DEL CACHÉ PILOTO. Un paquete que no es v3, o cuya fecha
    // de cola es de hace más de 30 días, se BORRA del almacén de
    // Tampermonkey en vez de quedarse ocupando hasta 12 MB para siempre.
    // La fecha va al final del paquete: se mira la cola, sin desempaquetar.
    // ---------------------------------------------------------------
    await t.casoAsync("A2: la base piloto vencida o vieja se purga del almacén", async () => {
      try {
        env.gm["vgl_piloto"] = '{"v":2,"pad":"paquete de formato antiguo"}';
        t.falso(await api.pilotoDesdeCache(), "A2: paquete no v3 no sirve");
        t.igual(env.gm["vgl_piloto"], "", "A2: el paquete no v3 se borró del almacén");

        const paqueteViejo = '{"v":3,"pad":"' + "x".repeat(900) + '","date":"' + api._vglFechaHace(31) + '"}';
        env.gm["vgl_piloto"] = paqueteViejo;
        t.falso(await api.pilotoDesdeCache(), "A2: paquete v3 de hace 31 días no sirve");
        t.igual(env.gm["vgl_piloto"], "", "A2: el paquete vencido se borró del almacén");
      } finally {
        delete env.gm["vgl_piloto"];
      }
    });

    // ---------------------------------------------------------------
    // A3.1 — COMPUERTA DE COSECHA. La cosecha solo corre cuando el DOM
    // se movió: marcar suciedad, cosechar (true), ya no hay nada nuevo
    // (false), vuelve a moverse (true). Con el observador mudo la
    // compuerta NUNCA bloquea: responde siempre sucia.
    // ---------------------------------------------------------------
    t.caso("A3.1: la cosecha solo corre cuando el DOM se movió", () => {
      api._vglDomMarcarSucio();
      t.cierto(api._vglDomEstaSucia(), "A3.1: con suciedad nueva se cosecha");
      t.falso(api._vglDomEstaSucia(), "A3.1: sin cambios el DOM no vuelve a cosechar");
      api._vglDomMarcarSucio();
      t.cierto(api._vglDomEstaSucia(), "A3.1: al moverse el DOM otra vez, se cosecha");
    });

    // ---------------------------------------------------------------
    // A3.2 — FIRMA DE REGISTRO SIN RUIDO. El sello del registro (ts) y
    // el de la cosecha de pantalla (hcEverest.ts) no cuentan para la
    // firma: cambian solos. El contenido (incluido lo de dentro de
    // hcEverest y los ts de confirmaciones/factores) sí cuenta.
    // ---------------------------------------------------------------
    t.caso("A3.2: la firma ignora sellos de tiempo, no contenido", () => {
      const base = { nombre: "Paciente de prueba", ts: 1000, hcEverest: { ts: 5, datos: "x" }, confirmaciones: [{ ts: 1, ok: true }] };
      const igualConOtrosSellos = { nombre: "Paciente de prueba", ts: 9999, hcEverest: { ts: 77, datos: "x" }, confirmaciones: [{ ts: 1, ok: true }] };
      t.igual(api._vglFirmaReg(base), api._vglFirmaReg(igualConOtrosSellos), "A3.2: otros sellos, misma firma");
      const otroContenido = { nombre: "Otro paciente", ts: 1000, hcEverest: { ts: 5, datos: "x" }, confirmaciones: [{ ts: 1, ok: true }] };
      t.cierto(api._vglFirmaReg(base) !== api._vglFirmaReg(otroContenido), "A3.2: otro contenido, otra firma");
      const otraCosecha = { nombre: "Paciente de prueba", ts: 1000, hcEverest: { ts: 5, datos: "OTRO" }, confirmaciones: [{ ts: 1, ok: true }] };
      t.cierto(api._vglFirmaReg(base) !== api._vglFirmaReg(otraCosecha), "A3.2: el contenido de hcEverest sí cuenta");
      t.igual(api._vglFirmaReg(null), JSON.stringify(""), "A3.2: null se firma como cadena vacía");
      t.igual(api._vglFirmaReg(undefined), JSON.stringify(""), "A3.2: undefined igual que null");
      t.igual(api._vglFirmaReg(42), JSON.stringify(42), "A3.2: un valor no-objeto se firma tal cual");
    });

    // ---------------------------------------------------------------
    // M1 — VALIDACIÓN DEL CANAL ENTRE PESTAÑAS. El estado compartido
    // solo se acepta si tiene t numérico finito y list acotado: cualquier
    // otra cosa que llegue por el canal se ignora.
    // ---------------------------------------------------------------
    t.caso("M1: solo entra por el canal lo que tiene forma de estado", () => {
      t.cierto(api._vglChanMsgValido({ t: Date.now(), list: [] }), "M1: mensaje bien formado");
      t.cierto(api._vglChanMsgValido({ t: 1, list: new Array(500) }), "M1: 500 citas es el máximo aceptado");
      t.falso(api._vglChanMsgValido({ t: "123", list: [] }), "M1: t como cadena no entra");
      t.falso(api._vglChanMsgValido({ t: NaN, list: [] }), "M1: t NaN no entra");
      t.falso(api._vglChanMsgValido({ t: Infinity, list: [] }), "M1: t infinito no entra");
      t.falso(api._vglChanMsgValido({ t: 1, list: {} }), "M1: list que no es arreglo no entra");
      t.falso(api._vglChanMsgValido({ t: 1, list: new Array(501) }), "M1: 501 citas se rechaza");
      t.falso(api._vglChanMsgValido(null), "M1: null no entra");
      t.falso(api._vglChanMsgValido("texto suelto"), "M1: una cadena no entra");
    });

    // ---------------------------------------------------------------
    // M3 — SONDEO ADAPTATIVO CON PESTAÑA OCULTA. Oculta, el sondeo nunca
    // baja de 15 s (antes despertaba trabajo pesado cada 5 s sin nadie
    // mirando); al volver a visible recupera la cadencia base; y con una
    // cita dentro de la ventana crítica acelera a 2 s.
    // ---------------------------------------------------------------
    t.caso("M3: pestaña oculta sondea lento y visible recupera cadencia", () => {
      const msDeTick = () => {
        const loc = api._relojEstadoParaTest().locales.find((l) => l.id === "tick");
        return loc ? loc.ms : -1;
      };
      try {
        env.doc.visibilityState = "hidden";
        api._ajustarSondeo([]);
        t.igual(msDeTick(), 15000, "M3: oculta, mínimo 15 s entre sondeos");
        env.doc.visibilityState = "visible";
        api._ajustarSondeo([]);
        t.igual(msDeTick(), 5000, "M3: visible vuelve a la cadencia base");
        // Cita de hace 5 minutos: la gracia (6 min) vence en menos de 90 s.
        // El borde de medianoche (hoy 00:00-00:05) hace que la cita de ayer
        // ya no esté en ventana: por eso la espera se calcula, no se asume.
        const haceCinco = new Date(Date.now() - 5 * 60 * 1000);
        const cita = {
          hora_texto: String(haceCinco.getHours()).padStart(2, "0") + ":" + String(haceCinco.getMinutes()).padStart(2, "0"),
          estado: "Sin presentarse",
        };
        const critica = api._hayCitaCritica([cita], new Date());
        api._ajustarSondeo([cita]);
        t.igual(msDeTick(), critica ? 2000 : 5000, "M3: la ventana crítica acelera solo cuando existe");
      } finally {
        env.doc.visibilityState = "visible";
      }
    });

    t.caso("M3: la ventana crítica son 90 s antes de vencer la gracia", () => {
      const ahora = new Date();
      ahora.setHours(10, 30, 0, 0);
      t.cierto(api._hayCitaCritica([{ hora_texto: "10:25", estado: "Sin presentarse" }], ahora), "M3: gracia vence en 1 min: crítica");
      t.falso(api._hayCitaCritica([{ hora_texto: "10:10", estado: "Sin presentarse" }], ahora), "M3: la gracia ya venció: no crítica");
      t.falso(api._hayCitaCritica([{ hora_texto: "10:35", estado: "En sala de espera" }], ahora), "M3: ya está en sala: no crítica");
      t.falso(api._hayCitaCritica([{ hora_texto: "10:35", estado: "Sin presentarse" }], ahora), "M3: aún lejos de la gracia: no crítica");
      t.falso(api._hayCitaCritica([], ahora), "M3: sin citas no hay ventana");
      t.falso(api._hayCitaCritica([{ hora_texto: "no es hora", estado: "Sin presentarse" }], ahora), "M3: hora ilegible se ignora");
    });

    // ---------------------------------------------------------------
    // M4 — PODA DEL HISTORIAL DE INASISTENCIAS. Crecía sin techo (una
    // entrada por paciente para siempre). Ahora, al registrar, salen las
    // entradas con última inasistencia de hace más de 180 días y, si
    // quedan más de 500, las más viejas. Las claves de prueba son
    // alfabéticas a propósito: no colapsan entre sí por cédula.
    // ---------------------------------------------------------------
    t.caso("M4: el historial de inasistencias se poda al registrar", () => {
      try {
        const semilla = {};
        semilla["viejitoPodado"] = { total: 3, ultima: api._vglFechaHace(200) };
        semilla["fresquitoVivo"] = { total: 1, ultima: api.todayStamp() };
        for (let i = 0; i < 505; i++) {
          const clave = String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26));
          semilla[clave] = { total: 1, ultima: api._vglFechaHace(10) };
        }
        env.almacen["vgl_nosh_hist"] = JSON.stringify(semilla);
        const total = api._noShowRegistrar("nuevoPodado");
        const hist = JSON.parse(env.almacen["vgl_nosh_hist"]);
        t.igual(total, 1, "M4: primera inasistencia del paciente nuevo");
        t.falso("viejitoPodado" in hist, "M4: la entrada de hace 200 días salió");
        t.cierto("fresquitoVivo" in hist, "M4: la entrada de hoy sobrevive");
        t.cierto(hist["nuevoPodado"] && hist["nuevoPodado"].ultima === api.todayStamp(), "M4: la nueva entrada quedó fechada hoy");
        t.cierto(Object.keys(hist).length <= 500, "M4: el historial quedó acotado a 500");
      } finally {
        delete env.almacen["vgl_nosh_hist"];
      }
    });

    // ---------------------------------------------------------------
    // M5 + B1 + B12 — BITÁCORA SIN IDENTIFICADORES. Los números que
    // pueden ser cédulas, turnos o teléfonos (más de cinco dígitos, o
    // cualquier número mayor que 99999) quedan CENSURADOS en la
    // bitácora; el resto del detalle viaja intacto para poder depurar.
    // ---------------------------------------------------------------
    t.caso("M5/B1/B12: la bitácora censura identificadores, no contenido", () => {
      api.vglLog("RCV", "AsignandoTurnoPrueba74", { turnoId: 123456789 });
      api.vglLog("ORDEN", "DxNoResueltoPrueba74", { dx: "Hipotiroidismo", docs: 2 });
      api.vglLog("PATIENT", "TelefonoFamiliaPrueba74", { tel: "celular 3104567890 del paciente" });
      const bitacora = JSON.parse(env.almacen["vgl_flight_recorder_logs"] || "[]");
      const e1 = bitacora.find((x) => x.act === "AsignandoTurnoPrueba74");
      t.cierto(!!e1, "M5: la entrada del turno quedó registrada");
      t.igual(e1.det.turnoId, "[CENSURADO]", "B12: el id de turno grande queda censurado");
      const e2 = bitacora.find((x) => x.act === "DxNoResueltoPrueba74");
      t.igual(e2.det.dx, "Hipotiroidismo", "M5: el diagnóstico viaja intacto");
      t.igual(e2.det.docs, 2, "M5: los contadores chicos viajan intactos");
      const e3 = bitacora.find((x) => x.act === "TelefonoFamiliaPrueba74");
      t.igual(e3.det.tel, "celular [TEL_CENSURADO] del paciente", "B1: un teléfono dentro de un texto queda censurado");
    });

    // ---------------------------------------------------------------
    // B3 — CADUCIDAD DE LOS EJEMPLOS DE ESTILO. El aprendizaje del
    // estilo del médico (textos con su redacción) vivía en el disco para
    // siempre. Ahora cada ejemplo caduca a los 180 días y el formato
    // viejo (cadenas peladas) se lee como si acabara de guardarse.
    // ---------------------------------------------------------------
    t.caso("B3: los ejemplos de estilo caducan a los 180 días", () => {
      try {
        const ahora = Date.now();
        env.gm["vgl_estilo_ejemplos"] = JSON.stringify([
          { t: ahora - 181 * 24 * 60 * 60 * 1000, x: "ejemplo caducado de hace 181 dias" },
          { t: ahora - 24 * 60 * 60 * 1000, x: "ejemplo vivo de ayer" },
          "ejemplo legado en formato de cadena",
        ]);
        const vivos = api.mtrEstiloLeer();
        t.igual(vivos.length, 2, "B3: solo el vivo y el legado sobreviven");
        t.cierto(vivos.indexOf("ejemplo vivo de ayer") >= 0, "B3: el ejemplo de ayer sigue");
        t.cierto(vivos.indexOf("ejemplo legado en formato de cadena") >= 0, "B3: el legado migra a vivo");
        t.cierto(vivos.indexOf("ejemplo caducado de hace 181 dias") < 0, "B3: el caducado no vuelve");
      } finally {
        delete env.gm["vgl_estilo_ejemplos"];
      }
    });

    // ---------------------------------------------------------------
    // B6a — LIBERAR LA URL DEL BLOB DE LA BITÁCORA. La descarga creaba
    // una URL de objeto y jamás se revocaba: una fuga por cada
    // exportación. Ahora se libera tras la descarga. El arnés capa los
    // setTimeout a 1 ms, así que esperar 40 ms del anfitrión alcanza.
    // ---------------------------------------------------------------
    await t.casoAsync("B6a: la URL del blob de la bitácora se libera", async () => {
      let creadas = 0, revocadas = 0;
      const originales = { c: env.win.URL.createObjectURL, r: env.win.URL.revokeObjectURL };
      env.win.URL.createObjectURL = () => { creadas++; return "blob:prueba-b6a"; };
      env.win.URL.revokeObjectURL = () => { revocadas++; };
      try {
        api.vglExportLogs();
        await new Promise((res) => setTimeout(res, 40));
        t.cierto(creadas >= 1, "B6a: se creó la URL del blob");
        t.cierto(revocadas >= 1, "B6a: la URL se revocó tras la descarga");
      } finally {
        env.win.URL.createObjectURL = originales.c;
        env.win.URL.revokeObjectURL = originales.r;
      }
    });

    // ---------------------------------------------------------------
    // B6b — LIBERAR LA URL DEL BLOB DEL DIAGNÓSTICO. Lo mismo para la
    // descarga del diagnóstico sanitizado.
    // ---------------------------------------------------------------
    await t.casoAsync("B6b: la URL del blob del diagnóstico se libera", async () => {
      let creadas = 0, revocadas = 0;
      const originales = { c: env.win.URL.createObjectURL, r: env.win.URL.revokeObjectURL };
      env.win.URL.createObjectURL = () => { creadas++; return "blob:prueba-b6b"; };
      env.win.URL.revokeObjectURL = () => { revocadas++; };
      try {
        api.downloadDiagnostic();
        await new Promise((res) => setTimeout(res, 40));
        t.cierto(creadas >= 1, "B6b: se creó la URL del blob");
        t.cierto(revocadas >= 1, "B6b: la URL se revocó tras la descarga");
      } finally {
        env.win.URL.createObjectURL = originales.c;
        env.win.URL.revokeObjectURL = originales.r;
      }
    });

    // ---------------------------------------------------------------
    // B7 — EL RELOJ DE SEGUNDO PLANO NO DEJA BLOBS COLGANDO. El guion
    // del worker se servía por una URL de objeto que nadie revocaba: una
    // por carga de página, para siempre en la sesión. Ahora se revoca en
    // el acto, apenas el worker toma el guion, y el canal arranca por el
    // worker (sin temporizador de página).
    // ---------------------------------------------------------------
    t.caso("B7: la URL del guion del worker se revoca al crearlo", () => {
      const trabajadores = [];
      function TrabajadorFalso(url) {
        this.url = url;
        this.mensajes = [];
        this.terminado = false;
        const yo = this;
        this.postMessage = (m) => { yo.mensajes.push(m); };
        this.terminate = () => { yo.terminado = true; };
        trabajadores.push(this);
      }
      const r = cargar({ Worker: TrabajadorFalso, silencioso: true });
      // Durante la carga el propio guion ya levanta su worker del canal
      // "latido" (perro guardián), antes de que este caso pudiera poner su
      // espía. Se reinicia el estado del reloj para que _relojCada tenga
      // que construir OTRO worker, ya bajo el espía de la URL.
      r.api._relojAjustarParaTest({ worker: null, ok: false, motivo: "" });
      let creadas = 0, revocadas = 0;
      const originales = { c: r.env.win.URL.createObjectURL, r: r.env.win.URL.revokeObjectURL };
      r.env.win.URL.createObjectURL = () => { creadas++; return "blob:prueba-b7"; };
      r.env.win.URL.revokeObjectURL = () => { revocadas++; };
      try {
        r.api._relojCada("tick", 5000, () => {});
        t.cierto(creadas >= 1, "B7: se creó la URL del guion");
        t.cierto(revocadas >= 1, "B7: la URL se revocó apenas el worker la tomó");
        t.cierto(trabajadores.length >= 2, "B7: se levantó otro worker para el canal nuevo");
        const w = trabajadores[trabajadores.length - 1];
        t.igual(w.url, "blob:prueba-b7", "B7: el worker se construyó con esa URL");
        t.igual(w.mensajes.length, 1, "B7: un único mensaje de arranque");
        const mensaje = w.mensajes[0];
        t.igual(mensaje.op, "start", "B7: el mensaje es de arranque");
        t.igual(mensaje.id, "tick", "B7: el canal es el del sondeo");
        t.igual(mensaje.ms, 5000, "B7: con la cadencia pedida");
        const local = r.api._relojEstadoParaTest().locales.find((l) => l.id === "tick");
        t.cierto(!!local, "B7: el canal quedó registrado");
        t.falso(local.enPagina, "B7: en la ruta del worker no hay temporizador de página");
      } finally {
        r.env.win.URL.createObjectURL = originales.c;
        r.env.win.URL.revokeObjectURL = originales.r;
      }
    });

    // ---------------------------------------------------------------
    // B8 — LAS MARCAS DE AVISO VIEJAS SE LIMPIAN AL ESCRIBIR. Cada aviso
    // dejaba una marca vgl_n_* que solo se llevaba la limpieza de la
    // OTRA pestaña; siendo la única abierta, quedaban para siempre.
    // Ahora, al escribir, salen las de más de 24 horas.
    // ---------------------------------------------------------------
    t.caso("B8: las marcas de aviso de más de 24 horas se limpian", () => {
      const ahora = Date.now();
      try {
        env.almacen["vgl_n_viejitoB8"] = String(ahora - 25 * 60 * 60 * 1000);
        env.almacen["vgl_n_fresquitoB8"] = String(ahora - 60 * 1000);
        t.falso(api.crossTabDup("pruebitaB8"), "B8: la primera vez no está duplicado");
        t.cierto(api.crossTabDup("pruebitaB8"), "B8: la segunda vez inmediata sí lo está");
        t.falso("vgl_n_viejitoB8" in env.almacen, "B8: la marca de hace 25 horas se borró");
        t.cierto("vgl_n_fresquitoB8" in env.almacen, "B8: la marca de hace un minuto sigue");
      } finally {
        delete env.almacen["vgl_n_pruebitaB8"];
        delete env.almacen["vgl_n_fresquitoB8"];
        delete env.almacen["vgl_n_viejitoB8"];
      }
    });

    // ---------------------------------------------------------------
    // B9 — PODA DEL MAPA DE IDENTIDADES. Un login por cuenta que pasara
    // por el navegador, para siempre. Ahora, al guardar, salen los
    // vencidos (12 h) y, si quedan más de 20, los más viejos.
    // ---------------------------------------------------------------
    t.caso("B9: el mapa de identidades se poda al guardar", () => {
      try {
        const ahora = Date.now();
        const mapa = {};
        mapa["vencidob9"] = { id: 5, name: "Vencido de prueba", ts: ahora - 13 * 60 * 60 * 1000 };
        for (let i = 0; i < 20; i++) mapa["f" + i] = { id: 100 + i, name: "Ficha " + i, ts: ahora - i * 60 * 1000 };
        env.gm["vgl_identidad_medico_cache"] = mapa;
        api._identidadMedicoCacheGuardar("nuevoB9", 77, "Nuevo de prueba");
        const guardado = env.gm["vgl_identidad_medico_cache"];
        t.falso("vencidob9" in guardado, "B9: el login vencido salió");
        t.falso("f19" in guardado, "B9: el más viejo de los vivos salió por el tope");
        t.cierto("f0" in guardado, "B9: el más reciente de los vivos sigue");
        t.igual(Object.keys(guardado).length, 20, "B9: el mapa quedó en 20 logins");
        const leido = api._identidadMedicoCacheLeer("nuevoB9");
        t.igual(leido.id, 77, "B9: el login nuevo se lee bien");
        t.igual(leido.name, "Nuevo de prueba", "B9: con su nombre");
      } finally {
        delete env.gm["vgl_identidad_medico_cache"];
      }
    });

    // ---------------------------------------------------------------
    // M7 — TOPE DEL LOTE DE DESHACER. Cada par retiene un nodo DOM y un
    // valor previo: sin tope, un botón muy activo acumulaba pares
    // durante los cinco minutos de vida del lote. Ahora: tope de 400 al
    // crear, al acumular, y al expirar el lote se LIBERA (deja de
    // retener nodos). Los pares llevan .el a propósito: así acumula la
    // ruta que deduplica por casilla.
    // ---------------------------------------------------------------
    t.caso("M7: el lote de deshacer tiene tope y se libera al expirar", () => {
      const r = cargar({ silencioso: true });
      const primeros = [];
      for (let i = 0; i < 450; i++) primeros.push({ el: "casilla" + i, prev: "valor " + i });
      t.cierto(r.api._vglGuardarDeshacer("docM7", primeros, "Auto-Labs M7"), "M7: el primer lote se guarda");
      t.igual(r.api._vglDeshacerLoteInfo().pares, 400, "M7: al crear se recorta a 400");
      t.cierto(r.api._vglDeshacerDisponible(), "M7: el lote recién creado está disponible");
      const segundos = [];
      for (let i = 0; i < 50; i++) segundos.push({ el: "extra" + i, prev: "previo " + i });
      t.cierto(r.api._vglGuardarDeshacer("docM7", segundos, "Auto-Labs M7"), "M7: el mismo botón acumula");
      t.igual(r.api._vglDeshacerLoteInfo().pares, 400, "M7: al acumular también se recorta a 400");
      try {
        // Se adelanta el reloj DENTRO del contexto del script: expira el
        // lote de cinco minutos y éste se libera en el acto.
        vm.runInContext("globalThis.__dOrigM7 = Date.now; Date.now = function(){ return globalThis.__dOrigM7() + 370000; };", r.ctx);
        t.falso(r.api._vglDeshacerDisponible(), "M7: pasados cinco minutos ya no se puede deshacer");
        t.igual(r.api._vglDeshacerLoteInfo().pares, 0, "M7: el lote expirado se liberó");
      } finally {
        vm.runInContext("Date.now = globalThis.__dOrigM7; delete globalThis.__dOrigM7;", r.ctx);
      }
    });

    // ---------------------------------------------------------------
    // M8 — LIMPIEZA DE LA SESIÓN DEL DÍA. Las fechas de laboratorio por
    // casilla, el contexto ya avisado y los acompañantes ya entendidos
    // se vacían juntos al cambiar de día, en vez de quedar mezclando el
    // día anterior con el nuevo.
    // ---------------------------------------------------------------
    t.caso("M8: la sesión del día se limpia por completo", () => {
      const r = cargar({ silencioso: true });
      const sesion = r.api.__sesionDiaParaTest();
      t.cierto(!!sesion && !!sesion.fechasLab && !!sesion.contextoAvisado && !!sesion.acompEntendido, "M8: el accessor expone las tres estructuras");
      sesion.fechasLab.add("casilla-lab-uno");
      sesion.contextoAvisado.add("contexto-uno");
      sesion.acompEntendido.set("doc-uno", 12345);
      t.igual(sesion.fechasLab.size, 1, "M8: quedó una fecha de laboratorio");
      t.igual(sesion.contextoAvisado.size, 1, "M8: quedó un contexto avisado");
      t.igual(sesion.acompEntendido.size, 1, "M8: quedó un acompañante entendido");
      r.api._vglLimpiarSesionDia();
      t.igual(sesion.fechasLab.size, 0, "M8: fechas de laboratorio vacías");
      t.igual(sesion.contextoAvisado.size, 0, "M8: contextos avisados vacíos");
      t.igual(sesion.acompEntendido.size, 0, "M8: acompañantes entendidos vacíos");
    });

    // ---------------------------------------------------------------
    // B10 + B13 — EL APAGADO DE EMERGENCIA APAGA DE VERDAD. El
    // observador de ventanas minimizadas seguía vivo tras el kill remoto
    // (observando el DOM para siempre) y el registro de navegación
    // seguía despertando cada 5 segundos. Ambos se sueltan ahora.
    // ---------------------------------------------------------------
    t.caso("B10+B13: el apagado de emergencia suelta observador y registro", () => {
      const r = cargar({ silencioso: true });
      t.cierto(r.api.vglMinInstalar(), "B10: la vigilancia de minimizadas se instala");
      const observador = r.api.vglMinInstalar._obs;
      t.cierto(!!observador, "B10: dejó el observador al alcance del apagado");
      let desconectados = 0;
      const original = observador.disconnect;
      observador.disconnect = () => { desconectados++; };
      let navVivo = null;
      for (const [, entrada] of r.env.intervalos) {
        if (String(entrada.f).indexOf("UrlChanged") >= 0) { navVivo = entrada; break; }
      }
      t.cierto(!!navVivo, "B13: el registro de navegación está activo");
      t.cierto(navVivo.vivo === true, "B13: y despierto");
      try {
        r.api.emergencyTeardown("prueba del banco (B13)");
        t.igual(desconectados, 1, "B10: el observador quedó desconectado");
        t.cierto(navVivo.vivo === false, "B13: el registro de navegación quedó detenido");
      } finally {
        observador.disconnect = original;
      }
    });
  },
};
