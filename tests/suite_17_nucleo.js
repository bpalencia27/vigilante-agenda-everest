

function enriquecerDom(c) {
  const doc = c.env.doc;
  const crearBase = doc.createElement;
  doc._nodos = [];
  doc.createElement = function (tag) {
    const e = crearBase.call(doc, tag);
    const memo = new Map();
    e.querySelector = (sel) => {
      if (!memo.has(sel)) memo.set(sel, doc.createElement("div"));
      return memo.get(sel);
    };
    e.querySelectorAll = () => [];
    doc._nodos.push(e);
    return e;
  };
  doc.createDocumentFragment = () => {
    const f = doc.createElement("div");
    f._esFragmento = true;
    return f;
  };
  const getByIdBase = doc.getElementById;
  doc.getElementById = (id) => {
    return doc._nodos.find(n => n.id === id) || (getByIdBase ? getByIdBase(id) : null);
  };
}

// =====================================================================
//  SUITE 17 — Núcleo: bucles, latidos y utilidades GM
//  Cubre el corazón del Vigilante: el bucle tick(), el latido de liderazgo,
//  la cesión del hilo (yieldNow/makeYielder/idleRun), los POST vía
//  GM_xmlhttpRequest, los avisos de versión/PyM y el robot Athenea.
//
//  boot() ahora se cubre inyectando un DOM simulado enriquecido.
//  (Usando el mismo patrón de enriquecerDom() de la suite 15).
//
// =====================================================================
module.exports = {
  nombre: "Núcleo: bucles, latidos y utilidades GM",
  cubre: [
    "gmPostJson", "gmPostJsonEx", "yieldNow", "makeYielder", "idleRun",
    "heartbeat", "share", "helloOncePerDay", "_onboardingColores", "tick", "downloadDiagnostic", "uxClaveLimpia",
    "pymReminderCheck", "avisarSiActualizado", "chequearAutoUpdateLento",
    "checkVersionMinimum", "resolverMedicoPorPerfil",
    "autoFetchAtheneaLabsForActivePatient",
    "_setUltimoRelevoParaTest",
    "boot",
  ],

  async pruebas(t, api, env, cargar) {
    // pequeña espera REAL (fuera del sandbox) para dejar correr los timers
    // del arnés, que recorta todo setTimeout a ~1 ms
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const hoyReal = () => {
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    const hace = (dias) => {
      const d = new Date(Date.now() - dias * 86400000);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    // Notification falsa con permiso concedido: captura título y cuerpo de cada aviso
    function instalarNotificacion(c, capturas) {
      c.ctx.Notification = class {
        constructor(title, opts) { capturas.push({ title, body: (opts && opts.body) || "" }); }
        close() {}
        static get permission() { return "granted"; }
      };
    }

    // ---------- heartbeat / share ----------
    t.caso("heartbeat: liderazgo por latido con RELEVO (v12.3.36 — el líder congelado por Edge pierde el mando)", () => {
      const c = cargar({ silencioso: true });
      const ls = c.env.win.localStorage;
      t.igual(c.api.heartbeat(), true, "sin latido previo, esta pestaña toma el mando");
      t.cierto(ls.getItem("vgl_leader_beat") !== null, "y deja su latido escrito");
      // Otra pestaña dejó un latido FRESCO: esta se subordina sin robar el mando.
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now() }));
      t.igual(c.api.heartbeat(), false, "latido ajeno fresco: no se roba el mando");
      t.igual(c.api.__state.leader, false);
      // El latido ajeno envejece más de 20 s (líder congelado por Edge): relevo.
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now() - 21000 }));
      t.igual(c.api.heartbeat(), true, "latido vencido: la pestaña despierta releva al líder congelado");
      t.igual(c.api.__state.leader, true);
    });

    // v14.1.5 — AVISOS TARDÍOS. El sondeo vive en `setInterval(tick, 5000)` dentro de la
    // pestaña líder, y el navegador estrangula los temporizadores de las pestañas OCULTAS
    // a uno por minuto. Con el liderazgo asignado por orden de llegada, la pestaña de la
    // agenda podía quedarse de líder y pasar al fondo en cuanto el médico entra a una
    // historia clínica: el vigilante pasaba de latir cada 5 s a cada 60 s.
    t.caso("heartbeat v14.1.5: una pestaña A LA VISTA releva a un líder OCULTO aunque su latido esté fresco (avisos tardíos por estrangulamiento del navegador)", () => {
      const c = cargar({ silencioso: true });
      const ls = c.env.win.localStorage;
      c.env.doc.visibilityState = "visible";

      // Líder ajeno OCULTO, con latido recién puesto (fresco por los 20 s de la regla vieja).
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now(), oculta: true }));
      t.igual(c.api.heartbeat(), true, "la pestaña visible SÍ le quita el mando a la oculta");
      const beat = JSON.parse(ls.getItem("vgl_leader_beat"));
      t.igual(beat.oculta, false, "y deja constancia de que ahora manda una pestaña a la vista");

      // La simétrica: una pestaña OCULTA nunca le quita el mando a una VISIBLE.
      c.env.doc.visibilityState = "hidden";
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now(), oculta: false }));
      t.igual(c.api.heartbeat(), false, "una pestaña oculta no le roba el mando a una que está a la vista");

      // Y entre dos ocultas manda la regla de siempre: el latido fresco gana.
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now(), oculta: true }));
      t.igual(c.api.heartbeat(), false, "entre dos ocultas no se introduce forcejeo nuevo: gana el latido fresco");
    });

    // v14.1.5 — Una auditoría adversarial del propio arreglo planteó dos temores. Uno era
    // infundado y el otro real; los dos quedan fijados aquí para que nadie los reintroduzca.
    t.caso("heartbeat v14.1.5: si TODAS las pestañas están ocultas NO hay acefalía — el líder oculto conserva el mando", () => {
      const c = cargar({ silencioso: true });
      const ls = c.env.win.localStorage;
      // El médico minimizó el navegador entero para mirar otra aplicación. Nadie está a la
      // vista. Si la visibilidad fuera REQUISITO para mandar, el vigilante se quedaría sin
      // líder y dejaría de avisar justo cuando el aviso más falta.
      c.env.doc.visibilityState = "hidden";
      t.igual(c.api.heartbeat(), true, "sin latido ajeno, una pestaña oculta toma el mando igual");
      t.igual(c.api.heartbeat(), true, "y lo conserva latido tras latido");
      t.igual(c.api.__state.leader, true, "la visibilidad es preferencia para RELEVAR, nunca requisito para MANDAR");
      const beat = JSON.parse(ls.getItem("vgl_leader_beat"));
      t.igual(beat.oculta, true, "deja constancia de que manda una oculta, para que una visible pueda relevarla luego");
    });

    t.caso("heartbeat v14.1.5: el relevo por visibilidad tiene enfriamiento — con Alt+Tab rápido no se dispara una ráfaga de consultas al servidor", () => {
      const c = cargar({ silencioso: true });
      const ls = c.env.win.localStorage;
      c.env.doc.visibilityState = "visible";
      c.api._setUltimoRelevoParaTest(0);

      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra", t: Date.now(), oculta: true }));
      t.igual(c.api.heartbeat(), true, "el primer relevo por visibilidad sí ocurre");

      // Alt+Tab inmediato: otra pestaña se lo queda y esta vuelve a intentarlo enseguida.
      // Cada toma de mando hace API.ultimo = 0, o sea una consulta inmediata de agenda;
      // sin enfriamiento, alternar pestañas bombardearía el servidor de Everest.
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra", t: Date.now(), oculta: true }));
      t.igual(c.api.heartbeat(), false, "un segundo relevo dentro de los 10 s NO se concede");

      // Pasado el enfriamiento, quien de verdad se quedó mirando sí se lleva el mando.
      c.api._setUltimoRelevoParaTest(Date.now() - 11000);
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "otra", t: Date.now(), oculta: true }));
      t.igual(c.api.heartbeat(), true, "pasados los 10 s el relevo vuelve a estar disponible");
    });

    t.caso("heartbeat v14.1.5: un latido antiguo SIN el campo `oculta` no dispara relevos (compatibilidad con pestañas de la versión anterior)", () => {
      const c = cargar({ silencioso: true });
      const ls = c.env.win.localStorage;
      c.env.doc.visibilityState = "visible";
      // Una pestaña que todavía corre v14.1.4 escribe latidos sin `oculta`. Tratarla como
      // oculta la desalojaría cada pocos segundos durante la transición de versión.
      ls.setItem("vgl_leader_beat", JSON.stringify({ id: "pestana-vieja", t: Date.now() }));
      t.igual(c.api.heartbeat(), false, "sin dato de visibilidad se respeta el latido fresco, como antes");
    });

    // ---------- __VGL_DIAG__ (v12.5.14) ----------
    // No está en `cubre`: se asigna a window.__VGL_DIAG__ (no una `function NOMBRE`
    // declarada), así que el cargador del banco no la expone en `api` — se prueba
    // directo contra c.env.win, que es donde de verdad vive (F12 la llama ahí).
    t.caso("__VGL_DIAG__: refleja el estado real sin lanzar y sin exponer datos de paciente", () => {
      const c = cargar({ silencioso: true });
      t.cierto(typeof c.env.win.__VGL_DIAG__ === "function", "se asigna a window al cargar el script, sin esperar a boot()");
      const d = c.env.win.__VGL_DIAG__();
      t.igual(d.seccion, "otra", "DOM falso del arnés: ninguna vista reconocida");
      t.igual(d.apiUrlAprendida, false, "sin localStorage previo, el API aún no se aprendió");
      t.igual(d.apiOk, 0);
      t.igual(d.apiFallos, 0);
      t.igual(d.apiUtil, false, "sin URL aprendida, apiUtil() es falso");
      t.igual(d.apiSano, false);
      t.igual(d.ultimoSnapshotHaceMs, null, "sin snapshot todavía");
      // Nada de nombres, cédulas ni listas de pacientes en el diagnóstico.
      const plano = JSON.stringify(d);
      t.falso(/[a-zñáéíóú]{4,}\s[A-ZÑÁÉÍÓÚ]{2,}/.test(plano), "no debe verse texto con forma de nombre de paciente");
    });

    t.caso("__VGL_DIAG__: tras tomar el liderazgo, refleja latidoLiderPropio y esLider", () => {
      const c = cargar({ silencioso: true });
      c.api.heartbeat(); // esta pestaña toma el mando (sin latido previo)
      const d = c.env.win.__VGL_DIAG__();
      t.cierto(d.esLider, "state.leader quedó en true tras heartbeat()");
      t.cierto(d.latidoLiderPropio, "el latido en localStorage es el de esta pestaña (TABID)");
      t.cierto(typeof d.latidoLiderHaceMs === "number" && d.latidoLiderHaceMs >= 0);
    });

    t.caso("__VGL_DIAG__: nunca lanza aunque algo interno falle (localStorage roto)", () => {
      const c = cargar({ silencioso: true });
      const originalGetItem = c.env.win.localStorage.getItem;
      c.env.win.localStorage.getItem = () => { throw new Error("boom"); };
      let d;
      t.noLanza(() => { d = c.env.win.__VGL_DIAG__(); });
      c.env.win.localStorage.getItem = originalGetItem;
      // El try/catch interno de heartbeat-beat ya protege esta parte puntual, así que
      // no debe reventar el diagnóstico entero por un solo localStorage caído.
      t.cierto(d && typeof d === "object");
    });

    t.caso("share: sin BroadcastChannel no lanza y no ensucia state.shared", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.share([{ key: "x@07:00", color: "VERDE" }]));
      t.igual(c.api.__state.shared, null, "el eco de shared solo llega por el canal, que aquí no existe");
    });

    // ---------- yieldNow / makeYielder / idleRun ----------
    await t.casoAsync("yieldNow: sin MessageChannel cae a setTimeout y aún así resuelve", async () => {
      const c = cargar({ silencioso: true });
      let despues = false;
      const p = c.api.yieldNow().then(() => { despues = true; });
      t.falso(despues, "debe ceder de verdad: no resuelve en el mismo turno");
      await p;
      t.cierto(despues);
    });

    await t.casoAsync("makeYielder: respeta el presupuesto de tiempo medido", async () => {
      const c = cargar({ silencioso: true });
      // presupuesto enorme: recién creado NO cede
      const holgado = c.api.makeYielder(100000);
      t.igual(await holgado(), false, "sin agotar presupuesto no debe ceder");
      // presupuesto negativo: siempre está agotado, cede de una
      const agotado = c.api.makeYielder(-1);
      t.igual(await agotado(), true, "presupuesto vencido => cede y devuelve true");
      // presupuesto 0 es falsy: usa el valor por defecto (15 ms), no cede en seguida
      const porDefecto = c.api.makeYielder(0);
      t.igual(await porDefecto(), false, "makeYielder(0) debe caer al presupuesto por defecto");
      // tras gastar el presupuesto cede, y al ceder REINICIA el contador
      const corto = c.api.makeYielder(50);
      const t0 = Date.now();
      while (Date.now() - t0 < 60) { /* quemar el presupuesto */ }
      t.igual(await corto(), true, "presupuesto gastado => cede");
      t.igual(await corto(), false, "el reloj se reinició al ceder: no vuelve a ceder al instante");
    });

    await t.casoAsync("idleRun: usa requestIdleCallback con el tope pedido y 4000 ms por defecto", async () => {
      const c = cargar({ silencioso: true });
      let pedido = null;
      c.ctx.requestIdleCallback = (cb, opts) => { pedido = { cb, opts }; return 1; };
      let corrio = false;
      c.api.idleRun(() => { corrio = true; }, 1234);
      t.cierto(pedido, "debió pasar por requestIdleCallback");
      t.igual(pedido.opts.timeout, 1234);
      t.falso(corrio, "el trabajo queda diferido, no corre en línea");
      pedido.cb();
      t.cierto(corrio, "al llegar el momento libre, el trabajo corre");
      c.api.idleRun(() => {}, undefined);
      t.igual(pedido.opts.timeout, 4000, "sin tope explícito usa 4000 ms");
    });

    await t.casoAsync("idleRun: sin requestIdleCallback cae a setTimeout", async () => {
      const c = cargar({ silencioso: true });
      c.ctx.requestIdleCallback = undefined;
      let corrio = false;
      c.api.idleRun(() => { corrio = true; });
      t.falso(corrio, "tampoco aquí corre en línea");
      await esperar(20);      // el arnés recorta el setTimeout(700) a ~1 ms
      t.cierto(corrio, "el respaldo con setTimeout debe ejecutar el trabajo");
    });

    // ---------- gmPostJson / gmPostJsonEx ----------
    await t.casoAsync("gmPostJson: arma el POST JSON y devuelve la respuesta parseada", async () => {
      const reqs = [];
      let modo = "ok";
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          reqs.push(o);
          if (modo === "ok") o.onload({ status: 200, responseText: '{"exito":true,"n":7}' });
          else if (modo === "rota") o.onload({ status: 200, responseText: "esto no es json" });
          else if (modo === "red") o.onerror(new Error("sin red"));
        },
      });
      const r = await c.api.gmPostJson("https://appcita.viva1a.com.co:8051/api/x", { a: 1 });
      t.igual(r, { exito: true, n: 7 });
      const req = reqs[reqs.length - 1];
      t.igual(req.method, "POST");
      t.igual(req.url, "https://appcita.viva1a.com.co:8051/api/x");
      t.igual(req.headers["Content-Type"], "application/json");
      t.igual(req.data, '{"a":1}', "el cuerpo viaja serializado como JSON");

      modo = "rota";
      t.igual(await c.api.gmPostJson("https://x/y", {}), null, "respuesta no-JSON => null, sin lanzar");
      modo = "red";
      t.igual(await c.api.gmPostJson("https://x/y", {}), null, "error de red => null, sin lanzar");
    });

    await t.casoAsync("gmPostJsonEx: informa el resultado HTTP real (ok/status/data)", async () => {
      let modo = "ok";
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          if (modo === "ok") o.onload({ status: 201, responseText: '{"cita":99}' });
          else if (modo === "500") o.onload({ status: 500, responseText: '{"error":"interno"}' });
          else if (modo === "rota") o.onload({ status: 200, responseText: "<html>error</html>" });
          else if (modo === "red") o.onerror(new Error("sin red"));
          else if (modo === "timeout") o.ontimeout();
        },
      });
      const ok = await c.api.gmPostJsonEx("https://x/y", { b: 2 });
      t.igual(ok.ok, true); t.igual(ok.status, 201); t.igual(ok.data, { cita: 99 });

      modo = "500";
      const err = await c.api.gmPostJsonEx("https://x/y", {});
      t.igual(err.ok, false, "un 500 NO puede darse por buena la cita");
      t.igual(err.status, 500);
      t.igual(err.data, { error: "interno" }, "aun fallida, la respuesta parseada se conserva");

      modo = "rota";
      const rota = await c.api.gmPostJsonEx("https://x/y", {});
      t.igual(rota.ok, true, "el HTTP fue 2xx aunque el cuerpo no sea JSON");
      t.igual(rota.data, null);
      t.igual(rota.text, "<html>error</html>", "el texto crudo queda para diagnóstico");

      modo = "red";
      t.igual(await c.api.gmPostJsonEx("https://x/y", {}), { ok: false, status: 0, data: null });
      modo = "timeout";
      t.igual(await c.api.gmPostJsonEx("https://x/y", {}), { ok: false, status: 0, data: null });
    });

    // ---------- helloOncePerDay ----------
    t.caso("helloOncePerDay: resume la jornada UNA sola vez al día", () => {
      const c = cargar({ silencioso: true });
      const capturas = [];
      instalarNotificacion(c, capturas);
      // v15.4.0 — política de un solo canal: con la pestaña VISIBLE el aviso va al toast;
      // la notificación del sistema (lo que aquí se captura) solo sale con pestaña oculta.
      c.env.doc.visibilityState = "hidden";
      const lista = [
        { estado: "Atendido" },
        { estado: "En Sala de Espera" },
        { estado: "Sin presentarse", color: "AMBAR" },
      ];
      c.api.helloOncePerDay(lista);
      t.igual(c.env.almacen["vgl_hello"], hoyReal(), "la marca diaria queda en localStorage");
      t.igual(capturas.length, 1);
      t.cierto(capturas[0].title.includes("Asistente clínico activo"), "título del saludo");
      t.cierto(capturas[0].body.includes("3 cita(s): 1 atendida(s) · 1 en sala · 1 sin presentarse"), "el conteo por estado es real");
      t.cierto(capturas[0].body.includes("(1 con tiempo de tolerancia transcurrido)"), "las vencidas (AMBAR) se cuentan aparte");
      c.api.helloOncePerDay(lista);
      t.igual(capturas.length, 1, "segunda llamada el mismo día: silencio total");
    });

    // ---------- _onboardingColores ----------
    t.caso("_onboardingColores: la leyenda de colores se muestra UNA sola vez por navegador", () => {
      const c = cargar({ silencioso: true });
      const capturas = [];
      instalarNotificacion(c, capturas);
      c.env.doc.visibilityState = "hidden";
      c.api._onboardingColores();
      t.igual(c.env.almacen["vgl_onb_colores"], "1", "la marca queda guardada en localStorage");
      t.igual(capturas.length, 1, "primera vez: muestra la leyenda");
      t.cierto(capturas[0].title.includes("Centinela activo"), "título de bienvenida");
      t.cierto(capturas[0].body.includes("Verde") && capturas[0].body.includes("Cian") && capturas[0].body.includes("Rojo") && capturas[0].body.includes("Violeta"), "la leyenda trae los colores de la agenda");
      c.api._onboardingColores();
      t.igual(capturas.length, 1, "segunda vez: ya no se repite");
    });

    // ---------- tick ----------
    t.caso("tick: fuera de agenda/historia se apaga la vigilancia (sección 'otra')", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api.tick());
      t.igual(c.api.__state.lastSeccion, "otra");
      t.igual(c.api.__state.lastSnapshot, null, "no debe leer ni guardar nada fuera de las vistas permitidas");
    });

    t.caso("tick: con la agenda visible SIEMBRA sin notificar (no-inferencia) y guarda la instantánea", () => {
      const c = cargar({ silencioso: true });
      // DOM mínimo de "Citas del día": una tarjeta con hora + estado + documento + nombre
      const contenedor = {
        querySelector: (sel) => ({
          ".status-label": { textContent: "Atendido" },
          ".text-muted": { textContent: "12345678" },
          ".text-uppercase.fw-bold": { textContent: "PACIENTE PRUEBA" },
          ".fw-bold.mb-0": { textContent: "Presencial" },
        }[sel] || null),
      };
      const nodoHora = {
        textContent: "07:00 AM",
        closest: () => contenedor,
        parentElement: null,
        ownerDocument: { body: c.env.doc.body },
      };
      c.env.doc.querySelector = (sel) => (sel === ".labelHora" || sel === ".status-label") ? {} : null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".labelHora" ? [nodoHora] : []);

      c.api.tick();
      t.igual(c.api.__state.lastSeccion, "agenda");
      t.igual(c.api.__state.summarized, true, "el arranque tardío queda resumido, no alertado");
      t.igual(c.api.__state.notified.size, 1, "la cita se SIEMBRA en notified sin avisar");
      t.igual(c.api.__state.notified.get("12345678@m420"), "VERDE", "sembrada con su clave y color reales");
      t.cierto(c.api.__state.lastSnapshot && c.api.__state.lastSnapshot.source === "pagina", "la fuente fue la página (el API aún no está sano)");
      t.igual(c.api.__state.lastSnapshot.list.length, 1);
      t.igual(c.env.almacen["vgl_hello"], hoyReal(), "el saludo diario salió porque esta pestaña es líder");

      // segundo tick: mismo estado => maybeNotify calla y no se duplica nada
      c.api.tick();
      t.igual(c.api.__state.notified.size, 1, "sin cambios de estado no aparecen entradas nuevas");
    });

    // v12.5.14 — Reportado en consultorio: el saludo diario (y los avisos en general)
    // llegaban también con la pestaña líder abierta en .../viva/Acceso/. Con el mismo
    // DOM de agenda visible de la prueba anterior, si la ruta es Acceso el saludo NO
    // debe salir (aunque siga sembrando notified con normalidad).
    t.caso("tick: fuera del módulo HCHealth (Acceso) no dispara el saludo diario", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/Acceso/";
      const contenedor = {
        querySelector: (sel) => ({
          ".status-label": { textContent: "Atendido" },
          ".text-muted": { textContent: "12345678" },
          ".text-uppercase.fw-bold": { textContent: "PACIENTE PRUEBA" },
          ".fw-bold.mb-0": { textContent: "Presencial" },
        }[sel] || null),
      };
      const nodoHora = {
        textContent: "07:00 AM",
        closest: () => contenedor,
        parentElement: null,
        ownerDocument: { body: c.env.doc.body },
      };
      c.env.doc.querySelector = (sel) => (sel === ".labelHora" || sel === ".status-label") ? {} : null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".labelHora" ? [nodoHora] : []);

      c.api.tick();
      t.igual(c.api.__state.summarized, true, "sigue sembrando el estado con normalidad");
      t.igual(c.api.__state.notified.size, 1, "la cita se siembra igual, sin depender del módulo");
      t.igual(c.env.almacen["vgl_hello"], undefined, "el saludo diario NO sale: la pestaña líder está en Acceso, no en HCHealth");
    });

    // v12.5.14 — tick() dispara la cola de avisos pendientes (_flushAvisosPendientes) en
    // TODA pestaña que esté en HCHealth, aunque no tenga marcadores de agenda/historia en
    // el DOM (p. ej. una pantalla de Órdenes/RCV dentro del mismo módulo clínico).
    // v14.1.5 — La cola ya solo guarda CARTELES: el tono y la notificación del sistema
    // salieron cuando el hecho ocurrió, sin esperar a nada. Lo que sigue vigente de esta
    // prueba es que el cartel pendiente SÍ se pinta en cuanto la pestaña está en HCHealth,
    // aunque la sección no sea agenda ni historia.
    t.caso("tick: en HCHealth (aunque la sección sea 'otra') pinta los carteles que quedaron en cola, sin volver a notificar", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/Ordenamiento";   // sin marcadores de agenda/historia
      let notifTitles = [];
      c.env.win.Notification = class { constructor(title) { notifTitles.push(title); } };
      c.env.win.Notification.permission = "granted";
      c.api.__S.cartel = true;   // el cartel de pantalla (bigAlert) monta #vgl-modal
      // Sin `ts`: es un aviso encolado por una versión anterior. No debe caducar por eso.
      c.api._encolarAvisoPendiente({ color: "ROJO", title: "t", body: "b", persist: true, uid: "queued|ROJO", flashText: "t" });

      c.api.tick();
      t.igual(c.api.__state.lastSeccion, "otra", "no hay marcadores de agenda/historia: la sección sigue siendo 'otra'");
      t.cierto(c.env.doc._nodos.some((n) => n.id === "vgl-modal"), "el cartel pendiente se pinta, porque la pestaña SÍ está en HCHealth");
      // v17.6.15 — este escenario (Ordenamiento, sin agenda en el DOM, API nunca aprendido)
      // ahora SÍ dispara una notificación distinta: el aviso honesto de "sin lectura de la
      // agenda" (ver caso siguiente). No es el mismo aviso que reenvía el cartel encolado
      // ("t"), así que se filtra por título en vez de subir a ciegas el contador a 1.
      t.falso(notifTitles.includes("t"), "el cartel encolado NO se vuelve a notificar al sistema: eso ya sonó cuando ocurrió el hecho");
      const cola = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola.length, 0, "la cola quedó vacía");
    });

    // v17.6.15 — REPORTE DE CAMPO (23-ago-2026): "los avisos llegan tarde si no estoy
    // directamente en Citas del día". Causa real: fuera de esa vista, el modo API en
    // segundo plano es la ÚNICA fuente posible — y si esa pestaña nunca aprendió la
    // llamada de agenda (apiSano()===false), no queda NINGUNA fuente viva. Antes esto
    // fallaba en silencio total; ahora avisa UNA vez al médico, honestamente, en vez de
    // dejarlo creer que está vigilado sin estarlo.
    t.caso("tick: sin API sano y fuera de agenda/historia (pero dentro de HCHealth), avisa UNA vez que está ciego", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/Ordenamiento";   // dentro del módulo, sección 'otra'
      c.env.doc.querySelectorAll = () => [];                          // sin agenda en el DOM
      let notifs = [];
      c.env.win.Notification = class { constructor(title, opt) { notifs.push({ title, body: opt && opt.body }); } };
      c.env.win.Notification.permission = "granted";

      c.api.tick();
      t.igual(notifs.length, 1, "avisa una vez que no tiene lectura de la agenda");
      t.cierto(/sin lectura/i.test(notifs[0].title), "el título es honesto sobre el estado ciego");
      t.cierto(/no puede avisar/i.test(notifs[0].body), "el cuerpo explica qué implica: ningún aviso mientras tanto");

      c.api.tick();
      t.igual(notifs.length, 1, "NO se repite en el mismo día: un aviso, no un martilleo");
    });

    // =====================================================================
    //  v18.0.8 — Y AHORA TAMBIÉN DENTRO DE LA HISTORIA CLÍNICA, QUE ES DONDE FALTABA
    //
    //  La guarda de v17.6.15 decía `!enVistaVigilada`, y eso es `secc !== "otra"`: VERDADERO
    //  también dentro de una historia. Pero el respaldo que justifica todo el aviso —leer la
    //  agenda del DOM— solo funciona en «Citas del día». Dentro de una historia, con el API
    //  caído, el Vigilante está exactamente igual de ciego… y ahí es donde el médico pasa la
    //  jornada. Reporte del 31-ago: 45 minutos sin evaluar una sola cita, sin ninguna señal,
    //  y los dos avisos saliendo de golpe con el mismo sello «Visto» cuando el API volvió.
    // =====================================================================
    t.caso("v18.0.8: dentro de una HISTORIA CLÍNICA, sin API sano, también avisa que está ciego", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/Historia";
      const getByIdReal = c.env.doc.getElementById.bind(c.env.doc);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { textContent: "" } : getByIdReal(id));  // sección 'historia'
      c.env.doc.querySelectorAll = () => [];
      let notifs = [];
      c.env.win.Notification = class { constructor(title, opt) { notifs.push({ title, body: opt && opt.body }); } };
      c.env.win.Notification.permission = "granted";

      c.api.tick();
      t.igual(notifs.length, 1, "en la historia también se dice: antes esta rama era inalcanzable");
      t.cierto(/sin lectura/i.test(notifs[0].title), "mismo aviso honesto");
    });

    t.caso("v18.0.8: en «Citas del día» NO se avisa de ceguera — ahí el respaldo del DOM sí existe", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/Citas";
      let notifs = [];
      c.env.win.Notification = class { constructor(title, opt) { notifs.push({ title, body: opt && opt.body }); } };
      c.env.win.Notification.permission = "granted";
      // seccionActiva() === "agenda" exige hora Y estado juntos en el DOM.
      c.env.doc.querySelector = (sel) => ({ textContent: "07:30 a. m." });
      c.api.tick();
      t.igual(notifs.length, 0,
        "estando en la agenda no se declara ciego: el scrape del DOM es la fuente, y decir lo contrario sería un falso aviso");
    });

    t.caso("_flushAvisosPendientes v14.1.5: un cartel de hace más de 10 minutos ya no se pinta — el aviso se dio en su momento", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/Ordenamiento";
      c.api.__S.cartel = true;
      c.api._encolarAvisoPendiente({ color: "ROJO", title: "viejo", body: "b", persist: true, uid: "rancio|ROJO", flashText: "t", ts: Date.now() - 660000 });

      c.api._flushAvisosPendientes();

      t.falso(c.env.doc._nodos.some((n) => n.id === "vgl-modal"), "un cartel de hace 11 minutos NO se pinta: haría atender una llegada que ya pasó");
      t.igual(JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]").length, 0, "la cola queda vacía en cualquier caso");
    });

    // ---------- downloadDiagnostic ----------
    t.caso("downloadDiagnostic: genera el archivo sanitizado y lo descarga en local", () => {
      const c = cargar({ silencioso: true });
      let blobCapturado = null;
      c.env.win.URL.createObjectURL = (b) => { blobCapturado = b; return "blob:diag"; };
      t.noLanza(() => c.api.downloadDiagnostic());
      const ancla = c.env.doc._nodos.find((n) => n.download === "diagnostico_vigilante_SANITIZADO.txt");
      t.cierto(!!ancla, "debe crearse el <a> de descarga con el nombre sanitizado");
      t.igual(ancla.href, "blob:diag");
      t.cierto(!!blobCapturado, "el contenido viaja en un Blob");
      const texto = String(blobCapturado.parts[0]);
      t.cierto(texto.includes("DIAGNÓSTICO — VIGILANTE v"), "cabecera con la versión");
      t.cierto(texto.includes("(no se encontró .labelHora)"), "sin agenda visible lo dice, no inventa una tarjeta");
      t.cierto(texto.includes("Archivo: sin cargar"), "estado real del PyM");
      t.cierto(texto.includes("Llamada aprendida: todavía no"), "estado real de la vía directa del API");
      t.falso(texto.includes("12345678"), "no debe viajar ninguna cédula");
    });

    t.caso("downloadDiagnostic: enmascara correctamente los IDs y omite los nombres (cero PHI)", () => {
      const c = cargar({ silencioso: true });
      let blobCapturado = null;
      c.env.win.URL.createObjectURL = (b) => { blobCapturado = b; return "blob:diag"; };

      // Documentos y nombres INVENTADOS (regla de cero PHI)
      c.api.__state.pym.set("1234567890", ["VIH"]);
      c.api.__state.pym.set("1112223330", ["Citología"]);
      c.api.__state.lastSnapshot = { list: [
        { doc_id: "1234567890", nombre: "PACIENTE FICTICIO UNO" },
        { doc_id: "9876543210", nombre: "PACIENTE FICTICIO DOS" }
      ] };

      c.api.downloadDiagnostic();
      const texto = String(blobCapturado.parts[0]);

      t.falso(texto.includes("1234567890"), "el ID 1 original no debe filtrarse en el texto");
      t.falso(texto.includes("9876543210"), "el ID 2 original no debe filtrarse en el texto");

      t.cierto(texto.includes("123…(10 díg.)"), "el ID 1 debe estar enmascarado");
      t.cierto(texto.includes("987…(10 díg.)"), "el ID 2 debe estar enmascarado");
      // No basta con que exista la etiqueta: el conteo real de coincidencias también es
      // lógica de negocio, y sin esta aserción una mutación que rompa el conteo (ej. "hit"
      // fijo) sobrevive al banco. Solo 1234567890 está en la base pym; 9876543210 no.
      t.cierto(texto.includes("COINCIDEN: 1/2"), "el conteo real de coincidencias debe ser correcto, no solo la etiqueta");

      // Esta aserción pasa vacuamente porque downloadDiagnostic no vuelca el campo nombre,
      // no cuenta como cobertura y la mutación no se comprueba contra ella.
      t.falso(texto.includes("PACIENTE FICTICIO"), "no debe filtrarse ningún nombre");
    });

    // v14.1.9 — El informe se cuidaba de ocultar PHI en TODO su cuerpo (`san()` sustituye
    // cada nodo de texto por "···", `mask()` recorta las cédulas a 3 dígitos) y luego la
    // filtraba en su propia CABECERA, escribiendo `location.href` y `document.title` en
    // crudo. En un sistema de historia clínica el título de la pestaña suele llevar el
    // NOMBRE del paciente, y la URL lleva identificadores en la consulta y el fragmento —
    // el propio script construye `...BusquedaPaciente#doc=<cédula>`.
    t.caso("downloadDiagnostic: la CABECERA tampoco filtra — ni el título de la pestaña ni la cédula de la URL", () => {
      const c = cargar({ silencioso: true });
      let blobCapturado = null;
      c.env.win.URL.createObjectURL = (b) => { blobCapturado = b; return "blob:diag"; };

      // Datos INVENTADOS, con la forma exacta que tienen los reales.
      c.env.win.location.href = "https://medicosviva1a.atheneasoluciones.com/Resultados/BusquedaPaciente?idPaciente=778899&token=abcxyz#doc=1234567890";
      c.env.doc.title = "Historia Clinica - PACIENTE FICTICIO TRES";

      c.api.downloadDiagnostic();
      const texto = String(blobCapturado.parts[0]);

      t.falso(texto.includes("1234567890"), "la cédula del fragmento (#doc=) NO puede viajar en el informe");
      t.falso(texto.includes("778899"), "tampoco el identificador de la consulta");
      t.falso(texto.includes("PACIENTE FICTICIO TRES"), "ni el nombre que el sistema pone en el título de la pestaña");
      t.falso(texto.includes("abcxyz"), "ni el token");

      // Y lo que SÍ tiene que quedar, porque es para lo que sirve el informe: en qué vista
      // estaba. Sin esto el arreglo se convierte en "borrarlo todo", que también es un fallo.
      t.cierto(texto.includes("/Resultados/BusquedaPaciente"), "la ruta se conserva: es lo que dice en qué pantalla estaba");
      t.cierto(texto.includes("2 parámetro(s) omitido(s)"), "se dice cuántos parámetros había, sin decir cuáles");
      t.cierto(texto.includes("fragmento omitido"), "y que había un fragmento");
      t.cierto(texto.includes("caracteres"), "del título solo se reporta su longitud");
    });

    // Hallazgo de una mutación: la prueba de arriba usa una URL con consulta Y fragmento, y
    // ahí el fragmento se cae de rebote al partir por "?". Con una URL de SOLO fragmento la
    // cédula se escapaba — y esa es justo la forma del enlace que el propio script
    // construye: `...BusquedaPaciente#doc=<cédula>`, sin ningún parámetro. El caso real era
    // el único que no estaba cubierto.
    t.caso("downloadDiagnostic: una URL de SOLO fragmento (la que arma el script para Athenea) tampoco filtra", () => {
      const c = cargar({ silencioso: true });
      let blobCapturado = null;
      c.env.win.URL.createObjectURL = (b) => { blobCapturado = b; return "blob:diag"; };
      c.env.win.location.href = "https://medicosviva1a.atheneasoluciones.com/Resultados/BusquedaPaciente#doc=1234567890";
      c.env.doc.title = "x";

      c.api.downloadDiagnostic();
      const texto = String(blobCapturado.parts[0]);

      t.falso(texto.includes("1234567890"), "sin parámetros que la tapen, la cédula del fragmento tiene que caer igual");
      t.cierto(texto.includes("/Resultados/BusquedaPaciente"), "y la ruta se conserva");
      t.cierto(texto.includes("fragmento omitido"), "se dice que había fragmento");
      t.falso(texto.includes("parámetro(s) omitido(s)"), "y no se inventan parámetros que no existían");
    });

    // ---------- uxClaveLimpia ----------
    //
    // La barrera que impide que un dato del paciente acabe siendo el NOMBRE de una métrica
    // enviada al tablero. Tenía los dos pasos en el orden equivocado y no paraba ninguna
    // cédula escrita como se escriben las cédulas de verdad.
    t.caso("uxClaveLimpia: una cédula con puntos NO pasa — el punto es carácter permitido, y ahí estaba el agujero", () => {
      const c = cargar({ silencioso: true });
      // Documentos INVENTADOS, con el formato exacto en que se escriben en Colombia.
      t.falso(c.api.uxClaveLimpia("labs.1.143.142.498.fin").includes("143"),
        "escrita con puntos no hay ningún tramo de 6 dígitos seguidos que quitar: salía entera");
      t.falso(c.api.uxClaveLimpia("300-123-4567").includes("123"), "lo mismo con el guion en un celular");
      t.falso(c.api.uxClaveLimpia("1 143 142 498").includes("143"),
        "y con espacios: se quitaban DESPUÉS de la única comprobación que los habría cazado, y los dígitos se pegaban");
      t.igual(c.api.uxClaveLimpia("1234567890"), "", "el caso que sí paraba la versión vieja sigue parándose");
      t.cierto(c.api.uxClaveLimpia("labs.1.143.142.498.fin").indexOf("labs") === 0,
        "lo que no es el dato se conserva: la clave sigue diciendo de qué acción venía");
    });

    t.caso("uxClaveLimpia: las claves reales del script sobreviven intactas — si no, la barrera ciega el tablero", () => {
      const c = cargar({ silencioso: true });
      // Las 38 claves reales son literales y ninguna lleva 6 dígitos; la más cargada es
      // "panel.silenciar15". Si el arreglo se pasa de celoso, el tablero se queda ciego —
      // que es exactamente el fallo que costó una semana de errores sin detectar (v14.1.6).
      for (const clave of ["labs.autollenado.click", "panel.silenciar15", "aviso.pym.mostrado.pes",
                           "ajustes.bannerpym.on", "widget.agendar.sololab", "error.js", "lab.agendado"]) {
        t.igual(c.api.uxClaveLimpia(clave), clave, "clave legítima alterada: " + clave);
      }
    });

    t.caso("uxClaveLimpia: el umbral se cuenta en DÍGITOS, no en caracteres — 5 dígitos pasan, 6 no", () => {
      // Otra mutación destapó que nada fijaba esto: contar los separadores como si fueran
      // dígitos daba el mismo resultado en todos los casos probados y era más agresivo, así
      // que se habría comido claves legítimas cortas sin que nadie lo notara. El contrato
      // que el comentario del código promete es este, y aquí queda sujeto por los dos lados.
      const c = cargar({ silencioso: true });
      t.igual(c.api.uxClaveLimpia("v.1.2.3.4.5"), "v.1.2.3.4.5", "5 dígitos repartidos entre puntos: por debajo del umbral, se conservan");
      t.igual(c.api.uxClaveLimpia("v.1.2.3.4.5.6"), "v", "6 dígitos, aunque vayan de uno en uno entre puntos: se van");
      t.igual(c.api.uxClaveLimpia("12345"), "12345", "cinco dígitos seguidos tampoco son un identificador");
      t.igual(c.api.uxClaveLimpia("123456"), "", "seis sí");
    });

    // ---------- pymReminderCheck ----------
    t.caso("pymReminderCheck: avisa una sola vez al día y solo pasada la hora configurada", () => {
      const c = cargar({ silencioso: true });
      // v12.3.36 — el liderazgo ya no es automático al arrancar (se gana con el primer
      // latido); esta prueba es del recordatorio, no del liderazgo, así que lo fija.
      c.api.__state.leader = true;
      const capturas = [];
      instalarNotificacion(c, capturas);
      // v15.4.0 — política de un solo canal: pestaña oculta para capturar la vía del sistema.
      c.env.doc.visibilityState = "hidden";
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-10T06:00:00";
      c.ctx.Date = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      // 06:00 < 07:30 (hora por defecto): todavía no toca
      c.api.pymReminderCheck();
      t.igual(c.env.almacen["vgl_rem"], undefined, "antes de la hora no se marca nada");
      t.igual(capturas.length, 0);
      // 08:00 > 07:30 y sin PyM cargado: avisa y deja la marca del día
      mockIso = "2026-08-10T08:00:00";
      c.api.pymReminderCheck();
      t.igual(c.env.almacen["vgl_rem"], "2026-08-10");
      t.igual(capturas.length, 1);
      t.cierto(capturas[0].title.includes("Falta el PyM de hoy"));
      // segunda pasada del mismo día: silencio
      c.api.pymReminderCheck();
      t.igual(capturas.length, 1, "una sola vez al día");
      // con recordatorio apagado no hace nada
      delete c.env.almacen["vgl_rem"];
      c.api.__S.recordatorio = "";
      c.api.pymReminderCheck();
      t.igual(c.env.almacen["vgl_rem"], undefined, "recordatorio '' = nunca");
      // con el PyM ya cargado tampoco
      c.api.__S.recordatorio = "07:30";
      c.api.__state.pymFile = "PyM_del_dia.xlsx";
      c.api.pymReminderCheck();
      t.igual(c.env.almacen["vgl_rem"], undefined, "si ya hay PyM no hay nada que recordar");
    });

    // ---------- avisarSiActualizado ----------
    t.caso("avisarSiActualizado: calla en la primera instalación y celebra la actualización real", () => {
      const c = cargar({ silencioso: true });
      const capturas = [];
      instalarNotificacion(c, capturas);
      // v15.4.0 — política de un solo canal: pestaña oculta para capturar la vía del sistema.
      c.env.doc.visibilityState = "hidden";
      // primera instalación: guarda la versión pero NO avisa
      c.api.avisarSiActualizado();
      const VERSION = c.env.gm["vgl_last_ver"];
      t.cierto(/^\d+\.\d+\.\d+$/.test(String(VERSION)), "quedó guardada la versión que arrancó");
      t.igual(c.env.gm["vgl_ver_desde"], hoyReal());
      t.igual(capturas.length, 0, "sin versión anterior no hay nada que celebrar");
      // arranque con la misma versión: nada cambia
      c.env.gm["vgl_ver_desde"] = "2020-01-01";
      c.api.avisarSiActualizado();
      t.igual(capturas.length, 0);
      t.igual(c.env.gm["vgl_ver_desde"], "2020-01-01", "sin cambio de versión NO se reinicia el contador");
      // el equipo venía de una versión vieja: avisa y reinicia el contador
      c.env.gm["vgl_last_ver"] = "1.0.0";
      c.api.avisarSiActualizado();
      t.igual(capturas.length, 1);
      t.cierto(capturas[0].title.includes("Centinela actualizado"));
      t.igual(c.env.gm["vgl_last_ver"], VERSION);
      t.igual(c.env.gm["vgl_ver_desde"], hoyReal(), "contador de 'desde cuándo' reiniciado");
    });

    // ---------- chequearAutoUpdateLento ----------
    t.caso("chequearAutoUpdateLento: recuerda a los 60 días y como máximo una vez al mes", () => {
      const c = cargar({ silencioso: true });
      // primera vez: solo siembra la fecha de referencia
      c.api.chequearAutoUpdateLento();
      t.igual(c.env.gm["vgl_ver_desde"], hoyReal());
      t.igual(c.env.gm["vgl_ver_aviso"], undefined, "recién sembrado no avisa");
      // menos de 60 días: silencio
      c.env.gm["vgl_ver_desde"] = hace(10);
      c.api.chequearAutoUpdateLento();
      t.igual(c.env.gm["vgl_ver_aviso"], undefined);
      // 100 días sin ver versión nueva: deja la marca del recordatorio
      c.env.gm["vgl_ver_desde"] = hace(100);
      c.api.chequearAutoUpdateLento();
      t.igual(c.env.gm["vgl_ver_aviso"], hoyReal());
      // si ya avisó hace 10 días, no fastidia otra vez
      c.env.gm["vgl_ver_aviso"] = hace(10);
      c.api.chequearAutoUpdateLento();
      t.igual(c.env.gm["vgl_ver_aviso"], hace(10), "el aviso mensual no se repite antes de 30 días");
      // pasados 30 días del último aviso, vuelve a recordar
      c.env.gm["vgl_ver_aviso"] = hace(45);
      c.api.chequearAutoUpdateLento();
      t.igual(c.env.gm["vgl_ver_aviso"], hoyReal());
    });

    // ---------- checkVersionMinimum ----------
    t.caso("checkVersionMinimum: versión vieja => marca de sesión, limpia SOLO vgl_pym_dia y respeta el candado 5 min", () => {
      const llamadas = [];
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          if (!String(o.url).includes("script.google.com")) return;
          llamadas.push(o.url);
          o.onload({ responseText: JSON.stringify({ minVersion: "99.0.0" }) });
        },
      });
      c.env.almacen["vgl_pym_dia"] = "2026-01-01";
      c.env.almacen["vgl_ev_20260101"] = "[]";   // bitácora de auditoría: NO debe tocarse
      c.api.checkVersionMinimum();
      t.igual(llamadas.length, 1);
      t.igual(c.env.win.sessionStorage._d["vgl_upd|99.0.0"], "1", "marca anti-bucle de recarga en sessionStorage");
      t.igual(c.env.almacen["vgl_pym_dia"], undefined, "solo se limpia la marca del PyM del día");
      t.igual(c.env.almacen["vgl_ev_20260101"], "[]", "la bitácora de auditoría queda intacta");
      // candado: dentro de los 5 minutos no vuelve a consultar
      c.api.checkVersionMinimum();
      t.igual(llamadas.length, 1, "máximo una consulta cada 5 minutos");
      // segunda vuelta REAL con la marca ya puesta: no vuelve a limpiar ni a recargar
      c.api.__state.lastVersionCheck = 0;
      c.env.almacen["vgl_pym_dia"] = "otra-vez";
      c.api.checkVersionMinimum();
      t.igual(llamadas.length, 2);
      t.igual(c.env.almacen["vgl_pym_dia"], "otra-vez", "con la marca de sesión puesta ya no toca nada");
    });

    t.caso("checkVersionMinimum: al día no hace nada, y con historia clínica abierta NUNCA recarga", () => {
      let respuesta = { minVersion: "0.0.1" };
      const llamadas = [];
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          if (!String(o.url).includes("script.google.com")) return;
          llamadas.push(o.url);
          o.onload({ responseText: JSON.stringify(respuesta) });
        },
      });
      c.env.almacen["vgl_pym_dia"] = "intacto";
      c.api.checkVersionMinimum();
      t.igual(llamadas.length, 1);
      t.igual(Object.keys(c.env.win.sessionStorage._d).length, 0, "versión al día: sin marcas");
      t.igual(c.env.almacen["vgl_pym_dia"], "intacto");
      // ahora el servidor exige 99.0.0 pero hay una historia clínica abierta (#anamesis)
      respuesta = { minVersion: "99.0.0" };
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      c.api.__state.lastVersionCheck = 0;
      c.api.checkVersionMinimum();
      t.igual(llamadas.length, 2);
      t.igual(Object.keys(c.env.win.sessionStorage._d).length, 0, "en historia clínica se pospone: ni marca ni recarga");
      t.igual(c.env.almacen["vgl_pym_dia"], "intacto", "y no se limpia nada");
    });

    // ---------- resolverMedicoPorPerfil ----------
    await t.casoAsync("resolverMedicoPorPerfil: fija el médico activo desde GetUsuarioPerfil y consulta UNA sola vez por login", async () => {
      let respuestaPerfil = { data: { id: "515", nombreCompleto: "PEDRO PEREZ GOMEZ", perfilCodigo: "PROFESIONAL" } };
      const consultas = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url) => {
          if (String(url).includes("GetUsuarioPerfil")) consultas.push(String(url));
          return {
            ok: true, status: 200, headers: { get: () => null },
            json: async () => respuestaPerfil,
            text: async () => JSON.stringify(respuestaPerfil),
            clone() { return this; },
          };
        },
      });
      await c.api.resolverMedicoPorPerfil("pedro.perez");
      t.igual(consultas.length, 1);
      t.cierto(consultas[0].includes("/GetUsuarioPerfil/pedro.perez"), "consulta la ficha del login detectado");
      t.igual(c.api.__state.activeDoctor.name, "PEDRO PEREZ GOMEZ");
      t.igual(c.api.__state.activeDoctor.id, 515, "el id llega como texto y se convierte a número");
      // memoizada: el mismo login no se vuelve a pedir
      await c.api.resolverMedicoPorPerfil("pedro.perez");
      t.igual(consultas.length, 1, "una sola consulta por login");
      // respuesta sin ficha: no pisa la identidad ya resuelta
      respuestaPerfil = {};
      await c.api.resolverMedicoPorPerfil("otro.login");
      t.igual(consultas.length, 2);
      t.igual(c.api.__state.activeDoctor.name, "PEDRO PEREZ GOMEZ", "sin data no se toca el médico activo");
      // login vacío: ni siquiera consulta
      await c.api.resolverMedicoPorPerfil("");
      t.igual(consultas.length, 2);
    });

    // v12.3.3 — El puente localhost:5050/buscar_laboratorios NUNCA existió; el puente real
    // (getAtheneaSolicitudesAuto) llama primero a
    // https://medicosviva1a.atheneasoluciones.com/Resultados/BusquedaPaciente. Estas dos
    // pruebas rastreaban la URL muerta: un mock que solo respondía a "buscar_laboratorios"
    // nunca llamaba onload/onerror/ontimeout contra la URL real, dejando la promesa de
    // _gmReq COLGADA para siempre — sin nada más pendiente en el event loop, Node salía en
    // silencio (exit 0) a mitad de esta suite, sin imprimir el resto de sus pruebas NI el
    // resumen final del banco. Reenrutadas al flujo real (verificado llamando la función
    // de verdad, no adivinado): la fuga se cierra rechazando la primera llamada real.
    // ---------- autoFetchAtheneaLabsForActivePatient ----------
    await t.casoAsync("autoFetchAtheneaLabsForActivePatient: sin paciente abierto no toca la red ni la bitácora", async () => {
      const llamadas = [];
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => { llamadas.push(o.url); o.onerror(new Error("sin sesión")); },
      });
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(llamadas.length, 0, "sin cédula no se consulta nada");
      const crudo = c.env.almacen["vgl_flight_recorder_logs"];
      const disparos = crudo ? JSON.parse(crudo).filter((e) => e.act === "AutoFetchTriggered") : [];
      t.igual(disparos.length, 0, "el registro va DESPUÉS de la guarda (v11.0.1): sin paciente, sin entrada");
    });

    await t.casoAsync("autoFetchAtheneaLabsForActivePatient: con paciente en historia dispara UNA vez y no repite por ráfagas", async () => {
      const llamadas = [];
      let datosPaso2 = "";
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          llamadas.push(o.url);
          if (String(o.url).includes("BusquedaPaciente")) { o.onload({ status: 200, responseText: "<input name=\"__RequestVerificationToken\" value=\"tok\">" }); return; }
          if (String(o.url).includes("BuscarPaciente")) { datosPaso2 = String(o.data); o.onerror(new Error("detenido tras confirmar la cédula")); return; }
          o.onerror(new Error("inesperado"));
        },
      });
      // historia clínica abierta: existe #anamesis y la cédula vive en un .text-muted
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted"
        ? [{ closest: () => null, textContent: "CC 12.345.678" }]
        : []);
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(llamadas.length, 2, "paso 1 (BusquedaPaciente) y paso 2 (BuscarPaciente)");
      t.cierto(llamadas[0].includes("BusquedaPaciente"));
      t.cierto(llamadas[1].includes("BuscarPaciente"));
      t.cierto(datosPaso2.includes('name="numId"') && datosPaso2.includes("12345678"), "la cédula sale limpia de puntos y espacios en el campo numId del multipart");
      const logs1 = JSON.parse(c.env.almacen["vgl_flight_recorder_logs"]).filter((e) => e.act === "AutoFetchTriggered");
      t.igual(logs1.length, 1);
      t.igual(logs1[0].det.section, "historia");
      // mismo paciente: no se vuelve a consultar (guarda lastAutoFetchedDoc)
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(llamadas.length, 2, "guarda anti-repetición: mismo paciente, ninguna llamada nueva");
      const logs2 = JSON.parse(c.env.almacen["vgl_flight_recorder_logs"]).filter((e) => e.act === "AutoFetchTriggered");
      t.igual(logs2.length, 1, "y tampoco se reescribe la bitácora al repetir");
    });

    // v12.10.15 — Bug real de auditoría nocturna ("auto-DDoS a Athenea"): un paciente con
    // CERO laboratorios en Athenea nunca actualizaba _labsPrefetch.ts (solo se cacheaba
    // cuando labs.length > 0), así que pasados los 30s del piso anti-ráfagas, el TTL de 10
    // minutos —que debería frenar la siguiente consulta— tampoco frenaba nada: el robot
    // repetía las 3 peticiones HTTP cada 30s de forma indefinida mientras la historia
    // siguiera abierta (riesgo real de bloqueo de IP por Athenea).
    await t.casoAsync("autoFetchAtheneaLabsForActivePatient: con CERO laboratorios en Athenea, el TTL de 10 min SÍ frena la siguiente consulta pasados los 30s (bug real de auditoría)", async () => {
      const llamadas = [];
      let ahora = new Date("2026-08-14T08:00:00").getTime();
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          llamadas.push(o.url);
          const url = String(o.url);
          if (url.includes("BusquedaPaciente")) { o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="tok">' }); return; }
          if (url.includes("BuscarPaciente")) { o.onload({ status: 200, responseText: '<input name="IdPaciente" value="999"><input name="__RequestVerificationToken" value="tok2">' }); return; }
          if (url.includes("DatosPaciente")) { o.onload({ status: 200, responseText: "CC: 12.345.678 — sin ninguna solicitud registrada." }); return; }
          if (o.onerror) o.onerror(new Error("url no simulada"));
        },
      });
      c.env.win.Date = class extends Date {
        static now() { return ahora; }
        constructor(...args) { if (args.length === 0) super(ahora); else super(...args); }
      };
      c.ctx.Date = c.env.win.Date;
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ closest: () => null, textContent: "CC 12.345.678" }] : []);

      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(llamadas.length, 3, "primera consulta real completa: BusquedaPaciente + BuscarPaciente + DatosPaciente (0 solicitudes encontradas)");

      // Avanza 31s — pasa el piso anti-ráfagas de 30s, pero sigue DENTRO del TTL de 10 min
      // de la pre-carga (que ahora sí quedó fijada, aunque haya sido con 0 laboratorios).
      ahora += 31000;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(llamadas.length, 3, "bug real de auditoría: antes esto disparaba 3 peticiones MÁS cada 30s indefinidamente");
    });

    // v12.3.14 — initLabMutationObserver fue ERRADICADA (observaba document.body ENTERO con
    // {childList:true,subtree:true}: cientos de mutaciones/minuto bajo Angular). La misma
    // validación vive ahora anclada a tick() — ver suite_18_athenea_sesion.js, que prueba
    // que createLabInjectorUI es idempotente y que tick() la llama solo en secc==="historia".

    await t.casoAsync("autoFetchAtheneaLabsForActivePatient: PRE-CARGA sin escribir — el robot ya no diligencia ninguna casilla solo (Incidente v12.3.34)", async () => {
      const campo = { id: "resultadoGlicemia", tagName: "INPUT", value: "", dispatchEvent: () => {} };
      const c = cargar({
        silencioso: true,
        gmxhr: (o) => {
          const url = String(o.url);
          if (url.endsWith("/Resultados/BusquedaPaciente")) { o.onload({ status: 200, responseText: '<input name="__RequestVerificationToken" value="TOK1">' }); return; }
          if (url.endsWith("/Resultados/BuscarPaciente")) { o.onload({ status: 200, responseText: '<input name="IdPaciente" value="55555"><input name="__RequestVerificationToken" value="TOK2">' }); return; }
          if (url.endsWith("/Resultados/DatosPaciente")) { o.onload({ status: 200, responseText: 'CC 12345678 <form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>' }); return; }
          if (url.includes("consultaDetalleSolicitud")) { o.onload({ status: 200, responseText: JSON.stringify({ dataObject: JSON.stringify([{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2026-08-01" }]) }) }); return; }
          if (o.onerror) o.onerror(new Error("url no simulada"));
        },
      });
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : (id === "resultadoGlicemia" ? campo : null));
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ closest: () => null, textContent: "CC 12.345.678" }] : []);
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(campo.value, "", "NADA se escribe en la historia sin el clic del médico");
      const logs = JSON.parse(c.env.almacen["vgl_flight_recorder_logs"] || "[]");
      t.cierto(logs.some((e) => e.act === "LabsAutoPrefetched"), "la pre-carga queda registrada en la bitácora");
      t.falso(logs.some((e) => e.act === "LabsAutoInjected"), "y ninguna inyección automática vuelve a ocurrir");
    });

    // ---------- boot ----------
    await t.casoAsync("boot: inicializa sistema, levanta timers y construye overlay (v12)", async () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);

      const _si = c.env.win.setInterval;
      const _st = c.env.win.setTimeout;
      const registeredIntervals = [];
      const registeredTimeouts = [];

      c.env.win.setInterval = (fn, ms) => {
        registeredIntervals.push({ fn, ms });
        return _si(fn, ms);
      };
      c.env.win.setTimeout = (fn, ms) => {
        registeredTimeouts.push({ fn, ms });
        return _st(fn, ms);
      };

      c.api.boot();

      t.cierto(registeredIntervals.some(i => i.ms === 300000 && i.fn === c.api.checkVersionMinimum), "boot configuró el intervalo para checkVersionMinimum");
      t.cierto(registeredIntervals.some(i => i.ms === 15000 && i.fn === c.api.paintMute), "boot configuró el intervalo para paintMute");
      t.cierto(registeredTimeouts.some(i => i.ms === 6000 && i.fn === c.api.chequearAutoUpdateLento), "boot configuró el timeout para chequearAutoUpdateLento");

      const prevIntervals = registeredIntervals.length;

      // Simular que el root ya existe en el DOM
      const rootMock = c.env.doc.createElement("div");
      rootMock.id = "vgl-root";

      c.api.boot();

      t.igual(registeredIntervals.length, prevIntervals, "boot() aborta tempranamente si #vgl-root ya existe en el DOM (guard)");
    });

    // v17.6.3 — Hueco documentado en INFORME_MUTACIONES ("timer escalonado sin
    // registrar"): ninguna prueba comprobaba que TODOS los timers que boot() crea
    // quedan en `state.timers` — la lista EXACTA que emergencyTeardown() cancela con
    // el kill-switch. La mutación que omitía `tVerMin` del push sobrevivió por eso.
    // Este caso la caza: el conteo de handles debe subir en 14 (los once del push
    // principal —tRepBoot incluido, ver v17.6.83+— + tSonda + tPymDiario +
    // tPymCaptador) y el handle del chequeo de versión escalonado (setTimeout 4 s)
    // tiene que estar entre ellos.
    await t.casoAsync("boot: TODOS los timers quedan registrados en state.timers (tVerMin incluido) para que el kill-switch los cancele", async () => {
      const c = cargar({ silencioso: true });
      enriquecerDom(c);
      const _si = c.env.win.setInterval;
      const _st = c.env.win.setTimeout;
      const handles = [];
      c.env.win.setInterval = (fn, ms) => { const h = _si(fn, ms); handles.push({ fn, ms, h }); return h; };
      c.env.win.setTimeout = (fn, ms) => { const h = _st(fn, ms); handles.push({ fn, ms, h }); return h; };

      const antes = c.api.__state.timers.length;
      c.api.boot();
      const timers = c.api.__state.timers;

      t.igual(timers.length, antes + 14,
        "boot registra los 14 timers que crea (tAutoUpd, tVerMin, tVer, tPaint, tPymRem, tRepSum, tRepBoot, tRepFlush, tUxBoot, tUxFlush, tRepEnt, tSonda, tPymDiario, tPymCaptador)");

      const verMin = handles.find((x) => x.fn === c.api.checkVersionMinimum && x.ms === 4000);
      t.cierto(!!verMin, "el chequeo de versión escalonado existe (setTimeout 4 s)");
      t.cierto(timers.indexOf(verMin.h) >= 0,
        "tVerMin está en state.timers: si se omite del push, el kill-switch no lo cancela y sigue consultando la red con la interfaz retirada");
    });


    // =====================================================================
    //  v18.0.8 — QUIEN NO PUEDE EVALUAR NO PUEDE MANDAR
    //
    //  REPORTE EN VIVO (31-ago, dos capturas): dos avisos ÁMBAR de citas distintas (9:30 y
    //  10:00) llegaron con EL MISMO sello «Visto 10:20:44», con +50,7 y +20,7 min de
    //  desfase. La diferencia entre los dos desfases es exactamente 30,0 — la distancia
    //  entre las dos citas. Las dos se evaluaron en el MISMO tick, unos 45 minutos tarde.
    //
    //  El sello se pone al EVALUAR (colorAndAlert), no al notificar, así que esto no es un
    //  aviso que salió tarde: es que nadie miró la agenda en 45 minutos. La causa: el canal
    //  "latido" que dispara heartbeat() vive en el nivel superior del IIFE y corre en TODA
    //  pestaña de Everest, pero el canal "tick" —el que de verdad evalúa— solo se registra
    //  en restartPolling(), que empieza con `if (!el || !el.root) return`. Una pestaña sin
    //  panel (fuera de HCHealth, instancia duplicada, boot abortado) latía igual, ganaba el
    //  mando y no miraba nada; las demás se ponían leader=false y callaban.
    //
    //  Es la regla que el médico dejó escrita: «siempre debe estar analizando citas del día
    //  con esa pestaña líder; las demás no tienen por qué generar notificaciones».
    // =====================================================================
    t.caso("v18.0.8: una pestaña SIN reloj de evaluación no puede ser líder", () => {
      const c = cargar({ silencioso: true });
      c.api.__reloj.canales.delete("tick");        // como una pestaña sin panel construido
      t.igual(c.api.heartbeat(), false, "no toma el mando");
      t.falso(c.api.__state.leader, "y se declara no-líder");
    });

    t.caso("v18.0.8: la pestaña ciega tampoco PUBLICA latido — si no, seguiría bloqueando a las demás", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.removeItem("vgl_leader_beat");
      c.api.__reloj.canales.delete("tick");
      c.api.heartbeat();
      const beat = c.env.storage.getItem("vgl_leader_beat");
      t.cierto(beat === null || beat === undefined || beat === "",
        "sin latido publicado: es la mitad que impedía a la pestaña buena tomar el mando");
    });

    t.caso("v18.0.8: con reloj de evaluación, el liderazgo funciona exactamente igual que antes", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.removeItem("vgl_leader_beat");
      t.igual(c.api.heartbeat(), true, "una pestaña arrancada sí toma el mando");
      t.cierto(c.api.__state.leader, "y queda como líder");
      t.cierto(!!c.env.storage.getItem("vgl_leader_beat"), "publicando su latido");
    });

    t.caso("v18.0.8: la pestaña ciega SUELTA el mando y la que sí evalúa se lo queda", () => {
      // Reproducción del 31-ago: A es la pestaña sin panel (la que retenía el mando),
      // B es la pestaña clínica. Con la guarda, B puede liderar aunque A siga latiendo.
      const A = cargar({ silencioso: true });
      A.api.__reloj.canales.delete("tick");
      A.api.heartbeat();
      const B = cargar({ almacen: A.env.almacen, storage: A.env.storage, silencioso: true });
      t.igual(B.api.heartbeat(), true, "la pestaña que SÍ evalúa toma el mando");
      t.falso(A.api.__state.leader, "y la ciega no lo tiene");
    });

    // =====================================================================
    //  v18.0.9 — RELEVO POR CEGUERA: UN LÍDER QUE NO VE NO SE QUEDA CON EL MANDO
    //
    //  Hasta aquí el mando solo cambiaba por VISIBILIDAD (v14.1.5): un líder OCULTO, al que
    //  el navegador estrangula el temporizador, se lo cede a uno a la vista. Pero un líder
    //  A LA VISTA y sin ninguna fuente —API caído y fuera de «Citas del día», que es el caso
    //  del médico trabajando dentro de una historia clínica— lo retenía indefinidamente
    //  mientras otra pestaña, capaz de leer, se quedaba callada.
    //
    //  Encargo del médico (31-ago): «siempre debe estar analizando citas del día con esa
    //  pestaña líder». Ahora el latido lleva `ve`, y quien ve puede relevar a quien no ve.
    // =====================================================================
    t.caso("v18.0.9: el latido publica si esta pestaña PUEDE leer la agenda", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.removeItem("vgl_leader_beat");
      c.api.heartbeat();
      const beat = JSON.parse(c.env.storage.getItem("vgl_leader_beat") || "null");
      t.cierto(!!beat, "hay latido");
      t.cierto(typeof beat.ve === "boolean", "y declara si ve la agenda o no · ve=" + beat.ve);
    });

    t.caso("v18.0.9: una pestaña que SÍ ve releva a un líder ciego, aunque el líder esté a la vista", () => {
      const c = cargar({ silencioso: true });
      // Líder ajeno, fresco, A LA VISTA (no relevable por visibilidad) y CIEGO.
      c.env.storage.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now(), oculta: false, ve: false }));
      // Esta pestaña sí ve: se simula estando en «Citas del día» (hora + estado en el DOM).
      c.env.doc.querySelector = () => ({ textContent: "07:30 a. m." });
      t.igual(c.api.heartbeat(), true, "se lleva el mando: el otro no estaba vigilando nada");
    });

    t.caso("v18.0.9: si el líder ciego y yo estamos los dos ciegos, NO hay relevo — no arreglaría nada", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now(), oculta: false, ve: false }));
      c.env.doc.querySelector = () => null;          // ni agenda en el DOM ni API sano
      t.igual(c.api.heartbeat(), false, "sin poder leer, quitarle el mando solo movería la ceguera de sitio");
    });

    t.caso("v18.0.9: a un líder que SÍ ve no se le quita el mando por esta vía", () => {
      const c = cargar({ silencioso: true });
      c.env.storage.setItem("vgl_leader_beat", JSON.stringify({ id: "otra-pestana", t: Date.now(), oculta: false, ve: true }));
      c.env.doc.querySelector = () => ({ textContent: "07:30 a. m." });
      t.igual(c.api.heartbeat(), false, "el líder está vigilando: no hay motivo para relevarlo");
    });
  },
};
