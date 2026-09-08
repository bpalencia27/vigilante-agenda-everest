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
    "apiHcObtenerOrdenamientosVigentes",
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
    await t.casoAsync("B/cascada: peor caso de apiAccesoBuscarPaciente cuesta HOY 2 peticiones (baseline v0)", async () => {
      const urls = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url) => { urls.push(String(url)); return respuesta([]); },   // sin id → cascada completa
      });
      sembrar707(c);
      const pid = await c.api.apiAccesoBuscarPaciente("12345678");
      t.igual(pid, null, "sin paciente en ninguna ruta: null, casilla vacía antes que dato inventado");
      // BASELINE v0: la cascada de hoy tiene 2 rutas (TipoDocumento=CC y la de respaldo
      // sin TipoDocumento). F-P2 retira la de respaldo y ESTA aserción se actualiza a 1.
      t.igual(urls.length, 2, "el peor caso intenta las 2 rutas de la cascada actual");
      t.cierto(urls[0].indexOf("TipoDocumento=CC") !== -1, "la primera ruta lleva TipoDocumento");
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
  },
};
