// v18.0.123 (UI/UX UI#1-3) — PRESUPUESTO DE ESQUINAS, medido en Chromium de verdad.
// El panel ocupa la esquina inferior derecha. Los flotantes (avisos, post-cita, «Deshacer»,
// barra mínima, cartel de tareas) no pueden solaparse con él mientras esté a la vista, y
// tienen que RECUPERAR su esquina en cuanto el panel se pliega, va al dock o se oculta.
//
// Se mide con el <style> REAL que genera el script (mismo método que CLAUDE.md prescribe para
// el color), no con una copia recortada a mano.
const { chromium } = require("playwright");
const { cargar } = require("/home/user/vigilante-agenda-everest/tests/harness.js");

function cssReal() {
  const c = cargar({ silencioso: true });
  try { c.api.buildOverlay(); } catch (e) {}
  const trozos = [];
  const rec = (n) => { if (!n) return; if (n.tagName === "STYLE" && n.textContent) trozos.push(n.textContent); (n.children || []).forEach(rec); };
  rec(c.env.doc.head); rec(c.env.doc.body);
  return trozos.join("\n");
}

// Geometría real del panel: 690 px de ancho, pegado a 22 px del borde derecho (ver #vgl-root).
const PANEL = { ancho: 690, derecha: 22, alto: 620, abajo: 22 };

const FLOTANTES = [
  { id: "vgl-toasts", que: "avisos (toasts)", html: '<div id="vgl-toasts"><div style="width:390px;height:185px"></div></div>' },
  { id: "vgl-postcita-panel", que: "panel post-cita", html: '<div id="vgl-postcita-panel"><div style="width:336px;height:160px"></div></div>' },
  { id: "vgl-deshacer-llenado", que: "«Deshacer»", html: '<div id="vgl-deshacer-llenado"><div style="width:176px;height:38px"></div></div>' },
  { id: "vgl-min-bar", que: "barra mínima", html: '<div id="vgl-min-bar" style="display:flex"><div style="width:142px;height:30px"></div></div>' },
];

const solapa = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

(async () => {
  const css = cssReal();
  if (!css || css.length < 100000) { console.log("AVISO: el <style> real salió demasiado corto (" + css.length + ")"); process.exit(1); }
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.setContent(`<!doctype html><html><head><style id="vgl">${css}</style>
    <style>html,body{margin:0;height:100%}</style></head>
    <body class="vgl-panel-visible">${FLOTANTES.map((f) => f.html).join("")}</body></html>`);

  const zonaPanel = await p.evaluate((P) => ({
    left: window.innerWidth - P.derecha - P.ancho,
    right: window.innerWidth - P.derecha,
    top: window.innerHeight - P.abajo - P.alto,
    bottom: window.innerHeight - P.abajo,
  }), PANEL);

  let fallos = 0;
  const medir = async (id) => p.$eval("#" + id, (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
  });

  console.log("--- CON el panel a la vista (body.vgl-panel-visible): nadie invade su esquina ---");
  for (const f of FLOTANTES) {
    const r = await medir(f.id);
    const choca = solapa(r, zonaPanel);
    if (choca) fallos++;
    console.log(`${choca ? "FALLA" : "OK   "}  ${f.que.padEnd(20)} x:${Math.round(r.left)}-${Math.round(r.right)} y:${Math.round(r.top)}-${Math.round(r.bottom)}`);
    // Y nadie puede salirse de la pantalla por la izquierda al empujarlo a la columna libre.
    if (r.left < 0) { fallos++; console.log(`FALLA  ${f.que} se sale de la pantalla por la izquierda (left=${Math.round(r.left)})`); }
  }

  console.log("--- SIN el panel (plegado, en dock, minimizado u oculto): recuperan su esquina ---");
  await p.evaluate(() => document.body.classList.remove("vgl-panel-visible"));
  for (const f of FLOTANTES) {
    const r = await medir(f.id);
    // Cada uno vuelve a su margen de siempre: los tres de la derecha pegados al borde derecho,
    // la barra mínima al izquierdo.
    const vuelve = f.id === "vgl-min-bar" ? Math.round(r.left) === 14 : Math.round(1366 - r.right) <= 24;
    if (!vuelve) fallos++;
    console.log(`${vuelve ? "OK   " : "FALLA"}  ${f.que.padEnd(20)} x:${Math.round(r.left)}-${Math.round(r.right)}`);
  }

  console.log(fallos === 0 ? "\nNINGÚN SOLAPE" : `\n${fallos} FALLAN`);
  await b.close();
  process.exit(fallos === 0 ? 0 : 1);
})();
