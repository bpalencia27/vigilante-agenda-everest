// =====================================================================
//  SUITE 47 — El recuadro clínico que reemplaza al banner superior de PyM
//
//  Lo que protege: que el recuadro diga la verdad y no invente nada. Un
//  recuadro que rellena huecos con valores plausibles es peor que no tener
//  recuadro — el médico no puede distinguir lo calculado de lo supuesto.
//
//  Y una regla de este proyecto que aquí es crítica: TODO valor dinámico que
//  entra en innerHTML pasa por escapeHtml(). El nombre del paciente y los
//  motivos de cada examen vienen de Everest y de Athenea.
// =====================================================================

module.exports = {
  nombre: "Recuadro clínico (reemplazo del banner de PyM)",
  cubre: [
    "mtrResumenClinico", "mtrRenderResumenClinicoHtml", "mtrChipResumenTexto",
    "mtrClaseCategoria", "mtrFechaLegible", "mtrResumenDesdeModalLabs",
    "mtrRenderCabeceraRiesgoHtml", "mtrRenderFallaHtml",
  ],

  pruebas(t, api) {
    const ctxBase = {
      hoyIso: "2026-08-16",
      edad: 68, sexo: "F", pesoKg: 62, creatinina: 1.6,
      rac: 45, ct: 230, hdl: 42, ldl: 148, paSistolica: 148, paDiastolica: 88,
      factores: { hta: true, diabetes: true, tabaquismo: false, sedentarismo: true },
      ultimos: {
        CREATININA: { fecha: "2026-05-01", valor: 1.6 },
        COLESTEROL_TOTAL: { fecha: "2026-05-01", valor: 230 },
        COLESTEROL_HDL: { fecha: "2026-05-01", valor: 42 },
        COLESTEROL_LDL: { fecha: "2026-05-01", valor: 148 },
        TRIGLICERIDOS: { fecha: "2026-05-01", valor: 190 },
        GLUCOSA: { fecha: "2026-05-01", valor: 132 },
        RAC: { fecha: "2026-05-01", valor: 45 },
      },
      grupoSabado: "1-3",
    };

    t.caso("el resumen junta riesgo, función renal y plan sin que falte ninguna pieza", () => {
      const r = api.mtrResumenClinico(ctxBase);
      t.cierto(!!r.erc, "función renal");
      t.cierto(!!r.riesgo, "riesgo");
      t.cierto(!!r.plan, "plan de paraclínicos");
      t.cierto(!!r.programa, "programa rector");
      t.cierto(!!r.erc.estadioAdministrativo, "estadio administrativo (Cockcroft-Gault)");
      t.cierto(!!r.erc.estadioClinico, "estadio clínico (CKD-EPI)");
    });

    t.caso("una diabética con RAC 45 y ERC sale MUY ALTO, con meta de LDL 55", () => {
      const r = api.mtrResumenClinico(ctxBase);
      t.igual(r.riesgo.categoria, "muy alto", "diabetes con daño de órgano blanco");
      t.igual(r.meta.metas.ldl, 55, "meta de LDL de muy alto riesgo");
      t.cierto(r.meta.falla, "un LDL de 148 contra meta 55 es falla terapéutica");
      t.cierto(r.meta.fallaGrave, "y grave: supera meta+30%");
    });

    t.caso("el programa rector lo decide la norma: ERC por encima de DM2 y HTA", () => {
      const r = api.mtrResumenClinico(ctxBase);
      // Creatinina 1.6 en una mujer de 68 años y 62 kg: Cockcroft-Gault ~26 -> G4.
      t.igual(r.programa, "ERC", "con ERC establecida manda el programa renal");
      const sinErc = api.mtrResumenClinico(Object.assign({}, ctxBase, { creatinina: 0.8 }));
      t.igual(sinErc.programa, "DM2", "sin ERC, la diabetes manda sobre la hipertensión");
    });

    t.caso("el HTML sale con las dos fechas y con el porqué de cada una", () => {
      const r = api.mtrResumenClinico(ctxBase);
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/Toma de laboratorios/.test(html), "debía mostrar la fecha de toma");
      t.cierto(/Control sugerido/.test(html), "y la de control");
      t.cierto(/vgl-rcv-porque/.test(html), "y el motivo, para que la fecha no salga de la nada");
      t.cierto(html.indexOf(r.plan.ftl) >= 0, "la fecha ISO de la toma debía aparecer literal");
    });

    t.caso("el HTML muestra los DOS estadios por separado, no uno solo", () => {
      const html = api.mtrRenderResumenClinicoHtml(api.mtrResumenClinico(ctxBase));
      t.cierto(/Administrativo \(Cockcroft-Gault\)/.test(html), "estadio administrativo etiquetado");
      t.cierto(/Cl.nico \(CKD-EPI\)/.test(html), "estadio clínico etiquetado");
    });

    t.caso("cuando falta un dato, el recuadro lo DICE en vez de rellenarlo", () => {
      const sinPeso = api.mtrResumenClinico(Object.assign({}, ctxBase, { pesoKg: null }));
      const html = api.mtrRenderResumenClinicoHtml(sinPeso);
      t.igual(sinPeso.erc.crcl, null, "sin peso no hay Cockcroft-Gault");
      t.cierto(/falta/i.test(html), "y el recuadro debía decir que falta un dato");
      t.cierto(/peso/i.test(html), "y cuál");
    });

    t.caso("sin creatinina no se clasifica el riesgo, y se explica por qué", () => {
      const r = api.mtrResumenClinico(Object.assign({}, ctxBase, { creatinina: null }));
      t.igual(r.riesgo.categoria, null, "sin TFG no hay categoría");
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/SIN CLASIFICAR/.test(html), "se dice que no está clasificado");
      t.cierto(/No se puede clasificar sin la TFG/.test(html), "y por qué");
    });

    t.caso("los exámenes que faltan se listan con el motivo de cada uno", () => {
      const r = api.mtrResumenClinico(Object.assign({}, ctxBase, { ultimos: {} }));
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/Faltan \d+ examen/.test(html), "debía anunciar cuántos faltan");
      t.cierto(/no hay ning.n resultado registrado/.test(html), "con el motivo de cada uno");
    });

    t.caso("cuando no falta nada, lo dice — no se calla ni se inventa una lista", () => {
      // Todo tomado hoy: nada vencido, nada ausente entre los drivers vigilados.
      const hoy = {};
      for (const k of ["CREATININA", "COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL",
        "TRIGLICERIDOS", "GLUCOSA", "UROANALISIS", "RAC", "HBA1C",
        "HEMOGLOBINA", "PTH", "FOSFORO", "ALBUMINA"]) {
        hoy[k] = { fecha: "2026-08-16", valor: 1 };
      }
      const r = api.mtrResumenClinico(Object.assign({}, ctxBase, { ultimos: hoy }));
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/No falta ning.n examen/.test(html), "debía decirlo explícitamente");
    });

    t.caso("la lista para la próxima consulta sale del plan, no de una lista fija", () => {
      const r = api.mtrResumenClinico(Object.assign({}, ctxBase, { ultimos: {} }));
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/Para la pr.xima consulta hay que enviarle/.test(html), "el bloque de órdenes");
      for (const a of r.plan.ordenar.slice(0, 3)) {
        t.cierto(html.indexOf(a.nombre) >= 0, "debía aparecer " + a.nombre);
      }
    });

    t.caso("los exámenes bloqueados por estadio se explican, no desaparecen", () => {
      // En el programa ERC con estadio temprano, la norma BLOQUEA PTH, fósforo y
      // albúmina. Ojo con la diferencia, que no es cosmética: en DM2 o HTA esos
      // tres no están en la tabla siquiera ("NO_APLICA"), y eso NO es lo mismo
      // que un bloqueo — al médico se le explica una cosa o la otra.
      const r = api.mtrResumenClinico(Object.assign({}, ctxBase, {
        creatinina: 0.7, ultimos: {}, programa: "ERC",
      }));
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(r.plan.bloqueados.length >= 3,
        "en G1 la norma bloquea PTH, fósforo y albúmina — si no hay bloqueados, la premisa se rompió");
      t.cierto(/bloqueado\(s\) por la norma/.test(html),
        "los bloqueados van en un desplegable: visibles pero sin ruido");
      t.igual(r.plan.ordenar.filter((a) => a.estado === "BLOQ").length, 0,
        "y ninguno de ellos entra en la orden");
    });

    t.caso("TODO valor dinámico pasa por escapeHtml — el motivo viene de Athenea", () => {
      const r = api.mtrResumenClinico(Object.assign({}, ctxBase, { ultimos: {} }));
      // Se ensucia un motivo como lo haría un dato hostil que llegara de la red.
      r.plan.faltantes[0].nombre = '<img src=x onerror="alert(1)">';
      r.plan.faltantes[0].motivo = '"><script>alert(2)</script>';
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.igual(html.indexOf("<img src=x"), -1, "la etiqueta img no puede salir cruda");
      t.igual(html.indexOf("<script>"), -1, "ni una etiqueta script");
      t.cierto(html.indexOf("&lt;img") >= 0, "debía salir escapada");
    });

    t.caso("el chip del dock es la red de seguridad: un número, y vacío si no hay nada", () => {
      const conPendientes = api.mtrResumenClinico(Object.assign({}, ctxBase, { ultimos: {} }));
      const txt = api.mtrChipResumenTexto(conPendientes);
      t.cierto(/\d+ ex.menes pendientes|1 examen pendiente/.test(txt), "debía decir cuántos, dijo: " + txt);
      const hoy = {};
      for (const k of ["CREATININA", "COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL",
        "TRIGLICERIDOS", "GLUCOSA", "UROANALISIS", "RAC", "HBA1C",
        "HEMOGLOBINA", "PTH", "FOSFORO", "ALBUMINA"]) {
        hoy[k] = { fecha: "2026-08-16", valor: 1 };
      }
      const sinNada = api.mtrResumenClinico(Object.assign({}, ctxBase, { ultimos: hoy }));
      t.igual(api.mtrChipResumenTexto(sinNada), "", "sin pendientes, el chip no aparece");
      t.igual(api.mtrChipResumenTexto(null), "", "y sin resumen tampoco");
    });

    t.caso("la fecha legible no depende del idioma del PC", () => {
      // Un consultorio con Windows en inglés no puede ver "Sat 15 Aug" en un
      // recuadro que el resto del script escribe en español.
      t.igual(api.mtrFechaLegible("2026-08-15"), "sáb 15 ago", "sábado 15 de agosto");
      t.igual(api.mtrFechaLegible("2026-01-01"), "jue 1 ene", "jueves 1 de enero");
      t.igual(api.mtrFechaLegible("no-es-fecha"), "—", "una fecha ilegible no inventa un día");
    });

    t.caso("el color del recuadro sigue a la categoría, y sin categoría es neutro", () => {
      t.igual(api.mtrClaseCategoria("muy alto"), "vgl-rcv-crit", "muy alto");
      t.igual(api.mtrClaseCategoria("alto"), "vgl-rcv-alto", "alto");
      t.igual(api.mtrClaseCategoria("moderado"), "vgl-rcv-mod", "moderado");
      t.igual(api.mtrClaseCategoria("bajo"), "vgl-rcv-bajo", "bajo");
      t.igual(api.mtrClaseCategoria(null), "vgl-rcv-nd", "sin clasificar: neutro, no verde");
    });

    t.caso("el recuadro nunca lanza, ni con un resumen vacío ni con uno a medias", () => {
      t.noLanza(() => api.mtrRenderResumenClinicoHtml(null), "con null");
      t.noLanza(() => api.mtrRenderResumenClinicoHtml({}), "con un objeto vacío");
      t.noLanza(() => api.mtrRenderResumenClinicoHtml({ plan: {}, erc: {}, riesgo: {} }), "a medias");
      t.igual(api.mtrRenderResumenClinicoHtml(null), "", "y con null devuelve cadena vacía, no 'undefined'");
    });

    t.caso("la remisión a nefrología aparece en el recuadro cuando corresponde", () => {
      const r = api.mtrResumenClinico(Object.assign({}, ctxBase, { rac: 350 }));
      t.cierto(r.erc.remitirNefrologia, "RAC 350 es criterio de remisión");
      const html = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(/remisi.n a nefrolog.a/i.test(html), "y debía verse en el recuadro");
    });

    t.caso("el adaptador del modal de labs NO añade ni una consulta de red", () => {
      // Es la restricción explícita del encargo: no sobrecargar CPU ni red. El
      // adaptador solo reordena lo que el modal ya tiene: el resultado del
      // cálculo renal (que ya pagó sus dos consultas, cacheadas) y los
      // laboratorios que el modal acaba de pintar.
      const renal = {
        estadio: "G3b", tfg: 38,
        entradas: { edad: 68, peso: 62, creatinina: 1.6, sexo: "F", pas: 148, pad: 88 },
      };
      const labs = [
        { Analito: "CREATININA EN SUERO", Resultado: "1.6", Fecha: "01/05/2026" },
        { Analito: "COLESTEROL TOTAL", Resultado: "230", Fecha: "01/05/2026" },
      ];
      let r = null;
      t.noLanza(() => { r = api.mtrResumenDesdeModalLabs(renal, labs, { doc_id: "" }); },
        "el adaptador no puede tumbar el modal de laboratorios");
      t.cierto(!!r && !!r.erc, "devuelve un resumen utilizable");
      t.igual(r.erc.estadioAdministrativo, "G3b",
        "y calcula el estadio con las entradas que YA venían, sin volver a pedir nada");
    });

    t.caso("el adaptador aguanta un modal sin laboratorios y sin datos renales", () => {
      let r = null;
      t.noLanza(() => { r = api.mtrResumenDesdeModalLabs(null, null, null); }, "con todo en null");
      t.cierto(!!r, "sigue devolviendo un resumen");
      t.igual(r.erc.crcl, null, "sin datos no inventa una TFG");
      t.igual(r.riesgo.categoria, null, "ni una categoría de riesgo");
    });

    // =====================================================================
    // v17.6.0 — HALLADO AL CABLEAR LA META DE HbA1c INDIVIDUAL: dos eslabones seguidos
    // faltaban, no uno. (1) mtrResumenDesdeModalLabs nunca mandaba el valor CRUDO de
    // HbA1c en el ctx (sí RAC/colesterol/LDL). (2) aunque lo mandara, mtrResumenClinico
    // nunca copiaba ctx.hba1c a un campo `resumen.hba1c` propio — solo viajaba, ya
    // envuelto en {actual,meta}, hacia ADENTRO de mtrPlanFallas (la alerta de "fuera de
    // meta"), nunca hacia afuera. mtrTableroClinico lee `resumen.hba1c` para armar la
    // fila de Metas terapéuticas del Panel: con cualquiera de los dos eslabones roto,
    // esa fila no tenía NADA que mostrar — apagada desde que se escribió (v17.0.0),
    // igual que la alerta de "fuera de meta" lo estaba desde v16.4.0. No es un defecto
    // de esta versión: es uno que esta versión destapa al intentar mostrar la meta
    // individual y encontrar que nunca tuvo con qué compararla. Estas dos pruebas fijan
    // que ahora sí viaja de punta a punta, con y sin meta individual guardada.
    // =====================================================================
    t.caso("v17.6.0 — el adaptador ahora SÍ manda el valor real de HbA1c, junto con la meta individual que el médico fijó desde el Panel", () => {
      api._vglCosechaGuardar("55501", { metaHba1cManual: { v: 7.6, ts: 1 } });
      const renal = { estadio: "G2", tfg: 75, entradas: { edad: 85, peso: 68, creatinina: 1.0, sexo: "M", pas: 130, pad: 80 } };
      const labs = [{ NombreParametro: "HEMOGLOBINA GLICOSILADA", Resultado: "8.2", Fecha: "01/08/2026" }];
      const r = api.mtrResumenDesdeModalLabs(renal, labs, { doc_id: "55501" }, "55501");
      t.cierto(!!r.hba1c, "con un resultado real de HbA1c, resumen.hba1c ya no queda en null");
      t.igual(r.hba1c.actual, 8.2, "el valor real de laboratorio viaja");
      t.igual(r.hba1c.meta, 7.6, "y la meta INDIVIDUAL del paciente (el caso real: 85 años, 7,6 %), no la general");
    });

    t.caso("v17.6.0 — sin meta individual guardada, el Panel muestra la meta general (7 %) y no inventa una meta distinta", () => {
      // v17.6.1 — diabetes documentada vía cosecha (mismo mecanismo de "lo ya visto en
      // otras pestañas" de v16.1.0, arriba en esta misma función): sin esto la fila ya
      // NO se muestra en absoluto desde el arreglo del filtro de diabetes (ver abajo),
      // y esta prueba dejaría de ejercitar lo que dice probar (el fallback a la meta
      // general), no porque el fallback esté mal sino porque nunca llegaría a la fila.
      api._vglCosechaGuardar("55502", { programas: { diabetes: true } });
      const renal = { estadio: "G2", tfg: 75, entradas: { edad: 60, peso: 70, creatinina: 0.9, sexo: "F", pas: 120, pad: 78 } };
      const labs = [{ NombreParametro: "HEMOGLOBINA GLICOSILADA", Resultado: "6.8", Fecha: "01/08/2026" }];
      const r = api.mtrResumenDesdeModalLabs(renal, labs, { doc_id: "55502" }, "55502");
      t.cierto(!!r.hba1c, "el valor real sigue viajando sin meta individual");
      t.igual(r.hba1c.actual, 6.8, "el valor real de laboratorio");
      t.cierto(!!(r.factores && r.factores.diabetes), "la diabetes documentada por cosecha sí llega al resumen");
      // Sin meta individual, resumen.hba1c.meta queda undefined a propósito (misma
      // fórmula que ya usa mtrPlanFallas): el 7,0 % de MTR_HBA1C_META_DM2 lo aplica
      // mtrPanelMetasHtml al pintar, no este adaptador — se confirma en la capa donde
      // el médico realmente lo ve.
      const html = api.mtrPanelMetasHtml(api.mtrTableroClinico(r));
      t.cierto(html.indexOf("&lt; 7 %") >= 0, "sin meta individual, el Panel muestra la meta general de 7 %");
      t.falso(html.indexOf("meta individual de este paciente") >= 0, "y no dice 'meta individual' cuando nadie fijó una");
    });

    t.caso("el sábado propuesto para el control respeta el grupo del médico", () => {
      const r13 = api.mtrResumenClinico(Object.assign({}, ctxBase, { grupoSabado: "1-3" }));
      if (r13.plan.control && r13.plan.control.esSabado) {
        t.igual(api.mtrMedicoTrabajaSabado(r13.plan.control.fecha, "1-3"), true,
          "si propone sábado, tiene que ser uno de los suyos");
      }
      const rSin = api.mtrResumenClinico(Object.assign({}, ctxBase, { grupoSabado: null }));
      t.cierto(!!rSin.plan.control, "sin grupo también tiene que salir una fecha de control");
      t.falso(rSin.plan.control.esSabado, "pero nunca en sábado: no se propone lo que no se sabe");
    });

    // =====================================================================
    // v15.2.0 — mtrRenderCabeceraRiesgoHtml y mtrRenderFallaHtml, DIRECTO.
    // v14.2.11 las sacó de mtrRenderResumenClinicoHtml (arriba) para poder
    // pintarlas también en openRiesgoModal, sin cambiar ni una línea de HTML.
    // Las docenas de pruebas de arriba (y de las suites de falla/framingham/uro)
    // ya las ejercitan DE VERDAD a través de mtrRenderResumenClinicoHtml — esto
    // fija su contrato propio como funciones independientes: qué HTML producen
    // solas, y que un `r` vacío/nulo no revienta nada.
    // =====================================================================
    t.caso("mtrRenderCabeceraRiesgoHtml: sola, produce EXACTAMENTE el mismo fragmento que ya sale dentro del recuadro completo", () => {
      const r = api.mtrResumenClinico(ctxBase);
      const cabeceraSola = api.mtrRenderCabeceraRiesgoHtml(r);
      const htmlCompleto = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(cabeceraSola.length > 0, "produce HTML de verdad");
      t.cierto(htmlCompleto.indexOf(cabeceraSola.trim()) >= 0, "es el MISMO fragmento que usa el recuadro completo, no una copia que se desvió");
      t.cierto(/Riesgo cardiovascular/.test(cabeceraSola), "trae la categoría");
      t.cierto(/meta LDL/.test(cabeceraSola), "trae la meta");
    });

    t.caso("mtrRenderCabeceraRiesgoHtml: con r nulo o sin riesgo, no revienta", () => {
      t.igual(api.mtrRenderCabeceraRiesgoHtml(null), "", "nulo: cadena vacía, no 'undefined'");
      t.noLanza(() => api.mtrRenderCabeceraRiesgoHtml({}), "objeto vacío");
      t.cierto(/SIN CLASIFICAR/.test(api.mtrRenderCabeceraRiesgoHtml({})), "sin categoría, lo dice en vez de inventar una");
    });

    t.caso("mtrRenderFallaHtml: sola, produce EXACTAMENTE el mismo fragmento que ya sale dentro del recuadro completo", () => {
      const r = api.mtrResumenClinico(ctxBase); // LDL 148 vs meta 55: hay falla (ver prueba de arriba)
      const fallaSola = api.mtrRenderFallaHtml(r);
      const htmlCompleto = api.mtrRenderResumenClinicoHtml(r);
      t.cierto(fallaSola.length > 0, "hay falla terapéutica en este caso: debe producir HTML");
      t.cierto(htmlCompleto.indexOf(fallaSola.trim()) >= 0, "es el MISMO fragmento que usa el recuadro completo");
      t.cierto(/Falla terapéutica/.test(fallaSola));
    });

    t.caso("mtrRenderFallaHtml: sin fallas (o con r nulo), cadena vacía — no inventa un bloque de falla que no existe", () => {
      t.igual(api.mtrRenderFallaHtml(null), "", "nulo: cadena vacía");
      t.igual(api.mtrRenderFallaHtml({}), "", "sin la clave 'fallas': cadena vacía");
      t.igual(api.mtrRenderFallaHtml({ fallas: { fallas: [] } }), "", "lista de fallas vacía: cadena vacía, no un bloque en blanco");
    });
  },
};
