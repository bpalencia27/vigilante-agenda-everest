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
  cubre: ["uxTrack", "uxEnviarVentana", "uxFlush", "uxBootCheck", "uxVentanaNueva", "uxClaveLimpia", "reportar", "repQSave",
    "_equipoId", "_loteId", "_sanearMensajeError", "reportarError", "repEntornoDiario", "_instalarCazaErrores",
    "_rumEndpointLabel", "_rumTrack", "_migaPush"],
  async pruebas(t, api, env, cargar) {

    // gmxhr que siempre falla: reportar() encola pero repFlush no puede entregar, así
    // la fila queda VISIBLE en la cola persistente (vgl_repq) para asertarla.
    const cfgRed = { silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red simulada"); } };
    const cola = (c) => { try { return JSON.parse(c.env.gm["vgl_repq"] || "[]"); } catch (e) { return []; } };
    const ventana = (c) => { try { return JSON.parse(c.env.storage.getItem("vgl_ux") || "null"); } catch (e) { return null; } };

    t.caso("uxTrack: acumula conteos por acción y suma .total con extra.n", () => {
      const c = cargar(cfgRed);
      c.api.uxTrack("panel.agendar.abrir");
      c.api.uxTrack("panel.agendar.abrir");
      c.api.uxTrack("ordenes.creadas", { n: 3 });
      const w = ventana(c);
      t.igual(w.acciones["panel.agendar.abrir"], 2);
      t.igual(w.acciones["ordenes.creadas"], 1);
      t.igual(w.acciones["ordenes.creadas.total"], 3);
      t.cierto(!!w.dia && !!w.desde, "la ventana lleva día y hora de inicio");
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

    t.caso("reportarError: cuenta TODOS y manda como máximo 5 filas por día", () => {
      const c = cargar(cfgRed);
      for (let i = 0; i < 9; i++) c.api.reportarError("js", "algo falló " + i, "vigilante.user.js:1");
      const filas = cola(c).filter((f) => f.evento === "error");
      t.igual(filas.length, 5, "tope diario: el tablero no se inunda con el mismo fallo repetido");
      t.igual(filas[0].origen, "js");
      const w = JSON.parse(c.env.win.localStorage.getItem("vgl_ux"));
      t.igual(w.acciones["error.js"], 9, "pero el CONTADOR sí ve los nueve");
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

    t.caso("repQSave v12.5.1: al desbordarse la cola, las filas 'ux' se sacrifican antes que fraude/resumen", () => {
      const c = cargar(cfgRed);
      const filas = [];
      for (let i = 0; i < 28; i++) filas.push({ evento: "ux", i });
      filas.push({ evento: "fraude", hora: "08:00" });
      filas.push({ evento: "resumen", deDia: "2026-08-10" });
      c.env.gm["vgl_repq"] = JSON.stringify(filas);
      // Tres filas nuevas de fraude desbordan el tope de 30:
      c.api.reportar("fraude", { hora: "09:00" });
      c.api.reportar("fraude", { hora: "09:10" });
      c.api.reportar("fraude", { hora: "09:20" });
      const q = cola(c);
      t.cierto(q.length <= 30);
      t.igual(q.filter((r) => r.evento === "fraude").length, 4, "ningún fraude se perdió");
      t.igual(q.filter((r) => r.evento === "resumen").length, 1, "el resumen tampoco");
      t.cierto(q.filter((r) => r.evento === "ux").length < 28, "los recortados fueron ux");
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

    t.caso("reportarError: 'error.distintos' sigue contando aunque ya se agotó el tope de 5 detalles/día", () => {
      const c = cargar(cfgRed);
      for (let i = 0; i < 9; i++) c.api.reportarError("js", "fallo " + i, "archivo.js:" + i); // 9 huellas distintas
      const w = ventana(c);
      t.igual(w.acciones["error.distintos"], 9, "las 9 huellas se contaron aunque solo 5 viajaron con detalle");
      t.igual(cola(c).filter((f) => f.evento === "error").length, 5);
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
  }
};
