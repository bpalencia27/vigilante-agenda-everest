#!/usr/bin/env node
// =====================================================================
//  GENERADOR DEL CORPUS DE GROUNDING
//
//  Lee las capturas reales de consultorio y produce `grounding/`: el inventario de
//  endpoints de Everest y el ESQUEMA de cada respuesta (nombres de campo y tipos), que
//  es lo que de verdad sirve para orientar a otro modelo.
//
//  REGLA QUE GOBIERNA TODO ESTE ARCHIVO: se publica la FORMA, nunca el CONTENIDO.
//  De cada campo salen su nombre y su tipo. Los valores solo se conservan cuando pasan
//  un filtro estrecho —códigos numéricos cortos, términos médicos en mayúsculas,
//  booleanos, enumerados— porque un catálogo de CUPS o una lista de estados SÍ es
//  información que hace falta. Todo lo demás se sustituye por su forma.
//
//  Es un generador y no un volcado a mano a propósito: si mañana hay una captura nueva,
//  se vuelve a correr y el corpus se rehace igual, sin que nadie tenga que acordarse de
//  qué se podía copiar y qué no.
// =====================================================================
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SALIDA = path.join(RAIZ, "grounding");

// Campos que NUNCA salen con valor, pase lo que pase. Las capturas de este repo ya están
// redactadas, pero esta lista no depende de eso: si mañana entra una captura sin redactar,
// el generador la sigue tratando bien.
const PROHIBIDOS = /^(identificacion|numeroIdentificacion|documento|cedula|nombre|nombres|primer_?Apellido|segundo_?Apellido|apellidos?|nombreCompleto|nombrePaciente|celular|telefono|correo|email|direccion|direccionUbica|fecha_?Nacimiento|nombreRepresentante|cedRepresentanteLegal)$/i;

// Un valor se conserva solo si es claramente catálogo y no dato de persona.
function valorPublicable(v) {
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isInteger(v) && Math.abs(v) < 1000000;
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  if (s.length > 60) return false;
  if (/\b[1-9]\d{6,}\b/.test(s)) return false;              // cualquier id largo, fuera
  if (/^\d{1,6}$/.test(s)) return true;                     // CUPS y códigos cortos
  if (/^[A-ZÁÉÍÓÚÑ0-9 ()\/.,+%-]+$/.test(s) && s.length > 2) return true;  // término de catálogo
  return false;
}

function forma(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "string(fecha)";
    if (/^\d+$/.test(v)) return `string(${v.length} dígitos)`;
    return `string(${v.length} car)`;
  }
  return t;
}

// Reduce un objeto a su esquema. Nunca recorre más de lo necesario ni saca valores
// que no pasen el filtro.
function esquema(o, prof) {
  prof = prof || 0;
  if (prof > 6) return "…";
  if (Array.isArray(o)) {
    if (!o.length) return { tipo: "array", elementos: 0 };
    return { tipo: "array", elementos: o.length, de: esquema(o[0], prof + 1) };
  }
  if (o && typeof o === "object") {
    const out = {};
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (PROHIBIDOS.test(k)) { out[k] = forma(v) + " [OCULTO]"; continue; }
      if (v && typeof v === "object") { out[k] = esquema(v, prof + 1); continue; }
      out[k] = valorPublicable(v) ? { tipo: forma(v), ejemplo: v } : forma(v);
    }
    return out;
  }
  return forma(o);
}

function cuerpo(c) {
  if (c == null) return null;
  if (typeof c !== "string") return c;
  try { return JSON.parse(c); } catch (e) { return null; }
}

function rutaLimpia(u) {
  const s = String(u || "");
  const sinFrag = s.split("#")[0];
  const partes = sinFrag.split("?");
  let base = partes[0];
  try { base = base.replace(/^https?:\/\/[^/]+/, ""); } catch (e) {}
  const params = partes[1] ? partes[1].split("&").map((p) => p.split("=")[0]).filter(Boolean) : [];
  return { ruta: base, params };
}

const capturas = fs.readdirSync(RAIZ).filter((f) => /^captura_.*\.json$/.test(f)).sort();
const endpoints = new Map();
const porCaptura = [];

for (const f of capturas) {
  let d;
  try { d = JSON.parse(fs.readFileSync(path.join(RAIZ, f), "utf8")); } catch (e) { continue; }
  const red = Array.isArray(d.network) ? d.network : [];
  porCaptura.push({
    archivo: f,
    nota: d._nota || d._comentario || "",
    url0: rutaLimpia(d.url0).ruta,
    peticiones: red.length,
    clicks: Array.isArray(d.clicks) ? d.clicks.length : 0,
  });
  for (const n of red) {
    const { ruta, params } = rutaLimpia(n.url);
    if (!ruta) continue;
    const clave = (n.method || "GET") + " " + ruta;
    if (!endpoints.has(clave)) {
      endpoints.set(clave, { metodo: n.method || "GET", ruta, params: new Set(), vistoEn: new Set(), estados: new Set(), req: null, res: null, nota: n._comentario || "" });
    }
    const e = endpoints.get(clave);
    params.forEach((p) => e.params.add(p));
    e.vistoEn.add(f);
    if (n.status != null) e.estados.add(n.status);
    if (!e.nota && n._comentario) e.nota = n._comentario;
    const rq = cuerpo(n.reqBody), rs = cuerpo(n.resBody);
    if (rq && !e.req) e.req = esquema(rq);
    if (rs && !e.res) e.res = esquema(rs);
  }
}

fs.mkdirSync(path.join(SALIDA, "esquemas"), { recursive: true });

const lista = [...endpoints.values()].sort((a, b) => a.ruta.localeCompare(b.ruta));
for (const e of lista) {
  const nombre = e.ruta.replace(/^\//, "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 90) + ".json";
  fs.writeFileSync(path.join(SALIDA, "esquemas", nombre), JSON.stringify({
    metodo: e.metodo,
    ruta: e.ruta,
    parametros: [...e.params],
    estadosVistos: [...e.estados],
    observadoEn: [...e.vistoEn],
    nota: e.nota || undefined,
    esquemaPeticion: e.req || undefined,
    esquemaRespuesta: e.res || undefined,
  }, null, 2) + "\n", "utf8");
}

const md = [];
md.push("# API de Everest — endpoints observados en consultorio\n");
md.push("Generado por `tools/generar_grounding.js` a partir de las capturas reales del repositorio.");
md.push("**No está escrito a mano y no debe editarse a mano**: si hay una captura nueva, se vuelve a correr.\n");
md.push("De cada respuesta se publica el ESQUEMA (nombres de campo y tipos), nunca los valores de paciente.\n");
md.push("| Método | Ruta | Parámetros | Estados | Visto en |");
md.push("|---|---|---|---|---|");
for (const e of lista) {
  md.push(`| \`${e.metodo}\` | \`${e.ruta}\` | ${[...e.params].map((p) => "`" + p + "`").join(", ") || "—"} | ${[...e.estados].join(", ") || "—"} | ${[...e.vistoEn].length} captura(s) |`);
}
md.push("\n## Capturas de origen\n");
md.push("| Archivo | Vista | Peticiones | Clics |");
md.push("|---|---|---|---|");
for (const c of porCaptura) md.push(`| \`${c.archivo}\` | \`${c.url0}\` | ${c.peticiones} | ${c.clicks} |`);
fs.writeFileSync(path.join(SALIDA, "API_EVEREST.md"), md.join("\n") + "\n", "utf8");

console.log("endpoints:", lista.length, "· esquemas escritos en grounding/esquemas/");
console.log("capturas leídas:", capturas.length);
