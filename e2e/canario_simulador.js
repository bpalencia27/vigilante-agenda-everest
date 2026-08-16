#!/usr/bin/env node
// =====================================================================
//  EJECUTOR DEL CANARIO DE CONTRATO DOM — SIMULADOR SIN DEPENDENCIAS
//  Verifica todas las suposiciones de CONTRATO_DOM.json contra los fixtures
//  CERO DATOS DE PACIENTES: Fixtures 100% sintéticos congelados.
//  Uso: node e2e/canario_simulador.js
// =====================================================================
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const FIXTURES_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');
const CONTRATO_PATH = path.join(ROOT_DIR, 'CONTRATO_DOM.json');

const contrato = JSON.parse(fs.readFileSync(CONTRATO_PATH, 'utf8'));

console.log('=====================================================================');
console.log('  CANARIO DE FRONTERA — COMPROBACIÓN EN EL SIMULADOR');
console.log(`  Suposiciones a evaluar: ${contrato.length}`);
console.log('=====================================================================\n');

let aprobadas = 0;
let advertencias = 0;
let fallos = 0;

// Cargar fixtures
const htmlAgenda = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_agenda.html'), 'utf8');
const htmlCronicos = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_cronicos.html'), 'utf8');
const htmlOrdenes = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_ordenes.html'), 'utf8');
const fixMeds = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'everest_medicamentos.json'), 'utf8'));

// 1. Validar Selectores de Agenda
const agendaChecks = [
  { id: 'dom-agenda-hora', selector: '.labelHora', test: (s) => s.includes('class="labelHora') || /class=["'][^"']*\blabelHora\b/.test(s) },
  { id: 'dom-agenda-estado', selector: '.status-label', test: (s) => /class=["'][^"']*\bstatus-label\b/.test(s) },
  { id: 'dom-agenda-documento', selector: '.text-muted', test: (s) => /class=["'][^"']*\btext-muted\b/.test(s) },
  { id: 'dom-agenda-nombre', selector: '.text-uppercase', test: (s) => /class=["'][^"']*\btext-uppercase\b/.test(s) },
  { id: 'dom-agenda-modalidad', selector: '.fw-bold.mb-0', test: (s) => /class=["'][^"']*\bfw-bold\b[^"']*\bmb-0\b/.test(s) },
  { id: 'dom-agenda-contenedor', selector: '.card-body', test: (s) => /class=["'][^"']*\bcard-body\b/.test(s) }
];

console.log('▶ Evaluando frontera DOM de Agenda...');
for (const check of agendaChecks) {
  if (check.test(htmlAgenda)) {
    console.log(`  ✓ [VERDE] ${check.id} (${check.selector}) presente en fixture de agenda.`);
    aprobadas++;
  } else {
    console.error(`  ✗ [ROJO] ${check.id} (${check.selector}) NO ENCONTRADO en fixture.`);
    fallos++;
  }
}

// 2. Validar Historia Clínica y Formulario de Crónicos
console.log('\n▶ Evaluando frontera DOM de Historia Clínica y 13 Laboratorios...');
const cronicosChecks = [
  { id: 'dom-hc-anamesis', test: (s) => s.includes('id="anamesis"') },
  { id: 'dom-lab-res-col-total', test: (s) => s.includes('id="resultadoColesterolTotal"') },
  { id: 'dom-lab-res-col-hdl', test: (s) => s.includes('id="resultadoColesterolHDL"') },
  { id: 'dom-lab-res-col-ldl', test: (s) => s.includes('id="resultadoColesterolLDL"') },
  { id: 'dom-lab-res-trigliceridos', test: (s) => s.includes('id="resultadoTrigliceridos"') },
  { id: 'dom-lab-res-glicemia', test: (s) => s.includes('id="resultadoGlicemia"') },
  { id: 'dom-lab-res-rac', test: (s) => s.includes('id="resultadoRelacionAlbuminaCreatinina"') },
  { id: 'dom-lab-res-creatinina', test: (s) => s.includes('id="resultadoCreatinina"') },
  { id: 'dom-lab-res-hba1c-max30', test: (s) => /<input[^>]*max=["']30["'][^>]*resultadoHemoglobina[^>]*>/i.test(s) || /<input[^>]*resultadoHemoglobina[^>]*max=["']30["'][^>]*>/i.test(s) },
  { id: 'dom-lab-res-pth', test: (s) => s.includes('id="resultadoPTH"') },
  { id: 'dom-lab-res-fosforo', test: (s) => s.includes('id="resultadoFosforo"') },
  { id: 'dom-lab-res-albumina', test: (s) => s.includes('id="resultadoAlbumina"') },
  { id: 'dom-lab-res-hemoglobina', test: (s) => /<input[^>]*type=["']text["'][^>]*id=["']resultadoHemoglobina["']/i.test(s) || /<input[^>]*id=["']resultadoHemoglobina["'][^>]*type=["']text["']/i.test(s) },
  { id: 'dom-uro-radio-sw', test: (s) => s.includes('name="resultadoPrograma.swUroanalisis"') },
  { id: 'dom-uro-res-general', test: (s) => s.includes('id="resultadoUroanalisis"') }
];

for (const check of cronicosChecks) {
  if (check.test(htmlCronicos)) {
    console.log(`  ✓ [VERDE] ${check.id} presente en fixture de crónicos.`);
    aprobadas++;
  } else {
    console.error(`  ✗ [ROJO] ${check.id} NO ENCONTRADO en fixture de crónicos.`);
    fallos++;
  }
}

// 3. Validar Uroanálisis Componentes (Placeholders)
console.log('\n▶ Evaluando frontera DOM de Componentes de Uroanálisis...');
const uroPlaceholders = [
  'Resultado Nitritos',
  'Resultado Glucosa',
  'Resultado Sangre',
  'Resultado Leucocitos',
  'Resultado Hematies',
  'Resultado Cilindros'
];

for (const ph of uroPlaceholders) {
  if (htmlCronicos.includes(`placeholder="${ph}"`)) {
    console.log(`  ✓ [VERDE] Placeholder "${ph}" confirmado en fixture.`);
    aprobadas++;
  } else {
    console.error(`  ✗ [ROJO] Placeholder "${ph}" faltante en fixture.`);
    fallos++;
  }
}

// 4. Validar Conducta y Exámenes en Catálogo
console.log('\n▶ Evaluando frontera DOM de Catálogo de Conducta...');
const conductaItems = [
  'HORMONA PARATIROIDEA MOLECULA INTACTA',
  'ALBUMINA EN SUERO U OTROS FLUIDOS',
  'FOSFORO EN SUERO U OTROS FLUIDOS',
  'HEMOGLOBINA',
  'HEMOGLOBINA GLICOSILADA AUTOMATIZADA'
];

for (const item of conductaItems) {
  if (htmlOrdenes.includes(item)) {
    console.log(`  ✓ [VERDE] Catálogo Conducta: "${item}" presente en fixture.`);
    aprobadas++;
  } else {
    console.error(`  ✗ [ROJO] Catálogo Conducta: "${item}" faltante.`);
    fallos++;
  }
}

// 5. Validar Esquema de Medicamentos
console.log('\n▶ Evaluando Contrato de API de Medicamentos...');
if (Array.isArray(fixMeds.respuesta) && fixMeds.respuesta.length > 0) {
  console.log('  ✓ [VERDE] api-campo-meds-respuesta: Array de órdenes válido.');
  aprobadas++;
  const d = fixMeds.respuesta[0].detalles[0];
  if (d.codigo && d.descripcion && d.cantidadMedicamento && d.dosificacion && d.posfechadoInicial && d.posfechadoFinal) {
    console.log('  ✓ [VERDE] api-campo-meds-detalles: Campos farmacológicos clave confirmados.');
    aprobadas++;
  } else {
    console.error('  ✗ [ROJO] api-campo-meds-detalles: Faltan campos farmacológicos en el fixture.');
    fallos++;
  }
} else {
  console.error('  ✗ [ROJO] api-campo-meds-respuesta: Fixture de medicamentos inválido.');
  fallos++;
}

// Resumen final
console.log('\n=====================================================================');
console.log(`  RESULTADO DEL CANARIO SIMULADO:`);
console.log(`  🟢 Comprobaciones aprobadas: ${aprobadas}`);
console.log(`  🔴 Fallos de contrato:       ${fallos}`);
console.log(`  🟡 Advertencias / Supuestos:  ${advertencias}`);
console.log('=====================================================================');

if (fallos > 0) {
  console.error('\n🛑 EL CANARIO DETECTÓ ROTURAS DE CONTRATO EN EL SIMULADOR.');
  process.exit(1);
} else {
  console.log('\n✨ CONTRATO DE FRONTERA VÁLIDO Y RESISTENTE EN EL SIMULADOR.');
  process.exit(0);
}
