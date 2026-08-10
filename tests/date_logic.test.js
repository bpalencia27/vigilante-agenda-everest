// ==========================================
// Funciones a testear (extraídas del userscript)
// ==========================================

// Mock del objeto Date para inyectar una fecha actual ("hoy") específica
let mockCurrentDate = null;
const OriginalDate = global.Date;

global.Date = class extends OriginalDate {
  constructor(...args) {
    if (args.length === 0 && mockCurrentDate) {
      super(mockCurrentDate);
    } else {
      super(...args);
    }
  }
};
global.Date.now = () => mockCurrentDate ? new OriginalDate(mockCurrentDate).getTime() : OriginalDate.now();

function setMockDate(isoDateStr) {
  mockCurrentDate = isoDateStr;
}

function resetMockDate() {
  mockCurrentDate = null;
}

// ----------------------------------------------------
// calcBusinessTargetDate
// ----------------------------------------------------
function calcBusinessTargetDate(monthsToAdd, daysToAdd) {
  const d = new Date();
  const originalDay = d.getDate(); // v8.1.0: VK-02 Guardar el día original
  if (monthsToAdd) {
    d.setMonth(d.getMonth() + monthsToAdd);
    if (d.getDate() !== originalDay) {
      d.setDate(0); // Ajuste EOM (End of Month) por desbordamiento
    }
  }
  if (daysToAdd) d.setDate(d.getDate() + daysToAdd);

  // Si cae sábado (6), retrocede 1 día -> Viernes. Si cae domingo (0), retrocede 2 días -> Viernes.
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1);
  else if (day === 0) d.setDate(d.getDate() - 2);

  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());

  return {
    iso: `${yyyy}-${mm}-${dd}`,             // Formato YYYY-MM-DD para API POST
    fmt: `${dd}/${mm}/${yyyy}`,             // Formato DD/MM/YYYY para API GET Turnos
    lbl: d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    dateObj: d,
  };
}

// ----------------------------------------------------
// calcTargetDateRange
// ----------------------------------------------------
function calcTargetDateRange(monthsToAdd, daysToAdd) {
  const baseObj = calcBusinessTargetDate(monthsToAdd, daysToAdd);
  const baseDate = new Date(baseObj.dateObj);
  const pad = (n) => String(n).padStart(2, "0");

  const getInfo = (dt, isCenter) => {
    const yyyy = dt.getFullYear();
    const mm = pad(dt.getMonth() + 1);
    const dd = pad(dt.getDate());
    const dayShort = dt.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", "");
    const dayCap = dayShort.charAt(0).toUpperCase() + dayShort.slice(1);
    return {
      iso: `${yyyy}-${mm}-${dd}`,
      fmt: `${dd}/${mm}/${yyyy}`,
      shortLbl: `${dayCap} ${dd}/${mm}`,
      lbl: dt.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      isCenter: !!isCenter,
      dateObj: new Date(dt),
    };
  };

  const prevDays = [];
  let curPrev = new Date(baseDate);
  while (prevDays.length < 3) {
    curPrev.setDate(curPrev.getDate() - 1);
    if (curPrev.getDay() !== 0 && curPrev.getDay() !== 6) {
      prevDays.unshift(getInfo(curPrev, false));
    }
  }

  const nextDays = [];
  let curNext = new Date(baseDate);
  while (nextDays.length < 3) {
    curNext.setDate(curNext.getDate() + 1);
    if (curNext.getDay() !== 0 && curNext.getDay() !== 6) {
      nextDays.push(getInfo(curNext, false));
    }
  }

  return [...prevDays, getInfo(baseDate, true), ...nextDays];
}

// ==========================================
// Framework de Pruebas Unitarias Minimalista
// ==========================================
let passed = 0;
let failed = 0;

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    console.error(`   Esperado: ${expected}`);
    console.error(`   Obtenido: ${actual}`);
    failed++;
  }
}

function assertArrayEqual(actual, expected, testName) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    console.error(`   Esperado: ${JSON.stringify(expected)}`);
    console.error(`   Obtenido: ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ==========================================
// Casos de Prueba (Edge Cases)
// ==========================================

console.log("🚀 Iniciando QA Tests para calcBusinessTargetDate y calcTargetDateRange...");

// 1. Caso Normal: Hoy + 0 meses y 15 días (Cae entre semana)
setMockDate("2023-10-04T12:00:00"); // Miércoles
let r1 = calcBusinessTargetDate(0, 15);
assertEqual(r1.iso, "2023-10-19", "Caso Normal: 15 días desde Mié 04/10/2023 -> Jue 19/10/2023");

// 2. Cálculo en fin de semana (Sábado -> Viernes)
setMockDate("2023-10-18T12:00:00"); // Miércoles
let r2 = calcBusinessTargetDate(0, 3); // Cae el sábado 21/10
assertEqual(r2.iso, "2023-10-20", "Ajuste Sábado a Viernes: +3 días cae en Sáb 21/10 -> Viernes 20/10");

// 3. Cálculo en fin de semana (Domingo -> Viernes)
setMockDate("2023-10-18T12:00:00"); // Miércoles
let r3 = calcBusinessTargetDate(0, 4); // Cae el domingo 22/10
assertEqual(r3.iso, "2023-10-20", "Ajuste Domingo a Viernes: +4 días cae en Dom 22/10 -> Viernes 20/10");

// 4. Año Bisiesto (Febrero 29)
setMockDate("2024-01-31T12:00:00"); // Año bisiesto
let r4 = calcBusinessTargetDate(1, 0); // +1 mes desde 31 de Enero
// Debería ser 29 de Febrero (que es Jueves)
assertEqual(r4.iso, "2024-02-29", "Año Bisiesto: 1 mes desde 31/01/2024 -> 29/02/2024");

// 5. Año NO Bisiesto (Febrero 28)
setMockDate("2023-01-31T12:00:00"); // Año normal
let r5 = calcBusinessTargetDate(1, 0); // +1 mes desde 31 de Enero
// Debería ser 28 de Febrero (Martes)
assertEqual(r5.iso, "2023-02-28", "Año No Bisiesto: 1 mes desde 31/01/2023 -> 28/02/2023");

// 6. Fin de mes con desbordamiento a meses de 30 días
setMockDate("2023-03-31T12:00:00"); // Marzo 31
let r6 = calcBusinessTargetDate(1, 0); // +1 mes
// Abril tiene 30, así que desbordaría si no tuviéramos el fix. Resultado esperado: Abril 30 (Dom), pero Dom->Viernes 28.
// Ojo: 31 de marzo + 1 mes = 30 de abril. 30 de abril de 2023 es DOMINGO.
// Entonces ajusta al VIERNES 28 de abril.
assertEqual(r6.iso, "2023-04-28", "Desbordamiento EOM a Dom: +1 mes desde 31/03/2023 -> 30/04/23 (Dom) -> Viernes 28/04/2023");

// 7. Prueba del rango de días ±3 hábiles (calcTargetDateRange)
setMockDate("2023-10-24T12:00:00"); // Martes 24/10/2023
// Fecha objetivo será Jueves 26/10/2023 (Martes + 2)
let range = calcTargetDateRange(0, 2);
const rangeIsos = range.map(r => r.iso);
// Previos: Mié 25, Mar 24, Lun 23
// Target: Jue 26
// Next: Vie 27, Lun 30, Mar 31
assertArrayEqual(rangeIsos, [
  "2023-10-23", // Lunes (-3)
  "2023-10-24", // Martes (-2)
  "2023-10-25", // Miércoles (-1)
  "2023-10-26", // Jueves (Centro)
  "2023-10-27", // Viernes (+1)
  "2023-10-30", // Lunes (+2) (Sáltese Sáb/Dom)
  "2023-10-31"  // Martes (+3)
], "Rango DateRange (Evitando Sábado y Domingo)");

// 8. Rango donde el centro es LUNES (para ver que hacia atrás salta el fin de semana)
setMockDate("2023-10-20T12:00:00"); // Viernes 20/10/2023
let range2 = calcTargetDateRange(0, 3); // Vie + 3 = Lunes 23/10/2023
const rangeIsos2 = range2.map(r => r.iso);
// Centro: Lunes 23.
// Hacia atrás: Vie 20, Jue 19, Mié 18
// Hacia adelante: Mar 24, Mié 25, Jue 26
assertArrayEqual(rangeIsos2, [
  "2023-10-18",
  "2023-10-19",
  "2023-10-20",
  "2023-10-23", // Centro
  "2023-10-24",
  "2023-10-25",
  "2023-10-26"
], "Rango DateRange con Lunes en el centro (prevDays salta fin de semana)");

console.log("\n==========================================");
console.log(`📊 RESULTADOS: ${passed} PASSED, ${failed} FAILED`);
console.log("==========================================");

if (failed > 0) {
  process.exit(1);
}
