// =====================================================================
//  SUITE 107 — Latencia de detección de cupos nuevos (orden A/B, punto 4)
//  Mide la ventana entre la lectura anterior de la agenda (donde el cupo
//  no estaba) y la lectura donde aparece: el techo de la edad del cupo,
//  la métrica que la frecuencia del polling acota (informe A/B, AB-6).
//  Cubre _cupoLatenciaMedir (casos directos + el enganche real dentro de
//  _procesarFuenteAgenda) y las frecuencias del polling de apiCadencia
//  ajustadas por la misma orden (reposo 20 s, jornada lejana 15 s).
//  Telemetría: la clave `cupo.nuevo` cuenta cupos y `cupo.nuevo.total`
//  suma sus ventanas en ms (convenio RUM); `cupo.nuevo.hueco` cuenta los
//  que nacieron en un hueco largo, donde la ventana no la explica la
//  frecuencia y no se reporta (no-inferencia v2.5).
// =====================================================================
module.exports = {
  nombre: "Latencia de detección de cupos nuevos + frecuencias del polling (orden A/B)",
  cubre: ["_cupoLatenciaMedir", "apiCadencia"],

  async pruebas(t, api, env, cargar) {
    // La ventana ux vive en memoria y vuelca en tandas de 2 s: quien la lea
    // debe volcar primero (mismo patrón que uxFlush / suite_23).
    const ventana = (c) => {
      try { c.api._uxVolcarBuffer(); return JSON.parse(c.env.storage.getItem("vgl_ux") || "null"); } catch (e) { return null; }
    };
    const acc = (c, clave) => { const w = ventana(c); return (w && w.acciones && w.acciones[clave]) || 0; };
    const cita = (doc, hora) => ({ hora_texto: hora, estado: "Pendiente", nombre: "PACIENTE DE PRUEBA", index: 1, doc_id: doc });
    // Entorno base de esta suite: telemetría ux encendida, líder apagado y
    // sesión ya resumida (sin siembra de arranque en medio de los casos).
    const base = () => {
      const c = cargar({ silencioso: true });
      c.api.__S.uxTelemetria = true;
      const st = c.api.__state;
      st.summarized = true;
      st.leader = false;
      return c;
    };

    // ================= _cupoLatenciaMedir — casos directos =================
    t.caso("siembra: sin lectura anterior no se mide nada (ni conteo ni total)", () => {
      const c = base();
      c.api.__state.lastSnapshot = null;
      c.api._cupoLatenciaMedir([cita("456", "08:20 AM")], Date.now());
      t.igual(acc(c, "cupo.nuevo"), 0, "sin snapshot previo no hay ventana que medir");
      t.igual(acc(c, "cupo.nuevo.hueco"), 0, "y tampoco huecos");
    });

    t.caso("un cupo nuevo con lectura anterior reciente: conteo 1 y total = la ventana en ms", () => {
      const c = base();
      const ahora = Date.now();
      c.api.__state.lastSnapshot = { at: ahora - 4000, list: [cita("123", "08:00 AM")], source: "api" };
      c.api._cupoLatenciaMedir([cita("123", "08:00 AM"), cita("456", "08:20 AM")], ahora);
      t.igual(acc(c, "cupo.nuevo"), 1, "la cita que no estaba en la lectura anterior es un cupo nuevo");
      t.igual(acc(c, "cupo.nuevo.total"), 4000, "su ventana (techo de edad) viaja en el .total, como el RUM");
    });

    t.caso("tres cupos nuevos en la misma lectura: tres aportes con la MISMA ventana", () => {
      const c = base();
      const ahora = Date.now();
      c.api.__state.lastSnapshot = { at: ahora - 2000, list: [cita("123", "08:00 AM")], source: "api" };
      c.api._cupoLatenciaMedir([cita("123", "08:00 AM"), cita("456", "08:20 AM"), cita("789", "08:40 AM"), cita("321", "09:00 AM")], ahora);
      t.igual(acc(c, "cupo.nuevo"), 3, "tres cupos ausentes en la lectura anterior");
      t.igual(acc(c, "cupo.nuevo.total"), 6000, "3 x 2000 ms — el promedio por cupo es total/conteo");
    });

    t.caso("la misma lista en ambas lecturas: cero cupos nuevos, cero ruido", () => {
      const c = base();
      const ahora = Date.now();
      c.api.__state.lastSnapshot = { at: ahora - 4000, list: [cita("123", "08:00 AM"), cita("456", "08:20 AM")], source: "api" };
      c.api._cupoLatenciaMedir([cita("123", "08:00 AM"), cita("456", "08:20 AM")], ahora);
      t.igual(acc(c, "cupo.nuevo"), 0, "nada nuevo: la medición no cuenta estados, cuenta presencia");
      t.igual(acc(c, "cupo.nuevo.total"), 0);
    });

    t.caso("un cupo que reemplaza a otro (la lista rotó): el entrante es nuevo", () => {
      const c = base();
      const ahora = Date.now();
      c.api.__state.lastSnapshot = { at: ahora - 4000, list: [cita("123", "08:00 AM")], source: "api" };
      c.api._cupoLatenciaMedir([cita("456", "08:20 AM")], ahora);
      t.igual(acc(c, "cupo.nuevo"), 1, "el que se fue no importa; el que entró sí");
    });

    t.caso("hueco largo (lectura anterior es un recuerdo): el evento se cuenta aparte, SIN ventana", () => {
      const c = base();
      const ahora = Date.now();
      // 10 min sin lecturas: el cupo pudo nacer en cualquier punto del hueco y esa
      // ventana NO la explica la frecuencia del polling (no-inferencia v2.5).
      c.api.__state.lastSnapshot = { at: ahora - 600000, list: [cita("123", "08:00 AM")], source: "api" };
      c.api._cupoLatenciaMedir([cita("123", "08:00 AM"), cita("456", "08:20 AM")], ahora);
      t.igual(acc(c, "cupo.nuevo.hueco"), 1, "el hecho no se pierde: se cuenta como nacido en hueco");
      t.igual(acc(c, "cupo.nuevo"), 0, "pero no ensucia la métrica de latencia con una ventana que la frecuencia no explica");
      t.igual(acc(c, "cupo.nuevo.total"), 0, "sin total de ms: no hay ventana atribuible");
    });

    t.caso("telemetría ux apagada: la medición no escribe nada (mismo interruptor que uxTrack)", () => {
      const c = base();
      c.api.__S.uxTelemetria = false;
      const ahora = Date.now();
      c.api.__state.lastSnapshot = { at: ahora - 4000, list: [cita("123", "08:00 AM")], source: "api" };
      c.api._cupoLatenciaMedir([cita("123", "08:00 AM"), cita("456", "08:20 AM")], ahora);
      t.igual(acc(c, "cupo.nuevo"), 0, "con ux apagada no se escribe la clave");
      t.igual(acc(c, "cupo.nuevo.total"), 0);
    });

    // ============ el enganche real: la medición corre en el procesado ============
    t.caso("integración: dos procesados seguidos de _procesarFuenteAgenda — el segundo detecta el cupo nuevo", () => {
      const c = base();
      c.api.__CONFIG.SEL = { hora: "", estado: "" };   // vista no vigilada: el procesado corre sin repintar
      const citas1 = [cita("123", "08:00 AM")];
      c.api._procesarFuenteAgenda({ visible: true, citas: citas1 }, "api", new Date(), false);
      t.igual(acc(c, "cupo.nuevo"), 0, "la primera lectura del entorno siembra el snapshot: no hay anterior con qué medir");
      const st = c.api.__state;
      t.cierto(st.lastSnapshot && st.lastSnapshot.list.length === 1, "el snapshot quedó listo (misma vía que el tick y el botón)");

      const citas2 = [cita("123", "08:00 AM"), cita("456", "08:20 AM")];
      // La segunda lectura viaja con now = (ahora real + 4000 ms): el medidor exige
      // ventana ESTRICTAMENTE positiva (now - ant.at > 0) y dos `new Date()` seguidos
      // pueden caer en el MISMO milisegundo real — ese empate no es un hueco largo ni
      // una no-detección: es la lectura más rápida posible, sin latencia que medir.
      // Forzar los 4000 ms garantiza la ventana y de paso verifica el .total.
      c.api._procesarFuenteAgenda({ visible: true, citas: citas2 }, "api", new Date(Date.now() + 4000), false);
      t.igual(acc(c, "cupo.nuevo"), 1, "la segunda lectura ve el cupo nuevo y lo cuenta — el enganche vive en el procesado");
      t.cierto(acc(c, "cupo.nuevo.total") >= 4000, "y su ventana viaja en el .total con los ms forzados");
    });

    // ============ frecuencias del polling ajustadas por la misma orden ============
    t.caso("apiCadencia tras la orden A/B: reposo 20 s y jornada lejana 15 s, piso crítico intacto", () => {
      const c = cargar({ silencioso: true });
      const TOL = c.api.__CONFIG.TOLERANCIA_MIN;
      const st = c.api.__state;
      st.lastSnapshot = null;
      t.igual(c.api.apiCadencia(), 20000, "sin agenda: reposo de 20 s");
      st.lastSnapshot = { list: [{ estado: "Atendido", elapsed: 0 }, { estado: "En Sala", elapsed: 99 }] };
      t.igual(c.api.apiCadencia(), 20000, "todas resueltas: reposo de 20 s");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL }] };
      t.igual(c.api.apiCadencia(), 5000, "cruce exacto: 5 s (piso del sistema, intacto)");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL - 8 }] };
      t.igual(c.api.apiCadencia(), 10000, "8 min antes del cruce: 10 s (bisagra, intacta)");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL + 8 }] };
      t.igual(c.api.apiCadencia(), 8000, "8 min después del cruce: 8 s (asimetría, intacta)");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL - 30 }] };
      t.igual(c.api.apiCadencia(), 15000, "lejos antes del cruce (casi toda la jornada): 15 s");
      st.lastSnapshot = { list: [{ estado: "Pendiente", elapsed: TOL + 60 }] };
      t.igual(c.api.apiCadencia(), 10000, "muy pasada (dentro de la ventana de abandono): 10 s");
    });
  },
};
