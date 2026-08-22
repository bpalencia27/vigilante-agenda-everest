// =====================================================================
//  SUITE 52 — Agendamiento "sin terminar" y sonda de anclaje del examen físico
//
//  Dos piezas nuevas, las dos deliberadamente inofensivas:
//   1. El recordatorio "empezó pero no cerró": se marca SOLO cuando el médico ya eligió
//      un turno y cerró sin crear la cita. No toca la red ni dispara avisos; vive en el
//      mismo almacén day-scoped que citas/labs/órdenes y caduca al terminar el día. La
//      regla dura: en cuanto la cita queda agendada, el recordatorio se anula solo — nunca
//      debe seguir molestando a un paciente que ya tiene su cita.
//   2. La sonda de anclaje del examen físico: NO cambia dónde cae el texto de normalidad;
//      solo CUENTA qué anclas por-casilla existen, para poder cerrar algún día el VGL-003
//      con datos reales en vez de una suposición. Se fija que solo emite ENTEROS (nunca el
//      valor de una casilla), para que la telemetría no pueda filtrar PHI.
// =====================================================================

// Fabrica una casilla como la vería _examenFisicoAnclas: getAttribute + closest, sin más.
function casilla(attrs) {
  const a = attrs || {};
  return {
    name: a.name || "",
    placeholder: a.placeholder || "",
    getAttribute(k) {
      if (k in a) return a[k];
      if (k === "name") return this.name || null;
      if (k === "placeholder") return this.placeholder || null;
      return null;
    },
    closest() { return null; },
  };
}

module.exports = {
  nombre: "Agendamiento sin terminar y sonda de anclaje del examen físico",
  cubre: [
    "markAgendamientoPendiente", "clearAgendamientoPendiente",
    "isAgendamientoPendiente", "_examenFisicoAnclas",
    "calcBusinessDaysAfter", "perfilRefinadoConResumen", "vglNotificarCompletado",
  ],

  pruebas(t, api, env, cargar) {
    // ============ RECORDATORIO "AGENDAMIENTO SIN TERMINAR" ============

    t.caso("marca un agendamiento sin terminar y lo detecta", () => {
      api.markAgendamientoPendiente("111");
      t.cierto(api.isAgendamientoPendiente("111"), "quedó marcado como pendiente");
    });

    t.caso("clearAgendamientoPendiente lo apaga (cita confirmada, o el médico lo resolvió)", () => {
      api.markAgendamientoPendiente("222");
      t.cierto(api.isAgendamientoPendiente("222"), "primero marcado");
      api.clearAgendamientoPendiente("222");
      t.falso(api.isAgendamientoPendiente("222"), "luego limpio");
    });

    t.caso("crear la cita ANULA el recordatorio aunque no se limpie a mano", () => {
      // isAgendamientoPendiente lleva su propia salvaguarda: si el paciente ya tiene cita
      // hoy, no muestra el recordatorio pase lo que pase. Así un fallo en la limpieza nunca
      // deja molestando a alguien que ya está agendado.
      api.markAgendamientoPendiente("333");
      t.cierto(api.isAgendamientoPendiente("333"), "marcado antes de agendar");
      api.markCitaAgendadaHoy("333", "2026-09-01");
      t.falso(api.isAgendamientoPendiente("333"), "con cita agendada, el recordatorio se calla");
    });

    t.caso("nunca cruza pacientes: marcar a uno no marca a otro", () => {
      api.markAgendamientoPendiente("444");
      t.falso(api.isAgendamientoPendiente("555"), "otro documento no hereda el estado");
    });

    t.caso("documento vacío o nulo: ni marca ni detecta, y no lanza", () => {
      t.noLanza(() => api.markAgendamientoPendiente(""), "marcar vacío no lanza");
      t.noLanza(() => api.markAgendamientoPendiente(null), "marcar nulo no lanza");
      t.falso(api.isAgendamientoPendiente(""), "vacío no está pendiente");
      t.falso(api.isAgendamientoPendiente(null), "nulo no está pendiente");
      t.noLanza(() => api.clearAgendamientoPendiente(null), "limpiar nulo no lanza");
    });

    t.caso("marcar dos veces es idempotente (no se pierde ni se duplica)", () => {
      api.markAgendamientoPendiente("666");
      api.markAgendamientoPendiente("666");
      t.cierto(api.isAgendamientoPendiente("666"), "sigue marcado una sola vez");
      api.clearAgendamientoPendiente("666");
      t.falso(api.isAgendamientoPendiente("666"), "una limpieza basta");
    });

    // ============ SONDA DE ANCLAJE DEL EXAMEN FÍSICO ============

    t.caso("cuenta las anclas presentes por casilla (name / placeholder)", () => {
      const r = api._examenFisicoAnclas([
        casilla({ name: "AntecedentePatologicos.ObsArritmias" }),
        casilla({ name: "AntecedentePatologicos.ObsSoplos", placeholder: "No Refiere" }),
        casilla({ placeholder: "No Refiere" }),
      ]);
      t.igual(r.total, 3, "tres casillas");
      t.igual(r.conName, 2, "dos con name");
      t.igual(r.conPlaceholder, 2, "dos con placeholder");
      t.igual(r.namesDistintos, 2, "dos names distintos");
      t.igual(r.conAlgunAncla, 3, "las tres tienen al menos un ancla");
    });

    t.caso("caso VGL-003: casillas sin NINGÚN ancla -> todo en cero salvo el total", () => {
      // Es exactamente lo que halló el diagnóstico de consultorio: campos que comparten id,
      // sin name/label/placeholder propios. La sonda lo refleja con conAlgunAncla=0, que es
      // la señal de "aquí NO se puede mapear por etiqueta, solo por posición".
      const r = api._examenFisicoAnclas([casilla({}), casilla({}), casilla({})]);
      t.igual(r.total, 3, "cuenta las casillas");
      t.igual(r.conAlgunAncla, 0, "ninguna tiene ancla");
      t.igual(r.conName, 0, "sin name");
      t.igual(r.namesDistintos, 0, "sin names distintos");
    });

    t.caso("aria-label también cuenta como ancla", () => {
      const r = api._examenFisicoAnclas([casilla({ "aria-label": "Corazón" })]);
      t.igual(r.conAria, 1, "un aria-label");
      t.igual(r.conAlgunAncla, 1, "cuenta como ancla");
    });

    t.caso("namesDistintos no cuenta duplicados", () => {
      const r = api._examenFisicoAnclas([
        casilla({ name: "Igual" }), casilla({ name: "Igual" }),
      ]);
      t.igual(r.conName, 2, "dos casillas con name");
      t.igual(r.namesDistintos, 1, "pero un solo name distinto");
    });

    t.caso("entrada no-array devuelve ceros y no lanza", () => {
      t.noLanza(() => api._examenFisicoAnclas(null), "null no lanza");
      t.igual(api._examenFisicoAnclas(null).total, 0, "null -> total 0");
      t.igual(api._examenFisicoAnclas(undefined).conAlgunAncla, 0, "undefined -> 0");
    });

    t.caso("PHI-safe: la sonda SOLO devuelve enteros, jamás una cadena del paciente", () => {
      // Esta es la garantía que hace segura la telemetría: si algún valor dejara de ser un
      // número, podría estar filtrando el contenido de una casilla (dato del paciente).
      const r = api._examenFisicoAnclas([
        casilla({ name: "X", placeholder: "No Refiere", "aria-label": "Y" }),
      ]);
      for (const k of Object.keys(r)) {
        t.igual(typeof r[k], "number", "el campo " + k + " debe ser un entero, no texto");
      }
    });

    // ============ v14.2.0 — LIBRE ELECCIÓN, ANTIDUPLICADOS Y GATILLO ============

    t.caso("calcBusinessDaysAfter: 0 días solo formatea; 1 día salta el fin de semana", () => {
      t.igual(api.calcBusinessDaysAfter("2026-09-15", 0).iso, "2026-09-15", "0 días = la misma fecha (formateada)");
      t.igual(api.calcBusinessDaysAfter("2026-09-01", 1).iso, "2026-09-02", "martes -> miércoles");
      t.igual(api.calcBusinessDaysAfter("2026-09-04", 1).iso, "2026-09-07", "viernes -> lunes (salta sábado y domingo)");
      t.cierto(/^\d{2}\/\d{2}\/\d{4}$/.test(api.calcBusinessDaysAfter("2026-09-04", 1).fmt), "trae el formato dd/mm/aaaa");
    });

    t.caso("perfilRefinadoConResumen: el hipertenso sencillo (controlado, sin exclusiones) CONSERVA los adicionales", () => {
      const p = api.perfilRefinadoConResumen(
        { franja: "sin_preferencia", adicionales: true },
        { factores: { diabetes: false, paSistolica: 128, paDiastolica: 80 }, erc: { egfr: 84 }, riesgo: { categoria: "moderado" }, fallas: { fallas: [], hayGrave: false, hayLeve: false } }
      );
      t.igual(p.adicionales, true, "hipertensión controlada sin diabetes/renal/falla: sigue recomendado");
      t.falso(!!p.motivoNoSencillo, "y sin motivo de exclusión");
    });

    t.caso("perfilRefinadoConResumen: DEGRADA al no-sencillo por renal, riesgo muy alto, falla, presión alta o diabetes", () => {
      const base = () => ({ franja: "sin_preferencia", adicionales: true });
      t.igual(api.perfilRefinadoConResumen(base(), { erc: { egfr: 48 } }).adicionales, false, "TFG<60 degrada");
      t.igual(api.perfilRefinadoConResumen(base(), { riesgo: { categoria: "MUY ALTO" } }).adicionales, false, "riesgo muy alto degrada");
      t.igual(api.perfilRefinadoConResumen(base(), { fallas: { hayLeve: true } }).adicionales, false, "falla terapéutica degrada");
      t.igual(api.perfilRefinadoConResumen(base(), { factores: { paSistolica: 168 } }).adicionales, false, "PA sistólica >=160 degrada");
      t.igual(api.perfilRefinadoConResumen(base(), { factores: { paDiastolica: 104 } }).adicionales, false, "PA diastólica >=100 degrada");
      t.igual(api.perfilRefinadoConResumen(base(), { factores: { diabetes: true } }).adicionales, false, "diabetes en la historia degrada");
      const conMotivo = api.perfilRefinadoConResumen(base(), { erc: { egfr: 42 } });
      t.cierto(/renal/i.test(conMotivo.motivoNoSencillo || ""), "y explica el motivo (alimenta el tooltip del cupo)");
    });

    t.caso("perfilRefinadoConResumen: nunca ASCIENDE, y sin resumen respeta la etiqueta tal cual", () => {
      t.igual(api.perfilRefinadoConResumen({ franja: "primera_mitad", adicionales: false }, { factores: { diabetes: false } }).adicionales, false,
        "el desaconsejado por etiqueta (DM/nefro) JAMÁS se vuelve recomendado");
      t.igual(api.perfilRefinadoConResumen({ adicionales: true }, null).adicionales, true, "sin resumen cacheado: no se afirma lo que no se sabe");
      t.igual(api.perfilRefinadoConResumen(null, null).adicionales, "visibles", "sin perfil ni resumen: neutro");
    });

    t.caso("vglNotificarCompletado: alimenta las marcas del día (la memoria antiduplicados) y no lanza jamás", () => {
      const c = cargar({ silencioso: true });
      c.api.vglNotificarCompletado("cita_control", { doc: "888777666", fechaIso: "2026-09-10", hora: "07:00" });
      t.igual(c.api.citaAgendadaFechaHoy("888777666"), "2026-09-10", "la cita de control queda registrada con su fecha real");
      c.api.vglNotificarCompletado("cita_lab", { doc: "888777666", fechaIso: "2026-09-05" });
      t.cierto(c.api.isLabAgendadaHoy("888777666"), "la toma de muestras queda registrada");
      t.noLanza(() => c.api.vglNotificarCompletado("tipo_desconocido", null), "tipo raro sin detalle: no lanza");
      t.noLanza(() => c.api.vglNotificarCompletado(), "sin argumentos: no lanza");
    });
  },
};
