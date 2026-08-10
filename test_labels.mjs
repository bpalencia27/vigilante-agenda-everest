import XLSX from 'xlsx';
import fs from 'fs';

const XLSX_PATH = '/home/user/vigilante-agenda-everest/labels.xlsx';

// Validar que el archivo existe
if (!fs.existsSync(XLSX_PATH)) {
  console.error(`✗ Error: ${XLSX_PATH} no encontrado`);
  process.exit(1);
}

// Leer archivo
const workbook = XLSX.readFile(XLSX_PATH);
const worksheet = workbook.Sheets['test_cases'];

if (!worksheet) {
  console.error('✗ Error: Hoja "test_cases" no encontrada');
  process.exit(1);
}

// Convertir a JSON
const testCases = XLSX.utils.sheet_to_json(worksheet);

if (!testCases || testCases.length === 0) {
  console.error('✗ Error: No hay datos en la hoja');
  process.exit(1);
}

// ========== FUNCIÓN esSi() (desde userscript) ==========
function stripAccents(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function esSi(val) {
  if (val === null || val === undefined) return false;
  return stripAccents(String(val).trim().toLowerCase()) === "si";
}

// Casos esperados según especificación del usuario
const expectedResults = {
  1001: {
    detail: 'VPH',
    labels: ['Tamización cérvix — VPH'],
    abandono: false
  },
  1002: {
    detail: 'CCU',
    labels: ['Tamización cérvix — citología (CCU)'],
    abandono: false
  },
  1003: {
    detail: 'sin detalle',
    labels: ['Tamización cérvix'],
    abandono: false
  },
  1004: {
    detail: 'solo prueba',
    labels: ['Tamización cérvix — VPH'],
    abandono: false
  },
  1005: {
    detail: 'CMB/MAMA/COLON',
    labels: ['riesgo cardio...', 'mama (examen+mamografía)', 'SOMF'],
    abandono: false
  },
  1006: {
    detail: 'AV/OD/PF/PSA/VIH',
    labels: ['Optometría', 'Odontología', 'Planificación Familiar', 'PSA', 'VIH'],
    abandono: false
  },
  // Casos ABANDONO_PES
  1007: {
    detail: 'abandonoPES_si',
    labels: ['Programa de riesgo cardiovascular — ABANDONO'],
    abandono: true,
    value: 'Si'
  },
  1008: {
    detail: 'abandonoPES_no',
    labels: ['Programa de riesgo cardiovascular'],
    abandono: false,
    value: 'No'
  },
  1009: {
    detail: 'abandonoPES_si_acento',
    labels: ['Programa de riesgo cardiovascular — ABANDONO'],
    abandono: true,
    value: 'Sí'
  },
  1010: {
    detail: 'abandonoPES_vacio',
    labels: ['Programa de riesgo cardiovascular'],
    abandono: false,
    value: ''
  }
};

console.log('\n===== TEST DE ETIQUETAS CLÍNICAS =====\n');

let passed = 0;
let failed = 0;
const failures = [];

// Validar cada caso
testCases.forEach((testCase) => {
  const id = testCase.id;
  const expected = expectedResults[id];

  if (!expected) {
    console.log(`⚠  ID ${id}: No hay caso esperado definido`);
    return;
  }

  // Obtener etiquetas del caso (esperadas)
  const providedLabels = testCase.expectedLabels;

  // Procesar etiquetas (separadas por | o ,)
  const labelArray = providedLabels
    .split('|')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Validar etiquetas
  const expectedLabels = expected.labels;
  let casePass = true;

  // Verificar longitud
  if (labelArray.length !== expectedLabels.length) {
    casePass = false;
  }

  // Verificar contenido
  for (let i = 0; i < expectedLabels.length; i++) {
    if (!labelArray.includes(expectedLabels[i])) {
      casePass = false;
      break;
    }
  }

  if (casePass) {
    console.log(`✓ CASO ${id} (${expected.detail}): PASÓ`);
    console.log(`  Labels: ${labelArray.join(' | ')}`);
    passed++;
  } else {
    console.log(`✗ CASO ${id} (${expected.detail}): FALLÓ`);
    console.log(`  Esperado: ${expectedLabels.join(' | ')}`);
    console.log(`  Obtenido: ${labelArray.join(' | ')}`);
    failed++;
    failures.push({
      id,
      detail: expected.detail,
      expected: expectedLabels,
      received: labelArray
    });
  }
  console.log();
});

// Resumen
console.log('===== RESUMEN DE RESULTADOS =====\n');
console.log(`Total de casos: ${passed + failed}`);
console.log(`Casos pasados: ${passed}/10`);
console.log(`Casos fallidos: ${failed}/10`);

if (failed > 0) {
  console.log('\n===== CASOS CON FALLA =====\n');
  failures.forEach(f => {
    console.log(`ID ${f.id} (${f.detail}):`);
    console.log(`  Esperado: [${f.expected.map(l => `"${l}"`).join(', ')}]`);
    console.log(`  Obtenido: [${f.received.map(l => `"${l}"`).join(', ')}]`);
    console.log();
  });
}

// Verificar etiquetas genéricas escapadas
console.log('===== VERIFICACIÓN DE ETIQUETAS GENÉRICAS =====\n');
const genericLabels = ['generic', 'unknown', 'otro', 'other', 'sin clasificar'];
let hasGenericEscape = false;

testCases.forEach(testCase => {
  const id = testCase.id;
  const labels = testCase.expectedLabels
    .split('|')
    .map(l => l.trim()
      .toLowerCase());

  const foundGeneric = labels.some(label =>
    genericLabels.some(generic => label.includes(generic))
  );

  if (foundGeneric) {
    console.log(`⚠  ID ${id}: Contiene etiqueta genérica`);
    hasGenericEscape = true;
  }
});

if (!hasGenericEscape) {
  console.log('✓ No hay etiquetas genéricas escapadas detectadas\n');
}

// ========== VERIFICACIÓN DE FUNCIÓN esSi() Y SET ABANDONO ==========
console.log('===== FUNCIÓN esSi() VERIFICACIÓN =====\n');

const testCasesSi = [
  { input: 'Si', expected: true, desc: 'Si (sin acento)' },
  { input: 'Sí', expected: true, desc: 'Sí (con acento)' },
  { input: 'SI', expected: true, desc: 'SI (mayúsculas)' },
  { input: ' Sí ', expected: true, desc: 'Sí (con espacios)' },
  { input: 'No', expected: false, desc: 'No' },
  { input: 'Sin dato', expected: false, desc: 'Sin dato (no usa .includes())' },
  { input: '', expected: false, desc: 'Vacío' },
  { input: null, expected: false, desc: 'null' },
  { input: undefined, expected: false, desc: 'undefined' }
];

let esSiPass = 0;
let esSiFail = 0;

testCasesSi.forEach(test => {
  const result = esSi(test.input);
  if (result === test.expected) {
    console.log(`✓ esSi("${test.input}") = ${result} — ${test.desc}`);
    esSiPass++;
  } else {
    console.log(`✗ esSi("${test.input}") = ${result}, esperado ${test.expected} — ${test.desc}`);
    esSiFail++;
  }
});

console.log(`\n→ esSi() pasó ${esSiPass}/${testCasesSi.length} pruebas`);
if (esSiFail === 0) {
  console.log('✓ Función esSi() funciona exacto: NO confunde "Sin dato" con "Si"');
}

// Verificar Set de abandono desde los datos del xlsx
console.log('\n===== SET ABANDONO_PES VERIFICACIÓN =====\n');

const abandonoSet = new Set();
testCases.forEach(tc => {
  if (esSi(tc.abandono_pes)) {
    abandonoSet.add(tc.id);
  }
});

console.log(`Set abandono (IDs con "Si" o "Sí"): {${Array.from(abandonoSet).join(', ')}}`);

const expectedAbandonoIds = [1007, 1009];
let setPass = true;

expectedAbandonoIds.forEach(id => {
  if (abandonoSet.has(id)) {
    console.log(`✓ ID ${id} está en el Set (valor: "${testCases.find(tc => tc.id === id)?.abandono_pes}")`);
  } else {
    console.log(`✗ ID ${id} NO está en el Set`);
    setPass = false;
  }
});

[1008, 1010].forEach(id => {
  if (!abandonoSet.has(id)) {
    console.log(`✓ ID ${id} NO está en el Set (valor: "${testCases.find(tc => tc.id === id)?.abandono_pes}")`);
  } else {
    console.log(`✗ ID ${id} SÍ está en el Set pero no debería`);
    setPass = false;
  }
});

if (setPass && esSiFail === 0) {
  console.log('\n✓ Set abandono se carga correcto');
  console.log('✓ Función esSi() funciona exacto');
}

// Exit code
process.exit(failed > 0 || esSiFail > 0 || !setPass ? 1 : 0);
