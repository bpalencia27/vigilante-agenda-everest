module.exports = {
  nombre: "Laboratorios Crónicos (Suite 08)",
  cubre: [
    "_matchLabInWhitelist", "_findLabField",
    "injectLabsIntoCronicos", "setNgValue",
    "_parseFechaLike", "_extractAtheneaFecha", "_extractFechaSolicitudTopLevel"
  ],

  async pruebas(t, api, env, cargar) {
    const c = cargar();
    let mockDOM = {};
    let eventsDispatched = [];

    c.ctx.Event = class Event {
      constructor(type, init) {
        this.type = type;
        this.bubbles = init?.bubbles || false;
      }
    };

    c.env.doc.getElementById = (id) => {
      if (!mockDOM[id]) return null;
      return {
        id: id,
        tagName: "INPUT",
        dispatchEvent: (evt) => {
          eventsDispatched.push({ id, type: evt.type });
        },
        _val: mockDOM[id].value || "",
        set value(v) { this._val = v; mockDOM[id].value = v; },
        get value() { return this._val; }
      };
    };

    const testApi = c.api;

    t.caso("_matchLabInWhitelist: El código manda sobre el nombre (Incidente v11.0.1)", () => {
      const labHbA1c = { CodigoParametro: "903843", nombre: "GLUCOSA EN SUERO (TRUCO)" };
      const matched = testApi._matchLabInWhitelist(labHbA1c);
      t.cierto(!!matched, "Debería haber hecho match por código");
      t.igual(matched.key, "HBA1C");
    });

    t.caso("_matchLabInWhitelist: Exclusiones de Creatinina se respetan (CREATININA EN ORINA != suero)", () => {
      const orina = testApi._matchLabInWhitelist({ nombre: "CREATININA EN ORINA" });
      const creatinuria = testApi._matchLabInWhitelist({ nombre: "CREATINURIA" });
      const depuracion = testApi._matchLabInWhitelist({ nombre: "DEPURACION DE CREATININA 24 H" });
      t.igual(orina, null);
      t.igual(creatinuria, null);
      t.igual(depuracion, null);
      const creatininaSuero = testApi._matchLabInWhitelist({ nombre: "CREATININA" });
      t.cierto(!!creatininaSuero && creatininaSuero.key === "CREATININA");
    });

    t.caso("_matchLabInWhitelist: Triglicéridos CUPS 903868 no se confunde con RAC (Incidente v12.0.5)", () => {
      const trigli = testApi._matchLabInWhitelist({ codigo: "903868", nombre: "TRIGLICERIDOS" });
      t.cierto(!!trigli);
      t.igual(trigli.key, "TRIGLICERIDOS");
    });

    t.caso("_matchLabInWhitelist: Analito desconocido devuelve null", () => {
      const res = testApi._matchLabInWhitelist({ CodigoParametro: "999999", nombre: "LABORATORIO INVENTADO" });
      t.igual(res, null);
    });

    t.caso("_findLabField: encuentra el campo principal o los alternativos", () => {
      mockDOM = { "campoPrincipal": { value: "" } };
      t.igual(testApi._findLabField("campoPrincipal", ["alt1"]).id, "campoPrincipal");
      mockDOM = { "alt2": { value: "" } };
      t.igual(testApi._findLabField("campoPrincipal", ["alt1", "alt2"]).id, "alt2");
      mockDOM = {};
      t.igual(testApi._findLabField("campoPrincipal", []), null);
    });

    t.caso("setNgValue: escribe el valor y despacha eventos 'input' y 'change'", () => {
      let dispatched = [];
      const fakeInput = {
        value: "",
        dispatchEvent: (e) => dispatched.push(e.type)
      };
      testApi.setNgValue(fakeInput, "42.5");
      t.igual(fakeInput.value, "42.5");
      t.cierto(dispatched.includes("input"));
      t.cierto(dispatched.includes("change"));
    });

    t.caso("injectLabsIntoCronicos: PENDIENTE se cuenta como pendiente y no se escribe (Incidente v11.0.1)", () => {
      mockDOM = { "resultadoColesterolTotal": { value: "" } };
      const labs = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "PENDIENTE", idEstado: 1 }];
      const res = testApi.injectLabsIntoCronicos(labs);
      t.igual(res.pendientes, 1);
      t.igual(mockDOM["resultadoColesterolTotal"].value, "");
    });

    t.caso("injectLabsIntoCronicos: Primer valor gana en colisión", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "" },
        "fechaResultGlicemia": { value: "" }
      };
      const labs = [
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2023-01-01" },
        { codigo: "903841", nombre: "GLUCOSA (Duplicado)", Resultado: "9.9", Fecha: "2023-01-02" }
      ];
      const res = testApi.injectLabsIntoCronicos(labs);
      t.igual(res.count, 1, "Solo debe inyectar uno");
      t.igual(mockDOM["resultadoGlicemia"].value, "7.1", "El primer valor debe prevalecer");
      t.igual(mockDOM["fechaResultGlicemia"].value, "2023-01-01", "Debe usar la fecha del primer resultado");
    });

    t.caso("injectLabsIntoCronicos: Sin fecha real, la casilla de fecha queda vacía", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "" },
        "fechaResultGlicemia": { value: "" }
      };
      const labs = [{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1" }];
      testApi.injectLabsIntoCronicos(labs);
      t.igual(mockDOM["fechaResultGlicemia"].value, "", "No debe inventar la fecha de hoy");
    });

    t.caso("injectLabsIntoCronicos: sinCasilla acumula analitos válidos sin destino en el DOM", () => {
      mockDOM = {};
      const labs = [{ codigo: "903843", nombre: "HEMOGLOBINA GLICOSILADA", Resultado: "7.1", Fecha: "2023-01-01" }];
      const res = testApi.injectLabsIntoCronicos(labs);
      t.igual(res.count, 0);
      t.igual(res.sinCasilla.length, 1);
      t.cierto(res.sinCasilla[0].includes("HEMOGLOBINA GLICOSILADA") || res.sinCasilla[0].includes("HBA1C"));
    });

    t.caso("_parseFechaLike: reconoce ISO, dd/mm/aaaa y fecha .NET /Date(ms)/, y descarta lo que no es fecha", () => {
      t.igual(testApi._parseFechaLike("2026-08-01"), "2026-08-01");
      t.igual(testApi._parseFechaLike("2026-08-01T00:00:00"), "2026-08-01", "corta la parte de hora");
      t.igual(testApi._parseFechaLike("1/8/2026"), "2026-08-01", "dd/mm/aaaa sin ceros de relleno");
      // 12:00 UTC del 2026-02-01, para que el resultado no dependa de la zona horaria
      // de la máquina donde corran las pruebas (getFullYear/getMonth/getDate son locales).
      t.igual(testApi._parseFechaLike("/Date(1769947200000)/"), "2026-02-01", "fecha .NET en milisegundos");
      t.igual(testApi._parseFechaLike("PENDIENTE"), null);
      t.igual(testApi._parseFechaLike(""), null);
      t.igual(testApi._parseFechaLike(null), null);
      t.igual(testApi._parseFechaLike("13/40/2026"), null, "mes/día fuera de rango no cuela como fecha");
      // v12.3.33 — hallado en revisión adversarial: sin frontera ni rango, estos dos pasaban.
      t.igual(testApi._parseFechaLike("2026-08-1234567"), null, "un folio con guiones NO es una fecha");
      t.igual(testApi._parseFechaLike("2026-99-99"), null, "mes 99 no existe");
    });

    t.caso("_extractFechaSolicitudTopLevel: SOLO acepta claves de nombre inequívoco — un timestamp del servidor jamás se convierte en fecha clínica (Bloqueante v12.3.33)", () => {
      const conServidor = testApi._extractFechaSolicitudTopLevel({ bolValido: true, fechaConsulta: "2026-08-11T10:33:00", dataObject: "[]" });
      t.igual(conServidor, null, "fechaConsulta (timestamp del servidor = HOY) debe rechazarse");
      const conImpresion = testApi._extractFechaSolicitudTopLevel({ fechaImpresion: "2026-08-11", fecha: "2026-08-11" });
      t.igual(conImpresion, null, "fechaImpresion y 'fecha' a secas también se rechazan");
      const legitima = testApi._extractFechaSolicitudTopLevel({ bolValido: true, FechaSolicitud: "2026-03-02T00:00:00" });
      t.igual(legitima.iso, "2026-03-02", "FechaSolicitud sí es inequívoca");
      t.igual(testApi._extractFechaSolicitudTopLevel({ fechaToma: "01/03/2026" }).iso, "2026-03-01", "fechaToma también");
    });

    t.caso("_extractAtheneaFecha: por nombre conocido gana sobre la búsqueda por forma", () => {
      const r = testApi._extractAtheneaFecha({ nombre: "GLUCOSA", Fecha: "2026-08-01", otraClave: "15/03/2026" });
      t.cierto(!!r);
      t.igual(r.key, "Fecha");
      t.igual(r.iso, "2026-08-01");
    });

    t.caso("_extractAtheneaFecha: sin ningún nombre conocido, detecta la fecha por la FORMA del valor (Incidente v12.3.30 — 'Sin fecha')", () => {
      // Objeto real de Athenea confirmado en consultorio: ninguno de los 4 nombres ya
      // probados (Fecha/fechaResult/fecha/fechaOrden/fechaResultado) existe.
      const lab = { codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", fechaTomaMuestra: "2026-08-01" };
      const r = testApi._extractAtheneaFecha(lab);
      t.cierto(!!r, "debe encontrarla igual, sin conocer el nombre de antemano");
      t.igual(r.key, "fechaTomaMuestra");
      t.igual(r.iso, "2026-08-01");
    });

    t.caso("_extractAtheneaFecha: sin ninguna clave con pinta de fecha, devuelve null (no inventa nada)", () => {
      const r = testApi._extractAtheneaFecha({ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1" });
      t.igual(r, null);
    });

    t.caso("_extractAtheneaFecha: __vglFechaSolicitud es el ÚLTIMO respaldo — una fecha propia del analito siempre gana (v12.3.32)", () => {
      const conPropia = testApi._extractAtheneaFecha({ nombre: "GLUCOSA", fechaToma: "10/02/2026", __vglFechaSolicitud: "2026-08-01" });
      t.igual(conPropia.key, "fechaToma", "la fecha del analito manda");
      t.igual(conPropia.iso, "2026-02-10");
      const soloSolicitud = testApi._extractAtheneaFecha({ nombre: "GLUCOSA", Resultado: "7.1", __vglFechaSolicitud: "2026-08-01" });
      t.igual(soloSolicitud.key, "__vglFechaSolicitud", "sin fecha propia, hereda la de la solicitud");
      t.igual(soloSolicitud.iso, "2026-08-01");
    });

    await t.casoAsync("fetchAtheneaLabs: hereda la fecha del NIVEL DE SOLICITUD a cada analito que no trae fecha propia (v12.3.32)", async () => {
      const c2 = cargar({
        silencioso: true,
        gmxhr: (o) => o.onload({
          status: 200,
          responseText: JSON.stringify({
            bolValido: true,
            FechaSolicitud: "2026-08-01T00:00:00",
            dataObject: JSON.stringify([{ nombre: "GLUCOSA", Resultado: "7.1" }, { nombre: "CREATININA", Resultado: "1.2" }]),
          }),
        }),
      });
      const data = await c2.api.fetchAtheneaLabs(123, 2026);
      t.igual(data.length, 2);
      t.igual(data[0].__vglFechaSolicitud, "2026-08-01");
      t.igual(data[1].__vglFechaSolicitud, "2026-08-01");
      t.igual(c2.api._extractAtheneaFecha(data[0]).iso, "2026-08-01", "el detector la usa como respaldo final");
    });

    await t.casoAsync("fetchAtheneaLabs: un timestamp del servidor (fechaConsulta=HOY) NO se hereda a los analitos (Bloqueante v12.3.33)", async () => {
      const c3 = cargar({
        silencioso: true,
        gmxhr: (o) => o.onload({
          status: 200,
          responseText: JSON.stringify({
            bolValido: true,
            fechaConsulta: "2026-08-11T10:33:00",
            dataObject: JSON.stringify([{ nombre: "GLUCOSA", Resultado: "7.1" }]),
          }),
        }),
      });
      const data = await c3.api.fetchAtheneaLabs(123, 2026);
      t.igual(data[0].__vglFechaSolicitud, undefined, "sin clave inequívoca de solicitud, NO se estampa nada");
      t.igual(c3.api._extractAtheneaFecha(data[0]), null, "y el analito queda honestamente sin fecha (casilla vacía, jamás inventada)");
    });

    t.caso("injectLabsIntoCronicos: escribe la fecha aunque venga en una clave desconocida, detectada por su forma (Incidente v12.3.30)", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "" },
        "fechaResultGlicemia": { value: "" }
      };
      const labs = [{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", fechaTomaMuestra: "15/03/2026" }];
      testApi.injectLabsIntoCronicos(labs);
      t.igual(mockDOM["fechaResultGlicemia"].value, "2026-03-15", "convierte dd/mm/aaaa a ISO, el formato que exige <input type=date>");
    });

    t.caso("injectLabsIntoCronicos: si el resultado tiene un input[type=date] HERMANO en su .input-group, se usa ese en vez del dateId estático nunca verificado (Incidente v12.3.31 — fechas que seguían sin aparecer pese a v12.3.30)", () => {
      const fechaHermana = { id: "fecha-real-en-el-dom", value: "", dispatchEvent: () => {} };
      const grupo = { querySelector: (sel) => (sel === 'input[type="date"]' ? fechaHermana : null) };
      const resultEl = {
        id: "resultadoGlicemia", tagName: "INPUT", value: "",
        dispatchEvent: () => {},
        closest: (sel) => (sel === ".input-group" ? grupo : null),
      };
      const prevGetById = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => (id === "resultadoGlicemia" ? resultEl : null);
      const labs = [{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2023-05-05" }];
      testApi.injectLabsIntoCronicos(labs);
      c.env.doc.getElementById = prevGetById;
      t.igual(resultEl.value, "7.1");
      t.igual(fechaHermana.value, "2023-05-05", "usa el input[type=date] hermano del .input-group, NO el id estático fechaResultGlicemia (que aquí ni siquiera existe en el DOM)");
    });

    t.caso("_matchLabInWhitelist: RAC casa por resultId 'resultadoRelacionAlbuminaCreatinina', y no debe confundirse con la otra casilla", () => {
      // Simular un RAC para asegurarnos de que la key de destino tiene el target principal que es resultadoRelacionAlbuminaCreatinina
      const rac = testApi._matchLabInWhitelist({ codigo: "8779", nombre: "RELACION MICROALBUMINURIA CREATININA" });
      t.cierto(!!rac);
      t.igual(rac.key, "RAC");
      t.igual(rac.resultId, "resultadoRelacionAlbuminaCreatinina", "Debe dirigirse a la casilla correcta");
      t.falso(rac.resultId === "resultadoMicroAlbuminuriaCreatinuria", "NO debe dirigirse a la casilla resultadoMicroAlbuminuriaCreatinuria");
    });
  }
};
