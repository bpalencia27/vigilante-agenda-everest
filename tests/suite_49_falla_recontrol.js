// =====================================================================
//  SUITE 49 — Falla terapéutica, recontrol, MTT y telemetría de uso
//
//  Dos cosas que esta suite protege por encima del resto:
//
//   1. La regla de gravedad. Un >30% de sobrepaso es grave a CUALQUIER edad;
//      la vía de riesgo (alto + eGFR<45 + <75 años) SÍ la baja la edad. Es
//      fácil colar un `&&` de más y dejar a un anciano con LDL disparado como
//      "leve" — o al revés, alarmar de más. Se fija cada caso.
//
//   2. La barrera anti-PHI de la telemetría. La clave que se manda al tablero
//      NUNCA puede llevar un dato del paciente. Se comprueba que toda clave
//      emitida es un enum acotado y que ni un valor clínico crudo se cuela.
// =====================================================================

module.exports = {
  nombre: "Falla terapéutica, recontrol, MTT y telemetría",
  cubre: [
    "mtrGravedadFalla", "mtrEvaluarFalla", "mtrVentanaRecontrol", "mtrFechaRecontrol",
    "mtrDosisDeTexto", "mtrEstatinaAltaIntensidad", "mtrInerciaEstatina",
    "mtrConsolidarMtt", "mtrPlanFallas", "mtrTelemetriaResumen",
    "mtrMetaGlicemiaGeneral", "mtrAcortarPorFueraDeMeta",
  ],

  pruebas(t, api) {
    // ================= GRAVEDAD DE LA FALLA =================

    // v17.54.0 (D9) — REESCRITA. Fijaba el margen del +15 %, que era la decisión del médico
    // del 20-ago y que él mismo revocó el 29-ago: "ya no quiero usar el +15% ahora quiero ser
    // estricto como lo dicen las guías". No era una prueba equivocada: era la prueba correcta
    // de una decisión anterior. Lo que fija ahora es el contrato nuevo, y de paso el borde
    // exacto, que es lo único que la anterior no comprobaba.
    t.caso("v17.54.0 (D9): por encima de la meta ya hay falla — sin franja de cortesía", () => {
      t.igual(api.mtrGravedadFalla(70, 70, {}), null, "justo EN la meta no es falla");
      t.igual(api.mtrGravedadFalla(70.1, 70, {}), "leve", "un décimo por encima ya lo es");
      t.igual(api.mtrGravedadFalla(80, 70, {}), "leve", "80 con meta 70: antes se callaba, ahora se dice");
      t.igual(api.mtrGravedadFalla(69, 70, {}), null, "por debajo de la meta, nada");
      t.igual(api.mtrGravedadFalla(80.5, 70, {}), "leve", "el antiguo borde del +15% ya no protege a nadie");
    });

    t.caso("entre meta+15% y meta+30% es leve (sin la vía de riesgo)", () => {
      t.igual(api.mtrGravedadFalla(85, 70, {}), "leve", "85 vs 70 = +21%");
    });

    // v17.55.0 (D10) — REESCRITA. Fijaba el escalón del +30 %, que el médico retiró: "Sin
    // +30%, pero la regla renal se queda". No era una prueba equivocada: era la prueba
    // correcta de la regla anterior. Lo que fija ahora es que ese escalón YA NO EXISTE —
    // por muy lejos que esté el paciente de su meta, la gravedad la decide la función renal.
    // Que un descontrolado severo no se quede sin vigilancia lo garantiza otra cosa: desde
    // esta versión TODA falla lleva fecha de recontrol (ver mtrPlanFallas).
    t.caso("v17.55.0 (D10): por muy alto que esté, el porcentaje ya no hace grave a nadie", () => {
      t.igual(api.mtrGravedadFalla(95, 70, { edad: 82 }), "leve", "+35% a los 82 sin criterio renal: leve");
      t.igual(api.mtrGravedadFalla(95, 70, { edad: 50 }), "leve", "y a los 50 también");
      t.igual(api.mtrGravedadFalla(260, 70, { edad: 50 }), "leve", "ni un LDL al cuádruple de su meta");
      t.igual(api.mtrGravedadFalla(260, 70, { categoriaRiesgo: "alto", egfr: 40, edad: 50 }), "grave",
        "el ÚNICO camino a grave: riesgo alto + eGFR<45 + menor de 75");
    });

    t.caso("la vía de riesgo hace grave a <75 con eGFR<45 y riesgo alto, y NO a los >=75", () => {
      const ctxJoven = { categoriaRiesgo: "alto", egfr: 40, edad: 60 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxJoven), "grave", "+18% pero riesgo alto + eGFR40 + 60a");
      const ctxMayor = { categoriaRiesgo: "alto", egfr: 40, edad: 78 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxMayor), "leve", "misma cifra a los 78: la vía de riesgo NO aplica");
      const ctxRenalOk = { categoriaRiesgo: "alto", egfr: 60, edad: 60 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxRenalOk), "leve", "eGFR 60 no dispara la vía de riesgo");
      const ctxBajo = { categoriaRiesgo: "moderado", egfr: 40, edad: 60 };
      t.igual(api.mtrGravedadFalla(83, 70, ctxBajo), "leve", "riesgo moderado tampoco");
    });

    t.caso("mtrEvaluarFalla devuelve el exceso en % y un motivo legible", () => {
      const f = api.mtrEvaluarFalla("LDL", 95, 70, { edad: 50 });
      t.cierto(f.falla, "es falla");
      t.igual(f.gravedad, "leve", "v17.55.0: sin criterio renal, el porcentaje ya no la hace grave");
      t.cierto(Math.abs(f.excesoPct - 35.7) < 0.2, "exceso ~35.7% — el dato SIGUE viajando, aunque ya no decida la gravedad");
      t.falso(/30%/.test(f.motivo), "y el motivo ya no puede nombrar un escalón que no existe");
      const g = api.mtrEvaluarFalla("LDL", 95, 70, { categoriaRiesgo: "alto", egfr: 40, edad: 50 });
      t.igual(g.gravedad, "grave");
      t.cierto(/eGFR<45/.test(g.motivo), "y el motivo dice el único porqué que queda: " + g.motivo);
    });

    // ================= v17.55.0 — MENOS VIAJES AL LABORATORIO =================
    // Encargo del médico, textual: "la idea es que el paciente tenga la menos cantidad de
    // veces que ir a sangrarse e ir a la IPS". Medido sobre 3.072 planes ANTES de tocar nada:
    // 2,33 viajes por paciente y el 78,1 % con una segunda cita dedicada.
    // =========================================================================

    t.caso("v17.55.0: la ventana de recontrol se usa ENTERA — el extremo largo por defecto", () => {
      // Hasta hoy `maxDias` se declaraba, viajaba en el objeto devuelto y no colocaba
      // ninguna fecha jamás: el "6-8 semanas" del LDL era en realidad "42 días, siempre".
      // `diasReales` puede pasarse unos días del objetivo porque la fecha se ajusta a día
      // hábil (sábado sí, domingo y festivo no) — por eso se comprueba el tramo, no el punto.
      const largo = api.mtrFechaRecontrol("ldl", "2026-08-16", {});
      t.cierto(largo.diasReales >= 56 && largo.diasReales <= 59,
        "LDL sin urgencia: 8 semanas, que caben mejor en la toma maestra (dio " + largo.diasReales + ")");
      const corto = api.mtrFechaRecontrol("ldl", "2026-08-16", { urgente: true });
      t.cierto(corto.diasReales >= 42 && corto.diasReales <= 45,
        "con criterio renal sí se aprieta a 6 semanas (dio " + corto.diasReales + ")");
      t.cierto(corto.diasReales < largo.diasReales, "y el urgente siempre cae antes que el normal");
      t.cierto(corto.diasReales >= largo.pisoDias, "nunca por debajo del piso de 4 semanas");
    });

    t.caso("v17.55.0: donde la biología no deja graduar, no se gradúa", () => {
      // En HbA1c el piso ES el extremo corto (90 d): antes no es interpretable, así que
      // urgente y no urgente coinciden. El diseño se autolimita en vez de fingir precisión.
      t.igual(api.mtrFechaRecontrol("hba1c", "2026-08-16", {}).diasReales, 120);
      t.igual(api.mtrFechaRecontrol("hba1c", "2026-08-16", { urgente: true }).diasReales, 90);
      t.igual(api.mtrVentanaRecontrol("hba1c").pisoDias, 90, "el piso y el extremo corto son el mismo número");
    });

    t.caso("v17.55.0: TODA falla lleva fecha, no solo las graves", () => {
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55 };
      const leve = api.mtrPlanFallas(Object.assign({}, base, { ldl: { actual: 260, meta: 70 } }));
      t.igual(leve.fallas[0].gravedad, "leve", "sin criterio renal, un LDL al cuádruple es leve");
      t.igual(leve.recontroles.length, 1, "pero NO se queda sin fecha: eso era lo que D10 iba a romper");
    });

    t.caso("v17.55.0: una falla leve no manda al paciente a sangrarse aparte", () => {
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55, ftlMaestra: "2027-01-01" };
      const leve = api.mtrPlanFallas(Object.assign({}, base, { ldl: { actual: 260, meta: 70 } }));
      t.igual(leve.fechasDedicadas.length, 0, "la toma maestra queda lejísimos y aun así no hay segunda cita");
      t.igual(leve.sinViaje.length, 1, "queda anotada, no desaparece");
      const grave = api.mtrPlanFallas(Object.assign({}, base, { egfr: 40, ldl: { actual: 260, meta: 70 } }));
      t.igual(grave.fechasDedicadas.length, 1, "la misma cifra con criterio renal SÍ justifica el viaje aparte");
    });

    t.caso("v17.55.0: el barrido completo hace menos viajes que antes, y nadie se queda sin fecha", () => {
      // La métrica de esta entrega. Base medida con el código de la v17.54.0: 2,329 viajes
      // por paciente y 78,1 % con segunda cita.
      let n = 0, viajes = 0, conDed = 0, sinFecha = 0;
      for (const creat of [0.9, 1.4, 2.0, 2.6]) {
        for (const ldl of [60, 90, 140, 260]) {
          for (const hba1c of [null, 6.8, 7.6, 11.5]) {
            for (const glu of [95, 140, 220]) {
              const r = api.mtrPlanFallas({
                hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: (creat > 2 ? 30 : 70), edad: 66,
                esDm2: hba1c != null, ftlMaestra: "2026-10-01",
                ldl: { actual: ldl, meta: 70 },
                hba1c: hba1c != null ? { actual: hba1c } : null,
                glicemia: { actual: glu },
              });
              n++;
              const ded = (r.fechasDedicadas || []).length;
              viajes += 1 + ded;
              if (ded) conDed++;
              // La contracara: nadie con falla puede quedarse sin nada. La glicemia es la
              // excepción DECIDIDA —no tiene fecha propia a propósito, la cubre la toma
              // maestra— así que se comprueba sobre las fallas que sí deben tenerla.
              const noGlicemia = (r.fallas || []).filter((x) => x.analito !== "Glicemia");
              if (noGlicemia.length && !(r.recontroles || []).length && !ded) sinFecha++;
            }
          }
        }
      }
      const media = viajes / n;
      t.cierto(media < 2.0, "viajes por paciente = " + media.toFixed(3) + " — la base de la v17.54.0 era 2,329");
      t.cierto(conDed / n < 0.6, "con segunda cita = " + (100 * conDed / n).toFixed(1) + " % — la base era 78,1 %");
      t.igual(sinFecha, 0, "y NADIE con falla se queda sin ninguna fecha: menos viajes no puede ser menos vigilancia");
    });

    t.caso("v17.55.0: una glicemia sola en falla no tiene fecha propia — y eso es lo que ahorra el viaje", () => {
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55, esDm2: true, ftlMaestra: "2026-10-01" };
      const sola = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 220 } }));
      t.igual(sola.fallas.length, 1, "la falla SÍ se declara: el médico la ve y la IA la redacta");
      t.igual(sola.recontroles.length, 0, "pero no genera fecha propia");
      t.igual(sola.fechasDedicadas.length, 0, "ni cita aparte: la cubre la toma maestra y su vigencia ya partida por la D9");
    });

    // ================= VENTANAS Y FECHAS DE RECONTROL =================

    t.caso("las ventanas de recontrol son las de la norma", () => {
      t.igual(api.mtrVentanaRecontrol("ldl").minDias, 42, "LDL 6 semanas");
      t.igual(api.mtrVentanaRecontrol("ldl").pisoDias, 28, "nunca antes de 4 semanas");
      t.igual(api.mtrVentanaRecontrol("hba1c").minDias, 90, "HbA1c mínimo 90 días");
      t.igual(api.mtrVentanaRecontrol("glicemia").minDias, 14, "glicemia 2 semanas");
      t.igual(api.mtrVentanaRecontrol("desconocido"), null, "un analito fuera de la lista no inventa ventana");
    });

    // v17.6.84 — decisión del médico del 26-ago ("Sí, piso de 90 días"). La regla del 50%
    // (v16.2.7) partía la vigencia de cualquier analito fuera de meta sin mirar si el
    // resultado seguía siendo interpretable. En ERC G4 la HbA1c vale 120 días, así que una
    // HbA1c fuera de meta se volvía a pedir a los 60 — por debajo del piso de 90 que el
    // propio motor declara en MTR_RECONTROL. En G4 la vida del eritrocito ya está acortada:
    // repetirla a los 60 días no es interpretable como respuesta al tratamiento, gasta un
    // cupo de alto costo y le suma un viaje al paciente.
    t.caso("v17.6.84: la regla del 50% nunca baja la HbA1c por debajo de su piso de 90 días", () => {
      t.igual(api.mtrAcortarPorFueraDeMeta(120, true, "HBA1C"), 90,
        "ERC G4: 120 días fuera de meta se quedan en 90, no en 60");
      t.igual(api.mtrAcortarPorFueraDeMeta(180, true, "HBA1C"), 90,
        "y desde 180 el 50% ya da 90 justo: sin cambio");
      t.igual(api.mtrAcortarPorFueraDeMeta(60, true, "HBA1C"), 60,
        "si la NORMA ya da menos que el piso, manda la norma: el piso nunca ALARGA una vigencia");
      t.igual(api.mtrAcortarPorFueraDeMeta(120, false, "HBA1C"), 120,
        "en meta no se acorta nada");
      t.igual(api.mtrAcortarPorFueraDeMeta(120, true, "COLESTEROL_LDL"), 60,
        "el LDL no cambia: su piso (28 d) no se alcanza con estas vigencias");
      t.igual(api.mtrAcortarPorFueraDeMeta(120, true, "TRIGLICERIDOS"), 60,
        "un analito sin piso declarado conserva el comportamiento de siempre");
    });

    t.caso("la fecha de recontrol respeta el piso y cae en día hábil", () => {
      const r = api.mtrFechaRecontrol("ldl", "2026-08-16", {});
      t.cierto(r.diasReales >= 42, "al menos 42 días");
      t.falso(api.mtrEsFestivoCO(r.fecha), "no cae en festivo");
      // 2026-08-16 + 42 = 2026-09-27 (domingo) -> avanza a hábil.
      t.cierto(api.mtrFechaDesdeIso(r.fecha).getUTCDay() !== 0, "no cae en domingo");
    });

    // ================= INERCIA (ESTATINA DE ALTA INTENSIDAD) =================

    t.caso("reconoce atorvastatina 40-80 y rosuvastatina 20-40 como alta intensidad", () => {
      t.cierto(!!api.mtrEstatinaAltaIntensidad(["Atorvastatina 40 mg"]), "atorva 40");
      t.cierto(!!api.mtrEstatinaAltaIntensidad(["ROSUVASTATINA 20MG"]), "rosuva 20");
      t.igual(api.mtrEstatinaAltaIntensidad(["Atorvastatina 20 mg"]), null, "atorva 20 NO es alta intensidad");
      t.igual(api.mtrEstatinaAltaIntensidad(["Rosuvastatina 10 mg"]), null, "rosuva 10 tampoco");
      t.igual(api.mtrEstatinaAltaIntensidad(["Losartán 50 mg"]), null, "un ARA-II no es estatina");
    });

    t.caso("lee la dosis aunque el nombre venga en un objeto o con acentos", () => {
      t.igual(api.mtrDosisDeTexto("Atorvastatina 80 mg noche", "atorvastatina"), 80, "extrae 80");
      t.cierto(!!api.mtrEstatinaAltaIntensidad([{ nombre: "atorvastatina 40 mg" }]), "acepta objeto con .nombre");
    });

    t.caso("inercia: una falla de LDL sin estatina de alta intensidad la marca", () => {
      const conInercia = api.mtrInerciaEstatina(true, ["Atorvastatina 20 mg"]);
      t.cierto(conInercia.inercia, "dosis corta con falla = inercia");
      t.cierto(/intensidad y adherencia/i.test(conInercia.mensaje), "y lo dice");
      const sinInercia = api.mtrInerciaEstatina(true, ["Atorvastatina 80 mg"]);
      t.falso(sinInercia.inercia, "con alta intensidad no hay inercia (será adherencia u otra cosa)");
      t.igual(api.mtrInerciaEstatina(false, []), null, "sin falla de LDL, no se evalúa inercia");
    });

    // ================= MTT-CONSOLIDA =================

    // v17.6.57 (1.19) — la fusión solo puede ser un RETRASO del recontrol (la FTL cae en o
    // después de su fecha natural): fusionar a una FTL ANTERIOR lo adelantaría, y un
    // recontrol de LDL adelantado a 2-3 semanas de cambiar la estatina no es interpretable.
    t.caso("una falla grave cuyo recontrol cae cerca de la FTL, y la FTL es POSTERIOR (retraso), se FUSIONA (un solo viaje)", () => {
      const graves = [{ analito: "ldl", fecha: "2026-09-20", gravedad: "grave" }];
      const mtt = api.mtrConsolidarMtt(graves, "2026-10-05");   // FTL 15 días DESPUÉS del recontrol natural
      t.igual(mtt.fusiones.length, 1, "se fusiona a la FTL maestra (esperar 15 días más es aceptable)");
      t.igual(mtt.dedicadas.length, 0, "y no genera fecha aparte");
    });

    t.caso("1.19 — una falla grave cuyo recontrol cae DESPUÉS de la FTL nunca se ADELANTA fusionándola", () => {
      // Caso real de la auditoría: FTL a 14-21 d, recontrol de LDL (tras cambiar estatina)
      // a 42 d — antes se fusionaba (Math.abs <= 60) y el LDL se adelantaba a 2-3 semanas.
      const graves = [{ analito: "ldl", fecha: "2026-09-27", gravedad: "grave" }];   // 42 d desde el 16-ago
      const mtt = api.mtrConsolidarMtt(graves, "2026-08-16");   // FTL a los 14-21 d, ANTES del recontrol natural
      t.igual(mtt.fusiones.length, 0, "NO debe fusionarse: eso adelantaría el LDL por debajo del piso de 4 semanas");
      t.igual(mtt.dedicadas.length, 1, "debe quedar como fecha dedicada, respetando su fecha natural (2026-09-27)");
      t.igual(mtt.dedicadas[0].fecha, "2026-09-27", "sin adelantar ni un día");
    });

    t.caso("un recontrol lejano (>60 d de la FTL) se vuelve una 2ª fecha dedicada", () => {
      const graves = [{ analito: "hba1c", fecha: "2026-12-20", gravedad: "grave" }];
      const mtt = api.mtrConsolidarMtt(graves, "2026-09-20");   // 91 días
      t.igual(mtt.fusiones.length, 0, "no se fusiona");
      t.igual(mtt.dedicadas.length, 1, "es fecha dedicada");
    });

    t.caso("dos fechas dedicadas a <=7 d entre sí se colapsan en una", () => {
      const graves = [
        { analito: "ldl", fecha: "2026-12-20", gravedad: "grave" },
        { analito: "hba1c", fecha: "2026-12-23", gravedad: "grave" },
      ];
      const mtt = api.mtrConsolidarMtt(graves, "2026-09-20");
      t.igual(mtt.dedicadas.length, 1, "un solo viaje para las dos");
      t.igual(mtt.dedicadas[0].analitos.length, 2, "y lleva los dos analitos juntos");
    });

    // ================= ORQUESTADOR =================

    t.caso("mtrPlanFallas junta LDL y HbA1c, y solo evalúa HbA1c si es DM2", () => {
      const plan = api.mtrPlanFallas({
        hoyIso: "2026-08-16", categoriaRiesgo: "muy alto", egfr: 38, edad: 60,
        ftlMaestra: "2026-09-20", esDm2: true,
        ldl: { actual: 120, meta: 55 }, hba1c: { actual: 9.5, meta: 7 },
        meds: ["Atorvastatina 20 mg"],
      });
      t.igual(plan.fallas.length, 2, "LDL y HbA1c en falla");
      t.cierto(plan.hayGrave, "hay grave");
      t.cierto(plan.inercia && plan.inercia.inercia, "y marca inercia (atorva 20 con LDL en falla)");
      const noDm2 = api.mtrPlanFallas({
        hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 60,
        esDm2: false, ldl: { actual: 120, meta: 70 }, hba1c: { actual: 9.5, meta: 7 },
      });
      t.igual(noDm2.fallas.filter((f) => f.analito === "HbA1c").length, 0, "sin DM2 no se evalúa la HbA1c");
    });

    t.caso("sin LDL ni HbA1c, mtrPlanFallas no inventa fallas", () => {
      const plan = api.mtrPlanFallas({ hoyIso: "2026-08-16", esDm2: true });
      t.igual(plan.fallas.length, 0, "cero fallas");
      t.igual(plan.inercia, null, "y nada de inercia");
    });

    // ============ v17.54.0 — LA FUSIÓN MTT ENTRA EN LA ORDEN ============
    // La v17.7.5 midió 1.440 planes y encontró CERO fusiones fuera de la lista de órdenes, y
    // decidió NO escribir la unión explícita: habría sido una línea que ninguna mutación
    // podía matar. Correcto entonces; falso desde la D9. Al retirar el margen, un analito
    // puede entrar en falla SIN estar cerca de vencer, y ahí la coincidencia se rompe.
    t.caso("v17.54.0: una glicemia en falla TOMADA AYER entra en la orden, aunque su vigencia no haya vencido", () => {
      const ayer = new Date(Date.UTC(2026, 7, 15)).toISOString().slice(0, 10);
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 66, sexo: "M", pesoKg: 80, creatinina: 2.4,
        ct: 300, hdl: 35, ldl: 260, paSistolica: 150, paDiastolica: 90, hba1c: 11.5,
        factores: { hta: true, diabetes: true },
        ultimos: {
          CREATININA: { fecha: ayer, valor: 2.4 },
          COLESTEROL_LDL: { fecha: "2026-06-17", valor: 260 },
          COLESTEROL_TOTAL: { fecha: ayer, valor: 300 }, COLESTEROL_HDL: { fecha: ayer, valor: 35 },
          TRIGLICERIDOS: { fecha: ayer, valor: 250 }, GLUCOSA: { fecha: ayer, valor: 140 },
          RAC: { fecha: ayer, valor: 12 }, UROANALISIS: { fecha: ayer, valor: 1 },
          HEMOGLOBINA: { fecha: ayer, valor: 14 }, HBA1C: { fecha: "2026-06-17", valor: 11.5 },
        },
      });
      // v17.55.0 — la precondición ya no puede exigir «fusiones»: desde que los recontroles se
      // reparten entre fusionados, con cita dedicada y sin viaje, este caso acaba en cita
      // dedicada. Lo que esta prueba defiende NO es por dónde salga, sino que el examen se
      // pida. Ese fue justamente el defecto que cazó: la unión a la orden solo miraba las
      // fusiones, así que se agendaba la cita y nadie pedía la glicemia.
      const fa = r.fallas || {};
      const todos = [].concat(fa.fusiones || [], fa.fechasDedicadas || [], fa.sinViaje || []);
      const nombra = (x) => [].concat(x.analitos || [x.analito]).join(",");
      t.cierto(todos.some((x) => /glicemia/i.test(nombra(x))),
        "precondición: la glicemia de 140 con meta 130 tiene recontrol — " + JSON.stringify(todos.map(nombra)));
      const claves = (r.plan.ordenar || []).map((x) => x.clave);
      t.cierto(claves.indexOf("GLUCOSA") >= 0,
        "y tiene que ir en la orden: si no, el médico agenda la toma y nadie pide el examen — " + JSON.stringify(claves));
    });

    // ============ EL TERCER EJE: GLICEMIA (v17.6.84) ============
    // v68 manda vigilar la falla en TRES ejes (LDL/glicemia/HbA1c) y el tercero nunca se
    // cableó: lo bloqueaba que no existiera meta de glicemia en el archivo — v68 tampoco la
    // da. El médico la fijó en 130 mg/dL el 26-ago. Sin este eje, un diabético con la
    // glicemia disparada y la HbA1c todavía vigente no disparaba falla ni recontrol: el
    // descontrol agudo pasaba por debajo del radar, porque la HbA1c se mueve en 90-120 días.
    t.caso("v17.6.84: la glicemia es el tercer eje de falla, con meta de 130 mg/dL", () => {
      t.igual(api.mtrMetaGlicemiaGeneral(), 130, "la meta que fijó el médico");
      const base = { hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55, esDm2: true };
      // v17.54.0 (D9): 140 estaba «dentro del margen» con el +15 % (corte en 149,5). Retirado
      // el margen, una glicemia de 140 en un diabético con meta de 130 es falla, y se dice.
      const enMargen = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 140 } }));
      t.igual(enMargen.fallas.length, 1, "140 con meta 130 es falla: la franja 131-149,5 ya no se calla");
      t.igual(api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 130 } })).fallas.length, 0,
        "y justo en la meta sigue sin serlo");
      const leve = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 160 } }));
      t.igual(leve.fallas.length, 1, "160 sí es falla");
      t.igual(leve.fallas[0].analito, "Glicemia", "y es del eje de la glicemia");
      t.igual(leve.fallas[0].gravedad, "leve", "por debajo de meta+30% es leve");
      // v17.55.0 (D10) — el escalón del 30 % se retiró: con la función renal sana (egfr 80),
      // ni una glicemia de 260 es «grave». Lo es con criterio renal, y solo entonces.
      const grave = api.mtrPlanFallas(Object.assign({}, base, { glicemia: { actual: 260 } }));
      t.igual(grave.fallas[0].gravedad, "leve", "260 con función renal sana: falla, pero no grave");
      const renal = api.mtrPlanFallas(Object.assign({}, base, { egfr: 40, glicemia: { actual: 260 } }));
      t.igual(renal.fallas[0].gravedad, "grave", "la misma cifra con eGFR 40 sí: es la única vía que queda");
      // v17.55.0 — Y AQUÍ ESTÁ EL CAMBIO QUE MÁS VIAJES AHORRA: la glicemia NO programa una
      // fecha propia. Medido sobre 3.072 planes, provocaba 884 segundas citas — mandar a
      // sangrarse otra vez a los 14 días a quien viene de lejos. El propio v68 lo autoriza
      // («2-4 sem O ALINEADA CON LA HbA1c»). La falla se declara igual; lo que desaparece es
      // el viaje.
      t.igual(grave.recontroles.length, 0, "una falla de glicemia sola no manda al paciente a sangrarse aparte");
      const conHba1c = api.mtrPlanFallas(Object.assign({}, base, {
        glicemia: { actual: 260 }, hba1c: { actual: 11 },
      }));
      const rGlu = conHba1c.recontroles.filter((r) => r.analito === "glicemia")[0];
      const rHba = conHba1c.recontroles.filter((r) => r.analito === "hba1c")[0];
      t.cierto(!!rGlu && !!rHba, "con la HbA1c también en falla, la glicemia sí tiene fecha");
      t.igual(rGlu.fecha, rHba.fecha, "y es EXACTAMENTE la misma: se alinea, no se suma");
      t.igual(rGlu.alineadoA, "hba1c", "dicho explícitamente, para que se pueda leer por qué");
    });

    t.caso("v17.6.84: en un no diabético la glicemia NO es falla terapéutica", () => {
      const noDm2 = api.mtrPlanFallas({
        hoyIso: "2026-08-16", categoriaRiesgo: "alto", egfr: 80, edad: 55,
        esDm2: false, glicemia: { actual: 260 },
      });
      t.igual(noDm2.fallas.filter((f) => f.analito === "Glicemia").length, 0,
        "en un hipertenso sin diabetes, una glicemia alta no es 'falla del tratamiento'");
    });

    t.caso("v17.6.84: el eje llega cableado desde mtrResumenClinico, no nace muerto", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 55, sexo: "M", pesoKg: 80, creatinina: 0.9,
        rac: 10, ct: 150, hdl: 50, ldl: 60, paSistolica: 125, paDiastolica: 78,
        factores: { hta: true, diabetes: true },
        ultimos: {
          CREATININA:       { fecha: "2026-08-01", valor: 0.9 },
          COLESTEROL_TOTAL: { fecha: "2026-08-01", valor: 150 },
          COLESTEROL_HDL:   { fecha: "2026-08-01", valor: 50 },
          COLESTEROL_LDL:   { fecha: "2026-08-01", valor: 60 },
          TRIGLICERIDOS:    { fecha: "2026-08-01", valor: 110 },
          HBA1C:            { fecha: "2026-08-20", valor: 6.5 },   // EN META y vigente
          RAC:              { fecha: "2026-08-01", valor: 10 },
          UROANALISIS:      { fecha: "2026-08-01", valor: 1 },
          GLUCOSA:          { fecha: "2026-08-20", valor: 260 },
        },
        ldl: 60, hba1c: 6.5,
      });
      // Este es el escenario que el eje existe para cazar: la HbA1c dice que todo va bien
      // (está en meta y vigente) y la glicemia dice que no.
      t.cierto(r.fallas && r.fallas.fallas.some((f) => f.analito === "Glicemia"),
        "la glicemia del ctx llega hasta mtrPlanFallas sin que el llamador la pase a mano");
      t.igual(r.foco, "metabólico",
        "y el foco de la consulta refleja esa falla, no solo el estado del driver");
    });

    // ================= TELEMETRÍA (BARRERA ANTI-PHI) =================

    const resumenReal = () => api.mtrResumenClinico({
      hoyIso: "2026-08-16", edad: 66, sexo: "F", pesoKg: 70, creatinina: 1.5,
      rac: 55, ct: 240, hdl: 38, ldl: 155, paSistolica: 150, tg: 540,
      hba1c: 9.5, factores: { hta: true, diabetes: true },
      ultimos: { CREATININA: { fecha: "2026-02-01", valor: 1.5 } },
      programa: "ERC", meds: ["Atorvastatina 20 mg"],
    });

    t.caso("la telemetría emite solo claves de acción con nombre fijo (enums y conteos)", () => {
      const eventos = api.mtrTelemetriaResumen(resumenReal());
      t.cierto(eventos.length >= 3, "emite varias señales de uso");
      for (const ev of eventos) {
        t.cierto(/^recuadro\.[a-z0-9._]+$/.test(ev.accion),
          "clave '" + ev.accion + "' debe ser un nombre de acción acotado, sin acentos ni datos");
      }
    });

    t.caso("NINGÚN valor del paciente se cuela en la clave de telemetría", () => {
      const resumen = resumenReal();
      const eventos = api.mtrTelemetriaResumen(resumen);
      const prohibidos = ["155", "1.5", "540", "9.5", "70", "66", "240"];  // valores del paciente de arriba
      for (const ev of eventos) {
        for (const p of prohibidos) {
          t.igual(ev.accion.indexOf(p), -1, "la clave '" + ev.accion + "' no puede contener el valor " + p);
        }
        // los conteos van en extra.n (un número acotado), jamás en la clave
        if (ev.extra) t.cierto(typeof ev.extra.n === "number", "el único extra permitido es un conteo numérico");
      }
    });

    t.caso("la telemetría capta la señal de CALIDAD DE DATOS (no se pudo clasificar)", () => {
      const sinDatos = api.mtrResumenClinico({
        hoyIso: "2026-08-16", edad: 66, sexo: "F", factores: {}, ultimos: {}, programa: "HTA",
      });
      const eventos = api.mtrTelemetriaResumen(sinDatos);
      t.cierto(eventos.some((e) => e.accion === "recuadro.datos_incompletos"),
        "sin creatinina, se cuenta como dato incompleto — justo lo que mejora el servicio");
    });

    t.caso("la telemetría marca la falla como señal de calidad, sin números", () => {
      const eventos = api.mtrTelemetriaResumen(resumenReal());
      t.cierto(eventos.some((e) => e.accion === "recuadro.falla.grave" || e.accion === "recuadro.falla.leve"),
        "una falla terapéutica se cuenta (grave/leve), sin el valor del LDL");
    });

    t.caso("el recuadro muestra la falla y el recontrol cuando los hay", () => {
      const html = api.mtrRenderResumenClinicoHtml(resumenReal());
      t.cierto(/Falla terap.utica/.test(html), "sale el bloque de falla");
      t.cierto(/intensidad y adherencia/i.test(html), "y el aviso de inercia de la estatina");
    });
  },
};
