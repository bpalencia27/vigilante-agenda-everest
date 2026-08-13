

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
    "heartbeat", "share", "helloOncePerDay", "tick", "downloadDiagnostic",
    "pymReminderCheck", "avisarSiActualizado", "chequearAutoUpdateLento",
    "checkVersionMinimum", "resolverMedicoPorPerfil",
    "autoFetchAtheneaLabsForActivePatient",
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
      t.igual(c.api.__state.notified.get("12345678@07:00 AM"), "VERDE", "sembrada con su clave y color reales");
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
    t.caso("tick: en HCHealth (aunque la sección sea 'otra') dispara los avisos que quedaron en cola", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/Ordenamiento";   // sin marcadores de agenda/historia
      let notifCount = 0;
      c.env.win.Notification = class { constructor() { notifCount++; } };
      c.env.win.Notification.permission = "granted";
      c.api._encolarAvisoPendiente({ color: "ROJO", title: "t", body: "b", persist: true, uid: "queued|ROJO", flashText: "t" });

      c.api.tick();
      t.igual(c.api.__state.lastSeccion, "otra", "no hay marcadores de agenda/historia: la sección sigue siendo 'otra'");
      t.igual(notifCount, 1, "el aviso en cola se dispara igual, porque la pestaña SÍ está en HCHealth");
      const cola = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola.length, 0, "la cola quedó vacía");
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
      t.cierto(texto.includes("COINCIDEN:"), "debe contener la línea de 'COINCIDEN:'");

      // Esta aserción pasa vacuamente porque downloadDiagnostic no vuelca el campo nombre,
      // no cuenta como cobertura y la mutación no se comprueba contra ella.
      t.falso(texto.includes("PACIENTE FICTICIO"), "no debe filtrarse ningún nombre");
    });

    // ---------- pymReminderCheck ----------
    t.caso("pymReminderCheck: avisa una sola vez al día y solo pasada la hora configurada", () => {
      const c = cargar({ silencioso: true });
      // v12.3.36 — el liderazgo ya no es automático al arrancar (se gana con el primer
      // latido); esta prueba es del recordatorio, no del liderazgo, así que lo fija.
      c.api.__state.leader = true;
      const capturas = [];
      instalarNotificacion(c, capturas);
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
      t.cierto(capturas[0].title.includes("Vigilante actualizado"));
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

  },
};
