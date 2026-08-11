// Suite 23 — v12.5.0: telemetría de uso del panel (mejora continua).
// Regla sagrada bajo prueba: en la ventana de conteos y en la fila "ux" que viaja al
// tablero JAMÁS puede haber datos de paciente — solo nombres fijos de acción y números.
module.exports = {
  nombre: "Telemetría de uso del panel (v12.5)",
  cubre: ["uxTrack", "uxEnviarVentana", "uxFlush", "uxBootCheck", "uxVentanaNueva"],
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

    t.caso("uxTrack: al cambiar el día, la ventana pendiente sale hacia la cola y arranca una limpia", () => {
      const c = cargar(cfgRed);
      c.env.storage.setItem("vgl_ux", JSON.stringify({ dia: "2020-01-01", desde: "2020-01-01T07:00:00Z", acciones: { "panel.labs.abrir": 5 } }));
      c.api.uxTrack("panel.agendar.abrir");
      const q = cola(c);
      t.igual(q.length, 1);
      t.igual(q[0].deDia, "2020-01-01", "lo de ayer viaja con SU fecha");
      const w = ventana(c);
      t.igual(w.acciones["panel.agendar.abrir"], 1);
      t.falso("panel.labs.abrir" in w.acciones, "la ventana nueva no arrastra lo enviado");
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
