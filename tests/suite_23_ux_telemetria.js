const fs = require("fs");
const path = require("path");
// Suite 23 — v12.5.0: telemetría de uso del panel (mejora continua).
// Regla sagrada bajo prueba: en la ventana de conteos y en la fila "ux" que viaja al
// tablero JAMÁS puede haber datos de paciente — solo nombres fijos de acción y números.
// Respuesta con la forma completa que espera _pageFetchJsonCore (headers/text/clone
// incluidos), igual que en suite_05_api_everest.js.
const respuestaOk = (data) => ({
  ok: true, status: 200,
  headers: { get: () => "application/json" },
  json: async () => data,
  text: async () => JSON.stringify(data),
  clone() { return this; },
});
const respuesta404 = () => ({
  ok: false, status: 404,
  headers: { get: () => "application/json" },
  json: async () => null,
  text: async () => "",
  clone() { return this; },
});

module.exports = {
  nombre: "Telemetría de uso del panel (v12.5)",
  cubre: [
    "_esErrorPropio", "_getFirmaPropiaParaTest", "_setFirmaPropiaParaTest", "_instalarCazaErrores", "uxTrack", "_uxVolcarBuffer", "uxEnviarVentana", "uxFlush", "uxBootCheck", "reportar", "repDiagnostico", "_repSello",
    "_equipoId", "_sanearMensajeError", "reportarError",
    "_rumEndpointLabel", "_sanearDondeError", "_errRepeticion",
    "_rumCubeta", "_rumEsNuestro", "_rumNodoEsNuestro", "_rumTramo",
    // v17.43.0 — diario de lentitud: el anillo de fases y el volcado a la bitácora
    "_rumTramoAnotar", "_rumTramosParaTest", "_rumTramosResetParaTest", "_perfRegistrarTareaLarga",
    // v15.x — vaciado de telemetria al cerrarse la pestaña (antes era un closure sin pruebas)
    "_vaciarTelemetriaAlSalir", "repBeacon",
    // v15.2.0 — lista blanca de etiquetas de friccion
    "_rageEtiqueta", "_detectarRageClick", "_instalarRageTracker", "_iniciarRumObserver",
    "_gmNotify", "_instalarDescargaResiliente",
    "mtrTableroTelemetria", "mtrTableroTelemetriaHtml"],
  async pruebas(t, api, env, cargar) {

    // =====================================================================
    // v14.1.6 — EL CAZADOR DE ERRORES QUE NO CAZABA NADA.
    //
    // El export real del tablero (20 equipos, ~6 días) no tenía hoja `error` — y el
    // servidor la crea al recibir el primer evento, así que nunca llegó ninguno. Segunda
    // confirmación independiente: en `uso_detalle` no hay ni una clave `error.*`, y esas
    // se emiten ANTES del tope diario y ANTES de comprobar si el envío está encendido.
    //
    // La causa: el filtro exigía que el nombre de archivo del error contuviera
    // "userscript" o "vigilante". Cómo se llama ese archivo depende de cómo inyecte el
    // gestor de userscripts, y en varias configuraciones no contiene ninguna de las dos.
    // El filtro que debía dejar fuera los errores de Everest dejaba fuera los nuestros.
    // =====================================================================
    t.caso("_esErrorPropio v14.1.6: reconoce nuestro código por la FIRMA capturada al arrancar, aunque el nombre de archivo no diga 'userscript' ni 'vigilante'", () => {
      const c = cargar({ silencioso: true });
      c.api._setFirmaPropiaParaTest("blob:https://neps.everestintelligent.com/a1b2c3");

      const pilaNuestra = "Error: x\n    at estadioKDIGO (blob:https://neps.everestintelligent.com/a1b2c3:2801:9)";
      t.cierto(c.api._esErrorPropio(pilaNuestra, ""), "el stack lleva nuestra firma: es nuestro");
      t.cierto(c.api._esErrorPropio("", "blob:https://neps.everestintelligent.com/a1b2c3"), "también vale si la firma viene en el nombre de archivo");

      const pilaAjena = "TypeError: y\n    at HttpClient (https://neps.everestintelligent.com/main.9f3.js:1:200)";
      t.falso(c.api._esErrorPropio(pilaAjena, "https://neps.everestintelligent.com/main.9f3.js"),
        "un error de Everest NO se reporta: llenaría el tablero de ruido que no podemos arreglar");
    });

    t.caso("_esErrorPropio v14.1.6: sin firma capturada sigue funcionando la heurística vieja (respaldo, no sustituto)", () => {
      const c = cargar({ silencioso: true });
      c.api._setFirmaPropiaParaTest("");
      t.cierto(c.api._esErrorPropio("at f (chrome-extension://x/userscript.html?id=9:12:3)", ""), "el caso que la versión vieja SÍ cazaba sigue cazándose");
      t.cierto(c.api._esErrorPropio("", "moz-extension://abc/vigilante_agenda.user.js"), "y el nombre del propio archivo también");
      t.falso(c.api._esErrorPropio("at HttpClient (https://everest/main.js:1:2)", ""), "sin firma, un error ajeno se sigue descartando");
    });

    t.caso("_esErrorPropio v14.1.6: la firma se captura sola al cargar el script — si quedara vacía, el arreglo entero sería inútil", () => {
      const c = cargar({ silencioso: true });
      const firma = c.api._getFirmaPropiaParaTest();
      t.cierto(typeof firma === "string", "la firma existe como cadena");
      t.cierto(firma.length > 4, "y se capturó algo con forma de ruta: obtuvo " + JSON.stringify(firma));
    });


    // gmxhr que siempre falla: reportar() encola pero repFlush no puede entregar, así
    // la fila queda VISIBLE en la cola persistente (vgl_repq) para asertarla.
    const cfgRed = { silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red simulada"); } };
    const cola = (c) => { try { return JSON.parse(c.env.gm["vgl_repq"] || "[]"); } catch (e) { return []; } };
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    // v15.6.0 — uxTrack acumula en memoria (tandas de 2 s): quien lea la ventana debe
    // volcar primero con c.api._uxVolcarBuffer(), como hace el propio uxFlush.
    const ventana = (c) => { try { c.api._uxVolcarBuffer(); return JSON.parse(c.env.storage.getItem("vgl_ux") || "null"); } catch (e) { return null; } };

    // ================= v15.7.0 — EMBUDO DE TELEMETRÍA, de inicio a fin =================
    t.caso("repDiagnostico: con el envío APAGADO, la primera puerta lo dice sin rodeos", () => {
      const c = cargar(cfgRed);
      c.api.__S.reporte = false;
      const d = c.api.repDiagnostico();
      const p1 = d[0];
      // v18.0.6 — v17.58.2 renombró esta puerta ("Interruptor de envío" -> "Estado del
      // envío"), porque desde esa versión la telemetría es obligatoria y el apagado ya no
      // es un interruptor que el médico pueda tocar, sino un estado imposible por interfaz.
      // Lo que la prueba protege no es el rótulo: es que la PRIMERA puerta del embudo sea
      // el estado del envío, y que diga sin rodeos que está apagado.
      t.cierto(/env[ií]o|interruptor/i.test(p1.paso), "la primera puerta es el estado del envío: " + p1.paso);
      t.falso(p1.ok, "y está cerrada");
      t.cierto(/APAGADO/.test(p1.detalle), "con la causa en claro");
      t.cierto(d.length >= 6, "el embudo completo se revisa igual (" + d.length + " puertas)");
    });

    t.caso("repDiagnostico: encendido y con permisos, las puertas estructurales abren y la cola se cuenta", () => {
      const c = cargar(cfgRed);
      c.api.__S.reporte = true;
      c.api.reportar("prueba", {});   // encola una fila (la red simulada falla: se queda en cola)
      const d = c.api.repDiagnostico();
      t.cierto(d[0].ok && d[1].ok && d[2].ok, "interruptor + dirección + permiso: abiertos");
      const cola = d.find((x) => x.paso.includes("Cola"));
      t.cierto(/1 fila/.test(cola.detalle), "la fila encolada se ve en el diagnóstico");
    });

    await t.casoAsync("_repSello vía repPost: el éxito sella vgl_rep_last_ok y el fracaso sella vgl_rep_last_err con causa legible", async () => {
      const cOk = cargar({ silencioso: true, gmxhr: (o) => setTimeout(() => o.onload({ status: 200, finalUrl: "https://script.google.com/x", responseText: '{"ok":true}' }), 0) });
      await cOk.api.repPost({ token: "t", evento: "prueba" });
      t.cierto(!!cOk.env.storage.getItem("vgl_rep_last_ok"), "éxito sellado");
      const cErr = cargar({ silencioso: true, gmxhr: (o) => setTimeout(() => o.onload({ status: 200, finalUrl: "https://accounts.google.com/ServiceLogin", responseText: "<html>" }), 0) });
      await cErr.api.repPost({ token: "t", evento: "prueba" });
      const err = JSON.parse(cErr.env.storage.getItem("vgl_rep_last_err"));
      t.cierto(/inicio de sesión/.test(err.detalle), "el fracaso explica la causa (la hoja pidió login)");
      const d = cErr.api.repDiagnostico();
      const pErr = d.find((x) => x.paso.includes("fallido"));
      t.falso(pErr.ok, "el diagnóstico enseña ese último fallo");
    });

    t.caso("uxTrack: acumula conteos por acción y suma .total con extra.n", () => {
      const c = cargar(cfgRed);
      c.api.uxTrack("panel.agendar.abrir");
      c.api.uxTrack("panel.agendar.abrir");
      c.api.uxTrack("ordenes.creadas", { n: 3 });
      c.api._uxVolcarBuffer();
      const w = ventana(c);
      t.igual(w.acciones["panel.agendar.abrir"], 2);
      t.igual(w.acciones["ordenes.creadas"], 1);
      t.igual(w.acciones["ordenes.creadas.total"], 3);
      t.cierto(!!w.dia && !!w.desde, "la ventana lleva día y hora de inicio");
    });

    // v15.6.0 (auditoría H1) — uxTrack acumula en MEMORIA y el disco solo se toca al
    // volcar la tanda: así 92 sitios de telemetría dejan de reescribir el objeto entero
    // en localStorage por cada clic.
    t.caso("uxTrack en tandas: antes del volcado el disco NO se toca; al volcar, los deltas se SUMAN a lo que otra pestaña haya dejado", () => {
      const c = cargar(cfgRed);
      c.api.uxTrack("panel.abrir");
      c.api.uxTrack("panel.abrir");
      t.falso(!!c.env.storage.getItem("vgl_ux"), "sin volcar: cero escrituras a disco");
      // otra pestaña dejó su propia cuenta en la ventana compartida
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: c.api.todayStamp(), desde: 1, acciones: { "panel.abrir": 5 } }));
      c.api._uxVolcarBuffer();
      t.igual(ventana(c).acciones["panel.abrir"], 7, "los deltas se suman, no pisan");
      c.api._uxVolcarBuffer();
      t.igual(ventana(c).acciones["panel.abrir"], 7, "volcar dos veces no duplica (el buffer se consume)");
    });

    t.caso("uxTrack: la clave se limpia a caracteres fijos — nada del DOM o del paciente puede colarse", () => {
      const c = cargar(cfgRed);
      c.api.uxTrack("Acción Con Espacios ¡Y signos! 42");
      const claves = Object.keys(ventana(c).acciones);
      t.igual(claves.length, 1);
      t.cierto(/^[a-z0-9.:_-]+$/.test(claves[0]), "solo minúsculas/números/./:/_/-");
      c.api.uxTrack("");            // vacío: ni se registra
      t.igual(Object.keys(ventana(c).acciones).length, 1);
    });

    t.caso("uxTrack: con el interruptor de Ajustes apagado no se registra nada", () => {
      const c = cargar(cfgRed);
      c.api.__S.uxTelemetria = false;
      c.api.uxTrack("panel.agendar.abrir");
      t.igual(ventana(c), null, "ventana jamás creada con el toggle apagado");
    });

    t.caso("uxEnviarVentana: empaqueta UNA fila 'ux' con el total y el JSON de acciones", () => {
      const c = cargar(cfgRed);
      const w = { dia: "2026-08-11", desde: "2026-08-11T07:00:00Z", acciones: { "cita.creada:12": 2, "ordenes.creadas": 1, "ordenes.creadas.total": 4 } };
      t.cierto(c.api.uxEnviarVentana(w));
      const q = cola(c);
      t.igual(q.length, 1);
      t.igual(q[0].evento, "ux");
      t.igual(q[0].deDia, "2026-08-11");
      t.igual(q[0].n, 3, "el total NO cuenta los acumulados .total");
      const acc = JSON.parse(q[0].acciones);
      t.igual(acc["cita.creada:12"], 2);
      // La fila lleva SOLO las claves del contrato del tablero: nada de nombres/cédulas.
      const claves = Object.keys(q[0]).sort();
      t.igual(claves, ["acciones", "deDia", "desde", "dia", "equipo", "evento", "lote", "n", "token", "ts", "ver"]);
      // v12.6.9 — `equipo` ya no puede salir vacío: en la Hoja real TODAS las filas venían
      // sin él (dependía de un ajuste manual que nadie llena) y no había forma de saber si
      // dos filas eran del mismo consultorio.
      t.cierto(!!q[0].equipo, "la fila siempre identifica el equipo");
      t.cierto(!!q[0].lote, "y lleva identificador de lote para descartar duplicados");
    });

    // =====================================================================
    // v12.6.9 — Lo que la Hoja real dejó ver: columna `equipo` vacía en todas las filas y
    // filas DUPLICADAS exactas (mismo ts y mismo payload, entregadas con minutos de
    // diferencia por un reintento de la cola).
    // =====================================================================
    t.caso("equipo: si el ajuste está vacío se usa un id anónimo ESTABLE de este navegador", () => {
      const c = cargar(cfgRed);
      c.api.__S.equipo = "";
      const id1 = c.api._equipoId();
      t.cierto(!!id1, "nunca vacío");
      t.igual(c.api._equipoId(), id1, "el mismo navegador siempre reporta el mismo id");
      t.cierto(/^eq-[a-z0-9]+$/.test(id1), "es un número de serie sin significado, no un dato de la persona");
      // El nombre que el médico ponga en Ajustes manda sobre el automático.
      c.api.__S.equipo = "CONSULTORIO 3";
      t.igual(c.api._equipoId(), "CONSULTORIO 3");
    });

    t.caso("lote: cada fila encolada lleva un identificador distinto (el tablero puede descartar el duplicado)", () => {
      const c = cargar(cfgRed);
      c.api.reportar("prueba", {});
      c.api.reportar("prueba", {});
      const q = cola(c);
      t.igual(q.length, 2);
      t.cierto(q[0].lote !== q[1].lote, "dos filas distintas nunca comparten lote");
    });

    t.caso("_sanearMensajeError: sin URL, sin comillas y sin ninguna tira de 6+ dígitos (jamás una cédula)", () => {
      const c = cargar(cfgRed);
      const limpio = c.api._sanearMensajeError('Fallo al leer "paciente" 21545051 en https://neps.everestintelligent.com/viva/HCHealth/x?y=1');
      t.falso(/\d{6,}/.test(limpio), "ninguna tira de 6+ dígitos sobrevive");
      t.falso(limpio.includes("https://"), "las URL se reemplazan");
      t.falso(/["'`]/.test(limpio), "sin comillas");
      t.cierto(limpio.includes("Fallo al leer"), "el mensaje sigue siendo legible");
      t.cierto(c.api._sanearMensajeError(null) === "");
    });

    // v17.1.0 (#148) — El tope pasó de 5 ERRORES a 40 HUELLAS DISTINTAS por día, por orden
    // del médico («5 por día es muy poco, se debe reportar todo»). El cambio no es de
    // número: es de UNIDAD. Antes, cinco repeticiones del mismo fallo agotaban el cupo y
    // el sexto defecto —otro, distinto, quizá el grave— no llegaba nunca. Ahora las
    // repeticiones no gastan cupo y cada falla distinta viaja con su detalle.
    t.caso("reportarError: el MISMO fallo repetido nueve veces manda UNA sola fila — y el contador sigue viendo los nueve", () => {
      const c = cargar(cfgRed);
      // Misma huella las nueve veces: mismo origen y mismo "dónde".
      for (let i = 0; i < 9; i++) c.api.reportarError("js", "algo falló", "vigilante.user.js:1");
      const filas = cola(c).filter((f) => f.evento === "error");
      t.igual(filas.length, 1, "un bucle de errores no puede convertirse en una tormenta de filas");
      t.igual(filas[0].origen, "js");
      c.api._uxVolcarBuffer();
      const w = JSON.parse(c.env.win.localStorage.getItem("vgl_ux"));
      t.igual(w.acciones["error.js"], 9, "pero el CONTADOR sí ve los nueve");
      t.igual(w.acciones["error.distintos"], 1, "y sabe que es UNA sola falla, no nueve");
    });

    t.caso("reportarError: nueve fallos DISTINTOS mandan nueve filas — ya no se tapan entre ellos", () => {
      const c = cargar(cfgRed);
      for (let i = 0; i < 9; i++) c.api.reportarError("js", "algo falló " + i, "vigilante.user.js:" + (100 + i));
      const filas = cola(c).filter((f) => f.evento === "error");
      t.igual(filas.length, 9, "cada defecto distinto tiene derecho a su detalle: era lo que pidió el médico");
    });

    t.caso("reportarError: el número de línea SOBREVIVE al saneado — el archivo tiene más de 30.000 líneas", () => {
      // El saneador de mensajes borra toda tira de 5 a 12 dígitos para matar cédulas.
      // Aplicado al campo "dónde", borraba el número de línea de dos tercios del archivo:
      // "vigilante_agenda.user.js:12668" salía como "vigilante_agenda.user.js:". Es decir,
      // el tope de detalle entregaba filas SIN el detalle.
      const c = cargar(cfgRed);
      c.api.reportarError("js", "TypeError: x is not a function", "vigilante_agenda.user.js:12668:31");
      const fila = cola(c).filter((f) => f.evento === "error")[0];
      t.cierto(/:12668/.test(fila.donde), "la línea llega entera: " + fila.donde);
      t.cierto(/vigilante_agenda\.user\.js/.test(fila.donde), "y el archivo también");
    });

    t.caso("reportarError: una cédula dentro del «dónde» sigue sin viajar", () => {
      // El relajamiento es SOLO para el patrón archivo:línea:columna. Cualquier otra cosa
      // sigue pasando por el saneador de siempre — la regla de cero PHI no se negocia.
      const c = cargar(cfgRed);
      c.api.reportarError("api", "fallo", "paciente 1098765432 en la cola");
      const fila = cola(c).filter((f) => f.evento === "error")[0];
      t.falso(/1098765432/.test(fila.donde), "la cédula NO puede aparecer en el dónde: " + fila.donde);
    });

    t.caso("uxEnviarVentana: ventana vacía o reporte apagado = no se encola nada", () => {
      const c = cargar(cfgRed);
      t.falso(c.api.uxEnviarVentana(null));
      t.falso(c.api.uxEnviarVentana({ dia: "2026-08-11", acciones: {} }));
      c.api.__S.uxTelemetria = false; // toggle propio apagado (reporte AÚN encendido)
      t.falso(c.api.uxEnviarVentana({ dia: "2026-08-11", acciones: { a: 1 } }), "con uxTelemetria=false una ventana pendiente NO viaja");
      c.api.__S.uxTelemetria = true;
      c.api.__S.reporte = false;    // el interruptor general del reporte también manda
      t.falso(c.api.uxEnviarVentana({ dia: "2026-08-11", acciones: { a: 1 } }));
      t.igual(cola(c).length, 0);
    });

    t.caso("uxFlush: la pestaña líder envía la ventana con conteos y la reinicia", () => {
      const c = cargar(cfgRed);
      c.api.heartbeat();            // reclama el liderazgo en el sandbox limpio
      c.api.uxTrack("panel.labs.abrir");
      c.api.uxFlush();
      t.igual(cola(c).length, 1, "una fila encolada");
      c.api._uxVolcarBuffer();
      const w = ventana(c);
      t.igual(Object.keys(w.acciones).length, 0, "la ventana quedó limpia para la siguiente media hora");
      c.api.uxFlush();              // sin conteos nuevos: no encola otra fila
      t.igual(cola(c).length, 1);
    });

    t.caso("uxTrack v12.5.1: al cambiar el día la ventana vieja se APARCA (no se envía) y arranca una limpia", () => {
      // Cualquier pestaña puede cruzar la medianoche: si cada una enviara, la fila se
      // duplicaría. El aparcadero lo despacha solo la líder en su siguiente ciclo.
      const c = cargar(cfgRed);
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: "2020-01-01", desde: "2020-01-01T07:00:00Z", acciones: { "panel.labs.abrir": 5 } }));
      c.api.uxTrack("panel.agendar.abrir");
      c.api._uxVolcarBuffer(); // v15.6.0: el aparcado ocurre al volcar la tanda, no en el uxTrack mismo
      t.igual(cola(c).length, 0, "el cambio de día NO encola directo (eso es de la líder)");
      const pend = JSON.parse(c.env.storage.getItem("vgl_ux_pend"));
      t.igual(pend.acciones["panel.labs.abrir"], 5, "la ventana vieja quedó aparcada intacta");
      const w = ventana(c);
      t.igual(w.acciones["panel.agendar.abrir"], 1);
      t.falso("panel.labs.abrir" in w.acciones, "la ventana nueva no arrastra lo aparcado");
      // La líder la despacha en su siguiente ciclo (junto con la corriente si tiene datos):
      c.api.heartbeat();
      c.api.uxFlush();
      const q = cola(c);
      t.igual(q.length, 2, "aparcada + corriente");
      t.igual(q[0].deDia, "2020-01-01", "lo de ayer viaja con SU fecha");
      t.igual(c.env.storage.getItem("vgl_ux_pend"), null, "el aparcadero quedó libre");
    });

    t.caso("uxFlush/uxBootCheck v12.5.1: una pestaña NO líder jamás envía (guard de heartbeat)", () => {
      const c = cargar(cfgRed);
      // Otra pestaña tiene el liderazgo con latido fresco:
      c.env.storage.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now() }));
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: "2020-01-01", desde: "x", acciones: { "panel.labs.abrir": 3 } }));
      c.api.uxFlush();
      c.api.uxBootCheck();
      t.igual(cola(c).length, 0, "sin liderazgo no sale ni una fila");
      t.igual(ventana(c).acciones["panel.labs.abrir"], 3, "la ventana sigue intacta para la líder");
    });

    t.caso("uxTrack v12.5.1: el tope de 60 caracteres de la clave sí recorta", () => {
      const c = cargar(cfgRed);
      c.api.uxTrack("a".repeat(80));
      const claves = Object.keys(ventana(c).acciones);
      t.igual(claves[0].length, 60);
    });

    t.caso("uxEnviarVentana v12.5.1: el saneo se re-aplica AL EXPORTAR — una ventana contaminada no sube PII", () => {
      // localStorage lo comparte la página: si un tercero (u otro bug) escribiera
      // texto de paciente en vgl_ux, la fila del tablero NO puede llevarlo.
      const c = cargar(cfgRed);
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: "2026-08-11", desde: "x", acciones: {
        "PACIENTE JUAN PEREZ CC 1234567": 1,
        "nota": "HTA descompensada, cc 99887766",
        "panel.labs.abrir": 2,
      } }));
      c.api.heartbeat();
      c.api.uxFlush();
      const q = cola(c);
      t.igual(q.length, 1);
      t.falso(q[0].acciones.includes("1234567"), "la cédula de la clave no viaja (tiras de 6+ dígitos fuera)");
      t.falso(q[0].acciones.includes("HTA"), "un valor string (texto libre) se descarta entero");
      t.falso(q[0].acciones.includes("99887766"), "ni la cédula del valor");
      t.cierto(typeof q[0].n === "number", "n vuelve a ser SIEMPRE numérico");
      const acc = JSON.parse(q[0].acciones);
      t.igual(acc["panel.labs.abrir"], 2, "lo legítimo sí viaja");
    });

    t.caso("uxEnviarVentana v12.5.1: el presupuesto omite CLAVES enteras — jamás un JSON partido", () => {
      const c = cargar(cfgRed);
      const acciones = {};
      for (let i = 0; i < 300; i++) acciones["accion.numero." + i + ".de.nombre.largo.para.forzar.presupuesto"] = i + 1;
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: "2026-08-11", desde: "x", acciones }));
      c.api.heartbeat();
      c.api.uxFlush();
      const q = cola(c);
      t.igual(q.length, 1);
      t.cierto(q[0].acciones.length <= 4000, "dentro del presupuesto");
      const acc = JSON.parse(q[0].acciones); // si estuviera partido, esto lanzaría
      t.cierto(acc._recortadas > 0, "y declara cuántas claves omitió");
    });

    t.caso("v12.5.1: cambio de día con el reporte APAGADO no tira los conteos — quedan aparcados hasta poder salir", () => {
      const c = cargar(cfgRed);
      c.api.__S.reporte = false;
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: "2020-01-01", desde: "x", acciones: { "panel.labs.abrir": 4 } }));
      c.api.uxTrack("panel.agendar.abrir");
      c.api._uxVolcarBuffer(); // v15.6.0: el aparcado por cambio de día ocurre al volcar la tanda
      t.igual(cola(c).length, 0);
      t.cierto(!!c.env.storage.getItem("vgl_ux_pend"), "aparcada, no descartada");
      c.api.__S.reporte = true;         // vuelve la red/el reporte
      c.api.heartbeat();
      c.api.uxFlush();
      t.igual(cola(c).filter((r) => r.deDia === "2020-01-01").length, 1, "los conteos viejos salieron al reactivarse");
    });

    t.caso("uxEnviarVentana v12.5.1: con uxTelemetria apagada tampoco exporta (rama propia, no solo uxTrack)", () => {
      const c = cargar(cfgRed);
      c.api.__S.uxTelemetria = false;
      t.falso(c.api.uxEnviarVentana({ dia: "2026-08-11", desde: "x", acciones: { a: 1 } }));
      t.igual(cola(c).length, 0);
    });

    // v17.1.0 (#148) — El tope subió de 30 a 80 filas y el orden de sacrificio se hizo
    // explícito: primero «ux», luego «entorno», y solo si no queda otra se recorta por la
    // cabeza. Antes, cuando no había filas «ux» que sacrificar, el slice(-30) final tiraba
    // las MÁS VIEJAS — y las filas de error son siempre las más viejas, porque los fallos
    // se concentran en el arranque. Así se perdían enteras y en silencio.
    t.caso("repQSave: al desbordarse la cola, las filas 'ux' se sacrifican antes que fraude/resumen", () => {
      const c = cargar(cfgRed);
      const filas = [];
      for (let i = 0; i < 78; i++) filas.push({ evento: "ux", i });
      filas.push({ evento: "fraude", hora: "08:00" });
      filas.push({ evento: "resumen", deDia: "2026-08-10" });
      c.env.gm["vgl_repq"] = JSON.stringify(filas);
      // Tres filas nuevas de fraude desbordan el tope de 80:
      c.api.reportar("fraude", { hora: "09:00" });
      c.api.reportar("fraude", { hora: "09:10" });
      c.api.reportar("fraude", { hora: "09:20" });
      const q = cola(c);
      t.cierto(q.length <= 80);
      t.igual(q.filter((r) => r.evento === "fraude").length, 4, "ningún fraude se perdió");
      t.igual(q.filter((r) => r.evento === "resumen").length, 1, "el resumen tampoco");
      t.cierto(q.filter((r) => r.evento === "ux").length < 78, "los recortados fueron ux");
    });

    t.caso("repQSave: sin filas 'ux' que sacrificar, las de ERROR sobreviven al recorte", () => {
      // Este es el caso que se perdía en silencio: cola llena de fraude (que es evidencia
      // y no se sacrifica) con las filas de error al principio, por ser las más viejas.
      const c = cargar(cfgRed);
      const filas = [];
      for (let i = 0; i < 5; i++) filas.push({ evento: "error", origen: "js", i });
      for (let i = 0; i < 80; i++) filas.push({ evento: "fraude", hora: "08:00", i });
      c.env.gm["vgl_repq"] = JSON.stringify(filas);
      c.api.reportar("entorno", { nav: "Edge" });
      const q = cola(c);
      t.cierto(q.length <= 80, "el tope se respeta");
      t.igual(q.filter((r) => r.evento === "entorno").length, 0,
        "«entorno» es lo primero que se sacrifica tras «ux»: se reenvía solo al día siguiente");
      t.igual(q.filter((r) => r.evento === "error").length, 5,
        "las cinco filas de error siguen ahí: son la única copia que existe de esos fallos");
    });

    t.caso("v12.5.1: la const VERSION de respaldo no puede volver a quedarse atrás del @version del encabezado", () => {
      // Tres versiones salieron con VERSION="12.3.37" mintiendo en el tablero y el log.
      const fs = require("fs"), path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const header = /@version\s+([\d.]+)/.exec(src);
      const respaldo = /const VERSION = [^;]*\|\|\s*"([\d.]+)"/.exec(src);
      t.cierto(!!header && !!respaldo, "ambas versiones localizadas en el fuente");
      t.igual(respaldo[1], header[1], "el literal de respaldo debe ir en paso con @version");
    });

    t.caso("uxBootCheck: al arrancar solo despacha ventanas de OTRO día; la de hoy se respeta", () => {
      const c = cargar(cfgRed);
      c.api.heartbeat();
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: "2020-01-01", desde: "x", acciones: { a: 1 } }));
      c.api.uxBootCheck();
      t.igual(cola(c).length, 1, "la ventana huérfana de otro día sale al arrancar");
      c.api.uxTrack("panel.busqueda");
      c.api.uxBootCheck();
      t.igual(cola(c).length, 1, "la ventana de HOY no se manda antes de su media hora");
      t.igual(ventana(c).acciones["panel.busqueda"], 1);
    });

    t.caso("_instalarCazaErrores: intercepta errores y rechazos solo del script propio", () => {
      const c = cargar(cfgRed);
      const listeners = {};
      c.env.win.addEventListener = (evt, fn) => { listeners[evt] = fn; };

      c.api._instalarCazaErrores();
      t.cierto(!!listeners.error, "instala window.onerror");
      t.cierto(!!listeners.unhandledrejection, "instala window.unhandledrejection");

      // Simula error ajeno
      listeners.error({ filename: "https://everest.com/app.js", message: "fallo ajeno", lineno: 10 });
      t.igual(cola(c).filter((f) => f.evento === "error").length, 0, "ignora errores de otros scripts");

      // Simula error propio
      listeners.error({ filename: "https://x.com/vigilante_agenda.user.js", message: "fallo nuestro", lineno: 42 });
      let q = cola(c).filter((f) => f.evento === "error");
      t.igual(q.length, 1, "atrapa errores con vigilante en el filename");
      t.igual(q[0].origen, "js");
      t.cierto(q[0].msg.includes("fallo nuestro"));

      // Simula rechazo ajeno
      listeners.unhandledrejection({ reason: { stack: "Error at https://everest.com/app.js:10", message: "rechazo ajeno" } });
      q = cola(c).filter((f) => f.evento === "error");
      t.igual(q.length, 1, "ignora rechazos de promesas de otros scripts");

      // Simula rechazo propio
      listeners.unhandledrejection({ reason: { stack: "Error at https://x.com/userscript.js:10", message: "rechazo nuestro" } });
      q = cola(c).filter((f) => f.evento === "error");
      t.igual(q.length, 2, "atrapa rechazos con userscript en el stack");
      t.igual(q[1].origen, "promesa");
      t.cierto(q[1].msg.includes("rechazo nuestro"));

      // Simula rechazo propio sin mensaje (cae en fallback al string de reason)
      // Si la pila está vacía, pasa porque la validación es `if (pila && !/userscript|vigilante/i.test(pila)) return;`
      listeners.unhandledrejection({ reason: "rechazo string" });
      q = cola(c).filter((f) => f.evento === "error");
      t.igual(q.length, 3, "atrapa rechazos sin stack");
      t.cierto(q[2].msg.includes("rechazo string"));
    });

    // =====================================================================
    // v14.2.12 — _gmNotify: aviso del sistema por la vía de la EXTENSIÓN
    // (GM_notification), para equipos donde la política de la IPS bloquea el permiso
    // web de notificaciones (sale en gris, "administrado por tu organización"). El
    // entorno de pruebas, como un navegador normal sin Tampermonkey, NO trae
    // GM_notification por defecto — eso YA prueba la ruta "sin extensión" de fábrica.
    // =====================================================================
    t.caso("_gmNotify: sin GM_notification en el entorno (caso por defecto) => false, sin tocar el candado cruza-pestañas", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._gmNotify("ROJO", "T", "B", false, "uidA"), false);
      t.igual(c.env.storage.getItem("vgl_n_gm|uidA"), null, "no llegó a marcar el candado: se cortó antes, en el typeof");
    });

    t.caso("_gmNotify: con GM_notification disponible, arma el aviso con el timeout correcto según persist", () => {
      const c = cargar({ silencioso: true });
      let llamadas = [];
      c.env.win.GM_notification = (opts) => llamadas.push(opts);

      t.igual(c.api._gmNotify("ROJO", "Confirmación extemporánea", "cuerpo", true, "uidB"), true);
      t.igual(llamadas.length, 1);
      t.igual(llamadas[0].title, "Confirmación extemporánea");
      t.igual(llamadas[0].text, "cuerpo");
      t.igual(llamadas[0].timeout, 0, "persist=true -> sin auto-cierre (timeout 0)");
      t.igual(llamadas[0].silent, true, "el tono lo pone el propio Vigilante, no el SO");

      llamadas = [];
      t.igual(c.api._gmNotify("AMBAR", "Inasistencia", "cuerpo2", false, "uidC"), true);
      t.igual(llamadas[0].timeout, 20000, "persist=false -> se autocierra a los 20s");
    });

    t.caso("_gmNotify: onclick enfoca la ventana sin lanzar aunque window.focus no exista en este entorno", () => {
      const c = cargar({ silencioso: true });
      let llamadas = [];
      c.env.win.GM_notification = (opts) => llamadas.push(opts);
      c.api._gmNotify("VERDE", "T", "B", false, "uidD");
      t.igual(typeof llamadas[0].onclick, "function");
      t.noLanza(() => llamadas[0].onclick(), "el propio onclick lleva su try/catch alrededor de window.focus()");
    });

    t.caso("_gmNotify: mismo uid dentro de los 12s (varias pestañas) => segunda llamada no dispara otro aviso", () => {
      const c = cargar({ silencioso: true });
      let llamadas = [];
      c.env.win.GM_notification = (opts) => llamadas.push(opts);
      t.igual(c.api._gmNotify("ROJO", "T1", "B1", true, "uidE"), true);
      t.igual(c.api._gmNotify("ROJO", "T2", "B2", true, "uidE"), false, "duplicado cruza-pestañas: crossTabDup lo corta");
      t.igual(llamadas.length, 1, "GM_notification NO se volvió a llamar");
    });

    t.caso("_gmNotify: si GM_notification lanza, el aviso falla en silencio (false), nunca revienta la llamada", () => {
      const c = cargar({ silencioso: true });
      c.env.win.GM_notification = () => { throw new Error("la extensión rechazó el aviso"); };
      let resultado;
      t.noLanza(() => { resultado = c.api._gmNotify("ROJO", "T", "B", false, "uidF"); });
      t.igual(resultado, false);
    });

    // =====================================================================
    // v15.2.0 — _iniciarRumObserver: Long Tasks (>50ms) e INP pasivo. El entorno de
    // pruebas no trae PerformanceObserver (como cualquier entorno sin ese API) — eso ya
    // prueba, de fábrica, la ruta "sin RUM disponible". Para probar la lógica REAL de
    // los dos observadores (no solo que se instalan sin lanzar, vía
    // _instalarCazaErrores en la prueba de arriba) se inyecta una clase falsa en
    // c.env.win.PerformanceObserver DESPUÉS de cargar(): como ctx y env.win son el
    // mismo objeto por dentro (ver harness.js/cargar), el script la ve como si fuera
    // del navegador real.
    // =====================================================================
    t.caso("_iniciarRumObserver: sin PerformanceObserver en el entorno (caso por defecto) no revienta y no instala nada", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api._iniciarRumObserver());
    });

    // v17.43.0 — esta prueba fijaba "uxTelemetria apagada ⇒ ningún observador". Ese
    // contrato cambió a propósito, y su INTENCIÓN (que el interruptor de privacidad se
    // respete) se conserva entera abajo: con los DOS apagados sigue sin instalarse nada.
    // El motivo del cambio: el médico reportó lentitud real pero "no sé cuándo". El
    // observador es lo único que puede cazarla, y estaba atado al interruptor de la
    // telemetría que PUEDE SALIR del equipo — que él tiene apagado. Se separaron: `perfLog`
    // gobierna la bitácora LOCAL de lentitud; `uxTelemetria` sigue gobernando, sola, los
    // contadores que viajan.
    t.caso("_iniciarRumObserver: con uxTelemetria Y perfLog apagados, NO crea ningún observador", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.uxTelemetria = false;
      c.api.__S.perfLog = false;
      const creados = [];
      class FakePO { constructor(cb) { creados.push(cb); } observe() {} }
      c.env.win.PerformanceObserver = FakePO;
      c.api._iniciarRumObserver();
      t.igual(creados.length, 0, "con los dos interruptores en 'no', el médico no es observado de ninguna forma");
    });

    t.caso("_iniciarRumObserver: con uxTelemetria apagada pero perfLog encendido, SÍ observa — y no filtra ni un contador", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.uxTelemetria = false;   // el interruptor de lo que SALE del equipo: apagado
      c.api.__S.perfLog = true;         // el de la bitácora local: encendido
      const creados = [];
      class FakePO { constructor(cb) { creados.push(cb); } observe() {} }
      c.env.win.PerformanceObserver = FakePO;
      c.api._iniciarRumObserver();
      t.cierto(creados.length > 0, "el medidor arranca: es la única forma de cazar la lentitud que el médico reporta");
      // Y la garantía que sostiene la separación: uxTrack se autocensura con su propia
      // guarda, así que encender perfLog NO mete ni un contador en el almacén que viaja.
      const antes = JSON.stringify(c.env.almacen[c.api.UX_KEY] || null);
      c.api.uxTrack("rum.self.task.gt300ms");
      const despues = JSON.stringify(c.env.almacen[c.api.UX_KEY] || null);
      t.igual(despues, antes, "con uxTelemetria en 'no', ningún contador se guarda aunque el observador esté vivo");
    });

    // =====================================================================
    //  v17.43.0 — DIARIO DE LENTITUD
    //  El médico: "sí siento lentitud, pero no sé cuándo". Un contador por baldes
    //  (`rum.self.task.gt300ms`) dice cuántas veces pasó y nunca qué estaba corriendo.
    //  Estas pruebas fijan el puente: `_rumTramo` deja las fases caras en un anillo, y
    //  cuando el LoAF avisa de un cuadro largo NUESTRO se vuelca a la bitácora.
    // =====================================================================
    const FLIGHT_KEY_PERF = "vgl_flight_recorder_logs";
    const leerPerf = (c) => {
      try { return JSON.parse(c.env.almacen[FLIGHT_KEY_PERF] || "[]").filter((e) => e.cat === "PERF"); }
      catch (e) { return []; }
    };

    t.caso("_rumTramo: una fase cara queda anotada en el anillo con su nombre y sus ms", () => {
      const c = cargar({ silencioso: true });
      c.api._rumTramosResetParaTest();
      let t0 = 1000;
      c.env.win.performance = { now: () => t0 };
      c.api._rumTramo("tick.cosecha", () => { t0 = 1240; });   // 240 ms
      const anillo = c.api._rumTramosParaTest();
      t.igual(anillo.length, 1, "la fase se anotó");
      t.igual(anillo[0].f, "tick.cosecha", "con su nombre, que es lo que responde '¿qué fue?'");
      t.cierto(anillo[0].ms >= 200, "y con su costo real, no un balde");
    });

    t.caso("_rumTramo: una fase barata NO ensucia el anillo — si todo entrara, no explicaría nada", () => {
      const c = cargar({ silencioso: true });
      c.api._rumTramosResetParaTest();
      let t0 = 1000;
      c.env.win.performance = { now: () => t0 };
      c.api._rumTramo("tick.widget.ordenar", () => { t0 = 1005; });   // 5 ms
      t.igual(c.api._rumTramosParaTest().length, 0, "por debajo de 50 ms no explica ningún tirón");
    });

    t.caso("_rumTramo: el anillo tiene tope — nunca crece sin límite en una jornada entera", () => {
      const c = cargar({ silencioso: true });
      c.api._rumTramosResetParaTest();
      for (let i = 0; i < 40; i++) c.api._rumTramoAnotar("fase" + i, 100);
      t.cierto(c.api._rumTramosParaTest().length <= 12, "acotado al tope, no se acumula");
      const ultimos = c.api._rumTramosParaTest();
      t.igual(ultimos[ultimos.length - 1].f, "fase39", "y conserva las MÁS RECIENTES, que son las que explican el tirón de ahora");
    });

    t.caso("_perfRegistrarTareaLarga: escribe UNA línea en la bitácora, con las fases culpables", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.perfLog = true;
      c.api._rumTramosResetParaTest();
      c.api._rumTramoAnotar("tick.cosecha", 260);
      c.api._perfRegistrarTareaLarga(410, 320);
      const perf = leerPerf(c);
      t.igual(perf.length, 1, "una línea, no una por fase");
      t.igual(perf[0].act, "tarea_larga");
      t.cierto(String(perf[0].det.fases).indexOf("tick.cosecha") >= 0, "dice QUÉ fase estaba corriendo — eso es lo que faltaba");
      t.igual(perf[0].det.ms, 410, "y cuánto costó el cuadro");
    });

    t.caso("_perfRegistrarTareaLarga: vacía el anillo tras volcarlo — no acusa a la fase equivocada dos veces", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.perfLog = true;
      c.api._rumTramosResetParaTest();
      c.api._rumTramoAnotar("tick.cosecha", 260);
      c.api._perfRegistrarTareaLarga(410, 320);
      c.api._perfRegistrarTareaLarga(500, 400);            // segundo tirón, sin fases nuevas
      const perf = leerPerf(c);
      t.igual(perf.length, 2, "las dos quedaron registradas");
      t.igual(String(perf[1].det.fases), "", "la segunda NO hereda la fase de la primera: sería acusar en falso");
    });

    t.caso("_perfRegistrarTareaLarga: con perfLog apagado no escribe nada", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.perfLog = false;
      c.api._rumTramosResetParaTest();
      c.api._rumTramoAnotar("tick.cosecha", 260);
      c.api._perfRegistrarTareaLarga(410, 320);
      t.igual(leerPerf(c).length, 0, "el interruptor manda");
    });

    t.caso("_perfRegistrarTareaLarga: CERO PHI — nunca guarda la cédula, solo si había historia abierta", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.perfLog = true;
      c.api._rumTramosResetParaTest();
      c.env.doc.getElementById = ((real) => (id) => (
        id === "vgl-acciones-dock" ? { dataset: { vglDoc: "1098765432" } } : real(id)
      ))(c.env.doc.getElementById.bind(c.env.doc));
      c.api._perfRegistrarTareaLarga(400, 350);
      const perf = leerPerf(c);
      t.igual(perf[0].det.con_historia, true, "sabe que había un paciente abierto…");
      const crudo = JSON.stringify(perf[0]);
      t.cierto(crudo.indexOf("1098765432") < 0, "…pero la cédula NO aparece por ningún lado en la línea guardada");
    });

    t.caso("_iniciarRumObserver: con PerformanceObserver disponible, instala EXACTAMENTE 2 observadores con las opciones correctas", () => {
      const c = cargar({ silencioso: true });
      const obs = [];
      class FakePO { constructor(cb) { this.cb = cb; obs.push(this); } observe(o) { this.opts = o; } disconnect() {} }
      c.env.win.PerformanceObserver = FakePO;
      c.api._iniciarRumObserver();
      t.igual(obs.length, 2, "uno para tareas largas, otro para el evento de INP");
      // v15.4.0 — entryTypes+buffered emitía en consola real "does not support buffered
      // flag with the entryTypes argument": el flag se ignoraba y las tareas largas
      // previas al arranque se perdían. Con type sí aplica.
      t.igual(JSON.stringify(obs[0].opts), JSON.stringify({ type: "longtask", buffered: true }));
      t.igual(JSON.stringify(obs[1].opts), JSON.stringify({ type: "event", buffered: true, durationThreshold: 200 }));
    });

    t.caso("_iniciarRumObserver: long task por debajo de 50ms y evento por debajo de 200ms no anotan nada (silencio, no basura)", () => {
      const c = cargar({ silencioso: true });
      const obs = [];
      class FakePO { constructor(cb) { this.cb = cb; obs.push(this); } observe(o) { this.opts = o; } }
      c.env.win.PerformanceObserver = FakePO;
      c.api._iniciarRumObserver();
      obs[0].cb({ getEntries: () => [{ duration: 10 }] });
      obs[1].cb({ getEntries: () => [{ duration: 50 }] });
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(ux, null, "nada por debajo del umbral se registra");
    });

    // =====================================================================
    // v17.1.0 (#149) — RUM CON ATRIBUCIÓN. El tablero del médico marcaba 12.803 eventos de
    // tareas largas en una jornada y NINGUNO era del asistente: los observadores viejos
    // escuchaban `longtask` sin mirar quién lo causaba, así que cada ciclo de Angular y
    // cada tabla de Everest se le facturaba al Vigilante. Un dato que no se puede atribuir
    // manda a arreglar lo que no está roto y esconde lo que sí.
    // Ahora todo lleva prefijo: `rum.self.*` (nuestro) o `rum.page.*` (Everest/terceros).
    // =====================================================================
    t.caso("_iniciarRumObserver: sin LoAF, las tareas largas se etiquetan como de la PÁGINA — nunca como nuestras", () => {
      const c = cargar({ silencioso: true });
      const obs = [];
      class FakePO { constructor(cb) { this.cb = cb; obs.push(this); } observe(o) { this.opts = o; } }
      FakePO.supportedEntryTypes = ["longtask", "event"];      // navegador sin LoAF
      c.env.win.PerformanceObserver = FakePO;
      c.api._iniciarRumObserver();
      t.igual(JSON.stringify(obs[0].opts), JSON.stringify({ type: "longtask", buffered: true }),
        "cae al respaldo de longtask");
      obs[0].cb({ getEntries: () => [{ duration: 350 }] });
      obs[0].cb({ getEntries: () => [{ duration: 60 }] });
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(ux.acciones["rum.page.task.gt300ms"], 1, "de la página, porque longtask no permite saber de quién es");
      t.igual(ux.acciones["rum.page.task.50_100ms"], 1);
      t.falso(!!ux.acciones["rum.self.task.gt300ms"], "sin atribución NO se afirma que sea nuestro");
    });

    t.caso("_iniciarRumObserver: con LoAF, el cuadro se atribuye al script que consumió más tiempo", () => {
      const c = cargar({ silencioso: true });
      const obs = [];
      class FakePO { constructor(cb) { this.cb = cb; obs.push(this); } observe(o) { this.opts = o; } }
      FakePO.supportedEntryTypes = ["long-animation-frame", "event"];
      c.env.win.PerformanceObserver = FakePO;
      c.api._setFirmaPropiaParaTest("vigilante_agenda.user.js");
      c.api._iniciarRumObserver();
      t.igual(obs[0].opts.type, "long-animation-frame", "LoAF manda cuando el navegador la trae");

      // Un cuadro de 350 ms donde el grueso es de Everest.
      obs[0].cb({ getEntries: () => [{ duration: 350, scripts: [
        { sourceURL: "https://neps.everestintelligent.com/viva/main.js", duration: 300 },
        { sourceURL: "vigilante_agenda.user.js", duration: 20 },
      ] }] });
      // Y otro de 350 ms que sí es nuestro.
      obs[0].cb({ getEntries: () => [{ duration: 350, scripts: [
        { sourceURL: "vigilante_agenda.user.js", duration: 320 },
      ] }] });
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(ux.acciones["rum.page.task.gt300ms"], 1, "el primero es de Everest");
      t.igual(ux.acciones["rum.self.task.gt300ms"], 1, "el segundo es nuestro");
      t.igual(ux.acciones["rum.self.ms.gt300ms"], 1,
        "y nuestro tiempo se cuenta aparte: es el número que responde «¿cuánto le cuesto al médico?»");
    });

    t.caso("_iniciarRumObserver: el balde intermedio conserva su rango — ya no lo borra el saneador de dígitos", () => {
      // El nombre viejo, «100_300ms», era una corrida de seis dígitos y uxClaveLimpia() se
      // la comía entera para que ninguna cédula pueda viajar dentro de una clave: al
      // tablero llegaba «rum.task.ms», sin rango. La «a» del medio corta la corrida sin
      // relajar el saneador.
      const c = cargar({ silencioso: true });
      const obs = [];
      class FakePO { constructor(cb) { this.cb = cb; obs.push(this); } observe(o) { this.opts = o; } }
      FakePO.supportedEntryTypes = ["longtask", "event"];
      c.env.win.PerformanceObserver = FakePO;
      c.api._iniciarRumObserver();
      obs[0].cb({ getEntries: () => [{ duration: 120 }] });
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(ux.acciones["rum.page.task.de100a300ms"], 1, "el rango llega entero al tablero");
      t.falso(!!ux.acciones["rum.page.task.ms"], "y ya no queda la clave mutilada");
    });

    t.caso("_rumCubeta / _rumEsNuestro / _rumNodoEsNuestro: las tres piezas de la atribución", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._rumCubeta(10), null, "por debajo de 50 ms no hay cubeta: silencio, no basura");
      t.igual(c.api._rumCubeta(60), "50_100ms");
      t.igual(c.api._rumCubeta(120), "de100a300ms");
      t.igual(c.api._rumCubeta(350), "gt300ms");

      c.api._setFirmaPropiaParaTest("vigilante_agenda.user.js");
      t.cierto(c.api._rumEsNuestro("vigilante_agenda.user.js"), "por firma aprendida");
      t.cierto(c.api._rumEsNuestro("blob:https://x/abc"), "los userscripts a menudo corren desde blob:");
      t.falso(c.api._rumEsNuestro("https://neps.everestintelligent.com/viva/main.js"), "Everest no es nuestro");
      t.falso(c.api._rumEsNuestro(""), "sin URL no se afirma nada");

      const hijo = { id: "", className: "", parentElement: { id: "vgl-panel-modal", className: "", parentElement: null } };
      t.cierto(c.api._rumNodoEsNuestro(hijo), "sube por el árbol: el target suele ser un span interno sin clase");
      t.falso(c.api._rumNodoEsNuestro({ id: "card-header", className: "card", parentElement: null }), "un nodo de Everest, no");
      t.falso(c.api._rumNodoEsNuestro(null), "y null no lanza");
    });

    t.caso("_iniciarRumObserver: la interacción lenta se atribuye por el ELEMENTO que el médico tocó", () => {
      // v17.1.0 (#149) — 911 interacciones por encima de medio segundo en la jornada del
      // médico, todas contadas como nuestras. La mayoría eran de formularios de Everest.
      const c = cargar({ silencioso: true });
      const obs = [];
      class FakePO { constructor(cb) { this.cb = cb; obs.push(this); } observe(o) { this.opts = o; } }
      c.env.win.PerformanceObserver = FakePO;
      c.api._iniciarRumObserver();
      const nuestro = { id: "vgl-agm-btn", parentElement: null };
      const ajeno = { id: "colapsado-header", className: "card-header", parentElement: null };
      obs[1].cb({ getEntries: () => [{ duration: 600, target: nuestro }] });
      obs[1].cb({ getEntries: () => [{ duration: 250, target: nuestro }] });
      obs[1].cb({ getEntries: () => [{ duration: 600, target: ajeno }] });
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.igual(ux.acciones["rum.self.inp.poor"], 1, "un botón nuestro lento sí es nuestro");
      t.igual(ux.acciones["rum.self.inp.needs_imp"], 1);
      t.igual(ux.acciones["rum.page.inp.poor"], 1, "y un formulario de Everest lento es de Everest");
    });

    t.caso("_rumTramo: mide una función NUESTRA y devuelve su resultado intacto", () => {
      // La otra mitad de un RUM serio: además de observar lo que dice el navegador, medir
      // los tramos propios, que son los únicos que podemos arreglar.
      const c = cargar({ silencioso: true });
      t.igual(c.api._rumTramo("tick", () => 42), 42, "no se interpone en el valor de retorno");
      let lanzo = false;
      try { c.api._rumTramo("tick", () => { throw new Error("x"); }); } catch (e) { lanzo = true; }
      t.cierto(lanzo, "ni se traga los errores de la función medida");
    });

    t.caso("_iniciarRumObserver: defensa en profundidad — si falla la construcción del observador de long tasks, el de INP se intenta igual (son independientes)", () => {
      const c = cargar({ silencioso: true });
      const obs = [];
      let intentos = 0;
      class FakePO {
        constructor(cb) {
          intentos++;
          if (intentos === 1) throw new Error("el navegador rechazó 'longtask'");
          this.cb = cb; obs.push(this);
        }
        observe(o) { this.opts = o; }
      }
      c.env.win.PerformanceObserver = FakePO;
      t.noLanza(() => c.api._iniciarRumObserver());
      t.igual(intentos, 2, "se intentó construir el segundo aunque el primero falló");
      t.igual(obs.length, 1, "solo el de evento sobrevivió");
      t.igual(obs[0].opts.type, "event");
    });

    // =====================================================================
    // v15.x — _instalarDescargaResiliente: cuelga _vaciarTelemetriaAlSalir de
    // visibilitychange (pestaña oculta) y pagehide (navegación/cierre) para que la
    // telemetría en cola no se pierda si el médico cierra Everest de golpe.
    // =====================================================================
    t.caso("_instalarDescargaResiliente: registra el MISMO manejador en document.visibilitychange y window.pagehide", () => {
      const c = cargar({ silencioso: true });
      const docCalls = [], winCalls = [];
      c.env.doc.addEventListener = (evt, fn) => docCalls.push([evt, fn]);
      c.env.win.addEventListener = (evt, fn) => winCalls.push([evt, fn]);
      c.api._instalarDescargaResiliente();
      t.igual(docCalls.length, 1);
      t.igual(docCalls[0][0], "visibilitychange");
      t.igual(winCalls.length, 1);
      t.igual(winCalls[0][0], "pagehide");
      t.cierto(docCalls[0][1] === winCalls[0][1], "los dos eventos cuelgan del mismo manejador");
      t.cierto(docCalls[0][1] === c.api._vaciarTelemetriaAlSalir, "y ese manejador es _vaciarTelemetriaAlSalir");
    });

    t.caso("_instalarDescargaResiliente: si falta document.addEventListener, window.pagehide se instala igual (independientes)", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.addEventListener = undefined;
      const winCalls = [];
      c.env.win.addEventListener = (evt, fn) => winCalls.push([evt, fn]);
      t.noLanza(() => c.api._instalarDescargaResiliente());
      t.igual(winCalls.map((x) => x[0]).join(","), "pagehide");
    });

    t.caso("_instalarDescargaResiliente: si falta window.addEventListener, document.visibilitychange se instala igual (independientes)", () => {
      const c = cargar({ silencioso: true });
      c.env.win.addEventListener = undefined;
      const docCalls = [];
      c.env.doc.addEventListener = (evt, fn) => docCalls.push([evt, fn]);
      t.noLanza(() => c.api._instalarDescargaResiliente());
      t.igual(docCalls.map((x) => x[0]).join(","), "visibilitychange");
    });

    // =====================================================================
    // v15.2.0 — _instalarRageTracker: engancha _detectarRageClick a TODOS los clics de
    // la página (captura, no burbuja: así ve el clic antes de que Everest lo detenga)
    // para medir fricción real (varios clics seguidos en el mismo sitio).
    // =====================================================================
    t.caso("_instalarRageTracker: engancha _detectarRageClick al clic global, EN FASE DE CAPTURA", () => {
      const c = cargar({ silencioso: true });
      const calls = [];
      c.env.doc.addEventListener = (evt, fn, capture) => calls.push([evt, fn, capture]);
      c.api._instalarRageTracker();
      t.igual(calls.length, 1);
      t.igual(calls[0][0], "click");
      t.cierto(calls[0][1] === c.api._detectarRageClick, "el manejador es _detectarRageClick, no una copia");
      t.igual(calls[0][2], true, "captura=true: debe ver el clic antes que el propio Everest");
    });

    t.caso("_instalarRageTracker: si no hay document.addEventListener, no revienta", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.addEventListener = undefined;
      t.noLanza(() => c.api._instalarRageTracker());
    });

    // =====================================================================
    // v12.10.12 — OBSERVABILIDAD: migas de pan, distinción error/bug (huella) y
    // RUM (latencia + éxito/fallo por endpoint) del API de Everest.
    // =====================================================================
    t.caso("reportarError: adjunta las migas (últimas acciones) SIN incluir el propio error como su última miga", () => {
      const c = cargar(cfgRed);
      c.api.uxTrack("panel.agendar.abrir");
      c.api.uxTrack("panel.labs.abrir");
      c.api.reportarError("js", "algo falló", "vigilante.user.js:99");
      const fila = cola(c).find((f) => f.evento === "error");
      t.igual(fila.migas, "panel.agendar.abrir>panel.labs.abrir");
    });

    t.caso("reportarError: las migas se limitan a las últimas 8 acciones (ring buffer)", () => {
      const c = cargar(cfgRed);
      for (let i = 0; i < 10; i++) c.api.uxTrack("accion" + i);
      c.api.reportarError("js", "algo falló", "vigilante.user.js:100");
      const fila = cola(c).find((f) => f.evento === "error");
      t.igual(fila.migas, "accion2>accion3>accion4>accion5>accion6>accion7>accion8>accion9", "solo las últimas 8; las 2 primeras ya se habían descartado del anillo");
    });

    t.caso("reportarError: 'error.distintos' solo sube con huellas NUEVAS (origen+dónde); mismo origen+dónde no cuenta dos veces", () => {
      const c = cargar(cfgRed);
      c.api.reportarError("js", "fallo A", "archivo.js:10");
      c.api.reportarError("js", "fallo A otra vez", "archivo.js:10"); // misma huella
      c.api.reportarError("js", "fallo B", "archivo.js:20"); // huella distinta
      c.api._uxVolcarBuffer();
      const w = ventana(c);
      t.igual(w.acciones["error.distintos"], 2, "dos huellas distintas, aunque hayan sido 3 errores en total");
      t.igual(w.acciones["error.js"], 3, "el contador de volumen (ya existente) sigue viendo los 3");
    });

    t.caso("reportarError: sin 'dónde' (rechazos de promesa sin pila), la huella cae al mensaje saneado", () => {
      const c = cargar(cfgRed);
      c.api.reportarError("promesa", "TypeError: x is not a function", "");
      c.api.reportarError("promesa", "TypeError: x is not a function", ""); // mismo mensaje -> misma huella
      c.api.reportarError("promesa", "Error de red distinto", "");
      t.igual(ventana(c).acciones["error.distintos"], 2);
    });

    t.caso("reportarError: el techo de red se gasta por HUELLA, no por error — 41 huellas distintas, 40 filas", () => {
      // v17.1.0 (#148) — El techo sigue existiendo (un fallo dentro del propio manejador no
      // puede convertirse en una tormenta de red), pero ya no raciona la verdad: solo
      // consume cupo una falla que nunca se había visto.
      const c = cargar(cfgRed);
      for (let i = 0; i < 41; i++) c.api.reportarError("js", "fallo " + i, "archivo.js:" + (200 + i));
      c.api._uxVolcarBuffer();
      const w = ventana(c);
      t.igual(w.acciones["error.distintos"], 41, "el contador ve las 41 huellas");
      t.igual(cola(c).filter((f) => f.evento === "error").length, 40, "y 40 viajaron con detalle (el techo del día)");
    });

    t.caso("reportarError: un bucle de 1.000 repeticiones deja UNA fila y marcas de volumen, no mil filas", () => {
      const c = cargar(cfgRed);
      for (let i = 0; i < 1000; i++) c.api.reportarError("js", "en bucle", "archivo.js:77");
      c.api._uxVolcarBuffer();
      const w = ventana(c);
      t.igual(cola(c).filter((f) => f.evento === "error").length, 1, "una sola fila");
      t.igual(w.acciones["error.js"], 1000, "el contador sí ve las mil");
      t.igual(w.acciones["error.repetido.10"], 1, "y quedan marcas de volumen a las 10...");
      t.igual(w.acciones["error.repetido.100"], 1, "...a las 100...");
      t.igual(w.acciones["error.repetido.1000"], 1, "...y a las 1.000, para poder decir «esto está en bucle»");
    });

    t.caso("_sanearDondeError: conserva archivo:línea:columna y sanea cualquier otra cosa", () => {
      const c = cargar(cfgRed);
      t.igual(c.api._sanearDondeError("vigilante_agenda.user.js:12668:31"), "vigilante_agenda.user.js:12668:31");
      t.igual(c.api._sanearDondeError("vigilante_agenda.user.js:9000"), "vigilante_agenda.user.js:9000");
      t.igual(c.api._sanearDondeError(""), "", "vacío no lanza");
      t.igual(c.api._sanearDondeError(null), "", "null tampoco");
      t.falso(/98765432/.test(c.api._sanearDondeError("paciente 98765432")),
        "lo que no calza con archivo:línea pasa por el saneador de siempre");
    });

    t.caso("_errRepeticion: deja marcas de volumen en 10, 100 y 1.000 — no una por repetición", () => {
      const c = cargar(cfgRed);
      c.api.uxTrack("panel.labs.abrir");           // que la ventana exista
      for (let i = 0; i < 9; i++) c.api._errRepeticion("js|archivo.js:5");
      c.api._uxVolcarBuffer();
      t.igual((ventana(c).acciones || {})["error.repetido.10"], undefined, "a las 9 todavía no");
      c.api._errRepeticion("js|archivo.js:5");
      c.api._uxVolcarBuffer();
      t.igual((ventana(c).acciones || {})["error.repetido.10"], 1, "a las 10 sí");
    });

    t.caso("_rumEndpointLabel: Annar y Citi NO pueden compartir etiqueta", () => {
      // v17.1.0 (#150) — compartían etiqueta y se piden siempre en pareja: Annar responde
      // 200 y Citi 404, así que el tablero mostraba un 50 % de fallo clavado que parecía
      // una caída intermitente del laboratorio y era aritmética.
      const c = cargar(cfgRed);
      const a = c.api._rumEndpointLabel("/apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioAnnar?pacienteId=1");
      const b = c.api._rumEndpointLabel("/apiviva/APIHCHealth/api/Historicos/ObtenerResultadosLaboratorioCiti?pacienteId=1");
      t.igual(a, "resultadosLabAnnar");
      t.igual(b, "resultadosLabCiti");
      t.cierto(a !== b, "dos laboratorios distintos, dos contadores distintos");
      t.igual(c.api._rumEndpointLabel("/api/Historicos/ObtenerResultadosLaboratorio?x=1"), "resultadosLab",
        "y el genérico sigue existiendo por si aparece un tercero");
    });

    t.caso("_rumEndpointLabel: reconoce los endpoints conocidos por nombre FIJO — nunca por el contenido real de la URL", () => {
      const c = cargar(cfgRed);
      t.igual(c.api._rumEndpointLabel("/apiviva/APIAcceso/api/Paciente/BuscarPacienteDetallado?idPaciente=123"), "pacienteDetallado");
      t.igual(c.api._rumEndpointLabel("/apiviva/APIAcceso/api/Paciente/BuscarPaciente?identificacion=99887766"), "buscarPaciente", "BuscarPacienteDetallado no debe caer en el genérico BuscarPaciente");
      t.igual(c.api._rumEndpointLabel("/apiviva/APIAcceso/api/Acceso/AsignarTurno"), "asignarTurno");
      t.igual(c.api._rumEndpointLabel("/apiviva/APIOrdenamientoHealth/api/ordenamiento/GuardarOrdenamiento"), "guardarOrdenamiento");
      t.igual(c.api._rumEndpointLabel("/apiviva/APIAcceso/api/ParametrizacionLista/GetUsuarioPerfil/juan.perez"), "perfilUsuario", "ni siquiera con un login real embebido en el CAMINO se filtra nada: la etiqueta es fija");
      t.igual(c.api._rumEndpointLabel("/ruta/que/no/existe/en/la/lista"), "otro", "URL desconocida -> 'otro', nunca se inventa una etiqueta nueva");
      t.igual(c.api._rumEndpointLabel(""), "otro");
    });

    await t.casoAsync("pageFetchJson/RUM: una llamada exitosa suma api.<endpoint>.ok con su latencia (ms) en .total", async () => {
      // Retraso REAL (reloj del host, no el setTimeout recortado del sandbox — ver
      // dormir()/esperar() en suite_12) para que la latencia medida sea > 0 de forma
      // determinista: uxTrack solo suma a ".total" cuando `n` es verdadero (> 0), así
      // que una respuesta instantánea (0 ms) no probaría nada sobre esa suma.
      const fetchConRetraso = () => new Promise((r) => setTimeout(() => r(respuestaOk({ ok: true })), 5));
      const c = cargar({ silencioso: true, fetch: fetchConRetraso });
      const res = await c.api.pageFetchJson("/apiviva/APIAcceso/api/Acceso/AsignarTurno", { method: "POST", body: "{}" });
      t.cierto(!!res, "la llamada real sigue devolviendo su dato de siempre — RUM es puramente observador");
      c.api._uxVolcarBuffer();
      const w = ventana(c);
      t.igual(w.acciones["api.asignarturno.ok"], 1);
      t.cierto(typeof w.acciones["api.asignarturno.ok.total"] === "number" && w.acciones["api.asignarturno.ok.total"] > 0, "la latencia queda sumada");
    });

    await t.casoAsync("pageFetchJson/RUM: una llamada que falla (4xx, sin reintento) suma api.<endpoint>.err", async () => {
      const c = cargar({ silencioso: true, fetch: async () => respuesta404() });
      const res = await c.api.pageFetchJson("/apiviva/APIAcceso/api/Paciente/BuscarPaciente?identificacion=1");
      t.igual(res, null, "4xx no se reintenta: la llamada real sigue devolviendo null como siempre");
      t.igual(ventana(c).acciones["api.buscarpaciente.err"], 1);
    });

    await t.casoAsync("pageFetchJson/RUM: con el interruptor de telemetría apagado no se registra nada", async () => {
      const c = cargar({ silencioso: true, fetch: async () => respuestaOk({ ok: true }) });
      c.api.__S.uxTelemetria = false;
      await c.api.pageFetchJson("/apiviva/APIAcceso/api/Acceso/AsignarTurno");
      t.igual(ventana(c), null, "ninguna ventana creada, ni por uxTrack ni por RUM");
    });

    // =====================================================================
    // v15.x — DESCARGA RESILIENTE AL CERRAR LA PESTAÑA.
    // El transporte por beacon entro sin ninguna prueba y con dos fallos reales
    // (documentados en tests/rojas/003): despachaba SOLO repQ[0] de hasta 30 filas,
    // y no retiraba de la cola la que si despachaba — asi que el proximo repFlush la
    // reenviaba y salia DUPLICADA en el tablero. Estas pruebas fijan las dos cosas.
    // Filas de ejemplo, sin nada de ningun paciente.
    // =====================================================================
    function _colaDemo(c) {
      c.api.__S.reporte = true;
      c.api.__S.reporteUrl = "https://script.google.com/macros/s/DEMO/exec";
      const filas = [
        { evento: "fraude", lote: "L1" },
        { evento: "ux", lote: "L2" },
        { evento: "ux", lote: "L3" },
        { evento: "resumen", lote: "L4" },
      ];
      c.env.gm["vgl_repq"] = JSON.stringify(filas);
      return filas;
    }
    // v17.49.0 (D4) — que lotes quedan en la cola, y de que evento. Las pruebas viejas
    // solo miraban la LONGITUD, asi que no podian distinguir "se retiraron las 4" de
    // "se retiraron 4 cualesquiera" — ni fijar la regla nueva.
    function _lotesEnCola(c, evento) {
      const q = JSON.parse(c.env.gm["vgl_repq"] || "[]");
      return q.filter((f) => !evento || f.evento === evento).map((f) => f.lote);
    }
    function _espiarBeacon(c, acepta) {
      const enviados = [];
      c.ctx.navigator = { sendBeacon: (u, b) => { if (!acepta) return false; enviados.push(b && b._t); return true; } };
      c.ctx.Blob = function (partes) { this._t = String(partes[0]); };
      c.ctx.fetch = undefined;          // sin respaldo por fetch: se mide solo el beacon
      c.env.doc.visibilityState = "hidden";
      // v17.6.14 — H1: el beacon solo despacha con ACUSE FRESCO (< 30 min). Las pruebas
      // viejas del despacho asumen un panel sano; este espiador sella ese acuse como
      // precondición (los casos que prueban la ausencia de acuse lo siembran aparte).
      c.env.win.localStorage.setItem("vgl_rep_last_ok", new Date().toISOString());
      return enviados;
    }

    // v17.49.0 (D4) — REESCRITAS. Estas dos pruebas nacieron de dos fallos REALES del
    // transporte por beacon: despachaba solo repQ[0], y no retiraba de la cola la que si
    // despachaba (asi que el proximo repFlush la reenviaba y salia duplicada). Las dos
    // propiedades siguen siendo ciertas y siguen fijadas aqui — pero ahora sobre las filas
    // que de verdad viajan por este camino: las reconstruibles. La evidencia dejo de
    // viajar por beacon, asi que exigirle "sale por beacon" era fijar el defecto que la
    // D4 vino a cerrar: darla por entregada sin que nadie confirmara nada.
    t.caso("_vaciarTelemetriaAlSalir: despacha TODAS las filas reconstruibles, no solo la primera", () => {
      const c = cargar({ silencioso: true });
      _colaDemo(c);                                  // fraude L1, ux L2, ux L3, resumen L4
      const enviados = _espiarBeacon(c, true);
      const n = c.api._vaciarTelemetriaAlSalir();
      t.igual(n, 2, "las DOS filas ux salen, no una sola (era el fallo original)");
      t.igual(enviados.length, 2, "y salieron de verdad por el transporte");
      t.falso(enviados.some((e) => e.includes("resumen")), "el resumen es evidencia: no se manda a ciegas");
      t.falso(enviados.some((e) => e.includes("fraude")), "ni la fila de fraude");
    });

    t.caso("_vaciarTelemetriaAlSalir: la fila reconstruible despachada se retira de la cola (si no, sale DUPLICADA en el tablero)", () => {
      const c = cargar({ silencioso: true });
      _colaDemo(c);
      _espiarBeacon(c, true);
      c.api._vaciarTelemetriaAlSalir();
      t.igual(_lotesEnCola(c, "ux"), [], "ninguna ux queda: nada que repFlush pueda reenviar duplicado");
    });

    t.caso("v17.49.0 (D4): la evidencia NO se despacha por beacon — se queda para el camino que confirma", () => {
      const c = cargar({ silencioso: true });
      _colaDemo(c);
      _espiarBeacon(c, true);
      c.api._vaciarTelemetriaAlSalir();
      t.igual(_lotesEnCola(c, "fraude"), ["L1"], "el fraude sigue en la cola, con su lote INTACTO");
      t.igual(_lotesEnCola(c, "resumen"), ["L4"], "y el resumen diario tambien");
      t.igual(_lotesEnCola(c), ["L1", "L4"], "y solo esas dos: las ux si salieron");
    });

    t.caso("v17.49.0 (D4): ocultar y volver veinte veces no duplica ni desborda la evidencia retenida", () => {
      const c = cargar({ silencioso: true });
      _colaDemo(c);
      const enviados = _espiarBeacon(c, true);
      for (let i = 0; i < 20; i++) c.api._vaciarTelemetriaAlSalir();
      t.igual(enviados.length, 2, "las ux salen UNA vez; el manejador cuelga de visibilitychange y corre en cada cambio de ventana");
      t.igual(_lotesEnCola(c), ["L1", "L4"], "la evidencia sigue ahi, una sola vez cada una, sin reencolarse ni multiplicarse");
    });

    t.caso("v17.49.0 (D4): una cola de PURA evidencia no despacha nada y queda intacta", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.reporte = true;
      c.api.__S.reporteUrl = "https://script.google.com/macros/s/DEMO/exec";
      c.env.gm["vgl_repq"] = JSON.stringify([{ evento: "error", lote: "E1" }, { evento: "fraude", lote: "E2" }]);
      const enviados = _espiarBeacon(c, true);
      t.igual(c.api._vaciarTelemetriaAlSalir(), 0, "no hay nada reconstruible que mandar");
      t.igual(enviados.length, 0, "y no se manda una sola fila a ciegas");
      t.igual(_lotesEnCola(c), ["E1", "E2"], "las dos siguen esperando acuse");
    });

    t.caso("_vaciarTelemetriaAlSalir: si el navegador rechaza los beacons, NO se pierde ninguna fila", () => {
      const c = cargar({ silencioso: true });
      const filas = _colaDemo(c);
      const enviados = _espiarBeacon(c, false);
      const n = c.api._vaciarTelemetriaAlSalir();
      t.igual(n, 0, "no se despacho ninguna");
      t.igual(enviados.length, 0);
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, filas.length, "las 4 siguen en la cola para el proximo intento");
    });

    t.caso("_vaciarTelemetriaAlSalir: con la pestaña a la vista no vacia nada (solo actua al ocultarse o cerrarse)", () => {
      const c = cargar({ silencioso: true });
      const filas = _colaDemo(c);
      _espiarBeacon(c, true);
      c.env.doc.visibilityState = "visible";
      t.igual(c.api._vaciarTelemetriaAlSalir(), 0, "no despacha nada mientras el medico sigue en la pestaña");
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, filas.length, "y la cola queda intacta");
    });

    t.caso("repBeacon: con el reporte apagado en Ajustes no manda absolutamente nada", () => {
      const c = cargar({ silencioso: true });
      _colaDemo(c);
      c.api.__S.reporte = false;
      const enviados = _espiarBeacon(c, true);
      t.falso(c.api.repBeacon({ evento: "ux", lote: "L9" }), "devuelve false");
      t.igual(enviados.length, 0, "el interruptor del medico manda tambien en la ruta del beacon");
    });

    // =====================================================================
    // v15.2.0 — LISTA BLANCA DE ETIQUETAS DE FRICCION (rage clicks).
    // La clave de ux.rage.* se armaba con el id o la clase del elemento pulsado, que puede
    // ser un elemento del DOM de EVEREST, no nuestro. uxClaveLimpia borra numeros de 6+
    // digitos (ahi mueren las cedulas) pero NO borra palabras: un id ajeno del estilo
    // "paciente_juan_perez" habria viajado entero al tablero. Era el unico punto de todo el
    // sistema donde una etiqueta del DOM ajeno llegaba a la hoja de Google.
    // =====================================================================
    t.caso("_rageEtiqueta: un elemento NUESTRO del catalogo sale con su nombre", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._rageEtiqueta({ id: "vgl-dock-btn" }), "dock-btn");
      t.igual(c.api._rageEtiqueta({ id: "vgl-ia-generar" }), "ia-generar");
      t.igual(c.api._rageEtiqueta({ className: "vgl-tip-btn algo-mas" }), "tip-btn", "tambien por la primera clase");
    });

    t.caso("_rageEtiqueta: un elemento de EVEREST nunca presta su nombre a la clave", () => {
      const c = cargar({ silencioso: true });
      // Datos de ejemplo con la forma de lo que NO puede salir del equipo.
      t.igual(c.api._rageEtiqueta({ id: "paciente_juan_perez" }), "host", "un nombre en un id ajeno no viaja");
      t.igual(c.api._rageEtiqueta({ id: "pac-1111111111" }), "host", "una cedula en un id ajeno tampoco");
      t.igual(c.api._rageEtiqueta({ id: "alert_message" }), "host", "ni un id ajeno perfectamente inocente: se agrupa igual");
      t.igual(c.api._rageEtiqueta({ className: "form-control ng-pristine" }), "host");
    });

    t.caso("_rageEtiqueta: un elemento nuestro fuera del catalogo se agrupa, no se inventa etiqueta", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._rageEtiqueta({ id: "vgl-boton-que-no-existe-aun" }), "otro", "nuestro pero desconocido");
      t.igual(c.api._rageEtiqueta({}), "generico", "sin id ni clase");
      t.igual(c.api._rageEtiqueta(null), "generico", "y con nada, no lanza");
    });

    // v18.0.63 — HALLAZGO DEL ENJAMBRE #27 (01-sep), CONFIRMADO en el export real del
    // tablero del 1-sep: `rum.self.inp.detalle.host.needs_imp` = 7 — interacciones de
    // NUESTRA interfaz (`rum.self.*`) atribuidas a Everest. En un <svg> (hay 45 íconos así,
    // varios dentro de botones .vgl-*) `className` es un SVGAnimatedString, no un string:
    // `String(...)` daba "[object SVGAnimatedString]", que nunca empieza por "vgl-", así
    // que un ícono NUESTRO caía en "host" y el rastro de la lentitud se perdía. Es justo el
    // error de atribución que el comentario de este bloque dice evitar.
    t.caso("v18.0.63: un icono SVG NUESTRO no se reporta como si fuera de Everest", () => {
      const c = cargar({ silencioso: true });
      // Así se ve un <svg class="vgl-ico"> de verdad: getAttribute devuelve el string real,
      // className NO es un string.
      const svgNuestro = {
        className: { baseVal: "vgl-ico", animVal: "vgl-ico" },
        getAttribute: (k) => (k === "class" ? "vgl-ico" : null),
      };
      t.igual(c.api._rageEtiqueta(svgNuestro), "otro", "es nuestro, aunque sea un SVG: nunca 'host'");

      // Y el SVG de Everest sigue siendo de Everest: el arreglo no puede reclamar lo ajeno.
      const svgAjeno = {
        className: { baseVal: "ng-star-inserted", animVal: "ng-star-inserted" },
        getAttribute: (k) => (k === "class" ? "ng-star-inserted" : null),
      };
      t.igual(c.api._rageEtiqueta(svgAjeno), "host", "un SVG de Everest se sigue agrupando como host");

      // Un SVG del catálogo conserva su nombre exacto, no cae en el cajón de "otro".
      const svgCatalogo = {
        className: { baseVal: "vgl-dock-btn", animVal: "vgl-dock-btn" },
        getAttribute: (k) => (k === "class" ? "vgl-dock-btn" : null),
      };
      t.igual(c.api._rageEtiqueta(svgCatalogo), "dock-btn");

      // Contención: el camino de siempre (className string, sin getAttribute) no se rompe.
      t.igual(c.api._rageEtiqueta({ className: "vgl-tip-btn algo-mas" }), "tip-btn");
      t.igual(c.api._rageEtiqueta({ className: "form-control ng-pristine" }), "host");
      t.igual(c.api._rageEtiqueta({}), "generico");
    });

    t.caso("_detectarRageClick: tres clics seguidos en el mismo sitio anotan la friccion UNA vez", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.uxTelemetria = true;
      const btn = { id: "vgl-dock-btn", closest: () => btn };
      const ev = { target: btn };
      c.api._detectarRageClick(ev);
      c.api._detectarRageClick(ev);
      t.falso(!!(ventana(c) && ventana(c).acciones["ux.rage.dock-btn"]), "con dos clics todavia no es friccion");
      c.api._detectarRageClick(ev);
      t.igual(ventana(c).acciones["ux.rage.dock-btn"], 1, "al tercero si");
      c.api._detectarRageClick(ev);
      t.igual(ventana(c).acciones["ux.rage.dock-btn"], 1, "y no se vuelve a contar por seguir insistiendo");
    });

    t.caso("_detectarRageClick: con la telemetria apagada no anota nada", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.uxTelemetria = false;
      const btn = { id: "vgl-dock-btn", closest: () => btn };
      for (let i = 0; i < 5; i++) c.api._detectarRageClick({ target: btn });
      t.falso(!!ventana(c), "el interruptor del medico manda tambien aqui");
    });

    // =====================================================================
    // v15.2.0 — EL EMBUDO DE LOS CINCO MODALES.
    // Antes solo el panel de IA tenia embudo; Labs, Ordenar, Agendar y Riesgo se abrian a
    // ciegas y no habia forma de saber donde se caia la gente. Esta prueba lee el fuente y
    // exige que todo embudo este COMPLETO: si alguien anota la apertura de un modal nuevo y
    // se olvida del abandono o del cierre con exito, los porcentajes del tablero saldrian
    // mal (un embudo sin abandono parece que nadie se cae nunca).
    // =====================================================================
    t.caso("embudo: todo modal con fn.X.open tiene tambien su fn.X.complete y su fn.X.abandon", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const familias = new Set();
      const re = /uxTrack\("fn\.([a-z0-9_]+)\.(open|complete|abandon)"/g;
      let m;
      const vistos = {};
      while ((m = re.exec(src))) {
        familias.add(m[1]);
        (vistos[m[1]] = vistos[m[1]] || new Set()).add(m[2]);
      }
      t.cierto(familias.size >= 5, "hay embudo en los cinco modales (IA, Labs, Ordenar, Agendar, Riesgo); salieron " + familias.size);
      const incompletos = [];
      for (const fam of familias) {
        for (const paso of ["open", "complete", "abandon"]) {
          if (!vistos[fam].has(paso)) incompletos.push("fn." + fam + " sin " + paso);
        }
      }
      t.igual(incompletos, [], "embudos a medias: " + incompletos.join(" | "));
    });

    t.caso("uxTrack: la llamada de insercion de IA ya NO arrastra texto clinico", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      // uxTrack solo lee extra.n como numero, asi que pasar texto era inofensivo HOY; el
      // riesgo era que alguien hiciera que uxTrack registrara `extra`. Se prohibe de raiz.
      t.falso(/uxTrack\("ia\.insertar",/.test(src), "ia.insertar no puede llevar segundo argumento");
      const conTexto = src.match(/uxTrack\(\s*"[^"]*"\s*,\s*\{[^}]*\b(ea|texto|nota|desc|nombre|resultado)\s*:/g) || [];
      t.igual(conTexto, [], "ninguna llamada a uxTrack puede pasar campos de texto: " + conTexto.join(" | "));
    });

    // El embudo, ejercido de punta a punta contra el modal de verdad. El arnés no convierte
    // el innerHTML en nodos consultables, asi que se enriquece createElement igual que hace
    // suite_15 — si no, el boton de cerrar no existe y no se puede probar el abandono.
    function _enriquecerDom(c) {
      const doc = c.env.doc;
      const base = doc.createElement;
      doc.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
    }

    await t.casoAsync("embudo de Laboratorios: abrir y cerrar ANTES de que lleguen los datos cuenta como abandono", async () => {
      const c = cargar({ silencioso: true, fetch: () => new Promise(() => {}) });   // la red nunca responde
      _enriquecerDom(c);
      c.api.__S.uxTelemetria = true;
      c.api.openLaboratoriosModal({ doc_id: "12345678" });
      await esperar(30);
      t.igual(ventana(c).acciones["fn.labs.open"], 1, "se anota la apertura");
      t.falso(!!ventana(c).acciones["fn.labs.complete"], "todavia no hay cierre con exito: los datos no llegaron");

      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-labs-modal").pop();
      modal.querySelector("#vgl-labs-x")._listeners.click[0]({});

      t.igual(ventana(c).acciones["fn.labs.abandon"], 1, "cerrar sin datos es un abandono");
      t.falso(!!ventana(c).acciones["fn.labs.complete"], "y sigue sin contarse como completado");
      // v17.6.20 — REVISIÓN: copia-pega residual en closeMod disparaba TAMBIÉN
      // "fn.agendar.abandon" al cerrar el modal de Laboratorios — contaminaba el embudo
      // de Agendamiento (mtrTableroTelemetria) con abandonos que nunca fueron un
      // agendamiento abierto. Este modal solo debe anotar SU PROPIO embudo.
      t.falso(!!ventana(c).acciones["fn.agendar.abandon"], "cerrar Laboratorios NO contamina el embudo de Agendamiento");
    });

    await t.casoAsync("embudo de Laboratorios: si la consulta termina, se cierra con exito y cerrarlo despues NO cuenta como abandono", async () => {
      const respVacia = { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "{}", clone() { return this; } };
      const c = cargar({ silencioso: true, fetch: async () => respVacia });
      _enriquecerDom(c);
      c.api.__S.uxTelemetria = true;
      await c.api.openLaboratoriosModal({ doc_id: "12345678" });
      for (let i = 0; i < 40; i++) await esperar(5);

      const acc = ventana(c).acciones;
      t.igual(acc["fn.labs.open"], 1);
      t.igual(acc["fn.labs.complete"], 1, "la consulta termino: el modal cumplio su proposito");
      t.igual(acc["fn.labs.vacio"], 1, "y se anota el desenlace: no habia resultados");

      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-labs-modal").pop();
      modal.querySelector("#vgl-labs-x")._listeners.click[0]({});
      t.falso(!!ventana(c).acciones["fn.labs.abandon"], "cerrar despues de que cumplio NO es abandonar");
    });

    // v17.6.20 — REVISIÓN: el embudo de Agendamiento (fn.agendar.open/complete) nunca
    // había registrado SU PROPIO abandono — el aviso vivía, por copia-pega, dentro del
    // closeMod de openLaboratoriosModal (ver caso anterior). Se restauró en el closeMod
    // real de openAgendamientoModal; esta prueba protege que el embudo quede completo.
    t.caso("embudo de Agendamiento: cerrar sin crear cita cuenta como abandono de SU PROPIO embudo", () => {
      const c = cargar({ silencioso: true });
      _enriquecerDom(c);
      c.api.__S.uxTelemetria = true;
      c.api.openAgendamientoModal({ doc_id: "12345678", nombre: "ANA PEREZ" });
      t.igual(ventana(c).acciones["fn.agendar.open"], 1, "se anota la apertura");

      const modal = c.env.doc.body.children.filter((n) => n.id === "vgl-agendar-modal").pop();
      modal.querySelector("#vgl-agm-x")._listeners.click[0]({});

      t.igual(ventana(c).acciones["fn.agendar.abandon"], 1, "cerrar sin crear cita es un abandono, registrado en SU PROPIO embudo");
      t.falso(!!ventana(c).acciones["fn.agendar.complete"], "y sigue sin contarse como completado");
    });

    // v17.6.3 — D1 (decisión del médico, 22-ago): tablero local de telemetría y la
    // métrica de ABANDONO DEL EMBUDO DE AGENDAMIENTO (abiertos vs creadas).
    t.caso("mtrTableroTelemetria: embudo de agendamiento — abiertos sin creadas = abandono", () => {
      const c = cargar({ silencioso: true });
      const tab = c.api.mtrTableroTelemetria({ acciones: {
        "fn.agendar.open": 10,
        "cita.creada.consulta": 5,
        "cita.creada.laboratorio": 2,
        "cita.rechazada": 1,
        "cita.cupo_perdido": 1,
        "fn.ia.gen": 4,
        "fn.ia.gen.total": 4,   // la clave .total no es una acción: se ignora
      } });
      t.igual(tab.embudo.abiertos, 10, "10 agendamientos abiertos");
      t.igual(tab.embudo.creadas, 7, "7 citas creadas (suma de cita.creada.*)");
      t.igual(tab.embudo.abandono, 30, "abandono = (10-7)/10 = 30 %");
      t.igual(tab.embudo.rechazadas, 1, "y se cuentan las rechazadas");
      t.igual(tab.embudo.cupoPerdido, 1, "y los cupos perdidos");
      t.igual(tab.embudo.iaGen, 4, "y las generaciones de IA");
      t.igual(tab.total, 23, "el total NO incluye la clave .total (10+5+2+1+1+4 = 23)");
      t.cierto(tab.filas.every((f) => f.clave !== "fn.ia.gen.total"), "ninguna clave .total en las filas");
      t.cierto(tab.filas[0].clave === "fn.agendar.open", "las filas van de mayor a menor");
    });

    t.caso("mtrTableroTelemetria: sin abiertos no hay abandono (no se inventa), y sin ventana no lanza", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrTableroTelemetria({ acciones: { "fn.ia.gen": 2 } }).embudo.abandono, null, "sin agendar abierto, abandono vacío (no inventa 0)");
      const v = c.api.mtrTableroTelemetria(null);
      t.igual(v.total, 0, "ventana nula: total 0");
      t.igual(v.embudo.abandono, null, "y sin abandono");
    });

    t.caso("mtrTableroTelemetriaHtml: pinta el embudo y las acciones; sin datos dice que no hay", () => {
      const c = cargar({ silencioso: true });
      const html = c.api.mtrTableroTelemetriaHtml(c.api.mtrTableroTelemetria({ acciones: { "fn.agendar.open": 10, "cita.creada.consulta": 7 } }));
      t.cierto(/TELEMETRÍA LOCAL/.test(html), "el bloque se rotula");
      t.cierto(/abandono 30 %/.test(html), "el abandono se lee de un vistazo");
      t.cierto(/10 abiertos · 7 creadas/.test(html), "y el detalle abiertos·creadas");
      const vacio = c.api.mtrTableroTelemetriaHtml(c.api.mtrTableroTelemetria(null));
      t.cierto(/Sin eventos/.test(vacio), "sin datos se dice, no se pinta un tablero vacío");
      t.igual(c.api.mtrTableroTelemetriaHtml(null), "", "null no pinta nada");
    });

    // =====================================================================
    // v17.6.14 — AUDITORÍA S+ DE LA TELEMETRÍA (hallazgos H1/H2/H3/H5)
    //  H1. El beacon de salida no daba acuse (respuesta opaca): se retiraba evidencia
    //      en silencio contra un panel caído, un login de Google o un token rotado.
    //      Ahora solo despacha con acuse fresco (< 30 min); si no, las filas esperan
    //      al próximo repFlush, que sí lee el acuse.
    //  H2. _errVistos/_errVeces crecían sin techo: el tope de 40 limitaba el ENVÍO,
    //      no la memoria. Ahora el umbral poda los dos.
    //  H3. El mapeo URL→etiqueta del RUM no estaba fijado por ninguna prueba (el bug
    //      Annar/Citi entró sin que el banco lo viera). Queda fijado, con el orden.
    //  H5. Sin backoff, cada evento reintentaba contra un panel caído (hasta 20 s por
    //      intento). Ahora un fallo reciente (< 3 min) deja la fila para el timer.
    // =====================================================================

    t.caso("v17.6.14: _vaciarTelemetriaAlSalir SIN acuse fresco NO retira evidencia (espera a repFlush con acuse)", () => {
      const c = cargar({ silencioso: true });
      const filas = _colaDemo(c);
      _espiarBeacon(c, true);
      c.env.win.localStorage.setItem("vgl_rep_last_ok", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
      t.igual(c.api._vaciarTelemetriaAlSalir(), 0, "sello de 2 h: el beacon no es de fiar, no se despacha nada");
      t.igual(JSON.parse(c.env.gm["vgl_repq"]).length, filas.length, "las 4 filas quedan para el próximo arranque/repFlush (que sí lee el acuse)");
    });

    t.caso("v17.6.14: _vaciarTelemetriaAlSalir CON acuse fresco sí despacha (refuerzo al cerrar con el panel sano)", () => {
      const c = cargar({ silencioso: true });
      const filas = _colaDemo(c);
      const enviados = _espiarBeacon(c, true);
      c.env.win.localStorage.setItem("vgl_rep_last_ok", new Date().toISOString());
      const n = c.api._vaciarTelemetriaAlSalir();
      t.igual(n, 2, "el panel confirmó envíos hace < 30 min: el beacon refuerza el cierre con lo reconstruible");
      t.igual(_lotesEnCola(c, "ux"), [], "y esas filas salen de la cola, sin duplicados en el tablero");
      t.igual(_lotesEnCola(c).length, 2, "la evidencia se queda: el sello fresco autoriza el beacon, no sustituye al acuse");
    });

    t.caso("v17.6.14: reportarError no deja crecer la memoria de huellas por encima del techo (40)", () => {
      const c = cargar(cfgRed);
      c.api.__S.reporte = true;
      c.api.__S.reporteUrl = "https://script.google.com/macros/s/DEMO/exec";
      c.env.gm["vgl_repq"] = "[]";
      for (let i = 0; i < 50; i++) {
        c.api.reportarError("js", "fallo numero " + i + " con mensaje variable para crear huellas distintas", "funcion" + i + ".js:10");
      }
      const errores = cola(c).filter((f) => f.evento === "error");
      t.igual(errores.length, 40, "solo las 40 primeras huellas viajan con detalle (el techo de red es también el techo de memoria)");
      t.igual(cola(c).length, 40, "las 10 restantes solo suman en el contador agregado: no llenan la cola ni la memoria");
    });

    t.caso("v17.6.14: _rumEndpointLabel fija el mapeo URL→etiqueta (el orden Annar/Citi es la semántica)", () => {
      const c = cargar({ silencioso: true });
      const casos = [
        ["/api/Paciente/BuscarPacienteDetallado?id=1", "pacienteDetallado"],
        ["/api/Paciente/BuscarPaciente?q=2", "buscarPaciente"],
        ["/api/AgdValidarAgenda", "validarAgenda"],
        ["/api/AsignarTurno", "asignarTurno"],
        ["/api/BuscarCitasDisponibles", "citasDisponibles"],
        ["/api/ObtenerTurnos", "turnos"],
        ["/api/GetUsuarioPerfil/abc", "perfilUsuario"],
        ["/api/EnviarSMS", "enviarSms"],
        ["/api/EnviarEmailOrdenamiento", "enviarEmailOrden"],
        ["/api/ObtenerResultadosLaboratorioAnnar?f=1", "resultadosLabAnnar"],
        ["/api/ObtenerResultadosLaboratorioCiti?f=1", "resultadosLabCiti"],
        ["/api/ObtenerResultadosLaboratorio?f=1", "resultadosLab"],
        ["/api/GenerarLinksImpresionOrdenamientos", "linksImpresionOrden"],
        ["/api/ImprimirRecordatorioCita", "imprimirRecordatorio"],
        ["/api/ObtenerConsultas?profesionalId=9", "consultas"],
        ["/api/ObtenerEstadoCita", "estadoCita"],
        ["/api/guardarHoraApertura", "horaApertura"],
        ["/api/ObtenerListadoCupsPorPaciente", "listadoCups"],
        ["/api/ObtenerListadoDiagnostico", "listadoDiagnostico"],
        ["/api/GuardarOrdenamiento", "guardarOrdenamiento"],
        ["/api/FinalizarTicket", "finalizarTicket"],
        ["/api/AlgoQueNoExiste", "otro"],
      ];
      for (const [url, etq] of casos) t.igual(c.api._rumEndpointLabel(url), etq, url + " -> " + etq);
      t.igual(c.api._rumEndpointLabel("/api/ObtenerResultadosLaboratorioAnnar"), "resultadosLabAnnar", "Annar NO cae en la etiqueta genérica (el orden es la semántica)");
      t.igual(c.api._rumEndpointLabel("/api/ObtenerResultadosLaboratorioCiti"), "resultadosLabCiti", "Citi tampoco");
      const conCedula = c.api._rumEndpointLabel("/api/ObtenerConsultas?profesionalId=1234567890&doc=98765432");
      t.falso(/\d/.test(conCedula), "la etiqueta es fija: ni el profesionalId ni la cédula salen de la URL");
    });

    await t.casoAsync("v17.6.14: _rumTrack cuenta ok/err con la etiqueta fija, sin filtrar el id de la URL", async () => {
      const c = cargar({ silencioso: true });
      const okP = Promise.resolve({ data: 1 });
      c.api._rumTrack("/api/ObtenerConsultas?profesionalId=9876543210", 12, okP);
      const errP = Promise.reject(new Error("x"));
      errP.catch(() => {});   // sin handler, Node avisaría de una promesa no atendida
      c.api._rumTrack("/api/ObtenerResultadosLaboratorioCiti?f=1", 3, errP);
      await esperar(30);
      const v = ventana(c);
      const acciones = (v && v.acciones) || {};
      t.cierto(!!acciones["api.consultas.ok"], "la promesa resuelta cuenta api.consultas.ok");
      t.cierto(!!acciones["api.resultadoslabciti.err"], "la promesa rechazada cuenta api.resultadosLabCiti.err (uxClaveLimpia minúsculiza)");
    });

    t.caso("v17.6.14: reportar con el panel caído hace backoff (fallo reciente = la fila espera, sin intento)", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.reporte = true;
      c.api.__S.reporteUrl = "https://script.google.com/macros/s/DEMO/exec";
      let intentos = 0;
      c.env.win.GM_xmlhttpRequest = (o) => { intentos++; if (o.onerror) o.onerror(new Error("red")); };
      c.env.win.localStorage.setItem("vgl_rep_last_err", JSON.stringify({ ts: new Date().toISOString(), detalle: "el panel no respondió" }));
      c.api.reportar("ux", { clave: "fn.prueba" });
      t.igual(intentos, 0, "fallo hace < 3 min: NO se dispara el intento inútil al encolar");
      t.igual(cola(c).length, 1, "la fila queda esperando en la cola para el timer de 10 min");
    });

    t.caso("v17.6.14: con el fallo viejo (o sin sello), reportar sí reintenta de inmediato", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.reporte = true;
      c.api.__S.reporteUrl = "https://script.google.com/macros/s/DEMO/exec";
      let intentos = 0;
      c.env.win.GM_xmlhttpRequest = (o) => { intentos++; if (o.onerror) o.onerror(new Error("red")); };
      c.env.win.localStorage.setItem("vgl_rep_last_err", JSON.stringify({ ts: new Date(Date.now() - 10 * 60 * 1000).toISOString(), detalle: "viejo" }));
      c.api.reportar("ux", { clave: "fn.prueba" });
      t.igual(intentos, 1, "con el fallo hace > 3 min se reintenta (la cola no se queda dormida)");
    });
    t.caso("v17.16.0 — _repSello, probada de frente: el sello de la telemetría", () => {
      // Estaba en `cubre` sin que ninguna prueba la nombrara. Es lo que el médico lee en
      // Ajustes («Último envío confirmado» / «último fallo»), y fue la pieza que durante
      // nueve días de agosto mostró verde con la hoja vacía: por eso importa que un fallo
      // deje SIEMPRE una causa legible y no solo un estado.
      const c = cargar({ silencioso: true });
      const ls = c.env.win.localStorage;

      c.api._repSello(true);
      t.cierto(!!ls.getItem("vgl_rep_last_ok"), "un envío bueno deja fecha");

      c.api._repSello(false, "el panel rechazó el token");
      const err = JSON.parse(ls.getItem("vgl_rep_last_err") || "null");
      t.cierto(!!err, "un fallo deja su propio registro");
      t.cierto(/token/.test(err.detalle), "con la CAUSA, no solo con el hecho de que falló");
      t.cierto(!!err.ts, "y con la hora, para saber si es de hoy");

      // El detalle se acota: un cuerpo de respuesta entero no puede llenar el almacén.
      c.api._repSello(false, "x".repeat(500));
      const largo = JSON.parse(ls.getItem("vgl_rep_last_err") || "null");
      t.igual(largo.detalle.length, 120, "el detalle se corta a 120: un HTML entero no cabe en un sello");

      // Un éxito NO borra el último fallo: los dos sellos conviven a propósito, para que
      // «funciona ahora» no tape «esta mañana estuvo caído».
      c.api._repSello(true);
      t.cierto(!!ls.getItem("vgl_rep_last_err"),
        "el último fallo sobrevive a un éxito posterior: es historia, no estado");
    });

  }
};
