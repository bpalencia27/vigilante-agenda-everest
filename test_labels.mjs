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

// Casos esperados según especificación del usuario
const expectedResults = {
  1001: {
    detail: 'VPH',
    labels: ['Tamización cérvix — VPH']
  },
  1002: {
    detail: 'CCU',
    labels: ['Tamización cérvix — citología (CCU)']
  },
  1003: {
    detail: 'sin detalle',
    labels: ['Tamización cérvix']
  },
  1004: {
    detail: 'solo prueba',
    labels: ['Tamización cérvix — VPH']
  },
  1005: {
    detail: 'CMB/MAMA/COLON',
    labels: ['riesgo cardio...', 'mama (examen+mamografía)', 'SOMF']
  },
  1006: {
    detail: 'AV/OD/PF/PSA/VIH',
    labels: ['Optometría', 'Odontología', 'Planificación Familiar', 'PSA', 'VIH']
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
console.log(`Casos pasados: ${passed}/6`);
console.log(`Casos fallidos: ${failed}/6`);

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

// Exit code
process.exit(failed > 0 ? 1 : 0);
