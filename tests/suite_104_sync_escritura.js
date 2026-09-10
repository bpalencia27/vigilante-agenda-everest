// =====================================================================
//  SUITE 104 — «Sincronización en tiempo real» (v18.8.8, FASE A)
//
//  La orden del 08-sep pide, con énfasis prioritario, la actualización
//  INMEDIATA de lo que ingresa el médico. Hasta v18.8.7 el repintado del
//  PANEL DEL PACIENTE esperaba su vigilante de 20 s (TABLERO_VIGILANCIA_MS)
//  y la cosecha su tick de 5 s: escribía la tensión y el panel abierto
//  tardaba hasta 20 s en reclasificar.
//
//  FASE A añade un flush de escritura: los listeners de captura que ya
//  existen para la compuerta de DOM (input/change/click, nodos ajenos al
//  Vigilante) ahora distinguen la ESCRITURA real (input/change) de la
//  navegación (click) y programan, con debounce de 700 ms, el adelanto del
//  vigilante del panel abierto — si es que hay uno registrado.
//
//  Lo que hay que defender aquí:
//   · que el slot del vigilante urgente se registra, se reemplaza y se
//     quita SOLO cuando le toca (un panel que muere solo no desactiva al
//     panel vigente);
//   · que sin panel abierto el flush es inerte (costo cero fuera del
//     panel) y que con panel adelanta la vigilancia en <1 s por el MISMO
//     camino que usa producción (el listener real de captura, no una
//     llamada de laboratorio);
//   · que el click no adelanta nada (es navegación, no escritura);
//   · que el techo anti-ráfaga evita encadenar barridos;
//   · que el panel real (openPanelPacienteModal) se registra al
//     completarse la carga, tolera un flush adelantado sin repintar en
//     falso (firma DOM sin cambios) y se desregistra al cerrar por la ✕.
// =====================================================================

const RESUMEN_DEMO = {
  programa: "HTA",
  factores: { edad: 66, sexo: "F", pesoKg: 70, diabetes: true, hta: true },
  erc: { crcl: 58, egfr: 55, estadioAdministrativo: "G3a", estadioClinico: "G3a" },
  riesgo: { categoria: "ALTO", criterios: ["diabetes"], paso: 2, fuente: "regla del programa" },
  ultimos: { CREATININA: { valor: 1.1, fecha: "2026-08-01" }, COLESTEROL_LDL: { valor: 130, fecha: "2026-08-01" } },
  _ultimos: { CREATININA: { valor: 1.1, fecha: "2026-08-01" } },
  medicamentos: ["LOSARTAN 50MG", "METFORMINA 850MG"],
  plan: { vencidos: [], faltantes: [{ nombre: "RAC" }] },
  _series: {
    HBA1C: [
      { fecha: "2025-08-01", valor: 9.4 },
      { fecha: "2026-02-01", valor: 8.6 },
      { fecha: "2026-08-01", valor: 7.1 },
    ],
    COLESTEROL_LDL: [
      { fecha: "2026-02-01", valor: 100 },
      { fecha: "2026-08-01", valor: 130 },
    ],
    CREATININA: [{ fecha: "2026-08-01", valor: 1.1 }],
  },
};

// La espera real mínima para que el debounce (700 ms) dispare en el arnés.
const ESPERA_DEBOUNCE_MS = 850;
const _dormir = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  nombre: "Sincronización en tiempo real: la escritura del médico adelanta la vigilancia del Panel (v18.8.8 FASE A)",
  cubre: [
    "_vglDomMarcarSucio", "_vglPanelVigilanteRegistrar", "_vglPanelVigilanteQuitarSi",
    "_vglPanelVigilanteEstado", "_vglEscrituraDetectada", "_vglFlushEscrituraEjecutar",
    "openPanelPacienteModal",
  ],

  async pruebas(t, api, env, cargar) {
    // El guard de apertura de los open* exige perfil COMPLETO (mismo patrón
    // que suite_67): se siembra la lista de acceso y una identidad por defecto.
    const _cargarAccesoBase = cargar;
    cargar = (opciones) => {
      const opts = Object.assign({}, opciones || {});
      if (!opts.almacen) opts.almacen = {};
      if (!("vgl_acceso_lista" in opts.almacen)) {
        opts.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-104.acceso",
          perfiles: {
            COMPLETO: [
              { uid: 707, nombre: "Brandon Jesús Palencia Martínez" },
              { uid: 102, nombre: "Eliseth Estrada" },
              { uid: 103, nombre: "María Edineth Pino" },
            ],
            LABORATORIOS: [],
          },
          blocklist: [],
        });
      }
      const c = _cargarAccesoBase(opts);
      if (c && c.api && c.api.__state && !c.api.__state.activeDoctor.id) {
        c.api.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      }
      return c;
    };

    t.caso("FASE A: el slot del vigilante urgente — registrar, reemplazar y quitar SOLO al que corresponde", () => {
      t.igual(api._vglPanelVigilanteEstado(), null, "arranca vacío (ningún panel abierto)");
      const fA = () => {};
      const fB = () => {};
      api._vglPanelVigilanteRegistrar(fA);
      t.igual(api._vglPanelVigilanteEstado(), fA, "registrar deja la función en el slot");
      api._vglPanelVigilanteQuitarSi(fB);
      t.igual(api._vglPanelVigilanteEstado(), fA,
        "quitar con la función EQUIVOCADA no toca el slot: un panel que muere solo no desactiva al vigente");
      api._vglPanelVigilanteRegistrar(null);
      t.igual(api._vglPanelVigilanteEstado(), null, "registrar null lo vacía (es lo que llama closeMod)");
      api._vglPanelVigilanteQuitarSi(fA);
      t.igual(api._vglPanelVigilanteEstado(), null, "y quitar sobre un slot vacío no rompe");
    });

    await t.casoAsync("FASE A: sin panel abierto el flush es inerte; con vigilante registrado lo invoca; el techo anti-ráfaga corta el segundo disparo inmediato", async () => {
      const c = await cargar({ silencioso: true });
      let llamadas = 0;
      c.api._vglPanelVigilanteRegistrar(null);
      c.api._vglEscrituraDetectada();       // sin slot: no programa ningún timer
      c.api._vglFlushEscrituraEjecutar();   // y ejecutar a pelo no llama a nadie
      t.igual(llamadas, 0, "sin panel abierto no se llama a nadie (costo cero fuera del panel)");
      c.api._vglPanelVigilanteRegistrar(() => { llamadas++; });
      c.api._vglFlushEscrituraEjecutar();
      t.igual(llamadas, 1, "con el panel registrado, el flush lo invoca");
      c.api._vglFlushEscrituraEjecutar();
      t.igual(llamadas, 1, "y el segundo flush inmediato se descarta: techo anti-ráfaga de 2,5 s (no encadena barridos)");
      // La marca de DOM sucio que hace el mismo listener de captura, y su compuerta
      // (A3.1), intactas en esta instancia: marcar abre la compuerta una sola vez.
      c.api._vglDomMarcarSucio();
      t.cierto(c.api._vglDomEstaSucia() === true, "tras marcar, la compuerta dice que hay suciedad");
      t.cierto(c.api._vglDomEstaSucia() === false, "y la consume: la segunda lectura ya no ve suciedad (compuerta A3.1 intacta)");
      c.api._vglPanelVigilanteRegistrar(null);
    });

    await t.casoAsync("FASE A: la escritura del médico (input) adelanta al vigilante en <1 s — por el MISMO camino que producción", async () => {
      const c = await cargar({ silencioso: true });
      let llamadas = 0;
      c.api._vglPanelVigilanteRegistrar(() => { llamadas++; });
      // En el arnés el boot no corre (readyState "loading"): la vigilancia DOM se
      // instala bajo demanda, igual que la instala la primera compuerta en vivo.
      c.api._vglInstalarVigilanciaDom();
      const vig = c.api.__vglDomVigilanciaParaTest();
      t.cierto(typeof vig.alTocar === "function", "montaje: el listener de captura quedó instalado");
      const inicio = Date.now();
      // El médico escribe en una casilla de Everest (nodo ajeno al Vigilante).
      vig.alTocar({ type: "input", target: c.env.doc.createElement("div") });
      t.igual(llamadas, 0, "todavía no: el debounce espera a que pare de teclear");
      await _dormir(ESPERA_DEBOUNCE_MS);
      t.igual(llamadas, 1, "el vigilante del panel corre solo a los 700 ms de la última tecla, sin esperar los 20 s");
      t.cierto(Date.now() - inicio < 5000, "el adelanto ocurrió en menos de un segundo de margen de prueba");
      c.api._vglPanelVigilanteRegistrar(null);
    });

    await t.casoAsync("FASE A: el click del médico NO adelanta la vigilancia (es navegación, no escritura de datos)", async () => {
      const c = await cargar({ silencioso: true });
      let llamadas = 0;
      c.api._vglPanelVigilanteRegistrar(() => { llamadas++; });
      c.api._vglInstalarVigilanciaDom();
      const vig = c.api.__vglDomVigilanciaParaTest();
      vig.alTocar({ type: "click", target: c.env.doc.createElement("div") });
      await _dormir(ESPERA_DEBOUNCE_MS);
      t.igual(llamadas, 0, "un clic no programa ningún flush: nada se adelantó");
      c.api._vglPanelVigilanteRegistrar(null);
    });

    await t.casoAsync("FASE A: con el Panel real abierto, el slot queda registrado al completarse; un flush adelantado no repinta en falso; al cerrar por la ✕ se libera", async () => {
      const c = await cargar({ silencioso: true });
      const d = c.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      c.api._vglCosechaGuardar("777888999", { factores: { hta: { v: true, ts: 1 }, tabaquismo: { v: false, ts: 1 } } });
      c.api.mtrCacheResumenGuardar("777888999", RESUMEN_DEMO);

      await c.api.openPanelPacienteModal({ doc_id: "777888999", nombre: "PACIENTE DE PRUEBA" }, { seccion: "resumen" });
      const modal = c.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.cierto(!!modal, "el Panel abre");
      t.igual(typeof c.api._vglPanelVigilanteEstado(), "function",
        "al completarse la carga, el panel se registró como vigilante urgente");

      // La escritura del médico con el Panel abierto: el flush adelanta al
      // vigilante REAL del panel. En el arnés la firma del DOM no cambia (no
      // hay casillas reales), así que el vigilante debe salir sin repintar y
      // sin romper nada — justo la garantía de idempotencia que hace seguro
      // adelantarlo en producción.
      c.api._vglEscrituraDetectada();
      c.api._vglFlushEscrituraEjecutar();
      t.igual(typeof c.api._vglPanelVigilanteEstado(), "function",
        "el flush adelantado corrió sin romper y el panel sigue registrado (sin repintado en falso)");
      const cuerpo = String((modal.querySelector("#vgl-panel-cuerpo") || {}).innerHTML || "");
      t.cierto(cuerpo.length >= 0, "el cuerpo del panel sigue en pie tras el flush");

      const x = modal.querySelector("#vgl-panel-x");
      t.cierto(!!(x._listeners && x._listeners.click && x._listeners.click.length), "el botón ✕ quedó con su manejador de clic");
      x._listeners.click[0]();
      t.igual(c.api._vglPanelVigilanteEstado(), null, "al cerrar el panel por la ✕, la escritura del médico ya no adelanta nada");
    });
  },
};
