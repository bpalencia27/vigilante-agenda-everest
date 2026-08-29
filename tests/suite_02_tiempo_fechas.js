module.exports = {
  nombre: "Tiempo y fechas",
  cubre: ["calcBusinessTargetDate", "calcRangoSondeoIso", "parseHoraMin", "horaBonita", "elapsedMin", "apptKey", "diaNuevo", "todayStamp", "calcBusinessDaysBefore", "format12hTime", "extractAgendasList", "esFestivo"],
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

    // ---------- calcRangoSondeoIso ----------
    t.caso("calcRangoSondeoIso: ±7 días hábiles + sábados candidatos, arreglo ISO exacto", () => {
      const range = api.calcRangoSondeoIso("2026-08-13"); // Jue 13/08/2026; festivos 07/08 (Vie) y 17/08 (Lun)
      const isos = range.map(r => r.iso);
      t.igual(isos, [
        "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-08", "2026-08-10", "2026-08-11",
        "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-18", "2026-08-19", "2026-08-20",
        "2026-08-21", "2026-08-22", "2026-08-24", "2026-08-25",
      ]);
    });

    t.caso("calcRangoSondeoIso: metadatos — confirmado, esSabado, centro único y sin domingos/festivos", () => {
      const range = api.calcRangoSondeoIso("2026-08-13");
      t.igual(range.length, 18);

      const centro = range.filter(r => r.isCenter);
      t.igual(centro.length, 1);
      t.igual(centro[0].iso, "2026-08-13");

      const confirmadosAntes = range.filter(r => r.iso < "2026-08-13" && r.confirmado === true);
      const confirmadosDespues = range.filter(r => r.iso > "2026-08-13" && r.confirmado === true);
      t.igual(confirmadosAntes.length, 7);
      t.igual(confirmadosDespues.length, 7);

      const sabados = range.filter(r => r.esSabado === true);
      t.igual(sabados.map(r => r.iso), ["2026-08-08", "2026-08-15", "2026-08-22"]);
      t.cierto(sabados.every(r => r.confirmado === false));

      t.cierto(range.every(r => r.dateObj.getDay() !== 0)); // ningún domingo
      t.cierto(range.every(r => !api.esFestivo(r.dateObj))); // ningún festivo (07/08, 17/08)
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
      // La hora se normaliza a "m"+minutos desde medianoche (fix de la alternancia
      // API/scrape: dos formatos de hora para una cita rompían notified/fraudWatch/
      // alertedFraud/contadas). Ver comentario en apptKey (vigilante_agenda.user.js).
      t.igual(api.apptKey({ doc_id: "123", hora_texto: "07:00 AM" }), "123@m420");
      t.igual(api.apptKey({ doc_id: "456" }), "456@");
      // v17.56.0 — LA POSICIÓN EN LA LISTA SALE DE LA CLAVE. Reporte en vivo de una colega
      // (29-ago): «cuando lo confirman tarde sale rojo y después me salía verde». Con el
      // `index` dentro, un cupo adicional o cualquier reordenamiento de la agenda cambiaba
      // la clave de la MISMA cita y la marca de llegada extemporánea quedaba huérfana: la
      // tarjeta volvía a verde y la evidencia para reclamaciones se perdía. Es el mismo
      // defecto que `mtrProdClaveCita` ya corrigió en la v17.6.2, con la misma razón que
      // vale aquí: el orden de la lista no identifica nada.
      t.igual(api.apptKey({ nombre: "JUAN", index: 5, hora_texto: "08:30" }), "JUAN@m510");
      t.igual(api.apptKey({ nombre: "JUAN", index: 9, hora_texto: "08:30" }), "JUAN@m510",
        "la misma cita en otra posición de la lista es la MISMA cita");
      // Y el documento se canonicaliza: los ceros de relleno no parten la cita en dos.
      t.igual(api.apptKey({ doc_id: "0000123", hora_texto: "07:00 AM" }), "123@m420");
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
      // [v14.2.0 — backlog §3] candidatura a cupos Adicional calculada AYER: no debe
      // sobrevivir al cambio de día (el perfil de hoy puede ser otro).
      c.api.__state.perfilAdicionalCache.set("789", { adicionales: true, motivo: "" });

      // Inject day 2
      mockIsoStr = "2026-08-11T12:00:00";
      c.api.diaNuevo();

      // Validate cleanup
      t.igual(c.api.__state.warnedTimes.size, 0);
      t.igual(c.api.__state.fraudWatch.size, 0);
      t.igual(c.api.__state.notified.size, 0);
      t.igual(c.api.__state.historical.size, 0);
      t.igual(c.api.__state.perfilAdicionalCache.size, 0, "la candidatura de ayer no debe sobrevivir al día nuevo");
    });

    // ---------- calcBusinessDaysBefore ----------
    t.caso("calcBusinessDaysBefore: cuenta días hábiles hacia atrás evitando fin de semana", () => {
      // 2026-08-10 is a Monday. 1 business day before is Friday 2026-08-07
      const fri = api.calcBusinessDaysBefore("2026-08-10", 1);
      // antes daba 2026-08-07 porque no se excluía Batalla de Boyacá; ahora correctamente cae en 2026-08-06
      t.igual(fri.iso, "2026-08-06");

      // 5 business days before 2026-08-10 (Mon) -> 2026-08-03 (Mon)
      const prevMon = api.calcBusinessDaysBefore("2026-08-10", 5);
      // antes daba 2026-08-03 porque no se excluía Batalla de Boyacá; ahora correctamente cae en 2026-07-31
      t.igual(prevMon.iso, "2026-07-31");
    });

    t.caso("calcBusinessDaysBefore: cruce de fin de mes / año", () => {
      // 2026-01-02 is a Friday. 2 business days before is 2025-12-31 (Wednesday)
      const prevYear = api.calcBusinessDaysBefore("2026-01-02", 2);
      // antes daba 2025-12-31 porque no se excluía Año Nuevo (2026-01-01); ahora correctamente cae en 2025-12-30
      t.igual(prevYear.iso, "2025-12-30");
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


    // ---------- FESTIVOS ----------
    t.caso("esFestivo: Un festivo entre semana no es día hábil", () => {
      runWithMockDate("2026-07-20T12:00:00", (mockApi, env, ctx) => {
        t.cierto(mockApi.esFestivo(new ctx.Date("2026-07-20T12:00:00")));
      });
    });

    t.caso("esFestivo: Un día normal entre semana sí es hábil", () => {
      runWithMockDate("2026-07-21T12:00:00", (mockApi, env, ctx) => {
        t.falso(mockApi.esFestivo(new ctx.Date("2026-07-21T12:00:00")));
      });
    });

    // v14.0.1 — San Pedro y San Pablo (29 de junio, Ley Emiliani) trasladado al lunes
    // siguiente: en 2027 el 29 cae martes, así que el trasladado real es el 5 de julio.
    // Faltaba en la tabla (a diferencia de 2026, donde el 29 YA cae lunes, sin traslado).
    t.caso("esFestivo: 2027-07-05 (San Pedro trasladado) es festivo", () => {
      runWithMockDate("2027-07-05T12:00:00", (mockApi, env, ctx) => {
        t.cierto(mockApi.esFestivo(new ctx.Date("2027-07-05T12:00:00")));
      });
    });

    t.caso("calcBusinessTargetDate: Una fecha objetivo que cae en festivo se desplaza al siguiente día hábil", () => {
      runWithMockDate("2026-07-17T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessTargetDate(0, 3);
        t.igual(r.iso, "2026-07-21");
      });
    });

    t.caso("calcBusinessDaysBefore: no cuenta los festivos al contar hacia atrás", () => {
      runWithMockDate("2026-07-21T12:00:00", (mockApi) => {
        const r = mockApi.calcBusinessDaysBefore("2026-07-21", 1);
        t.igual(r.iso, "2026-07-17");
      });
    });

    // v17.6.8 — ANTES: para años fuera de la tabla (2030+) esFestivo devolvía SIEMPRE
    // false y el agendamiento habría citado tomas el 1 de enero sin decirlo. Ahora se
    // delega al motor calculado (Ley Emiliani, mtrEsFestivoCO), que no tiene techo; el
    // aviso de "tabla caducada" se conserva por si alguien lee la consola.
    t.caso("esFestivo: Un año fuera de la tabla delega al motor calculado y deja el aviso", () => {
      runWithMockDate("2030-01-01T12:00:00", (mockApi, env, ctx) => {
        const d = new ctx.Date("2030-01-01T12:00:00");
        t.cierto(mockApi.esFestivo(d), "1-ene-2030 es festivo (Año Nuevo por Ley Emiliani, ya no tabla caduca)");
        t.cierto(mockApi.__state.warnedTimes.has("festivos_caducados"));
      });
    });

    t.caso("calcBusinessTargetDate: Festivo pegado a fin de semana salta al martes", () => {
      runWithMockDate("2026-08-14T12:00:00", (mockApi) => {
        const range = mockApi.calcDateRangeAroundIso("2026-08-14", 3);
        const isos = range.map(r => r.iso);
        const nextDays = isos.slice(-3);
        t.igual(nextDays, ["2026-08-18", "2026-08-19", "2026-08-20"]);
      });
    });

  }
};