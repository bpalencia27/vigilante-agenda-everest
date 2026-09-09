// =====================================================================
//  compat-check — ¿los dos entornos siguen siendo el MISMO proyecto?
//
//  Motivo: este repo se trabaja desde dos IDE con modelos distintos. El riesgo
//  real no es el conflicto de texto (para eso está vgl-lock), es la DERIVA
//  silenciosa: un entorno sube la versión en package.json y no en el userscript,
//  o introduce un `import`, o cambia MIN_COVERAGE en el CI. Cada entorno por
//  separado sigue "en verde" y el merge produce un producto que no es ninguno
//  de los dos.
//
//  Este verificador NO toca nada: lee y compara. Sale 1 si algún punto DURO
//  difiere, 0 si solo hay avisos.
//
//  Uso: node tools/compat-check.js [--json]
// =====================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const USERSCRIPT = path.join(ROOT, "vigilante_agenda.user.js");
const PKG = path.join(ROOT, "package.json");
const WORKFLOW = path.join(ROOT, ".github", "workflows", "tests.yml");
const RUNNER = path.join(ROOT, "tests", "runner.js");
const SUITE_VERSION = path.join(ROOT, "tests", "suite_75_disco.js");

// Prefijos de rama aceptados por el repo. `alt-ide/` es el carril del IDE alterno.
const BRANCH_PREFIXES = ["main", "master", "claude", "trae", "alt-ide", "bolt", "palette",
  "sentinel", "jules", "feat", "fix", "chore", "tests", "test", "docs", "revert"];

function read(p) { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } }

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    id: "node_version", level: "fail",
    ok: major >= 18,
    detail: "Node " + process.versions.node + " (el CI corre 18/20/22; se exige >=18)",
  };
}

// Los CUATRO puntos que el proyecto obliga a subir juntos (CONTRIBUTING.md).
function readVersionPoints() {
  const src = read(USERSCRIPT) || "";
  const pkg = read(PKG) || "";
  const suite = read(SUITE_VERSION) || "";
  const header = (/^\/\/\s*@version\s+(\S+)/m.exec(src) || [])[1] || null;
  const constV = (/const VERSION[\s\S]{0,240}?\|\|\s*"([^"]+)"/.exec(src) || [])[1] || null;
  const pkgV = (() => { try { return JSON.parse(pkg).version || null; } catch (e) { return null; } })();
  const suiteV = (/t\.igual\(fila\.ver,\s*"([^"]+)"/.exec(suite) || [])[1] || null;
  return { header, constV, pkgV, suiteV };
}

function checkVersionSync() {
  const v = readVersionPoints();
  const vals = [v.header, v.constV, v.pkgV, v.suiteV];
  const faltan = vals.filter((x) => !x).length;
  const unicos = Array.from(new Set(vals.filter(Boolean)));
  return {
    id: "version_sync", level: "fail",
    ok: faltan === 0 && unicos.length === 1,
    detail: "header=" + v.header + " const=" + v.constV + " package=" + v.pkgV + " suite_75=" + v.suiteV,
  };
}

function checkNoRuntimeDeps() {
  let pkg = {};
  try { pkg = JSON.parse(read(PKG) || "{}"); } catch (e) { pkg = {}; }
  const deps = Object.keys(pkg.dependencies || {});
  return {
    id: "no_runtime_deps", level: "fail",
    ok: deps.length === 0,
    detail: deps.length ? "dependencias de runtime: " + deps.join(", ") : "solo devDependencies (regla de un solo archivo)",
  };
}

// El userscript se instala en Tampermonkey como UN archivo: cualquier import/export
// lo rompe. Se escanean líneas reales, ignorando comentarios.
function checkSingleFile() {
  const src = read(USERSCRIPT);
  if (src === null) return { id: "single_file", level: "fail", ok: false, detail: "no se pudo leer vigilante_agenda.user.js" };
  const malas = [];
  src.split("\n").forEach((linea, i) => {
    const limpia = linea.replace(/^\s*\/\/.*$/, "").replace(/\/\/.*$/, "");
    if (/^\s*(import|export)\s/.test(limpia)) malas.push(i + 1);
  });
  return {
    id: "single_file", level: "fail",
    ok: malas.length === 0,
    detail: malas.length ? "import/export en las líneas " + malas.slice(0, 5).join(", ") : "IIFE puro, sin import/export",
  };
}

function checkCiGates() {
  const yml = read(WORKFLOW);
  if (yml === null) return { id: "ci_gates", level: "fail", ok: false, detail: "falta .github/workflows/tests.yml" };
  const tieneMin = /MIN_COVERAGE/.test(yml);
  const tieneTz = /America\/Bogota/.test(yml);
  return {
    id: "ci_gates", level: "fail",
    ok: tieneMin && tieneTz,
    detail: "MIN_COVERAGE=" + tieneMin + " TZ=" + tieneTz,
  };
}

function checkRunner() {
  const ok = fs.existsSync(RUNNER);
  return { id: "runner", level: "fail", ok, detail: ok ? "tests/runner.js presente" : "falta tests/runner.js" };
}

function checkBranch() {
  const r = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ROOT, encoding: "utf8" });
  const br = (r.stdout || "").trim();
  if (!br || br === "HEAD") return { id: "branch_convention", level: "warn", ok: true, detail: "HEAD desprendido: no aplica" };
  const pre = br.split("/")[0];
  const ok = BRANCH_PREFIXES.indexOf(pre) !== -1;
  return {
    id: "branch_convention", level: "warn",
    ok,
    detail: ok ? "rama '" + br + "' usa un prefijo conocido" : "rama '" + br + "' no usa ningún prefijo de " + BRANCH_PREFIXES.join("/"),
  };
}

function checkEngines() {
  let pkg = {};
  try { pkg = JSON.parse(read(PKG) || "{}"); } catch (e) { pkg = {}; }
  const engines = (pkg.engines || {}).node;
  return {
    id: "engines_declared", level: "warn",
    ok: !!engines,
    detail: engines ? "engines.node=" + engines : "package.json no declara engines.node (el CI sí fija 18/20/22)",
  };
}

function run() {
  const checks = [
    checkNodeVersion(), checkVersionSync(), checkNoRuntimeDeps(), checkSingleFile(),
    checkCiGates(), checkRunner(), checkBranch(), checkEngines(),
  ];
  return { ok: checks.every((c) => c.ok || c.level !== "fail"), checks };
}

function main(argv) {
  const json = argv.indexOf("--json") !== -1;
  const r = run();
  if (json) { process.stdout.write(JSON.stringify(r, null, 2) + "\n"); return r.ok ? 0 : 1; }
  for (const c of r.checks) {
    const tag = c.ok ? "OK  " : (c.level === "fail" ? "FALLA" : "AVISO");
    process.stdout.write(tag.padEnd(6) + c.id.padEnd(20) + c.detail + "\n");
  }
  process.stdout.write((r.ok ? "COMPATIBLE" : "INCOMPATIBLE") + " — " + r.checks.filter((c) => !c.ok && c.level === "fail").length + " fallo(s) duro(s)\n");
  return r.ok ? 0 : 1;
}

module.exports = { ROOT, BRANCH_PREFIXES, readVersionPoints, run, main };

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
