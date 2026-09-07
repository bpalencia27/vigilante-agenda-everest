// =====================================================================
//  DIAGNÓSTICO — ANÁLISIS COMPARATIVO: BASE PILOTO (SEP) vs AGENDA DÍA — v2
//
//  Para qué: migrar el Vigilante a la base "BASE PILOTO DE CONSULTA
//  BELLO SEPTIEMBRE1.xlsx" como FUENTE ÚNICA (adiós al Agenda_Dia_CMB
//  diario). Este diagnóstico entrega la estructura de AMBOS archivos
//  (hojas, columnas, conteos, tipos, compatibilidad con el lector PyM)
//  SIN sacar ningún dato de paciente de SharePoint.
//
//  Dónde: en una pestaña de SHAREPOINT ya iniciada
//  (viva1aips-my.sharepoint.com) — puede ser la del propio enlace del
//  archivo. F12 → Consola → pegar todo → Enter. Tarda unos segundos
//  (descarga los dos libros completos).
//
//  REDACCIÓN (regla del proyecto: CERO PHI): NUNCA imprime nombres,
//  cédulas ni valores identificables. Columnas documento/nombre/tel/
//  mail/dirección: solo conteos. Otras: valores distintos solo si son
//  cortos y SIN dígitos ("Susceptible", "No"…). Números: solo mín/máx.
//
//  SOLO LECTURA: no escribe nada en SharePoint ni en Everest.
// =====================================================================
(async function () {
  const out = [];
  const w = (s) => { out.push(s); };
  const GUID_BASE = "6594b356-f608-4c56-bb6f-6a90f2125a3f"; // sourcedoc del enlace de SEPTIEMBRE1
  const NOMBRE_ESPERADO = /SEPTIEMBRE1/i;
  const base = "https://viva1aips-my.sharepoint.com/personal/director_bello_viva1a_com_co";
  const CARPETAS = [
    "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM",
    "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM/CITAS DIA EBS",
    "/personal/director_bello_viva1a_com_co/Documents/INTRANET/ACTIVIDADES DE PYM/ESTRATEGIAS POR SEDE 2026/SEDE BELLO",
  ];

  w("======= COMPARATIVO BASE PILOTO SEP vs AGENDA DÍA · " + new Date().toISOString() + " =======");
  w("Página actual: " + location.origin + (location.origin.indexOf("viva1aips-my.sharepoint.com") >= 0 ? "  (✔ mismo origen)" : "  (⚠ si todo da estado 0, correrlo en la pestaña de SharePoint)"));

  const pedir = (url, tipo) => new Promise((res) => {
    const t0 = Date.now();
    fetch(url, { credentials: "include", headers: tipo === "json" ? { Accept: "application/json;odata=nometadata" } : {} })
      .then(async (r) => res({ ok: r.ok, status: r.status, cuerpo: tipo === "json" ? await r.json().catch(() => null) : await r.arrayBuffer().catch(() => null), ms: Date.now() - t0 }))
      .catch((e) => res({ ok: false, status: 0, err: String((e && e.message) || e), ms: Date.now() - t0 }));
  });

  // ================= infrastructure: ZIP + perfil REDACTADO =================
  const td = new TextDecoder();
  async function inflar(metodo, raw, tope) {
    if (metodo === 0) return raw.slice(0, tope || raw.length);
    const ds = new DecompressionStream("deflate-raw");
    const lector = new Blob([raw]).stream().pipeThrough(ds).getReader();
    const trozos = []; let total = 0;
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value); total += value.length;
      if (tope && total >= tope) { lector.cancel(); break; }
    }
    const fin = new Uint8Array(total);
    let o = 0; for (const t of trozos) { fin.set(t, o); o += t.length; }
    return fin;
  }
  function zipIndice(b) {
    const v = new DataView(b);
    let eocd = -1;
    for (let i = b.byteLength - 22; i >= 0 && i > b.byteLength - 66000; i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("ZIP sin directorio central");
    const n = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const entradas = {};
    for (let i = 0; i < n; i++) {
      const metodo = v.getUint16(p + 10, true);
      const comprimido = v.getUint32(p + 20, true);
      const nombreLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), comLen = v.getUint16(p + 32, true);
      const l = v.getUint32(p + 42, true);
      entradas[td.decode(new Uint8Array(b, p + 46, nombreLen))] = { metodo, comprimido, local: l };
      p += 46 + nombreLen + extraLen + comLen;
    }
    return entradas;
  }
  async function zipLeer(b, ind, nombre, tope) {
    const e = ind[nombre]; if (!e) return null;
    const v = new DataView(b);
    const p = e.local;
    const nombreLen = v.getUint16(p + 26, true), extraLen = v.getUint16(p + 28, true);
    return inflar(e.metodo, new Uint8Array(b, p + 30 + nombreLen + extraLen, e.comprimido), tope);
  }
  const CABECERAS_DOC = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];
  const CABECERAS_PHI = /(NOMBRE|APELLI|PACIENTE|DIRECCION|DIR\b|TELEFONO|TEL\b|CELULAR|MAIL|CORREO|EMAIL|DOC|IDENT|CEDULA|ACUDIENTE|RESPONSABLE|FILIACION|EPS\b)/i;
  const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filaVals = (xml) => {
    const celdas = [];
    (xml.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).forEach((c) => {
      const r = /r="([A-Z]+)\d+"/.exec(c);
      let col = 0; if (r) { for (const ch of r[1]) col = col * 26 + (ch.charCodeAt(0) - 64); }
      const t = /t="([^"]+)"/.exec(c);
      let val = "";
      if (t && t[1] === "inlineStr") { const m = /<is><t[^>]*>([\s\S]*?)<\/t>/.exec(c); val = m ? m[1] : ""; }
      else { const m = /<v>([\s\S]*?)<\/v>/.exec(c); val = m ? m[1] : ""; }
      while (celdas.length < col - 1) celdas.push("");
      celdas[col - 1] = val;
    });
    return celdas;
  };

  // Perfil estructural de un XLSX ya descargado. TODO lo que imprime es redactado.
  async function perfilLibro(buf, etiqueta, notas) {
    w("\n=========== " + etiqueta + " ===========");
    (notas || []).forEach((n) => w(n));
    const u8 = new Uint8Array(buf);
    const magia = Array.from(u8.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join(" ").toUpperCase();
    if (magia.indexOf("50 4B") !== 0) {
      w("✗ firma " + magia + " — NO es XLSX legible" + (magia.indexOf("D0 CF 11 E0") === 0 ? " (OLE: .xls viejo o CIFRADO — el Vigilante NO puede leerlo)" : " (¿pantalla de inicio de sesión?)"));
      return;
    }
    w("✔ XLSX real (ZIP) · " + (u8.length / 1048576).toFixed(1) + " MB");
    const ind = zipIndice(buf);
    const nombresZip = Object.keys(ind);
    const tiene = (n) => nombresZip.some((x) => x === n);
    w("entradas ZIP: " + nombresZip.length + " · sharedStrings: " + (tiene("xl/sharedStrings.xml") ? "presente" : "AUSENTE (texto inline)"));
    const shRaw = await zipLeer(buf, ind, "xl/sharedStrings.xml");
    if (shRaw) {
      const m = /<sst[^>]*count="(\d+)"[^>]*uniqueCount="(\d+)"/.exec(td.decode(shRaw.slice(0, 4096)));
      if (m) w("sharedStrings count/unique: " + m[1] + " / " + m[2]);
    }
    const wbTxt = td.decode((await zipLeer(buf, ind, "xl/workbook.xml")) || new Uint8Array());
    const relsTxt = td.decode((await zipLeer(buf, ind, "xl/_rels/workbook.xml.rels")) || new Uint8Array());
    const relMap = {};
    (relsTxt.match(/<Relationship [^>]*>/g) || []).forEach((r) => {
      const id = /Id="([^"]+)"/.exec(r), tgt = /Target="([^"]+)"/.exec(r);
      if (id && tgt) relMap[id[1]] = tgt[1].replace(/^\//, "").replace(/^xl\//, "xl/");
    });
    const hojas = [];
    (wbTxt.match(/<sheet [^>]*>/g) || []).forEach((s) => {
      const nom = /name="([^"]*)"/.exec(s), rid = /r:id="([^"]+)"/.exec(s);
      if (nom && rid) hojas.push({ nombre: nom[1], ruta: relMap[rid[1]] || "" });
    });
    w("hojas declaradas: " + hojas.map((h) => h.nombre).join(" | "));

    for (const h of hojas) {
      if (!h.ruta || !ind[h.ruta]) { w("\n■ Hoja «" + h.nombre + "»: no legible"); continue; }
      const texto = td.decode(await zipLeer(buf, ind, h.ruta));
      const filas = texto.match(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g) || [];
      w("\n■ Hoja «" + h.nombre + "» — filas con contenido: " + filas.length);
      let idxEnc = -1, enc = [];
      for (let i = 0; i < Math.min(filas.length, 15); i++) {
        const v = filaVals(filas[i]);
        if (v.filter((x) => String(x || "").trim()).length >= 3) { idxEnc = i; enc = v; break; }
      }
      if (idxEnc < 0) { w("   (sin encabezado en las primeras 15 filas — ¿portada?)"); continue; }
      enc = enc.map((x) => String(x || "").trim());
      w("   encabezado en la fila " + (idxEnc + 1) + " · columnas: " + enc.filter(Boolean).length);
      enc.forEach((c, i) => { if (c) w("      col " + (i + 1) + ": " + c.slice(0, 42) + (CABECERAS_PHI.test(c) ? "   [φ valores omitidos]" : "")); });
      const norm = enc.map((c) => sinAcentos(String(c || "").toUpperCase().replace(/\s+/g, "_")));
      const docExacta = norm.findIndex((c) => CABECERAS_DOC.indexOf(c) >= 0);
      const docBlanda = norm.findIndex((c) => docExacta < 0 && /IDENT|CEDULA|DOCUMENTO/.test(c));
      w("   columna de identificación: " + (docExacta >= 0 ? "«" + enc[docExacta] + "» (EXACTA con makeIndexer ✔)" : docBlanda >= 0 ? "«" + enc[docBlanda] + "» (solo fallback blando ⚠)" : "NO ENCONTRADA ✘ — el Vigilante rechazaría la hoja"));
      if (docExacta >= 0) {
        // Perfil de la columna documento: largos y duplicados, JAMÁS valores.
        const datos = filas.slice(idxEnc + 1, idxEnc + 20001);
        const largos = {}, vistos = new Map(); let dup = 0, n = 0, conPunto = 0;
        const stats = enc.map(() => ({ n: 0, numMin: Infinity, numMax: -Infinity, conDigitos: 0, distintos: {}, fechaMin: null, fechaMax: null }));
        for (const f of datos) {
          const v = filaVals(f);
          const d = String(v[docExacta] == null ? "" : v[docExacta]).trim();
          if (d) { n++; const L = d.replace(/\D/g, "").length || d.length; largos[L] = (largos[L] || 0) + 1; if (/\./.test(d)) conPunto++; if (vistos.has(d)) dup++; else vistos.set(d, 1); }
          for (let i = 0; i < enc.length; i++) {
            const val = String(v[i] == null ? "" : v[i]).trim();
            if (!val || !enc[i]) continue;
            const st = stats[i]; st.n++;
            if (/^\d{6,}$/.test(val.replace(/\./g, ""))) st.conDigitos++;
            if (val.length <= 24 && !/\d/.test(val) && val.split(/\s+/).length <= 2) st.distintos[val] = (st.distintos[val] || 0) + 1;
            if (/^\d{4}-\d{2}-\d{2}/.test(val)) { if (!st.fechaMin || val < st.fechaMin) st.fechaMin = val; if (!st.fechaMax || val > st.fechaMax) st.fechaMax = val; }
            else { const num = Number(val); if (!isNaN(num)) { if (num < st.numMin) st.numMin = num; if (num > st.numMax) st.numMax = num; } }
          }
        }
        w("   columna documento: " + n + " cédulas · duplicadas: " + dup + " · con punto separador: " + conPunto + " · largos: " + Object.entries(largos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([L, c]) => L + "d×" + c).join(", "));
        w("   filas muestreadas: " + datos.length + (filas.length - idxEnc - 1 > datos.length ? " (truncado a 20.000)" : ""));
        enc.forEach((c, i) => {
          if (!c || !stats[i].n) return;
          const st = stats[i];
          let linea = "      · " + c.slice(0, 36) + ": " + st.n + " llenas";
          if (st.fechaMin) linea += " · fechas " + st.fechaMin.slice(0, 10) + "…" + st.fechaMax.slice(0, 10);
          else if (st.numMax > -Infinity) linea += " · núm min/máx " + (Number.isInteger(st.numMin) ? st.numMin : st.numMin.toFixed(1)) + "–" + (Number.isInteger(st.numMax) ? st.numMax : st.numMax.toFixed(1));
          if (!CABECERAS_PHI.test(c)) {
            const tops = Object.entries(st.distintos).sort((a, b) => b[1] - a[1]).slice(0, 6);
            if (tops.length) linea += " · valores: " + tops.map(([v, nn]) => v + "×" + nn).join(", ");
          }
          if (st.conDigitos && !CABECERAS_PHI.test(c)) linea += " · ⚠ " + st.conDigitos + " valores con ≥6 dígitos (¿PHI en columna inesperada?)";
          w(linea);
        });
      }
    }
  }

  // ================= 1. LA BASE NUEVA (por GUID, la vía del Vigilante) =================
  w("\n--- 1. METADATOS DE LA BASE NUEVA ---");
  const meta = await pedir(base + "/_api/web/GetFileById('" + GUID_BASE + "')?$select=Name,TimeLastModified,Length", "json");
  w("estado: " + meta.status + " · " + meta.ms + " ms");
  if (!meta.ok) {
    w("✗ Sin metadatos (" + (meta.err || "HTTP " + meta.status) + "). 401/403 → abra el archivo una vez en el navegador y reintente.");
    console.log(out.join("\n")); return;
  }
  const f = (meta.cuerpo && (meta.cuerpo.value || (meta.cuerpo.d && meta.cuerpo.d))) || meta.cuerpo || {};
  w("nombre real: " + (f.Name || "?") + " · modificado: " + (f.TimeLastModified || "?") + " · " + (f.Length ? (f.Length / 1048576).toFixed(1) + " MB" : "?"));
  w("coincide con SEPTIEMBRE1: " + (NOMBRE_ESPERADO.test(f.Name || "") ? "SÍ" : "NO — revisar"));
  const dl = await pedir(base + "/_api/web/GetFileById('" + GUID_BASE + "')/$value", "");
  w("descarga por GetFileById/$value: estado " + dl.status + " · " + dl.ms + " ms");
  if (dl.ok) await perfilLibro(dl.cuerpo, "BASE NUEVA (SEPTIEMBRE1, por GUID)", ["Fuente: GetFileById('" + GUID_BASE + "')/$value — la vía 1 del Vigilante"]);

  // ================= 2. EL ARCHIVO DIARIO DE HOY (Agenda Día) =================
  w("\n--- 2. BÚSQUEDA DEL ARCHIVO DIARIO (Agenda Día de hoy) ---");
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  const HOYC = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  let candidato = null, conCarpeta = "";
  for (const carpeta of CARPETAS) {
    const r = await pedir(base + "/_api/web/GetFolderByServerRelativeUrl('" + encodeURI(carpeta) + "')/Files?$select=Name,ServerRelativeUrl,TimeLastModified&$orderby=TimeLastModified%20desc&$top=60", "json");
    w("carpeta …" + carpeta.split("/").slice(-2).join("/") + ": estado " + r.status);
    if (!r.ok) continue;
    const j = (r.cuerpo && (r.cuerpo.value || (r.cuerpo.d && r.cuerpo.d.results))) || [];
    const c = j.find((x) => String(x.Name || "").replace(/[.\s_\-\/]/g, "").toLowerCase().indexOf(HOYC) >= 0
      && /\.(xlsx|xlsm|csv)$/i.test(x.Name || "") && !/^~\$/.test(x.Name || ""));
    if (c) { candidato = c; conCarpeta = carpeta; break; }
  }
  if (!candidato) {
    w("✗ Hoy (" + HOYC + ") no hay archivo diario en ninguna de las 3 carpetas — perfil comparativo del diario no disponible (solo se audita la base nueva).");
  } else {
    w("✔ diario de hoy: «" + candidato.Name + "» · modificado " + String(candidato.TimeLastModified || "?").slice(0, 16) + " · carpeta …" + conCarpeta.split("/").slice(-2).join("/"));
    const dl2 = await pedir(base + "/_api/web/GetFileByServerRelativeUrl('" + encodeURI(candidato.ServerRelativeUrl) + "')/$value", "");
    w("descarga del diario: estado " + dl2.status + " · " + dl2.ms + " ms");
    if (dl2.ok) await perfilLibro(dl2.cuerpo, "ARCHIVO DIARIO DE HOY («" + candidato.Name + "»)", ["Fuente: listado de carpeta + GetFileByServerRelativeUrl/$value — la vía actual del Vigilante"]);
    else w("✗ no descargó — sigo solo con la base nueva");
  }

  // ================= 3. Dictamen =================
  w("\n--- 3. NOTAS PARA LA MIGRACIÓN ---");
  w("· El Vigilante guardará el índice de la base nueva en GM 'vgl_piloto' (paquete v3, tope 12 MB, purga a 30 días).");
  w("· El refresco pasará a ser 1 vez/día a las 06:00 (UTC-5) comparando TimeLastModified del GUID — lo reportado arriba en «modificado».");
  w("· Copie TODO este informe y péguelo en el chat.");

  const informe = out.join("\n");
  console.log(informe);
  try { copy(informe); console.log("%c(informe copiado al portapapeles — péguelo en el chat)", "color:#4a4"); }
  catch (e) { console.log("(seleccione el texto de arriba y cópielo)"); }
})();
