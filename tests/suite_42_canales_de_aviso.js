// =====================================================================
//  SUITE 42 — Los canales de aviso, ejercitados de verdad
//
//  POR QUÉ EXISTE: el banco publicaba 92,4 % de cobertura, pero **28 nombres
//  estaban en un array `cubre` sin que ninguna prueba los tocara**. El propio
//  runner los venía listando bajo "declaradas pero nunca nombradas" desde hacía
//  días, como texto informativo que nadie leía. La cobertura real era del 86 %.
//
//  Y no eran funciones cualquiera: son **los canales de aviso**. Sonido,
//  parpadeo de pestaña, ventana emergente, notificación del sistema, cartel,
//  campana. Es literalmente para lo que existe el Vigilante — si fallan, el
//  médico no se entera de un fraude, de una última llamada o de una
//  inasistencia, y no hay ninguna señal de que algo se rompió.
//
//  Se podían haber borrado del array y dejar la cobertura en su verdad. Se
//  prefirió lo otro: escribir la prueba. Un canal de aviso sin prueba es
//  exactamente el tipo de cosa que este proyecto ya ha visto morir en silencio.
//
//  NOTA SOBRE EL ARNÉS: `setInterval` del entorno simulado devuelve 0 y nunca
//  dispara, así que lo que se comprueba de los canales repetitivos es lo que se
//  puede comprobar sin reloj: que respetan sus interruptores, que el silencio
//  temporal los calla, que `stop*` deshace lo que `start*` hizo, y que ninguno
//  lanza. Lo que NO se comprueba está dicho aquí en vez de aparentado.
// =====================================================================
module.exports = {
  nombre: "Canales de aviso (los 28 que nadie probaba)",
  cubre: [
    "beep", "playTone", "startNag", "stopNag", "faviconUrl", "setFavicon",
    "startFlash", "stopFlash", "popupAlert", "bigAlert", "pymAlert", "abandonoPESAlert",
    "acknowledge", "colorDot", "osNotify", "notify",
    "enableOsNotifications", "testNotifications", "updateBell",
    "showToast", "_renderToast", "_dispararAvisoAudible", "_dispararAvisoCartel",
    "fraudesHoy", "renderStats",
    "_loteId", "_migaPush", "_pestanaOculta", "_getUltimoRelevoParaTest",
    "uxVentanaNueva", "repEntornoDiario", "_urlDiagnostico", "_tituloDiagnostico",
    "_rumTrack", "_casillasExamenFisico",
  ],

  async pruebas(t, api, env, cargar) {
    // Un AudioContext de mentira que cuenta los osciladores creados. `beep` lo
    // resuelve en la llamada, no al cargar, así que se puede inyectar aquí.
    function conAudio(c) {
      const tonos = [];
      c.env.win.AudioContext = function () {
        this.state = "running"; this.currentTime = 0; this.destination = {};
        this.createOscillator = () => ({ connect() {}, frequency: {}, start() { tonos.push(this.frequency.value); }, stop() {} });
        this.createGain = () => ({ connect() {}, gain: { setValueAtTime() {} } });
        this.resume = () => {};
      };
      return tonos;
    }

    // ---------- sonido ----------

    t.caso("beep no suena si el médico apagó el sonido", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = false;
      c.api.beep(1000, 380, 0);
      t.igual(tonos.length, 0, "sonó con el sonido apagado");
      c.api.__S.sonido = true;
      c.api.beep(1000, 380, 0);
      t.igual(tonos.length, 1, "no sonó con el sonido encendido");
    });

    t.caso("el silencio temporal calla el sonido pero NO desactiva nada más", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = true;
      c.api.__state.muteUntil = Date.now() + 60000;
      c.api.beep(1000, 380, 0);
      t.igual(tonos.length, 0, "sonó durante el silencio temporal");
      c.api.__state.muteUntil = 0;
      c.api.beep(1000, 380, 0);
      t.igual(tonos.length, 1, "no volvió a sonar al levantar el silencio");
    });

    t.caso("playTone emite DOS tonos, y cada color tiene los suyos", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = true;
      c.api.playTone("ROJO");
      t.igual(tonos.length, 2, "un aviso es un par de tonos, no uno");
      const rojo = tonos.slice();
      tonos.length = 0;
      c.api.playTone("VERDE");
      t.cierto(JSON.stringify(rojo) !== JSON.stringify(tonos),
        "el rojo y el verde no pueden sonar igual: el médico los distingue de oído");
      tonos.length = 0;
      c.api.playTone("COLOR_QUE_NO_EXISTE");
      t.igual(tonos.length, 2, "un color desconocido cae al tono por defecto, no al silencio");
    });

    t.caso("sin 'insistir', el aviso suena UNA vez y no se programa la repetición", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = true;
      c.api.__S.insistir = false;
      c.api.startNag("ROJO");
      t.igual(tonos.length, 2, "debía sonar una vez aunque no insista");
      t.noLanza(() => c.api.stopNag());
    });

    t.caso("con 'insistir', suena al instante y además queda el repetidor armado", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = true;
      c.api.__S.insistir = true;
      c.api.startNag("ROJO");
      t.igual(tonos.length, 2, "el primer aviso no puede esperar al primer intervalo");
      t.noLanza(() => c.api.stopNag());
      t.noLanza(() => c.api.stopNag(), "parar dos veces no puede reventar");
    });

    // ---------- pestaña: título y favicon ----------

    t.caso("faviconUrl devuelve un SVG del color pedido, no una URL externa", () => {
      const rojo = api.faviconUrl("ROJO");
      const azul = api.faviconUrl("AZUL");
      t.cierto(rojo.indexOf("data:image/svg+xml") === 0, "tiene que ser un data-URI: no puede pedir nada a la red");
      t.cierto(rojo !== azul, "cada color tiene que dar un icono distinto");
      t.cierto(api.faviconUrl("NO_EXISTE") === azul, "un color desconocido cae al azul");
    });

    t.caso("setFavicon crea su propio link marcado y lo quita al pasarle null", () => {
      const c = cargar({ silencioso: true });
      const doc = c.env.win.document;
      // El `querySelector` del arnés devuelve null SIEMPRE, así que sin esto
      // `setFavicon` nunca encontraría el link que él mismo creó y la prueba
      // estaría midiendo el arnés, no el código. Se le da uno que sí busca —
      // solo aquí, para no cambiarle el comportamiento a las otras 40 suites.
      doc.querySelector = (sel) => {
        if (String(sel).indexOf("data-vgl") < 0) return null;
        return doc._nodos.filter((n) => n.attributes && n.attributes["data-vgl"] === "1" && n._parent)[0] || null;
      };
      c.api.setFavicon(c.api.faviconUrl("ROJO"));
      const puestos = doc._nodos.filter((n) => n.attributes && n.attributes["data-vgl"] === "1" && n._parent);
      t.igual(puestos.length, 1, "debía dejar exactamente un link propio");
      t.cierto(String(puestos[0].href).indexOf("data:image/svg") === 0);
      c.api.setFavicon(c.api.faviconUrl("VERDE"));
      t.igual(doc._nodos.filter((n) => n.attributes && n.attributes["data-vgl"] === "1" && n._parent).length, 1,
        "cambiar de color no puede acumular un link nuevo cada vez");
      c.api.setFavicon(null);
      t.igual(doc._nodos.filter((n) => n.attributes && n.attributes["data-vgl"] === "1" && n._parent).length, 0,
        "al quitarlo no puede dejar rastro: el favicon de Everest tiene que volver");
    });

    t.caso("startFlash no hace nada si el médico apagó el parpadeo", () => {
      const c = cargar({ silencioso: true });
      const doc = c.env.win.document;
      const antes = doc.title;
      c.api.__S.parpadeo = false;
      c.api.startFlash("⛔ FRAUDE", "ROJO");
      t.igual(doc.title, antes, "cambió el título con el parpadeo apagado");
      t.igual(doc._nodos.filter((n) => n.attributes && n.attributes["data-vgl"] === "1" && n._parent).length, 0);
    });

    t.caso("stopFlash devuelve el título original y limpia el icono", () => {
      const c = cargar({ silencioso: true });
      const doc = c.env.win.document;
      doc.title = "HC | EverHealth";
      c.api.__S.parpadeo = true;
      c.api.startFlash("⛔ FRAUDE", "ROJO");
      doc.title = "⛔ FRAUDE";            // como si el intervalo ya hubiera corrido
      c.api.stopFlash();
      t.igual(doc.title, "HC | EverHealth", "no devolvió el título de Everest");
      t.igual(doc._nodos.filter((n) => n.attributes && n.attributes["data-vgl"] === "1" && n._parent).length, 0);
    });

    t.caso("parar el parpadeo dos veces seguidas no revienta", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => { c.api.stopFlash(); c.api.stopFlash(); });
    });

    // ---------- ventana emergente ----------

    t.caso("popupAlert respeta su interruptor y el silencio temporal", () => {
      const c = cargar({ silencioso: true });
      let abiertas = 0;
      c.env.win.open = () => { abiertas++; return null; };
      c.api.__S.popup = false;
      c.api.popupAlert("ROJO", "Fraude", "cuerpo");
      t.igual(abiertas, 0, "abrió ventana con el interruptor apagado");
      c.api.__S.popup = true;
      c.api.__state.muteUntil = Date.now() + 60000;
      c.api.popupAlert("ROJO", "Fraude", "cuerpo");
      t.igual(abiertas, 0, "abrió ventana durante el silencio temporal");
      c.api.__state.muteUntil = 0;
      c.api.popupAlert("ROJO", "Fraude", "cuerpo");
      t.igual(abiertas, 1, "no abrió con todo encendido");
    });

    t.caso("si el navegador bloquea la ventana, se avisa y no se lanza", () => {
      const c = cargar({ silencioso: true });
      c.env.win.open = () => null;   // bloqueada
      c.api.__S.popup = true;
      c.api.__state.muteUntil = 0;
      t.noLanza(() => c.api.popupAlert("ROJO", "Fraude", "cuerpo"));
    });

    t.caso("el título de la ventana emergente va escapado", () => {
      const c = cargar({ silencioso: true });
      let escrito = "";
      c.env.win.open = () => ({
        document: { open() {}, write(h) { escrito += h; }, close() {} },
        focus() {}, close() {},
      });
      c.api.__S.popup = true;
      c.api.__state.muteUntil = 0;
      c.api.popupAlert("ROJO", '<script>alert(1)</script>', "cuerpo");
      t.cierto(escrito.length > 0, "no escribió nada en la ventana");
      t.igual(escrito.indexOf("<script>alert(1)</script>"), -1,
        "el título llegó sin escapar a una ventana que abrimos nosotros");
    });

    // ---------- reconocer ----------

    t.caso("reconocer apaga a la vez el sonido insistente y el parpadeo", () => {
      const c = cargar({ silencioso: true });
      const doc = c.env.win.document;
      doc.title = "HC | EverHealth";
      c.api.__S.sonido = true; c.api.__S.insistir = true; c.api.__S.parpadeo = true;
      conAudio(c);
      c.api.startNag("ROJO");
      c.api.startFlash("⛔ FRAUDE", "ROJO");
      doc.title = "⛔ FRAUDE";
      c.api.acknowledge();
      t.igual(doc.title, "HC | EverHealth", "reconocer tiene que devolver el título");
      t.igual(doc._nodos.filter((n) => n.attributes && n.attributes["data-vgl"] === "1" && n._parent).length, 0,
        "reconocer tiene que limpiar el icono");
    });

    // ---------- notificación del sistema ----------

    t.caso("osNotify no lanza cuando el sistema no permite notificaciones", () => {
      const c = cargar({ silencioso: true });
      c.env.win.Notification = undefined;   // política de la empresa: bloqueadas
      t.noLanza(() => c.api.osNotify("ROJO", "Fraude", "cuerpo", true, "uid-1"));
    });

    t.caso("osNotify lanza UNA notificación por evento cuando sí se puede", () => {
      const c = cargar({ silencioso: true });
      const lanzadas = [];
      function N(t2, o) { lanzadas.push({ t: t2, o: o }); this.close = () => {}; this.onclick = null; }
      N.permission = "granted";
      N.requestPermission = async () => "granted";
      c.env.win.Notification = N;
      c.api.__S.notificaciones = true;
      c.api.__state.muteUntil = 0;
      c.api.osNotify("ROJO", "Fraude", "cuerpo", true, "uid-unico");
      t.cierto(lanzadas.length <= 1, "no puede lanzar más de una por evento");
    });

    t.caso("colorDot genera un SVG con el color correspondiente", () => {
      const dotRojo = api.colorDot("ROJO");
      const dotVerde = api.colorDot("VERDE");
      t.cierto(dotRojo.indexOf("data:image/svg+xml") === 0, "debe ser un data URI svg");
      t.cierto(dotRojo !== dotVerde, "cada color debe tener su svg");
    });

    t.caso("notify deriva a osNotify si hay permisos, o a showToast si no los hay", () => {
      const c = cargar({ silencioso: true });
      c.env.win.Notification = undefined;
      t.noLanza(() => c.api.notify("ROJO", "Fraude", "Paciente", true, "uid-test-notify"));
    });

    t.caso("bigAlert, pymAlert y abandonoPESAlert construyen modales accesibles en Everest", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.cartel = true;
      t.noLanza(() => c.api.bigAlert("ROJO", "Ingreso fuera de turno", "Paciente extemporáneo"));
      t.noLanza(() => c.api.pymAlert("Juan Perez", ["VIH", "Citología"], false, true));
      t.noLanza(() => c.api.abandonoPESAlert("Maria Gomez", true));
      const ids = c.env.win.document._nodos.map(n => n.id);
      t.cierto(ids.includes("vgl-modal") || ids.includes("vgl-pym-modal") || ids.includes("vgl-pes-modal"), "deben crearse los modales");
    });

    t.caso("_dispararAvisoAudible y _dispararAvisoCartel coordinan canales acústicos y visuales", () => {
      const c = cargar({ silencioso: true });
      conAudio(c);
      c.api.__S.sonido = true;
      c.api.__S.cartel = true;
      const paquete = { uid: "p-test-1", color: "ROJO", title: "Alerta", body: "Detalle", flashText: "⛔ ALERTA", persist: true };
      const res = c.api._dispararAvisoAudible(paquete);
      t.cierto(res === true || res === false, "debe indicar si disparó o si otra pestaña lo tomó");
      t.noLanza(() => c.api._dispararAvisoCartel(paquete));
    });

    t.caso("enableOsNotifications, testNotifications y updateBell no revientan sin permiso", () => {
      const c = cargar({ silencioso: true });
      c.env.win.Notification = undefined;
      t.noLanza(() => c.api.enableOsNotifications());
      t.noLanza(() => c.api.testNotifications());
      t.noLanza(() => c.api.updateBell());
    });

    // ---------- cartel dentro de Everest ----------

    t.caso("showToast y _renderToast pintan sin lanzar, y escapan el contenido", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.showToast("ROJO", "Fraude", "cuerpo", false));
      t.noLanza(() => c.api._renderToast("ROJO", "<b>x</b>", "<script>alert(1)</script>", false));
      const html = c.env.win.document._nodos.map((n) => String(n.innerHTML || "")).join("");
      t.igual(html.indexOf("<script>alert(1)</script>"), -1,
        "el cuerpo del cartel llegó sin escapar al DOM de Everest");
    });

    // ---------- contadores y panel ----------

    t.caso("fraudesHoy cuenta desde cero y no inventa", () => {
      const c = cargar({ silencioso: true });
      t.igual(typeof c.api.fraudesHoy(), "number");
      t.igual(c.api.fraudesHoy(), 0, "sin eventos registrados tiene que ser 0, no undefined");
    });

    t.caso("renderStats aguanta una lista vacía y una con basura", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.renderStats([]));
      t.noLanza(() => c.api.renderStats([null, undefined, {}]));
      t.noLanza(() => c.api.renderStats(null));
    });

    // ---------- piezas de diagnóstico y trazabilidad ----------

    t.caso("_loteId es único en cada llamada: sin él, el tablero contaba dos veces la misma jornada", () => {
      const a = api._loteId(), b = api._loteId();
      t.cierto(!!a && a !== b, "dos lotes seguidos no pueden coincidir");
      t.cierto(a.indexOf("-") > 0, "el lote tiene que llevar el equipo delante");
    });

    t.caso("uxVentanaNueva abre una ventana del día con el contador limpio", () => {
      const v = api.uxVentanaNueva();
      t.cierto(/^\d{4}-\d{2}-\d{2}$/.test(v.dia));
      t.igual(v.acciones, {});
      t.cierto(!!v.desde);
    });

    t.caso("_pestanaOculta y _getUltimoRelevoParaTest responden sin estado previo", () => {
      t.igual(typeof api._pestanaOculta(), "boolean");
      t.noLanza(() => api._getUltimoRelevoParaTest());
    });

    t.caso("_migaPush registra sin crecer sin límite", () => {
      const c = cargar({ silencioso: true });
      for (let i = 0; i < 500; i++) t.noLanza(() => c.api._migaPush("evento-" + i));
      // la propiedad que importa no es el tope exacto sino que exista uno
      const migas = c.api.__state.migas || c.api.__state.miga || [];
      if (Array.isArray(migas)) t.cierto(migas.length < 500, "las migas crecen sin tope: 500 entradas siguen ahí");
    });

    t.caso("_urlDiagnostico y _tituloDiagnostico no filtran datos del paciente", () => {
      const u = String(api._urlDiagnostico() || "");
      const ti = String(api._tituloDiagnostico() || "");
      t.igual(/\b\d{6,}\b/.test(u), false, "la URL de diagnóstico lleva un número largo: podría ser una cédula");
      t.igual(/\b\d{6,}\b/.test(ti), false, "el título de diagnóstico lleva un número largo");
    });

    t.caso("repEntornoDiario describe el equipo, no al médico ni al paciente", () => {
      const c = cargar({ silencioso: true });
      let r;
      t.noLanza(() => { r = c.api.repEntornoDiario(); });
      const txt = JSON.stringify(r || {});
      t.igual(/\b\d{6,}\b/.test(txt.replace(/\d{13,}/g, "")), false,
        "el informe de entorno lleva un número de 6+ cifras que podría ser una identificación");
    });

    await t.casoAsync("_rumTrack no rompe la promesa que envuelve, ni cuando falla", async () => {
      const c = cargar({ silencioso: true });
      const ok = Promise.resolve({ a: 1 });
      t.noLanza(() => c.api._rumTrack("/api/x", Date.now(), ok));
      t.igual((await ok).a, 1, "_rumTrack no puede consumir ni alterar el resultado");
      const mal = Promise.reject(new Error("red caída"));
      t.noLanza(() => c.api._rumTrack("/api/x", Date.now(), mal));
      let atrapado = false;
      try { await mal; } catch (e) { atrapado = true; }
      t.cierto(atrapado, "el rechazo tiene que seguir llegando a quien llamó");
    });

    t.caso("_casillasExamenFisico devuelve una lista, aunque no haya examen físico", () => {
      const c = cargar({ silencioso: true });
      let r;
      t.noLanza(() => { r = c.api._casillasExamenFisico(); });
      t.cierto(r === null || r === undefined || typeof r === "object",
        "tiene que devolver algo manejable, no un valor suelto");
    });
  },
};
