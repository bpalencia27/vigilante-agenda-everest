// =====================================================================
//  SUITE 94 — RENDIMIENTO (F-P1 de la delegación): baseline v0
//  Mide el estado ACTUAL sin optimizar (prohibido optimizar antes del
//  baseline). Tres partes, cada una con su defensa anti-flaky:
//
//  A) MICRO-BENCH p50/p95 con reloj de proceso (hrtime): N iteraciones
//     por función del tick. Los percentiles se IMPRIMEN con [PERF-94]
//     para el informe; la suite NO aserta umbrales de rendimiento —
//     solo el resultado correcto y una cota de seguridad de 100 ms por
//     llamada (caza bucles infinitos o cuadráticos, imposible de
//     disparar en una máquina sana). El p95 de una CI cargada no puede
//     poner rojo el banco.
//  B) CONTEO DE RED por flujo: contratos de cascada (cuántas peticiones
//     cuesta cada flujo hoy). El número del peor caso de la cascada de
//     apiAccesoBuscarPaciente ES el baseline que F-P2 debe bajar; cuando
//     F-P2 retire la ruta 400, esta misma aserción se pondrá roja (esa
//     es su mutación) y se actualizará al número nuevo.
//  C) RELOJ CONGELADO: el contexto vm tiene su propio Date intrínseco;
//     congelar c.ctx.Date.now deja los TTL quietos y permite envejecer
//     cachés sin esperar minutos reales.
//  D) MEMO POR TICK (v18.6.2): tick() lee la cédula UNA vez (state._docTick)
//     y los llamadores síncronos del tick la consumen vía _vglDocDelTick();
//     la vía diferida (guard anti-cruce, callbacks 300/900 ms) sigue fresca.
//     La aserción D1 ES la mutación de F-P2.
// =====================================================================
const vm = require("vm");
const { instalarDomEnriquecido } = require("./harness");

// Respuesta con la forma completa que espera _pageFetchJsonCore (misma forma
// que usa la suite 05/91: headers/text/clone incluidos).
const respuesta = (data) => ({
  ok: true, status: 200,
  headers: { get: () => "application/json" },
  json: async () => data,
  text: async () => JSON.stringify(data),
  clone() { return this; },
});

module.exports = {
  nombre: "Rendimiento: baseline v0 (micro-bench p50/p95, red por flujo, reloj congelado)",
  cubre: [
    "togActiva", "mtrNormalizarNombre", "readJSON", "extractPacienteAbierto",
    "accesoCap", "apiAccesoBuscarPaciente", "hcPrefetch", "hcPacienteContexto",
    "apiHcObtenerOrdenamientosVigentes", "_vglDocDelTick",
  ],

  async pruebas(t, api, env, cargar) {
    // ---- montaje estándar (mismo patrón de la suite 91) ----
    function montar(html, opts) {
      const c = cargar(Object.assign({ silencioso: true }, opts));
      instalarDomEnriquecido(c.env.doc);
      const cont = c.env.doc.createElement("div");
      c.env.doc.body.appendChild(cont);
      cont.innerHTML = html;
      const doc = c.env.doc;
      const matchea = (n, sel) => {
        if (!n || !n._parent || !n.tagName) return false;
        if (sel[0] === ".") return !!(n.classList && n.classList.contains(sel.slice(1)));
        if (sel[0] === "#") return n.id === sel.slice(1);
        return n.tagName === sel.toUpperCase();
      };
      doc.querySelector = (sel) => doc._nodos.find((n) => matchea(n, sel)) || null;
      doc.querySelectorAll = (sel) => doc._nodos.filter((n) => matchea(n, sel));
      return c;
    }

    // Identidad de médico real registrado (COMPLETO), como en producción.
    function sembrar707(c) {
      if (!("vgl_acceso_lista" in c.env.almacen)) {
        c.env.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-perf", perfiles: { COMPLETO: [{ uid: 707, nombre: "MEDICO PERF" }], LABORATORIOS: [] }, blocklist: [],
        });
      }
      c.api.__state.activeDoctor = { id: 707, name: "MEDICO PERF" };
    }

    // Micro-bench: calentamiento + N mediciones con process.hrtime (monótono,
    // inmune al reloj de pared). Devuelve p50/p95 en µs y el último retorno.
    function bench(fn, n) {
      n = n || 300;
      for (let i = 0; i < 20; i++) fn();
      const muestras = [];
      let ultimo;
      for (let i = 0; i < n; i++) {
        const t0 = process.hrtime.bigint();
        ultimo = fn();
        const t1 = process.hrtime.bigint();
        muestras.push(Number(t1 - t0) / 1000);   // µs
      }
      muestras.sort((a, b) => a - b);
      const p50 = muestras[Math.floor(n * 0.5)];
      const p95 = muestras[Math.floor(n * 0.95)];
      return { p50, p95, ultimo };
    }

    // =====================================================================
    //  PARTE A — MICRO-BENCH (p50/p95 informativos, cota de seguridad 100 ms)
    // =====================================================================
    t.caso("A/togActiva: lectura del toggle por médico (fail-open) en p50/p95", () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      const r = bench(() => c.api.togActiva("tog_agendar"));
      t.cierto(r.ultimo === true, "sin clave guardada el toggle nace encendido (fail-open)");
      t.falso(r.p95 > 100000, "p95 " + r.p95.toFixed(1) + " µs bajo la cota de seguridad (100 ms)");
      console.log("[PERF-94] A/togActiva        p50=" + r.p50.toFixed(1) + " µs  p95=" + r.p95.toFixed(1) + " µs");
    });

    t.caso("A/mtrNormalizarNombre: normalización pura en p50/p95", () => {
      const c = cargar({ silencioso: true });
      const r = bench(() => c.api.mtrNormalizarNombre("áÉÍ óÚ  Ramírez  GÓMEZ"));
      t.igual(r.ultimo, "AEI OU RAMIREZ GOMEZ", "acentos fuera, mayúsculas, espacios colapsados");
      t.falso(r.p95 > 100000, "p95 " + r.p95.toFixed(1) + " µs bajo la cota de seguridad (100 ms)");
      console.log("[PERF-94] A/mtrNormalizar   p50=" + r.p50.toFixed(1) + " µs  p95=" + r.p95.toFixed(1) + " µs");
    });

    t.caso("A/readJSON: lectura del almacén GM en p50/p95", () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      c.env.almacen["vgl_tog_707"] = JSON.stringify({ tog_agendar: true });
      const r = bench(() => c.api.readJSON("vgl_tog_707"));
      t.cierto(r.ultimo && r.ultimo.tog_agendar === true, "lee el objeto persistido del médico");
      t.falso(r.p95 > 100000, "p95 " + r.p95.toFixed(1) + " µs bajo la cota de seguridad (100 ms)");
      console.log("[PERF-94] A/readJSON         p50=" + r.p50.toFixed(1) + " µs  p95=" + r.p95.toFixed(1) + " µs");
    });

    t.caso("A/extractPacienteAbierto: barrido .text-muted con HC abierta (la llamada del tick)", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1.018.888.777</div></app-index>');
      const r = bench(() => c.api.extractPacienteAbierto());
      t.igual(r.ultimo, "1018888777", "canoniza la cédula de la historia en cada llamada");
      t.falso(r.p95 > 100000, "p95 " + r.p95.toFixed(1) + " µs bajo la cota de seguridad (100 ms)");
      console.log("[PERF-94] A/extractPaciente  p50=" + r.p50.toFixed(1) + " µs  p95=" + r.p95.toFixed(1) + " µs");
    });

    t.caso("A/accesoCap: decisión de capacidad en p50/p95", () => {
      const c = cargar({ silencioso: true });
      sembrar707(c);
      const r = bench(() => c.api.accesoCap("agendar_control"));
      t.cierto(r.ultimo === true, "el perfil COMPLETO tiene la capacidad");
      t.falso(r.p95 > 100000, "p95 " + r.p95.toFixed(1) + " µs bajo la cota de seguridad (100 ms)");
      console.log("[PERF-94] A/accesoCap        p50=" + r.p50.toFixed(1) + " µs  p95=" + r.p95.toFixed(1) + " µs");
    });

    // =====================================================================
    //  PARTE B — CONTEO DE RED POR FLUJO (contratos de cascada)
    // =====================================================================
    await t.casoAsync("B/cascada: peor caso de apiAccesoBuscarPaciente cuesta HOY 1 petición (v18.6.2, ruta 400 retirada)", async () => {
      const urls = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url) => { urls.push(String(url)); return respuesta([]); },   // sin id → cascada completa
      });
      sembrar707(c);
      const pid = await c.api.apiAccesoBuscarPaciente("12345678");
      t.igual(pid, null, "sin paciente en ninguna ruta: null, casilla vacía antes que dato inventado");
      // v18.6.2 (F-P2): la ruta de respaldo sin TipoDocumento devolvía 400 en producción
      // (3/3 en vivo, INFORME_EVIDENCIA_HAR.md §9.4.1) y se retiró — el peor caso es hoy
      // 1 petición. Esta aserción era 2 en el baseline v0 y es la mutación de F-P2
      // (INFORME_MUTACIONES.md).
      t.igual(urls.length, 1, "el peor caso intenta solo la ruta con TipoDocumento=CC (la de respaldo 400 retirada)");
      t.cierto(urls[0].indexOf("TipoDocumento=CC") !== -1, "la única ruta lleva TipoDocumento");
      t.cierto(urls[0].indexOf("identificacion=12345678") !== -1, "el documento viaja en la URL");
      console.log("[PERF-94] B/cascada peor caso: " + urls.length + " peticiones");
    });

    await t.casoAsync("B/acierto: 1 petición en total y caché de 10 min para la misma cédula", async () => {
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { llamadas++; return respuesta([{ pacienteId: 999 }]); },
      });
      sembrar707(c);
      const pid1 = await c.api.apiAccesoBuscarPaciente("12345678");
      t.igual(pid1, 999, "resuelve el id interno a la primera ruta");
      t.igual(llamadas, 1, "acierto a la primera: una sola petición");
      const pid2 = await c.api.apiAccesoBuscarPaciente("12345678");
      t.igual(pid2, 999, "la segunda lectura devuelve lo mismo");
      t.igual(llamadas, 1, "y no repite la red: caché TTL 10 min");
      console.log("[PERF-94] B/acierto 1ª ruta: 1 petición + caché");
    });

    await t.casoAsync("B/cadena HC: clic → 2 peticiones (búsqueda + órdenes vigentes), sin llamadas fantasma", async () => {
      const AGENDA = '<div id="vgl-root"></div>'
        + '<div class="card"><div class="card-body">'
        + '<span class="labelHora">7:30 a. m.</span><span class="status-label">En Sala</span>'
        + '<button _ngcontent-tml-c5="" type="button" class="btn btn-primary-medic ng-star-inserted"> Historias Clínicas </button>'
        + '<div class="text-muted">C.C. 1.018.888.777</div>'
        + "</div></div>";
      const urls = [];
      const c = montar(AGENDA, {
        fetch: async (url) => {
          urls.push(String(url));
          if (String(url).indexOf("BuscarPaciente") !== -1) return respuesta([{ pacienteId: 999 }]);
          if (String(url).indexOf("ObtenerOrdenamientoPorPacienteIdVigente") !== -1) return respuesta([{ cup: "1" }]);
          return respuesta([]);
        },
      });
      c.api._vglHcSetHintParaTest(null);
      c.api._vglHcCapturarClick({ target: c.env.doc.querySelector("button") });
      for (let i = 0; i < 100 && urls.length < 2; i++) await new Promise((r) => setTimeout(r, 5));
      const nBuscar = urls.filter((u) => u.indexOf("BuscarPaciente") !== -1).length;
      const nOrdenes = urls.filter((u) => u.indexOf("ObtenerOrdenamientoPorPacienteIdVigente") !== -1).length;
      t.igual(nBuscar, 1, "un solo eslabón de búsqueda de paciente");
      t.igual(nOrdenes, 1, "un solo eslabón de órdenes vigentes");
      t.igual(urls.length, 2, "la cadena completa cuesta 2 peticiones y ninguna más");
      console.log("[PERF-94] B/cadena HC: " + urls.length + " peticiones");
    });

    // =====================================================================
    //  PARTE C — RELOJ CONGELADO (TTLs sin esperar tiempo real)
    //  El contexto vm trae su propio Date intrínseco, y desde fuera del
    //  sandbox no es alcanzable (c.ctx.Date es undefined): se muta DESDE
    //  DENTRO con runInContext. Cada cargar() fabrica su propio contexto,
    //  así que el reloj de otras suites y el del runner quedan intactos.
    // =====================================================================
    const T0 = 1700000000000;
    function congelar(c, ts) {
      vm.runInContext("Date.now = function(){ return " + ts + "; };", c.ctx);
    }

    t.caso("C/hint HC: con el reloj congelado el hint NO caduca; +16 s lo entierra (TTL 15 s)", () => {
      const c = montar('<div id="vgl-root"></div>');
      congelar(c, T0);
      // haceMs=0 → ts interno = Date.now() congelado - 0 = T0 (hint recién creado).
      c.api._vglHcSetHintParaTest("1018888777", 0);
      const vivo = c.api.hcPacienteContexto();
      t.cierto(!!vivo && vivo.docId === "1018888777", "diff 0 s < 15 s: el hint sigue fabricando contexto");
      congelar(c, T0 + 16000);
      t.igual(c.api.hcPacienteContexto(), null, "diff 16 s > 15 s: TTL vencido, sin paciente fantasma");
      console.log("[PERF-94] C/hint HC: TTL 15 s verificado con reloj congelado (0 s vivo, 16 s muerto)");
    });

    await t.casoAsync("C/caché paciente: viva 10 min exactos con reloj congelado, refetch al vencer", async () => {
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { llamadas++; return respuesta([{ pacienteId: 999 }]); },
      });
      sembrar707(c);
      congelar(c, T0);
      const p1 = await c.api.apiAccesoBuscarPaciente("12345678");
      t.igual(p1, 999, "primera resolución (reloj quieto en T0)");
      t.igual(llamadas, 1, "1 petición");
      const p2 = await c.api.apiAccesoBuscarPaciente("12345678");
      t.igual(p2, 999, "misma cédula con el reloj quieto");
      t.igual(llamadas, 1, "caché viva (diff 0 < 10 min): cero red");
      congelar(c, T0 + 600001);
      const p3 = await c.api.apiAccesoBuscarPaciente("12345678");
      t.igual(p3, 999, "tras vencer, vuelve a resolver");
      t.igual(llamadas, 2, "TTL 10 min vencido con el reloj adelantado: refetch");
      console.log("[PERF-94] C/caché paciente: TTL 10 min verificado con reloj congelado");
    });

    await t.casoAsync("C/órdenes vigentes: caché de 10 min con reloj congelado, refetch al vencer", async () => {
      let llamadas = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { llamadas++; return respuesta([{ cup: "1" }]); },
      });
      sembrar707(c);
      congelar(c, T0);
      await c.api.apiHcObtenerOrdenamientosVigentes(999);
      await c.api.apiHcObtenerOrdenamientosVigentes(999);
      t.igual(llamadas, 1, "segunda llamada servida por la caché (reloj quieto)");
      congelar(c, T0 + 600001);
      await c.api.apiHcObtenerOrdenamientosVigentes(999);
      t.igual(llamadas, 2, "al vencer los 10 min, se reconsulta");
      console.log("[PERF-94] C/órdenes vigentes: TTL 10 min verificado con reloj congelado");
    });

    // =====================================================================
    //  PARTE D — MEMO POR TICK DEL PACIENTE ABIERTO (F-P2, v18.6.2)
    //  tick() lee la cédula UNA vez (state._docTick) y los llamadores SÍNCRONOS
    //  del tick la consumen vía _vglDocDelTick(); la vía diferida sigue fresca.
    //  La aserción "usa la foto del tick SIN barrer el DOM" ES la mutación de
    //  F-P2: si el helper vuelve a leer fresco, devuelve la cédula del DOM
    //  (otra) y el contador sube → rojo.
    // =====================================================================
    t.caso("D/memo tick: hcPacienteContexto usa la foto del tick sin barrer el DOM", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1.018.888.777</div></app-index>');
      // Foto del tick con OTRA cédula: si el consumidor barriera el DOM, leería 1018888777.
      c.api.__state._docTick = "99999999";
      let barridos = 0;
      const appIndex = c.env.doc.querySelector("app-index");
      if (appIndex && typeof appIndex.querySelectorAll === "function") {
        const qsa = appIndex.querySelectorAll.bind(appIndex);
        appIndex.querySelectorAll = (sel) => { if (sel === ".text-muted") barridos++; return qsa(sel); };
      }
      const ctx = c.api.hcPacienteContexto();
      t.cierto(!!ctx && ctx.docId === "99999999" && ctx.origen === "dom",
        "consume la foto del tick (state._docTick), no el DOM");
      t.igual(barridos, 0, "cero barridos de .text-muted: la lectura del tick es UNA por vuelta");
      console.log("[PERF-94] D/memo tick: foto del tick consumida, " + barridos + " barridos del DOM");
    });

    t.caso("D/memo tick: sin foto del tick (pruebas/vía diferida) la lectura sigue fresca", () => {
      const c = montar('<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1.018.888.777</div></app-index>');
      delete c.api.__state._docTick;   // como una prueba que no corre tick()
      const ctx = c.api.hcPacienteContexto();
      t.cierto(!!ctx && ctx.docId === "1018888777" && ctx.origen === "dom",
        "sin foto, cae a extractPacienteAbierto() fresca (el guard anti-cruce depende de esta vía)");
      console.log("[PERF-94] D/memo tick: vía fresca intacta sin foto del tick");
    });

    // =====================================================================
    //  PARTE E — CHIP ÚLTIMA HC (F-P2, P1, v18.6.2)
    //  El chip del lanzador pinta la última HC del paciente con el contrato
    //  REAL de ObtenerUltimaHCPes (fechaCreacion, clasificacion,
    //  riesgoCardiovascular — INFORME_EVIDENCIA_HAR.md §9.4.2). La aserción
    //  del pintado ES la mutación de P1.
    // =====================================================================
    t.caso("E/utilizable: solo el objeto del contrato real pasa (nunca se fabrican valores)", () => {
      const c = cargar({ silencioso: true });
      const u = c.api._vglUltimaHcUtilizable;
      const lleno = u({ fechaCreacion: "2026-06-06T10:19:38-05:00", clasificacion: "A1", riesgoCardiovascular: "ALTO" });
      t.cierto(lleno && lleno.fechaCreacion === "2026-06-06T10:19:38-05:00" && lleno.clasificacion === "A1" && lleno.riesgoCardiovascular === "ALTO",
        "objeto del contrato: pasa con sus tres claves");
      const parcial = u({ clasificacion: "A1" });
      t.cierto(parcial && parcial.clasificacion === "A1" && parcial.fechaCreacion === "" && parcial.riesgoCardiovascular === "",
        "parcial: las claves ausentes quedan vacías, jamás inventadas");
      t.igual(u([]), null, "arreglo: null");
      t.igual(u(null), null, "null: null");
      t.igual(u({ foo: "bar" }), null, "objeto ajeno al contrato: null");
      t.igual(c.api._vglUltimaHcFecha("2026-06-06T10:19:38-05:00"), "06/06/2026", "ISO → dd/mm/aaaa");
      t.igual(c.api._vglUltimaHcFecha("garbage"), "", "fecha ilegible → vacío");
      console.log("[PERF-94] E/utilizable: contrato real validado sin fabricar valores");
    });

    await t.casoAsync("E/chip: pinta fecha + clasificación + riesgo de la última HC con UNA sola consulta", async () => {
      const DOM_H = '<div id="vgl-root"></div><div id="anamesis"></div>'
        + '<app-index><div class="text-muted">C.C. 1.018.888.777</div></app-index>';
      const urlsE = [];
      const c = montar(DOM_H, {
        fetch: async (url) => {
          urlsE.push(String(url));
          if (String(url).indexOf("BuscarPaciente") !== -1) return respuesta([{ pacienteId: 999 }]);
          if (String(url).indexOf("ObtenerUltimaHCPes") !== -1) return respuesta({ fechaCreacion: "2026-06-06T10:19:38-05:00", clasificacion: "A1", riesgoCardiovascular: "ALTO" });
          return respuesta([]);
        },
      });
      c.api.hcRenderChip();
      const chip1 = c.env.doc.getElementById("vgl-hc-chip");
      t.cierto(!!chip1 && chip1.innerHTML.indexOf("HC ···8777") !== -1,
        "línea base del chip intacta (cédula enmascarada)");
      t.cierto(chip1.innerHTML.indexOf("última HC") === -1,
        "sin dato cacheado todavía, NO hay línea de última HC (el chip no miente)");
      for (let i = 0; i < 100 && urlsE.filter((u) => u.indexOf("ObtenerUltimaHCPes") !== -1).length === 0; i++) await new Promise((r) => setTimeout(r, 5));
      c.api.hcRenderChip();
      const chip2 = c.env.doc.getElementById("vgl-hc-chip");
      t.cierto(chip2.innerHTML.indexOf("última HC: 06/06/2026 · A1 · ALTO") !== -1,
        "el chip pinta la última HC del contrato real (fecha de cierre + clasificación + riesgo)");
      t.igual(urlsE.filter((u) => u.indexOf("ObtenerUltimaHCPes") !== -1).length, 1,
        "una sola consulta de última HC (caché 10 min + dedup en vuelo)");
      t.cierto(urlsE.filter((u) => u.indexOf("ObtenerUltimaHCPes") !== -1).every((u) => u.indexOf("PacienteId=999") !== -1),
        "al endpoint viaja el id INTERNO resuelto, jamás la cédula");
      console.log("[PERF-94] E/chip: última HC pintada con 1 consulta (id interno, no cédula)");
    });
  },
};
