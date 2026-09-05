"use strict";
// ══════════════════════════════════════════════════════════════════════
// Suite 84 — v18.3 (P12) · Saneamiento: constantes muertas retiradas y
// cuarentena con marcador zombi. Suite ESTRUCTURAL (como 04/06/08/23):
// lee la fuente de producción y fija lo que el saneamiento hizo Y lo que
// deliberadamente no hizo:
//   A. PYM_SIN_ACT_MOTIVOS y MTR_SEVERIDAD_RIESGO: constantes sin ningún
//      lector (grep de uso: solo su definición) — retiradas.
//   B. La memoria del proyecto NO se borra: los bloques de comentario
//      histórico que vivían dentro de esas constantes quedan re-hospedados
//      junto a sus funciones vivas.
//   C. mtrIaClickDelegado / mtrIrAPestanaPorNombre / _mtrPrimerCampoNumerico:
//      EN CUARENTENA (no borradas) con uxTrack("zombi.<nombre>") como
//      primera línea — si un "muerto" disparara en consultorio, la
//      telemetría lo delata. Exactamente tres marcadores, ni uno más.
//   D. Lo que la F1 (tests vivos) protege, se queda: si alguien borra una
//      de estas piezas con suite propia, esta suite cae en rojo.
// Los defectos encontrados (botón #vgl-ia-redactar sin listener,
// CANCEL_PLANTILLA_KEY que nunca se limpia, _deshacerOrdenesPyM sin
// llamador) se REPORTAN en docs/SANEAMIENTO.md: arreglarlos cambia
// comportamiento visible y eso P12 no lo toca.
// ══════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");

// Ventana de la fuente inmediatamente posterior a una declaración: sirve
// para exigir que el marcador zombi sea la PRIMERA línea del cuerpo sin
// depender de si el archivo usa LF o CRLF.
function ventana(declaracion, n) {
  const i = src.indexOf(declaracion);
  if (i < 0) return "";
  return src.slice(i, i + (n || 160));
}

module.exports = {
  nombre: "Suite 84 · v18.3 (P12): saneamiento (constantes muertas + cuarentena zombi)",
  cubre: ["pymMotivoSinActividades", "mtrClasificarRiesgoCv", "mtrIaClickDelegado", "mtrIrAPestanaPorNombre", "_mtrPrimerCampoNumerico"],
  async pruebas(t, api, env, cargar) {
    t.caso("P12·1 — las dos constantes sin lector salen de la fuente", () => {
      t.cierto(src.indexOf("const PYM_SIN_ACT_MOTIVOS") < 0, "PYM_SIN_ACT_MOTIVOS (duplicaba en array los literales que pymMotivoSinActividades devuelve en línea) ya no se declara");
      t.cierto(src.indexOf("const MTR_SEVERIDAD_RIESGO") < 0, "MTR_SEVERIDAD_RIESGO (mapa de severidad sin ningún lector) ya no se declara");
    });

    t.caso("P12·2 — la memoria histórica sobrevive re-hospedada junto a su función viva", () => {
      const c43 = src.indexOf("v18.0.43 — los dos motivos que aparecen cuando el paciente no está en la oficial");
      const c139 = src.indexOf("v18.0.139 — y los dos de cuando el RESPALDO es la base activa");
      const fnPym = src.indexOf("function pymMotivoSinActividades(est)");
      t.cierto(c43 >= 0 && fnPym >= 0 && c43 < fnPym && (fnPym - c43) < 1600, "el bloque v18.0.43 de motivos de respaldo queda pegado a pymMotivoSinActividades (no se borró con la constante)");
      t.cierto(c139 >= 0 && c139 < fnPym && (fnPym - c139) < 1600, "el bloque v18.0.139 (pedido del médico 4-sep, base piloto) queda pegado a pymMotivoSinActividades");
      const cSev = src.indexOf("Orden de severidad");
      const fnClas = src.indexOf("function mtrClasificarRiesgoCv(f)");
      t.cierto(cSev >= 0 && fnClas >= 0 && cSev < fnClas && (fnClas - cSev) < 900, "el comentario del trinquete de severidad queda re-hospedado sobre mtrClasificarRiesgoCv (donde el orden vive de verdad)");
    });

    t.caso("P12·3 — cuarentena: las tres funciones siguen definidas y su primera línea es el marcador zombi", () => {
      t.cierto(ventana("function mtrIaClickDelegado(e)").indexOf('uxTrack("zombi.mtrIaClickDelegado")') >= 0, "mtrIaClickDelegado arranca con uxTrack(\"zombi.mtrIaClickDelegado\")");
      t.cierto(ventana("function mtrIrAPestanaPorNombre(pestania, doc)").indexOf('uxTrack("zombi.mtrIrAPestanaPorNombre")') >= 0, "mtrIrAPestanaPorNombre arranca con uxTrack(\"zombi.mtrIrAPestanaPorNombre\")");
      t.cierto(ventana("function _mtrPrimerCampoNumerico(nombres, doc)").indexOf('uxTrack("zombi._mtrPrimerCampoNumerico")') >= 0, "_mtrPrimerCampoNumerico arranca con uxTrack(\"zombi._mtrPrimerCampoNumerico\")");
      t.cierto(src.split('uxTrack("zombi.').length - 1 === 3, "exactamente tres marcadores zombi en la fuente (ni uno de más: cada marcador es una promesa de borrado futuro)");
    });

    t.caso("P12·4 — lo que la F1 protege se queda (constantes clínicas y funciones con suites vivas)", () => {
      // declara(): exige el NOMBRE EXACTO como declaración (const/function + límite
      // de palabra + asignación/paréntesis) — un renombre a <nombre>_MUTANTE NO
      // puede colarse por substring (falló así la primera mutación M3 de P12).
      const declara = (frag) => new RegExp(frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9_])").test(src);
      t.cierto(declara("const MTR_CORRECCIONES_NORMA ="), "MTR_CORRECCIONES_NORMA se queda: es documentación ejecutable de correcciones clínicas con fuente citada");
      t.cierto(declara("const CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO"), "CUPS_ESCRITURA_RENAL_PENDIENTE_ESTADIO se queda: la consumen harness y suites 08/32");
      t.cierto(declara("const VGL_MODALES_ESCRITURA"), "VGL_MODALES_ESCRITURA se queda: la consumen harness y suite_15");
      t.cierto(declara("function mtrRenderResumenClinicoHtml"), "mtrRenderResumenClinicoHtml se queda: suite_47 la ejercita");
      t.cierto(declara("function mtrSumarDiasHabiles"), "mtrSumarDiasHabiles se queda: suite_43 + golden json");
      t.cierto(declara("function _pesoDeSignosVitales"), "_pesoDeSignosVitales se queda: suites 29/34 la ejercitan");
      t.cierto(declara("function apiDigiturnoFinalizarTicket"), "apiDigiturnoFinalizarTicket se queda: suite_13 la ejercita");
      t.cierto(declara("function _noShowPrevia"), "_noShowPrevia se queda: suites 04/68 la llaman (la lista del prompt venía desfasada)");
    });

    t.caso("P12·5 — la vía de cuarentena existe: uxTrack declarado como función", () => {
      t.cierto(src.indexOf("function uxTrack(accion, extra)") >= 0, "uxTrack sigue declarada: sin ella los marcadores zombi serían llamadas a undefined silenciosas");
    });
  },
};
