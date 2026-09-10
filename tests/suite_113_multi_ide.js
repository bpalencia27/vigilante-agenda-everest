// =====================================================================
//  SUITE 113 — Flujo multi-IDE: candado de archivos, compatibilidad
//              entre entornos y compuerta de fusión.
//
//  El repositorio se trabaja desde DOS entornos con modelos distintos. Lo
//  que esta suite ancla no es el producto (el userscript), sino las tres
//  herramientas que impiden que los dos carriles se pisen:
//
//    tools/vgl-lock.js     — candado por archivo (la única compuerta dura)
//    tools/compat-check.js — detección de deriva silenciosa entre entornos
//    tools/vgl-sync.js     — compuerta de fusión e integración entre ramas
//
//  Se prueban sobre directorios temporales: nunca tocan el `.vgl-locks/`
//  real del repositorio.
// =====================================================================

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const lock = require("../tools/vgl-lock.js");
const compat = require("../tools/compat-check.js");
const sync = require("../tools/vgl-sync.js");

module.exports = {
  nombre: "Flujo multi-IDE: candado de archivos, compatibilidad y compuerta de fusión",
  cubre: [], // suite de herramientas, no cubre funciones del userscript

  pruebas(t) {
    // Directorio de candados desechable para toda la suite.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vgl-locks-test-"));
    const T0 = Date.UTC(2026, 8, 9, 12, 0, 0); // 2026-09-09T12:00:00Z, reloj fijo

    try {
      // ---- 1. normalización de ruta: el mismo candado en Windows y en Linux ----
      t.caso("vgl-lock: la ruta se normaliza (mayúsculas, separadores, ./, //)", () => {
        t.igual(lock.normalizePath("./Vigilante_Agenda.user.js"), "vigilante_agenda.user.js");
        t.igual(lock.normalizePath("tools\\vgl-lock.js"), "tools/vgl-lock.js");
        t.igual(lock.normalizePath("  A//B  "), "a/b");
        t.igual(lock.normalizePath(path.join(lock.ROOT, "tools", "vgl-lock.js")), "tools/vgl-lock.js");
        t.igual(lock.normalizePath(""), "", "cadena vacía sigue vacía");
        t.igual(lock.normalizePath(null), "", "no-string no revienta");
      });

      // ---- 2. identidad estable del candado ----
      t.caso("vgl-lock: lockId es estable y colapsa variantes de la misma ruta", () => {
        const a = lock.lockId("tools/vgl-lock.js");
        const b = lock.lockId("./tools\\VGL-LOCK.js");
        t.igual(a, b, "misma ruta escrita distinto = mismo candado");
        t.igual(a.length, 12, "12 hex");
        t.falso(a === lock.lockId("tools/vgl-sync.js"), "archivos distintos = candados distintos");
      });

      // ---- 3. ATOMICIDAD: o se toma el lote completo o no se toma nada ----
      t.caso("vgl-lock: acquire es atómico — un archivo ajeno invalida TODO el lote", () => {
        const f1 = "tests/suite_113_multi_ide.js";
        const f2 = "tools/vgl-lock.js";
        const r1 = lock.acquire([f2], { env: "otro-ide", dir, now: T0 });
        t.cierto(r1.ok, "el otro entorno toma tools/vgl-lock.js");

        const r2 = lock.acquire([f1, f2], { env: "trae", dir, now: T0 });
        t.falso(r2.ok, "el lote entero se rechaza");
        t.igual(r2.reason, "bloqueado");
        t.igual(r2.conflicts.length, 1, "nombra el conflicto");
        t.igual(r2.conflicts[0].heldBy, "otro-ide");
        t.falso(fs.existsSync(lock.lockPath(f1, dir)), "NO quedó candado a medias del archivo libre");

        // y el mismo lote sin el archivo ajeno sí entra
        const r3 = lock.acquire([f1], { env: "trae", dir, now: T0 });
        t.cierto(r3.ok, "el archivo libre sí se puede tomar");
        lock.release([f1, f2], { dir, force: true });
      });

      // ---- 4. un candado ajeno vence y deja de estorbar ----
      t.caso("vgl-lock: un candado vencido deja de ser conflicto", () => {
        const f = "docs/FLUJO_MULTI_IDE.md";
        lock.acquire([f], { env: "otro-ide", dir, now: T0, ttl: 60 });
        const dentro = lock.conflictsFor([f], { env: "trae", dir, now: T0 + 30 * 60000 });
        t.igual(dentro.length, 1, "dentro del TTL sí bloquea");
        const fuera = lock.conflictsFor([f], { env: "trae", dir, now: T0 + 61 * 60000 });
        t.igual(fuera.length, 0, "vencido ya no bloquea");
        t.cierto(lock.isExpired(lock.readLock(f, dir), T0 + 61 * 60000), "isExpired lo confirma");
        lock.release([f], { dir, force: true });
      });

      // ---- 5. FAIL-OPEN: un JSON ilegible avisa, no bloquea ----
      t.caso("vgl-lock: candado ilegible = fail-open (no bloquea a nadie)", () => {
        const f = "package.json";
        fs.writeFileSync(lock.lockPath(f, dir), "{ esto no es json", "utf8");
        t.igual(lock.readLock(f, dir), null, "readLock devuelve null, no revienta");
        t.igual(lock.conflictsFor([f], { env: "trae", dir, now: T0 }).length, 0, "sin conflicto: fail-open");
        fs.unlinkSync(lock.lockPath(f, dir));
      });

      // ---- 6. el mismo entorno no se bloquea a sí mismo ----
      t.caso("vgl-lock: el dueño puede re-tomar su propio candado (idempotente)", () => {
        const f = "tests/runner.js";
        const a = lock.acquire([f], { env: "trae", dir, now: T0 });
        t.cierto(a.ok, "primera toma");
        const b = lock.acquire([f], { env: "trae", dir, now: T0 + 1000 });
        t.cierto(b.ok, "segunda toma del mismo entorno");
        t.igual(lock.conflictsFor([f], { env: "trae", dir, now: T0 + 2000 }).length, 0, "sin conflicto propio");
        lock.release([f], { dir });
      });

      // ---- 7. release respeta la propiedad del candado ----
      t.caso("vgl-lock: release ajeno se niega salvo --force", () => {
        const f = "vigilante_agenda.user.js";
        lock.acquire([f], { env: "otro-ide", dir, now: T0 });
        const denied = lock.release([f], { env: "trae", dir });
        t.falso(denied.ok, "no puede soltar lo ajeno");
        t.igual(denied.denied.length, 1);
        t.igual(denied.denied[0].heldBy, "otro-ide");
        t.cierto(fs.existsSync(lock.lockPath(f, dir)), "el candado sigue ahí");

        const forced = lock.release([f], { env: "trae", dir, force: true });
        t.cierto(forced.ok, "--force sí lo suelta");
        t.falso(fs.existsSync(lock.lockPath(f, dir)), "y desaparece del disco");

        const missing = lock.release([f], { env: "trae", dir });
        t.cierto(missing.ok, "soltar algo sin candado no es error");
        t.igual(missing.missing.length, 1);
      });

      // ---- 8. prune retira solo lo vencido ----
      t.caso("vgl-lock: prune retira vencidos y respeta los vivos", () => {
        lock.acquire(["a/viejo.js"], { env: "otro-ide", dir, now: T0, ttl: 10 });
        lock.acquire(["b/nuevo.js"], { env: "otro-ide", dir, now: T0, ttl: 600 });
        const r = lock.prune(dir, T0 + 20 * 60000);
        t.igual(r.removed.length, 1);
        t.igual(r.removed[0], "a/viejo.js");
        t.cierto(fs.existsSync(lock.lockPath("b/nuevo.js", dir)), "el vivo sigue");
        lock.release(["b/nuevo.js"], { dir, force: true });
      });

      // ---- 9. parser de flags compartido por los tres CLI ----
      t.caso("vgl-lock: parseArgs entiende --clave=valor y --bandera", () => {
        const p = lock.parseArgs(["archivo.js", "--env=trae", "--force", "--ttl=120"]);
        t.igual(p._.length, 1);
        t.igual(p._[0], "archivo.js");
        t.igual(p.flags.env, "trae");
        t.igual(p.flags.force, true);
        t.igual(p.flags.ttl, "120");
      });

      // ---- 10. compat-check: los 4 puntos de versión coinciden hoy ----
      t.caso("compat-check: la versión está sincronizada en sus 4 puntos", () => {
        const v = compat.readVersionPoints();
        t.cierto(!!v.header, "header @version legible");
        t.cierto(!!v.constV, "const VERSION legible");
        t.cierto(!!v.pkgV, "package.json legible");
        t.cierto(!!v.suiteV, "suite_75 legible");
        t.igual(v.header, v.constV, "header == const");
        t.igual(v.header, v.pkgV, "header == package.json");
        t.igual(v.header, v.suiteV, "header == suite_75");
      });

      // ---- 11. compat-check: el repo cumple las reglas duras de un solo archivo ----
      t.caso("compat-check: run() declara el repo COMPATIBLE y cubre las reglas duras", () => {
        const r = compat.run();
        t.cierto(r.ok, "sin fallos duros: " + r.checks.filter((c) => !c.ok && c.level === "fail").map((c) => c.id).join(", "));
        const ids = r.checks.map((c) => c.id);
        ["node_version", "version_sync", "no_runtime_deps", "single_file", "ci_gates", "runner"].forEach((id) => {
          t.cierto(ids.indexOf(id) !== -1, "check presente: " + id);
        });
        t.cierto(compat.BRANCH_PREFIXES.indexOf("alt-ide") !== -1, "el carril alt-ide está reconocido");
      });

      // ---- 12. vgl-sync: lee la cuenta real del runner ----
      t.caso("vgl-sync: parseRunnerOutput extrae pasan/fallan (y no inventa si no hay cuenta)", () => {
        t.igual(sync.parseRunnerOutput("comprobaciones : 3781 pasan"), { pasan: 3781, fallan: 0 });
        t.igual(sync.parseRunnerOutput("comprobaciones : 3781 pasan\n2 fallan"), { pasan: 3781, fallan: 2 });
        // El runner colorea la cuenta: el número va precedido de un ANSI. Si no se
        // limpia, la compuerta cree que el runner "murió en silencio" (regresión real).
        t.igual(sync.parseRunnerOutput("  comprobaciones : \x1b[32m3785 pasan\x1b[0m"), { pasan: 3785, fallan: 0 });
        t.igual(sync.parseRunnerOutput("  comprobaciones : \x1b[32m3785 pasan\x1b[0m  \x1b[31m2 fallan\x1b[0m"), { pasan: 3785, fallan: 2 });
        t.igual(sync.parseRunnerOutput("salida sin cuenta"), { pasan: null, fallan: 0 });
        t.igual(sync.parseRunnerOutput(""), { pasan: null, fallan: 0 });
      });

      // ---- 13. vgl-sync: el diff entre ramas es real, y una rama inexistente se declara ----
      t.caso("vgl-sync: changedFiles distingue 'sin cambios' de 'no hay ancestro'", () => {
        const cero = sync.changedFiles("HEAD", "HEAD");
        t.cierto(cero !== null, "HEAD contra sí mismo tiene ancestro");
        t.igual(cero.length, 0, "y ningún archivo cambiado");
        t.igual(sync.changedFiles("HEAD", "rama-que-no-existe-xyz"), null, "rama inexistente = null, no []");
      });

      // ---- 14. la compuerta de fusión conoce su registro ----
      t.caso("vgl-sync: registryHasEntry distingue la rama registrada de la desconocida", () => {
        t.cierto(sync.registryHasEntry("alt-ide/multi-ide-workflow-2026-09-09"), "esta rama está en el registro");
        t.falso(sync.registryHasEntry("rama-que-no-existe-xyz"), "una inventada no");
      });

      // ---- 15. la compuerta falla en cerrado si le falta el argumento ----
      t.caso("vgl-sync: gate sin --from falla cerrado y no toca el árbol", () => {
        const r = sync.gate({});
        t.falso(r.ok, "sin rama no hay compuerta");
        t.igual(r.steps.length, 1);
        t.igual(r.steps[0].id, "argumentos");
        t.falso(r.steps[0].ok);
      });

    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* limpieza best-effort */ }
    }
  },
};
