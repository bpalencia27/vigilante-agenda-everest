module.exports = {
  nombre: "Lector de Excel (ZIP/XLSX)",
  cubre: [
    "zipIndex", "zipRead", "colToIdx", "unescXml",
    "parseSharedStringsStream", "parseRowBody",
    "scanSheetRows", "sheetOrder", "scoreSheet", "findDocIdx"
  ],

  async pruebas(t, api, env, cargar) {
    const { TextDecoder, TextEncoder } = require("util");
    const c = cargar();
    c.ctx.TextDecoder = TextDecoder;
    c.ctx.TextEncoder = TextEncoder;
    api = c.api;

    t.caso("colToIdx: convierte referencia de columna a índice (A1->0, Z9->25, AA1->26, basura->-1)", () => {
      t.igual(api.colToIdx("A1"), 0);
      t.igual(api.colToIdx("B2"), 1);
      t.igual(api.colToIdx("Z9"), 25);
      t.igual(api.colToIdx("AA1"), 26);
      t.igual(api.colToIdx("AB1"), 27);
      t.igual(api.colToIdx("ZZ99"), 701);
      t.igual(api.colToIdx("basura"), -1);
      t.igual(api.colToIdx(""), -1);
      t.igual(api.colToIdx(null), -1);
    });

    t.caso("unescXml: desenmascara entidades XML básicas", () => {
      t.igual(api.unescXml("a &amp; b"), "a & b");
      t.igual(api.unescXml("&lt;tag&gt;"), "<tag>");
      t.igual(api.unescXml("&quot;hola&quot;"), '"hola"');
      t.igual(api.unescXml("&apos;hola&apos;"), "'hola'");
    });

    t.caso("unescXml: falla con null como dice el contrato (lanza TypeError)", () => {
      t.lanza(() => api.unescXml(null), "se esperaba TypeError por null");
    });

    t.caso("scoreSheet: asigna puntaje correcto a la hoja que parece la base PyM", () => {
      const filasBuenas = [
        ["", "", ""],
        ["NRO_IDENTIFICACION", "Actividades", "Susceptible"],
        ["123", "PAP", "SI"]
      ];
      const filasMalas = [
        ["A", "B", "C"],
        ["1", "2", "3"]
      ];
      t.cierto(api.scoreSheet(filasBuenas).score > api.scoreSheet(filasMalas).score, "La hoja buena debe tener mayor puntaje");
    });

    t.caso("sheetOrder: cruza workbook.xml con relsXml (fallback o normal)", () => {
      const wbXml = `<workbook><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/><sheet name="Hoja2" sheetId="2" r:id="rId2"/></sheets></workbook>`;
      const relsXml = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`;
      const ord = api.sheetOrder(wbXml, relsXml);
      t.igual(ord[0], { name: "Hoja1", path: "xl/worksheets/sheet1.xml" });
      t.igual(ord[1], { name: "Hoja2", path: "xl/worksheets/sheet2.xml" });

      const wbSinRels = `<workbook><sheets><sheet name="Hoja1" sheetId="1" /><sheet name="Hoja2" sheetId="2" /></sheets></workbook>`;
      const ord2 = api.sheetOrder(wbSinRels, null);
      t.igual(ord2, []);
    });

    t.caso("findDocIdx: encuentra la columna de documento de identidad pac", () => {
      t.igual(api.findDocIdx(["NADA", "DOCUMENTO PACIENTE", "OTRO"]), 1);
      t.igual(api.findDocIdx(["NADA", "NRO_IDENTIFICACION", "OTRO"]), 1);
      t.igual(api.findDocIdx(["NADA", "DOCUMENTO", "OTRO"]), 1);
      t.igual(api.findDocIdx(["A", "B", "C"]), -1);
    });

    // Esta prueba vivió rota y en silencio (se llamaba sin await y `pruebas()` cerraba
    // antes de que resolviera). Tenía tres defectos que solo se vieron al ejecutarla:
    //  1) stubeaba `api.zipRead`, que NO intercepta nada: parseSharedStringsStream llama a
    //     zipRead/zipEntryChunks por clausura dentro del IIFE, no a través del objeto
    //     exportado. Se le pasa un ZIP de verdad, construido con crearZipPrueba.
    //  2) pasaba `false` como `maybeYield`, y el cuerpo hace `await maybeYield()`.
    //  3) al lanzar antes de su línea de restauración, dejaba `api.zipRead` pisado y
    //     tumbaba de rebote la prueba de zipRead de más abajo.
    await t.casoAsync("parseSharedStringsStream: concatena trozos de texto de strings compartidas", async () => {
      const zBuffer = crearZipPrueba({
        "xl/sharedStrings.xml": `<sst><si><t>Texto 1</t></si><si><r><t>Texto </t></r><r><t>Partido</t></r></si></sst>`,
      });
      const zip = api.zipIndex(zBuffer);
      const shared = await api.parseSharedStringsStream(zip, async () => {});
      t.igual(shared[0], "Texto 1");
      t.igual(shared[1], "Texto Partido", "los <r> partidos de una misma <si> se concatenan en un solo texto");
    });

    await t.casoAsync("parseSharedStringsStream: un libro sin xl/sharedStrings.xml devuelve lista vacía, no lanza", async () => {
      const zip = api.zipIndex(crearZipPrueba({ "hoja.xml": "<x/>" }));
      const shared = await api.parseSharedStringsStream(zip, async () => {});
      t.igual(shared, []);
    });

    t.caso("parseRowBody: lee celdas tipo s, en linea, y vacías", () => {
      const rowXml = `<row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1"><v>123</v></c><c r="D1" t="inlineStr"><is><t>inline</t></is></c></row>`;
      const shared = ["Cero", "Compartido"];
      const row = api.parseRowBody(rowXml, shared);

      t.igual(row[0], "Compartido");
      t.igual(row[1], "123");
      t.igual(row[2], "");
      t.igual(row[3], "inline");
    });

    t.caso("scanSheetRows: recorre filas limitadas por maxRows", () => {
      const sheetXml = `<worksheet><sheetData><row r="1"><c r="A1"><v>10</v></c></row><row r="2"><c r="A2"><v>20</v></c></row></sheetData></worksheet>`;
      const rows = api.scanSheetRows(sheetXml, [], 1);
      t.igual(rows.length, 1);
      t.igual(rows[0][0], "10");
    });

    function crearZipPrueba(archivos) {
      let lenNombres = 0;
      let lenDatos = 0;
      const dec = new TextEncoder();
      const buffers = [];
      for (const [name, content] of Object.entries(archivos)) {
        const nameBuf = dec.encode(name);
        const dataBuf = dec.encode(content);
        buffers.push({name, nameBuf, dataBuf, offset: 0});
        lenNombres += nameBuf.length;
        lenDatos += dataBuf.length;
      }
      const buf = new Uint8Array(1024 + lenNombres * 2 + lenDatos);
      const dv = new DataView(buf.buffer);
      let pos = 0;
      for (const b of buffers) {
        b.offset = pos;
        dv.setUint32(pos, 0x04034b50, true); pos += 4;
        dv.setUint16(pos, 20, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint32(pos, 0, true); pos += 4;
        dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
        dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
        dv.setUint16(pos, b.nameBuf.length, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        buf.set(b.nameBuf, pos); pos += b.nameBuf.length;
        buf.set(b.dataBuf, pos); pos += b.dataBuf.length;
      }
      const cdStart = pos;
      let cdCount = 0;
      for (const b of buffers) {
        dv.setUint32(pos, 0x02014b50, true); pos += 4;
        dv.setUint16(pos, 20, true); pos += 2;
        dv.setUint16(pos, 20, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint32(pos, 0, true); pos += 4;
        dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
        dv.setUint32(pos, b.dataBuf.length, true); pos += 4;
        dv.setUint16(pos, b.nameBuf.length, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint16(pos, 0, true); pos += 2;
        dv.setUint32(pos, 0, true); pos += 4;
        dv.setUint32(pos, b.offset, true); pos += 4;
        buf.set(b.nameBuf, pos); pos += b.nameBuf.length;
        cdCount++;
      }
      const cdSize = pos - cdStart;
      dv.setUint32(pos, 0x06054b50, true); pos += 4;
      dv.setUint16(pos, 0, true); pos += 2;
      dv.setUint16(pos, 0, true); pos += 2;
      dv.setUint16(pos, cdCount, true); pos += 2;
      dv.setUint16(pos, cdCount, true); pos += 2;
      dv.setUint32(pos, cdSize, true); pos += 4;
      dv.setUint32(pos, cdStart, true); pos += 4;
      dv.setUint16(pos, 0, true); pos += 2;
      return buf.buffer.slice(0, pos);
    }

    t.caso("zipIndex: lanza si no es un ZIP válido", () => {
      const fake = new ArrayBuffer(100);
      t.lanza(() => api.zipIndex(fake), "Esperaba error sobre formato");
    });

    t.caso("zipIndex: indexa múltiples archivos correctamente en ZIP en memoria", () => {
      const zBuffer = crearZipPrueba({
        "xl/worksheets/sheet1.xml": "<worksheet></worksheet>",
        "xl/sharedStrings.xml": "<sst></sst>"
      });
      const z = api.zipIndex(zBuffer);
      t.cierto(!!z.files["xl/worksheets/sheet1.xml"], "Debe tener sheet1.xml");
      t.cierto(!!z.files["xl/sharedStrings.xml"], "Debe tener sharedStrings.xml");
      t.igual(z.files["xl/sharedStrings.xml"].method, 0, "Debe ser method 0 (stored)");
    });

    await t.casoAsync("zipRead: lee contenido no comprimido (method 0)", async () => {
      const zBuffer = crearZipPrueba({
        "hoja.xml": "CONTENIDO HOJA XML"
      });
      const z = api.zipIndex(zBuffer);
      const res = await api.zipRead(z, "hoja.xml");
      t.igual(res, "CONTENIDO HOJA XML");

      const resNada = await api.zipRead(z, "no_existe.xml");
      t.igual(resNada, null, "Archivo inexistente devuelve null");
    });
  }
};
