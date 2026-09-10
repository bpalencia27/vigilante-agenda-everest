// =====================================================================
//  AUDITOR LOCAL (Node) — BASE PILOTO DE CONSULTA  BELLO SEPTIEMBRE1.xlsx
//  Auditoría estructural SIN PHI: imprime hojas, columnas, conteos,
//  tipos y compatibilidad con el lector PyM del Vigilante. Nunca
//  imprime valores de celda identificables (nombres, cédulas, teléfonos).
//  Uso: node AUDITORIA_BASE_PILOTO_SEP.js <ruta-del-xlsx>
// =====================================================================
const fs = require("fs");
const zlib = require("zlib");

const RUTA = process.argv[2] || "C:\\Users\\brand\\AppData\\Local\\Temp\\_base_piloto_sep.xlsx";
const buf = fs.readFileSync(RUTA);
const td = new TextDecoder();
const w = (s) => console.log(s);
w("======= AUDITORÍA ESTRUCTURAL · " + RUTA + " · " + (buf.length / 1048576).toFixed(1) + " MB =======");

// ---------- ZIP: central directory a mano (igual que zipIndex del Vigilante) ----------
function zipIndice(b) {
  const v = Buffer.from(b);
  let eocd = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 66000; i--) {
    if (v.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP sin EOCD");
  const n = v.readUInt16LE(eocd + 10);
  let p = v.readUInt32LE(eocd + 16);
  const entradas = {};
  for (let i = 0; i < n; i++) {
    const metodo = v.readUInt16LE(p + 10);
    const comprimido = v.readUInt32LE(p + 20);
    const sinComprimir = v.readUInt32LE(p + 24);
    const nombreLen = v.readUInt16LE(p + 28), extraLen = v.readUInt16LE(p + 30), comLen = v.readUInt16LE(p + 32);
    const local = v.readUInt32LE(p + 42);
    entradas[td.decode(b.subarray(p + 46, p + 46 + nombreLen))] = { metodo, comprimido, sinComprimir, local };
    p += 46 + nombreLen + extraLen + comLen;
  }
  return entradas;
}
function zipLeer(b, ind, nombre, topeBytes) {
  const e = ind[nombre]; if (!e) return null;
  const v = Buffer.from(b);
  const p = e.local;
  const nombreLen = v.readUInt16LE(p + 26), extraLen = v.readUInt16LE(p + 28);
  const crudo = b.subarray(p + 30 + nombreLen + extraLen, p + 30 + nombreLen + extraLen + e.comprimido);
  if (e.metodo === 0) return topeBytes ? crudo.subarray(0, topeBytes) : crudo;
  return topeBytes ? zlib.inflateRawSync(crudo, { maxOutputLength: topeBytes }) : zlib.inflateRawSync(crudo);
}

const ind = zipIndice(buf);
const entradas = Object.entries(ind).sort((a, c) => c[1].sinComprimir - a[1].sinComprimir);
w("\n--- ENTRADAS DEL ZIP (top 12 por tamaño descomprimido) ---");
entradas.slice(0, 12).forEach(([n, e]) => w("  " + n.padEnd(34) + " " + (e.sinComprimir / 1048576).toFixed(1).padStart(7) + " MB descomprimido · método " + e.metodo));
w("entradas totales: " + entradas.length);

const shTxt = td.decode(zipLeer(buf, ind, "xl/sharedStrings.xml") || Buffer.alloc(0));
const mSST = /<sst[^>]*count="(\d+)"[^>]*uniqueCount="(\d+)"/.exec(shTxt.slice(0, 4096));
// sharedStrings como arreglo (para resolver t="s")
const shared = [];
{
  const re = /<si>([\s\S]*?)<\/si>/g; let m;
  while ((m = re.exec(shTxt)) && shared.length < 400000) {
    const runs = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    shared.push(runs.map((r) => r.replace(/<[^>]*>/g, "")).join(""));
  }
}
const unesc = (s) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
w("sharedStrings: " + (mSST ? "count " + mSST[1] + " · unique " + mSST[2] : "(sin atributos)") + " · parseadas: " + shared.length);

const wbTxt = td.decode(zipLeer(buf, ind, "xl/workbook.xml") || Buffer.alloc(0));
const relsTxt = td.decode(zipLeer(buf, ind, "xl/_rels/workbook.xml.rels") || Buffer.alloc(0));
const relMap = {};
(relsTxt.match(/<Relationship [^>]*>/g) || []).forEach((r) => {
  const id = /Id="([^"]+)"/.exec(r), tgt = /Target="([^"]+)"/.exec(r);
  if (id && tgt) {
    let t = tgt[1].replace(/\\/g, "/").replace(/^\//, "");
    if (!/^xl\//.test(t)) t = "xl/" + t;
    relMap[id[1]] = t;
  }
});
const hojas = [];
(wbTxt.match(/<sheet [^>]*>/g) || []).forEach((s) => {
  const nom = /name="([^"]*)"/.exec(s), rid = /r:id="([^"]+)"/.exec(s);
  if (nom && rid) hojas.push({ nombre: unesc(nom[1]), ruta: relMap[rid[1]] || "" });
});
w("hojas declaradas: " + hojas.map((h) => h.nombre).join(" | "));

// ---------- Celdas de una fila → valores ----------
function filaVals(xml) {
  const celdas = [];
  const re = /<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g; let m;
  while ((m = re.exec(xml))) {
    const c = m[0];
    const r = /r="([A-Z]+)\d+"/.exec(c);
    let col = 0; if (r) { for (const ch of r[1]) col = col * 26 + (ch.charCodeAt(0) - 64); }
    const t = /t="([^"]+)"/.exec(c);
    let val = "";
    if (t && t[1] === "inlineStr") { const mm = /<is><t[^>]*>([\s\S]*?)<\/t>/.exec(c); val = mm ? unesc(mm[1]) : ""; }
    else if (t && t[1] === "s") { const mm = /<v>([\s\S]*?)<\/v>/.exec(c); val = mm ? (shared[Number(mm[1])] || "") : ""; }
    else { const mm = /<v>([\s\S]*?)<\/v>/.exec(c); val = mm ? unesc(mm[1]) : ""; }
    while (celdas.length < col - 1) celdas.push("");
    celdas[col - 1] = val;
  }
  return celdas;
}

// ---------- Perfil REDACTADO por hoja ----------
const CABECERAS_DOC = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];
const CABECERAS_PHI = /(NOMBRE|APELLI|PACIENTE|DIRECCION|DIR\b|TELEFONO|TEL\b|CELULAR|MAIL|CORREO|EMAIL|DOC|IDENT|CEDULA|ACUDIENTE|RESPONSABLE|FILIACION|EPS\b)/i;
const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

for (const h of hojas) {
  if (!h.ruta || !ind[h.ruta]) { w("\n■ Hoja «" + h.nombre + "»: NO LEGIBLE (ruta " + (h.ruta || "?") + ")"); continue; }
  const t0 = Date.now();
  const texto = td.decode(zipLeer(buf, ind, h.ruta));
  const filas = texto.match(/<row [^>]*r="\d+"[^>]*>([\s\S]*?)<\/row>/g) || [];
  w("\n■ Hoja «" + h.nombre + "» (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
  w("   filas con contenido: " + filas.length);
  let idxEnc = -1, enc = [];
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const v = filaVals(filas[i]);
    if (v.filter((x) => String(x || "").trim()).length >= 3) { idxEnc = i; enc = v; break; }
  }
  if (idxEnc < 0) { w("   (sin encabezado en las primeras 15 filas — ¿portada?)"); continue; }
  enc = enc.map((x) => String(x || "").trim());
  w("   encabezado en la fila " + (idxEnc + 1) + " · columnas: " + enc.filter(Boolean).length);
  enc.forEach((c, i) => { if (c) w("      col " + String(i + 1).padStart(2) + ": " + c.slice(0, 44) + (CABECERAS_PHI.test(c) ? "   [φ PHI: valores omitidos]" : "")); });
  const norm = enc.map((c) => sinAcentos(String(c || "").toUpperCase().replace(/\s+/g, "_")));
  const docExacta = norm.findIndex((c) => CABECERAS_DOC.indexOf(c) >= 0);
  const docBlanda = norm.findIndex((c) => docExacta < 0 && /IDENT|CEDULA|DOCUMENTO/.test(c));
  w("   columna de identificación: " + (docExacta >= 0 ? "«" + enc[docExacta] + "» col " + (docExacta + 1) + " (EXACTA con makeIndexer ✔)" : docBlanda >= 0 ? "«" + enc[docBlanda] + "» (solo fallback blando ⚠)" : "NO ENCONTRADA ✘ — el Vigilante RECHAZARÍA la hoja"));

  if (docExacta < 0) continue;
  const LIMITE = 400000; // el límite real del Vigilante es 300000 filas
  const datos = filas.slice(idxEnc + 1, idxEnc + 1 + LIMITE);
  const largos = {}, vistos = new Set(); let dup = 0, n = 0, conPunto = 0, conLetra = 0, vacias = 0;
  const stats = enc.map(() => ({ n: 0, numMin: Infinity, numMax: -Infinity, conDigitos: 0, distintos: {}, fechaMin: null, fechaMax: null }));
  for (const f of datos) {
    const v = filaVals(f);
    const d = String(v[docExacta] == null ? "" : v[docExacta]).trim();
    if (!d) { vacias++; continue; }
    n++;
    const soloNum = d.replace(/\D/g, "");
    const L = soloNum.length || d.length;
    largos[L] = (largos[L] || 0) + 1;
    if (/\./.test(d)) conPunto++;
    if (/[A-Za-z]/.test(d)) conLetra++;
    const k = soloNum || d;
    if (vistos.has(k)) dup++; else vistos.add(k);
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
  w("   filas de datos muestreadas: " + datos.length + (filas.length - idxEnc - 1 > datos.length ? " (⚠ TRUNCADO a " + LIMITE + ")" : "") + " · con documento: " + n + " · sin documento: " + vacias);
  w("   documento: duplicados " + dup + " · con punto separador " + conPunto + " · con letras " + conLetra + " · largos: " + Object.entries(largos).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([L, c]) => L + "d×" + c).join(", "));
  enc.forEach((c, i) => {
    if (!c || !stats[i].n) return;
    const st = stats[i];
    let linea = "      · " + c.slice(0, 38).padEnd(38) + ": " + String(st.n).padStart(6) + " llenas";
    if (st.fechaMin) linea += " · fechas " + st.fechaMin.slice(0, 10) + "…" + st.fechaMax.slice(0, 10);
    else if (st.numMax > -Infinity) linea += " · núm " + (Number.isInteger(st.numMin) ? st.numMin : st.numMin.toFixed(1)) + "–" + (Number.isInteger(st.numMax) ? st.numMax : st.numMax.toFixed(1));
    if (!CABECERAS_PHI.test(c)) {
      const tops = Object.entries(st.distintos).sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (tops.length) linea += " · valores: " + tops.map(([v, nn]) => v + "×" + nn).join(", ");
    }
    if (st.conDigitos && !CABECERAS_PHI.test(c)) linea += " · ⚠ " + st.conDigitos + " con ≥6 dígitos (¿PHI fuera de sitio?)";
    w(linea);
  });
}
w("\n======= FIN (informe estructural, sin PHI) =======");
