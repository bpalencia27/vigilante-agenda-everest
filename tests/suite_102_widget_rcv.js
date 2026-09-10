// =====================================================================
//  SUITE 102 — v18.14.2: «Pendientes» como ÚNICO hogar de lo pendiente
//  (sección de próximos exámenes RCV + Anexo 5 + su repositorio secundario)
//
//  Encargo del 10-sep-2026. Esta suite protege:
//   1. que los próximos exámenes de riesgo cardiovascular dejen de vivir en
//      un panel flotante propio (v18.8.2) y sean una SECCIÓN EXCLUSIVA del
//      módulo «Pendientes» — el MISMO cuadro que las actividades de PyM, el
//      abandono y los laboratorios (organización uniforme);
//   2. que el Anexo 5 viaje en la MISMA vara (_pendientesUniversales) y
//      aparezca en el aviso central SOLO si el paciente cumple sus criterios
//      de aplicación (a5AlertasDe: índice del libro + abandono + estudios +
//      remisiones + puntaje);
//   3. que el Anexo 5 tenga su REPOSITORIO SECUNDARIO en un modal
//      DIFERENCIADO (#vgl-a5-modal), réplica del archivado de PyM en la
//      pastilla «🩺 Pendientes» del dock: solo lectura, y sin consumir el
//      «ya visto» de la jornada (es el médico quien lo pide);
//   4. que del panel flotante retirado no quede rastro (ni id, ni arrastre,
//      ni pastilla de reapertura, ni posición de sesión).
//
//  La v18.8.2 protegía el cierre, el arrastre y el minimizado de ese panel.
//  Ese contrato murió con el panel; esta suite lo reemplaza por el del
//  encargo, sin dejar de exigir lo mismo que él exigía: que el dato salga de
//  UNA sola vara y que nada se invente cuando falta.
//
//  v18.14.3 — FASES 1 A 3 DEL COMITÉ (acta en docs/REGISTRO_DECISIONES.md y hoja de
//  ruta en docs/HOJA_DE_RUTA_ANEXO5.md):
//    · 4.1 opción B — el panel del Anexo 5 DENTRO de la historia clínica se retiró
//      (era la tercera superficie del mismo dato): el anexo vive en la sección del
//      aviso de la jornada y en su repositorio 📋 a un clic;
//    · 4.2 — el aviso lleva UNA línea resumen y remite al repositorio: el aviso de
//      entrada es una interrupción y no debe pesar como un informe;
//    · 4.5 — el índice del anexo se actualiza SOLO en las ventanas de 06:00 y 12:00
//      de Bogotá (UTC-5 fijo), porque es una hoja del mismo libro que refresca ahí.
// =====================================================================

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const FUENTE = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

const LISTA_102 = {
  version: "2026-09-10.1",
  perfiles: {
    COMPLETO: [{ uid: 101, nombre: "Brandon Jesús Palencia Martínez" }],
    LABORATORIOS: [{ uid: 201, nombre: "Maryuris Terán" }],
  },
  blocklist: [{ uid: 999, nombre: "Prueba Bloqueada Uno" }],
};

const HOY = "2026-09-06";
const DAY_MS = 86400000;
const msDe = (iso) => new Date(iso + "T00:00:00").getTime();
const isoDe = (ms) => {
  const d = new Date(ms);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const desdeHoy = (dias) => isoDe(msDe(HOY) + dias * DAY_MS);
// Serial Excel del día del fixture: a5AlertasDe juzga el abandono contra el reloj.
const SERIAL_HOY = Math.floor((msDe(HOY) - Date.UTC(1899, 11, 30)) / DAY_MS);

const ordenDe = (codigo, fechaIso) => ({ cup: { codigo: codigo }, fechaCreacion: fechaIso + "T08:15:00-05:00" });

function resumen102() {
  return {
    programa: "HTA", factores: { hta: true },
    erc: { egfr: 80 }, riesgo: { categoria: "bajo" },
    _docId: "5150076", _pacienteIdLabs: 777,
  };
}

// Entrada del índice del libro (state.pymAnexo5) que cumple TODOS los criterios
// de aplicación: control hace 200 días (>183 → abandono), EKG sin hacer, las seis
// metas de laboratorio en cero y sin fecha, una consulta por remitir y puntaje
// por debajo del mínimo del programa.
function a5Entrada102() {
  return {
    prog: "Riesgo cardiovascular",
    ctrl: SERIAL_HOY - 200,
    ekg: 0,
    m: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
    v: [130, 80, 96, 7.2, 140, 110, 0],
    suma: 60,
    rem: ["NUTRICIÓN"],
  };
}

// Cablea la historia clínica abierta por cédula (mismo patrón de suite_88): el
// tick de producción lee la cédula del DOM real de Everest, no de un parámetro.
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

// Reloj congelado en hora de BOGOTÁ (patrón de suite_92): bogotaAhora() lee getUTC* sobre
// (Date.now() − 5 h), así que fijando el instante UTC exacto (hora Bogotá + 5 h) la prueba
// no depende del huso del equipo que corre el banco — que es justo lo que la ventana promete.
function congelarBogota102(c, dia, hora) {
  const t = new Date(dia + "T" + hora + ":00Z").getTime() + 5 * 60 * 60 * 1000;
  const F = class extends Date {
    static now() { return t; }
    constructor(...args) { if (args.length === 0) super(t); else super(...args); }
  };
  c.env.win.Date = F;
  c.ctx.Date = F;
  return t;
}

module.exports = {
  nombre: "Pendientes (v18.14.3): la sección RCV y el Anexo 5 viven dentro del módulo, sin panel flotante propio",

  cubre: ["a5AlertasDe", "a5FilasHtml", "a5ResumenLinea", "abrirAnexo5Modal", "avisoUniversal",
    "_pendientesUniversales", "rcvPendientesTick", "rcvPendientesFilasHtml",
    "togActiva", "togSet", "mtrCacheResumenGuardar", "_ordenesVigentesInvalidar",
    "baseVentanaRefresco", "bogotaAhora", "obsPresupuestoEstado"],

  async pruebas(t, api, env, cargar) {
    function ctx102(extra) {
      const ex = extra || {};
      const red = {
        cuerpo: [ordenDe("903815", desdeHoy(-200)), ordenDe("903817", desdeHoy(-179))],
        fetches: 0,
      };
      red.fetch = (url) => {
        red.fetches++;
        return Promise.resolve({
          ok: true, status: 200, headers: { get: () => "application/json" },
          json: () => Promise.resolve(red.cuerpo), text: () => Promise.resolve("[]"),
        });
      };
      const c = cargar({
        silencioso: true,
        almacen: { vgl_acceso_lista: JSON.stringify(LISTA_102) },
        fetch: red.fetch,
        gmxhr: (o) => o.onerror(new Error("sin red")),
      });
      c.api.__state.activeDoctor.id = 101;
      c.api.__state.activeDoctor.name = "Brandon Jesús Palencia Martínez";
      const cedula = ex.cedula === undefined ? "5150076" : ex.cedula;
      cablear102(c, cedula);
      try { c.api.mtrCacheResumenGuardar("5150076", resumen102()); } catch (e) {}
      // Índice del Anexo 5: en producción lo llena la cosecha del libro; aquí se siembra.
      try {
        c.api.__state.pymAnexo5 = new Map(ex.sinA5 ? [] : [["5150076", a5Entrada102()]]);
      } catch (e) {}
      // Reloj congelado en el fixture (patrón suite_88/suite_94): el tick de producción
      // usa new Date() real y la vigencia de los exámenes no debe depender de la corrida.
      vm.runInContext(
        "var __VGL102_DATE_ORIG = Date;" +
        "Date = class extends __VGL102_DATE_ORIG {" +
        "  constructor(){ super(...(arguments.length ? arguments : [" + msDe(HOY) + "])); }" +
        "  static now(){ return " + msDe(HOY) + "; }" +
        "};",
        c.ctx
      );
      return { c: c, red: red };
    }

    const modal102 = (c, id) => {
      try { return c.env.doc.getElementById(id); } catch (e) { return null; }
    };

    // ============ UNIDAD: CRITERIOS DE APLICACIÓN DEL ANEXO 5 ============
    t.caso("a5AlertasDe: abandono por control, estudios pendientes, remisiones y puntaje — y null para quien no está en el índice", () => {
      const est = { pymAnexo5: new Map([["5150076", a5Entrada102()]]), pymAbandono: new Set() };
      const d = api.a5AlertasDe("5150076", est, SERIAL_HOY);
      t.cierto(!!d, "el paciente del índice tiene Anexo 5");
      t.igual(d.prog, "Riesgo cardiovascular");
      t.cierto(!!d.abandono && d.abandono.sinControl === true, "200 días sin control: abandono por la regla de >183 días");
      t.falso(d.abandono.pes, "no está marcado como abandonado en la base de citas");
      t.cierto(d.pendientes.indexOf("EKG (sin realizar)") >= 0, "el EKG sin fecha es estudio pendiente");
      t.igual(d.pendientes.length, 7, "las seis metas de laboratorio en cero también");
      t.igual(d.remitir.join(","), "NUTRICIÓN", "la consulta por remitir viaja tal cual");
      t.igual(d.suma, 60);
      t.falso(d.cumpleSuma, "60 < 75: por debajo del mínimo del programa");
      t.igual(d.contexto.ta, "130/80", "el contexto trae la TA real");
      t.igual(d.contexto.rac, 0, "sin RAC indexado no se pinta el tramo");
      // Criterio de aplicación: quien no está en el índice NO tiene anexo
      t.igual(api.a5AlertasDe("0000000", est, SERIAL_HOY), null, "fuera del índice: sin Anexo 5");
      t.igual(api.a5AlertasDe("", est, SERIAL_HOY), null, "sin cédula: sin Anexo 5");
      t.igual(api.a5AlertasDe("5150076", {}, SERIAL_HOY), null, "sin índice cargado: sin Anexo 5 (nunca se inventa)");
      // El borde del abandono: un día menos NO es abandono
      const casi = a5Entrada102(); casi.ctrl = SERIAL_HOY - 183;
      const d2 = api.a5AlertasDe("5150076", { pymAnexo5: new Map([["5150076", casi]]) }, SERIAL_HOY);
      t.falso(!!d2.abandono, "183 días exactos no superan el umbral (>183)");
    });

    t.caso("a5FilasHtml: el detalle del anexo se arma UNA sola vez — el aviso y el modal dicen lo mismo", () => {
      const d = api.a5AlertasDe("5150076", { pymAnexo5: new Map([["5150076", a5Entrada102()]]) }, SERIAL_HOY);
      const html = api.a5FilasHtml(d);
      t.cierto(html.indexOf("ABANDONO DEL PROGRAMA") >= 0, "la fila de abandono");
      t.cierto(html.indexOf("Estudios pendientes de ordenar") >= 0, "la fila de estudios pendientes");
      t.cierto(html.indexOf("Consultas por remitir") >= 0, "la fila de remisiones");
      t.cierto(html.indexOf("Puntaje de metas: 60/75 — por debajo del mínimo") >= 0, "el puntaje contra el mínimo");
      t.cierto(html.indexOf("TA 130/80") >= 0, "la línea de contexto clínico");
      t.falso(html.indexOf("5150076") >= 0, "cero PHI: la cédula no entra en las filas");
      t.igual(api.a5FilasHtml(null), "", "sin datos no hay filas (casilla vacía antes que dato inventado)");
      // Cumplir el puntaje cambia la frase, no el hecho
      const cumple = a5Entrada102(); cumple.suma = 80;
      const d3 = api.a5AlertasDe("5150076", { pymAnexo5: new Map([["5150076", cumple]]) }, SERIAL_HOY);
      t.cierto(api.a5FilasHtml(d3).indexOf("Puntaje de metas: 80/75 — cumple") >= 0, "80/75 se rotula «cumple»");
    });

    // ============ INTEGRACIÓN: ANEXO 5 EN EL AVISO CENTRAL ============
    t.caso("aviso central (decisión 4.2): el Anexo 5 entra como UNA línea y remite al repositorio", () => {
      const { c } = ctx102();
      const d = c.api.a5AlertasDe("5150076", c.api.__state, SERIAL_HOY);
      t.cierto(!!d, "precondición: el paciente tiene Anexo 5");
      // La línea resumen es PURA y cuenta solo lo que a5AlertasDe ya resolvió
      const linea = c.api.a5ResumenLinea(d);
      t.cierto(linea.indexOf("abandono del programa") >= 0, "la línea nombra el abandono");
      t.cierto(linea.indexOf("puntaje de metas 60/75 — por debajo del mínimo") >= 0, "y el puntaje contra el mínimo");
      t.cierto(linea.indexOf("7 estudios pendientes de ordenar") >= 0, "y cuántos estudios faltan");
      t.cierto(linea.indexOf("1 consulta por remitir") >= 0, "y la remisión pendiente (en singular: es una)");
      t.falso(linea.indexOf("5150076") >= 0, "cero PHI en la línea");
      const pintó = c.api.avisoUniversal("PACIENTE DE PRUEBA", { anexo5: d }, true);
      t.cierto(pintó, "el aviso se pintó");
      const m = modal102(c, "vgl-pym-modal");
      t.cierto(!!m, "existe el cuadro central");
      t.cierto(m.innerHTML.indexOf("Anexo 5 · Riesgo cardiovascular") >= 0, "la sección del anexo está dentro del mismo cuadro");
      t.cierto(m.innerHTML.indexOf("puntaje de metas 60/75 — por debajo del mínimo") >= 0, "con la línea resumen, no con el informe");
      t.cierto(m.innerHTML.indexOf("pastilla") >= 0, "y remite al repositorio secundario");
      // El aviso de entrada es una INTERRUPCIÓN: el detalle completo NO viaja aquí
      t.falso(m.innerHTML.indexOf("Estudios pendientes de ordenar") >= 0, "el detalle de filas ya no interrumpe: se pide a un clic");
      t.falso(m.innerHTML.indexOf("Puntaje de metas:") >= 0, "ni la fila del puntaje del informe");
    });

    t.caso("aviso central: sin Anexo 5 (o con el interruptor apagado) la sección no existe", () => {
      const { c } = ctx102({ sinA5: true });
      t.igual(c.api._pendientesUniversales("5150076").anexo5, null, "sin entrada en el índice no hay anexo en la vara");
      const vacio = c.api.avisoUniversal("PACIENTE DE PRUEBA", { pym: ["Tamización VIH"] }, true);
      t.cierto(vacio, "el aviso se pintó por PyM");
      const m = modal102(c, "vgl-pym-modal");
      t.cierto(!!m && m.innerHTML.indexOf("Anexo 5") < 0, "nada de Anexo 5 en el cuadro: no se inventa la sección");
      // Interruptor propio (tog_anexo5, hijo de tog_notif): apagado, la sección desaparece
      const { c: c2 } = ctx102();
      t.cierto(!!c2.api._pendientesUniversales("5150076").anexo5, "precondición: con el interruptor encendido hay anexo");
      c2.api.togSet("tog_anexo5", false);
      t.falso(c2.api.togActiva("tog_anexo5"), "el interruptor quedó apagado");
      t.igual(c2.api._pendientesUniversales("5150076").anexo5, null, "apagado, la vara ya no trae el anexo");
    });

    // ============ INTEGRACIÓN: REPOSITORIO SECUNDARIO (MODAL DIFERENCIADO) ============
    t.caso("repositorio en reposo: #vgl-a5-modal es un cuadro DIFERENCIADO, de solo lectura, y no consume el «ya visto»", () => {
      const { c } = ctx102();
      const d = c.api._pendientesUniversales("5150076").anexo5;
      t.cierto(!!d, "precondición: hay Anexo 5 en la vara");
      const abrió = c.api.abrirAnexo5Modal(d);
      t.cierto(abrió, "el modal se abrió");
      const m = modal102(c, "vgl-a5-modal");
      t.cierto(!!m, "existe el modal diferenciado (id propio, hermano del aviso central)");
      t.igual(m.getAttribute("role"), "dialog", "es un diálogo, no una alerta que interrumpe");
      t.igual(m.getAttribute("aria-modal"), "true");
      t.igual(m.getAttribute("aria-label"), "Anexo 5 del programa de riesgo cardiovascular", "nombre accesible propio");
      t.cierto(m.innerHTML.indexOf("Anexo 5 · Riesgo cardiovascular") >= 0, "título del anexo");
      t.cierto(m.innerHTML.indexOf("Puntaje de metas: 60/75") >= 0, "el MISMO detalle que el aviso central");
      t.cierto(m.innerHTML.indexOf("Solo lectura") >= 0, "declara que el Vigilante no escribe nada");
      t.cierto(m.innerHTML.indexOf("Cerrar") >= 0, "un único botón de cierre");
      t.falso(m.innerHTML.indexOf("5150076") >= 0, "cero PHI: la cédula va enmascarada");
      t.falso(c.api.avisoYaVisto("avisouniv|5150076"), "pedirlo a mano NO consume el aviso automático de la jornada");
      // Reabrir es idempotente: nunca se acumulan cuadros
      c.api.abrirAnexo5Modal(d);
      const cuantos = Array.prototype.filter.call(c.env.doc.body.children, (e) => e && e.id === "vgl-a5-modal").length;
      t.igual(cuantos, 1, "reabrir no acumula modales");
      // Y no se pinta si no hay nada que archivar
      t.falso(c.api.abrirAnexo5Modal(null), "sin datos no hay repositorio");
    });

    // ============ INTEGRACIÓN: SECCIÓN RCV DENTRO DE «PENDIENTES» ============
    await t.casoAsync("sección RCV: los próximos exámenes entran en el MISMO cuadro que PyM, no en un panel aparte", async () => {
      const { c } = ctx102();
      await c.api.rcvPendientesTick();
      const p = c.api._pendientesUniversales("5150076");
      t.cierto(!!(p.rcv && p.rcv.html), "la sección RCV viaja en la misma vara que el resto");
      t.cierto(p.rcv.n > 0, "con el número de exámenes por asignar");
      const pintó = c.api.avisoUniversal("PACIENTE DE PRUEBA", { pym: ["Tamización VIH"], rcv: p.rcv, anexo5: p.anexo5 }, true);
      t.cierto(pintó, "el cuadro de Pendientes se pintó");
      const m = modal102(c, "vgl-pym-modal");
      t.cierto(!!m, "existe UN cuadro, no dos");
      t.cierto(m.innerHTML.indexOf("Próximos exámenes · Riesgo cardiovascular (") >= 0, "la sección RCV está dentro del cuadro");
      t.cierto(m.innerHTML.indexOf("Actividades preventivas por solicitar") >= 0, "junto a las actividades de PyM (organización uniforme)");
      t.cierto(m.innerHTML.indexOf("Anexo 5 · ") >= 0, "y junto al Anexo 5");
      t.cierto(m.innerHTML.indexOf("vgl-rcvp-fila") >= 0, "las filas salen del constructor único");
      t.cierto(c.api.rcvPendientesFilasHtml({ filas: [], nPendientes: 0, sinDatosOrdenes: true, vigenciaDias: null }, "", "").indexOf("Sin órdenes vigentes consultables") >= 0,
        "y ese constructor es el mismo que la suite 88 vigila por unidad");
      t.falso(!!modal102(c, "vgl-rcv-pendientes"), "no hay panel flotante paralelo");
      // Una orden nueva se refleja sin recargar: la caché de órdenes vigentes se invalida.
      c.api._ordenesVigentesInvalidar();
      await c.api.rcvPendientesTick();
      t.cierto(!!c.api._pendientesUniversales("5150076").rcv, "tras invalidar la caché la sección se recalcula sola");
      // La pastilla 🩺 Pendientes reabre ESE cuadro con la sección incluida
      t.cierto(p.n >= 1, "la vara cuenta la sección para el rótulo de la pastilla");
    });

    await t.casoAsync("sección RCV: fuera de la historia clínica no hay sección que mostrar", async () => {
      const { c } = ctx102();
      await c.api.rcvPendientesTick();
      t.cierto(!!c.api._pendientesUniversales("5150076").rcv, "precondición: armada dentro de la historia");
      // El médico vuelve a la agenda: sin #anamesis, marcadores de agenda presentes.
      const getByIdReal = c.env.doc.getElementById.bind(c.env.doc);
      c.env.doc.getElementById = (id) => (id === "anamesis" ? null : getByIdReal(id));
      const qsReal = c.env.doc.querySelector.bind(c.env.doc);
      c.env.doc.querySelector = (sel) => {
        const s = String(sel);
        if (s === c.api.__CONFIG.SEL.hora || s === c.api.__CONFIG.SEL.estado) return { textContent: "8:00 a. m." };
        return qsReal(sel);
      };
      await c.api.rcvPendientesTick();
      t.igual(c.api._pendientesUniversales("5150076").rcv, null, "en Citas del día la sección desaparece de la vara");
    });

    // ============ VENTANA DE REFRESCO (DECISIÓN 4.5 DEL COMITÉ) ============
    t.caso("ventana de refresco (decisión 4.5): el Anexo 5 se actualiza SOLO en las 06:00 y 12:00 de Bogotá (UTC-5)", () => {
      const { c } = ctx102();
      // (a) la ventana declarada es exactamente 06:00 y 12:00
      t.igual(c.api.__CONFIG.SP.base.horasRefresco.join(","), "6,12", "solo dos ventanas: 06:00 y 12:00");
      // (b) el índice del Anexo 5 es una HOJA del mismo libro que refresca esa ventana:
      // no hay una descarga propia del anexo que pueda correr a otra hora.
      t.igual(c.api.__CONFIG.SP.base.sheetAnexo5, "ANEXO", "el anexo viaja en el libro del refresco");
      // (c) bordes del reloj de Bogotá: ni antes de las 06:00 ni en el cambio de día hay
      // ventana abierta. El reloj se congela en hora Bogotá (no depende del huso del equipo).
      const v = (dia, hora) => { congelarBogota102(c, dia, hora); return c.api.baseVentanaRefresco(); };
      t.igual(v("2026-09-08", "05:59"), { sello: "2026-09-08|pre", toca: false }, "05:59: aún no abre la mañana");
      t.igual(v("2026-09-08", "06:00"), { sello: "2026-09-08|0", toca: true }, "06:00: abre la ventana de la mañana");
      t.igual(v("2026-09-08", "11:59"), { sello: "2026-09-08|0", toca: true }, "11:59: sigue vigente la de la mañana");
      t.igual(v("2026-09-08", "12:00"), { sello: "2026-09-08|1", toca: true }, "12:00: abre la ventana de la tarde");
      t.igual(v("2026-09-08", "23:59"), { sello: "2026-09-08|1", toca: true }, "23:59: la tarde sigue vigente");
      t.igual(v("2026-09-09", "00:30"), { sello: "2026-09-09|pre", toca: false }, "día nuevo antes de las 06:00: sin ventana");
      // (d) la hora la calcula el reloj de Bogotá, no el del equipo: a las 06:00 de Bogotá
      // (11:00 UTC) la ventana ya abrió aunque el host esté en otra zona.
      congelarBogota102(c, "2026-09-08", "06:00");
      t.igual(c.api.bogotaAhora().hora, 6, "bogotaAhora() dice 06:00 en Bogotá");
      // (e) INVARIANTE DE FUENTE: ninguna otra ruta automática instala el índice. Cada
      // asignación de `state.pymAnexo5` ocurre pegada a la del resto del libro
      // (`state.pym =`), o sea dentro de la carga —caché, descarga o adopción manual—,
      // nunca por su cuenta ni a otra hora.
      const lineas = FUENTE.split("\n");
      const sueltas = [];
      let instalaciones = 0;
      for (let i = 0; i < lineas.length; i++) {
        if (lineas[i].indexOf("state.pymAnexo5 =") < 0) continue;
        instalaciones++;
        const vecindad = lineas.slice(Math.max(0, i - 2), i + 3).join(" ");
        if (vecindad.indexOf("state.pym =") < 0) sueltas.push(String(i + 1));
      }
      t.cierto(instalaciones >= 3, "el índice se instala en los tres caminos de carga del libro (caché, descarga, adopción)");
      t.igual(sueltas.join(","), "", "el anexo se instala SIEMPRE junto al resto del libro (líneas sueltas: " + sueltas.join(",") + ")");
    });

    // ============ PRESUPUESTO DE INTERRUPCIONES (DECISIÓN 4.4, APROBADA) ============
    t.caso("presupuesto (decisión 4.4, aprobada): el Anexo 5 sigue SUJETO al tope diario, y el nivel 3 conserva su significado", () => {
      const { c } = ctx102();
      const d = c.api._pendientesUniversales("5150076").anexo5;
      t.cierto(!!d, "precondición: hay Anexo 5 para el paciente");
      // (a) La decisión aprobada, tal como quedó en el código: el anexo NO está exento.
      t.cierto(FUENTE.indexOf("const exentoR3 = !!(abandono || prioridadRcv);") >= 0,
        "la exención del nivel 3 sigue siendo exactamente abandono RCV + prioridadRcv");
      t.falso(/const exentoR3 = [^;]*anexo5/.test(FUENTE),
        "el anexo NO entra en la exención (es lo que el comité aprobó el 10-sep-2026)");
      // (b) Con el tope agotado, el anexo por sí solo NO interrumpe…
      c.api.__S.obsPresupuestoAvisos = 1;
      t.cierto(c.api.avisoUniversal("PACIENTE DE PRUEBA", { pym: ["Tamización VIH"] }, false) === true,
        "el primer aviso del día consume el único cupo y se pinta");
      t.falso(c.api.avisoUniversal("PACIENTE DE PRUEBA", { anexo5: d }, false),
        "con el cupo agotado, un aviso que SOLO trae el anexo queda suprimido: está sujeto al tope");
      // …pero el nivel 3 sí pasa: la exención no se contaminó al aprobar el 4.4.
      t.cierto(c.api.avisoUniversal("PACIENTE DE PRUEBA", { abandono: true }, false) === true,
        "el abandono del programa (nivel 3) sigue siendo inmune al tope");
      // (c) El cupo no se consume de más: el aviso exento no gasta, y el suprimido tampoco.
      const st = c.api.obsPresupuestoEstado();
      t.igual(st.limite, 1, "el tope es el que fijó el médico (S.obsPresupuestoAvisos)");
      t.igual(st.usados, 1, "solo el aviso que se pintó consumió cupo");
    });

    // ============ FUENTE: EL CONTRATO DEL ENCARGO ============
    t.caso("fuente (F1): la pastilla 📋 Anexo 5, el modal diferenciado y el panel flotante retirado sin rastro", () => {
      const anclas = [
        'bA5.setAttribute("data-accion", "anexo5")',
        '_vglDockRotulo(bA5, "📋", "Anexo 5")',
        "if (_p5 && _p5.anexo5) abrirAnexo5Modal(_p5.anexo5)",
        '(_pendDock && _pendDock.anexo5) ? "A5" : "a5"',
        "anexo5: _p.anexo5, rcv: _p.rcv",
        'ov.id = "vgl-a5-modal"',
        'ov.setAttribute("role", "dialog")',
        "a5FilasHtml(datos) +",
        "if (rcv && rcv.html) {",
        "anexo5: anexo5,",
        "rcv: rcv,",
      ];
      for (const a of anclas) t.cierto(FUENTE.indexOf(a) >= 0, "ancla: " + a.slice(0, 64));
      // El censo mira CÓDIGO, no prosa: las notas de la retirada nombran a propósito lo que
      // se fue, y el censo de texto crudo las contaría como si siguieran vivas.
      const codigo = FUENTE.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      for (const muerto of ["vgl-rcv-pendientes", "vgl_rcvp_pos", "rcvPendientesClamparPos", "_rcvpPillAsegurar", "_rcvpMinimizar", "rcvPendientesHtml"]) {
        t.falso(codigo.indexOf(muerto) >= 0, "sin rastro del panel retirado: " + muerto);
      }
      // v18.14.4 — retirados por orden del médico: la opción de 90 días de «Exámenes» con su
      // filtro, el menú de elección que ya no decidía nada, y los dos avisos AMBAR.
      for (const muerto of ["_mtrLabsRecientes", "MTR_LABS_VENTANA_RECIENTE_DIAS", 'id: "ultima"', "VGL_ROTULOS.examenes", "Se agregó parte de lo pendiente", "Exámenes · sin casilla"]) {
        t.falso(codigo.indexOf(muerto) >= 0, "sin rastro de lo retirado en v18.14.4: " + muerto);
      }
      // v18.14.3 (4.1 opción B) — el panel del anexo DENTRO de la historia también se
      // retiró: ni función, ni nodo, ni su barra de Deshacer, ni su región aria-live.
      for (const muerto of ["hcAnexo5Render", "vgl-a5-panel", "vgl-a5-deshacer", "vgl-a5-live", "_vglA5Cerrados", "_vglA5Anunciado"]) {
        t.falso(codigo.indexOf(muerto) >= 0, "sin rastro del panel del anexo en la HC: " + muerto);
      }
      // El cuadro que hospeda las tres secciones está declarado en las listas de cascada
      t.cierto(FUENTE.indexOf('"vgl-a5-modal"') >= 0, "el modal del anexo está en VGL_MODALES_CONSULTA (clic-fuera)");
    });
  },
};
