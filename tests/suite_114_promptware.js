"use strict";
// =====================================================================
//  SUITE 114 — CUMPLIMIENTO DE PROMPTWARE.md (Motor RCV v68)
//
//  PROMPTWARE.md es el prompt del MOTOR RCV (v68): la fuente de verdad
//  clínica del proyecto. El userscript NO ejecuta ese motor — lo consume:
//  recibe su JSON, lo entrega al redactor como bloque «fuente de verdad, no
//  recalcules» y nunca lo recalcula ni lo completa a mano.
//
//  Esta suite convierte esa frontera en una compuerta viva: parsea el
//  contrato PASO3 del PROPIO documento (no una copia escrita aquí) y exige
//  que el JSON que emite el sistema tenga TODOS sus campos. Si el prompt
//  sube de versión y añade un campo, esta suite lo dice en vez de que el
//  motor y el redactor se desincronicen en silencio.
// =====================================================================
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const PROMPTWARE = fs.readFileSync(path.join(RAIZ, "PROMPTWARE.md"), "utf8");
const FUENTE = fs.readFileSync(path.join(RAIZ, "vigilante_agenda.user.js"), "utf8");

// El contrato de salida del motor vive en la línea «PASO3 JSON: {…}».
function contratoPaso3() {
  const linea = PROMPTWARE.split(/\r?\n/).find((l) => l.indexOf("PASO3 JSON:") === 0);
  if (!linea) throw new Error("PROMPTWARE.md no tiene la línea PASO3 JSON");
  const ini = linea.indexOf("{"), fin = linea.lastIndexOf("}");
  return JSON.parse(linea.slice(ini, fin + 1));
}

module.exports = {
  nombre: "Suite 114 · Cumplimiento de PROMPTWARE.md (Motor RCV v68)",
  cubre: ["mtrJsonV68DesdeResumen", "mtrResumenClinico", "mtrHojaDesdeResumen", "mtrHojaDeHechos", "mtrRedaccionPrompt"],
  async pruebas(t, api, env, cargar) {
    const contrato = contratoPaso3();
    const ctxMinimo = { docId: "999", nombre: "Paciente De Prueba", hoyIso: "2026-09-09" };

    t.caso("PROMPTWARE.md — el documento se identifica como Motor RCV v68 y declara su contrato de salida", () => {
      t.cierto(/^MOTOR RCV v68/.test(PROMPTWARE), "la primera línea identifica el motor y su versión");
      t.igual(contrato.version, "68", "el contrato de salida declara version 68");
      t.cierto(Object.keys(contrato).length >= 20, "el contrato declara el bloque completo de campos (" + Object.keys(contrato).length + ")");
      t.cierto(/S4 CORTAFUEGOS/.test(PROMPTWARE) && /LISTA NEGRA/.test(PROMPTWARE), "y conserva sus secciones duras (cortafuegos y lista negra)");
    });

    t.caso("PROMPTWARE.md — el JSON del sistema cumple TODO el contrato PASO3, campo por campo", () => {
      const c = cargar({ silencioso: true });
      const r = c.api.mtrResumenClinico(ctxMinimo);
      const j = c.api.mtrJsonV68DesdeResumen(r, c.api.mtrHojaDesdeResumen(r));
      const faltantes = Object.keys(contrato).filter((k) => !(k in j));
      t.igual(faltantes.length, 0, "ningún campo del contrato falta en el JSON emitido: " + JSON.stringify(faltantes));
      t.igual(j.version, contrato.version, "y la versión emitida ES la del contrato (68)");
      const subEdu = Object.keys(contrato.education_flags);
      t.igual(subEdu.filter((k) => !(k in (j.education_flags || {}))).length, 0, "education_flags trae sus tres banderas del contrato");
      const subNota = Object.keys(contrato.nota_clinica);
      t.igual(subNota.filter((k) => !(k in (j.nota_clinica || {}))).length, 0, "nota_clinica trae sus dos campos de prosa del contrato");
    });

    t.caso("PROMPTWARE.md — la prosa la escribe el modelo: el sistema la entrega VACÍA, nunca inventada", () => {
      const c = cargar({ silencioso: true });
      const r = c.api.mtrResumenClinico(ctxMinimo);
      const j = c.api.mtrJsonV68DesdeResumen(r, c.api.mtrHojaDesdeResumen(r));
      t.igual(j.nota_clinica.justificacion_riesgo_meta, "", "la justificación de riesgo viaja vacía: la redacta el modelo");
      t.igual(j.nota_clinica.sustento_medicolegal, "", "el sustento médico-legal, igual");
      t.igual(j.technical_justification, "", "y la justificación técnica, igual");
    });

    t.caso("PROMPTWARE.md — el prompt del redactor lleva las reglas duras del motor, palabra por palabra", () => {
      const c = cargar({ silencioso: true });
      const hoja = c.api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F", hta: true } }, { hoyIso: "2026-09-09" });
      const p = c.api.mtrRedaccionPrompt("analisis_plan", hoja, { jsonV68: { version: "68", cv_risk: "alto" } });
      t.cierto(p.system.indexOf("JSON DEL MOTOR RCV (v68), los HECHOS DEL PACIENTE y lo anotado por el médico para ESTE paciente") >= 0, "la fuente de verdad se declara acotada al paciente de ESTA consulta");
      t.cierto(p.system.indexOf("Prohibido usar memoria o datos de otros pacientes") >= 0, "y prohíbe explícitamente los datos de otros pacientes");
      t.cierto(p.system.indexOf("NO recalcules TFG, riesgo cardiovascular ni metas") >= 0, "y ordena no recalcular lo que el motor ya calculó");
      t.cierto(p.system.indexOf("CERO INFERENCIA") >= 0, "y no inventar lo que no está (CERO INFERENCIA)");
      t.cierto(p.user.indexOf("JSON DEL MOTOR RCV (v68) — fuente de verdad, no recalcules:") >= 0, "el JSON del motor viaja en el user, rotulado como fuente de verdad");
      t.cierto(p.user.indexOf('"version":"68"') >= 0, "y viaja el JSON tal cual lo emitió el sistema, sin reescribirlo");
    });

    t.caso("PROMPTWARE.md — la FICHA es salida del MOTOR: el redactor de notas no la duplica", () => {
      // La FICHA de PROMPTWARE.md (S5) la emite el motor. El redactor consume su JSON;
      // si además le pidiéramos «emitir la FICHA», habría DOS emisores del mismo
      // documento clínico y podrían contradecirse. Se fija la frontera.
      t.cierto(PROMPTWARE.indexOf("<<FICHA_RCV |") >= 0, "montaje: la FICHA existe en el prompt del motor");
      t.falso(FUENTE.indexOf("<<FICHA_RCV |") >= 0, "y NO se le pide al redactor de notas: el motor sigue siendo el único que la emite");
    });
  },
};
