// =====================================================================
//  MEDICIÓN DE CERCANÍA ENTRE EXÁMENES DIFERIDOS — v17.29.0 (en curso)
//
//  Origen: reporte en vivo del médico (28-ago) — un paciente con la glicemia
//  venciendo a 68 días y la creatinina a 83 (15 días de diferencia) hizo que el
//  plan agrupara la primera en esta toma y dejara la segunda para un viaje
//  aparte. Investigado: NO es un bug del ANR ni de una "ventana de agrupación"
//  — cada examen vigente se evalúa SOLO contra el 33% de SU PROPIA vigencia
//  (`MTR_COSECHA_MARGEN_PROP`, mtrPlanParaclinicos), nunca contra la fecha de
//  otro examen. El médico pidió una propuesta para reducir viajes "en los
//  pacientes adecuados" y aprobó medir antes de tocar código — mismo criterio
//  que ya usó `medir_sabados.js` (27-ago): con datos, no a ojo.
//
//  QUÉ MIDE ESTE PROGRAMA (y por qué Monte Carlo, no barrido exhaustivo como
//  medir_sabados.js): el sábado tiene un solo eje (365 días del año). Aquí el
//  espacio son 9 exámenes × su propia fecha de último resultado (0-250 días) ×
//  programa/estadio/riesgo — un barrido exhaustivo sería 10^9+ combinaciones.
//  Se generan pacientes sintéticos ALEATORIOS (10.000 por corrida) y se mide la
//  distribución real de "cuántos días más allá de la toma cae un examen que
//  quedó diferido" (`plan.diferidos[].margenDias`, ya calculado por el motor —
//  este programa NO reimplementa esa cuenta, solo la observa). Cero valores de
//  paciente real: todo son fechas y programas sintéticos.
//
//  NO CAMBIA NADA: vive en tools/ como medir_sabados.js y
//  verificar_color_chromium.js, no en tests/. Su salida es un informe para que
//  el médico elija la ventana de días con un número real delante, no una
//  compuerta del banco.
// =====================================================================
const { cargar } = require("/home/user/vigilante-agenda-everest/tests/harness.js");
const c = cargar({ silencioso: true });
const api = c.api;

const DRIVERS = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS",
  "GLUCOSA", "UROANALISIS", "CREATININA", "RAC", "HBA1C"];
const PROGRAMAS = ["HTA", "DM2", "ERC"];
const ESTADIOS_ERC = ["G1", "G2", "G3a", "G3b", "G4"];
const RIESGOS = ["bajo", "moderado", "alto", "muy alto"];
const HOY = "2026-06-15";

// PRNG determinista (mismo resultado en cada corrida — reproducible, no depende
// de Math.random real). Mulberry32.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260828);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const sumarDiasIso = (iso, dias) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - dias);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

// Valores plausibles "en meta" para no confundir esta medición (cercanía por
// vigencia) con la regla del 50% (cercanía por fuera de meta) — se activa
// fuera de meta solo en una fracción minoritaria de los pacientes, a propósito.
function valorPlausible(driver, fueraDeMeta) {
  switch (driver) {
    case "COLESTEROL_LDL": return fueraDeMeta ? 160 : 90;
    case "GLUCOSA": return fueraDeMeta ? 180 : 95;
    case "HBA1C": return fueraDeMeta ? 9.5 : 6.5;
    case "TRIGLICERIDOS": return fueraDeMeta ? 220 : 120;
    case "COLESTEROL_TOTAL": return 180;
    case "COLESTEROL_HDL": return 50;
    case "UROANALISIS": return 1;
    case "CREATININA": return 1.0;
    case "RAC": return fueraDeMeta ? 45 : 12;
    default: return 100;
  }
}

function pacienteSintetico() {
  const programa = pick(PROGRAMAS);
  const esDm2 = programa === "DM2";
  const estadioAdministrativo = programa === "ERC" ? pick(ESTADIOS_ERC) : null;
  const categoriaRiesgo = pick(RIESGOS);
  const fueraDeMetaGlobal = rnd() < 0.25; // 25% de los pacientes, mal controlados
  const ultimos = {};
  for (const driver of DRIVERS) {
    if (rnd() < 0.12) continue; // ~12%: nunca se le ha tomado ese examen — no compite aquí
    const diasDesde = Math.floor(rnd() * 250);
    ultimos[driver] = { fecha: sumarDiasIso(HOY, diasDesde), valor: valorPlausible(driver, fueraDeMetaGlobal) };
  }
  return {
    hoyIso: HOY, programa: programa, estadioAdministrativo: estadioAdministrativo,
    esDm2: esDm2, edad: 40 + Math.floor(rnd() * 45), rac: ultimos.RAC ? ultimos.RAC.valor : 12,
    categoriaRiesgo: categoriaRiesgo, ultimos: ultimos,
  };
}

// v17.29.0 (medición, primera vuelta) — el primer diseño de este programa medía
// `margenDias` crudo (distancia entre la toma y el vencimiento del diferido) y daba
// números casi en cero para 14-21 días: NO es la métrica correcta. El caso real que
// disparó esta medición (creatinina a 69 días de margen, glicemia a 54) NO tiene los dos
// márgenes "cerca" en términos absolutos — tiene la creatinina cayendo apenas 9,6 días
// MÁS ALLÁ de SU PROPIO corte del 33 % (69 vs. 59,4 = 33 % de 180 d). Medir margenDias
// crudo mezcla exámenes de vigencia corta y larga en la misma vara y esconde justo el
// caso que se quiere atender. La métrica correcta es EXCESO: cuántos días más allá de su
// propio corte proporcional (33 % de su vigencia — MTR_COSECHA_MARGEN_PROP, la misma
// constante de mtrPlanParaclinicos) cae cada diferido.
const MARGEN_PROP = 0.33; // debe coincidir con MTR_COSECHA_MARGEN_PROP del motor
function excesoDias(d) {
  if (typeof d.margenDias !== "number" || typeof d.vigenciaDias !== "number") return null;
  return d.margenDias - d.vigenciaDias * MARGEN_PROP;
}

const N = 10000;
const excesos = []; // exceso sobre el propio corte del 33%, de cada diferido
let pacientesConDiferidos = 0;
let pacientesConFtl = 0;

for (let i = 0; i < N; i++) {
  const ctx = pacienteSintetico();
  const plan = api.mtrPlanParaclinicos(ctx);
  if (!plan || !plan.ftl) continue;
  pacientesConFtl++;
  if (plan.diferidos && plan.diferidos.length) {
    pacientesConDiferidos++;
    for (const d of plan.diferidos) {
      const e = excesoDias(d);
      if (e !== null) excesos.push(e);
    }
  }
}

console.log("=== 1. El universo medido ===\n");
console.log("  Pacientes sintéticos generados     : " + N);
console.log("  Con fecha de toma calculable (ftl)  : " + pacientesConFtl);
console.log("  Con al menos un examen DIFERIDO     : " + pacientesConDiferidos
  + "  (" + (100 * pacientesConDiferidos / pacientesConFtl).toFixed(1) + " % de los que tienen ftl)");
console.log("  Total de exámenes diferidos medidos : " + excesos.length + "\n");

console.log("=== 2. ¿Por cuántos días se pasa cada diferido de SU PROPIO corte del 33%? ===\n");
console.log("  (exceso = margenDias − 33% de su vigencia. Un exceso chico es un \"casi\" —");
console.log("   el examen quedó diferido por poco, no porque le sobrara vigencia de verdad.)\n");
const cortes = [7, 14, 21, 30, 45, 60, 90];
let anterior = 0;
for (const corte of cortes) {
  const enRango = excesos.filter((m) => m > anterior && m <= corte).length;
  console.log("  " + String(anterior).padStart(3) + "–" + String(corte).padEnd(3) + " días : "
    + String(enRango).padStart(5) + "  (" + (100 * enRango / excesos.length).toFixed(1) + " %)");
  anterior = corte;
}
const masAlla = excesos.filter((m) => m > anterior).length;
console.log("  >" + anterior + "      días : " + String(masAlla).padStart(5)
  + "  (" + (100 * masAlla / excesos.length).toFixed(1) + " %)\n");

console.log("=== 3. Si se ampliara el corte en unos días de gracia, ¿cuántos VIAJES se ahorran? ===\n");
console.log("  Un viaje se ahorra por PACIENTE que tiene >=1 diferido dentro de la gracia");
console.log("  (arrastrar 2 diferidos del mismo paciente en la misma toma solo cuenta 1 viaje).\n");
for (const gracia of [7, 14, 21, 30]) {
  let pacientesQueSeAhorranViaje = 0;
  let examenesArrastrados = 0;
  let vigenciaGastadaTotal = 0;
  for (let i = 0; i < N; i++) {
    const ctx = pacienteSintetico();
    const plan = api.mtrPlanParaclinicos(ctx);
    if (!plan || !plan.diferidos || !plan.diferidos.length) continue;
    const dentroDeGracia = plan.diferidos.filter((d) => {
      const e = excesoDias(d);
      return e !== null && e <= gracia;
    });
    if (dentroDeGracia.length) {
      pacientesQueSeAhorranViaje++;
      examenesArrastrados += dentroDeGracia.length;
      for (const d of dentroDeGracia) vigenciaGastadaTotal += d.margenDias;
    }
  }
  console.log("  Gracia " + String(gracia).padStart(2) + " días → "
    + String(pacientesQueSeAhorranViaje).padStart(4) + " pacientes ahorran un viaje ("
    + (100 * pacientesQueSeAhorranViaje / N).toFixed(1) + " % del total), "
    + examenesArrastrados + " exámenes arrastrados, promedio "
    + (examenesArrastrados ? (vigenciaGastadaTotal / examenesArrastrados).toFixed(1) : "0")
    + " días de vigencia gastados antes de tiempo por examen arrastrado.");
}

console.log("\n=== 4. ¿Esto puede dejar vencer un examen? ===\n");
console.log("  No, por construcción: todo lo que hoy es \"diferido\" ya tiene margenDias > 0 (lo");
console.log("  que vence HOY o antes ya se cosecha, sin esperar ninguna regla nueva). Sumarle unos");
console.log("  días de gracia al corte del 33% solo ADELANTA la toma de ese examen a una fecha que");
console.log("  YA se eligió para otro — nunca mueve `ftl` hacia atrás ni atrasa nada. Es la misma");
console.log("  regla que ya existe (cosechar dentro de un margen), con el margen un poco más ancho.");
