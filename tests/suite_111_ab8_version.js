// ══════════════════════════════════════════════════════════════════════
// Suite 111 — AB-8 (informe A/B): comunicación/adopción de versiones. La
// flota se quedó en 17.39.0 pese a ir el repo en v18.x: el informe sostiene
// que no es desconocimiento (97 % entiende el aviso) sino falta de ACCIÓN.
// Esta entrega mide, sin tocar el tono del aviso (eso lo decide el médico):
//   · aviso.upd.visible.vX — el aviso diario de actualización quedó MEDIDO
//     por versión anunciada (una vez por versión, anti-duplicado existente).
//   · aviso.upd.click.vX — el clic de «Actualizar ahora» del bloqueo por
//     versión obsoleta: la ACCIÓN, por versión exigida. Vive en un script en
//     candado: uxTrack sobrevive (timer propio + beforeunload) y vglLog deja
//     la evidencia fina en la bitácora local.
// Sufijos de versión = semver anunciada/exigida: universo controlado por el
// proyecto (jamás texto del DOM), sin PHI por construcción.
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const USERJS = path.join(__dirname, "..", "vigilante_agenda.user.js");

const accionesUX = (c) => {
  try { c.api._uxVolcarBuffer(); return (JSON.parse(c.env.storage.getItem("vgl_ux") || "null") || {}).acciones || {}; } catch (e) { return {}; }
};
// filas de bitácora del clic (vglLog VER/ClicActualizar)
const filasClic = (c) => {
  try {
    const raw = JSON.parse(c.env.storage.getItem("vgl_flight_recorder_logs") || "[]");
    return Array.isArray(raw) ? raw.filter((f) => f && f.cat === "VER" && f.act === "ClicActualizar") : [];
  } catch (e) { return []; }
};
// el botón «Actualizar ahora» del modal de bloqueo (card.children: tít, cuerpo, btn…)
const botonActualizar = (c) => {
  const modal = c.env.doc.getElementById("vgl-bloqueo-version");
  if (!modal || !modal.children[0]) return null;
  return modal.children[0].children.find((n) => n && n.tagName === "BUTTON") || null;
};
// gmxhr del gist de actualización: responde con el @version que se le pida
const gistCon = (version) => (o) => o.onload({
  responseText: "// ==UserScript==\n// @name Vigilante de Agenda\n// @version " + version + "\n// ==/UserScript==",
});

module.exports = {
  nombre: "AB-8: adopción de versiones — aviso y clic de actualización medidos (informe A/B)",
  cubre: ["mtrCheckActualizacionGist", "_avisoBloqueoPintar"],

  async pruebas(t, api, env, cargar) {
    const base = (extra) => {
      const c = cargar(Object.assign({ silencioso: true }, extra || {}));
      c.api.__S.uxTelemetria = true;
      c.env.win.location.pathname = "/viva/HCHealth/";   // módulo clínico
      return c;
    };

    // ============ el aviso diario (mtrCheckActualizacionGist) queda medido ============
    t.caso("el aviso diario de actualización queda MEDIDO por versión anunciada", () => {
      const c = base({ gmxhr: gistCon("99.9.9") });
      c.api.mtrCheckActualizacionGist();   // el onload del mock corre dentro de la llamada
      const acc = accionesUX(c);
      t.igual(acc["aviso.upd.visible.v99.9.9"], 1, "el aviso de la versión nueva quedó contado (aviso.upd.visible.v99.9.9)");
      t.cierto(acc["aviso.upd.visible.v99.9.9.total"] === undefined, "es un conteo de exposición: sin .total (no hay magnitud que sumar)");
    });

    t.caso("una vez por versión: el anti-duplicado existente vale también para la telemetría", () => {
      const c = base({ gmxhr: gistCon("99.9.9") });
      c.api.mtrCheckActualizacionGist();   // 1ª: sella el día y avisa
      c.api.mtrCheckActualizacionGist();   // 2ª: el sello del día frena
      c.api.mtrCheckActualizacionGist();
      const acc = accionesUX(c);
      t.igual(acc["aviso.upd.visible.v99.9.9"], 1, "máximo UNA consulta al día: el conteo del aviso no se triplica con el reloj");
    });

    t.caso("sin versión nueva NO hay aviso ni telemetría (el gist al día no ensucia el conteo)", () => {
      const c = base({ gmxhr: gistCon("18.11.0") });   // el gist dice la versión LOCAL
      c.api.mtrCheckActualizacionGist();
      const acc = accionesUX(c);
      t.cierto(acc["aviso.upd.visible.v18.9.0"] === undefined, "al día: ni se anuncia ni se cuenta");
      t.cierto(Object.keys(acc).filter((k) => k.indexOf("aviso.upd") === 0).length === 0, "ninguna clave aviso.upd.* en la ventana");
    });

    // ============ el clic de «Actualizar ahora» (bloqueo por versión) ============
    t.caso("el clic de «Actualizar ahora» es la ACCIÓN medida: telemetría + bitácora, por versión exigida", () => {
      const c = base();
      c.api._mostrarAvisoBloqueoVersion("99.0.0");   // el arnés le da el arriendo
      const btn = botonActualizar(c);
      t.cierto(!!btn, "el modal de bloqueo está pintado con su botón");
      btn._listeners.click.forEach((f) => f());   // el médico pulsa «Actualizar ahora»
      const acc = accionesUX(c);
      t.igual(acc["aviso.upd.click.v99.0.0"], 1, "el clic quedó contado con la versión EXIGIDA (aviso.upd.click.v99.0.0)");
      const filas = filasClic(c);
      t.igual(filas.length, 1, "y la evidencia fina quedó en la bitácora local");
      t.igual(filas[0].det.exigida, "99.0.0", "la bitácora dice qué versión se exigía");
    });

    t.caso("cada pulsación cuenta: el médico que insiste deja rastro de cada intento", () => {
      const c = base();
      c.api._mostrarAvisoBloqueoVersion("98.0.5");
      const btn = botonActualizar(c);
      btn._listeners.click.forEach((f) => f());
      btn._listeners.click.forEach((f) => f());
      const acc = accionesUX(c);
      t.igual(acc["aviso.upd.click.v98.0.5"], 2, "dos pulsaciones = dos intentos de actualizar (es ACCIÓN, no exposición: no se deduplica)");
      t.igual(filasClic(c).length, 2, "la bitácora guarda ambos intentos");
    });

    // ============ el enganche real en el código vivo ============
    t.caso("estructura: la clave de exposición vive en la rama que SÍ avisa, con el sufijo de versión", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const i = s.indexOf('try { uxTrack("aviso.upd.visible.v" + remota); }');
      t.cierto(i >= 0, "el uxTrack de exposición existe en el código vivo");
      const iSello = s.indexOf('localStorage.setItem("vgl_upd_avisada", remota)');
      t.cierto(i > iSello, "…y corre SOLO en la rama que va a avisar (tras el anti-duplicado por versión)");
      t.cierto(s.indexOf("aviso.upd.visible.v", i) > i, "el sufijo de versión va en la clave (universo cerrado semver, sin PHI)");
      t.cierto(s.indexOf('if (localStorage.getItem("vgl_upd_avisada") === remota) return') < iSello, "el anti-duplicado por versión quedó intacto");
      t.cierto(s.indexOf('localStorage.getItem("vgl_upd_gist_dia") === hoy') < i, "y el anti-duplicado diario también");
    });

    t.caso("estructura: el clic mide ANTES de abrir la pestaña y en un script en candado sobrevive el volcado", () => {
      const s = fs.readFileSync(USERJS, "utf8");
      const iBtn = s.indexOf('btn.addEventListener("click", () => {');
      const iClick = s.indexOf('try { uxTrack("aviso.upd.click.v" + _avisoBloqueoVer); }');
      t.cierto(iClick >= 0, "el uxTrack del clic existe en el código vivo");
      const iVglLog = s.indexOf('vglLog("VER", "ClicActualizar"');
      t.cierto(iVglLog > iClick, "la bitácora acompaña al conteo");
      t.cierto(s.indexOf("window.open(VGL_UPDATE_GIST_URL", iClick) > iVglLog, "y ambos van ANTES de abrir la pestaña del gist (nada se pierde si la ventana no abre)");
      t.cierto(s.indexOf("script en candado", iBtn) > iBtn && s.indexOf("script en candado", iBtn) < iClick, "el comentario documenta que el clic vive en un script en candado");
      t.cierto(s.indexOf("timer de volcado es", iBtn) > iBtn && s.indexOf("timer de volcado es", iBtn) < iClick, "…y por qué el conteo sobrevive (timer propio + beforeunload)");
    });

    // ============ T0-4: el worker expone la frescura del pipeline ============
    t.caso("estructura (T0-4): el worker responde ultimaFila y el chequeo nocturno se pone ROJO a las 48 h", () => {
      const w = fs.readFileSync(path.join(__dirname, "..", "REPLICA_TELEMETRIA", "worker.js"), "utf8");
      t.cierto(w.indexOf('url.searchParams.get("accion") === "ultimaFila"') >= 0, "el worker tiene la acción ultimaFila (GET con el mismo token)");
      t.cierto(w.indexOf("MAX(recibido) AS ultima") >= 0, "…que lee la última escritura de lotes (toda fila pasa por ahí)");
      t.cierto(w.indexOf("Math.round(horas * 10) / 10") >= 0, "…y devuelve la antigüedad en horas con 1 decimal");
      const sh = fs.readFileSync(path.join(__dirname, "..", ".deepseek", "run-nightly-checks.sh"), "utf8");
      t.cierto(sh.indexOf("ultimaFila") >= 0, "el chequeo nocturno consulta ultimaFila");
      t.cierto(sh.indexOf("> 48") >= 0, "…con el umbral de 48 h del plan T0");
      t.cierto(sh.indexOf("no hay termómetro") >= 0, "…y documenta por qué: sin telemetría fresca no hay A/B que medir");
      t.cierto(sh.indexOf("grep -m1 'const TOKEN = \"'") >= 0, "el token se lee del propio worker.js (fuente única, no se duplica)");
      t.cierto(sh.indexOf("fail-closed") >= 0, "sin respuesta o sin filas también es ROJO (fail-closed)");
    });
  },
};
