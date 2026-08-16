// =====================================================================
//  PRUEBA ROJA 002 — Exigencia estricta de presencia y precedencia
//  de avisos CRITICAL vs HIGH sin bypass condicional (Forma 1)
// =====================================================================
const { cargar } = require("../harness.js");

module.exports = {
  nombre: "ROJA-002: mtrRenderAvisosHtml exige avisos CRITICAL y HIGH presentes y en orden",
  cubre: ["mtrRenderAvisosHtml"],
  pruebas(t, api, env, cargar) {
    t.caso("mtrRenderAvisosHtml debe contener tanto CRITICAL como HIGH para PACIENTE_G4 y CRITICAL precede a HIGH", () => {
      const c = cargar({ silencioso: true });
      c.api.__S.motorPortado = true;

      const PACIENTE_G4 = {
        medicamentos: ["METFORMINA 850 MG", "IBUPROFENO 400 MG", "LOSARTAN 50 MG", "HIDROCLOROTIAZIDA 25 MG"],
        tfgCkdEpi: 25, tfgCockcroftGault: 26,
      };

      const h = c.api.mtrRenderAvisosHtml(PACIENTE_G4);
      const primerCrit = h.indexOf("vgl-mtr-crit");
      const primerAlto = h.indexOf("vgl-mtr-alto");

      // Las dos aserciones son INCONDICIONALES: si alguna clase falta, la prueba DEBE caer
      t.cierto(primerCrit >= 0, "debe existir al menos un aviso crítico (vgl-mtr-crit)");
      t.cierto(primerAlto >= 0, "debe existir al menos un aviso de advertencia alta (vgl-mtr-alto)");
      t.cierto(primerCrit < primerAlto, "los avisos CRITICAL deben renderizarse antes que los HIGH en el HTML");
    });
  }
};
