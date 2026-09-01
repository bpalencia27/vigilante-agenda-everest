// =====================================================================
//  BARRIDO DE COLOR DE TODO EL SCRIPT — Chromium real, CSS real
//
//  Encargo del médico (01-sep): «LOCALÍZALO EN TODO EL SCRIPT Y ELIMÍNALO, SOLAMENTE MI
//  SCRIPT DEBE TENER MI PROPIO CSS NADA DE EVEREST».
//
//  Los tools/verificar_*.js anteriores comprueban una LISTA escrita a mano: solo ven lo que
//  alguien se acordó de apuntar. Este no lleva lista: el censo de candidatos se DERIVA de
//  la hoja real y del HTML real.
//
//  Dos censos, porque son dos fallos distintos (ver CLAUDE.md):
//    1. una clase nuestra con `color` SIN `!important` (pierde el empate contra Everest);
//    2. una clase nuestra que NO declara color en absoluto y depende de HEREDAR — y un
//       valor heredado pierde SIEMPRE contra cualquier regla que apunte al elemento, tenga
//       la especificidad que tenga. Es el caso de `.vgl-prod-cap` («atendidas de su
//       agenda», azul) y de `.vgl-pym-sec-ic` (el 🫀 de «Abandono Programa RCV», azul),
//       los dos reportados en vivo el 1-sep con captura.
//
//  Cada candidato se monta en SU contenedor real y se mide en Chromium contra un Everest
//  hostil. Lo que salga con el color del adversario está secuestrado.
// =====================================================================
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RUTA = path.join(__dirname, "..", "vigilante_agenda.user.js");
const code = fs.readFileSync(RUTA, "utf8");

// ---- CSS real: se EJECUTA el script y se lee el <style> que de verdad genera -----------
// La extracción textual que usan los tools/verificar_* anteriores no puede resolver
// `MTR_RCV_CSS_TODOS_LOS_MODALES`, que no es una plantilla suelta sino el resultado de un
// `.replace()` sobre otra hoja. Con el método textual quedaban 14.500 caracteres de CSS
// REAL fuera de la medición —y un barrido que no mide todo no puede afirmar que no queda
// nada—. Ejecutando el script en el arnés, el <style> sale ya resuelto, entero y exacto:
// es el mismo que recibe Chromium en el consultorio.
const { cargar } = require(path.join(__dirname, "..", "tests", "harness.js"));
function cssReal() {
  const c = cargar({ silencioso: true });
  // buildOverlay() llega a crear e insertar el <style> y más tarde falla al cablear
  // eventos contra el DOM simulado; lo segundo no nos importa, lo primero es lo que se
  // viene a buscar.
  try { c.api.buildOverlay(); } catch (e) {}
  const trozos = [];
  const rec = (n) => { if (!n) return; if (n.tagName === "STYLE" && n.textContent) trozos.push(n.textContent); (n.children || []).forEach(rec); };
  rec(c.env.doc.head); rec(c.env.doc.body);
  return trozos.join("\n");
}
const css = cssReal();
if (!css || css.length < 100000) { console.log("AVISO: el <style> real salió demasiado corto (" + css.length + "): la medición no sería fiable."); process.exit(1); }
if (/\$\{/.test(css)) console.log("AVISO: quedan marcadores sin resolver en el CSS.\n");

const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");

// ---- Censo 1: declaraciones de color sin !important ----------------------------------
const sinBang = [];
for (const r of sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  for (const d of r[2].split(";")) {
    const m = /^\s*color\s*:(.+)$/i.exec(d);
    if (m && !/!important/i.test(m[1])) sinBang.push(r[1].replace(/\s+/g, " ").trim());
  }
}

// ---- Censo 2: clases con texto propio y sin ninguna declaración de color --------------
const conColor = new Set();
for (const r of sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  if (!/(^|;)\s*color\s*:/i.test(r[2])) continue;
  for (const c of r[1].matchAll(/\.([a-zA-Z0-9_-]+)/g)) conColor.add(c[1]);
}

// Contenedor real de cada candidato: se busca hacia atrás el id de modal más cercano al
// sitio donde la clase se emite. Sin esto, medir una clase de un modal dentro de #vgl-root
// daría un veredicto que no corresponde a lo que ve el médico.
const MODALES = ["vgl-pym-modal", "vgl-pes-modal", "vgl-labs-modal", "vgl-labsv-modal",
  "vgl-postcita-panel", "vgl-agendar-modal", "vgl-ordenar-modal", "vgl-paquete-modal",
  "vgl-panel-modal", "vgl-ia-modal", "vgl-ficha-modal", "vgl-tablero-modal", "vgl-chooser-modal"];
function contenedorDe(pos) {
  let mejor = null, mejorPos = -1;
  for (const id of MODALES) {
    for (const marca of ['id = "' + id + '"', 'id="' + id + '"', "#" + id]) {
      const i = code.lastIndexOf(marca, pos);
      if (i > mejorPos) { mejorPos = i; mejor = id; }
    }
  }
  // Si el modal más cercano queda muy lejos, el elemento vive en el panel.
  return (mejorPos > 0 && pos - mejorPos < 6000) ? mejor : "vgl-root";
}

const candidatos = new Map();
const re = /<(span|div|b|i|small|label|p|strong|em)\s+class="([^"$]*?)"\s*>([^<>{}]*[^\s<>{}][^<>]*?)</g;
for (const m of code.matchAll(re)) {
  // Las clases se emiten a veces con una costura de concatenación pegada
  // (class="vgl-prod-fila' + clase(x) + '"): sin limpiarla, el censo inventaba una clase
  // «vgl-prod-fila'» que no existe y el barrido no podía dar cero nunca.
  const clases = m[2].split(/\s+/).map((c) => c.replace(/['"`+].*$/, "")).filter((c) => /^vgl-[a-zA-Z0-9_-]+$/.test(c));
  if (!clases.length) continue;
  const txt = m[3].trim();
  // Se aceptan tanto el texto literal como los huecos de plantilla (`${x}`) y los de
  // concatenación (`' + x + '`): los tres significan «aquí va contenido». La primera
  // versión de este censo descartaba la forma de concatenación por considerarla una
  // costura, y con eso se le escapó `.vgl-pym-ic` — el círculo del emoji del recuadro
  // clínico, que el médico ve azul en su captura del 1-sep. Un contenedor de más en la
  // lista no cuesta nada; uno de menos es justo el defecto que se buscaba.
  if (!txt) continue;
  if (clases.some((c) => conColor.has(c))) continue;
  const clave = clases.join(" ");
  if (candidatos.has(clave)) continue;
  candidatos.set(clave, {
    tag: m[1],
    clases: clases,
    contenedor: contenedorDe(m.index),
    ejemplo: txt.replace(/\s+/g, " ").slice(0, 34),
  });
}

const HOSTIL = "rgb(17, 24, 39)";
const EVEREST = `div,span,p,b,small,label,i,li,td,th,strong,em{color:#111827 !important}`;

(async () => {
  console.log("CSS real extraído: " + css.length + " caracteres\n");
  console.log("CENSO 1 — declaraciones de color SIN !important: " + sinBang.length);
  for (const s of sinBang) console.log("   · " + s);
  console.log("");
  console.log("CENSO 2 — clases con texto propio y SIN color declarado: " + candidatos.size + "\n");

  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const pag = await nav.newPage();

  const lista = [...candidatos.entries()];
  const cuerpo = lista.map(([clave, c], i) => {
    const dentro = `<${c.tag} class="${clave}" data-i="${i}">texto de prueba</${c.tag}>`;
    return c.contenedor === "vgl-root"
      ? `<div id="vgl-root"><div id="vgl-sheet">${dentro}</div></div>`
      : `<div id="${c.contenedor}">${dentro}</div>`;
  }).join("");
  await pag.setContent(`<style>${EVEREST}</style><style>${css}</style><body>${cuerpo}</body>`);

  // Además del veredicto, el color que el elemento computa SIN el Everest hostil: ese es
  // el que hay que fijar con !important, para que el arreglo no cambie ni un píxel de lo
  // que el médico ya ve — solo lo blinde. Y el token al que corresponde, para escribir la
  // regla con la variable del tema y no con un rgb suelto.
  const limpia = await nav.newPage();
  await limpia.setContent(`<style>${css}</style><body>${cuerpo}</body>`);
  const TOKENS = ["--fg", "--fg2", "--fg3", "--c-verde", "--c-ambar", "--c-rojo", "--c-azul",
    "--c-morado", "--c-pes", "--c-recordatorio", "--sec-accent"];
  const claros = await limpia.evaluate((tokens) => {
    const raiz = getComputedStyle(document.documentElement);
    const aRgb = (v) => { const d = document.createElement("div"); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    const mapa = {};
    for (const t of tokens) { const v = raiz.getPropertyValue(t).trim(); if (v) mapa[aRgb(v)] = t; }
    const out = [];
    document.querySelectorAll("[data-i]").forEach((el) => {
      const c = getComputedStyle(el).color;
      out.push({ i: Number(el.dataset.i), limpio: c, token: mapa[c] || "(ningún token)" });
    });
    return out;
  }, TOKENS);
  const porI = new Map(claros.map((x) => [x.i, x]));

  const medidos = await pag.evaluate(() => {
    const out = [];
    document.querySelectorAll("[data-i]").forEach((el) => {
      out.push({ i: Number(el.dataset.i), color: getComputedStyle(el).color });
    });
    return out;
  });

  const malos = [];
  for (const m of medidos) {
    const [clave, c] = lista[m.i];
    const ok = m.color !== HOSTIL;
    const lim = porI.get(m.i) || { limpio: "?", token: "?" };
    console.log(`  ${ok ? "ok         " : "SECUESTRADO"}  ${("#" + c.contenedor).padEnd(20)} .${clave.padEnd(28)} limpio=${lim.limpio.padEnd(22)} token=${lim.token}`);
    if (!ok) malos.push({ clave, c, token: lim.token, limpio: lim.limpio });
  }

  console.log("");
  if (sinBang.length === 0 && malos.length === 0) {
    console.log("RESULTADO: ninguna regla de color del script pierde contra el CSS de Everest.");
  } else {
    console.log("RESULTADO: " + malos.length + " clase(s) pierden su color contra el CSS de Everest:");
    for (const m of malos) console.log("   · ." + m.clave + "  (dentro de #" + m.c.contenedor + ")  ej: \"" + m.c.ejemplo + "\"");
    process.exitCode = 1;
  }
  await nav.close();
})();
