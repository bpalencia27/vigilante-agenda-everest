// Diagnóstico temporal: contrato real de mtrHojaEducativaHtml y mtrTendenciaDe (v17.56.0)
const { cargar } = require("./tests/harness.js");

(async () => {
  const c = await cargar({ silencioso: true });
  const api = c.api;

  // ---- Hoja educativa con el fixture de suite_67 ----
  const hoja = api.mtrHojaEducativaHtml({
    programa: "DM2",
    riesgo: { categoria: "muy alto" },
    plan: { vencidos: [{ clave: "LDL" }], faltantes: [{ clave: "RAC" }] },
    hba1c: { meta: 7.0, actual: 8.2 },
  }, { nombre: "PACIENTE DE PRUEBA", hoyIso: "2026-08-17" });

  console.log("== hoja: LDL presente?", /LDL/.test(hoja), "| RAC presente?", /RAC/.test(hoja));
  console.log("== hoja: Signos de alarma?", /Signos de alarma/.test(hoja));
  console.log("== hoja: Alimentación?", /Alimentación/.test(hoja), "| Actividad física?", /Actividad física/.test(hoja));
  console.log("== hoja: meta HbA1c?", /Su meta de hemoglobina/.test(hoja), "| 7%?", /7\s*%/.test(hoja));
  console.log("== hoja: MUY ALTO?", /MUY ALTO/.test(hoja), "| PACIENTE DE PRUEBA?", /PACIENTE DE PRUEBA/.test(hoja));
  // imprimir el tramo de pendientes si existe
  const m = hoja.match(/Exámenes pendientes[\s\S]{0,200}/);
  console.log("== tramo pendientes:", m ? m[0].slice(0, 220) : "(no existe la sección)");

  // ---- Tendencia por VALOR ----
  const serie = [{ fecha: "2026-01-01", valor: 130 }, { fecha: "2026-06-01", valor: 131 }];
  const alto = api.mtrTendenciaDe(serie, "COLESTEROL_LDL", { categoriaRiesgo: "alto" });
  console.log("\n== LDL riesgo alto:", JSON.stringify({ dir: alto.direccion, g: alto.gravedad, motivo: alto.motivoGrave }));
  const bajo = api.mtrTendenciaDe(serie, "COLESTEROL_LDL", { categoriaRiesgo: "bajo" });
  console.log("== LDL riesgo bajo:", JSON.stringify({ g: bajo.gravedad, motivo: bajo.motivoGrave }));
  const sinCtx = api.mtrTendenciaDe(serie, "COLESTEROL_LDL");
  console.log("== LDL sin ctx:", JSON.stringify({ g: sinCtx.gravedad }));
  const hb = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 9.0 }, { fecha: "2026-06-01", valor: 9.2 }], "HBA1C", { metaHba1c: 8.0 });
  console.log("== HbA1c meta 8.0 con 9.2:", JSON.stringify({ g: hb.gravedad, motivo: hb.motivoGrave }));
  const hb7 = api.mtrTendenciaDe([{ fecha: "2026-01-01", valor: 9.0 }, { fecha: "2026-06-01", valor: 9.2 }], "HBA1C");
  console.log("== HbA1c meta default con 9.2:", JSON.stringify({ g: hb7.gravedad, motivo: hb7.motivoGrave }));

  // ---- Secciones ----
  console.log("\n== secciones válidas:", ["resumen", "renal", "examenes", "tendencias", "medicamentos"].map((s) => s + "->" + api.mtrPanelSeccionValida(s)).join(" "));
  const nav = api.mtrPanelNavHtml("tendencias");
  console.log("== nav tabs:", (nav.match(/role="tab"/g) || []).length, "| secciones:", (nav.match(/data-panel-sec=/g) || []).length);
  console.log("== nav tiene Medicamentos?", nav.indexOf("Medicamentos") >= 0);
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
