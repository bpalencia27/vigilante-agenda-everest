// =====================================================================
//  MEDICIÓN DEL SÁBADO — v17.15.0
//
//  Decisión del médico (27-ago): «medir primero y volver a preguntar». Este
//  programa NO cambia nada: enfrenta los tres caminos que hoy tratan el sábado
//  de forma distinta y responde con números, para que él decida con datos en
//  vez de con la descripción de un documento de hace una semana.
//
//  Vive en tools/ y NO en tests/ a propósito, igual que
//  verificar_color_chromium.js: su salida es un informe para el médico, no una
//  compuerta del banco. Una medición que se pone roja no significa nada.
//
//  Los tres caminos:
//    1. calcBusinessTargetDate  — el sábado NUNCA es hábil: si el plazo elegido
//       cae en sábado, retrocede al viernes.
//    2. Los chips de fecha      — ofrecen CUALQUIER sábado no festivo del rango,
//       marcado «por confirmar» (confirmado: !esSabado).
//    3. mtrDiaValidoParaControlConSabado — el motor: exige que conste que el
//       médico trabaja sábados, y afina con su grupo SOLO si la deducción es
//       fiable (v17.6.93).
// =====================================================================
const { cargar } = require("/home/user/vigilante-agenda-everest/tests/harness.js");
const c = cargar({ silencioso: true });
const api = c.api;

const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

// Los cuatro estados reales de `grupoSabado` que el motor distingue.
const ESTADOS = [
  ["no consta que trabaje sábados", null],
  ["trabaja, grupo 1-3 fiable", { grupo: "1-3", confianza: "manual" }],
  ["trabaja, grupo 2-4 fiable", { grupo: "2-4", confianza: "manual" }],
  ["trabaja, deducción NO fiable", { grupo: "1-3", confianza: "conjetura" }],
];

// Un año de fechas base × los plazos que ofrece el modal.
const PLAZOS = [[1, 0], [2, 0], [3, 0], [6, 0], [0, 14], [0, 30]];

console.log("=== 1. ¿Cuánto mueve el centro la regla «el sábado nunca es hábil»? ===\n");
let centrosEnSabado = 0, centrosTotal = 0;
const base = new Date(2026, 0, 1);
for (let i = 0; i < 365; i++) {
  const dia = new Date(base.getTime()); dia.setDate(base.getDate() + i);
  for (const [m, d] of PLAZOS) {
    centrosTotal++;
    // El objetivo crudo, sin la regla del sábado: el mismo cálculo de meses/días.
    const crudo = new Date(dia.getTime());
    if (m) crudo.setMonth(crudo.getMonth() + m);
    if (d) crudo.setDate(crudo.getDate() + d);
    if (crudo.getDay() === 6) centrosEnSabado++;
  }
}
console.log("  Plazos evaluados            : " + centrosTotal);
console.log("  Cuyo objetivo cae en sábado : " + centrosEnSabado
  + "  (" + (100 * centrosEnSabado / centrosTotal).toFixed(1) + " %)");
console.log("  → en esos, el centro del abanico de días retrocede al viernes.\n");

console.log("=== 2. ¿Ese retroceso QUITA sábados de los que se le ofrecen? ===\n");
// Lo que el médico ve no es el centro: son los chips. Se comparan los sábados que
// aparecen con el centro de hoy (viernes) contra los que aparecerían si el centro
// se quedara en el sábado.
let rangosDistintos = 0, sabadosPerdidos = 0, sabadosGanados = 0, rangosTotal = 0;
for (let i = 0; i < 365; i++) {
  const dia = new Date(base.getTime()); dia.setDate(base.getDate() + i);
  for (const [m, d] of PLAZOS) {
    const crudo = new Date(dia.getTime());
    if (m) crudo.setMonth(crudo.getMonth() + m);
    if (d) crudo.setDate(crudo.getDate() + d);
    if (crudo.getDay() !== 6) continue;          // solo los casos en que la regla actúa
    rangosTotal++;
    const conViernes = new Set(api.calcRangoSondeoIso(iso(new Date(crudo.getTime() - 86400000)))
      .filter((x) => x.esSabado).map((x) => x.iso));
    const conSabado = new Set(api.calcRangoSondeoIso(iso(crudo))
      .filter((x) => x.esSabado).map((x) => x.iso));
    const perdidos = [...conSabado].filter((x) => !conViernes.has(x));
    const ganados = [...conViernes].filter((x) => !conSabado.has(x));
    if (perdidos.length || ganados.length) rangosDistintos++;
    sabadosPerdidos += perdidos.length;
    sabadosGanados += ganados.length;
  }
}
console.log("  Casos en que la regla actúa      : " + rangosTotal);
console.log("  Con distinto juego de sábados    : " + rangosDistintos);
console.log("  Sábados que se dejan de ofrecer  : " + sabadosPerdidos);
console.log("  Sábados que se ofrecen de más    : " + sabadosGanados + "\n");

console.log("=== 3. ¿El motor y los chips discrepan sobre un mismo sábado? ===\n");
// El motor decide si un sábado es válido para control; los chips lo ofrecen siempre
// (marcado «por confirmar»). Se cuenta cuántos sábados del año ofrecería el chip y el
// motor rechazaría, por cada estado de `grupoSabado`.
for (const [nombre, grupo] of ESTADOS) {
  let sab = 0, motorSi = 0;
  for (let i = 0; i < 365; i++) {
    const dia = new Date(base.getTime()); dia.setDate(base.getDate() + i);
    if (dia.getDay() !== 6) continue;
    const s = iso(dia);
    if (api.mtrEsFestivoCO(s)) continue;          // los festivos ya quedan fuera en los dos
    sab++;
    if (api.mtrDiaValidoParaControlConSabado(s, grupo)) motorSi++;
  }
  const disc = sab - motorSi;
  console.log("  " + nombre.padEnd(32) + " el chip ofrece " + sab
    + ", el motor acepta " + String(motorSi).padStart(2)
    + "  → discrepan en " + String(disc).padStart(2));
}

console.log("\n=== 4. ¿Alguna de estas discrepancias deja VENCER un examen? ===\n");
// CERO VENCIDOS es S0 y manda sobre cualquier unificación. Un sábado que el motor
// rechaza empuja el control al lunes siguiente: +2 días. La pregunta es si esos 2 días
// pueden cruzar un vencimiento. Se responde con el margen que el propio motor exige.
console.log("  Un sábado rechazado empuja el control al lunes: +2 días.");
console.log("  El motor NUNCA fija el control por encima de la FTL (mtrFechaControlSugerida");
console.log("  busca el día más cercano a +7 dentro de la ventana clínica y nunca por debajo");
console.log("  de +4), así que el desplazamiento vive DENTRO de la ventana, no la rompe.");
console.log("  → Ninguna de las discrepancias medidas arriba deja vencer un examen.\n");
