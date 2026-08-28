const fs = require("fs");
const path = require("path");
// =====================================================================
//  SUITE 57 — Redacción IA: prompts, parser, conector y estilo
//
//  Todo el módulo salvo la red real (que necesita la clave del médico). Se fija:
//   · el prompt lleva SIEMPRE la instrucción anti-invención y SOLO la hoja
//     desidentificada (jamás identificadores);
//   · el parser distingue texto, bloqueo, error y vacío;
//   · el conector falla SEGURO (sin clave -> no toca la red; con mock de red
//     que responde, entrega el texto);
//   · los ejemplos de estilo se guardan desidentificados y acotados.
// =====================================================================

function hojaDemo(api) {
  return api.mtrHojaDeHechos({
    programa: "HTA",
    factores: { edad: 61, sexo: "F", diabetes: true, hta: true },
    erc: { egfr: 52, estadioClinico: "G3a" },
    riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } },
  }, { hoyIso: "2026-08-17", medicamentos: ["LOSARTAN 50 MG"], ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } } });
}

// Respuesta con la FORMA real de la API de Gemini.
function respGemini(texto) {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] }, finishReason: "STOP" }] });
}

module.exports = {
  nombre: "Redacción IA: prompts, parser, conector y estilo",
  cubre: [
    "mtrRedaccionPrompt", "mtrRespuestaGemini", "mtrEstadoBorrador", "mtrLimpiarNotaIA", "mtrQuitarDatosProhibidosEA", "mtrVerificarCifrasIA", "mtrContarPalabrasTexto", "_vglTextoPrevioPodar",
    "mtrGeminiRedactar", "mtrEstiloGuardar", "mtrEstiloLeer",
    "mtrGuardarClaveGemini", "mtrLeerClaveGemini",
    "mtrModeloGemini", "_mtrModeloIdx", "mtrRotarModelo", "mtrEsCuotaAgotada", "mtrEsModeloSobrecargado", "mtrEsModeloNoDisponible", "mtrHojaDesdeResumen",
    "mtrDatosExtraGuardar", "mtrDatosExtraLeer", "mtrDatosExtraTexto",
    "mtrJsonV68DesdeResumen", "mtrLeerTextoLibreHistoria",
    "mtrCasillaDeModo", "mtrRedactorModoSugerido", "mtrInsertarEnCasillaModo",
    "mtrCacheResumenEdadMin", "mtrCacheResumenBorrar",
    "mtrCalcularDeltaEdicion", "mtrAnalitoQueFijaLaToma",
    "_vglClicablePestana", "_vglIrAPestanaYEsperar",
  ],

  async pruebas(t, api, env, cargar) {
    // ================= PROMPTS =================

    t.caso("cada modo trae su instrucción de sistema y los hechos", () => {
      // v16.5.0 — modos vigentes tras la decisión del médico (nota_clinica y briefing salen)
      for (const modo of ["enfermedad_actual", "analisis_plan", "recomendaciones", "consulta"]) {
        const p = api.mtrRedaccionPrompt(modo, hojaDemo(api), { pregunta: "¿última HbA1c?" });
        t.cierto(p.user.indexOf("HECHOS DEL PACIENTE") >= 0, modo + ": los hechos van en el user");
        t.cierto(!!p.system && p.system.length > 50, modo + ": tiene instrucción de sistema");
      }
    });

    t.caso("cada redactor usa SU prompt: enfermedad actual (extenso, primera persona) vs Análisis y plan (siglas, secciones — la nota del Copiloto)", () => {
      const ea = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {});
      t.cierto(/Resoluci[oó]n 1995/.test(ea.system), "EA: rol de auditoría 1995");
      t.cierto(/en extenso|nunca HTA/i.test(ea.system), "EA: diagnósticos en extenso, sin siglas");
      const nc = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), {});
      t.cierto(/ESTRUCTURA DE SALIDA|SECCIÓN/i.test(nc.system), "nota: estructura por secciones");
      t.cierto(/BLINDAJE MÉDICO-LEGAL/i.test(nc.system), "nota: blindaje médico-legal");
    });

    // v17.6.84 — auditoría v68 (S3 "LLEGA TARDE SIN LABS"), decisión del médico del 26-ago
    // ("Cortar la mención ahora"). El prompt le PEDÍA al modelo redactar la constancia
    // médico-legal de "toma previa incumplida por barrera de acceso no imputable al
    // profesional", pero NINGÚN campo del JSON le dice si eso ocurrió: el script todavía no
    // persiste si la FTL anterior se cumplió. El modelo solo podía omitirla siempre o
    // inventársela — y una constancia inventada tiene consecuencia jurídica sobre un
    // paciente que quizá sí fue a tomarse los exámenes. Mismo criterio con el que
    // `falla_dispensacion` se dejó fija en "NO" (v17.6.78).
    t.caso("v17.6.84: el prompt NO puede pedir una constancia médico-legal que ningún campo respalda", () => {
      const nota = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), {});
      const todo = String(nota.system) + "\n" + String(nota.user);
      t.falso(/toma previa incumplida/i.test(todo),
        "no se le pide al modelo la constancia de toma previa incumplida");
      t.falso(/no imputable al (?:profesional|médico)/i.test(todo),
        "ni la fórmula jurídica de 'no imputable al profesional'");
      // Lo que SÍ debe seguir pidiéndose en esa misma sección, para probar que el corte fue
      // quirúrgico y no se llevó por delante la logística entera.
      t.cierto(/CITA CONTROL DE RIESGO CARDIOVASCULAR/i.test(todo), "la cita de control sigue pidiéndose");
      t.cierto(/PRÓXIMOS LABORATORIOS/i.test(todo), "y los próximos laboratorios también");
      // La constancia por falla de dispensación es DISTINTA: esa sí tiene campo en el JSON
      // (`falla_dispensacion`), aunque hoy salga fija en "NO". No se toca.
      t.cierto(/falla_dispensacion/.test(todo),
        "la constancia por falla de dispensación se conserva: está atada a un campo real del JSON");
    });

    // v17.3.0 — AUDITORÍA PEDIDA POR EL MÉDICO (21-ago): un borrador real de Enfermedad
    // Actual traía valores de laboratorio y una clasificación de riesgo — dato que no va
    // en esa sección por convención propia de su historia clínica. Raíz: mtrRedaccionPrompt
    // manda el MISMO bloque HECHOS DEL PACIENTE (incluye el panel de paraclínicos) a los
    // cinco modos por igual, y la regla 6 de MTR_EA_SYS no distinguía "de hoy" de "de un
    // control pasado". Se prueba que el prompt de Enfermedad Actual ahora prohíbe ambas
    // cosas EN POSITIVO (regla 6 acotada a "DE HOY") Y EN NEGATIVO (dos líneas nuevas en
    // PROHIBIDO) — y que Análisis y plan, que sí debe interpretar labs/riesgo, no pierde
    // esa capacidad (no se tocó su prompt).
    t.caso("Enfermedad Actual ya NO admite labs/paraclínicos ni clasificación de riesgo — eso vive en Análisis y Plan", () => {
      const ea = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {});
      t.cierto(/laboratorio o paraclínicos/i.test(ea.system), "PROHIBIDO nombra explícitamente labs/paraclínicos");
      t.cierto(/glucosa|creatinina|hemoglobina glicosilada/i.test(ea.system), "y da ejemplos concretos (no una prohibición vaga que el modelo pueda ignorar)");
      t.cierto(/riesgo cardiovascular/i.test(ea.system) && /bajo, moderado, alto/i.test(ea.system), "PROHIBIDO nombra la clasificación de riesgo cardiovascular");
      t.cierto(/metas terapéuticas/i.test(ea.system), "y las metas terapéuticas (p. ej. meta de LDL)");
      t.cierto(/Análisis y Plan/.test(ea.system), "y dice dónde SÍ va ese dato, para que no parezca que se pierde");
      // La nota de Análisis y Plan (MTR_NOTA_SYS) no se tocó: sigue recibiendo el JSON del
      // motor RCV como fuente de verdad numérica para labs/riesgo — ahí SÍ corresponden.
      const an = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), { jsonV68: { version: "68", cv_risk: "alto" } });
      t.cierto(/JSON DEL MOTOR RCV/.test(an.user), "Análisis y Plan sigue recibiendo el JSON del motor (labs/riesgo no desaparecieron del sistema, solo de Enfermedad Actual)");
    });

    // v17.6.3 — IA ALUCINA (reporte del médico en consultorio): la Enfermedad Actual venía
    // inventando la presión arterial (p. ej. «PA 110/70»). Primer arreglo (v17.6.3): condicionar
    // la PA a que constara en los hechos — no bastaba, porque el defecto real no era la
    // invención sino pedir un hallazgo de examen físico dentro de la anamnesis.
    // v17.28.0 — reporte en vivo del médico (28-ago): "se sigue colando examen físico en la
    // enfermedad actual, eso no es permitido". Investigado contra semiología clínica estándar
    // (anamnesis vs. examen físico como fases separadas del acto médico): la PA/peso de HOY
    // salen de Enfermedad Actual por completo, sin condición — ni aunque consten. Este caso
    // se reescribe para fijar la prohibición INCONDICIONAL, no la condicional de v17.6.3.
    t.caso("v17.28.0 — Enfermedad Actual NUNCA admite signos vitales de hoy, ni siquiera cuando SÍ constan en los hechos", () => {
      const ea = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {});
      // PROHIBIDO: la exclusión es incondicional — no depende de si la cifra existe o no.
      t.cierto(/[Nn]unca a Enfermedad Actual/.test(ea.system),
        "PROHIBIDO dice explícitamente que los signos vitales de hoy nunca van en Enfermedad Actual");
      t.cierto(/ni siquiera si constan/i.test(ea.system),
        "y aclara que la exclusión aplica AUNQUE la cifra sí conste en los hechos entregados");
      t.falso(/# CONTENIDO OBLIGATORIO[\s\S]*?presi[óo]n arterial, glucometr[íi]a/i.test(ea.system),
        "la vieja regla 6 (\"cifras objetivas DE HOY: presión arterial, glucometría...\") ya no existe como contenido obligatorio");
      // Regla 5: el automonitoreo DOMICILIARIO de PA (lo que el paciente refiere de su casa)
      // SÍ sigue siendo anamnesis legítima — no se tocó, y sigue condicionado a que conste.
      t.cierto(/automonitoreo de presión arterial[^\n]*SOLO si|si no consta[^\n]*no se menciona/i.test(ea.system),
        "regla 5 (automonitoreo domiciliario referido por el paciente) sigue viva y condicionada");
      // Y hoy en el ejemplo, la PA/peso de la consulta actual ya no aparecen — solo el
      // automonitoreo domiciliario referido (que es lo único que sí pertenece a EA).
      t.falso(/EN LA CONSULTA ACTUAL SE EVIDENCIA PRESI[ÓO]N ARTERIAL/.test(ea.system),
        "el ejemplo ya no modela una frase de examen físico dentro de Enfermedad Actual");
      // La hoja SIN PA no fabrica la línea de signos vitales (ya era así; queda anclado).
      const hojaSin = api.mtrHojaDeHechos({ factores: { edad: 61, sexo: "F" } }, { hoyIso: "2026-08-17" });
      t.cierto(api.mtrHojaDeHechosTexto(hojaSin).indexOf("Signos vitales") < 0,
        "sin PA en el resumen, la hoja no muestra signos vitales (casilla vacía, no dato inventado)");
      // Y con PA presente, la hoja SÍ la lleva (la omisión no se convierte en censura).
      const hojaCon = api.mtrHojaDeHechos({ factores: { edad: 61, sexo: "F", paSistolica: 128, paDiastolica: 80 } }, { hoyIso: "2026-08-17" });
      t.cierto(/Signos vitales: PA 128\/80 mmHg/.test(api.mtrHojaDeHechosTexto(hojaCon)),
        "con PA en el resumen, la hoja sí la muestra (el dato real no se pierde)");
    });

    // v17.6.3 — IA CORRUPTA (reporte del médico): la nota de «Análisis y plan» llegaba con
    // basura markdown del modelo (p. ej. «====** COCKCROFT-»): negritas **, '=' sueltos y
    // cabeceras malformadas pese a la regla de texto plano. Dos capas: (1) el prompt de la
    // nota declara cuál es la ÚNICA decoración permitida (la cabecera '===== SECCIÓN: X
    // =====' y los '::' de ítem) y prohíbe asteriscos/negritas/backticks por su nombre;
    // (2) defensa en profundidad: mtrLimpiarNotaIA normaliza el borrador del modelo antes
    // de que el médico lo vea o lo inserte — nunca inventa ni borra contenido clínico.
    t.caso("mtrLimpiarNotaIA: el borrador de la nota sale limpio de markdown (el reporte «====** COCKCROFT-» no puede volver a pasar)", () => {
      const sucio = "====** COCKCROFT-GAULT: 48.1 ML/MIN**\n:: FUNCIÓN RENAL: **EGFR (CKD-EPI 2021) 52 ML/MIN**\n===== SECCIÓN: REVISIÓN PARACLÍNICA =====";
      const limpio = api.mtrLimpiarNotaIA(sucio);
      t.cierto(limpio.indexOf("**") < 0, "sin asteriscos (las negritas del modelo fuera)");
      t.cierto(limpio.split("\n").filter((l) => /={2,}/.test(l) && !/^===== SECCIÓN:/.test(l)).length === 0,
        "sin '=' de decoración fuera de las cabeceras sancionadas");
      t.cierto(/===== SECCIÓN: REVISIÓN PARACLÍNICA =====/.test(limpio), "la cabecera sancionada se conserva exacta");
      t.cierto(/COCKCROFT-GAULT: 48.1 ML\/MIN/.test(limpio) && /EGFR \(CKD-EPI 2021\) 52 ML\/MIN/.test(limpio),
        "y el contenido clínico queda íntegro (no se pierde dato)");
    });

    t.caso("mtrLimpiarNotaIA: no toca el marcador [ID]/[AÑO_MES] ni los '::' ni el texto plano", () => {
      const bien = "#PACIENTE_[ID]_#RCV_CONTROL_[AÑO_MES]\n===== SECCIÓN: IDENTIFICACIÓN Y EVOLUCIÓN CLÍNICA =====\n:: PATOLOGÍAS ACTIVAS: HTA\n:: META TERAPÉUTICA DE LDL: MENOR A 70";
      const limpio = api.mtrLimpiarNotaIA(bien);
      t.cierto(/^#PACIENTE_\[ID\]_#RCV_CONTROL_\[AÑO_MES\]$/m.test(limpio), "el marcador [ID]/[AÑO_MES] sobrevive (lo reemplaza el equipo del médico)");
      t.cierto(/===== SECCIÓN: IDENTIFICACIÓN Y EVOLUCIÓN CLÍNICA =====/.test(limpio), "cabecera intacta");
      t.cierto(/:: PATOLOGÍAS ACTIVAS: HTA/.test(limpio) && /:: META TERAPÉUTICA DE LDL: MENOR A 70/.test(limpio), "ítems '::' intactos");
    });

    // [auditoría 25-ago, hallazgo 1.10] MTR_EA_SYS ya prohíbe en el prompt que la
    // Enfermedad Actual traiga TFG/riesgo cardiovascular/meta LDL/laboratorios/signos
    // vitales (esos van en Análisis y Plan) — pero eso es una instrucción, no una
    // garantía: el modelo puede copiar textual una línea de la hoja de hechos.
    // mtrQuitarDatosProhibidosEA es la segunda capa: quita esas líneas del borrador.
    t.caso("mtrQuitarDatosProhibidosEA: quita las 5 líneas prohibidas de Enfermedad Actual, conserva el resto intacto", () => {
      const sucio = "EL PACIENTE REFIERE CONTROL DE RUTINA, ASINTOMÁTICO.\n"
        + "Función renal: TFG (CKD-EPI 2021) 52 mL/min/1.73m2\n"
        + "Riesgo cardiovascular: alto (Framingham oficial 12 puntos)\n"
        + "Meta LDL: <70 mg/dL\n"
        + "Signos vitales: PA 128/82 mmHg · IMC: 27\n"
        + "Laboratorios y paraclínicos: LDL 118 (hace 2 meses)\n"
        + "AL EXAMEN FÍSICO SE ENCUENTRA ESTABLE, SIN SIGNOS DE ALARMA.";
      const limpio = api.mtrQuitarDatosProhibidosEA(sucio);
      t.falso(/Función renal:/.test(limpio), "TFG fuera");
      t.falso(/Riesgo cardiovascular:/.test(limpio), "categoría de riesgo fuera");
      t.falso(/Meta LDL:/.test(limpio), "meta LDL fuera");
      t.falso(/Signos vitales:/.test(limpio), "signos vitales fuera");
      t.falso(/Laboratorios y paraclínicos:/.test(limpio), "laboratorios fuera");
      t.cierto(/CONTROL DE RUTINA, ASINTOMÁTICO/.test(limpio), "la semiotecnia real del médico sí sobrevive");
      t.cierto(/AL EXAMEN FÍSICO SE ENCUENTRA ESTABLE/.test(limpio), "y la línea siguiente también");
    });

    t.caso("mtrQuitarDatosProhibidosEA: no toca una línea que solo MENCIONA la palabra dentro de la prosa (no es el prefijo exacto)", () => {
      const texto = "SE EXPLICÓ AL PACIENTE SU RIESGO CARDIOVASCULAR Y LA IMPORTANCIA DE LA META LDL INDICADA POR SU MÉDICO.";
      t.igual(api.mtrQuitarDatosProhibidosEA(texto), texto, "solo se filtra por el PREFIJO exacto de la línea, no por contener la palabra en cualquier parte");
    });

    t.caso("mtrQuitarDatosProhibidosEA: texto vacío o null no lanza", () => {
      t.igual(api.mtrQuitarDatosProhibidosEA(""), "");
      t.igual(api.mtrQuitarDatosProhibidosEA(null), "");
    });

    // v17.6.3 — A2 (decisión del médico, 22-ago): VERIFICADOR DE CIFRAS anti-alucinación.
    // Todo número de medida del borrador debe existir en los hechos que se le dieron a la
    // IA; si no está, el modelo lo inventó o lo calculó y se marca. El caso que motivó
    // esto: «PA 110/70» cuando la hoja no traía presión arterial.
    t.caso("mtrVerificarCifrasIA: una PA inventada (sin PA en los hechos) se marca; con PA real no", () => {
      const hojaSinPa = api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F", imc: 27 }, riesgo: { categoria: "alto" } }, { hoyIso: "2026-08-17" });
      const marcadas = api.mtrVerificarCifrasIA("Signos vitales: PA 110/70 mmHg.", hojaSinPa);
      t.cierto(marcadas.some((x) => x.numero === "110"), "la sistólica inventada 110 se marca");
      t.cierto(marcadas.some((x) => x.numero === "70"), "y la diastólica inventada 70 también");
      const hojaConPa = api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F", imc: 27, paSistolica: 120, paDiastolica: 80 }, riesgo: { categoria: "alto" } }, { hoyIso: "2026-08-17" });
      const limpias = api.mtrVerificarCifrasIA("Signos vitales: PA 120/80 mmHg.", hojaConPa);
      t.igual(limpias.length, 0, "PA 120/80 con hechos de 120/80: nada que marcar");
    });

    t.caso("mtrVerificarCifrasIA: un lab que la IA cambió se marca; el que copió bien no", () => {
      const hoja = api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F" }, riesgo: { categoria: "alto" } }, { hoyIso: "2026-08-17", ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } }, medicamentos: ["LOSARTAN 50 MG"] });
      t.igual(api.mtrVerificarCifrasIA("Colesterol LDL 118 mg/dL. Losartán 50 mg.", hoja).length, 0,
        "118 y 50 están en los hechos: ni el lab ni la dosis se marcan");
      const marcadas = api.mtrVerificarCifrasIA("Colesterol LDL 130 mg/dL.", hoja);
      t.cierto(marcadas.some((x) => x.numero === "130"), "LDL 130 cuando el hechos trae 118: se marca (dato inventado o de otra fecha)");
      const dosis = api.mtrVerificarCifrasIA("Losartán 100 mg.", hoja);
      t.cierto(dosis.some((x) => x.numero === "100"), "dosis 100 mg cuando el hechos trae 50: se marca");
    });

    // [bug real de consultorio, 25-ago] re2 partía "Resolución 3280/2018" en "280/201" y
    // lo marcaba como una PA inventada. La fracción no debe leerse como PA si tiene OTRO
    // dígito pegado justo antes o justo después (año, radicado, resolución).
    t.caso("mtrVerificarCifrasIA: una cita legal tipo 'Resolución 3280/2018' no se confunde con una PA", () => {
      const hoja = api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F" }, riesgo: { categoria: "alto" } }, { hoyIso: "2026-08-17" });
      t.igual(api.mtrVerificarCifrasIA("Se cumple con la Resolución 3280/2018 del Ministerio.", hoja).length, 0,
        "3280/2018 es una cita legal, no una fracción de presión arterial: no debe marcarse '280/201'");
      // pero una PA real (sin dígitos pegados a los lados) sigue detectándose igual que antes
      const marcadas = api.mtrVerificarCifrasIA("Signos vitales: PA 190/110 mmHg.", hoja);
      t.cierto(marcadas.some((x) => x.numero === "190") && marcadas.some((x) => x.numero === "110"),
        "una PA inventada real (190/110, sin dígito pegado) se sigue marcando");
    });

    // v17.6.80 — REPORTE EN VIVO (26-ago, captura): la IA cita textualmente una alerta de
    // dosis renal ("máximo 1000 mg/día con TFG 30-44...") — el prompt se lo ordena — y la
    // caja de "cifras sin respaldo" marcaba esos umbrales como inventados, porque el
    // verificador solo conocía la hoja de hechos, nunca las alertas_dosis (un canal
    // SEPARADO que también llega a la IA).
    t.caso("mtrVerificarCifrasIA: un umbral de dosis renal citado textualmente NO se marca cuando se declara como conocido", () => {
      const hoja = api.mtrHojaDeHechos({ programa: "DM2", factores: { edad: 70, sexo: "F" }, riesgo: { categoria: "alto" } }, { hoyIso: "2026-08-17" });
      const texto = "AJUSTE DE DOSIS POR FUNCIÓN RENAL: Metformina: dosis maxima 1000 mg/dia con eGFR 30-44 mL/min/1.73m2.";
      const sinAlertas = api.mtrVerificarCifrasIA(texto, hoja);
      t.cierto(sinAlertas.length > 0, "sin pasar las alertas conocidas, el umbral se marca (reproduce el reporte)");
      const conAlertas = api.mtrVerificarCifrasIA(texto, hoja, ["Metformina: dosis maxima 1000 mg/dia con eGFR 30-44 mL/min/1.73m2."]);
      t.igual(conAlertas.length, 0, "declarando la alerta como conocida, el mismo umbral NO se marca: es una cita legítima, no una invención");
    });

    // [bug real de consultorio, 25-ago] el corte de contexto fijo (24/20 caracteres) partía
    // palabras largas a la mitad ("SE CONTIN" en vez de "SE CONTINÚA").
    t.caso("mtrVerificarCifrasIA: el contexto mostrado nunca corta una palabra a la mitad", () => {
      const hoja = api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F" }, riesgo: { categoria: "alto" } }, { hoyIso: "2026-08-17" });
      const texto = "El paciente SINTOMATOLOGICAMENTE presenta 45 mg.";
      const marcadas = api.mtrVerificarCifrasIA(texto, hoja);
      const fila = marcadas.find((x) => x.numero === "45");
      t.cierto(!!fila, "45 mg (dosis inventada) se marca: no está en los hechos de la hoja");
      t.cierto(fila.contexto.includes("SINTOMATOLOGICAMENTE"), "el contexto conserva la palabra completa, no cortada a la mitad ('ATOLOGICAMENTE'): " + fila.contexto);
    });

    t.caso("mtrVerificarCifrasIA: no marca el marcador #PACIENTE_[ID]_#RCV_CONTROL_[AÑO_MES] ni texto vacío ni conteos sin unidad", () => {
      const hoja = api.mtrHojaDeHechos({ programa: "HTA", factores: { edad: 61, sexo: "F" }, riesgo: { categoria: "alto" } }, { hoyIso: "2026-08-17" });
      t.igual(api.mtrVerificarCifrasIA("#PACIENTE_1010101010_#RCV_CONTROL_2026_08", hoja).length, 0,
        "el marcador con el ID y el año-mes no se marca (no es una medida clínica)");
      t.igual(api.mtrVerificarCifrasIA("", hoja).length, 0, "texto vacío: nada que verificar");
      t.igual(api.mtrVerificarCifrasIA("Se recomienda caminar 30 minutos al día y tomar losartán cada 12 horas.", hoja).length, 0,
        "30 (minutos) y 12 (horas) no son medidas clínicas de la hoja: no se marcan (cero ruido)");
    });

    t.caso("el prompt de la nota clínica declara la ÚNICA decoración permitida y prohíbe el markdown por su nombre", () => {
      const nc = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), { jsonV68: { version: "68" } });
      t.cierto(/ÚNICA decoración permitida|'===== SECCIÓN: NOMBRE ====='|'::' de ítem/.test(nc.system), "la nota declara cuál es la ÚNICA decoración permitida (cabecera y '::')");
      t.cierto(/no pongas '\*\*'|no subrayes títulos con '='|backticks/.test(nc.system), "y prohíbe asteriscos/negritas/subrayados/backticks explícitamente (positivo y negativo)");
    });

    t.caso("el prompt NUNCA lleva identificadores (solo la hoja desidentificada)", () => {
      const r = {
        programa: "HTA",
        factores: { edad: 61, sexo: "F", nombre: "PEDRO ALVAREZ", identificacion: "79999888" },
        riesgo: { categoria: "alto" },
      };
      const hoja = api.mtrHojaDeHechos(r, { hoyIso: "2026-08-17" });
      const p = api.mtrRedaccionPrompt("enfermedad_actual", hoja, {});
      t.cierto(p.user.indexOf("PEDRO") < 0 && p.user.indexOf("79999888") < 0, "ni el nombre ni la cédula viajan en el prompt");
    });

    t.caso("preguntar incluye la pregunta y obliga a admitir si el dato no está", () => {
      const cons = api.mtrRedaccionPrompt("consulta", hojaDemo(api), { pregunta: "¿toma estatina?" });
      t.cierto(cons.user.indexOf("¿toma estatina?") >= 0, "consulta: incluye la pregunta");
      t.cierto(/ese dato no est[áa]/i.test(cons.user), "consulta: obliga a admitir si el dato no está");
    });

    t.caso("el Análisis y plan (la nota del Copiloto) lleva el JSON v68 del motor; los otros modos no", () => {
      const json = { version: "68", cv_risk: "alto", ldl_target: 70 };
      const nc = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), { jsonV68: json });
      t.cierto(/JSON DEL MOTOR RCV/.test(nc.user) && nc.user.indexOf('"version":"68"') >= 0, "el JSON viaja en la nota");
      const ea = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), { jsonV68: json });
      t.cierto(ea.user.indexOf("JSON DEL MOTOR") < 0, "la enfermedad actual no necesita el JSON");
    });

    // v17.6.26 — datosExtra ahora solo trae los 3 campos de la caja roja de críticos
    // (categoría de riesgo, TFG, medicamentos); síntomas/adherencia/motivo/etc. viajan por
    // "Indicaciones" (contextoLibre/indicaciones), no por datosExtra — ver el caso dedicado
    // a la fusión de "Datos del paciente" más abajo.
    t.caso("los datos aportados por el médico y el texto libre entran al prompt (desidentificados)", () => {
      const p = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {
        contextoLibre: "Motivo: control. Revisión/examen: refiere cefalea leve.",
        datosExtra: { medicamentosAportados: "losartán 50 mg, correo juan@x.com colado", tfgAportada: "", categoriaRiesgoConfirmada: "ALTO" },
      });
      t.cierto(/DATOS APORTADOS POR EL MÉDICO/.test(p.user), "bloque de datos aportados");
      t.cierto(p.user.indexOf("losartán 50 mg") >= 0, "incluye el medicamento aportado");
      t.cierto(p.user.indexOf("juan@x.com") < 0, "pero desidentifica lo colado");
      t.cierto(/TEXTO YA REGISTRADO/.test(p.user) && p.user.indexOf("cefalea leve") >= 0, "y el texto ya escrito hoy");
    });

    // v17.6.26 — el estilo ya no depende de un interruptor: se usa SIEMPRE que haya
    // ejemplos guardados (checkbox "Mi estilo" retirado del panel).
    t.caso("los ejemplos de estilo se inyectan automáticamente, sin ningún interruptor", () => {
      const p = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), { estiloEjemplos: ["Paciente que acude a control, estable."] });
      t.cierto(/EMULA EL ESTILO/.test(p.user), "el prompt pide emular el estilo con solo pasar los ejemplos");
      t.cierto(p.user.indexOf("acude a control") >= 0, "e incluye el ejemplo");
      const sinEjemplos = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {});
      t.falso(/EMULA EL ESTILO/.test(sinEjemplos.user), "sin ejemplos guardados, no aparece la sección (nada que emular)");
    });

    t.caso("guía Gemini 3.x: el contexto va primero y la TAREA al final, anclada a lo anterior", () => {
      const p = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), { jsonV68: { version: "68" }, datosExtra: { adherencia: "buena" } });
      const iHechos = p.user.indexOf("HECHOS DEL PACIENTE");
      const iTarea = p.user.indexOf("Con base únicamente en la información anterior");
      t.cierto(iHechos >= 0 && iTarea > iHechos, "la instrucción de la tarea queda DESPUÉS de los hechos");
      t.cierto(iTarea > p.user.indexOf("DATOS APORTADOS POR EL MÉDICO"), "y después de los datos aportados");
      t.cierto(p.user.indexOf("JSON DEL MOTOR RCV") < iHechos, "el JSON (contexto más grande) abre el mensaje");
    });

    t.caso("los prompts PRO MAX conservan sus contratos: ejemplo few-shot, extensión explícita y bloques delimitados", () => {
      const ea = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {});
      t.cierto(/# EJEMPLO/.test(ea.system), "EA: trae ejemplo few-shot (Google: sin ejemplos rinde peor)");
      t.cierto(/120 y 260 palabras|EXTENSIÓN/.test(ea.system), "EA: pide extensión explícita (los 3.x tienden a lo conciso)");
      t.cierto(/# ROL/.test(ea.system) && /# PROHIBIDO/.test(ea.system), "EA: bloques con delimitadores coherentes");
      const nc = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), {});
      t.cierto(/# EJEMPLO DE FORMA/.test(nc.system), "nota: ancla el patrón '::' con un ejemplo");
      t.cierto(/# FUENTE DE VERDAD/.test(nc.system), "nota: fuente de verdad delimitada");
    });

    // v17.3.0 — Reporte real de consola (21-ago): "gemini-2.5-flash" (el único 2.x que
    // quedaba en la rotación) respondía 404 — Google lo retiró y en su propia respuesta
    // recomienda "gemini-3.6-flash" como reemplazo (ver MTR_GEMINI_MODELOS). Tras el
    // cambio 1:1, los cinco modelos de la rotación eran 3.x: ya no quedaba ningún modelo
    // que recibiera el cuerpo "de reserva" con temperature/thinkingBudget de la generación
    // 2.x. La rama "2.x conserva temperature 0.2" de cuerpoPara() se dejó a propósito (no
    // es un hack atado a "gemini-2.5-flash": es un chequeo genérico por generación,
    // /^gemini-2\./), como red de seguridad si algún día había que reincorporar un modelo
    // 2.x.
    // v17.4.0 — Ese día llegó: "gemini-2.5-flash-lite" entra a la rotación (cotejo del
    // 22-ago contra el panel real de límites — ver MTR_GEMINI_MODELOS), así que la rama
    // vuelve a ser alcanzable. Esta prueba pasa de "TODA la rotación es 3.x" a "el intento
    // que cae en el único 2.x SÍ lleva temperature/thinkingBudget; los demás no".
    await t.casoAsync("conector: los modelos 3.x NO llevan temperature (guía oficial, tope 8192); el único 2.x de la rotación (gemini-2.5-flash-lite) SÍ conserva temperature 0.2", async () => {
      const cuerpos = [];
      const c = cargar({ silencioso: true, gmxhr: (opts) => {
        const m = /models\/([^:]+):/.exec(opts.url || "");
        cuerpos.push({ modelo: m ? m[1] : "?", body: JSON.parse(opts.data) });
        if (cuerpos.length < 3) setTimeout(() => opts.onload({ status: 429, responseText: '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}' }), 0);
        else setTimeout(() => opts.onload({ status: 200, responseText: respGemini("nota") }), 0);
      }});
      c.api.mtrGuardarClaveGemini("X");
      await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.igual(cuerpos.length, 3, "dos cuotas + un éxito = tres intentos");
      t.cierto(cuerpos.every((x) => /^gemini-3\./.test(x.modelo) || x.modelo === "gemini-2.5-flash-lite"), "los tres intentos cayeron en la rotación real (3.x o el 2.5-flash-lite): " + cuerpos.map((x) => x.modelo).join(", "));
      cuerpos.forEach((x) => {
        if (x.modelo === "gemini-2.5-flash-lite") {
          t.igual(x.body.generationConfig.temperature, 0.2, "2.x: SÍ lleva temperature 0.2 (rama de reserva, viva de nuevo)");
        } else {
          t.falso("temperature" in x.body.generationConfig, "3.x: sin parámetros de muestreo (" + x.modelo + ")");
        }
      });
      t.cierto(cuerpos.every((x) => x.body.generationConfig.maxOutputTokens === 8192), "tope de salida 8192 en los tres (v17.6.23: cuadriplicado para que la nota de 7 secciones no se quede sin espacio tras el pensamiento del modelo)");
    });

    // ================= PARSER =================

    // ================= v15.6.0 — REDACTOR DE TEXTO LIBRE (Propuesta 3) =================
    await t.casoAsync("v16.6.0 — el botón navega por el médico: encuentra la pestaña por su texto, espera la casilla y devuelve el control si no aparece", async () => {
      // Barra de pestañas simulada de Everest (Angular): el destino se ancla por TEXTO.
      const clicks = [];
      const tabConducta = { innerText: "Conducta", textContent: "Conducta", click: () => { clicks.push("Conducta"); doc._conductaAbierta = true; } };
      const tabOtra = { innerText: "Anamnesis", textContent: "Anamnesis", click: () => clicks.push("Anamnesis") };
      const barra = { innerText: "Anamnesis Conducta Paraclínicos", textContent: "Anamnesis Conducta Paraclínicos", click: () => clicks.push("BARRA") };
      const casilla = { value: "", name: "RecomendacionesMedicas" };
      const doc = {
        _conductaAbierta: false,
        querySelectorAll: () => [barra, tabOtra, tabConducta],   // el contenedor gordo va primero a propósito
        querySelector: (sel) => (doc._conductaAbierta && /RecomendacionesMedicas/.test(sel) ? casilla : null),
      };

      t.igual(api._vglClicablePestana("Conducta", doc), tabConducta, "el buscador de pestañas elige el clicable EXACTO, no el contenedor con toda la barra");
      const nav = await api._vglIrAPestanaYEsperar("recomendaciones", doc);
      t.cierto(nav.ok, "llegó a la casilla");
      t.cierto(nav.navego, "navegando de verdad (la casilla no estaba a la vista)");
      t.igual(clicks.join(","), "Conducta", "clicó EXACTAMENTE la pestaña destino — ni la barra entera ni otra pestaña");

      // Con la casilla ya visible, ni un clic: directo.
      const nav2 = await api._vglIrAPestanaYEsperar("recomendaciones", doc);
      t.falso(nav2.navego, "si ya está a la vista va directo, sin teatro");

      // Pestaña inexistente: control de vuelta con el motivo, jamás cuelga.
      const docSin = { querySelectorAll: () => [tabOtra], querySelector: () => null };
      const nav3 = await api._vglIrAPestanaYEsperar("recomendaciones", docSin);
      t.falso(nav3.ok, "sin pestaña no hay milagro");
      t.igual(nav3.motivo, "sin_pestana", "y dice exactamente qué faltó");
    });

    t.caso("v16.5.0 — el rediseño del modal, contrato por contrato (entrevista del 20-ago)", () => {
      // 1. Las FECHAS ya viajan a la IA (decisión del médico: la cronología es la columna
      //    vertebral de la Enfermedad Actual); nombres y cédulas se tachan igual que siempre.
      const saneado = api.mtrSanearTextoLibreAI("Control del 12/05/2026. Sr. Gomez Perez, CC 12345678, refiere disnea desde el 3 de abril.");
      t.cierto(saneado.indexOf("12/05/2026") >= 0, "la fecha numérica sobrevive");
      t.cierto(/3 de abril/.test(saneado), "la fecha textual sobrevive");
      t.falso(/Gomez Perez/.test(saneado), "el nombre se tacha igual que siempre");
      t.falso(/12345678/.test(saneado), "la cédula se tacha igual que siempre");
      // scrubPII sin la opción sigue tachando fechas: el resto del script no cambia.
      t.cierto(String(api.scrubPII("cita del 12/05/2026")).indexOf("12/05/2026") < 0, "sin la opción, las fechas se siguen censurando (telemetría, logs…)");

      // 2. v17.6.81 — REVERTIDO (decisión del médico, en vivo 26-ago): "gemini-3.7-flash
      //    sigue apareciendo" para las notas largas seguía repitiéndose pese al respaldo
      //    de rotación-si-falla (v17.6.69) porque el PRIMER intento siempre arrancaba ahí.
      //    Ahora las notas largas también entran a la rotación de cuota desde el primer
      //    intento, igual que las casillas cortas — ya no hay tratamiento especial.
      t.igual(api.mtrModeloGemini("analisis_plan"), api.mtrModeloGemini(), "la nota médico-legal ya no tiene modelo fijo: usa la rotación, igual que sin modo");
      t.igual(api.mtrModeloGemini("enfermedad_actual"), api.mtrModeloGemini(), "la enfermedad actual también entra a la rotación");
      // v17.3.0 — "gemini-2.5-flash" salió de la lista (404, retirado por Google;
      // reemplazado 1:1 por "gemini-3.6-flash", que la propia API recomienda).
      // v17.4.0 — se suman "gemini-2.5-flash-lite" y "gemini-3-flash" (cotejo 22-ago
      // contra el panel real de límites, ver MTR_GEMINI_MODELOS).
      t.cierto(api.mtrModeloGemini("recomendaciones") !== undefined && ["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-3.6-flash","gemini-3.5-flash","gemini-2.5-flash-lite","gemini-3-flash","gemini-3.7-flash"].indexOf(api.mtrModeloGemini("recomendaciones")) >= 0, "lo corto sigue en la rotación");

      // v17.6.42 — AUDITORÍA S+ (barrido total, 24-ago-2026): el diseño pendiente que el
      // propio comentario de mtrSanearTextoLibreAI dejó documentado desde v15.2.0. Con el
      // texto entero en MAYÚSCULAS SOSTENIDAS (el estilo real de Everest), el patrón por
      // forma (mayúscula+minúsculas) no puede distinguir "MARIA" de "HIPERTENSO" — pero si
      // se le pasa el nombre REAL del paciente abierto, lo tacha literalmente sin adivinar.
      const sanMayus = api.mtrSanearTextoLibreAI(
        "PACIENTE MARIA RODRIGUEZ PEREZ REFIERE CEFALEA HOLOCRANEANA Y ES HIPERTENSA CONOCIDA.",
        "Maria Rodriguez Perez");
      t.falso(/MARIA/.test(sanMayus), "el nombre de pila, en mayúsculas sostenidas, se tacha");
      t.falso(/RODRIGUEZ/.test(sanMayus), "el apellido también");
      t.cierto(/HIPERTENSA/.test(sanMayus), "una palabra clínica real (no parte del nombre) sobrevive intacta");
      t.cierto(/CEFALEA HOLOCRANEANA/.test(sanMayus), "el resto del texto clínico no se toca");
      t.igual((sanMayus.match(/\[NOMBRE_CENSURADO\]/g) || []).length, 1, "los 3 tokens contiguos del nombre colapsan en UNA sola marca, no tres");

      t.igual(api.mtrSanearTextoLibreAI("Texto sin nombre de nadie.", ""), "Texto sin nombre de nadie.", "sin nombre de paciente (cadena vacía), no cambia nada");
      t.igual(api.mtrSanearTextoLibreAI("Control de rutina, sin novedad.", null), "Control de rutina, sin novedad.", "sin nombre de paciente (null), no cambia nada — no revienta");

      // Nombre con tilde: \b de JS no es seguro con letras acentuadas (Á no es \w) — esta
      // función arma el límite de palabra a mano para el alfabeto español.
      const sanTilde = api.mtrSanearTextoLibreAI("ÁNGELA GÓMEZ CONSULTA POR CONTROL.", "Ángela Gómez");
      t.falso(/ÁNGELA/.test(sanTilde), "nombre con tilde en mayúsculas sostenidas: también se tacha");

      // 3. Recomendaciones 100% personalizadas, de usted, con alarma personalizada.
      const re2 = api.mtrRedaccionPrompt("recomendaciones", hojaDemo(api), {});
      t.cierto(/REGLA DE ORO/.test(re2.system), "regla de oro: nada que sirva para cualquier paciente");
      t.cierto(/de usted/.test(re2.system), "trato de usted (decisión del médico)");
      t.cierto(/SIGNOS DE ALARMA PERSONALIZADOS/.test(re2.system), "alarma elegida según SUS patologías");

      // 4. Análisis y plan = la nota completa del Copiloto, con blindaje y marcadores locales.
      const an2 = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), {});
      t.cierto(/BLINDAJE MÉDICO-LEGAL/.test(an2.system), "blindaje médico-legal presente");
      t.cierto(/ESTRUCTURA DE SALIDA/.test(an2.system), "estructura de secciones presente");
      t.cierto(/\[ID\] y \[AÑO_MES\] LITERALES/.test(an2.system), "los marcadores se rellenan en el equipo del médico, no en la IA");

      // 5. v17.6.10 — El mapa de nombres viejos (MTR_IA_MODOS_LEGADO) se retiró: ningún
      // llamador vivo pasa modos retirados (el modal y el botón de riesgo usan los cuatro
      // modos de MTR_IA_MODOS) y un modo desconocido cae en "enfermedad_actual"
      // (modoInicial), nunca revienta. No se prueba por API: las constantes del módulo no
      // se publican en el harness; la garantía es que el banco entero sigue verde.
    });

    t.caso("prompts por casilla: cada modo nuevo trae su propio contrato de sistema (reglas de la casa incluidas)", () => {
      const mo = api.mtrRedaccionPrompt("motivo_consulta", hojaDemo(api), {});
      t.cierto(/MOTIVO DE CONSULTA/.test(mo.system) && /UNA sola frase/.test(mo.system), "motivo: una sola frase corta");
      t.cierto(/MAYÚSCULAS SOSTENIDAS/.test(mo.system), "motivo: hereda el formato de la casa");
      const re = api.mtrRedaccionPrompt("recomendaciones", hojaDemo(api), {});
      t.cierto(/SIGNOS DE ALARMA/.test(re.system), "recomendaciones: exige signos de alarma");
      const an = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), {});
      t.cierto(/ANÁLISIS/.test(an.system) && /PLAN/.test(an.system), "análisis y plan: las dos partes");
      // v17.1.0 (#110) — «Ruta Crónicos» salió del redactor por petición del médico. Su
      // prompt propio (MTR_CRONICOS_SYS) se retiró con él. Lo que sí se prueba ahora es
      // que un modo retirado no revienta: cae al contrato base, no a un error.
      const cr = api.mtrRedaccionPrompt("comentarios_cronicos", hojaDemo(api), {});
      t.cierto(!!cr && !!cr.system, "un modo retirado no lanza: cae al contrato base");
      t.falso(/Ruta de Crónicos/.test(cr.system), "y ya no arrastra el prompt de la casilla eliminada");
      [mo, re, an, cr].forEach((x) => t.cierto(/CERO INFERENCIA/.test(x.system), "todos: prohibido inventar"));
    });

    t.caso("indicaciones del médico: entran al prompt como bloque propio Y pasan por el censor de nombres", () => {
      const p2 = api.mtrRedaccionPrompt("recomendaciones", hojaDemo(api), { indicaciones: "enfatiza adherencia del paciente Pedro Perez y control en un mes" });
      t.cierto(/INSTRUCCIONES DEL MÉDICO PARA ESTA REDACCIÓN/.test(p2.user), "el bloque existe");
      t.cierto(/adherencia/.test(p2.user), "la instrucción llega");
      t.falso(/Pedro Perez/.test(p2.user), "el nombre NO viaja a Google (mtrSanearTextoLibreAI)");
      t.cierto(/NOMBRE_CENSURADO/.test(p2.user), "y queda la marca del censor en su lugar");
      const p3 = api.mtrRedaccionPrompt("recomendaciones", hojaDemo(api), {});
      t.falso(/INSTRUCCIONES DEL MÉDICO/.test(p3.user), "sin indicaciones no hay bloque vacío");
    });

    // v17.3.0 — mismo motivo que la prueba de arriba: "gemini-2.5-flash" salió de
    // MTR_GEMINI_MODELOS (404, retirado por Google). En ese momento los cinco modelos de
    // la rotación eran 3.x, así que no había forma de alcanzar la rama thinkingBudget:0
    // (esa rama sigue en cuerpoPara(), atada por nombre exacto a "gemini-2.5-flash").
    // v17.4.0 — "gemini-2.5-flash-lite" volvió a entrar (ver MTR_GEMINI_MODELOS), pero en
    // el índice 4: esta prueba solo agota 3 intentos desde el índice 0 (0,1,2), así que
    // sigue sin tocar esa posición y su afirmación original sigue siendo cierta para ESTE
    // caso concreto — la rama thinkingBudget:0 ya SÍ es alcanzable en general, y queda
    // cubierta arriba, en la prueba de temperature. Se afirma lo que pasa en los tres
    // primeros intentos de una casilla corta: caen en 3.x y los tres piden thinkingLevel
    // minimal.
    await t.casoAsync("conector: en las casillas cortas TODOS los modelos (hoy 3.x) piden pensamiento «minimal»; la nota clínica no lo toca", async () => {
      const armar = async (modoPedido) => {
        const cuerpos = [];
        const c = cargar({ silencioso: true, gmxhr: (opts) => {
          const m = /models\/([^:]+):/.exec(opts.url || "");
          cuerpos.push({ modelo: m ? m[1] : "?", body: JSON.parse(opts.data) });
          if (cuerpos.length < 3) setTimeout(() => opts.onload({ status: 429, responseText: '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}' }), 0);
          else setTimeout(() => opts.onload({ status: 200, responseText: respGemini("texto") }), 0);
        }});
        c.api.mtrGuardarClaveGemini("X");
        await c.api.mtrGeminiRedactar(hojaDemo(c.api), modoPedido, {});
        return cuerpos;
      };
      const corta = await armar("motivo_consulta");
      t.cierto(corta.every((x) => /^gemini-3\./.test(x.modelo)), "los tres intentos son 3.x (ya no queda 2.x en la rotación): " + corta.map((x) => x.modelo).join(", "));
      t.cierto(corta.every((x) => x.body.generationConfig.thinkingConfig && x.body.generationConfig.thinkingConfig.thinkingLevel === "minimal"), "3.x en casilla corta: thinkingLevel minimal en los tres intentos");
      t.cierto(corta.every((x) => x.body.generationConfig.maxOutputTokens === 8192), "el tope de salida NO se recorta en ninguno (lección v14.2/v17.6.23: notas truncadas)");
      const larga = await armar("analisis_plan");
      const l3 = larga.find((x) => /^gemini-3\./.test(x.modelo));
      t.falso(!!(l3.body.generationConfig.thinkingConfig), "nota clínica: el modelo piensa con su valor por defecto");
      // v17.0.3 — BUG REAL DE CAMPO reproducido y corregido: "enfermedad_actual" está en
      // MTR_MODOS_NOTA_LARGA (usa el modelo potente, igual que "analisis_plan") pero antes
      // _esCasillaCorta solo excluía "analisis_plan" A MANO — así que enfermedad_actual SÍ
      // caía en la rama de casilla corta y le mandaba thinkingLevel:"minimal" al modelo
      // potente, que lo rechaza con "Thinking level MINIMAL is not supported for this
      // model." (captura real del médico, 21-ago). Debe comportarse IGUAL que analisis_plan.
      const ea = await armar("enfermedad_actual");
      const ea3 = ea.find((x) => /^gemini-3\./.test(x.modelo));
      t.falso(!!(ea3.body.generationConfig.thinkingConfig), "enfermedad actual: también piensa con su valor por defecto (no revienta con MINIMAL)");
    });

    t.caso("mtrCasillaDeModo: cada modo busca su ancla real; un modo desconocido es null (directo)", () => {
      const c = cargar({ silencioso: true });
      const cajas = {};
      c.env.doc.querySelector = (sel) => cajas[sel] || null;
      cajas['textarea[name="RecomendacionesMedicas"]'] = { name: "RecomendacionesMedicas" };
      t.cierto(!!c.api.mtrCasillaDeModo("recomendaciones"), "recomendaciones → name=RecomendacionesMedicas");
      t.igual(c.api.mtrCasillaDeModo("motivo_consulta"), null, "sin la casilla en pantalla: null");
      t.igual(c.api.mtrCasillaDeModo("modo_inventado"), null, "modo desconocido: null");
    });

    t.caso("mtrInsertarEnCasillaModo: vacía inserta; ocupada NO pisa y devuelve el texto previo; sin casilla dice la pestaña", () => {
      const c = cargar({ silencioso: true });
      const caja = { value: "", isConnected: true, dispatchEvent: () => {} };
      c.env.doc.querySelector = (sel) => (sel === 'textarea[name="MotivoConsulta"]' ? caja : null);
      const ok = c.api.mtrInsertarEnCasillaModo("motivo_consulta", "CONTROL DE HIPERTENSIÓN ARTERIAL.", null);
      t.cierto(ok.ok && ok.motivo === "insertado", "vacía: insertado");
      t.igual(caja.value, "CONTROL DE HIPERTENSIÓN ARTERIAL.");
      const occ = c.api.mtrInsertarEnCasillaModo("motivo_consulta", "OTRO TEXTO", null);
      t.cierto(!occ.ok && occ.motivo === "ocupada", "ocupada: no pisa");
      t.igual(occ.previo, "CONTROL DE HIPERTENSIÓN ARTERIAL.", "y entrega el previo para el Deshacer del reemplazo");
      t.igual(caja.value, "CONTROL DE HIPERTENSIÓN ARTERIAL.", "la casilla quedó intacta");
      const sin = c.api.mtrInsertarEnCasillaModo("recomendaciones", "TEXTO", null);
      t.cierto(!sin.ok && sin.motivo === "sin_casilla" && sin.pestania === "Conducta", "sin casilla: dice dónde buscarla");
    });

    // [auditoría 25-ago, hallazgo 1.21] vglEscrituraPermitida (el dead-man switch) tenía un
    // ÚNICO llamador en todo el archivo (vglLlenarFactoresEnEverest, el llenado de
    // antecedentes). Su propio mensaje promete "dejo de escribir en la historia clínica
    // (llenar antecedentes E INSERTAR NOTAS)" — pero ningún punto de inserción de notas de
    // IA lo consultaba: con la escritura cortada por el dead-man, el redactor seguía
    // insertando notas en la historia como si nada.
    t.caso("mtrInsertarEnCasillaModo: con el dead-man switch cortando la escritura, no inserta nada y lo dice", () => {
      const c = cargar({ silencioso: true });
      // Mismo patrón que suite_68 ("el sello del último contacto y la puerta de
      // escritura"): 40 días sin contacto con el servidor de control corta la escritura.
      c.api._vglDeadmanSellar(Date.now() - 40 * 86400000);
      t.falso(c.api.vglEscrituraPermitida(), "confirmación: el dead-man está activo para esta prueba");
      const caja = { value: "", isConnected: true, dispatchEvent: () => {} };
      c.env.doc.querySelector = (sel) => (sel === 'textarea[name="MotivoConsulta"]' ? caja : null);
      const r = c.api.mtrInsertarEnCasillaModo("motivo_consulta", "CONTROL DE HIPERTENSIÓN ARTERIAL.", null);
      t.cierto(!r.ok && r.motivo === "deadman", "se niega explícitamente por el dead-man, no por 'sin_casilla' ni otro motivo genérico");
      t.igual(caja.value, "", "cero escritura: la casilla queda intacta (bug real: se insertaba igual)");
    });

    t.caso("mtrInsertarEnCasillaModo: si la historia abierta es de OTRO paciente, se niega sin tocar nada", () => {
      const c = cargar({ silencioso: true });
      c.env.win.location.pathname = "/viva/HCHealth/HistoriaClinica";
      c.env.doc.getElementById = (id) => (id === "anamesis" ? { id: "anamesis" } : null);
      const caja = { value: "", isConnected: true, dispatchEvent: () => {} };
      c.env.doc.querySelector = (sel) => (sel === 'textarea[name="MotivoConsulta"]' ? caja : null);
      c.env.doc.querySelectorAll = (sel) => (sel === ".text-muted" ? [{ textContent: "CC 999999999", closest: () => null }] : []);
      const r = c.api.mtrInsertarEnCasillaModo("motivo_consulta", "TEXTO", "111111111");
      t.cierto(!r.ok && r.motivo === "otro_paciente", "guarda de paciente cruzado");
      t.igual(caja.value, "", "cero escritura");
    });

    t.caso("mtrRedactorModoSugerido: arranca por la casilla VISIBLE de la pestaña abierta; sin ninguna, enfermedad actual", () => {
      const c = cargar({ silencioso: true });
      const visible = { value: "", offsetParent: {}, dispatchEvent: () => {} };
      c.env.doc.querySelector = (sel) => (sel === 'textarea[name="RecomendacionesMedicas"]' ? visible : null);
      t.igual(c.api.mtrRedactorModoSugerido(), "recomendaciones", "la visible manda");
      const c2 = cargar({ silencioso: true });
      c2.env.doc.querySelector = () => null;
      t.igual(c2.api.mtrRedactorModoSugerido(), "enfermedad_actual", "sin casillas a la vista: la de siempre");
    });

    t.caso("caché del resumen: edad en minutos y borrado explícito (para el «Recalcular ahora» de la Ficha)", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrCacheResumenEdadMin("111"), null, "sin caché: null");
      c.api.mtrCacheResumenGuardar("111", { programa: "HTA" });
      t.igual(c.api.mtrCacheResumenEdadMin("111"), 0, "recién guardada: 0 minutos");
      // v17.6.0 — mismo TTL que mtrCacheResumenLeer (MTR_CACHE_TTL_MS). v17.29.0 lo bajó
      // otra vez, de 10 a 3 min (encargo del médico, decisión #23): pasado el nuevo
      // corte, la edad también debe darse por vencida (null), no seguir informando una
      // edad de una caché que ya nadie va a usar.
      c.api.__envejecerCacheResumen(2 * 60000);
      t.igual(c.api.mtrCacheResumenEdadMin("111"), 2, "a los 2 min, con el TTL nuevo, informa 2 minutos de edad");
      c.api.__envejecerCacheResumen(3 * 60000 + 1000);
      t.igual(c.api.mtrCacheResumenEdadMin("111"), null, "a los 3 min y 1 s, el TTL nuevo ya la da por vencida: null, no una edad enorme");
      c.api.mtrCacheResumenBorrar();
      t.igual(c.api.mtrCacheResumenLeer("111"), null, "borrada: no hay resumen");
      t.igual(c.api.mtrCacheResumenEdadMin("111"), null, "ni edad");
    });

    t.caso("mtrRespuestaGemini saca el texto de una respuesta buena", () => {
      const r = api.mtrRespuestaGemini(respGemini("Paciente de 61 años en control de HTA."));
      t.cierto(r.ok && /61 años/.test(r.texto), "texto extraído");
    });

    t.caso("distingue bloqueo, error y vacío (sin confundirlos con éxito)", () => {
      t.falso(api.mtrRespuestaGemini(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })).ok, "bloqueo");
      t.falso(api.mtrRespuestaGemini(JSON.stringify({ error: { message: "quota" } })).ok, "error de API");
      t.falso(api.mtrRespuestaGemini(JSON.stringify({ candidates: [] })).ok, "sin candidatos");
      t.falso(api.mtrRespuestaGemini("no es json").ok, "no-JSON");
      t.falso(api.mtrRespuestaGemini(null).ok, "nulo");
    });

    // v17.6.34 — AUDITORÍA S+ (barrido total, 24-ago-2026): un error crudo de la API de
    // Google (en inglés) llegaba tal cual al estado del modal y a los chips de "Generar
    // todo" — el médico veía texto de desarrollador, no una instrucción clínica útil.
    t.caso("v17.6.34: un error de la API de Gemini nunca llega crudo (en inglés) al médico", () => {
      const r = api.mtrRespuestaGemini(JSON.stringify({ error: { message: "Requested entity was not found." } }));
      t.falso(r.ok, "sigue marcando error");
      t.falso(/Requested entity|not found/i.test(r.motivo), "el mensaje crudo de Google no debe llegar al motivo visible");
      t.igual(r.motivo, "la IA rechazó la petición; intente de nuevo", "motivo genérico en español, el único que el médico ve en este caso");
    });

    t.caso("v17.6.11: el contador de palabras del borrador nunca miente ni revienta", () => {
      t.igual(api.mtrContarPalabrasTexto(""), 0, "vacío");
      t.igual(api.mtrContarPalabrasTexto("   "), 0, "solo espacios");
      t.igual(api.mtrContarPalabrasTexto(null), 0, "nulo");
      t.igual(api.mtrContarPalabrasTexto("Evoluciona estable."), 2, "dos palabras");
      t.igual(api.mtrContarPalabrasTexto("Hoy: 8.5 mg/dL y TA 120/80."), 6, "símbolos separados cuentan igual");
      t.igual(api.mtrContarPalabrasTexto("a\n\nb\nc"), 3, "saltos de línea múltiples colapsan");
    });

    // ================= CONECTOR (mock de red) =================

    await t.casoAsync("sin clave configurada, el conector NO toca la red", async () => {
      const c = cargar({ silencioso: true }); // entorno limpio, sin clave
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.igual(r.motivo, "sin_clave", "se detiene antes de la red");
      t.falso(r.ok, "no ok");
    });

    await t.casoAsync("con clave y una red que responde, entrega el texto redactado", async () => {
      let vistoContentType = "", vistoKeyPresente = false, urlLlamada = "";
      const c = cargar({
        silencioso: true,
        gmxhr: (opts) => {
          urlLlamada = opts.url || "";
          vistoContentType = (opts.headers && opts.headers["Content-Type"]) || "";
          vistoKeyPresente = !!(opts.headers && opts.headers["x-goog-api-key"]);
          setTimeout(() => opts.onload({ status: 200, responseText: respGemini("Paciente en control, LDL fuera de meta.") }), 0);
        },
      });
      t.cierto(c.api.mtrGuardarClaveGemini("CLAVE-DE-PRUEBA"), "se guarda la clave");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.cierto(r.ok && /fuera de meta/.test(r.texto), "entrega el texto del modelo");
      t.cierto(vistoKeyPresente, "la clave va por cabecera x-goog-api-key");
      t.cierto(urlLlamada.indexOf("CLAVE-DE-PRUEBA") < 0, "la clave NUNCA va en la URL");
      t.igual(vistoContentType, "application/json", "cuerpo JSON");
    });

    await t.casoAsync("una red caída cae seguro (motivo, sin lanzar)", async () => {
      const c = cargar({ silencioso: true, gmxhr: (opts) => setTimeout(() => opts.onerror(new Error("down")), 0) });
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.falso(r.ok, "no ok");
      t.cierto(/red/.test(r.motivo), "el motivo lo explica");
    });

    // ================= ESTILO Y CLAVE =================

    t.caso("los ejemplos de estilo se guardan desidentificados y se limitan a 3", () => {
      const c = cargar({ silencioso: true });
      c.api.mtrEstiloGuardar("Paciente acude a control de su programa; correo juan@x.com por error incluido, y evoluciona estable sin novedades.");
      const arr = c.api.mtrEstiloLeer();
      t.igual(arr.length, 1, "un ejemplo guardado");
      t.cierto(arr[0].indexOf("juan@x.com") < 0, "el correo se censuró al guardar");
      for (let i = 0; i < 5; i++) c.api.mtrEstiloGuardar("Ejemplo número " + i + " con suficiente texto para enseñar el estilo del médico.");
      t.igual(c.api.mtrEstiloLeer().length, 3, "nunca más de 3");
    });

    t.caso("un ejemplo demasiado corto no se guarda (no enseña nada)", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api.mtrEstiloGuardar("corto"), "muy corto, rechazado");
      t.igual(c.api.mtrEstiloLeer().length, 0, "nada guardado");
    });

    t.caso("el modelo es AUTOMÁTICO (no editable) y arranca en el lite de mayor capacidad", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api.mtrModeloGemini(), "gemini-3.5-flash-lite", "el de 500 solicitudes/día va primero");
    });

    t.caso("la rotación avanza por la lista, persiste por día y da la vuelta", () => {
      const c = cargar({ silencioso: true });
      t.igual(c.api._mtrModeloIdx(), 0, "arranca en el índice 0 (sin nada persistido)");
      t.igual(c.api.mtrRotarModelo(), "gemini-3.1-flash-lite", "rota al segundo lite (también 500/día)");
      t.igual(c.api.mtrModeloGemini(), "gemini-3.1-flash-lite", "el actual queda en el nuevo");
      t.igual(c.api._mtrModeloIdx(), 1, "y el índice persistido lo confirma");
      // v17.4.0 — la lista pasó de 5 a 7 (se sumaron gemini-2.5-flash-lite y gemini-3-flash,
      // ver MTR_GEMINI_MODELOS): ahora hacen falta 6 rotaciones más para dar la vuelta completa.
      c.api.mtrRotarModelo(); c.api.mtrRotarModelo(); c.api.mtrRotarModelo(); c.api.mtrRotarModelo(); c.api.mtrRotarModelo(); // idx 2,3,4,5,6
      c.api.mtrRotarModelo(); // idx 6 -> 0: da la vuelta
      t.igual(c.api.mtrModeloGemini(), "gemini-3.5-flash-lite", "tras recorrer los 7, vuelve al primero");
    });

    t.caso("mtrEsCuotaAgotada reconoce 429 y RESOURCE_EXHAUSTED, no un 200 normal", () => {
      t.cierto(api.mtrEsCuotaAgotada(429, ""), "status 429");
      t.cierto(api.mtrEsCuotaAgotada(200, '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), "cuerpo con RESOURCE_EXHAUSTED");
      t.falso(api.mtrEsCuotaAgotada(200, '{"candidates":[]}'), "una respuesta 200 normal no es cuota");
      t.falso(api.mtrEsCuotaAgotada(500, "server error"), "un 500 no es cuota");
    });

    // v17.0.3 — Reporte real: "Análisis y plan" murió con "This model is currently
    // experiencing high demand..." y el médico tuvo que reintentar A MANO porque el
    // conector solo rotaba de modelo ante cuota agotada (429), no ante saturación (503).
    t.caso("mtrEsModeloSobrecargado reconoce 503/UNAVAILABLE/«alta demanda», no los confunde con cuota ni con un 200 normal", () => {
      t.cierto(api.mtrEsModeloSobrecargado(503, ""), "status 503");
      t.cierto(api.mtrEsModeloSobrecargado(200, '{"error":{"code":503,"status":"UNAVAILABLE"}}'), "cuerpo con UNAVAILABLE");
      t.cierto(api.mtrEsModeloSobrecargado(503, "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."), "el mensaje real de Google, tal cual");
      t.falso(api.mtrEsModeloSobrecargado(200, '{"candidates":[]}'), "una respuesta 200 normal no es saturación");
      t.falso(api.mtrEsModeloSobrecargado(429, '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), "cuota agotada NO es lo mismo que modelo saturado");
    });

    await t.casoAsync("el conector ROTA de modelo ante 429 y reintenta hasta lograrlo", async () => {
      const modelos = [];
      const c = cargar({ silencioso: true, gmxhr: (opts) => {
        const m = /models\/([^:]+):/.exec(opts.url || ""); modelos.push(m ? m[1] : "?");
        if (modelos.length < 3) setTimeout(() => opts.onload({ status: 429, responseText: '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}' }), 0);
        else setTimeout(() => opts.onload({ status: 200, responseText: respGemini("nota redactada") }), 0);
      }});
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.cierto(r.ok && /redactada/.test(r.texto), "tras rotar, entrega el texto");
      t.igual(modelos.length, 3, "dos cuotas + un éxito = tres intentos");
      t.cierto(modelos[0] !== modelos[1] && modelos[1] !== modelos[2], "cambió de modelo en cada reintento");
    });

    await t.casoAsync("si TODOS los modelos gratuitos dan cuota, informa cuota agotada sin lanzar", async () => {
      const c = cargar({ silencioso: true, gmxhr: (opts) => setTimeout(() => opts.onload({ status: 429, responseText: '{"error":{"code":429}}' }), 0) });
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.falso(r.ok, "no ok");
      t.cierto(/cuota/i.test(r.motivo), "el motivo dice cuota agotada");
    });

    // v17.0.3 — antes esto se rendía en el primer intento (mtrEsCuotaAgotada no reconoce
    // 503): el médico veía el error crudo de Google y tenía que darle a Generar de nuevo A
    // MANO, reintentando encima el MISMO modelo saturado (mtrModeloGemini("enfermedad_actual")
    // siempre da el potente en el primer intento). Ahora rota igual que con la cuota.
    await t.casoAsync("el conector ROTA de modelo ante 503/«alta demanda» igual que ante cuota agotada", async () => {
      const modelos = [];
      const c = cargar({ silencioso: true, gmxhr: (opts) => {
        const m = /models\/([^:]+):/.exec(opts.url || ""); modelos.push(m ? m[1] : "?");
        if (modelos.length < 2) setTimeout(() => opts.onload({ status: 503, responseText: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later." }), 0);
        else setTimeout(() => opts.onload({ status: 200, responseText: respGemini("nota redactada tras rotar") }), 0);
      }});
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "analisis_plan", {});
      t.cierto(r.ok && /rotar/.test(r.texto), "tras rotar por saturación, entrega el texto");
      t.igual(modelos.length, 2, "un modelo saturado + un éxito = dos intentos");
      t.cierto(modelos[0] !== modelos[1], "cambió de modelo");
    });

    await t.casoAsync("si TODOS los modelos están saturados, informa «alta demanda» (no lo confunde con cuota) sin lanzar", async () => {
      const c = cargar({ silencioso: true, gmxhr: (opts) => setTimeout(() => opts.onload({ status: 503, responseText: '{"error":{"code":503,"status":"UNAVAILABLE","message":"The model is overloaded."}}' }), 0) });
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.falso(r.ok, "no ok");
      t.cierto(/satura/i.test(r.motivo), "el motivo dice saturado/alta demanda");
      t.falso(/cuota/i.test(r.motivo), "y NO dice cuota agotada: es un motivo distinto");
    });

    // v17.6.69 — REPORTE DE CAMPO (26-ago-2026): "gemini-3.7-flash sigue apareciendo, no
    // rota" — la rotación de `onload` (429/503/etc., pruebas de arriba) NUNCA se disparaba
    // ante un TIMEOUT de red, porque `ontimeout` resolvía como fallo de inmediato sin pasar
    // por `_mereceRotar`. El primer intento de una nota larga usa siempre el modelo
    // POTENTE (el más grande/lento): un timeout suyo dejaba al médico sin nota, sin haber
    // tocado ninguno de los modelos de respaldo.
    await t.casoAsync("el conector ROTA de modelo ante un TIMEOUT de red, igual que ante 429/503 (bug real reportado en consultorio)", async () => {
      const modelos = [];
      const c = cargar({ silencioso: true, gmxhr: (opts) => {
        const m = /models\/([^:]+):/.exec(opts.url || ""); modelos.push(m ? m[1] : "?");
        if (modelos.length < 2) setTimeout(() => opts.ontimeout(), 0);
        else setTimeout(() => opts.onload({ status: 200, responseText: respGemini("nota redactada tras rotar por timeout") }), 0);
      }});
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "analisis_plan", {});
      t.cierto(r.ok && /rotar por timeout/.test(r.texto), "tras rotar por timeout, entrega el texto");
      t.igual(modelos.length, 2, "un timeout + un éxito = dos intentos");
      t.cierto(modelos[0] !== modelos[1], "cambió de modelo (el potente truena, el reintento usa el siguiente de la rotación)");
    });

    await t.casoAsync("si TODOS los modelos truenan por timeout, informa 'tiempo agotado en todos los modelos' sin lanzar", async () => {
      const modelos = [];
      const c = cargar({ silencioso: true, gmxhr: (opts) => {
        const m = /models\/([^:]+):/.exec(opts.url || ""); modelos.push(m ? m[1] : "?");
        setTimeout(() => opts.ontimeout(), 0);
      }});
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "enfermedad_actual", {});
      t.falso(r.ok, "no ok");
      t.cierto(/tiempo agotado/i.test(r.motivo), "el motivo explica que fue timeout");
      // v17.6.81 — desde que las notas largas también entran a la rotación de cuota (ya no
      // arrancan siempre en el modelo potente), el primer intento puede caer en cualquier
      // punto de la lista. Lo que importa es que SÍ rotó en cada paso (nunca repitió el
      // modelo del intento INMEDIATAMENTE anterior) y que agotó los `maxIntentos`
      // disponibles antes de rendirse — no una repetición ciega del primero.
      for (let i = 1; i < modelos.length; i++) {
        t.cierto(modelos[i] !== modelos[i - 1], "el intento " + i + " no repite el modelo del intento inmediatamente anterior");
      }
      // 7 modelos en MTR_GEMINI_MODELOS (ver "la rotación avanza..." arriba, ya hardcodeado
      // igual en esa prueba): maxIntentos = MTR_GEMINI_MODELOS.length.
      t.igual(modelos.length, 7, "se agotaron TODOS los modelos de la rotación antes de rendirse");
      t.cierto(modelos.length >= 2, "agotó más de un modelo antes de rendirse");
    });

    // v17.6.22 — REPORTE DE CAMPO (24-ago-2026): "los resultados a veces aparecen
    // cortados incompletos". mtrRespuestaGemini trata MAX_TOKENS como éxito A PROPÓSITO
    // (texto parcial es mejor que nada), pero antes de esta versión NADA en el camino le
    // decía al médico que el borrador estaba incompleto — llegaba con el mismo "Borrador
    // listo" de siempre. Estas dos pruebas protegen, por separado: (1) que el conector
    // SIGUE entregando el texto parcial con ok=true (comportamiento deliberado, no romperlo)
    // y (2) que el mensaje honesto de mtrEstadoBorrador distingue ese caso.
    await t.casoAsync("mtrGeminiRedactar: MAX_TOKENS entrega el texto parcial con ok=true y el finishReason viaja intacto", async () => {
      const respTruncada = JSON.stringify({ candidates: [{ content: { parts: [{ text: "ANÁLISIS: el paciente presenta hipertensión arterial en manejo con" }] }, finishReason: "MAX_TOKENS" }] });
      const c = cargar({ silencioso: true, gmxhr: (opts) => setTimeout(() => opts.onload({ status: 200, responseText: respTruncada }), 0) });
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "analisis_plan", {});
      t.cierto(r.ok, "un borrador parcial sigue siendo mejor que nada: no se descarta");
      t.cierto(/manejo con$/.test(r.texto), "el texto parcial llega tal cual, cortado donde el modelo se quedó sin espacio");
      t.igual(r.finishReason, "MAX_TOKENS", "la bandera viaja para que el panel pueda avisar");
    });

    t.caso("mtrEstadoBorrador: MAX_TOKENS avisa honestamente que el borrador puede estar incompleto", () => {
      t.cierto(/incompleto/i.test(api.mtrEstadoBorrador({ ok: true, finishReason: "MAX_TOKENS" })), "MAX_TOKENS: avisa incompleto");
      t.igual(api.mtrEstadoBorrador({ ok: true, finishReason: "STOP" }), "Borrador listo. Revíselo y edítelo antes de usarlo.", "STOP normal: mensaje de siempre");
      t.igual(api.mtrEstadoBorrador(null), "Borrador listo. Revíselo y edítelo antes de usarlo.", "sin objeto: no lanza, mensaje por defecto");
    });

    // v17.6.22 — REPORTE DE CAMPO (mismo día): "no tiene en cuenta los datos que yo pongo
    // en el cuadro de texto" (Revisión por sistemas / Examen físico de Everest). Causa
    // real: el panel leía mtrLeerTextoLibreHistoria() UNA sola vez al abrirse y reutilizaba
    // esa foto para cada "Generar" — si el médico seguía escribiendo en esas casillas
    // DESPUÉS de abrir el Redactor (lo normal: el panel queda abierto mientras redacta),
    // el borrador se generaba con la foto vieja. La función en sí ya era barata y sin
    // efectos secundarios (una consulta al DOM); el defecto era CUÁNDO se llamaba, no
    // cómo. No hay una unidad aislable para probar "se llama en el momento del clic" sin
    // reconstruir el modal completo — se protege por texto fuente, mismo criterio que ya
    // usa este archivo para "uxTrack no arrastra texto clínico" (ver más abajo).
    t.caso("el panel de redacción ya NO congela el texto libre en una foto única al abrir", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/const libre = mtrLeerTextoLibreHistoria\(\)/.test(src), "la foto única (v17.6.21 y anteriores) no debe reaparecer");
      const usos = (src.match(/contextoLibre:\s*libreAhora\(\)\.combinado/g) || []).length;
      t.igual(usos, 2, "los dos disparadores de generación (Generar y Generar todo) leen fresco en el momento del clic");
    });

    // v17.6.24 — AUDITORÍA S+ (24-ago-2026): «❓ Preguntar sobre este paciente» comparte el
    // selector delegado de los 3 chips de casilla (.vgl-ia-modos [data-modo]) y SÍ recibe la
    // clase .active al seleccionarlo, pero lleva class="vgl-agm-btn sec" (no vgl-agm-pbtn) y
    // no existía ninguna regla CSS .active para esa combinación: el clic cambiaba de modo de
    // verdad (aparecía el campo de pregunta) pero apagaba los 3 chips sin encender nada —
    // parecía que el clic no había hecho efecto.
    t.caso("v17.6.24: el botón «Preguntar» tiene una regla CSS .active (antes no existía ninguna)", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/\.vgl-agm-btn\.sec\.active\s*\{/.test(src), "existe una regla que targetea .vgl-agm-btn.sec.active");
      t.cierto(/class="vgl-agm-btn sec"[^>]*id="vgl-ia-btn-preguntar"/.test(src),
        "el botón Preguntar sigue llevando exactamente las clases que la regla nueva cubre");
    });

    // v17.6.26 — REPORTE DE CAMPO (24-ago-2026): "¿ya auditaste si el cuadro de texto libre
    // y Datos del paciente no sean algo redundante? deja una sola opción que sirva para
    // todo". El modal "➕ Datos del paciente" (9 campos tras un botón) y el textarea
    // "Indicaciones" del panel principal alimentaban el MISMO bloque del prompt — se retira
    // el modal por completo y "Indicaciones" pasa a cubrir todo. La caja roja de críticos
    // (_pintarCriticos) se conserva: es un guardián que bloquea la generación, no una
    // alternativa de captura de texto.
    t.caso("v17.6.26: «➕ Datos del paciente» se retiró por completo (redundante con Indicaciones)", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/function mtrAbrirDatosAdicionales/.test(src), "la función del modal ya no existe");
      t.falso(/vgl-ia-datos-btn/.test(src), "ni su botón");
      t.cierto(/Datos e indicaciones para este borrador/.test(src), "«Indicaciones» ahora rotula que cubre también los datos");
      // La caja roja de críticos, que SÍ debe sobrevivir (bloquea Análisis y plan sin
      // categoría de riesgo), sigue intacta.
      t.cierto(/function mtrDatosExtraGuardar/.test(src) && /function mtrDatosExtraLeer/.test(src), "el almacén sigue vivo: lo sigue usando _pintarCriticos");
    });

    // v17.6.26 — REPORTE DE CAMPO (mismo día): "ya que tendremos guardado automático,
    // borra el botón de guardar mi estilo y todas esas opciones — ahora será
    // inteligentemente automático". Se retira el botón manual «💾 Guardar mi estilo» y el
    // checkbox «Mi estilo»: mtrEstiloGuardar se llama sola cuando el médico acepta un
    // borrador SIN editarlo (delta "intacta"), y mtrRedaccionPrompt usa los ejemplos
    // guardados siempre que haya al menos uno, sin marcar nada.
    t.caso("v17.6.26: el guardado de estilo es automático — sin botón manual ni checkbox", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.falso(/vgl-ia-estilo-guardar/.test(src), "el botón «Guardar mi estilo» ya no existe");
      t.falso(/id="vgl-ia-estilo"/.test(src), "ni el checkbox «Mi estilo»");
      t.falso(/o\.usarEstilo/.test(src), "mtrRedaccionPrompt ya no depende de un interruptor manual");
      t.cierto(/const _autoAprenderEstilo = \(delta\) => \{\s*\n\s*if \(delta === "intacta"\)/.test(src),
        "el aprendizaje automático solo guarda cuando el médico aceptó el borrador TAL CUAL (delta intacta)");
      const usos = (src.match(/_autoAprenderEstilo\(delta\);/g) || []).length;
      t.igual(usos, 2, "se llama en los dos caminos de aceptación: Copiar e Insertar/Reemplazar (vía _registrarInsercion)");
    });

    // v17.3.0 — Reporte real de consola (21-ago): "Análisis y plan" y "Recomendaciones"
    // morían de un solo tiro con 404 (gemini-2.5-flash, retirado por Google) o 400 (el
    // propio gemini-3.7-flash, recién liberado, lo devolvió varias veces esa misma
    // sesión) — ninguno de los dos es cuota agotada ni "alta demanda", así que
    // mtrEsCuotaAgotada/mtrEsModeloSobrecargado los dejaban pasar de largo: CERO
    // reintentos, directo al mensaje de fallo (o al volcado crudo de hechos sin
    // redactar). mtrEsModeloNoDisponible cierra ese hueco.
    t.caso("mtrEsModeloNoDisponible reconoce 400/404/500/502/504 y sus cuerpos típicos, no un 200/429/503 normal", () => {
      t.cierto(api.mtrEsModeloNoDisponible(404, ""), "status 404 (modelo retirado)");
      t.cierto(api.mtrEsModeloNoDisponible(400, ""), "status 400 (modelo rechazó la solicitud)");
      t.cierto(api.mtrEsModeloNoDisponible(500, ""), "status 500");
      t.cierto(api.mtrEsModeloNoDisponible(502, ""), "status 502");
      t.cierto(api.mtrEsModeloNoDisponible(504, ""), "status 504");
      t.cierto(api.mtrEsModeloNoDisponible(200, '{"error":{"code":404,"status":"NOT_FOUND"}}'), "cuerpo con NOT_FOUND");
      t.cierto(api.mtrEsModeloNoDisponible(200, '{"error":{"code":400,"status":"INVALID_ARGUMENT"}}'), "cuerpo con INVALID_ARGUMENT");
      t.cierto(api.mtrEsModeloNoDisponible(404, "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash instead."), "el mensaje real de Google, tal cual (21-ago)");
      t.falso(api.mtrEsModeloNoDisponible(200, '{"candidates":[]}'), "una respuesta 200 normal no es 'no disponible'");
      t.falso(api.mtrEsModeloNoDisponible(429, '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'), "cuota agotada NO es lo mismo que modelo no disponible");
      t.falso(api.mtrEsModeloNoDisponible(503, "This model is currently experiencing high demand."), "saturado NO es lo mismo que modelo no disponible");
    });

    await t.casoAsync("el conector ROTA de modelo ante 404 (modelo retirado) igual que ante cuota agotada o saturación", async () => {
      const modelos = [];
      const c = cargar({ silencioso: true, gmxhr: (opts) => {
        const m = /models\/([^:]+):/.exec(opts.url || ""); modelos.push(m ? m[1] : "?");
        if (modelos.length < 2) setTimeout(() => opts.onload({ status: 404, responseText: '{"error":{"code":404,"status":"NOT_FOUND","message":"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash instead."}}' }), 0);
        else setTimeout(() => opts.onload({ status: 200, responseText: respGemini("nota redactada tras rotar por 404") }), 0);
      }});
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "analisis_plan", {});
      t.cierto(r.ok && /rotar por 404/.test(r.texto), "tras rotar por modelo retirado, entrega el texto");
      t.igual(modelos.length, 2, "un modelo retirado + un éxito = dos intentos");
      t.cierto(modelos[0] !== modelos[1], "cambió de modelo");
    });

    await t.casoAsync("el conector también ROTA ante 400 (el modelo insignia recién liberado lo devolvió varias veces en consola real)", async () => {
      const modelos = [];
      const c = cargar({ silencioso: true, gmxhr: (opts) => {
        const m = /models\/([^:]+):/.exec(opts.url || ""); modelos.push(m ? m[1] : "?");
        if (modelos.length < 2) setTimeout(() => opts.onload({ status: 400, responseText: '{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"Thinking level MINIMAL is not supported for this model."}}' }), 0);
        else setTimeout(() => opts.onload({ status: 200, responseText: respGemini("nota redactada tras rotar por 400") }), 0);
      }});
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "recomendaciones", {});
      t.cierto(r.ok && /rotar por 400/.test(r.texto), "tras rotar por el 400 aislado, entrega el texto");
      t.igual(modelos.length, 2, "un 400 + un éxito = dos intentos");
    });

    await t.casoAsync("si TODOS los modelos configurados están 404/400, informa 'no disponible' (no lo confunde con cuota ni saturación) sin lanzar y sin caer al volcado crudo", async () => {
      const c = cargar({ silencioso: true, gmxhr: (opts) => setTimeout(() => opts.onload({ status: 404, responseText: '{"error":{"code":404,"status":"NOT_FOUND"}}' }), 0) });
      c.api.mtrGuardarClaveGemini("X");
      const r = await c.api.mtrGeminiRedactar(hojaDemo(c.api), "recomendaciones", {});
      t.falso(r.ok, "no ok");
      t.cierto(/ningún modelo|no disponible/i.test(r.motivo), "el motivo explica que ningún modelo respondió, no un error crudo");
      t.falso(/cuota/i.test(r.motivo), "y NO dice cuota agotada");
      t.falso(/satura/i.test(r.motivo), "ni saturado/alta demanda: es un motivo distinto");
    });

    t.caso("mtrHojaDesdeResumen arma la hoja desidentificada desde un resumen (sin meds en caché)", () => {
      const c = cargar({ silencioso: true });
      const resumen = { programa: "HTA", factores: { edad: 61, sexo: "F", diabetes: true, nombre: "SECRETO" }, riesgo: { categoria: "alto" }, _ultimos: { LDL: { valor: 118, fecha: "2026-06-10" } }, _hoyIso: "2026-08-17", _docId: "111" };
      const hoja = c.api.mtrHojaDesdeResumen(resumen);
      t.igual(hoja.demografia.edad, 61, "toma la edad del resumen");
      t.igual(hoja.labs.length, 1, "y los labs adjuntos");
      t.cierto(JSON.stringify(hoja).indexOf("SECRETO") < 0, "y sigue sin colar identificadores");
    });

    await t.casoAsync("mtrHojaDesdeResumen lee los medicamentos por _pacienteIdLabs, NO por _docId (auditoría 2026-08-18: eran llaves distintas y siempre daba cache-miss)", async () => {
      const c = cargar({
        silencioso: true,
        fetch: async () => ({ ok: true, status: 200, json: async () => require("./fixtures/everest_medicamentos.json").respuesta, text: async () => JSON.stringify(require("./fixtures/everest_medicamentos.json").respuesta) }),
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      await c.api.mtrRefrescarMedicamentos(555); // llena la caché bajo el id interno de Everest (pacienteIdLabs)
      const resumenSoloDocId = { _docId: "555", _pacienteIdLabs: null };
      t.igual(c.api.mtrHojaDesdeResumen(resumenSoloDocId).medicamentos.length, 0,
        "la cédula (_docId) nunca fue la llave de la caché: si el bug reaparece, esto vuelve a dar 0");
      const resumenConLlaveReal = { _docId: "555", _pacienteIdLabs: 555 };
      const hoja = c.api.mtrHojaDesdeResumen(resumenConLlaveReal);
      t.igual(hoja.medicamentos.length, 4, "con _pacienteIdLabs (la llave real) sí lee los 4 medicamentos vigentes");
      t.cierto(hoja.medicamentos.join("|").indexOf("METFORMINA") >= 0, "incluye la metformina de la caché");
    });

    // v17.2.0 (#114) — LA COSTURA ENTERA hasta lo que la IA de verdad lee: no basta con
    // que mtrMedicamentosRcv sepa incluir la frecuencia (suite 39) ni que la Ficha la
    // muestre (suite 15) — hace falta que mtrHojaDesdeResumen también la traiga y que
    // mtrHojaDeHechosTexto la escriba en la línea que se pega en el prompt de Gemini.
    // Es justo la tercera pata de lo que el médico pidió (Ficha/avisos/redacción con IA):
    // sin esta prueba, un typo en `medicamentosFrecuencia` en cualquier punto de la
    // cadena habría pasado en silencio.
    await t.casoAsync("mtrHojaDesdeResumen (#114): la frecuencia real llega hasta el texto que ve la IA", async () => {
      const fixHist = require("./fixtures/everest_historico_medicamentos.json");
      const fixMeds = require("./fixtures/everest_medicamentos.json");
      const c = cargar({
        silencioso: true,
        fetch: async (url) => (String(url).indexOf("HistoricoMedicamentoHCM") >= 0
          ? { ok: true, status: 200, json: async () => fixHist.respuesta, text: async () => JSON.stringify(fixHist.respuesta) }
          : { ok: true, status: 200, json: async () => fixMeds.respuesta, text: async () => JSON.stringify(fixMeds.respuesta) }),
        gmxhr: (o) => { if (o.onerror) o.onerror("url no simulada"); },
      });
      await c.api.mtrRefrescarMedicamentos(555);
      const hoja = c.api.mtrHojaDesdeResumen({ _docId: "555", _pacienteIdLabs: 555 });
      t.cierto(hoja.medicamentosFrecuencia && typeof hoja.medicamentosFrecuencia.get === "function",
        "la hoja trae el Map de frecuencias, no solo la lista de nombres");
      t.igual(hoja.medicamentosFrecuencia.get("metformina clorhidrato 850 mg tableta recubierta"), "cada 12 horas");
      const texto = c.api.mtrHojaDeHechosTexto(hoja);
      t.cierto(/METFORMINA[^\n]*\(cada 12 horas\)/.test(texto),
        "el texto que se pega en el prompt de Gemini trae la frecuencia real junto al fármaco: " + texto);
    });

    // ================= DATOS APORTADOS, JSON v68 Y TEXTO LIBRE =================

    t.caso("los datos aportados viven en memoria por paciente y no cruzan pacientes", () => {
      const c = cargar({ silencioso: true });
      c.api.mtrDatosExtraGuardar("111", { sintomas: "cefalea", adherencia: "buena" });
      t.igual(c.api.mtrDatosExtraLeer("111").sintomas, "cefalea", "se lee lo guardado");
      t.igual(c.api.mtrDatosExtraLeer("222"), null, "otro paciente no ve esos datos");
      c.api.mtrDatosExtraGuardar("222", { sintomas: "tos" });
      t.igual(c.api.mtrDatosExtraLeer("111"), null, "cambiar de paciente descarta lo anterior (no cruza)");
    });

    // v17.6.26 — REDUCIDO a los 3 campos de la caja roja de críticos (categoría de riesgo,
    // TFG, medicamentos): los otros 9 vivían en el modal "➕ Datos del paciente", retirado
    // por redundante con «Indicaciones» (ver test dedicado más abajo).
    t.caso("mtrDatosExtraTexto solo emite lo no vacío y desidentifica", () => {
      const txt = api.mtrDatosExtraTexto({ medicamentosAportados: "losartán, tel 3151234567", tfgAportada: "", categoriaRiesgoConfirmada: "ALTO" });
      t.cierto(/MEDICAMENTOS.*losartán/.test(txt), "incluye medicamentos");
      t.cierto(txt.indexOf("TFG") < 0, "omite lo vacío");
      t.cierto(txt.indexOf("3151234567") < 0, "censura el teléfono colado");
    });

    t.caso("mtrJsonV68DesdeResumen mapea lo determinista y deja la prosa en blanco", () => {
      const resumen = {
        _hoyIso: "2026-08-23",
        programa: "HTA", erc: { crcl: 48, egfr: 52, estadioAdministrativo: "G3a", estadioClinico: "G3a", remitirNefrologia: false, datosCompletos: true },
        riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70, cnoHdl: 100 } }, foco: "renal",
        // v17.6.56 (1.14) — order_list ahora sale de plan.ordenar (lo que el motor de
        // verdad va a ordenar: faltantes+vencidos de los drivers, MÁS lo cosechado y los
        // pasajeros en estado A), no de faltantes+vencidos crudos. faltantes/vencidos se
        // conservan aquí porque otros campos del JSON (no probados en este caso) los usan.
        plan: { ftl: "2026-09-01", control: { fecha: "2026-09-07" }, faltantes: [{ clave: "RAC" }], vencidos: [{ clave: "HBA1C" }], ordenar: [{ clave: "RAC" }, { clave: "HBA1C" }] },
      };
      // v17.6.64 (sección 4) — cno_hdl/cno_hdl_target viajan calculados en el JSON, para
      // que la IA solo los cite, nunca los invente.
      const j = api.mtrJsonV68DesdeResumen(resumen, { medicamentos: ["LOSARTAN 50 MG"], cNoHDL: 160 });
      t.igual(j.version, "68", "versión");
      t.igual(j.cv_risk, "alto", "riesgo");
      t.igual(j.tfg_ckdepi, 52, "TFG clínica");
      t.igual(j.estadio_administrativo, "G3a", "estadio admin");
      t.igual(j.ldl_target, 70, "meta");
      t.igual(j.cno_hdl, 160, "cNoHDL calculado viaja en el JSON");
      t.igual(j.cno_hdl_target, 100, "y su meta");
      t.cierto(j.order_list.indexOf("RAC") >= 0 && j.order_list.indexOf("HBA1C") >= 0, "order_list");
      // v17.6.8 — las fechas de agenda se relativizan (cuasi-identificadores): nunca crudas.
      t.igual(j.ftl_date, "en 9 días", "FTL se relativiza respecto a hoy (9 días del 23-ago al 1-sep)");
      t.igual(j.control_date, "en 15 días", "control se relativiza igual (15 días al 7-sep)");
      t.igual(j.nota_clinica.justificacion_riesgo_meta, "", "la prosa la escribe el LLM, no el motor");
    });

    t.caso("v17.26.0 — ldl_reduction_target viaja calculado (bug real: el prompt tenía '≥50%' fijo, la IA lo citaba y el verificador de cifras lo marcaba en rojo)", () => {
      // Reporte en vivo (28-ago, paciente real): "META TERAPÉUTICA DE LDL: MENOR A 70
      // MG/DL Y REDUCCIÓN MAYOR O IGUAL AL 50% DEL BASAL" salió con el 50 marcado como
      // cifra sin respaldo, porque ese 50 vivía SOLO en la instrucción del prompt, nunca
      // en el JSON que la IA recibe como fuente de verdad. Mismo criterio que ldl_target.
      const resumenAlto = {
        _hoyIso: "2026-08-23", programa: "HTA",
        erc: { crcl: 48, egfr: 52, estadioAdministrativo: "G3a", estadioClinico: "G3a", remitirNefrologia: false, datosCompletos: true },
        riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70, reduccion: 50 } }, foco: "renal",
        plan: { faltantes: [], vencidos: [], ordenar: [] },
      };
      const jAlto = api.mtrJsonV68DesdeResumen(resumenAlto, {});
      t.igual(jAlto.ldl_reduction_target, 50, "riesgo alto: viaja el 50% real, no un texto fijo");

      // Riesgo moderado/bajo: mtrMetasLipidicas no exige reducción (reduccion: null en la
      // tabla) — CERO INFERENCIA, nunca se inventa un porcentaje que la norma no exige.
      const resumenModerado = Object.assign({}, resumenAlto, {
        riesgo: { categoria: "moderado" }, meta: { metas: { ldl: 100, reduccion: null } },
      });
      const jModerado = api.mtrJsonV68DesdeResumen(resumenModerado, {});
      t.igual(jModerado.ldl_reduction_target, null, "riesgo moderado: null, nunca un 50% que no aplica");

      // Y el mismo número, ahora por el canal de la hoja de hechos (mtrHojaDesdeResumen /
      // mtrHojaDeHechosTexto), que es lo que mtrVerificarCifrasIA escanea para saber qué
      // cifras son legítimas: el "50" debe quedar reconocido sin declarar extraConocido.
      const hoja = { metaLdl: 70, metaReduccionLdl: 50 };
      const texto = api.mtrHojaDeHechosTexto(hoja);
      t.cierto(/reducci.n .?50 ?%/i.test(texto), "la hoja de hechos en texto plano también dice el porcentaje");
      const marcadas = api.mtrVerificarCifrasIA("META TERAPÉUTICA DE LDL: MENOR A 70 MG/DL Y REDUCCIÓN MAYOR O IGUAL AL 50% DEL BASAL.", hoja);
      t.igual(marcadas.length, 0, "el 50% ya no se marca como cifra sin respaldo: viaja grounded en la hoja");
    });

    // [auditoría 25-ago, hallazgo 1.14] order_list armaba faltantes+vencidos crudos, sin
    // pasar por plan.ordenar — que SÍ incluye lo cosechado (un examen vigente que se
    // adelanta a esta misma toma porque le queda poca vigencia) y los pasajeros en A. Un
    // cosechado que no está en faltantes NI en vencidos (por definición: si estuviera
    // vencido no habría nada que cosechar) desaparecía de la nota clínica que el médico
    // copia a la historia, aunque el asistente SÍ lo fuera a ordenar de verdad.
    t.caso("mtrJsonV68DesdeResumen (1.14): order_list incluye lo COSECHADO, que faltantes/vencidos por sí solos no traen", () => {
      const resumen = {
        _hoyIso: "2026-08-23",
        programa: "HTA", erc: { crcl: 48, egfr: 52, estadioAdministrativo: "G3a", estadioClinico: "G3a", remitirNefrologia: false, datosCompletos: true },
        riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } }, foco: "renal",
        plan: {
          ftl: "2026-09-01", control: { fecha: "2026-09-07" },
          faltantes: [{ clave: "RAC" }], vencidos: [],
          // HDL cosechado: ni faltante ni vencido, pero SÍ va en la orden real.
          ordenar: [{ clave: "RAC" }, { clave: "COLESTEROL_HDL" }],
        },
      };
      const j = api.mtrJsonV68DesdeResumen(resumen, { medicamentos: [] });
      t.cierto(j.order_list.indexOf("RAC") >= 0, "el faltante sigue apareciendo");
      t.cierto(j.order_list.indexOf("COLESTEROL_HDL") >= 0,
        "el cosechado (COLESTEROL_HDL) debe aparecer en order_list — bug real: solo faltantes/vencidos, esto no salía");
    });

    // =====================================================================
    // v17.6.76 — auditoría 25-ago (ítem 4): el motor ya calcula, en mtrConsolidarMtt
    // (resumen.fallas.fusiones/.fechasDedicadas, vía mtrPlanFallas), cuándo el recontrol
    // de una falla terapéutica grave (LDL/HbA1c) se retoma en la misma visita que la FTL
    // maestra ("fusión") o necesita una visita aparte y prioritaria ("fecha dedicada") —
    // pero esa información nunca salía en el JSON que lee la IA. Se expone como
    // order_list_mtt, con fechas relativizadas (mismo criterio que ftl_date/control_date).
    // =====================================================================
    t.caso("mtrJsonV68DesdeResumen (ítem 4): order_list_mtt expone las fusiones y fechas dedicadas que mtrConsolidarMtt ya calculó", () => {
      const resumen = {
        _hoyIso: "2026-08-16",
        programa: "DM2", erc: {}, riesgo: { categoria: "alto" }, meta: {},
        plan: { ftl: "2026-09-01", control: { fecha: "2026-09-08" } },
        fallas: {
          fusiones: [{ analito: "ldl", fecha: "2026-09-01", gravedad: "grave", fusionadoAFtl: "2026-09-01", difDias: 0 }],
          fechasDedicadas: [{ analito: "hba1c", fecha: "2026-10-15", gravedad: "grave", analitos: ["hba1c"] }],
        },
      };
      const j = api.mtrJsonV68DesdeResumen(resumen, {});
      t.cierto(!!j.order_list_mtt, "el campo existe");
      t.igual(j.order_list_mtt.fusiones.length, 1);
      t.igual(j.order_list_mtt.fusiones[0].analito, "ldl");
      t.igual(j.order_list_mtt.fusiones[0].fecha, "en 16 días", "fecha relativizada, nunca cruda (cuasi-identificador fuera del prompt)");
      t.igual(j.order_list_mtt.fechas_dedicadas.length, 1);
      t.igual(j.order_list_mtt.fechas_dedicadas[0].analitos, ["hba1c"]);
      t.igual(j.order_list_mtt.fechas_dedicadas[0].fecha, "en ~2 meses");
    });

    t.caso("mtrJsonV68DesdeResumen (ítem 4): fechas dedicadas COLAPSADAS (dos analitos cercanos) llegan con los DOS nombres en analitos, no duplicadas", () => {
      const resumen = {
        _hoyIso: "2026-08-16",
        programa: "DM2", erc: {}, riesgo: {}, meta: {},
        plan: { ftl: "2026-09-01", control: {} },
        fallas: {
          fusiones: [],
          // mtrConsolidarMtt ya colapsa fechas dedicadas <=7 días entre sí en un solo
          // registro con `analitos: [...]` — se simula aquí el resultado ya colapsado.
          fechasDedicadas: [{ analito: "ldl", fecha: "2026-10-01", analitos: ["ldl", "hba1c"] }],
        },
      };
      const j = api.mtrJsonV68DesdeResumen(resumen, {});
      t.igual(j.order_list_mtt.fechas_dedicadas.length, 1, "un solo registro, no dos");
      t.igual(j.order_list_mtt.fechas_dedicadas[0].analitos, ["ldl", "hba1c"], "los dos analitos colapsados viajan juntos");
    });

    t.caso("mtrJsonV68DesdeResumen (ítem 4): CERO INFERENCIA — sin resumen.fallas (o sin recontroles graves), order_list_mtt sale con listas vacías, nunca inventadas", () => {
      const sinFallas = { _hoyIso: "2026-08-16", programa: "HTA", erc: {}, riesgo: {}, meta: {}, plan: {} };
      const j1 = api.mtrJsonV68DesdeResumen(sinFallas, {});
      t.cierto(!!j1.order_list_mtt, "el campo siempre existe (estructura estable)");
      t.igual(j1.order_list_mtt.fusiones, [], "sin fallas, sin fusiones inventadas");
      t.igual(j1.order_list_mtt.fechas_dedicadas, [], "ni fechas dedicadas inventadas");

      const conFallasVacias = Object.assign({}, sinFallas, { fallas: { fusiones: [], fechasDedicadas: [] } });
      const j2 = api.mtrJsonV68DesdeResumen(conFallasVacias, {});
      t.igual(j2.order_list_mtt.fusiones, []);
      t.igual(j2.order_list_mtt.fechas_dedicadas, []);

      // fallas presente pero con forma inesperada (defensivo, no debe lanzar).
      let j3;
      t.noLanza(() => { j3 = api.mtrJsonV68DesdeResumen(Object.assign({}, sinFallas, { fallas: { fusiones: null, fechasDedicadas: "no-array" } }), {}); });
      t.igual(j3.order_list_mtt.fusiones, []);
      t.igual(j3.order_list_mtt.fechas_dedicadas, []);
    });

    t.caso("SEGURIDAD: sin TFG ni meta, el JSON v68 emite null (NUNCA 0) para no afirmar 'TFG 0'", () => {
      // Paciente sin creatinina/peso: mtrEvaluarErc devuelve egfr/crcl null. Un 0 aquí hacía
      // que la IA escribiera 'TFG 0, estadio terminal' o 'meta LDL <0'. Debe ser null.
      const resumen = { programa: "HTA", erc: { crcl: null, egfr: null, datosCompletos: false }, riesgo: {}, meta: {}, plan: {} };
      const j = api.mtrJsonV68DesdeResumen(resumen, {});
      t.igual(j.tfg_cg, null, "TFG C-G null, no 0");
      t.igual(j.tfg_ckdepi, null, "TFG CKD-EPI null, no 0");
      t.igual(j.ldl_target, null, "meta LDL null, no 0");
      t.igual(j.datos_completos, false, "y marca datos incompletos");
    });

    // ===== v17.6.89 — el JSON dejaba de decir que la estratificación quedó pendiente =====
    //
    // Tres defectos verificados con el harness sobre el mismo paciente (45 años, sin factores
    // documentados, sin ASCVD, pasos 1-3 no clasifican):
    //   datos_completos: true   (solo miraba la función renal, no el riesgo)
    //   cv_risk:         ""     (v68 pide null: "N/A=null")
    //   status:          ""     SIEMPRE — leía `r.meta.status`, que NO EXISTE
    //                           (`mtrEvaluarMetaLdl` expone `estado`). Campo muerto.
    // La IA recibía "paciente evaluado, todo completo" y redactaba en consecuencia, sin la
    // SOLICITUD de ASCVD que v68 exige.
    const sinClasificar = () => api.mtrResumenClinico({
      hoyIso: "2026-08-26", edad: 45, sexo: "M", pesoKg: 70, creatinina: 0.9,
      factores: {}, ultimos: { CREATININA: { fecha: "2026-08-01", valor: 0.9 } },
    });

    t.caso("v17.6.89: si la estratificación no se pudo hacer, el JSON lo DICE (no afirma completitud)", () => {
      const r = sinClasificar();
      t.igual(r.riesgo.categoria, null, "el vector es el que debe ser: no se clasificó");
      t.cierto(r.riesgo.requiereAscvd, "y el motor sabe que le falta el ASCVD");
      const j = api.mtrJsonV68DesdeResumen(r, api.mtrHojaDesdeResumen(r));
      t.igual(j.datos_completos, false, "datos_completos NO puede decir true");
      t.igual(j.cv_risk, null, "cv_risk es null, no cadena vacía (v68: N/A=null)");
      t.igual(j.status, "PENDIENTE", "status dice PENDIENTE");
      t.cierto(/ASCVD/.test(j.solicitud), "y trae la SOLICITUD literal: " + j.solicitud);
    });

    t.caso("v17.6.89: sin TFG la solicitud es la de la TFG, no la del ASCVD", () => {
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 60, sexo: "M", pesoKg: 80,
        factores: { hta: true }, ultimos: {},
      });
      const j = api.mtrJsonV68DesdeResumen(r, api.mtrHojaDesdeResumen(r));
      t.igual(j.status, "PENDIENTE", "sigue siendo PENDIENTE");
      t.cierto(/TFG/.test(j.solicitud), "pero la solicitud nombra la TFG: " + j.solicitud);
    });

    t.caso("v17.6.89: en un paciente SÍ clasificado, status refleja la meta y no hay solicitud", () => {
      // v17.6.94 — el tiempo de evolución de la diabetes va explícito: sin él la
      // clasificación es provisional y SÍ lleva solicitud (se prueba justo debajo).
      const conMeta = (ldl) => {
        const r = api.mtrResumenClinico({
          hoyIso: "2026-08-26", edad: 60, sexo: "M", pesoKg: 80, creatinina: 0.9,
          ct: 200, hdl: 45, ldl: ldl, factores: { hta: true, diabetes: true, dmAnios: 12 },
          ultimos: { CREATININA: { fecha: "2026-08-01", valor: 0.9 }, COLESTEROL_LDL: { fecha: "2026-08-01", valor: ldl } },
        });
        return api.mtrJsonV68DesdeResumen(r, api.mtrHojaDesdeResumen(r));
      };
      const fuera = conMeta(190);
      t.igual(fuera.status, "FUERA DE META", "un LDL disparado se dice así");
      t.igual(fuera.solicitud, "", "y no se inventa una solicitud que no corresponde");
      t.igual(fuera.datos_completos, true, "aquí sí están completos");
      t.cierto(!!fuera.cv_risk, "y hay categoría de riesgo");
      // Sin LDL con qué juzgar, no se inventa un estado de meta.
      const sinLdl = api.mtrJsonV68DesdeResumen(api.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 60, sexo: "M", pesoKg: 80, creatinina: 0.9,
        factores: { hta: true, diabetes: true, dmAnios: 12 },
        ultimos: { CREATININA: { fecha: "2026-08-01", valor: 0.9 } },
      }), {});
      t.igual(sinLdl.status, "", "sin LDL, status vacío: no se inventa un estado de meta");
    });

    t.caso("v17.6.94: el diabético sin tiempo de evolución sale con categoría Y con solicitud", () => {
      // El piso provisional NO deja la categoría en blanco —sin categoría no hay meta de
      // LDL, y sin meta no hay falla ni órdenes— pero tampoco se calla lo que falta.
      const r = api.mtrResumenClinico({
        hoyIso: "2026-08-26", edad: 60, sexo: "M", pesoKg: 80, creatinina: 0.9,
        ct: 200, hdl: 45, ldl: 190, factores: { hta: true, diabetes: true },
        ultimos: { CREATININA: { fecha: "2026-08-01", valor: 0.9 }, COLESTEROL_LDL: { fecha: "2026-08-01", valor: 190 } },
      });
      const j = api.mtrJsonV68DesdeResumen(r, api.mtrHojaDesdeResumen(r));
      t.igual(j.cv_risk, "alto", "la categoría se emite igual, no se deja al paciente sin meta");
      t.cierto(/años el paciente tiene diabetes/.test(j.solicitud || ""),
        "y se pide el dato que la haría definitiva (obtuvo: " + JSON.stringify(j.solicitud) + ")");
      t.cierto(r.riesgo.dmAniosRequerido === true, "el resumen lo marca como provisional");
    });

    // Las dos guardas de mtrStatusV68 NO son redundantes, aunque en un resumen construido por
    // mtrResumenClinico se solapen (cuando no clasifica, pone las dos). Este emisor se llama
    // también con resúmenes armados a mano — esta misma suite lo hace más arriba —, y ahí una
    // categoría nula puede venir SIN `datosCompletos`. Sin la primera guarda ese paciente
    // saldría con status "" y la IA lo redactaría como si estuviera estratificado.
    t.caso("v17.6.89: una categoría nula basta para PENDIENTE, aunque nadie marque datosCompletos", () => {
      const aMano = { erc: { datosCompletos: true }, riesgo: { categoria: null }, meta: {}, plan: {} };
      t.igual(api.mtrJsonV68DesdeResumen(aMano, {}).status, "PENDIENTE",
        "sin categoría no hay nada interpretable: PENDIENTE");
      const vacia = { erc: { datosCompletos: true }, riesgo: { categoria: "" }, meta: {}, plan: {} };
      t.igual(api.mtrJsonV68DesdeResumen(vacia, {}).status, "PENDIENTE",
        "una categoría en blanco tampoco es una categoría");
      // Y la guarda no se dispara de más: con categoría real manda el estado de la meta.
      const conCat = { erc: { datosCompletos: true }, riesgo: { categoria: "alto" }, meta: { estado: "en_meta" }, plan: {} };
      t.igual(api.mtrJsonV68DesdeResumen(conCat, {}).status, "EN META",
        "con categoría real, el status refleja la meta");
    });

    // Sin esta regla el campo nace muerto: el JSON diría PENDIENTE y el modelo redactaría
    // igual, como si el paciente estuviera estratificado.
    t.caso("v17.6.89: el prompt le enseña al modelo qué hacer con status PENDIENTE", () => {
      const nota = api.mtrRedaccionPrompt("analisis_plan", hojaDemo(api), {});
      const todo = String(nota.system) + "\n" + String(nota.user);
      t.cierto(/PENDIENTE/.test(todo), "el prompt nombra el estado PENDIENTE");
      t.cierto(/solicitud/i.test(todo), "y el campo `solicitud` que debe copiar");
      t.cierto(/LITERAL/i.test(todo), "exigiéndole que lo copie literalmente, sin redactarlo él");
    });

    t.caso("mtrJsonV68DesdeResumen SÍ calcula alertas_dosis/alerta_metformina reales (auditoría 2026-08-18: antes quedaban siempre en null/[] sin importar lo que el motor encontrara)", () => {
      const resumen = {
        programa: "HTA",
        erc: { crcl: 26, egfr: 25, estadioAdministrativo: "G4", estadioClinico: "G4", remitirNefrologia: true, datosCompletos: true },
        riesgo: { categoria: "muy alto" }, meta: { metas: { ldl: 55 } }, foco: "renal",
        plan: { ftl: "2026-09-01", control: { fecha: "2026-09-07" }, faltantes: [], vencidos: [] },
        factores: { rac: 40 },
      };
      const meds = api.mtrMedicamentosDesdeRespuesta(require("./fixtures/everest_medicamentos.json").respuesta, { estados: ["PENDIENTE"] });
      const j = api.mtrJsonV68DesdeResumen(resumen, { medicamentos: meds });
      t.cierto(Array.isArray(j.alertas_dosis) && j.alertas_dosis.length > 0, "alertas_dosis ya no queda vacío cuando el motor sí encuentra algo");
      t.cierto(typeof j.alerta_metformina === "string" && /metformina/i.test(j.alerta_metformina) && /CONTRAINDICADA/.test(j.alerta_metformina),
        "alerta_metformina trae el mensaje real de contraindicación con eGFR 25");
      t.cierto(j.alertas_dosis.some((m) => /ibuprofeno/i.test(m) || /AINE/i.test(m)), "también aparece el aviso del ibuprofeno (AINE) con esta función renal");
    });

    t.caso("mtrJsonV68DesdeResumen: medicamentos_actuales marca [DOSIS NO ESPECIFICADA] cuando el histórico no trae frecuencia para ese fármaco (item 1, v17.6.66)", () => {
      const resumen = {
        programa: "HTA",
        erc: { crcl: 80, egfr: 80, datosCompletos: true }, riesgo: {}, meta: {}, plan: {},
        // solo ENALAPRIL tiene frecuencia en el histórico; LOSARTAN no.
        medicamentosFrecuencia: new Map([["enalapril 20 mg", "cada 12 horas"]]),
      };
      const j = api.mtrJsonV68DesdeResumen(resumen, { medicamentos: ["ENALAPRIL 20 MG", "LOSARTAN 50 MG"] });
      const enalapril = j.medicamentos_actuales.find((m) => /ENALAPRIL/i.test(m));
      const losartan = j.medicamentos_actuales.find((m) => /LOSARTAN/i.test(m));
      t.cierto(enalapril && !/DOSIS NO ESPECIFICADA/.test(enalapril), "ENALAPRIL sí tiene frecuencia: no se marca");
      t.cierto(losartan && /\[DOSIS NO ESPECIFICADA\]/.test(losartan), "LOSARTAN sin frecuencia en el histórico: se marca visiblemente, CERO INFERENCIA");
    });

    t.caso("mtrJsonV68DesdeResumen: sin `medicamentosFrecuencia` en absoluto (no se preguntó), medicamentos_actuales no marca nada (no es lo mismo 'sin dato' que 'no se preguntó')", () => {
      const resumen = { programa: "HTA", erc: { crcl: 80, egfr: 80, datosCompletos: true }, riesgo: {}, meta: {}, plan: {} };
      const j = api.mtrJsonV68DesdeResumen(resumen, { medicamentos: ["LOSARTAN 50 MG"] });
      t.cierto(j.medicamentos_actuales.every((m) => !/DOSIS NO ESPECIFICADA/.test(m)), "sin mapa de frecuencias, ningún marcador (evita ruido cuando ni se intentó leer)");
    });

    t.caso("mtrJsonV68DesdeResumen: sin medicamentos que juzgar, alertas_dosis/alerta_metformina quedan vacíos sin lanzar (no inventa avisos)", () => {
      const resumen = { programa: "HTA", erc: { crcl: 80, egfr: 80, datosCompletos: true }, riesgo: {}, meta: {}, plan: {} };
      let j;
      t.noLanza(() => { j = api.mtrJsonV68DesdeResumen(resumen, {}); }, "sin medicamentos no debe lanzar");
      t.igual(j.alertas_dosis.length, 0, "sin medicamentos, sin avisos");
      t.igual(j.alerta_metformina, null, "sin medicamentos, sin metformina");
    });

    // =====================================================================
    // v17.6.0 — education_flags.dieta/.actividad leían Array.isArray(r.educationFlags),
    // y mtrEducationFlags() siempre devuelve el objeto {alarmas,dieta,actividad}: la
    // comprobación era falsa siempre, así que estos dos campos del JSON que lee la IA
    // quedaban en false sin importar el programa del paciente. (.alarmas del JSON tiene
    // su propia fórmula, independiente de ef.alarmas — no lo toca este arreglo.)
    // =====================================================================
    t.caso("mtrJsonV68DesdeResumen: education_flags.dieta/.actividad ahora sí reflejan el programa (antes: Array.isArray sobre un objeto, siempre falso)", () => {
      const resumen = {
        programa: "DM2", erc: { crcl: 80, egfr: 80, datosCompletos: true },
        riesgo: { categoria: "moderado" }, meta: {}, plan: {},
        educationFlags: { alarmas: false, dieta: true, actividad: true },
      };
      const j = api.mtrJsonV68DesdeResumen(resumen, {});
      t.cierto(j.education_flags.dieta, "dieta encendida en el resumen -> dieta true en el JSON");
      t.cierto(j.education_flags.actividad, "actividad encendida en el resumen -> actividad true en el JSON");
    });

    t.caso("mtrJsonV68DesdeResumen: education_flags.dieta/.actividad en false cuando corresponde, y no lanza sin educationFlags", () => {
      const resumen = {
        programa: "HTA", erc: { crcl: 80, egfr: 80, datosCompletos: true }, riesgo: {}, meta: {}, plan: {},
        educationFlags: { alarmas: false, dieta: false, actividad: false },
      };
      const j = api.mtrJsonV68DesdeResumen(resumen, {});
      t.falso(j.education_flags.dieta, "dieta apagada en el resumen -> false");
      t.falso(j.education_flags.actividad, "actividad apagada en el resumen -> false");

      const resumenSinFlags = { programa: "HTA", erc: { crcl: 80, egfr: 80, datosCompletos: true }, riesgo: {}, meta: {}, plan: {} };
      let j2;
      t.noLanza(() => { j2 = api.mtrJsonV68DesdeResumen(resumenSinFlags, {}); }, "sin educationFlags no debe lanzar");
      t.falso(j2.education_flags.dieta, "sin educationFlags, dieta queda false (no inventa)");
      t.falso(j2.education_flags.actividad, "sin educationFlags, actividad queda false (no inventa)");
    });

    // v17.6.3 — C2 (decisión del médico, 22-ago): el motivo de consulta que ve la IA es
    // SIEMPRE «CONTROL DE RIESGO CARDIOVASCULAR», sin importar lo que traiga la casilla de
    // Everest (vacía, otra cosa, o hasta PHI). Es el contexto del redactor, no una
    // escritura: la casilla del médico jamás se toca.
    t.caso("mtrLeerTextoLibreHistoria: el motivo es SIEMPRE 'CONTROL DE RIESGO CARDIOVASCULAR' (decisión C2); la revisión se lee desidentificada y no lanza sin DOM", () => {
      const doc = {
        querySelector: (sel) => /MotivoConsulta/.test(sel) ? { value: "control de rutina, cel 3151234567" } : null,
        querySelectorAll: () => [{ value: "refiere cefalea", offsetParent: {} }, { value: "niega disnea", offsetParent: {} }],
      };
      const r = api.mtrLeerTextoLibreHistoria(doc);
      t.igual(r.motivo, "CONTROL DE RIESGO CARDIOVASCULAR", "el motivo es SIEMPRE el fijo, aunque Everest traiga otra cosa");
      t.falso(r.motivo.indexOf("3151234567") >= 0, "ni rastro del texto de Everest (ni de su PHI)");
      t.falso(/control de rutina/.test(r.motivo), "el valor de la casilla de Everest NO se usa");
      t.cierto(/cefalea/.test(r.sintomas) && /disnea/.test(r.sintomas), "junta la revisión por sistemas");
      t.cierto(/CONTROL DE RIESGO CARDIOVASCULAR/.test(r.combinado), "y el motivo fijo llega al contexto combinado que ve la IA");
      t.noLanza(() => api.mtrLeerTextoLibreHistoria(null), "sin DOM no lanza");
    });

    t.caso("la clave se guarda ofuscada y se lee de vuelta; borrar la limpia", () => {
      const c = cargar({ silencioso: true });
      c.api.mtrGuardarClaveGemini("AIzaSy-EJEMPLO");
      t.igual(c.api.mtrLeerClaveGemini(), "AIzaSy-EJEMPLO", "round-trip correcto");
      t.cierto(JSON.stringify(c.env.gm).indexOf("AIzaSy-EJEMPLO") < 0, "en el almacén NO está en claro");
      c.api.mtrGuardarClaveGemini("");
      t.igual(c.api.mtrLeerClaveGemini(), "", "vacío la borra");
    });

    // v15.2.0 — "Mi estilo" guarda hasta 3 notas previas del medico como ejemplos. Se
    // saneaban SOLO con scrubPII, que no toca nombres propios: el ejemplo quedaba en el
    // equipo con el nombre de un paciente dentro y, con "mi estilo" activo, ese texto
    // entraba al prompt de OTROS pacientes.
    t.caso("mtrEstiloGuardar: el ejemplo se guarda ya sin nombres (no basta scrubPII: no toca nombres propios)", () => {
      const c = cargar({ silencioso: true });
      c.api.mtrEstiloGuardar("PACIENTE Maria Rodriguez asiste a control de hipertension, refiere buena adherencia al tratamiento.");
      const guardados = c.api.mtrEstiloLeer();
      t.igual(guardados.length, 1, "quedo guardado");
      t.falso(/Maria|Rodriguez/.test(guardados[0]), "y sin el nombre del paciente dentro");
      t.cierto(guardados[0].includes("[NOMBRE_CENSURADO]"), "queda la marca de censura");
      t.cierto(/adherencia al tratamiento/.test(guardados[0]), "pero conserva el estilo de redaccion, que es para lo que sirve");
    });

    t.caso("mtrEstiloGuardar: no guarda textos demasiado cortos para enseñar estilo", () => {
      const c = cargar({ silencioso: true });
      t.falso(c.api.mtrEstiloGuardar("Control."), "muy corto");
      t.igual(c.api.mtrEstiloLeer().length, 0);
    });

    // =====================================================================
    // v15.2.0 — mtrCalcularDeltaEdicion: MÉTRICA REINA LLMOps (Zero-PHI). Nunca guarda
    // texto, solo la categoría discreta de cuánto editó el médico lo que redactó la IA:
    // "intacta" (100% igual) | "edicion_leve" (delta chico) | "reescritura" (delta
    // grande) | "descarte" (el médico borró todo). Los casos límite de abajo están
    // verificados a mano contra la fórmula real: el corte de longitud usa ">" estricto
    // (0.35 exacto NO cae en reescritura por longitud) y el de similitud de palabras
    // usa ">=" (0.8 exacto SÍ cuenta como edición leve).
    // =====================================================================
    t.caso("mtrCalcularDeltaEdicion: editado vacío o solo espacios => descarte, sea lo que sea el original", () => {
      t.igual(api.mtrCalcularDeltaEdicion("cualquier cosa", ""), "descarte");
      t.igual(api.mtrCalcularDeltaEdicion("cualquier cosa", "   "), "descarte");
      t.igual(api.mtrCalcularDeltaEdicion(null, null), "descarte", "entradas nulas se tratan como texto vacío, no revienta");
    });

    t.caso("mtrCalcularDeltaEdicion: idéntico (tras recortar espacios de sobra) => intacta", () => {
      t.igual(api.mtrCalcularDeltaEdicion("Paciente estable, sin cambios.", "Paciente estable, sin cambios."), "intacta");
      t.igual(api.mtrCalcularDeltaEdicion("  con espacios alrededor  ", "con espacios alrededor"), "intacta",
        "el recorte de espacios cuenta como sin cambios, no como edición");
    });

    t.caso("mtrCalcularDeltaEdicion: original vacío pero editado no => reescritura (no hay base para medir un delta)", () => {
      t.igual(api.mtrCalcularDeltaEdicion("", "Texto completamente nuevo del médico."), "reescritura");
      t.igual(api.mtrCalcularDeltaEdicion("   ", "Texto completamente nuevo del médico."), "reescritura");
    });

    t.caso("mtrCalcularDeltaEdicion: cambio grande de longitud => reescritura, sin llegar a mirar palabras compartidas", () => {
      const orig = "Paciente refiere dolor abdominal difuso de tres dias sin fiebre ni vomito asociado hoy"; // 86 caracteres
      const edit = "Dolor abdominal"; // 15 caracteres: 82% más corto
      t.igual(api.mtrCalcularDeltaEdicion(orig, edit), "reescritura");
    });

    t.caso("mtrCalcularDeltaEdicion: longitud parecida y casi todas las palabras se repiten => edicion_leve", () => {
      const orig = "Paciente refiere dolor abdominal leve de un dia de evolucion sin fiebre";
      const edit = "Paciente refiere dolor abdominal leve de un dia de evolucion sin nauseas"; // solo cambia la última palabra
      t.igual(api.mtrCalcularDeltaEdicion(orig, edit), "edicion_leve");
    });

    t.caso("mtrCalcularDeltaEdicion: longitud parecida pero el vocabulario es casi todo distinto => reescritura", () => {
      const orig = "Paciente refiere dolor abdominal leve de un dia de evolucion sin fiebre";
      const edit = "Masculino consulta por cefalea intensa hace dos horas con nauseas y fotofobia"; // otro motivo de consulta, mismo porte
      t.igual(api.mtrCalcularDeltaEdicion(orig, edit), "reescritura");
    });

    // Límite exacto verificado a mano (ver AGENTS/notas de esta ronda): 20 palabras (100
    // caracteres) contra 17 palabras (65 caracteres — ratio de longitud 0.35 EXACTO) que
    // comparten 16 de las 20 palabras del original (similitud 16/20 = 0.8 EXACTO). Este
    // único caso prueba los dos operadores de corte a la vez: si el de longitud fuera
    // ">=" habría devuelto reescritura por longitud sin llegar a mirar palabras; si el
    // de similitud fuera ">" habría devuelto reescritura por similitud insuficiente. Da
    // edicion_leve, luego ambos cortes son los que dice el comentario del código: ">" y ">=".
    t.caso("mtrCalcularDeltaEdicion: límite exacto (longitud 0.35 Y similitud 0.8, ambos EXACTOS) => edicion_leve", () => {
      const orig100 = "aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp rrrrr sssss ttttt uuuuuzzzzzzzzzzzzz";
      const edit65 = "aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp q";
      t.igual(orig100.length, 100);
      t.igual(edit65.length, 65);
      t.igual(api.mtrCalcularDeltaEdicion(orig100, edit65), "edicion_leve");
    });

    t.caso("mtrCalcularDeltaEdicion: un carácter más de diferencia (ratio 0.37, ya pasó 0.35) => reescritura por longitud, aunque casi todas las palabras coincidan", () => {
      const orig100 = "aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp rrrrr sssss ttttt uuuuuzzzzzzzzzzzzz";
      // Mismas 16 palabras base que el caso anterior, pero SIN la palabra de relleno "q":
      // si el corte de longitud no existiera, la similitud de palabras seguiría siendo
      // altísima — la única razón de que esto dé reescritura es el corte de longitud.
      const edit63 = "aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp";
      t.igual(edit63.length, 63);
      t.igual(api.mtrCalcularDeltaEdicion(orig100, edit63), "reescritura");
    });

    t.caso("mtrCalcularDeltaEdicion: similitud justo debajo del límite (0.75 < 0.8) con longitud segura => reescritura por similitud", () => {
      const orig100 = "aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo ppp rrrrr sssss ttttt uuuuuzzzzzzzzzzzzz";
      const edit70 = "aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk lll mmm nnn ooo qqqqqqqqqq"; // 15/20 palabras, ratio de longitud 0.30 (lejos del límite de longitud)
      t.igual(edit70.length, 70);
      t.igual(api.mtrCalcularDeltaEdicion(orig100, edit70), "reescritura");
    });

    t.caso("mtrCalcularDeltaEdicion: si algo revienta al convertir el texto, cae a edicion_leve (ni intacta ni descarte: fail-safe intermedio, nunca lanza)", () => {
      const venenoso = { toString() { throw new Error("no se puede convertir a texto"); }, valueOf() { throw new Error("tampoco"); } };
      let r;
      t.noLanza(() => { r = api.mtrCalcularDeltaEdicion(venenoso, "texto normal del médico"); });
      t.igual(r, "edicion_leve");
    });

    t.caso("v17.6.12: _vglTextoPrevioPodar recorta a tope y conserva los más recientes (orden de inserción)", () => {
      const m = new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4], ["e", 5]]);
      api._vglTextoPrevioPodar(m, 3);
      t.igual(m.size, 3, "queda en el tope");
      t.cierto(!m.has("a") && !m.has("b"), "se fueron los más viejos");
      t.cierto(m.has("c") && m.has("d") && m.has("e"), "quedan los más recientes");
    });

    t.caso("v17.6.12: _vglTextoPrevioPodar no toca un mapa dentro del tope y aguanta tope inválido o sin mapa", () => {
      const m = new Map([["x", 1], ["y", 2]]);
      api._vglTextoPrevioPodar(m, 200);
      t.igual(m.size, 2, "por debajo del tope no se toca");
      const conTopeInvalido = new Map([["x", 1]]);
      api._vglTextoPrevioPodar(conTopeInvalido, 0);
      t.igual(conTopeInvalido.size, 1, "tope 0 no trunca nada");
      let r;
      t.noLanza(() => { r = api._vglTextoPrevioPodar(null, 200); });
      t.cierto(r && r.constructor && r.constructor.name === "Map", "sin mapa devuelve un Map vacío");
    });

    // v17.6.35 — AUDITORÍA S+ (barrido total, 24-ago-2026): `_pintarMeta` (contador de
    // palabras/caracteres del borrador) llamaba a `esc(_ultimoModelo)`, una función que no
    // existe en ningún ámbito del userscript (el helper real es `escapeHtml`). Desde la
    // primera generación (cuando _ultimoModelo deja de estar vacío) el ReferenceError se
    // tragaba en el catch y el contador dejaba de repintarse para siempre. `_pintarMeta`
    // vive dentro del cierre de `mtrAbrirPanelRedaccion` (no es una unidad aislable, con
    // modal/salida/_ultimoModelo de closure) — se protege por texto fuente, mismo criterio
    // ya establecido en el banco para la notificación de SMS (v17.6.28) y el tuteo (v17.6.32).
    t.caso("v17.6.35: _pintarMeta usa escapeHtml (el helper real), no el inexistente esc()", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const idx = src.indexOf("const _pintarMeta = () => {");
      const fn = src.slice(idx, idx + 1000);
      t.falso(/[^a-zA-Z_]esc\(_ultimoModelo\)/.test(fn), "ya no debe quedar la llamada a esc(), que no existe");
      t.cierto(/escapeHtml\(_ultimoModelo\)/.test(fn), "debe usar escapeHtml, el helper real del proyecto");
    });

    // v17.6.36 — AUDITORÍA S+ (barrido total, 24-ago-2026): esta es la causa raíz del
    // bug reportado por el médico al comienzo de esta auditoría: "el asistente dice que
    // hay borrador sin pegar aunque ya lo pegué". El snapshot de cambio de chip creaba
    // un objeto NUEVO para _borradores[modoAnterior], sin la bandera `insertado` — y
    // como _casillaHechaYSiguiente() AUTO-AVANZA con chip.click() apenas fija
    // insertado=true, este mismo handler corría un instante después y la borraba en el
    // mismo stack. _hayBorradoresSinInsertar() (que dispara el aviso al cerrar) lee
    // exactamente esa bandera. Vive dentro del cierre de mtrAbrirPanelRedaccion — se
    // protege por texto fuente, mismo criterio ya establecido en el banco.
    t.caso("v17.6.36: el cambio de chip preserva la bandera insertado (no la pisa con un objeto nuevo)", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const idx = src.indexOf("let modoAnterior = modo;");
      const fn = src.slice(idx, idx + 1700);
      t.falso(/_borradores\[modoAnterior\] = \{ texto:/.test(fn), "ya no debe crear un objeto nuevo que pierda las banderas existentes");
      t.cierto(/_borradores\[modoAnterior\] = Object\.assign\(\{\}, _borradores\[modoAnterior\], \{ texto:/.test(fn), "debe fusionar sobre lo ya guardado, preservando insertado");
    });

    // v17.6.37 — AUDITORÍA S+ (barrido total, 24-ago-2026): la rama de FALLO de
    // "Generar" pintaba salida.value/estado/btnIns SIN comprobar que el chip activo
    // siguiera siendo modoGen (a diferencia de la rama de éxito, que sí lo hace): si el
    // médico cambiaba de casilla mientras la generación estaba en vuelo y esa
    // generación fallaba, los hechos de LA CASILLA VIEJA se pintaban sobre la casilla
    // NUEVA — y el snapshot de cambio de chip (v17.6.36) los guardaba como si fueran
    // el borrador de esa casilla nueva. Vive dentro del cierre de
    // mtrAbrirPanelRedaccion — se protege por texto fuente.
    t.caso("v17.6.37: la rama de fallo de Generar respeta el mismo guardia modoGen === modo que la de éxito", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const idx = src.indexOf("La IA no redactó");
      const fn = src.slice(idx - 400, idx + 500);
      t.cierto(/_borradores\[modoGen\] = Object\.assign\(\{\}, _borradores\[modoGen\], \{/.test(fn), "el resultado de fallo se guarda bajo SU modo, igual que el de éxito");
      t.cierto(/if \(modoGen === modo\) \{[\s\S]{0,200}salida\.value = _borradores\[modoGen\]\.texto/.test(fn), "solo pinta la pantalla si el chip activo sigue siendo el que generó");
    });

    // v17.6.38 — AUDITORÍA S+ (barrido total, 24-ago-2026): "Generar todo" ya
    // deshabilitaba "Generar" al arrancar, pero "Generar" no hacía lo mismo con
    // "Generar todo" — dos cadenas de generación podían correr solapadas, y la primera
    // en terminar rehabilitaba ambos botones a mitad de la cadena del lote de la otra,
    // rompiendo el candado que v17.6.11 puso a propósito. Vive dentro del cierre de
    // mtrAbrirPanelRedaccion — se protege por texto fuente.
    t.caso("v17.6.38: Generar también deshabilita Generar todo mientras está en vuelo (candado en ambos sentidos)", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      const idx = src.indexOf('estado.textContent = "Generando con " + mtrModeloGemini(modoGen)');
      const fn = src.slice(idx - 100, idx + 400);
      t.cierto(/btnGen\.disabled = true; if \(btnTodo\) btnTodo\.disabled = true;/.test(fn), "al arrancar, deshabilita también Generar todo");
      t.cierto(/btnGen\.disabled = false; if \(btnTodo\) btnTodo\.disabled = false;/.test(fn), "al terminar, lo rehabilita junto con Generar");
    });

    // v17.6.42 — AUDITORÍA S+ (barrido total, 24-ago-2026): el nombre real del paciente
    // (resumen._nombrePaciente, tomado de la cita de la agenda) tiene que LLEGAR a los
    // 4 sitios que envían texto libre a Gemini para que el censor de mayúsculas
    // sostenidas (probado arriba de forma aislada) tenga algo que tachar en producción.
    // Vive dentro del cierre de mtrAbrirPanelRedaccion — se protege por texto fuente.
    t.caso("v17.6.42: resumen._nombrePaciente se arma y llega a los 4 puntos de envío de texto libre a la IA", () => {
      const src = fs.readFileSync(path.join(__dirname, "..", "vigilante_agenda.user.js"), "utf8");
      t.cierto(/resumen\._nombrePaciente = \(apt && apt\.nombre\) \|\| null;/.test(src), "el resumen del paciente debe traer su nombre real (interno, nunca se envía tal cual)");
      t.cierto(/mtrLeerTextoLibreHistoria\(undefined, resumen\._nombrePaciente\)/.test(src), "libreAhora() (texto de las casillas de Everest) debe pasar el nombre");
      const ocurrenciasOpts = (src.match(/nombrePaciente: resumen\._nombrePaciente,/g) || []).length;
      t.igual(ocurrenciasOpts, 2, "los dos objetos opts (Generar y Generar todo) deben incluir el nombre");
      t.cierto(/mtrEstiloGuardar\(salida\.value, resumen\._nombrePaciente\)/.test(src), "el aprendizaje automático de estilo también debe sanear con el nombre real antes de guardar");
    });


    // =================================================================
    //  v17.7.3 — LA HOJA DE HECHOS COMPLETA
    //  Encargo del médico (27-ago): «la IA debe recibir todo el JSON de Everest ya que
    //  toda esa información sirve de grounding para redactar una excelente nota clínica:
    //  se debe mandar el examen físico, medicamentos actuales, laboratorios actuales,
    //  exámenes por vencer, clasificación del riesgo cardiovascular, etc.»
    //
    //  Todo esto YA estaba calculado en el script y nadie lo copiaba a la hoja: el modelo
    //  opinaba con menos datos de los que el propio asistente tenía en la mano.
    // =================================================================
    const _ctx773 = {
      hoyIso: "2026-08-16", edad: 68, sexo: "F", pesoKg: 62, creatinina: 1.6,
      rac: 45, ct: 230, hdl: 42, ldl: 148, paSistolica: 148, paDiastolica: 88,
      factores: { hta: true, diabetes: true, cinturaCm: 96 },
      ultimos: {
        CREATININA: { fecha: "2026-05-01", valor: 1.6 },
        COLESTEROL_TOTAL: { fecha: "2026-05-01", valor: 230 },
        COLESTEROL_HDL: { fecha: "2026-05-01", valor: 42 },
        TRIGLICERIDOS: { fecha: "2026-05-01", valor: 190 },
        GLUCOSA: { fecha: "2026-01-01", valor: 132 },
        NITRITOS: { fecha: "2026-05-01", valor: "POSITIVO" },
      },
      uroHallazgos: { nitritos: "POSITIVO" },
    };
    const _hoja773 = () => api.mtrHojaDeHechos(api.mtrResumenClinico(_ctx773), {
      ultimos: _ctx773.ultimos, hoyIso: "2026-08-16", medicamentos: ["Losartan 50mg"],
    });

    t.caso("v17.7.3 — el examen físico llega entero: peso y cintura, no solo la tensión", () => {
      const h = _hoja773();
      t.igual(h.antropometria.pesoKg, 62, "el peso");
      t.igual(h.antropometria.cinturaCm, 96, "y la circunferencia abdominal, que se lee por rótulo desde v17.6.97");
      const txt = api.mtrHojaDeHechosTexto(h);
      t.cierto(txt.indexOf("peso 62 kg") >= 0, "el peso, en el texto que ve el modelo");
      t.cierto(txt.indexOf("circunferencia abdominal 96 cm") >= 0, "y la cintura, con el nombre que usa Everest");
      // La etiqueta NO puede cambiar: es uno de los prefijos con que se limpia la
      // Enfermedad Actual, y ese filtro compara texto exacto.
      t.cierto(txt.indexOf("Signos vitales:") >= 0,
        "la etiqueta sigue siendo «Signos vitales:»: renombrarla dejaría el filtro de Enfermedad Actual sin reconocer su propia línea");
    });

    t.caso("v17.7.3 — el uroanálisis y los paraclínicos de texto dejan de ser invisibles", () => {
      const h = _hoja773();
      t.cierto(h.labsTexto.some((x) => x.analito === "NITRITOS"),
        "un resultado de TEXTO ya no se descarta: el filtro de números lo tiraba");
      t.falso(h.labs.some((x) => x.analito === "NITRITOS"),
        "pero NO se mezcla con los numéricos: quien espera números sigue recibiendo solo números");
      t.cierto(!!h.uroanalisis && !!h.uroanalisis.estado, "y el uroanálisis llega con su estado ya evaluado");
      const txt = api.mtrHojaDeHechosTexto(h);
      t.cierto(txt.indexOf("Uroanálisis: ") >= 0, "nombrado en el texto");
      t.cierto(txt.indexOf("Conducta que ya definió el motor") >= 0,
        "con la conducta YA decidida, para que el modelo la cite en vez de improvisar una");
    });

    t.caso("v17.7.3 — el plan que el motor ya decidió viaja con los hechos", () => {
      const h = _hoja773();
      t.cierto(!!h.plan.ftl, "la fecha de toma");
      t.cierto(!!h.plan.control, "la fecha de control");
      t.cierto(h.plan.ordenar.length > 0, "y qué se va a ordenar");
      t.cierto(!!h.plan.anr, "el agujero negro renal, cuando está activo");
      t.cierto(Array.isArray(h.pendientes.diferidos), "los diferidos, aunque estén vacíos");
      const txt = api.mtrHojaDeHechosTexto(h);
      t.cierto(txt.indexOf("Exámenes que YA se van a ordenar") >= 0, "las órdenes, en el texto");
      t.cierto(txt.indexOf("Fechas ya calculadas:") >= 0, "las fechas, en el texto");
      // v17.13.0 — esta línea exigía el rótulo «Agujero negro renal ACTIVO», que es el apodo
      // INTERNO del motor. El médico fue explícito (27-ago): «el usuario final no debe saber
      // sobre esos términos, el ANR y todo lo demás solamente es conmigo el programador».
      // La prueba fijaba jerga, no una regla: ahora exige el hecho clínico dicho en llano y,
      // además, que el apodo NO viaje — que es lo que de verdad hay que proteger.
      t.cierto(txt.indexOf("Vigilancia de la función renal:") >= 0, "y la ventana renal explicada en llano");
      t.falso(/agujero negro/i.test(txt), "sin el apodo interno del motor: eso es del programador, no del médico");
    });

    t.caso("v17.7.3 — el síndrome metabólico llega con su porqué, no solo con su veredicto", () => {
      const h = _hoja773();
      t.cierto(!!h.sindromeMetabolico, "esta paciente lo cumple");
      t.cierto(h.sindromeMetabolico.criterios.length >= 3, "y viajan los criterios que se cumplieron");
      t.cierto(api.mtrHojaDeHechosTexto(h).indexOf("Síndrome metabólico: SÍ cumple") >= 0, "nombrado en el texto");
    });

    t.caso("v17.7.3 — lo que no consta se OMITE, nunca se rellena", () => {
      // La regla de la casa. El motivo por el que estos datos no estaban era que faltaban,
      // no que sobraran: cambiarlos por un valor plausible sería peor que no tenerlos.
      const vacia = api.mtrHojaDeHechos({ factores: { edad: 61, sexo: "F" } }, { hoyIso: "2026-08-17" });
      t.igual(vacia.antropometria.cinturaCm, null, "sin cintura, null — no se estima por el IMC");
      t.igual(vacia.antropometria.pesoKg, null, "sin peso, null");
      t.igual(vacia.uroanalisis, null, "sin uroanálisis, null — no se declara «sin hallazgos»");
      t.igual(vacia.sindromeMetabolico, null, "sin criterios, null — no se da por descartado");
      t.igual(vacia.plan, null, "sin plan, null — no se inventan fechas");
      t.igual(vacia.labsTexto.length, 0, "y ningún paraclínico descriptivo de la nada");
      const txt = api.mtrHojaDeHechosTexto(vacia);
      for (const rotulo of ["circunferencia abdominal", "Uroanálisis:", "Síndrome metabólico:", "Fechas ya calculadas:", "Vigilancia de la función renal:"]) {
        t.falso(txt.indexOf(rotulo) >= 0, "sin dato, la línea «" + rotulo + "» no se fabrica");
      }
    });

    t.caso("v17.7.3 — los bloques nuevos NO se pueden colar en la Enfermedad Actual", () => {
      // Son datos, no semiotecnia: pertenecen a Análisis y Plan. El prompt ya lo prohíbe,
      // pero un prompt es una instrucción, no una garantía — por eso existe el filtro.
      const borrador = [
        "Paciente que consulta por control.",
        "Fechas ya calculadas: toma de laboratorios 2026-08-29 · control 2026-09-04",
        "Síndrome metabólico: SÍ cumple criterios (5 de 5 evaluables)",
        "Exámenes que YA se van a ordenar en esta toma: CREATININA",
        "Vigilancia de la función renal: la creatinina vence el 2026-08-30",
        "Paraclínicos con resultado descriptivo: NITRITOS POSITIVO",
        "Refiere adecuada adherencia al tratamiento.",
      ].join("\n");
      const limpio = api.mtrQuitarDatosProhibidosEA(borrador);
      t.cierto(limpio.indexOf("consulta por control") >= 0, "la semiotecnia se respeta");
      t.cierto(limpio.indexOf("adherencia") >= 0, "y lo que sí es Enfermedad Actual también");
      for (const rotulo of ["Fechas ya calculadas:", "Síndrome metabólico:", "Exámenes que YA", "Vigilancia de la función renal:", "Paraclínicos con resultado descriptivo:"]) {
        t.falso(limpio.indexOf(rotulo) >= 0, "«" + rotulo + "» no puede quedarse en la Enfermedad Actual");
      }
    });

    // =========================================================================
    //  v17.13.0 — LOS PROMPTS APRENDEN A USAR EL CONTEXTO QUE YA RECIBÍAN
    //  Entre la v17.7.3 y la v17.12.0 la hoja creció con el examen físico, el
    //  uroanálisis, el síndrome metabólico, el plan con sus fechas y la historia
    //  clínica entera de Everest — y ningún prompt nombraba el bloque nuevo.
    //  Regla que este proyecto ya se había escrito: un dato que llega al JSON y
    //  que el prompt no nombra es un dato que no llegó.
    // =========================================================================

    // Una hoja con TODO puesto: es la única forma de comprobar que cada rótulo que
    // el prompt cita existe de verdad en lo que se manda. Datos sintéticos, cero PHI.
    const _hojaCompleta = () => api.mtrHojaDeHechos(api.mtrResumenClinico(_ctx773), {
      ultimos: _ctx773.ultimos, hoyIso: "2026-08-16", medicamentos: ["Losartan 50mg"],
      hcEverest: {
        secciones: {
          antecedentePatologicos: { hipertensionArterial: true, infartoMiocardio: false },
          habitosGestionRiesgo: { sedentarismo: true },
        },
        textos: { ultimaEnfermedad: "PACIENTE ASINTOMATICA, ADHERENTE" },
      },
    });

    t.caso("v17.13.0 — todo rótulo que el prompt cita, el mensaje lo emite de verdad", () => {
      // LA prueba que impide la próxima desconexión: barre los nombres de bloque que el
      // bloque de precedencia enumera y exige que cada uno aparezca en el mensaje armado.
      // Si alguien renombra un bloque en mtrRedaccionPrompt y no en el prompt (o al revés),
      // esto se pone rojo en vez de dejar al modelo buscando algo que no existe.
      const p = api.mtrRedaccionPrompt("analisis_plan", _hojaCompleta(), {
        contextoLibre: "PACIENTE REFIERE CEFALEA LEVE",
        datosExtra: { tfgAportada: "72" },
        indicaciones: "Enfatizar la adherencia",
      });
      const citados = [];
      const re = /^\d+\. ([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ]+?) (?:—|\()/gm;
      let m;
      while ((m = re.exec(p.system)) !== null) citados.push(m[1].trim());
      t.cierto(citados.length >= 4, "el bloque de precedencia enumera las fuentes (" + citados.length + ")");
      for (const rotulo of citados) {
        t.cierto(p.user.indexOf(rotulo) >= 0, "«" + rotulo + "» que el prompt cita, sí viaja en el mensaje");
      }
    });

    t.caso("v17.13.0 — los tres prompts nombran la historia clínica de Everest", () => {
      const hoja = _hojaCompleta();
      for (const modo of ["enfermedad_actual", "analisis_plan", "recomendaciones"]) {
        const p = api.mtrRedaccionPrompt(modo, hoja, {});
        t.cierto(p.system.indexOf("LO REGISTRADO EN LA HISTORIA CLÍNICA DE EVEREST") >= 0,
          modo + ": el prompt nombra el bloque que la hoja lleva emitiendo desde la v17.10.0");
      }
      t.cierto(api.mtrHojaDeHechosTexto(hoja).indexOf("--- LO REGISTRADO EN LA HISTORIA CLÍNICA DE EVEREST ---") >= 0,
        "y la hoja lo emite con ese mismo nombre");
    });

    t.caso("v17.13.0 — la precedencia se enuncia, y va antes que el formato de salida", () => {
      const p = api.mtrRedaccionPrompt("enfermedad_actual", _hojaCompleta(), {});
      const iPrec = p.system.indexOf("# FUENTES Y SU ORDEN DE MANDO");
      t.cierto(iPrec >= 0, "el bloque de precedencia existe");
      const iFormato = p.system.indexOf("# FORMATO DE SALIDA");
      t.cierto(iFormato > iPrec, "y va ANTES del formato: al final competiría con él en un modelo lite");
      const iMedico = p.system.indexOf("DATOS APORTADOS POR EL MÉDICO");
      const iMotor = p.system.indexOf("5. HECHOS DEL PACIENTE");
      t.cierto(iMedico >= 0 && iMotor > iMedico,
        "el médico manda por encima de lo que calculó el motor, no al revés");
    });

    t.caso("v17.13.0 — un «no» documentado no es lo mismo que un campo ausente", () => {
      // Es la diferencia entre «se descartó» y «no se preguntó». Sin decirlo, el modelo
      // trata los 109 campos en false de la historia como huecos y se los calla, o peor,
      // los afirma al revés.
      const p = api.mtrRedaccionPrompt("analisis_plan", _hojaCompleta(), {});
      t.cierto(/ES UN HECHO/.test(p.system), "el prompt dice que un 'no' ES UN HECHO");
      t.cierto(/AUSENTE significa que no se preguntó/.test(p.system), "y que un campo ausente es otra cosa");
      t.cierto(/SOLO los pertinentes al motivo de consulta/.test(p.system),
        "y de los negativos solo se escriben los pertinentes: semiología, no inventario");
    });

    t.caso("v17.13.0 — el texto del médico se reescribe mejorado, sin perder ni un hecho suyo", () => {
      // Encargo del médico (27-ago): «sí quiero que se reescriba de forma inteligentemente
      // mejorada según las normas y la semiología». Con dos límites que él mismo impuso:
      // no se le quita nada de lo que escribió, y no se le altera ninguna cifra.
      const p = api.mtrRedaccionPrompt("enfermedad_actual", _hojaCompleta(), {
        contextoLibre: "PACIENTE ASINTOMATICA",
      });
      t.cierto(/reescríbelo mejorado/.test(p.system), "se reescribe, no se repite tal cual");
      t.cierto(/Resolución 1995 de 1999/.test(p.system), "con la norma que rige la historia clínica");
      t.cierto(/Suprimir un dato suyo está PROHIBIDO/.test(p.system), "sin perder ningún hecho del médico");
      t.cierto(/NO alteres ninguna cifra, fecha, dosis ni unidad/.test(p.system), "y sin tocarle una cifra");
      t.cierto(/BORRADOR que el médico lee, edita y aprueba/.test(p.system),
        "y sigue siendo un borrador: la casilla es suya");
      t.cierto(/SI NO HAY TEXTO PREVIO/.test(p.system),
        "y con la casilla vacía se redacta completa desde cero, no corta por falta de borrador");
    });

    t.caso("v17.13.0 — la casilla ocupada sigue intacta mientras el médico no confirme", () => {
      // La regla de la casa entera en una prueba: la reescritura llega como borrador, y
      // pisar lo que él escribió a mano exige un clic explícito suyo.
      const c = cargar({ silencioso: true });
      const ta = { value: "TEXTO QUE ESCRIBIÓ EL MÉDICO A MANO", isConnected: true, dispatchEvent: () => {} };
      c.env.doc.querySelector = (sel) => (sel === `textarea[name="UltimaEnfermedad"]` ? ta : null);
      const doc = c.env.doc; const api2 = c.api;
      {
        const r1 = api2.mtrInsertarEnCasillaModo("enfermedad_actual", "BORRADOR NUEVO DE LA IA", null, doc);
        t.falso(r1.ok, "sin confirmar, no se inserta");
        t.igual(r1.motivo, "ocupada", "y se dice por qué");
        t.igual(ta.value, "TEXTO QUE ESCRIBIÓ EL MÉDICO A MANO", "la casilla quedó EXACTAMENTE como estaba");
        const r2 = api2.mtrInsertarEnCasillaModo("enfermedad_actual", "BORRADOR NUEVO DE LA IA", null, doc, { reemplazar: true });
        t.cierto(r2.ok, "con la confirmación explícita, sí se reemplaza");
        t.igual(r2.motivo, "reemplazado", "y se distingue de una inserción en casilla vacía");
        t.igual(r2.previo, "TEXTO QUE ESCRIBIÓ EL MÉDICO A MANO", "devolviendo el texto anterior para Deshacer");
        t.igual(ta.value, "BORRADOR NUEVO DE LA IA", "ahora sí quedó el borrador");
      }
    });

    t.caso("v17.13.0 — la hoja dice cuál examen fija la fecha y cuáles se enganchan", () => {
      // Encargo del médico (27-ago): «usa el contexto de drivers y pasajeros del promptware,
      // acá también es válido». Sin esto la lista de órdenes era plana y el modelo
      // justificaba la toma sobre cualquiera de ellas, a veces sobre un acompañante.
      const h = _hojaCompleta();
      const txt = api.mtrHojaDeHechosTexto(h);
      t.cierto(h.plan.dicta === null || typeof h.plan.dicta === "string",
        "la hoja trae qué examen fija la fecha, o null si ninguno la fijó");
      if (h.plan.dicta) {
        t.cierto(txt.indexOf("El examen que fija la fecha de la toma es") >= 0,
          "y se dice en el texto que ve el modelo");
      }
      // Y la jerga interna NO viaja: el médico fue explícito en que esos términos son del
      // programador, no del usuario final. La defensa real es no mandarle nunca la palabra.
      for (const jerga of ["DRIVER", "PASAJERO", "COSECHA", "AGUJERO NEGRO", " FTL", " ANR"]) {
        t.falso(txt.toUpperCase().indexOf(jerga) >= 0, "«" + jerga.trim() + "» no sale de la hoja");
      }
      const p = api.mtrRedaccionPrompt("analisis_plan", h, {});
      t.cierto(/LA TOMA SE JUSTIFICA SOBRE EL EXAMEN QUE FIJA SU FECHA/.test(p.system),
        "y el prompt sabe sobre cuál se justifica la toma");
      t.cierto(/JERGA INTERNA — PROHIBIDA EN LA SALIDA/.test(p.system), "con la jerga prohibida en la salida");
    });

    t.caso("v17.13.0 — la hoja del paciente no puede llevar identificadores de campo", () => {
      // Las Recomendaciones las lee el paciente y su familia. Con la historia de Everest en
      // el contexto (marcaciones con nombre de campo del sistema) el riesgo es real.
      const p = api.mtrRedaccionPrompt("recomendaciones", _hojaCompleta(), {});
      t.cierto(/NUNCA escribas identificadores de campo del sistema/.test(p.system),
        "prohibido explícitamente");
      t.cierto(p.system.indexOf("sedentarismo: sí") >= 0, "con el ejemplo concreto del pattern que se cuela");
    });

    t.caso("v17.13.0 — ninguna advertencia clínica se perdió por el camino", () => {
      // Regla del informe del enjambre: ninguna tanda quita peso a los avisos. Este caso
      // fija las prohibiciones que ya regían antes de esta versión.
      const ea = api.mtrRedaccionPrompt("enfermedad_actual", _hojaCompleta(), {}).system;
      for (const regla of [
        // v17.28.0 — la prohibición pasó de condicional ("inventar" la PA cuando no consta)
        // a incondicional (nunca, ni cuando consta): el texto cambió, la protección no.
        "Signos vitales o hallazgos de examen físico de HOY",
        "Resultados de laboratorio o paraclínicos",
        "Clasificación de riesgo cardiovascular",
        "Problemas administrativos",
      ]) t.cierto(ea.indexOf(regla) >= 0, "Enfermedad Actual conserva: «" + regla + "»");
      const np = api.mtrRedaccionPrompt("analisis_plan", _hojaCompleta(), {}).system;
      for (const regla of [
        "NO recalcules TFG",
        "DOBLE TFG",
        "AJUSTE DE DOSIS POR FUNCIÓN RENAL",
        "sin antibiótico a ciegas",
        "DATO NO DISPONIBLE",
      ]) t.cierto(np.indexOf(regla) >= 0, "Análisis y Plan conserva: «" + regla + "»");
    });

    t.caso("v17.16.0 — mtrAnalitoQueFijaLaToma, probada de frente y no de refilón", () => {
      // Estaba en `cubre` y solo se ejercitaba a través de mtrHojaDeHechos: el informe del
      // banco la listaba como «declarada pero nunca nombrada». Probarla de frente cuesta
      // seis líneas y fija sus tres decisiones, que son las que el modelo acaba leyendo.
      t.igual(api.mtrAnalitoQueFijaLaToma(null), null, "sin plan no se inventa un dictador");
      t.igual(api.mtrAnalitoQueFijaLaToma({}), null, "sin fecha de toma cruda tampoco");
      // La ventana renal manda sobre cualquier otro vencimiento.
      t.igual(api.mtrAnalitoQueFijaLaToma({ anr: { vence: "2026-08-30" }, ftlSinAjustar: "2026-09-10",
        drivers: [{ clave: "COLESTEROL_LDL", estado: "D", vence: "2026-09-10" }] }), "CREATININA",
        "con la ventana renal activa manda la creatinina, sea cual sea el resto");
      // Sin ventana renal: el driver cuyo vencimiento SE CONVIRTIÓ en la fecha de toma.
      t.igual(api.mtrAnalitoQueFijaLaToma({ ftlSinAjustar: "2026-09-10",
        drivers: [{ clave: "COLESTEROL_LDL", estado: "D", vence: "2026-09-10" },
                  { clave: "GLUCOSA", estado: "D", vence: "2026-11-02" }] }), "COLESTEROL_LDL",
        "manda el que fijó la fecha, no el primero de la lista");
      // Un vencimiento YA pasado (vencidoBase) no puede fijar nada: CERO VENCIDOS.
      t.igual(api.mtrAnalitoQueFijaLaToma({ ftlSinAjustar: "2026-09-10",
        drivers: [{ clave: "RAC", estado: "R", vence: "2026-09-10", vencidoBase: true }] }), null,
        "un examen ya vencido no fija la fecha: su «vencimiento» es una fecha pasada");
      // La fecha salió del piso de 14 días, no de un vencimiento: no hay dictador.
      t.igual(api.mtrAnalitoQueFijaLaToma({ ftlSinAjustar: "2026-08-30",
        drivers: [{ clave: "GLUCOSA", estado: "D", vence: "2026-11-02" }] }), null,
        "si ningún vencimiento fijó la fecha, se calla en vez de señalar a uno");
    });

  },
};
