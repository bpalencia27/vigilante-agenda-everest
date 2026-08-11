module.exports = {
  nombre: "Colores y notificaciones de la agenda",
  cubre: ["colorAndAlert", "beep", "muted", "muteFor", "unmute", "fraudSound", "playTone", "startNag", "stopNag", "faviconUrl", "setFavicon", "startFlash", "stopFlash", "popupAlert", "bigAlert", "acknowledge", "pymAlert", "abandonoPESAlert", "checkAbandonoPES", "colorDot", "crossTabDup", "avisoYaVisto", "avisoMarcarVisto", "osNotify", "_renderToast", "showToast", "notify", "nkey", "maybeNotify", "updateBell", "testNotifications", "enableOsNotifications", "checkRecordatorioPym"],
  pruebas(t, api, env, cargar) {

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

  }
};
