// Auditoría UI_Estetico — renderizado del HTML REAL de cada superficie con el CSS REAL
// (arnés + buildOverlay()) en Chromium, sobre un Everest simulado hostil (CLAUDE.md).
// Solo lectura: no toca el repositorio. Salidas: PNG + JSON en esta misma carpeta.
const path = require("path");
const fs = require("fs");
const REPO = "/home/user/vigilante-agenda-everest";
const OUT = __dirname;
const { chromium } = require(path.join(REPO, "node_modules", "playwright"));
const { cargar } = require(path.join(REPO, "tests", "harness.js"));

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
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

// Agenda sintética (cero PHI).
const HOY = new Date();
const hh = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const CITAS = [
  ["En sala", "VERDE", ["TAMIZAJE SINTETICO A", "CONTROL SINTETICO B", "ACTIVIDAD SINTETICA C", "ACTIVIDAD D"], "", ""],
  ["No confirmado", "ROJO", ["TAMIZAJE SINTETICO A"], "flag", ""],
  ["Confirmada", "AMBAR", [], "agpend", "falta"],
  ["Atendido", "VERDE", ["CONTROL SINTETICO B"], "", "atendido"],
  ["Confirmada", "MORADO", ["TAMIZAJE SINTETICO A", "ACTIVIDAD D"], "pes", ""],
  ["En sala", "AZUL", [], "adic", "aldia"],
  ["Confirmada", "VERDE", ["ACTIVIDAD SINTETICA C"], "", ""],
  ["Atendido", "VERDE", [], "", "atendido"],
  ["Confirmada", "AMBAR", ["TAMIZAJE SINTETICO A"], "", ""],
  ["En sala", "VERDE", [], "", "resp"],
];
const apt = { doc_id: "SYN-1000", nombre: "PACIENTE SINTETICO 1", patient: "PACIENTE SINTETICO 1", hora: "08:00", hora_texto: "08:00", estado: "En sala", cita_id: "SYN-C1", id: "SYN-C1", eps: "EPS SINTETICA" };

// Tarjetas con la plantilla EXACTA de render() (líneas 31145-31275 del script).
function tarjetas(COLORS) {
  return CITAS.map(([estado, color, pym, flag, extra], i) => {
    const col = COLORS[color] || COLORS.AZUL; const lc = color.toLowerCase();
    const esAt = extra === "atendido";
    const cls = "vgl-card" + ((color === "ROJO" || color === "MORADO" || color === "AMBAR") ? " " + lc : "") + (flag === "pes" ? " pes" : "") + (esAt ? " atendido" : "");
    const badgeCol = esAt ? "var(--c-atendido)" : `var(--tc,${col})`;
    const rgba = (a) => esAt ? `rgba(var(--rgb-atendido),${a})` : `rgba(var(--trgb),${a})`;
    const flags = { flag: `<span class="vgl-flag">⛔ NO CONFIRMADO</span>`, pes: `<span class="vgl-flag pes">❤ ABANDONO PROGRAMA RCV</span>`, agpend: `<span class="vgl-flag agpend">🗓️ SIN TERMINAR</span>`, adic: `<span class="vgl-flag adic">➕ CANDIDATO ADICIONAL</span>` }[flag] || "";
    const vis = pym.slice(0, 3); const mas = pym.length - vis.length;
    const pyms = vis.length ? `<div class="vgl-pyms">${vis.map((p) => `<span class="vgl-chip">${p}</span>`).join("")}${mas > 0 ? `<span class="vgl-chip vgl-chip-mas">+${mas} más</span>` : ""}</div>`
      : extra === "falta" ? `<div class="vgl-none falta">Dato faltante: sin registro en PyM</div>`
        : extra === "aldia" ? `<div class="vgl-none">Al día · sin PyM pendiente</div>`
          : extra === "resp" ? `<div class="vgl-none resp">Sin registro en el PyM de hoy · según el respaldo:</div><div class="vgl-pyms"><span class="vgl-chip vgl-chip-resp">ACTIVIDAD DEL RESPALDO</span></div>`
            : `<div class="vgl-none falta">PyM sin cargar</div>`;
    const cd = i === 0 ? `<span class="vgl-cd warn">en 12 min</span>` : i === 2 ? `<span class="vgl-cd late">+18 min</span>` : i === 4 ? `<span class="vgl-cd vgl-adh">2 inasist.</span>` : "";
    return `<div class="${cls}">
        <div class="vgl-card-top vgl-card-top-t1" style="--tc:var(--c-${lc},${col});--trgb:var(--rgb-${lc})">
          <div class="vgl-card-time-wrap vgl-card-time-wrap-t1">
            <span class="vgl-cdot vgl-cdot-t1" style="background:var(--tc,${col});box-shadow:0 0 10px var(--tc,${col})"></span>
            <span class="vgl-time vgl-time-t1">${hh(7 + Math.floor(i / 2), (i % 2) * 30)}</span>
            ${i % 3 === 0 ? '<span class="vgl-precon-dot listo"></span>' : ""}${cd}
          </div>
          <div class="vgl-card-badges-wrap">${flags}<span class="vgl-badge vgl-badge-t1" style="background:${rgba(".16")};color:${badgeCol} !important;box-shadow:inset 0 0 0 1px ${rgba(".32")}">${estado}</span></div>
        </div>
        <div class="vgl-card-mid vgl-card-mid-t1"><div class="vgl-name vgl-name-t1"><b>PACIENTE SINTETICO ${i + 1}</b></div><span class="vgl-doc vgl-doc-t1">CC SYN-${1000 + i}</span></div>
        <div class="vgl-card-btm vgl-card-btm-t1">${pyms}</div></div>`;
  }).join("");
}

const APERTURAS = [
  ["panel (render)", (c) => c.api.render([apt], "api", HOY)],
  ["agendar", (c) => c.api.openAgendamientoModal(apt)],
  ["laboratorios", (c) => c.api.openLaboratoriosModal(apt)],
  ["ordenar", (c) => c.api.openOrdenamientoModal(apt)],
  ["panel del paciente", (c) => c.api.openPanelPacienteModal(apt, {})],
  ["próximo control", (c) => c.api.openPaquetesModal(apt)],
  ["post-cita", (c) => c.api.mostrarPanelPostCita("SYN-C1", "EPS SINTETICA", "PACIENTE SINTETICO", "PACIENTE SINTETICO", {})],
  ["chooser", (c) => c.api._vglChooserModal({ titulo: "Elegir", descripcion: "Descripción sintética", opciones: [{ id: "a", rotulo: "Opción A", icono: "🧪", desc: "detalle" }, { id: "b", rotulo: "Opción B", icono: "📄", desc: "otro detalle" }] })],
  ["burbuja acompañado", (c) => { c.env.doc.querySelector = (sel) => (sel === '[data-accion="agendar"]' ? { getBoundingClientRect: () => ({ top: 90, left: 620, right: 700, bottom: 120, width: 80, height: 30 }) } : null); c.api._acompMostrar({ id: "agendar", target: '[data-accion="agendar"]', texto: "Texto de ayuda sintético" }, apt); }],
  ["redactor IA", (c) => c.api.mtrAbrirPanelRedaccion({ factores: {}, erc: {}, _docId: "SYN-0001", _nombrePaciente: "PACIENTE SINTETICO", _ultimos: {}, _hoyIso: "2026-09-02" }, {})],
  ["inyectores", (c) => { c.api.createLabInjectorUI(); c.api.createExamenFisicoInjectorUI(); }],
  ["aviso universal", (c) => c.api.avisoUniversal("PACIENTE SINTETICO", { pym: ["TAMIZAJE SINTETICO A", "CONTROL SINTETICO B", "ACTIVIDAD C"], labs: [{ nombre: "ANALITO SINTETICO 1" }, { nombre: "ANALITO SINTETICO 2" }], abandono: true }, true)],
  ["bigAlert", (c) => c.api.bigAlert("ROJO", "Título sintético", "Cuerpo del aviso sintético\nSegunda línea")],
];

function plantillas(c) {
  const col = (k) => (c.api.__COLORS && c.api.__COLORS[k]) || "#ffc46b";
  const toast = (k, t, b) => `<div class="vgl-toast"><i class="vgl-toast-rail" style="--tk:var(--rgb-${k.toLowerCase()},167,139,250);background:var(--c-${k.toLowerCase()},${col(k)})"></i><div class="vgl-toast-ic" style="--tk:var(--rgb-${k.toLowerCase()},167,139,250);color:var(--c-${k.toLowerCase()},${col(k)}) !important">🔔</div><div class="vgl-toast-main"><div class="vgl-toast-title" style="--tk:var(--rgb-${k.toLowerCase()},167,139,250);color:var(--c-${k.toLowerCase()},${col(k)}) !important">${t}</div><div class="vgl-toast-b">${b}</div></div><span class="vgl-toast-x">×</span></div>`;
  const dockBtn = (ico, lbl, extra) => `<button class="vgl-dock-btn${extra || ""}"><span class="vgl-dock-ico">${ico}</span><span class="vgl-dock-lbl">${lbl}</span></button>`;
  return [
    ["vgl-toasts", ["VERDE", "AMBAR", "ROJO"].map((k, i) => toast(k, "Aviso " + k.toLowerCase(), "Cuerpo del aviso sintético número " + (i + 1) + " con dos líneas de texto.")).join("")],
    ["vgl-cw-examenes", '<div class="vgl-cw-badge">🧪 2</div><div class="vgl-cw-panel"><div class="vgl-cw-fila vgl-cw-venc"><span class="vgl-cw-nom">ANALITO</span><span class="vgl-cw-que">vence en 12 días</span></div><div class="vgl-cw-ok-msg">Al día</div></div>'],
    ["vgl-pym-banner", '<div class="vgl-pymb-barra"><span class="vgl-pymb-titulo">Prevención pendiente</span><span class="vgl-pymb-contador">3</span><button class="vgl-pymb-toggle">▾</button></div><div class="vgl-pymb-aviso">No se pudo verificar contra Athenea</div><div class="vgl-pymb-lista"><span class="vgl-pymb-item"><span class="vgl-pymb-item-nombre">TAMIZAJE SINTETICO</span><button class="vgl-pymb-item-btn">Ordenar</button></span></div>'],
    ["vgl-acciones-dock", '<button class="vgl-dock-toggle">▶</button><div class="vgl-dock-btns">' + dockBtn("📅", "Agendar") + dockBtn("🧪", "Agendar labs", " vgl-dock-btn-ambar") + dockBtn("📋", "Ordenar") + dockBtn("🔬", "Laboratorios") + dockBtn("🩺", "Panel") + dockBtn("✍️", "Redactor IA") + dockBtn("📝", "Faltan antecedentes", " vgl-dock-btn-atenuado") + '</div>'],
    ["vgl-min-bar", '<div class="vgl-min-pill"><button type="button" class="vgl-min-abrir">▣ Agendar · PACIENTE SINTETICO</button><button type="button" class="vgl-min-x">✕</button></div><div class="vgl-min-pill"><button type="button" class="vgl-min-abrir">▣ Panel del paciente</button><button type="button" class="vgl-min-x">✕</button></div>'],
    ["vgl-deshacer-llenado", 'PLANTILLA_BOTON'],
  ];
}

// Everest simulado: SPA clara con cabecera azul corporativa, riel lateral y un formulario
// de historia clínica. Hostil según CLAUDE.md.
const EVEREST_CSS = `
  html,body{margin:0;background:#eef1f5;font-family:Roboto,Arial,sans-serif}
  .ev-top{height:56px;background:#1f4e79;color:#fff;display:flex;align-items:center;padding:0 18px;gap:24px;font-weight:600}
  .ev-rail{position:fixed;top:56px;left:0;bottom:0;width:130px;background:#274c77;color:#dfe8f3;padding:14px 10px;font-size:12px}
  .ev-rail div{padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.12)}
  .ev-main{margin-left:150px;padding:18px 24px;max-width:1500px}
  .ev-card{background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.12);padding:16px 20px;margin-bottom:14px}
  .ev-card h3{margin:0 0 10px;color:#1f4e79;font-size:15px}
  .ev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .ev-f label{display:block;font-size:11px;color:#1f4e79;margin-bottom:3px;letter-spacing:.3px}
  .ev-f input,.ev-f textarea{width:100%;box-sizing:border-box;border:1px solid #c7d0dc;border-radius:4px;padding:7px;font-size:13px;background:#fff}
  .ev-btn{background:#fff;color:rgba(0,0,0,.87);border-radius:13px;padding:0 16px;line-height:36px;display:inline-block;letter-spacing:1.3px;box-shadow:0 1px 3px rgba(0,0,0,.2);margin-right:8px;font-size:12px}
  p.ev-nota{font-size:13px;line-height:1.5;color:#1f2933}
  div,span,p,b,small,label,li,td,th{color:#1f4e79 !important}
  body *{font-family:Roboto,Arial,sans-serif !important}`;
const EVEREST_BODY = `
<div class="ev-top">EVEREST · HCHealth <span style="opacity:.8;font-weight:400">Historia clínica</span><span style="margin-left:auto;font-weight:400">Dr. Sintético · Cerrar sesión</span></div>
<div class="ev-rail"><div>Agenda</div><div>Historia</div><div>Órdenes</div><div>Fórmulas</div><div>Paquetes</div><div>Informes</div></div>
<div class="ev-main">
  <div class="ev-card"><h3>Datos del paciente</h3><div class="ev-grid">
    <div class="ev-f"><label>Nombre</label><input value="PACIENTE SINTETICO"></div>
    <div class="ev-f"><label>Documento</label><input value="000000000"></div>
    <div class="ev-f"><label>EPS</label><input value="EPS SINTETICA"></div></div>
    <div style="margin-top:12px"><span class="ev-btn">HISTORIAL</span><span class="ev-btn">PAQUETES</span></div></div>
  <div class="ev-card"><h3>Enfermedad actual</h3><p class="ev-nota">Paciente sintético que acude a control de programa. Refiere adherencia al tratamiento. Sin cambios relevantes desde el último control. Texto de relleno para que exista contenido clínico bajo los paneles flotantes y se pueda juzgar la lectura a través de los velos.</p><p class="ev-nota">Segundo párrafo de relleno con cifras 120/80, 72 kg, 165 cm, IMC 26,4. Creatinina 0,9 mg/dL. HbA1c 6,8 %. LDL 96 mg/dL.</p></div>
  <div class="ev-card"><h3>Examen físico</h3><div class="ev-grid">
    <div class="ev-f"><label>Tensión arterial</label><input value="120/80"></div>
    <div class="ev-f"><label>Peso</label><input value="72"></div>
    <div class="ev-f"><label>Talla</label><input value="165"></div>
    <div class="ev-f"><label>Perímetro abdominal</label><input value="92"></div>
    <div class="ev-f"><label>Frecuencia cardiaca</label><input value="72"></div>
    <div class="ev-f"><label>Saturación</label><input value="97"></div></div></div>
  <div class="ev-card"><h3>Análisis y plan</h3><div class="ev-f"><textarea rows="6">Plan sintético: continuar manejo, control en 3 meses, laboratorios de control.</textarea></div></div>
  <div class="ev-card"><h3>Conducta</h3><p class="ev-nota">Relleno adicional para que la página tenga scroll y exista texto bajo el pie de página del modal.</p><p class="ev-nota">Más relleno. Más relleno. Más relleno.</p></div>
</div>`;

// Medición de contraste WCAG con composición real de fondos (color sólido + promedio de las
// paradas del degradado) y opacidad acumulada.
const MEDIR = `(function(){
  function parse(c){ const m=String(c).match(/rgba?\\(([^)]+)\\)/); if(!m) return null; const p=m[1].split(',').map(parseFloat); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
  function paradas(bgImage){ if(!bgImage||bgImage==='none') return null; const cols=[...bgImage.matchAll(/rgba?\\([^)]+\\)/g)].map(m=>parse(m[0])).filter(Boolean); if(!cols.length) return null; const n=cols.length; return {r:cols.reduce((s,c)=>s+c.r*c.a,0)/n,g:cols.reduce((s,c)=>s+c.g*c.a,0)/n,b:cols.reduce((s,c)=>s+c.b*c.a,0)/n,a:cols.reduce((s,c)=>s+c.a,0)/n}; }
  function over(top,bot){ const a=top.a; return {r:top.r*a+bot.r*(1-a),g:top.g*a+bot.g*(1-a),b:top.b*a+bot.b*(1-a),a:1}; }
  function lin(c){ c/=255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4); }
  function lum(c){ return 0.2126*lin(c.r)+0.7152*lin(c.g)+0.0722*lin(c.b); }
  function ratio(a,b){ const la=lum(a),lb=lum(b); const hi=Math.max(la,lb),lo=Math.min(la,lb); return (hi+0.05)/(lo+0.05); }
  function hex(c){ const h=(v)=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0'); return '#'+h(c.r)+h(c.g)+h(c.b); }
  const raices=[...document.body.children].filter(n=>(n.id||'').startsWith('vgl-'));
  const out=[];
  for(const raiz of raices){
    const cs0=getComputedStyle(raiz); if(cs0.display==='none') continue;
    raiz.querySelectorAll('*').forEach((el)=>{
      const tieneTexto=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
      if(!tieneTexto) return;
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden') return;
      const r=el.getBoundingClientRect(); if(r.width===0||r.height===0) return;
      const cadena=[]; let e=el; while(e){ cadena.unshift(e); e=e.parentElement; }
      let bg={r:238,g:241,b:245,a:1}; let opac=1;
      for(const n of cadena){ const s=getComputedStyle(n); const b=parse(s.backgroundColor); if(b&&b.a>0) bg=over(b,bg); const g=paradas(s.backgroundImage); if(g&&g.a>0) bg=over(g,bg); const o=parseFloat(s.opacity); if(!isNaN(o)) opac*=o; }
      const fg0=parse(cs.color)||{r:0,g:0,b:0,a:1};
      let fg=over({r:fg0.r,g:fg0.g,b:fg0.b,a:fg0.a},bg);
      if(opac<1){ fg=over({r:fg.r,g:fg.g,b:fg.b,a:opac},bg); }
      const fs=parseFloat(cs.fontSize); const fw=parseInt(cs.fontWeight,10)||400;
      const grande=fs>=24||(fs>=18.66&&fw>=700);
      const req=grande?3:4.5;
      const rt=ratio(fg,bg);
      const camino=[]; let x=el; while(x&&x!==raiz&&camino.length<4){ camino.unshift(x.tagName.toLowerCase()+(x.id?'#'+x.id:'')+(x.className&&typeof x.className==='string'&&x.className.trim()?'.'+x.className.trim().split(/\\s+/).join('.'):'')); x=x.parentElement; }
      const txt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').slice(0,36);
      if(/^[\\p{Emoji}\\s+×✕▶▾]+$/u.test(txt)) return; // emojis y glifos decorativos: no son texto
      out.push({raiz:raiz.id,sel:camino.join(' > '),txt,fg:hex(fg),bg:hex(bg),ratio:+rt.toFixed(2),fs,fw,opac:+opac.toFixed(2),req,falla:rt<req});
    });
  }
  return out;
})()`;

(async () => {
  // 1. Cosecha
  let css = ""; let COLORS = null;
  const superficies = new Map();
  const cobertura = [];
  for (const [nombre, abrir] of APERTURAS) {
    const c = cargar({ silencioso: true });
    try { c.api.buildOverlay(); } catch (e) { }
    if (!css) css = estilos(c);
    if (!COLORS) COLORS = c.api.__COLORS;
    let err = "";
    try { await Promise.race([Promise.resolve().then(() => abrir(c)), new Promise((r) => setTimeout(r, 3000))]); } catch (e) { err = String((e && e.message) || e).split("\n")[0].slice(0, 90); }
    const nuevas = [];
    for (const n of c.env.doc.body.children) {
      if (!(n.id || "").startsWith("vgl-")) continue;
      const html = ser(n);
      if (superficies.has(n.id) && superficies.get(n.id).html.length >= html.length) continue;
      superficies.set(n.id, { origen: nombre, html });
      nuevas.push(n.id + " (" + html.length + ")");
    }
    cobertura.push({ nombre, err, nuevas });
  }
  {
    const c = cargar({ silencioso: true });
    try { c.api.buildOverlay(); } catch (e) { }
    for (const [id, inner] of plantillas(c)) {
      if (id === "vgl-deshacer-llenado") { superficies.set(id, { origen: "plantilla", html: `<button id="vgl-deshacer-llenado" class="vgl-exf-btn">↩ Deshacer llenado</button>` }); continue; }
      if (!superficies.has(id) || superficies.get(id).html.length < 200) superficies.set(id, { origen: "plantilla", html: `<div id="${id}">${inner}</div>` });
    }
    // el toast del piloto: el id va EN el propio toast (t.id="vgl-sp"; t.className="vgl-sp-toast")
    superficies.set("vgl-sp", { origen: "plantilla", html: `<div id="vgl-sp" class="vgl-sp-toast vgl-sp-visible">Aviso del piloto SharePoint (sintético): la lista de hoy se leyó correctamente. <span class="vgl-sp-x">×</span></div>` });
  }
  // Tarjetas dentro de #vgl-list del panel (el arnés no puede: el.list es null en el DOM falso)
  {
    const s = superficies.get("vgl-root");
    const listaRe = /<div id="vgl-list">[\s\S]*?<\/div>\s*<div id="vgl-sheet">/;
    if (s && listaRe.test(s.html)) {
      s.html = s.html.replace(listaRe, `<div id="vgl-list">${tarjetas(COLORS)}</div><div id="vgl-sheet">`);
      s.html = s.html.replace(/<div id="vgl-sum">[^<]*<\/div>/, '<div id="vgl-sum">Vigilando la agenda · 10 cita(s) · act. 08:00:00 · PyM: 42</div>');
      s.html = s.html.replace(/<span id="vgl-clock"[^>]*><\/span>/, '<span id="vgl-clock" title="">08:00 · 1 h 20 min</span>');
      s.html = s.html.replace('<div id="vgl-stats"></div>', '<div id="vgl-stats"><div class="vgl-stat hot"><span class="vgl-d" style="background:var(--c-rojo)"></span>No confirmadas<b>1</b></div><div class="vgl-stat"><span class="vgl-d" style="background:var(--c-verde)"></span>En sala<b>4</b></div><div class="vgl-stat"><span class="vgl-d" style="background:var(--c-atendido)"></span>Atendidas<b>2</b></div></div>');
      s.html = s.html.replace('<div id="vgl-title">Centinela</div>', '<div id="vgl-title">Centinela <small>v18.0.113</small></div>');
    }
  }
  fs.writeFileSync(path.join(OUT, "css_real.css"), css);
  console.log("CSS real: " + css.length + " chars");
  for (const r of cobertura) console.log(`  ${r.nuevas.length ? "ok " : "-- "} ${r.nombre.padEnd(20)} ${r.nuevas.join(", ") || "(nada)"}${r.err ? "  [" + r.err + "]" : ""}`);
  console.log("Superficies: " + [...superficies.keys()].join(", "));
  for (const [id, s] of superficies) fs.writeFileSync(path.join(OUT, "html_" + id + ".html"), s.html);

  // 2. Chromium
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const resultados = { contraste: {}, layout: {}, motion: {}, foco: {}, capas: {} };
  const pagina = (ids, claro, hc, extraCss) => {
    const cuerpo = ids.map((id) => superficies.get(id) ? superficies.get(id).html : "").join("\n");
    return `<!doctype html><html><head><meta charset="utf-8"><style>${EVEREST_CSS}</style><style id="vgl">${css}</style>${extraCss ? `<style id="extra">${extraCss}</style>` : ""}</head><body>${EVEREST_BODY}${cuerpo}<script>
      (function(){ const cl=${claro}, hc=${hc}; [...document.body.children].forEach(n=>{ if(!(n.id||'').startsWith('vgl-')) return; if(cl) n.classList.add('light'); if(hc && ['vgl-root','vgl-dock','vgl-acciones-dock','vgl-toasts','vgl-pym-banner'].includes(n.id)) n.classList.add('vgl-hc'); });
        const d=document.getElementById('vgl-dock'); if(d) d.style.display='flex';
        const r=document.getElementById('vgl-root'); if(r){ r.style.display='flex'; const dot=r.querySelector('#vgl-dot'); if(dot) dot.className='bg'; }
        const min=document.getElementById('vgl-min-bar'); if(min) min.style.display='flex';
        const vp=document.getElementById('vgl-visib-pill'); if(vp) vp.style.display='block';
      })();
    </script></body></html>`;
  };

  const ESCENAS = [
    ["panel_oscuro", ["vgl-root", "vgl-toasts", "vgl-acciones-dock", "vgl-lab-injector", "vgl-examen-normalidad", "vgl-cw-examenes"], false, false],
    ["panel_claro", ["vgl-root", "vgl-toasts", "vgl-acciones-dock", "vgl-lab-injector", "vgl-examen-normalidad"], true, false],
    ["panel_hc", ["vgl-root", "vgl-toasts", "vgl-acciones-dock"], false, true],
    ["panel_hc_claro", ["vgl-root", "vgl-acciones-dock"], true, true],
    ["esquina", ["vgl-root", "vgl-postcita-panel", "vgl-sp", "vgl-deshacer-llenado", "vgl-min-bar", "vgl-toasts"], false, false],
    ["agendar_oscuro", ["vgl-agendar-modal"], false, false],
    ["agendar_claro", ["vgl-agendar-modal"], true, false],
    ["ordenar_oscuro", ["vgl-ordenar-modal"], false, false],
    ["labs_oscuro", ["vgl-labs-modal"], false, false],
    ["labs_claro", ["vgl-labs-modal"], true, false],
    ["panel_paciente_oscuro", ["vgl-panel-modal"], false, false],
    ["panel_paciente_claro", ["vgl-panel-modal"], true, false],
    ["ia_oscuro", ["vgl-ia-modal"], false, false],
    ["ia_claro", ["vgl-ia-modal"], true, false],
    ["chooser_oscuro", ["vgl-chooser-modal"], false, false],
    ["paquete_oscuro", ["vgl-paquete-modal"], false, false],
    ["pym_oscuro", ["vgl-pym-modal"], false, false],
    ["pym_claro", ["vgl-pym-modal"], true, false],
    ["bigalert_oscuro", ["vgl-modal"], false, false],
    ["bigalert_claro", ["vgl-modal"], true, false],
    ["banner_oscuro", ["vgl-pym-banner", "vgl-root"], false, false],
    ["banner_claro", ["vgl-pym-banner"], true, false],
    ["burbuja", ["vgl-acomp-burbuja"], false, false],
    ["minbar", ["vgl-min-bar", "vgl-acciones-dock"], false, false],
  ];
  const VIEWPORTS = [[1366, 768], [1920, 1080]];
  for (const [nombre, ids, claro, hc] of ESCENAS) {
    const presentes = ids.filter((id) => superficies.has(id));
    if (!presentes.length) { console.log("(sin HTML) " + nombre); continue; }
    for (const [w, h] of VIEWPORTS) {
      if (w === 1920 && !/^panel_oscuro|^agendar_oscuro|^labs_oscuro|^esquina|^panel_paciente_oscuro|^ia_oscuro/.test(nombre)) continue;
      const p = await nav.newPage({ viewport: { width: w, height: h } });
      await p.setContent(pagina(presentes, claro, hc));
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(OUT, `${nombre}_${w}x${h}.png`) });
      if (w === 1366) {
        resultados.contraste[nombre] = await p.evaluate(MEDIR);
        resultados.layout[nombre] = await p.evaluate(() => {
          const rc = (id) => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), z: getComputedStyle(e).zIndex }; };
          const out = { root: rc("vgl-root"), postcita: rc("vgl-postcita-panel"), sp: rc("vgl-sp"), deshacer: rc("vgl-deshacer-llenado"), minbar: rc("vgl-min-bar"), acciones: rc("vgl-acciones-dock"), toasts: rc("vgl-toasts"), labinj: rc("vgl-lab-injector"), exf: rc("vgl-examen-normalidad") };
          const lista = document.getElementById("vgl-list");
          if (lista) {
            const lr = lista.getBoundingClientRect();
            const cards = [...lista.querySelectorAll(".vgl-card")];
            out.listaAlto = Math.round(lr.height); out.tarjetas = cards.length;
            out.tarjetasCompletas = cards.filter((c) => { const r = c.getBoundingClientRect(); return r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1; }).length;
            out.tarjetaAltos = cards.slice(0, 4).map((c) => Math.round(c.getBoundingClientRect().height));
            const sb = document.getElementById("vgl-sidebar"); out.sidebarAncho = sb ? Math.round(sb.getBoundingClientRect().width) : null;
            const main = document.getElementById("vgl-main"); out.mainAncho = main ? Math.round(main.getBoundingClientRect().width) : null;
          }
          return out;
        });
        resultados.capas[nombre] = await p.evaluate(() => {
          const out = { backdrop: [], sombras3: 0, textShadow: [] };
          document.querySelectorAll("[id^=vgl-], [id^=vgl-] *").forEach((el) => {
            const cs = getComputedStyle(el);
            const bf = cs.backdropFilter || cs.webkitBackdropFilter; if (bf && bf !== "none") out.backdrop.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]) + " → " + bf);
            if ((cs.boxShadow.match(/\)/g) || []).length >= 3 && cs.boxShadow !== "none") out.sombras3++;
            if (cs.textShadow && cs.textShadow !== "none" && el.textContent.trim().length > 1 && el.children.length === 0) out.textShadow.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]));
          });
          out.backdrop = [...new Set(out.backdrop)]; out.textShadow = [...new Set(out.textShadow)].slice(0, 10);
          return out;
        });
      }
      await p.close();
    }
  }
  {
    const p = await nav.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.setContent(pagina(["vgl-root"], false, false)); await p.waitForTimeout(400);
    resultados.layout.panel_1920 = await p.evaluate(() => { const lista = document.getElementById("vgl-list"); const lr = lista.getBoundingClientRect(); const cards = [...lista.querySelectorAll(".vgl-card")]; const root = document.getElementById("vgl-root").getBoundingClientRect(); return { rootH: Math.round(root.height), rootW: Math.round(root.width), listaAlto: Math.round(lr.height), tarjetasCompletas: cards.filter((c) => { const r = c.getBoundingClientRect(); return r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1; }).length, tarjetas: cards.length }; });
    await p.close();
  }
  // Densidad con una variante compacta propuesta (solo espaciado, sin tocar tipografía)
  {
    const COMPACTO = `@media (max-height:800px){#vgl-root #vgl-list{gap:6px;padding:8px 10px 10px}#vgl-root .vgl-card{padding:9px 12px 8px}#vgl-root .vgl-card-mid.vgl-card-mid-t1{margin-top:5px}#vgl-root .vgl-card-btm.vgl-card-btm-t1{margin-top:4px}#vgl-root .vgl-pyms{margin-top:5px;gap:4px}#vgl-root .vgl-chip{padding:3px 8px}}`;
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    await p.setContent(pagina(["vgl-root"], false, false, COMPACTO)); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, "propuesta_panel_compacto_1366x768.png") });
    resultados.layout.panel_compacto_1366 = await p.evaluate(() => { const lista = document.getElementById("vgl-list"); const lr = lista.getBoundingClientRect(); const cards = [...lista.querySelectorAll(".vgl-card")]; return { listaAlto: Math.round(lr.height), tarjetasCompletas: cards.filter((c) => { const r = c.getBoundingClientRect(); return r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1; }).length, tarjetaAltos: cards.slice(0, 4).map((c) => Math.round(c.getBoundingClientRect().height)) }; });
    await p.close();
  }

  // 3. prefers-reduced-motion
  {
    const ids = ["vgl-panel-modal", "vgl-ia-modal", "vgl-agendar-modal", "vgl-labs-modal", "vgl-chooser-modal", "vgl-paquete-modal", "vgl-pym-modal", "vgl-modal", "vgl-postcita-panel", "vgl-acomp-burbuja", "vgl-root", "vgl-min-bar", "vgl-sp"].filter((i) => superficies.has(i));
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
    await p.setContent(pagina(ids, false, false)); await p.waitForTimeout(300);
    resultados.motion = await p.evaluate(() => {
      const out = {};
      for (const raiz of [...document.body.children].filter((n) => (n.id || "").startsWith("vgl-"))) {
        const vivos = [];
        const mira = (el, nombre) => { const cs = getComputedStyle(el); if (cs.animationName && cs.animationName !== "none") vivos.push(nombre + " → " + cs.animationName + " " + cs.animationDuration); const tr = cs.transitionDuration; if (tr && tr.split(",").some((t) => parseFloat(t) > 0)) vivos.push(nombre + " → transition " + tr.split(",")[0]); };
        mira(raiz, "(raíz)");
        raiz.querySelectorAll("*").forEach((el) => mira(el, el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "")));
        out[raiz.id] = { animaciones: vivos.filter((v) => !v.includes("transition")).slice(0, 5), transiciones: vivos.filter((v) => v.includes("transition")).length };
      }
      return out;
    });
    await p.close();
  }
  // 3b. animaciones INFINITAS
  {
    const ids = ["vgl-root", "vgl-cw-examenes", "vgl-pym-modal", "vgl-modal", "vgl-labs-modal"].filter((i) => superficies.has(i));
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    await p.setContent(pagina(ids, false, false)); await p.waitForTimeout(300);
    resultados.infinitas = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll("[id^=vgl-] *, [id^=vgl-]").forEach((el) => { const cs = getComputedStyle(el); if (cs.animationIterationCount === "infinite" && cs.animationName !== "none") out.push((el.id ? "#" + el.id : el.tagName.toLowerCase()) + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "") + " → " + cs.animationName); });
      return out;
    });
    await p.close();
  }

  // 4. Foco de teclado en los semáforos .vgl-tl
  {
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    await p.setContent(pagina(["vgl-root"], false, false)); await p.waitForTimeout(300);
    await p.keyboard.press("Tab");
    resultados.foco = await p.evaluate(() => {
      const a = document.activeElement; const cs = a ? getComputedStyle(a) : null;
      const r = { activo: a ? (a.id || a.className) : null, outlineStyle: cs && cs.outlineStyle, outlineWidth: cs && cs.outlineWidth, outlineColor: cs && cs.outlineColor, boxShadow: cs && cs.boxShadow.slice(0, 80), matchesFocusVisible: a ? a.matches(":focus-visible") : null };
      const tl = document.querySelector(".vgl-tl"); const cs2 = getComputedStyle(tl);
      r.tl = { w: cs2.width, h: cs2.height, rect: tl.getBoundingClientRect().width };
      return r;
    });
    // botón del dock y chip de filtro como comparación
    await p.setContent(pagina(["vgl-root", "vgl-acciones-dock"], false, false)); await p.waitForTimeout(200);
    resultados.foco.otros = await p.evaluate(() => {
      const out = {};
      for (const sel of [".vgl-fchip", ".vgl-dock-btn", ".vgl-btn-action", ".vgl-sb-btn"]) { const el = document.querySelector(sel); if (!el) { out[sel] = "no existe"; continue; } el.focus(); out[sel] = { fv: el.matches(":focus-visible"), outline: getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineWidth }; }
      return out;
    });
    await p.close();
  }

  // 5. Pares puntuales (interruptor, stepper, tip-btn, undo, año de labs, pie bento, título small)
  {
    const p = await nav.newPage({ viewport: { width: 1366, height: 768 } });
    const html = `<div id="vgl-root"><div id="vgl-head"><div id="vgl-title">Centinela <small data-p="titsmall">v18.0.113</small></div></div><div class="vgl-fld"><label class="vgl-sw"><input type="checkbox"><i></i></label></div><div class="vgl-tip-btn" data-p="tip">?</div><button class="vgl-tip-btn" aria-expanded="true" data-p="tipon">?</button><button class="vgl-btn-undo" data-p="undo">Deshacer</button><div class="vgl-card atendido"><div class="vgl-card-mid"><div class="vgl-name vgl-name-t1"><b data-p="atName">PACIENTE SINTETICO</b></div><span class="vgl-doc vgl-doc-t1" data-p="atDoc">CC SYN-1003</span></div><div class="vgl-pyms"><span class="vgl-chip" data-p="atChip">CONTROL SINTETICO</span></div><div class="vgl-none falta" data-p="atFalta">Dato faltante</div></div><div id="vgl-empty" data-p="empty">Ninguna cita coincide</div></div>
      <div id="vgl-agendar-modal" style="position:static;height:auto;width:auto"><div class="vgl-agm-card"><div class="vgl-stepper-bar"><span class="vgl-stepper-step active"><span class="vgl-step-num" data-p="stepact">1</span>Paso</span><span class="vgl-stepper-step completed"><span class="vgl-step-num" data-p="stepok">2</span>Listo</span></div><span class="vgl-agm-cupo-adic" data-p="adic">+ ADICIONAL</span><div class="vgl-agm-slots"><button class="vgl-agm-sbtn vgl-agm-sbtn-sugerido" data-p="sug">⭐ 08:30</button><button class="vgl-agm-sbtn vgl-agm-sbtn-franja" data-p="franja">09:00</button></div></div></div>
      <div id="vgl-labs-modal" style="position:static;height:auto;width:auto"><div class="vgl-agm-card"><table class="vgl-labs-table"><tr class="vgl-labs-tr"><td><div class="vgl-labs-date">12 ago <small data-p="anio">2026</small></div></td></tr></table></div></div>
      <div id="vgl-panel-modal" style="position:static;height:auto;width:auto"><div class="vgl-agm-card"><div class="vgl-bento-card"><div class="vgl-bento-pie" data-p="pie">Toque para ver el detalle →</div><span class="vgl-bento-badge nd" data-p="nd">Sin dato</span></div></div></div>
      <div id="vgl-toasts"><div class="vgl-toast"><span class="vgl-toast-x" data-p="toastx">×</span></div></div>`;
    const medirPares = async (claro) => {
      await p.setContent(`<!doctype html><html><head><style>${EVEREST_CSS}</style><style>${css}</style></head><body>${html}<script>if(${claro}) document.querySelectorAll('[id^=vgl-]').forEach(n=>n.classList.add('light'))</script></body></html>`);
      return p.evaluate(() => {
        function parse(c) { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
        function over(t, b) { const a = t.a; return { r: t.r * a + b.r * (1 - a), g: t.g * a + b.g * (1 - a), b: t.b * a + b.b * (1 - a), a: 1 }; }
        function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
        function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
        function ratio(a, b) { const la = lum(a), lb = lum(b); return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)).toFixed(2)); }
        function hex(c) { const h = (v) => Math.round(v).toString(16).padStart(2, '0'); return '#' + h(c.r) + h(c.g) + h(c.b); }
        const out = {};
        const sw = document.querySelector(".vgl-sw i"); const knob = getComputedStyle(sw, "::after");
        const root = document.getElementById("vgl-root");
        const base = { r: 238, g: 241, b: 245, a: 1 };
        const rootBg = over(parse(getComputedStyle(root).backgroundColor), base);
        const riel = over(parse(getComputedStyle(sw).backgroundColor), rootBg);
        out.interruptor_off = { perilla: hex(parse(knob.backgroundColor)), riel: hex(riel), perilla_vs_riel: ratio(parse(knob.backgroundColor), riel), riel_vs_fondo: ratio(riel, rootBg) };
        document.querySelector(".vgl-sw input").checked = true;
        const riel2 = over(parse(getComputedStyle(sw).backgroundColor), rootBg);
        out.interruptor_on = { riel: hex(riel2), perilla_vs_riel: ratio(parse(knob.backgroundColor), riel2), riel_vs_fondo: ratio(riel2, rootBg) };
        for (const el of document.querySelectorAll("[data-p]")) {
          const cs = getComputedStyle(el); const fg = parse(cs.color); let bg = base; const cadena = []; let e = el; while (e) { cadena.unshift(e); e = e.parentElement; }
          let op = 1; for (const n of cadena) { const s = getComputedStyle(n); const b = parse(s.backgroundColor); if (b && b.a > 0) bg = over(b, bg); op *= parseFloat(s.opacity) || 1; }
          let f = over(fg, bg); if (op < 1) f = over({ ...f, a: op }, bg);
          out[el.dataset.p] = { fg: hex(f), bg: hex(bg), ratio: ratio(f, bg), fs: cs.fontSize, fw: cs.fontWeight, op: +op.toFixed(2) };
        }
        return out;
      });
    };
    resultados.pares = { oscuro: await medirPares(false), claro: await medirPares(true) };
    await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div id="vgl-root"><button class="vgl-tip-btn" id="t">?</button><button class="vgl-btn-undo" id="u">Deshacer</button></div></body></html>`);
    await p.hover("#t"); resultados.pares.oscuro.tip_hover = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById("t")); return { color: cs.color, bg: cs.backgroundColor }; });
    await p.hover("#u"); resultados.pares.oscuro.undo_hover = await p.evaluate(() => { const cs = getComputedStyle(document.getElementById("u")); return { color: cs.color, bg: cs.backgroundColor }; });
    await p.close();
  }

  await nav.close();
  fs.writeFileSync(path.join(OUT, "resultados.json"), JSON.stringify(resultados, null, 1));

  console.log("\n=== CONTRASTE (fallas AA por escena, 1366×768, Everest hostil) ===");
  for (const [esc, arr] of Object.entries(resultados.contraste)) {
    const fallas = arr.filter((x) => x.falla);
    const min = arr.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 3).map((f) => `${f.ratio}:${f.sel.split(" > ").pop().slice(0, 28)}`).join(" | ");
    console.log(`${esc}: ${arr.length} nodos, ${fallas.length} bajo AA · mínimos: ${min}`);
    fallas.slice(0, 12).forEach((f) => console.log(`   ${f.ratio.toFixed(2).padStart(5)} (req ${f.req}) fs=${f.fs}px fw=${f.fw} op=${f.opac} fg=${f.fg} bg=${f.bg}  #${f.raiz} ${f.sel.slice(0, 80)}  «${f.txt}»`));
  }
  console.log("\n=== LAYOUT ==="); console.log(JSON.stringify(resultados.layout, null, 0));
  console.log("\n=== CAPAS ==="); for (const [k, v] of Object.entries(resultados.capas)) console.log(k, JSON.stringify(v));
  console.log("\n=== REDUCED MOTION ==="); console.log(JSON.stringify(resultados.motion, null, 0));
  console.log("\n=== INFINITAS ==="); console.log(resultados.infinitas);
  console.log("\n=== FOCO ==="); console.log(JSON.stringify(resultados.foco, null, 0));
  console.log("\n=== PARES ==="); console.log(JSON.stringify(resultados.pares, null, 0));
})();
