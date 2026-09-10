// =====================================================================
//  SUITE 96 — R-GROUNDING (v18.6.2): trazabilidad y auditoría del redactor
//
//  Contrapartes ejecutadas del pedido de cambiar el proveedor y certificar
//  "S+" (rechazado con evidencia en docs/INFORME_AUDITORIA_REDACTOR_IA.md §5):
//  lo que SÍ se prometió en su §4, con prueba y mutación verificada:
//
//  A) SANEADOR DE PREÁMBULOS para todos los modos: quita «Claro, aquí
//     tiene…» del INICIO de la respuesta (conservador: máximo 2 líneas,
//     cortas, sin dígitos, con puntuación final; el resto intacto).
//  B) SELLO DE TRAZABILIDAD: declara en el prompt la edad de la "foto" y
//     la hora local de la generación (mtrSelloContextoTexto, pura).
//  C) EL SELLO VIAJA EN EL PROMPT: mtrRedaccionPrompt lo coloca después de
//     los datos y antes de la tarea final.
//  D) TELEMETRÍA ANÓNIMA del verificador de afirmaciones: etiquetas
//     ia.fuentes.flag.N / ia.fuentes.sin_linea (jamás texto clínico).
//
//  Cero PHI: textos ficticios de prueba, sin nombres ni documentos.
// =====================================================================
const { instalarDomEnriquecido } = require("./harness");

module.exports = {
  nombre: "R-Grounding: sello de la foto, saneador de preámbulos y telemetría del verificador",
  cubre: [
    "mtrQuitarPreambuloIA", "mtrSelloContextoTexto", "mtrTrackFuentesIA",
    "mtrRedaccionPrompt",
  ],

  pruebas(t, api, env, cargar) {
    const c = cargar({ silencioso: true });

    // =====================================================================
    //  A — SANEADOR DE PREÁMBULOS (puro: texto → texto)
    // =====================================================================
    t.caso("A/saneador: quita el preámbulo del inicio y no toca el resto", () => {
      const Q = c.api.mtrQuitarPreambuloIA;
      t.igual(Q("Claro, aquí tiene la enfermedad actual:\nPACIENTE REFIERE CEFALEA DESDE AYER"),
        "PACIENTE REFIERE CEFALEA DESDE AYER", "quita «Claro, aquí tiene…:» con coma interna");
      t.igual(Q("POR SUPUESTO, con gusto la redacto:\nRECOMENDACIONES DE CONTROL"),
        "RECOMENDACIONES DE CONTROL", "quita «POR SUPUESTO, …:»");
      t.igual(Q("AQUÍ VA:\nPERFECTO:\nCONTENIDO CLÍNICO REAL"),
        "CONTENIDO CLÍNICO REAL", "máximo 2 líneas de preámbulo; la 3.ª es contenido");
      t.igual(Q("AHÍ VA LA NOTA:"), "", "una sola línea de preámbulo deja vacío");
      t.igual(Q("AQUÍ VA LA NOTA"), "AQUÍ VA LA NOTA", "sin puntuación final NO es preámbulo (conservador)");
      t.igual(Q("CLARO, aquí está la nota del paciente de 70 años:\nresto"),
        "CLARO, aquí está la nota del paciente de 70 años:\nresto", "línea con dígito jamás se borra");
      t.igual(Q("PACIENTE CON HTA EN CONTROL, SIN DATOS DE INTERÉS"),
        "PACIENTE CON HTA EN CONTROL, SIN DATOS DE INTERÉS", "texto sin preámbulo sale idéntico");
      t.igual(Q(Q("Claro:\nPACIENTE REFIERE CEFALEA")), "PACIENTE REFIERE CEFALEA", "idempotente");
      t.igual(Q(""), "", "vacío → vacío");
      t.igual(Q(null), "", "null → vacío (nunca lanza)");
    });

    // =====================================================================
    //  B — SELLO DE TRAZABILIDAD (puro, reloj inyectable)
    // =====================================================================
    t.caso("B/sello: edad de la foto y hora local de la generación, exactas", () => {
      const S = c.api.mtrSelloContextoTexto;
      const tFijo = new Date(2026, 8, 7, 9, 5).getTime();   // 07-sep-2026 09:05 local
      t.igual(S(3, false, tFijo),
        "SELLO DE LA FOTO: hechos leídos de la pantalla hace 3 min · generación solicitada a las 09:05 (hora local del consultorio).",
        "sello exacto con edad conocida y hora inyectada");
      t.cierto(S(0, true, tFijo).indexOf("recién leídos") >= 0, "0 min → «recién leídos»");
      t.cierto(S(0, true, tFijo).indexOf("(refrescados al instante de este clic)") >= 0, "refrescado se declara");
      t.cierto(S(null, false, tFijo).indexOf("antigüedad no disponible") >= 0, "edad desconocida se dice, no se inventa");
      const sinArgs = S();
      t.cierto(typeof sinArgs === "string" && sinArgs.indexOf("SELLO DE LA FOTO") === 0, "sin argumentos nunca lanza");
    });

    // =====================================================================
    //  C — EL SELLO VIAJA EN EL PROMPT (después de los datos, antes de la tarea)
    // =====================================================================
    t.caso("C/prompt: mtrRedaccionPrompt coloca el sello antes de la tarea final", () => {
      const P = c.api.mtrRedaccionPrompt;
      const con = P("recomendaciones", {}, { selloContexto: "SELLO X" });
      t.cierto(typeof con.user === "string" && con.user.indexOf("SELLO X") >= 0, "el sello llega al user");
      t.cierto(con.user.indexOf("SELLO X") < con.user.indexOf("Con base únicamente"),
        "el sello va ANTES de la tarea final (declara la foto, no es tarea)");
      const sin = P("recomendaciones", {}, {});
      t.cierto(sin.user.indexOf("SELLO X") < 0, "sin sello en opts no se inyecta nada");
      const con2 = P("analisis_plan", {}, { selloContexto: "SELLO Y" });
      t.cierto(con2.user.indexOf("SELLO Y") >= 0 && con2.user.indexOf("HECHOS DEL PACIENTE") >= 0,
        "el sello viaja también en análisis/plan con el ensamblado completo");
    });

    // =====================================================================
    //  D — TELEMETRÍA ANÓNIMA DEL VERIFICADOR DE AFIRMACIONES
    // =====================================================================
    t.caso("D/telemetria: etiquetas ia.fuentes.flag.N y ia.fuentes.sin_linea", () => {
      const T = c.api.mtrTrackFuentesIA;
      t.igual(T(0, true), null, "sin hallazgos y con línea FUENTES: nada que emitir");
      t.igual(T(1, true), "ia.fuentes.flag.1", "un hallazgo → flag.1");
      t.igual(T(4, true), "ia.fuentes.flag.3", "techo en 3+ (mismo patrón que ia.cifras)");
      t.igual(T(0, false), "ia.fuentes.sin_linea", "sin línea FUENTES → sin_linea (el verificador operó a ciegas)");
      t.igual(T(2, false), "ia.fuentes.flag.2", "los hallazgos mandan aunque falte la línea");
      t.igual(T(0, undefined), "ia.fuentes.sin_linea", "línea no definida cuenta como ausente");
      t.cierto(T(3, true).indexOf("PACIENTE") < 0, "la etiqueta jamás lleva texto clínico (cero PHI)");
    });
  },
};
