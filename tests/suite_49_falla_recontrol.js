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
  ],

  pruebas(t, api) {
    // ================= GRAVEDAD DE LA FALLA =================

    t.caso("por encima de la meta ya es falla (umbral estricto: D9/D10 del 29-ago)", () => {
      t.igual(api.mtrGravedadFalla(80, 70, {}), "leve", "80 vs 70: +14% ya es falla leve (se retiró el margen)");
      t.igual(api.mtrGravedadFalla(70, 70, {}), null, "en la meta exacta no hay falla");
      t.igual(api.mtrGravedadFalla(71, 70, {}), "leve", "71 vs 70: un punto por encima ya es falla");
    });

    t.caso("sin escalón de %: todo lo que excede la meta es leve salvo la regla renal (D10)", () => {
      t.igual(api.mtrGravedadFalla(85, 70, {}), "leve", "85 vs 70 = +21% sigue leve");
    });

    t.caso("D10 — un sobrepaso >30% ya NO es grave por el porcentaje, a ninguna edad", () => {
      t.igual(api.mtrGravedadFalla(95, 70, { edad: 82 }), "leve", "95 vs 70 = +35%, 82 años: leve (sin regla renal)");
      t.igual(api.mtrGravedadFalla(95, 70, { edad: 50 }), "leve", "y a los 50 también: el escalón del 30% se retiró");
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
      t.igual(f.gravedad, "leve", "sin regla renal, +35% ya no es grave (D10)");
      t.cierto(Math.abs(f.excesoPct - 35.7) < 0.2, "exceso ~35.7%");
      t.cierto(/por encima de la meta/.test(f.motivo), "el motivo dice el porqué: " + f.motivo);
      const g = api.mtrEvaluarFalla("LDL", 95, 70, { edad: 60, categoriaRiesgo: "alto", egfr: 40 });
      t.igual(g.gravedad, "grave", "y la regla renal (riesgo alto + eGFR<45 + <75) sigue haciendo grave");
      t.cierto(/eGFR<45/.test(g.motivo), "el motivo grave nombra la regla renal: " + g.motivo);
    });

    // ================= VENTANAS Y FECHAS DE RECONTROL =================

    t.caso("las ventanas de recontrol son las de la norma", () => {
      t.igual(api.mtrVentanaRecontrol("ldl").minDias, 42, "LDL 6 semanas");
      t.igual(api.mtrVentanaRecontrol("ldl").pisoDias, 28, "nunca antes de 4 semanas");
      t.igual(api.mtrVentanaRecontrol("hba1c").minDias, 90, "HbA1c mínimo 90 días");
      t.igual(api.mtrVentanaRecontrol("glicemia").minDias, 14, "glicemia 2 semanas");
      t.igual(api.mtrVentanaRecontrol("desconocido"), null, "un analito fuera de la lista no inventa ventana");
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
