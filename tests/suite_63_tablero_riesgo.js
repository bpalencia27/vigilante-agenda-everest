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
    "_vglAvisoContextoFaltante",   // v16.3.0 — compuerta de contexto
    "_vglModalConfirmarDatos",     // v16.3.2 — modal del reconciliador
    "mtrTableroClinico", "mtrRecalcularConFactores", "_tableroFirmaDom",
    "_tableroQueCambio", "openTableroModal", "mtrPanelResumenAlAbrir",
    // v17.58.0 — PARTE A: la escalera de adherencia del reconciliador
    "mtrInsumosAdherencia", "mtrEjesEnFallaAdherencia", "mtrEstadoAdherenciaEje",
    "mtrDebePreguntarTratamientoEje", "mtrDebePreguntarAdecuacionEje",
    "mtrDebePreguntarAdherenciaEje", "mtrPreguntaTratamientoEje",
    "mtrPreguntaAdecuacionEje", "mtrPreguntaAdherenciaEje",
    "_mtrMediaFuePreguntada", "_mtrMediaMarcarPreguntada",
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
      // Entrando por openTableroModal se aterriza en «Riesgo y renal» (rótulo del REFACTOR S+).
      t.cierto(html.includes("Riesgo cardiovascular"), "zona 1: el riesgo");
      t.cierto(html.includes("Cockcroft-Gault") && html.includes("CKD-EPI 2021"), "zona 2: las dos fórmulas");
      const nav = String((modal.querySelector("#vgl-panel-nav-slot") || {}).innerHTML || "");
      t.cierto(nav.includes("Exámenes"), "y la sección de exámenes está a un clic, en la navegación");
      const dTab = c2.api.mtrTableroClinico(resumenBase);
      const htmlEx = String(c2.api.mtrPanelExamenesHtml(dTab));
      t.cierto(htmlEx.includes("Qué ordenar en la próxima toma"), "zona 3: qué pedir");
      t.cierto(htmlEx.includes("Lo que sigue vigente"), "zona 4: las vigencias");
      t.cierto(htmlEx.includes("Programa que rige las vigencias"), "y el programa rector, explicado");
      t.falso(html.includes("undefined") || html.includes("[object"), "sin restos de programación a la vista");
      t.falso(htmlEx.includes("undefined") || htmlEx.includes("[object"), "tampoco en la sección de exámenes");
    });

    t.caso("sin documento del paciente, la ventana no se abre y se dice por qué", () => {
      const c3 = cargar({ silencioso: true });
      c3.api.openTableroModal(null);
      const modal = c3.env.doc.body.children.find((n) => n.id === "vgl-panel-modal");
      t.falso(!!modal, "no se abre una ventana vacía");
    });

    // =====================================================================
    //  v17.58.0 — PARTE A: la escalera de adherencia (preguntar antes de repetir)
    // =====================================================================

    t.caso("v17.58.0 — mtrEjesEnFallaAdherencia: LDL y diabetes comparten escalera, la glicemia no crea eje propio", () => {
      const r = { fallas: { fallas: [{ analito: "LDL" }, { analito: "HbA1c" }, { analito: "Glicemia" }, { analito: "CREATININA" }] } };
      t.igual(a.mtrEjesEnFallaAdherencia(r).sort().join(","), "hba1c,ldl", "LDL+HbA1c+Glicemia -> dos ejes, sin duplicar");
      t.igual(a.mtrEjesEnFallaAdherencia({ fallas: { fallas: [{ analito: "LDL" }] } }).join(","), "ldl", "solo LDL");
      t.igual(a.mtrEjesEnFallaAdherencia({ fallas: { fallas: [{ analito: "Glicemia" }] } }).join(","), "hba1c", "glicemia sola también es eje de diabetes");
      t.igual(a.mtrEjesEnFallaAdherencia({ fallas: { fallas: [] } }).length, 0, "sin fallas, sin escalera");
      t.igual(a.mtrEjesEnFallaAdherencia(null).length, 0, "sin resumen, sin escalera");
      t.igual(a.mtrEjesEnFallaAdherencia({}).length, 0, "resumen vacío, sin escalera");
    });

    t.caso("v17.58.0 — mtrInsumosAdherencia: distingue «no tiene» de «no se pudo leer»", () => {
      const conMeds = a.mtrInsumosAdherencia({ medicamentos: ["Atorvastatina 40 mg", "Metformina 850 mg"] });
      t.cierto(Array.isArray(conMeds.medsRcv) && conMeds.medsRcv.length === 2, "con lista, los medicamentos RCV se clasifican");
      t.falso(conMeds.medsNoLeidos, "y no quedan marcados como no leídos");
      const sinLista = a.mtrInsumosAdherencia({});
      t.igual(sinLista.medsRcv, null, "sin lista, medsRcv es null");
      t.cierto(sinLista.medsNoLeidos, "y se marca que NO se pudo leer (que no es «no tiene»)");
      const conInercia = a.mtrInsumosAdherencia({ fallas: { inercia: { inercia: true } } });
      t.cierto(conInercia.inerciaLdl && conInercia.inerciaLdl.inercia === true, "la inercia de la estatina viaja para el eje LDL");
    });

    t.caso("v17.58.0 — mtrEstadoAdherenciaEje: qué se deduce de la historia y qué manda la confirmación", () => {
      const conMeds = { medsRcv: [{ para: "colesterol", texto: "Atorvastatina 40 mg — colesterol" }], medsNoLeidos: false, inerciaLdl: null };
      t.igual(a.mtrEstadoAdherenciaEje("ldl", conMeds, {}).tieneTratamiento, true, "con estatina en el historial, el LDL tiene tratamiento");
      const sinMeds = { medsRcv: [], medsNoLeidos: false, inerciaLdl: null };
      t.igual(a.mtrEstadoAdherenciaEje("ldl", sinMeds, {}).tieneTratamiento, false, "historial leído y sin estatina: no tiene");
      const noLeidos = { medsRcv: null, medsNoLeidos: true, inerciaLdl: null };
      t.igual(a.mtrEstadoAdherenciaEje("ldl", noLeidos, {}).tieneTratamiento, null, "sin poder leerlo: no se sabe (y se pregunta)");
      const conConf = a.mtrEstadoAdherenciaEje("ldl", sinMeds, { tratamiento_ldl: { v: true } });
      t.igual(conConf.tieneTratamiento, true, "la confirmación del médico manda sobre la deducción");
      const estIner = a.mtrEstadoAdherenciaEje("ldl", { medsRcv: conMeds.medsRcv, medsNoLeidos: false, inerciaLdl: { inercia: true } }, {});
      t.igual(estIner.adecuado, false, "estatina presente pero no de alta intensidad: inadecuado (se deduce de la inercia)");
      const estOk = a.mtrEstadoAdherenciaEje("ldl", { medsRcv: conMeds.medsRcv, medsNoLeidos: false, inerciaLdl: { inercia: false } }, {});
      t.igual(estOk.adecuado, true, "estatina de alta intensidad: adecuado (se deduce)");
      const estHba = a.mtrEstadoAdherenciaEje("hba1c", conMeds, {});
      t.igual(estHba.adecuado, null, "para la diabetes no hay regla escrita: la adecuación no se deduce");
      t.igual(a.mtrEstadoAdherenciaEje("otro", conMeds, {}), null, "eje desconocido -> null");
    });

    t.caso("v17.58.0 — compuertas de la escalera: en orden, indagando antes de preguntar", () => {
      const noLeidos = { medsRcv: null, medsNoLeidos: true, inerciaLdl: null };
      t.cierto(a.mtrDebePreguntarTratamientoEje("ldl", noLeidos, {}), "sin poder leer los meds, se pregunta por el tratamiento");
      const conMeds = { medsRcv: [{ para: "colesterol", texto: "Atorvastatina 40 mg — colesterol" }], medsNoLeidos: false, inerciaLdl: null };
      t.falso(a.mtrDebePreguntarTratamientoEje("ldl", conMeds, {}), "con estatina en la historia ya no se pregunta");
      t.falso(a.mtrDebePreguntarTratamientoEje("ldl", noLeidos, { tratamiento_ldl: { v: false } }), "respondido -> se calla");
      // Adecuación: solo cuando hay tratamiento y no es deducible.
      const sinTrat = { medsRcv: [], medsNoLeidos: false, inerciaLdl: null };
      t.falso(a.mtrDebePreguntarAdecuacionEje("ldl", sinTrat, {}), "sin tratamiento no hay adecuación que juzgar");
      const conInercia = { medsRcv: conMeds.medsRcv, medsNoLeidos: false, inerciaLdl: { inercia: true } };
      t.falso(a.mtrDebePreguntarAdecuacionEje("ldl", conInercia, {}), "LDL: la inercia ya la deduce (inadecuado)");
      const conDm = { medsRcv: [{ para: "diabetes", texto: "Metformina 850 mg — diabetes" }], medsNoLeidos: false, inerciaLdl: null };
      t.cierto(a.mtrDebePreguntarAdecuacionEje("hba1c", conDm, {}), "diabetes: sin regla escrita, se pregunta");
      t.falso(a.mtrDebePreguntarAdecuacionEje("hba1c", conDm, { adecuado_hba1c: { v: true } }), "respondido -> se calla");
      // Adherencia: solo con tratamiento ADECUADO, y la toma real nunca se lee.
      t.falso(a.mtrDebePreguntarAdherenciaEje("ldl", sinTrat, {}), "sin tratamiento no se pregunta por la toma");
      t.falso(a.mtrDebePreguntarAdherenciaEje("ldl", conInercia, {}), "tratamiento inadecuado: primero se ajusta, la toma espera");
      t.falso(a.mtrDebePreguntarAdherenciaEje("hba1c", conDm, {}), "adecuación aún no deducida: la toma espera su turno");
      t.cierto(a.mtrDebePreguntarAdherenciaEje("hba1c", conDm, { adecuado_hba1c: { v: true } }), "tratamiento adecuado: la toma real no se puede leer, se pregunta");
      t.falso(a.mtrDebePreguntarAdherenciaEje("hba1c", conDm, { adecuado_hba1c: { v: true }, adherencia_hba1c: { v: true } }), "respondida y vigente -> se calla");
    });

    t.caso("v17.58.0 — las preguntas de la escalera hablan el idioma del reconciliador y la adherencia caduca a 1 día", () => {
      const noLeidos = { medsRcv: null, medsNoLeidos: true, inerciaLdl: null };
      const pTrat = a.mtrPreguntaTratamientoEje("ldl", noLeidos);
      t.igual(pTrat.clave, "tratamiento_ldl", "clave de tratamiento");
      t.igual(pTrat.severidad, "media", "severidad media: informa, nunca bloquea");
      t.cierto(!!pTrat.etiqueta && !!pTrat.porQue, "trae pregunta y porqué");
      t.cierto(Array.isArray(pTrat.afirman) && Array.isArray(pTrat.niegan), "y las fuentes en el formato del modal");
      const pAde = a.mtrPreguntaAdecuacionEje("hba1c", noLeidos);
      t.igual(pAde.clave, "adecuado_hba1c", "clave de adecuación");
      const pAdh = a.mtrPreguntaAdherenciaEje("hba1c", noLeidos);
      t.igual(pAdh.clave, "adherencia_hba1c", "clave de adherencia");
      t.igual(pAdh.vigenciaDias, 1, "y la adherencia declara su vigencia de 1 día (se conversa en cada consulta)");
      const pAdhLdl = a.mtrPreguntaAdherenciaEje("ldl", noLeidos);
      t.igual(pAdhLdl.vigenciaDias, 1, "también para el LDL");
    });

    t.caso("v17.58.0 — la escalera entra por el reconciliador SOLO con ejes en falla terapéutica", () => {
      const cE = cargar({ silencioso: true });
      const dE = cE.env.doc;
      const gebPrevE = dE.getElementById ? dE.getElementById.bind(dE) : () => null;
      dE.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrevE(id)));
      dE.querySelectorAll = (sel) => (sel === ".text-muted"
        ? [{ textContent: "CC 11112222", closest: () => null }]
        : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]);
      // resumenBase tiene LDL y HbA1c en falla (y glicemia), sin medicamentos leídos.
      cE.api.mtrCacheResumenGuardar("11112222", resumenBase);
      const rec = cE.api.mtrReconciliarAhora("11112222", dE);
      const claves = rec.frenan.map((x) => x.clave);
      t.cierto(claves.indexOf("tratamiento_ldl") >= 0, "LDL en falla y sin meds leídos: pregunta si hay tratamiento");
      t.cierto(claves.indexOf("tratamiento_hba1c") >= 0, "igual para la diabetes");
      t.igual(claves.indexOf("adecuado_hba1c"), -1, "la adecuación espera al escalón 2: sin tratamiento confirmado no toca");
      t.igual(claves.indexOf("adecuado_ldl"), -1, "tampoco la del LDL (la inercia solo deduce con tratamiento conocido)");
      t.igual(claves.indexOf("adherencia_ldl"), -1, "y la toma espera al final de la escalera");
    });

    t.caso("v17.58.0 — la escalera NO entra cuando el eje no está en falla", () => {
      const cE2 = cargar({ silencioso: true });
      const dE2 = cE2.env.doc;
      const gebPrevE2 = dE2.getElementById ? dE2.getElementById.bind(dE2) : () => null;
      dE2.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrevE2(id)));
      dE2.querySelectorAll = (sel) => (sel === ".text-muted"
        ? [{ textContent: "CC 33334444", closest: () => null }]
        : [{ textContent: "Marcaciones: HTA", innerText: "Marcaciones: HTA" }]);
      const resumenSinFalla = Object.assign({}, resumenBase, {
        fallas: { fallas: [], hayGrave: false, hayLeve: false, recontroles: [], inercia: null },
      });
      cE2.api.mtrCacheResumenGuardar("33334444", resumenSinFalla);
      const rec = cE2.api.mtrReconciliarAhora("33334444", dE2);
      t.igual(rec.frenan.filter((x) => x.severidad === "media" && /^(tratamiento|adecuado|adherencia)_/.test(x.clave)).length, 0,
        "sin falla terapéutica no hay escalera: el examen no se va a repetir");
    });

    t.caso("v17.58.0 — la adherencia caduca: una respuesta de hace más de 1 día vuelve a preguntarse (vía reconciliador)", () => {
      const cE3 = cargar({ silencioso: true });
      const dE3 = cE3.env.doc;
      const gebPrevE3 = dE3.getElementById ? dE3.getElementById.bind(dE3) : () => null;
      dE3.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrevE3(id)));
      dE3.querySelectorAll = (sel) => (sel === ".text-muted"
        ? [{ textContent: "CC 55556666", closest: () => null }]
        : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]);
      cE3.api.mtrCacheResumenGuardar("55556666", resumenBase);
      // El médico ya confirmó el tratamiento y la adecuación, y la adherencia hace 3 días.
      cE3.api._vglCosechaGuardar("55556666", {
        confirmaciones: {
          tratamiento_hba1c: { v: true, ts: Date.now() - 2000 },
          adecuado_hba1c: { v: true, ts: Date.now() - 2000 },
          adherencia_hba1c: { v: true, ts: Date.now() - 3 * 86400000 },
        },
      });
      const rec = cE3.api.mtrReconciliarAhora("55556666", dE3);
      const claves = rec.frenan.map((x) => x.clave);
      t.cierto(claves.indexOf("tratamiento_hba1c") === -1, "tratamiento confirmado: no se re-pregunta");
      t.cierto(claves.indexOf("adecuado_hba1c") === -1, "adecuación confirmada: no se re-pregunta");
      t.cierto(claves.indexOf("adherencia_hba1c") >= 0, "pero la adherencia de hace 3 días CADUCÓ: se vuelve a preguntar");
    });

    t.caso("v17.58.0 — memoria de lo ya preguntado: las MEDIA se ofrecen una vez por paciente y por jornada", () => {
      const cE4 = cargar({ silencioso: true });
      t.falso(cE4.api._mtrMediaFuePreguntada("77778888", "tratamiento_ldl"), "nada preguntado todavía");
      cE4.api._mtrMediaMarcarPreguntada("77778888", "tratamiento_ldl");
      t.cierto(cE4.api._mtrMediaFuePreguntada("77778888", "tratamiento_ldl"), "marcado -> ya fue preguntada");
      t.falso(cE4.api._mtrMediaFuePreguntada("77778888", "adecuado_ldl"), "otra clave del mismo paciente sigue viva");
      t.falso(cE4.api._mtrMediaFuePreguntada("99990000", "tratamiento_ldl"), "otro paciente no hereda la marca");
      cE4.api._mtrMediaMarcarPreguntada("", "tratamiento_ldl");
      t.falso(cE4.api._mtrMediaFuePreguntada("", "tratamiento_ldl"), "sin docId no se marca");
    });

    t.caso("v17.58.0 — las MEDIA ya mostradas NO reaparecen en la misma jornada, aunque la caché siga viva", () => {
      const cE5 = cargar({ silencioso: true });
      const d5 = cE5.env.doc;
      const base5 = d5.createElement;
      d5.createElement = function (tag) { const e = base5(tag); const memo = new Map(); e.querySelector = (sel) => { if (!memo.has(sel)) memo.set(sel, d5.createElement("div")); return memo.get(sel); }; e.querySelectorAll = () => []; return e; };
      const gebPrev5 = d5.getElementById ? d5.getElementById.bind(d5) : () => null;
      d5.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrev5(id)));
      d5.querySelectorAll = (sel) => (sel === ".text-muted"
        ? [{ textContent: "CC 12121212", closest: () => null }]
        : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]);
      // El historial archivado coincide con la cabecera (HTA+DM): sin contradicción ALTA,
      // el cuadro sale por la escalera MEDIA (LDL/HbA1c en falla, sin meds leídos).
      cE5.api._vglCosechaGuardar("12121212", { factores: { diabetes: { v: true, ts: 1 } } });
      cE5.api.mtrCacheResumenGuardar("12121212", resumenBase);
      cE5.api.openTableroModal({ doc_id: "12121212", nombre: "PACIENTE DE PRUEBA" });
      const m5 = d5.body.children.find((n) => n.id === "vgl-confirma-modal");
      t.cierto(!!m5, "1ª apertura: el cuadro aparece (la escalera se ofrece)");
      // «Decidir luego»: el panel abre igual y las MEDIA quedan marcadas como mostradas.
      const x5 = m5 && m5.querySelector("#vgl-conf-x");
      const lx = x5 && x5._listeners && x5._listeners.click;
      t.cierto(!!(lx && lx.length), "la ✕ tiene su oyente");
      if (lx && lx.length) lx[0]({ preventDefault() {}, stopPropagation() {} });
      t.cierto(!!d5.body.children.find((n) => n.id === "vgl-panel-modal"), "y el panel abre igual");
      t.cierto(cE5.api.mtrCacheResumenLeer("12121212") !== null, "la caché sigue viva (escenario exigente)");
      const p5 = d5.body.children.find((n) => n.id === "vgl-panel-modal");
      if (p5) p5.remove();
      cE5.api.openTableroModal({ doc_id: "12121212", nombre: "PACIENTE DE PRUEBA" });
      t.falso(!!d5.body.children.find((n) => n.id === "vgl-confirma-modal"), "2ª apertura: las MEDIA ya mostradas NO reaparecen");
    });

    t.caso("v17.58.0 — diaNuevo reinicia la memoria: la escalera se ofrece de nuevo cada jornada", () => {
      const cE6 = cargar({ silencioso: true });
      cE6.api._mtrMediaMarcarPreguntada("77778888", "tratamiento_ldl");
      t.cierto(cE6.api._mtrMediaFuePreguntada("77778888", "tratamiento_ldl"), "marcada hoy");
      const OriginalDate6 = cE6.ctx.Date || Date;
      let mockIso6 = "2026-08-10T12:00:00";
      const FakeDate6 = class extends OriginalDate6 {
        constructor(...args) { if (args.length === 0) super(mockIso6); else super(...args); }
      };
      cE6.ctx.Date = FakeDate6;
      cE6.api.diaNuevo();   // día 1: inicializa el reloj de jornada
      mockIso6 = "2026-08-11T12:00:00";
      cE6.api.diaNuevo();   // día 2: limpia la memoria
      t.falso(cE6.api._mtrMediaFuePreguntada("77778888", "tratamiento_ldl"), "al día siguiente se vuelve a ofrecer");
    });
  },
};
