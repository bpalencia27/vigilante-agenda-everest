// =====================================================================
//  BLINDAJE DE COLOR SOBRE EL HTML REAL DE CADA SUPERFICIE — Chromium real
//
//  01-sep-2026 (cierre del enjambre). Los tools anteriores medían texto SINTÉTICO
//  («texto de prueba») dentro de cada clase censada por regex, y ese censo tuvo tres
//  puntos ciegos seguidos: `<div id="…" class="…">` no entraba; `.pill.warn{color}` hacía
//  pasar por «con color» a `.pill` a secas; y un contenedor sin texto propio salía como
//  «secuestrado» aunque en la vida real solo tuviera hijos con clase. Un censo por texto
//  nunca va a ser la verdad: lo que el médico ve es el HTML que el script genera, dentro
//  del CSS que el script genera, en Chromium.
//
//  Este tool abre cada superficie EN EL ARNÉS (la misma función que la abre en consulta),
//  serializa su HTML real, lo monta con el <style> real ejecutado, en tema oscuro y claro,
//  bajo el Everest hostil que prescribe CLAUDE.md, y mide TODOS los elementos que tienen
//  texto propio (un nodo de texto directo). Cualquiera que termine con el color del
//  adversario está secuestrado — sin regex, sin lista escrita a mano.
//
//  Dos adversarios: el CANÓNICO (CLAUDE.md + li/td/th/i/strong/em, el mismo de
//  auditar_color_todo_chromium.js) decide el veredicto; uno AMPLIO (además a, button,
//  h1-h6, summary, legend) se informa aparte, como «más allá de la regla».
//
//  La cobertura se imprime SIEMPRE: qué superficies se pudieron abrir en el arnés y cuáles
//  no. Lo que no se abre no se mide, y se dice.
// =====================================================================
const path = require("path");
const REPO = path.join(__dirname, "..");
const { chromium } = require(path.join(REPO, "node_modules", "playwright"));
const { cargar } = require(path.join(REPO, "tests", "harness.js"));

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
// Serializa un nodo del DOM falso del arnés (children + innerHTML + textContent + className +
// classList + attributes + style) al HTML que Chromium necesita.
function ser(n) {
  if (!n) return "";
  if (typeof n === "string") return n;
  if (!n.tagName) return typeof n.textContent === "string" ? n.textContent : "";
  const tag = n.tagName.toLowerCase();
  const clases = new Set(String(n.className || "").split(/\s+/).filter(Boolean));
  if (n.classList && n.classList._s) for (const c of n.classList._s) clases.add(c);
  let a = "";
  if (n.id) a += ` id="${esc(n.id)}"`;
  if (clases.size) a += ` class="${esc([...clases].join(" "))}"`;
  for (const [k, v] of Object.entries(n.attributes || {})) if (k !== "id" && k !== "class" && k !== "style") a += ` ${k}="${esc(v == null ? "" : v)}"`;
  const st = [];
  if (n.style) {
    if (n.style.cssText) st.push(n.style.cssText);
    for (const [k, v] of Object.entries(n.style)) if (typeof v === "string" && v && k !== "cssText") st.push(k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()) + ":" + v);
  }
  if (st.length) a += ` style="${esc(st.join(";"))}"`;
  if (tag === "input" || tag === "br" || tag === "img") return `<${tag}${a}>`;
  const inner = typeof n.innerHTML === "string" ? n.innerHTML : "";
  const kids = (n.children || []).map(ser).join("");
  const txt = (!inner && typeof n.textContent === "string") ? n.textContent : "";
  return `<${tag}${a}>${inner}${txt}${kids}</${tag}>`;
}
function estilos(c) {
  const trozos = [];
  const rec = (n) => { if (!n) return; if (n.tagName === "STYLE" && n.textContent) trozos.push(n.textContent); (n.children || []).forEach(rec); };
  rec(c.env.doc.head); rec(c.env.doc.body);
  return trozos.join("\n");
}

const apt = { doc_id: "SYN-0001", nombre: "PACIENTE SINTETICO", patient: "PACIENTE SINTETICO", hora: "08:00", hora_texto: "08:00", estado: "En sala", cita_id: "SYN-C1", id: "SYN-C1", eps: "EPS SINTETICA" };
const APERTURAS = [
  ["panel (render)", (c) => c.api.render([apt], "prueba", new Date())],
  ["hoja Resumen", (c) => { c.api.__state.sheet = "resumen"; c.api.renderResumen(); }],
  ["hoja Ajustes", (c) => { c.api.__state.sheet = "ajustes"; c.api.renderSettings(); }],
  ["agendar", (c) => c.api.openAgendamientoModal(apt)],
  ["toma sola", (c) => c.api.openLabSoloModal(apt, {})],
  ["laboratorios", (c) => c.api.openLaboratoriosModal(apt)],
  ["ordenar", (c) => c.api.openOrdenamientoModal(apt)],
  ["panel del paciente", (c) => c.api.openPanelPacienteModal(apt, {})],
  ["tablero", (c) => c.api.openTableroModal(apt)],
  ["próximo control", (c) => c.api.openPaquetesModal(apt)],
  ["post-cita", (c) => c.api.mostrarPanelPostCita("SYN-C1", "EPS SINTETICA", "PACIENTE SINTETICO", "PACIENTE SINTETICO", {})],
  ["chooser", (c) => c.api._vglChooserModal({ titulo: "Elegir", descripcion: "Descripción sintética", opciones: [{ id: "a", rotulo: "Opción A", icono: "🧪", desc: "detalle" }] })],
  ["burbuja acompañado", (c) => { c.env.doc.querySelector = (sel) => (sel === '[data-accion="agendar"]' ? { getBoundingClientRect: () => ({ top: 90, left: 620, right: 700, bottom: 120, width: 80, height: 30 }) } : null); c.api._acompMostrar({ id: "agendar", target: '[data-accion="agendar"]', texto: "Texto de ayuda sintético" }, apt); }],
  ["pausa clínica", (c) => c.api._mostrarAvisoPausaClinica("Motivo sintético")],
  ["instancia duplicada", (c) => c.api._mostrarAvisoInstanciaDuplicada("18.0.95", "18.0.90")],
  ["redactor IA", (c) => c.api.mtrAbrirPanelRedaccion(null, {})],
  ["inyectores", (c) => { c.api.createLabInjectorUI(); c.api.createExamenFisicoInjectorUI(); }],
  ["panel minimizado", (c) => c.api.vglMinimizarPanel(c.env.doc.getElementById("vgl-root"), "SYN-0001")],
];
// Superficies que el arnés no puede pintar (querySelector nulo dentro de _renderToast, o el
// widget necesita datos de Everest): se montan con la plantilla EXACTA del código.
function plantillas(c) {
  const col = (k) => (c.api.COLORS && c.api.COLORS[k]) || "#ffc46b";
  const toast = (k) => `<div class="vgl-toast"><i class="vgl-toast-rail" style="--tk:var(--rgb-${k.toLowerCase()},167,139,250);background:var(--c-${k.toLowerCase()},${col(k)})"></i><div class="vgl-toast-ic" style="--tk:var(--rgb-${k.toLowerCase()},167,139,250);color:var(--c-${k.toLowerCase()},${col(k)}) !important"></div><div class="vgl-toast-main"><div class="vgl-toast-title" style="--tk:var(--rgb-${k.toLowerCase()},167,139,250);color:var(--c-${k.toLowerCase()},${col(k)}) !important">Título</div><div class="vgl-toast-b">Cuerpo del aviso sintético</div></div><span class="vgl-toast-x">×</span></div>`;
  return [
    ["vgl-toasts", "toasts (plantilla de _renderToast)", ["VERDE", "AMBAR", "ROJO", "MORADO", "AZUL"].map(toast).join("")],
    ["vgl-cw-examenes", "widget exámenes (plantilla)", '<div class="vgl-cw-badge">🧪 2</div><div class="vgl-cw-panel"><div class="vgl-cw-fila vgl-cw-venc"><span class="vgl-cw-nom">ANALITO</span><span class="vgl-cw-que">vence en 12 días</span></div><div class="vgl-cw-ok-msg">Al día</div></div>'],
    ["vgl-cw-farmaco", "widget fármacos (plantilla)", '<div class="vgl-cw-badge">💊 2</div><div class="vgl-cw-panel"><div class="vgl-mtr-bloque"><span class="vgl-mtr-tit">Seguridad farmacológica</span><div class="vgl-mtr-crit"><span class="vgl-mtr-conducta">Ajustar dosis</span></div></div></div>'],
  ];
}

const CANONICO = `div,span,p,b,small,label,li,td,th,i,strong,em{color:#ff00ff !important}`;
const AMPLIO = `div,span,p,b,small,label,li,td,th,i,strong,em,a,button,h1,h2,h3,h4,h5,h6,summary,legend{color:#ff00ff !important}`;
const MAGENTA = "rgb(255, 0, 255)";

(async () => {
  // ---- 1. Cosecha del HTML real en el arnés ------------------------------------------
  let css = "";
  const superficies = new Map();   // id -> { origen, html }
  const cobertura = [];
  const vistos = new Set();
  for (const [nombre, abrir] of APERTURAS) {
    const c = cargar({ silencioso: true });
    try { c.api.buildOverlay(); } catch (e) {}
    if (!css) css = estilos(c);
    let err = "";
    try { await Promise.race([Promise.resolve().then(() => abrir(c)), new Promise((r) => setTimeout(r, 3000))]); } catch (e) { err = String((e && e.message) || e).split("\n")[0].slice(0, 70); }
    const nuevas = [];
    for (const n of c.env.doc.body.children) {
      if (!(n.id || "").startsWith("vgl-")) continue;
      const html = ser(n);
      const clave = n.id + "|" + html.length;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      if (superficies.has(n.id) && superficies.get(n.id).html.length >= html.length) continue;
      superficies.set(n.id, { origen: nombre, html });
      nuevas.push(n.id + " (" + html.length + " chars)");
    }
    cobertura.push({ nombre, err, nuevas });
  }
  {
    const c = cargar({ silencioso: true });
    try { c.api.buildOverlay(); } catch (e) {}
    for (const [id, origen, inner] of plantillas(c)) superficies.set(id, { origen, html: `<div id="${id}">${inner}</div>` });
  }
  if (!css || css.length < 100000) { console.log("AVISO: el <style> real salió demasiado corto (" + css.length + ")"); process.exit(1); }

  console.log("CSS real: " + css.length + " caracteres\n");
  console.log("COBERTURA — qué se pudo abrir en el arnés:");
  for (const r of cobertura) console.log(`  ${r.nuevas.length ? "ok  " : "--  "} ${r.nombre.padEnd(22)} ${r.nuevas.join(", ") || "(nada nuevo)"}${r.err ? "   [la apertura lanzó: " + r.err + "]" : ""}`);
  console.log("\nSUPERFICIES MEDIDAS: " + [...superficies.keys()].join(", ") + "\n");

  // ---- 2. Medición en Chromium: oscuro y claro, hostil canónico / amplio / limpio -----
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const cuerpo = [...superficies.values()].map((s) => s.html).join("\n");
  const medir = async (hostil, claro) => {
    const p = await nav.newPage();
    await p.setContent(`<!doctype html><html><head>${hostil ? `<style>${hostil}</style>` : ""}<style>${css}</style></head><body>${cuerpo}</body></html>`);
    const r = await p.evaluate((claro) => {
      const raices = [...document.body.children].filter((n) => (n.id || "").startsWith("vgl-"));
      if (claro) raices.forEach((n) => n.classList.add("light"));
      const out = [];
      for (const raiz of raices) {
        raiz.querySelectorAll("*").forEach((el) => {
          const tieneTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!tieneTexto) return;
          const cs = getComputedStyle(el);
          const camino = [];
          let e = el;
          while (e && e !== raiz && camino.length < 4) { camino.unshift(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).join(".") : "")); e = e.parentElement; }
          out.push({ raiz: raiz.id, sel: camino.join(" > "), color: cs.color, oculto: cs.display === "none" || cs.visibility === "hidden", txt: [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").slice(0, 40) });
        });
      }
      return out;
    }, claro);
    await p.close();
    return r;
  };
  const resumen = { canonico: 0, amplio: 0, medidos: 0 };
  const lineas = [];
  for (const claro of [false, true]) {
    const [can, amp, lim] = await Promise.all([medir(CANONICO, claro), medir(AMPLIO, claro), medir(null, claro)]);
    if (can.length !== lim.length || amp.length !== lim.length) { console.log("DOM distinto entre páginas"); process.exit(2); }
    resumen.medidos += lim.length;
    for (let i = 0; i < lim.length; i++) {
      const c = can[i], a = amp[i], l = lim[i];
      const secC = c.color === MAGENTA, secA = a.color === MAGENTA;
      if (secC) resumen.canonico++; else if (secA) resumen.amplio++;
      if (secC || secA) lineas.push(`  ${secC ? "SECUESTRADO " : "más allá   "} ${(claro ? "claro " : "oscuro") } #${l.raiz.padEnd(22)} ${l.sel.slice(0, 78).padEnd(78)} limpio=${l.color.padEnd(24)} ${l.oculto ? "(oculto ahora) " : ""}«${l.txt}»`);
    }
  }
  console.log("RESULTADO — " + resumen.medidos + " elementos con texto propio medidos (oscuro + claro):");
  console.log("  secuestrados por el Everest CANÓNICO de CLAUDE.md: " + resumen.canonico);
  console.log("  además, solo bajo el adversario AMPLIO (a/button/h*): " + resumen.amplio + "  (informativo, más allá de la regla)");
  if (lineas.length) console.log("\n" + lineas.join("\n"));
  console.log(resumen.canonico ? "\nVEREDICTO: NO blindado — " + resumen.canonico + " elemento(s) reales pierden su color contra el CSS de Everest." : "\nVEREDICTO: blindado — ningún texto real del script pierde su color contra el Everest canónico.");
  await nav.close();
  process.exit(resumen.canonico ? 1 : 0);
})();
