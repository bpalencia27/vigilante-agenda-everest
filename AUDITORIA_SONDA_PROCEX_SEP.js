// Sonda de vocabulario de valores (enums sin dígitos) para hojas del libro
// SEPTIEMBRE1 — decide si PROCEXDTAGOSTO trae pendientes en vocabulario
// distinto a "Susceptible". SIN PHI: imprime histogramas de valores cortos
// sin dígitos y conteos por fecha (serial Excel→fecha, sin identidad).
// Uso: node AUDITORIA_SONDA_PROCEX_SEP.js <xlsx> "hoja" "col1" "col2"...
const fs = require("fs");
const zlib = require("zlib");
const RUTA = process.argv[2], HOJA = process.argv[3], COLS = process.argv.slice(4);
const buf = fs.readFileSync(RUTA);
const td = new TextDecoder();
const stripAccents = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

const dv = Buffer.from(buf);
let eocd = -1;
for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) { if (dv.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
let n = dv.readUInt16LE(eocd + 10), p = dv.readUInt32LE(eocd + 16);
const files = {};
for (let i = 0; i < n; i++) {
  const method = dv.readUInt16LE(p + 10), compSize = dv.readUInt32LE(p + 20);
  const nameLen = dv.readUInt16LE(p + 28), extraLen = dv.readUInt16LE(p + 30), comLen = dv.readUInt16LE(p + 32);
  files[td.decode(buf.subarray(p + 46, p + 46 + nameLen))] = { method, compSize, localOff: dv.readUInt32LE(p + 42) };
  p += 46 + nameLen + extraLen + comLen;
}
function zipRead(name) {
  const f = files[name];
  const start = f.localOff + 30 + dv.readUInt16LE(f.localOff + 26) + dv.readUInt16LE(f.localOff + 28);
  const raw = f.method === 0 ? buf.subarray(start, start + f.compSize) : zlib.inflateRawSync(buf.subarray(start, start + f.compSize));
  return td.decode(raw);
}
// shared
let shared = [];
{
  const shTxt = zipRead("xl/sharedStrings.xml");
  const re = /<si\b(?:\s*\/>|[^>]*>([\s\S]*?)<\/si>)/g; let m; const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  while ((m = re.exec(shTxt))) { let s = ""; let t; tRe.lastIndex = 0; while ((t = tRe.exec(m[1] || ""))) s += t[1]; shared.push(s); }
}
// workbook → ruta de la hoja pedida
let rutaHoja = null;
{
  const wb = zipRead("xl/workbook.xml"), rels = zipRead("xl/_rels/workbook.xml.rels");
  const rmap = {}; const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g; let m;
  while ((m = re.exec(rels))) rmap[m[1]] = m[2].replace(/^\/?xl\//, "").replace(/^\//, "");
  const sre = /<sheet\b([^>]*)\/?>/g;
  while ((m = sre.exec(wb))) {
    const nm = /name="([^"]*)"/.exec(m[1]), rid = /r:id="([^"]+)"/.exec(m[1]);
    if (nm && rid && stripAccents(nm[1]).toLowerCase() === stripAccents(HOJA).toLowerCase()) rutaHoja = "xl/" + rmap[rid[1]];
  }
}
if (!rutaHoja) { console.log("hoja no encontrada: " + HOJA); process.exit(1); }
const texto = zipRead(rutaHoja);
// filas → arreglos
function colToIdx(ref) { const m2 = /^([A-Z]+)/.exec(ref || ""); if (!m2) return -1; let c = 0; for (const ch of m2[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; }
function parseRow(cuerpo) {
  const out = []; const CRE = /<c\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/c>)/g; let cm, libre = 0;
  while ((cm = CRE.exec(cuerpo)) !== null) {
    const attrs = cm[1] || "", body = cm[2] || "";
    const refM = /r="([A-Z]+)\d+"/.exec(attrs);
    let idx = refM ? colToIdx(refM[1]) : -1;
    if (idx < 0) idx = libre;
    libre = idx + 1;
    const tM = /t="([^"]+)"/.exec(attrs);
    let val = "";
    if (tM && tM[1] === "inlineStr") { const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t; while ((t = tRe.exec(body)) !== null) val += t[1]; }
    else { const vM = /<v>([\s\S]*?)<\/v>/.exec(body); val = vM ? vM[1] : ""; if (tM && tM[1] === "s") val = shared[parseInt(val, 10)] || ""; }
    out[idx] = val;
  }
  for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
  return out;
}
const filas = [];
{
  const rr = /<row\b([^>]*)(?:\s*\/>|>([\s\S]*?)<\/row>)/g; let rm;
  while ((rm = rr.exec(texto))) { filas.push(parseRow(rm[2])); if (filas.length >= 300000) break; }
}
const enc = (filas[0] || []).map((x) => String(x || "").trim());
console.log("hoja «" + HOJA + "» · filas " + filas.length);
const norm = (s) => stripAccents(String(s || "").toUpperCase().replace(/\s+/g, "_"));
const objetivos = [];
enc.forEach((c, i) => {
  const nc = norm(c);
  if (COLS.some((q) => norm(q) === nc)) objetivos.push({ i, c });
});
console.log("columnas sondeadas: " + objetivos.map((o) => "«" + o.c + "»(col " + (o.i + 1) + ")").join(", "));
// además: TODA columna enum (≤6 valores distintos sin dígitos en ≤20k filas) se reporta
const hist = enc.map(() => ({}));
const fechaIdx = enc.findIndex((c) => /FECHA_CITA/i.test(norm(c)));
const fechaHist = {};
for (let r = 1; r < Math.min(filas.length, 20001); r++) {
  const f = filas[r];
  for (let i = 0; i < enc.length; i++) {
    const v = String(f[i] == null ? "" : f[i]).trim();
    if (!v || !enc[i]) continue;
    if (v.length <= 28 && !/\d{4,}/.test(v)) hist[i][v] = (hist[i][v] || 0) + 1;
  }
  if (fechaIdx >= 0) {
    const fv = String(f[fechaIdx] == null ? "" : f[fechaIdx]).trim();
    if (/^\d+(\.\d+)?$/.test(fv)) fechaHist[Math.round(Number(fv))] = (fechaHist[Math.round(Number(fv))] || 0) + 1;
  }
}
const serial = (s) => { const d = new Date(Date.UTC(1899, 11, 30) + s * 86400000); return d.toISOString().slice(0, 10); };
enc.forEach((c, i) => {
  if (!c) return;
  const entradas = Object.entries(hist[i]);
  if (fechaIdx === i || objetivos.some((o) => o.i === i)) {
    console.log("\n· «" + c + "»:");
    entradas.sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([v, nn]) => console.log("    " + String(nn).padStart(6) + " × " + v));
    return;
  }
  if (entradas.length && entradas.length <= 8) {
    console.log("\n· «" + c + "» (enum): " + entradas.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v, nn]) => v + "×" + nn).join(", "));
  }
});
if (Object.keys(fechaHist).length) {
  console.log("\n· FECHA_CITA por día (serial→fecha):");
  Object.entries(fechaHist).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([s, nn]) => console.log("    " + serial(Number(s)) + " : " + nn));
}
