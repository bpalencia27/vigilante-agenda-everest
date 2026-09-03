// v18.0.42 — Verificación EMPÍRICA (CLAUDE.md): el CSS REAL del script, montado contra un
// "Everest" hostil, en Chromium de verdad. Cubre los tres sitios que la Regla R no veía
// hasta que se le tapó el hueco de las interpolaciones.
const fs = require("fs");
const path = require("path");
const REPO = "/home/user/vigilante-agenda-everest";
const { chromium } = require(path.join(REPO, "node_modules/playwright"));

const code = fs.readFileSync(path.join(REPO, "vigilante_agenda.user.js"), "utf8");
let css = "", inCss = false;
for (const l of code.split("\n")) {
  if (l.includes("style.textContent = `")) { inCss = true; continue; }
  if (inCss && l.includes("`;")) { inCss = false; break; }
  if (inCss) css += l + "\n";
}
for (const m of css.matchAll(/\$\{_cssSeguro\(\(\) => (\w+)\)\}/g)) {
  const ini = code.indexOf("const " + m[1] + " = `");
  if (ini < 0) continue;
  const desde = ini + ("const " + m[1] + " = `").length;
  css = css.replace(m[0], code.slice(desde, code.indexOf("`;", desde)));
}

// El adversario que prescribe CLAUDE.md, más el `svg` que el crítico añadió al medir.
const EVEREST = `div,span,p,b,small,label,li,td,th{color:#111827 !important}
                 svg{color:#111827 !important}`;

const CASOS = [
  { que: "flechita ▾ del acordeón de uroanálisis",
    html: '<div id="vgl-labs-modal"><button class="vgl-labs-uro-btn">Ver 7 analitos <span class="vgl-uro-arrow" data-p="0">▾</span></button></div>',
    sel: '[data-p="0"]', token: "--fg" },
  { que: "titular del aviso flotante",
    html: '<div id="vgl-toasts"><div class="vgl-toast"><div class="vgl-toast-main"><div class="vgl-toast-title" data-p="1" style="color:var(--c-rojo,#ff6b6b) !important">Fraude</div></div></div></div>',
    sel: '[data-p="1"]', token: "--c-rojo" },
  { que: "insignia de estado de la tarjeta de cita",
    html: '<div id="vgl-root"><span class="vgl-badge vgl-badge-t1" data-p="2" style="color:var(--c-ambar,#ffcf5c) !important">En sala</span></div>',
    sel: '[data-p="2"]', token: "--c-ambar" },
];

const rel = (a, b) => {
  const lum = (c) => { const [r, g, bl] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
      .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const p = await b.newPage();
  for (const hostil of [false, true]) {
    await p.setContent(`<!doctype html><html><head>
      ${hostil ? `<style>${EVEREST}</style>` : ""}
      <style id="vgl">${css}</style>
    </head><body>${CASOS.map((c) => c.html).join("")}</body></html>`);
    console.log("\n=== " + (hostil ? "CON el Everest hostil encima" : "limpio (sin Everest)") + " ===");
    for (const c of CASOS) {
      const r = await p.$eval(c.sel, (el) => {
        const cs = getComputedStyle(el);
        let fondo = "rgb(255, 255, 255)", n = el;
        while (n) { const f = getComputedStyle(n).backgroundColor;
          if (f && f !== "rgba(0, 0, 0, 0)" && f !== "transparent") { fondo = f; break; } n = n.parentElement; }
        return { color: cs.color, fondo };
      });
      const c2 = rel(r.color, r.fondo);
      const secuestrado = r.color === "rgb(17, 24, 39)";
      console.log("  " + c.que.padEnd(44) + " color=" + r.color.padEnd(20) +
        " contraste=" + c2.toFixed(2) + ":1" + (secuestrado ? "   <-- SECUESTRADO POR EVEREST" : ""));
    }
  }
  await b.close();
})();
