// =====================================================================
//  SUITE 39 — Seguridad de dosis renal: comportamiento y costura
//
//  La suite 43 comprueba que el port reproduce al Copiloto en 9.000 vectores.
//  Esta comprueba las propiedades que un contraste vector a vector NO ve:
//
//   · que la ausencia de datos NUNCA se lea como "todo bien" — el fallo más
//     peligroso de un avisador clínico no es avisar de más, es callar porque
//     no pudo leer;
//   · que la costura hacia Everest sigue desenganchada y se nota;
//   · que la bandera nace apagada;
//   · que un fármaco prohibido nunca se degrada a un aviso blando.
// =====================================================================
module.exports = {
  nombre: "Seguridad de dosis renal (motor portado)",
  cubre: [
    "mtrAvisosDosisRenal", "mtrLeerMedicamentos",
    "mtrMotorEncendido", "mtrDetectarPrincipios", "mtrPrincipioEnTexto",
    "mtrEvaluarDiscrepanciaEstadios", "mtrClasificarEstadioTfg",
    "mtrReglaErcG3aA2", "mtrReglaFurosemida", "mtrAlerta", "mtrAlertaSuave",
    "mtrFmt0", "mtrFmt1", "mtrNumPy",
    "mtrMedicamentosDesdeRespuesta", "mtrRenglonesMedicamentoDesdeRespuesta",
    "mtrFechaEverest", "mtrMedsInvalidar",
    "mtrRefrescarMedicamentos", "mtrPedirMedicamentos",
  ],

  async pruebas(t, api, env, cargar) {
    const respuestaJson = (cuerpo, status) => async () => ({
      ok: (status || 200) < 400, status: status || 200,
      json: async () => cuerpo, text: async () => JSON.stringify(cuerpo),
    });
    const FIXTURE_RED = require("./fixtures/everest_medicamentos.json").respuesta;
    // ---------- lo que más importa: el silencio siempre lleva motivo ----------

    t.caso("sin lista de medicamentos NO se devuelve 'todo bien', se devuelve el motivo", () => {
      const r = api.mtrAvisosDosisRenal({});
      t.igual(r.avisos, []);
      t.igual(r.motivo, "SIN_LISTA_DE_MEDICAMENTOS");
      t.cierto(/no significa que no haya riesgo/i.test(r.legible),
        "el texto para el médico tiene que decir explícitamente que el silencio no es seguridad");
    });

    t.caso("cero avisos con lista leída y cero avisos sin lista son motivos DISTINTOS", () => {
      const sinLista = api.mtrAvisosDosisRenal({});
      const conLista = api.mtrAvisosDosisRenal({
        medicamentos: ["ACETAMINOFEN 500 MG"], tfgCkdEpi: 80, tfgCockcroftGault: 82,
      });
      t.igual(sinLista.avisos.length, 0);
      t.igual(conLista.avisos.length, 0);
      t.cierto(sinLista.motivo !== conLista.motivo,
        "clínicamente son opuestos y no pueden compartir motivo");
      t.igual(conLista.motivo, "SIN_HALLAZGOS");
    });

    t.caso("sin función renal tampoco se juzga nada, y se dice", () => {
      for (const ctx of [
        { medicamentos: ["METFORMINA 850 MG"] },
        { medicamentos: ["METFORMINA 850 MG"], tfgCkdEpi: 0, tfgCockcroftGault: 0 },
        { medicamentos: ["METFORMINA 850 MG"], tfgCkdEpi: "abc", tfgCockcroftGault: 30 },
        { medicamentos: ["METFORMINA 850 MG"], tfgCkdEpi: -5, tfgCockcroftGault: 30 },
      ]) {
        const r = api.mtrAvisosDosisRenal(ctx);
        t.igual(r.motivo, "SIN_FUNCION_RENAL", JSON.stringify(ctx));
        t.igual(r.avisos, []);
      }
    });

    t.caso("lista vacía leída de verdad es su propio motivo", () => {
      const r = api.mtrAvisosDosisRenal({ medicamentos: [], tfgCkdEpi: 25, tfgCockcroftGault: 26 });
      t.igual(r.motivo, "SIN_MEDICAMENTOS_ACTIVOS");
    });

    // ---------- la costura, contra la forma REAL del endpoint ----------
    //
    // El endpoint ya no se adivina: está capturado con cuerpo de respuesta en
    // captura_ordenamiento_nativo_20260810.json (rama 7df1a4b), grabado por el
    // GRABADOR del propio proyecto. Estas pruebas corren contra un fixture
    // SINTÉTICO con esa misma forma — cero datos de pacientes.

    const FIXTURE = require("./fixtures/everest_medicamentos.json").respuesta;

    t.caso("del cuerpo real de Everest salen los nombres que el motor sabe leer", () => {
      const l = api.mtrMedicamentosDesdeRespuesta(FIXTURE, { estados: ["PENDIENTE"] });
      t.cierto(Array.isArray(l));
      t.cierto(l.indexOf("METFORMINA CLORHIDRATO 850 MG TABLETA RECUBIERTA") >= 0);
      // y el motor los reconoce de verdad, que es el punto
      t.cierto(api.mtrDetectarPrincipios(l[0]).indexOf("metformina") >= 0);
    });

    t.caso("una formulación ANULADA no se juzga como si el paciente la tomara", () => {
      const vigentes = api.mtrMedicamentosDesdeRespuesta(FIXTURE, { estados: ["PENDIENTE"] });
      const todas = api.mtrMedicamentosDesdeRespuesta(FIXTURE, null);
      t.cierto(todas.length > vigentes.length, "el fixture debe traer al menos una anulada");
      t.cierto(vigentes.join("|").indexOf("ESPIRONOLACTONA") < 0,
        "la espironolactona está en una formulación ANULADA y no puede contar");
      t.cierto(todas.join("|").indexOf("ESPIRONOLACTONA") >= 0);
    });

    t.caso("los renglones sin nombre se descartan y no se cuelan como fármaco vacío", () => {
      const l = api.mtrMedicamentosDesdeRespuesta(FIXTURE, { estados: ["PENDIENTE"] });
      t.igual(l.filter((x) => !x || !x.trim()).length, 0);
      // el fixture trae un renglón con "   " y otro con descripcion null
      t.igual(l.length, 4, "4 renglones útiles de los 6 vigentes del fixture");
    });

    t.caso("una respuesta con la forma equivocada devuelve null, no una lista vacía", () => {
      for (const malo of [null, undefined, {}, "", 0, { detalles: [] }, "[]"]) {
        t.igual(api.mtrMedicamentosDesdeRespuesta(malo, null), null, JSON.stringify(malo));
      }
      t.igual(api.mtrMedicamentosDesdeRespuesta([], null), [],
        "un array vacío SÍ es una respuesta válida: el paciente no tiene formulaciones");
    });

    t.caso("la respuesta se aguanta basura dentro sin tumbarse", () => {
      const roto = [null, { detalles: null }, { detalles: [null, 3, "x"] },
        { estado: "PENDIENTE", detalles: [{ descripcion: "METFORMINA 850 MG" }] }];
      let r;
      t.noLanza(() => { r = api.mtrMedicamentosDesdeRespuesta(roto, null); });
      t.igual(r, ["METFORMINA 850 MG"]);
    });

    t.caso("los renglones completos conservan dosificación y días para el médico", () => {
      const r = api.mtrRenglonesMedicamentoDesdeRespuesta(FIXTURE, { estados: ["PENDIENTE"] });
      const met = r.filter((x) => x.descripcion.indexOf("METFORMINA") >= 0)[0];
      t.igual(met.dosificacion, "2");
      t.igual(met.cantidadDias, "30");
      t.igual(met.estadoFormulacion, "PENDIENTE");
      t.igual(met.fechaCreacion, "2026-08-10", "la fecha ISO con huso se recorta a la fecha");
      t.igual(api.mtrRenglonesMedicamentoDesdeRespuesta("no-es-array", null), null);
    });

    t.caso("las fechas van en el formato que Everest espera, no en ISO", () => {
      // La captura real muestra "Sun May 04 2025" — es Date.toDateString().
      t.igual(api.mtrFechaEverest(api.mtrFechaDesdeIso("2025-05-04")), "Sun May 04 2025");
      t.igual(api.mtrFechaEverest(api.mtrFechaDesdeIso("2026-08-10")), "Mon Aug 10 2026");
      t.igual(api.mtrFechaEverest(api.mtrFechaDesdeIso("2026-01-01")), "Thu Jan 01 2026");
      t.igual(api.mtrFechaEverest(null), null);
      t.igual(api.mtrFechaEverest("2026-08-10"), null, "solo acepta un Date, no texto");
    });

    t.caso("sin caché fresca, leer medicamentos devuelve null y no una lista vieja", () => {
      api.mtrMedsInvalidar();
      t.igual(api.mtrLeerMedicamentos(12345), null);
      t.igual(api.mtrLeerMedicamentos(null), null);
    });

    t.caso("el paso de la lista al aviso funciona de punta a punta", () => {
      // el mismo paciente sintético, con función renal de G4
      const meds = api.mtrMedicamentosDesdeRespuesta(FIXTURE, { estados: ["PENDIENTE"] });
      const r = api.mtrAvisosDosisRenal({
        medicamentos: meds, tfgCkdEpi: 25, tfgCockcroftGault: 26,
      });
      t.igual(r.motivo, "OK");
      const principios = r.avisos.map((a) => a.principio_activo);
      t.cierto(principios.indexOf("metformina") >= 0, "metformina contraindicada con eGFR 25");
      t.cierto(principios.indexOf("aines") >= 0, "el ibuprofeno con eGFR 25");
      t.cierto(principios.indexOf("ieca_ara2") >= 0, "el losartán con eGFR 25");
      t.cierto(principios.indexOf("lmwh") >= 0, "la enoxaparina con CrCl 26");
      t.cierto(principios.indexOf("espironolactona") < 0,
        "la espironolactona venía en una formulación ANULADA: no puede aparecer");
    });

    // ---------- la llamada de red, con fetch simulado ----------

    await t.casoAsync("pega al endpoint real, por POST y con las fechas en el formato de Everest", async () => {
      const vistas = [];
      const c = cargar({
        silencioso: true,
        fetch: async (url, opt) => { vistas.push({ url: String(url), opt: opt }); return respuestaJson(FIXTURE_RED)(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      const lista = await c.api.mtrRefrescarMedicamentos(987654);
      // v17.2.0 — el refresco pide EN PARALELO los medicamentos vigentes y el HISTÓRICO:
      // las frecuencias reales de cada fármaco salen de esa segunda llamada.
      t.igual(vistas.length, 2, "debía hacer exactamente dos peticiones (vigentes + histórico de frecuencias)");
      const pega = vistas.filter((v) => String(v.url).indexOf("/apiviva/APIMedicamentoHealth/api/medicamento/CargarMedicamentosPaciente") >= 0);
      t.igual(pega.length, 1, "la petición principal sigue pegando al endpoint real");
      t.cierto(vistas.some((v) => String(v.url).indexOf("HistoricoMedicamentoHCM") >= 0),
        "y la segunda es el histórico de frecuencias (v17.2.0)");
      const primero = pega[0];
      t.igual(primero.opt.method, "POST");
      const cuerpo = JSON.parse(primero.opt.body);
      t.igual(cuerpo.pacienteId, 987654);
      t.igual(cuerpo.estado, "");
      t.cierto(/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}$/.test(cuerpo.fechaInicial),
        "fechaInicial no va en el formato de Everest: " + cuerpo.fechaInicial);
      t.cierto(/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}$/.test(cuerpo.fechaFinal), cuerpo.fechaFinal);
      // y lo que devuelve ya viene filtrado por estado vigente
      t.igual(lista.length, 4);
      t.cierto(lista.join("|").indexOf("ESPIRONOLACTONA") < 0, "la anulada no puede llegar");
    });

    await t.casoAsync("tras refrescar, la lectura síncrona ya tiene la lista del paciente correcto", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => respuestaJson(FIXTURE_RED)(),
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(c.api.mtrLeerMedicamentos(111), null, "antes de refrescar no hay nada");
      await c.api.mtrRefrescarMedicamentos(111);
      t.igual((c.api.mtrLeerMedicamentos(111) || []).length, 4);
      t.igual(c.api.mtrLeerMedicamentos(222), null,
        "la caché es POR PACIENTE: otro paciente jamás puede recibir esta lista");
    });

    await t.casoAsync("una respuesta que no es un array sube como null, nunca como lista vacía", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => respuestaJson({ error: "algo raro" })(),
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(await c.api.mtrPedirMedicamentos(111), null);
      t.igual(await c.api.mtrRefrescarMedicamentos(111), null,
        "una lista vacía aquí diría 'no toma nada', que es falso y peligroso");
    });

    await t.casoAsync("si la red falla, devuelve null y no tumba la consulta", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => { throw new Error("red caída"); },
        gmxhr: (o) => { if (o.onerror) o.onerror("sin red"); },
      });
      let r;
      await t.noLanza(async () => { r = await c.api.mtrPedirMedicamentos(111); });
      t.igual(r, null);
    });

    await t.casoAsync("sin pacienteId no se pega al servidor siquiera", async () => {
      let n = 0;
      const c = cargar({
        silencioso: true,
        fetch: async () => { n++; return respuestaJson([])(); },
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      t.igual(await c.api.mtrPedirMedicamentos(null), null);
      t.igual(await c.api.mtrPedirMedicamentos(0), null);
      t.igual(n, 0, "no debía hacer ninguna petición");
    });

    t.caso("la bandera nace apagada", () => {
      t.falso(api.mtrMotorEncendido(), "el motor no puede llegar encendido a veinte consultorios");
    });

    // ---------- que un fármaco prohibido no se degrade ----------

    t.caso("el anticoagulante con tilde sigue siendo CONTRAINDICADO, no un aviso blando", () => {
      // El bug que el Copiloto ya corrigió: con .lower() a secas "Dabigatrán"
      // no casaba con "dabigatran" y la alerta bajaba de CRITICAL a HIGH.
      const conTilde = api.mtrReglaDoac("DABIGATRÁN 150 MG", 20, null);
      const sinTilde = api.mtrReglaDoac("DABIGATRAN 150 MG", 20, null);
      t.igual(conTilde.conducta, "CONTRAINDICADA");
      t.igual(conTilde.severidad, "CRITICAL");
      t.igual(conTilde.mensaje, sinTilde.mensaje, "la tilde no puede cambiar la conducta");
    });

    t.caso("la metformina cruza sus dos umbrales en el sitio exacto", () => {
      t.igual(api.mtrReglaMetformina("METFORMINA", 29.9, null).conducta, "CONTRAINDICADA");
      t.igual(api.mtrReglaMetformina("METFORMINA", 30, null).conducta, "CAP_DOSIS");
      t.igual(api.mtrReglaMetformina("METFORMINA", 44.9, null).conducta, "CAP_DOSIS");
      t.igual(api.mtrReglaMetformina("METFORMINA", 45, null), null);
    });

    t.caso("la linagliptina se excluye del ajuste renal y las demás gliptinas no", () => {
      t.igual(api.mtrReglaDpp4("LINAGLIPTINA 5 MG", 20, null), null);
      t.cierto(!!api.mtrReglaDpp4("SITAGLIPTINA 100 MG", 20, null));
    });

    t.caso("un potasio alto contraindica la espironolactona aunque el riñón esté bien", () => {
      const r = api.mtrReglaEspironolactona("ESPIRONOLACTONA 25 MG", 90, 5.2);
      t.igual(r.conducta, "CONTRAINDICADA");
      t.igual(r.severidad, "CRITICAL");
      t.cierto(r.mensaje.indexOf("5.2") >= 0, "el mensaje tiene que llevar el valor real");
      t.igual(api.mtrReglaEspironolactona("ESPIRONOLACTONA 25 MG", 90, 4.9), null);
    });

    // ---------- detección de principios ----------

    t.caso("el texto libre del EHR se reconoce con dosis, mayúsculas y tildes", () => {
      for (const txt of ["METFORMINA 850 MG", "metformina", "Metformina 1000mg c/12h", "METFÓRMINA"]) {
        const p = api.mtrDetectarPrincipios(txt);
        if (txt === "METFÓRMINA") continue; // tilde inventada: no está en el vademécum
        t.cierto(p.indexOf("metformina") >= 0, "no reconoció: " + txt);
      }
      t.igual(api.mtrDetectarPrincipios("acetaminofen 500"), []);
      t.igual(api.mtrDetectarPrincipios(""), []);
      t.igual(api.mtrDetectarPrincipios(null), []);
    });

    t.caso("un mismo fármaco puede pertenecer a varios grupos, y se detectan todos", () => {
      const p = api.mtrDetectarPrincipios("ATENOLOL 50 MG");
      t.cierto(p.indexOf("betabloqueador_hidrofilico") >= 0);
      t.cierto(p.indexOf("betabloqueador") >= 0);
    });

    t.caso("mtrPrincipioEnTexto cae al propio nombre cuando no hay sinónimos", () => {
      t.cierto(api.mtrPrincipioEnTexto("metformina", "toma metformina hoy"));
      t.falso(api.mtrPrincipioEnTexto("metformina", "toma losartan hoy"));
      t.cierto(api.mtrPrincipioEnTexto("inventado", "algo inventado aqui"),
        "sin entrada en el vademécum, busca el nombre literal");
    });

    // ---------- discrepancia entre fórmulas ----------

    t.caso("dos fórmulas que discrepan más de dos estadios levantan alerta", () => {
      t.igual(api.mtrEvaluarDiscrepanciaEstadios(95, 92), null, "mismo estadio");
      t.igual(api.mtrEvaluarDiscrepanciaEstadios(null, 50), null);
      t.igual(api.mtrEvaluarDiscrepanciaEstadios(0, 50), null, "una TFG de 0 no es un dato");
      const d = api.mtrEvaluarDiscrepanciaEstadios(95, 20);
      t.cierto(!!d && d.alerta === true);
      t.igual(d.estadio_cg, "G1");
      t.igual(d.estadio_ckd, "G4");
      t.igual(d.diferencia_estadios, 4);
    });

    t.caso("los cortes KDIGO caen donde deben", () => {
      t.igual(api.mtrClasificarEstadioTfg(90), "G1");
      t.igual(api.mtrClasificarEstadioTfg(89.9), "G2");
      t.igual(api.mtrClasificarEstadioTfg(60), "G2");
      t.igual(api.mtrClasificarEstadioTfg(59.9), "G3a");
      t.igual(api.mtrClasificarEstadioTfg(45), "G3a");
      t.igual(api.mtrClasificarEstadioTfg(44.9), "G3b");
      t.igual(api.mtrClasificarEstadioTfg(30), "G3b");
      t.igual(api.mtrClasificarEstadioTfg(29.9), "G4");
      t.igual(api.mtrClasificarEstadioTfg(15), "G4");
      t.igual(api.mtrClasificarEstadioTfg(14.9), "G5");
    });

    // ---------- la regla global ----------

    t.caso("sin RAC, la regla de ERC G3a/A2 calla: no se estadifica la albuminuria a ojo", () => {
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 50, null), []);
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 50, 29), [], "por debajo de A2");
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 50, 300), [], "por encima de A2");
      t.igual(api.mtrReglaErcG3aA2(["ATORVASTATINA"], 61, 100), [], "fuera de G3a");
    });

    t.caso("en G3a/A2 sin IECA/ARA-II se recomienda INICIAR, no solo suspender", () => {
      const r = api.mtrReglaErcG3aA2(["ATORVASTATINA 40 MG"], 50, 100);
      t.igual(r.length, 1);
      t.igual(r[0].conducta, "INICIAR");
      t.igual(r[0].severidad, "CRITICAL");
    });

    t.caso("en G3a/A2 el AINE sube a CRITICAL si además falta el bloqueo SRAA", () => {
      const conRaas = api.mtrReglaErcG3aA2(["LOSARTAN 50 MG", "IBUPROFENO 400 MG"], 50, 100);
      const sinRaas = api.mtrReglaErcG3aA2(["IBUPROFENO 400 MG"], 50, 100);
      const aineCon = conRaas.filter((a) => a.principio_activo === "erc_g3a_a2_con_aine")[0];
      const aineSin = sinRaas.filter((a) => a.principio_activo === "erc_g3a_a2_con_aine")[0];
      t.igual(aineCon.severidad, "HIGH");
      t.igual(aineSin.severidad, "CRITICAL");
      t.igual(sinRaas.length, 2, "sin RAAS salen las dos alertas: iniciar y suspender");
    });

    // ---------- furosemida y su dosis ----------

    t.caso("la furosemida sin dosis conocida avisa conservador, no calla", () => {
      t.igual(api.mtrReglaFurosemida("FUROSEMIDA", 60, null, null), null, "riñón sano: silencio");
      const r = api.mtrReglaFurosemida("FUROSEMIDA", 25, null, null);
      t.igual(r.conducta, "REVISAR_FICHA_TECNICA");
      t.igual(r.severidad, "HIGH");
      t.igual(api.mtrReglaFurosemida("FUROSEMIDA", 25, null, 80).conducta, "CAP_DOSIS");
      t.igual(api.mtrReglaFurosemida("FUROSEMIDA", 25, null, 40).severidad, "INFO");
    });

    t.caso("hipokalemia con ERC avanzada manda sobre el tope de dosis", () => {
      const r = api.mtrReglaFurosemida("FUROSEMIDA", 25, 3.2, 80);
      t.cierto(r.mensaje.indexOf("hipokalemia") >= 0, "la hipokalemia tiene prioridad sobre el cap");
    });

    // ---------- el orquestador no repite ni se atraganta ----------

    t.caso("no se repite la misma conducta para el mismo principio aunque haya dos presentaciones", () => {
      const r = api.mtrEvaluarSeguridadDosisRenal(
        ["METFORMINA 850 MG", "METFORMINA 1000 MG"], 20, 21, null, null, null);
      const metf = r.filter((a) => a.principio_activo === "metformina");
      t.igual(metf.length, 1, "dos presentaciones del mismo fármaco no son dos avisos");
    });

    t.caso("una lista con basura no tumba el motor ni ensucia la salida", () => {
      for (const lista of [[null], [""], ["   "], [undefined], [null, "METFORMINA 850 MG"]]) {
        t.noLanza(() => api.mtrEvaluarSeguridadDosisRenal(lista, 20, 21, null, null, null),
          JSON.stringify(lista));
      }
      const r = api.mtrEvaluarSeguridadDosisRenal([null, "METFORMINA 850 MG"], 20, 21, null, null, null);
      t.igual(r.length, 1, "la entrada basura se salta, la buena se evalúa");
    });

    t.caso("un paciente polimedicado en G4 recibe todos sus avisos, sin duplicar", () => {
      const r = api.mtrEvaluarSeguridadDosisRenal(
        ["METFORMINA 1000 MG", "GLIBENCLAMIDA 5 MG", "IBUPROFENO 400 MG",
         "HIDROCLOROTIAZIDA 25 MG", "ATENOLOL 50 MG"], 20, 21, null, null, null);
      const principios = r.map((a) => a.principio_activo).sort();
      t.cierto(principios.indexOf("metformina") >= 0);
      t.cierto(principios.indexOf("sulfonilurea") >= 0);
      t.cierto(principios.indexOf("aines") >= 0);
      t.cierto(principios.indexOf("tiazida") >= 0);
      t.cierto(principios.indexOf("betabloqueador_hidrofilico") >= 0);
      t.igual(principios.length, new Set(principios).size, "hay principios repetidos");
    });

    // ---------- formateo ----------

    t.caso("los números se formatean como en Python, no como en JavaScript", () => {
      t.igual(api.mtrFmt1(5.25), "5.3");
      t.igual(api.mtrFmt1(null), "");
      t.igual(api.mtrFmt0(24.4), "24");
      t.igual(api.mtrNumPy(10), "10.0", "str(10.0) en Python es '10.0', no '10'");
      t.igual(api.mtrNumPy(10.5), "10.5");
    });

    t.caso("toda alerta lleva su procedencia y su bandera de override", () => {
      const a = api.mtrAlerta("x", "y", "EVITAR", "m", "f", 10, "HIGH");
      t.igual(a.fuente, "SYS_MOTOR_RCV <SEGURIDAD_DOSIS_RENAL>");
      t.cierto(a.override_llm === true);
      t.cierto(api.mtrAlertaSuave("x", "y", "EVITAR", "m", "f", 10, "HIGH").override_llm === false);
    });
  },
};
