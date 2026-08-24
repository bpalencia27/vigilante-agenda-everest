// =====================================================================
//  SUITE 46 — Vigencias corregidas, fecha de toma (FTL), sábados por médico
//             y lectura de factores de riesgo del DOM de Everest
//
//  LO QUE ESTA SUITE PROTEGE, en una frase: que ningún examen del paciente
//  quede vencido por culpa de una tabla mal transcrita o de un ajuste de
//  calendario que empuja la toma hacia adelante.
//
//  Las cuatro correcciones frente al Copiloto están declaradas en
//  MTR_CORRECCIONES_NORMA dentro del userscript. Aquí se comprueban una a una
//  contra la tabla portada, para que la diferencia sea visible y no un cambio
//  silencioso: si algún día el Copiloto se arregla y las dos coinciden, estas
//  pruebas lo dirán.
// =====================================================================

// DOM mínimo para probar el lector de radios de Everest: pares SI/NO con el
// mismo `name`, y uno de ellos con el ESPACIO FINAL que trae el HTML real.
function domFalso(marcas) {
  const nodos = [];
  for (const nombre of Object.keys(marcas)) {
    const v = marcas[nombre];
    const si = { name: nombre, value: "true", checked: v === true, type: "radio" };
    const no = { name: nombre, value: "false", checked: v === false, type: "radio" };
    nodos.push(si, no);
  }
  return {
    querySelectorAll(sel) {
      const m = /^input\[name="(.*)"\]$/.exec(sel);
      if (!m) return [];
      const buscado = m[1].replace(/\\"/g, '"');
      return nodos.filter((n) => n.name === buscado);
    },
    querySelector(sel) {
      const r = this.querySelectorAll(sel);
      return r.length ? r[0] : null;
    },
  };
}

module.exports = {
  nombre: "Vigencias corregidas, FTL, sábados del médico y lectura del DOM",
  cubre: [
    "mtrVigenciaDiasNorma", "mtrColapsarVigencia", "mtrEstadoAnalito", "mtrPlanParaclinicos",
    "mtrOrdinalSabadoDelMes", "mtrGrupoDeEsteSabado", "mtrMedicoTrabajaSabado",
    "mtrDeducirGrupoSabado", "mtrDiaValidoParaControlConSabado", "mtrFechaControlSugerida",
    "mtrLeerRadioSiNo", "mtrLeerCampoNumerico", "mtrLeerFactoresRcvDelDom",
    "mtrSabadoMemoriaLeer", "mtrSabadoMemoriaGuardar", "mtrSabadoGrupoDeMedico",
    "mtrSabadoRegistrarObservacion", "mtrSabadoFijarGrupoManual",
  ],

  pruebas(t, api) {
    // ============ LAS CUATRO CORRECCIONES DE LA TABLA ============

    t.caso("CORRECCIÓN 1 — el LDL en ERC G4 vale 120 días, no 180", () => {
      // El Python aplicó el 120 de "CT/LDL/TG" al colesterol total y a los
      // triglicéridos, y dejó el LDL de la misma fila en 180.
      t.igual(api.mtrVigenciaDias("ERC", "ldl", "G4", false, null, null), 180, "así está el port fiel al Copiloto");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "ldl", "G4", false, null, null), 120, "así lo dice la norma");
      // y sus dos compañeros de fila ya estaban bien en los dos:
      t.igual(api.mtrVigenciaDiasNorma("ERC", "colesterol_total", "G4", false, null, null), 120, "colesterol total");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "trigliceridos", "G4", false, null, null), 120, "triglicéridos");
    });

    t.caso("CORRECCIÓN 2 — la RAC en ERC G4 vale 120 días, no 180", () => {
      t.igual(api.mtrVigenciaDias("ERC", "rac", "G4", false, null, null), 180, "el port fiel");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, null), 120, "la norma");
    });

    t.caso("CORRECCIÓN 3 — a un diabético en G1/G2 SÍ se le pide HbA1c", () => {
      t.igual(api.mtrVigenciaDias("ERC", "hba1c", "G1", true, null, null), "BLOQ", "el port fiel la bloquea");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "hba1c", "G1", true, null, null), 180, "la norma la pide a 180 días");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "hba1c", "G2", true, null, null), 180, "igual en G2");
      // Y la compuerta legítima —que sea diabético— sigue funcionando:
      t.igual(api.mtrVigenciaDiasNorma("ERC", "hba1c", "G1", false, null, null), "BLOQ",
        "a un NO diabético se le sigue bloqueando, que es la única compuerta real");
    });

    t.caso("CORRECCIÓN 4 — con RAC>=30 el plazo es 90 días planos, no la mitad", () => {
      // En G1-G3b coinciden (180/2 = 90). La diferencia sale en G4:
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G1", false, null, 45), 90, "G1: 90 días");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, 45), 90,
        "G4: 90 días — no 60, que es lo que daría 'la mitad' de la vigencia ya corregida a 120");
      // Nunca puede quedar POR ENCIMA de la vigencia base.
      t.cierto(api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, 45)
        <= api.mtrVigenciaDiasNorma("ERC", "rac", "G4", false, null, null),
        "el override nunca puede alargar la vigencia");
    });

    t.caso("una RAC por debajo de 30 no dispara el plazo corto", () => {
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G1", false, null, 12), 180, "RAC 12: vigencia normal");
      t.igual(api.mtrVigenciaDiasNorma("ERC", "rac", "G1", false, null, 30), 90, "RAC 30 es el corte, ya cuenta");
    });

    t.caso("los rangos de creatinina se colapsan al superior, y al inferior si la función renal se mueve", () => {
      const v = api.mtrVigenciaDiasNorma("ERC", "creatinina", "G3a", false, null, null);
      t.igual(v, [90, 121], "G3a viene como rango");
      t.igual(api.mtrColapsarVigencia(v, false), 121, "paciente estable: se usa el superior");
      t.igual(api.mtrColapsarVigencia(v, true), 90, "función renal moviéndose: se usa el inferior");
      t.igual(api.mtrColapsarVigencia(180, true), 180, "un número no es un rango: se devuelve igual");
    });

    // ============ ESTADO DE CADA ANALITO ============

    const ctxErc = {
      hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G3b",
      esDm2: true, edad: 68, rac: 12,
    };

    t.caso("un analito sin ningún resultado se declara AUSENTE, no vencido", () => {
      const a = api.mtrEstadoAnalito("CREATININA", null, ctxErc);
      t.igual(a.estado, "A", "estado A");
      t.igual(a.subestado, "sin_historial", "y el subestado dice que nunca se hizo");
      t.igual(a.fecha, null, "sin fecha");
    });

    t.caso("un analito vencido dice cuántos días lleva vencido", () => {
      // creatinina G3b = rango [90,121]; estable -> 121 días. 2026-01-01 + 121 = 2026-05-02.
      const a = api.mtrEstadoAnalito("CREATININA", { fecha: "2026-01-01", valor: 1.5 }, ctxErc);
      t.igual(a.estado, "A", "vencido");
      t.igual(a.subestado, "vencido", "subestado vencido");
      t.cierto(a.diasParaVencer < 0, "los días para vencer debían ser negativos");
      t.cierto(/vencido hace \d+ día/.test(a.motivo), "el motivo debía decir cuántos días, dijo: " + a.motivo);
    });

    t.caso("un analito bloqueado por estadio se declara BLOQ y NO se pide", () => {
      const a = api.mtrEstadoAnalito("PTH", null, Object.assign({}, ctxErc, { estadioAdministrativo: "G1" }));
      t.igual(a.estado, "BLOQ", "PTH está bloqueada en G1");
      t.cierto(/bloqueado por la norma/.test(a.motivo), "y se dice por qué");
    });

    t.caso("la RAC con albuminuria pasa a vigilancia estrecha (estado R)", () => {
      const ctx = Object.assign({}, ctxErc, { rac: 45 });
      const a = api.mtrEstadoAnalito("RAC", { fecha: "2026-07-01", valor: 45 }, ctx);
      t.igual(a.estado, "R", "estado R por albuminuria");
      t.igual(a.vigenciaDias, 90, "y con la vigencia de 90 días");
    });

    // ============ FECHA DE TOMA DE LABORATORIOS ============

    t.caso("CERO VENCIDOS — la toma va al vencimiento más próximo, nunca después", () => {
      const plan = api.mtrPlanParaclinicos(Object.assign({}, ctxErc, {
        ultimos: {
          CREATININA: { fecha: "2026-06-01", valor: 1.5 },
          GLUCOSA: { fecha: "2026-05-01", valor: 105 },
          COLESTEROL_TOTAL: { fecha: "2026-05-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-05-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-05-01", valor: 110 },
          TRIGLICERIDOS: { fecha: "2026-05-01", valor: 150 },
          UROANALISIS: { fecha: "2026-05-01", valor: 1 },
          RAC: { fecha: "2026-05-01", valor: 12 },
          HBA1C: { fecha: "2026-05-01", valor: 7.1 },
        },
      }));
      t.cierto(!!plan.ftl, "debía salir una fecha de toma");
      // Ningún driver vigente puede vencer ANTES de la fecha de toma.
      const antes = plan.drivers.filter((a) => a.vence && a.vence < plan.ftl);
      t.igual(antes.map((a) => a.nombre + "@" + a.vence), [], "hay exámenes que vencen ANTES de la toma");
    });

    t.caso("si el vencimiento cae en domingo, la toma se ADELANTA al sábado", () => {
      // 2026-08-16 es domingo. Un examen que vence ese día:
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-06-01", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-02-17", valor: 1.0 },   // +180 = 2026-08-16 (domingo)
          GLUCOSA: { fecha: "2026-03-01", valor: 95 },
          COLESTEROL_TOTAL: { fecha: "2026-03-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-03-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-03-01", valor: 110 },
          TRIGLICERIDOS: { fecha: "2026-03-01", valor: 150 },
          UROANALISIS: { fecha: "2026-03-01", valor: 1 },
          RAC: { fecha: "2026-03-01", valor: 10 },
        },
      });
      t.igual(plan.ftlSinAjustar, "2026-08-16", "el vencimiento más próximo era el domingo 16");
      t.igual(plan.ftl, "2026-08-15", "y la toma se adelanta al sábado 15, NO al lunes 17");
      t.cierto(plan.seAdelantoPorDiaNoHabil, "y queda constancia de que se movió");
    });

    t.caso("el piso de 14 días JAMÁS retrasa una toma por encima de un vencimiento", () => {
      // Hay un examen ausente (pide piso de 14 días) y otro que vence en 5.
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-09-01", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-03-10", valor: 1.0 },   // +180 = 2026-09-06
          // el resto ausentes -> estado A
        },
      });
      t.cierto(plan.ftl <= "2026-09-06", "la toma no puede caer después del 6-sep, cayó el " + plan.ftl);
      t.cierto(/piso de 14 días la habría dejado vencer/.test(plan.motivoFtl),
        "y el motivo debía explicarlo, dijo: " + plan.motivoFtl);
    });

    t.caso("la cosecha adelanta lo que está por vencer y DIFIERE lo que aún tiene margen", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-03-01", valor: 1.0 },        // vence 2026-08-28
          GLUCOSA: { fecha: "2026-03-20", valor: 95 },            // vence 2026-09-16 (19 d de margen)
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 190 },  // vence 2027-01-28: mucho margen
          COLESTEROL_HDL: { fecha: "2026-08-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-08-01", valor: 110 },
          TRIGLICERIDOS: { fecha: "2026-08-01", valor: 150 },
          UROANALISIS: { fecha: "2026-08-01", valor: 1 },
          RAC: { fecha: "2026-08-01", valor: 10 },
        },
      });
      const nombresDif = plan.diferidos.map((a) => a.clave);
      t.cierto(nombresDif.indexOf("COLESTEROL_TOTAL") >= 0,
        "un colesterol con 5 meses de margen NO se debe adelantar (sería tirar vigencia buena)");
      t.cierto(plan.cosechados.some((a) => a.clave === "CREATININA"), "la creatinina que fija la fecha va incluida");
    });

    t.caso("los exámenes bloqueados por estadio no entran en la orden", () => {
      const plan = api.mtrPlanParaclinicos(Object.assign({}, ctxErc, {
        estadioAdministrativo: "G1", ultimos: {},
      }));
      const claves = plan.ordenar.map((a) => a.clave);
      t.igual(claves.indexOf("PTH"), -1, "la PTH está bloqueada en G1 y no se puede pedir");
      t.igual(claves.indexOf("FOSFORO"), -1, "el fósforo también");
      t.cierto(plan.bloqueados.length >= 3, "y los bloqueados se declaran para poder explicarlo");
    });

    t.caso("los pasajeros se enganchan a la toma sin fijarla", () => {
      const plan = api.mtrPlanParaclinicos(Object.assign({}, ctxErc, {
        estadioAdministrativo: "G4",
        ultimos: { CREATININA: { fecha: "2026-08-01", valor: 2.5 } },
      }));
      t.cierto(plan.ordenar.some((a) => a.clave === "HEMOGLOBINA"),
        "la hemoglobina, que nunca se bloquea, debía ir en la orden");
      // Y no manda sobre la fecha: la hemoglobina está ausente pero su piso de
      // 14 días no puede haber empujado la toma más allá de la creatinina.
      const creat = plan.drivers.find((a) => a.clave === "CREATININA");
      if (creat && creat.vence) t.cierto(plan.ftl <= creat.vence, "un pasajero no puede retrasar la toma");
    });

    // ============ SÁBADOS DEL MÉDICO ============

    t.caso("el ordinal del sábado dentro del mes se calcula bien", () => {
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-01"), 1, "1 de agosto de 2026 es el 1er sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-08"), 2, "2º sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-15"), 3, "3er sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-22"), 4, "4º sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-29"), 5, "5º sábado");
      t.igual(api.mtrOrdinalSabadoDelMes("2026-08-17"), null, "un lunes no es sábado");
    });

    t.caso("el 5º sábado del mes no es de ningún grupo, y se dice 'no sé' en vez de adivinar", () => {
      t.igual(api.mtrGrupoDeEsteSabado("2026-08-29"), null, "el 5º no pertenece a ningún grupo");
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-29", "1-3"), null, "no se afirma que trabaje");
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-29", "2-4"), null, "ni que no trabaje");
    });

    t.caso("cada grupo trabaja sus dos sábados y no los del otro", () => {
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-01", "1-3"), "grupo 1-3, 1er sábado");
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-15", "1-3"), "grupo 1-3, 3er sábado");
      t.falso(api.mtrMedicoTrabajaSabado("2026-08-08", "1-3"), "grupo 1-3 NO trabaja el 2º");
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-08", "2-4"), "grupo 2-4, 2º sábado");
      t.cierto(api.mtrMedicoTrabajaSabado("2026-08-22", "2-4"), "grupo 2-4, 4º sábado");
      t.falso(api.mtrMedicoTrabajaSabado("2026-08-22", "1-3"), "grupo 1-3 NO trabaja el 4º");
    });

    t.caso("sin grupo conocido no se afirma nada sobre los sábados", () => {
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-01", null), null, "sin grupo");
      t.igual(api.mtrMedicoTrabajaSabado("2026-08-01", "cualquier-cosa"), null, "grupo inválido");
    });

    t.caso("dos observaciones coherentes deducen el grupo; una sola es solo conjetura", () => {
      const una = api.mtrDeducirGrupoSabado(["2026-08-01"]);
      t.igual(una.grupo, "1-3", "el 1er sábado apunta al grupo 1-3");
      t.igual(una.confianza, "conjetura", "con una sola observación no basta");
      const dos = api.mtrDeducirGrupoSabado(["2026-08-01", "2026-08-15"]);
      t.igual(dos.confianza, "deducido", "con dos coherentes ya se da por deducido");
    });

    t.caso("observaciones contradictorias NO deducen nada: se declara conflicto", () => {
      const r = api.mtrDeducirGrupoSabado(["2026-08-01", "2026-08-08"]);
      t.igual(r.grupo, null, "no se elige lado con datos que se contradicen");
      t.cierto(r.conflicto, "y se marca el conflicto");
    });

    t.caso("el 5º sábado se registra pero no vota", () => {
      const r = api.mtrDeducirGrupoSabado(["2026-08-29"]);
      t.igual(r.grupo, null, "el 5º sábado no distingue grupos");
      t.igual(r.confianza, "sin_datos", "y no cuenta como observación útil");
      t.igual(r.observados.length, 1, "aunque sí queda registrado");
    });

    t.caso("la memoria por médico distingue lo observado de lo que fijó el médico a mano", () => {
      api.mtrSabadoFijarGrupoManual("77", "");            // limpia por si acaso
      api.mtrSabadoRegistrarObservacion("77", "2026-08-01");
      api.mtrSabadoRegistrarObservacion("77", "2026-08-15");
      const obs = api.mtrSabadoGrupoDeMedico("77");
      t.igual(obs.grupo, "1-3", "deducido de lo observado");
      t.igual(obs.origen, "observado", "origen observado");
      // Ahora el médico lo corrige a mano: su palabra gana.
      api.mtrSabadoFijarGrupoManual("77", "2-4");
      const man = api.mtrSabadoGrupoDeMedico("77");
      t.igual(man.grupo, "2-4", "lo que fija el médico manda");
      t.igual(man.confianza, "manual", "y se distingue de lo deducido");
      api.mtrSabadoRegistrarObservacion("77", "2026-09-05");
      t.igual(api.mtrSabadoGrupoDeMedico("77").grupo, "2-4",
        "una observación posterior NO pisa la corrección del médico");
      api.mtrSabadoFijarGrupoManual("77", "");
    });

    t.caso("la misma fecha registrada dos veces no cuenta dos veces", () => {
      api.mtrSabadoFijarGrupoManual("88", "");
      t.cierto(api.mtrSabadoRegistrarObservacion("88", "2026-08-01"), "primera vez: se registra");
      t.falso(api.mtrSabadoRegistrarObservacion("88", "2026-08-01"), "segunda vez: no");
      t.igual(api.mtrSabadoGrupoDeMedico("88").confianza, "conjetura",
        "abrir el modal dos veces el mismo día no puede 'deducir' el grupo");
    });

    t.caso("un día que no es sábado no se registra como observación de sábado", () => {
      t.falso(api.mtrSabadoRegistrarObservacion("99", "2026-08-17"), "un lunes no dice nada del grupo");
      t.falso(api.mtrSabadoRegistrarObservacion("", "2026-08-01"), "sin id de médico no se guarda nada");
    });

    t.caso("la memoria de sábados nunca lanza, ni siquiera si el almacén devuelve basura", () => {
      // Se invocan directamente el lector y el escritor del almacén: si alguno
      // lanzara, la pantalla de agendamiento se caería entera por una clave
      // corrupta de GM_storage.
      let leido = null;
      t.noLanza(() => { leido = api.mtrSabadoMemoriaLeer(); }, "leer no puede lanzar");
      t.cierto(leido !== null && typeof leido === "object", "siempre devuelve un objeto");
      t.noLanza(() => { api.mtrSabadoMemoriaGuardar({ "1": { origen: "observado", observados: [] } }); },
        "guardar no puede lanzar");
      t.noLanza(() => { api.mtrSabadoMemoriaGuardar(null); }, "ni con null");
    });

    t.caso("el IMC se lee del campo numérico de Everest, y un valor imposible no pasa", () => {
      const d = domFalso({});
      d.querySelector = (sel) => {
        if (sel.indexOf("indiceMasaCorporal") >= 0) return { value: "31,4" };   // coma decimal
        return null;
      };
      t.igual(api.mtrLeerCampoNumerico("monitoreoProgramaPrenatalMadre.indiceMasaCorporal", d), 31.4,
        "la coma decimal del teclado colombiano debe entenderse");
      d.querySelector = () => ({ value: "-5" });
      t.igual(api.mtrLeerCampoNumerico("lo.que.sea", d), null, "un negativo no es un IMC");
      d.querySelector = () => null;
      t.igual(api.mtrLeerCampoNumerico("lo.que.sea", d), null, "campo ausente -> null");
    });

    // ============ FECHA DE CONTROL ============

    t.caso("el control nunca cae en domingo ni en festivo", () => {
      const r = api.mtrFechaControlSugerida("2026-08-12", { grupoSabado: null });
      t.cierto(!!r, "debía salir fecha");
      t.falso(api.mtrEsFestivoCO(r.fecha), "no puede ser festivo");
      t.cierto(api.mtrDiaValidoParaControlConSabado(r.fecha, null), "y debe ser un día válido");
    });

    t.caso("el control cae en sábado SOLO si consta que el médico trabaja sábados (v16.9.0, ya no por grupo)", () => {
      // v16.9.0 — regla única: basta que conste que el médico trabaja sábados; el grupo
      // (1-3/2-4) ya no decide qué sábado le toca (deducción en conflicto con datos reales).
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-08-08", "1-3"), "2º sábado con grupo 1-3: sí (v16.9.0)");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-08-08", "2-4"), "2º sábado con grupo 2-4: sí");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-08", null), "sin constancia de que trabaje sábados no se propone sábado");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-09", "2-4"), "domingo nunca");
    });

    t.caso("el control se separa de la toma al menos 4 días (>=72 h para el resultado)", () => {
      const r = api.mtrFechaControlSugerida("2026-08-17", { grupoSabado: "1-3" });
      t.cierto(r.dias >= 4, "debían pasar al menos 4 días, pasaron " + r.dias);
      t.cierto(r.fecha > "2026-08-17", "y el control es posterior a la toma");
    });

    t.caso("si no hay día válido en la ventana, se corre y se DICE que se corrió", () => {
      // Diciembre 2026: 25 (viernes) es festivo; se busca en una ventana estrecha.
      const r = api.mtrFechaControlSugerida("2026-12-20", { grupoSabado: null, minDias: 5, maxDias: 5 });
      t.cierto(!!r, "no puede devolver nada");
      if (r.fueraDeVentana) t.cierto(/se corrió/.test(r.motivo), "y el motivo debía decirlo");
    });

    // ============ LECTURA DEL DOM DE EVEREST ============

    t.caso("lee un par de radios SI/NO de Everest", () => {
      const d = domFalso({ "AntecedentePatologicos.Hipertension": true, "AntecedentePatologicos.Diabetes": false });
      t.igual(api.mtrLeerRadioSiNo("AntecedentePatologicos.Hipertension", d), true, "SI marcado");
      t.igual(api.mtrLeerRadioSiNo("AntecedentePatologicos.Diabetes", d), false, "NO marcado");
    });

    t.caso("un antecedente que NADIE ha marcado devuelve null, no false", () => {
      // No documentado no es lo mismo que "no lo tiene": si se devolviera false,
      // el recuadro no podría decirle al médico cuántas casillas están en blanco.
      const d = domFalso({ "AntecedentePatologicos.Dislipidemia": null });
      t.igual(api.mtrLeerRadioSiNo("AntecedentePatologicos.Dislipidemia", d), null, "sin marcar -> null");
      t.igual(api.mtrLeerRadioSiNo("campo.que.no.existe", d), null, "campo inexistente -> null");
    });

    t.caso("el ESPACIO FINAL del atributo name no hace desaparecer el tabaquismo", () => {
      // En el HTML real de Everest cuatro campos de Hábitos traen un espacio al
      // final del `name`, y uno de ellos es justo el del tabaquismo. Buscar sin
      // el espacio no encuentra nada y el paciente sale sin ese factor de riesgo.
      const d = domFalso({ "hs.HabitosGestionRiesgo.actualmenteFumaOExfumador ": true });
      t.igual(api.mtrLeerRadioSiNo("hs.HabitosGestionRiesgo.actualmenteFumaOExfumador", d), true,
        "debía encontrarlo probando también con el espacio final");
    });

    t.caso("los factores de riesgo se leen del DOM y se cuenta cuántos quedaron documentados", () => {
      const d = domFalso({
        "AntecedentePatologicos.Hipertension": true,
        "AntecedentePatologicos.Diabetes": true,
        "hs.HabitosGestionRiesgo.actualmenteFumaOExfumador ": true,
        "hs.HabitosGestionRiesgo.sedentarismo": true,
        "hs.HabitosGestionRiesgo.pesoAdecuadoTalla": false,
        "AntecedentePatologicos.nuropatia": true,
      });
      const f = api.mtrLeerFactoresRcvDelDom("", d);
      t.cierto(f.hta, "HTA");
      t.cierto(f.diabetes, "diabetes");
      t.cierto(f.tabaquismo, "tabaquismo (el del espacio final)");
      t.cierto(f.sedentarismo, "sedentarismo");
      t.cierto(f.obesidad, "'¿peso adecuado para la talla?' NO => obesidad");
      t.cierto(f.neuropatia, "neuropatía");
      t.igual(f._documentados, 6, "seis casillas documentadas");
    });

    t.caso("la ECV establecida se toma como la unión de las tres casillas de Everest", () => {
      for (const campo of ["AntecedentePatologicos.ecv", "AntecedentePatologicos.enfermedadCerebroVascular", "AntecedentePatologicos.eventoVascular"]) {
        const d = domFalso({ [campo]: true });
        t.cierto(api.mtrLeerFactoresRcvDelDom("", d).ecvAterescleroticaEstablecida,
          "marcar " + campo + " debía contar como ECV establecida");
      }
    });

    t.caso("roncar y tener sueño NO se convierte en un diagnóstico de apnea", () => {
      const d = domFalso({
        "clinicaPaciente.ronca": true,
        "clinicaPaciente.somnoliencia": true,
        "clinicaPaciente.cansancio": true,
      });
      const f = api.mtrLeerFactoresRcvDelDom("", d);
      t.cierto(f.apneaSugerida, "los tres síntomas juntos SÍ son sugestivos y se sugieren");
      t.falso(f.apneaSueno, "pero NO se dan por diagnosticados: eso sería inventar un factor de riesgo");
      t.igual(api.mtrContarFrMayores(f).lista.indexOf("apnea del sueño"), -1,
        "y por tanto no cuenta en el conteo de factores de riesgo");
    });

    t.caso("si el médico cambió de historia a media lectura, no se devuelven factores de otro paciente", () => {
      const d = domFalso({ "AntecedentePatologicos.Hipertension": true });
      // `_pacienteSigueAbierto` no puede confirmar la cédula en este entorno,
      // así que la lectura se aborta: es la dirección segura.
      t.igual(api.mtrLeerFactoresRcvDelDom("1234567890", d), null,
        "con una cédula que no se puede confirmar, NO se lee nada");
    });
  },
};
