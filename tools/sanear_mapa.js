#!/usr/bin/env node
// =====================================================================
//  SANEADOR DE MAPAS DE EVEREST
//
//  Los mapas (`MAPA_EVEREST_*.json`) los genera `MAPA_TOTAL_EVEREST.js` pegándolo en la
//  consola del consultorio. Su nota dice "Solo NOMBRES: ni un valor de casilla, ni una
//  celda de tabla, ni un dato de respuesta" — y es cierto para las casillas… pero
//  "nombre" ahí significa *nombre de campo*, y por una rendija se colaron **nombres de
//  persona**.
//
//  LA RENDIJA, en concreto: para cada botón, el capturador sube por el DOM buscando el
//  título de la sección que lo contiene y lo guarda en `botones[].seccion`. En la historia
//  clínica ese encabezado **es la cabecera del paciente**, así que el nombre completo
//  entraba ahí. En los cuatro mapas del 14-ago había 45 apariciones de tres pacientes
//  distintos.
//
//  Se detectó auditando antes de meterlos al repositorio, cuando iban a publicarse como
//  material de grounding — es decir, a punto de copiarse a modelos de terceros.
//
//  CÓMO SE DISTINGUE UN NOMBRE DE UNA SECCIÓN, sin listas negras:
//  de los 19 valores distintos de `seccion` en los cuatro mapas, las 16 etiquetas
//  legítimas van en caja mixta ("Ordenamientos", "Examen físico", "Antecedentes
//  Quirúrgicos") y las 3 en MAYÚSCULAS son los tres pacientes. La regla es esa, y
//  generaliza a cualquier paciente futuro. Falla cerrada: si algún día hay una sección
//  legítima en mayúsculas se pierde su etiqueta, que es infinitamente más barato que
//  publicar el nombre de alguien.
// =====================================================================
const fs = require("fs");
const path = require("path");

// Vocabulario de interfaz/clínica: una cadena en mayúsculas hecha SOLO de estas palabras
// es una etiqueta, no una persona.
const VOC = new Set(("HISTORIA CLINICA CLÍNICA PACIENTE PACIENTES AGENDA CITA CITAS CONSULTA EXAMEN EXAMENES EXÁMENES " +
  "ORDEN ORDENES ÓRDENES ORDENAMIENTO ORDENAMIENTOS LABORATORIO LABORATORIOS RESULTADO RESULTADOS FECHA HORA ESTADO " +
  "TIPO CODIGO CÓDIGO NOMBRE DOCUMENTO IDENTIFICACION IDENTIFICACIÓN TOTAL PARCIAL GENERAL CONTROL PROGRAMA RUTA " +
  "CRONICOS CRÓNICOS RIESGO CARDIOVASCULAR RENAL HEPATICO HEPÁTICO SANGRE ORINA SUERO GLUCOSA CREATININA COLESTEROL " +
  "TRIGLICERIDOS TRIGLICÉRIDOS HEMOGLOBINA HEMATOCRITO MICROALBUMINURIA ALBUMINURIA CREATINURIA UROANALISIS UROANÁLISIS " +
  "GLICOSILADA AUTOMATIZADA RELACION RELACIÓN DENSIDAD ALTA BAJA SI NO SIN CON DEL DE LA EL LOS LAS EN POR PARA Y O " +
  "GUARDAR CANCELAR CERRAR ACEPTAR BUSCAR NUEVO NUEVA EDITAR IMPRIMIR DESCARGAR VER MEDICO MÉDICO ENFERMERIA " +
  "NUTRICION NUTRICIÓN PSICOLOGIA PSICOLOGÍA ODONTOLOGIA ANTECEDENTES FAMILIARES PATOLOGICOS PATOLÓGICOS QUIRURGICOS " +
  "QUIRÚRGICOS ALERGIAS DIAGNOSTICO DIAGNÓSTICO DIAGNOSTICA CONDUCTA RECOMENDACIONES MEDICAMENTOS FORMULA FÓRMULA " +
  "SIGNOS VITALES PESO TALLA IMC PRESION PRESIÓN ARTERIAL FRECUENCIA CARDIACA CARDÍACA SELECCIONE SELECCIONAR OPCION " +
  "OPCIÓN NINGUNO NINGUNA OTRO OTROS OTRA TODOS TODAS EPS IPS CUPS CIE PYM PES RCV DM HTA ERC TFG RAC PTH HDL LDL " +
  "TGP TGO ALT AST MASCULINO FEMENINO ANOS AÑOS MESES DIAS DÍAS ACTIVO INACTIVO PENDIENTE VIGENTE PARACLINICOS " +
  "PARACLÍNICOS PROCEDIMIENTOS REMISION REMISIÓN INTERCONSULTA FOSFORO FÓSFORO ALBUMINA ALBÚMINA CALCIO POTASIO SODIO " +
  "NITROGENO NITRÓGENO UREICO ACIDO ÁCIDO URICO ÚRICO LEUCOCITOS PLAQUETAS DEPURACION DEPURACIÓN PROTEINURIA HORAS " +
  "SERICO SÉRICO PERFIL LIPIDICO LIPÍDICO IMPRESION IMPRESIÓN REPRESENTANTE LEGAL ACOMPAÑANTE MOTIVO ANALISIS ANÁLISIS " +
  "PLAN HISTORIAL EXTERNOS EXTERNO IMAGENOLOGIA IMAGENOLOGÍA SERVICIOS PAQUETES PREVENCION PREVENCIÓN FISICO FÍSICO " +
  "TASA FILTRACION FILTRACIÓN DATOS CONFIRMADO REPETIDO OBESIDAD CLASE NORMAL BAJO SOBREPESO DISCAPACIDADES " +
  "CONFLICTO ARMADO COLOMBIANO VICTIMA VÍCTIMA ENFERMEDAD LIQUIDO LÍQUIDO INTRAVENOSO CALCULO CÁLCULO FRAMINGHAM " +
  "ORIGEN ESCRIBE MAS MÁS " +
  // Conectores y determinantes: sin ellos, "SELECCIONE UNA OPCIÓN" se tomaba por un nombre
  // propio y se redactaba 52 veces. Sobre-redactar también es un fallo — se pierde el
  // catálogo de opciones de los desplegables, que es justo lo que sirve de grounding.
  "UN UNA UNOS UNAS ESTE ESTA ESTOS ESTAS ESE ESA SU SUS AL A ES SON ESTA ESTAN ESTÁN HAY " +
  "TIENE TIENEN DEBE DEBEN PUEDE PUEDEN AQUI AQUÍ ALLI ALLÍ COMO CÓMO CUAL CUÁL QUE QUÉ").split(/\s+/));

// ¿Esta cadena parece el nombre de una persona y no una etiqueta de interfaz?
function pareceNombreDePersona(s) {
  const t = String(s == null ? "" : s).trim();
  if (!t) return false;
  const pal = t.split(/\s+/);
  if (pal.length < 2 || pal.length > 5) return false;
  // Solo letras (con tildes y Ñ), todas en mayúscula, de 3 letras para arriba.
  if (!pal.every((p) => /^[A-ZÁÉÍÓÚÑ]{3,}$/.test(p))) return false;
  // Si TODAS las palabras son vocabulario conocido, es una etiqueta.
  if (pal.every((p) => VOC.has(p))) return false;
  return true;
}

const RE_DIG = /\b[1-9]\d{5,}\b/g;
const RE_TEL = /(?:\+57\s*)?\b3\d{9}\b/g;
const RE_MAIL = /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g;

const cuenta = { pacientes: 0, digitos: 0, telefonos: 0, correos: 0 };

function limpiarTexto(s) {
  let t = String(s);
  if (pareceNombreDePersona(t)) { cuenta.pacientes++; return "[PACIENTE]"; }
  const antesMail = t; t = t.replace(RE_MAIL, "[CORREO]"); if (t !== antesMail) cuenta.correos++;
  const antesTel = t; t = t.replace(RE_TEL, "[TEL]"); if (t !== antesTel) cuenta.telefonos++;
  const antesDig = t; t = t.replace(RE_DIG, "[NUM]"); if (t !== antesDig) cuenta.digitos++;
  return t;
}

function sanear(o) {
  if (typeof o === "string") return limpiarTexto(o);
  if (Array.isArray(o)) return o.map(sanear);
  if (o && typeof o === "object") {
    const out = {};
    for (const k of Object.keys(o)) out[k] = sanear(o[k]);
    return out;
  }
  return o;
}

// Se exporta para que el banco use ESTA MISMA regla en vez de reimplementarla. Tener el
// vocabulario en dos sitios garantiza que se separen: pasó en el primer intento, y el
// resultado fue una prueba que marcaba "OBESIDAD CLASE III" como si fuera una persona.
// Una prueba con falsos positivos acaba relajada, y entonces ya no protege de nada.
module.exports = { pareceNombreDePersona, VOC, limpiarTexto };

if (require.main !== module) { /* cargado como módulo: no se ejecuta el CLI */ } else {

const [entrada, salida] = process.argv.slice(2);
if (!entrada || !salida) {
  console.error("uso: node tools/sanear_mapa.js <mapa_crudo.json> <mapa_limpio.json>");
  process.exit(2);
}
const d = JSON.parse(fs.readFileSync(entrada, "utf8"));
const limpio = sanear(d);
limpio._saneado = {
  por: "tools/sanear_mapa.js",
  motivo: "El capturador guardaba en botones[].seccion el título de la sección que contiene cada botón, " +
          "y en la historia clínica ese título ES la cabecera del paciente. Se detectó al auditar los mapas " +
          "antes de publicarlos como material de grounding.",
  sustituciones: { nombresDePersona: cuenta.pacientes, correos: cuenta.correos, telefonos: cuenta.telefonos, numerosLargos: cuenta.digitos },
};
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify(limpio, null, 2) + "\n", "utf8");
console.log(path.basename(entrada) + " → " + path.basename(salida) +
  "  · nombres: " + cuenta.pacientes + " · correos: " + cuenta.correos +
  " · tel: " + cuenta.telefonos + " · números: " + cuenta.digitos);
}
