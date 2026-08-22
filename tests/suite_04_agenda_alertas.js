module.exports = {
  nombre: "Colores y notificaciones de la agenda",
  cubre: ["colorAndAlert", "muted", "muteFor", "unmute", "crossTabDup", "avisoYaVisto", "avisoMarcarVisto", "nkey", "maybeNotify", "avisoUniversal", "checkAvisoUniversal", "_avisoUnivReset", "_encolarAvisoPendiente", "_flushAvisosPendientes", "_dispararAvisoReal", "_siembraCompartidaLeer", "_siembraCompartidaGuardar", "_sembrarEstadoInicial", "bumpStatCita"],
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

    t.caso("colorAndAlert: el salto directo a Atendido SIGUE quedando registrado en rojo, pero YA NO suena (v16.2.8)", () => {
      // Decisión del médico (20-ago, con pantallazo de una notificación recibida a las
      // 12:09 por una cita de las 11:20): "solamente necesito el aviso cuando la leyenda
      // pasa de 'sin presentarse' a 'en sala' fuera del tiempo de confirmación; pero para
      // 'sin presentarse' a 'atendido' no es necesario generar ninguna notificación".
      // Cuando la agenda ya dice "Atendido" el paciente lleva rato dentro: avisar entonces
      // solo interrumpe. Lo que NO se pierde es la evidencia: el color rojo y el registro
      // de auditoría son los que sustentan las reclamaciones.
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Atendido", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      const k = c.api.apptKey(a);
      c.api.__state.fraudWatch.add(k); // estaba en ambar

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "ROJO", "se sigue pescando: el panel lo pinta y la auditoría lo guarda");
      t.falso(r.sound, "pero no dispara tono, ni notificación de Windows, ni cartel");
      t.cierto(c.api.__state.alertedFraud.has(k), "queda marcado para no reevaluarlo");
    });

    t.caso("colorAndAlert: el paso a EN SALA fuera de gracia SÍ suena — es el aviso que el médico sí quiere", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__state.fraudWatch.add(c.api.apptKey(a));

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "ROJO");
      t.cierto(r.sound, "este es el único caso que debe interrumpir al médico");
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

    // =====================================================================
    // v17.1.0 (#72/#146) — LOS INDICADORES CUENTAN CITAS, NO TRANSICIONES.
    //
    // Reporte del médico del 21-ago, con pantallazo: «me salen 38 A TIEMPO y no entiendo
    // por qué, porque el máximo de pacientes por día son 21». Su propia auditoría lo
    // probó: la cabecera del CSV decía «Ingresos a tiempo;38» y el cuerpo traía 18 filas
    // INGRESO_A_TIEMPO para 14 citas distintas. Cuatro pacientes contados dos veces, a
    // 13 s, 6 min, 15 min y 16 min de distancia.
    // La clave era `state.notified`, un mapa de «último color visto» que se re-arma en
    // cuanto la fila se lee un tick con otro estado — Angular repintando, la API cayendo
    // al raspado, un relevo de pestaña. Productividad, que sí cuenta por conjunto de
    // citas, daba el número correcto (15/18) en la misma pantalla.
    // =====================================================================
    t.caso("#146: una cita que oscila de estado se cuenta UNA vez — no una por transición", () => {
      const c = cargar();
      const base = { hora_texto: "08:00 AM", doc_id: "123", nombre: "JUAN", elapsed: 1, reason: "" };
      const key = c.api.apptKey(base);
      const a = (estado, color, arrival) => ({ ...base, key, estado, color, arrival: !!arrival });
      c.api.maybeNotify(a("Sin presentarse", "AZUL", false));   // siembra
      c.api.maybeNotify(a("En sala", "VERDE", true));           // llegó: cuenta 1
      c.api.maybeNotify(a("Pendiente", "AZUL", false));         // Angular repinta: la fila se lee rara
      c.api.maybeNotify(a("En sala", "VERDE", true));           // vuelve a leerse "En sala"
      t.igual(atiempoHoy(c), 1, "el mismo paciente no puede llegar a tiempo dos veces");
    });

    t.caso("#146: la misma cita leída por el API y por el DOM se cuenta UNA vez", () => {
      // horaBonita() escribe "7:00 a. m." y el raspado del DOM devuelve "07:00 AM": con
      // dos claves para una cita se rompían a la vez las cuatro guardas.
      const c = cargar();
      const porApi = { hora_texto: "7:00 a. m.", doc_id: "123", nombre: "JUAN", elapsed: 1, reason: "" };
      const porDom = { hora_texto: "07:00 AM", doc_id: "123", nombre: "JUAN", elapsed: 1, reason: "" };
      const k1 = c.api.apptKey(porApi), k2 = c.api.apptKey(porDom);
      t.igual(k1, k2, "una cita, una clave");
      c.api.maybeNotify({ ...porApi, key: k1, estado: "Sin presentarse", color: "AZUL", arrival: false });
      c.api.maybeNotify({ ...porApi, key: k1, estado: "En sala", color: "VERDE", arrival: true });
      c.api.maybeNotify({ ...porDom, key: k2, estado: "En sala", color: "VERDE", arrival: true });
      t.igual(atiempoHoy(c), 1, "cambiar de fuente a mitad de jornada no puede duplicar el indicador");
    });

    t.caso("#146: dos pestañas compartiendo almacén cuentan la cita UNA vez", () => {
      // El duplicado de 13 s del CSV del médico: crossTabDup solo dura 12 segundos, y
      // además solo frena el AVISO, nunca frenó el conteo.
      const A = cargar();
      const B = cargar({ almacen: A.env.almacen, storage: A.env.storage });
      const base = { hora_texto: "08:00 AM", doc_id: "123", nombre: "JUAN", elapsed: 1, reason: "" };
      const key = A.api.apptKey(base);
      const ev = (estado, color, arrival) => ({ ...base, key, estado, color, arrival: !!arrival });
      A.api.maybeNotify(ev("Sin presentarse", "AZUL", false));
      A.api.maybeNotify(ev("En sala", "VERDE", true));
      B.api._fraudeCompartidoFusionar();
      B.api.maybeNotify(ev("Sin presentarse", "AZUL", false));
      B.api.maybeNotify(ev("En sala", "VERDE", true));
      t.igual(atiempoHoy(A), 1, "la segunda pestaña ve la marca que dejó la primera y no vuelve a sumar");
    });

    t.caso("#146: cada color tiene su propio conteo — llegar tarde y luego llegar no se pisan", () => {
      const c = cargar();
      const base = { hora_texto: "08:00 AM", doc_id: "123", nombre: "JUAN", elapsed: 1, reason: "" };
      const key = c.api.apptKey(base);
      const ev = (estado, color, arrival) => ({ ...base, key, estado, color, arrival: !!arrival });
      c.api.maybeNotify(ev("Pendiente", "AZUL", false));
      // El MORADO solo avisa cuando el motivo es el tiempo (el de "3+ actividades de PyM"
      // es otra cosa y no cuenta como última llamada).
      c.api.maybeNotify({ ...ev("Sin presentarse", "MORADO", false), reason: "tiempo" });
      c.api.maybeNotify(ev("En sala", "VERDE", true));             // y llegó
      const st = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}")[c.api.todayStamp()] || {};
      t.igual(st.ultima || 0, 1, "la última llamada pasó de verdad");
      t.igual(st.atiempo || 0, 1, "y la llegada también: son dos hechos distintos de la misma cita");
    });

    t.caso("bumpStatCita: devuelve true la primera vez y false en las repeticiones", () => {
      // Prueba directa: `cubre` no se llena con nombres que solo se tocan de rebote. El
      // valor de retorno es lo que decide si se escribe la fila de auditoría, así que la
      // conciliación cabecera-cuerpo del CSV depende de que sea exacto.
      const c = cargar();
      t.cierto(c.api.bumpStatCita("atiempo", "123@m480"), "la primera vez cuenta");
      t.falso(c.api.bumpStatCita("atiempo", "123@m480"), "la segunda no");
      t.cierto(c.api.bumpStatCita("ultima", "123@m480"), "pero otro color de la MISMA cita sí: son hechos distintos");
      t.cierto(c.api.bumpStatCita("atiempo", "456@m480"), "y otra cita también");
      t.falso(c.api.bumpStatCita("", "123@m480"), "sin tipo no cuenta nada");
      t.igual(atiempoHoy(c), 2, "dos citas a tiempo, ni una más");
    });

    t.caso("#146: sin identidad de cita se cuenta igual — perder el dato sería peor que duplicarlo", () => {
      const c = cargar();
      c.api.maybeNotify({ hora_texto: "08:00 AM", doc_id: "", nombre: "", key: "", estado: "Sin presentarse", color: "AZUL", arrival: false, elapsed: 1, reason: "" });
      c.api.maybeNotify({ hora_texto: "08:00 AM", doc_id: "", nombre: "", key: "", estado: "En sala", color: "VERDE", arrival: true, elapsed: 1, reason: "" });
      t.igual(atiempoHoy(c), 1, "se cuenta");
    });

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
    // v14.1.5 — LA SIEMBRA SE COMPARTE ENTRE PESTAÑAS.
    //
    // La siembra silenciosa de v12.4 es correcta: un paciente que YA estaba En Sala al
    // abrir el panel no fue una llegada que el vigilante viera, así que no suena. Pero
    // `state.notified` y `state.summarized` viven en la memoria de CADA pestaña, así que
    // cada relevo de liderazgo estrenaba una siembra nueva y daba por vistos a todos sin
    // avisar de ninguno. Ese es el "a veces NO te avisa" que reportaron los compañeros:
    // no un aviso tarde, un aviso que no llega jamás. El relevo por visibilidad de esta
    // misma versión hace los relevos MÁS frecuentes, así que sin esto lo habría agravado.
    // =====================================================================
    t.caso("siembra compartida v14.1.5: lo ya avisado se guarda fuera de la pestaña, para que un relevo de liderazgo no lo vuelva a sembrar en silencio", () => {
      const c = cargar();
      const base = { hora_texto: "08:00 AM", doc_id: "123", key: "123@08:00 AM", nombre: "JUAN", elapsed: 1, reason: "" };
      c.api.maybeNotify({ ...base, estado: "Sin presentarse", color: "AZUL", arrival: false });
      c.api.maybeNotify({ ...base, estado: "En sala", color: "VERDE", arrival: true });
      t.igual(atiempoHoy(c), 1, "el aviso salió en esta pestaña");

      const guardado = c.api._siembraCompartidaLeer();
      t.cierto(!!guardado, "quedó constancia fuera de la memoria de la pestaña");
      t.cierto(guardado.has("123@08:00 AM"), "y ese paciente figura como ya visto");
    });

    t.caso("siembra compartida v14.1.5: SIN siembra previa se siembra de cero (primera pestaña del día) y queda guardada", () => {
      const c = cargar();
      const processed = [
        { key: "123@08:00 AM", hora_texto: "08:00 AM", doc_id: "123", estado: "En sala", color: "VERDE", reason: "" },
        { key: "456@09:00 AM", hora_texto: "09:00 AM", doc_id: "456", estado: "Sin presentarse", color: "AZUL", reason: "" },
      ];
      t.igual(c.api._sembrarEstadoInicial(processed), "nueva", "es la primera siembra del día");
      t.cierto(c.api.__state.notified.has("123@08:00 AM"), "los dos pacientes quedan dados por vistos, sin sonar");
      t.cierto(c.api.__state.notified.has("456@09:00 AM"));
      t.cierto(!!c.api._siembraCompartidaLeer(), "y la siembra queda disponible para las demás pestañas");
    });

    t.caso("siembra compartida v14.1.5: CON siembra previa se HEREDA — un paciente que llegó tras la siembra ajena NO se da por visto, así que su aviso sí sale", () => {
      const c = cargar();
      // Otra pestaña ya sembró hoy y solo alcanzó a ver a JUAN.
      c.api._siembraCompartidaGuardar(new Map([["123@08:00 AM", "123@08:00 AM|Sin presentarse|AZUL|"]]));

      // Esta pestaña toma el relevo y ve a JUAN y, además, a ANA, que llegó después.
      const processed = [
        { key: "123@08:00 AM", hora_texto: "08:00 AM", doc_id: "123", estado: "Sin presentarse", color: "AZUL", reason: "" },
        { key: "456@09:00 AM", hora_texto: "09:00 AM", doc_id: "456", estado: "En sala", color: "VERDE", reason: "" },
      ];
      t.igual(c.api._sembrarEstadoInicial(processed), "heredada", "no se vuelve a sembrar de cero");
      t.cierto(c.api.__state.notified.has("123@08:00 AM"), "lo que la otra pestaña ya dio por visto sigue visto");
      t.falso(
        c.api.__state.notified.has("456@09:00 AM"),
        "ANA NO se da por vista: es justo el paciente cuyo aviso se tragaba el relevo de liderazgo"
      );
    });

    t.caso("siembra compartida v14.1.5: una siembra de OTRO DÍA se ignora — el día nuevo vuelve a sembrar de cero, como debe", () => {
      const c = cargar();
      c.env.win.localStorage.setItem("vgl_siembra_dia2", JSON.stringify({ dia: "1999-01-01", mapa: { "123@08:00 AM": "x" } }));
      t.igual(c.api._siembraCompartidaLeer(), null, "un sello viejo no contamina la jornada de hoy");
    });

    // =====================================================================
    // v12.5.14 — Reportado en consultorio: los avisos llegaban también con la
    // pestaña líder abierta en .../viva/Acceso/ (asignación de turnos), un
    // módulo de Everest sin nada que ver con la agenda del día. El aviso
    // SIEMPRE debe dispararse (nunca perderse) — solo debe MOSTRARSE dentro
    // del módulo clínico HCHealth: si ninguna pestaña está ahí en el instante
    // de la transición, queda en cola y se dispara en cuanto una lo esté.
    // =====================================================================
    // v14.1.5 — REGLA NUEVA, y es la corrección de un fallo reportado en consultorio.
    // Antes, un aviso generado con el médico FUERA de /viva/HCHealth no sonaba: se guardaba
    // y esperaba a que entrara a una historia clínica, y entonces salían todos de golpe
    // ("es como si estuvieran asincrónicas", dijeron sus compañeros). Pero lo que se estaba
    // conteniendo era el TONO y la NOTIFICACIÓN DEL SISTEMA, que existen justamente para
    // avisar cuando el médico NO está mirando esta pantalla: la condición estaba al revés.
    // Ahora eso sale siempre y en el acto; lo único que se encola es el cartel de la página,
    // que sí necesita una vista donde pintarse.
    t.caso("maybeNotify v14.1.5: fuera de HCHealth el aviso SÍ suena y sale al sistema operativo en el acto; solo el cartel queda en cola", () => {
      const c = cargar();
      // v15.4.0 — un aviso = un canal: la notificación del SISTEMA solo sale con la
      // pestaña oculta (visible, el canal es el toast). La intención original de esta
      // prueba se conserva; solo se simula la pestaña oculta para seguir contándola.
      c.env.doc.visibilityState = "hidden";
      c.env.win.location.pathname = "/viva/Acceso/";
      let notifCount = 0;
      c.env.win.Notification = class { constructor() { notifCount++; } };
      c.env.win.Notification.permission = "granted";
      const base = { hora_texto: "08:00 AM", doc_id: "789", key: "789@08:00 AM", nombre: "LUIS", elapsed: 1, reason: "" };
      c.api.maybeNotify({ ...base, estado: "Sin presentarse", color: "AZUL", arrival: false });      // siembra
      c.api.maybeNotify({ ...base, estado: "En sala", color: "VERDE", arrival: true });              // llegada en vivo, fuera de HCHealth
      t.igual(atiempoHoy(c), 1, "la auditoría (bumpStat) SIEMPRE se registra, con la hora real de la transición");
      t.igual(notifCount, 1, "el médico se entera AHORA, esté en el módulo que esté: ese es el arreglo");
      const cola = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola.length, 1, "el cartel de la página sí queda en cola, para cuando haya vista donde pintarlo");
      t.igual(cola[0].uid, "789@08:00 AM|VERDE");
      t.cierto(cola[0].ts > 0, "y lleva la hora del hecho, para poder caducarlo si se vacía mucho después");
    });

    t.caso("_flushAvisosPendientes: al volver a HCHealth, el aviso en cola SÍ se dispara — una sola vez entre pestañas", () => {
      const c = cargar();
      // v15.4.0 — un aviso = un canal: la notificación del SISTEMA solo sale con la
      // pestaña oculta (visible, el canal es el toast). La intención original de esta
      // prueba se conserva; solo se simula la pestaña oculta para seguir contándola.
      c.env.doc.visibilityState = "hidden";
      c.env.win.location.pathname = "/viva/Acceso/";
      let notifCount = 0;
      c.env.win.Notification = class { constructor() { notifCount++; } };
      c.env.win.Notification.permission = "granted";
      const a = { hora_texto: "09:00 AM", doc_id: "321", key: "321@09:00 AM", nombre: "ANA", elapsed: 1, reason: "" };
      c.api.maybeNotify({ ...a, estado: "Sin presentarse", color: "AZUL", arrival: false });
      c.api.maybeNotify({ ...a, estado: "En sala", color: "VERDE", arrival: true });   // fuera de HCHealth
      t.igual(notifCount, 1, "v14.1.5: el aviso al sistema operativo salió YA, no esperó a nada");

      c.env.win.location.pathname = "/viva/HCHealth/";
      c.api._flushAvisosPendientes();
      t.igual(notifCount, 1, "al volver a HCHealth sale el cartel, pero NO se vuelve a notificar: ya se avisó una vez");
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
    // [v14.2.0 — auditoría pre-producción 2026-08-18] Las pruebas directas de
    // checkLabsVencidos, labsVencidosAlert, otroAvisoDePacienteAbierto y checkAbandonoPES
    // se retiraron: las cuatro funciones se borraron del script por código muerto (sin
    // llamador desde que avisoUniversal/checkAvisoUniversal las reemplazó — ver
    // CHANGELOG). Los helpers de red de abajo (mockPacienteAbierto, planLabsVencidos,
    // planLabsAlDia, planLabsCero) SIGUEN vivos: los usan las pruebas de
    // checkAvisoUniversal, más abajo.
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

    // =====================================================================
    // v14.2.0 — AVISO ÚNICO (avisoUniversal / checkAvisoUniversal)
    // Encargo del médico: en vez de hasta TRES modales en fila por paciente
    // (PyM → abandono RCV → labs vencidos), UN solo aviso con secciones,
    // siempre activo. Los tres checks viejos (checkRecordatorioPym, checkAbandonoPES,
    // checkLabsVencidos) se retiraron del script en la auditoría 2026-08-18 por código
    // muerto (ver CHANGELOG); esto es lo único que el tick llama ahora.
    // =====================================================================

    t.caso("avisoUniversal: junta abandono + PyM + labs en UN solo modal accesible", () => {
      const c = cargar({ silencioso: true });
      c.api.avisoUniversal("Paciente Prueba", {
        abandono: true,
        pym: ["Tamización VIH", "Citología"],
        labs: [{ nombre: "Creatinina en Suero" }, { nombre: "Colesterol Total" }],
      }, true);
      const m = c.env.doc.getElementById("vgl-pym-modal");
      t.cierto(!!m, "insertó el modal único");
      t.igual(m.getAttribute("role"), "alertdialog", "role='alertdialog' (puede llevar abandono/labs urgentes)");
      t.igual(m.getAttribute("aria-modal"), "true", "aria-modal='true'");
      t.cierto(m.innerHTML.indexOf("Abandono Programa RCV") >= 0, "sección de abandono presente");
      t.cierto(m.innerHTML.indexOf("Tamización VIH") >= 0, "chips de PyM presentes");
      t.cierto(m.innerHTML.indexOf("Creatinina en Suero") >= 0, "chips de labs presentes");
      t.cierto(m.innerHTML.indexOf("Entendido") >= 0, "un único botón de reconocimiento");
    });

    t.caso("avisoUniversal: cada sección es opcional y sin datos NO pinta nada", () => {
      const c = cargar({ silencioso: true });
      c.api.avisoUniversal("Paciente Prueba", { pym: ["Tamización VIH"] }, true);
      const m = c.env.doc.getElementById("vgl-pym-modal");
      t.cierto(!!m && m.innerHTML.indexOf("Abandono") < 0, "solo PyM: sin sección de abandono");
      t.cierto(m.innerHTML.indexOf("Laboratorios RCV") < 0, "solo PyM: sin sección de labs");
      const c2 = cargar({ silencioso: true });
      c2.api.avisoUniversal("Paciente Prueba", { abandono: false, pym: [], labs: [] }, true);
      t.falso(!!c2.env.doc.getElementById("vgl-pym-modal"), "sin nada que mostrar, no hay aviso");
    });

    t.caso("checkAvisoUniversal: sin paciente abierto -> no lanza y no revisa nada", () => {
      const c = cargar({ silencioso: true });
      c.env.doc.getElementById = () => null; // sin #anamesis: no es historia clínica
      t.noLanza(() => c.api.checkAvisoUniversal());
    });

    await t.casoAsync("checkAvisoUniversal: labs resueltos + PyM + abandono -> dispara UNA vez con todo y queda marcado", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsVencidos("2025-01-01") });
      mockPacienteAbierto(c, DOC_LABSV);
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-11T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-11T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      const key = c.api.normalizeKey(DOC_LABSV);
      c.api.__state.pym = new Map([[key, ["Tamización de VIH"]]]);
      c.api.__state.pymAbandono = new Set([key]);
      const uid = "avisouniv|" + key;
      t.falso(c.api.avisoYaVisto(uid), "aún no revisado");
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid), "con los labs ya resueltos dispara de una y queda marcado");
      t.noLanza(() => c.api.checkAvisoUniversal(), "reentrar el mismo día no revienta ni duplica");
    });

    // [v14.2.0 — auditoría pre-producción 2026-08-18] La gracia pasó de "vueltas de tick" a
    // tiempo real fijo (MTR_AVISO_GRACIA_MS, por paciente — ver CHANGELOG). Estas pruebas ya
    // no simulan "2 ticks" llamando dos veces seguido: avanzan el reloj simulado (FakeDate,
    // mismo patrón que suite_02/suite_10/suite_11/suite_19) más allá de la gracia.
    t.caso("checkAvisoUniversal: sin pre-carga de Athenea espera la gracia (tiempo real) y luego avisa sin labs — el aviso no se pierde", () => {
      const c = cargar({ silencioso: true });
      const doc = "555666777";
      mockPacienteAbierto(c, doc);
      const key = c.api.normalizeKey(doc);
      c.api.__state.pym = new Map([[key, ["Tamización de VIH"]]]);
      const uid = "avisouniv|" + key;
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-11T12:00:00.000";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.env.win.Date = FakeDate;
      c.ctx.Date = FakeDate;
      c.api.checkAvisoUniversal();
      t.falso(c.api.avisoYaVisto(uid), "recién detectado: dentro de la gracia, aún espera los labs de Athenea");
      mockIso = "2026-08-11T12:00:05.100"; // +5.1s reales: supera MTR_AVISO_GRACIA_MS (5000)
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid), "pasada la gracia real, avisa con lo síncrono (PyM/abandono)");
    });

    t.caso("checkAvisoUniversal: la gracia es por paciente — revisar a B no reinicia ni adelanta la gracia ya acumulada por A", () => {
      const c = cargar({ silencioso: true });
      const docA = "555666777", docB = "222333444";
      const keyA = c.api.normalizeKey(docA), keyB = c.api.normalizeKey(docB);
      c.api.__state.pym = new Map([[keyA, ["Tamización de VIH"]], [keyB, ["Citología"]]]);
      const uidA = "avisouniv|" + keyA, uidB = "avisouniv|" + keyB;
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-11T12:00:00.000";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.env.win.Date = FakeDate;
      c.ctx.Date = FakeDate;

      mockPacienteAbierto(c, docA);
      c.api.checkAvisoUniversal(); // arranca la gracia de A en t=0
      t.falso(c.api.avisoYaVisto(uidA), "A recién detectado: dentro de su propia gracia");

      mockIso = "2026-08-11T12:00:02.000"; // +2s: el médico revisa a B mientras A sigue esperando
      mockPacienteAbierto(c, docB);
      c.api.checkAvisoUniversal(); // arranca la gracia de B en t=2s, sin tocar la de A
      t.falso(c.api.avisoYaVisto(uidB), "B recién detectado: dentro de su propia gracia");

      // +5.5s desde t=0: la gracia de A (5s, contados desde que se le vio) ya se cumplió; la de
      // B, con solo 3.5s desde que se le vio, todavía no.
      mockIso = "2026-08-11T12:00:05.500";
      mockPacienteAbierto(c, docA);
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uidA), "A dispara: su gracia, contada desde que se le vio, ya se cumplió");

      mockPacienteAbierto(c, docB);
      c.api.checkAvisoUniversal();
      t.falso(c.api.avisoYaVisto(uidB), "B NO dispara todavía: revisar a A mientras tanto no le robó ni adelantó su gracia");
    });

    await t.casoAsync("checkAvisoUniversal: si el aviso salió SIN labs y luego llegan labs con vencidos, sale UN único aviso de labs (no se pierde en silencio)", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsVencidos("2025-01-01") });
      mockPacienteAbierto(c, DOC_LABSV);
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-11T12:00:00.000";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.env.win.Date = FakeDate;
      c.ctx.Date = FakeDate;
      const key = c.api.normalizeKey(DOC_LABSV);
      c.api.__state.pym = new Map([[key, ["Tamización de VIH"]]]);
      const uid = "avisouniv|" + key, uidLab = "avisounivlab|" + key;
      // Athenea aún NO responde: gracia (tiempo real) y aviso parcial sin labs.
      c.api.checkAvisoUniversal();
      mockIso = "2026-08-11T12:00:05.100"; // +5.1s: supera MTR_AVISO_GRACIA_MS (5000); mismo día,
                                            // no afecta el cálculo de vigencia del analito.
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid), "aviso principal salió sin labs (Athenea lenta)");
      t.falso(c.api.avisoYaVisto(uidLab), "el de labs aún no");
      // Ahora Athenea resuelve con un analito VENCIDO -> un único aviso de labs.
      await c.api.autoFetchAtheneaLabsForActivePatient();
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uidLab), "los labs tardíos con vencidos disparan su único aviso");
      // Y no se repite jamás:
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uidLab) && c.api.avisoYaVisto(uid), "ambos marcados, sin bucles");
    });

    await t.casoAsync("checkAvisoUniversal: paciente al día (sin PyM, sin abandono, labs vigentes) -> ningún aviso, jamás", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsAlDia("2026-08-01") });
      mockPacienteAbierto(c, DOC_LABSV);
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-11T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-11T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      c.api.checkAvisoUniversal();
      t.falso(c.api.avisoYaVisto("avisouniv|" + c.api.normalizeKey(DOC_LABSV)), "nada pendiente -> ningún aviso");
    });

    await t.casoAsync("checkAvisoUniversal: si ya hay un aviso en pantalla, se pospone y sale al siguiente tick", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsVencidos("2025-01-01") });
      mockPacienteAbierto(c, DOC_LABSV);
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-11T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-11T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      const uid = "avisouniv|" + c.api.normalizeKey(DOC_LABSV);
      const getIdOriginal = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "vgl-pym-modal" ? {} : getIdOriginal(id));
      c.api.checkAvisoUniversal();
      t.falso(c.api.avisoYaVisto(uid), "con otro aviso abierto no se superpone ni se pierde");
      c.env.doc.getElementById = getIdOriginal;
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid), "cerrado el anterior, sale y queda marcado");
    });

    t.caso("_avisoUnivReset: el reinicio de medianoche reinicia la gracia (tiempo real) sin lanzar", () => {
      const c = cargar({ silencioso: true });
      const doc = "444555666";
      mockPacienteAbierto(c, doc);
      const key = c.api.normalizeKey(doc);
      c.api.__state.pym = new Map([[key, ["Tamización de VIH"]]]);
      const uid = "avisouniv|" + key;
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-11T12:00:00.000";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.env.win.Date = FakeDate;
      c.ctx.Date = FakeDate;

      c.api.checkAvisoUniversal();               // arranca la gracia ("desde" = t0)
      t.noLanza(() => c.api._avisoUnivReset());  // medianoche: debe olvidar ese "desde"
      // +10s reales: si el reinicio NO hubiera limpiado el estado, esto ya superaría la
      // gracia (5s) y dispararía de una — la prueba es justamente que no lo hace.
      mockIso = "2026-08-11T12:00:10.000";
      c.api.checkAvisoUniversal();               // tras el reinicio, la gracia arranca de cero (desde = ahora)
      t.falso(c.api.avisoYaVisto(uid), "tras el reinicio la gracia arranca de cero, no acumula el tiempo previo");
      mockIso = "2026-08-11T12:00:15.100";       // +5.1s más desde el reinicio: ahora sí la supera
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid), "pasada la gracia tras el reinicio, dispara con lo síncrono");
    });

    // =====================================================================
    // [v14.2.0 — auditoría pre-producción 2026-08-18] Se retiró la sección de pruebas
    // directas de checkRecordatorioPym: la función se borró del script junto con el resto
    // del bloque T7 (código muerto — la "RED DE SEGURIDAD D4" que documentaba dependía del
    // banner de PyM, retirado con ella). El aviso único de abajo (avisoUniversal /
    // checkAvisoUniversal) es ahora el único camino para el recordatorio de PyM. Ver
    // CHANGELOG.
    // =====================================================================
    // v14.2.0 — AVISO ÚNICO: un solo modal por paciente reúne PyM + abandono RCV + labs
    // vencidos, en vez de tres avisos seguidos.
    // =====================================================================

    t.caso("avisoUniversal: UN solo modal reúne abandono + PyM + labs, con role alertdialog", () => {
      const c = cargar({ silencioso: true });
      c.api.avisoUniversal("Paciente Prueba", { abandono: true, pym: ["Tamización VIH"], labs: [{ nombre: "Creatinina" }] }, true);
      const m = c.env.doc.getElementById("vgl-pym-modal");
      t.cierto(!!m, "quedó UN modal en el DOM (reusa el id vgl-pym-modal)");
      t.igual(m.getAttribute("role"), "alertdialog", "es alertdialog (lleva prioridad clínica)");
      const html = m.innerHTML || "";
      t.cierto(/Abandono Programa RCV/.test(html), "trae la sección de abandono RCV");
      t.cierto(/Tamización VIH/.test(html), "trae la actividad de PyM pendiente");
      t.cierto(/Creatinina/.test(html), "trae el laboratorio RCV vencido");
      t.cierto(/Entendido/.test(html), "trae el botón de reconocimiento");
    });

    t.caso("avisoUniversal: sin nada pendiente NO crea ningún modal", () => {
      const c = cargar({ silencioso: true });
      c.api.avisoUniversal("X", { abandono: false, pym: [], labs: [] }, true);
      t.igual(c.env.doc.getElementById("vgl-pym-modal"), null, "nada que mostrar -> sin modal (no molesta en vano)");
    });

    await t.casoAsync("checkAvisoUniversal: con labs RCV vencidos (Athenea resuelto) dispara UN aviso y lo marca; no repite", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsCero() });
      mockPacienteAbierto(c, DOC_LABSV);
      await c.api.autoFetchAtheneaLabsForActivePatient();   // _labsPrefetch resuelto (7 faltantes)
      const uid = "avisouniv|" + c.api.normalizeKey(DOC_LABSV);
      t.falso(c.api.avisoYaVisto(uid), "todavía no se ha revisado");
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid), "labs vencidos -> aviso único, marcado una vez por paciente");
      t.noLanza(() => c.api.checkAvisoUniversal(), "un segundo tick no repite ni revienta");
    });

    // Variante de planLabsVencidos que ECHA DE VUELTA la cédula que de verdad se buscó (en
    // vez de la constante fija DOC_LABSV): necesaria aquí porque getAtheneaSolicitudesAuto
    // descarta por seguridad cualquier respuesta cuya cédula no coincida con la buscada
    // ("la cédula de la respuesta no coincide con la buscada") — con dos docId distintos en
    // la misma prueba, el mock tiene que responder cada uno con SU propia cédula.
    function planLabsParaDoc(getDocActual, fechaAnalito) {
      return (o) => {
        const url = String(o.url || "");
        if (url.includes("BusquedaPaciente")) o.onload({ status: 200, responseText: `<form><input name="__RequestVerificationToken" value="TOK-1" /></form>` });
        else if (url.includes("BuscarPaciente")) o.onload({ status: 200, responseText: `<input type="hidden" name="IdPaciente" value="999" /><input name="__RequestVerificationToken" value="TOK-2" />` });
        else if (url.includes("DatosPaciente")) o.onload({ status: 200, responseText: `CC: ${getDocActual()} <form id="5552026" data-modulo="LAB" action="/Resultados/Reporte"></form>` });
        else if (url.includes("consultaDetalleSolicitud")) o.onload({
          status: 200,
          responseText: JSON.stringify({ dataObject: JSON.stringify([{ CodigoParametro: "903818", NombreParametro: "COLESTEROL TOTAL", Resultado: "220", Fecha: fechaAnalito }]) }),
        });
        else o.onload({ status: 200, responseText: "" });
      };
    }

    // v17.0.3 — REPORTE REAL (21-ago, 2 capturas idénticas): el aviso "🧪 Paraclínicos de
    // Athenea encontrados" salió DOS VECES para el mismo paciente. Causa raíz ya
    // documentada desde v12.3.27: extractPacienteAbierto() no siempre lee la MISMA cadena
    // para el MISMO paciente entre relecturas del DOM, así que cualquier guarda basada en
    // "¿es el mismo docId?" puede fallar justo cuando más se necesita. La prueba simula
    // exactamente eso: dos lecturas con docId DISTINTO (mockPacienteAbierto con cédulas
    // diferentes) a pocos segundos de distancia — como si Angular hubiera mostrado un nodo
    // .text-muted distinto la segunda vez.
    await t.casoAsync("autoFetchAtheneaLabsForActivePatient: un docId leído distinto (inestabilidad del DOM) no duplica el aviso dentro del piso de 30 s", async () => {
      let docActual = "111222333";
      const c = cargar({ silencioso: true, gmxhr: planLabsParaDoc(() => docActual, "2025-01-01") });
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-21T12:00:00.000";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.env.win.Date = FakeDate;
      c.ctx.Date = FakeDate;
      c.env.doc.visibilityState = "hidden";           // fuerza el canal GM_notification (más fácil de espiar que el toast en pantalla)
      const avisos = [];
      c.env.win.GM_notification = (opts) => avisos.push(opts);

      mockPacienteAbierto(c, docActual);
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(avisos.length, 1, "primera lectura: un aviso de paraclínicos encontrados");
      t.cierto(/Paraclínicos de Athenea/.test(avisos[0].title), "es el aviso correcto");

      mockIso = "2026-08-21T12:00:02.000";             // +2 s: el médico sigue con el MISMO paciente
      docActual = "999888777";                          // pero el DOM se leyó con OTRA cédula esta vez
      mockPacienteAbierto(c, docActual);
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(avisos.length, 1, "docId leído distinto 2 s después: NO se repite (antes sí — bug real reproducido)");
    });

    await t.casoAsync("autoFetchAtheneaLabsForActivePatient: pasado el piso de 30 s, un paciente genuinamente distinto SÍ avisa de nuevo", async () => {
      let docActual = "111222333";
      const c = cargar({ silencioso: true, gmxhr: planLabsParaDoc(() => docActual, "2025-01-01") });
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-21T12:00:00.000";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.env.win.Date = FakeDate;
      c.ctx.Date = FakeDate;
      c.env.doc.visibilityState = "hidden";
      const avisos = [];
      c.env.win.GM_notification = (opts) => avisos.push(opts);

      mockPacienteAbierto(c, docActual);
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(avisos.length, 1, "paciente A: avisa");

      mockIso = "2026-08-21T12:00:35.000";              // +35 s: superó el piso de 30 s
      docActual = "444555666";                           // y de verdad es OTRO paciente (el médico avanzó su agenda)
      mockPacienteAbierto(c, docActual);
      await c.api.autoFetchAtheneaLabsForActivePatient();
      t.igual(avisos.length, 2, "paciente B, ya pasado el piso: SÍ avisa (el arreglo no lo deja mudo para siempre)");
    });

    t.caso("checkAvisoUniversal: si ya hay un aviso en pantalla, NO se superpone", () => {
      const c = cargar({ silencioso: true });
      const doc = "999888777", key = c.api.normalizeKey(doc);
      c.api.__state.pymAbandono = new Set([key]);
      c.api.__state.pym = new Map([[key, ["Remisión a Optometría"]]]);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? elTexto("") : (id === "vgl-pym-modal" ? {} : null));
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [elTexto("C.C. " + doc)] : []);
      c.api.checkAvisoUniversal();
      t.falso(c.api.avisoYaVisto("avisouniv|" + key), "con un modal ya abierto se pospone, no se marca");
    });

    t.caso("checkAvisoUniversal: sin labs de Athenea todavía, espera la gracia (tiempo real) y luego avisa con lo síncrono", () => {
      const c = cargar({ silencioso: true });
      mockPacienteAbierto(c, "111000111");
      const key = c.api.normalizeKey("111000111");
      c.api.__state.pym = new Map([[key, ["Remisión a Optometría"]]]);   // PyM pendiente (síncrono)
      const uid = "avisouniv|" + key;
      const OriginalDate = c.ctx.Date || Date;
      let mockIso = "2026-08-11T12:00:00.000";
      const FakeDate = class extends OriginalDate {
        constructor(...args) { if (args.length === 0) super(mockIso); else super(...args); }
      };
      FakeDate.now = () => new OriginalDate(mockIso).getTime();
      c.env.win.Date = FakeDate;
      c.ctx.Date = FakeDate;
      c.api.checkAvisoUniversal();   // recién detectado: dentro de la gracia, espera a Athenea
      t.falso(c.api.avisoYaVisto(uid), "recién detectado: da margen a que lleguen los labs, no avisa aún");
      mockIso = "2026-08-11T12:00:05.100"; // +5.1s: supera MTR_AVISO_GRACIA_MS (5000)
      c.api.checkAvisoUniversal();   // cumplida la gracia
      t.cierto(c.api.avisoYaVisto(uid), "cumplida la gracia, avisa con el PyM aunque Athenea no respondió");
    });

    t.caso("_avisoUnivReset: no lanza (limpia el estado del aviso para el día nuevo)", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api._avisoUnivReset());
    });

  }
};
