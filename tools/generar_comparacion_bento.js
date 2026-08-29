const fs = require("fs");
const path = require("path");
const REPO = "/home/user/vigilante-agenda-everest";
const OUT = "/home/user/vigilante-agenda-everest/docs/propuesta_bento/index.html";

// ---- CSS REAL del script, con las hojas interpoladas resueltas (método de suite_25) ----
const code = fs.readFileSync(path.join(REPO, "vigilante_agenda.user.js"), "utf8");
let css = "", inCss = false;
for (const l of code.split("\n")) {
  if (l.includes("style.textContent = `")) { inCss = true; continue; }
  if (inCss && l.includes("`;")) { inCss = false; break; }
  if (inCss) css += l + "\n";
}
const resolver = (n) => {
  const m = "const " + n + " = `";
  const i = code.indexOf(m);
  if (i < 0) return null;
  const d = i + m.length;
  return code.slice(d, code.indexOf("`;", d));
};
for (const m of css.matchAll(/\$\{_cssSeguro\(\(\) => (\w+)\)\}/g)) {
  const r = resolver(m[1]);
  if (r !== null) css = css.split(m[0]).join(r);
}

// ---- La propuesta Bento (solo los componentes propios) ----
const BENTO = `
/* ===== PROPUESTA BENTO — solo componentes propios, cero selectores de Everest ===== */
#vgl-cw-examenes .vgl-cw-panel{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s2);
  padding:var(--s3);
  box-shadow:0 6px 18px rgba(0,0,0,.38);
}
#vgl-cw-examenes .vgl-cw-fila{
  margin:0;border-radius:var(--r-chip);padding:var(--s2);
  background:var(--surface-1) !important;
  box-shadow:inset 0 0 0 1px var(--line);
  display:flex;flex-direction:column;gap:2px;
}
#vgl-cw-examenes .vgl-cw-fila:not(:last-child){border-bottom:none;padding-bottom:var(--s2)}
#vgl-cw-examenes .vgl-cw-venc{background:rgba(239,83,80,.14) !important}
#vgl-cw-examenes .vgl-cw-pedir{background:rgba(255,196,107,.14) !important}
:where(#vgl-cw-examenes .vgl-cw-fila :not([class])){color:inherit}

#vgl-acciones-dock{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s2);
  color:var(--fg) !important;
}
#vgl-acciones-dock .vgl-dock-btn-primario{
  grid-column:1 / -1;
  background:rgba(96,165,250,.16) !important;
  color:#93c5fd !important;
  box-shadow:inset 0 0 0 1px rgba(96,165,250,.30);
  border-radius:var(--r-card);
}
`;

// ---- Marcado REAL, copiado de :5596-5598 y del dock ----
const MARCADO = `
<div class="bloque">
  <h3>Panel del widget de exámenes</h3>
  <div id="vgl-cw-examenes" class="vgl-cw vgl-cw-pend vgl-cw-abierto">
    <div class="vgl-cw-panel">
      <div class="vgl-cw-fila vgl-cw-venc"><span class="vgl-cw-nom">CREATININA</span><span class="vgl-cw-que">vencida hace 42 días</span></div>
      <div class="vgl-cw-fila vgl-cw-venc"><span class="vgl-cw-nom">HEMOGLOBINA GLICOSILADA</span><span class="vgl-cw-que">vencida hace 12 días</span></div>
      <div class="vgl-cw-fila vgl-cw-pedir"><span class="vgl-cw-nom">PERFIL LIPÍDICO</span><span class="vgl-cw-que">toca en el próximo control</span></div>
      <div class="vgl-cw-fila vgl-cw-pedir"><span class="vgl-cw-nom">MICROALBUMINURIA</span><span class="vgl-cw-que">toca en el próximo control</span></div>
      <div class="vgl-cw-fila vgl-cw-pedir"><span class="vgl-cw-nom">PARATOHORMONA</span><span class="vgl-cw-que">toca en el próximo control</span></div>
      <div class="vgl-cw-fila vgl-cw-pedir"><span class="vgl-cw-nom">FÓSFORO EN SUERO</span><span class="vgl-cw-que">toca en el próximo control</span></div>
    </div>
  </div>
</div>
<div class="bloque">
  <h3>Dock de acciones</h3>
  <div id="vgl-acciones-dock" class="vgl-acciones-dock">
    <button class="vgl-dock-btn vgl-dock-btn-primario">📋 Ordenar pendientes</button>
    <button class="vgl-dock-btn">🧪 Laboratorios</button>
    <button class="vgl-dock-btn">📅 Agendar</button>
    <button class="vgl-dock-btn">👤 Panel</button>
    <button class="vgl-dock-btn">✍️ Redactar</button>
  </div>
</div>`;

const marcoBase = (extra) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0b0e15;padding:14px;font-family:system-ui,sans-serif}
.bloque{margin-bottom:22px}
.bloque h3{color:#8b93a1;font-size:11px;text-transform:uppercase;letter-spacing:.07em;margin:0 0 10px;font-weight:700}
#vgl-cw-examenes,#vgl-acciones-dock{position:static !important;transform:none !important;max-width:none !important}
#vgl-cw-examenes .vgl-cw-badge{display:none !important}
#vgl-cw-examenes .vgl-cw-panel{display:block;position:static !important}
</style><style>${css}</style>${extra ? `<style>${extra}</style>` : ""}</head>
<body>${MARCADO}</body></html>`;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const page = `<title>Bento, Antes y Después</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700;800&display=swap');
  :root{--paper:#eef0f3;--ink:#12151b;--ink2:#5a6472;--line:#dde1e7;--card:#fff;--acc:#1f6f62}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#0a0c10;--ink:#f0f2f6;--ink2:#98a1b0;--line:#242a35;--card:#151922;--acc:#4fd1c5}}
  :root[data-theme="dark"]{--paper:#0a0c10;--ink:#f0f2f6;--ink2:#98a1b0;--line:#242a35;--card:#151922;--acc:#4fd1c5}
  *{box-sizing:border-box}
  body{background:var(--paper);color:var(--ink);font-family:'Public Sans',system-ui,sans-serif;margin:0;padding:40px 24px 90px}
  .wrap{max-width:1240px;margin:0 auto}
  h1{font-size:26px;font-weight:800;letter-spacing:-.015em;margin:0 0 10px}
  .lede{color:var(--ink2);font-size:15px;line-height:1.65;max-width:70ch;margin:0 0 8px}
  .aviso{border-left:3px solid var(--acc);padding:12px 16px;background:var(--card);border-radius:0 10px 10px 0;margin:26px 0 34px;font-size:14px;line-height:1.6;color:var(--ink2)}
  .aviso b{color:var(--ink)}
  .par{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}
  @media (max-width:900px){.par{grid-template-columns:1fr}}
  .col h2{font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink2);margin:0 0 10px;font-weight:700}
  .col.dsp h2{color:var(--acc)}
  iframe{width:100%;height:560px;border:1px solid var(--line);border-radius:14px;background:#0b0e15;display:block}
  .nota{font-size:13.5px;color:var(--ink2);line-height:1.65;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:14px}
  .nota b{color:var(--ink)}
  ul{margin:10px 0 0;padding-left:20px}li{margin:6px 0;font-size:14px;color:var(--ink2);line-height:1.55}li b{color:var(--ink)}
</style>
<div class="wrap">
  <h1>Propuesta Bento — antes y después, con el CSS real</h1>
  <p class="lede">Los dos marcos de abajo cargan la <b>hoja de estilos real del script</b> (227 KB, con las
  hojas interpoladas resueltas), no una copia hecha a mano. El de la derecha añade encima las reglas
  propuestas. El fondo oscuro es el del propio widget.</p>

  <div class="aviso">
    <b>Antes de mirar:</b> usted ya rechazó tres rondas de rediseño y dijo que el aspecto actual le
    gustaba más. Esta propuesta es <b>deliberadamente conservadora</b>: no cambia la paleta, ni la
    tipografía, ni el tamaño de la letra. Solo reorganiza en rejilla y abarata el pintado.
    Si no le convence, no se pierde nada — no está aplicada, y el respaldo está hecho.
  </div>

  <div class="par">
    <div class="col"><h2>Antes — como está hoy</h2><iframe srcdoc="${esc(marcoBase(""))}"></iframe></div>
    <div class="col dsp"><h2>Después — propuesta Bento</h2><iframe srcdoc="${esc(marcoBase(BENTO))}"></iframe></div>
  </div>

  <div class="nota">
    <b>Qué cambia, en concreto</b>
    <ul>
      <li><b>Panel de exámenes:</b> de lista vertical con líneas divisorias a rejilla de dos columnas,
      donde cada examen es una tesela con su propio fondo. La severidad pasa a ser el <b>fondo</b>
      (rojo tenue = vencido, ámbar = toca pedirlo), no solo el color de una palabra — se ve sin leer.
      Con seis exámenes, hoy hay que barrer seis renglones; en rejilla se leen tres pares de un golpe.</li>
      <li><b>Dock:</b> la acción principal ocupa una tesela de ancho completo; el resto queda en pares.
      Hoy los cinco botones pesan igual y la acción principal se busca por memoria de posición.</li>
      <li><b>Coste gráfico:</b> cada tesela usa <b>una</b> sombra interna en vez de las tres capas
      actuales. Pinta menos, no más.</li>
    </ul>
  </div>

  <div class="nota">
    <b>Lo que esto NO arregla, y conviene saberlo</b><br>
    Nada de esto resuelve los hallazgos serios de la auditoría de CSS. Esos son independientes y valen
    más: los seis colores del recordatorio de PyM (<b>ya entregado en la v17.44.0</b>), el panel de
    fármacos que se sale 32 px de la pantalla en 1366×768, y el pulso que anima una sombra en vez de
    usar la GPU. Esta propuesta es estética; aquéllos eran defectos.
  </div>
</div>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, page);
console.log("Generado:", OUT, "-", (page.length / 1024).toFixed(0), "KB");
