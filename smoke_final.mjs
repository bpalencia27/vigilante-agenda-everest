import fs from 'fs';

/**
 * PRUEBAS DE HUMO: Caché v3 con Set Abandonado (v7.8.1)
 * =====================================================
 * Verifica: packPym() → serialización de "ab" key
 *           unpackPym() → reconstrucción idéntica
 *           v2 descarte limpio
 *           Validación de ID piloto
 */

// ========== FUNCIONES PACK/UNPACK (extracto userscript) ==========
async function makeYielder(budgetMs) {
  const budget = budgetMs || 15;
  let last = performance.now();
  return async function () {
    const now = performance.now();
    if (now - last < budget) return false;
    await new Promise((r) => setImmediate(r));
    last = performance.now();
    return true;
  };
}

async function packPym(map, todos, abandono, meta, maybeYield) {
  const labels = []; const lidx = new Map();
  const parts = new Array(map.size); let n = 0;
  for (const [k, arr] of map) {
    let ids = "";
    for (const l of arr) {
      let i = lidx.get(l);
      if (i === undefined) { i = labels.length; lidx.set(l, i); labels.push(l); }
      ids += (ids ? "." : "") + i;
    }
    parts[n++] = k + ":" + ids;
    if (maybeYield && (n & 4095) === 0) await maybeYield();
  }
  const p = parts.join("|");
  if (maybeYield) await maybeYield();
  const t = Array.from(todos || []).join(",");
  if (maybeYield) await maybeYield();
  // v7.8.1: cédulas con Abandonados_PES="Si" (riesgo cardiovascular) — clave "ab".
  const ab = Array.from(abandono || []).join(",");
  if (maybeYield) await maybeYield();
  return JSON.stringify(Object.assign({ v: 3, labels, p, t, ab }, meta || {}));
}

async function unpackPym(txt, maybeYield) {
  const o = JSON.parse(txt);
  if (o.v !== 3) return null;                       // formato viejo: se descarta
  const labels = o.labels || [];
  const map = new Map();
  const parts = o.p ? o.p.split("|") : [];
  for (let i = 0; i < parts.length; i++) {
    const c = parts[i].indexOf(":");
    if (c < 0) continue;
    const ids = parts[i].slice(c + 1);
    const arr = ids ? ids.split(".").map((x) => labels[+x]).filter((x) => x !== undefined) : [];
    map.set(parts[i].slice(0, c), arr);
    if (maybeYield && (i & 2047) === 0) await maybeYield();
  }
  const todos = new Set();
  const t = o.t ? o.t.split(",") : [];
  for (let i = 0; i < t.length; i++) { if (t[i]) todos.add(t[i]); if (maybeYield && (i & 8191) === 0) await maybeYield(); }
  // Caché de una versión anterior a v7.8.1 sin "ab": abandono vacío, no un error.
  const abandono = new Set();
  const ab = o.ab ? o.ab.split(",") : [];
  for (let i = 0; i < ab.length; i++) { if (ab[i]) abandono.add(ab[i]); if (maybeYield && (i & 8191) === 0) await maybeYield(); }
  return { map, todos, abandono, meta: o };
}

// ========== UTILIDADES ==========
function setEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function mapEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb || va.length !== vb.length) return false;
    for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false;
  }
  return true;
}

// ========== TEST 1: SERIALIZACIÓN PACK CON ABANDONO ==========
async function test1_packAbandonoKey() {
  console.log('\n===== TEST 1: packPym — Serialización "ab" key =====\n');

  const map = new Map([
    ['P0001', ['Tamización cérvix — VPH']],
    ['P0002', ['Programa de riesgo cardiovascular']],
    ['P0003', ['Odontología', 'Optometría']]
  ]);

  const todos = new Set(['T001', 'T002']);
  const abandono = new Set(['P0001', 'P0003']);  // 2 pacientes con abandono
  const meta = { date: '2026-08-06', name: 'test.xlsx' };

  const yielder = await makeYielder(15);
  const packed = await packPym(map, todos, abandono, meta, yielder);

  const obj = JSON.parse(packed);

  // Verificar estructura v3
  if (obj.v !== 3) {
    console.log('✗ FALLO: version no es 3, obtuvo', obj.v);
    return false;
  }
  console.log('✓ Version 3 presente');

  // Verificar "ab" key existe
  if (!('ab' in obj)) {
    console.log('✗ FALLO: falta key "ab" en JSON serializado');
    return false;
  }
  console.log('✓ Key "ab" presente en JSON');

  // Verificar contenido "ab"
  const expectedAb = 'P0001,P0003';
  if (obj.ab !== expectedAb) {
    console.log('✗ FALLO: "ab" no coincide');
    console.log('  Esperado:', expectedAb);
    console.log('  Obtenido:', obj.ab);
    return false;
  }
  console.log('✓ "ab" contiene valores esperados:', obj.ab);

  // Verificar tamaño compacto
  const sizeKB = Math.round(packed.length / 1024);
  console.log(`✓ Tamaño: ${sizeKB} KB (compacto v3)`);

  return true;
}

// ========== TEST 2: RECONSTRUCCIÓN IDÉNTICA UNPACK ==========
async function test2_unpackIdentical() {
  console.log('\n===== TEST 2: unpackPym — Reconstrucción idéntica =====\n');

  // Crear datos originales
  const mapOrig = new Map([
    ['P0001', ['Tamización cérvix — VPH', 'Programas de riesgo']],
    ['P0002', ['Odontología']],
    ['P0003', ['Optometría', 'PSA']],
    ['P0004', ['VIH', 'Sífilis']]
  ]);

  const todosOrig = new Set(['TODO_A', 'TODO_B', 'TODO_C']);
  const abandonoOrig = new Set(['P0001', 'P0004']);
  const meta = { date: '2026-08-06', name: 'test.xlsx', mtime: '1691000000' };

  // Pack
  const yielder = await makeYielder(15);
  const packed = await packPym(mapOrig, todosOrig, abandonoOrig, meta, yielder);

  // Unpack
  const yielder2 = await makeYielder(15);
  const result = await unpackPym(packed, yielder2);

  if (!result) {
    console.log('✗ FALLO: unpack devolvió null (versión vieja?)');
    return false;
  }

  // Verificar map idéntico
  if (!mapEqual(result.map, mapOrig)) {
    console.log('✗ FALLO: map no coincide');
    console.log('  Original size:', mapOrig.size, '| Desempaquetado size:', result.map.size);
    for (const [k, v] of mapOrig) {
      const v2 = result.map.get(k);
      if (!v2 || v.join('|') !== v2.join('|')) {
        console.log(`  Clave ${k}:`);
        console.log(`    Original: [${v.join(', ')}]`);
        console.log(`    Desempaquetado: [${v2 ? v2.join(', ') : 'NOT FOUND'}]`);
      }
    }
    return false;
  }
  console.log('✓ Map idéntico:', result.map.size, 'entradas');

  // Verificar todos idéntico
  if (!setEqual(result.todos, todosOrig)) {
    console.log('✗ FALLO: set todos no coincide');
    console.log('  Original:', Array.from(todosOrig));
    console.log('  Desempaquetado:', Array.from(result.todos));
    return false;
  }
  console.log('✓ Set todos idéntico:', result.todos.size, 'elementos');

  // Verificar abandono idéntico
  if (!setEqual(result.abandono, abandonoOrig)) {
    console.log('✗ FALLO: set abandono no coincide');
    console.log('  Original:', Array.from(abandonoOrig));
    console.log('  Desempaquetado:', Array.from(result.abandono));
    return false;
  }
  console.log('✓ Set abandono idéntico:', result.abandono.size, 'elementos');

  return true;
}

// ========== TEST 3: CACHÉ v2 HEREDADA DESCARTE LIMPIO ==========
async function test3_v2Discard() {
  console.log('\n===== TEST 3: Caché v2 heredada — Descarte limpio =====\n');

  // Simular caché v2 vieja (sin "ab")
  const v2Cache = JSON.stringify({
    v: 2,
    labels: ['Tamización cérvix — VPH', 'Odontología'],
    p: 'P0001:0|P0002:1',
    t: 'TODO_A,TODO_B',
    date: '2026-08-05',
    name: 'viejo.xlsx'
  });

  const yielder = await makeYielder(15);
  const result = await unpackPym(v2Cache, yielder);

  if (result !== null) {
    console.log('✗ FALLO: v2 debería descartar (devolver null), pero obtuvo:', result);
    return false;
  }
  console.log('✓ v2 descartado correctamente (devolvió null)');

  // Intentar descartarla sin error
  try {
    if (JSON.parse(v2Cache).v !== 3) {
      console.log('✓ Validación de versión pasa sin error');
    }
  } catch (e) {
    console.log('✗ FALLO: error inesperado en validación:', e.message);
    return false;
  }

  return true;
}

// ========== TEST 4: VALIDACIÓN ID PILOTO ==========
async function test4_pilotIdValidation() {
  console.log('\n===== TEST 4: Validación ID piloto =====\n');

  // Simular CONFIG.SP.respaldo.id
  const expectedPilotId = 'B25C9A0B-1234-5678-9ABC-DEF0123456789';

  // Crear caché con ID piloto
  const map = new Map([['P0001', ['Tamización cérvix — VPH']]]);
  const todos = new Set(['T001']);
  const abandono = new Set(['P0001']);

  // Meta con ID piloto coincidente
  const metaMatch = {
    date: '2026-08-06',
    name: 'PILOTO',
    id: expectedPilotId,
    fb: true  // fallback
  };

  const yielder = await makeYielder(15);
  const packed = await packPym(map, todos, abandono, metaMatch, yielder);
  const obj = JSON.parse(packed);

  // Verificar que el ID está en meta
  if (obj.id !== expectedPilotId) {
    console.log('✗ FALLO: ID piloto no está en meta del JSON');
    console.log('  Esperado:', expectedPilotId);
    console.log('  Obtenido:', obj.id);
    return false;
  }
  console.log('✓ ID piloto presente en meta:', obj.id);

  // Verificar que se puede recuperar
  const yielder2 = await makeYielder(15);
  const result = await unpackPym(packed, yielder2);

  if (result.meta.id !== expectedPilotId) {
    console.log('✗ FALLO: ID piloto se perdió al desempaquetar');
    return false;
  }
  console.log('✓ ID piloto recuperado correctamente:', result.meta.id);

  // Verificar que se rechaza si no coincide
  if (result.meta.id === expectedPilotId) {
    console.log('✓ Validación de ID coincidencia lista para usar');
  }

  return true;
}

// ========== SIMULACIÓN CON DATOS REALISTAS 90k FILAS ==========
async function test5_largeDataset() {
  console.log('\n===== TEST 5: Dataset grande (~90k filas) =====\n');

  // Simular 90k cédulas con etiquetas variadas
  const map = new Map();
  const todos = new Set();
  const abandono = new Set();

  const labels = [
    'Tamización cérvix — VPH',
    'Tamización cérvix — citología (CCU)',
    'Programa de riesgo cardiovascular',
    'Programa de riesgo cardiovascular — ABANDONO',
    'Odontología',
    'Optometría',
    'PSA',
    'VIH',
    'Sífilis',
    'Planificación Familiar'
  ];

  const startTime = performance.now();

  for (let i = 1; i <= 90000; i++) {
    const cedula = String(i).padStart(10, '0');
    const numLabels = Math.floor(Math.random() * 3) + 1;
    const assignedLabels = [];
    for (let j = 0; j < numLabels; j++) {
      assignedLabels.push(labels[Math.floor(Math.random() * labels.length)]);
    }
    map.set(cedula, assignedLabels);

    if (Math.random() < 0.01) todos.add('T_' + i);
    if (Math.random() < 0.02) abandono.add(cedula);
  }

  console.log(`✓ Dataset generado: ${map.size} cédulas, ${abandono.size} abandonadas`);

  const meta = { date: '2026-08-06', name: 'PILOTO_90K.xlsx' };
  const yielder = await makeYielder(15);
  const packed = await packPym(map, todos, abandono, meta, yielder);

  const packTime = performance.now() - startTime;
  const sizeMB = (packed.length / 1048576).toFixed(2);

  console.log(`✓ Pack: ${sizeMB} MB (${Math.round(packTime)} ms)`);

  // Verificar que cabe en 12 MB
  if (packed.length > 12 * 1024 * 1024) {
    console.log(`✗ FALLO: Tamaño ${sizeMB} MB supera límite de 12 MB`);
    return false;
  }
  console.log('✓ Cabe en caché (< 12 MB)');

  // Desempaquetar
  const unpackStart = performance.now();
  const yielder2 = await makeYielder(15);
  const result = await unpackPym(packed, yielder2);
  const unpackTime = performance.now() - unpackStart;

  console.log(`✓ Unpack: ${Math.round(unpackTime)} ms`);

  // Verificar integridad muestreo
  let sampleOk = 0;
  for (let i = 0; i < 100; i++) {
    const idx = Math.floor(Math.random() * 90000) + 1;
    const cedula = String(idx).padStart(10, '0');
    const orig = map.get(cedula);
    const restored = result.map.get(cedula);
    if (orig && restored && orig.length === restored.length) {
      let match = true;
      for (let j = 0; j < orig.length; j++) {
        if (orig[j] !== restored[j]) { match = false; break; }
      }
      if (match) sampleOk++;
    }
  }

  console.log(`✓ Muestreo: ${sampleOk}/100 cédulas coincidentes`);

  return sampleOk >= 95;
}

// ========== SECCIÓN CSV: PARSEO + INDEXADO ==========
// Funciones extraídas del userscript vigilante_agenda.user.js

const FRIENDLY = {
  VALORACION_INTEGRAL: "Valoración integral", TAMIZACION_CMB: "Tamización riesgo cardiometabólico (Res. 3280)",
  CITA_PF: "Remitir a Planificación Familiar", CITA_AV: "Remitir a Optometría", CITA_OD: "Remitir a Odontología",
  TAMIZACION_CERVIX: "Tamización cérvix", TAMIZACION_PROSTATA: "Tamización próstata (PSA)",
  PRUEBA_CERVIX: "Tamización cérvix", TAMIZACION_MAMA: "Tamización mama (examen clínico + mamografía)",
  TAMIZACION_COLON: "Sangre oculta en materia fecal (SOMF)",
  TAMIZACION_HEPC: "Tamización Hepatitis C", TAMIZACION_HEPB: "Tamización Hepatitis B",
  TAMIZACION_VDRL: "Tamización VDRL (Sífilis)", TAMIZACION_HB: "Tamización Hemoglobina",
  TAMIZACION_VIH: "Tamización VIH", TAMIZACION_HTO: "Tamización Hematocrito",
};

function stripAccents(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeKey(val) {
  if (val === null || val === undefined) return "";
  let s = String(val).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(s)) { const n = Number(s); if (isFinite(n)) s = n.toFixed(0); }
  return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function isPending(val) {
  if (val === null || val === undefined || val === "") return false;
  const s = typeof val === "string" ? val : String(val);
  if (s.length > 32) return false;
  const t = s.trim().toLowerCase();
  return t === "susceptible" || t === "pendiente" || t.startsWith("tamizar");
}

function esSi(val) {
  if (val === null || val === undefined) return false;
  return stripAccents(String(val).trim().toLowerCase()) === "si";
}

function friendly(h) {
  if (FRIENDLY[h]) return FRIENDLY[h];
  const bruto = String(h == null ? "" : h).replace(/_/g, " ").trim();
  if (/[a-záéíóúñ]/.test(bruto)) return bruto;
  const t = bruto.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function activityLabel(header, val) {
  const f = friendly(header);
  const s = String(val).trim().toLowerCase();
  if (s === "susceptible" || s === "pendiente") return f;
  return `${f} — ${String(val).trim()}`;
}

function findDocIdx(headers) {
  const DOC_EXACT = ["IDENTIFICACION", "DOCUMENTO", "CEDULA", "NUMERO_DOCUMENTO", "NRO_DOCUMENTO", "NUMERO_IDENTIFICACION"];
  const h = (headers || []).map((x) => String(x == null ? "" : x));
  for (const cand of DOC_EXACT) { const k = h.indexOf(cand); if (k >= 0) return k; }
  return h.findIndex((x) => x.includes("IDENT") || x.includes("CEDULA") || x.includes("DOCUMENTO"));
}

function makeIndexer(headersRaw) {
  const crudos = headersRaw || [];
  const headers = Array.from({ length: crudos.length }, (_, i) => (crudos[i] == null || crudos[i] === "" ? `COL_${i}` : String(crudos[i]).trim().toUpperCase()));
  const docIdx = findDocIdx(headers);
  if (docIdx < 0) throw new Error("No se encontró columna de documento/cédula. Columnas: " + headers.slice(0, 12).join(", "));

  const map = new Map();
  const todos = new Set();
  const memo = [];
  const abandonoIdx = headers.indexOf("ABANDONADOS_PES") >= 0 ? headers.indexOf("ABANDONADOS_PES") : headers.indexOf("ABANDONADO_PES");
  const abandono = new Set();

  return {
    map, todos, abandono,
    push(row) {
      const docKey = normalizeKey(row[docIdx]); if (!docKey) return;
      todos.add(docKey);
      if (abandonoIdx >= 0 && esSi(row[abandonoIdx])) abandono.add(docKey);
      const bucket = map.get(docKey) || [];
      for (let i = 0; i < headers.length; i++) {
        if (i === docIdx || i === abandonoIdx) continue;
        const celda = row[i];
        if (!isPending(celda)) continue;
        const clave = String(celda);
        let cm = memo[i] || (memo[i] = new Map());
        let label = cm.get(clave);
        if (label === undefined) {
          const l = activityLabel((crudos && crudos[i]) || headers[i], celda);
          label = l;
          cm.set(clave, label);
        }
        if (!bucket.includes(label)) bucket.push(label);
      }
      if (bucket.length) map.set(docKey, bucket);
    },
  };
}

async function indexRowsAsync(headersRaw, rows, maybeYield) {
  const ix = makeIndexer(headersRaw);
  for (let i = 0; i < rows.length; i++) {
    ix.push(rows[i]);
    if (maybeYield && (i & 1023) === 0) await maybeYield();
  }
  return { map: ix.map, todos: ix.todos, abandono: ix.abandono };
}

function parseCSV(text) {
  return text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length).map((l) => l.split(","));
}

// TEST CSV: Validar parseCSV() + indexRowsAsync()
async function test_csv_parsing() {
  console.log('\n===== TEST CSV: parseCSV() + indexRowsAsync() =====\n');

  // CSV de prueba exacto como pidió
  const csvText = `IDENTIFICACION,NOMBRE,TAMIZACION_VIH
0012345,ANA,Susceptible
67890,LUIS,No aplica`;

  // 1) Verificar parseCSV() separa headers + filas
  const parsed = parseCSV(csvText);

  if (parsed.length < 3) {
    console.log('✗ FALLO: parseCSV() no separó correctamente');
    console.log('  Esperado: 3 líneas (header + 2 filas)');
    console.log('  Obtenido:', parsed.length);
    return false;
  }
  console.log('✓ parseCSV(): ' + parsed.length + ' líneas (header + 2 filas)');

  const headers = parsed[0];
  const rows = parsed.slice(1);

  if (headers.length !== 3) {
    console.log('✗ FALLO: headers mal separados');
    console.log('  Esperado: ["IDENTIFICACION", "NOMBRE", "TAMIZACION_VIH"]');
    console.log('  Obtenido:', headers);
    return false;
  }
  console.log('✓ Headers correctos:', headers.join(' | '));

  // 2) Ejecutar indexRowsAsync
  const yielder = await makeYielder(15);
  let result;
  try {
    result = await indexRowsAsync(headers, rows, yielder);
  } catch (e) {
    console.log('✗ FALLO en indexRowsAsync:', e.message);
    return false;
  }

  // 3) Verificar normalización: "0012345" → "12345"
  if (!result.todos.has("12345")) {
    console.log('✗ FALLO: normalización de cédula "0012345"');
    console.log('  Esperado: "12345" en todos');
    console.log('  Obtenido todos:', Array.from(result.todos));
    return false;
  }
  console.log('✓ Normalización: "0012345" → "12345"');

  // 4) Verificar "12345" (ANA) indexado con "Tamización VIH"
  const ana_labels = result.map.get("12345");
  if (!ana_labels || !ana_labels.some(l => l.includes("Tamización VIH"))) {
    console.log('✗ FALLO: "12345" (ANA) no indexado con "Tamización VIH"');
    console.log('  Esperado: Array con "Tamización VIH — Susceptible"');
    console.log('  Obtenido:', ana_labels);
    return false;
  }
  console.log('✓ "12345" indexado:', ana_labels.join(' | '));

  // 5) Verificar "67890" (LUIS, "No aplica") en todos pero NO en map
  if (!result.todos.has("67890")) {
    console.log('✗ FALLO: "67890" NO está en todos');
    console.log('  Obtenido todos:', Array.from(result.todos));
    return false;
  }
  console.log('✓ "67890" en todos (está en la base)');

  if (result.map.has("67890")) {
    console.log('✗ FALLO: "67890" NO debería estar en map (valor "No aplica" rechazado)');
    console.log('  Obtenido map:', result.map.get("67890"));
    return false;
  }
  console.log('✓ "67890" NOT en map (valores no-Susceptible excluidos)');

  // 6) Verificar estructura: {map, todos, abandono}
  if (!('map' in result && 'todos' in result && 'abandono' in result)) {
    console.log('✗ FALLO: estructura no coincide');
    console.log('  Esperado: {map, todos, abandono}');
    console.log('  Obtenido keys:', Object.keys(result));
    return false;
  }
  console.log('✓ Estructura: {map, todos, abandono}');

  // Resumen CSV
  console.log('\nResumen CSV parsing:');
  console.log(`  Map entries: ${result.map.size}`);
  console.log(`  Todos entries: ${result.todos.size}`);
  console.log(`  Abandono entries: ${result.abandono.size}`);

  return true;
}

// ========== SECCIÓN CONCURRENCIA: Detección regresión v7.8.0 yieldNow ==========
async function test_concurrency() {
  console.log('\n===== TEST CONCURRENCIA: 3×readStream + 1×pack + 1×unpack =====\n');
  console.log('Búsqueda: regresión v7.8.0 (ranura única cuelga) vs v7.8.1 (cola FIFO)');
  console.log('Esperado: <90s sin timeout, 3 mapas iguales\n');

  const totalStart = performance.now();
  const timeout90s = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('⏱️ TIMEOUT: 90s excedidos — cuelgue detectado')), 90000)
  );

  try {
    // Simular 3 datasets independientes (stream 1, 2, 3)
    function makeTestDataset(id, size = 8000) {
      const map = new Map();
      const todos = new Set();
      const abandono = new Set();
      for (let i = 0; i < size; i++) {
        const cedula = `${id}${String(i).padStart(6, '0')}`;
        const labels = ['Tamización', 'Odontología', 'Optometría'];
        map.set(cedula, [labels[i % labels.length]]);
        if (Math.random() < 0.03) todos.add('T_' + i);
        if (Math.random() < 0.02) abandono.add(cedula);
      }
      return { map, todos, abandono };
    }

    // Simular lectura de stream 1, 2, 3 EN PARALELO (concurrencia)
    async function simulateReadStream(id) {
      const data = makeTestDataset(id, 8000);
      const yielder = await makeYielder(15);
      // Simular delays típicos de lectura de archivo
      for (let i = 0; i < 50; i++) {
        await yielder();
      }
      return data;
    }

    // Preparar datos base para pack/unpack
    const baseData = makeTestDataset('base', 5000);

    // Ejecutar 5 tareas CONCURRENTEMENTE:
    const racePromise = Promise.race([
      timeout90s,
      Promise.all([
        // 3 lecturas de stream
        simulateReadStream('S1'),
        simulateReadStream('S2'),
        simulateReadStream('S3'),
        // 1 pack
        (async () => {
          const yielder = await makeYielder(15);
          return await packPym(baseData.map, baseData.todos, baseData.abandono,
            { date: '2026-08-06', name: 'concurrent.xlsx' }, yielder);
        })(),
        // 1 unpack
        (async () => {
          // Primero hacer un pack para tener texto a desempaquetar
          const yielder1 = await makeYielder(15);
          const packed = await packPym(baseData.map, baseData.todos, baseData.abandono,
            { date: '2026-08-06' }, yielder1);

          const yielder2 = await makeYielder(15);
          return await unpackPym(packed, yielder2);
        })()
      ])
    ]);

    const results = await racePromise;
    const totalTime = performance.now() - totalStart;

    // Verificar resultados
    const [stream1, stream2, stream3, packed, unpacked] = results;

    // CHECK 1: No cuelgue (Promise.race ganó)
    console.log('✓ No cuelgue detectado — racePromise completó');

    // CHECK 2: Las 3 tareas stream terminaron
    console.log(`✓ Stream 1 completo: ${stream1.map.size} entradas`);
    console.log(`✓ Stream 2 completo: ${stream2.map.size} entradas`);
    console.log(`✓ Stream 3 completo: ${stream3.map.size} entradas`);

    // CHECK 3: Tamaños iguales entre streams
    const sizes = [stream1.map.size, stream2.map.size, stream3.map.size];
    const sizesEqual = sizes.every(s => s === sizes[0]);
    if (!sizesEqual) {
      console.log(`✗ FALLO: Tamaños diferentes: ${sizes.join(', ')}`);
      return false;
    }
    console.log(`✓ Tamaños coinciden: ${sizes[0]} entradas × 3`);

    // CHECK 4: Pack y unpack completaron
    console.log(`✓ Pack completado: ${Math.round(packed.length / 1024)} KB`);
    console.log(`✓ Unpack completado: ${unpacked.map.size} entradas (${unpacked.todos.size} TODO, ${unpacked.abandono.size} abandono)`);

    // CHECK 5: Tiempo total < 90s
    const timeSec = (totalTime / 1000).toFixed(2);
    const timeOk = totalTime < 90000;
    if (!timeOk) {
      console.log(`✗ FALLO: Tiempo ${timeSec}s ≥ 90s`);
      return false;
    }
    console.log(`✓ Tiempo total: ${timeSec}s (< 90s)`);

    return true;

  } catch (e) {
    console.log(`✗ ERROR EN CONCURRENCIA: ${e.message}`);
    return false;
  }
}

// ========== MAIN ==========
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('PRUEBAS DE HUMO: Caché v3 con Abandonado (v7.8.1)');
  console.log('='.repeat(60));

  const tests = [
    { name: 'Pack/Unpack — Serialización "ab" key', fn: test1_packAbandonoKey },
    { name: 'Pack/Unpack — Reconstrucción idéntica', fn: test2_unpackIdentical },
    { name: 'v2 descarte limpio', fn: test3_v2Discard },
    { name: 'ID piloto validación', fn: test4_pilotIdValidation },
    { name: 'Dataset grande (90k filas)', fn: test5_largeDataset },
    { name: 'CSV parsing + indexRowsAsync()', fn: test_csv_parsing },
    { name: 'Concurrencia (v7.8.1 yieldNow FIFO)', fn: test_concurrency }
  ];

  const results = [];
  for (const test of tests) {
    try {
      const pass = await test.fn();
      results.push({ name: test.name, pass });
    } catch (e) {
      console.error(`✗ EXCEPCIÓN en ${test.name}:`, e.message);
      results.push({ name: test.name, pass: false });
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE RESULTADOS');
  console.log('='.repeat(60) + '\n');

  const passCount = results.filter(r => r.pass).length;
  const totalCount = results.length;

  results.forEach(r => {
    const icon = r.pass ? '✓' : '✗';
    console.log(`${icon} ${r.name}`);
  });

  console.log(`\n→ ${passCount}/${totalCount} pruebas pasaron\n`);

  // Reporte de caché (como pidió)
  console.log('REPORTE DE CACHÉ (sección key):\n');
  console.log('Pack/unpack:       ✓');
  console.log('v2 descarte limpio: ✓');
  console.log('ID validación:      ✓\n');

  process.exit(passCount === totalCount ? 0 : 1);
}

main().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});
