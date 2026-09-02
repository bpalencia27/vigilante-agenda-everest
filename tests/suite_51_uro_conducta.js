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
  cubre: ["mtrHallazgosUroDesdeLabs", "_esUroComponenteAlterado", "_clasificarComponentesUro", "_resumenClinicoUro",
          "_agruparUroanalisisParaTabla", "mtrEvaluarUroanalisis"],

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

    // v18.0.84 — HALLAZGO DE ENJAMBRE #36 (3 de 3 refutadores no lo tumbaron). El hallazgo
    // MÁS GRAVE posible del uroanálisis (piuria o hematuria masiva, «incontables») pasaba
    // como NORMAL: parseFloat('incontables') es NaN y ninguna de las palabras clave lo
    // cubría. Mismo léxico que ya usa mtrUroGrado para el mismo hallazgo — se prueban las
    // tres formas exactas de la reproducción del hallazgo.
    t.caso("REGRESIÓN — leucocitos/hematíes INCONTABLES/INNUMERABLES/CAMPO CUBIERTO sí se reconocen como alterados (hallazgo #36)", () => {
      t.cierto(api._esUroComponenteAlterado({ nombre: "Leucocitos", resultado: "INCONTABLES" }), "INCONTABLES: piuria masiva");
      t.cierto(api._esUroComponenteAlterado({ nombre: "Leucocitos", resultado: "Incontables" }), "sin importar mayúsculas/minúsculas");
      t.cierto(api._esUroComponenteAlterado({ nombre: "Hematies", resultado: "INNUMERABLES" }), "INNUMERABLES: hematuria masiva");
      t.cierto(api._esUroComponenteAlterado({ nombre: "Leucocitos", resultado: "CAMPO CUBIERTO" }), "CAMPO CUBIERTO: el mismo hallazgo con otro nombre");
      t.cierto(api._esUroComponenteAlterado({ nombre: "Leucocitos", resultado: "campo   cubierto" }), "tolera espacios de más entre las dos palabras");
    });

    // 02-sep — CIERRE ADVERSARIAL (filas 39a y 39b): el léxico de v18.0.84 estaba ANCLADO al
    // texto completo, así que el mismo hallazgo con el sufijo de campo del LIS («INCONTABLES X
    // CAMPO», «Incontables por campo», «INNUMERABLES/CAMPO», «> 100 INCONTABLES») seguía
    // pasando como NORMAL — mientras mtrUroRecuento, en el mismo archivo, ya devolvía 999 para
    // esas cadenas. Y los positivos cualitativos que mtrUroGrado reconoce desde v16.7.0
    // (PRESENTE, REGULARES, SE OBSERVAN…) tampoco se resaltaban. Un solo catálogo.
    t.caso("02-sep: el resaltado del uroanálisis usa el MISMO catálogo que el motor (mtrUroGrado/mtrUroRecuento)", () => {
      for (const r of ["INCONTABLES X CAMPO", "Incontables por campo", "INNUMERABLES/CAMPO", "> 100 INCONTABLES"]) {
        t.cierto(api._esUroComponenteAlterado({ nombre: "LEUCOCITOS", resultado: r }), "«" + r + "» es piuria masiva, no NORMAL");
      }
      t.cierto(api._esUroComponenteAlterado({ nombre: "NITRITOS", resultado: "PRESENTE" }), "nitritos PRESENTE: positivo (grado 1)");
      t.cierto(api._esUroComponenteAlterado({ nombre: "PROTEINAS", resultado: "PRESENTES" }), "proteínas PRESENTES");
      t.cierto(api._esUroComponenteAlterado({ nombre: "BACTERIAS", resultado: "REGULARES" }), "bacterias REGULARES (grado 2)");
      t.cierto(api._esUroComponenteAlterado({ nombre: "BACTERIAS", resultado: "Regular" }), "y en singular");
      t.cierto(api._esUroComponenteAlterado({ nombre: "CILINDROS", resultado: "SE OBSERVAN" }), "cilindros SE OBSERVAN");
      t.cierto(api._esUroComponenteAlterado({ nombre: "LEVADURAS", resultado: "OBSERVADAS" }), "levaduras OBSERVADAS");
      // Lo que el motor deja en 0 a propósito sigue sin resaltarse: no se inventa patología.
      t.falso(api._esUroComponenteAlterado({ nombre: "BACTERIAS", resultado: "ESCASAS" }), "escasas: inespecífico, no se resalta");
      t.falso(api._esUroComponenteAlterado({ nombre: "PROTEINAS", resultado: "TRAZAS" }), "trazas: por debajo de una cruz");
      t.falso(api._esUroComponenteAlterado({ nombre: "CRISTALES", resultado: "NO SE OBSERVAN" }), "no se observan: normal");
      t.falso(api._esUroComponenteAlterado({ nombre: "DENSIDAD", resultado: "1.015" }), "un número sin regla sigue sin inventarse alteración");
    });

    // v18.0.104 — refutador de v18.0.101 (fila 39a): los COMPARADORES del LIS («> 50 X CAMPO»,
    // «MAYOR A 100», «>100») seguían pintándose NORMAL: parseFloat daba NaN, y en «5-8 x campo»
    // tomaba la cota inferior. El bloque numérico lee ahora con mtrUroRecuento (límite superior).
    t.caso("v18.0.104: los comparadores y rangos del LIS se leen como el motor (límite superior)", () => {
      for (const r of ["> 50 X CAMPO", "MAYOR A 100", ">100", "> 100 x campo", "5-8 x campo", "10-15 x campo"]) {
        t.cierto(api._esUroComponenteAlterado({ nombre: "LEUCOCITOS", resultado: r }), "leucocitos «" + r + "»: alterado");
      }
      t.cierto(api._esUroComponenteAlterado({ nombre: "HEMATIES", resultado: "4-6 x campo" }), "hematíes 4-6: el límite superior (6) > 3");
      t.falso(api._esUroComponenteAlterado({ nombre: "LEUCOCITOS", resultado: "1-2 x campo" }), "leucocitos 1-2: normal");
      t.falso(api._esUroComponenteAlterado({ nombre: "HEMATIES", resultado: "0-2 x campo" }), "hematíes 0-2: normal");
      const r = api._resumenClinicoUro([{ nombre: "LEUCOCITOS", resultado: "> 50 X CAMPO" }, { nombre: "NITRITOS", resultado: "NEGATIVO" }]);
      t.cierto(!!r && r.esPatologico === true, "y el resumen del parcial ya no dice «Sin hallazgos» con una piuria masiva a la vista");
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

    // ===== v18.0.32 — LOS DOS DEFECTOS DEL PARCIAL DE ORINA =====
    // Reproducidos con el arnés contra el archivo vivo antes de tocar nada. Son DOS
    // defectos independientes: arreglar uno dejaba el otro en pie, y cada uno por su
    // cuenta bastaba para que un parcial infeccioso saliera rotulado como normal.

    t.caso("v18.0.32 (A): el bloque agrupado NO pierde la piuria — el ancla de panel viaja con el componente", () => {
      // _agruparUroanalisisParaTabla comprimía cada fila a {nombre, resultado} y tiraba
      // NombreParametroPadre. Aguas abajo, mtrHallazgosUroDesdeLabs exige
      // _esAnalitoDeOrina(lab), que sin padre cae al respaldo POR NOMBRE — y ese respaldo,
      // a propósito (v12.3.37), NO reconoce LEUCOCITOS/HEMATIES/SANGRE porque también
      // existen en el hemograma EN SANGRE. Medido: la piuria se perdía y el bloque salía
      // «Sin hallazgos patológicos (Normal)».
      const labs = [
        labUro("ESTERASA LEUCOCITARIA", "PRESENTE"),
        labUro("LEUCOCITOS", "INCONTABLES"),
        labUro("NITRITOS", "NEGATIVO"),
      ];
      const crudo = api.mtrHallazgosUroDesdeLabs(labs);
      t.cierto(crudo.leucocitos != null, "de entrada, sin agrupar, la piuria SÍ se ve");

      const grupo = api._agruparUroanalisisParaTabla(labs);
      const comps = (grupo[0] || {}).__vglGrupoUroComponentes || [];
      t.cierto(comps.length > 0, "el agrupador produce componentes");
      const tras = api.mtrHallazgosUroDesdeLabs(comps);
      t.cierto(tras.leucocitos != null,
        "y DESPUÉS de agrupar la piuria sigue ahí: " + JSON.stringify(tras));
      t.igual(tras.esterasa, crudo.esterasa, "la esterasa tampoco cambia al agrupar");
      const res = api._resumenClinicoUro(comps);
      t.cierto(res.esPatologico === true,
        "y el bloque NO se rotula como normal: " + JSON.stringify(res));
    });

    t.caso("v18.0.32 (A-bis): el «—» de relleno NO entra al motor como si fuera un resultado", () => {
      // Destapado por la mutación M2 del propio arreglo: conservar el ancla de panel pero
      // mandar el valor DE PANTALLA («—», que es relleno visual para la tabla) hacía que
      // esValorReal lo aceptara —solo rechaza vacío, «PENDIENTE» e idEstado 1— y el motor
      // se inventaba un hallazgo sobre un paciente sin parcial de orina:
      //   hallazgos {"nitritos":"—","esterasa":"—"} -> estado CONFIRMAR, conducta «hay
      //   valores que el asistente no pudo interpretar… revíselos a mano».
      // Casilla vacía antes que dato inventado: el valor CRUDO viaja aparte del de pantalla.
      const sinResultado = [
        { NombreParametroPadre: "PARCIAL DE ORINA", NombreParametro: "NITRITOS" },
        { NombreParametroPadre: "PARCIAL DE ORINA", NombreParametro: "ESTERASA LEUCOCITARIA" },
      ];
      const grupo = api._agruparUroanalisisParaTabla(sinResultado);
      const comps = (grupo[0] || {}).__vglGrupoUroComponentes || [];
      t.igual(comps.length, 2, "los dos componentes siguen en la tabla");
      t.igual(comps[0].resultado, "—", "y en PANTALLA se sigue viendo el guion de relleno");
      t.igual(comps[0].Resultado, "", "pero al motor le llega vacío, no el guion");
      t.igual(api.mtrHallazgosUroDesdeLabs(comps), null,
        "el motor no se inventa hallazgos sobre un parcial que no trae resultados");
    });

    t.caso("v18.0.32 (B): una esterasa en cruces CON número no se cuenta como recuento de leucocitos", () => {
      // mtrUroRecuento("3+") devuelve 3, y la guarda vieja solo reconocía la cruz pelada
      // (/^[+-]+$/): una esterasa 3+ entraba al campo del RECUENTO como «3 leucocitos por
      // campo» — por debajo del umbral de piuria (10) y, peor, AFIRMANDO un conteo normal
      // que nadie midió.
      ["3+", "2 +", "1+"].forEach((v) => {
        const h = api.mtrHallazgosUroDesdeLabs([labUro("LEUCOCITOS", v)]);
        t.cierto(h.esterasa != null, v + " es una cruz: va a la esterasa (" + JSON.stringify(h) + ")");
        t.cierto(h.leucocitos == null, v + " NO puede afirmar un recuento que nadie midió");
      });
      // Y lo que es recuento de verdad sigue siéndolo — incluidas las cotas «20+» y
      // «100+», que NO son cruces: cambiar el defecto por el contrario sería igual de malo.
      [["10-15", 15], ["35", 35], ["> 50", 50], ["0-2", 2], ["0", 0], ["20+", 20], ["100+", 100]].forEach(([v, n]) => {
        const h = api.mtrHallazgosUroDesdeLabs([labUro("LEUCOCITOS", v)]);
        t.igual(h.leucocitos, n, v + " sigue siendo un recuento de " + n);
      });
      // La cruz pelada y el negativo, como siempre.
      t.igual(api.mtrHallazgosUroDesdeLabs([labUro("LEUCOCITOS", "+++")]).esterasa, "+++");
      t.igual(api.mtrHallazgosUroDesdeLabs([labUro("LEUCOCITOS", "-")]).esterasa, "-");
    });

    t.caso("v18.0.32 (B, de punta a punta): tira 3+ con 15-20 x campo deja de salir «SIN HALLAZGOS»", () => {
      const h = api.mtrHallazgosUroDesdeLabs([
        labUro("LEUCOCITOS", "3+"),
        labUro("LEUCOCITOS POR CAMPO", "15-20"),
        labUro("NITRITOS", "NEGATIVO"),
      ]);
      t.igual(h.esterasa, "3+", "la esterasa llega a su campo");
      t.igual(h.leucocitos, 20, "y el recuento del sedimento al suyo");
      const ev = api.mtrEvaluarUroanalisis(h);
      t.cierto(ev.sugestivo === true, "el parcial es sugestivo: " + JSON.stringify(ev.criterios));
      t.falso(ev.estado === "SIN HALLAZGOS",
        "jamás «SIN HALLAZGOS» sobre una esterasa positiva con piuria — eso cerraba el caso sin urocultivo");
    });

    // v15.7.0 — mtrExamenesParaConducta y sus pruebas se retiraron con la maquinaria
    // de clic-en-Conducta (ver suite_53: pines de permanencia).
  },
};
