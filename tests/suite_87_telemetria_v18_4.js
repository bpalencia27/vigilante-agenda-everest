// Suite 87 — v18.4.0: telemetría de nivel "que el silencio se vea SOLO".
// Tres comportamientos nuevos, cada uno nacido de un incidente real del export
// del tablero (docs/TELEMETRIA_20260901.md):
//   1. CARRIL PRIORITARIO — la evidencia («error»/«fraude») sale primero en el
//      ciclo de repFlush y no espera al backoff de 3 min (el 27-ago la demora
//      era el temporizador completo de 10 min), pero se calla un minuto tras
//      un fallo propio para no martillear un panel caído.
//   2. MUESTREO POR PRIORIDAD — al desbordar el presupuesto de 3.800 caracteres
//      de la fila "ux", se sacrifica rum.*/api.* antes que error.*/rep.* (un día
//      de 18.414 llamadas de API desplazaba del envío los conteos de fallo).
//   3. BEACON DE ÚLTIMO RECURSO — al descartar una fila tras 3 rechazos se
//      intenta una entrega ciega única (sin reintento, la objeción de la D4 ya
//      no aplica) y el descarte sigue contado por uxTrack.
// Las alertas del lado servidor (canal-mudo/tormenta/z-score/api-degradada) se
// prueban en TABLERO/simulacion_local.js contra el Codigo.gs real.
// (Número de suite: la 86 está tomada por la cadena de auditoría de arranque.)
module.exports = {
  nombre: "Telemetría v18.4: carril prioritario, muestreo y descartes",
  cubre: ["reportar", "repFlush", "repPost", "reportarError", "reportarFraude",
    "uxEnviarVentana", "uxTrack", "_uxVolcarBuffer", "repBeacon"],
  async pruebas(t, api, env, cargar) {
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const cola = (c) => { try { return JSON.parse(c.env.gm["vgl_repq"] || "[]"); } catch (e) { return []; } };
    const ventana = (c) => { try { c.api._uxVolcarBuffer(); return JSON.parse(c.env.storage.getItem("vgl_ux") || "null"); } catch (e) { return null; } };
    const filaBase = (evento, lote) => ({ token: "vgl-2026", equipo: "eq-t87", ver: "18.4.0", evento, ts: "2026-09-06T10:00:00Z", dia: "2026-09-06", lote });

    // gmxhr que siempre falla: reportar() encola y la fila queda visible en vgl_repq.
    const cfgRed = { silencioso: true, gmxhr: (o) => { if (o.onerror) o.onerror("sin red simulada"); } };

    // =====================================================================
    // 1. CARRIL PRIORITARIO — orden dentro del ciclo de repFlush.
    // =====================================================================
    await t.casoAsync("v18.4: en el ciclo de repFlush la evidencia sale ANTES que el uso que la precede en la cola", async () => {
      const enviados = [];
      const c = cargar({ silencioso: true, gmxhr: (o) => { enviados.push(String(o.data || "")); if (o.onload) o.onload({ status: 200, responseText: "ok", finalUrl: "" }); } });
      c.api.__S.reporte = true;
      // Cola sembrada a mano con el orden que expone el defecto: uso delante, evidencia detrás.
      c.env.gm["vgl_repq"] = JSON.stringify([
        filaBase("entorno", "B1"), filaBase("ux", "B2"), filaBase("error", "B3"), filaBase("fraude", "B4"),
      ]);
      const r = await c.api.repFlush();
      t.igual(r.enviadas, 4, "las cuatro filas salieron");
      t.falso(r.fallo, "sin fallos contra el panel sano");
      const orden = enviados.map((s) => JSON.parse(s).evento);
      t.igual(orden[0], "error", "el error sale primero aunque era el tercero en la cola");
      t.igual(orden[1], "fraude", "después el fraude");
      t.cierto(orden.indexOf("entorno") > 1 && orden.indexOf("ux") > 1, "el uso sale detrás de la evidencia, no delante");
    });

    // =====================================================================
    // 2. CARRIL PRIORITARIO — la evidencia salta el backoff; el uso no.
    // =====================================================================
    await t.casoAsync("v18.4: con backoff activo (fallo fresco) la evidencia sale igual y el uso espera", async () => {
      let llamadas = 0;
      const c = cargar({ silencioso: true, gmxhr: (o) => { llamadas++; if (o.onerror) o.onerror("sin red"); } });
      c.api.__S.reporte = true;
      c.env.win.localStorage.setItem("vgl_rep_last_err", JSON.stringify({ ts: new Date().toISOString(), detalle: "sin red" }));
      const antes = llamadas;
      c.api.reportar("entorno", {});
      await esperar(5);
      t.igual(llamadas, antes, "el uso respeta el backoff de 3 min (nada salió a la red)");
      c.api.reportar("error", { origen: "js", msg: "x", donde: "f.js:1" });
      await esperar(10);
      t.cierto(llamadas > antes, "la evidencia intenta salir aunque el backoff esté fresco");
    });

    // =====================================================================
    // 3. CARRIL PRIORITARIO — autolimitación tras fallo propio.
    // El 27-ago hubo días con 81 errores: si cada uno dispara su repPost
    // contra un panel caído (20 s de timeout por intento), el carril se
    // convierte en la tormenta que el backoff de v17.6.14 cerró.
    // =====================================================================
    await t.casoAsync("v18.4: tras un fallo del carril, la ráfaga siguiente NO martillea el panel (se calla 1 min)", async () => {
      let llamadas = 0;
      const c = cargar({ silencioso: true, gmxhr: (o) => { llamadas++; if (o.onerror) o.onerror("sin red"); } });
      c.api.__S.reporte = true;
      c.api.reportar("error", { origen: "js", msg: "a", donde: "f.js:1" });
      await esperar(15);
      const trasPrimera = llamadas;
      t.cierto(trasPrimera >= 1, "el primer error del carril intenta salir en el acto");
      c.api.reportar("fraude", { hora: "08:00 AM", min: 3 });
      c.api.reportar("error", { origen: "js", msg: "b", donde: "f.js:2" });
      await esperar(15);
      t.igual(llamadas, trasPrimera, "los intentos siguientes del carril esperan al temporizador, no martillan");
      const q = cola(c);
      t.cierto(q.some((f) => f && f.evento === "fraude") && q.some((f) => f && f.evento === "error"),
        "y la evidencia retenida sigue EN COLA (no se pierde: la barre el timer)");
    });

    // =====================================================================
    // 4. MUESTREO POR PRIORIDAD al desbordar el presupuesto de la fila "ux".
    // =====================================================================
    t.caso("v18.4: si la ventana no cabe, se sacrifican rum.*/api.* antes que error.*/rep.*", () => {
      const c = cargar(cfgRed);
      c.api.__S.reporte = true;
      // 90 claves de api.* que siguen LARGAS tras el saneo (solo letras, nada que
      // uxClaveLimpia pueda colapsar): ~5 KB, más que el presupuesto de 3.800. Van
      // PRIMERO en el objeto: con el orden de inserción viejo (sin prioridad) la
      // evidencia que va al final se quedaba fuera del envío — el defecto real.
      const acciones = {};
      for (let i = 0; i < 90; i++) acciones["api.endpoint" + "conunnombrelarguisimoqueconsumepresupuesto" + i] = 999;
      acciones["error.entregado"] = 2; acciones["rep.fila.descartada.error"] = 1; acciones["fn.agendar.open"] = 5;
      const ok = c.api.uxEnviarVentana({ dia: "2026-09-06", desde: "x", acciones });
      t.cierto(ok, "la fila se encola");
      const fila = cola(c).filter((f) => f.evento === "ux")[0];
      t.cierto(!!fila, "fila ux en la cola");
      const limpio = JSON.parse(fila.acciones);
      t.igual(limpio["error.entregado"], 2, "la evidencia de fallo viaja entera");
      t.igual(limpio["rep.fila.descartada.error"], 1, "la contabilidad de la cola también");
      t.igual(limpio["fn.agendar.open"], 5, "y el uso funcional");
      const apiPresentes = Object.keys(limpio).filter((k) => k.indexOf("api.") === 0).length;
      t.cierto(apiPresentes < 90, "el volumen de api. se recorta, no desplaza a la evidencia (quedaron " + apiPresentes + " de 90)");
      t.cierto((limpio["_recortadas"] || 0) >= 1, "y lo omitido se cuenta, no se pierde en silencio");
    });

    t.caso("v18.4: ventana chica — nada se omite (regresión del caso normal)", () => {
      const c = cargar(cfgRed);
      c.api.__S.reporte = true;
      const acciones = { "error.entregado": 1, "api.buscarpaciente.ok": 30, "fn.ia.gen": 4 };
      t.cierto(c.api.uxEnviarVentana({ dia: "2026-09-06", desde: "x", acciones }), "se encola");
      const fila = cola(c).filter((f) => f.evento === "ux")[0];
      const limpio = JSON.parse(fila.acciones);
      t.falso("_recortadas" in limpio, "sin recortes");
      t.igual(limpio["api.buscarpaciente.ok"], 30, "api. viaja completo cuando cabe");
    });

    // =====================================================================
    // 5. BEACON DE ÚLTIMO RECURSO al descartar la fila tras 3 rechazos.
    // Sin acuse (sendBeacon es opaco), pero la fila ya NO se reintenta: la
    // objeción de la v17.49.0 (D4) era el reintento, y aquí no lo hay.
    // =====================================================================
    await t.casoAsync("v18.4: la fila de error descartada tras 3 rechazos sale por beacon una última vez y el descarte se cuenta", async () => {
      const beacons = [];
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          const cuerpo = String(o.data || "");
          // El receptor responde «err» (HTTP 200) cuando no puede escribir la fila.
          if (cuerpo.indexOf('"error"') >= 0) { if (o.onload) o.onload({ status: 200, responseText: "err", finalUrl: "" }); return; }
          if (o.onload) o.onload({ status: 200, responseText: "ok", finalUrl: "" });
        },
      });
      c.api.__S.reporte = true;
      c.ctx.navigator = { sendBeacon: (u, b) => { beacons.push(b && b._t); return true; } };
      c.ctx.Blob = function (partes) { this._t = String(partes[0]); };
      c.ctx.fetch = undefined;   // sin respaldo: se mide solo el beacon
      c.api.reportar("error", { origen: "js", msg: "fila envenenada", donde: "vigilante.user.js:1" });
      await esperar(10);
      for (let i = 0; i < 4; i++) { await c.api.repFlush(); await esperar(5); }
      t.falso(cola(c).some((f) => f && f.evento === "error"), "la fila envenenada se descartó a los tres intentos");
      t.cierto(beacons.some((b) => String(b).indexOf('"error"') >= 0),
        "y antes de perderla se intentó UNA entrega ciega por beacon: " + beacons.length + " beacon(s)");
      const w = ventana(c);
      t.igual(w.acciones["rep.fila.descartada.error"], 1, "el descarte queda contado");
      t.igual(w.acciones["rep.descarte.beacon"], 1, "y el beacon de último recurso también se ve");
    });

    // =====================================================================
    // 6. v18.4.6 — ETIQUETADO DE api.otro. La auditoría del export del 07-sep
    // (docs/AUDITORIA_TELEMETRIA_EXPORT_20260907.md §3) contó 2.489 llamadas
    // sin atribución: cinco endpoints que ESTE script llama de verdad y la
    // lista no reconocía. Cada patrón es el literal del call site real.
    // =====================================================================
    t.caso("v18.4.6: los cinco endpoints reales que caían en api.otro llevan etiqueta propia", () => {
      const c = cargar({ silencioso: true });
      const L = c.api._rumEndpointLabel;
      t.igual(L("/apiviva/APIHCHealth/api/Historicos/ObtenerOrdenamientoPorPacienteIdVigente?pacienteid=X"), "ordenVigente");
      t.igual(L("/apiviva/APIHCHealth/api/Parametrizacion/GetValidacionExamenCronicos?citaId=Y"), "validacionExamenes");
      t.igual(L("/apiviva/APIHCHealth/api/Historicos/ObtenerHistoricoSignosVitales?PacienteId=Z"), "historicoSignos");
      t.igual(L("/apiviva/APIHCHealth/api/Historicos/HistoricoMedicamentoHCM?PacienteId=N"), "historicoMedicamentos");
      t.igual(L("/apiviva/APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente"), "medicamentosPaciente");
    });

    t.caso("v18.4.6: una URL desconocida sigue siendo api.otro — la lista blanca no se relaja", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._rumEndpointLabel("/apiviva/APIAcceso/api/Paciente/ValidarPresupuestosPaciente"), "otro",
        "un endpoint que solo usa la UI nativa de Everest no entra: _rumTrack solo ve nuestras llamadas");
      t.igual(c.api._rumEndpointLabel(""), "otro");
    });
  }
};
