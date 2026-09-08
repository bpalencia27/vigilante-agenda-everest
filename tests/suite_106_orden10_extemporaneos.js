// =====================================================================
//  SUITE 106 — ORDEN #10: auditoría de confirmaciones extemporáneas.
//              Ventana estricta (bordes +5,9 / +6,0 / +6,1) y la columna
//              «Usuario» en la bitácora y el CSV (v18.8.10)
//
//  Orden del médico (08-sep), con el TSV de auditoría del día adjunto:
//   1. ventana estricta de 6 min posteriores a la hora de la cita — cero
//      confirmaciones válidas fuera de plazo,
//   2. notificaciones a administrativo/médico en cada intento extemporáneo,
//   3. registros completos (hora exacta, identificador del paciente, hora
//      original de la cita y usuario de la sesión),
//   4. examen del TSV en busca de accesos tardíos y brechas de bloqueo,
//   5. correcciones para blindar,
//   6. pruebas de validación dentro/fuera de la ventana,
//   7. documentar desviaciones, correcciones y resultados (PHI redactado).
//
//  La ventana vive en CONFIG.TOLERANCIA_MIN = 6.0 y la marca de sospecha
//  (fraudWatch) nace solo en la pestaña líder cuando la cita sigue «Sin
//  presentarse» con elapsed >= grace (colorAndAlert). La llegada posterior a
//  «En Sala» con la marca puesta es ROJO/FRAUDE_EXTEMPORANEO; sin la marca,
//  VERDE/INGRESO_A_TIEMPO. Estos casos fijan los DOS bordes de esa frontera
//  con el motor de verdad (colorAndAlert + maybeNotify), como suite_10.
//
//  PHI: solo el molde falso de siempre (PACIENTE DE PRUEBA / 222222, MEDICO
//  DE PRUEBA / 374). Ningún dato real.
// =====================================================================

module.exports = {
  nombre: "Orden #10 — ventana estricta de confirmación (6 min) y usuario en la bitácora",
  cubre: ["colorAndAlert", "maybeNotify", "logEvent", "exportAudit", "eventsOf", "apptKey"],

  async pruebas(t, api, env, cargar) {
    const cita = (doc, hora) => ({ hora_texto: hora || "08:00 AM", estado: "Sin presentarse", nombre: "PACIENTE DE PRUEBA", index: 1, doc_id: doc });
    const filas = (c, ev) => c.api.eventsOf(c.api.todayStamp()).filter((e) => e && e.ev === ev);

    // Motor de verdad: la primera lectura de una cita es SIEMBRA (no avisa),
    // las siguientes son transiciones reales — patrón de suite_10 (v18.0.13).
    const motor = (c) => {
      const sembrados = new Set();
      return (a, dt) => {
        const r = c.api.colorAndAlert(a, new Date("2026-08-10T08:00:00").getTime() + dt);
        if (!sembrados.has(r.key)) { c.api.__state.notified.set(r.key, "siembra"); sembrados.add(r.key); }
        c.api.maybeNotify(r);
        return r;
      };
    };

    // =====================================================================
    //  BORDE 1 — DENTRO de la ventana: confirmación a +5,9 min.
    // =====================================================================
    t.caso("v18.8.10 (ORDEN #10): dentro de la ventana — confirmar a +5,9 min es INGRESO_A_TIEMPO y jamás fraude", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const pasar = motor(c);
      // Siembra: la cita estaba «Sin presentarse» a tiempo (+0 min → AZUL).
      const s = pasar(cita("111111"), 0);
      t.igual(s.color, "AZUL", "a +0 min no hay ni prealerta");
      // Llegada a «En Sala» justo dentro de la ventana estricta (+5,9 min). El
      // antirrebote de v17.6.21 exige ver la lectura nueva DOS veces seguidas
      // antes de aceptarla (patrón de suite_10), así que la confirmación real
      // ocurre en la segunda lectura.
      const enSala = { ...cita("111111"), estado: "En Sala" };
      const r1 = pasar(enSala, 5.9 * 60000 + 1000);   // primera vista de «En Sala»
      t.cierto(r1.arrival, "es una llegada observada en vivo (en la primera vista)");
      const r2 = pasar(enSala, 5.9 * 60000 + 2000);  // segunda: transición aceptada
      t.igual(r2.color, "VERDE", "llegó dentro de los 6 min: verde, no rojo");
      c.api.evFlush();
      t.igual(filas(c, "INGRESO_A_TIEMPO").length, 1, "una sola fila de llegada a tiempo");
      t.igual(filas(c, "FRAUDE_EXTEMPORANEO").length, 0, "y CERO filas de fraude: la ventana se respetó");
      const ingreso = filas(c, "INGRESO_A_TIEMPO")[0];
      t.cierto(Math.abs(ingreso.min - 5.9) < 0.1, "la desviación registrada es +5,9 min (justo dentro del límite)");
    });

    // =====================================================================
    //  BORDE 2 — LA FRONTERA EXACTA: +5,99 aún no sospecha; +6,00 la marca
    //  nace (la ventana «de 6 minutos posteriores» INCLUYE el minuto 6).
    // =====================================================================
    t.caso("v18.8.10 (ORDEN #10): frontera estricta — a +5,99 no hay sospecha; a +6,00 exactos la marca nace", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      // A +5,99 min la cita sigue «Sin presentarse»: prealerta MORADO, sin marca.
      const casi = c.api.colorAndAlert(cita("222222"), new Date("2026-08-10T08:00:00").getTime() + 5.99 * 60000);
      t.igual(casi.color, "MORADO", "a 0,01 min de la gracia es prealerta, no sospecha");
      t.falso(c.api.__state.fraudWatch.has(casi.key), "y la marca de sospecha aún no existe");
      // A +6,00 min exactos (el último segundo del minuto 6): la ventana cerró.
      const frontera = c.api.colorAndAlert(cita("222222"), new Date("2026-08-10T08:00:00").getTime() + 6.0 * 60000);
      t.igual(frontera.color, "AMBAR", "a +6,00 min exactos la ventana está cerrada: ámbar");
      t.cierto(c.api.__state.fraudWatch.has(frontera.key), "la marca de sospecha nace en el minuto 6 exacto (>= grace)");
    });

    // =====================================================================
    //  BORDE 3 — FUERA de la ventana: confirmación a +6,1 min. El cierre
    //  completo: ROJO con sonido, fila FRAUDE_EXTEMPORANEO y NUNCA la fila
    //  de «a tiempo».
    // =====================================================================
    t.caso("v18.8.10 (ORDEN #10): fuera de la ventana — confirmar a +6,1 min dispara FRAUDE_EXTEMPORANEO y nunca INGRESO_A_TIEMPO", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const pasar = motor(c);
      // Siembra: «Sin presentarse» ya pasada la gracia (el líder la ve a +6,1).
      const s = pasar(cita("333333"), 6.1 * 60000);
      t.igual(s.color, "AMBAR", "la siembra ve la cita vencida en ámbar");
      t.cierto(c.api.__state.fraudWatch.has(s.key), "y la marca de sospecha queda puesta (lectura líder, sin relevo reciente)");
      // Llegada a «En Sala» a +6,2 min: la marca estaba puesta → ROJO una vez.
      // (Dos lecturas: el antirrebote acepta la transición en la segunda.)
      const enSala = { ...cita("333333"), estado: "En Sala" };
      pasar(enSala, 6.2 * 60000);                       // primera vista de «En Sala»
      const r2 = pasar(enSala, 6.3 * 60000);            // transición aceptada aquí
      t.igual(r2.color, "ROJO", "confirmación extemporánea: rojo");
      t.cierto(r2.sound, "y suena (transición observada en vivo)");
      const r3 = pasar(enSala, 6.4 * 60000);
      t.falso(r3.sound, "pero una sola vez: la lectura repetida ya no suena");
      c.api.evFlush();
      t.igual(filas(c, "FRAUDE_EXTEMPORANEO").length, 1, "exactamente UNA fila de fraude por el hecho");
      t.igual(filas(c, "INGRESO_A_TIEMPO").length, 0, "cero filas de «a tiempo»: la extemporánea jamás se cuenta como válida");
      const fraude = filas(c, "FRAUDE_EXTEMPORANEO")[0];
      t.igual(fraude.hora, "08:00 AM", "la fila conserva la hora ORIGINAL de la cita");
      t.igual(fraude.doc, "333333", "y el identificador del paciente");
      t.cierto(fraude.min >= 6, "con una desviación registrada fuera de la ventana (>= 6 min)");
    });

    // =====================================================================
    //  REGISTRO COMPLETO (punto 3 de la orden): el usuario de la sesión
    //  (login de Everest) viaja en cada fila de la bitácora y sale en la
    //  columna «Usuario» del CSV de reclamación.
    // =====================================================================
    t.caso("v18.8.10 (ORDEN #10): la bitácora y el CSV llevan el usuario de la sesión en cada fila", () => {
      const c = cargar({ silencioso: true });
      const blobs = [];
      c.ctx.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; blobs.push(this); };
      c.ctx.URL = { createObjectURL: () => "blob:csv", revokeObjectURL() {} };
      c.api.__state.activeDoctor = { id: 374, name: "MEDICO DE PRUEBA" };
      const ev = { t: "09:10:00", ev: "FRAUDE_EXTEMPORANEO", hora: "08:00 AM", doc: "222222", estado: "En Sala", min: 12, nombre: "PACIENTE DE PRUEBA", key: c.api.apptKey(cita("222222")) };
      c.api.logEvent(ev);
      c.api.evFlush();
      t.igual(filas(c, "FRAUDE_EXTEMPORANEO")[0].usr, "MEDICO DE PRUEBA", "la fila de la bitácora lleva la sesión que estaba delante");
      c.api.exportAudit(c.api.todayStamp());
      const csv = blobs[0].parts[0];
      t.cierto(csv.indexOf("Paciente;Usuario") >= 0, "el CSV ganó la columna «Usuario» al final");
      t.cierto(csv.indexOf("PACIENTE DE PRUEBA;MEDICO DE PRUEBA") >= 0, "y la fila del hecho termina con el usuario de la sesión");
    });

    t.caso("v18.8.10 (ORDEN #10): sin sesión capturada la celda Usuario queda vacía — nunca se inventa", () => {
      const c = cargar({ silencioso: true });
      const blobs = [];
      c.ctx.Blob = function (parts, opts) { this.parts = parts; this.opts = opts; blobs.push(this); };
      c.ctx.URL = { createObjectURL: () => "blob:csv", revokeObjectURL() {} };
      c.api.__state.activeDoctor = { id: 0, name: "" };   // sesión aún no capturada
      const ev = { t: "09:20:00", ev: "INGRESO_A_TIEMPO", hora: "09:00 AM", doc: "333333", estado: "En Sala", min: 3, nombre: "PACIENTE DE PRUEBA", key: c.api.apptKey(cita("333333", "09:00 AM")) };
      c.api.logEvent(ev);
      c.api.evFlush();
      t.falso(!!filas(c, "INGRESO_A_TIEMPO")[0].usr, "sin sesión, la fila no lleva usuario");
      c.api.exportAudit(c.api.todayStamp());
      const csv = blobs[0].parts[0];
      t.cierto(csv.indexOf("Paciente;Usuario") >= 0, "la columna existe igualmente");
      t.cierto(csv.indexOf("PACIENTE DE PRUEBA;MEDICO") < 0, "pero la celda queda vacía: jamás un dato inventado");
      t.cierto(new RegExp("3;PACIENTE DE PRUEBA;(\\r\\n|$)").test(csv), "la fila termina en el nombre del paciente, con la celda de usuario vacía");
    });
  },
};
