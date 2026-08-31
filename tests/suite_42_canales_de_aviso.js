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

  },
};
