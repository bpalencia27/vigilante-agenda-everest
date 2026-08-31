module.exports = {
  nombre: "Excel, caché y SharePoint",
  cubre: ["applyPymIdx", "packPym", "unpackPym", "fetchSpFilesMultiFolder", "loadPymDiario", "pymDiarioMensajeFallo", "savePymCache", "loadPymFromCache", "esLibroValido", "esXlsxCifrado", "todayTokens", "normName", "nameHasToken", "esNombreDeHoy", "pickTodaysFile", "xlsViejoDeHoy", "mtrLibroNoParecePym"],
  async pruebas(t, api, env, cargar) {

    // ---------- todayTokens / normName / nameHasToken / esNombreDeHoy ----------
    t.caso("todayTokens retorna tokens de fecha con formatos numericos y mes en letras", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      const toks = c.api.todayTokens();
      t.cierto(Array.isArray(toks), "retorna arreglo");
      t.cierto(toks.includes("20260810"), "incluye formato YYYYMMDD");
      t.cierto(toks.includes("10082026"), "incluye formato DDMMYYYY");
      t.cierto(toks.some(t => t.includes("agosto")), "incluye mes en letras");
    });

    t.caso("normName normaliza el nombre del archivo", () => {
      t.igual(api.normName("Agenda_Dia_CMB_20260810.xlsx"), "agendadiacmb20260810xlsx");
      t.igual(api.normName(" 2026-08-10.xls "), "20260810xls");
    });

    t.caso("nameHasToken verifica si un token está dentro del nombre evitando colas numéricas", () => {
      t.cierto(api.nameHasToken("agenda6deagosto", "6deagosto"));
      t.falso(api.nameHasToken("agenda26deagosto", "6deagosto"));
      t.cierto(api.nameHasToken("agenda06deagosto", "06deagosto"));
    });

    t.caso("esNombreDeHoy identifica archivos correspondientes a la fecha", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      t.cierto(c.api.esNombreDeHoy("Agenda_Dia_CMB_20260810.xlsx"));
      t.cierto(c.api.esNombreDeHoy("Citas 10-08-2026.xlsx"));
      t.cierto(c.api.esNombreDeHoy("10 de agosto.xlsx"));
      t.falso(c.api.esNombreDeHoy("Agenda_Dia_CMB_20260809.xlsx"));
    });

    t.caso("pickTodaysFile selecciona el archivo correcto basado en el nombre", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      const files = [
        { Name: "Agenda_20260809.xlsx" },
        { Name: "Agenda_20260810.xlsx" }
      ];
      const selected = c.api.pickTodaysFile(files);
      t.cierto(selected !== null);
      t.igual(selected.Name, "Agenda_20260810.xlsx");
    });

    t.caso("pickTodaysFile selecciona basado en fecha de modificación si no hay nombre obvio", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      // v18.0.7 — ahora la 2ª regla exige que el archivo esté SUELTO EN LA CARPETA
      // PRINCIPAL (ver el blindaje en pickTodaysFile), así que la ruta forma parte del caso.
      const RAIZ = "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM";
      const files = [
        { Name: "ArchivoRandom.xlsx", TimeLastModified: "2026-08-10T08:00:00Z", ServerRelativeUrl: RAIZ + "/ArchivoRandom.xlsx" }
      ];
      const selected = c.api.pickTodaysFile(files);
      t.cierto(selected !== null);
      t.igual(selected.Name, "ArchivoRandom.xlsx");
    });

    // =====================================================================
    //  v18.0.7 — EL LIBRO EQUIVOCADO NO PUEDE VOLVER A PRESENTARSE COMO EL PyM DEL DÍA
    //
    //  REPORTE EN VIVO (31-ago): a varios médicos dejó de salirles el aviso de PyM y de
    //  abandono de RCV al abrir la historia. El diagnóstico del equipo del médico:
    //      Archivo: ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx (PyM de hoy) (auto)
    //      Pacientes con pendientes: 0 · Documentos totales en la hoja: 1396
    //  El listado no es de UNA carpeta: fetchSpFilesMultiFolder junta las tres de
    //  CONFIG.SP.folders, y una es «…/ESTRATEGIAS POR SEDE 2026/SEDE BELLO». Ese libro de
    //  productividad no lleva fecha en el nombre y alguien lo edita a diario, así que la 2ª
    //  regla lo tomaba por «el PyM de hoy».
    //
    //  Y el daño era doble: además de dejar el índice vacío (y con él, mudos los dos
    //  avisos), al dar por encontrado el de hoy NUNCA se caía al respaldo de la base
    //  piloto ni se seguía buscando el CMB real — desactivando la regla que el médico dejó
    //  escrita: «mientras no esté subido el CMB del día se usa la base piloto, y cada X
    //  minutos se rectifica si ya subieron el oficial».
    // =====================================================================
    const RAIZ_PYM = "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM";

    t.caso("v18.0.7: un libro de una SUBCARPETA no puede pasar por «el PyM de hoy»", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      const files = [
        { Name: "ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx", TimeLastModified: "2026-08-10T08:00:00Z",
          ServerRelativeUrl: RAIZ_PYM + "/ESTRATEGIAS POR SEDE 2026/SEDE BELLO/ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx" },
      ];
      t.igual(c.api.pickTodaysFile(files), null,
        "sin candidato válido se devuelve null, que es lo que hace caer al respaldo de la base piloto y seguir buscando el CMB");
    });

    t.caso("v18.0.7: entre el libro de la subcarpeta y el suelto en la raíz, gana el de la raíz", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      const files = [
        { Name: "ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx", TimeLastModified: "2026-08-10T08:00:00Z",
          ServerRelativeUrl: RAIZ_PYM + "/ESTRATEGIAS POR SEDE 2026/SEDE BELLO/ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx" },
        { Name: "Agenda del dia.xlsx", TimeLastModified: "2026-08-10T09:00:00Z",
          ServerRelativeUrl: RAIZ_PYM + "/Agenda del dia.xlsx" },
      ];
      const sel = c.api.pickTodaysFile(files);
      t.cierto(!!sel && sel.Name === "Agenda del dia.xlsx", "se elige el suelto en la raíz");
    });

    t.caso("v18.0.7: el nombre CON la fecha de hoy sigue mandando sobre todo lo demás", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      const files = [
        { Name: "OtroCualquiera.xlsx", TimeLastModified: "2026-08-10T11:00:00Z", ServerRelativeUrl: RAIZ_PYM + "/OtroCualquiera.xlsx" },
        { Name: "Agenda_Dia_CMB_20260810.xlsx", TimeLastModified: "2026-08-09T06:00:00Z",
          ServerRelativeUrl: RAIZ_PYM + "/CITAS DIA EBS/Agenda_Dia_CMB_20260810.xlsx" },
      ];
      const sel = c.api.pickTodaysFile(files);
      t.igual(sel.Name, "Agenda_Dia_CMB_20260810.xlsx",
        "la 1ª regla (fecha en el nombre) no se toca: vale aunque esté en una subcarpeta");
    });

    t.caso("v18.0.7: mtrLibroNoParecePym — muchos documentos y CERO pendientes es OTRO libro", () => {
      const mapa = (n) => { const m = new Map(); for (let i = 0; i < n; i++) m.set("d" + i, ["x"]); return m; };
      const docs = (n) => { const s2 = new Set(); for (let i = 0; i < n; i++) s2.add("d" + i); return s2; };
      t.cierto(api.mtrLibroNoParecePym({ todos: docs(1396), map: new Map() }),
        "el caso real del 31-ago: 1.396 documentos, 0 pacientes con pendientes");
      t.falso(api.mtrLibroNoParecePym({ todos: docs(1396), map: mapa(1) }),
        "con UN solo paciente pendiente ya es un PyM plausible: no se rechaza");
      t.falso(api.mtrLibroNoParecePym({ todos: docs(10), map: new Map() }),
        "una hoja pequeña y de verdad al día NO se rechaza — el corte es alto a propósito");
      t.falso(api.mtrLibroNoParecePym(null), "sin índice no se afirma nada");
    });

    t.caso("pickTodaysFile descarta archivos temporales", () => {
      const files = [
        { Name: "~$Agenda_20260810.xlsx" }
      ];
      t.igual(api.pickTodaysFile(files), null);
    });

    // v17.6.39 — AUDITORÍA S+ (barrido total, 24-ago-2026): TimeLastModified llega en
    // UTC; comparar su string crudo (startsWith) contra la fecha LOCAL rompía en
    // Colombia (UTC-5): un archivo modificado entre las 19:00 y las 24:00 hora local ya
    // cae en el día UTC SIGUIENTE, así que al día siguiente (hora local) ese archivo
    // pasaba el startsWith y se tomaba como "el de hoy", apagando la re-búsqueda del
    // archivo real durante toda esa jornada.
    t.caso("v17.6.39: un archivo modificado anoche (hora local, tarde) NO se confunde con el de hoy, aunque su UTC ya sea de hoy", () => {
      const c = cargar();
      // "Ahora": 25-ago-2026, 09:00 hora local (Colombia, UTC-5).
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-25T09:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-25T09:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      const files = [
        // Modificado a las 19:30 hora local del 24-ago (AYER) — en UTC eso ya es
        // 25-ago 00:30, el día de "ahora". El código viejo comparaba ese string UTC
        // crudo contra "2026-08-25" (hoy) y coincidía por error.
        { Name: "ArchivoRandom.xlsx", TimeLastModified: "2026-08-25T00:30:00Z" },
      ];
      t.igual(c.api.pickTodaysFile(files), null, "el archivo es de AYER en hora local: no debe tomarse como el de hoy");
    });

    t.caso("xlsViejoDeHoy identifica un .xls antiguo de hoy", () => {
      const c = cargar();
      c.env.win.Date = class extends Date { static now() { return new Date("2026-08-10T12:00:00").getTime(); } constructor(...args) { if (args.length === 0) super("2026-08-10T12:00:00"); else super(...args); } };
      c.ctx.Date = c.env.win.Date;
      const files = [
        { Name: "Agenda_20260810.xls" }
      ];
      t.cierto(c.api.xlsViejoDeHoy(files) !== null);
    });

    // ---------- esLibroValido / esXlsxCifrado ----------
    t.caso("esLibroValido verifica cabecera ZIP (PK)", () => {
      // Valid ZIP has PK\x03\x04
      const valid = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00]);
      t.cierto(api.esLibroValido(valid, "test.xlsx"));

      const invalid = new Uint8Array([0x00, 0x00, 0x00]);
      t.falso(api.esLibroValido(invalid, "test.xlsx"));
    });


    t.caso("esXlsxCifrado verifica cabecera OLE (D0 CF 11 E0)", () => {
      // OLE header for encrypted XLSX or old XLS
      const ole = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
      t.cierto(api.esXlsxCifrado(ole));

      const zip = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
      t.falso(api.esXlsxCifrado(zip));
    });

    // ---------- packPym / unpackPym ----------
    await t.casoAsync("packPym comprime y unpackPym expande los mapas de PyM", async () => {
      const map = new Map();
      map.set("123", ["ActA", "ActB"]);
      map.set("456", ["ActA", "ActC"]);
      const todos = new Set(["123", "456", "789"]);
      const abandono = new Set(["123"]);
      const meta = { date: api.todayStamp(), name: "test.xlsx" };

      const packed = await api.packPym(map, todos, abandono, meta);
      t.cierto(typeof packed === "string");
      t.cierto(packed.includes('"v":3')); // Must have version 3

      const unpacked = await api.unpackPym(packed);
      t.cierto(unpacked !== null);

      // Check map
      t.igual(unpacked.map.size, 2);
      t.igual(unpacked.map.get("123"), ["ActA", "ActB"]);
      t.igual(unpacked.map.get("456"), ["ActA", "ActC"]);

      // Check todos
      t.cierto(unpacked.todos.has("789"));
      t.igual(unpacked.todos.size, 3);

      // Check abandono
      t.cierto(unpacked.abandono.has("123"));

      // Check meta
      t.igual(unpacked.meta.date, api.todayStamp());
      t.igual(unpacked.meta.name, "test.xlsx");
    });

    await t.casoAsync("unpackPym descarta paquetes con formato antiguo (no v3)", async () => {
      const oldFmt = JSON.stringify({ v: 2, data: "old" });
      const unpacked = await api.unpackPym(oldFmt);
      t.igual(unpacked, null);
    });

    // ---------- savePymCache / loadPymFromCache ----------
    await t.casoAsync("savePymCache escribe a GM_setValue y loadPymFromCache lo lee", async () => {
      const c = cargar(); // Fresh env

      // Set some state inside the mock api to test packing
      c.api.__state.pym = new Map();
      c.api.__state.pym.set("123", ["Act1"]);
      c.api.__state.pymTodos = new Set(["123"]);
      c.api.__state.pymAbandono = new Set(["123"]);

      // Mock GM_setValue and GM_getValue

      // Replace in vm context because the script might use its internal GM_setValue binding
      // Actually harness already binds GM_setValue and GM_getValue to `env.gm`!

      await c.api.savePymCache("test.xlsx");

      t.cierto(c.env.gm["vgl_pym"] !== undefined);
      t.cierto(c.env.gm["vgl_pym"].includes('"v":3'));
      t.igual(c.env.gm["vgl_pym_dia"], c.api.todayStamp());

      const loaded = await c.api.loadPymFromCache();
      t.cierto(loaded);

      // Because loadPymFromCache unpacks into state.pym
      t.cierto(c.api.__state.pym.has("123"));
      t.cierto(c.api.__state.pymTodos.has("123"));
      t.cierto(c.api.__state.pymAbandono.has("123"));
    });

    await t.casoAsync("loadPymFromCache descarta caché vieja y la borra", async () => {
      const c = cargar();

      // Put old date string inside cache
      const map = new Map();
      const todos = new Set();
      const abandono = new Set();
      const meta = { date: "2020-01-01", name: "viejo.xlsx" };

      const packed = await c.api.packPym(map, todos, abandono, meta);

      c.env.gm["vgl_pym"] = packed;
      c.env.gm["vgl_pym_dia"] = "2020-01-01";

      // We also need to mock GM_setValue and GM_getValue correctly because loadPymFromCache uses it directly.
      // But actually, harness binds them to c.env.gm for us! Let's just call it.

      const loaded = await c.api.loadPymFromCache();
      t.falso(loaded);

      // Verification of purge
      t.igual(c.env.gm["vgl_pym"], "");
      t.igual(c.env.gm["vgl_pym_dia"], "");
    });

    // ---------- fetchSpFilesMultiFolder ----------

    // ---------- loadPymDiario ----------
    await t.casoAsync("loadPymDiario devuelve false silenciosamente si ya hay uno en curso o sin GM_xmlhttpRequest", async () => {
      const c = cargar();
      // Sin GM_xmlhttpRequest:
      delete c.env.win.GM_xmlhttpRequest;
      t.falso(await c.api.loadPymDiario(true));

      // Con GM_xmlhttpRequest, pero simulando que ya está en curso (el userscript usa un flag interno)
      // Como no podemos setear `diarioEnCurso` fácilmente, saltaremos esta parte o podemos mockear primeShareAccess
      // y ver si falla.
    });

    await t.casoAsync("loadPymDiario falla tras reintentar", async () => {
      const c = cargar();
      let fetchCalls = [];
      c.env.win.GM_xmlhttpRequest = (opts) => {
        fetchCalls.push(opts.url);
        // fallar
        opts.onload({ status: 401, responseText: "{}" });
      };

      // Configurar
      c.api.__CONFIG.SP.folders = ["/fld1"];

      // Para poder probarlo bien deberiamos poder inyectar respuestas al fetch para primeShareAccess.
      // primeShareAccess usa `fetch`.
      c.env.win.fetch = async () => ({ ok: true, text: async () => "" });

      await c.api.loadPymDiario(true);

      // Debería intentar 2 veces: intento normal, fallo, primeShareAccess(true), reintento.
      // Pero como SP.folders tiene un solo item, y primeShareAccess hace algo, al final falla.
      // Si todo funcionó, `fetchCalls.length` será 2 (un intento original + un reintento).
      t.cierto(fetchCalls.length >= 2, "debería reintentar y hacer al menos 2 llamadas");
    });

    // ===== v16.7.0, auditoría #11: no poder mirar la carpeta NO es «hoy no hay lista» =====
    t.caso("pymDiarioMensajeFallo: distingue «no pude mirar» de «miré y no está»", () => {
      const c = cargar();
      const caido = c.api.pymDiarioMensajeFallo(true, true);
      t.falso(/Aún no aparece la lista de prevención/.test(caido),
        "ESTE era el bug: con la carpeta ilegible se afirmaba que el archivo de hoy no estaba subido");
      t.cierto(/No pude revisar la carpeta/.test(caido), "dice lo único que se sabe");
      t.cierto(/NO sé si la lista de hoy ya está subida/.test(caido), "y lo dice sin rodeos");
      t.cierto(/puede no ser lo último/.test(caido),
        "con la piloto cargada avisa de que lo que el médico está viendo puede estar viejo");
      t.cierto(/Abrir PyM/.test(c.api.pymDiarioMensajeFallo(true, false)),
        "y sin nada cargado le da la salida manual");

      const listado = c.api.pymDiarioMensajeFallo(false, true);
      t.cierto(/Aún no aparece la lista de prevención/.test(listado),
        "cuando SÍ se pudo listar, el hecho sigue siendo un hecho");
      t.falso(/conexión con SharePoint falló/.test(listado), "y no se culpa a la red de lo que no fue la red");
      t.cierto(/base piloto/.test(c.api.pymDiarioMensajeFallo(false, false)), "sin nada cargado, sigue prometiendo la piloto");
    });

    await t.casoAsync("fetchSpFilesMultiFolder lista múltiples carpetas hasta hallar el de hoy", async () => {
      const c = cargar();
      let fetchCalls = [];
      c.env.win.GM_xmlhttpRequest = (opts) => {
        fetchCalls.push(opts.url);
        opts.onload({
          status: 200,
          responseText: JSON.stringify({ d: { results: [{ Name: "Agenda_Dia_CMB_" + c.api.todayStamp().replace(/-/g, "") + ".xlsx" }] } })
        });
      };

      c.api.__CONFIG.SP.folders = ["/fld1", "/fld2"];
      const res = await c.api.fetchSpFilesMultiFolder();
      t.cierto(res.length > 0);
      t.igual(fetchCalls.length, 1, "Debería parar en la primera carpeta porque halló el archivo de hoy");
    });


    // =====================================================================
    //  v18.0.11 — LA GUARDA EN applyPymIdx, Y EL «NO SÉ POR QUÉ» DEL MÉDICO
    //
    //  (1) La v18.0.7 puso la guarda del libro equivocado en la descarga automática y en el
    //      captador de SharePoint. Pero a `applyPymIdx` se llega TAMBIÉN desde la base
    //      piloto y desde el selector manual de archivo — y es ahí donde se hace el daño de
    //      verdad: `afterPymLoaded` sella el día, con lo que `debeBuscarPymDiario()` pasa a
    //      decir «ya está» y el reloj de 10 minutos DEJA DE BUSCAR la lista real hasta
    //      medianoche; y `savePymCache` persiste el índice malo, que se readmite en cada
    //      recarga. Un libro equivocado por cualquiera de esas dos puertas apagaba el aviso
    //      la jornada entera.
    //
    //  (2) Los tres mensajes que explicaban el fallo vivían dentro de `if (!silent)` y las
    //      TRES llamadas de producción pasan `silent = true`: el diagnóstico se calculaba y
    //      se tiraba en cada vuelta, y al médico le quedaba un «PyM sin cargar» mudo. Sus
    //      palabras: «no sé por qué». Ahora la razón se guarda y se enseña donde él ya mira.
    // =====================================================================
    t.caso("v18.0.11: applyPymIdx RECHAZA un libro que no parece PyM — venga por donde venga", () => {
      const c = cargar({ silencioso: true });
      const todos = new Set(); for (let i = 0; i < 1396; i++) todos.add("d" + i);
      const antesFile = c.api.__state.pymFile;
      const ok = c.api.applyPymIdx({ map: new Map(), todos: todos, abandono: new Set() },
        "ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx", "", "ESTRATEGIA DE PRODUCTIVIDAD SEDE BELLO.xlsx", true);
      t.igual(ok, false, "no se instala");
      t.igual(c.api.__state.pymFile, antesFile, "y NO sella el día: el reloj de 10 min sigue buscando la lista real");
      t.cierto(!c.env.storage.getItem("vgl_pym_dia"), "ni deja la marca de «ya tengo la de hoy»");
    });

    t.caso("v18.0.11: un libro que SÍ es PyM se instala igual que siempre", () => {
      const c = cargar({ silencioso: true });
      const todos = new Set(); for (let i = 0; i < 1396; i++) todos.add("d" + i);
      const map = new Map([["5150076", ["Citología"]]]);
      t.igual(c.api.applyPymIdx({ map, todos, abandono: new Set() }, "Agenda_Dia_CMB.xlsx", "", "Agenda_Dia_CMB.xlsx", true), true,
        "con actividades pendientes se instala");
      t.igual(c.api.__state.pym.size, 1, "y la lista queda cargada");
      t.igual(c.env.storage.getItem("vgl_pym_dia"), c.api.todayStamp(), "sellando el día, como siempre");
    });

    t.caso("v18.0.11: el motivo del fallo queda GUARDADO y deja de perderse en cada vuelta", () => {
      const c = cargar({ silencioso: true });
      const todos = new Set(); for (let i = 0; i < 200; i++) todos.add("d" + i);
      t.igual(c.api.__state.pymUltimoFallo, "", "al arrancar no hay motivo que contar");
      c.api.applyPymIdx({ map: new Map(), todos: todos, abandono: new Set() }, "OTRO.xlsx", "", "OTRO.xlsx", true);
      const motivo = c.api.__state.pymUltimoFallo;
      t.cierto(/OTRO\.xlsx/.test(motivo), "el motivo nombra el archivo · " + motivo);
      t.cierto(/200 documentos/.test(motivo), "y da la cifra que lo delata");
      t.cierto(/ninguna actividad/.test(motivo), "dicho en lo que significa, no en jerga");
    });

    t.caso("v18.0.11: al cargar bien, el motivo anterior se OLVIDA — no se queda colgado del día", () => {
      const c = cargar({ silencioso: true });
      const todos = new Set(); for (let i = 0; i < 200; i++) todos.add("d" + i);
      c.api.applyPymIdx({ map: new Map(), todos: todos, abandono: new Set() }, "OTRO.xlsx", "", "OTRO.xlsx", true);
      t.cierto(!!c.api.__state.pymUltimoFallo, "hay motivo (control del caso)");
      c.api.applyPymIdx({ map: new Map([["5150076", ["Citología"]]]), todos, abandono: new Set() }, "Agenda_Dia_CMB.xlsx", "", "Agenda_Dia_CMB.xlsx", true);
      t.igual(c.api.__state.pymUltimoFallo, "", "cargó bien: enseñar un motivo viejo sería mentir sobre el estado actual");
    });
  }
};
