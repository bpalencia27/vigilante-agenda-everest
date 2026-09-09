// =====================================================================
//  vgl-lock — bloqueo de archivos entre entornos de desarrollo
//
//  Motivo: el mismo repo se trabaja desde DOS entornos con modelos distintos
//  (este IDE + un IDE alterno). Sin un candado explícito, los dos editan el
//  mismo archivo, cada uno corre sus pruebas en verde y el conflicto aparece
//  al fusionar — cuando ya nadie recuerda qué se quería cambiar.
//
//  Regla del proyecto que este candado respeta: FAIL-OPEN documentado. Si el
//  candado no puede leerse (JSON corrupto, permisos), NO bloquea: avisa. Un
//  candado que impide trabajar por un bug propio es peor que el conflicto que
//  evita. La única compuerta DURA es el pre-commit cuando el lock es legible y
//  pertenece a otro entorno.
//
//  Estado: .vgl-locks/<sha1(ruta_normalizada)[0..12]>.json — VERSIONADO, porque
//  el repositorio es el único canal compartido entre entornos. Un archivo por
//  ruta evita que dos candados distintos choquen entre sí.
//
//  Uso:
//    node tools/vgl-lock.js acquire <ruta>... [--env=..] [--model=..] [--task=..] [--ttl=min]
//    node tools/vgl-lock.js release <ruta>... [--env=..] [--force]
//    node tools/vgl-lock.js status [--json]
//    node tools/vgl-lock.js check [--staged] [--env=..] [--json]
//    node tools/vgl-lock.js prune
// =====================================================================
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LOCK_DIR = path.join(ROOT, ".vgl-locks");
const ENV_FILE = path.join(ROOT, ".vgl-env.json");
const DEFAULT_TTL_MIN = 240;

// --- identidad ------------------------------------------------------------
// La ruta se normaliza a minúsculas a propósito: el candado debe valer igual
// en Windows (FS insensible a mayúsculas) y en Linux (sensible), o los dos
// entornos no se verían el mismo archivo.
function normalizePath(p) {
  if (typeof p !== "string" || !p.trim()) return "";
  let s = p.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (path.isAbsolute(s)) s = path.relative(ROOT, s).replace(/\\/g, "/");
  return s.replace(/\/+/g, "/").replace(/^\//, "").toLowerCase();
}

function lockId(file) {
  return crypto.createHash("sha1").update(normalizePath(file)).digest("hex").slice(0, 12);
}

function lockPath(file, dir) {
  return path.join(dir || LOCK_DIR, lockId(file) + ".json");
}

function defaultIdentity() {
  // Precedencia: --env/--model > .vgl-env.json > variables de entorno > host.
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(ENV_FILE, "utf8")); } catch (e) { cfg = {}; }
  const env = cfg.env || process.env.VGL_ENV || os.hostname() || "desconocido";
  const model = cfg.model || process.env.VGL_MODEL || "";
  return { env, model };
}

// --- lectura / expiración -------------------------------------------------
function nowMs(now) { return now === undefined ? Date.now() : now; }

function isExpired(lock, now) {
  if (!lock || !lock.expires) return true;
  const t = new Date(lock.expires).getTime();
  if (isNaN(t)) return true;
  return t <= nowMs(now);
}

function readLock(file, dir) {
  const p = lockPath(file, dir);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; }
}

function readLocks(dir) {
  const d = dir || LOCK_DIR;
  if (!fs.existsSync(d)) return [];
  const out = [];
  for (const f of fs.readdirSync(d)) {
    if (!/\.json$/.test(f)) continue;
    try { out.push(JSON.parse(fs.readFileSync(path.join(d, f), "utf8"))); } catch (e) { /* fail-open */ }
  }
  return out.sort((a, b) => String(a.file).localeCompare(String(b.file)));
}

// --- operaciones ----------------------------------------------------------
function conflictsFor(files, opts) {
  const o = opts || {};
  const env = o.env || defaultIdentity().env;
  const dir = o.dir || LOCK_DIR;
  const now = o.now;
  const list = (Array.isArray(files) ? files : [files]).map(normalizePath).filter(Boolean);
  const conflicts = [];
  for (const f of list) {
    const l = readLock(f, dir);
    if (!l) continue;
    if (l.env === env) continue;
    if (isExpired(l, now)) continue;
    conflicts.push({ file: f, heldBy: l.env, model: l.model || "", task: l.task || "", expires: l.expires });
  }
  return conflicts;
}

function acquire(files, opts) {
  const o = opts || {};
  const id = defaultIdentity();
  const env = o.env || id.env;
  const ttl = Number(o.ttl) > 0 ? Number(o.ttl) : DEFAULT_TTL_MIN;
  const dir = o.dir || LOCK_DIR;
  const list = (Array.isArray(files) ? files : [files]).map(normalizePath).filter(Boolean);
  if (!list.length) return { ok: false, reason: "sin_rutas", conflicts: [] };

  // Se comprueban TODAS antes de escribir NINGUNA: o se toma el lote completo
  // o no se toma nada. Un candado a medias es peor que ninguno.
  const conflicts = conflictsFor(list, { env, dir, now: o.now });
  if (conflicts.length) return { ok: false, reason: "bloqueado", conflicts };

  fs.mkdirSync(dir, { recursive: true });
  const locks = [];
  for (const f of list) {
    const lock = {
      v: 1,
      file: f,
      env,
      model: o.model || id.model,
      task: o.task || "",
      branch: o.branch || "",
      ts: new Date(nowMs(o.now)).toISOString(),
      ttl_min: ttl,
      expires: new Date(nowMs(o.now) + ttl * 60000).toISOString(),
    };
    fs.writeFileSync(lockPath(f, dir), JSON.stringify(lock, null, 2) + "\n", "utf8");
    locks.push(lock);
  }
  return { ok: true, reason: "adquirido", locks };
}

function release(files, opts) {
  const o = opts || {};
  const env = o.env || defaultIdentity().env;
  const dir = o.dir || LOCK_DIR;
  const list = (Array.isArray(files) ? files : [files]).map(normalizePath).filter(Boolean);
  const removed = [];
  const denied = [];
  const missing = [];
  for (const f of list) {
    const l = readLock(f, dir);
    if (!l) { missing.push(f); continue; }
    if (l.env !== env && !o.force) { denied.push({ file: f, heldBy: l.env }); continue; }
    try { fs.unlinkSync(lockPath(f, dir)); removed.push(f); } catch (e) { missing.push(f); }
  }
  return { ok: denied.length === 0, reason: denied.length ? "ajeno" : "liberado", removed, denied, missing };
}

function prune(dir, now) {
  const d = dir || LOCK_DIR;
  const removed = [];
  for (const l of readLocks(d)) {
    if (!isExpired(l, now)) continue;
    try { fs.unlinkSync(lockPath(l.file, d)); removed.push(l.file); } catch (e) { /* fail-open */ }
  }
  return { ok: true, removed };
}

// --- git ------------------------------------------------------------------
function stagedFiles() {
  const r = spawnSync("git", ["diff", "--cached", "--name-only"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) return [];
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (const a of argv) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(a);
    if (m) out.flags[m[1]] = m[2] === undefined ? true : m[2];
    else out._.push(a);
  }
  return out;
}

// --- CLI ------------------------------------------------------------------
function usage() {
  process.stderr.write([
    "vgl-lock — candado de archivos entre entornos",
    "  acquire <ruta>... [--env=..] [--model=..] [--task=..] [--ttl=min]",
    "  release <ruta>... [--env=..] [--force]",
    "  status [--json]",
    "  check [--staged] [--env=..] [--json]",
    "  prune",
    "",
  ].join("\n"));
}

function main(argv) {
  const cmd = argv[0];
  const { _, flags } = parseArgs(argv.slice(1));
  const id = defaultIdentity();
  const env = flags.env || id.env;

  if (cmd === "acquire") {
    const r = acquire(_, { env, model: flags.model, task: flags.task, ttl: flags.ttl, branch: flags.branch });
    if (r.ok) {
      for (const l of r.locks) process.stdout.write("lock OK   " + l.file + "  (" + l.env + (l.model ? "/" + l.model : "") + ", expira " + l.expires + ")\n");
      return 0;
    }
    if (r.reason === "sin_rutas") { usage(); return 2; }
    for (const c of r.conflicts) process.stdout.write("lock NO   " + c.file + "  lo tiene " + c.heldBy + (c.model ? "/" + c.model : "") + " hasta " + c.expires + (c.task ? "  (" + c.task + ")" : "") + "\n");
    return 1;
  }

  if (cmd === "release") {
    const r = release(_, { env, force: !!flags.force });
    for (const f of r.removed) process.stdout.write("unlock OK " + f + "\n");
    for (const f of r.missing) process.stdout.write("unlock -- " + f + " (no había candado)\n");
    for (const d of r.denied) process.stdout.write("unlock NO " + d.file + "  lo tiene " + d.heldBy + " (usa --force solo si estás seguro)\n");
    if (_.length === 0) { usage(); return 2; }
    return r.ok ? 0 : 1;
  }

  if (cmd === "status") {
    const locks = readLocks();
    if (flags.json) { process.stdout.write(JSON.stringify(locks, null, 2) + "\n"); return 0; }
    if (!locks.length) { process.stdout.write("sin candados\n"); return 0; }
    for (const l of locks) {
      process.stdout.write((isExpired(l) ? "EXPIRO " : "ACTIVO ") + l.file + "  " + l.env + (l.model ? "/" + l.model : "") + "  hasta " + l.expires + "\n");
    }
    return 0;
  }

  if (cmd === "check") {
    const files = flags.staged ? stagedFiles() : _;
    if (!files.length) { process.stdout.write("nada que comprobar\n"); return 0; }
    const conflicts = conflictsFor(files, { env });
    if (flags.json) { process.stdout.write(JSON.stringify(conflicts, null, 2) + "\n"); return conflicts.length ? 1 : 0; }
    if (!conflicts.length) { process.stdout.write("sin conflictos de candado (" + files.length + " archivo(s))\n"); return 0; }
    for (const c of conflicts) process.stdout.write("CONFLICTO " + c.file + "  lo tiene " + c.heldBy + (c.model ? "/" + c.model : "") + " hasta " + c.expires + "\n");
    return 1;
  }

  if (cmd === "prune") {
    const r = prune();
    process.stdout.write("candados expirados retirados: " + r.removed.length + "\n");
    for (const f of r.removed) process.stdout.write("  - " + f + "\n");
    return 0;
  }

  usage();
  return 2;
}

module.exports = {
  ROOT, LOCK_DIR, ENV_FILE, DEFAULT_TTL_MIN,
  normalizePath, lockId, lockPath, defaultIdentity,
  isExpired, readLock, readLocks, conflictsFor,
  acquire, release, prune, stagedFiles, parseArgs, main,
};

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
