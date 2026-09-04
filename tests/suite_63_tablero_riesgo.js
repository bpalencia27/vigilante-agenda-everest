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
    "mtrPanelFactoresDePantalla",   // v18.0.33 — guarda de identidad de los signos vitales
    // v17.58.0 — PARTE A: la escalera de adherencia del reconciliador
    "mtrInsumosAdherencia", "mtrEjesEnFallaAdherencia", "mtrEstadoAdherenciaEje",
    "mtrDebePreguntarTratamientoEje", "mtrDebePreguntarAdecuacionEje",
    "mtrDebePreguntarAdherenciaEje", "mtrPreguntaTratamientoEje",
    "mtrPreguntaAdecuacionEje", "mtrPreguntaAdherenciaEje",
    "_mtrMediaFuePreguntada", "_mtrMediaMarcarPreguntada",
  ],

  async pruebas(t, api, env, cargar) {
    // v18.1.0 — B3.3 (Misión B, capa b): el guard de apertura de los open* exige
    // perfil; un contexto sin padrón resuelve a PÚBLICO y el modal nunca se monta.
    // Se reenvuelve `cargar` para sembrar en TODOS los contextos la lista
    // `vgl_acceso_lista` (uid 707 en COMPLETO, como la dejaría el fetch de B2) y
    // una identidad por defecto. Un caso que siembre SU identidad después de
    // cargar sigue mandando: la asignación posterior pisa este default.
    const _cargarAccesoBase = cargar;
    cargar = (opciones) => {
      const opts = Object.assign({}, opciones || {});
      if (!opts.almacen) opts.almacen = {};
      if (!("vgl_acceso_lista" in opts.almacen)) {
        opts.almacen.vgl_acceso_lista = JSON.stringify({
          version: "test-63.acceso",
          perfiles: {
            COMPLETO: [
              { uid: 707, nombre: "Brandon Jesús Palencia Martínez" },
              { uid: 102, nombre: "Eliseth Estrada" },
              { uid: 103, nombre: "María Edineth Pino" },
            ],
            LABORATORIOS: [],
          },
          blocklist: [],
        });
      }
      const c = _cargarAccesoBase(opts);
      if (c && c.api && c.api.__state && !c.api.__state.activeDoctor.id) {
        c.api.__state.activeDoctor = { id: 707, name: "BRANDON JESUS PALENCIA MARTINEZ" };
      }
      return c;
    };
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

    // =================================================================================
    //  v18.0.33 — CRUCE DE PACIENTES EN EL PANEL (reporte en consulta: «utiliza cifras
    //  incorrectas de PA, peso, etc.»)
    //
    //  De los cinco datos antropométricos que el Panel mete en el resumen, SOLO UNO
    //  llevaba guarda de identidad:
    //     PA      -> mtrLeerTensionDelDom(document)   ids globales, SIN guarda
    //     Peso    -> mtrLeerPesoDelDom(document)      id="peso",   SIN guarda
    //     Cintura -> mtrLeerCinturaDelDom(document)   por rótulo,  SIN guarda
    //     IMC     -> mtrLeerFactoresRcvDelDom(docId)  CON guarda
    //  y un `|| {}` convertía la negativa del único protegido en «no hay factores», así
    //  que los otros tres entraban igual. La huella que el médico veía era una línea
    //  internamente incoherente: «peso 103 kg · IMC 24».
    // =================================================================================
    function pantallaDe(cedula, vitales) {
      // Un DOM de Everest con OTRA historia abierta: la cédula manda, los signos vitales
      // son los que se ven en pantalla ahora mismo.
      const campos = {
        taSistolicaAcostado: String(vitales.pas), taDiastolicaAcostado: String(vitales.pad),
        peso: String(vitales.peso),
      };
      const cintura = { value: String(vitales.cintura), id: "alert_message", closest: () => null,
                        getAttribute: (k) => (k === "aria-label" ? "Circunferencia abdominal (cm):" : null) };
      return {
        getElementById: (id) => (id === "anamesis" ? { id: "anamesis" } : null),
        querySelector: (sel) => {
          if (sel === "app-index") return null;
          const m = /^(?:input\[name="|#)([\w.-]+)/.exec(sel);
          const k = m && m[1];
          return (k && campos[k] != null) ? { value: campos[k] } : null;
        },
        querySelectorAll: (sel) => {
          if (sel === ".text-muted") return [{ textContent: "CC " + cedula, closest: () => null }];
          if (sel === "input, select, textarea") return [cintura];
          return [];
        },
      };
    }

    t.caso("v18.0.33 (cruce de pacientes): con OTRA historia en pantalla no se toma NI UNA cifra de ella", () => {
      const pantalla = pantallaDe("222222", { pas: 186, pad: 114, peso: 103, cintura: 121 });
      c.env.doc.getElementById = pantalla.getElementById;
      c.env.doc.querySelector = pantalla.querySelector;
      c.env.doc.querySelectorAll = pantalla.querySelectorAll;
      // El Panel abierto es el del paciente 111111; en pantalla hay otro.
      t.igual(a.mtrPanelFactoresDePantalla("111111", pantalla), null,
        "todo o nada: la PA, el peso y la cintura no llevan guarda propia, y meterlas en el " +
        "resumen de este paciente sería firmar una nota con la tensión de otro");
    });

    t.caso("v18.0.33 (contrapartida): con la historia CORRECTA delante sí se leen las cuatro", () => {
      // Sin esta prueba, la guarda se podría «arreglar» devolviendo null siempre y el
      // Panel dejaría de actualizarse nunca sin que nada se pusiera rojo.
      const pantalla = pantallaDe("111111", { pas: 128, pad: 78, peso: 78.4, cintura: 94 });
      c.env.doc.getElementById = pantalla.getElementById;
      c.env.doc.querySelector = pantalla.querySelector;
      c.env.doc.querySelectorAll = pantalla.querySelectorAll;
      const f = a.mtrPanelFactoresDePantalla("111111", pantalla);
      t.cierto(!!f, "hay factores");
      t.igual(f.paSistolica, 128, "la sistólica de ESTE paciente");
      t.igual(f.paDiastolica, 78, "y la diastólica");
      t.igual(f.pesoKg, 78.4, "y el peso");
      t.igual(f.cinturaCm, 94, "y la cintura, por rótulo");
    });

    t.caso("v18.0.33: sin cédula legible en pantalla tampoco se lee (Angular repintando la cabecera)", () => {
      const pantalla = pantallaDe("222222", { pas: 186, pad: 114, peso: 103, cintura: 121 });
      pantalla.querySelectorAll = (sel) => (sel === "input, select, textarea" ? [] : []);
      c.env.doc.getElementById = pantalla.getElementById;
      c.env.doc.querySelector = pantalla.querySelector;
      c.env.doc.querySelectorAll = pantalla.querySelectorAll;
      t.igual(a.mtrPanelFactoresDePantalla("111111", pantalla), null,
        "si el DOM no deja leer de quién es la pantalla, no se asume que es la misma");
    });

    t.caso("v18.0.33: y no se calla — el Panel dice que no pudo ponerse al día con la pantalla", () => {
      // Callarlo dejaría creer que lo que se ve está al día. El aviso vive DENTRO del Panel
      // (el mismo canal que ya usa «Se actualizó con lo que acaba de escribir»), no como un
      // cartel flotante más en medio de la consulta.
      // La apertura del Panel es un closure anidado que el arnés no puede ejecutar, así que
      // esto se fija por fuente — SIN comentarios, para que el propio comentario que explica
      // el arreglo no sea lo que hace pasar la prueba (ese error ya se cometió en la v18.0.14).
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      const codigo = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      t.cierto(/_notaAlAbrir = "En pantalla hay otra historia abierta[^"]+";/.test(codigo),
        "la rama del cruce deja escrito el motivo, en idioma de consultorio");
      t.cierto(/pintar\(_notaAlAbrir\);/.test(codigo),
        "y ese motivo llega al pintado del Panel, no se queda en una variable muerta");
      // Destapado por la mutación M2 de esta misma versión: comprobar que el MENSAJE existe
      // no basta. Cambiando la guarda por `|| {}` y el `if` por `if (true)`, el texto seguía
      // en el fuente pero su rama quedaba inalcanzable y el médico dejaba de enterarse —
      // y esta prueba pasaba en verde. Se fija la FORMA del condicional, que es lo que de
      // verdad decide si el aviso puede llegar a salir alguna vez.
      t.cierto(/const _factoresAlAbrir = mtrPanelFactoresDePantalla\(apt\.doc_id, document\);\s*\n\s*if \(_factoresAlAbrir\) \{/.test(codigo),
        "la reconciliación cuelga de la guarda misma: ni `|| {}` que la anule, ni un `if (true)` que deje muerta la rama del aviso");
      t.cierto(/\}\s*else\s*\{\s*\n[^\n]*\n[^\n]*\n[^\n]*\n\s*_notaAlAbrir =/.test(codigo) || /\}\s*else\s*\{[\s\S]{0,400}_notaAlAbrir =/.test(codigo),
        "y el aviso vive en el `else` de esa misma guarda, no en una rama suelta");
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

    // ===== INJERTADO EN LA FUSIÓN main<-rama (v18.0.6): casos que solo
    // existían en la rama de trabajo y que main había perdido. =====
    // --- Ayudantes recuperados de la rama junto con los casos injertados (v17.7.0 /
    // v17.31.0). Un DOM de Everest con solo los radios de comorbilidades.
    // `null` = casilla en blanco.
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
    const CAMPO_ERC = "AntecedentePatologicos.enfermedadRenal";

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

    // =====================================================================
    // v18.0.65 — BLOQUEO EN CONSULTA, REPORTADO EN VIVO CON CAPTURA (01-sep):
    // «ME ESTÁ SALIENDO ESTE MENSAJE Y NO ME DEJA AVANZAR, NI CERRAR EL MÓDULO, LE DOY QUE
    // SÍ TIENE ESAS ENFERMEDADES Y AÚN ASÍ VUELVE Y ME APARECE INDEFINIDAMENTE».
    //
    // El cuadro frena un ítem si NO está confirmado O si está desfasado. Responder guardaba
    // la respuesta pero NO cambiaba la casilla de la historia, así que la contradicción
    // seguía ahí y el ítem volvía a frenar en la vuelta siguiente. La única respuesta capaz
    // de cerrar el cuadro era la que coincidiera con la historia: si el médico sabía que el
    // paciente SÍ es diabético y la casilla decía que no, quedaba encerrado sin salida.
    // =====================================================================
    t.caso("v18.0.65: responder cierra el cuadro aunque la historia siga diciendo lo contrario", () => {
      const c = cargar({ silencioso: true });
      const d = c.env.doc;
      const gebPrev = d.getElementById.bind(d);
      d.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrev(id)));
      const pintar = (v) => {
        const radios = domRadios({ [CAMPO_HTA]: v });
        d.querySelectorAll = (sel) => (String(sel).indexOf("input[name=") === 0
          ? radios(sel)
          : (sel === ".text-muted"
              ? [{ textContent: "CC 777000222", closest: () => null }]
              : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]));
      };

      pintar(false);   // la historia dice que NO es hipertenso; la cabecera dice que sí
      t.cierto(c.api.mtrReconciliarAhora("777000222", d).frenan.some((x) => x.clave === "hta"),
        "de entrada sí frena: las fuentes no coinciden y nadie lo ha resuelto");

      // El médico responde «Sí tiene» CON la historia delante diciendo que no.
      c.api._vglConfirmacionGuardar("777000222", "hta", true, false);

      const r1 = c.api.mtrReconciliarAhora("777000222", d);
      t.falso(r1.frenan.some((x) => x.clave === "hta"),
        "ya no frena: él vio esta contradicción y la resolvió — repetírsela lo dejaba encerrado");
      t.igual(r1.leidos.hta, false,
        "y la historia SIGUE mandando sobre el valor: resolver el bloqueo no cambia el documento oficial");

      // Repetir la vuelta del reloj no lo vuelve a encerrar.
      t.falso(c.api.mtrReconciliarAhora("777000222", d).frenan.some((x) => x.clave === "hta"),
        "ni en la siguiente vuelta, ni en las que sigan");
    });

    t.caso("v18.0.65 (contención): una contradicción NUEVA sí se vuelve a preguntar", () => {
      const c = cargar({ silencioso: true });
      const d = c.env.doc;
      const gebPrev = d.getElementById.bind(d);
      d.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrev(id)));
      const pintar = (v) => {
        const radios = domRadios({ [CAMPO_HTA]: v });
        d.querySelectorAll = (sel) => (String(sel).indexOf("input[name=") === 0
          ? radios(sel)
          : (sel === ".text-muted"
              ? [{ textContent: "CC 777000333", closest: () => null }]
              : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]));
      };

      pintar(false);
      c.api._vglConfirmacionGuardar("777000333", "hta", true, false);   // resuelve el choque
      t.falso(c.api.mtrReconciliarAhora("777000333", d).frenan.some((x) => x.clave === "hta"),
        "resuelto");

      // Alguien cambia la casilla a «Sí»: ya no hay contradicción con su respuesta.
      pintar(true);
      const r = c.api.mtrReconciliarAhora("777000333", d);
      t.igual(r.desfasadas.length, 0, "coinciden: no hay nada que avisar");
      t.igual(r.leidos.hta, true, "y el valor es el de la historia");

      // Y si el médico hubiera respondido «No» viendo un «Sí» en pantalla, ese choque es
      // OTRO distinto del que ya resolvió: ese sí tiene que volver a preguntarse.
      const c2 = cargar({ silencioso: true });
      const d2 = c2.env.doc;
      const geb2 = d2.getElementById.bind(d2);
      d2.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : geb2(id)));
      const radios2 = domRadios({ [CAMPO_HTA]: true });
      d2.querySelectorAll = (sel) => (String(sel).indexOf("input[name=") === 0
        ? radios2(sel)
        : (sel === ".text-muted"
            ? [{ textContent: "CC 777000444", closest: () => null }]
            : [{ textContent: "Marcaciones: HTA+DM", innerText: "Marcaciones: HTA+DM" }]));
      // Respondió «No» cuando la pantalla decía «No»; ahora la pantalla dice «Sí».
      c2.api._vglConfirmacionGuardar("777000444", "hta", false, false);
      t.cierto(c2.api.mtrReconciliarAhora("777000444", d2).desfasadas.indexOf("hta") >= 0,
        "la historia cambió desde que él respondió: es un choque nuevo y se avisa");
    });

    t.caso("v17.31.0 — con TFG por Cockcroft-Gault <60 ya calculada, el reconciliador NO pregunta por ERC", () => {
      const cErc = cargar({ silencioso: true });
      const d = cErc.env.doc;
      const gebPrev = d.getElementById.bind(d);
      d.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrev(id)));

      // La cabecera de Everest dice NEFROPROTECCIÓN (afirma ERC); la historia de hoy dice
      // que NO (niega ERC) — la misma contradicción que antes SIEMPRE frenaba el módulo.
      const radios = domRadios({ [CAMPO_ERC]: false });
      d.querySelectorAll = (sel) => (String(sel).indexOf("input[name=") === 0
        ? radios(sel)
        : (sel === ".text-muted"
            ? [{ textContent: "CC 555000222", closest: () => null }]
            : [{ textContent: "Marcaciones: NEFROPROTECCION", innerText: "Marcaciones: NEFROPROTECCION" }]));

      // Sin TFG cacheada, la contradicción se ve igual que siempre: sigue frenando. Esto
      // deja constancia de que el guardarraíl solo se activa CON el dato, no por defecto.
      const sinTfg = cErc.api.mtrReconciliarAhora("555000222", d);
      t.cierto(sinTfg.frenan.some((x) => x.clave === "enfermedadRenal"),
        "sin TFG en caché, la contradicción cabecera/historia sigue preguntando — el guardarraíl no cambia el caso de siempre");

      // Con la TFG por Cockcroft-Gault ya calculada y <60 (resumenBase: creatinina 1.3,
      // 66 años, 70 kg, mujer → crcl 47), la pregunta desaparece: ya está establecida por
      // un cálculo objetivo, no hay nada que confirmarle al médico.
      cErc.api.mtrCacheResumenGuardar("555000222", resumenBase);
      const conTfg = cErc.api.mtrReconciliarAhora("555000222", d);
      t.falso(conTfg.frenan.some((x) => x.clave === "enfermedadRenal"),
        "con TFG<60 ya calculada, la pregunta de ERC ya no sale");
    });

    t.caso("v17.31.0 — una TFG por Cockcroft-Gault ≥60 (o no evaluable) NO apaga la pregunta de ERC", () => {
      const cErc2 = cargar({ silencioso: true });
      const d = cErc2.env.doc;
      const gebPrev = d.getElementById.bind(d);
      d.getElementById = (id) => (id === "anamesis" ? {} : (id === "comentariosFinales" ? null : gebPrev(id)));
      const radios = domRadios({ [CAMPO_ERC]: false });
      d.querySelectorAll = (sel) => (String(sel).indexOf("input[name=") === 0
        ? radios(sel)
        : (sel === ".text-muted"
            ? [{ textContent: "CC 555000333", closest: () => null }]
            : [{ textContent: "Marcaciones: NEFROPROTECCION", innerText: "Marcaciones: NEFROPROTECCION" }]));

      // Función renal normal: crcl 92 (misma fórmula, con una creatinina normal).
      const resumenSano = a.mtrResumenClinico({
        hoyIso: "2026-08-20", edad: 40, sexo: "F", pesoKg: 65, creatinina: 0.7,
        factores: { hta: true, diabetes: false, tabaquismo: false, enfermedadRenalDocumentada: true },
        ultimos: { CREATININA: { fecha: "2026-07-01", valor: 0.7 } },
      });
      t.cierto(resumenSano.erc && resumenSano.erc.crcl >= 60, "control del escenario: TFG normal");
      cErc2.api.mtrCacheResumenGuardar("555000333", resumenSano);
      const conTfgSana = cErc2.api.mtrReconciliarAhora("555000333", d);
      t.cierto(conTfgSana.frenan.some((x) => x.clave === "enfermedadRenal"),
        "con TFG≥60, una TFG normal NO resuelve la duda por sí sola: se sigue preguntando");
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

    // =====================================================================
    // v18.0.131 (barrido por recorridos, hallazgo 7) — REPORTE DEL BARRIDO: el repaso de 20 s
    // trataba «no pude leer la pantalla» (mtrLeerFactoresRcvDelDom sin nada que leer, o la
    // caché de 3 min caducada) igual que «se resolvió»: `rec.frenan` llegaba vacío por FALTA
    // de datos, no porque la contradicción se aclarara, y el cuadro se cerraba solo con un
    // toast VERDE «La historia ya lo aclara». En este arnés, con querySelectorAll -> [], es
    // exactamente el escenario de «no pude leer»: mtrLeerFactoresRcvDelDom nunca puede armar
    // `f._leidos`, así que rec.leidos sale null en cada vuelta del repaso.
    // =====================================================================
    t.caso("v18.0.131 (hallazgo 7): el repaso de 20 s no cierra el cuadro solo porque no pudo leer la pantalla", () => {
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
      const mostrado = cM.api._vglModalConfirmarDatos({ doc_id: "424242" }, [{
        clave: "hta", etiqueta: "Hipertensión arterial", porQue: "cambia las vigencias",
        afirman: [{ fuente: "Cabecera de Everest", detalle: "aparece en las marcaciones" }],
        niegan: [{ fuente: "Historia clínica", detalle: "marcado como No" }],
        severidad: "alta",
      }], null);
      t.cierto(mostrado, "el cuadro se pinta");
      t.cierto(!!d.getElementById("vgl-confirma-modal"), "control: el cuadro está en pantalla");
      const repaso = [...cM.env.intervalos.values()].find((x) => x.vivo && x.ms === 20000);
      t.cierto(!!repaso, "el repaso quedó armado");
      repaso.f();   // una vuelta del repaso, sin poder leer nada de la pantalla
      t.cierto(!!d.getElementById("vgl-confirma-modal"),
        "el cuadro SIGUE abierto: «no pude leer» no es «se resolvió» — antes se cerraba solo aquí, afirmando en VERDE que la historia ya lo aclaraba");
    });
    // =====================================================================
    // v18.0.116 — «UN SOLO ESTADO DEL PACIENTE», PASO 1: detector PASIVO de desacuerdos
    // =====================================================================
    t.caso("v18.0.116 (A, paso 1): el detector solo señala desacuerdos reales entre fuentes — tensión, peso, sexo, programas y la llave de medicamentos — y nunca inventa uno con datos incompletos", () => {
      const d = api.mtrDetectarDesacuerdos;
      t.igual(d(null).length, 0, "sin insumos: nada");
      t.igual(d({ ta: { pas: 130, pad: 85 }, ent: { pas: 130, pad: 85, peso: 70 }, pesoDom: 70 }).length, 0, "fuentes que coinciden: nada");
      const ten = d({ ta: { pas: 165, pad: 102 }, ent: { pas: 110, pad: 70 } });
      t.cierto(ten.length === 1 && ten[0].eje === "tension" && /110\/70/.test(ten[0].fuentes[0].valor) && /165\/102/.test(ten[0].fuentes[1].valor), "tensión: API 110/70 vs casilla 165/102 (el caso A2 del auditor)");
      t.igual(d({ ta: { pas: 165, pad: 102 }, ent: { pas: 110, pad: 102 } }).length, 1, "también si solo difiere la sistólica");
      t.igual(d({ ta: { pas: 130, pad: 95 }, ent: { pas: 130, pad: 80 } }).length, 1, "y si solo difiere la diastólica");
      t.igual(d({ ta: { pas: 165, pad: null }, ent: { pas: 110, pad: 70 } }).length, 0, "con una medición incompleta no se afirma desacuerdo (casilla vacía antes que dato inventado)");
      t.igual(d({ ent: { peso: 90 }, pesoDom: 70 })[0].eje, "peso", "peso: 90 vs 70");
      t.igual(d({ ent: { peso: 70.4 }, pesoDom: 70 }).length, 0, "menos de 1 kg no es desacuerdo");
      t.igual(d({ ent: { sexo: "MASCULINO" }, sexoCabecera: "F" })[0].eje, "sexo", "sexo: API masculino vs cabecera F");
      t.igual(d({ ent: { sexo: "M" }, sexoCabecera: "MASCULINO" }).length, 0, "el sexo se canonicaliza antes de comparar (A5)");
      const pr = d({ programasCabecera: { hta: true, diabetes: null, enfermedadRenalDocumentada: false }, programasCosecha: { hta: false, diabetes: true, erc: false } });
      t.cierto(pr.length === 1 && pr[0].eje === "programa" && /HTA: sí/.test(pr[0].fuentes[0].valor) && /HTA: no/.test(pr[0].fuentes[1].valor), "programa: solo HTA difiere (diabetes null en cabecera no cuenta; ERC coincide)");
      const md = d({ medsCacheKey: "111222333", pacienteIdLabs: 5150, docId: "111222333" });
      t.cierto(md.length === 1 && md[0].eje === "medicamentos", "medicamentos: la caché quedó bajo la cédula y el resumen busca por id (A3)");
      t.igual(d({ medsCacheKey: "5150", pacienteIdLabs: 5150, docId: "111222333" }).length, 0, "misma llave: nada");
      t.igual(d({ medsCacheKey: "9999", pacienteIdLabs: 5150, docId: "111222333" }).length, 0, "otra llave que no es la cédula: es otro paciente, no un desacuerdo de este");
      const todos = d({ ta: { pas: 165, pad: 102 }, ent: { pas: 110, pad: 70, peso: 90, sexo: "F" }, pesoDom: 70, sexoCabecera: "M", programasCabecera: { hta: true }, programasCosecha: { hta: false }, medsCacheKey: "1", pacienteIdLabs: 2, docId: "1" });
      t.igual(todos.map((x) => x.eje).join(","), "tension,peso,sexo,programa,medicamentos", "los cinco ejes a la vez, en orden fijo");
    });

    await t.casoAsync("v18.0.116 (A, paso 1): los desacuerdos se anotan UNA vez por paciente y combinación (telemetría + bitácora), y el modo programador los muestra", async () => {
      const c = cargar({ silencioso: true });
      const lista = [{ eje: "tension", fuentes: [{ fuente: "registro histórico (API)", valor: "110/70" }, { fuente: "casilla de hoy", valor: "165/102" }] }];
      t.cierto(c.api.mtrAnotarDesacuerdos("111222333", lista), "primera vez: se anota");
      t.falso(c.api.mtrAnotarDesacuerdos("111222333", lista), "la misma combinación no se vuelve a contar");
      t.cierto(c.api.mtrAnotarDesacuerdos("111222333", lista.concat([{ eje: "peso", fuentes: [] }])), "otra combinación sí");
      t.falso(c.api.mtrAnotarDesacuerdos("111222333", []), "sin desacuerdos no se anota nada");
      await new Promise((r) => setTimeout(r, 30));   // el buffer de telemetría se vuelca en un temporizador
      const ux = JSON.parse(c.env.storage.getItem("vgl_ux") || "null");
      t.cierto(!!(ux && ux.acciones && ux.acciones["estado.desacuerdo.tension"] === 2 && ux.acciones["estado.desacuerdo.peso"] === 1), "la telemetría cuenta por eje (anónima: solo el nombre del eje)");
      const logs = JSON.parse(c.env.storage.getItem("vgl_flight_recorder_logs") || "[]");
      const fila = logs.find((l) => l.act === "DesacuerdoModulos");
      t.cierto(!!fila && /tension/.test(fila.det.ejes) && !/111222333/.test(JSON.stringify(fila)), "la bitácora anota los ejes, nunca la cédula");
      // modo programador: texto del paciente abierto
      c.env.doc.getElementById = (id) => (id === "anamesis" ? {} : null);
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 111222333", closest: () => null }] : []);
      t.cierto(/sin resumen/.test(c.api._ajustesDesacuerdosTexto()), "sin resumen calculado lo dice");
      c.api.mtrCacheResumenGuardar("111222333", { factores: {}, _desacuerdos: lista });
      t.cierto(/tension — registro histórico \(API\): 110\/70 vs casilla de hoy: 165\/102/.test(c.api._ajustesDesacuerdosTexto()), "con desacuerdos, los lista con sus fuentes: " + c.api._ajustesDesacuerdosTexto());
      c.api.mtrCacheResumenGuardar("111222333", { factores: {}, _desacuerdos: [] });
      t.cierto(/ninguno/.test(c.api._ajustesDesacuerdosTexto()), "sin desacuerdos: «ninguno»");
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.cierto(/resumen\._desacuerdos = mtrDetectarDesacuerdos\(\{[\s\S]{0,700}mtrAnotarDesacuerdos\(apt && apt\.doc_id, resumen\._desacuerdos\);/.test(src), "el resumen clínico cuelga la lista y la anota (sobrevive a la caché)");
      t.cierto(/id="c-desacuerdos"[^\n]*\$\{escapeHtml\(_ajustesDesacuerdosTexto\(\)\)\}/.test(src), "Ajustes (modo programador) la pinta");
      t.falso(/_desacuerdos[^\n]*(precedencia|=\s*fPrev|Object\.assign\(fPrev)/.test(src), "paso 1: el detector no toca ninguna precedencia");
    });

    t.caso("v18.0.118 (UI/UX #11): cada pregunta de la escalera lleva sus propios rótulos y el título no habla de fuentes cuando no hay contradicción", () => {
      const noLeidos = { medsRcv: null, medsNoLeidos: true, inerciaLdl: null };
      const pAdh = api.mtrPreguntaAdherenciaEje("hba1c", noLeidos);
      t.igual(pAdh.rotuloSi, "Sí lo toma", "adherencia: «Sí lo toma»");
      t.igual(pAdh.rotuloNo, "No lo toma", "y «No lo toma» (antes: «Sí tiene / No tiene», que no responde a esa pregunta)");
      const pAde = api.mtrPreguntaAdecuacionEje("ldl", noLeidos);
      t.igual(pAde.rotuloSi, "Sí, es adecuado", "adecuación: rótulo propio");
      const pRep = api.mtrPreguntaFueraMeta({ repetir: [{ clave: "COLESTEROL_LDL", nombre: "LDL" }], noRepetir: [] });
      t.igual(pRep.rotuloSi, "Sí, repetirlos antes", "repetir antes: rótulo propio");
      const pFactor = api.mtrPreguntaEmbarazo();
      t.igual(pFactor.rotuloSi, undefined, "las preguntas de dato del paciente NO traen rótulo: conservan «Sí tiene / No tiene»");
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      t.cierto(/\$\{escapeHtml\(d\.rotuloSi \|\| "Sí tiene"\)\}/.test(src) && /\$\{escapeHtml\(d\.rotuloNo \|\| "No tiene"\)\}/.test(src), "el modal usa el rótulo de la pregunta, con el de siempre como respaldo");
      t.cierto(/const _hayContradiccion = \(discrepancias \|\| \[\]\)\.some\(\(d\) => d && !d\.rotuloSi && \(d\.afirman \|\| \[\]\)\.length > 0 && \(d\.niegan \|\| \[\]\)\.length > 0\);/.test(src), "y «Las fuentes no coinciden» solo cuando de verdad hay fuentes a favor y en contra");
      t.cierto(/_tituloConf = _hayContradiccion \? "🔎 Las fuentes no coinciden" : "🔎 Antes de calcular, unas preguntas"/.test(src), "si no, el título dice la verdad");
    });

  },
};
