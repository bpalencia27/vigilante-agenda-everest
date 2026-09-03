// =====================================================================
//  SUITE 16 — Lectura en flujo del Excel PyM
//  Cubre la cadena completa: indexado incremental (makeIndexer /
//  indexRowsAsync), CSV plano (parseCSV), inflado por trozos (inflateRaw),
//  el lector de libros en streaming (_readPymWorkbookStreamCore), el
//  envoltorio con Web Worker simulado (readPymWorkbookStream), y la
//  aplicación del índice al estado (applyPymIdx / afterPymLoaded /
//  getActivities / pymFP / progreso).
//
//  Notas de entorno:
//   · Para inflateRaw y el lector de ZIP se inyectan las clases REALES de
//     Node (Blob, Response, DecompressionStream, TextDecoder) en el contexto
//     vm: Node 18+ las trae nativas, así que no se finge la descompresión.
//   · readPymWorkbookStream se prueba con un Worker FALSO controlado desde
//     la prueba: el harness recorta todos los setTimeout a 1 ms, lo que de
//     paso permite ver el watchdog anti-zombie disparándose de verdad.
//   · progreso() escribe en el panel SOLO si existe (el boot nunca corre en
//     las pruebas): su contrato observable aquí es "jamás lanza", que es
//     exactamente lo que protege el try/catch de producción.
// =====================================================================
const zlib = require("zlib");

// ZIP "stored" (método 0) construido a mano, suficiente para zipIndex/zipRead:
// mismo formato que usa la suite 07, replicado aquí para no depender de ella.
function crearZipPrueba(archivos) {
  const enc = new TextEncoder();
  const buffers = [];
  let lenNombres = 0, lenDatos = 0;
  for (const [name, content] of Object.entries(archivos)) {
    const nameBuf = enc.encode(name);
    const dataBuf = enc.encode(content);
    buffers.push({ nameBuf, dataBuf, offset: 0 });
    lenNombres += nameBuf.length;
    lenDatos += dataBuf.length;
  }
  const buf = new Uint8Array(1024 + lenNombres * 2 + lenDatos);
  const dv = new DataView(buf.buffer);
  let pos = 0;
  for (const b of buffers) {
    b.offset = pos;
    dv.setUint32(pos, 0x04034b50, true); pos += 4;   // firma local
    dv.setUint16(pos, 20, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;            // método 0 = sin comprimir
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
    dv.setUint32(pos, 0x02014b50, true); pos += 4;   // firma central
    dv.setUint16(pos, 20, true); pos += 2;
    dv.setUint16(pos, 20, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;
    dv.setUint16(pos, 0, true); pos += 2;            // método 0
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
  dv.setUint32(pos, 0x06054b50, true); pos += 4;     // EOCD
  dv.setUint16(pos, 0, true); pos += 2;
  dv.setUint16(pos, 0, true); pos += 2;
  dv.setUint16(pos, cdCount, true); pos += 2;
  dv.setUint16(pos, cdCount, true); pos += 2;
  dv.setUint32(pos, cdSize, true); pos += 4;
  dv.setUint32(pos, cdStart, true); pos += 4;
  dv.setUint16(pos, 0, true); pos += 2;
  return buf.buffer.slice(0, pos);
}

module.exports = {
  nombre: "Lectura en flujo del Excel PyM",
  cubre: [
    "getActivities", "makeIndexer", "indexRowsAsync", "parseCSV",
    "inflateRaw", "_readPymWorkbookStreamCore", "readPymWorkbookStream",
    "progreso", "afterPymLoaded", "pymFP", "applyPymIdx"
  ],

  async pruebas(t, api, env, cargar) {

    // =================================================================
    //  makeIndexer — indexado incremental fila a fila
    // =================================================================
    t.caso("makeIndexer: lanza si no hay columna con la identificación del paciente", () => {
      t.lanza(() => api.makeIndexer(["NOMBRE", "EDAD"]), "sin columna de documento debía lanzar");
    });

    t.caso("makeIndexer: solo guarda en el mapa a quien tiene pendientes; 'todos' registra a todo el mundo; sin etiquetas duplicadas", () => {
      const ix = api.makeIndexer(["DOCUMENTO", "TAMIZACION_CMB", "VALORACION_INTEGRAL"]);
      ix.push(["123", "Susceptible", ""]);
      ix.push(["123", "Susceptible", "Pendiente"]);   // CMB repetido: no debe duplicarse
      ix.push(["", "Susceptible", ""]);               // sin documento: se ignora entera
      ix.push(["555", "", ""]);                       // al día: entra en todos, no en map
      t.igual(ix.map.size, 1, "solo un paciente con pendientes");
      t.igual(ix.map.get("123"), ["Tamización cardiometabólica", "Valoración integral de salud"]);
      t.igual(Array.from(ix.todos).sort(), ["123", "555"]);
    });

    t.caso("makeIndexer: ABANDONADOS_PES 'Si'/'Sí' alimenta el conjunto de abandono y no genera chip de actividad", () => {
      const ix = api.makeIndexer(["CEDULA", "ABANDONADOS_PES"]);
      ix.push(["1", "Si"]);
      ix.push(["2", "Sí"]);       // con tilde también cuenta
      ix.push(["3", "No"]);
      ix.push(["4", "Sin dato"]); // NO empieza por "si" exacto: no cuenta
      ix.push(["5", ""]);
      t.igual(Array.from(ix.abandono).sort(), ["1", "2"]);
      t.igual(ix.map.size, 0, "la columna de abandono nunca produce actividades");
      t.igual(ix.todos.size, 5);
      // Nombre viejo de la columna (base anterior): mismo comportamiento
      const ixViejo = api.makeIndexer(["CEDULA", "ABANDONADO_PES"]);
      ixViejo.push(["9", "Si"]);
      t.cierto(ixViejo.abandono.has("9"), "ABANDONADO_PES (singular) también debe reconocerse");
    });

    t.caso("makeIndexer: exclusiones de CONFIG (VDRL fuera) pero VIH siempre se conserva", () => {
      const ix = api.makeIndexer(["DOCUMENTO", "TAMIZACION_VDRL", "TAMIZACION_VIH"]);
      ix.push(["777", "Susceptible", "Susceptible"]);
      t.igual(ix.map.get("777"), ["VIH"], "VDRL debía filtrarse y VIH quedarse");
    });

    t.caso("makeIndexer: PRUEBA_CERVIX se funde en el chip de TAMIZACION_CERVIX con el tipo de prueba", () => {
      const ix = api.makeIndexer(["DOCUMENTO", "TAMIZACION_CERVIX", "PRUEBA_CERVIX"]);
      ix.push(["888", "Susceptible", "Tamizar con VPH"]);
      t.igual(ix.map.get("888"), ["Cáncer de cuello uterino — VPH"], "un solo chip con el detalle VPH");
      // Caso raro: el tipo viene pendiente pero la tamización no — no se pierde
      ix.push(["999", "", "Tamizar con CCU"]);
      t.igual(ix.map.get("999"), ["Cáncer de cuello uterino — citología cervicouterina"]);
    });

    // =================================================================
    //  indexRowsAsync — misma lógica para tablas ya materializadas (CSV)
    // =================================================================
    await t.casoAsync("indexRowsAsync: devuelve {map, todos, abandono} equivalente al indexador incremental", async () => {
      const res = await api.indexRowsAsync(
        ["NRO_DOCUMENTO", "TAMIZACION_MAMA"],
        [["11", "Susceptible"], ["22", ""]]
      );
      t.igual(res.map.get("11"), ["Mamografía"]);
      t.falso(res.map.has("22"), "el paciente al día no entra en el mapa");
      t.igual(Array.from(res.todos).sort(), ["11", "22"]);
      t.igual(res.abandono.size, 0);
    });

    await t.casoAsync("indexRowsAsync: cede el hilo cada 1024 filas cuando recibe maybeYield", async () => {
      let cesiones = 0;
      const filas = Array.from({ length: 1025 }, (_, i) => [String(100000 + i), "Susceptible"]);
      const res = await api.indexRowsAsync(["DOCUMENTO", "TAMIZACION_CMB"], filas, async () => { cesiones++; });
      t.igual(cesiones, 2, "debía ceder en la fila 0 y en la 1024");
      t.igual(res.map.size, 1025);
    });

    // =================================================================
    //  parseCSV — v18.0.45: EL «SEPARADOR INGENUO A PROPÓSITO» BORRABA PACIENTES
    //
    //  Hallazgo del enjambre de funciones (01-sep), gravedad alta, reproducido con el
    //  arnés. Esta prueba decía «NO interpreta comillas» como si fuera una decisión, y
    //  clavaba el resultado roto (`a,"b,c"` -> `["a", '"b', 'c"']`) para que nadie lo
    //  cambiara. Pero el efecto real no era cosmético: un apellido escrito `"Pérez, Juan"`
    //  —lo que produce Excel al exportar cualquier campo con coma— corría todas las
    //  columnas siguientes un puesto, la del documento devolvía el texto equivocado, y el
    //  paciente NO entraba ni en `map` ni en `todos`. Y como tampoco estaba en `todos`, el
    //  panel le decía al médico que ese paciente «NO aparece en la lista de prevención de
    //  hoy»: un fallo del lector presentado como un hecho sobre el paciente.
    //
    //  Un comentario que llama «a propósito» a un defecto es peor que el defecto: convierte
    //  la prueba en su guardaespaldas. Ahora se lee CSV de verdad.
    //  (Todos los identificadores de esta prueba son sintéticos.)
    // =================================================================
    t.caso("parseCSV: separa líneas y columnas, quita \\r y filtra líneas vacías", () => {
      t.igual(api.parseCSV("DOC,ACT\r\n123,Susceptible\n\n   \n456,\n"),
        [["DOC", "ACT"], ["123", "Susceptible"], ["456", ""]]);
    });

    t.caso("parseCSV: una coma DENTRO de comillas ya no parte la fila ni borra al paciente", () => {
      t.igual(api.parseCSV('a,"b,c"'), [["a", "b,c"]],
        "el campo entrecomillado llega entero y sin las comillas");
      // El caso que motivó el hallazgo, de punta a punta.
      const filas = api.parseCSV('NOMBRE,DOCUMENTO,ACT\n"Apellido, Nombre",111111,Susceptible\nOtro Paciente,222222,Susceptible');
      t.igual(filas.length, 3, "las tres filas siguen siendo tres");
      t.igual(filas[1].length, 3, "y la del apellido con coma tiene TRES columnas, no cuatro");
      t.igual(filas[1][1], "111111", "así que la columna del documento sigue siendo la del documento");
    });

    t.caso("parseCSV: comillas escapadas, saltos de línea dentro del campo y comillas sueltas", () => {
      t.igual(api.parseCSV('"con ""comillas"" dentro",X'), [['con "comillas" dentro', "X"]],
        "las comillas duplicadas son una comilla literal, como en Excel");
      t.igual(api.parseCSV('"salto\nde linea",X'), [["salto\nde linea", "X"]],
        "un salto de línea dentro de un campo entrecomillado no parte la fila (el split por \\n de antes no podía)");
      t.igual(api.parseCSV('normal,3" pulgadas,fin'), [["normal", '3" pulgadas', "fin"]],
        "una comilla suelta a media celda se conserva literal: solo abre campo si está al principio");
    });

    // =================================================================
    //  inflateRaw — descompresión deflate-raw real (clases nativas de Node)
    // =================================================================
    // Instancia dedicada con las clases web REALES inyectadas en el contexto vm.
    const cz = cargar({ silencioso: true });
    cz.ctx.TextDecoder = TextDecoder;
    cz.ctx.TextEncoder = TextEncoder;
    cz.ctx.Blob = Blob;
    cz.ctx.Response = Response;
    cz.ctx.DecompressionStream = typeof DecompressionStream !== "undefined" ? DecompressionStream : null;

    let nativeDeflateRaw = true;
    if (cz.ctx.DecompressionStream) {
      try { new cz.ctx.DecompressionStream('deflate-raw'); } catch (e) { nativeDeflateRaw = false; }
    } else {
      nativeDeflateRaw = false;
    }

    if (!nativeDeflateRaw) {
      const zlib = require('zlib');
      cz.ctx.DecompressionStream = class MockDecompressionStream {
        constructor(format) {
          if (format !== 'deflate-raw') throw new TypeError(`Unsupported format: ${format}`);
          let buf = Buffer.alloc(0);
          this.writable = new WritableStream({
            write(chunk) { buf = Buffer.concat([buf, chunk]); }
          });
          this.readable = new ReadableStream({
            start(controller) {
              setTimeout(() => {
                let decompressed;
                try {
                   decompressed = zlib.inflateRawSync(buf);
                } catch(e) {
                   // Ignore Z_BUF_ERROR or incomplete buffer
                   decompressed = zlib.inflateRawSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
                }
                let offset = 0;
                let closed = false;

                const pushChunk = () => {
                  if (closed) return;
                  if (offset >= decompressed.length) {
                     try { controller.close(); } catch(e){}
                     closed = true;
                     return;
                  }
                  const chunkLen = Math.min(1024, decompressed.length - offset);
                  try {
                    controller.enqueue(new Uint8Array(decompressed.buffer, decompressed.byteOffset + offset, chunkLen));
                  } catch(e) {
                    closed = true;
                    return;
                  }
                  offset += chunkLen;
                  setTimeout(pushChunk, 0);
                };
                setTimeout(pushChunk, 10);
              }, 100);
            },
            cancel() {
              // Gracefully handle cancel
            }
          });
        }
      };
    }

    const textoBase = "El Vigilante lee la base PyM por trozos, sin congelar la consulta. ".repeat(8000);
    const bytesOriginales = new TextEncoder().encode(textoBase);
    const comprimido = zlib.deflateRawSync(Buffer.from(bytesOriginales));

    await t.casoAsync("inflateRaw: descomprime deflate-raw completo y devuelve los bytes exactos", async () => {
      const res = await cz.api.inflateRaw(comprimido);
      t.igual(res.length, bytesOriginales.length);
      const vuelto = Buffer.from(res.buffer, res.byteOffset, res.byteLength);
      t.cierto(vuelto.equals(Buffer.from(bytesOriginales)), "los bytes inflados deben ser idénticos al original");
    });

    await t.casoAsync("inflateRaw con tope: entrega al menos maxBytes como prefijo fiel SIN inflar el archivo entero", async () => {
      const res = await cz.api.inflateRaw(comprimido, 1000);
      t.cierto(res.length >= 1000, "debe cubrir al menos el tope pedido");
      t.cierto(res.length < bytesOriginales.length, "no debía descomprimir los ~540 KB completos");
      const prefijo = Buffer.from(res.buffer, res.byteOffset, res.byteLength);
      t.cierto(prefijo.equals(Buffer.from(bytesOriginales.subarray(0, res.length))), "lo entregado es prefijo exacto del original");
    });

    // =================================================================
    //  _readPymWorkbookStreamCore — libro completo en memoria, sin fingir nada
    // =================================================================
    await t.casoAsync("_readPymWorkbookStreamCore: elige la hoja por CONTENIDO, halla el encabezado en la fila 2 e indexa en flujo", async () => {
      // Libro con 2 hojas: "Portada" (basura, va PRIMERA) y "Datos" (la base real).
      // La hoja buena trae título antes del encabezado, sharedStrings, inlineStr,
      // celdas saltadas y la columna ABANDONADOS_PES.
      const sst = "<sst><si><t>BASE PYM SEDE BELLO</t></si><si><t>NRO_IDENTIFICACION</t></si>" +
        "<si><t>TAMIZACION_VIH</t></si><si><t>AGUDEZA_VISUAL</t></si><si><t>ABANDONADOS_PES</t></si>" +
        "<si><t>Susceptible</t></si><si><t>Pendiente</t></si><si><t>No</t></si><si><t>Si</t></si><si><t>Al dia</t></si></sst>";
      const hojaDatos = "<worksheet><sheetData>" +
        '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c><c r="D2" t="s"><v>4</v></c></row>' +
        '<row r="3"><c r="A3"><v>100200300</v></c><c r="B3" t="s"><v>5</v></c><c r="D3" t="s"><v>7</v></c></row>' +
        '<row r="4"><c r="A4" t="inlineStr"><is><t>0004005006</t></is></c><c r="C4" t="s"><v>6</v></c><c r="D4" t="s"><v>8</v></c></row>' +
        '<row r="5"><c r="A5"><v>700800900</v></c><c r="B5" t="s"><v>9</v></c><c r="C5" t="s"><v>9</v></c><c r="D5" t="s"><v>7</v></c></row>' +
        "</sheetData></worksheet>";
      const zBuffer = crearZipPrueba({
        "xl/workbook.xml": '<workbook><sheets><sheet name="Portada" sheetId="1" r:id="rId1"/><sheet name="Datos" sheetId="2" r:id="rId2"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
        "xl/sharedStrings.xml": sst,
        "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>PORTADA</t></is></c></row></sheetData></worksheet>',
        "xl/worksheets/sheet2.xml": hojaDatos,
      });
      const res = await cz.api._readPymWorkbookStreamCore(zBuffer);
      t.igual(res.sheetName, "Datos", "debía saltarse la Portada aunque va primera");
      t.igual(res.sheets, ["Portada", "Datos"]);
      t.igual(res.headers, ["NRO_IDENTIFICACION", "TAMIZACION_VIH", "AGUDEZA_VISUAL", "ABANDONADOS_PES"]);
      t.igual(res.rowCount, 5, "título + encabezado + 3 filas de datos");
      t.igual(res.map.get("100200300"), ["VIH"]);
      // La cédula inlineStr "0004005006" pierde los ceros a la izquierda al normalizar
      t.igual(res.map.get("4005006"), ["Agudeza visual"]);
      t.falso(res.map.has("700800900"), "el paciente al día no entra en el mapa");
      t.igual(Array.from(res.todos).sort(), ["100200300", "4005006", "700800900"]);
      t.igual(Array.from(res.abandono), ["4005006"], "el 'Si' de ABANDONADOS_PES debía registrarse");
    });

    await t.casoAsync("_readPymWorkbookStreamCore: libro sin hojas legibles lanza con mensaje claro", async () => {
      const zBuffer = crearZipPrueba({ "docProps/core.xml": "<x/>" });
      let msg = "";
      try { await cz.api._readPymWorkbookStreamCore(zBuffer); } catch (e) { msg = e.message; }
      t.cierto(msg.includes("hojas"), "esperaba el error de libro sin hojas y llegó: " + msg);
    });

    await t.casoAsync("_readPymWorkbookStreamCore: hoja sin fila de encabezados lanza", async () => {
      const zBuffer = crearZipPrueba({ "xl/worksheets/sheet1.xml": "<worksheet><sheetData></sheetData></worksheet>" });
      let msg = "";
      try { await cz.api._readPymWorkbookStreamCore(zBuffer); } catch (e) { msg = e.message; }
      t.cierto(msg.includes("encabezados"), "esperaba el error de encabezados y llegó: " + msg);
    });

    // =================================================================
    //  readPymWorkbookStream — envoltorio del Web Worker (Worker simulado)
    //  El harness recorta los setTimeout a 1 ms: el watchdog de 90 s se
    //  dispara casi al instante, lo que permite probarlo de verdad.
    // =================================================================
    const cw = cargar({ silencioso: true });
    let revocaciones = 0;
    cw.ctx.URL = { createObjectURL: () => "blob:falso", revokeObjectURL: () => { revocaciones++; } };
    function workerFalso(comportamiento) {
      return function FalsoWorker() {
        this.onmessage = null; this.onerror = null; this.terminado = false;
        this.terminate = () => { this.terminado = true; };
        this.postMessage = (datos) => { comportamiento(this, datos); };
        workerFalso.ultimo = this;
      };
    }

    await t.casoAsync("readPymWorkbookStream: resuelve con el resultado de 'done', pasa por 'progress' y limpia (terminate + revoke)", async () => {
      const antes = revocaciones;
      cw.ctx.Worker = workerFalso((w) => {
        w.onmessage({ data: { type: "progress", msg: "Leyendo «Datos»…" } });   // ejercita la rama que llama a progreso()
        w.onmessage({ data: { type: "done", result: { sheetName: "Datos", rowCount: 3 } } });
      });
      const res = await cw.api.readPymWorkbookStream(new ArrayBuffer(8));
      t.igual(res.sheetName, "Datos");
      t.igual(res.rowCount, 3);
      t.cierto(workerFalso.ultimo.terminado, "el worker debe terminarse al resolver");
      t.igual(revocaciones, antes + 1, "la URL del blob debe revocarse exactamente una vez");
    });

    await t.casoAsync("readPymWorkbookStream: un 'error' del worker rechaza conservando el mensaje original", async () => {
      cw.ctx.Worker = workerFalso((w) => {
        w.onmessage({ data: { type: "error", error: "columna perdida", stack: "traza-falsa" } });
      });
      let msg = "";
      try { await cw.api.readPymWorkbookStream(new ArrayBuffer(8)); } catch (e) { msg = e.message; }
      t.igual(msg, "columna perdida");
      t.cierto(workerFalso.ultimo.terminado, "el worker debe terminarse también al fallar");
    });

    await t.casoAsync("readPymWorkbookStream: onerror (crash del worker) rechaza con el aviso de segundo plano", async () => {
      cw.ctx.Worker = workerFalso((w) => { w.onerror({ message: "crash total" }); });
      let msg = "";
      try { await cw.api.readPymWorkbookStream(new ArrayBuffer(8)); } catch (e) { msg = e.message; }
      t.cierto(msg.includes("segundo plano"), "esperaba el mensaje de fondo y llegó: " + msg);
      t.cierto(msg.includes("crash total"), "debe conservar el detalle del crash");
    });

    await t.casoAsync("readPymWorkbookStream: el watchdog anti-zombie rechaza y termina un worker mudo", async () => {
      cw.ctx.Worker = workerFalso(() => { /* nunca responde */ });
      let msg = "";
      try { await cw.api.readPymWorkbookStream(new ArrayBuffer(8)); } catch (e) { msg = e.message; }
      t.cierto(msg.includes("excedió el tiempo límite"), "esperaba el rechazo del watchdog y llegó: " + msg);
      t.cierto(workerFalso.ultimo.terminado, "el watchdog debe terminar el worker colgado");
    });

    await t.casoAsync("readPymWorkbookStream: si postMessage lanza (transferencia fallida), rechaza y limpia", async () => {
      cw.ctx.Worker = workerFalso(() => { throw new Error("no se pudo transferir"); });
      let msg = "";
      try { await cw.api.readPymWorkbookStream(new ArrayBuffer(8)); } catch (e) { msg = e.message; }
      t.igual(msg, "no se pudo transferir");
      t.cierto(workerFalso.ultimo.terminado);
    });

    // =================================================================
    //  progreso — aviso de avance que JAMÁS debe romper la carga
    // =================================================================
    t.caso("progreso: nunca lanza — ni sin panel construido, ni con PyM ya cargado, ni con el estado roto", () => {
      const c = cargar({ silencioso: true });
      // Sin panel (el boot no corre en pruebas): setSummary no tiene dónde escribir
      t.noLanza(() => c.api.progreso("Leyendo la base…"));
      // Con un PyM ya cargado toma la rama que NO escribe el resumen
      c.api.__state.pymFile = "base.xlsx";
      t.noLanza(() => c.api.progreso("esto ya no debería mostrarse"));
      // Estado saboteado: leer pymFile explota, y el try/catch lo traga
      const c2 = cargar({ silencioso: true });
      Object.defineProperty(c2.api.__state, "pymFile", { get() { throw new Error("estado roto"); } });
      t.noLanza(() => c2.api.progreso("con estado roto tampoco"));
    });

    // =================================================================
    //  getActivities — cruce por cédula normalizada
    // =================================================================
    t.caso("getActivities: cruza la cédula normalizando ceros, '.0' de Excel y notación científica", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.pym = new Map([
        ["5150076", ["Tamización de VIH"]],
        ["1234570000", ["Valoración integral de salud"]],
      ]);
      t.igual(c.api.getActivities("0005150076"), ["Tamización de VIH"], "cédula rellenada con ceros");
      t.igual(c.api.getActivities("5150076.0"), ["Tamización de VIH"], "cola .0 de celda numérica");
      t.igual(c.api.getActivities("1.23457E+9"), ["Valoración integral de salud"], "notación científica de Excel");
      t.igual(c.api.getActivities("99999"), [], "desconocido devuelve lista vacía");
      t.igual(c.api.getActivities(null), [], "nulo devuelve lista vacía");
    });

    // =================================================================
    //  afterPymLoaded — recruza el último snapshot con la base recién cargada
    // =================================================================
    t.caso("afterPymLoaded: fija pymFile, invalida la firma y recruza el pym de cada cita del snapshot", () => {
      const c = cargar({ silencioso: true });
      c.api.__state.pym = new Map([["777", ["Tamización de próstata"]]]);
      c.api.__state.lastSnapshot = { at: null, list: [{ doc_id: "777" }, { doc_id: "42" }] };
      c.api.__state.lastSignature = "firma-vieja";
      c.api.afterPymLoaded("Agenda_Dia_CMB_20260810.xlsx");
      t.igual(c.api.__state.pymFile, "Agenda_Dia_CMB_20260810.xlsx");
      t.igual(c.api.__state.lastSignature, "", "la firma debe invalidarse para forzar repintado");
      t.igual(c.api.__state.lastSnapshot.list[0].pym, ["Tamización de próstata"]);
      t.igual(c.api.__state.lastSnapshot.list[1].pym, [], "cita sin PyM queda con lista vacía, no undefined");
    });

    // =================================================================
    //  pymFP — huella nombre|fecha-de-modificación
    // =================================================================
    t.caso("pymFP: concatena nombre y mtime con '|' y aguanta nulos", () => {
      t.igual(api.pymFP("Base.xlsx", "2026-08-10T05:00:00Z"), "Base.xlsx|2026-08-10T05:00:00Z");
      t.igual(api.pymFP(null, undefined), "|");
      t.igual(api.pymFP("solo.xlsx"), "solo.xlsx|");
    });

    // =================================================================
    //  applyPymIdx — aplica un índice ya construido al estado
    // =================================================================
    t.caso("applyPymIdx: aplica el índice, arma la huella con el nombre CRUDO y marca el día en localStorage", () => {
      const c = cargar({ silencioso: true });
      const idx = {
        map: new Map([["111", ["Tamización de VIH"]]]),
        todos: new Set(["111", "222"]),
        abandono: new Set(["222"]),
      };
      c.api.__state.lastSnapshot = { at: null, list: [{ doc_id: "111" }, { doc_id: "333" }] };
      c.api.applyPymIdx(idx, "Base.xlsx (PyM de hoy)", "2026-08-10T05:00:00Z", "Base.xlsx");
      t.cierto(c.api.__state.pym === idx.map, "el mapa se aplica por referencia, sin copiar");
      t.cierto(c.api.__state.pymTodos === idx.todos);
      t.cierto(c.api.__state.pymAbandono === idx.abandono);
      t.igual(c.api.__state.pymMTime, "2026-08-10T05:00:00Z");
      // La huella usa el nombre crudo (para cruzar con SharePoint), no el decorado
      t.igual(c.api.__state.pymFP, "Base.xlsx|2026-08-10T05:00:00Z");
      t.igual(c.api.__state.pymFile, "Base.xlsx (PyM de hoy)", "el nombre mostrado sí lleva la etiqueta");
      t.igual(c.api.__state.lastSnapshot.list[0].pym, ["Tamización de VIH"], "afterPymLoaded recruza el snapshot");
      t.igual(c.env.almacen["vgl_pym_dia"], c.api.todayStamp(), "la clave diminuta del día debe quedar escrita");
    });

    t.caso("applyPymIdx: sin abandono ni mtime — Set vacío de respaldo y huella con cola vacía", () => {
      const c = cargar({ silencioso: true });
      const idx = { map: new Map(), todos: new Set() };   // índice de un CSV manual: sin abandono
      c.api.applyPymIdx(idx, "manual.csv");
      t.igual(c.api.__state.pymAbandono.size, 0, "debe caer a un Set vacío, no a undefined");
      t.cierto(typeof c.api.__state.pymAbandono.has === "function");
      t.igual(c.api.__state.pymMTime, "");
      t.igual(c.api.__state.pymFP, "manual.csv|");
    });
  }
};
