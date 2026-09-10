// =====================================================================
//  SUITE 102 — v18.8.2: cierre accesible y arrastre libre del panel
//  «Próximos exámenes · Riesgo cardiovascular / Programa: …»
//
//  Encargo del 08-sep-2026: el widget no se podía cerrar ni mover, y
//  permanecía fijo en una única posición. Esta suite protege:
//   1. el botón de cierre visible y accesible en la esquina superior
//      derecha (botón nativo: teclado y lectores sin código propio);
//   2. el cierre por paciente — se oculta y NO resucita mientras siga
//      el mismo paciente; al llegar otro (o al volver al anterior),
//      el panel vuelve solo;
//   3. el arrastre libre con la barra superior como ÚNICA zona de
//      agarre — el botón de cierre jamás inicia arrastre;
//   4. la posición clampeada al viewport y persistida en la sesión
//      (GM vgl_rcvp_pos) para restaurarla al volver a pintar;
//   5. el clampeo puro en tamaños de pantalla reales (de teléfono
//      320×480 a escritorio 1920×1080): mínimo 96 px visibles siempre.
//
//  La siembra del contexto replica la de suite_88 (padrón en
//  vgl_acceso_lista, historia cableada por cédula, resumen en caché,
//  reloj congelado) con el DOM enriquecido REAL del arnés
//  (instalarDomEnriquecido), porque esta suite necesita consultar los
//  nodos del innerHTML del panel (barra, botón, filas) de verdad.
// =====================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { instalarDomEnriquecido } = require("./harness.js");

const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

const LISTA_102 = {
  version: "2026-09-08.2",
  perfiles: {
    COMPLETO: [{ uid: 101, nombre: "Brandon Jesús Palencia Martínez" }],
    LABORATORIOS: [{ uid: 201, nombre: "Maryuris Terán" }],
  },
  blocklist: [{ uid: 999, nombre: "Prueba Bloqueada Uno" }],
};

const HOY = "2026-09-06";
const msDe = (iso) => new Date(iso + "T00:00:00").getTime();

function cablear102(c, cedula) {
  const doc = c.env.doc;
  const getByIdReal = doc.getElementById.bind(doc);
  const qsAllReal = doc.querySelectorAll.bind(doc);
  doc.getElementById = (id) => (id === "anamesis" ? { textContent: "" } : getByIdReal(id));
  doc.querySelectorAll = (sel) => {
    if (sel === ".text-muted") return cedula ? [{ textContent: "  C.C.  " + cedula + " ", closest: () => null }] : [];
    return qsAllReal(sel);
  };
}

function resumen102() {
  return {
    programa: "HTA", factores: { hta: true },
    erc: { egfr: 80 }, riesgo: { categoria: "bajo" },
    _docId: "5150076", _pacienteIdLabs: 777,
  };
}

const widget102 = (c) => Array.prototype.find.call(c.env.doc.body.children, (e) => e.id === "vgl-rcv-pendientes") || null;

// Dispara TODOS los listeners del tipo con el evento fabricado encima
// (target customizable: las escuchas del panel son DELEGADAS en la raíz
// y miran e.target.closest(...), que el disparar() genérico no permite).
function disparar102(c, nodo, tipo, ev) {
  const arr = (nodo && nodo._listeners && nodo._listeners[tipo] ? nodo._listeners[tipo] : []).slice();
  for (const f of arr) {
    try {
      f(Object.assign({ type: tipo, target: nodo, currentTarget: nodo, preventDefault() {}, stopPropagation() {} }, ev || {}));
    } catch (e) {
      console.error("[suite_102] listener '" + tipo + "' lanzó:", e && e.message ? e.message : e);
    }
  }
}

module.exports = {
  nombre: "Widget Próximos exámenes (v18.8.2): cierre accesible, arrastre por barra y posición de sesión",

  cubre: ["rcvPendientesClamparPos", "rcvPendientesHtml", "rcvPendientesTick",
    "rcvPendientesRotuloPrograma", "esMedicoRCVActivo", "extractPacienteAbierto",
    "seccionActiva", "isLight", "uxTrack", "mtrCacheResumenLeer", "mtrCacheResumenGuardar"],

  async pruebas(t, api, env, cargar) {
    function ctx102(extra) {
      const ex = extra || {};
      const red = {
        fetches: 0,
        fetch: (url) => {
          red.fetches++;
          return Promise.resolve({
            ok: true, status: 200, headers: { get: () => "application/json" },
            json: () => Promise.resolve([]), text: () => Promise.resolve("[]"),
          });
        },
      };
      const c = cargar({
        silencioso: true,
        almacen: { vgl_acceso_lista: JSON.stringify(LISTA_102) },
        fetch: red.fetch,
        gmxhr: (o) => o.onerror(new Error("sin red")),
      });
      instalarDomEnriquecido(c.env.doc);
      c.api.__state.activeDoctor = { id: 101, name: "Brandon Jesús Palencia Martínez" };
      const cedula = ex.cedula === undefined ? "5150076" : ex.cedula;
      cablear102(c, cedula);
      try { c.api.mtrCacheResumenGuardar("5150076", resumen102()); } catch (e) {}
      if (cedula !== "5150076") { try { c.api.mtrCacheResumenGuardar(cedula, resumen102()); } catch (e) {} }
      // Reloj congelado en el fixture (patrón suite_88/suite_94): el tick de producción
      // usa new Date() real y el panel no debe depender de la fecha de la corrida.
      vm.runInContext(
        "var __VGL102_DATE_ORIG = Date;" +
        "Date = class extends __VGL102_DATE_ORIG {" +
        "  constructor(){ super(...(arguments.length ? arguments : [" + msDe(HOY) + "])); }" +
        "  static now(){ return " + msDe(HOY) + "; }" +
        "};",
        c.ctx
      );
      return c;
    }

    // ==================== UNIDAD: CLAMPEO POR PANTALLA ====================
    t.caso("clampeo puro: el panel queda con al menos 96 px visibles en cualquier pantalla", () => {
      const esperado = [
        [5000, 5000, 1920, 1080, 330, 1824, 1032],
        [-10000, -10000, 1920, 1080, 330, -226, 0],
        [5000, 5000, 320, 480, 330, 224, 432],
        [0, 0, 320, 480, 330, 0, 0],
        [5000, 5000, 800, 600, 330, 704, 552],
        [123, 45, 1366, 768, 330, 123, 45],
      ];
      for (const [x, y, vw, vh, an, ex, ey] of esperado) {
        const p = api.rcvPendientesClamparPos(x, y, vw, vh, an);
        t.igual(p.x, ex, "x " + x + " en " + vw + "×" + vh);
        t.igual(p.y, ey, "y " + y + " en " + vw + "×" + vh);
      }
      const chico = api.rcvPendientesClamparPos(9999, 9999, 200, 200, 330);
      t.cierto(isFinite(chico.x) && isFinite(chico.y), "pantalla diminuta: siempre finito, jamás NaN");
      const anchoRaro = api.rcvPendientesClamparPos(0, 0, 1024, 768, 0);
      t.cierto(isFinite(anchoRaro.x) && isFinite(anchoRaro.y), "ancho desconocido: no rompe el clampeo");
    });

    // ==================== INTEGRACIÓN: HTML Y ACCESIBILIDAD ====================
    await t.casoAsync("HTML: botón de cierre accesible dentro de la barra superior; la raíz se anuncia como región", async () => {
      const c = ctx102();
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      t.cierto(!!w, "el panel se montó");
      t.igual(w.getAttribute("role"), "region", "la raíz es una región anunciable");
      t.igual(w.getAttribute("aria-label"), "Próximos exámenes", "con nombre legible para lectores");
      const head = w.querySelector(".vgl-rcvp-head");
      t.cierto(!!head, "la barra superior existe");
      t.igual(head.getAttribute("title"), "Arrastrar para mover el panel", "la barra declara su agarre");
      const btn = w.querySelector(".vgl-rcvp-cerrar");
      t.cierto(!!btn, "el botón de cierre existe");
      t.igual(btn.getAttribute("type"), "button", "<button> nativo: Enter y Espacio funcionan sin código propio");
      t.igual(btn.getAttribute("aria-label"), "Cerrar el panel de próximos exámenes", "nombre accesible del cierre");
      t.cierto(Array.isArray(head.children) && head.children.indexOf(btn) === 0, "el botón es lo primero de la barra (esquina superior derecha por CSS)");
    });

    // ==================== INTEGRACIÓN: CIERRE POR PACIENTE ====================
    await t.casoAsync("cierre: el botón oculta el panel y NO resucita en el mismo paciente; al cambiar de paciente vuelve solo", async () => {
      const c = ctx102();
      await c.api.rcvPendientesTick();
      let w = widget102(c);
      t.cierto(!!w, "precondición: panel montado");
      const btn = w.querySelector(".vgl-rcvp-cerrar");
      disparar102(c, w, "click", { target: btn });
      t.igual(w.style.display, "none", "el clic cerró el panel");
      await c.api.rcvPendientesTick();
      t.igual(w.style.display, "none", "mismo paciente: el tick no lo resucita");
      // Contenido NUEVO en el MISMO paciente cerrado (otro programa → otro html):
      // el guard corta antes que la firma — el panel cerrado no resucita ni con datos frescos.
      try { c.api.mtrCacheResumenGuardar("5150076", { ...resumen102(), programa: "DM2" }); } catch (e) {}
      await c.api.rcvPendientesTick();
      t.igual(w.style.display, "none", "mismo paciente con contenido nuevo: el cierre aguanta");
      try { c.api.mtrCacheResumenGuardar("5150076", resumen102()); } catch (e) {}
      cablear102(c, "5150077");
      try { c.api.mtrCacheResumenGuardar("5150077", { ...resumen102(), _docId: "5150077" }); } catch (e) {}
      await c.api.rcvPendientesTick();
      w = widget102(c);
      t.cierto(!!w, "el panel sigue montado con el paciente nuevo");
      t.igual(w.style.display, "", "paciente nuevo: el panel vuelve a la vista");
      // El cierre es por vista: al cerrar en el paciente nuevo y volver al anterior,
      // el panel vuelve SOLO — incluso si el contenido del anterior no cambió (la
      // firma se salta el repintado y el display debe restaurarse igual).
      const btn2 = w.querySelector(".vgl-rcvp-cerrar");
      disparar102(c, w, "click", { target: btn2 });
      t.igual(w.style.display, "none", "el cierre en el paciente nuevo también aplica");
      // La caché de resumen es de UNA entrada: al volver a A, el flujo real la
      // re-puebla al abrir su historia — la prueba replica ese orden.
      cablear102(c, "5150076");
      try { c.api.mtrCacheResumenGuardar("5150076", resumen102()); } catch (e) {}
      await c.api.rcvPendientesTick();
      t.igual(widget102(c).style.display, "", "volver al paciente cerrado lo muestra otra vez (cierre por vista, no candado)");
    });

    // ==================== INTEGRACIÓN: ARRASTRE ====================
    await t.casoAsync("arrastre: la barra superior mueve el panel, clampea al viewport y guarda la posición en la sesión", async () => {
      const c = ctx102();
      c.env.win.innerWidth = 1024;
      c.env.win.innerHeight = 768;
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      w.getBoundingClientRect = () => ({ left: 16, top: 500, width: 330, height: 220 });
      const head = w.querySelector(".vgl-rcvp-head");
      disparar102(c, w, "pointerdown", { target: head, clientX: 100, clientY: 520, pointerId: 7 });
      t.cierto(w.classList.contains("vgl-rcvp-arrastrando"), "la barra agarró: clase de arrastre activa");
      t.igual(w.style.bottom, "auto", "el panel pasó de bottom a top al primer arrastre");
      disparar102(c, w, "pointermove", { target: head, clientX: 250, clientY: 200 });
      t.igual(w.style.left, "166px", "delta x aplicado (16 + 250-100)");
      t.igual(w.style.top, "180px", "delta y aplicado (500 + 200-520)");
      disparar102(c, w, "pointermove", { target: head, clientX: 10000, clientY: -5000 });
      t.igual(w.style.left, "928px", "clampeado al borde derecho del viewport (1024-96)");
      t.igual(w.style.top, "0px", "clampeado arriba");
      disparar102(c, w, "pointerup", { target: head });
      t.falso(w.classList.contains("vgl-rcvp-arrastrando"), "al soltar, la clase se va");
      const guardado = c.env.gm["vgl_rcvp_pos"];
      t.cierto(!!guardado && guardado.x === 928 && guardado.y === 0, "posición final guardada en la sesión (GM vgl_rcvp_pos)");
    });

    await t.casoAsync("restauración: la posición de sesión se aplica al montar, clampada a la ventana actual", async () => {
      const c = ctx102();
      c.env.win.innerWidth = 1024;
      c.env.win.innerHeight = 768;
      c.env.gm["vgl_rcvp_pos"] = { x: 240, y: 88 };
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      t.igual(w.style.left, "240px", "left restaurado de la sesión");
      t.igual(w.style.top, "88px", "top restaurado de la sesión");
      t.igual(w.style.bottom, "auto", "bottom neutralizado al restaurar");

      const c2 = ctx102();
      c2.env.win.innerWidth = 1024;
      c2.env.win.innerHeight = 768;
      c2.env.gm["vgl_rcvp_pos"] = { x: 5000, y: 5000 };   // pantalla rotada desde el arrastre previo
      await c2.api.rcvPendientesTick();
      const w2 = widget102(c2);
      t.igual(w2.style.left, "928px", "posición vieja fuera de rango: clampada al borde derecho");
      t.igual(w2.style.top, "720px", "y al fondo (768-48)");
    });

    await t.casoAsync("el botón de cierre jamás inicia el arrastre (y fuera de la barra tampoco)", async () => {
      const c = ctx102();
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      w.getBoundingClientRect = () => ({ left: 16, top: 500, width: 330, height: 220 });
      const btn = w.querySelector(".vgl-rcvp-cerrar");
      disparar102(c, w, "pointerdown", { target: btn, clientX: 50, clientY: 50, pointerId: 2 });
      t.falso(w.classList.contains("vgl-rcvp-arrastrando"), "sin agarre desde el botón de cierre");
      t.igual(w.style.left || "", "", "ni posición tocada");
      const fila = w.querySelector(".vgl-rcvp-fila");
      t.cierto(!!fila, "precondición: hay filas pintadas");
      disparar102(c, w, "pointerdown", { target: fila, clientX: 50, clientY: 50, pointerId: 3 });
      t.falso(w.classList.contains("vgl-rcvp-arrastrando"), "fuera de la barra superior tampoco arrastra");
      // v18.8.6 — el botón de minimizar tampoco inicia el arrastre (misma guarda
      // que el cierre: la barra es la ÚNICA zona de agarre).
      const minBtn = w.querySelector(".vgl-rcvp-min");
      t.cierto(!!minBtn, "precondición: hay botón de minimizar");
      disparar102(c, w, "pointerdown", { target: minBtn, clientX: 50, clientY: 50, pointerId: 4 });
      t.falso(w.classList.contains("vgl-rcvp-arrastrando"), "el botón de minimizar tampoco inicia el arrastre");
    });

    // ==================== INTEGRACIÓN: MINIMIZAR / REABRIR (v18.8.6) ====================
    const pill102 = (c) => Array.prototype.find.call(c.env.doc.body.children, (e) => e.id === "vgl-rcv-pendientes-pill") || null;

    await t.casoAsync("minimizar: el botón «—» baja el panel a la pastilla y ningún tick lo resucita (ni con datos nuevos)", async () => {
      const c = ctx102();
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      t.cierto(!!w, "precondición: panel montado");
      const min = w.querySelector(".vgl-rcvp-min");
      t.cierto(!!min, "el botón de minimizar existe");
      t.igual(min.getAttribute("type"), "button", "botón nativo: Enter y Espacio sin código propio");
      t.igual(min.getAttribute("aria-label"), "Minimizar el panel de próximos exámenes", "nombre accesible del minimizar");
      disparar102(c, w, "click", { target: min });
      t.igual(w.style.display, "none", "el clic minimizó el panel");
      t.cierto(!!pill102(c), "la pastilla de reapertura apareció");
      await c.api.rcvPendientesTick();
      t.igual(w.style.display, "none", "el tick no resucita el panel minimizado");
      t.cierto(!!pill102(c), "la pastilla sigue (única: asegurar es idempotente)");
      try { c.api.mtrCacheResumenGuardar("5150076", { ...resumen102(), programa: "DM2" }); } catch (e) {}
      await c.api.rcvPendientesTick();
      t.igual(w.style.display, "none", "ni con contenido nuevo resucita mientras esté minimizado");
      try { c.api.mtrCacheResumenGuardar("5150076", resumen102()); } catch (e) {}
    });

    await t.casoAsync("reapertura: la pastilla devuelve el panel con los datos del paciente ABIERTO ahora (no del anterior)", async () => {
      const c = ctx102();
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      disparar102(c, w, "click", { target: w.querySelector(".vgl-rcvp-min") });
      // Cambia de paciente MIENTRAS el panel está minimizado: al reabrir, nada
      // del paciente anterior puede salir a pantalla (guard anti-cruce).
      cablear102(c, "5150077");
      try { c.api.mtrCacheResumenGuardar("5150077", { ...resumen102(), _docId: "5150077", programa: "DM2" }); } catch (e) {}
      const pill = pill102(c);
      t.cierto(!!pill, "precondición: pastilla presente");
      disparar102(c, pill, "click", { target: pill });
      t.falso(!!pill102(c), "la pastilla se retira al pulsarla");
      await c.api.rcvPendientesTick();
      t.igual(widget102(c).style.display, "", "el panel volvió a la vista");
      const prog = widget102(c).querySelector(".vgl-rcvp-prog");
      t.cierto(!!prog && prog.textContent.indexOf("Diabetes tipo 2") >= 0, "repinta con el programa del paciente actual");
    });

    await t.casoAsync("cierre y minimizado conviven: cerrar desarma el minimizado y su pastilla", async () => {
      const c = ctx102();
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      disparar102(c, w, "click", { target: w.querySelector(".vgl-rcvp-min") });
      t.cierto(!!pill102(c), "precondición: minimizado con pastilla");
      const pill = pill102(c);
      disparar102(c, pill, "click", { target: pill });
      await c.api.rcvPendientesTick();
      t.igual(widget102(c).style.display, "", "reabierto");
      disparar102(c, widget102(c), "click", { target: widget102(c).querySelector(".vgl-rcvp-cerrar") });
      t.igual(widget102(c).style.display, "none", "cerrado");
      t.falso(!!pill102(c), "cerrar no deja pastilla");
      // El minimizado quedó desarmado por el cierre: al cambiar de paciente el
      // panel vuelve SOLO (cierre por vista), sin pastilla de por medio.
      cablear102(c, "5150077");
      try { c.api.mtrCacheResumenGuardar("5150077", { ...resumen102(), _docId: "5150077" }); } catch (e) {}
      await c.api.rcvPendientesTick();
      t.igual(widget102(c).style.display, "", "al cambiar de paciente vuelve solo, sin pastilla");
    });

    await t.casoAsync("sin contexto el minimizado se desarma: no queda pastilla huérfana", async () => {
      const c = ctx102();
      await c.api.rcvPendientesTick();
      const w = widget102(c);
      disparar102(c, w, "click", { target: w.querySelector(".vgl-rcvp-min") });
      t.cierto(!!pill102(c), "precondición: minimizado");
      cablear102(c, "");   // sin cédula → sin paciente abierto → la compuerta cae
      await c.api.rcvPendientesTick();
      t.falso(!!pill102(c), "sin contexto la pastilla se retira");
      // Vuelve el contexto: el panel reaparece sin necesitar la pastilla (el
      // minimizado ya estaba desarmado).
      cablear102(c, "5150076");
      await c.api.rcvPendientesTick();
      t.igual(widget102(c).style.display, "", "con contexto de nuevo el panel vuelve directo");
    });

    // ==================== REGRESIÓN DE FUENTE (F1) ====================
    t.caso("fuente (F1): las anclas literales del contrato v18.8.2", () => {
      const anclas = [
        'const RCV_POS_KEY = "vgl_rcvp_pos"',
        'aria-label="Cerrar el panel de próximos exámenes"',
        'title="Arrastrar para mover el panel"',
        'widget.setAttribute("role", "region")',
        'widget.setAttribute("aria-label", "Próximos exámenes")',
        'if (_rcvpCerradoDoc && docId === _rcvpCerradoDoc) { _rcvpOcultar(); return; }',
        'if (e.target.closest && e.target.closest(".vgl-rcvp-cerrar, .vgl-rcvp-min")) return;',
        'uxTrack("widget.proximosExamenes.cerrado")',
        '.vgl-rcvp-cerrar:focus-visible',
        '.vgl-rcvp-head{position:relative;cursor:grab',
        // v18.8.6 — minimizar y reapertura
        'aria-label="Minimizar el panel de próximos exámenes"',
        'if (_rcvpMinimizado) { _rcvpOcultar(); _rcvpPillAsegurar(); return; }',
        'uxTrack("widget.proximosExamenes.minimizado")',
        'uxTrack("widget.proximosExamenes.reabierto")',
        '#vgl-rcv-pendientes .vgl-rcvp-min{',
        '#vgl-rcv-pendientes-pill{',
      ];
      for (const a of anclas) {
        t.cierto(FUENTE.indexOf(a) >= 0, "ancla: " + a.slice(0, 64));
      }
    });

    // v18.12.0 (Mesa de Expertos, callejón dock #5) — rcvPendientesTick(doc) recibía
    // un parámetro fantasma: todo su cuerpo leía `document` global en vez de `doc`,
    // rompiendo el idioma que sí siguen mtrWidgetConductaTick/mtrWidgetOrdenarConductaTick/
    // mtrWidgetFarmacoTick. Se restauró la consistencia (const d = doc || document;) sin
    // cambiar comportamiento en producción (siempre se llama sin argumento).
    t.caso("fuente (F1, v18.12.0): rcvPendientesTick usa `doc` consistentemente, como sus hermanos del dock", () => {
      const iFn = FUENTE.indexOf("async function rcvPendientesTick(doc) {");
      t.cierto(iFn >= 0, "la firma sigue aceptando doc");
      // Límite real: el siguiente miembro del módulo (evita depender de la
      // indentación exacta de la llave de cierre, y del CRLF del archivo).
      const iCierre = FUENTE.indexOf("function _cwoEstadoParaTest", iFn);
      t.cierto(iCierre > iFn, "se encontró el siguiente miembro tras rcvPendientesTick");
      const cuerpo = FUENTE.slice(iFn, iCierre);
      t.cierto(cuerpo.indexOf("const d = doc || document;") >= 0, "el parámetro doc ya no es fantasma: se usa (con respaldo a document)");
      t.falso(/[^.]document\./.test(cuerpo.replace("const d = doc || document;", "")), "ninguna lectura de DOM del cuerpo usa `document` directo (todas pasan por `d`)");
      t.cierto(cuerpo.indexOf("d.getElementById(\"vgl-rcv-pendientes\")") >= 0, "getElementById vía d");
      t.cierto(cuerpo.indexOf("d.createElement(\"div\")") >= 0, "createElement vía d");
      t.cierto(cuerpo.indexOf("d.body.appendChild(widget)") >= 0, "appendChild vía d");
    });
  },
};
