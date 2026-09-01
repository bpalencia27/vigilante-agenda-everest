// Verificación EMPÍRICA que exige CLAUDE.md: el CSS real del script, montado contra un
// "Everest" agresivo, en Chromium de verdad. No una copia recortada a mano.
const fs = require("fs");
const { chromium } = require("playwright");

// 01-sep-2026 (cierre del enjambre) — el CSS ya no se extrae por texto (se perdía MTR_RCV_CSS_TODOS_LOS_MODALES, que
// es un .replace() sobre otra hoja): se EJECUTA el script en el arnés y se lee el <style>
// real, entero y ya resuelto — el mismo que recibe Chromium en el consultorio. Es el método
// que prescribe CLAUDE.md y el que ya usa tools/auditar_color_todo_chromium.js.
const { cargar } = require("/home/user/vigilante-agenda-everest/tests/harness.js");
function cssReal() {
  const c = cargar({ silencioso: true });
  try { c.api.buildOverlay(); } catch (e) {}
  const trozos = [];
  const rec = (n) => { if (!n) return; if (n.tagName === "STYLE" && n.textContent) trozos.push(n.textContent); (n.children || []).forEach(rec); };
  rec(c.env.doc.head); rec(c.env.doc.body);
  return trozos.join("\n");
}
const css = cssReal();
if (!css || css.length < 100000) { console.log("AVISO: el <style> real salió demasiado corto (" + css.length + ")"); process.exit(1); }

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
  // v17.24.0 — «Medicamentos actuales» (.vgl-panel-meds-nom/-frec) se RETIRÓ en v17.28.0
  // («limpieza de Panel»): las dos entradas que había aquí sondeaban clases que ya no existen
  // en el script y salían en el color del adversario por no tener regla — un rojo falso, no
  // un secuestro. Retiradas (01-sep-2026, cierre del enjambre). La cobertura de lo que SÍ
  // existe hoy la da tools/auditar_color_todo_chromium.js, que deriva el censo del HTML real.
];
const BANDERAS = [
  // 01-sep-2026 — las banderas son OUTLINE desde el refactor S+ visual (commit 7758df4): texto
  // de acento + fondo tintado al 10 % + anillo. Lo que ataca el adversario es el COLOR del
  // texto, así que eso es lo que se mide contra el token; el fondo se comprueba contra el
  // tinte real, no contra un fondo sólido que ya no existe.
  { cls: "agpend", que: "🗓️ SIN TERMINAR",        color: "--c-ambar", rgb: "--rgb-ambar" },
  { cls: "adic",   que: "➕ CANDIDATO ADICIONAL",  color: "--c-azul",  rgb: "--rgb-azul" },
  { cls: "pes",    que: "❤ ABANDONO PROGRAMA RCV", color: "--c-pes",   rgb: "--rgb-pes" },
  { cls: "",       que: "⛔ NO CONFIRMADO",         color: "--c-rojo",  rgb: "--rgb-rojo" },
];

// 01-sep-2026 — el badge de #vgl-cw-examenes NO tiene color por estado desde v17.41.0: por pedido
// del médico se ve EXACTAMENTE como el botón nativo «Paquetes» (color literal rgba(0,0,0,.87)
// !important, ver el comentario de la regla compartida con button#vgl-cw-ordenar-btn). Lo que
// se verifica es que ese literal sobreviva al adversario, no un token que ya no aplica.
// v17.18.0 — el widget de Conducta (#vgl-cw-examenes) usa selectores compuestos
// (estado del contenedor + clase descendiente: ".vgl-cw-pend .vgl-cw-badge",
// ".vgl-cw-venc .vgl-cw-nom") que el arreglo CASOS de arriba (una sola clase por
// caso) no puede representar. Cada caso trae su propio HTML y su propio selector.
const WIDGET_CASOS = [
  { html: '<div id="vgl-cw-examenes" class="vgl-cw-pend"><div class="vgl-cw-badge" data-w="0">🧪 2</div></div>', sel: '[data-w="0"]', token: "rgba(0,0,0,.87)", que: "badge: estado pendiente" },
  { html: '<div id="vgl-cw-examenes" class="vgl-cw-ok"><div class="vgl-cw-badge" data-w="1">🧪</div></div>', sel: '[data-w="1"]', token: "rgba(0,0,0,.87)", que: "badge: estado al día" },
  { html: '<div id="vgl-cw-examenes" class="vgl-cw-nd"><div class="vgl-cw-badge" data-w="2">🧪</div></div>', sel: '[data-w="2"]', token: "rgba(0,0,0,.87)", que: "badge: sin juicio todavía" },
  { html: '<div id="vgl-cw-examenes"><div class="vgl-cw-panel"><div class="vgl-cw-fila vgl-cw-venc"><span class="vgl-cw-nom" data-w="3">CREATININA</span></div></div></div>', sel: '[data-w="3"]', token: "--c-rojo", que: "nombre de examen vencido" },
  { html: '<div id="vgl-cw-examenes"><div class="vgl-cw-panel"><div class="vgl-cw-fila vgl-cw-pedir"><span class="vgl-cw-nom" data-w="4">HEMOGLOBINA</span></div></div></div>', sel: '[data-w="4"]', token: "--c-ambar", que: "nombre de examen pendiente" },
  { html: '<div id="vgl-cw-examenes"><div class="vgl-cw-panel"><span class="vgl-cw-que" data-w="5">vence en 12 días</span></div></div>', sel: '[data-w="5"]', token: "--fg2", que: "texto secundario de cada fila" },
  // v17.23.0 — MTR_CSS solo estaba sembrado para #vgl-labs-modal; los mismos avisos
  // (.vgl-mtr-*) también se pintan dentro de #vgl-panel-modal (mtrPanelMedicamentosHtml).
  // Selectores compuestos (severidad + descendiente), por eso van aquí y no en CASOS.
  { html: '<div id="vgl-panel-modal"><div class="vgl-mtr-crit"><span class="vgl-mtr-conducta" data-w="6">Ajustar dosis</span></div></div>', sel: '[data-w="6"]', token: "--c-rojo", que: "Panel: conducta de aviso CRITICAL" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-mtr-alto"><span class="vgl-mtr-conducta" data-w="7">Vigilar función renal</span></div></div>', sel: '[data-w="7"]', token: "--c-ambar", que: "Panel: conducta de aviso HIGH" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-mtr-bloque"><span class="vgl-mtr-tit" data-w="8">Seguridad farmacológica</span></div></div>', sel: '[data-w="8"]', token: "--fg", que: "Panel: título del bloque de avisos" },
  // v17.24.0 — dashboard "Estado de un vistazo" (Panel del paciente → Resumen). Los 3
  // estados honestos del badge son selectores compuestos (.vgl-bento-badge.ok/.pend/.nd).
  { html: '<div id="vgl-panel-modal"><div class="vgl-bento-badge ok" data-w="9">Al día</div></div>', sel: '[data-w="9"]', token: "--c-verde", que: "bento: badge estado ok" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-bento-badge pend" data-w="10">Revisar</div></div>', sel: '[data-w="10"]', token: "--c-ambar", que: "bento: badge estado pend" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-bento-badge nd" data-w="11">Sin dato</div></div>', sel: '[data-w="11"]', token: "--fg3", que: "bento: badge estado nd" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-bento-head" data-w="12">❤️ Riesgo cardiovascular</div></div>', sel: '[data-w="12"]', token: "--c-azul", que: "bento: título de la tarjeta" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-bento-row"><span class="vgl-bento-sub" data-w="13">estable o mejorando</span></div></div>', sel: '[data-w="13"]', token: "--fg3", que: "bento: texto secundario" },
  { html: '<div id="vgl-panel-modal"><div class="vgl-bento-pie" data-w="14">Toque para ver el detalle →</div></div>', sel: '[data-w="14"]', token: "--fg3", que: "bento: pie de la tarjeta" },
  // v17.24.0 — hallazgo real en MTR_RCV_CSS (Regla A): .vgl-rcv-aviso-alto y
  // .vgl-rcv-lista-orden son modificadores que siempre conviven con su clase base en el
  // mismo elemento — se combinaron en selectores compuestos para que la especificidad
  // decida, no el orden de la hoja.
  { html: '<div id="vgl-ordenar-modal"><div class="vgl-rcv-aviso vgl-rcv-aviso-alto" data-w="15">⚠ Falla terapéutica</div></div>', sel: '[data-w="15"]', token: "--c-ambar", que: "RCV: aviso-alto (modificador compuesto) gana sobre aviso base" },
  { html: '<div id="vgl-labs-modal"><ul class="vgl-rcv-lista vgl-rcv-lista-orden"><li data-w="16">Creatinina</li></ul></div>', sel: '[data-w="16"]', token: "--fg", que: "RCV: lista-orden (modificador compuesto) gana sobre lista base" },
  // v17.24.0 — widget de farmacia en Conducta (Fase 2): badge de 3 estados, y su
  // contenido reusa .vgl-mtr-*/.vgl-dup-*, cuyos selectores se extendieron para
  // cubrir también #vgl-cw-farmaco (verificado arriba con id vgl-panel-modal;
  // aquí se repite con vgl-cw-farmaco para confirmar el tercer destino real).
  { html: '<div id="vgl-cw-farmaco" class="vgl-cw-pend"><div class="vgl-cw-badge" data-w="17">💊 2</div></div>', sel: '[data-w="17"]', token: "--c-ambar", que: "farmaco: badge estado pendiente" },
  { html: '<div id="vgl-cw-farmaco" class="vgl-cw-ok"><div class="vgl-cw-badge" data-w="18">💊</div></div>', sel: '[data-w="18"]', token: "--c-verde", que: "farmaco: badge estado al día" },
  { html: '<div id="vgl-cw-farmaco" class="vgl-cw-nd"><div class="vgl-cw-badge" data-w="19">💊</div></div>', sel: '[data-w="19"]', token: "--fg3", que: "farmaco: badge sin juicio todavía" },
  { html: '<div id="vgl-cw-farmaco"><div class="vgl-mtr-crit"><span class="vgl-mtr-conducta" data-w="20">Ajustar dosis</span></div></div>', sel: '[data-w="20"]', token: "--c-rojo", que: "farmaco: conducta de aviso CRITICAL dentro del widget" },
  { html: '<div id="vgl-cw-farmaco"><div class="vgl-dup-bloque"><div class="vgl-dup-tope" data-w="21">Posible duplicidad</div></div></div>', sel: '[data-w="21"]', token: "--c-ambar", que: "farmaco: tope de duplicidad terapéutica" },
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
    // Un token (--c-x) se resuelve DESDE EL PROPIO ELEMENTO; un literal (rgba(...)/#hex) se
    // usa tal cual. En los dos casos se pasa por una sonda con priority "important", porque
    // el !important de Everest le gana al estilo en línea normal.
    const v = tk.startsWith("--") ? getComputedStyle(el).getPropertyValue(tk).trim() : tk;
    if (!v) return "(token vacío: " + tk + ")";
    const d = document.createElement("div");
    d.style.setProperty("color", v, "important");
    el.appendChild(d); const r = getComputedStyle(d).color; d.remove(); return r;
  }, token);
  const esperadoFondo = (sel, rgbToken) => p.$eval(sel, (el, tk) => {
    const d = document.createElement("div");
    d.style.setProperty("background-color", "rgba(var(" + tk + "),.10)", "important");
    el.appendChild(d); const r = getComputedStyle(d).backgroundColor; d.remove(); return r;
  }, rgbToken);

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
  console.log("--- Banderas: COLOR del texto bajo el Everest agresivo, y FONDO tintado ---");
  for (let i = 0; i < BANDERAS.length; i++) {
    const f = BANDERAS[i];
    const realC = await val(`[data-f="${i}"]`, "color");
    const espC = await esperadoDe(`[data-f="${i}"]`, f.color);
    const okC = realC === espC; if (!okC) fallos++;
    console.log(`${okC ? "OK  " : "FALLA"}  ${(f.que + " · color").padEnd(34)} real=${realC}  esperado=${espC} (${f.color})`);
    const realF = await val(`[data-f="${i}"]`, "background-color");
    const espF = await esperadoFondo(`[data-f="${i}"]`, f.rgb);
    const okF = realF === espF; if (!okF) fallos++;
    console.log(`${okF ? "OK  " : "FALLA"}  ${(f.que + " · fondo").padEnd(34)} real=${realF}  esperado=${espF} (rgba(var(${f.rgb}),.10))`);
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
