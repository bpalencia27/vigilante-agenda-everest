"use strict";
// ══════════════════════════════════════════════════════════════════════
// Suite 82 — v18.2 (P11) · Compuerta de consentimiento (04_consentimiento).
// Cubre las 10 pruebas obligatorias del prompt:
//   1·sin responder: ni red, ni nodos del script, ni temporizadores, ni
//     telemetría — solo la pantalla con PARTE 1 y los términos completos
//   2·rechaza: apagado completo, cero envíos (ni evento de rechazo) y
//     marca local con hora
//   3·rechazo fresco (2 h) no re-pregunta; vencido (13 h) sí
//   4·acepta: constancia {versión, fecha-hora, identificador} y NADA más;
//     arranque normal a partir de ahí
//   5·Escape (y la ausencia de ✕) NO es responder; el foco queda atrapado
//   6·TERMINOS_VERSION sube → se re-pide
//   7·actualización sin cambio de texto → NO se re-pide
//   8·la constancia sobrevive la limpieza de datos del sitio (vive en GM)
//   9·TERMINOS_TEXTO es el documento del repo, carácter a carácter
//  10·ESTRUCTURAL: un solo punto de entrada; nada arranca fuera de la
//     compuerta (la prueba 10 del prompt —mutación verificada con cuatro
//     salidas— vive en tests/INFORME_MUTACIONES.md, filas de P11)
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
const DOC_TERMINOS = fs.readFileSync(path.join(__dirname, "..", "docs", "TERMINOS_Y_AVISO_DE_PRIVACIDAD.md"), "utf8").replace(/\r\n/g, "\n");

// Red contada: fetch y GM_xmlhttpRequest que SOLO cuentan y fallan igual
// que el stub por defecto del arnés (onerror) — nada sale de verdad.
function redContada() {
  const c = { fetch: 0, gmxhr: 0 };
  return {
    contadores: c,
    fetch: async () => { c.fetch++; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "{}", clone() { return this; } }; },
    gmxhr: (o) => { c.gmxhr++; try { if (o && typeof o.onerror === "function") o.onerror(new Error("red vetada por la prueba")); } catch (e) {} },
  };
}

// Siembra un médico COMPLETO: padrón cacheado (B2) + login de sesión +
// identidad validada por Everest en la caché GM. Nada de esto toca la red.
function sembrarMedico(env) {
  env.almacen["vgl_acceso_lista"] = JSON.stringify({ version: "t1", perfiles: { COMPLETO: [{ uid: 101, nombre: "Prueba Uno" }], LABORATORIOS: [] }, blocklist: [] });
  env.almacen["user"] = JSON.stringify({ username: "bpalencia", userIdentity: "x" });
  env.gm["vgl_identidad_medico_cache"] = { bpalencia: { id: 101, name: "Prueba Uno", ts: Date.now() } };
}
function limpiarConsentimiento(env) {
  delete env.gm["vgl_terminos_acepta"];
  delete env.gm["vgl_terminos_rechazo"];
}
function nodosVgl(env) {
  // Todo lo que cuelga de las pantallas de términos (velo, tarjeta, botones,
  // aviso de rechazo) es UI de la compuerta, no nodos operativos del script.
  return env.doc.querySelectorAll("[id^='vgl-']").filter((n) => n.id.indexOf("vgl-terminos-") !== 0);
}

module.exports = {
  nombre: "Suite 82 · v18.2 (P11): compuerta de consentimiento antes de todo",
  cubre: ["mtrCompuertaArranque", "mtrCompuertaDecision", "mtrTerminosPantalla", "_terminosAlAceptar", "_terminosAlRechazar"],
  async pruebas(t, api, env, cargar) {
    t.cierto(typeof api.mtrCompuertaArranque === "function", "la compuerta debe quedar expuesta al arnés (declaración function de nivel superior)");
    t.cierto(typeof api.__TERMINOS_TEXTO === "string" && api.__TERMINOS_TEXTO.length > 1000, "TERMINOS_TEXTO publicada al arnés y no vacía");

    // ── 0 ── las piezas de la compuerta responden directas al arnés ────
    await t.casoAsync("P11·0 — las piezas de la compuerta responden directas al arnés", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      // La decisión es una función PURA: objeto con arrancar booleano y pantalla
      // string-o-nulo; sin siembra de aceptación manda a preguntar.
      const d = c.api.mtrCompuertaDecision();
      t.cierto(!!d && typeof d === "object" && typeof d.arrancar === "boolean" && (d.pantalla === null || typeof d.pantalla === "string"), "mtrCompuertaDecision devuelve una decisión bien formada");
      t.cierto(d.arrancar === false && d.pantalla === "terminos", "sin constancia previa, la decisión es preguntar los términos");
      // La pantalla se puede pintar y cerrar directamente
      c.api.mtrTerminosPantalla();
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-velo"), "mtrTerminosPantalla pinta el velo");
      c.api._terminosCerrarPantalla();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "_terminosCerrarPantalla lo retira");
      // Rechazar directo: marca + aviso, sin red y sin arranque
      c.api._terminosAlRechazar();
      t.cierto(!!c.env.gm["vgl_terminos_rechazo"] && !c.env.doc.getElementById("vgl-root") && red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "_terminosAlRechazar solo deja la marca con hora");
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-rechazo-velo"), "y muestra el aviso informativo");
      c.env.doc.getElementById("vgl-terminos-rechazo-ok")._listeners.click[0]();
      // Aceptar directo: borra la marca de rechazo y escribe la constancia
      c.api._terminosAlAceptar();
      t.cierto(!c.env.gm["vgl_terminos_rechazo"] && !!c.env.gm["vgl_terminos_acepta"], "_terminosAlAceptar escribe la constancia y retira el rechazo");
      t.cierto(c.env.gm["vgl_terminos_acepta"].id === "uid:101", "con el identificador del padrón sembrado");
    });

    // ── 1 ── sin responder: no corre NADA del script ──────────────────
    await t.casoAsync("P11·1 — sin responder no hay red, ni nodos del script, ni temporizadores, ni telemetría", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      c.api.mtrCompuertaArranque();
      const velo = c.env.doc.getElementById("vgl-terminos-velo");
      t.cierto(!!velo, "lo único que aparece es la pantalla de términos");
      t.cierto(!c.env.doc.getElementById("vgl-root"), "sin responder NO se monta el panel (vgl-root ausente)");
      t.cierto(nodosVgl(c.env).length === 0, "ningún otro nodo vgl-* del script existe antes de responder (hallados: " + nodosVgl(c.env).map((n) => n.id).join(",") + ")");
      t.cierto(c.env.intervalos.size === 0, "cero temporizadores de página vivos (hay " + c.env.intervalos.size + ")");
      t.cierto(red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "cero peticiones de red (fetch " + red.contadores.fetch + ", gmxhr " + red.contadores.gmxhr + ")");
      t.cierto(!("vgl_ux" in c.env.almacen), "ni un evento de telemetría volcado");
      // PARTE 1 arriba, términos completos YA presentes (aunque plegados)
      const texto = c.env.doc.getElementById("vgl-terminos-texto");
      t.cierto(!!texto && texto.textContent === api.__TERMINOS_TEXTO, "el texto completo está disponible ANTES de aceptar, íntegro");
      t.cierto(!!texto && texto.style.cssText.indexOf("display:none") === 0, "y llega plegado (se despliega con un clic)");
      const ver = c.env.doc.getElementById("vgl-terminos-toggle");
      t.cierto(!!ver && ver._listeners.click.length === 1, "el toggle «Ver los términos completos» existe y responde al clic");
    });

    // ── 2 ── rechaza: apagado completo y marca local ──────────────────
    await t.casoAsync("P11·2 — rechazar apaga todo, no envía NADA y deja marca con hora", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      c.api.mtrCompuertaArranque();
      c.env.doc.getElementById("vgl-terminos-rechazar")._listeners.click[0]();
      const marca = c.env.gm["vgl_terminos_rechazo"];
      t.cierto(!!marca && typeof marca.ts === "number" && Math.abs(Date.now() - marca.ts) < 5000, "queda marca local de rechazo con hora");
      t.cierto(!("vgl_terminos_acepta" in c.env.gm), "rechazar NO escribe ninguna constancia de aceptación");
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "la pantalla de términos se cierra");
      const aviso = c.env.doc.getElementById("vgl-terminos-rechazo-velo");
      t.cierto(!!aviso, "aparece el aviso informativo de rechazo");
      t.cierto(!c.env.doc.getElementById("vgl-root"), "sin panel: apagado completo");
      t.cierto(nodosVgl(c.env).length === 0, "ningún nodo operativo del script quedó montado");
      t.cierto(c.env.intervalos.size === 0, "cero temporizadores");
      t.cierto(red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "cero envíos — ni siquiera un evento de rechazo");
      c.env.doc.getElementById("vgl-terminos-rechazo-ok")._listeners.click[0]();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-rechazo-velo"), "«Entendido» cierra el aviso y no deja nada");
    });

    // ── 3 ── TTL del rechazo: 2 h no re-pregunta, 13 h sí ─────────────
    await t.casoAsync("P11·3 — rechazo fresco (2 h) no re-pregunta; a las 13 h vuelve a preguntar", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      const H = 3600 * 1000;
      c.env.gm["vgl_terminos_rechazo"] = { ts: Date.now() - 2 * H };
      c.api.mtrCompuertaArranque();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "a las 2 h NO vuelve a preguntar (marca fresca)");
      t.cierto(!c.env.doc.getElementById("vgl-root") && red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "y sigue TODO apagado, sin red");
      c.env.gm["vgl_terminos_rechazo"] = { ts: Date.now() - 13 * H };
      c.api.mtrCompuertaArranque();
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-velo"), "a las 13 h SÍ vuelve a preguntar");
      t.cierto(!c.env.doc.getElementById("vgl-root") && c.env.intervalos.size === 0, "pero solo pregunta: nada más corre");
    });

    // ── 4 ── acepta: constancia exacta y arranque normal ─────────────
    await t.casoAsync("P11·4 — aceptar guarda {versión, fecha-hora, identificador} y NADA más, y arranca normal", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      // Marcador de «boot() corrió»: el kill-switch remoto corta el arranque
      // JUSTO después de restaurar/enganchar, mostrando el aviso de pausa y
      // SIN montar el panel. Es la vía corta y observable de que la compuerta
      // dejó pasar el arranque real (y de que nada más se escribió antes).
      c.env.gm["vgl_kill_active"] = true;
      const clavesAntes = Object.keys(c.env.gm).sort().join(",");
      c.api.mtrCompuertaArranque();
      c.env.doc.getElementById("vgl-terminos-aceptar")._listeners.click[0]();
      const k = c.env.gm["vgl_terminos_acepta"];
      t.cierto(!!k && k.version === "1.1" && typeof k.ts === "number" && k.ts > 0, "constancia con versión y fecha-hora");
      t.cierto(!!k && k.id === "uid:101", "constancia con el identificador validado por Everest (uid:101)");
      t.cierto(Object.keys(k || {}).sort().join(",") === "id,ts,version", "la constancia guarda SOLO {versión, fecha-hora, identificador}");
      const clavesDespues = Object.keys(c.env.gm).sort().join(",");
      t.cierto(clavesDespues === clavesAntes + ",vgl_terminos_acepta" || clavesDespues === clavesAntes.replace("vgl_terminos_acepta,", "") + ",vgl_terminos_acepta", "aceptar no escribe ninguna OTRA clave GM (antes: " + clavesAntes + " / después: " + clavesDespues + ")");
      t.cierto(!!c.env.doc.getElementById("vgl-pausa-clinica"), "boot() corrió tras aceptar (aviso de pausa del kill-switch visible)");
      t.cierto(!c.env.doc.getElementById("vgl-root"), "y con el kill activo no monta panel — el arranque fue el normal, cortado por el kill-switch");
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "la pantalla de términos se cerró sola");
    });

    // ── 5 ── Escape/✕ no es responder ────────────────────────────────
    await t.casoAsync("P11·5 — Escape NO responde ni cierra, no hay botón ✕ y el foco queda atrapado", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      c.api.mtrCompuertaArranque();
      const velo = c.env.doc.getElementById("vgl-terminos-velo");
      t.cierto(!!velo && velo._listeners.keydown.length === 1, "la pantalla escucha el teclado");
      let prevenido = false;
      velo._listeners.keydown[0]({ key: "Escape", preventDefault() { prevenido = true; } });
      t.cierto(prevenido, "Escape se consume (preventDefault)");
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-velo"), "Escape NO cierra la pantalla");
      t.cierto(!("vgl_terminos_acepta" in c.env.gm) && !("vgl_terminos_rechazo" in c.env.gm), "Escape no cuenta ni como aceptación ni como rechazo");
      t.cierto(!c.env.doc.getElementById("vgl-root") && red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "y no arranca nada");
      // Sin ✕: en toda la tarjeta solo hay TRES botones (ver, aceptar, rechazar)
      const botones = [];
      (function recorrer(n) { if (!n) return; if (n.tagName === "BUTTON") botones.push(n.id || "(sin id)"); (n.children || []).forEach(recorrer); })(velo);
      t.cierto(botones.length === 3 && botones.indexOf("vgl-terminos-toggle") >= 0 && botones.indexOf("vgl-terminos-aceptar") >= 0 && botones.indexOf("vgl-terminos-rechazar") >= 0, "exactamente tres botones (ver/aceptar/rechazar): no existe salida por ✕ — hallados: " + botones.join(","));
      // El foco no sale: Tab se consume y rota dentro del diálogo
      let tabPrevenido = false;
      velo._listeners.keydown[0]({ key: "Tab", shiftKey: false, preventDefault() { tabPrevenido = true; } });
      t.cierto(tabPrevenido, "Tab queda atrapado dentro del diálogo (preventDefault)");
      // El toggle despliega/oculta los términos completos desde PARTE 1
      const texto = c.env.doc.getElementById("vgl-terminos-texto");
      texto.style.display = "none";
      c.env.doc.getElementById("vgl-terminos-toggle")._listeners.click[0]();
      t.cierto(texto.style.display === "block", "un clic despliega los términos completos");
      t.cierto(c.env.doc.getElementById("vgl-terminos-toggle").textContent.indexOf("Ocultar") === 0, "y el rótulo pasa a «Ocultar…»");
    });

    // ── 6 ── versión nueva → re-pide ──────────────────────────────────
    await t.casoAsync("P11·6 — si TERMINOS_VERSION sube, se pide autorización de nuevo", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      c.env.gm["vgl_terminos_acepta"] = { version: "1.0", ts: Date.now(), id: "uid:101" };
      c.api.mtrCompuertaArranque();
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-velo"), "una constancia de la 1.0 NO sirve para la 1.1: se re-pregunta");
      t.cierto(!c.env.doc.getElementById("vgl-root") && red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "y no arranca nada mientras tanto");
      // La forma guardada que no es {version vigente, ts numérico} tampoco autoriza
      try { c.env.doc.getElementById("vgl-terminos-velo").remove(); } catch (e) {}
      c.env.gm["vgl_terminos_acepta"] = { version: "1.1", ts: "ayer" };
      c.api.mtrCompuertaArranque();
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-velo"), "una constancia sin fecha-hora numérica NO autoriza");
    });

    // ── 7 ── misma versión → no re-pide ───────────────────────────────
    await t.casoAsync("P11·7 — actualizar el script SIN cambiar el texto no vuelve a preguntar", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      c.env.gm["vgl_kill_active"] = true; // marcador de arranque (ver P11·4)
      c.env.gm["vgl_terminos_acepta"] = { version: "1.1", ts: Date.now() - 30 * 24 * 3600 * 1000, id: "uid:101" };
      c.api.mtrCompuertaArranque();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "constancia vigente aunque antigua: NO se re-pregunta");
      t.cierto(!!c.env.doc.getElementById("vgl-pausa-clinica"), "el arranque real corrió directamente (aviso del kill-switch)");
    });

    // ── 8 ── la constancia sobrevive la limpieza del sitio ────────────
    await t.casoAsync("P11·8 — la constancia vive fuera del origen: sobrevive «borrar datos del sitio»", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMedico(c.env);
      c.api.mtrCompuertaArranque();
      c.env.doc.getElementById("vgl-terminos-aceptar")._listeners.click[0]();
      t.cierto(!!c.env.gm["vgl_terminos_acepta"], "constancia escrita al aceptar");
      c.env.storage.clear();                    // el médico borra los datos del SITIO
      t.cierto(!c.env.almacen["vgl_terminos_acepta"] && !c.env.almacen["user"], "el localStorage quedó vacío de verdad");
      t.cierto(!!c.env.gm["vgl_terminos_acepta"], "pero la constancia sigue en el almacen del userscript (GM)");
      sembrarMedico(c.env);                     // el tablero repuebla el padrón por su vía
      c.env.gm["vgl_kill_active"] = true;       // marcador de arranque (ver P11·4)
      c.api.mtrCompuertaArranque();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "tras limpiar el sitio NO vuelve a pedir autorización");
      t.cierto(!!c.env.doc.getElementById("vgl-pausa-clinica"), "y arranca normal (aviso del kill-switch)");
    });

    // ── 9 ── el texto es el documento, carácter a carácter ────────────
    await t.casoAsync("P11·9 — TERMINOS_TEXTO es el documento del repo, idéntico carácter a carácter", async () => {
      const c = await cargar({ silencioso: true });
      const a = c.api.__TERMINOS_TEXTO;
      const b = DOC_TERMINOS;
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      t.cierto(a === b, "TERMINOS_TEXTO === docs/TERMINOS_Y_AVISO_DE_PRIVACIDAD.md" + (a === b ? "" : " — primera diferencia en el carácter " + i + ": «" + a.slice(i, i + 40) + "» vs «" + b.slice(i, i + 40) + "» (longitudes " + a.length + "/" + b.length + ")"));
      t.igual(c.api.__TERMINOS_VERSION, "1.1", "la versión vigente de la constante");
      t.cierto(b.indexOf("**Versión 1.1 ·") === 0 || b.indexOf("**Versión 1.1 ·") > 0, "el documento declara la misma versión que la constante");
      t.cierto(typeof c.api.__TERMINOS_RESUMEN === "string" && c.api.__TERMINOS_RESUMEN.length > 200 && c.api.__TERMINOS_RESUMEN.length < b.length, "PARTE 1: resumen en limpio, más corto que el documento completo");
    });

    // ── 10 ── ESTRUCTURAL: un solo punto de entrada ───────────────────
    t.caso("P11·10 — ESTRUCTURAL: nada arranca fuera de la compuerta", () => {
      // La entrada única del script
      t.cierto(FUENTE.indexOf('document.addEventListener("DOMContentLoaded", mtrCompuertaArranque)') >= 0, "la entrada del script es la compuerta");
      t.cierto(FUENTE.indexOf('document.addEventListener("DOMContentLoaded", boot)') < 0 && FUENTE.indexOf("setTimeout(boot, 0)") < 0, "ya NADIE registra boot() directamente");
      // boot() solo se llama desde mtrArrancarTodo. La regex exige la llamada
      // como sentencia completa en su propia línea: así no casan ni la
      // definición «function boot() {» ni los «boot()» que aparecen dentro de
      // comentarios o de strings de console.error.
      const llamadas = [...FUENTE.matchAll(/^[ \t]*boot\(\s*\);[ \t]*$/gm)];
      t.igual(llamadas.length, 1, "boot() se llama exactamente una vez en todo el archivo");
      const iArr = FUENTE.indexOf("function mtrArrancarTodo()");
      t.cierto(iArr >= 0 && llamadas[0] && llamadas[0].index > iArr && llamadas[0].index < iArr + 700, "y esa llamada vive dentro de mtrArrancarTodo (post-consentimiento)");
      // apiObservar(window) también quedó solo tras la compuerta
      const obs = [...FUENTE.matchAll(/apiObservar\(window\)/g)];
      t.igual(obs.length, 1, "apiObservar(window) se llama exactamente una vez");
      t.cierto(obs[0] && obs[0].index > iArr && obs[0].index < iArr + 700, "también dentro de mtrArrancarTodo");
      // La identidad por red solo dentro de boot(), después del kill-switch
      const idt = [...FUENTE.matchAll(/setTimeout\(identidadDesdeCliente,\s*0\)/g)];
      t.igual(idt.length, 1, "la resolución de identidad por red se programa exactamente una vez");
      const iBoot = FUENTE.indexOf("function boot() {");
      // v18.3.1 — la ventana fija «iBoot + 3000» la rompió v18.3.0 (boot() creció a
      // 3047 chars hasta el setTimeout): el límite correcto es el fin REAL de boot(),
      // marcado por la siguiente función de nivel IIFE (indentación de 2 espacios).
      const iBootFin = FUENTE.indexOf("\n  function ", iBoot + 20);
      const iKill = FUENTE.indexOf('GM_getValue("vgl_kill_active"', iBoot);
      t.cierto(idt[0] && idt[0].index > iKill && idt[0].index < iBootFin, "dentro de boot(), después del kill-switch — nunca antes de la compuerta");
      // Y la fila de Ajustes muestra la versión vigente
      t.cierto(FUENTE.indexOf('id="c-terminos"') === FUENTE.lastIndexOf('id="c-terminos"'), "una sola definición de la fila de términos en Ajustes");
      t.cierto(FUENTE.indexOf("${escapeHtml(_terminosAjustesTexto())}") > 0, "la fila pinta el texto de versión/fecha real, no un literal fijo");
    });

    // ── v18.3.1 ── rescate del arranque sin caché (deadlock real) ─────
    // Incidencia de producción: el único escritor de la caché del padrón vivía
    // DENTRO de boot(), y boot() solo corre si la caché ya autoriza → una máquina
    // sin caché válida (primera instalación) o envenenada jamás se auto-reparaba
    // («no sale nada»). La compuerta ahora refresca el padrón ANTES de resignarse
    // al silencio del veredicto «fuera-del-padron» y re-decide una sola vez.
    const PADRON_REMOTO = { ok: true, version: "vTest2", perfiles: { COMPLETO: [{ uid: 101, nombre: "Prueba Uno" }], LABORATORIOS: [] }, blocklist: [] };

    // Identidad presente (login de sesión + caché GM validada por Everest) PERO
    // sin padrón en localStorage: la máquina de una médica recién autorizada.
    function sembrarIdentidadSinPadron(env) {
      env.almacen["user"] = JSON.stringify({ username: "bpalencia", userIdentity: "x" });
      env.gm["vgl_identidad_medico_cache"] = { bpalencia: { id: 101, name: "Prueba Uno", ts: Date.now() } };
    }

    await t.casoAsync("P11·11 — máquina sin caché: la compuerta refresca el padrón ANTES de resignarse y luego pregunta los términos", async () => {
      const red = redContada();
      let usos = 0;
      const gmxhr = (o) => { usos++; try { o.onload({ status: 200, response: PADRON_REMOTO }); } catch (e) {} };
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr });
      sembrarIdentidadSinPadron(c.env);
      await c.api.mtrCompuertaArranque();
      t.cierto(usos === 1 && red.contadores.fetch === 0, "la compuerta fue a buscar el padrón exactamente una vez por GM_xmlhttpRequest (usos " + usos + ", fetch " + red.contadores.fetch + ")");
      t.cierto(!!c.env.almacen["vgl_acceso_lista"], "el padrón descargado quedó cacheado (versión " + (JSON.parse(c.env.almacen["vgl_acceso_lista"] || "{}").version || "?") + ")");
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-velo"), "y con el padrón en mano la compuerta SÍ pregunta los términos — el script «sale» sin remedio manual");
      t.cierto(!c.env.doc.getElementById("vgl-root") && c.env.intervalos.size === 0, "sin panel ni temporizadores mientras no se acepta");
    });

    await t.casoAsync("P11·12 — sello de refresco fresco (<4 h): la compuerta NO vuelve a gastar red aunque siga fuera del padrón", async () => {
      let usos = 0;
      const gmxhr = (o) => { usos++; try { o.onload({ status: 200, response: PADRON_REMOTO }); } catch (e) {} };
      const c = await cargar({ silencioso: true, fetch: async () => { usos += 100; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => "{}", clone() { return this; } }; }, gmxhr });
      // Padrón cacheado VÁLIDO pero sin esta médica (quedó viejo/envenenado) y
      // sello de refresco fresco: el tablero acaba de ser consultado hace <4 h.
      c.env.almacen["vgl_acceso_lista"] = JSON.stringify({ version: "t0", perfiles: { COMPLETO: [], LABORATORIOS: [] }, blocklist: [] });
      c.env.almacen["vgl_acceso_fetch"] = JSON.stringify({ ts: Date.now(), ok: true });
      sembrarIdentidadSinPadron(c.env);
      await c.api.mtrCompuertaArranque();
      t.cierto(usos === 0, "con el sello fresco el rescate respeta la cuarentena de 4 h: cero peticiones (usos " + usos + ")");
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo") && !c.env.doc.getElementById("vgl-root"), "fuera del padrón y sin rescate disponible: silencio total");
    });

    await t.casoAsync("P11·13 — si el rescate falla (red caída), la compuerta termina en silencio sin romperse", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarIdentidadSinPadron(c.env);
      await c.api.mtrCompuertaArranque();
      t.cierto(red.contadores.gmxhr === 1, "intentó el rescate exactamente una vez");
      const sello = JSON.parse(c.env.almacen["vgl_acceso_fetch"] || "null");
      t.cierto(!!sello && sello.ok === false, "el sello quedó pesimista (ok:false) — un fallo NO bloquea el reintento de la próxima carga");
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo") && !c.env.doc.getElementById("vgl-root") && c.env.intervalos.size === 0, "silencio total, cero temporizadores y sin excepción");
    });

    await t.casoAsync("P11·14 — BLOQUEADO no se refresca: su silencio no negocia con el tablero", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      c.env.almacen["vgl_acceso_lista"] = JSON.stringify({ version: "t1", perfiles: { COMPLETO: [], LABORATORIOS: [] }, blocklist: [{ uid: 101, nombre: "Prueba Uno" }] });
      sembrarIdentidadSinPadron(c.env);
      await c.api.mtrCompuertaArranque();
      t.cierto(red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "bloqueado no dispara NI un intento de rescate");
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo") && !c.env.doc.getElementById("vgl-root"), "silencio total: el bloqueo no se re-evalúa por red");
    });

    // ── v18.3.2 ── médico nuevo en MÁQUINA NUEVA (incidencia Dra. Gloria) ──
    // El padrón cacheado la sirve, PERO la máquina no tiene NI rastro de
    // identidad validada: la caché GM solo la escribe resolverMedicoPorPerfil,
    // que vive DENTRO de boot(), y boot() solo corre si la compuerta lo deja.
    // v18.3.1 arregló la LISTA; esto es el deadlock de IDENTIDAD que quedaba.
    function sembrarMaquinaNueva(env) {
      env.almacen["vgl_acceso_lista"] = JSON.stringify({ version: "t1", perfiles: { COMPLETO: [{ uid: 101, nombre: "Prueba Uno" }], LABORATORIOS: [] }, blocklist: [] });
      env.almacen["user"] = JSON.stringify({ username: "bpalencia", userIdentity: "x" });
    }

    await t.casoAsync("P11·15 — máquina nueva sin identidad: la compuerta SÍ pregunta los términos (caso Dra. Gloria)", async () => {
      const red = redContada();
      let usos = 0;
      const gmxhr = (o) => { usos++; try { o.onload({ status: 200, response: PADRON_REMOTO }); } catch (e) {} };
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr });
      sembrarMaquinaNueva(c.env);
      const d = c.api.mtrCompuertaDecision();
      t.cierto(d.arrancar === false && d.pantalla === "terminos" && d.motivo === "sin-identidad", "la decisión es preguntar por la vía sin-identidad (motivo «" + d.motivo + "»)");
      c.env.gm["vgl_kill_active"] = true; // marcador de arranque (ver P11·4)
      await c.api.mtrCompuertaArranque();
      t.cierto(!!c.env.doc.getElementById("vgl-terminos-velo"), "a una primera instalación se le muestra la pantalla de términos — ya no silencio eterno");
      t.cierto(usos === 0 && red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "la vía sin-identidad NO gasta red: no hay rescate que hacer (gmxhr " + usos + ", fetch " + red.contadores.fetch + ")");
      t.cierto(!c.env.doc.getElementById("vgl-root") && c.env.intervalos.size === 0, "sin panel ni temporizadores hasta responder");
      c.env.doc.getElementById("vgl-terminos-aceptar")._listeners.click[0]();
      const k = c.env.gm["vgl_terminos_acepta"];
      t.cierto(!!k && k.version === "1.1" && k.id === "login:bpalencia", "la constancia firma con el login de sesión cuando no hay uid validado («" + (k && k.id) + "»)");
      t.cierto(!!c.env.doc.getElementById("vgl-pausa-clinica") && !c.env.doc.getElementById("vgl-root"), "aceptar arranca boot() de verdad (aviso del kill-switch visible, sin panel)");
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "la pantalla se cerró sola");
    });

    await t.casoAsync("P11·16 — máquina nueva con constancia vigente: arranca directo, no re-pregunta", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      sembrarMaquinaNueva(c.env);
      c.env.gm["vgl_terminos_acepta"] = { version: "1.1", ts: Date.now(), id: "login:bpalencia" };
      c.env.gm["vgl_kill_active"] = true; // marcador de arranque (ver P11·4)
      const d = c.api.mtrCompuertaDecision();
      t.cierto(d.arrancar === true && d.motivo === "sin-identidad-aceptado" && d.pantalla === null, "constancia vigente + sin identidad = arranque directo (motivo «" + d.motivo + "»)");
      await c.api.mtrCompuertaArranque();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo"), "no vuelve a preguntar lo ya aceptado");
      t.cierto(!!c.env.doc.getElementById("vgl-pausa-clinica") && !c.env.doc.getElementById("vgl-root"), "boot() corrió directo tras la compuerta");
    });

    await t.casoAsync("P11·17 — sin identidad Y sin login de sesión: a nadie se le pregunta nada", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      // Solo el padrón cacheado: ni user de sesión ni identidad ni constancia.
      c.env.almacen["vgl_acceso_lista"] = JSON.stringify({ version: "t1", perfiles: { COMPLETO: [{ uid: 101, nombre: "Prueba Uno" }], LABORATORIOS: [] }, blocklist: [] });
      const d = c.api.mtrCompuertaDecision();
      t.cierto(d.arrancar === false && d.pantalla === null && d.motivo === "fuera-del-padron", "sin sesión la vía sin-identidad no aplica (motivo «" + d.motivo + "»)");
      await c.api.mtrCompuertaArranque();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo") && !c.env.doc.getElementById("vgl-root") && c.env.intervalos.size === 0, "silencio total: no se pregunta a una máquina sin médico en sesión");
      t.cierto(red.contadores.gmxhr === 1, "el motivo fuera-del-padron sí intenta su único rescate (gmxhr " + red.contadores.gmxhr + ")");
    });

    await t.casoAsync("P11·18 — REGRESIÓN: con identidad presente, el padrón sigue mandando — fuera es fuera", async () => {
      const red = redContada();
      const c = await cargar({ silencioso: true, fetch: red.fetch, gmxhr: red.gmxhr });
      // Identidad validada (uid 202) que el padrón cacheado NO trae, y sello de
      // refresco fresco para que el rescate no gaste red y se vea la decisión pura.
      c.env.almacen["user"] = JSON.stringify({ username: "bgloria", userIdentity: "x" });
      c.env.gm["vgl_identidad_medico_cache"] = { bgloria: { id: 202, name: "Prueba Dos", ts: Date.now() } };
      c.env.almacen["vgl_acceso_lista"] = JSON.stringify({ version: "t1", perfiles: { COMPLETO: [{ uid: 101, nombre: "Prueba Uno" }], LABORATORIOS: [] }, blocklist: [] });
      c.env.almacen["vgl_acceso_fetch"] = JSON.stringify({ ts: Date.now(), ok: true });
      const d = c.api.mtrCompuertaDecision();
      t.cierto(d.arrancar === false && d.pantalla === null && d.motivo === "fuera-del-padron", "identidad presente pero fuera del padrón: silencio, no términos (motivo «" + d.motivo + "»)");
      await c.api.mtrCompuertaArranque();
      t.cierto(!c.env.doc.getElementById("vgl-terminos-velo") && !c.env.doc.getElementById("vgl-root"), "el arreglo de máquina nueva NO abre la puerta a quien el padrón no trae");
      t.cierto(red.contadores.fetch === 0 && red.contadores.gmxhr === 0, "sello fresco: ni siquiera rescate (fetch " + red.contadores.fetch + ", gmxhr " + red.contadores.gmxhr + ")");
    });
  }
};
