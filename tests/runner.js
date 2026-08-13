// =====================================================================
//  EJECUTOR DE PRUEBAS DEL VIGILANTE
//  Sin dependencias externas: se ejecuta con  node tests/runner.js
//  Cada archivo tests/suite_*.js exporta { nombre, cubre: [...], pruebas(t, api, env) }
// =====================================================================
const fs = require("fs");
const path = require("path");
const { cargar } = require("./harness.js");

const COL = { ok: "\x1b[32m", mal: "\x1b[31m", dim: "\x1b[90m", tit: "\x1b[36m", fin: "\x1b[0m", ama: "\x1b[33m" };

function crearT() {
  const res = { pasa: 0, falla: 0, fallos: [], actual: "", pendientes: [] };
  const t = {
    caso(desc, fn) {
      res.actual = desc;
      try { fn(); res.pasa++; }
      catch (e) { res.falla++; res.fallos.push({ desc, msg: e.message }); }
    },
    casoAsync(desc, fn) {
      res.actual = desc;
      const p = (async () => {
        try { await fn(); res.pasa++; }
        catch (e) { res.falla++; res.fallos.push({ desc, msg: e.message }); }
      })();
      res.pendientes.push(p);
      return p;
    },
    igual(a, b, nota) {
      const A = JSON.stringify(a), B = JSON.stringify(b);
      if (A !== B) throw new Error((nota ? nota + ": " : "") + "esperaba " + B + " y obtuvo " + A);
    },
    cierto(v, nota) { if (!v) throw new Error((nota || "se esperaba verdadero") + " (obtuvo " + JSON.stringify(v) + ")"); },
    falso(v, nota) { if (v) throw new Error((nota || "se esperaba falso") + " (obtuvo " + JSON.stringify(v) + ")"); },
    lanza(fn, nota) { let l = false; try { fn(); } catch (e) { l = true; } if (!l) throw new Error(nota || "se esperaba una excepción"); },
    noLanza(fn, nota) { try { fn(); } catch (e) { throw new Error((nota || "no debía lanzar") + ": " + e.message); } },
  };
  return { t, res };
}

async function main() {
  const soloEste = process.argv[2];
  const archivos = fs.readdirSync(__dirname).filter(f => /^suite_.*\.js$/.test(f)).sort()
    .filter(f => !soloEste || f.includes(soloEste));

  if (!archivos.length) { console.log("No hay suites que ejecutar."); process.exit(1); }

  const cargado = cargar({ silencioso: true });
  const api = cargado.api, env = cargado.env;

  console.log("");
  console.log(COL.tit + "═".repeat(64) + COL.fin);
  console.log(COL.tit + "  PRUEBAS DEL VIGILANTE DE AGENDA" + COL.fin);
  console.log(COL.tit + "═".repeat(64) + COL.fin);
  console.log("  funciones alcanzables: " + cargado.expuestas + " de " + cargado.totalDeclaradas);
  console.log("");

  let tp = 0, tf = 0;
  const cubiertas = new Set();
  const fallosGlobales = [];

  // El array `cubre` de cada suite se VALIDA contra la API real antes de sumarlo:
  // sin esto, un nombre inventado o mal escrito inflaba el porcentaje en silencio.
  const todas = Object.keys(api).filter(k => !k.startsWith("__"));
  const todosSet = new Set(todas);
  for (const arch of archivos) {
    const suite = require(path.join(__dirname, arch));
    if (suite.cubre) {
      for (const fn of suite.cubre) {
        if (!todosSet.has(fn)) {
          console.error(COL.mal + "Error: la suite '" + (suite.nombre || arch) + "' dice cubrir '" + fn + "', pero esa función no existe en el API." + COL.fin);
          process.exit(1);
        }
      }
    }
    const { t, res } = crearT();
    try { await suite.pruebas(t, api, env, cargar); }
    catch (e) { res.falla++; res.fallos.push({ desc: "(la suite lanzó)", msg: e.message }); }
    await Promise.all(res.pendientes);
    (suite.cubre || []).forEach(n => cubiertas.add(n));
    tp += res.pasa; tf += res.falla;
    const marca = res.falla ? COL.mal + "✗" : COL.ok + "✓";
    console.log(marca + COL.fin + " " + (suite.nombre || arch).padEnd(42) + COL.dim + res.pasa + " ok" + (res.falla ? COL.mal + "  " + res.falla + " FALLAN" : "") + COL.fin);
    res.fallos.forEach(f => { console.log("    " + COL.mal + "· " + f.desc + COL.fin); console.log("      " + COL.dim + f.msg + COL.fin); fallosGlobales.push(f); });
  }

  // cobertura real de funciones
  const sinCubrir = todas.filter(n => !cubiertas.has(n));
  const pct = (cubiertas.size / cargado.totalDeclaradas * 100);

  console.log("");
  console.log(COL.tit + "─".repeat(64) + COL.fin);
  console.log("  comprobaciones : " + COL.ok + tp + " pasan" + COL.fin + (tf ? "  " + COL.mal + tf + " fallan" + COL.fin : ""));
  console.log("  funciones cubiertas: " + cubiertas.size + " / " + cargado.totalDeclaradas + "  (" + pct.toFixed(1) + "%)");
  if (sinCubrir.length) {
    console.log("");
    console.log(COL.ama + "  sin cubrir (" + sinCubrir.length + "):" + COL.fin);
    for (let i = 0; i < sinCubrir.length; i += 6) console.log("    " + COL.dim + sinCubrir.slice(i, i + 6).join(", ") + COL.fin);
  }
  console.log(COL.tit + "─".repeat(64) + COL.fin);
  console.log("");

  // Hallado en revisión adversarial (2026-08-11): con exit(0) incondicional, todo el
  // banco era CONSULTIVO — un runner con "N fallan" salía verde y el CI lo aceptaba.
  // El código de salida debe decir la verdad: distinto de cero si algo falló.
  process.exit(tf ? 1 : 0);
}

main().catch(e => { console.error("error del ejecutor:", e); process.exit(2); });
