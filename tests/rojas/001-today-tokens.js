// =====================================================================
//  PRUEBA ROJA 001 — todayTokens() debe retornar tokens reales del día
//  Demuestra el hueco de Forma 1/Forma 5 en suite_03_excel_pym.js
// =====================================================================
const { cargar } = require("../harness.js");

module.exports = {
  nombre: "ROJA-001: todayTokens retorna tokens de fecha válidos y no vacíos",
  cubre: ["todayTokens"],
  pruebas(t, api, env, cargar) {
    t.caso("todayTokens retorna array con tokens de fecha reales (ej. '15 de agosto', '15-08-2026')", () => {
      const c = cargar({ silencioso: true });
      // Congelar fecha a 15 de agosto de 2026
      c.env.win.Date = class extends Date {
        static now() { return new Date("2026-08-15T12:00:00").getTime(); }
        constructor(...args) {
          if (args.length === 0) super("2026-08-15T12:00:00");
          else super(...args);
        }
      };
      c.ctx.Date = c.env.win.Date;

      const tokens = c.api.todayTokens();
      t.cierto(Array.isArray(tokens), "todayTokens debe retornar un array");
      t.cierto(tokens.length >= 3, "debe generar al menos 3 formatos de token para la fecha actual; obtuvo " + tokens.length);
      t.cierto(tokens.some(tok => tok.includes("15") && tok.toLowerCase().includes("agosto")), "debe incluir '15 de agosto' o similar");
    });
  }
};
