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
    "mtrGrupoSabadoFiable", "mtrSabadoTrabajaEsteMedico",
    "mtrLeerCampoPorRotulo", "mtrLeerCinturaDelDom",
    "mtrConsolidarMtt",            // v17.7.5 — el invariante de las fusiones
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

    // =================================================================================
    //  v18.0.41 — «· ALBUMINURIA: VIGILANCIA ESTRECHA» SOBRE UNA GLICEMIA (hallazgo L35453)
    //
    //  El sufijo pertenece a la promoción a R del RAC con albuminuria. Se pegaba al motivo
    //  de TODO examen vencido porque colgaba de `vencidoBase`, que solo significa «estaba
    //  vencido» y vale igual para la glicemia, la creatinina y el LDL.
    //
    //  Ese motivo es literalmente lo que se pinta en la lista «Ya vencidos» del recuadro
    //  clínico. El médico leía que su paciente tiene albuminuria y vigilancia estrecha sobre
    //  una glicemia, en alguien a quien NADIE le midió la albuminuria: dato inventado en
    //  pantalla, que es lo primero que este proyecto prohíbe.
    // =================================================================================
    t.caso("v18.0.41: el sufijo de albuminuria NO se pega a cualquier examen vencido", () => {
      const sinRac = { hoyIso: "2026-08-31", programa: "HTA", esDm2: false, edad: 60, rac: null };
      const glu = api.mtrEstadoAnalito("GLUCOSA", { fecha: "2025-01-10", valor: 110 }, sinRac);
      t.cierto(/vencido hace \d+ día\(s\)/.test(glu.motivo), "la glicemia sí está vencida: " + glu.motivo);
      t.falso(/albuminuria/i.test(glu.motivo),
        "pero su motivo no puede mencionar albuminuria en un paciente sin RAC medido: " + glu.motivo);

      const ldl = api.mtrEstadoAnalito("COLESTEROL_LDL", { fecha: "2025-02-01", valor: 160 }, sinRac);
      t.falso(/albuminuria/i.test(ldl.motivo), "ni el LDL: " + ldl.motivo);
    });

    t.caso("v18.0.41 (contrapartida): el RAC con albuminuria SÍ conserva su vigilancia estrecha", () => {
      // Sin esto, el arreglo se podría «cumplir» borrando el sufijo de todas partes, y se
      // perdería la prioridad de atención que la v17.6.75 puso ahí a propósito.
      const conRac = { hoyIso: "2026-08-31", programa: "HTA", esDm2: false, edad: 60, rac: 45 };
      const rac = api.mtrEstadoAnalito("RAC", { fecha: "2025-01-10", valor: 45 }, conRac);
      t.igual(rac.estado, "R", "el RAC≥30 se promueve a R");
      t.igual(rac.subestado, "albuminuria", "con su subestado");
      t.cierto(/vencido hace \d+ día\(s\)/.test(rac.motivo), "sigue diciendo que venció");
      t.cierto(/albuminuria: vigilancia estrecha/.test(rac.motivo),
        "y conserva la vigilancia estrecha, que es de quien de verdad la tiene: " + rac.motivo);
    });

    t.caso("un analito sin ningún resultado se declara AUSENTE, no vencido", () => {
      const a = api.mtrEstadoAnalito("CREATININA", null, ctxErc);
      t.igual(a.estado, "A", "estado A");
      t.igual(a.subestado, "sin_historial", "y el subestado dice que nunca se hizo");
      t.igual(a.fecha, null, "sin fecha");
    });

    // [auditoría 25-ago, hallazgo 1.16] sin fecha, el valor real se descartaba SIEMPRE
    // (valor:null), aunque el resultado sí hubiera llegado — alcanzable cuando
    // _extractAtheneaFecha no reconoce el campo de fecha. Consecuencia: se le ordena al
    // paciente un examen que YA TIENE resultado, sin forma de saberlo desde este objeto.
    t.caso("un analito CON valor pero SIN fecha no pierde el valor (bug real: se ponía a null)", () => {
      const a = api.mtrEstadoAnalito("CREATININA", { fecha: null, valor: 1.0 }, ctxErc);
      t.igual(a.estado, "A", "sigue sin poder afirmarse vigente, sin fecha");
      // v17.6.87 — este caso ya NO comparte subestado con "nunca se hizo". Conservar el valor
      // (v17.6.57) no bastaba: quien pinta la pantalla decide por el SUBESTADO, no por el
      // motivo, así que un examen con resultado real seguía mostrándose como "Nunca se le ha
      // tomado". Ahora tiene subestado propio; sigue ordenándose igual (ver el filtro de
      // `faltantes` en mtrPlanParaclinicos), lo que cambia es que no se afirma una falsedad.
      t.igual(a.subestado, "sin_fecha", "subestado propio: hay resultado, falta la fecha");
      t.igual(a.fecha, null, "la fecha sigue sin inventarse");
      t.igual(a.valor, 1.0, "pero el valor real (1.0) debe conservarse, no perderse");
      t.cierto(/hay un resultado/.test(a.motivo), "el motivo debe distinguir esto de 'nunca se hizo': " + a.motivo);
    });

    t.caso("un analito sin fecha NI valor sigue reportando 'no hay ningún resultado registrado'", () => {
      const a = api.mtrEstadoAnalito("CREATININA", { fecha: null, valor: null }, ctxErc);
      t.igual(a.valor, null);
      t.cierto(/no hay ningún resultado registrado/.test(a.motivo), "sin dato real, el motivo original no cambia: " + a.motivo);
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
      t.falso(a.vencidoBase, "todavía vigente: no venció antes de la promoción");
    });

    // =====================================================================
    // v17.6.75 — auditoría 25-ago (1.17): ESTADO R PRIORITARIO PARA RAC≥30 VENCIDO.
    // Antes, el guard `estado !== "A"` bloqueaba la promoción a R cuando el RAC YA
    // estaba vencido — se quedaba en "A" normal, sin la señal de albuminuria. Decisión
    // del médico: "usa el mismo piso/techo que el Estado A normal" — se promueve a R
    // SIEMPRE (vencido o no), pero el motor sigue tratando un RAC vencido-y-promovido
    // con la MISMA urgencia que un Estado A normal (piso 14/techo 21, en "vencidos"),
    // nunca dejando que su fecha YA PASADA se cuele como un "próximo vencimiento".
    // =====================================================================
    t.caso("RAC≥30 VENCIDO: ya no queda bloqueado en Estado A — se promueve a R, con vencidoBase=true", () => {
      // vigencia 90 días (albuminuria): 2026-01-01 + 90 = 2026-04-01, ya vencido para hoyIso 2026-08-16.
      const ctx = Object.assign({}, ctxErc, { rac: 45 });
      const a = api.mtrEstadoAnalito("RAC", { fecha: "2026-01-01", valor: 45 }, ctx);
      t.igual(a.estado, "R", "promovido a R, no bloqueado en A");
      t.igual(a.subestado, "albuminuria");
      t.cierto(a.vencidoBase, "pero la verdad de terreno de que YA venció se conserva");
      t.cierto(a.diasParaVencer < 0, "los días para vencer siguen siendo negativos");
      t.cierto(/vencido hace \d+ día/.test(a.motivo), "el motivo sigue diciendo VENCIDO (nunca 'vigente hasta' una fecha pasada): " + a.motivo);
      t.cierto(/albuminuria/i.test(a.motivo), "y menciona la albuminuria: " + a.motivo);
    });

    t.caso("un RAC vencido SIN albuminuria (RAC<30) no se toca: sigue como Estado A normal", () => {
      const ctx = Object.assign({}, ctxErc, { rac: 12 });
      const a = api.mtrEstadoAnalito("RAC", { fecha: "2026-01-01", valor: 12 }, ctx);
      t.igual(a.estado, "A", "sin albuminuria, nunca se promueve a R");
      t.igual(a.subestado, "vencido");
      t.cierto(a.vencidoBase, "y vencidoBase coincide con estado A, como siempre");
    });

    t.caso("mtrPlanParaclinicos: un RAC≥30 vencido (único disparador) programa la toma con el piso de 14–21 días — NUNCA una fecha ya pasada", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G3b",
        esDm2: false, edad: 60, rac: 45,
        ultimos: {
          RAC: { fecha: "2026-01-01", valor: 45 },   // vencido hace 137 días
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-08-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-08-01", valor: 90 },
          TRIGLICERIDOS: { fecha: "2026-08-01", valor: 120 },
          GLUCOSA: { fecha: "2026-08-01", valor: 95 },
          UROANALISIS: { fecha: "2026-08-01", valor: 1 },
          CREATININA: { fecha: "2026-08-01", valor: 1.2 },
        },
      });
      t.cierto(!!plan.ftl, "hay fecha de toma");
      t.cierto(plan.ftl > "2026-08-16", "CERO VENCIDOS: la toma NUNCA cae en el pasado, aunque el RAC ya vencido tenga un .vence de hace meses");
      t.cierto(plan.ftl >= "2026-08-17" && plan.ftl <= "2026-09-06",
        "cae dentro de la ventana 14–21 días desde hoy (piso/techo de Estado A normal), no antes: " + plan.ftl);
      t.cierto(plan.vencidos.some((a) => a.clave === "RAC"), "el RAC sigue apareciendo en 'Ya vencidos', aunque su estado ahora sea R");
      t.cierto(plan.ordenar.some((a) => a.clave === "RAC"), "y se ordena en esta misma visita");
      t.falso(plan.diferidos.some((a) => a.clave === "RAC"), "nunca queda diferido a un viaje futuro");
    });

    // ============ FECHA DE TOMA DE LABORATORIOS ============

    // [auditoría 25-ago, hallazgo 1.6] sin peso, mtrEvaluarErc no puede calcular el
    // estadio administrativo (null) y mtrVigenciaDias("ERC",...) devuelve null para los 9
    // drivers -> todos NO_APLICA -> el plan se presentaba como "no hay nada que vigilar"
    // cuando la verdad es que falta el peso para saberlo.
    t.caso("ERC sin peso: el plan avisa que FALTA EL PESO, no que 'no hay nada que vigilar'", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: null,
        esDm2: true, edad: 68, rac: 12, ultimos: {},
        pesoFaltaParaEstadio: true,
      });
      t.igual(plan.ftl, null, "sin estadio no se puede fijar una toma");
      t.cierto(/falta el peso/i.test(plan.motivoFtl), "el motivo debe decir explícitamente que falta el peso, dijo: " + plan.motivoFtl);
      t.falso(/no hay ningún examen que vigilar/i.test(plan.motivoFtl), "no debe sonar a que no hay nada pendiente");
    });

    t.caso("ERC sin estadio pero SIN la bandera pesoFaltaParaEstadio: sigue el mensaje genérico de siempre", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: null,
        esDm2: true, edad: 68, rac: 12, ultimos: {},
      });
      t.igual(plan.motivoFtl, "no hay ningún examen que vigilar con este programa y estadio",
        "sin la bandera explícita, el comportamiento previo no cambia");
    });

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
      // Ningún driver VIGENTE puede vencer ANTES de la fecha de toma.
      // v17.54.0 (D9) — el filtro decía «drivers» y el comentario decía «vigentes»: no era
      // lo mismo, y hasta hoy no se notaba porque con el margen del 15 % este paciente no
      // tenía ninguno vencido. Al retirarlo, su HbA1c de 7,1 (meta 7,0) pasa a estar fuera
      // de meta, su vigencia se parte a la mitad y queda VENCIDA desde el 30-jul. Un examen
      // ya vencido no se puede proteger adelantando la toma —ya es tarde— y el plan hace lo
      // correcto con él: lo mete en `vencidos`, lo mete en `ordenar` y ADELANTA la fecha de
      // toma un mes (del 30-sep al 29-ago). Comprobado midiendo el mismo caso con y sin el
      // margen. Lo que este caso protege es que no se cite DESPUÉS de que algo vigente se
      // eche a perder; los ya vencidos son justo lo que la cita viene a resolver.
      // v18.0.135 — con la regla de la entrevista del 02-sep existe un TERCER destino
      // además de «vigente» y «vencido»: la falla terapéutica (subestado "recontrol_falla").
      // Aquí la HbA1c de 7,1 (meta 7,0) parte SU vigencia y la de la glucosa a la mitad:
      // ambas vencen el 30-jul, ANTES de la toma, pero su norma sigue viva hasta el 28-oct,
      // así que NO viajan en `vencidos`. Adelantar la cita no las protege —su ventana del
      // 50 % ya se gastó— y el plan hace con ellas lo correcto: las mete en `ordenar`
      // (comprobado en la suite_49). Este caso sigue protegiendo lo de siempre, que nada
      // VIGENTE se eche a perder antes de la toma, y ahora exige también que TODO lo que
      // había que repetir YA —vencido o en falla terapéutica— viaje en la orden.
      const yaResueltos = new Set((plan.vencidos || []).map((a) => a.nombre)
        .concat(plan.drivers.filter((a) => a.subestado === "recontrol_falla").map((a) => a.nombre)));
      const antes = plan.drivers.filter((a) => a.vence && a.vence < plan.ftl && !yaResueltos.has(a.nombre));
      t.igual(antes.map((a) => a.nombre + "@" + a.vence), [], "hay exámenes VIGENTES que vencen ANTES de la toma");
      t.cierto([...yaResueltos].every((n) => (plan.ordenar || []).some((a) => a.nombre === n)),
        "y todo lo que había que repetir YA (vencido o falla terapéutica) va en la orden: si no, el médico cita y nadie lo pide");
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

    t.caso("v17.6.98: el margen de la cosecha es el 33 %, y por fin hay una prueba que lo fija", () => {
      // Este número no tenía NINGUNA prueba: se podía cambiar y el banco seguía verde.
      // Se descubrió al auditar el ANR, que se apoya justo en él. Vigencia 180 d ->
      // el corte cae en 59,4 d: 55 se cosecha, 65 se difiere. Con el corte viejo del
      // 25 % (45 d) el de 55 se habría diferido, así que este caso los distingue.
      const plan = (fechaCT) => api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", estadioAdministrativo: "G1",
        esDm2: false, edad: 60, rac: 10,
        ultimos: {
          CREATININA: { fecha: "2026-03-01", valor: 1.0 },        // vence 2026-08-28: fija la toma
          COLESTEROL_TOTAL: { fecha: fechaCT, valor: 190 },
          COLESTEROL_HDL: { fecha: fechaCT, valor: 45 },
          COLESTEROL_LDL: { fecha: fechaCT, valor: 110 },
          TRIGLICERIDOS: { fecha: fechaCT, valor: 150 },
          GLUCOSA: { fecha: fechaCT, valor: 95 },
          UROANALISIS: { fecha: fechaCT, valor: 1 },
          RAC: { fecha: fechaCT, valor: 10 },
        },
      });
      // Toma el 2026-08-28. Colesterol del 2026-04-27 -> vence 2026-10-24 -> 57 d de margen.
      const dentro = plan("2026-04-27");
      t.cierto(dentro.cosechados.some((a) => a.clave === "COLESTEROL_TOTAL"),
        "57 d de margen sobre 180 de vigencia (31,7 %) entra: por debajo del 33 %");
      // Colesterol del 2026-04-10 -> vence 2026-10-07 -> 40 d... no: se aleja. Se usa uno más nuevo.
      const fuera = plan("2026-05-20");   // vence 2026-11-16 -> 80 d de margen (44,4 %)
      t.cierto(fuera.diferidos.some((a) => a.clave === "COLESTEROL_TOTAL"),
        "80 d de margen (44,4 %) se difiere: por encima del 33 %");
    });

    // =====================================================================
    // v17.6.98 — EL ANR AGRUPA DE VERDAD
    //
    // Hasta aquí el «agujero negro renal» solo hacía un Math.min contra la fecha ya
    // calculada. Si otro examen vencía antes, el ANR se marcaba igual y la creatinina caía
    // en la regla genérica del 33 % y se iba a `diferidos`: el paciente volvía una segunda
    // vez justo por ella, que es el viaje que el ANR existe para evitar.
    //
    // Medido con el harness sobre 240 planes con el ANR activo: 26 de dos viajes. Y en 0
    // de esos 240 casos sería seguro aplicar la regla literal de v68 (mover la toma al
    // vencimiento de la creatinina): siempre deja vencer otro examen o hace esperar más a
    // uno ya vencido. Por eso se fuerza la creatinina a la toma que ya hay, que es una
    // divergencia declarada frente al spec («Creatinina-ancla no se fuerza»).
    // =====================================================================

    const _planAnr = (estadio, creatIso) => api.mtrPlanParaclinicos({
      hoyIso: "2026-08-26", programa: "ERC", estadioAdministrativo: estadio,
      categoriaRiesgo: "alto", esDm2: false, edad: 68, rac: 12,
      ultimos: {
        CREATININA:       { fecha: creatIso,    valor: 1.7 },
        COLESTEROL_TOTAL: { fecha: "2026-04-01", valor: 190 },
        COLESTEROL_HDL:   { fecha: "2026-04-01", valor: 45 },
        COLESTEROL_LDL:   { fecha: "2026-04-01", valor: 90 },
        TRIGLICERIDOS:    { fecha: "2026-04-01", valor: 120 },
        GLUCOSA:          { fecha: "2026-08-01", valor: 95 },
        UROANALISIS:      { fecha: "2026-08-01", valor: 1 },
        RAC:              { fecha: "2026-08-01", valor: 12 },
      },
    });

    t.caso("v17.6.98: con el ANR activo la creatinina NO se difiere nunca", () => {
      const plan = _planAnr("G3b", "2026-06-20");
      t.cierto(!!plan.anr, "el vector es el que debe ser: ANR activo");
      t.cierto(plan.ftl !== plan.anr.vence, "y la toma la manda otro examen, no la creatinina");
      t.cierto(plan.cosechados.some((a) => a.clave === "CREATININA"), "la creatinina se cosecha igual");
      t.falso(plan.diferidos.some((a) => a.clave === "CREATININA"), "y no queda diferida");
      t.cierto((plan.ordenar || []).some((a) => a.clave === "CREATININA"), "entra en la orden");
    });

    t.caso("v17.6.98: SIN ANR, la creatinina sigue la regla de siempre — el cambio no se desborda", () => {
      // Mismo vector, estadio G2: el ANR no aplica fuera de G3a-G5. Si esta prueba cae, el
      // forzado se está aplicando a pacientes a los que la regla no alcanza.
      const plan = _planAnr("G2", "2026-06-20");
      t.falso(!!plan.anr, "en G2 no hay agujero negro renal");
      t.cierto(plan.diferidos.some((a) => a.clave === "CREATININA"),
        "y la creatinina se difiere como cualquier otro examen con margen de sobra");
      t.falso((plan.ordenar || []).some((a) => a.clave === "CREATININA"), "no entra en la orden");
    });

    t.caso("v17.6.98: se fuerza SOLO la creatinina, no todo lo que tenga margen", () => {
      const plan = _planAnr("G3b", "2026-06-20");
      t.cierto(!!plan.anr, "ANR activo");
      // La glicemia del 1-ago tiene 180 d de vigencia y muchísimo margen: debe seguir diferida.
      t.cierto(plan.diferidos.some((a) => a.clave === "GLUCOSA"),
        "la glicemia con margen de sobra sigue diferida: el ANR no es una excusa para adelantarlo todo");
      t.falso(plan.diferidos.some((a) => a.clave === "CREATININA"), "solo la creatinina se salva del margen");
    });

    // =====================================================================
    // v17.30.0 — ENCARGO DEL MÉDICO (28-ago), reporte en vivo: un paciente con ERC en el
    // que la creatinina forzaba la toma a solo 6 días (ANR activo) traía además glicemia,
    // uroanálisis y HbA1c —cada una a ~65 días de SU PROPIO vencimiento, sin relación con
    // lo renal— porque con la toma tan adelantada por el ANR, el margen del 33% (59,4 d
    // de 180 de vigencia) y encima la gracia de 14 días (v17.29.0, el mismo día) seguían
    // siendo suficientes para arrastrarlas. El médico: "no puedes activar ANR y a su vez
    // los vencidos [la cosecha genérica], trata de equilibrar" — con el ANR gobernando la
    // fecha, SOLO la creatinina y el RAC sincronizado se agrupan de forma automática; el
    // resto de los drivers necesita estar vencido/faltante POR SU CUENTA para entrar. El
    // caso de arriba (v17.6.98, margen de sobra) ya probaba el 33% base; este caso prueba
    // específicamente el margen AJUSTADO — el que antes SÍ se colaba por la gracia.
    // =====================================================================
    t.caso("v17.30.0: con el ANR activo, un examen ajeno a lo renal NO se arrastra aunque su margen quepa en el 33%+gracia", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-28", programa: "ERC", estadioAdministrativo: "G3a", categoriaRiesgo: "moderado",
        esDm2: false, edad: 60, rac: 12,
        ultimos: {
          CREATININA: { fecha: "2026-05-05", valor: 1.3 },  // vence a 6 d: fuerza la toma vía ANR
          GLUCOSA: { fecha: "2026-05-11", valor: 95 },      // vence a 65 d: 33%(59,4)+gracia(14)=73,4 — habría entrado
        },
      });
      t.cierto(!!plan.anr, "ANR activo (control del escenario)");
      t.cierto(plan.cosechados.some((a) => a.clave === "CREATININA"), "la creatinina se agrupa, como siempre");
      t.falso(plan.cosechados.some((a) => a.clave === "GLUCOSA"),
        "la glicemia, sin relación con lo renal, ya NO se arrastra solo porque el ANR adelantó la fecha");
      t.cierto(plan.diferidos.some((a) => a.clave === "GLUCOSA"), "queda diferida, para su propio viaje cuando de verdad haga falta");
      t.falso((plan.ordenar || []).some((a) => a.clave === "GLUCOSA"), "y no se ordena en esta visita");
    });

    t.caso("v17.30.0: con el ANR activo, un examen ajeno a lo renal tampoco se arrastra por el 33% BASE (sin gracia de por medio)", () => {
      // A diferencia de la prueba anterior (que dependía de la gracia de 14 días), aquí el
      // margen de UROANALISIS (50 d de 180 = 27,8%) YA califica para la cosecha genérica del
      // 33% por sí solo, sin necesitar la gracia. Si el guardarraíl del bucle base
      // (`if (anr) {...continue}`) se rompe, esta prueba —y solo esta— cae, aunque la de
      // arriba (que ejercita la gracia) siga en verde: son dos guardarraíles distintos.
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-28", programa: "ERC", estadioAdministrativo: "G3a", categoriaRiesgo: "moderado",
        esDm2: false, edad: 60, rac: 12,
        ultimos: {
          CREATININA: { fecha: "2026-05-05", valor: 1.3 },   // vence a 6 d: fuerza la toma vía ANR
          UROANALISIS: { fecha: "2026-04-26", valor: null }, // vence a 50 d: 33% de 180 = 59,4 d — ya calificaba solo
        },
      });
      t.cierto(!!plan.anr, "ANR activo (control del escenario)");
      t.cierto(plan.cosechados.some((a) => a.clave === "CREATININA"), "la creatinina se agrupa, como siempre");
      t.falso(plan.cosechados.some((a) => a.clave === "UROANALISIS"),
        "el uroanálisis, sin relación con lo renal, ya NO se arrastra por el 33% base solo porque el ANR adelantó la fecha");
      t.cierto(plan.diferidos.some((a) => a.clave === "UROANALISIS"), "queda diferido, para su propio viaje cuando de verdad haga falta");
    });

    t.caso("v17.30.0: SIN ANR, la gracia sigue funcionando exactamente igual que en v17.29.0", () => {
      // Mismo vector que la prueba de ARRASTRE POR GRACIA de más abajo (creatinina en
      // margen normal, sin forzar nada vía ANR): confirma que el guardarraíl nuevo no le
      // quitó nada a la gracia para el caso normal, sin ANR, que es el que existía antes.
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", esDm2: false, edad: 60,
        ultimos: {
          GLUCOSA: { fecha: "2026-04-26", valor: 95 },
          CREATININA: { fecha: "2026-05-11", valor: 1.0 },
        },
      });
      t.falso(!!plan.anr, "sin ANR (HTA puro, sin estadio ERC): control del escenario");
      t.cierto(plan.cosechados.some((a) => a.clave === "CREATININA"),
        "la creatinina sigue entrando por gracia cuando no hay ANR de por medio");
    });

    t.caso("v17.6.98 PUNTA A PUNTA: la franja de los dos viajes queda cerrada", () => {
      // Barrido sobre la antigüedad de la creatinina. Antes de esta versión había una
      // franja (61-67 d en este vector) donde el ANR se declaraba activo —el médico leía
      // «agujero negro renal» en pantalla— y la creatinina salía igualmente fuera de la
      // toma. Ni un solo caso puede quedar así.
      const dosViajes = [];
      for (let n = 40; n <= 110; n++) {
        const creatIso = new Date(Date.UTC(2026, 7, 26) - n * 86400000).toISOString().slice(0, 10);
        const plan = _planAnr("G3b", creatIso);
        if (!plan.anr) continue;
        if (!(plan.ordenar || []).some((a) => a.clave === "CREATININA")) dosViajes.push(n);
      }
      t.igual(dosViajes, [], "con el ANR activo, la creatinina SIEMPRE va en la toma");
    });

    t.caso("v17.6.98: forzar la creatinina NO mueve la fecha de toma ni la de control", () => {
      // El cambio añade un examen a la orden; no cambia el día. La fecha la decide el
      // bloque de arriba, que corre ANTES de la cosecha y no se ha tocado.
      const plan = _planAnr("G3b", "2026-06-20");
      t.igual(plan.ftl, "2026-09-09", "la toma sigue donde la ponen los lípidos vencidos");
      t.cierto(!!(plan.control && plan.control.fecha), "y el control se sigue calculando desde ella");
      t.cierto(plan.control.fecha > plan.ftl, "después de la toma, como siempre");
    });

    // =====================================================================
    // v17.6.72 — auditoría 25-ago (1.15): GRUPO DE LÍPIDOS, vigencia = la más corta
    // (decisión del médico). Colesterol Total, HDL, LDL y Triglicéridos salen de UNA
    // sola muestra de sangre: si CUALQUIERA de los 4 ya necesita repetirse en esta
    // visita, los otros tres SE ORDENAN JUNTOS, aunque su propia vigencia individual
    // todavía les dé margen — no tiene sentido diferirlos a un viaje aparte cuando el
    // tubo ya se está tomando hoy por otro lípido del mismo panel.
    //
    // ERC G4 es el estadio donde la norma YA distingue vigencias distintas dentro del
    // grupo (colesterol_total/ldl/trigliceridos = 120 días, hdl = 180 días — ver
    // CORRECCIÓN 1 más arriba en esta suite), lo que permite construir el escenario
    // real: un colesterol total VENCIDO (120 días, dato viejo) junto a un HDL reciente
    // que, por sí solo, con 180 días de vigencia, tendría margen de sobra y quedaría
    // diferido bajo la regla individual.
    // =====================================================================
    t.caso("GRUPO DE LÍPIDOS (1.15): un colesterol total VENCIDO arrastra a HDL/LDL/Triglicéridos aunque individualmente aún tengan margen", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G4",
        esDm2: false, edad: 68, rac: 12,
        ultimos: {
          COLESTEROL_TOTAL: { fecha: "2026-01-01", valor: 190 },   // vigencia 120 d: ya vencido
          COLESTEROL_HDL: { fecha: "2026-08-01", valor: 45 },      // vigencia 180 d: solísimo, mucho margen
          COLESTEROL_LDL: { fecha: "2026-08-01", valor: 90 },      // vigencia 120 d: también con margen
          TRIGLICERIDOS: { fecha: "2026-08-01", valor: 120 },      // vigencia 120 d: también con margen
        },
      });
      t.cierto(plan.vencidos.some((a) => a.clave === "COLESTEROL_TOTAL"), "el colesterol total está vencido: dispara el grupo");
      const claveEnOrdenar = (k) => plan.ordenar.some((a) => a.clave === k);
      t.cierto(claveEnOrdenar("COLESTEROL_HDL"), "el HDL se ordena JUNTO, aunque su propia vigencia de 180 días le diera margen de sobra");
      t.cierto(claveEnOrdenar("COLESTEROL_LDL"), "el LDL también");
      t.cierto(claveEnOrdenar("TRIGLICERIDOS"), "y los triglicéridos también — los 4 en la MISMA visita");
      t.cierto(plan.cosechados.some((a) => a.clave === "COLESTEROL_HDL"), "el HDL queda como COSECHADO, no como faltante/vencido por su cuenta");
      t.igual(plan.diferidos.filter((a) => ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS"].indexOf(a.clave) >= 0).length, 0,
        "ningún miembro del grupo de lípidos queda diferido cuando otro del mismo grupo ya dispara la visita");
    });

    t.caso("GRUPO DE LÍPIDOS (1.15): si NINGÚN lípido individualmente necesita repetirse, el grupo NO se adelanta a la fuerza (sin falsos positivos)", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G4",
        esDm2: false, edad: 68, rac: 12,
        ultimos: {
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-08-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-08-01", valor: 90 },
          TRIGLICERIDOS: { fecha: "2026-08-01", valor: 120 },
          GLUCOSA: { fecha: "2026-08-01", valor: 95 },
          UROANALISIS: { fecha: "2026-08-01", valor: 1 },
          CREATININA: { fecha: "2026-08-01", valor: 2.0 },
          RAC: { fecha: "2026-08-01", valor: 12 },
        },
      });
      const claves4 = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS"];
      t.igual(plan.ordenar.filter((a) => claves4.indexOf(a.clave) >= 0).length, 0,
        "sin ningún disparador dentro del grupo, ninguno de los 4 se adelanta — el grupo respeta la vigencia individual cuando nadie la necesita todavía");
      t.igual(plan.diferidos.filter((a) => claves4.indexOf(a.clave) >= 0).length, 4, "los 4 quedan diferidos, como antes de esta regla");
    });

    t.caso("GRUPO DE LÍPIDOS (1.15): un miembro del grupo COSECHADO (no vencido/faltante) también arrastra a los demás", () => {
      // Mismo mecanismo, pero el disparador es un lípido que está VIGENTE y se cosechó
      // por su PROPIA vigencia (dentro del margen del 33%), no uno vencido — la regla
      // debe reaccionar igual ante cualquiera de las tres formas de "necesitar
      // repetirse pronto": faltante, vencido o cosechado.
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G4",
        esDm2: false, edad: 68, rac: 12,
        ultimos: {
          // vigencia 120 d; con fecha 2026-04-25 vence ~2026-08-23 — dentro del margen
          // del 33% de 120 (≈40 días) respecto a un FTL cercano a hoy: se cosecha solo.
          TRIGLICERIDOS: { fecha: "2026-04-25", valor: 120 },
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-08-01", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-08-01", valor: 90 },
          GLUCOSA: { fecha: "2026-08-01", valor: 95 },
          UROANALISIS: { fecha: "2026-08-01", valor: 1 },
          CREATININA: { fecha: "2026-08-01", valor: 2.0 },
          RAC: { fecha: "2026-08-01", valor: 12 },
        },
      });
      t.cierto(plan.cosechados.some((a) => a.clave === "TRIGLICERIDOS"), "los triglicéridos se cosechan por su propia vigencia (control del escenario)");
      t.falso(plan.vencidos.some((a) => a.clave === "TRIGLICERIDOS"), "y no están vencidos: el disparador es la cosecha, no el vencimiento");
      t.cierto(plan.ordenar.some((a) => a.clave === "COLESTEROL_HDL"), "el HDL, con vigencia de sobra por su cuenta, se arrastra igual");
      t.cierto(plan.ordenar.some((a) => a.clave === "COLESTEROL_LDL"), "el LDL también");
      t.cierto(plan.ordenar.some((a) => a.clave === "COLESTEROL_TOTAL"), "y el colesterol total también");
    });

    // =====================================================================
    // ARRASTRE POR GRACIA (1.16) — ENCARGO DEL MÉDICO (28-ago): reporte en vivo con
    // creatinina (margen 69 d de una vigencia de 180) y glicemia (margen 54 d, SÍ
    // cosechada) en la misma visita — 15 días de diferencia entre ellas, y aun así el
    // paciente habría vuelto una segunda vez solo por la creatinina. Medido con
    // tools/medir_cercania.js sobre 10.000 pacientes sintéticos ANTES de fijar el
    // número: el médico vio la tabla completa (7/14/21/30 días de gracia) y eligió 14
    // — el mismo piso que ya usa el motor para Estado A, no un número nuevo. La regla:
    // un diferido entra si se pasó de SU PROPIO corte del 33% por 14 días o menos —
    // nunca compara la fecha de un examen contra la de otro.
    t.caso("ARRASTRE POR GRACIA (1.16): la creatinina que se pasó del 33% por 9,6 días entra en la misma visita que la glicemia", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", esDm2: false, edad: 60,
        ultimos: {
          GLUCOSA: { fecha: "2026-04-26", valor: 95 },      // vence 2026-10-23: margen 54 d (cosecha normal)
          CREATININA: { fecha: "2026-05-11", valor: 1.0 },  // vence 2026-11-07: margen 69 d (exceso 9,6 d)
        },
      });
      t.igual(plan.ftl, "2026-08-29", "FTL en el piso de 14 días, retrocedido un día hábil (30-ago cae domingo)");
      t.cierto(plan.cosechados.some((a) => a.clave === "GLUCOSA"), "la glicemia se cosecha por su propio 33% (control del escenario)");
      t.cierto(plan.cosechados.some((a) => a.clave === "CREATININA"),
        "y la creatinina AHORA TAMBIÉN — se pasó de su corte por solo 9,6 días, dentro de la gracia de 14");
      t.falso(plan.diferidos.some((a) => a.clave === "CREATININA"), "ya no queda diferida");
      t.cierto(plan.ordenar.some((a) => a.clave === "CREATININA"), "y se ordena en esta misma visita: un solo viaje, no dos");
    });

    t.caso("ARRASTRE POR GRACIA (1.16): un diferido que se pasa por MÁS de 14 días sigue esperando a su propio viaje", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-16", programa: "HTA", esDm2: false, edad: 60,
        ultimos: {
          GLUCOSA: { fecha: "2026-04-26", valor: 95 },      // vence 2026-10-23: margen 54 d (cosecha normal)
          CREATININA: { fecha: "2026-05-18", valor: 1.0 },  // vence 2026-11-14: margen 76 d (exceso 16,6 d)
        },
      });
      t.igual(plan.ftl, "2026-08-29", "mismo FTL que el caso anterior (control del escenario)");
      t.cierto(plan.diferidos.some((a) => a.clave === "CREATININA"),
        "16,6 días de exceso es MÁS que los 14 de gracia: sigue diferida, no se arrastra a la fuerza");
      t.falso(plan.ordenar.some((a) => a.clave === "CREATININA"), "y no se ordena en esta visita");
    });

    // =====================================================================
    //  LA VENTANA DEL MISMO VIAJE (v18.0.43) — REPORTE EN VIVO DEL MÉDICO (1-sep), con
    //  captura de pantalla: "ESTO TAMPOCO TIENE SENTIDO LA FORMA EN LA QUE SE AGRUPAN
    //  TODOS LOS EXÁMENES QUE INCLUSO ESTAN A MUCHO TIEMPO SE SUGIERE LA REALIZACION EN
    //  DICIEMBRE Y NO ES ASÍ". El plan de la captura ponía la toma el 23 de diciembre
    //  (a 113 días, porque ese día vencía la creatinina) y arrastraba SIETE exámenes que
    //  vencían el 20 de febrero, cada uno rotulado "se aprovecha el mismo viaje" — 59
    //  días de vigencia quemados por examen, y ningún viaje real que compartir todavía.
    //
    //  La cosecha genérica solo corre si la toma cae dentro de MTR_TECHO_ESTADO_A (21 d),
    //  que es la ventana que este proyecto ya llamaba "el mismo viaje". Medido antes de
    //  fijarlo en tools/medir_arrastre_lejano.js.
    // =====================================================================
    const ctxCaptura1Sep = (fechaCreatinina) => ({
      hoyIso: "2026-09-01", programa: "HTA", esDm2: false, edad: 60, rac: 12,
      ultimos: {
        CREATININA: { fecha: fechaCreatinina, valor: 1.0 },
        // Panel completo tomado hace 8 días: vigencia 180 d -> todos vencen el 2027-02-20.
        GLUCOSA: { fecha: "2026-08-24", valor: 95 },
        UROANALISIS: { fecha: "2026-08-24", valor: 1 },
        COLESTEROL_TOTAL: { fecha: "2026-08-24", valor: 180 },
        COLESTEROL_HDL: { fecha: "2026-08-24", valor: 50 },
        COLESTEROL_LDL: { fecha: "2026-08-24", valor: 90 },
        TRIGLICERIDOS: { fecha: "2026-08-24", valor: 120 },
        RAC: { fecha: "2026-08-24", valor: 12 },
      },
    });

    t.caso("VENTANA DEL MISMO VIAJE: con la toma a 113 días, los 7 exámenes que vencen en febrero NO se arrastran a diciembre", () => {
      // La creatinina del 26-jun vence el 23-dic: exactamente la fecha de la captura.
      const plan = api.mtrPlanParaclinicos(ctxCaptura1Sep("2026-06-26"));
      t.igual(plan.ftl, "2026-12-23", "la toma sigue donde manda CERO VENCIDOS: el vencimiento de la creatinina");
      t.igual(plan.cosechados.length, 1, "solo va la creatinina, que es la que vence ese día");
      t.igual(plan.cosechados[0].clave, "CREATININA", "y es ella");
      const claves7 = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS", "GLUCOSA", "UROANALISIS", "RAC"];
      for (const clave of claves7) {
        t.cierto(plan.diferidos.some((a) => a.clave === clave), clave + " queda diferido: vence el 20-feb, no tiene por qué adelantarse 59 días");
        t.falso(plan.ordenar.some((a) => a.clave === clave), clave + " tampoco sale en la lista de qué ordenar");
      }
    });

    t.caso("VENTANA DEL MISMO VIAJE: el grupo de lípidos tampoco arrastra, porque nadie del grupo va ya en esa visita", () => {
      // Contención del guardarraíl: la regla 1.15 no lleva tope de días a propósito (los
      // 4 lípidos salen del mismo paquete de Everest y no se piden sueltos), así que si
      // se colara un lípido por otra puerta, los otros 3 vendrían detrás. No se cuela:
      // 1.15 solo dispara cuando YA va un lípido, y con la toma lejos no va ninguno.
      const plan = api.mtrPlanParaclinicos(ctxCaptura1Sep("2026-06-26"));
      const lipidos = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS"];
      t.igual(plan.cosechados.filter((a) => lipidos.indexOf(a.clave) >= 0).length, 0,
        "ningún lípido se cosecha cuando la cosecha genérica está apagada");
      t.igual(plan.diferidos.filter((a) => lipidos.indexOf(a.clave) >= 0).length, 4, "los 4 siguen diferidos");
    });

    t.caso("VENTANA DEL MISMO VIAJE: el borde son 21 días — a 21 se cosecha, a 22 no", () => {
      // Creatinina del 26-mar: vence el 22-sep, a 21 días exactos de hoy. Los otros 7
      // vencen el 20-nov (margen 59 d, justo dentro del 33% de 180).
      const dentro = api.mtrPlanParaclinicos({
        hoyIso: "2026-09-01", programa: "HTA", esDm2: false, edad: 60, rac: 12,
        ultimos: {
          CREATININA: { fecha: "2026-03-26", valor: 1.0 },
          GLUCOSA: { fecha: "2026-05-24", valor: 95 }, UROANALISIS: { fecha: "2026-05-24", valor: 1 },
          COLESTEROL_TOTAL: { fecha: "2026-05-24", valor: 180 }, COLESTEROL_HDL: { fecha: "2026-05-24", valor: 50 },
          COLESTEROL_LDL: { fecha: "2026-05-24", valor: 90 }, TRIGLICERIDOS: { fecha: "2026-05-24", valor: 120 },
          RAC: { fecha: "2026-05-24", valor: 12 },
        },
      });
      t.igual(dentro.ftl, "2026-09-22", "la toma cae a 21 días exactos (control del escenario)");
      t.igual(dentro.diferidos.length, 0, "dentro de la ventana la cosecha del 33% corre igual que siempre: nadie queda diferido");
      t.cierto(dentro.cosechados.some((a) => a.clave === "GLUCOSA" && a.adelantoDias === 59),
        "y sí se adelantan 59 días — el canje que el médico aprobó en v17.6.0, con el viaje a la vuelta de la esquina");

      // Un solo día más allá: mismo escenario, creatinina del 27-mar (vence el 23-sep).
      const fuera = api.mtrPlanParaclinicos({
        hoyIso: "2026-09-01", programa: "HTA", esDm2: false, edad: 60, rac: 12,
        ultimos: {
          CREATININA: { fecha: "2026-03-27", valor: 1.0 },
          GLUCOSA: { fecha: "2026-05-24", valor: 95 }, UROANALISIS: { fecha: "2026-05-24", valor: 1 },
          COLESTEROL_TOTAL: { fecha: "2026-05-24", valor: 180 }, COLESTEROL_HDL: { fecha: "2026-05-24", valor: 50 },
          COLESTEROL_LDL: { fecha: "2026-05-24", valor: 90 }, TRIGLICERIDOS: { fecha: "2026-05-24", valor: 120 },
          RAC: { fecha: "2026-05-24", valor: 12 },
        },
      });
      t.igual(fuera.ftl, "2026-09-23", "un día más lejos (control del escenario)");
      t.igual(fuera.cosechados.length, 1, "fuera de la ventana solo va la que vence ese día");
      t.igual(fuera.diferidos.length, 7, "los otros siete esperan su propio viaje");
    });

    t.caso("VENTANA DEL MISMO VIAJE: la gracia de 14 días también se apaga con la toma lejos", () => {
      // Mismo escenario del borde, pero con los 7 acompañantes a 74 días de margen: fuera
      // del 33% (59,4) y dentro de la gracia (exceso 14,6 -> no, 14,6 > 14). Se busca
      // exceso <= 14: margen 73 d -> exceso 13,6. Fecha: vence 2026-09-22 + 73 = 2026-12-04.
      const conGracia = api.mtrPlanParaclinicos({
        hoyIso: "2026-09-01", programa: "HTA", esDm2: false, edad: 60, rac: 12,
        ultimos: {
          CREATININA: { fecha: "2026-03-26", valor: 1.0 },       // vence 2026-09-22 (a 21 d)
          GLUCOSA: { fecha: "2026-06-07", valor: 95 },           // vence 2026-12-04: margen 73, exceso 13,6
        },
      });
      t.cierto(conGracia.cosechados.some((a) => a.clave === "GLUCOSA" && a.motivoCosecha === "gracia"),
        "con la toma dentro de la ventana, la gracia entra y lo dice");

      // La misma glicemia con la toma a 113 días: la gracia ya no la arrastra.
      const sinGracia = api.mtrPlanParaclinicos(Object.assign({}, ctxCaptura1Sep("2026-06-26"), {
        ultimos: Object.assign({}, ctxCaptura1Sep("2026-06-26").ultimos, {
          GLUCOSA: { fecha: "2026-10-05", valor: 95 },           // vence 2027-04-03: margen 101, exceso 41,6
        }),
      }));
      t.falso(sinGracia.cosechados.some((a) => a.clave === "GLUCOSA"), "con la toma lejos, ni el 33% ni la gracia la traen");
    });

    t.caso("VENTANA DEL MISMO VIAJE: cada cosechado dice POR QUÉ está en la lista y cuánto se adelanta", () => {
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-09-01", programa: "HTA", esDm2: false, edad: 60, rac: 12,
        ultimos: {
          CREATININA: { fecha: "2026-03-26", valor: 1.0 },
          GLUCOSA: { fecha: "2026-05-24", valor: 95 }, UROANALISIS: { fecha: "2026-05-24", valor: 1 },
          COLESTEROL_TOTAL: { fecha: "2026-05-24", valor: 180 }, COLESTEROL_HDL: { fecha: "2026-05-24", valor: 50 },
          COLESTEROL_LDL: { fecha: "2026-05-24", valor: 90 }, TRIGLICERIDOS: { fecha: "2026-05-24", valor: 120 },
          RAC: { fecha: "2026-05-24", valor: 12 },
        },
      });
      const creat = plan.cosechados.find((a) => a.clave === "CREATININA");
      t.igual(creat.motivoCosecha, "vence_con_la_toma", "la que fija la fecha se marca como tal");
      t.igual(creat.adelantoDias, 0, "y no se adelanta nada");
      const glu = plan.cosechados.find((a) => a.clave === "GLUCOSA");
      t.igual(glu.motivoCosecha, "vigencia", "la que entra por el 33% se marca como tal");
      t.igual(glu.adelantoDias, 59, "y dice los 59 días que se le quitan");
      // Y no se ensucia el objeto original: `drivers` sale del mismo plan y lo leen otras
      // pantallas, así que la marca de cosecha vive solo en la copia.
      const gluDriver = plan.drivers.find((a) => a.clave === "GLUCOSA");
      t.igual(gluDriver.motivoCosecha, undefined, "el driver original no queda marcado");
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

    // ============ v17.6.97 — LA CINTURA, POR RÓTULO ============
    //
    // La fila antropométrica de Everest NO se puede leer por id: cuatro de sus diez
    // casillas comparten dos ids entre sí (`alert_message` e `IMC`), ninguna tiene
    // atributo `name`, y la circunferencia abdominal —la que de verdad es la cintura—
    // es una de las repetidas. Verificado con el diagnóstico que el médico corrió en
    // su propia pantalla el 26-ago. Este DOM falso reproduce esa fila tal cual.
    const everestAntropometria = (valores) => {
      const FILA = [
        ["Peso (Kg): *", "peso"], ["Talla (cm):*", "Talla"], ["IMC:", "IMC"],
        ["Circunferencia abdominal (cm):", "alert_message"],
        ["Perímetro Cefálico (cm):", "IMC"],
        ["Perímetro Braquial (cm):", "alert_message"],
        ["Pliegue Cutáneo Subescapular (mm):", "IMC"],
        ["Pliegue Cutáneo del Tríceps (mm):", "alert_message"],
        ["Perímetro de pantorrilla (cm):", "perimetroPantorrilla"],
        ["Cintura pélvica (cm):", "cinturaPelvica"],
      ];
      const inputs = FILA.map(([rot, id]) => {
        const celdaRot = { textContent: rot, innerText: rot, previousElementSibling: null };
        const input = {
          id: id, value: (valores && valores[rot] != null) ? String(valores[rot]) : "",
          tagName: "INPUT", type: "number", getAttribute: () => null, closest: () => null,
        };
        input.parentElement = { previousElementSibling: celdaRot, parentElement: null };
        return input;
      });
      return { querySelectorAll: (sel) => (/input/.test(sel) ? inputs : []), querySelector: () => null };
    };

    t.caso("v17.6.97: la cintura es la CIRCUNFERENCIA ABDOMINAL, nunca la cintura pélvica (que es la cadera)", () => {
      // El defecto que esto cierra: mtrLeerCinturaDelDom leía `cinturaPelvica`. Como la
      // cadera SIEMPRE mide más que la cintura, cablearla habría marcado obesidad central
      // en casi todo paciente — un factor de riesgo mayor falso, meta de LDL más estricta
      // y más exámenes. Estaba muerta, así que no llegó a hacer daño.
      const d = everestAntropometria({
        "Circunferencia abdominal (cm):": "104",
        "Cintura pélvica (cm):": "118",
        "Peso (Kg): *": "82",
      });
      t.igual(api.mtrLeerCinturaDelDom(d), 104, "lee la abdominal");
      t.cierto(api.mtrLeerCinturaDelDom(d) !== 118, "y JAMÁS la pélvica, que es la cadera");
      // El lector genérico sí puede traer la cadera, si algún día se pide a propósito.
      t.igual(api.mtrLeerCampoPorRotulo(/cintura\s+p[ée]lvica/i, d), 118, "la cadera existe, pero hay que pedirla por su nombre");
      t.igual(api.mtrLeerCampoPorRotulo(/peso/i, d), 82, "y el mismo lector sirve para el resto de la fila");
    });

    t.caso("v17.6.97: un rótulo que casa con DOS casillas devuelve null, no la primera", () => {
      // En esa fila hay dos «Perímetro» (cefálico y braquial) y dos «Pliegue Cutáneo».
      // Un id repetido ya costó una lectura equivocada; una coincidencia ambigua no se
      // resuelve eligiendo una.
      const d = everestAntropometria({ "Perímetro Cefálico (cm):": "55", "Perímetro Braquial (cm):": "30" });
      t.igual(api.mtrLeerCampoPorRotulo(/per[íi]metro/i, d), null, "dos coincidencias: null");
      t.igual(api.mtrLeerCampoPorRotulo(/pliegue/i, d), null, "otros dos: null");
      t.igual(api.mtrLeerCampoPorRotulo(/no\s+existe\s+este\s+campo/i, d), null, "cero coincidencias: null");
      t.igual(api.mtrLeerCampoPorRotulo(/circunferencia\s+abdominal/i, d), null, "presente pero vacía: null, no cero");
    });

    t.caso("v17.6.97: una cintura imposible no pasa, y nunca se inventa", () => {
      t.igual(api.mtrLeerCinturaDelDom(everestAntropometria({})), null, "casilla vacía");
      t.igual(api.mtrLeerCinturaDelDom(everestAntropometria({ "Circunferencia abdominal (cm):": "5" })), null, "5 cm no es un paciente");
      t.igual(api.mtrLeerCinturaDelDom(everestAntropometria({ "Circunferencia abdominal (cm):": "900" })), null, "900 cm tampoco");
      t.igual(api.mtrLeerCinturaDelDom(everestAntropometria({ "Circunferencia abdominal (cm):": "-80" })), null, "un negativo tampoco");
      t.igual(api.mtrLeerCinturaDelDom(everestAntropometria({ "Circunferencia abdominal (cm):": "104,5" })), 104.5, "y la coma decimal sí, que es como escribe Everest");
      t.noLanza(() => api.mtrLeerCinturaDelDom(null), "sin documento no puede lanzar");
      t.igual(api.mtrLeerCinturaDelDom({}), null, "un documento sin querySelectorAll tampoco lanza");
    });

    t.caso("v17.6.97 CABLEADO — la cintura se lee en los cuatro sitios que la necesitan", () => {
      // Los cuatro puntos viven dentro de funciones de interfaz que el banco no puede
      // ejecutar (necesitan el Panel abierto y el DOM de Everest). Se protegen por texto
      // fuente, igual que la regla única de sábado en la suite 68. Lo que no se puede
      // ejecutar aquí, al menos no se puede borrar sin que caiga una prueba.
      const src = require("fs").readFileSync(require("./harness").RUTA, "utf8");
      // v18.0.33 — los dos primeros puntos (abrir el Panel y el repaso de los 20 s) ya NO se
      // fijan por texto fuente: leían la cintura con tres lectores sueltos, y solo uno de los
      // cuatro datos llevaba guarda de identidad, así que con otra historia en pantalla se
      // colaban las cifras del paciente de al lado. Ahora los dos pasan por
      // mtrPanelFactoresDePantalla, que es una función NOMBRADA y por tanto EJECUTABLE: la
      // prueba de conducta vive en suite_63 («Cruce de pacientes»), que es mejor red que
      // cualquier comprobación de texto. Aquí solo se fija que los dos sitios sigan usándola.
      const usos = (src.match(/mtrPanelFactoresDePantalla\(apt\.doc_id, document\)/g) || []).length;
      t.igual(usos, 2,
        "los DOS sitios (abrir el Panel y el repaso de los 20 s) leen por la función con guarda de identidad");
      t.cierto(/const c = \(typeof mtrLeerCinturaDelDom === "function"\) \? mtrLeerCinturaDelDom\(d\) : null;\s*\n\s*if \(c != null\) f\.cinturaCm = c;/.test(src),
        "y esa función sigue leyendo la cintura (si se cae de ahí, se cae de los dos sitios a la vez)");
      t.cierto(/partes\.push\("cintura=" \+ \(cDom == null \? "" : cDom\)\);/.test(src),
        "y entra en la FIRMA: sin esto, escribirla no contaría como «algo cambió» (lección del peso, v17.6.75)");
      t.cierto(/const cinturaDom = _mismoPac \? mtrLeerCinturaDelDom\(\) : null;/.test(src),
        "el contexto del motor la lee dentro del guard anti-cruce de pacientes");
      t.cierto(/if \(mtrFloat\(factores\.cinturaCm\) === null\) factores\.cinturaCm = cinturaDom;/.test(src),
        "y no pisa lo que el médico ya hubiera documentado a mano");
      t.falso(/mtrLeerCampoNumerico\("cinturaPelvica"/.test(src),
        "y NADIE vuelve a leer cinturaPelvica como si fuera la cintura");
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

    t.caso("el control cae en sábado SOLO si consta que el médico trabaja sábados", () => {
      // v16.9.0 — primer filtro, y sigue mandando: si no consta agenda propia en sábado, no
      // se propone ninguno. Un GRUPO suelto (string del modelo viejo) no dice de dónde salió,
      // así que habilita los sábados pero no los afina — ver v17.6.93 más abajo.
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-08-08", "1-3"), "2º sábado con grupo 1-3 suelto: sí");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-08-08", "2-4"), "2º sábado con grupo 2-4: sí");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-08", null), "sin constancia de que trabaje sábados no se propone sábado");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-08-09", "2-4"), "domingo nunca");
    });

    // ============ v17.6.93 — EL GRUPO VUELVE, PERO SOLO SI ES FIABLE ============
    // Decisión del médico (27-ago) tras ver la medición sobre septiembre de 2026: con grupo
    // 1-3 se le ofrecen 2 de 4 sábados; con su deducción REAL, que salió en conflicto el
    // 20-ago, se le ofrecerían CERO. De ahí la regla: el grupo afina cuando se puede confiar
    // en él, y cuando no, se cae a la regla de v16.9.0 (ofrecer de más antes que esconder).

    t.caso("mtrGrupoSabadoFiable exige constancia positiva de fiabilidad", () => {
      t.igual(api.mtrGrupoSabadoFiable({ grupo: "1-3", confianza: "deducido" }), "1-3", "deducido: fiable");
      t.igual(api.mtrGrupoSabadoFiable({ grupo: "2-4", confianza: "manual" }), "2-4", "fijado a mano: fiable");
      t.igual(api.mtrGrupoSabadoFiable({ grupo: "1-3", confianza: "conjetura" }), null,
        "una sola observación es una corazonada: no se le quita un sábado por eso");
      t.igual(api.mtrGrupoSabadoFiable({ grupo: "1-3", confianza: "deducido", conflicto: true }), null,
        "en conflicto NUNCA, aunque venga con grupo (es el caso real del 20-ago)");
      t.igual(api.mtrGrupoSabadoFiable({ grupo: null, confianza: "sin_datos" }), null, "sin datos");
      t.igual(api.mtrGrupoSabadoFiable({ grupo: "1-3" }), null,
        "un grupo que no dice de dónde salió tampoco basta");
      t.igual(api.mtrGrupoSabadoFiable({ grupo: "loquesea", confianza: "deducido" }), null, "grupo que no existe");
      t.igual(api.mtrGrupoSabadoFiable("1-3"), null, "string del modelo viejo: no es fiable");
      t.igual(api.mtrGrupoSabadoFiable(true), null, "booleano: tampoco");
      t.igual(api.mtrGrupoSabadoFiable(null), null, "null: tampoco");
    });

    t.caso("con el grupo FIABLE se afinan los sábados de septiembre de 2026", () => {
      // sep-2026: 5 (1º), 12 (2º), 19 (3º), 26 (4º).
      const g13 = { habilitado: true, observados: ["2026-08-01", "2026-08-15"], grupo: "1-3", confianza: "deducido", conflicto: false };
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-09-05", g13), "1º sábado: le toca");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-09-12", g13), "2º sábado: NO le toca");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-09-19", g13), "3º sábado: le toca");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-09-26", g13), "4º sábado: NO le toca");

      const g24 = { habilitado: true, observados: ["2026-08-08", "2026-08-22"], grupo: "2-4", confianza: "deducido", conflicto: false };
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-09-05", g24), "el otro grupo, al revés");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-09-12", g24), "2º sábado: le toca");
    });

    t.caso("EL FALLO DEL 20-AGO NO PUEDE VOLVER: en conflicto se ofrecen TODOS los sábados", () => {
      // Es el caso real del médico: tiene agendas propias en sábados de los DOS grupos.
      // Con la regla vieja de grupos eso dejaba el grupo en null y se le tachaban los cuatro.
      const conf = { habilitado: true, observados: ["2026-08-01", "2026-08-08"], grupo: null, confianza: "conflicto", conflicto: true };
      for (const iso of ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"]) {
        t.cierto(api.mtrDiaValidoParaControlConSabado(iso, conf), "en conflicto se ofrece el " + iso);
      }
      const conj = { habilitado: true, observados: ["2026-08-01"], grupo: "1-3", confianza: "conjetura", conflicto: false };
      for (const iso of ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"]) {
        t.cierto(api.mtrDiaValidoParaControlConSabado(iso, conj), "con una conjetura se ofrece el " + iso);
      }
    });

    t.caso("el 5º sábado del mes no es de ningún grupo: no se esconde", () => {
      // 2026-10-31 es el 5º sábado de octubre. Ningún grupo lo reclama; si se descartara,
      // el médico perdería un día en el que sí puede tener agenda.
      const g13 = { habilitado: true, observados: ["2026-08-01", "2026-08-15"], grupo: "1-3", confianza: "deducido", conflicto: false };
      t.igual(api.mtrGrupoDeEsteSabado("2026-10-31"), null, "el 5º sábado no pertenece a ningún grupo");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-10-31", g13), "y aun así se ofrece");
    });

    t.caso("el grupo no resucita un sábado si NO consta que el médico trabaje sábados", () => {
      // El filtro de v16.9.0 va primero: sin agenda propia observada, ningún grupo lo salva.
      const sinAgenda = { habilitado: false, observados: [], grupo: "1-3", confianza: "deducido", conflicto: false };
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-09-05", sinAgenda), "su propio grupo, pero sin constancia: no");
    });

    t.caso("CABLEADO REAL — lo que mtrSabadoTrabajaEsteMedico entrega BASTA para afinar", () => {
      // Punta a punta: nadie construye a mano el objeto en producción. El que viaja al motor
      // (`grupoSabado:` en el contexto de mtrResumenClinico) lo fabrica esta función leyendo
      // la memoria por médico. Si vuelve a dejarse por el camino `grupo`/`confianza`/`conflicto`
      // —como hacía hasta v17.6.92— la regla de grupo queda escrita y sin cablear, y esta
      // prueba es la única que lo nota.
      api.mtrSabadoFijarGrupoManual("sab93a", "");
      api.mtrSabadoRegistrarObservacion("sab93a", "2026-08-01");   // 1º
      api.mtrSabadoRegistrarObservacion("sab93a", "2026-08-15");   // 3º -> deducido 1-3
      const info = api.mtrSabadoTrabajaEsteMedico("sab93a");
      t.cierto(info.habilitado, "consta que trabaja sábados");
      t.igual(api.mtrGrupoSabadoFiable(info), "1-3", "y su grupo llega entero y fiable");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-09-05", info), "1º sábado: le toca");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-09-12", info), "2º sábado: NO le toca");
      t.cierto(api.mtrDiaValidoParaControlConSabado("2026-09-19", info), "3º sábado: le toca");
      t.falso(api.mtrDiaValidoParaControlConSabado("2026-09-26", info), "4º sábado: NO le toca");
    });

    t.caso("CABLEADO REAL — con la deducción en conflicto, el mismo camino ofrece los cuatro", () => {
      api.mtrSabadoFijarGrupoManual("sab93b", "");
      api.mtrSabadoRegistrarObservacion("sab93b", "2026-08-01");   // 1º
      api.mtrSabadoRegistrarObservacion("sab93b", "2026-08-08");   // 2º -> conflicto
      const info = api.mtrSabadoTrabajaEsteMedico("sab93b");
      t.cierto(info.conflicto === true, "el conflicto viaja con el objeto");
      t.igual(api.mtrGrupoSabadoFiable(info), null, "y por eso el grupo no se usa");
      for (const iso of ["2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26"]) {
        t.cierto(api.mtrDiaValidoParaControlConSabado(iso, info), "se ofrece el " + iso);
      }
    });

    t.caso("la fecha de control no cae en un sábado del OTRO grupo", () => {
      // Toma el sábado 2026-09-05: el objetivo (+7) es el sábado 12, que NO es de su grupo.
      const g13 = { habilitado: true, observados: ["2026-08-01", "2026-08-15"], grupo: "1-3", confianza: "deducido", conflicto: false };
      const r = api.mtrFechaControlSugerida("2026-09-05", { grupoSabado: g13 });
      t.cierto(!!r, "debía salir fecha");
      t.cierto(r.fecha !== "2026-09-12", "el 2º sábado no es suyo: no se propone (salió " + r.fecha + ")");
      t.cierto(api.mtrDiaValidoParaControlConSabado(r.fecha, g13), "y la que salga tiene que ser válida");
    });

    // ============ v18.0.140 (f) — LA SUGERENCIA AUTOMÁTICA YA NO IMPONE SÁBADOS AJENOS ============
    // Caso real del 4-sep: «me dice que escoja el sábado 21 pero ese día no trabajo». Los
    // chips pueden OFRECER un sábado «por confirmar» (se descarta a un clic, con su title),
    // pero la 🎯 que alimenta «Pasar a la fecha sugerida» ahora exige constancia fiable de
    // que ESE sábado lo trabaja el médico.

    t.caso("mtrSabadoSugerible solo con grupo fiable y sábado PROPIO", () => {
      const g13 = { habilitado: true, observados: ["2026-08-01", "2026-08-15"], grupo: "1-3", confianza: "deducido", conflicto: false };
      t.cierto(api.mtrSabadoSugerible("2026-09-05", g13), "1º sábado de su grupo: sugerible");
      t.falso(api.mtrSabadoSugerible("2026-09-12", g13), "2º sábado del OTRO grupo: la 🎯 no puede imponerlo");
      t.falso(api.mtrSabadoSugerible("2026-10-31", g13), "el 5º sábado no es de nadie: se ofrece a un clic, pero no se sugiere");
      const conj = { habilitado: true, observados: ["2026-08-01"], grupo: "1-3", confianza: "conjetura", conflicto: false };
      t.falso(api.mtrSabadoSugerible("2026-09-05", conj), "grupo en conjetura («por confirmar»): no sugerible");
      const conf = { habilitado: true, observados: ["2026-08-01", "2026-08-08"], grupo: null, confianza: "conflicto", conflicto: true };
      t.falso(api.mtrSabadoSugerible("2026-09-05", conf), "deducción en conflicto: no sugerible");
      const sinAgenda = { habilitado: false, observados: [], grupo: "1-3", confianza: "deducido", conflicto: false };
      t.falso(api.mtrSabadoSugerible("2026-09-05", sinAgenda), "sin constancia de que trabaje sábados: claro que no");
      t.falso(api.mtrSabadoSugerible("2026-09-05", null), "y sin objeto de sábados, tampoco");
    });

    t.caso("con sabadoSoloFiable la espiral SE SALTA el sábado por confirmar", () => {
      // Toma el sábado 2026-09-05: el objetivo (+7) es el sábado 12, que con la deducción
      // en conflicto sí se ofrece en los chips, pero no se puede imponer como sugerencia:
      // la espiral lo salta y cae en el viernes 11.
      const conf = { habilitado: true, observados: ["2026-08-01", "2026-08-08"], grupo: null, confianza: "conflicto", conflicto: true };
      const r = api.mtrFechaControlSugerida("2026-09-05", { grupoSabado: conf, sabadoSoloFiable: true });
      t.cierto(!!r, "debía salir fecha");
      t.falso(r.esSabado, "la sugerencia estricta no puede caer en sábado por confirmar (salió " + r.fecha + ")");
      t.cierto(r.fecha !== "2026-09-12", "el sábado 12 se saltó en la espiral");
      // Compatibilidad: sin el flag, los demás llamadores conservan la conducta permisiva
      // histórica (no se les rompe nada al actualizar).
      const rP = api.mtrFechaControlSugerida("2026-09-05", { grupoSabado: conf });
      t.cierto(rP.esSabado && rP.fecha === "2026-09-12", "sin el flag el +7 permisivo sigue siendo el sábado 12");
    });

    t.caso("el sábado PROPIO sí puede ser la sugerencia estricta", () => {
      const g13 = { habilitado: true, observados: ["2026-08-01", "2026-08-15"], grupo: "1-3", confianza: "deducido", conflicto: false };
      const r = api.mtrFechaControlSugerida("2026-09-12", { grupoSabado: g13, sabadoSoloFiable: true });
      t.igual(r.fecha, "2026-09-19", "+7 del sábado 12 es el sábado 19, 3º y suyo: se mantiene");
      t.cierto(r.esSabado, "y llega marcado como sábado");
    });

    t.caso("EL MOTOR YA NO IMPONE ese sábado — mtrPlanParaclinicos cablea el modo estricto", () => {
      // Las pruebas de arriba demuestran que mtrFechaControlSugerida SABE saltarse el
      // sábado por confirmar; esta demuestra que el motor de verdad —el que alimenta la 🎯
      // de «Pasar a la fecha sugerida»— lo pidió así (`sabadoSoloFiable: true` en la
      // llamada dentro de mtrPlanParaclinicos). La auditoría de mutaciones de la v18.0.140
      // detectó que sin esta prueba el flag podía borrarse de la llamada y todo seguía en
      // verde: la capacidad estaba probada, el cableado no.
      //
      // Montaje: un RAC de 90 días (albuminuria) tomado el 2026-06-07 vence EXACTO el
      // sábado 2026-09-05, que es hábil — la toma cae en sábado, como en el caso real.
      const plan = api.mtrPlanParaclinicos({
        hoyIso: "2026-08-22", programa: "ERC", estadioAdministrativo: "G3b",
        esDm2: true, edad: 68, rac: 45,
        grupoSabado: { habilitado: true, observados: ["2026-08-01", "2026-08-08"], grupo: null, confianza: "conflicto", conflicto: true },
        ultimos: {
          RAC: { fecha: "2026-06-07", valor: 45 },
          CREATININA: { fecha: "2026-08-20", valor: 1.2 },
          GLUCOSA: { fecha: "2026-08-20", valor: 95 },
          COLESTEROL_TOTAL: { fecha: "2026-08-20", valor: 190 },
          COLESTEROL_HDL: { fecha: "2026-08-20", valor: 45 },
          COLESTEROL_LDL: { fecha: "2026-08-20", valor: 90 },
          TRIGLICERIDOS: { fecha: "2026-08-20", valor: 120 },
          UROANALISIS: { fecha: "2026-08-20", valor: 1 },
          HBA1C: { fecha: "2026-08-20", valor: 6.8 },
        },
      });
      t.igual(plan.ftl, "2026-09-05", "la toma es el sábado 2026-09-05 (vence el RAC): el sábado es hábil");
      t.cierto(!!plan.control, "y el motor propone fecha de control");
      t.cierto(plan.control.fecha !== "2026-09-12",
        "el +7 (sábado 12) es de un grupo que NO consta fiable: el motor no puede imponerlo (salió " + plan.control.fecha + ")");
      t.falso(plan.control.esSabado, "la sugerencia del motor cae en día de semana, no en un sábado por confirmar");
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

    // =================================================================
    //  v17.7.5 — MTT-CONSOLIDA: la cláusula ya se cumple, y ahora está FIJADA
    //  El spec pide «order_list = incluidos + drivers debidos + pasajeros no bloqueados +
    //  MTT fusionados». En el código, order_list es solo `claves(plan.ordenar)` y las
    //  fusiones salen por un campo aparte — sobre el papel, un hueco.
    //
    //  Medido antes de escribir nada: 1.440 planes, 128 con fusión MTT, y **cero** fusiones
    //  fuera de order_list. No es casualidad, es el mecanismo: una fusión exige que la toma
    //  caiga EN O DESPUÉS de la fecha de recontrol, y un analito cuyo recontrol ya venció
    //  para cuando llega la toma entra al plan por su propio pie.
    //
    //  Por eso NO se añadió una unión explícita: sería una línea que ninguna mutación puede
    //  matar —no cambia nada en ningún caso alcanzable— y este proyecto ya arrastra
    //  bastantes ramas inertes. Lo que sí faltaba era esta prueba: convierte la coincidencia
    //  en un invariante que se pone rojo el día que la Cosecha cambie.
    // =================================================================
    t.caso("v17.7.5 — toda fusión MTT está en la lista de órdenes (invariante, no coincidencia)", () => {
      const f = (d) => new Date(Date.UTC(2026, 7, 16) - d * 86400000).toISOString().slice(0, 10);
      const ALIAS = { ldl: "COLESTEROL_LDL", hba1c: "HBA1C", glicemia: "GLUCOSA" };
      let conFusion = 0, fuera = 0;
      for (const aLdl of [1, 60, 140]) {
        for (const aOtros of [1, 90, 175]) {
          for (const creat of [0.9, 1.6, 2.4]) {
            for (const hba1c of [null, 11.5]) {
              const r = api.mtrResumenClinico({
                hoyIso: "2026-08-16", edad: 66, sexo: "M", pesoKg: 80, creatinina: creat,
                ct: 300, hdl: 35, ldl: 260, paSistolica: 150, paDiastolica: 90, hba1c: hba1c,
                factores: { hta: true, diabetes: hba1c != null },
                ultimos: {
                  CREATININA: { fecha: f(aOtros), valor: creat },
                  COLESTEROL_LDL: { fecha: f(aLdl), valor: 260 },
                  COLESTEROL_TOTAL: { fecha: f(aOtros), valor: 300 },
                  COLESTEROL_HDL: { fecha: f(aOtros), valor: 35 },
                  TRIGLICERIDOS: { fecha: f(aOtros), valor: 250 },
                  GLUCOSA: { fecha: f(aOtros), valor: 140 },
                  RAC: { fecha: f(aOtros), valor: 12 },
                  UROANALISIS: { fecha: f(aOtros), valor: 1 },
                  HEMOGLOBINA: { fecha: f(aOtros), valor: 14 },
                  HBA1C: hba1c != null ? { fecha: f(aLdl), valor: hba1c } : undefined,
                },
              });
              const fus = (r.fallas && r.fallas.fusiones) || [];
              if (!fus.length) continue;
              conFusion++;
              const orden = (r.plan.ordenar || []).map((x) => x.clave);
              for (const x of fus) {
                const k = ALIAS[String(x.analito).toLowerCase()] || String(x.analito).toUpperCase();
                if (orden.indexOf(k) < 0) fuera++;
              }
            }
          }
        }
      }
      t.cierto(conFusion > 0, "el barrido tiene que producir fusiones, o no estaría probando nada");
      t.igual(fuera, 0,
        "una falla grave que se retoma en la misma toma TIENE que estar en la orden: si no, el médico la agenda y nadie la pide");
    });


    // =================================================================
    //  v17.7.5 — LA CLÁUSULA DEL RAC, LA ÚLTIMA RAMA DEL SPEC SIN CONSTRUIR
    //  v68: «RAC sincroniza si venc<=Vc+60d y reinicia» (Vc = vencimiento de la creatinina).
    //  Medido ANTES de escribirla: 2.016 planes, 672 con ANR, 480 con el RAC dentro de la
    //  ventana — y **72 salían DIFERIDOS**: el paciente volvía una segunda vez solo por el
    //  RAC. Después: 0. Contención sobre 2.688 planes: 0 cambian la fecha de toma, 0 la de
    //  control, 88 cambian la lista y en los 88 lo único que cambia es que se añade el RAC.
    // =================================================================
    const _racVector = (opts) => {
      const o = opts || {};
      const f = (d) => new Date(Date.UTC(2026, 7, 16) - d * 86400000).toISOString().slice(0, 10);
      return api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 66, sexo: "M", pesoKg: 80,
        creatinina: o.creatinina != null ? o.creatinina : 1.4,
        ct: 200, hdl: 45, ldl: 100, paSistolica: 130, paDiastolica: 80, rac: 45,
        factores: { hta: true, diabetes: true },
        ultimos: {
          CREATININA: { fecha: f(o.aCreat != null ? o.aCreat : 90), valor: o.creatinina != null ? o.creatinina : 1.4 },
          RAC: { fecha: f(o.aRac != null ? o.aRac : 10), valor: 45 },
          COLESTEROL_LDL: { fecha: f(5), valor: 100 }, COLESTEROL_TOTAL: { fecha: f(5), valor: 200 },
          COLESTEROL_HDL: { fecha: f(5), valor: 45 }, TRIGLICERIDOS: { fecha: f(5), valor: 150 },
          GLUCOSA: { fecha: f(5), valor: 100 }, UROANALISIS: { fecha: f(5), valor: 1 },
          HBA1C: { fecha: f(5), valor: 6.5 },
        },
      });
    };
    const _clavesDe = (l) => (l || []).map((x) => x && x.clave).filter(Boolean);

    t.caso("v17.7.5 — con el ANR activo, el RAC que vence dentro de Vc+60d entra en la toma", () => {
      const r = _racVector({});
      t.cierto(!!r.plan.anr, "el vector tiene que activar el ANR, o no estaría probando la cláusula");
      t.cierto(_clavesDe(r.plan.ordenar).indexOf("RAC") >= 0,
        "el RAC entra en la toma que ya existe: sin esto el paciente vuelve una segunda vez solo por él");
      t.falso(_clavesDe(r.plan.diferidos).indexOf("RAC") >= 0, "y no queda diferido");
    });

    t.caso("v17.7.5 — fuera de la ventana de 60 días, el RAC sigue la regla general", () => {
      // Vector localizado a propósito con el arnés: creatinina de hace 110 días y RAC de
      // HOY, así que el RAC vence 79 días después de la creatinina — fuera de los 60 de la
      // cláusula. Es la prueba que impide que el cambio se desborde a todo RAC: sin un caso
      // concreto donde NO aplique, forzar el RAC siempre pasaría igual de verde.
      const r = _racVector({ aRac: 0, aCreat: 110, creatinina: 1.4 });
      t.cierto(!!r.plan.anr, "el ANR sigue activo en este vector");
      const it = [].concat(r.plan.ordenar || [], r.plan.diferidos || []).find((x) => x.clave === "RAC");
      const gap = Math.round((new Date(it.vence + "T00:00:00") - new Date(r.plan.anr.vence + "T00:00:00")) / 86400000);
      t.cierto(gap > 60, "el vector tiene que caer FUERA de la ventana (medido: 79 días), o no prueba nada");
      t.cierto(_clavesDe(r.plan.diferidos).indexOf("RAC") >= 0,
        "y ahí el RAC sigue diferido: la cláusula del spec no se aplica a todo RAC, solo al que entra en la ventana");
    });

    t.caso("v17.7.5 — sin ANR, la cláusula no existe y el RAC vuelve a la regla del 33 %", () => {
      // Estadio G1 (creatinina normal): no hay agujero negro renal. Vector localizado con
      // el arnés: RAC de HOY con vigencia de 180 y una toma a un mes — el margen excede el
      // 33 % y la Cosecha lo difiere, como a cualquier otro analito. Sin esta prueba,
      // forzar el RAC SIEMPRE pasaría igual de verde.
      const f = (d) => new Date(Date.UTC(2026, 7, 16) - d * 86400000).toISOString().slice(0, 10);
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 66, sexo: "M", pesoKg: 80, creatinina: 0.8,
        ct: 200, hdl: 45, ldl: 100, paSistolica: 130, paDiastolica: 80, rac: 12,
        factores: { hta: true, diabetes: true },
        ultimos: {
          CREATININA: { fecha: f(60), valor: 0.8 }, RAC: { fecha: f(0), valor: 12 },
          COLESTEROL_LDL: { fecha: f(60), valor: 100 }, COLESTEROL_TOTAL: { fecha: f(60), valor: 200 },
          COLESTEROL_HDL: { fecha: f(60), valor: 45 }, TRIGLICERIDOS: { fecha: f(60), valor: 150 },
          GLUCOSA: { fecha: f(60), valor: 100 }, UROANALISIS: { fecha: f(60), valor: 1 },
          HBA1C: { fecha: f(60), valor: 6.5 },
        },
      });
      t.igual(r.plan.anr, null, "con creatinina normal no hay ANR");
      t.cierto(_clavesDe(r.plan.diferidos).indexOf("RAC") >= 0,
        "y el RAC se difiere: la cláusula vive DENTRO del bloque del ANR, no fuera");
    });

    t.caso("v17.7.5 — el RAC entra a la toma, pero NO mueve ninguna fecha", () => {
      // La contención que hace segura esta entrega, igual que en v17.6.98: la cláusula solo
      // AÑADE un examen a la orden. Si moviera la fecha, podría dejar vencer otro examen —
      // y CERO VENCIDOS está por encima de la logística en el propio v68.
      const r = _racVector({});
      const ftl = r.plan.ftl;
      t.cierto(!!ftl, "hay fecha de toma");
      // El RAC cosechado no puede ser quien manda la fecha: la manda otro vencimiento.
      const racItem = (r.plan.ordenar || []).find((x) => x.clave === "RAC");
      t.cierto(!!racItem && racItem.vence > ftl,
        "el RAC se adelanta a la toma: su vencimiento propio es POSTERIOR, así que no es él quien fija la fecha");
    });

    t.caso("v17.7.5 — barrido: con el ANR activo no queda ni un RAC diferido dentro de la ventana", () => {
      const f = (d) => new Date(Date.UTC(2026, 7, 16) - d * 86400000).toISOString().slice(0, 10);
      let conAnr = 0, candidatos = 0, diferidos = 0;
      for (const aCreat of [45, 60, 75, 90])
        for (const aRac of [10, 40, 70, 100, 160])
          for (const creat of [1.4, 1.8, 2.4]) {
            const r = api.mtrResumenClinico({
              hoyIso: "2026-08-16", edad: 66, sexo: "M", pesoKg: 80, creatinina: creat,
              ct: 200, hdl: 45, ldl: 100, paSistolica: 130, paDiastolica: 80, rac: 45,
              factores: { hta: true, diabetes: true },
              ultimos: {
                CREATININA: { fecha: f(aCreat), valor: creat }, RAC: { fecha: f(aRac), valor: 45 },
                COLESTEROL_LDL: { fecha: f(5), valor: 100 }, COLESTEROL_TOTAL: { fecha: f(5), valor: 200 },
                COLESTEROL_HDL: { fecha: f(5), valor: 45 }, TRIGLICERIDOS: { fecha: f(5), valor: 150 },
                GLUCOSA: { fecha: f(5), valor: 100 }, UROANALISIS: { fecha: f(5), valor: 1 },
                HBA1C: { fecha: f(5), valor: 6.5 },
              },
            });
            if (!r.plan.anr) continue;
            conAnr++;
            const todos = [].concat(r.plan.ordenar || [], r.plan.diferidos || []);
            const it = todos.find((x) => x.clave === "RAC");
            if (!it || !it.vence) continue;
            const gap = Math.round((new Date(it.vence + "T00:00:00") - new Date(r.plan.anr.vence + "T00:00:00")) / 86400000);
            if (gap > 60) continue;
            candidatos++;
            if ((r.plan.diferidos || []).some((x) => x.clave === "RAC")) diferidos++;
          }
      t.cierto(conAnr > 0 && candidatos > 0, "el barrido tiene que producir casos, o no prueba nada");
      t.igual(diferidos, 0, "ni un solo RAC dentro de la ventana puede quedar diferido: ese es el segundo viaje que la cláusula evita");
    });

    t.caso("v17.16.0 — mtrConsolidarMtt, probada de frente (fusión, colapso y la dirección)", () => {
      // Estaba en `cubre` sin que ninguna prueba la nombrara, y su regla más delicada es
      // justo la que la v17.6.57 corrigió: la fusión es DIRECCIONAL. Con Math.abs, un
      // recontrol de LDL a 42 días se fusionaba con una toma de 14-21 y se ADELANTABA por
      // debajo del piso de 4 semanas que la interpretación de un cambio de estatina exige.
      const g = (analito, fecha, extra) => Object.assign({ analito: analito, fecha: fecha, gravedad: "grave" }, extra || {});

      // La FTL cae DESPUÉS del recontrol, dentro de 60 días: fusionar es RETRASAR. Se fusiona.
      const retrasa = api.mtrConsolidarMtt([g("LDL", "2026-09-01")], "2026-09-20");
      t.igual(retrasa.fusiones.length, 1, "fusiona cuando la toma cae después del recontrol");
      t.igual(retrasa.fusiones[0].difDias, 19, "y deja escrito cuántos días lo retrasa");
      t.igual(retrasa.dedicadas.length, 0, "sin cita dedicada aparte");

      // La FTL cae ANTES del recontrol y no se sabe desde cuándo contar: NO se fusiona.
      // v17.55.0 — sin `hoyIso` ni `pisoDias` no hay forma de comprobar que el adelanto
      // respeta el piso clínico, así que se mantiene el comportamiento conservador.
      const adelanta = api.mtrConsolidarMtt([g("LDL", "2026-09-20")], "2026-09-01");
      t.igual(adelanta.fusiones.length, 0,
        "sin saber desde cuándo se cuenta, no se adelanta: un LDL a las 2 semanas de la dosis nueva no es interpretable");
      t.igual(adelanta.dedicadas.length, 1, "se queda con su cita propia");

      // v17.55.0 — FUSIÓN HACIA ATRÁS, HASTA EL PISO. El encargo del médico es que el
      // paciente vaya a sangrarse las menos veces posibles. Si la toma maestra cae unos días
      // ANTES del recontrol y adelantarlo respeta el piso clínico, se aprovecha ese viaje en
      // vez de mandarle una segunda cita por cuatro días de diferencia.
      const conPiso = (analito, fecha) => g(analito, fecha, { hoyIso: "2026-09-01", pisoDias: 28 });
      const atras = api.mtrConsolidarMtt([conPiso("LDL", "2026-10-27")], "2026-10-01");
      t.igual(atras.fusiones.length, 1, "la toma maestra cae 26 días antes y aún así son 30 días desde hoy: cabe");
      t.igual(atras.fusiones[0].adelantado, 26, "y queda escrito cuántos días se adelantó");
      t.igual(atras.dedicadas.length, 0, "un viaje en vez de dos");

      // Y el piso NO se cruza jamás: 20 días desde hoy están por debajo de los 28 del LDL.
      const bajoPiso = api.mtrConsolidarMtt([conPiso("LDL", "2026-10-27")], "2026-09-21");
      t.igual(bajoPiso.fusiones.length, 0,
        "adelantarlo a 20 días rompería el piso de 4 semanas: ahí el examen no mediría nada y el viaje sobraría igual");
      t.igual(bajoPiso.dedicadas.length, 1, "así que conserva su cita propia");

      // Más allá de la ventana de 60 días tampoco se fusiona.
      t.igual(api.mtrConsolidarMtt([g("LDL", "2026-09-01")], "2026-12-01").fusiones.length, 0,
        "una espera de 3 meses ya no es «aprovechar el mismo viaje»");

      // Colapso: dos recontroles dedicados a <=7 días se juntan en el más temprano.
      const col = api.mtrConsolidarMtt([g("LDL", "2026-09-20"), g("HBA1C", "2026-09-24")], "2026-09-01");
      t.igual(col.dedicadas.length, 1, "dos recontroles a 4 días se colapsan en una sola cita");
      t.igual(col.dedicadas[0].fecha, "2026-09-20", "en la fecha MÁS TEMPRANA, nunca en la más tardía");
      t.igual(col.dedicadas[0].analitos, ["LDL", "HBA1C"], "y la cita lleva los dos analitos");

      // A más de 7 días no se colapsan: son dos viajes de verdad.
      t.igual(api.mtrConsolidarMtt([g("LDL", "2026-09-20"), g("HBA1C", "2026-10-05")], "2026-09-01").dedicadas.length, 2,
        "a 15 días son dos citas: colapsarlas movería una fecha clínica");

      // Entradas basura no producen citas fantasma.
      t.igual(api.mtrConsolidarMtt(null, "2026-09-01"), { fusiones: [], dedicadas: [], sinViaje: [] }, "sin recontroles, nada");
      t.igual(api.mtrConsolidarMtt([g("LDL", null)], "2026-09-01"), { fusiones: [], dedicadas: [], sinViaje: [] },
        "un recontrol sin fecha se descarta en vez de inventarle una");

      // v17.55.0 — una falla LEVE que no cabe en la toma maestra no manda al paciente a
      // sangrarse otra vez: se anota en `sinViaje`. Su analito ya entra en la orden por la
      // unión MTT de la v17.54.0, y su vigencia viene partida a la mitad por la D9.
      const leve = api.mtrConsolidarMtt([g("LDL", "2026-12-01", { gravedad: "leve" })], "2026-09-01");
      t.igual(leve.dedicadas.length, 0, "una leve no justifica un viaje aparte");
      t.igual(leve.sinViaje.length, 1, "pero no desaparece en silencio: queda anotada");
      t.igual(leve.sinViaje[0].analito, "LDL");
      t.igual(api.mtrConsolidarMtt([g("LDL", "2026-09-01")], null).dedicadas.length, 1,
        "sin fecha de toma no se fusiona nada, pero el recontrol no se pierde");
    });

  },
};
