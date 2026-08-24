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
    "mtrRedaccionPrompt", "mtrRespuestaGemini", "mtrLimpiarNotaIA", "mtrVerificarCifrasIA",
    "mtrGeminiRedactar", "mtrEstiloGuardar", "mtrEstiloLeer",
    "mtrGuardarClaveGemini", "mtrLeerClaveGemini",
    "mtrModeloGemini", "_mtrModeloIdx", "mtrRotarModelo", "mtrEsCuotaAgotada", "mtrEsModeloSobrecargado", "mtrEsModeloNoDisponible", "mtrHojaDesdeResumen",
    "mtrDatosExtraGuardar", "mtrDatosExtraLeer", "mtrDatosExtraTexto",
    "mtrJsonV68DesdeResumen", "mtrLeerTextoLibreHistoria",
    "mtrCasillaDeModo", "mtrRedactorModoSugerido", "mtrInsertarEnCasillaModo",
    "mtrCacheResumenEdadMin", "mtrCacheResumenBorrar",
    "mtrCalcularDeltaEdicion",
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
      t.cierto(/DE HOY/.test(ea.system), "regla 6 acota las cifras objetivas a HOY, no a un control pasado");
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
    // inventando la presión arterial (p. ej. «PA 110/70»). Raíz: las reglas 5 y 6 de
    // MTR_EA_SYS pedían la PA como contenido OBLIGATORIO incondicional; cuando la TA no
    // está documentada (o no se leyó del DOM), el modelo «rellenaba» con una cifra típica
    // en vez de omitirla — exactamente lo que prohíbe la regla del proyecto (casilla vacía
    // antes que dato inventado). La regla 6 ahora condiciona las cifras objetivas a que
    // ESTÉN en los bloques entregados, la regla 5 condiciona el automonitoreo de PA, y
    // PROHIBIDO nombra explícitamente que inventar cifras de signos vitales no se hace.
    t.caso("Enfermedad Actual ya NO exige la PA cuando no viene en los hechos: se omite, no se inventa", () => {
      const ea = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {});
      // Regla 6: las cifras objetivas se escriben SOLO si están en los bloques entregados.
      t.cierto(/si (?:esa|la|una) cifra no est[áa]|no la escribas|om[íi]tela/i.test(ea.system),
        "regla 6 condiciona las cifras objetivas a que estén en los hechos — la PA ausente se omite, no se inventa");
      // Regla 5: el automonitoreo de PA solo se menciona si consta en los datos.
      t.cierto(/automonitoreo de presión arterial[^\n]*SOLO si|si no consta[^\n]*no se menciona/i.test(ea.system),
        "regla 5 condiciona el automonitoreo de PA a que el paciente lo reporte");
      // PROHIBIDO: inventar la PA está prohibido por su nombre (patrón positivo+negativo).
      t.cierto(/inventar[^\n]*presi[óo]n arterial|presi[óo]n arterial[^\n]*no est[áa]/i.test(ea.system),
        "PROHIBIDO nombra explícitamente no inventar cifras de presión arterial");
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

    t.caso("los datos aportados por el médico y el texto libre entran al prompt (desidentificados)", () => {
      const p = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), {
        contextoLibre: "Motivo: control. Revisión/examen: refiere cefalea leve.",
        datosExtra: { sintomas: "disnea de esfuerzo, correo juan@x.com colado", adherencia: "buena", motivo: "" },
      });
      t.cierto(/DATOS APORTADOS POR EL MÉDICO/.test(p.user), "bloque de datos aportados");
      t.cierto(p.user.indexOf("disnea de esfuerzo") >= 0, "incluye el síntoma aportado");
      t.cierto(p.user.indexOf("juan@x.com") < 0, "pero desidentifica lo colado");
      t.cierto(/TEXTO YA REGISTRADO/.test(p.user) && p.user.indexOf("cefalea leve") >= 0, "y el texto ya escrito hoy");
    });

    t.caso("con 'mi estilo' activo, se inyectan los ejemplos (ya desidentificados)", () => {
      const p = api.mtrRedaccionPrompt("enfermedad_actual", hojaDemo(api), { usarEstilo: true, estiloEjemplos: ["Paciente que acude a control, estable."] });
      t.cierto(/EMULA EL ESTILO/.test(p.user), "el prompt pide emular el estilo");
      t.cierto(p.user.indexOf("acude a control") >= 0, "e incluye el ejemplo");
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
    await t.casoAsync("conector: los modelos 3.x NO llevan temperature (guía oficial, tope 2048); el único 2.x de la rotación (gemini-2.5-flash-lite) SÍ conserva temperature 0.2", async () => {
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
      t.cierto(cuerpos.every((x) => x.body.generationConfig.maxOutputTokens === 2048), "tope de salida 2048 en los tres (nota completa sin truncar)");
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

      // 2. Modelo por casilla: potente para las notas largas, rotación para lo corto.
      t.igual(api.mtrModeloGemini("analisis_plan"), "gemini-3.7-flash", "la nota médico-legal va al modelo más capaz");
      t.igual(api.mtrModeloGemini("enfermedad_actual"), "gemini-3.7-flash", "la enfermedad actual también");
      // v17.3.0 — "gemini-2.5-flash" salió de la lista (404, retirado por Google;
      // reemplazado 1:1 por "gemini-3.6-flash", que la propia API recomienda).
      // v17.4.0 — se suman "gemini-2.5-flash-lite" y "gemini-3-flash" (cotejo 22-ago
      // contra el panel real de límites, ver MTR_GEMINI_MODELOS).
      t.cierto(api.mtrModeloGemini("recomendaciones") !== undefined && ["gemini-3.5-flash-lite","gemini-3.1-flash-lite","gemini-3.6-flash","gemini-3.5-flash","gemini-2.5-flash-lite","gemini-3-flash","gemini-3.7-flash"].indexOf(api.mtrModeloGemini("recomendaciones")) >= 0, "lo corto sigue en la rotación");

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
      t.cierto(corta.every((x) => x.body.generationConfig.maxOutputTokens === 2048), "el tope de salida NO se recorta en ninguno (lección v14.2: notas truncadas)");
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
      // v17.6.0 — mismo TTL que mtrCacheResumenLeer (MTR_CACHE_TTL_MS, bajado de 20 a
      // 10 min): pasado el nuevo corte, la edad también debe darse por vencida (null),
      // no seguir informando una edad de una caché que ya nadie va a usar.
      c.api.__envejecerCacheResumen(9 * 60000);
      t.igual(c.api.mtrCacheResumenEdadMin("111"), 9, "a los 9 min, con el TTL nuevo, informa 9 minutos de edad");
      c.api.__envejecerCacheResumen(10 * 60000 + 1000);
      t.igual(c.api.mtrCacheResumenEdadMin("111"), null, "a los 10 min y 1 s, el TTL nuevo ya la da por vencida: null, no una edad enorme");
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

    t.caso("mtrDatosExtraTexto solo emite lo no vacío y desidentifica", () => {
      const txt = api.mtrDatosExtraTexto({ sintomas: "disnea, tel 3151234567", adherencia: "", motivo: "control" });
      t.cierto(/Síntomas .*disnea/.test(txt), "incluye síntomas");
      t.cierto(txt.indexOf("Adherencia") < 0, "omite lo vacío");
      t.cierto(txt.indexOf("3151234567") < 0, "censura el teléfono colado");
    });

    t.caso("mtrJsonV68DesdeResumen mapea lo determinista y deja la prosa en blanco", () => {
      const resumen = {
        _hoyIso: "2026-08-23",
        programa: "HTA", erc: { crcl: 48, egfr: 52, estadioAdministrativo: "G3a", estadioClinico: "G3a", remitirNefrologia: false, datosCompletos: true },
        riesgo: { categoria: "alto" }, meta: { metas: { ldl: 70 } }, foco: "renal",
        plan: { ftl: "2026-09-01", control: { fecha: "2026-09-07" }, faltantes: [{ clave: "RAC" }], vencidos: [{ clave: "HBA1C" }] },
      };
      const j = api.mtrJsonV68DesdeResumen(resumen, { medicamentos: ["LOSARTAN 50 MG"] });
      t.igual(j.version, "68", "versión");
      t.igual(j.cv_risk, "alto", "riesgo");
      t.igual(j.tfg_ckdepi, 52, "TFG clínica");
      t.igual(j.estadio_administrativo, "G3a", "estadio admin");
      t.igual(j.ldl_target, 70, "meta");
      t.cierto(j.order_list.indexOf("RAC") >= 0 && j.order_list.indexOf("HBA1C") >= 0, "order_list");
      // v17.6.8 — las fechas de agenda se relativizan (cuasi-identificadores): nunca crudas.
      t.igual(j.ftl_date, "en 9 días", "FTL se relativiza respecto a hoy (9 días del 23-ago al 1-sep)");
      t.igual(j.control_date, "en 15 días", "control se relativiza igual (15 días al 7-sep)");
      t.igual(j.nota_clinica.justificacion_riesgo_meta, "", "la prosa la escribe el LLM, no el motor");
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

  },
};
