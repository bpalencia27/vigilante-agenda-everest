import XLSX from 'xlsx';

// Crear datos de prueba según los casos esperados
const testData = [
  {
    id: 1001,
    detail: 'VPH',
    expectedLabels: 'Tamización cérvix — VPH'
  },
  {
    id: 1002,
    detail: 'CCU',
    expectedLabels: 'Tamización cérvix — citología (CCU)'
  },
  {
    id: 1003,
    detail: 'sin detalle',
    expectedLabels: 'Tamización cérvix'
  },
  {
    id: 1004,
    detail: 'solo prueba',
    expectedLabels: 'Tamización cérvix — VPH'
  },
  {
    id: 1005,
    detail: 'CMB/MAMA/COLON',
    expectedLabels: 'riesgo cardio... | mama (examen+mamografía) | SOMF'
  },
  {
    id: 1006,
    detail: 'AV/OD/PF/PSA/VIH',
    expectedLabels: 'Optometría | Odontología | Planificación Familiar | PSA | VIH'
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

console.log('✓ labels.xlsx creado con 6 casos de prueba');
