// =====================================================================
//  SUITE 70 — Enjambre de auditoría pre-despliegue (2026-08-31)
//
//  Cierra los huecos de cobertura que el enjambre de 8 subagentes confirmó
//  como "sin ninguna prueba" justo en lo que se despliega mañana:
//
//   · El CORTACIRCUITOS de las llamadas especulativas (v17.15.0): tras 3
//     fallos seguidos suspende 5 min el hover/preparador cuando Everest está
//     caído. Nunca se había probado; si se rompe, un servidor caído recibe
//     cientos de peticiones por día o el freno nunca abre.
//
//   · El CANAL "reloj" de 1 s (v18.0.3): el cambio estrella de la versión.
//     Sin prueba: el sello de una sola oportunidad, el auto-stop cuando el
//     nodo desaparece y el nuevo freno de v18.0.4 al ocultar el panel.
//
//   · El FLUSH de carteles con silencio temporal (v18.0.4): el cartel ROJO
//     ya no se consume sin pintarse cuando muted() está activo.
// =====================================================================

function WorkerFalso(url) {
  const self = this;
  this.url = url;
  this.enviados = [];
  this.terminado = false;
  this.onmessage = null;
  this.onerror = null;
  this.postMessage = (m) => { self.enviados.push(m); };
  this.terminate = () => { self.terminado = true; };
  this.latir = (id) => { if (self.onmessage) self.onmessage({ data: { id } }); };
  WorkerFalso.ultimo = this;
}

// El harness simula el DOM a medias: para montar buildOverlay() hay que dar a
// cada elemento un querySelector memoizado (mismo patrón que suite_15).
function enriquecerDom(c) {
  const doc = c.env.doc;
  const crearBase = doc.createElement;
  doc.createElement = function (tag) {
    const e = crearBase(tag);
    const memo = new Map();
    e.querySelector = (sel) => {
      if (!memo.has(sel)) memo.set(sel, doc.createElement("div"));
      return memo.get(sel);
    };
    e.querySelectorAll = () => [];
    return e;
  };
  doc.createDocumentFragment = () => {
    const f = doc.createElement("div");
    f._esFragmento = true;
    return f;
  };
}

module.exports = {
  nombre: "Enjambre pre-despliegue (31-ago): cortacircuitos, reloj v18.0.3 y cola de carteles",
  cubre: ["_apiCorteAbierto", "_apiMarcarResultado", "_apiCorteEstadoParaTest", "_apiCorteResetParaTest",
          "_pageFetchJsonCore", "_relojSegundosMontar", "actualizarRelojCabecera", "_relojEstadoParaTest",
          "setWinState", "_encolarAvisoPendiente", "_flushAvisosPendientes", "muteFor", "unmute"],

  async pruebas(t, api, env, cargar) {
    // =================================================================
    // 1. CORTACIRCUITOS DE LAS LLAMADAS ESPECULATIVAS (v17.15.0)
    // =================================================================
    t.caso("cortacircuitos: 3 fallos seguidos lo abren durante 5 min; un éxito lo cierra", () => {
      const c = cargar({ silencioso: true });
      c.api._apiCorteResetParaTest();
      t.falso(c.api._apiCorteAbierto(), "punto de partida: el freno está cerrado");
      c.api._apiMarcarResultado(false);
      c.api._apiMarcarResultado(false);
      t.falso(c.api._apiCorteAbierto(), "2 fallos seguidos aún no abren el freno");
      c.api._apiMarcarResultado(false);
      t.cierto(c.api._apiCorteAbierto(), "3 fallos seguidos: el freno se abre");
      let st = c.api._apiCorteEstadoParaTest();
      t.igual(st.fallos, 3, "contador en 3");
      t.cierto(st.hasta > Date.now(), "con ventana de 5 min por delante");
      c.api._apiMarcarResultado(true);
      st = c.api._apiCorteEstadoParaTest();
      t.igual(st.fallos, 0, "un éxito resetea el contador");
      t.falso(c.api._apiCorteAbierto(), "y cierra el freno de inmediato");
    });

    await t.casoAsync("cortacircuitos: con el freno abierto, lo ESPECULATIVO no sale ni una vez (era cientos de peticiones)", async () => {
      let llamadas = 0;
      const mockFetch = async () => { llamadas++; return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
      const mockGmxhr = (o) => { if (o && o.onerror) o.onerror(new Error("x")); };
      const c = cargar({ silencioso: true, fetch: mockFetch, gmxhr: mockGmxhr });
      c.api._apiCorteResetParaTest();
      c.api._apiMarcarResultado(false); c.api._apiMarcarResultado(false); c.api._apiMarcarResultado(false);
      t.cierto(c.api._apiCorteAbierto(), "premisa: el freno está abierto");
      const res = await c.api._pageFetchJsonCore("/api/BuscarPaciente", { especulativo: true });
      t.igual(res, null, "la llamada especulativa devuelve null (su modo normal de fallar)");
      t.igual(llamadas, 0, "y NO se hizo ni una petición al servidor caído");
    });

    await t.casoAsync("cortacircuitos: una acción PEDIDA por el médico se sigue intentando con el freno abierto", async () => {
      let llamadas = 0;
      const mockFetch = async () => { llamadas++; return { ok: false, status: 404 }; };
      const mockGmxhr = (o) => { if (o && o.onerror) o.onerror(new Error("x")); };
      const c = cargar({ silencioso: true, fetch: mockFetch, gmxhr: mockGmxhr });
      c.api._apiCorteResetParaTest();
      c.api._apiMarcarResultado(false); c.api._apiMarcarResultado(false); c.api._apiMarcarResultado(false);
      t.cierto(c.api._apiCorteAbierto(), "premisa: el freno está abierto");
      const res = await c.api._pageFetchJsonCore("/api/BuscarPaciente", { method: "GET" });
      t.igual(llamadas, 1, "el asistente no se niega: la petición pedida SÍ se intentó");
      t.igual(res, null, "falló (4xx, sin reintento), pero el intento existió");
    });

    // =================================================================
    // 2. CANAL "reloj" DE 1 s (v18.0.3 / v18.0.4)
    // =================================================================
    t.caso("reloj: _relojSegundosMontar registra el canal y el sello evita duplicarlo", () => {
      const c = cargar({ silencioso: true, Worker: WorkerFalso });
      enriquecerDom(c);
      c.api.buildOverlay();
      c.api._relojSegundosMontar();
      const n1 = c.api._relojEstadoParaTest().canales.filter((x) => x === "reloj").length;
      t.igual(n1, 1, "un solo canal 'reloj' tras el primer montaje");
      c.api._relojSegundosMontar();
      const n2 = c.api._relojEstadoParaTest().canales.filter((x) => x === "reloj").length;
      t.igual(n2, 1, "la segunda llamada no duplica (sello de una sola oportunidad)");
    });

    t.caso("reloj: si #vgl-clock ya no existe, el canal se detiene solo (auto-stop v18.0.3)", () => {
      const c = cargar({ silencioso: true, Worker: WorkerFalso });
      enriquecerDom(c);
      c.api.buildOverlay();
      c.api._relojSegundosMontar();
      t.cierto(c.api._relojEstadoParaTest().canales.includes("reloj"), "premisa: el canal está vivo");
      const originalGet = c.env.doc.getElementById.bind(c.env.doc);
      c.env.doc.getElementById = () => null;   // el nodo del reloj desapareció del DOM
      WorkerFalso.ultimo.latir("reloj");
      c.env.doc.getElementById = originalGet;
      t.falso(c.api._relojEstadoParaTest().canales.includes("reloj"), "el canal se detuvo solo, sin dejar el latido vivo");
    });

    t.caso("reloj v18.0.4: ocultar el panel detiene el canal de 1 s y volver a verlo lo remonta", () => {
      const c = cargar({ silencioso: true, Worker: WorkerFalso });
      enriquecerDom(c);
      c.api.buildOverlay();
      c.api._relojSegundosMontar();
      t.cierto(c.api._relojEstadoParaTest().canales.includes("reloj"), "premisa: canal vivo con el panel visible");
      c.api.setWinState("hidden", true);
      t.falso(c.api._relojEstadoParaTest().canales.includes("reloj"), "oculto: el canal se detiene (antes latía 86.400 veces al día en vano)");
      c.api.setWinState("full", true);
      t.cierto(c.api._relojEstadoParaTest().canales.includes("reloj"), "visible: el canal se remonta solo");
    });

    t.caso("reloj: actualizarRelojCabecera pinta hora actual + tiempo de turno en #vgl-clock", () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      const reloj = c.env.doc.createElement("div");
      reloj.id = "vgl-clock";
      c.env.doc.body.appendChild(reloj);
      c.api.actualizarRelojCabecera();
      t.cierto(!!c.env.doc.getElementById("vgl-clock"), "el nodo del reloj existe");
      t.cierto(/^\d{2}:\d{2} · \d+h\d{1,2}m$/.test(reloj.textContent || ""), "formato 'HH:MM · XhYm' visible");
    });

    // =================================================================
    // 3. FLUSH DE CARTELES CON SILENCIO TEMPORAL (v18.0.4)
    // =================================================================
    t.caso("cola de carteles: con silencio temporal activo, el ROJO NO se consume sin pintarse — espera", () => {
      const c = cargar();
      c.api.__S.cartel = true;                 // el canal del cartel activo
      c.env.win.location.pathname = "/viva/HCHealth/";
      c.api._encolarAvisoPendiente({ color: "ROJO", title: "t", body: "b", persist: true, uid: "x|ROJO", flashText: "t", ts: Date.now() });
      c.api.__state.muteUntil = Date.now() + 15 * 60000;   // «Silenciar 15 min» activo
      c.api._flushAvisosPendientes();
      const cola1 = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola1.length, 1, "con muted() el cartel se queda en cola (antes se consumía en silencio)");
      c.api.__state.muteUntil = 0;             // termina el silencio
      c.api._flushAvisosPendientes();
      const cola2 = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola2.length, 0, "terminado el silencio, el flush sí lo pinta y vacía la cola");
    });
  },
};
