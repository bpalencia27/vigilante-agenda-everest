// Suite 23 — v12.5.0: telemetría de uso del panel (mejora continua).
// Regla sagrada bajo prueba: en la ventana de conteos y en la fila "ux" que viaja al
// tablero JAMÁS puede haber datos de paciente — solo nombres fijos de acción y números.
module.exports = {
  nombre: "Telemetría de uso del panel (v12.5)",
  cubre: ["uxTrack", "uxEnviarVentana", "uxFlush", "uxBootCheck", "uxVentanaNueva", "uxClaveLimpia", "reportar", "repQSave"],
  pruebas(t, api, env, cargar) {

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
      t.igual(claves, ["acciones", "deDia", "desde", "dia", "equipo", "evento", "n", "token", "ts", "ver"]);
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
  }
};
