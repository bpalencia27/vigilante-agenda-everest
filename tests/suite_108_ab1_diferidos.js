// =====================================================================
//  SUITE 108 — Barridos diferidos del tick (informe A/B, AB-1)
//  La puerta _ab1Diferir saca del camino del tick la cosecha de la HC y
//  los widgets de conducta/ordenar/fármaco/RCV cuando el toggle
//  tog_ab1_diferir está encendido (variante B del experimento): se
//  encolan a idleRun y corren en el hueco de inactividad, con su MISMA
//  etiqueta de RUM para que la comparación A/B sea directa.
//  Garantías bajo prueba: toggle apagado = ejecución en línea idéntica
//  al histórico (y la etiqueta RUM se conserva); toggle encendido =
//  diferido sin correr, re-chequeo de ctxValido AL CORRER (jamás cosecha
//  al paciente equivocado), anti-duplicado por etiqueta, y dos redes de
//  seguridad: sin requestIdleCallback cae al temporizador, y si encolar
//  lanza el barrido corre ya (el trabajo nunca se pierde).
//  Bloque 2: verificación estructural del enganche real en el código
//  vivo (los 6 puntos del tick + el render instrumentado).
// =====================================================================
const fs = require("fs");
const path = require("path");

module.exports = {
  nombre: "AB-1: barridos diferidos fuera del camino del tick (informe A/B)",
  cubre: ["_ab1Diferir"],

  async pruebas(t, api, env, cargar) {
    // pequeña espera REAL (fuera del sandbox) para dejar correr los timers
    // del arnés, que recorta todo setTimeout a ~1 ms
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const USERJS = path.join(__dirname, "..", "vigilante_agenda.user.js");

    function montar() {
      return cargar({ silencioso: true });
    }
    function identidad(c, id) {
      c.api.__state.activeDoctor.id = id;
      c.api.__state.activeDoctor.name = "MEDICO " + id;
    }
    // reloj falso: _rumTramo anilla solo tramos >= 50 ms; moviendo `t0.v`
    // dentro de la fase se simula su costo sin esperar de verdad
    const relojFalso = (c, t0) => {
      c.env.win.performance = { now: () => t0.v };
      return t0;
    };

    // =================================================================
    //  BLOQUE 1 — comportamiento de la puerta _ab1Diferir
    // =================================================================

    t.caso("toggle apagado (defecto) — el barrido corre en línea, como siempre", () => {
      const c = montar();
      let pedidos = 0;
      c.ctx.requestIdleCallback = () => { pedidos++; };   // si encolara, lo veríamos
      let corrido = 0;
      c.api._ab1Diferir("tick.widget.conducta", () => { corrido++; });
      t.igual(corrido, 1, "sin toggle (defecto:false) ejecuta síncrono, al volver ya corrió");
      t.igual(pedidos, 0, "y no pasa por requestIdleCallback: mismo camino que el histórico");
    });

    t.caso("toggle apagado — la etiqueta RUM es la histórica (comparación A/B directa)", () => {
      const c = montar();
      c.api._rumTramosResetParaTest();
      const t0 = relojFalso(c, { v: 1000 });
      c.api._ab1Diferir("tick.widget.conducta", () => { t0.v = 1240; });   // 240 ms
      const anillo = c.api._rumTramosParaTest();
      t.igual(anillo.length, 1, "la fase cara quedó anotada");
      t.igual(anillo[0].f, "tick.widget.conducta", "con la MISMA etiqueta que usaba el tick: A y B miden lo mismo");
      t.cierto(anillo[0].ms >= 200, "con su costo real");
    });

    t.caso("toggle encendido — el barrido se difiere al hueco, no corre en línea", () => {
      const c = montar();
      identidad(c, "DOC-1");
      t.cierto(c.api.togSet("tog_ab1_diferir", true) === true, "el médico enciende la variante B");
      let pedido = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido = { cb, opts }; return 1; };
      let corrido = 0;
      c.api._ab1Diferir("tick.widget.conducta", () => { corrido++; });
      t.igual(corrido, 0, "al volver NO ha corrido: quedó esperando el hueco");
      t.cierto(!!pedido, "pasó por requestIdleCallback");
      t.igual(pedido.opts.timeout, 700, "con el tope de 700 ms del barrido diferido");
    });

    await t.casoAsync("al correr el rIC con contexto válido — ejecuta y libera el pendiente", async () => {
      const c = montar();
      identidad(c, "DOC-2");
      c.api.togSet("tog_ab1_diferir", true);
      let pedido = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido = { cb, opts }; return 1; };
      let corrido = 0;
      c.api._ab1Diferir("tick.cosecha", () => { corrido++; }, () => true);
      t.cierto(!!pedido, "encolado");
      pedido.cb();
      t.igual(corrido, 1, "el hueco llegó, el contexto sigue válido y el barrido corre");
      let pedido2 = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido2 = { cb, opts }; return 1; };
      c.api._ab1Diferir("tick.cosecha", () => { corrido++; }, () => true);
      t.cierto(!!pedido2, "y al liberarse, la vuelta siguiente puede encolar de nuevo");
      pedido2.cb();
      t.igual(corrido, 2, "segundo barrido ejecutado");
    });

    t.caso("ctx inválido al correr — se descarta: jamás cosecha al paciente equivocado", () => {
      const c = montar();
      identidad(c, "DOC-3");
      c.api.togSet("tog_ab1_diferir", true);
      let pedido = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido = { cb, opts }; return 1; };
      let corrido = 0;
      // el médico navegó a OTRO paciente entre el encolado y el hueco
      c.api._ab1Diferir("tick.cosecha", () => { corrido++; }, () => false);
      t.cierto(!!pedido, "encolado con el paciente A a la vista");
      pedido.cb();
      t.igual(corrido, 0, "el barrido se descarta: no cosecha al paciente equivocado");
      let pedido2 = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido2 = { cb, opts }; return 1; };
      c.api._ab1Diferir("tick.cosecha", () => { corrido++; }, () => true);
      t.cierto(!!pedido2, "el descarte liberó la etiqueta: el tick del contexto nuevo encola su cosecha");
    });

    t.caso("ctxValido que lanza — se trata como inválido y se descarta sin romper nada", () => {
      const c = montar();
      identidad(c, "DOC-4");
      c.api.togSet("tog_ab1_diferir", true);
      let pedido = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido = { cb, opts }; return 1; };
      let corrido = 0;
      c.api._ab1Diferir("tick.widget.farmaco", () => { corrido++; }, () => { throw new Error("DOM roto"); });
      t.cierto(!!pedido, "encolado");
      t.noLanza(() => pedido.cb(), "el hueco no lanza aunque el re-check falle");
      t.igual(corrido, 0, "y el barrido se descarta, como ante un contexto inválido");
    });

    t.caso("anti-duplicado por etiqueta — una sola cosecha pendiente por vuelta", () => {
      const c = montar();
      identidad(c, "DOC-5");
      c.api.togSet("tog_ab1_diferir", true);
      let pedidos = 0;
      let ultimo = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedidos++; ultimo = { cb, opts }; return 1; };
      let corrido = 0;
      const barrido = () => { corrido++; };
      c.api._ab1Diferir("tick.cosecha", barrido, () => true);
      c.api._ab1Diferir("tick.cosecha", barrido, () => true);
      c.api._ab1Diferir("tick.cosecha", barrido, () => true);
      t.igual(pedidos, 1, "tres vueltas del tick con la cosecha sin correr: UN solo barrido esperando");
      t.igual(corrido, 0, "y ninguno corrió aún");
      ultimo.cb();
      t.igual(corrido, 1, "el pendiente corre una única vez");
      c.api._ab1Diferir("tick.cosecha", barrido, () => true);
      t.igual(pedidos, 2, "y la vuelta siguiente (ya ejecutado el anterior) encola otra vez: nunca se pierde una vuelta entera");
    });

    await t.casoAsync("las etiquetas distintas no se pisan entre sí — cada barrido tiene su hueco", async () => {
      const c = montar();
      identidad(c, "DOC-6");
      c.api.togSet("tog_ab1_diferir", true);
      let pedidos = 0;
      c.ctx.requestIdleCallback = (cb, opts) => { pedidos++; return 1; };
      let corrido = [];
      const guarda = (n) => () => { corrido.push(n); };
      c.api._ab1Diferir("tick.widget.conducta", guarda("conducta"), () => true);
      c.api._ab1Diferir("tick.widget.conducta", guarda("conducta"), () => true);
      c.api._ab1Diferir("tick.widget.ordenar", guarda("ordenar"), () => true);
      c.api._ab1Diferir("tick.cosecha", guarda("cosecha"), () => true);
      c.api._ab1Diferir("tick.cosecha.sub", guarda("cosecha.sub"), () => true);
      t.igual(pedidos, 4, "una cola por etiqueta: el duplicado de conducta se funde, las demás conviven");
      t.igual(corrido.length, 0, "ninguno corrió en línea");
    });

    await t.casoAsync("sin requestIdleCallback cae al temporizador — el barrido no se pierde", async () => {
      const c = montar();
      identidad(c, "DOC-7");
      c.api.togSet("tog_ab1_diferir", true);
      c.ctx.requestIdleCallback = undefined;
      let corrido = 0;
      c.api._ab1Diferir("tick.widget.rcvpendientes", () => { corrido++; }, () => true);
      t.igual(corrido, 0, "sin hueco de inactividad disponible no corre en línea: espera el temporizador");
      await esperar(20);      // el arnés recorta el setTimeout(700) a ~1 ms
      t.igual(corrido, 1, "y el temporizador lo acaba corriendo: el trabajo nunca se pierde");
    });

    await t.casoAsync("si requestIdleCallback revienta, idleRun cae a su temporizador — sigue sin perderse", async () => {
      const c = montar();
      identidad(c, "DOC-8");
      c.api.togSet("tog_ab1_diferir", true);
      c.ctx.requestIdleCallback = () => { throw new Error("sin huecos"); };
      let corrido = 0;
      c.api._ab1Diferir("tick.cosecha", () => { corrido++; }, () => true);
      t.igual(corrido, 0, "el fallo se captura en idleRun: ni corre en línea ni revienta la vuelta del tick");
      await esperar(20);
      t.igual(corrido, 1, "y su temporizador lo acaba corriendo igual");
    });

    t.caso("red de seguridad última de la puerta: si HASTA el temporizador falla, corre ya en línea", () => {
      const c = montar();
      identidad(c, "DOC-8");
      c.api.togSet("tog_ab1_diferir", true);
      c.ctx.requestIdleCallback = () => { throw new Error("sin huecos"); };
      const setTimeoutOriginal = c.env.win.setTimeout;
      c.env.win.setTimeout = () => { throw new Error("sin temporizador"); };
      try {
        let corrido = 0;
        c.api._ab1Diferir("tick.cosecha", () => { corrido++; }, () => true);
        t.igual(corrido, 1, "requestIdleCallback y setTimeout reventaron y el barrido se ejecutó igual, en línea: el trabajo nunca se pierde");
      } finally {
        c.env.win.setTimeout = setTimeoutOriginal;
      }
    });

    t.caso("toggle encendido + rIC — al correr, la etiqueta RUM anilla la misma cubeta (modo B)", () => {
      const c = montar();
      identidad(c, "DOC-9");
      c.api.togSet("tog_ab1_diferir", true);
      c.api._rumTramosResetParaTest();
      let pedido = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido = { cb, opts }; return 1; };
      const t0 = relojFalso(c, { v: 1000 });
      c.api._ab1Diferir("tick.cosecha", () => { t0.v = 1260; }, () => true);   // 260 ms
      pedido.cb();
      const anillo = c.api._rumTramosParaTest();
      t.igual(anillo.length, 1, "el barrido corrido en el hueco quedó anotado");
      t.igual(anillo[0].f, "tick.cosecha", "con la misma etiqueta que en modo A: los dos brazos del experimento miden igual");
    });

    // =================================================================
    //  BLOQUE 2 — el enganche real en el código vivo
    // =================================================================

    t.caso("estructura: el toggle AB-1 está registrado y nace apagado (defecto:false)", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const i = s.indexOf('k: "tog_ab1_diferir"');
      t.cierto(i >= 0, "el toggle tog_ab1_diferir existe en el registro");
      if (i >= 0) {
        const fin = s.indexOf("\n", i);
        const linea = s.slice(i, fin > 0 ? fin : i + 300);
        t.cierto(linea.indexOf("defecto: false") >= 0, "y nace apagado: variante A (comportamiento histórico) para todos");
        t.cierto(linea.indexOf("Barridos diferidos") >= 0, "con su etiqueta visible en Ajustes");
      }
    });

    t.caso("estructura: la puerta existe con anti-duplicado y re-chequeo de contexto", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      t.cierto(s.indexOf("function _ab1Diferir(nombre, fn, ctxValido)") >= 0, "función _ab1Diferir declarada");
      t.cierto(s.indexOf("_ab1Pendientes[nombre]) return;") >= 0, "anti-duplicado por etiqueta presente");
      t.cierto(s.indexOf("ctxValido && !ctxValido()") >= 0, "el contexto se re-evalúa AL CORRER");
      t.cierto(s.indexOf("togActiva(\"tog_ab1_diferir\") !== true") >= 0, "toggle apagado → ejecución en línea");
    });

    t.caso("estructura: los 6 barridos del tick pasan por la puerta con sus etiquetas históricas", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const esperadas = [
        '_ab1Diferir("tick.widget.conducta"',
        '_ab1Diferir("tick.widget.ordenar"',
        '_ab1Diferir("tick.widget.farmaco"',
        '_ab1Diferir("tick.widget.rcvpendientes"',
        '_ab1Diferir("tick.cosecha"',
        '_ab1Diferir("tick.cosecha.sub"',
      ];
      for (const ancla of esperadas) {
        t.cierto(s.indexOf(ancla) >= 0, "el tick encola " + ancla.slice(13, -1) + " por la puerta AB-1");
      }
      t.cierto(s.indexOf("seccionActiva() === \"historia\"") >= 0, "los widgets re-validan que la historia sigue abierta al correr");
      t.cierto(s.indexOf('_rumTramo("tick.cosecha"') < 0, "sin restos del patrón viejo: la cosecha ya no corre con RUM directo en línea");
    });

    t.caso("estructura: el repintado se mide con nombre propio y el barrido NO crítico no toca lo crítico", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      let n = 0, desde = 0;
      while (true) {
        const i = s.indexOf('_rumTramo("tick.render"', desde);
        if (i < 0) break;
        n++; desde = i + 1;
      }
      t.igual(n, 2, "las dos ramas del repintado (vista vigilada y caché) corren medidas como tick.render");
      t.cierto(s.indexOf("El procesado de la agenda, el pintado del panel y los avisos jamás se difieren") >= 0,
        "la descripción del toggle garantiza lo crítico en su camino de siempre");
    });
  },
};
