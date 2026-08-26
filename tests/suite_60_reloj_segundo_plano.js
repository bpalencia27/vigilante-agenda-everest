// =====================================================================
//  SUITE 60 — Reloj de segundo plano (Web Worker) — v14.2.12
//
//  Encargo textual del médico: "busca una solución definitiva para el
//  estrangulamiento de Chrome en pestañas ocultas; para nosotros es
//  importantísima la sincronización casi en tiempo real". De ahí salió este
//  reloj: los temporizadores viven en un Web Worker, que Chrome no estrangula
//  cuando la pestaña está oculta, en vez de en la página.
//
//  Llegó a producción SIN NINGUNA PRUEBA, y no por descuido: el arnés devolvía
//  `0` en setInterval, así que `if (loc.timer)` daba falso siempre y no había
//  forma de distinguir "se creó un temporizador de página" de "no se creó
//  ninguno". Con el arnés ya arreglado (identificadores reales + Worker
//  inyectable), estas son las pruebas que faltaban.
//
//  La propiedad que más importa de todas: PASE LO QUE PASE, el Vigilante NUNCA
//  puede quedarse sin reloj. Si el worker no existe, si muere, o si deja de
//  latir, cada canal tiene que seguir corriendo con SU MISMA cadencia.
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
  // Simula un latido del worker para el canal `id`.
  this.latir = (id) => { if (self.onmessage) self.onmessage({ data: { id } }); };
  // Simula que el navegador mata el worker avisando por onerror.
  this.reventar = (msg) => { if (self.onerror) self.onerror({ message: msg || "worker muerto" }); };
  WorkerFalso.ultimo = this;
}

module.exports = {
  nombre: "Reloj de segundo plano (Web Worker, v14.2.12)",
  cubre: ["_relojCada", "_relojDetener", "_relojDetenerTodo", "_relojIniciar", "_relojDegradar",
          "_relojVigilarWorker", "_relojIniciar", "_relojDegradar", "_relojEstadoParaTest", "_relojAjustarParaTest", "_avisarPestanaDescartada"],

  pruebas(t, api, env, cargar) {
    const conWorker = () => cargar({ silencioso: true, Worker: WorkerFalso });
    const sinWorker = () => cargar({ silencioso: true });
    const canal = (c, id) => c.api._relojEstadoParaTest().locales.find((l) => l.id === id);

    // ---------------- Camino feliz: el worker ----------------
    t.caso("_relojCada con Worker disponible: el canal corre en el worker, no en la página", () => {
      const c = conWorker();
      c.api._relojCada("prueba", 5000, () => {});
      const st = c.api._relojEstadoParaTest();
      t.cierto(st.ok, "el reloj de segundo plano quedó activo");
      t.cierto(st.canales.includes("prueba"), "el canal está registrado");
      t.falso(canal(c, "prueba").enPagina, "no se creó temporizador de página: lo lleva el worker");
      const arranque = WorkerFalso.ultimo.enviados.filter((m) => m.op === "start" && m.id === "prueba");
      t.igual(arranque.length, 1, "se le mandó exactamente una orden de arranque al worker");
      t.igual(arranque[0].ms, 5000, "con la cadencia pedida");
    });

    t.caso("el latido del worker ejecuta la función del canal", () => {
      const c = conWorker();
      let latidos = 0;
      c.api._relojCada("prueba", 5000, () => { latidos++; });
      WorkerFalso.ultimo.latir("prueba");
      WorkerFalso.ultimo.latir("prueba");
      t.igual(latidos, 2, "dos latidos, dos ejecuciones");
    });

    t.caso("un latido para un canal que ya no existe no lanza", () => {
      const c = conWorker();
      c.api._relojCada("prueba", 5000, () => {});
      const w = WorkerFalso.ultimo;
      c.api._relojDetener("prueba");
      t.noLanza(() => w.latir("prueba"), "el latido rezagado de un canal ya detenido se ignora");
      t.noLanza(() => w.latir("jamas-existio"));
    });

    t.caso("si la función de un canal lanza, el reloj sigue vivo y los demás canales no se ven afectados", () => {
      const c = conWorker();
      let buenos = 0;
      c.api._relojCada("malo", 5000, () => { throw new Error("revienta"); });
      c.api._relojCada("bueno", 5000, () => { buenos++; });
      const w = WorkerFalso.ultimo;
      t.noLanza(() => w.latir("malo"), "la excepción del canal queda contenida");
      w.latir("bueno");
      t.igual(buenos, 1, "el otro canal sigue latiendo con normalidad");
      t.cierto(c.api._relojEstadoParaTest().ok, "y el reloj no se degradó por una excepción del canal");
    });

    // ---------------- Reserva: sin worker ----------------
    t.caso("sin Worker en el entorno: cae al reloj de la página con la MISMA cadencia", () => {
      const c = sinWorker();
      c.api._relojCada("prueba", 7000, () => {});
      const st = c.api._relojEstadoParaTest();
      t.falso(st.ok, "no hay reloj de segundo plano");
      t.cierto(st.motivo.length > 0, "y queda dicho por qué: " + st.motivo);
      const l = canal(c, "prueba");
      t.cierto(l.enPagina, "pero SÍ hay temporizador de página: el Vigilante nunca queda sin reloj");
      t.igual(l.ms, 7000, "con la misma cadencia que se pidió");
    });

    // ---------------- Reemplazo y parada ----------------
    t.caso("_relojCada dos veces con el mismo nombre reemplaza el canal, no lo duplica", () => {
      const c = sinWorker();
      let viejo = 0, nuevo = 0;
      c.api._relojCada("prueba", 5000, () => { viejo++; });
      const primerTimer = env.intervalos ? null : null;
      c.api._relojCada("prueba", 9000, () => { nuevo++; });
      const st = c.api._relojEstadoParaTest();
      t.igual(st.canales.filter((x) => x === "prueba").length, 1, "un solo canal con ese nombre");
      t.igual(st.locales.filter((l) => l.id === "prueba").length, 1, "y un solo temporizador");
      t.igual(canal(c, "prueba").ms, 9000, "manda la cadencia nueva");
    });

    t.caso("_relojDetener quita el canal y cancela su temporizador de página", () => {
      const c = sinWorker();
      c.api._relojCada("prueba", 5000, () => {});
      const antes = c.env.intervalos.size;
      const idTimer = [...c.env.intervalos.entries()].filter(([, v]) => v.vivo).map(([k]) => k).pop();
      c.api._relojDetener("prueba");
      const st = c.api._relojEstadoParaTest();
      t.falso(st.canales.includes("prueba"), "el canal desapareció");
      t.falso(st.locales.some((l) => l.id === "prueba"), "y su registro local también");
      t.cierto(antes > 0 && c.env.intervalos.get(idTimer) && !c.env.intervalos.get(idTimer).vivo,
        "el temporizador de página quedó cancelado de verdad, no solo olvidado");
    });

    t.caso("_relojDetener con Worker le manda la orden de parada", () => {
      const c = conWorker();
      c.api._relojCada("prueba", 5000, () => {});
      c.api._relojDetener("prueba");
      const enviados = WorkerFalso.ultimo.enviados;
      const ultimo = enviados[enviados.length - 1];
      t.igual(ultimo.op, "stop", "la última orden que recibe el worker es la de parada");
      t.igual(ultimo.id, "prueba", "y es para ese canal");
      // Nota: _relojCada empieza llamando a _relojDetener(id) para reemplazar un canal
      // previo, así que el worker recibe un "stop" de más antes del "start". Es
      // deliberado e inofensivo (parar un canal inexistente no hace nada); se documenta
      // aquí para que nadie lo lea como un error al contar mensajes.
      t.cierto(enviados.filter((m) => m.op === "start" && m.id === "prueba").length === 1,
        "y solo hubo un arranque para ese canal");
    });

    // ---------------- La propiedad crítica: degradar sin perder cadencia ----------------
    t.caso("si el worker muere, TODOS los canales siguen corriendo en la página con su misma cadencia", () => {
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      c.api._relojCada("lento", 60000, () => {});
      t.cierto(c.api._relojEstadoParaTest().ok, "punto de partida: corriendo en el worker");
      t.falso(canal(c, "agenda").enPagina, "sin temporizador de página todavía");

      WorkerFalso.ultimo.reventar("el navegador lo mató");

      const st = c.api._relojEstadoParaTest();
      t.falso(st.ok, "el reloj de segundo plano se da por caído");
      t.cierto(canal(c, "agenda").enPagina, "'agenda' pasó al reloj de la página");
      t.cierto(canal(c, "lento").enPagina, "'lento' también: no se pierde ningún canal");
      t.igual(canal(c, "agenda").ms, 5000, "y cada uno conserva SU cadencia");
      t.igual(canal(c, "lento").ms, 60000);
    });

    t.caso("_relojDetenerTodo termina el worker y no deja ningún canal ni temporizador vivo", () => {
      const c = conWorker();
      c.api._relojCada("a", 5000, () => {});
      c.api._relojCada("b", 5000, () => {});
      const w = WorkerFalso.ultimo;
      c.api._relojDetenerTodo();
      const st = c.api._relojEstadoParaTest();
      t.igual(st.canales, [], "sin canales");
      t.igual(st.locales, [], "sin temporizadores locales");
      t.cierto(w.terminado, "el worker se terminó de verdad");
      t.falso(st.ok);
    });

    t.caso("_relojIniciar es idempotente: llamarlo con el reloj ya en pie no crea un segundo worker", () => {
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      const w1 = WorkerFalso.ultimo;
      t.cierto(c.api._relojIniciar(), "devuelve true: ya está en pie");
      t.cierto(WorkerFalso.ultimo === w1, "y sigue siendo el mismo worker, no se creó otro");
      t.falso(w1.terminado, "sin terminar el que ya estaba");
    });

    t.caso("_relojIniciar sin Worker en el entorno devuelve false y deja dicho el motivo", () => {
      const c = sinWorker();
      t.falso(c.api._relojIniciar(), "no puede arrancar");
      const st = c.api._relojEstadoParaTest();
      t.falso(st.ok);
      t.cierto(/Worker/i.test(st.motivo), "el motivo nombra la causa real: " + st.motivo);
    });

    t.caso("_relojDegradar llamado a mano (worker muerto en silencio, sin onerror) baja todos los canales a la página", () => {
      // El worker puede morir sin avisar: ahí no hay onerror y quien degrada es el perro
      // guardián llamando a esta función. Se prueba la función por sí sola.
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      c.api._relojCada("lento", 60000, () => {});
      const w = WorkerFalso.ultimo;
      c.api._relojDegradar();
      t.cierto(w.terminado, "se termina el worker por si seguía a medio morir");
      const st = c.api._relojEstadoParaTest();
      t.falso(st.ok);
      t.cierto(canal(c, "agenda").enPagina && canal(c, "lento").enPagina, "los dos canales pasan a la página");
      t.igual(canal(c, "lento").ms, 60000, "conservando su cadencia");
      t.cierto(st.motivo.length > 0, "y queda constancia del motivo");
    });

    // ---------------- El perro guardián ----------------
    t.caso("el perro guardián NO resucita el reloj después de _relojDetenerTodo (kill-switch)", () => {
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      c.api._relojDetenerTodo();
      // Escenario del kill-switch: pestaña visible, hace rato, y sin latidos.
      c.env.doc.visibilityState = "visible";
      c.api._relojAjustarParaTest({ visibleDesde: Date.now() - 600000, ultimoLatidoWorker: Date.now() - 600000 });
      t.falso(c.api._relojVigilarWorker(), "el guardián se abstiene: no hay reloj que vigilar");
      t.igual(c.api._relojEstadoParaTest().canales, [], "y no revive ningún canal");
    });

    t.caso("el perro guardián no degrada con la pestaña oculta (ahí los temporizadores están estrangulados a propósito)", () => {
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      c.env.doc.visibilityState = "hidden";
      c.api._relojAjustarParaTest({ visibleDesde: Date.now() - 600000, ultimoLatidoWorker: Date.now() - 600000 });
      t.falso(c.api._relojVigilarWorker(), "sin falsa alarma con la pestaña oculta");
      t.cierto(c.api._relojEstadoParaTest().ok, "el reloj de segundo plano sigue en pie");
    });

    t.caso("el perro guardián no degrada si el worker latió hace poco", () => {
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      c.env.doc.visibilityState = "visible";
      c.api._relojAjustarParaTest({ visibleDesde: Date.now() - 600000, ultimoLatidoWorker: Date.now() - 1000 });
      t.falso(c.api._relojVigilarWorker(), "latido de hace 1 s: todo bien");
      t.cierto(c.api._relojEstadoParaTest().ok);
    });

    t.caso("el perro guardián no degrada en el primer minuto tras volver a la pestaña (evita la falsa alarma al despertar)", () => {
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      c.env.doc.visibilityState = "visible";
      c.api._relojAjustarParaTest({ visibleDesde: Date.now() - 5000, ultimoLatidoWorker: Date.now() - 600000 });
      t.falso(c.api._relojVigilarWorker(), "recién vuelta a la vista: se le da margen");
      t.cierto(c.api._relojEstadoParaTest().ok);
    });

    t.caso("el perro guardián SÍ degrada tras más de un minuto sin latido con la pestaña a la vista", () => {
      const c = conWorker();
      c.api._relojCada("agenda", 5000, () => {});
      c.env.doc.visibilityState = "visible";
      c.api._relojAjustarParaTest({ visibleDesde: Date.now() - 600000, ultimoLatidoWorker: Date.now() - 600000 });
      t.cierto(c.api._relojVigilarWorker(), "el guardián actúa");
      const st = c.api._relojEstadoParaTest();
      t.falso(st.ok, "el worker se da por muerto");
      t.cierto(canal(c, "agenda").enPagina, "y la agenda sigue latiendo desde la página: nunca sin reloj");
    });

    // =====================================================================
    // v14.2.12 — _avisarPestanaDescartada: hermana de este mismo problema (Chrome
    // estrangulando/pausando pestañas ocultas para ahorrar memoria), pero un escalón
    // más severo — Chrome no solo pausó los temporizadores, DESCARTÓ la pestaña entera
    // (document.wasDiscarded) y nada corrió mientras tanto, ni siquiera el reloj de
    // este archivo. Aquí solo se anota (contador anónimo) y se sugiere, una vez al
    // día, la única solución real de ese lado: la excepción de Chrome que mantiene
    // siempre activo el sitio.
    // =====================================================================
    t.caso("_avisarPestanaDescartada: si la pestaña NO fue descartada, no hace nada y no toca el contador", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._avisarPestanaDescartada(), false);
      c.api._uxVolcarBuffer();
      t.igual(c.env.storage.getItem("vgl_ux"), null, "sin descarte, ni se llama a uxTrack");
      t.igual(c.env.storage.getItem("vgl_descarte_aviso_dia"), null);
    });

    t.caso("_avisarPestanaDescartada: con la pestaña descartada, avisa, anota el contador y marca el día", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.wasDiscarded = true;
      t.igual(c.api._avisarPestanaDescartada(), true);
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux"));
      t.igual(ux.acciones["pestana.descartada"], 1);
      t.cierto(!!c.env.storage.getItem("vgl_descarte_aviso_dia"), "queda marcado el día del aviso");
    });

    t.caso("_avisarPestanaDescartada: el CONTADOR sigue subiendo cada vez, aunque el CARTEL solo se sugiera una vez al día", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.wasDiscarded = true;
      let marcasEscritas = 0;
      const setItemReal = c.env.storage.setItem.bind(c.env.storage);
      c.env.storage.setItem = (k, v) => { if (k === "vgl_descarte_aviso_dia") marcasEscritas++; return setItemReal(k, v); };
      c.api._avisarPestanaDescartada();
      const r2 = c.api._avisarPestanaDescartada();
      const r3 = c.api._avisarPestanaDescartada();
      t.igual(r2, true, "sigue devolviendo true: SÍ fue descartada, aunque el cartel ya se haya mostrado hoy");
      t.igual(r3, true);
      c.api._uxVolcarBuffer();
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux"));
      t.igual(ux.acciones["pestana.descartada"], 3, "el conteo anónimo no se dedupe: cada vuelta de un descarte real cuenta");
      t.igual(marcasEscritas, 1, "la marca del día del cartel solo se ESCRIBE una vez: las 2 llamadas siguientes cortan antes de llegar a escribirla (prueba directa del dedupe, no solo de que el valor final coincide)");
    });

    t.caso("_avisarPestanaDescartada: si falla el almacén (localStorage), no revienta hacia afuera", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.wasDiscarded = true;
      c.env.storage.getItem = () => { throw new Error("almacén no disponible"); };
      let r;
      t.noLanza(() => { r = c.api._avisarPestanaDescartada(); });
      t.igual(r, true, "sigue reportando que SÍ hubo descarte, aunque no pudo consultar el candado de una vez al día");
    });

  },
};
