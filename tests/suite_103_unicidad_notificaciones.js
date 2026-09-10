// =====================================================================
//  SUITE 103 — Unicidad de notificaciones por evento, aislamiento entre
//              instancias y desviación horaria sin negativos (v18.8.7)
//
//  Orden del médico (08-sep), con el CSV real de auditoría adjunto:
//   1. una notificación UNA vez por evento válido (las rachas de
//      LECTURA_TRAS_RELEVO_SIN_CONFIRMAR de los mismos pacientes debían
//      morir),
//   2. aislamiento TOTAL entre ventanas/pestañas/instancias (nada de
//      notificaciones se comparte; lo único compartido es el candado
//      anti-duplicado, que es justo lo que impide que dos instancias
//      emitan lo mismo),
//   3. sin pares dobles CAMBIO_ESTADO + INGRESO_A_TIEMPO del mismo
//      paciente en la misma hora programada,
//   4. sin minutos negativos en la columna de desviación (-35.3, -43.7),
//   5. control de unicidad por (evento, cita, día) en CUALQUIER instancia,
//   6. un solo registro de auditoría por evento válido, sin fugas.
//
//  Los candados de AVISO por pestaña ya existían; la grieta era la
//  AUDITORÍA, que solo se deduplicaba en la memoria de cada pestaña. El
//  candado nuevo vive en `vgl_audit_unico` (almacén compartido del día,
//  patrón de vgl_fraude_dia2) y se consulta dentro de logEvent antes de
//  escribir la fila: la primera instancia gana la marca, las demás callan.
// =====================================================================

module.exports = {
  nombre: "Unicidad de notificaciones por evento y aislamiento entre instancias (orden 08-sep)",
  cubre: ["logEvent", "_auditMarcaUnica", "colorAndAlert", "maybeNotify", "eventsOf", "todayStamp", "apptKey"],

  async pruebas(t, api, env, cargar) {
    const ref = new Date("2026-08-10T08:00:00").getTime();
    const cita = (estado, doc, hora) => ({ hora_texto: hora || "08:00 AM", estado, nombre: "PACIENTE DE PRUEBA", index: 1, doc_id: doc || "222222" });
    const filas = (c, ev) => c.api.eventsOf(c.api.todayStamp()).filter((e) => e && e.ev === ev);

    // =====================================================================
    // R5/R6 — unicidad dentro de UNA instancia: la misma fila repetida en la
    // misma pestaña no puede multiplicarse.
    // =====================================================================
    t.caso("v18.8.7 (R5/R6): una misma notificación se escribe UNA sola vez, aunque la misma instancia la repita", () => {
      const c = cargar({ silencioso: true });
      t.cierto(c.api._auditMarcaUnica("INGRESO_A_TIEMPO|k-unidad"), "la unidad del candado: la primera marca gana");
      t.falso(c.api._auditMarcaUnica("INGRESO_A_TIEMPO|k-unidad"), "y la segunda vez la marca ya está puesta");
      const ev = { t: "08:01:00", ev: "INGRESO_A_TIEMPO", hora: "08:00 AM", doc: "222222", estado: "En Sala", min: 1, nombre: "PACIENTE DE PRUEBA", key: c.api.apptKey(cita("En Sala")) };
      c.api.logEvent(ev); c.api.logEvent(ev); c.api.logEvent(ev);
      t.igual(filas(c, "INGRESO_A_TIEMPO").length, 1, "tres intentos, UNA fila");
      // contención: OTRA cita del mismo tipo sigue teniendo su propia fila
      const otra = { ...ev, hora: "09:00 AM", key: c.api.apptKey(cita("En Sala", "333333", "09:00 AM")) };
      c.api.logEvent(otra);
      t.igual(filas(c, "INGRESO_A_TIEMPO").length, 2, "el candado es por cita: la segunda cita registra la suya");
    });

    // =====================================================================
    // R5/R6 — unicidad ENTRE instancias: dos pestañas con almacén compartido
    // (como en el navegador real) no pueden duplicar el mismo hecho.
    // =====================================================================
    t.caso("v18.8.7 (R5/R6): dos instancias con almacén compartido dejan UNA sola fila por evento", () => {
      const A = cargar({ silencioso: true });
      const B = cargar({ silencioso: true, almacen: A.env.almacen });
      const ev = { t: "09:10:00", ev: "FRAUDE_EXTEMPORANEO", hora: "08:00 AM", doc: "222222", estado: "En Sala", min: 12, nombre: "PACIENTE DE PRUEBA", key: A.api.apptKey(cita("En Sala")) };
      A.api.logEvent(ev);
      B.api.logEvent(ev);
      t.igual(filas(A, "FRAUDE_EXTEMPORANEO").length, 1, "la segunda instancia ve la marca de la primera y calla");
      const marca = JSON.parse(A.env.storage.getItem("vgl_audit_unico") || "{}");
      t.cierto(!!(marca.mapa && marca.mapa["FRAUDE_EXTEMPORANEO|" + ev.key]), "la marca queda en el candado compartido del día");
    });

    // =====================================================================
    // R1 — las rachas de LECTURA_TRAS_RELEVO_SIN_CONFIRMAR (hasta SIETE
    // líneas por un hecho en el CSV del médico) mueren también ENTRE
    // pestañas: la gracia del relevo se reabre en cada cambio de pestaña y
    // cada pestaña tiene su propio candado en memoria.
    // =====================================================================
    t.caso("v18.8.7 (R1): la constancia de «lectura tras relevo» no se repite entre instancias", () => {
      const A = cargar({ silencioso: true });
      const B = cargar({ silencioso: true, almacen: A.env.almacen });
      for (const c of [A, B]) {
        c.api.__state.leader = true;
        c.api.__CONFIG.TOLERANCIA_MIN = 6;
        // cita de las 08:00 leída a las 08:20 (20 min tarde) con la gracia de relevo activa
        c.api._setUltimoRelevoParaTest(Date.now());
        c.api.colorAndAlert(cita("Sin presentarse"), ref + 20 * 60000);
        c.api.colorAndAlert(cita("Sin presentarse"), ref + 20 * 60000);
        c.api._setUltimoRelevoParaTest(Date.now());
        c.api.colorAndAlert(cita("Sin presentarse"), ref + 20 * 60000);
      }
      // la fila de la segunda instancia (si su logEvent no quedó bloqueado por el candado
      // compartido) vive en SU buffer de tandas: se vacía antes de contar.
      B.api.evFlush();
      t.igual(filas(A, "LECTURA_TRAS_RELEVO_SIN_CONFIRMAR").length, 1, "dos instancias, varias reaperturas de la gracia: UNA sola constancia");
    });

    // =====================================================================
    // R3 — el par doble CAMBIO_ESTADO + INGRESO_A_TIEMPO del mismo paciente
    // a la misma hora programada se unifica: la llegada a sala queda SOLO en
    // su evento tipado; las transiciones sin evento propio siguen teniendo
    // su CAMBIO_ESTADO.
    // =====================================================================
    t.caso("v18.8.7 (R3): la llegada a sala se registra UNA vez (INGRESO_A_TIEMPO) y no se duplica como CAMBIO_ESTADO", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const r1 = c.api.colorAndAlert(cita("Sin presentarse"), ref);       // siembra
      c.api.maybeNotify(r1);
      const r2 = c.api.colorAndAlert(cita("En Sala"), ref + 60000);       // llegada en vivo
      c.api.maybeNotify(r2);
      t.igual(filas(c, "INGRESO_A_TIEMPO").length, 1, "la llegada queda en su evento tipado");
      t.igual(filas(c, "CAMBIO_ESTADO").length, 0, "y NO deja un CAMBIO_ESTADO redundante al lado");
      // la siguiente transición real (en sala → atendido) SÍ conserva su CAMBIO_ESTADO
      const r3 = c.api.colorAndAlert(cita("Atendido"), ref + 120000);
      c.api.maybeNotify(r3);
      const cambios = filas(c, "CAMBIO_ESTADO");
      t.igual(cambios.length, 1, "en sala → atendido sigue registrándose como CAMBIO_ESTADO");
      t.igual(cambios[0].previo, "en sala", "con su estado previo para la trazabilidad");
    });

    // =====================================================================
    // R3/R5 — una misma transición legítima (en sala → atendido) vista por
    // DOS instancias solo se registra una vez: la marca del CAMBIO_ESTADO
    // incluye la transición, para no amputar transiciones posteriores.
    // =====================================================================
    t.caso("v18.8.7 (R3/R5): la misma transición vista por dos instancias deja UNA fila CAMBIO_ESTADO", () => {
      const A = cargar({ silencioso: true });
      const B = cargar({ silencioso: true, almacen: A.env.almacen });
      for (const c of [A, B]) {
        c.api.__state.leader = true;
        c.api.__CONFIG.TOLERANCIA_MIN = 6;
        c.api.colorAndAlert(cita("En Sala"), ref);                        // cada pestaña siembra su histórico
        c.api.colorAndAlert(cita("Atendido"), ref + 120000);              // y cada una ve la transición
      }
      B.api.evFlush();                                                    // la fila de B, si no la bloqueó el candado, vive en su buffer
      t.igual(filas(A, "CAMBIO_ESTADO").length, 1, "la segunda instancia ve la marca de transición y no repite la fila");
      // y otra transición DISTINTA de la misma cita no queda amputada por la marca anterior
      // (oscilación de vuelta, la misma familia de parpadeos que ya documentó v17.6.21)
      A.api.colorAndAlert(cita("Sin presentarse"), ref + 240000);
      t.igual(filas(A, "CAMBIO_ESTADO").length, 2, "atendido → sin presentarse es OTRA transición: tiene su propia fila");
    });

    // =====================================================================
    // R4 — los minutos negativos (-35.3, -43.7 del CSV) se normalizan a 0 en
    // la bitácora; los positivos quedan intactos.
    // =====================================================================
    t.caso("v18.8.7 (R4): la desviación horaria nunca se registra negativa en la auditoría", () => {
      const c = cargar({ silencioso: true });
      c.api.logEvent({ t: "x", ev: "INGRESO_A_TIEMPO", hora: "10:55 AM", doc: "111", estado: "En Sala", min: -43.7, nombre: "PACIENTE DE PRUEBA", key: "neg@1" });
      c.api.logEvent({ t: "x", ev: "INASISTENCIA", hora: "09:00 AM", doc: "222", estado: "Sin presentarse", min: 21.5, nombre: "PACIENTE DE PRUEBA", key: "pos@1" });
      const todas = c.api.eventsOf(c.api.todayStamp());
      const neg = todas.find((e) => e && e.key === "neg@1");
      const pos = todas.find((e) => e && e.key === "pos@1");
      t.igual(neg.min, 0, "-43.7 se normaliza a 0 (el retraso reclamable no puede ser negativo)");
      t.igual(pos.min, 21.5, "un retraso positivo se conserva tal cual");
    });

    // =====================================================================
    // R2 — aislamiento total: la instancia perdedora no recibe el aviso de
    // la ganadora, no cuenta y no re-emite; lo ÚNICO que viaja por el
    // almacén compartido es el candado, sin datos del paciente.
    // =====================================================================
    t.caso("v18.8.7 (R2): el aviso no se propaga entre instancias — solo el candado, sin datos", () => {
      const A = cargar({ silencioso: true });
      const B = cargar({ silencioso: true, almacen: A.env.almacen });
      A.api.__state.leader = true;
      A.api.__CONFIG.TOLERANCIA_MIN = 6;
      const base = { hora_texto: "08:00 AM", doc_id: "222222", nombre: "PACIENTE DE PRUEBA", elapsed: 1, reason: "" };
      const key = A.api.apptKey(base);
      const ev = (estado, color, arrival) => ({ ...base, key, estado, color, arrival: !!arrival, visto: "08:01:00" });
      A.api.maybeNotify(ev("Sin presentarse", "AZUL", false));            // siembra de A
      A.api.maybeNotify(ev("En sala", "VERDE", true));                    // A cuenta y avisa
      const atiempo = (c) => {
        const s = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}");
        return (s[c.api.todayStamp()] && s[c.api.todayStamp()].atiempo) || 0;
      };
      B.api._fraudeCompartidoFusionar();
      B.api.maybeNotify(ev("En sala", "VERDE", true));                    // B llega tarde al mismo hecho
      B.api.evFlush();
      t.igual(atiempo(A), 1, "el indicador queda en 1: B no vuelve a sumar");
      t.igual(filas(A, "INGRESO_A_TIEMPO").length, 1, "y la bitácora queda con UNA fila");
      const candado = A.env.storage.getItem("vgl_audit_unico") || "";
      t.falso(candado.indexOf("PACIENTE DE PRUEBA") !== -1, "el candado compartido no guarda ningún dato del paciente");
    });
  },
};
