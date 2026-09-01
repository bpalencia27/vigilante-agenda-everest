// =====================================================================
//  AUDITORÍA DE COLOR DE LA ZONA DE RESUMEN — Chromium real, CSS real
//
//  Encargo del médico (01-sep, con captura): «SE SIGUE COLANDO EL AZUL DE EVEREST EN ESTA
//  SECCIÓN … REVISA BIEN LA ZONA DE RESUMEN AL 100% PARA CORREGIR TODOS LOS ERRORES QUE
//  PUDIERAN HABER».
//
//  Los tools/verificar_*.js anteriores comprueban una LISTA de clases escrita a mano: solo
//  ven lo que alguien se acordó de poner en la lista, y por eso `.vgl-prod-cap` —la única
//  clase del bloque de Productividad sin ninguna declaración de color— llevaba desde la
//  v17.0.0 sin que nadie la mirara. Este programa no lleva lista: toma el HTML REAL que
//  generan las funciones del Resumen, lo monta con el CSS REAL dentro de #vgl-root
//  #vgl-sheet, le tira encima un Everest hostil y mide el color computado de CADA nodo de
//  texto. Lo que salga con el color del adversario está secuestrado.
// =====================================================================
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { cargar } = require(path.join(__dirname, "..", "tests", "harness.js"));

const RUTA = path.join(__dirname, "..", "vigilante_agenda.user.js");
const code = fs.readFileSync(RUTA, "utf8");

// ---- CSS real, con los splices resueltos (mismo método que verificar_color_chromium.js) --
let css = "", inCss = false;
for (const l of code.split("\n")) {
  if (l.includes("style.textContent = `")) { inCss = true; continue; }
  if (inCss && l.includes("`;")) { inCss = false; break; }
  if (inCss) css += l + "\n";
}
for (let vuelta = 0; vuelta < 5; vuelta++) {
  let hubo = false;
  for (const m of css.matchAll(/\$\{_cssSeguro\(\(\) => (\w+)\)\}/g)) {
    const ini = code.indexOf("const " + m[1] + " = `");
    if (ini < 0) continue;
    const desde = ini + ("const " + m[1] + " = `").length;
    css = css.replace(m[0], code.slice(desde, code.indexOf("`;", desde)));
    hubo = true;
  }
  if (!hubo) break;
}
if (/\$\{/.test(css)) {
  console.log("AVISO: quedan marcadores sin resolver en el CSS extraído — la medición sería incompleta.");
}

// El adversario que prescribe CLAUDE.md: una regla de TIPO con !important sobre el color.
const HOSTIL = "#111827";
const EVEREST = `div,span,p,b,small,label,i,li,td,th,strong,em{color:${HOSTIL} !important}`;

// ---- HTML real de la zona de Resumen -------------------------------------------------
const c = cargar({ silencioso: true });
const hoy = "2026-09-01";
const reg = {
  "2026-08-31": { atendidas: Object.fromEntries(Array.from({ length: 13 }, (_, i) => ["d" + i + "|8:00", 1])) },
  "2026-09-01": { atendidas: Object.fromEntries(Array.from({ length: 10 }, (_, i) => ["e" + i + "|8:00", 1])), citados: 14 },
};
const vistas = c.api.mtrProductividadVistas(reg, hoy);
const piezas = [
  { que: "Productividad", html: c.api.mtrProductividadHtml(vistas) },
  { que: "Productividad (domingo)", html: c.api.mtrProductividadHtml(c.api.mtrProductividadVistas(reg, "2026-09-06")) },
];
try {
  const tel = c.api.mtrTableroTelemetria({ acciones: { "fn.agendar.open": 9, "cita.creada:12": 8, "fn.ia.gen": 12 } });
  piezas.push({ que: "Telemetría local", html: c.api.mtrTableroTelemetriaHtml(tel) });
} catch (e) { console.log("(no se pudo generar el tablero de telemetría: " + (e && e.message) + ")"); }

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const pag = await nav.newPage();
  const cuerpo = piezas.map((p, i) => `<div data-pieza="${i}">${p.html}</div>`).join("");
  await pag.setContent(
    `<style>${EVEREST}</style><style>${css}</style>` +
    `<body><div id="vgl-root"><div id="vgl-sheet">${cuerpo}</div></div></body>`
  );

  const filas = await pag.evaluate((hostil) => {
    const out = [];
    const raiz = document.getElementById("vgl-sheet");
    const tieneTextoPropio = (el) => Array.from(el.childNodes)
      .some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    raiz.querySelectorAll("*").forEach((el) => {
      if (!tieneTextoPropio(el)) return;
      const col = getComputedStyle(el).color;
      out.push({
        pieza: (el.closest("[data-pieza]") || {}).dataset ? el.closest("[data-pieza]").dataset.pieza : "?",
        tag: el.tagName.toLowerCase(),
        clase: el.getAttribute("class") || "(sin clase)",
        texto: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 46),
        color: col,
      });
    });
    return out;
  }, HOSTIL);

  // #111827 en rgb
  const COLOR_HOSTIL = "rgb(17, 24, 39)";
  console.log("CSS real extraído: " + css.length + " caracteres");
  console.log("Everest hostil: " + EVEREST + "\n");
  console.log("Nodos de texto medidos: " + filas.length + "\n");

  const malos = filas.filter((f) => f.color === COLOR_HOSTIL);
  for (const f of filas) {
    const marca = f.color === COLOR_HOSTIL ? "SECUESTRADO" : "ok         ";
    console.log(`  ${marca}  ${piezas[f.pieza] ? piezas[f.pieza].que.padEnd(24) : "?".padEnd(24)} ${f.clase.padEnd(26)} ${f.color.padEnd(22)} "${f.texto}"`);
  }
  console.log("");
  if (malos.length) {
    console.log("RESULTADO: " + malos.length + " nodo(s) pierden su color contra el CSS de Everest:");
    for (const m of malos) console.log("   · ." + m.clase + "  →  \"" + m.texto + "\"");
    process.exitCode = 1;
  } else {
    console.log("RESULTADO: ningún nodo de la zona de Resumen pierde su color contra el Everest hostil.");
  }
  await nav.close();
})();
