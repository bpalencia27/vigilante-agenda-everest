module.exports = {
  nombre: "Colores y notificaciones de la agenda",
  cubre: ["colorAndAlert", "muted", "muteFor", "unmute", "crossTabDup", "avisoYaVisto", "avisoMarcarVisto", "nkey", "maybeNotify", "avisoUniversal", "checkAvisoUniversal", "_avisoUnivReset", "_encolarAvisoPendiente", "_flushAvisosPendientes", "_dispararAvisoReal", "_siembraCompartidaLeer", "_siembraCompartidaGuardar", "_sembrarEstadoInicial", "bumpStatCita", "_proximoDeadlineTiempo", "_hayCitaCritica", "_ajustarSondeo"],
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

    // v17.6.74 — REPORTE EN VIVO (26-ago, captura): "confirmación extemporánea" para un
    // paciente que el médico jura tuvo en sala a tiempo — "es como si no leyera en tiempo
    // real la agenda". Causa real: una pestaña de fondo (con el temporizador estrangulado
    // por el navegador) podía marcar fraudWatch con una lectura suya propia, atrasada, de
    // "Sin presentarse" pasados los 6 min — y esa marca se comparte a TODAS las pestañas,
    // sin vía para deshacerla, aunque la pestaña activa ya hubiera visto "En Sala" hace
    // rato. Ahora solo la pestaña LÍDER puede ORIGINAR la marca.
    t.caso("v17.6.74: una pestaña NO líder no origina fraudWatch aunque su propia lectura vea Sin presentarse pasada la gracia", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:10:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = false;   // pestaña de fondo, no la líder
      c.api.__CONFIG.TOLERANCIA_MIN = 6;

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "AMBAR", "esta pestaña SÍ pinta AMBAR (es un cálculo instantáneo, sin memoria)");
      t.falso(c.api.__state.fraudWatch.has(r.key), "pero NO origina la marca compartida — eso solo lo hace la líder");
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

    // =====================================================================
    //  v18.0.12 — ESTE CASO REEMPLAZA AL DE v16.2.8, PORQUE SU PREMISA ERA FALSA
    //
    //  La v16.2.8 (20-ago) trató el salto «sin presentarse → atendido» como un hecho real y
    //  decidió «no notificar, pero registrar en rojo». El 31-ago el médico corrigió la
    //  premisa, dos veces y sin margen:
    //    «el rojo es cuando cambia de "sin presentarse" a "en sala" después del tiempo de
    //     confirmación. en ningún momento pasará de sin presentarse a atendido»
    //    «yo soy el que decido si se atiende o no al que llega tarde […] JAMÁS pasaría a la
    //     leyenda "atendido" si yo no estoy de acuerdo en atenderlo»
    //
    //  O sea: en Everest la cita SIEMPRE pasa por «En Sala» (ahí él llama al paciente) antes
    //  de «Atendido». Lo que veía en agosto no era Everest saltándose un estado: era EL
    //  SCRIPT perdiéndose esa lectura — el mismo hueco que se arregló por tres sitios el
    //  31-ago (líder ciego, antirrebote que resucitaba estados viejos, y el descanso de 5
    //  minutos del API).
    //
    //  Y el coste medido de tratarlo como hecho clínico: por esa rama el contador de fraude
    //  subía a 1 SIN escribir la fila FRAUDE_EXTEMPORANEO —solo un CAMBIO_ESTADO genérico—,
    //  así que el médico veía «1 confirmación extemporánea» y no encontraba la línea con la
    //  que reclamar. Un número sin evidencia detrás es justo lo que este proyecto prohíbe.
    // =====================================================================
    t.caso("v18.0.12: el salto imposible a Atendido NO es un fraude — es un hueco de lectura, y así se registra", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Atendido", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      const k = c.api.apptKey(a);
      c.api.__state.fraudWatch.add(k); // estaba en ámbar

      const r = c.api.colorAndAlert(a, refDate);
      t.falso(r.color === "ROJO", "ya no se afirma una confirmación extemporánea que nadie vio");
      t.falso(r.sound, "y sigue sin sonar, como el médico pidió en agosto");
      t.falso(c.api.__state.alertedFraud.has(k), "no se marca como fraude avisado: no hubo fraude observado");

      c.api.evFlush();
      const filas = JSON.parse(c.env.storage.getItem(c.api.evKey(c.api.todayStamp())) || "[]");
      const hueco = filas.filter((x) => x && x.ev === "HUECO_DE_LECTURA");
      t.igual(hueco.length, 1, "queda constancia del hecho VERDADERO: al script se le escapó una lectura");
      t.igual(hueco[0].doc, "123", "con la cita afectada, para que se pueda investigar");
      t.igual(filas.filter((x) => x && x.ev === "FRAUDE_EXTEMPORANEO").length, 0,
        "y ninguna fila de fraude: no se firma una evidencia que no se observó");
    });

    t.caso("v18.0.12: y no se repite en cada vuelta — una cita, un hueco, una fila", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Atendido", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__state.fraudWatch.add(c.api.apptKey(a));
      c.api.colorAndAlert(a, refDate);
      c.api.colorAndAlert(a, refDate + 5000);
      c.api.colorAndAlert(a, refDate + 10000);
      c.api.evFlush();
      const filas = JSON.parse(c.env.storage.getItem(c.api.evKey(c.api.todayStamp())) || "[]");
      t.igual(filas.filter((x) => x && x.ev === "HUECO_DE_LECTURA").length, 1,
        "el sondeo pasa cada pocos segundos: sin candado, la bitácora se llenaría de la misma línea");
    });

    t.caso("v18.0.12: el FRAUDE REAL (pasa por En Sala) no se toca — sigue sonando y sigue dejando su fila", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      const k = c.api.apptKey(a);
      c.api.__state.fraudWatch.add(k);
      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "ROJO", "esta es la transición que el médico SÍ quiere vigilada");
      t.cierto(r.sound, "y esta sí suena");
      // v18.0.13 — la fila del fraude se escribe DONDE SE CUENTA (maybeNotify), no en
      // colorAndAlert: así el número de la cabecera del CSV y las filas del cuerpo no pueden
      // separarse. Por eso esta prueba recorre ahora el camino entero, que es el real.
      c.api.__state.notified.set(r.key, "siembra");
      c.api.maybeNotify(r);
      c.api.evFlush();
      const filas = JSON.parse(c.env.storage.getItem(c.api.evKey(c.api.todayStamp())) || "[]");
      t.igual(filas.filter((x) => x && x.ev === "FRAUDE_EXTEMPORANEO").length, 1,
        "con su fila de evidencia, que es la que sustenta la reclamación");
      const cont = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}")[c.api.todayStamp()] || {};
      t.igual(cont.fraude || 0, 1, "y contado exactamente una vez: fila y número van juntos");
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

    // v17.6.21 — REPORTE DE CAMPO (24-ago-2026, con CSV real de auditoría adjunto): "la
    // tarjeta titilaba entre verde y ámbar" y un aviso de confirmación extemporánea llegó
    // "súper tarde". El CSV mostró el MISMO paciente alternando En Sala/Sin presentarse
    // más de 10 veces en 15 min — la firma de dos fuentes (API vs DOM) en desacuerdo, no
    // de un paciente moviéndose de verdad. Cada parpadeo generaba un CAMBIO_ESTADO real.
    t.caso("colorAndAlert: un solo parpadeo (una lectura distinta que NO se repite) queda absorbido — sin cambio de color ni de texto", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      const aSinPres = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;

      const r1 = c.api.colorAndAlert(aSinPres, refDate);
      t.igual(r1.color, "AMBAR", "primera lectura: confirmada de inmediato (no hay historial previo)");
      t.igual(r1.estado, "Sin presentarse");

      // Lectura 2: OTRA fuente dice "En Sala" — un solo tick, no se repite todavía.
      const aEnSala = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "JUAN", index: 1, doc_id: "123" };
      const r2 = c.api.colorAndAlert(aEnSala, refDate);
      t.igual(r2.color, "AMBAR", "el parpadeo NO se acepta a la primera lectura: sigue el color confirmado");
      t.igual(r2.estado, "Sin presentarse", "y el texto de la tarjeta tampoco cambia — color y texto van SIEMPRE juntos");
      t.falso(r2.arrival, "no se cuenta como llegada: nunca se confirmó");

      // Lectura 3: vuelve a "Sin presentarse" — el parpadeo se resolvió solo, sin dejar rastro.
      const r3 = c.api.colorAndAlert(aSinPres, refDate);
      t.igual(r3.color, "AMBAR");
      t.igual(r3.estado, "Sin presentarse");
    });

    t.caso("colorAndAlert: la MISMA lectura repetida dos veces seguidas SÍ se confirma como cambio real", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T07:58:00").getTime(); // dentro de la gracia: sin fraudWatch todavía
      const aSinPres = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      c.api.colorAndAlert(aSinPres, refDate); // primera lectura: confirmada (sin historial previo)

      const aEnSala = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "JUAN", index: 1, doc_id: "123" };
      const r2 = c.api.colorAndAlert(aEnSala, refDate); // candidato: todavía no confirma
      t.igual(r2.color, "AZUL", "todavía dentro de la gracia con 'Sin presentarse' confirmado");

      const r3 = c.api.colorAndAlert(aEnSala, refDate); // MISMA lectura otra vez: confirma
      t.igual(r3.color, "VERDE", "segunda lectura seguida del mismo valor: el cambio real SÍ se acepta");
      t.igual(r3.estado, "En Sala");
      t.cierto(r3.arrival, "y cuenta como llegada, porque el estado confirmado anterior no era 'en sala'");
    });

    // v18.0.62 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta.
    // `fraudWatch`/`alertedFraud` (conjuntos) ya leían con el respaldo de claves viejas;
    // `state.historical` y `state.historicalAt` (mapas) no: leían y escribían con la clave
    // cruda. Y que el doc_id parpadee entre lecturas no es hipotético — está documentado
    // como real en el comentario de `apptKey`: la API lo trae y el respaldo por DOM a veces
    // no. Con eso, la MISMA cita cambia de clave y su historial deja de verse.
    t.caso("v18.0.62: si el doc_id se pierde entre lecturas, la cita NO se cuenta como una segunda llegada", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T07:55:00").getTime();
      const conDoc = { hora_texto: "08:00 AM", estado: "En sala", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" };
      const sinDoc = { hora_texto: "08:00 AM", estado: "En sala", nombre: "PACIENTE UNO", index: 1, doc_id: "" };
      c.api.__state.leader = true;

      const r1 = c.api.colorAndAlert(conDoc, refDate);
      t.cierto(r1.arrival, "la primera lectura sí es la llegada real");

      // v18.0.98: mientras la pestaña vive, el alias de `apptKey` ya mantiene la clave. Se
      // olvida a propósito (reinicio del script, día nuevo) para que esta prueba siga
      // ejercitando el respaldo de v18.0.62 — la escritura bajo todas las identidades.
      c.api.__apptAliasDoc.clear();
      const r2 = c.api.colorAndAlert(sinDoc, refDate);
      t.falso(r1.key === r2.key, "la clave cambia de verdad al perderse el documento: el escenario que se prueba existe");
      t.falso(r2.arrival, "la MISMA cita leída por la otra vía no puede sonar como una segunda llegada");
    });

    // El parpadeo va en las DOS direcciones, y cada una la cubre una mitad distinta del
    // arreglo: doc→sin-doc la cubre la ESCRITURA bajo todas las identidades (la de arriba);
    // sin-doc→doc la cubre la LECTURA tolerante, porque con la cita ya anotada solo por
    // nombre no hay forma de derivar la clave por documento sin buscarla.
    t.caso("v18.0.62: y tampoco al revés — si el documento APARECE entre lecturas", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T07:55:00").getTime();
      const sinDoc = { hora_texto: "08:00 AM", estado: "En sala", nombre: "PACIENTE UNO", index: 1, doc_id: "" };
      const conDoc = { hora_texto: "08:00 AM", estado: "En sala", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" };
      c.api.__state.leader = true;

      const r1 = c.api.colorAndAlert(sinDoc, refDate);
      t.cierto(r1.arrival, "la primera lectura, sin documento, es la llegada real");

      const r2 = c.api.colorAndAlert(conDoc, refDate);
      t.falso(r1.key === r2.key, "la clave cambia de verdad al aparecer el documento");
      t.falso(r2.arrival, "y la cita ya conocida no vuelve a contarse");
    });

    // `historicalAt` es la OTRA mitad del antirrebote: la guarda de v18.0.8 solo lo aplica si
    // la lectura anterior es RECIENTE. Leída con la clave cruda, un parpadeo del documento la
    // deja en 0 → "hueco largo" → la lectura fresca manda de inmediato y el antirrebote se
    // salta igual, aunque `esNueva` esté bien resuelto.
    t.caso("v18.0.62: la marca de tiempo del antirrebote sobrevive al parpadeo del documento", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const sinPresSinDoc = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "PACIENTE UNO", index: 1, doc_id: "" };
      const enSalaConDoc = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" };

      const r1 = c.api.colorAndAlert(sinPresSinDoc, refDate);
      t.igual(r1.color, "AMBAR", "estado de partida, anotado SOLO bajo la clave por nombre");

      const r2 = c.api.colorAndAlert(enSalaConDoc, refDate);
      t.igual(r2.estado, "Sin presentarse", "la lectura anterior es reciente: el antirrebote sigue en pie");
      t.igual(r2.color, "AMBAR");
    });

    t.caso("v18.0.62: un parpadeo del doc_id no anula el antirrebote de v17.6.21", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const sinPresConDoc = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" };
      const enSalaSinDoc = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "PACIENTE UNO", index: 1, doc_id: "" };

      const r1 = c.api.colorAndAlert(sinPresConDoc, refDate);
      t.igual(r1.color, "AMBAR", "estado de partida, ya confirmado");

      // Una sola lectura, con OTRA clave por el parpadeo del documento. Sin el respaldo, la
      // cita parece nueva, `esNueva` sale true y el antirrebote se salta entero: la tarjeta
      // saltaría a VERDE «En Sala» con una única lectura sin confirmar.
      c.api.__apptAliasDoc.clear(); // v18.0.98: se olvida el alias para que la clave cambie de verdad
      const r2 = c.api.colorAndAlert(enSalaSinDoc, refDate);
      t.igual(r2.estado, "Sin presentarse", "una sola lectura no confirma, aunque llegue con otra clave");
      t.igual(r2.color, "AMBAR", "y color y texto siguen viajando juntos");
      t.falso(r2.arrival, "ni cuenta como llegada");
    });

    // El candidato del antirrebote vive en `estadoPendiente`, y tiene que borrarse bajo las
    // MISMAS identidades con las que se sembró. Si no, el candidato sobrevive a su propia
    // confirmación y la siguiente vez que ese valor vuelva por la otra vía se acepta a la
    // primera — el antirrebote saltado por la puerta de atrás.
    t.caso("v18.0.62: el candidato del antirrebote no sobrevive bajo la otra identidad de la cita", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T07:58:00").getTime();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const sinPres = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" };
      const enSala = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" };
      const enSalaSinDoc = { hora_texto: "08:00 AM", estado: "En Sala", nombre: "PACIENTE UNO", index: 1, doc_id: "" };

      c.api.colorAndAlert(sinPres, refDate);           // primera lectura: confirma "Sin presentarse"
      c.api.colorAndAlert(enSala, refDate);            // parpadeo: queda un CANDIDATO "en sala"
      const r = c.api.colorAndAlert(sinPres, refDate); // el parpadeo se deshace: el candidato debe morir
      t.igual(r.estado, "Sin presentarse", "el parpadeo quedó absorbido, como en la prueba de v17.6.21");

      // Y ahora la lectura "En Sala" vuelve, una sola vez, por la vía SIN documento. Si al
      // deshacerse el parpadeo el candidato solo se borró bajo la clave con documento, sigue
      // vivo bajo la clave por nombre: esta única lectura lo daría por confirmado de golpe y
      // la tarjeta saltaría a VERDE «En Sala» sin la segunda lectura que exige el antirrebote.
      c.api.__apptAliasDoc.clear(); // v18.0.98: se olvida el alias para que la clave cambie de verdad
      const r2 = c.api.colorAndAlert(enSalaSinDoc, refDate);
      t.igual(r2.estado, "Sin presentarse", "sigue haciendo falta una segunda lectura seguida");
      t.falso(r2.arrival, "y no hay llegada sin confirmar");
    });

    // 02-sep — CIERRE DEL ENJAMBRE (auditoría adversarial, fila 23, gravedad alta). Las cinco
    // pruebas de v18.0.62 cubren parpadeos del documento SIN cambio de estado. Si el cambio
    // de estado se CONFIRMA en una lectura sin cédula y la cédula reaparece después, el
    // historial bajo la cédula seguía rancio y la misma llegada se confirmaba dos veces.
    t.caso("v18.0.98: un cambio de estado confirmado en una lectura SIN documento no produce una segunda llegada cuando el documento reaparece", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.leader = true; c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const ref = new Date("2026-08-10T07:58:00").getTime();
      const A = (estado, doc) => ({ hora_texto: "08:00 AM", estado, nombre: "PACIENTE UNO", index: 1, doc_id: doc });
      const claves = []; let llegadas = 0;
      for (const a of [A("Sin presentarse", ""), A("Sin presentarse", "222222"), A("En Sala", "222222"), A("En Sala", ""), A("En Sala", "222222")]) {
        const r = c.api.colorAndAlert(a, ref); claves.push(r.key); if (r.arrival) llegadas++; c.api.maybeNotify(r);
      }
      t.igual(llegadas, 1, "UNA sola llegada real → UN solo arrival:true (antes: 2)");
      t.igual([...c.api.__state.contadas].length, 1, "y se cuenta UNA sola vez en el CSV de puntualidad (antes: «atiempo» dos veces)");
      // La primera lectura no tiene cédula y solo puede identificarse por nombre; desde la
      // segunda, la cita ya se conoce con cédula y el alias devuelve esa identidad SIEMPRE,
      // incluida la cuarta lectura, que vuelve a llegar sin documento.
      t.falso(claves[0] === claves[1], "la primera lectura, sin cédula, solo pudo identificarse por nombre");
      t.cierto(claves.slice(1).every((k) => k === claves[1]), "en cuanto la cédula se conoció, todas las lecturas comparten la misma identidad: " + claves.join(", "));
    });

    // =====================================================================
    // v18.0.64 — EL CSV DE AUDITORÍA DEL MÉDICO SE INUNDABA
    // Reporte con el CSV real del 1-sep adjunto: «49 AVISOS HOY? NO ES MUCHO?». De esos 49
    // eventos, 36 eran legítimos (10 pacientes × 2 CAMBIO_ESTADO + 10 INGRESO_A_TIEMPO, más
    // 3 inasistencias con su ÚLTIMA_LLAMADA) y 13 eran esta constancia repetida — una MISMA
    // cita la generó SIETE veces (8:32, 8:53, 9:11, 9:17, 9:40 y dos a las 11:07, con cuatro
    // segundos entre ellas).
    //
    // La causa: esta rama escribe una línea y, a propósito, NO marca fraudWatch (la
    // evidencia queda a la espera de una lectura sin sospecha de estar estancada). Sin un
    // candado propio, volvía a escribirla en cada vuelta del reloj mientras durase la gracia
    // del relevo — y la gracia se reabre cada vez que el médico cambia de pestaña.
    //
    // El CSV es el documento con el que él reclama: repetir un hecho siete veces no añade
    // evidencia, la entierra.
    // =====================================================================
    t.caso("v18.0.64: la constancia de «lectura tras relevo» se escribe UNA vez por cita, no una por tick", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const a = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" };

      const cuantas = () => c.api.eventsOf(c.api.todayStamp())
        .filter((e) => e && e.ev === "LECTURA_TRAS_RELEVO_SIN_CONFIRMAR").length;

      // Relevo recién ocurrido: la gracia está activa, así que esta rama es la que corre.
      c.api._setUltimoRelevoParaTest(Date.now());
      c.api.colorAndAlert(a, refDate);
      c.api.colorAndAlert(a, refDate);
      c.api.colorAndAlert(a, refDate);
      t.igual(cuantas(), 1, "tres vueltas del reloj, UNA sola línea en la bitácora");

      // Y el médico cambia de pestaña, que es lo que reabre la gracia una y otra vez.
      c.api._setUltimoRelevoParaTest(Date.now());
      c.api.colorAndAlert(a, refDate);
      c.api._setUltimoRelevoParaTest(Date.now());
      c.api.colorAndAlert(a, refDate);
      t.igual(cuantas(), 1, "ni aunque el relevo se repita: el hecho ya está registrado");
    });

    t.caso("v18.0.64 (contención): la constancia sigue registrándose para OTRA cita distinta", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:20:00").getTime();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cuantas = () => c.api.eventsOf(c.api.todayStamp())
        .filter((e) => e && e.ev === "LECTURA_TRAS_RELEVO_SIN_CONFIRMAR").length;

      c.api._setUltimoRelevoParaTest(Date.now());
      c.api.colorAndAlert({ hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "PACIENTE UNO", index: 1, doc_id: "222222" }, refDate);
      c.api._setUltimoRelevoParaTest(Date.now());
      // 07:30 y no 08:20: a las 08:20 una cita de las 08:20 lleva 0 minutos de retraso y no
      // entra siquiera en la rama que escribe la constancia.
      c.api.colorAndAlert({ hora_texto: "07:30 AM", estado: "Sin presentarse", nombre: "PACIENTE DOS", index: 2, doc_id: "333333" }, refDate);
      t.igual(cuantas(), 2, "el candado es por cita: callar la segunda sería perder evidencia real");
    });

    // ---------- _proximoDeadlineTiempo (Fase 3: notificación en tiempo real) ----------
    t.caso("_proximoDeadlineTiempo: 'Sin presentarse' antes de la prealerta -> devuelve el instante de la prealerta", () => {
      const c = cargar();
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const now = new Date(2026, 7, 10, 8, 3, 0);
      const processed = [{ hora_texto: "08:00 AM", estado: "Sin presentarse" }];
      t.igual(c.api._proximoDeadlineTiempo(processed, now), new Date(2026, 7, 10, 8, 5, 0).getTime(), "siguiente cruce = 5 min (prealerta)");
    });

    t.caso("_proximoDeadlineTiempo: pasada la prealerta -> devuelve el instante de la gracia (AMBAR)", () => {
      const c = cargar();
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const now = new Date(2026, 7, 10, 8, 5, 30);
      const processed = [{ hora_texto: "08:00 AM", estado: "Sin presentarse" }];
      t.igual(c.api._proximoDeadlineTiempo(processed, now), new Date(2026, 7, 10, 8, 6, 0).getTime(), "siguiente cruce = 6 min (gracia)");
    });

    t.caso("_proximoDeadlineTiempo: ignora llegadas/atendidos y devuelve el cruce más próximo entre varias citas", () => {
      const c = cargar();
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const now = new Date(2026, 7, 10, 8, 2, 0);
      const processed = [
        { hora_texto: "07:00 AM", estado: "En sala" },
        { hora_texto: "08:00 AM", estado: "Sin presentarse" },
        { hora_texto: "08:10 AM", estado: "Sin presentarse" },
      ];
      t.igual(c.api._proximoDeadlineTiempo(processed, now), new Date(2026, 7, 10, 8, 5, 0).getTime(), "el más próximo es 08:05 (la llegada no cuenta)");
    });

    t.caso("_proximoDeadlineTiempo: sin citas pendientes o sin hora legible devuelve null", () => {
      const c = cargar();
      const now = new Date(2026, 7, 10, 8, 3, 0);
      t.igual(c.api._proximoDeadlineTiempo([], now), null, "lista vacía -> null");
      t.igual(c.api._proximoDeadlineTiempo([{ hora_texto: "sin-hora", estado: "Sin presentarse" }], now), null, "hora ilegible -> null");
      t.igual(c.api._proximoDeadlineTiempo([{ hora_texto: "08:00 AM", estado: "En sala" }], now), null, "todas llegaron -> null");
    });

    // ---------- _hayCitaCritica / _ajustarSondeo (Fase 3: polling adaptativo) ----------
    t.caso("_hayCitaCritica: 'Sin presentarse' a 30 s de la gracia es crítica; fuera de la ventana o llegada no", () => {
      const c = cargar();
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      t.cierto(c.api._hayCitaCritica([{ hora_texto: "08:00 AM", estado: "Sin presentarse" }], new Date(2026, 7, 10, 8, 5, 30)), "30 s antes de la gracia -> crítica");
      t.falso(c.api._hayCitaCritica([{ hora_texto: "08:00 AM", estado: "Sin presentarse" }], new Date(2026, 7, 10, 8, 4, 0)), "2 min antes de la gracia -> no crítica");
      t.falso(c.api._hayCitaCritica([{ hora_texto: "08:00 AM", estado: "En sala" }], new Date(2026, 7, 10, 8, 5, 30)), "ya llegó -> no crítica");
      t.falso(c.api._hayCitaCritica([{ hora_texto: "08:00 AM", estado: "Atendido" }], new Date(2026, 7, 10, 8, 5, 30)), "atendido -> no crítica");
    });

    t.caso("_ajustarSondeo: acelera a 2 s con cita crítica y vuelve a la cadencia base sin ella", () => {
      const c = cargar();
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      c.api.__CONFIG.POLL_MS = 5000;
      const fixed = new Date(2026, 7, 10, 8, 5, 30);
      const FechaFija = class extends Date {
        constructor(...a) { if (a.length === 0) { super(); this.setTime(fixed.getTime()); } else { super(...a); } }
        static now() { return fixed.getTime(); }
      };
      c.env.win.Date = FechaFija; c.ctx.Date = FechaFija;

      c.api._ajustarSondeo([{ hora_texto: "08:00 AM", estado: "Sin presentarse" }]);
      const rapido = (c.api._relojEstadoParaTest().locales || []).find((x) => x.id === "tick");
      t.cierto(rapido && rapido.ms === 2000, "con cita crítica el sondeo del tick baja a 2 s (obtuvo " + (rapido && rapido.ms) + ")");

      c.api._ajustarSondeo([{ hora_texto: "08:00 AM", estado: "En sala" }]);
      const base = (c.api._relojEstadoParaTest().locales || []).find((x) => x.id === "tick");
      t.cierto(base && base.ms === 5000, "sin cita crítica vuelve a la cadencia base (obtuvo " + (base && base.ms) + ")");
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

    // =================================================================
    //  v18.0.50 — REPORTE EN VIVO DEL MÉDICO (1-sep), y el enjambre de funciones lo
    //  encontró el mismo día por su cuenta:
    //
    //  «HOY NO ME AVISÓ SOBRE CUANDO LLEGÓ UN PACIENTE, PASÓ DE ESTADO "SIN PRESENTARSE"
    //   A "EN SALA" MIENTRAS YO ATENDÍA A OTRA PACIENTE CON SU HISTORIA CLÍNICA ABIERTA
    //   Y NUNCA ME AVISÓ»
    //
    //  El candado de leyendas era UNO por paciente y por día, compartido por tres avisos
    //  distintos: MORADO («última llamada»), VERDE («ya está en sala») y el checklist de
    //  cierre. El primero que ocurriera gastaba el único cupo. Y MORADO → VERDE no son
    //  dos avisos rivales: son las DOS ETAPAS DE LA MISMA ESPERA, con segundos de
    //  diferencia — cualquier paciente que confirme en el último minuto dispara los dos,
    //  en ese orden. Así que el médico recibía la alarma de «se está por vencer» y nunca
    //  la buena noticia de que sí llegó.
    //
    //  Se comprueba sobre el CANAL REAL: `crossTabDup("full|<uid>")` escribe su marca en
    //  localStorage dentro de _dispararAvisoAudible, así que la marca existe si y solo si
    //  el aviso audible/visible llegó a dispararse. (Cédula sintética.)
    // =================================================================
    t.caso("v18.0.50 — el aviso de «última llamada» ya no se come el de «el paciente llegó»", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.leader = true;
      const cita = (color, reason) => ({
        key: "cita1", doc_id: "111111", nombre: "PACIENTE PRUEBA", hora_texto: "6:20 a. m.",
        estado: color === "VERDE" ? "En sala" : "Sin presentarse",
        color: color, reason: reason, sound: true, arrival: color === "VERDE", elapsed: 1,
      });
      const marca = (k) => !!c.env.storage.getItem("vgl_n_full|cita1|" + k);

      // 1) Última llamada: queda ~1 min de gracia.
      const morado = cita("MORADO", "tiempo");
      c.api.__state.notified.set(morado.key, "siembra");
      c.api.maybeNotify(morado);
      t.cierto(marca("MORADO"), "el aviso de última llamada sí sale (control del escenario)");
      t.falso(marca("VERDE"), "y todavía no hay aviso de llegada, claro");

      // 2) Segundos después, el MISMO paciente entra a sala.
      const verde = cita("VERDE", "estado");
      c.api.__state.notified.set(verde.key, "siembra2");
      c.api.maybeNotify(verde);
      t.cierto(marca("VERDE"),
        "EL AVISO DE QUE LLEGÓ SÍ SALE, aunque antes hubiera sonado la última llamada del mismo paciente");
    });

    t.caso("v18.0.50 — pero una leyenda NO se repite para el mismo paciente en el día", () => {
      // La contención, comprobada POR CONDUCTA y no solo sobre la función del candado: al
      // escribir esta prueba, borrar la llamada entera desde `maybeNotify` dejaba el banco
      // en verde — el candado se probaba a sí mismo y nadie vigilaba que siguiera
      // conectado. Es el mismo hueco que ya mordió dos veces en esta sesión (v18.0.33 y
      // v18.0.36): comprobar que una función se porta bien NO comprueba que se llame.
      //
      // El segundo VERDE va con OTRA clave de cita y el MISMO paciente: así `crossTabDup`
      // (que deduplica por uid durante 12 s) no puede tapar el resultado, y lo único que
      // puede frenarlo es el candado de leyendas.
      const cc = cargar({ silencioso: true });
      cc.api.__state.leader = true;
      const citaDe = (key) => ({
        key: key, doc_id: "111111", nombre: "PACIENTE PRUEBA", hora_texto: "6:20 a. m.",
        estado: "En sala", color: "VERDE", reason: "estado", sound: true, arrival: true, elapsed: 1,
      });
      const primera = citaDe("cita1");
      cc.api.__state.notified.set(primera.key, "siembra");
      cc.api.maybeNotify(primera);
      t.cierto(!!cc.env.storage.getItem("vgl_n_full|cita1|VERDE"), "la primera llegada del paciente avisa");
      const segunda = citaDe("cita2");
      cc.api.__state.notified.set(segunda.key, "siembra");
      cc.api.maybeNotify(segunda);
      t.falso(!!cc.env.storage.getItem("vgl_n_full|cita2|VERDE"),
        "una segunda leyenda VERDE del MISMO paciente en el día ya no vuelve a sonar");

      const c = cargar({ silencioso: true });
      t.cierto(c.api._legendMarcaUnaVez("111111", "VERDE"), "primera llegada del paciente A: pasa");
      t.falso(c.api._legendMarcaUnaVez("111111", "VERDE"), "la segunda NO: no se repite la misma leyenda");
      t.cierto(c.api._legendMarcaUnaVez("111111", "MORADO"), "pero otra leyenda del mismo paciente tiene su propio cupo");
      t.cierto(c.api._legendMarcaUnaVez("111111", "cierre"), "y el cierre de consulta, el suyo");
      t.cierto(c.api._legendMarcaUnaVez("222222", "VERDE"), "y otro paciente, el suyo");
      t.cierto(c.api._legendMarcaUnaVez("", "VERDE"), "sin cédula no se puede deduplicar: pasa, como siempre");
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

    // v17.6.52 — REPORTE EN VIVO (25-ago, captura): la MISMA inasistencia de las 6:00
    // volvió a notificar a las 9:03. El parpadeo API↔DOM saca la cita de ÁMBAR y la
    // vuelve a meter; state.notified solo recuerda el ÚLTIMO estado, así que la
    // re-entrada re-disparaba el aviso. La guarda nueva usa bumpStatCita («una cita, un
    // color, un conteo»): inasistencia/fraude ya contados = ya avisados, no se repiten.
    // El termómetro del disparo es la marca de crossTabDup ("vgl_n_full|<uid>"): TODO
    // canal de aviso pasa por ella y la escribe — si tras el parpadeo la marca NO se
    // reescribe, ningún canal volvió a sonar.
    t.caso("v17.6.52: la inasistencia (AMBAR) NO vuelve a avisar tras un parpadeo de estado — es un hecho terminal del día", () => {
      const c = cargar();
      c.api.__state.leader = true;
      const key = "123@06:00 AM";
      const marca = "vgl_n_full|" + key + "|AMBAR";
      const base = { hora_texto: "06:00 AM", doc_id: "123", nombre: "PRUEBA", estado: "Sin presentarse", key: key, elapsed: 10 };
      c.api.__state.notified.set(key, "SEMILLA");             // prev definido: no es la siembra silenciosa
      c.api.maybeNotify(Object.assign({}, base, { color: "AMBAR" }));
      t.cierto(!!c.env.storage.getItem(marca), "el PRIMER aviso de inasistencia sí sale (algún canal escribió su marca)");
      // El parpadeo: la cita "pasa" a otro estado y vuelve a AMBAR horas después.
      c.env.storage.removeItem(marca);                        // simula que pasaron horas (la marca de 12 s ya no está)
      c.api.maybeNotify(Object.assign({}, base, { color: "VERDE", estado: "En sala" }));  // sin arrival: solo mueve el estado interno
      c.api.maybeNotify(Object.assign({}, base, { color: "AMBAR", estado: "Sin presentarse" }));
      t.falso(!!c.env.storage.getItem(marca), "la SEGUNDA inasistencia de la misma cita NO dispara ningún canal: la marca no se reescribió");
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
      // v17.6.75 — NO puede ser /viva/Acceso/: esa ruta pasó a la lista de excepciones
      // silenciosas (ver el bloque de pruebas propio más abajo). Cualquier otra pantalla
      // fuera del módulo clínico sigue con el invariante v14.1.5 intacto.
      c.env.doc.visibilityState = "hidden";
      c.env.win.location.pathname = "/viva/OtraPantalla/";
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

    // v17.6.75 — REPORTE EN VIVO (26-ago): el médico pidió, nombrando las tres rutas
    // exactas, que el aviso NO le suene ahí — a diferencia del resto de Everest, donde
    // v14.1.5 sigue mandando (prueba anterior). El hecho se sigue contando y el cartel
    // sigue esperando en cola para cuando vuelva a una pantalla clínica real.
    t.caso("v17.6.75: en las tres pantallas que el médico nombró, el aviso NO suena — pero el hecho se cuenta y el cartel queda en cola", () => {
      const c = cargar();
      c.env.doc.visibilityState = "hidden";
      let notifCount = 0;
      c.env.win.Notification = class { constructor() { notifCount++; } };
      c.env.win.Notification.permission = "granted";
      const rutas = ["/viva/Acceso/", "/viva/EverHealth/OrdenamientoHealth", "/viva/EverHealth/"];
      rutas.forEach((ruta, i) => {
        c.env.win.location.pathname = ruta;
        const base = { hora_texto: "08:0" + i + " AM", doc_id: "d" + i, key: "d" + i + "@08:0" + i + " AM", nombre: "PRUEBA", elapsed: 1, reason: "" };
        c.api.maybeNotify({ ...base, estado: "Sin presentarse", color: "AZUL", arrival: false });
        c.api.maybeNotify({ ...base, estado: "En sala", color: "VERDE", arrival: true });
      });
      t.igual(notifCount, 0, "ni una sola notificación de Windows en ninguna de las tres rutas nombradas");
      t.igual(atiempoHoy(c), 3, "pero el hecho SÍ se cuenta en la auditoría — las tres llegadas quedan registradas");
      const cola = JSON.parse(c.env.almacen["vgl_avisos_pendientes"] || "[]");
      t.igual(cola.length, 3, "y el cartel de cada una queda en cola, esperando una pantalla clínica real donde pintarse");
    });

    t.caso("_flushAvisosPendientes: al volver a HCHealth, el aviso en cola SÍ se dispara — una sola vez entre pestañas", () => {
      const c = cargar();
      // v15.4.0 — un aviso = un canal: la notificación del SISTEMA solo sale con la
      // pestaña oculta (visible, el canal es el toast). La intención original de esta
      // prueba se conserva; solo se simula la pestaña oculta para seguir contándola.
      // v17.6.75 — misma nota que la prueba anterior: /viva/Acceso/ ya no suena.
      c.env.doc.visibilityState = "hidden";
      c.env.win.location.pathname = "/viva/OtraPantalla/";
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
    // v17.x.x — control de acceso por médico en la sección de labs del aviso universal.
    // Los casos que ejercitan el comportamiento de "labs" (vencidos/al día/parcial) fijan
    // un médico AUTORIZADO, que es la ruta "normal" que sigue vigente. El gating para no
    // autorizados se prueba aparte.
    const AUTHORIZED = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
    function autorizar(c) { c.api.__state.activeDoctor = AUTHORIZED; }
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

    // v17.6.18 — REPORTE DE CAMPO (24-ago-2026): "los botones para ordenar laboratorios
    // y agendar cita... no les veo utilidad — elimínalos". La v17.6.3 (B2) los había
    // convertido en botones accionables; se revierte a SOLO informativo — el aviso al
    // abrir la historia es un recordatorio, no un atajo de flujo.
    t.caso("avisoUniversal: los chips son informativos (spans), sin botones de acción (v17.6.18)", () => {
      const c = cargar({ silencioso: true });
      c.api.avisoUniversal("Paciente Prueba", {
        pym: ["Tamización VIH"],
        labs: [{ nombre: "Creatinina en Suero" }],
        apt: { doc_id: "111", nombre: "Paciente Prueba" },
      }, true);
      const m = c.env.doc.getElementById("vgl-pym-modal");
      t.falso(m.innerHTML.indexOf("data-aviso-accion") >= 0, "ningún chip lleva acción");
      t.falso(m.innerHTML.indexOf("📅 Agendar control") >= 0, "el botón «Agendar control» ya no existe");
      t.falso(m.innerHTML.indexOf("📋 Ordenar paraclínicos") >= 0, "el botón «Ordenar paraclínicos» ya no existe");
      t.cierto(m.innerHTML.indexOf("Tamización VIH") >= 0, "el pendiente se sigue informando");
      t.cierto(m.innerHTML.indexOf("Creatinina en Suero") >= 0, "el laboratorio vencido se sigue informando");
      t.cierto(m.innerHTML.indexOf("Entendido") >= 0, "solo queda «Entendido» para cerrar");
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
      autorizar(c);
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
      autorizar(c);
      mockPacienteAbierto(c, DOC_LABSV);
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-11T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-11T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      await c.api.autoFetchAtheneaLabsForActivePatient();
      c.api.checkAvisoUniversal();
      t.falso(c.api.avisoYaVisto("avisouniv|" + c.api.normalizeKey(DOC_LABSV)), "nada pendiente -> ningún aviso");
    });

    await t.casoAsync("checkAvisoUniversal: si ya hay un aviso en pantalla, se pospone y sale al siguiente tick", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsVencidos("2025-01-01") });
      autorizar(c);
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
      autorizar(c);
      mockPacienteAbierto(c, DOC_LABSV);
      await c.api.autoFetchAtheneaLabsForActivePatient();   // _labsPrefetch resuelto (7 faltantes)
      const uid = "avisouniv|" + c.api.normalizeKey(DOC_LABSV);
      t.falso(c.api.avisoYaVisto(uid), "todavía no se ha revisado");
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid), "labs vencidos -> aviso único, marcado una vez por paciente");
      t.noLanza(() => c.api.checkAvisoUniversal(), "un segundo tick no repite ni revienta");
    });

    // v17.x.x — REFACTOR S+ (30-ago): control de acceso por médico en la sección de labs
    // RCV del aviso universal. Solo los autorizados la ven "normal" (con 50 % por fuera de
    // meta); los no autorizados la ven SOLO si el paciente está en un programa de Ruta
    // Crónicos, juzgando vencidos con la vigencia original (tabla por estadio, sin 50 %).
    await t.casoAsync("checkAvisoUniversal: médico NO autorizado sin programa de Ruta Crónicos no ve la sección de labs RCV", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsCero() });
      // Sin autorizar(): el médico activo es no autorizado (o aún no detectado).
      mockPacienteAbierto(c, DOC_LABSV);
      await c.api.autoFetchAtheneaLabsForActivePatient();   // 0 labs -> 7 analitos RCV faltantes
      const uid = "avisouniv|" + c.api.normalizeKey(DOC_LABSV);
      c.api.checkAvisoUniversal();
      t.falso(c.api.avisoYaVisto(uid),
        "sin programa de crónicos detectado, la sección de labs se silencia para el no autorizado (no hay aviso de labs)");
    });

    await t.casoAsync("checkAvisoUniversal: médico NO autorizado SÍ ve labs RCV vencidos si el paciente está en Ruta Crónicos", async () => {
      const c = cargar({ silencioso: true, gmxhr: planLabsCero() });
      mockPacienteAbierto(c, DOC_LABSV);
      await c.api.autoFetchAtheneaLabsForActivePatient();   // 0 labs -> 7 analitos RCV faltantes
      // Siembra un resumen con programa rector: el paciente está en Ruta Crónicos (HTA).
      c.api.mtrCacheResumenGuardar(DOC_LABSV, { programa: "HTA", erc: {}, factores: {}, riesgo: {} });
      const uid = "avisouniv|" + c.api.normalizeKey(DOC_LABSV);
      c.api.checkAvisoUniversal();
      t.cierto(c.api.avisoYaVisto(uid),
        "en Ruta Crónicos con labs vencidos (vigencia original, sin 50 %), la sección aparece y el aviso dispara");
      // mockPacienteAbierto deja getElementById devolviendo null para todo salvo
      // #anamesis, así que se busca el modal entre los hijos del body.
      const m = c.env.doc.body.children.find((n) => n.id === "vgl-pym-modal");
      t.cierto(!!m && /Priorice riesgo cardiovascular/.test(m.innerHTML || ""),
        "el no autorizado ve el mensaje de prioridad cardiovascular, no la lista cruda");
      t.falso(!!m && /Laboratorios RCV sin resultado vigente/.test(m.innerHTML || ""),
        "y NO ve el encabezado de la lista de analitos (eso es solo del autorizado)");
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
      t.cierto(/Resultados de laboratorio encontrados/.test(avisos[0].title), "es el aviso correcto");

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


    // ===== INJERTADO EN LA FUSIÓN main<-rama (v18.0.6): casos que solo
    // existían en la rama de trabajo y que main había perdido. =====
    t.caso("v17.17.0: la pestaña líder NO origina fraudWatch en la ventana de gracia tras un relevo por visibilidad, pero deja constancia", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:10:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      c.api._setUltimoRelevoParaTest(Date.now());   // "acabo de tomar el mando por relevo"

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "AMBAR", "el color se sigue calculando igual — es la ORIGINACIÓN de la marca lo que se difiere");
      t.falso(c.api.__state.fraudWatch.has(r.key), "no se origina fraude con el primer vistazo tras el relevo");
      const evs = c.api.eventsOf(c.api.todayStamp());
      t.cierto(evs.some((e) => e.ev === "LECTURA_TRAS_RELEVO_SIN_CONFIRMAR" && e.doc === "123"), "la lectura sospechosa queda igual en la bitácora — la evidencia no se pierde, solo se pospone");
    });

    t.caso("v17.17.0: pasada la ventana de gracia, la misma pestaña líder SÍ origina fraudWatch con normalidad", () => {
      const c = cargar();
      const refDate = new Date("2026-08-10T08:10:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      c.api._setUltimoRelevoParaTest(Date.now() - 9000);   // relevo hace 9s, ya pasó la gracia de 8s

      const r = c.api.colorAndAlert(a, refDate);
      t.igual(r.color, "AMBAR");
      t.cierto(c.api.__state.fraudWatch.has(r.key), "pasada la gracia, origina igual que siempre — el arreglo no debilita la detección real");
    });

    t.caso("v17.17.0: sin relevo de por medio (sesión normal, una sola pestaña) la gracia nunca aplica", () => {
      const c = cargar();
      t.igual(c.api._getUltimoRelevoParaTest(), 0, "una sesión que nunca vio un latido ajeno nunca tocó este reloj");
      const refDate = new Date("2026-08-10T08:10:00").getTime();
      const a = { hora_texto: "08:00 AM", estado: "Sin presentarse", nombre: "JUAN", index: 1, doc_id: "123" };
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;

      const r = c.api.colorAndAlert(a, refDate);
      t.cierto(c.api.__state.fraudWatch.has(r.key), "el arranque normal de una sola pestaña (v17.6.74/suite_32) sigue originando de inmediato");
    });

    await t.casoAsync("v17.17.0: reproducción de dos pestañas — la líder ascendida por relevo no acusa de fraude a quien otra pestaña ya confirmó a tiempo", async () => {
      // Reproduce el reporte real: A (visible) confirma "En Sala" a tiempo; B, en
      // segundo plano, toma el mando por relevo de visibilidad con una copia estancada
      // ("Sin presentarse") y, SIN el arreglo, la marcaría como fraude.
      const A = cargar({ silencioso: true });
      const cita = { hora_texto: "08:00 AM", doc_id: "999", nombre: "PACIENTE", index: 0 };
      const t1 = new Date("2026-08-10T08:03:00").getTime();
      A.api.__state.leader = true;
      A.api.colorAndAlert({ ...cita, estado: "Sin presentarse" }, t1);   // esNueva, candidato
      const t2 = new Date("2026-08-10T08:03:10").getTime();
      A.api.colorAndAlert({ ...cita, estado: "En sala" }, t2);            // primera vez "En sala": debounce, aún AZUL
      const t2b = new Date("2026-08-10T08:03:20").getTime();
      const rA = A.api.colorAndAlert({ ...cita, estado: "En sala" }, t2b); // segunda vez seguida: se confirma
      t.igual(rA.color, "VERDE", "A confirma la llegada a tiempo");

      const B = cargar({ almacen: A.env.almacen, storage: A.env.storage, silencioso: true });
      B.api.__state.leader = true;
      B.api._setUltimoRelevoParaTest(Date.now());   // B acaba de tomar el mando por relevo
      const t3 = new Date("2026-08-10T08:10:00").getTime();   // 10 min reales desde la cita
      const rB = B.api.colorAndAlert({ ...cita, estado: "Sin presentarse" }, t3);   // copia estancada de B
      t.falso(B.api.__state.fraudWatch.has(rB.key), "B no origina fraude con su primer vistazo tras el relevo");

      const t4 = new Date("2026-08-10T08:10:05").getTime();
      B.api.colorAndAlert({ ...cita, estado: "En sala" }, t4);            // primera vez "En sala" para B: debounce
      const t4b = new Date("2026-08-10T08:10:15").getTime();
      const rB2 = B.api.colorAndAlert({ ...cita, estado: "En sala" }, t4b); // segunda vez seguida: se confirma
      t.igual(rB2.color, "VERDE", "y cuando B por fin ve 'En Sala', pinta VERDE — nunca ROJO para quien ya llegó a tiempo");
      t.falso(rB2.sound, "sin FRAUDE_EXTEMPORANEO para una llegada que ya se había confirmado puntual");
    });

    t.caso("v17.48.0 — el respaldo por DOM entrega la misma cédula canónica que el API", () => {
      const c = cargar({ silencioso: true });
      const el = (txt, extra) => Object.assign({ textContent: txt, closest: () => null, querySelector: () => null }, extra || {});
      const tarjeta = {
        querySelector: (sel) => (sel === ".status-label" ? el("PENDIENTE") : (sel === ".fw-bold.mb-0" ? el("Presencial") : null)),
      };
      tarjeta.querySelector = ((orig) => (sel) => {
        if (sel === ".status-label") return el("PENDIENTE");
        if (sel === ".text-muted") return el("C.C. 0005150076");
        if (sel === ".text-uppercase.fw-bold") return el("PACIENTE DE PRUEBA");
        if (sel === ".fw-bold.mb-0") return el("Presencial");
        return null;
      })();
      const hora = el("7:00 a. m.", { closest: (sel) => (sel === ".card-body" ? tarjeta : null) });
      const docFalso = { querySelectorAll: (sel) => (sel === ".labelHora" ? [hora] : []) };
      const r = c.api.extractAgenda(docFalso);
      t.cierto(r.visible, "la agenda debe verse");
      t.igual(r.citas[0].doc_id, "5150076", "una sola clave por paciente, también por el camino lento");
    });

    t.caso("v17.48.0 — la cédula de la historia abierta sale canónica, sin ceros de relleno", () => {
      const c = cargar({ silencioso: true });
      mockPacienteAbierto(c, "0005150076");
      t.igual(c.api.extractPacienteAbierto(), "5150076", "una sola clave por paciente");
      mockPacienteAbierto(c, "8396613");
      t.igual(c.api.extractPacienteAbierto(), "8396613", "la que ya venía limpia no cambia");
    });

    // v18.0.9 — AQUÍ VIVÍA LA HEURÍSTICA DEL CONSULTORIO, Y SE RETIRA ENTERA.
    //
    // La v18.0.7 añadió: «si el médico abrió hoy la historia de ese paciente, calla el aviso
    // ÁMBAR». Nació de un reporte real (avisos de pacientes ya atendidos) pero atacaba el
    // síntoma. La v18.0.8 encontró la causa de verdad —el antirrebote resucitaba un estado
    // de 45 minutos antes— y la arregló, así que esta heurística dejó de tener trabajo.
    //
    // Y tenía un filo que el propio médico señaló al dar el criterio bueno: «o vino o no
    // vino». Abrir una historia NO prueba que el paciente viniera: si la abre para revisar
    // un dato de alguien que al final no se presentó, esa inasistencia REAL quedaba
    // silenciada y sin contar. Cambiar un falso positivo por un falso negativo, en el CSV
    // con el que reclama, es peor negocio. Se retira a petición suya (31-ago).
    //
    // Lo que SÍ protege el aviso falso sigue vivo y probado más abajo: el antirrebote con
    // ventana (v18.0.8) y la rectificación retroactiva de una inasistencia ya contada.
    // v18.0.8 — CORRECCIÓN DEL MÉDICO, y es una corrección de fondo. La v18.0.7 callaba la
    // interrupción pero SEGUÍA contando la inasistencia «para no perder evidencia». Él lo
    // desmontó en una frase: «no puede ser inasistencia porque el paciente sí llegó a tiempo
    // y se atendió normalmente». Una fila INASISTENCIA sobre un paciente que vino no es
    // evidencia: es una evidencia FALSA, y ensucia justo el CSV con el que reclama. La
    // prueba de abajo afirmaba lo contrario y por eso se reescribe entera.
    // =====================================================================
    //  v18.0.8 — EL ANTIRREBOTE NO PUEDE RESUCITAR UN ESTADO VIEJO
    //
    //  Esta es LA causa del reporte del 31-ago, reproducida con el arnés antes de tocar
    //  nada: a las 10:20:44 la agenda decía «Atendido» y colorAndAlert devolvía «Sin
    //  presentarse», AMBAR y elapsed 20,7 — la cifra literal de la captura del médico.
    //
    //  El antirrebote de v17.6.21 existe para absorber un parpadeo entre dos fuentes (API y
    //  DOM) que discrepan en el MISMO instante: exige ver la lectura nueva dos veces
    //  seguidas. Correcto cuando las dos lecturas están separadas por un tick (~5 s).
    //  Después de un apagón de 45 minutos, la lectura «anterior» no es un competidor: es un
    //  recuerdo — y el antirrebote lo imponía igual, calculando el desfase contra la hora
    //  actual. Resultado: ÁMBAR falso, elapsed inflado, sobre un paciente ya atendido.
    //
    //  Las dos mitades importan y las dos se prueban: la lectura fresca manda tras un hueco
    //  largo, Y el parpadeo real de 5 s se sigue absorbiendo como siempre.
    // =====================================================================
    t.caso("v18.0.8: tras un apagón largo, la lectura FRESCA manda (el caso exacto del 31-ago)", () => {
      const c = cargar();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (estado) => ({ hora_texto: "10:00 AM", estado, nombre: "P", index: 1, doc_id: "5150076" });
      // 10:03 — la agenda dice «Sin presentarse» y queda confirmado.
      c.api.colorAndAlert(cita("Sin presentarse"), new Date("2026-08-31T10:03:00").getTime());
      // ...45 minutos sin un solo tick (líder ciego, API caído)...
      // 10:20:44 — la agenda YA dice «Atendido». Primera lectura tras el apagón.
      const r = c.api.colorAndAlert(cita("Atendido"), new Date("2026-08-31T10:20:44").getTime());
      t.igual(r.estado, "Atendido", "se evalúa con lo que Everest dice AHORA, no con lo que se recordaba");
      t.falso(r.color === "AMBAR", "y por tanto NO sale el ámbar falso de «venció el tiempo de confirmación»");
    });

    t.caso("v18.0.8: el parpadeo REAL de un tick sigue absorbido — no se desarma v17.6.21", () => {
      const c = cargar();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (estado) => ({ hora_texto: "10:00 AM", estado, nombre: "P", index: 1, doc_id: "5150076" });
      const t0 = new Date("2026-08-31T10:03:00").getTime();
      c.api.colorAndAlert(cita("Sin presentarse"), t0);
      const p = c.api.colorAndAlert(cita("Atendido"), t0 + 5000);   // 5 s después: un tick
      t.igual(p.estado, "Sin presentarse",
        "una lectura discrepante a 5 s sigue esperando confirmación: es justo el parpadeo API↔DOM que v17.6.21 absorbe");
      const q = c.api.colorAndAlert(cita("Atendido"), t0 + 10000);  // segunda vez seguida
      t.igual(q.estado, "Atendido", "y a la segunda lectura igual, se acepta — el mecanismo queda intacto");
    });

    t.caso("v18.0.8: una inasistencia ya contada se RECTIFICA al ver al paciente en sala o atendido", () => {
      const c = cargar();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (estado) => ({ hora_texto: "08:00 AM", estado, nombre: "P", index: 1, doc_id: "5150076" });
      const cuenta = () => { const a = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}"); return (a[c.api.todayStamp()] || {}).inasistencia || 0; };
      // Se cuenta una inasistencia (el camino normal).
      const r = c.api.colorAndAlert(cita("Sin presentarse"), new Date("2026-08-10T08:10:00").getTime());
      t.igual(r.color, "AMBAR");
      c.api.__state.notified.set(r.key, "siembra");
      c.api.maybeNotify(r);
      t.igual(cuenta(), 1, "queda contada (control del caso)");
      // Más tarde, la agenda dice que el paciente sí estaba: aquella inasistencia no ocurrió.
      c.api.colorAndAlert(cita("Atendido"), new Date("2026-08-10T09:30:00").getTime());
      t.igual(cuenta(), 0, "se descuenta: o vino o no vino, y vino");
      c.api.evFlush();
      const filas = JSON.parse(c.env.storage.getItem(c.api.evKey(c.api.todayStamp())) || "[]");
      t.cierto(filas.some((x) => x && x.ev === "RECTIFICACION_INASISTENCIA"),
        "y queda constancia de la rectificación");
      t.cierto(filas.some((x) => x && x.ev === "INASISTENCIA"),
        "sin borrar la fila original: se añade el porqué, no se reescribe la historia");
    });

    // v18.0.17 — SOLO EL LÍDER RECTIFICA. El bloque de rectificación de v18.0.8 vivía 112
    // líneas ANTES del `if (!state.leader) … return`, así que lo corrían TODAS las pestañas.
    // Y desde v18.0.4 `_fraudeCompartidoFusionar` copia `contadas` a las no líderes, con lo
    // que todas llegaban con la marca puesta: con tres pestañas el contador bajaba 3→0 en
    // vez de 3→2, y se escribían tres filas por un único hecho. Una inasistencia falsa
    // borraba dos verdaderas — y son los números con los que el médico reclama.
    t.caso("v18.0.17: una pestaña NO líder no descuenta la inasistencia (el contador es del líder)", () => {
      const c = cargar();
      c.api.__state.leader = true;
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (estado) => ({ hora_texto: "08:00 AM", estado, nombre: "P", index: 1, doc_id: "5150076" });
      const cuenta = () => { const a = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}"); return (a[c.api.todayStamp()] || {}).inasistencia || 0; };

      const r = c.api.colorAndAlert(cita("Sin presentarse"), new Date("2026-08-10T08:10:00").getTime());
      c.api.__state.notified.set(r.key, "siembra");
      c.api.maybeNotify(r);
      t.igual(cuenta(), 1, "una inasistencia contada por el líder (control del caso)");

      // Ahora esta pestaña PIERDE el liderazgo — es la situación real de la segunda ventana,
      // que sigue raspando la agenda y sigue teniendo la marca por la fusión compartida.
      c.api.__state.leader = false;
      c.api.colorAndAlert(cita("Atendido"), new Date("2026-08-10T09:30:00").getTime());
      t.igual(cuenta(), 1, "la pestaña no líder NO descuenta: quien no cuenta, tampoco descuenta");
      t.cierto(c.api.__state.contadas.has("inasistencia@" + r.key),
        "y sobre todo NO borra la marca: si la borrara y la compartiera, el líder ya no podría rectificar nunca");

      // Y cuando vuelve a ser líder (relevo normal), la rectificación sí ocurre.
      c.api.__state.leader = true;
      c.api.colorAndAlert(cita("Atendido"), new Date("2026-08-10T09:31:00").getTime());
      t.igual(cuenta(), 0, "recuperado el liderazgo, la rectificación se hace UNA vez");
    });

    t.caso("v18.0.17: con dos pestañas, el hecho se rectifica UNA sola vez, no una por pestaña", () => {
      const c = cargar();
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (estado) => ({ hora_texto: "08:00 AM", estado, nombre: "P", index: 1, doc_id: "5150076" });
      const cuenta = () => { const a = JSON.parse(c.env.storage.getItem("vgl_stats") || "{}"); return (a[c.api.todayStamp()] || {}).inasistencia || 0; };

      // Tres inasistencias reales del día.
      c.api.__state.leader = true;
      for (const h of ["08:00 AM", "08:20 AM", "08:40 AM"]) {
        const a = { hora_texto: h, estado: "Sin presentarse", nombre: "P", index: 1, doc_id: "5150076" };
        const r = c.api.colorAndAlert(a, new Date("2026-08-10T09:00:00").getTime());
        c.api.__state.notified.set(r.key, "siembra");
        c.api.maybeNotify(r);
      }
      t.igual(cuenta(), 3, "tres inasistencias contadas (control del caso)");

      // Una de ellas resulta falsa. La ve el líder... y también la ven las otras dos
      // pestañas, que ejecutan colorAndAlert igual porque el raspado no depende del mando.
      c.api.colorAndAlert(cita("Atendido"), new Date("2026-08-10T09:30:00").getTime());
      c.api.__state.leader = false;
      c.api.colorAndAlert(cita("Atendido"), new Date("2026-08-10T09:31:00").getTime());
      c.api.colorAndAlert(cita("Atendido"), new Date("2026-08-10T09:32:00").getTime());
      t.igual(cuenta(), 2, "3 → 2, no 3 → 0: un hecho, un descuento");

      c.api.evFlush();
      const filas = JSON.parse(c.env.storage.getItem(c.api.evKey(c.api.todayStamp())) || "[]");
      const rect = filas.filter((x) => x && x.ev === "RECTIFICACION_INASISTENCIA");
      t.igual(rect.length, 1, "y una sola fila en la bitácora, no una por pestaña");
    });


    // v18.0.20+ — «1h60» ES UNA HORA QUE NO EXISTE, y salía media hora de cada hora.
    // `elapsed` viene redondeado a un decimal, así que 119,7 min pasados daban
    // Math.floor(119,7/60)=1 y Math.round(119,7 % 60)=Math.round(59,7)=60: la tarjeta decía
    // «hace 1h60» y el title «Lleva 1h60 pasado de la tolerancia», en vez de «hace 2h00».
    // Pasaba siempre que los minutos caían en [59,5 ; 60), en cualquier tarjeta con la
    // cuenta a la vista, y también del lado positivo («en 1h60»). Se redondea UNA vez, al
    // total, y se reparte después: el acarreo a la hora siguiente ya no puede perderse.
    t.caso("v18.0.20+: la cuenta regresiva nunca imprime «h60» — el acarreo sube a la hora", () => {
      const c = cargar({ silencioso: true });
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (elapsed) => ({ estado: "Sin presentarse", hora_texto: "08:00 AM", elapsed });

      t.igual(c.api.countdownParts(cita(125.7)).text, "hace 2h00",
        "119,7 min pasados son dos horas, no «1h60»");
      t.igual(c.api.countdownParts(cita(125.9)).text, "hace 2h00", "y 119,9 también");
      t.igual(c.api.countdownParts(cita(125.7)).title, "Lleva 2h00 pasado de la tolerancia",
        "el title se arma con la misma cadena: si uno estaba mal, los dos lo estaban");
    });

    t.caso("v18.0.20+: y el resto de la cuenta no cambió", () => {
      const c = cargar({ silencioso: true });
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (elapsed) => ({ estado: "Sin presentarse", hora_texto: "08:00 AM", elapsed });
      t.igual(c.api.countdownParts(cita(66)).text, "hace 1h00", "la hora en punto");
      t.igual(c.api.countdownParts(cita(185.4)).text, "hace 2h59", "y los minutos sueltos");
      t.igual(c.api.countdownParts(cita(65.5)).text, "hace 59:30",
        "por debajo de la hora sigue el formato mm:ss, con sus segundos");
      t.igual(c.api.countdownParts({ estado: "En Sala", hora_texto: "08:00 AM", elapsed: 90 }), null,
        "y un paciente ya en sala sigue sin cuenta regresiva");
    });

    // v18.0.20+ — SOLO EL LÍDER CONSUME LA MARCA DE UN SOLO DISPARO DEL FRAUDE.
    // `alertedFraud` gobierna `if (sound) { logEvent(FRAUDE_EXTEMPORANEO); reportarFraude() }`:
    // se dispara UNA vez por cita. Pero colorAndAlert corre en TODA pestaña que lea la
    // agenda, y desde la v18.0.4 las no líderes fusionan `fraudWatch` del almacén
    // compartido — así que una pestaña no líder llegaba a marcar y COMPARTIR la marca. Su
    // `sound` se descarta, pero la marca quedaba puesta para todos: cuando el líder
    // evaluaba la misma cita la veía consumida, y no escribía la fila de auditoría ni
    // reportaba el fraude. La evidencia de una reclamación desaparecía por tener una
    // segunda ventana abierta. Misma familia que v18.0.13 y v18.0.17: quien no avisa, no
    // consume.
    t.caso("v18.0.20+: una pestaña NO líder no consume la marca de fraude del líder", () => {
      const c = cargar({ silencioso: true });
      c.api.__CONFIG.TOLERANCIA_MIN = 6;
      const cita = (estado) => ({ hora_texto: "10:00 AM", estado, nombre: "P", index: 1, doc_id: "5150076" });
      const t0 = new Date("2026-08-10T10:20:00").getTime();

      // Se arma la vigilancia de fraude con el líder: «sin presentarse» pasada la tolerancia.
      c.api.__state.leader = true;
      c.api.colorAndAlert(cita("Sin presentarse"), t0);

      // Ahora esta pestaña pierde el mando y ve «En Sala» dos veces (el antirrebote de
      // v17.6.21 exige confirmarlo con una segunda lectura).
      c.api.__state.leader = false;
      c.api.colorAndAlert(cita("En Sala"), t0 + 60000);
      const r = c.api.colorAndAlert(cita("En Sala"), t0 + 120000);
      t.igual(r.color, "ROJO", "la no líder sí pinta el rojo: eso es lectura, no aviso");
      t.falso(c.api.__state.alertedFraud.size > 0,
        "pero NO consume la marca de un solo disparo — si la consume, el líder ya no escribe la fila de auditoría ni reporta el fraude");

      // Y cuando el líder la ve, sí la consume y sí suena.
      c.api.__state.leader = true;
      const q = c.api.colorAndAlert(cita("En Sala"), t0 + 180000);
      t.igual(q.color, "ROJO");
      t.cierto(q.sound === true, "el líder sí dispara el aviso");
      t.cierto(c.api.__state.alertedFraud.size > 0, "y ahora sí queda marcada, una sola vez");
    });


    // =====================================================================
    // v18.0.22 — LA REGLA DE LA FAMILIA, no otro parche suelto
    //
    // Cuatro veces en una sola jornada apareció el MISMO defecto, con cuatro caras:
    //   · v18.0.13 — la fila del fraude se escribía sin contarse;
    //   · v18.0.17 — la rectificación de inasistencias descontaba una vez POR PESTAÑA;
    //   · v18.0.21 — una pestaña no líder consumía la marca de un solo disparo del fraude;
    //   · v18.0.22 — el registro del HUECO DE LECTURA, escrito por mí ese mismo día, con
    //     exactamente el mismo agujero.
    //
    // El patrón, una vez visto, es siempre el mismo: `colorAndAlert` corre en TODA pestaña
    // que lea la agenda (render la llama con .map, sin mirar el liderazgo) y su
    // `if (!state.leader) … return` está al FINAL. Todo efecto de UNA SOLA VEZ escrito
    // antes de esa línea lo ejecutan todas las ventanas: se duplican filas de auditoría, se
    // descuentan contadores de más, y se consumen marcas que el líder ya no vuelve a ver.
    //
    // Arreglar el cuarto caso y seguir no sirve de nada: el quinto se escribirá igual. Esta
    // prueba fija la REGLA — dentro de colorAndAlert, y antes de la guarda de líder, todo
    // efecto secundario tiene que estar gobernado por `state.leader`. Es una regresión de
    // código fuente a propósito: lo que hay que vigilar es una propiedad estructural de la
    // función, no una conducta concreta que ya tiene sus cuatro pruebas arriba.
    // =====================================================================
    t.caso("v18.0.22: en colorAndAlert, ningún efecto de una sola vez corre sin ser líder", () => {
      const fs = require("fs");
      const path = require("path");
      const lineas = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8").split("\n");

      const ini = lineas.findIndex((l) => l.includes("function colorAndAlert"));
      t.cierto(ini > 0, "se localiza colorAndAlert");
      let fin = -1;
      for (let i = ini + 1; i < lineas.length; i++) {
        if (/^\s*if \(!state\.leader\)/.test(lineas[i])) { fin = i; break; }
      }
      t.cierto(fin > ini, "y su guarda de liderazgo, que es la frontera de esta regla");

      // Lo que cuenta como "efecto de una sola vez": marcar, compartir entre pestañas,
      // registrar en la bitácora, mover un contador del día o reportar al tablero.
      const EFECTOS = /_apptMarcar\(|_fraudeCompartidoGuardar\(|logEvent\(|bumpStatCita\(|rectificarStat\(|_noShowRegistrar\(|reportarFraude\(|state\.contadas\.(?:add|delete)\(/;

      const desprotegidos = [];
      let protegidos = 0;
      for (let i = ini; i < fin; i++) {
        const l = lineas[i];
        if (/^\s*\/\//.test(l) || !EFECTOS.test(l)) continue;
        // ¿Hay un `state.leader` gobernando este efecto? Se mira el bloque inmediato hacia
        // atrás; una guarda más lejana que 25 líneas ya no gobierna nada de forma legible.
        //
        // Y SE MIRA SOLO EL CÓDIGO, NO LOS COMENTARIOS. La primera versión de esta regla
        // era HUECA y lo destapó su propia mutación: los comentarios que explican el
        // arreglo contienen la cadena «state.leader», así que el contexto la encontraba
        // siempre y la comprobación pasaba aunque se quitara la guarda de verdad. Es
        // exactamente el defecto que esta regla existe para cazar, cometido dentro de la
        // regla misma.
        const ctx = lineas.slice(Math.max(ini, i - 25), i + 1)
          .filter((x) => !/^\s*\/\//.test(x))
          .map((x) => x.replace(/\/\/.*$/, ""))
          .join("\n");
        if (ctx.includes("state.leader")) protegidos++;
        else desprotegidos.push(`L${i + 1}: ${l.trim().slice(0, 90)}`);
      }

      t.cierto(protegidos >= 8,
        `la regla tiene que estar mirando algo real: se esperaban al menos 8 efectos gobernados por state.leader, se hallaron ${protegidos}`);
      t.igual(desprotegidos.length, 0,
        `todo efecto de una sola vez dentro de colorAndAlert, antes de la guarda de líder, debe estar bajo state.leader — si no, lo ejecuta cada ventana abierta y se duplican filas, contadores y marcas. Sin proteger: ${desprotegidos.join(" | ")}`);
    });


    // =====================================================================
    // v18.0.24 — EL REPINTADO BARATO NO ERA BARATO, Y ADEMÁS SE COMÍA UN AVISO
    //
    // `refrescarCuentas` es el camino RÁPIDO del repintado: el que corre en cada vuelta del
    // reloj cuando la agenda no cambió (`if (sig === state.lastSignature) { refrescarCuentas
    // (vista); return; }`). Traía dos defectos.
    //
    // (a) COSTE. Llamaba `_noShowPrevia(a.doc_id)` una vez POR TARJETA, y esa función hace
    //     localStorage.getItem + JSON.parse del historial ENTERO más un _vglBuscarPorDoc que,
    //     en el caso de fallo —el paciente sin inasistencias previas, o sea casi todos—,
    //     recorre el mapa completo cédula a cédula. Con 30 tarjetas: 30 lecturas y 30 parses
    //     por vuelta, en el hilo de la interfaz. Y `vgl_nosh_hist` NO CADUCA NUNCA (lo dice
    //     su propio comentario), así que ese mapa crece sin techo con los meses: el coste
    //     por vuelta aumenta solo, sin que nadie lo toque.
    //
    // (b) COLISIÓN. El badge de inasistencias previas es `<span class="vgl-cd vgl-adh">` y
    //     vive en `.vgl-card-time-wrap`, que va ANTES que `.vgl-card-badges-wrap` en el
    //     árbol. Cuando la tarjeta se pintó SIN cuenta regresiva (faltaba más de hora y
    //     media para la cita) y luego entró en la ventana, `querySelector(".vgl-cd")`
    //     devolvía el BADGE: se le sobrescribían className, title y textContent con los de
    //     la cuenta —perdía su `.vgl-adh` y su aviso— y en la vuelta siguiente se creaba
    //     ADEMÁS una cuenta nueva. La tarjeta acababa con dos cuentas y el aviso de
    //     inasistencias convertido en un cronómetro congelado.
    // =====================================================================
    t.caso("v18.0.24: la cuenta de inasistencias previas se puede hacer sin volver a leer el disco", () => {
      const c = cargar({ silencioso: true });
      let lecturas = 0;
      const orig = c.env.storage.getItem.bind(c.env.storage);
      c.env.storage.getItem = (k) => { if (String(k).indexOf("nosh") >= 0) lecturas++; return orig(k); };

      const hist = { "5150076": { total: 3, ultima: "2026-08-01" } };
      t.igual(c.api._noShowPreviaEn(hist, "5150076"), 3, "la cuenta sale igual que siempre");
      t.igual(lecturas, 0, "y no toca el almacenamiento: el mapa se le entrega ya leído");
    });

    t.caso("v18.0.24: la de HOY sigue sin contarse (la tarjeta ya la pinta de ámbar)", () => {
      const c = cargar({ silencioso: true });
      const hoy = c.api.todayStamp();
      t.igual(c.api._noShowPreviaEn({ "5150076": { total: 3, ultima: hoy } }, "5150076"), 2,
        "si la última inasistencia es de hoy, se descuenta: no se avisa dos veces del mismo hecho");
      t.igual(c.api._noShowPreviaEn({ "5150076": { total: 1, ultima: hoy } }, "5150076"), 0,
        "y con una sola, de hoy, no queda ninguna previa que avisar");
      t.igual(c.api._noShowPreviaEn({}, "5150076"), 0, "sin historial, cero");
      t.igual(c.api._noShowPreviaEn({ "5150076": { total: 3 } }, ""), 0, "sin cédula, cero (no se adivina)");
    });

    t.caso("v18.0.24: el envoltorio de siempre sigue funcionando para los demás llamadores", () => {
      const c = cargar({ silencioso: true });
      t.noLanza(() => c.api._noShowPrevia("5150076"), "_noShowPrevia sigue existiendo y no lanza");
    });

    // Las dos comprobaciones de abajo miran SOLO CÓDIGO: los comentarios que explican el
    // arreglo citan los selectores literalmente, así que un barrido sobre el texto crudo los
    // encontraría siempre y pasaría aunque el código volviera atrás. Es exactamente el
    // tropiezo que ya tuvo la regla de familia de la v18.0.22, cometido dos veces el mismo
    // día — por eso el filtro se escribe una vez y se comparte.
    const soloCodigo = (txt) => txt.split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // Regresión de código fuente para las dos mitades que el DOM simulado del arnés no
    // puede ejercitar (su querySelector no entiende `:not()`, y la colisión solo se ve con
    // el árbol real de la tarjeta). Lo que hay que fijar aquí son dos cables.
    t.caso("v18.0.24: refrescarCuentas lee el historial UNA vez por vuelta, no una por tarjeta", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const ini = src.indexOf("function refrescarCuentas");
      t.cierto(ini > 0, "se localiza refrescarCuentas");
      const cuerpo = soloCodigo(src.slice(ini, src.indexOf("\n  function ", ini + 10)));

      const bucle = cuerpo.indexOf("for (let i = 0");
      t.cierto(bucle > 0, "y su bucle por tarjeta");
      t.cierto(cuerpo.slice(0, bucle).includes("_noShowLeer()"),
        "el historial se lee ANTES del bucle: una vez por vuelta");
      t.falso(cuerpo.slice(bucle).includes("_noShowPrevia("),
        "y dentro del bucle NO puede llamarse a _noShowPrevia, que vuelve a leer y parsear el historial entero por cada tarjeta");
      t.cierto(cuerpo.slice(bucle).includes("_noShowPreviaEn("),
        "dentro del bucle se usa la variante que recibe el mapa ya leído");
    });

    t.caso("v18.0.24: la cuenta y el badge de inasistencias no se confunden entre sí", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const ini = src.indexOf("function refrescarCuentas");
      const cuerpo = soloCodigo(src.slice(ini, src.indexOf("\n  function ", ini + 10)));

      t.cierto(/querySelector\("\.vgl-cd:not\(\.vgl-adh\)"\)/.test(cuerpo),
        "la cuenta se busca excluyendo el badge, que también lleva la clase .vgl-cd y va antes en el árbol");
      t.falso(/querySelector\("\.vgl-cd"\)/.test(cuerpo),
        "el selector a secas ya no puede quedar en el código: es el que devolvía el badge");
      t.cierto(cuerpo.includes("vgl-card-time-wrap"),
        "y la cuenta que falta se inserta en el mismo sitio donde la pinta render(), no en el envoltorio de los badges");
    });

    // =====================================================================
    // v18.0.79 — HALLAZGO DE ENJAMBRE #31. El `continue` de la línea de arriba (la que el
    // caso anterior ya fija en `if (!p) { if (cd) cd.remove(); continue; }`... salvo que ESE
    // `continue` también se saltaba el bloque de abajo, el ÚNICO que pinta el badge de
    // inasistencias previas — countdownParts() da null exactamente para «En sala»/«Atendido»,
    // así que el badge quedaba inalcanzable todo el tiempo que el médico tiene al paciente
    // delante. Mismo defecto en render(): su plantilla inicial nunca incluía el badge, solo
    // la cuenta regresiva — el badge dependía ENTERO de que refrescarCuentas() lo agregara
    // en una vuelta posterior, vuelta que el `continue` de arriba también le negaba.
    // No se puede reproducir con el DOM simulado del arnés (mismo límite que el caso
    // anterior: no entiende `:not()` ni el árbol real de la tarjeta), así que se fija por
    // inspección de fuente, mismo patrón que v18.0.24 ya estableció para esta función.
    // =====================================================================
    t.caso("REGRESIÓN — refrescarCuentas ya no se salta el badge de inasistencias cuando no hay cuenta regresiva (hallazgo #31)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const ini = src.indexOf("function refrescarCuentas");
      const cuerpo = soloCodigo(src.slice(ini, src.indexOf("\n  function ", ini + 10)));

      t.falso(/if \(!p\) \{ if \(cd\) cd\.remove\(\); continue; \}/.test(cuerpo),
        "el defecto original: el continue saltaba también el bloque de abajo");
      t.cierto(/if \(!p\) \{ if \(cd\) cd\.remove\(\); \}/.test(cuerpo),
        "sin cuenta regresiva se quita la cuenta, pero YA NO se corta el paso: sigue hasta el badge");
      // El bloque de adhN/adhEl debe seguir existiendo en el cuerpo, fuera de cualquier rama
      // que dependa de `p` — la comprobación de arriba ya descarta el `continue`; esta
      // confirma que el bloque en sí no desapareció en el arreglo.
      t.cierto(/const adhN = S\.adherencia \? _noShowPreviaEn\(histNoShow, a\.doc_id\) : 0;/.test(cuerpo),
        "el cálculo del badge sigue presente");
    });

    // 02-sep — CIERRE ADVERSARIAL (fila 34): el arreglo de v18.0.79 puso el badge en la
    // plantilla inicial llamando a _noShowPrevia(a.doc_id) por tarjeta — el mismo coste
    // (getItem + JSON.parse del historial entero, que no caduca) que v18.0.24 sacó de
    // refrescarCuentas. Misma regla, mismo patrón de comprobación: leer ANTES del bucle.
    t.caso("02-sep: render() lee el historial de inasistencias UNA vez por pintado, no una por tarjeta (fila 34)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const ini = src.indexOf("function render(list, source, at)");
      t.cierto(ini > 0, "se localiza render");
      const cuerpo = soloCodigo(src.slice(ini, src.indexOf("\n  function ", ini + 10)));
      const bucle = cuerpo.indexOf("for (const a of vista)");
      t.cierto(bucle > 0, "y su bucle por tarjeta");
      t.cierto(cuerpo.slice(0, bucle).includes("_noShowLeer()"), "el historial se lee ANTES del bucle: una vez por pintado");
      t.falso(cuerpo.slice(bucle).includes("_noShowPrevia("), "y dentro del bucle NO puede llamarse a _noShowPrevia, que vuelve a leer y parsear el historial por cada tarjeta");
      t.cierto(cuerpo.slice(bucle).includes("_noShowPreviaEn("), "se usa la variante que recibe el mapa ya leído");
    });

    t.caso("REGRESIÓN — render() también pinta el badge de inasistencias en el primer pintado, no solo refrescarCuentas() (hallazgo #31)", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const iniRender = src.indexOf("function render(list, source, at)");
      t.cierto(iniRender > 0, "se localiza render()");
      const cuerpoRender = src.slice(iniRender, src.indexOf("\n  function ", iniRender + 10));
      t.cierto(/\$\{countdown\(a\)\}/.test(cuerpoRender), "la cuenta regresiva sigue en la plantilla, como siempre");
      t.cierto(/_noShowPrevia\(a\.doc_id\)/.test(cuerpoRender),
        "y ahora la plantilla también consulta las inasistencias previas de ESTE paciente");
      t.cierto(/vgl-cd vgl-adh/.test(cuerpoRender.slice(cuerpoRender.indexOf("card.innerHTML"))),
        "con el mismo span y las mismas clases que refrescarCuentas() usa para el mismo badge");
    });

  }
};
