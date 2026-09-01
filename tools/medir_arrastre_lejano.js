// =====================================================================
//  MEDICIÓN DEL ARRASTRE LEJANO — v18.0.43 (en curso)
//
//  Origen: reporte en vivo del médico (1-sep), con captura de pantalla. Un plan
//  con la toma sugerida el 23 de diciembre (a 113 días de hoy, porque la
//  creatinina vence ese día) arrastraba SIETE exámenes que vencen el 20 de
//  febrero (a 172 días), cada uno rotulado "se aprovecha el mismo viaje". Son 59
//  días de vigencia quemados por examen. Palabras del médico: "ESTO TAMPOCO
//  TIENE SENTIDO LA FORMA EN LA QUE SE AGRUPAN TODOS LOS EXÁMENES QUE INCLUSO
//  ESTAN A MUCHO TIEMPO SE SUGIERE LA REALIZACION EN DICIEMBRE Y NO ES ASÍ".
//
//  QUÉ PASA EN EL MOTOR (no es un fallo de código, es la regla haciendo lo que
//  dice): la cosecha mide el margen SOLO contra el 33 % de la vigencia del
//  propio examen (MTR_COSECHA_MARGEN_PROP) y, si no alcanza, contra 14 días más
//  de gracia (MTR_GRACIA_COSECHA_DIAS). Para un examen de 180 días de vigencia
//  eso permite adelantarlo hasta 0,33·180 + 14 = 73,4 días. Nunca se mira
//  CUÁNTOS DÍAS son en términos absolutos, ni a qué distancia está la propia
//  toma. Es la segunda vez que el médico reporta el mismo número por otra
//  puerta: en v17.30.0 fue con el ANR (toma a 6 días, exámenes arrastrados ~59
//  días) y se apagó la cosecha genérica bajo ANR. Aquí no hay ANR.
//
//  QUÉ MIDE ESTE PROGRAMA: la distribución real de DÍAS ADELANTADOS de cada
//  examen cosechado (vence − ftl), y qué pasaría con un tope absoluto en días
//  sobre ese adelanto — cuántos viajes extra costaría y cuánta vigencia
//  devolvería. Mismo método que medir_cercania.js (Monte Carlo determinista,
//  pacientes sintéticos, cero datos reales): el médico elige el número con la
//  tabla delante, no a ojo.
//
//  NO CAMBIA NADA: vive en tools/, no es una compuerta del banco.
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

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const restarDiasIso = (iso, dias) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - dias);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const diasEntre = (isoA, isoB) => {
  const a = new Date(isoA + "T00:00:00").getTime();
  const b = new Date(isoB + "T00:00:00").getTime();
  return Math.round((a - b) / 86400000);
};

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

// `techoDias` acota cuán viejo puede ser el último resultado de cada driver. Con
// 250 (la población de medir_cercania.js) casi siempre hay algo vencido, sale
// `hayEstadoA` y la toma cae a 14-21 días: esa población NO contiene el caso que
// el médico reportó. Con 30 se simula al paciente que acaba de hacerse todo el
// panel —el de la captura— y la toma se va a meses vista.
function pacienteSintetico(rnd, techoDias) {
  const techo = techoDias || 250;
  const programa = pick(rnd, PROGRAMAS);
  const esDm2 = programa === "DM2";
  const estadioAdministrativo = programa === "ERC" ? pick(rnd, ESTADIOS_ERC) : null;
  const categoriaRiesgo = pick(rnd, RIESGOS);
  const fueraDeMetaGlobal = rnd() < 0.25;
  const ultimos = {};
  for (const driver of DRIVERS) {
    if (rnd() < 0.12) continue;
    const diasDesde = Math.floor(rnd() * techo);
    ultimos[driver] = { fecha: restarDiasIso(HOY, diasDesde), valor: valorPlausible(driver, fueraDeMetaGlobal) };
  }
  return {
    hoyIso: HOY, programa: programa, estadioAdministrativo: estadioAdministrativo,
    esDm2: esDm2, edad: 40 + Math.floor(rnd() * 45), rac: ultimos.RAC ? ultimos.RAC.valor : 12,
    categoriaRiesgo: categoriaRiesgo, ultimos: ultimos,
  };
}

// A qué regla se le puede atribuir cada cosechado. El motor no marca el motivo en
// el objeto, así que se reconstruye con las MISMAS cuentas de mtrPlanParaclinicos.
const MARGEN_PROP = 0.33;   // MTR_COSECHA_MARGEN_PROP
const GRACIA = 14;          // MTR_GRACIA_COSECHA_DIAS
const LIPIDOS = ["COLESTEROL_TOTAL", "COLESTEROL_HDL", "COLESTEROL_LDL", "TRIGLICERIDOS"];
function reglaQueLoCosecho(a, plan) {
  const margen = diasEntre(a.vence, plan.ftl);
  if (margen <= 0) return "vence antes de la toma";
  if (plan.anr && a.clave === "CREATININA") return "ANR (creatinina)";
  if (plan.anr && a.clave === "RAC") return "ANR (RAC sincroniza)";
  if (typeof a.vigenciaDias === "number") {
    if (margen <= a.vigenciaDias * MARGEN_PROP) return "cosecha 33 %";
    if (margen - a.vigenciaDias * MARGEN_PROP <= GRACIA) return "gracia 14 d";
  }
  if (LIPIDOS.indexOf(a.clave) >= 0) return "GRUPO LIPIDOS (sin tope)";
  return "otra";
}

const N = 10000;

// Un cosechado se "adelanta" (vence − ftl) días. Los faltantes/vencidos NO están
// en esta cuenta: se ordenan porque hacen falta, no porque se aproveche un viaje.
function adelantosDelPlan(plan) {
  if (!plan || !plan.ftl || !plan.cosechados) return [];
  const out = [];
  for (const a of plan.cosechados) {
    if (!a.vence) continue;
    out.push({
      clave: a.clave, adelanto: diasEntre(a.vence, plan.ftl),
      vigenciaDias: (typeof a.vigenciaDias === "number") ? a.vigenciaDias : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------
//  Un informe por POBLACIÓN. La de 250 días es la de medir_cercania.js (casi
//  siempre hay algo vencido -> toma a 14-21 días). La de 30 días es el paciente
//  de la captura: acaba de hacerse el panel completo, nada vencido, y la toma se
//  va a meses vista porque la fija el primer vencimiento futuro.
// ---------------------------------------------------------------------
function informe(rotulo, techo) {
  console.log("\n#####################################################################");
  console.log("##  POBLACIÓN: " + rotulo);
  console.log("#####################################################################\n");

  let rnd = mulberry32(20260901);
  const adelantos = [];
  const ftlDistancias = [];
  const porRegla = new Map();
  let planes = 0, planesConCosecha = 0;
  for (let i = 0; i < N; i++) {
    const ctx = pacienteSintetico(rnd, techo);
    const plan = api.mtrPlanParaclinicos(ctx);
    if (!plan || !plan.ftl) continue;
    planes++;
    ftlDistancias.push(diasEntre(plan.ftl, HOY));
    const ad = [];
    for (const a of (plan.cosechados || [])) {
      if (!a.vence) continue;
      const regla = reglaQueLoCosecho(a, plan);
      const adelanto = diasEntre(a.vence, plan.ftl);
      ad.push({ clave: a.clave, adelanto: adelanto, regla: regla });
      const acc = porRegla.get(regla) || { n: 0, suma: 0, max: 0 };
      acc.n++; acc.suma += adelanto; acc.max = Math.max(acc.max, adelanto);
      porRegla.set(regla, acc);
    }
    if (ad.length) { planesConCosecha++; adelantos.push(...ad); }
  }

  console.log("1. Universo");
  console.log("   pacientes " + N + " · con ftl " + planes + " · con cosecha " + planesConCosecha
    + " · exámenes cosechados " + adelantos.length + "\n");

  console.log("2. Distancia de la toma (ftl − hoy)");
  let ant = 0;
  for (const corte of [14, 30, 60, 90, 120, 180]) {
    const n = ftlDistancias.filter((d) => d > ant && d <= corte).length;
    console.log("   " + String(ant).padStart(3) + "–" + String(corte).padEnd(3) + " d : "
      + String(n).padStart(5) + "  (" + (100 * n / ftlDistancias.length).toFixed(1) + " %)");
    ant = corte;
  }
  const lejos = ftlDistancias.filter((d) => d > ant).length;
  console.log("   >" + ant + "     d : " + String(lejos).padStart(5)
    + "  (" + (100 * lejos / ftlDistancias.length).toFixed(1) + " %)\n");

  console.log("3. Días que se ADELANTA cada examen cosechado (vigencia buena que se tira)");
  ant = 0;
  for (const corte of [7, 14, 21, 30, 45, 60, 75, 90]) {
    const n = adelantos.filter((a) => a.adelanto > ant && a.adelanto <= corte).length;
    console.log("   " + String(ant).padStart(3) + "–" + String(corte).padEnd(3) + " d : "
      + String(n).padStart(5) + "  (" + (100 * n / adelantos.length).toFixed(1) + " %)");
    ant = corte;
  }
  const masAlla = adelantos.filter((a) => a.adelanto > ant).length;
  console.log("   >" + ant + "      d : " + String(masAlla).padStart(5)
    + "  (" + (100 * masAlla / adelantos.length).toFixed(1) + " %)");
  console.log("   máximo observado: " + adelantos.reduce((m, a) => Math.max(m, a.adelanto), 0) + " días\n");

  console.log("4. QUÉ REGLA lo cosechó (y cuánto adelanta cada una)");
  const filas = Array.from(porRegla.entries()).sort((x, y) => y[1].n - x[1].n);
  for (const [regla, acc] of filas) {
    console.log("   " + regla.padEnd(26) + " n=" + String(acc.n).padStart(6)
      + "  (" + (100 * acc.n / adelantos.length).toFixed(1).padStart(5) + " %)"
      + "  adelanto medio " + (acc.suma / acc.n).toFixed(1).padStart(6)
      + " d  ·  máx " + String(acc.max).padStart(4) + " d");
  }
  console.log("");

  console.log("5. Coste de un TOPE ABSOLUTO de días de adelanto");
  console.log("   (\"viaje extra\" = paciente que hoy sale en UN viaje y con el tope saldría en dos)");
  for (const tope of [21, 30, 45, 60, 75]) {
    let r3 = mulberry32(20260901);
    let viajesExtra = 0, devueltos = 0, vigenciaSalvada = 0, pacientes = 0;
    for (let i = 0; i < N; i++) {
      const ctx = pacienteSintetico(r3, techo);
      const plan = api.mtrPlanParaclinicos(ctx);
      if (!plan || !plan.ftl) continue;
      pacientes++;
      const superan = (plan.cosechados || []).filter((a) => a.vence && diasEntre(a.vence, plan.ftl) > tope);
      if (!superan.length) continue;
      devueltos += superan.length;
      for (const a of superan) vigenciaSalvada += diasEntre(a.vence, plan.ftl);
      if (!(plan.diferidos && plan.diferidos.length)) viajesExtra++;
    }
    console.log("   tope " + String(tope).padStart(3) + " d → " + String(devueltos).padStart(6)
      + " exámenes devueltos, " + String(viajesExtra).padStart(5) + " viajes extra ("
      + (100 * viajesExtra / pacientes).toFixed(2).padStart(5) + " % de pacientes), "
      + String(vigenciaSalvada).padStart(7) + " d de vigencia salvados");
  }
  console.log("");
}

informe("panel reciente — el caso de la captura (último resultado 0-30 d)", 30);
informe("mixta — la de medir_cercania.js (último resultado 0-250 d)", 250);

// ---------------------------------------------------------------------
//  6. LA HIPÓTESIS QUE IMPORTA
//
//  Un tope ABSOLUTO en días es la respuesta equivocada: castiga igual a la toma
//  que es dentro de 10 días (donde adelantar 35 d ahorra un viaje real y muy
//  próximo) que a la toma que es dentro de 113 (donde no hay ningún viaje que
//  compartir todavía — el plan se recalcula en cada consulta antes de esa
//  fecha). La asimetría real no es cuántos días se adelanta el pasajero, sino a
//  qué distancia está la toma a la que se le sube.
//
//  Hipótesis: la cosecha GENÉRICA (33 % + gracia) solo tiene sentido cuando la
//  toma cae dentro de la ventana que este proyecto ya llama "el mismo viaje"
//  (MTR_TECHO_ESTADO_A = 21 d). Fuera de ella no se apaga nada más: el grupo de
//  lípidos y el ANR siguen igual, porque esos no son una elección del script
//  (los lípidos vienen en el mismo paquete de Everest y no se pueden pedir
//  sueltos; el ANR lo ordenó el médico explícitamente).
// ---------------------------------------------------------------------
console.log("\n#####################################################################");
console.log("##  6. LA COSECHA GENÉRICA SOLO CON LA TOMA CERCA");
console.log("#####################################################################\n");
for (const [rotulo, techo] of [["panel reciente (0-30 d)", 30], ["mixta (0-250 d)", 250]]) {
  console.log("  " + rotulo);
  for (const umbral of [14, 21, 30, 45]) {
    let r = mulberry32(20260901);
    let pacientes = 0, viajesExtra = 0, devueltos = 0, vigenciaSalvada = 0, planesTocados = 0;
    for (let i = 0; i < N; i++) {
      const ctx = pacienteSintetico(r, techo);
      const plan = api.mtrPlanParaclinicos(ctx);
      if (!plan || !plan.ftl) continue;
      pacientes++;
      if (diasEntre(plan.ftl, HOY) <= umbral) continue;
      const genericos = (plan.cosechados || []).filter((a) => {
        if (!a.vence) return false;
        const regla = reglaQueLoCosecho(a, plan);
        return regla === "cosecha 33 %" || regla === "gracia 14 d";
      });
      if (!genericos.length) continue;
      planesTocados++;
      devueltos += genericos.length;
      for (const a of genericos) vigenciaSalvada += diasEntre(a.vence, plan.ftl);
      if (!(plan.diferidos && plan.diferidos.length)) viajesExtra++;
    }
    console.log("    umbral " + String(umbral).padStart(2) + " d → " + String(planesTocados).padStart(4)
      + " planes cambian, " + String(devueltos).padStart(5) + " exámenes vuelven a diferidos, "
      + String(viajesExtra).padStart(4) + " viajes extra (" + (100 * viajesExtra / pacientes).toFixed(2).padStart(5)
      + " %), " + String(vigenciaSalvada).padStart(7) + " d de vigencia salvados"
      + (devueltos ? "  ·  media " + (vigenciaSalvada / devueltos).toFixed(1) + " d/examen" : ""));
  }
  console.log("");
}
