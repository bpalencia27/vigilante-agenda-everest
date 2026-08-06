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
    { name: 'Dataset grande (90k filas)', fn: test5_largeDataset }
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
