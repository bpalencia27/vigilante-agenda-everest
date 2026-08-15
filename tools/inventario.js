// =====================================================================
//  INVENTARIO DE FUNCIONES Y DEUDA TÉCNICA — Vigilante de Agenda
//  Node puro, sin dependencias externas: node tools/inventario.js
//  Genera: docs/MAPA_v14.md y docs/DEUDA_v14.md
// =====================================================================
const fs = require("fs");
const path = require("path");

const RUTA_ROOT = path.join(__dirname, "..");
const RUTA_SCRIPT = path.join(RUTA_ROOT, "vigilante_agenda.user.js");
const RUTA_TESTS = path.join(RUTA_ROOT, "tests");
const RUTA_DOCS = path.join(RUTA_ROOT, "docs");

// Catálogo de funciones de riesgo ALTO (51 funciones clínicas y de seguridad)
const FUNCIONES_ALTO = new Set([
  "_conductaBuscarYAgregarExamen",
  "_esAnalitoDeOrina",
  "_hayComponenteUroReal",
  "_matchUroComponente",
  "_agruparUroanalisisParaTabla",
  "_findUroInput",
  "_marcarUroanalisisSi",
  "_atheneaCedulaCoincide",
  "_fechaDesdeNumeroSolicitud",
  "_matchLabInWhitelist",
  "_findLabField",
  "_findHbA1cFields",
  "_extractFechaSolicitudTopLevel",
  "_extractAtheneaFecha",
  "_valorCrudoLab",
  "_pacienteSigueAbierto",
  "injectLabsIntoCronicos",
  "_labNumerico",
  "_esSexoFemenino",
  "cockcroftGault",
  "_analitosRcvVencidos",
  "extractPacienteAbierto",
  "apptKey",
  "diaNuevo",
  "colorAndAlert",
  "apiAccesoBuscarPaciente",
  "apiAccesoBuscarCitasDisponibles",
  "perfilPaciente",
  "recomendacionHorario",
  "apiLaboratorioAgendarAuto",
  "apiDigiturnoFinalizarTicket",
  "apiAccesoObtenerLaboratoriosAnnar",
  "apiAccesoObtenerLaboratoriosCiti",
  "apiHcObtenerOrdenamientosVigentes",
  "apiHcObtenerSignosVitales",
  "_pesoDeSignosVitales",
  "apiAccesoObtenerDemograficos",
  "_creatininaDeLabs",
  "estadioRenalDelPaciente",
  "calcularEstadioRenal",
  "pymCubiertoPorOrdenVigente",
  "apiAccesoAgdValidarAgenda",
  "apiAccesoObtenerTurnos",
  "apiAccesoAsignarTurno",
  "apiOrdenamientoBuscarPaciente",
  "apiOrdenamientoObtenerDx",
  "apiOrdenamientoObtenerCup",
  "apiOrdenamientoGuardar",
  "apiOrdenamientoGenerarLinks",
  "_pymYaOrdenadoHoyDesdeElScript",
  "checkRacGuardia"
]);

// Catálogo de funciones de riesgo BAJO (41 utilidades puras, audio y UI menor)
const FUNCIONES_BAJO = new Set([
  "_canonTexto", "_canonNombreLab", "limpiarEspacios", "stripToAlphanum", "escapeHtml",
  "highlight", "fuzzyMatch", "slugify", "colToIdx", "pad", "san", "signatureOf",
  "horaBonita", "parseHoraMin", "elapsedMin", "vivoElapsed", "format12hTime", "normalizeHora",
  "calcBusinessTargetDate", "calcBusinessDaysBefore", "calcTargetDateRange", "calcRangoSondeoIso",
  "calcDateRangeAroundIso", "citaFechaFmt", "countdown", "esFestivo",
  "playTone", "beep", "startNag", "stopNag", "startFlash", "stopFlash", "faviconUrl", "setFavicon",
  "colorDot", "closeSheet", "toggleSheet", "cnt", "sw", "q", "bind", "savePos", "restorePos"
]);

const DESCRIPCIONES_ALTO = {
  "_conductaBuscarYAgregarExamen": "Inserta líneas de conducta diagnóstica en el formulario clínico de Everest.",
  "_esAnalitoDeOrina": "Discrimina componentes de orina para evitar cruce de casillas.",
  "_hayComponenteUroReal": "Valida presencia de datos reales antes de marcar casillas de uroanálisis.",
  "_matchUroComponente": "Mapea analito recibido a componente específico del parcial de orina.",
  "_agruparUroanalisisParaTabla": "Agrupa analitos de orina para visualización y escritura en bloque.",
  "_findUroInput": "Localiza input específico de uroanálisis en el DOM de Everest.",
  "_marcarUroanalisisSi": "Modifica estado del selector 'Presenta Uroanálisis: SÍ' en Everest.",
  "_atheneaCedulaCoincide": "Guarda anti-cruce: Valida coincidencia estricta de cédula entre Everest y Athenea.",
  "_fechaDesdeNumeroSolicitud": "Extrae fecha clínica a partir del número de solicitud de laboratorio.",
  "_matchLabInWhitelist": "Matriz 13 Labs: Mapeo exacto entre catálogo Athenea y whitelist clínica.",
  "_findLabField": "Localiza input de analito en formulario de crónicos de Everest.",
  "_findHbA1cFields": "Localiza casillas específicas de Hemoglobina Glicosilada.",
  "_extractFechaSolicitudTopLevel": "Extrae fecha de solicitud para validación de vigencia clínica.",
  "_extractAtheneaFecha": "Parser de fechas de resultados con múltiples formatos colombianos.",
  "_valorCrudoLab": "Extracción de valor antes de parseo numérico; previene mutilación de signos.",
  "_pacienteSigueAbierto": "Guarda crítica: Aborta escritura si el médico cambió de paciente durante la petición.",
  "injectLabsIntoCronicos": "Superficie de escritura principal: Inyecta hasta 13 laboratorios en la HC.",
  "_labNumerico": "Convierte valor textual a float clínico preservando decimales y comas.",
  "_esSexoFemenino": "Factor multiplicador (0.85) en fórmula de Cockcroft-Gault.",
  "cockcroftGault": "Cálculo de Tasa de Filtración Glomerular estimada (eGFR / CrCl).",
  "_analitosRcvVencidos": "Evaluación de vigencia de 180/365 días en analitos cardiovasculares.",
  "extractPacienteAbierto": "Extrae cédula y nombre del paciente activo en la pestaña de Everest.",
  "apptKey": "Llave única de cita (doc_id@hora); previene falso positivo en citas múltiples.",
  "diaNuevo": "Limpia listas fraudWatch y alertedFraud al cambiar de jornada.",
  "colorAndAlert": "Máquina de estados de colores (Verde, Ámbar, Morado, Rojo) y alertas de fraude.",
  "apiAccesoBuscarPaciente": "Consulta demográfica del paciente en la base de Everest.",
  "apiAccesoBuscarCitasDisponibles": "Consulta de cupos reales en la agenda de la sede.",
  "perfilPaciente": "Determinación de perfil clínico del paciente para sugerencias.",
  "recomendacionHorario": "Sugerencia de franja horaria óptima para próxima cita.",
  "apiLaboratorioAgendarAuto": "Mutación de Agenda: Agenda cita de toma de laboratorio en Everest.",
  "apiDigiturnoFinalizarTicket": "Cierra ticket en sistema de llamado de pacientes.",
  "apiAccesoObtenerLaboratoriosAnnar": "Consulta histórica de laboratorios en Annar.",
  "apiAccesoObtenerLaboratoriosCiti": "Consulta histórica de laboratorios en Citi.",
  "apiHcObtenerOrdenamientosVigentes": "Consulta órdenes activas del paciente para evitar duplicación.",
  "apiHcObtenerSignosVitales": "Consulta peso y presión arterial en Everest para Cockcroft-Gault.",
  "_pesoDeSignosVitales": "Extrae peso corporal en kg para fórmula de función renal.",
  "apiAccesoObtenerDemograficos": "Consulta edad y sexo del paciente para cálculos clínicos.",
  "_creatininaDeLabs": "Extrae último valor de creatinina sérica para cálculo renal.",
  "estadioRenalDelPaciente": "Orquesta cálculo de eGFR y clasificación en estadios G1 a G5.",
  "calcularEstadioRenal": "Clasificación numérica estricta según guías KDIGO.",
  "pymCubiertoPorOrdenVigente": "Verifica si actividad PyM ya está cubierta por orden vigente en Everest.",
  "apiAccesoAgdValidarAgenda": "Valida restricciones de agenda antes de reservar.",
  "apiAccesoObtenerTurnos": "Obtiene turnos disponibles en la agenda médica.",
  "apiAccesoAsignarTurno": "Mutación de Agenda: Asigna cita médica definitiva en Everest.",
  "apiOrdenamientoBuscarPaciente": "Valida paciente en módulo de órdenes médicas.",
  "apiOrdenamientoObtenerDx": "Obtiene diagnósticos CIE-10 asociados al paciente.",
  "apiOrdenamientoObtenerCup": "Valida código CUPS y cobertura en el plan de beneficios.",
  "apiOrdenamientoGuardar": "Superficie de Escritura: Guarda orden médica oficial en Everest.",
  "apiOrdenamientoGenerarLinks": "Genera enlaces de impresión y PDF de órdenes clínicas.",
  "_pymYaOrdenadoHoyDesdeElScript": "Previene ordenamiento duplicado en la misma sesión de consulta.",
  "checkRacGuardia": "Protección de casilla: Guardia anti-borrado y respeto a la decisión médica."
};

function encontrarNombresFlecha(src) {
  const nombres = [];
  const cabecera = /\n\s{0,4}(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?/g;
  let m;
  while ((m = cabecera.exec(src))) {
    let i = cabecera.lastIndex;
    let profundidad = src[i - 1] === "(" ? 1 : 0;
    let hallado = false;
    const limite = Math.min(src.length, i + 500);
    for (; i < limite; i++) {
      const c = src[i];
      if (c === "(") profundidad++;
      else if (c === ")") { profundidad--; if (profundidad < 0) break; }
      else if (profundidad <= 0 && (c === ";" || c === "\n")) break;
      else if (profundidad <= 0 && c === "=" && src[i + 1] === ">") { hallado = true; break; }
    }
    if (hallado) nombres.push(m[1]);
  }
  return nombres;
}

function obtenerLineasFunciones(src) {
  const lineas = src.split("\n");
  const mapa = {};
  
  lineas.forEach((linea, idx) => {
    const numLinea = idx + 1;
    // function foo(...)
    const matchFn = linea.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
    if (matchFn) {
      if (!mapa[matchFn[1]]) mapa[matchFn[1]] = numLinea;
    }
    // const/let foo = (...) =>
    const matchArrow = linea.match(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?/);
    if (matchArrow) {
      if (!mapa[matchArrow[1]]) mapa[matchArrow[1]] = numLinea;
    }
  });

  return mapa;
}

function analizarSuites() {
  const archivos = fs.readdirSync(RUTA_TESTS).filter(f => /^suite_.*\.js$/.test(f)).sort();
  const cubiertasPorSuite = {};
  const textoSinBloquesCubreArr = [];

  for (const arch of archivos) {
    const rutaArch = path.join(RUTA_TESTS, arch);
    const texto = fs.readFileSync(rutaArch, "utf8");
    const suite = require(rutaArch);
    const cubre = Array.isArray(suite.cubre) ? suite.cubre : [];
    
    cubre.forEach(fn => {
      if (!cubiertasPorSuite[fn]) cubiertasPorSuite[fn] = [];
      cubiertasPorSuite[fn].push(arch);
    });

    const bloqueCubre = (texto.match(/cubre:\s*\[[\s\S]*?\]/) || [""])[0];
    const textoLimpio = bloqueCubre ? texto.replace(bloqueCubre, "") : texto;
    textoSinBloquesCubreArr.push(textoLimpio);
  }

  const textoTotalSuites = textoSinBloquesCubreArr.join("\n");

  return { archivos, cubiertasPorSuite, textoTotalSuites };
}

function esNombradaEnSuites(nombre, textoSuites) {
  const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\b" + escapado + "\\b").test(textoSuites);
}

function extraerDeudaTecnica(srcScript) {
  const deuda = [];
  const lineas = srcScript.split("\n");
  const regexDeuda = /\/\/(.*?\b(TODO|FIXME|HACK|XXX|PENDIENTE|WORKAROUND|PARCHE|REGRESION|ADVERTENCIA|OJO)\b.*)$/i;

  lineas.forEach((linea, idx) => {
    const numLinea = idx + 1;
    const match = linea.match(regexDeuda);
    if (match) {
      const keywordMatch = match[0].match(/\b(TODO|FIXME|HACK|XXX|PENDIENTE|WORKAROUND|PARCHE|REGRESION|ADVERTENCIA|OJO)\b/i);
      const tipo = keywordMatch ? keywordMatch[1].toUpperCase() : "TODO";
      const fragmento = match[1].trim().slice(0, 140);
      
      let categoria = "Menor / Refactor";
      if (/clinico|paciente|cruce|renal|kdigo|dosis|athenea|everest|fraude|orden|seguridad|secret/i.test(fragmento) || /FIXME|HACK|XXX/i.test(tipo)) {
        categoria = "Crítico / Clínico";
      } else if (/memoria|cache|cuota|storage|state|window|concurrencia|tab|lock|db/i.test(fragmento)) {
        categoria = "Arquitectura / Estado";
      } else if (/test|prueba|suite|mock|harness|assert/i.test(fragmento)) {
        categoria = "Pruebas / Cobertura";
      }

      deuda.push({
        archivo: "vigilante_agenda.user.js",
        linea: numLinea,
        tipo,
        fragmento: fragmento || linea.trim(),
        categoria
      });
    }
  });

  return deuda;
}

function generarReportes() {
  if (!fs.existsSync(RUTA_DOCS)) {
    fs.mkdirSync(RUTA_DOCS, { recursive: true });
  }

  const src = fs.readFileSync(RUTA_SCRIPT, "utf8").replace(/\r\n/g, "\n");
  const lineasMapa = obtenerLineasFunciones(src);

  const decl = [...src.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
  const flecha = encontrarNombresFlecha(src);
  const todasDeclaradas = [...new Set(decl.concat(flecha))].sort();

  const { archivos, cubiertasPorSuite, textoTotalSuites } = analizarSuites();

  const inventario = todasDeclaradas.map(fn => {
    const linea = lineasMapa[fn] || 1;
    const suites = cubiertasPorSuite[fn] || [];
    const estaCubierta = suites.length > 0;
    const nombrada = estaCubierta && esNombradaEnSuites(fn, textoTotalSuites);

    let riesgo = "MEDIO";
    if (FUNCIONES_ALTO.has(fn)) riesgo = "ALTO";
    else if (FUNCIONES_BAJO.has(fn)) riesgo = "BAJO";

    const descripcion = DESCRIPCIONES_ALTO[fn] || (riesgo === "BAJO" ? "Utilidad pura, tiempo, audio o presentación menor" : "Operación de interfaz, API, almacenamiento o estado");

    return {
      nombre: fn,
      linea,
      riesgo,
      estaCubierta,
      nombrada,
      suites,
      descripcion
    };
  });

  const altos = inventario.filter(f => f.riesgo === "ALTO").sort((a, b) => a.linea - b.linea);
  const medios = inventario.filter(f => f.riesgo === "MEDIO").sort((a, b) => a.linea - b.linea);
  const bajos = inventario.filter(f => f.riesgo === "BAJO").sort((a, b) => a.linea - b.linea);

  const sinCubrir = inventario.filter(f => !f.estaCubierta);
  const nuncaNombradas = inventario.filter(f => f.estaCubierta && !f.nombrada);

  // 1. Generar docs/MAPA_v14.md
  let mdMapa = `# Mapa Arquitectónico y Catálogo de Funciones — Vigilante de Agenda (v14)

**Fecha de generación:** ${new Date().toISOString()}  
**Archivo analizado:** \`vigilante_agenda.user.js\` (${todasDeclaradas.length} funciones declaradas)  
**Suites de prueba:** ${archivos.length} archivos en \`tests/\`  

---

## 1. Resumen Ejecutivo del Inventario

| Nivel de Riesgo | Total Funciones | Cubiertas (\`cubre:\`) | Efectivas (Nombradas) | Sin Cubrir |
|---|---|---|---|---|
| 🔴 **ALTO (Clínico / Escritura / Fraude)** | **${altos.length}** | ${altos.filter(f => f.estaCubierta).length} | ${altos.filter(f => f.nombrada).length} | ${altos.filter(f => !f.estaCubierta).length} |
| 🟡 **MEDIO (Operación / DOM / Red / Estado)** | **${medios.length}** | ${medios.filter(f => f.estaCubierta).length} | ${medios.filter(f => f.nombrada).length} | ${medios.filter(f => !f.estaCubierta).length} |
| 🟢 **BAJO (Utilidades Puras / Formato / Audio)** | **${bajos.length}** | ${bajos.filter(f => f.estaCubierta).length} | ${bajos.filter(f => f.nombrada).length} | ${bajos.filter(f => !f.estaCubierta).length} |
| **TOTAL** | **${inventario.length}** | **${inventario.filter(f => f.estaCubierta).length} (${(inventario.filter(f => f.estaCubierta).length / inventario.length * 100).toFixed(1)}%)** | **${inventario.filter(f => f.nombrada).length}** | **${sinCubrir.length}** |

---

## 2. Catálogo de Funciones de Riesgo ALTO (51 Funciones Críticas)
*Funciones con impacto clínico directo: escrituras en historia clínica Everest, cálculo renal KDIGO, agendamiento de citas, emisión de órdenes CUPS o máquina de fraude.*

| # | Línea | Función | Estado Cobertura | Suites Asociadas | Descripción Clínica |
|---|---|---|---|---|---|
`;

  altos.forEach((fn, idx) => {
    const estado = fn.estaCubierta ? (fn.nombrada ? "🟢 Cubierta (Nombrada)" : "🟡 Cubierta (No nombrada)") : "🔴 SIN CUBRIR";
    const suitesStr = fn.suites.length > 0 ? fn.suites.join(", ") : "*(Ninguna)*";
    mdMapa += `| ${idx + 1} | L${fn.linea} | \`${fn.nombre}\` | ${estado} | ${suitesStr} | ${fn.descripcion} |\n`;
  });

  mdMapa += `\n---

## 3. Funciones Sin Cubrir (${sinCubrir.length} funciones)
*Funciones presentes en el userscript pero ausentes de los arrays \`cubre: [...]\` de las suites de prueba:*

| # | Línea | Función | Nivel de Riesgo | Justificación / Plan de Cobertura |
|---|---|---|---|---|
`;

  sinCubrir.forEach((fn, idx) => {
    mdMapa += `| ${idx + 1} | L${fn.linea} | \`${fn.nombre}\` | **${fn.riesgo}** | ${fn.descripcion} |\n`;
  });

  mdMapa += `\n---

## 4. Funciones Declaradas pero Nunca Nombradas en Aserciones (${nuncaNombradas.length} funciones)
*Funciones autoinformadas en \`cubre: [...]\` pero cuyo identificador literal no aparece en el cuerpo de las pruebas:*

| # | Línea | Función | Nivel de Riesgo | Suites que la declaran |
|---|---|---|---|---|
`;

  nuncaNombradas.forEach((fn, idx) => {
    mdMapa += `| ${idx + 1} | L${fn.linea} | \`${fn.nombre}\` | ${fn.riesgo} | ${fn.suites.join(", ")} |\n`;
  });

  mdMapa += `\n---

## 5. Catálogo de Funciones de Riesgo MEDIO (${medios.length} funciones)

| Línea | Función | Estado | Suites |
|---|---|---|---|
`;
  medios.forEach(fn => {
    const estado = fn.estaCubierta ? "🟢 Cubierta" : "🔴 Sin cubrir";
    mdMapa += `| L${fn.linea} | \`${fn.nombre}\` | ${estado} | ${fn.suites.join(", ") || "-"} |\n`;
  });

  mdMapa += `\n---

## 6. Catálogo de Funciones de Riesgo BAJO (${bajos.length} funciones)

| Línea | Función | Estado | Suites |
|---|---|---|---|
`;
  bajos.forEach(fn => {
    const estado = fn.estaCubierta ? "🟢 Cubierta" : "🔴 Sin cubrir";
    mdMapa += `| L${fn.linea} | \`${fn.nombre}\` | ${estado} | ${fn.suites.join(", ") || "-"} |\n`;
  });

  fs.writeFileSync(path.join(RUTA_DOCS, "MAPA_v14.md"), mdMapa, "utf8");
  console.log(`[Inventario] Generado docs/MAPA_v14.md (${inventario.length} funciones catalogadas).`);

  // 2. Generar docs/DEUDA_v14.md
  const deuda = extraerDeudaTecnica(src);

  let mdDeuda = `# Catálogo de Deuda Técnica y Marcadores — Vigilante de Agenda (v14)

**Fecha de generación:** ${new Date().toISOString()}  
**Archivo analizado:** \`vigilante_agenda.user.js\`  
**Total de comentarios de deuda catalogados:** ${deuda.length}  

---

## 1. Resumen por Categoría de Impacto

| Categoría de Impacto | Total Hallazgos | Prioridad de Resolución |
|---|---|---|
| 🚨 **Crítico / Clínico** | **${deuda.filter(d => d.categoria === "Crítico / Clínico").length}** | Inmediata (M1 - M3) |
| ⚙️ **Arquitectura / Estado** | **${deuda.filter(d => d.categoria === "Arquitectura / Estado").length}** | Media (M3 - M4) |
| 🧪 **Pruebas / Cobertura** | **${deuda.filter(d => d.categoria === "Pruebas / Cobertura").length}** | Alta (M4) |
| 📝 **Menor / Refactor** | **${deuda.filter(d => d.categoria === "Menor / Refactor").length}** | Baja (M6) |
| **TOTAL** | **${deuda.length}** | — |

---

## 2. Inventario Detallado de Comentarios de Deuda

| # | Línea | Etiqueta | Categoría | Fragmento Verbatim |
|---|---|---|---|---|
`;

  deuda.forEach((d, idx) => {
    const cleanFrag = d.fragmento.replace(/\|/g, "\\|").replace(/\n/g, " ");
    mdDeuda += `| ${idx + 1} | L${d.linea} | \`${d.tipo}\` | **${d.categoria}** | \`${cleanFrag}\` |\n`;
  });

  fs.writeFileSync(path.join(RUTA_DOCS, "DEUDA_v14.md"), mdDeuda, "utf8");
  console.log(`[Inventario] Generado docs/DEUDA_v14.md (${deuda.length} ítems de deuda catalogados).`);
}

if (require.main === module) {
  try {
    generarReportes();
  } catch (e) {
    console.error("Error al generar inventario:", e);
    process.exit(1);
  }
}

module.exports = {
  generarReportes,
  FUNCIONES_ALTO,
  FUNCIONES_BAJO,
  encontrarNombresFlecha,
  obtenerLineasFunciones,
  extraerDeudaTecnica
};
