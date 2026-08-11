module.exports = {
  nombre: "Tiempo y fechas",
  cubre: ["calcBusinessTargetDate", "calcTargetDateRange", "parseHoraMin", "horaBonita", "elapsedMin", "apptKey", "diaNuevo", "todayStamp"],
  pruebas(t, api, env, cargar) {
    // Helper to setup mock date using a fresh harness to avoid global pollution
    function runWithMockDate(mockIsoStr, fn) {
      const c = cargar();
      const OriginalDate = c.ctx.Date || Date;
      const FakeDate = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0 && mockIsoStr) super(mockIsoStr);
          else super(...args);
        }
      };
      FakeDate.now = () => mockIsoStr ? new OriginalDate(mockIsoStr).getTime() : OriginalDate.now();
      c.ctx.Date = FakeDate;
      fn(c.api, c.env, c.ctx);
    }

    t.caso("calcBusinessTargetDate: Caso Normal (15 días desde Mié -> Jue)", () => {
      runWithMockDate("2023-10-04T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessTargetDate(0, 15);
        t.igual(r.iso, "2023-10-19");
      });
    });

    t.caso("calcBusinessTargetDate: Ajuste Sábado a Viernes", () => {
      runWithMockDate("2023-10-18T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessTargetDate(0, 3); // Cae sábado 21/10
        t.igual(r.iso, "2023-10-20");
      });
    });

    t.caso("calcBusinessTargetDate: Ajuste Domingo a Viernes", () => {
      runWithMockDate("2023-10-18T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessTargetDate(0, 4); // Cae domingo 22/10
        t.igual(r.iso, "2023-10-20");
      });
    });

    t.caso("calcBusinessTargetDate: Año Bisiesto (Febrero 29)", () => {
      runWithMockDate("2024-01-31T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessTargetDate(1, 0); // +1 mes
        t.igual(r.iso, "2024-02-29");
      });
    });

    t.caso("calcBusinessTargetDate: Año No Bisiesto (Febrero 28)", () => {
      runWithMockDate("2023-01-31T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessTargetDate(1, 0); // +1 mes
        t.igual(r.iso, "2023-02-28");
      });
    });

    t.caso("calcBusinessTargetDate: Desbordamiento EOM a Dom", () => {
      runWithMockDate("2023-03-31T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessTargetDate(1, 0); // +1 mes cae Dom 30/04
        t.igual(r.iso, "2023-04-28");
      });
    });

    t.caso("calcTargetDateRange: Rango DateRange (Evitando Sábado y Domingo)", () => {
      runWithMockDate("2023-10-24T12:00:00", (mockApi) => {
        const range = mockApi.calcTargetDateRange(0, 2); // Target: Jueves 26/10
        const isos = range.map(r => r.iso);
        t.igual(isos, ["2023-10-23", "2023-10-24", "2023-10-25", "2023-10-26", "2023-10-27", "2023-10-30", "2023-10-31"]);
      });
    });

    t.caso("calcTargetDateRange: Rango DateRange con Lunes en el centro", () => {
      runWithMockDate("2023-10-20T12:00:00", (mockApi) => {
        const range = mockApi.calcTargetDateRange(0, 3); // Target: Lunes 23/10
        const isos = range.map(r => r.iso);
        t.igual(isos, ["2023-10-18", "2023-10-19", "2023-10-20", "2023-10-23", "2023-10-24", "2023-10-25", "2023-10-26"]);
      });
    });

    // ---------- todayStamp ----------
    t.caso("todayStamp: devuelve YYYY-MM-DD del día actual", () => {
      runWithMockDate("2026-08-10T12:00:00", (mockApi) => {
        t.igual(mockApi.todayStamp(), "2026-08-10");
      });
    });

    // ---------- parseHoraMin ----------
    t.caso("parseHoraMin: extrae minutos correctamente", () => {
      t.igual(api.parseHoraMin("07:00 AM"), 420);
      t.igual(api.parseHoraMin("02:30 PM"), 870);
      t.igual(api.parseHoraMin("14:30"), 870);
      t.igual(api.parseHoraMin("00:15"), 15);
      t.igual(api.parseHoraMin("12:00 PM"), 720);
      t.igual(api.parseHoraMin("12:00 AM"), 0);
      t.igual(api.parseHoraMin("23:59:00"), 1439);
    });

    t.caso("parseHoraMin: retorna null con datos inválidos", () => {
      t.igual(api.parseHoraMin(null), null);
      t.igual(api.parseHoraMin(""), null);
      t.igual(api.parseHoraMin("25:00"), null);
      t.igual(api.parseHoraMin("no es hora"), null);
    });

    // ---------- horaBonita ----------
    t.caso("horaBonita: formatea minutos a texto 12h", () => {
      t.igual(api.horaBonita(420), "7:00 a. m.");
      t.igual(api.horaBonita(870), "2:30 p. m.");
      t.igual(api.horaBonita(720), "12:00 p. m.");
      t.igual(api.horaBonita(0), "12:00 a. m.");
      t.igual(api.horaBonita(1439), "11:59 p. m.");
    });

    t.caso("horaBonita: retorna vacio si entrada es null", () => {
      t.igual(api.horaBonita(null), "");
    });

    // ---------- elapsedMin ----------
    t.caso("elapsedMin: calcula la diferencia en minutos entre dos tiempos", () => {
      // Assuming today is 2026-08-10.
      // timestamp to calculate difference with is "07:00 AM".
      const refDate = new Date("2026-08-10T08:00:00").getTime();
      t.igual(api.elapsedMin("07:00 AM", refDate), 60);

      const refDate2 = new Date("2026-08-10T06:30:00").getTime();
      t.igual(api.elapsedMin("07:00 AM", refDate2), -30);
    });

    t.caso("elapsedMin: retorna 0 cuando la hora es inválida y loguea advertencia", () => {
      const c = cargar();
      t.igual(c.api.elapsedMin("invalido", Date.now()), 0);
      t.cierto(c.api.__state.warnedTimes.has("invalido"));
    });

    // ---------- apptKey ----------
    t.caso("apptKey: arma la clave de la cita", () => {
      t.igual(api.apptKey({ doc_id: "123", hora_texto: "07:00 AM" }), "123@07:00 AM");
      t.igual(api.apptKey({ nombre: "JUAN", index: 5, hora_texto: "08:30" }), "JUAN|5@08:30");
      t.igual(api.apptKey({ doc_id: "456" }), "456@");
    });

    // ---------- diaNuevo ----------
    // Testing state reset.
    // diaActual isn't exported directly, but we can verify it indirectly or test the behavior.
    // Actually diaNuevo doesn't expose diaActual, let's just check the side effects in state.
    t.caso("diaNuevo: limpieza real de estado en el mismo entorno", () => {
      const c = cargar();

      // Inject day 1
      const OriginalDate = c.ctx.Date || Date;
      let mockIsoStr = "2026-08-10T12:00:00";
      const FakeDate = class extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) super(mockIsoStr);
          else super(...args);
        }
      };
      c.ctx.Date = FakeDate;
      c.api.diaNuevo();
      // We can't access diaActual directly because it's in a closure inside IIFE.

      // Simulate data buildup
      c.api.__state.warnedTimes.add("invalido");
      c.api.__state.fraudWatch.add("123");
      c.api.__state.notified.set("456", "val");
      c.api.__state.historical.set("x", "y");

      // Inject day 2
      mockIsoStr = "2026-08-11T12:00:00";
      c.api.diaNuevo();

      // Validate cleanup
      t.igual(c.api.__state.warnedTimes.size, 0);
      t.igual(c.api.__state.fraudWatch.size, 0);
      t.igual(c.api.__state.notified.size, 0);
      t.igual(c.api.__state.historical.size, 0);
    });

    // ---------- calcBusinessDaysBefore ----------
    t.caso("calcBusinessDaysBefore: cuenta días hábiles hacia atrás evitando fin de semana", () => {
      // 2026-08-10 is a Monday. 1 business day before is Friday 2026-08-07
      const fri = api.calcBusinessDaysBefore("2026-08-10", 1);
      t.igual(fri.iso, "2026-08-07");

      // 5 business days before 2026-08-10 (Mon) -> 2026-08-03 (Mon)
      const prevMon = api.calcBusinessDaysBefore("2026-08-10", 5);
      t.igual(prevMon.iso, "2026-08-03");
    });

    t.caso("calcBusinessDaysBefore: cruce de fin de mes / año", () => {
      // 2026-01-02 is a Friday. 2 business days before is 2025-12-31 (Wednesday)
      const prevYear = api.calcBusinessDaysBefore("2026-01-02", 2);
      t.igual(prevYear.iso, "2025-12-31");
    });

    // ---------- format12hTime ----------
    t.caso("format12hTime: formatea a 12 horas", () => {
      t.igual(api.format12hTime("00:30"), "12:30 AM");
      t.igual(api.format12hTime("12:05"), "12:05 PM");
      t.igual(api.format12hTime("13:45"), "01:45 PM");
      t.igual(api.format12hTime("7"), "07:00 AM"); // sin minutos
      t.igual(api.format12hTime("texto"), "texto"); // no numerico se devuelve igual
      t.igual(api.format12hTime(null), ""); // Retorna string vacío o el null original
    });

    // ---------- extractAgendasList ----------
    t.caso("extractAgendasList: desenrolla respuesta de agendas de diferentes formas", () => {
      const res1 = { data: { dtCitasDisponibles: [{id: 1}] } };
      t.igual(api.extractAgendasList(res1), [{id: 1}]);

      const res2 = { agendas: [{id: 2}] };
      t.igual(api.extractAgendasList(res2), [{id: 2}]);

      const res3 = { turnos: [{id: 3}] };
      t.igual(api.extractAgendasList(res3), [{id: 3}]);

      const res4 = { Table: [{id: 4}] };
      t.igual(api.extractAgendasList(res4), [{id: 4}]);

      const resFallback = [{id: 5}]; // fallback for array of objects
      t.igual(api.extractAgendasList(resFallback), [{id: 5}]);

      const arrayStrings = ["a", "b"];
      t.igual(api.extractAgendasList({ dummy: ["a", "b"] }), []);

      t.igual(api.extractAgendasList(null), []);
      t.igual(api.extractAgendasList({}), []);
    });

    // ---------- Ciclo horaBonita <-> parseHoraMin ----------
    t.caso("Ciclo horaBonita <-> parseHoraMin: guarda y recupera minutos exactos", () => {
      t.igual(api.parseHoraMin(api.horaBonita(420)), 420); // 7:00 a. m.
      t.igual(api.parseHoraMin(api.horaBonita(870)), 870); // 2:30 p. m.
      t.igual(api.parseHoraMin(api.horaBonita(0)), 0);     // 12:00 a. m.
      t.igual(api.parseHoraMin(api.horaBonita(720)), 720); // 12:00 p. m.
      t.igual(api.parseHoraMin(api.horaBonita(1439)), 1439); // 11:59 p. m.
    });

  }
};
