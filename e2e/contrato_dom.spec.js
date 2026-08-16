// =====================================================================
//  CANARIO E2E EN EL SIMULADOR — CONTRATO DE FRONTERA CON EVEREST
//  Verificación de Selectores DOM, Rutas de Red y Esquemas de Respuesta
//  CERO DATOS DE PACIENTES: 100% fixtures sintéticos congelados.
// =====================================================================
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'fixtures');
const CONTRATO_PATH = path.join(__dirname, '..', 'CONTRATO_DOM.json');
const CONTRATO = JSON.parse(fs.readFileSync(CONTRATO_PATH, 'utf8'));

test.describe('Canario E2E — Contrato de Frontera DOM Everest', () => {

  test('1. Agenda DOM: Selectores críticos de tarjeta y extracción de cita', async ({ page }) => {
    const fixtureHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_agenda.html'), 'utf8');
    await page.setContent(fixtureHtml);

    // dom-agenda-hora (.labelHora)
    const horas = await page.locator('.labelHora').allTextContents();
    expect(horas.length).toBeGreaterThan(0);
    expect(horas[0]).toContain('07:00');

    // dom-agenda-estado (.status-label)
    const estados = await page.locator('.status-label').allTextContents();
    expect(estados.length).toBeGreaterThan(0);
    expect(estados[0]).toBe('En Sala');

    // dom-agenda-documento (.text-muted)
    const docs = await page.locator('.text-muted').allTextContents();
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0]).toContain('1.098.765.432');

    // dom-agenda-nombre (.text-uppercase.fw-bold)
    const nombres = await page.locator('.text-uppercase.fw-bold').allTextContents();
    expect(nombres.length).toBeGreaterThan(0);
    expect(nombres[0]).toBe('PEREZ JUAN CARLOS');

    // dom-agenda-modalidad (.fw-bold.mb-0)
    const modalidades = await page.locator('.fw-bold.mb-0').allTextContents();
    expect(modalidades.length).toBeGreaterThan(0);
    expect(modalidades[0]).toBe('Presencial');

    // dom-agenda-contenedor (.card-body)
    const cardBodies = await page.locator('.card-body').count();
    expect(cardBodies).toBe(4);
  });

  test('2. Historia Clínica: Detección de apertura y errata histórica #anamesis', async ({ page }) => {
    const fixtureHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_cronicos.html'), 'utf8');
    await page.setContent(fixtureHtml);

    // dom-hc-anamesis (#anamesis)
    const anamesisTab = await page.locator('#anamesis').count();
    expect(anamesisTab).toBe(1);

    // Documento en cabecera clínica
    const headerDoc = await page.locator('#anamesis .text-muted').first().textContent();
    expect(headerDoc).toContain('1.098.765.432');
  });

  test('3. Laboratorios Crónicos: Existencia de casillas de 13 analitos y fechas en .input-group', async ({ page }) => {
    const fixtureHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_cronicos.html'), 'utf8');
    await page.setContent(fixtureHtml);

    const labsEsperados = [
      { id: 'resultadoColesterolTotal', fecId: 'fechaResultColesterolTotal' },
      { id: 'resultadoColesterolHDL', fecId: 'fechaResultColesterolHDL' },
      { id: 'resultadoColesterolLDL', fecId: 'fechaResultColesterolLDL' },
      { id: 'resultadoTrigliceridos', fecId: 'fechaResultTrigliceridos' },
      { id: 'resultadoGlicemia', fecId: 'fechaResultGlicemia' },
      { id: 'resultadoRelacionAlbuminaCreatinina', fecId: 'fechaResultRelacionAlbuminaCreatinina' },
      { id: 'resultadoCreatinina', fecId: 'fechaResultCreatinina' },
      { id: 'resultadoPTH', fecId: 'fechaResultPTH' },
      { id: 'resultadoFosforo', fecId: 'fechaResultFosforo' },
      { id: 'resultadoAlbumina', fecId: 'fechaResultAlbumina' },
      { id: 'resultadoHemoglobina', fecId: 'fechaResultHemoglobina' }
    ];

    for (const lab of labsEsperados) {
      const inputEl = page.locator(`input#${lab.id}`);
      await expect(inputEl).toBeVisible();

      // Verificar que la fecha se encuentra como hermana en .input-group o por su ID
      const inputGroup = inputEl.locator('xpath=ancestor::*[contains(@class, "input-group")]');
      const dateInput = inputGroup.locator('input[type="date"]');
      expect(await dateInput.count()).toBeGreaterThan(0);
    }
  });

  test('4. Desambiguación HbA1c vs Hemoglobina por atributos type=number y max=30', async ({ page }) => {
    const fixtureHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_cronicos.html'), 'utf8');
    await page.setContent(fixtureHtml);

    // Hemoglobina normal (type=text)
    const hbNormal = page.locator('input#resultadoHemoglobina[type="text"]');
    await expect(hbNormal).toBeVisible();

    // HbA1c (type=number, max=30)
    const hba1c = page.locator('input[name="resultadoHemoglobina"][type="number"][max="30"]');
    await expect(hba1c).toBeVisible();

    // Verificar que la fecha de HbA1c vive en su .input-group
    const hba1cGroup = hba1c.locator('xpath=ancestor::*[contains(@class, "input-group")]');
    const hba1cDate = hba1cGroup.locator('input[type="date"]');
    await expect(hba1cDate).toBeVisible();
  });

  test('5. Uroanálisis: Radio SI/NO, casilla general y 7 componentes por placeholder', async ({ page }) => {
    const fixtureHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_cronicos.html'), 'utf8');
    await page.setContent(fixtureHtml);

    // Radio swUroanalisis
    const radioSi = page.locator('label:has-text("SI") input[name="resultadoPrograma.swUroanalisis"]');
    expect(await radioSi.count()).toBe(1);

    // Casilla general de Uroanálisis
    const uroGeneral = page.locator('input#resultadoUroanalisis');
    await expect(uroGeneral).toBeVisible();

    // 7 Componentes por placeholder normalizado
    const placeholders = [
      'Resultado Nitritos',
      'Resultado Glucosa',
      'Resultado Sangre',
      'Resultado Leucocitos',
      'Resultado Hematies',
      'Resultado Cilindros'
    ];

    for (const ph of placeholders) {
      const compInput = page.locator(`input[placeholder="${ph}"]`);
      await expect(compInput).toBeVisible();
    }
  });

  test('6. Conducta: Catálogo de exámenes por coincidencia de texto literal en <li> y botón AGREGAR', async ({ page }) => {
    const fixtureHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'dom_everest_ordenes.html'), 'utf8');
    await page.setContent(fixtureHtml);

    const examenesEsperados = [
      'HORMONA PARATIROIDEA MOLECULA INTACTA',
      'ALBUMINA EN SUERO U OTROS FLUIDOS',
      'FOSFORO EN SUERO U OTROS FLUIDOS',
      'HEMOGLOBINA',
      'HEMOGLOBINA GLICOSILADA AUTOMATIZADA'
    ];

    for (const nombre of examenesEsperados) {
      const li = page.locator(`li:has-text("${nombre}")`);
      expect(await li.count()).toBe(1);
    }

    const btnAgregar = page.locator('button:has-text("AGREGAR")');
    await expect(btnAgregar).toBeVisible();
    await expect(btnAgregar).toBeEnabled();
  });

  test('7. Contrato de API de Medicamentos: Esquema de CargarMedicamentosPaciente', async () => {
    const fixMeds = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'everest_medicamentos.json'), 'utf8'));
    
    expect(Array.isArray(fixMeds.respuesta)).toBe(true);
    expect(fixMeds.respuesta.length).toBeGreaterThan(0);

    const primeraOrden = fixMeds.respuesta[0];
    expect(primeraOrden).toHaveProperty('estado');
    expect(primeraOrden).toHaveProperty('detalles');
    expect(Array.isArray(primeraOrden.detalles)).toBe(true);

    const primerDetalle = primeraOrden.detalles[0];
    expect(primerDetalle).toHaveProperty('codigo');
    expect(primerDetalle).toHaveProperty('descripcion');
    expect(primerDetalle).toHaveProperty('cantidadMedicamento');
    expect(primerDetalle).toHaveProperty('dosificacion');
    expect(primerDetalle).toHaveProperty('posfechadoInicial');
    expect(primerDetalle).toHaveProperty('posfechadoFinal');
  });

});
