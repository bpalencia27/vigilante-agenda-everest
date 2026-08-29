// =====================================================================
//  SUITE 66 — El relevo de pestaña no puede perder la vigilancia de
//             fraude (auditoría v16.7.0, hallazgo #7)
//
//  Lo que estaba mal: `fraudWatch` (pacientes que ya pasaron la
//  tolerancia sin presentarse) y `alertedFraud` (los que ya sonaron)
//  vivían SOLO en la memoria de la pestaña líder. Si el médico cerraba
//  esa pestaña y otra tomaba el relevo, la nueva arrancaba con los dos
//  conjuntos vacíos: un paciente vigilado llegaba a sala y esta pestaña
//  lo pintaba VERDE «llegó a tiempo», y el FRAUDE_EXTEMPORANEO no se
//  escribía nunca. La evidencia para la reclamación se perdía.
//
//  El remedio es el mismo de la siembra de avisos (v14.1.5): un almacén
//  compartido del día que la nueva líder fusiona al arrancar. Se prueba
//  que sobrevive al relevo y que NO sobrevive al cambio de día (la
//  vigilancia de ayer no puede ensuciar la agenda de hoy).
// =====================================================================

module.exports = {
  nombre: "Relevo de pestaña: la vigilancia de fraude sobrevive (auditoría #7)",
  cubre: ["_fraudeCompartidoGuardar", "_fraudeCompartidoFusionar", "apptKey", "_apptKeysLegado", "_apptMarcada", "_apptMarcar", "colorAndAlert"],

  async pruebas(t, api, env, cargar) {
    const CLAVE = "vgl_fraude_dia2";   // v17.1.0 — la clave lleva sufijo de esquema: apptKey cambió de forma

    // =====================================================================
    // v17.56.0 — REPORTE EN VIVO DE UNA COLEGA (29-ago), textual: «cuando lo confirman tarde
    // sale rojo y después me salía verde». La marca de llegada extemporánea aparecía y se
    // perdía sola, que es la MISMA pérdida de evidencia que esta suite vigila desde la
    // v16.7.0 — pero por otra puerta: no el relevo de pestaña, sino que la CLAVE de la cita
    // cambia para la misma cita.
    //
    // Reproducido con el arnés antes de tocar nada: `apptKey` llevaba `a.index`, la POSICIÓN
    // en la lista. Un cupo adicional o cualquier reordenamiento cambiaba la clave, la marca
    // quedaba huérfana y la tarjeta volvía a VERDE. Lo mismo al aparecer o desaparecer el
    // documento entre lecturas (la API lo trae, el respaldo por DOM a veces no).
    // =====================================================================
    const _tt = (h) => new Date("2026-08-29T" + h + ":00");

    function _corrida(cargar, marcaConDoc, releeConDoc, releeIndex) {
      const c = cargar({ silencioso: true });
      const A = c.api;
      A.__state.leader = true;
      A.__CONFIG.TOLERANCIA_MIN = 6.0;
      const base = { nombre: "PACIENTE DE PRUEBA", index: 3, hora_texto: "11:20 a. m." };
      // 11:32 — doce minutos tarde y todavía sin presentarse: aquí nace la marca.
      A.colorAndAlert(Object.assign({}, base, { doc_id: marcaConDoc ? "5150076" : "", estado: "Sin presentarse" }), _tt("11:32"));
      // Más tarde lo confirman. Dos lecturas seguidas por el antirrebote de estado.
      const rel = Object.assign({}, base, { doc_id: releeConDoc ? "0005150076" : "", index: releeIndex, estado: "En Sala" });
      A.colorAndAlert(rel, _tt("11:41"));
      return A.colorAndAlert(rel, _tt("11:41"));
    }

    t.caso("v17.56.0: la marca de llegada tarde sobrevive a que la agenda se reordene", () => {
      t.igual(_corrida(cargar, false, false, 7).color, "ROJO",
        "sin documento legible y en otra posición de la lista: sigue siendo la misma cita");
    });

    t.caso("v17.56.0: y sobrevive a que el documento aparezca o desaparezca entre lecturas", () => {
      t.igual(_corrida(cargar, true, true, 7).color, "ROJO", "con documento las dos veces (y con ceros de relleno la segunda)");
      t.igual(_corrida(cargar, true, false, 7).color, "ROJO", "marcada con documento, releída sin él");
      t.igual(_corrida(cargar, false, true, 7).color, "ROJO", "marcada sin documento, releída con él");
    });

    t.caso("v17.56.0: un paciente que SÍ llegó a tiempo sigue saliendo verde", () => {
      const c = cargar({ silencioso: true });
      const A = c.api;
      A.__state.leader = true;
      A.__CONFIG.TOLERANCIA_MIN = 6.0;
      const base = { nombre: "PACIENTE PUNTUAL", index: 2, hora_texto: "11:20 a. m.", doc_id: "8396613" };
      // A los 3 minutos aún no se presenta: por debajo de la tolerancia, no se marca nada.
      A.colorAndAlert(Object.assign({}, base, { estado: "Sin presentarse" }), _tt("11:23"));
      const enSala = Object.assign({}, base, { estado: "En Sala" });
      A.colorAndAlert(enSala, _tt("11:24"));
      t.igual(A.colorAndAlert(enSala, _tt("11:24")).color, "VERDE",
        "el arreglo no puede convertir en tarde a quien llegó a tiempo");
    });

    t.caso("v17.56.0: _apptKeysLegado ofrece las formas viejas SOLO para leer", () => {
      const a = { doc_id: "0005150076", nombre: "PACIENTE DE PRUEBA", index: 3, hora_texto: "11:20 a. m." };
      t.igual(api.apptKey(a), "5150076@m680", "la clave que se ESCRIBE va canonicalizada y sin posición");
      const viejas = api._apptKeysLegado(a);
      t.cierto(viejas.indexOf("0005150076@m680") >= 0, "la del documento sin canonicalizar");
      t.cierto(viejas.indexOf("PACIENTE DE PRUEBA@m680") >= 0, "la del nombre solo");
      t.cierto(viejas.indexOf("PACIENTE DE PRUEBA|3@m680") >= 0, "y la vieja con la posición de la lista");
    });

    t.caso("_fraudeCompartidoGuardar: deja los dos conjuntos del día en el almacén compartido", () => {
      const st = api.__state;
      st.fraudWatch.clear(); st.alertedFraud.clear();
      st.fraudWatch.add("1093-0800"); st.fraudWatch.add("5521-0930");
      st.alertedFraud.add("1093-0800");

      api._fraudeCompartidoGuardar();

      const g = JSON.parse(env.almacen[CLAVE]);
      t.igual(g.dia, api.todayStamp(), "sellado con el día de hoy");
      t.igual(g.watch.sort(), ["1093-0800", "5521-0930"], "los vigilados");
      t.igual(g.alerted, ["1093-0800"], "y los que ya sonaron, para no repetir la alarma tras el relevo");
    });

    await t.casoAsync("_fraudeCompartidoFusionar: la pestaña que toma el relevo recupera la vigilancia entera", async () => {
      // Pestaña 1: vigila a dos pacientes y guarda.
      const p1 = await cargar({ silencioso: true });
      p1.api.__state.fraudWatch.add("1093-0800");
      p1.api.__state.fraudWatch.add("5521-0930");
      p1.api.__state.alertedFraud.add("1093-0800");
      p1.api._fraudeCompartidoGuardar();

      // Pestaña 2 (el relevo): arranca en blanco y hereda el mismo almacén.
      const p2 = await cargar({ silencioso: true, almacen: p1.env.almacen });
      t.igual(p2.api.__state.fraudWatch.size, 0, "la nueva líder arranca sin memoria propia: ese era el agujero");

      const n = p2.api._fraudeCompartidoFusionar();
      t.igual(n, 3, "fusionó las 3 marcas (2 vigilados + 1 ya alertado)");
      t.cierto(p2.api.__state.fraudWatch.has("1093-0800"), "el paciente vigilado sigue vigilado tras el relevo");
      t.cierto(p2.api.__state.fraudWatch.has("5521-0930"), "y el otro también");
      t.cierto(p2.api.__state.alertedFraud.has("1093-0800"), "y no le vuelve a sonar la alarma al médico por el mismo paciente");
    });

    await t.casoAsync("_fraudeCompartidoFusionar: no duplica lo que la pestaña ya sabía", async () => {
      const p1 = await cargar({ silencioso: true });
      p1.api.__state.fraudWatch.add("1093-0800");
      p1.api._fraudeCompartidoGuardar();
      const n1 = p1.api._fraudeCompartidoFusionar();
      t.igual(n1, 0, "lo que ya estaba en memoria no cuenta como novedad");
      t.igual(p1.api.__state.fraudWatch.size, 1, "y el conjunto no crece");
    });

    await t.casoAsync("_fraudeCompartidoFusionar: la vigilancia de AYER no entra hoy", async () => {
      const p = await cargar({ silencioso: true });
      p.env.almacen[CLAVE] = JSON.stringify({ dia: "2020-01-01", watch: ["1093-0800"], alerted: ["1093-0800"] });
      t.igual(p.api._fraudeCompartidoFusionar(), 0, "sello de otro día: se ignora entero");
      t.igual(p.api.__state.fraudWatch.size, 0, "la agenda de hoy arranca limpia");
    });

    await t.casoAsync("_fraudeCompartidoFusionar: almacén vacío o corrupto no lanza ni ensucia el estado", async () => {
      const p = await cargar({ silencioso: true });
      t.igual(p.api._fraudeCompartidoFusionar(), 0, "sin almacén, cero");
      p.env.almacen[CLAVE] = "{ esto no es json";
      t.igual(p.api._fraudeCompartidoFusionar(), 0, "con basura, cero y sin excepción");
      p.env.almacen[CLAVE] = JSON.stringify({ dia: p.api.todayStamp() });
      t.igual(p.api._fraudeCompartidoFusionar(), 0, "sin listas, cero (el sello solo no basta)");
      t.igual(p.api.__state.fraudWatch.size, 0, "y en ningún caso queda estado a medias");
    });
  },
};
