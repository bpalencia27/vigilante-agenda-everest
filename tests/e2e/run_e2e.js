// =====================================================================
// E2E DEL VIGILANTE — simulación de uso real en Chromium (Playwright).
// DevDependency: NO toca el userscript (que sigue sin deps de runtime).
// Corre:  npm run test:e2e   (o: node tests/e2e/run_e2e.js)
// Usa el chromium YA presente en el caché de playwright (executablePath
// autodetectado) — el CDN de playwright.dev no hace falta.
// =====================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright");

const REPO = path.join(__dirname, "..", "..");
const US = path.join(REPO, "vigilante_agenda.user.js");
// Fixture: ruta /viva/HCHealth (exigida por _enModuloHCHealth) + una cita con los
// marcadores que seccionActiva() exige (.labelHora + .status-label, CONFIG.SEL).
// Sin ese PAR el panel se auto-dockea a la pastilla (setWinState "dock") y el E2E
// mediría un display:none correcto pero inútil para simular uso real.
const HTML_EVEREST = "<!doctype html><html><head><title>Everest E2E</title></head><body><div id='app'>"
  + "<div class='card'><div class='card-body'>"
  + "<div class='text-uppercase fw-bold'>Paciente De Prueba E2e</div>"
  + "<div class='text-muted'>C.C. 900000001</div>"
  + "<span class='labelHora'>7:30 a. m.</span>"
  + "<span class='status-label'>En sala</span>"
  + "</div></div></div></body></html>";

function chromiumEnCache() {
  const base = path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    for (const sub of ["chrome-win64", "chrome-win"]) {
      const exe = path.join(base, dirs[i], sub, "chrome.exe");
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

let pasa = 0, falla = 0;
function ok(msg) { pasa++; console.log("  \x1b[32m✓\x1b[0m " + msg); }
function mal(msg, detalle) { falla++; console.log("  \x1b[31m✗\x1b[0m " + msg + (detalle ? " — " + detalle : "")); }

// Contexto con stubs Tampermonkey; semilla = null ⇒ navegador "desconocido".
async function contextoConSemilla(browser, semilla) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(() => {
    const gm = {};
    window.GM_setValue = (k, v) => { gm[k] = v; };
    window.GM_getValue = (k, d) => (k in gm ? gm[k] : d);
    window.GM_deleteValue = (k) => { delete gm[k]; };
    window.GM_listValues = () => Object.keys(gm);
    window.GM_info = { script: { version: window.__vglSemillaVersion || "" } };
    window.GM_xmlhttpRequest = (o) => {
      setTimeout(() => { try { (o.onerror || (() => {}))({ error: "e2e-sin-red", status: 0 }); } catch (e) {} }, 5);
    };
    window.GM_addStyle = (css) => { const s = document.createElement("style"); s.textContent = css; document.head && document.head.appendChild(s); return s; };
    window.__vglGm = gm;
    window.addEventListener("DOMContentLoaded", () => {
      const sem = window.__vglSemilla;
      if (!sem) return;
      try {
        if (sem.accesoLista) localStorage.setItem("vgl_acceso_lista", JSON.stringify(sem.accesoLista));
        if (sem.user) localStorage.setItem("user", JSON.stringify(sem.user));
        if (sem.terminosAcepta) gm["vgl_terminos_acepta"] = sem.terminosAcepta;
        if (sem.identidad) gm["vgl_identidad_medico_cache"] = JSON.stringify(sem.identidad);
      } catch (e) {}
    });
  });
  if (semilla) {
    await ctx.addInitScript(({ sem, version }) => {
      window.__vglSemilla = sem;
      window.__vglSemillaVersion = version;
    }, { sem: semilla, version: "18.3.6" });
  }
  await ctx.route("**/*", (r) => r.fulfill({ contentType: "text/html", body: HTML_EVEREST }));
  return ctx;
}

async function montarYArrancar(ctx, fuente) {
  const page = await ctx.newPage();
  const consola = [];
  page.on("console", (m) => consola.push(m.type() + ": " + m.text()));
  page.on("pageerror", (e) => consola.push("pageerror: " + String(e).slice(0, 160)));
  await page.goto("http://e2e.local/viva/HCHealth");
  await page.addScriptTag({ content: fuente });
  return { page, consola };
}

async function main() {
  const exe = chromiumEnCache();
  if (!exe) { console.error("Sin chromium en caché. Corre: npx playwright install chromium"); process.exit(2); }
  console.log("E2E — chromium:", path.basename(path.dirname(path.dirname(exe))));
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const fuente = fs.readFileSync(US, "utf8");

  // Semilla: médico SYN del padrón, consentimiento v1.1 vigente, identidad fresca.
  const semillaMedico = {
    accesoLista: { version: "e2e-1", perfiles: { COMPLETO: [{ uid: 101, nombre: "Prueba E2e Uno" }], LABORATORIOS: [] }, blocklist: [] },
    user: { username: "e2e", userIdentity: "x" },
    terminosAcepta: { version: "1.1", ts: Date.now(), id: "uid:101" },
    identidad: { e2e: { id: 101, name: "Prueba E2e Uno", ts: Date.now() } }
  };

  // ── 1..3: médico autorizado y consentido ──
  const ctx1 = await contextoConSemilla(browser, semillaMedico);
  const { page, consola } = await montarYArrancar(ctx1, fuente);
  let montado = true;
  // state:"attached" — distinguir "no está en el DOM" de "está pero oculto"
  // (waitForSelector por defecto espera visible y miente si el panel nace oculto).
  try { await page.waitForSelector("#vgl-root", { timeout: 15000, state: "attached" }); } catch (e) { montado = false; }
  if (montado) {
    ok("#vgl-root montado tras la compuerta (padrón + consentimiento v1.1)");
    const bg = await page.evaluate(() => getComputedStyle(document.getElementById("vgl-root")).backgroundColor);
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") ok("estilo computado del panel: " + bg); else mal("panel sin fondo computado", String(bg));
    await page.waitForTimeout(2500);
    const vivo = await page.evaluate(() => !!document.getElementById("vgl-root") && !document.getElementById("vgl-pausa-clinica"));
    if (vivo) ok("a los 2,5 s el panel sigue vivo (sin kill, sin pausa clínica)"); else mal("el panel desapareció tras 2,5 s");
    // Visibilidad REAL (uso real): bounding box no vacío, no display:none,
    // body sin modo oculto y sin velo de términos encima.
    const vis = await page.evaluate(() => {
      const r = document.getElementById("vgl-root");
      if (!r) return { existe: false };
      const cs = getComputedStyle(r);
      const box = r.getBoundingClientRect();
      return { existe: true, display: cs.display, w: Math.round(box.width), h: Math.round(box.height), oculto: document.body.classList.contains("vgl-modo-oculto"), velo: !!document.getElementById("vgl-terminos-velo") };
    });
    if (vis.existe && vis.display !== "none" && vis.w > 50 && vis.h > 30 && !vis.oculto && !vis.velo) ok("panel VISIBLE al usuario (box " + vis.w + "x" + vis.h + "px, display=" + vis.display + ")");
    else mal("panel en el DOM pero NO visible", JSON.stringify(vis));
    // Lectura real de la agenda: la cita del fixture debe aparecer en el panel
    // (ciclo completo DOM de Everest → extractDoc/parseHoraMin → lista del HUD).
    const lectura = await page.evaluate(() => ({
      sum: (document.getElementById("vgl-sum") || {}).textContent || "",
      lista: (document.getElementById("vgl-list") || {}).textContent || "",
    }));
    if (/900000001/i.test(lectura.lista) || /900000001/i.test(lectura.sum)) ok("el panel LEYÓ la cita del fixture (cédula 900000001 en el HUD)");
    else mal("el panel no mostró la cita del fixture", JSON.stringify(lectura).slice(0, 220));
  } else {
    const diag = await page.evaluate(() => {
      const d = window.__vglGm && window.__vglGm["vgl_compuerta_diagnostico"];
      // textContent COMPLETO — un slice corto daba falso negativo (el rótulo
      // «VIGILANTE DE AGENDA» aparece tras ~75 chars de comentarios =====).
      const hudStyle = Array.from(document.querySelectorAll("style")).some((s) => /VIGILANTE DE AGENDA/.test(s.textContent || ""));
      const vglIds = Array.from(document.querySelectorAll("[id^='vgl-']")).map((n) => n.id).slice(0, 12);
      const root = document.getElementById("vgl-root");
      return { diag: d || null, hudStyle, vglIds, rootExiste: !!root, rootVisible: !!root && root.offsetParent !== null, ready: document.readyState, lista: !!localStorage.getItem("vgl_acceso_lista"), user: !!localStorage.getItem("user"), gmKeys: window.__vglGm ? Object.keys(window.__vglGm) : [] };
    });
    mal("#vgl-root NO montó", "hudStyle=" + diag.hudStyle + " diag=" + JSON.stringify(diag).slice(0, 260));
    console.log("    CONSOLA COMPLETA:\n" + consola.join("\n    ").slice(0, 2200));
  }
  await ctx1.close();

  // ── 4: desconocido (sin semilla, contexto propio) → fail-closed ──
  const ctx2 = await contextoConSemilla(browser, null);
  const { page: page2, consola: consola2 } = await montarYArrancar(ctx2, fuente);
  await page2.waitForTimeout(1500);
  const cerrado = await page2.evaluate(() => !document.getElementById("vgl-root") && !document.getElementById("vgl-terminos-velo"));
  const diag2 = await page2.evaluate(() => (window.__vglGm && window.__vglGm["vgl_compuerta_diagnostico"]) || null);
  if (cerrado) ok("desconocido: silencio total (fail-closed)" + (diag2 ? " · motivo=" + diag2.motivo : "")); else mal("un desconocido vio UI", JSON.stringify(diag2).slice(0, 160) + " | " + consola2.slice(0, 3).join(" || ").slice(0, 200));
  await ctx2.close();

  await browser.close();
  console.log("");
  console.log("E2E: " + pasa + " pasan / " + falla + " fallan");
  process.exit(falla ? 1 : 0);
}

main().catch((e) => { console.error("E2E FALLO:", e); process.exit(1); });
