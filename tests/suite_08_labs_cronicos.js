module.exports = {
  nombre: "Laboratorios Crónicos (Suite 08)",
  cubre: [
    "_matchLabInWhitelist", "_findLabField",
    "injectLabsIntoCronicos", "setNgValue",
    "_parseFechaLike", "_extractAtheneaFecha", "_extractFechaSolicitudTopLevel",
    "_esAnalitoDeOrina", "_matchUroComponente", "_findUroInput", "_canonTexto"
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

    t.caso("injectLabsIntoCronicos: en colisión gana la fecha MÁS RECIENTE, no el primero de la lista (v12.5.6, pedido del médico)", () => {
      // Antes ganaba "el primero de la lista" asumiendo que Athenea siempre entrega de
      // más reciente a más antigua — un supuesto de orden, no una comparación real de
      // fechas. Aquí el duplicado MÁS VIEJO va primero en labsArray a propósito: si el
      // fix funciona, igual gana el de fecha 2023-01-02 (el más reciente de verdad).
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
      t.igual(mockDOM["resultadoGlicemia"].value, "9.9", "gana el resultado con la fecha más reciente, aunque llegue segundo en la lista");
      t.igual(mockDOM["fechaResultGlicemia"].value, "2023-01-02", "la fecha escrita es la del resultado más reciente");
    });

    t.caso("injectLabsIntoCronicos: en colisión, un resultado CON fecha le gana a uno SIN fecha (sin importar el orden)", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "" },
        "fechaResultGlicemia": { value: "" }
      };
      const labs = [
        { codigo: "903841", nombre: "GLUCOSA (sin fecha)", Resultado: "5.5" },
        { codigo: "903841", nombre: "GLUCOSA (con fecha)", Resultado: "6.6", Fecha: "2024-06-01" }
      ];
      const res = testApi.injectLabsIntoCronicos(labs);
      t.igual(mockDOM["resultadoGlicemia"].value, "6.6", "el resultado con fecha conocida es más informativo y gana");
      t.igual(mockDOM["fechaResultGlicemia"].value, "2024-06-01");
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

    t.caso("injectLabsIntoCronicos: una casilla que YA tiene valor se RESPETA — ni el valor ni su fecha se tocan (Incidente v12.3.34: el robot pisaba lo del médico)", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "120" },
        "fechaResultGlicemia": { value: "2026-01-01" }
      };
      const labs = [{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2023-05-05" }];
      const r = testApi.injectLabsIntoCronicos(labs);
      t.igual(mockDOM["resultadoGlicemia"].value, "120", "el valor que ya estaba escrito manda");
      t.igual(mockDOM["fechaResultGlicemia"].value, "2026-01-01", "su fecha tampoco se toca");
      t.igual(r.count, 0, "no cuenta como diligenciada");
      t.igual(r.respetadas, 1, "y se informa como respetada");
    });

    t.caso("injectLabsIntoCronicos: una FECHA corregida a mano por el médico no se pisa aunque el valor esté vacío (v12.3.35 — revisión adversarial)", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "" },
        "fechaResultGlicemia": { value: "2026-02-02" }
      };
      const labs = [{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2023-05-05" }];
      const r = testApi.injectLabsIntoCronicos(labs);
      t.igual(mockDOM["resultadoGlicemia"].value, "7.1", "el valor vacío sí se diligencia");
      t.igual(mockDOM["fechaResultGlicemia"].value, "2026-02-02", "la fecha del médico queda intacta");
      t.igual(r.count, 1);
    });

    t.caso("injectLabsIntoCronicos: si el valor ya escrito ES el de Athenea, un reintento completa la fecha que quedó vacía (v12.3.35)", () => {
      mockDOM = {
        "resultadoGlicemia": { value: "7.1" },
        "fechaResultGlicemia": { value: "" }
      };
      const labs = [{ codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2023-05-05" }];
      const r = testApi.injectLabsIntoCronicos(labs);
      t.igual(mockDOM["resultadoGlicemia"].value, "7.1", "el valor no se reescribe");
      t.igual(mockDOM["fechaResultGlicemia"].value, "2023-05-05", "pero la fecha faltante sí se completa");
      t.igual(r.count, 0);
      t.igual(r.respetadas, 1);
    });

    t.caso("_atheneaExtraerSolicitudes: extrae la fecha de la TARJETA solo con fecha única y año coincidente (v12.3.35 — única fuente de fecha confirmada en campo)", () => {
      const conFecha = testApi._atheneaExtraerSolicitudes(
        '<div>Solicitud 4321 · 05/03/2026 · LAB</div><form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>');
      t.igual(conFecha.length, 1);
      t.igual(conFecha[0].fechaIso, "2026-03-05", "una sola fecha y su año calza con el de la solicitud");
      const ambigua = testApi._atheneaExtraerSolicitudes(
        '<div>Del 01/02/2026 al 05/03/2026</div><form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>');
      t.igual(ambigua[0].fechaIso, null, "dos fechas en la tarjeta = ambigüedad = sin fecha, jamás adivinar");
      const anoAjeno = testApi._atheneaExtraerSolicitudes(
        '<div>05/03/2025</div><form id="43212026" data-modulo="LAB" action="/Resultados/Reporte"></form>');
      t.igual(anoAjeno[0].fechaIso, null, "la fecha no es del año de la solicitud: se descarta");
    });

    t.caso("_atheneaExtraerSolicitudes: v12.3.36 quedó SUPERADA por la tarjeta REAL de campo (v12.5.5) — la fecha después del formulario ya no se busca, a propósito", () => {
      // La v12.3.36 creyó (con un diagnóstico incompleto de esa época) que la fecha
      // visible iba DESPUÉS del <form>, dentro de la misma tarjeta, y por eso dejaba un
      // margen de búsqueda hacia adelante. La tarjeta REAL de consultorio (captura de
      // pantalla + volcado de HTML, 2026-08-11, ver el resto de esta suite y la 18)
      // demostró que la fecha y el "Numero" van SIEMPRE ANTES del formulario — y ese
      // margen hacia adelante, con tarjetas reales pegadas una tras otra, era la vía por
      // la que la fecha (y el hash/token) de una solicitud VECINA se colaban en la
      // actual (hallazgo BLOQUEANTE de la revisión adversarial de v12.5.4). Por eso desde
      // v12.5.5 la ventana ya NO mira después del formulario: este fixture, con la fecha
      // deliberadamente puesta DESPUÉS (una disposición que ya no se cree real), ahora
      // devuelve sin fecha — fail-safe, no una fecha equivocada.
      const html = '<div class="card">\r\n  <div class="card-body p-5">\r\n' +
        '<form id="7368152026" data-modulo="LAB" action="/Resultados/Reporte"></form>' +
        '<h5>Solicitud 736815</h5><span>Fecha: 05/08/2026</span></div></div>';
      const out = testApi._atheneaExtraerSolicitudes(html);
      t.igual(out.length, 1);
      t.igual(out[0].fechaIso, null, "la fecha después del formulario ya no se busca (ver la tarjeta REAL: siempre va antes)");
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

    // ================= v12.3.37 — uroanálisis por componentes =================

    t.caso("_esAnalitoDeOrina: por padre ORINA, o por nombre inequívoco de orina; jamás por LEUCOCITOS/HEMOGLOBINA a secas (también existen en sangre)", () => {
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "PARCIAL DE ORINA" }));
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS" }));
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "GLUCOSURIA" }), "GLUCOSURIA solo existe en orina: respaldo sin campo padre");
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "LEUCOCITOS EN ORINA" }));
      t.falso(testApi._esAnalitoDeOrina({ NombreParametro: "LEUCOCITOS" }), "LEUCOCITOS a secas es del hemograma en sangre");
      t.falso(testApi._esAnalitoDeOrina({ NombreParametro: "HEMOGLOBINA" }), "HEMOGLOBINA a secas es la sérica");
    });

    t.caso("_matchUroComponente: sinónimos del LIS y exclusión de cocientes (RPC/microalbuminuria NO son la proteinuria del parcial)", () => {
      t.igual(testApi._matchUroComponente({ NombreParametro: "HEMOGLOBINA" }).key, "SANGRE");
      t.igual(testApi._matchUroComponente({ NombreParametro: "ESTERASA LEUCOCITARIA" }).key, "LEUCOCITOS");
      t.igual(testApi._matchUroComponente({ NombreParametro: "Hematíes" }).key, "HEMATIES", "con tilde también casa (normalización)");
      t.igual(testApi._matchUroComponente({ NombreParametro: "ERITROCITOS" }).key, "HEMATIES");
      t.igual(testApi._matchUroComponente({ NombreParametro: "GLUCOSA" }).key, "GLUCOSURIA");
      t.igual(testApi._matchUroComponente({ NombreParametro: "PROTEINAS" }).key, "PROTEINURIA");
      t.igual(testApi._matchUroComponente({ NombreParametro: "RELACION PROTEINA/CREATININA EN ORINA" }), null, "un cociente no es la proteinuria del parcial");
      t.igual(testApi._matchUroComponente({ NombreParametro: "ASPECTO" }), null, "componente sin casilla en la vista: no se mapea");
    });

    t.caso("_matchLabInWhitelist: GUARDA DE ORINA v12.3.37 — el padre ORINA bloquea el match sérico por nombre; RAC/UROANALISIS y el código exacto siguen pasando", () => {
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "PARCIAL DE ORINA" }), null, "hemoglobina EN ORINA jamás casa con la casilla sérica");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS" }), null, "glucosa EN ORINA jamás casa con glicemia");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "HEMOGLOBINA" }).key, "HEMOGLOBINA", "la sérica de siempre sigue casando");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "RELACION MICROALBUMINURIA CREATININA", NombreParametroPadre: "PARCIAL DE ORINA" }).key, "RAC", "el RAC ES de orina: exento de la guarda");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "UROANALISIS", NombreParametroPadre: "PARCIAL DE ORINA" }).key, "UROANALISIS", "el panel padre sigue contándose/avisándose como siempre");
      t.igual(testApi._matchLabInWhitelist({ CodigoParametro: "8779", NombreParametro: "CUALQUIERA", NombreParametroPadre: "ORINA" }).key, "RAC", "el CUPS exacto manda incluso con padre de orina");
    });

    t.caso("injectLabsIntoCronicos v12.3.37: la HEMOGLOBINA del parcial de orina NO toca la casilla sérica (queda para su casilla de componente)", () => {
      mockDOM = { "resultadoHemoglobina": { value: "" } };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = () => [];
      const labs = [{ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "PARCIAL DE ORINA", Resultado: "+++" }];
      const res = testApi.injectLabsIntoCronicos(labs);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(mockDOM["resultadoHemoglobina"].value, "", "la casilla sérica queda intacta");
      t.cierto(res.sinCasilla.includes("URO_SANGRE"), "y se avisa que su casilla de componente no está en esta vista");
    });

    t.caso("injectLabsIntoCronicos v12.3.37: los componentes se escriben por placeholder, verbatim, solo en casilla vacía y con el más reciente primero", () => {
      mockDOM = {};
      const inputSangre = { placeholder: "Resultado Sangre", value: "", dispatchEvent: () => {} };
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "NEGATIVO ESCRITO POR EL MEDICO", dispatchEvent: () => {} };
      const inputProteinuria = { placeholder: "Resultado  Proteinuria ", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      // El mock respeta el selector: si producción dejara de pedir input[placeholder],
      // este caso debe romperse (revisión adversarial: un mock ciego al selector dejaba
      // el ancla real inverificable).
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputSangre, inputNitritos, inputProteinuria] : []);
      const labs = [
        // orden real: la solicitud más reciente llega primero
        { NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" },
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "POSITIVO" },
        { NombreParametro: "PROTEINAS", NombreParametroPadre: "UROANALISIS", Resultado: "PENDIENTE", idEstado: 1 },
        { NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "UROANALISIS", Resultado: "+++ (solicitud vieja)" }
      ];
      const res = testApi.injectLabsIntoCronicos(labs);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(inputSangre.value, "NEGATIVO", "hemoglobina en orina → casilla Sangre, valor verbatim, y el MÁS RECIENTE gana");
      t.igual(inputNitritos.value, "NEGATIVO ESCRITO POR EL MEDICO", "un valor distinto del médico se respeta entero");
      t.igual(inputProteinuria.value, "", "un componente PENDIENTE no se escribe (Incidente v11.0.1)");
      t.igual(res.count, 1, "solo la casilla vacía de Sangre se escribió");
      t.igual(res.pendientes, 1);
      // Igualdad EXACTA: con >= 1 el dedup de yaEscritas era indetectable — el duplicado
      // viejo, en vez de OMITIRSE, se colaba como "respetada" nº 2 y el banco seguía verde
      // (mutante confirmado en revisión adversarial).
      t.igual(res.respetadas, 1, "solo Nitritos se respeta; el HEMOGLOBINA viejo se OMITE por dedup, no se cuenta");
    });

    t.caso("_findUroInput y _canonTexto: placeholder normalizado (tildes, espacios dobles, bordes) y null si no existe", () => {
      t.igual(testApi._canonTexto("Resultado  Hematíes "), "RESULTADO HEMATIES", "tildes fuera, espacios colapsados y recortados");
      const inputHematies = { placeholder: "Resultado Hematíes", value: "", dispatchEvent: () => {} };
      const inputCilindros = { placeholder: "Resultado  Cilindros ", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputHematies, inputCilindros] : []);
      t.igual(testApi._findUroInput("RESULTADO HEMATIES"), inputHematies);
      t.igual(testApi._findUroInput("RESULTADO CILINDROS"), inputCilindros, "el doble espacio del placeholder real también casa");
      t.igual(testApi._findUroInput("RESULTADO GLUCOSURIA"), null);
      c.env.doc.querySelectorAll = prevQSA;
    });

    t.caso("v12.3.37: padres 'URINARIO' (sedimento/citoquímico) también disparan la guarda de orina", () => {
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "SEDIMENTO URINARIO" }));
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "LEUCOCITOS", NombreParametroPadre: "CITOQUIMICO URINARIO" }));
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "SEDIMENTO URINARIO" }), null, "la hemoglobina del sedimento jamás cae en la casilla sérica");
      // v12.3.37 — nota sobre CREATININA.excluye["ORINA"]: para nombres con ORINA la guarda
      // de orina actúa ANTES que el excluye (que se conserva como defensa en profundidad);
      // esta aserción fija la guarda por PADRE, que el caso viejo de exclusiones no cubre.
      t.igual(testApi._matchLabInWhitelist({ nombre: "CREATININA", NombreParametroPadre: "PARCIAL DE ORINA" }), null, "creatinina hija del panel de orina tampoco casa con la sérica");
    });

    t.caso("v12.3.37: los exámenes CUANTITATIVOS de orina (24 h, albúmina del RAC) NO caen en las casillas de la tira reactiva", () => {
      t.igual(testApi._matchUroComponente({ NombreParametro: "GLUCOSA EN ORINA DE 24 HORAS" }), null);
      t.igual(testApi._matchUroComponente({ NombreParametro: "PROTEINAS EN ORINA DE 24 HORAS" }), null);
      t.igual(testApi._matchUroComponente({ NombreParametro: "PROTEINURIA DE 24 HORAS" }), null);
      t.igual(testApi._matchUroComponente({ NombreParametro: "ALBUMINA EN ORINA" }), null, "el hijo cuantitativo del panel RAC no es la proteinuria de la tira");
      const inputGlucosuria = { placeholder: "Resultado Glucosuria", value: "", dispatchEvent: () => {} };
      const inputProteinuria = { placeholder: "Resultado Proteinuria", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputGlucosuria, inputProteinuria] : []);
      const res = testApi.injectLabsIntoCronicos([
        { NombreParametro: "GLUCOSA EN ORINA DE 24 HORAS", Resultado: "1250" },
        { NombreParametro: "PROTEINAS EN ORINA DE 24 HORAS", Resultado: "412.5" }
      ]);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(res.count, 0);
      t.igual(inputGlucosuria.value, "", "mg/24 h no es un resultado de tira reactiva");
      t.igual(inputProteinuria.value, "");
    });

    t.caso("v12.3.37: el analito MÁS RECIENTE reclama su casilla aunque esté PENDIENTE o vacío — un duplicado viejo no la llena (estas casillas no tienen fecha que delate el dato viejo)", () => {
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const inputSangre = { placeholder: "Resultado Sangre", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputNitritos, inputSangre] : []);
      const res = testApi.injectLabsIntoCronicos([
        // orden real: la solicitud más reciente llega primero
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "PENDIENTE", idEstado: 1 },
        { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "" },
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO (SOLICITUD VIEJA)" },
        { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "+++ (SOLICITUD VIEJA)" }
      ]);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(inputNitritos.value, "", "el PENDIENTE reciente bloquea el dato viejo");
      t.igual(inputSangre.value, "", "el resultado vacío reciente también bloquea");
      t.igual(res.count, 0);
      t.igual(res.pendientes, 1);
    });

    t.caso("v12.3.37: un hijo cuyo nombre incluye el del panel ('LEUCOCITOS (PARCIAL DE ORINA)') va a SU casilla de componente, no a la general del uroanálisis", () => {
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "LEUCOCITOS (PARCIAL DE ORINA)" }), null, "no debe casar con la entrada general UROANALISIS");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "PARCIAL DE ORINA" }).key, "UROANALISIS", "el panel padre a secas sigue casando como siempre");
      const inputLeucocitos = { placeholder: "Resultado Leucocitos", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputLeucocitos] : []);
      testApi.injectLabsIntoCronicos([{ NombreParametro: "LEUCOCITOS (PARCIAL DE ORINA)", Resultado: "15 X CAMPO" }]);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(inputLeucocitos.value, "15 X CAMPO");
    });

    t.caso("v12.3.37: dos analitos DISTINTOS compitiendo por la misma casilla (tira vs. sedimento) — manda el más reciente y se AVISA, nunca omisión muda", () => {
      const inputLeucocitos = { placeholder: "Resultado Leucocitos", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputLeucocitos] : []);
      const avisos = [];
      const consolaPrev = c.ctx.console;
      c.ctx.console = { log: () => {}, warn: (...a) => avisos.push(a.join(" ")), error: () => {}, info: () => {} };
      const res = testApi.injectLabsIntoCronicos([
        { NombreParametro: "ESTERASA LEUCOCITARIA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" },
        { NombreParametro: "RECUENTO DE LEUCOCITOS", NombreParametroPadre: "UROANALISIS", Resultado: "5 X CAMPO" }
      ]);
      c.ctx.console = consolaPrev;
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(inputLeucocitos.value, "NEGATIVO", "el primero (más reciente) manda");
      t.igual(res.count, 1);
      t.igual(avisos.filter((a) => a.includes("URO_LEUCOCITOS")).length, 1, "el hermano omitido se avisa una vez, con la marca de la casilla");
    });

    t.caso("v12.3.37: el diagnóstico de orina vuelca claves reales, no repite paneles idénticos y SÍ vuelve a volcar ante nombres nuevos", () => {
      const c4 = cargar({ silencioso: true });
      const logs = [];
      c4.ctx.console = { log: (...a) => logs.push(a), warn: () => {}, error: () => {}, info: () => {} };
      const cuentaVolcados = () => logs.filter((a) => String(a[0]).includes("diagnóstico uroanálisis")).length;
      const analito = { CodigoParametro: "111", NombreParametro: "NITRITOS", NombreParametroPadre: "PARCIAL DE ORINA", Resultado: "NEGATIVO", idEstado: 2, IdNormalidad: 1 };
      c4.api.injectLabsIntoCronicos([analito]);
      t.igual(cuentaVolcados(), 1);
      const payload = JSON.parse(logs.find((a) => String(a[0]).includes("diagnóstico uroanálisis"))[1]);
      t.igual(payload[0].nombre, "NITRITOS");
      t.igual(payload[0].padre, "PARCIAL DE ORINA");
      t.igual(payload[0].resultado, "NEGATIVO");
      t.igual(payload[0].idNormalidad, 1, "IdNormalidad real de Athenea, la clave de la futura regla NORMAL/ANORMAL");
      t.igual(payload[0].idEstado, 2, "idEstado con la clave real (minúscula), no una adivinada");
      c4.api.injectLabsIntoCronicos([analito]);
      t.igual(cuentaVolcados(), 1, "el mismo panel no se vuelve a imprimir (control de ruido v12.3.36)");
      c4.api.injectLabsIntoCronicos([{ NombreParametro: "CILINDROS", NombreParametroPadre: "PARCIAL DE ORINA", Resultado: "NO SE OBSERVAN", idEstado: 2 }]);
      t.igual(cuentaVolcados(), 2, "un nombre nuevo (otro paciente del día) sí genera evidencia nueva");
    });
  }
};
