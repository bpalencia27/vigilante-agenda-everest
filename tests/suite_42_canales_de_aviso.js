const esperar42 = (ms) => new Promise((r) => setTimeout(r, ms));   // v18.0.113
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
    "startFlash", "stopFlash", "bigAlert", "_notificarSistema",
    "acknowledge", "colorDot", "osNotify", "notify",
    "enableOsNotifications", "testNotifications", "updateBell",
    "showToast", "_renderToast", "_dispararAvisoAudible", "_dispararAvisoCartel",
    "fraudesHoy", "renderStats",
    "_loteId", "_migaPush", "_pestanaOculta", "_pestanaSinAtencion", "_getUltimoRelevoParaTest",
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

    t.caso("el silencio temporal calla el sonido, y se levanta solo al vencer", () => {
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

    // v17.19.0 — DECISIÓN DEL MÉDICO (28-ago): antes "Silenciar 15 min" solo callaba el
    // tono (arriba) — el toast y la notificación de Windows seguían saliendo igual, que
    // es justo el ruido que pidió apagar. Ahora los tres canales obedecen muteUntil.
    t.caso("v17.19.0: el silencio temporal también calla el toast y la notificación de Windows, no solo el tono", () => {
      const c = cargar({ silencioso: true });
      conAudio(c);
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.win.document.visibilityState = "hidden";   // el canal candidato es el de Windows
      c.api.__S.sonido = true;
      c.api.__state.muteUntil = Date.now() + 60000;

      const res = c.api._dispararAvisoAudible({ uid: "mute-1", color: "AMBAR", title: "t", body: "b", flashText: "f", persist: false });
      t.cierto(res, "sigue devolviendo true: la cola de cartel pendiente no debe perderse aunque esté silenciado");
      t.igual(os, 0, "ninguna notificación de Windows mientras está silenciado");

      c.api.__state.muteUntil = 0;   // se levanta el silencio
      c.api._dispararAvisoAudible({ uid: "mute-2", color: "AMBAR", title: "t", body: "b", flashText: "f", persist: false });
      t.igual(os, 1, "al levantar el silencio, la siguiente sí sale por Windows");
    });

    t.caso("v17.19.0: el silencio temporal también calla el cartel dentro de la página", () => {
      const c = cargar({ silencioso: true });
      conAudio(c);
      c.api.__S.cartel = true;
      c.api.__state.muteUntil = Date.now() + 60000;
      let pintado = 0;
      const nodosAntes = c.env.win.document._nodos.length;
      c.api._dispararAvisoCartel({ uid: "cartel-mute-1", color: "ROJO", title: "t", body: "b" });
      t.igual(c.env.win.document._nodos.filter(n => n.id === "vgl-modal").length, 0, "silenciado: el cartel no debe montarse");

      c.api.__state.muteUntil = 0;
      c.api._dispararAvisoCartel({ uid: "cartel-mute-2", color: "ROJO", title: "t", body: "b" });
      t.cierto(c.env.win.document._nodos.some(n => n.id === "vgl-modal"), "al levantar el silencio, el cartel sí se monta");
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

    // v18.0.76 — HALLAZGO DE ENJAMBRE #29. origTitle se capturaba UNA sola vez por sesión y
    // quedaba fijado para siempre tras la primera alerta del día. Reconocer una SEGUNDA
    // alerta, de otro paciente, después de que Everest navegara a otra sección entre
    // medias, restauraba el título de la PRIMERA alerta, no el real de ahora mismo.
    t.caso("REGRESIÓN — una segunda alerta captura el título REAL de ahora, no el de la primera del día (hallazgo #29)", () => {
      const c = cargar({ silencioso: true });
      const doc = c.env.win.document;
      c.api.__S.parpadeo = true;

      doc.title = "Everest — Agenda del día";
      c.api.startFlash("🔔 alerta 1", "AMBAR");
      doc.title = "🔔 alerta 1";                 // como si el intervalo ya hubiera pintado
      c.api.stopFlash();                          // el médico reconoce la 1a alerta
      t.igual(doc.title, "Everest — Agenda del día", "la 1a se restaura bien");

      doc.title = "Everest — Historia clínica";   // Everest navegó a otra sección entre medias
      c.api.startFlash("🔔 alerta 2", "AMBAR");    // llega una 2a alerta, de otro paciente
      t.igual(doc.title, "Everest — Historia clínica",
        "startFlash de la 2a alerta NO debe pisar el título real con el de la 1a — antes lo hacía, incluso antes de que corriera el intervalo");

      doc.title = "🔔 alerta 2";
      c.api.stopFlash();
      t.igual(doc.title, "Everest — Historia clínica",
        "y al reconocer la 2a se restaura la sección real de AHORA, no la de la primera alerta del día");
    });

    // ---------- política v15.4.0: UN aviso = UN canal ----------
    // La ventana emergente (popupAlert) se retiró del script: era un canal duplicado.
    // Estas pruebas fijan la política que la reemplaza, canal por canal.

    t.caso("v15.4.0: un VERDE ya NO suena (antes cada llegada a tiempo emitía dos tonos)", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = true;
      c.api._dispararAvisoAudible({ uid: "v-1", color: "VERDE", title: "t", body: "b", flashText: "f", persist: false });
      t.igual(tonos.length, 0, "VERDE es silencioso: el canal visible basta");
      c.api._dispararAvisoAudible({ uid: "a-1", color: "AMBAR", title: "t", body: "b", flashText: "f", persist: false });
      t.igual(tonos.length, 0, "AMBAR también es silencioso");
    });

    t.caso("v15.4.0: MORADO suena UNA vez (dos osciladores de un tono), ROJO repica por startNag", () => {
      const c = cargar({ silencioso: true });
      const tonos = conAudio(c);
      c.api.__S.sonido = true; c.api.__S.insistir = false;
      c.api._dispararAvisoAudible({ uid: "m-1", color: "MORADO", title: "t", body: "b", flashText: "f", persist: false });
      t.igual(tonos.length, 2, "un solo playTone para la última llamada");
      const antes = tonos.length;
      c.api._dispararAvisoAudible({ uid: "r-1", color: "ROJO", title: "t", body: "b", flashText: "f", persist: true });
      t.cierto(tonos.length > antes, "el ROJO sí suena (flanco único con insistir apagado)");
    });

    t.caso("v15.4.0: con la pestaña VISIBLE nada sale al sistema — ni Windows ni GM (el toast es el canal)", () => {
      const c = cargar({ silencioso: true });
      let os = 0, gm = 0;
      function FakeNotification() { os++; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.win.GM_notification = () => { gm++; };
      // visibilityState del arnés no es "hidden": cuenta como visible.
      c.api.notify("ROJO", "t", "b", true, "vis-1");
      c.api._dispararAvisoAudible({ uid: "vis-2", color: "ROJO", title: "t", body: "b", flashText: "f", persist: true });
      t.igual(os, 0, "cero notificaciones de Windows con la pestaña visible");
      t.igual(gm, 0, "cero notificaciones de la extensión con la pestaña visible");
    });

    // v17.40.0 — REPORTE EN VIVO: "en otra ventana o en otro programa no me avisa". La
    // pestaña sigue "visible" (visibilityState) mientras esté detrás de otra ventana, sin
    // estar minimizada — solo pierde el FOCO (`document.hasFocus()`). Antes de esta versión
    // `_pestanaOculta()` (solo mira visibilityState) decidía el canal, así que ese caso caía
    // en la rama "visible" de arriba y el toast se pintaba tapado, sin avisar nada de
    // verdad. `_pestanaSinAtencion()` también cuenta "visible pero sin foco" como si
    // estuviera oculta, para que salga la notificación real del sistema.
    t.caso("v17.40.0: VISIBLE pero SIN FOCO (otra ventana encima, sin minimizar) — cuenta igual que oculta: sale por el sistema", () => {
      const c = cargar({ silencioso: true });
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.doc.visibilityState = "visible";        // NO minimizada, NO en otra pestaña
      c.env.doc.hasFocus = () => false;              // pero otra ventana/programa tiene el foco
      c.api.notify("AMBAR", "t", "b", false, "sinfoco-" + Math.random());
      t.igual(os, 1, "con la ventana visible pero sin foco, el aviso real de Windows sí debe salir");
    });

    t.caso("v17.40.0: sin document.hasFocus disponible (navegador raro), no revienta y cae a solo mirar visibilityState", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.visibilityState = "visible";
      c.env.doc.hasFocus = undefined;
      t.noLanza(() => c.api._pestanaSinAtencion());
      t.falso(c.api._pestanaSinAtencion(), "visible y sin forma de saber el foco: se asume atendida, como antes de esta versión");
    });

    // El relevo de liderazgo entre pestañas (heartbeat) NUNCA debe activarse solo por
    // perder el foco — perder el foco cambia el CANAL de aviso, no quién manda. Ver la
    // prueba dedicada de heartbeat en suite_17_nucleo.js para el caso completo.
    t.caso("v17.40.0: perder el foco (sin estar oculta) NO cambia _pestanaOculta() — el relevo de liderazgo no debe verse afectado", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.visibilityState = "visible";
      c.env.doc.hasFocus = () => false;
      t.falso(c.api._pestanaOculta(), "_pestanaOculta() sigue mirando SOLO visibilityState, ajeno al foco");
      t.cierto(c.api._pestanaSinAtencion(), "pero _pestanaSinAtencion() sí lo cuenta, para el canal de aviso");
    });

    t.caso("v15.4.0: pestaña OCULTA con permiso -> Windows, y GM NO se dispara además (uno u otro, nunca ambos)", () => {
      const c = cargar({ silencioso: true });
      let os = 0, gm = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.win.GM_notification = () => { gm++; };
      c.env.doc.visibilityState = "hidden";
      c.api.notify("AMBAR", "t", "b", false, "occ-" + Math.random());
      t.igual(os, 1, "una notificación de Windows");
      t.igual(gm, 0, "la de la extensión no se suma encima");
    });

    t.caso("v15.4.0: pestaña OCULTA sin permiso -> GM, y el toast NO se pinta además (antes salían los dos)", () => {
      const c = cargar({ silencioso: true });
      let gm = 0;
      c.env.win.Notification = undefined;
      c.env.win.GM_notification = () => { gm++; };
      c.env.doc.visibilityState = "hidden";
      const nodosAntes = c.env.win.document._nodos.length;
      c.api.notify("AMBAR", "t", "b", false, "occ2-" + Math.random());
      t.igual(gm, 1, "el aviso salió por la extensión");
      t.igual(c.env.win.document._nodos.length, nodosAntes, "y no se creó ningún toast encima");
    });

    t.caso("_notificarSistema: DIRECTO — Windows si hay permiso; si no, la extensión; false si ninguna", () => {
      const c = cargar({ silencioso: true });
      let os = 0, gm = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.win.GM_notification = () => { gm++; };
      t.cierto(c.api._notificarSistema("AMBAR", "t", "b", false, "ns-" + Math.random()), "con permiso: true");
      t.igual(os, 1); t.igual(gm, 0, "GM no se suma cuando Windows pudo");
      c.env.win.Notification = undefined;
      t.cierto(c.api._notificarSistema("AMBAR", "t", "b", false, "ns2-" + Math.random()), "sin permiso: va por la extensión");
      t.igual(gm, 1);
      c.env.win.GM_notification = undefined;
      t.falso(c.api._notificarSistema("AMBAR", "t", "b", false, "ns3"), "sin ningún canal: false, para que el llamador escale al toast");
    });

    t.caso("v15.4.0/v17.0.3: oculta y SIN ningún canal de sistema -> el parpadeo de respaldo solo en lo crítico", () => {
      const c = cargar({ silencioso: true });
      c.env.win.Notification = undefined;
      c.env.win.GM_notification = undefined;
      c.env.doc.visibilityState = "hidden";
      c.api.__S.parpadeo = true;
      let intervalos = 0;
      const setIntervalOriginal = c.env.win.setInterval;
      c.env.win.setInterval = (f, ms) => { intervalos++; return setIntervalOriginal(f, ms); };
      c.api._dispararAvisoAudible({ uid: "nf-0", color: "VERDE", title: "t", body: "b", flashText: "f", persist: false });
      t.igual(intervalos, 0, "un VERDE (rutinario) no enciende el parpadeo de pestaña");
      // v17.0.3 — REPORTE DE CAMPO: "el ámbar desaparece solo y debería quedarse como el
      // morado" — el ámbar es la inasistencia YA vencido el tiempo de gracia, tan crítica
      // como el rojo y el morado. Ahora también enciende el parpadeo, igual que ellos.
      c.api._dispararAvisoAudible({ uid: "nf-1", color: "AMBAR", title: "t", body: "b", flashText: "f", persist: false });
      t.cierto(intervalos >= 1, "un AMBAR sí lo enciende: es tan crítico como rojo y morado");
      c.api._dispararAvisoAudible({ uid: "nf-2", color: "MORADO", title: "t", body: "b", flashText: "f", persist: false });
      t.cierto(intervalos >= 2, "y un MORADO también, como siempre");
      c.env.win.setInterval = setIntervalOriginal;
      c.api.stopFlash();
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

    // [v14.2.0 — auditoría pre-producción 2026-08-18] pymAlert/abandonoPESAlert se retiraron
    // por código muerto (ver CHANGELOG); su reemplazo, avisoUniversal, tiene su propia
    // cobertura de accesibilidad en tests/suite_35_interfaz_accesibilidad_medica.js.
    t.caso("bigAlert construye un modal accesible en Everest", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.cartel = true;
      t.noLanza(() => c.api.bigAlert("ROJO", "Ingreso fuera de turno", "Paciente extemporáneo"));
      const ids = c.env.win.document._nodos.map(n => n.id);
      t.cierto(ids.includes("vgl-modal"), "debe crearse el modal");
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

    // _renderToast busca `#vgl-toasts` con getElementById y, si no existe, se sale sin
    // pintar nada (así fue diseñado: nunca revienta si el overlay aún no se montó). Ese
    // contenedor normalmente lo crea buildOverlay() (suite 15), pero montar el overlay
    // completo aquí traería de vuelta el resto de la UI sin necesidad.
    //
    // Además, dentro de _renderToast cada cartel se arma con un solo innerHTML y LUEGO se
    // rellena con t.querySelector(".vgl-toast-title") etc. — el DOM de bolsillo del arnés no
    // convierte ese innerHTML en hijos reales, así que su querySelector() de fábrica siempre
    // da null. Y el cartel crítico entra con wrap.prepend(t), método que el arnés tampoco
    // define (solo appendChild/insertBefore). Como toda _renderToast está en try/catch,
    // cualquiera de las dos cosas se tragaba en silencio: "no revienta" pero tampoco pinta.
    // Mismo patrón que enriquecerDom() ya resuelve en las suites 15 y 17 — aquí se reutiliza
    // solo, sin arrastrar buildOverlay() completo: basta con que los nodos creados de ahora
    // en más sepan responder querySelector con algo real y prepend como el insertBefore que
    // ya funciona.
    function montarBandejaToasts(c) {
      const doc = c.env.doc;
      const crearBase = doc.createElement;
      doc.createElement = function (tag) {
        const e = crearBase.call(doc, tag);
        const memo = new Map();
        e.querySelector = (sel) => {
          if (!memo.has(sel)) memo.set(sel, doc.createElement("div"));
          return memo.get(sel);
        };
        e.prepend = (hijo) => e.insertBefore(hijo);
        return e;
      };
      const wrap = doc.createElement("div");
      wrap.id = "vgl-toasts";
      doc.body.appendChild(wrap);
      return wrap;
    }

    t.caso("showToast y _renderToast pintan sin lanzar, y escapan el contenido", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.showToast("ROJO", "Fraude", "cuerpo", false));
      t.noLanza(() => c.api._renderToast("ROJO", "<b>x</b>", "<script>alert(1)</script>", false));
      const html = c.env.win.document._nodos.map((n) => String(n.innerHTML || "")).join("");
      t.igual(html.indexOf("<script>alert(1)</script>"), -1,
        "el cuerpo del cartel llegó sin escapar al DOM de Everest");
    });

    // =====================================================================
    // v18.0.135 (Avisos #4) — BLINDAJE DEL CANAL «DENTRO DE LA PÁGINA».
    // Reporte del médico: «la misma notificación azul cian que está arriba me aparece la
    // anaranjada en otras pestañas o ventanas de Everest, yo mandé a blindar esto en
    // versiones anteriores». El blindaje anterior (v12.5.14, cola de pendientes) solo
    // cubría la ruta de maybeNotify; el toast seguía siendo pintable desde CUALQUIER
    // pestaña visible de Everest. La regla se fija ahora en el ORIGEN: el toast (y todo
    // respaldo dentro de la página) solo existe en HCHealth; fuera de él el canal es la
    // notificación del sistema, que no dibuja nada en la página ajena. El tono y la
    // notificación del sistema NO se tocan (invariante v14.1.5, suite_04).
    // =====================================================================
    await t.casoAsync("v18.0.135: showToast fuera de HCHealth no pinta NADA en la página ajena", async () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      c.env.win.location.pathname = "/viva/OtraPantalla/";   // pantalla de Everest ajena al módulo clínico
      c.env.doc.visibilityState = "visible";
      c.env.doc.hasFocus = () => true;
      c.api.__state.muteUntil = 0;
      c.api.showToast("AZUL", "Cian de prueba", "cuerpo", false, "ajena-gate-1");
      await esperar42(30);
      t.igual(wrap.children.length, 0, "ni el toast encolado pintó en la pantalla ajena (antes: el cian/ámbar de la misma cita aparecía ahí)");
    });

    await t.casoAsync("v18.0.135: pestaña ajena VISIBLE → el canal es la notificación del sistema; la página queda limpia", async () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.win.location.pathname = "/viva/OtraPantalla/";
      c.env.doc.visibilityState = "visible";
      c.env.doc.hasFocus = () => true;   // visible Y enfocada: antes esta era justo la rama que pintaba el toast
      c.api.__state.muteUntil = 0;
      t.cierto(c.api._dispararAvisoAudible({ uid: "vis-ajena-" + Math.random(), color: "AMBAR", title: "t", body: "b", flashText: "f", persist: false }),
        "el aviso se dispara");
      t.igual(os, 1, "salió por el sistema operativo: el médico se entera igual (invariante v14.1.5)");
      await esperar42(30);
      t.igual(wrap.children.length, 0, "y la pantalla ajena no se pintó (la fuga reportada, cerrada)");
    });

    await t.casoAsync("v18.0.135: pestaña ajena sin NINGÚN canal de sistema → tampoco se pinta; lo crítico conserva el parpadeo", async () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      c.env.win.Notification = undefined;
      c.env.win.GM_notification = undefined;
      c.env.win.location.pathname = "/viva/OtraPantalla/";
      c.env.doc.visibilityState = "visible";
      c.env.doc.hasFocus = () => true;
      c.api.__state.muteUntil = 0;
      c.api.__S.parpadeo = true;   // startFlash respeta este interruptor: encendido como en el consultorio
      let intervalos = 0;
      const setIntervalOriginal = c.env.win.setInterval;
      c.env.win.setInterval = (f, ms) => { intervalos++; return setIntervalOriginal(f, ms); };
      c.api._dispararAvisoAudible({ uid: "ajena-sin-canal-" + Math.random(), color: "AMBAR", title: "t", body: "b", flashText: "f", persist: false });
      await esperar42(30);
      // Lo que se afirma es la FUGA (el toast pintado en pantalla ajena), no "cero nodos":
      // startFlash crea un <link> de favicon en el <head> — el parpadeo de la pestaña es
      // señal legítima de lo crítico y va justo en la línea de abajo.
      t.igual(wrap.children.length, 0,
        "sin canal de sistema, el respaldo in-page ya NO cae en la pantalla ajena (antes: el toast se pintaba ahí igual)");
      t.cierto(intervalos >= 1, "lo crítico conserva su única señal en esa pestaña: el parpadeo del título");
      c.env.win.setInterval = setIntervalOriginal;
      c.api.stopFlash();
    });

    await t.casoAsync("v18.0.135: notify() con pestaña ajena visible → sistema operativo, no toast en pantalla ajena", async () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      c.env.win.location.pathname = "/viva/OtraPantalla/";
      c.env.doc.visibilityState = "visible";
      c.env.doc.hasFocus = () => true;
      c.api.__state.muteUntil = 0;
      c.api.notify("AZUL", "Cierre de consulta ajena", "cuerpo de prueba 135", false, "notify-ajena-" + Math.random());
      await esperar42(30);
      t.igual(os, 1, "el aviso salió por el sistema operativo");
      t.igual(wrap.children.length, 0, "y la pantalla ajena sigue limpia");
      // y dentro de HCHealth, con la pestaña visible, todo sigue igual (v15.4.0 intacto)
      c.env.win.location.pathname = "/viva/EverHealth/HCHealth";
      // (persist: true — el arnés capa los temporizadores a 1 ms, así el autodescarte de
      // 9 s borraría el cartel antes de poder verlo pintado; persistente queda estable)
      c.api.notify("AZUL", "Cierre de consulta", "cuerpo de prueba 135b", true, "notify-hc-" + Math.random());
      await esperar42(30);
      t.igual(os, 1, "en HCHealth visible no se suma Windows: un aviso = un canal, el de la página");
      t.igual(wrap.children.length, 1, "y ahí sí se pintó el toast, como siempre");
    });

    await t.casoAsync("v18.0.135: dentro de HCHealth, visible, el toast de la página sigue siendo el canal (nada se pierde)", async () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      let os = 0;
      function FakeNotification() { os++; return { close() {}, onclick: null }; }
      FakeNotification.permission = "granted";
      c.env.win.Notification = FakeNotification;
      // el pathname por defecto del arnés ya es /viva/EverHealth/HCHealth
      c.env.doc.visibilityState = "visible";
      c.env.doc.hasFocus = () => true;
      c.api.__state.muteUntil = 0;
      // (persist: true, mismo motivo de arriba: el toast debe seguir pintado al mirarlo)
      c.api._dispararAvisoAudible({ uid: "hc-vis-" + Math.random(), color: "AZUL", title: "t", body: "b", flashText: "f", persist: true });
      await esperar42(30);
      t.igual(os, 0, "no sale Windows: el médico ya está mirando esta pantalla (v15.4.0 intacto)");
      t.igual(wrap.children.length, 1, "el toast de la página se pintó como siempre");
    });

    // v17.0.3 — REPORTE DE CAMPO: "el morado se queda ahí hasta que lo cierro a mano y el
    // ámbar desaparece solo — debería ser al revés". Dos arreglos verificados aquí.
    t.caso("v17.0.3: AMBAR ya es tan crítico como ROJO/MORADO — no se agenda para autodescartarse", () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      c.api._renderToast("AMBAR", "Inasistencia", "b", true, "333@9:00");
      t.igual(wrap.children.length, 1, "el cartel se pintó");
      t.cierto(wrap.children[0].__vglCritico === true, "y quedó marcado crítico, igual que rojo y morado");
    });

    t.caso("v17.0.3: un aviso nuevo para la MISMA cita reemplaza al viejo, no se apila al lado", () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      c.api._renderToast("MORADO", "Última llamada", "AMANDA — 8:20 a. m.", false, "111@8:20");
      t.igual(wrap.children.length, 1, "el morado quedó pintado");
      c.api._renderToast("AMBAR", "Inasistencia", "AMANDA — 8:20 a. m.", true, "111@8:20");
      t.igual(wrap.children.length, 1, "sigue habiendo UN solo cartel para esta cita, no dos");
      t.cierto(wrap.children[0].querySelector(".vgl-toast-title").textContent.indexOf("Inasistencia") >= 0,
        "y es el nuevo (ámbar), no el viejo (morado) que se quedaba pegado");
    });

    t.caso("v17.0.3: un aviso de OTRA cita no toca el cartel de esta", () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      c.api._renderToast("MORADO", "Última llamada", "AMANDA", false, "111@8:20");
      c.api._renderToast("MORADO", "Última llamada", "CARLOS", false, "222@8:30");
      t.igual(wrap.children.length, 2, "las dos citas tienen su propio cartel — reemplazar no es lo mismo que vaciar la bandeja");
    });

    t.caso("v17.0.3: sin apptKey (avisos que no son de una cita puntual) no reemplaza nada", () => {
      const c = cargar({ silencioso: true });
      const wrap = montarBandejaToasts(c);
      c.api._renderToast("AZUL", "Aviso general 1", "b", false);
      c.api._renderToast("AZUL", "Aviso general 2", "b", false);
      t.igual(wrap.children.length, 2, "sin clave de cita, cada aviso se apila como siempre");
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

    // =====================================================================
    // v18.0.17 — EL AVISO DE CEGUERA SE QUEMABA SOLO EN EL PRIMER TICK
    //
    // `avisoYaVisto` está fechado POR DÍA y vive en localStorage compartido entre pestañas:
    // el aviso «Vigilante sin lectura de la agenda» sale UNA vez al día y punto. Y salía en
    // el primer tick de cada arranque, porque `state.apiCitas` nace null y `tickApi()` solo
    // se invoca AL FINAL del propio tick, así que `data === null` siempre la primera vez.
    // Dos daños: se le afirmaba al médico que la conexión «aún no se aprendió esta sesión»
    // cuando ya estaba aprendida y persistida; y, sobre todo, ese disparo espurio CONSUMÍA
    // el único aviso del día — si a media mañana el Vigilante se quedaba ciego de verdad, el
    // aviso ya no salía. El arreglo de v18.0.8, que existe precisamente para que la ceguera
    // no pase en silencio, quedaba anulado por el arranque de la propia pestaña.
    //
    // ESTO ES UNA REGRESIÓN DE CÓDIGO FUENTE, y se dice por qué: ejercitar el defecto de
    // verdad exige el `tick()` completo con su DOM, su liderazgo y su reloj, y una prueba
    // así comprobaría media docena de cosas a la vez y se rompería por cualquiera de ellas.
    // Lo que hay que fijar aquí es UN CABLE: que la condición del aviso exija haber
    // intentado leer el API. Mismo criterio que la regresión de fuente de suite_71 sobre el
    // enganche de los widgets y la de suite_57 sobre el nombre que viaja al saneador.
    t.caso("v18.0.17: el aviso de ceguera exige haber INTENTADO leer el API (no se quema en el arranque)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const i = src.indexOf('"vgl-sin-datos-agenda"');
      t.cierto(i > 0, "sigue existiendo el aviso de ceguera con su identificador de una-vez-al-día");

      // La condición que lo dispara está justo encima de la llamada a osNotify.
      const bloque = src.slice(Math.max(0, i - 1400), i);
      const cond = bloque.slice(bloque.lastIndexOf("if (leader"));
      t.cierto(/_enModuloHCHealth\(\)/.test(cond), "sigue restringido al módulo clínico");
      t.cierto(/secc !== "agenda"/.test(cond),
        "y sigue siendo «aquí no puedo leer la agenda del DOM», que es el arreglo de v18.0.8");
      t.cierto(/_intentoLeerApi/.test(cond),
        "pero además exige que esta pestaña haya intentado leer el API: sin eso, el primer tick lo quema");

      // Y la definición del testigo tiene que ser la correcta en las dos direcciones.
      const def = src.slice(src.indexOf("const _intentoLeerApi"), src.indexOf("const _intentoLeerApi") + 90);
      t.cierto(/!API\.url/.test(def),
        "sin URL aprendida el mensaje SÍ es cierto y debe seguir saliendo: no se puede silenciar la ceguera real");
      t.cierto(/API\.ok\s*\+\s*API\.fallos/.test(def),
        "y con URL aprendida hace falta al menos un intento —correcto o fallido— antes de declarar ceguera");
    });


    // =====================================================================
    // v18.0.19 — EL AVISO DE ACTUALIZACIÓN LEÍA OTRO ARCHIVO QUE EL QUE SE INSTALA
    //
    // `VGL_UPDATE_GIST_URL` apuntaba a gistfile2.txt con el comentario «= @updateURL del
    // encabezado», mientras el encabezado apunta a gistfile1.txt desde el commit 62c09c2
    // («canal real de los equipos»). Tampermonkey instalaba bien —lee el encabezado— pero
    // el aviso proactivo «⬆ Actualización disponible» consultaba OTRO archivo: si ése se
    // quedó congelado, el aviso no sale nunca y los equipos solo se actualizan si
    // Tampermonkey completa su ciclo diario por su cuenta.
    //
    // Lo respalda la telemetría real del 31-ago: de 23 equipos activos, 12 seguían en la
    // v17.0.2 — sin ninguno de los arreglos de la jornada.
    //
    // La prueba fija el invariante, no el literal: el encabezado y la constante tienen que
    // apuntar al MISMO archivo. Así el día que se cambie el canal, cambiarlo en un sitio y
    // no en el otro pone el banco en rojo — que es justo lo que no pasó la última vez.
    // =====================================================================
    t.caso("v18.0.19: el aviso de actualización consulta el MISMO archivo que Tampermonkey instala", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

      const cab = /^\/\/\s*@updateURL\s+(\S+)/m.exec(src);
      t.cierto(!!cab, "el encabezado sigue declarando @updateURL");

      const bloque = src.slice(src.indexOf("const VGL_UPDATE_GIST_URL"), src.indexOf("function mtrCheckActualizacionGist"));
      const literales = bloque.match(/https:\/\/gist\.githubusercontent\.com\/\S+?\.txt/g) || [];
      t.cierto(literales.length >= 1, "la constante conserva una URL de respaldo por si GM_info no la expone");
      for (const u of literales) {
        t.igual(u, cab[1],
          `el respaldo de VGL_UPDATE_GIST_URL debe ser EXACTAMENTE el @updateURL del encabezado (encabezado: ${cab[1]})`);
      }

      // Y la defensa que impide que vuelvan a separarse: la URL se toma de GM_info cuando
      // está, que es la misma cadena que usa el gestor para instalar.
      t.cierto(/GM_info/.test(bloque),
        "la constante debe derivarse de GM_info, no ser solo un literal que alguien pueda olvidar de actualizar");
    });


    // v18.0.109 — S+ flujo (C14): `persist` no hacía nada en los avisos VERDE/AZUL: la leyenda
    // de colores y «Órdenes generadas» (persist=true) se cerraban solos a los 9 s.
    await t.casoAsync("v18.0.109 (C14): un aviso VERDE con persist=true NO se cierra solo; sin persist, sí", async () => {
      const c = cargar({ silencioso: true });
      const doc = c.env.doc; const crearBase = doc.createElement;
      doc.createElement = function (tag) { const e = crearBase(tag); const memo = new Map(); e.querySelector = (sel) => { const k = String(sel).replace(/:not\([^)]*\)/g, ""); if (!memo.has(k)) memo.set(k, doc.createElement("div")); return memo.get(k); }; e.querySelectorAll = () => []; return e; };
      const bandeja = doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); n.parentElement = bandeja; };
      const getOrig = doc.getElementById;
      doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : getOrig(id));
      c.api._renderToast("VERDE", "Leyenda de colores", "se queda", true, "");
      c.api._renderToast("VERDE", "Aviso normal", "se va solo", false, "");
      t.igual(bandeja.children.length, 2, "montaje: los dos avisos se pintaron");
      await new Promise((r) => setTimeout(r, 40));   // el arnés capa los 9 s de autocierre a 1 ms
      const vivos = bandeja.children.filter((n) => !(n.classList && n.classList.contains && n.classList.contains("out")));
      const titulos = vivos.map((n) => { try { return String(n.querySelector(".vgl-toast-title").textContent); } catch (e) { return ""; } });
      t.cierto(titulos.includes("Leyenda de colores"), "el persistente sigue (antes: se cerraba a los 9 s): " + JSON.stringify(titulos));
      t.falso(titulos.includes("Aviso normal"), "el normal se cerró solo, como siempre");
      doc.getElementById = getOrig;
    });

    // v18.0.109 — S+ robustez (B9): las notificaciones del SISTEMA (Centro de actividades de
    // Windows, PC compartido) llevaban nombre + cédula. Ahora van sin cédula; el aviso dentro de
    // la página conserva el texto completo.
    t.caso("v18.0.109 (B9): lo que sale al sistema va sin cédula (nombre sí); dentro de la página el texto sigue completo", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._vglSinCedulas("PACIENTE PRUEBA UNO · CC 1122334455 · 07:00"), "PACIENTE PRUEBA UNO · CC ●●●455 · 07:00", "la cédula se enmascara y el nombre y la hora quedan");
      const capturadas = [];
      c.ctx.Notification = class { constructor(titulo, opciones) { capturadas.push([titulo, (opciones && opciones.body) || ""]); } static get permission() { return "granted"; } close() {} };
      const salio = c.api._notificarSistema("ROJO", "⛔ PACIENTE PRUEBA UNO", "CC 1122334455 · llegó tarde", true, "prueba|b9");
      t.cierto(salio && capturadas.length === 1, "montaje: salió por el sistema");
      t.cierto(!/1122334455/.test(capturadas[0][1]) && /●●●455/.test(capturadas[0][1]), "el cuerpo que ve Windows no lleva la cédula: " + capturadas[0][1]);
      t.cierto(/PACIENTE PRUEBA UNO/.test(capturadas[0][0]), "y el nombre sí, para saber de quién es");
      delete c.ctx.Notification;
    });

    // =====================================================================
    // v18.0.113 — REPORTE EN VIVO (02-sep): «las notificaciones se repiten en varias pestañas»
    // =====================================================================
    t.caso("v18.0.113: dos pestañas que evalúan el mismo hecho con más de 12 s de diferencia avisan UNA sola vez (registro compartido del día)", () => {
      const almacen = {};
      const mk = () => {
        const c = cargar({ silencioso: true, almacen });
        conAudio(c);
        let os = 0;
        function FakeNotification() { os++; return { close() {}, onclick: null }; }
        FakeNotification.permission = "granted";
        c.env.win.Notification = FakeNotification;
        c.env.win.document.visibilityState = "hidden";
        c.api.__S.sonido = true;
        return { c, cuenta: () => os };
      };
      const A = mk(), B = mk();
      const p = { uid: "cita-7|AMBAR", color: "AMBAR", title: "t", body: "b", flashText: "f", persist: false };
      t.cierto(A.c.api._dispararAvisoAudible(p), "la pestaña A avisa");
      t.igual(A.cuenta(), 1, "y sale por Windows una vez");
      // la ventana de 12 s de crossTabDup se da por vencida a mano (otra cadencia de sondeo)
      almacen["vgl_n_full|cita-7|AMBAR"] = String(Date.now() - 60000);
      t.falso(B.c.api._dispararAvisoAudible(p), "la pestaña B, un minuto después, NO vuelve a avisar el mismo hecho (antes: sí, pasados los 12 s)");
      t.igual(B.cuenta(), 0, "ninguna notificación repetida");
      const p2 = { uid: "cita-8|AMBAR", color: "AMBAR", title: "t2", body: "b2", flashText: "f", persist: false };
      t.cierto(B.c.api._dispararAvisoAudible(p2), "otro hecho sí avisa");
      t.igual(B.cuenta(), 1, "por Windows");
    });

    await t.casoAsync("v18.0.113: notify() sin uid toma identidad del texto — el mismo aviso no sale dos veces en el navegador, ni por toast ni por Windows, ni en otra pestaña", async () => {
      const almacen = {};
      const mk = (visible) => {
        const c = cargar({ silencioso: true, almacen });
        let os = 0;
        function FakeNotification() { os++; return { close() {}, onclick: null }; }
        FakeNotification.permission = "granted";
        c.env.win.Notification = FakeNotification;
        c.env.win.document.visibilityState = visible ? "visible" : "hidden";
        c.env.win.document.hasFocus = () => !!visible;
        return { c, cuenta: () => os };
      };
      const A = mk(false), B = mk(false);
      A.c.api.notify("VERDE", "✅ Cita asignada exitosamente", "PACIENTE PRUEBA · 01/10/2026");
      t.igual(A.cuenta(), 1, "A: una notificación");
      almacen["vgl_n_os|" + Object.keys(almacen).filter((k) => k.indexOf("vgl_n_os|") === 0).map((k) => k.slice(9))[0]] = String(Date.now() - 60000);
      B.c.api.notify("VERDE", "✅ Cita asignada exitosamente", "PACIENTE PRUEBA · 01/10/2026");
      t.igual(B.cuenta(), 0, "B, un minuto después con el mismo texto: nada (antes: la misma notificación otra vez)");
      B.c.api.notify("VERDE", "✅ Cita asignada exitosamente", "OTRO PACIENTE PRUEBA · 02/10/2026");
      t.igual(B.cuenta(), 1, "otro texto = otro aviso");
      // canal de la página: la pestaña visible tampoco repite lo que ya salió por Windows
      const C = mk(true);
      // DOM «enriquecido» mínimo: _renderToast arma el aviso con querySelector sobre el nodo creado
      const crearBase = C.c.env.doc.createElement;
      C.c.env.doc.createElement = function (tag) { const e = crearBase(tag); const memo = new Map(); e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, crearBase("div")); return memo.get(sel); }; return e; };
      const enCola = [];
      C.c.api.__state.muteUntil = 0;
      const stOrig = C.c.env.doc.getElementById;
      C.c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? { prepend: (n) => enCola.push(n), appendChild: (n) => enCola.push(n), children: [] } : stOrig(id));
      C.c.api.notify("VERDE", "✅ Cita asignada exitosamente", "PACIENTE PRUEBA · 01/10/2026");
      await esperar42(30);
      t.igual(enCola.length, 0, "la pestaña visible no pinta el toast de un aviso que ya salió en el navegador");
      C.c.api.notify("AZUL", "Aviso nuevo de prueba", "solo en esta pestaña");
      await esperar42(30);
      t.igual(enCola.length, 1, "y un aviso nuevo sí se pinta (la prueba del toast no es vacía)");
      t.igual(C.c.api._avisoUidDeTexto("a", "b"), C.c.api._avisoUidDeTexto("a", "b"), "la identidad de texto es estable");
      t.cierto(C.c.api._avisoUidDeTexto("a", "b") !== C.c.api._avisoUidDeTexto("a", "c"), "y distinta para textos distintos");
    });

    t.caso("v18.0.113: GM_notification (sin permiso del sitio) también obedece el registro del día", () => {
      const almacen = {};
      let gm = 0;
      const mk = () => { const c = cargar({ silencioso: true, almacen }); c.env.win.GM_notification = () => { gm++; }; return c; };
      const A = mk(), B = mk();
      t.cierto(A.api._gmNotify("AMBAR", "t", "b", false, "gm-uid-1"), "A avisa por la extensión");
      almacen["vgl_n_gm|gm-uid-1"] = String(Date.now() - 60000);
      t.falso(B.api._gmNotify("AMBAR", "t", "b", false, "gm-uid-1"), "B, un minuto después: no repite");
      t.igual(gm, 1, "una sola notificación de la extensión");
    });

    await t.casoAsync("v18.0.118 (UI/UX #8): «Alerta Múltiple» dice DE QUÉ son los avisos, no solo cuántos", async () => {
      const c = cargar({ silencioso: true });
      const pintados = [];
      const bandeja = c.env.doc.createElement("div");
      bandeja.prepend = (n) => { bandeja.children.unshift(n); pintados.push(n); };
      bandeja.appendChild = (n) => { bandeja.children.push(n); pintados.push(n); };
      const crearBase = c.env.doc.createElement;
      c.env.doc.createElement = function (tag) { const e = crearBase(tag); const memo = new Map(); e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, crearBase("div")); return memo.get(sel); }; return e; };
      const g = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-toasts" ? bandeja : g(id));
      c.api.showToast("ROJO", "07:30 · Confirmación extemporánea", "cuerpo 1", false, "p1");
      c.api.showToast("AMBAR", "08:00 · Inasistencia", "cuerpo 2", false, "p2");
      c.api.showToast("MORADO", "08:30 · Última llamada", "cuerpo 3", false, "p3");
      c.api.showToast("AZUL", "Órdenes generadas", "cuerpo 4", false, "p4");
      await esperar42(600);
      t.igual(pintados.length, 1, "los cuatro se agrupan en un solo aviso");
      const cuerpo = pintados[0].querySelector(".vgl-toast-b").textContent;
      t.cierto(/3 críticas · 1 rutinarias/.test(cuerpo), "dice cuántas de cada tipo");
      ["Confirmación extemporánea", "Inasistencia", "Última llamada", "Órdenes generadas"].forEach((tit) => {
        t.cierto(cuerpo.includes(tit), "y nombra «" + tit + "» (antes: solo el conteo, sin saber de qué ni de quién)");
      });
      c.env.doc.getElementById = g;
    });

  },
};
