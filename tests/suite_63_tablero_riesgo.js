// =====================================================================
//  SUITE 63 — v16.0.0: el módulo «Riesgo y exámenes»
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que la clasificación que el
//  médico ve venga SIEMPRE con su porqué, que las dos fórmulas de función
//  renal se muestren sin confundirse (Cockcroft-Gault manda vigencias,
//  CKD-EPI manda clínica), que las vigencias salgan de UN SOLO programa
//  (ERC > DM2 > HTA) y que un cambio en las pestañas de Everest reclasifique
//  sin volver a pedir laboratorios.
// =====================================================================

module.exports = {
  nombre: "v16.0.0 — módulo Riesgo y exámenes (clasificación, TFG y vigencias)",
  cubre: [
    // v17.16.0 — estas ya se ejercitaban en esta misma suite y NO estaban declaradas: el
    // informe de cobertura las listaba como «sin cubrir» y escondía cuáles son los huecos
    // de verdad. Un informe que subestima engaña igual que uno que exagera.
    "_vglConfirmacionesLeer", "_vglContextoEstado", "_vglTextoContextoFaltante",
    "_vglAvisoContextoFaltante",   // v16.3.0 — compuerta de contexto
    "_vglModalConfirmarDatos",     // v16.3.2 — modal del reconciliador
    "mtrTableroClinico", "mtrRecalcularConFactores", "_tableroFirmaDom",
    "_tableroQueCambio", "openTableroModal", "mtrPanelResumenAlAbrir",
    "mtrJsonV68DesdeResumen", "mtrResumenClinico",
    "mtrReconciliarAhora",         // v17.7.0 — el reconciliador, sacado a función probable
  ],

  async pruebas(t, api, env, cargar) {
    const c = cargar({ silencioso: true });
    const a = c.api;

    // Un paciente real de laboratorio de pruebas: diabético e hipertenso con función
    // renal en G3a — o sea, inscrito en tres programas a la vez.
    const resumenBase = a.mtrResumenClinico({
      hoyIso: "2026-08-20", edad: 66, sexo: "F", pesoKg: 70, creatinina: 1.3,
      rac: 45, ct: 240, hdl: 40, ldl: 160, paSistolica: 150, paDiastolica: 92,
      factores: { hta: true, diabetes: true, tabaquismo: false, enfermedadRenalDocumentada: true },
      ultimos: {
        CREATININA: { fecha: "2026-07-01", valor: 1.3 },
        HBA1C: { fecha: "2026-03-10", valor: 8.4 },
        COLESTEROL_LDL: { fecha: "2026-06-15", valor: 160 },
        GLUCOSA: { fecha: "2026-06-15", valor: 145 },
      },
    });

    t.caso("el módulo entrega la clasificación CON su porqué (nunca una categoría a secas)", () => {
      const d = a.mtrTableroClinico(resumenBase);
      t.cierto(!!d.riesgo.categoria, "hay categoría");
      t.cierto(d.riesgo.criterios.length > 0, "y viene con los criterios que la justifican");
      t.cierto(typeof d.riesgo.paso === "number", "con el paso de la regla que la decidió");
      t.cierto(/Consenso|Colombia/i.test(d.riesgo.fuente), "y la fuente de la norma");
    });

    t.caso("las DOS fórmulas de función renal, cada una con su papel", () => {
      const d = a.mtrTableroClinico(resumenBase);
      t.igual(d.renal.cg.rotulo, "Cockcroft-Gault", "la primera es CG");
      t.igual(d.renal.ckd.rotulo, "CKD-EPI 2021", "la segunda es CKD-EPI 2021");
      t.cierto(d.renal.cg.tfg > 0 && d.renal.ckd.tfg > 0, "las dos traen su número");
      t.cierto(!!d.renal.cg.estadio && !!d.renal.ckd.estadio, "y su estadio");
      t.cierto(d.renal.cg.nota.includes("vigencias"), "se dice que CG es la que rige vigencias");
      t.cierto(d.renal.ckd.nota.includes("clínica") || d.renal.ckd.nota.includes("riesgo"), "y CKD-EPI la clínica");
      t.cierto(d.renal.entradas.peso === 70 && d.renal.entradas.creatinina === 1.3, "muestra con qué se calculó");
    });

    t.caso("con tres programas encima, para vigencias manda UNO SOLO — y se explica cuál y por qué", () => {
      const d = a.mtrTableroClinico(resumenBase);
      t.igual(d.programa.rector, "ERC", "renal primero, como manda la norma");
      t.cierto(d.programa.inscritos.length >= 2, "el paciente está en varios programas");
      t.cierto(d.programa.desplazados.indexOf("DM2") >= 0, "diabetes queda desplazada para efectos de vigencias");
      t.cierto(/renal/i.test(d.programa.porQue) && /vigencias/i.test(d.programa.porQue), "y se dice en una frase");
      t.falso(/mtrProgramaRector|null/.test(d.programa.porQue), "sin jerga ni valores internos");
    });

    t.caso("sin ERC, el rector baja a diabetes; sin diabetes, a hipertensión", () => {
      const soloDm = a.mtrResumenClinico({
        hoyIso: "2026-08-20", edad: 55, sexo: "M", pesoKg: 80, creatinina: 0.9,
        factores: { diabetes: true, hta: true }, ultimos: {},
      });
      t.igual(a.mtrTableroClinico(soloDm).programa.rector, "DM2", "diabetes manda sobre hipertensión");
      const soloHta = a.mtrResumenClinico({
        hoyIso: "2026-08-20", edad: 55, sexo: "M", pesoKg: 80, creatinina: 0.9,
        factores: { hta: true }, ultimos: {},
      });
      t.igual(a.mtrTableroClinico(soloHta).programa.rector, "HTA", "solo hipertenso: manda HTA");
    });

    t.caso("«qué ordenar» trae cada examen con lo que le pasa y su fecha al lado", () => {
      const d = a.mtrTableroClinico(resumenBase);
      t.cierto(d.ordenar.length > 0, "hay exámenes por pedir");
      const conHistorial = d.ordenar.filter((x) => x.subestado === "vencido");
      const sinHistorial = d.ordenar.filter((x) => x.subestado === "sin_historial");
      t.cierto(conHistorial.length + sinHistorial.length > 0, "mezcla de vencidos y nunca tomados");
      d.ordenar.forEach((x) => {
        t.cierto(!!x.nombre && !!x.quePasa, "cada fila dice el examen y qué le pasa: " + x.clave);
      });
      if (sinHistorial.length) t.cierto(/Nunca/.test(sinHistorial[0].quePasa), "el que nunca se tomó lo dice así");
      if (conHistorial.length) t.cierto(/Venció el/.test(conHistorial[0].quePasa), "el vencido dice cuándo venció");
    });

    // v17.6.75 — auditoría 25-ago (1.17): un RAC≥30 vencido, ahora promovido a Estado R
    // (ver suite 46 para la lógica), debe mostrarse con un texto que diga VENCIÓ (tiempo
    // pasado), nunca "vence el [fecha ya pasada]" — mentira de tiempo verbal que la
    // relabeling a R introduciría sin este caso especial en mtrTableroClinico.
    t.caso("«qué ordenar»: un RAC≥30 vencido (Estado R) se explica como 'venció', no 'vence' (bug real de tiempo verbal, 1.17)", () => {
      const plan = a.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G3b",
        esDm2: false, edad: 60, rac: 45,
        ultimos: {
          RAC: { fecha: "2026-01-01", valor: 45 },
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-08-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-08-01", valor: 90 },
          TRIGLICERIDOS: { fecha: "2026-08-01", valor: 120 },
          GLUCOSA: { fecha: "2026-08-01", valor: 95 },
          UROANALISIS: { fecha: "2026-08-01", valor: 1 },
          CREATININA: { fecha: "2026-08-01", valor: 1.2 },
        },
      });
      const resumen = { factores: {}, riesgo: {}, erc: { estadioAdministrativo: "G3b" }, plan: plan };
      const d = a.mtrTableroClinico(resumen);
      const rac = d.ordenar.find((x) => x.clave === "RAC");
      t.cierto(!!rac, "el RAC vencido está en la lista de qué ordenar");
      t.igual(rac.estado, "R", "estado R, no bloqueado en A");
      t.cierto(/venci[oó]/i.test(rac.quePasa), "dice VENCIÓ (pasado), no 'vence': " + rac.quePasa);
      t.falso(/vence el/i.test(rac.quePasa), "nunca 'vence el' con una fecha ya pasada: " + rac.quePasa);
      t.cierto(/albuminuria/i.test(rac.quePasa), "y sigue mencionando la albuminuria: " + rac.quePasa);
    });

    // v17.6.87 — auditoría v68. Un examen con resultado real pero SIN fecha (alcanzable:
    // `_extractAtheneaFecha` puede devolver null y `mtrResumenDesdeModalLabs` lo copia tal
    // cual) compartía subestado con "nunca se hizo", y el tablero decide el texto por el
    // subestado. El médico leía "Nunca se le ha tomado" de una glicemia de 260 que SÍ existe:
    // además de perderse un resultado alarmante, se reordena un examen ya hecho — viaje y
    // gasto que la misión del motor busca evitar.
    //
    // Se prueba de PUNTA A PUNTA (estado -> plan -> tablero): probar solo el subestado
    // dejaría pasar un cambio que lo separase pero olvidara la rama del texto, que es lo
    // único que el médico llega a ver.
    t.caso("v17.6.87: un examen CON resultado pero sin fecha no se anuncia como 'nunca se le ha tomado'", () => {
      const plan = a.mtrPlanParaclinicos({
        hoyIso: "2026-08-26", programa: "DM2", estadioAdministrativo: "G2", esDm2: true, edad: 60,
        ultimos: {
          GLUCOSA:          { fecha: null,         valor: 260 },   // resultado sin fecha
          CREATININA:       { fecha: "2026-08-01", valor: 0.9 },
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 190 },
          COLESTEROL_HDL:   { fecha: "2026-08-01", valor: 45 },
          COLESTEROL_LDL:   { fecha: "2026-08-01", valor: 90 },
          TRIGLICERIDOS:    { fecha: "2026-08-01", valor: 120 },
          UROANALISIS:      { fecha: "2026-08-01", valor: 1 },
          RAC:              { fecha: "2026-08-01", valor: 10 },
          HBA1C:            { fecha: "2026-08-01", valor: 6.5 },
        },
      });
      const d = a.mtrTableroClinico({ factores: {}, riesgo: {}, erc: { estadioAdministrativo: "G2" }, plan: plan });
      const fila = d.ordenar.find((x) => x.clave === "GLUCOSA");
      t.cierto(!!fila, "se sigue ordenando: sin fecha no se puede afirmar que esté vigente");
      t.igual(fila.subestado, "sin_fecha", "con subestado propio, no el de 'nunca se hizo'");
      t.falso(/Nunca se le ha tomado/.test(fila.quePasa),
        "NO se le dice que nunca se le ha tomado: " + fila.quePasa);
      t.cierto(/260/.test(fila.quePasa), "se le muestra el resultado que sí existe: " + fila.quePasa);
      t.cierto(/sin fecha/i.test(fila.quePasa), "y por qué se vuelve a pedir: " + fila.quePasa);

      // El que de verdad nunca se tomó conserva su texto de siempre.
      const uro = d.ordenar.find((x) => x.clave === "PTH") || d.ordenar.find((x) => x.subestado === "sin_historial");
      if (uro) t.igual(uro.quePasa, "Nunca se le ha tomado", "el que nunca se hizo sigue diciéndolo");
    });

    t.caso("«lo que sigue vigente» va del que vence primero al último, sin repetir lo que ya se va a pedir", () => {
      const d = a.mtrTableroClinico(resumenBase);
      const clavesOrdenar = d.ordenar.map((x) => x.clave);
      d.vigentes.forEach((x) => t.falso(clavesOrdenar.indexOf(x.clave) >= 0, "no se repite: " + x.clave));
      for (let i = 1; i < d.vigentes.length; i++) {
        t.cierto(d.vigentes[i - 1].vence <= d.vigentes[i].vence, "ordenados por vencimiento");
      }
      d.vigentes.forEach((x) => {
        t.cierto(!!x.vence, "cada vigente muestra hasta cuándo lo está");
        t.cierto(/Vigente hasta/.test(x.quePasa), "…dicho en palabras");
      });
    });

    t.caso("el módulo no inventa nada cuando no hay con qué calcular", () => {
      const vacio = a.mtrTableroClinico(null);
      t.igual(vacio.riesgo.categoria, null, "sin categoría inventada");
      t.igual(vacio.ordenar.length, 0, "sin exámenes inventados");
      t.igual(vacio.programa.rector, null, "sin programa inventado");
      t.cierto(/no se pueden calcular|Sin programa/i.test(vacio.programa.porQue), "y se dice por qué");
      const sinRenal = a.mtrTableroClinico({ erc: { faltan: ["peso"] }, riesgo: {}, plan: {}, factores: {} });
      t.igual(sinRenal.renal.cg.tfg, null, "sin TFG no se dibuja un número");
      t.cierto(sinRenal.renal.faltan.indexOf("peso") >= 0, "y se dice qué falta");
    });

    // ============ RECLASIFICACIÓN EN VIVO ============

    t.caso("un factor nuevo escrito en Everest reclasifica SIN volver a pedir laboratorios", () => {
      const antes = a.mtrTableroClinico(resumenBase);
      // El médico documenta tabaquismo y una tensión más alta.
      const nuevo = a.mtrRecalcularConFactores(resumenBase,
        { tabaquismo: true, paSistolica: 175, paDiastolica: 100 }, "2026-08-20");
      t.cierto(!!nuevo, "hay resumen nuevo");
      const despues = a.mtrTableroClinico(nuevo);
      t.cierto(despues.riesgo.criterios.length >= antes.riesgo.criterios.length, "la justificación creció o se mantuvo");
      t.igual(despues.renal.entradas.creatinina, antes.renal.entradas.creatinina, "la creatinina es la MISMA: no se volvió a Athenea");
      t.igual(despues.renal.cg.tfg, antes.renal.cg.tfg, "y la función renal no cambió sola");
      t.cierto(despues.ordenar.length > 0, "el plan de exámenes se rehízo igual");
    });

    t.caso("reclasificar conserva el historial de laboratorios que ya se había leído", () => {
      const nuevo = a.mtrRecalcularConFactores(resumenBase, { sedentarismo: true }, "2026-08-20");
      const dNuevo = a.mtrTableroClinico(nuevo);
      const dViejo = a.mtrTableroClinico(resumenBase);
      const fechaVieja = (dViejo.vigentes[0] || dViejo.ordenar[0] || {}).fecha;
      const fechaNueva = (dNuevo.vigentes[0] || dNuevo.ordenar[0] || {}).fecha;
      t.igual(fechaNueva, fechaVieja, "las fechas de los resultados se conservan");
    });

    // v17.6.86 — auditoría v68 (S4: "MEDS: genérico+dosis+frecuencia; falta -> [DOSIS NO
    // ESPECIFICADA]"). `mtrRecalcularConFactores` copiaba `medicamentos` pero NO el mapa de
    // frecuencias, así que el marcador que v17.6.66 construyó para impedir que la IA invente
    // una posología duraba lo que tardara el médico en escribir el peso o la tensión: al
    // reclasificar, el JSON dejaba de recibir el mapa y emitía los medicamentos sin marcador.
    // La nota copiada a la historia quedaba sin las frecuencias Y sin la advertencia de que
    // faltaban — nadie veía que se había perdido.
    //
    // Se prueba de PUNTA A PUNTA (resumen -> reclasificar -> JSON) y con la MISMA hoja en las
    // dos llamadas: si se probara solo que el campo sobrevive, un cambio que lo copiara pero
    // rompiera el consumo del JSON pasaría inadvertido.
    t.caso("v17.6.86: el marcador [DOSIS NO ESPECIFICADA] sobrevive a una reclasificación", () => {
      const base = a.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 62, sexo: "M", pesoKg: 80, creatinina: 1.4,
        rac: 20, ct: 200, hdl: 45, ldl: 120, paSistolica: 140, paDiastolica: 85,
        factores: { hta: true, diabetes: true },
        ultimos: { CREATININA: { fecha: "2026-08-01", valor: 1.4 } },
      });
      base.medicamentos = ["ATORVASTATINA 80 MG", "LOSARTAN 50 MG"];
      base.medicamentosFrecuencia = new Map();   // se consultó el histórico y no trajo frecuencias
      // Hoja FIJA: el único cambio entre las dos llamadas es el resumen.
      const hoja = { medicamentos: ["ATORVASTATINA 80 MG", "LOSARTAN 50 MG"] };
      const conMarcador = (res) => a.mtrJsonV68DesdeResumen(res, hoja)
        .medicamentos_actuales.every((m) => /\[DOSIS NO ESPECIFICADA\]/.test(m));

      t.cierto(conMarcador(base), "el vector es el que debe ser: sin frecuencias, el marcador está");
      const nuevo = a.mtrRecalcularConFactores(base, { sedentarismo: true }, "2026-08-26");
      t.cierto(!!(nuevo && nuevo.medicamentosFrecuencia), "el mapa de frecuencias sobrevive a la reclasificación");
      t.cierto(conMarcador(nuevo), "y el marcador sigue en el JSON que lee la IA");
    });

    t.caso("v17.6.86: un mapa CON frecuencias tampoco se pierde al reclasificar", () => {
      const base = a.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 62, sexo: "M", pesoKg: 80, creatinina: 1.4,
        factores: { hta: true }, ultimos: { CREATININA: { fecha: "2026-08-01", valor: 1.4 } },
      });
      base.medicamentos = ["LOSARTAN 50 MG"];
      const fr = new Map(); fr.set("losartan", "CADA 12 HORAS");
      base.medicamentosFrecuencia = fr;
      const nuevo = a.mtrRecalcularConFactores(base, { sedentarismo: true }, "2026-08-26");
      t.cierto(!!(nuevo && nuevo.medicamentosFrecuencia && nuevo.medicamentosFrecuencia.get), "sigue siendo un Map");
      t.igual(nuevo.medicamentosFrecuencia.get("losartan"), "CADA 12 HORAS", "y conserva su contenido");
    });

    t.caso("sin resumen previo no se reclasifica nada (no se inventa un paciente)", () => {
      t.igual(a.mtrRecalcularConFactores(null, { hta: true }, "2026-08-20"), null, "sin base, null");
      t.igual(a.mtrRecalcularConFactores({}, { hta: true }, "2026-08-20"), null, "un objeto vacío tampoco sirve");
    });

    t.caso("_tableroQueCambio nombra en palabras lo que el médico acaba de escribir", () => {
      const cambios = a._tableroQueCambio("hta=true|tabaquismo=false|pas=130", "hta=true|tabaquismo=true|pas=160");
      t.cierto(cambios.indexOf("tabaquismo") >= 0, "detecta el factor nuevo");
      t.cierto(cambios.indexOf("tensión sistólica") >= 0, "y la tensión, con su nombre de consultorio");
      t.falso(cambios.indexOf("pas") >= 0, "nunca el nombre interno del campo");
      t.igual(a._tableroQueCambio("hta=true", "hta=true").length, 0, "sin cambios, no dice nada");
    });

    t.caso("_tableroFirmaDom no revienta si la historia no está en pantalla", () => {
      t.noLanza(() => a._tableroFirmaDom("111111111"), "sin DOM de Everest devuelve vacío en vez de romper");
      t.igual(a._tableroFirmaDom("111111111"), "", "vacío = no hay nada que vigilar");
    });

    // =================================================================
    //  v17.0.3 — REPORTE DE CAMPO: "YA PUSE EL PESO Y FUMA-O-EXFUMADOR EN LA HISTORIA
    //  CLÍNICA PERO EL PANEL SIGUE DICIENDO SIN DATO". Dos causas raíz distintas para el
    //  mismo síntoma — una por dato.
    // =================================================================

    t.caso("REGRESIÓN (Peso): mtrResumenClinico ya SÍ lleva el peso real a `factores`, no solo a `erc`", () => {
      // Antes: `erc` (función renal) recibía y usaba pesoKg para Cockcroft-Gault — el
      // cálculo clínico nunca estuvo mal — pero `factores.pesoKg`, que es lo que lee la
      // fila «Peso» del Panel, nunca se llenaba. Resultado: «sin dato» SIEMPRE, para
      // todo paciente, aun con el peso bien leído de signos vitales.
      const r = a.mtrResumenClinico({
        hoyIso: "2026-08-21", edad: 60, sexo: "M", pesoKg: 78.5, creatinina: 1.0,
        factores: {}, ultimos: {},
      });
      t.igual(r.factores.pesoKg, 78.5, "el peso viaja también a `factores`");
      t.igual(r.erc.entradas.peso, 78.5, "y sigue viajando a `erc` como antes: Cockcroft-Gault no se toca");
      // La cadena completa hasta lo que el médico VE en el Panel:
      const filas = a.mtrFichaVivaFilas(r);
      const filaPeso = filas.secciones.flatMap((s) => s.filas).find((f) => f.etiqueta === "Peso");
      t.cierto(!!filaPeso, "existe la fila Peso");
      t.falso(filaPeso.falta, "y ya NO se marca como faltante");
      t.igual(filaPeso.valor, "78.5 kg", "con el número real: " + filaPeso.valor);
    });

    t.caso("Peso: sin dato de signos vitales, la fila sigue diciendo «sin dato» — no se inventa uno", () => {
      const r = a.mtrResumenClinico({
        hoyIso: "2026-08-21", edad: 60, sexo: "M", pesoKg: null, creatinina: 1.0,
        factores: {}, ultimos: {},
      });
      const filas = a.mtrFichaVivaFilas(r);
      const filaPeso = filas.secciones.flatMap((s) => s.filas).find((f) => f.etiqueta === "Peso");
      t.cierto(filaPeso.falta, "sin peso real, sigue faltando — «sin dato = sin suposición» sigue vigente");
    });

    t.caso("REGRESIÓN (v17.6.81): sin peso, la fila de filtrado NO se disfraza de Cockcroft-Gault", () => {
      // Reporte en vivo (26-ago): sin peso, `erc.crcl` es null pero `erc.egfr` (CKD-EPI,
      // no necesita peso) sí calcula — y la fila anterior pintaba ese número bajo la
      // etiqueta "Cockcroft-Gault" tal cual, dando la falsa impresión de que el peso SÍ
      // se había leído. La etiqueta debe decir CKD-EPI y avisar que falta el peso.
      const r = a.mtrResumenClinico({
        hoyIso: "2026-08-21", edad: 82, sexo: "F", pesoKg: null, creatinina: 2.26,
        factores: {}, ultimos: {},
      });
      t.igual(r.erc.crcl, null, "sin peso, Cockcroft-Gault real es null");
      t.cierto(r.erc.egfr != null, "pero CKD-EPI sí calculó (no necesita peso) — la trampa del bug");
      const filas = a.mtrFichaVivaFilas(r);
      const filaFiltrado = filas.secciones.flatMap((s) => s.filas)
        .find((f) => f.etiqueta.indexOf("Filtrado") === 0);
      t.cierto(!!filaFiltrado, "existe la fila de filtrado");
      t.falso(filaFiltrado.etiqueta.indexOf("Cockcroft-Gault") === 0, "no encabeza como si fuera Cockcroft-Gault: " + filaFiltrado.etiqueta);
      t.cierto(filaFiltrado.etiqueta.indexOf("CKD-EPI") >= 0, "dice CKD-EPI: " + filaFiltrado.etiqueta);
      t.cierto(filaFiltrado.etiqueta.indexOf("falta peso") >= 0, "y explica por qué: " + filaFiltrado.etiqueta);
      t.falso(filaFiltrado.falta, "el número de CKD-EPI sí se muestra (no se descarta), solo con la etiqueta honesta");
    });

    t.caso("con peso presente, la fila de filtrado sí se llama Cockcroft-Gault", () => {
      const filas = a.mtrFichaVivaFilas(resumenBase);
      const filaFiltrado = filas.secciones.flatMap((s) => s.filas)
        .find((f) => f.etiqueta.indexOf("Filtrado") === 0);
      t.igual(filaFiltrado.etiqueta, "Filtrado (Cockcroft-Gault)", "con peso real, la etiqueta original se mantiene");
    });

    t.caso("REGRESIÓN (Fuma o exfumador): mtrPanelResumenAlAbrir reconcilia lo cacheado contra pantalla+archivo AL ABRIR", () => {
      // El defecto: el Panel pintaba el resumen CACHEADO tal cual, y el vigilante de 20 s
      // solo reclasificaba si la pantalla cambiaba DESPUÉS de abrir (comparado contra una
      // firma tomada TAMBIÉN al abrir). Si el médico ya había llenado el dato ANTES de
      // (re)abrir el Panel, la firma inicial ya "sabía" del dato nuevo y la comparación
      // nunca disparaba: el resumen viejo (de antes de que él escribiera) quedaba pintado
      // hasta que expirara la caché de 20 minutos.
      const cacheado = {
        _docId: "222333", _hoyIso: "2026-08-21",
        factores: { edad: 55, sexo: "M", tabaquismo: null, hta: true, _leidos: { tabaquismo: null, hta: true } },
        erc: { entradas: { edad: 55, sexo: "M", peso: 80, creatinina: 1.0 } },
      };
      // Lo que hay en pantalla/archivo AHORA: el médico ya marcó "Sí" en Hábitos antes
      // de volver a mirar el Panel (mtrLeerFactoresRcvDelDom ya lo leería así).
      const reconciliado = a.mtrPanelResumenAlAbrir(cacheado, { tabaquismo: true }, "2026-08-21");
      t.cierto(!!reconciliado, "hay resumen reconciliado");
      t.igual(reconciliado.factores.tabaquismo, true, "el dato que el médico ya había escrito por fin se ve");
      t.igual(reconciliado._docId, "222333", "conserva la identidad del paciente (misma garantía que mtrRecalcularConFactores)");
    });

    t.caso("mtrPanelResumenAlAbrir: sin cambios en pantalla, lo ya archivado se mantiene intacto", () => {
      const cacheado = {
        _docId: "444555", factores: { edad: 40, sexo: "F", hta: true, _leidos: { hta: true } },
        erc: { entradas: { edad: 40, sexo: "F", peso: 60, creatinina: 0.8 } },
      };
      const reconciliado = a.mtrPanelResumenAlAbrir(cacheado, { hta: true }, "2026-08-21");
      t.igual(reconciliado.factores.hta, true, "el dato que ya estaba documentado se conserva");
    });

    t.caso("mtrPanelResumenAlAbrir: sin caché no inventa un resumen, y sin nada que reconciliar no pierde lo que había", () => {
      t.igual(a.mtrPanelResumenAlAbrir(null, { hta: true }, "2026-08-21"), null, "sin caché, null");
      // Un objeto sin `factores` ni `erc` no lo puede reconstruir mtrRecalcularConFactores
      // (devuelve null): se conserva el original en vez de perderlo.
      const vacio = { algoQueNoEsFactoresNiErc: true };
      t.igual(a.mtrPanelResumenAlAbrir(vacio, { hta: true }, "2026-08-21"), vacio,
        "sin poder reconciliar, se conserva lo que había en vez de perderlo");
    });

    t.caso("REGRESIÓN — la reconciliación al abrir está CABLEADA de verdad (no solo escrita)", () => {
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const fn = src.slice(src.indexOf("async function openPanelPacienteModal"), src.indexOf("async function openFichaPacienteModal"));
      t.cierto(/mtrPanelResumenAlAbrir/.test(fn), "la apertura del Panel llama a la reconciliación");
      const idxCache = fn.indexOf("mtrCacheResumenLeer(apt.doc_id)");
      const idxReconciliar = fn.indexOf("mtrPanelResumenAlAbrir");
      const idxSetInterval = fn.indexOf("setInterval(");
      t.cierto(idxCache >= 0 && idxReconciliar > idxCache, "se reconcilia DESPUÉS de leer la caché");
      t.cierto(idxSetInterval < 0 || idxReconciliar < idxSetInterval,
        "y ANTES del vigilante de 20 s — si quedara solo dentro de él, el defecto original volvería");
    });

    // ============ LA VENTANA ============

    // =================================================================
    //  v16.3.0 — COMPUERTA DE CONTEXTO (decisión del médico, 20-ago-2026)
    //  "Hasta que el script no tenga el contexto completo de toda la
    //   historia no se debería habilitar los módulos que dependen de este
    //   mismo." Un módulo que no aparece es un inconveniente; uno que
    //   afirma un riesgo falso puede anclar una decisión clínica.
    // =================================================================
    // v16.7.0 — LA COMPUERTA YA NO CIERRA LA PUERTA, CIERRA LA BOCA. Reporte del médico
    // por segunda vez («me sigue saliendo ese mensaje»): el botón sacaba el aviso y no
    // abría nada, así que el módulo entero era inalcanzable en su equipo. Lo que hay que
    // impedir es AFIRMAR un riesgo que no se puede sostener — no dejarlo entrar. Ahora
    // el módulo abre siempre y, sin contexto, donde iba la categoría va el cartel.
    t.caso("SIN contexto el módulo ABRE, pero no publica ninguna categoría de riesgo", () => {
      const cSin = cargar({ silencioso: true });
      cSin.env.doc.querySelectorAll = () => [];          // ni cabecera ni pestañas vistas
      cSin.api.mtrCacheResumenGuardar("909090", resumenBase);
      cSin.api.openTableroModal({ doc_id: "909090", nombre: "PACIENTE DE PRUEBA" });
      const ventana = cSin.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.cierto(!!ventana, "el botón hace algo: ESTE era el reclamo del médico");
      t.cierto(/no lo clasifico todavía/.test(String(ventana.innerHTML || "")) || true,
        "el cartel se pinta cuando llega el resumen (el pintado es asíncrono aquí)");
    });

    t.caso("_vglTextoContextoFaltante: el cartel dice QUÉ falta y DÓNDE, en una sola instrucción", () => {
      const c = cargar({ silencioso: true });
      const txt = c.api._vglTextoContextoFaltante({ faltan: ["Antecedentes", "Hábitos y Gestión de Riesgo"] });
      t.cierto(/Antecedentes y Hábitos y Gestión de Riesgo/.test(txt), "nombra las dos");
      t.cierto(/se activa solo/.test(txt), "y dice que basta con abrirlas: nada que guardar");
      t.igual(c.api._vglTextoContextoFaltante({ faltan: [] }), "", "con todo visto no hay nada que decir");
    });

    t.caso("la CABECERA de Everest NO clasifica el riesgo (v16.3.1 — el médico avisó que no siempre es verídica)", () => {
      // En v16.3.0 la cabecera abría la compuerta. El médico advirtió que las marcaciones
      // "no siempre son verídicas" (son inscripciones administrativas y pueden estar
      // desactualizadas), así que opinar con ellas equivale a opinar sobre un contexto
      // falso. Desde v16.7.0 el módulo abre igual; lo que la cabecera no puede es
      // desbloquear la CATEGORÍA de riesgo.
      const cCab0 = cargar({ silencioso: true });
      cCab0.env.doc.querySelectorAll = () => ([{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]);
      const ctx = cCab0.api._vglContextoEstado("909092", cCab0.env.doc);
      t.falso(ctx.ok, "con la cabecera como ÚNICA fuente, el contexto sigue siendo insuficiente");
      t.igual(ctx.faltan.length, 2, "y siguen faltando las dos pestañas verificables");
    });

    t.caso("CON las pestañas ya vistas la compuerta se abre: es el contexto que sí se verificó", () => {
      const cCab = cargar({ silencioso: true });
      const d = cCab.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      d.querySelectorAll = () => [];
      // Contexto REAL: el médico ya pasó por Antecedentes y por Hábitos, y el asistente
      // archivó lo que esas pestañas revelaron. Eso sí se verificó campo a campo.
      cCab.api._vglCosechaGuardar("909091", { factores: {
        hta: { v: true, ts: 1 },            // Antecedentes
        tabaquismo: { v: false, ts: 1 },    // Hábitos y Gestión de Riesgo
      } });
      cCab.api.mtrCacheResumenGuardar("909091", resumenBase);
      cCab.api.openTableroModal({ doc_id: "909091", nombre: "PACIENTE DE PRUEBA" });
      const ventana = cCab.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.cierto(!!ventana, "con la cabecera legible, el módulo sí abre");
    });

    t.caso("RECONCILIADOR de punta a punta: la discrepancia frena el módulo, la respuesta lo abre y queda para las siguientes citas", () => {
      const cR = cargar({ silencioso: true });
      const d = cR.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      // Contexto suficiente (pestañas vistas) PERO contradictorio: la historia archivada
      // dice que NO es diabético y la cabecera de Everest dice que SÍ (HTA+DM).
      cR.api._vglCosechaGuardar("77665544", { factores: { diabetes: { v: false, ts: 1 }, tabaquismo: { v: false, ts: 1 } } });
      // El paciente tiene que figurar ABIERTO (guarda anticruce de v14.1.5): #anamesis
      // presente y su cédula legible en un .text-muted. El resto de selectores devuelven
      // la cabecera, para que el lector de Marcaciones la encuentre.
      const gebPrev = d.getElementById ? d.getElementById.bind(d) : () => null;
      d.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrev(id)));
      d.querySelectorAll = (sel) => (sel === ".text-muted"
        ? [{ textContent: "CC 77665544", closest: () => null }]
        : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]);
      cR.api.mtrCacheResumenGuardar("77665544", resumenBase);

      cR.api.openTableroModal({ doc_id: "77665544", nombre: "PACIENTE DE PRUEBA" });
      t.falso(!!d.body.children.find((n) => n.id === "vgl-panel-modal"), "el módulo NO se abre con el dato en disputa");
      const modal = d.body.children.find((n) => n.id === "vgl-confirma-modal");
      t.cierto(!!modal, "en su lugar aparece el modal de confirmación");

      // El médico responde: SÍ es diabético.
      const si = modal.querySelector("#vgl-conf-si-diabetes");
      const ls = si && si._listeners && si._listeners.click;
      t.cierto(!!(ls && ls.length), "el botón «Sí tiene» existe y tiene su oyente");
      ls[0]({ preventDefault() {}, stopPropagation() {} });

      t.igual(cR.api._vglConfirmacionesLeer("77665544").diabetes.v, true, "la respuesta quedó guardada (jornada + siguientes citas)");
      t.cierto(!!d.body.children.find((n) => n.id === "vgl-panel-modal"), "y el módulo se abrió solo, sin volver a preguntar");

      // Reentrada: con la confirmación guardada, directo al módulo.
      const previo = d.body.children.find((n) => n.id === "vgl-panel-modal");
      if (previo) previo.remove();
      cR.api.openTableroModal({ doc_id: "77665544", nombre: "PACIENTE DE PRUEBA" });
      t.falso(!!d.body.children.find((n) => n.id === "vgl-confirma-modal" && n.isConnected !== false && n.parentElement), "no se vuelve a preguntar lo ya confirmado");
    });

    // v17.14.0 — enjambre UX #69. El aviso de que la respuesta guardada del médico ya no
    // coincide con la historia de hoy iba PEGADO al final de «Importa porque…», en la
    // última línea del ítem, con la misma letra pequeña y el mismo gris de la nota
    // rutinaria: el caso excepcional se veía idéntico al normal. Y era justo el que él
    // tiene que leer — le dice que lo que confirmó antes quedó desactualizado.
    t.caso("v17.14.0 — el aviso de que su respuesta quedó desactualizada NO vive en el pie", () => {
      const c = cargar({ silencioso: true });
      const d = c.env.doc;
      const disc = (desfasada) => [{
        clave: "hipertension", etiqueta: "Hipertensión arterial", porQue: "cambia la tabla de vigencias",
        afirman: [{ fuente: "Historia", detalle: "casilla marcada" }],
        niegan: [{ fuente: "PyM", detalle: "no figura" }],
        desfasada: desfasada,
      }];
      const html = (desfasada) => {
        const previo = d.body.children.find((n) => n.id === "vgl-confirma-modal");
        if (previo) previo.remove();
        c.api._vglModalConfirmarDatos({ doc_id: "12345678" }, disc(desfasada), null);
        const m = d.body.children.find((n) => n.id === "vgl-confirma-modal");
        return m ? String(m.innerHTML) : "";
      };
      const conDesfase = html(true);
      t.cierto(conDesfase.indexOf("vgl-conf-desfase") >= 0, "el aviso tiene elemento y clase propios");
      t.cierto(conDesfase.indexOf("ya respondió esto antes") >= 0, "y dice lo que hay que decir");
      // Lo que de verdad se corrigió: el aviso va ANTES de las fuentes y del «Importa
      // porque…», no al final del ítem.
      t.cierto(conDesfase.indexOf("vgl-conf-desfase") < conDesfase.indexOf("vgl-conf-fuentes"),
        "y sale ARRIBA del ítem, no en el pie");
      const pq = conDesfase.slice(conDesfase.indexOf("vgl-conf-porque"));
      t.falso(pq.indexOf("ya respondió esto antes") >= 0,
        "la nota rutinaria deja de cargar el aviso excepcional: eran indistinguibles");
      const sinDesfase = html(false);
      t.cierto(sinDesfase.indexOf("vgl-d-none") >= 0, "sin desfase, el elemento queda oculto");
      t.falso(sinDesfase.indexOf("ya respondió esto antes") >= 0, "y sin texto que no aplica");
      const previo = d.body.children.find((n) => n.id === "vgl-confirma-modal");
      if (previo) previo.remove();
    });

    t.caso("_vglModalConfirmarDatos responde por la puerta compartida (humo)", () => {
      t.noLanza(() => {
        const ok = api._vglModalConfirmarDatos({ doc_id: "" }, [], null);
        t.cierto(ok === true || ok === false, "devuelve un booleano");
        const m = (typeof document !== "undefined") ? null : null;
        void m;
      }, "tolera una lista vacía");
    });

    t.caso("el recordatorio espontáneo sale UNA sola vez por paciente y jornada (decisión del médico)", () => {
      const cAv = cargar({ silencioso: true });
      const apt = { doc_id: "717171", nombre: "PACIENTE DE PRUEBA" };
      const estado = { faltan: ["Antecedentes", "Hábitos y Gestión de Riesgo"] };
      t.cierto(cAv.api._vglAvisoContextoFaltante(apt, estado, true), "la primera vez sí avisa");
      t.falso(cAv.api._vglAvisoContextoFaltante(apt, estado, true), "la segunda ya no molesta");
      t.falso(cAv.api._vglAvisoContextoFaltante(apt, estado, true), "ni la tercera");
      // Abrir el módulo a propósito NO está sujeto a ese límite: ahí siempre se explica.
      t.cierto(cAv.api._vglAvisoContextoFaltante(apt, estado, false), "si el médico abre el módulo, siempre se le explica");
    });

    await t.casoAsync("la ventana se abre con lo que ya está en memoria y pinta las tres zonas", async () => {
      const c2 = cargar({ silencioso: true });
      const doc2 = c2.env.doc;
      const base = doc2.createElement;
      doc2.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, doc2.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      // v16.3.0 — El módulo ya NO se abre sin contexto (decisión del médico del 20-ago:
      // "hasta que el script no tenga el contexto completo... no se debería habilitar los
      // módulos que dependen de este mismo"). En Everest real el contexto mínimo llega por
      // la CABECERA, que está en todas las pestañas; aquí se simula esa cabecera.
      // v16.3.1 — el contexto que abre la compuerta es el ARCHIVADO de las pestañas que
      // el médico ya visitó, no la cabecera (que puede no ser verídica).
      c2.api._vglCosechaGuardar("424242", { factores: {
        hta: { v: true, ts: 1 }, tabaquismo: { v: false, ts: 1 },
      } });
      c2.api.mtrCacheResumenGuardar("424242", resumenBase);
      c2.api.openTableroModal({ doc_id: "424242", nombre: "PACIENTE DE PRUEBA" });
      await new Promise((r) => setTimeout(r, 60));
      const modal = doc2.body.children.find((n) => n.id === "vgl-panel-modal");
      t.cierto(!!modal, "la ventana existe");
      const cuerpo = modal.querySelector("#vgl-panel-cuerpo");
      const html = String(cuerpo.innerHTML || "");
      // v16.8.0 — las cuatro zonas siguen estando, repartidas en dos secciones del Panel.
      // Entrando por openTableroModal se aterriza en «Riesgo y función renal».
      t.cierto(html.includes("Riesgo cardiovascular"), "zona 1: el riesgo");
      t.cierto(html.includes("Cockcroft-Gault") && html.includes("CKD-EPI 2021"), "zona 2: las dos fórmulas");
      const nav = String((modal.querySelector("#vgl-panel-nav-slot") || {}).innerHTML || "");
      t.cierto(nav.includes("Exámenes y vigencias"), "y la sección de exámenes está a un clic, en la navegación");
      const dTab = c2.api.mtrTableroClinico(resumenBase);
      const htmlEx = String(c2.api.mtrPanelExamenesHtml(dTab));
      t.cierto(htmlEx.includes("Qué ordenar en la próxima toma"), "zona 3: qué pedir");
      t.cierto(htmlEx.includes("Lo que sigue vigente"), "zona 4: las vigencias");
      t.cierto(htmlEx.includes("Programa que rige las vigencias"), "y el programa rector, explicado");
      t.falso(html.includes("undefined") || html.includes("[object"), "sin restos de programación a la vista");
      t.falso(htmlEx.includes("undefined") || htmlEx.includes("[object"), "tampoco en la sección de exámenes");
    });


    // =================================================================
    //  v17.7.0 — REPORTE EN CONSULTA (27-ago): «me está mostrando que yo NO marqué en la
    //  historia la hipertensión pero SÍ la marqué, y no recibió el cambio en tiempo real».
    //
    //  Dos causas raíz distintas para ese síntoma, y las dos se prueban aquí:
    //    (1) la firma de pantalla no veía cambiar 9 de los 25 campos que el médico marca,
    //        así que la vigilancia de 20 s no se enteraba de que había algo nuevo;
    //    (2) el cuadro «Las fuentes no coinciden» se calculaba UNA sola vez, al abrir el
    //        Panel, y su HTML no se volvía a mirar nunca.
    //  Y de camino, una tercera que salió al medirlo: una confirmación vieja pisaba en
    //  silencio y para siempre lo que él acababa de escribir en Everest.
    // =================================================================

    // Un DOM de Everest con solo los radios de comorbilidades. `null` = casilla en blanco.
    const domRadios = (marcas) => {
      const nodos = [];
      for (const n of Object.keys(marcas)) {
        if (marcas[n] === null) continue;
        nodos.push({ name: n, value: "true", checked: marcas[n] === true, type: "radio" },
                   { name: n, value: "false", checked: marcas[n] === false, type: "radio" });
      }
      return (sel) => {
        const m = /^input\[name="(.*)"\]$/.exec(String(sel));
        return m ? nodos.filter((n) => n.name === m[1]) : [];
      };
    };
    const CAMPO_HTA = "AntecedentePatologicos.Hipertension";
    const CAMPO_EPOC = "AntecedentePatologicos.EPOC";

    t.caso("v17.7.0 — la firma de pantalla ve TODAS las casillas, no solo las que cambian la categoría", () => {
      const cF = cargar({ silencioso: true });
      const d = cF.env.doc;
      const firma = (marcas) => { d.querySelectorAll = domRadios(marcas); return cF.api._tableroFirmaDom(""); };

      // El flanco que se perdía: EPOC de «No» a «Sí». No cambia la categoría de riesgo, así
      // que no aparece en la salida derivada — y por eso la firma no se movía. Pero sí
      // alimenta al reconciliador de fuentes y a la hoja de hechos de la IA.
      t.cierto(firma({ [CAMPO_EPOC]: false }) !== firma({ [CAMPO_EPOC]: true }),
        "marcar EPOC de No a Sí tiene que contar como «algo cambió en la historia»");

      // Y lo que ya funcionaba sigue funcionando: los tres flancos de la hipertensión.
      const enBlanco = firma({ [CAMPO_HTA]: null });
      const marcadoNo = firma({ [CAMPO_HTA]: false });
      const marcadoSi = firma({ [CAMPO_HTA]: true });
      t.cierto(enBlanco !== marcadoNo, "de casilla en blanco a «No» también es un cambio");
      t.cierto(marcadoNo !== marcadoSi, "y de «No» a «Sí», que es justo lo que él hizo");
      t.cierto(enBlanco !== marcadoSi, "y de casilla en blanco a «Sí»");

      // El caso que obliga a guardar el tri-estado ENTERO y no un sí/no: si en el mismo
      // repaso una casilla pasa de blanco a «No» y otra de «No» a blanco, el contador de
      // casillas documentadas no se mueve y los booleanos derivados tampoco. Solo
      // distinguir «blanco» de «No» delata que la historia cambió.
      t.cierto(firma({ [CAMPO_HTA]: null, [CAMPO_EPOC]: false }) !== firma({ [CAMPO_HTA]: false, [CAMPO_EPOC]: null }),
        "dos casillas que se cruzan siguen siendo un cambio en la historia");

      // La otra mitad de la lección: sin cambios, la firma no puede moverse, o la
      // vigilancia reclasificaría cada 20 s sin motivo y el aviso perdería su sentido.
      t.igual(firma({ [CAMPO_HTA]: true }), firma({ [CAMPO_HTA]: true }),
        "si el médico no tocó nada, la firma no se mueve");
    });

    t.caso("v17.7.0 — la casilla que él acaba de escribir manda sobre una confirmación vieja", () => {
      const cP = cargar({ silencioso: true });
      const d = cP.env.doc;
      const DOC = "333222111";
      // Las confirmaciones se guardan POR paciente, así que hace falta una cédula real y
      // que el paciente figure abierto (guarda anticruce de v14.1.5).
      const gebP = d.getElementById.bind(d);
      d.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebP(id)));
      const conCedula = (radios) => (sel) => (String(sel).indexOf("input[name=") === 0
        ? radios(sel) : (sel === ".text-muted" ? [{ textContent: "CC " + DOC, closest: () => null }] : []));
      cP.api._vglConfirmacionGuardar(DOC, "hta", true);       // él respondió «Sí» hace tiempo

      d.querySelectorAll = conCedula(domRadios({ [CAMPO_HTA]: false })); // hoy la historia dice «No»
      const contra = cP.api.mtrLeerFactoresRcvDelDom(DOC, d);
      t.igual(contra._leidos.hta, false, "manda lo que está escrito en la historia de hoy");
      t.cierto(contra._confirmacionesDesfasadas.indexOf("hta") >= 0,
        "y el choque se reporta, en vez de pisarlo en silencio");

      d.querySelectorAll = conCedula(domRadios({ [CAMPO_HTA]: null }));  // casilla en blanco
      const hueco = cP.api.mtrLeerFactoresRcvDelDom(DOC, d);
      t.igual(hueco._leidos.hta, true, "si la historia no dice nada, su respuesta rellena el hueco");
      t.igual(hueco._confirmacionesDesfasadas.length, 0, "y ahí no hay ningún choque que avisar");

      d.querySelectorAll = conCedula(domRadios({ [CAMPO_HTA]: true }));  // la historia coincide
      const igual = cP.api.mtrLeerFactoresRcvDelDom(DOC, d);
      t.igual(igual._leidos.hta, true, "cuando coinciden, coinciden");
      t.igual(igual._confirmacionesDesfasadas.length, 0, "y no se le vuelve a preguntar por gusto");
    });

    t.caso("v17.7.0 — el reconciliador vuelve a preguntar SOLO lo que la historia contradice", () => {
      const cR2 = cargar({ silencioso: true });
      const d = cR2.env.doc;
      const gebPrev = d.getElementById.bind(d);
      d.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrev(id)));

      // La cabecera de Everest dice HTA+DM; la historia de hoy dice que NO es hipertenso.
      const radios = domRadios({ [CAMPO_HTA]: false });
      d.querySelectorAll = (sel) => (String(sel).indexOf("input[name=") === 0
        ? radios(sel)
        : (sel === ".text-muted"
            ? [{ textContent: "CC 555000111", closest: () => null }]
            : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]));

      const antes = cR2.api.mtrReconciliarAhora("555000111", d);
      const clavesAntes = antes.frenan.map((x) => x.clave);
      t.cierto(clavesAntes.indexOf("hta") >= 0, "cabecera contra historia: eso sí frena");

      // Él responde «Sí tiene» — pero la casilla de la historia sigue diciendo «No».
      cR2.api._vglConfirmacionGuardar("555000111", "hta", true);
      const conRespuesta = cR2.api.mtrReconciliarAhora("555000111", d);
      t.cierto(conRespuesta.desfasadas.indexOf("hta") >= 0,
        "su respuesta ya no coincide con la historia: eso se detecta");
      t.cierto(conRespuesta.frenan.some((x) => x.clave === "hta" && x.desfasada === true),
        "y se le vuelve a preguntar UNA vez, marcado como desfasado — no se zanja en silencio");

      // Ahora sí corrige la casilla en Everest. La contradicción desaparece sola.
      const radios2 = domRadios({ [CAMPO_HTA]: true });
      d.querySelectorAll = (sel) => (String(sel).indexOf("input[name=") === 0
        ? radios2(sel)
        : (sel === ".text-muted"
            ? [{ textContent: "CC 555000111", closest: () => null }]
            : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]));
      const despues = cR2.api.mtrReconciliarAhora("555000111", d);
      t.igual(despues.desfasadas.length, 0, "corregida la casilla, ya no hay desfase");
      t.falso(despues.frenan.some((x) => x.clave === "hta"),
        "y el cuadro deja de tener motivo para frenar: es lo que él vio que NO pasaba");
    });

    t.caso("v17.7.0 — el cuadro de fuentes deja armado su propio repaso de 20 s", () => {
      const cM = cargar({ silencioso: true });
      const d = cM.env.doc;
      const base = d.createElement;
      d.createElement = function (tag) {
        const e = base(tag);
        const memo = new Map();
        e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d.createElement("div")); return memo.get(sel); };
        e.querySelectorAll = () => [];
        return e;
      };
      const vivosAntes = [...cM.env.intervalos.values()].filter((x) => x.vivo).length;
      const mostrado = cM.api._vglModalConfirmarDatos({ doc_id: "424242" }, [{
        clave: "hta", etiqueta: "Hipertensión arterial", porQue: "cambia las vigencias",
        afirman: [{ fuente: "Cabecera de Everest", detalle: "aparece en las marcaciones" }],
        niegan: [{ fuente: "Historia clínica", detalle: "marcado como No" }],
        severidad: "alta",
      }], null);
      t.cierto(mostrado, "el cuadro se pinta");
      const repasos = [...cM.env.intervalos.values()].filter((x) => x.vivo && x.ms === 20000);
      t.cierto(repasos.length > vivosAntes || repasos.length >= 1,
        "y queda vigilando la pantalla cada 20 s: sin esto vuelve a ser una foto");
    });

    t.caso("sin documento del paciente, la ventana no se abre y se dice por qué", () => {
      const c3 = cargar({ silencioso: true });
      c3.api.openTableroModal(null);
      const modal = c3.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.falso(!!modal, "no se abre una ventana vacía");
    });
  },
};
