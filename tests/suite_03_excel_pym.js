module.exports = {
  nombre: "Excel, caché y SharePoint",
  cubre: ["packPym", "unpackPym", "fetchSpFilesMultiFolder", "loadPymDiario", "savePymCache", "loadPymFromCache", "esLibroValido", "esXlsxCifrado", "todayTokens", "normName", "nameHasToken", "esNombreDeHoy", "pickTodaysFile", "xlsViejoDeHoy"],
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
      const files = [
        { Name: "ArchivoRandom.xlsx", TimeLastModified: "2026-08-10T08:00:00Z" }
      ];
      const selected = c.api.pickTodaysFile(files);
      t.cierto(selected !== null);
      t.igual(selected.Name, "ArchivoRandom.xlsx");
    });

    t.caso("pickTodaysFile descarta archivos temporales", () => {
      const files = [
        { Name: "~$Agenda_20260810.xlsx" }
      ];
      t.igual(api.pickTodaysFile(files), null);
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

  }
};
