// =====================================================================
//  EJECUTOR DE PRUEBAS DEL VIGILANTE
//  Sin dependencias externas: se ejecuta con  node tests/runner.js
//  Cada archivo tests/suite_*.js exporta { nombre, cubre: [...], pruebas(t, api, env) }
// =====================================================================
const fs = require("fs");
const path = require("path");
const { cargar } = require("./harness.js");

const COL = { ok: "\x1b[32m", mal: "\x1b[31m", dim: "\x1b[90m", tit: "\x1b[36m", fin: "\x1b[0m", ama: "\x1b[33m" };

function crearT() {
  const res = { pasa: 0, falla: 0, fallos: [], actual: "", pendientes: [] };
  const t = {
    caso(desc, fn) {
      res.actual = desc;
      try { fn(); res.pasa++; }
      catch (e) { res.falla++; res.fallos.push({ desc, msg: e.message }); }
    },
    casoAsync(desc, fn) {
      res.actual = desc;
      const p = (async () => {
        try { await fn(); res.pasa++; }
        catch (e) { res.falla++; res.fallos.push({ desc, msg: e.message }); }
      })();
      res.pendientes.push(p);
      return p;
    },
    igual(a, b, nota) {
      if (a === b) return;
      const A = JSON.stringify(a), B = JSON.stringify(b);
      if (A !== B) throw new Error((nota ? nota + ": " : "") + "esperaba " + B + " y obtuvo " + A);
    },
    cierto(v, nota) { if (!v) throw new Error((nota || "se esperaba verdadero") + " (obtuvo " + JSON.stringify(v) + ")"); },
    falso(v, nota) { if (v) throw new Error((nota || "se esperaba falso") + " (obtuvo " + JSON.stringify(v) + ")"); },
    // v14.1.7 — `lanza` y `noLanza` ENTIENDEN PROMESAS. Hasta aquí solo atrapaban lo que
    // se lanzara de forma SÍNCRONA, así que al pasarles una función `async` no podían
    // fallar jamás: una función async no lanza, devuelve una promesa rechazada, y el
    // `catch` no llegaba a saltar nunca.
    //
    // En la base no había ni un solo uso async de los 49 que hay, así que el agujero
    // estaba latente — pero ya atrapó a un PR real, que añadió
    // `await t.noLanza(async () => await c.api.pageFetchJson("url"))`. Se comprobó
    // haciendo que `pageFetchJson` lanzara siempre: cayeron 11 pruebas antiguas y ESA se
    // quedó verde mientras la función fallaba en cada llamada.
    //
    // El arreglo tiene su propia trampa, y por eso NO se convierten en `async` a secas:
    // eso haría que los 49 llamadores síncronos —que no esperan nada— recibieran una
    // promesa suelta, y un fallo pasaría de excepción a rechazo no capturado. Silencioso
    // otra vez, y en 49 sitios en vez de en uno.
    //
    // Así que se bifurca por lo que la función DEVUELVE: si no es un thenable, se
    // comporta exactamente como antes y lanza en el acto; si lo es, se devuelve una
    // promesa que el llamador tiene que esperar. Y para que nadie se olvide de ese
    // `await`, hay un centinela en la suite 26 que lee el código de las suites y falla si
    // encuentra una llamada async sin esperar — el mismo patrón que ya cazó los
    // `t.casoAsync` sin await.
    lanza(fn, nota) {
      const fallo = () => new Error(nota || "se esperaba una excepción");
      let r;
      try { r = fn(); } catch (e) { return; }                    // lanzó síncrono: correcto
      if (!r || typeof r.then !== "function") throw fallo();     // no lanzó y no hay promesa
      return r.then(() => { throw fallo(); }, () => {});         // rechazó: correcto
    },
    noLanza(fn, nota) {
      const fallo = (e) => new Error((nota || "no debía lanzar") + ": " + (e && e.message ? e.message : e));
      let r;
      try { r = fn(); } catch (e) { throw fallo(e); }
      if (!r || typeof r.then !== "function") return;
      return r.then(() => {}, (e) => { throw fallo(e); });
    },
  };
  return { t, res };
}

// v14.2.0 — COBERTURA POR ACCESO EN EJECUCIÓN, no por texto.
//
// `nuncaNombradas` (más abajo) es un grep: si el nombre aparece como palabra en el
// archivo de la suite, la da por cubierta. Es deliberadamente laxo (un nombre puede
// probarse de verdad sin escribirse literal, p.ej. disparado por un `.onclick()`), pero
// esa misma laxitud es la puerta por la que se coló el patrón de los 28 nombres huecos
// de la suite 42: un `cubre` puede mencionar un nombre en un comentario o en otra prueba
// vecina y colar como "nombrado" sin que NINGUNA prueba lo haya tocado jamás.
//
// Primer intento (revertido): envolver cada función en un wrapper que anotara su
// nombre al ser LLAMADA. Se descartó porque NO es transparente de verdad pese al
// cuidado puesto en conservar `.length`/`.name`/`this`/argumentos — rompió dos pruebas
// reales por razones distintas: (1) `c.api.apiAccesoObtenerTurnos.constructor.name ===
// "AsyncFunction"` (Suite 34) — un wrapper `function(...args)` nunca es "AsyncFunction"
// aunque reenvíe una promesa; (2) el test de `boot` (Núcleo) compara por IDENTIDAD la
// función que `setInterval` registró de verdad (la de la clausura interna) contra
// `api.checkVersionMinimum` — y el wrapper es, a propósito, un objeto DISTINTO. No hay
// forma de envolver-y-seguir-siendo-la-misma-función; son objetivos contradictorios.
//
// Así que esto usa un `Proxy` con SOLO un `get`, que devuelve la propiedad SIN TOCARLA
// (mismo objeto función, mismo `.constructor`, misma identidad) y únicamente anota que
// se LEYÓ. Es más débil que "llamada de verdad" — leer no es invocar — pero es
// estrictamente más fuerte que el grep textual: detecta cuando el nombre aparece en el
// texto de la suite (p.ej. dentro de un comentario o de otra prueba vecina) SIN que
// ninguna prueba haya tocado `api.ese_nombre` ni una vez en tiempo de ejecución. Y, al
// no modificar ningún valor, es imposible que altere el comportamiento de una prueba:
// no hay wrapper que romper.
//
// NO se sustituye el `api` que carga el runner (`cargado.api` de la línea de abajo):
// solo se envuelve la COPIA que cada suite recibe como parámetro, así que un fallo en
// el Proxy no puede alterar el `todosSet`/`cubiertas` que sí gobiernan el porcentaje
// publicado ni el código de salida.
//
// Sigue siendo, a propósito, informativo y no compuerta (igual que "nunca nombradas"):
// puede dar FALSOS positivos legítimos — cobertura de verdad por integración, disparada
// por un evento del DOM en vez de por `api.nombre` directo — así que cada hallazgo se
// lee a mano contra la suite antes de tocar nada, nunca se actúa a ciegas sobre la lista.
function envolverApiParaCobertura(api, invocadas) {
  return new Proxy(api, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop.indexOf("__") !== 0 && typeof target[prop] === "function") {
        invocadas.add(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

// v14.1.9 — EL EJECUTOR NO PUEDE SALIR VERDE SIN HABER TERMINADO.
//
// Hermano del arreglo de 2026-08-11 (el `exit(0)` incondicional que hacía CONSULTIVO todo
// el banco) y del mismo tipo: allí el código de salida mentía al final; aquí ni siquiera
// se llegaba al final.
//
// Si una suite deja una promesa que NO resuelve —un `await` a algo que nunca se cumple—,
// `main()` se queda esperando, el bucle de eventos de Node se vacía y el proceso **sale
// solo, con código 0**. No se imprime el resumen, las suites siguientes no llegan a
// correr, y el CI lo lee como verde. Se detectó en real: una prueba nueva colgaba el banco
// desde la suite 31 y las siguientes no se ejecutaron nunca, con el CI en verde.
//
// El arreglo no depende de acordarse de nada: se declara ROJO de entrada, y solo el final
// legítimo lo pone en verde. Cualquier camino que no llegue al final —cuelgue, salida
// temprana, excepción sin capturar— sale distinto de cero.
process.exitCode = 1;
let _terminoDeVerdad = false;
process.on("beforeExit", () => {
  if (_terminoDeVerdad) return;
  console.error("");
  console.error(COL.mal + "  EL EJECUTOR NO LLEGÓ AL FINAL — el banco NO está verde." + COL.fin);
  console.error(COL.dim + "  Alguna suite dejó una promesa sin resolver: Node se quedó sin trabajo y salió" + COL.fin);
  console.error(COL.dim + "  antes de contar nada. Las suites posteriores NO se ejecutaron." + COL.fin);
  console.error(COL.dim + "  Mira cuál fue la última suite que imprimió su línea: el cuelgue está en la siguiente." + COL.fin);
  console.error("");
});

async function main() {
  const soloEste = process.argv[2];
  const archivos = fs.readdirSync(__dirname).filter(f => /^suite_.*\.js$/.test(f)).sort()
    .filter(f => !soloEste || f.includes(soloEste));

  if (!archivos.length) { console.log("No hay suites que ejecutar."); process.exit(1); }

  const cargado = cargar({ silencioso: true });
  const api = cargado.api, env = cargado.env;

  console.log("");
  console.log(COL.tit + "═".repeat(64) + COL.fin);
  console.log(COL.tit + "  PRUEBAS DEL VIGILANTE DE AGENDA" + COL.fin);
  console.log(COL.tit + "═".repeat(64) + COL.fin);
  console.log("  funciones alcanzables: " + cargado.expuestas + " de " + cargado.totalDeclaradas);
  console.log("");

  let tp = 0, tf = 0;
  const cubiertas = new Set();
  const fallosGlobales = [];
  const huecosPorEjecucion = [];   // {suite, fn} — declarado en `cubre`, jamás invocado vía api.·(...)

  // El array `cubre` de cada suite se VALIDA contra la API real antes de sumarlo:
  // sin esto, un nombre inventado o mal escrito inflaba el porcentaje en silencio.
  const todas = Object.keys(api).filter(k => !k.startsWith("__"));
  const todosSet = new Set(todas);
  for (const arch of archivos) {
    const suite = require(path.join(__dirname, arch));
    if (suite.cubre) {
      for (const fn of suite.cubre) {
        if (!todosSet.has(fn)) {
          console.error(COL.mal + "Error: la suite '" + (suite.nombre || arch) + "' dice cubrir '" + fn + "', pero esa función no existe en el API." + COL.fin);
          process.exit(1);
        }
      }
    }
    const { t, res } = crearT();
    // Cobertura por ejecución (ver comentario junto a `envolverApiParaCobertura`): se le
    // pasa a la suite una copia envuelta del api Y una copia envuelta de `cargar`, para
    // que también quede anotada la invocación cuando la suite carga su propia instancia
    // (patrón de mocking de red que usan, entre otras, suite_29 y suite_39).
    const invocadas = new Set();
    const apiEnvuelta = envolverApiParaCobertura(api, invocadas);
    const cargarEnvuelto = (...args) => {
      const r = cargar(...args);
      return Object.assign({}, r, { api: envolverApiParaCobertura(r.api, invocadas) });
    };
    try { await suite.pruebas(t, apiEnvuelta, env, cargarEnvuelto); }
    catch (e) { res.falla++; res.fallos.push({ desc: "(la suite lanzó)", msg: e.message }); }
    await Promise.all(res.pendientes);
    (suite.cubre || []).forEach(n => cubiertas.add(n));
    (suite.cubre || []).forEach(n => { if (!invocadas.has(n)) huecosPorEjecucion.push({ suite: suite.nombre || arch, fn: n }); });
    tp += res.pasa; tf += res.falla;
    const marca = res.falla ? COL.mal + "✗" : COL.ok + "✓";
    console.log(marca + COL.fin + " " + (suite.nombre || arch).padEnd(42) + COL.dim + res.pasa + " ok" + (res.falla ? COL.mal + "  " + res.falla + " FALLAN" : "") + COL.fin);
    res.fallos.forEach(f => { console.log("    " + COL.mal + "· " + f.desc + COL.fin); console.log("      " + COL.dim + f.msg + COL.fin); fallosGlobales.push(f); });
  }

  // cobertura real de funciones
  const sinCubrir = todas.filter(n => !cubiertas.has(n));
  // v15.6.2 — El porcentaje se mide contra la SUPERFICIE PÚBLICA (las funciones
  // alcanzables vía api), no contra el conteo crudo de declaraciones: ese conteo
  // incluye funciones ANIDADAS dentro de otras (inalcanzables una a una desde afuera),
  // que se prueban a través de sus dueñas. Con el denominador viejo, el 100% era
  // matemáticamente imposible aunque cada función pública tuviera prueba — el número
  // mentía hacia abajo. Ambos conteos se siguen imprimiendo.
  const pct = (cubiertas.size / todas.length * 100);

  console.log("");
  console.log(COL.tit + "─".repeat(64) + COL.fin);
  console.log("  comprobaciones : " + COL.ok + tp + " pasan" + COL.fin + (tf ? "  " + COL.mal + tf + " fallan" + COL.fin : ""));
  console.log("  funciones cubiertas: " + cubiertas.size + " / " + todas.length + " públicas  (" + pct.toFixed(1) + "%)  ·  " + (cargado.totalDeclaradas - todas.length) + " anidadas se prueban a través de sus dueñas");
  if (sinCubrir.length) {
    console.log("");
    console.log(COL.ama + "  sin cubrir (" + sinCubrir.length + "):" + COL.fin);
    for (let i = 0; i < sinCubrir.length; i += 6) console.log("    " + COL.dim + sinCubrir.slice(i, i + 6).join(", ") + COL.fin);
  }

  // ------------------------------------------------------------------
  // Cobertura EFECTIVA (puramente informativo: no toca el % de cobertura
  // declarada, el total de comprobaciones ni el código de salida).
  // El array `cubre` de una suite es un AUTOINFORME: el bucle de arriba
  // solo valida que el NOMBRE exista en el API real, no que alguna
  // prueba lo EJERCITE de verdad. Aquí se hace una comprobación textual
  // best-effort: para cada nombre ya validado en `cubiertas`, se busca
  // como palabra completa (\bNOMBRE\b) en el texto de las suites, tras
  // quitarle a cada suite su propio bloque `cubre: [...]` (si no, el
  // nombre "se encontraría a sí mismo" en su propia declaración y la
  // comprobación no diría nada).
  // OJO: esto NO es "sin probar" — por eso el bloque se llama "nunca
  // nombradas" y no "sin cubrir". Hay funciones que sí se ejercitan de
  // verdad (p.ej. vía `.onclick()`, o porque otra función cubierta las
  // invoca por dentro) aunque su nombre nunca se escriba literal en
  // ninguna suite. El número de funciones con prueba EFECTIVA es
  // (total declaradas en `cubre`) menos (nunca nombradas).
  const textoSinBloquesCubre = archivos.map(arch => {
    const texto = fs.readFileSync(path.join(__dirname, arch), "utf8");
    const bloqueCubre = (texto.match(/cubre:\s*\[[\s\S]*?\]/) || [""])[0];
    return bloqueCubre ? texto.replace(bloqueCubre, "") : texto;
  }).join("\n");
  const nuncaNombradas = [...cubiertas].filter(n => {
    const escapado = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp("\\b" + escapado + "\\b").test(textoSinBloquesCubre);
  }).sort();
  if (nuncaNombradas.length) {
    console.log("");
    console.log(COL.ama + "  declaradas pero nunca nombradas (" + nuncaNombradas.length + "):" + COL.fin);
    for (let i = 0; i < nuncaNombradas.length; i += 6) console.log("    " + COL.dim + nuncaNombradas.slice(i, i + 6).join(", ") + COL.fin);
  }

  // Cobertura por ejecución (ver `envolverApiParaCobertura` más arriba). Estrictamente
  // más fuerte que "nunca nombradas" pero, a propósito, TAMBIÉN informativo: puede haber
  // falsos positivos legítimos (cobertura por integración vía DOM/evento, no vía
  // `api.nombre(...)`). Cada hallazgo se lee a mano contra su suite antes de actuar.
  if (huecosPorEjecucion.length) {
    console.log("");
    console.log(COL.ama + "  declaradas en cubre pero JAMÁS invocadas vía api.·(...) (" + huecosPorEjecucion.length + "):" + COL.fin);
    for (const h of huecosPorEjecucion) console.log("    " + COL.dim + h.suite + " → " + h.fn + COL.fin);
  }

  console.log(COL.tit + "─".repeat(64) + COL.fin);
  console.log("");

  // Hallado en revisión adversarial (2026-08-11): con exit(0) incondicional, todo el
  // banco era CONSULTIVO — un runner con "N fallan" salía verde y el CI lo aceptaba.
  // El código de salida debe decir la verdad: distinto de cero si algo falló.
  _terminoDeVerdad = true;
  process.exit(tf ? 1 : 0);
}

main().catch(e => { console.error("error del ejecutor:", e); process.exit(2); });
