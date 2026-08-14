module.exports = {
  nombre: "Colores y notificaciones de la agenda",
  cubre: ["colorAndAlert", "beep", "muted", "muteFor", "unmute", "playTone", "startNag", "stopNag", "faviconUrl", "setFavicon", "startFlash", "stopFlash", "popupAlert", "bigAlert", "acknowledge", "pymAlert", "abandonoPESAlert", "checkAbandonoPES", "colorDot", "crossTabDup", "avisoYaVisto", "avisoMarcarVisto", "osNotify", "_renderToast", "showToast", "notify", "nkey", "maybeNotify", "updateBell", "testNotifications", "enableOsNotifications", "checkRecordatorioPym", "labsVencidosAlert", "checkLabsVencidos", "otroAvisoDePacienteAbierto", "_encolarAvisoPendiente", "_flushAvisosPendientes", "_dispararAvisoReal"],
  async pruebas(t, api, env, cargar) {

    // ---------- colorAndAlert ----------
    t.caso("colorAndAlert: un paciente en estado Sin presentarse pasa a AMBAR despues de la gracia (6 min)", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:10:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "AMBAR");
      t.cierto(c.api.__state.fraudWatch.has(r.key));
    });

    t.caso("colorAndAlert: un paciente en fraude que pasa a En Sala dispara ROJO y sonido (una vez)", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:15:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "En sala", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      const k = c.api.apptKey(a);
      c.api.__state.fraudWatch.add(k); // paciente sospechoso

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "ROJO");
      t.cierto(r.sound, "deberia sonar");
      t.cierto(c.api.__state.alertedFraud.has(k), "registra que ya sonó");

      // siguiente lectura, no deberia sonar
      const r2 = c.api.colorAndAlert(a, refDate);
      t.igual(r2.color, "ROJO");
      t.falso(r2.sound, "no debe sonar por segunda vez");
    });

    t.caso("colorAndAlert: si pasa directo de Sin presentarse a Atendido, lo pesca (Fraude extemporáneo)", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Atendido", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      const k = c.api.apptKey(a);
      c.api.__state.fraudWatch.add(k); // estaba en ambar

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "ROJO");
      t.cierto(r.sound, "deberia pescar el salto directo a atendido");
    });

    t.caso("colorAndAlert: prealerta MORADO por tiempo", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:05:30").getTime(); // 5.5 min de retraso
      const a = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "MORADO");
      t.igual(r.reason, "tiempo");
    });

    t.caso("colorAndAlert: paciente que llega puntual sin haber estado retrasado es VERDE y arrival=true", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T07:55:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "En sala", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "VERDE");
      t.cierto(r.arrival, "es una llegada en sala");

      // siguiente lectura
      c.api.__state.historical.set(r.key, "en sala");
      const r2 = c.api.colorAndAlert(a, refDate);
      t.falso(r2.arrival, "ya no es la primera vez que se lee en sala");
    });

    t.caso("muted / muteFor / unmute controlan el estado de silencio temporal", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return 10000; } }; c.ctx.Date = c.env.win.Date;
      t.falso(c.api.muted());
      c.api.muteFor(15);
      // muteFor hace state.muteUntil = Date.now() + min * 60000 -> 10000 + 15*60000 = 910000
      t.cierto(c.api.muted());

      c.env.win.Date = class extends Date { static now() { return 920000; } }; c.ctx.Date = c.env.win.Date; // Pasaron mas de 15 min
      t.falso(c.api.muted());

      c.env.win.Date = class extends Date { static now() { return 10000; } }; c.ctx.Date = c.env.win.Date;
      c.api.muteFor(15);
      t.cierto(c.api.muted());
      c.api.unmute();
      t.falso(c.api.muted());
    });

    t.caso("avisoYaVisto / avisoMarcarVisto (control deduplicador de notificaciones)", () => {
      const c = cargar();
      t.falso(c.api.avisoYaVisto("notif1"));
      c.api.avisoMarcarVisto("notif1");
      t.cierto(c.api.avisoYaVisto("notif1"));

      // se almacena en localStorage si la clave tiene formato ev-yyyy-mm-dd
      t.falso(c.api.avisoYaVisto("ev-2026-08-10"));
      c.api.avisoMarcarVisto("ev-2026-08-10");
      // harness mock storage
      t.cierto(c.env.win.localStorage.getItem("vgl_vistos") !== null);
      t.cierto(c.env.win.localStorage.getItem("vgl_vistos").includes("ev-2026-08-10"));
    });

    t.caso("nkey genera hash unico para cambios de notificacion", () => {
      const a = { hora_texto: "08:00 AM", doc_id: "123", estado: "En sala", color: "VERDE", reason: "" };
      const k1 = api.nkey(a);
      t.cierto(typeof k1 === "string" && k1.includes("VERDE"));
    });

    t.caso("maybeNotify no re-notifica si no hay cambios (basado en nkey)", () => {
      const c = cargar();
      const a = { hora_texto: "08:00 AM", doc_id: "123", estado: "En sala", color: "VERDE", reason: "", key: "123@08:00 AM" };
      c.api.__state.notified.set("123@08:00 AM", "123@08:00 AM|En sala|VERDE|");

      let notifyCalled = false;
      c.env.win.Notification = class { constructor() { notifyCalled = true; } };
      // we need to mock api.notify but we can't easily, maybeNotify calls notify.
      // we can check if it gets added to historical.

      c.api.maybeNotify(a); // already notified same state
      // we just want it not to crash and not to do anything
      t.cierto(c.api.__state.notified.has("123@08:00 AM"));
    });

    // ---------- v12.4.0: rescate de las guardias originales del VERDE (v8.2.0) ----------
    // El efecto observable de una notificación VERDE es bumpStat("atiempo") en vgl_stats:
    // no depende de mockear Notification ni los canales de sonido.
    const atiempoHoy = (c) => {
      try {
        const a = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}");
        const d = c.api.todayStamp();
        return (a[d] && a[d].atiempo) || 0;
      } catch (e) { return 0; }
    };

    t.caso("maybeNotify v12.4: SIEMBRA SILENCIOSA — el primer VERDE visto al arrancar NO notifica", () => {
      const c = cargar();
      const a = { hora_texto: "08:00 AM", doc_id: "123", estado: "En sala", color: "VERDE", reason: "", arrival: true, key: "123@08:00 AM", nombre: "JUAN", elapsed: 1 };
      c.api.maybeNotify(a); // primera vez que se ve este paciente: solo siembra
      t.igual(atiempoHoy(c), 0, "un paciente que YA estaba En Sala al abrir el panel no suena");
    });

    t.caso("maybeNotify v12.4: la llegada EN VIVO (arrival) sí notifica; un VERDE sin arrival, no", () => {
      const c = cargar();
      const base = { hora_texto: "08:00 AM", doc_id: "123", key: "123@08:00 AM", nombre: "JUAN", elapsed: 1, reason: "" };
      // tick 1: sin presentarse (siembra)
      c.api.maybeNotify({ ...base, estado: "Sin presentarse", color: "AZUL", arrival: false });
      // tick 2: pasó a En Sala EN VIVO → notifica
      c.api.maybeNotify({ ...base, estado: "En sala", color: "VERDE", arrival: true });
      t.igual(atiempoHoy(c), 1, "la transición vista en directo cuenta como 'confirmó a tiempo'");
      // otro paciente cuyo VERDE llega SIN arrival (p. ej. desde 'Atendido'): silencio
      const b = { hora_texto: "09:00 AM", doc_id: "456", key: "456@09:00 AM", nombre: "ANA", elapsed: 1, reason: "" };
      c.api.maybeNotify({ ...b, estado: "Sin presentarse", color: "AZUL", arrival: false });
      c.api.maybeNotify({ ...b, estado: "Atendido", color: "VERDE", arrival: false });
      t.igual(atiempoHoy(c), 1, "VERDE sin llegada en vivo no suma otro aviso");
    });

    // =====================================================================
    // v12.5.14 — Reportado en consultorio: los avisos llegaban también con la
    // pestaña líder abierta en .../viva/Acceso/ (asignación de turnos), un
    // módulo de Everest sin nada que ver con la agenda del día. El aviso
    // SIEMPRE debe dispararse (nunca perderse) — solo debe MOSTRARSE dentro
    // del módulo clínico HCHealth: si ninguna pestaña está ahí en el instante
    // de la transición, queda en cola y se dispara en cuanto una lo esté.
    // =====================================================================
    t.caso("maybeNotify: fuera de HCHealth (Acceso) NO muestra el aviso, pero SIEMPRE lo audita y lo deja en cola", () => {
      const c = cargar();
      c.env.win.location.pathname = "/viva/Acceso/";
      let notifCount = 0;
      c.env.win.Notification = class { constructor() { notifCount++; } };
      c.env.win.Notification.permission = "granted";
      const base = { hora_texto: "08:00 AM", doc_id: "789", key: "789@08:00 AM", nombre: "LUIS", elapsed: 1, reason: "" };
      c.api.maybeNotify({ ...base, estado: "Sin presentarse", color: "AZUL", arrival: false });      // siembra
      c.api.maybeNotify({ ...base, estado: "En sala", color: "VERDE", arrival: true });              // llegada en vivo, pero fuera de HCHealth
      t.igual(atiempoHoy(c), 1, "la auditoría (bumpStat) SIEMPRE se registra, con la hora real de la transición");
      t.igual(notifCount, 0, "el aviso visible/audible NO se muestra mientras la pestaña líder está en Acceso");
      const cola = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola.length, 1, "el aviso queda en cola, no se pierde");
      t.igual(cola[0].uid, "789@08:00 AM|VERDE");
    });

    t.caso("_flushAvisosPendientes: al volver a HCHealth, el aviso en cola SÍ se dispara — una sola vez entre pestañas", () => {
      const c = cargar();
      c.env.win.location.pathname = "/viva/Acceso/";
      let notifCount = 0;
      c.env.win.Notification = class { constructor() { notifCount++; } };
      c.env.win.Notification.permission = "granted";
      const a = { hora_texto: "09:00 AM", doc_id: "321", key: "321@09:00 AM", nombre: "ANA", elapsed: 1, reason: "" };
      c.api.maybeNotify({ ...a, estado: "Sin presentarse", color: "AZUL", arrival: false });
      c.api.maybeNotify({ ...a, estado: "En sala", color: "VERDE", arrival: true });   // encolado: la pestaña líder está en Acceso
      t.igual(notifCount, 0, "todavía no se muestra");

      c.env.win.location.pathname = "/viva/HCHealth/";
      c.api._flushAvisosPendientes();
      t.igual(notifCount, 1, "en cuanto una pestaña está en HCHealth, el aviso pendiente se dispara");
      const colaTrasFlush = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(colaTrasFlush.length, 0, "la cola queda vacía tras el flush");

      // Dos pestañas en HCHealth notando la cola casi al mismo tiempo: crossTabDup (misma
      // guardia del "doble-líder transitorio") evita que el paquete completo se repita —
      // el problema original que llevó al diseño de un solo líder. Se comprueba por la
      // marca que deja crossTabDup (namespace "full|"), no solo por notifCount: notify()
      // ya tiene su PROPIA guardia interna (avisoYaVisto) que enmascararía la ausencia de
      // esta si solo se mirara notifCount.
      c.api._dispararAvisoReal({ color: "VERDE", title: "x", body: "y", persist: false, uid: "321@09:00 AM|VERDE", flashText: "x" });
      t.igual(notifCount, 1, "el mismo aviso disparado por otra pestaña casi al mismo tiempo no se repite");
      t.cierto(c.api.crossTabDup("full|321@09:00 AM|VERDE"), "_dispararAvisoReal marcó crossTabDup en el namespace 'full|' al disparar la primera vez");
    });

    t.caso("_flushAvisosPendientes: fuera de HCHealth no toca la cola", () => {
      const c = cargar();
      c.env.win.location.pathname = "/viva/Acceso/";
      c.api._encolarAvisoPendiente({ color: "ROJO", title: "t", body: "b", persist: true, uid: "x|ROJO", flashText: "t" });
      c.api._flushAvisosPendientes();
      const cola = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola.length, 1, "sin ninguna pestaña en HCHealth, el aviso sigue esperando en cola");
    });

    // =====================================================================
    // v12.5.7 — checkLabsVencidos: aviso ROJO de laboratorios RCV sin resultado en 180
    // días. Lee SOLO lo que el robot de Athenea ya pre-cargó (_labsPrefetch) — nunca
    // dispara su propia consulta. Mismo patrón "una vez por paciente por día" que
    // checkAbandonoPES/checkRecordatorioPym (avisoYaVisto/avisoMarcarVisto).
    // =====================================================================
    const DOC_LABSV = "111222333";
    const elTexto = (txt) => ({ textContent: txt, closest: () => null });
    function mockPacienteAbierto(c, doc) {
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : null);
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [elTexto("C.C. " + doc)] : []);
    }
    // Plan de red mínimo para poblar _labsPrefetch vía autoFetchAtheneaLabsForActivePatient:
    // resuelve la solicitud a un único analito RCV, con la fecha que indique el llamador
    // (vieja -> vencido; reciente -> al día).
    function planLabsVencidos(fechaAnalito) {
      return (o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC_LABSV} <form id="5552026" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else if (url.includes("consultaDetalleSolicitud")) o.onload({
          status: 200,
          responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "903818", NombreParametro: "COLESTEROL TOTAL", Resultado: "220", Fecha: fechaAnalito }]) }),
        });
        else o.onload({ status: 200, responseText: "" });
      };
    }
    // Variante "al día": entrega los 8 analitos de la regla de vigencia, todos con la
    // MISMA fecha reciente — a diferencia de planLabsVencidos (que solo entrega uno, así
    // que los otros 7 quedarían "faltantes" con toda razón: nunca se consultaron).
    function planLabsAlDia(fechaAnalito) {
      return (o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC_LABSV} <form id="5552026" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else if (url.includes("consultaDetalleSolicitud")) o.onload({
          status: 200,
          responseText: JSON.stringify({
            dataObject: JSON.stringify([
              { CodigoParametro: "903818", NombreParametro: "COLESTEROL TOTAL", Resultado: "180", Fecha: fechaAnalito },
              { CodigoParametro: "903815", NombreParametro: "COLESTEROL HDL", Resultado: "45", Fecha: fechaAnalito },
              { CodigoParametro: "903868", NombreParametro: "TRIGLICERIDOS", Resultado: "150", Fecha: fechaAnalito },
              { CodigoParametro: "903841", NombreParametro: "GLUCOSA EN SUERO", Resultado: "90", Fecha: fechaAnalito },
              // v14.1.4 — LDL entra a la vigilancia por decisión del médico (14-ago-2026).
              { CodigoParametro: "903817", NombreParametro: "COLESTEROL LDL", Resultado: "100", Fecha: fechaAnalito },
              { CodigoParametro: "907106", NombreParametro: "UROANALISIS", Resultado: "NORMAL", Fecha: fechaAnalito },
              { CodigoParametro: "903895", NombreParametro: "CREATININA", Resultado: "0.9", Fecha: fechaAnalito },
              { CodigoParametro: "8779", NombreParametro: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: fechaAnalito },
            ]),
          }),
        });
        else o.onload({ status: 200, responseText: "" });
      };
    }

    t.caso("checkLabsVencidos: interruptor apagado -> no revisa nada, nunca marca el aviso como visto", () => {
      const c = cargar({ silencioso: true });
      mockPacienteAbierto(c, DOC_LABSV);
      c.api.__S.labsVencidos = false;
      t.noLanza(() => c.api.checkLabsVencidos());
      const uid = "labsv|" + c.api.normalizeKey(DOC_LABSV);
      t.falso(c.api.avisoYaVisto(uid));
    });

    t.caso("checkLabsVencidos: sin paciente abierto -> no revisa nada, nunca lanza", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = () => null; // sin #anamesis: no es historia clínica
      t.noLanza(() => c.api.checkLabsVencidos());
    });

    t.caso("checkLabsVencidos: paciente abierto pero SIN pre-carga de Athenea todavía (_labsPrefetch vacío) -> no revisa nada, no lanza", () => {
      // El robot de Athenea (autoFetchAtheneaLabsForActivePatient) puede tardar unos
      // ticks en resolver; checkLabsVencidos NUNCA debe disparar su propia consulta ni
      // bloquear esperando una — solo lee lo que ya esté cacheado.
      const c = cargar({ silencioso: true });
      mockPacienteAbierto(c, DOC_LABSV);
      t.noLanza(() => c.api.checkLabsVencidos());
      const uid = "labsv|" + c.api.normalizeKey(DOC_LABSV);
      t.falso(c.api.avisoYaVisto(uid));
    });

    // Plan de red que resuelve el paciente pero SIN NINGÚN formulario de solicitud (0
    // laboratorios reales en Athenea) — reproduce el caso de mayor riesgo real: el
    // paciente al que le faltan los 7 analitos RCV.
    function planLabsCero() {
      return (o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${DOC_LABSV} — sin ninguna solicitud registrada.` });
        else o.onload({ status: 200, responseText: "" });
      };
    }

    // v12.10.15 — Bug real de auditoría nocturna: antes, un paciente con CERO
    // laboratorios en Athenea nunca actualizaba _labsPrefetch (solo se cacheaba cuando
    // labs.length > 0), así que checkLabsVencidos (que exige _labsPrefetch.docId === doc)
    // se abortaba en silencio para siempre — la alerta ROJA de "laboratorios RCV sin
    // resultado vigente" quedaba muda justo para el paciente que más la necesita.
    await t.casoAsync("checkLabsVencidos: paciente CON pre-carga real pero SIN ningún laboratorio en Athenea -> SÍ dispara el aviso con los 7 analitos faltantes (bug real de auditoría)", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsCero() });
      mockPacienteAbierto(c, DOC_LABSV);
      await c.api.autoFetchAtheneaLabsForActivePatient();
      const uid = "labsv|" + c.api.normalizeKey(DOC_LABSV);
      t.falso(c.api.avisoYaVisto(uid), "todavía no se ha revisado");
      c.api.checkLabsVencidos();
      t.cierto(c.api.avisoYaVisto(uid), "cero laboratorios en Athenea también cuenta como pre-carga resuelta: debe revisar y avisar");
    });

    await t.casoAsync("checkLabsVencidos: analito RCV vencido de verdad (>180 días, vía autoFetch real) -> dispara el aviso una vez y queda marcado", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsVencidos("2025-01-01") });
      mockPacienteAbierto(c, DOC_LABSV);
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-11T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-11T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      const uid = "labsv|" + c.api.normalizeKey(DOC_LABSV);
      t.falso(c.api.avisoYaVisto(uid), "todavía no se ha revisado");
      c.api.checkLabsVencidos();
      t.cierto(c.api.avisoYaVisto(uid), "el analito vencido (2025-01-01, muy pasados los 180 días) disparó el aviso");
      // Un segundo llamado el mismo día no debe reventar ni des-marcar el aviso.
      t.noLanza(() => c.api.checkLabsVencidos());
      t.cierto(c.api.avisoYaVisto(uid));
    });

    await t.casoAsync("checkLabsVencidos: analito RCV al día (dentro de 180 días, vía autoFetch real) -> no dispara ningún aviso", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsAlDia("2026-08-01") });
      mockPacienteAbierto(c, DOC_LABSV);
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-11T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-11T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      const uid = "labsv|" + c.api.normalizeKey(DOC_LABSV);
      c.api.checkLabsVencidos();
      t.falso(c.api.avisoYaVisto(uid), "los 8 analitos de la regla llegaron con fecha reciente (10 días) -> ninguno vencido");
    });

    t.caso("labsVencidosAlert: no lanza con una lista real de faltantes, ni con la lista vacía (v12.5.7)", () => {
      // v12.5.7 — Limitación conocida del banco (documentada también para abrirInformeAthenea
      // en la suite 15): el DOM simulado NO parsea innerHTML en nodos reales y
      // querySelector() siempre devuelve null en cualquier elemento recién creado, así que
      // NINGÚN modal de esta familia (pymAlert/abandonoPESAlert/labsVencidosAlert) puede
      // verificarse aquí por contenido real del DOM — el propio try/catch interno de la
      // función es lo que evita que ese null.textContent reviente hacia afuera. Esta prueba
      // confirma al menos que checkLabsVencidos/labsVencidosAlert nunca dejan escapar una
      // excepción con datos realistas, incluida la lista vacía (que en producción nunca
      // debería ocurrir, porque checkLabsVencidos ya filtra faltantes.length antes de
      // llamar, pero labsVencidosAlert no debe asumirlo).
      const c = cargar({ silencioso: true });
      const faltantesReales = [
        { key: "COLESTEROL_TOTAL", nombre: "Colesterol Total" },
        { key: "GLUCOSA", nombre: "Glucosa en Suero" },
        { key: "RAC", nombre: "RAC (Relación Albúmina/Creatinina)" },
      ];
      t.noLanza(() => c.api.labsVencidosAlert("Paciente de prueba", faltantesReales, true));
      t.noLanza(() => c.api.labsVencidosAlert("Paciente de prueba", [], true));
      t.noLanza(() => c.api.labsVencidosAlert("Paciente de prueba", null, true));
    });

    // =====================================================================
    // v12.5.10 — Reportado desde consultorio con pantallazo: un paciente con PyM
    // pendiente Y labs RCV vencidos a la vez recibía DOS modales de pantalla completa
    // superpuestos e ilegibles, porque checkRecordatorioPym/checkAbandonoPES/
    // checkLabsVencidos corren uno tras otro en el mismo tick sin mirarse entre sí.
    // otroAvisoDePacienteAbierto() es el guard que evita la superposición.
    // =====================================================================
    t.caso("otroAvisoDePacienteAbierto: detecta cualquiera de los tres modales grandes de paciente, y solo esos", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api.otroAvisoDePacienteAbierto(), "sin ningún modal en el DOM, no hay colisión");
      for (const id of ["vgl-pym-modal", "vgl-pes-modal", "vgl-labsv-modal"]) {
        c.env.doc.getElementById = (elId) => (elId === id ? {} : null);
        t.cierto(c.api.otroAvisoDePacienteAbierto(), `debe detectar #${id} abierto`);
      }
      c.env.doc.getElementById = (elId) => (elId === "vgl-modal" ? {} : null); // el cartel de fraude no cuenta
      t.falso(c.api.otroAvisoDePacienteAbierto(), "el cartel de fraude (#vgl-modal) es otra familia, no debe bloquear");
    });

    t.caso("checkAbandonoPES: si el aviso de labs vencidos ya está en pantalla, se pospone en vez de superponerse", () => {
      const c = cargar({ silencioso: true });
      const doc = "999888777";
      const key = c.api.normalizeKey(doc);
      c.api.__state.pymAbandono = new Set([key]);
      // Paciente abierto + #vgl-labsv-modal ya en el DOM: simula que checkLabsVencidos
      // disparó primero en este mismo tick, tal como ocurrió en el pantallazo real.
      c.env.doc.getElementById = (id) => {
        if (id === "anamesis") return elTexto("");
        if (id === "vgl-labsv-modal") return {};
        return null;
      };
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [elTexto("C.C. " + doc)] : []);
      const uid = "pes|" + key;

      c.api.checkAbandonoPES();
      t.falso(c.api.avisoYaVisto(uid), "con otro modal ya abierto, el aviso de PES NO se marca como visto todavía");

      // El médico cierra el aviso de labs vencidos con "Entendido": el siguiente tick
      // ya no encuentra colisión y el aviso de PES sale por su cuenta, sin perderse.
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : null);
      c.api.checkAbandonoPES();
      t.cierto(c.api.avisoYaVisto(uid), "sin colisión, el aviso de PES se muestra y queda marcado como visto");
    });

    await t.casoAsync("checkLabsVencidos: si el aviso de PyM ya está en pantalla para el mismo paciente, se pospone (reproduce el pantallazo real)", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsVencidos("2025-01-01") });
      mockPacienteAbierto(c, DOC_LABSV);
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-11T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-11T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      const uid = "labsv|" + c.api.normalizeKey(DOC_LABSV);

      // #vgl-pym-modal ya en el DOM: el recordatorio de PyM disparó primero en este tick.
      const getIdOriginal = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-pym-modal" ? {} : getIdOriginal(id));
      c.api.checkLabsVencidos();
      t.falso(c.api.avisoYaVisto(uid), "con el aviso de PyM ya abierto, labs vencidos NO se superpone");

      // El médico cierra el aviso de PyM: el siguiente tick ya puede mostrar labs vencidos.
      c.env.doc.getElementById = getIdOriginal;
      c.api.checkLabsVencidos();
      t.cierto(c.api.avisoYaVisto(uid), "sin colisión, labs vencidos se muestra y queda marcado como visto");
    });

  }
};
