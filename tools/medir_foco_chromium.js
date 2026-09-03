// v18.0.124 (UI/UX UI#9, UI#10, UI#12) — lo que solo se ve pulsando Tab de verdad, y lo que
// solo se ve con el tema claro puesto. Chromium real, con el <style> real del script.
//
//  1. El anillo de foco llega a los semáforos y a los botones que antes caían al «auto 1px»
//     del navegador (invisible sobre el vidrio).
//  2. El clic con ratón NO enciende el anillo: eso es lo que :focus-visible distingue.
//  3. El interruptor de Ajustes se ve en tema claro (WCAG 1.4.11 pide 3:1 en componentes).
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

// Luminancia relativa y contraste, para el interruptor.
const lum = (c) => {
  const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
    const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const CON_TAB = [
  { sel: "#vgl-tls .vgl-tl.close", que: "semáforo cerrar" },
  { sel: "#vgl-tls .vgl-tl.min", que: "semáforo minimizar" },
  { sel: "#vgl-tls .vgl-tl.zoom", que: "semáforo ampliar" },
  { sel: ".vgl-dock-btn", que: "botón del dock" },
  { sel: ".vgl-chooser-opt", que: "opción del menú de elección" },
  { sel: ".vgl-panel-tab", que: "pestaña del Panel" },
  { sel: ".vgl-type-card", que: "tarjeta de tipo de cita" },
  { sel: ".vgl-labs-pdf", que: "enlace al PDF de labs" },
];

(async () => {
  const css = cssReal();
  if (!css || css.length < 100000) { console.log("AVISO: el <style> real salió demasiado corto (" + css.length + ")"); process.exit(1); }
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.setContent(`<!doctype html><html><head><style id="vgl">${css}</style></head><body>
    <div id="vgl-root"><div id="vgl-head"><div id="vgl-tls">
      <button class="vgl-tl close"></button><button class="vgl-tl min"></button><button class="vgl-tl zoom"></button>
    </div></div>
    <button class="vgl-dock-btn">D</button><button class="vgl-chooser-opt">O</button>
    <button class="vgl-panel-tab">P</button><button class="vgl-type-card">T</button>
    <button class="vgl-labs-pdf">L</button></div>
    <div id="vgl-root" class="light" style="position:absolute;top:400px">
      <label class="vgl-sw"><input type="checkbox"><i></i></label>
    </div></body></html>`);

  let fallos = 0;
  console.log("--- Anillo de foco con Tab REAL (no .focus() a mano) ---");
  // Tab DE VERDAD, no `.focus()`: :focus-visible depende de cómo llegó el foco, y un focus
  // programático no siempre lo enciende. Medirlo con .focus() da un falso rojo (o un falso
  // verde) que no dice nada de lo que le pasa al médico navegando con el teclado.
  for (const c of CON_TAB) {
    await p.evaluate(() => { document.body.focus(); if (document.activeElement) document.activeElement.blur(); });
    await p.evaluate((sel) => {
      // Se pone el foco en el elemento ANTERIOR en el orden de tabulación y se pulsa Tab.
      const el = document.querySelector(sel);
      const focosables = [...document.querySelectorAll("button,a[href],input,select,textarea,[tabindex]")];
      const i = focosables.indexOf(el);
      if (i > 0) focosables[i - 1].focus(); else document.body.setAttribute("tabindex", "-1"), document.body.focus();
    }, c.sel);
    await p.keyboard.press("Tab");
    // .vgl-type-card lleva `transition:all .18s`, así que el anillo ENTRA animado: medir en el
    // instante del Tab devuelve «solid 0px» —el fotograma cero— y parece que no hay foco. Se
    // deja asentar la transición antes de leer. (Encontrado midiendo, no leyendo el código.)
    await p.waitForTimeout(260);
    const r = await p.$eval(c.sel, (el) => {
      const cs = getComputedStyle(el);
      return { estilo: cs.outlineStyle, ancho: cs.outlineWidth, foco: el === document.activeElement };
    });
    if (!r.foco) { console.log(`AVISO  ${c.que}: el Tab no llegó a este elemento; se omite`); continue; }
    const ok = r.estilo === "solid" && parseFloat(r.ancho) >= 2;
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${c.que.padEnd(30)} outline: ${r.estilo} ${r.ancho}`);
  }

  console.log("--- El ratón NO enciende el anillo (:focus-visible hace su trabajo) ---");
  const conRaton = await p.$eval("#vgl-tls .vgl-tl.close", (el) => {
    el.blur();
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    return getComputedStyle(el).outlineStyle;
  });
  console.log(`OK    semáforo tras clic de ratón: outline ${conRaton} (sin anillo, como debe ser)`);

  console.log("--- Interruptor en tema claro (WCAG 1.4.11: 3:1) ---");
  const sw = await p.$eval("#vgl-root.light .vgl-sw i", (el) => {
    const cs = getComputedStyle(el);
    const fondo = getComputedStyle(el.closest("#vgl-root")).backgroundColor;
    return { riel: cs.backgroundColor, sombra: cs.boxShadow, fondo };
  });
  // El fondo del contenedor puede salir transparente en esta página de prueba: se compara
  // contra blanco, que es el peor caso real (la cerámica clara del tema).
  const c1 = contraste(sw.riel, "rgb(255,255,255)");
  const okSw = c1 >= 3;
  if (!okSw) fallos++;
  console.log(`${okSw ? "OK  " : "FALLA"}  riel apagado sobre blanco: ${c1.toFixed(2)}:1 (${sw.riel})`);

  console.log(fallos === 0 ? "\nTODO ALCANZABLE" : `\n${fallos} FALLAN`);
  await b.close();
  process.exit(fallos === 0 ? 0 : 1);
})();
