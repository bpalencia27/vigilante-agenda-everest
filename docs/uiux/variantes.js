// Variantes de PROPUESTA medidas contra el mismo HTML/CSS real: ¿cuántas fallas AA quedan?
const path = require("path"); const fs = require("fs");
const REPO = "/home/user/vigilante-agenda-everest"; const OUT = __dirname;
const { chromium } = require(path.join(REPO, "node_modules", "playwright"));
const css = fs.readFileSync(path.join(OUT, "css_real.css"), "utf8");
const html = (id) => fs.readFileSync(path.join(OUT, "html_" + id + ".html"), "utf8");
const EVEREST_CSS = `html,body{margin:0;background:#eef1f5;font-family:Roboto,Arial,sans-serif}.ev-top{height:56px;background:#1f4e79;color:#fff;display:flex;align-items:center;padding:0 18px;gap:24px;font-weight:600}.ev-main{margin-left:150px;padding:18px 24px}.ev-card{background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.12);padding:16px 20px;margin-bottom:14px}p.ev-nota{font-size:13px;line-height:1.5}div,span,p,b,small,label,li,td,th{color:#1f4e79 !important}body *{font-family:Roboto,Arial,sans-serif !important}`;
const EVEREST_BODY = `<div class="ev-top">EVEREST · HCHealth</div><div class="ev-main">${"<div class=\"ev-card\"><h3>Sección</h3><p class=\"ev-nota\">Texto clínico sintético de relleno. Texto clínico sintético de relleno. Texto clínico sintético de relleno.</p></div>".repeat(6)}</div>`;
// El texto del fichero lleva las barras dobladas del template literal: se evalúa como
// plantilla para obtener EXACTAMENTE la cadena que render.js le pasa a Chromium.
const MEDIR = eval("`" + fs.readFileSync(path.join(OUT, "render.js"), "utf8").match(/const MEDIR = `([\s\S]*?)`;\n/)[1] + "`");
if (!/rgba\?\\\(/.test(MEDIR)) throw new Error("MEDIR mal desescapado");

const PROP_OSCURO = `#vgl-root:not(.light){--bg:rgba(7,10,16,.94)}`;
const PROP_CLARO = `#vgl-root.light,#vgl-agendar-modal.light,#vgl-labs-modal.light,#vgl-ia-modal.light,#vgl-panel-modal.light{--c-morado:#155e75;--rgb-morado:21,94,117;--c-azul:#5b21b6;--rgb-azul:91,33,182;--c-verde:#064e3b;--rgb-verde:6,78,59}`;
const PROP_STEPPER = `.vgl-stepper-step.active .vgl-step-num,.vgl-stepper-step.completed .vgl-step-num{color:var(--bg-solid) !important}`;
const PROP_OPACIDAD = `#vgl-labs-modal .vgl-labs-date small{opacity:1}.vgl-bento-pie{opacity:1}.vgl-chip.vgl-chip-mas{opacity:1}#vgl-title small{opacity:.8}.vgl-prod-cap{opacity:1}`;
const PROP_SCRIM_CLARO = `#vgl-agendar-modal.light,#vgl-ordenar-modal.light,#vgl-labs-modal.light{background:rgba(15,23,42,.42)}`;
const PROP_HC = `#vgl-root.vgl-hc:not(.light){--fg2:#e5ebf3;--fg3:#b8c2d0;--edge:rgba(255,255,255,.34);--line:rgba(255,255,255,.18);--bg2:rgba(255,255,255,.07);--bg3:rgba(255,255,255,.12)}#vgl-root.vgl-hc.light{--fg2:#111827;--fg3:#334155;--edge:rgba(15,23,42,.40);--line:rgba(15,23,42,.20)}`;
const PROP_SW = `#vgl-root.light .vgl-sw i{background:#8a94a6;box-shadow:inset 0 0 0 1px rgba(15,23,42,.35)}#vgl-root .vgl-sw i:after{box-shadow:0 1px 3px rgba(0,0,0,.35),0 0 0 1px rgba(15,23,42,.25)}`;

(async () => {
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const medir = async (ids, claro, extra, foto) => {
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${EVEREST_CSS}</style><style>${css}</style><style>${extra || ""}</style></head><body>${EVEREST_BODY}${ids.map(html).join("")}<script>(function(){[...document.body.children].forEach(n=>{ if(!(n.id||'').startsWith('vgl-')) return; if(${claro}) n.classList.add('light'); }); const r=document.getElementById('vgl-root'); if(r) r.style.display='flex';})()</script></body></html>`);
    await p.waitForTimeout(350);
    if (foto) await p.screenshot({ path: path.join(OUT, foto) });
    const r = await p.evaluate(MEDIR); await p.close();
    const fallas = r.filter((x) => x.falla);
    return { nodos: r.length, fallas: fallas.length, min: Math.min(...r.map((x) => x.ratio)), lista: fallas.map((f) => `${f.ratio} ${f.sel.split(" > ").pop().slice(0, 40)} «${f.txt}»`) };
  };
  const res = {};
  res.panel_oscuro_hoy = await medir(["vgl-root"], false, "");
  res.panel_oscuro_alpha94 = await medir(["vgl-root"], false, PROP_OSCURO, "propuesta_panel_oscuro_alpha94_1366x768.png");
  res.panel_claro_hoy = await medir(["vgl-root"], true, "");
  res.panel_claro_tokens = await medir(["vgl-root"], true, PROP_CLARO + PROP_OPACIDAD, "propuesta_panel_claro_tokens_1366x768.png");
  res.agendar_claro_hoy = await medir(["vgl-agendar-modal"], true, "");
  res.agendar_claro_prop = await medir(["vgl-agendar-modal"], true, PROP_CLARO + PROP_STEPPER + PROP_SCRIM_CLARO, "propuesta_agendar_claro_1366x768.png");
  res.ia_claro_hoy = await medir(["vgl-ia-modal"], true, "");
  res.ia_claro_prop = await medir(["vgl-ia-modal"], true, PROP_CLARO);
  res.labs_claro_hoy = await medir(["vgl-labs-modal"], true, "");
  res.labs_claro_prop = await medir(["vgl-labs-modal"], true, PROP_CLARO + PROP_OPACIDAD);
  res.panel_hc_prop = await medir(["vgl-root"], false, PROP_HC, "propuesta_panel_hc_tokens_1366x768.png");
  await (async () => { const p = await nav.newPage({ viewport: { width: 1366, height: 768 } }); await p.setContent(`<!doctype html><html><head><style>${EVEREST_CSS}</style><style>${css}</style><style>${PROP_HC}</style></head><body>${EVEREST_BODY}${html("vgl-root")}<script>document.getElementById('vgl-root').classList.add('vgl-hc');document.getElementById('vgl-root').style.display='flex'</script></body></html>`); await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, "propuesta_panel_hc_tokens_1366x768.png") }); res.panel_hc_prop_real = (await p.evaluate(MEDIR)).filter((x) => x.falla).length; await p.close(); })();

  // Foco de teclado en .vgl-tl (semáforos) y en .vgl-dock-btn, forzado por teclado real
  {
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${html("vgl-root")}${html("vgl-acciones-dock")}<script>document.getElementById('vgl-root').style.display='flex'</script></body></html>`);
    await p.keyboard.press("Tab");
    res.foco_tl = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { activo: a.id || a.className, fv: a.matches(":focus-visible"), outline: cs.outlineStyle + " " + cs.outlineWidth + " " + cs.outlineColor, boxShadow: cs.boxShadow.slice(0, 60), tamano: a.getBoundingClientRect().width + "×" + a.getBoundingClientRect().height }; });
    for (let i = 0; i < 6; i++) await p.keyboard.press("Tab");
    res.foco_sexto = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { activo: a.id || a.className, fv: a.matches(":focus-visible"), outline: cs.outlineStyle + " " + cs.outlineWidth }; });
    // dock: enfocar por teclado (Tab hasta llegar)
    await p.evaluate(() => { const b = document.querySelector(".vgl-dock-btn"); b.focus(); });
    await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Tab");
    res.foco_dock = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { activo: a.className, fv: a.matches(":focus-visible"), outline: cs.outlineStyle + " " + cs.outlineWidth + " " + cs.outlineColor }; });
    await p.close();
  }
  // Interruptor con la propuesta
  {
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    await p.setContent(`<!doctype html><html><head><style>${css}</style><style>${PROP_SW}</style></head><body style="background:#eef1f5"><div id="vgl-root" class="light"><label class="vgl-sw"><input type="checkbox"><i></i></label></div></body></html>`);
    res.sw_prop = await p.evaluate(() => {
      function parse(c) { const m = String(c).match(/rgba?\(([^)]+)\)/); const p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
      function over(t, b) { const a = t.a; return { r: t.r * a + b.r * (1 - a), g: t.g * a + b.g * (1 - a), b: t.b * a + b.b * (1 - a), a: 1 }; }
      function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
      function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
      function ratio(a, b) { const la = lum(a), lb = lum(b); return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)).toFixed(2)); }
      const root = document.getElementById("vgl-root"); const base = { r: 238, g: 241, b: 245, a: 1 }; const rootBg = over(parse(getComputedStyle(root).backgroundColor), base);
      const i = document.querySelector(".vgl-sw i"); const riel = over(parse(getComputedStyle(i).backgroundColor), rootBg); const knob = parse(getComputedStyle(i, "::after").backgroundColor);
      return { riel_vs_fondo: ratio(riel, rootBg), perilla_vs_riel: ratio(knob, riel) };
    });
    await p.close();
  }
  // Colisiones geométricas entre superficies flotantes (todas visibles a la vez, caso peor
  // pero posible: panel abierto + post-cita + toast del piloto + deshacer + minimizados +
  // dock de acciones + inyectores + avisos). El botón Deshacer lleva su clase REAL
  // (línea 24144: "vgl-agm-btn sec"), no la de los inyectores.
  {
    const DOCK = `<div id="vgl-dock" style="display:flex"><span id="vgl-dock-dot"></span><span>Centinela</span><b id="vgl-dock-b">3</b></div>`;
    const DESHACER = `<button id="vgl-deshacer-llenado" class="vgl-agm-btn sec">↩ Deshacer llenado</button>`;
    const PILL = `<button id="vgl-visib-pill" style="display:block">◉</button>`;
    for (const [w, h] of [[1366, 768], [1920, 1080]]) {
      const p = await nav.newPage({ viewport: { width: w, height: h } });
      await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${EVEREST_CSS}</style><style>${css}</style></head><body>${EVEREST_BODY}${["vgl-root", "vgl-toasts", "vgl-postcita-panel", "vgl-sp", "vgl-min-bar", "vgl-lab-injector", "vgl-examen-normalidad", "vgl-acciones-dock"].map(html).join("")}${DOCK}${DESHACER}${PILL}<script>document.getElementById('vgl-root').style.display='flex';document.getElementById('vgl-min-bar').style.display='flex'</script></body></html>`);
      await p.waitForTimeout(350);
      await p.screenshot({ path: path.join(OUT, `colisiones_${w}x${h}.png`) });
      res["colisiones_" + w] = await p.evaluate(() => {
        const ids = ["vgl-root", "vgl-toasts", "vgl-postcita-panel", "vgl-sp", "vgl-deshacer-llenado", "vgl-min-bar", "vgl-dock", "vgl-lab-injector", "vgl-examen-normalidad", "vgl-acciones-dock", "vgl-visib-pill"];
        const rc = {}; for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width && r.height) rc[id] = { x: Math.round(r.x), y: Math.round(r.y), r: Math.round(r.right), b: Math.round(r.bottom), z: getComputedStyle(e).zIndex }; }
        const pares = [];
        const ks = Object.keys(rc);
        for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = rc[ks[i]], b = rc[ks[j]]; const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x), oy = Math.min(a.b, b.b) - Math.max(a.y, b.y); if (ox > 0 && oy > 0) pares.push(`${ks[i]} ∩ ${ks[j]} = ${ox}×${oy}px (encima: ${Number(a.z) >= Number(b.z) ? ks[i] : ks[j]})`); }
        return { rects: rc, solapes: pares };
      });
      await p.close();
    }
    // El toast del piloto y la barra de minimizados en tema CLARO (¿siguen el tema?)
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${EVEREST_CSS}</style><style>${css}</style></head><body>${EVEREST_BODY}${["vgl-root", "vgl-sp", "vgl-min-bar", "vgl-postcita-panel"].map(html).join("")}${DOCK}<script>[...document.body.children].forEach(n=>{ if((n.id||'').startsWith('vgl-')) n.classList.add('light'); });document.getElementById('vgl-root').style.display='flex';document.getElementById('vgl-min-bar').style.display='flex'</script></body></html>`);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, "sp_toast_claro_1366x768.png") });
    res.sp_claro = await p.evaluate(() => { const e = document.getElementById("vgl-sp"); const cs = getComputedStyle(e); return { bg: cs.backgroundColor, color: cs.color, borderLeft: cs.borderLeftColor }; });
    await p.close();
  }
  await nav.close();
  fs.writeFileSync(path.join(OUT, "variantes.json"), JSON.stringify(res, null, 1));
  for (const [k, v] of Object.entries(res)) console.log(k, typeof v === "object" && v.lista ? `${v.fallas}/${v.nodos} fallas (mín ${v.min})` + (v.lista.length ? "\n    " + v.lista.slice(0, 8).join("\n    ") : "") : JSON.stringify(v));
})();
