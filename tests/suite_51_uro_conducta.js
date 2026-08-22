// =====================================================================
//  SUITE 51 — Cableado del uroanálisis de Athenea y adición a Conducta
//
//  Dos piezas que tocan cosas sensibles:
//   1. La lectura del parcial de orina de Athenea. El riesgo es interpretar
//      mal un componente (confundir el recuento de leucocitos con la esterasa,
//      o dar por real un "PENDIENTE"). Se fija la extracción conservadora.
//   2. Qué exámenes se pueden AGREGAR A CONDUCTA. Aquí la regla es dura: solo
//      los que tienen un texto de <li> CAPTURADO en consultorio; jamás uno
//      inventado, porque un clic por aproximación ordenaría el examen
//      equivocado en la historia de un paciente.
// =====================================================================

// Fabrica un analito como lo entrega Athenea, con su panel padre de orina.
function labUro(nombre, resultado, extra) {
  return Object.assign({ NombreParametroPadre: "PARCIAL DE ORINA", NombreParametro: nombre, Resultado: resultado }, extra || {});
}

module.exports = {
  nombre: "Uroanálisis de Athenea y adición a Conducta",
  cubre: ["mtrHallazgosUroDesdeLabs", "_esUroComponenteAlterado", "_clasificarComponentesUro", "_resumenClinicoUro"],

  pruebas(t, api) {

    // ===== v16.7.0, auditoría #13: TRES filas del mismo informe casan con
    // el componente "LEUCOCITOS" (la esterasa de la tira, el recuento del
    // sedimento y a veces un "leucocitos en orina" suelto). Antes se
    // repartían por la forma del valor y la última pisaba a las anteriores.
    t.caso("esterasa y recuento conviven: el nombre manda, no el orden de llegada", () => {
      const h = api.mtrHallazgosUroDesdeLabs([
        labUro("LEUCOCITOS", "10-15 x campo"),
        labUro("ESTERASA LEUCOCITARIA", "++"),        // llega DESPUÉS: antes borraba la piuria
      ]);
      t.igual(h.esterasa, "++", "la tira va a esterasa porque lo dice su nombre");
      t.igual(h.leucocitos, 15, "y el recuento sobrevive como piuria (tope del rango)");
      const r = api.mtrEvaluarUroanalisis(h, true, false);
      t.cierto(r.sugestivo, "juntos son criterio de ITU: esterasa (+) con piuria");
    });

    t.caso("el rango del sedimento ya no se cuela al campo de la esterasa", () => {
      const h = api.mtrHallazgosUroDesdeLabs([labUro("LEUCOCITOS EN ORINA", "10-15")]);
      t.igual(h.leucocitos, 15, "«10-15» es un recuento, no una tira reactiva");
      t.cierto(h.esterasa === undefined, "y no ensucia la esterasa: " + JSON.stringify(h));
    });

    t.caso("entre dos lecturas de la esterasa se queda la más alarmante", () => {
      const h = api.mtrHallazgosUroDesdeLabs([
        labUro("ESTERASA LEUCOCITARIA", "+++"),
        labUro("ESTERASA", "NEGATIVO"),               // fila posterior que antes borraba el positivo
      ]);
      t.igual(h.esterasa, "+++", "un negativo posterior no puede borrar un +++ ya informado");
    });

    t.caso("dos recuentos: manda el mayor, no el último", () => {
      const h = api.mtrHallazgosUroDesdeLabs([
        labUro("LEUCOCITOS", "30"),
        labUro("LEUCOCITOS POR CAMPO", "2"),
      ]);
      t.igual(h.leucocitos, 30, "perder una piuria cuesta una infección sin tratar");
    });

    // ================= v15.6.2 — el trío del uroanálisis (sin cubrir desde v15.3) =================
    t.caso("_esUroComponenteAlterado: distingue normal, positivo textual y umbrales numéricos del sedimento", () => {
      t.falso(api._esUroComponenteAlterado(null), "nulo: no");
      t.falso(api._esUroComponenteAlterado({ nombre: "NITRITOS", resultado: "NEGATIVO" }), "negativo: no");
      t.falso(api._esUroComponenteAlterado({ nombre: "COLOR", resultado: "AMARILLO" }), "amarillo: normal");
      t.cierto(api._esUroComponenteAlterado({ nombre: "NITRITOS", resultado: "POSITIVO" }), "positivo textual: sí");
      t.cierto(api._esUroComponenteAlterado({ nombre: "BACTERIAS", resultado: "ABUNDANTES" }), "abundantes: sí");
      t.cierto(api._esUroComponenteAlterado({ nombre: "LEUCOCITOS", resultado: "12" }), "leucocitos 12 > 5: sí");
      t.falso(api._esUroComponenteAlterado({ nombre: "LEUCOCITOS", resultado: "3" }), "leucocitos 3: no");
      t.cierto(api._esUroComponenteAlterado({ nombre: "HEMATIES", resultado: "8" }), "hematíes 8 > 3: sí");
      t.falso(api._esUroComponenteAlterado({ nombre: "DENSIDAD", resultado: "1.015" }), "densidad numérica sin regla: no se inventa alteración");
    });

    t.caso("_clasificarComponentesUro: separa fisicoquímico, sedimento y otros sin perder ninguno", () => {
      const r = api._clasificarComponentesUro([
        { nombre: "COLOR", resultado: "AMARILLO" },
        { nombre: "PH", resultado: "6.0" },
        { nombre: "LEUCOCITOS", resultado: "2" },
        { nombre: "CRISTALES", resultado: "NO SE OBSERVAN" },
        { nombre: "OTRA COSA RARA", resultado: "X" },
      ]);
      t.igual(r.fisicoQuimico.length, 2, "color y pH al fisicoquímico");
      t.igual(r.sedimento.length, 2, "leucocitos y cristales al sedimento");
      t.igual(r.otros.length, 1, "lo no reconocido queda en otros, no se bota");
      t.igual(api._clasificarComponentesUro(null).fisicoQuimico.length, 0, "nulo tolerado");
    });

    t.caso("_resumenClinicoUro: con componentes alterados marca patológico y lista los hallazgos", () => {
      const r = api._resumenClinicoUro([
        { nombre: "NITRITOS", resultado: "POSITIVO" },
        { nombre: "COLOR", resultado: "AMARILLO" },
      ]);
      t.cierto(!!r, "devuelve resumen");
      t.cierto(r.esPatologico === true || (Array.isArray(r.chips) && r.chips.length > 0), "lo alterado se declara");
      const limpio = api._resumenClinicoUro([{ nombre: "COLOR", resultado: "AMARILLO" }]);
      t.cierto(!limpio || limpio.esPatologico !== true, "todo normal: no se inventa patología");
      t.noLanza(() => api._resumenClinicoUro(null), "nulo tolerado");
    });
    // ================= LECTURA DEL PARCIAL DE ORINA =================

    t.caso("lee nitritos positivos del parcial", () => {
      const h = api.mtrHallazgosUroDesdeLabs([labUro("NITRITOS", "POSITIVO")]);
      t.cierto(!!h && !!h.nitritos, "nitritos capturados");
    });

    t.caso("distingue el RECUENTO de leucocitos (número = piuria) de la ESTERASA (texto)", () => {
      const conRecuento = api.mtrHallazgosUroDesdeLabs([labUro("LEUCOCITOS", "35")]);
      t.igual(conRecuento.leucocitos, 35, "un número es recuento -> piuria");
      t.igual(conRecuento.esterasa, undefined, "y NO se marca como esterasa");
      const conEsterasa = api.mtrHallazgosUroDesdeLabs([labUro("ESTERASA LEUCOCITARIA", "POSITIVO")]);
      t.cierto(!!conEsterasa.esterasa, "un +/- es esterasa");
      t.igual(conEsterasa.leucocitos, undefined, "y NO un recuento");
    });

    t.caso("captura la bacteriuria, que viene como analito propio (no como componente de la tira)", () => {
      const h = api.mtrHallazgosUroDesdeLabs([labUro("BACTERIAS EN ORINA", "ABUNDANTES")]);
      t.cierto(!!h && !!h.bacteriuria, "bacteriuria capturada por nombre");
    });

    t.caso("un componente PENDIENTE o vacío NO se da por real", () => {
      t.igual(api.mtrHallazgosUroDesdeLabs([labUro("NITRITOS", "PENDIENTE")]), null, "PENDIENTE no cuenta");
      t.igual(api.mtrHallazgosUroDesdeLabs([labUro("NITRITOS", "", { idEstado: 1 })]), null, "idEstado 1 (sin resultado) no cuenta");
      t.igual(api.mtrHallazgosUroDesdeLabs([labUro("NITRITOS", "")]), null, "valor vacío no cuenta");
    });

    t.caso("sin ningún componente de orina, devuelve null (no inventa un uroanálisis)", () => {
      t.igual(api.mtrHallazgosUroDesdeLabs([{ NombreParametro: "CREATININA EN SUERO", Resultado: "1.2" }]), null, "un lab de suero no es orina");
      t.igual(api.mtrHallazgosUroDesdeLabs([]), null, "lista vacía");
      t.igual(api.mtrHallazgosUroDesdeLabs(null), null, "null");
    });

    t.caso("lo que lee se conecta con el motor: nitritos+ sin síntomas -> REQUIERE SÍNTOMAS", () => {
      // El cableado completo: extracción -> mtrEvaluarUroanalisis. Como los
      // síntomas no vienen en el laboratorio, el motor NO decide solo: pide
      // confirmarlos. Es el modo seguro (nunca "trate" a ciegas).
      const h = api.mtrHallazgosUroDesdeLabs([labUro("NITRITOS", "POSITIVO")]);
      const r = api.mtrEvaluarUroanalisis(h, null, false);
      t.igual(r.estado, "REQUIERE SÍNTOMAS", "sugestivo pero faltan síntomas");
      t.cierto(r.sugestivo, "nitritos+ es sugestivo");
    });

    t.caso("esterasa + recuento de leucocitos juntos son sugestivos", () => {
      const h = api.mtrHallazgosUroDesdeLabs([
        labUro("ESTERASA LEUCOCITARIA", "POSITIVO"),
        labUro("LEUCOCITOS", "40"),
      ]);
      const r = api.mtrEvaluarUroanalisis(h, true, false);
      t.igual(r.estado, "PROBABLE ITU", "esterasa+piuria con síntomas -> probable ITU");
    });

    t.caso("el resumen clínico integra el uroanálisis cuando el parcial trae componentes", () => {
      // A través del adaptador del modal de labs: se le pasan los labs crudos.
      const labs = [
        { NombreParametro: "CREATININA EN SUERO", Resultado: "1.1", FechaResultado: "2026-08-01" },
        labUro("NITRITOS", "POSITIVO"),
      ];
      const h = api.mtrHallazgosUroDesdeLabs(labs);
      t.cierto(!!h, "hay hallazgos de orina en esos labs");
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-17", edad: 60, sexo: "F", pesoKg: 65, creatinina: 1.1,
        factores: {}, ultimos: {}, programa: "HTA",
        uroHallazgos: h, uroSintomas: null,
      });
      t.cierto(!!r.uroanalisis, "el resumen trae el bloque de uroanálisis");
      t.igual(r.uroanalisis.estado, "REQUIERE SÍNTOMAS", "y en el estado seguro");
    });

    // v15.7.0 — mtrExamenesParaConducta y sus pruebas se retiraron con la maquinaria
    // de clic-en-Conducta (ver suite_53: pines de permanencia).
  },
};
