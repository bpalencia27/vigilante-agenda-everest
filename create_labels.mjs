import XLSX from 'xlsx';

// Crear datos de prueba según los casos esperados
const testData = [
  {
    id: 1001,
    detail: 'VPH',
    expectedLabels: 'Tamización cérvix — VPH',
    abandono_pes: 'No'
  },
  {
    id: 1002,
    detail: 'CCU',
    expectedLabels: 'Tamización cérvix — citología (CCU)',
    abandono_pes: 'No'
  },
  {
    id: 1003,
    detail: 'sin detalle',
    expectedLabels: 'Tamización cérvix',
    abandono_pes: 'No'
  },
  {
    id: 1004,
    detail: 'solo prueba',
    expectedLabels: 'Tamización cérvix — VPH',
    abandono_pes: 'No'
  },
  {
    id: 1005,
    detail: 'CMB/MAMA/COLON',
    expectedLabels: 'riesgo cardio... | mama (examen+mamografía) | SOMF',
    abandono_pes: 'No'
  },
  {
    id: 1006,
    detail: 'AV/OD/PF/PSA/VIH',
    expectedLabels: 'Optometría | Odontología | Planificación Familiar | PSA | VIH',
    abandono_pes: 'No'
  },
  // CASOS 1007-1010: ABANDONO_PES TEST SUITE
  {
    id: 1007,
    detail: 'abandonoPES_si',
    expectedLabels: 'Programa de riesgo cardiovascular — ABANDONO',
    abandono_pes: 'Si'
  },
  {
    id: 1008,
    detail: 'abandonoPES_no',
    expectedLabels: 'Programa de riesgo cardiovascular',
    abandono_pes: 'No'
  },
  {
    id: 1009,
    detail: 'abandonoPES_si_acento',
    expectedLabels: 'Programa de riesgo cardiovascular — ABANDONO',
    abandono_pes: 'Sí'
  },
  {
    id: 1010,
    detail: 'abandonoPES_vacio',
    expectedLabels: 'Programa de riesgo cardiovascular',
    abandono_pes: ''
  }
];

// Crear workbook
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(testData);

// Ajustar anchos de columna
worksheet['!cols'] = [
  { wch: 8 },
  { wch: 20 },
  { wch: 50 }
];

XLSX.utils.book_append_sheet(workbook, worksheet, 'test_cases');
XLSX.writeFile(workbook, '/home/user/vigilante-agenda-everest/labels.xlsx');

console.log('✓ labels.xlsx creado con 10 casos de prueba (1001-1010, incluyendo 1007-1010 ABANDONO_PES)');
