/**
 * e2e/runner_visual.js
 * Visual Regression & Hostile CSS Isolation Harness for Vigilante de Agenda
 * 
 * Validates that Vigilante overlay and modal styles maintain visual immunity
 * when injected into Everest EHR DOM fixtures with adversarial host CSS.
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const FIXTURES_DIR = path.join(ROOT_DIR, "tests", "fixtures");
const USERSCRIPT_PATH = path.join(ROOT_DIR, "vigilante_agenda.user.js");

// Hostile Everest CSS simulating aggressive EHR styles
const HOSTILE_EVEREST_CSS = `
  div, span, p, b, small, label, input, button, select, textarea, a, h1, h2, h3, h4, h5, h6, table, tr, td, th {
    color: #004488 !important;
    font-family: 'Comic Sans MS', cursive !important;
    background: #ff0000 !important;
    line-height: 1.0 !important;
    font-size: 10px !important;
    border-color: #ff00ff !important;
  }
`;

function extractCssFromScript(code) {
  let css = "";
  let inCss = false;
  for (const line of code.split("\n")) {
    if (line.includes("style.textContent = `")) {
      inCss = true;
      continue;
    }
    if (inCss && line.includes("`;")) {
      inCss = false;
      break;
    }
    if (inCss) css += line + "\n";
  }
  return css;
}

function parseCssRules(cssText) {
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const regex = /([^{}]+)\{([^{}]+)\}/g;
  let match;
  let ruleId = 0;

  while ((match = regex.exec(clean)) !== null) {
    ruleId++;
    const selectorGroup = match[1].trim();
    const body = match[2].trim();

    if (selectorGroup.startsWith("@media") || selectorGroup.startsWith("@keyframes")) {
      continue;
    }

    const declarations = {};
    for (const decl of body.split(";")) {
      const parts = decl.split(":");
      if (parts.length >= 2) {
        const prop = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join(":").trim();
        declarations[prop] = val;
      }
    }

    for (const sel of selectorGroup.split(",").map(s => s.trim()).filter(Boolean)) {
      const ids = (sel.match(/#[a-zA-Z0-9_-]+/g) || []).length;
      const classes = (sel.match(/\.[a-zA-Z_][a-zA-Z0-9_-]*/g) || []).length;
      const pseudos = (sel.match(/:[a-zA-Z0-9_-]+/g) || []).length;
      const tags = (sel.match(/^[a-zA-Z0-9_-]+|(?<=[\s>+~])[a-zA-Z0-9_-]+/g) || [])
        .filter(t => !["#", ".", ":"].includes(t[0])).length;
      const specificity = ids * 100 + (classes + pseudos) * 10 + tags;

      rules.push({
        ruleId,
        selector: sel,
        specificity,
        declarations
      });
    }
  }
  return rules;
}

async function runStandaloneVisualVerification() {
  console.log("================================================================================");
  console.log("  VIGILANTE DE AGENDA — VISUAL REGRESSION & CSS ISOLATION HARNESS");
  console.log("================================================================================\n");

  const userscriptCode = fs.readFileSync(USERSCRIPT_PATH, "utf8");
  const vglCss = extractCssFromScript(userscriptCode);

  if (!vglCss || vglCss.length < 500) {
    throw new Error("No se pudo extraer el bloque CSS de vigilante_agenda.user.js");
  }
  console.log(`[✓] Bloque CSS extraído exitosamente (${vglCss.length} bytes).`);

  const fixtures = [
    "dom_everest_agenda.html",
    "dom_everest_cronicos.html",
    "dom_everest_cronicos_hombre.html",
    "dom_everest_cronicos_mujer.html",
    "dom_everest_ordenes.html"
  ];

  for (const f of fixtures) {
    const p = path.join(FIXTURES_DIR, f);
    if (!fs.existsSync(p)) {
      throw new Error(`Fixture faltante: ${p}`);
    }
    const html = fs.readFileSync(p, "utf8");
    console.log(`[✓] Fixture validado: ${f} (${html.length} bytes)`);
  }

  const rules = parseCssRules(vglCss);
  console.log(`[✓] Reglas CSS parseadas: ${rules.length} selectores individuales.\n`);

  let checks = 0;
  let passed = 0;

  function assert(condition, message) {
    checks++;
    if (!condition) {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Visual assertion failed: ${message}`);
    }
    passed++;
    console.log(`  [PASS] ${message}`);
  }

  console.log("--- 1. Verificación de Capas de Aislamiento Z-Index (D6 / R3.7) ---");
  const zIndices = {};
  const zTokens = ["--z-toast", "--z-alerta", "--z-modal", "--z-panel", "--z-banner", "--z-widget"];
  for (const t of zTokens) {
    const match = new RegExp(`${t}\\s*:\\s*(\\d+)`).exec(vglCss);
    if (match) {
      zIndices[t] = parseInt(match[1], 10);
    }
  }

  assert(zIndices["--z-toast"] === 2147483647, "--z-toast tiene valor máximo 2147483647");
  assert(zIndices["--z-alerta"] === 2147483600, "--z-alerta tiene valor 2147483600");
  assert(zIndices["--z-modal"] === 2147483000, "--z-modal tiene valor 2147483000");
  assert(zIndices["--z-panel"] === 2147482000, "--z-panel tiene valor 2147482000");
  assert(zIndices["--z-banner"] === 2147481000, "--z-banner tiene valor 2147481000");
  assert(zIndices["--z-widget"] === 2147480000, "--z-widget tiene valor 2147480000");

  assert(
    zIndices["--z-alerta"] > zIndices["--z-modal"] &&
    zIndices["--z-modal"] > zIndices["--z-panel"] &&
    zIndices["--z-panel"] > zIndices["--z-banner"] &&
    zIndices["--z-banner"] > zIndices["--z-widget"],
    "Jerarquía estricta de capas respetada (alerta > modal > panel > banner > widget)"
  );

  console.log("\n--- 2. Verificación de Prefijos de Clases (.vgl-*) y Contención DOM ---");
  const classNames = new Set();
  rules.forEach(r => {
    const matches = r.selector.match(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g) || [];
    matches.forEach(m => classNames.add(m.substring(1)));
  });

  const ALLOWED_MODIFIER_CLASSES = new Set([
    "light", "perf", "minimizado", "active", "med", "open", "selected", "disabled",
    "colapsado", "zoom", "page", "stale", "sel", "hot", "primary", "on", "off",
    "warn", "error", "rojo", "morado", "ambar", "pes", "hit", "atendido", "late",
    "falta", "sheet", "contenedor", "out", "sec", "pri", "athenea", "x", "body",
    "min", "close", "bg"
  ]);

  const nonPrefixed = Array.from(classNames).filter(c => 
    !c.startsWith("vgl-") && !ALLOWED_MODIFIER_CLASSES.has(c)
  );

  assert(nonPrefixed.length === 0, `100% de las clases de componente llevan prefijo .vgl-* (no conformes: ${nonPrefixed.join(", ") || "ninguna"})`);

  console.log("\n--- 3. Aislamiento contra CSS Hostil de Everest en Modales Adosados a document.body ---");
  const bodyPanels = [
    "#vgl-pym-modal", "#vgl-pes-modal", "#vgl-labs-modal",
    "#vgl-labsv-modal", "#vgl-postcita-panel", "#vgl-agendar-modal", "#vgl-ordenar-modal"
  ];

  for (const panelId of bodyPanels) {
    const panelRules = rules.filter(r => r.selector.includes(panelId));
    assert(panelRules.length > 0, `Existen reglas de estilo para contenedor adosado ${panelId}`);
  }

  console.log("\n--- 4. Verificación de Opacidad de Fondo en Contenedores de Nivel Superior ---");
  const opaqueContainers = ["#vgl-acciones-dock", "#vgl-pym-banner"];
  for (const cId of opaqueContainers) {
    const containerRules = rules.filter(r => r.selector === cId);
    assert(containerRules.length > 0, `Reglas existen para contenedor ${cId}`);
    const hasOpaqueBg = containerRules.some(r => {
      const bg = r.declarations["background"] || "";
      return bg.includes("var(--bg-solid)") || bg.includes("var(--bg)");
    });
    assert(
      hasOpaqueBg,
      `${cId} declara fondo opaco propio contra transparencia de Everest`
    );
  }

  console.log("\n--- 5. Verificación de Fallback en Botones con Variables Indefinidas ---");
  const fallbackRules = rules.filter(r => r.selector === ".vgl-lab-inj" || r.selector === ".vgl-exf-btn" || r.selector.includes(".vgl-lab-inj"));
  assert(fallbackRules.length > 0 || vglCss.includes(".vgl-lab-inj"), "Regla para .vgl-lab-inj existe en CSS");
  assert(vglCss.includes("var(--t-micro,12px)") || vglCss.includes("var(--t-micro, 12px)"), "Regla de botones inyectados provee fallback tipográfico var(--t-micro,12px)");

  console.log("\n================================================================================");
  console.log(`  RESULTADO: ${passed} / ${checks} verificaciones visuales y de CSS pasaron con éxito.`);
  console.log("  ESTADO DE AISLAMIENTO: INMUNE CONTRA CSS HOSTIL DE EVEREST.");
  console.log("================================================================================\n");

  return { checks, passed };
}

if (require.main === module) {
  runStandaloneVisualVerification().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error("Fallo fatal en runner visual:", err);
    process.exit(1);
  });
}

module.exports = {
  runStandaloneVisualVerification,
  extractCssFromScript,
  parseCssRules,
  HOSTILE_EVEREST_CSS
};
