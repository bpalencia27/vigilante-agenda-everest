// =====================================================================
//  SIMULADOR — ¿Qué haría el Vigilante HOY con la base SEPTIEMBRE1?
//  Reproduce EXACTAMENTE _readPymWorkbookStreamCore + makeIndexer del
//  userscript (selección de hoja por puntaje, indexado, abandono,
//  exclusiones) contra el archivo real, y reporta el resultado SIN PHI
//  (conteos y etiquetas de actividad, que son vocabulario clínico).
//  Uso: node AUDITORIA_SIM_SELECCION_SEP.js <ruta-del-xlsx>
// =====================================================================
const fs = require("fs");
const zlib = require("zlib");
const RUTA = process.argv[2];
const buf = fs.readFileSync(RUTA);

// ---- Copias fieles de las funciones del userscript ----
const stripAccents = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const DOC_EXACT = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];
const EXCLUDE_PYM = ["vdrl", "sifilis", "hepatitis", "hepb", "hepc", "hvc", "vhc", "hbv", "vhb"];
const FRIENDLY = {
  VALORACION_INTEGRAL: "Valoración integral de salud", TAMIZACION_CMB: "Tamización cardiometabólica",
  CITA_PF: "Remisión a Planificación Familiar", CITA_AV: "Remisión a Optometría", CITA_OD: "Remisión a Odontología",
  TAMIZACION_CERVIX: "Cáncer de cuello uterino", TAMIZACION_PROSTATA: "PSA (antígeno de próstata)",
  PRUEBA_CERVIX: "Cáncer de cuello uterino", TAMIZACION_MAMA: "Mamografía",
  TAMIZACION_COLON: "SOMF (sangre oculta en materia fecal)",
  TAMIZACION_HEPC: "Tamización de Hepatitis C", TAMIZACION_HEPB: "Tamización de Hepatitis B",
  TAMIZACION_VDRL: "Tamización de Sífilis", TAMIZACION_HB: "Hemoglobina",
  TAMIZACION_VIH: "VIH", TAMIZACION_HTO: "Hematocrito",
  "Último VIH": "VIH", "Ultimo VIH": "VIH",
  "Última SOMF": "SOMF (sangre oculta en materia fecal)", "Ultima SOMF": "SOMF (sangre oculta en materia fecal)",
};
const FRIENDLY_NORM = {};
for (const k of Object.keys(FRIENDLY)) FRIENDLY_NORM[stripAccents(k).toUpperCase()] = FRIENDLY[k];
function friendly(h) {
  const raw = String(h == null ? "" : h).trim();
  if (FRIENDLY[raw]) return FRIENDLY[raw];
  const upper = raw.toUpperCase();
  if (FRIENDLY[upper]) return FRIENDLY[upper];
  const norm = stripAccents(raw).toUpperCase();
  if (FRIENDLY_NORM[norm]) return FRIENDLY_NORM[norm];
  const bruto = raw.replace(/_/g, " ").trim();
  if (/[a-záéíóúñ]/.test(bruto)) return bruto;
  const t = bruto.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const activityLabel = (header, val) => { const f = friendly(header); const s = String(val).trim().toLowerCase(); if (s === "susceptible" || s === "pendiente") return f; return `${f} — ${String(val).trim()}`; };
const isExcludedActivity = (header, label) => {
  const hay = stripAccents((header + " " + label).toLowerCase());
  if (hay.includes("vih")) return false;
  return EXCLUDE_PYM.some((k) => hay.includes(k));
};
function normalizeKey(val) {
  if (val === null || val === undefined) return "";
  let s = String(val).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(s)) { const n = Number(s); if (isFinite(n)) s = n.toFixed(0); }
  return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}
function isPending(val) {
  if (val === null || val === undefined || val === "") return false;
  const s = typeof val === "string" ? val : String(val);
  const t = s.trim().toLowerCase();
  if (t.length > 32) return false;
  return t === "susceptible" || t === "pendiente" || t.startsWith("tamizar");
}
const esSi = (val) => val === null || val === undefined ? false : stripAccents(String(val).trim().toLowerCase()) === "si";
function findDocIdx(headers) {
  const h = (headers || []).map((x) => stripAccents(String(x == null ? "" : x)).toUpperCase());
  for (const cand of DOC_EXACT) { const k = h.indexOf(cand); if (k >= 0) return k; }
  return h.findIndex((x) => x.includes("IDENT") || x.includes("CEDULA") || x.includes("DOCUMENTO"));
}
function detalleTipoCervix(valorCrudo) {
  const s = stripAccents(String(valorCrudo || "").toLowerCase());
  if (s.includes("vph")) return "VPH";
  if (s.includes("ccu") || s.includes("citolog")) return "citología cervicouterina";
  return String(valorCrudo || "").trim();
}

// ---- ZIP ----
const td = new TextDecoder();
function zipIndex(b) {
  const dv = Buffer.from(b);
  let eocd = -1;
  for (let i = b.length - 22; i >= 0 && i >= b.length - 22 - 65536; i--) { if (dv.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error("sin EOCD");
  let cdCount = dv.readUInt16LE(eocd + 10), cdOffset = dv.readUInt32LE(eocd + 16);
  const files = {}; let p = cdOffset;
  for (let n = 0; n < cdCount; n++) {
    if (dv.readUInt32LE(p) !== 0x02014b50) break;
    const method = dv.readUInt16LE(p + 10), compSize = dv.readUInt32LE(p + 20), uncSize = dv.readUInt32LE(p + 24);
    const nameLen = dv.readUInt16LE(p + 28), extraLen = dv.readUInt16LE(p + 30), commentLen = dv.readUInt16LE(p + 32);
    const localOff = dv.readUInt32LE(p + 42);
    files[td.decode(b.subarray(p + 46, p + 46 + nameLen))] = { method, compSize, uncSize, localOff };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { dv, bytes: b, files };
}
function inflateRaw(bytes, maxBytes) {
  // FIEL al comportamiento del navegador: trunca en maxBytes sin error
  // (el inflateRawSync de Node LANZARÍA al exceder maxOutputLength).
  const out = zlib.inflateRawSync(bytes);
  return maxBytes ? Buffer.from(out).subarray(0, maxBytes) : Buffer.from(out);
}
function zipRead(zip, name, maxBytes) {
  const f = zip.files[name]; if (!f) return null;
  const lh = f.localOff;
  const start = lh + 30 + zip.dv.readUInt16LE(lh + 26) + zip.dv.readUInt16LE(lh + 28);
  const comp = zip.bytes.subarray(start, start + f.compSize);
  const raw = f.method === 0 ? (maxBytes ? comp.subarray(0, maxBytes) : comp) : inflateRaw(comp, maxBytes);
  return td.decode(raw);
}
function colToIdx(ref) { const m = /^([A-Z]+)/.exec(ref || ""); if (!m) return -1; let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; }
function unescXml(s) {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}
function parseRowBody(cuerpo) {
  const CELL_RE = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
  const arr = [];
  if (cuerpo) {
    let cm, libre = 0;
    while ((cm = CELL_RE.exec(cuerpo)) !== null) {
      const attrs = cm[1] || "", body = cm[2] || "";
      const refM = /r="([A-Z]+)\d+"/.exec(attrs);
      let idx = refM ? colToIdx(refM[1]) : -1;
      if (idx < 0) idx = libre;
      libre = idx + 1;
      const tM = /t="([^"]+)"/.exec(attrs), tipo = tM ? tM[1] : "";
      let val = "";
      if (tipo === "inlineStr") { const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t; while ((t = tRe.exec(body)) !== null) val += t[1]; val = unescXml(val); }
      else { const vM = /<v>([\s\S]*?)<\/v>/.exec(body); val = vM ? vM[1] : ""; val = unescXml(val); }
      arr[idx] = val;
    }
  }
  for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = "";
  return arr;
}
function scanSheetRows(xml, maxRows) {
  const filas = [];
  const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g;
  let rm;
  while ((rm = rowRe.exec(xml)) !== null) {
    filas.push(parseRowBody(rm[2]));
    if (filas.length >= (maxRows || 300000)) break;
  }
  return filas;
}
function scoreSheet(filas) {
  let mejor = { score: -1, headerRow: -1, pend: 0 };
  const tope = Math.min(filas.length, 15);
  for (let h = 0; h < tope; h++) {
    const cruda = filas[h] || [];
    const cab = Array.from({ length: cruda.length }, (_, i) => String(cruda[i] == null ? "" : cruda[i]).trim().toUpperCase());
    if (cab.filter(Boolean).length < 2) continue;
    if (findDocIdx(cab) < 0) continue;
    let pend = 0;
    for (let r = h + 1; r < Math.min(filas.length, h + 400); r++) {
      const fila = filas[r] || [];
      for (let c = 0; c < fila.length; c++) if (isPending(fila[c])) pend++;
    }
    const score = 100 + Math.min(300, pend) - h;
    if (score > mejor.score) mejor = { score, headerRow: h, pend };
  }
  return mejor;
}
function makeIndexer(headersRaw) {
  const crudos = headersRaw || [];
  const headers = Array.from({ length: crudos.length }, (_, i) => (crudos[i] == null || crudos[i] === "" ? `COL_${i}` : String(crudos[i]).trim().toUpperCase()));
  const docIdx = findDocIdx(headers);
  if (docIdx < 0) throw new Error("No se encontró la columna con la identificación del paciente.");
  const map = new Map(), todos = new Set(), abandono = new Set();
  const memo = [];
  const cervixTamIdx = headers.indexOf("TAMIZACION_CERVIX");
  const cervixPruebaIdx = headers.indexOf("PRUEBA_CERVIX");
  const abandonoIdx = headers.indexOf("ABANDONADOS_PES") >= 0 ? headers.indexOf("ABANDONADOS_PES") : headers.indexOf("ABANDONADO_PES");
  return {
    map, todos, abandono, docIdx, headers,
    push(row) {
      const docKey = normalizeKey(row[docIdx]); if (!docKey) return;
      todos.add(docKey);
      if (abandonoIdx >= 0 && esSi(row[abandonoIdx])) abandono.add(docKey);
      const bucket = map.get(docKey) || [];
      let detalleCervix = "", cervixYaAgregado = false;
      if (cervixPruebaIdx >= 0) { const pv = row[cervixPruebaIdx]; if (isPending(pv)) detalleCervix = detalleTipoCervix(pv); }
      for (let i = 0; i < headers.length; i++) {
        if (i === docIdx || i === cervixPruebaIdx || i === abandonoIdx) continue;
        const celda = row[i];
        if (!isPending(celda)) continue;
        let label;
        if (i === cervixTamIdx && detalleCervix) { label = "Cáncer de cuello uterino — " + detalleCervix; cervixYaAgregado = true; }
        else {
          const clave = String(celda);
          let cm = memo[i] || (memo[i] = new Map());
          label = cm.get(clave);
          if (label === undefined) {
            const l = activityLabel((crudos && crudos[i]) || headers[i], celda);
            label = isExcludedActivity(headers[i], l) ? null : l;
            cm.set(clave, label);
          }
          if (label === null) continue;
          if (i === cervixTamIdx) cervixYaAgregado = true;
        }
        if (!bucket.includes(label)) bucket.push(label);
      }
      if (detalleCervix && !cervixYaAgregado) {
        const label = "Cáncer de cuello uterino — " + detalleCervix;
        if (!bucket.includes(label)) bucket.push(label);
      }
      if (bucket.length) map.set(docKey, bucket);
    },
  };
}

// ---- Ejecución: réplica de _readPymWorkbookStreamCore ----
// Modo 2: node SIM <xlsx> "hoja1" "hoja2" — indexa las hojas FIJADAS por nombre
// exacto (ignora la selección por puntaje) y fusiona sus índices como haría
// la migración propuesta.
const PINES = process.argv.slice(3).map((s) => s.trim()).filter(Boolean);
const zip = zipIndex(buf);
// sharedStrings (sin streaming aquí, por simplicidad de la simulación)
let shared = [];
{
  const shTxt = zipRead(zip, "xl/sharedStrings.xml");
  const re = /<si\b(?:\s*\/>|[^>]*>([\s\S]*?)<\/si>)/g; let m;
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  while ((m = re.exec(shTxt))) { let s = ""; let t; tRe.lastIndex = 0; while ((t = tRe.exec(m[1] || ""))) s += t[1]; shared.push(unescXml(s)); }
}
// versión de parseRowBody que resuelve t="s" contra shared
function parseRowBodyShared(cuerpo) {
  const arr = parseRowBody(cuerpo.replace(/t="s"/g, 't="__S__"'));
  // trampa: parseRowBody no resuelve shared; resolvemos a mano:
  const CELL_RE = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;
  const out = [];
  if (cuerpo) {
    let cm, libre = 0;
    while ((cm = CELL_RE.exec(cuerpo)) !== null) {
      const attrs = cm[1] || "", body = cm[2] || "";
      const refM = /r="([A-Z]+)\d+"/.exec(attrs);
      let idx = refM ? colToIdx(refM[1]) : -1;
      if (idx < 0) idx = libre;
      libre = idx + 1;
      const tM = /t="([^"]+)"/.exec(attrs), tipo = tM ? tM[1] : "";
      let val = "";
      if (tipo === "inlineStr") { const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t; while ((t = tRe.exec(body)) !== null) val += t[1]; val = unescXml(val); }
      else { const vM = /<v>([\s\S]*?)<\/v>/.exec(body); val = vM ? vM[1] : ""; if (tipo === "s") { const i = parseInt(val, 10); val = shared[i] !== undefined ? shared[i] : ""; } else val = unescXml(val); }
      out[idx] = val;
    }
  }
  for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
  return out;
}

const hojas = [];
{
  const wbXml = zipRead(zip, "xl/workbook.xml"), relsXml = zipRead(zip, "xl/_rels/workbook.xml.rels");
  const rmap = {};
  const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g; let m;
  while ((m = re.exec(relsXml))) rmap[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\//, "");
  const sre = /<sheet\b([^>]*)\/?>/g;
  while ((m = sre.exec(wbXml))) {
    const a = m[1];
    const nm = /name="([^"]*)"/.exec(a), rid = /r:id="([^"]+)"/.exec(a);
    const tgt = rid && rmap[rid[1]];
    if (tgt) hojas.push({ name: nm ? unescXml(nm[1]) : tgt, path: "xl/" + tgt });
  }
}
console.log("hojas en orden: " + hojas.map((h) => h.name).join(" | "));

const SCAN = 300000;
const cand = [];
for (const h of hojas) {
  const info = zip.files[h.path]; if (!info) continue;
  try {
    const muestra = zipRead(zip, h.path, SCAN);
    const filas = [];
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g; let rm;
    while ((rm = rowRe.exec(muestra || ""))) { filas.push(parseRowBodyShared(rm[2])); if (filas.length >= 400) break; }
    // scoreSheet con resolución de shared:
    let mejor = { score: -1, headerRow: -1, pend: 0, docCol: -1, docNombre: "" };
    for (let hr = 0; hr < Math.min(filas.length, 15); hr++) {
      const cruda = filas[hr] || [];
      const cab = Array.from({ length: cruda.length }, (_, i) => String(cruda[i] == null ? "" : cruda[i]).trim().toUpperCase());
      if (cab.filter(Boolean).length < 2) continue;
      const di = findDocIdx(cab);
      if (di < 0) continue;
      let pend = 0;
      for (let r = hr + 1; r < Math.min(filas.length, hr + 400); r++) {
        const fila = filas[r] || [];
        for (let c = 0; c < fila.length; c++) if (isPending(fila[c])) pend++;
      }
      const score = 100 + Math.min(300, pend) - hr;
      if (score > mejor.score) mejor = { score, headerRow: hr, pend, docCol: di, docNombre: cab[di] };
    }
    if (mejor.score > 0) cand.push({ h, sc: mejor, size: info.uncSize || 0 });
  } catch (e) { /* ilegible */ }
}
cand.sort((a, b) => b.sc.score - a.sc.score);
console.log("\n--- PUNTAJES DE SELECCIÓN (réplica exacta de scoreSheet) ---");
cand.forEach((c, i) => console.log((i === 0 ? "★ " : "  ") + c.h.name.padEnd(32) + " score " + String(c.sc.score).padStart(3) + " · pend400 " + String(c.sc.pend).padStart(3) + " · docCol «" + c.sc.docNombre + "» (col " + (c.sc.docCol + 1) + ") · hoja " + (c.size / 1048576).toFixed(1) + " MB"));

const elegida = cand[0] || { h: hojas[0], sc: { headerRow: 0 } };
const headerRow = Math.max(0, elegida.sc.headerRow || 0);

const etiquetas = {};
const fusion = { map: new Map(), todos: new Set(), abandono: new Set() };
const hojasAIndexar = PINES.length
  ? hojas.filter((h) => PINES.some((p) => h.name.toLowerCase() === p.toLowerCase()))
  : [elegida.h];
console.log("\nHOJAS A INDEXAR: " + (PINES.length ? "FIJADAS por nombre → " : "elegida por puntaje → ") + hojasAIndexar.map((h) => h.name).join(" | "));

for (const hIdx of hojasAIndexar) {
  const t0 = Date.now();
  const texto = zipRead(zip, hIdx.path);
  const filas = [];
  {
    const rowRe = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g; let rm;
    while ((rm = rowRe.exec(texto))) { filas.push(parseRowBodyShared(rm[2])); if (filas.length >= 300000) break; }
  }
  // encabezado: primera de las primeras 15 filas con >=3 celdas (como elegirHojaYCabecera tolerante)
  let hr = 0;
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    if ((filas[i] || []).filter((x) => String(x || "").trim()).length >= 3) { hr = i; break; }
  }
  let indexer = null;
  try { indexer = makeIndexer(filas[hr]); }
  catch (e) { console.log("  ✗ «" + hIdx.name + "»: " + e.message); continue; }
  for (let i = hr + 1; i < filas.length; i++) {
    indexer.push(filas[i]);
    const doc = normalizeKey(filas[i] && filas[i][indexer.docIdx]);
    if (doc && indexer.map.has(doc)) indexer.map.get(doc).forEach((l) => { etiquetas[l] = (etiquetas[l] || 0) + 1; });
  }
  console.log("  ■ «" + hIdx.name + "»: " + filas.length + " filas · docCol «" + indexer.headers[indexer.docIdx] + "» · " + ((Date.now() - t0) / 1000).toFixed(1) + " s · todos=" + indexer.todos.size + " · conPend=" + indexer.map.size + " · abandono=" + indexer.abandono.size);
  indexer.todos.forEach((d) => fusion.todos.add(d));
  indexer.abandono.forEach((d) => fusion.abandono.add(d));
  indexer.map.forEach((bucket, d) => {
    const dest = fusion.map.get(d) || [];
    bucket.forEach((l) => { if (!dest.includes(l)) dest.push(l); });
    fusion.map.set(d, dest);
  });
}
console.log("\n--- ÍNDICE FUSIONADO ---");
console.log("pacientes totales (todos): " + fusion.todos.size);
console.log("pacientes CON pendientes (map): " + fusion.map.size);
console.log("abandono PES: " + fusion.abandono.size);
console.log("\n--- ETIQUETAS DE ACTIVIDAD RESULTANTES (chips del panel) ---");
Object.entries(etiquetas).sort((a, b) => b[1] - a[1]).forEach(([l, n]) => console.log("  " + String(n).padStart(5) + " × " + l));
console.log("\n(Informe estructural — sin PHI)");
