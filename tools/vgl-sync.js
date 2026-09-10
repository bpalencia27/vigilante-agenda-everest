// =====================================================================
//  vgl-sync — compuerta de fusión y prueba de integración entre entornos
//
//  Dos subcomandos, un solo motivo: que NINGÚN cambio cruce de un entorno a
//  otro sin pasar las mismas compuertas, y que los dos carriles se prueben
//  JUNTOS antes de que el conflicto aparezca en la rama de producción.
//
//    gate      — antes de fusionar: candados libres + banco verde + registro
//                de cambios + revisión humana declarada. No toca el árbol.
//    integrate — prueba real de las dos ramas combinadas en un worktree
//                desechable: fusiona y corre el banco COMPLETO sobre el
//                resultado. Nunca escribe en tu rama actual.
//
//  Uso:
//    node tools/vgl-sync.js gate --from=<rama> [--base=<rama>] [--env=..] [--reviewed-by=<quien>]
//    node tools/vgl-sync.js integrate --from=<rama> [--base=<rama>] [--keep]
// =====================================================================
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const lock = require("./vgl-lock.js");

const ROOT = path.resolve(__dirname, "..");
const REGISTRY = path.join(ROOT, "docs", "REGISTRO_CAMBIOS_ENTORNOS.md");
const DEFAULT_BASE = "claude/pym-agenda-blindaje-v12-4";

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd: cwd || ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function mergeBase(base, from) {
  const r = git(["merge-base", base, from]);
  return r.status === 0 ? r.out.trim() : null;
}

function changedFiles(base, from) {
  const mb = mergeBase(base, from);
  if (!mb) return null;
  const r = git(["diff", "--name-only", mb, from]);
  if (r.status !== 0) return null;
  return r.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

// El runner imprime «comprobaciones : 3781 pasan» y, si hay rojo, «N fallan».
// OJO: el número va precedido de un código ANSI de color (COL.ok). Sin quitarlo,
// la cuenta se lee como "no imprimió nada" y la compuerta acusaría un falso cuelgue.
function stripAnsi(s) {
  return String(s || "").replace(/\x1b\[[0-9;]*m/g, "");
}

function parseRunnerOutput(text) {
  const limpio = stripAnsi(text);
  const pasan = /comprobaciones\s*:\s*(\d+)\s*pasan/.exec(limpio);
  const fallan = /(\d+)\s*fallan/.exec(limpio);
  return {
    pasan: pasan ? Number(pasan[1]) : null,
    fallan: fallan ? Number(fallan[1]) : 0,
  };
}

function registryHasEntry(branch) {
  const src = fs.existsSync(REGISTRY) ? fs.readFileSync(REGISTRY, "utf8") : "";
  return src.indexOf(branch) !== -1;
}

function runBank(cwd) {
  const r = spawnSync(process.execPath, [path.join(cwd || ROOT, "tests", "runner.js")], {
    cwd: cwd || ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000,
  });
  const parsed = parseRunnerOutput((r.stdout || "") + (r.stderr || ""));
  return { ok: r.status === 0 && parsed.pasan !== null && parsed.fallan === 0, code: r.status, pasan: parsed.pasan, fallan: parsed.fallan };
}

function gate(opts) {
  const o = opts || {};
  const from = o.from;
  const base = o.base || DEFAULT_BASE;
  const steps = [];

  if (!from) return { ok: false, steps: [{ id: "argumentos", ok: false, detail: "falta --from=<rama>" }] };

  const files = changedFiles(base, from);
  steps.push({
    id: "diff", ok: files !== null,
    detail: files === null ? "no hay ancestro común entre " + base + " y " + from : files.length + " archivo(s) cambiado(s)",
  });
  if (files === null) return { ok: false, steps };

  const conflicts = lock.conflictsFor(files, { env: o.env });
  steps.push({
    id: "candados", ok: conflicts.length === 0,
    detail: conflicts.length ? conflicts.map((c) => c.file + " lo tiene " + c.heldBy).join("; ") : "ningún archivo cambiado está tomado por otro entorno",
  });

  const bank = o.skipTests ? { ok: true, pasan: null, fallan: 0, code: 0 } : runBank(ROOT);
  steps.push({
    id: "banco", ok: bank.ok,
    detail: o.skipTests ? "omitido por --skip-tests" : (bank.pasan === null ? "el runner no imprimió su cuenta (¿murió en silencio?)" : bank.pasan + " pasan / " + bank.fallan + " fallan"),
  });

  const reg = registryHasEntry(from);
  steps.push({
    id: "registro", ok: reg,
    detail: reg ? "docs/REGISTRO_CAMBIOS_ENTORNOS.md menciona " + from : "falta la fila de " + from + " en el registro de cambios",
  });

  const reviewed = !!(o.reviewedBy && String(o.reviewedBy).trim());
  steps.push({
    id: "revision", ok: reviewed,
    detail: reviewed ? "revisado por " + o.reviewedBy : "falta --reviewed-by=<quien revisó>",
  });

  return { ok: steps.every((s) => s.ok), steps };
}

function integrate(opts) {
  const o = opts || {};
  const from = o.from;
  const base = o.base || DEFAULT_BASE;
  const steps = [];
  if (!from) return { ok: false, steps: [{ id: "argumentos", ok: false, detail: "falta --from=<rama>" }] };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vgl-integrate-"));
  const add = git(["worktree", "add", "--detach", tmp, base]);
  steps.push({ id: "worktree", ok: add.status === 0, detail: add.status === 0 ? "worktree desechable en " + tmp : add.out.trim() });
  if (add.status !== 0) return { ok: false, steps };

  let result = { ok: false, steps };
  try {
    const merge = git(["merge", "--no-commit", "--no-ff", from], tmp);
    const unmerged = git(["diff", "--name-only", "--diff-filter=U"], tmp);
    const conflicted = unmerged.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    steps.push({
      id: "fusion", ok: merge.status === 0,
      detail: merge.status === 0 ? "sin conflictos de texto" : "CONFLICTOS: " + (conflicted.join(", ") || merge.out.trim().slice(0, 400)),
    });
    if (merge.status === 0) {
      const bank = runBank(tmp);
      steps.push({
        id: "banco_integrado", ok: bank.ok,
        detail: bank.pasan === null ? "el runner no imprimió su cuenta sobre la fusión" : bank.pasan + " pasan / " + bank.fallan + " fallan",
      });
    }
    result = { ok: steps.every((s) => s.ok), steps, tmp };
  } finally {
    if (!o.keep) {
      git(["worktree", "remove", "--force", tmp]);
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* fail-open */ }
    }
  }
  return result;
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

function printSteps(title, r) {
  process.stdout.write(title + "\n");
  for (const s of r.steps) process.stdout.write("  " + (s.ok ? "OK   " : "FALLA") + " " + s.id.padEnd(16) + s.detail + "\n");
  process.stdout.write((r.ok ? "PASA" : "NO PASA") + "\n");
}

function main(argv) {
  const cmd = argv[0];
  const { flags } = parseArgs(argv.slice(1));
  if (cmd === "gate") {
    const r = gate({ from: flags.from, base: flags.base, env: flags.env, reviewedBy: flags["reviewed-by"], skipTests: !!flags["skip-tests"] });
    printSteps("COMPUERTA DE FUSIÓN", r);
    return r.ok ? 0 : 1;
  }
  if (cmd === "integrate") {
    const r = integrate({ from: flags.from, base: flags.base, keep: !!flags.keep });
    printSteps("PRUEBA DE INTEGRACIÓN ENTRE RAMAS", r);
    return r.ok ? 0 : 1;
  }
  process.stderr.write("uso: node tools/vgl-sync.js gate|integrate --from=<rama> [--base=<rama>]\n");
  return 2;
}

module.exports = { ROOT, REGISTRY, DEFAULT_BASE, git, mergeBase, changedFiles, parseRunnerOutput, registryHasEntry, runBank, gate, integrate, parseArgs, main };

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
