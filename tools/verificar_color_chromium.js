// Verificación EMPÍRICA que exige CLAUDE.md: el CSS real del script, montado contra un
// "Everest" agresivo, en Chromium de verdad. No una copia recortada a mano.
const fs = require("fs");
const { chromium } = require("playwright");

const code = fs.readFileSync("/home/user/vigilante-agenda-everest/vigilante_agenda.user.js", "utf8");
let css = "", inCss = false;
for (const l of code.split("\n")) {
  if (l.includes("style.textContent = `")) { inCss = true; continue; }
  if (inCss && l.includes("`;")) { inCss = false; break; }
  if (inCss) css += l + "\n";
}

// v17.23.0 — el bloque principal SPLICEA otras hojas con `${_cssSeguro(() => XXX_CSS)}`
// (MTR_CSS, MTR_RCV_CSS, ...). Esta extracción es textual, no ejecuta JS: sin este paso
// esos marcadores quedaban como texto literal (CSS inválido) y cualquier clase que solo
// viviera en una de esas hojas —como .vgl-mtr-* de MTR_CSS— nunca llegaba a Chromium,
// aunque en producción sí se pinta ahí. Se resuelve cada marcador con el valor real de su
// const, igual que hace el navegador al evaluar el template literal de verdad.
for (const m of css.matchAll(/\$\{_cssSeguro\(\(\) => (\w+)\)\}/g)) {
  const nombre = m[1];
  const ini = code.indexOf("const " + nombre + " = `");
  if (ini < 0) continue;
  const desde = ini + ("const " + nombre + " = `").length;
  const fin = code.indexOf("`;", desde);
  css = css.replace(m[0], code.slice(desde, fin));
}

// El adversario: Everest es una SPA ajena y su CSS es una caja negra. Se simula lo PEOR
// que puede tirar: una regla de tipo con !important sobre todo elemento de texto.
const EVEREST = `
  /* Exactamente la simulación que prescribe CLAUDE.md: una regla de tipo con !important
     sobre el color. Es lo más agresivo que una hoja real escribe; añadirle un
     background:transparent !important sería inventarse un adversario que no existe y
     medir contra él. */
  div,span,p,b,small,label,li,td,th{color:#111827 !important}
  body *{font-family:Arial !important}
`;

const CASOS = [
  { id: "vgl-ordenar-modal", cls: "vgl-ord-sexwarn", que: "aviso: citología a un hombre", token: "--c-rojo" },
  { id: "vgl-ordenar-modal", cls: "vgl-ord-vigwarn", que: "aviso de vigencia", token: "--c-verde" },
  { id: "vgl-ordenar-modal", cls: "vgl-ord-parcial", que: "corrida de órdenes A MEDIAS", token: "--c-ambar" },
  { id: "vgl-ordenar-modal", cls: "vgl-ord-pymsrc", que: "origen del paquete PyM", token: "--c-morado" },
  { id: "vgl-labs-modal",    cls: "vgl-labs-val",   que: "valor de laboratorio", token: "--fg" },
  { id: "vgl-labs-modal",    cls: "vgl-labs-patient", que: "nombre del paciente", token: "--fg" },
  { id: "vgl-agendar-modal", cls: "vgl-agm-patient", que: "paciente en agendar", token: "--fg" },
  // v17.14.0 — el aviso de desfase del reconciliador (#69 del enjambre). Cuelga de
  // document.body como los demás, así que su color tiene que sobrevivir al Everest agresivo.
  { id: "vgl-confirma-modal", cls: "vgl-conf-desfase", que: "aviso: su respuesta anterior quedó desactualizada", token: "--c-ambar" },
  // v17.16.0 — el aviso de que no se pudo cruzar contra Athenea (Tanda 4).
  { id: "vgl-ordenar-modal", cls: "vgl-ord-nocruce", que: "aviso: no se pudo cruzar contra Athenea", token: "--c-ambar" },
];
const BANDERAS = [
  { cls: "agpend", que: "🗓️ SIN TERMINAR", debeSer: "--c-ambar" },
  { cls: "adic",   que: "➕ CANDIDATO ADICIONAL", debeSer: "--c-azul" },
  { cls: "pes",    que: "❤ ABANDONO PROGRAMA RCV", debeSer: "--c-pes" },
  { cls: "",       que: "⛔ NO CONFIRMADO", debeSer: "--c-rojo" },
];

// v17.18.0 — el widget de Conducta (#vgl-cw-examenes) usa selectores compuestos
// (estado del contenedor + clase descendiente: ".vgl-cw-pend .vgl-cw-badge",
// ".vgl-cw-venc .vgl-cw-nom") que el arreglo CASOS de arriba (una sola clase por
// caso) no puede representar. Cada caso trae su propio HTML y su propio selector.
const WIDGET_CASOS = [
  { html: '<div id="vgl-cw-examenes" class="vgl-cw-pend"><div class="vgl-cw-badge" data-w="0">🧪 2</div></div>', sel: '[data-w="0"]', token: "--c-ambar", que: "badge: estado pendiente" },
  { html: '<div id="vgl-cw-examenes" class="vgl-cw-ok"><div class="vgl-cw-badge" data-w="1">🧪</div></div>', sel: '[data-w="1"]', token: "--c-verde", que: "badge: estado al día" },
  { html: '<div id="vgl-cw-examenes" class="vgl-cw-nd"><div class="vgl-cw-badge" data-w="2">🧪</div></div>', sel: '[data-w="2"]', token: "--fg3", que: "badge: sin juicio todavía" },
  { html: '<div id="vgl-cw-examenes"><div class="vgl-cw-panel"><div class="vgl-cw-fila vgl-cw-venc"><span class="vgl-cw-nom" data-w="3">CREATININA</span></div></div></div>', sel: '[data-w="3"]', token: "--c-rojo", que: "nombre de examen vencido" },
  { html: '<div id="vgl-cw-examenes"><div class="vgl-cw-panel"><div class="vgl-cw-fila vgl-cw-pedir"><span class="vgl-cw-nom" data-w="4">HEMOGLOBINA</span></div></div></div>', sel: '[data-w="4"]', token: "--c-ambar", que: "nombre de examen pendiente" },
  { html: '<div id="vgl-cw-examenes"><div class="vgl-cw-panel"><span class="vgl-cw-que" data-w="5">vence en 12 días</span></div></div>', sel: '[data-w="5"]', token: "--fg2", que: "texto secundario de cada fila" },
  // v17.23.0 — MTR_CSS solo estaba sembrado para #vgl-labs-modal; los mismos avisos
  // (.vgl-mtr-*) también se pintan dentro de #vgl-panel-modal (mtrPanelMedicamentosHtml).
  // Selectores compuestos (severidad + descendiente), por eso van aquí y no en CASOS.
  { html: '<div id="vgl-panel-modal"><div class="vgl-mtr-crit"><span class="vgl-mtr-conducta" data-w="6">Ajustar dosis</span></div></div>', sel: '[data-w="6"]', token: "--c-rojo", que: "Panel: conducta de aviso CRITICAL" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-mtr-alto"><span class="vgl-mtr-conducta" data-w="7">Vigilar función renal</span></div></div>', sel: '[data-w="7"]', token: "--c-ambar", que: "Panel: conducta de aviso HIGH" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-mtr-bloque"><span class="vgl-mtr-tit" data-w="8">Seguridad farmacológica</span></div></div>', sel: '[data-w="8"]', token: "--fg", que: "Panel: título del bloque de avisos" },
];

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setContent(`<!doctype html><html><head>
    <style>${EVEREST}</style>
    <style id="vgl">${css}</style>
  </head><body>
    ${CASOS.map((c, i) => `<div id="${c.id}"><div class="${c.cls}" data-i="${i}">texto de prueba</div></div>`).join("")}
    <div id="vgl-root">${BANDERAS.map((f, i) => `<span class="vgl-flag ${f.cls}" data-f="${i}">${f.que}</span>`).join("")}</div>
    ${WIDGET_CASOS.map((w) => w.html).join("")}
  </body></html>`);

  const val = (sel, prop) => p.$eval(sel, (el, pr) => getComputedStyle(el).getPropertyValue(pr), prop);
  // El token se resuelve DESDE EL PROPIO ELEMENTO: las variables viven en #vgl-root y en
  // cada id de emergente, no en :root. Pedirlas a documentElement devolvía vacío y el
  // "esperado" salía siendo el color de Everest — o sea, la prueba se daba la razón sola.
  const esperadoDe = (sel, token) => p.$eval(sel, (el, tk) => {
    const v = getComputedStyle(el).getPropertyValue(tk).trim();
    if (!v) return "(token vacío: " + tk + ")";
    // OJO: el color de la sonda va con priority "important". El !important de la hoja de
    // Everest GANA al estilo en línea normal, así que sin esto la sonda medía el color de
    // Everest y la prueba se daba la razón a sí misma (todo "FALLA" con el mismo valor).
    const d = document.createElement("div");
    d.style.setProperty("color", v, "important");
    el.appendChild(d); const r = getComputedStyle(d).color; d.remove(); return r;
  }, token);

  let fallos = 0;
  console.log("--- COLOR bajo un CSS de Everest agresivo (div,span,p{color:#111827 !important}) ---");
  for (let i = 0; i < CASOS.length; i++) {
    const c = CASOS[i];
    const real = await val(`[data-i="${i}"]`, "color");
    const esperado = await esperadoDe(`[data-i="${i}"]`, c.token);
    const ok = real === esperado;
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${c.que.padEnd(34)} real=${real}  esperado=${esperado}`);
  }
  console.log("--- FONDO de las banderas ---");
  for (let i = 0; i < BANDERAS.length; i++) {
    const f = BANDERAS[i];
    const real = await val(`[data-f="${i}"]`, "background-color");
    const esperado = await esperadoDe(`[data-f="${i}"]`, f.debeSer);
    const ok = real === esperado;
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${f.que.padEnd(34)} real=${real}  esperado=${esperado} (${f.debeSer})`);
  }
  console.log("--- Widget de Conducta (#vgl-cw-examenes, selectores compuestos) ---");
  for (const w of WIDGET_CASOS) {
    const real = await val(w.sel, "color");
    const esperado = await esperadoDe(w.sel, w.token);
    const ok = real === esperado;
    if (!ok) fallos++;
    console.log(`${ok ? "OK  " : "FALLA"}  ${w.que.padEnd(34)} real=${real}  esperado=${esperado}`);
  }
  console.log(fallos === 0 ? "\nTODO SOBREVIVE" : `\n${fallos} FALLAN`);
  await b.close();
  process.exit(fallos === 0 ? 0 : 1);
})();
