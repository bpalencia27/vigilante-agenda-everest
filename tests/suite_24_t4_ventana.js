module.exports = {
  nombre: "Ventana de días extendida T4",
  cubre: ["calcTargetDateRangeExtended", "pollDayAgenda"],
  pruebas(t, api, env, cargar) {
    t.caso("calcTargetDateRangeExtended: devuelve +/- 7 hábiles y Sábados (total ~16 días)", () => {
      const c = cargar();
      // Mock Date to Friday Aug 14 2026
      c.env.win.Date = class extends Date { constructor(...args) { super(...(args.length ? args : ["2026-08-14T12:00:00"])); } static now() { return new Date("2026-08-14T12:00:00").getTime(); } };
      c.ctx.Date = c.env.win.Date;

      const range = c.api.calcTargetDateRangeExtended(0, 0); // Center: Aug 14 (Fri)
      // 7 business days prev: Aug 13(Thu), 12(Wed), 11(Tue), 10(Mon), 7(Fri), 6(Thu), 5(Wed)
      // Plus Saturdays: Aug 8(Sat)
      // Next 7 business days: Aug 17(Mon), 18(Tue), 19(Wed), 20(Thu), 21(Fri), 24(Mon), 25(Tue)
      // Plus Saturdays: Aug 15(Sat), 22(Sat)
      // Total: 8 prev + 1 center + 9 next = 18 days

      t.igual(range.length, 18);
      t.cierto(range.some(r => r.iso === "2026-08-14" && r.isCenter), "Centro incluido");
      t.cierto(range.some(r => r.iso === "2026-08-08"), "Sábado previo incluido");
      t.cierto(range.some(r => r.iso === "2026-08-15"), "Sábado siguiente incluido");
      t.falso(range.some(r => r.iso === "2026-08-09"), "Domingo NO incluido");
    });

    t.caso("pollDayAgenda: retorna promesa cacheada y parsea resultado", async () => {
       const c = cargar();
       c.api.__state.activeDoctor = { id: 1 };
       c.env.win.fetch = async (url) => {
           return {
               clone: () => ({
                   json: async () => ({
                       Data: [{ fechaAgenda: "14/08/2026", CitasDisponibles: 10 }]
                   })
               })
           };
       };

       const r1 = await c.api.pollDayAgenda("123", "2026-08-14", 12);
       t.cierto(Array.isArray(r1) && r1.length === 1);

       const r2 = await c.api.pollDayAgenda("123", "2026-08-14", 12);
       t.igual(r1, r2, "Debe retornar de la caché (misma promesa o resultado)");

       // Si no hay agenda
       c.env.win.fetch = async (url) => {
           return { clone: () => ({ json: async () => ({ Data: [] }) }) };
       };
       const r3 = await c.api.pollDayAgenda("123", "2026-08-15", 12);
       t.igual(r3, null, "Día sin agenda retorna null");
    });
  }
};
