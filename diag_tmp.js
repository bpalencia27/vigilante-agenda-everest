const { cargar } = require("/workspace/tests/harness.js");
const c = cargar();
const api = c.api;
const p = (k, v) => console.log(k, JSON.stringify(v));

// 1. apptKey
p("apptKey doc", api.apptKey({ doc_id: "123", hora_texto: "07:00 AM" }));
p("apptKey nombre+index", api.apptKey({ nombre: "JUAN", index: 5, hora_texto: "08:30" }));
p("apptKey doc solo", api.apptKey({ doc_id: "456" }));

// 2. mtrGravedadFalla / mtrEvaluarFalla
p("gf 80/70 {}", api.mtrGravedadFalla(80, 70, {}));
p("gf 80.5/70 {}", api.mtrGravedadFalla(80.5, 70, {}));
p("gf 85/70 {}", api.mtrGravedadFalla(85, 70, {}));
p("gf 95/70 {edad82}", api.mtrGravedadFalla(95, 70, { edad: 82 }));
p("gf 95/70 {edad50}", api.mtrGravedadFalla(95, 70, { edad: 50 }));
p("gf 83/70 {alto,egfr40,60}", api.mtrGravedadFalla(83, 70, { categoriaRiesgo: "alto", egfr: 40, edad: 60 }));
p("gf 83/70 {alto,egfr40,78}", api.mtrGravedadFalla(83, 70, { categoriaRiesgo: "alto", egfr: 40, edad: 78 }));
p("gf 83/70 {alto,egfr60,60}", api.mtrGravedadFalla(83, 70, { categoriaRiesgo: "alto", egfr: 60, edad: 60 }));
p("gf 83/70 {moderado,egfr40,60}", api.mtrGravedadFalla(83, 70, { categoriaRiesgo: "moderado", egfr: 40, edad: 60 }));
p("ef LDL 95/70 {edad50}", api.mtrEvaluarFalla("LDL", 95, 70, { edad: 50 }));

// 3. mtrEvaluarMetaLdl
p("metaLdl alto 81", api.mtrEvaluarMetaLdl("alto", 81, null));
p("metaLdl alto 92", api.mtrEvaluarMetaLdl("alto", 92, null));
p("metaLdl alto 70", api.mtrEvaluarMetaLdl("alto", 70, null));
p("metaLdl alto null", api.mtrEvaluarMetaLdl("alto", null, 140));

// 4. mtrFechaRecontrol
p("frec ldl 2026-08-16", api.mtrFechaRecontrol("ldl", "2026-08-16", {}));
p("ventana ldl", api.mtrVentanaRecontrol("ldl"));
p("ventana hba1c", api.mtrVentanaRecontrol("hba1c"));
p("ventana glicemia", api.mtrVentanaRecontrol("glicemia"));

// 5. mtrEstadoAnalito sin fecha (suite_46:120)
const ctxErc = { hoyIso: "2026-08-16", programa: "ERC", estadioAdministrativo: "G3b", esDm2: true, edad: 68, rac: 12 };
p("estadoAnalito CREATININA null", api.mtrEstadoAnalito("CREATININA", null, ctxErc));
p("estadoAnalito CREATININA {fecha:null,valor:1.0}", api.mtrEstadoAnalito("CREATININA", { fecha: null, valor: 1.0 }, ctxErc));

// 6. mtrPriorityFocus mixto (suite_48:248)
p("focus meta.falla", api.mtrPriorityFocus({ erc: { remitirNefrologia: true }, meta: { falla: true }, plan: { drivers: [] } }));
p("focus meta.fallaGrave", api.mtrPriorityFocus({ erc: { remitirNefrologia: true }, meta: { fallaGrave: true }, plan: { drivers: [] } }));

// 7. diabética RAC45 ERC (suite_47:49)
p("resumen ctxBase", api.mtrResumenClinico({
  hoyIso: "2026-08-16", edad: 68, sexo: "F", pesoKg: 62, creatinina: 1.6,
  rac: 45, ldl: 148, factores: { diabetes: true },
}));

// 8. CERO VENCIDOS (suite_46:237)
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
console.log("PLAN ftl:", plan && plan.ftl, "| motivo:", plan && plan.motivoFtl);
if (plan) {
  console.log("PLAN drivers con vence:", plan.drivers.filter((a) => a.vence).map((a) => a.nombre + "@" + a.vence + "(" + a.estado + "/" + a.subestado + ")"));
}

// 9. ctxBase REAL de suite_47
const ctxBase47 = {
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
const r47 = api.mtrResumenClinico(ctxBase47);
p("47 categoria", r47.riesgo && r47.riesgo.categoria);
p("47 meta.falla", r47.meta && r47.meta.falla);
p("47 meta.fallaGrave existe?", r47.meta && ("fallaGrave" in r47.meta));
p("47 fallas", r47.fallas && { hayGrave: r47.fallas.hayGrave, hayLeve: r47.fallas.hayLeve, n: (r47.fallas.fallas||[]).length, g0: (r47.fallas.fallas||[])[0] && (r47.fallas.fallas[0].gravedad) });
