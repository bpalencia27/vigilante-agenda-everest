module.exports = {
  nombre: "Laboratorios Crónicos (Suite 08)",
  cubre: [
    "_matchLabInWhitelist", "_findLabField",
    "injectLabsIntoCronicos", "setNgValue",
    "_parseFechaLike", "_extractAtheneaFecha", "_extractFechaSolicitudTopLevel",
    "_esAnalitoDeOrina", "_matchUroComponente", "_hayComponenteUroReal", "_findUroInput", "_canonTexto",
    "_resumenClinicoUro", "_esUroComponenteAlterado",
    "_ultimaFechaPorAnalito", "_nuevoReemplazaCandidato", "_analitosRcvVencidos", "_valorCrudoLab", "_marcarUroanalisisSi",
    "_vigenciaDiasParaAnalito", "_vigenciaNormaDiasParaAnalito", "_canonNombreLab", "_findHbA1cFields",
    "_getRacGuardiaParaTest", "_setRacGuardiaParaTest", "checkRacGuardia", "_pacienteSigueAbierto",
    "_resolverLdlPorTrigliceridos",
    "mtrAvisoTablaLabsHtml", "atheneaLecturaIncompleta",   // v17.7.1
    "_esMuestraSerica", "_agruparUroanalisisParaTabla",    // v17.7.4
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

    t.caso("_valorCrudoLab: conserva valores legitimos y descarta vacios", () => {
      t.igual(testApi._valorCrudoLab(0), 0);
      t.igual(testApi._valorCrudoLab("120"), "120");
      t.igual(testApi._valorCrudoLab(""), undefined);
      t.igual(testApi._valorCrudoLab(null), undefined);
      t.igual(testApi._valorCrudoLab(undefined), undefined);
    });

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

    // v18.0.31 — GUARDA DEL HEMOGRAMA. Medido con el arnés antes de tocar nada: SEIS
    // nombres del hemograma casaban con la casilla de hemoglobina SÉRICA, y cuál ganaba lo
    // decidía el orden en que Athenea devolviera las filas (los tres del panel son
    // numéricos y de la misma fecha, así que _nuevoReemplazaCandidato empata). Una anemia
    // de 9.8 podía quedar escrita como 30.2 (el HCM, en pg), y una A1c de 7.2 como una
    // anemia severa que el paciente no tiene.
    t.caso("_matchLabInWhitelist (v18.0.31): los índices del hemograma NO se llevan la casilla de hemoglobina sérica", () => {
      const roban = [
        "HEMOGLOBINA CORPUSCULAR MEDIA",                   // HCM, en pg
        "CONCENTRACION DE HEMOGLOBINA CORPUSCULAR MEDIA",  // CHCM, en g/dL
        "HEMOGLOBINA GLOBULAR MEDIA",
        "HEMOGLOBINA A1C",                                 // glicosilada, en %
        "HEMOGLOBINA FETAL",
      ];
      roban.forEach((n) => {
        const m = testApi._matchLabInWhitelist({ nombre: n, NombreParametroPadre: "HEMOGRAMA IV (AUTOMATIZADO)" });
        t.igual(m, null, n + " no puede caer en la casilla de hemoglobina: casilla vacía antes que dato inventado");
      });
      // Y la contrapartida, para que la guarda no se pueda «arreglar» excluyéndolo todo:
      const hb = testApi._matchLabInWhitelist({ nombre: "HEMOGLOBINA" });
      t.cierto(!!hb && hb.key === "HEMOGLOBINA", "la hemoglobina de verdad sigue casando");
      // El CUPS exacto manda sobre el nombre y no lo toca ninguna exclusión.
      const porCups = testApi._matchLabInWhitelist({ codigo: "902207", nombre: "HEMOGLOBINA CORPUSCULAR MEDIA" });
      t.cierto(!!porCups && porCups.key === "HEMOGLOBINA", "el CUPS 902207 sigue mandando sobre el nombre");
      // Y la glicosilada sigue yendo a SU casilla, no a la de hemoglobina ni a ninguna.
      const glico = testApi._matchLabInWhitelist({ nombre: "HEMOGLOBINA GLICOSILADA" });
      t.cierto(!!glico && glico.key === "HBA1C", "la glicosilada sigue yendo a HbA1c");
    });

    t.caso("_matchLabInWhitelist: Triglicéridos CUPS 903868 no se confunde con RAC (Incidente v12.0.5)", () => {
      const trigli = testApi._matchLabInWhitelist({ codigo: "903868", nombre: "TRIGLICERIDOS" });
      t.cierto(!!trigli);
      t.igual(trigli.key, "TRIGLICERIDOS");
    });

    t.caso("_matchLabInWhitelist: CUPS 903866 (TGP/ALT) ya NO cae en Triglicéridos (v12.6.0 — auditoría cruzada con el Copiloto)", () => {
      const res = testApi._matchLabInWhitelist({ codigo: "903866", nombre: "TGP" });
      t.igual(res, null, "903866 es TGP/ALT, ninguno de los 13 analitos autorizados — no debe emparejar con nada");
    });

    t.caso("_matchLabInWhitelist: Fósforo casa aunque Athenea lo entregue como 'FOSFORO INORGANICO (FOSFATOS)' (v14.0.0, reportado por el médico)", () => {
      const res = testApi._matchLabInWhitelist({ nombre: "FOSFORO INORGANICO (FOSFATOS)" });
      t.cierto(!!res, "el nombre real que entrega Athenea debe casar, no solo 'FOSFORO EN SUERO'");
      t.igual(res.key, "FOSFORO");
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

    // FIX 9 M2M — Everest ya renderó el MISMO id/name en dos <input> (HbA1c vs
    // Hemoglobina, v12.3.26). getElementById siempre devuelve la PRIMERA copia; si esa
    // primera vive en una copia OCULTA (pestaña de fondo, plantilla residual de Angular),
    // el Auto-Labs escribía en una casilla que el médico no ve.
    t.caso("_findLabField (FIX 9 M2M): id duplicado — gana la copia VISIBLE, no la primera del DOM", () => {
      mockDOM = {};   // getElementById no aporta nada: las copias solo existen en el DOM vivo
      const oculta = { id: "campoDup", value: "x", offsetParent: null };
      const visible = { id: "campoDup", value: "" };
      const qsaOriginal = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) =>
        (sel === "#campoDup" || sel === '[name="campoDup"]') ? [oculta, visible] : [];
      try {
        t.igual(testApi._findLabField("campoDup", []), visible, "debe saltarse la copia oculta (offsetParent null)");
      } finally {
        c.env.doc.querySelectorAll = qsaOriginal;
      }
    });
    t.caso("_findLabField (FIX 9 M2M): TODAS las copias ocultas → devuelve la primera (contrato de siempre)", () => {
      mockDOM = {};
      const o1 = { id: "campoDup2", value: "", offsetParent: null };
      const o2 = { id: "campoDup2", value: "", offsetParent: null };
      const qsaOriginal = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === "#campoDup2" ? [o1, o2] : []);
      try {
        t.igual(testApi._findLabField("campoDup2", []), o1, "fail-safe: sin copia visible se conserva el comportamiento antiguo");
      } finally {
        c.env.doc.querySelectorAll = qsaOriginal;
      }
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

    // v17.6.45 — AUDITORÍA S+ (barrido total, 24-ago-2026): AUDITORÍA #6 (v16.7.0) blindó
    // el conteo de "resultado llevado" contra un rechazo silencioso del navegador (casilla
    // type=number que descarta un valor con coma) SOLO en la ruta de componentes de
    // orina — el camino sérico PRINCIPAL (la whitelist de 13 laboratorios) seguía sumando
    // count++ sin comprobar si setNgValue de verdad escribió algo.
    t.caso("v17.6.45: injectLabsIntoCronicos NO cuenta un resultado que el navegador rechazó (camino sérico principal)", () => {
      mockDOM = { "resultadoColesterolTotal": { value: "" } };
      const getByIdOriginal = c.env.doc.getElementById;
      // Casilla que rechaza CUALQUIER valor (simula un input type=number descartando "1,2"
      // con coma): tras asignarla, value sigue vacío — exactamente lo que setNgValue mide.
      c.env.doc.getElementById = (id) => {
        if (id !== "resultadoColesterolTotal") return null;
        return {
          id: id, tagName: "INPUT",
          dispatchEvent: (evt) => { eventsDispatched.push({ id, type: evt.type }); },
          get value() { return ""; }, set value(v) { /* el navegador rechaza: no queda nada */ },
        };
      };
      try {
        const labs = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "1,2", Fecha: "2023-01-01" }];
        const res = testApi.injectLabsIntoCronicos(labs);
        t.igual(res.count, 0, "el rechazo del navegador NO debe contar como resultado llevado");
      } finally {
        c.env.doc.getElementById = getByIdOriginal;
      }
    });

    // v17.6.45 — mismo blindaje en el reintento de las casillas de componente de
    // uroanálisis (300/900 ms tras marcar SI, cuando Angular tarda en montar el *ngIf):
    // corre dentro de un setTimeout, no es una unidad aislable — se protege por fuente.
    t.caso("v17.6.45: el reintento de casillas de uroanálisis también comprueba setNgValue antes de contar 'escritas'", () => {
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/if \(actual === ""\) \{ setNgValue\(el, r\.resultVal\); escritas\+\+; \}/.test(src), "ya no debe contar sin comprobar el retorno de setNgValue");
      t.cierto(/if \(actual === "" && setNgValue\(el, r\.resultVal\)\) escritas\+\+;/.test(src), "debe exigir que setNgValue haya devuelto true");
    });

    // v18.0.74 — HALLAZGO DE ENJAMBRE #26. A diferencia del VALOR (protegido desde
    // v17.6.45, prueba de arriba), la escritura de FECHA no comprobaba el retorno de
    // setNgValue: un <input type="date"> que el navegador rechaza queda vacío en silencio,
    // pero _fechasYaUsadas la marcaba «reclamada» igual — vacía Y bloqueada para que otro
    // analito la use de respaldo.
    t.caso("v18.0.74: injectLabsIntoCronicos no reclama una casilla de fecha que el navegador rechazó", () => {
      mockDOM = { "resultadoColesterolTotal": { value: "" } };
      const getByIdOriginal = c.env.doc.getElementById;
      c.env.doc.getElementById = (id) => {
        if (id === "resultadoColesterolTotal") {
          return { id, tagName: "INPUT", dispatchEvent: () => {}, get value() { return mockDOM[id].value; }, set value(v) { mockDOM[id].value = v; } };
        }
        if (id === "fechaResultColesterolTotal") {
          // Casilla de fecha que rechaza CUALQUIER valor (simula el <input type="date">
          // real rechazando una fecha de calendario imposible): tras asignarla, value
          // sigue vacío — lo que setNgValue mide para devolver false.
          return { id, tagName: "INPUT", dispatchEvent: () => {}, get value() { return ""; }, set value(v) { /* el navegador rechaza */ } };
        }
        return null;
      };
      // 02-sep — CIERRE ADVERSARIAL (fila 30): esta prueba solo miraba el VALOR y el conteo, y
      // pasaba igual con el defecto original puesto de vuelta (la casilla rechazada seguía
      // «reclamada» en silencio). El arreglo tiene un efecto observable: la rama del rechazo
      // avisa por consola en vez de reclamar la casilla — y las dos ramas son excluyentes.
      const avisos = [];
      const warnAntes = c.ctx.console.warn;
      c.ctx.console.warn = (...a) => { avisos.push(a.map(String).join(" ")); };
      try {
        const labs = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-08-01" }];
        const res = testApi.injectLabsIntoCronicos(labs);
        t.igual(mockDOM["resultadoColesterolTotal"].value, "180", "el valor sí se escribe: es una casilla distinta");
        t.igual(res.count, 1, "y sí cuenta como diligenciado — la fecha es un dato aparte");
        t.cierto(avisos.some((w) => /rechazada por el navegador/.test(w) && /COLESTEROL/.test(w)),
          "y la fecha rechazada se avisa en vez de reclamarse en silencio (la otra rama, la que la marca como usada, NO corrió): " + JSON.stringify(avisos));
      } finally {
        c.env.doc.getElementById = getByIdOriginal;
        c.ctx.console.warn = warnAntes;
      }
    });

    // v18.0.106 — refutador de v18.0.100 (fila 30, prueba hueca): la conductual de arriba miraba
    // el CANAL (el texto de console.warn), no el EFECTO — el defecto entero con el aviso
    // conservado pasaba en verde. El efecto observable: dos analitos cuya casilla de fecha
    // resuelve al MISMO nodo que rechaza; si la casilla rechazada quedara «reclamada», el
    // segundo analito recibiría «ya la ocupó otro analito».
    t.caso("v18.0.106: una casilla de fecha rechazada NO queda reclamada — el segundo analito que cae en ella no recibe «ya la ocupó otro analito»", () => {
      mockDOM = { resultadoColesterolTotal: { value: "" }, resultadoTrigliceridos: { value: "" } };
      const getByIdOriginal = c.env.doc.getElementById;
      const fechaRechaza = { id: "fechaResultColesterolTotal", tagName: "INPUT", dispatchEvent: () => {}, get value() { return ""; }, set value(v) { /* el navegador rechaza */ } };
      c.env.doc.getElementById = (id) => {
        if (mockDOM[id]) return { id, tagName: "INPUT", dispatchEvent: () => {}, get value() { return mockDOM[id].value; }, set value(v) { mockDOM[id].value = v; } };
        if (id === "fechaResultColesterolTotal" || id === "fechaResultTrigliceridos") return fechaRechaza;
        return null;
      };
      const avisos = [];
      const warnAntes = c.ctx.console.warn;
      c.ctx.console.warn = (...a) => { avisos.push(a.map(String).join(" ")); };
      try {
        const labs = [
          { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-08-01" },
          { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "150", Fecha: "2026-08-01" },
        ];
        const res = testApi.injectLabsIntoCronicos(labs);
        t.igual(res.count, 2, "los dos valores se escriben: la fecha es un dato aparte");
        t.igual(mockDOM.resultadoTrigliceridos.value, "150", "el segundo valor también");
        t.igual(avisos.filter((w) => /ya la ocup/.test(w)).length, 0, "la casilla rechazada NO quedó reclamada (defecto de v18.0.74 con aviso conservado: 1): " + JSON.stringify(avisos));
      } finally {
        c.env.doc.getElementById = getByIdOriginal;
        c.ctx.console.warn = warnAntes;
      }
    });

    t.caso("v18.0.74: las tres escrituras de fecha de injectLabsIntoCronicos comprueban el retorno de setNgValue", () => {
      // Las tres rutas (whitelist principal, reintento de uroanálisis, y la de «sin
      // casilla de resultado pero sí de fecha») deben condicionar su efecto (marcar
      // _fechasYaUsadas, sacar de sinCasilla) al ÉXITO real de la escritura.
      const fs = require("fs");
      const path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/setNgValue\(dateInput, resultDate\);\s*\n\s*try \{ _fechasYaUsadas\.add\(dateInput\); \} catch/.test(src),
        "ya no debe marcar _fechasYaUsadas sin comprobar el retorno de setNgValue");
      t.cierto(/if \(setNgValue\(dateInput, resultDate\)\) \{\s*\n\s*try \{ _fechasYaUsadas\.add\(dateInput\); \} catch/.test(src),
        "debe exigir que setNgValue haya devuelto true antes de reclamar la casilla");
      t.cierto(/if \(setNgValue\(soloFecha, resultDate\)\) \{/.test(src),
        "y la ruta 'sin casilla de resultado' también comprueba el retorno antes de sacarla de sinCasilla");
      t.cierto(/let fechaEscrita = false;\s*\n\s*if \(dateInput && resultDate && fechaVacia\) fechaEscrita = setNgValue\(dateInput, resultDate\);/.test(src),
        "y el reintento de uroanálisis guarda si la escritura de verdad quedó, en vez de darla por hecha");
      t.cierto(/\} else if \(!fechaEscrita\) \{\s*\n\s*console\.warn\("\[Vigilante\] uroanálisis: la fecha/.test(src),
        "y avisa cuando el navegador la rechazó — la cuarta razón que antes faltaba en el diagnóstico");
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

    // v17.6.68 — [informe de laboratorio real y captura de pantalla reales, aportados en
    // consultorio, 26-ago-2026] "QUIMICA URINARIA" es un panel CUANTITATIVO (creatinina en
    // orina espontánea, microalbuminuria, relación microalbuminuria/creatinina — el
    // estudio de la RAC) DISTINTO del uroanálisis/parcial de orina cualitativo. Su nombre
    // contiene "URINARIA", y el patrón amplio /URINAR/ (pensado para "SEDIMENTO
    // URINARIO"/"CITOQUIMICO URINARIO", sinónimos REALES del parcial) lo confundía con
    // orina — mezclando dos exámenes de fechas distintas en el mismo bloque "Uroanálisis"
    // de la tabla de Historial de Paraclínicos (_agruparUroanalisisParaTabla).
    t.caso("_esAnalitoDeOrina: QUIMICA URINARIA NO es el uroanálisis/parcial de orina (bug real reportado en consultorio, con informe de laboratorio)", () => {
      t.falso(testApi._esAnalitoDeOrina({ NombreParametro: "CREATININA EN ORINA ESPONTANEA", NombreParametroPadre: "QUIMICA URINARIA" }),
        "creatinina en orina espontánea es de Química Urinaria, no del parcial");
      t.falso(testApi._esAnalitoDeOrina({ NombreParametro: "MICROALBUMINURIA", NombreParametroPadre: "QUIMICA URINARIA" }),
        "microalbuminuria de Química Urinaria tampoco es el parcial");
      t.falso(testApi._esAnalitoDeOrina({ NombreParametro: "RELACION MICROALBUMINURIA CREATININA", NombreParametroPadre: "QUIMICA URINARIA" }),
        "ni la relación microalbuminuria/creatinina (el estudio de la RAC)");
      // Los sinónimos REALES del parcial (SEDIMENTO URINARIO, CITOQUIMICO URINARIO) siguen
      // reconociéndose: la exclusión es específica de "QUIMICA URINARIA", no de /URINAR/ entero.
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "NITRITOS", NombreParametroPadre: "SEDIMENTO URINARIO" }));
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "LEUCOCITOS", NombreParametroPadre: "CITOQUIMICO URINARIO" }));
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

    // =====================================================================
    // v12.6.7 — Reportado en consultorio con captura: el script marcó SI en
    // "¿Uroanálisis?" y dejó TODO el bloque vacío — ni el resultado, ni la fecha, ni las
    // 7 casillas de componente. Causa: el "SI" se marcaba DESPUÉS de recorrer los labs e
    // intentar escribir cada casilla, y esas casillas solo existen en el DOM cuando el
    // interruptor está en SI (Angular las monta con *ngIf). En la primera visita, por
    // tanto, no existía ninguna. Estas pruebas fijan el ORDEN: primero el click, después
    // la escritura. La casilla falsa de abajo solo "aparece" una vez marcado el SI —
    // igual que el *ngIf real—, así que si alguien vuelve a invertir el orden, aquí se ve.
    // =====================================================================
    t.caso("injectLabsIntoCronicos v12.6.7: marca SI ANTES de buscar las casillas (si no, el bloque *ngIf ni existe)", () => {
      mockDOM = {};
      let siMarcado = false;
      const radioSi = { checked: false, parentElement: { textContent: "SI" }, click: () => { siMarcado = true; } };
      const radioNo = { checked: false, parentElement: { textContent: "NO" }, click: () => {} };
      const inputSangre = { placeholder: "Resultado Sangre", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return [radioSi, radioNo];
        // El bloque del uroanálisis NO existe hasta que el SI está marcado.
        if (sel === 'input[placeholder]') return siMarcado ? [inputSangre] : [];
        return [];
      };
      const res = testApi.injectLabsIntoCronicos([
        { NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" }
      ]);
      c.env.doc.querySelectorAll = prevQSA;
      t.cierto(siMarcado, "se pulsó SI");
      t.cierto(res.uroanalisisMarcado, "y se reporta como marcado en esta corrida");
      t.igual(inputSangre.value, "NEGATIVO", "la casilla se llenó en la MISMA corrida: el SI fue primero");
      t.igual(res.count, 1);
      t.falso(res.sinCasilla.includes("URO_SANGRE"), "ya no se reporta 'sin casilla' por un bloque que el propio script hace aparecer");
    });

    t.caso("injectLabsIntoCronicos v12.6.7: sin ningún componente REAL no se marca SI (un PENDIENTE no cuenta)", () => {
      mockDOM = {};
      let siMarcado = false;
      const radioSi = { checked: false, parentElement: { textContent: "SI" }, click: () => { siMarcado = true; } };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[name="resultadoPrograma.swUroanalisis"]' ? [radioSi] : []);
      const res = testApi.injectLabsIntoCronicos([
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "PENDIENTE", idEstado: 1 }
      ]);
      c.env.doc.querySelectorAll = prevQSA;
      t.falso(siMarcado, "un resultado PENDIENTE no autoriza a marcar SI en la historia");
      t.falso(res.uroanalisisMarcado);
    });

    // El click en SI y el re-render del *ngIf de Angular no ocurren en el mismo tick de
    // JS: aunque el orden ya sea el correcto, la casilla puede no existir todavía en ese
    // instante. Reintento acotado (300 ms y 900 ms) y se abandona — nunca un sondeo eterno.
    // El arnés recorta todo setTimeout del script a 1 ms, así que aquí no se mide tiempo:
    // se cuenta cuántas veces se ha ido a buscar la casilla. Aparece recién en la TERCERA
    // búsqueda (síncrona + reintento 1 + reintento 2), que es justo lo que prueba que los
    // DOS reintentos existen.
    await t.casoAsync("injectLabsIntoCronicos v12.6.7: si Angular tarda en montar la casilla, el reintento la completa", async () => {
      mockDOM = {};
      let siMarcado = false, busquedas = 0;
      const radioSi = { checked: false, parentElement: { textContent: "SI" }, click: () => { siMarcado = true; } };
      const inputSangre = { placeholder: "Resultado Sangre", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return [radioSi];
        if (sel === 'input[placeholder]') { busquedas++; return busquedas >= 3 ? [inputSangre] : []; }
        return [];
      };
      const res = testApi.injectLabsIntoCronicos([
        { NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" }
      ]);
      t.cierto(siMarcado);
      t.igual(inputSangre.value, "", "en la corrida síncrona la casilla aún no existía");
      t.cierto(res.sinCasilla.includes("URO_SANGRE"), "y se reportó como sin casilla en ese momento");
      await new Promise((r) => setTimeout(r, 60));
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(inputSangre.value, "NEGATIVO", "el reintento la completó cuando Angular la montó");
      t.igual(busquedas, 3, "una búsqueda síncrona y exactamente DOS reintentos: acotado, nunca un sondeo eterno");
    });

    // v14.0.0 — BUG REPORTADO EN CONSULTA DOS VECES: "Auto-Labs no pone la fecha del
    // uroanálisis". El reintento del uroanálisis (el que espera al *ngIf de Angular tras
    // marcar SI) salía con `if (valorActual !== "") return;` en cuanto la casilla de
    // RESULTADO ya tenía algo, y se llevaba por delante la escritura de la FECHA aunque su
    // casilla estuviera vacía. Basta con que el resultado se haya puesto en una corrida
    // anterior para que la fecha no se escriba nunca, por más veces que se pulse el botón.
    // El camino principal ya separaba valor y fecha desde v12.3.35; a ESTE reintento no.
    // Usa instancia PROPIA: sustituye getElementById/querySelectorAll y el reintento es
    // asíncrono, así que con la instancia compartida los mocks se filtrarían a otras pruebas.
    await t.casoAsync("injectLabsIntoCronicos v14: el reintento del UROANÁLISIS completa la fecha aunque el resultado YA estuviera escrito (bug real de consulta)", async () => {
      const cu = cargar({ silencioso: true });
      cu.ctx.Event = class Event { constructor(tipo, init) { this.type = tipo; this.bubbles = !!(init && init.bubbles); } };
      let siMarcado = false, montada = false;
      const radioSi = { checked: false, parentElement: { textContent: "SI" }, click: () => { siMarcado = true; } };
      const compSangre = { placeholder: "Resultado Sangre", value: "", dispatchEvent: () => {} };
      // La casilla de resultado del uroanálisis YA trae el valor de Athenea (corrida
      // anterior) y su FECHA está VACÍA — el escenario exacto que reportó el médico.
      const fechaUro = { value: "", dispatchEvent: () => {} };
      const resultadoUro = {
        value: "NORMAL", dispatchEvent: () => {},
        closest: () => ({ querySelector: (s) => (s === 'input[type="date"]' ? fechaUro : null) }),
      };
      cu.env.doc.getElementById = (id) => {
        if (id === "resultadoUroanalisis") return montada ? resultadoUro : null; // *ngIf tardío
        if (id === "fechaResultUroanalisis") return montada ? fechaUro : null;
        return null;
      };
      cu.env.doc.querySelector = () => null;
      cu.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return [radioSi];
        if (sel === "input[placeholder]") return montada ? [compSangre] : [];
        return [];
      };
      // Un COMPONENTE real dispara el marcado del SI (la fila padre sola no lo hace), y la
      // fila padre es la que crea el candidato UROANALISIS con su fecha.
      const res = cu.api.injectLabsIntoCronicos([
        { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" },
        { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: "2026-08-10" }
      ]);
      t.cierto(siMarcado, "un componente real marca el SI de ¿Uroanálisis?");
      t.cierto(res.sinCasilla.includes("UROANALISIS"), "en la corrida síncrona la casilla del resultado aún no existía");
      t.igual(fechaUro.value, "", "y por tanto la fecha tampoco se pudo escribir todavía");

      montada = true;                       // Angular monta el *ngIf
      await new Promise((r) => setTimeout(r, 80));

      t.igual(resultadoUro.value, "NORMAL", "el resultado NO se reescribe: ya era el de Athenea");
      t.igual(fechaUro.value, "2026-08-10", "y la FECHA vacía SÍ se completa — esto es lo que fallaba en consulta");
    });

    // =====================================================================
    // v12.6.8 — Reportado en consultorio con el PDF del laboratorio: una paciente con
    // resultado real de RAC (6.93 mg/gr) no se completó en la historia. El emparejamiento
    // por nombre era texto crudo: un separador distinto ("/" o "-" en vez de espacio) o
    // una tilde bastaban para que el analito no casara con NINGUNA entrada y su resultado
    // se perdiera sin dejar rastro. Normalización tipográfica, no clínica: no se amplía
    // qué examen casa con qué casilla.
    // =====================================================================
    t.caso("_matchLabInWhitelist v12.6.8: el mismo examen casa venga con espacio, barra, guion o tildes", () => {
      const variantes = [
        "RELACION MICROALBUMINURIA CREATININA",
        "RELACION MICROALBUMINURIA/CREATININA",
        "RELACION MICROALBUMINURIA-CREATININA",
        "Relación Microalbuminuria / Creatinina",
        "RELACIÓN ALBÚMINA/CREATININA",
        "RELACION ALBUMINA CREATININA"
      ];
      for (const nombre of variantes) {
        const m = testApi._matchLabInWhitelist({ NombreParametro: nombre, NombreParametroPadre: "QUIMICA URINARIA" });
        t.cierto(!!m && m.key === "RAC", "debe casar con RAC: " + nombre);
      }
    });

    t.caso("_matchLabInWhitelist v12.6.8: la normalización NO afloja las exclusiones ni mezcla exámenes", () => {
      // La creatinina sérica y la creatinina EN ORINA siguen siendo distintas (Incidente v11.0.1).
      const orina = testApi._matchLabInWhitelist({ NombreParametro: "CREATININA EN ORINA ESPONTANEA", NombreParametroPadre: "QUIMICA URINARIA" });
      t.falso(orina && orina.key === "CREATININA", "la creatinina en orina no puede caer en la casilla de creatinina sérica");
      // Y una microalbuminuria a secas no es el cociente RAC.
      const micro = testApi._matchLabInWhitelist({ NombreParametro: "MICROALBUMINURIA", NombreParametroPadre: "QUIMICA URINARIA" });
      t.falso(micro && micro.key === "RAC", "la microalbuminuria sola (mg/L) no es la relación albuminuria/creatinina (mg/g)");
    });

    t.caso("_hayComponenteUroReal: distingue componente real de pendiente, vacío y de analito ajeno al parcial", () => {
      t.cierto(testApi._hayComponenteUroReal([{ NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" }]));
      t.falso(testApi._hayComponenteUroReal([{ NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "PENDIENTE", idEstado: 1 }]));
      t.falso(testApi._hayComponenteUroReal([{ NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "" }]));
      t.falso(testApi._hayComponenteUroReal([{ NombreParametro: "LEUCOCITOS", NombreParametroPadre: "HEMOGRAMA", Resultado: "8500" }]), "los leucocitos del hemograma NO son del parcial de orina");
      t.falso(testApi._hayComponenteUroReal([]));
      t.falso(testApi._hayComponenteUroReal(null));
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

    // ================= v12.5.11 — "¿Uroanálisis?" (interruptor SI/NO) =================
    // Confirmado en consultorio (pantallazo del 12-08-2026): dos radios `name=
    // "resultadoPrograma.swUroanalisis"`, SIN atributo `value` (Angular los distingue por
    // FormControl, no por HTML) — la única ancla real es el texto visible del <label> que
    // envuelve cada radio, igual que _findUroInput usa el placeholder.
    function crearRadiosUro({ siChecked = false, noChecked = false } = {}) {
      const radioSi = { checked: siChecked, parentElement: { textContent: " SI " }, clicked: false, click() { this.checked = true; this.clicked = true; } };
      const radioNo = { checked: noChecked, parentElement: { textContent: " NO " }, clicked: false, click() { this.checked = true; this.clicked = true; } };
      return { radioSi, radioNo, lista: [radioSi, radioNo] };
    }

    t.caso("_marcarUroanalisisSi: ningún radio elegido todavía -> marca SI y devuelve true", () => {
      const { radioSi, radioNo, lista } = crearRadiosUro();
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[name="resultadoPrograma.swUroanalisis"]' ? lista : []);
      const r = testApi._marcarUroanalisisSi();
      c.env.doc.querySelectorAll = prevQSA;
      t.cierto(r, "debe reportar que sí marcó");
      t.cierto(radioSi.clicked, "el radio SI recibe el click");
      t.falso(radioNo.clicked, "el radio NO no se toca");
    });

    t.caso("_marcarUroanalisisSi: el médico YA eligió SI -> no lo vuelve a tocar (idempotente) y devuelve false", () => {
      const { radioSi, lista } = crearRadiosUro({ siChecked: true });
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[name="resultadoPrograma.swUroanalisis"]' ? lista : []);
      const r = testApi._marcarUroanalisisSi();
      c.env.doc.querySelectorAll = prevQSA;
      t.falso(r);
      t.falso(radioSi.clicked, "ya estaba marcado por el médico: ni siquiera se vuelve a hacer click");
    });

    t.caso("_marcarUroanalisisSi: el médico YA eligió NO -> se respeta, jamás se sobrescribe con SI", () => {
      const { radioSi, radioNo, lista } = crearRadiosUro({ noChecked: true });
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[name="resultadoPrograma.swUroanalisis"]' ? lista : []);
      const r = testApi._marcarUroanalisisSi();
      c.env.doc.querySelectorAll = prevQSA;
      t.falso(r);
      t.falso(radioSi.clicked, "el NO del médico es una decisión clínica: no se pisa con SI");
      t.cierto(radioNo.checked, "el NO del médico sigue intacto");
    });

    t.caso("_marcarUroanalisisSi: sin radios en esta vista -> no lanza, devuelve false", () => {
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = () => [];
      t.noLanza(() => testApi._marcarUroanalisisSi());
      c.env.doc.querySelectorAll = () => [];
      t.falso(testApi._marcarUroanalisisSi());
      c.env.doc.querySelectorAll = prevQSA;
    });

    // ================= v14.0.3 — _conductaBuscarYAgregarExamen (RETIRADA) =================
    // Deuda muerta documentada en docs/cambios-pendientes/001-retiro-codigo-muerto.md:
    // el mecanismo de clic <li>→"Agregar" y su tabla CONDUCTA_LI_TEXTO_POR_ANALITO se
    // retiraron del script (grep en producción: sin coincidencias). Se retiran también
    // sus casos y la declaración en `cubre`.

    t.caso("injectLabsIntoCronicos v12.5.11: un componente REAL del parcial de orina marca \"SI\" en ¿Uroanálisis? y lo reporta en uroanalisisMarcado", () => {
      mockDOM = {};
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const { radioSi, lista: radios } = crearRadiosUro();
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[placeholder]') return [inputNitritos];
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return radios;
        return [];
      };
      const labs = [{ NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" }];
      const res = testApi.injectLabsIntoCronicos(labs);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(inputNitritos.value, "NEGATIVO", "el componente sí se escribió, como siempre");
      t.cierto(res.uroanalisisMarcado, "injectLabsIntoCronicos reporta que marcó el interruptor");
      t.cierto(radioSi.clicked, "y de verdad hizo click en el radio SI");
    });

    t.caso("injectLabsIntoCronicos v12.5.11: SOLO componentes PENDIENTES/vacíos -> NO marca el interruptor (no hay evidencia de que el examen ya se hizo)", () => {
      mockDOM = {};
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const { radioSi, lista: radios } = crearRadiosUro();
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[placeholder]') return [inputNitritos];
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return radios;
        return [];
      };
      const labs = [{ NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "PENDIENTE", idEstado: 1 }];
      const res = testApi.injectLabsIntoCronicos(labs);
      c.env.doc.querySelectorAll = prevQSA;
      t.falso(res.uroanalisisMarcado, "un resultado PENDIENTE no es evidencia de un uroanálisis ya realizado");
      t.falso(radioSi.clicked);
    });

    t.caso("injectLabsIntoCronicos v12.5.11: componente real, pero el médico YA había marcado NO -> se respeta, no se pisa con SI", () => {
      mockDOM = {};
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const { radioSi, radioNo, lista: radios } = crearRadiosUro({ noChecked: true });
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[placeholder]') return [inputNitritos];
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return radios;
        return [];
      };
      const labs = [{ NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" }];
      const res = testApi.injectLabsIntoCronicos(labs);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(inputNitritos.value, "NEGATIVO", "el componente igual se escribe: eso no depende del interruptor");
      t.falso(res.uroanalisisMarcado, "el NO del médico es una decisión clínica, no se sobrescribe");
      t.falso(radioSi.clicked);
      t.cierto(radioNo.checked);
    });

    t.caso("injectLabsIntoCronicos v12.5.11: sin ningún componente de orina en labsArray (solo suero) -> no marca el interruptor", () => {
      mockDOM = { "resultadoColesterolTotal": { value: "" } };
      const { radioSi, lista: radios } = crearRadiosUro();
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[name="resultadoPrograma.swUroanalisis"]' ? radios : []);
      const labs = [{ NombreParametro: "COLESTEROL TOTAL", Resultado: "180" }];
      const res = testApi.injectLabsIntoCronicos(labs);
      c.env.doc.querySelectorAll = prevQSA;
      t.falso(res.uroanalisisMarcado);
      t.falso(radioSi.clicked, "nunca se hizo click porque no hay evidencia de un componente de orina real");
    });

    // ================= v12.5.12 — casilla de RESULTADO del uroanálisis =================
    // Confirmado en campo: resultadoUroanalisis/fechaResultUroanalisis (los mismos
    // resultId/dateId que WHITELIST_13_LABS ya tenía) solo existen en el DOM cuando
    // "¿Uroanálisis?" está en SI (Angular los monta con *ngIf). Si se acaba de marcar SI
    // en ESTA corrida y la casilla no apareció a tiempo, un único reintento de 300ms (1ms
    // en el banco, ver harness) la busca de nuevo.
    function labsUroConResultado(resultado, fecha) {
      return [
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO" },
        { NombreParametro: "UROANALISIS", CodigoParametro: "907106", Resultado: resultado, Fecha: fecha },
      ];
    }

    await t.casoAsync("injectLabsIntoCronicos v12.5.12: la casilla aparece tras el reintento (Angular tardó en montarla después de marcar SI) -> se completa sola", async () => {
      mockDOM = {};
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const { lista: radios } = crearRadiosUro();
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[placeholder]') return [inputNitritos];
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return radios;
        return [];
      };
      const res = testApi.injectLabsIntoCronicos(labsUroConResultado("NORMAL", "2026-08-10"));
      t.cierto(res.uroanalisisMarcado, "se acaba de marcar SI en esta corrida");
      t.cierto(res.sinCasilla.includes("UROANALISIS"), "todavía no existía la casilla en el momento síncrono");
      // Angular ya montó el *ngIf para cuando dispare el reintento.
      mockDOM.resultadoUroanalisis = { value: "" };
      mockDOM.fechaResultUroanalisis = { value: "" };
      await new Promise((r) => setTimeout(r, 15));
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(mockDOM.resultadoUroanalisis.value, "NORMAL", "el reintento encontró la casilla y escribió el resultado verbatim");
      t.igual(mockDOM.fechaResultUroanalisis.value, "2026-08-10", "y también la fecha, porque estaba vacía");
    });

    await t.casoAsync("injectLabsIntoCronicos v17.1.0 (#71): aunque el interruptor ya estuviera en SI (no se marcó en esta corrida), el reintento SÍ corre", async () => {
      mockDOM = {};
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const { lista: radios } = crearRadiosUro({ siChecked: true }); // el médico ya lo había puesto en SI antes
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[placeholder]') return [inputNitritos];
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return radios;
        return [];
      };
      const res = testApi.injectLabsIntoCronicos(labsUroConResultado("NORMAL", "2026-08-10"));
      t.falso(res.uroanalisisMarcado, "ya estaba en SI: esta corrida no lo marcó");
      t.cierto(res.sinCasilla.includes("UROANALISIS"));
      mockDOM.resultadoUroanalisis = { value: "" }; // aparece igual, por otra razón cualquiera
      await new Promise((r) => setTimeout(r, 15));
      c.env.doc.querySelectorAll = prevQSA;
      // v17.1.0 (#71) — el reintento ya NO exige haber marcado SI en esta corrida: al
      // segundo clic del día (o con SI marcado a mano) el bloque igual se intenta, con
      // las mismas guardas (paciente abierto, casilla vacía).
      t.igual(mockDOM.resultadoUroanalisis.value, "NORMAL", "el reintento corre aunque el SI ya estuviera elegido antes");
    });

    await t.casoAsync("injectLabsIntoCronicos v12.5.12: si entre el click y el reintento el médico YA escribió algo, se respeta (no se pisa)", async () => {
      mockDOM = {};
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const { lista: radios } = crearRadiosUro();
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[placeholder]') return [inputNitritos];
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return radios;
        return [];
      };
      const res = testApi.injectLabsIntoCronicos(labsUroConResultado("NORMAL", "2026-08-10"));
      t.cierto(res.uroanalisisMarcado);
      mockDOM.resultadoUroanalisis = { value: "ANORMAL — leucocitos +++ (escrito por el médico)" };
      await new Promise((r) => setTimeout(r, 15));
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(mockDOM.resultadoUroanalisis.value, "ANORMAL — leucocitos +++ (escrito por el médico)", "casilla sagrada: el reintento nunca sobrescribe lo que el médico ya haya escrito");
    });

    t.caso("injectLabsIntoCronicos v12.5.12: si la casilla YA existe en el momento síncrono (Angular no tardó), se llena de una vez por el camino genérico, sin necesitar reintento", () => {
      mockDOM = { resultadoUroanalisis: { value: "" }, fechaResultUroanalisis: { value: "" } };
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const { lista: radios } = crearRadiosUro();
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[placeholder]') return [inputNitritos];
        if (sel === 'input[name="resultadoPrograma.swUroanalisis"]') return radios;
        return [];
      };
      const res = testApi.injectLabsIntoCronicos(labsUroConResultado("NORMAL", "2026-08-10"));
      c.env.doc.querySelectorAll = prevQSA;
      t.falso(res.sinCasilla.includes("UROANALISIS"), "el camino genérico ya la encontró: no hace falta reintento");
      t.igual(mockDOM.resultadoUroanalisis.value, "NORMAL");
      t.igual(mockDOM.fechaResultUroanalisis.value, "2026-08-10");
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

    // =====================================================================
    // v12.5.7 — _ultimaFechaPorAnalito (extraído de injectLabsIntoCronicos en v12.5.6)
    // =====================================================================
    t.caso("_ultimaFechaPorAnalito: entrada vacía o inválida -> Map vacío, nunca lanza", () => {
      t.igual(testApi._ultimaFechaPorAnalito(null).candidatos.size, 0);
      t.igual(testApi._ultimaFechaPorAnalito(undefined).candidatos.size, 0);
      t.igual(testApi._ultimaFechaPorAnalito([]).candidatos.size, 0);
      t.noLanza(() => testApi._ultimaFechaPorAnalito("no es un arreglo"));
    });

    t.caso("_ultimaFechaPorAnalito: analito no-whitelist se ignora; PENDIENTE cuenta pero no compite por la casilla", () => {
      const r = testApi._ultimaFechaPorAnalito([
        { CodigoParametro: "999999", NombreParametro: "ALGO NO AUTORIZADO", Resultado: "1" },
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "PENDIENTE", idEstado: 1 },
      ]);
      t.igual(r.candidatos.size, 0);
      t.igual(r.pendientesWhitelist, 1);
    });

    // Las DOS condiciones del guard de pendientes se prueban por separado a propósito. El
    // caso de arriba trae idEstado:1 Y Resultado:"PENDIENTE" a la vez, así que romper
    // cualquiera de las dos ramas seguía pasando por culpa de la otra — la mutación
    // `idEstado === 1` -> `=== 2` sobrevivía al banco entero (documentado en
    // INFORME_MUTACIONES.md). Aquí cada rama va sola.
    t.caso("_ultimaFechaPorAnalito: idEstado 1 con un valor numérico viejo en el campo NO se escribe (es un resultado que aún no existe)", () => {
      // El caso clínicamente peligroso: Athenea marca el analito como pendiente (estado 1)
      // pero el campo trae un número —un valor de arrastre, no el resultado de hoy—. Sin el
      // guard, ese número entraría a la casilla como si fuera el resultado vigente.
      const r = testApi._ultimaFechaPorAnalito([
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "126", idEstado: 1, Fecha: "2026-08-01" },
      ]);
      t.igual(r.candidatos.size, 0, "un analito en estado pendiente jamás compite por la casilla, traiga el valor que traiga");
      t.falso(r.candidatos.has("GLUCOSA"), "GLUCOSA no queda como candidata");
      t.igual(r.pendientesWhitelist, 1, "pero sí se cuenta como pendiente para el resumen");
    });

    t.caso("_ultimaFechaPorAnalito: Resultado 'PENDIENTE' sin idEstado tampoco se escribe (la rama del texto, sola)", () => {
      const r = testApi._ultimaFechaPorAnalito([
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "PENDIENTE", Fecha: "2026-08-01" },
      ]);
      t.igual(r.candidatos.size, 0, "sin idEstado, el texto PENDIENTE basta para descartarlo");
      t.igual(r.pendientesWhitelist, 1);
      // Y no depende de la caja: Athenea lo manda en minúscula en algunas respuestas.
      const r2 = testApi._ultimaFechaPorAnalito([
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "pendiente", Fecha: "2026-08-01" },
      ]);
      t.igual(r2.candidatos.size, 0, "'pendiente' en minúscula se descarta igual");
    });

    t.caso("injectLabsIntoCronicos: componente de orina con idEstado 1 pero valor aparentemente real no llega a la historia clinica", () => {
      mockDOM = {};
      const inputNitritos = { placeholder: "Resultado Nitritos", value: "", dispatchEvent: () => {} };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => (sel === 'input[placeholder]' ? [inputNitritos] : []);
      const res = testApi.injectLabsIntoCronicos([
        { NombreParametro: "NITRITOS", NombreParametroPadre: "PARCIAL DE ORINA", Resultado: "NEGATIVO", idEstado: 1 }
      ]);
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(res.pendientes, 1);
      t.igual(res.count, 0);
      t.igual(inputNitritos.value, "");
    });

    t.caso("injectLabsIntoCronicos: entrada que no es arreglo devuelve objeto de estado vacio", () => {
      const casos = [null, undefined, "no es un arreglo", {}];
      for (const val of casos) {
        const r = testApi.injectLabsIntoCronicos(val);
        t.igual(r.count, 0);
        t.igual(r.pendientes, 0);
        t.cierto(Array.isArray(r.sinCasilla) && r.sinCasilla.length === 0);
        t.igual(r.respetadas, 0);
        t.falso(r.uroanalisisMarcado);
      }
    });

    t.caso("_ultimaFechaPorAnalito: entre dos repeticiones del mismo analito, gana la de fecha MÁS RECIENTE (no la primera de la lista)", () => {
      const r = testApi._ultimaFechaPorAnalito([
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "7.1", Fecha: "2024-01-01" },
        { codigo: "903841", nombre: "GLUCOSA", Resultado: "9.9", Fecha: "2024-06-01" },
      ]);
      const c = r.candidatos.get("GLUCOSA");
      t.igual(c.resultVal, "9.9");
      t.igual(c.resultDate, "2024-06-01");
    });

    t.caso("_ultimaFechaPorAnalito: un resultado CON fecha le gana a uno SIN fecha, sin importar el orden", () => {
      const r1 = testApi._ultimaFechaPorAnalito([
        { codigo: "903841", nombre: "GLUCOSA (con fecha)", Resultado: "6.6", Fecha: "2024-06-01" },
        { codigo: "903841", nombre: "GLUCOSA (sin fecha)", Resultado: "5.5" },
      ]);
      t.igual(r1.candidatos.get("GLUCOSA").resultVal, "6.6");
      const r2 = testApi._ultimaFechaPorAnalito([
        { codigo: "903841", nombre: "GLUCOSA (sin fecha)", Resultado: "5.5" },
        { codigo: "903841", nombre: "GLUCOSA (con fecha)", Resultado: "6.6", Fecha: "2024-06-01" },
      ]);
      t.igual(r2.candidatos.get("GLUCOSA").resultVal, "6.6");
    });

    t.caso("_ultimaFechaPorAnalito: un resultado NUMÉRICO 0 es un valor real, no 'ausente' (v12.5.7 — hallazgo de la revisión adversarial)", () => {
      // RAC=0 en un paciente sano es clínicamente posible: un 0 numérico (JS number, no
      // el texto "0") es falsy y `||` lo descartaba como si el analito nunca se hubiera
      // hecho -> _analitosRcvVencidos lo reportaba como "nunca realizado" (falso aviso
      // ROJO) pese a existir un resultado real y reciente.
      const r = testApi._ultimaFechaPorAnalito([
        { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: 0, Fecha: "2026-08-01" },
      ]);
      const c = r.candidatos.get("RAC");
      t.cierto(!!c, "un resultado 0 sí debe registrarse como candidato");
      t.igual(c.resultVal, 0);
      t.igual(c.resultDate, "2026-08-01");
    });

    t.caso("_ultimaFechaPorAnalito: cadena vacía sigue tratándose como ausente (distinto de 0 numérico)", () => {
      const r = testApi._ultimaFechaPorAnalito([{ codigo: "8779", nombre: "RAC", Resultado: "" }]);
      t.igual(r.candidatos.size, 0);
    });

    // =====================================================================
    // v17.6.67 — [reportado en consultorio, 26-ago-2026, con consola completa] "Auto-Labs
    // no reconoció el uroanálisis nuevo, solo uno viejo". Entre DOS candidatos de respaldo
    // por componente (viaComponente: true — el caso normal de UROANALISIS, Athenea manda
    // componentes sueltos, casi nunca una fila del panel completo), la regla 2
    // ("numérico gana a no-numérico, sin importar fecha") no debía aplicar: es casi
    // arbitrario que un componente cualitativo de orina traiga o no un número limpio.
    // Antes del fix, un componente NUMÉRICO viejo ganaba PARA SIEMPRE contra uno
    // cualitativo (p. ej. "NEGATIVO", o un rango con guion "0-2" — ambos no-numéricos para
    // _labNumerico) más reciente. Ahora, entre dos respaldos, manda la fecha, siempre.
    // =====================================================================
    t.caso("_nuevoReemplazaCandidato: entre dos respaldos por componente (UROANALISIS), la FECHA manda aunque el viejo sea 'numérico' y el nuevo no (bug real reportado en consultorio)", () => {
      const viejoNumerico = { viaComponente: true, resultVal: "5", resultDate: "2026-01-15" };
      const nuevoCualitativo = { viaComponente: true, resultVal: "NEGATIVO", resultDate: "2026-08-20" };
      t.cierto(testApi._nuevoReemplazaCandidato(viejoNumerico, nuevoCualitativo),
        "el componente nuevo (agosto, NEGATIVO) debe reemplazar al viejo (enero, '5') aunque el viejo sea numérico");
      // Y la dirección contraria: el nuevo NO debe reemplazar a un candidato ya más reciente.
      t.falso(testApi._nuevoReemplazaCandidato(nuevoCualitativo, viejoNumerico),
        "un componente MÁS VIEJO nunca desplaza a uno más reciente, aunque el viejo sea numérico y el reciente no");
    });

    t.caso("_nuevoReemplazaCandidato: entre dos respaldos por componente, un rango con guion ('0-2', que _labNumerico rechaza) tampoco bloquea la fecha", () => {
      const viejoNumerico = { viaComponente: true, resultVal: "5", resultDate: "2026-01-15" };
      const nuevoRango = { viaComponente: true, resultVal: "0-2", resultDate: "2026-08-20" };
      t.cierto(testApi._nuevoReemplazaCandidato(viejoNumerico, nuevoRango),
        "'0-2' no es numérico para _labNumerico (el guion lo rechaza), pero sigue siendo el componente más reciente y debe ganar");
    });

    t.caso("_nuevoReemplazaCandidato: entre dos respaldos, si el NUEVO es numérico y el viejo no, también gana por fecha (dirección ya cubierta antes, pero confirma que no se rompió)", () => {
      const viejoCualitativo = { viaComponente: true, resultVal: "NEGATIVO", resultDate: "2026-01-15" };
      const nuevoNumerico = { viaComponente: true, resultVal: "6", resultDate: "2026-08-20" };
      t.cierto(testApi._nuevoReemplazaCandidato(viejoCualitativo, nuevoNumerico), "más reciente y numérico: gana, como antes");
    });

    // =================================================================
    //  v18.0.45 — HALLAZGO DEL ENJAMBRE DE FUNCIONES (01-sep), gravedad alta.
    //
    //  Un RAC de 0 de HOY (paciente sin albuminuria, valor real) PERDÍA contra un RAC de
    //  45 de hace meses, y Auto-Labs escribía en la historia el 45 —albuminuria franca,
    //  vencida— diciendo «✓ casillas escritas» en verde. Ni salía en `sinCasilla` ni en
    //  `implausibles`: el médico veía y firmaba un dato falso.
    //
    //  La causa estaba a un nivel de distancia: `_labNumerico` rechaza el 0 A PROPÓSITO
    //  («nunca 0, que en una creatinina sería catastrófico»), pero esa exclusión es GLOBAL
    //  para los 13 analitos y este desempate la reutilizaba como «no es un número».
    //
    //  La contención importa tanto como el arreglo: en los otros once analitos un 0 sigue
    //  siendo un dato roto y tiene que seguir perdiendo.
    // =================================================================
    t.caso("_nuevoReemplazaCandidato: un RAC de 0 de HOY le gana a un RAC de 45 de hace meses", () => {
      const rac = (v, d) => ({ matched: { key: "RAC" }, resultVal: v, resultDate: d });
      t.cierto(testApi._nuevoReemplazaCandidato(rac("45", "2026-01-15"), rac("0", "2026-08-30")),
        "el 0 de agosto (paciente sin albuminuria) reemplaza al 45 de enero");
      t.falso(testApi._nuevoReemplazaCandidato(rac("0", "2026-08-30"), rac("45", "2026-01-15")),
        "y en el orden contrario el 45 viejo NO vuelve a desplazarlo: el resultado no depende del orden de llegada");
      t.cierto(testApi._nuevoReemplazaCandidato(rac("45", "2026-01-15"), rac("0,00", "2026-08-30")),
        "«0,00» con coma decimal es el mismo cero");
    });

    t.caso("_nuevoReemplazaCandidato: el cero SIGUE siendo veneno donde un 0 no es un paciente sano", () => {
      const cre = (v, d) => ({ matched: { key: "CREATININA" }, resultVal: v, resultDate: d });
      t.falso(testApi._nuevoReemplazaCandidato(cre("1.2", "2026-01-15"), cre("0", "2026-08-30")),
        "una creatinina de 0 es una lectura corrupta, no un riñón perfecto: no desplaza a la real");
      const hb = (v, d) => ({ matched: { key: "HEMOGLOBINA" }, resultVal: v, resultDate: d });
      t.falso(testApi._nuevoReemplazaCandidato(hb("13.5", "2026-01-15"), hb("0", "2026-08-30")),
        "ni una hemoglobina de 0");
      // Y dentro del propio RAC, solo un cero LIMPIO cuenta: un rango o un texto no.
      const rac = (v, d) => ({ matched: { key: "RAC" }, resultVal: v, resultDate: d });
      t.falso(testApi._nuevoReemplazaCandidato(rac("45", "2026-01-15"), rac("0-2", "2026-08-30")),
        "«0-2» es un rango, no un cero");
      t.falso(testApi._nuevoReemplazaCandidato(rac("45", "2026-01-15"), rac("NEGATIVO", "2026-08-30")),
        "y «NEGATIVO» sigue sin ser un número");
    });

    t.caso("_ultimaFechaPorAnalito (integración end-to-end): el componente de orina de AGOSTO gana sobre el de ENERO, en cualquier orden de llegada (bug real reportado en consultorio)", () => {
      const enOrden = testApi._ultimaFechaPorAnalito([
        { NombreParametro: "LEUCOCITOS", NombreParametroPadre: "UROANALISIS", Resultado: "5", Fecha: "2026-01-15" },
        { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-20" },
      ], { uroanalisisPorComponentes: true });
      const candA = enOrden.candidatos.get("UROANALISIS");
      t.cierto(!!candA, "UROANALISIS entra como candidato vía componente");
      t.igual(candA.resultDate, "2026-08-20", "gana el componente de agosto, el más reciente");
      t.igual(candA.resultVal, "NEGATIVO");

      // Orden invertido: el componente viejo llega DESPUÉS del nuevo. No debe desplazarlo.
      const ordenInvertido = testApi._ultimaFechaPorAnalito([
        { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: "2026-08-20" },
        { NombreParametro: "LEUCOCITOS", NombreParametroPadre: "UROANALISIS", Resultado: "5", Fecha: "2026-01-15" },
      ], { uroanalisisPorComponentes: true });
      const candB = ordenInvertido.candidatos.get("UROANALISIS");
      t.igual(candB.resultDate, "2026-08-20", "el orden de llegada no debe importar: sigue ganando agosto");
      t.igual(candB.resultVal, "NEGATIVO");
    });

    t.caso("REGLA 1 CORREGIDA (v17.8.2) — la fila real gana a los componentes, pero NUNCA si es más vieja", () => {
      // REPORTE EN CONSULTA (27-ago-2026), y el médico avisa de que es RECURRENTE: «el botón
      // Auto-Labs Athenea no está teniendo en cuenta el último uroanálisis realizado».
      //
      // ESTA PRUEBA FIJABA EL DEFECTO. Se llamaba «REGLA 1 intacta» y exigía justo el caso
      // que él reportó: una fila real de enero ganando a un componente de agosto. La regla
      // existía por una razón buena —una fila real es el veredicto del panel completo, no un
      // fragmento— pero esa razón sirve para elegir ENTRE IGUALES DE FECHA, no para pisar un
      // examen siete meses más nuevo.
      //
      // Y la dirección del daño no es simétrica: reproducido con el arnés, Auto-Labs escribía
      // el texto «NORMAL» y la fecha de mayo sobre el uroanálisis de agosto que la propia
      // tabla marca con «Alteraciones detectadas». Un falso negativo que el médico firma.
      const respaldoReciente = { viaComponente: true, resultVal: "NEGATIVO", resultDate: "2026-08-20" };
      const filaRealVieja = { viaComponente: false, resultVal: "NORMAL", resultDate: "2026-01-01" };
      t.falso(testApi._nuevoReemplazaCandidato(respaldoReciente, filaRealVieja),
        "una fila real MÁS VIEJA ya no puede pisar un uroanálisis más reciente");
      t.cierto(testApi._nuevoReemplazaCandidato(filaRealVieja, respaldoReciente),
        "y el componente más reciente sí desplaza a la fila real vieja ya asentada");

      // Lo que la regla protegía SIGUE protegido: con fecha igual o más nueva, manda la fila
      // real, que es el veredicto del panel entero.
      const filaRealNueva = { viaComponente: false, resultVal: "NORMAL", resultDate: "2026-09-01" };
      t.cierto(testApi._nuevoReemplazaCandidato(respaldoReciente, filaRealNueva),
        "una fila real MÁS NUEVA sigue ganando: es el veredicto del panel completo");
      const mismaFecha = { viaComponente: false, resultVal: "NORMAL", resultDate: "2026-08-20" };
      t.cierto(testApi._nuevoReemplazaCandidato(respaldoReciente, mismaFecha),
        "y con la MISMA fecha también: ahí la preferencia por la fila real es la correcta");

      // Sin fecha con que defenderse, la fila real no escribe un veredicto de antigüedad
      // desconocida sobre uno fechado. La dirección segura.
      const filaRealSinFecha = { viaComponente: false, resultVal: "NORMAL", resultDate: null };
      t.falso(testApi._nuevoReemplazaCandidato(respaldoReciente, filaRealSinFecha),
        "una fila real SIN fecha no puede pisar un componente fechado");
      // Pero si el componente tampoco tiene fecha, no hay con qué desempatar y vuelve a
      // mandar la fila real: sigue siendo la fuente más completa de las dos.
      const respaldoSinFecha = { viaComponente: true, resultVal: "NEGATIVO", resultDate: null };
      t.cierto(testApi._nuevoReemplazaCandidato(respaldoSinFecha, filaRealSinFecha),
        "sin fechas en ninguno de los dos, la fila real sigue siendo la mejor fuente");
    });

    t.caso("_nuevoReemplazaCandidato: REGLA 2 intacta — cuando NINGUNO es viaComponente (analitos séricos normales), numérico usable sigue ganando sin importar fecha", () => {
      const numericoViejo = { viaComponente: false, resultVal: "> 300", resultDate: "2026-01-01" };
      const textoReciente = { viaComponente: false, resultVal: "PENDIENTE REVISION", resultDate: "2026-08-20" };
      t.falso(testApi._nuevoReemplazaCandidato(numericoViejo, textoReciente),
        "un texto sin número, aunque más reciente, no debe desplazar un número real ya asentado (RAC > 300, ver v16.7.0)");
    });

    t.caso("_analitosRcvVencidos: un resultado 0 vigente NO dispara el aviso de faltante (v12.5.7)", () => {
      const labs = [{ codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: 0, Fecha: "2026-08-01" }];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      t.falso(faltantes.some((f) => f.key === "RAC"), "RAC=0 (10 días de antigüedad) es un resultado real y vigente, no un faltante");
    });

    // =====================================================================
    // v12.5.7 — _analitosRcvVencidos: aviso de laboratorios RCV sin resultado en 180 días
    // (pedido explícito del médico, 11-08-2026). HbA1c se busca en el whitelist pero
    // NUNCA entra en esta regla (no todo paciente es diabético); PTH/Hemoglobina/
    // Fósforo/Albúmina tampoco: esos solo autocompletan si Athenea los trae.
    // =====================================================================
    const LABS_RCV_AL_DIA = [
      { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-06-01" },
      { codigo: "903815", nombre: "COLESTEROL HDL", Resultado: "45", Fecha: "2026-06-01" },
      { codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "150", Fecha: "2026-06-01" },
      { codigo: "903841", nombre: "GLUCOSA EN SUERO", Resultado: "90", Fecha: "2026-06-01" },
      { codigo: "907106", nombre: "UROANALISIS", Resultado: "NORMAL", Fecha: "2026-06-01" },
      { codigo: "903895", nombre: "CREATININA", Resultado: "0.9", Fecha: "2026-06-01" },
      { codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "10", Fecha: "2026-06-01" },
      // v14.1.4 — LDL entra a la vigilancia por decisión del médico (14-ago-2026).
      { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "100", Fecha: "2026-06-01" },
    ];

    t.caso("_analitosRcvVencidos: los 8 analitos con resultado reciente -> ningún faltante", () => {
      // 2026-08-11 - 2026-06-01 = 71 días, bien dentro de la vigencia de 180.
      t.igual(testApi._analitosRcvVencidos(LABS_RCV_AL_DIA, "2026-08-11"), []);
    });

    t.caso("_analitosRcvVencidos: un analito completamente ausente de Athenea aparece como faltante", () => {
      const sinCreatinina = LABS_RCV_AL_DIA.filter((l) => l.nombre !== "CREATININA");
      const faltantes = testApi._analitosRcvVencidos(sinCreatinina, "2026-08-11");
      t.igual(faltantes.length, 1);
      t.igual(faltantes[0].key, "CREATININA");
      t.igual(faltantes[0].nombre, "Creatinina en Suero");
      t.igual(faltantes[0].resultDate, undefined, "sin resultado -> sin fecha que mostrar");
    });

    t.caso("_analitosRcvVencidos: exactamente 180 días -> TODAVÍA vigente (el límite no cuenta como vencido)", () => {
      const labs = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-02-12" }];
      // 2026-08-11 - 2026-02-12 = 180 días exactos.
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      t.falso(faltantes.some((f) => f.key === "COLESTEROL_TOTAL"), "180 días exactos sigue dentro de la vigencia");
    });

    t.caso("_analitosRcvVencidos: 181 días -> VENCIDO", () => {
      const labs = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-02-11" }];
      // 2026-08-11 - 2026-02-11 = 181 días.
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      const f = faltantes.find((x) => x.key === "COLESTEROL_TOTAL");
      t.cierto(!!f, "181 días ya superó la vigencia de 180");
      t.igual(f.dias, 181);
      t.igual(f.resultDate, "2026-02-11");
    });

    t.caso("_analitosRcvVencidos: mezcla real de faltantes — uno VENCIDO (con resultDate/dias) junto a otros NUNCA REALIZADOS (sin esos campos) en la misma llamada (v12.5.7 — hallazgo de la revisión adversarial)", () => {
      // Un solo analito presente (y vencido) entre los 8 de la regla produce, en la misma
      // llamada, 1 faltante "vencido" + 7 faltantes "nunca realizados" — la mezcla real que
      // ninguna prueba anterior verificaba de punta a punta (longitud total Y forma de cada
      // tipo de faltante).
      const labs = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-02-11" }];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      t.igual(faltantes.length, 8, "los 8 analitos de la regla: 1 vencido + 7 nunca realizados");
      const vencido = faltantes.find((f) => f.key === "COLESTEROL_TOTAL");
      t.cierto(!!vencido);
      t.igual(vencido.resultDate, "2026-02-11");
      t.igual(vencido.dias, 181);
      const nuncaRealizados = faltantes.filter((f) => f.key !== "COLESTEROL_TOTAL");
      t.igual(nuncaRealizados.length, 7);
      t.igual(nuncaRealizados.map((f) => f.key).sort(), ["COLESTEROL_HDL", "COLESTEROL_LDL", "CREATININA", "GLUCOSA", "RAC", "TRIGLICERIDOS", "UROANALISIS"], "las 7 claves restantes de RCV_VIGENCIA_KEYS, sin duplicados ni omisiones");
      for (const f of nuncaRealizados) {
        t.igual(f.resultDate, undefined, f.key + ": nunca realizado no debe traer resultDate");
        t.igual(f.dias, undefined, f.key + ": nunca realizado no debe traer dias");
      }
    });

    t.caso("_analitosRcvVencidos: entre dos resultados del mismo analito, se juzga la vigencia contra el MÁS RECIENTE", () => {
      // Uno viejo (hace 2 años, vencido) y uno reciente (hace 10 días, vigente) del mismo
      // analito: debe ganar el reciente y NO aparecer como faltante.
      const labs = [
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "220", Fecha: "2024-01-01" },
        { codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-08-01" },
      ];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      t.falso(faltantes.some((f) => f.key === "COLESTEROL_TOTAL"), "el resultado reciente del mismo analito cubre la vigencia");
    });

    t.caso("_analitosRcvVencidos: HbA1c NUNCA entra en la regla, ni ausente ni vencido", () => {
      // Ni un solo resultado de HBA1C en toda la lista: si estuviera en la regla,
      // aparecería como faltante. No debe aparecer jamás.
      const faltantes = testApi._analitosRcvVencidos(LABS_RCV_AL_DIA, "2026-08-11");
      t.falso(faltantes.some((f) => f.key === "HBA1C"), "HbA1c está excluido de esta regla por pedido explícito del médico");
    });

    t.caso("_analitosRcvVencidos: PTH, Hemoglobina, Fósforo y Albúmina nunca generan aviso (solo autocompletan)", () => {
      // Ninguno de los 4 está en LABS_RCV_AL_DIA: si entraran en la regla de vigencia,
      // los 4 aparecerían como faltantes. Deben quedar completamente fuera.
      const faltantes = testApi._analitosRcvVencidos(LABS_RCV_AL_DIA, "2026-08-11");
      for (const key of ["PTH", "HEMOGLOBINA", "FOSFORO", "ALBUMINA"]) {
        t.falso(faltantes.some((f) => f.key === key), key + " no debe entrar nunca en el aviso de vigencia RCV");
      }
    });

    // =====================================================================
    // v18.0.120 — REPORTE EN VIVO DEL MÉDICO (02-sep): «me aparece ese mensaje de un
    // analito que todavía está vigente, está fuera de metas... el script no debe dar por
    // hecho que está vencido un examen que aún no cumple sus días de vigencia y que tiene
    // un resultado fuera de metas».
    //
    // Reproducido: LDL de 160 mg/dL (meta < 100 en riesgo alto) tomado hace 100 días, con
    // 180 de vigencia normativa. La regla del 50 % partía el plazo a 90, y el aviso de
    // entrada lo listaba bajo «Laboratorios RCV sin resultado vigente» — afirmando que
    // había vencido un examen al que le quedaban 80 días. VENCIDO y FUERA DE METAS son dos
    // hechos distintos: el primero es una fecha, el segundo un resultado.
    // =====================================================================
    const _OPTS_LDL_FUERA = {
      programa: "DM2", esDM2: true, esDm2: true, categoriaRiesgo: "alto", edad: 62,
      egfrCkdEpi: 88,   // TFG normal: la guarda KDIGO de D11 no interviene aquí
      aplicar50: true,
    };
    const _LABS_LDL_FUERA = [
      { codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "160", Fecha: "2026-05-03" },  // 100 días
    ];

    t.caso("v18.0.120 (reporte en vivo): un LDL fuera de metas y DENTRO de su vigencia NO se marca como vencido", () => {
      const f = testApi._analitosRcvVencidos(_LABS_LDL_FUERA, "2026-08-11", _OPTS_LDL_FUERA);
      const ldl = f.find((x) => x.key === "COLESTEROL_LDL");
      t.cierto(!!ldl, "sigue apareciendo: el médico tiene que poder verlo y decidir");
      t.igual(ldl.vencido, false, "pero NO está vencido — es lo que el médico reportó en vivo");
      t.igual(ldl.vigenciaNormaDias, 180, "su vigencia normativa son 180 días");
      t.igual(ldl.vigenciaDias, 90, "el adelanto del 50 % existe y se ve, pero no es un vencimiento");
      t.igual(ldl.dias, 100, "lleva 100 días");
      t.igual(ldl.diasRestantes, 80, "le quedan 80 días de vigencia: decir «vencido» era falso");
      t.igual(ldl.vence, "2026-10-30", "y se puede decir hasta cuándo sigue sirviendo");
    });

    t.caso("v18.0.120: un LDL que SÍ pasó su vigencia normativa sigue marcándose vencido", () => {
      // 2026-08-11 - 2026-01-01 = 222 días, por encima de los 180. La corrección no puede
      // convertirse en una excusa para dejar de avisar lo que de verdad venció.
      const labs = [{ codigo: "903817", nombre: "COLESTEROL LDL", Resultado: "160", Fecha: "2026-01-01" }];
      const ldl = testApi._analitosRcvVencidos(labs, "2026-08-11", _OPTS_LDL_FUERA).find((x) => x.key === "COLESTEROL_LDL");
      t.cierto(!!ldl, "un LDL de 222 días sigue en la lista");
      t.igual(ldl.vencido, true, "y este sí está vencido de verdad");
      t.igual(ldl.diasRestantes, null, "un vencido no tiene días restantes que ofrecer");
    });

    t.caso("v18.0.120: un analito que nunca se tomó cuenta como vencido (no hay vigencia que cumplir)", () => {
      const f = testApi._analitosRcvVencidos([], "2026-08-11", _OPTS_LDL_FUERA);
      t.cierto(f.length > 0, "sin ningún resultado, faltan todos");
      t.cierto(f.every((x) => x.vencido === true), "ninguno puede presumir vigencia: no hay fecha con que defenderse");
    });

    t.caso("v18.0.120: _vigenciaNormaDiasParaAnalito es la vigencia de la tabla, SIN el adelanto del 50 %", () => {
      t.igual(testApi._vigenciaDiasParaAnalito("COLESTEROL_LDL", "160", _OPTS_LDL_FUERA), 90, "con el adelanto: la mitad");
      t.igual(testApi._vigenciaNormaDiasParaAnalito("COLESTEROL_LDL", "160", _OPTS_LDL_FUERA), 180, "sin él: la de la tabla");
      // Y no es una tabla nueva: apagar `aplicar50` a mano da exactamente lo mismo (D4 —
      // una sola tabla de vigencias en todo el producto).
      t.igual(testApi._vigenciaNormaDiasParaAnalito("COLESTEROL_LDL", "160", _OPTS_LDL_FUERA),
        testApi._vigenciaDiasParaAnalito("COLESTEROL_LDL", "160", Object.assign({}, _OPTS_LDL_FUERA, { aplicar50: false })));
      // El recorte del RAC≥30 NO es «fuera de metas»: es la vigencia que la norma le da a
      // un paciente con albuminuria franca, y por eso SÍ vive en la vigencia normativa.
      t.igual(testApi._vigenciaNormaDiasParaAnalito("RAC", "350", { programa: "DM2", aplicar50: true }), 90,
        "la albuminuria franca sigue acortando la vigencia NORMATIVA, no es un adelanto opcional");
    });

    t.caso("v18.0.120: la respuesta del médico («no, en su vigencia normal») manda también en este camino", () => {
      // v18.0.67: «si la respuesta es no se repiten en su vigencia normal sin adelantar».
      // El motor del panel ya lo obedecía; el aviso de entrada seguía adelantando por su
      // cuenta y le contradecía sobre el mismo paciente.
      const conNo = Object.assign({}, _OPTS_LDL_FUERA, { repetirFueraMeta: false });
      t.igual(testApi._vigenciaDiasParaAnalito("COLESTEROL_LDL", "160", conNo), 180,
        "dijo que no: la vigencia se respeta entera");
      const f = testApi._analitosRcvVencidos(_LABS_LDL_FUERA, "2026-08-11", conNo);
      t.falso(f.some((x) => x.key === "COLESTEROL_LDL"),
        "y entonces ni siquiera aparece: no hay nada que sugerirle sobre algo que ya respondió");
      // Un «sí» explícito, y el silencio (todavía no ha contestado), siguen adelantando:
      // el script nunca relaja una vigencia por su cuenta.
      t.igual(testApi._vigenciaDiasParaAnalito("COLESTEROL_LDL", "160", Object.assign({}, _OPTS_LDL_FUERA, { repetirFueraMeta: true })), 90);
      t.igual(testApi._vigenciaDiasParaAnalito("COLESTEROL_LDL", "160", _OPTS_LDL_FUERA), 90,
        "sin respuesta suya se mantiene la conducta conservadora de siempre");
    });

    // =====================================================================
    // v12.6.0 (portado desde la versión desplegada) — RAC con albuminuria franca
    // (≥30 mg/g) exige control más frecuente: su vigencia se reduce a la mitad, 90 días
    // en vez de 180. Los demás analitos, y un RAC por debajo del umbral, no cambian.
    // =====================================================================
    t.caso("_vigenciaDiasParaAnalito: RAC bajo (<30 mg/g) conserva los 180 días normales", () => {
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "10"), 180);
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "29.9"), 180);
    });

    t.caso("_vigenciaDiasParaAnalito: RAC con albuminuria franca (>=30 mg/g) se reduce a 90 días", () => {
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "30"), 90, "el umbral mismo (30) ya cuenta como franca");
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "45,5"), 90, "también reconoce coma decimal (formato de Athenea)");
    });

    // [auditoría 25-ago, hallazgo 1.7] con contexto clínico (opts.programa/estadio, el
    // caso normal del aviso de entrada y del antiduplicado de "Ordenar"), `base` siempre
    // sale no-null desde vigenciaPorEstadio — el recorte de RAC≥30 vivía DESPUÉS del
    // "if (base != null) return base;" y nunca se alcanzaba: un RAC 350 en DM2/HTA salía
    // "vigente" 180 días en vez de 90. El recorte debe ser un TOPE sobre la base
    // (Math.min), no una rama alternativa a ella — mismo criterio que ya usa la vía
    // correcta (mtrVigenciaDiasNorma).
    t.caso("_vigenciaDiasParaAnalito: el recorte de RAC≥30 se aplica IGUAL con contexto de programa/estadio (antes solo sin contexto)", () => {
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "350", { programa: "HTA" }), 90,
        "con contexto DM2/HTA, un RAC franco (350) debe acortar a 90 días, no quedarse en los 180 de la tabla");
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "350", { programa: "DM2" }), 90);
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "10", { programa: "HTA" }), 180,
        "con contexto pero SIN albuminuria franca, la base normal (180) no cambia");
      // ERC G4: la base por estadio ya es 120 (más corta que 180) — el recorte de RAC no
      // debe ALARGARLA a 90 si 90 fuera mayor que la base; en este caso 90 < 120, así que
      // sigue ganando el menor de los dos (90), nunca por encima de la base.
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "350", { programa: "ERC", estadio: "G4" }), 90);
    });

    t.caso("_vigenciaDiasParaAnalito: analitos distintos de RAC, y un valor no numérico, conservan 180 días", () => {
      t.igual(testApi._vigenciaDiasParaAnalito("COLESTEROL_TOTAL", "999"), 180, "el umbral es exclusivo de RAC");
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "no-numerico"), 180, "sin poder leer el valor, nunca se acorta por prudencia");
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", null), 180);
    });

    // v12.10.15 — Bug real de auditoría nocturna: los LIS suelen reportar valores fuera
    // de rango con desigualdad ("> 300"). Number("> 300") da NaN, así que antes de
    // sanitizar, precisamente la albuminuria más franca perdía el acortamiento a 90 días.
    t.caso("_vigenciaDiasParaAnalito: RAC reportado con desigualdad del LIS ('> 300', '>= 30') sigue reduciendo a 90 días", () => {
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "> 300"), 90, "bug real de auditoría: antes NaN caía en 180");
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", ">=30"), 90);
      t.igual(testApi._vigenciaDiasParaAnalito("RAC", "  30  "), 90, "espacios alrededor tampoco deben romper el parseo");
    });

    t.caso("_analitosRcvVencidos: RAC con albuminuria franca (>=30 mg/g) vence a los 90 días, no a los 180", () => {
      // 2026-08-11 - 2026-05-07 = 96 días: vigente a 180, pero ya vencido a 90 (reducida).
      const labs = [{ codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "35", Fecha: "2026-05-07" }];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      const f = faltantes.find((x) => x.key === "RAC");
      t.cierto(!!f, "con RAC>=30, 96 días ya superó la vigencia reducida de 90");
      t.igual(f.dias, 96);
    });

    t.caso("_analitosRcvVencidos: el mismo RAC (96 días) con valor normal (<30 mg/g) SIGUE vigente (180 días)", () => {
      const labs = [{ codigo: "8779", nombre: "RELACION ALBUMINA/CREATININA", Resultado: "12", Fecha: "2026-05-07" }];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      t.falso(faltantes.some((f) => f.key === "RAC"), "sin albuminuria franca, 96 días sigue dentro de los 180 normales");
    });

    t.caso("_analitosRcvVencidos: 'hoy' inválido o ausente -> [] en vez de reventar (nunca adivina una fecha de referencia)", () => {
      t.igual(testApi._analitosRcvVencidos(LABS_RCV_AL_DIA, "fecha-invalida"), []);
      t.igual(testApi._analitosRcvVencidos(LABS_RCV_AL_DIA, ""), []);
      t.igual(testApi._analitosRcvVencidos(LABS_RCV_AL_DIA, null), []);
      t.noLanza(() => testApi._analitosRcvVencidos(null, "2026-08-11"));
    });

    t.caso("_analitosRcvVencidos: varios analitos ausentes a la vez, todos reportados", () => {
      const soloColesterol = [{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "180", Fecha: "2026-08-01" }];
      const faltantes = testApi._analitosRcvVencidos(soloColesterol, "2026-08-11");
      t.igual(faltantes.length, 7, "faltan los otros 7 de los 8 (Colesterol Total sí está al día)");
      t.falso(faltantes.some((f) => f.key === "COLESTEROL_TOTAL"));
    });

    // =====================================================================
    // v12.5.15 — Reportado en consultorio con el PDF real del laboratorio Y la captura de
    // Athenea: un uroanálisis SÍ realizado (con ~28 componentes reales: Color, Glucosa,
    // Nitritos, Sangre, Leucocitos, Hematíes...) aparecía SIEMPRE como "faltante" en el
    // aviso de vigencia RCV, porque Athenea nunca manda una fila llamada literalmente
    // "UROANALISIS" — solo las filas de sus componentes, cada una con
    // NombreParametroPadre="UROANALISIS". _matchLabInWhitelist exige el nombre del panel
    // completo, así que _analitosRcvVencidos jamás encontraba candidato para esa key.
    // =====================================================================
    const LABS_URO_POR_COMPONENTES = (fecha) => [
      { NombreParametro: "COLOR", NombreParametroPadre: "UROANALISIS", Resultado: "AMARILLO", Fecha: fecha },
      { NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: fecha },
      { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: fecha },
      { NombreParametro: "SANGRE", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: fecha },
      { NombreParametro: "LEUCOCITOS", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", Fecha: fecha },
      { NombreParametro: "HEMATIES", NombreParametroPadre: "UROANALISIS", Resultado: "30.70", Fecha: fecha },
      { NombreParametro: "CILINDROS", NombreParametroPadre: "UROANALISIS", Resultado: "0", Fecha: fecha },
    ];

    t.caso("_analitosRcvVencidos: un uroanálisis real, mandado por componentes (sin fila 'UROANALISIS'), SÍ cuenta como vigente", () => {
      const labs = [...LABS_RCV_AL_DIA.filter((l) => l.nombre !== "UROANALISIS"), ...LABS_URO_POR_COMPONENTES("2026-08-01")];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      t.falso(faltantes.some((f) => f.key === "UROANALISIS"), "con componentes reales y recientes, ya NO debe salir como faltante");
    });

    t.caso("_analitosRcvVencidos: uroanálisis por componentes VENCIDO (>180 días) sí se reporta, con su fecha real", () => {
      const labs = [...LABS_RCV_AL_DIA.filter((l) => l.nombre !== "UROANALISIS"), ...LABS_URO_POR_COMPONENTES("2025-10-01")];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      const uro = faltantes.find((f) => f.key === "UROANALISIS");
      t.cierto(!!uro, "más de 180 días desde el componente más reciente: sigue vencido, no queda invisible");
      t.igual(uro.resultDate, "2025-10-01");
    });

    t.caso("_analitosRcvVencidos: solo componentes PENDIENTES/vacíos -> el uroanálisis sigue faltando (sin evidencia real, no se inventa vigencia)", () => {
      const labs = [
        ...LABS_RCV_AL_DIA.filter((l) => l.nombre !== "UROANALISIS"),
        { NombreParametro: "NITRITOS", NombreParametroPadre: "UROANALISIS", Resultado: "PENDIENTE", idEstado: 1, Fecha: "2026-08-01" },
      ];
      const faltantes = testApi._analitosRcvVencidos(labs, "2026-08-11");
      t.cierto(faltantes.some((f) => f.key === "UROANALISIS"), "un componente PENDIENTE no es evidencia de un examen ya resuelto");
    });

    // [auditoría 25-ago, hallazgo 1.4] _matchUroComponente solo mira el NOMBRE del
    // analito, sin su padre/panel: "SANGRE OCULTA EN MATERIA FECAL" (SOMF, tamización de
    // colon) casa con el componente SANGRE, y "PROTEINA C REACTIVA" casa con PROTEINURIA.
    // Sin exigir _esAnalitoDeOrina primero, un SOMF/PCR reciente podía declarar el
    // uroanálisis "vigente" por su fecha — silenciando el aviso justo cuando el parcial de
    // orina real SÍ está vencido.
    t.caso("_analitosRcvVencidos: un SOMF (sangre oculta en heces) o una PCR NO cuentan como componente de uroanálisis", () => {
      const labsSomf = [
        ...LABS_RCV_AL_DIA.filter((l) => l.nombre !== "UROANALISIS"),
        { NombreParametro: "SANGRE OCULTA EN MATERIA FECAL", NombreParametroPadre: "COPROLOGICO", Resultado: "NEGATIVO", Fecha: "2026-08-01" },
      ];
      const faltantesSomf = testApi._analitosRcvVencidos(labsSomf, "2026-08-11");
      t.cierto(faltantesSomf.some((f) => f.key === "UROANALISIS"), "un SOMF no es evidencia de un uroanálisis: sigue faltando");

      const labsPcr = [
        ...LABS_RCV_AL_DIA.filter((l) => l.nombre !== "UROANALISIS"),
        { NombreParametro: "PROTEINA C REACTIVA", NombreParametroPadre: "QUIMICA SANGUINEA", Resultado: "3.2", Fecha: "2026-08-01" },
      ];
      const faltantesPcr = testApi._analitosRcvVencidos(labsPcr, "2026-08-11");
      t.cierto(faltantesPcr.some((f) => f.key === "UROANALISIS"), "una PCR no es evidencia de un uroanálisis: sigue faltando");
    });

    t.caso("injectLabsIntoCronicos: el respaldo por componentes de _analitosRcvVencidos NO se activa aquí — la casilla de resultado general sigue sin recibir el valor de un componente suelto", () => {
      // Guarda de regresión: _ultimaFechaPorAnalito es compartida por injectLabsIntoCronicos
      // y por _analitosRcvVencidos. El respaldo por componentes (v12.5.15) es SOLO para
      // vigencia — si se activara también aquí, el valor de un componente cualquiera (p.
      // ej. "NEGATIVO" de Sangre) se escribiría como si fuera el resultado GENERAL del
      // panel, algo que injectLabsIntoCronicos nunca debe hacer (ese resultado general
      // solo viene de una fila real "UROANALISIS"/"PARCIAL DE ORINA", ver v12.5.12).
      mockDOM = { resultadoUroanalisis: { value: "" }, fechaResultUroanalisis: { value: "" } };
      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = () => [];
      const res = testApi.injectLabsIntoCronicos(LABS_URO_POR_COMPONENTES("2026-08-01"));
      c.env.doc.querySelectorAll = prevQSA;
      t.igual(mockDOM.resultadoUroanalisis.value, "", "ningún componente suelto debe terminar en la casilla de resultado general");
      // Sin fallback activado aquí, "UROANALISIS" ni siquiera entra a candidatosPorClave
      // (no hay fila real del panel completo) — no cuenta como "casilla no encontrada"
      // (eso sería para un candidato real sin destino en el DOM), simplemente no hay
      // candidato que buscar casilla para él.
      t.falso(res.sinCasilla.includes("UROANALISIS"), "sin fila real del panel, UROANALISIS ni siquiera se considera candidato aquí");
    });

    t.caso("RAC Guardia: restaura la casilla cuando Everest la vacía y se apaga en edición real", () => {
      testApi._setRacGuardiaParaTest({ activa: false, docId: "", valor: "" });
      const prevQSA = c.env.doc.querySelectorAll;
      const prevQS = c.env.doc.querySelector;
      const prevGetById = c.env.doc.getElementById;

      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 123456", closest: () => null }] : []);

      c.env.doc.getElementById = (id) => {
        if (id === "anamesis") return { id: "anamesis", tagName: "DIV" };
        if (id === "resultadoRelacionAlbuminaCreatinina") return mockDOM.resultadoRelacionAlbuminaCreatinina;
        return prevGetById(id);
      };

      c.ctx.uxTrack = () => {};

      mockDOM = {
        resultadoRelacionAlbuminaCreatinina: {
          id: "resultadoRelacionAlbuminaCreatinina", tagName: "INPUT",
          dispatchEvent: () => {}, _val: "",
          set value(v) { this._val = v; }, get value() { return this._val; }
        }
      };

      const labRac = { codigo: "8779", nombre: "RELACION MICROALBUMINURIA CREATININA", Resultado: "35.5" };
      testApi.injectLabsIntoCronicos([labRac], "123456");

      t.igual(mockDOM.resultadoRelacionAlbuminaCreatinina.value, "35.5", "el robot escribió la RAC");
      let guardia = testApi._getRacGuardiaParaTest();
      t.cierto(guardia.activa, "la guardia se activó");
      t.igual(guardia.docId, "123456", "guardó el paciente");
      t.igual(guardia.valor, "35.5", "guardó el valor");

      // Simular borrado de Everest
      mockDOM.resultadoRelacionAlbuminaCreatinina.value = "";
      testApi.checkRacGuardia();
      t.igual(mockDOM.resultadoRelacionAlbuminaCreatinina.value, "35.5", "el tick restauró el valor tras ser vaciado");
      t.cierto(testApi._getRacGuardiaParaTest().activa, "la guardia sigue activa tras restaurar");

      // Simular edición real del médico a un valor distinto
      mockDOM.resultadoRelacionAlbuminaCreatinina.value = "40.0";
      testApi.checkRacGuardia();
      t.igual(mockDOM.resultadoRelacionAlbuminaCreatinina.value, "40.0", "el tick respeta el valor editado a mano");
      t.falso(testApi._getRacGuardiaParaTest().activa, "la guardia se apagó para siempre por edición real");

      // Simular nuevo borrado (ahora que está apagada)
      mockDOM.resultadoRelacionAlbuminaCreatinina.value = "";
      testApi.checkRacGuardia();
      t.igual(mockDOM.resultadoRelacionAlbuminaCreatinina.value, "", "ya no restaura, la guardia murió");

      // Simular cambio de paciente
      testApi._setRacGuardiaParaTest({ activa: true, docId: "PAC_999", valor: "50" });
      mockDOM.resultadoRelacionAlbuminaCreatinina.value = "50";
      testApi.checkRacGuardia(); // el docId devuelto será 123456 (extractPacienteAbierto mock via DOM)
      t.falso(testApi._getRacGuardiaParaTest().activa, "la guardia se apaga si cambia el paciente");

      delete c.ctx.uxTrack;
      c.env.doc.querySelectorAll = prevQSA;
      c.env.doc.querySelector = prevQS;
      c.env.doc.getElementById = prevGetById;
    });

    // =====================================================================
    // v14.1.5 — CRUCE DE PACIENTES. El peor caso clínico del script: entre pedir los
    // laboratorios y escribirlos pasan 2-4 s de red, y en ese lapso el médico puede
    // haber abierto OTRA historia. Las casillas se buscan por id global, así que sin
    // esta guarda los resultados del paciente A caen en la historia del paciente B.
    // =====================================================================
    const montarDomDePaciente = (cedulaEnPantalla) => {
      const prev = {
        qsa: c.env.doc.querySelectorAll,
        qs: c.env.doc.querySelector,
        byId: c.env.doc.getElementById,
      };
      c.env.doc.querySelector = () => null;
      c.env.doc.querySelectorAll = (sel) =>
        (sel === ".text-muted" && cedulaEnPantalla ? [{ textContent: "CC " + cedulaEnPantalla, closest: () => null }] : []);
      c.env.doc.getElementById = (id) => {
        if (id === "anamesis") return { id: "anamesis", tagName: "DIV" };
        if (mockDOM[id]) return mockDOM[id];
        return null;
      };
      return () => {
        c.env.doc.querySelectorAll = prev.qsa;
        c.env.doc.querySelector = prev.qs;
        c.env.doc.getElementById = prev.byId;
      };
    };
    const casillaFalsa = (id) => ({
      id, tagName: "INPUT", dispatchEvent: () => {}, _val: "",
      set value(v) { this._val = v; }, get value() { return this._val; },
    });

    t.caso("Cruce de pacientes: si la historia abierta cambió durante la espera de red, NO se escribe una sola casilla", () => {
      testApi._setRacGuardiaParaTest({ activa: false, docId: "", valor: "" });
      mockDOM = { resultadoCreatinina: casillaFalsa("resultadoCreatinina") };
      // Se pidieron los labs con el paciente 111111 abierto; ahora en pantalla hay otro.
      const restaurar = montarDomDePaciente("222222");
      const labs = [{ codigo: "903895", nombre: "CREATININA EN SUERO", Resultado: "4.5" }];

      const r = testApi.injectLabsIntoCronicos(labs, "111111");

      t.cierto(r.abortadoPorPaciente, "el resultado avisa que se abortó por cambio de paciente");
      t.igual(r.count, 0, "no se diligenció ninguna casilla");
      t.igual(mockDOM.resultadoCreatinina.value, "", "la creatinina de 4.5 del paciente A NO cayó en la historia del paciente B");
      restaurar();
    });

    t.caso("Cruce de pacientes: con el MISMO paciente todavía abierto, la inyección procede con normalidad", () => {
      testApi._setRacGuardiaParaTest({ activa: false, docId: "", valor: "" });
      mockDOM = { resultadoCreatinina: casillaFalsa("resultadoCreatinina") };
      const restaurar = montarDomDePaciente("111111");
      const labs = [{ codigo: "903895", nombre: "CREATININA EN SUERO", Resultado: "4.5" }];

      const r = testApi.injectLabsIntoCronicos(labs, "111111");

      t.falso(!!r.abortadoPorPaciente, "no se aborta cuando es el mismo paciente");
      t.igual(mockDOM.resultadoCreatinina.value, "4.5", "la creatinina se escribió en la historia correcta");
      restaurar();
    });

    t.caso("Cruce de pacientes: si la cédula NO se puede leer del DOM, se aborta (falla cerrada, no se escribe a ciegas)", () => {
      testApi._setRacGuardiaParaTest({ activa: false, docId: "", valor: "" });
      mockDOM = { resultadoCreatinina: casillaFalsa("resultadoCreatinina") };
      // Angular re-renderizando la cabecera: no hay .text-muted legible.
      const restaurar = montarDomDePaciente("");
      const labs = [{ codigo: "903895", nombre: "CREATININA EN SUERO", Resultado: "4.5" }];

      const r = testApi.injectLabsIntoCronicos(labs, "111111");

      t.cierto(r.abortadoPorPaciente, "sin cédula legible NO se asume que sigue siendo el mismo paciente");
      t.igual(mockDOM.resultadoCreatinina.value, "", "no se escribió nada");
      restaurar();
    });

    t.caso("_pacienteSigueAbierto: sin docId esperado deja pasar (los tests montan DOM sin cabecera); con uno, exige coincidencia exacta", () => {
      const restaurar = montarDomDePaciente("111111");
      t.cierto(testApi._pacienteSigueAbierto(""), "cadena vacía = nadie preguntó, deja pasar");
      t.cierto(testApi._pacienteSigueAbierto(undefined), "sin argumento deja pasar");
      t.cierto(testApi._pacienteSigueAbierto("111111"), "coincide");
      t.falso(testApi._pacienteSigueAbierto("111112"), "una cédula parecida NO coincide");
      restaurar();
    });

    // =====================================================================
    // v14.1.5 — LA GUARDA DE LA RAC SE RINDE. Antes reescribía indefinidamente lo que
    // el médico borraba a propósito. Ahora tiene ventana de 20 s y cupo de 2.
    // =====================================================================
    t.caso("RAC Guardia: al TERCER vaciado cede y deja la casilla como el médico la dejó", () => {
      mockDOM = { resultadoRelacionAlbuminaCreatinina: casillaFalsa("resultadoRelacionAlbuminaCreatinina") };
      const restaurar = montarDomDePaciente("123456");
      c.ctx.uxTrack = () => {};
      const casilla = mockDOM.resultadoRelacionAlbuminaCreatinina;

      testApi.injectLabsIntoCronicos([{ codigo: "8779", nombre: "RELACION MICROALBUMINURIA CREATININA", Resultado: "35.5" }], "123456");
      t.igual(casilla.value, "35.5", "el robot escribió la RAC");

      casilla.value = ""; testApi.checkRacGuardia();
      t.igual(casilla.value, "35.5", "1er vaciado: restaura (esto sí parece el re-render de Everest)");
      casilla.value = ""; testApi.checkRacGuardia();
      t.igual(casilla.value, "35.5", "2do vaciado: restaura, último del cupo");
      casilla.value = ""; testApi.checkRacGuardia();
      t.igual(casilla.value, "", "3er vaciado: CEDE — quien borra tres veces es una persona, no un re-render");
      t.falso(testApi._getRacGuardiaParaTest().activa, "la guardia se apaga para siempre en este paciente");

      // Y una vez apagada, no revive.
      casilla.value = ""; testApi.checkRacGuardia();
      t.igual(casilla.value, "", "sigue sin tocarla");
      delete c.ctx.uxTrack;
      restaurar();
    });

    t.caso("RAC Guardia: pasada la ventana de 20 s ya no restaura, aunque le quede cupo", () => {
      mockDOM = { resultadoRelacionAlbuminaCreatinina: casillaFalsa("resultadoRelacionAlbuminaCreatinina") };
      const restaurar = montarDomDePaciente("123456");
      c.ctx.uxTrack = () => {};
      const casilla = mockDOM.resultadoRelacionAlbuminaCreatinina;
      casilla.value = "35.5";
      // Guardia armada hace 21 s, con el cupo intacto: solo el reloj la desactiva.
      testApi._setRacGuardiaParaTest({ activa: true, docId: "123456", valor: "35.5", ts: Date.now() - 21000, restauraciones: 0 });

      casilla.value = "";
      testApi.checkRacGuardia();

      t.igual(casilla.value, "", "el borrado del médico un minuto después se respeta");
      t.falso(testApi._getRacGuardiaParaTest().activa, "la guardia caducó");
      delete c.ctx.uxTrack;
      restaurar();
    });

    // =====================================================================
    // _canonNombreLab: Normalización de nombres de analitos
    // =====================================================================
    t.caso("_canonNombreLab: normaliza null y undefined a cadena vacía sin fallar", () => {
      t.igual(testApi._canonNombreLab(null), "");
      t.igual(testApi._canonNombreLab(undefined), "");
      t.igual(testApi._canonNombreLab(""), "");
    });

    t.caso("_canonNombreLab: elimina tildes y convierte a mayúsculas", () => {
      t.igual(testApi._canonNombreLab("Glucosa"), "GLUCOSA");
      t.igual(testApi._canonNombreLab("RELACIÓN"), "RELACION");
      t.igual(testApi._canonNombreLab("ácido úrico"), "ACIDO URICO");
      t.igual(testApi._canonNombreLab("PROTEÍNAS"), "PROTEINAS");
    });

    t.caso("_canonNombreLab: convierte separadores especiales a espacios simples", () => {
      // Test the regex /[\/\-_,.;:()]+/g
      t.igual(testApi._canonNombreLab("RELACION MICROALBUMINURIA/CREATININA"), "RELACION MICROALBUMINURIA CREATININA");
      t.igual(testApi._canonNombreLab("MICROALBUMINURIA-CREATININA"), "MICROALBUMINURIA CREATININA");
      t.igual(testApi._canonNombreLab("A_B,C.D;E:F(G)"), "A B C D E F G");
    });

    t.caso("_canonNombreLab: recorta espacios múltiples y laterales", () => {
      t.igual(testApi._canonNombreLab("  DOBLE  ESPACIO  "), "DOBLE ESPACIO");
      t.igual(testApi._canonNombreLab("RELACION   MICROALBUMINURIA/ CREATININA  "), "RELACION MICROALBUMINURIA CREATININA");
    });

    // =====================================================================
    // _findHbA1cFields: Búsqueda específica del input de HbA1c (Evitando colisiones)
    // =====================================================================
    t.caso("_findHbA1cFields: encuentra el input correcto por type=number y max=30 y asocia la fecha hermana", () => {
      // Simular DOM con los dos inputs que colisionan y sus fechas
      const fakeHemoNormal = { tagName: "INPUT", id: "resultadoHemoglobina", name: "resultadoHemoglobina", type: "text", getAttribute: (k) => null, closest: () => null };

      const fakeHbA1cDate = { tagName: "INPUT", type: "date" };
      const fakeHbA1cGroup = { querySelector: (sel) => (sel === 'input[type="date"]' ? fakeHbA1cDate : null) };
      const fakeHbA1c = {
        tagName: "INPUT", id: "resultadoHemoglobina", name: "resultadoHemoglobina", type: "number",
        getAttribute: (k) => (k === "max" ? "30" : null),
        closest: (sel) => (sel === ".input-group" ? fakeHbA1cGroup : null)
      };

      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[name="resultadoHemoglobina"], input#resultadoHemoglobina') {
          return [fakeHemoNormal, fakeHbA1c];
        }
        return [];
      };

      const campos = testApi._findHbA1cFields();

      c.env.doc.querySelectorAll = prevQSA;

      t.igual(campos.resultEl, fakeHbA1c, "debe encontrar el segundo input que tiene type=number y max=30");
      t.igual(campos.dateEl, fakeHbA1cDate, "debe encontrar el input de fecha hermano dentro del .input-group");
    });

    t.caso("_findHbA1cFields: retorna nulls si ningún input cumple las condiciones de HbA1c", () => {
      const fakeHemoNormal = { tagName: "INPUT", id: "resultadoHemoglobina", name: "resultadoHemoglobina", type: "text", getAttribute: (k) => null, closest: () => null };

      const prevQSA = c.env.doc.querySelectorAll;
      c.env.doc.querySelectorAll = (sel) => {
        if (sel === 'input[name="resultadoHemoglobina"], input#resultadoHemoglobina') {
          return [fakeHemoNormal];
        }
        return [];
      };

      const campos = testApi._findHbA1cFields();

      c.env.doc.querySelectorAll = prevQSA;

      t.igual(campos.resultEl, null, "debe ser null si ninguno tiene type=number y max=30");
      t.igual(campos.dateEl, null);
    });

    t.caso("el aviso 'no se reconoció ninguna fecha' sale UNA sola vez por sesión", () => {
      const EventShim = class Event { constructor(tipo, init) { this.type = tipo; this.bubbles = !!(init && init.bubbles); } };
      const PREFIJO = "[Vigilante] diagnóstico: no se reconoció ninguna fecha";

      const c1 = cargar({ silencioso: true });
      c1.ctx.Event = EventShim;
      const warns1 = [];
      c1.ctx.console = { log: () => {}, warn: (...a) => warns1.push(a.map(String).join(" ")), error: () => {}, info: () => {}, debug: () => {} };
      const dom1 = { resultadoColesterolTotal: { value: "" }, resultadoTrigliceridos: { value: "" } };
      c1.env.doc.getElementById = (id) => (dom1[id] ? Object.assign(dom1[id], { id, tagName: "INPUT", dispatchEvent: () => {} }) : null);
      c1.env.doc.querySelectorAll = () => [];

      c1.api.injectLabsIntoCronicos([{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "10" }]);
      c1.api.injectLabsIntoCronicos([{ codigo: "903868", nombre: "TRIGLICERIDOS", Resultado: "10" }]);

      t.igual(warns1.filter((w) => w.indexOf(PREFIJO) === 0).length, 1, "dos laboratorios sin fecha en la misma sesión solo producen UN aviso en consola");

      const c2 = cargar({ silencioso: true });
      c2.ctx.Event = EventShim;
      const warns2 = [];
      c2.ctx.console = { log: () => {}, warn: (...a) => warns2.push(a.map(String).join(" ")), error: () => {}, info: () => {}, debug: () => {} };
      const dom2 = { resultadoColesterolTotal: { value: "" }, resultadoTrigliceridos: { value: "" } };
      c2.env.doc.getElementById = (id) => (dom2[id] ? Object.assign(dom2[id], { id, tagName: "INPUT", dispatchEvent: () => {} }) : null);
      c2.env.doc.querySelectorAll = () => [];

      c2.api.injectLabsIntoCronicos([{ codigo: "903818", nombre: "COLESTEROL TOTAL", Resultado: "10", Fecha: "2026-08-01" }]);

      t.igual(warns2.filter((w) => w.indexOf(PREFIJO) === 0).length, 0, "laboratorios con fecha NO producen el aviso de fecha no reconocida");
    });

    // v14.0.2 — CUPS de ESCRITURA (ordenamiento) para HbA1c/PTH/Fósforo/Albúmina/Hemoglobina,
    // confirmados vía el diagnóstico cruzado Copiloto↔Vigilante (MATRIZ_DIVERGENCIAS.md del
    // Copiloto, que a su vez toma el catálogo NAME_TO_CUPS/CUPS_EMBEBIDOS ya en producción
    // en ese repo). Distintos de los códigos de LECTURA de WHITELIST_13_LABS de arriba —
    // esta prueba solo fija los valores confirmados; no implica que ya se estén ordenando
    // (siguen sin consumidor, a la espera de P6/estadio renal, ver el comentario en el
    // propio script). v14.0.4 — CORREGIDO: HbA1c NO es el 904426 del Copiloto (su variante
    // corta "HEMOGLOBINA GLICOSILADA", sin más) — es 903426, el código YA vigente en
    // PYM_CATALOG/I10X, tomado de una orden REAL ya guardada en Everest
    // (EVIDENCIA_ORDENAMIENTO_CURADO.md §2), evidencia más fuerte que la del otro repo.
    t.caso("CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO: los 5 códigos de escritura confirmados, distintos de los de lectura", () => {
      const w = c.api.__CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO;
      t.igual(w.HBA1C, "903426", "la orden REAL ya guardada en Everest manda sobre el catálogo corto del Copiloto");
      t.igual(w.PTH, "903890");
      t.igual(w.FOSFORO, "903885");
      t.igual(w.ALBUMINA, "903803");
      t.igual(w.HEMOGLOBINA, "902213");
      // Confirma que de verdad son de escritura, no una copia accidental de los de lectura
      // de WHITELIST_13_LABS (que usan otros números para PTH/Fósforo/Albúmina).
      const porClave = Object.fromEntries(c.api.__WHITELIST.map((x) => [x.key, x.codes]));
      t.cierto(!porClave.PTH.includes(w.PTH), "PTH: escritura (903890) distinta de lectura (904921)");
      t.cierto(!porClave.FOSFORO.includes(w.FOSFORO), "Fósforo: escritura (903885) distinta de lectura (903837)");
      t.cierto(!porClave.ALBUMINA.includes(w.ALBUMINA), "Albúmina: escritura (903803) distinta de lectura (903801)");
    });

    // v14.0.4 — Guarda de consistencia contra el bug real que este cambio corrige: HbA1c
    // vive en DOS sitios de este archivo (aquí, sin conectar, y en PYM_CATALOG/I10X, YA
    // vigente en el paquete RCV exprés) — si algún día vuelven a divergir (alguien copia un
    // código de otra fuente sin cruzarlo contra el que YA está en producción), esta prueba
    // debe caer antes de que el médico vea dos códigos distintos para el mismo examen.
    t.caso("CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO.HBA1C coincide con el código YA vigente en PYM_CATALOG/I10X (RCV exprés)", () => {
      const i10x = c.api.__PYM_CATALOG.find((p) => p.cie10 === "I10X");
      const hba1cEnPaquete = i10x.cups.find((x) => x.desc.toUpperCase().includes("GLICOSILADA"));
      t.cierto(!!hba1cEnPaquete, "precondición: el paquete I10X trae HbA1c");
      t.igual(c.api.__CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO.HBA1C, hba1cEnPaquete.codigo, "mismo CUPS en los dos sitios donde HbA1c aparece");
    });

    // v17.6.27 — AUDITORÍA S+ (barrido total, 24-ago-2026): cuando la heurística de
    // patológico no marcaba nada, _resumenClinicoUro pintaba SIEMPRE los chips fijos
    // "Límpido · Leucocitos (-) · Nitritos (-)" — un dato inventado que no reflejaba el
    // informe real. Un aspecto "TURBIO" (que _esUroComponenteAlterado no reconoce: no está
    // en su lista de valores negativos ni positivos, y parseFloat da NaN) salía como
    // "Límpido" fabricado junto al badge "Sin hallazgos patológicos" — justo lo que la
    // regla de oro #1 del proyecto prohíbe (sin dato real = sin suposición).
    t.caso("v17.6.27: _resumenClinicoUro NUNCA inventa chips fijos — usa los valores reales del informe", () => {
      const componente = (nombre, resultado) => ({ nombre, resultado });
      // Caso A: aspecto realmente alterado ("Turbio") que la heurística de altered no
      // reconoce (esPatologico queda false) — el chip debe decir la verdad, no "Límpido".
      const turbio = c.api._resumenClinicoUro([
        componente("Aspecto", "Turbio"),
        componente("Color", "Amarillo"),
      ]);
      t.falso(turbio.esPatologico, "precondición: la heurística de 'alterado' no reconoce 'turbio'");
      t.falso(turbio.chips.includes("Límpido"), "jamás debe afirmar 'Límpido' cuando el informe dice 'Turbio'");
      t.cierto(turbio.chips.some((x) => x.includes("Turbio")), "el chip refleja el aspecto REAL del informe: " + turbio.chips.join(" | "));

      // Caso B: informe realmente limpio — los chips deben venir de los componentes reales
      // entregados, no de un literal que coincida por casualidad.
      const limpio = c.api._resumenClinicoUro([
        componente("Aspecto", "Límpido"),
        componente("Nitritos", "Negativo"),
      ]);
      t.falso(limpio.esPatologico);
      t.cierto(limpio.chips.some((x) => x.includes("Límpido")) && limpio.chips.some((x) => x.includes("Nitritos")), "los chips citan los componentes reales presentes: " + limpio.chips.join(" | "));

      // Caso C: sin patología y sin ninguno de los 4 componentes que se suelen resumir —
      // nunca debe fabricar un dato; texto neutro en su lugar.
      const sinDatos = c.api._resumenClinicoUro([componente("pH", "6.0")]);
      t.falso(sinDatos.esPatologico);
      t.falso(sinDatos.chips.includes("Límpido") || sinDatos.chips.includes("Nitritos (-)"), "sin aspecto/color/leucocitos/nitritos en el informe, no debe inventarlos");
      t.igual(sinDatos.chips[0], "Sin alteraciones reconocidas");
    });

    // v17.6.44 — AUDITORÍA S+ (barrido total, 24-ago-2026): _resolverLdlPorTrigliceridos
    // usaba Number() crudo, que da NaN con coma decimal ("436,2") o desigualdad ("> 400")
    // — justo los dos formatos que _labNumerico existe para sanear. Con NaN, la regla del
    // médico (TG>400 invalida Friedewald: usar el LDL directo, no el calculado) quedaba
    // invertida para cualquier informe de laboratorio con coma decimal.
    t.caso("v17.6.44: _resolverLdlPorTrigliceridos reconoce TG>400 aunque venga con coma decimal", () => {
      const misma = "2026-08-01";
      const directo = { resultVal: "95", resultDate: misma };
      const normal = { resultVal: "88", resultDate: misma };
      // Con Number() crudo, Number("436,2") es NaN -> tgMayor400 siempre false (bug).
      const tgComaAlto = { resultVal: "436,2" };
      t.igual(c.api._resolverLdlPorTrigliceridos(directo, normal, tgComaAlto), directo,
        "TG=436,2 (coma decimal) > 400: debe preferir el LDL DIRECTO, no el calculado");

      const tgComaBajo = { resultVal: "180,5" };
      t.igual(c.api._resolverLdlPorTrigliceridos(directo, normal, tgComaBajo), normal,
        "TG=180,5 (coma decimal), normal: debe preferir el LDL calculado (normal), regla de siempre");
    });

    t.caso("v17.6.44: _resolverLdlPorTrigliceridos reconoce TG fuera de rango con desigualdad ('> 400')", () => {
      const misma = "2026-08-01";
      const directo = { resultVal: "110", resultDate: misma };
      const normal = { resultVal: "102", resultDate: misma };
      const tgDesigualdad = { resultVal: "> 450" };
      t.igual(c.api._resolverLdlPorTrigliceridos(directo, normal, tgDesigualdad), directo,
        "TG '> 450' (desigualdad del LIS, claramente por encima de 400): debe preferir el LDL directo");
    });

    t.caso("_resolverLdlPorTrigliceridos: sin triglicéridos legibles, se queda con la regla general (normal)", () => {
      const misma = "2026-08-01";
      const directo = { resultVal: "95", resultDate: misma };
      const normal = { resultVal: "88", resultDate: misma };
      t.igual(c.api._resolverLdlPorTrigliceridos(directo, normal, null), normal, "sin dato de TG, no hay razón para preferir el directo");
      t.igual(c.api._resolverLdlPorTrigliceridos(directo, normal, { resultVal: "nota de laboratorio" }), normal, "TG ilegible (ni número ni desigualdad): tratado igual que sin dato");
    });

    // =================================================================
    //  v17.7.1 — REPORTE EN CONSULTA (27-ago): «el módulo de laboratorios no está
    //  reportando todos los analitos, falta la creatinina en esta paciente que fue tomada
    //  también ahora en agosto».
    //
    //  La tabla de Historial de Paraclínicos llevaba DOS contadores calculados y jamás
    //  enseñados: las solicitudes que Athenea no devolvió y las filas ocultas por tener
    //  más de un año. Callados los dos, una lectura A MEDIAS tenía exactamente el mismo
    //  aspecto que una completa — y un examen que sí se hizo se lee como que no.
    // =================================================================
    t.caso("v17.7.1 — una lectura incompleta de Athenea se dice, no se disimula", () => {
      const html = c.api.mtrAvisoTablaLabsHtml({ solicitudesNoLeidas: 2, viejasOcultas: 0 });
      t.cierto(html.indexOf("2 de las órdenes") >= 0, "dice cuántas órdenes faltaron, no un vago «puede que falte algo»");
      t.cierto(html.indexOf("puede estar hecho igual") >= 0,
        "y dice lo único que importa en consulta: que el examen ausente puede existir de todas formas");
      t.falso(html.indexOf("undefined") >= 0 || html.indexOf("[object") >= 0, "sin restos de programación a la vista");
      // El modal se pega a document.body, fuera de #vgl-root: el color va en línea o con
      // !important, o el CSS de Everest se lo lleva por delante (ver CLAUDE.md).
      t.cierto(html.indexOf("!important") >= 0, "el color va blindado contra el CSS de Everest");

      const una = c.api.mtrAvisoTablaLabsHtml({ solicitudesNoLeidas: 1, viejasOcultas: 0 });
      t.cierto(una.indexOf("1 de las órdenes") >= 0, "en singular también se lee bien");
    });

    t.caso("v17.7.1 — las filas ocultas por antigüedad también se dicen", () => {
      const html = c.api.mtrAvisoTablaLabsHtml({ solicitudesNoLeidas: 0, viejasOcultas: 3 });
      t.cierto(html.indexOf("3 resultados") >= 0, "cuántos quedaron fuera de los 365 días");
      t.falso(html.indexOf("órdenes") >= 0, "y no se inventa un fallo de Athenea que no hubo");

      const ambos = c.api.mtrAvisoTablaLabsHtml({ solicitudesNoLeidas: 1, viejasOcultas: 2 });
      t.cierto(ambos.indexOf("órdenes") >= 0 && ambos.indexOf("2 resultados") >= 0,
        "cuando pasan las dos cosas, se cuentan las dos");
    });

    t.caso("v17.7.1 — sin nada que advertir, el aviso NO sale", () => {
      t.igual(c.api.mtrAvisoTablaLabsHtml({ solicitudesNoLeidas: 0, viejasOcultas: 0 }), "",
        "un aviso que sale siempre deja de leerse");
      t.igual(c.api.mtrAvisoTablaLabsHtml(null), "", "sin datos tampoco se alarma a nadie");
      t.igual(c.api.mtrAvisoTablaLabsHtml({}), "", "ni con un objeto vacío");
    });

    t.caso("v17.7.1 — el marcador de lectura parcial se pierde al copiar: por eso se lee antes", () => {
      // Es el fallo exacto que había: `__vglIncompleto` viaja como propiedad NO enumerable
      // del array de Athenea, y el modal copiaba analito a analito a OTRO array — con eso
      // el marcador se perdía en la línea siguiente a haberse escrito.
      const arr = [{ NombreParametro: "CREATININA" }];
      Object.defineProperty(arr, "__vglIncompleto", { value: 2, enumerable: false, configurable: true });
      t.cierto(c.api.atheneaLecturaIncompleta(arr), "el array marcado se reconoce como lectura parcial");
      const copiado = arr.map((l) => ({ origen: "Athenea (Principal)", ...l }));
      t.falso(c.api.atheneaLecturaIncompleta(copiado),
        "y al copiarlo el marcador desaparece: hay que leerlo ANTES de copiar");
    });

    t.caso("v17.7.1 CABLEADO — la tabla de paraclínicos pinta el aviso y lo lee antes de copiar", () => {
      // Probar la pieza no es probar que la pieza está conectada (lección de v17.6.93/94).
      // El modal es asíncrono y depende de la red de Athenea, así que aquí se fija el
      // cableado sobre el texto fuente: si alguien lo desconecta, esta prueba cae.
      const fs = require("fs"), path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/contentEl\.innerHTML = `[\s\S]{0,160}mtrAvisoTablaLabsHtml\(/.test(src),
        "el aviso se pinta JUSTO encima de la tabla de paraclínicos, no en cualquier sitio");
      t.cierto(src.indexOf("viejasOcultas: _labViejasOcultas") >= 0,
        "y recibe el contador de filas ocultas por antigüedad, que hasta hoy no se enseñaba nunca");
      // El orden importa: leer el marcador DESPUÉS del forEach que copia lo perdería.
      const iLee = src.indexOf("_labsSolicitudesNoLeidas = (labsArr && labsArr.__vglIncompleto)");
      const iCopia = src.indexOf('labsArr.forEach(l => todosLabs.push({ origen: "Athenea (Principal)"');
      t.cierto(iLee > 0 && iCopia > 0 && iLee < iCopia,
        "el marcador se lee ANTES de copiar los analitos: al copiarlos se pierde");
    });


    // =================================================================
    //  v17.7.4 — REPORTE EN CONSULTA (27-ago): «falta la creatinina en esta paciente que
    //  fue tomada también ahora en agosto». El diagnóstico que corrió el médico lo cazó, y
    //  la causa no se podía adivinar desde el código: Athenea nombra los exámenes con la
    //  nomenclatura del laboratorio, y dos analitos DE SANGRE llevan la palabra «orina»
    //  dentro de su propio nombre. Uno de ellos dice literalmente «diferente a orina».
    //
    //  Consecuencia doble y silenciosa: desaparecían de la tabla (absorbidos por el bloque
    //  «Uroanálisis» — 31 analitos contados en la paciente real) Y quedaban sin casar con
    //  ninguna casilla, incluida la creatinina sérica, que es la que manda el estadio
    //  renal, las vigencias y el ANR.
    //
    //  Los nombres de abajo son los REALES de Athenea, verificados en campo. No son PHI:
    //  son nomenclatura de laboratorio, sin nada del paciente.
    // =================================================================
    const NOMBRES_REALES_ATHENEA = {
      creatininaSerica: "CREATININA EN SUERO. ORINA U OTROS",
      glucosaSerica: "GLUCOSA EN SUERO. LCR U OTRO FLUIDO DIFERENTE A ORINA",
      creatininaOrina: "CREATININA EN ORINA ESPONTANEA",
    };

    t.caso("v17.7.4 — un examen DE SANGRE cuyo nombre contiene «orina» no es de orina", () => {
      const creat = { NombreParametro: NOMBRES_REALES_ATHENEA.creatininaSerica, NombreParametroPadre: "QUIMICA SANGUINEA" };
      const gluc = { NombreParametro: NOMBRES_REALES_ATHENEA.glucosaSerica, NombreParametroPadre: "QUIMICA SANGUINEA" };
      t.falso(testApi._esAnalitoDeOrina(creat), "la creatinina SÉRICA no puede contar como analito de orina");
      t.falso(testApi._esAnalitoDeOrina(gluc), "ni la glicemia, cuyo nombre dice «DIFERENTE A ORINA»");
      // Y lo que de verdad importa: que lleguen a su casilla.
      t.igual((testApi._matchLabInWhitelist(creat) || {}).key, "CREATININA",
        "la creatinina sérica casa con su casilla: sin esto no hay TFG, ni estadio, ni vigencias, ni ANR");
      t.igual((testApi._matchLabInWhitelist(gluc) || {}).key, "GLUCOSA", "y la glicemia con la suya");

      // Variante CONSTRUIDA (no observada en campo, a diferencia de las dos de arriba): un
      // nombre que declara la muestra solo por descarte, sin decir «en suero». «Diferente a
      // orina» es una negación explícita y tiene que bastar por sí sola — si el patrón solo
      // mirara «EN SUERO», este volvería a caer en el bloque de orina.
      t.falso(testApi._esAnalitoDeOrina({ NombreParametro: "GLUCOSA. LCR U OTRO FLUIDO DIFERENTE A ORINA" }),
        "«diferente a orina» dice, por sí solo, que la muestra no es orina");
    });

    t.caso("v17.7.4 — la guarda de orina sigue entera: no se abrió un boquete al arreglarlo", () => {
      // La guarda existe desde v12.3.37 por un error clínico REAL en la dirección
      // contraria: la hemoglobina EN ORINA cayendo en la casilla de hemoglobina sérica.
      // Arreglar un sentido sin romper el otro es la mitad del trabajo.
      t.cierto(testApi._esAnalitoDeOrina({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "PARCIAL DE ORINA" }),
        "la hemoglobina EN ORINA sigue siendo de orina");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "HEMOGLOBINA", NombreParametroPadre: "PARCIAL DE ORINA" }), null,
        "y jamás casa con la casilla sérica");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "GLUCOSA", NombreParametroPadre: "UROANALISIS" }), null,
        "la glucosa EN ORINA tampoco casa con la glicemia");
      // Las otras exclusiones de la creatinina describen OTRO examen, no otra muestra:
      // esas no se tocan.
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "DEPURACION DE CREATININA EN ORINA 24 H" }), null,
        "la depuración de 24 h sigue excluida: es otro examen, no otra muestra");
      t.igual(testApi._matchLabInWhitelist({ NombreParametro: "CREATINURIA" }), null, "y la creatinuria también");
    });

    t.caso("v17.7.4 — el bloque «Uroanálisis» de la tabla deja de tragarse exámenes de sangre", () => {
      // Reproduce la toma real: un uroanálisis de verdad más los dos analitos séricos que
      // el bloque estaba absorbiendo. Antes de este arreglo la tabla mostraba UNA fila
      // (Uroanálisis) y los dos séricos solo existían escondidos dentro del acordeón.
      const labs = [
        { NombreParametro: "Nitritos", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", __vglFechaSolicitud: "2026-08-20" },
        { NombreParametro: "Leucocitos", NombreParametroPadre: "UROANALISIS", Resultado: "0-2", __vglFechaSolicitud: "2026-08-20" },
        { NombreParametro: NOMBRES_REALES_ATHENEA.creatininaSerica, NombreParametroPadre: "QUIMICA SANGUINEA", Resultado: "0.9", __vglFechaSolicitud: "2026-08-20" },
        { NombreParametro: NOMBRES_REALES_ATHENEA.glucosaSerica, NombreParametroPadre: "QUIMICA SANGUINEA", Resultado: "95", __vglFechaSolicitud: "2026-08-20" },
      ];
      const filas = testApi._agruparUroanalisisParaTabla(labs);
      const nombres = filas.map((f) => String(f.NombreParametro || ""));
      t.cierto(nombres.indexOf("Uroanálisis") >= 0, "el uroanálisis sigue agrupándose en su bloque");
      t.cierto(nombres.indexOf(NOMBRES_REALES_ATHENEA.creatininaSerica) >= 0,
        "y la creatinina sérica conserva su PROPIA fila: es justo la que el médico no encontraba");
      t.cierto(nombres.indexOf(NOMBRES_REALES_ATHENEA.glucosaSerica) >= 0, "igual que la glicemia");
      const bloque = filas.find((f) => Array.isArray(f.__vglGrupoUroComponentes));
      t.igual(bloque.__vglGrupoUroComponentes.length, 2,
        "dentro del bloque quedan SOLO los dos componentes de orina, no los cuatro");
    });


    t.caso("v17.8.2 REPORTE EN CONSULTA — el uroanálisis de AGOSTO no lo pisa la fila «NORMAL» de MAYO", () => {
      // Reproducción exacta del caso del médico: Athenea trae la fila REAL del panel del
      // 07/05/2026 con Resultado «NORMAL» y, además, los componentes del uroanálisis del
      // 20/08/2026 —el que la tabla marca con «Alteraciones detectadas»—. Antes de v17.8.2,
      // Auto-Labs escribía «NORMAL» y la fecha de mayo en la historia clínica.
      const MAYO = "2026-05-07", AGOSTO = "2026-08-20";
      const labs = [
        { NombreParametro: "UROANALISIS", Resultado: "NORMAL", __vglFechaSolicitud: MAYO },
        { NombreParametro: "Nitritos", NombreParametroPadre: "UROANALISIS", Resultado: "NEGATIVO", __vglFechaSolicitud: AGOSTO },
        { NombreParametro: "Hematies", NombreParametroPadre: "UROANALISIS", Resultado: "2.90", __vglFechaSolicitud: AGOSTO },
        { NombreParametro: "Leucocitos", NombreParametroPadre: "UROANALISIS", Resultado: "0-2", __vglFechaSolicitud: AGOSTO },
      ];
      const cand = testApi._ultimaFechaPorAnalito(labs, { uroanalisisPorComponentes: true }).candidatos.get("UROANALISIS");
      t.cierto(!!cand, "tiene que haber candidato, o la prueba no mira nada");
      t.igual(cand.resultDate, AGOSTO,
        "manda el uroanálisis de agosto: es el último que se le hizo al paciente");
      t.cierto(cand.viaComponente === true,
        "y gana por componentes, así que la casilla de texto NO se pisa con el «NORMAL» de mayo");

      // El orden de llegada no puede cambiar el resultado: el portal no garantiza ninguno.
      const alReves = testApi._ultimaFechaPorAnalito(labs.slice().reverse(), { uroanalisisPorComponentes: true })
        .candidatos.get("UROANALISIS");
      t.igual(alReves.resultDate, AGOSTO, "llegue en el orden que llegue, gana agosto");
    });

    t.caso("v17.8.2 — el orden por fecha deja de ser un supuesto y pasa a ser un hecho", () => {
      // Toda la lógica de «el primero reclama la casilla» descansaba en un supuesto escrito
      // como si fuera un hecho: «las solicitudes llegan de más reciente a más antigua». Nada
      // lo garantizaba, y estas 7 casillas NO llevan fecha acompañante: un componente viejo
      // colado ahí es invisible para el médico. Aquí se fija el orden que usa la inyección.
      const fs = require("fs"), path = require("path");
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/_ordenadoPorFecha\s*=\s*labsArray\.slice\(\)\.sort/.test(src),
        "la inyección de componentes de orina recorre una copia ORDENADA por fecha");
      t.cierto(/_ordenadoPorFecha\.forEach/.test(src),
        "y es esa copia la que se recorre, no el array crudo del portal");
      t.falso(/\n      labsArray\.forEach\(\(lab\) => \{\n          if \(_esAnalitoDeOrina/.test(src),
        "el recorrido sin ordenar no puede volver por la puerta de atrás");
    });

    t.caso("v17.16.0 — _esMuestraSerica y _esUroComponenteAlterado, probadas de frente", () => {
      // Las dos estaban en `cubre` sin que ninguna prueba las nombrara. La primera es la
      // regla del v17.7.4 que destapó el reporte en vivo «falta la creatinina de agosto»:
      // Athenea tiene analitos DE SANGRE con la palabra «orina» dentro de su nombre.
      t.cierto(api._esMuestraSerica("CREATININA EN SUERO. ORINA U OTROS"),
        "«EN SUERO» manda aunque el nombre diga «ORINA» después — es el caso REAL del reporte");
      t.cierto(api._esMuestraSerica("GLUCOSA EN SUERO. LCR U OTRO FLUIDO DIFERENTE A ORINA"),
        "y «DIFERENTE A ORINA» dice literalmente que no es de orina");
      t.cierto(api._esMuestraSerica("HEMOGLOBINA EN SANGRE"), "«EN SANGRE» también");
      t.falso(api._esMuestraSerica("CREATININA EN ORINA PARCIAL"), "una creatinina de orina NO es sérica");
      t.falso(api._esMuestraSerica(""), "sin nombre no se afirma nada");

      // La segunda decide si un componente del parcial de orina está alterado.
      t.falso(api._esUroComponenteAlterado(null), "sin componente, no hay alteración");
      t.falso(api._esUroComponenteAlterado({ nombre: "NITRITOS", resultado: "" }),
        "un resultado vacío no es un hallazgo: es un hueco");
      t.falso(api._esUroComponenteAlterado({ nombre: "NITRITOS", resultado: "NEGATIVO" }), "negativo es normal");
      t.cierto(api._esUroComponenteAlterado({ nombre: "NITRITOS", resultado: "POSITIVO" }), "positivo es alteración");
      t.cierto(api._esUroComponenteAlterado({ nombre: "LEUCOCITOS", resultado: "12" }), "12 leucocitos pasan el corte de 5");
      t.falso(api._esUroComponenteAlterado({ nombre: "LEUCOCITOS", resultado: "3" }), "3 no lo pasan");
      t.cierto(api._esUroComponenteAlterado({ nombre: "HEMATIES", resultado: "8" }), "8 hematíes pasan el corte de 3");
      t.cierto(api._esUroComponenteAlterado({ nombre: "CELULAS TUBULO RENALES", resultado: "1" }),
        "una sola célula tubular renal ya es hallazgo: es daño de túbulo");
      t.falso(api._esUroComponenteAlterado({ nombre: "COLOR", resultado: "AMARILLO" }), "el color normal no alarma");
    });


    // =====================================================================
    // v18.0.20 — UN FALLO DE RED SE LE MOSTRABA AL MÉDICO COMO UN HECHO DEL PACIENTE
    //
    // Cuando Athenea contesta 5 de 8 solicitudes, el lector devuelve lo que sí llegó pero
    // MARCADO: `__vglIncompleto = 3`, puesto con Object.defineProperty({enumerable:false})
    // para que no ensucie las iteraciones sobre el array. Y JSON.stringify NO serializa
    // propiedades no enumerables: al persistir la pre-consulta, la marca desaparecía.
    //
    // Aguas abajo: _preconHidratar mete ese array en _labsPrefetch, checkAvisoUniversal
    // calcula labsListos = true, y _analitosRcvVencidos declara VENCIDOS los analitos que
    // venían en las solicitudes ilegibles. El aviso de entrada los lista como «Laboratorios
    // RCV sin resultado vigente» y avisoMarcarVisto lo silencia el resto de la jornada. Al
    // médico se le afirma «a este paciente le faltan estos exámenes» cuando lo que hubo fue
    // un fallo de red — justo lo que «casilla vacía antes que dato inventado» impide.
    // =====================================================================
    t.caso("v18.0.20: la marca de lectura incompleta de Athenea sobrevive a la persistencia", () => {
      const c = cargar({ silencioso: true });
      const DOC = "5150076";
      const labs = [{ nombre: "CREATININA EN SUERO", Resultado: "1.0" }];
      Object.defineProperty(labs, "__vglIncompleto", { value: 3, enumerable: false, configurable: true });

      t.cierto(c.api.atheneaLecturaIncompleta(labs), "control del caso: recién leída consta como incompleta");

      c.api._preconGuardar(DOC, labs);
      const e = c.api._preconDe(DOC);
      t.cierto(!!e && Array.isArray(e.labs), "la pre-consulta se recupera");
      t.cierto(c.api.atheneaLecturaIncompleta(e.labs),
        "y sigue constando incompleta: si se pierde, 3 solicitudes ilegibles se convierten en «exámenes que le faltan al paciente»");
      t.igual(e.labs.__vglIncompleto, 3, "con el número exacto de solicitudes que no se dejaron leer");
    });

    t.caso("v18.0.20: la marca repuesta NO se cuela como un resultado más del array", () => {
      const c = cargar({ silencioso: true });
      const DOC = "5150076";
      const labs = [{ nombre: "CREATININA EN SUERO", Resultado: "1.0" }];
      Object.defineProperty(labs, "__vglIncompleto", { value: 2, enumerable: false, configurable: true });
      c.api._preconGuardar(DOC, labs);
      const e = c.api._preconDe(DOC);
      t.igual(e.labs.length, 1, "el array sigue teniendo UN resultado");
      t.igual(Object.keys(e.labs).length, 1,
        "y la marca se repone como NO enumerable: ninguna iteración la verá como un laboratorio");
    });

    t.caso("v18.0.20: una lectura COMPLETA no se marca por error", () => {
      const c = cargar({ silencioso: true });
      const DOC = "5150076";
      const labs = [{ nombre: "CREATININA EN SUERO", Resultado: "1.0" }];   // sin marca: llegó entera
      c.api._preconGuardar(DOC, labs);
      const e = c.api._preconDe(DOC);
      t.falso(c.api.atheneaLecturaIncompleta(e.labs),
        "no se puede sobre-corregir: una lectura completa debe seguir contando como completa");
    });

  }
};
